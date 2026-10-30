/* ============ y14_pc.js: playing on PC — a match tracker and collection sync that read the game's own files ============
   MARVEL SNAP for PC keeps its save files in %USERPROFILE%\AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod.
   In Chrome or Edge on a computer you can let SNAP Stat read that folder (the File System Access API). While it's connected:
   GameState.json is checked every 2 seconds, a finished game is logged as a match by itself, the game in progress shows on Home,
   and CollectionState.json (plus Mastery and alliance files) is read on connect and then once an hour.
   Saved in S.pc (small): on, folder (its name), seen (the last 50 game ids, so a game is logged once), collAt, noColl. */
const PC_PATH = "%USERPROFILE%\\AppData\\LocalLow\\Second Dinner\\SNAP\\Standalone\\States\\nvprod";
const PC = { dir: null, saved: null, status: "off", timer: null, gameMod: 0, live: null, liveAt: 0, busy: false, collTry: 0, booted: false };
const pcSupported = () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
function pcState() { const p = (S.pc = obj(S.pc)); p.seen = arr(p.seen); return p; }
const pcCollOn = () => !pcState().noColl;

/* ---------- Reading GameState.json ---------- */
// Newtonsoft writes shared objects once with "$id" and points at them elsewhere with { "$ref": "n" }: put the objects back in place.
// The result has loops (a card points at its owner, who points at the card), so nothing below walks it blindly.
function pcResolve(root) {
  const ids = new Map(), seen = new Set(), stack = [root];
  while (stack.length) {
    const o = stack.pop(); if (!o || typeof o !== "object" || seen.has(o)) continue; seen.add(o);
    if (!Array.isArray(o) && typeof o.$id === "string") ids.set(o.$id, o);
    for (const k in o) { const v = o[k]; if (v && typeof v === "object") stack.push(v); }
  }
  const isRef = (v) => v && typeof v === "object" && !Array.isArray(v) && typeof v.$ref === "string";
  for (const o of seen) for (const k in o) { if (isRef(o[k])) o[k] = ids.get(o[k].$ref) || null; }
  return root;
}
const pcId = (s) => (typeof s === "string" && /^[A-Za-z0-9_]{1,60}$/.test(s) ? s : "");
// A game card id → the app's card key ("" for tokens like Squirrel, and anything the card list doesn't know)
function pcKey(id) { id = pcId(id); if (!id) return ""; const c = cardByDefId(id); return c && !c.unknown ? c.key : ""; }
const pcKeys = (ids, cap = 14) => [...new Set(arr(ids).map((x) => pcKey(typeof x === "string" ? x : obj(x).Item1 || obj(x).CardDefId)).filter(Boolean))].slice(0, cap);
function pcLocName(def) { def = pcId(def); if (!def) return ""; const l = allLocations().find((x) => x.id === def); return l ? l.name : prettyDef(def); }
function pcMode(league) {
  const L = String(league || "");
  if (/^Ranked/i.test(L)) return "Ranked";
  if (/Conquest/i.test(L)) return "Conquest";
  if (/Friend/i.test(L)) return "Friendly";
  const ev = events().filter((e) => timeState(e) === "live"), pick = ev.find((e) => e.type === "mode") || ev[0];
  return pick ? String(pick.name).slice(0, 40) : "Other";
}
// The deck of yours that best matches a list of card keys (at least `need` cards in common)
function pcDeckFor(keys, need) {
  const want = new Set(keys); let best = null, bestN = 0;
  for (const d of S.decks) { const n = arr(d.cards).filter((k) => want.has(k)).length; if (n > bestN || (n === bestN && best && d.status === "active" && best.status !== "active")) { best = d; bestN = n; } }
  return bestN >= need ? best : null;
}
// Reads the file into what SNAP Stat needs. Returns null for anything that isn't a game (or is half-written).
function pcReadGame(text) {
  let j; try { j = JSON.parse(String(text || "").replace(/^﻿/, "")); } catch { return null; }
  if (!j || typeof j !== "object") return null;
  pcResolve(j);
  const rg = obj(j.RemoteGame), gs = obj(rg.GameState), crm = obj(gs.ClientResultMessage), cgi = obj(rg.ClientGameInfo), cpi = obj(rg.ClientPlayerInfo);
  const players = arr(gs.Players).map(obj);
  if (players.length < 2 && !crm.GameId) return null;
  const pName = (p) => String(p.Name || obj(p.PlayerInfo).Name || "");
  let meIdx = players.findIndex((p) => cgi.LocalPlayerEntityId !== undefined && p.EntityId === cgi.LocalPlayerEntityId);
  if (meIdx < 0 && cpi.Name) meIdx = players.findIndex((p) => pName(p) === cpi.Name);
  if (meIdx < 0) meIdx = 0;
  const me = players[meIdx] || {}, opp = players[1 - meIdx] || {};
  const rawLocs = arr(gs.Locations).map(obj).map((L, i) => ({ L, slot: Number.isFinite(Number(L.SlotIndex)) ? Number(L.SlotIndex) : i })).sort((a, b) => a.slot - b.slot).map((x) => x.L);
  // Player1 is the first player in the list, unless the cards on the board say otherwise
  const ownerOf = (c) => obj(obj(c).Owner).EntityId;
  let p1Me = meIdx === 0, mine1 = 0, theirs1 = 0;
  for (const L of rawLocs) for (const c of arr(L.Player1Cards)) { if (ownerOf(c) === me.EntityId) mine1++; else if (ownerOf(c) === opp.EntityId) theirs1++; }
  if (mine1 !== theirs1) p1Me = mine1 > theirs1;
  const cardsOf = (list) => arr(list).map(obj).map((c) => ({ id: pcId(c.CardDefId), power: num(obj(c.Power).Value, num(c.DefPower)), shown: c.Revealed !== false, owner: ownerOf(c) })).filter((c) => c.id);
  const turn = num(gs.Turn);
  const locs = rawLocs.slice(0, 3).map((L, i) => ({ def: pcId(L.LocationDefId), i, my: num(p1Me ? L.CurPlayer1Power : L.CurPlayer2Power), opp: num(p1Me ? L.CurPlayer2Power : L.CurPlayer1Power), myCards: cardsOf(p1Me ? L.Player1Cards : L.Player2Cards), oppCards: cardsOf(p1Me ? L.Player2Cards : L.Player1Cards) }));
  const zone = (p, z) => cardsOf(obj(p[z]).Cards);
  const snapT = (p) => { const t = num(arr(p.TurnsOnStakesRaiseRequested)[0]); return t > 0 && t <= 8 ? t : 0; };
  // Their cards you've seen: on their side of the board (face up), in their discard and destroyed piles, and what the game lists
  const oppIds = [];
  for (const L of locs) for (const c of L.oppCards) if (c.shown && c.owner !== me.EntityId) oppIds.push(c.id);
  for (const c of zone(opp, "Graveyard")) oppIds.push(c.id);
  oppIds.push(...arr(opp.CardDefIdsRevealedThisGame), ...arr(opp.CardDefIdsPlayedThisGame));
  const g = { id: String(crm.GameId || gs.Id || "").slice(0, 40), over: !!crm.GameId, league: String(crm.LeagueDefId || gs.LeagueDefId || ""), turn, cubeValue: num(gs.CubeValue), nextValue: num(gs.CubeValueNextTurn), raised: num(gs.StakesRaisedCount),
    oppName: pName(opp).slice(0, 30), mySnapTurn: snapT(me), oppSnapTurn: snapT(opp), locs, oppIds, me, opp };
  // While the game is on: what you've drawn and played so far
  g.myIds = [...zone(me, "Hand").map((c) => c.id), ...locs.flatMap((L) => L.myCards.filter((c) => c.owner !== opp.EntityId).map((c) => c.id)), ...zone(me, "Graveyard").map((c) => c.id), ...arr(me.CardDefIdsDrawnThisGame), ...arr(cpi.CardsDrawn)];
  g.myPlayedIds = [...arr(me.CardDefIdsPlayedThisGame), ...locs.flatMap((L) => L.myCards.filter((c) => c.owner !== opp.EntityId).map((c) => c.id))];
  if (!g.over) { g.total = Math.max(6, num(gs.TotalTurns || gs.LastTurn), turn); return g; }
  // The game is over: the result message has the rest
  const items = arr(crm.GameResultAccountItems).map(obj), myAcc = me.AccountId || cpi.AccountId;
  const mine = items.find((x) => myAcc && x.AccountId === myAcc) || items.find((x) => x.Deck || arr(x.CardDefIdsDrawn).length) || items[0] || {};
  const theirs = items.find((x) => x !== mine) || {};
  const winId = obj(gs.Winner).EntityId, loseId = obj(gs.Loser).EntityId;
  g.result = mine.IsWinner === true ? "W" : mine.IsLoser === true ? "L" : theirs.IsWinner === true ? "L" : theirs.IsLoser === true ? "W" : winId !== undefined && winId === me.EntityId ? "W" : loseId !== undefined && loseId === me.EntityId ? "L" : "T";
  g.final = Math.max(0, num(crm.FinalCubeValue, num(gs.CubeValue)));
  g.turn = num(crm.TurnsTaken) || turn; g.total = num(crm.TotalTurns) || Math.max(6, turn);
  g.snapped = crm.IsStakesRaisedByPlayer === true || mine.StakesRaised === true || g.mySnapTurn > 0;
  g.oppSnapped = mine.StakesRaisedByOpponent === true || theirs.StakesRaised === true || g.oppSnapTurn > 0;
  g.drawnIds = arr(mine.CardDefIdsDrawn); g.playedIds = arr(mine.CardDefIdsPlayed);
  const deck = obj(mine.Deck); g.deckName = String(deck.Name || "").slice(0, 60); g.deckIds = arr(deck.Cards).map((c) => pcId(obj(c).CardDefId)).filter(Boolean);
  oppIds.push(...arr(theirs.CardsSeen).map((c) => obj(c).Item1), ...arr(theirs.CardDefIdsPlayed));
  // Final power per location: the board, or the result message's own numbers when the board isn't there
  const endDefs = arr(crm.LocationDefIdsAtEndOfGame).map(pcId), mr = arr(mine.LocationResults).map(obj), tr = arr(theirs.LocationResults).map(obj);
  g.endLocs = [0, 1, 2].map((i) => { const L = locs[i]; return { def: endDefs[i] || (L ? L.def : ""), my: L ? L.my : num(obj(mr[i]).PowerPlayed), opp: L ? L.opp : num(obj(tr[i]).PowerPlayed), cards: L ? L.myCards.filter((c) => c.owner !== opp.EntityId) : [] }; }).filter((L) => L.def);
  return g;
}
// A finished game → a match in SNAP Stat's own shape
function pcMatchFrom(g, ts) {
  const deckKeys = pcKeys(g.deckIds, 12), d = deckKeys.length ? pcDeckFor(deckKeys, 9) : null;
  const early = g.turn > 0 && g.total > 0 && g.turn < g.total;
  const plays = g.endLocs.flatMap((L, li) => L.cards.map((c) => ({ k: pcKey(c.id), loc: li, power: c.power }))).filter((p) => p.k).slice(0, 16);
  const m = { id: uid(), ts, result: g.result, cubes: g.result === "W" ? g.final : g.result === "L" ? -g.final : 0, mode: pcMode(g.league), deckId: d ? d.id : "", deckName: d ? d.name : g.deckName,
    oppName: g.oppName, oppCards: [...new Set(arr(g.oppIds).map((id) => { const k = pcKey(id); return k ? card(k).name : ""; }).filter(Boolean))].slice(0, 12),
    snapped: g.snapped, oppSnapped: g.oppSnapped, retreated: early && g.result === "L", oppRetreated: early && g.result === "W", turn: g.turn || 6, bot: "unsure", notes: "",
    tracked: true, src: "pc", pcId: g.id.slice(0, 24), locs: g.endLocs.map((L) => ({ name: pcLocName(L.def), my: L.my, opp: L.opp })), plays, drawn: pcKeys(g.drawnIds), played: pcKeys(g.playedIds) };
  if (g.mySnapTurn && g.snapped) m.snapTurn = g.mySnapTurn;
  if (g.oppSnapTurn && g.oppSnapped) m.oppSnapTurn = g.oppSnapTurn;
  return m;
}
const pcResultTxt = (m) => `${m.result === "W" ? "Win" : m.result === "L" ? "Loss" : "Tie"}${m.result === "T" ? "" : " " + signed(num(m.cubes))}`;
// Logs a finished game once. A game older than 12 hours when first seen (it was already in the folder) is only remembered.
// If you also logged it by hand, the PC details go into that match instead of making a second one.
function pcLogGame(g, ts) {
  const pc = pcState(), sid = String(g.id || "").slice(0, 24);
  if (!sid || pc.seen.includes(sid)) return null;
  pc.seen = [...pc.seen, sid].slice(-50);
  if (realMatches().some((m) => m.pcId === sid) || Date.now() - ts > 12 * 3600e3) { save(); return null; }
  let m = pcMatchFrom(g, ts);
  const twin = realMatches().find((x) => x.src !== "pc" && Math.abs(x.ts - ts) < 20 * 60e3 && x.result === m.result && (!x.oppName || keyOf(x.oppName) === keyOf(m.oppName)));
  if (twin) { const keep = { id: twin.id, ts: twin.ts, notes: twin.notes, bot: twin.bot, tags: twin.tags }; m = { ...twin, ...m, ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)) }; if (twin.deckId && !m.deckId) { m.deckId = twin.deckId; m.deckName = twin.deckName; } }
  putMatch(m); onMatchSaved(m); save();
  toast(`${twin ? "Added the PC details to your match" : "Match logged from PC"}: ${pcResultTxt(m)}`);
  return m;
}
// What a read of GameState.json does. Exposed so tests can feed it a file: returns "logged", "seen", "live" or false (not a game yet).
function pcHandleGame(text, mod) {
  const g = pcReadGame(text); if (!g || !g.id) return false;
  mod = num(mod) || Date.now();
  if (g.over) { PC.live = null; const m = pcLogGame(g, mod); pcRedraw(true); return m ? "logged" : "seen"; }
  if (pcState().seen.includes(g.id.slice(0, 24))) { PC.live = null; pcRedraw(true); return "seen"; }
  PC.live = g; PC.liveAt = mod; pcRedraw(false); return "live";
}

/* ---------- Watching the folder ---------- */
// The folder handle is kept in this browser's IndexedDB (a handle can't go in S), one per MARVEL SNAP account slot
const pcIdbKey = () => "dir" + (SLOT ? "." + SLOT : "");
function pcIdb(mode, fn) {
  return new Promise((res) => {
    try {
      const rq = indexedDB.open("snapstat-pc", 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore("h"); } catch { /* exists */ } };
      rq.onerror = () => res(null);
      rq.onsuccess = () => { try { const db = rq.result, tx = db.transaction("h", mode), r = fn(tx.objectStore("h")); tx.oncomplete = () => { res(r && "result" in r ? r.result : true); db.close(); }; tx.onerror = tx.onabort = () => { res(null); db.close(); }; } catch { res(null); } };
    } catch { res(null); }
  });
}
const pcIdbGet = () => pcIdb("readonly", (st) => st.get(pcIdbKey()));
const pcIdbPut = (h) => pcIdb("readwrite", (st) => st.put(h, pcIdbKey()));
const pcIdbDel = () => pcIdb("readwrite", (st) => st.delete(pcIdbKey()));
async function pcHasFiles(dir) { for (const n of ["GameState.json", "CollectionState.json"]) { try { await dir.getFileHandle(n); return true; } catch { /* not here */ } } return false; }
// Someone may pick a folder above nvprod: look a few levels down for it
async function pcFindStates(h) {
  if (await pcHasFiles(h)) return h;
  const paths = [["nvprod"], ["States", "nvprod"], ["Standalone", "States", "nvprod"], ["SNAP", "Standalone", "States", "nvprod"], ["Second Dinner", "SNAP", "Standalone", "States", "nvprod"], ["LocalLow", "Second Dinner", "SNAP", "Standalone", "States", "nvprod"]];
  for (const p of paths) { try { let d = h; for (const n of p) d = await d.getDirectoryHandle(n); if (await pcHasFiles(d)) return d; } catch { /* not this way */ } }
  return null;
}
function pcStart(dir, fresh) {
  PC.dir = dir; PC.saved = dir; PC.status = "watching"; PC.gameMod = 0; PC.live = null;
  const pc = pcState(); pc.on = true; pc.folder = String(dir.name || "nvprod").slice(0, 40);
  clearInterval(PC.timer); PC.timer = setInterval(pcTick, 2000);
  if (fresh) save();
  pcTick(); if (pcCollOn() && (fresh || Date.now() - num(pc.collAt) > 3600e3)) pcSyncColl(false);
  else PC.collTry = Date.now();
}
function pcStop(status) { clearInterval(PC.timer); PC.timer = null; PC.dir = null; PC.live = null; PC.status = status; pcRedraw(true); }
async function pcTick() {
  if (!PC.dir || PC.busy) return; PC.busy = true;
  try {
    let f = null;
    try { f = await (await PC.dir.getFileHandle("GameState.json")).getFile(); } catch (e) { if (e && e.name === "NotAllowedError") { pcStop("paused"); return; } f = null; }
    if (f && f.lastModified !== PC.gameMod) { PC.gameMod = f.lastModified; if (f.size > 0 && f.size < 30e6) { const ok = pcHandleGame(await f.text(), f.lastModified); if (!ok) PC.gameMod = 0; } }
    // A game left open in the file for over half an hour isn't "in progress" any more
    if (PC.live && Date.now() - PC.liveAt > 30 * 60e3) { PC.live = null; pcRedraw(true); }
    if (pcCollOn() && Date.now() - PC.collTry > 3600e3) await pcSyncColl(false);
  } catch (e) { if (e && e.name === "NotAllowedError") pcStop("paused"); }
  finally { PC.busy = false; }
}
async function pcBoot() {
  if (PC.booted || !pcSupported()) return; PC.booted = true;
  if (!pcState().on) return;
  const h = await pcIdbGet(); if (!h || typeof h.queryPermission !== "function") return;
  PC.saved = h;
  let p = "prompt"; try { p = await h.queryPermission({ mode: "read" }); } catch { /* old browser */ }
  if (p === "granted") pcStart(h, false); else { PC.status = "paused"; pcRedraw(true); }
}
if (pcSupported()) whenDataReady(() => setTimeout(pcBoot, 300));

/* ---------- Collection sync ---------- */
const PC_COLL_FILES = ["CollectionState.json", "CharacterMasteryState.json", "ClanState.json"];
async function pcSyncColl(manual) {
  if (!PC.dir) return null; PC.collTry = Date.now();
  const files = [];
  for (const n of PC_COLL_FILES) { try { const f = await (await PC.dir.getFileHandle(n)).getFile(); if (f.size > 0 && f.size < 40e6) files.push({ text: await f.text(), name: n }); } catch { /* not there */ } }
  if (!files.length) { if (manual) toast("CollectionState.json isn't in that folder yet. Open MARVEL SNAP on this computer once."); return null; }
  return pcApplyColl(files, manual);
}
// What's new in a sync, in words (boosters change every game, so they're saved without a message)
function pcCollNews(r) {
  const out = [], n = (x, one, many) => (x ? out.push(`${fmt(x)} ${x === 1 ? one : many}`) : 0);
  n(r.cardsNew, "new card", "new cards"); n(r.varsNew, "new variant", "new variants"); n(r.splitsNew, "new split", "new splits"); n(r.cosNew, "new avatar, title or card back", "new avatars, titles and card backs");
  n(r.looksNew, "Custom Card", "Custom Cards"); n(r.masterySet, "Mastery level up", "Mastery levels up");
  if (r.cl) out.push(`Collection Level ${fmt(r.cl)}`);
  return out;
}
function pcApplyColl(files, manual) {
  const r = applyGameFiles(files, { quiet: true }), pc = pcState();
  pc.collAt = Date.now();
  if (!r) { save(); if (manual) toast("Couldn't read the collection file. Try again in a minute."); pcRedraw(true); return null; }
  const news = pcCollNews(r);
  if (news.length) { collSyncNow(); toast("Collection synced from PC: " + news.slice(0, 3).join(", ")); }
  else if (manual) toast("Collection synced from PC. Nothing new.");
  save(); pcRedraw(true); return r;
}

/* ---------- Redrawing without getting in the way ---------- */
// Only the PC panels are swapped while you're on another screen or typing; a full redraw waits until it's safe.
function pcRedraw(full) {
  const live = document.getElementById("pc-live"), st = document.getElementById("pc-status");
  if (st) st.innerHTML = pcStatusHtml();
  const html = pcLiveHtml();
  if (live && !full) { if (html) live.outerHTML = html; else live.remove(); return; }
  if (!full && !html) return;
  if (typeof isTyping === "function" && (isTyping() || filePicking())) { pendingRender = true; return; }
  if (!$("#sheet").hidden && !full) return;
  render();
}

/* ---------- Settings › Import & backup: "Playing on PC" ---------- */
function pcLastMatch() { return realMatches().find((m) => m.src === "pc") || null; }
function pcStatusHtml() {
  const pc = pcState(), last = pcLastMatch();
  const st = PC.status === "watching" ? `<span class="pill W">Watching for matches</span>` : PC.status === "paused" ? `<span class="pill warn">Paused</span>` : `<span class="pill dim">Not connected</span>`;
  return `<div class="row">${st}${PC.dir || PC.saved ? `<span class="muted">Folder: <b>${esc((PC.dir || PC.saved).name || pc.folder || "nvprod")}</b></span>` : ""}</div>
    ${PC.live ? `<span>A match is on right now (turn ${num(PC.live.turn)}). It's on Home.</span>` : ""}
    <span class="muted">${last ? `Last match seen: <b>${esc(pcResultTxt(last))}</b>${last.oppName ? ` vs ${esc(last.oppName)}` : ""} · ${esc(agoTxt(last.ts))}` : "No PC matches logged yet. Play one and it shows up here."}</span>
    ${pcCollOn() ? `<span class="muted">${pc.collAt ? `Collection synced from PC · ${esc(agoTxt(pc.collAt))}` : "Collection not synced yet"}</span>` : ""}`;
}
function pcPanel() {
  const pc = pcState();
  if (!pcSupported()) return `<section class="sec"><h2>Playing on PC</h2><div class="panel small"><p class="muted">The PC match tracker works in Chrome or Edge on a computer that has MARVEL SNAP installed. Open SNAP Stat there to log your PC matches by themselves.${pc.on && pcLastMatch() ? ` Last PC match: ${esc(pcResultTxt(pcLastMatch()))}, ${esc(agoTxt(pcLastMatch().ts))}.` : ""}</p></div></section>`;
  const on = !!(PC.dir || PC.saved) && pc.on;
  if (!on) return `<section class="sec"><h2>Playing on PC</h2><div class="panel stack small">
      <p>Play MARVEL SNAP on this computer and SNAP Stat logs every match by itself: the result, cubes, your deck, the cards both of you played, the locations and who snapped. It keeps your collection in sync too.</p>
      <ol class="tips"><li>Tap <b>Connect the game's folder</b>.</li><li>In the window that opens, paste this into the address bar at the top and press Enter:<br><code style="overflow-wrap:anywhere">${esc(PC_PATH).replace(/\\/g, "\\<wbr>")}</code> <button class="btn sm ghost" data-a="pcCopyPath">${ICON.copy} Copy</button></li><li>Tap <b>Select folder</b>, then <b>View files</b>.</li></ol>
      <div><button class="btn snap" data-a="pcConnect">Connect the game's folder</button></div>
      <span class="muted">SNAP Stat only reads these files, on this computer. Your account details in them are never saved or sent anywhere.</span></div></section>`;
  return `<section class="sec"><h2>Playing on PC</h2><div class="panel stack small">
      <div id="pc-status" class="stack" style="gap:6px">${pcStatusHtml()}</div>
      ${PC.status === "paused" ? `<p class="note">Chrome asks again after it restarts. Tap Resume to keep logging your matches.</p><div><button class="btn snap" data-a="pcResume">Resume watching</button></div>` : ""}
      <label class="check"><input type="checkbox" data-pcchk="coll" ${pcCollOn() ? "checked" : ""}> Keep my collection in sync (every hour)</label>
      <div class="row">${PC.dir && pcCollOn() ? `<button class="btn sm" data-a="pcSync">Sync collection now</button>` : ""}${typeof collImp !== "undefined" && collImp && pc.collAt ? `<button class="btn sm ghost" data-a="pcCollDetails">What the last sync found</button>` : ""}<button class="btn sm ghost danger" data-a="pcDisconnect">Disconnect</button></div>
      <span class="muted">Keep this tab open while you play. It can sit in the background. PC matches show in Home › Matches with a PC tag.</span></div></section>`;
}
EXT.settingsData.push(pcPanel);

document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || t.dataset.pcchk !== "coll") return;
  const pc = pcState(); if (t.checked) { delete pc.noColl; if (PC.dir) pcSyncColl(true); } else pc.noColl = true;
  save(); render();
});
Object.assign(A, {
  pcCopyPath: () => copyText(PC_PATH, "Folder path copied"),
  pcConnect: async () => {
    if (!pcSupported()) { toast("This works in Chrome or Edge on a computer."); return; }
    let h; try { h = await window.showDirectoryPicker({ id: "snapstat-pc", mode: "read" }); } catch (e) { if (!e || e.name !== "AbortError") toast("Chrome couldn't open that folder. You can still choose the files with Import the game's files."); return; }
    const dir = await pcFindStates(h);
    if (!dir) { toast("That folder doesn't have the game's files. Pick the nvprod folder: copy the path from step 2."); return; }
    await pcIdbPut(dir); pcStart(dir, true); render(); toast("Connected. Watching for matches");
  },
  pcResume: async () => {
    const h = PC.saved; if (!h) return;
    let p = "denied"; try { p = await h.requestPermission({ mode: "read" }); } catch { /* refused */ }
    if (p === "granted") { pcStart(h, false); render(); toast("Watching for matches again"); } else toast("SNAP Stat needs to see the folder to log matches. Tap Resume and choose View files.");
  },
  pcSync: () => { pcSyncColl(true); },
  pcCollDetails: () => { if (typeof collImp !== "undefined" && collImp) openSheet(collImpSheet); },
  pcDisconnect: () => { pcStop("off"); PC.saved = null; const pc = pcState(); pc.on = false; pcIdbDel(); save(); render(); toast("PC folder disconnected"); },
});

/* ---------- Home › Overview: the PC match that's on right now ---------- */
// Only what the game shows you: locations once they're revealed, and their cards once they're face up.
function pcLiveDeck(g) { const known = pcKeys(g.myIds, 30); return known.length >= 3 ? pcDeckFor(known, Math.max(3, Math.ceil(known.length * 0.8))) : null; }
function pcLiveHtml() {
  const g = PC.live;
  if (!g) return PC.status === "paused" && pcState().on && pcSupported() ? `<section class="sec" id="pc-live"><div class="panel row between small"><span>The PC match tracker is paused.</span><button class="btn sm snap" data-a="pcResume">Resume</button></div></section>` : "";
  const d = pcLiveDeck(g), played = pcKeys(g.myPlayedIds, 12), theirs = pcKeys(g.oppIds, 12);
  const chips = (ks, none) => (ks.length ? `<div class="chiplist">${ks.map((k) => cardChip(k, { noOwn: true, text: true })).join("")}</div>` : `<span class="muted small">${none}</span>`);
  const loc = (L, i) => { const open = L && L.def && g.turn >= i + 1, st = L && L.my > L.opp ? "pos" : L && L.my < L.opp ? "neg" : "";
    return `<div class="pcloc"><div class="t">${open ? esc(pcLocName(L.def)) : `<span class="muted">Reveals on turn ${i + 1}</span>`}</div>${open ? `<div class="num small">You <b class="${st}">${L.my}</b></div><div class="num small muted">Them ${L.opp}</div>` : ""}</div>`; };
  const snaps = [g.mySnapTurn ? `<span class="pill gold">You snapped · turn ${g.mySnapTurn}</span>` : "", g.oppSnapTurn ? `<span class="pill warn">They snapped · turn ${g.oppSnapTurn}</span>` : ""].join("");
  return `<section class="sec" id="pc-live"><div class="sec-h"><h2>PC match in progress</h2><span class="pill live">Turn ${Math.max(1, g.turn)} of ${g.total}</span></div>
    <div class="panel stack">
      <div class="row">${cubes(Math.max(1, g.cubeValue))}<span class="muted small">at stake${g.nextValue > g.cubeValue ? ` · ${g.nextValue} from next turn` : ""}${g.oppName ? ` · vs ${esc(g.oppName)}` : ""}</span>${snaps}</div>
      <div class="pclocs">${[0, 1, 2].map((i) => loc(g.locs[i], i)).join("")}</div>
      <div class="small"><span class="eyebrow">Your deck</span> ${d ? esc(d.name) : `<span class="muted">Not sure yet</span>`}</div>
      <div class="stack" style="gap:4px"><span class="eyebrow">You've played</span>${chips(played, "Nothing yet")}</div>
      <div class="stack" style="gap:4px"><span class="eyebrow">Their cards so far</span>${chips(theirs, "None revealed yet")}</div>
      <span class="muted small">Logged by itself when the game ends.</span></div></section>`;
}
EXT.homeTop.push(pcLiveHtml);
EXT.styles.push(`.pclocs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.pcloc { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 7px 8px; min-width: 0; }
.pcloc .t { font-weight: 700; font-size: 13px; line-height: 1.2; overflow-wrap: anywhere; margin-bottom: 2px; }`);

/* ---------- 9. The kind of deck they played, saved on each match ---------- */
// Set when a match is saved with 3 or more of their cards (kept fresh when the cards are edited)
EXT.onMatch.push((m) => { if (m && arr(m.oppCards).length >= 3) { const a = archetypeOf(m.oppCards); if (a) m.oppArch = a; } });
// Older matches don't have it saved: worked out once per match and kept until the card data changes
const _pcArch = { cv: -1, map: new Map() };
function pcArch(m) {
  if (!m) return ""; if (m.oppArch) return String(m.oppArch);
  const oc = arr(m.oppCards); if (oc.length < 3) return "";
  if (_pcArch.cv !== catVer) { _pcArch.cv = catVer; _pcArch.map.clear(); }
  const k = m.id + ":" + oc.length; if (!_pcArch.map.has(k)) _pcArch.map.set(k, archetypeOf(oc) || "");
  return _pcArch.map.get(k);
}
// 11. Small tags at the start of a match row in Home › Matches (called from vLog)
function pcRowPills(m) { const a = pcArch(m); return `${m && m.src === "pc" ? `<span class="pill gold pcp">PC</span>` : ""}${a ? `<span class="pill dim pcp">${esc(a)}</span>` : ""}`; }
EXT.styles.push(`.li .s .pcp, .pcp { padding: 0 6px; font-size: 10.5px; line-height: 16px; margin-right: 4px; vertical-align: 1px; white-space: nowrap; }`);

/* ---------- 4, 7, 11. The match sheet: PC tag, their deck type, who snapped, what you drew and played ---------- */
function pcSnapLine(m) {
  const y = num(m.snapTurn), t = num(m.oppSnapTurn), on = (n) => (n ? ` on turn ${n}` : "");
  if (m.snapped && m.oppSnapped) return `Both of you snapped: you${on(y)}, them${on(t)}.${y && t ? y < t ? " You snapped first." : y > t ? " They snapped first." : " Same turn." : ""}`;
  if (m.snapped) return `You snapped${on(y)}. They didn't.`;
  if (m.oppSnapped) return `They snapped${on(t)}. You didn't${m.retreated ? ", and you retreated" : ""}.`;
  return "Nobody snapped.";
}
EXT.matchSheet.push((mf) => {
  if (!mf) return "";
  const a = pcArch(mf), isPc = mf.src === "pc", drawn = arr(mf.drawn).slice(0, 14), played = arr(mf.played).slice(0, 14);
  if (!a && !isPc && !drawn.length) return "";
  const deck = S.decks.find((d) => d.id === mf.deckId) || null;
  const chips = (ks) => `<div class="chiplist">${ks.map((k) => cardChip(k, { noOwn: true, text: true, deck })).join("")}</div>`;
  return `<div class="panel stack small" id="pc-mf">
    <div class="row">${isPc ? `<span class="pill gold">PC</span><span class="muted">Logged from the game on PC</span>` : ""}${a ? `<span class="pill dim">Their deck: ${esc(a)}</span>` : ""}</div>
    ${isPc ? `<span>${esc(pcSnapLine(mf))}</span>` : ""}
    ${drawn.length ? `<div class="stack" style="gap:4px"><span class="eyebrow">Drawn (${drawn.length})</span>${chips(drawn)}</div>` : ""}
    ${played.length ? `<div class="stack" style="gap:4px"><span class="eyebrow">Played (${played.length})</span>${chips(played)}</div>` : ""}</div>`;
});

/* ---------- Home › Stats: snaps, game length and retreat math (same period and mode as the rest of the page) ---------- */
const _pcSt = { key: "", v: null };
function pcStatsData() {
  const key = `${_mVer}|${ui.period}|${ui.homeMode || ""}|${catVer}`;
  if (_pcSt.key === key && _pcSt.v) return _pcSt.v;
  const p = periodById(ui.period), g = byMode(inPeriod(allMatches(), p)).filter((m) => ["W", "L", "T"].includes(m.result));
  const cpg = (list) => { const c = list.filter((m) => !m.noCubes); return c.length ? avgCubes(c) : null; };
  const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
  // 7. Snaps
  const snapRows = [["Only you", (m) => m.snapped && !m.oppSnapped], ["Only them, you stayed", (m) => !m.snapped && m.oppSnapped && !m.retreated], ["Only them, you retreated", (m) => !m.snapped && m.oppSnapped && m.retreated], ["Both of you", (m) => m.snapped && m.oppSnapped], ["Nobody", (m) => !m.snapped && !m.oppSnapped]]
    .map(([l, f]) => { const list = g.filter(f); return { l, n: list.length, wr: winPct(list), cpg: cpg(list) }; });
  const both = g.filter((m) => m.snapped && m.oppSnapped && num(m.snapTurn) && num(m.oppSnapTurn));
  const youFirst = both.filter((m) => num(m.snapTurn) < num(m.oppSnapTurn)), themFirst = both.filter((m) => num(m.snapTurn) > num(m.oppSnapTurn));
  const myT = g.filter((m) => m.snapped && num(m.snapTurn) > 0).map((m) => num(m.snapTurn)), theirT = g.filter((m) => m.oppSnapped && num(m.oppSnapTurn) > 0).map((m) => num(m.oppSnapTurn));
  // 8. Game length
  const B = [["t6", "6 turns"], ["t7", "7 turns"], ["you", "You retreated"], ["them", "They retreated"], ["short", "Ended early"]];
  const kindOf = (m) => { const t = num(m.turn) || 6; return m.retreated ? "you" : m.oppRetreated ? "them" : t >= 7 ? "t7" : t <= 5 ? "short" : "t6"; };
  const cnt = {}; g.forEach((m) => { const k = kindOf(m); cnt[k] = (cnt[k] || 0) + 1; });
  const turns = g.map((m) => num(m.turn)).filter((t) => t > 0 && t <= 8);
  const retT = g.filter((m) => m.retreated && num(m.turn) > 0 && (m.src === "pc" || num(m.turn) < 6)).map((m) => num(m.turn));
  // 12. Retreat math: what your retreats cost, against the losses you played to the end
  const cg = g.filter((m) => !m.noCubes), ret = cg.filter((m) => m.retreated), full = cg.filter((m) => m.result === "L" && !m.retreated);
  const lostR = mean(ret.map((m) => -num(m.cubes))), lostF = mean(full.map((m) => -num(m.cubes)));
  _pcSt.v = { p, games: g.length, snapRows, anySnap: g.some((m) => m.snapped || m.oppSnapped), both: both.length, youFirst: youFirst.length, themFirst: themFirst.length, youFirstWr: winPct(youFirst), myT: mean(myT), myTn: myT.length, theirT: mean(theirT), theirTn: theirT.length,
    len: B.map(([k, l]) => ({ k, l, n: cnt[k] || 0 })).filter((b) => b.n || b.k === "t6"), avgTurns: mean(turns), retT: mean(retT), retTn: retT.length,
    ret: ret.length, full: full.length, lostR, lostF, saved: Math.round(ret.length * (lostF - lostR)) };
  _pcSt.key = key; return _pcSt.v;
}
function pcSnapsHtml() {
  const x = pcStatsData(), head = `<section class="sec"><h2>Snaps</h2><div class="eyebrow">${esc(x.p.label)} · ${plural(x.games, "game")}</div>`;
  if (!x.anySnap) return `${head}<div class="empty"><strong>No snaps logged yet</strong><span>Tick “You snapped” or “They snapped” when you log a match. Matches from PC do it for you.</span></div></section>`;
  const rows = x.snapRows.filter((r) => r.n).map((r) => `<tr><td>${esc(r.l)}</td><td class="n">${r.n}</td><td class="n">${r.wr}%</td><td class="n ${num(r.cpg) >= 0 ? "pos" : "neg"}">${r.cpg === null ? "—" : signed(r.cpg)}</td></tr>`).join("");
  const lines = [];
  if (x.myTn || x.theirTn) lines.push(`On average ${x.myTn ? `you snap on turn ${x.myT}` : ""}${x.myTn && x.theirTn ? " and " : ""}${x.theirTn ? `they snap on turn ${x.theirT}` : ""}.`);
  if (x.both) lines.push(`In ${plural(x.both, "game")} where you both snapped and the turns are known, you snapped first ${plural(x.youFirst, "time")} and they did ${plural(x.themFirst, "time")}.${x.youFirst ? ` You won ${x.youFirstWr}% when you snapped first.` : ""}`);
  return `${head}<div class="tbl-wrap"><table class="pctbl"><thead><tr><th>Who snapped</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Cubes a game</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${lines.length ? `<p class="small">${lines.map(esc).join(" ")}</p>` : `<p class="muted small">Add the turn you snapped when you log a match (PC matches do it for you) to see who snaps first.</p>`}</section>`;
}
function pcLengthHtml() {
  const x = pcStatsData(), head = `<section class="sec"><h2>Game length</h2><div class="eyebrow">${esc(x.p.label)} · ${plural(x.games, "game")}</div>`;
  if (!x.games) return `${head}<div class="empty"><strong>No matches in this period</strong><span>Log a few to see how your games end.</span></div></section>`;
  const max = Math.max(1, ...x.len.map((b) => b.n)), H = 26;
  const bars = x.len.map((b, i) => { const w = Math.max(b.n ? 3 : 0, Math.round((b.n / max) * 150)); return `<text x="0" y="${i * H + 17}">${esc(b.l)}</text><rect class="${b.k}" x="108" y="${i * H + 6}" width="${w}" height="14" rx="4"></rect><text class="pcn" x="${108 + w + 6}" y="${i * H + 17}">${b.n} · ${pct(b.n, x.games)}%</text>`; }).join("");
  const label = x.len.map((b) => `${b.l}: ${b.n}`).join(", ");
  return `${head}<div class="panel stack"><div class="tiles"><div class="tile"><div class="k">Avg turns</div><div class="v">${x.avgTurns || "—"}</div></div><div class="tile"><div class="k">Played to the end</div><div class="v">${pct(x.len.filter((b) => b.k === "t6" || b.k === "t7").reduce((s, b) => s + b.n, 0), x.games)}%</div></div></div>
    <svg class="pcsvg" viewBox="0 0 320 ${x.len.length * H}" width="100%" role="img" aria-label="${esc("How your games ended. " + label)}">${bars}</svg>
    ${x.retTn >= 2 ? `<span class="small">You usually retreat on turn ${x.retT}.</span>` : ""}
    <span class="muted small">Most games last 6 turns; some locations make it 7.</span></div></section>`;
}
function pcRetreatHtml() {
  const x = pcStatsData(), head = `<section class="sec"><h2>Retreat math</h2><div class="eyebrow">${esc(x.p.label)}</div>`;
  if (!x.ret) return `${head}<div class="empty"><strong>No retreats yet</strong><span>When you retreat from a game, this shows how many cubes it saved you compared with playing on and losing.</span></div></section>`;
  const tile = (k, v, cls = "") => `<div class="tile"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  const msg = !x.full ? `<p class="small">You haven't lost a game played to the end in this period, so there's nothing to compare your retreats with yet.</p>`
    : x.saved > 0 ? `<p><b>Retreating saved you about ${plural(x.saved, "cube")}.</b></p><p class="muted small">That's if your ${plural(x.ret, "retreat")} would have been losses played to the end, which cost you ${x.lostF} cubes each on average.</p>`
    : x.lostR > x.lostF + 0.4 ? `<p class="small"><b>Your retreats cost more than the losses you play out</b> (${x.lostR} vs ${x.lostF} cubes each). That usually means retreating after a snap. Retreat earlier, before the stakes go up.</p>`
    : `<p class="small">Your retreats cost about as much as playing on (${x.lostR} vs ${x.lostF} cubes each). Retreat earlier, before the stakes go up, to save more.</p>`;
  return `${head}<div class="panel stack"><div class="tiles">${tile("Lost per retreat", x.lostR ? "−" + x.lostR : "0", "neg")}${tile("Lost per full loss", x.full ? "−" + x.lostF : "—", x.full ? "neg" : "")}${tile("Retreats", fmt(x.ret))}${tile("Full losses", fmt(x.full))}</div>${msg}</div></section>`;
}
EXT.homeStats.push(pcSnapsHtml, pcLengthHtml, pcRetreatHtml);
EXT.styles.push(`.pcsvg { display: block; max-width: 420px; }
.pcsvg text { fill: currentColor; font-size: 12px; font-family: var(--ui); font-weight: 700; }
.pcsvg text.pcn { fill: var(--muted); font-weight: 600; }
.pcsvg rect.t6 { fill: var(--snap-a); } .pcsvg rect.t7 { fill: var(--snap-b); } .pcsvg rect.you { fill: var(--loss); } .pcsvg rect.them { fill: var(--win); } .pcsvg rect.short { fill: var(--muted); }`);

/* ---------- 5. The deck sheet's "Draws" tab: which cards win when you draw them (from PC matches) ---------- */
function pcDrawsHtml(d) {
  const ms = deckMatches(d).filter((m) => arr(m.drawn).length && ["W", "L", "T"].includes(m.result));
  if (ms.length < 5) return `<div class="empty"><strong>Fills in from your PC matches</strong><span>Play this deck on PC with the game's folder connected (Settings › Import & backup › Playing on PC). SNAP Stat sees which cards you drew, and after 5 games it shows which ones win when you draw them.${ms.length ? ` ${ms.length} of 5 games so far.` : ""}</span></div>`;
  const rows = arr(d.cards).filter((k) => !String(k).startsWith("custom:")).map((k) => {
    const dr = ms.filter((m) => m.drawn.includes(k)), nd = ms.filter((m) => !m.drawn.includes(k)), pl = ms.filter((m) => arr(m.played).includes(k));
    return { k, dr: dr.length, rate: pct(dr.length, ms.length), wrD: dr.length ? winPct(dr) : null, wrN: nd.length ? winPct(nd) : null, wrP: pl.length ? winPct(pl) : null, pl: pl.length, diff: dr.length >= 2 && nd.length >= 2 ? winPct(dr) - winPct(nd) : null };
  }).sort((a, b) => (b.diff === null ? -999 : b.diff) - (a.diff === null ? -999 : a.diff) || b.dr - a.dr);
  const cmp = rows.filter((r) => r.diff !== null), best = cmp[0] && cmp[0].diff > 0 ? cmp[0] : null, worst = cmp.length && cmp[cmp.length - 1].diff < 0 ? cmp[cmp.length - 1] : null;
  const p = (v) => (v === null ? "—" : v + "%");
  return `<div class="tiles"><div class="tile"><div class="k">PC games</div><div class="v">${ms.length}</div></div><div class="tile"><div class="k">Win rate</div><div class="v">${winPct(ms)}%</div></div></div>
    ${best ? `<p class="small"><b>Best to draw: ${esc(card(best.k).name)}.</b> You win ${best.wrD}% when you draw it and ${best.wrN}% when you don't.</p>` : ""}
    ${worst ? `<p class="small"><b>Wins least when drawn: ${esc(card(worst.k).name)}.</b> ${worst.wrD}% when drawn, ${worst.wrN}% when not. Think about a swap.</p>` : ""}
    <div class="tbl-wrap"><table class="pctbl"><thead><tr><th>Card</th><th class="n">Drawn</th><th class="n">Win % if drawn</th><th class="n">Win % if not</th><th class="n">Win % if played</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(card(r.k).name)}</td><td class="n">${r.rate}%</td><td class="n ${r.diff > 0 ? "pos" : r.diff < 0 ? "neg" : ""}">${p(r.wrD)}</td><td class="n">${p(r.wrN)}</td><td class="n">${p(r.wrP)}</td></tr>`).join("")}</tbody></table></div>
    <p class="muted small">From ${plural(ms.length, "PC game")} with this deck. A card is compared once it's been drawn in 2 games and missed in 2; with few games the numbers swing a lot.</p>`;
}
EXT.deckTabs.push(["draws", "Draws", pcDrawsHtml]);
// Tables that fit a phone: names and headers wrap instead of the table scrolling sideways. A sixth tab in a row gets a little smaller.
EXT.styles.push(`.pctbl th, .pctbl td { padding: 8px 7px; }
.pctbl th { white-space: normal; line-height: 1.15; letter-spacing: 0; font-size: 11px; vertical-align: bottom; }
.pctbl td:first-child { white-space: normal; }
.seg:has(> button:nth-child(6)) button { font-size: 11.5px; letter-spacing: 0; padding-inline: 1px; }`);
