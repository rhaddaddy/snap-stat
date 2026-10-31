/* ============ y17_collection.js: Cards › Plan — your collection and where it's going ============
   One section that answers "what should I do with my collection next?": how complete each part is, the upgrades you can
   pay for right now, the credits to your next Collection Level reward, the Series 4 and 5 cards you're missing and what
   they cost, cards that can split, boosters piling up with nowhere to go, albums one or two variants from a reward, what's
   new in the game since you last looked, a month-by-month chart of what you've collected, your favorite artists, and a
   plain-text summary to paste into Discord. Home › Overview also shows one of your Custom Cards each day.
   Everything here reads the data the rest of the app already keeps (S.owned, S.variants, S.prog, S.wallet, the daily
   card data) and saves only two small things: S.seenCat (when you last looked, with counts) and S.ownedAt (the day
   each card was ticked owned, from now on). */

/* ---------- The numbers every panel here shares, worked out once per change ---------- */
let _plSig = "", _plan = null;
function planData() {
  const today = localDate(Date.now());
  const alb = typeof ALB !== "undefined" && ALB ? albVer : 0, art = typeof ART !== "undefined" && ART ? ART.ver : 0;
  const sig = `${saveVer}|${catVer}|${vdVer}|${alb}|${art}|${S.variants.length}|${today}`;
  if (_plan && sig === _plSig) return _plan;
  const cards = allCards().filter((c) => !c.upcoming && !c.custom && !c.unknown);
  const cardsOwn = cards.filter((c) => S.owned[c.key]).length;
  const vars = allVariants().filter((v) => !varUpcoming(v, today));
  const varsOwn = vars.filter((v) => v.owned).length;
  let albums = null;
  if (alb) { const list = Object.keys(ALB.albums).map(albumInfo).filter((a) => !a.date || a.date <= today); albums = { list, done: list.filter((a) => a.goal && a.have >= a.goal).length }; }
  const backs = typeof cardBacks === "function" ? cardBacks() : [], backsOwn = backs.filter((b) => (backCos(b) || {}).owned).length;
  const emotes = typeof emoteCatalog === "function" ? emoteCatalog() : [], emotesOwn = emotes.filter(emoteOwned).length;
  const splits = Object.values(obj(S.prog)).reduce((t, p) => t + arr(obj(p).splits).length, 0);
  _plan = { today, cards, cardsOwn, vars, varsOwn, albums, backs, backsOwn, emotes, emotesOwn, splits };
  _plSig = sig; return _plan;
}
const planCredits = () => num(S.wallet.credits), planTokens = () => num(S.wallet.tokens);
// The same list as progCopies() (t_progress.js), but progCopies scans every variant for each card (500 cards × 4,000
// variants for a big collection). Here your owned variants are grouped by card in one pass, kept until something changes.
let _pcSig = "", _pc = new Map(), _pcVars = new Map();
function planCopies(k) {
  const sig = `${saveVer}|${catVer}|${vdVer}|${S.variants.length}`;
  if (sig !== _pcSig) { _pc = new Map(); _pcVars = new Map(); for (const v of allVariants()) if (v.owned) { const l = _pcVars.get(v.card); if (l) l.push(v); else _pcVars.set(v.card, [v]); } _pcSig = sig; }
  let out = _pc.get(k); if (out) return out;
  const p = prog(k); out = [{ id: "base", label: "Base card", r: p.base }];
  for (const v of _pcVars.get(k) || []) out.push({ id: "v:" + v.id, label: v.name || "Variant", r: rarityIdx(p.vr[v.id]) });
  p.splits.forEach((sp, i) => out.push({ id: "s:" + sp.id, label: `Split ${i + 1}${sp.fin || sp.fl ? ` · ${[sp.fin, sp.fl].filter(Boolean).join(" + ")}` : ""}`, r: rarityIdx(sp.r) }));
  _pc.set(k, out); return out;
}
const NO_CREDITS = `<span class="muted">Add your credits on the Home screen (Your numbers) and this works out what you can afford.</span>`;

/* ---------- 4. Completion rings: how much of each part you have ---------- */
function planRing(label, have, of, sub) {
  const p = of ? donePct(have, of) : 0, r = 26, c = 2 * Math.PI * r, off = c * (1 - clamp(p, 0, 100) / 100);
  const txt = of ? `${p}%` : "—";
  return `<div class="plan-ring"><svg viewBox="0 0 64 64" role="img" aria-label="${esc(label)}: ${of ? `${fmt(have)} of ${fmt(of)}, ${p}%` : "no list yet"}"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="7"/>${of ? `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${p >= 100 ? "var(--win)" : "var(--snap-a)"}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 32 32)"/>` : ""}<text x="32" y="37" text-anchor="middle" font-size="${txt.length > 3 ? 14 : 16}">${txt}</text></svg><b>${esc(label)}</b><span class="muted small num">${of ? `${fmt(have)}/${fmt(of)}` : esc(sub || "no list yet")}</span></div>`;
}
function planRingsHtml() {
  const d = planData();
  return `<div class="panel stack" style="gap:10px"><div class="row between nowrap"><span class="eyebrow">How complete your collection is</span><button class="btn sm" data-a="planCopy">${ICON.copy} Copy summary</button></div>
    <div class="plan-rings">${planRing("Cards", d.cardsOwn, d.cards.length)}${planRing("Variants", d.varsOwn, d.vars.length)}${planRing("Albums", d.albums ? d.albums.done : 0, d.albums ? d.albums.list.length : 0, "loading")}${planRing("Card backs", d.backsOwn, d.backs.length)}${planRing("Emotes", d.emotesOwn, d.emotes.length)}</div>
    <span class="muted small">Owned over everything that's out today. Albums count the ones you've finished. Tick cards, variants, card backs and emotes in Collection, or screenshot them in the game.</span></div>`;
}

/* ---------- 12. A plain-text summary for Discord ---------- */
function planSummaryText() {
  const d = planData(), cl = num(S.me.colLevel);
  const line = (l, have, of) => (of ? `${l}: ${fmt(have)}/${fmt(of)} (${donePct(have, of)}%)` : "");
  return [`My MARVEL SNAP collection · ${dateStr(d.today)}`, line("Cards", d.cardsOwn, d.cards.length), line("Variants", d.varsOwn, d.vars.length), d.albums ? `Albums finished: ${fmt(d.albums.done)}/${fmt(d.albums.list.length)}` : "",
    cl ? `Collection Level: ${fmt(cl)}` : "", d.splits ? `Infinity Splits: ${fmt(d.splits)}` : "", line("Card backs", d.backsOwn, d.backs.length), line("Emotes", d.emotesOwn, d.emotes.length), "— from SNAP Stat"].filter(Boolean).join("\n");
}

/* ---------- 1. Upgrades you can afford right now ----------
   Boosters belong to the card and are shared by its copies, so the cheapest copy gets them first (that's also the most
   Collection Level per credit: Common → Uncommon is 1 level for 25 credits, every later step is 1 level per 50). */
function affordableUpgrades() {
  const credits = planCredits(), rows = [];
  for (const [k, p0] of Object.entries(obj(S.prog))) {
    if (!S.owned[k] || !p0 || p0.b === null || p0.b === undefined) continue;
    const c = card(k); if (c.custom || c.unknown) continue;
    let b = num(p0.b);
    // Copies with a noted level, plus the base card when its level isn't noted yet (Common until you say otherwise)
    const copies = planCopies(k).filter((cp) => cp.r !== null || cp.id === "base").map((cp) => ({ ...cp, r: cp.r ?? 0, guess: cp.r === null })).filter((cp) => cp.r < 6).sort((a, z) => a.r - z.r);
    for (const cp of copies) { const st = nextStep(cp.r); if (!st || b < st[1]) continue; b -= st[1]; rows.push({ k, name: c.name, copy: cp.label, guess: cp.guess, from: cp.r, cr: st[0], bo: st[1], cl: st[2], ratio: st[2] / st[0] }); }
  }
  rows.sort((a, z) => z.ratio - a.ratio || a.cr - z.cr || a.name.localeCompare(z.name));
  let left = credits, cl = 0, cr = 0, n = 0;
  for (const r of rows) { r.can = !credits || left >= r.cr; if (r.can) { left -= r.cr; cl += r.cl; cr += r.cr; n++; } }
  return { rows, credits, left, cl, cr, n, allCl: rows.reduce((t, r) => t + r.cl, 0), allCr: rows.reduce((t, r) => t + r.cr, 0) };
}
function planUpgradesHtml() {
  const u = affordableUpgrades(), lim = ui.planUpAll ? 400 : 12, noted = Object.keys(obj(S.prog)).filter((k) => S.owned[k] && obj(S.prog[k]).b !== null && obj(S.prog[k]).b !== undefined).length;
  const row = (r) => `<button class="li" data-a="cardOpen" data-k="${esc(r.k)}" ${r.can ? "" : 'style="opacity:.55"'}><div class="grow" style="min-width:0"><div class="t">${esc(r.name)}</div><div class="s" style="white-space:normal">${esc(UP_LEVELS[r.from])} → ${esc(UP_LEVELS[r.from + 1])} · ${esc(r.copy)}${r.guess ? " (level not set, so Common)" : ""} · ${r.bo} boosters</div></div><div class="num small" style="text-align:right"><b>+${r.cl} CL</b><br>${fmt(r.cr)} cr</div></button>`;
  return `<section class="sec"><div class="sec-h"><h2>Next upgrades</h2><button class="btn sm ghost" data-a="go" data-to="cards/progress">All upgrades</button></div>
    ${planMilestoneHtml()}
    ${!noted ? `<div class="empty"><strong>No boosters noted yet</strong><span>Screenshot your collection in the game, or type a card's boosters on its page, and the upgrades you can pay for show up here.</span></div>`
    : !u.rows.length ? `<div class="empty"><strong>Nothing to upgrade right now</strong><span>None of your ${plural(noted, "noted card")} has enough boosters for its next step. Boosters come from playing a card and from Wild Boosters.</span></div>`
    : `<div class="panel stack small" style="gap:4px">${u.credits && !u.n ? `<b>Not enough credits for these upgrades yet</b><span class="muted">The cheapest costs ${fmt(Math.min(...u.rows.map((r) => r.cr)))} credits and you have ${fmt(u.credits)}. All ${plural(u.rows.length, "upgrade")} together: +${plural(u.allCl, "Collection Level")} for ${fmt(u.allCr)} credits.</span>`
      : u.credits ? `<b>You can gain ${plural(u.cl, "Collection Level")} right now for ${fmt(u.cr)} credits</b><span class="muted">${plural(u.n, "upgrade")} ${u.n === 1 ? "fits" : "fit"} your ${fmt(u.credits)} credits${u.n < u.rows.length ? `; ${u.rows.length - u.n === 1 ? "the last one needs" : `the other ${u.rows.length - u.n} need`} ${fmt(u.allCr - u.cr - u.left)} more credits` : ""}. Best value first: Common → Uncommon gives a level for 25 credits, later steps cost 50 a level.</span>`
      : `<b>${plural(u.rows.length, "upgrade")} ready: +${plural(u.allCl, "Collection Level")} for ${fmt(u.allCr)} credits</b>${NO_CREDITS}`}</div>
      <div class="list">${u.rows.slice(0, lim).map(row).join("")}</div>${u.rows.length > lim ? `<button class="btn block" data-a="planUpAll">Show all ${u.rows.length}</button>` : ""}`}</section>`;
}

/* ---------- 2. Credits to your next Collection Level reward ----------
   The game shows "NEXT <reward> IN: <n>" on the Collection Level screen; a screenshot of it saves that as S.clNext. */
function planMilestoneHtml() {
  const c = obj(S.clNext), cl = num(S.me.colLevel);
  if (!c.left || !c.reward) return cl ? `<p class="muted small">Collection Level ${fmt(cl)}. Screenshot the Collection Level screen in the game and the levels and credits to your next reward show here.</p>` : "";
  const left = c.left - (num(c.cl) ? Math.max(0, cl - num(c.cl)) : 0); // read before your level was known: nothing to count down from
  if (left <= 0) return `<p class="small"><b>You've reached ${esc(c.reward)}.</b> Screenshot the Collection Level screen again for the next one.</p>`;
  // Cheapest first: Common copies give a level for 25 credits and 5 boosters; everything after is 50 credits and 5 boosters a level
  let commons = 0;
  for (const [k, p0] of Object.entries(obj(S.prog))) { if (!S.owned[k] || !p0) continue; commons += planCopies(k).filter((cp) => (cp.r ?? 0) === 0 && (cp.r !== null || cp.id === "base")).length; }
  const cheap = Math.min(left, commons), credits = cheap * 25 + (left - cheap) * 50, boosters = left * 5, have = planCredits();
  return `<div class="panel stack small" style="gap:4px"><b>${plural(left, "level")} to your next reward: ${esc(c.reward.replace(/collector'?s tokens?/i, "tokens").replace(/\d{4,}/g, (x) => fmt(Number(x))))}</b>
    <span>About <b>${fmt(credits)} credits</b> and ${fmt(boosters)} boosters of upgrades, cheapest first${cheap < left ? ` (${plural(cheap, "Common copy", "Common copies")} at 25 credits a level, then 50)` : " (all Common → Uncommon at 25 credits a level)"}.${have ? have >= credits ? ` You have ${fmt(have)}: enough.` : ` You have ${fmt(have)}, so ${fmt(credits - have)} to go.` : ""}</span>
    <span class="muted">From your Collection Level screenshot ${esc(agoTxt(num(c.at)))}${cl && num(c.cl) ? `, counted down as your level went up` : ""}.</span></div>`;
}

/* ---------- 3. Series 4 and 5 cards you're missing, with token prices ---------- */
function planSeriesHtml() {
  const miss = missingBySeries(), tokens = planTokens(), sr = ui.planSr === "4" ? "4" : "5", list = arr(miss["Series " + sr]);
  const price = (k) => tokenPrice(card(k));
  const rows = list.map((k) => ({ k, c: card(k), p: price(k), wish: !!S.wishCards[k], deck: S.decks.some((d) => d.status !== "future" && !d.example && arr(d.cards).includes(k)) }))
    .sort((a, z) => (z.wish - a.wish) || (z.deck - a.deck) || String(z.c.release || "").localeCompare(String(a.c.release || "")) || a.c.name.localeCompare(z.c.name));
  const n5 = arr(miss["Series 5"]).length, n4 = arr(miss["Series 4"]).length, all = [...arr(miss["Series 5"]), ...arr(miss["Series 4"])];
  const prices = all.map(price).filter(Boolean).sort((a, z) => a - z), cheapest = prices[0] || 0, total = prices.reduce((t, p) => t + p, 0);
  let canBuy = 0; for (let left = tokens, i = 0; i < prices.length && left >= prices[i]; i++) { left -= prices[i]; canBuy++; } // cheapest first
  const rate = typeof tokenRate === "function" ? tokenRate() : { perWeek: 0 }, wk = (n) => (n < 9 ? plural(n, "week") : n <= 104 ? `about ${plural(Math.round(n / 4.3), "month")}` : "more than two years");
  const lim = ui.planSrAll ? 400 : 24;
  const chip = (v, l, n) => `<button class="chip" data-a="planSr" data-v="${v}" aria-pressed="${sr === v}">${l} <span class="num muted">${n}</span></button>`;
  return `<section class="sec"><div class="sec-h"><h2>Missing Series 4 &amp; 5</h2><button class="btn sm ghost" data-a="go" data-to="home/shops">Shops</button></div>
    ${!all.length ? `<div class="empty"><strong>You own every Series 4 and 5 card that's out</strong><span>New ones arrive about once a week; they'll show up here.</span></div>` : `<div class="panel stack small" style="gap:4px">
      <b>${plural(all.length, "card")} missing · about ${fmt(total)} tokens for all of them</b>
      ${tokens ? `<span>You have ${fmt(tokens)} tokens: ${canBuy ? `enough for <b>${plural(canBuy, "card")} right now</b>${canBuy > 1 ? " (cheapest first)" : ""}.` : `${fmt(cheapest - tokens)} short of the cheapest one (${fmt(cheapest)}).`}</span>` : `<span class="muted">Add your tokens on the Home screen (Your numbers) to see what you can buy right now.</span>`}
      ${rate.perWeek && total > tokens ? `<span class="muted">At about ${fmt(rate.perWeek)} tokens a week${rate.guess ? " (estimated from your token history)" : ""}: ${cheapest > tokens ? `the next card in ${wk(Math.ceil((cheapest - tokens) / rate.perWeek))}, ` : ""}all of today's in ${wk(Math.ceil((total - tokens) / rate.perWeek))}.</span>` : ""}
      <span class="muted">Prices are Card Shop estimates (Series 5 ${fmt(num(obj(S.prices).s5) || 6000)}, Series 4 ${fmt(num(obj(S.prices).s4) || 3000)}); change them in Home › Shops. ♥ marks your wishlist, ▣ a card in one of your decks.</span></div>
    <div class="chips">${chip("5", "Series 5", n5)}${chip("4", "Series 4", n4)}</div>
    ${rows.length ? `<div class="chiplist">${rows.slice(0, lim).map((r) => cardChip(r.k, { a: "cardOpen", suffix: r.wish || r.deck ? ` <span class="muted">${r.wish ? "♥" : ""}${r.deck ? "▣" : ""}</span>` : "" })).join("")}</div>${rows.length > lim ? `<button class="btn block" data-a="planSrAll">Show all ${rows.length}</button>` : ""}` : `<p class="muted small">You own every Series ${sr} card that's out.</p>`}`}</section>`;
}

/* ---------- 6. Split planner: cards at Infinity, splits this season, your most common finishes ---------- */
function planSplitsHtml() {
  const cs = currentSeason(), ready = [], fins = {}, flares = {}; let seasonN = 0, all = 0;
  for (const [k, p0] of Object.entries(obj(S.prog))) {
    if (!S.owned[k] || !p0) continue; const c = card(k); if (c.custom || c.unknown) continue;
    const copies = planCopies(k), inf = copies.filter((cp) => cp.r === 6).length;
    if (inf) ready.push({ k, name: c.name, inf, splits: arr(p0.splits).length, b: p0.b });
    for (const s of arr(p0.splits)) { all++; if (s.fin) fins[s.fin] = (fins[s.fin] || 0) + 1; if (s.fl) flares[s.fl] = (flares[s.fl] || 0) + 1; if (cs && num(s.at) >= cs.startTs && num(s.at) <= cs.endTs) seasonN++; }
  }
  ready.sort((a, z) => z.inf - a.inf || z.splits - a.splits || a.name.localeCompare(z.name));
  const top = (o) => Object.entries(o).sort((a, z) => z[1] - a[1]).slice(0, 5);
  const tile = (k, v, s) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="small muted">${s}</div>` : ""}</div>`;
  return `<section class="sec"><h2>Splits</h2>
    <div class="tiles">${tile("Can split", fmt(ready.length), ready.length ? "cards with an Infinity copy" : "")}${tile(cs ? "This season" : "Splits", fmt(cs ? seasonN : all), cs ? `${plural(all, "split")} all time` : "")}</div>
    ${ready.length ? `<p class="small">Splitting an Infinity copy is free: no credits or boosters. Tap a card to log the split and its finish.</p><div class="list">${ready.slice(0, 30).map((r) => `<button class="li" data-a="cardOpen" data-k="${esc(r.k)}"><div class="grow" style="min-width:0"><div class="t">${esc(r.name)}</div><div class="s">${r.inf > 1 ? `${r.inf} copies at Infinity` : "1 copy at Infinity"}${r.splits ? ` · ${plural(r.splits, "split")} so far` : " · no splits yet"}</div></div><span class="pill W">Ready</span></button>`).join("")}</div>${ready.length > 30 ? `<p class="muted small">And ${ready.length - 30} more.</p>` : ""}`
      : `<div class="empty"><strong>No copy at Infinity yet</strong><span>Set a copy's level to Infinity on its card page (or screenshot the card) and it shows up here as ready to split.</span></div>`}
    ${all ? `<div class="panel stack small" style="gap:4px"><b>Finishes you've got most</b>${top(fins).length ? `<div class="chiplist">${top(fins).map(([f, n]) => `<span class="pill dim">${esc(f)} <span class="num">×${n}</span></span>`).join("")}</div>` : `<span class="muted">No finish noted yet. Add it when you log a split.</span>`}${top(flares).length ? `<span class="muted">Flares: ${top(flares).map(([f, n]) => `${esc(f)} ×${n}`).join(", ")}</span>` : ""}</div>` : ""}</section>`;
}

/* ---------- 7. Booster surplus: boosters piling up with nowhere to go ---------- */
function boosterSurplus() {
  const out = [], wasted = [];
  for (const [k, p0] of Object.entries(obj(S.prog))) {
    if (!S.owned[k] || !p0 || p0.b === null || p0.b === undefined) continue; const c = card(k); if (c.custom || c.unknown) continue;
    const b = num(p0.b), copies = planCopies(k).map((cp) => ({ ...cp, r: cp.r ?? 0 })).filter((cp) => cp.r < 6).sort((a, z) => a.r - z.r);
    // Walk every copy up to Infinity, lowest first, while the boosters last: what that costs in credits and gains in levels
    let left = b, cr = 0, cl = 0, steps = 0, needAll = 0;
    for (const cp of copies) for (let r = cp.r; r < 6; r++) { const st = STEP[r + 1]; needAll += st[1]; if (left >= st[1]) { left -= st[1]; cr += st[0]; cl += st[2]; steps++; } }
    const highest = Math.max(0, ...planCopies(k).map((cp) => cp.r ?? 0));
    if (b >= 100 && copies.length) out.push({ k, name: c.name, b, cr, cl, steps, highest, left });
    if (b > needAll) wasted.push({ k, name: c.name, b, extra: b - needAll, atInf: !copies.length });
  }
  out.sort((a, z) => z.b - a.b); wasted.sort((a, z) => z.extra - a.extra);
  return { out, wasted: wasted.slice(0, 10) };
}
function planBoostersHtml() {
  const { out, wasted } = boosterSurplus(); if (!out.length && !wasted.length) return "";
  const credits = planCredits(), totalCr = out.reduce((t, r) => t + r.cr, 0), totalCl = out.reduce((t, r) => t + r.cl, 0);
  return `<section class="sec"><h2>Boosters piling up</h2>
    ${out.length ? `<div class="panel stack small" style="gap:4px"><b>${plural(out.length, "card")} with 100+ boosters and a copy below Infinity</b><span>Using them all up takes about <b>${fmt(totalCr)} credits</b> for +${plural(totalCl, "Collection Level")}.${credits ? credits >= totalCr ? ` You have ${fmt(credits)}: enough.` : ` You have ${fmt(credits)}.` : ""}</span></div>
      <div class="list">${out.slice(0, 15).map((r) => `<button class="li" data-a="cardOpen" data-k="${esc(r.k)}"><div class="grow" style="min-width:0"><div class="t">${esc(r.name)}</div><div class="s" style="white-space:normal">${r.steps ? `${plural(r.steps, "upgrade")} · ${fmt(r.cr)} credits · +${r.cl} CL` : "not enough for the next upgrade"}${r.left ? ` · ${fmt(r.left)} left over` : ""} · best copy ${esc(UP_LEVELS[r.highest])}</div></div><span class="num" style="font-weight:800">${fmt(r.b)}</span></button>`).join("")}</div>${out.length > 15 ? `<p class="muted small">And ${out.length - 15} more; see Upgrades for the full list.</p>` : ""}` : ""}
    ${wasted.length ? `<div class="panel stack small" style="gap:4px"><b>Most wasted boosters</b><span class="muted">More boosters than every copy can use to reach Infinity. A new variant or a split gives them somewhere to go.</span></div><div class="list">${wasted.map((w) => `<button class="li" data-a="cardOpen" data-k="${esc(w.k)}"><div class="grow" style="min-width:0"><div class="t">${esc(w.name)}</div><div class="s" style="white-space:normal">${w.atInf ? "every copy is at Infinity" : "spare even after every copy reaches Infinity"}</div></div><span class="num" style="font-weight:800">${fmt(w.extra)}</span></button>`).join("")}</div>` : ""}</section>`;
}

/* ---------- 8. New since your last visit ----------
   S.seenCat = { cards, vars, day, at }: how many released cards and variants the list had when you last looked, and when.
   "New" is anything with a release date after that day; it's counted from release dates, so no id lists are saved. */
function newSinceSeen() {
  const seen = obj(S.seenCat); if (!seen.day) return null;
  const d = planData(), day = String(seen.day);
  const cards = d.cards.filter((c) => c.release && c.release > day && !S.owned[c.key]);
  const vars = d.vars.filter((v) => v.release && v.release > day && !v.owned).sort((a, z) => z.release.localeCompare(a.release));
  return { cards, vars, day, grew: { cards: d.cards.length - num(seen.cards), vars: d.vars.length - num(seen.vars) } };
}
function markCatSeen() { const d = planData(); S.seenCat = { cards: d.cards.length, vars: d.vars.length, day: d.today, at: Date.now() }; save(); }
function planNewHtml() {
  const n = newSinceSeen();
  if (!n) return `<section class="sec"><div class="panel row between nowrap"><span class="small" style="white-space:normal"><b>New since your last visit</b><br><span class="muted">From now on this shows the cards and variants that came out since you last looked.</span></span><button class="btn sm snap" data-a="planSeen">Start</button></div></section>`;
  const total = n.cards.length + n.vars.length;
  return `<section class="sec"><button class="panel row between nowrap" data-a="planNewOpen" style="width:100%;text-align:left"><span class="small" style="white-space:normal"><b>${total ? `${plural(n.cards.length, "new card")} and ${plural(n.vars.length, "new variant")}` : "Nothing new"} since you last looked</b><br><span class="muted">${esc(dateStr(n.day))}${total ? " · tap to see them" : ""}</span></span><span class="pill ${total ? "gold" : "dim"}">${total ? "New" : "✓"}</span></button></section>`;
}
function planNewSheet() {
  const n = newSinceSeen(); if (!n) return sheetHead("New since your last visit");
  const total = n.cards.length + n.vars.length;
  return `${sheetHead("New since your last visit", `Out since ${esc(dateStr(n.day))}`)}
    ${!total ? `<div class="empty"><strong>Nothing new yet</strong><span>New cards and variants appear in the game most weeks. Check back later.</span></div>` : ""}
    ${n.cards.length ? `<h3>${plural(n.cards.length, "new card")}</h3><div class="chiplist">${n.cards.slice(0, 60).map((c) => cardChip(c.key, { a: "cardOpen", suffix: ` <span class="muted">${esc(dateStr(c.release))}</span>` })).join("")}</div>` : ""}
    ${n.vars.length ? `<h3>${plural(n.vars.length, "new variant")}</h3><div class="cgrid">${n.vars.slice(0, 60).map((v) => varTile(v, { when: true })).join("")}</div>${n.vars.length > 60 ? `<p class="muted small">And ${n.vars.length - 60} more in Variants, sorted by Newest.</p>` : ""}` : ""}
    <p class="muted small">Tap Got it and the next visit counts from today.</p>
    <button class="btn snap block" data-a="planSeen">Got it</button>`;
}
// The "New" chip in Collection › Cards, added after the page is drawn so no shared view changes
function planNewChip() {
  if (ui.tab !== "cards" || (ui.cardsSeg || "cards") !== "cards") return;
  const row = $('#view [data-a="cardFilter"][data-v="unknown"]'); if (!row || $("#view [data-a=\"planNewOpen\"]")) return;
  const n = newSinceSeen(); if (!n) return; const total = n.cards.length + n.vars.length; if (!total) return;
  row.insertAdjacentHTML("afterend", `<button class="chip" data-a="planNewOpen" aria-pressed="false">New <span class="num muted">${total}</span></button>`);
}

/* ---------- 9. Collection timeline: what you gained each month ----------
   Variants keep ownAt when a screenshot or the app ticks them. Cards had no date before, so S.ownedAt[k] (ms) is added the
   moment a card becomes owned while the app is open (see planOwnWatch); bulk imports and syncs aren't stamped. */
let _ownRef = null, _ownKeys = null, _varRef = null, _varOwned = null;
function planOwnWatch() {
  S.ownedAt = obj(S.ownedAt);
  const now = Date.now();
  if (S.owned !== _ownRef || !_ownKeys) { _ownRef = S.owned; _ownKeys = new Set(Object.keys(S.owned)); }
  else {
    const keys = Object.keys(S.owned);
    if (keys.length !== _ownKeys.size) {
      const fresh = keys.filter((k) => !_ownKeys.has(k));
      if (fresh.length && fresh.length <= 25) { for (const k of fresh) if (!S.ownedAt[k]) S.ownedAt[k] = now; save(); }
      _ownKeys = new Set(keys);
    }
  }
  if (S.variants !== _varRef || !_varOwned) { _varRef = S.variants; _varOwned = new Set(S.variants.filter((v) => v.owned).map((v) => v.id)); }
  else {
    const own = S.variants.filter((v) => v.owned);
    if (own.length !== _varOwned.size) {
      const fresh = own.filter((v) => !_varOwned.has(v.id));
      if (fresh.length && fresh.length <= 25) { let ch = false; for (const v of fresh) if (!v.ownAt) { v.ownAt = now; ch = true; } if (ch) save(); }
      _varOwned = new Set(own.map((v) => v.id));
    }
  }
}
function planTimelineHtml() {
  const months = []; const d0 = new Date(); d0.setDate(1); d0.setHours(12, 0, 0, 0);
  for (let i = 11; i >= 0; i--) { const d = new Date(d0); d.setMonth(d0.getMonth() - i); months.push({ key: localDate(d.getTime()).slice(0, 7), label: d.toLocaleDateString(undefined, { month: "short" }), cards: 0, vars: 0 }); }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const [k, t] of Object.entries(obj(S.ownedAt))) { if (!S.owned[k]) continue; const i = idx.get(localDate(num(t)).slice(0, 7)); if (i !== undefined) months[i].cards++; }
  for (const v of S.variants) { if (!v.owned || !v.ownAt) continue; const i = idx.get(localDate(num(v.ownAt)).slice(0, 7)); if (i !== undefined) months[i].vars++; }
  const totC = months.reduce((t, m) => t + m.cards, 0), totV = months.reduce((t, m) => t + m.vars, 0);
  if (!totC && !totV) return `<section class="sec"><h2>Collected by month</h2><div class="empty"><strong>Fills in from now on</strong><span>Each card and variant you tick from today is dated, and this chart shows what you gained each month.</span></div></section>`;
  const W = 360, H = 120, pad = 18, bw = (W - 2 * pad) / 12, max = Math.max(1, ...months.map((m) => Math.max(m.cards, m.vars)));
  const bar = (x, v, cls) => { const h = Math.round((v / max) * (H - 34)); return v ? `<rect x="${x.toFixed(1)}" y="${H - 20 - h}" width="${(bw * 0.38).toFixed(1)}" height="${h}" rx="2" class="${cls}"/>` : ""; };
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="plan-chart" role="img" aria-label="Cards and variants collected per month over the last year">${months.map((m, i) => { const x = pad + i * bw; const top = Math.max(m.cards, m.vars); return `${bar(x + bw * 0.08, m.cards, "c")}${bar(x + bw * 0.52, m.vars, "v")}${top ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 22 - Math.round((top / max) * (H - 34))}" text-anchor="middle" font-size="9" class="n">${top}</text>` : ""}<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" class="l">${esc(m.label[0])}</text>`; }).join("")}</svg>`;
  return `<section class="sec"><h2>Collected by month</h2><div class="panel stack" style="gap:6px">${svg}<div class="row between small"><span><span class="plan-key c"></span> ${plural(totC, "card")}</span><span><span class="plan-key v"></span> ${plural(totV, "variant")}</span><span class="muted">last 12 months</span></div>
    <span class="muted small">Counts the day each one was ticked owned in SNAP Stat (variants from screenshots and matches too), so older cards aren't on it.</span></div></section>`;
}

/* ---------- 10. Albums close to a reward ---------- */
function planAlbumsHtml() {
  const d = planData(); if (!d.albums) return "";
  const close = d.albums.list.map((a) => ({ a, miss: a.vars.filter((x) => !x.owned) })).filter((x) => x.a.goal && x.miss.length >= 1 && x.a.goal - x.a.have <= 3 && x.a.have < x.a.goal).sort((x, y) => (x.a.goal - x.a.have) - (y.a.goal - y.a.have) || x.a.name.localeCompare(y.a.name));
  if (!close.length) return "";
  const src = (v) => (v ? [v.name, v.artist && keyOf(v.artist) !== keyOf(v.name) ? "by " + v.artist : "", v.source ? "from " + v.source : "where it's from isn't listed"].filter(Boolean).join(" · ") : "not in the card list yet");
  return `<section class="sec"><div class="sec-h"><h2>Albums almost done</h2><button class="btn sm ghost" data-a="go" data-to="cards/albums">All albums</button></div>
    <p class="muted small">${plural(close.length, "album")} within 3 variants of finishing. Where to get each missing variant comes from the card data.</p>
    <div class="list">${close.slice(0, 10).map(({ a, miss }) => `<div class="li" style="align-items:flex-start;flex-direction:column;gap:4px"><button class="row between nowrap" data-a="albumOpen" data-id="${esc(a.key)}" style="width:100%;background:none;border:0;padding:0;text-align:left;color:inherit"><b>${esc(a.name)}</b><span class="num small">${a.have}/${a.goal}</span></button>
      <span class="small">${a.next ? `${a.goal - a.have} more for ${esc(rewardText(a.next))}` : `${a.goal - a.have} more to finish it`}</span>
      ${miss.slice(0, 3).map((x) => `<button class="small" data-a="${x.v ? "varOpen" : "noop"}" data-id="${esc(x.v ? x.v.id : "")}" style="background:none;border:0;padding:0;text-align:left;color:inherit"><span class="muted">○</span> ${esc(x.v ? card(x.v.card).name : x.id)} <span class="muted">· ${esc(src(x.v))}</span></button>`).join("")}${miss.length > 3 ? `<span class="muted small">Any ${a.goal - a.have} of the ${miss.length} missing count.</span>` : ""}</div>`).join("")}</div></section>`;
}

/* ---------- 5. Your top artists (the Variants section already filters by artist) ---------- */
function planArtistsHtml() {
  const d = planData(), by = {};
  for (const v of d.vars) { const a = String(v.artist || "").trim(); if (!a || keyOf(a) === keyOf(v.name)) continue; const o = by[a] || (by[a] = { a, own: 0, all: 0 }); o.all++; if (v.owned) o.own++; }
  const top = Object.values(by).filter((o) => o.own).sort((x, y) => y.own - x.own || x.a.localeCompare(y.a)).slice(0, 8);
  if (!top.length) return "";
  return `<section class="sec"><h2>Your top artists</h2><p class="muted small">Artists you own the most variants from. Tap one to see their variants.</p>
    <div class="list">${top.map((o) => `<button class="li" data-a="planArtist" data-v="${esc(o.a)}"><div class="grow" style="min-width:0"><div class="t">${esc(o.a)}</div><div class="s">${o.own} of ${o.all} of their variants${o.own >= o.all ? " · all of them" : ""}</div></div>${progBar(o.own, o.all, `${o.own} of ${o.all}`).replace('class="bar"', 'class="bar" style="width:72px"')}</button>`).join("")}</div></section>`;
}

/* ---------- 11. Home: one of your Custom Cards each day ---------- */
function lookOfDayHtml() {
  const L = obj(S.looks), keys = Object.keys(L).filter((k) => lookText(L[k]) && !card(k).unknown).sort();
  if (!keys.length) return "";
  const k = keys[hue(localDate(Date.now())) % keys.length], c = card(k), x = obj(L[k]), v = x.v ? variantAny(x.v) : null;
  return `<section class="sec"><div class="panel row nowrap" style="align-items:center;gap:12px"><div style="width:72px;flex:none">${cardFace(c, { a: "cardOpen", cls: "own", variant: v || undefined, noSub: true })}</div>
    <div class="stack" style="gap:2px;min-width:0;flex:1"><span class="eyebrow">Custom Card of the day</span><b>${esc(c.name)}</b><span class="small" style="white-space:normal">${esc(lookText(x))}</span><div><button class="btn sm ghost" data-a="go" data-to="cards/custom">Your Custom Cards ›</button></div></div></div></section>`;
}

/* ---------- The Plan section ---------- */
function vPlan() {
  return `<section class="sec">${planRingsHtml()}</section>${planNewHtml()}${planUpgradesHtml()}${planSeriesHtml()}${planSplitsHtml()}${planBoostersHtml()}${planTimelineHtml()}${planAlbumsHtml()}${planArtistsHtml()}`;
}
EXT.cardsSubs.push(["plan", "Plan", vPlan]);
lookOfDayHtml.ext = { id: "customDay", label: "Custom Card of the day", sub: "One of your Custom Cards, a new one each day" }; // so Settings › App › Home screen can switch it off
EXT.homeTop.push(lookOfDayHtml);
EXT.afterRender.push(() => { planOwnWatch(); planNewChip(); });
EXT.search.push((q) => (/plan|upgrade|complet|missing|split|booster|album|artist|timeline|new/i.test(q) ? [{ label: "Collection plan", sub: "Upgrades, missing cards, splits, albums", route: "#cards/plan" }] : []));
EXT.styles.push(`
.plan-rings { display: flex; gap: 4px; justify-content: space-between; }
.plan-ring { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
.plan-ring svg { width: 100%; max-width: 64px; height: auto; }
.plan-ring svg text { font-family: var(--ui); font-weight: 800; fill: var(--fg); }
.plan-ring b { font-size: 11px; line-height: 1.2; }
.plan-chart { width: 100%; height: auto; display: block; }
.plan-chart rect.c { fill: var(--snap-a); } .plan-chart rect.v { fill: var(--cube); }
.plan-chart text { fill: var(--muted); font-family: var(--ui); } .plan-chart text.n { fill: var(--fg); font-weight: 700; }
.plan-key { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px; }
.plan-key.c { background: var(--snap-a); } .plan-key.v { background: var(--cube); }
`);
Object.assign(A, {
  planCopy: () => copyText(planSummaryText(), "Summary copied. Paste it in Discord or anywhere."),
  planUpAll: () => { ui.planUpAll = true; render(); },
  planSr: (el) => { ui.planSr = el.dataset.v; ui.planSrAll = false; render(); },
  planSrAll: () => { ui.planSrAll = true; render(); },
  planSeen: () => { markCatSeen(); if (typeof sheetFn !== "undefined" && sheetFn) closeSheet(); render(); toast("Counting from today"); },
  planNewOpen: () => openSheet(planNewSheet),
  planArtist: (el) => { ui.varArtist = el.dataset.v; ui.varFilter = "owned"; ui.varQ = ""; go("cards/variants"); },
});
