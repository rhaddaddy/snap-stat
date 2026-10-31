/* ============ Report a bug (everyone) ============
   Settings › About › Report a bug, the search window, the foot of every Settings page and the red problem bar open it.
   A report has an ID (BUG-261031-K7QZ), what you wrote, up to 4 screenshots or small text files, the page you were on,
   your player name and account, this device (phone/tablet/computer, Android app or website, OS, model, browser, screen),
   the app version and the app's recent problems. It's saved in Firestore (bugs/{id}, pictures in bugs/{id}/files/{n});
   only the app owner can read them all (Settings › App owner), and you can see the status of your own.
   Not signed in: it waits on this device and is sent once you sign in (or Copy report sends it another way). */
const BUG_KINDS = [["broke", "Something broke"], ["wrong", "Wrong info"], ["looks", "Looks wrong"], ["idea", "Idea"]];
const BUG_MAX_FILES = 4, BUG_QUEUE = "snapstat.bugQueue";
const bug = { kind: "broke", text: "", files: [], log: false, errs: true, change: "", sending: false, sent: "", queued: false };

function bugDeviceId() {
  try { let d = localStorage.getItem("snapstat.deviceId"); if (!d) { d = "d-" + Math.random().toString(36).slice(2, 8); localStorage.setItem("snapstat.deviceId", d); } return d; }
  catch { return "d-unknown"; }
}
function bugNewId() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0"), ab = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = ""; for (let i = 0; i < 4; i++) r += ab[Math.floor(Math.random() * ab.length)];
  return `BUG-${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${r}`;
}
// The page you're on, in words ("Settings › Android") and as its address
function bugWhere() {
  const n = obj(NAV[ui.tab]), sub = n.subs ? (n.subs().find(([k]) => k === ui[n.key]) || [])[1] : "";
  return { route: location.hash.slice(1) || ui.tab || "home", label: [n.title, String(sub || "").replace(/\s*[●(].*$/, "")].filter(Boolean).join(" › ") || "SNAP Stat" };
}
// What kind of device this is, without anything personal
function bugDevice() {
  const ua = navigator.userAgent || "", info = NATIVE ? natInfo() : {}, m = (re) => (re.exec(ua) || [])[1] || "";
  const os = info.android ? `Android ${info.android}` : m(/Android ([\d.]+)/) ? `Android ${m(/Android ([\d.]+)/)}` : /iPhone|iPad|iPod/.test(ua) ? `iOS ${m(/OS ([\d_]+)/).replace(/_/g, ".")}`
    : /Windows NT/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "Unknown";
  const model = String(info.model || m(/Android [\d.]+; ([^;)]+?)(?: Build[^;)]*)?\)/)).replace(/^K$/, "").trim();
  const browser = /EdgA?\//.test(ua) ? `Edge ${m(/EdgA?\/(\d+)/)}` : /SamsungBrowser/.test(ua) ? `Samsung Internet ${m(/SamsungBrowser\/(\d+)/)}` : /Firefox\//.test(ua) ? `Firefox ${m(/Firefox\/(\d+)/)}`
    : /Chrome\//.test(ua) ? `Chrome ${m(/Chrome\/(\d+)/)}` : /Safari\//.test(ua) ? `Safari ${m(/Version\/([\d.]+)/)}` : "Other";
  let standalone = false; try { standalone = matchMedia("(display-mode: standalone)").matches; } catch { /* old browser */ }
  const small = Math.min(screen.width || 0, screen.height || 0);
  const kind = /Mobi|Android|iPhone|iPad/.test(ua) ? (/iPad|Tablet/.test(ua) || (!/Mobi/.test(ua) && /Android/.test(ua)) || small >= 600 ? "Tablet" : "Phone") : "Computer";
  return { app: NATIVE ? "Android app" : standalone ? "Installed web app" : "Website", appVer: NATIVE ? String(info.version || "") : "", kind, os, model, browser,
    screen: `${screen.width}×${screen.height}`, view: `${innerWidth}×${innerHeight}`, dpr: Math.round((devicePixelRatio || 1) * 100) / 100, lang: navigator.language || "", id: bugDeviceId() };
}
const bugDeviceLine = (d) => [d.app + (d.appVer ? " " + d.appVer : ""), d.kind, [d.os, d.model].filter(Boolean).join(" "), d.browser].filter(Boolean).join(" · ");

// Pictures are made smaller (most screenshots end up 100-300 KB); small text files go as they are
function bugShrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const go = (max, q) => { const sc = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); return cv.toDataURL("image/jpeg", q); };
      let d = go(1600, 0.72); if (d.length > 900000) d = go(1200, 0.6); if (d.length > 900000) d = go(900, 0.5);
      URL.revokeObjectURL(url); res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That picture couldn't be opened")); };
    img.src = url;
  });
}
const bugReadText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
async function bugAddFiles(list) {
  for (const f of Array.from(list || [])) {
    if (bug.files.length >= BUG_MAX_FILES) { toast(`Up to ${BUG_MAX_FILES} files`); break; }
    try {
      if (/^image\//.test(f.type)) bug.files.push({ name: f.name.replace(/\.[^.]+$/, "") + ".jpg", type: "image/jpeg", data: await bugShrink(f) });
      else if (f.size <= 300000) bug.files.push({ name: f.name, type: f.type || "text/plain", data: await bugReadText(f) });
      else toast(`${f.name} is too big. Add screenshots or small text files.`);
    } catch (e) { toast(errText(e)); }
  }
  refreshSheet();
}

/* ---------- The report itself ---------- */
function bugBuild() {
  const w = bugWhere(), text = bug.text.trim().slice(0, 4000);
  let log = ""; if (bug.log && natCan("log")) { try { log = String(NATIVE.log() || "").split("\n").slice(-80).join("\n").slice(-12000); } catch { /* old app */ } }
  return { id: bugNewId(), by: store.uid || "", handle: String(S.me.handle || "").slice(0, 40), account: SLOT ? currentAccountName() : "Main account", kind: bug.kind, text,
    title: text.split("\n")[0].slice(0, 90), where: w.label, route: w.route.slice(0, 80), change: bug.change || "", build: BUILD || "", device: bugDevice(),
    errors: bug.errs ? ERRLOG.slice(0, 15).map((e) => ({ at: e.at, where: e.where, msg: e.msg, stack: String(e.stack || "").slice(0, 500) })) : [], log,
    files: bug.files.length, fileNames: bug.files.map((f) => f.name.slice(0, 80)), at: Date.now(), status: "new" };
}
function bugText(r) {
  return `SNAP Stat bug report ${r.id}\n${BUG_KINDS.find(([k]) => k === r.kind)?.[1] || r.kind} · ${r.where}\n${bugDeviceLine(r.device)} · build ${String(r.build).slice(0, 7)}\n\n${r.text}${r.errors.length ? `\n\nRecent problems:\n${r.errors.map((e) => `- ${e.where}: ${e.msg}`).join("\n")}` : ""}`;
}
async function bugUpload(r, files) {
  await store.db.doc("bugs/" + r.id).set(clone({ ...r, by: store.uid, handle: String(S.me.handle || r.handle || "").slice(0, 40) }));
  for (let i = 0; i < files.length; i++) await store.db.doc(`bugs/${r.id}/files/${i}`).set({ n: i, name: files[i].name, type: files[i].type, data: files[i].data, by: store.uid });
  S.myBugs = [{ id: r.id, at: r.at, title: r.title, status: "new" }, ...arr(S.myBugs).filter((x) => x.id !== r.id)].slice(0, 40); save();
}
function bugQueue() { try { return arr(JSON.parse(localStorage.getItem(BUG_QUEUE) || "[]")); } catch { return []; } }
function bugQueueSet(q) {
  try { localStorage.setItem(BUG_QUEUE, JSON.stringify(q)); return true; }
  catch { try { localStorage.setItem(BUG_QUEUE, JSON.stringify(q.map((x) => ({ ...x, files: [] })))); toast("The pictures were too big to keep on this device; the words are saved."); return true; } catch { return false; } }
}
let _bugFlushing = false;
async function bugFlush() {
  if (_bugFlushing || store.mode !== "cloud" || !store.db || !store.uid) return;
  const q = bugQueue(); if (!q.length) return;
  _bugFlushing = true;
  try { while (q.length) { const x = q[0]; await bugUpload(x.r, arr(x.files)); q.shift(); bugQueueSet(q); toast(`Report ${x.r.id} sent`); } }
  catch (e) { errNote("sending a saved bug report", e, true); }
  finally { _bugFlushing = false; }
}
setInterval(() => { try { bugFlush(); } catch { /* try later */ } }, 30000);
EXT.afterRender.push(function bugFlushSoon() { if (store.mode === "cloud" && bugQueue().length && !_bugFlushing) setTimeout(bugFlush, 2000); });

/* ---------- The window ---------- */
function bugSheet() {
  if (bug.sent) return `${sheetHead(bug.queued ? "Saved on this device" : "Thanks! It's sent", "")}<div class="panel stack small">
      <p>Your report number is <b class="num">${esc(bug.sent)}</b>.${bug.queued ? " It'll be sent by itself once you sign in." : " You can see when it's fixed in Settings › About › Your reports."}</p>
      <div class="row"><button class="btn" data-a="bugCopyId">${ICON.copy} Copy number</button><button class="btn snap" data-a="bugDone">Done</button></div></div>`;
  const dev = bugDevice(), w = bugWhere(), ch = bug.change ? CHANGES.find((c) => c.id === bug.change) : null;
  return `${sheetHead("Report a bug", "Say what went wrong and add screenshots. It really helps.")}
    <div class="stack">
      <div class="chips">${BUG_KINDS.map(([k, l]) => `<button class="chip" data-a="bugKind" data-k="${k}" aria-pressed="${bug.kind === k}">${l}</button>`).join("")}</div>
      ${ch ? `<div class="note">About the update: <b>${esc(ch.title)}</b></div>` : ""}
      <label class="f"><span>What happened?</span><textarea id="bug-text" rows="6" maxlength="4000" data-bugtext placeholder="What did you tap, what did you expect, and what happened instead?">${esc(bug.text)}</textarea></label>
      ${bug.files.length ? `<div class="bug-files">${bug.files.map((f, i) => `<div class="bug-file">${/^image\//.test(f.type) ? `<img src="${f.data}" alt="">` : `<span class="small">${esc(f.name)}</span>`}<button class="x" data-a="bugDropFile" data-i="${i}" aria-label="Remove ${esc(f.name)}">${ICON.x}</button></div>`).join("")}</div>` : ""}
      ${bug.files.length < BUG_MAX_FILES ? `<label class="btn">${ICON.plus} Add screenshots or files<input type="file" accept="image/*,.txt,.log,.json,.csv" multiple hidden data-bugfile></label>` : ""}
      ${NATIVE ? `<label class="check"><input type="checkbox" data-bugchk="log" ${bug.log ? "checked" : ""}> Add what the match tracker saw (its log)</label>` : ""}
      <label class="check"><input type="checkbox" data-bugchk="errs" ${bug.errs ? "checked" : ""}> Add the app's recent problems (${ERRLOG.length})</label>
      <span class="muted small">Sent with it: the page you were on (${esc(w.label)}), your player name, ${esc(dev.app)} on ${esc([dev.os, dev.model].filter(Boolean).join(" "))} and the app version.${store.mode !== "cloud" ? " You're not signed in, so it's kept on this device and sent once you sign in. Copy report sends it another way." : ""}</span>
      <div class="row"><button class="btn snap" data-a="bugSend" ${bug.sending ? "disabled" : ""}>${bug.sending ? "Sending…" : "Send report"}</button>${store.mode !== "cloud" ? `<button class="btn" data-a="bugCopy">${ICON.copy} Copy report</button>` : ""}</div>
    </div>`;
}
function bugOpen(opts = {}) {
  if (bug.sent) Object.assign(bug, { sent: "", queued: false, text: "", files: [], change: "" });
  Object.assign(bug, opts); openSheet(bugSheet);
  setTimeout(() => { const t = document.getElementById("bug-text"); if (t && !opts.noFocus) t.focus(); }, 60);
}
document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.bugtext !== undefined) bug.text = t.value; });
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.bugfile !== undefined) { bugAddFiles(t.files); t.value = ""; }
  if (t.dataset.bugchk) bug[t.dataset.bugchk] = t.checked;
});
Object.assign(A, {
  bugOpen: (el) => bugOpen({ change: (el && el.dataset.change) || "", kind: (el && el.dataset.kind) || bug.kind }),
  bugKind: (el) => { bug.kind = el.dataset.k; refreshSheet(); },
  bugDropFile: (el) => { bug.files.splice(num(el.dataset.i), 1); refreshSheet(); },
  bugCopy: () => copyText(bugText(bugBuild()), "Report copied"),
  bugCopyId: () => copyText(bug.sent, "Copied"),
  bugDone: () => { Object.assign(bug, { sent: "", queued: false, text: "", files: [], change: "", kind: "broke" }); closeSheet(); render(); },
  bugSend: async () => {
    if (bug.sending) return;
    if (bug.text.trim().length < 4 && !bug.files.length) { toast("Write a few words about what happened"); return; }
    const r = bugBuild(), files = bug.files.slice();
    if (store.mode !== "cloud" || !store.db || !store.uid) {
      if (!bugQueueSet([...bugQueue(), { r, files }].slice(-5))) { toast("Couldn't save it here. Tap Copy report instead."); return; }
      Object.assign(bug, { sent: r.id, queued: true, text: "", files: [], change: "" }); refreshSheet(); return;
    }
    bug.sending = true; refreshSheet();
    try { await bugUpload(r, files); Object.assign(bug, { sent: r.id, queued: false, text: "", files: [], change: "" }); }
    catch (e) {
      // Keep it so nothing is lost; the rules may not be pasted yet, or the phone is offline
      bugQueueSet([...bugQueue(), { r, files }].slice(-5)); Object.assign(bug, { sent: r.id, queued: true, text: "", files: [], change: "" });
      toast(/permission/i.test(errText(e)) ? "Reports aren't switched on yet (the app owner pastes the new security rules). It's saved here for now." : "Couldn't send it right now. It's saved and will be sent later.");
    }
    finally { bug.sending = false; refreshSheet(); }
  },
  // The red problem bar (errors.js)
  errReport: () => { const e = ERRLOG[0]; const b = document.getElementById("err-toast"); if (b) b.hidden = true; bugOpen({ kind: "broke", errs: true, text: e && !bug.text ? `It said: "${e.msg}" (in ${e.where})\n\nWhat I was doing: ` : bug.text }); },
  errHide: () => { const b = document.getElementById("err-toast"); if (b) b.hidden = true; },
  errRetry: () => { render(); if (sheetFn) refreshSheet(); },
});

/* ---------- Your reports (Settings › About) ---------- */
let _bugChecked = 0;
async function bugCheckMine(force) {
  if (store.mode !== "cloud" || !store.db || (!force && Date.now() - _bugChecked < 10 * 60e3)) return;
  _bugChecked = Date.now(); let changed = false;
  for (const x of arr(S.myBugs).slice(0, 15)) {
    if (x.status === "fixed" && !force) continue;
    try { const s = await store.db.doc("bugs/" + x.id).get(); if (!s.exists) continue; const d = obj(s.data());
      if (d.status !== x.status || (d.reply || "") !== (x.reply || "")) { x.status = d.status; x.reply = String(d.reply || "").slice(0, 400); x.statusAt = d.statusAt || Date.now(); changed = true; } } catch { /* rules not pasted yet */ }
  }
  if (changed) { save(); refreshView(); }
}
const BUG_STATUS = { new: ["New", "dim"], seen: ["Seen", ""], fixing: ["Being fixed", "warn"], fixed: ["Fixed", "W"], wontfix: ["Not changing", "dim"], dupe: ["Already reported", "dim"] };
const bugPill = (s) => { const [l, c] = BUG_STATUS[s] || BUG_STATUS.new; return `<span class="pill ${c}">${l}</span>`; };
function bugAboutHtml() {
  const mine = arr(S.myBugs), q = bugQueue();
  if (mine.length || q.length) setTimeout(() => bugCheckMine(false), 500);
  return `<section class="sec"><h2>Found a bug?</h2><div class="panel stack small">
      <p>Tell us what went wrong (and add screenshots). Every report is read.</p>
      <div class="row"><button class="btn snap" data-a="bugOpen">Report a bug</button><button class="btn ghost" data-a="bugOpen" data-kind="idea">Suggest an idea</button></div>
      ${q.length ? `<span class="muted">${q.length} report${q.length > 1 ? "s" : ""} waiting to be sent${store.mode === "cloud" ? "" : " (sign in to send)"}.</span>` : ""}</div>
      ${mine.length ? `<h3 class="small eyebrow" style="margin-top:14px">Your reports</h3><div class="list">${mine.slice(0, 15).map((x) => `<div class="li"><div class="grow"><div class="t">${esc(x.title || "Report")}</div><div class="s"><span class="num">${esc(x.id)}</span> · ${esc(agoTxt(x.at))}${x.reply ? ` · ${esc(x.reply)}` : ""}</div></div>${bugPill(x.status)}</div>`).join("")}</div>
      <div><button class="btn sm ghost" data-a="bugCheck">Check for updates</button></div>` : ""}</section>`;
}
Object.assign(A, { bugCheck: () => { toast("Checking…"); bugCheckMine(true); } });
EXT.styles.push(`
.bug-files { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.bug-file { position: relative; aspect-ratio: 9 / 16; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); background: var(--surface-2); display: grid; place-items: center; text-align: center; padding: 4px; }
.bug-file img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.bug-file .x { position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; border-radius: 999px; background: rgba(0,0,0,.6); color: #fff; border: 0; display: grid; place-items: center; }
.bug-foot { background: none; border: 0; padding: 0; color: var(--snap-text); font: inherit; text-decoration: underline; cursor: pointer; }`);
