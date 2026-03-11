"""
FOMORader · fetch_x_twitterapi.py
用 twitterapi.io 搜索高质量中文 AI 推文，存为本地静态 JSON。

前置：
    pip install requests python-dotenv
    .env 文件写入：TWITTERAPI_KEY=你的key

注册地址：https://twitterapi.io（注册送 $1 免费额度）

用法：
    python scripts/fetch_x_twitterapi.py                   # 默认爬取，合并到 hotspots_raw.json
    python scripts/fetch_x_twitterapi.py --max 100         # 最多100条（约$0.015）
    python scripts/fetch_x_twitterapi.py --out data/x_raw.json  # 单独输出，不合并
    python scripts/fetch_x_twitterapi.py --dry-run         # 只打印前3条，不写文件
    python scripts/fetch_x_twitterapi.py --min-faves 100   # 提高点赞门槛

费用：$0.15/1000条，100条 ≈ $0.015 ≈ 0.11元
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# 配置
# ──────────────────────────────────────────────
API_BASE = "https://api.twitterapi.io"

# 质量筛选参数（可通过 CLI 参数覆盖）
DEFAULT_MIN_FAVES    = 50   # 最低点赞数
DEFAULT_MIN_RETWEETS = 10   # 最低转推数
DEFAULT_MAX_ITEMS    = 100   # 默认爬取条数

# 搜索关键词（质量筛选已内嵌在 query 里）
def build_query(min_faves: int, min_retweets: int) -> str:
    return (
        "(AI OR 人工智能 OR 大模型 OR OpenAI OR Claude OR Gemini OR DeepSeek OR Grok) "
        f"lang:zh -is:retweet "
        f"min_faves:{min_faves} "
        f"min_retweets:{min_retweets}"
    )

SUMMARY_MAX_CHARS = 300


# ──────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────
def make_id(tweet_id: str) -> str:
    return hashlib.sha256(str(tweet_id).encode()).hexdigest()[:8]


def to_utc_iso(dt_str: str | None) -> str | None:
    if not dt_str:
        return None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return dt_str


def is_chinese(text: str, min_chars: int = 5) -> bool:
    """正文必须包含至少 min_chars 个汉字"""
    return len(re.findall(r'[\u4e00-\u9fff]', text)) >= min_chars


def extract_tags(text: str) -> list[str]:
    hashtags = [f"#{tag.lower()}" for tag in re.findall(r"#(\w+)", text)]
    keywords = [
        "openai", "anthropic", "gemini", "claude", "gpt", "deepseek",
        "grok", "llm", "大模型", "人工智能", "agent", "多模态", "agi",
        "mistral", "llama", "qwen", "huggingface",
    ]
    text_lower = text.lower()
    found = [kw for kw in keywords if kw in text_lower]
    return list(dict.fromkeys(["x-中文"] + hashtags + found))


def normalize_tweet(raw: dict) -> dict | None:
    """
    将 twitterapi.io 返回的推文转换为 hotspots_raw.json 标准结构。
    返回 None 表示该条目不符合质量要求，应丢弃。
    """
    tweet_id = str(raw.get("id") or raw.get("tweet_id") or "")
    text = raw.get("text") or raw.get("full_text") or ""
    author = raw.get("author") or raw.get("user") or {}
    username = (
        author.get("userName")
        or author.get("username")
        or author.get("screen_name")
        or "unknown"
    )
    created_at = raw.get("createdAt") or raw.get("created_at") or ""

    if not tweet_id or not text:
        return None

    # 中文硬过滤（双重保险）
    if not is_chinese(text):
        return None

    url = f"https://x.com/{username}/status/{tweet_id}"
    now_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # 互动数据（兼容不同字段名）
    likes     = raw.get("likeCount")    or raw.get("favorite_count", 0)
    retweets  = raw.get("retweetCount") or raw.get("retweet_count", 0)
    replies   = raw.get("replyCount")   or raw.get("reply_count", 0)
    views     = raw.get("viewCount")    or raw.get("impression_count", 0)
    bookmarks = raw.get("bookmarkCount", 0)

    return {
        "id":           make_id(tweet_id),
        "source":       f"X @{username}",
        "source_url":   "https://x.com/search",
        "title":        text[:80].replace("\n", " "),
        "url":          url,
        "published_at": to_utc_iso(created_at),
        "summary":      text[:SUMMARY_MAX_CHARS],
        "tags":         extract_tags(text),
        "fetch_at":     now_utc,
        # X 专属字段：seed.ts 忽略，scorer.ts 可用于互动维度评分
        "_x": {
            "tweet_id":  tweet_id,
            "username":  username,
            "likes":     likes,
            "retweets":  retweets,
            "replies":   replies,
            "views":     views,
            "bookmarks": bookmarks,
        },
    }


# ──────────────────────────────────────────────
# twitterapi.io 调用
# ──────────────────────────────────────────────
def fetch_tweets(
    api_key: str,
    query: str,
    max_items: int,
) -> list[dict]:
    headers = {"X-API-Key": api_key}
    results: dict[str, dict] = {}  # url → item，自动去重
    cursor = None
    page = 0

    print(f"\n🔍 查询：{query}")
    print(f"📦 目标条数：{max_items}")
    print(f"{'─'*40}")

    while len(results) < max_items:
        params: dict = {
            "query":     query,
            "queryType": "Top",   # 热度优先，质量更高
        }
        if cursor:
            params["cursor"] = cursor

        try:
            resp = requests.get(
                f"{API_BASE}/twitter/tweet/advanced_search",
                headers=headers,
                params=params,
                timeout=15,
            )
        except requests.RequestException as e:
            print(f"❌ 网络错误：{e}")
            break

        if resp.status_code == 401:
            print("❌ API Key 无效，请检查 .env 中的 TWITTERAPI_KEY")
            sys.exit(1)
        if resp.status_code == 402:
            print("⚠️  余额不足，请前往 twitterapi.io 充值")
            break
        if resp.status_code == 429:
            print("⚠️  请求频率超限，稍后重试")
            break
        if not resp.ok:
            print(f"❌ API 错误 {resp.status_code}: {resp.text[:200]}")
            break

        data = resp.json()
        tweets = data.get("tweets", [])

        if not tweets:
            print("  ℹ️  没有更多数据")
            break

        page += 1
        valid = 0
        for raw in tweets:
            item = normalize_tweet(raw)
            if item and item["url"] not in results:
                results[item["url"]] = item
                valid += 1

        print(f"  第{page}页：{len(tweets)} 条原始 → {valid} 条有效，累计 {len(results)} 条")

        # 分页
        cursor = data.get("next_cursor") or data.get("cursor")
        if not cursor:
            break

    print(f"{'─'*40}")
    print(f"✅ 最终有效条数：{len(results)} 条\n")

    # 按发布时间降序排列
    return sorted(
        results.values(),
        key=lambda x: x.get("published_at") or "",
        reverse=True,
    )


# ──────────────────────────────────────────────
# 合并到已有 JSON（去重）
# ──────────────────────────────────────────────
def merge_into(existing_path: Path, new_items: list[dict]) -> tuple[list[dict], int]:
    existing = []
    if existing_path.exists():
        try:
            existing = json.loads(existing_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    url_map = {item["url"]: item for item in existing}
    added = 0
    for item in new_items:
        if item["url"] not in url_map:
            url_map[item["url"]] = item
            added += 1

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
    parser = argparse.ArgumentParser(description="FOMORader X Fetcher (twitterapi.io)")
    parser.add_argument("--max",        type=int, default=DEFAULT_MAX_ITEMS,    help=f"最多获取条数（默认{DEFAULT_MAX_ITEMS}）")
    parser.add_argument("--min-faves",  type=int, default=DEFAULT_MIN_FAVES,    help=f"最低点赞数（默认{DEFAULT_MIN_FAVES}）")
    parser.add_argument("--min-rt",     type=int, default=DEFAULT_MIN_RETWEETS, help=f"最低转推数（默认{DEFAULT_MIN_RETWEETS}）")
    parser.add_argument("--out",        type=str, default="data/hotspots_raw.json")
    parser.add_argument("--dry-run",    action="store_true", help="只打印前3条，不写文件")
    args = parser.parse_args()

    api_key = os.getenv("TWITTERAPI_KEY", "").strip()
    if not api_key:
        print("❌ 未找到 TWITTERAPI_KEY")
        print("   请在 .env 中添加：TWITTERAPI_KEY=你的key")
        print("   获取地址：https://twitterapi.io → Dashboard → API Keys")
        sys.exit(1)

    query = build_query(args.min_faves, args.min_rt)
    items = fetch_tweets(api_key, query, args.max)

    if not items:
        print("⚠️  没有获取到任何有效数据，请检查查询条件或账户余额")
        return

    if args.dry_run:
        print(json.dumps(items[:3], ensure_ascii=False, indent=2))
        print(f"\n（dry-run，共 {len(items)} 条，未写入文件）")
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged, added = merge_into(out_path, items)

    out_path.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    size_kb = out_path.stat().st_size // 1024
    print(f"🔀 合并完成：新增 {added} 条，总计 {len(merged)} 条")
    print(f"✅ 已写入 → {out_path}  ({size_kb} KB)")


if __name__ == "__main__":
    main()
