/* ============ y32_publish.js: getting ready to publish (October 31, 2026) ============
   2 a first-run tour · 3 crash-free mode (the safe page itself is the small script at the top of a_head.html) · 4 a status
   panel in Settings › About · 5 store screenshot mode · 6 the terms page and community rules · 7 download all your data ·
   8 feature switches for the app owner, with a small preview panel · 9 a notification when your bug report is fixed or
   answered · 10 "What's new" in the Android update window. Words and lists live in y32a_data.js. */
EXT.about = arr(EXT.about); EXT.owner = arr(EXT.owner);

/* ---------- 3. Crash-free mode: tell the safe page the app started ---------- */
EXT.afterRender.push(function y32BootOk() { if (!window.__snapBooted && typeof window.__snapBootOk === "function") window.__snapBootOk(); });

/* ---------- 2. First-run tour ---------- */
const tour = { i: 0 };
function tourSheet() {
  const n = TOUR_CARDS.length;
  return `${sheetHead("Welcome to SNAP Stat", "Swipe through, or skip")}
    <div class="tour-track hscroll" data-tourtrack="1" data-noswipe>${TOUR_CARDS.map((c, i) => `<div class="tour-card panel" data-i="${i}"><div class="tour-ic" aria-hidden="true">${esc(c.icon)}</div><h3>${esc(c.title)}</h3><p class="small">${esc(c.text)}</p>
      <button class="btn ${i === n - 1 ? "snap" : "ghost"} sm" data-a="tourGo" data-to="${esc(c.to)}">${esc(c.btn)}</button></div>`).join("")}</div>
    <div class="tour-dots" aria-hidden="true">${TOUR_CARDS.map((_, i) => `<span class="${i === tour.i ? "on" : ""}"></span>`).join("")}</div>
    <div class="row between"><button class="btn ghost" data-a="tourDone">Skip</button><button class="btn snap" data-a="tourNext">${tour.i >= n - 1 ? "Start using SNAP Stat" : "Next ›"}</button></div>
    <p class="muted small">You can see this again in Settings › About.</p>`;
}
function tourMark() { if (!S.tourDone) { S.tourDone = Date.now(); save(); } }
function tourScroll(i) {
  const tr = document.querySelector("[data-tourtrack]"); if (!tr) return;
  tour.i = clamp(i, 0, TOUR_CARDS.length - 1); tr.scrollTo({ left: tr.clientWidth * tour.i, behavior: "smooth" }); tourDots();
}
function tourDots() { document.querySelectorAll(".tour-dots span").forEach((d, i) => d.classList.toggle("on", i === tour.i)); const nb = document.querySelector('[data-a="tourNext"]'); if (nb) nb.textContent = tour.i >= TOUR_CARDS.length - 1 ? "Start using SNAP Stat" : "Next ›"; }
document.addEventListener("scroll", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.tourtrack) return; const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth)); if (i !== tour.i) { tour.i = clamp(i, 0, TOUR_CARDS.length - 1); tourDots(); } }, true);
// Once for everyone, after setting up a profile, on Home, when nothing else is open (never inside automated test browsers)
EXT.afterRender.push(function tourAuto() {
  if (S.tourDone || !S.me.onboarded || sheetFn || ui.tab !== "home" || navigator.webdriver || tour.auto) return;
  tour.auto = true; setTimeout(() => { if (!sheetFn && !S.tourDone) { tour.i = 0; tourMark(); openSheet(tourSheet); } }, 1200);
});

/* ---------- 4. Status: is everything working right now? ---------- */
function statusRows() {
  const files = typeof dataFiles === "function" ? dataFiles() : [];
  const f = (label) => files.find((x) => x.label === label) || { loaded: false };
  const age = (x) => { const t = Date.parse(String(x.updated || "")); return Number.isFinite(t) ? Date.now() - t : -1; };
  const fileRow = (label, name) => { const x = f(label), a = age(x); return { name, ok: x.loaded && a >= 0 && a < 2 * DAY ? "ok" : x.loaded ? "warn" : "bad", sub: !x.loaded ? "Not loaded yet" : a >= 0 ? `Updated ${y18AgoIso(x.updated)}` : "Loaded" }; };
  const rows = [fileRow("Card data", "Card data"), fileRow("Seasons and events", "Season and event data")];
  const fb = store.provider === "firebase";
  rows.push({ name: "Sign-in", ok: store.mode === "cloud" ? "ok" : fb ? "warn" : "warn", sub: store.mode === "cloud" ? "Signed in, saving to your account" : fb ? "Not signed in: saving on this device only" : "Sign-in isn't available in this view" });
  rows.push({ name: "Internet", ok: navigator.onLine === false ? "bad" : "ok", sub: navigator.onLine === false ? "Offline: changes are saved and sent later" : "Online" });
  rows.push({ name: "AI service", ok: aiOn() ? "ok" : "warn", sub: aiOn() ? "A key is set up" : "No AI key: screenshots wait until you add one" });
  if (NATIVE) rows.push({ name: "Android app", ok: natUpdateReady() ? "warn" : "ok", sub: `Version ${natInfo().version || "?"}${natUpdateReady() ? " · an update is ready" : ""}` });
  return rows;
}
const ST_PILL = { ok: ["Working", "W"], warn: ["Check", "warn"], bad: ["Not working", "L"] };
function statusHtml() {
  const rows = statusRows(), bad = rows.filter((r) => r.ok !== "ok").length;
  return `<section class="sec"><h2>Status</h2><div class="panel stack small">
    <p>${bad ? `${bad} thing${bad > 1 ? "s" : ""} to check.` : "Everything is working."} <span class="muted">Build ${esc(String(BUILD || "local").slice(0, 7))}</span></p>
    <div class="list">${rows.map((r) => `<div class="li"><div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.sub)}</div></div><span class="pill ${ST_PILL[r.ok][1]}">${ST_PILL[r.ok][0]}</span></div>`).join("")}</div>
    <div class="row"><button class="btn sm" data-a="go" data-to="settings/files">Data files</button><button class="btn sm ghost" data-a="tourOpen">Show the welcome tour</button><a class="btn sm ghost" href="terms.html" target="_blank" rel="noopener">Terms & rules</a></div></div></section>`;
}
EXT.about.push(statusHtml);
window.addEventListener("online", () => { if (ui.tab === "settings" && ui.setSub === "about") render(); });
window.addEventListener("offline", () => { if (ui.tab === "settings" && ui.setSub === "about") render(); });

/* ---------- 5. Store screenshot mode: six pages with a big caption for Google Play ---------- */
const ssm = { on: false, i: 0, t: 0 };
function ssmDraw() {
  let el = document.getElementById("ssm"); if (!ssm.on) { if (el) el.remove(); document.body.classList.remove("ssm-on"); return; }
  if (!el) { el = document.createElement("div"); el.id = "ssm"; document.body.appendChild(el); }
  document.body.classList.add("ssm-on");
  const [, cap] = STORE_SHOTS[ssm.i];
  el.innerHTML = `<div class="ssm-cap">${esc(cap)}</div><div class="ssm-ctl" data-ssmctl="1"><button class="btn sm" data-a="ssmStep" data-d="-1" aria-label="Previous">‹</button><span class="num">${ssm.i + 1}/${STORE_SHOTS.length}</span><button class="btn sm" data-a="ssmStep" data-d="1" aria-label="Next">›</button><button class="btn sm ghost" data-a="ssmEnd" aria-label="End">✕</button></div>`;
  clearTimeout(ssm.t); ssm.t = setTimeout(() => { const c = document.querySelector("[data-ssmctl]"); if (c) c.classList.add("faded"); }, 2500);
}
function ssmGo(i) { ssm.i = (i + STORE_SHOTS.length) % STORE_SHOTS.length; closeSheet(); go(STORE_SHOTS[ssm.i][0]); setTimeout(() => { window.scrollTo(0, 0); ssmDraw(); }, 60); }
document.addEventListener("click", (e) => { if (!ssm.on) return; const c = e.target && e.target.closest ? e.target.closest("[data-ssmctl], .ssm-cap") : null; if (c) { const x = document.querySelector("[data-ssmctl]"); if (x) x.classList.remove("faded"); clearTimeout(ssm.t); ssm.t = setTimeout(() => { const y = document.querySelector("[data-ssmctl]"); if (y) y.classList.add("faded"); }, 2500); } }, true);

/* ---------- 6. Community rules where people post ---------- */
function rulesNoteHtml() { return `<p class="muted small y32-rules">By posting you agree to the <a href="terms.html" target="_blank" rel="noopener">community rules</a>: ${esc(COMMUNITY_RULES.slice(0, 2).join(" "))}</p>`; }

/* ---------- 7. Download all my data ---------- */
// Everything SNAP Stat keeps for you, in one file. AI keys are left out (they're secrets and stay on this device).
function allMyData() {
  const dev = {};
  try { for (const k of Object.keys(localStorage)) { if (!/^(snapstat|cubeledger)[.-]/.test(k) || /ai|key|token|secret/i.test(k) || /^snapstat-[a-z-]+-v\d+$/.test(k)) continue; const v = localStorage.getItem(k); if (v && v.length < 200000) dev[k] = v; } } catch { /* storage blocked */ }
  return { app: "SNAP Stat", kind: "all-my-data", v: 1, exported: new Date().toISOString(), build: BUILD || "",
    about: "Everything SNAP Stat saved for you: your settings and collection (state), every match (matches, by week) and this device's extra settings (device). Screenshots aren't included; AI keys are never included.",
    account: { signedIn: store.mode === "cloud", handle: S.me.handle || "" }, state: S, matches: matchWeeks, device: dev };
}
async function saveAllMyData() {
  const name = `snap-stat-all-my-data-${localDate(Date.now())}.json`, data = JSON.stringify(allMyData(), null, 1);
  try { if (store.downloads && store.downloads.save) await store.downloads.save({ filename: name, data: new Blob([data], { type: "application/json" }) }); else saveBlob(new Blob([data], { type: "application/json" }), name); S.exportAt = Date.now(); save(); toast("Saved: " + name); }
  catch (e) { errNote("Download all my data", e); }
}
EXT.settingsData.push(function y32Export() {
  return `<section class="sec"><h2>Your data</h2><div class="panel stack small">
    <p>Download one file with everything SNAP Stat keeps for you: your profile, collection, decks, settings and every match. It's yours to keep or move.</p>
    <div class="row"><button class="btn snap" data-a="allDataSave">Download all my data</button></div>
    <span class="muted">${S.exportAt ? `Last downloaded ${esc(agoTxt(S.exportAt))}. ` : ""}AI keys are never included. To delete your account and everything in it, use Settings › Account.</span></div></section>`;
});

/* ---------- 8. Feature switches for the app owner (+ a small preview panel) ---------- */
const FLAG_LS = "snapstat.flags";
const flags = { v: lsGet(FLAG_LS) || {}, loaded: false, busy: false };
function flagVal(id) { const f = FLAG_LIST.find((x) => x.id === id); const v = obj(flags.v)[id]; return ["all", "me", "off"].includes(v) ? v : f ? f.def : "all"; }
// Whether a feature shows for whoever is using the app right now
function flagOn(id) { const v = flagVal(id); return v === "all" || (v === "me" && isAppOwner()); }
async function flagsLoad(force) {
  if (store.mode !== "cloud" || !store.db || flags.busy || (flags.loaded && !force)) return;
  flags.busy = true;
  try { const s = await store.db.doc("config/flags").get(); flags.v = s.exists ? obj(obj(s.data()).flags) : {}; lsSet(FLAG_LS, flags.v); flags.loaded = true; render(); }
  catch { flags.loaded = true; } finally { flags.busy = false; }
}
EXT.afterRender.push(function flagsSoon() { if (store.mode === "cloud" && !flags.loaded && !flags.busy) setTimeout(() => flagsLoad(false), 1500); });
async function flagSet(id, v) {
  const next = { ...obj(flags.v), [id]: v };
  try { await store.db.doc("config/flags").set({ flags: next, at: Date.now() }); flags.v = next; lsSet(FLAG_LS, next); toast("Saved"); render(); }
  catch (e) { toast(/permission/i.test(errText(e)) ? "Paste the new security rules in Firebase first" : "Couldn't save that"); }
}
function flagsPanel() {
  if (!isAppOwner()) return "";
  const lab = { all: "Everyone", me: "Just me", off: "Off" };
  return `<section class="sec"><h2>Feature switches</h2><div class="panel stack small">
    <p>Try a new feature yourself first (Just me), then turn it on for Everyone. Off hides it for everybody.</p>
    <div class="list">${FLAG_LIST.map((f) => `<div class="li y32-flag"><div class="grow"><div class="t">${esc(f.label)}</div><div class="s">${esc(f.sub)}</div></div>
      <div class="seg" role="group" aria-label="${esc(f.label)}">${["off", "me", "all"].map((v) => `<button data-a="flagSet" data-id="${esc(f.id)}" data-v="${v}" aria-pressed="${flagVal(f.id) === v}">${lab[v]}</button>`).join("")}</div></div>`).join("")}</div>
    <span class="muted">Needs the October 31 security rules (config/flags) in Firebase.</span></div></section>
    <section class="sec"><h2>Preview</h2><div class="panel stack small">
    <p>See screens that normally only show in special moments, without waiting for them.</p>
    <div class="grid2"><button class="btn sm" data-a="tourOpen">Welcome tour</button><button class="btn sm" data-a="pvSafe">Safe page</button>
      <button class="btn sm" data-a="pvError">Problem bar</button><button class="btn sm" data-a="pvPage">"Couldn't load" page</button>
      <button class="btn sm" data-a="pvUpdate">Update window notes</button><button class="btn sm" data-a="ssmStart">Store screenshots</button></div></div></section>`;
}
EXT.owner.push(flagsPanel);
function pvPageSheet() { return `${sheetHead("Preview", "What a page shows when it fails")}${errPageHtml("this preview", new Error("Nothing is broken: this is only a preview."))}`; }
function pvUpdateSheet() { return `${sheetHead("App update ready", "Preview of the notes in the update window")}${updNotesHtml()}<p class="muted small">The real window also has Update now and Later.</p>`; }

/* ---------- 9. A notification when your bug report is fixed or answered ---------- */
function bugAlerts(now = Date.now()) {
  const out = [];
  for (const x of arr(S.myBugs).slice(0, 15)) {
    const done = ["fixed", "wontfix", "dupe"].includes(x.status);
    if (!done && !x.reply) continue;
    const at = num(x.statusAt) || now - 60e3;
    if (now - at > 7 * DAY) continue;
    const word = x.status === "fixed" ? "is fixed" : x.status === "wontfix" ? "was answered" : x.status === "dupe" ? "was already reported" : "has a reply";
    out.push({ id: `bug:${x.id}:${x.status}:${String(x.reply || "").length}`, at: Math.min(at, now - 1000), until: Math.max(at, now) + 3 * DAY, title: `Your report ${word}`, body: `${x.title || x.id}${x.reply ? ": " + String(x.reply).slice(0, 120) : ""}`, route: "#settings/about", pref: "bugReplies" });
  }
  return out;
}
EXT.alerts.push(bugAlerts);
// Check your reports in the background every 30 minutes, and say so in the app when one changes
let _y32BugAt = 0;
async function y32BugPoll() {
  if (store.mode !== "cloud" || !arr(S.myBugs).length || Date.now() - _y32BugAt < 30 * 60e3 || typeof bugCheckMine !== "function") return;
  _y32BugAt = Date.now(); const before = new Map(arr(S.myBugs).map((x) => [x.id, x.status + "|" + (x.reply || "")]));
  try { await bugCheckMine(true); } catch { return; }
  const changed = arr(S.myBugs).find((x) => before.has(x.id) && before.get(x.id) !== x.status + "|" + (x.reply || "") && (x.status === "fixed" || x.reply));
  if (changed) toast(`Your report ${changed.id} ${changed.status === "fixed" ? "is fixed" : "has a reply"}. See Settings › About.`);
}
EXT.afterRender.push(function y32BugSoon() { if (store.mode === "cloud" && arr(S.myBugs).length && Date.now() - _y32BugAt > 30 * 60e3) setTimeout(y32BugPoll, 5000); });

/* ---------- 10. What's new, in the Android update window ---------- */
// The newest three new or improved things from the What's new list
function updNotesHtml() {
  const top = arr(typeof CHANGES !== "undefined" ? CHANGES : []).filter((c) => c && (c.kind === "new" || c.kind === "better")).slice(0, 3);
  if (!top.length) return "";
  return `<div class="panel small y32-notes"><b>What's new</b><ul>${top.map((c) => `<li><b>${esc(c.title)}</b>${c.body ? `<br><span class="muted">${esc(String(c.body).slice(0, 140))}${String(c.body).length > 140 ? "…" : ""}</span>` : ""}</li>`).join("")}</ul></div>`;
}

/* ---------- Taps ---------- */
Object.assign(A, {
  tourOpen: () => { tour.i = 0; tourMark(); openSheet(tourSheet); },
  tourNext: () => { if (tour.i >= TOUR_CARDS.length - 1) { tourMark(); closeSheet(); go("home/overview"); } else tourScroll(tour.i + 1); },
  tourDone: () => { tourMark(); closeSheet(); },
  tourGo: (el) => { tourMark(); closeSheet(); go(el.dataset.to || "home/overview"); },
  allDataSave: () => saveAllMyData(),
  flagSet: (el) => flagSet(el.dataset.id, el.dataset.v),
  pvSafe: () => { if (typeof window.__snapSafe === "function") window.__snapSafe(true); else toast("The safe page isn't in this build"); },
  pvError: () => { errShow("this preview", "Nothing is broken: this is what the problem bar looks like."); },
  pvPage: () => openSheet(pvPageSheet),
  pvUpdate: () => openSheet(pvUpdateSheet),
  ssmStart: () => { ssm.on = true; toast("Take a phone screenshot on each page. Tap › for the next one."); ssmGo(0); },
  ssmStep: (el) => ssmGo(ssm.i + num(el.dataset.d, 1)),
  ssmEnd: () => { ssm.on = false; ssmDraw(); render(); },
});
EXT.search.push((q) => (/terms|rules|privacy|status|tour|welcome|export|download/i.test(q) ? [{ label: "Status, tour and terms", sub: "Settings › About", route: "settings/about" }, { label: "Download all my data", sub: "Settings › Import & backup", route: "settings/data" }] : []));
EXT.styles.push(`
.tour-track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 0; margin: 0 -4px; scrollbar-width: none; overscroll-behavior-x: contain; }
.tour-track::-webkit-scrollbar { display: none; }
.tour-card { flex: 0 0 100%; box-sizing: border-box; scroll-snap-align: center; margin: 0 4px; min-height: 250px; display: flex; flex-direction: column; gap: 8px; justify-content: center; text-align: center; align-items: center; }
.tour-card h3 { margin: 0; font-family: var(--comic); font-size: 26px; letter-spacing: .5px; }
.tour-card p { margin: 0; max-width: 34ch; }
.tour-ic { font-size: 44px; line-height: 1; }
.tour-dots { display: flex; justify-content: center; gap: 6px; margin: 10px 0; }
.tour-dots span { width: 8px; height: 8px; border-radius: 99px; background: var(--line); transition: width .2s; }
.tour-dots span.on { width: 22px; background: var(--snap-a); }
.y32-flag { flex-wrap: wrap; } .y32-flag .seg { flex: none; }
.y32-notes ul { margin: 6px 0 0; padding-left: 18px; } .y32-notes li { margin: 4px 0; }
.y32-rules a { color: var(--snap-text); }
body.ssm-on .me-chip, body.ssm-on #sync, body.ssm-on .topext, body.ssm-on #err-toast { visibility: hidden; }
#ssm .ssm-cap { position: fixed; left: 0; right: 0; top: 0; z-index: 70; padding: calc(18px + env(safe-area-inset-top, 0px)) 18px 18px; text-align: center; font-family: var(--comic); font-size: 30px; line-height: 1.1; letter-spacing: .5px;
  color: var(--snap-ink); background: linear-gradient(135deg, var(--snap-a), var(--snap-b)); box-shadow: 0 6px 24px rgba(0,0,0,.35); }
#ssm .ssm-ctl { position: fixed; right: 10px; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); z-index: 71; display: flex; gap: 6px; align-items: center; padding: 6px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); transition: opacity .3s; }
#ssm .ssm-ctl.faded { opacity: 0; }
body.ssm-on #view { padding-top: 60px; }`);
