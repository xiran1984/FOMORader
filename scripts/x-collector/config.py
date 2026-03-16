"""
x-collector Configuration (twitterapi.io)
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Configuration
API_BASE = "https://api.twitterapi.io"
API_KEY = os.getenv("TWITTERAPI_KEY", "").strip()
X_PROXY = os.getenv("X_PROXY", "").strip()

# Quality Filter Defaults
DEFAULT_MIN_FAVES = 3      # Minimum likes to reduce low-quality noise
DEFAULT_MIN_RETWEETS = 0   # No minimum retweets
DEFAULT_MAX_ITEMS = 100     # Max items per run

# Output Configuration
SUMMARY_MAX_CHARS = 1000
OUTPUT_FILE = "data/hotspots_x.json"

# User Blacklist (Lowercase handles, without @)
BLACKLIST_USERS = [
    "grok",
]

def build_query(min_faves: int = DEFAULT_MIN_FAVES, min_retweets: int = DEFAULT_MIN_RETWEETS, since_date: str | None = None) -> str:
    """Build advanced search query for high-quality AI tweets."""
    keywords_str = "AI OR 人工智能 OR 大模型 OR OpenAI OR Claude OR Gemini OR DeepSeek"

    # Build query parts
    query_parts = [
        f"({keywords_str})",
        "lang:zh",
        "-is:retweet"
    ]

    if since_date:
        query_parts.append(f"since:{since_date}")

    # Add user blacklist to query
    if BLACKLIST_USERS:
        blacklist_str = " ".join([f"-from:{user}" for user in BLACKLIST_USERS])
        query_parts.append(blacklist_str)

    # Add engagement filters if set (optional, currently we want early signals)
    if min_faves > 0:
        query_parts.append(f"min_faves:{min_faves}")
    if min_retweets > 0:
        query_parts.append(f"min_retweets:{min_retweets}")

    return " ".join(query_parts)
