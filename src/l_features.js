/* ============ More features: insights, albums, planner, splits, deck versions, synergy, deck links,
   quick log, the alliance week, tournaments, community card stats and screenshot reading ============ */
const pad2 = (n) => String(n).padStart(2, "0");
const MODES = ["Ranked", "Conquest", "Friendly", "Draft", "High Voltage", "Deadpool's Diner", "Sanctum Showdown", "Event", "Limited-time mode", "Other"];
const modeOf = (m) => (m && m.mode) || "Ranked";
const APP_URL = window.SNAPSTAT_STANDALONE ? location.origin + location.pathname : "https://rhaddaddy.github.io/snap-stat/";
function progBar(have, of, label) { return `<div class="bar" role="img" aria-label="${esc(label || `${have} of ${of}`)}"><i style="width:${barW(num(have), num(of))}%"></i></div>`; }
const avgCubes = (list) => (list.length ? Math.round((list.reduce((s, m) => s + num(m.cubes), 0) / list.length) * 10) / 10 : 0);
const winPct = (list) => pct(list.filter((m) => m.result === "W").length, list.filter((m) => m.result !== "T").length);
// Wins + losses: a list of only ties has no win % ("—"), not 0%
const decidedN = (list) => list.filter((m) => m.result === "W" || m.result === "L").length;
const plural = (n, w, many) => `${fmt(n)} ${n === 1 ? w : many || w + "s"}`;

/* ============ Rank climb ============ */
// Cubes per rank: 7 in the game (the home screen shows 4/7). Infinite is rank 100. (It used to be read from screenshots,
// and one misread changed the maths for every match after it.)
function cpr() { return 7; }
function seasonAt(ts) { return seasons().find((s) => ts >= s.startTs && ts <= s.endTs) || null; }
function rankFromStr(r) { const s = String(r || "").trim(); if (/^inf/i.test(s)) return 100; const n = parseInt(s, 10); return n >= 1 && n <= 100 ? n : 0; }
const rankStr = (r) => (r >= 100 ? "Infinite" : String(r));
// Where a new season starts you (the game's help page): Infinite → 75, 90–99 → 73, 80–89 → 65, 70–79 → 63, 60–69 → 55,
// 53–59 → 53, and rank 52 or below stays where it is.
const seasonReset = (r) => (r >= 100 ? 75 : r >= 90 ? 73 : r >= 80 ? 65 : r >= 70 ? 63 : r >= 60 ? 55 : r >= 53 ? 53 : Math.max(1, r));
function climbNow() {
  const c = obj(S.climb); if (!c.at) return null;
  let total = clamp(num(c.rank), 1, 100) * cpr() + clamp(num(c.cubes), 0, cpr() - 1);
  let peak = total, games = 0, floor10 = total >= 10 * cpr();
  const base = seasonAt(c.at), endTs = base ? base.endTs : Infinity;
  const ms = realMatches().filter((m) => m.ts > c.at && m.ts <= endTs && modeOf(m) === "Ranked").sort((a, b) => a.ts - b.ts);
  for (const m of ms) {
    if (total >= 100 * cpr()) break;
    total = Math.min(100 * cpr(), Math.max(floor10 ? 10 * cpr() : cpr(), total + num(m.cubes)));
    if (total >= 10 * cpr()) floor10 = true;
    peak = Math.max(peak, total); games++;
  }
  const cur = currentSeason();
  const stale = !!(cur && ((base && cur.id !== base.id) || (!base && c.at < cur.startTs)));
  const rank = Math.floor(total / cpr());
  return { rank, cubes: rank >= 100 ? 0 : total % cpr(), inf: rank >= 100, peak: Math.floor(peak / cpr()), games, stale };
}
/* Peak ranks: each season keeps its own (it starts again from your rank in the new season), and there's an all-time best.
   A peak never goes down. S.me.peak is this season's; S.me.peakAll is the best ever. */
function notePeak(rank) {
  const rk = typeof rank === "number" ? Math.round(rank) : rankFromStr(rank); if (!(rk >= 1 && rk <= 100)) return false;
  const cs = currentSeason(), sid = cs ? cs.id : "";
  if (S.me.peakSeason !== sid) { S.me.peakSeason = sid; S.me.peak = cs && obj(S.ranks["s:" + sid]).peak ? S.ranks["s:" + sid].peak : ""; }
  let changed = false;
  if (rk > rankFromStr(S.me.peak)) { S.me.peak = rankStr(rk); changed = true; }
  if (cs) { const rr = (S.ranks["s:" + sid] = obj(S.ranks["s:" + sid])); if (rk > rankFromStr(rr.peak)) { rr.peak = rankStr(rk); changed = true; } }
  if (rk > rankFromStr(S.me.peakAll)) { S.me.peakAll = rankStr(rk); S.me.peakAllAt = Date.now(); S.me.peakAllSeason = cs ? cs.name : ""; changed = true; }
  return changed;
}
// After a match is undone or deleted: a peak only that match's cubes reached goes back down
function peakFixAfterRemoval(st0, m) {
  const st1 = climbNow(); if (!st0 || !st1 || st0.stale || st1.stale || !(st1.peak < st0.peak)) return;
  const was = rankStr(st0.peak), now = rankStr(Math.max(st1.peak, st1.rank, num(obj(S.climb).rank)));
  const cs = currentSeason();
  if (S.me.peak === was) S.me.peak = now;
  if (cs) { const rr = obj(S.ranks["s:" + cs.id]); if (rr.peak === was) rr.peak = now; }
  if (S.me.peakAll === was && num(S.me.peakAllAt) >= num(m && m.ts) - 60e3) S.me.peakAll = now;
}
function removeMatchFix(id) { const m = allMatches().find((x) => x.id === id) || null, st0 = climbNow(); removeMatch(id); syncRankFromClimb(); peakFixAfterRemoval(st0, m); }
// The all-time peak also counts every season you've recorded
function peakAllTime() { let best = rankFromStr(S.me.peakAll); for (const r of Object.values(obj(S.ranks))) best = Math.max(best, rankFromStr(obj(r).peak), rankFromStr(obj(r).end)); return best ? rankStr(best) : ""; }
function syncRankFromClimb() {
  const st = climbNow(); if (!st || st.stale) return false;
  const r = rankStr(st.rank), cs = currentSeason();
  // The replay's peak only counts this season if the rank it starts from was seen this season
  const inSeason = !cs || num(obj(S.climb).at) >= cs.startTs;
  const before = JSON.stringify([S.me.rank, S.me.peak, S.me.peakAll, cs ? S.ranks["s:" + cs.id] : null]);
  S.me.rank = r; notePeak(st.rank); if (inSeason) notePeak(st.peak);
  if (cs) { const rr = (S.ranks["s:" + cs.id] = obj(S.ranks["s:" + cs.id])); rr.end = r; }
  return JSON.stringify([S.me.rank, S.me.peak, S.me.peakAll, cs ? S.ranks["s:" + cs.id] : null]) !== before;
}
function onMatchSaved(m) { const a = syncRankFromClimb(), b = afterMatchChecks(m); if (a || b) save(); }
/* One-tap save from Quick log (and voice logging). */
function quickSaveMatch(r, c, extra = {}) {
  const q = obj(S.quick); const last = realMatches()[0];
  const deckId = q.deckId !== undefined ? q.deckId : last ? last.deckId || "" : ""; const mode = q.mode || (last ? modeOf(last) : "Ranked");
  const d = S.decks.find((x) => x.id === deckId);
  // Outside Ranked the buttons don't ask for cubes: like a screenshot without cubes, it's left out of cubes per game
  const m = { id: uid(), ts: Date.now(), result: r, cubes: r === "W" ? c : r === "L" ? -c : 0, ...(mode !== "Ranked" && !c ? { noCubes: true } : {}), mode, deckId: d ? d.id : "", deckName: d ? d.name : "", oppName: "", oppCards: [], snapped: !!qk.f.snapped, oppSnapped: !!qk.f.oppSnapped, retreated: !!qk.f.retreated, oppRetreated: !!qk.f.oppRetreated, turn: 6, bot: "unsure", notes: "", quick: true, ...extra };
  putMatch(m); S.quick = { ...q, deckId: m.deckId, mode }; syncRankFromClimb(); afterMatchChecks(m); save(); qk.last = m; qk.f = {}; refreshSheet(); render();
  toast(`${r === "W" ? "Win" : r === "L" ? "Loss" : "Tie"} saved${c ? ` (${signed(m.cubes)})` : ""}`);
  return m;
}
// "No cubes" means the cubes weren't known: once a match is saved with cubes (you added them in the match form), they count
EXT.onMatch.push((m) => { if (m && m.noCubes && num(m.cubes)) delete m.noCubes; });
function climbPace() {
  const ranked = realMatches().filter((m) => modeOf(m) === "Ranked");
  const recent = ranked.slice(0, 50);
  const last14 = ranked.filter((m) => m.ts >= Date.now() - 14 * DAY);
  const span = last14.length ? Math.max(1, Math.min(14, (Date.now() - Math.min(...last14.map((m) => m.ts))) / DAY)) : 0;
  return { cpg: recent.length ? recent.reduce((s, m) => s + num(m.cubes), 0) / recent.length : 0, gpd: span ? last14.length / span : 0, n: recent.length };
}
function climbForm(st) {
  const r = st ? st.rank : rankFromStr(S.me.rank) || "", c = st ? st.cubes : "";
  return `<div class="panel stack"><p class="small">Enter your rank from the game. Ranked matches you log after this move it up and down by their cubes, so your rank stays current here and on your profile.</p>
    <div class="grid2"><label class="f">Rank now (1–100)<input type="number" id="cl-rank" min="1" max="100" inputmode="numeric" value="${esc(r)}"></label><label class="f">Cubes into this rank (0–${cpr() - 1})<input type="number" id="cl-cubes" min="0" max="${cpr() - 1}" inputmode="numeric" value="${esc(c)}"></label></div>
    <div class="row"><button class="btn snap" data-a="climbSave">Save rank</button>${st ? `<button class="btn ghost" data-a="climbCancel">Cancel</button>` : ""}</div>
    <p class="muted small">${cpr()} cubes = 1 rank, and from rank 10 every 10 ranks is a new tier (Iron, Bronze, Silver…). Infinite is rank 100.</p></div>`;
}
function climbPanel() {
  const st = climbNow();
  if (!st || ui.climbEdit) return climbForm(st);
  if (st.stale) {
    const sug = seasonReset(st.rank);
    return `<div class="panel stack"><b>A new season started</b><p class="small">Last season you reached rank ${esc(rankStr(st.rank))}. ${sug < st.rank ? "A new season moves high ranks down" : "Your rank doesn't drop in a new season"}, so you start this season at rank ${sug}.</p>
      <div class="row"><button class="btn snap" data-a="climbReset" data-v="${sug}">Start at rank ${sug}</button><button class="btn" data-a="climbEdit">Enter my rank</button></div></div>`;
  }
  const cs = currentSeason();
  if (st.inf) return `<div class="panel stack halftone"><div class="row between"><b style="font-size:20px">Infinite</b>${rankBadge("Infinite")}</div><p class="small">You made it to the top rank${cs ? " this season" : ""}. Nice climbing.</p><div><button class="btn sm ghost" data-a="climbEdit">Change rank</button></div></div>`;
  const need = (100 - st.rank) * cpr() - st.cubes; const pace = climbPace();
  const cpg = Math.round(pace.cpg * 100) / 100, games = cpg > 0 ? Math.ceil(need / cpg) : 0;
  const days = games && pace.gpd ? Math.ceil(games / pace.gpd) : 0;
  const left = cs ? Math.max(0, (cs.endTs - Date.now()) / DAY) : 0;
  let track = "";
  if (cs && pace.n >= 5) {
    if (days && days <= left) track = `<span class="pill W">On track for Infinite before the season ends</span>`;
    else if (left >= 1 && cpg > 0) { const gpdNeed = Math.ceil(need / cpg / left); track = `<span class="pill warn">To reach Infinite this season: about ${gpdNeed} games a day</span>`; }
    else if (cpg <= 0) track = `<span class="pill warn">You're not gaining cubes lately</span>`;
  }
  return `<div class="panel stack"><div class="row between"><div><div class="eyebrow">Rank now</div><b class="num" style="font-size:30px">${st.rank}</b> <span class="muted small">${st.cubes}/${cpr()} cubes</span></div>${rankBadge(String(st.rank))}</div>
    ${progBar(st.cubes, cpr(), `${st.cubes} of ${cpr()} cubes to the next rank`)}
    <div class="tiles"><div class="tile"><div class="k">Cubes to Infinite</div><div class="v">${fmt(need)}</div></div>
      <div class="tile"><div class="k">Cubes a game</div><div class="v ${cpg >= 0 ? "pos" : "neg"}">${pace.n ? signed(cpg) : "—"}</div></div>
      <div class="tile"><div class="k">Games to go</div><div class="v">${games ? "≈" + fmt(games) : "—"}</div></div>
      <div class="tile"><div class="k">Days at your pace</div><div class="v">${days ? "≈" + fmt(days) : "—"}</div></div></div>
    ${track}
    <p class="muted small">${pace.n ? `Pace from your last ${plural(pace.n, "Ranked game")}${pace.gpd ? `, about ${Math.round(pace.gpd * 10) / 10} a day` : ""}.` : "Log Ranked matches to see your pace."}${cs ? ` Season ${endsTxt(cs.endTs)}.` : ""} Check it against the game now and then: a match you forget to log makes it drift.</p>
    <div><button class="btn sm ghost" data-a="climbEdit">Fix rank</button></div></div>`;
}

/* ============ Snap & retreat coach ============ */
function coachHtml(ms) {
  const g = ms.filter((m) => ["W", "L", "T"].includes(m.result));
  if (g.length < 8) return `<p class="muted small">Log at least 8 matches${g.length ? ` (${g.length} so far)` : ""} to get snap and retreat tips.</p>`;
  const sn = g.filter((m) => m.snapped), ns = g.filter((m) => !m.snapped);
  const ret = g.filter((m) => m.retreated), full = g.filter((m) => m.result === "L" && !m.retreated);
  const os = g.filter((m) => m.oppSnapped), osStay = os.filter((m) => !m.retreated), osRet = os.filter((m) => m.retreated);
  const wins = g.filter((m) => m.result === "W"); const snapRate = pct(sn.length, g.length);
  const tips = [];
  if (decidedN(sn) >= 3 && winPct(sn) >= 60 && snapRate < 30) tips.push(`You win ${winPct(sn)}% of the games you snap, but you only snap in ${snapRate}% of them. Snapping more when you're ahead earns more cubes.`);
  if (decidedN(sn) >= 5 && winPct(sn) < 45) tips.push(`You win just ${winPct(sn)}% of the games you snap. Try snapping a turn later, once you've seen more of their cards.`);
  if (full.length >= 4 && avgCubes(full) <= -3) tips.push(`Losses you play to the end cost ${-avgCubes(full)} cubes each on average. Retreat sooner when you can't win two locations.`);
  if (decidedN(osStay) >= 3 && winPct(osStay) < 45) tips.push(`When they snap and you stay in, you win ${winPct(osStay)}% and average ${signed(avgCubes(osStay))} cubes. Retreating more often after their snap would save cubes.`);
  if (decidedN(osStay) >= 3 && winPct(osStay) >= 60) tips.push(`You win ${winPct(osStay)}% of games where they snap and you stay. Their snap is often a bluff against you.`);
  if (wins.length >= 5 && avgCubes(wins) < 2.5) tips.push(`Your wins average only ${signed(avgCubes(wins))} cubes. Snapping when you're confident doubles what a win is worth.`);
  if (ret.length >= 5 && full.length * 3 < ret.length && pct(ret.length, g.length) > 35) tips.push(`You retreat from ${pct(ret.length, g.length)}% of games. Playing out a few more close ones could turn some into wins.`);
  const timed = sn.filter((m) => num(m.snapTurn) > 0);
  const buckets = [["Turns 1–3", (t) => t <= 3], ["Turns 4–5", (t) => t >= 4 && t <= 5], ["Turn 6+", (t) => t >= 6]].map(([l, f]) => { const list = timed.filter((m) => f(num(m.snapTurn))); return { l, list }; }).filter((b) => b.list.length);
  const early = buckets.find((b) => b.l === "Turns 1–3"), late = buckets.find((b) => b.l === "Turn 6+");
  if (early && late && decidedN(early.list) >= 3 && decidedN(late.list) >= 3 && winPct(early.list) + 15 < winPct(late.list)) tips.push(`Your early snaps win ${winPct(early.list)}%, your turn 6 snaps ${winPct(late.list)}%. Waiting a bit pays off for you.`);
  if (!tips.length) tips.push("Your snapping and retreating look balanced. Keep logging matches to spot patterns.");
  const tile = (k, v, cls = "") => `<div class="tile"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  return `<div class="tiles">${tile("You snap", snapRate + "%")}${tile("Win % when you snap", decidedN(sn) ? winPct(sn) + "%" : "—")}${tile("Win % when you don't", decidedN(ns) ? winPct(ns) + "%" : "—")}
    ${tile("Avg cubes when you snap", sn.length ? signed(avgCubes(sn)) : "—")}${tile("Avg cost of a retreat", ret.length ? signed(avgCubes(ret)) : "—")}${tile("Avg cost of a full loss", full.length ? signed(avgCubes(full)) : "—")}
    ${tile("Win % when they snap", decidedN(os) ? winPct(os) + "%" : "—")}${tile("You retreat after their snap", os.length ? pct(osRet.length, os.length) + "%" : "—")}</div>
    <div class="panel stack"><span class="eyebrow">Tips from your games</span><ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
    ${buckets.length ? `<div class="tbl-wrap"><table><thead><tr><th>You snapped on</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Avg cubes</th></tr></thead><tbody>${buckets.map((b) => `<tr><td>${b.l}</td><td class="n">${b.list.length}</td><td class="n">${decidedN(b.list) ? winPct(b.list) + "%" : "—"}</td><td class="n">${signed(avgCubes(b.list))}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">Tick “You snapped” in the live tracker when you snap and the app also learns which turn works best for you.</p>`}`;
}

/* ============ Matchups ============ */
const ARCH_NAMES = { D: "Destroy", X: "Discard", M: "Move", O: "Ongoing", B: "Buff", P: "Ramp", C: "Disrupt", S: "Card generation", J: "Gives you cards", L: "Location" };
function cardTags(c) { return c && arr(c.tags).length ? c.tags : tagsFrom(c ? c.ability : ""); }
function archetypeOf(names) {
  const cs = arr(names).map((n) => cardByName(n)).filter(Boolean); if (cs.length < 2) return "";
  const cnt = {}; cs.forEach((c) => cardTags(c).forEach((t) => { if (t !== "R" && ARCH_NAMES[t]) cnt[t] = (cnt[t] || 0) + 1; }));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) return ARCH_NAMES[top[0]];
  const avg = cs.reduce((s, c) => s + num(c.cost), 0) / cs.length;
  return avg <= 2.5 ? "Low-cost" : avg >= 4 ? "High-cost" : "Mixed";
}
function matchupsHtml(ms) {
  const g = ms.filter((m) => arr(m.oppCards).length && m.result);
  if (g.length < 3) return `<p class="muted small">Add the cards your opponents play (in the live tracker or the match form) to see which decks and cards give you trouble.</p>`;
  const by = {}; for (const m of g) { const a = m.oppArch || archetypeOf(m.oppCards) || "Too few cards seen"; (by[a] = by[a] || []).push(m); }
  const arch = Object.entries(by).map(([a, list]) => ({ a, list })).sort((x, y) => y.list.length - x.list.length);
  const cards = {}; for (const m of g) for (const n of new Set(arr(m.oppCards))) { const r = (cards[n] = cards[n] || []); r.push(m); }
  const crow = Object.entries(cards).filter(([, l]) => l.length >= 3).map(([n, l]) => ({ n, l, wr: winPct(l) }));
  const worst = crow.filter((r) => decidedN(r.l) && r.wr < 50).sort((a, b) => a.wr - b.wr || b.l.length - a.l.length).slice(0, 8), best = crow.filter((r) => decidedN(r.l) && r.wr >= 50).sort((a, b) => b.wr - a.wr || b.l.length - a.l.length).slice(0, 5);
  const ctab = (rows) => `<div class="tbl-wrap"><table><thead><tr><th>Their card</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Cubes</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.n)}</td><td class="n">${r.l.length}</td><td class="n ${r.wr >= 50 ? "pos" : "neg"}">${r.wr}%</td><td class="n">${signed(r.l.reduce((s, m) => s + num(m.cubes), 0))}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="tbl-wrap"><table><thead><tr><th>Their deck type</th><th class="n">Games</th><th class="n">W-L</th><th class="n">Win %</th><th class="n">Cubes</th></tr></thead><tbody>${arch.map(({ a, list }) => { const s = statsFor(list); return `<tr><td>${/^Too few/.test(a) ? esc(a) : `<button class="linkish" data-a="muOpen" data-v="${esc(a)}">${esc(a)}</button>`}</td><td class="n">${s.games}</td><td class="n">${s.w}-${s.l}</td><td class="n">${s.w + s.l ? s.wr + "%" : "—"}</td><td class="n ${s.cubes >= 0 ? "pos" : "neg"}">${signed(s.cubes)}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="muted small">Deck type is a guess from the effects of the cards they showed. Tap one for your best decks and cards against it, and to keep notes.</p>
    ${worst.length ? `<h3>Cards that beat you</h3>${ctab(worst)}` : crow.length ? "" : `<p class="muted small">Once you've seen a card in 3 or more games, you'll see how you do against it.</p>`}
    ${best.length ? `<h3>Cards you beat</h3>${ctab(best)}` : ""}`;
}
/* Stats for each game mode, grouped: Ranked, Conquest and Friendly, then events and limited-time modes, with an overall row */
const STD3 = ["Ranked", "Conquest", "Friendly"];
const isEventMode = (mo) => !STD3.includes(mo);
function modesHtml(ms) {
  if (!ms.length) return `<p class="muted small">No matches in this period.</p>`;
  const by = {}; ms.forEach((m) => (by[modeOf(m)] = by[modeOf(m)] || []).push(m));
  const ev = Object.entries(by).filter(([mo]) => isEventMode(mo)).sort((a, b) => b[1].length - a[1].length);
  const row = (label, list, opts = {}) => {
    const s = statsFor(list), cubed = list.filter((m) => !m.noCubes && num(m.cubes)), med = list.reduce((t, m) => t + num(m.medals), 0);
    const reward = cubed.length ? signed(cubed.reduce((t, m) => t + num(m.cubes), 0)) : med ? `${signed(med)} medals` : "—";
    const name = opts.v !== undefined ? `<button class="linkish" data-a="homeMode" data-v="${esc(opts.v)}" style="background:none;border:0;padding:0;color:inherit;text-decoration:underline;text-align:left">${esc(label)}</button>` : esc(label);
    return `<tr${opts.bold ? ' style="font-weight:700"' : ""}><td>${opts.sub ? "<span class=\"muted\">↳</span> " : ""}${name}</td><td class="n">${s.games}</td><td class="n">${s.w}-${s.l}-${s.t}</td><td class="n">${s.w + s.l ? s.wr + "%" : "—"}</td><td class="n ${cubed.length ? (s.cubes >= 0 ? "pos" : "neg") : med ? (med >= 0 ? "pos" : "neg") : ""}">${reward}</td><td class="n">${s.snaps ? `${s.snapWr}%` : "—"}</td></tr>`;
  };
  const rows = [row("Overall", ms, { bold: true, v: "" }), ...STD3.filter((mo) => by[mo]).map((mo) => row(mo, by[mo], { v: mo }))];
  if (ev.length) { rows.push(row("Events & other modes", ev.flatMap(([, l]) => l), { v: "@events", bold: ev.length > 1 })); if (ev.length > 1 || ev[0][0] !== "Event") ev.forEach(([mo, l]) => rows.push(row(mo, l, { v: mo, sub: true }))); }
  return `<div class="tbl-wrap"><table><thead><tr><th>Mode</th><th class="n">Games</th><th class="n">W-L-T</th><th class="n">Win %</th><th class="n">Cubes</th><th class="n">Snap win</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <p class="muted small">Tap a mode to see all your stats for just that mode. Cubes are Ranked only; Conquest shows medals.</p>`;
}
function modeChips(ms) {
  const modes = [...new Set(ms.map(modeOf))];
  if (modes.length < 2 && !ui.homeMode) return "";
  const c = (v, l) => `<button class="chip" data-a="homeMode" data-v="${esc(v)}" aria-pressed="${(ui.homeMode || "") === v}">${esc(l)}</button>`;
  const std = STD3.filter((m) => modes.includes(m)), ev = modes.filter(isEventMode);
  return `<div class="chips" role="group" aria-label="Mode">${c("", "All modes")}${std.map((m) => c(m, m)).join("")}${ev.length ? c("@events", "Events & other") : ""}${ev.length > 1 ? ev.map((m) => c(m, m)).join("") : ""}</div>`;
}
const byMode = (ms) => (ui.homeMode === "@events" ? ms.filter((m) => isEventMode(modeOf(m))) : ui.homeMode ? ms.filter((m) => modeOf(m) === ui.homeMode) : ms);
function vInsights(opt = {}) {
  const p = periodById(ui.period); const all = inPeriod(allMatches(), p);
  const used = S.decks.filter((d) => all.some((m) => m.deckId === d.id));
  if (ui.insDeck && !used.some((d) => d.id === ui.insDeck)) ui.insDeck = "";
  const ms = byMode(ui.insDeck ? all.filter((m) => m.deckId === ui.insDeck) : all);
  const dc = (v, l) => `<button class="chip" data-a="insDeck" data-v="${esc(v)}" aria-pressed="${(ui.insDeck || "") === v}">${esc(l)}</button>`;
  return `<section class="sec"><h2>Rank climb</h2>${climbPanel()}</section>
    <section class="sec"><h2>Your games</h2>${opt.noChips ? "" : periodChips() + modeChips(all)}${used.length > 1 ? `<div class="chips" role="group" aria-label="Deck">${dc("", "All decks")}${used.map((d) => dc(d.id, d.name)).join("")}</div>` : ""}${exampleNote(ms)}${realMatches().length ? `<div class="row"><button class="btn sm" data-a="recapOpen">Make a recap picture</button><button class="btn sm ghost" data-a="csvMatches">Download as a spreadsheet</button></div>` : ""}</section>
    <section class="sec"><div class="sec-h"><h2>Snap & retreat coach</h2><button class="btn sm snap" data-a="coachOpen">${ICON.spark} Ask the coach</button></div>${coachHtml(ms)}</section>
    <section class="sec"><h2>Matchups</h2>${matchupsHtml(ms)}</section>
    <section class="sec"><h2>Rivals</h2>${rivalsHtml()}</section>
    ${sessionsHtml()}
    <section class="sec"><h2>Modes</h2>${modesHtml(inPeriod(allMatches(), p))}</section>
    ${communitySection()}`;
}

/* ============ Location tips in the live tracker ============ */
function locTip(name, deckId) {
  const k = keyOf(name); if (!k || k.length < 3) return "";
  let games = 0, lw = 0, ll = 0, dg = 0, dw = 0, dl = 0; const here = {};
  for (const m of allMatches()) {
    if (!m.tracked) continue;
    arr(m.locs).forEach((L, i) => {
      if (keyOf(L.name) !== k) return;
      const won = num(L.my) > num(L.opp), lost = num(L.my) < num(L.opp);
      games++; if (won) lw++; else if (lost) ll++;
      if (deckId && m.deckId === deckId) { dg++; if (won) dw++; else if (lost) dl++; }
      arr(m.plays).filter((p) => num(p.loc) === i).forEach((p) => { const r = (here[p.k] = here[p.k] || { n: 0, won: 0 }); r.n++; if (won) r.won++; });
    });
  }
  if (!games) return locByName(name) ? `<div class="ltip">No tracked games here yet</div>` : "";
  const best = Object.entries(here).filter(([, r]) => r.n >= 2).sort((a, b) => b[1].won / b[1].n - a[1].won / a[1].n || b[1].n - a[1].n)[0];
  return `<div class="ltip">You win it ${pct(lw, lw + ll)}% · ${plural(games, "game")}${dw + dl ? ` · this deck ${pct(dw, dw + dl)}%` : ""}${best ? ` · best here: ${esc(card(best[0]).name)}` : ""}</div>`;
}

/* ============ Albums ============ */
let ALB = null, albVer = 0; const ALB_CACHE = "snapstat.albums";
function useAlbums(j, fromCache) {
  if (!j || typeof j.albums !== "object" || Object.keys(obj(j.albums)).length < 5) return false;
  if (ALB && fromCache) return false;
  ALB = { updated: String(j.updated || ""), albums: obj(j.albums), splits: arr(j.splits) }; albVer++;
  refreshView(); return true;
}
async function loadAlbums() {
  if (!window.SNAPSTAT_STANDALONE) return;
  try { const c = localStorage.getItem(ALB_CACHE); if (c) useAlbums(JSON.parse(c), true); } catch { /* no saved copy */ }
  for (const u of catUrls("albums.json")) {
    try {
      const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
      const text = await r.text(); const j = JSON.parse(text);
      if (ALB && j.updated && j.updated === ALB.updated) return;
      if (!useAlbums(j, false)) continue;
      try { localStorage.setItem(ALB_CACHE, text); } catch { /* fetched again next time */ }
      return;
    } catch { /* try the next copy */ }
  }
}
let _sfSig = "", _sfMap = new Map();
/* snap.fan names variants Card_NN; the card data's variant with the same order is the same one. */
function sfVarMap() {
  allCards(); const sig = `${catVer}|${vdVer}`; if (sig === _sfSig) return _sfMap;
  _sfMap = new Map(); for (const cv of _catVars.values()) _sfMap.set(`${String(cv.cat).split(":")[0]}_${pad2(cv.order)}`, cv);
  _sfSig = sig; return _sfMap;
}
let _vbcArr = null, _vbc = null;
function variantsByCat() { const all = allVariants(); if (all !== _vbcArr) { _vbc = new Map(all.filter((v) => v.cat).map((v) => [v.cat, v])); _vbcArr = all; } return _vbc; }
function albumInfo(key) {
  const a = obj(ALB.albums[key]); const map = sfVarMap();
  const byCat = variantsByCat();
  const vars = arr(a.variants).map((id) => { const cv = map.get(id); const v = cv ? byCat.get(cv.cat) : null; return { id, v, owned: !!(v && v.owned) }; });
  const have = vars.filter((x) => x.owned).length;
  const rewards = arr(a.rewards).map((r) => { const [need, of] = String(r.at).split("/").map(Number); return { ...r, need: num(need), of: num(of), got: have >= num(need) && num(need) > 0 }; });
  const goal = Math.max(0, ...rewards.map((r) => r.of)) || vars.length;
  return { key, name: String(a.name || key), date: String(a.date || ""), vars, have: Math.min(have, goal || have), goal, rewards, next: rewards.find((r) => !r.got) };
}
const rewardText = (r) => arr(r.items).map((i) => i.name + (i.type && !keyOf(i.name).includes(keyOf(i.type)) ? ` (${i.type})` : "")).join(" + ") || "Reward";
function vAlbums() {
  if (!ALB) return `<section class="sec"><div class="empty"><strong>${window.SNAPSTAT_STANDALONE ? "Loading albums…" : "Albums are in the full app"}</strong><span>Variant albums, their rewards and your progress load from the daily card data${window.SNAPSTAT_STANDALONE ? "" : " in the SNAP Stat web app"}.</span></div></section>`;
  const today = localDate(Date.now());
  const list = Object.keys(ALB.albums).map(albumInfo).filter((a) => showSoon() || !a.date || a.date <= today || a.have).sort((a, b) => b.date.localeCompare(a.date));
  const f = ui.albFilter || "progress";
  const tests = { progress: (a) => a.have > 0 && a.have < a.goal, todo: (a) => a.have === 0, done: (a) => a.goal && a.have >= a.goal, all: () => true };
  const shown = list.filter(tests[f] || tests.all);
  const ch = (v, l) => `<button class="chip" data-a="albFilter" data-v="${v}" aria-pressed="${f === v}">${l} <span class="num muted">${list.filter(tests[v]).length}</span></button>`;
  return `<section class="sec"><div class="sec-h"><h2>Variant albums</h2><span class="muted small">${list.length} albums</span></div>
    <div class="chips">${ch("progress", "In progress")}${ch("todo", "Not started")}${ch("done", "Complete")}${ch("all", "All")}</div>
    ${shown.length ? `<div class="list">${shown.map((a) => `<button class="li" data-a="albumOpen" data-id="${esc(a.key)}"><div class="grow" style="min-width:0"><div class="t">${esc(a.name)}${a.date > today ? ` <span class="pill gold">Soon</span>` : ""}</div><div class="s">${a.next ? `Next at ${a.next.need}: ${esc(rewardText(a.next))}` : a.goal ? "All rewards collected" : "No rewards listed"}${a.date ? " · " + esc(dateStr(a.date)) : ""}${albumGameNote(a) ? ` · <b>${esc(albumGameNote(a))}</b>` : ""}</div>${progBar(a.have, a.goal, `${a.have} of ${a.goal} collected`)}</div><span class="num small">${a.have}/${a.goal}</span></button>`).join("")}</div>`
      : `<div class="empty"><span>${f === "progress" ? "No albums in progress. Tick the variants you own and albums you've started show up here." : "None here."}</span></div>`}
    <p class="muted small">Albums and rewards come from snap.fan and update daily. Progress counts the variants you've marked as owned.</p></section>`;
}
function albumSheet(key) {
  return () => {
    if (!ALB || !ALB.albums[key]) return sheetHead("Album not found");
    const a = albumInfo(key);
    return `${sheetHead(esc(a.name), `${a.have} of ${a.goal} collected${a.date ? " · " + esc(dateStr(a.date)) : ""}`)}${progBar(a.have, a.goal)}${albumGameNote(a) ? `<p class="note small">${esc(albumGameNote(a))}. Screenshot the album in the game (or open it with the tracker on) and the ones you have get ticked.</p>` : ""}
      <h3>Rewards</h3>${a.rewards.length ? `<div class="list">${a.rewards.map((r) => `<div class="li"><span class="pill ${r.got ? "W" : "dim"}">${esc(r.at)}</span><div class="grow"><div class="t">${esc(rewardText(r))}</div></div>${r.got ? `<span aria-label="Collected">✓</span>` : `<span class="muted small">${Math.max(0, r.need - a.have)} to go</span>`}</div>`).join("")}</div>` : `<p class="muted small">No rewards listed.</p>`}
      ${(() => { const row = (x) => (x.v ? variantRow(x.v) : `<div class="li muted small">${esc(x.id.replace(/_(\d+)$/, " variant $1"))} isn't in the card list yet</div>`); const need = a.vars.filter((x) => !x.owned), have = a.vars.filter((x) => x.owned), got = a.rewards.filter((r) => r.got);
        return `${got.length ? `<h3>What you've got from it</h3><div class="chiplist">${got.map((r) => `<span class="pill W">✓ ${esc(rewardText(r))}</span>`).join("")}</div>` : ""}
        <h3>Still to collect <span class="muted small num">(${need.length})</span></h3>${need.length ? `<div class="list">${need.map(row).join("")}</div>` : `<p class="small">You have every variant in this album.</p>`}
        <h3>Collected <span class="muted small num">(${have.length})</span></h3>${have.length ? `<div class="list">${have.map(row).join("")}</div>` : `<p class="muted small">None ticked yet.</p>`}`; })()}
      <p class="muted small">Tick “Own” on the variants you have. Any ${a.goal} of them count toward the rewards.</p>`;
  };
}

/* ============ What should I buy? ============ */
const DEF_PRICES = { s5: 6000, s4: 3000, s3: 650 };
function tokenPrice(c) { const P = { ...DEF_PRICES, ...obj(S.prices) }; const s = seriesOf(c); return s === "Series 5" ? num(P.s5) : s === "Series 4" ? num(P.s4) : s === "Series 3" ? num(P.s3) : 0; }
function offerFor(ref, cardKey, cat) {
  const today = localDate(Date.now()); const now = Date.now();
  const offers = [...S.shops.filter((o) => !o.expires || dayEnd(o.expires) >= now), ...autoOffers().filter((o) => !o.start || o.start <= today)];
  const w = { ref, cat: cat || "", name: ref.startsWith("card:") ? card(cardKey).name : "" };
  const hits = offers.filter((o) => offerMatches(o, w));
  const rank = (o) => (o.currency === "usd" ? 3 : o.currency === "event" ? 2 : 0);
  return hits.sort((a, b) => rank(a) - rank(b) || num(a.price) - num(b.price))[0] || null;
}
function costOf(ref, cardKey, cat) {
  const o = offerFor(ref, cardKey, cat);
  if (o) return { currency: o.currency, price: num(o.price), how: "offer", o };
  if (ref.startsWith("card:")) {
    const c = card(cardKey), p = tokenPrice(c);
    if (p) return { currency: "tokens", price: p, how: "token", k: cardKey };
    if (/^(Starter|Series 1|Series 2)$/.test(seriesOf(c))) return { currency: "", price: 0, how: "free" };
  }
  return { currency: "", price: 0, how: "unknown" };
}
function costText(c) {
  if (c.how === "free") return "From Collection Level";
  if (c.how === "unknown") return "Price not known";
  return (c.o ? offerPrice(c.o) : `${fmt(c.price)} ${CURR[c.currency] || ""}`) + (c.how === "token" ? (seriesOf(card(c.k || "")) === "Series 3" ? " (Old Series 3 pack)" : " (Card Shop)") : "");
}
function wishTotals() {
  const items = wishItems().map((w) => ({ w, cost: costOf(w.ref, w.cardKey, w.cat) }));
  const tot = {}; let unknown = 0, free = 0;
  const counted = new Set();
  for (const { cost } of items) {
    if (cost.how === "unknown" || (cost.currency === "usd" && !cost.price)) { unknown++; continue; }
    if (cost.how === "free") { free++; continue; }
    const once = cost.o ? (cost.o.auto ? "g:" + cost.o.group : "o:" + (cost.o.id || "")) : ""; if (once && counted.has(once)) continue; if (once) counted.add(once);
    tot[cost.currency] = (tot[cost.currency] || 0) + cost.price;
  }
  return { items, tot, unknown, free };
}
function totalsText(tot) {
  const out = [];
  for (const k of ["tokens", "gold", "credits"]) if (tot[k]) out.push(`${fmt(tot[k])} ${CURR[k]}`);
  if (tot.usd) out.push("$" + (Math.round(tot.usd * 100) / 100).toFixed(2));
  if (tot.event) out.push(`${fmt(tot.event)} event currency`);
  return out.join(" + ");
}
function wishTotalHtml() {
  const t = wishTotals(); if (!t.items.length) return "";
  const tok = num(t.tot.tokens), have = num(S.wallet.tokens), gold = num(t.tot.gold), hg = num(S.wallet.gold);
  return `<div class="panel stack small"><span class="eyebrow">Everything on your wishlist costs about</span><b style="font-size:16px">${esc(totalsText(t.tot)) || "No prices known yet"}</b>
    ${tok ? `<span>${have >= tok ? `You have ${fmt(have)} tokens: enough for all of it.` : `You have ${fmt(have)} tokens: ${fmt(tok - have)} short.`}</span>` : ""}
    ${gold ? `<span>${hg >= gold ? `You have ${fmt(hg)} gold: enough for the gold offers.` : `You have ${fmt(hg)} gold: ${fmt(gold - hg)} short for every gold offer.`}</span>` : ""}
    ${t.free ? `<span class="muted">${plural(t.free, "card")} unlock through Collection Level.</span>` : ""}${t.unknown ? `<span class="muted">${plural(t.unknown, "item")} without a known price.</span>` : ""}
    <span class="muted">Card prices are Card Shop estimates. Change them in Home › Shops.</span></div>`;
}
function buyCandidates() {
  const inDecks = {}; S.decks.filter((d) => d.status !== "future" && !d.example).forEach((d) => arr(d.cards).forEach((k) => { const c = card(k); if (!S.owned[k] && !c.custom && !c.upcoming && !c.catModeOnly && c.key) inDecks[k] = (inDecks[k] || 0) + 1; }));
  const keys = new Set([...Object.keys(inDecks), ...Object.keys(S.wishCards).filter((k) => S.wishCards[k] && !S.owned[k] && !card(k).upcoming)]);
  const tokens = num(S.wallet.tokens), gold = num(S.wallet.gold), credits = num(S.wallet.credits);
  const can = (c) => (c.currency === "tokens" ? tokens >= c.price : c.currency === "gold" ? gold >= c.price : c.currency === "credits" ? credits >= c.price : false) && c.price > 0;
  const out = [];
  for (const k of keys) {
    const c = card(k); if (!c || !c.key || c.catModeOnly) continue;
    const cost = costOf("card:" + k, k, "");
    const why = [];
    if (inDecks[k]) why.push(`In ${plural(inDecks[k], "of your decks", "of your decks")}`.replace(/^In 1 of your decks$/, "In one of your decks"));
    if (S.wishCards[k]) why.push("On your wishlist");
    if (cost.how === "offer") why.push(cost.o.expires ? `On sale until ${dateStr(cost.o.expires)}` : "On sale now");
    const x = recentChange(k, 30); if (x && x.kind === "buff") why.push("Buffed lately");
    const score = num(inDecks[k]) * 3 + (S.wishCards[k] ? 2 : 0) + (cost.how === "offer" ? 2 : 0) + (x && x.kind === "buff" ? 1 : 0) + (can(cost) ? 1.5 : 0);
    out.push({ c, cost, why, score, can: can(cost) });
  }
  for (const v of S.variants) if (v.wish && !v.owned) { const cost = costOf("variant:" + v.id, v.card, v.cat); if (cost.how === "offer") out.push({ c: card(v.card), v, cost, why: ["Variant on your wishlist", cost.o.expires ? `On sale until ${dateStr(cost.o.expires)}` : "On sale now"], score: 3 + (can(cost) ? 1.5 : 0), can: can(cost) }); }
  return out.sort((a, b) => b.score - a.score || a.cost.price - b.cost.price);
}
function plannerInner() {
  const list = buyCandidates(); const best = list.find((x) => x.can);
  const P = { ...DEF_PRICES, ...obj(S.prices) };
  return `${list.length ? `${best ? `<div class="panel stack halftone"><span class="eyebrow">Best buy now</span><b style="font-size:17px">${esc(best.c.name)}${best.v ? " · " + esc(best.v.name) : ""}</b><span class="small">${esc(best.why.join(" · "))} · ${esc(costText(best.cost))}</span></div>` : `<p class="note">Nothing on this list fits your wallet yet. Update your currencies above if they've changed.</p>`}
    <div class="list">${list.slice(0, 12).map((x) => `<button class="li" data-a="cardOpen" data-k="${esc(x.c.key)}"><div class="grow" style="min-width:0"><div class="t">${esc(x.c.name)}${x.v ? ` · ${esc(x.v.name)}` : ""}</div><div class="s">${esc(x.why.join(" · ") || "Missing card")} · ${esc(costText(x.cost))}</div></div>${x.can ? `<span class="pill W">Can buy</span>` : x.cost.price ? `<span class="pill dim">Save up</span>` : ""}</button>`).join("")}</div>`
    : `<p class="muted small">Star cards you want, or build decks with cards you don't own yet, and this shows what's worth your tokens and gold first.</p>`}
    <details class="panel"><summary class="small">Card Shop prices used for cards</summary><div class="grid3" style="margin-top:8px">${[["s5", "Series 5"], ["s4", "Series 4"], ["s3", "Series 3 pack"]].map(([k, l]) => `<label class="f">${l}<input type="number" id="pr-${k}" data-bind="prices.${k}" data-num="1" value="${esc(P[k])}" inputmode="numeric"></label>`).join("")}</div><p class="muted small">Check the Card Shop in the game: prices change now and then. Series 3 cards come at random from the Old Series 3 pack.</p></details>`;
}
function plannerHtml() { return `<section class="sec"><h2>What should I buy?</h2><p class="muted small">Cards missing from your decks and things on your wishlist, ranked by how useful they are and whether you can afford them.</p><div id="planner" class="stack">${plannerInner()}</div></section>`; }

/* ============ Splits ============ */
const FINISHES = ["Foil", "Prism", "Ink", "Gold", "Krackle", "Stone", "Glimmer", "Tone", "Stardust", "Comic", "Rainbow"];
function splitsHtml(k) {
  const c = card(k); if (c.custom || c.upcoming) return "";
  const s = obj(obj(S.splits)[k]); const n = num(s.n); const fin = arr(s.f);
  const names = [...new Set([...FINISHES, ...arr(ALB && ALB.splits).map((x) => String(x.name || "")).filter(Boolean)])];
  return `<div class="sec-h"><h3>Splits</h3><div class="stepper"><button data-a="splitAdj" data-k="${esc(k)}" data-v="-1" aria-label="One fewer split">−</button><span>${n}</span><button data-a="splitAdj" data-k="${esc(k)}" data-v="1" aria-label="One more split">+</button></div></div>
    ${fin.length ? `<div class="chiplist">${fin.map((f, i) => `<button class="cchip" data-a="splitDel" data-k="${esc(k)}" data-i="${i}" aria-label="Remove ${esc(f)}"><span>${esc(f)}</span>${ICON.x}</button>`).join("")}</div>` : ""}
    <div class="row nowrap"><input type="text" id="sp-add" list="sp-names" placeholder="Add a finish or effect you got" aria-label="Finish or effect" autocomplete="off"><datalist id="sp-names">${names.map((o) => `<option value="${esc(o)}">`).join("")}</datalist><button class="btn sm" data-a="splitAddFin" data-k="${esc(k)}">Add</button></div>`;
}

/* ============ Deck versions ============ */
function syncDeckVersions() {
  const now = Date.now();
  for (const d of S.decks) {
    if (!arr(d.cards).length) continue;
    const sigOf = (cards) => [...arr(cards)].sort().join(","); const h = arr(d.history); const last = h[h.length - 1];
    if (last && sigOf(last.cards) === sigOf(d.cards)) continue;
    if (!last) { d.history = [{ ts: num(d.created), cards: [...d.cards] }]; continue; }
    // While you're editing (no games played with the newest version yet, and it's under 15 minutes old) the newest version just updates.
    if (now - num(last.ts) < 15 * 60e3 && !deckMatches(d).some((m) => m.ts >= num(last.ts))) { last.cards = [...d.cards]; continue; }
    const nh = [...h, { ts: now, cards: [...d.cards] }]; d.history = nh.length > 12 ? [nh[0], ...nh.slice(-11)] : nh;
  }
}
function deckVersionsHtml(d) {
  const h = arr(d.history);
  if (!h.length) return `<p class="muted small">Each time you change this deck's cards, the old list is kept here with its own record, so you can see which version played best.</p>`;
  const ms = deckMatches(d);
  const rows = h.map((v, i) => {
    const from = i === 0 ? 0 : num(v.ts), next = h[i + 1]; const list = ms.filter((m) => m.ts >= from && (!next || m.ts < num(next.ts)));
    const prev = h[i - 1]; return { v, i, st: statsFor(list), add: prev ? arr(v.cards).filter((k) => !arr(prev.cards).includes(k)) : [], rem: prev ? arr(prev.cards).filter((k) => !arr(v.cards).includes(k)) : [], cur: !next };
  }).reverse();
  const best = rows.filter((r) => r.st.games >= 5).sort((a, b) => b.st.wr - a.st.wr)[0];
  return `${best && rows.length > 1 ? `<p class="small">Best so far: <b>version ${best.i + 1}</b> at ${best.st.wr}% over ${best.st.games} games.</p>` : ""}
    <div class="list">${rows.map((r) => `<div class="li" style="flex-direction:column;align-items:stretch;gap:6px"><div class="row between"><b>Version ${r.i + 1}${r.cur ? ` <span class="pill gold">Now</span>` : ""}</b><span class="muted small">${r.i === 0 ? "first version" : "from " + esc(dayStr(r.v.ts))}</span></div>
      ${r.add.length || r.rem.length ? `<div class="chiplist">${r.add.map((k) => `<span class="cchip addc">+ ${esc(card(k).name)}</span>`).join("")}${r.rem.map((k) => `<span class="cchip remc">− ${esc(card(k).name)}</span>`).join("")}</div>` : ""}
      <div class="small">${r.st.games ? `${r.st.w}-${r.st.l}-${r.st.t} · ${r.st.wr}% win rate · ${signed(r.st.cubes)} cubes` : `<span class="muted">No games with this version</span>`}</div>${typeof deckVersionNote === "function" ? deckVersionNote(r, rows) : ""}
      ${r.cur ? "" : `<div><button class="btn sm" data-a="deckRestore" data-i="${r.i}">Go back to this version</button></div>`}</div>`).join("")}</div>`;
}

/* ============ Synergy finder ============ */
const SYN = [["destroy", /destroy/, 2], ["discard", /discard/, 2], ["move", /\bmov(e|es|ed|ing)\b/, 2], ["ongoing", /ongoing/, 1], ["on reveal", /on reveal/, 0.5], ["energy", /energy/, 1.5], ["your hand", /your hand|in hand/, 1], ["your deck", /your deck/, 1],
  ["cheap cards", /\b[01]-cost|1-cost|2-cost/, 1.5], ["big cards", /\b[56]-cost/, 1.5], ["negative power", /-\d+ power|afflict/, 2], ["locations", /location/, 0.5], ["copies", /\bcop(y|ies)\b/, 1], ["cost changes", /costs? \d less|cost \d less|\+\d cost|-\d cost/, 1.5]];
const synWords = (ab) => { const a = String(ab || "").toLowerCase(); return SYN.filter(([, re]) => re.test(a)); };
function mentions(ab, name) { const n = String(name || "").trim(); if (n.length < 4) return false; return new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(String(ab || "")); }
let _coSig = "", _co = null;
function coDecks() {
  const sig = `${saveVer}|${sharedVer}`; if (sig === _coSig) return _co;
  const lists = S.decks.filter((d) => !d.example).map((d) => arr(d.cards));
  publicDecksAll().forEach((x) => lists.push(arr(x.cards).map((n) => (cardByName(n) || {}).key).filter(Boolean)));
  _co = lists; _coSig = sig; return lists;
}
function synergyFor(k, n = 6) {
  const c = card(k); if (!c || c.custom) return [];
  const mine = synWords(c.ability); const decks = coDecks().filter((l) => l.includes(k));
  return allCards().filter((x) => x.key !== k && !x.upcoming && !x.custom && x.cost !== "?").map((x) => {
    let s = 0; const why = [];
    if (mentions(c.ability, x.name)) { s += 8; why.push(`${c.name} names it`); }
    if (mentions(x.ability, c.name)) { s += 8; why.push(`names ${c.name}`); }
    const theirs = synWords(x.ability).map(([w]) => w); const both = mine.filter(([w]) => theirs.includes(w));
    if (both.length) { s += both.reduce((t, [, , wt]) => t + wt, 0); why.push("both " + both.map(([w]) => w).slice(0, 2).join(" and ")); }
    const together = decks.filter((l) => l.includes(x.key)).length;
    if (together) { s += Math.min(6, together * 1.5); why.push(`together in ${plural(together, "deck")}`); }
    return { x, s, why };
  }).filter((r) => r.s >= 2.5).sort((a, b) => b.s - a.s || num(a.x.cost) - num(b.x.cost)).slice(0, n);
}
function synergyHtml(k) {
  const rows = synergyFor(k); if (!rows.length) return "";
  return `<h3>Works well with</h3><div class="list">${rows.map((r) => `<div class="li">${cardChip(r.x.key, { a: "cardOpen" })}<span class="muted small grow" style="min-width:0">${esc(r.why.join(" · "))}</span></div>`).join("")}</div>`;
}
function cardSheetExtrasBase(k) { return `${communityCardHtml(k)}${progHtml(k)}${synergyHtml(k)}`; }

/* ============ Shareable deck links ============ */
function deckLink(d) { return `${APP_URL}#deck=${encodeURIComponent(deckCode(d))}&n=${encodeURIComponent(String(d.name || "").slice(0, 60))}`; }
let linkDeck = null;
function linkDeckSheet() {
  if (!linkDeck) return sheetHead("Deck not found");
  const res = parseDeckCode(linkDeck.code); const name = linkDeck.name || res.name || "Shared deck";
  const own = res.cards.filter((k) => S.owned[k]).length;
  return `${sheetHead(esc(name), "Someone shared this deck with you")}
    ${res.cards.length ? `<div class="chiplist">${[...res.cards].sort((a, b) => num(card(a).cost) - num(card(b).cost)).map((k) => cardChip(k, { a: "cardOpen" })).join("")}</div>
    <p class="small muted">${own} of ${res.cards.length} cards owned · avg cost ${avgCost(res.cards)}${res.unknown.length ? ` · ${res.unknown.length} card${res.unknown.length > 1 ? "s" : ""} not in the app's list yet` : ""}</p>
    ${curveHtml(res.cards)}
    <div class="grid2"><button class="btn snap" data-a="linkSave">Save to my decks</button><button class="btn" data-a="linkCopy">${ICON.copy} Copy deck code</button></div>`
    : `<p class="note">This link doesn't have a deck the app can read. Ask for the deck code instead.</p>`}`;
}

/* ============ Quick log ============ */
const qk = { last: null, f: {} };
function quickSheet() {
  const q = obj(S.quick); const decks = S.decks.filter((d) => d.status !== "future");
  const last = realMatches()[0];
  const deckId = q.deckId !== undefined ? q.deckId : last ? last.deckId || "" : "";
  const mode = q.mode || (last ? modeOf(last) : "Ranked");
  const dch = (v, l) => `<button class="chip" data-a="quickDeck" data-v="${esc(v)}" aria-pressed="${deckId === v}">${esc(l)}</button>`;
  const mch = (v) => `<button class="chip" data-a="quickMode" data-v="${esc(v)}" aria-pressed="${mode === v}">${esc(v)}</button>`;
  const fl = (k, l) => `<button class="chip" data-a="quickFlag" data-v="${k}" aria-pressed="${!!qk.f[k]}">${l}</button>`;
  const b = (r, c, l, cls) => `<button class="btn ${cls}" data-a="quickSave" data-r="${r}" data-c="${c}">${l}</button>`;
  const ranked = mode === "Ranked";
  return `${sheetHead("Quick log", "One tap saves the match")}
    <span class="eyebrow">Deck</span><div class="chips">${dch("", "No deck")}${decks.map((d) => dch(d.id, d.name)).join("")}</div>
    <span class="eyebrow">Mode</span><div class="chips">${[...new Set(["Ranked", "Conquest", "Friendly", ...events().filter((e) => timeState(e) === "live").map((e) => String(e.name)).slice(0, 3), "Draft", mode])].map(mch).join("")}</div>
    ${voiceHtml()}${canReadShots() ? `<div class="row"><label class="btn sm">${ICON.spark} Log from screenshots<input type="file" accept="image/*" multiple data-shots="1" hidden></label></div>` : ""}
    <div class="chiplist">${fl("snapped", "I snapped")}${fl("oppSnapped", "They snapped")}${fl("retreated", "I retreated")}${fl("oppRetreated", "They retreated")}</div>
    ${ranked ? `<span class="eyebrow">Won</span><div class="qgrid">${[1, 2, 4, 8].map((c) => b("W", c, "+" + c, "qw")).join("")}</div><span class="eyebrow">Lost</span><div class="qgrid">${[1, 2, 4, 8].map((c) => b("L", c, "−" + c, "ql")).join("")}</div>${b("T", 0, "Tie", "")}`
      : `<div class="qgrid three">${b("W", 0, "Win", "qw")}${b("L", 0, "Loss", "ql")}${b("T", 0, "Tie", "")}</div>`}
    ${qk.last ? `<div class="row between small panel"><span>Saved: ${qk.last.result === "W" ? "win" : qk.last.result === "L" ? "loss" : "tie"}${num(qk.last.cubes) ? " " + signed(num(qk.last.cubes)) : ""} · ${esc(qk.last.deckName || "No deck")}</span><button class="btn sm ghost" data-a="quickUndo">Undo</button></div>` : ""}
    <div class="row"><button class="btn sm ghost" data-a="matchNew">Full match form</button></div>
    <p class="muted small">Tip: install SNAP Stat on your home screen (Settings › App), then press and hold its icon for a Quick log shortcut.</p>`;
}

/* ============ Alliance week ============ */
// The alliance week is the same for everyone, wherever they live: Monday to Monday in UTC
function allyWeek(ts) { const d = new Date(ts), back = (d.getUTCDay() + 6) % 7, start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back); return { key: "u" + new Date(start).toISOString().slice(0, 10), start, end: start + 7 * DAY }; }
function weekStats() {
  const wk = allyWeek(Date.now()).key; const ms = realMatches().filter((m) => allyWeek(m.ts).key === wk); const s = statsFor(ms);
  return { key: wk, games: s.games, w: s.w, cubes: s.cubes, snapW: s.snapW, tracked: ms.filter((m) => m.tracked).length, decks: new Set(ms.filter((m) => m.result === "W" && (m.deckId || m.deckName)).map((m) => m.deckId || m.deckName)).size };
}
const CHALLENGES = [
  { t: "Win games together", per: 15, val: (w) => num(w.w), unit: "wins" },
  { t: "Earn cubes together", per: 20, val: (w) => Math.max(0, num(w.cubes)), unit: "net cubes" },
  { t: "Snap and win", per: 5, val: (w) => num(w.snapW), unit: "snapped wins" },
  { t: "Play games together", per: 30, val: (w) => num(w.games), unit: "games" },
  { t: "Track games live", per: 6, val: (w) => num(w.tracked), unit: "tracked games" },
  { t: "Win with different decks", per: 3, val: (w) => num(w.decks), unit: "decks with a win" },
];
function weekChallenge() { const i = Math.floor(allyWeek(Date.now()).start / (7 * DAY)); return CHALLENGES[((i % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length]; }
function weekRows() {
  const wk = allyWeek(Date.now()).key, mine = allyKey(S.me.alliance);
  const rows = Object.entries(shared.profiles).filter(([id, p]) => id !== store.uid && mine && allyKey(p.alliance) === mine).map(([id, p]) => ({ id, p, w: obj(p.wk).key === wk ? obj(p.wk) : {} }));
  rows.push({ id: store.uid, p: { handle: S.me.handle || "You", country: S.me.country, avatar: S.me.avatar }, w: weekStats(), me: true });
  return rows;
}
function allianceWeekHtml() {
  const rows = weekRows(); const ch = weekChallenge();
  const goal = ch.per * clamp(rows.length, 1, 30); const total = rows.reduce((s, r) => s + ch.val(r.w), 0);
  const ends = allyWeek(Date.now()).end;
  const board = [...rows].filter((r) => num(r.w.games)).sort((a, b) => num(b.w.w) - num(a.w.w) || num(b.w.cubes) - num(a.w.cubes));
  const top = [...rows].filter((r) => ch.val(r.w)).sort((a, b) => ch.val(b.w) - ch.val(a.w)).slice(0, 5);
  return `<div class="panel stack halftone"><div class="row between"><span class="eyebrow">This week's challenge</span><span class="muted small">resets in ${cdSpan(ends)}</span></div>
      <b style="font-size:17px">${esc(ch.t)}</b><div class="row between small"><span class="num">${fmt(Math.min(total, goal))} / ${fmt(goal)} ${esc(ch.unit)}</span>${total >= goal ? `<span class="pill W">Done!</span>` : ""}</div>${progBar(total, goal, `${total} of ${goal} ${ch.unit}`)}
      <span class="muted small">${top.length ? "Top: " + top.map((r) => `${esc(r.me ? "You" : r.p.handle)} ${fmt(ch.val(r.w))}`).join(" · ") : "Nobody has counted toward it yet. Matches you log this week count."}</span></div>
    <h3>This week's leaders</h3>${board.length ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Player</th><th class="n">Wins</th><th class="n">Games</th><th class="n">Cubes</th></tr></thead><tbody>${board.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${r.me ? `<b>You</b>` : `<button class="chip" data-a="profileOpen" data-id="${esc(r.id)}">${esc(r.p.handle)}</button>`}</td><td class="n">${num(r.w.w)}</td><td class="n">${num(r.w.games)}</td><td class="n ${num(r.w.cubes) >= 0 ? "pos" : "neg"}">${signed(num(r.w.cubes))}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">No games logged by your alliance this week yet.</p>`}`;
}
function allianceBoardHtml() {
  const mine = allyKey(S.me.alliance); const posts = allPosts().filter((p) => p.alliance && p.alliance === mine).slice(0, 25);
  return `<div class="sec-h"><h3>Alliance board</h3><button class="btn sm snap" data-a="allianceCompose">${ICON.plus} Post</button></div>
    ${posts.length ? posts.map(postHtml).join("") : `<p class="muted small">Posts you mark “Only on my alliance's board” show here, and not in the main feed for other players.</p>`}`;
}

/* ============ Tournaments ============ */
let tourneys = {}, tjoins = {}, tourneyErr = false, _extrasOn = false;
function subscribeExtras(db) {
  if (_extrasOn || !db) return; _extrasOn = true;
  const q = (coll, set) => { try { db.collection(coll).onSnapshot((qs) => { const o = {}; qs.docs.forEach((d) => { const b = d.data(); if (b && typeof b === "object") o[d.id] = b; }); set(o); tourneyErr = false; sharedVer++; requestRender(); if (coll === "tournaments" && Object.values(o).some((t) => t.status === "live" && arr(t.players).some((p) => p.uid === store.uid))) syncProfile(); }, () => { tourneyErr = true; if (ui.more === "tournaments") requestRender(); }); } catch { tourneyErr = true; } };
  q("tournaments", (o) => (tourneys = o)); q("tjoin", (o) => (tjoins = o));
  setInterval(autoApplyTourneys, 15000);
}
function seedOrder(n) { let o = [1]; while (o.length < n) { const m = o.length * 2 + 1; o = o.flatMap((x) => [x, m - x]); } return o; }
function buildBracket(n) {
  let size = 2; while (size < n) size *= 2;
  const order = seedOrder(size), ms = [];
  for (let i = 0; i < size / 2; i++) { const a = order[2 * i] - 1, b = order[2 * i + 1] - 1; ms.push({ r: 0, i, a: a < n ? a : -1, b: b < n ? b : -1, w: null }); }
  for (let r = 1, cnt = size / 4; cnt >= 1; r++, cnt /= 2) for (let i = 0; i < cnt; i++) ms.push({ r, i, a: null, b: null, w: null });
  return advance(ms);
}
const tRoundCount = (ms) => (ms.length ? Math.max(...ms.map((m) => num(m.r))) + 1 : 0);
function advance(ms) {
  ms = ms.map((m) => ({ ...m })); const R = tRoundCount(ms);
  for (let r = 0; r < R; r++) for (const m of ms.filter((x) => x.r === r)) {
    if (r === 0 && m.w === null) { if (m.a >= 0 && m.b === -1) m.w = m.a; else if (m.b >= 0 && m.a === -1) m.w = m.b; }
    if (m.w !== null && m.w !== m.a && m.w !== m.b) m.w = null; // a player who's no longer in this match can't have won it
    const nx = ms.find((x) => x.r === r + 1 && x.i === Math.floor(m.i / 2)); if (!nx) continue;
    const slot = m.i % 2 === 0 ? "a" : "b";
    if (nx[slot] !== m.w) { nx[slot] = m.w; nx.w = null; }
  }
  return ms;
}
function tChampion(t) { const ms = arr(t.matches); const R = tRoundCount(ms); const f = ms.find((m) => m.r === R - 1); return f && f.w !== null && f.w >= 0 ? arr(t.players)[f.w] : null; }
function tPlayers(t, id) {
  if (t.status !== "open") return arr(t.players);
  const out = [...arr(t.players)]; const rem = new Set(arr(t.removed));
  Object.values(tjoins).filter((j) => j.tid === id && j.uid && !rem.has(j.uid) && !out.some((p) => p.uid === j.uid)).sort((a, b) => num(a.at) - num(b.at)).forEach((j) => out.push({ uid: j.uid, handle: String(j.handle || "Player").slice(0, 40) }));
  return out.slice(0, num(t.max) || 64);
}
const tVisible = (t) => t.kind === "challenge" ? arr(t.players).some((p) => p.uid === store.uid) : !t.alliance || t.by === store.uid || t.alliance === allyKey(S.me.alliance) || arr(t.players).some((p) => p.uid === store.uid);
const tNeed = (t) => Math.ceil((num(t.bestOf) || 1) / 2);
const roundName = (r, R) => (r === R - 1 ? "Final" : r === R - 2 ? "Semifinals" : r === R - 3 ? "Quarterfinals" : `Round ${r + 1}`);
/* Your own results in tournament matches, read from the matches you log against your bracket opponent. */
function myTourneyReports() {
  const out = {}; if (!store.uid) return out;
  for (const [id, t] of Object.entries(tourneys)) {
    if (t.status !== "live") continue;
    const ps = arr(t.players); const me = ps.findIndex((p) => p.uid === store.uid); if (me < 0) continue;
    for (const m of arr(t.matches)) {
      if (m.w !== null || m.a === null || m.b === null || m.a < 0 || m.b < 0 || (m.a !== me && m.b !== me)) continue;
      const opp = ps[m.a === me ? m.b : m.a]; if (!opp || !keyOf(opp.handle)) continue;
      const games = realMatches().filter((x) => x.ts >= num(t.started) && keyOf(x.oppName) === keyOf(opp.handle));
      const w = games.filter((x) => x.result === "W").length, l = games.filter((x) => x.result === "L").length;
      if (w || l) (out[id] = out[id] || {})[`${m.r}-${m.i}`] = { w: Math.min(w, 9), l: Math.min(l, 9) };
    }
  }
  return out;
}
function tReport(t, tid, m, side) { const p = arr(t.players)[side === "a" ? m.a : m.b]; if (!p || !p.uid) return null; const src = p.uid === store.uid ? myTourneyReports() : obj(obj(shared.profiles[p.uid]).tres); return obj(src[tid])[`${m.r}-${m.i}`] || null; }
function tSuggest(t, tid, m) {
  if (m.w !== null || m.a === null || m.b === null || m.a < 0 || m.b < 0) return null;
  const need = tNeed(t), ra = tReport(t, tid, m, "a"), rb = tReport(t, tid, m, "b");
  const aSays = ra ? (num(ra.w) >= need ? "a" : num(ra.l) >= need ? "b" : "") : "", bSays = rb ? (num(rb.w) >= need ? "b" : num(rb.l) >= need ? "a" : "") : "";
  if (aSays && bSays && aSays !== bSays) return { conflict: true, ra, rb };
  const w = aSays || bSays; if (!w) return null;
  return { w: m[w], both: !!(aSays && bSays), ra, rb };
}
function writeTourney(id, t) { tourneys[id] = t; sharedVer++; return store.db.doc("tournaments/" + id).set(clone({ ...t, updated: Date.now() })).catch((e) => { handleDbErr(e, "save the tournament"); }); }
function setTourneyWinner(id, r, i, w) {
  const t = tourneys[id]; if (!t) return;
  const ms = arr(t.matches).map((m) => (m.r === r && m.i === i ? { ...m, w } : m));
  const next = { ...t, matches: advance(ms) }; next.status = tChampion(next) ? "done" : "live";
  writeTourney(id, next);
}
function autoApplyTourneys() {
  if (store.mode !== "cloud") return;
  for (const [id, t] of Object.entries(tourneys)) {
    if (t.by !== store.uid || t.status !== "live") continue;
    let ms = arr(t.matches), changed = false;
    for (let guard = 0; guard < 8; guard++) {
      const hit = ms.find((m) => { const s = tSuggest({ ...t, matches: ms }, id, m); return s && s.both; });
      if (!hit) break;
      const s = tSuggest({ ...t, matches: ms }, id, hit);
      ms = advance(ms.map((m) => (m === hit ? { ...m, w: s.w, auto: true } : m))); changed = true;
    }
    if (changed) { const next = { ...t, matches: ms }; next.status = tChampion(next) ? "done" : "live"; writeTourney(id, next); }
  }
}
function vTournaments() {
  if (store.mode !== "cloud") return `<section class="sec">${backBar("Tournaments")}<div class="empty"><strong>Sign in to run tournaments</strong><span>Make a bracket with friends or your alliance. Everyone plays their matches as Friendly battles in the game and logs them here.</span>${store.fb ? `<button class="btn snap" data-a="signIn">Sign in</button>` : ""}</div></section>`;
  const list = Object.entries(tourneys).map(([id, t]) => ({ id, t })).filter(({ t }) => t && t.name && tVisible(t)).sort((a, b) => num(b.t.created) - num(a.t.created));
  const sec = (st, title) => { const l = list.filter(({ t }) => (st === "challenge" ? t.kind === "challenge" : t.status === st && t.kind !== "challenge")); if (!l.length) return ""; return `<h2>${title}</h2><div class="list">${l.map(({ id, t }) => { const champ = tChampion(t); return `<button class="li" data-a="tourneyOpen" data-id="${esc(id)}"><div class="grow" style="min-width:0"><div class="t">${esc(t.name)}${t.alliance ? ` <span class="pill dim">Alliance</span>` : ""}</div><div class="s">${plural(tPlayers(t, id).length, "player")} · best of ${num(t.bestOf) || 1} · by ${esc(t.byHandle || "someone")}${champ ? ` · won by ${esc(champ.handle)}` : ""}</div></div><span class="muted">›</span></button>`; }).join("")}</div>`; };
  return `<section class="sec">${backBar("Tournaments")}
    ${tourneyErr ? `<p class="note">The database isn't letting the app read tournaments yet. The app owner needs to publish the updated security rules (Firebase › Firestore Database › Rules).</p>` : ""}
    <p class="muted small">Make a bracket, share it with friends or your alliance, and play your matches as Friendly battles in the game. Log each one here with your opponent's in-game name: when both players' logs agree, the bracket fills in by itself.</p>
    <button class="btn snap" data-a="tourneyNew">${ICON.plus} New tournament</button></section>
    <section class="sec">${sec("challenge", "Challenges")}${sec("open", "Open for sign-up")}${sec("live", "Being played")}${sec("done", "Finished")}${list.length ? "" : `<div class="empty"><span>No tournaments yet. Start one!</span></div>`}</section>`;
}
const tc = { name: "", bestOf: 3, max: 8, alliance: false };
function tourneyNewSheet() {
  const c = (k, v, l) => `<button class="chip" data-a="tcSet" data-k="${k}" data-v="${v}" aria-pressed="${String(tc[k]) === String(v)}">${l}</button>`;
  return `${sheetHead("New tournament")}
    <label class="f">Name<input type="text" id="tc-name" data-tc="name" value="${esc(tc.name)}" maxlength="60" placeholder="Friday Night Snap" data-autofocus></label>
    <span class="eyebrow">Each match is</span><div class="chips">${c("bestOf", 1, "One game")}${c("bestOf", 3, "Best of 3")}${c("bestOf", 5, "Best of 5")}</div>
    <span class="eyebrow">Up to</span><div class="chips">${[4, 8, 16, 32].map((n) => c("max", n, n + " players")).join("")}</div>
    ${S.me.alliance ? `<label class="check"><input type="checkbox" data-tcchk="alliance" ${tc.alliance ? "checked" : ""}> Only for my alliance (${esc(S.me.alliance)})</label>` : ""}
    <button class="btn snap" data-a="tourneyCreate">Create</button>`;
}
function bracketHtml(t, id, mine) {
  const ms = arr(t.matches), R = tRoundCount(ms), ps = arr(t.players);
  const nm = (x) => (x === null || x === undefined ? `<span class="muted">waiting</span>` : x < 0 ? `<span class="muted">bye</span>` : esc((ps[x] || {}).handle || "?"));
  const side = (m, s) => { const x = m[s]; const won = m.w !== null && m.w === x && x >= 0; const can = mine && x !== null && x >= 0 && m.a !== null && m.b !== null && m.a >= 0 && m.b >= 0;
    return can ? `<button class="bp ${won ? "won" : ""}" data-a="tWin" data-id="${esc(id)}" data-r="${m.r}" data-i="${m.i}" data-w="${x}" aria-label="${esc((ps[x] || {}).handle || "")} won">${nm(x)}</button>` : `<div class="bp ${won ? "won" : ""}">${nm(x)}</div>`; };
  return `<div class="bracket">${Array.from({ length: R }, (_, r) => `<div class="bround"><span class="eyebrow">${roundName(r, R)}</span>${ms.filter((m) => m.r === r).sort((a, b) => a.i - b.i).map((m) => { const s = t.status === "live" ? tSuggest(t, id, m) : null;
    return `<div class="bm">${side(m, "a")}${side(m, "b")}${s ? `<div class="bsug small">${s.conflict ? `Logs disagree: ${esc((ps[m.a] || {}).handle)} says ${num(s.ra.w)}-${num(s.ra.l)}, ${esc((ps[m.b] || {}).handle)} says ${num(s.rb.w)}-${num(s.rb.l)}` : `${s.both ? "Both logs say" : "Logs say"} ${esc((ps[s.w] || {}).handle)} won${mine && !s.both ? ` <button class="btn sm" data-a="tWin" data-id="${esc(id)}" data-r="${m.r}" data-i="${m.i}" data-w="${s.w}">Confirm</button>` : ""}`}</div>` : ""}${m.auto ? `<div class="muted small">Filled in from both players' logs</div>` : ""}</div>`; }).join("")}</div>`).join("")}</div>`;
}
function tourneySheet(id) {
  return () => {
    const t = tourneys[id]; if (!t) return sheetHead("Tournament not found");
    const mine = t.by === store.uid; const ps = tPlayers(t, id); const inIt = ps.some((p) => p.uid === store.uid);
    const joined = !!tjoins[id + "_" + store.uid]; const champ = tChampion(t);
    const st = { open: "Open for sign-up", live: "Being played", done: "Finished" }[t.status] || "";
    let body = "";
    if (t.status === "open") {
      body = `<span class="eyebrow">Players (${ps.length}/${num(t.max) || 64})</span>
        ${ps.length ? `<div class="chiplist">${ps.map((p) => `<span class="cchip"><span>${esc(p.handle)}${p.uid === store.uid ? " (you)" : ""}</span>${mine ? `<button class="x" data-a="tRemove" data-id="${esc(id)}" data-uid="${esc(p.uid || "")}" data-h="${esc(p.handle)}" aria-label="Remove ${esc(p.handle)}">${ICON.x}</button>` : ""}</span>`).join("")}</div>` : `<p class="muted small">Nobody has joined yet.</p>`}
        <div class="row">${inIt ? (joined ? `<button class="btn" data-a="tLeave" data-id="${esc(id)}">Leave</button>` : "") : ps.length < (num(t.max) || 64) ? `<button class="btn snap" data-a="tJoin" data-id="${esc(id)}">Join</button>` : `<span class="pill dim">Full</span>`}<button class="btn" data-a="tShare" data-id="${esc(id)}">${ICON.copy} Share</button></div>
        ${mine ? `<div class="panel stack"><span class="eyebrow">Organizer</span><div class="row nowrap"><input type="text" id="t-add" placeholder="Add a player by in-game name" aria-label="Player name" maxlength="40"><button class="btn sm" data-a="tAdd" data-id="${esc(id)}">Add</button></div>
          <p class="muted small">Players can join from their own app, or you can add anyone by name. Players you add by name don't have results filled in automatically, so you set those.</p>
          <button class="btn snap" data-a="tStart" data-id="${esc(id)}" ${ps.length >= 2 ? "" : "disabled"}>Start the bracket</button></div>` : ""}`;
    } else {
      const myM = arr(t.matches).find((m) => m.w === null && m.a !== null && m.b !== null && m.a >= 0 && m.b >= 0 && [m.a, m.b].some((x) => (arr(t.players)[x] || {}).uid === store.uid));
      const opp = myM ? arr(t.players)[(arr(t.players)[myM.a] || {}).uid === store.uid ? myM.b : myM.a] : null;
      body = `${champ ? `<div class="panel halftone stack"><span class="eyebrow">Champion</span><b style="font-size:20px">${esc(champ.handle)}</b></div>` : ""}
        ${opp ? `<p class="note">Your next match is against <b>${esc(opp.handle)}</b>${num(t.bestOf) > 1 ? ` (first to ${tNeed(t)} wins)` : ""}. Play it as a Friendly battle in the game, then log it with “${esc(opp.handle)}” as the opponent.</p>` : ""}
        ${bracketHtml(t, id, mine)}
        ${mine && t.status === "live" ? `<p class="muted small">You're the organizer: tap a player's name to set them as the winner.</p>` : ""}`;
    }
    return `${sheetHead(esc(t.name), `${st} · best of ${num(t.bestOf) || 1} · by ${esc(t.byHandle || "someone")}${t.alliance ? " · alliance only" : ""}`)}${body}
      ${mine ? `<button class="btn danger" data-a="tDelete" data-id="${esc(id)}">${ui.tDel === id ? "Tap again to delete" : "Delete tournament"}</button>` : ""}`;
  };
}

/* ============ Community card stats ============ */
function myCardStats() {
  const since = Date.now() - 30 * DAY; const ms = realMatches().filter((m) => m.ts >= since);
  const c = {}; cardAnalytics(ms).filter((r) => r.played && !String(r.k).startsWith("custom:") && /^[a-z0-9]+$/.test(r.k)).sort((a, b) => b.played - a.played).slice(0, 60).forEach((r) => (c[r.k] = [r.played, r.w, r.l]));
  const fc = {}; ms.forEach((m) => new Set(arr(m.oppCards).map(keyOf)).forEach((k) => { if (k) fc[k] = (fc[k] || 0) + 1; }));
  const f = Object.fromEntries(Object.entries(fc).sort((a, b) => b[1] - a[1]).slice(0, 40));
  return { at: Date.now(), n: ms.filter((m) => m.tracked).length, g: ms.length, c, f };
}
function profileExtras() { return { allianceData: allianceShare(), wk: weekStats(), cs: myCardStats(), tres: myTourneyReports(), badges: earnedBadges(), td: myTopDecks(), ...myLocStats(), ev: myEventDecks() }; }
let _comSig = "", _com = null;
function communityAgg() {
  const sig = `${sharedVer}|${store.uid}`; if (sig === _comSig) return _com;
  const cards = {}, faced = {}; let players = 0, games = 0;
  for (const [id, p] of Object.entries(shared.profiles)) {
    if (!canSee(id) || (id !== store.uid && isMuted(id))) continue; const cs = obj(p.cs);
    if (!cs.c || num(cs.at) < Date.now() - 30 * DAY) continue;
    players++; games += num(cs.g);
    for (const [k, v] of Object.entries(obj(cs.c))) { const r = (cards[k] = cards[k] || { k, g: 0, w: 0, l: 0, p: 0 }); const a = arr(v); r.g += num(a[0]); r.w += num(a[1]); r.l += a.length > 2 ? num(a[2]) : num(a[0]) - num(a[1]); r.p++; }
    for (const [k, n] of Object.entries(obj(cs.f))) faced[k] = (faced[k] || 0) + num(n);
  }
  _com = { cards, faced, players, games }; _comSig = sig; return _com;
}
function communityCardHtml(k) {
  if (store.mode !== "cloud") return "";
  const r = communityAgg().cards[k], f = communityAgg().faced[k];
  if ((!r || r.g < 5) && !f) return "";
  return `<p class="small muted">SNAP Stat players, last 30 days: ${r && r.g >= 5 ? `played in ${plural(r.g, "tracked game")} by ${plural(r.p, "player")}, winning ${pct(r.w, r.w + r.l)}% of them` : ""}${r && r.g >= 5 && f ? "; " : ""}${f ? `seen from opponents ${plural(f, "time")}` : ""}.</p>`;
}
function communitySection() {
  if (store.mode !== "cloud") return `<section class="sec"><h2>SNAP Stat players</h2><p class="muted small">Sign in to see which cards do best across everyone's tracked games.</p></section>`;
  const a = communityAgg(); const rows = Object.values(a.cards);
  if (!a.players) return `<section class="sec"><h2>SNAP Stat players</h2><p class="muted small">No shared card stats yet. They fill in as players with a shared profile track matches live.</p></section>`;
  const most = [...rows].sort((x, y) => y.g - x.g).slice(0, 10);
  const best = rows.filter((r) => r.g >= 15).sort((x, y) => pct(y.w, y.w + y.l) - pct(x.w, x.w + x.l)).slice(0, 10);
  const faced = Object.entries(a.faced).sort((x, y) => y[1] - x[1]).slice(0, 10);
  const tab = (list, cols) => `<div class="tbl-wrap"><table><thead><tr><th>Card</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Players</th></tr></thead><tbody>${list.map((r) => `<tr><td><button class="chip" data-a="cardOpen" data-k="${esc(r.k)}">${esc(card(r.k).name || r.k)}</button></td><td class="n">${r.g}</td><td class="n">${pct(r.w, r.w + r.l)}%</td><td class="n">${r.p}</td></tr>`).join("")}</tbody></table></div>`;
  return `<section class="sec"><h2>SNAP Stat players</h2><p class="muted small">From tracked games by ${plural(a.players, "player")} in the last 30 days. Your own stats are included while your profile is shared.</p>
    ${most.length ? `<h3>Played most</h3>${tab(most)}` : ""}${best.length ? `<h3>Best win rate (15+ games)</h3>${tab(best)}` : ""}
    ${faced.length ? `<h3>Faced most</h3><div class="chiplist">${faced.map(([k, n]) => `${cardChip(k, { a: "cardOpen", noOwn: true, suffix: ` <span class="muted">×${n}</span>` })}`).join("")}</div>` : ""}</section>`;
}

/* ============ Reading screenshots with AI ============ */
const canReadShots = () => !!(store.sample && store.sample.own);
function shotInput(kind) {
  if (!window.SNAPSTAT_STANDALONE) return "";
  if (!canReadShots()) return `<p class="muted small">Add an AI key in Settings › AI to read ${kind === "deck" ? "a deck" : kind === "numbers" ? "these" : "a match result"} from a screenshot.</p>`;
  if (kind !== "deck") return `<label class="btn sm">${ICON.spark} Read screenshots<input type="file" accept="image/*" multiple data-shots="1" hidden></label>`;
  return `<label class="btn sm">${ICON.spark} Read a deck screenshot<input type="file" accept="image/*" data-shot="${kind}" hidden></label>`;
}
async function imageForAI(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, 1568 / Math.max(img.width, img.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return { media_type: "image/jpeg", data: cv.toDataURL("image/jpeg", 0.85).split(",")[1] };
  } finally { URL.revokeObjectURL(url); }
}
function fuzzyCard(name) {
  const c = cardByName(name); if (c) return c;
  const k = keyOf(name); if (k.length < 3) return null;
  return allCards().find((x) => !x.custom && (x.key.startsWith(k) || k.startsWith(x.key)) && Math.abs(x.key.length - k.length) <= 3) || null;
}
const cardRoster = () => allCards().filter((c) => !c.upcoming && !c.custom && c.cost !== "?").map((c) => `${c.name} ${c.cost}/${c.power}`).join("; ");
let shotBusy = false;
async function readShot(file, kind) {
  if (shotBusy) return; if (!/^image\//.test(file.type)) { toast("Choose a picture"); return; }
  shotBusy = true; toast("Reading the screenshot…");
  try {
    const img = await imageForAI(file);
    if (kind === "deck") {
      const r = await aiJson(`This is a MARVEL SNAP screenshot showing a deck of up to 12 cards. Card names usually aren't printed, so identify each card from its art, cost (top left) and power (top right). Only use names from this list of real cards (name cost/power): ${cardRoster()}
Reply as JSON: {"name": "deck name if one is shown, else empty", "cards": ["card name", ...]}`, { images: [img] });
      const cards = [], unknown = [];
      arr(r.cards).slice(0, 12).forEach((n) => { const c = fuzzyCard(n); if (c && !cards.includes(c.key)) cards.push(c.key); else if (!c) unknown.push(String(n)); });
      imp.res = { name: String(r.name || "Deck from screenshot").slice(0, 60), cards, variants: {}, unknown, unknownCodes: [] };
      if (sheetFn === importSheet) refreshSheet(); else openSheet(importSheet);
      toast(cards.length ? `Found ${plural(cards.length, "card")}. Check them before saving.` : "Couldn't find cards in that picture.");
    } else {
      const r = await aiJson(`This is a MARVEL SNAP screenshot from the end of a match (or the board just before it ended). Read what you can see.
Valid card names (name cost/power): ${cardRoster()}
Reply as JSON: {"result": "W" | "L" | "T" | "" (from the player's side at the bottom), "cubes": number of cubes won or lost (positive, 0 if not shown), "oppName": "opponent's name if shown", "locations": [{"name": "location name", "my": bottom player's power, "opp": top player's power}], "oppCards": ["names of the opponent's cards you can identify"], "myCards": ["names of the bottom player's cards you can identify"], "snapped": true/false if visible}`, { images: [img] });
      openMatchForm(null);
      const locs = arr(r.locations).slice(0, 3).map((l) => ({ name: String(l.name || "").slice(0, 40), my: l.my === undefined || l.my === null ? "" : num(l.my), opp: l.opp === undefined || l.opp === null ? "" : num(l.opp) }));
      while (locs.length < 3) locs.push({ name: "", my: "", opp: "" });
      const res = ["W", "L", "T"].includes(r.result) ? r.result : mf.result;
      const opp = [...new Set(arr(r.oppCards).map((n) => (fuzzyCard(n) || {}).name).filter(Boolean))];
      const plays = [...new Set(arr(r.myCards).map((n) => (fuzzyCard(n) || {}).key).filter(Boolean))].map((k) => ({ k, loc: 0, power: num(card(k).power) }));
      const d = S.decks.find((x) => plays.length >= 3 && plays.filter((p) => x.cards.includes(p.k)).length >= Math.min(3, plays.length));
      Object.assign(mf, { result: res, mag: res === "T" ? 0 : clamp(Math.abs(num(r.cubes)) || mf.mag || 1, 1, 8), oppName: String(r.oppName || "").slice(0, 40), oppCards: opp, locs, snapped: !!r.snapped, deckId: d ? d.id : mf.deckId, fromShot: true });
      refreshSheet(); toast("Filled in from the screenshot. Check it, then save.");
    }
  } catch (e) { toast(e && e.message ? e.message : "Couldn't read that screenshot."); }
  shotBusy = false;
}

/* ============ Routes, actions and inputs for these features ============ */

function specialRoute(h) {
  if (h.startsWith("replay=") || h.startsWith("overlay")) return specialRoute2(h);
  if (h === "shared") return sharedRoute();
  if (h.startsWith("deck=")) {
    const p = new URLSearchParams(h); linkDeck = { code: p.get("deck") || "", name: p.get("n") || "" };
    applyNav("cards", "decks"); render();
    try { history.replaceState(null, "", "#cards/decks"); } catch { /* fine */ }
    setTimeout(() => openSheet(linkDeckSheet), 0); return true;
  }
  if (h === "quicklog") {
    applyNav("home", "live"); render();
    try { history.replaceState(null, "", "#play"); } catch { /* fine */ }
    setTimeout(() => { qk.last = null; qk.f = {}; openSheet(quickSheet); }, 0); return true;
  }
  return false;
}
Object.assign(A, {
  climbSave: () => { const r = clamp(Math.round(num($("#cl-rank").value)), 0, 100), c = clamp(Math.round(num($("#cl-cubes").value)), 0, cpr() - 1); if (!r) { toast("Enter your rank from 1 to 100"); return; } S.climb = { rank: r, cubes: c, at: Date.now() }; ui.climbEdit = false; syncRankFromClimb(); save(); render(); toast("Rank saved"); },
  climbEdit: () => { ui.climbEdit = true; render(); }, climbCancel: () => { ui.climbEdit = false; render(); },
  climbReset: (el) => { S.climb = { rank: num(el.dataset.v), cubes: 0, at: Date.now() }; syncRankFromClimb(); save(); render(); toast("Rank set for the new season"); },
  homeMode: (el) => { ui.homeMode = el.dataset.v; render(); }, insDeck: (el) => { ui.insDeck = el.dataset.v; render(); },
  albFilter: (el) => { ui.albFilter = el.dataset.v; render(); }, albumOpen: (el) => openSheet(albumSheet(el.dataset.id)),
  splitAdj: (el) => { const k = el.dataset.k; S.splits = obj(S.splits); const s = obj(S.splits[k]); S.splits[k] = { ...s, n: Math.max(0, num(s.n) + num(el.dataset.v)) }; save(); refreshSheet(); },
  splitAddFin: (el) => { const k = el.dataset.k; const v = String(($("#sp-add") || {}).value || "").trim().slice(0, 40); if (!v) return; S.splits = obj(S.splits); const s = obj(S.splits[k]); S.splits[k] = { ...s, f: [...new Set([...arr(s.f), v])].slice(0, 40) }; save(); refreshSheet(); },
  splitDel: (el) => { const k = el.dataset.k; const s = obj(obj(S.splits)[k]); S.splits[k] = { ...s, f: arr(s.f).filter((_, i) => i !== num(el.dataset.i)) }; save(); refreshSheet(); },
  deckRestore: (el) => { const d = deckEdit(); const v = arr(d && d.history)[num(el.dataset.i)]; if (!v) return; d.cards = [...arr(v.cards)].slice(0, 12); Object.keys(obj(d.variants)).forEach((k) => { if (!d.cards.includes(k)) delete d.variants[k]; }); save(); refreshSheet(); render(); toast(`Deck set back to version ${num(el.dataset.i) + 1}`); },
  deckLink: async () => { const d = deckEdit(); if (!d || !d.cards.length) return; const url = deckLink(d); if (navigator.share) { try { await navigator.share({ title: d.name, text: `${d.name}: a MARVEL SNAP deck`, url }); return; } catch (e) { if (e && e.name === "AbortError") return; } } copyText(url, "Link copied. Anyone who opens it can see and save the deck."); },
  linkSave: () => { const res = parseDeckCode(linkDeck.code); if (!res.cards.length) return; const d = newDeck(linkDeck.name || res.name || "Shared deck", res.cards); closeSheet(); render(); openDeck(d.id); toast("Deck saved"); },
  linkCopy: () => copyText(linkDeck.code, "Deck code copied. Paste it in the game's deck menu."),
  quickOpen: () => { qk.last = null; qk.f = {}; openSheet(quickSheet); },
  quickDeck: (el) => { S.quick = { ...obj(S.quick), deckId: el.dataset.v }; save(); refreshSheet(); },
  quickMode: (el) => { S.quick = { ...obj(S.quick), mode: el.dataset.v }; save(); refreshSheet(); },
  quickFlag: (el) => { qk.f[el.dataset.v] = !qk.f[el.dataset.v]; refreshSheet(); },
  quickSave: (el) => quickSaveMatch(el.dataset.r, num(el.dataset.c)),
  quickUndo: () => { if (!qk.last) return; removeMatchFix(qk.last.id); qk.last = null; save(); refreshSheet(); render(); toast("Removed"); },
  allianceCompose: () => { pc.type = "text"; pc.text = ""; pc.alliance = true; openSheet(composeSheet); },
  tourneyOpen: (el) => { ui.tDel = ""; openSheet(tourneySheet(el.dataset.id)); },
  tourneyNew: () => { if (!S.me.handle.trim()) { toast("Add your in-game name first"); openSheet(onboardSheet); return; } Object.assign(tc, { name: "", bestOf: 3, max: 8, alliance: false }); openSheet(tourneyNewSheet); },
  tcSet: (el) => { tc[el.dataset.k] = num(el.dataset.v); refreshSheet(); },
  tourneyCreate: () => {
    const name = String(tc.name || "").trim().slice(0, 60); if (!name) { toast("Give it a name"); return; }
    const id = uid(); const t = { name, by: store.uid, byHandle: S.me.handle.trim().slice(0, 40), created: Date.now(), status: "open", bestOf: tc.bestOf, max: tc.max, alliance: tc.alliance ? allyKey(S.me.alliance) : "", allianceName: tc.alliance ? S.me.alliance.trim().slice(0, 40) : "", players: [], removed: [], matches: [] };
    writeTourney(id, t); render(); openSheet(tourneySheet(id)); toast("Tournament created. Share it so people can join.");
  },
  tJoin: (el) => { const id = el.dataset.id; if (!S.me.handle.trim()) { toast("Add your in-game name first"); openSheet(onboardSheet); return; } const j = { tid: id, uid: store.uid, handle: S.me.handle.trim().slice(0, 40), at: Date.now() }; tjoins[id + "_" + store.uid] = j; sharedVer++; store.db.doc("tjoin/" + id + "_" + store.uid).set(j).catch((e) => handleDbErr(e, "join")); refreshSheet(); render(); toast("You're in"); },
  tLeave: (el) => { const id = el.dataset.id; delete tjoins[id + "_" + store.uid]; sharedVer++; store.db.doc("tjoin/" + id + "_" + store.uid).delete().catch((e) => handleDbErr(e, "leave")); refreshSheet(); render(); },
  tShare: (el) => { const t = tourneys[el.dataset.id]; if (!t) return; const text = `Join my MARVEL SNAP tournament "${t.name}" in SNAP Stat: open the app, go to More › Tournaments and tap Join. ${APP_URL}#tournaments`; if (navigator.share) navigator.share({ title: t.name, text }).catch(() => {}); else copyText(text, "Invite copied"); },
  tAdd: (el) => { const id = el.dataset.id, t = tourneys[id]; const h = String(($("#t-add") || {}).value || "").trim().slice(0, 40); if (!t || !h) return; const ps = tPlayers(t, id); if (ps.length >= (num(t.max) || 64)) { toast("The tournament is full"); return; } if (ps.some((p) => keyOf(p.handle) === keyOf(h))) { toast("They're already in"); return; } writeTourney(id, { ...t, players: [...arr(t.players), { uid: "", handle: h }] }); refreshSheet(); },
  tRemove: (el) => { const id = el.dataset.id, t = tourneys[id]; if (!t) return; const u = el.dataset.uid, h = el.dataset.h; writeTourney(id, { ...t, players: arr(t.players).filter((p) => (u ? p.uid !== u : !(p.uid === "" && p.handle === h))), removed: u ? [...new Set([...arr(t.removed), u])] : arr(t.removed) }); refreshSheet(); },
  tStart: (el) => {
    const id = el.dataset.id, t = tourneys[id]; if (!t) return; const ps = tPlayers(t, id); if (ps.length < 2) return;
    for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
    writeTourney(id, { ...t, players: ps, matches: buildBracket(ps.length), status: "live", started: Date.now() }); refreshSheet(); render(); toast("Bracket made. Good luck!");
  },
  tWin: (el) => { setTourneyWinner(el.dataset.id, num(el.dataset.r), num(el.dataset.i), num(el.dataset.w)); refreshSheet(); render(); },
  tDelete: (el) => { const id = el.dataset.id; if (ui.tDel !== id) { ui.tDel = id; refreshSheet(); return; } ui.tDel = ""; delete tourneys[id]; sharedVer++; store.db.doc("tournaments/" + id).delete().catch((e) => handleDbErr(e, "delete the tournament")); closeSheet(); render(); toast("Tournament deleted"); },
});
document.addEventListener("input", (e) => {
  const t = e.target, d = t.dataset;
  if (d.tc) { tc[d.tc] = t.value; return; }
  if (d.bind && /^(wallet|prices)\./.test(d.bind)) { const b = $("#planner"); if (b && !b.contains(t)) b.innerHTML = plannerInner(); }
});
document.addEventListener("change", (e) => {
  const t = e.target, d = t.dataset;
  if (d.livechk === "mySnap" || d.livechk === "oppSnap") { const k = d.livechk === "mySnap" ? "snapTurn" : "oppSnapTurn"; if (t.checked && !live[k]) live[k] = live.turn; if (!t.checked) delete live[k]; saveLive(); return; }
  if (d.mfchk === "snapped") { refreshSheet(); return; }
  if (d.aimodel) { lsPut(AI_MODEL, t.value); return; }
  if (d.tcchk) { tc[d.tcchk] = t.checked; return; }
  if (d.pcchk) { pc[d.pcchk] = t.checked; return; }
  if (d.shot) { const f = t.files && t.files[0]; t.value = ""; if (f) readShot(f, d.shot); return; }
  if (d.bind && /^prices\./.test(d.bind)) { const b = $("#planner"); if (b) b.innerHTML = plannerInner(); }
});

function cardSheetExtras(k) { return myLookHtml(k) + cardImpactLine(k) + cardSheetExtrasBase(k) + cardBoardHtml(k) + extHtml(EXT.cardSheet, k); }
function cardImpactLine(k) {
  const hadIt = (d, m) => { let v = null; for (const x of arr(d.history)) if (num(x.ts) <= m.ts) v = x; return v ? arr(v.cards).includes(k) : d.cards.includes(k); };
  const ms = realMatches().filter((m) => { if (m.noCubes || (m.mode && m.mode !== "Ranked")) return false; const d = S.decks.find((x) => x.id === m.deckId); return d && hadIt(d, m); });
  const v = cardImpact(ms, [k])[k]; if (v === undefined) return "";
  return `<p class="small">When you play it: <b class="${v >= 0 ? "pos" : "neg"}">${signed(v)} cubes a game</b> compared with Ranked games it stays in your deck.</p>`;
}
