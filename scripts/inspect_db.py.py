import sqlite3
import json

DB_PATH = "data/fomorader.db"

def inspect():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. 统计总数
    cursor.execute("SELECT count(*) FROM hotspots")
    total = cursor.fetchone()[0]
    print(f"📊 Total Records: {total}")
    
    # 2. 预览前 3 条 (仅打印关键字段)
    print("\n🔍 Preview (First 3):")
    cursor.execute("SELECT id, source, title, published_at FROM hotspots LIMIT 3")
    rows = cursor.fetchall()
    
    for row in rows:
        print(f" - [{row[0]}] {row[1]}: {row[2][:50]}... ({row[3]})")
        
    conn.close()

if __name__ == "__main__":
    inspect()