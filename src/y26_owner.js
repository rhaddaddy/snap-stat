/* ============ For the app owner: bug reports and what to test after each update ============
   Settings › App owner (only the owner sees it): every bug report people send, grouped by the page it happened on
   (many players = the whole app, one player = maybe just their account or device), each with the pictures, device,
   app or website, version and recent problems. Mark them seen / being fixed / fixed / not changing, reply to the player,
   and put them all together for Claude (Copy for Claude, or Save for Claude: a .zip with report.md and the pictures).
   "Test this update" lists the newest entries of CHANGES (b4_changes.js) with their test steps, and opens by itself once
   after an update arrives. */
const ob = { list: [], sub: null, err: "", filter: "open", open: "", files: {}, loading: "", delArm: "", reply: "" };
const OB_OPEN = ["new", "seen", "fixing"];
function obWatch() {
  if (ob.sub || !isAppOwner() || !store.db) return;
  ob.sub = "starting"; // set first: the first answer can arrive before onSnapshot returns
  try {
    const un = store.db.collection("bugs").onSnapshot((qs) => {
      ob.err = ""; ob.list = qs.docs.map((d) => ({ ...obj(d.data()), id: d.id })).sort((a, b) => num(b.at) - num(a.at));
      if ((ui.tab === "settings" && ui.setSub === "owner") || ui.tab === "home" || sheetFn === obSheet) setTimeout(requestRender, 0);
    }, (e) => { ob.err = errText(e); ob.sub = null; if (ui.tab === "settings") setTimeout(requestRender, 0); });
    if (ob.sub === "starting") ob.sub = un || "on";
  } catch (e) { ob.err = errText(e); ob.sub = null; }
}
EXT.afterRender.push(function obWatchSoon() { if (isAppOwner() && !ob.sub && !ob.err) obWatch(); });
const obShown = () => ob.list.filter((r) => ob.filter === "all" ? true : ob.filter === "open" ? OB_OPEN.includes(r.status || "new") : (r.status || "new") === ob.filter);
const obDev = (r) => obj(r.device);
const obWho = (r) => `${r.handle || "No name"}${r.account && r.account !== "Main account" ? ` (${r.account})` : ""}`;
// The same page from several players points to the whole app; one player on one device may be just them
function obGroups(list) {
  const g = {};
  for (const r of list) { const k = r.where || "Unknown page"; const x = (g[k] = g[k] || { where: k, n: 0, who: new Set(), dev: new Set(), apps: new Set() }); x.n++; x.who.add(r.by || r.handle); x.dev.add(obDev(r).id || r.id); x.apps.add(obDev(r).app || "?"); }
  return Object.values(g).sort((a, b) => b.n - a.n).map((x) => ({ ...x, scope: x.who.size > 1 ? "Several players: likely the whole app" : x.dev.size > 1 ? "One player on several devices: maybe their account" : "One player, one device", apps: [...x.apps].join(", ") }));
}
function ownerBugsHtml() {
  if (!isAppOwner()) return "";
  const shown = obShown(), cnt = (f) => ob.list.filter((r) => f === "open" ? OB_OPEN.includes(r.status || "new") : f === "all" ? true : (r.status || "new") === f).length;
  const chip = (f, l) => `<button class="chip" data-a="obFilter" data-f="${f}" aria-pressed="${ob.filter === f}">${l} ${cnt(f)}</button>`;
  const groups = obGroups(ob.list.filter((r) => OB_OPEN.includes(r.status || "new")));
  return `<section class="sec"><div class="sec-h"><h2>Bug reports</h2>${ob.list.length ? `<span class="pill ${cnt("new") ? "warn" : "dim"}">${cnt("new")} new</span>` : ""}</div>
    ${ob.err ? `<div class="panel small"><p>Bug reports need the newest security rules. Open firestore.rules on GitHub, copy all of it, then Firebase › Firestore Database › Rules › paste over everything › Publish.</p><p class="muted small">${esc(ob.err)}</p><button class="btn sm" data-a="obRetry">Try again</button></div>` : ""}
    <div class="chips">${chip("open", "Open")}${chip("new", "New")}${chip("fixed", "Fixed")}${chip("all", "All")}</div>
    ${ob.list.length ? `<div class="row"><button class="btn snap" data-a="obCopyAll">${ICON.copy} Copy for Claude</button><button class="btn" data-a="obSaveAll" ${ob.loading ? "disabled" : ""}>${ob.loading ? esc(ob.loading) : "Save for Claude (.zip)"}</button></div>
      <span class="muted small">Both put every open report together, grouped by page, ready to paste into (or attach to) your SNAP Stat chat. The .zip also has the pictures.</span>` : ""}
    ${groups.length ? `<details class="panel small"><summary><b>Where they happen</b> · ${groups.length} page${groups.length > 1 ? "s" : ""}</summary><div class="list">${groups.map((x) => `<div class="li"><div class="grow"><div class="t">${esc(x.where)}</div><div class="s">${x.n} report${x.n > 1 ? "s" : ""} · ${x.who.size} player${x.who.size > 1 ? "s" : ""} · ${x.dev.size} device${x.dev.size > 1 ? "s" : ""} · ${esc(x.apps)}</div><div class="s">${esc(x.scope)}</div></div></div>`).join("")}</div></details>` : ""}
    ${shown.length ? `<div class="list">${shown.slice(0, 80).map((r) => `<button class="li" data-a="obOpen" data-id="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.title || r.text || "Report")}</div>
        <div class="s"><span class="num">${esc(r.id)}</span> · ${esc(obWho(r))} · ${esc(r.where || "")}</div><div class="s">${esc(obDev(r).app || "")} · ${esc([obDev(r).os, obDev(r).model].filter(Boolean).join(" "))} · ${esc(agoTxt(r.at))}${num(r.files) ? ` · ${num(r.files)} file${num(r.files) > 1 ? "s" : ""}` : ""}</div></div>${bugPill(r.status)}</button>`).join("")}</div>`
      : `<div class="empty"><strong>${ob.list.length ? "Nothing here" : "No reports yet"}</strong><span>${ob.list.length ? "Try another filter." : "When players tap Report a bug, their reports show up here."}</span></div>`}</section>`;
}

/* ---------- One report ---------- */
async function obLoadFiles(r) {
  if (!num(r.files) || ob.files[r.id]) return;
  ob.files[r.id] = "loading";
  const out = [];
  for (let i = 0; i < Math.min(8, num(r.files)); i++) { try { const s = await store.db.doc(`bugs/${r.id}/files/${i}`).get(); if (s.exists) out.push(obj(s.data())); } catch (e) { errNote("loading a report's pictures", e, true); } }
  ob.files[r.id] = out; if (sheetFn === obSheet) refreshSheet();
}
function obSheet() {
  const r = ob.list.find((x) => x.id === ob.open); if (!r) return `${sheetHead("Report", "")}<div class="empty"><strong>It's gone</strong><span>This report was deleted.</span></div>`;
  const d = obDev(r), files = ob.files[r.id], kind = (BUG_KINDS.find(([k]) => k === r.kind) || [0, r.kind])[1], ch = r.change ? CHANGES.find((c) => c.id === r.change) : null;
  const same = ob.list.filter((x) => x.id !== r.id && x.where === r.where && OB_OPEN.includes(x.status || "new"));
  const fact = (k, v) => v ? `<div class="li"><div class="grow"><div class="s">${k}</div><div class="t" style="white-space:normal">${v}</div></div></div>` : "";
  const st = (s, l) => `<button class="chip" data-a="obStatus" data-s="${s}" aria-pressed="${(r.status || "new") === s}">${l}</button>`;
  return `${sheetHead(esc(r.id), `${esc(kind || "")} · ${esc(agoTxt(r.at))}`)}
    <div class="stack">
      <div class="panel small" style="white-space:pre-wrap">${esc(r.text || "(No words, just files)")}</div>
      ${same.length ? `<div class="note">${same.length} other open report${same.length > 1 ? "s" : ""} on this page from ${new Set(same.map((x) => x.by)).size} player${new Set(same.map((x) => x.by)).size > 1 ? "s" : ""}.</div>` : ""}
      ${num(r.files) ? `<div class="stack">${files === "loading" || !files ? `<span class="muted">Loading ${num(r.files)} file${num(r.files) > 1 ? "s" : ""}…</span>` : files.map((f) => /^data:image\//.test(f.data) ? `<img class="ob-pic" src="${f.data}" alt="${esc(f.name)}">` : `<details class="panel small"><summary>${esc(f.name)}</summary><pre class="ob-pre">${esc(obDecode(f.data).slice(0, 4000))}</pre></details>`).join("")}</div>` : ""}
      <div class="list">${fact("Page", `${esc(r.where || "")} <button class="btn sm ghost" data-a="go" data-to="${esc(r.route || "home")}">Open it</button>`)}
        ${fact("Player", `${esc(obWho(r))}${r.by ? ` · <span class="num">${esc(String(r.by).slice(0, 8))}…</span>` : ""}`)}
        ${fact("Device", `${esc(bugDeviceLine(d))}<br><span class="muted small">Screen ${esc(d.screen || "?")} @${esc(d.dpr || 1)}x · window ${esc(d.view || "?")} · ${esc(d.lang || "")} · device ${esc(d.id || "?")}</span>`)}
        ${fact("App version", `${esc(String(r.build || "?").slice(0, 7))}${r.build && BUILD && r.build !== BUILD ? " (older than now)" : r.build === BUILD ? " (the current one)" : ""}`)}
        ${ch ? fact("Testing", esc(ch.title)) : ""}${fact("Sent", esc(new Date(num(r.at)).toLocaleString()))}</div>
      ${arr(r.errors).length ? `<details class="panel small"><summary><b>Recent problems</b> (${arr(r.errors).length})</summary>${arr(r.errors).map((e) => `<p class="small"><b>${esc(e.where)}</b>: ${esc(e.msg)}${e.stack ? `<pre class="ob-pre">${esc(e.stack)}</pre>` : ""}</p>`).join("")}</details>` : ""}
      ${r.log ? `<details class="panel small"><summary><b>Tracker log</b></summary><pre class="ob-pre">${esc(r.log)}</pre></details>` : ""}
      <span class="eyebrow">Status</span><div class="chips">${st("seen", "Seen")}${st("fixing", "Being fixed")}${st("fixed", "Fixed")}${st("wontfix", "Not changing")}${st("dupe", "Already reported")}</div>
      <label class="f"><span>Reply to the player (they see it under Your reports)</span><textarea id="ob-reply" rows="2" maxlength="400" data-obreply>${esc(r.reply || "")}</textarea></label>
      <div class="row"><button class="btn" data-a="obReply">Save reply</button><button class="btn" data-a="obCopyOne">${ICON.copy} Copy for Claude</button><button class="btn ghost danger" data-a="obDelete">${ob.delArm === r.id ? "Tap again to delete" : "Delete"}</button></div>
    </div>`;
}
const obDecode = (dataUrl) => { try { const b64 = String(dataUrl).split(",")[1] || ""; return new TextDecoder().decode(b64ToBytes(b64)); } catch { return String(dataUrl).slice(0, 2000); } };
document.addEventListener("input", (e) => { if (e.target && e.target.dataset && e.target.dataset.obreply !== undefined) ob.reply = e.target.value; });
async function obSet(id, data) {
  try { await store.db.doc("bugs/" + id).update({ ...data, statusAt: Date.now() }); return true; }
  catch (e) { toast("Couldn't change it: " + errText(e)); return false; }
}

/* ---------- All together, for Claude ---------- */
function obReportMd(r, pics) {
  const d = obDev(r), kind = (BUG_KINDS.find(([k]) => k === r.kind) || [0, r.kind])[1], ch = r.change ? CHANGES.find((c) => c.id === r.change) : null;
  return [`### ${r.id} · ${BUG_STATUS[r.status || "new"] ? BUG_STATUS[r.status || "new"][0] : r.status} · ${kind}`,
    `- Page: ${r.where || "?"} (#${r.route || ""})`, `- Player: ${obWho(r)} · player id ${String(r.by || "").slice(0, 8)} · device ${d.id || "?"}`,
    `- Device: ${bugDeviceLine(d)} · screen ${d.screen || "?"} @${d.dpr || 1}x · window ${d.view || "?"} · ${d.lang || ""}`,
    `- App version: ${String(r.build || "?").slice(0, 7)}${r.build === BUILD ? " (current)" : ""} · sent ${new Date(num(r.at)).toISOString().slice(0, 16).replace("T", " ")} UTC`,
    ch ? `- While testing: ${ch.title} (${ch.id})` : "", pics && pics.length ? `- Files: ${pics.join(", ")}` : num(r.files) ? `- Files: ${num(r.files)} (open the report in the app to see them)` : "",
    r.reply ? `- My reply: ${r.reply}` : "", "", "What happened:", ...String(r.text || "").split("\n").map((l) => "> " + l),
    arr(r.errors).length ? `\nRecent problems:\n${arr(r.errors).map((e) => `- ${e.where}: ${e.msg}${e.stack ? `\n  ${String(e.stack).split("\n").slice(1, 3).map((x) => x.trim()).join(" | ")}` : ""}`).join("\n")}` : "",
    r.log ? `\nTracker log (last lines):\n\`\`\`\n${String(r.log).split("\n").slice(-40).join("\n")}\n\`\`\`` : ""].filter((x) => x !== "").join("\n");
}
function obCompile(list, picsById = {}) {
  const groups = obGroups(list), open = list.filter((r) => OB_OPEN.includes(r.status || "new")).length;
  return [`# SNAP Stat bug reports`, `Put together ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${list.length} report${list.length === 1 ? "" : "s"} (${open} open) · current app version ${String(BUILD || "?").slice(0, 7)}`, "",
    "Please read each report, find the cause in the code and fix it. Reports from several players on the same page are likely app-wide; one player on one device may be their account or phone.", "",
    "## Where they happen", ...groups.map((x) => `- ${x.where}: ${x.n} report${x.n > 1 ? "s" : ""}, ${x.who.size} player${x.who.size > 1 ? "s" : ""}, ${x.dev.size} device${x.dev.size > 1 ? "s" : ""} (${x.apps}) → ${x.scope}`), "",
    "## Summary", "| ID | Status | Kind | Page | Player | App | Device |", "|---|---|---|---|---|---|---|",
    ...list.map((r) => `| ${r.id} | ${r.status || "new"} | ${r.kind || ""} | ${r.where || ""} | ${obWho(r).replace(/\|/g, "/")} | ${obDev(r).app || ""} ${obDev(r).appVer || ""} | ${[obDev(r).os, obDev(r).model].filter(Boolean).join(" ")} |`), "",
    "## Reports", ...list.map((r) => obReportMd(r, picsById[r.id]) + "\n")].join("\n");
}
// A .zip (stored, not compressed: pictures are already small) with report.md and every picture, for attaching to a chat
function zipStore(files) {
  const T = zipStore.t || (zipStore.t = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })());
  const crc = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), b = f.bytes, c = crc(b);
    const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(b.length), ...u32(b.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, b);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(b.length), ...u32(b.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + b.length;
  }
  const size = central.reduce((s, x) => s + x.length, 0);
  return new Blob([...parts, ...central, new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(size), ...u32(off), ...u16(0)])], { type: "application/zip" });
}
Object.assign(A, {
  obFilter: (el) => { ob.filter = el.dataset.f; render(); },
  obRetry: () => { ob.err = ""; ob.sub = null; obWatch(); render(); },
  obOpen: (el) => { ob.open = el.dataset.id; ob.delArm = ""; const r = ob.list.find((x) => x.id === ob.open); ob.reply = r ? String(r.reply || "") : "";
    openSheet(obSheet); if (r) { obLoadFiles(r); if ((r.status || "new") === "new") obSet(r.id, { status: "seen" }); } },
  obStatus: async (el) => { if (await obSet(ob.open, { status: el.dataset.s })) toast("Saved"); },
  obReply: async () => { if (await obSet(ob.open, { reply: ob.reply.trim().slice(0, 400) })) toast("Reply saved"); },
  obDelete: async () => {
    if (ob.delArm !== ob.open) { ob.delArm = ob.open; refreshSheet(); return; }
    const r = ob.list.find((x) => x.id === ob.open); if (!r) return;
    try { for (let i = 0; i < num(r.files); i++) await store.db.doc(`bugs/${r.id}/files/${i}`).delete(); await store.db.doc("bugs/" + r.id).delete(); closeSheet(); toast("Deleted"); }
    catch (e) { toast("Couldn't delete it: " + errText(e)); }
  },
  obCopyOne: () => { const r = ob.list.find((x) => x.id === ob.open); if (r) copyText(obCompile([r]), "Copied: paste it into your SNAP Stat chat"); },
  obCopyAll: () => { const list = ob.list.filter((r) => OB_OPEN.includes(r.status || "new")); copyText(obCompile(list.length ? list : ob.list), `Copied ${list.length || ob.list.length} reports: paste them into your SNAP Stat chat`); },
  obSaveAll: async () => {
    const list = ob.list.filter((r) => OB_OPEN.includes(r.status || "new")), use = list.length ? list : ob.list, files = [], picsById = {};
    try {
      for (let i = 0; i < use.length; i++) {
        const r = use[i]; ob.loading = `Getting pictures ${i + 1}/${use.length}…`; render();
        await obLoadFiles(r); const got = Array.isArray(ob.files[r.id]) ? ob.files[r.id] : [];
        picsById[r.id] = got.map((f, j) => { const ext = /^data:image\//.test(f.data) ? "jpg" : (String(f.name).split(".").pop() || "txt").slice(0, 5); const name = `files/${r.id}-${j + 1}.${ext}`;
          files.push({ name, bytes: b64ToBytes(String(f.data).split(",")[1] || "") }); return name; });
      }
      files.unshift({ name: "report.md", bytes: new TextEncoder().encode(obCompile(use, picsById)) });
      await store.downloads.save({ filename: `snap-stat-bugs-${localDate(Date.now())}.zip`, data: zipStore(files) });
      toast("Saved. Attach the .zip to your SNAP Stat chat.");
    } catch (e) { toast("Couldn't save it: " + errText(e)); }
    finally { ob.loading = ""; render(); }
  },
});

/* ---------- Test this update ---------- */
const otState = () => obj(S.ownerTests);
const otMarks = () => obj(otState().marks);
function otTodo() { const m = otMarks(); return CHANGES.filter((c) => arr(c.test).length && !m[c.id]); }
function otItem(c, done) {
  const kindL = { new: "New", better: "Better", fixed: "Fixed", removed: "Removed" }[c.kind] || "Changed";
  return `<div class="panel stack small ot-item"><div class="row" style="justify-content:space-between;align-items:flex-start"><b>${esc(c.title)}</b><span class="pill ${c.kind === "fixed" ? "W" : c.kind === "removed" ? "dim" : "gold"}">${kindL}</span></div>
    <span class="muted">${esc(c.body)}</span>
    ${done ? `<span class="small">${done === "ok" ? "✓ Works" : "✗ Bug reported"}</span><div><button class="btn sm ghost" data-a="otMark" data-id="${esc(c.id)}" data-v="">Undo</button></div>`
      : `<ol class="ot-steps">${arr(c.test).map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      <div class="row"><button class="btn sm snap" data-a="otMark" data-id="${esc(c.id)}" data-v="ok">✓ Works</button><button class="btn sm" data-a="otBug" data-id="${esc(c.id)}">✗ Found a bug</button>${c.where ? `<button class="btn sm ghost" data-a="otGo" data-to="${esc(c.where)}">Open it</button>` : ""}</div>`}</div>`;
}
function ownerTestsHtml(inSheet) {
  if (!isAppOwner()) return "";
  const todo = otTodo(), m = otMarks(), done = CHANGES.filter((c) => arr(c.test).length && m[c.id]).slice(0, 12);
  const total = CHANGES.filter((c) => arr(c.test).length).length;
  return `${inSheet ? "" : `<section class="sec"><div class="sec-h"><h2>Test this update</h2><span class="pill ${todo.length ? "warn" : "W"}">${todo.length ? `${todo.length} to check` : "All checked"}</span></div>`}
    <p class="muted small">What changed in the newest updates and what to try. Tap ✓ Works, or ✗ Found a bug to report it with the change filled in. ${total - todo.length} of ${total} checked.</p>
    ${todo.length ? todo.map((c) => otItem(c, "")).join("") : `<div class="empty"><strong>All checked</strong><span>The next update's list shows up here by itself.</span></div>`}
    ${done.length && !inSheet ? `<details class="panel small"><summary>Checked (${done.length})</summary>${done.map((c) => otItem(c, m[c.id])).join("")}</details>` : ""}${inSheet ? "" : "</section>"}`;
}
function ownerTestsSheet() { return `${sheetHead("Test this update", "Only you see this, as the app owner")}${ownerTestsHtml(true)}<button class="btn block" data-a="close">Later</button>`; }
Object.assign(A, {
  otMark: (el) => { const marks = { ...otMarks() }; if (el.dataset.v) marks[el.dataset.id] = el.dataset.v; else delete marks[el.dataset.id]; S.ownerTests = { ...otState(), marks }; save(); render(); if (sheetFn) refreshSheet(); },
  otBug: (el) => { const marks = { ...otMarks(), [el.dataset.id]: "bug" }; S.ownerTests = { ...otState(), marks }; save(); bugOpen({ change: el.dataset.id, kind: "broke" }); },
  otGo: (el) => { closeSheet(); go(el.dataset.to); },
  otOpen: () => openSheet(ownerTestsSheet),
});
// Opens once by itself when an update with new things to test has loaded
EXT.afterRender.push(function otPopOnce() {
  if (!BUILD || !isAppOwner() || sheetFn || ui.tab !== "home" || otState().popped === BUILD) return;
  const todo = otTodo(); if (!todo.length) return;
  S.ownerTests = { ...otState(), popped: BUILD }; save();
  setTimeout(() => { if (!sheetFn) openSheet(ownerTestsSheet); }, 1200);
});
// Home, for the owner only: new reports and things to test
EXT.homeTop.push(function ownerHomeCard() {
  if (!isAppOwner()) return "";
  const nb = ob.list.filter((r) => (r.status || "new") === "new").length, nt = otTodo().length;
  if (!nb && !nt) return "";
  return `<section class="sec"><div class="panel row small" style="justify-content:space-between"><span><b>App owner</b> · ${[nb ? `${nb} new bug report${nb > 1 ? "s" : ""}` : "", nt ? `${nt} thing${nt > 1 ? "s" : ""} to test` : ""].filter(Boolean).join(" · ")}</span>
    <span class="row">${nt ? `<button class="btn sm" data-a="otOpen">Test</button>` : ""}<button class="btn sm snap" data-a="go" data-to="settings/owner">Open</button></span></div></section>`;
});
EXT.styles.push(`
.ob-pic { width: 100%; border-radius: 12px; border: 1px solid var(--line); }
.ob-pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11.5px; max-height: 320px; overflow: auto; background: var(--surface-2); padding: 8px; border-radius: 8px; margin: 6px 0 0; }
.ot-item { margin-bottom: 10px; }
.ot-steps { margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 14px; }`);
