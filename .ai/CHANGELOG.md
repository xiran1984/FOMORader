# FOMORader CHANGELOG

格式：`[版本] YYYY-MM-DD - 改了什么 / 为什么改`

---

## [v0.6] 2026-03-13
### 新增
- **High Score Vault (高分金库)**：
  - 前端：三栏布局右侧新增“Score ≥ 7.0”专栏，专门展示高价值内容。
  - 数据保护：修改 `seed.ts` 清理逻辑，永久保留分数 ≥ 7.0 的内容，以及每日最高分（Daily Max）和已收藏内容，不受 300 条总数限制。
  - API：优化 `/api/hotspots` 查询逻辑，使用 UNION 策略确保高分内容即使发布时间较早也能被前端获取。
- **收藏功能 (Favorites)**：
  - 交互：Top Rated 和 Vault 栏目新增 ⭐ 收藏按钮，支持乐观 UI 更新和点击动画。
  - 持久化：数据库 `hotspots` 表新增 `is_favorite` 字段，收藏内容永久免删。
  - 接口：新增 `POST /api/hotspots/:id/favorite` 用于状态切换。
- **推送去重 (Push History)**：
  - 数据库新增 `push_history` 表，记录已推送的 `hotspot_id`。
  - `notifier.ts` 推送前检查历史记录，彻底解决重复推送问题。
- **并发写入隔离**：
  - 采集端拆分为 `hotspots_x.json` 和 `hotspots_rss.json`，避免多进程写入冲突。
  - `seed.ts` 升级为多源合并模式。

### 优化
- **界面布局**：
  - 升级为 `1:2:1` 三栏布局（Latest - Top Rated - Vault）。
  - 将时间筛选器（All Time / Last 24h）移至中间列标题栏，优化交互体验。
  - 统一 Latest Feed 的卡片样式与 RadarStream 一致。
- **日期显示**：修复 Latest Feed 中因字段错误导致的 "Invalid Date" 问题，统一使用 `published_at`。

---

## [v0.5] 2026-03-13
### 新增
- **自动化调度系统**：
  - 引入 `node-schedule` 实现全自动任务流：每日 08:00 (X 抓取) / 每周日 08:00 (RSS 抓取)。
  - `server/scheduler.ts`：支持热更新配置，修改时间无需重启。
- **飞书集成**：
  - `services/notifier.ts`：每日自动推送 Top N 高分内容至飞书群。
  - 交互式卡片：支持中文摘要、分数高亮、发布时间展示及原文跳转。
- **前端设置中心**：
  - ⚙️ Settings 面板：支持自定义每日推送时间及推送条数 (5-30 条)。
  - 🔄 手动触发：新增 "Update Now" 按钮，支持异步触发抓取+打分流，具备动态状态轮询。
  - ⏳ 筛选功能：新增 "Last 24h" 按钮，一键过滤近期热点。

### 修复与优化
- **时区一致性**：`x-collector` 切换为 UTC 时间窗口，解决跨时区数据漏抓问题。
- **时间标准化**：
  - 修复 Twitter 原始时间解析逻辑，统一为 ISO 8601。
  - SQL 查询引入 `datetime()` 函数并使用 `ROW_NUMBER` 优化，彻底解决排序混乱和重复打分显示问题。
- **采集策略调整**：移除 X 采集的热度门槛 (`min_faves`/`min_rt` 设为 0)，侧重早期高价值信息捕获。

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
