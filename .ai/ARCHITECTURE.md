# FOMORader 系统架构 - v1.0

## 目录结构
```
fomorader/
├── .ai/                          # AI 协作文档（本文件夹）
│   ├── RULES.md                  # 项目宪法
│   ├── ARCHITECTURE.md           # 本文件
│   ├── CHANGELOG.md              # 变更记录
│   ├── ERRORS.md                 # 已知问题与解决方案
│   ├── DECISIONS.md              # 技术决策记录
│   └── TODO.md                   # 任务看板
├── scripts/
│   ├── fetch_rss.py              # RSS 爬取 → data/hotspots_rss.json
│   ├── seed.ts                   # JSON (x/rss) → SQLite (data/fomorader.db)
│   └── x-collector/              # X 采集模块 (twitterapi.io)
│       ├── config.py             # 配置与API Key
│       ├── collector.py          # API 调用封装
│       ├── filter.py             # 数据清洗与去重
│       └── main.py               # 入口 → data/hotspots_x.json
├── services/
│   ├── llm.ts                    # LLM 适配层（Qwen / DeepSeek 切换）
│   ├── scorer.ts                 # 评分引擎（读 hotspots，写 scores）
│   └── notifier.ts               # 推送引擎（读取高分数据 → 飞书 Webhook）
├── server/
│   ├── index.ts                  # Hono 后端 (API + Scheduler)
│   └── scheduler.ts              # 定时任务调度器 (node-schedule)
├── src/                          # React 前端（Vite + TypeScript）
│   ├── components/
│   │   ├── HotspotList.tsx       # 左侧热点列表
│   │   ├── RadarStream.tsx       # 中间雷达扫描流（核心视觉）
│   └── App.tsx
├── data/
│   ├── hotspots_rss.json         # 过滤后的 RSS 数据（gitignore）
│   ├── hotspots_x.json           # 过滤后的 X 数据（gitignore）
│   └── fomorader.db              # SQLite 数据库（gitignore）
├── .env                          # 密钥（gitignore）
├── RULES.md                      # 项目宪法（根目录副本）
└── package.json
```

## 数据流
```
[RSS 源] ──────────────────────────────────┐
                                           ▼
                               fetch_rss.py / x-collector/main.py
                                           │
                                           ▼
                               data/hotspots_raw.json
                               （统一结构，url 去重）
                                           │
                                           ▼
                                      seed.ts
                                           │
                                           ▼
                               data/fomorader.db
                               ┌───────────┴───────────┐
                           hotspots                  cache
                               │
                               ▼
                           scorer.ts
                         （调用 LLM）
                               │
                               ▼
                            scores
                               │
                               ▼
                          React 前端
                  HotspotList / RadarStream
                               │
                               ▼
                       [推送系统]
                  node-schedule → notifier.ts
                               │
                               ▼
                          飞书群 (Webhook)
```

### 网络配置 (Proxy)
- **前端 -> 后端**：强制使用 `http://127.0.0.1:3000` 以绕过系统代理拦截。
- **后端 -> 外部API**：
  - Python 脚本 (`fetch_rss.py`, `x-collector`)：自动读取系统环境变量 (`HTTP_PROXY`)。
  - Node.js 服务 (`llm.ts`, `notifier.ts`)：显式使用 `https-proxy-agent` 读取 `.env` 中的 `HTTP_PROXY` 配置。

## 数据库设计 (SQLite)
`data/fomorader.db` (WAL Mode)

### hotspots（原始热点）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | sha256(url)[:8] |
| source | TEXT | 来源名称 |
| source_url | TEXT | RSS feed / X search URL |
| title | TEXT | 标题（X 取前80字） |
| url | TEXT UNIQUE | 原文链接，去重键 |
| published_at | TEXT | ISO8601 UTC |
| summary | TEXT | 摘要（300字以内） |
| tags | TEXT | JSON 数组字符串 |
| fetch_at | TEXT | 爬取时间 |
| created_at | TEXT | 入库时间 |
| is_favorite | INTEGER | 0/1 收藏状态 |

> **数据保留策略**：系统默认保留最新的 **300 条** 热点数据。但以下内容**永久保留**（豁免清理）：
> 1. 分数 `total_score >= 7.0`
> 2. 用户手动收藏 (`is_favorite = 1`)
> 3. 每日最高分（Daily Max Score）

### scores（评分结果）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| hotspot_id | TEXT FK | → hotspots.id |
| model_version | TEXT | 'qwen-2.5-7b' 等 |
| platform_score | REAL | 平台分 0-10 |
| creator_score | REAL | 创作者分 0-10 |
| content_score | REAL | 内容分 0-10 |
| originality | REAL | 原创 |
| accuracy | REAL | 准确 |
| depth | REAL | 深度 |
| engagement | REAL | 互动 |
| neutrality | REAL | 中立 |
| total_score | REAL | 加权总分 0-10（按 RULES.md 的平台/创作者/内容权重计算） |
| summary_zh | TEXT | AI 中文摘要（200字内） |
| title_zh | TEXT | AI 中文标题 |
| trend_signal | TEXT | 'rising'/'stable'/'fading' |
| scored_at | TEXT | 评分时间 |
| author | TEXT | 作者名称 |
| author_url | TEXT | 作者主页链接 |

### cache（LLM 调用缓存）
| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | url + ':' + model_version + ':' + rules_version |
| value | TEXT | JSON 评分结果 |

### push_history（推送历史）
| 字段 | 类型 | 说明 |
|------|------|------|
| hotspot_id | TEXT PK | → hotspots.id |
| pushed_at | TEXT | 推送时间 |

## 模块职责边界
| 模块 | 只能做 | 不能做 |
|------|--------|--------|
| fetch_rss.py | 爬取→写 JSON (RSS) |
| x-collector | 爬取→写 JSON (X) |
| seed.ts | 读 JSONs→写 hotspots+history | 触发评分、修改表结构 |
| scorer.ts | 读 hotspots→写 scores+cache | 修改 hotspots |
| notifier.ts | 读 scores→写 push_history | 修改 hotspots/scores |

## 一键刷新命令
```bash
npm run refresh   # = fetch_rss + fetch_x + seed
npm run score     # = scorer.ts 对未评分条目批量打分
```
