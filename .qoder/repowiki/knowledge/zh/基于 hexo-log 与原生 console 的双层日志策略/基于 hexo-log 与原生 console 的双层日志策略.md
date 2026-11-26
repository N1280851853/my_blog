---
kind: logging_system
name: 基于 hexo-log 与原生 console 的双层日志策略
category: logging_system
scope:
    - '**'
source_files:
    - themes/fomalhaut/scripts/events/init.js
    - themes/fomalhaut/scripts/events/welcome.js
    - source/js/fomal.js
    - source/js/modules/console-art.js
    - source/js/inject/ping-route.js
    - source/js/inject/search-lazy.js
---

## 1. 使用的系统/方案

本仓库没有引入第三方结构化日志框架（winston、bunyan、pino、morgan 等均未出现）。日志体系由两部分组成：

- **Hexo 构建期**：主题 `themes/fomalhaut/scripts/events/` 下的 Node 脚本统一通过 `require('hexo-log')()` 获取 logger，使用 `logger.info` / `logger.error` 输出。
- **浏览器运行期**：站点前端 JS 不使用任何日志库，直接调用 `console.log` / `console.warn` / `console.error`；并通过 `source/js/fomal.js` 在启动时根据 `?debug=1`、`localhost`、`127.0.0.1` 决定是否静音 `console.log`。

## 2. 关键文件

- `themes/fomalhaut/scripts/events/init.js` — 在 `before_generate` 钩子中用 `hexo-log` 校验 Hexo 版本并拒绝旧配置。
- `themes/fomalhaut/scripts/events/welcome.js` — 在 `ready` 事件中用 `hexo-log` 打印 ASCII 艺术字和主题版本信息。
- `source/js/fomal.js` — 控制台策略入口：定义 `FOMAL_DEBUG`、重写 `console.log`、挂载 `window.__fomal` 自检。
- `source/js/modules/console-art.js` — 字符画模块，注释明确说明“用 `console.warn` 而非 log，避免被下面的策略静音”。
- `source/js/inject/ping-route.js`、`source/js/inject/search-lazy.js`、`source/js/census.js`、`source/js/gitcalendar.js` 等 — 业务脚本直接使用 `console.log/warn/error` 做运行时诊断。

## 3. 架构与约定

### 构建期（Node）
- 所有主题事件脚本统一 `const logger = require('hexo-log')()` 实例化，不自行封装 logger。
- 仅使用两个级别：`logger.info`（欢迎信息）、`logger.error`（版本不兼容 / 弃用配置），没有 `warn` / `debug` 的用法。
- 严重错误（如 Hexo 版本 < 5.3、检测到已弃用的 `butterfly.yml`）在 `logger.error` 之后立即 `process.exit(-1)`，把构建失败作为硬约束。

### 运行期（浏览器）
- 默认关闭 `console.log`，保留 `console.error` 与 `console.warn`。开关逻辑集中在 `fomal.js`：
  - `FOMAL_DEBUG = /[?&]debug=1(&|$)/.test(location.search) || location.hostname === "localhost" || location.hostname === "127.0.0.1"`
  - 非调试模式执行 `console.log = function () {};`。
- 需要绕过静音策略的输出（例如 `console-art.js` 的 ASCII 字符画）显式改用 `console.warn`，并在注释中解释原因。
- 调试模式下的自检结果通过 `window.__fomal.check()` 返回 `{ version, ok, missing }`，并在 `load` 事件中以带 `%c` 样式的前缀 `[fomal]` 输出。

## 4. 约定与约束

- **构建期日志来源单一**：主题事件脚本统一通过 `hexo-log`，未见其他日志库或自定义 logger 封装（证据：grep 搜索 `winston|bunyan|pino|log4j|morgan` 无匹配）。
- **构建期只使用 info / error 两级**：`init.js` 与 `welcome.js` 中仅出现这两个方法，未观察到 `warn` / `debug` 的使用。
- **严重构建错误必须终止进程**：`init.js` 在 `logger.error` 后紧跟 `process.exit(-1)`，这是可验证的强制行为。
- **生产环境禁止普通 console.log**：`fomal.js` 在非 `FOMAL_DEBUG` 下直接覆盖 `console.log`，使业务代码中的 `console.log` 静默；该策略是仓库内唯一的全局 console 拦截点。
- **需要可见输出的场景应使用 warn / error**：`console-art.js` 的注释明确说明“用 console.warn 而非 log，避免被下面的策略静音”，构成一条跨模块约定。
- **调试开关三源合一**：`?debug=1` 查询参数、`localhost`、`127.0.0.1` 任一命中即开启调试模式，供 `fomal.js` 自检与 `ping-route.js` 等脚本判断是否输出日志。
- **无结构化字段、无分级路由、无持久化 sink**：日志以纯文本形式输出到 Node 标准输出或浏览器控制台，不存在统一的字段 schema、日志级别枚举、按级别分流或文件落盘逻辑。