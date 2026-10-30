/* ============ Keeping the web app itself up to date ============
   The Android app (and an installed web app) can stay open in the background for days, so the page you see can be
   older than the website. Each time you come back to SNAP Stat it checks version.json, and when a newer version
   is out it loads it, as long as you're not in the middle of something (a panel open, typing, screenshots being
   read). If you are, it waits until that's done. */
const BUILD = String(window.SNAPSTAT_BUILD || "");
const webUp = { at: 0, busy: false, ready: "", backAt: 0 };
const WEBUP_KEY = "snapstat.webUp";
let webUpdateMs = 60e3; // how long after coming back an update may still load (tests shorten it)

async function checkWebUpdate(force) {
  if (!BUILD || webUp.busy || !/^https?:$/.test(location.protocol)) return;
  if (!force && Date.now() - webUp.at < 30e3) { applyWebUpdate(); return; }
  webUp.busy = true; webUp.at = Date.now();
  try {
    const r = await fetch("version.json", { cache: "no-store" });
    if (r.ok) { const b = String(obj(await r.json()).build || ""); webUp.ready = b && b !== BUILD ? b : ""; }
  } catch { /* offline: try again next time */ } finally { webUp.busy = false; }
  applyWebUpdate();
}
function webUpdateSafe() {
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return false;
  if (typeof sheetFn !== "undefined" && sheetFn) return false;
  if (typeof filePicking === "function" && filePicking()) return false;
  if (typeof nat !== "undefined" && (nat.busy || nat.pct >= 0)) return false;
  if (typeof shotBusy !== "undefined" && shotBusy) return false;
  if (typeof live !== "undefined" && live.on && Date.now() - num(live.started) < 45 * 60e3) return false;
  return true;
}
async function applyWebUpdate() {
  const b = webUp.ready; if (!b || webUp.loading) return;
  // Only right after you come back to the app, so it never reloads under your finger
  if (Date.now() - webUp.backAt > webUpdateMs) return;
  if (!webUpdateSafe()) return;
  // Tried this one a moment ago and still got the old page: leave it for next time
  let last = {}; try { last = JSON.parse(sessionStorage.getItem(WEBUP_KEY) || "{}"); } catch { /* none */ }
  if (last.b === b && Date.now() - num(last.at) < 10 * 60e3) return;
  webUp.loading = true;
  try {
    // Fetch the new page first, so the reload gets it rather than a copy the phone saved earlier
    const page = location.href.split("#")[0];
    const html = await (await fetch(page, { cache: "reload" })).text();
    if (!html.includes(`SNAPSTAT_BUILD = "${b}"`)) return;
    if (!webUpdateSafe()) return;
    try { sessionStorage.setItem(WEBUP_KEY, JSON.stringify({ b, at: Date.now() })); } catch { /* fine */ }
    if (dirty) await flushState();
    if (dirtyWeeks.size) await flushWeeks();
    location.reload();
  } catch { /* offline */ } finally { webUp.loading = false; }
}
function cameBack() { webUp.backAt = Date.now(); checkWebUpdate(false); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) cameBack(); });
window.addEventListener("focus", () => { if (Date.now() - webUp.backAt > 5e3) cameBack(); });
// Opening the app counts as coming back too
webUp.backAt = Date.now(); setTimeout(() => checkWebUpdate(true), 4000);
// Just updated: say so once
try { const last = JSON.parse(sessionStorage.getItem(WEBUP_KEY) || "{}"); if (last.b && last.b === BUILD) { sessionStorage.removeItem(WEBUP_KEY); setTimeout(() => toast("SNAP Stat updated to the newest version"), 1200); } } catch { /* fine */ }
