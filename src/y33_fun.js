/* ============ y33_fun.js: fun and extras (October 31, 2026) ============
   91 daily trivia · 92 card of the day · 93 more achievements · 94 stream overlay styles · 95 seasonal looks · 96 sounds
   (off by default) · 97 a quiz on new cards · 98 the "what if" board · 99 photo mode for decks · 100 Year in SNAP.
   Words and lists live in y33a_data.js. */

/* ---------- Shared: a seeded shuffle, so the same day always gives the same questions ---------- */
function y33Seed(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; }
function y33Shuffle(list, rnd) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const y33Day = () => (typeof gameDay === "function" ? gameDay(Date.now()) : localDate(Date.now()));
const y33Num = (v) => v !== "?" && v !== "" && v != null && Number.isFinite(Number(v));
// Released cards with real numbers and words, for questions
function y33Pool() { return allCards().filter((c) => !c.upcoming && !c.custom && !c.unknownName && y33Num(c.cost) && y33Num(c.power) && c.name); }
// A card's ability with its own name hidden
const y33Hide = (c) => String(c.ability || "").replace(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "this card").replace(/<[^>]+>/g, "");

/* ---------- 91. Daily trivia ---------- */
function triviaToday() {
  const day = y33Day(), rnd = y33Seed("trivia" + day), pool = y33Pool(), qs = [];
  // One about the game's history and rules, then two made from the card list (so it never runs out)
  const f = TRIVIA_FACTS[Math.floor(rnd() * TRIVIA_FACTS.length)]; qs.push({ q: f[0], a: f[1], opts: y33Shuffle([f[1], ...f[2]], rnd) });
  const withText = pool.filter((c) => y33Hide(c).length > 20 && y33Hide(c).length < 160);
  for (let n = 0; n < 2 && pool.length > 8; n++) {
    const kind = Math.floor(rnd() * 3), c = (kind === 2 && withText.length > 8 ? withText : pool)[Math.floor(rnd() * (kind === 2 && withText.length > 8 ? withText : pool).length)];
    if (kind === 0) { const a = String(c.cost); const wrong = y33Shuffle(["0", "1", "2", "3", "4", "5", "6"].filter((x) => x !== a), rnd).slice(0, 3); qs.push({ q: `How much energy does ${c.name} cost?`, a, opts: y33Shuffle([a, ...wrong], rnd), k: c.key }); }
    else if (kind === 1) { const a = String(c.power); const pw = num(c.power); const wrong = y33Shuffle([pw - 2, pw - 1, pw + 1, pw + 2, pw + 3].filter((x) => x >= -2 && String(x) !== a).map(String), rnd).slice(0, 3); qs.push({ q: `What's ${c.name}'s Power?`, a, opts: y33Shuffle([a, ...wrong], rnd), k: c.key }); }
    else { const others = y33Shuffle(pool.filter((x) => x.key !== c.key), rnd).slice(0, 3).map((x) => x.name); qs.push({ q: `Which card says: “${y33Hide(c)}”`, a: c.name, opts: y33Shuffle([c.name, ...others], rnd), k: c.key }); }
  }
  return { day, qs };
}
function triviaHtml() {
  if (!flagOn("trivia")) return "";
  const t = triviaToday(), T = obj(S.trivia), mine = obj(T.days)[t.day] || {};
  const right = t.qs.filter((q, i) => mine[i] === q.a).length, done = Object.keys(mine).length >= t.qs.length;
  return `<section class="sec"><div class="sec-h"><h2>Daily trivia</h2><span class="muted small">${num(T.streak) ? `🔥 ${num(T.streak)} day${num(T.streak) > 1 ? "s" : ""} · ` : ""}${num(T.right)} right so far</span></div><div class="panel stack small">
    ${t.qs.map((q, i) => { const pick = mine[i]; return `<div class="y33-q"><b>${esc(q.q)}</b><div class="y33-opts">${q.opts.map((o) => `<button class="chip" data-a="triviaPick" data-i="${i}" data-v="${esc(o)}" ${pick !== undefined ? "disabled" : ""} aria-pressed="${pick === o}" ${pick !== undefined && o === q.a ? 'data-right="1"' : pick === o ? 'data-wrong="1"' : ""}>${esc(o)}</button>`).join("")}</div>${pick !== undefined ? `<span class="${pick === q.a ? "pos" : "neg"}">${pick === q.a ? "Right!" : `Not quite: it's ${esc(q.a)}.`}</span>` : ""}</div>`; }).join("")}
    <span class="muted">${done ? `You got ${right} of ${t.qs.length} today. New questions after the daily reset.` : "Three new questions every day, at the daily reset."}</span></div></section>`;
}
triviaHtml.ext = { id: "trivia", label: "Daily trivia", sub: "Three questions about MARVEL SNAP each day" };
EXT.homeTop.push(triviaHtml);

/* ---------- 92. Card of the day ---------- */
function cardOfDay() { const pool = y33Pool().filter((c) => c.ability); if (!pool.length) return null; const rnd = y33Seed("cotd" + y33Day()); return pool[Math.floor(rnd() * pool.length)]; }
function cotdHtml() {
  if (!flagOn("trivia")) return "";
  const c = cardOfDay(); if (!c) return "";
  const decks = S.decks.filter((d) => arr(d.cards).includes(c.key)).map((d) => ({ d, st: statsFor(deckMatches(d)) })).sort((a, b) => b.st.wr - a.st.wr || b.st.games - a.st.games);
  const ms = realMatches().filter((m) => { const d = S.decks.find((x) => x.id === m.deckId); return d && arr(d.cards).includes(c.key); }), st = statsFor(ms);
  const faced = realMatches().filter((m) => arr(m.oppCards).some((n) => keyOf(n) === c.key)), fs = statsFor(faced);
  return `<section class="sec"><div class="sec-h"><h2>Card of the day</h2><span class="muted small">${esc(c.series ? "Series " + c.series : "")}</span></div><div class="panel y33-cotd">
    <div class="y33-cotd-face">${cardFace(c)}</div>
    <div class="stack small"><b class="y33-cotd-name">${esc(c.name)}</b><span class="muted">${esc(c.cost)} energy · ${esc(c.power)} Power</span><p>${esc(String(c.ability || "").replace(/<[^>]+>/g, ""))}</p>
      ${c.flavor ? `<p class="muted"><i>${esc(c.flavor)}</i></p>` : ""}
      <span>${st.games ? `With it: <b>${st.w}-${st.l}</b> (${st.wr}%) · ${signed(st.cubes)} cubes` : S.owned[c.key] ? "You own it but haven't logged a game with it yet." : "You don't own it yet."}</span>
      ${fs.games ? `<span class="muted">Against it: ${fs.w}-${fs.l} (${fs.wr}%)</span>` : ""}
      ${decks.length ? `<span class="muted">Your best deck with it: <button class="linkbtn" data-a="deckOpen" data-id="${esc(decks[0].d.id)}">${esc(decks[0].d.name)}</button>${decks[0].st.games ? ` (${decks[0].st.wr}%)` : ""}</span>` : `<button class="btn sm ghost" data-a="buildAround" data-k="${esc(c.key)}">Build around it</button>`}</div></div></section>`;
}
cotdHtml.ext = { id: "cotd", label: "Card of the day", sub: "One card each day, with your numbers" };
EXT.homeTop.push(cotdHtml);

/* ---------- 93. More achievements (app-only fun ones, added to the existing list) ---------- */
function y33Ctx() {
  const ms = realMatches(), locs = new Set(), days = new Set(); let notes = 0, night = 0, early = 0, snapW = 0, cubesWon = 0;
  for (const m of ms) { arr(m.locs).forEach((l) => l && l.name && locs.add(keyOf(l.name))); days.add(localDate(m.ts)); if (String(m.notes || "").trim()) notes++; const h = new Date(m.ts).getHours(); if (h < 4) night++; if (h >= 5 && h < 8) early++; if (m.snapped && m.result === "W") snapW++; if (num(m.cubes) > 0) cubesWon += num(m.cubes); }
  const first = ms.reduce((a, m) => Math.min(a, m.ts), Infinity);
  return { locs: locs.size, days: days.size, notes, night, early, snapW, cubesWon, years: Number.isFinite(first) ? Math.floor((Date.now() - first) / (365 * DAY)) : 0, decks: S.decks.filter((d) => !d.example).length, trivia: num(obj(S.trivia).right), quiz: num(obj(S.quiz).right) };
}
let _y33c = null, _y33cv = -1;
const y33C = () => { if (_y33cv !== _mVer + saveVer) { _y33c = y33Ctx(); _y33cv = _mVer + saveVer; } return _y33c; };
if (typeof BADGES !== "undefined") BADGES.push(
  { id: "locs50", name: "Globetrotter", d: "Play at 50 different locations", v: () => y33C().locs, goal: 50 }, { id: "locs100", name: "World tour", d: "Play at 100 different locations", v: () => y33C().locs, goal: 100 },
  { id: "days30", name: "Devoted", d: "Log matches on 30 different days", v: () => y33C().days, goal: 30 }, { id: "notes10", name: "Note taker", d: "Write notes on 10 matches", v: () => y33C().notes, goal: 10 },
  { id: "night", name: "Night owl", d: "Play a match between midnight and 4 AM", v: () => y33C().night, goal: 1 }, { id: "early", name: "Early bird", d: "Play a match between 5 and 8 AM", v: () => y33C().early, goal: 1 },
  { id: "snapw25", name: "Snap master", d: "Win 25 games you snapped", v: () => y33C().snapW, goal: 25 }, { id: "cubes500", name: "Cube hoarder", d: "Win 500 cubes in total", v: () => y33C().cubesWon, goal: 500 },
  { id: "decks15", name: "Architect", d: "Build 15 decks", v: () => y33C().decks, goal: 15 }, { id: "trivia25", name: "Know-it-all", d: "Answer 25 trivia questions right", v: () => y33C().trivia, goal: 25 },
  { id: "quiz10", name: "Ahead of the curve", d: "Get 10 new-card quiz questions right", v: () => y33C().quiz, goal: 10 }, { id: "year1", name: "One year in", d: "Track matches for a whole year", v: () => y33C().years, goal: 1 },
);

/* ---------- 94. Stream overlay styles ---------- */
function ovLook() { const o = obj(S.ovLook); const t = (typeof LOOKS === "object" && LOOKS[obj(S.look).accent]) || { a: "#FFD23F", b: "#FF7A1A" }; const hex = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : ""); return { style: OV_STYLES.some(([k]) => k === o.style) ? o.style : "app", size: OV_SIZES.some(([k]) => k === o.size) ? o.size : "normal", a: hex(t.a), b: hex(t.b) }; }
if (typeof overlayData === "function") { const _od = overlayData; overlayData = function () { return { ..._od(), look: ovLook() }; }; } // eslint-disable-line no-func-assign
if (typeof overlayHtml === "function") {
  const _oh = overlayHtml;
  overlayHtml = function (d, err) { // eslint-disable-line no-func-assign
    try { extStyles(); } catch { /* fine */ }
    const L = obj(d && d.look), st = ["app", "accent", "glass", "mono"].includes(L.style) ? L.style : "app", sz = ["compact", "normal", "big"].includes(L.size) ? L.size : "normal";
    const hex = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : "");
    return `<div class="ovt ovt-${st} ovt-${sz}" style="${hex(L.a) ? `--ova:${hex(L.a)};` : ""}${hex(L.b) ? `--ovb:${hex(L.b)};` : ""}">${_oh(d, err)}</div>`;
  };
}
if (typeof overlayPanel === "function") {
  const _op = overlayPanel;
  overlayPanel = function () { // eslint-disable-line no-func-assign
    const h = _op(); if (!h || !S.overlay) return h; const L = ovLook();
    return h + `<section class="sec"><h2>Overlay style</h2><div class="panel stack small">
      <div class="chips">${OV_STYLES.map(([k, l]) => `<button class="chip" data-a="ovLookSet" data-f="style" data-v="${k}" aria-pressed="${L.style === k}">${esc(l)}</button>`).join("")}</div>
      <div class="seg" role="group" aria-label="Overlay size">${OV_SIZES.map(([k, l]) => `<button data-a="ovLookSet" data-f="size" data-v="${k}" aria-pressed="${L.size === k}">${esc(l)}</button>`).join("")}</div>
      <div class="ovt ovt-${L.style} ovt-${L.size} y33-ovprev" style="--ova:${esc(L.a)};--ovb:${esc(L.b)}"><div class="ov-card"><div class="ov-row"><b>${esc(S.me.handle || "You")}</b><span class="ov-pill">Rank ${esc(S.me.rank || "70")}</span></div><div class="ov-row"><span>Today</span><b>5-2</b><b class="pos">+9 cubes</b></div></div></div>
      <span class="muted">"My accent" uses the colour you picked in Settings › App. Changes reach OBS within a few seconds.</span></div></section>`;
  };
}

/* ---------- 95. Seasonal looks ---------- */
function seasonalNow(d = new Date()) {
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return SEASONAL.find(([, , a, b]) => (a <= b ? md >= a && md <= b : md >= a || md <= b)) || null;
}
function seasonalApply() {
  const s = S.seasonalOff || !flagOn("seasonalTheme") ? null : seasonalNow(), want = s ? "seasonal-" + s[0] : "";
  const cur = [...document.body.classList].find((c) => c.startsWith("seasonal-")) || "";
  if (cur !== want) { if (cur) document.body.classList.remove(cur); if (want) document.body.classList.add(want); }
  const b = document.querySelector(".brand"); if (b) { b.dataset.season = s ? s[4] : ""; }
}
EXT.afterRender.push(seasonalApply);

/* ---------- 96. Sounds (off by default) ---------- */
let _sfxCtx = null;
function sfx(kind) {
  if (!S.sfx || !SFX_NOTES[kind]) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    _sfxCtx = _sfxCtx || new AC(); if (_sfxCtx.state === "suspended") _sfxCtx.resume();
    const vol = clamp(num(S.sfxVol, 0.5), 0.05, 1) * 0.18, t0 = _sfxCtx.currentTime + 0.01;
    for (const [f, at, len] of SFX_NOTES[kind]) {
      const o = _sfxCtx.createOscillator(), g = _sfxCtx.createGain(); o.type = kind === "loss" ? "triangle" : "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g); g.connect(_sfxCtx.destination); o.start(t0 + at); o.stop(t0 + at + len + 0.02);
    }
  } catch { /* no sound on this device */ }
}
EXT.onMatch.push((m, isNew) => { if (isNew && m && !m.example && !m.svSync) sfx(m.result === "W" ? "win" : m.result === "L" ? "loss" : "tap"); });
document.addEventListener("click", (e) => {
  if (!S.sfx) return; const el = e.target && e.target.closest ? e.target.closest("[data-a]") : null; if (!el) return;
  const a = el.dataset.a || ""; if (/^(sfxTest)$/.test(a)) return;
  if (/snap/i.test(a) && /live|snap(?!shot)/i.test(a) && !/Snapvault|snapFan|svOpen/i.test(a)) sfx("snap"); else if (S.sfxTaps) sfx("tap");
}, true);
EXT.settingsApp.push(function y33Settings() {
  const s = seasonalNow();
  return `<section class="sec"><h2>Sounds and seasons</h2><div class="panel stack small">
    <label class="check"><input type="checkbox" data-y33="sfx" ${S.sfx ? "checked" : ""}> Play sounds (a win, a loss, a snap)</label>
    ${S.sfx ? `<label class="check"><input type="checkbox" data-y33="sfxTaps" ${S.sfxTaps ? "checked" : ""}> Also a soft click on every button</label>
      <label class="f">Volume<input type="range" min="0.1" max="1" step="0.1" value="${esc(clamp(num(S.sfxVol, 0.5), 0.1, 1))}" data-y33="sfxVol"></label>
      <div class="row"><button class="btn sm" data-a="sfxTest" data-v="win">▶ Win</button><button class="btn sm" data-a="sfxTest" data-v="loss">▶ Loss</button><button class="btn sm" data-a="sfxTest" data-v="snap">▶ Snap</button></div>` : ""}
    <label class="check"><input type="checkbox" data-y33="seasonal" ${S.seasonalOff ? "" : "checked"}> Seasonal looks (Halloween, holidays…) ${s ? `<span class="pill gold">${esc(s[4])} ${esc(s[1])} now</span>` : ""}</label>
    <span class="muted">Sounds are made on your phone, so they use no data. Seasonal looks switch on and off by themselves.</span></div></section>`;
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.y33) return; const k = t.dataset.y33;
  if (k === "sfx") { S.sfx = !!t.checked; if (S.sfx) setTimeout(() => sfx("snap"), 50); }
  else if (k === "sfxTaps") S.sfxTaps = !!t.checked;
  else if (k === "sfxVol") { S.sfxVol = clamp(num(t.value, 0.5), 0.1, 1); sfx("tap"); }
  else if (k === "seasonal") S.seasonalOff = !t.checked;
  save(); render();
});

/* ---------- 97. Quiz on new cards ---------- */
const quiz = { i: 0, pick: null, set: [] };
function quizCards() {
  const all = allCards().filter((c) => !c.custom && !c.unknownName && y33Num(c.cost) && y33Num(c.power) && c.ability);
  const soon = all.filter((c) => c.upcoming);
  const recent = all.filter((c) => !c.upcoming && c.release && Date.now() - new Date(c.release + "T12:00").getTime() < 120 * DAY);
  return { list: soon.length >= 3 ? soon : [...soon, ...recent], soon: soon.length };
}
function quizMake() {
  const { list } = quizCards(), rnd = y33Seed("quiz" + Date.now()), pool = y33Pool(), out = [];
  for (const c of y33Shuffle(list, rnd).slice(0, 8)) {
    const k = Math.floor(rnd() * 3);
    if (k === 0) { const a = String(c.cost); out.push({ k: c.key, q: `${c.name} costs how much?`, a, opts: y33Shuffle([a, ...y33Shuffle(["1", "2", "3", "4", "5", "6"].filter((x) => x !== a), rnd).slice(0, 3)], rnd) }); }
    else if (k === 1) { const a = String(c.power), p = num(c.power); out.push({ k: c.key, q: `${c.name} has how much Power?`, a, opts: y33Shuffle([a, ...y33Shuffle([p - 2, p - 1, p + 1, p + 2, p + 3].filter((x) => x >= 0 && String(x) !== a).map(String), rnd).slice(0, 3)], rnd) }); }
    else out.push({ k: c.key, q: `Which new card does this: “${y33Hide(c)}”`, a: c.name, opts: y33Shuffle([c.name, ...y33Shuffle([...list, ...pool].filter((x) => x.key !== c.key), rnd).slice(0, 3).map((x) => x.name)], rnd) });
  }
  return out;
}
function quizSheet() {
  const q = quiz.set[quiz.i];
  if (!q) return `${sheetHead("New card quiz")}<div class="empty"><strong>No new cards to learn right now</strong><span>When the card data lists cards that are coming soon (or came out in the last few months), they show up here.</span></div><button class="btn snap block" data-a="close">Done</button>`;
  const c = card(q.k), done = quiz.pick !== null;
  return `${sheetHead("New card quiz", `Question ${quiz.i + 1} of ${quiz.set.length} · ${num(obj(S.quiz).right)} right so far`)}
    <div class="stack"><b>${esc(q.q)}</b><div class="y33-opts">${q.opts.map((o) => `<button class="chip" data-a="quizPick" data-v="${esc(o)}" ${done ? "disabled" : ""} ${done && o === q.a ? 'data-right="1"' : done && o === quiz.pick ? 'data-wrong="1"' : ""}>${esc(o)}</button>`).join("")}</div>
    ${done ? `<div class="panel row nowrap y33-reveal">${cardFace(c, { small: true })}<div class="stack small"><b class="${quiz.pick === q.a ? "pos" : "neg"}">${quiz.pick === q.a ? "Right!" : "Not quite."}</b><span><b>${esc(c.name)}</b> · ${esc(c.cost)} energy · ${esc(c.power)} Power</span><span class="muted">${esc(String(c.ability).replace(/<[^>]+>/g, ""))}</span>${c.upcoming ? `<span class="pill">Coming soon</span>` : ""}</div></div>
      <button class="btn snap" data-a="quizNext">${quiz.i + 1 >= quiz.set.length ? "Finish" : "Next question ›"}</button>` : ""}</div>`;
}

/* ---------- 98. "What if": change the final board and see who'd win ---------- */
const wi = { id: "", locs: [], snapM: false, snapO: false, base: 1 };
function wiResult() {
  const ls = wi.locs.map((l) => ({ my: num(l.my), opp: num(l.opp) }));
  const won = ls.filter((l) => l.my > l.opp).length, lost = ls.filter((l) => l.my < l.opp).length;
  let r = won > lost ? "W" : lost > won ? "L" : "T";
  if (r === "T") { const a = ls.reduce((s, l) => s + l.my, 0), b = ls.reduce((s, l) => s + l.opp, 0); r = a > b ? "W" : a < b ? "L" : "T"; }
  const stake = Math.min(8, num(wi.base, 1) * (wi.snapM ? 2 : 1) * (wi.snapO ? 2 : 1) * 2);
  return { r, won, lost, cubes: r === "W" ? stake : r === "L" ? -stake : 0 };
}
function wiSheet() {
  const m = wi.id ? findMatchById(wi.id) : null, x = wiResult();
  const word = { W: "You'd win", L: "You'd lose", T: "It'd be a tie" }[x.r];
  return `${sheetHead("What if…", m ? `${m.deckName || "Your deck"}${m.oppName ? " vs " + esc(m.oppName) : ""}: change the final board` : "Set up a final board")}
    <div class="y33-wi">${wi.locs.map((l, i) => `<div class="panel y33-wil"><b>${esc(l.name || "Location " + (i + 1))}</b>
      <label class="f">You<div class="row nowrap"><button class="btn sm" data-a="wiStep" data-i="${i}" data-s="my" data-d="-1" aria-label="Less">−</button><input type="number" inputmode="numeric" value="${esc(num(l.my))}" data-wi="${i}" data-s="my"><button class="btn sm" data-a="wiStep" data-i="${i}" data-s="my" data-d="1" aria-label="More">+</button></div></label>
      <label class="f">Them<div class="row nowrap"><button class="btn sm" data-a="wiStep" data-i="${i}" data-s="opp" data-d="-1" aria-label="Less">−</button><input type="number" inputmode="numeric" value="${esc(num(l.opp))}" data-wi="${i}" data-s="opp"><button class="btn sm" data-a="wiStep" data-i="${i}" data-s="opp" data-d="1" aria-label="More">+</button></div></label>
      <span class="pill ${num(l.my) > num(l.opp) ? "W" : num(l.my) < num(l.opp) ? "L" : "dim"}">${num(l.my) > num(l.opp) ? "Yours" : num(l.my) < num(l.opp) ? "Theirs" : "Tied"}</span></div>`).join("")}</div>
    <div class="row"><label class="check"><input type="checkbox" data-wichk="snapM" ${wi.snapM ? "checked" : ""}> You snapped</label><label class="check"><input type="checkbox" data-wichk="snapO" ${wi.snapO ? "checked" : ""}> They snapped</label></div>
    <div class="panel y33-wires"><b class="${x.r === "W" ? "pos" : x.r === "L" ? "neg" : ""}">${word}</b><span>${x.won} location${x.won === 1 ? "" : "s"} to ${x.lost}${x.r !== "T" ? ` · ${signed(x.cubes)} cubes` : ""}</span>${m ? `<span class="muted">Really: ${m.result === "W" ? "a win" : m.result === "L" ? "a loss" : "a tie"} for ${signed(num(m.cubes))} cubes.</span>` : ""}</div>
    <p class="muted small">Add or take away Power to see what one more card would have changed. Cubes count both snaps and the final-turn double, up to 8.</p>
    <div class="row"><button class="btn ghost" data-a="wiReset">Start again</button><button class="btn snap" data-a="close">Done</button></div>`;
}
function wiOpen(m) {
  const L = arr(m && m.locs).filter(Boolean);
  wi.id = m ? m.id : ""; wi.snapM = !!(m && m.snapped); wi.snapO = !!(m && m.oppSnapped); wi.base = 1;
  wi.locs = (L.length ? L : [{}, {}, {}]).slice(0, 3).map((l, i) => ({ name: String(l.name || "Location " + (i + 1)), my: num(l.my), opp: num(l.opp) }));
  while (wi.locs.length < 3) wi.locs.push({ name: "Location " + (wi.locs.length + 1), my: 0, opp: 0 });
  wi.orig = clone(wi.locs); openSheet(wiSheet);
}
EXT.matchSheet.push(function y33WhatIf(mf) { return mf && mf.id && !mf.isNew ? `<button class="btn sm ghost" data-a="wiOpen" data-id="${esc(mf.id)}">What if…? Change the final board</button>` : ""; });
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || t.dataset.wi === undefined) return; const l = wi.locs[num(t.dataset.wi)]; if (!l) return; l[t.dataset.s] = clamp(Math.round(num(t.value)), -99, 999); clearTimeout(wi.t); wi.t = setTimeout(refreshSheet, 500); });
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.wichk) return; wi[t.dataset.wichk] = !!t.checked; refreshSheet(); });

/* ---------- 99. Photo mode: your deck with your card back and avatar ---------- */
async function photoBlob(d, withArt = true) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  picBackdrop(g, W, H);
  const art = withArt && showArt();
  const b = d.back && typeof cardBackById === "function" ? cardBackById(d.back) : null;
  let av = ""; try { const a = S.me.avatar; if (a && a.kind === "img") av = imgSrcOk(a.url); else { const l = lookOf(a, "avatar"); const src = l && typeof lookSources === "function" ? lookSources(l)[0] : null; av = src ? src.u : ""; } } catch { av = ""; }
  const keys = [...arr(d.cards)].slice(0, 12).sort((x, y) => num(card(x).cost) - num(card(y).cost));
  const [backI, avI, ...imgs] = await Promise.all([art && b ? quickImage(cardBackImg(b)) : null, art && av && /^https:/.test(av) ? quickImage(av) : null, ...keys.map((k) => { const c = card(k); return art && !c.custom ? quickImage(variantArt(deckVariant(d, k)) || c.art) : null; })]);
  const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  // The card back, big and tilted, behind everything
  g.save(); g.translate(W - 250, 300); g.rotate(0.12); rr(-180, -250, 360, 500, 28); g.clip();
  if (backI) g.drawImage(backI, -180, -250, 360, 500); else { const gr = g.createLinearGradient(-180, -250, 180, 250); gr.addColorStop(0, "#FFD23F"); gr.addColorStop(1, "#FF7A1A"); g.fillStyle = gr; g.fillRect(-180, -250, 360, 500); }
  g.restore(); g.save(); g.translate(W - 250, 300); g.rotate(0.12); rr(-180, -250, 360, 500, 28); g.lineWidth = 6; g.strokeStyle = "rgba(255,255,255,.65)"; g.stroke(); g.restore();
  // Avatar hexagon and the title
  const hx = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); };
  g.save(); hx(150, 170, 92); g.clip(); if (avI) g.drawImage(avI, 58, 78, 184, 184); else { g.fillStyle = `hsl(${hue(S.me.handle || "you")} 60% 40%)`; g.fillRect(58, 78, 184, 184); g.fillStyle = "#fff"; g.font = "800 90px system-ui"; g.textAlign = "center"; g.fillText(String(S.me.handle || "?")[0].toUpperCase(), 150, 202); }
  g.restore(); hx(150, 170, 92); g.lineWidth = 6; g.strokeStyle = "#FFD23F"; g.stroke();
  g.textAlign = "left"; g.fillStyle = "#FFD23F"; g.font = "italic 800 64px system-ui, sans-serif"; picText(g, d.name || "My deck", 270, 160, 470);
  g.fillStyle = "#C9C3EE"; g.font = "600 30px system-ui, sans-serif"; picText(g, S.me.handle ? `by ${S.me.handle}` : "My deck", 272, 210, 460);
  const st = statsFor(deckMatches(d)); if (st.games) { g.fillStyle = "#fff"; g.font = "700 30px system-ui"; picText(g, `${st.w}-${st.l} · ${st.wr}% wins`, 272, 256, 460); }
  // Cards: 4 × 3, slightly fanned
  const cw = 228, ch = 300, gx = 18, x0 = 46, y0 = 590;
  keys.forEach((k, i) => {
    const c = card(k), x = x0 + (i % 4) * (cw + gx), y = y0 + Math.floor(i / 4) * (ch - 70 + gx), img = imgs[i];
    g.save(); g.translate(x + cw / 2, y + ch / 2); g.rotate(((i % 4) - 1.5) * 0.025); rr(-cw / 2, -ch / 2, cw, ch, 18); g.clip();
    const h = hue(c.key), gr = g.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2); gr.addColorStop(0, `hsl(${h} 70% 46%)`); gr.addColorStop(1, `hsl(${(h + 48) % 360} 65% 16%)`); g.fillStyle = gr; g.fillRect(-cw / 2, -ch / 2, cw, ch);
    if (img) { const s = Math.max(cw / img.width, ch / img.height); g.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); }
    g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(-cw / 2, ch / 2 - 46, cw, 46); g.fillStyle = "#fff"; g.font = "700 22px system-ui"; g.textAlign = "center"; picText(g, c.name, -cw / 2 + 8, ch / 2 - 16, cw - 16);
    g.restore();
  });
  picFooter(g, W, H);
  return canvasBlob(cv);
}
EXT.deckSheet.push(function y33Photo(d) { return d && arr(d.cards).length ? `<button class="btn sm ghost" data-a="photoMode" data-id="${esc(d.id)}">📸 Photo mode</button>` : ""; });

/* ---------- 100. Year in SNAP ---------- */
const yis = { year: new Date().getFullYear(), i: 0 };
function yisData(year) {
  const from = new Date(year, 0, 1).getTime(), to = new Date(year + 1, 0, 1).getTime() - 1, ms = realMatches().filter((m) => m.ts >= from && m.ts <= to).sort((a, b) => a.ts - b.ts);
  const st = statsFor(ms), months = {}, decks = {}, cards = {}, opps = {};
  let run = 0, best = 0;
  for (const m of ms) {
    const mk = new Date(m.ts).getMonth(); (months[mk] = months[mk] || []).push(m);
    const dk = m.deckName || ""; if (dk) (decks[dk] = decks[dk] || []).push(m);
    const d = S.decks.find((x) => x.id === m.deckId); if (d) arr(d.cards).forEach((k) => (cards[k] = (cards[k] || 0) + 1));
    if (m.oppName) { const o = (opps[m.oppName] = opps[m.oppName] || { w: 0, l: 0 }); if (m.result === "W") o.w++; else if (m.result === "L") o.l++; }
    if (m.result === "W") { run++; best = Math.max(best, run); } else if (m.result === "L") run = 0;
  }
  const mName = (i) => new Date(year, i, 15).toLocaleDateString(undefined, { month: "long" });
  const bestMonth = Object.entries(months).map(([i, l]) => ({ i: +i, st: statsFor(l) })).sort((a, b) => b.st.cubes - a.st.cubes)[0] || null;
  const topDeck = Object.entries(decks).map(([n, l]) => ({ n, st: statsFor(l) })).sort((a, b) => b.st.games - a.st.games)[0] || null;
  const topCard = Object.entries(cards).sort((a, b) => b[1] - a[1])[0] || null;
  const rival = Object.entries(opps).filter(([, o]) => o.w + o.l >= 2).sort((a, b) => b[1].w + b[1].l - (a[1].w + a[1].l))[0] || null;
  const days = new Set(ms.map((m) => localDate(m.ts))).size;
  return { year, ms, st, bestMonth: bestMonth ? { name: mName(bestMonth.i), st: bestMonth.st } : null, topDeck, topCard: topCard ? { k: topCard[0], n: topCard[1] } : null, rival: rival ? { name: rival[0], ...rival[1] } : null, best, days };
}
function yisCards(x) {
  const c = [];
  c.push({ big: fmt(x.st.games), t: `matches in ${x.year}`, s: `on ${x.days} different day${x.days === 1 ? "" : "s"}` });
  c.push({ big: `${x.st.w}-${x.st.l}`, t: `${x.st.wr}% wins`, s: `${signed(x.st.cubes)} cubes all year` });
  if (x.bestMonth) c.push({ big: x.bestMonth.name, t: "your best month", s: `${signed(x.bestMonth.st.cubes)} cubes · ${x.bestMonth.st.wr}% wins` });
  if (x.topDeck) c.push({ big: x.topDeck.n, t: "your most played deck", s: `${x.topDeck.st.games} games · ${x.topDeck.st.wr}% wins` });
  if (x.topCard) c.push({ big: card(x.topCard.k).name, t: "the card you played with most", s: `in ${x.topCard.n} games`, k: x.topCard.k });
  if (x.best) c.push({ big: String(x.best), t: "wins in a row", s: "your longest streak" });
  if (x.rival) c.push({ big: x.rival.name, t: "your biggest rival", s: `you went ${x.rival.w}-${x.rival.l} against them` });
  c.push({ big: String(x.st.snaps), t: "snaps", s: x.st.snaps ? `${x.st.snapW} of them won` : "maybe next year?" });
  return c;
}
function yisSheet() {
  if (!flagOn("yearInSnap")) return `${sheetHead("Year in SNAP")}<p class="muted">This isn't switched on yet.</p>`;
  const x = yisData(yis.year), cards = yisCards(x), years = [...new Set(realMatches().map((m) => new Date(m.ts).getFullYear()))].sort((a, b) => b - a);
  if (!x.ms.length) return `${sheetHead("Year in SNAP", String(yis.year))}<div class="empty"><strong>No matches in ${esc(yis.year)} yet</strong><span>Log or track some games and your year fills in by itself.</span></div>${years.length ? `<div class="chips">${years.map((y) => `<button class="chip" data-a="yisYear" data-v="${y}">${y}</button>`).join("")}</div>` : ""}<button class="btn snap block" data-a="close">Done</button>`;
  return `${sheetHead("Your year in SNAP", String(yis.year))}
    ${years.length > 1 ? `<div class="chips">${years.map((y) => `<button class="chip" data-a="yisYear" data-v="${y}" aria-pressed="${y === yis.year}">${y}</button>`).join("")}</div>` : ""}
    <div class="tour-track hscroll y33-yis" data-noswipe>${cards.map((c, i) => `<div class="tour-card panel y33-yisc" style="${artStyle(c.t + i)}">${c.k ? `<div class="y33-yisart">${cardFace(card(c.k), { small: true })}</div>` : ""}<div class="y33-big">${esc(c.big)}</div><b>${esc(c.t)}</b><span class="muted">${esc(c.s)}</span><span class="muted small">${i + 1} / ${cards.length}</span></div>`).join("")}</div>
    <p class="muted small">Swipe through your year.</p>
    <div class="grid2"><button class="btn snap" data-a="yisShare">Share it</button><button class="btn" data-a="close">Done</button></div>`;
}
async function yisBlob() {
  const x = yisData(yis.year), cards = yisCards(x), W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  picBackdrop(g, W, H); g.textAlign = "left";
  g.fillStyle = "#FFD23F"; g.font = "italic 800 92px system-ui, sans-serif"; picText(g, `${x.year} in SNAP`, 70, 190, 940);
  g.fillStyle = "#C9C3EE"; g.font = "600 34px system-ui"; picText(g, S.me.handle ? S.me.handle : "My year", 72, 250, 940);
  cards.slice(0, 8).forEach((c, i) => { const y = 340 + i * 182; g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(60, y, 960, 160); g.fillStyle = "#fff"; g.font = "800 58px system-ui"; picText(g, c.big, 90, y + 72, 900); g.fillStyle = "#FFD23F"; g.font = "700 30px system-ui"; picText(g, c.t, 92, y + 116, 880); g.fillStyle = "#C9C3EE"; g.font = "500 26px system-ui"; picText(g, c.s, 92, y + 148, 880); });
  picFooter(g, W, H); return canvasBlob(cv);
}
EXT.profile.push(function y33YearCard() {
  if (!flagOn("yearInSnap")) return ""; const y = new Date().getFullYear(), n = realMatches().filter((m) => new Date(m.ts).getFullYear() === y).length;
  return `<section class="sec"><button class="panel y33-yisbtn" data-a="yisOpen"><span class="y33-big">${y}</span><span class="grow"><b>Your year in SNAP</b><br><span class="muted small">${n ? `${fmt(n)} matches so far: see your year's story` : "Fills in as you play"}</span></span><span class="muted">›</span></button></section>`;
});

/* ---------- Taps ---------- */
Object.assign(A, {
  triviaPick: (el) => {
    const t = triviaToday(), i = num(el.dataset.i), q = t.qs[i]; if (!q) return;
    const T = (S.trivia = obj(S.trivia)); T.days = obj(T.days); const mine = (T.days[t.day] = obj(T.days[t.day])); if (mine[i] !== undefined) return;
    mine[i] = el.dataset.v; if (el.dataset.v === q.a) { T.right = num(T.right) + 1; sfx("win"); } else sfx("loss");
    if (Object.keys(mine).length === 1) { const y = typeof gameDay === "function" ? gameDay(Date.now() - DAY) : localDate(Date.now() - DAY); T.streak = T.days[y] ? num(T.streak) + 1 : 1; }
    for (const k of Object.keys(T.days)) if (k < localDate(Date.now() - 14 * DAY)) delete T.days[k];
    save(); render();
  },
  quizOpen: () => { quiz.set = quizMake(); quiz.i = 0; quiz.pick = null; openSheet(quizSheet); },
  quizPick: (el) => { const q = quiz.set[quiz.i]; if (!q || quiz.pick !== null) return; quiz.pick = el.dataset.v; S.quiz = obj(S.quiz); S.quiz.asked = num(S.quiz.asked) + 1; if (quiz.pick === q.a) { S.quiz.right = num(S.quiz.right) + 1; sfx("win"); } else sfx("loss"); save(); refreshSheet(); },
  quizNext: () => { if (quiz.i + 1 >= quiz.set.length) { closeSheet(); toast(`Quiz done: ${num(obj(S.quiz).right)} right in total`); return; } quiz.i++; quiz.pick = null; refreshSheet(); },
  wiOpen: (el) => { const m = findMatchById(el.dataset.id); wiOpen(m); },
  wiBoard: () => wiOpen(null),
  wiStep: (el) => { const l = wi.locs[num(el.dataset.i)]; if (!l) return; l[el.dataset.s] = clamp(num(l[el.dataset.s]) + num(el.dataset.d), -99, 999); refreshSheet(); },
  wiReset: () => { wi.locs = clone(wi.orig || wi.locs); refreshSheet(); },
  photoMode: (el) => { const d = S.decks.find((x) => x.id === el.dataset.id); if (!d) return; makePic({ kind: "photo", title: d.name || "Deck", sub: "Photo mode: your card back and avatar", file: `snap-stat-photo-${keyOf(d.name) || "deck"}.png`, shareTitle: d.name || "My deck", make: (w) => photoBlob(d, w) }); },
  yisOpen: () => { const ys = [...new Set(realMatches().map((m) => new Date(m.ts).getFullYear()))].sort((a, b) => b - a); yis.year = ys.includes(new Date().getFullYear()) || !ys.length ? new Date().getFullYear() : ys[0]; openSheet(yisSheet); },
  yisYear: (el) => { yis.year = num(el.dataset.v, yis.year); refreshSheet(); },
  yisShare: () => makePic({ kind: "year", title: `${yis.year} in SNAP`, sub: "Your year as one picture", file: `snap-stat-${yis.year}.png`, shareTitle: `My ${yis.year} in MARVEL SNAP`, make: () => yisBlob() }),
  ovLookSet: (el) => { S.ovLook = { ...obj(S.ovLook), [el.dataset.f]: el.dataset.v }; save(); if (typeof overlayPush === "function") overlayPush(); render(); },
  sfxTest: (el) => { const was = S.sfx; S.sfx = true; sfx(el.dataset.v); S.sfx = was; },
});
EXT.cardsSubs.push(["quiz", "New card quiz", () => { const q = quizCards(); return `<section class="sec"><h2>New card quiz</h2><div class="panel stack small"><p>Learn the newest cards before you meet them: guess their cost, Power and what they do.</p>
  <p class="muted">${q.list.length ? `${q.list.length} card${q.list.length === 1 ? "" : "s"} to learn${q.soon ? ` (${q.soon} not out yet)` : ""}. ${num(obj(S.quiz).right)} right so far.` : "No new cards right now. They appear here as soon as the card data lists them."}</p>
  <div class="row"><button class="btn snap" data-a="quizOpen" ${q.list.length ? "" : "disabled"}>Start the quiz</button><button class="btn ghost" data-a="wiBoard">What if… board</button></div></div></section>`; }]);
EXT.search.push((q) => (/trivia|quiz|year|wrapped|photo|what if|sound|halloween|overlay/i.test(q) ? [{ label: "Year in SNAP", sub: "Profile", route: "profile" }, { label: "New card quiz", sub: "Cards", route: "cards/quiz" }, { label: "Sounds and seasonal looks", sub: "Settings › App", route: "settings/app" }] : []));
EXT.styles.push(`
.y33-q { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--line); } .y33-q:last-of-type { border-bottom: 0; }
.y33-opts { display: flex; flex-wrap: wrap; gap: 6px; } .y33-opts .chip { min-height: 40px; }
.y33-opts .chip[data-right] { background: color-mix(in srgb, var(--win) 28%, var(--surface)); border-color: var(--win); color: var(--fg); opacity: 1; }
.y33-opts .chip[data-wrong] { background: color-mix(in srgb, var(--loss) 24%, var(--surface)); border-color: var(--loss); color: var(--fg); opacity: 1; }
.y33-cotd { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 12px; align-items: start; }
.y33-cotd-face { min-width: 0; } .y33-cotd-name { font-family: var(--comic); font-size: 22px; letter-spacing: .4px; }
.y33-cotd p { margin: 0; } .linkbtn { background: none; border: 0; padding: 0; color: var(--snap-text); font: inherit; text-decoration: underline; cursor: pointer; }
.y33-reveal { align-items: flex-start; gap: 12px; } .y33-reveal > :first-child { flex: 0 0 96px; }
.y33-wi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.y33-wil { display: flex; flex-direction: column; gap: 6px; padding: 8px; min-width: 0; } .y33-wil b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.y33-wil .row { gap: 4px; } .y33-wil input { width: 100%; min-width: 0; text-align: center; padding: 6px 2px; } .y33-wil .btn.sm { min-width: 32px; padding-inline: 0; }
.y33-wires { display: flex; flex-direction: column; gap: 2px; margin: 10px 0; } .y33-wires b { font-size: 20px; }
.y33-yis .tour-card { min-height: 300px; } .y33-big { font-family: var(--comic); font-size: 46px; line-height: 1; letter-spacing: .5px; overflow-wrap: anywhere; color: var(--snap-text); }
.y33-yisart { width: 96px; } .y33-yisbtn { width: 100%; display: flex; gap: 14px; align-items: center; text-align: left; cursor: pointer; color: var(--fg); font: inherit; }
.y33-yisbtn .y33-big { font-size: 34px; }
.y33-ovprev { max-width: 420px; }
.ovt .ov-card { transition: all .2s; }
.ovt-accent .ov-card { background: linear-gradient(135deg, var(--ova, #FFD23F), var(--ovb, #FF7A1A)); color: #1A0E00; border-color: transparent; }
.ovt-accent .ov-pill { background: rgba(0,0,0,.18); color: #1A0E00; }
.ovt-glass .ov-card { background: rgba(10, 9, 24, .45); backdrop-filter: blur(6px); }
.ovt-mono .ov-card { background: #000; color: #fff; border-color: #fff; } .ovt-mono .ov-pill { background: #fff; color: #000; }
.ovt-compact .ov-card { font-size: 13px; padding: 8px 10px; gap: 2px; } .ovt-compact .ov-small { display: none; }
.ovt-big .ov-card { font-size: 22px; padding: 16px 18px; }
.brand[data-season]:not([data-season=""])::after { content: attr(data-season); font-size: 14px; margin-left: 4px; position: relative; top: -6px; }
body.seasonal-halloween { --snap-soft: color-mix(in srgb, #FF7A1A 22%, transparent); }
body.seasonal-halloween .tabs { box-shadow: inset 0 2px 0 color-mix(in srgb, #FF7A1A 60%, transparent); }
body.seasonal-holidays .tabs { box-shadow: inset 0 2px 0 color-mix(in srgb, #7FD3FF 60%, transparent); }
body.seasonal-newyear .tabs, body.seasonal-anniversary .tabs { box-shadow: inset 0 2px 0 color-mix(in srgb, #FFD23F 70%, transparent); }
body.seasonal-valentine .tabs { box-shadow: inset 0 2px 0 color-mix(in srgb, #FF5FA2 60%, transparent); }`);
