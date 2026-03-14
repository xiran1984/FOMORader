# 常见错误与解决方案 (ERRORS.md)

> 版本：v1.0
> 最后更新：2026-03-13

## 1. Failed to fetch (前端)

**现象**：
点击 "Update Now" 或刷新页面时，弹出 `Update failed: Failed to fetch` 或控制台报错。

**原因**：
系统开启了代理软件（如 Clash、v2rayN），导致浏览器请求 `localhost:3000` 时被拦截或转发。

**解决方案**：

- 前端代码已强制将 `localhost` 替换为 `127.0.0.1`。
- 如果仍报错，请检查代理软件的设置，将 `127.0.0.1` 加入不代理列表（Bypass List）。
- 确保后端服务器已启动 (`npm run server`)。

## 2. Error starting update (后端超时/静默失败)

**现象**：
点击更新后一直显示 "Updating..."，最后静默消失或弹出模糊错误。

**原因**：

- 后端任务（Python 脚本或 LLM 打分）执行时间过长，导致前端 HTTP 请求超时。
- 脚本执行过程中抛出异常（如网络错误），但未被正确捕获和反馈。

**解决方案**：

- 系统已升级为“异步触发 + 状态轮询”机制。
- 后端现在会捕获所有子进程的 stderr，并通过 `/api/status` 接口返回具体的错误信息。
- 如果遇到 `Command failed`，请检查 `.env` 中的代理配置是否正确。

## 3. LLM Request Failed (407/500/Timeout)

**现象**：
打分脚本运行缓慢或报错 `LLM request failed`。

**原因**：

- Node.js 原生 `fetch` 不支持自动读取系统代理环境变量。
- 国内网络无法直接连接 OpenAI 或 SiliconFlow API。

**解决方案**：

- 确保 `.env` 文件中配置了正确的 `HTTP_PROXY`（例如 `http://127.0.0.1:7897`）。
- 系统已集成 `https-proxy-agent`，会自动使用该代理。

## 4. Better-sqlite3 版本不匹配

**现象**：
运行 `seed.ts` 或启动服务器时报错 `NODE_MODULE_VERSION 115... requires 137`。

**原因**：
Node.js 版本升级后，原生 C++ 模块未重新编译。

**解决方案**：
运行 `npm rebuild better-sqlite3` 或删除 `node_modules` 后重新 `npm install`。
