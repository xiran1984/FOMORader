# FOMORader 技术决策记录

> 记录每个重要技术选型的原因，防止在不了解背景的情况下推翻已有决策。

---

## 数据库：SQLite（而非 PostgreSQL / Supabase）
**决策时间**：v0.1
**选择**：better-sqlite3
**原因**：
- FOMORader 是单机本地工具，无需多用户并发
- SQLite 零配置，文件即数据库，便于携带和备份
- better-sqlite3 同步 API，避免异步复杂度
**如果需要改变**：当日活用户 > 100 或需要多设备同步时，再考虑迁移

---

## 前端框架：React + Vite（而非 Next.js）
**决策时间**：v0.1
**选择**：React + Vite + TypeScript
**原因**：
- FOMORader 是纯客户端工具，不需要 SSR
- Vite 构建速度快，开发体验好
- 避免 Next.js 的服务端复杂度

---

## LLM：优先 Qwen（而非 GPT-4 / Claude）
**决策时间**：v0.1
**选择**：Qwen-2.5-72B 为默认，DeepSeek-V3 为备选
**原因**：
- 中文理解和生成质量在同价位最优
- 价格比 GPT-4 便宜约 10 倍
- 支持多 LLM 切换，llm.ts 做适配层隔离

---

## X 数据源：twitterapi.io（而非官方 API / 爬虫）
**决策时间**：v0.3
**选择**：twitterapi.io，$0.15/1000条
**放弃的方案**：
- 官方 API Free tier：100次读取/月，不够用
- 官方 API Basic：$200/月，成本过高
- twikit Cookie 爬虫：有封号风险，账号重要
- Apify：免费账号 API 调用受限，需额外付费
**如果需要改变**：当月用量超过 $5 时，评估是否值得继续

---

## RSS 数据源：9个国际 AI 源（而非国内平台）
**决策时间**：v0.3
**选择**：OpenAI / Anthropic / DeepMind / TechCrunch 等英文一手源
**原因**：
- 中文 AI 内容 90% 是英文源的二手加工，信息密度低
- 国内平台（小红书/微博）反爬严重，维护成本高
- 国内信息信噪比低，质量筛选成本高
**如果需要改变**：等 DailyHotApi 部署完成后，可追加知乎/微博热榜作为补充

---

## 缓存键：url + model_version + rules_version
**决策时间**：v0.2
**选择**：三元组作为缓存主键
**原因**：
- 同一内容换模型需要重新评分
- RULES 版本升级后历史缓存自动失效，避免用旧权重的缓存污染新结果
- url 比 content_hash 更稳定（推文删除场景例外）
