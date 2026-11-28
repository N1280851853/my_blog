---
kind: error_handling
name: 错误处理：轻量 try/catch + 结构化 JSON 错误响应
category: error_handling
scope:
    - '**'
source_files:
    - api/chat/completions.js
    - functions/api/chat/completions.js
    - themes/fomalhaut/scripts/events/404.js
    - scripts/ai-chat-inject.js
    - scripts/archive-index.js
---

## 1. 采用的方式

仓库没有引入任何专门的错误处理库（如 `pino-error`、`winston`、自定义 Error 类或错误码枚举）。错误处理以 **原生 JavaScript 的 `try/catch`** 为主，在 Node.js 侧通过统一的 JSON 包装函数返回结构化的 `{ error: { message, type } }` 响应体；前端脚本则直接 `console.log` / `alert` 展示失败信息。Hexo 主题侧仅有一个 404 页面生成器。

## 2. 关键文件

- `api/chat/completions.js` — Vercel Serverless 函数的实现，使用 Express 风格的 `res` 对象。
- `functions/api/chat/completions.js` — Cloudflare Pages Function 的等价实现，使用 Web API `Request/Response`。
- `themes/fomalhaut/scripts/events/404.js` — Hexo 构建期注册 404 页面的 generator。
- `scripts/ai-chat-inject.js`、`scripts/archive-index.js` — 站点级构建脚本中的 try/catch 示例。
- `public/js/modules/*.js`、`public/js/inject/*.js` — 前端模块中散落的 try/catch 与 `console.error`。

## 3. 架构与约定

### 3.1 服务端代理的错误模型
两个代理入口都定义了本地辅助函数来统一错误响应格式：

- Vercel 版本 (`api/chat/completions.js`)：`sendJson(res, code, message, extra)` 设置 `Content-Type: application/json; charset=utf-8` 和 `Cache-Control: no-store`，并返回 `{ error: { message, type: 'proxy' }, ...extra }`。
- Cloudflare 版本 (`functions/api/chat/completions.js`)：`json(obj, status)` 与 `fail(status, message) => json({ error: { message } }, status)`。

所有业务错误（非法请求体、缺少字段、来源白名单不匹配、配额超限、上游不可达）均走这两个函数，保证客户端始终收到一致的 JSON 结构。

### 3.2 HTTP 状态码约定
| 场景 | 状态码 | 说明 |
|---|---:|---|
| 非 POST 请求 | 405 | "只接受 POST" |
| 来源不在白名单 | 403 | 附带 origin/referer 原文 |
| 请求体不是合法 JSON | 400 | "请求体不是合法 JSON" |
| 缺少 messages 字段 | 400 | "缺少 messages" |
| 请求体过大 (>400KB) | 413 | "请求体太大" |
| 频率超限 (120次/小时/IP) | 429 | 带限流上限提示 |
| 未配置 DEEPSEEK_API_KEY | 500 | 指导去环境变量配置 |
| 上游 fetch 抛错 | 502 | 携带上游消息前 160 字符 |
| 上游返回非 2xx | 透传 upstream.status | 若 body 可读则原样返回，否则回退到 JSON 错误体 |

### 3.3 异常捕获策略
- **输入解析**：`JSON.parse` 包裹在 try/catch 中，失败即返回 400，不向上抛出。
- **网络 I/O**：对 `fetch(UPSTREAM)` 调用单独 try/catch，失败转 502。
- **SSE 流式读取**：`reader.read()` 循环用 try/catch 包裹，catch 分支为空注释「访客点了停止生成或断线：上游已 abort，静默收尾」——这是有意吞掉客户端断开连接产生的异常。
- **资源清理**：`req.on('close', ...)` 中 `ctrl.abort()` 以及 `res.end()` 都各自包一层 try/catch，确保关闭路径不会二次抛错。
- **Vercel 版本额外兜底**：`res.flushHeaders()` 也 try/catch，兼容某些运行时不支持 flush 的环境。

### 3.4 前端错误处理
前端脚本（如 `public/js/modules/nav.js`、`public/js/modules/effects.js` 等）普遍采用最简模式：
- 异步操作失败时 `catch(e => console.error(...))` 或 `console.warn(...)`。
- DOM 查询失败时用 `if (!element) return;` 提前返回。
- 没有统一的错误上报通道或全局 unhandledrejection handler。

### 3.5 Hexo 构建期错误
`scripts/ai-chat-inject.js` 中对注入逻辑的 try/catch 内调用 `hexo.log.warn('[ai-chat] 注入失败：' + err.message)`，将构建期异常降级为警告而非中断构建。

### 3.6 404 页面
`themes/fomalhaut/scripts/events/404.js` 通过 `hexo.extend.generator.register('404', ...)` 注册一个 generator，仅在 `hexo.theme.config.error_404.enable` 为真时才输出 `404.html`，布局复用 `page.pug` 且 `type: '404'`。

## 4. 观察到的约定与约束

- **约定**：服务端代理的所有可恢复错误都通过 `sendJson` / `fail` 返回 `{ error: { message } }` 结构的 JSON，客户端据此判断是否成功。
- **约定**：上游不可达一律返回 502，上游正常但非 SSE 内容类型时按非 2xx 透传状态码并尝试把 body 作为最终响应。
- **约定**：IP 限流使用进程内 `Map` 存储最近一小时的请求时间戳，超过 5000 条后清空，因此跨 Worker/冷启动不共享计数（Cloudflare 版本注释明确说明「每个 isolate 内存计数，冷启动会重置」）。
- **约定**：所有 try/catch 块中的 catch 参数名固定为 `e` 或 `err`，极少打印堆栈，通常只取 `e.message` 或直接吞掉。
- **约束**：DeepSeek API Key 不允许出现在浏览器端；当 `DEEPSEEK_API_KEY` 未配置时代理返回 500 并给出部署指引，由 `scripts/ai-chat-inject.js` 在构建时根据该变量决定是否把前端切到 `/api` 代理模式。
- **约束**：非 POST 请求一律拒绝（GET/HEAD 返回健康检查 JSON，OPTIONS 返回 204 Allow 头），避免被当作聊天接口滥用。

总体而言，这是一个面向静态博客站点的轻量方案：没有全局错误中间件、没有错误分类体系、没有日志聚合，核心错误集中在两个代理函数中，其余代码以防御性 try/catch 为主。