/* ============ y35_coach.js: stats and coaching (October 31, 2026) ============
   51 tilt check 2.0 (play speed and a deck to switch to) · 52 win rate by time since your last break · 53 cubes per hour
   and your best sessions · 54 snap discipline · 55 the date you'd reach Infinite · 56 the decks you face most this week ·
   57 you vs your friends against the same decks · 58 one-tap weekly goals · 59 the AI coach's weekly letter ·
   60 lucky and unlucky games. Most of it is in Home › Stats; 51, 55 and 58 also show on Home. */
const Y35_BREAK = 45 * 60e3;   // a gap this long starts a new session
const y35Ranked = (ms) => ms.filter((m) => modeOf(m) === "Ranked");
const y35Sec = (title, body, sub = "") => `<section class="sec"><div class="sec-h"><h2>${esc(title)}</h2>${sub ? `<span class="muted small">${sub}</span>` : ""}</div>${body}</section>`;
// Your matches split into sessions (oldest first), each with its games newest-last
function y35Sessions(ms) { const s = [...ms].sort((a, b) => a.ts - b.ts), out = []; let cur = null; for (const m of s) { if (!cur || m.ts - cur[cur.length - 1].ts > Y35_BREAK) out.push((cur = [])); cur.push(m); } return out; }
const y35Period = () => inPeriod(realMatches(), periodById(ui.period));

/* ---------- 51. Tilt check 2.0: faster play and losses → a break, or a different deck ---------- */
function y35Gap(ms) { const g = []; for (let i = 1; i < ms.length; i++) { const d = ms[i - 1].ts - ms[i].ts; if (d > 0 && d < Y35_BREAK) g.push(d); } return g.sort((a, b) => a - b)[Math.floor(g.length / 2)] || 0; }
function y35Tilt() {
  const ms = realMatches(); if (ms.length < 8 || Date.now() - ms[0].ts > 2 * 3600e3) return null;
  const recent = ms.slice(0, 6), losses = recent.filter((m) => m.result === "L").length;
  const usual = y35Gap(ms.slice(6, 200)), now = y35Gap(recent), fast = usual > 0 && now > 0 && now < usual * 0.7;
  if (!(losses >= 4 || (losses >= 3 && fast))) return null;
  const cur = ms[0].deckId || ms[0].deckName, since = Date.now() - 30 * DAY, by = {};
  ms.filter((m) => m.ts >= since).forEach((m) => { const k = m.deckId || m.deckName; if (k && k !== cur) (by[k] = by[k] || { name: m.deckName || "A deck", id: m.deckId || "", ms: [] }).ms.push(m); });
  const alt = Object.values(by).map((d) => ({ ...d, st: statsFor(d.ms) })).filter((d) => d.st.games >= 5).sort((a, b) => b.st.wr - a.st.wr)[0] || null;
  return { losses, fast, usual, now, alt, at: ms[0].ts };
}
function tilt2Html() {
  if (typeof y15TiltOn === "function" && !y15TiltOn()) return "";
  const t = y35Tilt(); if (!t || num(obj(S.tilt).dismissedAt) >= t.at) return "";
  const y15 = typeof y15TiltCard === "function" ? y15TiltCard() : "";
  const deck = t.alt ? `Switch it up: <b>${esc(t.alt.name)}</b> won ${t.alt.st.wr}% of ${t.alt.st.games} games this month.` : "";
  if (y15) return deck ? `<section class="sec"><div class="panel small y35-tilt">${deck}${t.alt.id ? ` <button class="btn sm" data-a="deckOpen" data-id="${esc(t.alt.id)}">Open it</button>` : ""}</div></section>` : "";
  return `<section class="sec"><div class="panel stack small y35-tilt"><b>${t.losses} of your last 6 lost${t.fast ? ", and you're playing faster than usual" : ""}.</b>
    <span>${t.fast ? `About ${Math.max(1, Math.round(t.now / 60e3))} min a game now, ${Math.max(1, Math.round(t.usual / 60e3))} normally. ` : ""}A 10-minute break usually helps more than one more game.</span>${deck ? `<span>${deck}</span>` : ""}
    <div class="row">${t.alt && t.alt.id ? `<button class="btn sm" data-a="deckOpen" data-id="${esc(t.alt.id)}">Open ${esc(t.alt.name)}</button>` : ""}<button class="btn sm ghost" data-a="y35TiltOk">Got it</button></div></div></section>`;
}
tilt2Html.ext = { id: "tilt2", label: "Tilt check", sub: "When losses pile up and you speed up" };
EXT.homeTop.push(tilt2Html);

/* ---------- 52. Win rate by time since your last break ---------- */
function breakHtml() {
  const ss = y35Sessions(y35Period()); if (ss.reduce((n, s) => n + s.length, 0) < 15) return "";
  const B = [["first", "First game after a break", (i) => i === 0], ["early", "Games 2 to 5", (i) => i >= 1 && i <= 4], ["mid", "Games 6 to 10", (i) => i >= 5 && i <= 9], ["long", "Game 11 or later", (i) => i >= 10]];
  const rows = B.map(([k, l, f]) => ({ l, st: statsFor(ss.flatMap((s) => s.filter((_, i) => f(i)))) })).filter((r) => r.st.games);
  const best = [...rows].filter((r) => r.st.games >= 5).sort((a, b) => b.st.wr - a.st.wr)[0];
  return y35Sec("Since your last break", `<div class="tbl-wrap"><table><thead><tr><th>When</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Cubes/game</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.l)}</td><td class="n num">${r.st.games}</td><td class="n num ${r.st.wr >= 55 ? "pos" : r.st.wr < 45 ? "neg" : ""}">${r.st.wr}%</td><td class="n num">${signed(r.st.cpg)}</td></tr>`).join("")}</tbody></table></div>
    <p class="muted small">${best ? `You do best ${best.l.toLowerCase()}. ` : ""}A break is ${Y35_BREAK / 60e3} minutes or more without a game.</p>`);
}
EXT.homeStats.push(breakHtml);

/* ---------- 53. Cubes per hour, and your best sessions ---------- */
function perHourHtml() {
  const ss = y35Sessions(y35Period()).filter((s) => s.length >= 3); if (!ss.length) return "";
  const rows = ss.map((s) => { const st = statsFor(s), mins = Math.max(10, (s[s.length - 1].ts - s[0].ts) / 60e3 + 4); return { s, st, mins, cph: Math.round((st.cubes / mins) * 600) / 10 }; });
  const tot = rows.reduce((a, r) => ({ c: a.c + r.st.cubes, m: a.m + r.mins }), { c: 0, m: 0 }), avg = Math.round((tot.c / tot.m) * 600) / 10;
  const top = [...rows].sort((a, b) => b.cph - a.cph).slice(0, 3);
  return y35Sec("Cubes per hour", `<div class="kpis"><div class="kpi"><div class="v num ${avg >= 0 ? "pos" : "neg"}">${signed(avg)}</div><div class="k">cubes an hour on average</div></div><div class="kpi"><div class="v num">${rows.length}</div><div class="k">sessions of 3+ games</div></div></div>
    <span class="eyebrow">Your best sessions</span><div class="list">${top.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(dateTimeStr(r.s[0].ts))} · ${Math.round(r.mins)} min</div><div class="s">${r.st.games} games · ${r.st.w}-${r.st.l} · ${signed(r.st.cubes)} cubes</div></div><span class="pill ${r.cph >= 0 ? "W" : "L"} num">${signed(r.cph)}/h</span></div>`).join("")}</div>
    <p class="muted small">Session length counts from the first game to the last, plus about 4 minutes for the last game.</p>`);
}
EXT.homeStats.push(perHourHtml);

/* ---------- 54. Snap discipline ---------- */
function snapDisciplineHtml() {
  const ms = y35Period().filter((m) => !m.noCubes); if (ms.length < 10) return "";
  const sn = ms.filter((m) => m.snapped), no = ms.filter((m) => !m.snapped), a = statsFor(sn), b = statsFor(no);
  const ranAfter = sn.filter((m) => m.retreated).length, theirs = ms.filter((m) => m.oppSnapped), stayed = theirs.filter((m) => !m.retreated), st = statsFor(stayed);
  const turnOf = (m) => num(m.snapTurn); const timed = sn.filter(turnOf), early = timed.filter((m) => turnOf(m) <= 3), late = timed.filter((m) => turnOf(m) >= 5);
  const verdict = a.games < 3 ? "You rarely snap. When the board looks good on turn 5 or 6, a snap doubles what you win." : a.wr >= 60 ? "Your snaps are paying off: keep trusting them." : a.wr < 45 ? "Your snaps lose more than they win: wait a turn longer before snapping." : "Your snaps are about even: snap later, with more of their deck seen.";
  return y35Sec("Snap discipline", `<div class="kpis"><div class="kpi"><div class="v num">${pct(sn.length, ms.length)}%</div><div class="k">of games you snapped</div></div><div class="kpi"><div class="v num ${a.wr >= 50 ? "pos" : "neg"}">${a.games ? a.wr + "%" : "—"}</div><div class="k">won when you snapped</div></div>
      <div class="kpi"><div class="v num">${a.games ? signed(a.cpg) : "—"}</div><div class="k">cubes a game snapped</div></div><div class="kpi"><div class="v num">${b.games ? signed(b.cpg) : "—"}</div><div class="k">cubes a game without</div></div></div>
    <div class="panel small stack"><b>${esc(verdict)}</b>
      <span>${ranAfter ? `You retreated after ${ranAfter} of your ${sn.length} snaps.` : sn.length ? "You never retreated after snapping." : ""}${theirs.length ? ` When they snapped, you stayed in ${stayed.length} of ${theirs.length} and won ${st.wr}% of those.` : ""}</span>
      ${timed.length >= 5 ? `<span class="muted">Early snaps (turn 1-3): ${statsFor(early).wr}% won · late snaps (turn 5-6): ${statsFor(late).wr}% won.</span>` : ""}</div>`);
}
EXT.homeStats.push(snapDisciplineHtml);

/* ---------- 55. The date you'd reach Infinite ---------- */
function infDate() {
  if (typeof y15RankNow !== "function" || typeof climbPace !== "function") return null;
  const now = y15RankNow(); if (!now) return null; const pace = climbPace(); if (pace.n < 10 || !pace.gpd || pace.cpg <= 0) return null;
  const need = 100 * cpr() - (now.rank * cpr() + now.cubes); if (need <= 0) return null;
  const days = Math.ceil(need / pace.cpg / pace.gpd), cs = currentSeason();
  return { days, at: Date.now() + days * DAY, rank: now.rank, beforeEnd: cs && Number.isFinite(cs.endTs) ? Date.now() + days * DAY <= cs.endTs : null };
}
function infDateHtml() {
  const x = infDate(); if (!x || x.days > 120) return "";
  const d = new Date(x.at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `<section class="sec"><div class="panel row nowrap y35-inf"><span class="y35-infd">${esc(d)}</span><div class="grow"><b>At this pace you'll hit Infinite on ${esc(d)}</b><div class="small muted">From rank ${x.rank}, ${plural(x.days, "day")} away${x.beforeEnd === true ? " · before the season ends" : x.beforeEnd === false ? " · after this season ends, so push a little harder" : ""}</div></div></div></section>`;
}
infDateHtml.ext = { id: "infDate", label: "Infinite date", sub: "When you'd reach Infinite at your pace" };
EXT.homeTop.push(infDateHtml);

/* ---------- 56. The decks you face most this week ---------- */
function metaHtml() {
  const wk = weekKey(Date.now()), ms = y35Ranked(realMatches()).filter((m) => weekKey(m.ts) === wk && arr(m.oppCards).length >= 2);
  if (ms.length < 3) return y35Sec("Your meta this week", `<div class="empty"><strong>Not enough games yet</strong><span>Add the cards your opponents play in Ranked (the live tracker or match form). After 3 games this shows the decks you face most.</span></div>`);
  const by = {}; ms.forEach((m) => { const a = m.oppArch || archetypeOf(m.oppCards) || "Other"; (by[a] = by[a] || []).push(m); });
  const rows = Object.entries(by).map(([a, l]) => ({ a, st: statsFor(l), n: l.length })).sort((x, y) => y.n - x.n).slice(0, 6);
  const ranks = ms.map((m) => num(m.rank)).filter(Boolean);
  return y35Sec("Your meta this week", `<div class="list">${rows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.a)}</div><div class="bar"><i style="width:${pct(r.n, ms.length)}%"></i></div></div><div class="stack" style="gap:0;align-items:flex-end"><b class="num">${pct(r.n, ms.length)}%</b><span class="small ${r.st.wr >= 50 ? "pos" : "neg"}">you win ${r.st.wr}%</span></div></div>`).join("")}</div>
    <p class="muted small">From ${plural(ms.length, "Ranked game")} this week${ranks.length ? ` around rank ${Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length)}` : S.me.rank ? ` at rank ${esc(S.me.rank)}` : ""}. Deck types are guessed from the cards they played.</p>`, "Ranked");
}
EXT.homeStats.push(metaHtml);

/* ---------- 57. You vs your friends, against the same decks ---------- */
// Each player can share how they do against each deck type (h2h/{uid}); private profiles never share it
function myVsArch() { const by = {}; y35Ranked(realMatches()).filter((m) => m.ts >= Date.now() - 60 * DAY && arr(m.oppCards).length >= 2).forEach((m) => { const a = m.oppArch || archetypeOf(m.oppCards); if (!a) return; const r = (by[a] = by[a] || [0, 0]); if (m.result === "W") r[0]++; else if (m.result === "L") r[1]++; }); return by; }
let _y35H2hAt = 0;
async function h2hPublish() {
  if (store.mode !== "cloud" || !store.db || SLOT || S.me.visibility === "private" || S.me.share === false || Date.now() - _y35H2hAt < 30 * 60e3) return;
  _y35H2hAt = Date.now(); const a = myVsArch(); const keys = Object.keys(a).slice(0, 30), out = {}; keys.forEach((k) => (out[k.slice(0, 30)] = a[k]));
  try { await store.db.doc("h2h/" + store.uid).set({ arch: out, at: Date.now() }); } catch { /* rules not pasted yet */ }
}
EXT.onMatch.push((m, isNew) => { if (isNew && !m.example) setTimeout(h2hPublish, 4000); });
const h2h = { pick: "", data: {}, busy: false };
async function h2hLoad(id) {
  if (!id || h2h.data[id] !== undefined || h2h.busy) return; h2h.busy = true;
  try { const s = await store.db.doc("h2h/" + id).get(); h2h.data[id] = s.exists ? obj(s.data()) : null; } catch { h2h.data[id] = null; }
  h2h.busy = false; render();
}
function h2hHtml() {
  if (store.mode !== "cloud") return "";
  const friends = arr(S.following).filter((id) => shared.profiles[id] && canSee(id)).slice(0, 12);
  if (!friends.length) return y35Sec("You vs your friends", `<div class="empty"><strong>Follow a friend first</strong><span>Then see who does better against the same kinds of decks.</span></div>`);
  const id = friends.includes(h2h.pick) ? h2h.pick : friends[0]; if (h2h.data[id] === undefined) setTimeout(() => h2hLoad(id), 0);
  const mine = myVsArch(), theirs = obj(obj(h2h.data[id]).arch), wr = (r) => (r && r[0] + r[1] ? Math.round((r[0] / (r[0] + r[1])) * 100) : null);
  const archs = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter((a) => (arr(mine[a])[0] || 0) + (arr(mine[a])[1] || 0) >= 2 && (arr(theirs[a])[0] || 0) + (arr(theirs[a])[1] || 0) >= 2);
  const body = h2h.data[id] === undefined ? `<p class="muted">Loading…</p>` : !h2h.data[id] ? `<p class="muted">${esc(handleOf(id))} hasn't shared this yet. It fills in after they play a few Ranked games with SNAP Stat updated.</p>`
    : !archs.length ? `<p class="muted">No deck types you've both faced at least twice in the last 60 days yet.</p>`
    : `<div class="tbl-wrap"><table><thead><tr><th>Against</th><th class="n">You</th><th class="n">${esc(handleOf(id))}</th></tr></thead><tbody>${archs.map((a) => { const x = wr(mine[a]), y = wr(theirs[a]); return `<tr><td>${esc(a)}</td><td class="n num ${x > y ? "pos" : ""}">${x}%</td><td class="n num ${y > x ? "pos" : ""}">${y}%</td></tr>`; }).join("")}</tbody></table></div>`;
  return y35Sec("You vs your friends", `<div class="chips">${friends.map((f) => `<button class="chip" data-a="h2hPick" data-id="${esc(f)}" aria-pressed="${f === id}">${esc(handleOf(f))}</button>`).join("")}</div>${body}<p class="muted small">Ranked games in the last 60 days. Win rates are shared only by players with public profiles.</p>`);
}
EXT.homeStats.push(h2hHtml);

/* ---------- 58. One-tap weekly goals on Home ---------- */
function weeklyGoalHtml() {
  if (arr(S.goals).some((g) => obj(GOAL_KINDS[g.kind]).per === "week")) return "";
  const ms = realMatches().filter((m) => m.ts >= Date.now() - 28 * DAY); if (ms.length < 10) return "";
  const st = statsFor(ms), wins = Math.max(5, Math.round((st.w / 4) * 1.1)), cubes = Math.max(10, Math.round((Math.max(0, st.cubes) / 4) * 1.1));
  return `<section class="sec"><div class="panel stack small"><b>Set a goal for this week?</b><span class="muted">From your last 4 weeks, a little higher than usual. Progress bars show under Today.</span>
    <div class="row"><button class="btn sm" data-a="y35Goal" data-k="winsWeek" data-v="${wins}">Win ${wins} games</button><button class="btn sm" data-a="y35Goal" data-k="cubesWeek" data-v="${cubes}">Earn ${cubes} cubes</button><button class="btn sm ghost" data-a="y35GoalNo">Not now</button></div></div></section>`;
}
function weeklyGoalWrap() { return num(S.y35GoalNo) && weekKey(num(S.y35GoalNo)) === weekKey(Date.now()) ? "" : weeklyGoalHtml(); }
weeklyGoalWrap.ext = { id: "weekGoal", label: "Weekly goal idea", sub: "A one-tap goal for the week" };
EXT.homeTop.push(weeklyGoalWrap);

/* ---------- 59. The AI coach's weekly letter ---------- */
const letter = { busy: false, err: "" };
function weekSummaryForAI() {
  const wk = weekKey(Date.now()), ms = realMatches().filter((m) => weekKey(m.ts) === wk), st = statsFor(ms), by = {}, opp = {};
  ms.forEach((m) => { const k = m.deckName || "No deck"; (by[k] = by[k] || []).push(m); const a = m.oppArch || archetypeOf(m.oppCards); if (a) (opp[a] = opp[a] || []).push(m); });
  return { games: st.games, wins: st.w, losses: st.l, cubes: st.cubes, snaps: st.snaps, snapWins: st.snapW, retreats: st.ret, rank: String(S.me.rank || ""),
    decks: Object.entries(by).map(([n, l]) => { const s = statsFor(l); return { deck: n, games: s.games, winPct: s.wr, cubes: s.cubes }; }).slice(0, 6),
    opponents: Object.entries(opp).map(([a, l]) => { const s = statsFor(l); return { deckType: a, games: s.games, winPct: s.wr }; }).slice(0, 6),
    tags: ms.flatMap((m) => arr(m.tags)).slice(0, 30) };
}
async function letterWrite() {
  if (letter.busy) return; if (!aiOn()) { letter.err = "Add an AI key in Settings › AI first."; render(); return; }
  letter.busy = true; letter.err = ""; render();
  try {
    const x = weekSummaryForAI();
    const out = await aiJson(`You are a friendly MARVEL SNAP coach writing a short weekly letter to a player. Here is their week as JSON: ${JSON.stringify(x)}
Write exactly 5 short, specific, encouraging tips (each under 30 words) based on these numbers: what to keep doing, which deck to play more or less, which matchups to prepare for, snapping and retreating. Use plain words. Reply as JSON: {"hello": "one friendly opening sentence", "tips": ["tip 1", "tip 2", "tip 3", "tip 4", "tip 5"]}`);
    const tips = arr(obj(out).tips).map((t) => String(t).slice(0, 220)).filter(Boolean).slice(0, 5);
    if (!tips.length) throw new Error("The AI didn't send any tips. Try again.");
    S.coachLetter = { wk: weekKey(Date.now()), at: Date.now(), hello: String(obj(out).hello || "").slice(0, 200), tips }; save();
  } catch (e) { letter.err = typeof aiErr === "function" ? aiErr(e) : errText(e); }
  letter.busy = false; render();
}
function letterHtml() {
  if (!flagOn("aiLetter")) return "";
  const L = obj(S.coachLetter), fresh = L.wk === weekKey(Date.now()) && arr(L.tips).length, games = realMatches().filter((m) => weekKey(m.ts) === weekKey(Date.now())).length;
  const body = fresh ? `<div class="panel stack small y35-letter">${L.hello ? `<p><i>${esc(L.hello)}</i></p>` : ""}<ol>${L.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ol><span class="muted">Written ${esc(agoTxt(L.at))} from ${plural(games, "game")} this week.</span></div>`
    : games < 5 ? `<div class="empty"><strong>Play a few more games this week</strong><span>After 5 games the coach can write you 5 tips about your week.</span></div>`
    : !aiOn() ? `<div class="empty"><strong>Add an AI key to get your letter</strong><span>The coach uses your own AI service. It's free with a Gemini key.</span><div class="row"><button class="btn sm snap" data-a="go" data-to="settings/ai">Set up AI</button></div></div>`
    : `<div class="panel small stack"><span>${plural(games, "game")} this week. Ask the coach for 5 tips about them.</span></div>`;
  return y35Sec("Coach's weekly letter", `${body}${letter.err ? `<p class="note">${esc(letter.err)}</p>` : ""}${games >= 5 && aiOn() ? `<div class="row"><button class="btn sm ${fresh ? "ghost" : "snap"}" data-a="letterWrite" ${letter.busy ? "disabled" : ""}>${letter.busy ? "Writing…" : fresh ? "Write it again" : "Write my letter"}</button></div>` : ""}`);
}
EXT.homeStats.push(letterHtml);

/* ---------- 60. Lucky and unlucky games ---------- */
const COUNTER_CARDS = new Set(["cosmo", "enchantress", "shadowking", "killmonger", "shangchi", "rogue", "redguardian", "professorx", "armor", "lukecage"]);
let _y35LocAt = -1, _y35Loc = {};
function y35LocWr(deckKey, loc) { if (_y35LocAt !== _mVer) { _y35LocAt = _mVer; _y35Loc = {}; } const k = deckKey + "|" + keyOf(loc); if (_y35Loc[k] === undefined) { const ms = realMatches().filter((m) => (m.deckId || m.deckName) === deckKey && y34Board(m).some((l) => keyOf(l.name) === keyOf(loc))); const st = statsFor(ms); _y35Loc[k] = st.games >= 4 ? st.wr : -1; } return _y35Loc[k]; }
function luck(m) {
  if (!m || !m.result || m.result === "T") return null; const b = y34Board(m), known = y34Known(b), why = [];
  if (m.result === "L") {
    if (known) { const L = y34Lanes(b); if (Math.abs(L.margin) <= 3 || b.some((l) => l.my < l.opp && l.opp - l.my <= 2)) why.push("Lost by a hair"); }
    const dk = m.deckId || m.deckName; if (dk) for (const l of b) { const wr = l.name ? y35LocWr(dk, l.name) : -1; if (wr >= 0 && wr <= 30) { why.push(`${l.name} is tough for this deck (${wr}% wins)`); break; } }
    const slow = arr(m.turns).filter((t) => num(t.n) <= 4 && !arr(t.mine).length).length; if (slow >= 2) why.push("A slow start: nothing to play on two early turns");
    const c = arr(m.oppCards).find((n) => COUNTER_CARDS.has(keyOf(n))); if (c) why.push(`They had ${c}, a counter card`);
    return why.length ? { kind: "unlucky", why } : null;
  }
  if (known) { const L = y34Lanes(b); if (L.won === 1 || Math.abs(L.margin) <= 3) why.push("A narrow win"); }
  if (m.oppRetreated && known && y34Lanes(b).r !== "W") why.push("They retreated while ahead");
  return why.length ? { kind: "lucky", why } : null;
}
EXT.matchSheet.push(function y35Luck(mf) { if (!mf || mf.isNew) return ""; const x = luck(mf); return x ? `<div class="panel small y35-luck ${x.kind}"><b>${x.kind === "unlucky" ? "Unlucky one?" : "A lucky one?"}</b> <span class="muted">${esc(x.why.join(" · "))}</span></div>` : ""; });
function luckHtml() {
  const ms = y35Period(), L = ms.filter((m) => m.result === "L"), W = ms.filter((m) => m.result === "W"); if (L.length < 5) return "";
  const un = L.filter((m) => { const x = luck(m); return x && x.kind === "unlucky"; }), lk = W.filter((m) => { const x = luck(m); return x && x.kind === "lucky"; });
  const reasons = {}; un.forEach((m) => luck(m).why.forEach((w) => { const k = w.replace(/ \(.*\)$/, "").replace(/^They had .*/, "They had a counter card").replace(/^.* is tough for this deck/, "A tough location for the deck"); reasons[k] = (reasons[k] || 0) + 1; }));
  return y35Sec("Luck check", `<div class="kpis"><div class="kpi"><div class="v num">${un.length}</div><div class="k">of ${L.length} losses looked unlucky</div></div><div class="kpi"><div class="v num">${lk.length}</div><div class="k">of ${W.length} wins were a bit lucky</div></div></div>
    ${Object.keys(reasons).length ? `<div class="list">${Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="li"><div class="grow"><div class="t">${esc(k)}</div></div><span class="num">${n}</span></div>`).join("")}</div>` : ""}
    <p class="muted small">From close finishes, locations your deck struggles at, slow starts and counter cards. Some losses really are bad luck.</p>`);
}
EXT.homeStats.push(luckHtml);

/* ---------- Taps ---------- */
Object.assign(A, {
  y35TiltOk: () => { S.tilt = { ...obj(S.tilt), dismissedAt: Date.now() }; save(); render(); },
  h2hPick: (el) => { h2h.pick = el.dataset.id; render(); },
  y35Goal: (el) => { S.goals = [...arr(S.goals), { id: uid(), kind: el.dataset.k, target: num(el.dataset.v, 10) }]; save(); render(); toast("Goal set for this week"); },
  y35GoalNo: () => { S.y35GoalNo = Date.now(); save(); render(); },
  letterWrite: () => letterWrite(),
});
EXT.styles.push(`
.y35-tilt { border-color: color-mix(in srgb, var(--warn) 55%, var(--line)); }
.y35-inf { gap: 12px; align-items: center; } .y35-infd { font-family: var(--comic); font-size: 26px; line-height: 1; color: var(--snap-text); white-space: nowrap; }
.y35-letter ol { margin: 0; padding-left: 20px; } .y35-letter li { margin: 4px 0; } .y35-letter p { margin: 0; }
.y35-luck.unlucky { border-color: color-mix(in srgb, var(--loss) 45%, var(--line)); } .y35-luck.lucky { border-color: color-mix(in srgb, var(--win) 45%, var(--line)); }`);
