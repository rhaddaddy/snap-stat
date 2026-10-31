/* ============ Swipe between a tab's sections: the page follows your finger ============
   Drag sideways and the page slides with you while the section you're heading to slides in beside it.
   Let go past about a third of the way (or flick) and it finishes; otherwise it springs back.
   After the last section the next one is the first again; before the first there's nothing, so it just stretches a little.
   Rows that scroll sideways, fields and open sheets keep their own swipes (swipeBlocked in x_nav.js). */
EXT.styles.push(`
html.swiping { overflow-x: clip; }
.view-peek { position: fixed; z-index: 1; display: flex; flex-direction: column; gap: 22px; padding-block: 18px 12px; pointer-events: none; will-change: transform; }
html.swiping #view { will-change: transform; }`);

const SWIPE_SLOP = 12;
const swipe = { st: "", sx: 0, sy: 0, ox: 0, lx: 0, lt: 0, vx: 0, dir: 0, key: "", tab: "", peek: null, geo: null, busy: false, cache: {} };

// The next section's page, drawn exactly as it will look, without changing where you are
function swipePeekHtml(key) {
  if (swipe.cache[key]) return swipe.cache[key]; // going back and forth in one drag draws each side once
  const n = NAV[ui.tab], old = ui[n.key], more = ui.more;
  try { ui[n.key] = key; ui.more = null; return (swipe.cache[key] = (VIEWS[ui.tab] || VIEWS.home)()); }
  catch (e) { console.error("swipe preview", e); return tabHead(ui.tab); }
  finally { ui[n.key] = old; ui.more = more; }
}
function swipeDropPeek() { if (swipe.peek) swipe.peek.remove(); swipe.peek = null; swipe.key = ""; }
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
  const v = $("#view"), p = swipe.peek, D = swipe.geo.D;
  const flick = Math.abs(swipe.vx) > 0.45 && -Math.sign(swipe.vx) === swipe.dir && Math.abs(dx) > 30;
  const done = !cancelled && p && ui.tab === swipe.tab && -Math.sign(dx) === swipe.dir && (Math.abs(dx) > D * 0.3 || flick);
  const left = done ? D - Math.abs(dx) : Math.abs(dx), ms = Math.round(Math.max(120, Math.min(260, left * 0.7)));
  const ease = `transform ${ms}ms cubic-bezier(.2,.75,.3,1)`;
  swipe.busy = true;
  v.style.transition = ease; v.style.transform = done ? `translateX(${-swipe.dir * D}px)` : "";
  if (p) { p.style.transition = ease; p.style.transform = done ? "translateX(0)" : `translateX(${swipe.dir * D}px)`; }
  const to = done ? `${ui.tab}/${swipe.key}` : "";
  setTimeout(() => {
    // All in one go, before the screen redraws: the real section replaces the preview right where it was
    v.style.transition = ""; v.style.transform = "";
    swipeDropPeek(); document.documentElement.classList.remove("swiping");
    swipe.busy = false; swipe.dir = 0; swipe.cache = {};
    if (!to) return;
    try { history.pushState(null, "", "#" + to); route(); } catch { go(to); } // Back still returns to the section you came from
  }, ms + 20);
}

(() => {
  const host = document.getElementById("view") || document;
  host.addEventListener("touchstart", (e) => {
    if (swipe.busy) return;
    swipe.st = "";
    const sh = $("#sheet");
    if (e.touches.length !== 1 || (sh && !sh.hidden) || !e.target.closest || !e.target.closest("#view") || swipeBlocked(e.target)) return;
    const n = NAV[ui.tab]; if (!n || !n.subs) return;
    const t = e.touches[0];
    Object.assign(swipe, { st: "wait", sx: t.clientX, sy: t.clientY, lx: t.clientX, lt: e.timeStamp, vx: 0 });
  }, { passive: true });
  host.addEventListener("touchmove", (e) => {
    if (!swipe.st || swipe.busy) return;
    const t = e.touches[0];
    if (e.touches.length !== 1 || !t) { if (swipe.st === "drag") swipeEnd(0, true); swipe.st = ""; return; }
    const dx = t.clientX - swipe.sx, dy = t.clientY - swipe.sy;
    if (swipe.st === "wait") {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { swipe.st = ""; return; } // scrolling up or down
      if (Math.abs(dx) < SWIPE_SLOP || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (!e.cancelable) { swipe.st = ""; return; } // the page is already scrolling
      swipeLock(dx);
    }
    e.preventDefault();
    const dt = e.timeStamp - swipe.lt;
    if (dt > 0) swipe.vx = 0.7 * ((t.clientX - swipe.lx) / dt) + 0.3 * swipe.vx;
    swipe.lx = t.clientX; swipe.lt = e.timeStamp;
    swipeMove(dx - swipe.ox);
  }, { passive: false });
  const end = (e) => {
    if (swipe.st === "drag" && !swipe.busy) {
      const t = e.changedTouches && e.changedTouches[0];
      if (e.timeStamp - swipe.lt > 100) swipe.vx = 0; // held still before letting go: not a flick
      swipeEnd(t ? t.clientX - swipe.sx - swipe.ox : 0, e.type === "touchcancel");
    }
    swipe.st = "";
  };
  host.addEventListener("touchend", end, { passive: true });
  host.addEventListener("touchcancel", end, { passive: true });
})();
