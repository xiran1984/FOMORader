# FOMORader TODO

> AI 只能做「进行中」的任务，不能自行将「待办」移入「进行中」。

---

## ✅ 已完成

- [x] 项目立项，技术栈确定
- [x] RULES.md v1.2
- [x] `fetch_rss.py`：10个国际 AI RSS 源
- [x] `fetch_x_twitterapi.py`：twitterapi.io 三层质量筛选
- [x] `seed.ts`：JSON → SQLite，三张表建立
- [x] 阶段一路线图补全
- [x] .ai/ 文档体系建立（RULES / ARCHITECTURE / CHANGELOG / ERRORS / DECISIONS / TODO）

---

- [x] 阶段一端到端验证（fetch → seed → DB 数据确认）

---

## ✅ 已完成
- [x] 评分功能验证与测试
- [x] `services/llm.ts`：Qwen 32B 适配层，统一接口
- [x] `services/scorer.ts`：评分引擎 (含 cache、dedupe、author/title_zh 提取)
- [x] 前端三栏布局：HotspotList / RadarStream (Top Rated) / ScoreCard
- [x] 交互优化：点击标题/作者跳转，中文标题优先展示
- [x] `npm run refresh` 一键刷新
- [x] `npm run score` 批量评分

---

## 📋 待办（阶段二）
- [ ] 趋势预测视觉化（trend_signal: rising / stable / fading）
- [ ] 点击热点 → 触发评分 → 动画展示（当前已改为预先批量评分）

---

## 📋 待办（阶段三）
- [ ] README 更新
- [ ] 知乎 / 微博热榜接入
- [ ] 自动推送功能
- [ ] 用户反馈系统
