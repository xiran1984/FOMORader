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

## 🔄 进行中

- [ ] 阶段一端到端验证（fetch → seed → DB 数据确认）

---

## 📋 待办（阶段二）

- [ ] `services/llm.ts`：Qwen / DeepSeek 适配层，统一接口
- [ ] `services/scorer.ts`：评分引擎
    - 读取未评分的 hotspots
    - 调用 LLM，注入 RULES 权重
    - 写入 scores 表
    - 写入 cache 表（url + model + rules_version）
    - 输出摘要 ≤200字

---

## 📋 待办（阶段三）

- [ ] 前端三栏布局：HotspotList / RadarStream / ScoreCard
- [ ] 点击热点 → 触发评分 → 动画展示 → 结果缓存
- [ ] 趋势预测视觉化（trend_signal: rising / stable / fading）

---

## 📋 待办（阶段四）

- [ ] `npm run refresh` 一键刷新（Python 爬取 + TS 入库）
- [ ] `npm run score` 批量评分
- [ ] README 更新

---

## 🚫 暂时搁置

- [ ] 知乎 / 微博热榜接入（等 DailyHotApi 部署完成）
- [ ] 自动推送功能（阶段四后评估）
- [ ] 用户反馈系统（RULES 明确：反馈只记录，不影响当前版本权重）
