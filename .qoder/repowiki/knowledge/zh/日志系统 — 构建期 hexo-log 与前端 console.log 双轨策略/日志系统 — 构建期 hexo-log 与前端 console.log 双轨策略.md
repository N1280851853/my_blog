---
kind: logging_system
name: 日志系统 — 构建期 hexo-log 与前端 console.log 双轨策略
category: logging_system
scope:
    - '**'
source_files:
    - themes/fomalhaut/scripts/events/welcome.js
    - scripts/gallery-pager.js
    - source/js/fomal.js
    - source/js/modules/console-art.js
    - source/js/inject/search-lazy.js
---

## 1. 使用的系统与框架

仓库没有引入第三方结构化日志库（如 winston、pino、bunyan）。日志输出分为两条互不相关的轨道：

- **Hexo 构建期**：使用 `hexo-log`，通过 `require('hexo-log')()` 获取 logger 实例，调用 `logger.info(...)` 输出。
- **浏览器运行期**：直接使用原生 `console.log / console.warn / console.error`，并通过 `source/js/fomal.js` 在启动时根据 URL 参数和 host 决定是否静音 `console.log`。

## 2. 关键文件

- `themes/fomalhaut/scripts/events/welcome.js`：主题初始化事件，使用 `hexo-log` 打印 ASCII 艺术字 + 版本信息。
- `scripts/gallery-pager.js`：站点级 Hexo generator，通过 `ctx.log.info` / `ctx.log.error` 输出分页统计与异常；同时兼容无 `ctx.log` 的环境（fallback 空对象）。
- `source/js/fomal.js`：站点主引导，集中实现控制台策略与模块自检。
- `source/js/modules/console-art.js`：控制台字符画，刻意用 `console.warn` 而非 `console.log` 输出，以绕过 fomal.js 的静音策略。
- `source/js/inject/search-lazy.js`、`source/js/census.js`、`source/js/gitcalendar.js` 等：业务脚本中散落的使用 `console.warn` / `console.error` 的错误上报点。

## 3. 架构与约定

### 3.1 构建期日志（Node / Hexo）

- 统一入口是 `hexo-log`。`welcome.js` 中 `const logger = require('hexo-log')()` 后直接调用 `logger.info(...)`，输出带分隔线的 ASCII 欢迎横幅。
- Generator 脚本（如 `gallery-pager.js`）通过 `ctx.log` 访问 Hexo 内置 logger，并做防御性降级：`const log = ctx.log || { info: function () {}, error: function () {} }`，保证在非 Hexo 环境（例如被 Node 直接 require 测试）不会抛错。
- 日志格式采用模板字符串 + `%s` 占位符（`ctx.log.info('gallery-pager: %s -> %d 页...', ...)`），属于 hexo-log 的原生格式化语法。

### 3.2 浏览器期日志（Console API）

`fomal.js` 在模块加载早期执行以下策略：

```js
var FOMAL_DEBUG = /[?&]debug=1(&|$)/.test(location.search)
  || location.hostname === "localhost" || location.hostname === "127.0.0.1";
if (!FOMAL_DEBUG) {
  console.log = function () { };
}
```

规则要点：

- 仅覆盖 `console.log`，`console.error` 与 `console.warn` **永远保留**。注释明确说明原因：关闭 error/warn 会导致 pjax 换页失败等异常彻底静默，无法排查。
- 调试模式由三个条件触发：URL 含 `?debug=1`、host 为 `localhost`、host 为 `127.0.0.1`。
- `modules/console-art.js` 中的字符画通过 `console.warn.bind(console, ...)` 输出，正是为了绕过上述静音逻辑。
- 自检结果在 debug 模式下分别走 `console.log("%c[fomal] 站点脚本自检通过 ...")` 与 `console.error("[fomal] 自检发现缺失 ...")`，错误路径始终可见。

### 3.3 模块自检作为“自诊断日志”

`window.__fomal.check()` 会遍历一组受保护的全局入口名（`changeMouseMode`、`share`、`switchNightMode` 等）和各模块应暴露的代表性全局名，收集缺失项并以 `{ ok, missing }` 结构返回。该检查仅在 `load` 事件且 `FOMAL_DEBUG` 为真时执行一次，避免干扰正常用户。

## 4. 约定与约束

- **构建期**：新增 Hexo 生成器或事件脚本应通过 `ctx.log` 或 `require('hexo-log')()` 输出日志，不要直接 `console.log`（产物不会被部署到浏览器）。
- **浏览器期**：所有可恢复的运行时错误应走 `console.error`，警告类信息走 `console.warn`；普通调试信息走 `console.log`，但会被生产环境自动静音。
- 若需要在前端显示调试信息（如字符画、自检报告），应显式使用 `console.warn` 或 `console.error`，因为 `console.log` 已被覆盖。
- 非 Hexo 环境下调用 generator 时，`ctx.log` 可能不存在，需按 `gallery-pager.js` 的模式提供空实现 fallback。
- 控制台输出前缀约定：业务脚本使用 `[search-lazy]`、`[fomal]` 等方括号前缀区分来源（见 `search-lazy.js`、`fomal.js`），便于在大量输出中定位。
- 未观察到统一的日志级别配置、结构化字段（如 timestamp、pid、traceId）或外部 sink（文件、远端采集）——日志仅输出到 Node 标准输出与浏览器 DevTools Console。