/* ============ SnapVault: both files in one go (Nov 14) ============
   Pick SnapVault's decks-and-collection export (.json) and its match history (.csv) together, from any SnapVault button.
   Matches go in first (so the deck export's win–loss totals don't add rough copies of them), then cards and decks, then
   the matches join their decks. One file on its own keeps working exactly as before. */
const svBoth = { done: null };
function svKindOf(text) {
  const t = String(text || "").replace(/^﻿/, "").trim();
  if (t.startsWith("{")) return "json";
  return /playedAt/i.test(t.split(/\r?\n/, 1)[0] || "") ? "csv" : "";
}
async function svBothFiles(files) {
  const json = [], csv = [], bad = [];
  for (const f of Array.from(files || [])) {
    if (f.size > 8e6) { bad.push(`${f.name} is too big`); continue; }
    try { const txt = await f.text(), k = svKindOf(txt); if (k === "json") json.push({ f, txt }); else if (k === "csv") csv.push({ f, txt }); else bad.push(`${f.name} isn't a SnapVault file`); }
    catch (e) { bad.push(`${f.name}: ${errText(e)}`); }
  }
  if (!json.length && !csv.length) { toast(bad[0] || "No SnapVault file chosen"); return; }
  if (!csv.length) { svQuickSync(json.sort((a, b) => b.f.lastModified - a.f.lastModified)[0].txt); return; }
  if (!json.length) { svcFiles(csv.map((x) => x.f)); return; }
  try { svBothRun(json, csv, bad); } catch (e) { errNote("syncing SnapVault files", e); }
}
function svBothRun(json, csv, bad) {
  const out = { matches: "", csvAll: 0, csvNew: 0, deck: null, deckNote: "", linked: 0, bad };
  // 1. Matches, with everything a logged match updates (rank, stats, events, goals, widget)
  svc.list = []; svc.files = 0; svc.done = ""; svc.replace = true;
  csv.forEach((x) => { const r = svcRows(x.txt); if (r.bad) bad.push(`${x.f.name}: ${r.bad}`); else { svc.list.push(...r.list); svc.files++; } });
  const plan = svcPlan(); out.csvAll = plan.all; out.csvNew = plan.fresh.length;
  if (plan.fresh.length) { A.svcImport(); out.matches = svc.done; }
  // 2. Cards and decks from the newest export
  const pick = json.map((x) => ({ ...x, r: parseSnapVault(x.txt) })).filter((x) => !x.r.err).sort((a, b) => (Date.parse(b.r.date || "") || 0) - (Date.parse(a.r.date || "") || 0))[0];
  if (!pick) out.deckNote = parseSnapVault(json[0].txt).err || "Couldn't read the decks file.";
  else {
    const at = Date.parse(pick.r.date || ""), prev = Date.parse(S.svExportDate || "");
    if (at && prev && at < prev) out.deckNote = `The decks file is from ${dateStr(localDate(at))}, older than your last sync, so cards and decks were left as they are.`;
    else { sv.res = pick.r; sv.owned = true; sv.decks = true; sv.past = false; out.deck = applySnapVault(); S.svLast = out.deck; if (pick.r.date) S.svExportDate = pick.r.date; }
  }
  // 3. Matches whose deck just arrived join it
  out.linked = svcLinkDecks();
  if (out.linked) out.matches = out.matches.replace(/\s*\d+ deck names? (?:isn't|aren't) in SNAP Stat yet\.[^.]*\./, "");
  save(); render();
  svBoth.done = out; openSheet(svBothSheet);
}
function svBothSheet() {
  const o = svBoth.done; if (!o) return sheetHead("SnapVault sync", "");
  const d = o.deck || {};
  return `${sheetHead("SnapVault sync", "Decks, collection and matches")}<div class="stack small">
    <div class="tiles"><div class="tile"><div class="k">Matches</div><div class="v">${fmt(o.csvNew)}</div><div class="small muted">new of ${fmt(o.csvAll)}</div></div>
    <div class="tile"><div class="k">Cards</div><div class="v">${fmt(num(d.owned))}</div><div class="small muted">new to you</div></div>
    <div class="tile"><div class="k">Decks</div><div class="v">${fmt(num(d.made) + num(d.updated))}</div><div class="small muted">${num(d.made)} new · ${num(d.updated)} updated</div></div></div>
    <div class="panel stack">
      ${o.csvNew ? `<p>${esc(o.matches)}</p>` : `<p class="muted">Every match in the file was already in SNAP Stat.</p>`}
      ${o.deck ? `<p>Collection and decks: ${esc(svSummary(o.deck))}.${o.deck.first ? " From now on, new wins and losses come in as matches." : ""}</p>` : ""}
      ${o.deckNote ? `<p class="note">${esc(o.deckNote)}</p>` : ""}
      ${o.linked ? `<p>${o.linked} match${o.linked === 1 ? "" : "es"} joined ${o.linked === 1 ? "its deck" : "their decks"}.</p>` : ""}
      ${o.bad.length ? `<p class="muted">Skipped: ${esc(o.bad.slice(0, 3).join("; "))}</p>` : ""}
      <span class="muted">Picking the same files again is safe: nothing is added twice.</span></div>
    <div class="row"><button class="btn snap" data-a="svcGo" data-to="home/matches">See my matches</button><button class="btn" data-a="svcGo" data-to="cards/decks">See my decks</button><button class="btn ghost" data-a="close">Close</button></div></div>`;
}
EXT.search.push((q) => (/snapvault|sync/i.test(q) ? [{ label: "Sync both SnapVault files", sub: "Home › SnapVault sync › Sync now", route: "settings/data" }] : []));
