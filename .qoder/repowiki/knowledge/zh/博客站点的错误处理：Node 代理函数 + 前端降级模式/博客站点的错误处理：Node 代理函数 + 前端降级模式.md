---
kind: error_handling
name: 博客站点的错误处理：Node 代理函数 + 前端降级模式
category: error_handling
scope:
    - '**'
source_files:
    - api/chat/completions.js
    - functions/api/chat/completions.js
    - source/js/census.js
    - scripts/ai-chat-inject.js
    - scripts/gallery-pager.js
    - source/js/fomal.js
---

## 1. 总体方式

仓库是一个 Hexo 个人博客站点，没有统一的错误类型体系、全局中间件或 panic/recover。错误处理按运行环境分为三类：

- **Vercel Serverless 函数** `api/chat/completions.js`：通过 `sendJson(res, code, message)` 返回结构化 JSON `{ error: { message, type: 'proxy' } }`，用 HTTP 状态码区分 400/403/405/413/429/500/502。
- **Cloudflare Pages Function** `functions/api/chat/completions.js`：等价实现，使用 `fail(status, message)` 返回 `Response` 对象，结构同为 `{ error: { message } }`。
- **前端脚本**（如 `source/js/census.js`）：对第三方接口调用使用 `.catch()` 捕获，统一走 `showChartFallback(id, error)` 在图表容器内渲染“统计服务暂不可用”的占位 UI，而不是让页面崩溃。
- **Hexo 构建期脚本**（`scripts/ai-chat-inject.js`、`scripts/archive-index.js`、`scripts/gallery-pager.js`）：对文件读取、HTML 注入等易失败操作包裹 `try/catch`，失败时记录 `hexo.log.warn` 并返回原值，保证构建不中断。

## 2. 关键文件

| 文件 | 职责 |
|---|---|
| `api/chat/completions.js` | Vercel 端 DeepSeek 请求代理，集中定义所有错误响应格式与状态码 |
| `functions/api/chat/completions.js` | Cloudflare 端等价实现，复用同一错误语义 |
| `source/js/census.js` | 百度统计图表的前端容错与降级展示 |
| `scripts/ai-chat-inject.js` | Hexo 构建期 HTML 注入器，吞掉解析/IO 异常 |
| `scripts/gallery-pager.js` | 生成阶段显式 `throw new Error(...)` 标记渲染失败 |
| `source/js/fomal.js` | 控制台策略：非调试模式下静默 `console.log`，保留 `console.error` / `console.warn` |

## 3. 架构与约定

### 3.1 服务端错误响应格式
两个代理函数都遵循同一契约：错误以 JSON 形式返回，字段为 `error.message`，Vercel 版额外带 `error.type = 'proxy'`。

```js
// api/chat/completions.js
function sendJson(res, code, message, extra) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(Object.assign({ error: { message: message, type: 'proxy' } }, extra || {})));
}
```

```js
// functions/api/chat/completions.js
function fail(status, message) { return json({ error: { message: message } }, status); }
```

### 3.2 参数校验与限流错误码
两端的校验顺序一致，对应明确的 HTTP 状态码：

| 场景 | 状态码 | 说明 |
|---|---:|---|
| 非 POST | 405 | 方法不允许 |
| Origin/Referer 不在白名单 | 403 | 来源校验失败 |
| 缺少 `DEEPSEEK_API_KEY` | 500 | 服务端配置缺失 |
| 超过每小时配额 | 429 | 速率限制 |
| 请求体过大 | 413 | 超出 `MAX_BODY_BYTES` |
| 非法 JSON / 缺少 messages | 400 | 客户端输入错误 |
| 上游 fetch 失败 | 502 | 连不上 DeepSeek |

### 3.3 上游流式响应的错误处理
Vercel 端使用 `AbortController` + `finally { try { res.end(); } catch(e){} }` 确保无论上游断开还是用户点击“停止生成”，响应都会被关闭；Cloudflare 端直接透传 `upstream.body`，由运行时负责关闭。

### 3.4 前端降级模式
`census.js` 定义了统一的降级入口：

```js
function showChartFallback(id, error) {
  // 在 #map-chart / #trends-chart / #sources-chart 中插入“统计服务暂不可用”提示
}
```

三个图表函数（`mapChart`、`trendsChart`、`sourcesChart`）的 `.catch()` 都调用它，同时把原始错误写入 `console.log`。数据格式校验集中在 `censusResult(data)`，当百度统计返回 `error_code`（例如 token 过期 111）时抛出一个可读的 `Error`，再由 `.catch()` 转为降级 UI。

### 3.5 构建期脚本的错误容忍
`scripts/ai-chat-inject.js` 的 `after_render:html` 钩子包裹整个逻辑：

```js
try { /* 注入 AI_CHAT_CONFIG 和 ai-chat.js */ }
catch (err) {
  try { hexo.log.warn('[ai-chat] 注入失败：' + (err && err.message)); } catch (e) {}
  return html;   // 失败时原样返回，不阻断构建
}
```

`scripts/gallery-pager.js` 则采用相反策略——渲染结果为空时主动 `throw new Error(page.source + ' 渲染结果为空')`，让构建失败以便发现模板问题。

### 3.6 控制台日志策略
`source/js/fomal.js` 在启动时根据 URL 查询参数 `?debug=1` 或主机名是否为 `localhost`/`127.0.0.1` 决定是否静音 `console.log`，但始终保留 `console.error` 和 `console.warn`，避免 pjax 换页失败等异常被彻底吞掉。

## 4. 观察到的约定与约束

- **服务端错误一律返回 JSON `{ error: { message } }`**，由 `sendJson` / `fail` 两个中心函数产出，避免散落的 `res.end(JSON.stringify(...))`。
- **HTTP 状态码与错误语义一一对应**：400（输入）、403（来源白名单）、405（方法）、413（请求体过大）、429（限流）、500（缺密钥）、502（上游不可达），这是两端代理函数共同遵守的约定。
- **Origin/Referer 白名单是强制边界**：未携带来源的请求放行（用于 curl/健康检查），否则必须匹配 `AI_PROXY_ORIGINS`、默认后缀 `example.com`、平台预览域名（`*.vercel.app` / `*.pages.dev`）或本地回环地址。
- **前端第三方依赖调用一律 `.catch()` 后走 `showChartFallback`**，不向上抛出，保证单个统计接口失败不影响整页。
- **构建期脚本对 IO/解析异常采用“记录警告 + 返回原值”的降级策略**，使 Hexo 构建不因某个可选功能失败而中断。
- **没有自定义 Error 子类、错误码枚举或全局错误中间件**；错误传播主要靠原生 `try/catch`、Promise `.catch()` 和 HTTP 状态码。
- **没有 `panic` / `recover` 概念**（非 Go 项目）；也没有 Express/Koa 等框架中间件层，错误处理内联在每个 handler 中。