/* ============ y39_shops.js: shops and money (October 31, 2026) ============
   71 bundle value with your own priorities · 72 a monthly gold or money budget · 73 credit timers (free credits don't pile
   up) · 74 web shop vs in-game prices · 75 a Token shop rotation guess · 76 share your wishlist · 77 a free stuff checklist
   · 78 promo code reminders · 79 your spending history (private) · 80 "Is it worth it?" on a bundle screenshot.
   All of it is in Home › Shop helper (a new section). */
const y39Sec = (title, body, sub = "") => `<section class="sec"><div class="sec-h"><h2>${esc(title)}</h2>${sub ? `<span class="muted small">${sub}</span>` : ""}</div>${body}</section>`;
const y39Usd = (b) => (String(b.currency || "usd").toLowerCase() === "usd" ? num(b.price) : 0);
function y39Bundles() { try { return typeof ratedBundles === "function" ? ratedBundles().filter((b) => offerStartTs(b) <= Date.now()) : []; } catch { return []; } }

/* ---------- 71. Bundle value with your own priorities ---------- */
const PRI = [["variants", "Variants & avatars", /variant|avatar|border|card back|title/i], ["cards", "Series 4/5 cards & tokens", /series [45]|collector'?s? tokens?|spotlight/i], ["gold", "Gold", /gold(?! metallic)/i], ["credits", "Credits & boosters", /credits?|boosters?/i]];
const priW = (k) => clamp(num(obj(S.bundlePri)[k], 1), 0, 3);
function myValue(b) {
  const parts = arr(b.breakdown); if (!parts.length || !y39Usd(b)) return null; let mine = 0, base = 0;
  for (const p of parts) { const name = String(p[0] || ""), g = num(p[1]); base += g; const cat = PRI.find(([, , re]) => re.test(name)); const wish = S.variants.some((v) => v.wish && name.toLowerCase().includes(String(v.name || "").toLowerCase()) && String(v.name || "").length > 3) || Object.keys(S.wishCards).some((k) => S.wishCards[k] && name.toLowerCase().includes(card(k).name.toLowerCase())); mine += g * (cat ? priW(cat[0]) : 1) * (wish ? 1.5 : 1); }
  return { mine: Math.round((mine / goldForMoney(y39Usd(b))) * 100), base: Math.round((base / goldForMoney(y39Usd(b))) * 100) };
}
function priHtml() {
  const list = y39Bundles().map((b) => ({ b, v: myValue(b) })).filter((x) => x.v).sort((a, b) => b.v.mine - a.v.mine).slice(0, 8);
  return y39Sec("Bundles, valued your way", `<div class="panel stack small">${PRI.map(([k, l]) => `<div class="row between nowrap"><span>${esc(l)}</span><div class="seg y39-w" role="group" aria-label="${esc(l)}">${[0, 1, 2, 3].map((w) => `<button data-a="priSet" data-k="${k}" data-v="${w}" aria-pressed="${priW(k) === w}">${["Skip", "Normal", "More", "Most"][w]}</button>`).join("")}</div></div>`).join("")}<span class="muted">Wishlist items inside a bundle count 1.5× more.</span></div>
    ${list.length ? `<div class="list">${list.map(({ b, v }) => `<div class="li"><div class="grow"><div class="t">${esc(b.title)}</div><div class="s">${esc(bundlePrice(b))} · usual value ${v.base}%</div></div><span class="pill ${v.mine >= 200 ? "gold" : v.mine >= 120 ? "W" : v.mine >= 90 ? "dim" : "L"} num">${v.mine}%</span></div>`).join("")}</div><p class="muted small">100% = the same as buying gold with the money (80 gold per $1). Your priorities change the score.</p>` : `<div class="empty"><strong>No bundles with values right now</strong><span>Bundle values come with the daily data.</span></div>`}`);
}

/* ---------- 72. Monthly budget ---------- */
function monthSpend(month = localDate(Date.now()).slice(0, 7)) { const L = arr(S.spend).filter((x) => String(x.d || "").slice(0, 7) === month); return { usd: L.reduce((s, x) => s + (x.cur === "usd" ? num(x.amt) : 0), 0), gold: L.reduce((s, x) => s + (x.cur === "gold" ? num(x.amt) : 0), 0), n: L.length }; }
function budgetHtml() {
  const B = obj(S.budget), m = monthSpend(), leftUsd = num(B.usd) ? Math.max(0, num(B.usd) - m.usd) : 0, leftGold = num(B.gold) ? Math.max(0, num(B.gold) - m.gold) : 0;
  const fits = y39Bundles().filter((b) => (num(B.usd) && y39Usd(b) && y39Usd(b) <= leftUsd + 0.001) || (num(B.gold) && String(b.currency).toLowerCase() === "gold" && num(b.price) <= leftGold)).slice(0, 6);
  return y39Sec("Monthly budget", `<div class="grid2"><label class="f">Money a month ($)<input type="number" min="0" step="1" inputmode="decimal" data-bud="usd" value="${esc(num(B.usd) || "")}" placeholder="0"></label><label class="f">Gold a month<input type="number" min="0" step="100" inputmode="numeric" data-bud="gold" value="${esc(num(B.gold) || "")}" placeholder="0"></label></div>
    ${num(B.usd) || num(B.gold) ? `<div class="panel stack small">${num(B.usd) ? `<div><b>$${fmt(Math.round(m.usd * 100) / 100)}</b> of $${fmt(B.usd)} spent this month</div><div class="bar"><i style="width:${pct(m.usd, num(B.usd))}%"></i></div>` : ""}${num(B.gold) ? `<div><b>${fmt(m.gold)}</b> of ${fmt(B.gold)} gold spent</div><div class="bar"><i style="width:${pct(m.gold, num(B.gold))}%"></i></div>` : ""}
      ${fits.length ? `<span>Still fits: ${fits.map((b) => `<b>${esc(b.title)}</b> (${esc(bundlePrice(b))})`).join(", ")}</span>` : `<span class="muted">No current bundle fits what's left.</span>`}</div>` : `<span class="muted small">Set a budget and log what you buy below to see what still fits.</span>`}`);
}
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.bud) return; S.budget = { ...obj(S.budget), [t.dataset.bud]: Math.max(0, num(t.value)) }; save(); render(); });

/* ---------- 73. Credit timers ---------- */
function nextRefresh8h(now = Date.now()) { let t = nextDailyReset(now) - DAY; while (t <= now) t += 8 * 3600e3; return t; }
function creditHtml() {
  const r = nextRefresh8h(), d = nextDailyReset(), cr = num(S.wallet.credits), ws = typeof webshopClaimed === "function" ? webshopClaimed() : false;
  const ready = typeof readyUpgrades === "function" ? arr(readyUpgrades()).length : 0;
  return y39Sec("Credit timers", `<div class="list"><div class="li"><div class="grow"><div class="t">Free shop credits (25)</div><div class="s">They don't pile up: claim them before the next refresh</div></div><span class="num">${cdSpan(r)}</span></div>
    <div class="li"><div class="grow"><div class="t">Web shop free credits</div><div class="s">${ws ? "Claimed today ✓" : "Not claimed today"}</div></div><span class="num">${cdSpan(d)}</span></div>
    ${cr ? `<div class="li"><div class="grow"><div class="t">${fmt(cr)} credits saved up</div><div class="s">${ready ? `${ready} upgrade${ready === 1 ? "" : "s"} you can afford now` : "Spend them on upgrades for Collection Level"}</div></div><button class="btn sm" data-a="go" data-to="cards/progress">Upgrades</button></div>` : ""}</div>
    <label class="check small"><input type="checkbox" data-y39="creditRem" ${S.creditRem ? "checked" : ""}> Remind me 45 minutes before the free credits are lost</label>`);
}
EXT.alerts.push(function y39CreditAlerts(now = Date.now()) { if (!S.creditRem) return []; const r = nextRefresh8h(now); return [{ id: `credits:${r}`, at: r - 45 * 60e3, until: r, title: "Free credits waiting", body: "25 free credits in the shop go away at the next refresh. Grab them.", route: "#home/shops" }]; });

/* ---------- 74. Web shop vs in-game prices ---------- */
const y39Words = (s) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !/^(bundle|variant|avatar|boosters?|credits?|gold|with|and|the|from)$/.test(w)));
function webVsGame() {
  const web = arr(WEBSHOP.data && WEBSHOP.data.offers).filter((o) => o && !o.free && num(o.price) > 0 && (!o.until || o.until > Date.now()));
  const game = [...Object.values(obj(S.gameBundles)).map((b) => ({ name: b.name, price: num(String(b.price).replace(/[^0-9.]/g, "")), usd: /\$/.test(b.price), contents: arr(b.contents) })), ...y39Bundles().map((b) => ({ name: b.title, price: y39Usd(b), usd: !!y39Usd(b), contents: arr(b.breakdown).map((p) => p[0]) }))].filter((g) => g.usd && g.price > 0);
  const out = [];
  for (const w of web) { const ww = y39Words([w.name, ...arr(w.contents)].join(" ")); let best = null, bs = 0; for (const g of game) { const gw = y39Words([g.name, ...g.contents].join(" ")); const inter = [...ww].filter((x) => gw.has(x)).length, s = inter / Math.max(1, Math.min(ww.size, gw.size)); if (s > bs) { bs = s; best = g; } } if (best && bs >= 0.6) out.push({ w, g: best, save: Math.round((best.price - num(w.price)) * 100) / 100 }); }
  return { web, out };
}
function webVsHtml() {
  const x = webVsGame();
  if (!x.web.length) return y39Sec("Web shop vs the game", `<div class="empty"><strong>No web shop bundles right now</strong><span>They come with the daily data.</span></div>`);
  return y39Sec("Web shop vs the game", x.out.length ? `<div class="list">${x.out.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.w.name)}</div><div class="s">Web shop $${esc(num(r.w.price).toFixed(2))} · in the game $${esc(r.g.price.toFixed(2))}${num(r.w.points) ? ` · +${fmt(r.w.points)} Web Points` : ""}</div></div><span class="pill ${r.save > 0 ? "W" : r.save < 0 ? "L" : "dim"}">${r.save > 0 ? `save $${r.save.toFixed(2)}` : r.save < 0 ? `$${(-r.save).toFixed(2)} more` : "same"}</span></div>`).join("")}</div>`
    : `<p class="small">None of the ${x.web.length} web shop bundles match one in the game right now. The web shop usually costs less for the same thing and adds Web Points.</p>`);
}

/* ---------- 75. Token shop rotation guess ---------- */
function rotationGuess() {
  const by = {}; for (const x of typeof tokenShopReads === "function" ? tokenShopReads() : []) { const c = typeof fuzzyCard === "function" ? fuzzyCard(String(x.card)) : null; if (!c) continue; const day = localDate(x.ts); (by[c.key] = by[c.key] || new Set()).add(day); }
  const out = []; for (const [k, set] of Object.entries(by)) { const days = [...set].sort(); if (days.length < 2) continue; const gaps = []; for (let i = 1; i < days.length; i++) gaps.push((dayStart(days[i]) - dayStart(days[i - 1])) / DAY); const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length; if (avg < 1) continue; const next = dayStart(days[days.length - 1]) + avg * DAY; out.push({ k, seen: days.length, avg: Math.round(avg), next }); }
  return out.sort((a, b) => a.next - b.next);
}
function rotationHtml() {
  const l = rotationGuess(), wish = l.filter((x) => S.wishCards[x.k] || !S.owned[x.k]);
  return y39Sec("Token shop rotation guess", l.length ? `<div class="list">${(wish.length ? wish : l).slice(0, 10).map((x) => `<button class="li" data-a="cardOpen" data-k="${esc(x.k)}"><div class="grow"><div class="t">${esc(card(x.k).name)}${S.wishCards[x.k] ? ` <span class="pill gold">Wishlist</span>` : ""}</div><div class="s">seen ${x.seen} times, about every ${plural(x.avg, "day")}</div></div><span class="muted small">${x.next < Date.now() ? "due any day" : "around " + esc(dayStr(x.next))}</span></button>`).join("")}</div><p class="muted small">A guess from when you've seen each card in the Token shop. The more often you screenshot it, the better it gets.</p>`
    : `<div class="empty"><strong>Not enough sightings yet</strong><span>Each time you screenshot the Token shop (or Track & play sees it), SNAP Stat notes its cards. After a card shows up twice, it guesses when it comes back.</span></div>`);
}

/* ---------- 76. Share your wishlist ---------- */
function wishText() {
  const cards = Object.keys(S.wishCards).filter((k) => S.wishCards[k] && card(k).name).map((k) => card(k).name), vars = S.variants.filter((v) => v.wish).map((v) => `${card(v.card).name}: ${v.name}${v.artist ? " by " + v.artist : ""}`);
  return { cards, vars, text: [`${S.me.handle ? S.me.handle + "'s" : "My"} MARVEL SNAP wishlist`, cards.length ? `Cards: ${cards.join(", ")}` : "", vars.length ? `Variants:\n${vars.map((v) => "• " + v).join("\n")}` : "", "", "Made with SNAP Stat"].filter((x, i, a) => x || i === a.length - 2).join("\n") };
}
function wishShareHtml() {
  const w = wishText(), n = w.cards.length + w.vars.length;
  return y39Sec("Share your wishlist", n ? `<div class="panel stack small"><span>${plural(w.cards.length, "card")} and ${plural(w.vars.length, "variant")} on your wishlist.</span><div class="row"><button class="btn sm snap" data-a="wishShare">Share it</button><button class="btn sm" data-a="wishCopy">${ICON.copy} Copy</button></div>
    <label class="check"><input type="checkbox" data-y39="wishPublic" ${S.wishPublic ? "checked" : ""}> Show it on my profile (to players who can see my profile)</label></div>` : `<div class="empty"><strong>Your wishlist is empty</strong><span>Tap ♡ on cards and variants you want, then share the list with friends.</span></div>`);
}
EXT.profile.push(function y39WishOnProfile() { if (!S.wishPublic) return ""; const w = wishText(); if (!w.cards.length && !w.vars.length) return ""; return `<section class="sec"><h2>Wishlist</h2><div class="panel small"><div class="chiplist">${w.cards.slice(0, 20).map((n) => `<span class="pill">${esc(n)}</span>`).join("")}${w.vars.slice(0, 20).map((v) => `<span class="pill gold">${esc(v)}</span>`).join("")}</div></div></section>`; });
// What profiles share: added to the public profile only when switched on (respects private profiles like the rest of it)
const _y39Extras = profileExtras;
profileExtras = () => ({ ..._y39Extras(), wish: S.wishPublic ? { cards: wishText().cards.slice(0, 30), vars: wishText().vars.slice(0, 30).map((v) => v.slice(0, 80)) } : null }); // eslint-disable-line no-func-assign
EXT.playerSheet = arr(EXT.playerSheet);
EXT.playerSheet.push(function y39TheirWish(id, p, see) { const w = obj(p).wish; if (!w || see === false) return ""; const items = [...arr(w.cards), ...arr(w.vars)].slice(0, 30); return items.length ? `<div class="stack small"><span class="eyebrow">Their wishlist</span><div class="chiplist">${items.map((n) => `<span class="pill">${esc(String(n).slice(0, 60))}</span>`).join("")}</div></div>` : ""; });

/* ---------- 77. Free stuff checklist ---------- */
function freeList() {
  const gd = gameDay(), F = obj(S.freeDone); const done = (k) => F[k] === gd;
  const promos = typeof promoList === "function" ? promoList().filter((p) => p.status === "active" && !S.redeemed[p.id]) : [];
  return [["shopcredits", "Free credits in the shop (every 8 hours)", "home/shops"], ["tokens", "Free Collector's Tokens (daily)", "home/shops"], ["webshop", "Web shop free credits", "home/overview"], ["missions", "Daily missions", "home/missions"], ["pass", "Season pass rewards", "home/seasons"],
    ...promos.slice(0, 5).map((p) => [`promo:${p.id}`, `Promo code ${p.code}${p.reward ? " · " + p.reward : ""}`, "home/promos"])].map(([k, l, to]) => ({ k, l, to, done: k === "webshop" && typeof webshopClaimed === "function" && webshopClaimed() ? true : done(k) }));
}
function freeHtml() {
  const l = freeList(), n = l.filter((x) => x.done).length;
  return y39Sec("Free stuff today", `<div class="list">${l.map((x) => `<div class="li"><label class="check grow"><input type="checkbox" data-free="${esc(x.k)}" ${x.done ? "checked" : ""}> ${esc(x.l)}</label><button class="btn sm ghost" data-a="go" data-to="${esc(x.to)}" aria-label="Open">›</button></div>`).join("")}</div><p class="muted small">${n} of ${l.length} done · ticks clear at the daily reset (${cdSpan(nextDailyReset())}).</p>`);
}
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.free) return; const k = t.dataset.free, F = obj(S.freeDone); if (k.startsWith("promo:")) { const id = k.slice(6); if (t.checked) S.redeemed[id] = true; else delete S.redeemed[id]; } if (k === "webshop" && t.checked) { S.webshop = { ...obj(S.webshop), claimed: gameDay() }; } if (t.checked) F[k] = gameDay(); else delete F[k]; S.freeDone = F; save(); render(); });

/* ---------- 78. Promo code reminders ---------- */
function promoRemHtml() {
  const list = typeof promoList === "function" ? promoList().filter((p) => p.status !== "expired") : []; if (!list.length) return "";
  const todo = list.filter((p) => !S.redeemed[p.id]);
  return y39Sec("Promo codes to redeem", todo.length ? `<div class="list">${todo.slice(0, 8).map((p) => { const exp = Date.parse(p.expires || ""), age = p.firstSeen ? Math.round((Date.now() - dayStart(p.firstSeen)) / DAY) : null; return `<div class="li"><div class="grow"><div class="t num">${esc(p.code)}</div><div class="s">${esc(p.reward || "")}${Number.isFinite(exp) ? ` · expires ${cdSpan(exp)}` : age !== null ? ` · found ${age ? plural(age, "day") + " ago" : "today"}${p.checked ? `, still working on ${esc(dateStr(p.checked))}` : ""}` : ""}</div></div><button class="btn sm" data-a="promoCopy39" data-v="${esc(p.code)}">${ICON.copy}</button><button class="btn sm ghost" data-a="promoDone39" data-id="${esc(p.id)}" aria-label="Redeemed">✓</button></div>`; }).join("")}</div>
    <label class="check small"><input type="checkbox" data-y39="promoRem" ${S.promoRem === false ? "" : "checked"}> Remind me about new codes</label><p class="muted small">Codes don't say when they end, so redeem them soon. Redeem in MARVEL SNAP: Settings › Redeem code.</p>` : `<p class="muted small">You've redeemed every working code. ✓</p>`);
}
EXT.alerts.push(function y39PromoAlerts(now = Date.now()) { if (S.promoRem === false || typeof promoList !== "function") return []; return promoList().filter((p) => p.status === "active" && !S.redeemed[p.id] && p.firstSeen && now - dayStart(p.firstSeen) < 10 * DAY).slice(0, 3).map((p) => ({ id: `promo:${p.code}`, at: Math.max(dayStart(p.firstSeen), now - DAY), until: dayStart(p.firstSeen) + 10 * DAY, title: "A promo code to redeem", body: `${p.code}${p.reward ? ": " + p.reward : ""}. Redeem it before it stops working.`, route: "#home/shophelp" })); });

/* ---------- 79. Spending history (private) ---------- */
function spendHtml() {
  const L = arr(S.spend).slice().sort((a, b) => String(b.d).localeCompare(String(a.d))), months = {};
  L.forEach((x) => { const m = String(x.d).slice(0, 7); const o = (months[m] = months[m] || { usd: 0, gold: 0 }); if (x.cur === "usd") o.usd += num(x.amt); else o.gold += num(x.amt); });
  return y39Sec("What you've bought", `<div class="panel stack small"><div class="grid2"><label class="f">What<input type="text" data-sp="what" maxlength="60" value="${esc(ui.spWhat || "")}" placeholder="Like Spooky Sale bundle"></label><label class="f">When<input type="date" data-sp="d" value="${esc(ui.spD || localDate(Date.now()))}"></label></div>
      <div class="grid2"><label class="f">Amount<input type="number" min="0" step="0.01" inputmode="decimal" data-sp="amt" value="${esc(ui.spAmt || "")}"></label><label class="f">In<select data-sp="cur"><option value="usd" ${ui.spCur !== "gold" ? "selected" : ""}>$ (money)</option><option value="gold" ${ui.spCur === "gold" ? "selected" : ""}>Gold</option></select></label></div>
      <button class="btn sm snap" data-a="spAdd">Add</button><span class="muted">Only you see this. No card or bank details, ever: just what, when and how much.</span></div>
    ${Object.keys(months).length ? `<div class="list">${Object.entries(months).slice(0, 12).map(([m, o]) => `<div class="li"><div class="grow"><div class="t">${esc(new Date(m + "-15T12:00").toLocaleDateString(undefined, { month: "long", year: "numeric" }))}</div><div class="s">${L.filter((x) => String(x.d).startsWith(m)).map((x) => esc(x.what)).slice(0, 4).join(", ")}</div></div><b class="num">${o.usd ? "$" + (Math.round(o.usd * 100) / 100).toFixed(2) : ""}${o.usd && o.gold ? " · " : ""}${o.gold ? fmt(o.gold) + " gold" : ""}</b></div>`).join("")}</div>
      <details class="small"><summary>Every purchase (${L.length})</summary><div class="list">${L.slice(0, 100).map((x) => `<div class="li"><div class="grow"><div class="t">${esc(x.what)}</div><div class="s">${esc(dateStr(x.d))}</div></div><span class="num">${x.cur === "usd" ? "$" + num(x.amt).toFixed(2) : fmt(x.amt) + " gold"}</span><button class="x" data-a="spDel" data-id="${esc(x.id)}" aria-label="Remove">✕</button></div>`).join("")}</div></details>` : ""}`);
}
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.sp) return; ui["sp" + t.dataset.sp[0].toUpperCase() + t.dataset.sp.slice(1)] = t.value; });
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.sp) return; ui["sp" + t.dataset.sp[0].toUpperCase() + t.dataset.sp.slice(1)] = t.value; });

/* ---------- 80. "Is it worth it?" from a bundle screenshot ---------- */
const wi80 = { busy: false, res: null, err: "" };
function shrinkImage(file, max = 1280) {
  return new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas"); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv.toDataURL("image/jpeg", 0.85).split(",")[1]); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That picture couldn't be opened")); }; img.src = url; });
}
async function worthCheck(file) {
  if (!aiOn()) { wi80.err = "Add an AI key in Settings › AI first."; render(); return; }
  wi80.busy = true; wi80.err = ""; wi80.res = null; render();
  try {
    const data = await shrinkImage(file);
    const wish = [...Object.keys(S.wishCards).filter((k) => S.wishCards[k]).map((k) => card(k).name), ...S.variants.filter((v) => v.wish).map((v) => `${card(v.card).name} ${v.name}`)].slice(0, 30);
    const out = await aiJson(`This is a screenshot of a MARVEL SNAP shop bundle. Read its name, price and contents, then judge its value. Value rule: 80 Gold is worth $1; 1 Credit ≈ 0.8 Gold; 1 Collector's Token ≈ 1.25 Gold; a regular variant ≈ 700 Gold; a Series 5 card ≈ 5000 Gold. The player owns ${Object.keys(S.owned).length} cards and wants: ${wish.join(", ") || "nothing listed"}.
Reply as JSON: {"name": "bundle name", "price": "price as shown", "contents": ["item", "..."], "goldValue": number, "valuePct": number (goldValue compared with the gold the same money buys, as a percent), "verdict": "Great value" | "Good value" | "Fair" | "Poor value", "why": "one or two plain sentences, mentioning anything on their wishlist"}`, { images: [{ media_type: "image/jpeg", data }] });
    wi80.res = { name: String(obj(out).name || "").slice(0, 80), price: String(obj(out).price || "").slice(0, 30), contents: arr(obj(out).contents).map((x) => String(x).slice(0, 80)).slice(0, 12), pct: Math.round(num(obj(out).valuePct)), verdict: String(obj(out).verdict || "").slice(0, 20), why: String(obj(out).why || "").slice(0, 300) };
  } catch (e) { wi80.err = typeof aiErr === "function" ? aiErr(e) : errText(e); }
  wi80.busy = false; render();
}
function worthHtml() {
  const r = wi80.res;
  return y39Sec("Is it worth it?", `<div class="panel stack small"><p>Screenshot any bundle in the game and get a value check from your own AI.</p>
    <label class="btn ${aiOn() ? "snap" : ""} ${wi80.busy ? "disabled" : ""}">${wi80.busy ? "Checking…" : "Choose a bundle screenshot"}<input type="file" accept="image/*" data-y39worth="1" hidden ${wi80.busy ? "disabled" : ""}></label>
    ${!aiOn() ? `<span class="muted">Needs an AI key. <button class="linkbtn" data-a="go" data-to="settings/ai">Set up AI</button></span>` : ""}
    ${wi80.err ? `<p class="note">${esc(wi80.err)}</p>` : ""}
    ${r ? `<div class="panel stack"><div class="row between"><b>${esc(r.name || "The bundle")}</b><span class="pill ${/great/i.test(r.verdict) ? "gold" : /good/i.test(r.verdict) ? "W" : /poor/i.test(r.verdict) ? "L" : "dim"}">${esc(r.verdict || "Checked")}${r.pct ? ` · ${r.pct}%` : ""}</span></div>${r.price ? `<span class="muted">${esc(r.price)}</span>` : ""}${r.contents.length ? `<span>${esc(r.contents.join(" · "))}</span>` : ""}${r.why ? `<span>${esc(r.why)}</span>` : ""}</div>` : ""}</div>`);
}
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y39worth || !t.files || !t.files[0]) return; worthCheck(t.files[0]); t.value = ""; });

/* ---------- Where it shows ---------- */
const SHOP_TABS = [["free", "Free stuff", freeHtml], ["value", "Bundle value", priHtml], ["budget", "Budget", () => budgetHtml() + spendHtml()], ["credits", "Credits", creditHtml], ["web", "Web vs game", webVsHtml], ["tokens", "Token shop guess", rotationHtml], ["promos", "Promo codes", () => promoRemHtml() || y39Sec("Promo codes to redeem", `<p class="muted small">No working codes right now.</p>`)], ["wish", "Share wishlist", wishShareHtml], ["worth", "Worth it?", worthHtml]];
EXT.homeSubs.push(["shophelp", "Shop helper", () => { const cur = SHOP_TABS.find(([k]) => k === ui.shopTab) || SHOP_TABS[0]; return `<section class="sec"><div class="chips y39-tabs">${SHOP_TABS.map(([k, l]) => `<button class="chip" data-a="shopTab" data-v="${k}" aria-pressed="${k === cur[0]}">${esc(l)}</button>`).join("")}</div></section>${cur[2]()}`; }]);
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y39) return; S[t.dataset.y39] = !!t.checked; save(); render(); });

/* ---------- Taps ---------- */
Object.assign(A, {
  shopTab: (el) => { ui.shopTab = el.dataset.v; render(); },
  priSet: (el) => { S.bundlePri = { ...obj(S.bundlePri), [el.dataset.k]: num(el.dataset.v, 1) }; save(); render(); },
  wishShare: async () => { const t = wishText().text; if (navigator.share) { try { await navigator.share({ title: "My MARVEL SNAP wishlist", text: t }); } catch { /* closed */ } } else copyText(t, "Wishlist copied"); },
  wishCopy: () => copyText(wishText().text, "Wishlist copied"),
  promoCopy39: (el) => copyText(el.dataset.v, "Code copied. Redeem it in MARVEL SNAP: Settings › Redeem code."),
  promoDone39: (el) => { S.redeemed[el.dataset.id] = true; save(); render(); toast("Marked redeemed"); },
  spAdd: () => { const what = String(ui.spWhat || "").trim().slice(0, 60), amt = Math.max(0, num(ui.spAmt)), d = ui.spD || localDate(Date.now()); if (!what || !amt) { toast("Add what you bought and how much"); return; } S.spend = [...arr(S.spend), { id: uid(), what, amt, cur: ui.spCur === "gold" ? "gold" : "usd", d }].slice(-400); ui.spWhat = ""; ui.spAmt = ""; save(); render(); toast("Added"); },
  spDel: (el) => { S.spend = arr(S.spend).filter((x) => x.id !== el.dataset.id); save(); render(); },
});
EXT.search.push((q) => (/budget|spend|free|credit|web shop|promo|wishlist|token shop|worth|bundle/i.test(q) ? [{ label: "Shop helper: free stuff, budget, bundle value", sub: "Home › Shop helper", route: "home/shophelp" }] : []));
EXT.styles.push(`.y39-tabs { flex-wrap: wrap; } .y39-tabs .chip { min-height: 40px; } .y39-w { min-width: 200px; } .y39-w button { padding-inline: 2px; }`);
