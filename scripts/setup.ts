import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const envPath = path.join(PROJECT_ROOT, '.env');

function parseEnvLines(content: string) {
  const lines = content.split(/\r?\n/);
  const keys = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) keys.add(m[1]);
  }
  return { lines, keys };
}

function updateEnvLines(lines: string[], updates: Record<string, string>) {
  const used = new Set<string>();
  const next = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) return line;
    const key = m[1];
    if (!(key in updates)) return line;
    used.add(key);
    return `${key}=${updates[key]}`;
  });
  const remaining = Object.keys(updates).filter((k) => !used.has(k));
  for (const key of remaining) {
    next.push(`${key}=${updates[key]}`);
  }
  return next.filter((line, idx, arr) => idx < arr.length - 1 || line.trim() !== '');
}

async function main() {
  const rl = createInterface({ input, output });
  const ask = async (q: string, def?: string) => {
    const suffix = def !== undefined ? ` [${def}]` : '';
    const ans = (await rl.question(`${q}${suffix}: `)).trim();
    return ans || def || '';
  };

  const updates: Record<string, string> = {};

  const twitterKey = await ask('TWITTERAPI_KEY (留空保持)');
  if (twitterKey) updates.TWITTERAPI_KEY = twitterKey;

  const feishuWebhook = await ask('FEISHU_WEBHOOK (留空保持)');
  if (feishuWebhook) updates.FEISHU_WEBHOOK = feishuWebhook;

  const llmKey = await ask('SILICONFLOW_API_KEY (留空保持)');
  if (llmKey) updates.SILICONFLOW_API_KEY = llmKey;

  const llmBase = await ask('SILICONFLOW_BASE_URL', 'https://api.siliconflow.cn/v1');
  if (llmBase) updates.SILICONFLOW_BASE_URL = llmBase;

  const llmModel = await ask('SILICONFLOW_MODEL (留空保持)');
  if (llmModel) updates.SILICONFLOW_MODEL = llmModel;

  const textOnly = await ask('FEISHU_TEXT_ONLY (0/1)', '0');
  updates.FEISHU_TEXT_ONLY = textOnly === '1' ? '1' : '0';

  const mode = await ask('代理模式 0无 1全局 2分服务', '1');
  if (mode === '0') {
    updates.HTTP_PROXY = '';
    updates.HTTPS_PROXY = '';
    updates.LLM_PROXY = '';
    updates.X_PROXY = '';
    updates.FEISHU_PROXY = '';
    updates.RSS_PROXY = '';
  } else if (mode === '2') {
    updates.LLM_PROXY = await ask('LLM_PROXY (留空表示直连)');
    updates.X_PROXY = await ask('X_PROXY (留空表示直连)');
    updates.FEISHU_PROXY = await ask('FEISHU_PROXY (留空表示直连)');
    updates.RSS_PROXY = await ask('RSS_PROXY (留空表示直连)');
    updates.HTTP_PROXY = '';
    updates.HTTPS_PROXY = '';
  } else {
    const proxy = await ask('HTTP_PROXY', 'http://127.0.0.1:10808');
    updates.HTTP_PROXY = proxy;
    updates.HTTPS_PROXY = proxy;
    updates.LLM_PROXY = '';
    updates.X_PROXY = '';
    updates.FEISHU_PROXY = '';
    updates.RSS_PROXY = '';
  }

  const noProxy = await ask('NO_PROXY', 'api.twitterapi.io,open.feishu.cn,127.0.0.1,localhost');
  updates.NO_PROXY = noProxy;

  const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  const { lines } = parseEnvLines(content);
  const next = updateEnvLines(lines.length ? lines : [''], updates);
  fs.writeFileSync(envPath, next.join('\n'), 'utf-8');
  rl.close();
  console.log(`✅ Updated ${envPath}`);
}

main();
