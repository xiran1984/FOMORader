/**
 * FOMORader · seed.ts
 * 将 data/hotspots_raw.json 导入 SQLite 数据库 data/fomorader.db。
 * 
 * 用法:
 *   npx tsx scripts/seed.ts
 *   npx tsx scripts/seed.ts --reset   (警告：清空所有表)
 *   npx tsx scripts/seed.ts --input custom_data.json
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// -----------------------------------------------------------------------------
// 配置与类型定义
// -----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'fomorader.db');
const DEFAULT_INPUT_PATH = path.join(PROJECT_ROOT, 'data', 'hotspots_raw.json');

interface HotspotRaw {
    id: string;
    source: string;
    source_url: string;
    title: string;
    url: string;
    published_at: string | null;
    summary: string;
    tags: string[];
    fetch_at: string;
    _x?: any; // 忽略
    _rss?: any; // 忽略
}

// -----------------------------------------------------------------------------
// 数据库模式定义 (Strictly following ARCHITECTURE.md)
// -----------------------------------------------------------------------------

const SCHEMA = `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- hotspots（原始热点）
    CREATE TABLE IF NOT EXISTS hotspots (
        id TEXT PRIMARY KEY,
        source TEXT,
        source_url TEXT,
        title TEXT,
        url TEXT UNIQUE,
        published_at TEXT,
        summary TEXT,
        tags TEXT, -- JSON array
        fetch_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- scores（评分结果）
    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hotspot_id TEXT,
        model_version TEXT,
        originality REAL,
        accuracy REAL,
        depth REAL,
        engagement REAL,
        neutrality REAL,
        total_score REAL,
        summary_zh TEXT,
        trend_signal TEXT,
        scored_at TEXT,
        FOREIGN KEY(hotspot_id) REFERENCES hotspots(id) ON DELETE CASCADE
    );

    -- cache（LLM 调用缓存）
    CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`;

// -----------------------------------------------------------------------------
// 主逻辑
// -----------------------------------------------------------------------------

function main() {
    const args = process.argv.slice(2);
    const resetMode = args.includes('--reset');
    const inputArgIndex = args.indexOf('--input');
    const inputPath = inputArgIndex !== -1 && args[inputArgIndex + 1] 
        ? path.resolve(process.cwd(), args[inputArgIndex + 1]) 
        : DEFAULT_INPUT_PATH;

    console.log(`🤖 Seed Script Started`);
    console.log(`   DB Path:    ${DEFAULT_DB_PATH}`);
    console.log(`   Input Path: ${inputPath}`);

    // 1. 连接数据库
    const db = new Database(DEFAULT_DB_PATH);
    
    // 2. 处理重置模式
    if (resetMode) {
        console.warn(`⚠️  WARNING: --reset flag detected. Dropping all tables...`);
        db.exec(`
            DROP TABLE IF EXISTS scores;
            DROP TABLE IF EXISTS cache;
            DROP TABLE IF EXISTS hotspots;
        `);
        console.log(`✅ Tables dropped.`);
    }

    // 3. 初始化表结构
    db.exec(SCHEMA);
    console.log(`✅ Schema initialized (WAL mode enabled).`);

    // 4. 读取数据
    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Input file not found: ${inputPath}`);
        process.exit(1);
    }

    let rawData: HotspotRaw[] = [];
    try {
        const fileContent = fs.readFileSync(inputPath, 'utf-8');
        rawData = JSON.parse(fileContent);
    } catch (err) {
        console.error(`❌ Failed to parse JSON: ${err}`);
        process.exit(1);
    }

    if (!Array.isArray(rawData)) {
        console.error(`❌ Invalid JSON structure. Expected an array.`);
        process.exit(1);
    }

    console.log(`📦 Found ${rawData.length} items to process.`);

    // 5. 批量写入 (事务)
    const insertStmt = db.prepare(`
        INSERT INTO hotspots (id, source, source_url, title, url, published_at, summary, tags, fetch_at)
        VALUES (@id, @source, @source_url, @title, @url, @published_at, @summary, @tags, @fetch_at)
        ON CONFLICT(url) DO UPDATE SET
            source = excluded.source,
            source_url = excluded.source_url,
            title = excluded.title,
            published_at = excluded.published_at,
            summary = excluded.summary,
            tags = excluded.tags,
            fetch_at = excluded.fetch_at
    `);

    let insertedCount = 0;
    let updatedCount = 0; // Note: SQLite insert returns changes, but upsert makes it hard to distinguish strict insert vs update easily without logic. 
                          // However, we just count total processed here for simplicity or we can check changes.
    
    // 简单统计
    const stats: Record<string, number> = {};

    const transaction = db.transaction((items: HotspotRaw[]) => {
        for (const item of items) {
            // 简单校验
            if (!item.id || !item.url) {
                console.warn(`⚠️ Skipping invalid item: ${JSON.stringify(item).slice(0, 50)}...`);
                continue;
            }

            // 格式化数据
            const row = {
                id: item.id,
                source: item.source || 'Unknown',
                source_url: item.source_url || '',
                title: item.title || '',
                url: item.url,
                published_at: item.published_at || null,
                summary: item.summary || '',
                tags: JSON.stringify(item.tags || []),
                fetch_at: item.fetch_at || new Date().toISOString()
            };

            insertStmt.run(row);
            
            // 统计来源
            const sourceName = row.source.split(' ')[0] || 'Other'; // 简单提取 source 前缀
            stats[sourceName] = (stats[sourceName] || 0) + 1;
        }
    });

    try {
        transaction(rawData);
        console.log(`✅ Successfully processed ${rawData.length} items.`);
    } catch (err) {
        console.error(`❌ Transaction failed: ${err}`);
        process.exit(1);
    }

    // 6. 打印统计
    console.log(`\n📊 Source Statistics:`);
    console.table(stats);

    db.close();
    console.log(`🎉 Done.`);
}

main();