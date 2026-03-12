"""
x-collector Configuration (twitterapi.io)
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Configuration
API_BASE = "https://api.twitterapi.io"
API_KEY = os.getenv("TWITTERAPI_KEY", "").strip()

# Quality Filter Defaults
DEFAULT_MIN_FAVES = 25      # Minimum likes to consider valuable
DEFAULT_MIN_RETWEETS = 10   # Minimum retweets
DEFAULT_MAX_ITEMS = 50     # Max items per run

# Output Configuration
SUMMARY_MAX_CHARS = 300
OUTPUT_FILE = "data/hotspots_raw.json"

def build_query(min_faves: int = DEFAULT_MIN_FAVES, min_retweets: int = DEFAULT_MIN_RETWEETS) -> str:
    """Build advanced search query for high-quality AI tweets."""
    return (
        "(AI OR 人工智能 OR 大模型 OR OpenAI OR Claude OR Gemini OR DeepSeek OR Grok) "
        f"lang:zh -is:retweet "
        f"min_faves:{min_faves} "
        f"min_retweets:{min_retweets}"
    )
