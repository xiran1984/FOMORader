import 'dotenv/config';
import fetch from 'node-fetch';
import HttpsProxyAgent from 'https-proxy-agent';

const noProxy = process.env.NO_PROXY || process.env.no_proxy || '';
const globalProxy =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy ||
  '';

function shouldBypassProxy(targetUrl: string, noProxyList: string): boolean {
  if (!noProxyList) return false;
  let host = '';
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    return false;
  }
  const entries = noProxyList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length === 0) return false;
  return entries.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function resolveProxy(targetUrl: string, specificProxy?: string): string {
  const proxy = (specificProxy || '').trim() || globalProxy;
  if (!proxy) return '';
  if (shouldBypassProxy(targetUrl, noProxy)) return '';
  return proxy;
}

async function checkUrl(name: string, url: string, specificProxy?: string) {
  const proxy = resolveProxy(url, specificProxy);
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
  try {
    const res = await fetch(url, { method: 'GET', agent, timeout: 8000 });
    const note = proxy ? `proxy=${proxy}` : 'direct';
    console.log(`OK ${name} ${res.status} ${note}`);
  } catch (e: any) {
    const note = proxy ? `proxy=${proxy}` : 'direct';
    console.log(`FAIL ${name} ${note} ${e?.message || String(e)}`);
  }
}

async function main() {
  const missing: string[] = [];
  if (!process.env.FEISHU_WEBHOOK) missing.push('FEISHU_WEBHOOK');
  if (!process.env.TWITTERAPI_KEY) missing.push('TWITTERAPI_KEY');
  if (!process.env.SILICONFLOW_API_KEY && !process.env.OPENAI_API_KEY) {
    missing.push('SILICONFLOW_API_KEY or OPENAI_API_KEY');
  }
  if (missing.length > 0) {
    console.log(`Missing: ${missing.join(', ')}`);
  }

  const baseURL = (process.env.SILICONFLOW_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
  const tasks = [
    checkUrl('Local API', 'http://127.0.0.1:3000/api/health'),
    checkUrl('Feishu', 'https://open.feishu.cn', process.env.FEISHU_PROXY),
    checkUrl('X API', 'https://api.twitterapi.io', process.env.X_PROXY),
    checkUrl('LLM', baseURL, process.env.LLM_PROXY || process.env.SILICONFLOW_PROXY),
    checkUrl('RSS', 'https://techcrunch.com', process.env.RSS_PROXY),
  ];
  await Promise.all(tasks);
}

main();
