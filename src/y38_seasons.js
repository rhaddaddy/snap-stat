/* ============ y38_seasons.js: seasons, events and missions (October 31, 2026) ============
   41 the date you'll finish the season pass · 42 what the event's currency will buy by the end · 43 missions ticked from
   your matches · 44 the quickest deck route through the weekly challenge · 45 a Conquest tracker · 46 the best ways to
   earn an event's currency · 47 the season's story with a rank graph · 48 the current event's countdown (Home and the
   Android widget's event data) · 49 seasons, events and resets into your phone's calendar · 50 rewards you might miss. */
const y38Sec = (title, body, sub = "") => `<section class="sec"><div class="sec-h"><h2>${esc(title)}</h2>${sub ? `<span class="muted small">${sub}</span>` : ""}</div>${body}</section>`;
const y38Live = () => { try { return events().filter((e) => timeState(e) === "live"); } catch { return []; } };
const y38Date = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ---------- 41. When you'll finish the season pass ---------- */
function passFinish() {
  const cs = currentSeason(); if (!cs || typeof passPace !== "function") return null; const r = passPace(cs); if (!r || r.done || !r.perDay) return null;
  const days = r.needXp / r.perDay, at = Date.now() + days * DAY;
  return { cs, r, at, ok: !Number.isFinite(cs.endTs) || at <= cs.endTs };
}
function passFinishHtml() {
  const x = passFinish(); if (!x) return "";
  return `<section class="sec"><div class="panel row nowrap y38-pass"><span class="y38-big">${esc(y38Date(x.at))}</span><div class="grow"><b>${x.ok ? `You'll finish the pass on ${esc(y38Date(x.at))}` : "At this pace you won't finish the pass"}</b><div class="small muted">${x.ok ? `At ${fmt(x.r.perDay)} pass XP a day, before the season ends.` : `You'd reach about level ${x.r.endLevel}. ${fmt(x.r.needPerDay)} XP a day gets you there.`}</div></div></div></section>`;
}
passFinishHtml.ext = { id: "passDate", label: "Season pass finish date", sub: "When you'll finish the pass at your pace" };
EXT.homeTop.push(passFinishHtml);

/* ---------- 42. Event shop planner ---------- */
// Event currencies are noted each time the event screen is read, so the pace can be worked out
function evCurSync() {
  const L = obj(S.evCurLog); let ch = false;
  for (const e of y38Live()) { const pr = obj(S.eventProg[e.id]); for (const c of arr(pr.curs)) { if (!c || !c.name) continue; const key = e.id + "|" + keyOf(c.name), list = arr(L[key]), last = list[list.length - 1]; if (last && last[1] === num(c.amount)) continue; L[key] = [...list, [num(c.at) || Date.now(), num(c.amount)]].slice(-30); ch = true; } }
  if (ch) { S.evCurLog = Object.fromEntries(Object.entries(L).slice(-40)); save(); }
}
function evForecast(e) {
  const pr = obj(S.eventProg[e.id]), shop = arr(pr.curs).find((c) => c.use === "shop") || arr(pr.curs)[0]; if (!shop) return null;
  const list = arr(obj(S.evCurLog)[e.id + "|" + keyOf(shop.name)]), first = list[0], last = list[list.length - 1];
  const days = first && last ? (last[0] - first[0]) / DAY : 0, perDay = days >= 0.5 && last[1] > first[1] ? (last[1] - first[1]) / days : 0;
  const left = Number.isFinite(e.endTs) ? Math.max(0, (e.endTs - Date.now()) / DAY) : 0, end = Math.round(num(shop.amount) + perDay * left);
  const items = arr(pr.shop).filter((i) => !i.sold && num(i.price) > 0).map((i) => ({ ...i, pri: /variant|avatar|title|card back|cardback|border/i.test(String(i.kind || i.name)) ? 0 : /card/i.test(String(i.kind || "")) ? 1 : 2 })).sort((a, b) => a.pri - b.pri || num(a.price) - num(b.price));
  let budget = end; const buy = []; for (const i of items) if (num(i.price) <= budget) { buy.push(i); budget -= num(i.price); }
  return { e, shop, perDay: Math.round(perDay), end, now: num(shop.amount), buy, left: Math.round(left * 10) / 10, items };
}
function evPlanHtml() {
  const list = y38Live().map(evForecast).filter(Boolean); if (!list.length) return "";
  return y38Sec("Event shop plan", list.map((x) => `<div class="panel stack small"><b>${esc(x.e.name)}</b><span>You have <b>${fmt(x.now)} ${esc(x.shop.name)}</b>${x.perDay ? `, earning about ${fmt(x.perDay)} a day: around <b>${fmt(x.end)}</b> by the end.` : ". Screenshot the event again tomorrow to see your pace."}</span>
    ${x.items.length ? x.buy.length ? `<span>That's enough for: ${x.buy.map((i) => `<b>${esc(i.name)}</b> (${fmt(i.price)})`).join(", ")}.</span>` : `<span class="muted">Not enough for anything left in the shop yet.</span>` : `<span class="muted">Screenshot the event's shop so SNAP Stat knows what's for sale.</span>`}
    <span class="muted">Cosmetics first (variants, avatars, titles), then cards, then the rest.</span></div>`).join(""));
}
EXT.homeStats.push(evPlanHtml);
let _y38EvAt = 0;
EXT.afterRender.push(function y38EvSoon() { if (Date.now() - _y38EvAt < 60e3) return; _y38EvAt = Date.now(); setTimeout(() => { try { evCurSync(); } catch (e) { errNote("event currencies", e, true); } }, 1800); });

/* ---------- 43. Missions ticked from your matches ---------- */
function missionRule(text) {
  const t = String(text || "").toLowerCase().replace(/^hard\s*:\s*/, ""); let m;
  const tags = (c, tag, word) => arr(card(c).tags).includes(tag) || new RegExp(word).test(String(card(c).ability || "").toLowerCase());
  const plays = (ms, f) => ms.reduce((n, mt) => n + arr(mt.plays).filter((p) => p && p.k && f(p, mt)).length, 0);
  if ((m = t.match(/^win (\d+) (?:games|matches)/))) return { goal: +m[1], count: (ms) => ms.filter((x) => x.result === "W").length };
  if ((m = t.match(/^play (\d+) (?:games|matches)/))) return { goal: +m[1], count: (ms) => ms.length };
  if ((m = t.match(/(?:win|earn|gain) (\d+) cubes/))) return { goal: +m[1], count: (ms) => ms.reduce((s, x) => s + Math.max(0, num(x.cubes)), 0) };
  if ((m = t.match(/snap and win (\d+)|win (\d+) (?:games|matches) (?:after|where) you snap/))) return { goal: +(m[1] || m[2]), count: (ms) => ms.filter((x) => x.snapped && x.result === "W").length };
  if ((m = t.match(/^play (\d+) (\d)-cost cards/))) { const c = +m[2]; return { goal: +m[1], count: (ms) => plays(ms, (p) => num(card(p.k).cost) === c), needPlays: true }; }
  if ((m = t.match(/^play (\d+) cards? (?:at|to|on) (.+?)$/))) { const loc = keyOf(m[2]); return { goal: +m[1], count: (ms) => plays(ms, (p, mt) => keyOf(obj(arr(mt.locs)[p.loc]).name) === loc), needPlays: true }; }
  if ((m = t.match(/^play (\d+) on reveal cards/))) return { goal: +m[1], count: (ms) => plays(ms, (p) => tags(p.k, "R", "on reveal")), needPlays: true };
  if ((m = t.match(/^play (\d+) ongoing cards/))) return { goal: +m[1], count: (ms) => plays(ms, (p) => tags(p.k, "O", "ongoing")), needPlays: true };
  if ((m = t.match(/^play (\d+) cards/))) return { goal: +m[1], count: (ms) => plays(ms, () => true), needPlays: true };
  return null;
}
function missionAuto() {
  const G = obj(S.gameMissions), out = [];
  const add = (label, g, since) => { if (!g) return; const ms = realMatches().filter((x) => x.ts >= since); for (const i of arr(g.items)) { if (i.done) continue; const r = missionRule(i.text); if (!r) continue; const extra = r.count(ms), goal = num(i.goal) || r.goal, have = Math.min(goal, num(i.progress) + extra); out.push({ label, text: i.text, have, goal, extra, done: have >= goal, plays: r.needPlays && !ms.some((x) => arr(x.plays).length) }); } };
  const today = gameDay(); if (obj(G.daily).day === today) add("Today", G.daily, num(G.daily.at));
  if (G.weekly && (!G.weekly.endsAt || G.weekly.endsAt > Date.now())) add("Weekly", G.weekly, num(G.weekly.at));
  return out;
}
function missionAutoHtml() {
  const list = missionAuto(); if (!list.length) return "";
  return y38Sec("Missions from your matches", `<div class="list">${list.map((x) => `<div class="li"><div class="grow"><div class="t">${x.done ? "✓ " : ""}${esc(x.text)}</div><div class="s">${esc(x.label)} · ${x.extra ? `+${fmt(x.extra)} from matches since the screenshot` : x.plays ? "needs tracked matches (Track & play) to count cards" : "nothing new yet"}</div></div><span class="num ${x.done ? "pos" : ""}">${fmt(x.have)}/${fmt(x.goal)}</span></div>`).join("")}</div>
    <p class="muted small">Ticked from the matches you logged after your last Missions screenshot. The game's own count wins when you screenshot it again.</p>`);
}
EXT.homeSubs.push(["missionsplus", "Mission helper", () => `${missionAutoHtml() || y38Sec("Missions from your matches", `<div class="empty"><strong>No missions read yet</strong><span>Screenshot the game's Missions screen (or let Track & play see it), then the missions you can tick from your matches show here.</span></div>`)}${routeHtml()}${conquestHtml()}${eventCurHtml()}`]);

/* ---------- 44. Weekly challenge route ---------- */
function weeklyRoute() {
  const G = obj(S.gameMissions), w = G.weekly; if (!w || typeof missionTest !== "function") return null;
  let open = arr(w.items).filter((i) => !i.done && missionTest(i.text)); const decks = S.decks.filter((d) => d.status === "active" && arr(d.cards).length >= 10 && folderOf(d) !== "Retired");
  if (!open.length || !decks.length) return { steps: [], open: open.length };
  const steps = [];
  while (open.length && steps.length < 4) {
    let best = null;
    for (const d of decks) { const cs = arr(d.cards).map(card), st = statsFor(deckMatches(d)), wr = st.games >= 3 ? st.wr / 100 : 0.5; const covers = open.filter((i) => { const t = missionTest(i.text); return t.rate ? wr >= 0.5 : t.count(cs) / t.need >= 0.6; }); if (!covers.length) continue;
      const games = Math.max(...covers.map((i) => { const t = missionTest(i.text), left = Math.max(1, (num(i.goal) || 3) - num(i.progress)); return Math.ceil(t.rate ? left / Math.max(0.3, wr) : left / Math.max(1, Math.min(4, t.count(cs) * 0.6))); }));
      const score = covers.length * 10 - games; if (!best || score > best.score) best = { d, covers, games, score }; }
    if (!best) break; steps.push(best); open = open.filter((i) => !best.covers.includes(i));
  }
  return { steps, left: open, open: arr(w.items).filter((i) => !i.done).length };
}
function routeHtml() {
  const r = weeklyRoute(); if (!r) return y38Sec("Weekly challenge route", `<div class="empty"><strong>No weekly challenge read yet</strong><span>Screenshot the weekly challenge in the game's Missions screen.</span></div>`);
  if (!r.steps.length) return y38Sec("Weekly challenge route", `<p class="muted small">${r.open ? "None of your ready decks fit the challenge's missions well. Try the AI deck builder with the mission in mind." : "Weekly challenge done. Nice."}</p>`);
  return y38Sec("Weekly challenge route", `<ol class="y38-route">${r.steps.map((s) => `<li><button class="linkbtn" data-a="deckOpen" data-id="${esc(s.d.id)}"><b>${esc(s.d.name)}</b></button> for about ${plural(s.games, "game")}<div class="small muted">${s.covers.map((i) => esc(i.text)).join(" · ")}</div></li>`).join("")}</ol>
    ${arr(r.left).length ? `<p class="muted small">Not covered by your decks: ${esc(r.left.map((i) => i.text).join(", "))}.</p>` : ""}<p class="muted small">An estimate from each deck's cards and win rate: about ${plural(r.steps.reduce((s, x) => s + x.games, 0), "game")} in all.</p>`);
}

/* ---------- 45. Conquest tracker ---------- */
const CQ_TIERS = ["Proving Grounds", "Silver", "Gold", "Infinite"];
function conquestHtml() {
  const C = obj(S.conquest), runs = arr(C.runs), ms = realMatches().filter((m) => /conquest/i.test(modeOf(m))), st = statsFor(ms.filter((m) => m.ts >= Date.now() - 7 * DAY));
  const hourRows = CQ_TIERS.map((t) => { const rs = runs.filter((r) => r.tier === t); if (rs.length < 2) return null; const by = {}; rs.forEach((r) => { const h = Math.floor(new Date(r.at).getHours() / 4) * 4; (by[h] = by[h] || []).push(r); }); const best = Object.entries(by).map(([h, l]) => ({ h: +h, wr: pct(l.filter((x) => x.won).length, l.length), n: l.length })).sort((a, b) => b.wr - a.wr || b.n - a.n)[0]; return { t, n: rs.length, wr: pct(rs.filter((x) => x.won).length, rs.length), best }; }).filter(Boolean);
  const hh = (h) => `${new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" })}–${new Date(2000, 0, 1, (h + 4) % 24).toLocaleTimeString([], { hour: "numeric" })}`;
  return y38Sec("Conquest", `<div class="kpis"><div class="kpi"><div class="v num">${fmt(num(C.medals))}</div><div class="k">medals</div></div><div class="kpi"><div class="v num">${st.games ? `${st.w}-${st.l}` : "—"}</div><div class="k">Conquest games this week</div></div></div>
    <div class="grid2">${CQ_TIERS.map((t, i) => `<div class="panel small row between nowrap"><span>${esc(t)} tickets</span><span class="row nowrap"><button class="btn sm" data-a="cqTicket" data-i="${i}" data-d="-1" aria-label="One less">−</button><b class="num">${num(arr(C.tickets)[i])}</b><button class="btn sm" data-a="cqTicket" data-i="${i}" data-d="1" aria-label="One more">+</button></span></div>`).join("")}</div>
    <div class="panel stack small"><b>Log a run</b><div class="grid2"><label class="f">Tier<select data-cq="tier">${CQ_TIERS.map((t) => `<option ${ui.cqTier === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label><label class="f">Medals won<input type="number" min="0" inputmode="numeric" data-cq="medals" value="${esc(ui.cqMedals || "")}"></label></div>
      <div class="row"><button class="btn sm snap" data-a="cqRun" data-v="1">Won it</button><button class="btn sm" data-a="cqRun" data-v="0">Lost</button><label class="f" style="flex:1">Medals now<input type="number" min="0" inputmode="numeric" data-cq="total" value="${esc(num(C.medals) || "")}"></label></div></div>
    ${hourRows.length ? `<div class="list">${hourRows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.t)}</div><div class="s">${r.n} runs · ${r.wr}% won · best ${esc(hh(r.best.h))} (${r.best.wr}%)</div></div></div>`).join("")}</div>` : `<span class="muted small">Log a few runs per tier to see the best time of day to play each one.</span>`}`);
}
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.cq) return; const k = t.dataset.cq; if (k === "tier") ui.cqTier = t.value; else if (k === "medals") ui.cqMedals = t.value; else if (k === "total") { S.conquest = { ...obj(S.conquest), medals: Math.max(0, Math.round(num(t.value))) }; clearTimeout(ui.y38t); ui.y38t = setTimeout(save, 600); } });
document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.cq === "tier") ui.cqTier = t.value; });

/* ---------- 46. Best ways to earn the event's currency ---------- */
function eventCurHtml() {
  const ms = realMatches().filter((m) => m.eventGain && num(m.eventGain.amount) > 0 && m.ts >= Date.now() - 30 * DAY); if (ms.length < 3) return y38Sec("Event currency calculator", `<div class="empty"><strong>Not enough event matches yet</strong><span>During an event like Deadpool's Diner, matches logged by Track & play or screenshots note the currency each one gave. After 3, this shows the best way to earn it.</span></div>`);
  const name = curName(ms[0].eventGain.name), avg = (l) => (l.length ? Math.round(l.reduce((s, m) => s + num(m.eventGain.amount), 0) / l.length) : 0);
  const rows = [["A win", ms.filter((m) => m.result === "W" && !m.oppRetreated)], ["They retreated", ms.filter((m) => m.oppRetreated)], ["A loss to the end", ms.filter((m) => m.result === "L" && !m.retreated)], ["You retreated", ms.filter((m) => m.retreated)], ["You snapped", ms.filter((m) => m.snapped)]].filter(([, l]) => l.length).map(([l, list]) => ({ l, n: list.length, avg: avg(list) }));
  const best = [...rows].sort((a, b) => b.avg - a.avg)[0], ss = y35Sessions(ms).filter((s) => s.length >= 2), perHour = ss.length ? Math.round(ss.reduce((s, x) => s + x.reduce((a, m) => a + num(m.eventGain.amount), 0), 0) / Math.max(0.3, ss.reduce((s, x) => s + (x[x.length - 1].ts - x[0].ts) / 3600e3 + 0.07, 0))) : 0;
  return y38Sec(`Earning ${name}`, `<div class="list">${rows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.l)}</div><div class="s">${r.n} match${r.n === 1 ? "" : "es"}</div></div><b class="num">${fmt(r.avg)}</b></div>`).join("")}</div>
    <p class="small">${best ? `Most ${esc(name)} per match: <b>${esc(best.l.toLowerCase())}</b> (${fmt(best.avg)}).` : ""}${perHour ? ` About ${fmt(perHour)} an hour when you play several in a row.` : ""}</p><p class="muted small">From your last 30 days of event matches.</p>`);
}

/* ---------- 47. The season's story, with a rank graph ---------- */
function rankLine(s) {
  const c = obj(S.climb); if (!c.at || !s) return [];
  let total = clamp(num(c.rank), 1, 100) * cpr() + clamp(num(c.cubes), 0, cpr() - 1); const pts = [[Math.max(c.at, s.startTs), total / cpr()]];
  const ms = realMatches().filter((m) => m.ts > c.at && m.ts >= s.startTs && m.ts <= s.endTs && modeOf(m) === "Ranked").sort((a, b) => a.ts - b.ts);
  for (const m of ms) { total = clamp(total + num(m.cubes), cpr(), 100 * cpr()); pts.push([m.ts, total / cpr()]); }
  return pts;
}
function rankSvg(pts) {
  if (pts.length < 2) return ""; const W = 320, H = 110, t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1, lo = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) / 10) * 10), hi = Math.min(100, Math.ceil(Math.max(...pts.map((p) => p[1])) / 10) * 10 || 10);
  const x = (t) => ((t - t0) / Math.max(1, t1 - t0)) * (W - 8) + 4, y = (r) => H - 6 - ((r - lo) / Math.max(1, hi - lo)) * (H - 16);
  return `<svg class="y38-rank" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rank over the season"><line x1="4" x2="${W - 4}" y1="${y(hi)}" y2="${y(hi)}" class="g"/><line x1="4" x2="${W - 4}" y1="${y(lo)}" y2="${y(lo)}" class="g"/><text x="6" y="${y(hi) + 10}" class="t">${hi}</text><text x="6" y="${y(lo) - 3}" class="t">${lo}</text><polyline points="${pts.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ")}"/></svg>`;
}
let storyId = "";
function seasonStory(s) {
  const ms = inPeriod(realMatches(), { from: s.startTs, to: s.endTs }), st = statsFor(ms), days = {}, decks = {};
  ms.forEach((m) => { const d = localDate(m.ts); days[d] = (days[d] || 0) + num(m.cubes); const k = m.deckName || ""; if (k) (decks[k] = decks[k] || []).push(m); });
  const bestDay = Object.entries(days).sort((a, b) => b[1] - a[1])[0], top = Object.entries(decks).map(([n, l]) => ({ n, st: statsFor(l) })).sort((a, b) => b.st.games - a.st.games)[0];
  const rk = obj(S.ranks["s:" + s.id]); return { ms, st, bestDay, top, pts: rankLine(s), peak: rk.peak || "" };
}
function storySheet() {
  const s = seasons().find((x) => x.id === storyId); if (!s) return sheetHead("Season not found");
  const x = seasonStory(s);
  if (!x.ms.length) return `${sheetHead(esc(s.name), "Season story")}<div class="empty"><strong>No matches this season yet</strong><span>The story fills in as you play.</span></div>`;
  return `${sheetHead(esc(s.name), "Your season's story")}
    <div class="tiles"><div class="tile"><div class="v num">${x.st.w}-${x.st.l}</div><div class="k">${x.st.wr}% wins</div></div><div class="tile"><div class="v num">${signed(x.st.cubes)}</div><div class="k">cubes</div></div>${x.peak ? `<div class="tile"><div class="v num">${esc(x.peak)}</div><div class="k">best rank</div></div>` : ""}</div>
    ${x.pts.length > 1 ? `<span class="eyebrow">Your rank this season</span>${rankSvg(x.pts)}` : `<p class="muted small">Set your rank in Home › Stats › Rank climb to see the rank graph.</p>`}
    <div class="list">${x.bestDay ? `<div class="li"><div class="grow"><div class="t">Best day</div><div class="s">${esc(dateStr(x.bestDay[0]))}</div></div><b class="num pos">${signed(x.bestDay[1])}</b></div>` : ""}${x.top ? `<div class="li"><div class="grow"><div class="t">Top deck: ${esc(x.top.n)}</div><div class="s">${x.top.st.games} games · ${x.top.st.wr}% wins</div></div><b class="num">${signed(x.top.st.cubes)}</b></div>` : ""}</div>
    <div class="grid2"><button class="btn snap" data-a="storyShare">Share it</button><button class="btn" data-a="close">Done</button></div>`;
}
async function storyBlob() {
  const s = seasons().find((x) => x.id === storyId), x = seasonStory(s), W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  picBackdrop(g, W, H); g.textAlign = "left"; g.fillStyle = "#FFD23F"; g.font = "italic 800 64px system-ui"; picText(g, s.name, 60, 120, 960); g.fillStyle = "#C9C3EE"; g.font = "600 30px system-ui"; picText(g, `My season${S.me.handle ? " · " + S.me.handle : ""}`, 62, 170, 960);
  g.fillStyle = "#fff"; g.font = "800 80px system-ui"; picText(g, `${x.st.w}-${x.st.l}`, 60, 300, 450); picText(g, signed(x.st.cubes), 560, 300, 460); g.fillStyle = "#C9C3EE"; g.font = "600 28px system-ui"; g.fillText(`${x.st.wr}% wins`, 62, 344); g.fillText("cubes", 562, 344);
  if (x.pts.length > 1) { const t0 = x.pts[0][0], t1 = x.pts[x.pts.length - 1][0], lo = Math.min(...x.pts.map((p) => p[1])), hi = Math.max(...x.pts.map((p) => p[1])) || 1, X = (t) => 60 + ((t - t0) / Math.max(1, t1 - t0)) * 960, Y = (r) => 900 - ((r - lo) / Math.max(1, hi - lo)) * 460;
    g.strokeStyle = "#FFD23F"; g.lineWidth = 8; g.lineJoin = "round"; g.beginPath(); x.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.stroke(); g.fillStyle = "#C9C3EE"; g.font = "600 26px system-ui"; g.fillText(`rank ${Math.round(hi)}`, 60, 420); g.fillText(`rank ${Math.round(lo)}`, 60, 950); }
  g.fillStyle = "#fff"; g.font = "700 34px system-ui"; if (x.top) picText(g, `Top deck: ${x.top.n} (${x.top.st.wr}%)`, 60, 1060, 960); if (x.bestDay) picText(g, `Best day: ${dateStr(x.bestDay[0])} (${signed(x.bestDay[1])} cubes)`, 60, 1120, 960);
  picFooter(g, W, H); return canvasBlob(cv);
}
EXT.homeStats.push(function y38StoryCard() { const cs = currentSeason(); if (!cs) return ""; const x = seasonStory(cs); if (x.ms.length < 3) return ""; return y38Sec("Season story", `${x.pts.length > 1 ? rankSvg(x.pts) : ""}<div class="row"><button class="btn sm" data-a="storyOpen" data-id="${esc(cs.id)}">Open this season's story</button></div>`); });

/* ---------- 48. The current event's countdown on Home ---------- */
function evCountHtml() {
  const e = y38Live().filter((x) => Number.isFinite(x.endTs)).sort((a, b) => a.endTs - b.endTs)[0]; if (!e) return "";
  const pr = obj(S.eventProg[e.id]), lv = num(pr.level), of = num(e.passLevels);
  return `<section class="sec"><button class="panel row nowrap y38-ev" data-a="go" data-to="home/events"><div class="grow"><b>${esc(e.name)}</b><div class="small muted">${lv && of ? `Level ${lv} of ${of} · ` : ""}ends ${cdSpan(e.endTs)}</div></div><span class="muted">›</span></button></section>`;
}
evCountHtml.ext = { id: "evCount", label: "Event countdown", sub: "The event that ends soonest" };
EXT.homeTop.push(evCountHtml);

/* ---------- 49. Calendar export (.ics) ---------- */
function icsEsc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function icsFold(line) { const out = []; let s = line; const enc = new TextEncoder(); while (enc.encode(s).length > 75) { let n = 75; while (enc.encode(s.slice(0, n)).length > 75) n--; out.push(s.slice(0, n)); s = " " + s.slice(n); } out.push(s); return out.join("\r\n"); }
const icsTime = (ts) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function icsFile(opts) {
  const now = icsTime(Date.now()), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SNAP Stat//MARVEL SNAP calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:MARVEL SNAP (SNAP Stat)"];
  const ev = (uidv, a, b, sum, desc, rrule) => { L.push("BEGIN:VEVENT", `UID:${uidv}@snapstat`, `DTSTAMP:${now}`, `DTSTART:${icsTime(a)}`, `DTEND:${icsTime(b)}`, `SUMMARY:${icsEsc(sum)}`); if (desc) L.push(`DESCRIPTION:${icsEsc(desc)}`); if (rrule) L.push(rrule); L.push("END:VEVENT"); };
  const soon = Date.now() + 120 * DAY, past = Date.now() - 7 * DAY;
  if (opts.seasons) for (const s of seasons()) if (Number.isFinite(s.endTs) && s.endTs > past && s.startTs < soon) { ev(`season-${s.id}`, s.startTs, s.startTs + 3600e3, `New season: ${s.name}`, "MARVEL SNAP season starts."); ev(`season-end-${s.id}`, s.endTs - 3600e3, s.endTs, `Season ends: ${s.name}`, "Last hour to finish the pass and climb."); }
  if (opts.events) for (const e of events()) if (Number.isFinite(e.startTs) && (Number.isFinite(e.endTs) ? e.endTs : e.startTs) > past && e.startTs < soon) ev(`event-${e.id}`, e.startTs, Number.isFinite(e.endTs) && e.endTs > e.startTs ? e.endTs : e.startTs + 3600e3, e.name, `${e.type === "mode" ? "Limited-time mode" : "Event"} in MARVEL SNAP.`);
  if (opts.reset) { const r = nextDailyReset(Date.now()); ev("daily-reset", r, r + 15 * 60e3, "MARVEL SNAP daily reset", "New daily offer, free tokens and missions.", "RRULE:FREQ=DAILY"); }
  L.push("END:VCALENDAR"); return L.map(icsFold).join("\r\n") + "\r\n";
}
async function icsSave() {
  const o = { seasons: S.icsSeasons !== false, events: S.icsEvents !== false, reset: !!S.icsReset }, text = icsFile(o), name = "marvel-snap-calendar.ics", blob = new Blob([text], { type: "text/calendar" });
  try { if (store.downloads && store.downloads.save) await store.downloads.save({ filename: name, data: blob }); else saveBlob(blob, name); toast("Calendar file saved: open it to add the dates"); } catch (e) { errNote("the calendar file", e); }
}
EXT.settingsApp.push(function y38Ics() {
  return `<section class="sec"><h2>Add to your calendar</h2><div class="panel stack small"><p>Get seasons, events and the daily reset in your phone's calendar app.</p>
    <label class="check"><input type="checkbox" data-ics="icsSeasons" ${S.icsSeasons === false ? "" : "checked"}> Season starts and ends</label><label class="check"><input type="checkbox" data-ics="icsEvents" ${S.icsEvents === false ? "" : "checked"}> Events and modes</label><label class="check"><input type="checkbox" data-ics="icsReset" ${S.icsReset ? "checked" : ""}> The daily reset (every day)</label>
    <div class="row"><button class="btn snap" data-a="icsSave">Save the calendar file</button></div><span class="muted">Open the saved file and your calendar app adds the dates (the next 4 months). Save it again later for new ones.</span></div></section>`;
});
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.ics) return; S[t.dataset.ics] = !!t.checked; save(); });

/* ---------- 50. Rewards you might miss ---------- */
function missedRewards(now = Date.now()) {
  const out = [];
  const cs = currentSeason();
  if (cs && Number.isFinite(cs.endTs) && cs.endTs - now < 3 * DAY && cs.endTs > now) { const p = obj(S.passes[cs.id]), of = num(cs.passLevels) || 50; if (num(p.level) && num(p.level) < of) out.push({ id: `miss-pass:${cs.id}`, at: cs.endTs - 3 * DAY, until: cs.endTs, title: "Season pass not finished", body: `${of - num(p.level)} levels left on ${cs.name}'s pass, and the season ends ${y38Date(cs.endTs)}.`, route: "#home/seasons" }); }
  for (const e of y38Live()) {
    if (!Number.isFinite(e.endTs) || e.endTs - now > DAY) continue; const pr = obj(S.eventProg[e.id]), shop = arr(pr.curs).find((c) => c.use === "shop");
    const cheap = arr(pr.shop).filter((i) => !i.sold && num(i.price) > 0).sort((a, b) => num(a.price) - num(b.price))[0];
    if (shop && cheap && num(shop.amount) >= num(cheap.price)) out.push({ id: `miss-shop:${e.id}`, at: e.endTs - DAY, until: e.endTs, title: `Spend your ${curName(shop.name)}`, body: `${e.name} ends tomorrow: you have ${fmt(shop.amount)}, enough for ${cheap.name}.`, route: "#home/events" });
    const of = num(e.passLevels); if (of && num(pr.level) && num(pr.level) < of) out.push({ id: `miss-evpass:${e.id}`, at: e.endTs - DAY, until: e.endTs, title: `${e.name} ends tomorrow`, body: `You're on level ${num(pr.level)} of ${of}. Claim your rewards before it ends.`, route: "#home/events" });
  }
  return out;
}
EXT.alerts.push(missedRewards);
function missedHtml() { const l = missedRewards().filter((x) => x.at <= Date.now()); if (!l.length) return ""; return `<section class="sec"><div class="panel stack small y38-miss"><b>Don't miss out</b>${l.map((x) => `<button class="li" data-a="go" data-to="${esc(String(x.route).replace(/^#/, ""))}"><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">${esc(x.body)}</div></div><span class="muted">›</span></button>`).join("")}</div></section>`; }
missedHtml.ext = { id: "missed", label: "Rewards you might miss", sub: "Pass levels and event currency near the end" };
EXT.homeTop.push(missedHtml);

/* ---------- Taps ---------- */
Object.assign(A, {
  cqTicket: (el) => { const C = obj(S.conquest), t = [0, 0, 0, 0].map((_, i) => num(arr(C.tickets)[i])); const i = num(el.dataset.i); t[i] = Math.max(0, t[i] + num(el.dataset.d)); S.conquest = { ...C, tickets: t }; save(); render(); },
  cqRun: (el) => { const C = obj(S.conquest), m = Math.max(0, Math.round(num(ui.cqMedals))); S.conquest = { ...C, runs: [...arr(C.runs), { at: Date.now(), tier: ui.cqTier || CQ_TIERS[0], won: el.dataset.v === "1", medals: m }].slice(-200), medals: num(C.medals) + (el.dataset.v === "1" ? m : 0) }; ui.cqMedals = ""; save(); render(); toast("Run logged"); },
  storyOpen: (el) => { storyId = el.dataset.id; openSheet(storySheet); },
  storyShare: () => { const s = seasons().find((x) => x.id === storyId); if (!s) return; makePic({ kind: "season", title: s.name, sub: "Your season's story", file: `snap-stat-season-${keyOf(s.name)}.png`, shareTitle: `My ${s.name} season`, make: () => storyBlob() }); },
  icsSave: () => icsSave(),
});
EXT.search.push((q) => (/calendar|ics|conquest|weekly|route|mission|event shop|nachos|bubs|season story/i.test(q) ? [{ label: "Mission helper, Conquest and event currency", sub: "Home › Mission helper", route: "home/missionsplus" }, { label: "Add to your calendar", sub: "Settings › App", route: "settings/app" }] : []));
EXT.styles.push(`
.y38-pass { gap: 12px; align-items: center; } .y38-big { font-family: var(--comic); font-size: 26px; line-height: 1; color: var(--snap-text); white-space: nowrap; }
.y38-route { margin: 0; padding-left: 20px; } .y38-route li { margin: 6px 0; }
.y38-rank { width: 100%; height: auto; display: block; margin: 6px 0; } .y38-rank polyline { fill: none; stroke: var(--snap-a); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.y38-rank .g { stroke: var(--line); stroke-dasharray: 3 4; } .y38-rank .t { fill: var(--muted); font-size: 9px; }
.y38-ev { width: 100%; text-align: left; color: var(--fg); font: inherit; cursor: pointer; gap: 10px; align-items: center; }
.y38-miss { border-color: color-mix(in srgb, var(--warn) 55%, var(--line)); } .y38-miss .li { width: 100%; text-align: left; background: none; border: 0; color: var(--fg); font: inherit; padding: 8px 0; cursor: pointer; }`);
