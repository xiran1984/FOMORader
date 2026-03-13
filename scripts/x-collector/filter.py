"""
Data Processing & Standardization
"""
import hashlib
import re
from datetime import datetime, timezone
from config import SUMMARY_MAX_CHARS

_TEXT_TRANSLATION_TABLE = str.maketrans({
    "\u2028": "\n",
    "\u2029": "\n",
    "\u0085": "\n",
})


def normalize_text(text: str) -> str:
    return (text or "").translate(_TEXT_TRANSLATION_TABLE)


def make_id(tweet_id: str) -> str:
    return hashlib.sha256(str(tweet_id).encode()).hexdigest()[:8]

def to_utc_iso(dt_str: str | None) -> str | None:
    if not dt_str:
        return None
    try:
        # 1. Try ISO format (e.g. 2026-03-12T20:30:00.000Z)
        if 'T' in dt_str:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        
        # 2. Try Twitter format (e.g. Thu Mar 12 23:50:31 +0000 2026)
        # Format: %a %b %d %H:%M:%S %z %Y
        dt = datetime.strptime(dt_str, "%a %b %d %H:%M:%S %z %Y")
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        # Fallback: return as-is if parsing fails
        return dt_str

def is_chinese(text: str, min_chars: int = 5) -> bool:
    """Ensure text contains at least min_chars Chinese characters."""
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
    Convert raw API response to hotspots_raw.json standard format.
    Returns None if the tweet should be filtered out.
    """
    tweet_id = str(raw.get("id") or raw.get("tweet_id") or "")
    text = normalize_text(raw.get("text") or raw.get("full_text") or "")
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

    # Hard Filter: Must contain Chinese characters
    if not is_chinese(text):
        return None

    url = f"https://x.com/{username}/status/{tweet_id}"
    now_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Interaction Metrics
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
