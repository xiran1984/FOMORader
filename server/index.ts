import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Database from 'better-sqlite3';

const app = new Hono();

// Enable CORS
app.use('/*', cors());

// Use existing database or create new one if not exists
const db = new Database('data/fomorader.db'); 

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: 'Fomorader API is running' });
});

app.get('/api/hotspots', (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 50;
    
    // Fetch hotspots with their latest score (if any)
    // We group by hotspot_id to avoid duplicates from multiple scores
    // And we pick the score with the most recent scored_at
    const query = `
      SELECT 
        h.id, h.title, h.url, h.summary, h.published_at, h.source,
        s.total_score, s.platform_score, s.creator_score, s.content_score,
        s.originality, s.accuracy, s.depth, s.engagement, s.neutrality, s.trend_signal,
        s.author, s.author_url, s.title_zh, s.summary_zh
      FROM hotspots h
      LEFT JOIN scores s ON h.id = s.hotspot_id
      GROUP BY h.id
      ORDER BY h.published_at DESC
      LIMIT ?
    `;
    
    const stmt = db.prepare(query);
    const hotspots = stmt.all(limit);
    
    return c.json({ hotspots });
  } catch (e) {
    console.error(e);
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
