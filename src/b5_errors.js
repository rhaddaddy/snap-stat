/* ============ Problems show on screen ============
   Anything that fails (a page, a panel, a button, a background job) is written down here. A small bar says which part
   failed and what went wrong, with "Report it", which opens the bug report with the details already in it.
   The last 30 problems go with every bug report, so the app owner can see them too. */
const ERRLOG = [];
const _errSeen = {};
const ERR_QUIET = /ResizeObserver loop|^Script error\.?$|Failed to fetch|NetworkError|Load failed|network|AbortError|aborted|The operation was aborted|permission|insufficient permissions|quota|offline|unavailable|Firebase: Error \(auth\/(popup|cancelled|network)/i;
function errText(e) {
  if (!e) return "Unknown problem";
  if (typeof e === "string") return e;
  return String(e.message || e.reason || e.code || e).slice(0, 400);
}
function errEsc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
// Writes a problem down and, unless it's an everyday one (offline, a sign-in window closed), shows the bar once
function errNote(where, e, quiet) {
  const msg = errText(e), stack = String((e && e.stack) || "").split("\n").slice(0, 6).join("\n").slice(0, 900);
  ERRLOG.unshift({ at: Date.now(), where: String(where || "the app").slice(0, 80), msg, stack });
  ERRLOG.length = Math.min(ERRLOG.length, 30);
  if (quiet || ERR_QUIET.test(msg)) return;
  const key = where + "|" + msg; if (_errSeen[key]) return; _errSeen[key] = 1; // each problem shows once per visit
  errShow(where, msg);
}
function errShow(where, msg) {
  let bar = document.getElementById("err-toast");
  if (!bar) { bar = document.createElement("div"); bar.id = "err-toast"; bar.className = "err-toast"; bar.setAttribute("role", "alert"); document.body.appendChild(bar); }
  bar.innerHTML = `<div class="err-t"><b>Something went wrong in ${errEsc(where)}</b><span>${errEsc(msg)}</span></div>
    <div class="err-b"><button class="btn sm" data-a="errReport">Report it</button><button class="btn sm ghost" data-a="errHide" aria-label="Hide">✕</button></div>`;
  bar.hidden = false;
  clearTimeout(errShow.t); errShow.t = setTimeout(() => { bar.hidden = true; }, 15000);
}
window.addEventListener("error", (e) => {
  if (e && e.target && e.target !== window && (e.target.tagName === "IMG" || e.target.tagName === "SCRIPT" || e.target.tagName === "LINK")) return; // a picture or file that didn't load
  const f = String((e && e.filename) || "");
  if (f && !f.startsWith(location.origin)) return; // other sites' scripts (Firebase, browser extensions)
  errNote(e.lineno ? `the app (line ${e.lineno})` : "the app", e.error || e.message);
}, true);
window.addEventListener("unhandledrejection", (e) => errNote("a background job", e && e.reason));
EXT.styles.push(`
.err-toast { position: fixed; left: 12px; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); z-index: 60; max-width: 720px; margin: 0 auto;
  display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--loss) 22%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--loss) 60%, var(--line)); color: var(--fg); box-shadow: var(--shadow); }
.err-toast[hidden] { display: none; }
.err-toast .err-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.err-toast .err-t span { color: var(--muted); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.err-toast .err-b { display: flex; gap: 6px; flex: none; }
.err-page { text-align: center; }
.err-page code { display: block; margin-top: 8px; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }`);
// What a page shows instead of going blank when it fails to draw
function errPageHtml(where, e) {
  return `<section class="sec"><div class="panel stack small err-page"><b>This page couldn't load</b><span class="muted">Something in ${errEsc(where)} went wrong. The rest of the app still works.</span><code>${errEsc(errText(e))}</code>
    <div class="row" style="justify-content:center"><button class="btn sm" data-a="errRetry">Try again</button><button class="btn sm snap" data-a="errReport">Report it</button></div></div></section>`;
}
