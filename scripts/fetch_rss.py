"""
FOMORader · fetch_rss.py
爬取国际 AI RSS 源，初步质量筛选，输出标准化 JSON 到 data/hotspots_raw.json

用法：
    python scripts/fetch_rss.py              # 默认抓取最近 7 天
    python scripts/fetch_rss.py --days 14   # 扩大时间范围
    python scripts/fetch_rss.py --dry-run   # 只打印前3条，不写文件
    python scripts/fetch_rss.py --no-filter # 跳过质量筛选，收录全部
"""

import argparse
import hashlib
import json
import re
import warnings
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Force UTF-8 output for Windows consoles
sys.stdout.reconfigure(encoding='utf-8')

import requests
import feedparser
from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning

warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

_TEXT_TRANSLATION_TABLE = str.maketrans({
    "\u2028": "\n",
    "\u2029": "\n",
    "\u0085": "\n",
})


def normalize_text(text: str) -> str:
    return (text or "").translate(_TEXT_TRANSLATION_TABLE)


# ──────────────────────────────────────────────
# RSS 源配置（含来源权重）
# source_weight 直接传入 hotspots 表，作为评分"平台分"基础值
# ──────────────────────────────────────────────
RSS_SOURCES = [
    # 研究机构官方（一手信息，最高权重）
    {"name": "OpenAI Blog",           "url": "https://openai.com/index.xml",                                          "source_weight": 1.0},
    {"name": "Anthropic News",        "url": "https://www.anthropic.com/news/rss",                                    "source_weight": 1.0},
    {"name": "Google DeepMind",       "url": "https://deepmind.google/blog/rss.xml",                                  "source_weight": 1.0},
    {"name": "Meta AI",               "url": "https://ai.meta.com/blog/rss/",                                         "source_weight": 0.95},

    {"name": "Microsoft AI",          "url": "https://blogs.microsoft.com/ai/feed/",                                  "source_weight": 0.90},
    {"name": "AWS Machine Learning",  "url": "https://aws.amazon.com/blogs/machine-learning/feed/",                   "source_weight": 0.85},
    # 精选周刊（信噪比高）
    {"name": "Import AI",             "url": "https://importai.substack.com/feed",                                    "source_weight": 0.90},
    {"name": "The Batch",             "url": "https://www.deeplearning.ai/the-batch/feed/",                           "source_weight": 0.90},
    # 深度媒体
    {"name": "MIT Technology Review", "url": "https://www.technologyreview.com/topic/artificial-intelligence/feed",   "source_weight": 0.80},
    {"name": "Ars Technica",          "url": "https://feeds.arstechnica.com/arstechnica/technology-lab",              "source_weight": 0.75},
    {"name": "VentureBeat AI",        "url": "https://venturebeat.com/category/ai/feed/",                             "source_weight": 0.70},
    # 科技媒体
    {"name": "TechCrunch AI",         "url": "https://techcrunch.com/category/artificial-intelligence/feed/",         "source_weight": 0.65},
    {"name": "The Verge AI",          "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",     "source_weight": 0.60},
]

# ──────────────────────────────────────────────
# 质量筛选配置
# ──────────────────────────────────────────────

# 最低来源权重门槛（低于此值的来源整体跳过）
MIN_SOURCE_WEIGHT = 0.60

# 摘要最低长度（字符数），过短说明内容单薄
MIN_SUMMARY_LENGTH = 100

# 标题必须包含至少一个核心词（ArXiv 等高量源的补充过滤）
MUST_INCLUDE_KEYWORDS = [
    "ai", "model", "llm", "gpt", "claude", "gemini", "deepseek", "qwen",
    "machine learning", "neural", "agent", "benchmark", "alignment",
    "multimodal", "fine-tun", "inference", "training", "transformer",
    "diffusion", "reinforcement", "safety", "open.source", "reasoning",
]

# 标题包含以下词直接丢弃（标题党 / 广告 / 低质量）
BLACKLIST_KEYWORDS = [
    "sponsored", "advertis", "deal", "sale", "discount",
    "how to use chatgpt for", "top 10", "top 5", "best ai tools",
    "you need to know", "everyone is talking", "game.changer",
]

# 需要强制关键词过滤的来源（量大、主题宽泛）
STRICT_FILTER_SOURCES = {"ArXiv CS.AI", "ArXiv CS.LG", "Ars Technica"}

SUMMARY_MAX_CHARS = 300


# ──────────────────────────────────────────────
# 质量筛选
# ──────────────────────────────────────────────
def passes_quality_filter(title: str, summary: str, source_name: str) -> tuple[bool, str]:
    """
    初步质量筛选，返回 (是否通过, 过滤原因)。
    通过返回 (True, "")，不通过返回 (False, reason)。
    """
    title_lower = title.lower()

    # 1. 黑名单关键词
    for kw in BLACKLIST_KEYWORDS:
        if kw in title_lower:
            return False, f"黑名单词: {kw}"

    # 2. 摘要长度
    if len(summary) < MIN_SUMMARY_LENGTH:
        return False, f"摘要过短: {len(summary)} 字符"

    # 3. 严格来源需要核心词命中
    if source_name in STRICT_FILTER_SOURCES:
        if not any(kw in title_lower for kw in MUST_INCLUDE_KEYWORDS):
            return False, "未命中 AI 核心词"

    return True, ""


# ──────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────
def make_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:8]


def strip_html(raw: str) -> str:
    text = BeautifulSoup(raw or "", "html.parser").get_text(separator=" ")
    return normalize_text(re.sub(r"\s+", " ", text).strip())


def to_utc_iso(entry) -> str | None:
    t = entry.get("published_parsed") or entry.get("updated_parsed")
    if not t:
        return None
    dt = datetime(*t[:6], tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def extract_summary(entry) -> str:
    raw = ""
    if entry.get("content"):
        raw = entry["content"][0].get("value", "")
    elif entry.get("summary"):
        raw = entry["summary"]
    else:
        raw = entry.get("title", "")
    return normalize_text(strip_html(raw)[:SUMMARY_MAX_CHARS])


def extract_tags(title: str, source_name: str) -> list[str]:
    keywords = [
        "openai", "anthropic", "gemini", "claude", "gpt", "llm",
        "deepmind", "mistral", "llama", "deepseek", "qwen", "meta ai",
        "agent", "multimodal", "rag", "fine-tuning", "benchmark",
        "safety", "alignment", "open-source", "hugging face", "arxiv",
    ]
    title_lower = title.lower()
    found = [kw for kw in keywords if kw in title_lower]
    source_tag = source_name.lower().replace(" · ", "-").replace(" ", "-")
    return list(dict.fromkeys([source_tag] + found))


# ──────────────────────────────────────────────
# 核心爬取
# ──────────────────────────────────────────────
def fetch_raw(url: str) -> bytes | None:
    headers = {"User-Agent": "Mozilla/5.0 (FOMORader RSS Reader)"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        raw = resp.content
        # 清洗 XML 1.0 不允许的控制字符
        raw = re.sub(rb'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', b'', raw)
        return raw
    except Exception:
        return None


def fetch_source(
    source: dict,
    cutoff: datetime,
    apply_filter: bool,
) -> tuple[list[dict], str | None, dict]:
    """
    爬取单个 RSS 源。
    返回 (通过筛选的条目列表, 错误信息, 统计信息)
    """
    name   = source["name"]
    url    = source["url"]
    weight = source["source_weight"]
    stats  = {"total": 0, "passed": 0, "filtered": 0, "reason": {}}

    # 来源权重低于门槛直接跳过
    if apply_filter and weight < MIN_SOURCE_WEIGHT:
        return [], f"来源权重 {weight} 低于门槛 {MIN_SOURCE_WEIGHT}", stats

    raw = fetch_raw(url)
    if raw is None:
        return [], "网络请求失败", stats

    try:
        feed = feedparser.parse(raw)
    except Exception as e:
        return [], f"解析失败: {e}", stats

    if feed.bozo and not feed.entries:
        return [], f"Feed 异常: {feed.bozo_exception}", stats

    results = []
    now_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    for entry in feed.entries:
        link  = entry.get("link", "").strip()
        title = normalize_text(strip_html(entry.get("title", "")).strip())

        if not link or not title:
            continue

        pub_iso = to_utc_iso(entry)

        # 时间过滤
        if pub_iso:
            pub_dt = datetime.fromisoformat(pub_iso.replace("Z", "+00:00"))
            if pub_dt < cutoff:
                continue

        stats["total"] += 1
        summary = normalize_text(extract_summary(entry))

        # 质量筛选
        if apply_filter:
            passed, reason = passes_quality_filter(title, summary, name)
            if not passed:
                stats["filtered"] += 1
                stats["reason"][reason] = stats["reason"].get(reason, 0) + 1
                continue

        stats["passed"] += 1
        results.append({
            "id":             make_id(link),
            "source":         name,
            "source_url":     url,
            "source_weight":  weight,   # 传给 scorer.ts 作为平台分基础值
            "title":          title,
            "url":            link,
            "published_at":   pub_iso,
            "summary":        summary,
            "tags":           extract_tags(title, name),
            "fetch_at":       now_utc,
        })

    return results, None, stats


def fetch_all(days: int, apply_filter: bool) -> list[dict]:
    cutoff   = datetime.now(timezone.utc) - timedelta(days=days)
    all_items: dict[str, dict] = {}
    total_filtered = 0

    print(f"\n📡 开始爬取，时间范围：最近 {days} 天，质量筛选：{'开启' if apply_filter else '关闭'}")
    print(f"{'─'*55}")
    print(f"  {'来源':<28} {'通过':>4}  {'过滤':>4}  {'状态'}")
    print(f"{'─'*55}")

    for source in RSS_SOURCES:
        items, err, stats = fetch_source(source, cutoff, apply_filter)
        if err:
            print(f"  ❌ {source['name']:<28} {'—':>4}  {'—':>4}  {err}")
        else:
            for item in items:
                all_items[item["url"]] = item
            total_filtered += stats["filtered"]
            status = f"w={source['source_weight']}"
            print(f"  ✅ {source['name']:<28} {stats['passed']:>4}  {stats['filtered']:>4}  {status}")

            # 打印过滤明细（仅在有过滤时）
            if stats["filtered"] > 0 and stats["reason"]:
                for reason, count in stats["reason"].items():
                    print(f"     {'':28} {'':>4}  ↳ {reason} ({count}条)")

    sorted_items = sorted(
        all_items.values(),
        key=lambda x: x["published_at"] or "",
        reverse=True,
    )

    print(f"{'─'*55}")
    print(f"📦 最终：{len(sorted_items)} 条（已去重）  过滤丢弃：{total_filtered} 条\n")
    return sorted_items


# ──────────────────────────────────────────────
# 数据合并功能（与x-collector保持一致）
# ──────────────────────────────────────────────
def merge_into(existing_path: Path, new_items: list[dict]) -> tuple[list[dict], int]:
    """Merge new items into existing JSON file, avoiding duplicates by URL."""
    existing = []
    if existing_path.exists():
        existing_text = existing_path.read_text(encoding="utf-8")
        try:
            existing = json.loads(existing_text)
        except json.JSONDecodeError:
            existing_text = existing_path.read_text(encoding="utf-8-sig")
            existing = json.loads(existing_text)
        if not isinstance(existing, list):
            raise ValueError(f"Invalid JSON structure in {existing_path}: expected an array.")

    url_map = {item["url"]: item for item in existing}
    added = 0
    for item in new_items:
        if item["url"] not in url_map:
            url_map[item["url"]] = item
            added += 1

    # Sort by published_at desc
    merged = sorted(
        url_map.values(),
        key=lambda x: x.get("published_at") or "",
        reverse=True,
    )
    return merged, added

# ──────────────────────────────────────────────
# 入口
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="FOMORader RSS Fetcher")
    parser.add_argument("--days",      type=int, default=7,                        help="抓取最近 N 天（默认 7）")
    parser.add_argument("--out",       type=str, default="data/hotspots_rss.json", help="输出路径")
    parser.add_argument("--dry-run",   action="store_true",                        help="只打印前3条，不写文件")
    parser.add_argument("--no-filter", action="store_true",                        help="跳过质量筛选，收录全部")
    args = parser.parse_args()

    apply_filter = not args.no_filter
    items = fetch_all(args.days, apply_filter)

    if args.dry_run:
        print(json.dumps(items[:3], ensure_ascii=False, indent=2))
        print(f"\n（dry-run 模式，仅展示前3条，共 {len(items)} 条）")
        return

    # 保存到文件（支持合并）
    project_root = Path(__file__).resolve().parents[1]
    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = (project_root / out_path).resolve()
    
    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged, added = merge_into(out_path, items)

    out_path.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"✅ 已写入 → {out_path}  ({out_path.stat().st_size // 1024} KB)")
    print(f"   新增 {added} 条，总计 {len(merged)} 条")


if __name__ == "__main__":
    main()
