/* ============ Profile picture & banner: the game's face portraits, card art without the frame, and Custom Card borders ============
   Pictures come from Marvel Snap Zone's image server (static.marvelsnap.pro), the same source as the rest of the card art:
     avatars/<CardDefId>[_<NN>]_avatar.webp   the game's own face portrait for the card or one of its variants
     art/<CardDefId>[_<NN>].webp              the full art with no frame, cost or power
   If one doesn't load, the next picture in line is tried, ending with the card itself cropped to its art.
   borders.json lists every Custom Card border (built daily by scripts/update-borders.py). */
const LK_HOST = "https://static.marvelsnap.pro/";
const AV_AR = 300 / 261; // the face portraits are a little wider than tall
// Where the art sits inside a Marvel Snap Zone card picture (left, top, right, bottom), without the frame, cost, power and name.
const CARD_ART_BOX = [0.2, 0.12, 0.8, 0.8];
// The game's face pictures are a hexagon with the card's name across the bottom: use the face above the name.
const FACE_BOX = [0.185, 0.07, 0.815, 0.7];
// Profile pictures are hexagons with flat tops, like in the game (width:height = 2:√3).
const HEX_AR = 2 / Math.sqrt(3);
/* Where each face portrait sits inside the card's full art (faces.json, built daily by scripts/update-faces.py: the game's
   portrait is a crop of the art). Using the art there shows the same face the game frames, centred, without the card's
   name printed across the bottom. { "SpiderMan_05": [left, top, right, bottom, artWidth/artHeight] } */
const FACES = makeDataFile("faces.json", "snapstat-faces-v1", (j) => j && j.faces && typeof j.faces === "object");
function faceSpot(artId) {
  const f = FACES.data && FACES.data.faces && FACES.data.faces[artId];
  if (!Array.isArray(f) || f.length < 4 || !f.slice(0, 4).every(Number.isFinite)) return null;
  const [x0, y0, x1, y1] = f, ar = Number(f[4]) > 0.3 && Number(f[4]) < 3 ? Number(f[4]) : 1, bw = x1 - x0, bh = y1 - y0;
  if (bw <= 0.03 || bh <= 0.03 || bw > 1.6) return null;
  // Show a little more than the portrait does, centred on the face (a bit above the middle of the portrait).
  const z = clamp(1 / (bw * 1.0) * (ar >= HEX_AR ? HEX_AR / ar : 1), 1, 6);
  return { x: clamp(x0 + bw / 2, 0, 1), y: clamp(y0 + bh * 0.46, 0, 1), z: Math.round(z * 100) / 100, ar };
}

/* ---------- Border list ---------- */
let BDL = null, bdVer = 0;
const BD_CACHE = "snapstat-borders-v1";
function useBorders(j, fromCache) {
  if (!j || !Array.isArray(j.borders) || j.borders.length < 10) return false;
  if (BDL && fromCache) return false;
  BDL = { updated: String(j.updated || ""), base: String(j.base || ""), list: j.borders.filter((b) => b && /^[A-Za-z0-9_]+$/.test(String(b.id || ""))) };
  BDL.byId = new Map(BDL.list.map((b) => [b.id, b])); bdVer++;
  refreshView(); return true;
}
async function loadBorders() {
  if (!window.SNAPSTAT_STANDALONE) return;
  try { const c = localStorage.getItem(BD_CACHE); if (c) useBorders(JSON.parse(c), true); } catch { /* no saved copy */ }
  for (const u of catUrls("borders.json")) {
    try {
      const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
      const text = await r.text(); const j = JSON.parse(text);
      if (BDL && j.updated && j.updated === BDL.updated) return;
      if (!useBorders(j, false)) continue;
      BDL.from = new URL(".", new URL(u, location.href)).href;
      try { localStorage.setItem(BD_CACHE, text); } catch { /* fetched again next time */ }
      return;
    } catch { /* try the next copy */ }
  }
}
const borderById = (id) => (BDL && id ? BDL.byId.get(id) : null) || null;
function borderFile(p) {
  if (!p) return "";
  if (/^https:\/\//.test(p)) return safeUrl(p);
  const base = (BDL && (BDL.base || BDL.from)) || new URL("./", location.href).href;
  return safeUrl(new URL(p, base).href);
}
const motionOk = () => !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
// A border's main colour, from the words in its name, for the drawn frames and the glow.
const BD_COLORS = { aqua: "#2ee6d6", teal: "#2ee6d6", black: "#2a2733", blue: "#3b82f6", gold: "#f2c14e", gilded: "#e9b949", green: "#34d27a", orange: "#ff8a2a", pink: "#ff5fb4", purple: "#9b5cff", rainbow: "rainbow", red: "#ef4444", silver: "#cfd6e2", white: "#f4f4f8", yellow: "#ffe14d", copper: "#d07a43", grey: "#9aa0ab", gray: "#9aa0ab", redblue: "#ef4444", colorpop: "rainbow" };
function borderColor(b) {
  if (b.c) return b.c;
  const words = String(b.id).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[\s_]+/);
  for (let i = words.length - 1; i >= 0; i--) if (BD_COLORS[words[i]]) return BD_COLORS[words[i]];
  if (/redblue/i.test(b.id)) return "#ef4444";
  return "";
}
function borderFx(b) {
  if (b.fx) return b.fx;
  const id = String(b.id).toLowerCase();
  if (/^fire/.test(id)) return "fire"; if (/^neon/.test(id)) return "neon"; if (/^cosmic/.test(id)) return "cosmic";
  if (/^chromatic|refraction/.test(id)) return "shimmer"; if (/^(infinity|ultralegendary)$/.test(id)) return "infinity";
  if (/snowflake|^ice/.test(id)) return "frost"; if (/overloaded|glyphs|champion/.test(id)) return "glow";
  return "";
}
/* The frame, laid over a picture. "Moving" borders use their animated frame when there is one, and a light effect on top otherwise.
   opt.hex draws it round a hexagon (profile pictures); otherwise it's a rectangle (banners). */
function borderHtml(id, opt = {}) {
  const b = borderById(id);
  if (!b) return opt.hex ? `<i class="bdh base" aria-hidden="true"></i>` : "";
  const col = borderColor(b), fx = borderFx(b);
  const still = opt.still || !motionOk();
  const pic = showArt() ? borderFile(opt.hex ? (still ? b.hex : b.hexAnim || b.hex) : still ? b.frame : b.anim || b.frame) : "";
  const moving = (opt.hex ? b.hexAnim : b.anim) && pic && !still;
  // Banners use a frame made for their shape, with the inside corners rounded like the outside.
  const bn = !opt.hex && pic && showArt() ? borderFile(still ? b.banner : b.bannerAnim || b.banner) : "";
  const style = [pic ? `--bi:url('${pic}')` : "", bn ? `--bb:url('${bn}')` : "", col && col !== "rainbow" ? `--bc:${col}` : ""].filter(Boolean).join(";");
  return `<i class="${opt.hex ? "bdh" : "bd"} ${pic ? "" : "drawn"} ${bn ? "bn" : ""} ${col === "rainbow" ? "rainbow" : ""} ${fx && !moving ? "fx-" + fx : ""} ${opt.still ? "still" : ""}" style="${esc(style)}" aria-hidden="true"></i>`;
}
const borderName = (id) => { const b = borderById(id); return b ? b.name || b.id : ""; };

/* ---------- Which picture to show ---------- */
// Turns a saved look (or an old "card"/"variant" pick) into what to draw.
function lookOf(a, which) {
  if (!a) return null;
  if (a.kind === "look") return a.card ? a : cleanLook(a); // someone else's saved picture is checked before it's drawn
  if (a.kind === "card" && a.ref) return { kind: "look", card: a.ref, cat: "", src: which === "banner" ? "art" : "face", fit: "whole" };
  if (a.kind === "variant" && a.ref) { const v = variantById(a.ref); if (v) return { kind: "look", card: v.card, cat: v.cat || "", var: v.cat ? "" : v.id, src: which === "banner" ? "art" : "face", fit: "whole" }; if (a.snap) return { kind: "look", u: a.snap.art, label: a.snap.cardName, src: "card", fit: "whole" }; }
  if (a.kind === "seed" && a.art) return { kind: "look", u: a.art, label: a.label, src: "card", fit: "whole" };
  return null;
}
/* The pictures to try, best first: [{ u, ar, box, z, x, y }]. ar is the picture's width / height; box is the part of it to use. */
function lookSources(l) {
  const out = [];
  if (l.card) {
    const c = card(l.card), cv = l.cat ? _catVars.get(l.cat) : null;
    const def = c.catId, suf = cv ? "_" + pad2(cv.order) : "";
    if (def && !(l.cat && !cv) && !l.var) {
      const fs = l.src === "face" ? faceSpot(def + suf) : null;
      if (fs) out.push({ u: `${LK_HOST}art/${def}${suf}.webp`, ar: fs.ar, face: true, x: fs.x, y: fs.y, z: fs.z });
      if (l.src === "face") out.push({ u: `${LK_HOST}avatars/${def}${suf}_avatar.webp`, ar: AV_AR, box: FACE_BOX, face: true, x: 0.5, y: 0.5 });
      out.push({ u: `${LK_HOST}art/${def}${suf}.webp`, ar: 1, ...(l.src === "face" || l.which === "avatar" ? { x: 0.5, y: 0.3, z: 2.3 } : {}) });
    }
    const cardPic = cv ? cv.art : l.var ? variantArt(variantById(l.var)) : c.art;
    if (cardPic) out.push({ u: cardPic, ar: 1, box: CARD_ART_BOX, ...(l.src === "face" ? { x: 0.5, y: 0.28, z: 1.9 } : {}) });
    // If the variant's pictures won't load, the card's own art is better than an empty frame
    if ((cv || l.var) && def) out.push({ u: `${LK_HOST}art/${def}.webp`, ar: 1, ...(l.src === "face" || l.which === "avatar" ? { x: 0.5, y: 0.3, z: 2.3 } : {}) });
    if ((cv || l.var) && c.art) out.push({ u: c.art, ar: 1, box: CARD_ART_BOX });
  } else if (l.u) {
    // A saved snapshot (another player's profile): the addresses were worked out when they picked it.
    out.push({ u: l.u, ar: l.ar || 1, box: l.box || (l.src === "card" ? CARD_ART_BOX : null), face: l.src === "face" });
    for (const s of arr(l.alt)) if (s && s.u) out.push({ ...s, box: s.box || null });
  }
  return out.filter((s) => safeUrl(s.u));
}
/* Size and place a picture in a box with the aspect ratio ac (width / height).
   z is the zoom, (x, y) the point of the picture to centre on, as fractions. "whole" fits all of it in. */
function lkStyle(s, ac, o, whole) {
  const box = s.box || [0, 0, 1, 1], rw = box[2] - box[0], rh = box[3] - box[1];
  const ap = s.ar * rw / rh;
  let pw, ph;
  if (whole) { if (ap >= ac) { pw = 100; ph = (ac / ap) * 100; } else { ph = 100; pw = (ap / ac) * 100; } }
  else { const z = clamp(Number(o.z) || s.z || 1, 1, 6); if (ap >= ac) { ph = 100 * z; pw = (ap / ac) * 100 * z; } else { pw = 100 * z; ph = (ac / ap) * 100 * z; } }
  const iw = pw / rw, ih = ph / rh;
  let left, top;
  if (whole) { left = 50 - (box[0] + rw / 2) * iw; top = 50 - (box[1] + rh / 2) * ih; }
  else {
    const x = clamp(Number.isFinite(o.x) ? o.x : s.x ?? 0.5, 0, 1), y = clamp(Number.isFinite(o.y) ? o.y : s.y ?? (s.face ? 0.5 : 0.4), 0, 1);
    left = clamp(50 - (box[0] + x * rw) * iw, 100 - box[2] * iw, -box[0] * iw);
    top = clamp(50 - (box[1] + y * rh) * ih, 100 - box[3] * ih, -box[1] * ih);
  }
  const r = (n) => Math.round(n * 100) / 100;
  return `width:${r(iw)}%;height:${r(ih)}%;left:${r(left)}%;top:${r(top)}%`;
}
// A saved zoom and position only applies to the picture it was set on; the others use their own default.
const lkOwn = (l, s, i) => ((l.posFor ? l.posFor === s.u : i === 0) ? l : {});
function lkImgs(l, ac, whole, cls) {
  const srcs = lookSources(l); if (!srcs.length || !showArt()) return "";
  const list = srcs.map((s, i) => ({ u: s.u, st: lkStyle(s, ac, lkOwn(l, s, i), whole) }));
  const first = list[0], rest = JSON.stringify(list.slice(1));
  return `<img class="${cls}" src="${esc(first.u)}" style="${first.st}" alt="" decoding="async" referrerpolicy="no-referrer" data-alt="${esc(rest)}" data-all="${esc(JSON.stringify(list))}" onerror="lkFail(this)">`;
}
// Try the next picture; when none load (often the phone's connection for a moment), try the whole list once more a little later.
function lkFail(img) {
  let rest = []; try { rest = JSON.parse(img.dataset.alt || "[]"); } catch { rest = []; }
  const next = rest.shift();
  if (next) { img.dataset.alt = JSON.stringify(rest); img.setAttribute("style", next.st); img.src = next.u; return; }
  if (!img.dataset.again) {
    let all = []; try { all = JSON.parse(img.dataset.all || "[]"); } catch { all = []; }
    if (all.length) { img.dataset.again = "1"; img.dataset.alt = JSON.stringify(all.slice(1)); setTimeout(() => { if (!img.isConnected) return; img.setAttribute("style", all[0].st); img.src = all[0].u + (all[0].u.includes("?") ? "&" : "?") + "again=1"; }, 2500); return; }
  }
  artFail(img);
}
function lookLabel(l) { return (l.card ? card(l.card).name : l.label) || ""; }
function lookAvatar(l, name, id, cls) {
  const label = lookLabel(l) || String(name || "?");
  const img = lkImgs({ ...l, which: "avatar" }, HEX_AR, false, "lki");
  return `<span class="av hex art look ${img ? "has-img" : ""} ${cls}" style="${artStyle((l.cat || l.card || id || name) + "")}">${esc((label[0] || "?").toUpperCase())}${img}${borderHtml(l.border, { hex: true, still: !/\b(lg|xl)\b/.test(cls) })}</span>`;
}
const BANNER_AR = 2.5;
function lookBanner(l, name) {
  const whole = l.fit !== "fill";
  const main = lkImgs(l, BANNER_AR, whole, "lki");
  const back = whole ? lkImgs(l, BANNER_AR, false, "lkb") : "";
  const cv = l.cat ? _catVars.get(l.cat) : null;
  const cap = l.card ? card(l.card).name + (cv ? " · " + cv.name + byArtist(cv) : "") : l.capText || "";
  return `<div class="banner look art ${main ? "has-img" : ""}" style="${artStyle((l.cat || l.card || name || "banner") + "")}">${back}${main}<span class="big">${esc((lookLabel(l) || name || "?").slice(0, 1).toUpperCase())}</span>${cap ? `<span class="cap">${esc(cap)}</span>` : ""}${borderHtml(l.border)}</div>`;
}
/* What other players see: the picture addresses are saved with your profile so it shows even for someone whose card list is out of date. */
function lookSnap(a, which) {
  const l = lookOf(a, which); if (!l) return a && a.kind === "img" ? { kind: "img", ...(a.fs ? { fs: a.fs } : { url: a.url }), border: a.border || "" } : null;
  const srcs = lookSources({ ...l, which }); if (!srcs.length) return null;
  const cv = l.cat ? _catVars.get(l.cat) : null;
  const main = srcs[0];
  return { kind: "look", src: l.src || "", fit: l.fit || "whole", x: l.x ?? main.x, y: l.y ?? main.y, z: l.z ?? main.z, posFor: l.posFor || "", border: l.border || "", u: main.u, ar: main.ar, box: main.box || null, alt: srcs.slice(1, 3).map((s) => ({ u: s.u, ar: s.ar, box: s.box || null, x: s.x, y: s.y, z: s.z })),
    label: l.card ? card(l.card).name : l.label || "", capText: l.card ? card(l.card).name + (cv ? " · " + cv.name + byArtist(cv) : "") : "" };
}
function cleanLook(a) {
  if (!a || typeof a !== "object") return null;
  const n = (v, lo, hi) => (Number.isFinite(v) ? clamp(v, lo, hi) : undefined);
  const box = Array.isArray(a.box) && a.box.length === 4 && a.box.every((v) => Number.isFinite(v)) ? a.box.map((v) => clamp(v, 0, 1)) : null;
  return { kind: "look", src: String(a.src || "").slice(0, 8), fit: a.fit === "fill" ? "fill" : "whole", x: n(a.x, 0, 1), y: n(a.y, 0, 1), z: n(a.z, 1, 6), border: String(a.border || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 60), u: safeUrl(a.u), ar: n(a.ar, 0.2, 5) || 1, box,
    alt: arr(a.alt).slice(0, 3).map((s) => ({ u: safeUrl(obj(s).u), ar: n(obj(s).ar, 0.2, 5) || 1, box: Array.isArray(obj(s).box) ? obj(s).box.slice(0, 4).map((v) => clamp(num(v), 0, 1)) : null, x: n(obj(s).x, 0, 1), y: n(obj(s).y, 0, 1), z: n(obj(s).z, 1, 6) })).filter((s) => s.u),
    posFor: safeUrl(a.posFor), label: String(a.label || "").slice(0, 60), capText: String(a.capText || "").slice(0, 120) };
}

/* ---------- The picker: card → variant → adjust and pick a border ---------- */
let lk = null;
function openLook(which, step) {
  const cur = which === "banner" ? S.me.banner : S.me.avatar;
  const l = lookOf(cur, which);
  lk = { which, step: step || "card", q: "", own: false, vf: "all", lim: 120, bq: "", bf: "all",
    card: l ? l.card || "" : "", cat: l ? l.cat || "" : "", var: l ? l.var || "" : "", src: l ? l.src || (which === "banner" ? "art" : "face") : which === "banner" ? "art" : "face",
    fit: l ? l.fit || "whole" : "whole", x: l ? l.x : undefined, y: l ? l.y : undefined, z: l ? l.z : undefined, posFor: l ? l.posFor || "" : "",
    border: cur ? cur.border || "" : "", img: cur && cur.kind === "img" ? cur : null, u: l && !l.card ? l.u : "", label: l ? l.label || "" : "" };
  if (lk.step === "edit" && !lk.card && !lk.img && !lk.u) lk.step = "card";
  openSheet(lookSheet);
}
function lookSheet() {
  if (!lk) return "";
  const what = lk.which === "banner" ? "banner" : "profile picture";
  if (lk.step === "card") return lookCardStep(what);
  if (lk.step === "variant") return lookVariantStep(what);
  return lookEditStep(what);
}
function lookCardStep(what) {
  const q = String(lk.q).toLowerCase(), qk = keyOf(q);
  const list = allCards().filter((c) => !c.custom && !c.hidden && !c.upcoming && (!qk || c.key.includes(qk) || keyOf(c.name).includes(qk)) && (!lk.own || S.owned[c.key]))
    .sort((a, b) => a.name.localeCompare(b.name));
  return `${sheetHead(`Pick a character`, `For your ${what}. Tap a card to see its variants.`)}
    <input type="search" id="lk-q" data-lk="q" value="${esc(lk.q)}" placeholder="Search cards" aria-label="Search cards" data-autofocus>
    <div class="chips"><button class="chip" data-a="lkOwn" data-v="0" aria-pressed="${!lk.own}">All cards</button><button class="chip" data-a="lkOwn" data-v="1" aria-pressed="${lk.own}">Cards I own</button></div>
    ${list.length ? `<div class="cgrid lk-cards">${list.slice(0, lk.lim).map((c) => `<div class="cwrap">${cardFace(c, { a: "lkCard", cls: S.owned[c.key] ? "own" : "" })}<div class="cname"><span class="t">${esc(c.name)}</span></div></div>`).join("")}</div>` : `<p class="muted small">No cards match.</p>`}
    ${list.length > lk.lim ? `<button class="btn block" data-a="lkMore">Show more (${list.length - lk.lim} left)</button>` : ""}
    ${lk.which === "avatar" && (S.me.avatar || lk.border) ? `<button class="btn block" data-a="lkClear">Go back to the drawn letter</button>` : lk.which === "banner" && S.me.banner ? `<button class="btn block" data-a="lkClear">Remove my banner</button>` : ""}`;
}
// Every variant of a card, the base card first, with your owned and wishlist ticks.
function lookVariants(k) {
  const c = card(k);
  const base = { id: "base:" + k, base: true, card: k, name: "Base card", artist: "", rarity: "", source: c.series ? "Series " + c.series : c.catSource || "", owned: !!S.owned[k] };
  const vs = allVariants().filter((v) => v.card === k && !(v.virtual && varUpcoming(v, localDate(Date.now())) && !showSoon())).sort((a, b) => catOrder(a) - catOrder(b));
  return [base, ...vs];
}
function lookVariantStep(what) {
  const c = card(lk.card), all = lookVariants(lk.card);
  const list = all.filter((v) => lk.vf === "all" || (lk.vf === "owned" ? v.owned : !v.owned));
  const f = (v, l, n) => `<button class="chip" data-a="lkVf" data-v="${v}" aria-pressed="${lk.vf === v}">${l} <span class="muted num">${n}</span></button>`;
  return `${sheetHead(esc(c.name), `Pick the variant for your ${what}`)}
    <button class="btn sm" data-a="lkBack" data-v="card">‹ All cards</button>
    <div class="chips">${f("all", "All", all.length)}${f("owned", "Owned", all.filter((v) => v.owned).length)}${f("missing", "Not owned", all.filter((v) => !v.owned).length)}</div>
    ${list.length ? `<div class="cgrid">${list.map((v) => v.base ? `<div class="cwrap">${cardFace(c, { a: "lkVar", extra: `data-id=""`, cls: v.owned ? "own" : "miss" })}<div class="cname"><div class="vmeta"><span class="t">Base card</span><span class="vs">${v.owned ? "Owned" : "Not owned"}${v.source ? " · " + esc(v.source) : ""}</span></div></div></div>`
      : varTile(v, { a: "lkVar", extra: `data-id="${esc(v.cat || v.id)}"`, inCard: true })).join("")}</div>` : `<p class="muted small">${lk.vf === "owned" ? "You haven't marked any variants of this card as owned." : "You own every variant of this card."}</p>`}`;
}
function lookPreview() {
  const l = { kind: "look", card: lk.card, cat: lk.cat, var: lk.var, src: lk.src, fit: lk.fit, x: lk.x, y: lk.y, z: lk.z, posFor: lk.posFor, border: lk.border, u: lk.u, label: lk.label };
  if (lk.img) { const pic = lk.img.url || fsImage(lk.img.fs); return lk.which === "banner" ? `<div class="banner look has-img"><img class="lki" src="${esc(pic)}" alt="" style="width:100%;height:100%;left:0;top:0;object-fit:cover">${borderHtml(lk.border)}</div>` : `<span class="av hex art look has-img xl"><img class="lki" src="${esc(pic)}" alt="" style="width:100%;height:100%;left:0;top:0;object-fit:cover">${borderHtml(lk.border, { hex: true })}</span>`; }
  return lk.which === "banner" ? lookBanner(l, S.me.handle) : lookAvatar(l, S.me.handle, store.uid || "me", "xl");
}
function lookEditStep(what) {
  const movable = !lk.img && (lk.which === "avatar" ? true : lk.fit === "fill");
  const cv = lk.cat ? _catVars.get(lk.cat) : null;
  const seg = (key, v, l) => `<button class="chip" data-a="lkSet" data-f="${key}" data-v="${v}" aria-pressed="${lk[key] === v}">${l}</button>`;
  const z = Number(lk.z) || (() => { const s = lookSources({ card: lk.card, cat: lk.cat, var: lk.var, src: lk.src, u: lk.u, which: lk.which })[0]; return (s && s.z) || 1; })();
  return `${sheetHead(`Your ${what}`, lk.img ? "Your own picture" : esc(card(lk.card).name + (cv ? " · " + cv.name : lk.var ? "" : " · Base card")))}
    ${lk.img ? "" : `<button class="btn sm" data-a="lkBack" data-v="${lk.card ? "variant" : "card"}">‹ ${lk.card ? "Other variants" : "Pick a card"}</button>`}
    <div class="lk-sticky">
      <div class="lk-stage ${lk.which}" id="lk-stage" ${movable ? `data-lkdrag="1"` : ""}>${lookPreview()}</div>
      ${lk.img ? "" : lk.which === "avatar" ? `<div class="chips" style="justify-content:center">${seg("src", "face", "Face")}${seg("src", "art", "Card art")}</div>`
        : `<div class="chips" style="justify-content:center">${seg("fit", "whole", "Whole art")}${seg("fit", "fill", "Fill the banner")}</div>`}
      ${movable ? `<div class="row nowrap lk-zoom"><span class="muted small">Zoom</span><input type="range" min="1" max="5" step="0.05" value="${z}" data-lk="z" aria-label="Zoom"><button class="btn sm ghost" data-a="lkReset">Reset</button></div>
        <p class="muted small" style="text-align:center;margin:0">Drag the picture to move it. It stays here while you scroll the borders.</p>` : ""}
    </div>
    ${lookBorderPicker()}
    <button class="btn snap block" data-a="lkSave">Use this ${what}</button>`;
}
function lookBorderPicker() {
  if (!BDL) return `<p class="muted small">Borders load with the card data${window.SNAPSTAT_STANDALONE ? "" : " in the installed app"}.</p>`;
  const q = keyOf(lk.bq);
  const list = BDL.list.filter((b) => (!q || keyOf(b.name).includes(q) || keyOf(b.id).includes(q)) && (lk.bf === "all" || (lk.bf === "moving" ? b.anim || borderFx(b) : true)));
  const moving = BDL.list.filter((b) => b.anim || borderFx(b)).length;
  return `<div class="stack" style="gap:8px"><div class="row between"><h3 style="margin:0">Border</h3><span class="muted small">${lk.border ? esc(borderName(lk.border)) : "None"}</span></div>
    <input type="search" id="lk-bq" data-lk="bq" value="${esc(lk.bq)}" placeholder="Search ${BDL.list.length} borders" aria-label="Search borders">
    <div class="chips"><button class="chip" data-a="lkBf" data-v="all" aria-pressed="${lk.bf === "all"}">All</button><button class="chip" data-a="lkBf" data-v="moving" aria-pressed="${lk.bf === "moving"}">Moving <span class="muted num">${moving}</span></button></div>
    <div class="bgrid"><button class="bsw ${lk.border ? "" : "on"}" data-a="lkBorder" data-v="" aria-pressed="${!lk.border}"><span class="bsq none ${lk.which === "avatar" ? "hex" : ""}">${ICON.x}</span><span class="bn">${lk.which === "avatar" ? "Standard" : "No border"}</span></button>
    ${list.map((b) => `<button class="bsw ${lk.border === b.id ? "on" : ""}" data-a="lkBorder" data-v="${esc(b.id)}" aria-pressed="${lk.border === b.id}" aria-label="${esc(b.name || b.id)}"><span class="bsq ${lk.which === "avatar" ? "hex" : ""}">${borderHtml(b.id, { still: true, hex: lk.which === "avatar" })}</span><span class="bn">${esc(b.name || b.id)}${b.anim || borderFx(b) ? ` <span class="mv" title="Moving">✦</span>` : ""}</span></button>`).join("")}</div></div>`;
}
function lookUpdatePreview() {
  const st = $("#lk-stage"); if (st) st.innerHTML = lookPreview();
}
function lookSave() {
  const which = lk.which;
  if (lk.img) S.me[which] = { ...lk.img, border: lk.border || "" };
  else if (lk.card || lk.u) {
    const l = { kind: "look", card: lk.card, cat: lk.cat || "", src: lk.src, fit: lk.fit, border: lk.border || "" };
    if (lk.var) l.var = lk.var;
    if (!lk.card) { l.u = lk.u; l.label = lk.label; }
    if (Number.isFinite(lk.x)) { l.x = lk.x; l.y = lk.y; l.posFor = lk.posFor || ""; }
    if (Number.isFinite(Number(lk.z)) && lk.z) l.z = Number(lk.z);
    S.me[which] = l;
  }
  save(); closeSheet(); render(); toast(which === "banner" ? "Banner updated" : "Profile picture updated");
}
// Drag to move the picture inside the box.
let lkDrag = null;
document.addEventListener("pointerdown", (e) => {
  const st = e.target.closest && e.target.closest("[data-lkdrag]"); if (!st || !lk) return;
  const img = st.querySelector(".lki"); if (!img) return;
  const srcs = lookSources({ card: lk.card, cat: lk.cat, var: lk.var, src: lk.src, u: lk.u, which: lk.which });
  const cur = srcs.find((s) => img.src === s.u || img.getAttribute("src") === s.u) || srcs[0]; if (!cur) return;
  const r = st.firstElementChild.getBoundingClientRect();
  lkDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: Number.isFinite(lk.x) && lk.posFor === cur.u ? lk.x : cur.x ?? 0.5, y: Number.isFinite(lk.y) && lk.posFor === cur.u ? lk.y : cur.y ?? (cur.face ? 0.5 : 0.4), w: r.width, h: r.height, s: cur, img };
  st.setPointerCapture && st.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener("pointermove", (e) => {
  if (!lkDrag || e.pointerId !== lkDrag.id) return;
  const d = lkDrag, s = d.s, ac = d.w / d.h, z = clamp(Number(lk.z) || s.z || 1, 1, 6);
  const box = s.box || [0, 0, 1, 1], rw = box[2] - box[0], rh = box[3] - box[1], ap = s.ar * rw / rh;
  const pw = (ap >= ac ? ap / ac : 1) * z * d.w, ph = (ap >= ac ? 1 : ac / ap) * z * d.h; // the picture's size on screen
  lk.x = clamp(d.x - (e.clientX - d.sx) / pw, 0, 1); lk.y = clamp(d.y - (e.clientY - d.sy) / ph, 0, 1); lk.posFor = s.u;
  if (!Number(lk.z)) lk.z = z;
  d.img.setAttribute("style", lkStyle(s, ac, { x: lk.x, y: lk.y, z }, false));
});
const lkEnd = (e) => { if (lkDrag && e.pointerId === lkDrag.id) lkDrag = null; };
document.addEventListener("pointerup", lkEnd); document.addEventListener("pointercancel", lkEnd);
document.addEventListener("input", (e) => {
  const t = e.target, d = t.dataset; if (!d.lk || !lk) return;
  if (d.lk === "z") {
    lk.z = Number(t.value);
    const img = $("#lk-stage .lki"); const srcs = lookSources({ card: lk.card, cat: lk.cat, var: lk.var, src: lk.src, u: lk.u, which: lk.which });
    const s = (img && srcs.find((x) => img.getAttribute("src") === x.u)) || srcs[0];
    if (img && s) { if (lk.posFor !== s.u) { lk.x = s.x ?? 0.5; lk.y = s.y ?? (s.face ? 0.5 : 0.4); lk.posFor = s.u; } const box = $("#lk-stage").firstElementChild.getBoundingClientRect(); img.setAttribute("style", lkStyle(s, box.width / box.height, lk, false)); }
    return;
  }
  lk[d.lk] = t.value; if (d.lk === "q") lk.lim = 120; refreshSheet();
});
Object.assign(A, {
  lkOpen: (el) => openLook(el.dataset.v, el.dataset.step),
  lkOwn: (el) => { lk.own = el.dataset.v === "1"; lk.lim = 120; refreshSheet(); },
  lkMore: () => { lk.lim += 120; refreshSheet(); },
  lkCard: (el) => { if (lk.card !== el.dataset.k) { lk.x = lk.y = undefined; lk.z = undefined; lk.posFor = ""; } lk.card = el.dataset.k; lk.cat = ""; lk.var = ""; lk.img = null; lk.u = ""; lk.vf = "all"; lk.step = "variant"; refreshSheet(); $("#sheetBody").scrollTop = 0; },
  lkVar: (el) => {
    const id = el.dataset.id || ""; const v = id ? (id.includes(":") && _catVars.get(id) ? { cat: id } : variantById(id)) : null;
    const cat = v ? v.cat || "" : "", vid = v && !v.cat ? v.id || "" : "";
    if (cat !== lk.cat || vid !== lk.var) { lk.x = lk.y = undefined; lk.z = undefined; lk.posFor = ""; }
    lk.cat = cat; lk.var = vid; lk.step = "edit"; refreshSheet(); $("#sheetBody").scrollTop = 0;
  },
  lkVf: (el) => { lk.vf = el.dataset.v; refreshSheet(); },
  lkBack: (el) => { lk.step = el.dataset.v; refreshSheet(); },
  lkSet: (el) => { lk[el.dataset.f] = el.dataset.v; lk.x = lk.y = undefined; lk.z = undefined; lk.posFor = ""; refreshSheet(); },
  lkReset: () => { lk.x = lk.y = undefined; lk.z = undefined; lk.posFor = ""; refreshSheet(); },
  lkBorder: (el) => { lk.border = el.dataset.v; const keep = $("#sheetBody").scrollTop; refreshSheet(); $("#sheetBody").scrollTop = keep; },
  lkBf: (el) => { lk.bf = el.dataset.v; refreshSheet(); },
  lkSave: () => lookSave(),
  lkClear: () => { S.me[lk.which] = null; save(); closeSheet(); render(); toast(lk.which === "banner" ? "Banner removed" : "Profile picture reset"); },
});
