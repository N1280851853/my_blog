---
kind: configuration_system
name: Hexo 站点与 Fomalhaut 主题的双层 YAML 配置体系
category: configuration_system
scope:
    - '**'
source_files:
    - _config.yml
    - _config.fomalhaut.yml
    - themes/fomalhaut/_config.yml
    - source/_data/link.yml
    - source/_data/widget.yml
---

## 1. 采用的系统/方法

本仓库是一个基于 Hexo + hexo-theme-fomalhaut（继承自 Butterfly）的静态博客站点，配置完全通过 **YAML 文件** 声明式管理，没有自定义的配置加载框架、环境变量注入或运行时配置合并逻辑。配置分为两层：

- **站点级配置** `_config.yml`：由 Hexo 核心解析，定义站点元信息、URL/permalink、插件（algolia、feed、sitemap、gitcalendar、magnet 等）、部署目标。
- **主题级配置** `themes/fomalhaut/_config.yml`：Fomalhaut/Butterfly 主题的默认配置，包含导航、评论系统、CDN、侧边栏卡片、深色模式、美化效果等全部 UI 行为开关。
- **站点覆盖配置** `_config.fomalhaut.yml`：位于站点根目录，按 Butterfly/Fomalhaut 约定覆盖主题默认值，是本次仓库对主题配置的主要定制入口。

此外，`source/_data/link.yml` 与 `source/_data/widget.yml` 作为 Hexo data 数据源，被模板在渲染阶段读取，用于友链和侧栏 widget 的数据配置。

## 2. 关键文件

- `_config.yml` — Hexo 站点主配置（319 行），定义 site、url/permalink、abbrlink、skip_render、highlight/prismjs、mathjax、aplayer、index/archive_generator、pagination、theme、deploy、algolia、swiper、search、feed/sitemap/baidusitemap、baidu_url_submit、nofollow、gitcalendar、plugins、magnet、markdown anchors 等。
- `_config.fomalhaut.yml` — 站点对 Fomalhaut 主题的覆盖配置（1588 行），覆盖 menu、highlight_theme、social、algolia_search/local_search、mathjax、avatar/index_img/default_top_img/tag_per_img/category_per_img/cover、error_404、post_meta、wordcount、index_post_content、toc、post_copyright、reward、related_post、sharejs/addThis/addtoany、comments（Twikoo 为主）、footer、analytics、google_adsense、site_verification、theme_color、background、enter_transitions、canvas_* 系列特效、display_mode、beautify、font、subtitle、preloader、aside 各 card、busuanzi、runtimeshow、translate/readmode/darkmode/rightside_item_order、medium_zoom/fancybox、mermaid/note/pjax/aplayerInject/snackbar/instantpage/pangu/lazyload/PWA/Open_Graph/css_prefix/inject/CDN 等。
- `themes/fomalhaut/_config.yml` — 主题默认配置（918 行），提供所有可覆盖项的骨架与注释说明。
- `source/_data/link.yml`、`source/_data/widget.yml` — Hexo data 数据文件，供模板渲染时读取。
- `vercel.json` — Vercel 部署时的路由/函数配置（非应用运行期配置）。

## 3. 架构与约定

- **双层 YAML 覆盖模型**：Hexo 先加载站点 `_config.yml`，再加载主题 `themes/fomalhaut/_config.yml`；站点根下的 `_config.fomalhaut.yml` 作为主题覆盖层，遵循 Butterfly/Fomalhaut 约定的同名 key 覆盖机制。主题默认值在 `themes/fomalhaut/_config.yml` 中保留，实际生效值在 `_config.fomalhaut.yml` 中修改。
- **功能开关统一为 `enable: true/false` 布尔字段**：几乎所有特性（如 `reward.enable`、`gitcalendar.enable`、`swipe.enable`、`local_search.enable`、`darkmode.enable`、`pjax.enable`、`lazyload.enable` 等）都以 `enable` 字段控制是否启用，便于用户按需裁剪。
- **第三方服务配置集中放置**：Algolia、Twikoo、Valine、Waline、Giscus、Utterances、DisqusJS、Baidu Analytics、Google Analytics、CNZZ、Cloudflare Analytics、Microsoft Clarity、Google Adsense 等外部服务的 appId/apiKey/envId 等凭据以独立子对象形式集中在对应 section（如 `algolia:`、`twikoo:`、`disqusjs:`、`baidu_analytics:` 等），便于审计与替换。
- **CDN 来源集中管理**：主题通过 `CDN.internal_provider` / `CDN.third_party_provider` / `CDN.version` / `CDN.custom_format` / `CDN.option.*` 统一管理内部脚本与第三方库的 CDN 地址，支持 local/jsdelivr/unpkg/cdnjs/custom 五种 provider。
- **前端运行时变量由构建期注入**：部分前端行为（如背景图、主题色 CSS 变量 `--default-bg`、`--theme-color`）由 Hexo 模板在渲染时从 YAML 配置注入到 HTML/CSS，而非浏览器端读取环境变量。
- **无运行时配置加载器**：仓库中没有 Node.js 配置文件（如 `config.js`、`.env`、`config.ts`），也没有自定义的 config loader；所有“配置”都是构建期静态 YAML。

## 4. 约定与约束

- **站点与主题配置分离**：站点级设置放在 `_config.yml`，主题外观/行为设置放在 `_config.fomalhaut.yml`，主题默认值保留在 `themes/fomalhaut/_config.yml` 不被直接修改（覆盖方式）。这是 Butterfly/Fomalhaut 主题的官方约定，由主题自身在渲染时按此顺序加载。
- **颜色值必须用双引号包裹**：主题配置文件中明确注释 `# Notice: color value must in double quotes like "#000" or may cause error!`，例如 `theme_color.main`、`theme_color.link_color` 等字段均以 `"#a591e0"` 形式书写，否则 YAML 解析或后续 CSS 注入会出错。
- **第三方服务密钥不得硬编码进仓库**：多处占位符（如 `YOUR_ALGOLIA_APP_ID`、`YOUR_ALGOLIA_SEARCH_KEY`、`YOUR_BAIDU_TOKEN`、`https://comment.example.com`、`yourname` 等）表明这些值应在部署环境或 CI 中注入，不应提交真实凭据。
- **`skip_render` 白名单用于跳过 Nunjucks 渲染**：`_config.yml` 中通过 `skip_render` 指定 `js/tag-map/*`、`js/ai-chat.js`、`box/astronomy/voyager.html` 等文件原样复制到 public，不进行模板渲染，避免大段 JS/CSS 字面量被 Hexo 处理。
- **Git 部署分支固定为 main**：`_config.yml` 的 deploy.git 配置中 `branch: main`，且 GitHub Actions/Dependabot 也围绕 main 分支工作。
- **语言与时间区**：`language: zh-CN`，`timezone: ""`（空字符串表示使用本地时区），`date_format: YYYY-MM-DD`，`time_format: HH:mm:ss`，`updated_option: "mtime"`。
- **文章 URL 生成规则**：`permalink: posts/:abbrlink.html`，配合 `abbrlink.alg: crc32`、`abbrlink.rep: hex`，使文章链接稳定且不依赖文件名。
- **数据文件位置**：`source/_data/*.yml` 是 Hexo data 目录约定，模板可通过 `site.data.<filename>` 访问，用于友链、widget 等动态内容。