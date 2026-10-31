/* ============ y21_tracker.js: the Android app and the match tracker ============
   A buzz when a match is logged, bulk actions in the screenshot review, a tracker health card, a nudge to stop an idle
   tracker, deck codes shared to the app from other apps, and the day's streak for the home-screen widget.
   Android-only parts check NATIVE (window.SnapStatNative) and natCan(), so the website and old apps keep working. */

// Hooks this file adds for the shared views. b3_ext.js lists them too; these lines keep a build without that edit working.
EXT.reviewTools = arr(EXT.reviewTools);
EXT.settingsAndroid = arr(EXT.settingsAndroid);

/* ---------- 1. Haptics: a short buzz when a match is logged ---------- */
// Phones only: desktop Chrome has navigator.vibrate too, but nothing to buzz
const canBuzz = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && (!!NATIVE || !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches));
const hapticsOn = () => canBuzz() && S.haptics !== false;  // on by default wherever the phone can vibrate
let _buzzAt = 0;
// Never more than one buzz every 150 ms, so an import of 300 matches buzzes once, not 300 times
function buzz(ms) {
  if (!hapticsOn()) return false;
  const now = Date.now(); if (now - _buzzAt < 150) return false; _buzzAt = now;
  try { return !!navigator.vibrate(ms); } catch { return false; }
}
// Not for example data or matches brought in from SnapVault in bulk
EXT.onMatch.push((m, isNew) => { if (isNew && m && !m.example && !m.svSync) buzz(30); });
// A lighter tap on the Quick log's choices (deck, mode, snapped/retreated). Saving a match buzzes through onMatch above.
document.addEventListener("click", (e) => { const el = e.target && e.target.closest ? e.target.closest('[data-a="quickDeck"],[data-a="quickMode"],[data-a="quickFlag"]') : null; if (el) buzz(10); });
EXT.settingsApp.push(() => (canBuzz() ? `<section class="sec"><h2>Vibration</h2><div class="panel stack small">
  <label class="check"><input type="checkbox" data-hapticschk="1" ${hapticsOn() ? "checked" : ""}> Vibrate when a match is logged</label>
  <span class="muted">A short buzz each time a new match is saved, whether you logged it, a screenshot did, or the tracker did.</span></div></section>` : ""));
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.hapticschk) return;
  S.haptics = !!t.checked; save(); if (S.haptics) buzz(30); toast(S.haptics ? "Vibration on" : "Vibration off");
});

/* ---------- 2. Review screenshots: mark all shown as right, delete all that couldn't be read ---------- */
// A picture the AI couldn't read at all (its status starts "Couldn't…"), as opposed to one it read but found nothing in
const rvFailed = (r) => /^Couldn't/.test(String((r && r.status) || ""));
EXT.reviewTools.push((list, shown) => {
  // "Shown" is what's drawn: the review list draws the first 60 that match the filter
  const drawn = arr(shown).slice(0, 60); rv.shownIds = drawn.map((r) => r.id);
  // Pictures that couldn't be read have nothing to be right about, so marking skips them
  const todo = drawn.filter((r) => !r.verdict && !rvFailed(r)).length, failed = arr(list).filter(rvFailed).length;
  if (!todo && !failed) return "";
  return `<div class="row rvtools">${todo ? `<button class="btn sm" data-a="rvAllRight">✓ Mark all shown as right <span class="num muted">${todo}</span></button>` : ""}
    ${failed ? `<button class="btn sm ghost danger" data-a="rvDropFailed">${rv.dropArm ? "Tap again to delete them" : "Delete all failed"} <span class="num muted">${failed}</span></button>` : ""}</div>`;
});
Object.assign(A, {
  rvAllRight: async () => {
    const ids = new Set(arr(rv.shownIds)); const todo = arr(rv.list).filter((r) => ids.has(r.id) && !r.verdict && !rvFailed(r));
    if (!todo.length) { toast("Everything shown is checked already"); return; }
    todo.forEach((r) => { r.verdict = "right"; }); refreshSheet();
    try { await shotStore("readwrite", (st) => todo.forEach((r) => st.put(r))); toast(`${todo.length} marked right`); } catch { toast("Couldn't save those marks"); }
  },
  rvDropFailed: async () => {
    const failed = arr(rv.list).filter(rvFailed); if (!failed.length) return;
    if (!rv.dropArm) { rv.dropArm = true; refreshSheet(); setTimeout(() => { if (rv.dropArm) { rv.dropArm = false; refreshSheet(); } }, 6000); return; }
    rv.dropArm = false;
    try { await shotStore("readwrite", (st) => failed.forEach((r) => st.delete(r.id))); } catch { toast("Couldn't delete them"); refreshSheet(); return; }
    failed.forEach((r) => { const u = rv.urls.get(r.id); if (u) { try { URL.revokeObjectURL(u); } catch { /* fine */ } rv.urls.delete(r.id); } });
    rv.list = arr(rv.list).filter((r) => !rvFailed(r)); refreshSheet(); toast(`${failed.length} deleted`);
    trkHealth.at = 0;  // the health card counts these
  },
});

/* ---------- 3. Tracker health (Settings › Android) ---------- */
const trkHealth = { at: 0, data: null, loading: false };
// Tracker log lines start "MM-dd HH:mm:ss" in the phone's own time; the year isn't written, so it's this year (or last)
function trkLogTime(line) {
  const m = String(line || "").match(/^(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)/); if (!m) return 0;
  const now = new Date(); let d = new Date(now.getFullYear(), +m[1] - 1, +m[2], +m[3], +m[4], +m[5]);
  if (d.getTime() > now.getTime() + DAY) d = new Date(now.getFullYear() - 1, +m[1] - 1, +m[2], +m[3], +m[4], +m[5]);
  return d.getTime();
}
// When the tracker last started and stopped: newer apps say so in info(); older ones only in their log
function trkStartStop() {
  const i = natInfo(); const out = { startedAt: num(i.startedAt), stoppedAt: num(i.stoppedAt) };
  if (!out.startedAt && !out.stoppedAt && natCan("log")) {
    let log = ""; try { log = String(NATIVE.log() || ""); } catch { log = ""; }
    for (const line of log.split("\n")) { if (/ Tracking started/.test(line)) out.startedAt = trkLogTime(line) || out.startedAt; else if (/ Tracking stopped/.test(line)) out.stoppedAt = trkLogTime(line) || out.stoppedAt; }
  }
  return out;
}
function aiStatusText() {
  if (!aiOn()) return "No AI key yet, so the tracker's pictures wait. Add one in <b>Settings › AI</b>.";
  const st = aiState(), ps = aiOrder().filter((p) => aiKeyFor(p)), name = (p) => AI_PROVIDERS[p].name;
  const bad = ps.filter((p) => obj(st[p]).why === "key"), resting = ps.filter((p) => num(obj(st[p]).until) > Date.now());
  if (bad.length && bad.length === ps.length) return `Your ${bad.map(name).join(" and ")} key isn't working. Fix it in <b>Settings › AI</b>.`;
  if (resting.length && resting.length === ps.length) return `${ps.map(name).join(" and ")} ${ps.length > 1 ? "are" : "is"} out of answers for now; waiting pictures are read when it's back.`;
  return `AI key: ${ps.map(name).join(", ")} ✓${bad.length ? ` (${bad.map(name).join(", ")} isn't working)` : ""}`;
}
async function trkHealthLoad() {
  if (trkHealth.loading) return; trkHealth.loading = true;
  try {
    const list = await shotLogAll(), today = localDate(Date.now()), td = list.filter((r) => localDate(num(r.at)) === today);
    // Seconds from a match's picture being taken to SNAP Stat logging it. An old screenshot shared days later isn't counted.
    const lagOf = (recs) => recs.filter((r) => r.kind === "match" && r.matchId && num(r.taken) > 0 && num(r.at) > num(r.taken) && num(r.at) - num(r.taken) < 12 * 3600e3).map((r) => (num(r.at) - num(r.taken)) / 1000);
    let lags = lagOf(td), scope = "today"; if (!lags.length) { lags = lagOf(list.slice(0, 40)); scope = "recent"; }
    trkHealth.data = { read: td.length, failed: td.filter(rvFailed).length, why: typeof rvWhyCounts === "function" ? rvWhyCounts(td.filter(rvFailed)) : [], lagN: lags.length, avg: lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : 0, scope, ss: trkStartStop() };
  } catch { trkHealth.data = { read: 0, failed: 0, lagN: 0, avg: 0, scope: "today", ss: trkStartStop(), err: true }; }
  trkHealth.at = Date.now(); trkHealth.loading = false;
  if (ui.tab === "settings") refreshView();
}
const secsTxt = (s) => (s < 90 ? `${Math.max(1, Math.round(s))} seconds` : s < 5400 ? `${Math.round(s / 60)} minutes` : `${(s / 3600).toFixed(1)} hours`);
function trackerHealthHtml() {
  if (!NATIVE) return "";
  if (!trkHealth.data || Date.now() - trkHealth.at > 60e3) setTimeout(trkHealthLoad, 0);
  const d = trkHealth.data, i = natInfo(), ss = d ? d.ss : { startedAt: 0, stoppedAt: 0 };
  const when = (t) => (t ? (Date.now() - t < DAY ? agoTxt(t) : "on " + dateTimeStr(t)) : "");
  const startStop = i.tracking ? `Tracking since ${ss.startedAt ? when(ss.startedAt) : "you started it"}.${ss.stoppedAt && ss.stoppedAt < ss.startedAt ? ` Last stopped ${when(ss.stoppedAt)}.` : ""}`
    : ss.stoppedAt ? `Last stopped ${when(ss.stoppedAt)}${ss.startedAt ? `, after starting ${when(ss.startedAt)}` : ""}.` : ss.startedAt ? `Last started ${when(ss.startedAt)}.` : "The tracker hasn't been started on this phone yet.";
  return `<div class="panel stack small trkhealth"><div class="row between"><b>Tracker health</b>${d && !d.err ? `<span class="pill ${d.failed ? "warn" : "W"}">${d.failed ? `${d.failed} couldn't be read` : "All good"}</span>` : ""}</div>
    <div class="tiles"><div class="tile"><div class="k">Pictures read today</div><div class="v num">${d ? fmt(d.read) : "…"}</div></div><div class="tile"><div class="k">Couldn't be read</div><div class="v num ${d && d.failed ? "neg" : ""}">${d ? fmt(d.failed) : "…"}</div></div></div>
    ${d && d.failed && arr(d.why).length ? `<div class="stack" style="gap:2px"><b class="small">Why they couldn't be read</b>${arr(d.why).map(([w, n]) => `<span class="small">${n} · ${esc(w)}</span>`).join("")}<div class="row" style="margin-top:4px"><button class="btn sm" data-a="rvFailedOpen">See them</button>${canReadShots() ? `<button class="btn sm" data-a="rvRetryFailed">Read them again</button>` : ""}</div></div>` : ""}
    <span>${!d ? "Checking the review log…" : d.lagN ? `Matches are logged about <b>${secsTxt(d.avg)}</b> after their picture is taken${d.scope === "today" ? "" : " (from your last matches)"}. That's the wait until you open SNAP Stat plus the AI's reading time.` : "No matches have been logged from pictures yet, so there's no timing to show."}</span>
    <span>${aiStatusText()}</span>
    <span class="muted">${startStop}</span>
    <div class="row"><button class="btn sm ghost" data-a="trkHealthRefresh">Refresh</button></div></div>`;
}
EXT.settingsAndroid.push(trackerHealthHtml);
Object.assign(A, { trkHealthRefresh: () => { trkHealth.at = 0; refreshView(); } });

/* ---------- 4. Idle auto-stop: a tracker that's been on for hours with nothing to read ---------- */
const IDLE_ON_MS = 3 * 3600e3, IDLE_QUIET_MS = 60 * 60e3;
const trk = { wasOn: null, since: 0, lastPic: 0, cap: 0, q: 0, shown: false };
// Keeps track of when the tracker went on and when a picture last arrived (newer apps say so; older ones are watched)
function trkWatch() {
  if (!NATIVE) return;
  const i = natInfo(), on = !!i.tracking, now = Date.now(), cap = num(i.captured), q = num(i.queue);
  if (on && trk.wasOn !== true) { trk.since = num(i.startedAt) || now; trk.lastPic = Math.max(trk.since, num(i.lastShotAt)); }
  else if (on) { if (num(i.lastShotAt)) trk.lastPic = Math.max(trk.lastPic, num(i.lastShotAt)); else if (cap > trk.cap || q > trk.q) trk.lastPic = now; }
  trk.cap = cap; trk.q = q; trk.wasOn = on;
}
function trkIdle() {
  if (!NATIVE) return false;
  trkWatch(); if (trk.wasOn !== true) return false;
  const now = Date.now();
  if (now - trk.since < IDLE_ON_MS || now - trk.lastPic < IDLE_QUIET_MS) return false;
  return now - num(obj(S.trackerIdle).askedAt) >= IDLE_ON_MS;  // asked already? wait another 3 hours before asking again
}
EXT.homeTop.push(() => {
  const idle = trkIdle(); trk.shown = idle; if (!idle) return "";
  const h = Math.floor((Date.now() - trk.since) / 3600e3);
  return `<section class="sec"><div class="panel stack small trkidle"><b>The tracker has been on for ${h} hours with nothing to read — stop it?</b>
    <span class="muted">Nothing new has come in since ${esc(agoTxt(trk.lastPic))}. It keeps watching the screen while MARVEL SNAP is open, so stopping it saves battery until you play again.</span>
    <div class="row"><button class="btn snap" data-a="trkIdleStop">Stop it</button><button class="btn ghost" data-a="trkIdleKeep">Keep going</button></div></div></section>`;
});
Object.assign(A, {
  trkIdleStop: () => { S.trackerIdle = { askedAt: Date.now() }; save(); A.natTrack({ dataset: { v: "0" } }); toast("Tracker stopped"); render(); },
  trkIdleKeep: () => { S.trackerIdle = { askedAt: Date.now() }; save(); render(); toast("OK, it keeps going. I'll ask again in 3 hours."); },
});
// Once a minute: if the card should appear or go, redraw Home (cheap: one small JSON read from the app)
if (NATIVE) setInterval(() => { try { if (ui.tab === "home" && trkIdle() !== trk.shown) requestRender(); } catch { /* fine */ } }, 60e3);

/* ---------- 5. A deck code shared to SNAP Stat from another app ---------- */
// The Android app hands shared text here (MainActivity: window.snapSharedText(text)). A deck code opens the import panel.
const looksLikeDeckCode = (t) => /[A-Za-z0-9+/=]{40,}/.test(t);
const whenReadyFor = (ok, fn, tries = 0) => { if (ok()) fn(); else if (tries < 60) setTimeout(() => whenReadyFor(ok, fn, tries + 1), 500); else fn(); };
window.snapSharedText = function (text) {
  const t = String(text || "").trim().slice(0, 20000); if (!t) return;
  whenReadyFor(() => dataReady() && !!CAT, () => {
    // One of SNAP Stat's own deck links: open it the way a tapped link would
    const own = t.match(/#deck=[^\s]+/); if (own && /^https?:\/\/\S+$/i.test(t)) { location.hash = own[0]; return; }
    if (/^https?:\/\/\S+$/i.test(t)) { toast("That link isn't a deck code. Share the deck code itself."); return; }  // some other link: not for us
    const res = parseDeckCode(t);
    if (!res.cards.length && !looksLikeDeckCode(t)) { toast("That text didn't look like a deck code."); return; }
    imp.text = t; imp.res = res; if (sheetFn) closeSheet(); openSheet(importSheet);
    if (!res.cards.length) toast("That didn't read as a deck. Check the code, then tap Read deck.");
  });
};

/* ---------- 6. The widget's TODAY line: this day's streak (the record itself was already there) ---------- */
// +3 is three wins in a row today, -2 two losses; ties don't break a streak. Used by widgetState() in c4_clock.js.
function todayStreak() {
  const today = localDate(Date.now()); let n = 0;
  for (const m of realMatches()) {  // newest first
    if (localDate(m.ts) !== today) break;
    if (m.result === "T") continue;
    const w = m.result === "W";
    if (!n) n = w ? 1 : -1; else if ((n > 0) === w) n += w ? 1 : -1; else break;
  }
  return n;
}

EXT.styles.push(`.trkidle b{font-size:15px}.trkhealth .tiles{margin:0}.rvtools{margin:6px 0 2px}.rvtools .btn .num{margin-left:2px}`);
