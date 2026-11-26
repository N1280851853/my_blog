---
kind: build_system
name: Hexo + Gulp + Vercel 站点构建与部署管线
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - gulpfile.js
    - vercel.json
    - tools/deploy-vercel.js
    - _config.yml
    - _config.fomalhaut.yml
    - themes/fomalhaut/_config.yml
    - scaffolds/post.md
    - scaffolds/page.md
    - scaffolds/draft.md
    - .github/dependabot.yml
---

## 1. 整体方案

本仓库是一个基于 Hexo 的静态博客站点，构建链路为：

```
Markdown/模板 → hexo generate → public/ 产物 → gulp 压缩 → (可选) tools/qoder-static-links.js → 部署到 Vercel
```

- **渲染引擎**：Hexo 6.x（`package.json` 中 `hexo: { version: "6.3.0" }`），主题采用 `hexo-theme-fomalhaut`（位于 `themes/fomalhaut/`），同时依赖 `hexo-theme-volantis`、Pug/Stylus/Markdown-it 等渲染器。
- **后处理**：Gulp 4 在 `gulpfile.js` 中定义三个任务：`compress`（terser 压缩 JS）、`minify-css`（clean-css 压缩 CSS，排除含 `@container` 的 `site-inject.css` 与 `twikoo.css`）、`minify-html`（htmlclean + html-minifier-terser）。默认任务并行执行三者。
- **部署目标**：Vercel（`vercel.json` 指定 region `hkg1`，并将 `api/chat/completions.js` 声明为函数，`maxDuration: 60`，`memory: 512`）。
- **Node 版本约束**：`engines.node >= 18`。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `package.json` | npm scripts（`build` / `clean` / `deploy` / `deploy:vercel` / `server`）、Hexo 插件与依赖清单 |
| `gulpfile.js` | 产物压缩流水线（JS/CSS/HTML） |
| `vercel.json` | Vercel 函数与区域配置 |
| `tools/deploy-vercel.js` | 一键代理模式部署脚本（注入 `DEEPSEEK_API_KEY`） |
| `tools/qoder-static-links.js` | build 末尾替换 CDN 链接为本地路径 |
| `_config.yml` / `_config.fomalhaut.yml` | Hexo 站点与主题配置 |
| `themes/fomalhaut/_config.yml` | Fomalhaut 主题配置 |
| `scaffolds/*.md` | Hexo 脚手架模板（post/page/draft） |
| `.github/dependabot.yml` | Dependabot 依赖更新配置 |
| `scripts/*` | Hexo 站点级脚本（被 Hexo 作为插件加载，见下方约定） |

## 3. 架构与约定

### 3.1 构建脚本分层

- `package.json#scripts` 暴露顶层命令：
  - `npm run build` = `hexo generate && node tools/qoder-static-links.js`（生成 + 静态链接修正）。
  - `npm run server` = `hexo server`（本地预览）。
  - `npm run deploy` = `hexo deploy`（走 Hexo 内置 git 部署器）。
  - `npm run deploy:vercel` = `node tools/deploy-vercel.js`（代理模式一键部署）。
- `gulpfile.js` 通过 `gulp default` 提供独立的压缩任务，但当前 `package.json` 未将其纳入 `build` 流程；需手动运行 `gulp`。注释明确说明 `compress` 必须 `return` stream，否则 terser 未完成时 Gulp 会提前退出。
- `tools/deploy-vercel.js` 是独立 CLI（`#!/usr/bin/env node`），从以下优先级读取 API Key：`process.env.DEEPSEEK_API_KEY` → 站点根 `.ai-chat-key` → `_config.fomalhaut.yml` 中 `ai_chat.api_key`（仅接受以 `sk-` 开头的值）。找不到 key 时直接 `process.exit(1)`。找到后以 `spawnSync('hexo', ['clean'|'generate'|'deploy'], { env })` 顺序执行三步，任一失败即中止。

### 3.2 为什么 `tools/` 而非 `scripts/`

`tools/deploy-vercel.js` 顶部注释明确解释：Hexo 会把 `scripts/` 下所有顶层代码当作插件加载（`hexo/lib/hexo/load_plugins.js`），对任何命令都生效；该脚本包含 `process.exit` / `spawnSync`，若放在 `scripts/` 会在 CI 或本机触发意外行为。因此放在 `tools/` 并通过 `require.main !== module` 防御检查，确保只有直接 `node tools/deploy-vercel.js` 时才执行。

### 3.3 产物目录结构

- 源码：`source/`（Markdown 文章、`_data/`、`css/`、`js/`、`box/` 等页面）。
- 构建产物：`public/`（由 Hexo 生成，Gulp 在此目录上二次压缩）。
- 主题源码：`themes/fomalhaut/`（Pug 模板、Stylus 样式、Hexo 主题脚本 `scripts/events|filters|helpers|tag/`）。
- 站点级补丁脚本：`scripts/`（如 `archive-index.js`、`swiper-lazyload-fix.js`、`wow-pjax-rehook.js` 等，被 Hexo 作为插件加载）。
- 工具脚本：`tools/`（部署、测试、Qoder 静态链接修复）。

### 3.4 前端模块测试

`tools/tests/` 下使用 Node 内置 `node:test`（`.test.cjs` 后缀）对前端模块进行行为测试（如 `appearance-backgrounds.test.cjs`、`fireflies.test.cjs`、`sw-cache.test.cjs` 等）。这些测试不依赖浏览器，而是通过模拟 DOM/API 验证模块逻辑。

## 4. 约定与约束

- **Node 版本**：`package.json#engines.node >= 18`，这是硬性要求（npm install 时会校验）。
- **Hexo 版本**：`package.json#hexo.version = "6.3.0"`，锁定站点使用的 Hexo 主版本。
- **构建入口**：标准构建走 `npm run build`（`hexo generate && node tools/qoder-static-links.js`），不包含 Gulp 压缩；如需压缩需单独执行 `gulp`。
- **API Key 安全**：`tools/deploy-vercel.js` 强制要求存在有效的 `DEEPSEEK_API_KEY`（环境变量、`.ai-chat-key` 或 `_config.fomalhaut.yml` 中的 `sk-*`），否则直接退出；key 不会写入 HTML，仅注入函数环境变量，页面走 `/api` 同源代理。
- **CSS 容器查询保护**：`gulpfile.js` 显式排除 `site-inject.css` 与 `twikoo.css` 不被 clean-css 压缩，因为 clean-css 0.x 会误删 `@container` 包裹的规则（注释记录了 2026-10-04 的排查过程）。
- **JS 压缩流契约**：`gulpfile.js` 注释强调 `compress` 任务必须 `return` stream，否则 Gulp 可能在 terser 完成前退出，导致结果“时有时无”。
- **部署区域**：`vercel.json` 固定 region 为 `hkg1`。
- **函数超时与内存**：`vercel.json` 将 `api/chat/completions.js` 设为 60s 超时、512MB 内存。
- **依赖管理**：使用 npm（`package-lock.json` 存在），无 Makefile/Dockerfile；CI 依赖由 `.github/dependabot.yml` 驱动自动 PR。
- **脚手架命名**：`scaffolds/post.md` / `page.md` / `draft.md` 使用 `{{ title }}` / `{{ date }}` 占位符，遵循 Hexo 脚手架约定。