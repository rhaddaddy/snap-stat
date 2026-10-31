/* ============ y16_decks.js: deck tools ============
   Deck shape (energy curve), archetype labels, version notes, win-rate trend, pinned decks, gameplan notes,
   how to get missing cards, matchups per deck with tech-card tips, list sorting, duplicate as a draft, and card picks.
   Hooks used: EXT.deckTabs (Plan, Trend, Matchups), EXT.styles, plus small hooks that f_decks.js and l_features.js call
   when they exist: deckListOrder, deckSortHtml, deckRowPills, deckRowInfo (Decks list), deckBuildHtml (deck sheet,
   under "Add cards"), deckVersionNote (Versions tab). Without this file those spots draw exactly as before. */

/* ---------- Per-deck records, computed once per batch of matches ---------- */
// Matches grouped the way deckMatches() does it (by deck id, or by name for matches saved without an id), newest first.
let _y16g = { ver: -1, byId: {}, byName: {} };
function y16Groups() {
  if (_y16g.ver === _mVer) return _y16g;
  const byId = {}, byName = {};
  for (const m of allMatches()) {
    if (m.deckId) (byId[m.deckId] = byId[m.deckId] || []).push(m);
    else if (m.deckName) (byName[m.deckName] = byName[m.deckName] || []).push(m);
  }
  _y16g = { ver: _mVer, byId, byName };
  return _y16g;
}
// This deck's matches, newest first (same rule as deckMatches, from the cached groups)
function y16Matches(d) { const g = y16Groups(); const a = arr(g.byId[d.id]), b = arr(g.byName[d.name]); return a.length && b.length ? [...a, ...b].sort((x, y) => y.ts - x.ts) : a.length ? a : b; }
// The current season (or month) period, looked up at most every few seconds
let _y16p = { at: 0, p: null };
function y16Period() { const now = Date.now(); if (now - _y16p.at > 5000) { let p = null; try { p = currentSeasonPeriod() || null; } catch { p = null; } _y16p = { at: now, p }; } return _y16p.p; }
const _y16rec = new Map();
// { games, w, l, t, wr, cubes, last (ts of the newest game), season (games this season or month), seasonLabel }
function y16Rec(d) {
  const p = y16Period(); const key = `${d.id}|${d.name}|${_mVer}|${p ? p.id : ""}`;
  const hit = _y16rec.get(key); if (hit) return hit;
  if (_y16rec.size > 400) _y16rec.clear();
  const ms = y16Matches(d); const st = statsFor(ms);
  const r = { games: st.games, w: st.w, l: st.l, t: st.t, wr: st.wr, cubes: st.cubes, last: ms.length ? num(ms[0].ts) : 0, season: p ? ms.filter((m) => m.ts >= p.from && m.ts <= p.to).length : 0, seasonLabel: p && p.season ? "this season" : "this month" };
  _y16rec.set(key, r); return r;
}
const _y16arch = new Map();
// The deck's archetype ("Move", "Discard", "Low-cost"…) from its cards, cached by the card list
function deckArchetype(d) {
  const sig = arr(d.cards).join(","); if (!sig) return "";
  if (_y16arch.has(sig)) return _y16arch.get(sig);
  if (_y16arch.size > 300) _y16arch.clear();
  let a = ""; try { a = archetypeOf(arr(d.cards).map((k) => card(k).name)) || ""; } catch { a = ""; }
  _y16arch.set(sig, a); return a;
}

/* ---------- Decks list: pins, sorting and the extra line under each deck ---------- */
const Y16_SORTS = [["recent", "Recent"], ["wr", "Win %"], ["games", "Games"], ["name", "Name"]];
const Y16_PIN_MAX = 3;
// Pinned deck ids that still exist (read-only: S.deckPins is only written when you pin or unpin)
function deckPins() { return arr(S.deckPins).filter((id) => S.decks.some((d) => d.id === id)).slice(0, Y16_PIN_MAX); }
const deckPinned = (d) => deckPins().includes(d.id);
// Pinned decks first (in the order you pinned them), then the chosen sort. Called by vDecks.
function deckListOrder(list) {
  const pins = deckPins(); const sort = ui.deckSort || "recent";
  const info = new Map(arr(list).map((d) => { const r = y16Rec(d); return [d.id, { r, recent: Math.max(r.last, num(d.created), ...arr(d.history).map((h) => num(h.ts))) }]; }));
  const I = (d) => info.get(d.id);
  const byRecent = (a, b) => I(b).recent - I(a).recent;
  const cmp = sort === "name" ? (a, b) => String(a.name).localeCompare(String(b.name))
    : sort === "wr" ? (a, b) => (I(b).r.games ? I(b).r.wr : -1) - (I(a).r.games ? I(a).r.wr : -1) || I(b).r.games - I(a).r.games || byRecent(a, b)
    : sort === "games" ? (a, b) => I(b).r.games - I(a).r.games || byRecent(a, b)
    : byRecent;
  const rank = (d) => { const i = pins.indexOf(d.id); return i < 0 ? 99 : i; };
  return [...arr(list)].sort((a, b) => rank(a) - rank(b) || cmp(a, b));
}
function deckSortHtml() {
  if (S.decks.length < 2) return "";
  const cur = ui.deckSort || "recent";
  return `<div class="chips y16-sort"><span class="muted small y16-sortl">Sort</span>${Y16_SORTS.map(([v, l]) => `<button class="chip" data-a="y16Sort" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</div>`;
}
function deckRowPills(d) { return deckPinned(d) ? ` <span class="pill gold">Pinned</span>` : ""; }
// "[Move] · Played 3d ago · 5 games this season", under the deck name
function deckRowInfo(d) {
  const a = deckArchetype(d), r = y16Rec(d);
  const bits = [r.last ? `Played ${esc(agoTxt(r.last))}` : "Not played yet"];
  if (r.season) bits.push(`${r.season} game${r.season === 1 ? "" : "s"} ${r.seasonLabel}`);
  return `<div class="s y16-info">${a ? `<span class="pill dim">${esc(a)}</span> ` : ""}${bits.join(" · ")}</div>`;
}

/* ---------- Deck shape: energy curve, average cost, On Reveal / Ongoing counts ---------- */
function y16CostBuckets(keys) {
  const counts = [0, 0, 0, 0, 0, 0]; let missing = 0;
  for (const k of keys) { const c = card(k); if (c.cost === "?" || c.cost === "") { missing++; continue; } counts[clamp(num(c.cost) <= 1 ? 0 : num(c.cost) - 1, 0, 5)]++; }
  return { counts, missing };
}
function y16CurveSvg(counts) {
  const max = Math.max(1, ...counts);
  const labels = ["≤1", "2", "3", "4", "5", "6+"]; const top = 18, base = 84, bw = 34, step = 48, x0 = 13;
  const bars = counts.map((n, i) => {
    const h = n ? Math.max(4, ((base - top) * n) / max) : 0, x = x0 + i * step, y = base - h;
    return `${n ? `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="5" style="fill:var(--cost)"/><text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${n}</text>` : `<rect x="${x}" y="${base - 3}" width="${bw}" height="3" rx="1.5" style="fill:var(--line)"/>`}<text x="${x + bw / 2}" y="100" text-anchor="middle" font-size="11" style="fill:var(--muted)">${labels[i]}</text>`;
  }).join("");
  return `<svg class="y16-curve" viewBox="0 0 300 106" role="img" aria-label="Cards by energy cost: ${labels.map((l, i) => `${l}: ${counts[i]}`).join(", ")}">${bars}</svg>`;
}
function deckShapeHtml(keys) {
  keys = arr(keys); if (!keys.length) return "";
  const { counts, missing } = y16CostBuckets(keys);
  const cs = keys.map((k) => card(k)), known = cs.filter((c) => c.cost !== "?" && c.cost !== "");
  const avg = known.length ? Math.round((known.reduce((s, c) => s + num(c.cost), 0) / known.length) * 10) / 10 : 0;
  const reveal = cs.filter((c) => cardTags(c).includes("R")).length, ongoing = cs.filter((c) => cardTags(c).includes("O")).length;
  const power = cs.reduce((s, c) => s + num(c.power), 0);
  const cheap = counts[0] + counts[1], big = counts[4] + counts[5];
  const hint = known.length < 6 ? "Add more cards to see how the curve plays."
    : counts[5] >= 3 ? `${counts[5]} cards cost 6 or more: you can usually play only one of them on the last turn, so the rest may sit in your hand.`
    : cheap < 3 ? `Only ${cheap} card${cheap === 1 ? "" : "s"} cost 2 or less, so your first two turns may have nothing to play.`
    : avg >= 3.6 ? `Top-heavy: ${big} cards cost 5 or more. Expect an early turn with nothing to play now and then.`
    : avg <= 2.3 ? "Low curve: you'll have plays every turn. Check you can still beat one big card at the end."
    : "Balanced curve: something to play on every turn.";
  const stat = (k, v) => `<div class="y16-stat"><span class="k">${k}</span><b class="num">${v}</b></div>`;
  return `<div class="panel stack y16-shape"><span class="eyebrow">Deck shape</span>${y16CurveSvg(counts)}
    <div class="y16-stats">${stat("Avg cost", known.length ? avg.toFixed(1) : "—")}${stat("On Reveal", reveal)}${stat("Ongoing", ongoing)}${stat("Power", power)}</div>
    <span class="small muted">${esc(hint)}${missing ? ` ${missing} card${missing === 1 ? " has" : "s have"} no cost listed yet.` : ""}</span>
    ${(() => { const t = {}; cs.forEach((c) => cardTags(c).forEach((x) => { if (x !== "R" && x !== "O") t[x] = (t[x] || 0) + 1; })); const top = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5); return top.length ? `<div class="row y16-tags">${top.map(([x, n]) => `<span class="pill dim">${esc(TAGS[x] || x)} ×${n}</span>`).join("")}</div>` : ""; })()}</div>`;
}

/* ---------- How to get the cards you don't own ---------- */
function y16HowToGet(c) {
  const P = { ...(typeof DEF_PRICES !== "undefined" ? DEF_PRICES : {}), ...obj(S.prices) };
  if (c.upcoming) return c.release ? `Not out yet (${dateStr(c.release)})` : "Not out yet";
  const s = seriesOf(c);
  if (s === "Series 5" || s === "Series 4") return `Card Shop with tokens${num(P[s === "Series 5" ? "s5" : "s4"]) ? "" : " (price not set)"}, or a Spotlight Cache the week it's featured`;
  if (s === "Series 3") return "Series 3 pack in the Card Shop (gives a random Series 3 card), or Collection Level";
  if (s === "Starter" || s === "Series 1" || s === "Series 2") return "Free from Collection Level as you go up";
  return "Check the Card Shop in the game";
}
function deckMissingHtml(d) {
  const keys = arr(d.cards).filter((k) => !String(k).startsWith("custom:") && !S.owned[k]);
  if (!keys.length) return arr(d.cards).length && Object.keys(S.owned).length ? `<p class="small muted">You own every card in this deck.</p>` : "";
  const rows = keys.map((k) => { const c = card(k); let cost = { how: "unknown", price: 0, currency: "" }; try { if (typeof costOf === "function") cost = costOf("card:" + k, k, ""); } catch { /* no price */ } return { k, c, cost }; })
    .sort((a, b) => (b.cost.currency === "tokens" ? b.cost.price : 0) - (a.cost.currency === "tokens" ? a.cost.price : 0) || num(a.c.cost) - num(b.c.cost));
  const tok = rows.reduce((s, r) => s + (r.cost.currency === "tokens" ? r.cost.price : 0), 0), have = num(obj(S.wallet).tokens);
  const price = (r) => r.cost.how === "offer" ? `<span class="pill W">On sale</span>` : r.cost.currency === "tokens" && r.cost.price ? `<span class="small num muted y16-nw">${fmt(r.cost.price)} tokens</span>` : r.cost.how === "free" ? `<span class="pill dim">Free</span>` : "";
  const how = (r) => r.cost.how === "offer" && r.cost.o && typeof offerPrice === "function" ? `On sale: ${esc(offerPrice(r.cost.o))}${r.cost.o.expires ? ` until ${esc(dateStr(r.cost.o.expires))}` : ""}` : esc(y16HowToGet(r.c));
  return `<div class="panel stack y16-miss"><div class="row between"><span class="eyebrow">Cards you don't own (${keys.length})</span>${tok ? `<b class="small num">${fmt(tok)} tokens in all</b>` : ""}</div>
    <div class="list">${rows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.c.name)} <span class="pill dim">${esc(seriesOf(r.c) || "Series ?")}</span></div><div class="s y16-wrap">${how(r)}</div></div>${price(r)}</div>`).join("")}</div>
    ${tok ? `<span class="small">${have >= tok ? `You have ${fmt(have)} tokens: enough for all of them.` : `You have ${fmt(have)} tokens: ${fmt(tok - have)} short for all of them.`}</span>` : ""}
    ${Object.keys(S.owned).length ? "" : `<span class="note">No cards are marked as owned yet. Tick the ones you have in Collection and this list shrinks to what you're really missing.</span>`}
    <span class="muted small">Token prices are the Card Shop estimates from Home › Shops. Spotlight cards change every week.</span></div>`;
}

/* ---------- Card picks: owned cards that fit this deck, ranked by how they do in your other decks ---------- */
let _y16sug = { key: "", val: null };
function y16Suggest(d) {
  const sig = `${d.id}|${arr(d.cards).join(",")}|${_mVer}|${saveVer}`;
  if (_y16sug.key === sig && _y16sug.val) return _y16sug.val;
  const inDeck = new Set(arr(d.cards));
  // The deck's main effect: the most common archetype tag (On Reveal alone says little), else its most common tag
  const cnt = {}, all = {};
  arr(d.cards).forEach((k) => cardTags(card(k)).forEach((t) => { all[t] = (all[t] || 0) + 1; if (t !== "R" && ARCH_NAMES[t]) cnt[t] = (cnt[t] || 0) + 1; }));
  let top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) top = Object.entries(all).sort((a, b) => b[1] - a[1])[0];
  const tag = top ? top[0] : "";
  const pool = tag ? allCards().filter((c) => S.owned[c.key] && !inDeck.has(c.key) && !c.upcoming && !c.custom && c.cost !== "?" && cardTags(c).includes(tag)) : [];
  // Tracked games with your other decks: how often each candidate wins when it hits the board
  const ms = realMatches().filter((m) => m.tracked && !(m.deckId === d.id || (!m.deckId && m.deckName === d.name)));
  const perf = {}; if (ms.length && pool.length) cardAnalytics(ms, pool.map((c) => c.key)).forEach((r) => (perf[r.k] = r));
  const list = pool.map((c) => { const r = perf[c.key]; return { c, played: r ? r.played : 0, wr: r && r.played ? r.wr : -1 }; })
    .sort((a, b) => b.wr - a.wr || b.played - a.played || num(a.c.cost) - num(b.c.cost) || a.c.name.localeCompare(b.c.name)).slice(0, 8);
  const val = { tag, label: tag ? TAGS[tag] || ARCH_NAMES[tag] || tag : "", list, owned: Object.keys(S.owned).length };
  _y16sug = { key: sig, val }; return val;
}
function deckSuggestHtml(d) {
  const s = y16Suggest(d);
  if (!s.owned) return `<div class="empty y16-sug"><strong>No owned cards to pick from</strong><span>Tick the cards you have in Collection, then come back for picks that fit this deck.</span></div>`;
  if (!s.list.length) return `<div class="empty y16-sug"><span>${s.label ? `None of the cards you own have this deck's main effect (${esc(s.label)}) and aren't already in it.` : "Add a few cards first, so the picks can match what the deck does."}</span></div>`;
  return `<div class="panel stack y16-sug"><span class="eyebrow">Cards you own that fit · ${esc(s.label)}</span>
    <div class="list">${s.list.map((x) => `<div class="li">${cardChip(x.c.key, { a: "cardOpen", noOwn: true, text: true })}<div class="grow small ${x.wr >= 0 ? "" : "muted"}">${x.wr >= 0 ? `<b class="num ${x.wr >= 50 ? "pos" : "neg"}">${x.wr}%</b> in ${x.played} tracked game${x.played === 1 ? "" : "s"} in other decks` : "Not tracked in your other decks yet"}</div><button class="btn sm" data-a="y16Add" data-k="${esc(x.c.key)}" ${arr(d.cards).length >= 12 ? "disabled" : ""}>${ICON.plus} Add</button></div>`).join("")}</div>
    <span class="muted small">${arr(d.cards).length >= 12 ? "The deck is full: remove a card to add one of these. " : ""}Ranked by your win rate when the card hit the board in your other decks. Picked by card effects, not AI.</span></div>`;
}

/* ---------- Building aids in the deck sheet, under "Add cards": shape, plan, pin, picks, missing cards ---------- */
function deckBuildHtml(d, cs) {
  const keys = arr(cs && cs.length ? cs : d.cards);
  const plan = String(d.plan || "").trim(); const first = plan.split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
  const pinned = deckPinned(d), open = ui.y16Sug === d.id;
  return `${deckShapeHtml(keys)}
    ${first ? `<button class="panel y16-peek" data-a="deckTab" data-v="plan"><span class="eyebrow">Your plan</span><span class="small">${esc(first.slice(0, 140))}</span></button>` : ""}
    <div class="grid2"><button class="btn" data-a="y16Pin" aria-pressed="${pinned}">${pinned ? "Unpin from top" : "Pin to top"}</button><button class="btn" data-a="y16Sug" aria-pressed="${open}">${open ? "Hide card picks" : "Suggest cards"}</button></div>
    ${open ? deckSuggestHtml(d) : ""}
    ${deckMissingHtml(d)}`;
}

/* ---------- Plan tab: mulligan keeps, key turns, when to snap ---------- */
const Y16_PLAN_MAX = 500;
EXT.deckTabs.push(["plan", "Plan", (d) => {
  const plan = String(d.plan || "");
  return `<label class="f">Your gameplan for this deck<textarea id="y16-plan" data-y16plan="1" maxlength="${Y16_PLAN_MAX}" rows="7" placeholder="Keep in your opening hand: …&#10;Key turns: …&#10;Snap when: …&#10;Retreat if: …">${esc(plan)}</textarea></label>
    <div class="row between"><span class="muted small">Saves as you type. The first line shows on the Cards tab.</span><span class="muted small num" id="y16-plan-n">${plan.length} / ${Y16_PLAN_MAX}</span></div>
    ${plan.trim() ? "" : `<p class="note">A few lines to read before a match: which cards to keep in your opening hand, the turn the deck comes alive, and when a snap is safe.</p>`}`;
}]);
let _y16planT = null;
function y16PlanFlush() { clearTimeout(_y16planT); _y16planT = null; save(); }
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.y16plan) return;
  const d = deckEdit(); if (!d) return;
  const v = String(t.value || "").slice(0, Y16_PLAN_MAX); if (v !== t.value) t.value = v;
  if (v.trim()) d.plan = v; else delete d.plan;
  const n = $("#y16-plan-n"); if (n) n.textContent = `${v.length} / ${Y16_PLAN_MAX}`;
  clearTimeout(_y16planT); _y16planT = setTimeout(y16PlanFlush, 500);
});
// Closing the sheet or leaving the page right after typing still saves
document.addEventListener("visibilitychange", () => { if (_y16planT) y16PlanFlush(); });

/* ---------- Trend tab: rolling win rate over the last 20 games ---------- */
const Y16_WIN = 10;
function y16SparkSvg(points) {
  // points: win rate (0–100) after each game, oldest first
  const n = points.length, W = 320, H = 86, L = 8, R = 38, T = 14, B = 74;
  const x = (i) => (n < 2 ? (L + W - R) / 2 : L + (i * (W - R - L)) / (n - 1)), y = (v) => B - ((B - T) * v) / 100;
  const last = points[n - 1], lx = x(n - 1), ly = y(last);
  return `<svg class="y16-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Win rate trend over the last ${n} games, now ${last}%">
    <line x1="${L}" x2="${W - R}" y1="${y(50)}" y2="${y(50)}" style="stroke:var(--line)" stroke-width="1" stroke-dasharray="4 4"/><text x="${W - R + 5}" y="${y(50) + 4}" font-size="10" style="fill:var(--muted)">50%</text>
    ${n > 1 ? `<polyline points="${points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}" fill="none" style="stroke:var(--cube)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" style="fill:var(--cube)"/><text x="${Math.max(L + 14, Math.min(lx, W - R - 14)).toFixed(1)}" y="${(ly < 28 ? ly + 17 : ly - 9).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${last}%</text></svg>`;
}
function deckTrendHtml(d) {
  const all = y16Matches(d).filter((m) => m.result); const ms = all.slice(0, 20).reverse(); // oldest first
  if (!ms.length) return `<div class="empty"><strong>No games with this deck yet</strong><span>Log a few matches with it and the trend shows up here: your rolling win rate, your last results and whether the deck is heating up or cooling off.</span></div>`;
  let prev = 50;
  const pts = ms.map((_, i) => { const w = ms.slice(Math.max(0, i - Y16_WIN + 1), i + 1); const dec = w.filter((m) => m.result !== "T").length; prev = dec ? pct(w.filter((m) => m.result === "W").length, dec) : prev; return prev; });
  const recent = statsFor(all.slice(0, 10)), before = statsFor(all.slice(10, 20)), last20 = statsFor(all.slice(0, 20));
  const tile = (k, v, cls = "") => `<div class="tile"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  const diff = before.games >= 3 && recent.games >= 3 ? recent.wr - before.wr : null;
  const verdict = diff === null ? "A few more games and you'll see whether this deck is heating up or cooling off."
    : diff >= 10 ? `Heating up: ${diff} points better over the last ${recent.games} games than the ${before.games} before.`
    : diff <= -10 ? `Cooling off: ${Math.abs(diff)} points worse over the last ${recent.games} games than the ${before.games} before.`
    : "Steady: about the same as the games before.";
  return `<div class="panel stack"><span class="eyebrow">Win rate · last ${ms.length} game${ms.length === 1 ? "" : "s"}</span>${y16SparkSvg(pts)}
    <div class="y16-res" role="img" aria-label="Results, oldest first: ${ms.map((m) => m.result).join(" ")}">${ms.map((m) => `<span class="r ${m.result === "W" ? "W" : m.result === "L" ? "L" : "T"}" title="${m.result === "W" ? "Win" : m.result === "L" ? "Loss" : "Tie"} · ${esc(signed(num(m.cubes)))} cubes · ${esc(dayStr(m.ts))}"></span>`).join("")}</div>
    <span class="muted small">Each point is your win rate over up to ${Y16_WIN} games ending there (ties left out). The squares below are your results: green wins, red losses, oldest on the left.</span></div>
    <div class="tiles y16-3">${tile("Last 10", recent.games ? recent.wr + "%" : "—")}${tile("10 before", before.games ? before.wr + "%" : "—")}${tile(`Cubes (${last20.games})`, signed(last20.cubes), last20.cubes >= 0 ? "pos" : "neg")}</div>
    <p class="small">${esc(verdict)}</p>`;
}
EXT.deckTabs.push(["trend", "Trend", deckTrendHtml]);

/* ---------- Matchups tab: this deck against each kind of opponent, with tech-card tips ---------- */
// What to bring against each kind of deck: [card, why]. Only cards that exist in the card data are shown.
const Y16_TECH = {
  Destroy: [["Armor", "cards at its location can't be destroyed, so their Carnage or Venom gets nothing there"], ["Cosmo", "On Reveal destroy effects (Carnage, Venom, Killmonger) won't happen at its location"], ["Shang-Chi", "destroys a card with 10 or more power, like a grown Death or Knull"]],
  Discard: [["Shang-Chi", "destroys Apocalypse, Morbius or Dracula once they reach 10 power"], ["Cosmo", "Hela's On Reveal won't happen if she's played at its location"]],
  Ongoing: [["Enchantress", "removes the abilities from every Ongoing card at her location"], ["Rogue", "steals one of their Ongoing abilities at its location for your side"], ["Red Guardian", "removes the text of their lowest-power card at its location"]],
  Buff: [["Red Guardian", "removes the text of their lowest-power card at its location, often the one doing the buffing"], ["Enchantress", "turns off Ongoing power boosts at her location"], ["Valkyrie", "sets every card at her location to 3 power (yours too), wiping out their buffs"]],
  Move: [["Cosmo", "On Reveal movers like Doctor Strange won't work at its location"], ["Valkyrie", "sets every card at her location to 3 power (yours too), so the lane they stacked shrinks"]],
  Ramp: [["Shang-Chi", "destroys the 10+ power card they ramp into"], ["Leech", "removes the text from the 6-cost cards in their hand"], ["Juggernaut", "moves away the cards they just played at its location"]],
  Disrupt: [["Cosmo", "their On Reveal tricks (Shang-Chi, Enchantress) won't happen at its location"], ["Armor", "keeps cards at its location safe from Shang-Chi and Killmonger"]],
  "Card generation": [["Killmonger", "destroys every 1-cost card (yours too), including the small cards they add"], ["Cosmo", "On Reveal abilities that add cards won't happen at its location"]],
  "Gives you cards": [["Cosmo", "On Reveal abilities that hand out cards won't happen at its location"], ["Shang-Chi", "destroys whatever 10+ power card they finish with"]],
  Location: [["Cosmo", "blocks their On Reveal plays at its location"], ["Shang-Chi", "destroys their biggest card if it reaches 10 power"]],
  "Low-cost": [["Killmonger", "destroys every 1-cost card on the board (yours too)"], ["Red Guardian", "shrinks and blanks their weakest card at its location"]],
  "High-cost": [["Shang-Chi", "destroys an enemy card with 10 or more power"], ["Leech", "removes the text from the 6-cost cards in their hand"], ["Spider-Ham", "Activate: blanks a random card in their hand"], ["Valkyrie", "sets every card at her location to 3 power (yours too)"]],
  Mixed: [["Cosmo", "shuts down On Reveal plays at one location"], ["Shang-Chi", "destroys a card with 10 or more power"]],
};
function y16OppArch(m) { if (m.oppArch) return String(m.oppArch); const oc = arr(m.oppCards); return oc.length >= 3 ? archetypeOf(oc) || "" : ""; }
function deckMatchupRows(d) {
  const by = {};
  for (const m of y16Matches(d)) { if (!m.result) continue; const a = y16OppArch(m); if (!a) continue; (by[a] = by[a] || []).push(m); }
  return Object.entries(by).map(([a, list]) => ({ a, list, st: statsFor(list) })).sort((x, y) => y.list.length - x.list.length || x.st.wr - y.st.wr);
}
function deckTechHtml(d, rows) {
  const trouble = rows.filter((r) => r.st.games >= 2 && r.st.w + r.st.l > 0 && r.st.wr < 50).sort((a, b) => a.st.wr - b.st.wr || b.st.games - a.st.games).slice(0, 3);
  if (!trouble.length) return rows.length ? `<p class="small">No kind of deck beats this one yet (2 or more games and under 50%). Nice.</p>` : "";
  const inDeck = new Set(arr(d.cards)); const seen = new Map();
  for (const r of trouble) for (const [name, why] of arr(Y16_TECH[r.a])) {
    const c = cardByName(name); if (!c || c.unknown || c.upcoming || c.hidden) continue;
    const e = seen.get(c.key) || { c, vs: [], why: "" }; if (!e.vs.includes(r.a)) e.vs.push(r.a); if (!e.why) e.why = why; seen.set(c.key, e);
  }
  const picks = [...seen.values()].slice(0, 6);
  const lose = trouble.map((r) => `<b>${esc(r.a)}</b> (${r.st.w}-${r.st.l})`).join(", ");
  if (!picks.length) return `<p class="small muted">You're under 50% against ${lose}, but there's no usual tech card for that kind of deck.</p>`;
  return `<h3>Tech cards to try</h3><p class="small">You're under 50% against ${lose}. Cards that often help:</p>
    <div class="list">${picks.map((p) => `<div class="li y16-tech">${cardChip(p.c.key, { a: "cardOpen", noOwn: true, text: true })}<div class="grow"><div class="s y16-wrap">Vs ${esc(p.vs.join(" and "))}: ${esc(p.why)}</div></div>${inDeck.has(p.c.key) ? `<span class="pill gold">In deck</span>` : S.owned[p.c.key] ? `<span class="pill W">Owned</span>` : `<span class="pill dim">Not owned</span>`}</div>`).join("")}</div>
    <p class="muted small">Rules of thumb from what these cards do, not from your stats. Try swapping one in for a card you rarely play.</p>`;
}
function deckMatchupsHtml(d) {
  const rows = deckMatchupRows(d); const ms = y16Matches(d);
  const table = rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Their deck</th><th class="n">W-L</th><th class="n">Win %</th><th class="n">Cubes</th></tr></thead><tbody>${rows.map((r) => `<tr><td><button class="linkish" data-a="muOpen" data-v="${esc(r.a)}">${esc(r.a)}</button></td><td class="n">${r.st.w}-${r.st.l}${r.st.t ? "-" + r.st.t : ""}</td><td class="n ${r.st.games >= 2 ? (r.st.wr >= 50 ? "pos" : "neg") : ""}">${r.st.wr}%</td><td class="n ${r.st.cubes >= 0 ? "pos" : "neg"}">${signed(r.st.cubes)}</td></tr>`).join("")}</tbody></table></div>
      <p class="muted small">Their deck type is a guess from the cards they showed (3 or more). Tap one for your notes and best cards against it.</p>`
    : `<div class="empty"><strong>${ms.length ? "No opponent decks to compare yet" : "No games with this deck yet"}</strong><span>${ms.length ? "Add at least 3 of the cards your opponent played (in the live tracker or the match form) and their deck type shows up here." : "Play a few matches with it and note the cards your opponents play."}</span></div>`;
  let locs = []; try { locs = typeof locationAnalytics === "function" ? locationAnalytics(ms) : []; } catch { locs = []; }
  const lh = locs.length && typeof locHelpHurt === "function" ? locHelpHurt(locs) : "";
  return `${table}${deckTechHtml(d, rows)}
    <h3>Locations</h3>${lh || `<p class="muted small">${locs.length ? "Once a few locations show up in 2 or more tracked games with this deck, you'll see which ones help it and which hurt it." : "Track games with the live tracker and the locations that help or hurt this deck show up here."}</p>`}`;
}
EXT.deckTabs.push(["matchups", "Matchups", deckMatchupsHtml]);

/* ---------- Versions: did the change help? (called by deckVersionsHtml for each version row) ---------- */
function deckVersionNote(r, rows) {
  if (!r || !r.i) return "";
  const prev = arr(rows).find((x) => x.i === r.i - 1); if (!prev || r.st.games < 3 || prev.st.games < 3) return "";
  const diff = r.st.wr - prev.st.wr;
  return `<div class="small ${diff > 0 ? "pos" : diff < 0 ? "neg" : "muted"}">${diff > 0 ? `Up ${diff} points` : diff < 0 ? `Down ${Math.abs(diff)} points` : "Same win rate"} from version ${prev.i + 1} (${prev.st.wr}% over ${prev.st.games} games)</div>`;
}

/* ---------- Actions ---------- */
Object.assign(A, {
  y16Sort: (el) => { ui.deckSort = el.dataset.v; render(); },
  y16Pin: () => {
    const d = deckEdit(); if (!d) return; const pins = deckPins();
    if (pins.includes(d.id)) { S.deckPins = pins.filter((id) => id !== d.id); toast("Unpinned"); }
    else { if (pins.length >= Y16_PIN_MAX) { toast(`You can pin up to ${Y16_PIN_MAX} decks. Unpin one first.`); return; } S.deckPins = [...pins, d.id]; toast("Pinned to the top of your decks"); }
    save(); render(); refreshSheet();
  },
  y16Sug: () => { const d = deckEdit(); if (!d) return; ui.y16Sug = ui.y16Sug === d.id ? "" : d.id; refreshSheet(); },
  y16Add: (el) => {
    const d = deckEdit(); const k = el.dataset.k; if (!d || !k) return;
    if (arr(d.cards).includes(k)) { toast("Already in this deck"); return; }
    if (arr(d.cards).length >= 12) { toast("This deck is full (12 cards). Remove one first."); return; }
    d.cards.push(k); save(); refreshSheet(); render(); toast(`Added ${card(k).name}`);
  },
  // Duplicate (improves the existing one): the copy keeps the cards, variants, icon, card back, border, tags and plan,
  // is named "Name (copy)" and starts as a draft, so it doesn't mix into your ready decks or their stats.
  deckDup: () => {
    const d = deckEdit(); if (!d) return;
    const extra = { variants: { ...obj(d.variants) } };
    for (const f of ["cover", "coverBorder", "back", "plan"]) if (d[f]) extra[f] = d[f];
    if (deckTags(d).length) extra.tags = [...deckTags(d)];
    const base = String(d.name || "Deck").replace(/\s*\(copy( \d+)?\)$/, "").slice(0, 50); let name = `${base} (copy)`, n = 2;
    while (S.decks.some((x) => x.name === name)) name = `${base} (copy ${n++})`;
    const nd = newDeck(name, d.cards, "draft", extra);
    ui.deckTab = "cards"; ui.y16Sug = ""; render(); openDeck(nd.id); toast("Copied as a draft");
  },
});

/* ---------- Styles ---------- */
EXT.styles.push(`
#sheetBody .seg:has(> button[data-a="deckTab"]:nth-child(6)) { grid-auto-flow: row; grid-template-columns: repeat(5, minmax(0, 1fr)); }
#sheetBody .seg:has(> button[data-a="deckTab"]:nth-child(6)) button { font-size: 12.5px; text-transform: none; letter-spacing: 0; padding: 8px 2px; }
.y16-sort { align-items: center; }
.y16-sortl { align-self: center; flex: none; padding-right: 2px; }
.li .s.y16-info { white-space: normal; overflow: visible; text-overflow: clip; margin-top: 2px; line-height: 1.5; }
.y16-info .pill { font-size: 11px; padding: 1px 7px; vertical-align: 1px; }
.y16-curve { width: 100%; height: auto; max-height: 130px; display: block; font-family: var(--ui); }
.y16-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.y16-stat { display: flex; flex-direction: column; gap: 1px; background: var(--surface-2); border-radius: 10px; padding: 6px 8px; min-width: 0; }
.y16-stat .k { font-family: var(--ui); font-size: 12px; color: var(--muted); font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
.y16-stat b { font-size: 17px; }
.li .s.y16-wrap, .y16-wrap { white-space: normal; overflow: visible; text-overflow: clip; }
.y16-nw { white-space: nowrap; flex: none; }
.y16-spark { width: 100%; height: auto; max-height: 110px; display: block; font-family: var(--ui); }
.tiles.y16-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.tiles.y16-3 .tile { padding: 10px; }
.y16-tags { gap: 6px; }
.y16-res { display: flex; flex-wrap: wrap; gap: 4px; }
.y16-res .r { width: 13px; height: 13px; border-radius: 3px; background: var(--tie); }
.y16-res .r.W { background: var(--win); } .y16-res .r.L { background: var(--loss); }
.y16-peek { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: left; width: 100%; border-left: 3px solid var(--snap-b); cursor: pointer; color: inherit; font: inherit; }
.y16-peek .small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.y16-tech { align-items: flex-start; }
.y16-tech > .cchip, .y16-sug .li > .cchip { flex: none; max-width: 48%; }
`);
