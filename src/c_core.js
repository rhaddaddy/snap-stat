/* ============ Helpers ============ */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const keyOf = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Alliance names: same as keyOf for ordinary names, and names in other alphabets or made of symbols still get a key
const allyKey = (n) => keyOf(n) || (() => { const u = String(n || "").normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu, ""); return u ? "u:" + u : ""; })();
const defId = (n) => String(n || "").replace(/[^A-Za-z0-9]/g, "");
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const fmt = (n) => num(n).toLocaleString();
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
// Progress toward a whole: 100% only when it's all there (506 of 507 is 99%, not a rounded-up 100%)
const donePct = (a, b) => (!b ? 0 : a >= b ? 100 : Math.min(99, Math.floor((a / b) * 100)));
// A bar's width: one that isn't finished always shows a gap at the end
const barW = (a, b) => (!b ? 0 : a >= b ? 100 : clamp(Math.min(96, (a / b) * 100), 0, 96));
const DAY = 864e5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const signed = (n) => (n > 0 ? "+" + n : String(n));
const clone = (x) => JSON.parse(JSON.stringify(x));
const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
function dayStr(ts) { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function dateStr(d) { if (!d) return ""; const t = new Date(d + "T12:00").getTime(); return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""; }
function dateTimeStr(ts) { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
// "just now", "5m ago", "3d ago", or "on Oct 3" for anything older than a week
function agoTxt(t) { const a = ago(t); return a === "now" ? "just now" : /^\d+[mhd]$/.test(a) ? a + " ago" : "on " + a; }
function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d"; return dayStr(ts);
}
function localDate(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function weekKey(ts) { const d = new Date(ts); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return "w" + localDate(d.getTime()); }
function toInputDT(ts) { const d = new Date(ts); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
const dayStart = (d) => new Date(d + "T00:00").getTime();
const dayEnd = (d) => new Date(d + "T23:59:59").getTime();
// Time left, to the second: "3d 04h 09m 05s", "23h 09m 41s", "9m 05s", "41s"
function countdown(ts) {
  const d = ts - Date.now(); if (!(d > 0)) return "ended"; if (d === Infinity) return "no end date";
  const days = Math.floor(d / DAY), h = Math.floor((d % DAY) / 3600e3), m = Math.floor((d % 3600e3) / 60e3), s = Math.floor((d % 60e3) / 1000), p = (x) => String(x).padStart(2, "0");
  return days ? `${days}d ${p(h)}h ${p(m)}m ${p(s)}s` : h ? `${h}h ${p(m)}m ${p(s)}s` : m ? `${m}m ${p(s)}s` : `${s}s`;
}
// A countdown that ticks every second while it's on screen (see the ticker in c4_clock.js)
// "ends in 3d 04h…", or "no end date yet" for a season or event whose end isn't known
const endsTxt = (ts) => (Number.isFinite(Number(ts)) ? "ends in " + cdSpan(ts) : "no end date yet");
const cdSpan = (ts) => { const t = Number(ts), txt = esc(countdown(t)); return Number.isFinite(t) && t > Date.now() ? `<span class="cd" data-cd="${t}">${txt}</span>` : txt; };
function hue(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
/* Stylized "art": a two-tone gradient with halftone dots, seeded by a name. Stands in for card art, which isn't shown. */
function artStyle(seed) { const h = hue(seed); return `--a1:hsl(${h} 70% 46%);--a2:hsl(${(h + 48) % 360} 65% 16%)`; }
// A picture link from someone's profile: https only (or a picture stored inside the profile itself)
function imgSrcOk(u) { const s = String(u || ""); return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(s) ? s : safeUrl(s); }
function avatarHtml(a, name, id, cls = "") {
  const n = String(name || "?").trim();
  // Profile pictures are hexagons, like in the game.
  if (a && a.kind === "img" && (a.url || a.fs)) { const src = imgSrcOk(a.url) || fsImage(a.fs); if (src) return `<span class="av hex has-img ${cls}"><img class="lki" src="${esc(src)}" alt="" style="width:100%;height:100%;left:0;top:0;object-fit:cover">${borderHtml(a.border, { hex: true, still: !/\b(lg|xl)\b/.test(cls) })}</span>`; }
  // A character's face or art, chosen in the picture picker (older picks of a whole card show the face too)
  const l = lookOf(a, "avatar"); if (l) return lookAvatar(l, n, id, cls);
  return `<span class="av hex art ${cls}" style="${artStyle(id || n)}">${esc((n[0] || "?").toUpperCase())}${borderHtml("", { hex: true, still: true })}</span>`;
}
function bannerHtml(b, name) {
  if (b && b.kind === "img" && (b.url || b.fs)) { const src = imgSrcOk(b.url) || fsImage(b.fs); if (src) return `<div class="banner"><img src="${esc(src)}" alt="">${borderHtml(b.border)}</div>`; }
  const l = lookOf(b, "banner"); if (l) return lookBanner(l, name);
  return `<div class="banner art" style="${artStyle(name || "banner")}"><span class="big">${esc((name || "?").slice(0, 1).toUpperCase())}</span></div>`;
}
const ICON = {
  cube: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 3.5 7.2v9.6L12 21.5l8.5-4.7V7.2zM3.5 7.2 12 12l8.5-4.8M12 12v9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  up: `<svg class="ic" viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8c1.7 0 2.6 1 2.3 2.6L12.6 9H19a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.7 20H7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  down: `<svg class="ic" viewBox="0 0 24 24"><path d="M17 13V4h3v9zM17 13l-4 8c-1.7 0-2.6-1-2.3-2.6l.7-3.4H5a2 2 0 0 1-2-2.3l1.3-7A2 2 0 0 1 6.3 4H17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  talk: `<svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  x: `<svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  plus: `<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  spark: `<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" fill="currentColor"/></svg>`,
  copy: `<svg class="ic" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  save: `<svg class="ic" viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  lock: `<svg class="ic" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
};
const cubes = (n, cls = "") => `<span class="cube num ${cls}">${ICON.cube}${esc(n)}</span>`;
function rankBadge(r) { const s = String(r || "").trim(); if (!s) return `<span class="rank" style="opacity:.35">—</span>`; if (/^inf/i.test(s)) return `<span class="rank inf" title="Infinite">INF</span>`; return `<span class="rank">${esc(s)}</span>`; }
function rankVal(r) { const s = String(r || ""); return /^inf/i.test(s) ? 101 : num(s); }

/* ============ State ============ */
function defaultState() {
  return {
    v: 2,
    me: { name: "", handle: "", snapId: "", country: "", visibility: "public", alliance: "", colLevel: "", rank: "", peak: "", share: true, avatar: null, banner: null, featuredDeck: "", onboarded: false },
    wallet: { credits: 0, gold: 0, tokens: 0 },
    owned: {}, wishCards: {}, favCards: {}, variants: [], cosmetics: [], addedCards: [], cardEdits: {},
    decks: [], shops: [], redeemed: {}, custom: [], following: [], localPromos: [], localSeasons: [], localEvents: [],
    ranks: {}, passes: {}, eventProg: {}, collected: {}, alliance: { points: "", tier: "", tiers: "", role: "" },
    climb: {}, splits: {}, quick: {}, prices: { s5: 6000, s4: 3000, s3: 650 },
    updated: 0,
  };
}
function mergeDefaults(d) {
  const base = defaultState(); d = obj(d);
  const o = Object.assign(base, d);
  o.me = Object.assign(defaultState().me, obj(d.me));
  o.wallet = Object.assign(defaultState().wallet, obj(d.wallet));
  o.alliance = Object.assign(defaultState().alliance, obj(d.alliance));
  for (const k of ["variants", "cosmetics", "addedCards", "decks", "shops", "custom", "following", "localPromos", "localSeasons", "localEvents"]) o[k] = arr(o[k]);
  for (const k of ["owned", "wishCards", "favCards", "cardEdits", "redeemed", "ranks", "passes", "eventProg", "collected", "climb", "splits", "quick"]) o[k] = obj(o[k]);
  o.prices = Object.assign(defaultState().prices, obj(d.prices));
  o.decks.forEach((dk) => { dk.cards = arr(dk.cards); dk.variants = obj(dk.variants); if (!dk.status) dk.status = "active"; });
  if (d.v !== 2 && d.me && d.me.handle && !d.me.onboarded) o.me.onboarded = true;
  o.v = 2;
  return o;
}
let S = defaultState();
let matchWeeks = {};
let shared = { profiles: {}, posts: {}, reactions: {}, promos: {}, seasons: {}, events: {}, decks: {}, followreq: {}, approvals: {} };
// Profiles, posts and decks as the database sends them. A private player's public profile only has their handle and
// picture; the rest (stats, decks, posts) is in pdetail/{uid}, which the database only lets their approved followers,
// their alliance and moderators read. shared.* is the two put together for the parts of the app that show them.
const sharedRaw = { profiles: {}, posts: {}, decks: {} };
const pdetails = {}, pdSubs = new Map();
let sharedVer = 0;
const ui = { tab: "home", more: null, homeSub: "overview", setSub: "app", period: "all", playSeg: "live", cardsSeg: "cards", cardFilter: "all", cardCost: "any", cardQ: "", cardSort: "cost", powMin: "", powMax: "",
  varQ: "", varFilter: "all", varSort: "card", varRarity: "", varArtist: "", social: "feed", feedFilter: "all", openComments: {}, resetArm: false, seasonTab: "current", eventTab: "current", lbSort: "cubes", lbScope: "all", statView: "cards" };
const store = { mode: "local", db: null, uid: null, sample: null, downloads: null, assets: null, stateRef: null, ready: false };

/* ============ Cards ============ */
let _cardsCache = null, _cardsSig = "";
function baseCards() {
  return CARD_SRC.trim().split("\n").map((l) => {
    const [name, c, p, t, ab] = l.split("|");
    return { key: keyOf(name), name, cost: num(c), power: num(p), tags: (t || "").split(" ").filter(Boolean), ability: ab || "", series: "", release: "", code: cardCode(CARD_IDS[name] || name) };
  });
}
function parseLine(line) {
  const m = String(line).match(/^\s*(card back|cardback|card|variant|avatar|title|emote|other)\s*[:\-–]\s*(.+)$/i);
  if (!m) return { kind: "other", name: String(line).trim() };
  const k = m[1].toLowerCase().replace(" ", "");
  return { kind: k === "cardback" ? "cardback" : k, name: m[2].trim() };
}
function catalogCards() {
  const out = [];
  for (const s of seasons()) {
    arr(s.cards).forEach((n) => out.push({ name: String(n).trim(), release: s.start, from: s.name }));
    if (s.passCard) out.push({ name: String(s.passCard).trim(), release: s.start, from: s.name });
  }
  for (const e of events()) arr(e.collectibles).map(parseLine).filter((x) => x.kind === "card").forEach((x) => out.push({ name: x.name, release: e.start, from: e.name }));
  return out.filter((x) => x.name);
}
function allCards() {
  const sig = `${S.updated}|${saveVer}|${S.addedCards.length}|${Object.keys(S.cardEdits).length}|` + sharedVer + "|" + (S.localSeasons.length + S.localEvents.length) + localDate(Date.now()) + "|" + catVer + "|" + vdVer + "|" + schedVer + "|" + Math.floor((Date.now() - 19 * 3600e3) / DAY);
  if (_cardsCache && sig === _cardsSig) return _cardsCache;
  const map = new Map();
  baseCards().forEach((c) => map.set(c.key, c));
  for (const line of CARD_EXTRA.trim().split("\n")) { const [code, name] = line.split("|"); const k = keyOf(name); if (!map.has(k)) map.set(k, { key: k, name, cost: "?", power: "?", tags: [], ability: "", series: "", release: "", code }); }
  for (const c of catalogCards()) { const k = keyOf(c.name); if (!map.has(k)) map.set(k, { key: k, name: c.name, cost: "?", power: "?", tags: [], ability: "", series: "", release: c.release, from: c.from, catalog: true }); }
  mergeCatalog(map);
  arr(S.addedCards).forEach((c) => { if (!c || !c.key) return; const m = map.get(c.key); if (m && m.resolved) return; map.set(c.key, m && m.catId ? { tags: [], series: "", ability: "", release: "", ...c, ...m, added: true } : { tags: [], series: "", ability: "", release: "", ...c, added: true }); });
  for (const [k, e] of Object.entries(obj(S.cardEdits))) if (map.has(k)) map.set(k, { ...map.get(k), ...e });
  const today = localDate(Date.now()), now = Date.now();
  for (const c of map.values()) {
    // Not out yet: a future release date, or (once the card data has loaded) Marvel Snap Zone lists it as unreleased or doesn't know it. Cards you own always count as out.
    c.upcoming = !S.owned[c.key] && !!((c.release && (resetOn(c.release) > now || (!Number.isFinite(resetOn(c.release)) && c.release > today))) || (!c.added && (c.catUnreleased || (CAT && c.catalog && !c.catId)))); if (!c.code) c.code = cardCode(c.name); c.unknownName = /^Unknown card \(/.test(c.name);
    // Versions that only exist inside a game mode (Champion, Web Slingers, Thunderbolts...) aren't part of anyone's collection, so they're left out of the lists unless you own one.
    c.hidden = !S.owned[c.key] && !c.added && !!c.catModeOnly; }
  const costN = (c) => (c.cost === "?" || c.cost === "" ? 99 : num(c.cost));
  const full = [...map.values()].sort((a, b) => costN(a) - costN(b) || a.name.localeCompare(b.name));
  _byKey = new Map(full.map((c) => [c.key, c])); _byCode = new Map(); full.forEach((c) => { if (c.code && !_byCode.has(c.code)) _byCode.set(c.code, c); });
  _byLoose = new Map(); full.forEach((c) => { const l = looseCode(c.code); if (l) _byLoose.set(l, _byLoose.has(l) && _byLoose.get(l) !== c ? null : c); });
  full.forEach((c) => { const nk = keyOf(c.name); if (nk && !_byKey.has(nk)) _byKey.set(nk, c); });
  _cardsCache = full.filter((c) => !c.hidden);
  _cardsSig = sig;
  return _cardsCache;
}
let _byKey = new Map(), _byCode = new Map(), _byLoose = new Map();
// SnapVault spells some new cards' codes a little differently (Vampire America Chavez is "VmprmrcChvz14", not "VmprAmrcChvz14"),
// so if there's no exact match, compare the letters without any vowels, as long as only one card fits.
const looseCode = (code) => String(code || "").toLowerCase().replace(/[aeiouy]/g, "");
function cardByCode(code) { allCards(); const c = String(code || "").trim(); return _byCode.get(c) || _byLoose.get(looseCode(c)) || null; }
function customCard(id) { const c = S.custom.find((x) => x.id === id); return c ? { key: "custom:" + c.id, name: c.name, cost: c.cost, power: c.power, ability: c.ability, tags: [], custom: true, frame: c.frame } : null; }
function card(k) {
  if (String(k).startsWith("custom:")) return customCard(String(k).slice(7)) || { key: k, name: "Deleted custom card", cost: "?", power: "?", tags: [], custom: true, unknown: true };
  allCards(); return _byKey.get(k) || { key: k, name: k, cost: "?", power: "?", tags: [], ability: "", unknown: true };
}
function cardByName(n) { allCards(); return _byKey.get(keyOf(n)); }
function variantById(id) { return S.variants.find((v) => v.id === id); }
function favVariant(k) { return S.variants.find((v) => v.card === k && v.favorite); }
// The picture for a card: the variant the deck uses (or your favourite), else the card's own art.
function chipArt(c, opts = {}) {
  if (c.custom || c.unknown) return "";
  const v = opts.v || (opts.deck ? deckVariant(opts.deck, c.key) : null);
  return variantArt(v) || c.art || "";
}
function cardChip(k, opts = {}) {
  const c = typeof k === "string" ? card(k) : k;
  const own = c.custom || !!S.owned[c.key];
  const tag = opts.a ? "button" : "span";
  const attrs = opts.a ? `data-a="${opts.a}" data-k="${esc(c.key)}" ${opts.extra || ""}` : "";
  const cls = `cchip ${opts.noOwn || own ? "" : "miss"} ${opts.on ? "on" : ""}`;
  const art = opts.text || !showArt() ? "" : chipArt(c, opts);
  // A small card with its art, like the game shows it; the plain chip is kept for places that only have room for a name
  if (art || (c.custom && !opts.text)) {
    const pow = opts.pow !== undefined ? opts.pow : c.power, changed = opts.pow !== undefined && String(opts.pow) !== String(c.power);
    return `<${tag} class="${cls} cmini ${opts.size || ""}" ${attrs} aria-label="${esc(c.name)}, cost ${esc(c.cost)}, power ${esc(pow)}"><span class="cpic ${art ? "has-img" : ""} ${c.custom ? "fr-" + clamp(num(c.frame), 0, 5) : ""}" style="${c.custom ? "" : artStyle(c.key)}">${art ? imgTag(art, "cimg") : ""}<span class="c">${esc(c.cost)}</span><span class="p ${changed ? "now" : "base"}">${esc(pow)}</span></span><span class="nm">${esc(c.name)}${opts.suffix || ""}</span></${tag}>`;
  }
  return `<${tag} class="${cls}" ${attrs}><span class="c">${esc(c.cost)}</span>${opts.pow !== undefined ? `<span class="p">${esc(opts.pow)}</span>` : ""}<span>${esc(c.name)}${opts.suffix || ""}</span></${tag}>`;
}
function nameChip(name, suffix = "") { const c = cardByName(name); return c ? cardChip(c.key, { noOwn: true, suffix }) : `<span class="cchip"><span class="c">?</span><span>${esc(name)}${suffix}</span></span>`; }
function cardFace(c, opts = {}) {
  const v = opts.variant;
  const seed = v ? v.id + v.name : c.key;
  const style = c.custom ? "" : artStyle(seed);
  const img = c.custom ? "" : imgTag(opts.art || variantArt(v) || c.art, "cimg");
  return `<button class="ct art ${c.custom ? "fr-" + clamp(num(c.frame), 0, 5) : ""} ${img ? "has-img" : ""} ${opts.cls || ""}" style="${style}" data-a="${opts.a || "cardOpen"}" data-k="${esc(c.key)}" ${opts.extra || ""} aria-label="${esc(c.name)}${v ? ", " + esc(v.name) : ""}, cost ${esc(c.cost)}, power ${esc(c.power)}">
    ${img}<span class="pip cost">${esc(c.cost)}</span><span class="pip pow">${esc(c.power)}</span>${opts.badges || ""}<span class="glyph">${esc((c.name[0] || "?").toUpperCase())}</span>
    <span class="nm">${esc(c.name)}</span>${v && !opts.noSub ? `<span class="sub">${esc(opts.sub || v.name)}</span>` : opts.sub ? `<span class="sub">${esc(opts.sub)}</span>` : ""}</button>`;
}

/* ============ Matches ============ */
let _mVer = 0, _mCache = null, _mCacheVer = -1;
function allMatches() {
  if (_mCacheVer === _mVer && _mCache) return _mCache;
  const out = [];
  for (const items of Object.values(matchWeeks)) for (const m of arr(items)) if (m && m.id) out.push(m);
  out.sort((a, b) => b.ts - a.ts);
  _mCache = out; _mCacheVer = _mVer;
  return out;
}
const realMatches = () => allMatches().filter((m) => !m.example);
function findMatch(id) { for (const [wk, items] of Object.entries(matchWeeks)) { const i = arr(items).findIndex((m) => m.id === id); if (i >= 0) return { wk, i }; } return null; }
const preLoad = { adds: new Set(), dels: new Set() };
function putMatch(m) {
  if (store.mode === "cloud" && !store.matchesLoaded) { preLoad.adds.add(m.id); preLoad.dels.delete(m.id); }
  const found = findMatch(m.id); const wk = weekKey(m.ts);
  if (found) { matchWeeks[found.wk] = matchWeeks[found.wk].filter((x) => x.id !== m.id); dirtyWeek(found.wk); }
  matchWeeks[wk] = [...arr(matchWeeks[wk]), m]; dirtyWeek(wk); _mVer++;
  extRun(EXT.onMatch, m, !found);
}
function removeMatch(id) { if (store.mode === "cloud" && !store.matchesLoaded) { preLoad.dels.add(id); preLoad.adds.delete(id); } const f = findMatch(id); if (!f) return; matchWeeks[f.wk] = matchWeeks[f.wk].filter((x) => x.id !== id); dirtyWeek(f.wk); _mVer++; }

/* ============ Seasons, events & periods ============ */
function seasons() {
  const src = mergeSchedule(store.mode === "cloud" ? Object.entries(shared.seasons).map(([id, s]) => ({ ...s, id })) : S.localSeasons, "seasons");
  const list = src.filter((s) => s && s.name && s.start).map((s) => ({ ...s, ...seasonTimes(s) })).filter((s) => Number.isFinite(s.startTs)).sort((a, b) => a.startTs - b.startTs);
  // A season ends when the next one starts, even if its end date was a guess that runs over.
  for (let i = 0; i < list.length - 1; i++) if (list[i].endTs >= list[i + 1].startTs) list[i].endTs = list[i + 1].startTs - 1;
  return list.reverse();
}
function events() {
  const src = mergeSchedule(store.mode === "cloud" ? Object.entries(shared.events).map(([id, e]) => ({ ...e, id })) : S.localEvents, "events");
  return src.filter((e) => e && e.name && e.start).map((e) => ({ ...e, ...eventTimes(e) }))
    .filter((e) => Number.isFinite(e.startTs)).sort((a, b) => a.startTs - b.startTs);
}
function timeState(x) { const n = Date.now(); return n < x.startTs ? "upcoming" : n > x.endTs ? "past" : "live"; }
function currentSeason() { return seasons().find((s) => timeState(s) === "live") || null; }
function periods() {
  const now = Date.now(); const y0 = new Date(new Date().getFullYear(), 0, 1).getTime();
  const list = [
    { id: "all", label: "All time", from: 0, to: Infinity }, { id: "ytd", label: "YTD", from: y0, to: Infinity },
    { id: "d90", label: "Last 90", from: now - 90 * DAY, to: Infinity }, { id: "d60", label: "Last 60", from: now - 60 * DAY, to: Infinity },
    { id: "d30", label: "Last 30", from: now - 30 * DAY, to: Infinity },
  ];
  const ss = seasons().filter((s) => s.startTs <= now);
  if (ss.length) ss.forEach((s) => list.push({ id: "s:" + s.id, label: (timeState(s) === "live" ? "This season · " : "") + s.name, from: s.startTs, to: s.endTs, season: s }));
  else {
    const months = new Set([localDate(now).slice(0, 7)]); allMatches().forEach((m) => months.add(localDate(m.ts).slice(0, 7)));
    [...months].sort().reverse().forEach((ym, i) => {
      const [y, mo] = ym.split("-").map(Number);
      list.push({ id: "m:" + ym, label: (i === 0 ? "This month · " : "") + new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" }), from: new Date(y, mo - 1, 1).getTime(), to: new Date(y, mo, 1).getTime() - 1 });
    });
  }
  return list;
}
function periodById(id) { return periods().find((p) => p.id === id) || periods()[0]; }
function currentSeasonPeriod() { return periods().find((p) => p.label.startsWith("This ")); }
const plainLabel = (p) => (p ? p.label.replace(/^This (season|month) · /, "") : "");
function inPeriod(ms, p) { return ms.filter((m) => m.ts >= p.from && m.ts <= p.to); }

/* ============ Stats ============ */
function statsFor(ms) {
  const s = { games: ms.length, w: 0, l: 0, t: 0, cubes: 0, cubeGames: 0, snaps: 0, snapW: 0, ret: 0, oppRet: 0, bots: 0, maxWin: 0 };
  for (const m of ms) {
    if (m.result === "W") s.w++; else if (m.result === "L") s.l++; else s.t++;
    s.cubes += num(m.cubes); if (!m.noCubes) s.cubeGames++;
    if (m.snapped) { s.snaps++; if (m.result === "W") s.snapW++; }
    if (m.retreated) s.ret++; if (m.oppRetreated) s.oppRet++; if (m.bot === "likely") s.bots++;
    s.maxWin = Math.max(s.maxWin, num(m.cubes));
  }
  s.wr = pct(s.w, s.w + s.l); s.cpg = s.cubeGames ? Math.round((s.cubes / s.cubeGames) * 100) / 100 : 0; s.snapWr = pct(s.snapW, s.snaps); // results from SnapVault have no cubes, so they're left out of cubes per game
  return s;
}
function slimStats(s) { return { games: s.games, w: s.w, l: s.l, t: s.t, wr: s.wr, cubes: s.cubes, cpg: s.cpg }; }
/* Per-card and per-location analytics from tracked matches (power and placement saved by the live tracker or the match form) */
function cardAnalytics(ms, restrict) {
  const tracked = ms.filter((m) => m.tracked && (arr(m.plays).length || arr(obj(obj(m.gy).my).destroyed).length));
  const by = {};
  const touch = (k) => (by[k] = by[k] || { k, played: 0, w: 0, l: 0, t: 0, powers: [], max: 0, inDeckGames: 0, destroyed: 0, discarded: 0 });
  for (const m of tracked) {
    const playedSet = new Set(arr(m.plays).map((p) => p.k));
    const gy = obj(obj(m.gy).my);
    arr(gy.destroyed).forEach((k) => { playedSet.add(k); touch(k).destroyed++; });
    arr(gy.discarded).forEach((k) => (touch(k).discarded++));
    for (const k of playedSet) {
      if (restrict && !restrict.includes(k)) continue;
      const r = touch(k); r.played++;
      if (m.result === "W") r.w++; else if (m.result === "L") r.l++; else r.t++;
      const p = arr(m.plays).find((x) => x.k === k);
      if (p) { r.powers.push(num(p.power)); r.max = Math.max(r.max, num(p.power)); }
    }
  }
  if (restrict) restrict.forEach((k) => { touch(k).inDeckGames = tracked.length; });
  return Object.values(by).filter((r) => !restrict || restrict.includes(r.k)).map((r) => ({ ...r, avg: r.powers.length ? Math.round((r.powers.reduce((a, b) => a + b, 0) / r.powers.length) * 10) / 10 : 0, wr: pct(r.w, r.w + r.l), rate: tracked.length ? pct(r.played, tracked.length) : 0, tracked: tracked.length }));
}
function locationAnalytics(ms) {
  const by = {};
  for (const m of ms.filter((x) => x.tracked)) for (const L of arr(m.locs)) {
    const name = String(L.name || "").trim(); if (!name) continue;
    const k = keyOf(name); const r = (by[k] = by[k] || { name, games: 0, mw: 0, ml: 0, lw: 0, ll: 0, powers: [], max: 0 });
    r.games++; if (m.result === "W") r.mw++; else if (m.result === "L") r.ml++;
    if (num(L.my) > num(L.opp)) r.lw++; else if (num(L.my) < num(L.opp)) r.ll++;
    r.powers.push(num(L.my)); r.max = Math.max(r.max, num(L.my));
  }
  return Object.values(by).map((r) => ({ ...r, wr: pct(r.mw, r.mw + r.ml), lwr: pct(r.lw, r.lw + r.ll), avg: r.powers.length ? Math.round((r.powers.reduce((a, b) => a + b, 0) / r.powers.length) * 10) / 10 : 0 })).sort((a, b) => b.games - a.games);
}
function deckInsights(d) {
  const ms = deckMatches(d);
  const rows = cardAnalytics(ms, d.cards.filter((k) => !String(k).startsWith("custom:")));
  const tracked = ms.filter((m) => m.tracked).length;
  const pool = rows.filter((r) => r.played >= Math.max(1, Math.ceil(tracked * 0.15)));
  const mvp = [...pool].sort((a, b) => b.wr - a.wr || b.avg - a.avg)[0];
  const most = [...rows].sort((a, b) => b.played - a.played)[0];
  const least = [...rows].sort((a, b) => a.played - b.played || a.wr - b.wr)[0];
  const highest = [...rows].sort((a, b) => b.max - a.max)[0];
  return { ms, rows, tracked, mvp, most, least, highest, locs: locationAnalytics(ms) };
}
function deckMatches(d) { return allMatches().filter((m) => m.deckId === d.id || (!m.deckId && m.deckName === d.name)); }

/* ============ Persistence ============ */
const LS = { state: "cubeledger.state", matches: "cubeledger.matches", live: "cubeledger.live" };
/* Each MARVEL SNAP account you add keeps its own data. "" is your main account. */
const SLOT = (() => { try { return localStorage.getItem("snapstat.slot") || ""; } catch { return ""; } })();
if (SLOT) for (const k of Object.keys(LS)) LS[k] += "." + SLOT;
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(k, v) {
  let t; try { t = JSON.stringify(v); } catch { return false; }
  try { localStorage.setItem(k, t); return true; } catch { /* full, or storage unavailable */ }
  try { for (const key of Object.keys(localStorage)) if (/^snapstat-[a-z-]+-v\d+$/.test(key)) localStorage.removeItem(key); localStorage.setItem(k, t); return true; } catch { /* still full */ }
  if (!lsSet.warned) { lsSet.warned = true; setTimeout(() => { try { toast("This phone's storage for SNAP Stat is full, so the last change wasn't saved. Sign in to save to your account instead."); } catch { /* not ready */ } }, 0); }
  return false;
}
let dirty = false, saveTimer = null, writing = null;
let saveVer = 0;
function save() { syncDeckVersions(); saveVer++; S.updated = Date.now(); dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flushState, 600); }
// Set when something is saved on this device without an account, so it's added to the account at the next sign-in
const LOCAL_AT = "snapstat.localAt" + (SLOT ? "." + SLOT : "");
async function flushState() {
  if (writing) await writing.catch(() => {});
  if ((store.mode === "cloud" && !store.stateLoaded) || (store.provider === "firebase" && !store.ready)) { clearTimeout(saveTimer); saveTimer = setTimeout(flushState, 1500); return; }
  const ver = saveVer, body = typeof compactState === "function" ? compactState(clone(S)) : clone(S); let ok = true;
  if (store.mode === "cloud" && !flushState.warned) { let n = 0; try { n = JSON.stringify(body).length; } catch { /* fine */ } if (n > 850000) { flushState.warned = true; toast("Your saved data is nearly too big for one account to hold. Please tell Claude in your SNAP Stat chat."); } }
  // A save the database turned down for good (too big, not allowed) isn't kept waiting, or other devices' changes would never arrive
  let permanent = false;
  writing = (async () => { if (store.mode === "cloud") { try { await store.stateRef.set(body); } catch (e) { ok = false; permanent = /invalid-argument|permission/.test(String(e && e.code)); handleDbErr(e, "save"); } } else { ok = lsSet(LS.state, body); if (ok && store.ready) lsSet(LOCAL_AT, Date.now()); } })();
  await writing; writing = null; if ((ok || permanent) && saveVer === ver) dirty = false; syncProfile();
  if (natAlerts() && notifyPrefs().on) saveNotifyState();
  pushWidget();
}
const dirtyWeeks = new Set(); let weekTimer = null, weekWriting = null;
function dirtyWeek(wk) { dirtyWeeks.add(wk); clearTimeout(weekTimer); weekTimer = setTimeout(flushWeeks, 500); }
async function flushWeeks() {
  if (weekWriting) await weekWriting.catch(() => {});
  if ((store.mode === "cloud" && !store.matchesLoaded) || (store.provider === "firebase" && !store.ready)) { clearTimeout(weekTimer); weekTimer = setTimeout(flushWeeks, 1500); return; }
  weekWriting = (async () => {
    const wks = [...dirtyWeeks]; dirtyWeeks.clear();
    if (store.mode === "cloud") for (const wk of wks) { const ref = store.stateRef.collection("matches").doc(wk); const items = arr(matchWeeks[wk]); try { if (items.length) await ref.set({ items: clone(items) }); else await ref.delete(); } catch (e) { if (!/invalid-argument|permission/.test(String(e && e.code))) dirtyWeeks.add(wk); handleDbErr(e, "save matches"); } }
    else if (lsSet(LS.matches, matchWeeks)) { if (store.ready) lsSet(LOCAL_AT, Date.now()); } else wks.forEach((wk) => dirtyWeeks.add(wk));
  })();
  await weekWriting; weekWriting = null; syncProfile(); pushWidget();
}
function handleDbErr(e, what) {
  const code = e && e.code;
  if (code === "quota_exceeded" || code === "resource-exhausted") toast("Storage is full. Delete old matches or posts to keep saving.");
  else if (/permission/.test(String(code))) toast("Couldn't " + what + ": the database blocked it. Check the security rules from the setup guide.");
  else if (code === "invalid_argument") toast("Couldn't " + what + ": you need Contributor access to this app.");
  else if (code === "invalid-argument") toast(/size|bytes|too large|maximum/i.test(String(e.message)) ? "Couldn't " + what + ": your saved data is bigger than one account can hold. Delete old matches or screenshot history." : "Couldn't " + what + ": something in it can't be saved. Try again, and send the tracker log if it keeps happening.");
  else if (code === "unauthenticated") toast("You've been signed out. Sign in again to keep saving to your account.");
  else if (code === "revoked") toast("Access to saved data changed. Reload the page.");
  else toast("Couldn't " + what + ". Try again in a moment.");
}
function deckPublic(d) {
  const st = statsFor(deckMatches(d).filter((m) => !m.example));
  return { id: d.id, name: d.name, cards: d.cards.map((k) => card(k).name), keys: d.cards.filter((k) => !String(k).startsWith("custom:")), variants: deckVariantNames(d), custom: d.cards.filter((k) => String(k).startsWith("custom:")).map((k) => { const c = card(k); return { name: c.name, cost: c.cost, power: c.power, ability: c.ability, frame: c.frame }; }), code: deckCode(d), list: deckList(d), stats: slimStats(st), updated: Date.now() };
}
function deckVariantNames(d) { const o = {}; d.cards.forEach((k) => { const v = deckVariant(d, k); if (v) o[card(k).name] = v.name + (v.artist ? " · " + v.artist : ""); }); return o; }
let profTimer = null, lastDetail = null;
const myPostItems = () => arr(obj(shared.posts[store.uid]).items);
// Your posts are written where your privacy setting says: the public list, or your private details
function writeMyPosts(items) {
  shared.posts[store.uid] = { items };
  const priv = SLOT ? obj(sharedRaw.profiles[store.uid]).visibility === "private" : S.me.visibility === "private";
  if (priv) {
    if (lastDetail) return writeDetail();
    if (pdetails[store.uid]) return store.db.doc("pdetail/" + store.uid).set(clone({ ...pdetails[store.uid], posts: items, updated: Date.now() })).catch((e) => handleDbErr(e, "post"));
    syncProfile(); return Promise.resolve();
  }
  return store.db.doc("posts/" + store.uid).set({ items: clone(items) }).catch((e) => handleDbErr(e, "post"));
}
function writeDetail() { if (!lastDetail) return Promise.resolve(); return store.db.doc("pdetail/" + store.uid).set(clone({ allyKey: allyKey(S.me.alliance), profile: lastDetail.profile, posts: myPostItems(), decks: lastDetail.decks, updated: Date.now() })).catch((e) => handleDbErr(e, "save your profile")); }
function rebuildShared() {
  const isPriv = (id) => obj(sharedRaw.profiles[id]).visibility === "private";
  const P = {}, Po = {}, D = {};
  for (const [id, p] of Object.entries(sharedRaw.profiles)) { const d = pdetails[id]; P[id] = isPriv(id) && d && d.profile ? { ...obj(d.profile), handle: p.handle || obj(d.profile).handle, avatar: p.avatar ?? obj(d.profile).avatar, visibility: "private", detail: true } : p; }
  for (const [id, x] of Object.entries(sharedRaw.posts)) if (!isPriv(id)) Po[id] = x;
  for (const [id, x] of Object.entries(sharedRaw.decks)) if (!isPriv(id)) D[id] = x;
  for (const [id, d] of Object.entries(pdetails)) if (d && isPriv(id)) { Po[id] = { items: arr(d.posts) }; if (arr(d.decks).length) D[id] = { items: arr(d.decks) }; }
  // What you just posted shows straight away, before the database sends it back
  if (store.uid && shared.posts[store.uid] && !Po[store.uid]) Po[store.uid] = shared.posts[store.uid];
  shared.profiles = P; shared.posts = Po; shared.decks = D; sharedVer++;
  if (store.db) for (const [id, p] of Object.entries(sharedRaw.profiles)) if (p && p.visibility === "private" && !pdSubs.has(id)) {
    pdSubs.set(id, store.db.doc("pdetail/" + id).onSnapshot((s) => { pdetails[id] = s.exists ? s.data() : null; rebuildShared(); requestRender(); }, () => { pdetails[id] = null; pdSubs.delete(id); }));
  }
}
function syncProfile() {
  if (store.mode !== "cloud" || SLOT) return;
  // Nothing is published while you're still setting up your profile
  if (!S.me.onboarded) return;
  clearTimeout(profTimer);
  profTimer = setTimeout(async () => {
    const ref = store.db.doc("profiles/" + store.uid), dref = store.db.doc("decks/" + store.uid), pref = store.db.doc("posts/" + store.uid), xref = store.db.doc("pdetail/" + store.uid);
    try {
      try { const req = { to: { ...obj(obj(shared.followreq[store.uid]).to) } }; let add = 0; for (const id of S.following) if (obj(shared.profiles[id]).visibility === "private" && !approvalsOf(id).ok[store.uid] && !req.to[id] && !approvalsOf(id).no[store.uid]) { req.to[id] = Date.now(); add++; } if (add) { shared.followreq[store.uid] = req; await store.db.doc("followreq/" + store.uid).set(clone(req)); } } catch { /* next time */ }
      try { const ak = allyKey(S.me.alliance); if (S.allyKeySent !== ak) { await store.db.doc("allykeys/" + store.uid).set({ k: ak }); S.allyKeySent = ak; rebuildShared(); } } catch { /* the new security rules aren't published yet */ }
      if (!S.me.share || !S.me.handle.trim()) {
        // Sharing is off: your posts are kept in your own saved data (not shared) and come back when you turn it on
        const mine = [...arr(obj(sharedRaw.posts[store.uid]).items), ...arr(obj(pdetails[store.uid]).posts)].filter((p, i, a) => p && p.id && a.findIndex((q) => q && q.id === p.id) === i);
        if (mine.length) { S.postsBackup = clone(mine); save(); }
        if (sharedRaw.profiles[store.uid]) await ref.delete(); if (sharedRaw.decks[store.uid]) await dref.delete(); if (sharedRaw.posts[store.uid]) await pref.delete(); if (pdetails[store.uid]) await xref.delete();
        delete shared.posts[store.uid]; lastDetail = null; return;
      }
      if (!myPostItems().length && arr(S.postsBackup).length) { shared.posts[store.uid] = { items: arr(S.postsBackup) }; S.postsBackup = null; save(); }
      const ms = realMatches(); const cur = currentSeasonPeriod();
      const fd = S.decks.find((d) => d.id === S.me.featuredDeck);
      const bannerSnap = lookSnap(S.me.banner, "banner"), avatarSnap = lookSnap(S.me.avatar, "avatar");
      const full = {
        name: S.me.name.trim().slice(0, 40), handle: S.me.handle.trim().slice(0, 40), snapId: String(S.me.snapId || "").slice(0, 40), country: S.me.country || "", visibility: S.me.visibility === "private" ? "private" : "public",
        alliance: S.me.alliance.trim().slice(0, 40), colLevel: num(S.me.colLevel), rank: String(S.me.rank || "").slice(0, 12), peak: String(S.me.peak || "").slice(0, 12),
        following: S.following.slice(0, 300), avatar: avatarSnap || null, banner: bannerSnap || null,
        stats: { all: slimStats(statsFor(ms)), season: slimStats(statsFor(cur ? inPeriod(ms, cur) : [])), d30: slimStats(statsFor(inPeriod(ms, periodById("d30")))) },
        seasonLabel: plainLabel(cur), featured: fd ? deckPublic(fd) : null,
        alliancePts: num(S.alliance.points), allianceTier: num(S.alliance.tier), allianceTiers: num(S.alliance.tiers), allianceRole: String(S.alliance.role || "").slice(0, 20),
        pass: (() => { const cs = currentSeason(); const p = cs ? obj(S.passes[cs.id]) : {}; return cs ? { level: num(p.level), of: num(cs.passLevels) || 50, tier: p.tier || "free" } : null; })(),
        owned: Object.keys(S.owned).length, ...profileExtras(), updated: Date.now(),
      };
      const pub = S.decks.filter((d) => d.public && d.cards.length).slice(0, 20).map(deckPublic);
      if (S.me.visibility === "private") {
        // Only your handle and picture are public; everything else goes where the database checks who's asking
        await ref.set({ handle: full.handle, avatar: full.avatar, visibility: "private", updated: full.updated });
        lastDetail = { profile: full, decks: pub }; await writeDetail();
        if (sharedRaw.decks[store.uid]) await dref.delete(); if (sharedRaw.posts[store.uid]) await pref.delete();
      } else {
        await ref.set(full); lastDetail = null;
        if (pub.length) await dref.set({ items: pub }); else if (sharedRaw.decks[store.uid]) await dref.delete();
        if (pdetails[store.uid] || (myPostItems().length && !sharedRaw.posts[store.uid])) { const items = myPostItems(); if (items.length) await pref.set({ items: clone(items) }); if (pdetails[store.uid]) await xref.delete(); }
      }
    } catch (e) { /* profile sync is best-effort */ }
  }, 1500);
}

async function initCaps() {
  if (live.on) live = normLive(live);
  const local = lsGet(LS.state); if (local) S = mergeDefaults(local);
  const lm = lsGet(LS.matches); if (lm && typeof lm === "object") { matchWeeks = lm; _mVer++; }
  render();
  if (window.SNAPSTAT_STANDALONE && typeof initFirebase === "function") return initFirebase(local, lm);
  if (!window.claude || typeof window.claude.use !== "function") { store.ready = true; render(); maybeOnboard(); return; }
  const get = (n) => window.claude.use(n).catch(() => null);
  const [db, user, sample, downloads, assets] = await Promise.all([get("db"), get("user"), get("sample"), get("downloads"), get("assets")]);
  store.sample = sample; store.downloads = downloads; store.assets = assets;
  let id = null;
  if (db && user) { try { id = await user.id(); } catch { id = null; } }
  if (db && id) { store.db = db; store.uid = id; store.mode = "cloud"; subscribeCloud(local, lm); }
  store.ready = true; render();
  if (store.mode !== "cloud") maybeOnboard();
}
function subscribeCloud(localState, localMatches) {
  const db = store.db;
  store.stateRef = db.doc("data/users/" + store.uid + (SLOT ? "/slot-" + SLOT : "/state"));
  // Data saved on this device without an account since it was last added to this account
  const MERGED = "snapstat.mergedAt." + store.uid + (SLOT ? "." + SLOT : "");
  const lastMerged = num(lsGet(MERGED)), mergeLocal = num(lsGet(LOCAL_AT)) > lastMerged;
  const markMerged = () => { if (store.stateLoaded && store.matchesLoaded) lsSet(MERGED, Date.now()); };
  store.stateRef.onSnapshot((snap) => {
    const first = !store.stateLoaded;
    if (!first && (dirty || snap.metadata.hasPendingWrites)) return;
    if (!snap.exists && snap.metadata.fromCache) return;
    if (snap.exists) {
      const cloud = mergeDefaults(clone(snap.data()));
      if (first && dirty) { dirty = false; clearTimeout(saveTimer); toast("Your saved data just finished loading. If you changed something in the last few seconds, please do it again."); }
      // Used without an account on this device, and the account has data too: you pick which to keep
      if (first && mergeLocal && localState && num(localState.updated) > num(cloud.updated) && (Object.keys(obj(localState.owned)).length || arr(localState.decks).length)) { pendingLocal = localState; setTimeout(() => openSheet(stateChoiceSheet), 300); }
      S = cloud;
    } else if (first && localState) { S = mergeDefaults(localState); save(); }
    store.stateLoaded = true; markMerged(); requestRender();
    if (first) setTimeout(maybeOnboard, 0);
  }, onSubErr);
  store.stateRef.collection("matches").onSnapshot((qs) => {
    const first = !store.matchesLoaded;
    if (!first && (dirtyWeeks.size || qs.metadata.hasPendingWrites)) return;
    if (qs.empty && qs.metadata.fromCache) return;
    const next = {}; qs.docs.forEach((d) => { const b = d.data(); next[d.id] = arr(b && b.items).length ? clone(b.items) : []; });
    if (first) {
      const pending = matchWeeks; dirtyWeeks.clear(); clearTimeout(weekTimer);
      const have = new Set(); Object.values(next).forEach((l) => l.forEach((m) => m && have.add(m.id)));
      const extra = new Map();
      // Logged this session before your saved data loaded
      for (const l of Object.values(pending)) for (const m of arr(l)) if (m && preLoad.adds.has(m.id) && !have.has(m.id)) extra.set(m.id, m);
      // Saved on this device without an account (all of them when the account has none yet)
      if (localMatches && (qs.empty || mergeLocal)) for (const l of Object.values(obj(localMatches))) for (const m of arr(l)) if (m && m.id && !have.has(m.id) && !preLoad.dels.has(m.id) && (qs.empty || !lastMerged || num(m.ts) > lastMerged || num(m.added) > lastMerged)) extra.set(m.id, m);
      matchWeeks = next;
      for (const id of preLoad.dels) { const f = findMatch(id); if (f) { matchWeeks[f.wk] = matchWeeks[f.wk].filter((x) => x.id !== id); dirtyWeeks.add(f.wk); } }
      for (const m of extra.values()) { const wk = weekKey(m.ts); matchWeeks[wk] = [...arr(matchWeeks[wk]), m]; dirtyWeeks.add(wk); }
      preLoad.adds.clear(); preLoad.dels.clear();
      store.matchesLoaded = true; markMerged();
      if (dirtyWeeks.size) weekTimer = setTimeout(flushWeeks, 500);
    } else matchWeeks = next;
    _mVer++; requestRender();
  }, onSubErr);
  const sub = (coll) => db.collection(coll).onSnapshot((qs) => {
    const o = {}; qs.docs.forEach((d) => { const b = d.data(); if (b && typeof b === "object") o[d.id] = b; });
    if (coll in sharedRaw) { sharedRaw[coll] = o; rebuildShared(); } else { shared[coll] = o; sharedVer++; }
    requestRender(); updateBadge();
  }, onSubErr);
  ["profiles", "posts", "reactions", "promos", "seasons", "events", "decks", "followreq", "approvals"].forEach(sub);
  subscribeExtras(db);
}
let pendingLocal = null;
function stateChoiceSheet() {
  return `${sheetHead("Which data should SNAP Stat keep?")}
    <p class="small">This phone has SNAP Stat data from before you signed in, and your account already had saved data. Matches from both are kept. For everything else (collection, decks, settings), pick one.</p>
    <button class="btn snap block" data-a="keepCloudState">Keep my account's data</button>
    <button class="btn block" data-a="keepLocalState">Use this phone's data instead</button>`;
}
function onSubErr(e) { if (e && e.code === "revoked") toast("Access changed. Reload to continue."); else if (e && /permission/.test(String(e.code))) toast("The database blocked this. Check that the security rules from the setup guide are published."); }
function accountLine() {
  if (store.provider === "firebase") return store.mode === "cloud" ? `Signed in as ${esc((store.user && (store.user.email || store.user.name)) || "you")}` : "Not signed in: saved on this device";
  return store.mode === "cloud" ? "You're signed in with your Claude account" : "Saved on this device";
}

/* ============ Follows & privacy ============ */
const prof = (id) => (id === store.uid ? myProfileView() : shared.profiles[id] || null);
function myProfileView() { return { ...(shared.profiles[store.uid] || {}), name: S.me.name, handle: S.me.handle || "You", country: S.me.country, alliance: S.me.alliance, visibility: S.me.visibility, avatar: S.me.avatar, banner: S.me.banner, rank: S.me.rank, peak: S.me.peak, colLevel: S.me.colLevel }; }
const handleOf = (id) => (prof(id) && prof(id).handle) || "Player";
function approvalsOf(id) { const a = obj(shared.approvals[id]); return { ok: obj(a.ok), no: obj(a.no) }; }
function followState(target) {
  if (target === store.uid) return "self";
  if (!S.following.includes(target)) return "none";
  const p = shared.profiles[target];
  if (!p || p.visibility !== "private") return "following";
  const ap = approvalsOf(target);
  if (ap.ok[store.uid]) return "following";
  if (ap.no[store.uid]) { const no = num(ap.no[store.uid]), asked = num(obj(obj(shared.followreq[store.uid]).to)[target]); if (no < 1e12 || no >= asked) return "denied"; }
  return "pending";
}
function sameAlliance(id) { const p = shared.profiles[id], mine = allyKey(S.me.alliance); return !!(p && mine && allyKey(p.alliance) === mine); }
function canSee(id) { if (id === store.uid) return true; const p = shared.profiles[id]; if (!p) return false; if (p.visibility !== "private") return true; return followState(id) === "following" || sameAlliance(id); }
function incomingRequests() {
  const mine = approvalsOf(store.uid); const out = [];
  for (const [who, doc] of Object.entries(shared.followreq)) { const at = num(obj(obj(doc).to)[store.uid]), no = num(mine.no[who]); if (who !== store.uid && at && !mine.ok[who] && (!no || (no > 1e12 && at > no))) out.push(who); }
  return out;
}
function followersOf(id) {
  const ap = approvalsOf(id); const p = shared.profiles[id] || (id === store.uid ? { visibility: S.me.visibility } : null);
  return Object.entries(shared.profiles).filter(([who, x]) => who !== id && arr(x.following).includes(id) && (!p || p.visibility !== "private" || ap.ok[who])).map(([who]) => who);
}
function updateBadge() { const b = $("#socialBadge"); if (!b) return; const n = store.mode === "cloud" ? incomingRequests().length : 0; b.hidden = !n; b.textContent = n; }

/* ============ Live match (kept on this device) ============ */
const ZONES = { deck: "In deck", hand: "In hand", L0: "", L1: "", L2: "", destroyed: "Destroyed", discarded: "Discarded", banished: "Banished" };
function newLive(deck) {
  const my = {}; (deck ? deck.cards : []).forEach((k) => (my[k] = "deck"));
  return { on: true, deckId: deck ? deck.id : "", deckName: deck ? deck.name : "No deck", turn: 1, lastTurn: 6, my, myPow: {}, opp: [], oppHand: 3, locs: ["", "", ""], adj: { my: [0, 0, 0], opp: [0, 0, 0] },
    mySnap: false, oppSnap: false, sig: { emotes: 0, oddPlays: false, genericName: false, defaultLook: false, noRetreat: false, winPct: "" }, oppName: "", started: Date.now(), pred: null };
}
function normLive(l, early) { if (!l || typeof l !== "object" || !l.on) return { on: false }; l.my = obj(l.my); l.myPow = obj(l.myPow); l.adj = l.adj && Array.isArray(l.adj.my) && Array.isArray(l.adj.opp) ? l.adj : { my: [0, 0, 0], opp: [0, 0, 0] }; l.predBusy = false; l.locs = Array.isArray(l.locs) ? l.locs : ["", "", ""]; l.opp = arr(l.opp).filter((o) => o && typeof o === "object").map((o) => ({ zone: "L" + num(o.loc), ...(early || o.power != null ? {} : { power: card(o.key).power }), ...o })); return l; }
// Read before the card list exists, so card powers are filled in once the app has loaded (initCaps)
let live = normLive(lsGet(LS.live), true);
function saveLive() { lsSet(LS.live, live); overlayPush(); }
function locTotals(i) {
  const my = Object.entries(live.my).filter(([, z]) => z === "L" + i).reduce((s, [k]) => s + num(live.myPow[k] ?? card(k).power), 0) + num(live.adj.my[i]);
  const opp = live.opp.filter((o) => o.zone === "L" + i).reduce((s, o) => s + num(o.power), 0) + num(live.adj.opp[i]);
  return { my, opp };
}
function botScore(sig, turn, oppSnap) {
  let s = 50;
  if (num(sig.emotes) > 0) s -= 30; else if (turn >= 3) s += 15;
  if (sig.oddPlays) s += 15; if (sig.genericName) s += 10; if (sig.defaultLook) s += 10; if (sig.noRetreat) s += 5; if (oppSnap) s -= 15;
  const wp = parseFloat(sig.winPct); if (Number.isFinite(wp)) { if (wp < 35) s += 15; else if (wp > 55) s -= 15; }
  return clamp(s, 0, 100);
}
function botLabel(s) { return s >= 70 ? "likely" : s <= 35 ? "human" : "unsure"; }
const BOT_TXT = { likely: "Likely bot", human: "Likely human", unsure: "Not sure" };
/* Opponent prediction without AI: cards that showed up alongside these in decks you've faced, plus shared effects */
function predictLocal() {
  const R = new Set(live.opp.map((o) => o.key));
  const score = {};
  for (const m of allMatches()) {
    const keys = arr(m.oppCards).map(keyOf); const overlap = keys.filter((k) => R.has(k)).length;
    if (!overlap) continue;
    keys.forEach((k) => { if (!R.has(k)) score[k] = (score[k] || 0) + overlap * overlap; });
  }
  const tags = {}; [...R].forEach((k) => card(k).tags.forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
  allCards().forEach((c) => { if (R.has(c.key) || c.cost === "?") return; const t = c.tags.reduce((s, x) => s + (tags[x] || 0), 0); if (t) score[c.key] = (score[c.key] || 0) + t * 0.6; });
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const slots = Math.max(0, 12 - R.size); const top = ranked.slice(0, Math.max(slots, 6)); const max = top.length ? top[0][1] : 1;
  const deck = top.slice(0, slots || 6).map(([k, s]) => ({ name: card(k).name, chance: clamp(Math.round((s / max) * 85), 8, 90) }));
  const unknown = Math.max(1, 12 - R.size);
  const inHand = deck.map((d) => { const c = cardByName(d.name); const late = c && num(c.cost) >= live.turn ? 1.25 : 0.75; return { name: d.name, chance: clamp(Math.round(d.chance * (live.oppHand / unknown) * late), 3, 92), why: "" }; }).sort((a, b) => b.chance - a.chance).slice(0, 5);
  const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
  return { archetype: topTag ? TAGS[topTag[0]] + " deck" : "Not enough cards seen", deck, inHand, watchOut: [], tip: R.size < 2 ? "Add the cards they reveal and the guess sharpens." : "Based on decks you've faced that used these cards and on shared effects.", local: true };
}

/* ============ Deck codes (favorite variants written into the comment lines) ============ */
function deckVariant(d, k) { const id = obj(d.variants)[k]; return (id && (variantById(id) || (String(id).startsWith("cat:") && typeof variantAny === "function" ? variantAny(id) : null))) || favVariant(k) || null; }
/* The game's deck code: base64 of the card IDs joined by commas (see cardCode). Custom cards are left out. */
function deckCode(deck) {
  const codes = deck.cards.filter((k) => !String(k).startsWith("custom:")).map((k) => card(k).code).filter(Boolean);
  return btoa(codes.join(","));
}
/* A readable list with favorite variants, for sharing outside the game */
function deckList(deck) {
  const cs = deck.cards.map(card).sort((a, b) => num(a.cost) - num(b.cost) || a.name.localeCompare(b.name));
  const lines = cs.map((c) => { const v = c.custom ? null : deckVariant(deck, c.key); return `${c.name} (${c.cost})${c.custom ? " · custom card" : ""}${v ? ` · ${v.name}${byArtist(v)}` : ""}`; });
  return [deck.name, ...lines, "", "Deck code: " + deckCode(deck)].join("\n");
}
function parseDeckCode(text) {
  const out = { name: "", cards: [], unknown: [], unknownCodes: [], variants: {} };
  const add = (c) => { if (c && !out.cards.includes(c.key)) out.cards.push(c.key); };
  const T = String(text || "");
  for (const t of T.match(/[A-Za-z0-9+/=]{12,}/g) || []) {
    let raw; try { raw = decodeURIComponent(escape(atob(t))).trim(); } catch { continue; }
    if (raw.startsWith("{")) {
      try { const j = JSON.parse(raw); if (j.Name) out.name = j.Name; arr(j.Cards || j.cards).forEach((x) => { const id = typeof x === "string" ? x : x.CardDefId || x.cardDefId || ""; const c = cardByCode(cardCode(id)) || cardByName(id); if (c) add(c); else if (id) out.unknown.push(String(id)); }); } catch { /* not a deck */ }
    } else if (/^[A-Za-z0-9]+(,[A-Za-z0-9]+)+$/.test(raw)) {
      raw.split(",").forEach((code) => { const c = cardByCode(code); if (c) add(c); else { out.unknown.push(code); out.unknownCodes.push(code); } });
    }
  }
  const hadCodes = out.cards.length > 0;
  for (const line0 of T.split("\n")) {
    let line = line0.replace(/^\s*#\s*/, "").replace(/^\((?:\d+|\?)\)\s*/, "").trim(); if (!line) continue;
    const [namePart, ...rest] = line.split(" · ");
    const nm = namePart.replace(/\s*\((?:-?\d+|\?)\)\s*$/, "").trim(); const c = cardByName(nm); if (!c) continue;
    const v = rest.join(" · ").trim(); if (v && !/custom card/.test(v)) out.variants[c.key] = v;
    if (!hadCodes) add(c);
  }
  out.cards = out.cards.slice(0, 12);
  return out;
}
function topDecks(ms) {
  const g = {}; for (const m of ms) { const d = m.deckId && S.decks.find((x) => x.id === m.deckId); const k = d ? "id:" + d.id : "name:" + (m.deckName || "No deck"); (g[k] = g[k] || []).push(m); }
  return Object.entries(g).map(([k, list]) => { const d = k.startsWith("id:") ? S.decks.find((x) => x.id === k.slice(3)) : null; return { name: d ? d.name : k.slice(5), ...statsFor(list) }; }).sort((a, b) => b.games - a.games);
}

/* ============ Collectibles (season and event rewards tied to your collection) ============ */
function collectibleItems(src) {
  const items = [];
  arr(src.cards).forEach((n) => items.push({ kind: "card", name: String(n) }));
  if (src.passCard && !arr(src.cards).some((n) => keyOf(n) === keyOf(src.passCard))) items.unshift({ kind: "card", name: String(src.passCard), pass: true });
  arr(src.variants).forEach((n) => items.push({ kind: "variant", name: String(n) }));
  arr(src.rewards).concat(arr(src.collectibles)).map(parseLine).forEach((x) => { if (!(x.kind === "card" && items.some((i) => i.kind === "card" && keyOf(i.name) === keyOf(x.name)))) items.push(x); });
  return items;
}
// "Dracula - Season Pass", "Spider-Man – Pixel" or "Ka-Zar (Season Pass)". A hyphen with no spaces only splits
// where the part before it is a card ("Spider-Man-Pixel"), since many cards have one in their name.
function splitVariant(name) {
  const s = String(name || "").trim();
  const m = s.match(/^(.+?)\s+[-–—]\s+(.+)$/) || s.match(/^(.+?)\s*\((.+)\)$/) || s.match(/^(.+?)\s*[–—]\s*(.+)$/);
  if (m) return { card: m[1].trim(), label: m[2].trim() };
  if (/-/.test(s) && typeof allCards === "function") {
    try { allCards(); } catch { return { card: s, label: "" }; }
    const parts = s.split("-");
    for (let i = parts.length - 1; i >= 1; i--) { const left = parts.slice(0, i).join("-").trim(), right = parts.slice(i).join("-").trim(); if (right && _byKey && _byKey.has(keyOf(left)) && !_byKey.has(keyOf(s))) return { card: left, label: right }; }
  }
  return { card: s, label: "" };
}
// [when] is when the season or event started, to pick the right one of a card's season pass variants
function findCollectible(it, srcName, when) {
  if (it.kind === "card") { const k = keyOf(it.name); return { owned: !!S.owned[k], wish: !!S.wishCards[k] }; }
  if (it.kind === "variant") { const v = collVariant(it, srcName, when); return { owned: !!(v && v.owned), wish: !!(v && v.wish), v }; }
  if (COS[it.kind]) { const c = cosFind(it.kind, it.name); return { owned: !!(c && c.owned), wish: !!(c && c.wish), c }; }
  const k = keyOf(srcName) + ":" + keyOf(it.name); return { owned: !!S.collected[k], wish: false, k };
}
// A cosmetic by name, ignoring a trailing number ("Zombie Venom 01" is the "Zombie Venom" card back)
const cosLoose = (n) => keyOf(String(n || "").replace(/\s*#?\d{1,3}$/, ""));
function cosFind(kind, name) { const k = keyOf(name), l = cosLoose(name); return S.cosmetics.find((x) => x.kind === kind && keyOf(x.name) === k) || S.cosmetics.find((x) => x.kind === kind && cosLoose(x.name) === l) || null; }
// A variant named like "Dracula - Season Pass": your own entry first, then the card data's variant of that name or
// source (the one released closest to [when])
function collVariant(it, srcName, when) {
  const sv = splitVariant(it.name), ck = keyOf(sv.card), lab = keyOf(sv.label);
  const mine = S.variants.find((x) => x.card === ck && !x.cat && (lab ? keyOf(x.name) === lab : x.source === srcName)); if (mine) return mine;
  const list = (typeof allVariants === "function" ? allVariants() : S.variants).filter((x) => x.card === ck && (!lab || keyOf(x.name) === lab || keyOf(x.source) === lab || keyOf(x.artist) === lab || (x.source && keyOf(x.source) === keyOf(srcName))));
  if (!list.length) return null;
  const t = (x) => (x.release ? dayStart(x.release) : 0);
  return list.sort((a, b) => (when ? Math.abs(t(a) - when) - Math.abs(t(b) - when) : t(b) - t(a)) || (b.owned ? 1 : 0) - (a.owned ? 1 : 0))[0];
}
function setCollectible(it, srcName, field, val, when) {
  if (it.kind === "card") { const k = keyOf(it.name); const tgt = field === "owned" ? S.owned : S.wishCards; if (val) tgt[k] = true; else delete tgt[k]; return; }
  const f = findCollectible(it, srcName, when);
  if (it.kind === "variant") { if (f.v) { const real = f.v.virtual ? materializeVar(f.v.id) : S.variants.find((x) => x.id === f.v.id) || f.v; if (real) real[field] = val; } else { const sv = splitVariant(it.name); S.variants.push({ id: uid(), card: keyOf(sv.card), name: sv.label || srcName, artist: "", rarity: "", source: srcName, release: "", owned: field === "owned" && val, wish: field === "wish" && val, favorite: false }); } return; }
  if (COS[it.kind]) { if (f.c) f.c[field] = val; else S.cosmetics.push({ id: uid(), kind: it.kind, name: it.name, source: srcName, owned: field === "owned" && val, wish: field === "wish" && val }); return; }
  if (field === "owned") { if (val) S.collected[f.k] = true; else delete S.collected[f.k]; }
}
const KIND_TXT = { card: "Card", variant: "Variant", avatar: "Avatar", title: "Title", cardback: "Card back", emote: "Emote", other: "Reward" };

/* ============ Shops & wishlist ============ */
function wishItems() {
  const out = [];
  for (const k of Object.keys(S.wishCards)) if (S.wishCards[k] && !S.owned[k]) out.push({ ref: "card:" + k, kind: "Card", name: card(k).name, cardKey: k });
  for (const v of S.variants) if (v.wish && !v.owned) out.push({ ref: "variant:" + v.id, kind: "Variant", name: `${card(v.card).name} · ${v.name}`, cat: v.cat || "", cardKey: v.card });
  for (const c of S.cosmetics) if (c.wish && !c.owned) out.push({ ref: "cos:" + c.id, kind: COS[c.kind] || "Cosmetic", name: c.name });
  return out;
}
function offerMatches(o, w) {
  if (o.auto) return o.variant ? !!(o.cat && w.cat && o.cat === w.cat) : !!(o.cardKey && w.ref === "card:" + o.cardKey);
  if (o.ref && o.ref === w.ref) return true; if (!o.item) return false;
  const a = keyOf(o.item), b = keyOf(w.name);
  return a && b && (a === b || (a.length > 3 && b.includes(a)) || (b.length > 3 && a.includes(b)));
}
function wishAlerts() {
  const now = Date.now(); const offers = [...S.shops.filter((o) => !o.expires || dayEnd(o.expires) >= now), ...autoOffers().filter((o) => !o.start || !(resetOn(o.start) > now))]; const out = [];
  for (const w of wishItems()) for (const o of offers) if (offerMatches(o, w)) { const have = o.currency === "usd" || o.currency === "event" ? null : num(S.wallet[o.currency]); out.push({ w, o, have, short: have === null ? null : Math.max(0, num(o.price) - have) }); }
  return out;
}

/* ============ UI plumbing ============ */
let toastT = null;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
let pendingRender = false;
function isTyping() {
  const a = document.activeElement; if (!a) return false;
  const inUI = $("#view").contains(a) || $("#sheet").contains(a);
  return inUI && ((a.tagName === "INPUT" && !["checkbox", "radio", "button", "range", "file"].includes(a.type)) || a.tagName === "TEXTAREA");
}
// While a file picker is open nothing is redrawn, so the file you choose lands on the button you tapped.
let filePickAt = 0;
const filePicking = () => Date.now() - filePickAt < 90000;
function flushPendingRender() { if (pendingRender && !isTyping() && !filePicking()) { pendingRender = false; render(); if (sheetFn) refreshSheet(); } }
document.addEventListener("click", (e) => { const t = e.target; const lab = t && t.closest ? t.closest("label") : null; if (t && t.matches && (t.matches("input[type=file]") || (lab && lab.querySelector("input[type=file]")))) filePickAt = Date.now(); }, true);
document.addEventListener("change", (e) => { if (e.target && e.target.type === "file") { filePickAt = 0; setTimeout(flushPendingRender, 0); } }, true);
window.addEventListener("focus", () => { if (filePickAt) setTimeout(() => { filePickAt = 0; flushPendingRender(); }, 1500); });
function requestRender() { if (isTyping() || filePicking()) { pendingRender = true; return; } render(); if (sheetFn) refreshSheet(); }
document.addEventListener("focusout", () => setTimeout(flushPendingRender, 0));
function keepFocus(fn) {
  const a = document.activeElement; const id = a && a.id; let ss = null, se = null;
  try { ss = a.selectionStart; se = a.selectionEnd; } catch { /* not a text field */ }
  fn();
  if (id) { const n = document.getElementById(id); if (n && n !== document.activeElement) { n.focus({ preventScroll: true }); try { if (ss !== null) n.setSelectionRange(ss, se); } catch { /* ignore */ } } }
}
let sheetFn = null;
function openSheet(fn) { sheetFn = fn; $("#sheet").hidden = false; refreshSheet(); const first = $("#sheetBody [data-autofocus]"); if (first) first.focus(); }
function refreshSheet() { if (!sheetFn) return; keepFocus(() => { $("#sheetBody").innerHTML = sheetFn(); }); extRun(EXT.afterRender); }
function closeSheet() { sheetFn = null; $("#sheet").hidden = true; $("#sheetBody").innerHTML = ""; if (typeof nat !== "undefined" && nat.popWait) setTimeout(() => { if (typeof updatePopup === "function") updatePopup(); }, 400); if (typeof webUp !== "undefined" && webUp.ready) setTimeout(() => applyWebUpdate(), 600); }
function sheetHead(title, sub) { return `<div class="sheet-h"><div style="min-width:0"><h2>${title}</h2>${sub ? `<div class="muted small">${sub}</div>` : ""}</div><button class="x" data-a="close" aria-label="Close">${ICON.x}</button></div>`; }
async function copyText(t, done = "Copied") {
  try { await navigator.clipboard.writeText(t); toast(done); }
  catch { openSheet(() => `${sheetHead("Copy this")}<p class="muted small">Your browser blocked automatic copying. Select the text and copy it.</p><textarea id="copybox" class="code" readonly>${esc(t)}</textarea>`); setTimeout(() => { const b = $("#copybox"); if (b) { b.focus(); b.select(); } }, 30); }
}
