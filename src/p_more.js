/* ============ Round four: completion timeline, pack planner, decks you can build, catch-up plan, event recaps, replays,
   percentiles, card impact, location guide, sessions, nightly summary, draft helper, multiple accounts, stream overlay ============ */

/* ---------- Finish-my-collection timeline ---------- */
function missingBySeries() {
  const out = {}; for (const s of ["Series 5", "Series 4", "Series 3"]) out[s] = [];
  allCards().forEach((c) => { const s = seriesOf(c); if (out[s] && !c.upcoming && !c.custom && !c.catModeOnly && !S.owned[c.key]) out[s].push(c.key); });
  return out;
}
function finishCost() {
  const miss = missingBySeries(); const P = PACKS ? packPools() : null;
  const seasonalKeys = (sr) => new Set(P ? P.seasonal.filter((p) => p.series === sr).flatMap((p) => p.keys) : []);
  const price = (sr, isNew) => { if (P) { const sp = P.seasonal.find((p) => p.series === sr); const op = P.old.find((p) => p.series === sr); return isNew && sp ? sp.price : op ? op.price : 0; } return tokenPrice(card(miss["Series " + sr][0] || "")) || { 5: 6000, 4: 3000, 3: 650 }[sr]; };
  let tokens = 0; const rows = [];
  for (const sr of ["5", "4", "3"]) {
    const list = miss["Series " + sr]; const nw = seasonalKeys(sr); const fresh = list.filter((k) => nw.has(k)), old = list.filter((k) => !nw.has(k));
    const cost = fresh.length * price(sr, true) + old.length * price(sr, false); tokens += cost;
    rows.push({ sr, n: list.length, cost, fresh: fresh.length });
  }
  return { rows, tokens };
}
function tokenRate() {
  if (num(S.tokenRate) > 0) return { perWeek: num(S.tokenRate), guess: false };
  const log = arr(S.walletLog).filter((x) => x.t >= Date.now() - 45 * DAY).sort((a, b) => a.t - b.t);
  let gain = 0; for (let i = 1; i < log.length; i++) gain += Math.max(0, num(log[i].v) - num(log[i - 1].v));
  const days = log.length > 1 ? (log[log.length - 1].t - log[0].t) / DAY : 0;
  return days >= 7 && gain > 0 ? { perWeek: Math.round((gain / days) * 7), guess: true } : { perWeek: 0, guess: true };
}
function finishHtml() {
  const f = finishCost(), have = num(S.wallet.tokens), need = Math.max(0, f.tokens - have), r = tokenRate();
  const keepUp = 4 * (PACKS ? num((packPools().seasonal.find((p) => p.series === "5") || {}).price) || 5000 : 5000); // about one new Series 5 card a week
  const weeks = r.perWeek ? Math.ceil(need / r.perWeek) : 0;
  return `<section class="sec"><h2>Finish your collection</h2><div class="panel stack small">
    ${f.tokens ? `<p>To own every Series 3–5 card that's out today you need about <b>${fmt(f.tokens)} tokens</b>${have ? (need ? ` (you have ${fmt(have)}, so ${fmt(need)} to go)` : ` and you have ${fmt(have)}: enough for all of it`) : ""}.</p>` : `<p><b>You own every Series 3–5 card that's out.</b> Nice.</p>`}
    <div class="tbl-wrap"><table><thead><tr><th>Series</th><th class="n">Missing</th><th class="n">Tokens</th></tr></thead><tbody>${f.rows.map((x) => `<tr><td>Series ${x.sr}${x.fresh ? ` <span class="muted small">(${x.fresh} new)</span>` : ""}</td><td class="n">${x.n}</td><td class="n">${fmt(x.cost)}</td></tr>`).join("")}</tbody></table></div>
    <label class="f">Tokens you earn a week${r.guess && r.perWeek ? " (estimated from your wallet)" : ""}<input type="number" id="fc-rate" data-bind="tokenRate" data-num="1" value="${esc(S.tokenRate || "")}" placeholder="${r.perWeek ? fmt(r.perWeek) : "e.g. 2000"}" inputmode="numeric"></label>
    ${need && r.perWeek ? `<p>At ${fmt(r.perWeek)} a week that's about <b>${weeks < 9 ? plural(weeks, "week") : plural(Math.ceil(weeks / 4.3), "month")}</b>${weeks ? ` (around ${esc(dateStr(localDate(Date.now() + weeks * 7 * DAY)))})` : ""} for today's cards.</p>` : need ? `<p class="muted">Enter how many tokens you earn a week, or keep your token count up to date for a few weeks and the app works it out.</p>` : ""}
    <span class="muted">New Series 5 cards arrive about once a week, so keeping up takes roughly ${fmt(keepUp)} tokens a month on its own. Costs use the cheapest pack for each card.</span></div></section>`;
}

/* ---------- Pack planner (inside a pack's sheet) ---------- */
let packTarget = "";
function packPlanHtml(p, missing) {
  if (!missing.length) return "";
  const tokens = num(S.wallet.tokens), can = Math.floor(tokens / p.price), m = missing.length;
  const want = missing.filter((k) => S.wishCards[k]); if (!missing.includes(packTarget)) packTarget = want[0] || "";
  const rows = Array.from({ length: Math.min(m, 6) }, (_, i) => i + 1);
  return `<h3>If you open…</h3>${packTarget ? `<p class="small">Chance to get <b>${esc(card(packTarget).name)}</b> shown in the last column.</p>` : ""}<div class="tbl-wrap"><table><thead><tr><th>Packs</th><th class="n">Tokens</th><th class="n">New cards</th>${packTarget ? `<th class="n">Get it</th>` : ""}</tr></thead><tbody>${rows.map((n) => `<tr${n <= can ? "" : ' class="muted"'}><td>${n}</td><td class="n">${fmt(n * p.price)}</td><td class="n">${n} of ${m}</td>${packTarget ? `<td class="n">${Math.round((n / m) * 100)}%</td>` : ""}</tr>`).join("")}</tbody></table></div>
    <p class="muted small">Each pack always gives a card you don't own from this pool, so ${m} packs get you all ${m}. Bonus rolls can add more. ${can ? `You can afford ${plural(can, "pack")} now.` : `You need ${fmt(p.price - tokens)} more tokens for one.`} ${packTarget ? "" : "Tap a card below to see your chance of getting it."}</p>`;
}

/* ---------- Decks you can build ---------- */
function deckPoolForBuild() {
  const seen = new Map(); const add = (keys, name, src, extra = {}) => { const c = [...new Set(arr(keys).filter(Boolean))]; if (c.length < 10) return; const k = [...c].sort().join(","); if (!seen.has(k)) seen.set(k, { c, name: name || "Deck", src, ...extra }); };
  tierRows().forEach((r) => add(r.c, r.name, "Tier " + r.tier, { wr: r.wr, games: r.w + r.l }));
  publicDecksAll().forEach((x) => add(arr(x.cards).map((n) => (cardByName(n) || {}).key), x.name, "Shared by " + (handleOf(x.owner) || "a player"), { wr: num(obj(x.stats).wr), games: num(obj(x.stats).games) }));
  Object.entries(shared.profiles).forEach(([id, p]) => { if (id !== store.uid && canSee(id) && p.featured) add(arr(p.featured.cards).map((n) => (cardByName(n) || {}).key), p.featured.name, "Featured by " + (p.handle || "a player"), { wr: num(obj(p.featured.stats).wr), games: num(obj(p.featured.stats).games) }); });
  const mine = new Set(S.decks.map((d) => [...d.cards].sort().join(","))); return [...seen.values()].filter((x) => !mine.has([...x.c].sort().join(",")));
}
function swapFor(k, deck) {
  const c = card(k), words = synWords(c.ability).map(([w]) => w), tags = new Set(cardTags(c));
  const cand = allCards().filter((x) => S.owned[x.key] && !deck.includes(x.key) && !x.upcoming && Math.abs(num(x.cost, 99) - num(c.cost, 99)) <= 1);
  let best = null, bs = -1;
  for (const x of cand) { let s = num(x.cost) === num(c.cost) ? 3 : 0; s += synWords(x.ability).filter(([w]) => words.includes(w)).length * 2; s += cardTags(x).filter((t) => tags.has(t) && t !== "R").length; s += deck.filter((d) => mentions(card(d).ability, x.name) || mentions(x.ability, card(d).name)).length * 3; if (s > bs) { bs = s; best = x.key; } }
  return best;
}
function buildableHtml() {
  if (store.mode !== "cloud") return "";
  const list = deckPoolForBuild().map((d) => ({ ...d, missing: d.c.filter((k) => !S.owned[k]) })).sort((a, b) => a.missing.length - b.missing.length || num(b.wr) - num(a.wr)).slice(0, 12);
  if (!list.length) return "";
  return `<section class="sec"><h2>Decks you can build</h2><p class="muted small">Decks from SNAP Stat players, sorted by how few cards you're missing. Missing cards get a stand-in from your collection.</p>
    <div class="list">${list.map((d) => `<button class="li" data-a="buildOpen" data-k="${esc([...d.c].sort().join(","))}"><div class="grow" style="min-width:0"><div class="t">${esc(d.name)}</div><div class="s">${d.missing.length ? `Missing ${d.missing.length}: ${esc(d.missing.slice(0, 3).map((k) => card(k).name).join(", "))}${d.missing.length > 3 ? "…" : ""}` : "You own every card"} · ${esc(d.src)}${d.games ? ` · ${d.wr}% over ${d.games}` : ""}</div></div>${d.missing.length ? `<span class="pill dim">${d.missing.length}</span>` : `<span class="pill W">Ready</span>`}</button>`).join("")}</div></section>`;
}
let buildKey = "";
function buildSheet() {
  const d = deckPoolForBuild().find((x) => [...x.c].sort().join(",") === buildKey); if (!d) return sheetHead("Deck not found");
  const missing = d.c.filter((k) => !S.owned[k]); const swaps = missing.map((k) => [k, swapFor(k, d.c)]);
  return `${sheetHead(esc(d.name), `${esc(d.src)}${d.games ? ` · ${d.wr}% over ${d.games} games` : ""}`)}
    <div class="chiplist">${[...d.c].sort((a, b) => num(card(a).cost) - num(card(b).cost)).map((k) => cardChip(k, { a: "cardOpen" })).join("")}</div>${curveHtml(d.c)}
    ${swaps.length ? `<h3>Stand-ins from your collection</h3><div class="list">${swaps.map(([k, s]) => `<div class="li">${cardChip(k, { noOwn: false })}<span class="muted">→</span>${s ? cardChip(s, { a: "cardOpen" }) : `<span class="muted small">No close match</span>`}</div>`).join("")}</div>` : ""}
    <div class="grid2">${swaps.length ? `<button class="btn snap" data-a="buildSave" data-swap="1">Save with stand-ins</button>` : ""}<button class="btn ${swaps.length ? "" : "snap"}" data-a="buildSave">Save as it is</button></div>`;
}

/* ---------- Catch-up plan for returning players ---------- */
function daysAway() { const m = realMatches()[0]; return m ? Math.floor((Date.now() - m.ts) / DAY) : 999; }
function catchUpSheet() {
  const away = daysAway(), last = realMatches()[0];
  const bal = last ? balanceChanges().filter((x) => x.date >= localDate(last.ts)).length : 0;
  const com = store.mode === "cloud" ? Object.values(communityAgg().cards).sort((a, b) => b.g - a.g).filter((r) => !S.owned[r.k] && !card(r.k).catModeOnly).slice(0, 5) : [];
  const ready = store.mode === "cloud" ? deckPoolForBuild().filter((d) => d.c.filter((k) => !S.owned[k]).length <= 1).slice(0, 3) : [];
  const P = PACKS ? packPools() : null; const s5 = P ? P.seasonal.find((p) => p.series === "5") : null; const s5m = s5 ? packSummary(s5).missing : [];
  const cs = currentSeason();
  const step = (n, t, body, btn) => `<div class="li" style="flex-direction:column;align-items:stretch;gap:6px"><div class="row nowrap" style="gap:8px"><span class="pill gold">${n}</span><b>${t}</b></div><div class="small">${body}</div>${btn || ""}</div>`;
  let n = 0;
  return `${sheetHead("Catch-up plan", away < 999 ? `Your last logged game was ${plural(away, "day")} ago` : "A quick start for new and returning players")}
    <div class="list">
    ${step(++n, "Bring your collection up to date", "Sync with SnapVault (or tick off what you own) so everything below knows what you have.", `<div><button class="btn sm" data-a="svOpen">Sync with SnapVault</button></div>`)}
    ${bal ? step(++n, "See what changed", `${plural(bal, "card change")} since your last game.`, `<div><button class="btn sm" data-a="go" data-to="balance">Balance changes</button></div>`) : ""}
    ${s5 ? step(++n, "Spend tokens on new cards", s5m.length ? `You're missing ${s5m.length} of the newest Series 5 cards. The ${esc(s5.name)} pack (${fmt(s5.price)} tokens) gives you one each time.` : "You own all the newest Series 5 cards.", `<div><button class="btn sm" data-a="go" data-to="shops">Card Shop helper</button></div>`) : ""}
    ${com.length ? step(++n, "Cards other players use most that you don't have", com.map((r) => esc(card(r.k).name)).join(", ") + ".", `<div class="chiplist">${com.map((r) => cardChip(r.k, { a: "cardOpen" })).join("")}</div>`) : ""}
    ${ready.length ? step(++n, "Decks you can play today", ready.map((d) => esc(d.name)).join(", ") + ".", `<div><button class="btn sm" data-a="go" data-to="cards/decks">See them in Decks</button></div>`) : ""}
    ${num(S.wallet.credits) >= 50 ? step(++n, "Use your credits", `${fmt(S.wallet.credits)} credits is about ${fmt(Math.floor(num(S.wallet.credits) / 50))} Collection Levels of upgrades.`) : ""}
    ${cs ? step(++n, "This season", `${esc(cs.name)} ${endsTxt(cs.endTs)}. Set your rank in Home › Stats to track your climb.`, `<div><button class="btn sm" data-a="go" data-to="home/stats">Stats</button></div>`) : ""}
    </div>`;
}
function catchUpBanner() { const away = daysAway(); return away >= 21 && away < 999 ? `<section class="sec"><div class="panel row between nowrap halftone"><div><b>Welcome back!</b><div class="small muted">It's been ${plural(away, "day")}. Here's how to catch up fast.</div></div><button class="btn sm snap" data-a="catchUp">Catch-up plan</button></div></section>` : ""; }

/* ---------- Event recaps ---------- */
const STD_MODES = new Set(["Ranked", "Conquest", "Friendly"]);
function myEventDecks() {
  const out = {}; const now = Date.now();
  for (const e of events().filter((x) => x.startTs > now - 120 * DAY && x.startTs <= now)) {
    const ms = realMatches().filter((m) => m.ts >= e.startTs && m.ts <= e.endTs && !STD_MODES.has(modeOf(m)) && m.deckId);
    const by = {}; ms.forEach((m) => (by[m.deckId] = by[m.deckId] || []).push(m));
    const top = Object.entries(by).map(([id, l]) => ({ d: S.decks.find((x) => x.id === id), l })).filter((x) => x.d && x.l.length >= 2).sort((a, b) => b.l.length - a.l.length).slice(0, 3)
      .map(({ d, l }) => { const s = statsFor(l); return { n: String(d.name).slice(0, 40), c: d.cards.filter((k) => /^[a-z0-9]+$/.test(k)).sort(), w: s.w, l: s.l }; });
    if (top.length) out[String(e.id).replace(/[.~*/[\]]/g, "_")] = top;
  }
  return out;
}
function eventRecapHtml(e) {
  if (store.mode !== "cloud") return "";
  const sameName = (x) => keyOf(String(x.name).replace(/\b(20\d\d|returns?|is back|again)\b/gi, "")) === keyOf(String(e.name).replace(/\b(20\d\d|returns?|is back|again)\b/gi, ""));
  const ids = [e.id, ...events().filter((x) => x.id !== e.id && sameName(x) && x.endTs < Date.now()).map((x) => x.id)].map((id) => String(id).replace(/[.~*/[\]]/g, "_"));
  const g = new Map(); let used = "";
  for (const id of ids) {
    for (const [uid2, p] of Object.entries(shared.profiles)) { if (!canSee(uid2)) continue; for (const d of arr(obj(p.ev)[id])) { const k = arr(d.c).join(","); if (!k) continue; const x = g.get(k) || { c: arr(d.c), name: d.n, w: 0, l: 0, players: new Set() }; x.w += num(d.w); x.l += num(d.l); x.players.add(uid2); g.set(k, x); } }
    if (g.size) { used = id; break; }
  }
  const rows = [...g.values()].filter((x) => x.w + x.l >= 3).map((x) => ({ ...x, wr: pct(x.w, x.w + x.l) })).sort((a, b) => b.wr - a.wr || b.w + b.l - (a.w + a.l)).slice(0, 5);
  if (!rows.length) return `<p class="muted small">Once SNAP Stat players log games in this mode, the decks that did best show up here${timeState(e) === "upcoming" ? " (from the last time it ran)" : ""}.</p>`;
  return `<h3>${used === String(e.id).replace(/[.~*/[\]]/g, "_") ? "What's winning" : "Best decks last time"}</h3><div class="list">${rows.map((r) => `<button class="li" data-a="evDeckSave" data-k="${esc(r.c.join(","))}" data-n="${esc(r.name)}"><div class="grow" style="min-width:0"><div class="t">${esc(r.name)}</div><div class="s">${r.w}-${r.l} · ${plural(r.players.size, "player")} · tap to save it</div></div><span class="num">${r.wr}%</span></button>`).join("")}</div>`;
}

/* ---------- Turn-by-turn replays ---------- */
function liveSnapshot() {
  if (!live.on) return;
  const my = Object.entries(live.my).filter(([, z]) => z !== "deck").map(([k, z]) => [k, z, z.startsWith("L") ? num(live.myPow[k] ?? card(k).power) : 0]);
  const opp = arr(live.opp).map((o) => [o.key, o.zone, o.zone && o.zone.startsWith("L") ? num(o.power) : 0]);
  const snap = { t: live.turn, my, opp, adj: clone(live.adj), ms: live.mySnap ? 1 : 0, os: live.oppSnap ? 1 : 0 };
  live.log = [...arr(live.log).filter((x) => x.t !== live.turn), snap].sort((a, b) => a.t - b.t).slice(-8);
}
function replayOf(m) { const r = obj(m && m.replay); return arr(r.turns).length ? r : null; }
let rp2 = { r: null, i: 0, title: "" };
function replaySheet() {
  const r = rp2.r; if (!r) return sheetHead("No replay");
  const t = r.turns[clamp(rp2.i, 0, r.turns.length - 1)]; const locs = arr(r.locs);
  const tot = (side, i) => arr(side === "my" ? t.my : t.opp).filter((x) => x[1] === "L" + i).reduce((s, x) => s + num(x[2]), 0) + num(obj(obj(t.adj)[side])[i]);
  const chip = (x) => { const c = card(x[0]); return `<span class="cchip"><span class="c">${esc(c.cost)}</span><span class="p">${esc(x[2])}</span><span>${esc(c.name)}</span></span>`; };
  return `${sheetHead(esc(rp2.title || "Replay"), `Turn ${t.t}${t.ms ? " · you snapped" : ""}${t.os ? " · they snapped" : ""}`)}
    <div class="board">${[0, 1, 2].map((i) => { const a = tot("my", i), b = tot("opp", i); return `<div class="loc"><div class="lh"><b class="small" style="color:#fff">${esc(locs[i] || "Location " + (i + 1))}</b></div><div class="side opp">${arr(t.opp).filter((x) => x[1] === "L" + i).map(chip).join("")}</div><div class="tot ${a > b ? "win" : a < b ? "lose" : ""}"><span>${b}</span><span class="muted small">vs</span><span>${a}</span></div><div class="side">${arr(t.my).filter((x) => x[1] === "L" + i).map(chip).join("")}</div></div>`; }).join("")}</div>
    <div class="row between nowrap"><button class="btn" data-a="replayStep" data-v="-1" ${rp2.i <= 0 ? "disabled" : ""}>‹ Turn</button><span class="num">${clamp(rp2.i, 0, r.turns.length - 1) + 1} / ${r.turns.length}</span><button class="btn" data-a="replayStep" data-v="1" ${rp2.i >= r.turns.length - 1 ? "disabled" : ""}>Turn ›</button></div>
    ${rp2.own ? `<button class="btn" data-a="replayShare">${ICON.copy} Share this replay</button>` : ""}
    <p class="muted small">Recorded by the live tracker at the end of each turn. Their side is on top.</p>`;
}
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => decodeURIComponent(escape(atob(String(s).replace(/-/g, "+").replace(/_/g, "/"))));
function replayLink(m) {
  const r = replayOf(m); if (!r) return "";
  const codeOf = (k) => card(k).code || k; const pack = { l: r.locs, n: String(m.deckName || "").slice(0, 40), o: String(m.oppName || "").slice(0, 40), r: m.result, t: r.turns.map((t) => ({ t: t.t, m: t.my.map((x) => [codeOf(x[0]), x[1], x[2]]), o: t.opp.map((x) => [codeOf(x[0]), x[1], x[2]]), a: t.adj, s: (t.ms ? 1 : 0) + (t.os ? 2 : 0) })) };
  return `${APP_URL}#replay=${b64u(JSON.stringify(pack))}`;
}
function replayFromLink(data) {
  try {
    const j = JSON.parse(unb64u(data)); const keyOfCode = (c) => (cardByCode(c) || card(c) || {}).key || c;
    return { title: `${j.r === "W" ? "Win" : j.r === "L" ? "Loss" : "Game"}${j.n ? " with " + j.n : ""}${j.o ? " vs " + j.o : ""}`, r: { locs: arr(j.l), turns: arr(j.t).map((t) => ({ t: num(t.t), my: arr(t.m).map((x) => [keyOfCode(x[0]), x[1], num(x[2])]), opp: arr(t.o).map((x) => [keyOfCode(x[0]), x[1], num(x[2])]), adj: obj(t.a), ms: num(t.s) & 1, os: num(t.s) & 2 })) } };
  } catch { return null; }
}

/* ---------- Where you stand (percentiles) and card leaderboards ---------- */
function percentilesHtml() {
  if (store.mode !== "cloud") return "";
  const others = Object.entries(shared.profiles).filter(([id, p]) => id !== store.uid && p.handle && canSee(id));
  const cur = currentSeasonPeriod(); const ms = realMatches(); const mySeason = slimStats(statsFor(cur ? inPeriod(ms, cur) : [])), myAll = slimStats(statsFor(ms));
  const metrics = [
    ["Season win rate", (p) => (num(obj(obj(p.stats).season).games) >= 10 ? num(obj(obj(p.stats).season).wr) : null), mySeason.games >= 10 ? mySeason.wr : null, (v) => v + "%"],
    ["Cubes per game", (p) => (num(obj(obj(p.stats).all).games) >= 20 ? num(obj(obj(p.stats).all).cpg) : null), myAll.games >= 20 ? myAll.cpg : null, (v) => signed(v)],
    ["Season cubes", (p) => num(obj(obj(p.stats).season).cubes), mySeason.cubes, (v) => signed(v)],
    ["Games this season", (p) => num(obj(obj(p.stats).season).games), mySeason.games, (v) => fmt(v)],
    ["Collection Level", (p) => num(p.colLevel) || null, num(S.me.colLevel) || null, (v) => fmt(v)],
    ["Cards owned", (p) => num(p.owned) || null, Object.keys(S.owned).length || null, (v) => fmt(v)],
  ];
  const rows = metrics.map(([l, f, mine, show]) => { const vals = others.map(([, p]) => f(p)).filter((v) => v !== null && v !== undefined); if (mine === null || vals.length < 4) return null; const below = vals.filter((v) => v < mine).length; const top = Math.max(1, Math.round(100 - (below / vals.length) * 100)); return { l, v: show(mine), top, n: vals.length + 1 }; }).filter(Boolean);
  if (!rows.length) return `<div class="panel small muted">Once more players use the app, you'll see where you stand among them here.</div>`;
  return `<div class="panel stack small"><span class="eyebrow">Where you stand</span>${rows.map((r) => `<div class="row between nowrap"><span>${esc(r.l)} <span class="muted">· ${esc(r.v)}</span></span><span class="pill ${r.top <= 10 ? "gold" : r.top <= 50 ? "W" : "dim"}">Top ${r.top}%</span></div>`).join("")}<span class="muted">Among ${plural(rows[0].n, "SNAP Stat player")} with enough games.</span></div>`;
}
function cardBoardHtml(k) {
  if (store.mode !== "cloud") return "";
  const rows = Object.entries(shared.profiles).filter(([id, p]) => canSee(id) && p.handle && obj(obj(p.cs).c)[k]).map(([id, p]) => { const v = arr(obj(p.cs.c)[k]); return { id, h: p.handle, g: num(v[0]), w: num(v[1]) }; }).filter((r) => r.g >= 3).sort((a, b) => b.w - a.w || b.g - a.g).slice(0, 5);
  if (rows.length < 2) return "";
  return `<h3>Top players with this card</h3><div class="list">${rows.map((r, i) => `<button class="li" data-a="profileOpen" data-id="${esc(r.id)}"><span class="num" style="width:20px">${i + 1}</span><div class="grow">${esc(r.h)}${r.id === store.uid ? ` <span class="muted small">you</span>` : ""}</div><span class="small muted">${r.w} wins · ${r.g} games</span></button>`).join("")}</div><p class="muted small">Wins in tracked games over the last 30 days.</p>`;
}

/* ---------- Card impact on cubes ---------- */
function cardImpact(ms, keys) {
  const tracked = ms.filter((m) => m.tracked); const out = {};
  for (const k of keys) {
    const yes = [], no = [];
    for (const m of tracked) { const played = arr(m.plays).some((p) => p.k === k) || arr(obj(obj(m.gy).my).destroyed).includes(k); (played ? yes : no).push(num(m.cubes)); }
    if (yes.length >= 3 && no.length >= 3) { const a = yes.reduce((s, v) => s + v, 0) / yes.length, b = no.reduce((s, v) => s + v, 0) / no.length; out[k] = Math.round((a - b) * 10) / 10; }
  }
  return out;
}

/* ---------- Location guide (everyone's tracked games) ---------- */
function myLocStats() {
  const ms = realMatches().filter((m) => m.tracked && m.ts >= Date.now() - 60 * DAY); const ls = {}, lc = {};
  for (const m of ms) arr(m.locs).forEach((L, i) => {
    const k = keyOf(L.name); if (!k || k.length > 40) return; const won = num(L.my) > num(L.opp);
    const r = (ls[k] = ls[k] || [0, 0, 0]); r[0]++; if (won) r[1]++; if (m.result === "W") r[2]++;
    arr(m.plays).filter((p) => num(p.loc) === i && /^[a-z0-9]+$/.test(p.k)).forEach((p) => { const x = ((lc[k] = lc[k] || {})[p.k] = lc[k][p.k] || [0, 0]); x[0]++; if (won) x[1]++; });
  });
  const keep = Object.entries(ls).sort((a, b) => b[1][0] - a[1][0]).slice(0, 40); const top = new Set(keep.slice(0, 15).map(([k]) => k));
  const lc2 = {}; for (const [k, cs] of Object.entries(lc)) if (top.has(k)) lc2[k] = Object.fromEntries(Object.entries(cs).sort((a, b) => b[1][0] - a[1][0]).slice(0, 5));
  return { ls: Object.fromEntries(keep), lc: lc2 };
}
let _clSig = "", _cl = null;
function communityLocs() {
  const sig = `${sharedVer}|${store.uid}`; if (sig === _clSig) return _cl;
  const ls = {}, lc = {};
  for (const [id, p] of Object.entries(shared.profiles)) {
    if (!canSee(id)) continue;
    for (const [k, v] of Object.entries(obj(p.ls))) { const r = (ls[k] = ls[k] || [0, 0, 0, 0]); r[0] += num(arr(v)[0]); r[1] += num(arr(v)[1]); r[2] += num(arr(v)[2]); r[3]++; }
    for (const [k, cs] of Object.entries(obj(p.lc))) for (const [ck, v] of Object.entries(obj(cs))) { const x = ((lc[k] = lc[k] || {})[ck] = lc[k][ck] || [0, 0]); x[0] += num(arr(v)[0]); x[1] += num(arr(v)[1]); }
  }
  _cl = { ls, lc }; _clSig = sig; return _cl;
}
function locCommunityLine(name) {
  if (store.mode !== "cloud") return "";
  const k = keyOf(name), C = communityLocs(), r = C.ls[k]; if (!r || r[0] < 5) return "";
  const best = Object.entries(obj(C.lc[k])).filter(([, v]) => v[0] >= 3).sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0]).slice(0, 3).map(([ck]) => card(ck).name);
  return `<div class="s">SNAP Stat players: won it ${pct(r[1], r[0])}% of ${fmt(r[0])} times${best.length ? ` · best here: ${esc(best.join(", "))}` : ""}</div>`;
}

/* ---------- Sessions ---------- */
function sessionsOf(ms, gap = 45 * 60e3) {
  const list = [...ms].sort((a, b) => a.ts - b.ts); const out = []; let cur = null;
  for (const m of list) { if (!cur || m.ts - cur.end > gap) { cur = { start: m.ts, end: m.ts, ms: [] }; out.push(cur); } cur.ms.push(m); cur.end = m.ts; }
  return out.reverse();
}
function sessionPanel() {
  const ss = sessionsOf(realMatches()); const s = ss[0]; if (!s || Date.now() - s.end > 60 * 60e3 || s.ms.length < 2) return "";
  const st = statsFor(s.ms), usual = ss.slice(1, 31).filter((x) => x.ms.length >= 3); const uc = usual.length ? Math.round((usual.reduce((a, x) => a + statsFor(x.ms).cubes / x.ms.length, 0) / usual.length) * 100) / 100 : null;
  let streak = 0; for (let i = s.ms.length - 1; i >= 0 && s.ms[i].result === "L"; i--) streak++;
  return `<section class="sec"><div class="panel stack small"><div class="row between"><b>This session</b><span class="muted">${plural(s.ms.length, "game")} · ${esc(ago(s.start))}</span></div>
    <div class="row between nowrap"><span class="num" style="font-size:20px;font-weight:800"><span class="pos">${st.w}W</span> · <span class="neg">${st.l}L</span></span>${cubes(signed(st.cubes), st.cubes >= 0 ? "pos" : "neg")}</div>
    ${uc !== null ? `<span>${st.cpg >= uc ? "Better" : "Worse"} than usual: ${signed(st.cpg)} cubes a game (you usually get ${signed(uc)}).</span>` : ""}
    ${streak >= 3 ? `<p class="note">${streak} losses in a row. A short break often helps more than one more game.</p>` : ""}</div></section>`;
}
function sessionsHtml() {
  const ss = sessionsOf(realMatches()).filter((s) => s.ms.length >= 2).slice(0, 10); if (!ss.length) return "";
  return `<section class="sec"><h2>Sessions</h2><div class="tbl-wrap"><table><thead><tr><th>Started</th><th class="n">Games</th><th class="n">W-L</th><th class="n">Cubes</th></tr></thead><tbody>${ss.map((s) => { const st = statsFor(s.ms); return `<tr><td>${esc(dateTimeStr(s.start))}</td><td class="n">${s.ms.length}</td><td class="n">${st.w}-${st.l}</td><td class="n ${st.cubes >= 0 ? "pos" : "neg"}">${signed(st.cubes)}</td></tr>`; }).join("")}</tbody></table></div><p class="muted small">A session is a run of games with no break longer than 45 minutes.</p></section>`;
}
function todaySummary() { const ms = realMatches().filter((m) => localDate(m.ts) === localDate(Date.now())); const s = statsFor(ms); return { day: localDate(Date.now()), games: s.games, w: s.w, l: s.l, t: s.t, cubes: s.cubes }; }

/* ---------- Draft helper ---------- */
const dh = { picks: [], offer: [] };
const IDEAL_CURVE = { 1: 2, 2: 3, 3: 3, 4: 2, 5: 1, 6: 1 };
function pickScore(k, picks) {
  const c = card(k); let s = 0; const why = [];
  const com = store.mode === "cloud" ? communityAgg().cards[k] : null;
  if (com && com.g >= 15) { const d = (pct(com.w, com.g) - 50) / 5; s += d; why.push(`players win ${pct(com.w, com.g)}% with it`); }
  const mine = cardAnalytics(realMatches()).find((r) => r.k === k); if (mine && mine.played >= 5) { s += (mine.wr - 50) / 10; why.push(`you win ${mine.wr}% with it`); }
  const words = synWords(c.ability).map(([w]) => w); let syn = 0;
  for (const p of picks) { const pc = card(p); if (mentions(c.ability, pc.name) || mentions(pc.ability, c.name)) syn += 3; syn += synWords(pc.ability).filter(([w]) => words.includes(w) && w !== "on reveal").length; }
  if (syn) { s += Math.min(6, syn); why.push("works with your picks"); }
  const b = clamp(num(c.cost) || 1, 1, 6); const have = picks.filter((p) => clamp(num(card(p).cost) || 1, 1, 6) === b).length;
  if (have < IDEAL_CURVE[b]) { s += 1; why.push(`your curve needs a ${b}-cost`); } else if (have > IDEAL_CURVE[b] + 1) { s -= 1; why.push(`you have plenty of ${b}-costs`); }
  s += num(c.power) / Math.max(1, num(c.cost)) / 4;
  return { k, s: Math.round(s * 10) / 10, why };
}
function draftHelpSheet() {
  const scored = dh.offer.map((k) => pickScore(k, dh.picks)).sort((a, b) => b.s - a.s);
  return `${sheetHead("Draft helper", "Add the cards you're offered and it scores each pick")}
    <span class="eyebrow">Cards offered</span>
    ${scored.length ? `<div class="list">${scored.map((x, i) => `<div class="li" style="align-items:flex-start">${i === 0 && scored.length > 1 ? `<span class="pill gold">Best</span>` : `<span class="pill dim">${x.s}</span>`}<div class="grow" style="min-width:0">${cardChip(x.k, { noOwn: true })}<div class="muted small">${esc(x.why.join(" · ") || "No strong signal either way")}</div></div><button class="btn sm snap" data-a="dhTake" data-k="${esc(x.k)}">Take</button></div>`).join("")}</div>` : `<p class="muted small">Add the cards the game offers you, then tap Take on the one you choose.</p>`}
    <div class="row"><button class="btn sm" data-a="dhAdd" data-v="doffer" ${dh.offer.length >= 4 ? "disabled" : ""}>${ICON.plus} Add an offered card</button>${dh.offer.length ? `<button class="btn sm ghost" data-a="dhClear">Clear offers</button>` : ""}</div>
    <span class="eyebrow">Your picks (${dh.picks.length})</span><div class="chiplist">${dh.picks.map((k, i) => `<button class="cchip" data-a="dhDrop" data-i="${i}" aria-label="Remove ${esc(card(k).name)}"><span class="c">${esc(card(k).cost)}</span><span>${esc(card(k).name)}</span>${ICON.x}</button>`).join("") || `<span class="muted small">None yet.</span>`}<button class="btn sm" data-a="dhAdd" data-v="dpick">${ICON.plus}</button></div>
    ${dh.picks.length ? curveHtml(dh.picks) : ""}
    <div class="row">${dh.picks.length >= 6 ? `<button class="btn" data-a="dhSave">Save picks as a deck</button>` : ""}${dh.picks.length ? `<button class="btn ghost" data-a="dhReset">Start over</button>` : ""}</div>
    <p class="muted small">Scores mix how well SNAP Stat players and you do with each card, how it fits your picks, and your energy curve. The game's Draft mode rules aren't out yet, so treat it as a second opinion.</p>`;
}

/* ---------- Multiple MARVEL SNAP accounts ---------- */
const ACCTS_KEY = "snapstat.accounts";
function accountsList() { let l = []; try { l = JSON.parse(localStorage.getItem(ACCTS_KEY) || "[]"); } catch { l = []; } return arr(l).filter((a) => a && a.id && a.name); }
function setAccounts(l) { try { localStorage.setItem(ACCTS_KEY, JSON.stringify(l)); } catch { /* ignore */ } if (store.mode === "cloud" && store.uid) store.db.doc(`data/users/${store.uid}/accounts`).set({ items: clone(l) }).catch(() => {}); }
function loadAccounts() { if (store.mode !== "cloud" || !store.db || !store.uid) return; store.db.doc(`data/users/${store.uid}/accounts`).get().then((s) => { const items = s.exists ? arr(obj(s.data()).items) : []; if (items.length) { try { localStorage.setItem(ACCTS_KEY, JSON.stringify(items)); } catch { /* ignore */ } requestRender(); } }).catch(() => {}); }
function currentAccountName() { if (!SLOT) return obj(accountsList().find((a) => a.id === "")).name || "Main account"; return obj(accountsList().find((a) => a.id === SLOT)).name || "Other account"; }
function accountsHtml() {
  const l = accountsList(); const main = l.find((a) => a.id === "") || { id: "", name: "Main account" }; const others = l.filter((a) => a.id);
  const row = (a) => `<div class="li"><div class="grow"><div class="t">${esc(a.name)}${(SLOT || "") === a.id ? ` <span class="pill W">In use</span>` : ""}</div><div class="s">${a.id ? "Its own matches, collection and decks" : "Your profile, posts and social features use this one"}</div></div>${(SLOT || "") === a.id ? "" : `<button class="btn sm" data-a="acctSwitch" data-id="${esc(a.id)}">Switch</button>`}${a.id && (SLOT || "") !== a.id ? `<button class="x" data-a="acctRemove" data-id="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">${ICON.x}</button>` : ""}</div>`;
  return `<section class="sec"><h2>MARVEL SNAP accounts</h2><p class="muted small">Play on more than one MARVEL SNAP account? Give each one its own matches, collection, decks and rank here.</p>
    <div class="list">${[main, ...others].map(row).join("")}</div>
    <div class="row nowrap"><input type="text" id="acct-name" placeholder="Name another account, like “Alt”" maxlength="30" style="flex:1;min-width:0"><button class="btn sm" data-a="acctAdd">Add</button></div>
    ${SLOT ? `<p class="note">You're using “${esc(currentAccountName())}”. Posts, follows and your public profile come from your main account.</p>` : ""}</section>`;
}

/* ---------- Stream overlay ---------- */
let ovTimer = null, ovLast = "";
function overlayData() {
  const t = todaySummary(), cl = climbNow();
  const left = live.on ? Object.entries(live.my).filter(([, z]) => z === "deck").map(([k]) => card(k).name).slice(0, 12) : [];
  return { handle: String(S.me.handle || "").slice(0, 40), rank: cl ? rankStr(cl.rank) : String(S.me.rank || ""), cubesIn: cl ? cl.cubes : null, today: { w: t.w, l: t.l, t: t.t, cubes: t.cubes, games: t.games },
    live: live.on ? { deck: String(live.deckName || "").slice(0, 40), turn: num(live.turn), last: num(live.lastTurn), left, hand: Object.values(live.my).filter((z) => z === "hand").length, ms: !!live.mySnap, os: !!live.oppSnap, opp: String(live.oppName || "").slice(0, 40), seen: [...new Set(arr(live.opp).map((o) => card(o.key).name))].slice(0, 12) } : null, updated: Date.now() };
}
function overlayPush() {
  if (!S.overlay || store.mode !== "cloud" || !store.uid || SLOT) return;
  clearTimeout(ovTimer);
  ovTimer = setTimeout(() => { const d = overlayData(); const sig = JSON.stringify({ ...d, updated: 0 }); if (sig === ovLast) return; ovLast = sig; store.db.doc("live/" + store.uid).set(d).catch(() => {}); }, 1500);
}
function overlayHtml(d, err) {
  if (err) return `<div class="ov-card"><b>Overlay</b><span>${esc(err)}</span></div>`;
  if (!d) return `<div class="ov-card"><span>Waiting for SNAP Stat…</span></div>`;
  const t = obj(d.today), L = d.live;
  return `<div class="ov-card"><div class="ov-row"><b>${esc(d.handle || "SNAP Stat")}</b>${d.rank ? `<span class="ov-pill">${/^inf/i.test(d.rank) ? "Infinite" : "Rank " + esc(d.rank)}</span>` : ""}</div>
    <div class="ov-row"><span>Today</span><b>${num(t.w)}-${num(t.l)}${num(t.t) ? "-" + num(t.t) : ""}</b><b class="${num(t.cubes) >= 0 ? "pos" : "neg"}">${signed(num(t.cubes))} cubes</b></div>
    ${L ? `<div class="ov-row"><span>${esc(L.deck)}</span><b>Turn ${num(L.turn)}/${num(L.last)}</b>${L.ms ? `<span class="ov-pill">Snapped</span>` : ""}${L.os ? `<span class="ov-pill">They snapped</span>` : ""}</div>
      ${arr(L.left).length ? `<div class="ov-small">Still in deck (${arr(L.left).length}): ${esc(arr(L.left).join(", "))}</div>` : ""}${arr(L.seen).length ? `<div class="ov-small">${esc(L.opp || "Opponent")} played: ${esc(arr(L.seen).join(", "))}</div>` : ""}` : ""}</div>`;
}
let ovUnsub = null;
function startOverlay(uid2, api) {
  document.documentElement.classList.add("overlay"); const v = $("#view"); v.innerHTML = overlayHtml(null);
  const db = api && api.db; if (!db || !uid2) { v.innerHTML = overlayHtml(null, "Open this from SNAP Stat › Profile › Stream overlay to get your link."); return; }
  try { ovUnsub = db.doc("live/" + uid2).onSnapshot((s) => { v.innerHTML = overlayHtml(s.exists ? s.data() : null, s.exists ? "" : "Turn on the overlay in SNAP Stat, then play a match."); }, () => { v.innerHTML = overlayHtml(null, "The database isn't sharing the overlay yet. Publish the updated security rules."); }); } catch { v.innerHTML = overlayHtml(null, "Couldn't connect."); }
}
function overlayPanel() {
  if (!window.SNAPSTAT_STANDALONE || store.mode !== "cloud" || SLOT) return "";
  const url = `${APP_URL}#overlay=${store.uid}`;
  return `<section class="sec"><h2>Stream overlay</h2><div class="panel stack small">
    <label class="toggle-row check"><span>Share a live overlay for streaming (your rank, today's record and the live tracker)</span><input type="checkbox" data-ovchk="1" ${S.overlay ? "checked" : ""}></label>
    ${S.overlay ? `<p>Add this link as a <b>Browser source</b> in OBS or Streamlabs (about 420 × 220). It updates as you track matches.</p><div class="row nowrap"><input type="text" readonly value="${esc(url)}" style="flex:1;min-width:0" aria-label="Overlay link"><button class="btn sm" data-a="ovCopy">${ICON.copy} Copy</button></div><span class="muted">Anyone with the link can see it while it's on. Turn it off to stop sharing.</span>` : `<span class="muted">Off. Nothing is shared.</span>`}</div></section>`;
}

/* ---------- Routes, actions, inputs ---------- */

function specialRoute2(h) {
  if (h.startsWith("replay=")) {
    const r = replayFromLink(h.slice(7)); applyNav("home", "live"); render();
    try { history.replaceState(null, "", "#play"); } catch { /* fine */ }
    setTimeout(() => { if (r) { rp2 = { r: r.r, i: 0, title: r.title, own: false }; openSheet(replaySheet); } else toast("That replay link is broken."); }, 0); return true;
  }
  if (h.startsWith("overlay")) { window.__overlay = h.split("=")[1] || "me"; if (!window.SNAPSTAT_STANDALONE) setTimeout(() => startOverlay("", null), 0); return true; }
  return false;
}
Object.assign(A, {
  buildOpen: (el) => { buildKey = el.dataset.k; openSheet(buildSheet); },
  buildSave: (el) => { const d = deckPoolForBuild().find((x) => [...x.c].sort().join(",") === buildKey); if (!d) return; const cards = []; for (const k of d.c) { const c = el.dataset.swap && !S.owned[k] ? swapFor(k, [...d.c, ...cards]) || k : k; if (!cards.includes(c)) cards.push(c); } const nd = newDeck(d.name + (el.dataset.swap ? " (my version)" : ""), cards); closeSheet(); render(); openDeck(nd.id); toast("Deck saved"); },
  catchUp: () => openSheet(catchUpSheet),
  evDeckSave: (el) => { const keys = String(el.dataset.k).split(",").filter(Boolean); const d = newDeck(el.dataset.n || "Event deck", keys); closeSheet(); render(); openDeck(d.id); toast("Deck saved"); },
  replayOpen: (el) => { const m = findMatchById(el.dataset.id); const r = replayOf(m); if (!r) return; rp2 = { r, i: 0, title: `${m.result === "W" ? "Win" : m.result === "L" ? "Loss" : "Tie"}${m.deckName ? " with " + m.deckName : ""}${m.oppName ? " vs " + m.oppName : ""}`, own: true, id: m.id }; openSheet(replaySheet); },
  replayStep: (el) => { rp2.i = clamp(rp2.i + num(el.dataset.v), 0, rp2.r.turns.length - 1); refreshSheet(); },
  replayShare: () => { const m = findMatchById(rp2.id); const url = replayLink(m); if (!url) return; if (navigator.share) navigator.share({ title: "MARVEL SNAP replay", url }).catch(() => {}); else copyText(url, "Replay link copied"); },
  dhOpen: () => openSheet(draftHelpSheet),
  dhAdd: (el) => openPicker(el.dataset.v),
  dhTake: (el) => { if (dh.picks.length < 12) dh.picks.push(el.dataset.k); dh.offer = []; refreshSheet(); },
  dhClear: () => { dh.offer = []; refreshSheet(); }, dhReset: () => { dh.picks = []; dh.offer = []; refreshSheet(); },
  dhDrop: (el) => { dh.picks.splice(num(el.dataset.i), 1); refreshSheet(); },
  dhSave: () => { const d = newDeck("Draft picks", dh.picks); closeSheet(); render(); openDeck(d.id); toast("Saved as a deck"); },
  acctAdd: () => { const n = String(($("#acct-name") || {}).value || "").trim().slice(0, 30); if (!n) { toast("Give it a name"); return; } const l = accountsList(); if (!l.some((a) => a.id === "")) l.unshift({ id: "", name: "Main account" }); if (l.length >= 8) { toast("You can have up to 8 accounts. Remove one first."); return; } l.push({ id: "a" + uid(), name: n }); setAccounts(l); render(); toast(`Added ${n}. Tap Switch to use it.`); },
  acctSwitch: (el) => { try { if (el.dataset.id) localStorage.setItem("snapstat.slot", el.dataset.id); else localStorage.removeItem("snapstat.slot"); } catch { toast("This browser won't remember the switch."); return; } toast("Switching…"); clearTimeout(saveTimer); clearTimeout(weekTimer); Promise.race([Promise.all([dirty ? flushState() : null, dirtyWeeks.size ? flushWeeks() : null]), new Promise((r) => setTimeout(r, 4000))]).catch(() => {}).finally(() => setTimeout(() => location.reload(), 300)); },
  acctRemove: (el) => { const id = el.dataset.id; const l = accountsList().filter((a) => a.id !== id); setAccounts(l); if (id) lsSet("snapstat.removedAccounts", [...new Set([...arr(lsGet("snapstat.removedAccounts")), id])].slice(-20)); render(); toast("Removed from the list. Its data stays saved, and Delete my account removes it too."); },
  ovCopy: () => copyText(`${APP_URL}#overlay=${store.uid}`, "Overlay link copied"),
});
function findMatchById(id) { return allMatches().find((m) => m.id === id) || null; }
function draftHelpPick(k) { if (picker.mode === "doffer") { if (!dh.offer.includes(k) && dh.offer.length < 4) dh.offer.push(k); } else if (!dh.picks.includes(k) && dh.picks.length < 12) dh.picks.push(k); openSheet(draftHelpSheet); }
document.addEventListener("input", (e) => {
  const t = e.target, d = t.dataset;
  if (d.bind === "wallet.tokens") { const v = num(t.value); const l = arr(S.walletLog); const last = l[l.length - 1]; const today = localDate(Date.now()); if (last && localDate(last.t) === today) last.v = v; else l.push({ t: Date.now(), v }); S.walletLog = l.slice(-60); }
});
document.addEventListener("change", (e) => {
  const t = e.target, d = t.dataset;
  if (d.ovchk) { S.overlay = t.checked; save(); if (t.checked) { ovLast = ""; overlayPush(); } else if (store.mode === "cloud") store.db.doc("live/" + store.uid).delete().catch(() => {}); render(); return; }
  if (d.bind === "tokenRate") setTimeout(render, 0);
});
/* The ids in a collection, read once (used when deleting an account's extra data). */
function collIds(path) { return new Promise((res) => { let un = null, done = false; const t = setTimeout(() => { if (!done) { done = true; res([]); } }, 6000); try { un = store.db.collection(path).onSnapshot((qs) => { if (done) return; done = true; clearTimeout(t); res(qs.docs.map((d) => d.id)); if (typeof un === "function") setTimeout(un, 0); }, () => { if (!done) { done = true; clearTimeout(t); res([]); } }); } catch { done = true; clearTimeout(t); res([]); } }); }

/* ---------- Bundle ratings (values from snap.fan) ---------- */
function bundleVerdict(v) { return !v ? ["Not rated", "dim"] : v >= 300 ? ["Great value", "gold"] : v >= 150 ? ["Good value", "W"] : v >= 100 ? ["Fair", "dim"] : ["Poor value", "L"]; }
function ratedBundles() {
  if (!SCHED || !Array.isArray(SCHED.shops)) return [];
  const today = localDate(Date.now());
  const now = Date.now(), seen = new Set();
  return SCHED.shops.map((s, i) => ({ ...s, i })).filter((s) => s.source === "bundle" && (!s.end || s.end >= today) && !(s.endsAt && Date.parse(s.endsAt) <= now) && (num(s.value) || num(s.goldValue))).filter((s) => { const k = [s.title, s.start, s.end, s.price].join("|"); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => num(b.value) - num(a.value) || num(b.goldValue) - num(a.goldValue));
}
function bundleRatingsHtml() {
  const list = ratedBundles(); if (!list.length) return "";
  const today = localDate(Date.now());
  return `<section class="sec"><h2>Bundle ratings</h2><p class="muted small">What each bundle is worth in gold compared with its price, rated by snap.fan. 100% means you get what you pay for; that's about 80 gold of value per $1, about what buying gold directly gives.</p>
    <div class="list">${list.slice(0, 15).map((s) => { const [v, cls] = bundleVerdict(num(s.value)); const soon = s.start && s.start > today; return `<button class="li" data-a="bundleOpen" data-i="${s.i}"><div class="grow" style="min-width:0"><div class="t">${esc(s.title)}${soon ? ` <span class="pill gold">Soon</span>` : ""}</div><div class="s">${s.price ? "$" + esc(s.price) : "Price not listed"}${num(s.goldValue) ? ` · about ${fmt(s.goldValue)} gold of stuff` : ""}${s.end ? ` · until ${esc(dateStr(s.end))}` : ""}</div></div><div class="stack" style="gap:2px;align-items:flex-end"><span class="pill ${cls}">${esc(v)}</span>${num(s.value) ? `<span class="small num">${num(s.value)}%</span>` : ""}</div></button>`; }).join("")}</div></section>`;
}
let bundleI = -1;
function bundleSheet() {
  const s = arr(SCHED && SCHED.shops)[bundleI]; if (!s) return sheetHead("Bundle not found");
  const [v, cls] = bundleVerdict(num(s.value)); const perDollar = s.price && num(s.goldValue) ? Math.round(num(s.goldValue) / num(s.price)) : 0;
  const want = new Set(S.variants.filter((x) => x.wish && !x.owned && x.cat).map((x) => x.cat));
  return `${sheetHead(esc(s.title), `${s.price ? "$" + esc(s.price) : "Price not listed"}${s.end ? ` · until ${esc(dateStr(s.end))}` : ""}`)}
    <div class="row"><span class="pill ${cls}">${esc(v)}</span>${num(s.value) ? `<span class="small">Bundle value ${num(s.value)}%</span>` : ""}${num(s.currencyValue) ? `<span class="small muted">currencies alone ${num(s.currencyValue)}%</span>` : ""}</div>
    ${arr(s.breakdown).length ? `<div class="tbl-wrap"><table><thead><tr><th>What's inside</th><th class="n">Gold value</th></tr></thead><tbody>${arr(s.breakdown).map(([n, g]) => `<tr><td>${esc(n)}</td><td class="n">${fmt(g)}</td></tr>`).join("")}<tr><td><b>Total</b></td><td class="n"><b>${fmt(s.goldValue)}</b></td></tr></tbody></table></div>` : ""}
    ${perDollar ? `<p class="small">That's about <b>${fmt(perDollar)} gold of value per $1</b>, versus about 80 at 100% value.</p>` : ""}
    ${arr(s.items).length ? `<span class="eyebrow">Cards and variants</span><div class="chiplist">${arr(s.items).map((it) => { const c = it.cardId ? cardByCode(cardCode(it.cardId)) : null; const w = it.cat && want.has(it.cat); const own = it.cat ? !!S.variants.find((x) => x.cat === it.cat && x.owned) : c && !it.variantId ? !!S.owned[c.key] : false; return `<span class="cchip ${own ? "" : "miss"}">${w ? "♥ " : ""}${esc(c ? c.name : it.cardName || "")}${it.variantId ? ` <span class="muted">· ${esc(it.label)}</span>` : ""}${own ? ` <span class="muted">✓</span>` : ""}</span>`; }).join("")}</div>` : ""}
    <p class="muted small">Ratings come from snap.fan and count cosmetics at their usual gold price. A bundle is only worth it if you want what's inside.</p>`;
}
Object.assign(A, { bundleOpen: (el) => { bundleI = num(el.dataset.i); openSheet(bundleSheet); } });
