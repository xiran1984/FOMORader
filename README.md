# 📡 FOMORader (AI News Radar)

> **Don't Miss Out.** Filter the noise, find the signal.
> 一个基于 AI 的技术热点雷达，通过多源数据采集与 LLM 智能评分，帮你缓解信息焦虑，发现真正的价值信息。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Alpha-orange.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

# 为什么要做这个项目
受限于推荐算法，国内信息平台的信噪比逐渐降低，信息茧房效应愈发严重；而即便是中文质量相对较高的 X (Twitter)，也面临着噪音泛滥、高价值内容稀缺的问题。因此，我想开发这款“傻瓜式”工具——FOMORader。它能每天自动抓取并筛选高质量信息，定时推送到你的聊天软件，助你以最低的注意力成本，快速获取真正有用的资讯。

## 🌟 核心特性

- **多源智能采集**:
    - **RSS**: 聚合 OpenAI, Anthropic, Google DeepMind, Microsoft, AWS 等顶级技术博客，自动过滤低质量内容。
    - **Twitter (X)**: 基于 `twitterapi.io` 抓取高质量 AI 圈讨论，支持三层质量筛选（搜索层/排序层/内容层）。
- **LLM 深度增强**:
    - **智能评分**: 利用 **Qwen 2.5 32B** 模型对每条资讯进行多维度打分（原创性、准确性、深度、互动量、中立性）。
    - **自动翻译**: 英文标题自动翻译为中文，消除语言障碍。
    - **语义去重**: 基于语义理解识别重复新闻，避免信息冗余。
    - **实体提取**: 自动提取作者信息（X Handle）和关键标签。
- **现代化雷达界面**:
    - **Top Rated**: 按分数降序展示高价值内容，一眼识别精华。
    - **交互友好**: 点击标题直达原文，点击作者跳转主页，支持时间线浏览。
    - **响应式设计**: 适配桌面与移动端，随时随地掌握动态。
### 3. High Score Vault (高分金库)
位于右侧专栏，自动收录所有 `Total Score ≥ 7.0` 的精华内容。
- **永久保留**：不受 300 条数据清理限制。
- **收藏功能**：点击卡片上的 ⭐ 图标可手动收藏，同样享受永久保留特权。
- **每日状元**：系统自动识别并保留每天分数最高的那一条，哪怕它不足 7 分。

### 4. 自动化任务调度
    - **每日更新**: 用户设定好推送时间 自动抓取过去 24 小时的 X 平台 AI 讨论。
    - **每周周刊**: 每周日 08:00 自动聚合过去一周的顶级 RSS 技术博客。

## 🛠️ 技术栈

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Lucide Icons
- **Backend/Scripts**: Node.js (Hono), Python 3.10+
- **Database**: SQLite (via `better-sqlite3`)
- **AI Engine**: 兼容 OpenAI 格式的 LLM API (默认适配 SiliconFlow/DeepSeek/Qwen)

## 🚀 快速开始

### 1. 环境准备

确保已安装 Python 3.10+ 和 Node.js 18+。

```bash
# 克隆项目
git clone https://github.com/yourusername/fomorader.git
cd fomorader

# 安装 Python 依赖
pip install -r requirements.txt  # 建议使用虚拟环境

# 安装 Node.js 依赖
npm install
```

### 2. 配置

复制环境变量示例文件并填入你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```ini
# LLM API 配置 (推荐 SiliconFlow)
SILICONFLOW_API_KEY=sk-your-key-here
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen2.5-32B-Instruct

# Twitter API 配置 (可选，用于 X 数据采集)
TWITTER_API_KEY=your-twitterapi-io-key
```

### 3. 数据采集与评分

一键运行全流程（采集 -> 入库 -> 评分）：

```bash
# 1. 采集数据 (RSS + X) 并入库
npm run refresh

# 2. 对未评分数据进行打分
npm run score

# 或者：对所有数据强制重新打分（适用于调试 Prompt）
# npm run score -- --limit 999999
```

### 4. 启动应用

同时启动后端 API 和前端界面：

```bash
npm run dev
```

访问 `http://localhost:5173` 

### 5. 连接飞书机器人

将Webhook 地址配置到env文件


## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进 FOMORader！

## 📄 许可证

MIT License
