/* ============ SnapVault import ============ */
const sv = { text: "", res: null, err: "", owned: true, decks: true, past: false, showAll: false };
function ensureCodeCard(code) {
  const c = cardByCode(code); if (c) return c.key;
  const d = catCardByCode(code); // in the daily card list but not the app's own (event cards like Vampire America Chavez)
  const name = d ? String(d.name) : `Unknown card (${code})`; const k = keyOf(name);
  if (!S.addedCards.some((x) => x.key === k)) S.addedCards.push({ key: k, name, cost: d && d.cost !== undefined ? num(d.cost) : "?", power: d && d.power !== undefined ? num(d.power) : "?", tags: [], ability: d ? String(d.ability || "") : "", series: "", release: "", code });
  return k;
}
function decodeCodes(b64) { try { const raw = atob(String(b64 || "").trim()); return /^[A-Za-z0-9]+(,[A-Za-z0-9]+)*$/.test(raw) ? raw.split(",") : []; } catch { return []; } }
function parseSnapVault(text) {
  let j; try { j = JSON.parse(text); } catch { return { err: "That file isn't a SnapVault export. In SnapVault, tap Export decks & collections and choose that file." }; }
  const codes = [...new Set(arr(obj(j.collection).cards).map(String).filter((c) => /^[A-Za-z0-9]+$/.test(c)))];
  const decks = arr(j.decks).map((d) => {
    const vs = arr(d.variations).slice().sort((a, b) => num(a.version) - num(b.version)); const latest = vs[vs.length - 1] || {};
    const name = String(d.name || "SnapVault deck").trim().slice(0, 60), svId = String(d.id || d.uuid || d.createdAt || "").slice(0, 80);
    return { name, svId, codes: decodeCodes(latest.deckCode), w: vs.reduce((s, v) => s + num(v.wins), 0), l: vs.reduce((s, v) => s + num(v.losses), 0), lw: num(latest.wins), ll: num(latest.losses), versions: vs.length, vers: vs.map((v) => ({ v: num(v.version), w: num(v.wins), l: num(v.losses), at: v.createdAt })), created: d.createdAt };
  }).filter((d) => d.codes.length);
  // Decks with the same name and no created date still get counters of their own
  const seenKey = new Map(); decks.forEach((d) => { const k = String(d.created || d.name), n = seenKey.get(k) || 0; seenKey.set(k, n + 1); d.ckey = n ? `${k}~${n}` : k; });
  const used = new Set(); decks.forEach((d) => { const ex = svDeckFor(d, used); d.exists = !!ex; if (ex) used.add(ex.id); });
  if (!codes.length && !decks.length) return { err: "No cards or decks were found in that file." };
  const all = [...new Set([...codes, ...decks.flatMap((d) => d.codes)])];
  return { codes, decks, known: codes.filter((c) => cardByCode(c)).length, unknown: all.filter((c) => !cardByCode(c) && !catCardByCode(c)), newOwned: codes.filter((c) => { const x = cardByCode(c); return !x || !S.owned[x.key]; }).length, date: j.exportDate };
}
function svSheet() {
  const r = sv.res;
  let body = "";
  if (sv.err) body = `<p class="note">${esc(sv.err)}</p>`;
  else if (r) {
    const shown = sv.showAll ? r.decks : r.decks.slice(0, 8);
    body = `<div class="panel stack">
      ${r.date ? `<span class="eyebrow">Exported ${esc(dateTimeStr(Date.parse(r.date)))}</span>` : ""}
      <div class="tiles"><div class="tile"><div class="k">Cards</div><div class="v">${fmt(r.codes.length)}</div><div class="small muted">${fmt(r.newOwned)} new to you</div></div><div class="tile"><div class="k">Decks</div><div class="v">${r.decks.length}</div><div class="small muted">${r.decks.filter((d) => d.exists).length} already here</div></div></div>
      ${r.unknown.length ? `<p class="small muted">${r.unknown.length} card${r.unknown.length > 1 ? "s aren't" : " isn't"} in the app's list yet. ${r.unknown.length > 1 ? "They'll" : "It'll"} come in as “Unknown card” so you can rename ${r.unknown.length > 1 ? "them" : "it"}.</p>` : ""}
      <label class="check"><input type="checkbox" data-svchk="owned" ${sv.owned ? "checked" : ""}> Mark these cards as owned</label>
      <label class="check"><input type="checkbox" data-svchk="decks" ${sv.decks ? "checked" : ""}> Bring in decks with their SnapVault win–loss records</label>
      ${!S.svCounts && sv.decks ? (() => { const w = r.decks.reduce((t, d) => t + d.w, 0), l = r.decks.reduce((t, d) => t + d.l, 0); return w + l ? `<label class="check"><input type="checkbox" data-svchk="past" ${sv.past ? "checked" : ""}> Also add the ${w}–${l} results SnapVault already has as matches (their dates aren't known)</label>` : ""; })() : ""}
      <span class="small muted">${S.svCounts ? "New wins and losses since your last sync come in as matches." : "After this, each sync adds the new wins and losses since the last one as matches."}</span></div>
    ${sv.decks && r.decks.length ? `<div class="list">${shown.map((d) => `<div class="li"><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${d.codes.length} cards${d.versions > 1 ? ` · ${d.versions} versions` : ""}${d.w || d.l ? ` · ${d.w}-${d.l}` : ""}</div></div><span class="pill ${d.exists ? "dim" : "gold"}">${d.exists ? "Update" : "New"}</span></div>`).join("")}</div>${r.decks.length > shown.length ? `<button class="btn sm ghost" data-a="svShowAll">Show all ${r.decks.length} decks</button>` : ""}` : ""}
    <button class="btn snap block" data-a="svImport" ${!sv.owned && !sv.decks ? "disabled" : ""}>Import</button>`;
  }
  return `${sheetHead("Import from SnapVault", "Brings your cards and decks into SNAP Stat")}
    <p class="small muted">In SnapVault, tap Export decks & collections, then choose that file here. Run it again any time to bring SNAP Stat up to date. Decks you imported before are updated, not duplicated.</p>
    <label class="btn ${r ? "" : "snap"} block">Choose export file<input type="file" accept=".json,application/json,text/plain" data-svfile="1" hidden></label>
    <details><summary class="small">Or paste the file's text</summary><div class="stack" style="margin-top:8px"><textarea id="sv-text" class="code" data-sv="text" placeholder="Paste the export">${esc(sv.text)}</textarea><button class="btn" data-a="svParse">Read it</button></div></details>
    ${body}`;
}
// The SNAP Stat deck a SnapVault deck was imported as: by SnapVault's id, or by name for decks imported before ids were kept
function svDeckFor(dk, used) { return (dk.svId && S.decks.find((x) => x.svId === dk.svId && !used.has(x.id))) || S.decks.find((x) => x.sv === dk.name && !x.svId && !used.has(x.id)) || null; }
function applySnapVault() {
  const r = sv.res; let owned = 0, made = 0, updated = 0;
  const at = Date.parse(r.date || ""), prev = Date.parse(S.svExportDate || ""), older = !!(at && prev && at < prev);
  if (sv.owned) r.codes.forEach((code) => { const k = ensureCodeCard(code); if (!S.owned[k]) { S.owned[k] = true; owned++; } });
  const used = new Set();
  if (sv.decks) r.decks.forEach((dk) => {
    const keys = [...new Set(dk.codes.map(ensureCodeCard))].slice(0, 12);
    const rec = { w: dk.w, l: dk.l, lw: dk.lw, ll: dk.ll, versions: dk.versions };
    const ex = svDeckFor(dk, used);
    if (ex) used.add(ex.id), (dk.deckId = ex.id);
    if (ex) { ex.cards = keys; ex.svRecord = rec; if (dk.svId) ex.svId = dk.svId; Object.keys(obj(ex.variants)).forEach((k) => { if (!keys.includes(k)) delete ex.variants[k]; }); updated++; }
    else { const id = uid(); dk.deckId = id; S.decks.push({ id, name: dk.name, cards: keys, status: "active", variants: {}, created: Date.parse(dk.created) || Date.now(), sv: dk.name, svId: dk.svId || "", svRecord: rec }); used.add(id); made++; }
  });
  const res = sv.decks && !older ? svResults(r, sv.past) : { n: 0 };
  S.svImported = Date.now(); save();
  return { owned, made, updated, games: res.n, first: res.first };
}
/* SnapVault's export has no match list, only each deck version's win–loss total. So each sync compares those totals with
   the last sync and adds the difference as matches: the deck and the result, without cubes, opponent or exact time. */
function svResults(r, past) {
  const first = !S.svCounts, base = obj(S.svCounts), next = { ...base };
  const end = Date.parse(r.date || "") || Date.now(), from = num(S.svResultsAt);
  const add = [];
  r.decks.forEach((dk) => {
    const deck = S.decks.find((x) => x.id === dk.deckId) || null;
    arr(dk.vers).forEach((v) => {
      const key = `${dk.ckey || dk.created || dk.name}#${v.v}`, was = obj(base[key]);
      next[key] = { w: v.w, l: v.l };
      if (first && !past) return; // the first sync only sets the starting point
      const dw = Math.max(0, v.w - num(was.w)), dl = Math.max(0, v.l - num(was.l));
      if (dw || dl) add.push({ deck, name: dk.name, w: dw, l: dl, start: Math.max(from, Date.parse(v.at) || 0) });
    });
  });
  let n = 0;
  add.forEach((a) => {
    const total = a.w + a.l, start = a.start && a.start < end ? a.start : end - total * 5 * 60e3;
    for (let i = 0; i < total; i++) {
      // Spread the wins and losses evenly between the last sync and this export, since their order isn't known
      const res = Math.floor(((i + 1) * a.w) / total) > Math.floor((i * a.w) / total) ? "W" : "L";
      putMatch({ id: uid(), ts: Math.round(start + ((end - start) * (i + 1)) / (total + 1)), result: res, cubes: 0, noCubes: true, mode: "Other", deckId: a.deck ? a.deck.id : "", deckName: a.deck ? a.deck.name : a.name, oppName: "", oppCards: [], snapped: false, oppSnapped: false, retreated: false, oppRetreated: false, turn: 6, bot: "unsure", notes: "From SnapVault. Only the deck and result are known.", svSync: true });
      n++;
    }
  });
  S.svCounts = next; S.svResultsAt = end;
  return { n, first: first && !past };
}

/* One-step sync: pick the newest SnapVault export and it's imported right away (cards marked owned, decks added or updated). */
function svSyncPanel() {
  const last = num(S.svImported), days = last ? Math.floor((Date.now() - last) / DAY) : -1;
  const when = !last ? "Not synced yet" : days === 0 ? "Synced today" : days === 1 ? "Synced yesterday" : `Synced ${days} days ago`;
  const stale = !last || days >= 3, lr = obj(S.svLast);
  return `<section class="sec"><div class="panel stack ${stale ? "halftone" : ""}" style="gap:8px">
    <div class="row between"><span class="eyebrow">SnapVault sync</span><span class="small ${stale ? "" : "muted"}">${when}</span></div>
    <p class="small muted">In SnapVault, tap <b>Export decks &amp; collections</b>. Then tap <b>Sync now</b> and pick that file. It's usually the first one in the list.</p>
    <div class="row"><a class="btn" href="https://www.snapvault.app/" target="_blank" rel="noopener">Open SnapVault ↗</a><label class="btn snap">Sync now<input type="file" accept=".json,application/json,text/plain" data-svquick="1" hidden></label></div>
    ${last && (lr.owned || lr.made || lr.updated) ? `<span class="muted small">Last sync: ${svSummary(lr)}</span>` : ""}</div></section>`;
}
function svSummary(r) { const p = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`; return [r.owned ? p(r.owned, "new card") : "", r.made ? p(r.made, "new deck") : "", r.updated ? p(r.updated, "deck") + " updated" : "", r.games ? p(r.games, "new result") : ""].filter(Boolean).join(", ") || "nothing new"; }
function svQuickSync(text) {
  const r = parseSnapVault(text);
  if (r.err) { toast(r.err); return; }
  const at = Date.parse(r.date || ""), prev = Date.parse(S.svExportDate || "");
  if (at && prev && at < prev) { toast(`That export is from ${dateStr(localDate(at))}, older than your last sync. Export again in SnapVault to get the newest one.`); return; }
  sv.res = r; sv.owned = true; sv.decks = true; sv.past = false;
  const out = applySnapVault();
  S.svLast = out; if (r.date) S.svExportDate = r.date; save(); render();
  toast(`Synced with SnapVault: ${svSummary(out)}${out.first ? ". From now on, new wins and losses come in as matches." : ""}`);
}

/* ============ Fill in missing card details with AI ============ */
const fill = { busy: false, done: 0, total: 0 };
function missingDetails() { return allCards().filter((c) => (c.cost === "?" || c.power === "?") && !c.unknownName && !c.upcoming); }
function tagsFrom(ab) {
  const a = String(ab || "").toLowerCase(); const t = [];
  if (a.includes("on reveal")) t.push("R"); if (a.includes("ongoing")) t.push("O"); if (/destroy/.test(a)) t.push("D"); if (/discard/.test(a)) t.push("X");
  if (/\bmove/.test(a)) t.push("M"); if (/\+\d+ power|double/.test(a)) t.push("B"); if (/energy/.test(a)) t.push("P"); if (/add (a|an|two|\d)|create/.test(a)) t.push("S");
  if (/opponent can't|can't play|remove|lose/.test(a)) t.push("C");
  return [...new Set(t)];
}
async function aiFillCards() {
  const todo = missingDetails();
  if (!todo.length) { toast("Every card already has its cost and power"); return; }
  if (!store.sample) { toast("AI isn't available here. Tap a card to add its cost and power."); return; }
  fill.busy = true; fill.total = todo.length; fill.done = 0; render();
  let filled = 0;
  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40);
    const prompt = `You are a MARVEL SNAP expert. For each card below, give its cost, power and ability text as of your latest knowledge. Some names are special versions, like "(Avengers)" or "(First Steps)": give that version's stats. If you don't know a card, use null.
Reply with JSON only: {"cards": [{"name": "exact name from the list", "cost": number or null, "power": number or null, "ability": "ability text, or empty if it has none"}]}
Cards: ${batch.map((c) => c.name).join("; ")}`;
    try {
      const r = await store.sample.json(prompt, { modelTier: "default" });
      const asked = new Set(batch.map((c) => c.key));
      arr(r && r.cards).forEach((x) => {
        const c = cardByName(x && x.name); if (!c || !asked.has(c.key) || x.cost === null || x.cost === undefined || !Number.isFinite(Number(x.cost))) return;
        const ability = String(x.ability || "").slice(0, 220), pw = x.power !== null && x.power !== undefined && Number.isFinite(Number(x.power)) ? num(x.power) : "?";
        S.cardEdits[c.key] = { ...obj(S.cardEdits[c.key]), cost: clamp(num(x.cost), 0, 20), power: pw, ability, tags: tagsFrom(ability), ai: true }; filled++;
      });
    } catch (e) { toast(e && e.code === "rate_limited" ? "AI is busy. Try again in a minute; finished cards are saved." : "AI stopped early. Finished cards are saved."); break; }
    fill.done = Math.min(todo.length, i + 40); save(); render();
  }
  fill.busy = false; save(); render(); toast(`Filled in ${filled} card${filled === 1 ? "" : "s"}. Tap any card to fix it.`);
}
function missingBanner() {
  const n = missingDetails().length; const unk = allCards().filter((c) => c.unknownName).length;
  if (!n && !unk) return "";
  return `<div class="panel stack">${n ? `<span class="small">${fmt(n)} card${n === 1 ? " is" : "s are"} missing cost and power${fill.busy ? "" : "."}</span>` : ""}
    ${fill.busy ? `<span class="small">Filling in… ${fill.done} of ${fill.total}</span>${passBar(fill.done, fill.total)}` : n ? (store.sample ? `<div><button class="btn sm snap" data-a="aiFill">${ICON.spark} Fill in with AI</button></div><span class="muted small">AI fills cost, power and ability from what it knows. It can be out of date, so check the cards you play most.</span>` : `<span class="muted small">Tap a card to add its cost and power.</span>`) : ""}
    ${unk ? `<span class="muted small">${unk} unknown card${unk === 1 ? "" : "s"} came from an import. Filter by “Needs details” and tap one to give it its real name.</span>` : ""}</div>`;
}
