---
kind: frontend_style
name: Fomalhaut Hexo 站点前端样式体系（Stylus + CSS 变量 + 站点注入层）
category: frontend_style
scope:
    - '**'
source_files:
    - themes/fomalhaut/source/css/index.styl
    - themes/fomalhaut/source/css/var.styl
    - themes/fomalhaut/source/css/_global/index.styl
    - source/css/site-inject.css
    - source/css/paperclip.css
    - source/css/navigation.css
    - source/css/mobile-drawer.css
    - themes/fomalhaut/source/css/_mode/darkmode.styl
    - themes/fomalhaut/source/css/_layout/sun_moon.styl
---

## 1. 使用的系统/方法

- **主题引擎**：基于 `hexo-theme-fomalhaut`（Pug 模板 + Stylus 样式），站点源码位于 `themes/fomalhaut/source/css/`。
- **样式预处理器**：Stylus（通过 Hexo 的 stylus 插件编译），入口为 `themes/fomalhaut/source/css/index.styl`，使用 `@import '_global/*'`、`'_layout/*'`、`'_page/*'`、`'_tags/*'`、`'_mode/*'` 等目录分块。
- **设计令牌**：双轨制——
  - Stylus 层：`themes/fomalhaut/source/css/var.styl` 定义 `$bright-blue` / `$theme-color` / `$font-family` / `$card-bg` / `$note-*` / `$color-types` 等 Stylus 变量，并通过 `hexo-config('...')` 读取 `_config.fomalhaut.yml` 中的用户配置（如 `theme_color.main`、`font.font-family`、`background.default`、`beautify.enable`、`preloader.load_color` 等）。
  - CSS 运行时层：`_global/index.styl` 把 Stylus 变量映射到 `:root` 下的 CSS 自定义属性（`--global-font-size`、`--font-color`、`--card-bg`、`--btn-bg`、`--scrollbar-color` 等），供业务 CSS 与 JS 在运行时读写。
- **站点级覆盖层**：`source/css/site-inject.css`（1020 行）是站点作者从 `_config.fomalhaut.yml` 的 `inject.head` 段抽出的纯 CSS 文件，集中覆盖主题默认值而不改动主题源码。注释明确标注“本文件由 _config.fomalhaut.yml 的 inject.head 段抽出……配置里只留一行 <link>”，并编号 17 个区块，按从上到下的层叠顺序维护。
- **响应式策略**：以传统 `@media screen and (min-width/max-width)` 为主（901px、1200px、1400px、768px、600px、480px 等断点），同时大量使用现代特性：`@container` 容器查询（公告栏 `.card-announcement`、小站资讯卡 `.card-webinfo`、设置面板 `.settings`）、`:has()` 选择器（`.layout:has(#page)`、`.search-wrap:has(.search-history:not([hidden]))`）、`color-mix()` 做主题色派生、`@property --dm-r` 做 CSS Houdini 动画。
- **主题色机制**：默认主色 `$bright-blue = #49B1F5`，可通过 `theme_color.main` 覆盖；站点额外提供十色预设（`--color-orange` / `--color-yellow` / `--color-matcha` / `--color-blue` / `--color-heoblue` / `--color-darkblue` / `--color-puregreen` / `--color-pink` / `--color-purple` / `--color-red`）和彩虹选择器，JS 根据亮度计算 `--on-theme`（白底上的前景色）解决 WCAG AA 对比度问题。
- **昼夜模式**：通过 `[data-theme="dark"]` 选择器切换，配合 `prefers-reduced-motion` 降级；昼夜切换动画集中在 `site-inject.css` 的 `#darkModeSpeed` 与 `#darkModeStage` 两个区块，使用 CSS 变量 `--dm-k` 统一缩放时长。

## 2. 关键文件

- `themes/fomalhaut/source/css/index.styl` — Stylus 入口，条件导入搜索、灯笼等可选模块。
- `themes/fomalhaut/source/css/var.styl` — 全部设计令牌（颜色、字体、字号、Note/Button/Tab/Timeline 标签样式变量）。
- `themes/fomalhaut/source/css/_global/index.styl` — 将 Stylus 变量映射为 `:root` CSS 变量，定义 body/h1-h6/a/button 基础样式。
- `themes/fomalhaut/source/css/_layout/*.styl`、`_page/*.styl`、`_tags/*.styl`、`_mode/darkmode.styl`、`_custom/custom.css` — 主题主体样式。
- `source/css/site-inject.css` — 站点级样式覆盖层（公告栏、版权卡片、侧栏宽度、FPS 状态条、涟漪、萤火虫、昼夜切换舞台、搜索历史等）。
- `source/css/paperclip.css`、`avatar-glow.css`、`navigation.css`、`mobile-drawer.css`、`twikoo.css` 等 — 各功能独立 CSS 文件。
- `themes/fomalhaut/source/css/_load_style/*.styl` — 多种加载动画主题（default/gear/heo/ironheart/scarecrow/spincat/triangles/wizard/image）。

## 3. 架构与约定

- **两层样式源分离**：主题源码（`themes/fomalhaut/source/css/`）保持上游可升级；站点定制全部放在 `source/css/` 下，尤其是 `site-inject.css` 作为唯一“覆盖主题”的入口。
- **变量命名约定**：Stylus 变量用 `$kebab-case`（`$theme-color`、`$button-hover-color`），CSS 变量用 `--kebab-case`（`--theme-color`、`--btn-hover-color`、`--on-theme`、`--fps-good` 等语义化前缀）。
- **模块化组织**：Stylus 按职责分目录（`_global`、`_layout`、`_page`、`_tags`、`_mode`、`_highlight`、`_search`、`_third-party`、`_custom`），每个目录内一个 `index.styl` 聚合子文件。
- **条件编译**：所有可开关特性（algolia/local_search、lantern、hr_icon、beautify、lazyload、preloader、fireworks.zIndex 等）都通过 `hexo-config(...)` 在构建期决定是否生成对应 CSS。
- **运行时主题色派生**：业务 CSS 优先使用 `color-mix(in srgb, var(--theme-color), ...)` 而非硬编码衍生色，并在不支持时保留上一行回退值（见 site-inject.css 中反复出现的“第一行是不支持 color-mix() 的老浏览器回退值”注释）。
- **性能优先的动画**：对已知热点（首页箭头 `.recent-post-arrow`、置顶角标 `.post-sticky-shine`、作者卡 `backdrop-filter`）在 `site-inject.css` 中重写为 `transform` 合成层动画或禁用 `backdrop-filter`，注释详细记录原因为何避免布局抖动。

## 4. 约定与约束

- **不直接改主题源码**：站点级样式一律放在 `source/css/site-inject.css`，主题源码 `themes/fomalhaut/` 不被修改；每次覆盖都有“回滚：删掉本块即可”的注释说明（例如 readModeIconGuard、letterBoard、cardAnimPerf、loadingIdle、cardGlassOff 等区块）。
- **层叠顺序即文档**：`site-inject.css` 顶部注释声明“层叠顺序 = 本文件从上到下的顺序，与抽取前完全一致，不要随意重排”，区块编号 1–17 对应原 YAML 中的位置，新增区块必须追加到末尾。
- **运行时空槽不可动**：配置里 `<style id="themeColor">`、`#rightSide`、`#transPercent`、`#bgFilterParam`、`#defineBg`、`#menu_shadow`、`#nav-display`、`#aside-show`、`#aside-pos` 等由右下角美化面板 JS 运行时写入内容，注释明确“不能删、不能挪”。
- **主题色对比度兜底**：十色预设中只有紫罗兰的白字过 WCAG AA，因此站点引入 `--on-theme`（由 JS 按主题色亮度计算近黑或纯白），并把按钮、选中文字、TOC 当前项、作者卡按钮等写死 `#fff` 的地方统一接到 `var(--on-theme)`。
- **减少动态效果兼容**：多处使用 `@media (prefers-reduced-motion: reduce)` 关闭动画（昼夜切换、涟漪、萤火虫、雪花、设置面板交互），与 JS 侧逻辑对齐。
- **容器查询优先于媒体查询**：公告栏、小站资讯卡、设置面板等组件内部使用 `@container (max-width: ...)` 做自适应，保证组件在不同父容器宽度下自洽，不依赖全局断点。
- **Stylus 变量 → CSS 变量映射是单一出口**：所有对外暴露给业务 CSS 的值都必须经过 `_global/index.styl` 的 `:root` 映射，禁止在业务 CSS 中直接引用 Stylus 变量名。