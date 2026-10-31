/* ============ y15_stats.js: stats & coaching panels for Home › Stats, plus three small cards on Home › Overview ============
   Best hours and weekdays, tilt guard, daily cube goal, rank ETA, highlights, deck vs deck, streaks, clutch factor, rivals,
   report card and personal bests. Everything reads your real matches (example data is left out) and follows the period and
   mode chips at the top of Home › Stats. The maths runs once per change and is kept in memory, never saved. */

/* ---------- Shared: the matches the panels look at, remembered until the matches, period or mode change ---------- */
let _y15Sig = "", _y15 = null;
function y15Pool() {
  const p = periodById(ui.period);
  const sig = `${_mVer}|${p.id}|${ui.homeMode || ""}|${Math.floor(Date.now() / 3600e3)}`;
  if (sig === _y15Sig && _y15) return _y15;
  _y15 = { p, ms: byMode(inPeriod(realMatches(), p)), c: {} }; _y15Sig = sig;
  return _y15;
}
// One panel's numbers, worked out once per pool
function y15Memo(key, fn) { const P = y15Pool(); if (!(key in P.c)) P.c[key] = fn(P.ms, P); return P.c[key]; }
const y15Decided = (m) => m.result === "W" || m.result === "L";
const y15Wr = (w, l) => pct(w, w + l);
const y15Sec = (title, body, right = "") => `<section class="sec"><div class="sec-h"><h2>${title}</h2>${right}</div>${body}</section>`;
const y15Empty = (strong, text) => `<div class="empty"><strong>${strong}</strong><span>${text}</span></div>`;
const y15Tile = (k, v, cls = "") => `<div class="tile"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
// A match as a tappable row (opens the match form)
function y15MatchRow(m, extra = "") {
  const c = num(m.cubes);
  return `<button class="li" data-a="matchEdit" data-id="${esc(m.id)}"><span class="pill ${esc(m.result)}">${esc(m.result)}</span><div class="grow"><div class="t">${esc(m.deckName || "No deck")}${m.oppName ? ` <span class="muted">vs ${esc(m.oppName)}</span>` : ""}</div><div class="s">${esc(dateTimeStr(m.ts))}${extra}${m.snapped ? " · you snapped" : ""}${m.oppSnapped ? " · they snapped" : ""}</div></div>${m.noCubes ? `<span class="muted small">no cubes</span>` : cubes(signed(c), c >= 0 ? "pos" : "neg")}</button>`;
}

/* ---------- 1 & 2. Best hours to play, and best weekdays ---------- */
const Y15_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const Y15_DAYS_LONG = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];
const Y15_MIN_GAMES = 20;
function y15Hour(h) { const x = ((h % 24) + 24) % 24; return x === 0 ? "12 AM" : x < 12 ? `${x} AM` : x === 12 ? "12 PM" : `${x - 12} PM`; }
// "7–10 PM", or "11 PM–2 AM" when it crosses midday or midnight
function y15HourRange(a, b) { const A = y15Hour(a), B = y15Hour(b); return A.slice(-2) === B.slice(-2) ? `${A.slice(0, -3)}–${B}` : `${A}–${B}`; }
function y15Buckets(ms, n, idx) {
  const b = Array.from({ length: n }, () => ({ g: 0, w: 0, l: 0, cubes: 0 }));
  for (const m of ms) { const r = b[idx(m)]; if (!r) continue; r.g++; if (m.result === "W") r.w++; else if (m.result === "L") r.l++; r.cubes += num(m.cubes); }
  b.forEach((r) => { r.wr = y15Wr(r.w, r.l); });
  return b;
}
// The best run of [size] buckets in a row with enough decided games (hours wrap around midnight)
function y15BestRun(b, size, minGames, wrap) {
  let best = null;
  for (let s = 0; s < b.length; s++) {
    if (!wrap && s + size > b.length) break;
    let w = 0, l = 0, g = 0; for (let i = 0; i < size; i++) { const r = b[(s + i) % b.length]; w += r.w; l += r.l; g += r.g; }
    if (w + l < minGames) continue;
    const wr = y15Wr(w, l);
    if (!best || wr > best.wr || (wr === best.wr && g > best.g)) best = { s, e: (s + size - 1) % b.length, wr, g, w, l };
  }
  if (best) { while (best.s !== best.e && !b[best.s].g) best.s = (best.s + 1) % b.length; while (best.e !== best.s && !b[best.e].g) best.e = (best.e - 1 + b.length) % b.length; }
  return best;
}
// Greener the more you win there, redder the more you lose, grey when you haven't played then
function y15HeatStyle(r) {
  if (!r.g || !(r.w + r.l)) return "";
  const d = r.wr - 50; if (!d) return "background:color-mix(in srgb, var(--fg) 12%, var(--surface-2))";
  const p = clamp(Math.round(Math.abs(d) * 2.4), 14, 100);
  return `background:color-mix(in srgb, var(${d > 0 ? "--win" : "--loss"}) ${p}%, var(--surface-2))`;
}
function y15CellTitle(label, r) { return `${label}: ${r.w + r.l ? `${r.wr}% of ${plural(r.w + r.l, "game")}` : r.g ? `${plural(r.g, "tie")} only` : "no games"}`; }
function y15Heat(kind, b, labelOf) {
  const sel = ui["y15sel_" + kind];
  return `<div class="y15heat" role="group" aria-label="Win rate by ${kind === "hour" ? "hour of the day" : "day of the week"}">${b.map((r, i) => { const t = y15CellTitle(labelOf(i), r); return `<button class="y15c" data-a="y15Cell" data-k="${kind}" data-i="${i}" aria-pressed="${sel === i}" title="${esc(t)}" aria-label="${esc(t)}" style="${y15HeatStyle(r)}"></button>`; }).join("")}</div>`;
}
function y15SelLine(kind, b, labelOf) {
  const i = ui["y15sel_" + kind]; const r = b[i]; if (r === undefined) return `<span class="muted small">Tap a block for its numbers.</span>`;
  return `<span class="small"><b>${esc(labelOf(i))}</b> · ${r.w + r.l ? `${r.wr}% · ${r.w}-${r.l} · ${signed(r.cubes)} cubes` : r.g ? `${plural(r.g, "tie")}, no wins or losses` : "no games"}</span>`;
}
function y15HoursHtml() {
  const R = y15Memo("hours", (ms) => {
    const g = ms.filter(y15Decided); const b = y15Buckets(g, 24, (m) => new Date(m.ts).getHours());
    const best = g.length >= Y15_MIN_GAMES ? y15BestRun(b, 3, Math.max(5, Math.round(g.length * 0.12)), true) : null;
    return { n: g.length, b, best };
  });
  if (R.n < Y15_MIN_GAMES) return y15Sec("Best hours to play", y15Empty("Not enough games yet", `Once you've logged ${Y15_MIN_GAMES} games in this period (${R.n} so far), you'll see which hours of the day you win most.`));
  const line = R.best ? `You win most between <b>${esc(y15HourRange(R.best.s, (R.best.e + 1) % 24))}</b> (${R.best.wr}%, ${plural(R.best.g, "game")}).` : "Your games are spread thinly across the day, so no hour stands out yet.";
  return y15Sec("Best hours to play", `<div class="panel stack"><p class="small" style="margin:0">${line}</p>${y15Heat("hour", R.b, y15Hour)}<div class="y15axis"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>${y15SelLine("hour", R.b, y15Hour)}<span class="muted small">Win rate by the hour you played, in this period. Greener is better, redder is worse.</span></div>`);
}
function y15WeekdaysHtml() {
  const R = y15Memo("days", (ms) => {
    const g = ms.filter(y15Decided); const b = y15Buckets(g, 7, (m) => (new Date(m.ts).getDay() + 6) % 7);
    const best = g.length >= Y15_MIN_GAMES ? y15BestRun(b, 1, Math.max(5, Math.round(g.length * 0.1)), false) : null;
    return { n: g.length, b, best };
  });
  if (R.n < Y15_MIN_GAMES) return y15Sec("Best weekdays", y15Empty("Not enough games yet", `Log ${Y15_MIN_GAMES} games in this period (${R.n} so far) to see which days of the week suit you.`));
  const line = R.best ? `You win most on <b>${Y15_DAYS_LONG[R.best.s]}</b> (${R.best.wr}%, ${plural(R.best.g, "game")}).` : "No single day has enough games to stand out yet.";
  return y15Sec("Best weekdays", `<div class="panel stack"><p class="small" style="margin:0">${line}</p>${y15Heat("day", R.b, (i) => Y15_DAYS_LONG[i])}<div class="y15heat y15lbl">${Y15_DAYS.map((d) => `<span>${d}</span>`).join("")}</div>${y15SelLine("day", R.b, (i) => Y15_DAYS_LONG[i])}</div>`);
}

/* ---------- 3. Tilt guard: a gentle note after three quick losses in a row ---------- */
const Y15_TILT_N = 3, Y15_TILT_MINS = 25, Y15_TILT_STALE = 3 * 3600e3;
const y15TiltMem = { toasted: 0 };
const y15TiltOn = () => !obj(S.tilt).off;
// The run of quick losses you're on right now, or null: your newest matches are all losses and the last three came within 25 minutes
function y15TiltRun() {
  const ms = realMatches(); if (ms.length < Y15_TILT_N) return null;
  for (let i = 0; i < Y15_TILT_N; i++) if (ms[i].result !== "L") return null;
  if (ms[0].ts - ms[Y15_TILT_N - 1].ts > Y15_TILT_MINS * 60e3) return null;
  let n = Y15_TILT_N; while (n < ms.length && ms[n].result === "L") n++;
  return { start: ms[n - 1].ts, last: ms[0].ts, n };
}
function y15TiltCard() {
  if (!y15TiltOn()) return ""; const r = y15TiltRun(); if (!r) return "";
  if (num(obj(S.tilt).dismissedAt) >= r.start || Date.now() - r.last > Y15_TILT_STALE) return "";
  const words = ["", "", "", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]; const n = words[r.n] || fmt(r.n);
  return `<section class="sec"><div class="panel y15tilt row between nowrap"><div class="stack" style="gap:2px;min-width:0"><b>Rough run.</b><span class="small">${n} losses in a row — a short break often helps.</span></div><button class="btn sm ghost" data-a="y15TiltDismiss" style="flex:none">Got it</button></div></section>`;
}
EXT.homeTop.push(y15TiltCard);
EXT.onMatch.push((m, isNew) => {
  if (!isNew || m.example || !y15TiltOn()) return; const r = y15TiltRun();
  if (!r || r.last !== m.ts || Date.now() - r.last > Y15_TILT_STALE || num(obj(S.tilt).dismissedAt) >= r.start || y15TiltMem.toasted === r.start) return;
  y15TiltMem.toasted = r.start; setTimeout(() => toast("Rough run. A short break often helps."), 2800);
});
// The session panel used to show its own "losses in a row" line; this card replaces it (dismissable, and it can be turned off)
{ const base = sessionPanel; sessionPanel = () => base().replace(/<p class="note">\d+ losses in a row\.[^<]*<\/p>/, ""); }
EXT.settingsApp.push(() => `<section class="sec"><h2>Coaching</h2><div class="panel small"><label class="check"><input type="checkbox" data-y15tilt="1" ${y15TiltOn() ? "checked" : ""}> Show a “take a break” note on Home after three quick losses in a row</label></div></section>`);

/* ---------- 4. Daily cube goal: a goal kind for the existing goals, plus a ring on Home ---------- */
GOAL_KINDS.cubesDay = { label: "Earn cubes today", unit: "net cubes", per: "day", val: (ms) => Math.max(0, ms.filter((m) => !m.noCubes).reduce((s, m) => s + num(m.cubes), 0)) };
{ const base = A.glKind; A.glKind = (el) => { base(el); if (gl.kind === "cubesDay" && !gl.target) { gl.target = 10; refreshSheet(); } }; }
const y15CubeGoal = () => arr(S.goals).find((g) => g.kind === "cubesDay") || null;
// Home › Overview › Today lists your other goals; the cube goal has its own ring card, and the streak line below shows
// the current win streak, so Today leaves those two out instead of showing them twice.
{ const base = todayHtml; todayHtml = () => {
  const keep = S.goals; let h = "";
  try { S.goals = arr(keep).filter((g) => g.kind !== "cubesDay"); h = base(); } finally { S.goals = keep; }
  if (y15StreakLine()) h = h.replace(/<span class="pill gold">\d+ wins in a row<\/span>/, "").replace('<div class="chiplist"></div>', "");
  return h;
}; }
function y15Today() {
  const from = dayStart(localDate(Date.now())); let cubes = 0, games = 0;
  for (const m of realMatches()) { if (m.ts < from) break; if (m.noCubes) continue; games++; cubes += num(m.cubes); }
  return { cubes, games };
}
function y15Ring(p, text, aria) {
  const r = 40, c = 2 * Math.PI * r, off = c * (1 - clamp(p, 0, 100) / 100);
  return `<svg class="ring" viewBox="0 0 96 96" role="img" aria-label="${esc(aria)}"><defs><linearGradient id="y15rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--snap-a)"/><stop offset="1" stop-color="var(--snap-b)"/></linearGradient></defs><circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="9"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="url(#y15rg)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 48 48)"/><text x="48" y="56" text-anchor="middle" font-size="${String(text).length > 3 ? 20 : 25}">${esc(text)}</text></svg>`;
}
function y15GoalCard() {
  const g = y15CubeGoal();
  if (!g) return realMatches().length ? `<section class="sec"><div class="panel row between nowrap"><div class="stack" style="gap:2px;min-width:0"><b>Daily cube goal</b><span class="small muted">Pick a target and a ring here tracks today's net cubes.</span></div><div class="row nowrap">${[5, 10, 20].map((n) => `<button class="btn sm" data-a="y15GoalSet" data-v="${n}">+${n}</button>`).join("")}</div></div></section>` : "";
  const t = y15Today(), target = Math.max(1, num(g.target)), done = t.cubes >= target;
  const p = done ? 100 : Math.max(0, Math.round((t.cubes / target) * 100));
  return `<section class="sec"><div class="panel y15goal halftone">${y15Ring(p, signed(t.cubes), `${signed(t.cubes)} of ${target} cubes today`)}<div class="stack" style="gap:4px;min-width:0">
    <div class="row between nowrap"><span class="eyebrow">Daily cube goal</span>${done ? `<span class="pill W">Reached!</span>` : ""}</div>
    <div class="num" style="font-size:20px;font-weight:800">${signed(t.cubes)} <span class="muted small" style="font-weight:600">of +${target} today</span></div>
    <span class="small muted">${done ? `Goal hit in ${plural(t.games, "game")}. Anything more is a bonus.` : t.games ? `${plural(t.games, "game")} today · ${target - t.cubes} more to go` : "No games yet today."}</span>
    <div class="row nowrap"><div class="stepper"><button data-a="y15GoalStep" data-v="-5" aria-label="Lower the goal by 5">−</button><span>+${target}</span><button data-a="y15GoalStep" data-v="5" aria-label="Raise the goal by 5">+</button></div><button class="btn sm ghost" data-a="goalDel" data-id="${esc(g.id)}">Remove</button></div></div></div></section>`;
}
y15GoalCard.ext = { id: "cubeGoal", label: "Daily cube goal", sub: "Today's cubes against your goal" };
EXT.homeTop.push(y15GoalCard);

/* ---------- 5. Rank ETA: when you'd reach the next tier and Infinite at your pace (the same pace as Rank climb) ---------- */
// The game's rank tiers and the rank each starts at (Infinite is rank 100)
const Y15_TIERS = [["Recruit", 1], ["Agent", 5], ["Iron", 10], ["Bronze", 20], ["Silver", 30], ["Gold", 40], ["Platinum", 50], ["Diamond", 60], ["Vibranium", 70], ["Omega", 80], ["Galactic", 90], ["Infinite", 100]];
// Your rank right now: from the rank climb when it's set up, else the rank typed into your profile
function y15RankNow() {
  const st = typeof climbNow === "function" ? climbNow() : null;
  if (st) return st.stale || st.inf ? null : { rank: st.rank, cubes: st.cubes };
  const r = rankFromStr(S.me.rank); return r >= 1 && r < 100 ? { rank: r, cubes: 0 } : null;
}
function y15RankEtaHtml() {
  const now = y15RankNow(); if (!now) return "";
  // The same pace as the Rank climb panel above it (cubes a game over your last 50 Ranked games, games a day over 14 days),
  // so both panels give the same games and days to Infinite
  const pace = climbPace(); if (pace.n < 10 || !pace.gpd) return "";
  const have = now.rank * cpr() + now.cubes; const cpg = Math.round(pace.cpg * 10) / 10, gpd = Math.round(pace.gpd * 10) / 10, cpg2 = Math.round(pace.cpg * 100) / 100;
  const eta = (r) => { const need = r * cpr() - have; if (need <= 0 || cpg2 <= 0) return null; const games = Math.ceil(need / cpg2); return { games, days: Math.ceil(games / pace.gpd) }; };
  const dayTxt = (d) => (d > 365 ? "more than a year" : d > 60 ? `about ${Math.round(d / 30)} months` : `about ${plural(d, "day")}`);
  const row = (name, r) => { const e = eta(r); return e ? `<div class="li"><span class="pill gold">Rank ${r}</span><div class="grow"><div class="t">${esc(name)} in ${dayTxt(e.days)}</div><div class="s">≈ ${plural(e.games, "game")} · rank ${r} is ${fmt(r * cpr() - have)} cubes away</div></div></div>` : ""; };
  const next = Y15_TIERS.find(([, r]) => r > now.rank);
  const body = cpg2 > 0 ? `<div class="list">${next && next[1] < 100 ? row(next[0], next[1]) : ""}${row("Infinite", 100)}</div>` : `<div class="panel small">You're not gaining cubes over your last ${plural(pace.n, "Ranked game")} (${signed(cpg)} a game), so there's no climb to time yet. Keep logging Ranked games.</div>`;
  return y15Sec("Rank ETA", `${body}<p class="muted small">At this pace: ${signed(cpg)} cubes a game over your last ${plural(pace.n, "Ranked game")} and ${gpd} games a day (last 14 days), starting from rank ${now.rank}. Cubes per rank = ${cpr()}.</p>`);
}

/* ---------- 6. Highlights: the biggest wins and toughest losses this period ---------- */
function y15HighlightsHtml() {
  const R = y15Memo("hi", (ms) => {
    const c = ms.filter((m) => !m.noCubes && num(m.cubes));
    return { wins: c.filter((m) => num(m.cubes) > 0).sort((a, b) => num(b.cubes) - num(a.cubes) || b.ts - a.ts).slice(0, 3), losses: c.filter((m) => num(m.cubes) < 0).sort((a, b) => num(a.cubes) - num(b.cubes) || b.ts - a.ts).slice(0, 3) };
  });
  if (!R.wins.length && !R.losses.length) return y15Sec("Highlights", y15Empty("No highlights yet", "Your biggest wins and toughest losses in this period show up here. Tap one to open the match."));
  return y15Sec("Highlights", `<div class="stack">${R.wins.length ? `<span class="eyebrow">Biggest wins</span><div class="list">${R.wins.map((m) => y15MatchRow(m)).join("")}</div>` : ""}${R.losses.length ? `<span class="eyebrow">Toughest losses</span><div class="list">${R.losses.map((m) => y15MatchRow(m)).join("")}</div>` : ""}</div>`);
}

/* ---------- 7. Deck vs deck ---------- */
const y15cmp = { a: "", b: "" };
// Matches grouped by deck, the way "Decks played" groups them (by the deck, or its name for decks that are gone)
function y15DeckGroups(ms) {
  const g = {};
  for (const m of ms) { const d = m.deckId && S.decks.find((x) => x.id === m.deckId); const k = d ? "id:" + d.id : "name:" + (m.deckName || "No deck"); (g[k] = g[k] || { k, name: d ? d.name : m.deckName || "No deck", ms: [] }).ms.push(m); }
  return Object.values(g).sort((a, b) => b.ms.length - a.ms.length);
}
function y15CompareHtml() {
  const groups = y15Memo("groups", y15DeckGroups); if (groups.length < 2) return "";
  return y15Sec("Deck vs deck", `<div class="panel row between nowrap"><span class="small" style="min-width:0">Put two of the decks you played this period side by side.</span><button class="btn sm" data-a="y15CmpOpen">Compare</button></div>`);
}
function y15CmpSheet() {
  const groups = y15Memo("groups", y15DeckGroups);
  if (groups.length < 2) return `${sheetHead("Deck vs deck")}<p class="muted small">Play two different decks in this period to compare them.</p>`;
  if (!groups.some((g) => g.k === y15cmp.a)) y15cmp.a = groups[0].k;
  if (!groups.some((g) => g.k === y15cmp.b) || y15cmp.b === y15cmp.a) y15cmp.b = groups.find((g) => g.k !== y15cmp.a).k;
  const pick = (side, label) => `<label class="f">${label}<select data-y15cmp="${side}">${groups.map((g) => `<option value="${esc(g.k)}" ${y15cmp[side] === g.k ? "selected" : ""}>${esc(g.name)} (${g.ms.length})</option>`).join("")}</select></label>`;
  const stat = (g) => { const s = statsFor(g.ms); const loc = locationAnalytics(g.ms).filter((x) => x.lw + x.ll >= 2).sort((a, b) => b.lwr - a.lwr || b.games - a.games)[0]; return { ...s, loc: loc ? `${loc.name} (won it ${loc.lwr}%)` : "—" }; };
  const ga = groups.find((g) => g.k === y15cmp.a), gb = groups.find((g) => g.k === y15cmp.b), a = stat(ga), b = stat(gb);
  const rows = [
    ["Games", a.games, b.games, 0], ["Record", `${a.w}-${a.l}-${a.t}`, `${b.w}-${b.l}-${b.t}`, a.wr - b.wr], ["Win %", a.wr + "%", b.wr + "%", a.wr - b.wr],
    ["Cubes a game", signed(a.cpg), signed(b.cpg), a.cpg - b.cpg], ["Net cubes", signed(a.cubes), signed(b.cubes), a.cubes - b.cubes],
    ["Snaps won", a.snaps ? `${a.snapW} of ${a.snaps}` : "—", b.snaps ? `${b.snapW} of ${b.snaps}` : "—", a.snaps && b.snaps ? a.snapWr - b.snapWr : 0],
    ["Best location", a.loc, b.loc, 0],
  ];
  const cell = (v, better) => `<td class="n ${better ? "pos" : ""}" style="white-space:normal">${esc(String(v))}</td>`;
  const hd = (name) => `<th class="n" style="max-width:120px;white-space:normal">${esc(name)}</th>`;
  return `${sheetHead("Deck vs deck", esc(y15Pool().p.label) + (ui.homeMode ? ` · ${esc(ui.homeMode === "@events" ? "Events & other" : ui.homeMode)}` : ""))}
    <div class="grid2">${pick("a", "Deck A")}${pick("b", "Deck B")}</div>
    <div class="tbl-wrap"><table><thead><tr><th></th>${hd(ga.name)}${hd(gb.name)}</tr></thead><tbody>${rows.map(([k, va, vb, d]) => `<tr><td>${k}</td>${cell(va, d > 0)}${cell(vb, d < 0)}</tr>`).join("")}</tbody></table></div>
    <p class="muted small">The better number is green. Best location needs two or more tracked games there.</p>
    <button class="btn snap block" data-a="close">Done</button>`;
}

/* ---------- 8. Streaks ---------- */
// Ties don't break a streak, and don't count toward one
function y15Streaks(ms) {
  const asc = ms.filter(y15Decided).sort((a, b) => a.ts - b.ts);
  let cur = { r: "", n: 0 }, bestW = { n: 0, end: 0 }, bestL = { n: 0, end: 0 };
  for (const m of asc) {
    if (m.result === cur.r) cur.n++; else cur = { r: m.result, n: 1 };
    if (cur.r === "W" && cur.n > bestW.n) bestW = { n: cur.n, end: m.ts }; if (cur.r === "L" && cur.n > bestL.n) bestL = { n: cur.n, end: m.ts };
  }
  return { cur, bestW, bestL, last: asc.length ? asc[asc.length - 1].ts : 0 };
}
// Home's streak line is your streak right now, over all your games (it replaces Today's "wins in a row", which counts every
// game too): the period and mode chips of Home › Stats don't change it.
let _y15NowVer = -1, _y15Now = null;
function y15StreakLine() {
  if (_y15NowVer !== _mVer || !_y15Now) { _y15Now = y15Streaks(realMatches()); _y15NowVer = _mVer; }
  const R = _y15Now; if (R.cur.n < 2) return "";
  return `<section class="sec"><div class="row small nowrap"><span class="pill ${R.cur.r}">${R.cur.r}${R.cur.n} streak</span><span class="muted" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${R.cur.n} ${R.cur.r === "W" ? "wins" : "losses"} in a row · last game ${esc(agoTxt(R.last))}</span></div></section>`;
}
y15StreakLine.ext = { id: "streakLine", label: "Win streak line", sub: "Above Match stats" };
EXT.homeTop.push(y15StreakLine);
function y15StreaksHtml() {
  const R = y15Memo("streaks", y15Streaks);
  if (!R.cur.n) return y15Sec("Streaks", y15Empty("No streaks yet", "Win or lose a few in a row and they're counted here."));
  const when = (x) => (x.n ? `ended ${dayStr(x.end)}` : "—");
  return y15Sec("Streaks", `<div class="tiles y15t3">${y15Tile("Right now", `${R.cur.r}${R.cur.n}`, R.cur.r === "W" ? "pos" : "neg")}${y15Tile("Longest win streak", R.bestW.n ? `W${R.bestW.n}` : "—", "pos")}${y15Tile("Longest loss streak", R.bestL.n ? `L${R.bestL.n}` : "—", "neg")}</div><p class="muted small">${R.cur.n === 1 ? `Your last game was a ${R.cur.r === "W" ? "win" : "loss"}.` : `${R.cur.n} ${R.cur.r === "W" ? "wins" : "losses"} in a row right now.`} Best win streak ${when(R.bestW)}, worst loss streak ${when(R.bestL)}. Ties don't break a streak.</p>`);
}

/* ---------- 9. Clutch factor: how you do when 8 cubes are on the line vs 1–2 ---------- */
function y15ClutchHtml() {
  const R = y15Memo("clutch", (ms) => {
    const c = ms.filter((m) => y15Decided(m) && !m.noCubes && num(m.cubes));
    const bucket = (f) => { const l = c.filter((m) => f(Math.abs(num(m.cubes)))); const w = l.filter((m) => m.result === "W").length; return { g: l.length, w, l: l.length - w, wr: y15Wr(w, l.length - w), cubes: l.reduce((s, m) => s + num(m.cubes), 0) }; };
    return { small: bucket((a) => a <= 2), mid: bucket((a) => a === 4), big: bucket((a) => a >= 8) };
  });
  const need = 5;
  if (R.big.g < need || R.small.g < need) return y15Sec("Clutch factor", y15Empty("Not enough big games yet", `This compares your 8-cube games with your 1–2 cube games. It needs ${need} of each in this period (you have ${R.big.g} and ${R.small.g}).`));
  const d = R.big.wr - R.small.wr;
  const read = R.big.wr >= 55 && d >= 5 ? `You hold your nerve: <b>${R.big.wr}%</b> in 8-cube games, against ${R.small.wr}% in 1–2 cube games.`
    : R.big.wr < 45 && d <= -5 ? `Big pots bite: you win only <b>${R.big.wr}%</b> of 8-cube games (${R.small.wr}% in small ones). Retreating earlier when they snap back would save cubes.`
    : `Steady hands: about the same win rate whether 8 or 1–2 cubes are on the line (${R.big.wr}% vs ${R.small.wr}%).`;
  const row = (label, b) => `<tr><td>${label} cubes</td><td class="n">${b.g}</td><td class="n">${b.w}-${b.l}</td><td class="n ${b.wr >= 50 ? "pos" : "neg"}">${b.wr}%</td><td class="n ${b.cubes >= 0 ? "pos" : "neg"}">${signed(b.cubes)}</td></tr>`;
  return y15Sec("Clutch factor", `<p class="small" style="margin:0">${read}</p><div class="tbl-wrap y15tbl"><table><thead><tr><th>At stake</th><th class="n">Games</th><th class="n">W-L</th><th class="n">Win %</th><th class="n">Net</th></tr></thead><tbody>${row("1–2", R.small)}${R.mid.g ? row("4", R.mid) : ""}${row("8", R.big)}</tbody></table></div>`);
}

/* ---------- 10. Rivals: improves the existing Rivals section (skips likely bots, follows the period and mode chips, top 10) ---------- */
rivalsHtml = function () {
  const R = y15Memo("rivals", (ms) => {
    const by = {};
    for (const m of ms) { if (m.bot === "likely") continue; const k = keyOf(m.oppName); if (k) (by[k] = by[k] || []).push(m); }
    const noted = Object.keys(obj(S.opp)).filter((k) => obj(S.opp[k]).note);
    const rows = Object.entries(by).filter(([k, l]) => l.length >= 2 || noted.includes(k)).map(([k, l]) => ({ k, name: l[0].oppName, st: statsFor(l), last: l[0].ts, note: !!obj(obj(S.opp)[k]).note }));
    noted.forEach((k) => { if (!by[k]) rows.push({ k, name: obj(S.opp[k]).name || k, st: statsFor([]), last: 0, note: true }); });
    return rows.sort((a, b) => b.st.games - a.st.games || b.last - a.last).slice(0, 10);
  });
  if (!R.length) return `<p class="muted small">Type your opponent's name in the live tracker or match form. Anyone you meet twice in this period shows up here with your record against them. Likely bots are left out.</p>`;
  return `<div class="list">${R.map((r) => `<button class="li" data-a="rivalOpen" data-v="${esc(r.name)}"><div class="grow" style="min-width:0"><div class="t">${esc(r.name)}${r.note ? ` <span class="pill dim">Note</span>` : ""}</div><div class="s">${r.st.games ? `${plural(r.st.games, "game")} · ${r.st.w}-${r.st.l}${r.st.t ? "-" + r.st.t : ""} · ${signed(r.st.cubes)} cubes · last met ${esc(agoTxt(r.last))}` : "Your note · no games in this period"}</div></div><span class="num ${r.st.w + r.st.l ? (r.st.wr >= 50 ? "pos" : "neg") : "muted"}" style="font-weight:800">${r.st.w + r.st.l ? r.st.wr + "%" : r.st.games ? "—" : ""}</span></button>`).join("")}</div><p class="muted small">Opponents you've met more than once in this period, likely bots left out. Tap one for all your games against them and your notes.</p>`;
};

/* ---------- 11. Report card: a letter grade for each deck with 10 or more games this period ---------- */
// Score = win % above 50, plus 10 × cubes a game. A is 20 or more, B 10, C 0, D −10, F below that.
function y15Grade(wr, cpg) { const s = wr - 50 + cpg * 10; return { s: Math.round(s), g: s >= 20 ? "A" : s >= 10 ? "B" : s >= 0 ? "C" : s >= -10 ? "D" : "F" }; }
const Y15_GRADE_CLS = { A: "W", B: "W", C: "gold", D: "warn", F: "L" };
function y15ReportHtml() {
  const R = y15Memo("report", (ms) => {
    const groups = y15Memo("groups", y15DeckGroups);
    const rows = groups.filter((g) => g.ms.length >= 10).map((g) => { const s = statsFor(g.ms); return { name: g.name, ...s, ...y15Grade(s.wr, s.cpg) }; }).filter((r) => r.w + r.l).sort((a, b) => b.s - a.s || b.games - a.games);
    return { rows, closest: groups.find((g) => g.ms.length < 10) };
  });
  const how = `<p class="muted small" title="Score = win % above 50, plus 10 × cubes a game. A is 20 or more, B 10, C 0, D −10, F below that.">How grades work: a deck scores its win % above 50, plus 10 × its cubes a game. 20 or more is an <b>A</b>, 10 a <b>B</b>, 0 a <b>C</b>, −10 a <b>D</b>, below that an <b>F</b>. Decks with 10 or more games in this period.</p>`;
  if (!R.rows.length) return y15Sec("Report card", y15Empty("No grades yet", `Decks get a grade once they have 10 games in this period.${R.closest ? ` Closest: ${esc(R.closest.name)} with ${plural(R.closest.ms.length, "game")}.` : ""}`));
  return y15Sec("Report card", `<div class="tbl-wrap y15tbl y15grade"><table><thead><tr><th>Grade</th><th>Deck</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Cubes / game</th></tr></thead><tbody>${R.rows.map((r) => `<tr><td><span class="pill ${Y15_GRADE_CLS[r.g]}" title="Score ${signed(r.s)}">${r.g}</span></td><td style="white-space:normal;overflow-wrap:anywhere">${esc(r.name)}</td><td class="n">${r.games}</td><td class="n">${r.wr}%</td><td class="n ${r.cpg >= 0 ? "pos" : "neg"}">${signed(r.cpg)}</td></tr>`).join("")}</tbody></table></div>${how}`);
}

/* ---------- 12. Personal bests, all time (worked out once per match change, kept in memory) ---------- */
let _y15PbVer = -1, _y15Pb = null;
function y15Bests() {
  if (_y15PbVer === _mVer && _y15Pb) return _y15Pb;
  const ms = realMatches(), cubed = ms.filter((m) => !m.noCubes);
  const best = (keyOf_) => { const g = {}; for (const m of cubed) { const k = keyOf_(m); const r = (g[k] = g[k] || { k, cubes: 0, g: 0, w: 0, l: 0, ts: m.ts }); r.cubes += num(m.cubes); r.g++; if (m.result === "W") r.w++; else if (m.result === "L") r.l++; r.ts = Math.min(r.ts, m.ts); } return Object.values(g).sort((a, b) => b.cubes - a.cubes || b.ts - a.ts)[0] || null; };
  const sessions = typeof sessionsOf === "function" ? sessionsOf(cubed) : [];
  const session = sessions.filter((s) => s.ms.length >= 2).map((s) => ({ ...statsFor(s.ms), start: s.start, n: s.ms.length })).sort((a, b) => b.cubes - a.cubes || b.start - a.start)[0] || null;
  _y15Pb = { n: ms.length, day: best((m) => localDate(m.ts)), week: best((m) => weekKey(m.ts)), session, streak: y15Streaks(ms).bestW, top: cubed.filter((m) => num(m.cubes) > 0).sort((a, b) => num(b.cubes) - num(a.cubes) || b.ts - a.ts)[0] || null };
  _y15PbVer = _mVer; return _y15Pb;
}
function y15BestsHtml() {
  const B = y15Bests();
  const li = (k, v, sub, cls = "pos") => `<div class="li"><div class="grow"><div class="t">${k}</div><div class="s">${sub}</div></div><span class="num ${cls}" style="font-weight:800;font-size:18px">${v}</span></div>`;
  const rows = [];
  if (B.day && B.day.cubes > 0) rows.push(li("Best day", signed(B.day.cubes), `${esc(dateStr(B.day.k))} · ${B.day.w}-${B.day.l} in ${plural(B.day.g, "game")}`));
  if (B.week && B.week.cubes > 0) rows.push(li("Best week", signed(B.week.cubes), `week of ${esc(dateStr(B.week.k.slice(1)))} · ${B.week.w}-${B.week.l} in ${plural(B.week.g, "game")}`));
  if (B.session && B.session.cubes > 0) rows.push(li("Best session", signed(B.session.cubes), `${esc(dateTimeStr(B.session.start))} · ${B.session.w}-${B.session.l} in ${plural(B.session.n, "game")}`));
  if (B.streak.n >= 2) rows.push(li("Longest win streak", `W${B.streak.n}`, `ended ${esc(dayStr(B.streak.end))}`));
  if (B.top) rows.push(`<button class="li" data-a="matchEdit" data-id="${esc(B.top.id)}"><div class="grow"><div class="t">Biggest single win</div><div class="s">${esc(B.top.deckName || "No deck")}${B.top.oppName ? ` vs ${esc(B.top.oppName)}` : ""} · ${esc(dayStr(B.top.ts))}</div></div><span class="num pos" style="font-weight:800;font-size:18px">${signed(num(B.top.cubes))}</span></button>`);
  if (!rows.length) return y15Sec("Personal bests", y15Empty("No records yet", "Your best day, week and session, longest win streak and biggest single win (all time) will show here."));
  return y15Sec("Personal bests", `<div class="list">${rows.join("")}</div><p class="muted small">All time, every mode. A session is a run of games with no break longer than 45 minutes.</p>`);
}

/* ---------- Where it all shows ---------- */
EXT.homeStats.push(y15RankEtaHtml, y15HighlightsHtml, y15StreaksHtml, y15ClutchHtml, y15ReportHtml, y15CompareHtml, y15HoursHtml, y15WeekdaysHtml, y15BestsHtml);

Object.assign(A, {
  y15Cell: (el) => { const k = "y15sel_" + el.dataset.k, i = num(el.dataset.i); ui[k] = ui[k] === i ? undefined : i; render(); },
  y15TiltDismiss: () => { S.tilt = { ...obj(S.tilt), dismissedAt: Date.now() }; save(); render(); },
  y15GoalSet: (el) => { const t = clamp(Math.round(num(el.dataset.v)), 1, 999); if (!y15CubeGoal()) S.goals = [...arr(S.goals), { id: uid(), kind: "cubesDay", target: t }].slice(-8); save(); render(); if (typeof saveNotifyState === "function") saveNotifyState(); toast(`Daily goal: +${t} cubes`); },
  y15GoalStep: (el) => { const g = y15CubeGoal(); if (!g) return; const t = Math.max(1, num(g.target)); g.target = clamp(t + num(el.dataset.v), Math.min(5, t), 999); save(); render(); if (typeof saveNotifyState === "function") saveNotifyState(); },
  y15CmpOpen: () => openSheet(y15CmpSheet),
});
document.addEventListener("change", (e) => {
  const t = e.target, d = t && t.dataset; if (!d) return;
  if (d.y15tilt) { S.tilt = { ...obj(S.tilt), off: !t.checked }; save(); return; }
  if (d.y15cmp) { y15cmp[d.y15cmp] = t.value; refreshSheet(); }
});
EXT.styles.push(`
.y15heat { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; }
.y15heat .y15c { border: 0; border-radius: 4px; height: 44px; min-width: 0; padding: 0; background: var(--surface-2); cursor: pointer; }
.y15heat .y15c[aria-pressed="true"] { outline: 2px solid var(--fg); outline-offset: 1px; }
.y15heat.y15lbl span { font-size: 11px; color: var(--muted); text-align: center; }
.y15axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
.y15goal { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; }
.y15goal .ring { width: 84px; height: 84px; }
.y15tilt { border-left: 3px solid var(--warn); }
.y15grade .pill { min-width: 26px; justify-content: center; }
.y15tbl th, .y15tbl td { padding: 9px 7px; }
.y15tbl th:first-child, .y15tbl td:first-child { padding-left: 12px; }
.y15tbl th:last-child, .y15tbl td:last-child { padding-right: 12px; }
.y15grade th:last-child { white-space: normal; max-width: 76px; }
.tiles.y15t3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
`);
