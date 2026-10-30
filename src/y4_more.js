/* ============ Track & play, the web shop, your numbers, event passes, your alliance, deck tags ============ */

/* ---------- Track & play (Android app) ---------- */
function trackerHomeHtml() {
  if (!NATIVE) return "";
  const i = natInfo(), q = num(i.queue), play = natCan("trackAndPlay");
  return `<section class="sec"><div class="panel stack small trk"><div class="row between"><b>Match tracker</b>${i.tracking ? `<span class="pill W">Tracking</span>` : `<span class="pill dim">Off</span>`}</div>
    <span class="muted">${i.tracking ? `${num(i.captured) ? `${fmt(i.captured)} match${num(i.captured) === 1 ? "" : "es"} saved so far. ` : ""}Play as usual: your matches${natCan("trackAndPlay") ? ", alliance, event passes and shops" : ""} are saved as you go, and SNAP Stat updates everything when you come back to it.`
      : `${play ? "Starts the tracker and opens MARVEL SNAP for you." : "Watches for the end of each match while you play."} Your matches${play ? ", alliance screens, event passes and shops" : ""} are saved as you play and read when you come back.`}</span>
    <div class="row">${i.tracking ? `${i.snap ? `<button class="btn snap" data-a="natSnap">Open MARVEL SNAP</button>` : ""}<button class="btn" data-a="natTrack" data-v="0">Stop tracking</button>` : `<button class="btn snap" data-a="natPlay">${play ? "Track & play" : "Start tracking"}</button>`}</div>
    ${q ? `<p class="note">${fmt(q)} picture${q === 1 ? "" : "s"} waiting to be read. ${canReadShots() ? `<button class="btn sm" data-a="natPull">Read now</button>` : "Add an AI key in Settings › AI to read them."}</p>` : ""}
    ${!aiOn() ? `<span class="muted">Add your AI key in Settings › AI so what it saves can be read.</span>` : ""}
    ${obj(S.sweep).at ? "" : `<button class="linkbtn small" data-a="sweepOpen">Update everything: a quick walk through the game ›</button>`}</div></section>`;
}

/* ---------- The web shop and its free daily credits ---------- */
const WEB_SHOP = "https://shop.marvelsnap.com/";
const webshopClaimed = () => obj(S.webshop).claimed === gameDay();
function openWebShop() {
  S.webshop = { ...obj(S.webshop), opened: gameDay() }; save();
  if (natCan("openWebShop")) NATIVE.openWebShop(); else if (NATIVE && natCan("openUrl")) NATIVE.openUrl(WEB_SHOP); else window.open(WEB_SHOP, "_blank", "noopener");
  render();
}
function webshopHtml() {
  const done = webshopClaimed(), opened = obj(S.webshop).opened === gameDay(), next = nextDailyReset();
  return `<section class="sec"><div class="panel row between nowrap webshop"><div class="stack" style="gap:2px;min-width:0"><b>Web shop</b>
      <span class="small ${done ? "pos" : "muted"}">${done ? `✓ Free credits claimed today · more in ${cdSpan(next)}` : "Free credits waiting today"}</span></div>
    <div class="row nowrap">${done ? `<button class="btn sm ghost" data-a="webshopUnclaim" aria-label="Not claimed yet">Undo</button>` : opened ? `<button class="btn sm" data-a="webshopClaimed">I claimed them</button>` : ""}<button class="btn sm snap" data-a="webshopOpen">Open</button></div></div></section>`;
}
// A notification or widget can open #webshop.
window.addEventListener("hashchange", () => { if (location.hash === "#webshop") { history.replaceState(null, "", "#home"); openWebShop(); } });
if (location.hash === "#webshop") setTimeout(() => { history.replaceState(null, "", "#home"); openWebShop(); }, 1500);

/* ---------- Your numbers ---------- */
function totalBoosters() { return Object.entries(obj(S.prog)).reduce((t, [k, p]) => t + (S.owned[k] && p && p.b !== null && p.b !== undefined ? num(p.b) : 0), 0); }
// The next big Collection Level reward the game showed, counted down as your Collection Level goes up
function clNextText() {
  const c = obj(S.clNext); if (!c.left || !c.reward) return "";
  const left = c.left - Math.max(0, num(S.me.colLevel) - num(c.cl));
  return left > 0 ? `${esc(c.reward.replace(/collector'?s tokens?/i, "tokens").replace(/\d{4,}/g, (d) => fmt(Number(d))))} in ${fmt(left)} level${left === 1 ? "" : "s"}` : "";
}
function numbersHtml() {
  const w = S.wallet, cs = currentSeason();
  const seasonCubes = cs ? statsFor(inPeriod(realMatches(), { from: cs.startTs, to: cs.endTs })).cubes : 0;
  const c0 = typeof climbNow === "function" ? climbNow() : null, c = c0 && !c0.stale ? c0 : null;
  const tile = (k, v, to, sub) => `<button data-a="go" data-to="${to}"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ""}</button>`;
  const tb = totalBoosters(), at = num(S.walletAt);
  return `<section class="sec"><div class="sec-h"><h2>Your numbers</h2>${shotInput("numbers")}</div>
    <div class="wallet nums">${tile("Credits", fmt(w.credits), "home/shops")}${tile("Gold", fmt(w.gold), "home/shops")}${tile("Collector's Tokens", fmt(w.tokens), "home/shops")}
      ${tile("Collection Lvl", S.me.colLevel ? fmt(S.me.colLevel) : "—", "profile", clNextText())}${tile("Card boosters", tb ? fmt(tb) : "—", "cards/progress", tb ? "on cards you've noted" : "")}${tile("Wild Boosters", fmt(w.wild), "home/shops")}
      ${tile("Split Reroll Coins", fmt(w.rerolls), "home/shops")}${tile("Cubes this season", signed(seasonCubes), "home/stats", c ? `rank ${esc(String(c.rank >= 100 ? "Infinite" : c.rank))}${c.rank < 100 ? ` · ${num(c.cubes)} toward next` : ""}` : "")}${w.medals ? tile("Conquest medals", fmt(w.medals), "home/shops") : ""}</div>
    ${freebiesHtml()}
    <p class="muted small">${at ? `From your screenshots, last updated ${esc(agoTxt(at))}. ` : ""}Screenshots of the shop, your collection, a card or the season pass update these. With the Android tracker on, they're picked up while you play. Tap a number to type it in yourself.</p></section>`;
}

/* ---------- Event passes: level, XP to the next milestone, the event's currency and collectibles ---------- */
function eventPassHtml(e, compact) {
  const pr = obj(S.eventProg[e.id]), levels = num(e.passLevels) || num(pr.levels);
  const lv = num(pr.level), xp = num(pr.xp), need = num(pr.xpNext);
  const items = collectibleItems(e), got = items.filter((it) => findCollectible(it, e.name, e.startTs).owned).length;
  const nextMs = arr(pr.ms).filter((m) => !m.claimed && num(m.level) > lv).sort((a, b) => num(a.level) - num(b.level))[0];
  const body = `${levels || lv ? `<div class="row between small"><span>Level <b class="num">${lv}</b>${levels ? ` / ${levels}` : ""}${pr.tier ? ` · ${esc(PASS_TIERS[pr.tier] || "")}` : ""}</span>${need ? `<span class="num">${fmt(xp)} / ${fmt(need)} ${esc(pr.xpName || "XP")}</span>` : ""}</div>
      ${need ? progBar(xp, need, `${fmt(need - xp)} ${pr.xpName || "XP"} to level ${lv + 1}`) : levels ? passBar(lv, levels) : ""}
      ${need ? `<span class="muted small">${fmt(Math.max(0, need - xp))} ${esc(pr.xpName || "XP")} to level ${lv + 1}${pr.next ? `: ${esc(pr.next)}` : ""}</span>` : pr.next ? `<span class="muted small">Next: ${esc(pr.next)}</span>` : ""}` : `<span class="muted small">Screenshot the event's pass and your level, XP and next reward fill in.</span>`}
    ${nextMs && !compact ? `<span class="small">Next milestone: level ${num(nextMs.level)}${nextMs.reward ? ` · ${esc(nextMs.reward)}` : ""}${nextMs.premium ? ` <span class="pill gold">Premium</span>` : ""}</span>` : ""}
    <div class="row small">${(arr(pr.curs).length ? pr.curs : obj(pr.cur).name ? [pr.cur] : []).map((c) => `<span class="pill dim" title="${c.use === "match" ? "earned in matches" : c.use === "shop" ? "spent in the event's shop" : ""}">${esc(c.name)}${c.use === "match" ? " (from matches)" : c.use === "shop" ? " (shop)" : ""}: <b class="num">${fmt(c.amount)}</b></span>`).join("")}${eventGainLine(e)}${items.length ? `<span class="pill dim">${got}/${items.length} collected</span>` : ""}${pr.at ? `<span class="muted">updated ${esc(agoTxt(pr.at))}</span>` : ""}</div>`;
  if (!compact && arr(pr.shop).length) return `<div class="stack" style="gap:6px">${body}${eventShopHtml(pr)}</div>`;
  return compact ? `<button class="li evpass" data-a="eventOpen" data-id="${esc(e.id)}"><div class="grow stack" style="gap:4px"><div class="row between"><b>${esc(e.name)}</b><span class="muted small">${endsTxt(e.endTs)}</span></div>${body}</div></button>` : `<div class="stack" style="gap:6px">${body}</div>`;
}
function eventsPassHome() {
  const live = events().filter((e) => timeState(e) === "live" && (num(e.passLevels) || obj(S.eventProg[e.id]).level || obj(S.eventProg[e.id]).xp || collectibleItems(e).length || /diner|pass/i.test(e.name)));
  if (!live.length) return "";
  return `<section class="sec"><div class="sec-h"><h2>Event progress</h2>${shotInput("numbers")}</div><div class="list">${live.slice(0, 3).map((e) => eventPassHtml(e, true)).join("")}</div></section>`;
}
function findEventByName(n) {
  const k = keyOf(n), ev = events().filter((e) => e.endTs > Date.now() - 10 * DAY && e.startTs < Date.now() + 2 * DAY);
  if (k) return ev.find((e) => keyOf(e.name) === k) || ev.find((e) => k.length > 4 && (keyOf(e.name).includes(k) || k.includes(keyOf(e.name)))) || null;
  return ev.filter((e) => timeState(e) === "live").length === 1 ? ev.find((e) => timeState(e) === "live") : null;
}
function applyShotEvent(x, e, time) {
  const ev = findEventByName(e.event || ""); if (!ev) { x.status = "An event screen, but I couldn't tell which event"; x.detail = String(e.event || ""); return; }
  const before = clone(obj(S.eventProg[ev.id])), pr = (S.eventProg[ev.id] = obj(S.eventProg[ev.id])), done = [];
  const n = (v) => nIn(v);
  // The home screen shows the season pass level beside the event's banner; that number isn't the event's level
  const cs = currentSeason(), seasonLv = cs ? num(obj(S.passes[cs.id]).level) : 0;
  const lvOk = n(e.level) !== null && !(n(e.levels) && n(e.level) > n(e.levels)) && !(seasonLv && n(e.level) === seasonLv && !n(e.xpNext) && !arr(e.milestones).length);
  if (lvOk) { pr.level = n(e.level); done.push(`level ${pr.level}`); }
  if (n(e.levels)) { pr.levels = n(e.levels); if (!lvOk) done.push(`${pr.levels} levels`); }
  if (n(e.xp) !== null) { pr.xp = n(e.xp); if (!n(e.xpNext)) done.push(`${fmt(pr.xp)} ${String(e.xpName || "XP").slice(0, 20)}`); }
  if (n(e.xpNext)) { pr.xpNext = n(e.xpNext); done.push(`${fmt(pr.xp)}/${fmt(pr.xpNext)} ${String(e.xpName || "XP").slice(0, 20)}`); }
  if (e.xpName) pr.xpName = String(e.xpName).slice(0, 24);
  // The event's currencies (Deadpool's Diner has more than one): all of them, and the main one for the widget
  const curs = [...arr(e.currencies).map(obj), obj(e.currency)].filter((c) => c.name && n(c.amount) !== null && !/^gold$/i.test(String(c.name).trim())).map((c) => ({ name: curName(c.name), amount: n(c.amount), use: curUse(c) }));
  const byName = new Map(arr(pr.curs).map((c) => [keyOf(c.name), c])); for (const c of curs) byName.set(keyOf(c.name), { ...obj(byName.get(keyOf(c.name))), ...c, use: c.use || obj(byName.get(keyOf(c.name))).use || "", at: time || Date.now() });
  if (curs.length) { pr.curs = [...byName.values()].sort((a, b) => (a.use === "match" ? 0 : 1) - (b.use === "match" ? 0 : 1)).slice(0, 6); pr.cur = pr.curs[0]; done.push([...new Map(curs.map((c) => [keyOf(c.name), c])).values()].map((c) => `${fmt(c.amount)} ${c.name}`).join(", ")); }
  const shop = arr(e.shop).map((i) => ({ name: String(obj(i).name || "").slice(0, 60), kind: String(obj(i).kind || "").slice(0, 12), price: n(obj(i).price), currency: curName(obj(i).currency || ""), sold: !!obj(i).sold })).filter((i) => i.name).slice(0, 40);
  if (shop.length) { const by = new Map(arr(pr.shop).map((i) => [keyOf(i.name), i])); shop.forEach((i) => by.set(keyOf(i.name), i)); pr.shop = [...by.values()].slice(0, 60); pr.shopAt = time || Date.now(); done.push(`${shop.length} shop item${shop.length === 1 ? "" : "s"}`); }
  if (e.nextReward) { pr.next = String(e.nextReward).slice(0, 80); done.push("next reward"); }
  const ms = arr(e.milestones).map((m) => ({ level: n(obj(m).level), reward: String(obj(m).reward || "").slice(0, 60), claimed: !!obj(m).claimed, premium: !!obj(m).premium })).filter((m) => m.level);
  if (ms.length) { const by = new Map(arr(pr.ms).map((m) => [m.level + (m.premium ? "p" : ""), m])); ms.forEach((m) => by.set(m.level + (m.premium ? "p" : ""), m)); pr.ms = [...by.values()].sort((a, b) => a.level - b.level).slice(0, 80); done.push(`${ms.length} milestone${ms.length === 1 ? "" : "s"}`); }
  let got = 0; const evItems = collectibleItems(ev);
  for (const c0 of arr(e.collectibles).slice(0, 30)) {
    const c = obj(c0), nm = String(c.name || "").slice(0, 60), nk = keyOf(nm); if (!nk || c.owned !== true) continue;
    const it = evItems.find((i) => keyOf(i.name) === nk) || evItems.find((i) => nk.length > 4 && (keyOf(i.name).includes(nk) || nk.includes(keyOf(i.name)))) || (c.kind === "card" && fuzzyCard(nm) ? { kind: "card", name: fuzzyCard(nm).name } : null);
    if (!it) continue;
    if (!findCollectible(it, ev.name, ev.startTs).owned) { setCollectible(it, ev.name, "owned", true, ev.startTs); got++; }
  }
  if (got) done.push(`${got} collectible${got === 1 ? "" : "s"} ticked`);
  if (!done.length) { S.eventProg[ev.id] = before; if (!Object.keys(before).length) delete S.eventProg[ev.id]; x.status = `${ev.name}: nothing I could read`; return; }
  pr.at = time || Date.now(); pr.played = true;
  x.status = `${ev.name} updated`; x.detail = done.join(" · "); x.undo = { type: "event", id: ev.id, before }; save();
  collSyncNow();
}

/* ---------- Your alliance: bounties, milestones, members and the leaderboard ---------- */
// The weekly reward tracks, from Marvel Snap Zone's alliance guide. Screenshots of the game update the next milestone.
const ALLY_TEAM_TRACK = [[16000, "25 Boosters"], [32000, "50 Credits"], [48000, "50 Credits"], [64000, "100 Credits"], [120000, "Mystery Variant"]];
const ALLY_MY_TRACK = [[500, "20 Boosters"], [800, "45 Boosters"], [1000, "65 Boosters"], [2000, "50 Credits"], [4000, "100 Credits"]];
function parseLeft(s) { const t = String(s || "").toLowerCase(); let ms = 0; for (const [, v, u] of t.matchAll(/(\d+)\s*([dhm])/g)) ms += Number(v) * (u === "d" ? DAY : u === "h" ? 3600e3 : 60e3); return ms; }
function applyShotAlliance(x, a, time) {
  time = time || Date.now();
  const D = (S.allianceData = obj(S.allianceData)), before = clone(D), done = [], meBefore = { alliance: S.me.alliance, points: S.alliance.points };
  const n = (v) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(String(v).replace(/,/g, ""))) ? Math.max(0, Math.round(Number(String(v).replace(/,/g, "")))) : null);
  if (a.name) { D.name = String(a.name).slice(0, 40); if (!S.me.alliance.trim()) S.me.alliance = D.name; }
  if (n(a.teamPoints) !== null || obj(a.nextMilestone).points) { D.team = { points: n(a.teamPoints) ?? num(obj(D.team).points), next: n(obj(a.nextMilestone).points) ? { points: n(a.nextMilestone.points), reward: String(a.nextMilestone.reward || "").slice(0, 40) } : obj(D.team).next || null, at: time }; done.push(`team ${fmt(D.team.points)} points`); }
  if (n(a.myPoints) !== null) { D.my = { points: n(a.myPoints), at: time }; S.alliance.points = n(a.myPoints); done.push(`you ${fmt(D.my.points)} points`); }
  const left = parseLeft(a.resetsIn); if (left > 0 && left < 8 * DAY) { D.endsAt = time + left; done.push("when the week resets"); }
  if (n(a.dropsLeft) !== null) { D.drops = { left: n(a.dropsLeft), at: time }; done.push(`${D.drops.left} drops left`); }
  const members = arr(a.members).map((m) => ({ name: String(obj(m).name || "").trim().slice(0, 30), role: String(obj(m).role || "").slice(0, 12), points: n(obj(m).points), cubes: n(obj(m).cubes), bounties: n(obj(m).bounties), score: n(obj(m).score), cl: n(obj(m).collectionLevel), rank: String(obj(m).rank || "").slice(0, 12) })).filter((m) => m.name);
  if (n(a.memberCount)) { D.count = n(a.memberCount); done.push(`${D.count} members`); }
  if (n(a.myNext)) { D.myNext = n(a.myNext); D.myNextAt = time; done.push("your next milestone"); }
  if (members.length) {
    // Pages of the list a few seconds apart add up; a new visit starts it again (so people who left drop off)
    const fresh = Math.abs(time - num(D.membersAt)) > 30 * 60e3;
    const by = new Map((fresh ? [] : arr(D.members)).map((m) => [keyOf(m.name), m]));
    for (const m of members) { const o = by.get(keyOf(m.name)) || {}; by.set(keyOf(m.name), { ...o, name: m.name, role: m.role || o.role || "", rank: m.rank || o.rank || "", ...Object.fromEntries(["points", "cubes", "bounties", "score", "cl"].map((f) => [f, m[f] ?? o[f] ?? null])), at: time }); }
    D.members = [...by.values()].sort((a, b) => num(b.at) - num(a.at)).slice(0, 30); D.membersAt = Math.max(time, num(D.membersAt)); done.push(`${members.length} member${members.length === 1 ? "" : "s"}`);
  }
  const bounties = arr(a.bounties).map((b) => ({ text: String(obj(b).text || "").trim().slice(0, 90), rarity: String(obj(b).rarity || "").slice(0, 12), points: n(obj(b).points), progress: n(obj(b).progress), goal: n(obj(b).goal), mine: !!obj(b).mine })).filter((b) => b.text);
  if (bounties.length) {
    // Pages of the same list (saved a few seconds apart while scrolling) add up; a new visit starts the list again.
    const fresh = Math.abs(time - num(D.bountiesAt)) > 30 * 60e3;
    const old = new Map(arr(D.bounties).map((b) => [keyOf(b.text) + (b.rarity || ""), b]));
    const merged = bounties.map((b) => ({ ...(old.get(keyOf(b.text) + (b.rarity || "")) || {}), ...b }));
    if (!fresh) { const seen = new Set(merged.map((b) => keyOf(b.text) + (b.rarity || ""))); for (const [k, b] of old) if (!seen.has(k)) merged.push(b); }
    D.bounties = merged.slice(0, 30); D.bountiesAt = Math.max(time, num(D.bountiesAt));
    const mineNow = bounties.filter((b) => b.mine).map((b) => keyOf(b.text));
    if (mineNow.length) D.mine = [...new Set(mineNow)].slice(0, 3);
    done.push(`${bounties.length} bount${bounties.length === 1 ? "y" : "ies"}`);
  }
  const board = arr(a.board).map((r) => ({ rank: n(obj(r).rank), name: String(obj(r).name || "").slice(0, 40), points: n(obj(r).points), cubes: n(obj(r).cubes), bounties: n(obj(r).bounties), mine: !!obj(r).mine })).filter((r) => r.name);
  if (board.length) {
    const fresh = Math.abs(time - num(D.boardAt)) > 30 * 60e3, by = new Map((fresh ? [] : arr(D.board)).map((r) => [keyOf(r.name), r]));
    for (const r of board) by.set(keyOf(r.name), { ...(by.get(keyOf(r.name)) || {}), ...r });
    D.board = [...by.values()].sort((a, b) => num(a.rank || 999) - num(b.rank || 999)).slice(0, 60); D.boardAt = Math.max(time, num(D.boardAt)); done.push(`leaderboard (${board.length})`);
  }
  if (!done.length) { S.allianceData = before; S.me.alliance = meBefore.alliance; x.status = "An alliance screen, but nothing I could read"; return; }
  D.at = time; x.status = "Alliance updated"; x.detail = done.join(" · "); x.undo = { type: "alliance", before, me: meBefore }; save();
}
// What's shared with your alliance: your copy of the alliance screens, in your public profile.
function allianceShare() {
  const D = obj(S.allianceData); if (!D.at) return null;
  return { name: String(D.name || S.me.alliance || "").slice(0, 40), at: num(D.at), team: D.team || null, my: D.my || null, endsAt: num(D.endsAt) || 0, members: arr(D.members).slice(0, 40), membersAt: num(D.membersAt), bounties: arr(D.bounties).slice(0, 30), bountiesAt: num(D.bountiesAt), board: arr(D.board).slice(0, 50), boardAt: num(D.boardAt), mine: arr(D.mine).slice(0, 3) };
}
// Everyone in your alliance who uses SNAP Stat shares what they've seen; the newest copy of each part wins.
function allianceView() {
  const mine = allyKey(S.me.alliance), own = allianceShare();
  const N = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v)))), T = (v, l) => String(v ?? "").slice(0, l);
  const clean = (c) => ({ uid: c.uid, at: num(c.at), endsAt: num(c.endsAt), membersAt: num(c.membersAt), bountiesAt: num(c.bountiesAt), boardAt: num(c.boardAt),
    team: c.team && typeof c.team === "object" ? { points: N(c.team.points), next: c.team.next && typeof c.team.next === "object" ? { points: N(c.team.next.points), reward: T(c.team.next.reward, 40) } : null, at: num(c.team.at) } : null,
    members: arr(c.members).map(obj).map((m) => ({ name: T(m.name, 30), role: T(m.role, 12), rank: T(m.rank, 12), points: N(m.points), cubes: N(m.cubes), bounties: N(m.bounties), score: N(m.score), cl: N(m.cl), at: num(m.at) })).filter((m) => m.name).slice(0, 40),
    bounties: arr(c.bounties).map(obj).map((b) => ({ text: T(b.text, 90), rarity: T(b.rarity, 12), points: N(b.points), progress: N(b.progress), goal: N(b.goal) })).filter((b) => b.text).slice(0, 30),
    board: arr(c.board).map(obj).map((r) => ({ rank: N(r.rank), name: T(r.name, 40), points: N(r.points), cubes: N(r.cubes), bounties: N(r.bounties), mine: !!r.mine })).filter((r) => r.name).slice(0, 60),
    mine: arr(c.mine).map((k) => T(k, 90)).slice(0, 3) });
  const copies = [own, ...Object.entries(shared.profiles).filter(([id, p]) => id !== store.uid && p && allyKey(p.alliance) === mine && p.allianceData && typeof p.allianceData === "object").map(([id, p]) => clean({ ...obj(p.allianceData), uid: id }))].filter((c) => c && (c.at || c.membersAt));
  const pick = (f, at) => copies.filter((c) => arr(c[f]).length || (c[f] && !Array.isArray(c[f]))).sort((a, b) => num(b[at || "at"]) - num(a[at || "at"]))[0];
  const m = pick("members", "membersAt"), b = pick("bounties", "bountiesAt"), bd = pick("board", "boardAt"), t = pick("team", "at");
  const onIt = Object.create(null); copies.forEach((c) => arr(c.mine).forEach((k) => { (onIt[k] = onIt[k] || []).push(c.uid ? handleOf(c.uid) : "You"); }));
  return { members: m ? arr(m.members) : [], membersAt: m ? num(m.membersAt) : 0, bounties: b ? arr(b.bounties) : [], bountiesAt: b ? num(b.bountiesAt) : 0, board: bd ? arr(bd.board) : [], boardAt: bd ? num(bd.boardAt) : 0,
    team: t ? t.team : null, endsAt: Math.max(0, ...copies.map((c) => num(c.endsAt)).filter((x) => x > Date.now())), onIt, copies: copies.length };
}
const nf = (v) => (v === null || v === undefined || v === "" ? "—" : fmt(v));
// The next milestone as the game shows it (from a screenshot), which beats the usual reward track when it's known.
function nextMsHtml(label, have, need, reward) {
  return `<div class="stack" style="gap:4px"><div class="row between small"><b>${label}</b><span class="num">${fmt(have)} / ${fmt(need)}</span></div>${progBar(have, need, label)}<span class="muted small">${fmt(Math.max(0, need - have))} points to go${reward ? ` · ${esc(reward)}` : ""}</span></div>`;
}
function trackHtml(track, have, label) {
  const next = track.find(([p]) => have < p), last = track[track.length - 1][0];
  return `<div class="stack" style="gap:4px"><div class="row between small"><b>${label}</b><span class="num">${fmt(have)} / ${fmt(next ? next[0] : last)}</span></div>${progBar(have, next ? next[0] : last, label)}
    <div class="ally-track">${track.map(([p, r]) => `<span class="${have >= p ? "done" : next && next[0] === p ? "next" : ""}"><b class="num">${p >= 1000 ? p / 1000 + "k" : p}</b>${esc(r)}</span>`).join("")}</div></div>`;
}
function allianceExtraHtml() {
  const V = allianceView(), D = obj(S.allianceData), mine = new Set(arr(D.mine));
  const resetAt = [num(D.endsAt), num(V.endsAt)].filter((t) => t && t <= Date.now()).sort((a, b) => b - a)[0] || 0, thisWeek = (at) => !resetAt || num(at) >= resetAt;
  if (V.team && !thisWeek(V.team.at)) V.team = null;
  const teamPts = num(obj(V.team).points) || 0, myPts = thisWeek(obj(D.my).at) ? num(obj(D.my).points) || num(S.alliance.points) : 0, myNext = thisWeek(D.myNextAt) && num(D.myNext) > myPts ? num(D.myNext) : 0;
  const sort = ui.allyMemSort || "points";
  const users = new Map(Object.entries(shared.profiles).filter(([, p]) => p && allyKey(p.alliance) === allyKey(S.me.alliance)).map(([id, p]) => [keyOf(p.handle), { id, p }]));
  if (S.me.handle) users.set(keyOf(S.me.handle), { id: store.uid, p: { handle: S.me.handle }, me: true });
  const mem = [...V.members].sort((a, b) => num(b[sort]) - num(a[sort]) || String(a.name).localeCompare(String(b.name)));
  const ms = (k, l) => `<button class="chip" data-a="allyMemSort" data-v="${k}" aria-pressed="${sort === k}">${l}</button>`;
  const when = (t) => (t ? `<span class="muted small">from a screenshot ${esc(agoTxt(t))}</span>` : "");
  return `<div class="panel stack"><div class="row between"><h3 style="margin:0">This week</h3>${V.endsAt > Date.now() ? `<span class="muted small">resets in ${cdSpan(V.endsAt)}</span>` : ""}</div>
      ${obj(V.team).next && num(V.team.next.points) > teamPts ? nextMsHtml("Alliance's next milestone", teamPts, V.team.next.points, V.team.next.reward) : trackHtml(ALLY_TEAM_TRACK, teamPts, "Alliance milestones")}
      ${myNext ? nextMsHtml("Your next milestone", myPts, myNext, "") : trackHtml(ALLY_MY_TRACK, myPts, "Your milestones")}
      <div class="row">${shotInput("numbers")}<span class="muted small">Screenshot the alliance's Bounties, Members and Leaderboard tabs (or play with the tracker on) to fill these in.</span></div></div>
    ${extHtml(EXT.alliance, { V, D, teamPts, myPts, myNext })}<div class="sec-h"><h3>Bounties</h3>${when(V.bountiesAt)}</div>
    ${V.bounties.length ? `<div class="list">${V.bounties.map((b) => { const k = keyOf(b.text), on = mine.has(k), who = arr(V.onIt[k]); return `<div class="li bounty"><div class="grow stack" style="gap:3px">
        <div class="row between nowrap"><span class="t">${esc(b.text)}</span>${b.rarity ? `<span class="pill ${/legend/i.test(b.rarity) ? "gold" : /epic/i.test(b.rarity) ? "live" : "dim"}">${esc(b.rarity)}</span>` : ""}</div>
        ${b.goal ? progBar(num(b.progress), b.goal, `${num(b.progress)} of ${b.goal}`) : ""}
        <span class="muted small">${b.points ? `${fmt(b.points)} points` : ""}${b.goal ? ` · ${num(b.progress)}/${b.goal}` : ""}${who.length ? ` · on it: ${esc(who.join(", "))}` : ""}</span>${bountyDeckLine(b)}</div>
        <button class="btn sm ${on ? "snap" : "ghost"}" data-a="allyMine" data-k="${esc(k)}" aria-pressed="${on}">${on ? "Mine" : "Take it"}</button></div>`; }).join("")}</div>
      <p class="muted small">You can have 3 bounties going at once and drop 3 a week${obj(D.drops).left !== undefined ? ` (${D.drops.left} drops left)` : ""}. Tap "Take it" so your alliance can see who's on what.</p>`
      : `<p class="muted small">No bounties yet. Screenshot the alliance's Bounties tab.</p>`}
    <div class="sec-h"><h3>Members</h3>${when(V.membersAt)}</div>
    ${mem.length ? `<div class="chips">${ms("points", "Points")}${ms("cubes", "Cubes")}${ms("score", "Score")}${ms("bounties", "Bounties")}</div>
      <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Player</th><th class="n">Points</th><th class="n">Cubes</th><th class="n">Bounties</th><th class="n">Score</th></tr></thead><tbody>${mem.map((m, i) => { const u = users.get(keyOf(m.name)); return `<tr><td class="num">${i + 1}</td><td>${u && !u.me ? `<button class="linkish" data-a="profileOpen" data-id="${esc(u.id)}">${esc(m.name)}</button>` : esc(m.name)}${u ? ` <span class="pill W" title="Uses SNAP Stat">S</span>` : ""}${m.role && !/^member$/i.test(m.role) ? ` <span class="muted small">${esc(m.role)}</span>` : ""}${m.rank || m.cl ? `<div class="muted small">${[m.rank ? (/^\d+$/.test(m.rank) ? "rank " + esc(m.rank) : esc(m.rank)) : "", m.cl ? "CL " + fmt(m.cl) : ""].filter(Boolean).join(" · ")}</div>` : ""}</td><td class="n">${nf(m.points)}</td><td class="n">${nf(m.cubes)}</td><td class="n">${nf(m.bounties)}</td><td class="n">${nf(m.score)}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted small">${Math.min(mem.length, num(D.count) || 30)} of ${num(D.count) || "up to 30"} players, from the game's alliance screen. "S" means they use SNAP Stat.</p>`
      : `<p class="muted small">Screenshot the alliance's Members tab to see everyone's points, cubes and score, even players who don't use SNAP Stat.</p>`}
    <div class="sec-h"><h3>Alliance leaderboard</h3>${when(V.boardAt)}</div>
    ${V.board.length ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Alliance</th><th class="n">Points</th><th class="n">Cubes</th><th class="n">Bounties</th></tr></thead><tbody>${V.board.map((r) => `<tr${r.mine || allyKey(r.name) === allyKey(S.me.alliance) ? ' class="me"' : ""}><td class="num">${esc(r.rank ?? "")}</td><td>${esc(r.name)}</td><td class="n">${nf(r.points)}</td><td class="n">${nf(r.cubes)}</td><td class="n">${nf(r.bounties)}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muted small">Screenshot the game's alliance leaderboard to keep track of where you stand.</p>`}`;
}

/* ---------- Deck tags: titles you've collected, or your own words ---------- */
const DECK_TAG_IDEAS = ["Ladder", "Conquest", "Climbing", "Fun", "Budget", "Tech", "Meme", "Testing", "Draft", "Event"];
const deckTags = (d) => arr(d && d.tags).map(String).filter(Boolean).slice(0, 6);
function allDeckTags() { const c = {}; S.decks.forEach((d) => deckTags(d).forEach((t) => (c[t] = (c[t] || 0) + 1))); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([t]) => t); }
function deckTagsRow(d, small) {
  const t = deckTags(d); if (!t.length) return "";
  return `<span class="dtags ${small ? "sm" : ""}">${t.map((x) => `<span class="dtag">${esc(x)}</span>`).join("")}</span>`;
}
function deckTagsEdit(d) {
  return `<div class="stack" style="gap:6px"><span class="eyebrow">Deck tags</span><div class="chips flow">${deckTags(d).map((t, i) => `<button class="chip on dtag-x" data-a="dtagDel" data-i="${i}" aria-label="Remove ${esc(t)}">${esc(t)} ✕</button>`).join("")}${deckTags(d).length < 6 ? `<button class="chip" data-a="dtagOpen">${ICON.plus} Tag</button>` : ""}</div></div>`;
}
let dtq = "";
function deckTagSheet() {
  const d = deckEdit(); if (!d) return sheetHead("Deck not found");
  const have = new Set(deckTags(d).map(keyOf)), q = keyOf(dtq);
  const titles = S.cosmetics.filter((c) => c.kind === "title").sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || a.name.localeCompare(b.name));
  const arch = (() => { const cnt = {}; d.cards.map(card).forEach((c) => cardTags(c).forEach((t) => { if (ARCH_NAMES[t]) cnt[ARCH_NAMES[t]] = (cnt[ARCH_NAMES[t]] || 0) + 1; })); return Object.entries(cnt).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 4); })();
  const chip = (t) => `<button class="chip ${have.has(keyOf(t)) ? "on" : ""}" data-a="dtagAdd" data-v="${esc(t)}" ${have.has(keyOf(t)) ? "disabled" : ""}>${esc(t)}</button>`;
  const fit = (list) => list.filter((t) => !q || keyOf(t).includes(q));
  const ownNames = titles.filter((c) => c.owned).map((c) => c.name), ownKeys = new Set(ownNames.map(keyOf));
  const others = [...titles.filter((c) => !c.owned).map((c) => c.name), ...titleCatalog()].filter((t, i, a) => !ownKeys.has(keyOf(t)) && a.findIndex((x) => keyOf(x) === keyOf(t)) === i);
  const used = fit(allDeckTags().filter((t) => !have.has(keyOf(t)))), own = fit(ownNames), rest = q ? fit(others) : [];
  return `${sheetHead("Deck tags", `For ${esc(d.name)}. Up to 6.`)}
    <button class="btn sm" data-a="dkBack" data-v="">‹ Back to the deck</button>
    <span class="eyebrow">On this deck</span>${deckTags(d).length ? `<div class="chips flow">${deckTags(d).map((t, i) => `<button class="chip on" data-a="dtagDel" data-i="${i}" aria-label="Remove ${esc(t)}">${esc(t)} ✕</button>`).join("")}</div>` : `<span class="muted small">No tags yet. Pick some below or type your own.</span>`}
    <div class="row nowrap"><input type="text" id="dt-q" data-dtq="1" value="${esc(dtq)}" placeholder="Search or type your own tag" maxlength="42" style="flex:1;min-width:0" data-autofocus><button class="btn sm snap" data-a="dtagAdd" data-v="">Add</button></div>
    ${arch.length ? `<span class="eyebrow">From this deck's cards</span><div class="chips flow">${fit(arch).map(chip).join("")}</div>` : ""}
    ${used.length ? `<span class="eyebrow">Tags on your other decks</span><div class="chips flow">${used.map(chip).join("")}</div>` : ""}
    ${own.length ? `<span class="eyebrow">Titles you've collected</span><div class="chips flow">${own.slice(0, 60).map(chip).join("")}</div>` : ""}
    ${rest.length && q ? `<span class="eyebrow">Other titles</span><div class="chips flow">${rest.slice(0, 30).map(chip).join("")}</div>` : ""}
    <span class="eyebrow">Ideas</span><div class="chips flow">${fit(DECK_TAG_IDEAS).map(chip).join("")}</div>
    <p class="muted small">Tick the titles you've collected in Collection › Cosmetics › Titles and they show up here first.</p>`;
}
function deckTagFilterHtml() {
  const tags = allDeckTags(); if (!tags.length) return "";
  const f = ui.deckTag || "";
  return `<div class="chips">${[["", "Any tag"], ...tags.slice(0, 20).map((t) => [t, t])].map(([v, l]) => `<button class="chip" data-a="deckTagF" data-v="${esc(v)}" aria-pressed="${f === v}">${esc(l)}</button>`).join("")}</div>`;
}

/* ---------- Titles: every one in the game, so you can tick the ones you've collected ---------- */
const titleCatalog = () => arr(ART.data && ART.data.titles).filter((t) => typeof t === "string" && t && t.length <= 60);
// The game's own id for a title ("Title747") → its name, when the daily data has it
const titleById = (id) => { const t = obj(ART.data && ART.data.titleIds)[String(id || "")]; return typeof t === "string" && t.length <= 60 ? t : ""; };
const titleOwnedSet = () => new Set(S.cosmetics.filter((c) => c.kind === "title" && c.owned).map((c) => keyOf(c.name)));
function titleGallery() {
  const all = titleCatalog(); if (!all.length) return "";
  const own = titleOwnedSet(), q = keyOf(ui.titleQ), f = ui.titleF || "all", n = ui.titleN || 60;
  const list = all.filter((t) => (!q || keyOf(t).includes(q)) && (f === "all" || (f === "own") === own.has(keyOf(t))));
  const fchip = (v, l) => `<button class="chip" data-a="titleF" data-v="${v}" aria-pressed="${f === v}">${l}</button>`;
  return `<div class="panel stack"><div class="row between"><b>Every title</b><span class="muted small num">${all.filter((t) => own.has(keyOf(t))).length} of ${all.length} collected</span></div>
    <input type="search" id="tt-q" data-ui="titleQ" value="${esc(ui.titleQ || "")}" placeholder="Search titles" autocomplete="off">
    <div class="chips">${fchip("all", "All")}${fchip("own", "Collected")}${fchip("missing", "Not yet")}</div>
    ${list.length ? `<div class="chips flow">${list.slice(0, n).map((t) => { const o = own.has(keyOf(t)); return `<button class="chip ttl ${o ? "on" : ""}" data-a="titleOwn" data-v="${esc(t)}" aria-pressed="${o}">${o ? "✓ " : ""}${esc(t)}</button>`; }).join("")}</div>` : `<p class="muted small">No titles match.</p>`}
    ${list.length > n ? `<div><button class="btn sm" data-a="titleMore">Show more (${list.length - n} more)</button></div>` : ""}
    <p class="muted small">Tap each title you've collected to tick it. In the game they're in your profile › Titles. Ticked titles show up as deck tag ideas.</p></div>`;
}

/* ---------- Typing and taps ---------- */
document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.dtq) { dtq = t.value; const pos = t.selectionStart; refreshSheet(); const n = $("#dt-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* fine */ } } } });
Object.assign(A, {
  natPlay: async () => { if (!aiOn()) toast("Add an AI key too, so what the tracker saves can be read."); await natRules(); if (natCan("trackAndPlay")) NATIVE.trackAndPlay(); else NATIVE.startTracker(); setTimeout(() => { natInfo(); refreshView(); }, 900); },
  webshopOpen: () => openWebShop(),
  webshopClaimed: () => { S.webshop = { ...obj(S.webshop), claimed: gameDay() }; save(); render(); saveNotifyState(); toast("Nice. See you after tomorrow's reset."); },
  webshopUnclaim: () => { S.webshop = { ...obj(S.webshop), claimed: "" }; save(); render(); saveNotifyState(); },
  allyMemSort: (el) => { ui.allyMemSort = el.dataset.v; render(); },
  allyMine: (el) => {
    const D = (S.allianceData = obj(S.allianceData)), k = el.dataset.k, mine = arr(D.mine);
    if (mine.includes(k)) D.mine = mine.filter((x) => x !== k);
    else { if (mine.length >= 3) { toast("You can only have 3 bounties going. Untick one first."); return; } D.mine = [...mine, k]; }
    D.at = D.at || Date.now(); save(); render();
  },
  dtagOpen: () => { dtq = ""; openSheet(deckTagSheet); },
  dtagAdd: (el) => {
    const d = deckEdit(); if (!d) return;
    const t = String(el.dataset.v || dtq).trim().replace(/\s+/g, " ").slice(0, 42); if (!t) { toast("Type a tag first"); return; }
    const tags = deckTags(d); if (tags.some((x) => keyOf(x) === keyOf(t))) return; if (tags.length >= 6) { toast("Up to 6 tags"); return; }
    d.tags = [...tags, t]; dtq = ""; save(); refreshSheet();
  },
  dtagDel: (el) => { const d = deckEdit(); if (!d) return; d.tags = deckTags(d).filter((_, i) => i !== num(el.dataset.i)); save(); refreshSheet(); },
  deckTagF: (el) => { ui.deckTag = el.dataset.v; render(); },
  titleF: (el) => { ui.titleF = el.dataset.v; ui.titleN = 60; render(); },
  titleMore: () => { ui.titleN = (ui.titleN || 60) + 120; render(); },
  titleOwn: (el) => {
    const n = el.dataset.v; let c = S.cosmetics.find((x) => x.kind === "title" && keyOf(x.name) === keyOf(n));
    if (!c) { c = { id: uid(), kind: "title", name: n, source: "", owned: false, wish: false }; S.cosmetics.push(c); }
    c.owned = !c.owned; save(); render();
  },
});
