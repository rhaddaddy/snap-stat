/* ============ The Android app ============
   When SNAP Stat runs inside its Android app, the app adds window.SnapStatNative. With it SNAP Stat can read new
   MARVEL SNAP screenshots on its own, run the match tracker, save files and use Android's share menu.
   Pictures the app collects wait in a queue on the phone until SNAP Stat reads them with your AI service. */
const NATIVE = window.SnapStatNative || null;
const APK_URL = "https://github.com/rhaddaddy/snap-stat/releases/latest/download/snap-stat.apk";
const nat = { info: {}, log: "", logOpen: false, busy: false, update: {}, pct: -1 };
const natCan = (fn) => !!(NATIVE && typeof NATIVE[fn] === "function");
function natInfo() { if (!NATIVE) return {}; try { nat.info = obj(JSON.parse(NATIVE.info())); } catch { nat.info = {}; } return nat.info; }
const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

if (NATIVE) {
  // Web views can't save blob: links, so files the app makes (deck pictures, backups) go to the phone's Downloads
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute("download") && /^(blob:|data:)/.test(this.href)) {
      const name = this.getAttribute("download") || "snap-stat-file";
      fetch(this.href).then((r) => r.blob()).then(async (b) => NATIVE.saveFile(name, b.type || "application/octet-stream", await blobToB64(b))).catch(() => toast("Couldn't save the file"));
      return;
    }
    return click.call(this);
  };
  // Android's share menu stands in for the browser's
  navigator.canShare = () => true;
  navigator.share = async (d = {}) => {
    const files = [];
    for (const f of arr(d.files)) files.push({ name: f.name || "file", type: f.type || "application/octet-stream", b64: await blobToB64(f) });
    NATIVE.share(JSON.stringify({ title: d.title || "", text: d.text || "", url: d.url || "", files }));
  };
  window.snapNative = {
    on: (type, data) => natEvent(type, data),
    // Android's back button closes an open panel first
    back: () => { const sh = $("#sheet"); if (sh && !sh.hidden) { closeSheet(); return true; } return false; },
  };
  const ready = () => { try { NATIVE.ready(); } catch { /* old app */ } natRules(); whenDataReady(() => natRules()); if (natCan("updateInfo")) { try { nat.update = obj(JSON.parse(NATIVE.updateInfo())); } catch { /* none yet */ } } natCheckSoon(true); setTimeout(updatePopup, 2500); };
  if (document.readyState === "complete") setTimeout(ready, 0); else window.addEventListener("load", ready);
  document.addEventListener("toggle", (e) => { if (e.target && e.target.dataset && e.target.dataset.natlog) nat.logOpen = e.target.open; }, true);
}

function natEvent(type, data) {
  if (type === "signin") {
    if (window.__snapNativeToken) window.__snapNativeToken(data || "");
    else if (data && window.__snapSignInToken) window.__snapSignInToken(data).catch(() => toast("Sign-in didn't finish. Try again."));
    return;
  }
  if (type === "route") { if (sheetFn) closeSheet(); go(String(data || "").replace(/^#/, "") || "home"); return; }
  if (type === "update") { nat.update = obj(data); if (nat.checking) { nat.checking = 0; toast(natUpdateReady() ? `Version 1.${nat.update.latest} is ready. Tap Update now.` : "You have the newest app."); } refreshView(); updatePopup(); return; }
  if (type === "update-progress") { if (num(data) !== nat.pct) nat.pctAt = Date.now(); nat.pct = num(data); refreshView(); return; }
  if (type === "update-installing") { nat.pct = -1; nat.tried = Date.now(); toast("Tap Update in Android's window to finish."); refreshView(); return; }
  if (type === "update-error") { nat.pct = -1; nat.tried = Date.now(); toast(String(data || "The update didn't work.")); refreshView(); return; }
  natInfo();
  if (type === "resume") { _widgetSig = ""; setTimeout(pushWidget, 800); nat.popped = 0; natCheckSoon(false); setTimeout(updatePopup, 1500); if (typeof cameBack === "function") cameBack(); }
  if ((type === "perm" || type === "resume") && notifyPrefs().on) { saveNotifyState(); if (type === "perm" && natCan("checkAlertsNow") && natCan("canNotify") && NATIVE.canNotify()) NATIVE.checkAlertsNow(); }
  if (type === "queue" || type === "resume") natPull();
  if (ui.tab === "settings") refreshView();
}

/* Reads waiting pictures (and SnapVault files shared to the app). Pictures stay in the queue until an AI key is set. */
function natPull() {
  if (!NATIVE || nat.busy || !natCan("queueCount") || !natCan("next") || !natCan("done")) return;
  if (!dataReady()) { whenDataReady(natPull); return; }
  if (!num(NATIVE.queueCount())) return;
  if (!canReadShots()) { if (ui.tab === "settings") refreshView(); return; }
  nat.busy = true;
  // One at a time: a picture leaves the phone's queue only once it's been read, so one the AI was too busy for
  // (free keys allow a few answers a minute) stays for next time instead of being lost.
  setTimeout(async () => {
    let again = 800, opened = false, fails = 0;
    try {
      for (let i = 0; i < 300; i++) {
        const s = NATIVE.next(); if (!s) break;
        let it; try { it = JSON.parse(s); } catch { break; }
        const f = new File([b64ToBytes(it.b64 || "")], it.name || "shot.jpg", { type: it.type || "image/jpeg", lastModified: num(it.time) || Date.now() });
        if (it.hint) f.snapHint = String(it.hint); // the screen it was saved on, or the game mode the tracker saw before the match
        if (it.meta) { try { f.snapMeta = JSON.parse(it.meta); } catch { /* no notes */ } } // what the tracker noticed during the match (how fast the opponent played)
        if (/json/.test(f.type)) { NATIVE.done(it.id); if (it.source === "webshop") { applyWebshopProgress(await f.text()); render(); continue; } try { svQuickSync(await f.text()); } catch { toast("Couldn't read that SnapVault file."); } continue; }
        const x = { file: f, status: "Reading…", native: it.id }; shots.items.push(x); trimShots();
        // The screenshots panel opens unless you're in another one (its unsaved changes would be lost)
        if (!opened && !sheetFn) { opened = true; openSheet(shotsSheet); } else refreshShots();
        const res = await readShotItem(x);
        x.done = true; x.file = null; refreshShots();
        if (res === "retry") { again = 0; break; }  // leave it in the queue; it's read next time SNAP Stat opens
        NATIVE.done(it.id);
        // Several in a row that couldn't be read: something's wrong beyond those pictures, so the rest wait
        fails = /^Couldn't read this one/.test(x.status || "") ? fails + 1 : 0;
        if (fails >= 3) { again = 0; toast("Three pictures in a row couldn't be read, so the rest are waiting. Check Settings › AI."); break; }
      }
    } finally { nat.busy = false; render(); if (typeof applyWebUpdate === "function") setTimeout(applyWebUpdate, 300); }
    natInfo(); if (again && num(nat.info.queue)) setTimeout(natPull, again);
  }, 0);
}

/* The tracker's rules for spotting the end of a match live on the website, so they can be tuned without a new app. */
// Before Android 1.18 the app can't wait for the screen to stop or tell pages apart by their picture, so those pages go on a timer
function rulesForApp(j, ver) { if (verCmp(ver, "1.18") < 0) j.screens = arr(j.screens).map((s) => (s && s.still ? { ...s, minGapSec: 4, maxPer: Math.min(40, num(s.maxPer) || 40), same: 0.6 } : s)); return j; }
async function natRules() {
  if (!NATIVE) return false;
  for (const u of catUrls("tracker-rules.json")) {
    try {
      const r = await fetch(u, { cache: "no-store" }); if (!r.ok) continue;
      const j = obj(await r.json());
      // Also look out for the events and limited-time modes running now, so a match can be tagged with its mode
      const modes = obj(j.modes);
      for (const name of modeNames()) if (!modes[name]) modes[name] = [String(name).toLowerCase()];
      j.modes = modes;
      j.turnShots = S.turnShots !== false;  // a picture of the board each turn, for the play-by-play
      rulesForApp(j, String(natInfo().version || "0"));
      if (NATIVE.setRules(JSON.stringify(j))) return true;
    } catch { /* next */ }
  }
  return false;
}

/* A newer Android app is on GitHub. (The rest of SNAP Stat comes from the website, so it's always up to date.) */
const natUpdateReady = () => num(nat.update.latest) > num(nat.update.current) && !!nat.update.url;
/* Every time SNAP Stat opens (or you come back to it), it asks GitHub for a newer app, at most once a minute. */
function natCheckSoon(first) {
  if (!natCan("checkUpdate") || nat.pct >= 0) return;
  if (!first && Date.now() - num(nat.checkedAt) < 60e3) return;
  nat.checkedAt = Date.now();
  try { NATIVE.checkUpdate(); } catch { /* older app */ }
}
// A pop-up when an update is ready: once each time the app is opened, and after any open panel is closed
function updatePopup() {
  if (!natUpdateReady() || nat.popped || nat.pct >= 0) return;
  const sh = $("#sheet"); if (sh && !sh.hidden) { nat.popWait = true; return; }
  nat.popped = Date.now(); nat.popWait = false; openSheet(updateSheet);
}
function updateSheet() {
  if (!natUpdateReady()) return `${sheetHead("You have the newest app")}<p class="muted small">SNAP Stat for Android ${esc(natInfo().version || "")} is up to date.</p>`;
  const busy = nat.pct >= 0;
  return `${sheetHead("App update ready", `SNAP Stat for Android 1.${esc(nat.update.latest)} · you have ${esc(natInfo().version || "an older one")}`)}
    <p class="small">It takes a few seconds: tap <b>Update now</b>, then <b>Update</b> (or <b>Install</b>) in Android's window.${nat.update.canInstall === false ? " Android will first ask you to allow SNAP Stat to install apps: turn it on, then come back." : ""}</p>
    <div class="row"><button class="btn snap" data-a="natUpdate" ${busy ? "disabled" : ""}>${busy ? `Downloading… ${nat.pct}%` : "Update now"}</button><button class="btn ghost" data-a="close">Later</button></div>
    <span class="muted small">If Google Play Protect says <b>Harmful app blocked</b>: tap <b>More details</b>, then <b>Install anyway</b>. Apps from outside the Play Store that record the screen get this warning until Google reviews them. This update is SNAP Stat's own, from its GitHub page.</span>
    ${nat.tried ? `<span class="muted small">Didn't update? <button class="btn sm ghost" data-a="natGetApk">Download it in Chrome</button> and open the file to install it.</span>` : ""}`;
}
function natUpdateBanner() {
  if (!NATIVE) return "";
  if (!natCan("updateInfo")) return `<section class="sec"><div class="panel row between nowrap"><div><b>Install the new Android app once</b><div class="small muted">After this one, app updates install with a tap.</div></div><button class="btn snap" data-a="natGetApk">Download</button></div></section>`;
  if (!natUpdateReady()) return "";
  const busy = nat.pct >= 0;
  return `<section class="sec"><div class="panel stack small"><div class="row between nowrap"><div><b>Android app update ready</b><div class="small muted">Version 1.${esc(nat.update.latest)}${busy ? ` · downloading ${nat.pct}%` : ". Takes a few seconds."}</div></div><button class="btn snap" data-a="natUpdate" ${busy ? "disabled" : ""}>${busy ? "Updating…" : "Update"}</button></div>
    ${nat.tried ? `<span class="muted">Didn't update? <button class="btn sm ghost" data-a="natGetApk">Download it in Chrome</button> and open the file to install it.</span>` : ""}</div></section>`;
}

function androidPanel() {
  if (!NATIVE) {
    if (!window.SNAPSTAT_STANDALONE || !/Android/i.test(navigator.userAgent)) return "";
    return `<section class="sec"><h2>Android app</h2><div class="panel stack small">
      <p>The SNAP Stat Android app reads your MARVEL SNAP screenshots on its own and can track your matches while you play. It's the same SNAP Stat, with the same account.</p>
      <div><a class="btn snap" href="${APK_URL}">Download the Android app</a></div>
      <span class="muted">Open the file once it downloads. If your phone asks, allow Chrome to install apps.</span></div></section>`;
  }
  const i = natInfo(), q = num(i.queue);
  return `<section class="sec"><h2>Android app</h2>${natUpdateBanner().replace(/^<section class="sec">|<\/section>$/g, "")}
    ${!aiOn() ? `<div class="panel small"><p class="note">Add your AI key in <b>AI features</b> below. The app keeps its own copy of your keys, so paste your Gemini key here once.</p></div>` : ""}
    <div class="panel stack small">
      <div class="row between"><b>Read new screenshots automatically</b>${i.autoShots ? `<button class="btn sm" data-a="natShots" data-v="0">Turn off</button>` : `<button class="btn sm snap" data-a="natShots" data-v="1">Turn on</button>`}</div>
      <span class="muted">Each time you open SNAP Stat, the screenshots you took in MARVEL SNAP since last time get read and logged. You don't have to share them.</span>
      ${i.autoShots && !i.photos ? `<p class="note">SNAP Stat needs to see your photos to find them. <button class="btn sm" data-a="natAsk" data-v="photos">Allow</button> Choose <b>Allow all</b>. If you don't see that, open <button class="btn sm ghost" data-a="natAsk" data-v="settings">App settings</button> › Permissions › Photos.</p>` : ""}
      ${i.usage ? `<span class="muted">✓ Usage access is on, so only screenshots taken in MARVEL SNAP are read.</span>` : `<p>Turn on <b>usage access</b> so SNAP Stat can tell which screenshots were taken in MARVEL SNAP, and the tracker only looks while the game is open. <button class="btn sm" data-a="natAsk" data-v="usage">Turn on usage access</button><br><span class="muted">In the list that opens, tap SNAP Stat and switch it on, then come back.</span></p>`}
    </div>
    ${widgetPanel()}
    <div class="panel stack small">
      <div class="row between"><b>Match tracker</b>${i.tracking ? `<span class="pill W">Tracking</span>` : `<span class="pill dim">Off</span>`}</div>
      <span class="muted">Watches your screen while MARVEL SNAP is open and saves the end of each match, so the AI can log the result, cubes, opponent, locations and cards. The screen is read on your phone. Only pictures of MARVEL SNAP are sent to your AI service: the end of each match, your board each turn, and screens like your alliance, shops and collection (those need usage access). Android asks you to allow screen recording each time you start. If it offers <b>A single app</b>, pick MARVEL SNAP.</span>
      <div class="row">${i.tracking ? `<button class="btn" data-a="natTrack" data-v="0">Stop tracking</button>${i.snap ? `<button class="btn snap" data-a="natSnap">Open MARVEL SNAP</button>` : ""}` : `<button class="btn snap" data-a="natPlay">${natCan("trackAndPlay") ? "Track & play" : "Start tracking"}</button>`}</div>
      ${i.tracking ? `<span class="muted">${num(i.captured) ? `${fmt(i.captured)} match${num(i.captured) === 1 ? "" : "es"} saved so far.` : "No new matches waiting. Play a game and they'll show up here."}</span>` : ""}
      ${q ? `<p class="note">${fmt(q)} picture${q === 1 ? "" : "s"} waiting to be read. ${canReadShots() ? `<button class="btn sm" data-a="natPull">Read now</button>` : "Add an AI key to read them."}</p>` : ""}
      <details data-natlog="1" ${nat.logOpen ? "open" : ""}><summary class="small">What the tracker saw</summary>
        <pre class="small" style="white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;margin:8px 0">${esc(nat.log || "Tap Refresh to see it.")}</pre>
        <div class="row"><button class="btn sm" data-a="natLogRefresh">Refresh</button><button class="btn sm" data-a="natLogCopy">${ICON.copy} Copy for Claude</button></div></details>
      <div class="row between"><span class="small">Every screenshot it's read, with what it found</span><button class="btn sm" data-a="reviewOpen">Review screenshots</button></div>
      ${turnShotsPanel()}
    </div>
    ${extHtml(EXT.settingsAndroid)}<div class="row between small"><span class="muted">App version ${esc(i.version || "?")}${natUpdateReady() ? ` · version 1.${esc(nat.update.latest)} is ready` : ""}</span>${natUpdateReady() ? `<button class="btn sm snap" data-a="natUpdate" ${nat.pct >= 0 ? "disabled" : ""}>${nat.pct >= 0 ? `Updating… ${nat.pct}%` : "Update now"}</button>` : natCan("checkUpdate") ? `<button class="btn sm ghost" data-a="natCheckUpdate">${nat.checking ? "Checking…" : "Check for an update"}</button>` : ""}</div></section>`;
}

// Asks the Android app to do something, if this version of it can. An older app gets a note to update, not a dead button.
function natTry(fn, ...args) { if (natCan(fn)) { try { NATIVE[fn](...args); return true; } catch { /* old app */ } } toast("Update the Android app to use this."); return false; }
Object.assign(A, {
  natShots: (el) => { if (!natTry("setAutoShots", el.dataset.v === "1")) return; natInfo(); render(); if (el.dataset.v === "1") toast("On. Screenshots you take in MARVEL SNAP from now on will be read."); },
  natAsk: (el) => { const v = el.dataset.v; natTry(v === "photos" ? "askPhotos" : v === "usage" ? "askUsage" : v === "notify" ? "askNotify" : "openAppSettings"); },
  natTrack: async (el) => {
    if (el.dataset.v === "1") { if (!aiOn()) toast("Add an AI key too, so saved matches can be read."); await natRules(); natTry("startTracker"); }
    else natTry("stopTracker");
    setTimeout(() => { natInfo(); refreshView(); }, 800);
  },
  natSnap: () => natTry("openSnap"),
  natUpdate: () => { if (!natCan("installUpdate")) { A.natGetApk(); return; } nat.pct = 0; nat.pctAt = Date.now(); refreshView(); NATIVE.installUpdate(); const stall = () => { if (nat.pct < 0) return; if (Date.now() - nat.pctAt < 25000) { setTimeout(stall, 5000); return; } nat.pct = -1; nat.tried = Date.now(); refreshView(); }; setTimeout(stall, 25000); },
  natCheckUpdate: () => { if (!natCan("checkUpdate")) return; nat.checking = Date.now(); refreshView(); NATIVE.checkUpdate(); setTimeout(() => { if (!nat.checking) return; nat.checking = 0; refreshView(); if (!natUpdateReady()) toast("You have the newest app."); }, 6000); },
  // (an older app without openUrl: a plain link, which the app opens in Chrome)
  natGetApk: () => { if (natCan("openUrl")) NATIVE.openUrl(APK_URL); else location.href = APK_URL; },
  natPull: () => natPull(),
  natLogRefresh: () => { nat.log = natCan("log") ? String(NATIVE.log() || "") : "This version of the app doesn't keep a log. Update it to see one."; nat.logOpen = true; render(); },
  natLogCopy: () => { nat.log = natCan("log") ? String(NATIVE.log() || "") : ""; copyText(nat.log || "(nothing yet)", "Copied. Paste it to Claude in your chat."); },
});
