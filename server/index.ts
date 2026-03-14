import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Database from 'better-sqlite3';
import { initScheduler, rescheduleDailyTask, getScheduleConfig, runDailyTask, taskStatus } from './scheduler.ts';

const app = new Hono();

// Start the scheduler
initScheduler();

// Enable CORS
app.use('/*', cors());

// Use existing database or create new one if not exists
const db = new Database('data/fomorader.db'); 

app.get('/api/config/schedule', (c) => {
  return c.json(getScheduleConfig());
});

app.post('/api/config/schedule', async (c) => {
  try {
    const body = await c.req.json();
    const { time } = body; // Expect "HH:mm" format (24h)
    
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return c.json({ error: 'Invalid time format. Use HH:mm' }, 400);
    }

    const { limit } = body;
    if (limit && (limit < 5 || limit > 30)) {
        return c.json({ error: 'Limit must be between 5 and 30' }, 400);
    }
    
    // Update env var in memory for the scheduler process
    if (limit) {
        process.env.PUSH_LIMIT = String(limit);
    }

    const [hour, minute] = time.split(':');
    // Cron format: second minute hour day month day-of-week
    const cron = `0 ${Number(minute)} ${Number(hour)} * * *`;
    
    rescheduleDailyTask(cron);
    
    return c.json({ success: true, cron });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Get task status
app.get('/api/status', (c) => {
  return c.json(taskStatus);
});

// Trigger daily update (async)
app.post('/api/trigger/daily', async (c) => {
  if (taskStatus.state === 'running') {
    return c.json({ success: false, message: 'Task already running' });
  }
  
  // Fire and forget (but update state immediately inside the function)
  runDailyTask(); 
  
  return c.json({ success: true, message: 'Daily task started' });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: 'Fomorader API is running' });
});

app.get('/api/hotspots', (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 50;
    
    // Fetch hotspots with their latest score (if any)
    // Union Strategy:
    // 1. Get latest N items (time-based feed)
    // 2. Get ALL items with score >= 7.0 (high-score vault)
    // 3. Combine and deduplicate
    const query = `
      WITH RankedScores AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY hotspot_id ORDER BY scored_at DESC) as rn
        FROM scores
      ),
      LatestFeed AS (
        SELECT h.id
        FROM hotspots h
        ORDER BY datetime(h.published_at) DESC
        LIMIT ?
      ),
      HighScores AS (
        SELECT h.id
        FROM hotspots h
        JOIN RankedScores s ON h.id = s.hotspot_id AND s.rn = 1
        WHERE s.total_score >= 7.0 OR h.is_favorite = 1
      )
      SELECT 
        h.id, h.title, h.url, h.summary, h.published_at, h.source, h.is_favorite,
        s.total_score, s.platform_score, s.creator_score, s.content_score,
        s.originality, s.accuracy, s.depth, s.engagement, s.neutrality, s.trend_signal,
        s.author, s.author_url, s.title_zh, s.summary_zh
      FROM hotspots h
      LEFT JOIN RankedScores s ON h.id = s.hotspot_id AND s.rn = 1
      WHERE h.id IN (SELECT id FROM LatestFeed UNION SELECT id FROM HighScores)
      ORDER BY datetime(h.published_at) DESC
    `;
    
    const stmt = db.prepare(query);
    const hotspots = stmt.all(limit).map((h: any) => ({
        ...h,
        is_favorite: Boolean(h.is_favorite) // Convert 0/1 to boolean
    }));
    
    return c.json({ hotspots });
  } catch (e) {
    console.error(e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post('/api/hotspots/:id/favorite', (c) => {
  try {
    const id = c.req.param('id');
    // Toggle favorite status
    const result = db.prepare(`
      UPDATE hotspots 
      SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END 
      WHERE id = ?
      RETURNING is_favorite
    `).get(id) as { is_favorite: number } | undefined;

    if (!result) {
      return c.json({ error: 'Hotspot not found' }, 404);
    }

    return c.json({ 
      success: true, 
      id, 
      is_favorite: Boolean(result.is_favorite) 
    });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.get('/api/stats', (c) => {
  try {
    const stmt = db.prepare('SELECT count(*) as count FROM hotspots');
    const result = stmt.get();
    return c.json({ stats: result });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
