"""
X-Collector Entry Point
"""
import argparse
import json
import sys
from pathlib import Path

# Fix import path to allow running from root or x-collector dir
sys.path.append(str(Path(__file__).parent))

from config import build_query, OUTPUT_FILE, DEFAULT_MAX_ITEMS, DEFAULT_MIN_FAVES, DEFAULT_MIN_RETWEETS
from collector import fetch_tweets
from filter import normalize_tweet

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

def main():
    parser = argparse.ArgumentParser(description="FOMORader X Collector (twitterapi.io)")
    parser.add_argument("--max",       type=int, default=DEFAULT_MAX_ITEMS,    help="Max items to fetch")
    parser.add_argument("--min-faves", type=int, default=DEFAULT_MIN_FAVES,    help="Min favorites filter")
    parser.add_argument("--min-rt",    type=int, default=DEFAULT_MIN_RETWEETS, help="Min retweets filter")
    parser.add_argument("--out",       type=str, default=OUTPUT_FILE,          help="Output JSON path")
    parser.add_argument("--dry-run",   action="store_true",                    help="Print only, do not write")
    args = parser.parse_args()

    # 1. Build Query
    query = build_query(args.min_faves, args.min_rt)

    # 2. Fetch Raw Data
    raw_tweets = fetch_tweets(query, args.max)

    if not raw_tweets:
        print("⚠️  No data fetched.")
        return

    # 3. Process & Normalize
    processed_items = []
    for raw in raw_tweets:
        item = normalize_tweet(raw)
        if item:
            processed_items.append(item)
            
    print(f"✅ Processed: {len(raw_tweets)} raw -> {len(processed_items)} valid items")

    if args.dry_run:
        print(json.dumps(processed_items[:3], ensure_ascii=False, indent=2))
        return

    # 4. Save
    project_root = Path(__file__).resolve().parents[2]
    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = (project_root / out_path).resolve()
         
    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged, added = merge_into(out_path, processed_items)

    out_path.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"💾 Saved to {out_path}")
    print(f"   Added {added} new items. Total: {len(merged)}")

if __name__ == "__main__":
    main()
