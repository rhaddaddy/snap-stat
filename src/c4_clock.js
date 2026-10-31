/* ============ The game's clock ============
   MARVEL SNAP's day resets at 19:00 UTC: 12:00 PM Pacific in summer and 11:00 AM in winter (the time stays put in UTC,
   so it moves by an hour for you when daylight saving time starts or ends). Seasons, events and shop changes begin and
   end at a reset, and some things refresh every 8 hours from it: 03:00, 11:00 and 19:00 UTC. */
const RESET_UTC_HOUR = 19;
const REFRESH_UTC_HOURS = [3, 11, 19];
// The reset on a date ("2026-10-27" → 12:00 PM Pacific that day).
function resetOn(d) { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], RESET_UTC_HOUR) : NaN; }
function addDaysIso(d, n) { const t = resetOn(d); return Number.isFinite(t) ? new Date(t + n * DAY).toISOString().slice(0, 10) : ""; }
function nextDailyReset(now = Date.now()) { const d = new Date(now); d.setUTCHours(RESET_UTC_HOUR, 0, 0, 0); if (d.getTime() <= now) d.setTime(d.getTime() + DAY); return d.getTime(); }
function next8hRefresh(now = Date.now()) {
  let best = Infinity;
  for (const h of REFRESH_UTC_HOURS) { const d = new Date(now); d.setUTCHours(h, 0, 0, 0); if (d.getTime() <= now) d.setTime(d.getTime() + DAY); best = Math.min(best, d.getTime()); }
  return best;
}
function refreshTimes(now = Date.now()) { const out = []; let t = now; for (let i = 0; i < 3; i++) { t = next8hRefresh(t); out.push(t); } return out; }
// The game's day: the one that started at the last reset.
const gameDay = (ts = Date.now()) => new Date(ts - RESET_UTC_HOUR * 3600e3).toISOString().slice(0, 10);
const clockTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
// Seasons start at a reset and run until the next season starts; an event's end date is the reset it ends at.
function seasonTimes(s) {
  const start = resetOn(s.start), startTs = Number.isFinite(start) ? start : dayStart(s.start);
  const end = s.end ? resetOn(addDaysIso(s.end, 1)) : Infinity;
  return { startTs, endTs: Number.isFinite(end) ? end - 1 : s.end ? dayEnd(s.end) : Infinity };
}
function eventTimes(e) {
  const start = resetOn(e.start), startTs = Number.isFinite(start) ? start : dayStart(e.start);
  let end = e.end && e.end > e.start ? resetOn(e.end) : startTs + DAY;
  if (!Number.isFinite(end)) end = e.end ? dayEnd(e.end) : startTs + DAY;
  return { startTs, endTs: end - 1 };
}

// What changes at each one. The daily reset is also one of the mission refreshes (19:00 UTC is in both).
const DAILY_RESET_ITEMS = ["The shop's daily offer", "Free Collector's Tokens", "Gold Pass gold (if you have it)", "Free web shop credits", "Credit purchase limits", "New bundles and offers start, old ones leave", "Seasons, events and modes start and end"];
const REFRESH_8H_ITEMS = ["25 free credits in the shop", "2 new daily missions: 1 normal, 1 hard (up to 6 wait for you)", "New event missions", "Bonus boosters and free upgrades", "The cosmetics shop", "New daily cards in the Collector's Token shop (your pinned card stays)", "The Token shop's Spotlight and variant slots"];
// Shorter versions for the Android notification at each one
const DAILY_NOTE = ["The daily offer", "free Collector's Tokens", "Gold Pass gold"];
const REFRESH_NOTE = ["25 free credits", "2 new daily missions", "new event missions", "free upgrades", "a new cosmetics shop"];
const REFRESH_NAME = "Mission refresh";
function clockHtml() {
  const dr = nextDailyReset(), rf = next8hRefresh(), times = refreshTimes().slice().sort((a, b) => new Date(a).getHours() - new Date(b).getHours());
  const p = notifyPrefs();
  const list = (items) => `<ul class="clist">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<section class="sec"><div class="panel clock stack" style="gap:10px"><div class="clkgrid">
      <div class="clk"><span class="k">Daily reset</span><b class="num">${cdSpan(dr)}</b><span class="muted small">${esc(clockTime(dr))} every day</span>${list(DAILY_RESET_ITEMS)}</div>
      <div class="clk"><span class="k">${REFRESH_NAME}</span><b class="num">${cdSpan(rf)}</b><span class="muted small">Every 8 hours: ${times.map(clockTime).map(esc).join(", ")}</span>${list(REFRESH_8H_ITEMS)}</div></div>
    <details class="clockmore" ${ui.clockOpen ? "open" : ""} data-clock="1"><summary class="muted small">Reset times and notifications ›</summary>
    <div class="stack small" style="margin-top:8px">
      <p class="muted">The game's servers reset at 19:00 UTC. That's 12:00 PM Pacific during daylight saving time and 11:00 AM the rest of the year, and the mission refreshes move with it. Your missions page and the Collector's Token shop show the game's own timers once you've screenshotted them.</p>
      ${natAlerts() && natCan("resetAlarms") ? `<div class="stack" style="gap:6px"><label class="check"><input type="checkbox" data-notifychk="resetDaily" ${p.resetDaily ? "checked" : ""} ${p.on ? "" : "disabled"}> Notify me at the daily reset</label><label class="check"><input type="checkbox" data-notifychk="reset8h" ${p.reset8h ? "checked" : ""} ${p.on ? "" : "disabled"}> Notify me at each mission refresh</label>${p.on ? "" : `<span class="muted">Turn on notifications in Settings › App first.</span>`}</div>`
        : window.SnapStatNative ? `<p class="muted">Update the Android app to get a notification at each reset.</p>` : `<p class="muted">The Android app can notify you at each reset.</p>`}
    </div></details></div></section>`;
}
/* ---------- The Android home-screen widget ---------- */
function widgetState() {
  const cs = currentSeason(), alerts = wishAlerts().length;
  const rec = cs ? statsFor(inPeriod(realMatches(), { from: cs.startTs, to: cs.endTs })) : null;
  const pass = cs ? obj(S.passes[cs.id]) : {};
  // The event that's on now, with your pass progress
  const ev = (() => { try { const e = events().find((x) => timeState(x) === "live" && (obj(S.eventProg[x.id]).level || num(x.passLevels) || /diner|pass/i.test(x.name))) || events().find((x) => timeState(x) === "live"); if (!e) return null;
    const pr = obj(S.eventProg[e.id]); return { name: String(e.name).slice(0, 40), endTs: Number.isFinite(e.endTs) ? e.endTs + 1 : 0, level: num(pr.level), left: pr.xpNext ? Math.max(0, num(pr.xpNext) - num(pr.xp)) : 0, xpName: String(pr.xpName || "").slice(0, 16), cur: obj(pr.cur).name ? { name: String(pr.cur.name).slice(0, 16), amount: num(pr.cur.amount) } : null }; } catch { return null; } })();
  const D = obj(S.allianceData), c = typeof climbNow === "function" ? climbNow() : null;
  let missionsLeft = -1; try { const mi = missionState(); if (obj(S.missions).items) missionsLeft = mi.left; } catch { /* none */ }
  return { handle: S.me.handle || "", rank: String(S.me.rank || "").slice(0, 10), season: cs ? { name: cs.name, endTs: Number.isFinite(cs.endTs) ? cs.endTs : 0, pass: num(pass.level), passOf: num(cs.passLevels) || 50,
      rec: rec && rec.games ? { games: rec.games, w: rec.w, l: rec.l, cubes: rec.cubes, wr: Math.round((rec.w / Math.max(1, rec.w + rec.l)) * 100) } : null } : null,
    climb: c ? { rank: num(c.rank), cubes: num(c.cubes), per: cpr() } : null,
    today: { ...todaySummary(), streak: typeof todayStreak === "function" ? todayStreak() : 0 }, missionsLeft, event: ev,
    wallet: { credits: num(S.wallet.credits), gold: num(S.wallet.gold), tokens: num(S.wallet.tokens), wild: num(S.wallet.wild), cl: num(S.me.colLevel) },
    webshop: { claimed: String(obj(S.webshop).claimed || "") },
    alliance: allyKey(S.me.alliance) ? { name: String(S.me.alliance).slice(0, 30), points: num(obj(D.my).points) || num(S.alliance.points), bounties: arr(D.mine).length } : null,
    alert: alerts ? `${alerts} wishlist item${alerts > 1 ? "s" : ""} on sale` : "", look: widgetLook() };
}
// The app's colours for the widget: light, dark or the phone's setting, true black, and the accent you picked
function widgetLook() {
  const L = obj(S.look), mode = ["dark", "light"].includes(L.mode) ? L.mode : "auto";
  const t = (typeof LOOKS === "object" && LOOKS[L.accent]) || { a: "#FFD23F", b: "#FF7A1A" };
  return { mode, black: !!L.black, a: t.a, b: t.b, ink: t.ink || "#1A0E00", text: t.text || "#FFC53D", lightText: t.lightText || "#985600" };
}
let _widgetSig = "";
function pushWidget() {
  if (!natCan("setWidget")) return;
  let j; try { j = JSON.stringify(widgetState()); } catch { return; }
  if (j === _widgetSig) return; _widgetSig = j;
  try { NATIVE.setWidget(j); } catch { /* older app */ }
}
function widgetPanel() {
  if (!NATIVE) return "";
  if (!natCan("setWidget")) return `<div class="panel small"><b>Home-screen widget</b><p class="muted">Update the Android app to get a SNAP Stat widget with your rank, today's games and a countdown to the daily reset.</p></div>`;
  const n = natCan("widgetCount") ? num(NATIVE.widgetCount()) : 0;
  return `<div class="panel stack small"><div class="row between"><b>Home-screen widget</b>${n ? `<span class="pill W">On your home screen</span>` : ""}</div>
    <span class="muted">Shows your rank, today's record, the season and a live countdown to MARVEL SNAP's daily reset. Tap it to open SNAP Stat.</span>
    ${n ? "" : `<div><button class="btn sm snap" data-a="natPinWidget">Add it to my home screen</button></div><span class="muted">If nothing pops up: press and hold an empty spot on your home screen, tap <b>Widgets</b>, find <b>SNAP Stat</b>, then press and hold the widget and drag it where you want it.</span>`}</div>`;
}

// Countdowns tick every second while the app is open; when one runs out, the page redraws (a new day, a new season…).
// Only numbers count (form fields elsewhere use data-cd for other things), and a timer that has run out stops ticking,
// so the redraw happens once.
function tickCountdowns() {
  if (document.hidden) return;
  const now = Date.now(); let due = false;
  document.querySelectorAll("[data-cd]").forEach((el) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    const t = Number(el.dataset.cd); if (!Number.isFinite(t) || t <= 0) return;
    if (t <= now) { el.removeAttribute("data-cd"); el.textContent = countdown(t); due = true; return; }
    const s = countdown(t); if (el.textContent !== s) el.textContent = s;
  });
  if (due) { try { requestRender(); } catch { /* not ready */ } }
}
(function tick() { try { tickCountdowns(); } catch { /* keep ticking */ } setTimeout(tick, 1000 - (Date.now() % 1000) + 15); })();
document.addEventListener("visibilitychange", () => { if (!document.hidden) try { tickCountdowns(); } catch { /* not ready */ } });
document.addEventListener("toggle", (e) => { if (e.target && e.target.dataset && e.target.dataset.clock) ui.clockOpen = e.target.open; }, true);
