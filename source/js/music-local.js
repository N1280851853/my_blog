/*!
 * music-local.js —— 八音盒「本地歌单」播放器（APlayer 本地 audio 列表，零第三方音乐接口）
 * ---------------------------------------------------------------------------
 * 【背景】
 *   八音盒页面原来用 Meting（data-id/data-server/data-type/data-api）在线拉网易云歌单。
 *   现改为播放站长自己维护、存放在 source/life/music/audio/ 的本地音频。本模块只在
 *   八音盒页（存在 #music-local-player 容器时）工作，其它页面直接 return，互不影响。
 *
 * 【为什么走注入，而不是改主题源码】
 *   沿用站点规范（用户 2026-10-01 定）：不改 themes/。APlayer 本体已由主题
 *   aplayerInject 全局加载（window.APlayer 可用），这里只负责「读本地歌单 → new APlayer」。
 *   歌单数据放在 source/life/music/playlist.json，新增/删除歌曲只改那一个文件。
 *
 * 【关键降级与兼容（均已对照 APlayer 1.10.1 源码确认）】
 *   1) 歌词：不用 lrcType:3（async）。源码里 lrcType:3 会对每首歌无条件 XHR 取 audio.lrc，
 *      缺省会请求 "undefined" → 404 → 弹「LRC file request fails」。故本模块自己预取 .lrc
 *      文本，用 lrcType:1（字符串）喂入；没歌词的歌不带 lrc 字段 → APlayer 只显示
 *      「Not available」，无网络请求、无报错。整张歌单都没歌词时 lrcType:0，连歌词区都不出现。
 *   2) 封面：cover 缺省会 url(undefined) 破图。故每首歌 cover 缺省兜底到本地 default.svg。
 *   3) pjax：自管理唯一实例。离开页面（pjax:send）先 destroy 停播，避免音频叠加/内存泄漏；
 *      回到页面（pjax:complete/success/end）重新 init。不把实例塞进 window.aplayers，
 *      以免与主题 pjax.pug 的销毁钩子重复 destroy（APlayer.destroy 二次调用会误删 mutex 数组）。
 *      Meting 的 loadMeting 只认带 data-id/data-url 的 .aplayer，本容器两者皆无，不会被劫持。
 *
 * 【卸载】删除本文件 + inject.bottom 里那一行 <script> 即可，无其它构建依赖。
 */
(function () {
  var CONTAINER_ID = 'music-local-player';
  var PLAYLIST_URL = '/life/music/playlist.json';
  var DEFAULT_COVER = '/life/music/cover/default.svg';

  var instance = null;        // 当前 APlayer 实例
  var boundContainer = null;  // 实例绑定的容器节点（幂等判断用）
  var loading = false;        // 防止并发 fetch / 重复初始化

  function destroy() {
    if (instance) {
      try { instance.destroy(); } catch (e) { /* 容器可能已被 pjax 移除，忽略 */ }
      instance = null;
      boundContainer = null;
    }
  }

  function fetchText(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  // 把歌单条目转成 APlayer audio 数组；可选歌词预取为文本，失败/缺省静默降级
  function buildAudio(songs) {
    return Promise.all(songs.map(function (s) {
      var item = {
        name: s.name || '未知曲目',
        artist: s.artist || '未知艺术家',
        url: s.url,
        cover: s.cover || DEFAULT_COVER,
        type: 'auto'
      };
      if (s.lrc) {
        return fetchText(s.lrc)
          .then(function (txt) { item.lrc = txt; return item; })
          .catch(function () { return item; }); // 歌词文件缺失 → 不带 lrc，不报错
      }
      return Promise.resolve(item);
    }));
  }

  function placeholder(msg) {
    var c = document.getElementById(CONTAINER_ID);
    if (c) c.innerHTML = '<p style="padding:24px;text-align:center;opacity:.6;margin:0">' + msg + '</p>';
  }

  function init() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) { destroy(); return; }                 // 不在八音盒页 → 清理旧实例
    if (typeof window.APlayer !== 'function') return;      // APlayer 尚未就绪
    if (instance && boundContainer === container && container.querySelector('.aplayer')) return; // 已初始化
    if (loading) return;
    loading = true;
    destroy();

    fetchText(PLAYLIST_URL)
      .then(function (txt) { return JSON.parse(txt); })
      .then(function (cfg) {
        var songs = (cfg && cfg.songs) || [];
        if (!songs.length) { placeholder('歌单为空，请在 playlist.json 中添加歌曲'); return; }
        return buildAudio(songs).then(function (audio) {
          // fetch 期间可能已 pjax 离开/返回，重新取当前容器
          var c = document.getElementById(CONTAINER_ID);
          if (!c || typeof window.APlayer !== 'function') return;
          var hasLrc = audio.some(function (a) { return a.lrc; });
          instance = new window.APlayer({
            container: c,
            audio: audio,
            fixed: false,
            autoplay: false,          // 不自动播放（沿用原设置）
            mutex: true,
            lrcType: hasLrc ? 1 : 0,  // 歌词字符串模式；整单无歌词则关闭歌词区
            listFolded: false,
            listMaxHeight: '340px',
            preload: 'auto',
            theme: '#e3f2f5',
            volume: 0.4,              // 默认音量（沿用原设置）
            loop: 'all',              // 列表循环
            order: 'list',            // 固定顺序播放；想随机改成 'random'
            storageName: 'music-local-setting'
          });
          boundContainer = c;
        });
      })
      .catch(function (err) {
        placeholder('歌单加载失败，请检查 playlist.json');
        if (window.console && console.warn) console.warn('[music-local] 加载失败：', err && err.message);
      })
      .then(function () { loading = false; });
  }

  // 首次加载 + pjax 换页（复用站点既有事件约定，见 footer-music.js）
  if (document.readyState !== 'loading') init();
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:send', destroy);  // 离开页面：停播并销毁，避免音频叠加
  ['pjax:complete', 'pjax:success', 'pjax:end'].forEach(function (ev) {
    document.addEventListener(ev, init);
  });
})();