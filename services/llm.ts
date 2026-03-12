import 'dotenv/config';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type Hotspot = {
  id: string;
  source: string;
  source_url: string;
  title: string;
  url: string;
  published_at: string | null;
  summary: string;
  tags: string[];
  fetch_at: string;
};

export type ScoreResult = {
  platform_score: number;
  creator_score: number;
  content_score: number;
  originality: number;
  accuracy: number;
  depth: number;
  engagement: number;
  neutrality: number;
  summary_zh: string;
  title_zh?: string;
  trend_signal: 'rising' | 'stable' | 'fading';
  duplicate_of_url?: string | null;
  author?: string;
  author_url?: string;
};

export type DedupeDecision = {
  duplicate_of_url: string | null;
  confidence: number;
};

type Candidate = {
  url: string;
  title: string;
  summary: string;
  published_at: string | null;
};

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

function truncateByCodepoints(text: string, maxLen: number): string {
  const arr = Array.from(text || '');
  if (arr.length <= maxLen) return text || '';
  return arr.slice(0, maxLen).join('');
}

function getConfig(): { apiKey: string; baseURL: string; model: string; timeoutMs: number } {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
  if (!apiKey) throw new Error('Missing SILICONFLOW_API_KEY (or OPENAI_API_KEY)');
  const baseURL = (process.env.SILICONFLOW_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
  const model = process.env.SILICONFLOW_MODEL?.trim() || 'Qwen/Qwen2.5-32B-Instruct';
  const timeoutMs = Number(process.env.SILICONFLOW_TIMEOUT_MS || 60000);
  return { apiKey, baseURL, model, timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 60000 };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function createJsonChat(
  messages: ChatMessage[],
  temperature: number,
  maxRetries = 3
): Promise<any> {
  const { apiKey, baseURL, model, timeoutMs } = getConfig();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          top_p: 0.7,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(t));

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const err: any = new Error(`LLM request failed: ${resp.status} ${resp.statusText} ${text.slice(0, 300)}`);
        err.status = resp.status;
        throw err;
      }

      const data = (await resp.json()) as any;
      const content = data?.choices?.[0]?.message?.content || '';
      return JSON.parse(content);
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.response?.status;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (!retryable || attempt === maxRetries) throw e;
      const backoffMs = 500 * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}

export async function dedupeHotspot(hotspot: Hotspot, candidates: Candidate[]): Promise<DedupeDecision> {
  const system = `你是一个内容去重与筛选助手。严格遵守 FOMORader RULES 权重打分。你只输出 JSON。不要输出任何思考过程或多余文本。`;
  const user = JSON.stringify(
    {
      task: 'dedupe',
      instruction:
        '判断 target 是否与 candidates 中任意一条属于同一事件/同一新闻（信息核心一致）。如果语义高度重合，返回 duplicate_of_url 为最匹配的候选 url；如果不重合或只是相关，返回 null。confidence 取 0-1。请严格去重，避免同一新闻重复出现。',
      target: {
        url: hotspot.url,
        title: hotspot.title,
        summary: hotspot.summary,
        published_at: hotspot.published_at,
        source: hotspot.source,
      },
      candidates,
      output_schema: {
        duplicate_of_url: 'string|null',
        confidence: 'number(0-1)',
      },
    },
    null,
    2
  );
  const obj = await createJsonChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    0.2
  );
  const duplicate_of_url = typeof obj?.duplicate_of_url === 'string' ? obj.duplicate_of_url : null;
  const confidenceRaw = typeof obj?.confidence === 'number' ? obj.confidence : Number(obj?.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
  return { duplicate_of_url, confidence };
}

export async function scoreHotspot(hotspot: Hotspot, rulesVersion: string): Promise<ScoreResult> {
  const system = `你是一个信息质量评分引擎。严格遵守 FOMORader RULES 权重打分。你只输出 JSON。不要输出任何思考过程或多余文本。`;
  const user = JSON.stringify(
    {
      task: 'score',
      rules_version: rulesVersion,
      weights: { platform: 0.15, creator: 0.15, content: 0.7 },
      constraints: {
        summary_zh_max_chars: 200,
        score_range: '0-10',
        score_precision: 0.1,
        avoid_integers: true,
        instruction:
          '为提升区分度，请尽量使用一位小数（如 6.2/6.8/7.1），除非信息非常极端才用整数。不同维度之间要能拉开差异。',
      },
      hotspot: {
        url: hotspot.url,
        title: hotspot.title,
        summary: hotspot.summary,
        published_at: hotspot.published_at,
        source: hotspot.source,
      },
      rubric: {
        platform_score: '平台可信度/信息源质量（按 RULES.md 的口径给分）',
        creator_score: '作者/机构权威性与历史可信度',
        content_score: '内容信息密度与价值，综合 originality/accuracy/depth/timeliness',
        originality: '是否原创、是否搬运/转述',
        accuracy: '可验证性、事实可靠性',
        depth: '是否有分析/数据/方法细节',
        engagement: '受关注程度（若无法判断，给中性分）',
        neutrality: '表述是否客观克制（情绪化/营销化要扣分）',
        trend_signal: 'rising/stable/fading 基于时效性与潜在增长',
      },
      output_schema: {
        platform_score: 'number',
        creator_score: 'number',
        content_score: 'number',
        originality: 'number',
        accuracy: 'number',
        depth: 'number',
        engagement: 'number',
        neutrality: 'number',
        summary_zh: 'string',
        title_zh: 'string',
        trend_signal: 'rising|stable|fading',
        author: 'string(optional, X handle without @ or author name)',
        author_url: 'string(optional, author homepage url)',
      },
    },
    null,
    2
  );

  const obj = await createJsonChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    0.2
  );

  const result: ScoreResult = {
    platform_score: clampScore(obj?.platform_score),
    creator_score: clampScore(obj?.creator_score),
    content_score: clampScore(obj?.content_score),
    originality: clampScore(obj?.originality),
    accuracy: clampScore(obj?.accuracy),
    depth: clampScore(obj?.depth),
    engagement: clampScore(obj?.engagement),
    neutrality: clampScore(obj?.neutrality),
    summary_zh: truncateByCodepoints(String(obj?.summary_zh || ''), 200),
    title_zh: obj?.title_zh ? truncateByCodepoints(String(obj.title_zh), 100) : undefined,
    trend_signal: obj?.trend_signal === 'rising' || obj?.trend_signal === 'fading' ? obj.trend_signal : 'stable',
    author: obj?.author || '',
    author_url: obj?.author_url || '',
  };
  return result;
}
