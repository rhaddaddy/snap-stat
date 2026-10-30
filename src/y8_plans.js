/* ============ Planners (October 29, 2026): the best decks for your missions and bounties, your season pass pace,
   alerts for great bundles, and when you can afford a card with Collector's Tokens ============ */

/* ---------- Which of your decks helps with a mission or bounty ---------- */
// Each mission's words become a test: how many cards in a deck do what it asks.
const abil = (c) => String(c.ability || "").toLowerCase();
const hasTag = (c, t) => arr(c.tags).includes(t);
function missionTest(text) {
  const t = String(text || "").toLowerCase().replace(/^hard\s*:\s*/, "");
  let m;
  if ((m = t.match(/play (\d+)-cost/))) { const n = Number(m[1]); return { what: `${n}-cost cards`, count: (cs) => cs.filter((c) => num(c.cost) === n).length, need: 3 }; }
  if ((m = t.match(/win a location with (\d+) or (?:less|fewer) power/))) { const n = Number(m[1]); return { what: "low-Power cards", count: (cs) => cs.filter((c) => c.power !== "?" && num(c.power) <= Math.max(2, Math.floor(n / 3))).length, need: 4 }; }
  if ((m = t.match(/win a location with (\d+) cards/))) return { what: "cheap cards to fill a location", count: (cs) => cs.filter((c) => num(c.cost) <= 2).length, need: 5 };
  if (/power'?s? worth|play .*power/.test(t)) return { what: "cards with 5 or more Power", count: (cs) => cs.filter((c) => c.power !== "?" && num(c.power) >= 5).length, need: 4 };
  if (/destroy/.test(t)) return { what: "Destroy cards", count: (cs) => cs.filter((c) => hasTag(c, "D") || /destroy/.test(abil(c))).length, need: 3 };
  if (/discard/.test(t)) return { what: "Discard cards", count: (cs) => cs.filter((c) => hasTag(c, "X") || /discard/.test(abil(c))).length, need: 3 };
  if (/\bmove/.test(t)) return { what: "Move cards", count: (cs) => cs.filter((c) => hasTag(c, "M") || /\bmove/.test(abil(c))).length, need: 3 };
  if (/on reveal/.test(t)) return { what: "On Reveal cards", count: (cs) => cs.filter((c) => hasTag(c, "R") || /on reveal/.test(abil(c))).length, need: 5 };
  if (/ongoing/.test(t)) return { what: "Ongoing cards", count: (cs) => cs.filter((c) => hasTag(c, "O") || /ongoing/.test(abil(c))).length, need: 4 };
  if (/draw/.test(t)) return { what: "cards that draw", count: (cs) => cs.filter((c) => /draw/.test(abil(c))).length, need: 2 };
  if (/add .*(hand|cards)|create|generate/.test(t)) return { what: "cards that add cards", count: (cs) => cs.filter((c) => hasTag(c, "S") || hasTag(c, "J") || /add (a|an|\d|two|three)|to your hand/.test(abil(c))).length, need: 3 };
  if (/(afflict|-\d+ power|negative power|lower)/.test(t)) return { what: "cards that lower Power", count: (cs) => cs.filter((c) => /-\d+ power|afflict/.test(abil(c))).length, need: 3 };
  if (/(buff|increase|\+\d+ power|gain power)/.test(t)) return { what: "cards that add Power", count: (cs) => cs.filter((c) => hasTag(c, "B") || /\+\d+ power/.test(abil(c))).length, need: 4 };
  if ((m = t.match(/spend (\d+) energy/))) return { what: "cards costing 4 or more", count: (cs) => cs.filter((c) => num(c.cost) >= 4).length, need: 4 };
  if (/win (matches|games)|win \d+ (matches|games)/.test(t)) return { what: "wins", rate: true, need: 1 };
  if (/play cards|play \d+ cards/.test(t)) return { what: "cheap cards", count: (cs) => cs.filter((c) => num(c.cost) <= 2).length, need: 4 };
  return null;
}
// How much each deck helps with these tasks (unfinished ones only); the best few come back with what helps
function bestDecksFor(tasks, limit = 3) {
  const decks = S.decks.filter((d) => d.status === "active" && arr(d.cards).length >= 6);
  const tests = tasks.filter((x) => x && !x.done).map((x) => ({ x, t: missionTest(x.text) })).filter((y) => y.t);
  if (!decks.length || !tests.length) return [];
  return decks.map((d) => {
    const cs = arr(d.cards).map(card); let score = 0; const helps = [];
    const st = statsFor(deckMatches(d)), wr = st.games >= 3 ? st.wr / 100 : 0.5;
    for (const { x, t } of tests) {
      const fit = t.rate ? wr : Math.min(1, t.count(cs) / t.need), w = x.hard ? 1.5 : 1;
      score += fit * w;
      if (!t.rate && fit >= 0.6) helps.push(`${x.text.replace(/^hard\s*:\s*/i, "")} (${t.count(cs)} ${t.what})`);
      if (t.rate && st.games >= 3 && wr >= 0.55) helps.push(`${x.text} (wins ${st.wr}%)`);
    }
    return { d, score, helps };
  }).filter((r) => r.helps.length).sort((a, b) => b.score - a.score).slice(0, limit);
}
function bestDecksHtml(tasks, title) {
  const best = bestDecksFor(tasks); if (!best.length) return "";
  return `<div class="panel stack small"><b>${esc(title)}</b>${best.map((r, i) => `<button class="li" data-a="deckOpen" data-id="${esc(r.d.id)}" style="align-items:flex-start">${deckCover(r.d)}<div class="grow stack" style="gap:2px;min-width:0"><div class="t">${i === 0 ? "★ " : ""}${esc(r.d.name)}</div><span class="muted small">${r.helps.slice(0, 4).map(esc).join(" · ")}</span></div></button>`).join("")}
    <span class="muted small">Picked from your Ready decks by what each mission asks for${tasks.some((x) => /win/i.test(x.text)) ? " and how often the deck wins" : ""}.</span></div>`;
}
function missionPlanHtml() {
  const G = obj(S.gameMissions), now = Date.now();
  const daily = obj(G.daily).day === gameDay() ? arr(G.daily.items) : [];
  const weekly = G.weekly && (!G.weekly.endsAt || G.weekly.endsAt > now) ? arr(G.weekly.items) : [];
  const cs = currentSeason(), ch = obj(G.chapters).season === (cs ? cs.id : "") ? arr(G.chapters.list).flatMap((c) => arr(c.items).filter((i) => !i.unlocksAt || i.unlocksAt < now)) : [];
  return bestDecksHtml([...daily, ...weekly, ...ch], "Best decks for your missions right now");
}

/* ---------- Season pass pace ---------- */
const PASS_XP = 1000; // points per level, as the game shows (368/1,000)
function notePass(sid, level, xp, xpNext, time) {
  if (!sid || !(level > 0)) return;
  const L = (S.passLog = obj(S.passLog)), log = arr(L[sid]);
  const per = xpNext > 0 ? xpNext : PASS_XP, total = (level - 1) * per + Math.max(0, num(xp));
  const last = log[log.length - 1];
  if (last && last.total === total) return;
  if (last && time - last.t < 30 * 60e3) log.pop();  // one point per half hour is plenty
  log.push({ t: time || Date.now(), total, level }); L[sid] = log.slice(-60);
}
function passPace(s) {
  const p = obj(S.passes[s.id]), log = arr(obj(S.passLog)[s.id]); if (!num(p.level)) return null;
  const per = num(p.xpNext) || PASS_XP, now = Date.now(), daysLeft = Math.max(0, (s.endTs - now) / DAY);
  const total = (num(p.level) - 1) * per + num(p.xp);
  const first = log.find((e) => now - e.t < 21 * DAY) || log[0], last = log[log.length - 1];
  // When the level now was read (from a screenshot), or now if you set it yourself
  const lastT = Math.max(num(p.xpAt), num(p.levelAt)) || now;
  const days = first ? (lastT - first.t) / DAY : 0;
  const perDay = first && days >= 0.75 && total > first.total ? (total - first.total) / days : 0;
  const daysAfter = Math.max(0, (s.endTs - Math.min(now, lastT || now)) / DAY);
  const of = num(s.passLevels) || 50, goalLevel = num(p.level) < of ? of : of + (p.tier === "plus" ? 10 : 0);
  const needXp = Math.max(0, (goalLevel - 1) * per - total);
  return { level: num(p.level), perDay: Math.round(perDay), endLevel: perDay ? Math.floor((total + perDay * daysAfter) / per) + 1 : 0, daysLeft, goalLevel, needPerDay: daysLeft > 0 ? Math.ceil(needXp / Math.max(0.5, daysLeft)) : 0, needXp, done: num(p.level) >= goalLevel };
}
function passPaceHtml(s) {
  const r = passPace(s); if (!r) return "";
  const goal = r.goalLevel > (num(s.passLevels) || 50) ? `bonus level ${r.goalLevel}` : `level ${r.goalLevel}`;
  return `<span class="small">${r.done ? `You've reached ${esc(goal)}. Bonus levels keep giving rewards.` : `${esc(goal[0].toUpperCase() + goal.slice(1))} needs about <b>${fmt(r.needPerDay)}</b> pass XP a day (${fmt(r.needXp)} to go).`}${r.perDay ? ` At your pace (${fmt(r.perDay)} a day) you'll reach level <b>${r.endLevel}</b> by the end.` : r.done ? "" : " Your pace shows once SNAP Stat has seen your pass on two different days."}</span>`;
}

/* ---------- Alerts for great bundles and ones with a variant on your wishlist ---------- */
function bundleVariantHits(contents) {
  const out = [];
  for (const line of arr(contents)) {
    const t = String(line || "").replace(/\s*(&|and)\s*avatar\b/i, "").replace(/\s+variant\b.*$/i, "").trim(); if (!t || !/variant/i.test(String(line))) continue;
    const words = t.split(/\s+/); let c = null, rest = "";
    for (let n = Math.min(words.length, 6); n >= 1 && !c; n--) { const f = cardByName(words.slice(0, n).join(" ")); if (f) { c = f; rest = words.slice(n).join(" "); } }
    if (!c) continue;
    const v = matchVariant(c.key, rest, rest);
    if (v && v.wish && !v.owned) out.push(`${c.name} ${rest}`.trim());
    else if (!v && S.wishCards[c.key] && !S.owned[c.key]) out.push(c.name);
  }
  return out;
}
function checkBundleAlerts() {
  if (S.bundleAlerts === false || !dataReady()) return;
  const told = new Set(arr(S.bundleTold)), now = Date.now(), fresh = [];
  const web = arr(WEBSHOP.data && WEBSHOP.data.offers).filter((o) => o.until > now && o.from <= now && o.price && !/baseline_gold|free_rewards|gold_pass/.test(o.group)).map((o) => ({ key: "w:" + o.key + ":" + o.from, name: o.name, price: "$" + o.price.toFixed(2), contents: o.contents, where: "web shop" }));
  const game = Object.entries(obj(S.gameBundles)).filter(([, b]) => !b.endsAt || b.endsAt > now).map(([k, b]) => ({ key: "g:" + k, name: b.name, price: b.price, contents: b.contents, where: "game shop" }));
  for (const b of [...web, ...game]) {
    if (told.has(b.key)) continue;
    const wish = bundleVariantHits(b.contents), v = bundleValue(b.price, b.contents);
    if (wish.length) fresh.push({ b, why: `has ${wish.slice(0, 2).join(" and ")} from your wishlist` });
    else if (v.pct >= 200) fresh.push({ b, why: `is ${v.pct}% value (${fmt(v.gold)} Gold of currencies for ${b.price})` });
    else continue;
    told.add(b.key);
  }
  S.bundleTold = [...told].slice(-150);
  if (!fresh.length) return;
  save();
  const top = fresh.slice(0, 3);
  notifyNow(fresh.length === 1 ? `${top[0].b.name} in the ${top[0].b.where}` : `${fresh.length} bundles worth a look`, top.map((f) => `${f.b.name} (${f.b.price}) ${f.why}`).join("\n"), "bundles:" + gameDay(), "#home/shops");
}
// Checked when the app opens, once the web shop list has loaded, and after each shop screenshot
setTimeout(() => whenDataReady(() => { let tries = 0; const t = setInterval(() => { if (WEBSHOP.data || ++tries > 20) { clearInterval(t); checkBundleAlerts(); } }, 1500); }), 4000);
function bundleAlertToggle() {
  return `<label class="toggle-row check small"><span>Tell me about bundles with a variant on my wishlist, or whose currencies alone are worth twice the price</span><input type="checkbox" data-bundlealert="1" ${S.bundleAlerts === false ? "" : "checked"}></label>`;
}
document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.bundlealert) { S.bundleAlerts = !!t.checked; save(); if (t.checked) checkBundleAlerts(); } });

/* ---------- Collector's Tokens: when you can afford what you want ---------- */
const FREE_TOKENS_DAY = 50; // the Token Packs tab's free daily tokens
function tokenPlanHtml() {
  const have = num(S.wallet.tokens), D = obj(S.dailyCards), daily = D.day === gameDay() ? arr(D.cards) : [];
  const items = [];
  for (const d of daily) {
    const c = fuzzyCard(d.card); if (!c || d.sold) continue;
    const v = d.variant ? matchVariant(c.key, d.variant, "") : null;
    const wished = v ? v.wish && !v.owned : S.wishCards[c.key] && !S.owned[c.key];
    if (d.pinned || wished) items.push({ name: c.name + (d.variant ? " · " + d.variant : ""), price: nIn((String(d.price).replace(/,/g, "").match(/\d+(?:\.\d+)?\s*[kK]?/) || [""])[0]) || 0, inShop: true, why: d.pinned ? "pinned" : "daily card, on your wishlist", k: c.key, v, soon: !d.pinned });
  }
  const seen = new Set(items.map((i) => i.k));
  for (const k of Object.keys(obj(S.wishCards)).filter((k) => S.wishCards[k] && !S.owned[k] && !seen.has(k))) { const c = card(k), p = tokenPrice(c); if (p) items.push({ name: c.name, price: p, why: `${seriesOf(c)}, on your wishlist`, k }); }
  const list = items.filter((i) => i.price > 0).sort((a, b) => a.price - b.price).slice(0, 8);
  if (!list.length) return "";
  const cl = obj(S.clNext), clTokens = (String(cl.reward || "").replace(/,/g, "").match(/(\d+)\s*collector/i) || [])[1];
  const clLeft = cl.left ? cl.left - Math.max(0, num(S.me.colLevel) - num(cl.cl)) : 0;
  return `<h3>Token planner</h3><div class="list">${list.map((i) => { const short = Math.max(0, i.price - have), days = Math.ceil(short / FREE_TOKENS_DAY);
      return `<div class="li"><div class="grow stack" style="gap:2px;min-width:0"><div class="row between nowrap"><b class="t">${esc(i.name)}</b><span class="num small">${fmt(i.price)}</span></div>
        <span class="muted small">${esc(i.why)} · ${short ? `${fmt(short)} tokens short: about ${days} day${days === 1 ? "" : "s"} of free daily tokens${clTokens && clLeft > 0 ? `, or sooner with the ${fmt(Number(clTokens))} tokens ${clLeft} Collection Level${clLeft === 1 ? "" : "s"} away` : ""}${i.soon ? " (daily cards change each day, so pin it to keep it)" : ""}` : (i.inShop ? "you can buy it now" : "you have enough: buy it in the Card Shop or a Token pack")}</span></div>${short ? "" : `<span class="pill W">Ready</span>`}</div>`; }).join("")}</div>
    <span class="muted small">You have ${fmt(have)} Collector's Tokens${S.walletAt ? ` (as of ${esc(agoTxt(S.walletAt))})` : ""}, and the Token Packs tab gives ${FREE_TOKENS_DAY} free a day.</span>`;
}

/* ---------- Bounties: a deck for each ---------- */
function bountyDeckLine(b) {
  const best = bestDecksFor([{ text: b.text, done: !!(b.goal && num(b.progress) >= b.goal) }], 1)[0];
  return best ? `<span class="small">Try <button class="linkbtn" data-a="deckOpen" data-id="${esc(best.d.id)}">${esc(best.d.name)}</button> <span class="muted">(${esc(best.helps[0].replace(/^.*\(/, "").replace(/\)$/, ""))})</span></span>` : "";
}
