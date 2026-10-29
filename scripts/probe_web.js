// One-off check (removed after use): the web shop's public catalog.
const fs = require('fs');
(async () => {
  const out = {};
  for (const u of ['https://shop.marvelsnap.com/api/catalog?lang=en']) {
    try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', accept: 'application/json' } }); out[u] = { status: r.status, headers: Object.fromEntries(r.headers), body: await r.text() }; }
    catch (e) { out[u] = { err: String(e) }; }
  }
  fs.writeFileSync('probe/catalog.json', JSON.stringify(out, null, 1));
})();
