/* ============ Swipe between a tab's sections: the page follows your finger ============
   Drag sideways anywhere on the page (the top bar, the cards, the empty space, the tab bar) and the page slides
   with you while the section you're heading to slides in beside it. Let go past about a third of the way (or flick)
   and it finishes; otherwise it springs back. The sections go round in a loop both ways.
   A row that scrolls sideways keeps the swipe until it reaches its end; then the page takes over.
   Never stuck: the page isn't redrawn under your finger, the gesture is followed even if the thing you touched
   disappears, and anything half-way is put back the moment you touch again, go Back or leave the app. */
EXT.styles.push(`
html:not(.zoomed) body { touch-action: pan-y pinch-zoom; }
html.swiping { overflow-x: clip; }
.view-peek { position: fixed; z-index: 1; display: flex; flex-direction: column; gap: 22px; padding-block: 18px 12px; pointer-events: none; will-change: transform; }
html.swiping #view { will-change: transform; }`);

const SWIPE_SLOP = 12;
var swipe = { st: "", sx: 0, sy: 0, ox: 0, lx: 0, lt: 0, vx: 0, dir: 0, key: "", tab: "", peek: null, geo: null, busy: false, cache: {}, target: null, last: 0, timer: 0 };
// render() waits while a finger is dragging the page or it's sliding into place (see i_actions.js)
function swipeHolding() { return !!(swipe && (swipe.st === "drag" || swipe.busy)); }

// The next section's page, drawn exactly as it will look, without changing where you are
function swipePeekHtml(key) {
  if (swipe.cache[key]) return swipe.cache[key]; // going back and forth in one drag draws each side once
  const n = NAV[ui.tab], old = ui[n.key], more = ui.more;
  try { ui[n.key] = key; ui.more = null; return (swipe.cache[key] = (VIEWS[ui.tab] || VIEWS.home)()); }
  catch (e) { console.error("swipe preview", e); return tabHead(ui.tab); }
  finally { ui[n.key] = old; ui.more = more; }
}
function swipeDropPeek() { document.querySelectorAll(".view-peek").forEach((p) => p.remove()); swipe.peek = null; swipe.key = ""; }
// Puts everything back where it belongs: no slide, no preview, nothing waiting
function swipeReset() {
  clearTimeout(swipe.timer);
  const v = $("#view"); if (v) { v.style.transition = ""; v.style.transform = ""; }
  swipeDropPeek(); document.documentElement.classList.remove("swiping");
  swipeUnlisten();
  Object.assign(swipe, { st: "", busy: false, dir: 0, cache: {}, target: null });
  if (typeof flushPendingRender === "function") setTimeout(flushPendingRender, 0);
}
// Puts the section on the side you're dragging toward next to the page (nothing if there isn't one that way)
function swipePeek(dir) {
  swipeDropPeek(); swipe.dir = dir;
  const key = swipeTarget(dir); if (!key) return;
  const g = swipe.geo, p = document.createElement("div");
  p.className = "view-peek"; p.setAttribute("aria-hidden", "true"); p.inert = true;
  p.style.left = g.left + "px"; p.style.width = g.width + "px"; p.style.top = g.viewTop + "px";
  p.style.transform = `translateX(${dir * g.D}px)`;
  p.innerHTML = swipePeekHtml(key);
  $("#view").after(p);
  // Where the new section will sit once it opens, so nothing jumps when it lands: the same rule route() uses,
  // after the page has got shorter or longer to fit the new section
  const most = Math.max(0, g.docH - g.viewH + p.offsetHeight - window.innerHeight), y = Math.min(g.y, most);
  const ny = g.hdBottom != null && y > g.hdBottom ? Math.max(0, g.hdTop - 8) : y;
  p.style.top = (g.viewTop + g.y - ny) + "px";
  const sn = p.querySelector(".subnav"), cur = sn && sn.querySelector('[aria-current="page"]');
  if (cur) sn.scrollLeft = Math.max(0, cur.offsetLeft - sn.clientWidth / 2 + cur.offsetWidth / 2);
  swipe.peek = p; swipe.key = key;
}
function swipeLock(dx) {
  const v = $("#view"), r = v.getBoundingClientRect(), hd = v.querySelector(".tabhead");
  swipe.geo = { left: r.left, width: r.width, viewTop: r.top, viewH: v.offsetHeight, y: window.scrollY, docH: document.documentElement.scrollHeight,
    hdTop: hd ? hd.offsetTop : null, hdBottom: hd ? hd.offsetTop + hd.offsetHeight : null, D: Math.max(r.right, window.innerWidth - r.left) + 24 }; // a small gap, so the rows that run edge to edge don't overlap
  swipe.st = "drag"; swipe.tab = ui.tab; swipe.cache = {}; swipe.ox = dx > 0 ? SWIPE_SLOP : -SWIPE_SLOP;
  document.documentElement.classList.add("swiping");
  swipePeek(dx < 0 ? 1 : -1);
  swipeWatch();
}
// If the finger's gone quiet for a few seconds mid-drag (the phone ate the "let go"), the page springs back by itself
function swipeWatch() {
  clearTimeout(swipe.timer);
  swipe.timer = setTimeout(() => { if (swipe.st === "drag" && !swipe.busy) { swipeEnd(0, true); swipe.st = ""; } }, 4000);
}
function swipeMove(dx) {
  const want = dx < 0 ? 1 : -1;
  if (dx !== 0 && want !== swipe.dir) swipePeek(want);
  const v = $("#view");
  if (!swipe.peek) { const s = Math.sign(dx) * Math.min(70, Math.abs(dx) / 3); v.style.transform = `translateX(${s}px)`; return; }
  v.style.transform = `translateX(${dx}px)`;
  swipe.peek.style.transform = `translateX(${swipe.dir * swipe.geo.D + dx}px)`;
}
function swipeEnd(dx, cancelled) {
  const v = $("#view"), p = swipe.peek, D = swipe.geo ? swipe.geo.D : window.innerWidth;
  const flick = Math.abs(swipe.vx) > 0.45 && -Math.sign(swipe.vx) === swipe.dir && Math.abs(dx) > 30;
  const done = !cancelled && p && ui.tab === swipe.tab && -Math.sign(dx) === swipe.dir && (Math.abs(dx) > D * 0.3 || flick);
  const left = done ? D - Math.abs(dx) : Math.abs(dx), ms = Math.round(Math.max(120, Math.min(260, left * 0.7)));
  const ease = `transform ${ms}ms cubic-bezier(.2,.75,.3,1)`;
  swipe.busy = true; swipeUnlisten(); clearTimeout(swipe.timer);
  v.style.transition = ease; v.style.transform = done ? `translateX(${-swipe.dir * D}px)` : "";
  if (p) { p.style.transition = ease; p.style.transform = done ? "translateX(0)" : `translateX(${swipe.dir * D}px)`; }
  const to = done ? `${ui.tab}/${swipe.key}` : "";
  swipe.timer = setTimeout(() => {
    // All in one go, before the screen redraws: the real section replaces the preview right where it was
    swipeReset();
    if (!to) return;
    try { history.pushState(null, "", "#" + to); route(); } catch { go(to); } // Back still returns to the section you came from
  }, ms + 20);
}

/* ---------- Following the finger ---------- */
function swipeOnMove(e) {
  if (e._swiped) return; e._swiped = true;
  if (!swipe.st || swipe.busy) return;
  swipe.last = Date.now();
  const t = e.touches[0];
  if (e.touches.length !== 1 || !t) { if (swipe.st === "drag") swipeEnd(0, true); swipe.st = ""; return; }
  const dx = t.clientX - swipe.sx, dy = t.clientY - swipe.sy;
  if (swipe.st === "wait") {
    if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { swipe.st = ""; swipeUnlisten(); return; } // scrolling up or down
    if (Math.abs(dx) < SWIPE_SLOP || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (!e.cancelable || swipeBlocked(swipe.target, dx)) { swipe.st = ""; swipeUnlisten(); return; } // a row that scrolls sideways, or the page already scrolling
    swipeLock(dx);
  }
  e.preventDefault();
  swipeWatch();
  const dt = e.timeStamp - swipe.lt;
  if (dt > 0) swipe.vx = 0.7 * ((t.clientX - swipe.lx) / dt) + 0.3 * swipe.vx;
  swipe.lx = t.clientX; swipe.lt = e.timeStamp;
  swipeMove(dx - swipe.ox);
}
function swipeOnEnd(e) {
  if (e._swiped) return; e._swiped = true;
  if (swipe.st === "drag" && !swipe.busy) {
    const t = e.changedTouches && e.changedTouches[0];
    if (e.timeStamp - swipe.lt > 100) swipe.vx = 0; // held still before letting go: not a flick
    swipeEnd(t ? t.clientX - swipe.sx - swipe.ox : 0, e.type === "touchcancel");
  }
  swipe.st = ""; swipeUnlisten();
}
// The touched element hears its own touch even if the page is redrawn and it's taken off the screen mid-swipe
function swipeListen(el) {
  swipeUnlisten(); if (!el || !el.addEventListener) return;
  swipe.target = el;
  el.addEventListener("touchmove", swipeOnMove, { passive: false });
  el.addEventListener("touchend", swipeOnEnd, { passive: true });
  el.addEventListener("touchcancel", swipeOnEnd, { passive: true });
}
function swipeUnlisten() {
  const el = swipe.target; if (!el || !el.removeEventListener) return;
  el.removeEventListener("touchmove", swipeOnMove, { passive: false });
  el.removeEventListener("touchend", swipeOnEnd, { passive: true });
  el.removeEventListener("touchcancel", swipeOnEnd, { passive: true });
}
function swipeStartsHere(el) {
  if (!el || !el.closest) return false;
  const sh = $("#sheet");
  if (sh && !sh.hidden) return false;
  if (window.__overlay || document.documentElement.classList.contains("zoomed")) return false;
  return !el.closest("#sheet, #toast, .view-peek, dialog, .err-toast");
}

(() => {
  document.addEventListener("touchstart", (e) => {
    if (swipe.busy) return;
    // A touch while something is still half-way (a lost "let go") puts the page straight back first
    const v = $("#view");
    if (swipe.st === "drag" || (v && v.style.transform) || document.querySelector(".view-peek")) swipeReset();
    swipe.st = "";
    if (e.touches.length !== 1 || !swipeStartsHere(e.target)) return;
    const n = NAV[ui.tab]; if (!n || !n.subs) return;
    const t = e.touches[0];
    Object.assign(swipe, { st: "wait", sx: t.clientX, sy: t.clientY, lx: t.clientX, lt: e.timeStamp, vx: 0, last: Date.now() });
    swipeListen(e.target);
  }, { passive: true, capture: true });
  // Kept on the whole page too: it keeps the browser asking before it scrolls, and catches anything the touched element missed
  document.addEventListener("touchmove", swipeOnMove, { passive: false });
  document.addEventListener("touchend", swipeOnEnd, { passive: true });
  document.addEventListener("touchcancel", swipeOnEnd, { passive: true });
  // Going Back, switching apps or turning the phone never leaves a page half-way
  window.addEventListener("popstate", () => { if (!swipe.busy) swipeReset(); });
  window.addEventListener("hashchange", () => { if (!swipe.busy) swipeReset(); }, true);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") swipeReset(); });
  window.addEventListener("resize", () => { if (swipe.st === "drag") swipeReset(); });
  // Zoomed in with two fingers: sideways moves pan the page, not the sections
  const vv = window.visualViewport;
  if (vv) vv.addEventListener("resize", () => document.documentElement.classList.toggle("zoomed", vv.scale > 1.05));
})();
