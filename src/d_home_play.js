/* ============ Shared view bits ============ */
function periodChips() { return `<div class="chips" role="group" aria-label="Time period">${periods().map((p) => `<button class="chip" data-a="period" data-v="${esc(p.id)}" aria-pressed="${ui.period === p.id}">${esc(p.label)}</button>`).join("")}</div>`; }
function ring(v) {
  const r = 40, c = 2 * Math.PI * r, off = c * (1 - clamp(v, 0, 100) / 100);
  return `<svg class="ring" viewBox="0 0 96 96" role="img" aria-label="Win rate ${v}%"><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--snap-a)"/><stop offset="1" stop-color="var(--snap-b)"/></linearGradient></defs><circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="9"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="url(#rg)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 48 48)"/><text x="48" y="55" text-anchor="middle" font-size="25">${v}%</text></svg>`;
}
function cubeChart(pm) {
  const pts = [...pm].sort((a, b) => a.ts - b.ts); if (pts.length < 2) return "";
  let run = 0; const ys = [0, ...pts.map((m) => (run += num(m.cubes)))];
  const W = 340, H = 140, L = 36, R = 34, T = 12, B = 24;
  const min = Math.min(0, ...ys), max = Math.max(0, ...ys), span = max - min || 1;
  const x = (i) => L + (i * (W - L - R)) / (ys.length - 1), y = (v) => T + ((max - v) * (H - T - B)) / span;
  const line = ys.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(ys.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)}Z`;
  const ticks = [...new Set([max, 0, min])]; const last = ys[ys.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net cubes over time, ending at ${last}">
    ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="var(--line)" stroke-width="1" ${t === 0 ? "" : 'stroke-dasharray="3 4"'}/><text x="${L - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${signed(t)}</text>`).join("")}
    <path d="${area}" fill="var(--cube)" opacity=".12"/><path d="${line}" fill="none" stroke="var(--cube)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x(ys.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="4" fill="var(--cube)" stroke="var(--bg)" stroke-width="2"/>
    <text x="${(x(ys.length - 1) + 6).toFixed(1)}" y="${(y(last) + 4).toFixed(1)}" style="fill:var(--fg);font-weight:700">${signed(last)}</text>
    <text x="${L}" y="${H - 6}">${dayStr(pts[0].ts)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${dayStr(pts[pts.length - 1].ts)}</text></svg>`;
}
function exampleNote(list) { return list.some((m) => m.example) ? `<div class="note">Includes example data so you can see how this works. <button class="btn sm ghost" data-a="clearExamples">Clear examples</button></div>` : ""; }
function passBar(level, of) { return `<div class="bar" role="img" aria-label="Pass level ${level} of ${of}"><i style="width:${barW(num(level), num(of))}%"></i></div>`; }

/* ============ Home ============ */
function seasonHero() {
  const cs = currentSeason();
  if (!cs) {
    const next = seasons().filter((s) => timeState(s) === "upcoming").pop();
    return `<div class="season halftone halftone-dots"><span class="eyebrow">Season</span><span class="nm">${next ? "Next: " + esc(next.name) : "No season added"}</span><span class="muted small">${next ? "Starts " + esc(dateStr(next.start)) : "Add seasons to track your rank, pass progress and collectibles each season."}</span><div><button class="btn sm" data-a="go" data-to="seasons">Seasons</button></div></div>`;
  }
  const p = obj(S.passes[cs.id]); const of = num(cs.passLevels) || 50; const r = obj(S.ranks["s:" + cs.id]);
  const items = collectibleItems(cs); const got = items.filter((it) => findCollectible(it, cs.name, cs.startTs).owned).length;
  const bg = showArt() ? seasonArt(cs) : "";
  return `<button class="season halftone halftone-dots ${bg ? "has-art" : ""}" data-a="seasonOpen" data-id="${esc(cs.id)}" style="text-align:left;cursor:pointer">${bg ? imgTag(bg, "sbg") : ""}
    <div class="row between"><span class="eyebrow">Current season · ${endsTxt(cs.endTs)}</span>${rankBadge(S.me.rank || r.end)}</div>
    <span class="nm">${esc(cs.name)}</span>
    <div class="row between small"><span>Season pass level <b class="num">${num(p.level)}</b> / ${of}${num(p.xpNext) ? ` · ${fmt(num(p.xp))}/${fmt(num(p.xpNext))} to the next` : ""} · ${esc(PASS_TIERS[p.tier] || "Free")}</span><span>${got}/${items.length} collected</span></div>
    ${passBar(num(p.level), of)}${(() => { const r = passPace(cs); return r && !r.done && r.needPerDay ? `<span class="small muted">${fmt(r.needPerDay)} pass XP a day reaches level ${r.goalLevel}${r.perDay ? ` · on pace for ${r.endLevel}` : ""}</span>` : ""; })()}</button>`;
}
function eventsStrip() {
  const ev = events(); const liveEv = ev.filter((e) => timeState(e) === "live"); const next = ev.filter((e) => timeState(e) === "upcoming").slice(0, 3);
  if (!liveEv.length && !next.length) return "";
  const row = (e) => { const st = timeState(e); return `<button class="li ev" data-a="eventOpen" data-id="${esc(e.id)}"><span class="pill ${st === "live" ? "live" : "dim"}">${st === "live" ? "LIVE" : esc(dayStr(e.startTs))}</span><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(EVENT_TYPES[e.type] || "Event")} · ${st === "live" ? endsTxt(e.endTs) : "starts in " + cdSpan(e.startTs)}</div></div><span class="muted">›</span></button>`; };
  return `<section class="sec"><div class="sec-h"><h2>Events & modes</h2><button class="btn sm ghost" data-a="go" data-to="events">All events</button></div><div class="list">${liveEv.map(row).join("")}${next.map(row).join("")}</div></section>`;
}
function homeParts() {
  const ms = allMatches(); const p = periodById(ui.period); const pm0 = inPeriod(ms, p); const pm = byMode(pm0); const st = statsFor(pm);
  const alerts = wishAlerts();
  const wallet = `<div class="wallet">${[["credits", "Credits"], ["gold", "Gold"], ["tokens", "Collector's Tokens"]].map(([k, l]) => `<button data-a="go" data-to="shops"><div class="k">${l}</div><div class="v">${fmt(S.wallet[k])}</div></button>`).join("")}
    <button data-a="go" data-to="account"><div class="k">Collection Lvl</div><div class="v">${S.me.colLevel ? fmt(S.me.colLevel) : "—"}</div></button></div>`;
  const statsBlock = !ms.length ? `<div class="empty"><strong>No matches yet</strong><span>Track a game in Home › Live match, or log one after it ends. Want to see the stats first?</span><div class="row"><button class="btn snap" data-a="go" data-to="play">Track a match</button><button class="btn" data-a="loadExamples">Load example matches</button></div></div>`
    : `${exampleNote(ms)}
    <div class="panel hero-stat halftone">${ring(st.wr)}<div class="stack" style="gap:4px">
      <div class="eyebrow">${esc(p.label)} · ${fmt(st.games)} games</div>
      <div class="num" style="font-size:24px;font-weight:800"><span class="pos">${st.w}W</span> · <span class="neg">${st.l}L</span> · <span class="muted">${st.t}T</span></div>
      <div class="row">${cubes(signed(st.cubes), st.cubes >= 0 ? "pos" : "neg")}<span class="muted small">net cubes</span></div></div></div>
    <div class="tiles">
      <div class="tile"><div class="k">Cubes / game</div><div class="v">${st.cpg}</div></div><div class="tile"><div class="k">Snap win %</div><div class="v">${st.snaps ? st.snapWr + "%" : "—"}</div></div>
      <div class="tile"><div class="k">Biggest win</div><div class="v">${st.maxWin ? "+" + st.maxWin : "—"}</div></div><div class="tile"><div class="k">You retreated</div><div class="v">${st.ret}</div></div>
      <div class="tile"><div class="k">They retreated</div><div class="v">${st.oppRet}</div></div><div class="tile"><div class="k">Likely bots</div><div class="v">${st.bots}</div></div></div>
    ${pm.length > 1 ? `<div class="panel"><div class="eyebrow" style="margin-bottom:6px">Net cubes · ${esc(p.label)}</div>${cubeChart(pm)}</div>` : ""}`;
  const decks = topDecks(pm).slice(0, 5);
  const faced = {}; pm.forEach((m) => arr(m.oppCards).forEach((n) => (faced[n] = (faced[n] || 0) + 1)));
  const facedTop = Object.entries(faced).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const seasonRows = periods().filter((x) => x.id.startsWith("s:") || x.id.startsWith("m:")).map((x) => ({ x, s: statsFor(inPeriod(ms, x)), r: obj(S.ranks[x.id]), pass: x.season ? obj(S.passes[x.season.id]) : {} })).filter((r) => r.s.games || r.r.end || r.r.peak);
  const top = `${seasonHero()}
  ${!S.me.onboarded ? `<div class="panel stack halftone"><h3>Create your profile</h3><p class="muted small">Add your in-game name, country and alliance so friends can follow your stats.</p><div><button class="btn snap" data-a="onboard">Get started</button></div></div>` : ""}
  ${trackerHomeHtml()}
  ${freshNudgeHtml()}
  ${clockHtml()}
  ${homeShow("webshop") ? webshopHtml() : ""}
  ${numbersHtml()}
  ${eventsPassHome()}
  ${recapBanner()}
  ${natUpdateBanner()}${catchUpBanner()}${sessionPanel()}${homeShow("challenges") ? challengesHomeHtml() : ""}${todayHtml()}
  ${homeShow("svsync") ? svSyncPanel() : ""}
  ${homeShow("events") ? eventsStrip() : ""}
  ${homeShow("balance") ? balanceHomePanel() : ""}
  ${homeShow("vg") ? vgPinnedHtml(true) : ""}
  ${extHtml(homeTopList())}
  ${alerts.length ? `<section class="sec"><div class="sec-h"><h2>Wishlist alerts</h2><button class="btn sm ghost" data-a="go" data-to="shops">Shops</button></div><div class="list">${alerts.slice(0, 4).map(alertRow).join("")}</div></section>` : ""}`;
  const match = `<section class="sec"><div class="sec-h"><h2>Match stats</h2>${ms.length ? `<button class="btn sm" data-a="quickOpen">${ICON.plus} Quick log</button>` : ""}</div>${lastMatchHtml()}${periodChips()}${modeChips(pm0)}${statsBlock}</section>`;
  const details = `  ${pm.some((m) => m.tracked) ? cardLocSection(pm) : ""}
  ${decks.length ? `<section class="sec"><h2>Decks played</h2><div class="list">${decks.map((d) => `<div class="li"><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${d.games} games · ${d.w}-${d.l}-${d.t}</div></div><span class="num" style="font-weight:800">${d.wr}%</span>${cubes(signed(d.cubes), d.cubes >= 0 ? "pos" : "neg")}</div>`).join("")}</div></section>` : ""}
  ${facedTop.length ? `<section class="sec"><h2>Cards you face most</h2><div class="chiplist">${facedTop.map(([n, c]) => nameChip(n, ` <span class="muted">×${c}</span>`)).join("")}</div></section>` : ""}
  ${seasonRows.length ? `<section class="sec"><div class="sec-h"><h2>Season history</h2><button class="btn sm" data-a="recapOpen">Recap picture</button></div><div class="tbl-wrap"><table><thead><tr><th>${seasons().length ? "Season" : "Month"}</th><th class="n">Rank</th><th class="n">Peak</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Cubes</th><th class="n">Pass</th></tr></thead><tbody>${seasonRows.map((r) => `<tr><td>${esc(plainLabel(r.x))}</td><td class="n">${esc(r.r.end || "—")}</td><td class="n">${esc(r.r.peak || "—")}</td><td class="n">${r.s.games}</td><td class="n">${r.s.games ? r.s.wr + "%" : "—"}</td><td class="n ${r.s.cubes >= 0 ? "pos" : "neg"}">${signed(r.s.cubes)}</td><td class="n">${r.pass.level ? num(r.pass.level) : "—"}</td></tr>`).join("")}</tbody></table></div></section>` : ""}`;
  return { top, match, details, has: ms.length > 0 };
}
// Home's first section: what's going on now, and a summary of your games.
function vHomeOverview() { const h = homeParts(); return `${h.top}${h.match}${h.has ? `<section class="sec"><div class="grid2"><button class="btn" data-a="go" data-to="home/stats">All your stats</button><button class="btn" data-a="go" data-to="home/matches">Match history</button></div></section>` : ""}`; }
// Everything about how you've been playing.
function vHomeStats() { const h = homeParts(); return `${h.match}${h.details}${vInsights({ noChips: true })}${extHtml(EXT.homeStats)}`; }
function vHome() { return vHomeOverview(); }
function cardLocSection(pm) {
  const seg = `<div class="seg"><button data-a="statView" data-v="cards" aria-pressed="${ui.statView === "cards"}">Cards</button><button data-a="statView" data-v="locs" aria-pressed="${ui.statView === "locs"}">Locations</button></div>`;
  let body;
  if (ui.statView === "locs") {
    const rows = locationAnalytics(pm).slice(0, 25);
    body = rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Location</th><th class="n">Games</th><th class="n">Match W%</th><th class="n">Won it</th><th class="n">Avg pow</th><th class="n">Best</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${r.games}</td><td class="n">${r.wr}%</td><td class="n">${r.lwr}%</td><td class="n">${r.avg}</td><td class="n">${r.max}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">Name the locations in the live tracker to see stats here.</p>`;
  } else {
    const rows = cardAnalytics(pm).sort((a, b) => b.played - a.played).slice(0, 25);
    body = rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Card</th><th class="n">Played</th><th class="n">Win %</th><th class="n">Avg pow</th><th class="n">Best</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(card(r.k).name)}</td><td class="n">${r.played}</td><td class="n">${r.wr}%</td><td class="n">${r.avg}</td><td class="n">${r.max}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">Play cards in the live tracker to see card stats.</p>`;
  }
  return `<section class="sec"><h2>Cards & locations</h2><p class="muted small">From matches you tracked live: how often you played each card, your win rate when you did, and the power it reached.</p>${seg}${body}</section>`;
}
function alertRow(a) {
  const price = a.o.auto ? offerPrice(a.o) : `${fmt(a.o.price)} ${CURR[a.o.currency] || ""}`;
  const status = a.have === null ? `<span class="pill dim">${a.o.currency === "event" ? "Event shop" : "Real-money offer"}</span>` : a.short === 0 ? `<span class="pill W">You can afford it</span>` : `<span class="pill warn">Need ${fmt(a.short)} more</span>`;
  return `<div class="alert"><span class="dot ${a.short === 0 ? "ok-bg" : "short-bg"}"></span><div class="grow" style="min-width:0;flex:1"><div style="font-weight:600">${esc(a.w.name)}</div><div class="muted small">${esc(a.w.kind)} in ${esc(SHOPS[a.o.shop] || a.o.shop)}${a.o.title ? " · " + esc(a.o.title) : ""} · ${esc(price)}${a.have !== null ? ` · you have ${fmt(a.have)}` : ""}${a.o.expires ? ` · until ${esc(dateStr(a.o.expires))}` : ""}</div></div>${status}</div>`;
}

/* ============ Play: live tracker ============ */
function vPlay() {
  return `<section class="sec"><h1>Play</h1><div class="seg" role="group"><button data-a="playSeg" data-v="live" aria-pressed="${ui.playSeg === "live"}">Live match</button><button data-a="playSeg" data-v="log" aria-pressed="${ui.playSeg === "log"}">Match log</button><button data-a="playSeg" data-v="insights" aria-pressed="${ui.playSeg === "insights"}">Insights</button></div></section>${ui.playSeg === "live" ? vLive() : ui.playSeg === "insights" ? vInsights() : vLog()}`;
}
function vLive() {
  if (!live.on) {
    const decks = [...S.decks].filter((d) => d.status !== "future").sort((a, b) => (a.status === "draft") - (b.status === "draft"));
    return `<section class="sec"><h2>Start a match</h2><p class="muted small">Pick the deck you queued with. Tap cards as you draw and play them, set their power, add what your opponent reveals, and the result is logged with every card and location stat.</p>
      ${decks.length ? `<div class="list">${decks.map((d) => `<button class="li" data-a="liveStart" data-id="${esc(d.id)}">${deckCover(d)}<div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${d.cards.length} cards${d.status === "draft" ? " · draft" : ""}</div></div><span class="pill gold">Start</span></button>`).join("")}</div>` : `<div class="empty"><strong>No decks yet</strong><span>Build or paste one in Decks, or start without a deck to track only your opponent.</span><button class="btn" data-a="go" data-to="decks">Go to Decks</button></div>`}
      <button class="btn" data-a="liveStart" data-id="">Start without a deck</button></section>`;
  }
  const L = live;
  const stakes = Math.pow(2, (L.mySnap ? 1 : 0) + (L.oppSnap ? 1 : 0)) * (L.turn >= L.lastTurn ? 2 : 1);
  const mine = (z) => Object.entries(L.my).filter(([, s]) => s === z).map(([k]) => k).sort((a, b) => num(card(a).cost) - num(card(b).cost));
  const theirs = (z) => L.opp.map((o, i) => ({ ...o, i })).filter((o) => o.zone === z);
  const LD = S.decks.find((d) => d.id === L.deckId) || null;  // so your cards show the variants this deck uses
  const score = botScore(L.sig, L.turn, L.oppSnap), lab = botLabel(score);
  const loc = (i) => { const t = locTotals(i); const st = t.my > t.opp ? "win" : t.my < t.opp ? "lose" : "";
    const info = locByName(L.locs[i]);
    return `<div class="loc"><div class="lh"><input type="text" id="live-loc-${i}" data-live="loc${i}" value="${esc(L.locs[i])}" placeholder="Location ${i + 1}" aria-label="Location ${i + 1} name" list="loc-names" autocomplete="off">${info && info.ability ? `<div class="lab">${esc(info.ability)}</div>` : ""}${locTip(L.locs[i], L.deckId)}</div>
    <div class="side opp">${theirs("L" + i).map((o) => cardChip(o.key, { a: "oppCard", noOwn: true, pow: o.power, size: "xs", extra: `data-i="${o.i}"` })).join("")}</div>
    <button class="tot ${st}" data-a="locAdj" data-v="${i}" style="background:none;border:0;width:100%" aria-label="Adjust location totals"><span>${t.opp}</span><span class="muted small">vs</span><span>${t.my}</span></button>
    <div class="side">${mine("L" + i).map((k) => cardChip(k, { a: "myCard", noOwn: true, pow: L.myPow[k] ?? card(k).power, deck: LD, size: "xs" })).join("")}</div></div>`; };
  const wins = [0, 1, 2].filter((i) => { const t = locTotals(i); return t.my > t.opp; }).length;
  const gyRow = (z) => { const m = mine(z), o = theirs(z); if (!m.length && !o.length) return ""; return `<div class="stack" style="gap:6px"><span class="eyebrow">${ZONES[z]}</span><div class="zone"><div class="chiplist">${m.map((k) => cardChip(k, { a: "myCard", noOwn: true, deck: LD })).join("") || `<span class="muted small">None of yours</span>`}</div><div class="chiplist">${o.map((x) => cardChip(x.key, { a: "oppCard", noOwn: true, extra: `data-i="${x.i}"` })).join("") || `<span class="muted small">None of theirs</span>`}</div></div></div>`; };
  const gy = ["destroyed", "discarded", "banished"].map(gyRow).join("");
  return `<section class="sec">
    <div class="row between"><div><div class="eyebrow">${esc(L.deckName)}</div><h2>Turn ${L.turn}${L.turn >= L.lastTurn ? " · final" : ""}</h2></div>
      <div class="stepper"><button data-a="turn" data-v="-1" aria-label="Previous turn">−</button><span>${L.turn}</span><button data-a="turn" data-v="1" aria-label="Next turn">+</button></div></div>
    <div class="row"><label class="check"><input type="checkbox" data-livechk="mySnap" ${L.mySnap ? "checked" : ""}> You snapped</label><label class="check"><input type="checkbox" data-livechk="oppSnap" ${L.oppSnap ? "checked" : ""}> They snapped</label><label class="check"><input type="checkbox" data-livechk="extra" ${L.lastTurn === 7 ? "checked" : ""}> 7-turn game</label></div>
    <div class="row">${cubes(stakes)}<span class="muted small">at stake right now · you're winning ${wins} of 3 locations</span></div></section>
  <section class="sec"><div class="sec-h"><h2>Board</h2><span class="muted small">Them on top, you below. Tap a total to add location bonuses.</span></div><div class="board">${loc(0)}${loc(1)}${loc(2)}</div>${locDatalist()}
    <div class="row"><button class="btn sm" data-a="oppAdd">${ICON.plus} Add their card</button><span class="muted small">Their hand</span><div class="stepper"><button data-a="oppHand" data-v="-1" aria-label="One fewer">−</button><span>${L.oppHand}</span><button data-a="oppHand" data-v="1" aria-label="One more">+</button></div></div>
    ${theirs("hand").length ? `<div class="row"><span class="eyebrow">Known in their hand</span>${theirs("hand").map((o) => cardChip(o.key, { a: "oppCard", noOwn: true, extra: `data-i="${o.i}"` })).join("")}</div>` : ""}</section>
  ${L.deckId || Object.keys(L.my).length ? `<section class="sec"><h2>Your hand <span class="muted small num">(${mine("hand").length})</span></h2><div class="chiplist">${mine("hand").map((k) => cardChip(k, { a: "myCard", noOwn: true, deck: LD })).join("") || `<span class="muted small">Tap cards in your deck below as you draw them.</span>`}</div>
    ${turnPlannerHtml(L, mine("hand"))}
    <h3>Still in deck <span class="muted small num">(${mine("deck").length})</span></h3>${drawOddsLine(L)}<div class="chiplist">${mine("deck").map((k) => cardChip(k, { a: "draw", noOwn: true, deck: LD })).join("") || `<span class="muted small">Deck is empty.</span>`}</div></section>` : ""}
  ${gy ? `<section class="sec"><h2>Destroyed, discarded & banished</h2><div class="zone"><span class="eyebrow">Yours</span><span class="eyebrow">Theirs</span></div>${gy}</section>` : ""}
  <section class="sec"><div class="sec-h"><h2>What they might have</h2><button class="btn sm snap" data-a="predict" ${live.predBusy ? "disabled" : ""}>${ICON.spark} ${live.pred ? "Update guess" : "Predict"}</button></div>${matchupHint(L)}${predictionHtml()}</section>
  <section class="sec"><h2>Bot check</h2><div class="panel stack">
    <label class="f">Opponent name<input type="text" id="live-opp" data-live="oppName" value="${esc(L.oppName)}" placeholder="As shown in game"></label><div id="rival-box">${rivalLine(L.oppName)}</div>
    <div class="row between"><span class="small">Emotes they've used</span><div class="stepper"><button data-a="emote" data-v="-1" aria-label="One fewer">−</button><span>${L.sig.emotes}</span><button data-a="emote" data-v="1" aria-label="One more">+</button></div></div>
    <label class="check"><input type="checkbox" data-livesig="oddPlays" ${L.sig.oddPlays ? "checked" : ""}> Odd plays (wasted energy, bad placements)</label>
    <label class="check"><input type="checkbox" data-livesig="genericName" ${L.sig.genericName ? "checked" : ""}> Name looks auto-generated</label>
    <label class="check"><input type="checkbox" data-livesig="defaultLook" ${L.sig.defaultLook ? "checked" : ""}> Default card back and avatar</label>
    <label class="check"><input type="checkbox" data-livesig="noRetreat" ${L.sig.noRetreat ? "checked" : ""}> Stayed in a game they were clearly losing</label>
    <label class="f">Their win % (if you know it)<input type="number" id="live-wp" data-livewp="1" value="${esc(L.sig.winPct)}" inputmode="decimal" placeholder="e.g. 42"></label>
    <div class="meter" aria-hidden="true"><b style="left:calc(${score}% - 2px)"></b></div>
    <div class="row between"><span class="small muted">Human</span><span class="pill ${lab === "likely" ? "L" : lab === "human" ? "W" : "dim"}">${BOT_TXT[lab]} · ${score}</span><span class="small muted">Bot</span></div>
    <p class="muted small">A guess from what you can see in a match. Bots tend not to emote, rarely snap, and make odd plays.</p></div></section>
  ${extHtml(EXT.liveMatch)}
  <div class="row"><button class="btn snap" data-a="liveEnd">End match & log it</button><button class="btn ghost" data-a="liveCancel">${L.confirmCancel ? "Tap again to discard" : "Discard match"}</button></div>`;
}
function predictionHtml() {
  const p = live.pred;
  if (live.predBusy) return `<p class="muted">Reading the board…</p>`;
  if (!p) return `<p class="muted small">${live.opp.length ? "Tap Predict to guess their deck and what's in their hand." : "Add the cards they reveal, then tap Predict."}${store.sample ? "" : " Without AI access in this view, the guess comes from decks you've logged and shared card effects."}</p>`;
  const row = (x) => `<div class="prob"><span>${nameChip(x.name)}</span><div class="bar"><i style="width:${clamp(num(x.chance), 0, 100)}%"></i></div><span class="num" style="text-align:right">${clamp(num(x.chance), 0, 100)}%</span></div>${x.why ? `<div class="muted small" style="margin:-4px 0 4px">${esc(x.why)}</div>` : ""}`;
  return `<div class="panel stack"><div class="row between"><b>${esc(p.archetype || "Unknown deck")}</b>${p.local ? `<span class="pill dim">From your history</span>` : `<span class="pill gold">AI guess</span>`}</div>
    ${arr(p.inHand).length ? `<span class="eyebrow">Likely in their hand</span>${arr(p.inHand).slice(0, 5).map(row).join("")}` : ""}
    ${arr(p.deck).length ? `<span class="eyebrow">Rest of their deck</span><div class="chiplist">${arr(p.deck).slice(0, 12).map((x) => nameChip(x.name, ` <span class="muted">${clamp(num(x.chance), 0, 100)}%</span>`)).join("")}</div>` : ""}
    ${arr(p.watchOut).length ? `<span class="eyebrow">Play around</span><ul style="margin:0;padding-left:18px" class="small">${arr(p.watchOut).slice(0, 4).map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
    ${p.tip ? `<p class="small muted">${esc(p.tip)}</p>` : ""}</div>`;
}
async function runPredict() {
  const L = live; L.predBusy = true; render();
  try {
    if (!store.sample) live.pred = predictLocal();
    else {
      const seen = live.opp.map((o) => `${card(o.key).name} (${o.zone.startsWith("L") ? "played at " + (live.locs[num(o.zone.slice(1))] || "location " + (num(o.zone.slice(1)) + 1)) : o.zone}${o.turn ? ", turn " + o.turn : ""})`).join("; ");
      const history = predictLocal().deck.slice(0, 8).map((d) => d.name).join(", ");
      const prompt = `You are a MARVEL SNAP expert. Predict the opponent's deck and hand mid-match.
Turn ${live.turn} of ${live.lastTurn}. Opponent hand size: ${live.oppHand}. Opponent cards seen: ${seen || "none yet"}.
Locations: ${live.locs.map((n, i) => n || "Location " + (i + 1)).join(", ")}. They snapped: ${live.oppSnap ? "yes" : "no"}.
Cards that often appeared with these in this player's past opponents: ${history || "no history"}.
Use real MARVEL SNAP card names. Reply with JSON only: {"archetype": "deck name", "deck": [{"name": card, "chance": 0-100}] (up to ${Math.max(4, 12 - live.opp.length)} cards they likely still have), "inHand": [{"name": card, "chance": 0-100, "why": "short"}] (up to 5), "watchOut": ["short warnings about plays to expect"], "tip": "one sentence of advice for this turn"}`;
      const r = obj(await store.sample.json(prompt, { modelTier: "default" }));
      if (live !== L || !L.on) return;
      live.pred = { archetype: String(r.archetype || ""), deck: arr(r.deck).slice(0, 12), inHand: arr(r.inHand).slice(0, 5), watchOut: arr(r.watchOut).map(String).slice(0, 4), tip: String(r.tip || "") };
    }
  } catch (e) { if (live === L && L.on) { live.pred = predictLocal(); toast(e && e.code === "rate_limited" ? "AI is busy, so this guess uses your history." : "AI wasn't available, so this guess uses your history."); } }
  finally { L.predBusy = false; }
  if (live === L) { saveLive(); render(); }
}
function myCardSheet(k) {
  return () => {
    const c = card(k), st = live.my[k]; const pw = live.myPow[k] ?? c.power;
    const zb = (z, l) => `<button class="btn ${st === z ? "snap" : ""}" data-a="mySet" data-k="${esc(k)}" data-v="${z}">${l}</button>`;
    return `${sheetHead(esc(c.name), `Cost ${esc(c.cost)} · Power ${esc(c.power)}${c.ability ? " · " + esc(c.ability) : ""}`)}
      ${st && st.startsWith("L") ? `<div class="row between"><span>Power on board</span><div class="stepper"><button data-a="myPow" data-k="${esc(k)}" data-v="-1" aria-label="Less power">−</button><span>${esc(pw)}</span><button data-a="myPow" data-k="${esc(k)}" data-v="1" aria-label="More power">+</button></div></div>` : ""}
      <div class="grid3">${[0, 1, 2].map((i) => zb("L" + i, esc(live.locs[i] || "Location " + (i + 1)))).join("")}</div>
      <div class="grid2">${zb("hand", "In hand")}${zb("deck", "Back in deck")}${zb("destroyed", "Destroyed")}${zb("discarded", "Discarded")}${zb("banished", "Banished")}</div>`;
  };
}
function oppCardSheet(i) {
  return () => {
    const o = live.opp[i]; if (!o) return sheetHead("Card removed");
    const c = card(o.key); const zb = (z, l) => `<button class="btn ${o.zone === z ? "snap" : ""}" data-a="oppSet" data-i="${i}" data-v="${z}">${l}</button>`;
    return `${sheetHead(esc(c.name), `Their card · cost ${esc(c.cost)} · power ${esc(c.power)}`)}
      ${o.zone.startsWith("L") ? `<div class="row between"><span>Power on board</span><div class="stepper"><button data-a="oppPow" data-i="${i}" data-v="-1" aria-label="Less power">−</button><span>${esc(o.power)}</span><button data-a="oppPow" data-i="${i}" data-v="1" aria-label="More power">+</button></div></div>` : ""}
      <div class="grid3">${[0, 1, 2].map((l) => zb("L" + l, esc(live.locs[l] || "Location " + (l + 1)))).join("")}</div>
      <div class="grid2">${zb("hand", "In their hand")}${zb("destroyed", "Destroyed")}${zb("discarded", "Discarded")}${zb("banished", "Banished")}</div>
      <button class="btn danger" data-a="oppRemove" data-i="${i}">Remove card</button>`;
  };
}
function locAdjSheet(i) {
  return () => `${sheetHead(esc(live.locs[i] || "Location " + (i + 1)), "Add bonuses the cards alone don't show, like a location effect")}
    <div class="row between"><span>Their bonus</span><div class="stepper"><button data-a="adj" data-s="opp" data-i="${i}" data-v="-1" aria-label="Less">−</button><span>${signed(num(live.adj.opp[i]))}</span><button data-a="adj" data-s="opp" data-i="${i}" data-v="1" aria-label="More">+</button></div></div>
    <div class="row between"><span>Your bonus</span><div class="stepper"><button data-a="adj" data-s="my" data-i="${i}" data-v="-1" aria-label="Less">−</button><span>${signed(num(live.adj.my[i]))}</span><button data-a="adj" data-s="my" data-i="${i}" data-v="1" aria-label="More">+</button></div></div>
    <p class="muted small">Totals now: them ${locTotals(i).opp}, you ${locTotals(i).my}.</p>`;
}

/* ============ Card picker ============ */
const picker = { q: "", ownedOnly: false, mode: "", pending: null };
function openPicker(mode, ownedOnly = false) { picker.q = ""; picker.mode = mode; picker.ownedOnly = ownedOnly; picker.pending = null; openSheet(pickerSheet); }
function pickerSheet() {
  if (picker.mode === "opp" && picker.pending) {
    const c = card(picker.pending);
    return `${sheetHead("Where is it?", esc(c.name))}<div class="grid3">${[0, 1, 2].map((i) => `<button class="btn snap" data-a="oppZone" data-v="L${i}">${esc(live.locs[i] || "Location " + (i + 1))}</button>`).join("")}</div>
      <div class="grid2"><button class="btn" data-a="oppZone" data-v="hand">In their hand</button><button class="btn" data-a="oppZone" data-v="destroyed">Destroyed</button><button class="btn" data-a="oppZone" data-v="discarded">Discarded</button><button class="btn" data-a="oppZone" data-v="banished">Banished</button></div>`;
  }
  const q = String(picker.q).toLowerCase(); const qk = keyOf(q);
  let list = allCards().filter((c) => (!qk || c.key.includes(qk) || String(c.ability).toLowerCase().includes(q)) && (!picker.ownedOnly || S.owned[c.key]));
  const customs = picker.mode === "deck" ? S.custom.map((c) => customCard(c.id)).filter((c) => !qk || keyOf(c.name).includes(qk)) : [];
  const exists = !!qk && allCards().some((c) => c.key.includes(qk));
  const sel = picker.mode === "deck" ? (deckEdit()?.cards || []) : picker.mode === "mf" ? arr(mf?.oppCards).map(keyOf) : picker.mode === "avatar" || picker.mode === "cover" ? [] : [];
  const title = { opp: "Add their card", mf: "Cards they played", deck: "Add cards", avatar: "Pick your profile card", cover: "Pick the deck's cover card" }[picker.mode] || "Pick a card";
  const sub = picker.mode === "deck" ? `${(deckEdit()?.cards || []).length} / 12 cards` : "";
  return `${sheetHead(title, sub)}
    <input type="search" id="pick-q" data-pick="q" value="${esc(picker.q)}" placeholder="Search by name or ability" aria-label="Search cards" data-autofocus>
    <label class="check"><input type="checkbox" data-pickchk="ownedOnly" ${picker.ownedOnly ? "checked" : ""}> Only cards I own</label>
    <div class="chiplist">${list.slice(0, 180).map((c) => cardChip(c.key, { a: "pick", on: sel.includes(c.key), noOwn: picker.mode !== "deck" })).join("") || `<span class="muted small">No cards match${picker.ownedOnly && exists ? " among the cards you own. Untick “Only cards I own” to see it" : ""}.</span>`}</div>
    ${list.length > 180 ? `<p class="muted small">Showing 180 of ${list.length} cards. Search to find the rest.</p>` : ""}
    ${customs.length ? `<span class="eyebrow">Your custom cards</span><div class="chiplist">${customs.map((c) => cardChip(c.key, { a: "pick", on: sel.includes(c.key), noOwn: true })).join("")}</div>` : ""}
    ${picker.q && !list.length && !exists && qk.length >= 3 ? `<button class="btn" data-a="pickNew">Add “${esc(picker.q)}” as a new card</button>` : ""}
    ${picker.mode === "deck" || picker.mode === "mf" ? `<button class="btn snap block" data-a="pickDone">Done</button>` : ""}`;
}

/* ============ Match log & match form ============ */
function vLog() {
  const p = periodById(ui.period); const ms = inPeriod(allMatches(), p);
  return `<section class="sec"><div class="sec-h"><h2>Matches</h2><div class="row"><button class="btn sm" data-a="quickOpen">Quick log</button><button class="btn sm snap" data-a="matchNew">${ICON.plus} Log a match</button></div></div>${shotInput("match")}${periodChips()}${exampleNote(ms)}
    ${ms.length ? `<div class="list">${ms.slice(0, 300).map((m) => `<button class="li" data-a="matchEdit" data-id="${esc(m.id)}"><span class="pill ${esc(m.result)}">${esc(m.result)}</span><div class="grow"><div class="t">${esc(m.deckName || "No deck")}${m.oppName ? ` <span class="muted">vs ${esc(m.oppName)}</span>` : ""}</div><div class="s">${typeof pcRowPills === "function" ? pcRowPills(m) : ""}${esc(dateTimeStr(m.ts))} · ${esc(m.mode || "Ranked")}${m.tracked ? (replayOf(m) ? " · replay" : " · tracked") : ""}${arr(m.turns).length ? " · play-by-play" : ""}${m.eventGain ? ` · +${fmt(m.eventGain.amount)} ${esc(m.eventGain.name)}` : ""}${m.svSync ? " · from SnapVault" : ""}${m.snapped ? " · snapped" : ""}${m.retreated ? " · retreated" : ""}${m.bot === "likely" ? " · likely bot" : ""}</div></div>${m.noCubes ? `<span class="muted small">no cubes</span>` : cubes(signed(num(m.cubes)), num(m.cubes) >= 0 ? "pos" : "neg")}</button>`).join("")}</div>${ms.length > 300 ? `<p class="muted small">Showing the latest 300.</p>` : ""}`
      : `<div class="empty"><strong>No matches in ${esc(p.label)}</strong><span>Log one now or pick a longer period.</span></div>`}</section>`;
}
let mf = null;
function openMatchForm(m) {
  mf = m ? clone(m) : { id: uid(), ts: Date.now(), result: "W", cubes: 2, mode: "Ranked", deckId: "", deckName: "", oppName: "", oppCards: [], snapped: false, oppSnapped: false, retreated: false, oppRetreated: false, turn: 6, bot: "unsure", notes: "", isNew: true };
  mf.mag = Math.abs(num(mf.cubes)) || 0;
  mf.locs = arr(mf.locs).slice(0, 3).map((l) => ({ ...obj(l) })); while (mf.locs.length < 3) mf.locs.push({ name: "", my: "", opp: "" });
  openSheet(matchSheet);
}
function matchSheet() {
  const resBtn = (v, l) => `<button data-a="mfResult" data-v="${v}" aria-pressed="${mf.result === v}">${l}</button>`;
  const lw = mf.locs.filter((l) => l.my !== "" && l.opp !== "" && num(l.my) > num(l.opp)).length;
  return `${sheetHead(mf.isNew ? "Log a match" : "Edit match")}
  <div class="seg">${resBtn("W", "Win")}${resBtn("L", "Loss")}${resBtn("T", "Tie")}</div>
  ${mf.result !== "T" ? `<div class="stack" style="gap:6px"><span class="eyebrow">Cubes ${mf.result === "W" ? "won" : "lost"}</span><div class="chips">${[1, 2, 4, 8].map((v) => `<button class="chip" data-a="mfCubes" data-v="${v}" aria-pressed="${mf.mag === v}">${v}</button>`).join("")}</div></div>` : ""}
  <div class="grid2"><label class="f">When<input type="datetime-local" id="mf-ts" data-mf="ts" value="${toInputDT(mf.ts)}"></label>
  <label class="f">Mode<select id="mf-mode" data-mf="mode">${[...new Set([...MODES.slice(0, 3), ...modeNames().filter((x) => !MODES.includes(x)), ...MODES.slice(3), mf.mode || "Ranked"])].map((x) => `<option ${mf.mode === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label></div>
  <label class="f">Your deck<select id="mf-deck" data-mf="deckId"><option value="">No deck</option>${S.decks.map((d) => `<option value="${esc(d.id)}" ${mf.deckId === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>
  <div class="grid2"><label class="f">Opponent<input type="text" id="mf-opp" data-mf="oppName" value="${esc(mf.oppName)}"></label><label class="f">Final turn<input type="number" id="mf-turn" data-mf="turn" value="${esc(mf.turn)}" min="1" max="8"></label></div>
  <div id="mf-rival">${rivalLine(mf.oppName)}</div>
  <div class="stack" style="gap:6px"><span class="eyebrow">Locations at the end (optional)</span>${locDatalist()}
    ${mf.locs.map((l, i) => `<div class="grid3"><input type="text" id="mf-ln${i}" data-mfloc="name" data-i="${i}" value="${esc(l.name)}" placeholder="Location ${i + 1}" aria-label="Location ${i + 1}" list="loc-names" autocomplete="off"><input type="number" id="mf-lm${i}" data-mfloc="my" data-i="${i}" value="${esc(l.my)}" placeholder="Your power" aria-label="Your power"><input type="number" id="mf-lo${i}" data-mfloc="opp" data-i="${i}" value="${esc(l.opp)}" placeholder="Their power" aria-label="Their power"></div>`).join("")}
    ${arr(mf.plays).length ? `<div class="chiplist">${mf.plays.map((p) => cardChip(p.k, { noOwn: true, pow: p.power, deck: S.decks.find((d) => d.id === mf.deckId) || null })).join("")}</div>` : ""}
    ${lw ? `<span class="muted small">You won ${lw} location${lw > 1 ? "s" : ""}.</span>` : ""}</div>
  <div class="stack" style="gap:6px"><span class="eyebrow">Cards they played</span><div class="chiplist">${arr(mf.oppCards).map((n, i) => `<button class="cchip" data-a="mfOppRemove" data-i="${i}" aria-label="Remove ${esc(n)}"><span>${esc(n)}</span>${ICON.x}</button>`).join("")}<button class="btn sm" data-a="mfOppAdd">${ICON.plus} Add</button></div></div>
  <div class="grid2"><label class="check"><input type="checkbox" data-mfchk="snapped" ${mf.snapped ? "checked" : ""}> You snapped</label><label class="check"><input type="checkbox" data-mfchk="oppSnapped" ${mf.oppSnapped ? "checked" : ""}> They snapped</label>
  ${mf.snapped ? `<label class="f">You snapped on turn<input type="number" id="mf-st" data-mf="snapTurn" value="${esc(mf.snapTurn || "")}" min="1" max="7" placeholder="Optional"></label><span></span>` : ""}
  <label class="check"><input type="checkbox" data-mfchk="retreated" ${mf.retreated ? "checked" : ""}> You retreated</label><label class="check"><input type="checkbox" data-mfchk="oppRetreated" ${mf.oppRetreated ? "checked" : ""}> They retreated</label></div>
  ${playByPlayHtml(mf)}
  ${matchLooksHtml(mf)}
  ${mf.botWhy ? `<p class="small muted">Bot check: ${esc(BOT_TXT[mf.bot] || "Not sure")}, because they ${esc(mf.botWhy)}.</p>` : ""}
  ${mf.eventGain ? `<p class="small">+${fmt(mf.eventGain.amount)} ${esc(mf.eventGain.name)} from this match</p>` : ""}
  <label class="f">Opponent was<select id="mf-bot" data-mf="bot">${Object.entries(BOT_TXT).map(([k, v]) => `<option value="${k}" ${mf.bot === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
  <label class="f">Notes<textarea id="mf-notes" data-mf="notes">${esc(mf.notes)}</textarea></label>
  ${extHtml(EXT.matchSheet, mf)}
  <div class="row"><button class="btn snap" data-a="mfSave">Save match</button>${!mf.isNew && replayOf(mf) ? `<button class="btn" data-a="replayOpen" data-id="${esc(mf.id)}">Watch replay</button>` : ""}${mf.isNew ? "" : `<button class="btn danger" data-a="mfDelete">${mf.confirmDel ? "Tap again to delete" : "Delete"}</button>`}</div>`;
}
