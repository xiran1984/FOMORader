# 📡 FOMORader (AI News Radar)

> **Don't Miss Out.** Filter the noise, find the signal.
> 一个基于 AI 的技术热点雷达，通过多源数据采集与 LLM 智能评分，帮你缓解信息焦虑。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Alpha-orange.svg)

## 🌟 核心功能

*   **多源采集**:
    *   RSS: 聚合 OpenAI, Microsoft, Google 等顶级技术博客。
    *   Twitter (X): 抓取高质量中文 AI 圈讨论 (基于 `twikit`)。
*   **智能评分**: 利用 LLM (Qwen/DeepSeek) 对每条资讯进行多维度打分（原创性、准确性、深度、互动量、中立性）。
*   **雷达展示**: React 前端可视化展示，按分数排序，一眼识别高价值内容。

## 🛠️ 技术栈

*   **前端**: React 19, TypeScript, Vite, TailwindCSS
*   **后端/脚本**: Python 3.10+, Node.js
*   **数据库**: SQLite (via `better-sqlite3`)
*   **AI**: 兼容 OpenAI 格式的 LLM API (Qwen, DeepSeek)

## 🚀 快速开始

### 1. 环境准备
确保已安装 Python 3.10+ 和 Node.js 18+。

```bash
# 克隆项目
git clone https://github.com/yourusername/fomorader.git
cd fomorader

# 安装 Python 依赖
pip install feedparser requests twikit python-dotenv

# 安装 Node.js 依赖
npm install
```

### 2. 配置
复制环境变量示例文件：
```bash
cp .env.example .env
# 编辑 .env 填入你的 LLM API Key
```

如果需要采集 Twitter，请确保根目录下有 `cookies.json` 文件（从浏览器导出）。

### 3. 数据采集
```bash
# 1. 抓取 RSS 数据
python scripts/fetch_rss.py

# 2. 抓取 Twitter 数据 (需配置 cookie)
python x-collector/main.py

# 3. 数据入库
npx tsx scripts/seed.ts
```

### 4. 启动前端
```bash
npm run dev
```
访问 `http://localhost:5173` 查看雷达。

## 📂 目录结构
*   `data/`: 存储 SQLite 数据库和原始 JSON 数据。
*   `scripts/`: Python 采集脚本与数据处理脚本。
*   `x-collector/`: Twitter 采集模块。
*   `src/`: React 前端源码。
*   `.ai/`: 项目文档与架构设计。

## 🤝 贡献
欢迎提交 Issue 或 Pull Request。

## 📄 许可证
MIT License