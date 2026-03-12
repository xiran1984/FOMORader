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
│   ├── fetch_rss.py              # RSS 爬取 → data/hotspots_raw.json
│   ├── seed.ts                   # JSON → SQLite (data/fomorader.db)
│   └── x-collector/              # X 采集模块 (twitterapi.io)
│       ├── config.py             # 配置与API Key
│       ├── collector.py          # API 调用封装
│       ├── filter.py             # 数据清洗与去重
│       └── main.py               # 入口 → data/hotspots_raw.json
├── services/
│   ├── llm.ts                    # LLM 适配层（Qwen / DeepSeek 切换）
│   └── scorer.ts                 # 评分引擎（读 hotspots，写 scores）
├── src/                          # React 前端（Vite + TypeScript）
│   ├── components/
│   │   ├── HotspotList.tsx       # 左侧热点列表
│   │   ├── RadarStream.tsx       # 中间雷达扫描流（核心视觉）
│   │   └── ScoreCard.tsx         # 右侧评分卡片
│   └── App.tsx
├── data/
│   ├── hotspots_raw.json         # 爬取结果（gitignore）
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
                  HotspotList / RadarStream / ScoreCard
```

## 数据库表结构

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
| value | TEXT | JSON 评分结果（包含 platform_score / creator_score / content_score 等用于复用的中间值） |

## 模块职责边界
| 模块 | 只能做 | 不能做 |
|------|--------|--------|
| fetch_rss.py | 爬取→写 JSON |
| x-collector | 爬取→合并 JSON |
| seed.ts | 读 JSON→写 hotspots | 触发评分、修改表结构 |
| scorer.ts | 读 hotspots→写 scores+cache | 修改 hotspots |
| 前端 | 只读数据库 | 写数据库、调 LLM |

## 一键刷新命令
```bash
npm run refresh   # = fetch_rss + fetch_x + seed
npm run score     # = scorer.ts 对未评分条目批量打分
```
