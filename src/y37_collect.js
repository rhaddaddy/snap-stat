/* ============ y37_collect.js: collection, variants and Mastery (October 31, 2026) ============
   31 a Mastery planner to level 22 (second Custom Card) · 32 a log of what each Mastery Cache gave · 33 the next split for
   each card, with booster and credit costs · 34 price history for cards and variants in the Token shop, with good-deal
   alerts · 35 artist pages · 36 a collection value score · 37 a Series drop watch · 38 a Spotlight cache planner ·
   39 a Custom Card gallery · 40 album finish dates at your pace. Most of it is in Cards › Plan more (a new section). */
const y37Own = () => Object.keys(S.owned).filter((k) => S.owned[k] && !card(k).custom);

/* ---------- 31. Mastery planner: the cards closest to level 22 ---------- */
function masteryPlan() {
  if (typeof masteryOf !== "function") return [];
  const mv = typeof masteryVariants === "function" ? masteryVariants() : undefined, goal = MASTERY_XP[MASTERY_SLOT2 - 1];
  return y37Own().map((k) => { const m = masteryOf(k, mv); return { k, m, need: Math.max(0, goal - m.xp) }; }).filter((x) => x.m.level < MASTERY_SLOT2).sort((a, b) => a.need - b.need).slice(0, 12).map((x) => ({ ...x, ways: typeof masteryWays === "function" ? masteryWays(x.k, x.need, mv) : "" }));
}
function masteryPlanHtml() {
  const list = masteryPlan(), mv = typeof masteryVariants === "function" ? masteryVariants() : undefined, done = typeof masteryOf === "function" ? y37Own().filter((k) => masteryOf(k, mv).level >= MASTERY_SLOT2).length : 0;
  if (!list.length) return `<div class="empty"><strong>${done ? "Every card you own is past level 22" : "Mark the cards you own first"}</strong><span>${done ? "Nice work." : "Import your collection (Settings › Import & backup) and the planner shows which cards are closest."}</span></div>`;
  return `<p class="small">Level ${MASTERY_SLOT2} gives a card a second Custom Card slot. These are your closest${done ? ` (${done} already there)` : ""}:</p>
    <div class="list">${list.map((x) => `<button class="li" data-a="cardOpen" data-k="${esc(x.k)}">${cardChip(x.k, { size: "xs", noOwn: true })}<div class="grow"><div class="t">${esc(card(x.k).name)} <span class="muted">· level ${x.m.level}</span></div><div class="s">${fmt(x.need)} XP to go${x.ways ? " · " + esc(String(x.ways).replace(/<[^>]+>/g, "")).slice(0, 140) : ` · about ${Math.ceil(x.need / MASTERY_GAIN.split)} splits`}</div></div><span class="muted">›</span></button>`).join("")}</div>
    <p class="muted small">Each split is ${MASTERY_GAIN.split} XP; variants give ${MASTERY_GAIN.Rare}-${MASTERY_GAIN.Ultimate} XP by rarity. ${list.some((x) => !x.m.exact) ? "Estimated from your variants and splits until the game's file gives the exact XP." : ""}</p>`;
}

/* ---------- 32. Mastery Cache log ---------- */
const y37mc = { k: "", lv: "", got: "" };
const cacheLevels = () => Array.from({ length: 28 }, (_, i) => i + 2).filter((lv) => !MASTERY_REWARDS[lv]);
function cacheLogHtml() {
  const L = obj(S.cacheLog), rows = Object.entries(L).flatMap(([k, o]) => Object.entries(obj(o)).map(([lv, got]) => ({ k, lv: num(lv), got: String(got) }))).sort((a, b) => card(a.k).name.localeCompare(card(b.k).name) || a.lv - b.lv);
  const own = y37Own().map(card).sort((a, b) => a.name.localeCompare(b.name)), fins = {};
  rows.forEach((r) => (fins[r.got] = (fins[r.got] || 0) + 1));
  return `<div class="stack small"><div class="grid2"><label class="f">Card<select data-y37mc="k"><option value="">Pick a card…</option>${own.map((c) => `<option value="${esc(c.key)}" ${y37mc.k === c.key ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label class="f">Level<select data-y37mc="lv">${cacheLevels().map((lv) => `<option value="${lv}" ${num(y37mc.lv) === lv ? "selected" : ""}>${lv}</option>`).join("")}</select></label></div>
    <label class="f">What it gave<input type="text" list="y37-fins" data-y37mc="got" maxlength="40" value="${esc(y37mc.got)}" placeholder="Like Gold Metallic or Cosmic"></label><datalist id="y37-fins">${(typeof SPLIT_FINISHES !== "undefined" ? [...SPLIT_FINISHES, ...SPLIT_FLARES] : []).map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
    <button class="btn sm snap" data-a="mcAdd">Add to the log</button>
    ${rows.length ? `<div class="chiplist">${Object.entries(fins).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => `<span class="pill">${esc(f)} ×${n}</span>`).join("")}</div><div class="list">${rows.slice(0, 80).map((r) => `<div class="li"><div class="grow"><div class="t">${esc(card(r.k).name)} · level ${r.lv}</div><div class="s">${esc(r.got)}</div></div><button class="x" data-a="mcDel" data-k="${esc(r.k)}" data-lv="${r.lv}" aria-label="Remove">✕</button></div>`).join("")}</div>`
      : `<span class="muted">Levels without a fixed reward give a Mastery Cache: a random Finish or Flare. Log them here to see what you've got.</span>`}</div>`;
}
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y37mc) return; y37mc[t.dataset.y37mc] = t.value; });
document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.y37mc === "got") y37mc.got = t.value; });

/* ---------- 33. Next split for each card ---------- */
// To split, a copy has to reach Infinity: these are the credits and boosters still needed for the next one
function nextSplits() {
  if (typeof prog !== "function" || typeof STEP === "undefined") return [];
  const out = [];
  for (const k of Object.keys(obj(S.prog))) {
    if (!S.owned[k] || card(k).custom) continue; const p = prog(k), copies = typeof progCopies === "function" ? progCopies(k) : [];
    const r = copies.reduce((m, c) => (c.r !== null && c.r !== undefined && c.r < 6 ? Math.max(m, c.r) : m), -1), from = r >= 0 ? r : 0;
    let cr = 0, bo = 0; for (let i = from + 1; i <= 6; i++) { cr += STEP[i][0]; bo += STEP[i][1]; }
    const have = num(p.b), got = new Set(arr(p.splits).map((s) => s.fin).filter(Boolean)), newFin = SPLIT_FINISHES.filter((f) => !got.has(f)).length;
    out.push({ k, cr, bo, short: Math.max(0, bo - have), have, newFin, splits: arr(p.splits).length });
  }
  return out.sort((a, b) => a.short - b.short || a.cr - b.cr).slice(0, 12);
}
function nextSplitsHtml() {
  const list = nextSplits();
  if (!list.length) return `<div class="empty"><strong>No upgrade data yet</strong><span>Import the game's files or screenshot a card's upgrade screen to fill in boosters and rarities.</span></div>`;
  return `<div class="list">${list.map((x) => `<button class="li" data-a="cardOpen" data-k="${esc(x.k)}">${cardChip(x.k, { size: "xs", noOwn: true })}<div class="grow"><div class="t">${esc(card(x.k).name)}</div><div class="s">${x.short ? `${x.short} more boosters` : "Enough boosters"} · ${fmt(x.cr)} credits · ${x.newFin} finish${x.newFin === 1 ? "" : "es"} you don't have yet</div></div><span class="pill ${x.short ? "dim" : "W"}">${x.short ? `${x.have}/${x.bo}` : "Ready"}</span></button>`).join("")}</div>
    <p class="muted small">The cost to take your next copy to Infinity. A split picks a random finish, so cards with more finishes you don't have are better bets.</p>`;
}

/* ---------- 34. Price history in the Token shop, with good-deal alerts ---------- */
const y37Price = (s) => { const m = String(s || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : 0; };
function priceSync() {
  if (typeof tokenShopReads !== "function") return; const L = obj(S.priceLog); let ch = false;
  for (const x of tokenShopReads()) {
    const c = typeof fuzzyCard === "function" ? fuzzyCard(String(x.card)) : cardByName(x.card); const p = y37Price(x.price); if (!c || !p || !x.ts) continue;
    const key = c.key + (x.variant ? "|" + String(x.variant).slice(0, 40) : ""), list = arr(L[key]);
    if (list.some((e) => Math.abs(num(e[0]) - x.ts) < 6 * 3600e3)) continue;
    L[key] = [...list, [x.ts, p]].sort((a, b) => a[0] - b[0]).slice(-12); ch = true;
  }
  if (ch) { S.priceLog = Object.fromEntries(Object.entries(L).sort((a, b) => arr(b[1]).slice(-1)[0][0] - arr(a[1]).slice(-1)[0][0]).slice(0, 200)); save(); }
}
function priceDeal(list) { if (list.length < 2) return null; const last = list[list.length - 1], before = list.slice(0, -1).map((e) => e[1]).sort((a, b) => a - b), med = before[Math.floor(before.length / 2)]; return last[1] < med * 0.85 ? { last: last[1], usual: med, at: last[0] } : null; }
let _y37PriceAt = 0;
EXT.afterRender.push(function y37PriceSoon() { if (Date.now() - _y37PriceAt < 60e3) return; _y37PriceAt = Date.now(); setTimeout(() => { try { priceSync(); } catch (e) { errNote("price history", e, true); } }, 1500); });
EXT.alerts.push(function y37DealAlerts(now = Date.now()) {
  const out = []; for (const [key, list] of Object.entries(obj(S.priceLog))) { const d = priceDeal(arr(list)); if (!d || now - d.at > 2 * DAY) continue; const [k, v] = key.split("|"); const c = card(k); if (!c || !c.name) continue; const want = S.wishCards[k] || (v && S.variants.some((x) => x.card === k && x.wish)); if (!want) continue;
    out.push({ id: `deal:${key}:${d.at}`, at: d.at, until: d.at + 2 * DAY, title: "A good deal on your wishlist", body: `${c.name}${v ? " · " + v : ""} is ${fmt(d.last)} in the Token shop (usually ${fmt(d.usual)}).`, route: "#cards/plan2", pref: "remSpotlight" }); }
  return out;
});
function priceHtmlFor(k) {
  const rows = Object.entries(obj(S.priceLog)).filter(([key]) => key.split("|")[0] === k); if (!rows.length) return "";
  return `<div class="panel stack small"><b>Token shop prices</b>${rows.map(([key, list]) => { const v = key.split("|")[1] || "", d = priceDeal(arr(list)); return `<div><span>${esc(v || "The card")}</span>: ${arr(list).slice(-5).map((e) => `<span class="num">${fmt(e[1])}</span> <span class="muted">(${esc(dayStr(e[0]))})</span>`).join(" → ")}${d ? ` <span class="pill W">Good deal</span>` : ""}</div>`; }).join("")}</div>`;
}
EXT.cardSheet.push(priceHtmlFor);
function priceListHtml() {
  const rows = Object.entries(obj(S.priceLog)).map(([key, list]) => ({ key, list: arr(list), d: priceDeal(arr(list)) })).sort((a, b) => (b.d ? 1 : 0) - (a.d ? 1 : 0) || b.list.slice(-1)[0][0] - a.list.slice(-1)[0][0]).slice(0, 20);
  if (!rows.length) return `<div class="empty"><strong>No prices yet</strong><span>Screenshot the Token shop (or let Track & play see it) and prices build up here over time.</span></div>`;
  return `<div class="list">${rows.map((r) => { const [k, v] = r.key.split("|"), last = r.list[r.list.length - 1]; return `<button class="li" data-a="cardOpen" data-k="${esc(k)}"><div class="grow"><div class="t">${esc(card(k).name)}${v ? ` · ${esc(v)}` : ""}</div><div class="s">${fmt(last[1])} on ${esc(dayStr(last[0]))}${r.list.length > 1 ? ` · seen ${r.list.length} times` : ""}</div></div>${r.d ? `<span class="pill W">Deal</span>` : ""}</button>`; }).join("")}</div><p class="muted small">A good deal is 15% or more under its usual price. Wishlist deals send a notification.</p>`;
}

/* ---------- 35. Artist pages ---------- */
let artistPick = "";
function artistsAll() { const by = {}; for (const v of allVariants()) { const a = String(v.artist || "").trim(); if (!a || keyOf(a) === keyOf(v.name)) continue; (by[a] = by[a] || []).push(v); } return by; }
function artistSheet() {
  const list = arr(artistsAll()[artistPick]).sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || card(a.card).name.localeCompare(card(b.card).name)), own = list.filter((v) => v.owned).length;
  return `${sheetHead(esc(artistPick), `${own} of ${list.length} variants owned`)}<div class="bar"><i style="width:${pct(own, list.length)}%"></i></div>
    <div class="y37-art">${list.slice(0, 200).map((v) => `<div class="y37-v ${v.owned ? "own" : ""}">${cardFace(card(v.card), { variant: v, noSub: true })}<span class="small">${v.owned ? "✓ Owned" : esc(v.rarity || v.source || "Missing")}</span></div>`).join("")}</div>
    <div class="row"><button class="btn sm" data-a="artistFav" data-v="${esc(artistPick)}">${arr(S.favArtists).includes(artistPick) ? "★ A favourite" : "☆ Add to favourites"}</button><button class="btn sm snap" data-a="close">Done</button></div>`;
}
function artistsHtml() {
  const by = artistsAll(), favs = arr(S.favArtists).filter((a) => by[a]);
  const top = Object.entries(by).map(([a, l]) => ({ a, n: l.length, own: l.filter((v) => v.owned).length })).sort((x, y) => y.own - x.own || y.n - x.n);
  if (!top.length) return `<div class="empty"><strong>No artists yet</strong><span>The variant list loads with the daily data.</span></div>`;
  const q = keyOf(ui.artistQ || ""), shown = q ? top.filter((x) => keyOf(x.a).includes(q)) : [...top.filter((x) => favs.includes(x.a)), ...top.filter((x) => !favs.includes(x.a))].slice(0, 12);
  return `<input type="search" data-y37artq="1" placeholder="Find an artist" value="${esc(ui.artistQ || "")}" aria-label="Find an artist"><div class="list">${shown.slice(0, 30).map((x) => `<button class="li" data-a="artistOpen" data-v="${esc(x.a)}"><div class="grow"><div class="t">${favs.includes(x.a) ? "★ " : ""}${esc(x.a)}</div><div class="bar"><i style="width:${pct(x.own, x.n)}%"></i></div></div><span class="num muted">${x.own}/${x.n}</span></button>`).join("")}</div>`;
}
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y37artq) return; ui.artistQ = t.value; clearTimeout(ui.y37t); ui.y37t = setTimeout(() => { render(); const el = document.querySelector("[data-y37artq]"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 350); });

/* ---------- 36. Collection value ---------- */
const VAR_GOLD = { Common: 700, Uncommon: 700, Rare: 700, "Super Rare": 1200, Epic: 1800, Legendary: 1800, Ultra: 1800, Spotlight: 1800, Ultimate: 8200 };
function collectionValue() {
  let vars = 0, nv = 0, cards = 0; const s5 = [], s4 = [];
  for (const v of allVariants()) if (v.owned) { vars += VAR_GOLD[String(v.rarity || "")] || 700; nv++; }
  for (const k of y37Own()) { const s = String(card(k).series || ""); if (/5/.test(s)) s5.push(k); else if (/4/.test(s)) s4.push(k); }
  cards = s5.length * 5000 + s4.length * 2500;
  return { total: vars + cards, vars, nv, cards, s5: s5.length, s4: s4.length, usd: Math.round((vars + cards) / 80) };
}
function valueHtml() {
  const v = collectionValue(); if (!v.nv && !v.s5 && !v.s4) return `<div class="empty"><strong>Nothing counted yet</strong><span>Import your collection to see what it's worth.</span></div>`;
  return `<div class="kpis"><div class="kpi"><div class="v num">${fmt(v.total)}</div><div class="k">gold, roughly (about $${fmt(v.usd)})</div></div><div class="kpi"><div class="v num">${fmt(v.nv)}</div><div class="k">variants · ${fmt(v.vars)} gold</div></div><div class="kpi"><div class="v num">${v.s5 + v.s4}</div><div class="k">Series 4 & 5 cards · ${fmt(v.cards)} gold</div></div></div>
    <p class="muted small">An estimate from shop prices: 700 gold for a regular variant, 1,200 for Super Rare, 1,800 for Epic and up, 8,200 for Ultimate; Series 5 cards at 5,000 and Series 4 at 2,500 (what bundles count them as). 80 gold = $1.</p>`;
}

/* ---------- 37. Series drop watch ---------- */
// SNAP Stat notes when it first sees each card in a Series, and when a card moves down; with a few drops seen it times the next ones
function seriesSync() {
  const T = obj(S.seriesSeen), now = Date.now(); let ch = false;
  for (const c of allCards()) { if (c.custom || c.upcoming) continue; const s = String(c.series || "").match(/[345]/); if (!s) continue; const old = T[c.key]; if (!old) { T[c.key] = [s[0], now]; ch = true; } else if (old[0] !== s[0]) { S.seriesDrops = [...arr(S.seriesDrops), [c.key, old[0], s[0], now, old[1]]].slice(-80); T[c.key] = [s[0], now]; ch = true; } }
  if (ch) { S.seriesSeen = T; save(); }
}
let _y37SerDay = "";
EXT.afterRender.push(function y37SeriesDaily() { const d = localDate(Date.now()); if (d === _y37SerDay || typeof CAT === "undefined" || !CAT) return; _y37SerDay = d; setTimeout(() => { try { seriesSync(); } catch (e) { errNote("the Series watch", e, true); } }, 2500); });
function firstVariantDate(c) { if (typeof VD === "undefined" || !VD || !c.catId) return ""; let best = ""; const pre = c.catId + "_"; for (const [id, v] of Object.entries(VD.variants)) if (id.startsWith(pre) && v && v.d && (!best || v.d < best)) best = v.d; return best; }
function seriesHtml() {
  const s5 = allCards().filter((c) => !c.custom && !c.upcoming && /5/.test(String(c.series || ""))).map((c) => ({ c, d: firstVariantDate(c) })).sort((a, b) => (a.d || "9") .localeCompare(b.d || "9"));
  if (!s5.length) return `<div class="empty"><strong>No Series 5 cards in the card data</strong><span>It fills in with the daily data.</span></div>`;
  const drops = arr(S.seriesDrops).filter((x) => x[1] === "5"), avgDays = drops.length >= 3 ? Math.round(drops.reduce((s, x) => s + (num(x[3]) - num(x[4])), 0) / drops.length / DAY) : 0;
  const want = (k) => !!(S.wishCards[k] && !S.owned[k]);
  return `<p class="small">${drops.length ? `${drops.length} drop${drops.length === 1 ? "" : "s"} from Series 5 seen so far.` : "SNAP Stat started watching the Series today: once it sees cards move down, it times the next drops."} The oldest Series 5 cards usually drop first:</p>
    <div class="list">${s5.slice(0, 10).map(({ c, d }) => `<button class="li" data-a="cardOpen" data-k="${esc(c.key)}">${cardChip(c.key, { size: "xs" })}<div class="grow"><div class="t">${esc(c.name)}${want(c.key) ? ` <span class="pill gold">Wishlist</span>` : ""}</div><div class="s">${d ? `out since about ${esc(dateStr(d))}` : "release date unknown"}${S.owned[c.key] ? " · owned" : ""}</div></div></button>`).join("")}</div>
    <p class="muted small">${avgDays ? `Cards you've seen drop spent about ${avgDays} days in Series 5. ` : ""}This is a guess from release dates (the first variant's date); Second Dinner announces the real drops.</p>`;
}

/* ---------- 38. Spotlight cache planner ---------- */
function y37SpotHtml() {
  const weeks = arr(S.spotlight).filter((w) => w && w.week && dayEnd(w.week) + 7 * DAY >= Date.now()).sort((a, b) => a.week.localeCompare(b.week));
  const keys = allCards().filter((c) => !c.custom).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="stack small">${weeks.length ? `<div class="list">${weeks.map((w) => { const miss = arr(w.cards).filter((k) => !S.owned[k]); return `<div class="li"><div class="grow"><div class="t">Week of ${esc(dateStr(w.week))}</div><div class="s">${arr(w.cards).map((k) => `${S.owned[k] ? "✓" : "○"} ${esc(card(k).name)}`).join(" · ")}</div></div><span class="pill ${miss.length >= 2 ? "W" : miss.length ? "warn" : "dim"}">${miss.length ? `${miss.length} new` : "All owned"}</span><button class="x" data-a="spotDel" data-w="${esc(w.week)}" aria-label="Remove">✕</button></div>`; }).join("")}</div>
      <span class="muted">Open a Spotlight cache in the weeks with the most cards you don't have. Weeks with none new aren't worth a key.</span>` : `<span class="muted">The game announces each week's Spotlight cards. Add the weeks you care about and SNAP Stat marks the ones with cards you're missing.</span>`}
    <div class="grid2"><label class="f">Week starting<input type="date" data-spot="week" value="${esc(ui.spotWeek || "")}"></label><label class="f">Card<input type="text" list="y37-cards" data-spot="card" placeholder="Card name" value="${esc(ui.spotCard || "")}"></label></div>
    <datalist id="y37-cards">${keys.slice(0, 900).map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
    <button class="btn sm" data-a="spotAdd">Add the card to that week</button></div>`;
}
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.spot) return; if (t.dataset.spot === "week") ui.spotWeek = t.value; else ui.spotCard = t.value; });
document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.spot === "week") ui.spotWeek = t.value; });

/* ---------- 39. Custom Card gallery ---------- */
function customGalleryHtml() {
  const L1 = obj(S.looks), L2 = obj(S.looks2), keys = [...new Set([...Object.keys(L1), ...Object.keys(L2)])].filter((k) => card(k) && card(k).name && (lookText(L1[k]) || lookText(L2[k])));
  if (!keys.length) return `<div class="empty"><strong>No Custom Cards yet</strong><span>Screenshot a card's Custom Card screen in the game, or import the game's files, and they appear here.</span></div>`;
  const face = (k, L) => { const v = L && L.v ? variantAny(L.v) : null; return `<div class="y37-cc">${cardFace(card(k), v ? { variant: v, noSub: true } : {})}<span class="small">${esc(lookText(L) || "—")}</span></div>`; };
  return `<div class="tour-track hscroll y37-gal" data-noswipe>${keys.map((k) => `<div class="panel y37-gc"><b>${esc(card(k).name)}</b><div class="y37-pair">${face(k, L1[k])}${L2[k] && lookText(L2[k]) ? face(k, L2[k]) : ""}</div>${L2[k] && lookText(L2[k]) ? `<span class="muted small">Custom Card 1 and 2</span>` : ""}</div>`).join("")}</div>
    <p class="muted small">${keys.length} card${keys.length === 1 ? "" : "s"} · swipe through them.</p>`;
}

/* ---------- 40. Album finish dates ---------- */
function albumForecastHtml() {
  if (typeof ALB === "undefined" || !ALB || typeof albumInfo !== "function") return `<div class="empty"><strong>Albums are loading</strong><span>They come with the daily data.</span></div>`;
  const since = Date.now() - 60 * DAY, recentAll = S.variants.filter((v) => v.owned && num(v.ownAt) >= since).length, totalVars = Math.max(1, allVariants().length);
  const rows = Object.keys(ALB.albums).map((k) => albumInfo(k)).filter((a) => a.goal && a.have < a.goal).map((a) => {
    const recent = a.vars.filter((x) => x.v && x.v.owned && num(x.v.ownAt) >= since).length, perDay = recent ? recent / 60 : (recentAll / 60) * (a.vars.length / totalVars);
    const need = a.next ? a.next.need - a.have : a.goal - a.have, days = perDay > 0 ? Math.ceil(need / perDay) : 0; return { a, need, days };
  }).filter((r) => r.need > 0).sort((x, y) => (x.days || 1e9) - (y.days || 1e9)).slice(0, 10);
  if (!rows.length) return `<div class="empty"><strong>No albums in progress</strong><span>Own a variant from an album and it shows here.</span></div>`;
  return `<div class="list">${rows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.a.name)}</div><div class="s">${r.a.have}/${r.a.goal} · ${r.need} more for ${r.a.next ? esc(String(r.a.next.reward || r.a.next.name || "the next reward")) : "the end"}</div></div><span class="pill ${r.days && r.days <= 30 ? "W" : "dim"}">${r.days ? (r.days > 365 ? "over a year" : `~${r.days > 60 ? Math.round(r.days / 30) + " months" : r.days + " days"}`) : "no pace yet"}</span></div>`).join("")}</div>
    <p class="muted small">At your pace over the last 60 days (variants you got in each album, or across all variants when there were none).</p>`;
}

/* ---------- Where it shows: Cards › Plan more ---------- */
const PLAN2 = [["mastery", "Mastery to level 22", masteryPlanHtml], ["splits", "Next splits", nextSplitsHtml], ["cache", "Mastery Cache log", cacheLogHtml], ["prices", "Token shop prices", priceListHtml], ["artists", "Artists", artistsHtml], ["value", "Collection value", valueHtml], ["series", "Series drop watch", seriesHtml], ["spot", "Spotlight planner", y37SpotHtml], ["gallery", "Custom Card gallery", customGalleryHtml], ["albums", "Album finish dates", albumForecastHtml]];
function plan2Html() {
  const cur = PLAN2.find(([k]) => k === ui.plan2) || PLAN2[0];
  let body = ""; try { body = cur[2](); } catch (e) { errNote(cur[1], e); body = errPageHtml(cur[1], e); }
  return `<section class="sec"><h2>More collection tools</h2><div class="chips y37-chips">${PLAN2.map(([k, l]) => `<button class="chip" data-a="plan2" data-v="${k}" aria-pressed="${k === cur[0]}">${esc(l)}</button>`).join("")}</div></section><section class="sec"><h2>${esc(cur[1])}</h2>${body}</section>`;
}
EXT.cardsSubs.push(["plan2", "More tools", plan2Html]);

/* ---------- Taps ---------- */
Object.assign(A, {
  plan2: (el) => { ui.plan2 = el.dataset.v; render(); },
  mcAdd: () => { if (!y37mc.k) { toast("Pick a card"); return; } const lv = num(y37mc.lv) || cacheLevels()[0], got = String(y37mc.got || "").trim().slice(0, 40); if (!got) { toast("Write what it gave"); return; } const L = obj(S.cacheLog); L[y37mc.k] = { ...obj(L[y37mc.k]), [lv]: got }; S.cacheLog = L; y37mc.got = ""; save(); render(); toast("Logged"); },
  mcDel: (el) => { const L = obj(S.cacheLog), o = obj(L[el.dataset.k]); delete o[el.dataset.lv]; if (!Object.keys(o).length) delete L[el.dataset.k]; S.cacheLog = L; save(); render(); },
  artistOpen: (el) => { artistPick = el.dataset.v; openSheet(artistSheet); },
  artistFav: (el) => { const a = el.dataset.v, f = arr(S.favArtists); S.favArtists = f.includes(a) ? f.filter((x) => x !== a) : [...f, a].slice(-30); save(); refreshSheet(); },
  spotAdd: () => { const w = ui.spotWeek, c = cardByName(ui.spotCard || "") || (typeof fuzzyCard === "function" ? fuzzyCard(ui.spotCard || "") : null); if (!w) { toast("Pick the week"); return; } if (!c) { toast("Type a card's name"); return; } const L = arr(S.spotlight).filter((x) => x && x.week); const ex = L.find((x) => x.week === w); if (ex) { if (!arr(ex.cards).includes(c.key)) ex.cards = [...arr(ex.cards), c.key].slice(0, 6); } else L.push({ week: w, cards: [c.key] }); S.spotlight = L.slice(-20); ui.spotCard = ""; save(); render(); },
  spotDel: (el) => { S.spotlight = arr(S.spotlight).filter((x) => x.week !== el.dataset.w); save(); render(); },
});
EXT.search.push((q) => (/mastery|split|cache|price|artist|value|series|spotlight|custom card|album/i.test(q) ? [{ label: "Mastery, splits, prices, artists and more", sub: "Cards › More tools", route: "cards/plan2" }] : []));
EXT.styles.push(`
.y37-chips { flex-wrap: wrap; } .y37-chips .chip { min-height: 40px; }
.y37-art { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0; } .y37-v { display: flex; flex-direction: column; gap: 4px; text-align: center; min-width: 0; opacity: .55; } .y37-v.own { opacity: 1; }
.y37-gal .tour-card, .y37-gc { flex: 0 0 86%; scroll-snap-align: center; margin: 0 4px; display: flex; flex-direction: column; gap: 8px; }
.y37-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .y37-cc { display: flex; flex-direction: column; gap: 4px; min-width: 0; }`);
