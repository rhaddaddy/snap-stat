/* ============ y34_matches.js: match tracking extras (October 31, 2026) ============
   11 their deck from the first two cards · 12 a snap call score for each match · 13 retreats you'd probably have won ·
   14 location win rates for each deck · 15 a replay of a match's pictures · 16 "you've played them before" · 17 automatic
   match tags · 18 voice notes on matches · 19 a battery saver for the tracker · 20 a shareable card of today's session. */
EXT.settingsAndroid = arr(EXT.settingsAndroid);
const y34Board = (m) => { const l = arr(m && m.endBoard && m.endBoard.locations).length ? m.endBoard.locations : arr(m && m.locs); return l.filter(Boolean).slice(0, 3).map((x) => ({ name: String(x.name || ""), my: x.my == null ? null : num(x.my), opp: x.opp == null ? null : num(x.opp) })); };
const y34Known = (b) => b.length === 3 && b.every((l) => l.my !== null && l.opp !== null && (l.my || l.opp));
function y34Lanes(b) { const won = b.filter((l) => l.my > l.opp).length, lost = b.filter((l) => l.my < l.opp).length; const margin = b.reduce((s, l) => s + l.my - l.opp, 0); return { won, lost, margin, r: won > lost ? "W" : lost > won ? "L" : margin > 0 ? "W" : margin < 0 ? "L" : "T" }; }
const y34Res = (r) => (r === "W" ? "win" : r === "L" ? "loss" : "tie");

/* ---------- 11. Their deck, from the first two cards they play ---------- */
function oppGuess(names) {
  const keys = [...new Set(arr(names).map(keyOf).filter(Boolean))]; if (keys.length < 2) return null;
  const arch = archetypeOf(names), co = {}; let seen = 0;
  for (const m of realMatches()) {
    const oc = arr(m.oppCards).map(keyOf); if (!keys.every((k) => oc.includes(k))) continue;
    seen++; for (const k of new Set(oc)) if (!keys.includes(k)) co[k] = (co[k] || 0) + 1;
  }
  const likely = Object.entries(co).filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => ({ k, name: (cardByName(k) || card(k)).name || k, p: Math.round((n / Math.max(1, seen)) * 100) }));
  return { arch, seen, likely };
}
EXT.liveMatch.push(function y34OppGuess() {
  if (!live.on) return ""; const names = liveOppNames(live), g = oppGuess(names);
  if (!g) return `<div class="panel small y34-guess"><b>Their deck</b> <span class="muted">· shows after they reveal 2 cards</span></div>`;
  return `<div class="panel small stack y34-guess"><div class="row between"><b>Their deck${g.arch ? `: ${esc(g.arch)}` : ""}</b><span class="muted">${g.seen ? `from ${g.seen} game${g.seen === 1 ? "" : "s"} you've seen` : "a first guess"}</span></div>
    ${g.likely.length ? `<span class="muted">Likely still to come:</span><div class="chiplist">${g.likely.map((x) => `<span class="pill">${esc(x.name)} <span class="num muted">${x.p}%</span></span>`).join("")}</div>` : `<span class="muted">You haven't logged games against these cards together yet. Add opponents' cards to your matches to sharpen this.</span>`}</div>`;
});

/* ---------- 12. Snap call score ---------- */
// 0-100: how well the snap (or not snapping) matched how the game went. Uses the final board when there is one.
function snapCall(m) {
  if (!m || !m.result || m.noCubes) return null;
  const b = y34Board(m), known = y34Known(b), L = known ? y34Lanes(b) : null, cubes = Math.abs(num(m.cubes));
  if (m.snapped) {
    if (m.result === "W") return { score: cubes >= 8 ? 100 : 90, word: "Good snap", why: `It paid off: ${signed(num(m.cubes))} cubes.` };
    if (m.retreated) return { score: 55, word: "Snapped, then got out", why: "Retreating after a snap limited the loss. Snap a turn later next time if you're unsure." };
    return { score: L && L.won >= 1 ? 35 : 15, word: "Risky snap", why: L && L.won >= 1 ? "Close, but it cost double. Snapping later (turn 5 or 6) shows more of their plan." : "They won clearly. Snapping early against an unknown deck is risky." };
  }
  if (m.result === "W") {
    if (m.oppRetreated) return { score: 70, word: "Fine", why: "They ran before it got big. A snap might have scared them off sooner, or won more." };
    if (L && L.won === 3) return { score: 40, word: "Missed a snap", why: "You won all three locations: a snap would likely have doubled the cubes." };
    if (L && L.margin >= 10) return { score: 55, word: "Could have snapped", why: "You won by a lot. A late snap was probably safe." };
    return { score: 80, word: "Safe call", why: "A close win: not snapping kept it safe." };
  }
  if (m.retreated) return { score: 85, word: "Good retreat", why: `Getting out kept it to ${cubes} cube${cubes === 1 ? "" : "s"}.` };
  if (m.oppSnapped) return { score: 30, word: "Stayed after their snap", why: "They snapped and won. When you're behind after a snap, retreating usually costs less." };
  return { score: 70, word: "Fair", why: "A small loss without snapping." };
}
const y34ScoreCls = (s) => (s >= 75 ? "W" : s >= 50 ? "warn" : "L");
EXT.matchSheet.push(function y34SnapCall(mf) {
  if (!mf || mf.isNew) return ""; const c = snapCall(mf); if (!c) return "";
  return `<div class="panel small row nowrap y34-call"><span class="pill ${y34ScoreCls(c.score)} num">${c.score}</span><div class="grow"><b>${esc(c.word)}</b><div class="muted">${esc(c.why)}</div></div></div>`;
});

/* ---------- 13. Retreats you'd probably have won ---------- */
function retreatRegrets(ms) {
  return ms.filter((m) => m.retreated && m.result !== "W").map((m) => { const b = y34Board(m); if (!y34Known(b)) return null; const L = y34Lanes(b); return L.r === "W" ? { m, L } : null; }).filter(Boolean);
}
function regretHtml() {
  const ms = inPeriod(realMatches(), periodById(ui.period)), ret = ms.filter((m) => m.retreated), list = retreatRegrets(ms);
  if (!ret.length) return "";
  const known = ret.filter((m) => y34Known(y34Board(m))).length;
  return `<section class="sec"><div class="sec-h"><h2>Retreat regrets</h2><span class="muted small">${ret.length} retreat${ret.length === 1 ? "" : "s"}</span></div><div class="panel stack small">
    ${!known ? `<p class="muted">None of your retreats have the final board saved, so SNAP Stat can't tell yet. Track & play and the play-by-play save it.</p>` : list.length ? `<p>You were ahead on the board in <b>${list.length}</b> of ${known} retreat${known === 1 ? "" : "s"} it can check. Those might have been wins.</p>
      <div class="list">${list.slice(0, 6).map(({ m, L }) => `<button class="li" data-a="matchEdit" data-id="${esc(m.id)}"><div class="grow"><div class="t">${esc(m.deckName || "A deck")}${m.oppName ? ` vs ${esc(m.oppName)}` : ""}</div><div class="s">${esc(dayStr(m.ts))} · ahead in ${L.won} location${L.won === 1 ? "" : "s"} · lost ${Math.abs(num(m.cubes))} cube${Math.abs(num(m.cubes)) === 1 ? "" : "s"}</div></div><span class="muted">›</span></button>`).join("")}</div>
      <span class="muted">Board leads can still flip on the last turn, so these are "probably", not "surely".</span>` : `<p>Every retreat SNAP Stat can check (${known}) was behind on the board. Good reads.</p>`}</div></section>`;
}
EXT.homeStats.push(regretHtml);

/* ---------- 14. Location win rates for each deck ---------- */
function deckLocRows(ms) {
  const by = {};
  for (const m of ms) for (const l of y34Board(m)) { if (!l.name) continue; const k = keyOf(l.name), r = (by[k] = by[k] || { name: l.name, ms: [], lw: 0, ll: 0 }); r.ms.push(m); if (l.my !== null && l.opp !== null) { if (l.my > l.opp) r.lw++; else if (l.my < l.opp) r.ll++; } }
  return Object.values(by).map((r) => { const st = statsFor(r.ms); return { name: r.name, games: st.games, wr: st.wr, w: st.w, l: st.l, lwr: pct(r.lw, r.lw + r.ll) }; }).sort((a, b) => b.games - a.games || b.wr - a.wr);
}
function deckLocTable(rows, max = 40) {
  if (!rows.length) return `<div class="empty"><strong>No locations yet</strong><span>Matches with their locations saved (Track & play, screenshots, or the match form) fill this in.</span></div>`;
  return `<div class="tbl-wrap"><table><thead><tr><th>Location</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Won it</th></tr></thead><tbody>${rows.slice(0, max).map((r) => `<tr><td><button class="linkbtn" data-a="locOpen" data-name="${esc(r.name)}">${esc(r.name)}</button></td><td class="n num">${r.games}</td><td class="n num ${r.wr >= 55 ? "pos" : r.wr < 45 ? "neg" : ""}">${r.wr}%</td><td class="n num">${r.lwr}%</td></tr>`).join("")}</tbody></table></div>`;
}
EXT.deckTabs.push(["locs", "Locations", (d) => `<div class="stack small"><p class="muted">How this deck does at each location: games, win rate, and how often you won that location itself.</p>${deckLocTable(deckLocRows(deckMatches(d)))}</div>`]);
function locByDeckHtml() {
  const ms = inPeriod(realMatches(), periodById(ui.period)), decks = {};
  for (const m of ms) { const k = m.deckId || m.deckName; if (k) (decks[k] = decks[k] || { name: m.deckName || "A deck", ms: [] }).ms.push(m); }
  const top = Object.entries(decks).sort((a, b) => b[1].ms.length - a[1].ms.length).slice(0, 8);
  if (!top.length) return "";
  const pick = top.find(([k]) => k === ui.y34Deck) || top[0];
  return `<section class="sec"><h2>Locations by deck</h2><div class="panel stack small"><div class="chips">${top.map(([k, x]) => `<button class="chip" data-a="y34Deck" data-v="${esc(k)}" aria-pressed="${k === pick[0]}">${esc(x.name)}</button>`).join("")}</div>
    ${deckLocTable(deckLocRows(pick[1].ms), 12)}</div></section>`;
}
EXT.homeStats.push(locByDeckHtml);

/* ---------- 15. Replay: play a match's pictures like a short video ---------- */
const rp34 = { list: [], i: 0, on: false, t: 0, urls: [], title: "", loading: false };
function rp34Stop() { rp34.on = false; clearTimeout(rp34.t); }
function rp34Free() { rp34Stop(); rp34.urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* fine */ } }); rp34.urls = []; }
function replayVideoSheet() {
  if (rp34.loading) return `${sheetHead("Replay", esc(rp34.title))}<p class="muted">Loading the pictures…</p>`;
  if (!rp34.list.length) { rp34Free(); return `${sheetHead("Replay", esc(rp34.title))}<div class="empty"><strong>No pictures for this match</strong><span>Turn on "Save the board each turn" in Settings › Android, then play with Track & play. Pictures stay on this phone.</span></div><button class="btn snap block" data-a="close">Done</button>`; }
  const n = rp34.list.length, r = rp34.list[rp34.i];
  return `${sheetHead("Replay", esc(rp34.title))}
    <div class="y34-rp"><img src="${rp34.urls[rp34.i]}" alt="Picture ${rp34.i + 1} of ${n}"></div>
    <input type="range" min="0" max="${n - 1}" value="${rp34.i}" data-rp34="1" aria-label="Picture">
    <div class="row between"><span class="muted small">${rp34.i + 1} / ${n}${r.hint && /^turn:\d+/.test(r.hint) ? ` · turn ${esc(r.hint.slice(5))}` : ""}</span>
      <div class="row"><button class="btn sm" data-a="rp34Step" data-d="-1" aria-label="Back">‹</button><button class="btn sm snap" data-a="rp34Play">${rp34.on ? "❚❚ Pause" : "▶ Play"}</button><button class="btn sm" data-a="rp34Step" data-d="1" aria-label="Next">›</button></div></div>`;
}
function rp34Tick() { if (!rp34.on || sheetFn !== replayVideoSheet) { rp34.on = false; return; } if (rp34.i >= rp34.list.length - 1) { rp34.on = false; refreshSheet(); return; } rp34.i++; refreshSheet(); rp34.t = setTimeout(rp34Tick, 1300); }
async function replayVideoOpen(m) {
  rp34Free(); rp34.title = `${m.deckName || "Your deck"}${m.oppName ? " vs " + m.oppName : ""}`; rp34.loading = true; rp34.i = 0; rp34.list = []; openSheet(replayVideoSheet);
  try { const all = await shotLogAll(); rp34.list = arr(all).filter((r) => r && r.img && m.session && r.session === m.session).sort((a, b) => num(a.at) - num(b.at)); rp34.urls = rp34.list.map((r) => URL.createObjectURL(r.img)); }
  catch (e) { errNote("the replay", e); rp34.list = []; }
  rp34.loading = false; if (sheetFn === replayVideoSheet) refreshSheet();
}
EXT.matchSheet.push(function y34Replay(mf) { return mf && !mf.isNew && mf.session ? `<button class="btn sm ghost" data-a="rp34Open" data-id="${esc(mf.id)}">▶ Watch the replay</button>` : ""; });
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.rp34) return; rp34Stop(); rp34.i = clamp(num(t.value), 0, rp34.list.length - 1); refreshSheet(); });

/* ---------- 16. You've played them before ---------- */
function vsHistory(name, exceptId) {
  const k = String(name || "").trim().toLowerCase(); if (k.length < 2) return null;
  const ms = realMatches().filter((m) => m.id !== exceptId && String(m.oppName || "").trim().toLowerCase() === k).sort((a, b) => b.ts - a.ts);
  return ms.length ? { ms, st: statsFor(ms), last: ms[0] } : null;
}
EXT.liveMatch.push(function y34Again() {
  if (!live.on) return ""; const h = vsHistory(live.oppName); if (!h) return "";
  return `<div class="panel small y34-again"><b>You've played ${esc(live.oppName)} before</b><div>${h.st.w}-${h.st.l}${h.st.t ? "-" + h.st.t : ""} · ${signed(h.st.cubes)} cubes in ${h.st.games} game${h.st.games === 1 ? "" : "s"}</div>
    <div class="muted">Last time (${esc(dayStr(h.last.ts))}): ${y34Res(h.last.result)}${h.last.deckName ? ` with ${esc(h.last.deckName)}` : ""}${arr(h.last.oppCards).length ? ` · they played ${esc(arr(h.last.oppCards).slice(0, 4).join(", "))}` : ""}</div></div>`;
});
let _y34Seen = "";
EXT.afterRender.push(function y34AgainToast() { if (!live.on) { _y34Seen = ""; return; } const n = String(live.oppName || "").trim(); if (!n || n === _y34Seen) return; const h = vsHistory(n); if (h) { _y34Seen = n; toast(`Rematch! You're ${h.st.w}-${h.st.l} against ${n}`); } });
EXT.onMatch.push((m, isNew) => { if (!isNew || !m || m.example || m.svSync || !m.oppName) return; const h = vsHistory(m.oppName, m.id); if (h && h.st.games >= 1) setTimeout(() => toast(`${m.oppName} again: now ${h.st.w + (m.result === "W" ? 1 : 0)}-${h.st.l + (m.result === "L" ? 1 : 0)} against them`), 900); });

/* ---------- 17. Automatic match tags ---------- */
const AUTO_TAGS = [["comeback", "Comeback"], ["blowout", "Blowout"], ["close", "Close one"], ["snapran", "Snapped and ran"], ["eight", "8-cuber"], ["bluffcalled", "Called their bluff"]];
function autoTags(m) {
  if (!m) return []; const out = [], b = y34Board(m), known = y34Known(b), L = known ? y34Lanes(b) : null;
  if (Math.abs(num(m.cubes)) >= 8 && m.result === "W") out.push("eight");
  if (m.snapped && m.retreated) out.push("snapran");
  if (m.oppSnapped && m.result === "W" && !m.oppRetreated) out.push("bluffcalled");
  if (L && !m.retreated && !m.oppRetreated) { if (L.won === 3 || L.lost === 3 || Math.abs(L.margin) >= 25) out.push("blowout"); else if (L.won === L.lost || b.some((l) => Math.abs(l.my - l.opp) <= 2 && l.my !== l.opp)) out.push("close"); }
  // Behind in two locations after turn 4 (from the play-by-play), then won
  const ts = arr(m.turns); if (m.result === "W" && ts.some((t) => num(t.n) >= 4 && num(t.n) < 6 && arr(t.power).filter((p) => p && p.my != null && p.opp != null && num(p.my) < num(p.opp)).length >= 2)) out.push("comeback");
  return out;
}
const autoTagName = (k) => (AUTO_TAGS.find(([x]) => x === k) || [k, k])[1];
EXT.matchSheet.push(function y34AutoTags(mf) { if (!mf || mf.isNew) return ""; const t = autoTags(mf); return t.length ? `<div class="chiplist y34-auto"><span class="muted small">Spotted:</span>${t.map((k) => `<span class="pill gold">${esc(autoTagName(k))}</span>`).join("")}</div>` : ""; });
function autoTagsHtml() {
  const ms = inPeriod(realMatches(), periodById(ui.period)), rows = AUTO_TAGS.map(([k, l]) => ({ k, l, ms: ms.filter((m) => autoTags(m).includes(k)) })).filter((r) => r.ms.length);
  if (!rows.length) return "";
  return `<section class="sec"><h2>Spotted in your games</h2><div class="list">${rows.map((r) => { const st = statsFor(r.ms); return `<button class="li" data-a="y34Tag" data-v="${r.k}"><div class="grow"><div class="t">${esc(r.l)}</div><div class="s">${st.games} game${st.games === 1 ? "" : "s"} · ${st.wr}% wins · ${signed(st.cubes)} cubes</div></div><span class="muted">›</span></button>`; }).join("")}</div><p class="muted small">Tagged by themselves from the result and the final board. Tap one to see those games.</p></section>`;
}
EXT.homeStats.push(autoTagsHtml);
let y34TagPick = "";
function y34TagSheet() {
  const ms = inPeriod(realMatches(), periodById(ui.period)).filter((m) => autoTags(m).includes(y34TagPick)).sort((a, b) => b.ts - a.ts);
  return `${sheetHead(esc(autoTagName(y34TagPick)), `${ms.length} game${ms.length === 1 ? "" : "s"}`)}<div class="list">${ms.slice(0, 60).map((m) => `<button class="li" data-a="matchEdit" data-id="${esc(m.id)}"><div class="grow"><div class="t">${m.result === "W" ? "Win" : m.result === "L" ? "Loss" : "Tie"} ${signed(num(m.cubes))} · ${esc(m.deckName || "No deck")}</div><div class="s">${esc(dayStr(m.ts))}${m.oppName ? ` · vs ${esc(m.oppName)}` : ""}</div></div><span class="muted">›</span></button>`).join("")}</div>`;
}

/* ---------- 18. Voice notes on matches (hold to record, up to 10 seconds) ---------- */
const VN_DB = "snapstat-voice";
function vnDb() { return new Promise((res, rej) => { try { const r = indexedDB.open(VN_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore("notes", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
async function vnDo(mode, fn) { const db = await vnDb(); return new Promise((res, rej) => { const t = db.transaction("notes", mode), st = t.objectStore("notes"); const q = fn(st); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); }
const vn = { rec: null, chunks: [], id: "", start: 0, timer: 0, urls: {} };
const vnCan = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
async function vnStart(id) {
  if (vn.rec || !vnCan()) { if (!vnCan()) toast("This phone or browser can't record voice notes"); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast(NATIVE ? "The Android app can't use the microphone yet. Use the website to record notes." : "Allow the microphone to record a note"); return; }
  vn.chunks = []; vn.id = id; vn.start = Date.now();
  try { vn.rec = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach((t) => t.stop()); errNote("voice notes", e); return; }
  vn.rec.ondataavailable = (e) => { if (e.data && e.data.size) vn.chunks.push(e.data); };
  vn.rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop()); const dur = Math.round((Date.now() - vn.start) / 100) / 10, rec = vn.rec; vn.rec = null; clearTimeout(vn.timer);
    if (dur < 0.6) { toast("Hold the button while you talk"); refreshSheet(); return; }
    const blob = new Blob(vn.chunks, { type: (rec && rec.mimeType) || "audio/webm" });
    try { await vnDo("readwrite", (st) => st.put({ id: vn.id, blob, at: Date.now(), dur })); S.voiceIdx = { ...obj(S.voiceIdx), [vn.id]: dur }; const ks = Object.keys(S.voiceIdx); if (ks.length > 300) delete S.voiceIdx[ks[0]]; save(); toast("Voice note saved"); }
    catch (e) { errNote("saving the voice note", e); }
    if (vn.urls[vn.id]) { URL.revokeObjectURL(vn.urls[vn.id]); delete vn.urls[vn.id]; } refreshSheet();
  };
  vn.rec.start(); vn.timer = setTimeout(vnStop, 10000); const b = document.querySelector("[data-vnrec]"); if (b) { b.classList.add("rec"); b.textContent = "● Recording… let go to stop"; }
}
function vnStop() { if (vn.rec && vn.rec.state !== "inactive") { try { vn.rec.stop(); } catch { vn.rec = null; } } }
document.addEventListener("pointerdown", (e) => { const b = e.target && e.target.closest ? e.target.closest("[data-vnrec]") : null; if (!b) return; e.preventDefault(); vnStart(b.dataset.vnrec); });
for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, () => { if (vn.rec) vnStop(); });
EXT.matchSheet.push(function y34Voice(mf) {
  if (!mf || mf.isNew || !mf.id) return ""; const has = obj(S.voiceIdx)[mf.id];
  if (!vnCan() && !has) return "";
  return `<div class="panel small stack y34-vn"><b>Voice note</b>${has ? `<div data-vnplay="${esc(mf.id)}" class="muted">Loading…</div><div class="row"><button class="btn sm ghost danger" data-a="vnDel" data-id="${esc(mf.id)}">Delete note</button></div>` : ""}
    ${vnCan() ? `<button class="btn ${has ? "ghost" : ""} y34-vnrec" data-vnrec="${esc(mf.id)}">🎙 Hold to ${has ? "record again" : "record"} (10 s)</button>` : ""}<span class="muted">Kept on this phone only.</span></div>`;
});
EXT.afterRender.push(function y34VoiceFill() {
  document.querySelectorAll("[data-vnplay]").forEach(async (el) => {
    const id = el.dataset.vnplay; if (el.dataset.done) return; el.dataset.done = "1";
    try { let u = vn.urls[id]; if (!u) { const r = await vnDo("readonly", (st) => st.get(id)); if (!r || !r.blob) { el.textContent = "The note isn't on this phone."; return; } u = vn.urls[id] = URL.createObjectURL(r.blob); }
      el.innerHTML = `<audio controls preload="metadata" src="${u}"></audio>`; } catch { el.textContent = "Couldn't load the note."; }
  });
});

/* ---------- 19. Battery saver for the tracker ---------- */
const bat = { level: -1, charging: true, ok: false };
async function batWatch() {
  if (!navigator.getBattery) return; try { const b = await navigator.getBattery(); const upd = () => { bat.level = Math.round(b.level * 100); bat.charging = !!b.charging; bat.ok = true; batApply(); }; upd(); b.addEventListener("levelchange", upd); b.addEventListener("chargingchange", upd); } catch { /* not supported */ }
}
const batPct = () => clamp(num(S.batPct, 15), 5, 50);
const batOn = () => S.batSaver !== false;
function batApply() { if (natCan("setBatterySaver")) { try { NATIVE.setBatterySaver(batOn(), batPct()); } catch { /* old app */ } } }
const batLow = () => bat.ok && !bat.charging && bat.level >= 0 && bat.level < batPct();
batWatch();
EXT.settingsAndroid.push(function y34Battery() {
  return `<div class="panel stack small"><div class="row between"><b>Battery saver</b>${batOn() && batLow() ? `<span class="pill warn">Paused: ${bat.level}%</span>` : ""}</div>
    <label class="check"><input type="checkbox" data-y34bat="on" ${batOn() ? "checked" : ""}> Pause the match tracker when the battery is low and not charging</label>
    <label class="f">Pause under<select data-y34bat="pct">${[10, 15, 20, 25, 30].map((v) => `<option value="${v}" ${batPct() === v ? "selected" : ""}>${v}%</option>`).join("")}</select></label>
    <span class="muted">${natCan("setBatterySaver") ? "The tracker skips reading the screen until you plug in or the battery is back above it." : "Update the Android app (1.23) for the tracker to pause by itself."}${bat.ok ? ` Battery now: ${bat.level}%${bat.charging ? ", charging" : ""}.` : ""}</span></div>`;
});
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y34bat) return; if (t.dataset.y34bat === "on") S.batSaver = !!t.checked; else S.batPct = clamp(num(t.value, 15), 5, 50); save(); batApply(); render(); });
if (NATIVE) setTimeout(batApply, 3000);

/* ---------- 20. Today's session as a picture ---------- */
// This session: today's games, back to the last break of 45 minutes or more
function sessionNow() {
  const ms = realMatches().filter((m) => localDate(m.ts) === localDate(Date.now())).sort((a, b) => b.ts - a.ts); if (!ms.length) return null;
  const out = [ms[0]]; for (let i = 1; i < ms.length; i++) { if (out[out.length - 1].ts - ms[i].ts > 45 * 60e3) break; out.push(ms[i]); }
  const st = statsFor(out), by = {}; out.forEach((m) => { const k = m.deckName || ""; if (k) (by[k] = by[k] || []).push(m); });
  const best = Object.entries(by).map(([n, l]) => ({ n, st: statsFor(l) })).sort((a, b) => b.st.cubes - a.st.cubes)[0] || null;
  const big = [...out].sort((a, b) => num(b.cubes) - num(a.cubes))[0];
  return { ms: out, st, best, big: big && num(big.cubes) > 0 ? big : null, from: out[out.length - 1].ts, to: out[0].ts };
}
async function sessionBlob() {
  const x = sessionNow(); const W = 1080, H = 1080, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  picBackdrop(g, W, H); g.textAlign = "left"; g.fillStyle = "#FFD23F"; g.font = "italic 800 72px system-ui, sans-serif"; picText(g, "Today's session", 60, 130, 960);
  g.fillStyle = "#C9C3EE"; g.font = "600 30px system-ui"; picText(g, `${S.me.handle ? S.me.handle + " · " : ""}${new Date(x.from).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${new Date(x.to).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, 62, 184, 960);
  const tile = (i, big, small) => { const x0 = 60 + (i % 2) * 490, y0 = 250 + Math.floor(i / 2) * 330; g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x0, y0, 470, 300); g.fillStyle = "#fff"; g.font = "800 84px system-ui"; picText(g, big, x0 + 30, y0 + 140, 420); g.fillStyle = "#C9C3EE"; g.font = "600 30px system-ui"; picText(g, small, x0 + 32, y0 + 200, 420); };
  tile(0, `${x.st.w}-${x.st.l}${x.st.t ? "-" + x.st.t : ""}`, `${x.st.games} game${x.st.games === 1 ? "" : "s"} · ${x.st.wr}% wins`); tile(1, signed(x.st.cubes), "cubes");
  tile(2, x.best ? x.best.n : "—", x.best ? `best deck · ${signed(x.best.st.cubes)}` : "best deck"); tile(3, x.big ? signed(num(x.big.cubes)) : "—", x.big ? `biggest win${x.big.oppName ? " vs " + x.big.oppName : ""}` : "biggest win");
  picFooter(g, W, H); return canvasBlob(cv);
}
function sessionCardHtml() {
  const x = sessionNow(); if (!x || x.st.games < 2) return "";
  return `<section class="sec"><div class="panel row nowrap y34-sess"><div class="grow"><b>This session</b><div class="small muted">${x.st.w}-${x.st.l}${x.st.t ? "-" + x.st.t : ""} · ${signed(x.st.cubes)} cubes${x.best ? ` · best: ${esc(x.best.n)}` : ""}</div></div><button class="btn sm" data-a="sessShare">Share</button></div></section>`;
}
sessionCardHtml.ext = { id: "session", label: "This session", sub: "Today's games since your last break, to share" };
EXT.homeTop.push(sessionCardHtml);

/* ---------- Taps ---------- */
Object.assign(A, {
  y34Deck: (el) => { ui.y34Deck = el.dataset.v; render(); },
  y34Tag: (el) => { y34TagPick = el.dataset.v; openSheet(y34TagSheet); },
  rp34Open: (el) => { const m = findMatchById(el.dataset.id); if (m) replayVideoOpen(m); },
  rp34Play: () => { if (rp34.on) { rp34Stop(); refreshSheet(); return; } if (rp34.i >= rp34.list.length - 1) rp34.i = 0; rp34.on = true; refreshSheet(); rp34.t = setTimeout(rp34Tick, 900); },
  rp34Step: (el) => { rp34Stop(); rp34.i = clamp(rp34.i + num(el.dataset.d), 0, rp34.list.length - 1); refreshSheet(); },
  vnDel: async (el) => { const id = el.dataset.id; try { await vnDo("readwrite", (st) => st.delete(id)); } catch { /* gone already */ } const x = obj(S.voiceIdx); delete x[id]; S.voiceIdx = x; save(); if (vn.urls[id]) { URL.revokeObjectURL(vn.urls[id]); delete vn.urls[id]; } refreshSheet(); toast("Voice note deleted"); },
  sessShare: () => makePic({ kind: "session", title: "Today's session", sub: "Your games since your last break", file: `snap-stat-session-${localDate(Date.now())}.png`, shareTitle: "My MARVEL SNAP session", make: () => sessionBlob() }),
});
EXT.styles.push(`
.y34-guess .chiplist { gap: 4px; } .y34-again { border-color: color-mix(in srgb, var(--snap-a) 50%, var(--line)); }
.y34-call { gap: 10px; align-items: center; } .y34-call .pill { min-width: 44px; justify-content: center; font-size: 16px; }
.y34-rp { border-radius: 12px; overflow: hidden; background: #000; display: grid; place-items: center; max-height: 60vh; } .y34-rp img { max-width: 100%; max-height: 60vh; object-fit: contain; display: block; }
.y34-vnrec { touch-action: none; user-select: none; -webkit-user-select: none; min-height: 48px; } .y34-vnrec.rec { background: color-mix(in srgb, var(--loss) 30%, var(--surface)); }
.y34-vn audio { width: 100%; } .y34-auto { align-items: center; } .y34-sess { gap: 10px; align-items: center; }`);
