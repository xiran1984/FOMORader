# FOMORader 已知问题与解决方案

> 遇到新问题先查这里，解决后必须补充记录。

---

## RSS 相关

### ❌ Anthropic / The Verge / The Batch RSS 解析失败
**报错**：`Feed 异常: <unknown>:2:751: not well-formed (invalid token)`
**原因**：这三个源的 RSS XML 正文中包含 XML 1.0 不允许的控制字符
**解决**：用 `requests` 先拿原始字节，用正则清洗控制字符后再交给 feedparser
```python
raw = re.sub(rb'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', b'', raw)
feed = feedparser.parse(raw)
```
**状态**：✅ 已修复（fetch_rss.py v0.3）

---

### ⚠️ BeautifulSoup MarkupResemblesLocatorWarning
**报错**：`The input looks more like a filename than HTML or XML`
**原因**：空字符串传入 BS4 时误判为文件路径
**解决**：
```python
from bs4 import MarkupResemblesLocatorWarning
import warnings
warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)
```
**状态**：✅ 已修复（fetch_rss.py v0.3）

---

### ⚠️ VentureBeat 返回 0 条
**原因**：最近7天内无新文章（正常现象），或时区偏差导致时间过滤过严
**解决**：运行时加 `--days 14` 扩大时间范围
**状态**：⚠️ 已知，非 bug

---

## X / twitterapi.io 相关

### ❌ Apify apidojo/tweet-scraper 通过 API 返回 0 条
**报错**：`You cannot use the API with the Free Plan`
**原因**：该 Actor 要求 Apify 付费订阅才能通过 API 调用，免费账号只能网页手动跑
**解决**：改用 twitterapi.io（$0.15/1000条，按量付费）
**状态**：✅ 已切换方案

---

### ❌ .env 中的 token 未被读取（Token: 未找到）
**原因**：`.env` 文件不在运行脚本的工作目录（项目根目录）
**解决**：
1. 确认 `.env` 在项目根目录（与 `package.json` 同级）
2. 等号两边不加空格，值不加引号：`TWITTERAPI_KEY=apify_xxx`
3. 临时验证：PowerShell 用 `$env:TWITTERAPI_KEY="xxx"` 直接设置环境变量
**状态**：✅ 已记录

---

## seed.ts 相关

### ⚠️ 重复运行 seed.ts 产生重复数据
**原因**：未使用 `ON CONFLICT` 处理
**解决**：seed.ts 已使用 `INSERT ... ON CONFLICT(url) DO UPDATE`，重复跑安全
**状态**：✅ 设计已规避

---

## 待排查

> 暂无
