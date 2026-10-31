
/* ============ Card data file: art, card details and every variant ============
   Standalone version only. card-data.json is refreshed daily in the app's GitHub repository
   from Marvel Snap Zone (see scripts/update-cards.mjs). The art itself stays on their servers. */
let CAT = null, catVer = 0, _catVars = new Map(), _catByCard = new Map();
const CAT_CACHE = "snapstat-carddata-v1";
const safeUrl = (u) => (typeof u === "string" && (/^https:\/\/[^\s"'<>]+$/i.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)[:/][^\s"'<>]*$/i.test(u)) ? u : "");
const showArt = () => !!window.SNAPSTAT_STANDALONE;
function artFail(img) { const p = img.parentNode; if (p) p.classList.remove("has-img"); img.remove(); }
function imgTag(src, cls) { const u = safeUrl(src); return u && showArt() ? `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="artFail(this)">` : ""; }

function catUrls(file = "card-data.json") {
  const o = window.SNAPSTAT_OPTIONS || {}, urls = [];
  if (file === "card-data.json" && o.cardData) urls.push(o.cardData);
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i), repo = location.pathname.split("/").filter(Boolean)[0];
  if (m && repo && !/\.html?$/i.test(repo)) urls.push(`https://raw.githubusercontent.com/${m[1]}/${repo}/main/${file}`);
  urls.push(file);
  return urls;
}
function refreshView() { const el = document.activeElement; if (!(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) { if (filePicking()) { pendingRender = true; return; } render(); if (typeof sheetFn !== "undefined" && sheetFn) refreshSheet(); } }
function useCardData(j, fromCache) {
  if (!j || !Array.isArray(j.cards) || j.cards.length < 50) return false;
  if (CAT && fromCache) return false;
  CAT = { updated: String(j.updated || ""), source: String(j.source || ""), artBase: safeUrl(j.artBase) ? j.artBase : "", cards: j.cards, locations: arr(j.locations) }; catVer++;
  refreshView();
  return true;
}
async function loadCardData() {
  if (!window.SNAPSTAT_STANDALONE) return;
  try { const c = localStorage.getItem(CAT_CACHE); if (c) useCardData(JSON.parse(c), true); } catch { /* no saved copy */ }
  for (const u of catUrls()) {
    try {
      const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
      const text = await r.text(); const j = JSON.parse(text);
      if (CAT && j.updated && j.updated === CAT.updated) return;
      if (!useCardData(j, false)) continue;
      try { localStorage.setItem(CAT_CACHE, text); } catch { /* too big for this browser; it's fetched again next time */ }
      return;
    } catch { /* try the next copy */ }
  }
}
/* Seasons and limited-time events (schedule.json, refreshed daily from snap.fan). They fill in what the shared list doesn't have. */
let SCHED = null, schedVer = 0;
const SCHED_CACHE = "snapstat-schedule-v1";
function useSchedule(j, fromCache) {
  if (!j || typeof j.seasons !== "object" || !Object.keys(obj(j.seasons)).length) return false;
  if (SCHED && fromCache) return false;
  SCHED = { updated: String(j.updated || ""), seasons: obj(j.seasons), events: obj(j.events), shops: arr(j.shops), spotlight: obj(j.spotlight) }; schedVer++;
  refreshView(); return true;
}
async function loadSchedule() {
  if (!window.SNAPSTAT_STANDALONE) return;
  try { const c = localStorage.getItem(SCHED_CACHE); if (c) useSchedule(JSON.parse(c), true); } catch { /* no saved copy */ }
  for (const u of catUrls("schedule.json")) {
    try {
      const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
      const text = await r.text(); const j = JSON.parse(text);
      if (SCHED && j.updated && j.updated === SCHED.updated) return;
      if (!useSchedule(j, false)) continue;
      try { localStorage.setItem(SCHED_CACHE, text); } catch { /* fetched again next time */ }
      return;
    } catch { /* try the next copy */ }
  }
}
function mergeSchedule(list, kind) {
  if (!SCHED) return list;
  const out = list.map((x) => ({ ...x })), used = new Set();
  for (const [id, x] of Object.entries(kind === "seasons" ? SCHED.seasons : SCHED.events)) {
    if (!x || !x.name || !x.start || arr(S.hiddenSched).includes(id)) continue;
    const st = dayStart(x.start);
    const same = out.find((y) => y.id === id) || (kind === "seasons" ? out.find((y) => !used.has(y) && Math.abs(dayStart(y.start) - st) <= 7 * DAY) : out.find((y) => !used.has(y) && keyOf(y.name) === keyOf(x.name) && Math.abs(dayStart(y.start) - st) <= 3 * DAY));
    if (same) {
      used.add(same);
      // Players' edits win. Only empty fields are filled in.
      for (const f of ["passCard", "superCard", "link"]) if (!same[f] && x[f]) same[f] = x[f];
      for (const f of ["cards", "variants", "rewards"]) if (!arr(same[f]).length && arr(x[f]).length) same[f] = x[f];
      if (!Object.keys(obj(same.sources)).length && Object.keys(obj(x.sources)).length) same.sources = x.sources;
      continue;
    }
    out.push({ ...x, id, auto: true });
  }
  return out;
}

/* Locations from the card data file */
let _locSig = -1, _locs = [];
function allLocations() {
  if (_locSig === catVer) return _locs;
  _locs = CAT ? arr(CAT.locations).filter((l) => l && l.name).map((l) => ({ ...l, art: catArt(l.art), soon: /unreleased/i.test(l.status || "") })).sort((a, b) => a.name.localeCompare(b.name)) : [];
  _locSig = catVer; return _locs;
}
function locByName(n) { const k = keyOf(n); return k ? allLocations().find((l) => keyOf(l.name) === k) || null : null; }
function locDatalist() { const ls = allLocations().filter((l) => !l.soon); return ls.length ? `<datalist id="loc-names">${ls.map((l) => `<option value="${esc(l.name)}">`).join("")}</datalist>` : ""; }

/* Variant details (variant-details.json, refreshed daily from snap.fan): name, artists, rarity, vault tier, source, release date */
let VD = null, vdVer = 0;
const VD_CACHE = "snapstat-variants-v1";
function useVariantDetails(j, fromCache) {
  if (!j || typeof j.variants !== "object" || Object.keys(obj(j.variants)).length < 50) return false;
  if (VD && fromCache) return false;
  VD = { updated: String(j.updated || ""), variants: obj(j.variants) }; vdVer++;
  refreshView(); return true;
}
async function loadVariantDetails() {
  if (!window.SNAPSTAT_STANDALONE) return;
  try { const c = localStorage.getItem(VD_CACHE); if (c) useVariantDetails(JSON.parse(c), true); } catch { /* no saved copy */ }
  for (const u of catUrls("variant-details.json")) {
    try {
      const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
      const text = await r.text(); const j = JSON.parse(text);
      if (VD && j.updated && j.updated === VD.updated) return;
      if (!useVariantDetails(j, false)) continue;
      try { localStorage.setItem(VD_CACHE, text); } catch { /* fetched again next time */ }
      return;
    } catch { /* try the next copy */ }
  }
}
/* Marvel Snap Zone's "rarity" mixes real rarities with where a variant comes from. Split it when snap.fan has nothing. */
const RAR_WORDS = /^(common|uncommon|rare|super rare|epic|legendary|ultra|infinity|ultimate|amazing|sensational|exquisite|spotlight)$/i;
function mszRarity(r) { r = String(r || ""); return RAR_WORDS.test(r) ? r : /ultimate/i.test(r) ? "Ultimate" : ""; }
function mszSource(r) {
  r = String(r || "");
  if (!r || /^(rare|super rare|general pool)$/i.test(r)) return r ? "General Pool" : "";
  if (/token/i.test(r)) return "Token Shop";
  if (/bundle/i.test(r)) return "Bundle";
  if (/spotlight/i.test(r)) return "Spotlight";
  if (/location war/i.test(r)) return "Sanctum Showdown";
  return r;
}
function normSource(r) {
  r = String(r || "").trim();
  if (/^team.?up$/i.test(r)) return "Team-Up";
  if (/^season ?pass$/i.test(r)) return "Season Pass";
  if (/^token( shop)?/i.test(r)) return "Token Shop";
  if (/^spotlight/i.test(r)) return "Spotlight";
  if (/bundle/i.test(r)) return "Bundle";
  if (/^sanctum|location war/i.test(r)) return "Sanctum Showdown";
  if (/^deadpool'?s diner$/i.test(r)) return "Deadpool's Diner";
  return r;
}
const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, "super rare": 4, epic: 5, legendary: 6, ultra: 7, infinity: 8, spotlight: 8.5, amazing: 9, sensational: 10, exquisite: 11, ultimate: 12 };
const rarityRank = (r) => RARITY_RANK[String(r || "").toLowerCase()] || 0;

function catCollectible(d) { return /^released$/i.test(d.status || "") && !!d.source && !/^none$|not available|token|unreleased/i.test(d.source) && (!d.type || /character/i.test(d.type)); }
const catArt = (u) => safeUrl(!u ? "" : /^https?:\/\//i.test(u) ? u : (CAT.artBase || "") + u);
function catVarName(v) {
  if (v.name) return String(v.name).slice(0, 80);
  if (v.artist) return String(v.artist).slice(0, 80);
  const m = String(v.desc || "").match(/\bfrom (.+?)(?: by |$)/i);
  if (m && m[1].length <= 60) return m[1].trim();
  return v.rarity ? `${v.rarity} variant` : `Variant ${v.order || ""}`.trim();
}
/* Called from allCards(): fills in names, costs, power and abilities, adds released cards the app didn't know, and indexes the variants. */
// A card in the daily card list whose code matches (exactly, or without vowels), for cards the app doesn't list yet.
function catCardByCode(code) { if (!CAT) return null; const c = String(code || ""), l = looseCode(c); return arr(CAT.cards).find((d) => d && d.id && (cardCode(d.id) === c || looseCode(cardCode(d.id)) === l)) || null; }
function mergeCatalog(map) {
  _catVars = new Map(); _catByCard = new Map();
  if (!CAT) return;
  const byCode = new Map(); for (const c of map.values()) if (c.code && !byCode.has(c.code)) byCode.set(c.code, c.key);
  const unk = new Map(); for (const a of arr(S.addedCards)) if (a && a.key && a.code && /^Unknown card \(/.test(a.name)) { unk.set(a.code, a); unk.set("~" + looseCode(a.code), a); }
  const claimed = new Set();
  for (const d of CAT.cards) {
    if (!d || !d.name || claimed.has(keyOf(d.name))) continue;
    claimed.add(keyOf(d.name));
    const code = d.id ? cardCode(d.id) : "";
    let k = (code && byCode.get(code)) || (map.has(keyOf(d.name)) ? keyOf(d.name) : "");
    if (k && !map.has(k)) k = "";
    const ua = code ? unk.get(code) || unk.get("~" + looseCode(code)) : null;
    if (!k && ua) { const a = ua; k = a.key; map.set(k, { tags: [], series: "", ability: "", release: "", ...a, added: true, resolved: true }); }
    if (!k) {
      if (!catCollectible(d)) continue;
      k = keyOf(d.name); map.set(k, { key: k, name: d.name, cost: "?", power: "?", tags: [], ability: "", series: "", release: "", code, fromCat: true });
    }
    const c = map.get(k), up = { art: catArt(d.art), catId: d.id || "" };
    const ser = String(d.source || "").match(/^Series (\d)$/i); if (ser && !c.series) up.series = ser[1];
    up.catUnreleased = /unreleased/i.test(d.status || ""); up.catSource = String(d.source || "");
    up.catModeOnly = !up.catUnreleased && /^none$/i.test(String(d.source || "").trim());
    if (code && c.code !== code) { const owner = byCode.get(code); if (!owner || owner === k) up.code = code; }
    if (code && !byCode.has(code)) byCode.set(code, k);
    if (/^Unknown card \(/.test(c.name)) {
      up.name = d.name;
      // The game's ID showed this "unknown" card is one the list already had under its name: keep the one with the right ID.
      const nk = keyOf(d.name); if (nk !== k && map.has(nk) && !cardInUse(nk)) { map.delete(nk); for (const [cd, kk] of byCode) if (kk === nk) byCode.delete(cd); }
    }
    if (d.cost !== "" && d.cost !== null && d.cost !== undefined && !isNaN(d.cost)) up.cost = Number(d.cost);
    if (d.power !== "" && d.power !== null && d.power !== undefined && !isNaN(d.power)) up.power = Number(d.power);
    if (d.ability) up.ability = String(d.ability);
    map.set(k, { ...c, ...up });
    const vs = [];
    arr(d.variants).forEach((v, i) => {
      const art = catArt(v && v.art); if (!art) return;
      const id = `${d.id || k}:${v.id || i + 1}`, order = num(v.order) || i + 1;
      const det = VD && d.id ? obj(VD.variants[`${d.id}_${String(order).padStart(2, "0")}`]) : {};
      const rel = det.d || v.release || "";
      const src = normSource(det.s || mszSource(v.rarity));
      const cv = { cat: id, card: k, art, name: String(det.n || catVarName(v)).slice(0, 80), artist: String(det.a || v.artist || "").slice(0, 120),
        // Spotlight variants count as their own rarity.
        rarity: String(src === "Spotlight" ? "Spotlight" : det.r || det.t || mszRarity(v.rarity)).slice(0, 40), tier: String(det.t || ""), source: src.slice(0, 60),
        release: /^\d{4}-\d{2}-\d{2}$/.test(rel) ? rel : "", order, unreleased: !!v.unreleased,
        // snap.fan's picture of it, which other sites may read: used to match variants in screenshots
        pic: /^[A-Za-z0-9_]+-[0-9a-f]{16,}\.webp$/.test(String(det.i || "")) ? "https://game-assets.snap.fan/card_variant_images/" + det.i : "" };
      if (!_catVars.has(id)) { _catVars.set(id, cv); vs.push(cv); }
    });
    _catByCard.set(k, vs);
  }
  hydrateVariants();
}
// Saved catalog variants only keep what's yours (ticks, favourite, wish): the name, artist, rarity and source come back from the card data.
// They're filled in again each time the card data changes (the variant details file can arrive after it with the real names), exactly as
// the variant lists show them, and again whenever your saved data is replaced (signing in, another device's change).
function hydrateVariants() {
  hydrateVariants.of = S.variants;
  for (const v of arr(S.variants)) {
    if (!v || !v.cat || v.auto === false) continue; const cv = _catVars.get(v.cat); if (!cv) continue;
    for (const f of ["name", "artist", "rarity", "tier", "source"]) v[f] = cv[f];
    // A release date you typed in yourself is kept (only an empty one is filled)
    if (!v.release && cv.release) v.release = cv.release;
  }
}
// What's saved for a catalog variant: your ticks, favourite and wish, not the catalog's own fields (a collector's 2,000 variants would otherwise fill the whole account)
const CAT_FIELDS = ["name", "artist", "rarity", "tier", "source"];
function compactState(b) {
  if (!b || !Array.isArray(b.variants)) return b;
  b.variants = b.variants.map((v) => {
    if (!v || !v.cat || v.auto === false) return v; const cv = _catVars.get(v.cat); if (!cv) return v;
    const o = {};
    for (const [f, x] of Object.entries(v)) {
      if (CAT_FIELDS.includes(f) || (f === "release" && x === cv.release) || (f === "auto" && x === true)) continue;
      if (x === false || x === "" || x === null || x === undefined) continue;
      o[f] = x;
    }
    return o;
  });
  return b;
}
function cardInUse(k) { return !!(S.owned[k] || S.wishCards[k] || S.favCards[k] || obj(S.cardEdits)[k] || S.decks.some((d) => arr(d.cards).includes(k)) || S.variants.some((v) => v.card === k)); }
function variantArt(v) { if (!v) return ""; const cv = v.cat && _catVars.get(v.cat); return cv ? cv.art : safeUrl(v.art); }
function varUpcoming(v, today) { if (v.owned) return false; const cv = v.cat && _catVars.get(v.cat); return !!((v.release && v.release > today) || (cv && cv.unreleased) || card(v.card).upcoming); }
function byArtist(v) { return v.artist && keyOf(v.artist) !== keyOf(v.name) ? " by " + v.artist : ""; }
function catOrder(v) { const cv = v.cat && _catVars.get(v.cat); return cv ? cv.order : 999; }

/* Your variants plus every variant in the card data you haven't touched yet ("virtual" until you tick or save one). */
let _avSig = "", _avCache = [], _avAdd = null;
const avSigNow = () => `${saveVer}|${catVer}|${vdVer}|${S.variants.length}|${S.updated}`;
// How the list shows one of your saved variants: ones you only ticked keep up with the card data; ones you edited keep your wording.
function avEntry(v) { const cv = v.cat && _catVars.get(v.cat); return cv && v.auto !== false ? { ...v, name: cv.name, artist: cv.artist, rarity: cv.rarity, tier: cv.tier, source: cv.source, release: cv.release || v.release } : cv ? { ...v, tier: cv.tier, source: v.source || cv.source } : v; }
function allVariants() {
  allCards();
  const sig = avSigNow();
  if (sig === _avSig) return _avCache;
  // A card-data variant you just ticked (materializeVar) is swapped into the list instead of rebuilding all of it
  if (_avAdd && _avAdd.sig === sig) { _avCache[_avAdd.i] = avEntry(_avAdd.real); _avAdd = null; _avSig = sig; return _avCache; }
  _avAdd = null;
  const out = [], seen = new Set();
  for (const v of S.variants) {
    if (v.cat) seen.add(v.cat);
    out.push(avEntry(v));
  }
  for (const cv of _catVars.values()) if (!seen.has(cv.cat) && !card(cv.card).hidden) out.push({ id: "cat:" + cv.cat, cat: cv.cat, card: cv.card, name: cv.name, artist: cv.artist, rarity: cv.rarity, tier: cv.tier, source: cv.source, release: cv.release, owned: false, wish: false, favorite: false, virtual: true });
  _avSig = sig; _avCache = out; return out;
}
function variantAny(id) {
  id = String(id || "");
  if (!id.startsWith("cat:")) return variantById(id);
  const cat = id.slice(4);
  return S.variants.find((v) => v.cat === cat) || allVariants().find((v) => v.id === id) || null;
}
function materializeVar(id) {
  const v = variantAny(id); if (!v) return null;
  if (!v.virtual) return v;
  const real = { id: uid(), cat: v.cat, card: v.card, name: v.name, artist: v.artist, rarity: v.rarity, source: v.source || "", release: v.release || "", owned: false, wish: false, favorite: false, auto: true };
  // Rebuilding the whole list for each one froze the app for many seconds when a PC collection import ticked 2,000 variants
  const i = _avSig === avSigNow() ? _avCache.findIndex((x) => x.id === v.id) : -1;
  S.variants.push(real); _avAdd = i >= 0 ? { sig: avSigNow(), i, real } : null; return real;
}
