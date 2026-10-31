/* ============ Review screenshots: what's being read right now, and why some couldn't be ============
   The top of Settings › Android › Review screenshots shows the picture the AI is reading this second (the same one
   the pop-up shows when SNAP Stat opens), the ones lined up after it, and how many are still waiting on the phone.
   Pictures that couldn't be read say why in plain words, and "Read them again" tries every one of them once more. */
function rvWhy(r) {
  const t = `${r.status || ""} ${r.detail || ""}`;
  if (/problem in SNAP Stat itself|Cannot read|undefined|is not a function|is not defined/i.test(t)) return "A problem in SNAP Stat itself (fixed in an update; then Read again)";
  if (/cut off|MAX.?TOKENS|expected format|didn't answer properly|no answer|unexpected end/i.test(t)) return "The AI's answer was cut off or garbled";
  if (/safety|blocked|recitation|prohibited/i.test(t)) return "The AI refused to read the picture";
  if (/running out of time|took too long|timed? ?out/i.test(t)) return "The AI took too long on it";
  if (/empty|damaged|couldn't be opened|decode/i.test(t)) return "The picture itself was empty or damaged";
  if (/didn't look like that screen/i.test(t)) return "Saved on one screen, but the picture shows another";
  if (/key|billing|permission|quota/i.test(t)) return "The AI key or its limit";
  return "Something else (open it to see the message)";
}
function rvWhyCounts(list) { const m = new Map(); for (const r of arr(list)) { const w = rvWhy(r); m.set(w, (m.get(w) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); }
function rvLiveHtml() {
  const items = arr(typeof shots === "object" ? shots.items : []).filter((x) => !x.done), wait = NATIVE ? num(natInfo().queue) : 0;
  const busy = (typeof nat === "object" && nat.busy) || (typeof shots === "object" && shots.busy) || !!rvRetry.on;
  if (!items.length && !wait && !busy) return "";
  const cur = items[0], rest = items.slice(1);
  return `<div class="panel stack small rvlive"><div class="row between"><b>Reading now</b><span class="pill ${busy ? "gold" : "dim"}">${busy ? "Live" : "Paused"}</span></div>
    ${cur ? `<div class="row nowrap" style="align-items:flex-start;gap:10px">${cur.url ? `<img src="${esc(cur.url)}" alt="" class="shot-thumb" style="width:64px;height:auto;border-radius:8px">` : `<span class="rvlive-ph" aria-hidden="true"></span>`}
      <div class="grow stack" style="gap:2px;min-width:0"><b class="small">${esc(cur.status || "Waiting…")}</b>${cur.detail ? `<span class="small muted">${esc(cur.detail)}</span>` : ""}${cur.file && cur.file.snapHint ? `<span class="small muted">${esc(/^screen:/.test(cur.file.snapHint) ? "saved on the " + (SCREEN_NAMES[cur.file.snapHint.slice(7)] || cur.file.snapHint.slice(7)) + " screen" : "after " + cur.file.snapHint)}</span>` : ""}</div></div>` : ""}
    ${rest.length ? `<span class="small muted">Next: ${rest.slice(0, 4).map((x) => esc(x.status || "Waiting…")).join(" · ")}${rest.length > 4 ? ` · and ${rest.length - 4} more` : ""}</span>` : ""}
    ${rvRetry.on ? `<span class="small">Reading failed pictures again: ${rvRetry.done} of ${rvRetry.total}</span>` : ""}
    ${wait ? `<span class="small muted">${wait} more waiting on the phone${canReadShots() ? "" : " (they're read once your AI key works)"}.</span>` : ""}
    ${!busy && wait && canReadShots() ? `<div><button class="btn sm" data-a="rvPullNow">Read them now</button></div>` : ""}</div>`;
}
// Tries every picture that couldn't be read once more, one at a time (the AI's free answers are spaced out)
const rvRetry = { on: false, done: 0, total: 0 };
async function rvRetryFailed() {
  if (rvRetry.on) return;
  const list = arr(rv.list && rv.list.length ? rv.list : await shotLogAll()).filter((r) => rvFailed(r) && r.img);
  if (!list.length) { toast("Nothing to read again"); return; }
  Object.assign(rvRetry, { on: true, done: 0, total: list.length }); refreshView(); if (sheetFn) refreshSheet();
  let fixed = 0;
  try {
    for (const r of list) {
      const f = new File([r.img], "again.jpg", { type: "image/jpeg", lastModified: r.taken || Date.now() }); if (r.hint) f.snapHint = r.hint; if (r.meta) f.snapMeta = r.meta;
      const x = { file: f, again: true, logId: r.id, reMatch: r.matchId || "", status: "Reading again…", native: "again-" + r.id }; // (marked so a shared picture being read at the same time never picks it up too)
      shots.items.push(x); if (sheetFn) refreshSheet();
      const res = await readShotItem(x); x.done = true;
      if (res === "retry") { x.status = x.status || "The AI is busy"; break; } // busy: the rest wait for another try
      if (!/^Couldn't/.test(String(x.status || ""))) fixed++;
      rvRetry.done++; if (sheetFn) refreshSheet();
    }
  } finally {
    rvRetry.on = false; trkHealth.at = 0;
    if (sheetFn === reviewSheet) { rv.list = await shotLogAll(); refreshSheet(); }
    render(); toast(fixed ? `${fixed} of ${rvRetry.total} read this time` : "They still couldn't be read. Report it with Settings › About › Report a bug.");
  }
}
Object.assign(A, {
  rvRetryFailed: () => rvRetryFailed(),
  rvFailedOpen: async () => { rv.session = ""; rv.filter = "failed"; rv.list = null; openSheet(reviewSheet); rv.list = await shotLogAll(); refreshSheet(); },
  rvPullNow: () => { natPull(); setTimeout(() => { if (sheetFn) refreshSheet(); }, 300); },
});
EXT.reviewTools.push((list) => arr(list).some(rvFailed) && canReadShots() ? `<div class="row"><button class="btn sm" data-a="rvRetryFailed" ${rvRetry.on ? "disabled" : ""}>${rvRetry.on ? `Reading ${rvRetry.done + 1} of ${rvRetry.total}…` : "Read all failed again"}</button></div>` : "");
// While pictures are being read, the review window keeps itself up to date (the phone's waiting count too)
setInterval(() => { try { if (typeof reviewSheet === "function" && sheetFn === reviewSheet && ((typeof nat === "object" && nat.busy) || shots.busy || rvRetry.on || (NATIVE && num(natInfo().queue)))) refreshSheet(); } catch { /* next time */ } }, 2000);
EXT.styles.push(`
.rvlive { border-color: color-mix(in srgb, var(--snap-b) 55%, var(--line)); }
.rvlive-ph { width: 64px; height: 110px; border-radius: 8px; background: var(--surface-2); flex: none; }`);
