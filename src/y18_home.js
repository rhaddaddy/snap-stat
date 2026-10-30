/* ============ y18_home.js: Home, reminders and quality of life ============
   Global search (the magnifier in the top bar, or press /), keyboard shortcuts, a true-black dark mode and text size,
   "What's new", an offline bar and a saving indicator, which Home panels to show, reminders, a backup nudge, an
   install nudge, the health of the daily data files, and quick actions for the match you just logged.
   Other features can name their Home panel so it can be hidden here: give the function you push onto EXT.homeTop an
   `.ext = { id: "myPanel", label: "My panel" }` and `homeShow("myPanel")` decides whether it shows. */

/* ---------- Small shared bits ---------- */
const Y18_SEARCH_ICON = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
// The address a result opens: "#home/missions" or "home/missions" both work with go()
const y18Route = (r) => String(r || "").replace(/^#/, "");
// "2026-10-29T11:03:26Z" → how long ago, in words; "" when a file has no date
function y18AgoIso(iso) { const t = Date.parse(String(iso || "")); return Number.isFinite(t) ? agoTxt(t) : ""; }

/* ============ 1. Global search ============ */
const gs = { q: "", t: null };
// Everywhere the app can take you, built from the tabs and their sections, plus a few extra words people search for
function gsPlaces() {
  const out = [];
  for (const [tab, n] of Object.entries(NAV)) {
    if (!n.subs) { out.push({ label: n.title, sub: "Your profile, posts and badges", route: tab, words: "profile avatar banner badges name rank" }); continue; }
    let subs = []; try { subs = n.subs(); } catch { subs = []; }
    for (const [k, l] of subs) out.push({ label: String(l).replace(/ \(\d+\)$/, "").replace(" ●", ""), sub: n.title, route: `${tab}/${k}`, words: "" });
  }
  const extra = [
    ["Notifications", "Settings › App", "settings/app", "alerts remind push"], ["Look: colors, light or dark", "Settings › App", "settings/app", "theme accent color dark mode light mode true black oled"],
    ["Text size", "Settings › App", "settings/app", "font bigger smaller large small"], ["Home screen panels", "Settings › App", "settings/app", "hide show layout"],
    ["Reminders", "Settings › App", "settings/app", "season event missions spotlight alliance"], ["Keyboard shortcuts", "Settings › App", "settings/app", "keys hotkeys"],
    ["What's new in SNAP Stat", "Settings › App", "settings/app", "changelog version update release notes"], ["Backup, restore and spreadsheets", "Settings › Import & backup", "settings/data", "export csv copy restore erase"],
    ["Import the game's files", "Settings › Import & backup", "settings/data", "collectionstate json pc snapvault"], ["AI keys", "Settings › AI", "settings/ai", "claude gemini chatgpt key"],
    ["Sign in or out", "Settings › Account", "settings/account", "google account login logout"], ["Quick log a match", "Home › Matches", "home/matches", "log win loss cubes"],
    ["Daily reset clock", "Home › Overview", "home/overview", "reset timer refresh countdown"], ["Web shop free credits", "Home › Overview", "home/overview", "webshop claim"],
  ];
  for (const [label, sub, route, words] of extra) out.push({ label, sub, route, words });
  return out;
}
// Everything that matches what you typed, best matches first, at most 30
function gsResults(q0) {
  const q = String(q0 || "").trim().toLowerCase(); if (q.length < 1) return [];
  const qk = keyOf(q), out = [];
  // score: 3 = the name starts with it, 2 = the name has it, 1 = only the details have it
  const sc = (name, more) => { const n = String(name || "").toLowerCase(); if (n.startsWith(q) || keyOf(n).startsWith(qk)) return 3; if (n.includes(q) || (qk && keyOf(n).includes(qk))) return 2; return String(more || "").toLowerCase().includes(q) ? 1 : 0; };
  const add = (s, kind, r) => { if (s) out.push({ s, kind, ...r }); };
  // Places in the app
  for (const p of gsPlaces()) add(sc(p.label, p.sub + " " + p.words), 0, { label: p.label, sub: p.sub, a: "go", d: { to: p.route } });
  // Your decks
  for (const d of arr(S.decks)) add(sc(d.name, arr(d.tags).join(" ")), 1, { label: d.name, sub: `Deck · ${arr(d.cards).length} cards${d.status && d.status !== "active" ? " · " + d.status : ""}`, a: "deckOpen", d: { id: d.id } });
  // Cards: by name, then by what the ability says
  if (q.length >= 2) {
    let cards = []; try { cards = allCards(); } catch { cards = []; }
    for (const c of cards) { if (c.hidden || (c.upcoming && !showSoon())) continue; const s = sc(c.name, c.ability); add(s, 2, { label: c.name, sub: `${c.cost}-cost ${c.power}-power${c.ability ? " · " + String(c.ability).slice(0, 70) : ""}`, a: "cardOpen", d: { k: c.key } }); }
    // Locations
    let locs = []; try { locs = allLocations(); } catch { locs = []; }
    for (const l of locs) add(sc(l.name, l.ability), 3, { label: l.name, sub: `Location · ${String(l.ability || "").slice(0, 70)}`, a: "locOpen", d: { name: l.name } });
  }
  // Seasons and events
  try { for (const s of seasons()) add(sc(s.name, "season"), 4, { label: s.name, sub: `Season · ${timeState(s) === "live" ? "on now" : timeState(s) === "upcoming" ? "starts " + dateStr(s.start) : "ended " + dateStr(s.end || s.start)}`, a: "seasonOpen", d: { id: s.id } }); } catch { /* no seasons yet */ }
  try { for (const e of events()) add(sc(e.name, (EVENT_TYPES[e.type] || "event") + " event"), 5, { label: e.name, sub: `${EVENT_TYPES[e.type] || "Event"} · ${timeState(e) === "live" ? "on now" : timeState(e) === "upcoming" ? "starts " + dateStr(e.start) : "ended"}`, a: "eventOpen", d: { id: e.id } }); } catch { /* none */ }
  // People you follow (signed in only)
  if (store.mode === "cloud") for (const id of arr(S.following).slice(0, 300)) { const h = handleOf(id); if (h && h !== "Player") add(sc(h, ""), 6, { label: h, sub: "Player you follow", a: "profileOpen", d: { id } }); }
  // Anything other features offer
  for (const f of arr(EXT.search)) { try { for (const r of arr(f(q)).slice(0, 10)) if (r && r.label) add(sc(r.label, r.sub) || 1, 7, { label: String(r.label), sub: String(r.sub || ""), a: "go", d: { to: y18Route(r.route) } }); } catch (e) { console.error("search", e); } }
  out.sort((a, b) => b.s - a.s || a.kind - b.kind || String(a.label).localeCompare(String(b.label)));
  return out.slice(0, 30);
}
function gsRow(r, i) {
  const data = Object.entries(r.d || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ");
  const sub = esc(r.sub);
  return `<button class="li" data-a="${esc(r.a)}" ${data} ${i === 0 ? 'data-gsfirst="1"' : ""}><div class="grow"><div class="t">${esc(r.label)}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div><span class="muted">›</span></button>`;
}
function gsResultsHtml() {
  const q = String(gs.q || "").trim();
  if (!q) return `<div class="list">${[["What's new in SNAP Stat", whatsNewUnseen() ? "New since you last looked" : "The latest changes", "whatsNewOpen"], ["Keyboard shortcuts", "Press ? any time", "shortcutsOpen"]].map(([l, s, a]) => `<button class="li" data-a="${a}"><div class="grow"><div class="t">${l}${a === "whatsNewOpen" && whatsNewUnseen() ? ' <i class="y18-dot inline" aria-hidden="true"></i>' : ""}</div><div class="s">${s}</div></div><span class="muted">›</span></button>`).join("")}</div>
    <p class="muted small">Try a card's name or something it does ("destroy"), a deck, a location, a season, a player you follow, or a page like "shops".</p>`;
  const rs = gsResults(q);
  if (!rs.length) return `<div class="empty"><strong>Nothing found for “${esc(q.slice(0, 40))}”</strong><span>Check the spelling, or try fewer letters.</span></div>`;
  return `<div class="list">${rs.map(gsRow).join("")}</div>${rs.length >= 30 ? `<p class="muted small">Showing the best 30. Type more to narrow it down.</p>` : ""}`;
}
function gsSheet() {
  return `${sheetHead("Search", "Cards, decks, locations, seasons, events, people and pages")}
    <input type="search" id="gs-q" data-gsq="1" data-autofocus value="${esc(gs.q)}" placeholder="Search SNAP Stat…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search" enterkeyhint="go">
    <div id="gs-results">${gsResultsHtml()}</div>
    <button class="btn snap block" data-a="close">Done</button>`;
}
function gsUpdate() { const box = $("#gs-results"); if (box && sheetFn === gsSheet) box.innerHTML = gsResultsHtml(); }
Object.assign(A, {
  gsOpen: () => { gs.q = ""; openSheet(gsSheet); const n = $("#gs-q"); if (n) { n.focus(); try { n.select(); } catch { /* fine */ } } },
});
document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.gsq) { gs.q = t.value; clearTimeout(gs.t); gs.t = setTimeout(gsUpdate, 120); } });
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target && e.target.id === "gs-q") { e.preventDefault(); clearTimeout(gs.t); gsUpdate(); const b = $('#gs-results [data-gsfirst]') || $("#gs-results [data-a]"); if (b) b.click(); }
});
EXT.topBar.push(() => `<button class="btn sm ghost icon y18-gs" data-a="gsOpen" aria-label="Search SNAP Stat" title="Search (press /)">${Y18_SEARCH_ICON}${whatsNewUnseen() ? '<i class="y18-dot" aria-hidden="true"></i>' : ""}</button>`);

/* ============ 2. Keyboard shortcuts (a keyboard, not while typing) ============ */
const Y18_KEYS = [["/", "Search"], ["g then h", "Go to Home"], ["g then c", "Go to Cards"], ["g then s", "Go to Social"], ["g then p", "Go to Profile"], ["g then e", "Go to Settings"], ["l", "Quick log a match"], ["Esc", "Close the open panel"], ["?", "This list"]];
let y18GoAt = 0;
function shortcutsSheet() {
  return `${sheetHead("Keyboard shortcuts", "When you use SNAP Stat with a keyboard")}
    <div class="list">${Y18_KEYS.map(([k, l]) => `<div class="li"><div class="grow"><div class="t">${esc(l)}</div></div><kbd class="y18-kbd">${esc(k)}</kbd></div>`).join("")}</div>
    <p class="muted small">Shortcuts pause while you're typing in a field.</p>
    <button class="btn snap block" data-a="close">Done</button>`;
}
Object.assign(A, { shortcutsOpen: () => openSheet(shortcutsSheet) });
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const t = e.target; if (t && t !== document.body && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  const k = e.key;
  if (k === "/") { e.preventDefault(); A.gsOpen(); return; }
  if (k === "?") { e.preventDefault(); openSheet(shortcutsSheet); return; }
  if (sheetFn) return; // the rest only when no panel is open
  if (k === "g") { y18GoAt = Date.now(); return; }
  const tab = { h: "home", c: "cards", s: "social", p: "profile", e: "settings" }[k];
  if (tab && Date.now() - y18GoAt < 1500) { y18GoAt = 0; e.preventDefault(); go(tab); return; }
  if (k === "l" && typeof A.quickOpen === "function") { e.preventDefault(); A.quickOpen(); }
});

/* ============ 3 & 4. Two more colors, a true-black dark mode and text size ============ */
// The app already has a Look panel with colors (S.look.accent) and light/dark (S.look.mode). These add to it.
if (typeof LOOKS === "object" && LOOKS) Object.assign(LOOKS, {
  pink: { name: "Pink", a: "#FFB3D9", b: "#E0409A", text: "#FF9ED1", lightText: "#B8237A", g1: "rgba(255, 90, 180, .26)", g2: "rgba(255, 180, 230, .12)" },
  teal: { name: "Teal", a: "#9FF5E8", b: "#149E96", text: "#8FE8DC", lightText: "#0C7A74", g1: "rgba(20, 180, 170, .24)", g2: "rgba(120, 255, 240, .10)" },
});
// Text size: the root size the brief asks for, and every font size in the app's styles scaled to match. The app's sizes
// are all in px (no rem), so changing html's size alone would change nothing.
const Y18_TEXT = { small: 15, large: 18 }; // Default is 16
const _y18Fonts = { f: 0, n: -1, css: "" };
function y18ScaledFonts(f) {
  const n = document.styleSheets.length; if (_y18Fonts.f === f && _y18Fonts.n === n) return _y18Fonts.css;
  const out = [];
  // The logo in the top bar stays its size, so it keeps room next to the search button
  const one = (r, list) => { const m = /^([\d.]+)px$/.exec((r.style && r.style.fontSize) || ""); if (m && r.selectorText && !/\.brand\b/.test(r.selectorText)) list.push(`${r.selectorText} { font-size: ${Math.round(+m[1] * f * 2) / 2}px${r.style.getPropertyPriority("font-size") ? " !important" : ""} }`); };
  for (const sh of Array.from(document.styleSheets)) {
    if (sh.ownerNode && sh.ownerNode.id === "y18-screen") continue;
    let rules; try { rules = sh.cssRules; } catch { continue; } // a stylesheet from another site (the fonts) can't be read
    for (const r of Array.from(rules || [])) {
      if (r.type === 1) one(r, out);
      else if (r.type === 4) { const inner = []; for (const x of Array.from(r.cssRules || [])) if (x.type === 1) one(x, inner); if (inner.length) out.push(`@media ${r.media.mediaText} { ${inner.join("\n")} }`); }
    }
  }
  Object.assign(_y18Fonts, { f, n, css: out.join("\n") }); return _y18Fonts.css;
}
let _y18ScreenSig = "";
// Applied after every draw (cheap: nothing happens unless a setting changed) and so also on boot, once your saved look loads.
function applyScreen() {
  const L = obj(S.look), text = Y18_TEXT[L.text] ? L.text : "default", black = !!L.black;
  let st = document.getElementById("y18-screen");
  const sig = text + "|" + black + "|" + (text === "default" ? 0 : document.styleSheets.length);
  if (sig === _y18ScreenSig && st) { if (st !== document.head.lastElementChild) document.head.appendChild(st); return; }
  _y18ScreenSig = sig;
  if (!st) { st = document.createElement("style"); st.id = "y18-screen"; }
  document.head.appendChild(st); // last, so it wins over the app's own sizes
  const px = Y18_TEXT[text];
  const txt = px ? `html { font-size: ${px}px; }\n${y18ScaledFonts(px / 16)}\nheader.top .me-chip { font-size: 15px; }` : ""; // the top bar keeps its size
  // True black: the background goes to pure black for OLED screens; panels keep a hint of the app's purple so they still stand out
  const dark = `--bg: #000000; --bg-2: #000000; --glow-1: transparent; --glow-2: transparent; --surface: #0D0B16; --surface-2: #17132A; --line: #2A2440; --dot: rgba(255, 255, 255, .05); --shadow: 0 18px 40px rgba(0, 0, 0, .8);`;
  const blk = black ? `:root[data-theme="dark"] { ${dark} } @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }` : "";
  st.textContent = txt + "\n" + blk;
}
EXT.afterRender.push(applyScreen);
function screenHtml() {
  const L = obj(S.look), text = Y18_TEXT[L.text] ? L.text : "default";
  const b = (v, l) => `<button data-a="lookText" data-v="${v}" aria-pressed="${text === v}">${l}</button>`;
  return `<section class="sec"><h2>Text and screen</h2><div class="panel stack small">
    <span class="eyebrow">Text size</span><div class="seg">${b("small", "Small")}${b("default", "Default")}${b("large", "Large")}</div>
    <label class="toggle-row check"><span><b>True black</b><br><span class="muted">Pure black background in dark mode. Easier on the eyes and on OLED batteries.</span></span><input type="checkbox" data-lookchk="black" ${L.black ? "checked" : ""}></label></div></section>`;
}
Object.assign(A, { lookText: (el) => { S.look = { ...obj(S.look), text: el.dataset.v }; if (S.look.text === "default") delete S.look.text; save(); render(); } });
document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.lookchk) { S.look = { ...obj(S.look), [t.dataset.lookchk]: t.checked }; if (!t.checked) delete S.look[t.dataset.lookchk]; save(); render(); } });

/* ============ 5. What's new ============ */
// Newest first. Ryan fills in the real entries; the build id is what tells the app you haven't seen the newest version yet.
const CHANGELOG = [
  { date: "2026-10-30", title: "Game files import reads everything", body: "Choosing the game's CollectionState.json now brings in every card, variant, avatar, emote, card back, deck, Custom Card, booster count, upgrade level, split and your Collection Level in one go." },
  { date: "2026-10-30", title: "Saved data takes less room", body: "Your variants are stored in a compact form, so a big collection fits comfortably in one account and syncs faster." },
  { date: "2026-10-30", title: "PC tracker", body: "If you play MARVEL SNAP on a PC, SNAP Stat can follow your games from the game's own files: decks, results and cubes, with no screenshots." },
];
function whatsNewUnseen() { return !!BUILD && obj(S.whatsNew).seenBuild !== BUILD; }
function whatsNewSheet() {
  return `${sheetHead("What's new in SNAP Stat", BUILD ? `Version ${esc(BUILD.slice(0, 7))}` : "")}
    <div class="list">${CHANGELOG.slice(0, 30).map((c) => `<div class="li" style="align-items:flex-start"><div class="grow" style="white-space:normal"><div class="t" style="white-space:normal">${esc(c.title)}</div><div class="s" style="white-space:normal">${esc(c.body)}</div><div class="muted small" style="margin-top:4px">${esc(dateStr(c.date))}</div></div></div>`).join("")}</div>
    <button class="btn snap block" data-a="close">Done</button>`;
}
Object.assign(A, {
  whatsNewOpen: () => { const was = whatsNewUnseen(); if (BUILD) { S.whatsNew = { seenBuild: BUILD }; save(); } openSheet(whatsNewSheet); if (was) render(); },
});
function aboutAppHtml() {
  return `<section class="sec"><h2>About the app</h2><div class="panel stack small">
    <div class="row"><button class="btn" data-a="whatsNewOpen">What's new in SNAP Stat${whatsNewUnseen() ? ' <i class="y18-dot inline" aria-hidden="true"></i>' : ""}</button><button class="btn ghost" data-a="shortcutsOpen">Keyboard shortcuts</button></div>
    <span class="muted">On a keyboard: press <kbd class="y18-kbd">/</kbd> to search, <kbd class="y18-kbd">l</kbd> to quick log, <kbd class="y18-kbd">?</kbd> for the whole list.${BUILD ? ` Version ${esc(BUILD.slice(0, 7))}.` : ""}</span></div></section>`;
}

/* ============ 6. Offline bar and saving indicator ============ */
(() => {
  const head = document.querySelector("header.top"); if (!head) return;
  const bar = document.createElement("div"); bar.id = "y18-off"; bar.className = "y18-off"; bar.hidden = true; bar.setAttribute("role", "status");
  bar.textContent = "Offline — changes are saved on this device and sync when you're back";
  head.insertAdjacentElement("afterend", bar);
  const sync = $("#sync"); if (sync && sync.parentElement) { const sv = document.createElement("span"); sv.id = "y18-save"; sv.className = "sync y18-save"; sv.hidden = true; sync.insertAdjacentElement("afterend", sv); }
})();
function y18Net() {
  const bar = $("#y18-off"); if (!bar) return;
  const off = typeof navigator.onLine === "boolean" && !navigator.onLine;
  if (bar.hidden !== !off) bar.hidden = !off;
  if (off) { const h = document.querySelector("header.top"); if (h) bar.style.top = `calc(env(safe-area-inset-top, 0px) + ${Math.round(h.getBoundingClientRect().height)}px)`; }
}
window.addEventListener("online", () => { y18Net(); toast("Back online"); });
window.addEventListener("offline", y18Net);
EXT.afterRender.push(y18Net);
let _y18SaveVer = -1, _y18SavedAt = 0, _y18Saving = false;
// Every half second: "Saving…" while a change waits to be written, then "Saved" for a moment
function y18SaveTick() {
  const el = $("#y18-save"); if (!el) return;
  if (_y18SaveVer < 0) _y18SaveVer = saveVer;
  const busy = !!dirty || (typeof dirtyWeeks !== "undefined" && dirtyWeeks.size > 0);
  if (busy) { if (!_y18Saving) { _y18Saving = true; el.textContent = "Saving…"; el.hidden = false; } return; }
  if (_y18Saving || saveVer !== _y18SaveVer) { _y18Saving = false; _y18SaveVer = saveVer; _y18SavedAt = Date.now(); el.textContent = store.mode === "cloud" ? "Saved to your account" : "Saved"; el.hidden = false; return; }
  if (!el.hidden && Date.now() - _y18SavedAt > 2200) el.hidden = true;
}
setInterval(() => { try { y18SaveTick(); } catch { /* keep ticking */ } }, 500);

/* ============ 7. Home screen: which panels show ============ */
// Panels Home already has that you can switch off. Features that push onto EXT.homeTop with an `.ext = { id, label }` appear here too.
const HOME_PANELS = [["webshop", "Web shop", "Free credits and the web shop's bundles"], ["events", "Events & modes", "What's on now and coming up"], ["balance", "Balance changes", "The latest card changes"], ["vg", "Pinned variant goals", "Variants you're saving for"], ["svsync", "SnapVault sync", "Bring matches in from SnapVault"], ["challenges", "Challenges", "Matches friends challenged you to"]];
function homeShow(name) { return !obj(S.homeHide)[name]; }
// The EXT.homeTop functions that aren't switched off
function homeTopList() { return arr(EXT.homeTop).filter((f) => !(f && f.ext && f.ext.id) || homeShow(f.ext.id)); }
function homePanelList() {
  const seen = new Set(), out = [];
  for (const [id, label, sub] of HOME_PANELS) { seen.add(id); out.push({ id, label, sub }); }
  for (const f of arr(EXT.homeTop)) { const x = f && f.ext; if (x && x.id && x.label && !seen.has(x.id)) { seen.add(x.id); out.push({ id: String(x.id), label: String(x.label), sub: String(x.sub || "") }); } }
  return out;
}
function homeLayoutHtml() {
  const hidden = Object.keys(obj(S.homeHide)).filter((k) => S.homeHide[k]).length;
  return `<section class="sec"><h2>Home screen</h2><details class="panel small" ${ui.y18HomeOpen ? "open" : ""} data-y18open="y18HomeOpen"><summary><b>Choose which panels show</b> <span class="muted">${hidden ? `· ${hidden} hidden` : "· all showing"}</span></summary>
    <div class="stack" style="margin-top:8px;gap:0">${homePanelList().map((p) => `<label class="toggle-row check"><span><b>${esc(p.label)}</b>${p.sub ? `<br><span class="muted">${esc(p.sub)}</span>` : ""}</span><input type="checkbox" data-homechk="${esc(p.id)}" ${homeShow(p.id) ? "checked" : ""}></label>`).join("")}</div>
    <p class="muted" style="margin-top:8px">The season, clock, match stats and anything with a wishlist alert always show.</p></details></section>`;
}
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.homechk) return;
  S.homeHide = obj(S.homeHide); if (t.checked) delete S.homeHide[t.dataset.homechk]; else S.homeHide[t.dataset.homechk] = true;
  if (!Object.keys(S.homeHide).length) delete S.homeHide; save(); render();
});
document.addEventListener("toggle", (e) => { const t = e.target; if (t && t.dataset && t.dataset.y18open) ui[t.dataset.y18open] = t.open; }, true);

/* ============ 8. Reminders (shown by the phone once each, through EXT.alerts) ============ */
// Each one can be switched off in Settings › App; a key missing from S.notify means "on".
const REMINDERS = [
  ["remSeasonEnd", "The season ends in 3 days", "Time to finish the pass and climb"], ["remSeasonStart", "A new season started", "On the day it begins"],
  ["remEvent", "An event ends tomorrow", "Modes and events. Starts are covered by “An event or mode starts” above"], ["remMissions", "Daily checklist not done by 6 PM", "Only when something on it is still open"],
  ["remSpotlight", "New Spotlight cards and shop", "Tuesdays at the daily reset"], ["remAlliance", "Alliance week ends in 24 hours", "Finish bounties while they count"],
];
function remOn(k) { const v = obj(S.notify)[k]; return v === undefined ? true : !!v; }
// Next Tuesday 19:00 UTC (the weekly Spotlight and shop change), from now
function nextTuesdayReset(now = Date.now()) { const d = new Date(now); d.setUTCHours(RESET_UTC_HOUR, 0, 0, 0); while (d.getUTCDay() !== 2 || d.getTime() <= now) d.setTime(d.getTime() + DAY); return d.getTime(); }
function homeAlerts(now = Date.now()) {
  const out = [], ids = new Set(), H = 3600e3;
  const push = (a) => { if (!a || ids.has(a.id) || !(a.at > 0) || !(a.until > a.at)) return; ids.add(a.id); out.push(a); };
  const soon = (t) => Number.isFinite(t) && t > now - DAY && t < now + 14 * DAY;
  let ss = []; try { ss = seasons(); } catch { ss = []; }
  for (const s of ss.slice(0, 6)) {
    if (remOn("remSeasonEnd") && soon(s.endTs - 3 * DAY)) push({ id: `season-end:${s.id}`, at: s.endTs - 3 * DAY, until: s.endTs - 2 * DAY, title: "The season ends in 3 days", body: `${s.name}: finish the pass and climb while you can.`, route: "#home/seasons", pref: "remSeasonEnd" });
    if (remOn("remSeasonStart") && soon(s.startTs)) push({ id: `season-start:${s.id}`, at: s.startTs, until: s.startTs + DAY, title: "A new season has started", body: `${s.name} is here. Set your rank goal and pick a deck.`, route: "#home/seasons", pref: "remSeasonStart" });
  }
  // Event starts already have their own notification ("An event or mode starts"), so only the day before the end is added here
  if (remOn("remEvent")) { let ev = []; try { ev = events(); } catch { ev = []; }
    for (const e of ev) {
      if (Number.isFinite(e.endTs) && e.endTs - e.startTs > DAY && soon(e.endTs - DAY)) push({ id: `event-end:${e.id}`, at: e.endTs - DAY, until: e.endTs, title: "Ends tomorrow", body: `${e.name} ends at the next daily reset.`, route: "#home/events", pref: "remEvent" });
      if (out.length > 30) break;
    }
  }
  // Only for people who use the checklist. A 6 PM that falls in a later game day starts with everything open.
  if (remOn("remMissions") && typeof missionState === "function" && (obj(S.missions).items || obj(S.missions).done)) {
    try {
      const mi = missionState(), six = new Date(now); six.setHours(18, 0, 0, 0);
      const at = six.getTime() + (six.getTime() + 5 * H <= now ? DAY : 0), left = gameDay(at) === missionDay() ? mi.left : mi.items.length;
      if (mi.items.length && left > 0) push({ id: `missions-6pm:${localDate(at)}`, at, until: at + 5 * H, title: "Daily checklist", body: `${left} thing${left === 1 ? "" : "s"} still to do today.`, route: "#home/missions", pref: "remMissions" });
    } catch { /* no missions */ }
  }
  if (remOn("remSpotlight")) { const t = nextTuesdayReset(now); push({ id: `spotlight:${new Date(t).toISOString().slice(0, 10)}`, at: t, until: t + 12 * H, title: "New Spotlight cards", body: "The Spotlight cache and the shops just changed. See what's new.", route: "#home/shops", pref: "remSpotlight" }); }
  if (remOn("remAlliance")) { const end = num(obj(S.allianceData).endsAt); if (end > now && soon(end - DAY)) push({ id: `alliance-end:${end}`, at: end - DAY, until: end, title: "Alliance week ends in 24 hours", body: "Finish your bounties while they still count.", route: "#social/alliance", pref: "remAlliance" }); }
  return out.slice(0, 40);
}
EXT.alerts.push(homeAlerts);
function remindersHtml() {
  const on = notifyPrefs().on;
  return `<section class="sec"><h2>Reminders</h2><details class="panel small" ${ui.y18RemOpen ? "open" : ""} data-y18open="y18RemOpen"><summary><b>Choose your reminders</b> <span class="muted">${REMINDERS.filter(([k]) => remOn(k)).length} of ${REMINDERS.length} on</span></summary>
    <div class="stack" style="margin-top:8px;gap:0">${REMINDERS.map(([k, l, s]) => `<label class="toggle-row check"><span><b>${esc(l)}</b><br><span class="muted">${esc(s)}</span></span><input type="checkbox" data-remchk="${k}" ${remOn(k) ? "checked" : ""}></label>`).join("")}</div>
    <p class="muted" style="margin-top:8px">${on ? "Each reminder shows once, as a notification." : "These show as notifications once you turn notifications on above."}</p></details></section>`;
}
document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.remchk) { S.notify = { ...obj(S.notify), [t.dataset.remchk]: t.checked }; save(); try { saveNotifyState(); } catch { /* best effort */ } const d = t.closest("details"); if (d) { const n = d.querySelector("summary .muted"); if (n) n.textContent = `${REMINDERS.filter(([k]) => remOn(k)).length} of ${REMINDERS.length} on`; } } });

/* ============ 9. Backup nudge ============ */
// Remembers when you last copied or saved a backup, by wrapping the existing backup actions
for (const k of ["backupCopy", "backupSave"]) { const orig = A[k]; if (typeof orig === "function") A[k] = (el, e) => { S.backupAt = Date.now(); save(); if (ui.tab === "home") setTimeout(render, 0); return orig(el, e); }; }
function backupNudgeHtml() {
  if (store.mode === "cloud" || !store.ready) return "";
  if (realMatches().length < 20) return "";
  if (num(S.backupAt) && Date.now() - num(S.backupAt) < 30 * DAY) return "";
  if (num(S.backupLater) && Date.now() - num(S.backupLater) < 7 * DAY) return "";
  const canSign = store.provider === "firebase" && !!store.fb;
  return `<section class="sec"><div class="panel stack halftone small"><div class="row between nowrap"><h3 style="min-width:0">Keep your matches safe</h3><button class="btn sm ghost" data-a="backupLater" aria-label="Remind me later">Later</button></div>
    <p class="muted">${fmt(realMatches().length)} matches are saved only on this device${num(S.backupAt) ? `, and your last backup was ${esc(agoTxt(S.backupAt))}` : ""}. Sign in to keep them in your account, or copy a backup you can paste back later.</p>
    <div class="row"><button class="btn snap sm" data-a="${canSign ? "signIn" : "go"}" data-to="settings/account">Sign in</button><button class="btn sm" data-a="backupCopy">${ICON.copy} Copy backup</button></div></div></section>`;
}
backupNudgeHtml.ext = { id: "backupNudge", label: "Backup reminder", sub: "When your matches live only on this device" };
EXT.homeTop.push(backupNudgeHtml);
Object.assign(A, { backupLater: () => { S.backupLater = Date.now(); save(); render(); toast("You'll be reminded in a week"); } });

/* ============ 10. Install nudge (web only, from the third visit) ============ */
const Y18_VISITS = "snapstat.visits", Y18_INSTALL_OFF = "snapstat.installNudgeOff";
// A visit is opening the app after at least 30 minutes away (a reload doesn't count again)
try { if (window.SNAPSTAT_STANDALONE) { const v = obj(lsGet(Y18_VISITS)); if (Date.now() - num(v.at) > 30 * 60e3) v.n = num(v.n) + 1; v.at = Date.now(); lsSet(Y18_VISITS, { n: v.n, at: v.at }); } } catch { /* fine */ }
const y18IsIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function installNudgeHtml() {
  if (!window.SNAPSTAT_STANDALONE || NATIVE || isInstalled() || (navigator.standalone === true)) return "";
  if (num(obj(lsGet(Y18_VISITS)).n) < 3 || lsGet(Y18_INSTALL_OFF)) return "";
  const ios = y18IsIOS();
  const how = ios ? `In Safari, tap <b>Share</b> (the square with an arrow) and then <b>Add to Home Screen</b>.` : installEvt ? `` : `Open your browser's <b>⋮</b> menu and tap <b>Add to Home screen</b> or <b>Install app</b>.`;
  return `<section class="sec"><div class="panel stack halftone small"><div class="row between nowrap" style="align-items:flex-start"><h3 style="min-width:0">Add SNAP Stat to your home screen</h3><button class="x" data-a="installOff" aria-label="Don't show this again" title="Don't show this again">${ICON.x}</button></div>
    <p class="muted">It opens like an app, works offline and can remind you about seasons, events and sales. ${how}</p>
    ${!ios && installEvt ? `<div><button class="btn snap sm" data-a="installApp">Install</button></div>` : ""}</div></section>`;
}
installNudgeHtml.ext = { id: "installNudge", label: "Install tip", sub: "Add SNAP Stat to your home screen" };
EXT.homeTop.push(installNudgeHtml);
Object.assign(A, { installOff: () => { lsSet(Y18_INSTALL_OFF, Date.now()); render(); } });

/* ============ 11. Data files: how fresh each daily file is ============ */
function dataFiles() {
  const g = (f) => { try { return f(); } catch { return null; } };
  return [
    { label: "Card data", sub: "card-data.json", updated: g(() => CAT && CAT.updated), loaded: g(() => !!CAT), keys: ["snapstat-carddata-v1"] },
    { label: "Seasons and events", sub: "schedule.json", updated: g(() => SCHED && SCHED.updated), loaded: g(() => !!SCHED), keys: ["snapstat-schedule-v1"] },
    { label: "Variant details", sub: "variant-details.json", updated: g(() => VD && VD.updated), loaded: g(() => !!VD), keys: ["snapstat-variants-v1"] },
    { label: "Balance changes", sub: "balance-history.json", updated: g(() => BAL && BAL.updated), loaded: g(() => !!BAL), keys: ["snapstat-balance-v1"] },
    { label: "Season art and card backs", sub: "art.json", updated: g(() => ART.data && ART.data.updated), loaded: g(() => !!ART.data), keys: ["snapstat-art-v1"] },
    { label: "Web shop", sub: "webshop.json", updated: g(() => WEBSHOP.data && WEBSHOP.data.updated), loaded: g(() => !!WEBSHOP.data), keys: ["snapstat-webshop-v1"] },
    { label: "Borders", sub: "borders.json", updated: g(() => BDL && BDL.updated), loaded: g(() => !!BDL), keys: ["snapstat-borders-v1"] },
    { label: "Albums", sub: "albums.json", updated: g(() => ALB && ALB.updated), loaded: g(() => !!ALB), keys: ["snapstat.albums"] },
    { label: "Promo codes", sub: "promo-codes.json", updated: g(() => PROMOS.data && PROMOS.data.updated), loaded: g(() => !!PROMOS.data), keys: ["snapstat-promos-v1"] },
    { label: "Faces", sub: "faces.json", updated: g(() => FACES.data && FACES.data.updated), loaded: g(() => !!FACES.data), keys: ["snapstat-faces-v1"] },
    { label: "Packs", sub: "packs.json", updated: g(() => PACKS && PACKS.updated), loaded: g(() => !!PACKS), keys: ["snapstat.packs"] },
  ];
}
function dataFilesHtml() {
  if (!window.SNAPSTAT_STANDALONE) return `<section class="sec"><h2>Data files</h2><div class="panel small"><p class="muted">This version of the app uses its built-in card list, so there are no daily files to check.</p></div></section>`;
  const rows = dataFiles(), now = Date.now();
  const pill = (f) => { const t = Date.parse(String(f.updated || "")); if (!f.loaded) return `<span class="pill dim">not loaded</span>`; if (!Number.isFinite(t)) return `<span class="pill dim">no date</span>`; return now - t > 2 * DAY ? `<span class="pill warn">stale</span>` : `<span class="pill W">fresh</span>`; };
  const stale = rows.filter((f) => f.loaded && Number.isFinite(Date.parse(String(f.updated || ""))) && now - Date.parse(f.updated) > 2 * DAY).length;
  return `<section class="sec"><h2>Data files</h2><p class="muted small">SNAP Stat's card list, schedule, shops and art come from files that are refreshed every day. "Fresh" means your copy is less than two days old.${stale ? ` <b>${stale} ${stale === 1 ? "file looks" : "files look"} stale</b>: the daily update may not have run, or this device hasn't been online.` : ""}</p>
    <div class="list">${rows.map((f) => `<div class="li"><div class="grow"><div class="t">${esc(f.label)}</div><div class="s">${esc(f.sub)} · ${f.loaded ? (y18AgoIso(f.updated) ? "updated " + esc(y18AgoIso(f.updated)) : "loaded") : "not loaded yet"}</div></div>${pill(f)}</div>`).join("")}</div>
    <div class="panel stack small"><span class="muted">Something looks out of date or missing? This clears the copies saved on this device and loads every file again. Your own data isn't touched.</span><div><button class="btn" data-a="dataReload">${ui.y18ReloadArm ? "Tap again to reload" : "Reload data"}</button></div></div></section>`;
}
Object.assign(A, {
  dataReload: () => {
    if (!ui.y18ReloadArm) { ui.y18ReloadArm = true; render(); setTimeout(() => { if (ui.y18ReloadArm) { ui.y18ReloadArm = false; if (ui.tab === "settings") render(); } }, 5000); return; }
    ui.y18ReloadArm = false;
    // Only the saved copies of the daily files: snapstat-<name>-v1 (the same ones the app drops when storage is full), albums and packs
    try { const keys = new Set(dataFiles().flatMap((f) => f.keys)); for (const k of Object.keys(localStorage)) if (keys.has(k) || /^snapstat-[a-z-]+-v\d+$/.test(k)) localStorage.removeItem(k); } catch { /* storage unavailable */ }
    toast("Reloading…");
    // Anything still being saved is written first
    (async () => { try { if (dirty) await flushState(); if (dirtyWeeks.size) await flushWeeks(); } catch { /* saved again after the reload */ } location.reload(); })();
  },
});
EXT.settingsSubs.push(["files", "Data files", dataFilesHtml]);

/* ============ 12. The match you just logged: Edit · Undo ============ */
// Remembers which match you logged last and when, on this page only (nothing saved). Several new matches within a few
// moments are an import, not something you just logged, so they get no Undo (imports save theirs within a second of each other).
const y18Log = { id: "", at: 0, batchAt: 0, n: 0 };
EXT.onMatch.push((m, isNew) => {
  if (!isNew || !m || m.example) return;
  const now = Date.now(); y18Log.n = now - y18Log.batchAt < 1000 ? y18Log.n + 1 : 1; y18Log.batchAt = now;
  if (y18Log.n > 1 || m.svSync) { y18Log.id = ""; return; }
  y18Log.id = m.id; y18Log.at = now;
});
function lastMatchHtml() {
  if (ui.homeSub === "stats") return ""; // Overview only
  const lg = y18Log, ms = realMatches(); if (!ms.length) return "";
  const fresh = lg.id && Date.now() - num(lg.at) < 10 * 60e3;
  const m = (fresh && ms.find((x) => x.id === lg.id)) || ms[0]; if (!m) return "";
  const canUndo = fresh && m.id === lg.id;
  const res = m.result === "W" ? "Win" : m.result === "L" ? "Loss" : "Tie", cls = m.result === "W" ? "pos" : m.result === "L" ? "neg" : "muted";
  return `<div class="y18-last small"><span class="grow">Last: <b class="${cls}">${res}${m.noCubes ? "" : " " + esc(signed(num(m.cubes)))}</b>${m.deckName ? ` with ${esc(m.deckName)}` : ""} · ${esc(agoTxt(m.ts))}</span>
    <span class="row nowrap" style="gap:6px"><button class="btn sm" data-a="matchEdit" data-id="${esc(m.id)}">Edit</button>${canUndo ? `<button class="btn sm ghost ${ui.y18UndoArm === m.id ? "danger" : ""}" data-a="lastUndo" data-id="${esc(m.id)}">${ui.y18UndoArm === m.id ? "Tap again to delete" : "Undo"}</button>` : ""}</span></div>`;
}
Object.assign(A, {
  lastUndo: (el) => {
    const id = el.dataset.id;
    if (ui.y18UndoArm !== id) { ui.y18UndoArm = id; render(); setTimeout(() => { if (ui.y18UndoArm === id) { ui.y18UndoArm = ""; if (ui.tab === "home") render(); } }, 4000); return; }
    if (y18Log.id !== id || Date.now() - y18Log.at > 10 * 60e3) { ui.y18UndoArm = ""; render(); toast("Too late to undo. Use Edit to delete it."); return; }
    ui.y18UndoArm = ""; if (typeof removeMatchFix === "function") removeMatchFix(id); else removeMatch(id); y18Log.id = ""; save(); render(); toast("Match removed");
  },
});

/* ============ Settings › App panels and styles ============ */
EXT.settingsApp.push(() => `${screenHtml()}${homeLayoutHtml()}${remindersHtml()}${aboutAppHtml()}`);
EXT.styles.push(`
.topext .y18-gs { position: relative; min-width: 40px; min-height: 40px; display: inline-grid; place-items: center; padding: 0; }
.topext .y18-gs .ic { width: 20px; height: 20px; }
.y18-dot { position: absolute; top: 3px; right: 3px; width: 8px; height: 8px; border-radius: 50%; background: var(--loss); box-shadow: 0 0 0 2px var(--surface); }
.y18-dot.inline { position: static; display: inline-block; vertical-align: middle; box-shadow: none; margin-left: 2px; }
.y18-off { position: sticky; z-index: 4; top: calc(env(safe-area-inset-top, 0px) + 53px); margin-inline: calc(-1 * max(16px, env(safe-area-inset-left, 0px))) calc(-1 * max(16px, env(safe-area-inset-right, 0px))); padding: 5px 16px; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--warn); background: color-mix(in srgb, var(--warn) 16%, var(--bg)); border-bottom: 1px solid color-mix(in srgb, var(--warn) 40%, transparent); }
.y18-save { display: block; margin-top: 1px; }
.y18-kbd { font-family: var(--ui); font-size: 12px; font-weight: 700; letter-spacing: .04em; background: var(--surface-2); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
.y18-last { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.y18-last .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`);
