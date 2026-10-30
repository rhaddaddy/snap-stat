/* ============ Locations, season art, deck icons and card backs, the PC collection file ============ */

/* ---------- Season key art and card backs (art.json, refreshed daily from Marvel Snap Zone) ---------- */
const ART = makeDataFile("art.json", "snapstat-art-v1", (j) => j && j.seasons && typeof j.seasons === "object");
// The picture the game shows while it loads a season: matched by the season's name, then by the month it starts.
function seasonArt(s) {
  const all = obj(ART.data && ART.data.seasons); if (!s) return "";
  const n = keyOf(s.name || "");
  if (n.length >= 4) for (const a of Object.values(all)) { const t = keyOf(obj(a).title); if (t && (t === n || (t.length >= 5 && (t.includes(n) || n.includes(t))))) return safeUrl(a.img); }
  const m = String(s.start || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) && all[m] ? safeUrl(all[m].img) : "";
}
function seasonPic(s, cls) {
  const u = showArt() ? seasonArt(s) : "";
  return `<span class="${cls} art ${u ? "has-img" : ""}" style="${artStyle(s.name || "season")}"><b>${esc((String(s.name || "?")[0] || "?").toUpperCase())}</b>${u ? imgTag(u, "simg") : ""}</span>`;
}
function cardBacks() { return arr(ART.data && ART.data.cardbacks).filter((b) => b && /^[A-Za-z0-9_]+$/.test(String(b.id || "")) && (b.noArt || b.img)); }
// The picture: from Marvel Snap Zone or snap.fan, or a cleaned-up copy kept with the daily data (cardbacks/<id>.webp).
function cardBackImg(b) {
  if (!b || b.noArt || !b.img) return "";
  if (/^https:\/\//.test(b.img)) return safeUrl(b.img);
  try { return safeUrl(new URL(b.img, ART.from || new URL("./", location.href).href).href); } catch { return ""; }
}
// A card back without a usable picture (the game's moving ones) gets a drawn tile with its name.
// The picture, cropped to the card back itself when the picture has empty space round it (Marvel Snap Zone's are square)
function backImg(b) {
  const u = showArt() ? cardBackImg(b) : ""; if (!u) return "";
  const t = imgTag(u, b.box ? "crop" : ""), x = arr(b.box).map(Number);
  if (!t || x.length !== 4 || !(x[2] > x[0] && x[3] > x[1])) return t;
  const w = x[2] - x[0], h = x[3] - x[1], r = (v) => Math.round(v * 1000) / 10;
  return t.replace("<img ", `<img style="width:${r(1 / w)}%;height:${r(1 / h)}%;left:${r(-x[0] / w)}%;top:${r(-x[1] / h)}%" `);
}
// Card backs that move in the game have no still picture anywhere, so the character's own art stands in
function backStandIn(b) {
  if (!b || !b.noArt || !showArt()) return "";
  const n = keyOf(b.name), c = allCards().filter((x) => !x.custom && !x.unknown && keyOf(x.name).length >= 4 && n.includes(keyOf(x.name))).sort((a, z) => keyOf(z.name).length - keyOf(a.name).length)[0];
  const u = c ? chipArt(c) : ""; return u ? imgTag(u, "stand") : "";
}
function backPic(b) {
  const st = backImg(b) ? "" : backStandIn(b);
  return `${backImg(b) || st}<span class="cbx">${esc(b.name)}${b.noArt ? `<small>Moves in the game</small>` : ""}</span>`;
}
const cardBackById = (id) => (id ? cardBacks().find((b) => b.id === id) || null : null);
// Your card backs are kept with your other cosmetics, matched by name.
const backCos = (b) => S.cosmetics.find((c) => c.kind === "cardback" && c.ref === b.id) || S.cosmetics.find((c) => c.kind === "cardback" && !c.ref && keyOf(c.name) === keyOf(b.name)) || null;
function setBack(b, field, val) {
  let c = backCos(b);
  if (!c) { c = { id: uid(), kind: "cardback", name: b.name, source: b.added ? "Added " + b.added : "", owned: false, wish: false, ref: b.id }; S.cosmetics.push(c); }
  c.ref = b.id; c[field] = val; save();
}

/* ---------- Locations: no frame, and your numbers on each one ---------- */
function locDetail(name) {
  const k = keyOf(name);
  const tracked = realMatches().filter((m) => m.tracked && arr(m.locs).some((L) => String(obj(L).name || "").trim()));
  const here = [];
  for (const m of tracked) arr(m.locs).forEach((L, i) => { if (keyOf(obj(L).name) === k) here.push({ m, i, L: obj(L) }); });
  const by = {}, plays = [];
  for (const { m, i } of here) {
    const seen = new Set();
    for (const p of arr(m.plays)) {
      if (num(p.loc) !== i || !p.k || String(p.k).startsWith("custom:")) continue;
      plays.push({ k: p.k, power: num(p.power), ts: m.ts, id: m.id });
      if (seen.has(p.k)) continue; seen.add(p.k);
      const r = (by[p.k] = by[p.k] || { k: p.k, n: 0, w: 0, l: 0, max: 0 });
      r.n++; if (m.result === "W") r.w++; else if (m.result === "L") r.l++;
    }
    for (const p of arr(m.plays)) if (num(p.loc) === i && by[p.k]) by[p.k].max = Math.max(by[p.k].max, num(p.power));
  }
  const mine = here.map((x) => num(x.L.my)), opp = here.map((x) => num(x.L.opp));
  const avg = (a) => (a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10 : 0);
  const mw = here.filter((x) => x.m.result === "W").length, ml = here.filter((x) => x.m.result === "L").length;
  const lw = here.filter((x) => num(x.L.my) > num(x.L.opp)).length, ll = here.filter((x) => num(x.L.my) < num(x.L.opp)).length;
  const cards = Object.values(by).sort((a, b) => b.n - a.n || b.w - a.w);
  return { games: here.length, tracked: tracked.length, pull: pct(here.length, tracked.length), mw, ml, wr: pct(mw, mw + ml), lw, ll, lwr: pct(lw, lw + ll),
    avg: avg(mine), max: mine.length ? Math.max(...mine) : 0, oppAvg: avg(opp), cubes: here.reduce((s, x) => s + (x.m.noCubes ? 0 : num(x.m.cubes)), 0),
    most: cards[0] || null, cards: cards.slice(0, 8), best: [...cards].filter((c) => c.n >= 2).sort((a, b) => pct(b.w, b.w + b.l) - pct(a.w, a.w + a.l) || b.n - a.n).slice(0, 3),
    top: plays.sort((a, b) => b.power - a.power || b.ts - a.ts).slice(0, 6), recent: here.sort((a, b) => b.m.ts - a.m.ts).slice(0, 6) };
}
function locPic(l, cls) {
  return `<span class="${cls} art" style="${artStyle(l.name)}"><b>${esc((l.name[0] || "?").toUpperCase())}</b>${imgTag(l.art, "limg")}</span>`;
}
let lo = null;
function locSheet() {
  const l = locByName(lo) || { name: lo, ability: "", art: "" };
  const r = locDetail(l.name);
  const stat = (v, t) => `<div class="kpi"><b class="num">${v}</b><span>${t}</span></div>`;
  return `${sheetHead(esc(l.name), l.soon ? "Not out yet" : r.games ? `${r.games} of your tracked game${r.games === 1 ? "" : "s"}` : "")}
    <div class="lochero">${locPic(l, "lbig")}<div class="grow">${l.ability ? `<p class="lab">${esc(l.ability)}</p>` : ""}${locCommunityLine(l.name).replace(/<div class="s">/, '<p class="muted small">').replace(/<\/div>$/, "</p>")}</div></div>${typeof locTipsHtml === "function" ? locTipsHtml(l) : ""}
    ${r.games ? `<div class="kpis">${stat(r.pull + "%", `pull rate · ${r.games} of ${r.tracked}`)}${stat(r.wr + "%", "match wins")}${stat(r.lwr + "%", "won the location")}${stat(r.avg, "average power")}${stat(r.max, "highest power")}${stat(signed(r.cubes), "cubes")}</div>
      ${r.most ? `<div class="panel stack small"><h3>Most played here</h3><div class="row">${cardChip(r.most.k, { noOwn: true })}<span class="muted">${r.most.n} time${r.most.n === 1 ? "" : "s"} · won ${pct(r.most.w, r.most.w + r.most.l)}% of those games</span></div></div>` : ""}
      ${r.top.length ? `<div class="panel stack small"><h3>Highest power played here</h3><div class="chiplist">${r.top.map((p) => cardChip(p.k, { noOwn: true, pow: p.power, suffix: ` <span class="muted">${esc(dayStr(p.ts))}</span>` })).join("")}</div></div>` : ""}
      ${r.cards.length > 1 ? `<div class="panel stack small"><h3>Cards you play here</h3><div class="list">${r.cards.map((c) => `<div class="li">${cardChip(c.k, { noOwn: true })}<div class="grow"></div><span class="muted num">${c.n}× · ${pct(c.w, c.w + c.l)}% wins · best ${c.max}</span></div>`).join("")}</div></div>` : ""}
      ${r.best.length ? `<p class="small">Best here for you: ${r.best.map((c) => `<b>${esc(card(c.k).name)}</b> (${pct(c.w, c.w + c.l)}%)`).join(", ")}</p>` : ""}
      ${locDecksHtml(l.name)}
      <h3>Recent games here</h3><div class="list">${r.recent.map(({ m, L }) => `<button class="li" data-a="matchEdit" data-id="${esc(m.id)}"><span class="pill ${m.result}">${m.result}</span><div class="grow"><div class="t">${esc(m.deckName || "No deck")}${m.oppName ? ` <span class="muted">vs ${esc(m.oppName)}</span>` : ""}</div><div class="s">${esc(dateTimeStr(m.ts))} · here ${num(L.my)} to ${num(L.opp)}</div></div>${m.noCubes ? "" : cubes(signed(num(m.cubes)), num(m.cubes) >= 0 ? "pos" : "neg")}</button>`).join("")}</div>`
    : `<div class="empty"><strong>No games here yet</strong><span>Your numbers show up once you track a match with this location, in the live tracker, from a screenshot, or by naming the locations when you log a match.</span></div>`}`;
}

/* ---------- Deck icon: the cover card's face in a hexagon, with the deck's card back ---------- */
function deckLook(d) {
  const k = d.cover || d.cards[0]; if (!k || String(k).startsWith("custom:")) return null;
  const base = { kind: "look", card: k, cat: "", var: "", src: "face", fit: "whole", border: d.coverBorder || "" };
  // The icon's own variant (picked in the deck icon picker), else the variant the deck uses for that card.
  const cv = d.cover === k ? String(d.coverVar || "") : "";
  if (cv === "base") return base;
  if (cv && _catVars.get(cv)) return { ...base, cat: cv };
  if (cv && variantById(cv)) { const v = variantById(cv); return { ...base, cat: v.cat || "", var: v.cat ? "" : v.id }; }
  const v = deckVariant(d, k);
  return { ...base, cat: (v && v.cat) || "", var: v && !v.cat ? v.id : "" };
}
/* The deck icon picker, like the game's: every card with its art, then every variant of the one you pick. */
let dkc = { step: "card", q: "", f: "deck", lim: 90, k: "", vf: "all" };
function dkCoverSheet() {
  const d = deckEdit(); if (!d) return sheetHead("Deck not found");
  return dkc.step === "variant" ? dkCoverVariants(d) : dkCoverCards(d);
}
function dkCoverCards(d) {
  const inDeck = new Set(arr(d.cards)), q = keyOf(dkc.q);
  let list = allCards().filter((c) => !c.custom && !c.hidden && (!c.upcoming || inDeck.has(c.key)) && (!q || c.key.includes(q) || keyOf(c.name).includes(q)));
  const nDeck = list.filter((c) => inDeck.has(c.key)).length, nOwn = list.filter((c) => S.owned[c.key]).length, nAll = list.length;
  if (dkc.f === "deck") list = list.filter((c) => inDeck.has(c.key)); else if (dkc.f === "owned") list = list.filter((c) => S.owned[c.key]);
  list.sort((a, b) => (inDeck.has(b.key) ? 1 : 0) - (inDeck.has(a.key) ? 1 : 0) || num(a.cost) - num(b.cost) || a.name.localeCompare(b.name));
  const chip = (v, l, n) => `<button class="chip" data-a="dkcF" data-v="${v}" aria-pressed="${dkc.f === v}">${l} <span class="muted num">${n}</span></button>`;
  const cur = d.cover || d.cards[0] || "";
  return `${sheetHead("Deck icon", `For ${esc(d.name)}. Pick a card, then its variant.`)}
    <button class="btn sm" data-a="dkBack" data-v="">‹ Back to the deck</button>
    <input type="search" id="dkc-q" data-dkc="q" value="${esc(dkc.q)}" placeholder="Search every card" aria-label="Search cards" data-autofocus>
    <div class="chips">${chip("deck", "In this deck", nDeck)}${chip("owned", "Cards I own", nOwn)}${chip("all", "All cards", nAll)}</div>
    ${list.length ? `<div class="cgrid lk-cards">${list.slice(0, dkc.lim).map((c) => `<div class="cwrap ${c.key === cur ? "pick" : ""}">${cardFace(c, { a: "dkcCard", cls: S.owned[c.key] ? "own" : "" })}<div class="cname"><span class="t">${esc(c.name)}</span>${c.key === cur ? `<span class="vs">Deck icon now</span>` : ""}</div></div>`).join("")}</div>` : `<p class="muted small">No cards match.</p>`}
    ${list.length > dkc.lim ? `<button class="btn block" data-a="dkcMore">Show more (${list.length - dkc.lim} left)</button>` : ""}`;
}
function dkCoverVariants(d) {
  const c = card(dkc.k), all = lookVariants(dkc.k);
  const list = all.filter((v) => dkc.vf === "all" || (dkc.vf === "owned" ? v.owned : !v.owned));
  const look = d.cover === dkc.k ? deckLook(d) : null, curId = look ? look.cat || look.var || "base" : "";
  const f = (v, l, n) => `<button class="chip" data-a="dkcVf" data-v="${v}" aria-pressed="${dkc.vf === v}">${l} <span class="muted num">${n}</span></button>`;
  return `${sheetHead(esc(c.name), "Pick the variant for the deck icon")}
    <button class="btn sm" data-a="dkcStep" data-v="card">‹ All cards</button>
    <div class="chips">${f("all", "All", all.length)}${f("owned", "Owned", all.filter((v) => v.owned).length)}${f("missing", "Not owned", all.filter((v) => !v.owned).length)}</div>
    ${list.length ? `<div class="cgrid">${list.map((v) => {
      const id = v.base ? "base" : v.cat || v.id, on = id === curId;
      const tile = v.base ? `<div class="cwrap">${cardFace(c, { a: "dkcVar", extra: `data-id="base"`, cls: v.owned ? "own" : "miss" })}<div class="cname"><div class="vmeta"><span class="t">Base card</span><span class="vs">${v.owned ? "Owned" : "Not owned"}</span></div></div></div>`
        : varTile(v, { a: "dkcVar", extra: `data-id="${esc(id)}"`, inCard: true });
      return on ? tile.replace('<div class="cwrap">', '<div class="cwrap pick">') : tile;
    }).join("")}</div>` : `<p class="muted small">${dkc.vf === "owned" ? "You haven't marked any variants of this card as owned." : "You own every variant of this card."}</p>`}`;
}
function deckIcon(d, big) {
  const l = deckLook(d), b = cardBackById(d.back);
  const face = l ? lookAvatar(l, card(l.card).name, d.id, big ? "lg" : "") : `<span class="av hex art ${big ? "lg" : ""}" style="${artStyle(d.id)}">${esc((String(d.name || "?")[0] || "?").toUpperCase())}${borderHtml("", { hex: true, still: true })}</span>`;
  const bu = b && showArt() ? cardBackImg(b) : "";
  const back = b ? `<span class="dkb art ${bu ? "has-img" : ""}" style="${artStyle(b.id)}">${bu ? backImg(b) : ""}</span>` : "";
  return `<span class="dkic ${big ? "big" : ""} ${back ? "" : "noback"}" aria-hidden="true">${back}${face}</span>`;
}
function deckLookHtml(d) {
  const b = cardBackById(d.back);
  return `<div class="dklook">${deckIcon(d, true)}<div class="stack grow" style="gap:6px">
    <button class="btn sm" data-a="dkcOpen">Icon: ${esc(card(d.cover || d.cards[0] || "").name || "none")}</button>
    <button class="btn sm" data-a="dkBackOpen">Card back: ${esc(b ? b.name : cardBacks().length ? "none" : "loading…")}</button>
    <button class="btn sm" data-a="dkBorderOpen">Border: ${esc(d.coverBorder ? borderName(d.coverBorder) || "custom" : "Standard")}</button></div></div>
    ${deckSeenHtml(d)}
    ${deckTagsEdit(d)}`;
}
let dkb = { q: "", own: false, lim: 60 };
function backGrid(list, act, cur) {
  return `<div class="cbgrid">${list.map((b) => { const c = backCos(b); return `<button class="cbt ${cur === b.id ? "on" : ""}" data-a="${act}" data-id="${esc(b.id)}" aria-pressed="${cur === b.id}"><span class="cbp art ${cardBackImg(b) && showArt() ? "has-img" : ""}" style="${artStyle(b.id)}">${backPic(b)}${c && c.owned ? OWNED_TICK : ""}</span><span class="cbn">${esc(b.name)}</span>${b.added ? `<span class="cbd">Update ${esc(b.added)}</span>` : ""}</button>`; }).join("")}</div>`;
}
function backFilter(st) {
  const q = keyOf(st.q);
  return cardBacks().filter((b) => (!q || keyOf(b.name).includes(q) || keyOf(b.id).includes(q)) && (!st.own || (backCos(b) || {}).owned));
}
function dkBackSheet() {
  const d = deckEdit(); if (!d) return sheetHead("Deck not found");
  const all = cardBacks(), list = backFilter(dkb), owned = all.filter((b) => (backCos(b) || {}).owned).length;
  return `${sheetHead("Card back", `For ${esc(d.name)}`)}
    <button class="btn sm" data-a="dkBack" data-v="">‹ Back to the deck</button>
    ${all.length ? `<input type="search" id="dkb-q" data-dkb="q" value="${esc(dkb.q)}" placeholder="Search ${all.length} card backs" aria-label="Search card backs" data-autofocus>
      <div class="chips"><button class="chip" data-a="dkbOwn" data-v="0" aria-pressed="${!dkb.own}">All</button><button class="chip" data-a="dkbOwn" data-v="1" aria-pressed="${dkb.own}">Ones I own <span class="muted num">${owned}</span></button></div>
      <button class="btn sm ghost" data-a="dkBackPick" data-id="">No card back</button>
      ${list.length ? backGrid(list.slice(0, dkb.lim), "dkBackPick", d.back) : `<p class="muted small">${dkb.own ? "Tick the card backs you own in Collection › Cosmetics." : "No card backs match."}</p>`}
      ${list.length > dkb.lim ? `<button class="btn block" data-a="dkbMore">Show more (${list.length - dkb.lim} left)</button>` : ""}`
    : `<p class="muted small">The card back list loads with the card data${window.SNAPSTAT_STANDALONE ? ". Try again in a moment." : " in the installed app."}</p>`}`;
}
let dkbd = { q: "" };
function dkBorderSheet() {
  const d = deckEdit(); if (!d) return sheetHead("Deck not found");
  if (!BDL) return `${sheetHead("Border")}<p class="muted small">Borders load with the card data.</p>`;
  const q = keyOf(dkbd.q), list = BDL.list.filter((b) => !q || keyOf(b.name).includes(q) || keyOf(b.id).includes(q));
  return `${sheetHead("Icon border", `For ${esc(d.name)}`)}
    <button class="btn sm" data-a="dkBack" data-v="">‹ Back to the deck</button>
    <div class="dkprev">${deckIcon(d, true)}</div>
    <input type="search" id="dkbd-q" data-dkbd="q" value="${esc(dkbd.q)}" placeholder="Search ${BDL.list.length} borders" aria-label="Search borders">
    <div class="bgrid"><button class="bsw ${d.coverBorder ? "" : "on"}" data-a="dkBorderPick" data-v="" aria-pressed="${!d.coverBorder}"><span class="bsq none hex">${ICON.x}</span><span class="bn">Standard</span></button>
    ${list.map((b) => `<button class="bsw ${d.coverBorder === b.id ? "on" : ""}" data-a="dkBorderPick" data-v="${esc(b.id)}" aria-pressed="${d.coverBorder === b.id}" aria-label="${esc(b.name || b.id)}"><span class="bsq hex">${borderHtml(b.id, { still: true, hex: true })}</span><span class="bn">${esc(b.name || b.id)}</span></button>`).join("")}</div>`;
}

/* ---------- Cosmetics: every card back with its picture ---------- */
let cbv = { q: "", f: "all", lim: 60 };
function cardBackGallery() {
  const all = cardBacks(); if (!all.length) return "";
  const own = (b) => !!(backCos(b) || {}).owned, want = (b) => !!(backCos(b) || {}).wish;
  const q = keyOf(cbv.q);
  const list = all.filter((b) => (!q || keyOf(b.name).includes(q)) && (cbv.f === "all" || (cbv.f === "owned" ? own(b) : cbv.f === "wish" ? want(b) : !own(b))));
  const n = all.filter(own).length;
  const f = (v, l, c) => `<button class="chip" data-a="cbF" data-v="${v}" aria-pressed="${cbv.f === v}">${l} <span class="muted num">${c}</span></button>`;
  return `<div class="stack" style="gap:8px"><div class="row between"><span class="small"><b class="num">${n}</b> of ${all.length} card backs owned</span><span class="muted small">Tap one to tick it</span></div>
    ${pctBar(n, all.length)}
    <input type="search" id="cb-q" data-cbv="q" value="${esc(cbv.q)}" placeholder="Search card backs" aria-label="Search card backs">
    <div class="chips">${f("all", "All", all.length)}${f("owned", "Owned", n)}${f("missing", "Not owned", all.length - n)}${f("wish", "Wishlist", all.filter(want).length)}</div>
    ${list.length ? `<div class="cbgrid">${list.slice(0, cbv.lim).map((b) => `<div class="cbt ${own(b) ? "own" : ""}"><button class="cbp art ${cardBackImg(b) && showArt() ? "has-img" : ""}" data-a="cbOwn" data-id="${esc(b.id)}" aria-pressed="${own(b)}" aria-label="${esc(b.name)}: ${own(b) ? "owned" : "not owned"}" style="${artStyle(b.id)}">${backPic(b)}${own(b) ? OWNED_TICK : ""}</button>
      <div class="cbinfo"><div class="grow" style="min-width:0"><span class="cbn">${esc(b.name)}</span>${b.added ? `<span class="cbd">Update ${esc(b.added)}</span>` : ""}</div><button class="star" data-a="cbWish" data-id="${esc(b.id)}" aria-pressed="${want(b)}" aria-label="Wishlist">${HEART}</button></div></div>`).join("")}</div>` : `<p class="muted small">No card backs here.</p>`}
    ${list.length > cbv.lim ? `<button class="btn block" data-a="cbMore">Show more (${list.length - cbv.lim} left)</button>` : ""}</div>`;
}
function pctBar(a, b) { return `<div class="bar"><i style="width:${barW(num(a), num(b))}%"></i></div>`; }

/* ---------- The PC game's collection file ---------- */
/* MARVEL SNAP on PC keeps your collection in CollectionState.json. Every card in it has a CardDefId (the card) and, for a
   variant, an ArtVariantDefId like "Abomination_03". Decks are lists of CardDefIds with a name. Nothing leaves the phone. */
/* The game's own names for Infinity Split finishes and flares → the names SNAP Stat uses ("RaysBlackWhite" → "Black and White Rays") */
const FX_WORDS = { kirby: "Krackle", comic: "Tone", sparkle: "Stardust", space: "Cosmic", snow: "Snowflakes", frosted: "Frosted Glass", circuits: "Glass Circuits", confetti: "Rainbow Confetti", goldfoil: "Gold", prismfoil: "Prism", prismgoldtarot: "Gilded Prism", glasswakanda: "Wakandan Glass", metallicfoil: "Foil Metallic", neontrails: "Neon Trails", galacticstorm: "Galactic Storm", diamondgold: "Gold Glimmer" };
function effectName(id, flare) {
  id = String(id || ""); if (!id || /^none$/i.test(id)) return "";
  const low = id.toLowerCase(); if (FX_WORDS[low]) return FX_WORDS[low];
  let words = prettyDef(id).split(" ").map((w) => FX_WORDS[w.toLowerCase()] || w);
  if (/^embers$/i.test(id)) words = ["Fire", "Embers"];
  const want = new Set(words.join(" ").toLowerCase().split(" ")), list = flare ? SPLIT_FLARES : SPLIT_FINISHES;
  const hit = list.find((n) => { const ws = n.toLowerCase().split(" ").filter((w) => w !== "and"); return ws.length === want.size && ws.every((w) => want.has(w)); });
  return hit || words.join(" ");
}
const RARITY_IDS = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, ultralegendary: 5, ultra: 5, infinity: 6 };
const rarityOfId = (id) => { const r = RARITY_IDS[String(id || "").toLowerCase()]; return r === undefined ? null : r; };
const GAME_ID = /^[A-Za-z0-9]+$/, VAR_ID = /^[A-Za-z0-9]+_\d{1,3}$/;
/* MARVEL SNAP's CollectionState.json (2026): ServerState.Cards is one entry per copy you own (its variant, upgrade level, finish, flare and border;
   Custom = your Custom Card, Favorite = the copy the game shows), CardDefStats has each card's boosters, AvatarInventory, TitleInventory,
   EmoteInventory and CardBacks are your cosmetics, Decks are your decks and CollectionScore is your Collection Level.
   Only the Cards list says what you own: an avatar or album entry can name a card or variant you don't have. */
function readStateFile(ss, fname) {
  const cards = new Set(), vars = new Set(), copies = {};
  for (const e of arr(ss.Cards)) {
    if (!e || typeof e !== "object" || typeof e.CardDefId !== "string" || !GAME_ID.test(e.CardDefId)) continue;
    const id = e.CardDefId, v = typeof e.ArtVariantDefId === "string" && VAR_ID.test(e.ArtVariantDefId) ? e.ArtVariantDefId : "";
    cards.add(id); if (v) vars.add(v);
    (copies[id] = copies[id] || []).push({ v, r: rarityOfId(e.RarityDefId), custom: e.Custom === true, fav: e.Favorite === true || e.IsFavorite === true, fin: String(e.SurfaceEffectDefId || e.FinishDefId || ""), fl: String(e.CardRevealEffectDefId || e.RevealEffectDefId || e.FlareDefId || ""), bd: String(e.BorderDefId || e.CardBorderDefId || "") });
  }
  // Custom Cards (the favourite one when there are several), favourite variants, upgrade levels and splits, per card
  const looks = {}, favs = {}, prog = {};
  const stats = obj(obj(ss.CardDefStats).Stats);
  for (const [id, list] of Object.entries(copies)) {
    const cus = list.filter((c) => c.custom).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0))[0];
    if (cus && (cus.v || cus.fin || cus.fl || cus.bd)) looks[id] = { v: cus.v, finish: effectName(cus.fin), flare: effectName(cus.fl, true), border: cus.bd };
    const fav = list.find((c) => c.fav && c.v); if (fav) favs[id] = fav.v;
    const pr = { b: null, base: null, vr: {}, splits: [], borders: [] }, st = obj(stats[id]);
    if (Number.isFinite(Number(st.Boosters)) && Number(st.Boosters) >= 0 && Number(st.Boosters) < 1e6) pr.b = Math.round(Number(st.Boosters));
    for (const c of list) {
      if (c.bd && rarityOfId(c.bd) === null && GAME_ID.test(c.bd) && !pr.borders.includes(c.bd)) pr.borders.push(c.bd);
      if (c.custom) continue;
      // A copy with a finish or flare came from an Infinity Split; the plain copies carry the card's and each variant's upgrade level
      if ((c.fin && !/^none$/i.test(c.fin)) || (c.fl && !/^none$/i.test(c.fl))) { pr.splits.push({ fin: effectName(c.fin), fl: effectName(c.fl, true), r: c.r }); continue; }
      if (c.r === null) continue;
      if (c.v) pr.vr[c.v] = Math.max(num(pr.vr[c.v]), c.r); else pr.base = Math.max(num(pr.base), c.r);
    }
    prog[id] = pr;
  }
  const cos = { cardback: new Set(), emote: new Set(), title: new Set() }, avatars = [];
  for (const b of arr(ss.CardBacks)) if (b && typeof b.CardBackDefId === "string" && GAME_ID.test(b.CardBackDefId.replace(/_/g, ""))) cos.cardback.add(b.CardBackDefId);
  for (const e of arr(obj(ss.EmoteInventory).OwnedCosmetics)) if (e && typeof e.DefId === "string" && GAME_ID.test(e.DefId)) cos.emote.add(e.DefId);
  for (const t of arr(obj(ss.TitleInventory).OwnedTitles)) if (t && typeof t.TitleDefId === "string" && GAME_ID.test(t.TitleDefId)) cos.title.add(t.TitleDefId);
  const seenAv = new Set();
  for (const a of arr(obj(ss.AvatarInventory).OwnedAvatars)) {
    const ca = obj(obj(a).CardArtAvatar), c = typeof ca.CardDefId === "string" && GAME_ID.test(ca.CardDefId) ? ca.CardDefId : "", v = typeof ca.ArtVariantDefId === "string" && VAR_ID.test(ca.ArtVariantDefId) ? ca.ArtVariantDefId : "";
    const key = v || c; if (!c || seenAv.has(key)) continue; seenAv.add(key); avatars.push({ card: c, v });
  }
  const decks = [];
  for (const d of arr(ss.Decks)) {
    if (!d || typeof d.Name !== "string" || !Array.isArray(d.Cards) || d.Cards.length < 6 || d.Cards.length > 12 || !d.Cards.every((c) => c && typeof c.CardDefId === "string")) continue;
    const back = String(obj(d.CardBack).CardBackDefId || d.CardBackDefId || ""); if (back) cos.cardback.add(back);
    decks.push({ name: d.Name.slice(0, 60), cards: d.Cards.map((c) => c.CardDefId), vars: d.Cards.map((c) => (typeof c.ArtVariantDefId === "string" ? c.ArtVariantDefId : "")), back });
  }
  const clRaw = Number(obj(ss.CollectionScore).Amount), cl = Number.isFinite(clRaw) && clRaw > 0 && clRaw < 200000 ? Math.round(clRaw) : null;
  return { cards: [...cards], vars: [...vars], decks, looks, favs, prog, cos: Object.fromEntries(Object.entries(cos).map(([k, v]) => [k, [...v].slice(0, 3000)])), avatars: avatars.slice(0, 3000), cl, state: true, any: cards.size > 0 };
}
// ClanState.json: your alliance, its members with this week's points, and the bounties on offer
const BOUNTY_TXT = { WinLocationWithHighPower: "Win locations with high power", WinLocationWith4Cards: "Win locations with 4 cards", WinMatchesWithCardInDeck: "Win matches with {c} in your deck", DiscardCards: "Discard cards", MoveFiveCards: "Move cards", Play1CostCards: "Play 1-Cost cards", WinMatchesWithRevealCardPairInDeck: "Win matches with {c} and {c2} in your deck" };
function bountyText(m) {
  const id = String(m.MissionDefId || "").replace(/^Bounty/, ""), P = obj(m.CustomParameters);
  const cn = (d) => { const c = d ? cardByDefId(d) : null; return c ? c.name : d ? prettyDef(d) : "a card"; };
  const t = BOUNTY_TXT[id] || prettyDef(id).replace(/\s+/g, " ").replace(/^(\w)(.*)$/, (s, a, b) => a + b.toLowerCase());
  return t.replace("{c}", cn(P.CardDefId)).replace("{c2}", cn(P.CardDefId2));
}
const isoMs = (s) => { const t = Date.parse(String(s || "")); return Number.isFinite(t) ? t : 0; };
// The week the alliance is in now: the period whose end (its Key, a date at the 19:00 UTC reset) is still ahead
function allyPeriod(list, now) {
  const ps = arr(list).map((p) => ({ end: isoMs(String(obj(p).Key || "") + "T19:00:00Z"), b: num(obj(p).BountyPoints), c: num(obj(p).CubePoints) })).filter((p) => p.end);
  const ahead = ps.filter((p) => p.end > now && p.end - now <= 8 * DAY).sort((a, b) => a.end - b.end);
  return ahead[0] || null;
}
function readClanFile(ss, j) {
  const st = obj(ss.State), id = obj(st.Identity), members = arr(ss.Members), log = obj(obj(j).PersonalLog).State ? obj(obj(j).PersonalLog) : obj(ss.PersonalLog); // your own log sits beside ServerState
  if (!members.length && !id.Name) return null;
  const now = Date.now(), time = Math.max(isoMs(st.TimeUpdated), ...members.map((m) => isoMs(obj(obj(m).PlayerInfo).TimeUpdated))) || now;
  const a = { name: String(id.Name || "").slice(0, 40), memberCount: num(st.MemberCount) > members.length ? num(st.MemberCount) : null, members: [], bounties: [] };
  for (const m of members) {
    const pi = obj(obj(m).PlayerInfo), per = allyPeriod(obj(obj(m).TimePeriodState).TimePeriodList, now);
    if (!pi.Name) continue;
    a.members.push({ name: String(pi.Name).slice(0, 30), role: String(obj(m).Role || "").slice(0, 12), points: per ? per.b + per.c : null, bounties: per ? per.b : null, cubes: per ? per.c : null, collectionLevel: num(pi.CollectionScore) || null });
  }
  const me = allyPeriod(obj(obj(log.State).TimePeriodState).TimePeriodList, now); if (me) a.myPoints = me.b + me.c;
  const next = isoMs(obj(log.State).NextRefreshTime); if (next > now && next - now < 8 * DAY) { const left = next - now; a.resetsIn = `${Math.floor(left / DAY)}d ${Math.floor((left % DAY) / 3600e3)}h ${Math.floor((left % 3600e3) / 60e3)}m`; }
  for (const m of arr(obj(obj(ss.BountyState)).AvailableMissions).slice(0, 30)) { const o = obj(m); if (!o.MissionDefId) continue; a.bounties.push({ text: bountyText(o), rarity: String(o.MissionDifficulty || "").slice(0, 12), goal: num(o.RequiredProgress) || null }); }
  return { alliance: a, time };
}
// The event files (HighStakesTablesManagerState.json, CustomGameManagerState.json…): which pass levels you've claimed in the live event
function readEventFile(ss) {
  const evs = [...(obj(ss.ActiveEvent).LimitedEventDefId ? [ss.ActiveEvent] : []), ...arr(ss.ActiveEvents)].map(obj).filter((e) => typeof e.LimitedEventDefId === "string" && /^[A-Za-z0-9_]+$/.test(e.LimitedEventDefId));
  if (!evs.length) return null;
  const lv = (l) => arr(l).map((s) => Number(String(s).match(/(\d+)$/) ? String(s).match(/(\d+)$/)[1] : NaN)).filter((n) => Number.isFinite(n) && n > 0 && n <= 200);
  const passes = new Map(arr(ss.BattlePasses).map(obj).map((b) => [String(b.BattlePassDefId || ""), b.PremiumUnlocked === true]));
  return { events: evs.map((e) => ({ defId: e.LimitedEventDefId, claimed: lv(e.ClaimedMilestoneRewards), premiumClaimed: lv(e.PremiumClaimedMilestoneRewards), premium: passes.get(String(e.BattlePassDefId || e.LimitedEventDefId)) === true, time: isoMs(e.TimeUpdated) || Date.now() })) };
}
// Claimed levels from an event file → that event's progress here. The event is matched by the game's own id (it's in the snap.fan link).
function applyEventFile(ev) {
  const e = events().find((x) => new RegExp("/" + ev.defId + "/?$", "i").test(String(x.link || ""))) || null; if (!e) return "";
  const pr = (S.eventProg = obj(S.eventProg))[e.id] = obj(obj(S.eventProg)[e.id]); const top = Math.max(0, ...ev.claimed, ...ev.premiumClaimed);
  let changed = false;
  if (top && num(pr.level) < top) { pr.level = top; changed = true; }
  for (const m of arr(pr.ms)) { const list = m.premium ? ev.premiumClaimed : ev.claimed; if (list.includes(num(m.level)) && !m.claimed) { m.claimed = true; changed = true; } }
  if (ev.premium && !pr.premium) { pr.premium = true; changed = true; }
  if (changed) pr.at = Math.max(num(pr.at), ev.time);
  return changed ? `${e.name}: level ${top}${ev.premium ? " · Premium" : ""}` : "";
}
// CharacterMasteryState.json: each card's Mastery level (the last level claimed, so the real one can be a step higher)
function readMasteryFile(ss) {
  const out = {}, data = obj(obj(ss.CharacterMasteryProgress).CharacterProgressData);
  for (const [id, d] of Object.entries(data)) { const lv = Math.round(Number(obj(d).LastClaimedLevel)); if (GAME_ID.test(id) && Number.isFinite(lv) && lv >= 1 && lv <= 30) out[id] = lv; }
  return Object.keys(out).length ? out : null;
}
function readCollectionFile(text, fileName) {
  let j; try { j = JSON.parse(String(text || "").replace(/^﻿/, "")); } catch { return null; }
  const fname = String(fileName || ""), isColl = !fname || /collection/i.test(fname), isProfile = /profile/i.test(fname);
  const ss = j && typeof j === "object" && j.ServerState && typeof j.ServerState === "object" ? j.ServerState : null;
  const mastery = ss ? readMasteryFile(ss) : null, clan = ss && !mastery ? readClanFile(ss, j) : null, evf = ss && !mastery && !clan ? readEventFile(ss) : null;
  const state = ss && Array.isArray(ss.Cards) ? readStateFile(ss, fname) : null;
  const cards = new Set(), vars = new Set(), decks = [], looks = {}, cos = { cardback: new Set(), avatar: new Set(), title: new Set(), emote: new Set() };
  const keys = {}, defs = {};
  const COS_KEY = { cardback: /^card ?backs?(def)?(id)?s?$/i, avatar: /^avatars?(def)?(id)?s?$/i, title: /^titles?(def)?(id)?s?$/i, emote: /^emotes?(def)?(id)?s?$/i };
  const cosKind = (k) => Object.keys(COS_KEY).find((c) => COS_KEY[c].test(String(k).replace(/_/g, ""))) || "";
  const PRIVATE = /account|token|auth|email|device|session|password|secret|steam|platform|ip$/i;
  const walk = (o, depth, parentKey) => {
    if (!o || typeof o !== "object" || depth > 40) return;
    if (Array.isArray(o)) { const ck = cosKind(parentKey); o.forEach((x) => { if (typeof x === "string" && ck) cos[ck].add(x); else walk(x, depth + 1, parentKey); }); return; }
    const id = typeof o.CardDefId === "string" ? o.CardDefId : "";
    if (id && /^[A-Za-z0-9]+$/.test(id)) {
      cards.add(id);
      const v = typeof o.ArtVariantDefId === "string" ? o.ArtVariantDefId : "";
      if (/^[A-Za-z0-9]+_\d{1,3}$/.test(v)) vars.add(v);
      // The look a card has on: its variant, finish, flare and border (a favourite or Custom Card)
      const fav = Object.entries(o).some(([k, x]) => /favou?rite|custom|selected|equipped/i.test(k) && x === true);
      const fin = String(o.SurfaceEffectDefId || o.FinishDefId || ""), fl = String(o.RevealEffectDefId || o.CardRevealEffectDefId || o.FlareDefId || ""), bd = String(o.BorderDefId || o.CardBorderDefId || "");
      if (fav && (v || fin || fl || bd)) looks[id] = { v, finish: fin, flare: fl, border: bd };
    }
    if (typeof o.Name === "string" && Array.isArray(o.Cards) && o.Cards.length >= 6 && o.Cards.length <= 12 && o.Cards.every((c) => c && typeof c.CardDefId === "string"))
      decks.push({ name: o.Name.slice(0, 60), cards: o.Cards.map((c) => c.CardDefId), vars: o.Cards.map((c) => (typeof c.ArtVariantDefId === "string" ? c.ArtVariantDefId : "")), back: typeof o.CardBackDefId === "string" ? o.CardBackDefId : "" });
    const ks = Object.keys(o), dictLike = ks.length > 3 && ks.filter((k) => /\d{3,}|^[0-9a-f-]{8,}$/i.test(k)).length >= ks.length / 2;
    for (const [k, v] of Object.entries(o)) {
      if (k === "$ref" || PRIVATE.test(k)) continue;
      if (!dictLike && /^[A-Za-z$][A-Za-z_$]{0,40}$/.test(k)) keys[k] = (keys[k] || 0) + 1;
      if (typeof v === "string" && /DefId$/i.test(k)) { (defs[k] = defs[k] || new Set()).size < 4 && defs[k].add(v.slice(0, 40)); const ck = cosKind(k.replace(/DefId$/i, "")); if (ck && !/deck/i.test(parentKey || "")) cos[ck].add(v); }
      if (v && typeof v === "object") walk(v, depth + 1, k);
    }
  };
  walk(j, 0, "");
  const summary = { file: fname.slice(0, 60), keys: Object.entries(keys).sort((a, b) => b[1] - a[1]).slice(0, 80).map(([k, n]) => `${k}×${n}`), defIds: Object.fromEntries(Object.entries(defs).slice(0, 40).map(([k, v]) => [k, [...v]])) };
  if (state) return { ...state, summary };
  if (mastery || clan || evf) return { cards: [], vars: [], decks: [], looks: {}, cos: {}, mastery, clan, events: evf ? evf.events : [], summary, any: true };
  // Only the collection file says what you own; the profile file says what you have on
  const cosOk = isColl || isProfile;
  return { cards: isColl ? [...cards] : [], vars: isColl ? [...vars] : [], decks: isColl ? decks : [], looks: isColl ? looks : {}, cos: cosOk ? Object.fromEntries(Object.entries(cos).map(([k, v]) => [k, [...v].slice(0, 2000)])) : {}, summary, any: cards.size > 0 || Object.values(cos).some((x) => x.size) };
}
// The game's card ID (CardDefId) → the card.
function cardByDefId(id) { id = String(id || ""); if (!id) return null; return allCards().find((c) => c.catId === id) || cardByCode(cardCode(id)) || cardByCode(id) || null; }
// "Abomination_03" → the catalog variant with that number.
function variantByDefId(def) {
  const m = String(def).match(/^([A-Za-z0-9]+)_(\d{1,3})$/); if (!m) return null;
  const c = cardByDefId(m[1]); if (!c) return null;
  const n = Number(m[2]);
  return allVariants().find((v) => v.card === c.key && v.cat && catOrder(v) === n) || null;
}
let collImp = null;
// One or more of the game's files (CollectionState.json, ProfileState.json and the rest from its States folder)
function applyCollectionFile(text, fileName) { return applyGameFiles([{ text, name: fileName || "CollectionState.json" }]); }
function applyGameFiles(files, opts = {}) {
  const rs = files.map((f) => ({ f, r: readCollectionFile(f.text, f.name) })).filter((x) => x.r);
  if (!rs.some((x) => x.r.any)) { if (!opts.quiet) toast("Those don't look like MARVEL SNAP's files. The one that matters is CollectionState.json."); return null; }
  let cardsNew = 0, varsNew = 0, unknown = 0, cosNew = 0, looksNew = 0, cards = 0, vars = 0, cosN = 0, favsNew = 0, titles = 0, avatarsN = 0;
  let progCards = 0, boostersSet = 0, levelsSet = 0, splitsNew = 0, bordersNew = 0, masteryN = 0, masterySet = 0, cl = null, clWas = num(S.me.colLevel); const notes = [];
  const have = new Set(S.decks.map((d) => keyOf(d.name) + "|" + [...arr(d.cards)].sort().join(","))), decks = [];
  for (const { r } of rs) {
    cards += r.cards.length; vars += r.vars.length;
    for (const id of r.cards) { const c = cardByDefId(id); if (!c) { unknown++; continue; } if (!S.owned[c.key]) { S.owned[c.key] = true; cardsNew++; } }
    // Cards that only exist inside a game mode are hidden until you own one: the lists are rebuilt now so their variants can be found
    if (cardsNew) save();
    for (const id of r.vars) { const v = variantByDefId(id); if (v && setVarOwned(v, true, "file")) varsNew++; }
    for (const [id, L] of Object.entries(r.looks)) { const c = cardByDefId(id); if (!c) continue; const v = L.v ? variantByDefId(L.v) : null; if (noteLook(c.key, { v: v ? (v.virtual ? "cat:" + v.cat : v.id) : "", vname: v ? v.name : "", finish: r.state ? L.finish : prettyDef(L.finish), flare: r.state ? L.flare : prettyDef(L.flare), border: borderLabel(L.border) }, "file")) looksNew++; }
    // The copy the game shows for a card is its favourite variant here too
    for (const [id, def] of Object.entries(obj(r.favs))) { const c = cardByDefId(id), v0 = variantByDefId(def); if (!c || !v0) continue; const v = v0.virtual ? materializeVar(v0.id) : S.variants.find((x) => x.id === v0.id); if (v && !v.favorite) { S.variants.forEach((x) => { if (x.card === c.key) x.favorite = false; }); v.favorite = true; favsNew++; } }
    for (const [kind, ids] of Object.entries(r.cos)) for (const id of ids) {
      // The game only stores a title's number; it's matched to a name when the daily data knows that number
      if (kind === "title" && /^Title\d+$/i.test(id)) { const nm = titleById(id); if (!nm) { titles++; continue; } cosN++; if (markCosmetic("title", nm, true, true)) cosNew++; continue; }
      cosN++;
      const e = kind === "emote" && typeof emoteById === "function" ? emoteById(id) : null;
      const b = kind === "cardback" ? cardBackById(id) : null;
      if (b) { if (!(backCos(b) || {}).owned) { setBack(b, "owned", true); cosNew++; } continue; }
      if (e) { if (!emoteOwned(e)) { emoteSet(e, "owned", true); cosNew++; } continue; }
      if (kind === "emote" && r.state) continue; // an emote the daily list doesn't know yet
      if (markCosmetic(kind, prettyDef(id), kind === "avatar" || kind === "title")) cosNew++;
    }
    for (const a of arr(r.avatars)) { avatarsN++; cosN++; if (markAvatarFile(a)) cosNew++; }
    // Boosters, upgrade levels, splits and borders straight from the game
    for (const [id, pr] of Object.entries(obj(r.prog))) { const c = cardByDefId(id); if (!c || c.unknown) continue; const got = applyProgFile(c.key, pr); if (got.any) progCards++; boostersSet += got.b; levelsSet += got.levels; splitsNew += got.splits; bordersNew += got.borders; }
    for (const [id, lv] of Object.entries(obj(r.mastery))) { const c = cardByDefId(id); if (!c || c.unknown) continue; masteryN++; const p = prog(c.key); if (num(p.ml) < lv) { p.ml = lv; masterySet++; } }
    if (r.cl && r.cl > num(cl)) cl = r.cl;
    if (r.clan && typeof applyShotAlliance === "function") { const x = {}; applyShotAlliance(x, r.clan.alliance, r.clan.time); if (x.detail) notes.push(`Alliance: ${x.detail}`); }
    for (const ev of arr(r.events)) { const t = applyEventFile(ev); if (t) notes.push(t); }
  }
  // Collection Level only goes up
  if (cl && cl > clWas) { S.me.colLevel = cl; S.colLow = null; }
  for (const { r } of rs) for (const d of r.decks) { const ks = d.cards.map((id) => (cardByDefId(id) || {}).key).filter(Boolean).sort().join(","); if (!have.has(keyOf(d.name) + "|" + ks)) decks.push(d); }
  if (cosN || titles) (S.seen = obj(S.seen)).cosfile = Date.now();
  collImp = { cards, cardsNew, vars, varsNew, unknown, decks, cos: cosN, cosNew, looksNew, favsNew, titles, avatars: avatarsN, progCards, boostersSet, levelsSet, splitsNew, bordersNew, masteryN, masterySet, cl: cl && cl > clWas ? cl : null, clSame: cl && cl <= clWas ? cl : null, notes, state: rs.some((x) => x.r.state), files: rs.map((x) => x.r.summary) };
  if (cards) S.collFileAt = Date.now();
  // quiet: a background sync (the PC folder) saves without opening the sheet; the caller says what was new
  if (opts.quiet) { save(); return collImp; }
  save(); collSyncNow(); render(); openSheet(collImpSheet); return collImp;
}
// A border's name from the border list ("CosmicBlack" → "Cosmic · Black"); the upgrade-level borders keep their name
const borderLabel = (id) => { id = String(id || ""); if (!id) return ""; const r = rarityOfId(id); if (r !== null) return UP_LEVELS[r]; const b = typeof BDL !== "undefined" && BDL && BDL.byId ? BDL.byId.get(id) : null; return b ? b.name || b.id : prettyDef(id); };
// An avatar from the game's files: named after the variant it shows ("Venom (Nicola Saviori)"), or the card for the base art
function markAvatarFile(a) {
  const c = cardByDefId(a.card); if (!c || c.unknown) return false;
  const v = a.v ? variantByDefId(a.v) : null, ref = a.v || a.card;
  const name = (v && v.name && keyOf(v.name) !== keyOf(c.name) ? `${c.name} (${v.name})` : c.name).slice(0, 60);
  let x = S.cosmetics.find((y) => y.kind === "avatar" && y.ref === ref) || S.cosmetics.find((y) => y.kind === "avatar" && !y.ref && keyOf(y.name) === keyOf(name));
  if (!x) { x = { id: uid(), kind: "avatar", name, ref }; S.cosmetics.push(x); }
  if (!x.ref) x.ref = ref;
  if (x.owned) return false; x.owned = true; return true;
}
// What the game's file says about one card's progress. Levels and boosters are the game's own numbers, so they replace what was noted
// by hand or read from screenshots; splits already logged keep their notes and only pick up a level.
function applyProgFile(k, pr) {
  const p = prog(k), got = { any: false, b: 0, levels: 0, splits: 0, borders: 0 };
  if (pr.b !== null && pr.b !== undefined && p.b !== pr.b) { p.b = pr.b; got.b = 1; got.any = true; }
  if (pr.base !== null && pr.base !== undefined && p.base !== pr.base) { p.base = pr.base; got.levels++; got.any = true; }
  for (const [def, r] of Object.entries(obj(pr.vr))) { const v0 = variantByDefId(def); if (!v0 || r === null) continue; const v = v0.virtual ? materializeVar(v0.id) : v0; if (v && p.vr[v.id] !== r) { p.vr[v.id] = r; got.levels++; got.any = true; } }
  const free = p.splits.slice();
  for (const sp of arr(pr.splits)) {
    const same = (a, b) => !a || !b || keyOf(a) === keyOf(b);
    let i = free.findIndex((x) => same(x.fin, sp.fin) && same(x.fl, sp.fl) && (x.fin || x.fl)); if (i < 0) i = free.findIndex((x) => !x.fin && !x.fl);
    let s = i >= 0 ? free.splice(i, 1)[0] : null;
    if (!s) { s = { id: uid(), fin: "", fl: "", r: null }; p.splits.push(s); got.splits++; got.any = true; }
    if (sp.fin && !s.fin) s.fin = sp.fin; if (sp.fl && !s.fl) s.fl = sp.fl;
    if (sp.r !== null && sp.r !== undefined && s.r !== sp.r) { s.r = sp.r; got.any = true; }
  }
  for (const id of arr(pr.borders)) { const name = borderLabel(id); if (name && !p.borders.some((b) => keyOf(b) === keyOf(name))) { p.borders.push(name); got.borders++; got.any = true; } }
  if (got.splits) syncSplitCount(k);
  return got;
}
function gameFilesSummary() { return JSON.stringify(arr(obj(collImp).files), null, 1).slice(0, 20000); }
function collImpSheet() {
  const r = collImp; if (!r) return "";
  return `${sheetHead("Collection file read", "From MARVEL SNAP on PC")}
    <div class="kpis">${`<div class="kpi"><b class="num">${fmt(r.cards)}</b><span>cards in the file${r.cardsNew ? ` · ${fmt(r.cardsNew)} newly ticked` : ""}</span></div><div class="kpi"><b class="num">${fmt(r.vars)}</b><span>variants${r.varsNew ? ` · ${fmt(r.varsNew)} newly ticked` : ""}</span></div>`}</div>
    ${r.unknown ? `<p class="muted small">${r.unknown} card${r.unknown === 1 ? "" : "s"} in the file aren't in SNAP Stat's card list yet. They'll be picked up after the next daily card update if you read the file again.</p>` : ""}
    <p class="muted small">Variants you ticked or unticked yourself weren't changed.</p>
    ${r.cl ? `<p class="small pos">Collection Level ${fmt(r.cl)}.</p>` : r.clSame ? `<p class="muted small">Collection Level ${fmt(r.clSame)} (no change).</p>` : ""}
    ${r.progCards || r.masteryN ? `<p class="small">${r.progCards ? `Boosters and upgrade levels for ${fmt(r.progCards)} card${r.progCards === 1 ? "" : "s"}${r.splitsNew ? ` · ${fmt(r.splitsNew)} split${r.splitsNew === 1 ? "" : "s"} added` : ""}${r.bordersNew ? ` · ${fmt(r.bordersNew)} border${r.bordersNew === 1 ? "" : "s"}` : ""}. ` : ""}${r.masteryN ? `Mastery levels for ${fmt(r.masteryN)} card${r.masteryN === 1 ? "" : "s"}${r.masterySet ? ` · ${fmt(r.masterySet)} went up` : ""}.` : ""}</p>` : ""}
    ${r.cos || r.looksNew || r.favsNew ? `<p class="small">${r.cos ? `${fmt(r.cos)} avatars, titles, card backs and emotes in the files${r.cosNew ? ` · ${fmt(r.cosNew)} newly ticked` : ""}. ` : ""}${r.looksNew ? `${fmt(r.looksNew)} Custom Card${r.looksNew === 1 ? "" : "s"} saved. ` : ""}${r.favsNew ? `${fmt(r.favsNew)} favourite variant${r.favsNew === 1 ? "" : "s"} set.` : ""}</p>` : `<p class="muted small">No avatars, card backs or Custom Cards found in ${arr(r.files).length > 1 ? "these files" : "this file"}. Choose CollectionState.json from the game's folder, or copy the summary below and send it to Claude to look at.</p>`}
    ${arr(r.notes).length ? `<p class="small">${arr(r.notes).map(esc).join("<br>")}</p>` : ""}
    ${r.titles ? `<p class="muted small">${fmt(r.titles)} title${r.titles === 1 ? " is" : "s are"} in the file too, but the game only stores their numbers, and the daily data doesn't know those numbers yet, so they can't be matched to names.</p>` : ""}
    <button class="btn sm ghost" data-a="gameFilesCopy">Copy what's in the files, for Claude</button><span class="muted small">Only the names of what's stored and the game's own IDs, never your account details.</span>
    ${r.decks.length ? `<h3>Decks in the file</h3><div class="list">${r.decks.map((d, i) => `<div class="li"><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${d.cards.map((id) => esc((cardByDefId(id) || { name: id }).name)).join(", ")}</div></div><button class="btn sm" data-a="collDeck" data-i="${i}">${d.added ? "Added" : "Add"}</button></div>`).join("")}</div>
      ${r.decks.length > 1 ? `<button class="btn block" data-a="collDeck" data-i="all">Add all ${r.decks.length} decks</button>` : ""}` : ""}
    <button class="btn snap block" data-a="close">Done</button>`;
}
function addCollDeck(d) {
  if (d.added) return false;
  const keys = d.cards.map((id) => (cardByDefId(id) || {}).key).filter(Boolean); if (keys.length < 6) return false;
  const nd = newDeck(d.name, keys, keys.length === 12 ? "active" : "draft");
  d.vars.forEach((def, i) => { const v0 = def && variantByDefId(def); const v = v0 && (v0.virtual ? materializeVar(v0.id) : v0); const k = (cardByDefId(d.cards[i]) || {}).key; if (v && k) nd.variants[k] = v.id; });
  if (d.back) { const b = cardBackById(d.back) || cardBacks().find((x) => lookKey(x.id) === lookKey(d.back)) || pickByName(cardBacks(), prettyDef(d.back), (x) => x.name); if (b) nd.back = b.id; }
  d.added = true; return true;
}
document.addEventListener("change", async (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.collfile) return;
  const fs = [...(t.files || [])].slice(0, 12); t.value = ""; if (!fs.length) return;
  if (fs.some((f) => f.size > 40e6)) { toast("One of those files is too big to be the game's."); return; }
  try { applyGameFiles(await Promise.all(fs.map(async (f) => ({ text: await f.text(), name: f.name })))); } catch { toast("Couldn't read those files."); }
});

/* ---------- Typing in these sheets ---------- */
document.addEventListener("input", (e) => {
  const t = e.target, d = t.dataset || {};
  if (d.dkb) { dkb[d.dkb] = t.value; dkb.lim = 60; refreshSheet(); }
  else if (d.dkbd) { dkbd[d.dkbd] = t.value; refreshSheet(); }
  else if (d.cbv) { cbv[d.cbv] = t.value; cbv.lim = 60; render(); }
  else if (d.dkc) { dkc[d.dkc] = t.value; dkc.lim = 90; if (dkc.q && dkc.f === "deck") dkc.f = "all"; refreshSheet(); }
});

Object.assign(A, {
  locOpen: (el) => { lo = el.dataset.name || ""; openSheet(locSheet); },
  dkBackOpen: () => { dkb = { q: "", own: cardBacks().some((b) => (backCos(b) || {}).owned), lim: 60 }; openSheet(dkBackSheet); },
  dkbOwn: (el) => { dkb.own = el.dataset.v === "1"; dkb.lim = 60; refreshSheet(); },
  dkbMore: () => { dkb.lim += 60; refreshSheet(); },
  dkBackPick: (el) => { const d = deckEdit(); if (!d) return; d.back = el.dataset.id || ""; save(); openDeck(deId); toast(d.back ? "Card back set" : "Card back removed"); },
  dkBorderOpen: () => { dkbd = { q: "" }; openSheet(dkBorderSheet); },
  dkBorderPick: (el) => { const d = deckEdit(); if (!d) return; d.coverBorder = el.dataset.v || ""; save(); const keep = $("#sheetBody").scrollTop; refreshSheet(); $("#sheetBody").scrollTop = keep; },
  dkBack: () => openDeck(deId),
  dkcOpen: () => { const d = deckEdit(); dkc = { step: "card", q: "", f: d && d.cards.length ? "deck" : "all", lim: 90, k: "", vf: "all" }; openSheet(dkCoverSheet); },
  dkcF: (el) => { dkc.f = el.dataset.v; dkc.lim = 90; refreshSheet(); },
  dkcMore: () => { dkc.lim += 90; refreshSheet(); },
  dkcCard: (el) => { dkc.k = el.dataset.k; dkc.step = "variant"; dkc.vf = "all"; refreshSheet(); $("#sheetBody").scrollTop = 0; },
  dkcStep: (el) => { dkc.step = el.dataset.v; refreshSheet(); },
  dkcVf: (el) => { dkc.vf = el.dataset.v; refreshSheet(); },
  dkcVar: (el) => { const d = deckEdit(); if (!d) return; d.cover = dkc.k; d.coverVar = el.dataset.id || "base"; save(); openDeck(deId); toast("Deck icon set"); },
  cbOwn: (el) => { const b = cardBackById(el.dataset.id); if (!b) return; const now = !(backCos(b) || {}).owned; setBack(b, "owned", now); if (now) { const c = backCos(b); if (c) c.wish = false; } render(); },
  cbWish: (el) => { const b = cardBackById(el.dataset.id); if (!b) return; setBack(b, "wish", !(backCos(b) || {}).wish); render(); },
  cbF: (el) => { cbv.f = el.dataset.v; cbv.lim = 60; render(); },
  cbMore: () => { cbv.lim += 60; render(); },
  gameFilesCopy: () => copyText(gameFilesSummary(), "Copied. Paste it in your chat with Claude."),
  collDeck: (el) => {
    if (!collImp) return;
    const list = el.dataset.i === "all" ? collImp.decks : [collImp.decks[num(el.dataset.i)]].filter(Boolean);
    let n = 0, few = 0; for (const d of list) { if (d.added) continue; if (addCollDeck(d)) n++; else few++; }
    save(); render(); refreshSheet(); toast(n ? `${n} deck${n === 1 ? "" : "s"} added${few ? ` (${few} had too few cards SNAP Stat knows)` : ""}` : few ? "SNAP Stat doesn't know enough of that deck's cards yet" : "Already added");
  },
});
