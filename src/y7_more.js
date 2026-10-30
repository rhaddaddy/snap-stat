/* ============ More from the game (October 29, 2026): the weekly challenge and season chapters, bundles, daily cards
   and packs, the season pass track, the web shop, a review of every screenshot read, and an automatic bot check ============ */

// A number as the game shows it: 1,826, 21.2K, 1.5M
const nIn = (v) => { if (v === null || v === undefined || String(v).trim() === "") return null; const s = String(v).replace(/[,\s+]/g, ""), m = s.match(/^(\d+(?:\.\d+)?)([kKmM])?$/); const z = m ? Number(m[1]) * (m[2] ? (/k/i.test(m[2]) ? 1e3 : 1e6) : 1) : Number(s); return Number.isFinite(z) ? Math.max(0, Math.round(z)) : null; };
const leftAt = (txt, time) => { const l = parseLeft(txt); return l > 0 && l < 60 * DAY ? (time || Date.now()) + l : 0; };

/* ---------- Missions: the weekly challenge and the season's chapters ---------- */
// [time] is when the screenshot was taken, so "unlocks in 2d" counts from then (not from when it was read)
function missionItem(i, time) {
  const o = obj(i); let text = String(o.text || "").trim();
  const hard = !!o.hard || /^hard\s*:/i.test(text); text = text.replace(/^hard\s*:\s*/i, "");
  const p = nIn(o.progress), g = nIn(o.goal);
  return { text: text.slice(0, 90), hard, progress: p, goal: g, reward: String(o.reward || "").slice(0, 40), done: !!o.done || (g ? num(p) >= g : false), unlocksAt: leftAt(o.unlocksIn, time) };
}
// The Missions screen is read a part at a time as it scrolls, so each part merges into what's already known.
function applyChallenges(G, m, time) {
  const done = [];
  const W = obj(m.weekly);
  const wItems = arr(W.items).map((i) => missionItem(i, time)).filter((i) => i.text);
  if (wItems.length || nIn(W.of) || nIn(W.points) !== null) {
    const old = obj(G.weekly), fresh = (old.endsAt && old.endsAt < time) || (!old.endsAt && num(old.at) && time - num(old.at) > 7 * DAY);
    const kOf = (i) => keyOf(i.text) + (i.hard ? "!" : ""), prev = new Map((fresh ? [] : arr(old.items)).map((i) => [kOf(i), i]));
    const by = new Map(); for (const i of wItems) by.set(kOf(i), { ...obj(prev.get(kOf(i))), ...i }); for (const [k, i] of prev) if (!by.has(k)) by.set(k, i);
    const ends = leftAt(W.endsIn, time);
    G.weekly = { items: [...by.values()].slice(0, 16), done: nIn(W.done) ?? (fresh ? null : old.done), of: nIn(W.of) ?? (fresh ? null : old.of), points: nIn(W.points) ?? (fresh ? null : old.points), pointsNext: nIn(W.pointsNext) ?? (fresh ? null : old.pointsNext), endsAt: ends || (fresh ? 0 : num(old.endsAt)), at: time };
    done.push(`weekly challenge${G.weekly.of ? ` ${num(G.weekly.done)}/${G.weekly.of}` : ""}`);
  }
  const chs = arr(m.chapters).map((c) => ({ n: nIn(obj(c).number), name: String(obj(c).name || "").slice(0, 50), complete: !!obj(c).complete, unlocksAt: leftAt(obj(c).unlocksIn, time), items: arr(obj(c).items).map((i) => missionItem(i, time)).filter((i) => i.text) })).filter((c) => c.n || c.name);
  if (chs.length) {
    const cs = currentSeason(), sid = cs ? cs.id : "";
    const old = obj(G.chapters).season === sid ? obj(G.chapters) : { season: sid, list: [] };
    const by = new Map(arr(old.list).map((c) => [c.n || keyOf(c.name), c]));
    for (const c of chs) { const k = c.n || keyOf(c.name), o = obj(by.get(k)); const items = new Map(arr(o.items).map((i) => [keyOf(i.text), i])); c.items.forEach((i) => items.set(keyOf(i.text), { ...obj(items.get(keyOf(i.text))), ...i })); by.set(k, { ...o, ...c, name: c.name || o.name || "", items: [...items.values()].slice(0, 12), complete: c.complete || (!c.items.length && o.complete) }); }
    G.chapters = { season: sid, list: [...by.values()].sort((a, b) => num(a.n) - num(b.n)).slice(0, 12), at: time };
    done.push(`${chs.length} chapter${chs.length === 1 ? "" : "s"}`);
  }
  return done;
}
function missionRow(i) {
  const lock = i.unlocksAt && i.unlocksAt > Date.now();
  return `<div class="stack mrow" style="gap:3px"><div class="row between nowrap small"><span class="${i.done ? "muted" : ""}">${i.done ? "✓ " : lock ? `${ICON.lock} ` : ""}${i.hard ? `<span class="pill L" style="padding:1px 6px">HARD</span> ` : ""}${esc(i.text)}</span>${i.goal ? `<span class="num muted">${fmt(Math.min(num(i.progress), i.goal))}/${fmt(i.goal)}</span>` : ""}</div>
    ${i.goal && !i.done && !lock ? progBar(num(i.progress), i.goal, `${num(i.progress)} of ${i.goal}`) : ""}${lock ? `<span class="muted small">Unlocks in ${cdSpan(i.unlocksAt)}</span>` : i.reward && !i.done ? `<span class="muted small">${esc(i.reward)}</span>` : ""}</div>`;
}
function vMissions() {
  const G = obj(S.gameMissions), now = Date.now(), cs = currentSeason();
  const daily = obj(G.daily).day === gameDay() ? G.daily : null;
  const wk = G.weekly && (!G.weekly.endsAt || G.weekly.endsAt > now - DAY) ? G.weekly : null;
  const ch = obj(G.chapters).season === (cs ? cs.id : "") ? arr(G.chapters.list) : [];
  const old = !ch.length && G.season && (!cs || num(G.season.at) >= cs.startTs) ? G.season : null;
  const next = [...ch.map((c) => c.unlocksAt), ...ch.flatMap((c) => arr(c.items).map((i) => i.unlocksAt))].filter((t) => t > now).sort((a, b) => a - b)[0];
  const tip = `<span class="muted small">From the game's Missions screen: screenshot it, or open it with Track & play on and scroll to the bottom.</span>`;
  const plan = missionPlanHtml();
  return `${plan ? `<section class="sec">${plan}</section>` : ""}<section class="sec"><div class="sec-h"><h2>Today's missions</h2>${daily && daily.refreshAt > now ? `<span class="muted small">new ones in ${cdSpan(daily.refreshAt)}</span>` : `<span class="muted small">new ones in ${cdSpan(next8hRefresh())}</span>`}</div>
    ${daily ? `<div class="panel stack small">${daily.items.map(missionRow).join("")}<span class="muted small">${daily.items.filter((i) => i.done).length} of ${daily.items.length} done · seen ${esc(agoTxt(daily.at))}</span></div>` : `<div class="panel small">${tip}</div>`}</section>
  <section class="sec"><div class="sec-h"><h2>Weekly challenge</h2>${wk && wk.endsAt > now ? `<span class="muted small">resets in ${cdSpan(wk.endsAt)}</span>` : ""}</div>
    ${wk ? `<div class="panel stack small">${wk.of ? `<div class="row between"><b>${num(wk.done)} of ${wk.of} missions</b>${wk.pointsNext ? `<span class="num">${fmt(num(wk.points))}/${fmt(wk.pointsNext)} points</span>` : ""}</div>${progBar(num(wk.done), wk.of)}` : ""}
      ${arr(wk.items).map(missionRow).join("")}<span class="muted small">Seen ${esc(agoTxt(wk.at))}</span></div>` : `<div class="panel small">${tip}</div>`}</section>
  <section class="sec"><div class="sec-h"><h2>${cs ? esc(cs.name) + " chapters" : "Season chapters"}</h2>${next ? `<span class="muted small">next unlock in ${cdSpan(next)}</span>` : ""}</div>
    ${ch.length ? `<div class="stack" style="gap:8px">${ch.map((c) => { const lock = c.unlocksAt && c.unlocksAt > now, d = arr(c.items).filter((i) => i.done).length;
      return `<details class="panel chap" ${!c.complete && !lock ? "open" : ""}><summary><span><b>Chapter ${esc(c.n || "?")}</b>${c.name ? ` · ${esc(c.name)}` : ""}</span>${c.complete ? `<span class="pill W">Complete</span>` : lock ? `<span class="pill dim">${ICON.lock} ${cdSpan(c.unlocksAt)}</span>` : c.items.length ? `<span class="pill live">${d}/${c.items.length}</span>` : ""}</summary>
        ${c.items.length ? `<div class="stack" style="margin-top:8px;gap:8px">${c.items.map(missionRow).join("")}</div>` : c.complete ? "" : `<span class="muted small">Scroll to this chapter in the game to see its missions.</span>`}</details>`; }).join("")}</div>`
      : old ? `<div class="panel stack small">${old.items.map(missionRow).join("")}</div>` : `<div class="panel small">${tip}</div>`}</section>`;
}

/* ---------- Bundles, daily cards and packs from the game's shop ---------- */
// What a bundle's currencies are worth in Gold, from the shop's own prices: 500 Credits cost 400 Gold, 1,000 Collector's Tokens 1,300.
const GOLD_PER = { gold: 1, credits: 0.8, tokens: 1.3 };
function contentsGold(list) {
  let g = 0; const extras = [];
  for (const line of arr(list)) {
    const t = String(line || "").replace(/[’‘]/g, "'"), m = t.replace(/,/g, "").match(/^\s*[+x×•*-]?\s*(\d+(?:\.\d+)?)\s*(k)?\s*(gold|credits?|collector'?s? tokens?|tokens?)\s*$/i);
    if (m) { const n = Number(m[1]) * (m[2] ? 1000 : 1), w = /gold/i.test(m[3]) ? "gold" : /token/i.test(m[3]) ? "tokens" : "credits"; g += n * GOLD_PER[w]; }
    else if (t.trim()) extras.push(t.trim());
  }
  return { gold: Math.round(g), extras };
}
// Gold you'd get for the same money from the web shop's gold packs (the best one at or under that price)
function goldForMoney(usd) {
  const packs = arr(WEBSHOP.data && WEBSHOP.data.offers).filter((o) => o.group === "baseline_gold" && o.gold && o.price);
  const ladder = packs.length ? packs : [{ price: 9.99, gold: 700 }, { price: 19.99, gold: 1450 }, { price: 49.99, gold: 3850 }, { price: 99.99, gold: 8000 }];
  const best = ladder.filter((p) => p.price <= usd + 0.01).sort((a, b) => b.gold / b.price - a.gold / a.price)[0] || ladder.sort((a, b) => a.price - b.price)[0];
  return usd * (best.gold / best.price);
}
function bundleValue(priceTxt, contents) {
  const usd = Number(String(priceTxt || "").replace(/[^0-9.]/g, "")), { gold, extras } = contentsGold(contents);
  if (!/\$/.test(String(priceTxt || "")) || !(usd > 0) || !gold) return { gold, extras, pct: 0 };
  return { gold, extras, pct: Math.round((gold / goldForMoney(usd)) * 100) };
}
function applyShopMore(sh, time) {
  const done = [];
  const B = (S.gameBundles = obj(S.gameBundles));
  for (const b of arr(sh.bundles).slice(0, 20)) {
    const name = String(obj(b).name || "").trim().slice(0, 60), price = String(obj(b).price || "").slice(0, 24); if (!name) continue;
    const contents = arr(obj(b).contents).map((c) => String(c).trim().slice(0, 70)).filter(Boolean).slice(0, 12);
    const k = keyOf(name + "|" + price + "|" + contents.slice(0, 2).join("|"));
    B[k] = { ...obj(B[k]), name, price, contents: contents.length ? contents : arr(obj(B[k]).contents), endsAt: leftAt(obj(b).endsIn, time) || num(obj(B[k]).endsAt), value: String(obj(b).value || "").slice(0, 60), sold: !!obj(b).sold, shop: String(sh.shop || "").slice(0, 30), at: time };
  }
  for (const [k, b] of Object.entries(B)) if ((b.endsAt && b.endsAt < Date.now() - DAY) || Date.now() - num(b.at) > 14 * DAY) delete B[k];
  if (arr(sh.bundles).length) done.push(`${arr(sh.bundles).length} bundle${arr(sh.bundles).length === 1 ? "" : "s"}`);
  const daily = arr(sh.daily).map((d) => ({ card: String(obj(d).card || "").slice(0, 40), variant: String(obj(d).variant || "").slice(0, 60), price: String(obj(d).price || "").slice(0, 20), pinned: !!obj(d).pinned, sold: !!obj(d).sold })).filter((d) => d.card).slice(0, 8);
  if (daily.length) {
    const D = obj(S.dailyCards), same = D.day === gameDay(time);
    const by = new Map((same ? arr(D.cards) : []).map((d) => [keyOf(d.card + d.variant), d]));
    daily.forEach((d) => by.set(keyOf(d.card + d.variant), d));
    S.dailyCards = { day: gameDay(time), at: time, refreshAt: leftAt(sh.dailyRefreshIn, time) || num(same && D.refreshAt), cards: [...by.values()].slice(0, 8) };
    done.push(`${daily.length} daily card${daily.length === 1 ? "" : "s"}${daily.some((d) => d.pinned) ? " (one pinned)" : ""}`);
  }
  const packs = arr(sh.packs).map((p) => ({ name: String(obj(p).name || "").slice(0, 40), price: String(obj(p).price || "").slice(0, 20), complete: !!obj(p).complete })).filter((p) => p.name).slice(0, 8);
  if (packs.length) { const old = obj(S.packsSeen), keepOld = num(old.at) && time - num(old.at) < 14 * DAY; const by = new Map(); packs.forEach((p) => by.set(keyOf(p.name), p)); if (keepOld) arr(old.list).forEach((p) => { if (!by.has(keyOf(p.name))) by.set(keyOf(p.name), p); }); S.packsSeen = { at: time, list: [...by.values()].slice(0, 10) }; done.push(`${packs.length} pack${packs.length === 1 ? "" : "s"}`); }
  return done;
}
// The daily cards also count as shop items for wishlist alerts
const dailyAsItems = (sh) => arr(sh.daily).map((d) => ({ card: obj(d).card, variant: obj(d).variant, price: obj(d).price, kind: obj(d).variant ? "variant" : "card" }));
function bundleRow(b) {
  const v = bundleValue(b.price, b.contents), cls = v.pct >= 150 ? "W" : v.pct >= 100 ? "gold" : v.pct ? "dim" : "";
  return `<div class="li" style="align-items:flex-start"><div class="grow stack" style="gap:3px;min-width:0"><div class="row between nowrap"><b class="t">${esc(b.name)}</b><span class="num">${esc(b.price || "")}</span></div>
    ${arr(b.contents).length ? `<span class="small">${b.contents.map(esc).join(" · ")}</span>` : ""}
    <span class="muted small">${b.endsAt && b.endsAt > Date.now() ? `${cdSpan(b.endsAt)} left · ` : b.endsAt ? "ended · " : ""}${b.src || (b.shop ? esc(b.shop) : "in game")}${b.points ? ` · ${fmt(b.points)} Web Points` : ""}${b.value ? ` · ${esc(b.value)}` : ""}</span>
    ${v.pct ? `<span class="small"><span class="pill ${cls}">${v.pct}% value</span> <span class="muted">the ${fmt(v.gold)} Gold its currencies are worth, against a gold pack at the same price${v.extras.length ? `, plus ${v.extras.length} more item${v.extras.length === 1 ? "" : "s"}` : ""}</span></span>` : ""}${b.sold ? `<span class="pill dim">Sold out</span>` : ""}</div></div>`;
}
function shopNowHtml() {
  const now = Date.now();
  const game = Object.values(obj(S.gameBundles)).filter((b) => !b.endsAt || b.endsAt > now).sort((a, b) => num(a.endsAt || 9e15) - num(b.endsAt || 9e15));
  const D = obj(S.dailyCards), daily = D.day === gameDay() ? arr(D.cards) : [];
  const wish = new Set(wishHits(daily.map((d) => ({ ...d, kind: d.variant ? "variant" : "card" }))).map((h) => h.name.split(" · ")[0]));
  const packs = arr(obj(S.packsSeen).list);
  const parts = [];
  if (game.length) parts.push(`<section class="sec"><div class="sec-h"><h2>Bundles in the game's shop</h2>${shotInput("numbers")}</div><div class="list">${game.map(bundleRow).join("")}</div></section>`);
  const plan = tokenPlanHtml();
  if (daily.length || packs.length || plan) parts.push(`<section class="sec"><div class="sec-h"><h2>Collector's Token shop</h2>${D.refreshAt > now ? `<span class="muted small">daily cards change in ${cdSpan(D.refreshAt)}</span>` : ""}</div>
    ${daily.length ? `<h3>Daily cards</h3><div class="chiplist">${daily.map((d) => { const c = fuzzyCard(d.card); const v = c && d.variant ? matchVariant(c.key, d.variant, "") : null; return `<div class="stack" style="gap:3px;align-items:center;width:84px">${c ? cardChip(c.key, { a: "cardOpen", noOwn: true, v }) : `<span class="cchip">${esc(d.card)}</span>`}<span class="small num">${esc(d.price)}</span>${d.pinned ? `<span class="pill gold">Pinned</span>` : ""}${wish.has(c ? c.name : d.card) ? `<span class="pill W">♡ Wishlist</span>` : ""}${d.sold ? `<span class="pill dim">Bought</span>` : ""}</div>`; }).join("")}</div>` : ""}
    ${packs.length ? `<h3>Packs</h3><div class="list">${packs.map((p) => `<div class="li"><div class="grow t">${esc(p.name)}</div>${p.price ? `<span class="num small">${esc(p.price)}</span>` : ""}${p.complete ? `<span class="pill W">Complete</span>` : ""}</div>`).join("")}</div>` : ""}
    ${plan}
    <span class="muted small">From your screenshots of the shop's Cards tab${D.at ? ` · ${esc(agoTxt(D.at))}` : ""}.</span></section>`);
  return `<section class="sec">${bundleAlertToggle()}</section>` + parts.join("") + webShopHtml();
}

/* ---------- The web shop: every bundle and the season's Web Points track (public, updated daily), plus your own progress ---------- */
const WEBSHOP = makeDataFile("webshop.json", "snapstat-webshop-v1", (j) => j && Array.isArray(j.offers));
const WS_GROUP = { web_exclusive: "Web exclusive", top_deals: "Top deals", bundles_monthly: "Bundles", season_pass: "Season pass", sp_super_premium: "Season pass", gold_pass: "Gold Pass", baseline_gold: "Gold", free_rewards: "Free" };
function webShopHtml() {
  const W = WEBSHOP.data, now = Date.now();
  if (!W) return "";
  const P = obj(obj(S.webshop).progress), mine = P.at && now - P.at < 3 * DAY;
  const offers = arr(W.offers).filter((o) => o.until > now && o.from <= now && o.group !== "baseline_gold" && o.group !== "free_rewards").sort((a, b) => a.until - b.until);
  const chain = arr(W.chains)[0];
  const claimed = new Set(arr(P.claimed).map(String)), isClaimed = (s) => claimed.has(String(chain && chain.id != null ? chain.id : "") + ":" + String(s.id)) || claimed.has(String(s.id));
  const pts = mine ? num(P.points) : 0;
  const nextStep = chain ? arr(chain.steps).find((s) => s.points > pts) : null;
  return `<section class="sec"><div class="sec-h"><h2>Web shop</h2><button class="btn sm snap" data-a="webshopOpen">Open</button></div>
    ${chain ? `<div class="panel stack small"><div class="row between"><b>${esc(chain.name)} Web Points track</b>${chain.ends ? `<span class="muted">${cdSpan(chain.ends)} left</span>` : ""}</div>
      ${mine ? `<div class="row between"><span>You have <b class="num">${fmt(pts)}</b> Web Points</span>${nextStep ? `<span class="muted">${fmt(nextStep.points - pts)} to the next reward</span>` : `<span class="pill W">Track complete</span>`}</div>${nextStep ? progBar(pts, nextStep.points) : ""}` : `<span class="muted">Every web shop purchase earns Web Points (about 1 per cent you spend). ${natCan("openWebShop") ? "Open the web shop here and sign in, and SNAP Stat keeps your points and claimed rewards up to date." : ""}</span>`}
      <details><summary class="small">Every reward on the track</summary><div class="list" style="margin-top:6px">${arr(chain.steps).map((s) => `<div class="li"><span class="pill ${isClaimed(s) ? "W" : pts >= s.points && mine ? "gold" : "dim"}">${fmt(s.points)}</span><div class="grow small">${esc(s.rewards)}</div>${isClaimed(s) ? "✓" : pts >= s.points && mine ? `<span class="small">Claim it</span>` : ""}</div>`).join("")}</div></details></div>` : ""}
    ${offers.length ? `<div class="list">${offers.map((o) => bundleRow({ name: o.name, price: o.price ? "$" + o.price.toFixed(2) : "Free", contents: o.contents, endsAt: o.until < 4e12 ? o.until : 0, points: o.points, src: esc(WS_GROUP[o.group] || "Web shop") })).join("")}</div>` : ""}
    <p class="muted small">Prices and bundles come from the web shop's own list, checked every day after the reset${W.updated ? ` (last ${esc(agoTxt(Date.parse(W.updated)))})` : ""}. ${mine ? `Your progress is from ${esc(agoTxt(P.at))}.` : ""} SNAP Stat never reads card numbers, bank details or anything on the payment pages.</p></section>`;
}
// Your progress, from the web shop opened inside the Android app: only points, claimed rewards and today's free rewards
function applyWebshopProgress(text) {
  let j; try { j = obj(JSON.parse(text)); } catch { return false; }
  if (!j.loggedIn) return false;
  const P = { points: nIn(j.webPoints) || 0, claimed: arr(j.chains).flatMap((c) => arr(obj(c).steps).filter((s) => obj(s).claimed).map((s) => (obj(c).id != null ? String(obj(c).id).slice(0, 20) + ":" : "") + String(obj(s).id).slice(0, 12))).slice(0, 80), free: arr(j.free).map((f) => ({ key: String(obj(f).key || "").slice(0, 40), name: String(obj(f).name || "").slice(0, 40), left: Number(obj(f).available) >= 0 ? nIn(obj(f).available) : null })).slice(0, 10), at: num(j.at) || Date.now() };
  S.webshop = { ...obj(S.webshop), progress: P };
  // Today's free credits show as none left once they're claimed
  if (P.free.some((f) => /credit/i.test(f.key + f.name) && f.left === 0)) S.webshop.claimed = gameDay(P.at);
  save(); return true;
}

/* ---------- The season pass track: every level's rewards, and which pass you have ---------- */
function applyShotPass(x, p, time) {
  const cs = currentSeason(); if (!cs) { x.status = "A season pass screen, but no season is set up"; return; }
  const P = (S.passes[cs.id] = obj(S.passes[cs.id])), T = (S.passTrack = obj(S.passTrack)), tr = (T[cs.id] = obj(T[cs.id])), lv = (tr.levels = obj(tr.levels)), done = [];
  if (nIn(p.level)) { if (num(P.level) !== nIn(p.level) && !nIn(p.xpNext)) { P.xp = 0; P.xpNext = 0; } P.level = nIn(p.level); P.levelAt = time; done.push(`level ${P.level}`); }
  if (nIn(p.xpNext)) { P.xp = num(nIn(p.xp)); P.xpNext = nIn(p.xpNext); P.xpAt = time; done.push(`${fmt(P.xp)}/${fmt(P.xpNext)} to the next`); }
  notePass(cs.id, num(P.level), num(P.xp), num(P.xpNext), time);
  const tier = String(p.tier || "").toLowerCase(); if (/^(free|premium|premium\+)$/.test(tier)) { P.tier = tier === "premium+" ? "plus" : tier; P.tierAt = time; done.push(PASS_TIERS[P.tier] + " pass"); }
  let n = 0;
  for (const t of arr(p.track).slice(0, 30)) { const L = nIn(obj(t).level); if (!L || L > 200) continue; lv[L] = { free: String(obj(t).free || obj(lv[L]).free || "").slice(0, 60), premium: String(obj(t).premium || obj(lv[L]).premium || "").slice(0, 60) }; n++; }
  if (n) done.push(`rewards for ${n} level${n === 1 ? "" : "s"}`);
  const sp = obj(p.spotlight); if (sp.name) tr.spotlight = { name: String(sp.name).slice(0, 60), at: nIn(sp.unlocksAt) };
  tr.at = time;
  if (!done.length) { x.status = "A season pass screen, but nothing I could read"; return; }
  x.status = "Season pass updated"; x.detail = done.join(" · "); save(); collSyncNow();
}
// The season's collectibles, in the order the pass gives them, with where to get each one and a lock on premium ones
function passCollectiblesHtml(s, items) {
  const tr = obj(obj(S.passTrack)[s.id]), lv = obj(tr.levels), tier = obj(S.passes[s.id]).tier || "free", have = num(obj(S.passes[s.id]).level);
  const ctx = seasonCtx(s);
  const rows = items.map((it) => ({ it, w: collWhere(it, ctx) })).sort((a, b) => (a.w.level || 999) - (b.w.level || 999));
  const known = Object.keys(lv).length;
  return `${collRowsHtml(rows, ctx)}
    ${known ? `<details class="small"><summary>Every level's rewards you've opened (${known})</summary><div class="list" style="margin-top:6px">${Object.entries(lv).sort((a, b) => a[0] - b[0]).map(([L, r]) => `<div class="li"><span class="pill ${have >= L ? "W" : "dim"}">${L}</span><div class="grow small">${r.free ? esc(r.free) : `<span class="muted">—</span>`}</div><div class="grow small">${r.premium ? `${tier === "free" ? ICON.lock + " " : ""}${esc(r.premium)}` : ""}</div></div>`).join("")}</div></details>`
      : ""}
    <p class="muted small">Ticks come from your collection, your season pass level and pass type, and your screenshots of events and shops. Open the season pass in the game with Track & play on to see the level of every reward, and screenshot your avatars, titles and card backs to tick the ones you have.</p>`;
}

/* ---------- Every screenshot read, kept on this device for review ---------- */
const SHOTLOG_MAX = 150;
let _shotDb = null;
function shotDb() {
  if (_shotDb) return _shotDb;
  _shotDb = new Promise((res, rej) => { if (!("indexedDB" in window)) { rej(new Error("no storage")); return; } const r = indexedDB.open("snapstat-shotlog", 1); r.onupgradeneeded = () => r.result.createObjectStore("shots", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  _shotDb.catch(() => { _shotDb = null; });
  return _shotDb;
}
function shotStore(mode, fn) { return shotDb().then((db) => new Promise((res, rej) => { const t = db.transaction("shots", mode), st = t.objectStore("shots"); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); })); }
async function shrinkShot(file, max = 900) {
  const bmp = await createImageBitmap(file), sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
  return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.72));
}
async function shotLogSave(x) {
  if (!x || x.dupe || !x.file) return;
  try {
    const img = await shrinkShot(x.file);
    const rec = { id: x.logId || uid(), at: Date.now(), taken: num(x.file.lastModified) || Date.now(), hint: String(x.hint || x.file.snapHint || "").slice(0, 80), session: String(obj(x.file.snapMeta).session || ""), meta: x.file.snapMeta ? clone(x.file.snapMeta) : null, matchId: String(x.matchId || x.reMatch || ""), kind: String(x.kind || ""), status: String(x.status || "").slice(0, 160), detail: String(x.detail || "").slice(0, 400), data: JSON.stringify(x.raw || {}).slice(0, 12000), img, verdict: "" };
    await shotStore("readwrite", (st) => st.put(rec));
    const all = await shotStore("readonly", (st) => st.getAllKeys());
    if (all.length > SHOTLOG_MAX) { const recs = await shotLogAll(); const drop = recs.slice(SHOTLOG_MAX); await shotStore("readwrite", (st) => drop.forEach((r) => st.delete(r.id))); }
  } catch { /* the review page is a convenience; reading still worked */ }
}
async function shotLogAll() { const list = await shotStore("readonly", (st) => st.getAll()).catch(() => []); return arr(list).sort((a, b) => b.at - a.at); }
const rv = { list: null, filter: "all", open: "", urls: new Map(), busy: "" };
async function reviewOpen(keep) { if (!keep) rv.session = ""; rv.list = null; openSheet(reviewSheet); rv.list = await shotLogAll(); refreshSheet(); }
function rvUrl(r) { if (!rv.urls.has(r.id) && r.img) rv.urls.set(r.id, URL.createObjectURL(r.img)); return rv.urls.get(r.id) || ""; }
function readable(o, depth = 0) {
  if (o === null || o === undefined || o === "") return "";
  if (Array.isArray(o)) return o.length ? o.map((v) => (typeof v === "object" ? `<div style="margin-left:${depth ? 10 : 0}px">• ${readable(v, depth + 1)}</div>` : `<span>${esc(String(v))}</span>`)).join(typeof o[0] === "object" ? "" : ", ") : "";
  if (typeof o === "object") return Object.entries(o).filter(([, v]) => v !== null && v !== "" && v !== false && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)).map(([k, v]) => `<div style="margin-left:${depth ? 10 : 0}px"><b>${esc(k)}</b>: ${typeof v === "object" ? readable(v, depth + 1) : esc(String(v))}</div>`).join("");
  return esc(String(o));
}
function reviewSheet() {
  const list = rv.list;
  if (!list) return `${sheetHead("Screenshots SNAP Stat read")}<p class="muted small">Loading…</p>`;
  const checked = list.filter((r) => r.verdict), right = checked.filter((r) => r.verdict === "right").length;
  const shown = list.filter((r) => !rv.session || r.session === rv.session).filter((r) => rv.filter === "all" || (rv.filter === "wrong" ? r.verdict === "wrong" : rv.filter === "todo" ? !r.verdict : r.kind === rv.filter));
  const ch = (v, l, n) => `<button class="chip" data-a="rvFilter" data-v="${v}" aria-pressed="${rv.filter === v}">${l} <span class="num muted">${n}</span></button>`;
  return `${sheetHead("Screenshots SNAP Stat read", `${list.length} kept on this phone${checked.length ? ` · you checked ${checked.length}: ${right} right (${Math.round((right / checked.length) * 100)}%)` : ""}`)}
    ${rv.session ? `<p class="small">One match's pictures, a turn at a time. <button class="linkbtn" data-a="rvAll">Show every screenshot</button></p>` : ""}
    <div class="chips">${ch("all", "All", list.length)}${ch("todo", "Not checked", list.filter((r) => !r.verdict).length)}${ch("wrong", "Marked wrong", list.filter((r) => r.verdict === "wrong").length)}${ch("match", "Matches", list.filter((r) => r.kind === "match").length)}${ch("numbers", "Numbers", list.filter((r) => r.kind === "numbers").length)}${ch("shop", "Shops", list.filter((r) => r.kind === "shop").length)}</div>${extHtml(EXT.reviewTools, list, shown)}
    ${shown.length ? `<div class="list">${shown.slice(0, 60).map((r) => `<div class="li rvrow" style="align-items:flex-start;gap:10px">${r.img ? `<img src="${esc(rvUrl(r))}" alt="" class="shot-thumb" style="width:72px;height:auto;border-radius:8px" data-a="rvBig" data-id="${esc(r.id)}">` : ""}<div class="grow stack" style="gap:4px;min-width:0">
        <div class="row between nowrap"><b class="small">${esc(r.status || "Read")}</b>${r.verdict ? `<span class="pill ${r.verdict === "right" ? "W" : "L"}">${r.verdict === "right" ? "Right" : "Wrong"}</span>` : ""}</div>
        ${r.detail ? `<span class="small">${esc(r.detail)}</span>` : ""}
        <span class="muted small">${esc(agoTxt(r.at))}${r.hint ? ` · ${esc(/^screen:/.test(r.hint) ? "saved on the " + (SCREEN_NAMES[r.hint.slice(7)] || r.hint.slice(7)) + " screen" : "after " + r.hint)}` : ""}${r.kind ? ` · read as ${esc(r.kind)}` : ""}</span>
        ${rv.open === r.id ? `<div class="panel small" style="max-height:260px;overflow:auto">${(() => { try { return readable(JSON.parse(r.data || "{}")); } catch { return esc(String(r.data || "").slice(0, 2000)) + "…"; } })() || "Nothing was read."}</div>` : ""}
        <div class="row"><button class="btn sm ghost" data-a="rvOpen" data-id="${esc(r.id)}">${rv.open === r.id ? "Hide" : "What it read"}</button><button class="btn sm ${r.verdict === "right" ? "snap" : "ghost"}" data-a="rvMark" data-id="${esc(r.id)}" data-v="right">✓ Right</button><button class="btn sm ${r.verdict === "wrong" ? "snap" : "ghost"}" data-a="rvMark" data-id="${esc(r.id)}" data-v="wrong">✗ Wrong</button>${canReadShots() ? `<button class="btn sm ghost" data-a="rvAgain" data-id="${esc(r.id)}" ${rv.busy ? "disabled" : ""}>${rv.busy === r.id ? "Reading…" : "Read again"}</button>` : ""}</div></div></div>`).join("")}</div>`
      : `<div class="empty"><span>${list.length ? "None here." : "Nothing read yet. Screenshots you share and pictures the tracker saves show up here once they're read."}</span></div>`}
    <p class="muted small">Pictures are kept on this phone only (the newest ${SHOTLOG_MAX}). Marking them right or wrong shows how accurate the reading is; "Read again" asks the AI once more.</p>
    ${list.length ? `<button class="btn sm ghost danger" data-a="rvClear">${rv.clearArm ? "Tap again to delete them all" : "Delete all kept screenshots"}</button>` : ""}`;
}
Object.assign(A, {
  reviewOpen: () => reviewOpen(),
  rvAll: () => { rv.session = ""; refreshSheet(); },
  rvFilter: (el) => { rv.filter = el.dataset.v; refreshSheet(); },
  rvOpen: (el) => { rv.open = rv.open === el.dataset.id ? "" : el.dataset.id; refreshSheet(); },
  rvBig: (el) => { const r = arr(rv.list).find((x) => x.id === el.dataset.id); if (r) window.open(rvUrl(r), "_blank"); },
  rvMark: async (el) => { const r = arr(rv.list).find((x) => x.id === el.dataset.id); if (!r) return; r.verdict = r.verdict === el.dataset.v ? "" : el.dataset.v; refreshSheet(); try { await shotStore("readwrite", (st) => st.put(r)); } catch { toast("Couldn't save that mark"); } },
  rvAgain: async (el) => {
    const r = arr(rv.list).find((x) => x.id === el.dataset.id); if (!r || !r.img || rv.busy) return;
    rv.busy = r.id; refreshSheet();
    const f = new File([r.img], "again.jpg", { type: "image/jpeg", lastModified: r.taken || Date.now() }); if (r.hint) f.snapHint = r.hint; if (r.meta) f.snapMeta = r.meta;
    const x = { file: f, again: true, logId: r.id, reMatch: r.matchId || "" };
    const run = shotChain.then(() => readOneShot(x)); shotChain = run.catch(() => {});
    try { await run; } catch (e) { x.status = "Couldn't read this one"; x.detail = e && e.message ? e.message : ""; }
    await shotLogSave(x); rv.busy = ""; rv.list = await shotLogAll(); refreshSheet(); render(); toast(x.status || "Read again");
  },
  rvClear: async () => { if (!rv.clearArm) { rv.clearArm = true; refreshSheet(); setTimeout(() => { rv.clearArm = false; refreshSheet(); }, 6000); return; } rv.clearArm = false; try { await shotStore("readwrite", (st) => st.clear()); } catch { /* fine */ } rv.list = []; refreshSheet(); },
});

/* ---------- The automatic bot check ---------- */
// After a match: the tracker's timing (how quickly the opponent answered each turn), what the end screen showed,
// and whether you've played this name before. A likely bot sends a notification.
function autoBot(m, meta, mm) {
  const why = []; let s = 50;
  const b = obj(obj(meta).bot);
  if (num(b.fast) >= 3 && num(b.slow) === 0) { s += 25; why.push(`answered all ${b.fast} turns you played quickly within ${b.maxWait || 3}s`); }
  else if (num(b.slow) >= 1) { s -= 20; why.push(`took a while on ${b.slow} turn${b.slow === 1 ? "" : "s"}`); }
  if (mm && mm.oppSnapped) { s -= 15; why.push("snapped"); }
  if (mm && mm.oppRetreated && num(m.turn) <= 4) { s -= 5; }
  const name = keyOf(m.oppName || "");
  if (name) { const seen = realMatches().filter((x) => x.id !== m.id && keyOf(x.oppName || "") === name).length; if (seen >= 2) { s -= 10; why.push(`you've played them ${seen} times before`); } }
  if (num(b.emotes) > 0) { s -= 30; why.push("emoted"); }
  return { score: clamp(s, 0, 100), why };
}
function applyAutoBot(m, meta, mm) {
  const r = autoBot(m, meta, mm); if (!r.why.length) return null;
  m.botAuto = r.score; m.botWhy = r.why.slice(0, 4).join(", "); m.bot = botLabel(r.score);
  if (botLabel(r.score) === "likely" && !obj(obj(meta).bot).told) notifyNow("That was probably a bot", `${m.oppName ? m.oppName + " " : "Your opponent "}${m.botWhy}.`, "bot:" + m.id, "#home/matches");
  return r;
}
