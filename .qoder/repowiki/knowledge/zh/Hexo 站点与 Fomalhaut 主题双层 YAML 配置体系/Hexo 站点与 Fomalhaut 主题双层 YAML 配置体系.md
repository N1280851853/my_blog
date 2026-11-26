---
kind: configuration_system
name: Hexo 站点与 Fomalhaut 主题双层 YAML 配置体系
category: configuration_system
scope:
    - '**'
source_files:
    - _config.yml
    - _config.fomalhaut.yml
    - themes/fomalhaut/_config.yml
    - source/_data/link.yml
    - source/_data/widget.yml
    - vercel.json
---

## 1. 使用的系统与框架

本仓库是一个基于 **Hexo** 静态博客 + **hexo-theme-fomalhaut**（基于 Butterfly）的站点工程，配置系统完全由 Hexo 的标准机制驱动：
- 站点级配置：根目录 `_config.yml`
- 主题覆盖配置：根目录 `_config.fomalhaut.yml`（Hexo 支持以 `<theme>.yml` 命名的站点级覆盖文件，会合并到主题的 `_config.yml`）
- 主题默认配置：`themes/fomalhaut/_config.yml`
- 数据文件：`source/_data/*.yml`（供模板标签读取）
- 部署/运行时配置：`vercel.json`、`package.json`、`gulpfile.js`

没有使用 `.env`、环境变量注入或第三方配置库；所有配置均为纯 YAML 文本。

## 2. 关键文件

| 文件 | 职责 |
|---|---|
| `_config.yml` | Hexo 站点元信息、URL、permalink、插件、Algolia、gitcalendar、magnet 等站点级开关 |
| `_config.fomalhaut.yml` | 用户层对 Fomalhaut 主题的覆盖：导航菜单、社交链接、主题色 `theme_color`、背景、侧栏 widget、评论系统等 |
| `themes/fomalhaut/_config.yml` | Fomalhaut/Butterfly 主题的默认配置（被站点覆盖文件合并） |
| `source/_data/link.yml` | 友人帐页面数据源，被 `{% flink %}` 标签读取 |
| `source/_data/widget.yml` | 自定义侧栏卡片（日历、倒计时）的声明式配置 |
| `vercel.json` | Vercel Serverless Function 的运行时限制（maxDuration/memory）与区域 |
| `package.json` / `gulpfile.js` | 构建期依赖与产物后处理脚本入口 |

## 3. 架构与约定

### 3.1 两层 YAML 覆盖模型

Hexo 在加载配置时按以下顺序合并（后者覆盖前者）：

```
themes/fomalhaut/_config.yml   ← 主题默认值
_config.fomalhaut.yml           ← 站点对主题的覆盖
_config.yml                     ← 站点自身配置（含 theme: fomalhaut）
```

因此 `_config.fomalhaut.yml` 是“用户可编辑的主题外观/行为开关”的主入口，而 `_config.yml` 负责 Hexo 核心行为（URL、插件、部署）。这一分层在两个文件中大量重复字段（如 `comments`、`mathjax`、`social`、`aside`）得到印证：主题默认值在 `themes/fomalhaut/_config.yml`，站点覆盖在 `_config.fomalhaut.yml`。

### 3.2 功能开关（Feature Flags）模式

绝大多数特性通过布尔开关控制，统一采用 `xxx.enable` 形式：
- 站点级：`gitcalendar.enable`、`swiper.enable`、`magnet.enable`、`markdown.anchors.level`、`highlight.enable`、`prismjs.enable`、`render_drafts`、`future` 等
- 主题级：`beautify.enable`、`darkmode.enable`、`preloader.enable`、`pjax.enable`、`lazyload.enable`、`instantpage`、`Open_Graph_meta`、`css_prefix` 等

这些开关由主题 Pug 模板和前端 JS 模块在渲染/运行期读取，形成“配置即开关”的约定。

### 3.3 数据与配置分离

`source/_data/` 存放“内容型数据”，而非“行为配置”：
- `link.yml`：友链列表，结构为 `class_name` / `class_desc` / `link_list[]`（每项含 `name`、`link`、`avatar`、`descr`、`siteshot`）
- `widget.yml`：侧栏卡片声明，区分 `top`（非 sticky 区）和 `bottom`（sticky 区），每张卡含 `class_name`、`id_name`、`name`、`icon`、`html`（内嵌 `<link>`/`<script>`）

注释明确说明：`widget.yml` 中的 HTML 片段会被主题 widget 模板渲染，且 `js/aside-calendar.js` 的 `layoutCards()` 负责保证两张卡的稳定顺序。

### 3.4 主题色与 CSS 变量联动

`_config.fomalhaut.yml` 中 `theme_color.*` 字段（`main`、`link_color`、`meta_color`、`hr_color`、`code_foreground/background`、`toc_color`、`blockquote_*`、`scrollbar_color`、`meta_theme_color_light/dark`）直接映射到 CSS 变量（如 `--theme-color`、`--text-bg-hover`），由主题样式表消费。注释强调“color value must in double quotes like '#000' or may cause error!”——这是主题代码强制的格式约束。

### 3.5 运行时配置（前端 JS 模块）

前端行为由 `source/js/modules/` 下的独立模块管理，每个模块对应一个功能开关：
- `appearance-backgrounds.js`、`appearance-fonts.js`、`fireflies.js`、`snow.js`、`cursor.js`、`effects.js`、`nav.js`、`reading.js`、`ripple.js`、`settings.js`、`footer-time.js` 等
- 模块通过 `localStorage` 持久化用户偏好（如 `localStorage.codeFont`、`localStorage.themeColor`），并在 `DOMContentLoaded` 或 pjax 事件后初始化
- 测试套件位于 `tools/tests/`，每个模块对应一个 `*.test.cjs`（基于 Node `node:test`），验证模块的初始化逻辑与开关行为

### 3.6 部署与环境配置

- `vercel.json`：仅配置 Serverless Function 的 `maxDuration`、`memory` 与部署区域 `hkg1`，不含业务密钥
- `api/chat/completions.js` 与 `functions/api/chat/completions.js` 为同一函数的双份（分别用于 Hexo server 本地代理与 Vercel 部署）
- 无 `.env` 文件；Algolia 密钥以占位符形式写在 `_config.yml` 中（`YOUR_ALGOLIA_APP_ID` 等），属于“待替换的模板值”而非真正的 secrets 管理

## 4. 约定与约束

- **配置分层约定**：站点行为改 `_config.yml`，主题外观/行为改 `_config.fomalhaut.yml`，主题默认值不动 `themes/fomalhaut/_config.yml`。该约定由 Hexo 的 `<theme>.yml` 覆盖机制强制执行。
- **颜色值必须加引号**：`_config.fomalhaut.yml` 中 `theme_color` 段注释明确要求 “color value must in double quotes like '#000' or may cause error!”，否则 YAML 解析或主题样式生成会出错。
- **跳过渲染的文件需显式声明**：`_config.yml` 的 `skip_render` 列表用于告诉 Hexo 不要对指定路径执行 Nunjucks 渲染（如 `js/tag-map/*`、`js/ai-chat.js`、`box/astronomy/voyager.html`），因为它们是完整的前端资源。
- **Widget 顺序由 JS 保证**：`source/_data/widget.yml` 的注释说明，日历卡和倒计时卡的 DOM 顺序由 `/js/aside-calendar.js` 的 `layoutCards()` 统一维护，避免 pjax 换页导致顺序错乱。
- **功能开关统一命名**：所有可选特性遵循 `xxx.enable` 布尔开关模式，便于模板条件渲染。
- **Vercel Function 超时与内存**：`vercel.json` 将 `api/chat/completions.js` 的 `maxDuration` 设为 60 秒、`memory` 设为 512 MB，并限定区域 `hkg1`。
- **Front Matter 作为文章级配置**：文章通过 YAML Front Matter（`scaffolds/post.md`、`page.md`、`draft.md` 提供模板）设置 `title`、`date`、`category`、`tags`、`mathjax` 等文章级开关。

## 5. 未发现的机制

- 未发现 `.env`、`dotenv`、`process.env` 读取、环境变量注入、远程配置中心、A/B 实验平台等运行时配置系统。
- 未发现 schema 校验、配置迁移脚本或配置 lint 规则。
- 未发现多环境（dev/staging/prod）配置分支，所有差异通过 Git 分支与 Vercel 部署目标管理。