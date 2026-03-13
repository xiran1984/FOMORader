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
const RSS_INPUT_PATH = path.join(PROJECT_ROOT, 'data', 'hotspots_rss.json');
const X_INPUT_PATH = path.join(PROJECT_ROOT, 'data', 'hotspots_x.json');
const LEGACY_INPUT_PATH = path.join(PROJECT_ROOT, 'data', 'hotspots_raw.json'); // Backward compatibility

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
        created_at TEXT DEFAULT (datetime('now')),
        is_favorite INTEGER DEFAULT 0
    );

    -- scores（评分结果）
    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hotspot_id TEXT,
        model_version TEXT,
        platform_score REAL,
        creator_score REAL,
        content_score REAL,
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

    -- push_history（推送历史去重）
    CREATE TABLE IF NOT EXISTS push_history (
        hotspot_id TEXT PRIMARY KEY,
        pushed_at TEXT
    );
`;

// -----------------------------------------------------------------------------
// 主逻辑
// -----------------------------------------------------------------------------

function readJsonFile(filePath: string): HotspotRaw[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        let fileContent = fs.readFileSync(filePath, 'utf-8');
        fileContent = fileContent.replace(/^\uFEFF/, '');
        fileContent = fileContent.replace(/\u2028|\u2029|\u0085/g, '\n');
        const data = JSON.parse(fileContent);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn(`⚠️ Failed to parse ${path.basename(filePath)}: ${err}`);
        return [];
    }
}

function main() {
    const args = process.argv.slice(2);
    const resetMode = args.includes('--reset');

    console.log(`🤖 Seed Script Started`);
    console.log(`   DB Path:    ${DEFAULT_DB_PATH}`);

    fs.mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });

    // 1. 连接数据库
    const db = new Database(DEFAULT_DB_PATH);
    
    // 2. 处理重置模式
    if (resetMode) {
        console.warn(`⚠️  WARNING: --reset flag detected. Dropping all tables...`);
        db.exec(`
            DROP TABLE IF EXISTS scores;
            DROP TABLE IF EXISTS cache;
            DROP TABLE IF EXISTS hotspots;
            DROP TABLE IF EXISTS push_history;
        `);
        console.log(`✅ Tables dropped.`);
    }

    // 3. 初始化表结构
    db.exec(SCHEMA);
    console.log(`✅ Schema initialized (WAL mode enabled).`);

    // 4. 读取所有数据源
    const rssData = readJsonFile(RSS_INPUT_PATH);
    const xData = readJsonFile(X_INPUT_PATH);
    const legacyData = readJsonFile(LEGACY_INPUT_PATH); // Optional: keep supporting old file for now
    
    // 合并去重 (以 URL 为键)
    const combinedMap = new Map<string, HotspotRaw>();
    
    // 优先级：X > RSS > Legacy (或根据需求调整，这里假设后读取的覆盖前面的)
    // 实际上 seed.ts 的 SQL 也有 ON CONFLICT 更新，这里内存去重主要是为了日志统计
    [...legacyData, ...rssData, ...xData].forEach(item => {
        if (item.url) combinedMap.set(item.url, item);
    });
    
    const rawData = Array.from(combinedMap.values());
    console.log(`📦 Loaded: RSS(${rssData.length}) + X(${xData.length}) + Legacy(${legacyData.length}) = ${rawData.length} unique items.`);

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

    // 6. 强制保留最新的 300 条（高分保护逻辑）
    // -----------------------------------------------------------------------------
    const MAX_HOTSPOTS = 300;
    
    // 6.1 计算今日最高分（基于 created_at 或 published_at）
    // 注意：SQLite 的 datetime 比较
    const today = new Date().toISOString().split('T')[0];
    const maxScoreRow = db.prepare(`
        SELECT s.hotspot_id 
        FROM scores s
        JOIN hotspots h ON s.hotspot_id = h.id
        WHERE date(h.published_at) = ?
        ORDER BY s.total_score DESC
        LIMIT 1
    `).get(today) as { hotspot_id: string } | undefined;
    
    const dailyMaxId = maxScoreRow?.hotspot_id;

    // 6.2 执行清理
    const countResult = db.prepare(`SELECT COUNT(1) AS c FROM hotspots`).get() as { c: number };
    const currentCount = countResult.c;

    // 尝试添加 is_favorite 字段（如果不存在）
    try {
        db.prepare('ALTER TABLE hotspots ADD COLUMN is_favorite INTEGER DEFAULT 0').run();
    } catch (e) {
        // 忽略错误，说明字段已存在
    }

    if (currentCount > MAX_HOTSPOTS) {
        console.log(`🧹 Cleaning up: Database has ${currentCount} items, limit is ${MAX_HOTSPOTS}.`);
        
        // 查找需要删除的 ID
        // 规则：
        // 1. 按时间倒序排列
        // 2. 跳过前 300 条（保留）
        // 3. 剩余的候选删除名单中，排除掉：
        //    a. 分数 >= 7.0 的
        //    b. 每日最高分的 (dailyMaxId)
        //    c. 已收藏的 (is_favorite = 1)
        
        // 步骤 A: 获取所有 ID 按时间倒序
        const allHotspots = db.prepare(`
            SELECT id FROM hotspots 
            ORDER BY datetime(published_at) DESC
        `).all() as { id: string }[];

        // 步骤 B: 确定保留名单
        const keepIds = new Set<string>();
        
        // B.1: 前 300 条无条件保留
        for (let i = 0; i < Math.min(allHotspots.length, MAX_HOTSPOTS); i++) {
            keepIds.add(allHotspots[i].id);
        }

        // B.2: 每日最高分保留
        if (dailyMaxId) {
            keepIds.add(dailyMaxId);
        }

        // B.3: 高分保留 (>= 7.0)
        const highScorers = db.prepare(`
            SELECT hotspot_id FROM scores WHERE total_score >= 7.0
        `).all() as { hotspot_id: string }[];
        
        for (const s of highScorers) {
            keepIds.add(s.hotspot_id);
        }

        // B.4: 收藏保留 (is_favorite = 1)
        const favorites = db.prepare(`
            SELECT id FROM hotspots WHERE is_favorite = 1
        `).all() as { id: string }[];
        
        for (const f of favorites) {
            keepIds.add(f.id);
        }

        // 步骤 C: 执行删除
        // 只有不在 keepIds 里的才删除
        const deleteStmt = db.prepare(`DELETE FROM hotspots WHERE id = ?`);
        
        // 需要删除的列表
        const toDeleteIds: string[] = [];
        for (const h of allHotspots) {
            if (!keepIds.has(h.id)) {
                toDeleteIds.push(h.id);
            }
        }
        
        let deleted = 0;
        const delTx = db.transaction((ids: string[]) => {
            for (const id of ids) {
                deleteStmt.run(id);
                deleted++;
            }
        });
        
        delTx(toDeleteIds);
        console.log(`🗑️ Deleted ${deleted} old hotspots (Protected high scores & daily max).`);
    }

    const totalHotspots = db.prepare(`SELECT COUNT(1) AS c FROM hotspots`).get() as { c: number };
    console.log(`📌 DB hotspots count: ${totalHotspots.c}`);

    // 7. 打印统计
    console.log(`\n📊 Source Statistics:`);
    console.table(stats);

    db.close();
    console.log(`🎉 Done.`);
}

main();
