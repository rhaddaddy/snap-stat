/* ============ Custom Cards, avatars, titles, card backs and emotes, from your screenshots and matches ============
   - Your Custom Cards: the variant, border, finish and flare you use on each card, from its screen in the game and
     from what you play in matches. Playing a variant means you own it, so it's ticked too.
   - Your opponents: their avatar, title, card back, the emotes they send and their Custom Cards, kept with each match.
   - Your decks: the card back and avatar you had on in each match are kept with the deck you played, and they help
     tell which deck it was when the cards seen don't. */

/* ---------- Matching names the AI read to the game's lists ---------- */
const LOOK_NOISE = /\b(card ?backs?|avatars?|titles?|emotes?|variants?|borders?|finish|flare|the|new)\b/gi;
const lookKey = (s) => keyOf(String(s || "").replace(LOOK_NOISE, " "));
function pickByName(list, name, nameOf) {
  const k = lookKey(name); if (!k || k.length < 3) return null;
  let hit = list.filter((x) => lookKey(nameOf(x)) === k);
  if (!hit.length && k.length > 5) hit = list.filter((x) => { const n = lookKey(nameOf(x)); return n.length > 4 && (n.includes(k) || k.includes(n)); });
  if (hit.length > 1) hit.sort((a, b) => Math.abs(lookKey(nameOf(a)).length - k.length) - Math.abs(lookKey(nameOf(b)).length - k.length));
  return hit[0] || null;
}
// Ticks a cosmetic you have. [create] adds one the game's lists don't know (only from your own cosmetics screens).
// [exact]: only a name that matches one item exactly (a match picture only shows "the character on it", and six card
// backs are called "SNAP"), so a loose guess never ticks something you don't have
function pickExact(list, name, nameOf) { const k = lookKey(name); if (!k || k.length < 3) return null; const hit = list.filter((x) => lookKey(nameOf(x)) === k); return hit.length === 1 ? hit[0] : null; }
function markCosmetic(kind, name, create, exact) {
  name = String(name || "").trim().slice(0, 60); if (!name || !COS[kind]) return false;
  const pick = exact ? pickExact : pickByName;
  if (kind === "cardback" && typeof cardBacks === "function") {
    const b = pick(cardBacks(), name, (x) => x.name) || cardBacks().find((x) => lookKey(x.id) === lookKey(name));
    if (exact && !b) return false;
    if (b) { const c = backCos(b); if (c && c.owned) return false; setBack(b, "owned", true); return true; }
  }
  if (kind === "emote" && typeof emoteCatalog === "function") {
    const e = pick(emoteCatalog(), name, (x) => x.name);
    if (exact && !e) return false;
    if (e) { let c = emoteCos(e); if (!c) { c = { id: uid(), kind: "emote", name: e.name, source: "", owned: false, wish: false, ref: e.id }; S.cosmetics.push(c); } if (c.owned) return false; c.owned = true; return true; }
  }
  if (kind === "title" && typeof titleCatalog === "function") { const t = pick(titleCatalog(), name, (x) => x); if (t) { name = t; create = true; } else if (!create) return false; }
  let c = exact ? (() => { const l = S.cosmetics.filter((x) => x.kind === kind && keyOf(x.name) === keyOf(name)); return l.length === 1 ? l[0] : null; })() : cosFind(kind, name);
  if (!c) { if (!create) return false; c = { id: uid(), kind, name, source: "", owned: false, wish: false }; S.cosmetics.push(c); }
  if (c.owned) return false; c.owned = true; return true;
}
// "ZombieVenom_01" → "Zombie Venom 01"
const prettyDef = (id) => String(id || "").replace(/^(CardBack|Avatar|Title|Emote|Border)_?/i, "").replace(/_/g, " ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/\s+/g, " ").trim();

/* ---------- Your Custom Cards ---------- */
const LOOK_F = ["vname", "border", "finish", "flare"];
const lookWord = (s) => { const t = String(s || "").trim().slice(0, 40); return /^(none|no|n\/a|null|unknown|standard|default|base)$/i.test(t) ? "" : t; };
function noteLook(k, look, src) {
  const c = card(k); if (!c || c.unknown || c.custom) return false;
  const L = (S.looks = obj(S.looks)), old = obj(L[k]);
  const n = { v: look.v || "", vname: lookWord(look.vname), border: lookWord(look.border), finish: lookWord(look.finish), flare: lookWord(look.flare) };
  if (!n.v && !LOOK_F.some((f) => n[f])) return false;
  // The same variant keeps what was read before and isn't shown now; a different one starts fresh (you changed it)
  const same = (!n.v || !old.v || n.v === old.v) && (!n.vname || !old.vname || keyOf(n.vname) === keyOf(old.vname));
  if (src === "match" && (old.src === "card" || old.src === "you" || old.src === "file") && (old.v || LOOK_F.some((f) => old[f]))) {
    const fill = { v: old.v || n.v || "", ...Object.fromEntries(LOOK_F.map((f) => [f, old[f] || (same ? n[f] : "") || ""])) };
    const ch = ["v", ...LOOK_F].some((f) => (fill[f] || "") !== (old[f] || "")); if (ch) L[k] = { ...old, ...fill }; return ch;
  }
  const out = same ? { v: n.v || old.v || "", ...Object.fromEntries(LOOK_F.map((f) => [f, n[f] || old[f] || ""])) } : n;
  const changed = ["v", ...LOOK_F].some((f) => (out[f] || "") !== (old[f] || ""));
  L[k] = { ...out, at: Date.now(), src: src || old.src || "" };
  return changed;
}
function lookText(L) { L = obj(L); const v = L.v ? variantAny(L.v) : null; return [v ? `${v.name || "variant"}${byArtist(v)}` : L.vname ? `${L.vname} variant` : "", L.border ? `${L.border} border` : "", L.finish ? `${L.finish} finish` : "", L.flare ? `${L.flare} flare` : ""].filter(Boolean).join(" · "); }
const LOOK_SRC = { card: "from its screen in the game", match: "from one of your matches", file: "from your PC collection file", reward: "from a reward screen" };
function myLookHtml(k) {
  const L = obj(obj(S.looks)[k]); const t = lookText(L); if (!t) return "";
  return `<div class="panel stack small" style="gap:4px"><div class="row between"><b>Your Custom Card in the game</b><button class="btn sm ghost" data-a="lookClear" data-k="${esc(k)}">Clear</button></div><span>${esc(t)}</span><span class="muted">${esc(LOOK_SRC[L.src] || "")}${L.at ? ` · ${esc(agoTxt(L.at))}` : ""}. Screenshot the card in the game after you change it.</span></div>`;
}
Object.assign(A, { lookClear: (el) => { delete obj(S.looks)[el.dataset.k]; save(); refreshSheet(); toast("Cleared"); } });

/* ---------- What a match picture shows about you and your opponent ---------- */
const NO_COLLECTION_MODES = /draft|sealed/i; // modes where you play cards you don't own
function whoOf(o) { o = obj(o); const out = {}; for (const f of ["avatar", "title", "cardback"]) { const v = lookWord(String(o[f] || "").replace(f === "cardback" ? /\s*card ?back$/i : f === "avatar" ? /\s*avatar$/i : /\s*title$/i, "")); if (v) out[f] = v.slice(0, 50); } const em = arr(o.emotes).map((e) => lookWord(e)).filter(Boolean).slice(0, 6); if (em.length) out.emotes = em; return out; }
function mergeWho(...list) { const out = {}; for (const w of list.map(whoOf)) { for (const f of ["avatar", "title", "cardback"]) if (w[f] && !out[f]) out[f] = w[f]; if (w.emotes) out.emotes = [...new Set([...arr(out.emotes), ...w.emotes])].slice(0, 8); } return out; }
// Cards with a look from the end screen ({card, variant, border, finish, flare}) or a turn picture ({k, v, b, fi, fl})
function looksOf(list) {
  const out = {};
  for (const x of arr(list)) {
    const o = obj(x), c = o.k ? card(o.k) : fuzzyCard(o.card); if (!c || c.unknown) continue;
    const L = { vname: lookWord(o.v || o.variant), border: lookWord(o.b || o.border), finish: lookWord(o.fi || o.finish), flare: lookWord(o.fl || o.flare) };
    if (!LOOK_F.some((f) => L[f])) continue;
    const old = obj(out[c.key]); out[c.key] = Object.fromEntries(LOOK_F.map((f) => [f, old[f] || L[f]]));
  }
  return out;
}
function applyMatchLooks(m, mm) {
  mm = obj(mm); const log = m.session ? obj(turnLogs()[m.session]) : {};
  const me = mergeWho(mm.me, log.me, m.me), opp = mergeWho(mm.opp, log.opp, m.opp);
  const mine = [], theirs = [];
  for (const l of arr(mm.locations)) { mine.push(...arr(obj(l).myCards)); theirs.push(...arr(obj(l).oppCards)); }
  for (const s of Object.values(obj(log.turns))) for (const l of arr(obj(s).locs)) { mine.push(...arr(l.myCards)); theirs.push(...arr(l.oppCards)); }
  const myLooks = { ...obj(m.looks), ...looksOf(mine) }, oppLooks = { ...obj(obj(m.opp).looks), ...looksOf(theirs) };
  if (Object.keys(me).length) m.me = me;
  if (Object.keys(opp).length || Object.keys(oppLooks).length) m.opp = { ...opp, ...(Object.keys(oppLooks).length ? { looks: oppLooks } : {}) };
  if (Object.keys(myLooks).length) m.looks = myLooks;
  const d = S.decks.find((x) => x.id === m.deckId) || null, own = !NO_COLLECTION_MODES.test(m.mode || "");
  const got = [];
  if (own) {
    for (const [k, L] of Object.entries(myLooks)) {
      const v = L.vname ? matchVariant(k, L.vname, L.vname) : null;
      if (v) { if (setVarOwned(v, true, "match")) got.push(`${card(k).name} ${v.name || "variant"}`); if (d && arr(d.cards).includes(k)) { d.variants = obj(d.variants); if (!d.variants[k]) { const real = v.virtual ? materializeVar(v.id) : S.variants.find((x) => x.id === v.id) || v; if (real) d.variants[k] = real.id; } } }
      noteLook(k, { ...L, v: v ? (v.virtual ? "cat:" + v.cat : v.id) : "" }, "match");
    }
    // What you had on is yours
    if (me.cardback && markCosmetic("cardback", me.cardback, false, true)) got.push(`${me.cardback} card back`);
    if (me.title && markCosmetic("title", me.title, false, true)) got.push(`the ${me.title} title`);
    if (me.avatar && markCosmetic("avatar", me.avatar, false, true)) got.push(`${me.avatar} avatar`);
    for (const e of arr(me.emotes)) if (markCosmetic("emote", e, false, true)) got.push(`${e} emote`);
  }
  // Your deck's card back and avatar
  if (d && (me.cardback || me.avatar)) {
    d.seen = { ...obj(d.seen), ...(me.cardback ? { back: me.cardback } : {}), ...(me.avatar ? { avatar: me.avatar } : {}), at: Date.now() };
    if (!d.back && me.cardback && typeof cardBacks === "function") { const b = pickExact(cardBacks(), me.cardback, (x) => x.name); if (b) { d.back = b.id; d.backBy = "match"; } }
  }
  return got;
}
// The deck whose card back (and avatar) matches what a match showed, when the cards seen didn't say
function deckByLooks(me, seen) {
  me = whoOf(me); const back = lookKey(me.cardback), av = lookKey(me.avatar); if (!back) return null;
  // Only if exactly one of your decks has that card back (many players use one everywhere: then it can't tell)
  const withBack = S.decks.filter((d) => d.status === "active" && d.cards.length >= 6 && d.back && typeof cardBackById === "function").map((d) => ({ d, bk: lookKey((cardBackById(d.back) || {}).name) })).filter((x) => x.bk);
  const hits = withBack.filter((x) => x.bk === back);
  if (hits.length !== 1 || withBack.filter((x) => x.bk === hits[0].bk).length !== 1) return null;
  const d = hits[0].d, cards = arr(seen);
  // At least one card you played is in it (when any were read)
  if (cards.length && !cards.some((k) => d.cards.includes(k))) return null;
  if (av && obj(d.seen).avatar && lookKey(d.seen.avatar) !== av) return null;
  return d;
}

/* ---------- Showing it ---------- */
function whoLine(w) { w = obj(w); return [w.avatar ? `${w.avatar} avatar` : "", w.title ? `“${w.title}”` : "", w.cardback ? `${w.cardback} card back` : "", arr(w.emotes).length ? `emotes: ${w.emotes.join(", ")}` : ""].filter(Boolean).join(" · "); }
function looksChips(looks, deck) {
  return Object.entries(obj(looks)).slice(0, 12).map(([k, L]) => `<div class="li" style="padding:6px 0;border:0;gap:8px">${cardChip(k, { noOwn: true, size: "xs", deck })}<div class="grow small"><b>${esc(card(k).name)}</b><div class="muted">${esc(lookText(L))}</div></div></div>`).join("");
}
function matchLooksHtml(m) {
  const me = whoLine(m.me), opp = whoLine(m.opp), mine = Object.keys(obj(m.looks)).length, theirs = Object.keys(obj(obj(m.opp).looks)).length;
  if (!me && !opp && !mine && !theirs) return "";
  const deck = S.decks.find((d) => d.id === m.deckId) || null;
  return `<details class="panel small"><summary><b>Avatars, card backs and Custom Cards</b></summary><div class="stack" style="gap:6px;margin-top:8px">
    ${opp ? `<div><span class="eyebrow">${esc(m.oppName || "Them")}</span><div>${esc(opp)}</div></div>` : ""}
    ${theirs ? `<div><span class="eyebrow">Their Custom Cards</span>${looksChips(m.opp.looks, null)}</div>` : ""}
    ${me ? `<div><span class="eyebrow">You</span><div>${esc(me)}</div></div>` : ""}
    ${mine ? `<div><span class="eyebrow">Your Custom Cards</span>${looksChips(m.looks, deck)}</div>` : ""}
    <span class="muted">Read from the tracker's pictures, so check anything that looks off.</span></div></details>`;
}
// What an opponent usually has on, over every match with them
function oppUsual(ms) {
  const count = (f) => { const c = {}; for (const m of ms) { const v = obj(m.opp)[f]; if (v) c[v] = (c[v] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1])[0]; };
  const em = {}; for (const m of ms) for (const e of arr(obj(m.opp).emotes)) em[e] = (em[e] || 0) + 1;
  const out = [];
  const av = count("avatar"), ti = count("title"), cb = count("cardback");
  if (av) out.push(`${av[0]} avatar`); if (ti) out.push(`“${ti[0]}”`); if (cb) out.push(`${cb[0]} card back`);
  const ems = Object.entries(em).sort((a, b) => b[1] - a[1]).slice(0, 3); if (ems.length) out.push(`sends ${ems.map(([e, n]) => (n > 1 ? `${e} (${n}×)` : e)).join(", ")}`);
  const looks = {}; for (const m of ms) Object.assign(looks, obj(obj(m.opp).looks));
  const lk = Object.entries(looks).slice(0, 3).map(([k, L]) => `${card(k).name} (${lookText(L)})`); if (lk.length) out.push(`Custom Cards: ${lk.join("; ")}`);
  return out.join(" · ");
}
function deckSeenHtml(d) {
  const s = obj(d.seen); if (!s.back && !s.avatar) return "";
  return `<span class="muted small">Seen in your matches with this deck: ${esc([s.back ? `${s.back} card back` : "", s.avatar ? `${s.avatar} avatar` : ""].filter(Boolean).join(" · "))}. SNAP Stat uses the card back to tell this deck apart when the cards it sees don't.</span>`;
}

/* ---------- Reward pop-ups: a new card, variant, avatar, title, card back or emote ---------- */
function applyShotReward(x, r) {
  const got = [];
  for (const i of arr(r.items).slice(0, 20)) {
    const o = obj(i), kind = String(o.kind || "").toLowerCase().replace(/\s/g, "");
    if (kind === "card") { const c = fuzzyCard(o.card || o.name); if (c && !c.unknown && !S.owned[c.key]) { S.owned[c.key] = true; got.push(c.name); } }
    else if (kind === "variant") { const c = fuzzyCard(o.card); const v = c ? matchVariant(c.key, o.name || "", o.name || "") : null; if (v && setVarOwned(v, true, "reward")) got.push(`${c.name} ${v.name || "variant"}`); }
    else if (COS[kind === "cardback" ? "cardback" : kind]) { if (markCosmetic(kind, o.name, true)) got.push(`${o.name} ${COS[kind].toLowerCase()}`); }
  }
  const from = String(r.from || "").slice(0, 60);
  if (!got.length) { x.status = `A reward screen${from ? ` (${from})` : ""}: nothing new to tick`; save(); return; }
  x.status = `Ticked as yours: ${got.slice(0, 4).join(", ")}${got.length > 4 ? ` and ${got.length - 4} more` : ""}`; x.detail = from; save(); collSyncNow();
}
if (typeof OWN_BY !== "undefined") Object.assign(OWN_BY, { match: "seen in one of your matches", reward: "from a reward screen" });

/* ---------- Cards › Custom cards: the Custom Cards you've made in the game (and ones opponents use) ---------- */
let le = { k: "", q: "" };
Object.assign(LOOK_SRC, { you: "set by you" });
function vGameCustom() {
  const L = obj(S.looks), q = keyOf(le.q || "");
  const ks = Object.keys(L).filter((k) => !card(k).unknown && (!q || keyOf(card(k).name).includes(q))).sort((a, b) => card(a).name.localeCompare(card(b).name));
  const deckOf = (k) => S.decks.find((d) => d.status !== "retired" && d.cards.includes(k) && obj(d.variants)[k]) || null;
  const row = (k) => { const x = obj(L[k]), v = x.v ? variantAny(x.v) : null;
    return `<div class="li coll"><div class="collart" style="width:74px">${cardChip(k, { noOwn: true, size: "xs", v })}</div><div class="grow"><div class="t">${esc(card(k).name)}</div>
      ${[v ? `${v.name || "Variant"}${byArtist(v)}` : x.vname ? `${x.vname} variant` : "Base art", x.border ? `${x.border} border` : "", x.finish ? `${x.finish} finish` : "", x.flare ? `${x.flare} flare` : ""].filter(Boolean).map((t) => `<div class="s">${esc(t)}</div>`).join("")}
      <div class="s">${esc(LOOK_SRC[x.src] || "")}${x.at ? ` · ${esc(agoTxt(x.at))}` : ""}</div></div>
      <div class="collchk"><button class="btn sm" data-a="leOpen" data-k="${esc(k)}">Edit</button></div></div>`; };
  // What opponents had on, newest first
  const seen = new Map();
  for (const m of realMatches().slice().sort((a, b) => b.ts - a.ts)) for (const [k, x] of Object.entries(obj(obj(m.opp).looks))) { const key = k + "|" + lookText(x); if (!seen.has(key) && seen.size < 40) seen.set(key, { k, x, who: m.oppName || "an opponent", ts: m.ts }); }
  return `<section class="sec">${backBar("Custom cards")}
    <div class="panel stack small" style="gap:6px"><b>Your Custom Cards</b><span class="muted">The look you've given each card in MARVEL SNAP: its variant, border, finish and flare. They fill in by themselves from each card's own screen in the game (screenshot it, or open it with Track & play on), from the cards you play in matches, and from the PC game's files. Tap Edit to fix one.</span>
      <div class="row"><input type="search" id="le-q" data-le="q" value="${esc(le.q || "")}" placeholder="Find a card" style="flex:1"><button class="btn sm" data-a="leAdd">${ICON.plus} Add one</button></div></div>
    ${ks.length ? `<div class="list">${ks.slice(0, 300).map(row).join("")}</div>` : `<div class="empty"><strong>${q ? "No Custom Card for that card yet" : "No Custom Cards saved yet"}</strong><span>Open a card in the game and screenshot it, or play a match with Track & play on.</span></div>`}
    <span class="muted small">${fmt(Object.keys(L).length)} card${Object.keys(L).length === 1 ? "" : "s"} with a Custom Card saved.</span></section>
    ${seen.size ? `<section class="sec"><details class="panel small"><summary><b>Opponents' Custom Cards</b> <span class="muted">(${seen.size})</span></summary><div class="list" style="margin-top:8px">${[...seen.values()].map((s) => `<div class="li coll"><div class="collart" style="width:74px">${cardChip(s.k, { noOwn: true, size: "xs" })}</div><div class="grow"><div class="t">${esc(card(s.k).name)}</div><div class="s">${esc(lookText(s.x))}</div><div class="s">${esc(s.who)} · ${esc(dayStr(s.ts))}</div></div></div>`).join("")}</div></details></section>` : ""}
    ${S.custom.length ? `<section class="sec"><details class="panel small"><summary><b>Cards you designed in SNAP Stat</b> <span class="muted">(${S.custom.length})</span></summary><div class="stack" style="margin-top:8px"><div class="cgrid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${S.custom.map((c) => `<div class="stack" style="align-items:center;gap:6px">${customCardHtml(c, true)}<button class="btn sm ghost" data-a="cdDel" data-id="${esc(c.id)}">Delete</button></div>`).join("")}</div><span class="muted">These were made with the old card designer. They still work in your decks and posts.</span></div></details></section>` : ""}`;
}
function leSheet() {
  const k = le.k, c = card(k), x = obj(obj(S.looks)[k]);
  if (!k) return `${sheetHead("Add a Custom Card")}<label class="f">Card<input type="text" id="le-card" list="le-cards" placeholder="Start typing a card" autocomplete="off"></label><datalist id="le-cards">${allCards().filter((y) => !y.unknown && !y.custom).map((y) => `<option value="${esc(y.name)}">`).join("")}</datalist><button class="btn snap" data-a="lePick">Next</button>`;
  const vs = allVariants().filter((v) => v.card === k && (v.owned || v.id === x.v || "cat:" + v.cat === x.v));
  const cur = x.v ? (variantAny(x.v) || {}).id : "";
  return `${sheetHead(esc(c.name), "Your Custom Card in the game")}
    <div class="row" style="justify-content:center">${cardChip(k, { noOwn: true, v: x.v ? variantAny(x.v) : null })}</div>
    <label class="f">Variant<select id="le-v"><option value="">Base art${x.vname && !x.v ? ` (read as ${esc(x.vname)})` : ""}</option>${vs.map((v) => `<option value="${esc(v.virtual ? "cat:" + v.cat : v.id)}" ${v.id === cur ? "selected" : ""}>${esc((v.name || "Variant") + byArtist(v))}</option>`).join("")}</select></label>
    <label class="f">Border<input type="text" id="le-b" list="le-bl" value="${esc(x.border || "")}" placeholder="Standard"></label><datalist id="le-bl">${borderNames().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="grid2"><label class="f">Finish<input type="text" id="le-fi" list="le-fil" value="${esc(x.finish || "")}" placeholder="None"></label><label class="f">Flare<input type="text" id="le-fl" list="le-fll" value="${esc(x.flare || "")}" placeholder="None"></label></div>
    <datalist id="le-fil">${SPLIT_FINISHES.map((n) => `<option value="${esc(n)}">`).join("")}</datalist><datalist id="le-fll">${SPLIT_FLARES.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <span class="muted small">Only your owned variants are listed. Tick more in Cards › Variants.</span>
    <div class="row"><button class="btn snap" data-a="leSave">Save</button>${x.at ? `<button class="btn danger" data-a="leClear">Remove</button>` : ""}</div>`;
}
Object.assign(A, {
  leOpen: (el) => { le.k = el.dataset.k; openSheet(leSheet); },
  leAdd: () => { le.k = ""; openSheet(leSheet); },
  lePick: () => { const c = fuzzyCard(($("#le-card") || {}).value || ""); if (!c || c.unknown) { toast("Pick a card from the list"); return; } le.k = c.key; refreshSheet(); },
  leSave: () => { const k = le.k; if (!k) return; const v = $("#le-v").value; const vv = v ? variantAny(v) : null;
    S.looks = obj(S.looks); S.looks[k] = { v, vname: vv ? vv.name || "" : "", border: $("#le-b").value.trim().slice(0, 40), finish: $("#le-fi").value.trim().slice(0, 40), flare: $("#le-fl").value.trim().slice(0, 40), at: Date.now(), src: "you" };
    save(); closeSheet(); render(); toast("Custom Card saved"); },
  leClear: () => { delete obj(S.looks)[le.k]; save(); closeSheet(); render(); toast("Removed"); },
});
document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.le === "q") { le.q = t.value; const pos = t.selectionStart; render(); const n = $("#le-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* fine */ } } } });
