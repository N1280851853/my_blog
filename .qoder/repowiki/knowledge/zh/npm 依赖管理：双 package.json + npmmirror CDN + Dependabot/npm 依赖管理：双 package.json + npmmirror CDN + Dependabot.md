---
kind: dependency_management
name: npm 依赖管理：双 package.json + npmmirror CDN + Dependabot
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - themes/fomalhaut/package.json
    - .github/dependabot.yml
    - _config.fomalhaut.yml
---

## 1. 使用的系统/方案

- **包管理器**：npm（由 `package.json` + `package-lock.json` 体现）。
- **Node 版本约束**：根 `package.json` 中声明 `engines.node >= 18`，Hexo 引擎锁定为 `hexo: ^6.2.0`，并通过 `hexo.version: "6.3.0"` 在站点元数据中标记实际版本。
- **CDN 策略**：运行时第三方库通过 `registry.npmmirror.com` 的 `/files/...` 路径直接引入（见 `_config.fomalhaut.yml` 中的 `cdn:` 配置段），而非在浏览器端再走 npm；构建期依赖则通过 npm 安装到 `node_modules`。
- **自动化升级**：GitHub Dependabot 已启用，按 `daily` 频率扫描根目录的 npm 生态，最多保留 20 个 PR。

## 2. 关键文件

- `package.json`：站点级依赖清单与脚本入口（`build`、`deploy:vercel`、`server` 等）。
- `themes/fomalhaut/package.json`：主题自身的轻量依赖（仅 `hexo-renderer-stylus`、`hexo-renderer-pug`），作为独立可发布包存在（含 `repository` / `bugs` / `homepage`）。
- `package-lock.json`：npm 锁文件，用于固定依赖树。
- `.github/dependabot.yml`：Dependabot 规则，仅对根目录 `/` 的 npm 生态生效。
- `_config.fomalhaut.yml`：集中声明前端运行时依赖的 npmmirror CDN 地址（如 `algolia_search_v4`、`twikoo`、`mathjax`、`aplayer_*`、`fontawesomeV6`、`jquery` 等）。

## 3. 架构与约定

- **双 package.json 分层**：
  - 根 `package.json` 持有 Hexo 渲染器、插件、gulp 后处理管线以及站点工具链的全部依赖。
  - `themes/fomalhaut/package.json` 只声明主题自身运行所需的 Hexo renderer 依赖，便于主题单独发布和复用。
- **依赖分类**：构建/渲染类依赖放在 `dependencies`（如 hexo、hexo-renderer-*、hexo-generator-*、hexo-deployer-git、gulp*、workbox-build），开发期 Babel/gulp 压缩相关放在 `devDependencies`。
- **私有/镜像包**：使用 scoped 包 `@upupming/hexo-renderer-markdown-it-plus`（fork 自官方 markdown-it-plus），表明项目维护了自有 npm 包以适配站点需求。
- **前端运行时依赖不通过 npm 分发**：jQuery (`jquery.min.js`)、Leaflet (`tag-map/leaflet-1.7.1.js`)、WinBox (`winbox.bundle.min.js`)、Algolia 搜索客户端等均以源码形式驻留在 `source/js/` 下，随站点静态资源一起发布，避免浏览器端再拉取 npm 包。
- **CDN 源统一**：所有外部 JS/CSS 均指向 `https://registry.npmmirror.com/<pkg>/<version>/files/...`，并在 `<head>` 中加入 `preconnect` 到 `registry.npmmirror.com`，以降低 DNS/TLS 握手开销。

## 4. 约定与约束

- **Node 版本要求**：`engines.node >= 18`（来源：根 `package.json`）。
- **Hexo 版本**：站点通过 `hexo.version: "6.3.0"` 显式记录实际版本，同时依赖范围 `hexo: ^6.2.0`（来源：根 `package.json`）。
- **依赖锁定**：使用 `package-lock.json` 固定依赖树，确保构建可重现。
- **自动更新**：Dependabot 每日检查根目录 npm 依赖变更，最多打开 20 个 PR（来源：`.github/dependabot.yml`）。
- **CDN 地址集中管理**：第三方前端库的 CDN URL 集中在 `_config.fomalhaut.yml` 的 `cdn:` 字段，新增/替换外部库时应在此处同步，而非散落在模板中。
- **无私有 npm registry 或 .npmrc**：仓库内未发现 `.npmrc`、`verdaccio` 或自定义 registry 配置；私有包 `@upupming/*` 通过 npm 默认公共注册表访问。
- **无 vendoring 策略**：除前端静态资源外，没有 `vendor/`、`lib/` 形式的后端依赖快照；所有 Node 依赖均通过 `node_modules` 安装。