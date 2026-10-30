/* ============ Round three: draw odds, turn planner, rivals, voice logging, coach chat, deck test runs, goals and streaks,
   daily missions, credits planner, Snap Pack helper, season recap, achievements, tier list, challenges, spreadsheets, looks ============ */

/* ---------- Draw odds (live tracker) ---------- */
function drawOdds(L) {
  const inDeck = Object.values(L.my).filter((z) => z === "deck").length, left = Math.max(0, num(L.lastTurn) - num(L.turn));
  return { inDeck, left, p: inDeck ? Math.min(100, Math.round((Math.min(left, inDeck) / inDeck) * 100)) : 0, next: inDeck && left ? Math.round(100 / inDeck) : 0 };
}
function drawOddsLine(L) {
  const o = drawOdds(L); if (!o.inDeck) return "";
  return o.left ? `<p class="small">${plural(o.left, "draw")} left. Each card still in your deck: <b>${o.next}%</b> next turn, <b>${o.p}%</b> by turn ${num(L.lastTurn)}.</p>` : `<p class="small muted">No draws left this game.</p>`;
}
/* Chance a given card (or both of two cards) has been drawn by a turn: you see 3 cards plus 1 a turn, from 12. */
const seenBy = (t) => Math.min(12, 3 + t);
const oddsOne = (t) => Math.round((seenBy(t) / 12) * 100), oddsTwo = (t) => Math.round(((seenBy(t) * (seenBy(t) - 1)) / 132) * 100);

/* ---------- Turn planner (live tracker) ---------- */
function liveEnergy(L) { const e = obj(L.energy); return e.t === L.turn ? num(e.v) : num(L.turn); }
function bestPlays(keys, energy, n = 3) {
  const cs = keys.map((k) => ({ k, c: num(card(k).cost, 99), p: num(card(k).power) })).filter((x) => x.c <= energy).slice(0, 10);
  const out = [];
  for (let mask = 1; mask < 1 << cs.length; mask++) {
    let c = 0, p = 0; const ks = [];
    for (let i = 0; i < cs.length; i++) if (mask & (1 << i)) { c += cs[i].c; p += cs[i].p; ks.push(cs[i].k); }
    if (c <= energy) out.push({ ks, c, p });
  }
  return out.sort((a, b) => b.c - a.c || b.p - a.p || a.ks.length - b.ks.length).slice(0, n);
}
function turnPlannerHtml(L, hand) {
  if (!hand.length) return "";
  const e = liveEnergy(L), plays = bestPlays(hand, e);
  return `<div class="panel stack small"><div class="row between nowrap"><b>Best plays this turn</b><div class="stepper"><button data-a="liveEnergy" data-v="-1" aria-label="Less energy">−</button><span>${e} energy</span><button data-a="liveEnergy" data-v="1" aria-label="More energy">+</button></div></div>
    ${plays.length ? plays.map((x, i) => `<div class="row nowrap" style="gap:6px;align-items:flex-start"><span class="pill ${i ? "dim" : "gold"}">${i ? "Or" : "Best"}</span><div class="chiplist" style="flex:1">${x.ks.map((k) => cardChip(k, { noOwn: true })).join("")}</div><span class="muted nowrap">${x.c}/${e} · ${x.p} pow</span></div>`).join("") : `<span class="muted">Nothing in your hand fits ${e} energy.</span>`}
    <span class="muted">Counts printed cost and power only. Abilities and locations can change what's best.</span></div>`;
}

/* ---------- Rivals and opponent notes ---------- */
function rivalStats(name) {
  const k = keyOf(name); if (!k) return null;
  const ms = realMatches().filter((m) => keyOf(m.oppName) === k);
  const cards = {}; ms.forEach((m) => arr(m.oppCards).forEach((c) => (cards[c] = (cards[c] || 0) + 1)));
  return { k, name: ms[0] ? ms[0].oppName : String(name).trim(), ms, st: statsFor(ms), last: ms[0] ? ms[0].ts : 0, cards: Object.entries(cards).sort((a, b) => b[1] - a[1]).slice(0, 10), note: String(obj(obj(S.opp)[k]).note || "") };
}
function rivalLine(name) {
  const r = rivalStats(name); if (!r || (!r.ms.length && !r.note)) return "";
  const usual = r.ms.length ? oppUsual(r.ms) : "";
  return `<div class="note">${usual ? `<div class="small" style="margin-bottom:4px">${r.ms.length > 1 ? "Usually" : "Last time"}: ${esc(usual)}</div>` : ""}${r.ms.length ? `You've played ${esc(r.name)} ${plural(r.ms.length, "time")}: ${r.st.w}-${r.st.l}${r.st.t ? "-" + r.st.t : ""}, ${signed(r.st.cubes)} cubes. ` : ""}${r.cards.length ? `They've played ${esc(r.cards.slice(0, 4).map(([c]) => c).join(", "))}. ` : ""}${r.note ? `Your note: “${esc(r.note)}” ` : ""}<button class="btn sm ghost" data-a="rivalOpen" data-v="${esc(r.name)}">${r.note ? "Edit note" : "Add a note"}</button></div>`;
}
function rivalsHtml() {
  const by = {}; realMatches().forEach((m) => { const k = keyOf(m.oppName); if (k) (by[k] = by[k] || []).push(m); });
  Object.keys(obj(S.opp)).forEach((k) => { if (!by[k] && obj(S.opp[k]).note) by[k] = []; });
  const rows = Object.entries(by).filter(([k, l]) => l.length >= 2 || obj(obj(S.opp)[k]).note).map(([k, l]) => ({ k, name: l[0] ? l[0].oppName : obj(S.opp[k]).name || k, st: statsFor(l), last: l[0] ? l[0].ts : 0, note: obj(obj(S.opp)[k]).note })).sort((a, b) => b.st.games - a.st.games).slice(0, 20);
  if (!rows.length) return `<p class="muted small">Type your opponent's name in the live tracker or match form. Anyone you play twice shows up here with your record against them.</p>`;
  return `<div class="list">${rows.map((r) => `<button class="li" data-a="rivalOpen" data-v="${esc(r.name)}"><div class="grow" style="min-width:0"><div class="t">${esc(r.name)}${r.note ? ` <span class="pill dim">Note</span>` : ""}</div><div class="s">${r.st.games ? `${r.st.w}-${r.st.l}${r.st.t ? "-" + r.st.t : ""} · ${signed(r.st.cubes)} cubes · last ${esc(ago(r.last))}` : "No games logged yet"}</div></div><span class="num ${r.st.wr >= 50 ? "pos" : "neg"}">${r.st.games ? r.st.wr + "%" : ""}</span></button>`).join("")}</div>`;
}
let rivalName = "";
function rivalSheet() {
  const r = rivalStats(rivalName); if (!r) return sheetHead("Opponent");
  return `${sheetHead(esc(r.name), r.ms.length ? `${plural(r.ms.length, "game")} · last ${esc(ago(r.last))}` : "No games logged against them yet")}
    ${r.ms.length ? `<div class="tiles"><div class="tile"><div class="k">Record</div><div class="v">${r.st.w}-${r.st.l}${r.st.t ? "-" + r.st.t : ""}</div></div><div class="tile"><div class="k">Win rate</div><div class="v">${r.st.wr}%</div></div><div class="tile"><div class="k">Cubes</div><div class="v ${r.st.cubes >= 0 ? "pos" : "neg"}">${signed(r.st.cubes)}</div></div></div>` : ""}
    ${r.cards.length ? `<span class="eyebrow">Cards they've played</span><div class="chiplist">${r.cards.map(([n, c]) => nameChip(n, ` <span class="muted">×${c}</span>`)).join("")}</div>` : ""}
    <label class="f">Your notes about them<textarea id="rv-note" data-oppnote="1" maxlength="400" placeholder="What they play, how they snap, anything to remember">${esc(r.note)}</textarea></label>
    ${r.ms.length ? `<span class="eyebrow">Recent games</span><div class="list">${r.ms.slice(0, 8).map((m) => `<button class="li" data-a="matchEdit" data-id="${esc(m.id)}"><span class="pill ${m.result}">${m.result}</span><div class="grow"><div class="t">${esc(m.deckName || "No deck")}</div><div class="s">${esc(dateTimeStr(m.ts))} · ${esc(modeOf(m))}</div></div>${cubes(signed(num(m.cubes)), num(m.cubes) >= 0 ? "pos" : "neg")}</button>`).join("")}</div>` : ""}`;
}

/* ---------- Voice logging (Quick log) ---------- */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
function parseSpoken(text) {
  const t0 = ` ${String(text || "").replace(/[^A-Za-z0-9\s'-]/g, " ").replace(/\s+/g, " ")} `, t = t0.toLowerCase();
  const out = { flags: {}, text: String(text || "").trim() };
  // "they snapped", "they snapped and retreated", "they snapped then ran": everything after "they" is theirs
  const them = /\b(they|he|she|opponent|enemy|other guy)\s+((?:(?:snapped|retreated|ran|won|win|beat|lost|and|then|also)\s*)+)/g;
  let theirs = ""; t.replace(them, (_, __, w) => { theirs += " " + w; return " "; });
  const mine = t.replace(them, " ");
  if (/\bsnapped\b/.test(theirs)) out.flags.oppSnapped = true;
  if (/\b(retreated|ran)\b/.test(theirs)) out.flags.oppRetreated = true;
  if (/\bsnapped\b|\bi snap\b/.test(mine)) out.flags.snapped = true;
  if (/\b(retreated|retreat)\b/.test(mine)) out.flags.retreated = true;
  // Said outright wins over what the retreats suggest
  if (/\b(tie|tied|draw|drew)\b/.test(mine)) out.r = "T";
  else if (/\b(won|win|winner|victory|beat)\b/.test(mine)) out.r = "W";
  else if (/\b(lost|lose|loss|losing|defeat|defeated)\b/.test(mine)) out.r = "L";
  else if (out.flags.retreated) out.r = "L";
  else if (out.flags.oppRetreated) out.r = "W";
  const n = t.match(/\b(plus|minus|up|down)\s+(\d+|one|two|four|eight|to|too|for|ate)\b/) || t.match(/\b(\d+)\s*(cubes?)?\b/) || t.match(/\b(one|two|three|four|five|six|seven|eight)\s+cubes?\b/) || t.match(/\b(one|two|four|eight)\b/);
  if (n) { const w = n[2] && !/^cubes?$/.test(n[2]) ? n[2] : n[1]; const v = /^\d+$/.test(w) ? Number(w) : NUM_WORDS[w] || { to: 2, too: 2, for: 4, ate: 8 }[w] || 0; if (v >= 1 && v <= 8) out.cubes = v; }
  if (/\bconquest\b/.test(t)) out.mode = "Conquest"; else if (/\bfriendly\b/.test(t)) out.mode = "Friendly"; else if (/\bdraft\b/.test(t)) out.mode = "Draft"; else if (/\branked\b/.test(t)) out.mode = "Ranked";
  const tk = keyOf(t); let best = null;
  for (const d of S.decks) { const k = keyOf(d.name); if (k.length >= 3 && tk.includes(k) && (!best || k.length > keyOf(best.name).length)) best = d; }
  if (best) out.deckId = best.id;
  const o = t.match(/\b(?:against|versus|vs)\s+(.+?)(?=\s+(?:with|using|in|on|and|plus|minus|i|we|they)\b|\s*$)/);
  if (o) out.opp = t0.slice(o.index + o[0].length - o[1].length, o.index + o[0].length).trim().slice(0, 40);
  return out;
}
function startVoice() {
  if (!SpeechRec) { toast("Voice logging needs Chrome on Android or a desktop browser that supports it."); return; }
  let rec; try { rec = new SpeechRec(); } catch { toast("Voice logging isn't available here."); return; }
  rec.lang = navigator.language || "en-US"; rec.interimResults = false; rec.maxAlternatives = 3;
  qk.listening = true; qk.heard = ""; refreshSheet();
  rec.onresult = (e) => {
    const alts = [...e.results[0]].map((a) => a.transcript); const parsed = alts.map(parseSpoken); const p = parsed.find((x) => x.r) || parsed[0];
    qk.listening = false; handleVoice(p);
  };
  rec.onerror = (e) => { qk.listening = false; qk.heard = e && (e.error === "not-allowed" || e.error === "service-not-allowed") ? "The microphone is blocked. Allow it for this site in Chrome's settings." : "Didn't catch that. Tap the mic and try again."; refreshSheet(); };
  rec.onend = () => { if (qk.listening) { qk.listening = false; refreshSheet(); } };
  try { rec.start(); } catch { qk.listening = false; refreshSheet(); }
}
function handleVoice(p) {
  if (p.deckId) S.quick = { ...obj(S.quick), deckId: p.deckId };
  if (p.mode) S.quick = { ...obj(S.quick), mode: p.mode };
  qk.f = { ...qk.f, ...p.flags };
  const mode = obj(S.quick).mode || (realMatches()[0] ? modeOf(realMatches()[0]) : "Ranked");
  const extra = p.opp ? { oppName: p.opp } : {};
  if (p.r && (p.r === "T" || mode !== "Ranked" || p.cubes)) { qk.heard = `Heard “${esc(p.text)}”.`; quickSaveMatch(p.r, p.r === "T" || mode !== "Ranked" ? 0 : p.cubes, extra); return; }
  qk.heard = `Heard “${esc(p.text)}”. ${p.r ? `${p.r === "W" ? "Win" : "Loss"}: how many cubes? Tap below.` : "Say win or loss and the cubes, like “won plus four”."}`;
  save(); refreshSheet();
}
function voiceHtml() {
  if (!SpeechRec) return "";
  return `<div class="row nowrap"><button class="btn ${qk.listening ? "snap" : ""}" data-a="voiceLog" ${qk.listening ? "disabled" : ""}>${qk.listening ? "Listening…" : "🎤 Say it"}</button><span class="muted small">Like “won plus four with Discard, they snapped”.</span></div>${qk.heard ? `<p class="small">${qk.heard}</p>` : ""}`;
}

/* ---------- Ask the coach ---------- */
const coach = { msgs: [], busy: false };
function coachContext() {
  const ms = realMatches(), d30 = ms.filter((m) => m.ts >= Date.now() - 30 * DAY), d60 = ms.filter((m) => m.ts >= Date.now() - 60 * DAY);
  const line = (l, list) => { const s = statsFor(list); return `${l}: ${s.games} games, ${s.w}-${s.l}-${s.t}, ${s.wr}% wins, ${signed(s.cubes)} cubes (${s.cpg} a game)`; };
  const out = [line("All time", ms), line("Last 30 days", d30)];
  const cl0 = climbNow(), cl = cl0 && !cl0.stale ? cl0 : null; out.push(`Rank now: ${cl ? rankStr(cl.rank) : cl0 && cl0.stale ? "not set for this season yet" : S.me.rank || "not set"}${S.me.colLevel ? `, Collection Level ${S.me.colLevel}` : ""}`);
  const byDeck = {}; d60.forEach((m) => { const k = m.deckId || m.deckName || "none"; (byDeck[k] = byDeck[k] || []).push(m); });
  Object.entries(byDeck).sort((a, b) => b[1].length - a[1].length).slice(0, 6).forEach(([k, l]) => { const d = S.decks.find((x) => x.id === k); const s = statsFor(l); out.push(`Deck "${d ? d.name : l[0].deckName || "No deck"}"${d ? ` [${d.cards.map((c) => card(c).name).join(", ")}]` : ""}: ${s.games} games, ${s.wr}% wins, ${signed(s.cubes)} cubes`); });
  const g = d60.length >= 8 ? d60 : ms; const sn = g.filter((m) => m.snapped), os = g.filter((m) => m.oppSnapped), full = g.filter((m) => m.result === "L" && !m.retreated), ret = g.filter((m) => m.retreated);
  if (g.length) out.push(`Snapping: snaps in ${pct(sn.length, g.length)}% of games, wins ${winPct(sn)}% of those (avg ${signed(avgCubes(sn))} cubes). Retreats: ${ret.length} (avg ${signed(avgCubes(ret))}). Losses played out: ${full.length} (avg ${signed(avgCubes(full))}). When the opponent snaps: wins ${winPct(os)}% of ${os.length}.`);
  const arch = {}; g.filter((m) => arr(m.oppCards).length).forEach((m) => { const a = archetypeOf(m.oppCards) || "unknown"; (arch[a] = arch[a] || []).push(m); });
  const al = Object.entries(arch).sort((a, b) => b[1].length - a[1].length).slice(0, 6); if (al.length) out.push("Against deck types: " + al.map(([a, l]) => `${a} ${l.length} games ${winPct(l)}%`).join("; "));
  const oc = {}; g.forEach((m) => new Set(arr(m.oppCards)).forEach((n) => (oc[n] = oc[n] || []).push(m)));
  const bad = Object.entries(oc).filter(([, l]) => l.length >= 3).map(([n, l]) => [n, l.length, winPct(l)]).sort((a, b) => a[2] - b[2]).slice(0, 6); if (bad.length) out.push("Opponent cards they struggle against: " + bad.map(([n, c, w]) => `${n} (${w}% in ${c})`).join(", "));
  const ca = cardAnalytics(g).sort((a, b) => b.played - a.played).slice(0, 12); if (ca.length) out.push("Their cards in tracked games: " + ca.map((r) => `${card(r.k).name} played ${r.played}x, ${r.wr}% wins, avg ${r.avg} power`).join("; "));
  const mo = {}; g.forEach((m) => (mo[modeOf(m)] = mo[modeOf(m)] || []).push(m)); out.push("Modes: " + Object.entries(mo).map(([k, l]) => `${k} ${l.length} games ${winPct(l)}%`).join("; "));
  return out.join("\n");
}
const COACH_STARTERS = ["What's my biggest weakness?", "Should I snap more or less?", "Which deck should I play?", "What card should I swap out?"];
function coachSheet() {
  const has = !!store.sample;
  return `${sheetHead("Ask the coach", "Answers use your own stats")}
    ${!has ? `<p class="note">${window.SNAPSTAT_STANDALONE ? "Add an AI key in Settings › AI to chat with the coach." : "The coach needs AI access, which isn't available in this view."}</p>` : ""}
    <div class="stack" id="coach-log">${coach.msgs.map((m) => `<div class="cmsg ${m.role}">${m.role === "me" ? esc(m.text) : esc(m.text).replace(/\n/g, "<br>")}</div>`).join("") || `<p class="muted small">Ask anything about your games, decks or climbing. The coach sees a summary of your stats, not your account.</p>`}
      ${coach.busy ? `<div class="cmsg coach muted">Thinking…</div>` : ""}</div>
    <div class="chiplist">${(coach.msgs.length ? arr(coach.follow) : COACH_STARTERS).slice(0, 4).map((q) => `<button class="chip" data-a="coachAsk" data-q="${esc(q)}" ${has && !coach.busy ? "" : "disabled"}>${esc(q)}</button>`).join("")}</div>
    <div class="row nowrap"><input type="text" id="coach-q" placeholder="Ask the coach" maxlength="300" ${has ? "" : "disabled"} autocomplete="off" style="flex:1;min-width:0"><button class="btn snap" data-a="coachAsk" ${has && !coach.busy ? "" : "disabled"}>Ask</button></div>
    ${coach.msgs.length ? `<button class="btn sm ghost" data-a="coachClear">Start over</button>` : ""}`;
}
async function coachAsk(q) {
  q = String(q || "").trim().slice(0, 300); if (!q || coach.busy || !store.sample) return;
  coach.msgs.push({ role: "me", text: q }); coach.busy = true; refreshSheet();
  const history = coach.msgs.slice(-7, -1).map((m) => `${m.role === "me" ? "Player" : "Coach"}: ${m.text}`).join("\n");
  const prompt = `You are a friendly, practical MARVEL SNAP coach inside the SNAP Stat app. Use the player's stats below when they help, say plainly when there isn't enough data, and never invent numbers. Use real MARVEL SNAP card names. Keep it under 160 words in plain language. Short lines starting with "• " are fine; no headings.
Player's stats:
${coachContext()}
${history ? `Conversation so far:\n${history}\n` : ""}Player: ${q}
Reply as JSON: {"answer": "your reply", "followUps": ["up to 3 short follow-up questions the player might ask next"]}`;
  try { const r = await store.sample.json(prompt, { modelTier: "default" }); coach.msgs.push({ role: "coach", text: String(r.answer || "I couldn't come up with an answer. Try asking another way.").slice(0, 2000) }); coach.follow = arr(r.followUps).map(String).slice(0, 3); }
  catch (e) { coach.msgs.push({ role: "coach", text: e && e.message ? e.message : "The coach couldn't answer right now." }); }
  coach.busy = false; refreshSheet(); const log = $("#coach-log"); if (log) log.lastElementChild && log.lastElementChild.scrollIntoView({ block: "nearest" });
}

/* ---------- Deck test run (practice games against nobody) ---------- */
function bestSubset(hand, energy) {
  let best = { idx: [], c: 0, p: 0 };
  for (let mask = 1; mask < 1 << hand.length; mask++) {
    let c = 0, p = 0; for (let i = 0; i < hand.length; i++) if (mask & (1 << i)) { c += hand[i].c; p += hand[i].p; }
    if (c <= energy && (c > best.c || (c === best.c && p > best.p))) { const idx = []; for (let i = 0; i < hand.length; i++) if (mask & (1 << i)) idx.push(i); best = { idx, c, p }; }
  }
  return best;
}
function simulateDeck(keys, runs = 2000, turns = 6) {
  const deck0 = keys.map((k) => ({ k, c: num(card(k).cost, NaN), p: num(card(k).power) })).filter((x) => Number.isFinite(x.c));
  const R = { runs, turns, cards: deck0.length, curve: 0, wasted: 0, power: 0, perTurn: Array.from({ length: turns }, () => ({ used: 0, none: 0 })), played: {}, drawn: {} };
  for (let r = 0; r < runs; r++) {
    const d = [...deck0]; for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    const hand = d.splice(0, 3); hand.forEach((x) => (R.drawn[x.k] = (R.drawn[x.k] || 0) + 1));
    let full = true, pw = 0;
    for (let t = 1; t <= turns; t++) {
      if (d.length && hand.length < 7) { const x = d.shift(); hand.push(x); R.drawn[x.k] = (R.drawn[x.k] || 0) + 1; }
      const b = bestSubset(hand, t); const pt = R.perTurn[t - 1];
      pt.used += b.c; if (!b.idx.length) pt.none++; if (b.c < t) full = false; R.wasted += t - b.c; pw += b.p;
      b.idx.sort((x, y) => y - x).forEach((i) => { R.played[hand[i].k] = (R.played[hand[i].k] || 0) + 1; hand.splice(i, 1); });
    }
    if (full) R.curve++; R.power += pw;
  }
  return R;
}
const sims = {};
function deckTestHtml(d) {
  const keys = d.cards.filter((k) => !String(k).startsWith("custom:") || Number.isFinite(num(card(k).cost, NaN)));
  const sig = [...keys].sort().join(","); const R = sims[d.id] && sims[d.id].sig === sig ? sims[d.id].R : null;
  const total = (R ? R.turns : 6) * ((R ? R.turns : 6) + 1) / 2;
  const odds = `<div class="tbl-wrap"><table><thead><tr><th>By turn</th>${[1, 2, 3, 4, 5, 6, 7].map((t) => `<th class="n">${t}</th>`).join("")}</tr></thead><tbody><tr><td>Any one card</td>${[1, 2, 3, 4, 5, 6, 7].map((t) => `<td class="n">${oddsOne(t)}%</td>`).join("")}</tr><tr><td>Two specific cards</td>${[1, 2, 3, 4, 5, 6, 7].map((t) => `<td class="n">${oddsTwo(t)}%</td>`).join("")}</tr></tbody></table></div><p class="muted small">Chance you've drawn a card (or both cards of a combo) by each turn, before any card-draw effects.</p>`;
  if (keys.length < 12) return `<p class="note">Add ${12 - keys.length} more card${12 - keys.length > 1 ? "s" : ""} to test this deck.</p><h3>Draw odds</h3>${odds}`;
  if (!R) return `<p class="small">Plays this deck 2,000 times on its own to see how smoothly it uses its energy: how often you have something to play each turn and which cards tend to get stuck in your hand.</p><button class="btn snap" data-a="deckTest">Run 2,000 test games</button><h3>Draw odds</h3>${odds}`;
  const rows = Object.keys(R.drawn).map((k) => ({ k, drawn: R.drawn[k] / R.runs, played: num(R.played[k]) / R.runs })).sort((a, b) => b.played - a.played);
  const stuck = rows.filter((r) => r.drawn && r.played / r.drawn < 0.75);
  return `<div class="tiles"><div class="tile"><div class="k">Full curve every turn</div><div class="v">${pct(R.curve, R.runs)}%</div></div><div class="tile"><div class="k">Energy used</div><div class="v">${Math.round(total - R.wasted / R.runs)}<span class="muted small"> / ${total}</span></div></div><div class="tile"><div class="k">Power played</div><div class="v">${Math.round(R.power / R.runs)}</div></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Turn</th><th class="n">Energy used</th><th class="n">Nothing to play</th></tr></thead><tbody>${R.perTurn.map((t, i) => `<tr><td>${i + 1}</td><td class="n">${(Math.round((t.used / R.runs) * 10) / 10).toFixed(1)} / ${i + 1}</td><td class="n ${pct(t.none, R.runs) > 25 ? "neg" : ""}">${pct(t.none, R.runs)}%</td></tr>`).join("")}</tbody></table></div>
    <h3>How often each card gets played</h3><div class="tbl-wrap"><table><thead><tr><th>Card</th><th class="n">Drawn</th><th class="n">Played</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(card(r.k).name)}</td><td class="n">${Math.round(r.drawn * 100)}%</td><td class="n ${r.drawn && r.played / r.drawn < 0.75 ? "neg" : ""}">${Math.round(r.played * 100)}%</td></tr>`).join("")}</tbody></table></div>
    ${stuck.length ? `<p class="small">Often stuck in your hand: ${stuck.map((r) => esc(card(r.k).name)).join(", ")}. Cheaper cards or fewer expensive ones would smooth the curve.</p>` : `<p class="small">Every card usually gets played once drawn. Nice curve.</p>`}
    <p class="muted small">A quick practice run by turn ${R.turns}: it plays as much energy as it can each turn and ignores abilities, locations and your opponent.</p>
    <button class="btn" data-a="deckTest">Run again</button><h3>Draw odds</h3>${odds}`;
}

/* ---------- Goals and streaks ---------- */
const GOAL_KINDS = {
  gamesDay: { label: "Play games today", unit: "games", per: "day", val: (ms) => ms.length },
  winsDay: { label: "Win games today", unit: "wins", per: "day", val: (ms) => ms.filter((m) => m.result === "W").length },
  winsWeek: { label: "Win games this week", unit: "wins", per: "week", val: (ms) => ms.filter((m) => m.result === "W").length },
  cubesWeek: { label: "Earn cubes this week", unit: "net cubes", per: "week", val: (ms) => Math.max(0, ms.reduce((s, m) => s + num(m.cubes), 0)) },
  snapWinsWeek: { label: "Snap and win this week", unit: "snapped wins", per: "week", val: (ms) => ms.filter((m) => m.snapped && m.result === "W").length },
  rankBy: { label: "Reach a rank by a date", unit: "rank", per: "date" },
};
function goalProgress(g) {
  const K = GOAL_KINDS[g.kind]; if (!K) return null;
  if (g.kind === "rankBy") {
    const s0 = climbNow(), st = s0 && !s0.stale ? s0 : null; const now = st ? st.rank : s0 && s0.stale ? 0 : rankFromStr(S.me.rank); const target = clamp(num(g.target), 1, 100);
    const days = g.by ? Math.max(0, Math.ceil((dayEnd(g.by) - Date.now()) / DAY)) : 0; const pace = climbPace();
    const need = Math.max(0, (target - now) * cpr() - (st ? st.cubes : 0)); const gpdNeed = pace.cpg > 0 && days ? Math.ceil(need / pace.cpg / days) : 0;
    return { have: now, goal: target, done: now >= target, text: `Rank ${target >= 100 ? "Infinite" : target} by ${g.by ? dateStr(g.by) : "the end of the season"}`, sub: now >= target ? "Reached!" : !now ? "Set your rank in Play › Insights" : `${now} now · ${need} cubes to go${gpdNeed ? ` · about ${gpdNeed} games a day` : days ? "" : ""}${days ? ` · ${plural(days, "day")} left` : ""}` };
  }
  const ms = realMatches().filter((m) => (K.per === "day" ? localDate(m.ts) === localDate(Date.now()) : weekKey(m.ts) === weekKey(Date.now())));
  const have = K.val(ms), goal = Math.max(1, num(g.target));
  return { have, goal, done: have >= goal, text: `${K.label}: ${fmt(goal)}`, sub: have >= goal ? "Done!" : `${fmt(have)} of ${fmt(goal)} ${K.unit}` };
}
function streaks() {
  const ms = [...realMatches()].sort((a, b) => a.ts - b.ts);
  let cur = 0, best = 0; for (const m of ms) { if (m.result === "W") { cur++; best = Math.max(best, cur); } else if (m.result === "L") cur = 0; }
  const days = new Set(ms.map((m) => localDate(m.ts))); let d = 0; const c = new Date(); c.setHours(12, 0, 0, 0); if (!days.has(localDate(c.getTime()))) c.setDate(c.getDate() - 1); while (days.has(localDate(c.getTime()))) { d++; c.setDate(c.getDate() - 1); }
  let bestDays = 0, run = 0, prev = null; [...days].sort().forEach((x) => { const ts = dayStart(x); run = prev !== null && Math.round((ts - prev) / DAY) === 1 ? run + 1 : 1; bestDays = Math.max(bestDays, run); prev = ts; });
  return { win: cur, bestWin: best, days: d, bestDays, playedToday: days.has(localDate(Date.now())) };
}
function todayHtml() {
  const goals = arr(S.goals), ms = realMatches(), st = streaks(); const mi = missionState();
  if (!ms.length && !goals.length && !mi.items.length) return "";
  const chips = [st.days ? `${plural(st.days, "day")} in a row` : "", st.win >= 2 ? `${st.win} wins in a row` : "", st.bestWin >= 3 ? `best streak ${st.bestWin}` : ""].filter(Boolean);
  return `<section class="sec"><div class="sec-h"><h2>Today</h2><div class="row"><button class="btn sm ghost" data-a="missionEdit">Missions</button><button class="btn sm ghost" data-a="goalNew">${ICON.plus} Goal</button></div></div>
    ${chips.length ? `<div class="chiplist">${chips.map((c) => `<span class="pill gold">${esc(c)}</span>`).join("")}</div>` : ""}
    ${goals.length ? `<div class="list">${goals.map((g) => { const p = goalProgress(g); if (!p) return ""; return `<div class="li" style="flex-direction:column;align-items:stretch;gap:6px"><div class="row between nowrap"><b class="small">${esc(p.text)}</b><div class="row nowrap">${p.done ? `<span class="pill W">Done</span>` : ""}<button class="x" data-a="goalDel" data-id="${esc(g.id)}" aria-label="Remove goal">${ICON.x}</button></div></div>${progBar(Math.min(p.have, p.goal), p.goal, p.sub)}<span class="muted small">${esc(p.sub)}</span></div>`; }).join("")}</div>` : ""}
    ${gameMissionsHtml()}${missionsHtml(mi)}</section>`;
}
const gl = { kind: "gamesDay", target: 10, by: "" };
function goalSheet() {
  const k = (v, l) => `<button class="chip" data-a="glKind" data-v="${v}" aria-pressed="${gl.kind === v}">${l}</button>`;
  const cs = currentSeason();
  return `${sheetHead("New goal")}<div class="chiplist">${Object.entries(GOAL_KINDS).map(([v, K]) => k(v, K.label)).join("")}</div>
    ${gl.kind === "rankBy" ? `<div class="grid2"><label class="f">Rank (100 = Infinite)<input type="number" id="gl-target" min="2" max="100" value="${esc(gl.target || 100)}" inputmode="numeric"></label><label class="f">By<input type="date" id="gl-by" value="${esc(gl.by || (cs && cs.end) || "")}"></label></div>`
      : `<label class="f">How many ${esc(GOAL_KINDS[gl.kind].unit)}<input type="number" id="gl-target" min="1" value="${esc(gl.target)}" inputmode="numeric"></label>`}
    <button class="btn snap" data-a="goalSave">Add goal</button><p class="muted small">Daily goals restart at midnight, weekly ones on Monday. With notifications on, the app nudges you in the evening if a daily goal isn't done.</p>`;
}
/* Called after a match is saved: tells you about goals you just finished and achievements you just earned. */
function afterMatchChecks() {
  let changed = false; const msgs = [];
  const doneNow = arr(S.goals).filter((g) => { const p = goalProgress(g); return p && p.done; }).map((g) => g.id + ":" + (GOAL_KINDS[g.kind].per === "day" ? localDate(Date.now()) : GOAL_KINDS[g.kind].per === "week" ? weekKey(Date.now()) : "x"));
  const seenG = new Set(arr(S.goalsDone)); doneNow.forEach((k) => { if (!seenG.has(k)) { const g = arr(S.goals).find((x) => k.startsWith(x.id + ":")); msgs.push("Goal done: " + goalProgress(g).text); seenG.add(k); changed = true; } });
  if (changed) S.goalsDone = [...seenG].slice(-60);
  const earned = earnedBadges(); const seenB = new Set(arr(S.badgesSeen));
  if (!S.badgesSeen) { S.badgesSeen = earned; changed = true; }
  else earned.forEach((id) => { if (!seenB.has(id)) { const b = BADGES.find((x) => x.id === id); msgs.push("Achievement: " + b.name); seenB.add(id); changed = true; } });
  if (changed && S.badgesSeen !== earned) S.badgesSeen = [...seenB];
  if (msgs.length) setTimeout(() => toast(msgs.slice(0, 2).join(" · ")), 900);
  overlayPush(); if (notifyPrefs().on) setTimeout(saveNotifyState, 0);
  return changed;
}

/* ---------- Daily missions checklist (resets with the game, 19:00 UTC) ---------- */
const MISSION_PRESETS = ["Finish today's missions", "Alliance bounties", "Check the shop", "Play a Conquest run"];
const missionDay = () => gameDay();
function nextReset() { return nextDailyReset(); }
function missionState() {
  const m = obj(S.missions); const items = m.items ? arr(m.items) : MISSION_PRESETS.map((t, i) => ({ id: "p" + i, text: t }));
  const done = obj(m.done).day === missionDay() ? arr(obj(m.done).ids) : [];
  return { items, done, left: items.filter((x) => !done.includes(x.id)).length };
}
function missionsHtml(mi = missionState()) {
  if (!mi.items.length) return "";
  return `<div class="panel stack small"><div class="row between"><b>Daily checklist</b><span class="muted">resets in ${cdSpan(nextReset())}</span></div>
    ${mi.items.map((x) => `<label class="check"><input type="checkbox" data-mission="${esc(x.id)}" ${mi.done.includes(x.id) ? "checked" : ""}> ${esc(x.text)}</label>`).join("")}</div>`;
}
function missionEditSheet() {
  const mi = missionState();
  return `${sheetHead("Daily checklist", "Things to do every day. It resets when the game's day does.")}
    <div class="list">${mi.items.map((x) => `<div class="li"><span class="grow">${esc(x.text)}</span><button class="x" data-a="missionDel" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.text)}">${ICON.x}</button></div>`).join("") || `<div class="li muted small">Nothing on the list. Add something below, or leave it empty to hide the checklist.</div>`}</div>
    <div class="row nowrap"><input type="text" id="mi-add" placeholder="Add something to do each day" maxlength="60" style="flex:1;min-width:0"><button class="btn sm" data-a="missionAdd">Add</button></div>
    <p class="muted small">The game's day resets at ${new Date(nextReset()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} your time. With notifications on, you get a reminder a couple of hours before if the list isn't done.</p>`;
}

/* ---------- Credits planner ---------- */
const UPGRADES = [["Common → Uncommon", 25, 5, 1], ["Uncommon → Rare", 100, 10, 2], ["Rare → Epic", 200, 20, 4], ["Epic → Legendary", 300, 30, 6], ["Legendary → Ultra", 400, 40, 8], ["Ultra → Infinity", 500, 50, 10]];
function creditsHtml() {
  const cr = num(S.wallet.credits), cl = num(S.me.colLevel), goal = num(S.clGoal);
  const lv = Math.floor(cr / 50);
  return `<section class="sec"><h2>Credits & Collection Level</h2><div class="panel stack small">
    <p>${cr ? `With <b>${fmt(cr)} credits</b> you can upgrade about <b>${fmt(lv)} Collection Levels</b>${cl ? `, taking you from ${fmt(cl)} to about <b>${fmt(cl + lv)}</b>` : ""}, as long as your cards have the boosters.` : "Enter your credits above to see how many Collection Levels they buy."}</p>
    <div class="grid2"><label class="f">Collection Level now<input type="number" id="cp-cl" data-bind="me.colLevel" data-num="1" value="${esc(S.me.colLevel)}" inputmode="numeric"></label><label class="f">Goal<input type="number" id="cp-goal" data-bind="clGoal" data-num="1" value="${esc(S.clGoal || "")}" inputmode="numeric" placeholder="e.g. 2000"></label></div>
    ${goal && cl && goal > cl ? `<p>To reach <b>${fmt(goal)}</b> you need about <b>${fmt((goal - cl) * 50)} credits</b>${cr ? ` (${cr >= (goal - cl) * 50 ? "you have enough" : `${fmt((goal - cl) * 50 - cr)} more than you have`})` : ""} and the boosters to match.</p>` : ""}
    <div class="tbl-wrap"><table><thead><tr><th>Upgrade</th><th class="n">Credits</th><th class="n">Boosters</th><th class="n">Levels</th></tr></thead><tbody>${UPGRADES.map(([l, c, b, v]) => `<tr><td>${l}</td><td class="n">${c}</td><td class="n">${b}</td><td class="n">+${v}</td></tr>`).join("")}</tbody></table></div>
    <span class="muted">Every upgrade except the first works out to 50 credits per level, so it doesn't matter much which cards you upgrade. Upgrade the cards with the most boosters first. Ultra to Infinity also lets you split the card.</span></div></section>`;
}

/* ---------- Season recap picture ---------- */
function recapData(p) {
  const ms = inPeriod(realMatches(), p); const s = statsFor(ms);
  const byDeck = {}; ms.forEach((m) => { const k = m.deckName || "No deck"; (byDeck[k] = byDeck[k] || []).push(m); });
  const deck = Object.entries(byDeck).filter(([k, l]) => k !== "No deck" && l.length >= 3).map(([k, l]) => ({ name: k, st: statsFor(l) })).sort((a, b) => b.st.w - a.st.w || b.st.wr - a.st.wr)[0];
  let top = cardAnalytics(ms).sort((a, b) => b.played - a.played)[0]; let topKey = top ? top.k : "";
  if (!topKey) { const cnt = {}; ms.forEach((m) => { const d = S.decks.find((x) => x.id === m.deckId); if (d) d.cards.forEach((k) => (cnt[k] = (cnt[k] || 0) + 1)); }); topKey = (Object.entries(cnt).sort((a, b) => b[1] - a[1])[0] || [""])[0]; }
  const big = [...ms].sort((a, b) => num(b.cubes) - num(a.cubes))[0];
  let run = 0, streak = 0; [...ms].sort((a, b) => a.ts - b.ts).forEach((m) => { if (m.result === "W") { run++; streak = Math.max(streak, run); } else if (m.result === "L") run = 0; });
  const faced = {}; ms.forEach((m) => new Set(arr(m.oppCards)).forEach((n) => (faced[n] = (faced[n] || 0) + 1)));
  const peak = p.season ? obj(S.ranks["s:" + p.season.id]).peak || (timeState(p.season) === "live" ? S.me.peak : "") : p.id === "all" ? peakAllTime() : (() => { let best = 0; for (const s of seasons()) if (s.startTs <= p.to && s.endTs >= p.from) best = Math.max(best, rankFromStr(obj(S.ranks["s:" + s.id]).peak)); return best ? rankStr(best) : S.me.peak; })();
  return { label: plainLabel(p) || p.label, s, deck, topKey, loc: bestLocation(ms), keyArt: p.season && showArt() ? seasonArt(p.season) : "", big: big && num(big.cubes) > 0 ? big : null, streak, faced: Object.entries(faced).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n), peak, snapsWon: ms.filter((m) => m.snapped && m.result === "W").length };
}
async function recapBlob(p, withArt = true) {
  const x = recapData(p); const W = 1080, H = 1350;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#2A1670"); bg.addColorStop(0.55, "#120D3A"); bg.addColorStop(1, "#0A0918"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.05)"; for (let yy = 0; yy < H; yy += 28) for (let xx = (yy / 28) % 2 ? 14 : 0; xx < W; xx += 28) { g.beginPath(); g.arc(xx, yy, 3, 0, 7); g.fill(); }
  const ka = withArt && x.keyArt ? await loadCorsImage(x.keyArt) : null;
  if (ka) { const kh = W * ka.height / ka.width; g.globalAlpha = 0.5; g.drawImage(ka, 0, 0, W, kh); g.globalAlpha = 1; const fade = g.createLinearGradient(0, kh * 0.35, 0, kh); fade.addColorStop(0, "rgba(18,13,58,0)"); fade.addColorStop(1, "rgba(18,13,58,1)"); g.fillStyle = fade; g.fillRect(0, 0, W, kh + 2); }
  const c = x.topKey ? card(x.topKey) : null; const img = withArt && c && !c.custom ? await loadCorsImage(variantArt(favVariant(x.topKey)) || c.art) : null;
  if (img) { const s = Math.min(420 / img.width, 560 / img.height), w = img.width * s, h = img.height * s; g.globalAlpha = 0.95; g.drawImage(img, W - 60 - w, 230 + (560 - h) / 2, w, h); g.globalAlpha = 1; }
  g.fillStyle = "#FFD23F"; g.font = "italic 800 46px system-ui, sans-serif"; g.fillText("MY MARVEL SNAP", 60, 100);
  g.fillStyle = "#FFFFFF"; g.font = "800 64px system-ui, sans-serif"; g.fillText(String(x.label).slice(0, 26), 60, 172);
  if (S.me.handle) { g.fillStyle = "#C9C3EE"; g.font = "600 30px system-ui, sans-serif"; g.fillText(S.me.handle.slice(0, 30), 60, 216); }
  const stat = (k, v, y, color = "#FFFFFF") => { g.fillStyle = "#A39DC9"; g.font = "700 26px system-ui, sans-serif"; g.fillText(k.toUpperCase(), 60, y); g.fillStyle = color; g.font = "800 72px system-ui, sans-serif"; g.fillText(v, 60, y + 72); };
  stat("Games", `${fmt(x.s.games)}`, 300); stat("Win rate", `${x.s.wr}%`, 430, "#3DD68C"); stat("Net cubes", signed(x.s.cubes), 560, x.s.cubes >= 0 ? "#8FE3FF" : "#FF5D7B"); stat("Record", `${x.s.w}-${x.s.l}${x.s.t ? "-" + x.s.t : ""}`, 690);
  const rows = [x.peak ? ["Peak rank", String(x.peak)] : null, x.deck ? ["Best deck", `${x.deck.name} (${x.deck.st.w}-${x.deck.st.l})`] : null, c ? ["Most played card", c.name] : null, x.loc ? ["Luckiest location", x.loc] : null, x.big ? ["Biggest win", `+${num(x.big.cubes)} cubes${x.big.oppName ? " vs " + x.big.oppName : ""}`] : null, x.streak >= 2 ? ["Longest win streak", String(x.streak)] : null, x.snapsWon ? ["Snapped and won", plural(x.snapsWon, "time")] : null, x.faced.length ? ["Faced most", x.faced.join(", ")] : null].filter(Boolean).slice(0, 5);
  let y = 850; rows.forEach(([k, v]) => { g.fillStyle = "#A39DC9"; g.font = "700 26px system-ui, sans-serif"; g.fillText(k.toUpperCase(), 60, y); g.fillStyle = "#FFFFFF"; g.font = "700 38px system-ui, sans-serif"; g.fillText(v.length > 40 ? v.slice(0, 39) + "…" : v, 60, y + 48); y += 92; });
  g.fillStyle = "#8E88B8"; g.font = "600 24px system-ui, sans-serif"; g.fillText("Made with SNAP Stat · unofficial fan app", 60, H - 40);
  return new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"); } catch (e) { rej(e); } });
}
const rc = { period: "", url: "", busy: false, blob: null };
function recapPeriods() { const ps = periods(); return ps.filter((p) => p.id === "all" || p.id === "ytd" || p.id.startsWith("s:") || p.id.startsWith("m:")).filter((p) => p.id === "all" || inPeriod(realMatches(), p).length); }
async function makeRecap() {
  const p = periodById(rc.period || (currentSeasonPeriod() || periods()[0]).id); rc.busy = true; refreshSheet();
  let blob = null; try { blob = await recapBlob(p, true); } catch { try { blob = await recapBlob(p, false); } catch { blob = null; } }
  if (rc.url) URL.revokeObjectURL(rc.url); rc.blob = blob; rc.url = blob ? URL.createObjectURL(blob) : ""; rc.busy = false; refreshSheet();
}
function recapSheet() {
  const ps = recapPeriods(); const cur = rc.period || (currentSeasonPeriod() || periods()[0]).id;
  return `${sheetHead("Your recap", "A picture of your season to share")}
    <label class="f">Period<select id="rc-period" data-rc="1">${ps.map((p) => `<option value="${esc(p.id)}" ${p.id === cur ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
    ${rc.busy ? `<p class="muted">Making the picture…</p>` : rc.url ? `<img src="${rc.url}" alt="Your recap picture" style="width:100%;border-radius:12px;border:1px solid var(--line)">` : `<p class="note">Couldn't make the picture.</p>`}
    <div class="grid2"><button class="btn snap" data-a="recapShare" ${rc.blob ? "" : "disabled"}>Share</button><button class="btn" data-a="recapSave" ${rc.blob ? "" : "disabled"}>Save picture</button></div>`;
}
async function shareBlob(blob, name, title) {
  const file = new File([blob], name, { type: blob.type || "image/png" });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  saveBlob(blob, name);
}
function saveBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); toast("Saved " + name); }

/* ---------- Achievements ---------- */
function badgeCtx() {
  const ms = realMatches(), st = streaks();
  const decks = {}; ms.forEach((m) => { const k = m.deckId || m.deckName; if (k) decks[k] = (decks[k] || 0) + 1; });
  const modesWon = new Set(ms.filter((m) => m.result === "W").map(modeOf)).size;
  let albumsDone = 0; if (ALB) for (const k of Object.keys(ALB.albums)) { const a = albumInfo(k); if (a.goal && a.have >= a.goal) albumsDone++; }
  const champs = Object.values(tourneys).filter((t) => t && t.status === "done" && t.kind !== "challenge" && (tChampion(t) || {}).uid === store.uid).length;
  const cl = climbNow();
  return { wins: ms.filter((m) => m.result === "W").length, games: ms.length, bestWin: st.bestWin, bestDays: st.bestDays, big: ms.some((m) => num(m.cubes) >= 8) ? 1 : 0, bluff: ms.filter((m) => m.oppSnapped && !m.retreated && m.result === "W").length,
    inf: /^inf/i.test(String(S.me.rank)) || rankFromStr(peakAllTime()) >= 100 || (cl && cl.inf) ? 1 : 0, tracked: ms.filter((m) => m.tracked).length, decks5: Object.values(decks).filter((n) => n >= 5).length,
    owned: Object.keys(S.owned).length, vars: S.variants.filter((v) => v.owned).length, albumsDone, champs, modesWon, rivals: Object.keys(obj(S.opp)).length };
}
const BADGES = [
  { id: "win1", name: "First win", d: "Win a match", v: (x) => x.wins, goal: 1 }, { id: "win100", name: "Centurion", d: "Win 100 matches", v: (x) => x.wins, goal: 100 },
  { id: "win500", name: "Veteran", d: "Win 500 matches", v: (x) => x.wins, goal: 500 }, { id: "win1000", name: "Legend", d: "Win 1,000 matches", v: (x) => x.wins, goal: 1000 },
  { id: "games1000", name: "Dedicated", d: "Play 1,000 matches", v: (x) => x.games, goal: 1000 }, { id: "streak5", name: "Hot streak", d: "Win 5 in a row", v: (x) => x.bestWin, goal: 5 },
  { id: "streak10", name: "Unstoppable", d: "Win 10 in a row", v: (x) => x.bestWin, goal: 10 }, { id: "big8", name: "Big snap", d: "Win 8 cubes in one game", v: (x) => x.big, goal: 1 },
  { id: "bluff10", name: "Called the bluff", d: "Win 10 games where they snapped", v: (x) => x.bluff, goal: 10 }, { id: "inf", name: "Infinite", d: "Reach Infinite rank", v: (x) => x.inf, goal: 1 },
  { id: "days7", name: "Regular", d: "Play 7 days in a row", v: (x) => x.bestDays, goal: 7 }, { id: "track50", name: "Tactician", d: "Track 50 matches live", v: (x) => x.tracked, goal: 50 },
  { id: "decks10", name: "Deck builder", d: "Play 5+ games with 10 decks", v: (x) => x.decks5, goal: 10 }, { id: "modes3", name: "Explorer", d: "Win in 3 different modes", v: (x) => x.modesWon, goal: 3 },
  { id: "own300", name: "Collector", d: "Own 300 cards", v: (x) => x.owned, goal: 300 }, { id: "own500", name: "Completionist", d: "Own 500 cards", v: (x) => x.owned, goal: 500 },
  { id: "vars100", name: "Variant hunter", d: "Own 100 variants", v: (x) => x.vars, goal: 100 }, { id: "album1", name: "Album complete", d: "Finish a variant album", v: (x) => x.albumsDone, goal: 1 },
  { id: "champ", name: "Champion", d: "Win a tournament", v: (x) => x.champs, goal: 1 },
];
function earnedBadges(ctx = badgeCtx()) { return BADGES.filter((b) => b.v(ctx) >= b.goal).map((b) => b.id); }
function badgesHtml() {
  const x = badgeCtx(); const got = BADGES.filter((b) => b.v(x) >= b.goal);
  return `<section class="sec"><div class="sec-h"><h2>Achievements</h2><span class="muted small">${got.length} of ${BADGES.length}</span></div><div class="badges">${BADGES.map((b) => { const v = Math.min(b.v(x), b.goal), on = v >= b.goal; return `<div class="badge-c ${on ? "on" : ""}"><b>${esc(b.name)}</b><span class="small muted">${esc(b.d)}</span>${on ? `<span class="pill W">Earned</span>` : b.goal > 1 ? `${progBar(v, b.goal)}<span class="small muted num">${fmt(v)} / ${fmt(b.goal)}</span>` : `<span class="pill dim">Not yet</span>`}</div>`; }).join("")}</div>
    <p class="muted small">Earned achievements show on your profile when it's shared.</p></section>`;
}
function badgeChips(ids) { const list = arr(ids).map((id) => BADGES.find((b) => b.id === id)).filter(Boolean); return list.length ? `<div class="chiplist">${list.map((b) => `<span class="pill gold" title="${esc(b.d)}">${esc(b.name)}</span>`).join("")}</div>` : ""; }

/* ---------- Community deck tier list ---------- */
function myTopDecks() {
  const ms = realMatches().filter((m) => m.ts >= Date.now() - 30 * DAY && m.deckId); const by = {};
  ms.forEach((m) => (by[m.deckId] = by[m.deckId] || []).push(m));
  return Object.entries(by).map(([id, l]) => ({ d: S.decks.find((x) => x.id === id), l })).filter((x) => x.d && x.l.length >= 3 && x.d.cards.length >= 10).sort((a, b) => b.l.length - a.l.length).slice(0, 5)
    .map(({ d, l }) => { const s = statsFor(l); return { n: String(d.name).slice(0, 40), c: d.cards.filter((k) => !String(k).startsWith("custom:") && /^[a-z0-9]+$/.test(k)).sort(), w: s.w, l: s.l }; });
}
let _tierSig = "", _tier = [];
function tierRows() {
  const sig = `${sharedVer}|${store.uid}`; if (sig === _tierSig) return _tier;
  const g = new Map();
  for (const [id, p] of Object.entries(shared.profiles)) {
    if (!canSee(id) || (id !== store.uid && isMuted(id)) || (id !== store.uid && num(p.updated) < Date.now() - 30 * DAY)) continue;
    for (const d of arr(p.td)) { const c = arr(d.c); if (c.length < 10) continue; const k = c.join(","); const x = g.get(k) || { c, names: {}, w: 0, l: 0, players: new Set() }; x.w += num(d.w); x.l += num(d.l); x.players.add(id); x.names[d.n] = (x.names[d.n] || 0) + 1; g.set(k, x); }
  }
  _tier = [...g.values()].filter((x) => x.w + x.l >= 10).map((x) => { const wr = pct(x.w, x.w + x.l); const name = Object.entries(x.names).sort((a, b) => b[1] - a[1])[0][0]; return { ...x, wr, name, tier: wr >= 60 ? "S" : wr >= 55 ? "A" : wr >= 50 ? "B" : "C", type: archetypeOf(x.c.map((k) => card(k).name)) }; }).sort((a, b) => b.wr - a.wr);
  _tierSig = sig; return _tier;
}
function tierListHtml() {
  if (store.mode !== "cloud") return "";
  const rows = tierRows();
  if (!rows.length) return `<h3>SNAP Stat tier list</h3><p class="muted small">Decks show up here once players with shared profiles log 10 or more games with them in the last 30 days.</p>`;
  return `<h3>SNAP Stat tier list</h3><p class="muted small">Win rates from SNAP Stat players' logged games in the last 30 days (10+ games per deck).</p>
    ${["S", "A", "B", "C"].map((t) => { const l = rows.filter((r) => r.tier === t); return l.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">Tier ${t}</span><div class="list">${l.slice(0, 8).map((r) => `<button class="li" data-a="tierOpen" data-k="${esc(r.c.join(","))}"><span class="pill ${t === "S" || t === "A" ? "gold" : "dim"}">${t}</span><div class="grow" style="min-width:0"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.type)} · ${r.w + r.l} games · ${plural(r.players.size, "player")}</div></div><span class="num">${r.wr}%</span></button>`).join("")}</div></div>` : ""; }).join("")}`;
}
let tierKey = "";
function tierSheet() {
  const r = tierRows().find((x) => x.c.join(",") === tierKey); if (!r) return sheetHead("Deck not found");
  const own = r.c.filter((k) => S.owned[k]).length;
  return `${sheetHead(esc(r.name), `Tier ${r.tier} · ${r.wr}% over ${r.w + r.l} games · ${plural(r.players.size, "player")}`)}
    <div class="chiplist">${[...r.c].sort((a, b) => num(card(a).cost) - num(card(b).cost)).map((k) => cardChip(k, { a: "cardOpen" })).join("")}</div>
    <p class="small muted">You own ${own} of ${r.c.length} · avg cost ${avgCost(r.c)}</p>${curveHtml(r.c)}
    <button class="btn snap" data-a="tierSave">Save to my decks</button>`;
}

/* ---------- Friend challenges (a two-player tournament) ---------- */
const chl = { bestOf: 3, note: "", to: "" };
function challengeSheet() {
  const p = prof(chl.to) || {};
  const c = (v, l) => `<button class="chip" data-a="chlBest" data-v="${v}" aria-pressed="${chl.bestOf === v}">${l}</button>`;
  return `${sheetHead("Challenge " + esc(p.handle || "player"), "Play Friendly battles in the game; the result fills in from both your logs")}
    <span class="eyebrow">Match</span><div class="chips">${c(1, "One game")}${c(3, "Best of 3")}${c(5, "Best of 5")}</div>
    <label class="f">Stakes or message (optional)<input type="text" id="chl-note" maxlength="80" placeholder="Loser posts a GG" value="${esc(chl.note)}"></label>
    <button class="btn snap" data-a="chlSend">Send challenge</button>
    <p class="muted small">They'll see it on their Home screen. Log your games against “${esc(p.handle || "them")}” in Home › Live match.</p>`;
}
function challengesHomeHtml() {
  if (store.mode !== "cloud") return "";
  const mine = Object.entries(tourneys).filter(([, t]) => t && t.kind === "challenge" && t.status === "live" && arr(t.players).some((x) => x.uid === store.uid));
  if (!mine.length) return "";
  return `<section class="sec"><h2>Challenges</h2><div class="list">${mine.map(([id, t]) => { const opp = arr(t.players).find((x) => x.uid !== store.uid) || {}; const incoming = t.by !== store.uid; return `<button class="li" data-a="tourneyOpen" data-id="${esc(id)}"><span class="pill ${incoming ? "gold" : "dim"}">${incoming ? "New" : "Sent"}</span><div class="grow" style="min-width:0"><div class="t">${incoming ? `${esc(t.byHandle)} challenged you` : `You challenged ${esc(opp.handle)}`}</div><div class="s">Best of ${num(t.bestOf) || 1}${t.note ? " · " + esc(t.note) : ""}</div></div><span class="muted">›</span></button>`; }).join("")}</div></section>`;
}

/* ---------- Spreadsheets (CSV) ---------- */
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csvRows = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
function matchesCsv() {
  const head = ["Date", "Time", "Result", "Cubes", "Mode", "Deck", "Opponent", "Their cards", "You snapped", "Snap turn", "They snapped", "You retreated", "They retreated", "Final turn", "Location 1", "Your power 1", "Their power 1", "Location 2", "Your power 2", "Their power 2", "Location 3", "Your power 3", "Their power 3", "Bot", "Tracked live", "Notes"];
  const rows = realMatches().map((m) => { const d = new Date(m.ts); const L = arr(m.locs); const loc = (i) => (L[i] ? [L[i].name, L[i].my, L[i].opp] : ["", "", ""]);
    return [localDate(m.ts), d.toTimeString().slice(0, 5), { W: "Win", L: "Loss", T: "Tie" }[m.result] || m.result, num(m.cubes), modeOf(m), m.deckName || "", m.oppName || "", arr(m.oppCards).join("; "), m.snapped ? "yes" : "", num(m.snapTurn) || "", m.oppSnapped ? "yes" : "", m.retreated ? "yes" : "", m.oppRetreated ? "yes" : "", num(m.turn) || "", ...loc(0), ...loc(1), ...loc(2), m.bot === "likely" ? "likely" : "", m.tracked ? "yes" : "", m.notes || ""]; });
  return csvRows([head, ...rows]);
}
function collectionCsv() {
  const own = {}; S.variants.forEach((v) => { if (v.owned) own[v.card] = (own[v.card] || 0) + 1; });
  const rows = allCards().filter((c) => !c.custom && !c.upcoming).sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.name, c.cost, c.power, seriesOf(c), S.owned[c.key] ? "yes" : "", S.wishCards[c.key] ? "yes" : "", own[c.key] || 0, num(obj(obj(S.splits)[c.key]).n) || "", c.ability || ""]);
  return csvRows([["Card", "Cost", "Power", "Series", "Owned", "Wishlist", "Variants owned", "Splits", "Ability"], ...rows]);
}
async function downloadCsv(name, text) {
  const data = "﻿" + text;
  if (store.downloads) { try { const r = await store.downloads.save({ filename: name, data: store.provider === "firebase" ? new Blob([data], { type: "text/csv" }) : data }); if (r && r.status === "saved") { toast("Saved " + name); return; } } catch { /* try a plain download */ } }
  saveBlob(new Blob([data], { type: "text/csv" }), name);
}

/* ---------- Looks: colors and light/dark ---------- */
const LOOKS = {
  classic: { name: "Classic gold", a: "#FFD23F", b: "#FF7A1A" },
  cosmic: { name: "Cosmic", a: "#D7B8FF", b: "#8A4DFF", text: "#C9A7FF", lightText: "#6A35E8", g1: "rgba(150, 80, 255, .34)", g2: "rgba(255, 80, 200, .14)" },
  hulk: { name: "Gamma green", a: "#C4F75F", b: "#2FB24A", text: "#B5F06A", lightText: "#2E7D32", g1: "rgba(60, 200, 90, .22)", g2: "rgba(150, 255, 80, .10)" },
  spider: { name: "Spider red", a: "#FF8A80", b: "#D7263D", ink: "#FFFFFF", text: "#FF8A8A", lightText: "#C21F35", g1: "rgba(215, 38, 61, .26)", g2: "rgba(40, 90, 255, .16)" },
  ice: { name: "Frost blue", a: "#B5EEFF", b: "#3A8DFF", text: "#9BE7FF", lightText: "#1769C2", g1: "rgba(58, 141, 255, .28)", g2: "rgba(150, 240, 255, .14)" },
  symbiote: { name: "Symbiote", a: "#FFFFFF", b: "#A4ABBD", text: "#E8EAF2", lightText: "#2B2F3A", g1: "rgba(160, 170, 200, .16)", g2: "rgba(255, 255, 255, .06)" },
  phoenix: { name: "Phoenix", a: "#FFE17A", b: "#FF3D2E", text: "#FFB36B", lightText: "#C2410C", g1: "rgba(255, 90, 30, .26)", g2: "rgba(255, 200, 60, .14)" },
};
let _lookSig = "";
function applyLook() {
  const L = obj(S.look), mode = ["dark", "light"].includes(L.mode) ? L.mode : "auto", key = LOOKS[L.accent] ? L.accent : "classic";
  const sig = mode + "|" + key; if (sig === _lookSig) return; _lookSig = sig;
  const root = document.documentElement; if (mode === "auto") delete root.dataset.theme; else root.dataset.theme = mode;
  let st = document.getElementById("look-style"); if (!st) { st = document.createElement("style"); st.id = "look-style"; document.head.appendChild(st); }
  const t = LOOKS[key];
  if (key === "classic") { st.textContent = ""; return; }
  const soft = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
  const light = `--snap-text: ${t.lightText}; --snap-soft: ${soft(t.lightText, 0.12)};`;
  st.textContent = `:root { --snap-a: ${t.a}; --snap-b: ${t.b}; --snap-text: ${t.text}; --snap-soft: ${soft(t.text, 0.14)}; ${t.ink ? `--snap-ink: ${t.ink};` : ""} ${t.g1 ? `--glow-1: ${t.g1}; --glow-2: ${t.g2};` : ""} }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ${light} } }
:root[data-theme="light"] { ${light} }`;
}
function lookHtml() {
  const L = obj(S.look), mode = ["dark", "light"].includes(L.mode) ? L.mode : "auto", key = LOOKS[L.accent] ? L.accent : "classic";
  const m = (v, l) => `<button data-a="lookMode" data-v="${v}" aria-pressed="${mode === v}">${l}</button>`;
  return `<section class="sec"><h2>Look</h2><div class="panel stack small"><span class="eyebrow">Colors</span>
    <div class="chiplist">${Object.entries(LOOKS).map(([k, t]) => `<button class="chip swatch" data-a="lookAccent" data-v="${k}" aria-pressed="${key === k}"><span class="sw" style="background:linear-gradient(135deg, ${t.a}, ${t.b})"></span>${esc(t.name)}</button>`).join("")}</div>
    <span class="eyebrow">Light or dark</span><div class="seg">${m("auto", "Auto")}${m("dark", "Dark")}${m("light", "Light")}</div>
    <span class="muted">Auto follows your phone's light or dark setting. Your look follows you to any device where you sign in.</span></div></section>`;
}

/* ---------- Actions and inputs ---------- */
Object.assign(A, {
  liveEnergy: (el) => { live.energy = { t: live.turn, v: clamp(liveEnergy(live) + num(el.dataset.v), 0, 20) }; saveLive(); render(); },
  rivalOpen: (el) => { rivalName = el.dataset.v; openSheet(rivalSheet); },
  voiceLog: () => startVoice(),
  coachOpen: () => openSheet(coachSheet),
  coachAsk: (el) => { const q = el.dataset.q || String(($("#coach-q") || {}).value || ""); coachAsk(q); },
  coachClear: () => { coach.msgs = []; coach.follow = []; refreshSheet(); },
  deckTest: () => { const d = deckEdit(); if (!d) return; const keys = d.cards.filter((k) => Number.isFinite(num(card(k).cost, NaN))); sims[d.id] = { sig: [...d.cards.filter((k) => !String(k).startsWith("custom:") || Number.isFinite(num(card(k).cost, NaN)))].sort().join(","), R: simulateDeck(keys) }; refreshSheet(); },
  goalNew: () => { Object.assign(gl, { kind: "gamesDay", target: 10, by: "" }); openSheet(goalSheet); },
  glKind: (el) => { gl.kind = el.dataset.v; gl.target = { gamesDay: 10, winsDay: 5, winsWeek: 25, cubesWeek: 40, snapWinsWeek: 5, rankBy: 100 }[gl.kind]; refreshSheet(); },
  goalSave: () => { const t = num(($("#gl-target") || {}).value); if (t < 1) { toast("Enter a number"); return; } const g = { id: uid(), kind: gl.kind, target: gl.kind === "rankBy" ? clamp(Math.round(t), 2, 100) : Math.round(t) }; if (gl.kind === "rankBy") { g.by = String(($("#gl-by") || {}).value || ""); if (!g.by) { toast("Pick a date"); return; } } S.goals = [...arr(S.goals), g].slice(-8); save(); closeSheet(); render(); saveNotifyState(); toast("Goal added"); },
  goalDel: (el) => { S.goals = arr(S.goals).filter((g) => g.id !== el.dataset.id); save(); render(); saveNotifyState(); },
  missionEdit: () => openSheet(missionEditSheet),
  missionAdd: () => { const v = String(($("#mi-add") || {}).value || "").trim().slice(0, 60); if (!v) return; const mi = missionState(); S.missions = { ...obj(S.missions), items: [...mi.items, { id: uid(), text: v }].slice(0, 12) }; save(); refreshSheet(); render(); },
  missionDel: (el) => { const mi = missionState(); const done = obj(obj(S.missions).done); S.missions = { ...obj(S.missions), items: mi.items.filter((x) => x.id !== el.dataset.id), done: { ...done, ids: arr(done.ids).filter((id) => id !== el.dataset.id) } }; save(); refreshSheet(); render(); },
  recapOpen: () => { rc.period = (currentSeasonPeriod() || periods()[0]).id; rc.url = ""; rc.blob = null; openSheet(recapSheet); makeRecap(); },
  recapShare: () => { if (rc.blob) shareBlob(rc.blob, `snap-stat-recap-${localDate(Date.now())}.png`, "My MARVEL SNAP recap"); },
  recapSave: () => { if (rc.blob) saveBlob(rc.blob, `snap-stat-recap-${localDate(Date.now())}.png`); },
  tierOpen: (el) => { tierKey = el.dataset.k; openSheet(tierSheet); },
  tierSave: () => { const r = tierRows().find((x) => x.c.join(",") === tierKey); if (!r) return; const d = newDeck(r.name, r.c); closeSheet(); render(); openDeck(d.id); toast("Deck saved"); },
  challengeOpen: (el) => { if (!S.me.handle.trim()) { toast("Add your in-game name first"); openSheet(onboardSheet); return; } Object.assign(chl, { bestOf: 3, note: "", to: el.dataset.id }); openSheet(challengeSheet); },
  chlBest: (el) => { chl.bestOf = num(el.dataset.v); chl.note = String(($("#chl-note") || {}).value || ""); refreshSheet(); },
  chlSend: () => {
    const p = prof(chl.to); if (!p || !p.handle) { toast("That player isn't available"); return; }
    const note = String(($("#chl-note") || {}).value || "").trim().slice(0, 80); const me = S.me.handle.trim().slice(0, 40);
    const id = uid(); const t = { name: `${me} vs ${String(p.handle).slice(0, 40)}`.slice(0, 60), kind: "challenge", note, by: store.uid, byHandle: me, created: Date.now(), started: Date.now(), status: "live", bestOf: chl.bestOf, max: 2, alliance: "", players: [{ uid: store.uid, handle: me }, { uid: chl.to, handle: String(p.handle).slice(0, 40) }], removed: [], matches: buildBracket(2) };
    writeTourney(id, t); closeSheet(); render(); toast("Challenge sent");
  },
  csvMatches: () => downloadCsv(`snap-stat-matches-${localDate(Date.now())}.csv`, matchesCsv()),
  csvCollection: () => downloadCsv(`snap-stat-collection-${localDate(Date.now())}.csv`, collectionCsv()),
  lookAccent: (el) => { S.look = { ...obj(S.look), accent: el.dataset.v }; save(); render(); },
  lookMode: (el) => { S.look = { ...obj(S.look), mode: el.dataset.v }; save(); render(); },
});
document.addEventListener("input", (e) => {
  const t = e.target, d = t.dataset;
  if (d.live === "oppName") { const b = $("#rival-box"); if (b) b.innerHTML = rivalLine(t.value); return; }
  if (d.mf === "oppName") { const b = $("#mf-rival"); if (b) b.innerHTML = rivalLine(t.value); return; }
  if (d.oppnote) { const r = rivalStats(rivalName); if (!r) return; S.opp = { ...obj(S.opp), [r.k]: { name: r.name, note: t.value.slice(0, 400) } }; if (!t.value.trim()) delete S.opp[r.k]; save(); return; }
  if (d.bind === "wallet.credits" || d.bind === "clGoal" || (d.bind === "me.colLevel" && t.id === "cp-cl")) { /* the credits section updates when you leave the field */ }
});
document.addEventListener("change", (e) => {
  const t = e.target, d = t.dataset;
  if (d.mission) { const mi = missionState(); const ids = new Set(mi.done); if (t.checked) ids.add(d.mission); else ids.delete(d.mission); S.missions = { ...obj(S.missions), items: mi.items, done: { day: missionDay(), ids: [...ids] } }; save(); saveNotifyState(); if (t.checked && mi.items.length && mi.items.every((x) => ids.has(x.id))) toast("Daily checklist done"); return; }
  if (d.rc) { rc.period = t.value; makeRecap(); return; }
  if (d.bind === "wallet.credits" || d.bind === "clGoal" || t.id === "cp-cl") { setTimeout(render, 0); }
});

/* ---------- Snap Pack helper (Card Shop) ---------- */
let PACKS = null, packVer = 0; const PACK_CACHE = "snapstat.packs";
function usePacks(j, fromCache) {
  if (!j || !Array.isArray(j.packs) || !j.packs.length) return false;
  if (PACKS && fromCache) return false;
  PACKS = { updated: String(j.updated || ""), packs: j.packs, old: obj(j.oldPacks), direct: obj(j.direct) }; packVer++;
  refreshView(); return true;
}
async function loadPacks() {
  if (!window.SNAPSTAT_STANDALONE) return;
  try { const c = localStorage.getItem(PACK_CACHE); if (c) usePacks(JSON.parse(c), true); } catch { /* no saved copy */ }
  for (const u of catUrls("packs.json")) {
    try {
      const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
      const text = await r.text(); const j = JSON.parse(text);
      if (PACKS && j.updated && j.updated === PACKS.updated) return;
      if (!usePacks(j, false)) continue;
      try { localStorage.setItem(PACK_CACHE, text); } catch { /* fetched again next time */ }
      return;
    } catch { /* try the next copy */ }
  }
}
function packPools() {
  if (!PACKS) return null;
  const today = localDate(Date.now()), keyOfId = (id) => (cardByCode(cardCode(id)) || {}).key;
  const seasonal = PACKS.packs.filter((p) => p.kind === "seasonal").map((p) => ({ ...p, id: p.slug, keys: [...new Set(arr(p.cards).map(keyOfId).filter(Boolean))] }));
  const inSeasonal = new Set(seasonal.flatMap((p) => p.keys));
  const old = [5, 4, 3].map((sr) => ({ id: "old" + sr, name: `Old Series ${sr}`, kind: "old", series: String(sr), price: num(PACKS.old[sr]) || { 5: 4000, 4: 2000, 3: 650 }[sr],
    keys: allCards().filter((c) => !c.upcoming && !c.custom && !c.catModeOnly && seriesOf(c) === "Series " + sr && !inSeasonal.has(c.key)).map((c) => c.key) }));
  const map = sfVarMap(); const byCat = new Map(allVariants().filter((v) => v.cat).map((v) => [v.cat, v]));
  const special = PACKS.packs.filter((p) => p.kind === "special" && (!p.end || p.end >= today)).map((p) => ({ ...p, id: p.slug, vars: arr(p.variants).map((vid) => { const cv = map.get(vid); return { vid, v: cv ? byCat.get(cv.cat) : null }; }) }));
  return { seasonal, old, special };
}
function packSummary(p) { const missing = p.keys.filter((k) => !S.owned[k]); return { missing, have: p.keys.length - missing.length }; }
function packHelperHtml() {
  const P = packPools();
  if (!P) return window.SNAPSTAT_STANDALONE ? `<section class="sec"><h2>Snap Packs</h2><p class="muted small">Pack prices and pools load from the daily card data. Check back in a moment.</p></section>` : "";
  const tokens = num(S.wallet.tokens), direct5 = num(PACKS.direct[5]) || 6000;
  const rows = [...P.seasonal, ...P.old].map((p) => ({ p, ...packSummary(p) }));
  const s5 = rows.find((r) => r.p.kind === "seasonal" && r.p.series === "5");
  let tip = "";
  if (s5 && s5.missing.length && tokens >= s5.p.price) tip = `Best bet right now: the <b>${esc(s5.p.name)}</b> pack. It's ${fmt(s5.p.price)} tokens for ${s5.missing.length > 1 ? `one of the ${s5.missing.length} new cards` : "the one new card"} you're missing, versus ${fmt(direct5)} to buy a specific one.`;
  else if (s5 && s5.missing.length) tip = `Save up for the ${esc(s5.p.name)} pack (${fmt(s5.p.price)} tokens): you're missing ${s5.missing.length} of its cards. You need ${fmt(s5.p.price - tokens)} more.`;
  else if (s5) tip = `You own every card in the ${esc(s5.p.name)} pack. Your tokens go further in an Old Series pack or a direct buy.`;
  const row = (r) => { const n = r.p.keys.length, can = r.missing.length && num(r.p.price) > 0 ? Math.min(r.missing.length, Math.floor(tokens / num(r.p.price))) : 0;
    return `<button class="li" data-a="packOpen" data-id="${esc(r.p.id)}"><div class="grow" style="min-width:0"><div class="t">${esc(r.p.name)} <span class="muted small">· ${fmt(r.p.price)} tokens</span></div><div class="s">${r.missing.length ? `Missing ${r.missing.length} of ${n}` : `You own all ${n}`}</div>${progBar(r.have, n, `${r.have} of ${n} owned`)}</div>${!r.missing.length ? `<span class="pill dim">Done</span>` : can ? `<span class="pill W">Can open ${can}</span>` : `<span class="pill dim">Save up</span>`}</button>`; };
  const want = new Set(S.variants.filter((v) => v.wish && !v.owned && v.cat).map((v) => v.cat));
  return `<section class="sec"><h2>Snap Packs</h2><p class="muted small">Each pack gives you a card you don't own from its pool, plus two bonus rolls. You have ${fmt(tokens)} tokens.</p>
    ${tip ? `<div class="panel small">${tip}</div>` : ""}<div class="list">${rows.map(row).join("")}</div>
    ${P.special.length ? `<h3>Variant packs</h3><div class="list">${P.special.map((p) => { const own = p.vars.filter((x) => x.v && x.v.owned).length, wished = p.vars.filter((x) => x.v && want.has(x.v.cat)).length, soon = p.start && p.start > localDate(Date.now());
      return `<button class="li" data-a="packOpen" data-id="${esc(p.id)}"><div class="grow" style="min-width:0"><div class="t">${esc(p.name)}${soon ? ` <span class="pill gold">Soon</span>` : ""}${wished ? ` <span class="pill gold">♥ ${wished}</span>` : ""}</div><div class="s">${fmt(p.price)} tokens${p.value ? ` · value ${num(p.value)}%` : ""}${p.start ? ` · ${esc(dayStr(dayStart(p.start)))}${p.end ? "–" + esc(dayStr(dayStart(p.end))) : ""}` : ""} · you own ${own} of ${p.vars.length}</div></div><span class="muted">›</span></button>`; }).join("")}</div>` : ""}
    <p class="muted small">Buying a specific card costs ${fmt(direct5)} tokens for Series 5 and ${fmt(num(PACKS.direct[4]) || 3000)} for Series 4. Pools come from snap.fan and the card data, so check the Card Shop before you spend.</p></section>`;
}
let packId = "";
function packSheet() {
  const P = packPools(); if (!P) return sheetHead("Pack not found");
  const p = [...P.seasonal, ...P.old, ...P.special].find((x) => x.id === packId); if (!p) return sheetHead("Pack not found");
  if (p.vars) return `${sheetHead(esc(p.name), `${fmt(p.price)} tokens${p.value ? ` · value ${num(p.value)}%` : ""}${p.start ? ` · ${esc(dateStr(p.start))} to ${esc(dateStr(p.end || p.start))}` : ""}`)}
    <div class="list">${p.vars.map((x) => (x.v ? variantRow(x.v) : `<div class="li muted small">${esc(x.vid.replace(/_(\d+)$/, " variant $1"))}</div>`)).join("")}</div><p class="muted small">Tick “Want” on the ones you're after. Each pack gives you one of these.</p>`;
  const s = packSummary(p);
  return `${sheetHead(esc(p.name), `${fmt(p.price)} tokens · ${s.missing.length ? `you're missing ${s.missing.length} of ${p.keys.length}` : `you own all ${p.keys.length}`}`)}
    ${s.missing.length ? `<span class="eyebrow">You'd get one of these</span><div class="chiplist">${s.missing.map((k) => cardChip(k, { a: "packTarget", on: packTarget === k })).join("")}</div>` : ""}
    ${packPlanHtml(p, s.missing)}
    ${s.have ? `<span class="eyebrow">Already yours</span><div class="chiplist">${p.keys.filter((k) => S.owned[k]).slice(0, 60).map((k) => cardChip(k, { a: "cardOpen", noOwn: true })).join("")}${s.have > 60 ? `<span class="muted small">and ${s.have - 60} more</span>` : ""}</div>` : ""}`;
}
Object.assign(A, { packOpen: (el) => { packId = el.dataset.id; packTarget = ""; openSheet(packSheet); }, packTarget: (el) => { packTarget = packTarget === el.dataset.k ? "" : el.dataset.k; refreshSheet(); } });
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id === "coach-q") { e.preventDefault(); coachAsk(e.target.value); } });
