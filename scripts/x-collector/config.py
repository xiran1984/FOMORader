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
DEFAULT_MIN_FAVES = 0      # No minimum likes
DEFAULT_MIN_RETWEETS = 0   # No minimum retweets
DEFAULT_MAX_ITEMS = 100     # Max items per run

# Output Configuration
SUMMARY_MAX_CHARS = 300
OUTPUT_FILE = "data/hotspots_x.json"

def build_query(min_faves: int = DEFAULT_MIN_FAVES, min_retweets: int = DEFAULT_MIN_RETWEETS, since_date: str | None = None) -> str:
    """Build advanced search query for high-quality AI tweets."""
    query = (
        "(AI OR 人工智能 OR 大模型 OR OpenAI OR Claude OR Gemini OR DeepSeek OR Grok) "
        f"lang:zh -is:retweet"
    )
    
    # Only append if > 0 to keep query clean
    if min_faves > 0:
        query += f" min_faves:{min_faves}"
    if min_retweets > 0:
        query += f" min_retweets:{min_retweets}"
        
    if since_date:
        query += f" since:{since_date}"
    return query
