/* ============ Nov 11 navigation (Ryan's reports MN95, HXER, HNWH) ============
   1 Tapping your name (top right) opens a menu: Profile, Settings and the pages people use most. Profile and Settings
     leave the bottom bar by default (Settings › App › Bottom bar puts them back), and Profile gets a gear to Settings.
   2 The bottom tabs can open where you left off (default) or always at their first section; tapping the tab you're
     already on goes to its first section.
   3 Scroll down and the row of sections at the top goes away; start scrolling up and it slides back in under the top bar. */

/* ---------- 1. The menu under your name ---------- */
const ME_MENU = () => [
  ["profile", "Profile", "Your picture, banner, details and posts"],
  ["settings/app", "Settings", "Look, AI keys, backup, account and more"],
  null,
  ["home/live", "Live match", ""], ["home/matches", "Matches", ""], ["home/missions", "Missions", ""], ["home/stats", "Stats", ""],
  ["cards/decks", "My decks", ""], ["cards/wish", "Wishlist", ""], ["social/alliance", "Alliance", ""],
  null,
  ["settings/data", "Import & backup", ""], ["settings/ai", "AI keys", ""], ...(NATIVE ? [["settings/android", "Android app", ""]] : []), ["settings/about", "About & your reports", ""],
];
const meMenu = { open: false };
function meMenuDraw() {
  let el = document.getElementById("memenu");
  if (!meMenu.open) { if (el) el.remove(); const c = document.getElementById("mechip"); if (c) c.setAttribute("aria-expanded", "false"); return; }
  if (!el) { el = document.createElement("div"); el.id = "memenu"; document.body.appendChild(el); }
  const hd = document.querySelector("header.top"), top = hd ? Math.round(hd.getBoundingClientRect().bottom) + 6 : 64;
  el.innerHTML = `<div class="mm-back" data-a="meMenuClose"></div><div class="mm panel" role="menu" aria-label="Your menu" style="top:${top}px">
    <div class="mm-who">${avatarHtml(S.me.avatar, S.me.handle || "?", store.uid || "me")}<div class="grow"><b>${esc(S.me.handle || "Set up your profile")}</b><span class="muted small">${S.me.rank ? "Rank " + esc(S.me.rank) : store.mode === "cloud" ? "Signed in" : "Saved on this device"}</span></div></div>
    ${ME_MENU().map((x) => (x ? `<button class="mm-i" role="menuitem" data-a="meMenuGo" data-to="${esc(x[0])}"><span>${esc(x[1])}</span>${x[2] ? `<span class="muted small">${esc(x[2])}</span>` : ""}</button>` : `<hr>`)).join("")}
    <button class="mm-i" role="menuitem" data-a="meMenuBug"><span>Report a bug or idea</span></button></div>`;
  const c = document.getElementById("mechip"); if (c) c.setAttribute("aria-expanded", "true");
}
(() => { const c = document.getElementById("mechip"); if (c) { c.dataset.a = "meMenu"; c.setAttribute("aria-haspopup", "menu"); c.setAttribute("aria-label", "Your menu"); } })();
window.addEventListener("hashchange", () => { if (meMenu.open) { meMenu.open = false; meMenuDraw(); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && meMenu.open) { meMenu.open = false; meMenuDraw(); } });

// Profile and Settings in the bottom bar: off unless you turn them on
const navFull = () => S.navFull === true;
function navBarApply() {
  const t = document.getElementById("tabs"); if (!t) return;
  t.querySelectorAll("button").forEach((b) => { const tab = String(b.dataset.tab || b.dataset.to || "").split("/")[0]; if (tab === "profile" || tab === "settings") b.hidden = !navFull(); });
  t.classList.toggle("tabs3", !navFull());
  const c = document.getElementById("mechip"); if (c) c.classList.toggle("on", ui.tab === "profile" || ui.tab === "settings");
}

/* ---------- 2. Bottom tabs: where you left off, or the first section ---------- */
const TAB_LAST = "snapstat.tabLast";
const tabOpenLast = () => S.tabOpen !== "first";
let tabLast = {}; try { tabLast = obj(JSON.parse(localStorage.getItem(TAB_LAST) || "{}")); } catch { tabLast = {}; }
function tabFirst(tab) { const n = NAV[tab]; return n && n.subs ? n.subs()[0][0] : ""; }
function tabsRetarget() {
  const n = NAV[ui.tab];
  if (n && n.key && ui[n.key] && tabLast[ui.tab] !== ui[n.key]) { tabLast[ui.tab] = ui[n.key]; try { localStorage.setItem(TAB_LAST, JSON.stringify(tabLast)); } catch { /* private mode */ } }
  document.querySelectorAll("#tabs button").forEach((b) => {
    if (!b.dataset.tab) b.dataset.tab = String(b.dataset.to || "").split("/")[0];
    const tab = b.dataset.tab, nv = NAV[tab]; if (!nv || !nv.subs) return;
    const ok = nv.subs().map(([k]) => k), first = ok[0];
    // Tapping the tab you're on goes to its first section; another tab opens where you were (if that's the setting)
    const sub = ui.tab === tab ? first : tabOpenLast() && ok.includes(tabLast[tab]) ? tabLast[tab] : first;
    b.dataset.to = `${tab}/${sub}`;
  });
}

/* ---------- 3. The sections row comes back when you scroll up ---------- */
const subFloat = { y: 0, up: 0, shown: false };
function subFloatEl() {
  let el = document.getElementById("subfloat");
  if (!el) { el = document.createElement("div"); el.id = "subfloat"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); }
  return el;
}
function subFloatHide() { const el = document.getElementById("subfloat"); if (el) el.classList.remove("show"); subFloat.shown = false; }
function subFloatShow() {
  const real = document.querySelector("#view .tabhead .subnav"); if (!real || swipeHolding() || (sheetFn && !$("#sheet").hidden)) return;
  const hd = document.querySelector("header.top"), top = hd ? hd.getBoundingClientRect().bottom : 0;
  if (real.getBoundingClientRect().bottom > top) { subFloatHide(); return; } // the real row is on the screen
  const el = subFloatEl();
  if (!subFloat.shown || el.dataset.tab !== ui.tab + "/" + (ui[obj(NAV[ui.tab]).key] || "")) {
    el.innerHTML = subNav(ui.tab); el.dataset.tab = ui.tab + "/" + (ui[obj(NAV[ui.tab]).key] || "");
    el.removeAttribute("aria-hidden");
    const sn = el.querySelector(".subnav"), cur = sn && sn.querySelector('[aria-current="page"]');
    if (cur) requestAnimationFrame(() => { sn.scrollLeft = Math.max(0, cur.offsetLeft - sn.clientWidth / 2 + cur.offsetWidth / 2); });
  }
  el.style.top = Math.round(top) + "px"; el.classList.add("show"); subFloat.shown = true;
}
window.addEventListener("scroll", () => {
  const y = window.scrollY, dy = y - subFloat.y; subFloat.y = y;
  if (S.subFloat === false || !document.querySelector("#view .tabhead .subnav")) { subFloatHide(); return; }
  if (dy < 0) { subFloat.up += -dy; if (subFloat.up > 24) subFloatShow(); }
  else if (dy > 0) { subFloat.up = 0; if (dy > 4 || y < 40) subFloatHide(); }
  if (subFloat.shown) { const real = document.querySelector("#view .tabhead .subnav"), hd = document.querySelector("header.top"); if (real && hd && real.getBoundingClientRect().bottom > hd.getBoundingClientRect().bottom) subFloatHide(); }
}, { passive: true });

/* ---------- Hooks, settings and actions ---------- */
EXT.afterRender.push(function y42Nav() {
  navBarApply(); tabsRetarget();
  if (subFloat.shown) { const el = document.getElementById("subfloat"); if (el) el.dataset.tab = ""; subFloatShow(); }
  if (meMenu.open) meMenuDraw();
  // A gear on the Profile page goes to Settings
  if (ui.tab === "profile") { const h = document.querySelector("#view .tabhead"); if (h && !h.querySelector(".prof-gear")) h.insertAdjacentHTML("beforeend", `<button class="btn sm ghost prof-gear" data-a="go" data-to="settings/app" aria-label="Settings">${ICON.gear || "⚙"} Settings</button>`); }
});
EXT.settingsApp.push(() => `<section class="sec"><h2>Bottom bar and tabs</h2><div class="panel stack small">
  <label class="check"><input type="checkbox" data-y42="navFull" ${navFull() ? "checked" : ""}> Show Profile and Settings in the bottom bar</label>
  <span class="muted">Either way, tap your name at the top right for Profile, Settings and the pages you use most.</span>
  <div><b>Tapping a bottom tab opens</b></div>
  <div class="seg" role="group" aria-label="Tapping a bottom tab opens"><button data-a="y42TabOpen" data-v="last" aria-pressed="${tabOpenLast()}">Where I left off</button><button data-a="y42TabOpen" data-v="first" aria-pressed="${!tabOpenLast()}">Its first section</button></div>
  <span class="muted">Tapping the tab you're already on always goes to its first section.</span>
  <label class="check"><input type="checkbox" data-y42="subFloat" ${S.subFloat === false ? "" : "checked"}> Bring back the row of sections when I scroll up</label></div></section>`);
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.y42) return;
  const k = t.dataset.y42; S[k] = !!t.checked; save(); if (k === "subFloat" && !t.checked) subFloatHide(); render();
});
Object.assign(A, {
  meMenu: () => { meMenu.open = !meMenu.open; meMenuDraw(); },
  meMenuClose: () => { meMenu.open = false; meMenuDraw(); },
  meMenuGo: (el) => { meMenu.open = false; meMenuDraw(); go(el.dataset.to); },
  meMenuBug: () => { meMenu.open = false; meMenuDraw(); bugOpen({}); },
  y42TabOpen: (el) => { S.tabOpen = el.dataset.v === "first" ? "first" : "last"; save(); render(); },
});
EXT.search.push((q) => (/menu|bottom bar|tabs?|left off|profile|settings/i.test(q) ? [{ label: "Bottom bar and tabs", sub: "Settings › App", route: "settings/app" }] : []));
EXT.styles.push(`
#memenu .mm-back { position: fixed; inset: 0; z-index: 40; background: rgba(0,0,0,.25); }
#memenu .mm { position: fixed; right: max(10px, env(safe-area-inset-right, 0px)); z-index: 41; width: min(320px, calc(100vw - 20px)); max-height: calc(100vh - 160px); overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 12px 32px rgba(0,0,0,.45); }
#memenu .mm-who { display: flex; gap: 10px; align-items: center; padding: 6px 8px 10px; }
#memenu .mm-who .grow { display: flex; flex-direction: column; min-width: 0; }
#memenu .mm-i { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; background: none; border: 0; color: var(--fg); font: inherit; font-weight: 600; padding: 10px; min-height: 42px; border-radius: 10px; cursor: pointer; }
#memenu .mm-i:hover, #memenu .mm-i:focus-visible { background: var(--surface-2); }
#memenu .mm-i .muted { font-weight: 400; }
#memenu hr { border: 0; border-top: 1px solid var(--line); margin: 4px 6px; width: auto; }
.me-chip { cursor: pointer; }
.me-chip.on { border-color: var(--snap-a); background: var(--snap-soft); }
.tabs.tabs3 { grid-template-columns: repeat(3, 1fr); }
.tabs button[hidden] { display: none; }
.tabhead .prof-gear { align-self: flex-start; }
#subfloat { position: fixed; left: 0; right: 0; z-index: 4; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line);
  transform: translateY(-110%); opacity: 0; transition: transform .2s ease, opacity .2s ease; pointer-events: none; }
#subfloat.show { transform: none; opacity: 1; pointer-events: auto; }
#subfloat .subnav { max-width: 780px; margin: 0 auto; padding: 6px 16px; }
body.ssm-on #subfloat, html.overlay #subfloat { display: none; }`);
