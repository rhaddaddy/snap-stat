/* ============ Collection ============ */
function vCards() {
  const seg = (v, l) => `<button data-a="cardsSeg" data-v="${v}" aria-pressed="${ui.cardsSeg === v}">${l}</button>`;
  const body = { cards: vCardGrid, variants: vVariants, albums: vAlbums, cosmetics: vCosmetics, wish: vWishlist }[ui.cardsSeg] || vCardGrid;
  return `<section class="sec"><h1>Collection</h1><div class="seg">${seg("cards", "Cards")}${seg("variants", "Variants")}${seg("albums", "Albums")}${seg("cosmetics", "Cosmetics")}${seg("wish", "Wishlist")}</div></section>${body()}`;
}
function cardMatches(c, q) {
  if (!q) return true; const ql = q.toLowerCase(); const qk = keyOf(q);
  if (c.key.includes(qk) || keyOf(c.name).includes(qk)) return true;
  if (typeof abilityHas === "function" ? abilityHas(c.ability, ql) : String(c.ability || "").toLowerCase().includes(ql)) return true;
  if (c.tags.some((t) => (TAGS[t] || "").toLowerCase().includes(ql))) return true;
  if (String(c.series || "").toLowerCase() === ql.replace(/^series\s*/, "")) return true;
  if (c.from && keyOf(c.from).includes(qk)) return true;
  return (variantSearchIndex().get(c.key) || "").includes(qk);
}
/* One searchable string per card: its variants' names, artists, rarities and sources */
let _vsiSig = "", _vsi = new Map();
function variantSearchIndex() {
  const all = allVariants();
  if (_vsiSig === _avSig) return _vsi;
  _vsi = new Map();
  for (const v of all) _vsi.set(v.card, (_vsi.get(v.card) || "") + "|" + keyOf(v.name) + "|" + keyOf(v.artist) + "|" + keyOf(v.rarity) + "|" + keyOf(v.source));
  _vsiSig = _avSig; return _vsi;
}
/* A grid tile with the card's name and a wishlist star underneath */
const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.8c0 5.6-7.6 10.2-7.6 10.2z"/></svg>`;
function starBtn(a, attrs, on, name) { return `<button class="star" data-a="${a}" ${attrs} aria-pressed="${on}" aria-label="${on ? "On" : "Add to"} wishlist: ${esc(name)}">${HEART}</button>`; }
function gridTile(face, name, star) { return `<div class="cwrap">${face}<div class="cname"><span class="t">${esc(name)}</span>${star || ""}</div></div>`; }
const showSoon = () => !!S.showSoon;
function vCardGrid() {
  const all = allCards().filter((c) => !c.upcoming); const ownedN = all.filter((c) => S.owned[c.key]).length;
  const pMin = ui.powMin === "" ? -Infinity : num(ui.powMin), pMax = ui.powMax === "" ? Infinity : num(ui.powMax);
  let list = ui.cardFilter === "custom" ? allCards().filter((c) => obj(S.looks)[c.key]) : allCards();
  list = list.filter((c) => cardMatches(c, ui.cardQ)
    && (["all", "custom"].includes(ui.cardFilter) || (ui.cardFilter === "unknown" && (c.unknownName || c.cost === "?")) || (ui.cardFilter === "owned" && S.owned[c.key]) || (ui.cardFilter === "missing" && !S.owned[c.key] && !c.upcoming) || (ui.cardFilter === "wish" && S.wishCards[c.key]) || (ui.cardFilter === "fav" && (S.favCards[c.key] || favVariant(c.key))) || (ui.cardFilter === "upcoming" && c.upcoming))
    && (ui.cardFilter === "upcoming" || ui.cardFilter === "custom" || ui.cardFilter === "wish" || !c.upcoming || showSoon())
    && (!ui.cardSeries || seriesOf(c) === ui.cardSeries)
    && (ui.cardCost === "any" || (ui.cardCost === "6" ? num(c.cost) >= 6 : String(c.cost) === ui.cardCost))
    && (c.power === "?" || (num(c.power) >= pMin && num(c.power) <= pMax)));
  const vcount = (k) => S.variants.filter((v) => v.card === k && v.owned).length;
  const sorters = { cost: (a, b) => (a.cost === "?" ? 99 : num(a.cost)) - (b.cost === "?" ? 99 : num(b.cost)) || a.name.localeCompare(b.name), power: (a, b) => num(b.power) - num(a.power) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), newest: (a, b) => String(b.release || "").localeCompare(String(a.release || "")) || a.name.localeCompare(b.name), variants: (a, b) => vcount(b.key) - vcount(a.key) || a.name.localeCompare(b.name) };
  list = [...list].sort(sorters[ui.cardSort] || sorters.cost);
  const f = (v, l) => `<button class="chip" data-a="cardFilter" data-v="${v}" aria-pressed="${ui.cardFilter === v}">${l}</button>`;
  return `<section class="sec">
    <div class="panel stack halftone" style="gap:6px"><div class="row between"><span class="eyebrow">Cards owned</span><span class="num" style="font-weight:800">${ownedN} / ${all.length} · ${donePct(ownedN, all.length)}%</span></div>${passBar(ownedN, all.length)}
      <p class="muted small">Stats change with balance patches: tap any card to edit it.</p><div class="row"><label class="btn sm snap">Sync from SnapVault<input type="file" accept=".json,application/json,text/plain" data-svquick="1" hidden></label><button class="btn sm ghost" data-a="svOpen">Preview an export first</button></div></div>
    ${ui.cardFilter === "custom" ? "" : seriesPanel()}
    ${missingBanner()}
    <input type="search" id="card-q" data-ui="cardQ" value="${esc(ui.cardQ)}" placeholder="Search name, ability, variant, artist, rarity" aria-label="Search cards">
    <div class="chips">${f("all", "All")}${f("owned", "Owned")}${f("missing", "Missing")}${f("wish", "Wishlist")}${f("fav", "Favorites")}${f("custom", "Custom")}${f("upcoming", "Coming soon")}${f("unknown", "Needs details")}</div>
    <div class="chips">${["any", "0", "1", "2", "3", "4", "5", "6"].map((v) => `<button class="chip" data-a="cardCost" data-v="${v}" aria-pressed="${ui.cardCost === v}">${v === "any" ? "Any cost" : v === "6" ? "6+" : v}</button>`).join("")}</div>
    <div class="grid3"><label class="f">Power from<input type="number" id="card-pmin" data-ui="powMin" value="${esc(ui.powMin)}" inputmode="numeric"></label><label class="f">Power to<input type="number" id="card-pmax" data-ui="powMax" value="${esc(ui.powMax)}" inputmode="numeric"></label>
      <label class="f">Sort<select id="card-sort" data-uisel="cardSort">${[["cost", "Cost"], ["power", "Power"], ["name", "Name"], ["newest", "Newest"], ["variants", "Variants owned"]].map(([v, l]) => `<option value="${v}" ${ui.cardSort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <p class="muted small">${(() => { const auto = S.variants.filter((v) => v.ownBy && !v.manual && v.owned).length; return `To tick the variants you own without doing it by hand, screenshot a card's variants screen in the game${typeof NATIVE !== "undefined" && NATIVE ? " (with automatic screenshots on, that's all it takes)" : " and share it to SNAP Stat"}, and the ones you have get ticked. You can still change any tick by hand, and the app won't change it back.${auto ? ` ${auto} so far came from screenshots.` : ""}`; })()}</p>
    <label class="check"><input type="checkbox" data-soonchk ${showSoon() ? "checked" : ""}> Show cards and variants that aren't out yet</label>
    <div class="row between"><label class="check"><input type="checkbox" data-uichk="quickOwn" ${ui.quickOwn ? "checked" : ""}> Quick mark: tap to switch owned / missing</label>${ui.cardFilter === "custom" ? `<button class="btn sm" data-a="go" data-to="custom">Your Custom Cards ›</button>` : `<button class="btn sm" data-a="cardAdd">${ICON.plus} Add card</button>`}</div>
    <div class="row between"><span class="muted small">${list.length} card${list.length === 1 ? "" : "s"}</span>${ui.cardSeries ? `<button class="chip" data-a="seriesClear" aria-pressed="true">${esc(ui.cardSeries)} ✕</button>` : ""}</div>
    ${list.length ? `<div class="cgrid">${list.slice(0, 800).map((c) => gridTile(cardFace(c, { a: c.custom ? "cdEdit" : ui.quickOwn ? "toggleOwn" : "cardOpen", cls: c.custom || S.owned[c.key] ? "own" : c.upcoming ? "" : "miss", extra: c.custom ? `data-id="${esc(c.key.slice(7))}"` : "", variant: favVariant(c.key), badges: c.upcoming ? `<span class="tag l pill gold" style="font-size:10px">Soon</span>` : "" }), c.name, c.custom ? "" : starBtn("wishCard", `data-k="${esc(c.key)}"`, !!S.wishCards[c.key], c.name))).join("")}</div>`
      : `<div class="empty"><strong>No cards match</strong><span>Clear the search or filters, or add a card that's missing from the list.</span></div>`}</section>`;
}
function cardSheet(k) {
  return () => {
    const today = localDate(Date.now());
    const c = card(k); const vs = allVariants().filter((v) => v.card === k && (showSoon() || v.owned || !varUpcoming(v, today))).sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || catOrder(a) - catOrder(b));
    const inDecks = S.decks.filter((d) => d.cards.includes(k));
    const a = cardAnalytics(allMatches()).find((r) => r.k === k);
    return `${sheetHead(esc(c.name), [esc(arr(c.tags).map((t) => TAGS[t] || t).join(" · ")), c.from ? "From " + esc(c.from) : "", c.upcoming ? "Releases " + esc(dateStr(c.release)) : ""].filter(Boolean).join(" · "))}
    <div class="row nowrap" style="align-items:flex-start;gap:12px"><div style="width:110px;flex:none">${cardFace(c, { a: "noop", cls: "own", variant: favVariant(k) })}</div>
      <div class="stack" style="flex:1"><label class="check"><input type="checkbox" data-cardchk="owned" data-k="${esc(k)}" ${S.owned[k] ? "checked" : ""}> Owned</label>
      <label class="check"><input type="checkbox" data-cardchk="wish" data-k="${esc(k)}" ${S.wishCards[k] ? "checked" : ""}> On wishlist</label>
      <label class="check"><input type="checkbox" data-cardchk="fav" data-k="${esc(k)}" ${S.favCards[k] ? "checked" : ""}> Favorite card</label>
      ${a ? `<p class="small muted">Played in ${a.played} tracked games · ${a.wr}% win rate · avg ${a.avg} power · best ${a.max}</p>` : ""}</div></div>
    ${c.unknownName || c.added ? `<label class="f">Card name<input type="text" id="cd-name2" value="${esc(c.unknownName ? "" : c.name)}" placeholder="${c.unknownName ? "Real name of this card" : ""}"></label>${c.code ? `<span class="muted small">Card ID in deck codes: ${esc(c.code)}</span>` : ""}` : ""}
    ${c.ai ? `<p class="muted small">Cost, power and ability were filled in by AI. Check them against the game.</p>` : ""}
    <label class="f">Ability<textarea id="cd-ab" rows="2">${esc(c.ability || "")}</textarea></label>
    <div class="grid2"><label class="f">Cost<input type="number" id="cd-cost" value="${esc(c.cost === "?" ? "" : c.cost)}"></label><label class="f">Power<input type="number" id="cd-power" value="${esc(c.power === "?" ? "" : c.power)}"></label>
      <label class="f">Series<input type="text" id="cd-series" value="${esc(c.series || "")}" placeholder="e.g. 5"></label><label class="f">Release date<input type="date" id="cd-rel" value="${esc(c.release || "")}"></label></div>
    <div class="row"><button class="btn sm" data-a="cardSaveEdit" data-k="${esc(k)}">Save card details</button>${S.cardEdits[k] ? `<button class="btn sm ghost" data-a="cardResetEdit" data-k="${esc(k)}">Reset to starter details</button>` : ""}${c.added ? `<button class="btn sm danger" data-a="cardDelete" data-k="${esc(k)}">Remove card</button>` : ""}</div>
    ${inDecks.length ? `<p class="small muted">In ${inDecks.length} deck${inDecks.length > 1 ? "s" : ""}: ${inDecks.map((d) => esc(d.name)).join(", ")}</p>` : ""}
    ${cardSheetExtras(k)}
    <div class="sec-h"><h3>Variants</h3><button class="btn sm" data-a="varNew" data-k="${esc(k)}">${ICON.plus} Add variant</button></div>
    ${vs.length ? `<p class="muted small num">${vs.filter((v) => v.owned).length} of ${vs.length} owned</p><div class="list">${vs.map(variantRow).join("")}</div>` : `<p class="muted small">No variants tracked for this card yet.</p>`}
    ${cardHistoryHtml(k)}`;
  };
}
/* Rarity as a small badge with a short name, like SnapVault: R blue, SR purple, SPOT gold, ULT red. */
const RAR_BADGE = { common: ["C", "c"], uncommon: ["UC", "uc"], rare: ["R", "r"], "super rare": ["SR", "sr"], epic: ["EP", "ep"], legendary: ["LEG", "leg"], ultra: ["ULTRA", "ul"], infinity: ["INF", "inf"],
  spotlight: ["SPOT", "spot"], ultimate: ["ULT", "ult"], amazing: ["AMZ", "amz"], sensational: ["SENS", "sens"], exquisite: ["EXQ", "exq"] };
function rarityIcon(r) {
  const b = RAR_BADGE[String(r || "").toLowerCase()]; if (!b) return "";
  return `<span class="rb rb-${b[1]}" title="${esc(r)}" aria-label="${esc(r)}">${b[0]}</span>`;
}
const OWNED_TICK = `<span class="vown" aria-label="Owned" title="Owned"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
/* A variant in the grid, kept bright whether you own it or not: a green tick when you do, a heart for your wishlist,
   then the card name, the variant's style and where it's from, the artist, and the rarity badge on the right. */
function varTile(v, o = {}) {
  const c = card(v.card), today = localDate(Date.now()), up = varUpcoming(v, today);
  const face = cardFace(c, { a: o.a || "varOpen", extra: o.extra || `data-id="${esc(v.id)}"`, variant: v, noSub: true, cls: "vt",
    badges: o.badges ?? `${v.owned ? OWNED_TICK : ""}${v.favorite ? `<span class="tag vfav" aria-label="Favorite">★</span>` : ""}${up ? `<span class="tag pill gold" style="font-size:10px">Soon</span>` : ""}` });
  const sameName = !v.name || (v.artist && keyOf(v.artist) === keyOf(v.name));
  // Inside one card's list the card name is already known, so the variant's own name leads.
  const title = o.inCard ? (sameName ? v.source || v.rarity || "Variant" : v.name) : c.name;
  const type = [o.inCard || sameName ? "" : v.name, o.inCard && sameName ? "" : v.source].filter(Boolean).join(" · ");
  const heart = o.noStar ? "" : starBtn("wishVar", `data-id="${esc(v.id)}"`, !!v.wish, c.name + " · " + (v.artist || v.name));
  const when = o.when && v.release ? `<span class="vs vdate">${esc(dateStr(v.release))}</span>` : "";
  return `<div class="cwrap">${face}<div class="vinfo"><div class="vmeta"><span class="t">${esc(title)}</span>${type ? `<span class="vs">${esc(type)}</span>` : ""}${v.artist ? `<span class="vs">${esc(v.artist)}</span>` : ""}${when}</div><div class="vside">${heart}${rarityIcon(v.rarity)}</div></div></div>`;
}
function variantRow(v) {
  return `<div class="li">${imgTag(variantArt(v), "vthumb")}<button class="grow" data-a="varOpen" data-id="${esc(v.id)}" style="background:none;border:0;text-align:left;padding:0;min-width:0"><div class="t">${v.favorite ? "★ " : ""}${esc(card(v.card).name)} · ${esc(v.name)}</div><div class="s">${rarityIcon(v.rarity)}${[v.artist && keyOf(v.artist) !== keyOf(v.name) && "by " + v.artist, v.rarity, v.source, v.release && (v.release > localDate(Date.now()) ? "coming " : "out ") + dateStr(v.release)].filter(Boolean).map(esc).join(" · ") || (v.owned ? "Owned" : "Missing")}</div></button>
    <label class="check small"><input type="checkbox" data-varchk="owned" data-id="${esc(v.id)}" ${v.owned ? "checked" : ""}> Own</label>
    <label class="check small"><input type="checkbox" data-varchk="wish" data-id="${esc(v.id)}" ${v.wish ? "checked" : ""}> Want</label></div>`;
}
/* Variants with a release date still to come, soonest first. */
function upcomingVariants() {
  const today = localDate(Date.now());
  return allVariants().filter((v) => !v.owned && v.release && v.release > today && !card(v.card).hidden).sort((a, b) => a.release.localeCompare(b.release) || card(a.card).name.localeCompare(card(b.card).name));
}
/* Variants in the game's files that haven't come out and have no date yet. */
function unreleasedVariants() {
  const today = localDate(Date.now());
  return allVariants().filter((v) => varUpcoming(v, today) && !(v.release && v.release > today) && !card(v.card).hidden).sort((a, b) => card(a.card).name.localeCompare(card(b.card).name));
}
function soonStrip() {
  const up = upcomingVariants(); if (!up.length) return "";
  return `<section class="sec"><div class="soonbox stack" style="gap:10px"><div class="sec-h"><h3 style="margin:0;font-family:var(--comic);letter-spacing:.03em">Coming soon</h3><button class="btn sm ghost" data-a="go" data-to="cards/upcoming">See all ${up.length}</button></div>
    <div class="vrow">${up.slice(0, 12).map((v) => varTile(v, { when: true })).join("")}</div></div></section>`;
}
/* Collection › Coming soon: every upcoming variant by release date, with where it comes from. */
function vUpcomingVariants() {
  const up = upcomingVariants(), later = unreleasedVariants(), lim = ui.unrelLim || 60;
  const laterHtml = later.length ? `<section class="sec"><details class="panel" ${ui.unrelOpen ? "open" : ""} data-unrel="1"><summary><b>Not out yet, no date</b> <span class="muted small">${later.length} found in the game's files</span></summary>
    ${ui.unrelOpen ? `<div class="cgrid" style="margin-top:10px">${later.slice(0, lim).map((v) => varTile(v)).join("")}</div>${later.length > lim ? `<button class="btn block" data-a="unrelMore">Show more (${later.length - lim} left)</button>` : ""}` : ""}</details></section>` : "";
  if (!up.length) return `<section class="sec"><div class="empty"><strong>Nothing dated right now</strong><span>New variants show up here once they have a release date, with where they come from.</span></div></section>${laterHtml}`;
  const groups = []; for (const v of up) { const k = v.release || ""; const g = groups.find((x) => x.k === k); if (g) g.vs.push(v); else groups.push({ k, vs: [v] }); }
  const day = (d) => { if (!d) return "Date not announced"; const t = new Date(d + "T12:00"); return t.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }); };
  return `<section class="sec"><p class="muted small num">${up.length} variant${up.length === 1 ? "" : "s"} with a release date. Dates and where they come from are from Marvel Snap Zone and snap.fan, so they can change.</p></section>
    ${groups.map((g) => `<section class="sec"><div class="sec-h"><h2>${esc(day(g.k))}</h2><span class="muted small">${g.vs.length}</span></div><div class="cgrid">${g.vs.map((v) => varTile(v)).join("")}</div></section>`).join("")}${laterHtml}`;
}
function vVariants() {
  const _cc = new Map(), cc = (k) => { let c = _cc.get(k); if (!c) { c = card(k); _cc.set(k, c); } return c; };
  const today = localDate(Date.now());
  const q = ui.varQ.toLowerCase(), qk = keyOf(ui.varQ);
  const all = allVariants();
  const rarities = [...new Set(all.map((v) => v.rarity).filter(Boolean))].sort((a, b) => rarityRank(a) - rarityRank(b) || a.localeCompare(b));
  const sources = [...new Set(all.map((v) => v.source).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const artists = [...new Set(all.map((v) => v.artist).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  let list = all.filter((v) => ui.varFilter === "upcoming" || ui.varFilter === "wish" || showSoon() || v.owned || !varUpcoming(v, today)).filter((v) => {
    const c = cc(v.card);
    const hit = !q || [v.name, v.artist, v.rarity, v.source, c.name].some((s) => keyOf(s).includes(qk)) || String(c.ability || "").toLowerCase().includes(q);
    const up = varUpcoming(v, today);
    const st = ui.varFilter === "all" || (ui.varFilter === "owned" && v.owned) || (ui.varFilter === "missing" && !v.owned && !up) || (ui.varFilter === "wish" && v.wish) || (ui.varFilter === "fav" && v.favorite) || (ui.varFilter === "upcoming" && up);
    return hit && st && (!ui.varRarity || v.rarity === ui.varRarity) && (!ui.varArtist || v.artist === ui.varArtist) && (!ui.varSource || v.source === ui.varSource) && (!ui.varCost || ui.varCost === "any" || (ui.varCost === "6" ? num(c.cost) >= 6 : String(c.cost) === ui.varCost));
  });
  const cn = (v) => cc(v.card).name;
  const sorters = { card: (a, b) => cn(a).localeCompare(cn(b)) || catOrder(a) - catOrder(b) || a.name.localeCompare(b.name), artist: (a, b) => String(a.artist || "~").localeCompare(String(b.artist || "~")) || cn(a).localeCompare(cn(b)), rarity: (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || String(a.rarity || "~").localeCompare(String(b.rarity || "~")) || cn(a).localeCompare(cn(b)),
    name: (a, b) => String(a.name || "~").localeCompare(String(b.name || "~")) || cn(a).localeCompare(cn(b)), source: (a, b) => String(a.source || "~").localeCompare(String(b.source || "~")) || cn(a).localeCompare(cn(b)),
    newest: (a, b) => String(b.release || "").localeCompare(String(a.release || "")), oldest: (a, b) => String(a.release || "9").localeCompare(String(b.release || "9")), cost: (a, b) => num(cc(a.card).cost) - num(cc(b.card).cost) || cn(a).localeCompare(cn(b)), power: (a, b) => num(cc(b.card).power) - num(cc(a.card).power), owned: (a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || cn(a).localeCompare(cn(b)) };
  list = list.sort(sorters[ui.varSort] || sorters.card);
  const f = (v, l) => `<button class="chip" data-a="varFilter" data-v="${v}" aria-pressed="${ui.varFilter === v}">${l}</button>`;
  const own = all.filter((v) => v.owned).length, lim = ui.varLimit || 200, soon = all.filter((v) => !v.owned && varUpcoming(v, today)).length;
  return `${ui.varFilter === "upcoming" ? "" : soonStrip()}<section class="sec"><div class="sec-h"><h2>Variants</h2><span class="muted small num">${own} owned · ${all.length - own - soon} missing${upcomingVariants().length ? ` · ${upcomingVariants().length} coming` : ""}</span></div>
    <input type="search" id="var-q" data-ui="varQ" value="${esc(ui.varQ)}" placeholder="Search card, variant, artist, rarity, source, ability" aria-label="Search variants">
    <div class="chips">${f("all", "All")}${f("owned", "Owned")}${f("missing", "Missing")}${f("wish", "Wishlist")}${f("fav", "Favorites")}${f("upcoming", "Coming soon")}</div>
    <div class="chips">${["any", "0", "1", "2", "3", "4", "5", "6"].map((v) => `<button class="chip" data-a="varCost" data-v="${v}" aria-pressed="${(ui.varCost || "any") === v}">${v === "any" ? "Any cost" : v === "6" ? "6+" : v}</button>`).join("")}</div>
    <div class="grid2"><label class="f">Rarity<select id="var-rar" data-uisel="varRarity"><option value="">Any</option>${rarities.map((r) => `<option ${ui.varRarity === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
      <label class="f">Where it's from<select id="var-src" data-uisel="varSource"><option value="">Anywhere</option>${sources.map((r) => `<option ${ui.varSource === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
      <label class="f">Artist<select id="var-art" data-uisel="varArtist"><option value="">Any</option>${artists.map((r) => `<option ${ui.varArtist === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
      <label class="f">Sort<select id="var-sort" data-uisel="varSort">${[["card", "Card A–Z"], ["name", "Variant name"], ["artist", "Artist"], ["rarity", "Rarity"], ["source", "Where it's from"], ["newest", "Newest"], ["oldest", "Oldest"], ["cost", "Cost"], ["power", "Power"], ["owned", "Owned first"]].map(([v, l]) => `<option value="${v}" ${ui.varSort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <p class="muted small">${(() => { const auto = all.filter((v) => v.ownBy && !v.manual).length; return `To tick the variants you own without doing it by hand, screenshot a card's variants screen in the game${typeof NATIVE !== "undefined" && NATIVE ? " (with automatic screenshots on, that's all it takes)" : " and share it to SNAP Stat"}, and the ones you have get ticked. You can still change any tick by hand, and the app won't change it back.${auto ? ` ${auto} so far came from screenshots.` : ""}`; })()}</p>
    <label class="check"><input type="checkbox" data-soonchk ${showSoon() ? "checked" : ""}> Show cards and variants that aren't out yet</label>
    <div class="row between"><label class="check"><input type="checkbox" data-uichk="varQuick" ${ui.varQuick ? "checked" : ""}> Quick mark: tap to switch owned / missing</label><button class="btn sm snap" data-a="varNew" data-k="">${ICON.plus} Add variant</button></div>
    <div class="row between"><span class="muted small">${list.length} variant${list.length === 1 ? "" : "s"}</span>${CAT ? `<span class="muted small">Art and variant list from Marvel Snap Zone${CAT.updated ? ", updated " + esc(dateStr(CAT.updated.slice(0, 10))) : ""}</span>` : ""}</div>
    ${list.length ? `<div class="cgrid">${list.slice(0, lim).map((v) => varTile(v, { a: ui.varQuick ? "varTick" : "varOpen" })).join("")}</div>`
      : `<div class="empty"><strong>No variants here yet</strong><span>${showArt() && !CAT ? "The full variant list loads once the card data file is in your app's GitHub repository. " : ""}Add the variants you own and the ones you're hunting for, with artist and rarity so you can sort and filter them.</span></div>`}
    ${list.length > lim ? `<div class="row" style="justify-content:center"><button class="btn" data-a="varMore">Show more (${list.length - lim} left)</button></div>` : ""}</section>`;
}
let ve = null;
/* "On sale now" note for a variant that's in a current bundle or event shop */
function variantOnSale(v) {
  if (!v || !v.cat) return "";
  const os = autoOffers().filter((o) => o.cat === v.cat); if (!os.length) return "";
  return `<p class="note">On sale now: ${os.map((o) => `${esc(o.title || o.shop)} · ${esc(offerPrice(o))}${o.expires ? " · until " + esc(dateStr(o.expires)) : ""}`).join("; ")}</p>`;
}
function veUpsert() {
  if (!String(ve.name || "").trim()) { toast("Name the variant"); return false; }
  if (ve.cat) { const ex = S.variants.find((v) => v.cat === ve.cat && v.id !== ve.id); if (ex) ve.id = ex.id; }
  const prev = S.variants.find((v) => v.id === ve.id);
  const hand = prev ? !!prev.owned !== !!ve.owned || prev.manual : !!ve.owned;
  const body = { id: ve.id, card: ve.card, ...(hand ? { manual: true } : prev && prev.ownBy ? { ownBy: prev.ownBy, ownAt: prev.ownAt } : {}), name: ve.name.trim(), artist: String(ve.artist || "").trim(), rarity: String(ve.rarity || "").trim(), source: String(ve.source || "").trim(), release: ve.release || "", owned: !!ve.owned, wish: !!ve.wish, favorite: !!ve.favorite, ...(ve.cat ? { cat: ve.cat } : {}) };
  const cv = ve.cat && _catVars.get(ve.cat);
  if (cv) body.auto = body.name === cv.name && body.artist === cv.artist && body.rarity === cv.rarity && body.source === cv.source;
  if (body.favorite) S.variants.forEach((v) => { if (v.card === body.card && v.id !== body.id) v.favorite = false; });
  const i = S.variants.findIndex((v) => v.id === body.id); if (i >= 0) S.variants[i] = body; else S.variants.push(body);
  save(); return true;
}
function variantSheet() {
  const today = localDate(Date.now());
  const adding = ve.isNew && !ve.fromCat, art = variantArt(ve);
  return `${sheetHead(adding ? "Add variant" : "Variant", adding ? "" : esc(card(ve.card).name))}
    ${art ? `<div class="vprev">${imgTag(art, "vpimg")}</div>` : ""}
    <label class="f">Card<select id="ve-card" data-ve="card" ${ve.cat ? "disabled" : ""}>${allCards().map((c) => `<option value="${esc(c.key)}" ${ve.card === c.key ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
    <div class="grid2"><label class="f">Variant name<input type="text" id="ve-name" data-ve="name" value="${esc(ve.name)}" placeholder="Style or set" data-autofocus></label><label class="f">Artist<input type="text" id="ve-artist" data-ve="artist" value="${esc(ve.artist)}" list="ve-artists"></label></div>
    <datalist id="ve-artists">${[...new Set(S.variants.map((v) => v.artist).filter(Boolean))].map((a) => `<option value="${esc(a)}">`).join("")}</datalist>
    <div class="grid2"><label class="f">Rarity<input type="text" id="ve-rar" data-ve="rarity" value="${esc(ve.rarity)}" list="ve-rars"></label><label class="f">Where it's from<input type="text" id="ve-src" data-ve="source" list="ve-srcs" placeholder="Bundle, Season Pass, Spotlight…" value="${esc(ve.source)}"></label></div>
    <datalist id="ve-rars">${RARITIES.map((r) => `<option value="${r}">`).join("")}</datalist><datalist id="ve-srcs">${VAR_SOURCES.map((r) => `<option value="${r}">`).join("")}</datalist>
    ${variantOnSale(ve)}
    ${(() => { const cur = S.variants.find((v) => v.id === ve.id); return cur && cur.ownBy && !cur.manual ? `<p class="muted small">Marked ${cur.owned ? "owned" : "not owned"} automatically ${esc(OWN_BY[cur.ownBy] || "")}${cur.ownAt ? " on " + esc(dateStr(localDate(cur.ownAt))) : ""}. Change the tick if that's wrong; the app won't change it again.</p>` : ""; })()}
    <label class="f">Release date${ve.release && ve.release > today ? " (coming soon)" : ""}<input type="date" id="ve-rel" data-ve="release" value="${esc(ve.release)}"></label>
    <div class="row"><label class="check"><input type="checkbox" data-vechk="owned" ${ve.owned ? "checked" : ""}> I own it</label><label class="check"><input type="checkbox" data-vechk="wish" ${ve.wish ? "checked" : ""}> Wishlist</label><label class="check"><input type="checkbox" data-vechk="favorite" ${ve.favorite ? "checked" : ""}> Favorite for this card</label></div>
    <p class="muted small">Your favorite variant shows on your decks, in deck codes you copy, and when you share a deck.</p>
    <div class="row"><button class="btn snap" data-a="veSave">${adding ? "Add variant" : "Save"}</button>${adding ? "" : `<button class="btn" data-a="veAvatar">Use as profile picture</button><button class="btn" data-a="veBanner">Use as banner</button>`}${ve.isNew ? "" : `<button class="btn danger" data-a="veDelete">${ve.confirmDel ? "Tap again to " + (ve.cat ? "reset" : "delete") : ve.cat ? "Reset" : "Delete"}</button>`}</div>
    ${ve.cat && !ve.isNew ? `<p class="muted small">Reset clears your changes and marks it as not owned. It stays in the variant list.</p>` : ""}`;
}
function vCosmetics() {
  const kind = ui.cosKind || "cardback";
  const inCat = kind === "title" && titleCatalog().length ? new Set(titleCatalog().map(keyOf)) : kind === "emote" && emoteCatalog().length ? new Set(emoteCatalog().map((e) => keyOf(e.name))) : null;
  const list = S.cosmetics.filter((c) => c.kind === kind && !(inCat && (inCat.has(keyOf(c.name)) || (kind === "emote" && c.ref && emoteById(c.ref)))));
  const plural = { cardback: "Card backs", avatar: "Avatars", title: "Titles", emote: "Emotes" };
  return `<section class="sec"><div class="chips">${Object.entries(plural).map(([k, l]) => `<button class="chip" data-a="cosKind" data-v="${k}" aria-pressed="${kind === k}">${l} <span class="muted num">${S.cosmetics.filter((c) => c.kind === k && c.owned).length}</span></button>`).join("")}</div>
    ${kind === "avatar" ? `<p class="muted small">Avatars are the profile pictures you set in the game.</p>` : ""}
    ${kind === "cardback" && cardBacks().length ? `${cardBackGallery()}${list.some((c) => !c.ref) ? `<h3>Others you added</h3>` : ""}` : ""}
    ${inCat ? `${kind === "emote" ? emoteGallery() : titleGallery()}${list.length ? `<h3>Others you added</h3>` : ""}` : ""}
    ${(kind === "cardback" && cardBacks().length ? list.filter((c) => !c.ref).length : list.length) ? `<div class="list">${list.filter((c) => !(kind === "cardback" && c.ref && cardBacks().length)).map((c) => `<div class="li"><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.source || (c.owned ? "Owned" : "Missing"))}</div></div>
      <label class="check small"><input type="checkbox" data-coschk="owned" data-id="${esc(c.id)}" ${c.owned ? "checked" : ""}> Own</label><label class="check small"><input type="checkbox" data-coschk="wish" data-id="${esc(c.id)}" ${c.wish ? "checked" : ""}> Want</label>
      <button class="x" data-a="cosDel" data-id="${esc(c.id)}" aria-label="Remove">${ICON.x}</button></div>`).join("")}</div>`
      : (kind === "cardback" && cardBacks().length) || inCat ? "" : `<div class="empty"><strong>No ${plural[kind].toLowerCase()} tracked</strong><span>Add the ones you own and want, or tick them off in a season or event.</span></div>`}
    <div class="panel stack"><h3>Add ${COS[kind].toLowerCase()}</h3><div class="grid2"><label class="f">Name<input type="text" id="nc-name"></label><label class="f">Season or source<input type="text" id="nc-src" placeholder="Optional"></label></div>
      <label class="check"><input type="checkbox" id="nc-owned"> I own it</label><button class="btn snap" data-a="cosAdd" data-v="${kind}">Add</button></div></section>`;
}
function vWishlist() {
  const items = wishItems(); const alerts = wishAlerts();
  return `<section class="sec"><div class="sec-h"><h2>Wishlist</h2><button class="btn sm ghost" data-a="go" data-to="shops">Shops</button></div>
    <p class="muted small">Star cards, variants and cosmetics you want. When an offer you add in Shops matches, you'll see what it costs and how much more you need.</p>
    ${wishTotalHtml()}
    ${items.length ? `<div class="list">${items.map((w) => { const hit = alerts.filter((a) => a.w.ref === w.ref); return hit.length ? hit.map(alertRow).join("") : `<div class="alert"><span class="dot" style="background:var(--line)"></span><div class="grow"><div style="font-weight:600">${esc(w.name)}</div><div class="muted small">${esc(w.kind)} · not in your shops right now</div></div></div>`; }).join("")}</div>`
      : `<div class="empty"><strong>Your wishlist is empty</strong><span>Tap the ♡ under any card or variant in Collection.</span></div>`}</section>`;
}

document.addEventListener("toggle", (e) => { if (e.target && e.target.dataset && e.target.dataset.unrel) { if (ui.unrelOpen !== e.target.open) { ui.unrelOpen = e.target.open; render(); } } }, true);
