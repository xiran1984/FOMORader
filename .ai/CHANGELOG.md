# FOMORader CHANGELOG

格式：`[版本] YYYY-MM-DD - 改了什么 / 为什么改`

---

## [v0.4] 2026-03-12
### 新增
- **数据库 schema 升级**：`scores` 表新增 `author`, `author_url`, `summary_zh`, `title_zh`, `scored_at`, `trend_signal` 字段，支持中文标题和作者信息提取。
- **LLM 增强**：
  - `fetch_rss.py`：接入 LLM API，爬取时将英文标题自动翻译为中文。
  - `services/llm.ts`：Prompt 优化，增加中文标题生成 (`title_zh`)，并强制提取 X Handle 作为作者名（如 `@Saccc_c`）。
  - **语义去重**：`dedupeHotspot` 逻辑升级，增加“语义高度重合”判断，相似度粗筛阈值提升至 0.45，减少重复新闻。
  - **模型升级**：默认模型切换回 `Qwen/Qwen2.5-32B-Instruct`，提升指令遵循能力和评分准确性。
- **前端优化**：
  - **Top Rated**：逻辑调整为按分数降序展示前 20 条（不再硬性过滤 >= 7 分）。
  - **交互增强**：点击标题直接跳转原文（新标签页），点击作者名跳转作者主页（针对 X 平台）。
  - **视觉优化**：统一时间格式为 `MM/DD HH:mm`，支持优先显示中文标题。
- **项目管理**：`.gitignore` 新增 `.trae/` 忽略项。

### 变更
- `services/scorer.ts`：支持自动迁移旧表结构（`ensureScoresSchema`），写入逻辑适配新字段。
- `server/index.ts`：API 返回数据包含新增字段。

---

## [v0.3] 2026-03-11
### 新增
- `fetch_x_twitterapi.py`：接入 twitterapi.io，三层质量筛选（搜索层 min_faves/min_retweets + 排序层 Top + 本地中文字符过滤）
- `fetch_rss.py`：接入10个国际 AI RSS 源，支持 --days / --dry-run 参数
- `seed.ts`：JSON → SQLite，建立 hotspots / scores / cache 三张表，支持增量更新和 --reset

### 变更
- 数据源从"只处理X"扩展为"X + 国际 RSS"，RULES.md 同步更新至 v1.2
- fetch_rss.py 改用 requests 预处理原始字节，解决 Anthropic/The Verge/The Batch XML 非法字符问题

### 放弃的方案（及原因）
- ~~X 官方 API~~：免费套餐 100次读取/月，不可用
- ~~twikit Cookie 方案~~：有封号风险，账号重要不采用
- ~~Apify apidojo/tweet-scraper~~：免费账号无法通过 API 调用，需额外付费订阅
- ~~SocialData.tools~~：无免费套餐，服务稳定性差
- ~~DailyHotApi~~：需自行部署，国内平台数据质量信噪比高

---

## [v0.2] 2026-03-10
### 新增
- 项目路线图 v1.1：确定技术栈（React + Vite + TypeScript + SQLite + Python）
- 评分维度权重：原创(0.3)、准确(0.25)、深度(0.2)、互动(0.15)、中立(0.1)

---

## [v0.1] 2026-03-09
### 新增
- 项目立项：FOMORader，中文 AI 热点雷达
- RULES.md v1.0 初稿
