/* ============ y41_android.js: the Android app (October 31, 2026) ============
   81 + 82 + 85 a lock-screen countdown to the reset with Won / Lost / Tie buttons (it shows on a paired watch too) ·
   83 SNAP Stat in a pop-up window over the game (Samsung pop-up view / split screen), with a compact layout ·
   84 vibration patterns for a win, a loss and a snap · 86 press-and-hold shortcuts for your top decks ·
   87 widget colours from your wallpaper · 88 an offline line on the widget · 89 a weekly backup file, and one tap to
   Google Drive · 90 battery and data use of the tracker, plus its battery saver (y34). Kotlin: StatusNote, EventWidget,
   Bridge (setStatusNote, setBatterySaver, trackerStats, setDeckShortcuts), Widget (wallpaper, offline), TrackerService. */
EXT.settingsAndroid = arr(EXT.settingsAndroid);
const y41New = (fn) => natCan(fn);
const y41Upd = `<span class="muted">Update the Android app to get this.</span>`;

/* ---------- Routes from notifications and shortcuts: #quicklog=W, #playdeck=<id> ---------- */
function y41Route(r) {
  const h = String(r || "").replace(/^#/, "");
  if (h.startsWith("quicklog=")) {
    const res = h.slice(9, 10).toUpperCase(); if (sheetFn) closeSheet();
    qk.last = null; qk.f = {}; ui.qkHint = ["W", "L", "T"].includes(res) ? res : ""; openSheet(quickSheet);
    toast(res === "W" ? "Nice! Tap how many cubes you won" : res === "L" ? "Tap how many cubes you lost" : res === "T" ? "Tap Tie to save it" : "Quick log");
    return true;
  }
  if (h.startsWith("playdeck=")) {
    const d = S.decks.find((x) => x.id === h.slice(9)); if (sheetFn) closeSheet();
    if (!d) { go("cards/decks"); toast("That deck isn't here any more"); return true; }
    S.quick = { ...obj(S.quick), deckId: d.id }; save();
    if (!live.on) { live = newLive(d); saveLive(); }
    go("home/live"); toast(`Playing ${d.name}`); return true;
  }
  return false;
}
if (window.snapNative && typeof window.snapNative.on === "function") {
  const _on = window.snapNative.on;
  window.snapNative.on = function (type, data) { if (type === "route") { try { if (y41Route(data)) return; } catch (e) { errNote("opening that", e); } } return _on.apply(this, arguments); };
}

/* ---------- 81 + 82 + 85. Lock-screen reset countdown with Won / Lost / Tie ---------- */
EXT.settingsAndroid.push(function y41Status() {
  const can = y41New("setStatusNote"), on = can && !!NATIVE.statusNote();
  return `<div class="panel stack small"><b>Lock screen</b>
    ${can ? `<label class="check"><input type="checkbox" data-y41="status" ${on ? "checked" : ""}> Show the reset countdown on my lock screen, with Won / Lost / Tie buttons</label>
      <span class="muted">A quiet notification that counts down to the daily reset. Its buttons open Quick log with the result picked. It also shows on a paired smartwatch. (Android doesn't let apps put widgets on the lock screen or always-on display, so this is how.)</span>` : y41Upd}</div>`;
});

/* ---------- 83. A pop-up window over the game ---------- */
EXT.liveMatch.push(function y41PopTip() {
  if (!/Android/i.test(navigator.userAgent) || S.popTipOff) return "";
  return `<div class="panel small stack y41-pop"><b>Keep this open over the game</b><span>On a Samsung phone: open MARVEL SNAP, swipe up from the bottom and hold for Recents, tap SNAP Stat's icon, then <b>Open in pop-up view</b> (or split screen). SNAP Stat floats over the game with a compact layout.</span><div class="row"><button class="btn sm ghost" data-a="popTipOff">Got it</button></div></div>`;
});
function y41Mini() { const mini = window.innerWidth < 360 || window.innerHeight < 520; document.body.classList.toggle("y41-mini", mini); }
window.addEventListener("resize", () => { clearTimeout(y41Mini.t); y41Mini.t = setTimeout(y41Mini, 150); });
EXT.afterRender.push(y41Mini);

/* ---------- 84. Vibration patterns ---------- */
const VIB = { win: [30, 60, 30, 60, 60], loss: [180], snap: [15, 40, 15] };
const vibOn = () => typeof hapticsOn === "function" && hapticsOn() && S.vibPatterns !== false;
function vib(kind) { if (!vibOn()) return; try { navigator.vibrate(VIB[kind]); } catch { /* not supported */ } }
// After y21's short buzz (a new vibration replaces the one playing)
EXT.onMatch.push((m, isNew) => { if (isNew && m && !m.example && !m.svSync && (m.result === "W" || m.result === "L")) setTimeout(() => vib(m.result === "W" ? "win" : "loss"), 60); });
document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.livechk === "mySnap" && t.checked) vib("snap"); });
EXT.settingsApp.push(() => (typeof canBuzz === "function" && canBuzz() ? `<section class="sec"><h2>Vibration patterns</h2><div class="panel stack small"><label class="check"><input type="checkbox" data-y41="vib" ${S.vibPatterns === false ? "" : "checked"}> Different buzzes for a win (two quick), a loss (one long) and a snap</label>
  <div class="row"><button class="btn sm" data-a="vibTest" data-v="win">Win</button><button class="btn sm" data-a="vibTest" data-v="loss">Loss</button><button class="btn sm" data-a="vibTest" data-v="snap">Snap</button></div></div></section>` : ""));

/* ---------- 86. Shortcuts for your top decks ---------- */
function topDecks3() { const by = {}; realMatches().filter((m) => m.ts >= Date.now() - 30 * DAY && m.deckId).forEach((m) => (by[m.deckId] = (by[m.deckId] || 0) + 1)); return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([id]) => S.decks.find((d) => d.id === id)).filter(Boolean).slice(0, 3); }
let _y41Sc = "";
function deckShortcutsSync() {
  if (!y41New("setDeckShortcuts") || S.deckShortcuts === false) return;
  const list = topDecks3().map((d) => ({ id: d.id, name: String(d.name || "Deck").slice(0, 25), track: natCan("trackAndPlay") })), sig = JSON.stringify(list);
  if (sig === _y41Sc) return; _y41Sc = sig; try { NATIVE.setDeckShortcuts(sig); } catch { /* old app */ }
}
EXT.onMatch.push((m, isNew) => { if (isNew) setTimeout(deckShortcutsSync, 3000); });
if (NATIVE) setTimeout(deckShortcutsSync, 6000);
EXT.settingsAndroid.push(function y41Shortcuts() {
  const ds = topDecks3();
  return `<div class="panel stack small"><b>Deck shortcuts</b>${y41New("setDeckShortcuts") ? `<label class="check"><input type="checkbox" data-y41="shortcuts" ${S.deckShortcuts === false ? "" : "checked"}> Add my most played decks to the app icon's press-and-hold menu</label>
    <span class="muted">${ds.length ? `Now: ${esc(ds.map((d) => d.name).join(", "))}. Tapping one starts Live match with that deck${natCan("trackAndPlay") ? " and opens the game with the tracker on" : ""}.` : "Play a few games and your top decks show up there."}</span>` : y41Upd}</div>`;
});

/* ---------- 87 + 88. Widget: wallpaper colours, and an offline line ---------- */
if (typeof widgetLook === "function") { const _wl = widgetLook; widgetLook = function () { const l = _wl(); return S.widgetWall ? { ...l, mode: "wallpaper" } : l; }; } // eslint-disable-line no-func-assign
if (typeof widgetState === "function") { const _ws = widgetState; widgetState = function () { return { ..._ws(), offline: navigator.onLine === false, sentAt: Math.floor(Date.now() / 3600e3) * 3600e3 }; }; } // eslint-disable-line no-func-assign
window.addEventListener("online", () => { try { pushWidget(); } catch { /* no widget */ } });
window.addEventListener("offline", () => { try { pushWidget(); } catch { /* no widget */ } });
EXT.settingsAndroid.push(function y41Widget() {
  if (!natCan("setWidget")) return "";
  const v12 = num(natInfo().sdk) >= 31;
  return `<div class="panel stack small"><b>Widget colours</b>${v12 ? `<label class="check"><input type="checkbox" data-y41="wall" ${S.widgetWall ? "checked" : ""}> Use my wallpaper's colours (Material You)</label>` : `<span class="muted">Wallpaper colours need Android 12 or newer.</span>`}
    <span class="muted">The widget also says when it's offline or hasn't been updated for a day and a half. For the event countdown, long-press your home screen › Widgets › SNAP Stat › <b>SNAP event</b>.</span></div>`;
});

/* ---------- 89. Weekly backup file, and one tap to Google Drive ---------- */
function backupJsonAll() { return JSON.stringify(typeof allMyData === "function" ? allMyData() : { app: "SNAP Stat", state: S, matches: matchWeeks, exported: new Date().toISOString() }); }
const backupName = () => `snap-stat-backup-${localDate(Date.now())}.json`;
function autoBackup(force) {
  if (!NATIVE || !natCan("saveFile") || (!force && (S.autoBackup === false || Date.now() - num(S.autoBackupAt) < 7 * DAY))) return false;
  try { const json = backupJsonAll(); const ok = NATIVE.saveFile(backupName(), "application/json", btoa(unescape(encodeURIComponent(json)))); if (ok) { S.autoBackupAt = Date.now(); save(); } return !!ok; } catch (e) { errNote("the weekly backup", e); return false; }
}
EXT.afterRender.push(function y41WeeklyBackup() { if (!NATIVE || !store.ready || y41WeeklyBackup.done) return; y41WeeklyBackup.done = true; setTimeout(() => { if (realMatches().length || S.decks.length) autoBackup(false); }, 8000); });
async function driveBackup() {
  const json = backupJsonAll(), name = backupName();
  try {
    const file = new File([json], name, { type: "application/json" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { await navigator.share({ title: "SNAP Stat backup", text: "My SNAP Stat backup", files: [file] }); toast("Pick Google Drive in the list to save it there"); }
    else { saveBlob(new Blob([json], { type: "application/json" }), name); toast("Saved. Upload it to Google Drive from your Downloads."); }
    S.driveAt = Date.now(); save();
  } catch (e) { if (!/abort|cancel/i.test(errText(e))) errNote("the Drive backup", e); }
}
EXT.settingsData.push(function y41BackupPanel() {
  return `<section class="sec"><h2>Weekly backup</h2><div class="panel stack small">
    ${NATIVE && natCan("saveFile") ? `<label class="check"><input type="checkbox" data-y41="backup" ${S.autoBackup === false ? "" : "checked"}> Save a backup file to this phone every week (Downloads › SNAP Stat)</label><span class="muted">${S.autoBackupAt ? `Last one ${esc(agoTxt(S.autoBackupAt))}.` : "The first one is saved the next time you open the app."}</span>` : `<span class="muted">The Android app saves a backup file every week by itself. Here, use Download all my data above.</span>`}
    <div class="row"><button class="btn snap" data-a="driveBackup">Back up to Google Drive now</button></div><span class="muted">Opens your phone's share menu: pick Drive. ${S.driveAt ? `Last time ${esc(agoTxt(S.driveAt))}.` : ""}</span></div></section>`;
});

/* ---------- 90. Battery and data use ---------- */
const bd = { stats: null, pics: null, at: 0 };
async function bdLoad() {
  if (Date.now() - bd.at < 20e3) return; bd.at = Date.now();
  try { bd.stats = y41New("trackerStats") ? obj(JSON.parse(NATIVE.trackerStats())) : null; } catch { bd.stats = null; }
  try { const all = arr(await shotLogAll()), wk = Date.now() - 7 * DAY, mo = Date.now() - 30 * DAY; bd.pics = { wk: all.filter((r) => num(r.at) >= wk).length, mo: all.filter((r) => num(r.at) >= mo).length, bytes: all.filter((r) => num(r.at) >= mo).reduce((s, r) => s + num(r.img && r.img.size), 0) }; } catch { bd.pics = null; }
  if (ui.tab === "settings" && ui.setSub === "android") render();
}
const hm = (ms) => { const m = Math.round(num(ms) / 60e3); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
EXT.settingsAndroid.push(function y41Battery() {
  setTimeout(bdLoad, 0); const s = bd.stats, p = bd.pics, today = localDate(Date.now());
  const mb = p ? Math.max(p.bytes / 1048576, p.mo * 0.25) : 0;
  return `<div class="panel stack small"><b>Battery and data</b>
    ${s ? `<div class="list">${num(s.battery) >= 0 ? `<div class="li"><div class="grow"><div class="t">Battery now</div><div class="s">${s.charging ? "Charging" : "On battery"}${s.paused ? " · the tracker is paused to save it" : ""}</div></div><b class="num">${num(s.battery)}%</b></div>` : ""}
      <div class="li"><div class="grow"><div class="t">Tracker running</div><div class="s">${s.running ? `now, for ${hm(s.runNowMs)}` : "not right now"}</div></div><b class="num">${hm((s.runDay === today ? num(s.runDayMs) : 0) + num(s.runNowMs))}</b></div>
      <div class="li"><div class="grow"><div class="t">All time</div><div class="s">time the tracker has run</div></div><b class="num">${hm(s.runTotalMs)}</b></div></div>` : `<span class="muted">${NATIVE ? "Update the Android app to see the tracker's battery use." : ""}</span>`}
    ${p ? `<div class="list"><div class="li"><div class="grow"><div class="t">Pictures read by your AI</div><div class="s">${p.wk} this week · ${p.mo} in 30 days</div></div><b class="num">≈ ${mb < 1 ? "<1" : Math.round(mb)} MB</b></div></div>` : ""}
    <span class="muted">Reading happens on the phone; only pictures your AI reads are sent (about 0.25 MB each), so data use is small. Screen reading uses the most battery: the battery saver above pauses it when you're low.</span></div>`;
});

/* ---------- Taps and switches ---------- */
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.y41) return; const k = t.dataset.y41, on = !!t.checked;
  if (k === "status") { try { NATIVE.setStatusNote(on); } catch { toast("Update the Android app first"); } }
  else if (k === "vib") { S.vibPatterns = on; if (on) vib("win"); }
  else if (k === "shortcuts") { S.deckShortcuts = on; _y41Sc = ""; if (on) deckShortcutsSync(); else { try { NATIVE.setDeckShortcuts("[]"); } catch { /* old app */ } } }
  else if (k === "wall") { S.widgetWall = on; setTimeout(() => { try { pushWidget(); } catch { /* no widget */ } }, 50); }
  else if (k === "backup") S.autoBackup = on;
  save(); render();
});
Object.assign(A, {
  popTipOff: () => { S.popTipOff = true; save(); render(); },
  vibTest: (el) => { const was = S.vibPatterns; S.vibPatterns = true; vib(el.dataset.v); S.vibPatterns = was; },
  driveBackup: () => driveBackup(),
});
EXT.styles.push(`
.y41-pop { border-style: dashed; }
body.y41-mini .tabhead h1 { font-size: 24px; } body.y41-mini .sec { margin-top: 10px; } body.y41-mini .panel { padding: 10px; }
body.y41-mini header.top { padding-top: 4px; padding-bottom: 4px; } body.y41-mini .y41-pop { display: none; }`);
