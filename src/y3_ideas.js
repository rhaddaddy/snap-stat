/* ============ Matchup notes, deck vs location, variant goals, season recaps ============ */

/* ---------- Matchups: how you do against each kind of deck, your best answers, and your own notes ---------- */
function oppArch(m) { return archetypeOf(m.oppCards) || ""; }
function matchupData(arch, ms = realMatches()) {
  const list = ms.filter((m) => m.result && arr(m.oppCards).length && oppArch(m) === arch);
  const st = statsFor(list);
  const decks = {}; list.forEach((m) => { const k = m.deckId || m.deckName || ""; if (!k) return; (decks[k] = decks[k] || { name: m.deckName || "No deck", list: [] }).list.push(m); });
  const deckRows = Object.values(decks).map((d) => ({ name: d.name, st: statsFor(d.list) })).filter((d) => d.st.games >= 2).sort((a, b) => b.st.wr - a.st.wr || b.st.games - a.st.games).slice(0, 4);
  const mine = cardAnalytics(list.filter((m) => m.tracked)).filter((r) => r.played >= 2).sort((a, b) => b.wr - a.wr || b.played - a.played).slice(0, 5);
  const theirs = {}; list.forEach((m) => new Set(arr(m.oppCards)).forEach((n) => (theirs[n] = (theirs[n] || 0) + 1)));
  return { list, st, deckRows, mine, theirs: Object.entries(theirs).sort((a, b) => b[1] - a[1]).slice(0, 8) };
}
let mu = null;
function matchupSheet() {
  const x = matchupData(mu), note = obj(S.matchNotes)[mu] || "";
  return `${sheetHead(`Against ${esc(mu)} decks`, x.st.games ? `${x.st.w}-${x.st.l}${x.st.t ? "-" + x.st.t : ""} · ${x.st.wr}% · ${signed(x.st.cubes)} cubes` : "No games yet")}
    <label class="f">Your notes for this matchup<textarea id="mu-note" data-munote="${esc(mu)}" placeholder="What works, what to hold back, when to retreat…">${esc(note)}</textarea></label>
    <p class="muted small">Your note shows up in the live tracker when an opponent's cards look like this kind of deck.</p>
    ${x.deckRows.length ? `<h3>Your decks against it</h3><div class="list">${x.deckRows.map((d) => `<div class="li"><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${d.st.games} games · ${d.st.w}-${d.st.l}</div></div><span class="num ${d.st.wr >= 50 ? "pos" : "neg"}" style="font-weight:800">${d.st.wr}%</span></div>`).join("")}</div>` : ""}
    ${x.mine.length ? `<h3>Your best cards against it</h3><div class="chiplist">${x.mine.map((r) => cardChip(r.k, { noOwn: true, suffix: ` <span class="muted">${r.wr}% · ${r.played} games</span>` })).join("")}</div>` : `<p class="muted small">Track games with the live tracker to see which of your cards do best here.</p>`}
    ${x.theirs.length ? `<h3>Their cards you see most</h3><div class="chiplist">${x.theirs.map(([n, c]) => nameChip(n, ` <span class="muted">×${c}</span>`)).join("")}</div>` : ""}`;
}
// In the live tracker: once their cards look like a kind of deck, your record and notes against it.
function matchupHint(L) {
  const names = [...new Set(arr(L && L.opp).map((o) => card(o.key).name))]; if (names.length < 2) return "";
  const arch = archetypeOf(names); if (!arch || /cost|Mixed/.test(arch)) return "";
  const x = matchupData(arch), note = obj(S.matchNotes)[arch] || "";
  return `<div class="panel stack small muhint"><div class="row between"><b>Looks like ${esc(arch)}</b><button class="btn sm ghost" data-a="muOpen" data-v="${esc(arch)}">Notes</button></div>
    <span>${x.st.games ? `You're ${x.st.w}-${x.st.l} against it (${x.st.wr}%)` : "First time tracking this matchup"}${x.mine[0] ? ` · your best card: ${esc(card(x.mine[0].k).name)}` : ""}</span>${note ? `<span class="muted" style="white-space:pre-wrap">${esc(note)}</span>` : ""}</div>`;
}

/* ---------- Deck vs location ---------- */
function locHelpHurt(locs) {
  const pool = arr(locs).filter((r) => r.games >= 2 && r.lw + r.ll > 0);
  if (pool.length < 2) return "";
  const by = (r) => r.lwr * 1000 + r.wr * 10 + r.games;
  const help = [...pool].sort((a, b) => by(b) - by(a)).slice(0, 3).filter((r) => r.lwr >= 50);
  const hurt = [...pool].sort((a, b) => by(a) - by(b)).slice(0, 3).filter((r) => r.lwr < 50 && !help.includes(r));
  const chip = (r, good) => `<button class="lchip ${good ? "good" : "bad"}" data-a="locOpen" data-name="${esc(r.name)}"><b>${esc(r.name)}</b><span>won it ${r.lwr}% · ${r.games} games</span></button>`;
  return `<div class="stack small" style="gap:6px">${help.length ? `<span class="eyebrow">Locations that help this deck</span><div class="chips">${help.map((r) => chip(r, true)).join("")}</div>` : ""}
    ${hurt.length ? `<span class="eyebrow">Locations that hurt it</span><div class="chips">${hurt.map((r) => chip(r, false)).join("")}</div>` : ""}</div>`;
}
function locDecksHtml(name) {
  const k = keyOf(name), by = {};
  for (const m of realMatches()) {
    if (!m.tracked) continue;
    const L = arr(m.locs).find((x) => keyOf(obj(x).name) === k); if (!L) continue;
    const id = m.deckId || m.deckName; if (!id) continue;
    const r = (by[id] = by[id] || { name: m.deckName || "No deck", games: 0, mw: 0, ml: 0, lw: 0, ll: 0 });
    r.games++; if (m.result === "W") r.mw++; else if (m.result === "L") r.ml++;
    if (num(L.my) > num(L.opp)) r.lw++; else if (num(L.my) < num(L.opp)) r.ll++;
  }
  const rows = Object.values(by).sort((a, b) => b.games - a.games).slice(0, 6);
  if (!rows.length) return "";
  return `<h3>Your decks here</h3><div class="list">${rows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${r.games} game${r.games === 1 ? "" : "s"} · ${pct(r.mw, r.mw + r.ml)}% match wins</div></div><span class="num ${pct(r.lw, r.lw + r.ll) >= 50 ? "pos" : "neg"}" style="font-weight:800">won it ${pct(r.lw, r.lw + r.ll)}%</span></div>`).join("")}</div>`;
}

/* ---------- Variant goals: an artist, rarity or source to complete ---------- */
const VG_KINDS = { artist: "Artist", rarity: "Rarity", source: "Where they come from" };
function vgArtists(v) { return String(v.artist || "").split(/\s*(?:&|,| and )\s*/).map((s) => s.trim()).filter((s) => s.length > 1); }
// Worked out once per change to your variants (allVariants() hands back the same list until then) and per day
let _vgSrc = null, _vgDay = "", _vgMemo = {};
function vgGroups(kind) {
  const all = allVariants(), today = localDate(Date.now()), by = new Map();
  if (all !== _vgSrc || today !== _vgDay) { _vgSrc = all; _vgDay = today; _vgMemo = {}; }
  if (_vgMemo[kind]) return _vgMemo[kind];
  for (const v of all) {
    if (varUpcoming(v, today) && !v.owned) continue;
    const keys = kind === "artist" ? vgArtists(v) : [String(v[kind] || "").trim()].filter(Boolean);
    for (const key of keys) { const g = by.get(key) || { key, all: [], own: 0 }; g.all.push(v); if (v.owned) g.own++; by.set(key, g); }
  }
  return (_vgMemo[kind] = [...by.values()].filter((g) => g.all.length >= (kind === "artist" ? 3 : 1)));
}
const vgId = (kind, key) => kind + ":" + key;
function vgPinned() { return arr(S.varGoals).filter((g) => g && VG_KINDS[g.kind] && g.key); }
function vgRow(kind, g) {
  const id = vgId(kind, g.key), pinned = vgPinned().some((x) => vgId(x.kind, x.key) === id), left = g.all.length - g.own;
  const wished = g.all.filter((v) => !v.owned && v.wish).length;
  return `<div class="li vgrow"><div class="grow" style="min-width:0"><div class="row between nowrap"><span class="t">${esc(g.key)}</span><span class="num small">${g.own}/${g.all.length}</span></div>${pctBar(g.own, g.all.length)}
      <div class="s">${left ? `${left} to go${wished ? ` · ${wished} on your wishlist` : ""}` : "Complete!"}</div></div>
    <div class="stack" style="gap:4px;flex:none"><button class="btn sm ${pinned ? "snap" : "ghost"}" data-a="vgPin" data-kind="${kind}" data-key="${esc(g.key)}" aria-pressed="${pinned}">${pinned ? "Goal" : "Set goal"}</button>
      ${left && wished < left ? `<button class="btn sm ghost" data-a="vgWish" data-kind="${kind}" data-key="${esc(g.key)}">${ui.vgArm === id ? `Tap again: add ${left - wished}` : "♡ the rest"}</button>` : ""}
      <button class="btn sm ghost" data-a="vgShow" data-kind="${kind}" data-key="${esc(g.key)}">See them</button></div></div>`;
}
function vgPinnedHtml(compact) {
  const pins = vgPinned(); if (!pins.length) return "";
  const rows = pins.map((p) => { const g = vgGroups(p.kind).find((x) => x.key === p.key); return g ? { p, g } : null; }).filter(Boolean);
  if (!rows.length) return "";
  if (compact) return `<section class="sec"><div class="sec-h"><h2>Variant goals</h2><button class="btn sm ghost" data-a="go" data-to="cards/goals">All goals</button></div><div class="list">${rows.slice(0, 4).map(({ p, g }) => `<button class="li" data-a="go" data-to="cards/goals"><div class="grow"><div class="row between nowrap"><span class="t">${esc(g.key)}</span><span class="num small">${g.own}/${g.all.length}</span></div>${pctBar(g.own, g.all.length)}<div class="s">${esc(VG_KINDS[p.kind])}</div></div></button>`).join("")}</div></section>`;
  return `<h3>Your goals</h3><div class="list">${rows.map(({ p, g }) => vgRow(p.kind, g)).join("")}</div>`;
}
function vVariantGoals() {
  const kind = VG_KINDS[ui.vgKind] ? ui.vgKind : "artist", q = keyOf(ui.vgQ || "");
  let groups = vgGroups(kind).filter((g) => !q || keyOf(g.key).includes(q));
  groups.sort(kind === "rarity" ? (a, b) => rarityRank(a.key) - rarityRank(b.key) : (a, b) => b.all.length - a.all.length || a.key.localeCompare(b.key));
  const lim = num(ui.vgLim) || 40;
  return `<section class="sec"><p class="muted small">Pick an artist, rarity or source to collect. Each goal shows how far along you are, and "♡ the rest" puts the ones you're missing on your wishlist, so you're told when they're in a shop.</p>
    ${vgPinnedHtml(false)}
    <div class="chips">${Object.entries(VG_KINDS).map(([k, l]) => `<button class="chip" data-a="vgKind" data-v="${k}" aria-pressed="${kind === k}">${l}</button>`).join("")}</div>
    <input type="search" id="vg-q" data-ui="vgQ" value="${esc(ui.vgQ || "")}" placeholder="Search ${kind === "artist" ? "artists" : kind === "rarity" ? "rarities" : "sources"}" aria-label="Search">
    ${groups.length ? `<div class="list">${groups.slice(0, lim).map((g) => vgRow(kind, g)).join("")}</div>` : `<p class="muted small">Nothing matches.</p>`}
    ${groups.length > lim ? `<button class="btn block" data-a="vgMore">Show more (${groups.length - lim} left)</button>` : ""}</section>`;
}

/* ---------- Season recap: ready when a season ends ---------- */
function recapMark(id) { const s = seasons().find((x) => x.id === id); if (s && timeState(s) === "live") S.recapEarly = { ...obj(S.recapEarly), [id]: 1 }; else S.recapSeen = { ...obj(S.recapSeen), [id]: 1 }; }
function recapDue() {
  const now = Date.now(), ss = seasons();
  const cur = ss.find((s) => timeState(s) === "live");
  if (cur && Number.isFinite(cur.endTs) && cur.endTs - now < 2 * DAY && !obj(S.recapEarly)[cur.id] && inPeriod(realMatches(), { from: cur.startTs, to: cur.endTs }).length >= 5) return { s: cur, ending: true };
  const prev = ss.filter((s) => timeState(s) === "past").sort((a, b) => b.endTs - a.endTs)[0];
  if (prev && now - prev.endTs < 4 * DAY && inPeriod(realMatches(), { from: prev.startTs, to: prev.endTs }).length >= 5 && obj(S.recapSeen)[prev.id] !== 1) return { s: prev, ending: false };
  return null;
}
function recapBanner() {
  const r = recapDue(); if (!r) return "";
  const pic = showArt() ? seasonArt(r.s) : "";
  return `<section class="sec"><div class="panel recapb ${pic ? "has-art" : ""}">${pic ? imgTag(pic, "sbg") : ""}<div class="stack" style="gap:6px;position:relative;z-index:1">
    <b>${r.ending ? `${esc(r.s.name)} ${endsTxt(r.s.endTs)}` : `${esc(r.s.name)} is over`}</b><span class="small">Your season recap is ready: your record, best deck, top card and luckiest location in one picture.</span>
    <div class="row"><button class="btn snap sm" data-a="recapSeason" data-id="${esc(r.s.id)}">See my recap</button><button class="btn sm ghost" data-a="recapDismiss" data-id="${esc(r.s.id)}">Not now</button></div></div></div></section>`;
}
function bestLocation(ms) {
  const r = locationAnalytics(ms).filter((x) => x.games >= 2 && x.lw + x.ll > 0).sort((a, b) => b.lwr - a.lwr || b.games - a.games)[0];
  return r ? `${r.name} (won it ${r.lwr}%)` : "";
}

/* ---------- Typing and taps ---------- */
document.addEventListener("input", (e) => {
  const t = e.target, d = t.dataset || {};
  if (d.munote !== undefined) { S.matchNotes = { ...obj(S.matchNotes), [d.munote]: t.value.slice(0, 600) }; if (!t.value) delete S.matchNotes[d.munote]; save(); }
});
Object.assign(A, {
  natPinWidget: () => { pushWidget(); const ok = natCan("pinWidget") && NATIVE.pinWidget(); if (!ok) toast("Add it from your home screen: press and hold an empty spot › Widgets › SNAP Stat."); },
  muOpen: (el) => { mu = el.dataset.v; openSheet(matchupSheet); },
  vgKind: (el) => { ui.vgKind = el.dataset.v; ui.vgLim = 40; render(); },
  vgMore: () => { ui.vgLim = (num(ui.vgLim) || 40) + 40; render(); },
  vgPin: (el) => {
    const id = vgId(el.dataset.kind, el.dataset.key), pins = vgPinned();
    S.varGoals = pins.some((p) => vgId(p.kind, p.key) === id) ? pins.filter((p) => vgId(p.kind, p.key) !== id) : [...pins, { kind: el.dataset.kind, key: el.dataset.key }].slice(-12);
    save(); render();
  },
  vgWish: (el) => {
    const g = vgGroups(el.dataset.kind).find((x) => x.key === el.dataset.key); if (!g) return;
    const id = vgId(el.dataset.kind, el.dataset.key), todo = g.all.filter((v) => !v.owned && !v.wish).length;
    if (todo > 25 && ui.vgArm !== id) { ui.vgArm = id; render(); return; } // a big list: check first
    ui.vgArm = "";
    let n = 0; for (const v of g.all) if (!v.owned && !v.wish) { const r = materializeVar(v.id); if (r) { r.wish = true; n++; } }
    save(); render(); toast(n ? `${n} added to your wishlist` : "Already on your wishlist");
  },
  vgShow: (el) => {
    const kind = el.dataset.kind, key = el.dataset.key;
    ui.varFilter = "all"; ui.varArtist = ""; ui.varQ = kind === "artist" ? key : ""; ui.varRarity = kind === "rarity" ? key : ""; ui.varSource = kind === "source" ? key : "";
    applyNav("cards", "variants"); render(); window.scrollTo(0, 0);
  },
  // Looking at it before the season ends hides the "ending soon" banner only: the full recap still shows once it's over
  recapSeason: (el) => { const p = periods().find((x) => x.season && x.season.id === el.dataset.id); rc.period = p ? p.id : (currentSeasonPeriod() || periods()[0]).id; rc.url = ""; rc.blob = null; recapMark(el.dataset.id); save(); openSheet(recapSheet); makeRecap(); },
  recapDismiss: (el) => { recapMark(el.dataset.id); save(); render(); },
});
