// Qoder Sites 部署后处理（在 hexo generate 之后运行）：
// 1. 平台静态托管不支持目录索引（/archives/ 不会解析到 index.html），
//    把指向真实存在目录的内部链接改写为显式 index.html。
// 2. 移除 Vercel/Cloudflare 专用产物：/api 与 /functions 是 Qoder 平台保留路由，
//    且这些 serverless 函数在 Qoder 上无法运行。
'use strict';

const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');

const walk = function (dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(function (e) {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (p.endsWith('.html') ? [p] : []);
  });
};

let count = 0;
walk(pub).forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  const next = html.replace(/href=(["'])(\/[^"']*?\/)\1/g, function (m, q, href) {
    if (href === '/' || href.startsWith('//')) return m;
    let clean;
    try {
      clean = decodeURIComponent(href.split(/[?#]/)[0]);
    } catch (e) {
      return m;
    }
    const target = path.join(pub, clean, 'index.html');
    if (target.startsWith(pub) && fs.existsSync(target)) {
      count++;
      return 'href=' + q + href + 'index.html' + q;
    }
    return m;
  });
  if (next !== html) fs.writeFileSync(file, next);
});

['api', 'functions', 'vercel.json'].forEach(function (name) {
  fs.rmSync(path.join(pub, name), { recursive: true, force: true });
});

console.log('qoder-static-links: ' + count + ' 个目录链接已改写为 index.html，已移除 Vercel/Cloudflare 产物');