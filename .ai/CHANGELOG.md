# FOMORader CHANGELOG

格式：`[版本] YYYY-MM-DD - 改了什么 / 为什么改`

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
