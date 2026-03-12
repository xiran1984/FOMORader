import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dedupeHotspot, scoreHotspot, type Hotspot, type ScoreResult } from './llm.js';

type CachedValue = ScoreResult & {
  total_score: number;
  model_version: string;
  rules_version: string;
  scored_at: string;
};

type ScoreRow = {
  platform_score: number;
  creator_score: number;
  content_score: number;
  originality: number;
  accuracy: number;
  depth: number;
  engagement: number;
  neutrality: number;
  total_score: number;
  summary_zh: string;
  title_zh?: string;
  trend_signal: string;
  scored_at: string;
  model_version: string;
  author?: string;
  author_url?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'fomorader.db');
const DEFAULT_MODEL_VERSION = process.env.SILICONFLOW_MODEL?.trim() || 'Qwen/Qwen2.5-32B-Instruct';
const DEFAULT_PLATFORM_SCORE = Number(process.env.FOMORADER_PLATFORM_SCORE || 1);

function getPlatformScore(): number {
  return clamp10(DEFAULT_PLATFORM_SCORE);
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp10(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

function computeTotal(platform: number, creator: number, content: number): number {
  const total = 0.15 * platform + 0.15 * creator + 0.7 * content;
  return Math.max(0, Math.min(10, Number(total.toFixed(3))));
}

function parseRulesVersion(rulesPath: string): string {
  const raw = fs.readFileSync(rulesPath, 'utf-8');
  const m = raw.match(/v(\d+(?:\.\d+)+)/i);
  return m ? `v${m[1]}` : 'v0';
}

function normalizeForSimilarity(s: string): string[] {
  const text = (s || '').toLowerCase().replace(/https?:\/\/\S+/g, ' ');
  const tokens: string[] = [];

  const latinWords = text.match(/[\p{Script=Latin}\p{N}]{2,}/gu) || [];
  for (const w of latinWords) tokens.push(w);

  const hanChars = (text.match(/[\p{Script=Han}]/gu) || []).join('');
  if (hanChars.length > 0) {
    for (let i = 0; i < hanChars.length - 1; i += 1) {
      tokens.push(hanChars.slice(i, i + 2));
    }
    for (const c of hanChars) tokens.push(c);
  }

  const uniq = new Set(tokens.filter(Boolean));
  return Array.from(uniq);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  if (union === 0) return 0;
  return inter / union;
}

function overlapCoefficient(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const denom = Math.min(setA.size, setB.size);
  if (denom === 0) return 0;
  return inter / denom;
}

function similarity(a: string[], b: string[]): number {
  return Math.max(jaccard(a, b), overlapCoefficient(a, b));
}

function buildCacheKey(url: string, modelVersion: string, rulesVersion: string): string {
  return `${url}:${modelVersion}:${rulesVersion}`;
}

function ensureScoresSchema(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(scores)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const addColumn = (name: string, type: string) => {
    if (!names.has(name)) db.exec(`ALTER TABLE scores ADD COLUMN ${name} ${type}`);
  };
  addColumn('platform_score', 'REAL');
  addColumn('creator_score', 'REAL');
  addColumn('content_score', 'REAL');
  addColumn('author', 'TEXT');
  addColumn('author_url', 'TEXT');
  addColumn('summary_zh', 'TEXT');
  addColumn('title_zh', 'TEXT');
  addColumn('trend_signal', 'TEXT');
  addColumn('scored_at', 'TEXT');
}

function readCache(db: Database.Database, key: string): CachedValue | null {
  const row = db.prepare(`SELECT value FROM cache WHERE key = ?`).get(key) as { value: string } | undefined;
  if (!row?.value) return null;
  try {
    const obj = JSON.parse(row.value);
    return obj as CachedValue;
  } catch {
    return null;
  }
}

function writeCache(db: Database.Database, key: string, value: CachedValue): void {
  db.prepare(`INSERT INTO cache (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(
    key,
    JSON.stringify(value)
  );
}

function hasScore(db: Database.Database, hotspotId: string, modelVersion: string): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM scores WHERE hotspot_id = ? AND model_version = ? LIMIT 1`)
    .get(hotspotId, modelVersion) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

function insertScore(db: Database.Database, hotspotId: string, modelVersion: string, score: CachedValue): void {
  db.prepare(
    `INSERT INTO scores (hotspot_id, model_version, platform_score, creator_score, content_score, originality, accuracy, depth, engagement, neutrality, total_score, summary_zh, title_zh, trend_signal, scored_at, author, author_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    hotspotId,
    modelVersion,
    score.platform_score,
    score.creator_score,
    score.content_score,
    score.originality,
    score.accuracy,
    score.depth,
    score.engagement,
    score.neutrality,
    score.total_score,
    score.summary_zh,
    score.title_zh || null,
    score.trend_signal,
    score.scored_at,
    score.author || null,
    score.author_url || null
  );
}

function getScoreByUrl(db: Database.Database, url: string, modelVersion: string): ScoreRow | null {
  const row = db
    .prepare(
      `SELECT s.platform_score, s.creator_score, s.content_score, s.originality, s.accuracy, s.depth, s.engagement, s.neutrality, s.total_score, s.summary_zh, s.title_zh, s.trend_signal, s.scored_at, s.model_version, s.author, s.author_url
       FROM hotspots h
       JOIN scores s ON s.hotspot_id = h.id
       WHERE h.url = ? AND s.model_version = ?
       ORDER BY datetime(s.scored_at) DESC
       LIMIT 1`
    )
    .get(url, modelVersion) as ScoreRow | undefined;
  return row || null;
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
    } else {
      args.set(key, next);
      i += 1;
    }
  }
  const dbPath = (args.get('db') as string) || DEFAULT_DB_PATH;
  const limit = Number(args.get('limit') || 50);
  const dryRun = Boolean(args.get('dry-run'));
  const modelVersion = ((args.get('model') as string) || DEFAULT_MODEL_VERSION).trim();
  const rulesPath = ((args.get('rules') as string) || path.join(PROJECT_ROOT, 'RULES.md')).trim();
  const minSimilarity = clamp01(Number(args.get('min-similarity') || 0.45));
  const dedupeRaw = args.get('dedupe');
  const dedupe = dedupeRaw === false || dedupeRaw === 'false' || dedupeRaw === '0' ? false : true;
  return { dbPath, limit: Number.isFinite(limit) ? limit : 50, dryRun, modelVersion, rulesPath, minSimilarity, dedupe };
}

async function scoreOne(
  db: Database.Database,
  hotspot: Hotspot,
  modelVersion: string,
  rulesVersion: string,
  minSimilarity: number,
  useDedupe: boolean,
  dryRun: boolean
): Promise<'cached' | 'copied' | 'scored'> {
  const cacheKey = buildCacheKey(hotspot.url, modelVersion, rulesVersion);
  const cached = readCache(db, cacheKey);
  if (cached) {
    if (!hasScore(db, hotspot.id, modelVersion) && !dryRun) insertScore(db, hotspot.id, modelVersion, cached);
    return 'cached';
  }

  if (useDedupe) {
    const recent = db
      .prepare(
        `SELECT h.url, h.title, h.summary, h.published_at
         FROM hotspots h
         JOIN scores s ON s.hotspot_id = h.id
         WHERE s.model_version = ?
         ORDER BY datetime(h.published_at) DESC
         LIMIT 200`
      )
      .all(modelVersion) as { url: string; title: string; summary: string; published_at: string | null }[];

    const targetText = (hotspot.title || hotspot.summary || '').slice(0, 200);
    const targetTokens = normalizeForSimilarity(targetText);
    const scored = recent
      .map((c) => {
        const candidateText = (c.title || c.summary || '').slice(0, 200);
        const sim = similarity(targetTokens, normalizeForSimilarity(candidateText));
        return { ...c, sim };
      })
      .filter((c) => c.sim >= minSimilarity)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5)
      .map(({ sim, ...rest }) => rest);

    if (scored.length > 0 && !dryRun) {
      const decision = await dedupeHotspot(hotspot, scored);
      if (decision.duplicate_of_url) {
        const baseKey = buildCacheKey(decision.duplicate_of_url, modelVersion, rulesVersion);
        const baseCached = readCache(db, baseKey);
        if (baseCached) {
          const copied: CachedValue = { ...baseCached, scored_at: nowIso(), duplicate_of_url: decision.duplicate_of_url };
          writeCache(db, cacheKey, copied);
          insertScore(db, hotspot.id, modelVersion, copied);
          return 'copied';
        }

        const base = getScoreByUrl(db, decision.duplicate_of_url, modelVersion);
        if (base) {
          const copied: CachedValue = {
      platform_score: clamp10(base.platform_score) || getPlatformScore(),
      creator_score: clamp10(base.creator_score) || 1,
      content_score: clamp10(base.content_score) || clamp10(base.total_score),
      originality: clamp10(base.originality),
      accuracy: clamp10(base.accuracy),
      depth: clamp10(base.depth),
      engagement: clamp10(base.engagement),
      neutrality: clamp10(base.neutrality),
      summary_zh: String(base.summary_zh || '').slice(0, 200),
      title_zh: String(base.title_zh || '').slice(0, 100),
      trend_signal:
        base.trend_signal === 'rising' || base.trend_signal === 'fading' ? (base.trend_signal as any) : 'stable',
      total_score: clamp10(base.total_score),
      model_version: modelVersion,
      rules_version: rulesVersion,
      scored_at: nowIso(),
      duplicate_of_url: decision.duplicate_of_url,
      author: base.author,
      author_url: base.author_url,
    };
          writeCache(db, cacheKey, copied);
          insertScore(db, hotspot.id, modelVersion, copied);
          return 'copied';
        }
      }
    }
  }

  if (dryRun) return 'scored';

  const llmScore = await scoreHotspot(hotspot, rulesVersion);
  const platform = getPlatformScore();
  const creator = clamp10(llmScore.creator_score);
  const content = clamp10(llmScore.content_score);
  const total = computeTotal(platform, creator, content);

  const finalScore: CachedValue = {
    ...llmScore,
    platform_score: platform,
    creator_score: creator,
    content_score: content,
    total_score: total,
    model_version: modelVersion,
    rules_version: rulesVersion,
    scored_at: nowIso(),
  };

  writeCache(db, cacheKey, finalScore);
  insertScore(db, hotspot.id, modelVersion, finalScore);
  return 'scored';
}

async function main() {
  const { dbPath, limit, dryRun, modelVersion, rulesPath, minSimilarity, dedupe } = parseArgs(process.argv);
  const rulesVersion = parseRulesVersion(rulesPath);
  const db = new Database(dbPath);
  ensureScoresSchema(db);
  const rows = db
    .prepare(
      `SELECT h.id, h.source, h.source_url, h.title, h.url, h.published_at, h.summary, h.tags, h.fetch_at
       FROM hotspots h
       LEFT JOIN scores s
         ON s.hotspot_id = h.id AND s.model_version = ?
       WHERE s.id IS NULL
       ORDER BY datetime(h.published_at) DESC
       LIMIT ?`
    )
    .all(modelVersion, limit) as {
    id: string;
    source: string;
    source_url: string;
    title: string;
    url: string;
    published_at: string | null;
    summary: string;
    tags: string;
    fetch_at: string;
  }[];

  const hotspots: Hotspot[] = rows.map((r) => ({
    id: r.id,
    source: r.source || '',
    source_url: r.source_url || '',
    title: r.title || '',
    url: r.url || '',
    published_at: r.published_at || null,
    summary: r.summary || '',
    tags: (() => {
      try {
        return JSON.parse(r.tags || '[]');
      } catch {
        return [];
      }
    })(),
    fetch_at: r.fetch_at || nowIso(),
  }));

  if (hotspots.length === 0) {
    console.log('No unscored hotspots for model:', modelVersion);
    db.close();
    return;
  }

  console.log('DB:', dbPath);
  console.log('Model:', modelVersion);
  console.log('RULES:', rulesVersion);
  console.log('Targets:', hotspots.length, 'DryRun:', dryRun);

  const stats = { cached: 0, copied: 0, scored: 0, failed: 0 };
  const run = db.transaction(() => {});
  run();

  // Concurrency control
  const CONCURRENCY_LIMIT = 5;
  const activePromises: Promise<void>[] = [];

  for (const h of hotspots) {
    // If we've reached the limit, wait for one to finish
    if (activePromises.length >= CONCURRENCY_LIMIT) {
      await Promise.race(activePromises);
    }

    const p = (async () => {
      try {
        const res = await scoreOne(db, h, modelVersion, rulesVersion, minSimilarity, dedupe, dryRun);
        stats[res] += 1;
        console.log(res, h.source, h.title.slice(0, 60));
      } catch (e: any) {
        stats.failed += 1;
        console.error('failed', h.url, e?.message || String(e));
      }
    })();
    
    // Add cleanup callback
    const pWithCleanup = p.then(() => {
      const idx = activePromises.indexOf(pWithCleanup);
      if (idx > -1) activePromises.splice(idx, 1);
    });

    activePromises.push(pWithCleanup);
  }

  // Wait for remaining
  await Promise.all(activePromises);

  const totalScores = db.prepare(`SELECT COUNT(1) AS c FROM scores`).get() as { c: number };
  console.log('Done. scores rows:', totalScores.c, 'stats:', stats);
  db.close();
}

main();
