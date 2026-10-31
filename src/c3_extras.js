
/* ============ Balance history (balance-history.json, refreshed daily from snap.fan) ============ */
let BAL = null, balVer = 0;
const BAL_CACHE = "snapstat-balance-v1";
function useHistory(j, fromCache) {
  if (!j || !Array.isArray(j.entries) || !j.entries.length) return false;
  if (BAL && fromCache) return false;
  BAL = { updated: String(j.updated || ""), entries: j.entries }; balVer++;
  refreshView(); return true;
}
async function loadHistory() {
  if (!window.SNAPSTAT_STANDALONE) return;
  try { const c = localStorage.getItem(BAL_CACHE); if (c) useHistory(JSON.parse(c), true); } catch { /* no saved copy */ }
  for (const u of catUrls("balance-history.json")) {
    try {
      const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
      const text = await r.text(); const j = JSON.parse(text);
      if (BAL && j.updated && j.updated === BAL.updated) return;
      if (!useHistory(j, false)) continue;
      try { localStorage.setItem(BAL_CACHE, text); } catch { /* fetched again next time */ }
      return;
    } catch { /* try the next copy */ }
  }
}
let _balSig = "", _bal = [];
/* Every change, newest first: { date, key, from, to, kind: buff | nerf | changed } */
function balanceChanges() {
  const sig = balVer + "|" + catVer;
  if (sig === _balSig) return _bal;
  const byCard = new Map();
  for (const e of BAL ? BAL.entries : []) { if (!Array.isArray(e) || !e[1]) continue; (byCard.get(e[1]) || byCard.set(e[1], []).get(e[1])).push(e); }
  const out = [];
  for (const [id, list] of byCard) {
    const c = cardByCode(cardCode(id)); if (!c || c.hidden) continue;
    list.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      const from = { cost: a[2], power: a[3], ability: a[4] || "" }, to = { cost: b[2], power: b[3], ability: b[4] || "" };
      const dc = num(to.cost) - num(from.cost), dp = num(to.power) - num(from.power), ab = keyOf(from.ability) !== keyOf(to.ability);
      if (!dc && !dp && !ab) continue;
      const kind = !ab && dc <= 0 && dp >= 0 ? "buff" : !ab && dc >= 0 && dp <= 0 ? "nerf" : dc < 0 && dp >= 0 ? "buff" : dc > 0 && dp <= 0 ? "nerf" : "changed";
      out.push({ date: b[0], key: c.key, from, to, kind, ab });
    }
  }
  out.sort((x, y) => y.date.localeCompare(x.date) || card(x.key).name.localeCompare(card(y.key).name));
  _balSig = sig; _bal = out; return out;
}
const BAL_LABEL = { buff: "Buff", nerf: "Nerf", changed: "Changed" };
const BAL_PILL = { buff: "W", nerf: "L", changed: "gold" };
function recentChange(key, days = 30) {
  const since = localDate(Date.now() - days * DAY);
  return balanceChanges().find((x) => x.key === key && x.date >= since) || null;
}
function deckCardKeys() { return new Set(S.decks.filter((d) => d.status !== "draft").flatMap((d) => arr(d.cards))); }
function statLine(s) { s = obj(s); return `${s.cost === "" || s.cost == null ? "?" : esc(s.cost)}/${s.power === "" || s.power == null ? "?" : esc(s.power)}`; }
function balanceRow(x, showCard = true) {
  return `<div class="li" style="align-items:flex-start;flex-wrap:wrap">${showCard ? cardChip(x.key, { a: "cardOpen" }) : `<span class="muted small num">${esc(dateStr(x.date))}</span>`}
    <span class="pill ${BAL_PILL[x.kind]}">${BAL_LABEL[x.kind]}</span><span class="num small">${statLine(x.from)} → <b>${statLine(x.to)}</b></span>
    ${x.ab ? `<div class="small" style="width:100%"><span class="muted">Now:</span> ${esc(x.to.ability || "No ability")}<br><span class="muted">Was:</span> ${esc(x.from.ability || "No ability")}</div>` : ""}</div>`;
}
function vBalance() {
  const f = ui.balFilter || "decks"; const inDecks = deckCardKeys();
  const all = balanceChanges();
  const list = all.filter((x) => f === "all" || (f === "decks" ? inDecks.has(x.key) : !!S.owned[x.key]));
  const byDate = new Map(); for (const x of list.slice(0, 300)) (byDate.get(x.date) || byDate.set(x.date, []).get(x.date)).push(x);
  const chip = (v, l) => `<button class="chip" data-a="balFilter" data-v="${v}" aria-pressed="${f === v}">${l}</button>`;
  return `<section class="sec">${backBar("Balance changes")}
    <p class="muted small">Every time a card's cost, power or ability changed${BAL ? ", updated daily from snap.fan's card history" : ""}. Buffs are green, nerfs are red, and reworks are gold.</p>
    <div class="chips">${chip("decks", "Cards in my decks")}${chip("owned", "Cards I own")}${chip("all", "All cards")}</div>
    ${!BAL ? `<div class="empty"><span>The balance history loads once the app's daily data update has run.</span></div>` : byDate.size ? [...byDate].map(([d, xs]) => `<h3>${esc(dateStr(d))}</h3><div class="list">${xs.map((x) => balanceRow(x)).join("")}</div>`).join("") : `<div class="empty"><span>No changes to ${f === "decks" ? "cards in your decks" : "your cards"} yet.</span></div>`}</section>`;
}
function balanceHomePanel() {
  const since = localDate(Date.now() - 14 * DAY), inDecks = deckCardKeys();
  const xs = balanceChanges().filter((x) => x.date >= since && inDecks.has(x.key));
  if (!xs.length) return "";
  const n = (k) => xs.filter((x) => x.kind === k).length;
  return `<section class="sec"><div class="sec-h"><h2>Balance changes</h2><button class="btn sm ghost" data-a="go" data-to="balance">All changes</button></div>
    <p class="small muted">In the last two weeks, cards in your decks got ${[n("buff") && `${n("buff")} buff${n("buff") > 1 ? "s" : ""}`, n("nerf") && `${n("nerf")} nerf${n("nerf") > 1 ? "s" : ""}`, n("changed") && `${n("changed")} rework${n("changed") > 1 ? "s" : ""}`].filter(Boolean).join(", ")}.</p>
    <div class="list">${xs.slice(0, 5).map((x) => balanceRow(x)).join("")}</div></section>`;
}
function cardHistoryHtml(k) {
  const xs = balanceChanges().filter((x) => x.key === k);
  return xs.length ? `<h3>Balance history</h3><div class="list">${xs.slice(0, 12).map((x) => balanceRow(x, false)).join("")}</div>` : "";
}

/* ============ What's for sale (bundles and event shops in schedule.json) ============ */
// Offers start and end at the daily reset on their dates (or at the exact end time the data gives). Test listings
// dated far ahead (snap.fan lists some for 2099) are left out, and an end date more than a year away isn't shown.
function offerStartTs(s) { const t = resetOn(s && s.start); return Number.isFinite(t) ? t : 0; }
function offerEndTs(s) { const x = s && s.endsAt ? Date.parse(s.endsAt) : NaN; if (Number.isFinite(x)) return x; const t = resetOn(s && s.end); return Number.isFinite(t) ? t : Infinity; }
function offerListed(s, now = Date.now()) { return !!s && typeof s === "object" && offerEndTs(s) > now && offerStartTs(s) < now + 90 * DAY; }
function offerUntil(s, now = Date.now()) { return s.end && offerEndTs(s) < now + 365 * DAY ? String(s.end) : ""; }
function autoOffers() {
  if (!SCHED || !Array.isArray(SCHED.shops)) return [];
  const now = Date.now(), out = [], seen = new Set();
  SCHED.shops.forEach((s, i) => {
    if (!offerListed(s, now)) return;
    const items = arr(s.items).filter((it) => it && typeof it === "object");
    // The same bundle listed twice in the data shows once
    const key = [s.title, s.start, s.end, s.price, items.map((it) => it.cat || it.cardId || it.label).join(",")].join("|"); if (seen.has(key)) return; seen.add(key);
    items.forEach((it, j) => {
      const c = it.cardId ? cardByCode(cardCode(it.cardId)) : null;
      out.push({ id: `auto${i}-${j}`, auto: true, shop: s.shop || "Shop", title: s.title || "", start: s.start || "", startTs: offerStartTs(s), expires: offerUntil(s, now), price: s.price, currency: s.currency || "usd", gold: s.gold || "", item: it.label || it.cardName || "", cat: it.cat || "", cardKey: c ? c.key : "", variant: !!it.variantId, cardName: c ? c.name : it.cardName || "", group: i });
    });
  });
  return out;
}
// Every price with its currency; a missing price says so instead of showing 0
function offerPrice(o) {
  const n = Number(o.price);
  if (!(n > 0)) return "price not listed";
  if (!o.currency || o.currency === "usd") return "$" + n.toFixed(2);
  if (o.currency === "event") return `${fmt(n)} event currency${num(o.gold) > 0 ? ` (≈ ${fmt(o.gold)} gold)` : ""}`;
  return `${fmt(n)} ${CURR[o.currency] || o.currency}`;
}
function autoShopSection() {
  const offers = autoOffers(); if (!offers.length) return "";
  const wantCats = new Set(S.variants.filter((v) => v.wish && !v.owned && v.cat).map((v) => v.cat));
  const groups = new Map(); for (const o of offers) (groups.get(o.group) || groups.set(o.group, []).get(o.group)).push(o);
  const now = Date.now(), isSoon = (o) => o.startTs > now;
  // What's on sale now first (ending soonest at the top), then what starts later
  const list = [...groups.values()].sort((a, b) => isSoon(a[0]) - isSoon(b[0]) || String(a[0].expires || "9999").localeCompare(String(b[0].expires || "9999")));
  const rows = list.map((g) => {
    const o = g[0], soon = isSoon(o);
    return `<div class="li" style="align-items:flex-start;flex-wrap:wrap"><div class="grow"><div class="t">${esc(o.title || o.shop)}${soon ? ` <span class="pill gold">Soon</span>` : ""}</div><div class="s">${esc(o.shop)} · ${esc(offerPrice(o))}${o.expires ? ` · until ${esc(dateStr(o.expires))}` : ""}</div></div>
      <div class="chiplist" style="width:100%">${g.map((x) => { const want = (x.cat && wantCats.has(x.cat)) || (!x.variant && x.cardKey && S.wishCards[x.cardKey]); const own = x.cat ? !!S.variants.find((v) => v.cat === x.cat && v.owned) : x.cardKey && !x.variant ? !!S.owned[x.cardKey] : false;
        return `<span class="cchip ${own ? "" : "miss"}" title="${esc(x.cardName)}">${want ? "♥ " : ""}${esc(x.cardName)}${x.variant ? ` <span class="muted">· ${esc(x.item)}</span>` : ""}${own ? ` <span class="muted">✓</span>` : ""}</span>`; }).join("")}</div></div>`;
  });
  return `<section class="sec"><h2>${list.some((g) => isSoon(g[0])) ? "On sale now and soon" : "On sale now"}</h2><p class="muted small">Bundles and event shops from snap.fan, updated daily. ♥ marks things on your wishlist, ✓ things you own.</p><div class="list">${rows.join("")}</div></section>`;
}

/* ============ Collection progress by series ============ */
function seriesOf(c) {
  const src = String(c.catSource || "");
  const m = src.match(/^Series (\d)$/i) || String(c.series || "").match(/^(\d)$/);
  if (m) return "Series " + m[1];
  if (/starter|recruit|collection level/i.test(src)) return "Starter";
  return "";
}
const SERIES_ORDER = ["Starter", "Series 1", "Series 2", "Series 3", "Series 4", "Series 5"];
function seriesPanel() {
  const cs = allCards().filter((c) => !c.upcoming && !c.custom);
  const rows = SERIES_ORDER.map((s) => { const list = cs.filter((c) => seriesOf(c) === s); const own = list.filter((c) => S.owned[c.key]).length; return { s, total: list.length, own }; }).filter((r) => r.total);
  if (!rows.length) return "";
  return `<div class="panel stack" style="gap:8px"><span class="eyebrow">Progress by series</span>
    ${rows.map((r) => `<button class="series-row" data-a="seriesFilter" data-v="${esc(r.s)}" aria-pressed="${ui.cardSeries === r.s}"><span class="lbl">${esc(r.s)}</span><span class="bar">${passBar(r.own, r.total)}</span><span class="num small">${r.own}/${r.total}</span></button>`).join("")}
    <span class="muted small">Tap a series to see what you're missing from it.</span></div>`;
}

/* ============ Shareable deck picture ============ */
function loadCorsImage(url) {
  return new Promise((res) => {
    if (!url) return res(null);
    const img = new Image(); img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer";
    const t = setTimeout(() => res(null), 8000);
    img.onload = () => { clearTimeout(t); res(img); }; img.onerror = () => { clearTimeout(t); res(null); };
    img.src = url + (url.includes("?") ? "&" : "?") + "snapstat=1";
  });
}
async function deckImageBlob(d, withArt = true) {
  const keys = [...d.cards].sort((a, b) => num(card(a).cost) - num(card(b).cost) || card(a).name.localeCompare(card(b).name));
  const W = 1080, cols = 4, cw = 240, ch = 320, gap = 16, top = 170, rows = Math.ceil(Math.max(keys.length, 1) / cols);
  const H = top + rows * (ch + 46 + gap) + 150;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#1B1350"); bg.addColorStop(1, "#0A0918"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "#FFD23F"; g.font = "italic 800 56px system-ui, sans-serif"; g.fillText(d.name.slice(0, 28), 48, 92);
  const r = statsFor(deckMatches(d).filter((m) => !m.example));
  g.fillStyle = "#C9C3EE"; g.font = "600 28px system-ui, sans-serif";
  g.fillText([`${keys.length} cards`, `avg cost ${avgCost(keys)}`, r.games ? `${r.w}-${r.l} · ${r.wr}% wins` : ""].filter(Boolean).join("  ·  "), 48, 138);
  const imgs = withArt ? await Promise.all(keys.map((k) => { const c = card(k); return loadCorsImage(c.custom ? "" : variantArt(deckVariant(d, k)) || c.art); })) : keys.map(() => null);
  const x0 = (W - (cols * cw + (cols - 1) * gap)) / 2;
  keys.forEach((k, i) => {
    const c = card(k), x = x0 + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + 46 + gap), img = imgs[i];
    if (img) { const s = Math.min(cw / img.width, ch / img.height), w = img.width * s, h = img.height * s; g.drawImage(img, x + (cw - w) / 2, y + (ch - h) / 2, w, h); }
    else {
      const h = hue(c.key); const gr = g.createLinearGradient(x, y, x + cw, y + ch); gr.addColorStop(0, `hsl(${h} 70% 46%)`); gr.addColorStop(1, `hsl(${(h + 48) % 360} 65% 16%)`);
      g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x, y, cw, ch, 22) : g.rect(x, y, cw, ch); g.fill();
      g.fillStyle = "rgba(255,255,255,.3)"; g.font = "italic 800 120px system-ui, sans-serif"; g.textAlign = "center"; g.fillText((c.name[0] || "?").toUpperCase(), x + cw / 2, y + ch / 2 + 40);
      g.fillStyle = "#fff"; g.font = "800 34px system-ui, sans-serif"; g.textAlign = "left"; g.fillText(String(c.cost), x + 18, y + 48); g.textAlign = "right"; g.fillText(String(c.power), x + cw - 18, y + 48); g.textAlign = "left";
    }
    g.fillStyle = "#fff"; g.font = "700 24px system-ui, sans-serif"; g.textAlign = "center"; g.fillText(c.name.length > 18 ? c.name.slice(0, 17) + "…" : c.name, x + cw / 2, y + ch + 32); g.textAlign = "left";
  });
  const code = deckCode(d);
  g.fillStyle = "#8E88B8"; g.font = "500 20px ui-monospace, monospace";
  const lines = code.match(/.{1,78}/g) || [];
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 48, H - 108 + i * 26));
  g.fillStyle = "#C9C3EE"; g.font = "600 22px system-ui, sans-serif"; g.fillText("Made with SNAP Stat · unofficial fan app", 48, H - 24);
  return new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"); } catch (e) { rej(e); } });
}
async function shareDeckImage(d) {
  toast("Making the picture…");
  let blob;
  try { blob = await deckImageBlob(d, true); } catch { try { blob = await deckImageBlob(d, false); } catch { toast("Couldn't make the picture."); return; } }
  const name = (d.name || "deck").replace(/[^\w-]+/g, "-").slice(0, 40) + ".png";
  const file = new File([blob], name, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: d.name, text: deckCode(d) }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Picture saved");
}

/* ============ Meta: links out, decks popular with SNAP Stat players, and checking any deck code ============ */
const META_LINKS = [["Untapped.gg tier list", "https://snap.untapped.gg/en/meta"], ["snap.fan meta decks", "https://snap.fan/decks/meta/"], ["Marvel Snap Zone tier list", "https://marvelsnapzone.com/tier-list/"]];
function popularDecks() {
  const groups = new Map();
  for (const x of publicDecksAll()) {
    const names = arr(x.cards).map((n) => keyOf(n)).filter(Boolean).sort(); if (names.length < 8) continue;
    const k = names.join(","); const st = obj(x.stats);
    const g = groups.get(k) || { ...x, players: new Set(), games: 0, w: 0, l: 0 };
    g.players.add(x.owner); g.games += num(st.games); g.w += num(st.w); g.l += num(st.l); groups.set(k, g);
  }
  return [...groups.values()].filter((g) => g.games >= 3).map((g) => ({ ...g, wr: pct(g.w, g.w + g.l) })).sort((a, b) => b.players.size - a.players.size || b.games - a.games).slice(0, 10);
}
function publicDecksAll() { const out = []; for (const [owner, doc] of Object.entries(shared.decks)) { if (!canSee(owner)) continue; arr(doc.items).forEach((x) => out.push({ ...x, owner })); } return out; }
function metaSection() {
  const pop = store.mode === "cloud" ? popularDecks() : [];
  return `<section class="sec"><h2>Meta</h2>
    <div class="list">${META_LINKS.map(([l, u]) => `<a class="li" href="${u}" target="_blank" rel="noopener"><div class="grow"><div class="t">${esc(l)}</div></div><span class="muted">↗</span></a>`).join("")}</div>
    <p class="muted small">Found a deck you like? Copy its code and check it here: what you own, what you're missing, and which of your decks is closest.</p>
    <button class="btn" data-a="metaCheckOpen">Check a deck code</button>
    ${tierListHtml()}
    ${pop.length ? `<h3>Popular with SNAP Stat players</h3><div class="list">${pop.map((g) => `<div class="li"><div class="grow"><div class="t">${esc(g.name || "Deck")}</div><div class="s">${g.players.size} player${g.players.size > 1 ? "s" : ""} · ${g.games} games · ${g.wr}% wins</div></div></div>`).join("")}</div>` : ""}</section>`;
}
const mc = { text: "", res: null };
function metaCheckSheet() {
  const r = mc.res; let body = "";
  if (r && r.cards.length) {
    const own = r.cards.filter((k) => S.owned[k]), miss = r.cards.filter((k) => !S.owned[k]);
    const names = new Set(r.cards);
    const near = S.decks.map((d) => ({ d, n: arr(d.cards).filter((k) => names.has(k)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n)[0];
    body = `<div class="panel stack"><div class="tiles"><div class="tile"><div class="k">You own</div><div class="v">${own.length}/${r.cards.length}</div></div><div class="tile"><div class="k">Missing</div><div class="v">${miss.length}</div></div></div>
      ${miss.length ? `<span class="eyebrow">Missing</span><div class="chiplist">${miss.map((k) => cardChip(k)).join("")}</div>` : `<p class="small">You own every card in this deck.</p>`}
      ${near ? `<p class="small">Closest of your decks: <b>${esc(near.d.name)}</b>, ${near.n} of ${r.cards.length} cards the same.</p>` : ""}
      <button class="btn snap" data-a="metaSave">Save as a new deck</button></div>`;
  } else if (r) body = `<p class="note">No cards found in that. Copy the deck code from the game or a deck site and paste it here.</p>`;
  return `${sheetHead("Check a deck", "Paste a deck code from the game or any deck site")}
    <textarea id="mc-text" class="code" data-mc="text" placeholder="Paste a deck code">${esc(mc.text)}</textarea><button class="btn" data-a="metaCheck">Check it</button>${body}`;
}

/* ============ AI with your own keys: Gemini, Perplexity, Claude, ChatGPT and Grok, tried in your order ============ */
const AI_KEY = "snapstat.aiKey", AI_MODEL = "snapstat.aiModel";
const AI_ORDER_KEY = "snapstat.aiOrder", AI_STATE_KEY = "snapstat.aiState", AI_RELAY_KEY = "snapstat.aiRelay";
const AI_MODELS = { "claude-sonnet-5-5": "Claude Sonnet 5.5 (best)", "claude-haiku-5-5": "Claude Haiku 5.5 (cheaper, faster)" };
const RELAY_GUIDE = "https://github.com/rhaddaddy/snap-stat/blob/main/relay/README.md";
const AI_PROVIDERS = {
  gemini: { name: "Gemini", keyUrl: "https://aistudio.google.com/apikey", keySite: "aistudio.google.com", cost: "Free key with daily limits. New keys start with AQ., older ones with AIza.", ph: "AQ.… or AIza…" },
  perplexity: { name: "Perplexity", keyUrl: "https://www.perplexity.ai/account/api", keySite: "perplexity.ai › Settings › API", cost: "Perplexity Pro includes $5 of use each month. Needs the relay below.", ph: "pplx-…", relay: true },
  claude: { name: "Claude", keyUrl: "https://console.anthropic.com/", keySite: "console.anthropic.com", cost: "Charges your Anthropic account a little each use.", ph: "sk-ant-…" },
  openai: { name: "ChatGPT", keyUrl: "https://platform.openai.com/api-keys", keySite: "platform.openai.com", cost: "Charges your OpenAI account a little each use.", ph: "sk-…" },
  xai: { name: "Grok", keyUrl: "https://console.x.ai/", keySite: "console.x.ai", cost: "Charges your xAI account a little each use. May need the relay below.", ph: "xai-…", relay: true },
};
const lsStr = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const lsPut = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch { return false; } };
const aiKeyName = (p) => (p === "claude" ? AI_KEY : AI_KEY + "." + p);
const aiKeyFor = (p) => lsStr(aiKeyName(p));
function aiModel() { const m = lsStr(AI_MODEL); return AI_MODELS[m] ? m : "claude-sonnet-5-5"; }
function aiOrder() { const saved = lsStr(AI_ORDER_KEY).split(",").filter((p) => AI_PROVIDERS[p]); return [...new Set([...saved, ...Object.keys(AI_PROVIDERS)])]; }
function aiState() { try { return obj(JSON.parse(lsStr(AI_STATE_KEY) || "{}")); } catch { return {}; } }
function setAiState(p, patch) { const s = aiState(); s[p] = patch === null ? {} : { ...obj(s[p]), ...patch }; lsPut(AI_STATE_KEY, JSON.stringify(s)); }
const aiRelay = () => lsStr(AI_RELAY_KEY).replace(/\/+$/, "");
const aiOn = () => aiOrder().some((p) => aiKeyFor(p));
let aiLast = "";
function parseJsonLoose(text) {
  const t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try { return JSON.parse(t); } catch { /* find the JSON inside */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}"), c = t.indexOf("["), e = t.lastIndexOf("]");
  const objStr = a >= 0 && b > a ? t.slice(a, b + 1) : "", arrStr = c >= 0 && e > c ? t.slice(c, e + 1) : "";
  for (const s of [c >= 0 && (a < 0 || c < a) ? arrStr : objStr, objStr, arrStr]) if (s) { try { return JSON.parse(s); } catch { /* next */ } }
  throw new Error("The AI's answer wasn't in the expected format. Try again.");
}
function aiFail(p, status, msg, extra = {}) { const e = new Error(msg); e.status = status; e.provider = p; return Object.assign(e, extra); }
// Waits up to 45 seconds for an answer, so a stuck request ends with a message instead of hanging.
let aiWaitNow = 0; // shorter wait while testing a key
const aiWait = () => num(window.__aiWait) || aiWaitNow || 45e3;
const aiTests = {}; // the last "Test it" result for each service, shown under its row
async function aiFetch(p, url, init = {}) {
  const n = AI_PROVIDERS[p].name, ctl = new AbortController(), outer = init.signal; let late = false;
  const tm = setTimeout(() => { late = true; ctl.abort(); }, aiWait());
  const onOuter = () => ctl.abort();
  if (outer) { if (outer.aborted) ctl.abort(); else outer.addEventListener("abort", onOuter, { once: true }); }
  const slow = () => aiFail(p, 0, `${n} took too long to answer. Try again in a minute.`, { slow: true });
  try {
    let res;
    try { res = await fetch(url, { ...init, signal: ctl.signal }); } catch (e) {
      if (late) throw slow();
      if (e && e.name === "AbortError") throw e;
      throw aiFail(p, 0, `${n} can't be reached from this app${AI_PROVIDERS[p].relay ? " without the relay" : ""}.`, { reach: true });
    }
    if (!res.ok) {
      let raw = ""; try { raw = (await res.text()).slice(0, 2000); } catch { /* no details */ }
      const body = raw.toLowerCase().slice(0, 600), s = res.status, broke = /quota|credit|billing|balance|insufficient|exhausted/.test(body);
      let detail = ""; try { const j = obj(JSON.parse(raw)); const er = obj(Array.isArray(j) ? obj(j[0]).error : j.error); detail = String(arr(er.details).map((d) => obj(d).reason).find(Boolean) || er.status || er.message || er.type || "").slice(0, 90); } catch { /* not JSON */ }
      const msg = s === 401 || s === 403 ? `${n} turned down the key.` : s === 402 || (s === 429 && broke) ? `${n} is out of credit or free uses for now.` : s === 429 ? `${n} is busy or hit its limit for now.` : s === 404 ? `${n} doesn't have that model.` : s === 400 ? `${n} couldn't handle that request.` : `${n} answered ${s}.`;
      throw aiFail(p, s, detail ? `${msg} (${detail})` : msg, { body });
    }
    try { return await res.json(); } catch (e) { if (late) throw slow(); throw e; }
  } finally { clearTimeout(tm); if (outer) outer.removeEventListener("abort", onOuter); }
}
/* How the app sends Gemini requests. "header" is Google's usual way. "query" puts the key in the address.
   "plain" also sends the question as plain text, so the browser makes one simple request instead of asking permission first.
   If the usual way doesn't work on a phone, the key test finds one that does and remembers it. */
const GEM = "https://generativelanguage.googleapis.com/v1beta";
const gemMode = () => { const st = obj(aiState().gemini); return st.mode || (st.byQuery ? "query" : "header"); };
const gemKeyUrl = (url, key) => url + (url.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key);
function gemInit(mode, init, key) {
  const h = { ...obj(init.headers) };
  if (mode === "header") h["x-goog-api-key"] = key;
  if (mode === "plain") delete h["content-type"];
  return { ...init, headers: h };
}
async function gemFetch(url, init, key) {
  const mode = gemMode();
  // No connection at all (often the phone's web view refusing the extra "may I?" request): send it the simplest way instead
  const plain = async (e) => { if (!e.reach || mode === "plain") throw e; const r = await aiFetch("gemini", gemKeyUrl(url, key), gemInit("plain", init, key)); setAiState("gemini", { mode: "plain" }); return r; };
  if (mode !== "header") { try { return await aiFetch("gemini", gemKeyUrl(url, key), gemInit(mode, init, key)); } catch (e) { return plain(e); } }
  try { return await aiFetch("gemini", url, gemInit("header", init, key)); } catch (e) {
    if (e.reach) return plain(e);
    if (e.status !== 401 && e.status !== 403) throw e; // Google turned down the key in the header: try it in the address
    try { const r = await aiFetch("gemini", gemKeyUrl(url, key), init); setAiState("gemini", { mode: "query" }); return r; } catch (e2) { throw e2.status === 401 || e2.status === 403 ? e : e2; }
  }
}
/* Connection check: tries each way at once and notes what happened, so a problem can be pinned down from a screenshot. */
async function gemProbe(key) {
  const run = async (label, url, init, wait) => {
    const t0 = performance.now(), ctl = new AbortController(); let late = false; const tm = setTimeout(() => { late = true; ctl.abort(); }, wait);
    const secs = () => ((performance.now() - t0) / 1000).toFixed(1) + " s";
    try {
      const r = await fetch(url, { ...init, signal: ctl.signal }); let txt = ""; try { txt = await r.text(); } catch { /* cut off */ }
      let j = {}; try { j = obj(JSON.parse(txt)); } catch { /* not JSON */ }
      const er = obj(j.error), why = String(arr(er.details).map((d) => obj(d).reason).find(Boolean) || er.status || "").slice(0, 60);
      return { label, ok: r.ok, status: r.status, json: j, secs: (performance.now() - t0) / 1000, text: r.ok ? `worked in ${secs()}` : `Google said ${r.status}${why ? " " + why : ""} in ${secs()}` };
    } catch (e) { return { label, ok: false, status: 0, text: late ? `no answer after ${Math.round(wait / 1000)} s` : `couldn't connect (${secs()})` }; }
    finally { clearTimeout(tm); }
  };
  const lists = await Promise.all([
    run("Reach Google, key in address", gemKeyUrl(`${GEM}/models?pageSize=1000`, key), {}, num(window.__aiWait) || 15e3),
    run("Reach Google, key in header", `${GEM}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } }, num(window.__aiWait) || 15e3),
  ]);
  const listed = lists.find((x) => x.ok), viaHeader = lists[1].ok;
  let models = arr(obj(aiState().gemini).models); if (!models.length) models = AI_PICK.gemini([]);
  if (listed) { const ids = arr(listed.json.models).filter((m) => arr(m.supportedGenerationMethods).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, "")); const pick = AI_PICK.gemini(ids); if (pick.length) models = pick; }
  const body = JSON.stringify({ contents: [{ role: "user", parts: [{ text: 'Reply with only this JSON: {"ok": true}' }] }], generationConfig: { responseMimeType: "application/json" } });
  // Reached Google with the key in the header? Ask the usual way. If not, ask with the simplest request.
  const mode = viaHeader ? "header" : listed ? "query" : "plain";
  const asks = await Promise.all(models.slice(0, 4).map((model) => {
    const url = `${GEM}/models/${encodeURIComponent(model)}:generateContent`;
    return run(`Ask ${model}`, mode === "header" ? url : gemKeyUrl(url, key), gemInit(mode, { method: "POST", headers: { "content-type": "application/json" }, body }, key), num(window.__aiWait) || 30e3).then((r) => ({ ...r, model }));
  }));
  const won = asks.find((a) => a.ok); // the best model that answered (they are listed best first)
  return { steps: [...lists, ...asks], works: won ? mode : "", model: won ? won.model : "", models };
}
/* Perplexity (and maybe Grok) don't accept calls straight from web pages; then the request goes through your relay. */
async function viaRelay(p, direct, path, init) {
  const relay = aiRelay(), st = obj(aiState()[p]);
  if (relay && st.viaRelay) return aiFetch(p, relay + path, init);
  try { return await aiFetch(p, direct, init); } catch (e) {
    if (!e.reach || !relay) throw e;
    setAiState(p, { viaRelay: true }); return aiFetch(p, relay + path, init);
  }
}
const verNum = (s) => (String(s).match(/\d+(?:[.-]\d+)*/) || ["0"])[0].split(/[.-]/).map(Number);
const verCmp = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const newestFirst = (list) => [...list].sort(verCmp).reverse();
const AI_PICK = {
  // Several Flash models to fall back on, because Google's newest one is sometimes overloaded ("503 UNAVAILABLE") or slow.
  gemini: (ids) => {
    const flash = newestFirst(ids.filter((i) => /^gemini-\d+(\.\d+)?-flash$/.test(i))), lite = newestFirst(ids.filter((i) => /^gemini-\d+(\.\d+)?-flash-lite$/.test(i)));
    const has = (m) => ids.includes(m) || !ids.length;
    return [...new Set([flash[0], has("gemini-flash-latest") || !flash.length ? "gemini-flash-latest" : "", flash[1], has("gemini-flash-lite-latest") ? "gemini-flash-lite-latest" : "", lite[0], flash[2]].filter(Boolean))].slice(0, 5);
  },
  openai: (ids) => {
    const ok = ids.filter((i) => !/\d{4}-\d{2}-\d{2}|audio|realtime|tts|transcribe|search|image|embed|codex|instruct|moderation|nano|-pro|chat|oss|preview/.test(i));
    return [newestFirst(ok.filter((i) => /^gpt-\d+(\.\d+)?-mini$/.test(i)))[0] || newestFirst(ok.filter((i) => /^gpt-\d+(\.\d+)?$/.test(i)))[0] || "gpt-5-mini"];
  },
  xai: (ids) => {
    const ok = ids.filter((i) => /^grok-\d/.test(i) && !/image|imagine|video|code|tts|embed|vision|-\d{4}$/.test(i));
    return [newestFirst(ok.filter((i) => /fast-non-reasoning$/.test(i)))[0] || newestFirst(ok.filter((i) => /fast/.test(i)))[0] || newestFirst(ok)[0] || "grok-4"];
  },
};
const AI_PICK_V = 2; // bump when the model choice changes, so saved lists are picked again
async function aiModels(p, key, fresh) {
  const st = obj(aiState()[p]); if (arr(st.models).length && !fresh && st.pickV === AI_PICK_V && Date.now() - num(st.modelsAt) < 7 * DAY) return st.models;
  let ids = [];
  try {
    if (p === "gemini") ids = arr((await gemFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {}, key)).models).filter((m) => arr(m.supportedGenerationMethods).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""));
    else if (p === "openai") ids = arr((await aiFetch(p, "https://api.openai.com/v1/models", { headers: { authorization: "Bearer " + key } })).data).map((m) => String(m.id));
    else if (p === "xai") ids = arr((await viaRelay(p, "https://api.x.ai/v1/models", "/xai-models", { headers: { authorization: "Bearer " + key } })).data).map((m) => String(m.id));
  } catch (e) { if (e.status === 401 || e.status === 403 || e.reach || e.slow) throw e; }
  const models = AI_PICK[p](ids); setAiState(p, { models, modelsAt: Date.now(), pickV: AI_PICK_V }); return models;
}
const oaContent = (text, opts) => (arr(opts.images).length ? [{ type: "text", text }, ...opts.images.map((im) => ({ type: "image_url", image_url: { url: `data:${im.media_type};base64,${im.data}` } }))] : text);
const oaText = (j) => { const t = obj(obj(arr(j.choices)[0]).message).content; return typeof t === "string" ? t : arr(t).map((x) => x.text || "").join(""); };
const oaInit = (key, body, signal) => ({ method: "POST", signal, headers: { "content-type": "application/json", authorization: "Bearer " + key }, body: JSON.stringify(body) });
const AI_CALL = {
  claude: async (text, opts, key) => {
    const content = arr(opts.images).length ? [...opts.images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })), { type: "text", text }] : text;
    const j = await aiFetch("claude", "https://api.anthropic.com/v1/messages", { method: "POST", signal: opts.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: aiModel(), max_tokens: 4000, messages: [{ role: "user", content }] }) });
    return arr(j.content).filter((b) => b.type === "text").map((b) => b.text).join("");
  },
  gemini: async (text, opts, key) => {
    const body = JSON.stringify({ contents: [{ role: "user", parts: [...arr(opts.images).map((im) => ({ inline_data: { mime_type: im.media_type, data: im.data } })), { text }] }], generationConfig: { responseMimeType: "application/json" } });
    let models = await aiModels("gemini", key), err = null;
    for (let i = 0; i < models.length; i++) {
      try {
        const j = await gemFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(models[i])}:generateContent`, { method: "POST", signal: opts.signal, headers: { "content-type": "application/json" }, body }, key);
        return arr(obj(obj(arr(j.candidates)[0]).content).parts).map((x) => x.text || "").join("");
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
        if (e.status === 404 && !err) { err = e; models = await aiModels("gemini", key, true); i = -1; continue; }
        // Busy, overloaded, out of free uses or too slow: the next model has its own allowance and is often free
        if (!(e.status === 429 || e.status >= 500 || e.slow) || i === models.length - 1) throw e;
        err = e;
      }
    }
    throw err || aiFail("gemini", 0, "Gemini didn't answer.");
  },
  openai: async (text, opts, key) => { const [model] = await aiModels("openai", key); return oaText(await aiFetch("openai", "https://api.openai.com/v1/chat/completions", oaInit(key, { model, messages: [{ role: "user", content: oaContent(text, opts) }] }, opts.signal))); },
  xai: async (text, opts, key) => { const [model] = await aiModels("xai", key); return oaText(await viaRelay("xai", "https://api.x.ai/v1/chat/completions", "/xai", oaInit(key, { model, messages: [{ role: "user", content: oaContent(text, opts) }] }, opts.signal))); },
  perplexity: async (text, opts, key) => oaText(await viaRelay("perplexity", "https://api.perplexity.ai/chat/completions", "/perplexity", oaInit(key, { model: "sonar", messages: [{ role: "user", content: oaContent(text, opts) }] }, opts.signal))),
};
/* Asks the first service in your list that has a key and isn't resting; if it can't answer, the next one tries. */
async function aiJson(prompt, opts = {}) {
  const text = `${prompt}\n\nReply with only the JSON, no other text.`;
  const keyed = aiOrder().filter((p) => aiKeyFor(p));
  if (!keyed.length) throw new Error("Add an AI key in Settings › AI first.");
  const now = Date.now(), st = aiState(); const ready = keyed.filter((p) => !(num(obj(st[p]).until) > now));
  const list = opts.only ? [opts.only] : ready.length ? ready : keyed;
  let first = null;
  for (const p of list) {
    try {
      const out = parseJsonLoose(await AI_CALL[p](text, opts, aiKeyFor(p)));
      setAiState(p, { until: 0, why: "", msg: "" }); aiLast = p; return out;
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      const s = e.status, body = String(e.body || "");
      // A refused key rests for good (until you test or replace it); no connection is usually the phone's network for a moment
      const rest = s === 401 || s === 403 ? 365 * DAY : e.reach ? 2 * 60e3 : s === 402 ? 12 * 3600e3 : s === 429 ? (/per ?minute|perminute|rate limit|rpm|tpm/.test(body) ? 2 * 60e3 : /quota|credit|billing|balance|insufficient|exhausted/.test(body) ? 6 * 3600e3 : 15 * 60e3) : s >= 500 ? 2 * 60e3 : 0;
      setAiState(p, { until: rest ? Date.now() + rest : 0, why: s === 401 || s === 403 ? "key" : e.reach ? "reach" : s === 402 || s === 429 ? "limit" : "error", msg: String(e.message || "").slice(0, 160) });
      first = first || e;
    }
  }
  const err = new Error(list.length > 1 ? `None of your AI services could answer. ${first.message}` : first.message); err.status = first.status; err.reach = !!first.reach; err.slow = !!first.slow; throw err;
}
function setupAI() {
  // Before October 29, 2026 one dropped connection switched a service off for a year ("Can't connect"); undo that
  try { const st = aiState(); for (const [p, v] of Object.entries(st)) if (obj(v).why === "reach" && num(v.until) > Date.now() + DAY) setAiState(p, { until: 0, why: "", msg: "" }); } catch { /* fine */ }
  if (!window.SNAPSTAT_STANDALONE) return; store.sample = aiOn() ? { json: aiJson, own: true } : null; }
function aiStatus(p) {
  if (!aiKeyFor(p)) return `<span class="pill dim">No key</span>`;
  const s = obj(aiState()[p]);
  if (num(s.until) > Date.now()) return s.why === "key" ? `<span class="pill L">Key problem</span>` : s.why === "reach" ? `<span class="pill L">Can't connect</span>` : `<span class="pill warn">Resting till ${esc(new Date(s.until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}</span>`;
  return `<span class="pill W">On</span>`;
}
function aiPanel() {
  if (!window.SNAPSTAT_STANDALONE) return "";
  const order = aiOrder(), on = aiOn();
  const row = (p, i) => {
    const P = AI_PROVIDERS[p], has = !!aiKeyFor(p), s = obj(aiState()[p]);
    return `<div class="li" style="flex-direction:column;align-items:stretch;gap:8px">
      <div class="row between nowrap"><div class="row nowrap" style="gap:8px;min-width:0"><span class="num muted">${i + 1}</span><b>${P.name}</b>${aiStatus(p)}</div>
        <div class="row nowrap" style="gap:4px"><button class="btn sm ghost" data-a="aiMove" data-p="${p}" data-v="-1" ${i === 0 ? "disabled" : ""} aria-label="Try ${P.name} sooner">↑</button><button class="btn sm ghost" data-a="aiMove" data-p="${p}" data-v="1" ${i === order.length - 1 ? "disabled" : ""} aria-label="Try ${P.name} later">↓</button></div></div>
      <span class="muted small">${esc(P.cost)} Get a key at <a href="${P.keyUrl}" target="_blank" rel="noopener">${esc(P.keySite)}</a>.</span>
      ${has && s.msg && num(s.until) > Date.now() && !aiTests[p] ? `<span class="small">${esc(s.msg)}</span>` : ""}
      ${has && aiTests[p] && !aiTests[p].busy ? `<span class="small ${aiTests[p].ok ? "" : "note"}">${aiTests[p].ok ? "✓ " : ""}${esc(aiTests[p].msg)}</span>` : has && obj(aiTests[p]).busy ? `<span class="small muted">${esc(aiTests[p].msg || `Asking ${P.name}. This can take up to 30 seconds…`)}</span>` : ""}
      ${has && arr(obj(aiTests[p]).steps).length ? `<div class="small muted stack" style="gap:2px"><b>Connection check</b>${aiTests[p].steps.map((x) => `<span>${x.ok ? "✓" : "✗"} ${esc(x.label)}: ${esc(x.text)}</span>`).join("")}</div>` : ""}
      <div class="row nowrap"><input type="password" id="ai-key-${p}" placeholder="${has ? "Saved. Paste a new one to replace it." : P.ph}" autocomplete="off" aria-label="${P.name} key" style="flex:1;min-width:0"><button class="btn sm snap" data-a="aiKeySave" data-p="${p}">Save</button></div>
      ${has ? `<div class="row"><button class="btn sm" data-a="aiKeyTest" data-p="${p}" ${obj(aiTests[p]).busy ? "disabled" : ""}>${obj(aiTests[p]).busy ? "Testing…" : "Test it"}</button><button class="btn sm ghost danger" data-a="aiKeyRemove" data-p="${p}">Remove key</button>${p === "claude" ? `<select id="ai-model" data-aimodel="1" aria-label="Claude model" style="width:auto;flex:1;min-width:0">${Object.entries(AI_MODELS).map(([k, l]) => `<option value="${k}" ${aiModel() === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : ""}</div>` : ""}</div>`;
  };
  return `<section class="sec"><h2>AI features</h2><div class="panel stack small">
    <p>${on ? `AI is <b>on</b>. The deck builder, swap suggestions, opponent prediction, card fill-in and screenshot reading ask the services below, from the top. When one is used up, busy or can't connect, the next one answers.${aiLast ? ` The last answer came from ${esc(AI_PROVIDERS[aiLast].name)}.` : ""}` : "Add a key for any of these services to turn on the AI deck builder, swap suggestions, opponent prediction, card fill-in and screenshot reading. Without one, they use the app's simpler built-in versions."}</p>
    <p class="muted">Chat subscriptions (Gemini, ChatGPT Plus, SuperGrok, Claude) don't cover other apps: each service needs its own key from its developer site. Keys stay on this device and are only sent to that company${aiRelay() ? " or through your relay" : ""}.</p></div>
    <div class="list">${order.map(row).join("")}</div>
    <div class="panel stack small"><b>Relay for Perplexity and Grok</b><span class="muted">Perplexity doesn't take requests straight from web apps, and Grok may not either. A free Cloudflare relay passes them along. <a href="${RELAY_GUIDE}" target="_blank" rel="noopener">How to set it up</a> (about 5 minutes).</span>
      <div class="row nowrap"><input type="url" id="ai-relay" value="${esc(aiRelay())}" placeholder="https://snapstat-relay.you.workers.dev" style="flex:1;min-width:0" aria-label="Relay address" autocomplete="off"><button class="btn sm" data-a="aiRelaySave">Save</button></div></div></section>`;
}

/* ============ Installable app, offline use and notifications ============ */
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (ui.tab === "settings") refreshView(); });
const isInstalled = () => window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
async function registerSW() {
  if (!window.SNAPSTAT_STANDALONE || !("serviceWorker" in navigator) || !/^https:|^http:\/\/(127\.0\.0\.1|localhost)/.test(location.href)) return null;
  try { const reg = await navigator.serviceWorker.register("sw.js"); store.sw = reg; return reg; } catch { return null; }
}
function notifyPrefs() { return { on: false, wish: true, events: true, season: true, goals: true, missions: true, daily: true, resetDaily: false, reset8h: false, webshop: true, ...obj(S.notify) }; }
/* What the background check needs: your wishlist, upcoming events and the season's end. Saved where the service worker can read it. */
// The Android app checks for sales and events itself (web notifications don't work inside apps).
const natAlerts = () => !!(window.SnapStatNative && typeof SnapStatNative.setAlerts === "function");
// Reminders the features worked out themselves: shown once each, between at and until, when their preference is on
function extAlerts(now) {
  const out = [];
  for (const f of arr(EXT.alerts)) { try { for (const a of arr(f(now))) if (a && a.id && num(a.at) > 0 && a.title) out.push({ id: String(a.id).slice(0, 80), at: num(a.at), until: num(a.until) || num(a.at) + 12 * 3600e3, title: String(a.title).slice(0, 80), body: String(a.body || "").slice(0, 200), route: String(a.route || "#home").slice(0, 60), pref: String(a.pref || "").slice(0, 20) }); } catch (e) { console.error("alerts", e); } }
  return out.filter((a) => a.until > now - DAY && a.at < now + 14 * DAY).slice(0, 40);
}
async function saveNotifyState() {
  if (!("caches" in window) && !natAlerts()) return;
  if (SLOT || store.signingOut) return;
  const p = notifyPrefs(), now = Date.now();
  const state = {
    prefs: p, urls: catUrls("schedule.json").map((u) => new URL(u, location.href).href), app: new URL("./", location.href).href,
    wishCats: S.variants.filter((v) => v.wish && !v.owned && v.cat).map((v) => ({ cat: v.cat, name: `${card(v.card).name} · ${v.artist || v.name}` })),
    wishCards: Object.keys(S.wishCards).filter((k) => S.wishCards[k] && !S.owned[k]).map((k) => { const c = card(k); return { id: c.catId || "", name: c.name }; }).filter((x) => x.id),
    // The day it starts where you are (it starts at the daily reset, which is the next morning in Asia and Australia)
    events: events().filter((e) => e.startTs > now - DAY && e.startTs < now + 30 * DAY).map((e) => ({ id: e.id, name: e.name, start: localDate(e.startTs) })),
    season: (() => { const s = currentSeason(); return s && Number.isFinite(s.endTs) ? { id: s.id, name: s.name, end: localDate(s.endTs) } : null; })(),
    goals: arr(S.goals).filter((g) => obj(GOAL_KINDS[g.kind]).per === "day").map((g) => { const p = goalProgress(g); return p ? { id: g.id, day: localDate(now), left: Math.max(0, p.goal - p.have), text: p.text } : null; }).filter(Boolean),
    today: todaySummary(),
    missions: (() => { const mi = missionState(); return mi.items.length ? { key: missionDay(), left: mi.left, resetAt: nextReset() } : null; })(),
    webshop: { claimed: String(obj(S.webshop).claimed || ""), url: WEB_SHOP },
    clock: { resetUtcHour: RESET_UTC_HOUR, refreshUtcHours: REFRESH_UTC_HOURS, daily: DAILY_NOTE, refresh: REFRESH_NOTE, refreshName: REFRESH_NAME },
    alerts: extAlerts(now),
    saved: now,
  };
  if (natAlerts()) { try { SnapStatNative.setAlerts(JSON.stringify(state)); } catch { /* best effort */ } return; }
  try { const c = await caches.open("snapstat-notify"); await c.put("state.json", new Response(JSON.stringify(state), { headers: { "content-type": "application/json" } })); } catch { /* best effort */ }
}
let natAskedNotify = false;
async function enableNotifications() {
  if (natAlerts()) {
    S.notify = { ...notifyPrefs(), on: true }; save();
    if (!SnapStatNative.canNotify()) { natAskedNotify = true; SnapStatNative.askNotify(); }
    await saveNotifyState(); render();
    toast(SnapStatNative.canNotify() ? "Notifications on. The app checks every few hours, even when it's closed." : "Allow notifications in the window that opens.");
    return;
  }
  if (!("Notification" in window)) { toast("This browser can't show notifications."); return; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Notifications are blocked. Allow them in Chrome's site settings."); S.notify = { ...notifyPrefs(), on: false }; save(); render(); return; }
  S.notify = { ...notifyPrefs(), on: true }; save();
  const reg = store.sw || (await registerSW());
  let periodic = false;
  if (reg && "periodicSync" in reg) {
    try { const st = await navigator.permissions.query({ name: "periodic-background-sync" }); if (st.state === "granted") { await reg.periodicSync.register("snapstat-check", { minInterval: 12 * 3600e3 }); periodic = true; } } catch { periodic = false; }
  }
  store.periodic = periodic;
  await saveNotifyState(); checkNotificationsNow();
  render(); toast(periodic ? "Notifications on. The app checks about twice a day, even when it's closed." : "Notifications on. Install the app to get them while it's closed.");
}
function disableNotifications() { S.notify = { ...notifyPrefs(), on: false }; save(); saveNotifyState(); if (store.sw && store.sw.periodicSync) store.sw.periodicSync.unregister("snapstat-check").catch(() => {}); render(); toast("Notifications off"); }
async function checkNotificationsNow() {
  if (!notifyPrefs().on || !("serviceWorker" in navigator)) return;
  try { const reg = await navigator.serviceWorker.ready; if (reg.active) reg.active.postMessage({ type: "check" }); } catch { /* best effort */ }
}
function appPanel() {
  if (!window.SNAPSTAT_STANDALONE) return "";
  if (window.SnapStatNative && !natAlerts()) return `<section class="sec"><h2>Notifications</h2><div class="panel small"><p class="muted">Update the Android app to get sale, event and reminder notifications in it.</p></div></section>`;
  if (SLOT) return `<section class="sec"><h2>Notifications</h2><div class="panel small"><p class="muted">Notifications are set in your main account (they're for this phone, not each game account). Switch back to it in Profile to change them.</p></div></section>`;
  const p = notifyPrefs(), perm = natAlerts() ? (SnapStatNative.canNotify() ? "granted" : natAskedNotify ? "denied" : "default") : "Notification" in window ? Notification.permission : "unsupported";
  const box = (k, l) => `<label class="check"><input type="checkbox" data-notifychk="${k}" ${p[k] ? "checked" : ""} ${p.on ? "" : "disabled"}> ${l}</label>`;
  return `<section class="sec"><h2>App & notifications</h2><div class="panel stack small">
    ${natAlerts() ? `<p>The Android app checks the shops, bundles and event shops every few hours, even when it's closed. If you also turned notifications on in the Chrome version, turn them off there so you don't get two of each.</p>` : isInstalled() ? `<p>SNAP Stat is installed on this device.</p>` : installEvt ? `<p>Install SNAP Stat to open it like an app, use it offline and get notifications while it's closed.</p><div><button class="btn snap" data-a="installApp">Install the app</button></div>` : `<p>To install: open Chrome's ⋮ menu and tap <b>Add to Home screen</b> or <b>Install app</b>. Installed, it opens like an app, works offline and can notify you while it's closed.</p>`}
    <div class="row between"><b>Notifications</b>${p.on && perm === "granted" ? `<button class="btn sm" data-a="notifyOff">Turn off</button>` : `<button class="btn sm snap" data-a="notifyOn">Turn on</button>`}</div>
    ${natAlerts() ? box("webshop", "Reminder to claim your free web shop credits (at the daily reset, and again later if you haven't)") : ""}${box("wish", "A wishlist card or variant goes on sale (bundles and event shops, plus any shop you screenshot)")}${box("events", "An event or mode starts")}${box("season", "The season ends tomorrow")}${box("goals", "Evening reminder when a daily goal isn't done")}${box("missions", "Reminder before the daily checklist resets")}${box("daily", "A summary of your day at night")}
    ${perm === "denied" ? (natAlerts() ? `<p class="note">Android is blocking SNAP Stat's notifications. <button class="btn sm" data-a="natAsk" data-v="settings">Open app settings</button> and turn on Notifications.</p>` : `<p class="note">Chrome is blocking notifications for this site. Allow them in the site settings (the icon left of the address).</p>`) : ""}</div></section>`;
}

/* ============ Moderation: report and mute (posts), app owner, account deletion ============ */
function isMuted(uid) { return arr(S.muted).includes(uid); }
// In the shared (signed-in) app, only the app owner edits seasons and events. Until the owner is known, nobody does.
function canEditShared() { return store.mode !== "cloud" || isAppOwner(); }
const isAppOwner = () => store.mode === "cloud" && !!store.uid && typeof store.ownerUid === "string" && store.ownerUid !== "" && store.ownerUid === store.uid;
async function loadOwner() {
  if (store.mode !== "cloud" || !store.db) return;
  try { const s = await store.db.doc("config/owner").get(); store.ownerUid = s.exists ? String((s.data() || {}).uid || "") : ""; }
  catch { store.ownerUid = null; } // couldn't tell: nobody gets the owner's tools
  render(); loadAdmins();
}
const rp = { author: "", id: "", reason: "spam", note: "" };
const REPORT_REASONS = { spam: "Spam or ads", abuse: "Harassment or hate", nsfw: "Inappropriate content", cheat: "Cheating or scams", other: "Something else" };
function reportSheet() {
  const R = REPORT_REASONS;
  return `${sheetHead("Report this post", "Only the app owner and social admins see reports")}
    <div class="stack">${Object.entries(R).map(([k, l]) => `<label class="check"><input type="radio" name="rp" data-rp="${k}" ${rp.reason === k ? "checked" : ""}> ${l}</label>`).join("")}</div>
    <label class="f">Details (optional)<textarea id="rp-note" data-rpnote="1" maxlength="400">${esc(rp.note)}</textarea></label>
    <div class="row"><button class="btn snap" data-a="reportSend">Send report</button><button class="btn ghost" data-a="muteAuthor" data-id="${esc(rp.author)}">${isMuted(rp.author) ? "Unmute this player" : "Mute this player"}</button></div>
    <p class="muted small">Muting hides their posts from your feed. They aren't told.</p>`;
}
let reports = null;
async function loadReports() {
  reports = [];
  try { const snap = await new Promise((res, rej) => { const un = store.db.collection("reports").onSnapshot((s) => { res(s); if (typeof un === "function") un(); }, rej); }); reports = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => num(b.at) - num(a.at)); }
  catch { reports = "error"; }
  render();
}
function vReports() {
  if (reports === null && isModerator()) { loadReports(); }
  if (reports === "error") return `<section class="sec">${backBar("Reports")}<p class="note">Couldn't load reports. Check that the newest security rules are published in Firebase.</p><button class="btn" data-a="reportsRetry">Try again</button></section>`;
  const list = arr(reports);
  return `<section class="sec">${backBar("Reports")}
    ${!isModerator() ? `<p class="muted">Only the app owner and social admins can see reports.</p>` : list.length ? `<div class="list">${list.map((r) => { const post = arr(obj(shared.posts[r.author]).items).find((p) => p.id === r.post); return `<div class="li" style="flex-wrap:wrap"><div class="grow"><div class="t">${esc(obj(prof(r.author)).handle || "Player")} · ${esc(REPORT_REASONS[r.reason] || r.reason || "")}</div><div class="s">${post ? esc(String(post.text || "(no text)").slice(0, 140)) : "Post already removed"}${r.note ? " · “" + esc(r.note) + "”" : ""}</div></div>
      <div class="row">${post ? `<button class="btn sm danger" data-a="modRemove" data-id="${esc(r.id)}">Remove post</button>` : ""}<button class="btn sm ghost" data-a="modDismiss" data-id="${esc(r.id)}">Dismiss</button></div></div>`; }).join("")}</div>` : `<div class="empty"><span>No reports. Nice.</span></div>`}</section>`;
}
function ownerPanel() {
  if (store.mode !== "cloud" || store.provider !== "firebase" || store.ownerUid === null) return "";
  // Only you see the claim step: it shows on the account set as the owner in the app's settings, or when nobody owns it
  if (store.ownerUid && store.ownerUid !== store.uid) return "";
  if (store.ownerUid === undefined) return `<section class="sec"><h2>App owner</h2><div class="panel stack small"><p>Paste the new security rules into Firebase (Firestore Database › Rules) to turn on owner-only editing of seasons and events, post reports and picture uploads.</p></div></section>`;
  if (!store.ownerUid) return `<section class="sec"><h2>App owner</h2><div class="panel stack small"><p>Nobody owns this app yet. The owner is the only one who can edit seasons and events, and the one who sees post reports. Claim it now, from the account you'll always use. It can't be changed later from the app.</p><div><button class="btn snap" data-a="claimOwner">Make me the app owner</button></div></div></section>`;
  if (store.ownerUid === store.uid) return `<section class="sec"><h2>App owner</h2><div class="panel stack small"><p>You're the app owner. You can edit seasons and events, review reported posts and choose social admins (below).</p><div><button class="btn" data-a="go" data-to="social/reports">Reported posts</button></div></div></section>`;
  return "";
}
function dangerPanel() {
  if (store.mode !== "cloud" || store.provider !== "firebase") return "";
  return `<section class="sec"><h2>Delete account</h2><div class="panel stack small"><p>Deletes your profile, posts, decks, matches and everything else saved to your account, then removes the account itself. This can't be undone.</p>
    <div><button class="btn ghost danger" data-a="deleteAccount">${ui.delArm ? "Tap again to delete everything" : "Delete my account"}</button></div></div></section>`;
}
async function deleteAccount() {
  const uidNow = store.uid; if (!uidNow || !store.fb) return;
  toast("Deleting your account…");
  // Nothing is saved while it's deleted: a change still waiting to be saved would put the data back
  const hold = () => { clearTimeout(saveTimer); clearTimeout(weekTimer); clearTimeout(profTimer); clearTimeout(ovTimer); dirty = false; dirtyWeeks.clear(); };
  hold(); store.ready = false; S.overlay = false;
  // This phone stops notifying you about the account, and forgets what it watched (the Android app and the browser's background check)
  S.notify = { ...notifyPrefs(), on: false };
  try { if (natAlerts()) SnapStatNative.setAlerts(JSON.stringify({ prefs: { on: false }, saved: Date.now() })); } catch { /* best effort */ }
  try { if ("caches" in window) await caches.delete("snapstat-notify"); if (store.sw && store.sw.periodicSync) await store.sw.periodicSync.unregister("snapstat-check"); } catch { /* best effort */ }
  try {
    const db = store.db, del = (p) => db.doc(p).delete().catch(() => {});
    for (const wk of new Set([...(SLOT ? [] : Object.keys(matchWeeks)), ...(await collIds(`data/users/${uidNow}/state/matches`))])) await del(`data/users/${uidNow}/state/matches/${wk}`);
    for (const p of [`data/users/${uidNow}/state`, `profiles/${uidNow}`, `posts/${uidNow}`, `reactions/${uidNow}`, `decks/${uidNow}`, `followreq/${uidNow}`, `approvals/${uidNow}`, `images/${uidNow}`, `pdetail/${uidNow}`, `allykeys/${uidNow}`]) await del(p);
    for (const [id, j] of Object.entries(tjoins)) if (j && j.uid === uidNow) await del("tjoin/" + id);
    for (const [id, t] of Object.entries(tourneys)) if (t && t.by === uidNow) await del("tournaments/" + id);
    await del("live/" + uidNow); await del(`data/users/${uidNow}/accounts`);
    // Other game accounts, including ones added or removed on another device (found in what's saved)
    const slots = new Set([...accountsList().map((a) => a.id), ...arr(lsGet("snapstat.removedAccounts")), ...(await collIds(`data/users/${uidNow}`)).filter((id) => /^slot-./.test(id)).map((id) => id.slice(5))].filter(Boolean).map(String));
    for (const id of slots) { for (const wk of await collIds(`data/users/${uidNow}/slot-${id}/matches`)) await del(`data/users/${uidNow}/slot-${id}/matches/${wk}`); await del(`data/users/${uidNow}/slot-${id}`); }
    if (store.fb.deleteAccount) await store.fb.deleteAccount();
    hold(); try { localStorage.clear(); } catch { /* ignore */ }
    location.reload();
  } catch (e) {
    // The saved data is gone but the sign-in account isn't: this screen starts afresh too, so nothing deleted is saved back
    S = defaultState(); matchWeeks = {}; _mVer++; store.ready = true; render(); try { pushWidget(); } catch { /* no widget */ }
    toast("Your data is deleted, but the sign-in account isn't yet. Tap Delete my account again to finish (you may be asked to sign in).");
  }
}

/* ============ Pictures stored in the database (Firebase version) ============ */
const imgCache = {};
function fsImage(uid) {
  if (imgCache[uid] !== undefined) return imgCache[uid];
  imgCache[uid] = "";
  if (store.db) store.db.doc("images/" + uid).get().then((s) => { const d = s.exists ? s.data() || {} : {}; if (d.banner) { imgCache[uid] = d.banner; refreshView(); } }).catch(() => {});
  return "";
}
const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const firebaseAssets = {
  maxSize: (which) => (which === "banner" ? 900 : 160),
  quality: (which) => (which === "banner" ? 0.72 : 0.8),
  async upload(blob, which) {
    const data = await blobToDataUrl(blob);
    if (which === "banner") {
      if (data.length > 390000) throw new Error("too big");
      await store.db.doc("images/" + store.uid).set({ banner: data, updated: Date.now() });
      imgCache[store.uid] = data; return { url: "", fs: store.uid };
    }
    return { url: data };
  },
};
