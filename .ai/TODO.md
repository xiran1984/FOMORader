# FOMORader TODO

> AI 只能做「进行中」的任务，不能自行将「待办」移入「进行中」。

***

## ✅ 已完成

- [x] 项目立项，技术栈确定
- [x] RULES.md v1.2
- [x] `fetch_rss.py`：10个国际 AI RSS 源
- [x] `fetch_x_twitterapi.py`：twitterapi.io 三层质量筛选
- [x] `seed.ts`：JSON → SQLite，三张表建立
- [x] 阶段一路线图补全
- [x] .ai/ 文档体系建立（RULES / ARCHITECTURE / CHANGELOG / ERRORS / DECISIONS / TODO）

***

- [x] 阶段一端到端验证（fetch → seed → DB 数据确认）

***

## ✅ 已完成

- [x] 评分功能验证与测试
- [x] `services/llm.ts`：Qwen 32B 适配层，统一接口
- [x] `services/scorer.ts`：评分引擎 (含 cache、dedupe、author/title\_zh 提取)
- [x] 前端三栏布局：HotspotList / RadarStream (Top Rated) / ScoreCard
- [x] 交互优化：点击标题/作者跳转，中文标题优先展示
- [x] `npm run refresh` 一键刷新
- [x] `npm run score` 批量评分
- [x] High Score Vault (高分金库) & 收藏功能
- [x] 自动推送 (Feishu) & 推送去重
- [x] 全局代理支持 (Proxy) & 更新流程优化

***

## 🚀 进行中 (v2.0 升级计划)

### 1. 源拓展 - 知乎 (Zhihu)

- [ ] 开发 `scripts/fetch_zhihu.py`：支持热榜抓取与关键词搜索
- [ ] 适配 `seed.ts`：支持 `hotspots_zhihu.json` 入库
- [ ] 应对反爬策略 (Cookie/Headers/Puppeteer)

### 2. 话题泛化 (Generalization)

- [ ] 创建 `config/topics.json`：抽离硬编码的关键词
- [ ] 改造 `x-collector` & `fetch_rss.py`：动态读取话题配置
- [ ] 动态 Prompt：根据配置话题调整 LLM 评分标准

### 3. 配置体验 (DX)

- [ ] 开发 `scripts/setup.ts`：交互式配置向导 (Env/Proxy/Topics)
- [ ] 前端设置页增强：可视化管理关键词与源

***

## 📋 待办（阶段二）

- [ ] 趋势预测视觉化（trend\_signal: rising / stable / fading）
- [ ] 点击热点 → 触发评分 → 动画展示（当前已改为预先批量评分）

***

## 📋 待办（阶段三）

- [x] README 更新
- [ ] 知乎 / 微博热榜接入
- [x] 自动推送功能

