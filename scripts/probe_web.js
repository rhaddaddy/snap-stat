// One-off check (removed after use): which banner picture addresses answer, and what the web shop's pages look like.
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const out = { urls: {}, shop: {} };
  const urls = [
    'https://static.marvelsnap.pro/art/Venom_07.webp', 'https://static.marvelsnap.pro/art/Venom.webp',
    'https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/284_07.webp',
    'https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/venom.webp',
  ];
  for (const u of urls) for (const ref of ['', 'https://rhaddaddy.github.io/']) {
    try { const r = await fetch(u, { headers: ref ? { referer: ref, 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' } : { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' } }); const b = Buffer.from(await r.arrayBuffer()); out.urls[u + (ref ? ' (ref)' : '')] = { status: r.status, type: r.headers.get('content-type'), bytes: b.length }; }
    catch (e) { out.urls[u] = { err: String(e) }; }
  }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })).newPage();
  const seen = [];
  p.on('response', (r) => { const u = r.url(); if (/api|graphql|json/i.test(u) && seen.length < 80) seen.push(r.status() + ' ' + u.slice(0, 200)); });
  for (const path of ['', 'season-track', 'bundles']) {
    try {
      await p.goto('https://shop.marvelsnap.com/' + path, { waitUntil: 'networkidle', timeout: 45000 });
      await p.waitForTimeout(6000);
      for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(700); }
      const info = await p.evaluate(() => ({ url: location.href, title: document.title, text: document.body.innerText.slice(0, 15000), links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h, i, s) => s.indexOf(h) === i).slice(0, 120), inputs: [...document.querySelectorAll('input')].map((i) => i.type + ':' + (i.name || i.autocomplete || '')).slice(0, 30) }));
      out.shop[path || 'home'] = info;
      await p.screenshot({ path: `probe/shop-${path || 'home'}.png`, fullPage: false });
    } catch (e) { out.shop[path || 'home'] = { err: String(e).slice(0, 300) }; }
  }
  out.api = seen;
  await b.close();
  fs.writeFileSync('probe/web.json', JSON.stringify(out, null, 1));
})();
