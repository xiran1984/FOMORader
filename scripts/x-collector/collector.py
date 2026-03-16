"""
Twitter API Interaction Module
"""
import sys
import requests
from config import API_BASE, API_KEY, X_PROXY

def resolve_proxies():
    if X_PROXY:
        return {"http": X_PROXY, "https": X_PROXY}
    return None

def fetch_tweets(query: str, max_items: int) -> list[dict]:
    """
    Fetch tweets from twitterapi.io using advanced search.
    Returns raw tweet objects.
    """
    if not API_KEY:
        print("❌ Error: TWITTERAPI_KEY not found in .env")
        sys.exit(1)

    headers = {"X-API-Key": API_KEY}
    results: dict[str, dict] = {}  # id -> raw_tweet (deduplication)
    cursor = None
    page = 0

    print(f"\n🔍 Query: {query}")
    print(f"📦 Target: {max_items} items")
    print(f"{'─'*40}")

    proxies = resolve_proxies()
    while len(results) < max_items:
        params = {
            "query": query,
            "queryType": "Top",  # Prioritize popular tweets
        }
        if cursor:
            params["cursor"] = cursor

        try:
            resp = requests.get(
                f"{API_BASE}/twitter/tweet/advanced_search",
                headers=headers,
                params=params,
                timeout=15,
                proxies=proxies,
            )
        except requests.RequestException as e:
            print(f"❌ Network Error: {e}")
            break

        if resp.status_code == 401:
            print("❌ Invalid API Key.")
            sys.exit(1)
        if resp.status_code == 402:
            print("⚠️  Insufficient Balance (twitterapi.io).")
            break
        if resp.status_code == 429:
            print("⚠️  Rate Limited.")
            break
        if not resp.ok:
            print(f"❌ API Error {resp.status_code}: {resp.text[:100]}")
            break

        data = resp.json()
        tweets = data.get("tweets", [])

        if not tweets:
            print("  ℹ️  No more data.")
            break

        page += 1
        new_count = 0
        for tweet in tweets:
            tid = tweet.get("id") or tweet.get("tweet_id")
            if tid and tid not in results:
                results[tid] = tweet
                new_count += 1

        print(f"  Page {page}: Fetched {len(tweets)}, New {new_count}, Total Unique {len(results)}")

        cursor = data.get("next_cursor") or data.get("cursor")
        if not cursor:
            break

    return list(results.values())
