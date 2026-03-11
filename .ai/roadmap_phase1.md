## 📅 阶段一：地基与数据 (Days 1-2)


**目标**：跑通 "爬取 -> 存储 -> 展示" 的最小闭环。

---

- [ ] **项目初始化**
    - [ ] `npm create vite@latest fomorader -- --template react-ts`
    - [ ] 安装 JS 依赖：
        ```bash
        npm install tailwindcss postcss autoprefixer lucide-react better-sqlite3 @types/better-sqlite3
        ```
    - [ ] 安装 Python 依赖：
        ```bash
        pip install requests feedparser beautifulsoup4 python-dotenv
        ```
    - [ ] 创建 `.ai/` 文件夹，放入项目文档（RULES / ARCHITECTURE / CHANGELOG 等）
    - [ ] 创建 `.env`，写入：
        ```
        TWITTERAPI_KEY=你的key
        ```
    - [ ] 创建 `.gitignore`，写入：
        ```
        .env
        cookies.json
        data/
        node_modules/
        ```
    - [ ] 创建完整目录结构：
        ```
        fomorader/
        ├── .ai/                          # AI 协作文档
        │   ├── RULES.md
        │   ├── ARCHITECTURE.md
        │   ├── CHANGELOG.md
        │   ├── ERRORS.md
        │   ├── DECISIONS.md
        │   └── TODO.md
        ├── scripts/
        │   ├── x-collector/              # X 采集模块
        │   │   ├── config.py             # 关键词、筛选参数配置
        │   │   ├── collector.py          # twitterapi.io 调用
        │   │   ├── filter.py             # 本地质量过滤（中文检测等）
        │   │   └── main.py               # 入口，串联 collector + filter
        │   ├── fetch_rss.py              # RSS 爬取入口
        │   └── seed.ts                   # JSON → SQLite
        ├── services/
        │   ├── llm.ts                    # LLM 适配层（阶段二）
        │   └── scorer.ts                 # 评分引擎（阶段二）
        ├── src/                          # React 前端（阶段三）
        ├── data/                         # gitignore
        │   ├── hotspots_raw.json         # 爬取结果
        │   └── fomorader.db              # SQLite 数据库
        ├── .env                          # gitignore
        ├── .gitignore
        └── package.json
        ```

---

- [ ] **数据获取 · RSS（国际 AI 一手信息，免费）**
    - [ ] 脚本：`scripts/fetch_rss.py`
    - [ ] 数据源（10个）：
        - OpenAI Blog、Anthropic News、Google DeepMind Blog
        - Hugging Face Blog、The Verge · AI、MIT Technology Review
        - VentureBeat · AI、Ars Technica、Import AI、The Batch
    - [ ] 运行并验证：
        ```bash
        python scripts/fetch_rss.py --dry-run   # 预览
        python scripts/fetch_rss.py             # 正式爬取
        python scripts/fetch_rss.py --days 14   # 扩大时间范围
        ```
    - [ ] 输出：`data/hotspots_raw.json`（标准结构，按 published_at 降序）

---

- [ ] **数据获取 · X（中文高质量推文，twitterapi.io 付费）**
    - [ ] 注册 [twitterapi.io](https://twitterapi.io)，充值（最低 $10，≈ 6.6万条额度，积分不过期）
    - [ ] `.env` 写入 `TWITTERAPI_KEY`
    - [ ] 模块文件职责：
        - `config.py`：关键词列表、质量门槛（min_faves / min_retweets）、输出路径
        - `collector.py`：调用 twitterapi.io，分页获取，返回原始数据
        - `filter.py`：中文字符检测（≥5个汉字）、去重、字段标准化
        - `main.py`：串联以上三个模块，合并输出到 `data/hotspots_raw.json`
    - [ ] 质量筛选（三层）：
        - **搜索层**：`min_faves:50 min_retweets:10 lang:zh -is:retweet`
        - **排序层**：`queryType: Top` 热度优先
        - **本地层**：`filter.py` 正文必须包含 ≥5 个汉字
    - [ ] 运行并验证：
        ```bash
        python scripts/x-collector/main.py --dry-run              # 预览前3条
        python scripts/x-collector/main.py                        # 正式爬取
        python scripts/x-collector/main.py --min-faves 200 --min-rt 30  # 提高门槛
        ```

---

- [ ] **数据处理 · Seed（JSON → SQLite）**
    - [ ] 脚本：`scripts/seed.ts`
    - [ ] 运行：`npx tsx scripts/seed.ts`
    - [ ] 自动创建 `data/fomorader.db`，建立三张表：
        - `hotspots`：原始热点数据（由 seed.ts 写入）
        - `scores`：AI 评分结果（由阶段二 scorer.ts 写入）
        - `cache`：LLM 调用缓存，键为 `url + model_version + rules_version`
    - [ ] 增量更新：`ON CONFLICT(url) DO UPDATE`，重复跑安全
    - [ ] 支持 `--reset` 清空重建（慎用，会清空 scores）
    - [ ] 验证：终端打印各来源条数统计

---

- [ ] **端到端验证（阶段一完成标志）**
    - [ ] `python scripts/fetch_rss.py` → 终端显示各源条数，无报错
    - [ ] `python scripts/x-collector/main.py --dry-run` → 返回有效中文推文
    - [ ] `npx tsx scripts/seed.ts` → 打印来源统计，无报错
    - [ ] 用 [DB Browser for SQLite](https://sqlitebrowser.org/) 打开 `data/fomorader.db` → `hotspots` 表有数据

---

- [ ] **package.json 快捷命令**
    ```json
    "scripts": {
      "fetch:rss":  "python scripts/fetch_rss.py",
      "fetch:x":    "python scripts/x-collector/main.py",
      "fetch":      "npm run fetch:rss && npm run fetch:x",
      "seed":       "npx tsx scripts/seed.ts",
      "refresh":    "npm run fetch && npm run seed",
      "dev":        "vite"
    }
    ```
    - `npm run refresh` → 全流程一键更新
    - `npm run fetch:rss` / `npm run fetch:x` → 单独更新某一数据源
