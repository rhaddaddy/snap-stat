/* ============ Nov 11: SnapVault match history file, and SNAP Stat on iPhone ============
   1 Settings › Import & backup › SnapVault match history: the CSV file SnapVault exports (snapvault-matches-….csv).
     Every match comes in with its time, mode, deck, result, cubes, snaps, turn, opponent and locations. Matches already
     in SNAP Stat are skipped (same file twice, or a match Track & play already saved), and SnapVault sync's rough
     entries for those days can be swapped for the real ones.
   2 Settings › About › On iPhone: SNAP Stat works in Safari and can be added to the home screen (ZN6W). */

/* ---------- 1. SnapVault match history (CSV) ---------- */
function csvParse(text) {
  const rows = []; let row = [], f = "", q = false;
  text = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
    if (ch === '"') q = true; else if (ch === ",") { row.push(f); f = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; } else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}
// Spreadsheets put a ' in front of values starting with - + = @ so they aren't read as formulas; that's taken off here
const svcCell = (v) => String(v == null ? "" : v).replace(/^'(?=[-+=@])/, "").trim();
const SVC_MODES = { ranked: "Ranked", conquest: "Conquest", friendly: "Friendly", location_war: "Sanctum Showdown", ltm_deadpool_diner: "Deadpool's Diner", high_voltage: "High Voltage", ltm_high_voltage: "High Voltage" };
function svcMode(code, label) { const c = String(code || "").toLowerCase(); return SVC_MODES[c] || (/draft/.test(c) ? "Draft" : /conquest/.test(c) ? "Conquest" : String(label || "").trim().slice(0, 30) || "Other"); }
// Limited-time modes (Sanctum Showdown, Deadpool's Diner, High Voltage, future events): their points go to the event's page
const svcIsEvent = (mode) => !!mode && !STD_MODES.has(mode) && mode !== "Draft" && mode !== "Other";
const svcGainName = (mode) => (mode === "Deadpool's Diner" ? "Bubs" : (mode + " points").slice(0, 24));
// Points one match gave in an event: from the match itself, or from the note an earlier import of the file wrote
function evGainOf(m) {
  if (m.eventGain && num(m.eventGain.amount)) return { name: curName(m.eventGain.name), amount: num(m.eventGain.amount) };
  const md = modeOf(m), hit = m.svFile && svcIsEvent(md) ? String(m.notes || "").match(/: ([+-]?\d+) points/) : null;
  return hit ? { name: svcGainName(md), amount: num(hit[1]) } : null;
}
// "+1,240 Sanctum Showdown points from 18 games" for the event's page
function evPointsLine(ms) {
  const by = new Map();
  for (const m of ms) { const g = evGainOf(m); if (!g) continue; const o = by.get(keyOf(g.name)) || { name: g.name, amount: 0, n: 0 }; o.amount += g.amount; o.n++; by.set(keyOf(g.name), o); }
  return [...by.values()].map((o) => `<span class="small">${esc(signed(o.amount))} ${esc(o.name)} from ${o.n} game${o.n === 1 ? "" : "s"}</span>`).join("");
}
const svcDeckKey = (n) => String(n || "").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
function svcRows(text) {
  const rows = csvParse(text); if (rows.length < 2) return { list: [], bad: "That file is empty." };
  const head = rows[0].map((h) => svcCell(h)), ix = (n) => head.indexOf(n);
  if (ix("playedAt") < 0 || ix("result") < 0) return { list: [], bad: "That isn't a SnapVault match history file (it needs playedAt and result columns)." };
  const g = (r, n) => (ix(n) >= 0 ? svcCell(r[ix(n)]) : "");
  const decks = new Map(S.decks.map((d) => [svcDeckKey(d.name), d]));
  const list = [];
  for (const r of rows.slice(1)) {
    const ts = Date.parse(g(r, "playedAt")); if (!Number.isFinite(ts)) continue;
    const res = g(r, "result").toLowerCase(), won = g(r, "won") === "true", oppQuit = g(r, "opponentConceded") === "true";
    const result = res === "win" || (won && res !== "tie") ? "W" : res === "tie" ? "T" : res === "loss" || res === "conceded" ? "L" : "";
    if (!result) continue;
    const mode = svcMode(g(r, "gameMode"), g(r, "gameModeLabel")), pts = Math.round(num(g(r, "cubes")));
    const ranked = mode === "Ranked", deckName = g(r, "deckName").slice(0, 60), d = decks.get(svcDeckKey(deckName)) || null;
    const locs = g(r, "locations").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 3).map((name) => ({ name: name.slice(0, 40), my: 0, opp: 0 }));
    const turn = num(g(r, "endTurn")), snapT = num(g(r, "playerSnapTurn"));
    list.push({
      id: "svc-" + ts.toString(36) + "-" + svcDeckKey(g(r, "opponentName")).slice(0, 12), ts, result, mode, deckId: d ? d.id : "", deckName: d ? d.name : deckName,
      // Cubes count only in Ranked; event points (Deadpool's Diner) go in the notes so they don't change your cube stats
      cubes: ranked ? (result === "W" ? Math.abs(pts) : result === "L" ? -Math.abs(pts) : 0) : 0, ...(ranked ? {} : { noCubes: true }),
      oppName: g(r, "opponentName").replace(/^'/, "").slice(0, 40), oppCards: [], snapped: g(r, "playerSnapped") === "true", ...(snapT ? { snapTurn: snapT } : {}),
      oppSnapped: g(r, "opponentSnapped") === "true", retreated: res === "conceded", oppRetreated: oppQuit, turn: turn || (oppQuit || res === "conceded" ? 0 : 6), bot: "unsure",
      notes: ["From SnapVault's match history file", !ranked && pts ? `${mode}: ${signed(pts)} points` : "", g(r, "lanesWon") !== "" ? `${num(g(r, "lanesWon"))} location${num(g(r, "lanesWon")) === 1 ? "" : "s"} won` : ""].filter(Boolean).join(" · "),
      locs, tracked: false, lanes: num(g(r, "lanesWon")), svFile: true,
      // Event modes pay points per match (Deadpool's Diner's are Bubs): counted on that event's page like a tracked match
      ...(svcIsEvent(mode) && pts ? { eventGain: { name: svcGainName(mode), amount: pts } } : {}),
    });
  }
  return { list, bad: list.length ? "" : "No matches found in that file." };
}
const svc = { list: [], files: 0, replace: true, busy: false, done: "" };
// The same match already saved some other way (Track & play, a screenshot, the PC tracker): within 3 minutes, same result
function svcSame(m) { return realMatches().find((x) => x.id === m.id || (Math.abs(num(x.ts) - m.ts) < 3 * 60e3 && x.result === m.result && !x.svSync)); }
function svcPlan() {
  const seen = new Set(), fresh = [];
  for (const m of svc.list) { if (seen.has(m.id)) continue; seen.add(m.id); if (!svcSame(m)) fresh.push(m); }
  const all = [...seen].length, ts = svc.list.map((m) => m.ts), lo = Math.min(...ts), hi = Math.max(...ts);
  const rough = svc.list.length ? realMatches().filter((x) => x.svSync && x.ts >= lo - DAY && x.ts <= hi + DAY) : [];
  return { all, fresh, lo, hi, rough };
}
function svcSheet() {
  if (svc.done) return `${sheetHead("SnapVault match history", "")}<div class="panel stack small"><p>${esc(svc.done)}</p><div class="row"><button class="btn snap" data-a="svcGo" data-to="home/matches">See my matches</button><button class="btn ghost" data-a="close">Close</button></div></div>`;
  const p = svcPlan(), modes = {}; p.fresh.forEach((m) => { modes[m.mode] = (modes[m.mode] || 0) + 1; });
  const noDeck = new Set(p.fresh.filter((m) => !m.deckId && m.deckName).map((m) => m.deckName));
  const day = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${sheetHead("SnapVault match history", `${svc.files} file${svc.files === 1 ? "" : "s"} · ${p.all} match${p.all === 1 ? "" : "es"}${p.all ? ` · ${day(p.lo)} to ${day(p.hi)}` : ""}`)}<div class="stack small">
    <div class="tiles"><div class="tile"><div class="k">New</div><div class="v">${fmt(p.fresh.length)}</div></div><div class="tile"><div class="k">Already in</div><div class="v">${fmt(p.all - p.fresh.length)}</div></div></div>
    ${p.fresh.length ? `<div class="chiplist">${Object.entries(modes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="pill">${esc(k)} · ${n}</span>`).join("")}</div>` : `<p class="muted">Everything in ${svc.files > 1 ? "these files" : "this file"} is already in SNAP Stat.</p>`}
    ${noDeck.size ? `<span class="muted">No SNAP Stat deck has these names, so their matches come in with just the name: ${esc([...noDeck].slice(0, 6).join(", "))}${noDeck.size > 6 ? "…" : ""}. Import your decks from SnapVault first to link them.</span>` : ""}
    ${p.rough.length ? `<label class="check"><input type="checkbox" data-svc="replace" ${svc.replace ? "checked" : ""}> Swap SnapVault sync's ${p.rough.length} rough entr${p.rough.length === 1 ? "y" : "ies"} for these days (deck and result only) for the real matches</label>` : ""}
    <span class="muted">Importing updates everything a logged match does: your rank (from Ranked cubes), deck and card stats, goals, achievements, missions, event points (Sanctum Showdown, Deadpool's Diner Bubs and others), opponents, locations, your profile and the widget.</span>
    <div class="row"><button class="btn snap" data-a="svcImport" ${!p.fresh.length || svc.busy ? "disabled" : ""}>Import ${fmt(p.fresh.length)} match${p.fresh.length === 1 ? "" : "es"}</button><button class="btn ghost" data-a="close">Cancel</button></div></div>`;
}
async function svcFiles(files) {
  svc.list = []; svc.files = 0; svc.done = ""; let bad = "";
  for (const f of Array.from(files || [])) {
    if (f.size > 8e6) { bad = `${f.name} is too big`; continue; }
    try { const r = svcRows(await f.text()); if (r.bad) bad = r.bad; else { svc.list.push(...r.list); svc.files++; } } catch (e) { bad = errText(e); }
  }
  if (!svc.list.length) { toast(bad || "No matches found"); return; }
  openSheet(svcSheet);
}
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.svcfile !== undefined) { svcFiles(t.files); t.value = ""; }
  if (t.dataset.svc === "replace") { svc.replace = !!t.checked; }
});
Object.assign(A, {
  svcImport: () => {
    if (svc.busy) return; svc.busy = true;
    const before = { rank: S.me.rank, badges: arr(S.badgesSeen).length };
    try {
      const p = svcPlan(); let gone = 0;
      matchBulk = true; // one batch: no buzz, sound or rematch note for each of them
      try {
        if (svc.replace && p.rough.length) for (const x of p.rough) { removeMatch(x.id); gone++; }
        for (const m of p.fresh) putMatch(m);
      } finally { matchBulk = false; }
      // Then everything a newly logged match updates, once: rank from your Ranked cubes, season peak, goals, achievements,
      // the stream overlay, reminders, the widget, your profile, "you vs your friends" and the deck shortcuts
      const last = p.fresh.slice().sort((a, b) => b.ts - a.ts)[0];
      if (last) onMatchSaved(last);
      const linked = svcLinkDecks();
      save();
      try { pushWidget(); } catch { /* no widget */ }
      if (typeof h2hPublish === "function") setTimeout(() => { try { h2hPublish(); } catch { /* signed out */ } }, 4000);
      if (typeof deckShortcutsSync === "function") setTimeout(() => { try { deckShortcutsSync(); } catch { /* older app */ } }, 3000);
      const ranked = p.fresh.filter((m) => m.mode === "Ranked"), cubesN = ranked.reduce((t, m) => t + num(m.cubes), 0);
      const evTot = new Map(); for (const m of p.fresh) if (m.eventGain) evTot.set(m.mode, num(evTot.get(m.mode)) + num(m.eventGain.amount));
      const decksUsed = new Set(p.fresh.map((m) => m.deckId).filter(Boolean)).size, unlinked = new Set(p.fresh.filter((m) => !m.deckId && m.deckName).map((m) => m.deckName)).size;
      svc.done = [
        `${fmt(p.fresh.length)} match${p.fresh.length === 1 ? "" : "es"} added${gone ? ` (${gone} rough SnapVault sync entr${gone === 1 ? "y" : "ies"} replaced)` : ""}.`,
        ranked.length ? `Ranked: ${ranked.length} games, ${signed(cubesN)} cubes${S.me.rank && S.me.rank !== before.rank ? `; your rank is now ${S.me.rank}` : S.me.rank ? `; rank ${S.me.rank}` : ""}.` : "",
        ...[...evTot].filter(([, v]) => v).map(([md, v]) => `${md}: ${signed(v)} ${md === "Deadpool's Diner" ? "Bubs" : "points"} added to the event.`),
        decksUsed ? `${decksUsed} deck${decksUsed === 1 ? "" : "s"} got their games${linked ? ` (${linked} earlier match${linked === 1 ? "" : "es"} linked too)` : ""}.` : "",
        unlinked ? `${unlinked} deck name${unlinked === 1 ? " isn't" : "s aren't"} in SNAP Stat yet. Import your decks from SnapVault and those matches join them by themselves.` : "",
        arr(S.badgesSeen).length > before.badges ? `New achievements: ${arr(S.badgesSeen).length - before.badges}.` : "",
        "Stats, missions, the season story, opponents and locations all include them now.",
      ].filter(Boolean).join(" ");
    } catch (e) { errNote("importing SnapVault matches", e); }
    finally { svc.busy = false; refreshSheet(); render(); }
  },
  svcGo: (el) => { closeSheet(); go(el.dataset.to); },
});
// Matches from the file whose deck wasn't in SNAP Stat yet join it once a deck with that name shows up (a SnapVault deck import,
// a new deck): their deck stats, card stats and deck shortcuts then include them
function svcLinkDecks() {
  const byKey = new Map(S.decks.map((d) => [svcDeckKey(d.name), d])); let n = 0;
  const todo = realMatches().filter((m) => m.svFile && !m.deckId && m.deckName && byKey.has(svcDeckKey(m.deckName)));
  if (!todo.length) return 0;
  matchBulk = true;
  try { for (const m of todo) { const d = byKey.get(svcDeckKey(m.deckName)); putMatch({ ...m, deckId: d.id, deckName: d.name }); n++; } } finally { matchBulk = false; }
  return n;
}
let _svcDeckSig = "";
EXT.afterRender.push(function svcAutoLink() {
  const sig = realMatches().length + "#" + S.decks.map((d) => d.id + ":" + d.name).join("|"); if (sig === _svcDeckSig) return; _svcDeckSig = sig;
  setTimeout(() => { const n = svcLinkDecks(); if (n) { save(); toast(`${n} match${n === 1 ? "" : "es"} from your SnapVault file joined their deck${n === 1 ? "" : "s"}`); render(); } }, 1500);
});
EXT.settingsData.push(() => `<section class="sec"><h2>SnapVault match history</h2><div class="panel stack small">
  <p>In SnapVault, export your matches (a file like <b>snapvault-matches-2026-11-12.csv</b>) and choose it here. Each match comes in with its time, mode, deck, result, cubes, snaps and locations, and everything that uses matches updates: rank, decks, stats, goals, achievements, events and the widget.</p>
  <label class="btn">Choose the match file<input type="file" accept=".csv,text/csv,text/plain" multiple hidden data-svcfile></label>
  <span class="muted">Choosing the same file again (or several copies) is fine: matches already in SNAP Stat are skipped.</span></div></section>`);
EXT.search.push((q) => (/snapvault|csv|match history|export/i.test(q) ? [{ label: "SnapVault match history file", sub: "Settings › Import & backup", route: "settings/data" }] : []));

/* ---------- 2. On iPhone ---------- */
const APP_LINK = "https://rhaddaddy.github.io/snap-stat/";
EXT.about.push(() => `<section class="sec"><h2>On iPhone</h2><div class="panel stack small">
  <p>There's no App Store app yet, but SNAP Stat works on iPhone and iPad in Safari, and it can sit on the home screen like an app:</p>
  <ol class="ot-steps"><li>Open <b>${esc(APP_LINK.replace("https://", ""))}</b> in Safari.</li><li>Tap the Share button (the square with an arrow), then <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open SNAP Stat from the home screen and sign in with Google.</li></ol>
  <span class="muted">Everything works there except the Android-only extras: Track &amp; play's automatic tracking, the home-screen widgets and reading new screenshots by itself. On iPhone you log matches in two taps or add screenshots yourself.</span>
  <div class="row"><button class="btn sm" data-a="iosCopy">${ICON.copy} Copy the link for a friend</button>${navigator.share ? `<button class="btn sm ghost" data-a="iosShare">Share</button>` : ""}</div></div></section>`);
Object.assign(A, {
  iosCopy: () => copyText(APP_LINK, "Link copied. Send it to your friend and tell them to open it in Safari."),
  iosShare: () => { try { navigator.share({ title: "SNAP Stat", text: "SNAP Stat, a MARVEL SNAP companion. On iPhone: open it in Safari › Share › Add to Home Screen.", url: APP_LINK }); } catch { copyText(APP_LINK, "Link copied"); } },
});
EXT.search.push((q) => (/iphone|ios|ipad|apple|safari/i.test(q) ? [{ label: "SNAP Stat on iPhone", sub: "Settings › About", route: "settings/about" }] : []));
