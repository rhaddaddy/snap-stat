// Every page and section, in dark and light, on a 390px-wide phone: page errors, broken words (undefined, NaN,
// [object Object]), anything wider than the screen, and buttons whose action doesn't exist.
const { chromium } = require('playwright');
(async () => {
  const base = 'http://127.0.0.1:' + (process.env.PORT || '8771') + '/';
  const b = await chromium.launch(); const errs = [];
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: scheme });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`[${scheme}] pageerror ${e.message}`));
    await p.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
    await p.goto(base); await p.waitForTimeout(2200);
    if (process.env.SIGNIN) { if (!(await p.locator('[data-a="signInGoogle"]').count())) await p.evaluate(() => A.signIn()); await p.locator('[data-a="signInGoogle"]').click(); await p.waitForTimeout(1500); if (await p.evaluate(() => store.mode) !== 'cloud') errs.push('[' + scheme + '] sign-in did not work'); await p.evaluate(() => { const m = window.__mockdata; m.set('profiles/u_pub', { handle: 'Pub', visibility: 'public', alliance: 'Crawlers', stats: { all: { games: 3, w: 2, l: 1 } } }); m.set('posts/u_pub', { items: [{ id: 'x1', type: 'text', text: 'hello', ts: Date.now() }, null, { id: 'x2', type: 'win', payload: { match: { locs: [null, { name: 'Xandar' }] } }, ts: Date.now() + 9e9 }] }); m.set('profiles/u_priv', { handle: 'Shy', visibility: 'private' }); store.db.doc('profiles/u_tick').set({ handle: 'Tick' }); }); await p.waitForTimeout(800); }
    else if (await p.locator('[data-a="skipSignIn"]').count()) { await p.locator('[data-a="skipSignIn"]').click(); await p.waitForTimeout(300); }
    await p.evaluate(() => { closeSheet(); if (!S.me.onboarded) { S.me.handle = 'Tester'; S.me.onboarded = true; } A.loadExamples && A.loadExamples(); });
    await p.waitForTimeout(500);
    // 1. Every button's action exists
    if (scheme === 'dark') {
      const missing = await p.evaluate(() => {
        const src = [...document.scripts].map((s) => s.textContent).join('\n');
        const names = new Set([...src.matchAll(/data-a="([a-zA-Z0-9_]+)"/g)].map((m) => m[1]));
        return [...names].filter((n) => typeof A[n] !== 'function');
      });
      if (missing.length) errs.push('buttons with no action: ' + missing.join(', '));
      const badTo = await p.evaluate(() => {
        const src = [...document.scripts].map((s) => s.textContent).join('\n');
        const to = new Set([...src.matchAll(/data-to="([a-z/]+)"/g)].map((m) => m[1]));
        return [...to].filter((t) => !navTarget(t));
      });
      if (badTo.length) errs.push('links to pages that don\'t exist: ' + badTo.join(', '));
    }
    // 2. Every page and section
    const routes = await p.evaluate(() => { const out = []; for (const [t, n] of Object.entries(NAV)) { const subs = n.subs ? n.subs().map((s) => s[0]) : ['']; for (const s of subs) out.push(s ? `${t}/${s}` : t); } return out; });
    const check = async (where) => {
      const r = await p.evaluate(() => {
        const vis = (el) => { const st = getComputedStyle(el); return st.display !== 'none' && st.visibility !== 'hidden'; };
        const txt = (document.querySelector('#view').innerText || '') + '\n' + (!document.querySelector('#sheet').hidden ? document.querySelector('#sheetBody').innerText : '');
        const bad = (txt.match(/\bundefined\b|\bNaN\b|\[object Object\]|Infinity(?=\s*(?:%|days?\b|games?\b|tokens?\b|times\b|left\b|cubes?\b))|open Infinity|-?Infinity\s*(?:\/|of)/g) || []).slice(0, 4);
        const wide = document.scrollingElement.scrollWidth > innerWidth + 1;
        const over = []; for (const el of document.querySelectorAll('#view *, #sheetBody *')) { if (!vis(el)) continue; const rc = el.getBoundingClientRect(); if (rc.width > 0 && rc.right > innerWidth + 2 && !el.closest('.tbl-wrap, .chips, .subnav, .seg, .hscroll, .cbrow, .scroll-x, [style*="overflow"]') && !(() => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (/auto|scroll|hidden/.test(o.overflowX) && a.getBoundingClientRect().right <= innerWidth + 2) return true; } return false; })()) { over.push((el.className && String(el.className).slice(0, 30)) || el.tagName); if (over.length > 3) break; } }
        return { bad, wide, over };
      });
      if (r.bad.length) errs.push(`[${scheme}] ${where}: shows ${JSON.stringify(r.bad)}`);
      if (r.wide) errs.push(`[${scheme}] ${where}: page scrolls sideways`);
      if (r.over.length) errs.push(`[${scheme}] ${where}: too wide: ${r.over.join(', ')}`);
    };
    for (const rt of routes) { await p.evaluate((h) => { closeSheet(); location.hash = h; }, rt); await p.waitForTimeout(250); await check('#' + rt); }
    // 3. Common panels
    const sheets = [
      ['card', () => A.cardOpen({ dataset: { k: allCards()[3].key } })],
      ['deck', () => { const d = S.decks[0] || newDeck('Crawl deck', allCards().slice(0, 12).map((c) => c.key)); openDeck(d.id); }],
      ['match form', () => A.matchNew()],
      ['edit match', () => { const m = allMatches()[0]; if (m) A.matchEdit({ dataset: { id: m.id } }); }],
      ['quick log', () => A.quickOpen()],
      ['screenshots', () => openSheet(shotsSheet)],
      ['review', () => A.reviewOpen()],
      ['update everything', () => A.sweepOpen && A.sweepOpen()],
      ['season', () => { const s = seasons()[seasons().length - 1]; if (s) A.seasonOpen({ dataset: { id: s.id } }); }],
      ['event', () => { const e = events()[events().length - 1]; if (e) A.eventOpen({ dataset: { id: e.id } }); }],
      ['onboarding', () => openSheet(onboardSheet)],
      ['profile', () => openSheet(profileSheet(store.uid || 'me'))],
      ['compose', () => A.compose()],
      ['import', () => A.importOpen()],
      ['snapvault', () => A.svOpen && A.svOpen()],
      ['AI deck', () => A.aiOpen()],
      ['recap', () => A.recapOpen && A.recapOpen()],
    ];
    for (const [name, fn] of sheets) {
      try { await p.evaluate((src) => { closeSheet(); (0, eval)('(' + src + ')')(); }, fn.toString()); } catch (e) { errs.push(`[${scheme}] opening ${name}: ${e.message.split('\n')[0]}`); continue; }
      await p.waitForTimeout(300); await check('panel: ' + name);
    }
    await ctx.close();
  }
  await b.close();
  console.log((process.env.SIGNIN ? 'signed in: ' : 'signed out: ') + (errs.length ? 'ERRORS\n' + [...new Set(errs)].join('\n') : 'ALL GOOD'));
})();
