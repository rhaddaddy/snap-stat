/* ============ Event currencies (Deadpool's Diner's Bubs and Nachos), and a play-by-play of each match from the
   tracker's picture of the board every turn ============ */

/* ---------- Event currencies: what each is called and what it's for ---------- */
// Known ones: Deadpool's Diner pays Bubs for playing matches and sells things for Nachos
const EVENT_CUR = { bubs: { name: "Bubs", use: "match" }, bub: { name: "Bubs", use: "match" }, nachos: { name: "Nachos", use: "shop" }, nacho: { name: "Nachos", use: "shop" } };
function curName(n) { const k = keyOf(n); return (EVENT_CUR[k] && EVENT_CUR[k].name) || String(n || "").trim().slice(0, 24); }
function curUse(c) { const k = keyOf(obj(c).name), u = String(obj(c).use || "").toLowerCase(); return (EVENT_CUR[k] && EVENT_CUR[k].use) || (u === "match" || u === "shop" ? u : ""); }
// Bubs (or another event currency) won in your matches since the event screen was last read
function eventGainLine(e) {
  const pr = obj(S.eventProg[e.id]), cur = arr(pr.curs).find((c) => c.use === "match"); if (!cur) return "";
  const ms = realMatches().filter((m) => m.eventGain && keyOf(curName(m.eventGain.name)) === keyOf(curName(cur.name)) && m.ts >= e.startTs);
  if (!ms.length) return "";
  const since = ms.filter((m) => m.ts > num(cur.at)).reduce((s, m) => s + num(m.eventGain.amount), 0);
  const all = ms.reduce((s, m) => s + num(m.eventGain.amount), 0);
  return `<span class="pill dim">+${fmt(all)} ${esc(cur.name)} from ${ms.length} logged match${ms.length === 1 ? "" : "es"}${since ? ` (${fmt(since)} since the Diner was last read)` : ""}</span>`;
}
function eventShopHtml(pr) {
  const shopCur = arr(pr.curs).find((c) => c.use === "shop"), have = shopCur ? num(shopCur.amount) : 0;
  const items = arr(pr.shop).slice().sort((a, b) => (a.sold ? 1 : 0) - (b.sold ? 1 : 0) || num(a.price) - num(b.price));
  return `<h3>The event's shop</h3><div class="list">${items.map((i) => { const can = !i.sold && shopCur && keyOf(i.currency || shopCur.name) === keyOf(shopCur.name) && num(i.price) > 0 && num(i.price) <= have;
      return `<div class="li"><div class="grow"><div class="t">${esc(i.name)}</div>${i.kind && i.kind !== "other" ? `<div class="s">${esc(KIND_TXT[i.kind] || i.kind)}</div>` : ""}</div>${i.price ? `<span class="num small">${fmt(i.price)} ${esc(i.currency || "")}</span>` : ""}${i.sold ? `<span class="pill dim">Bought</span>` : can ? `<span class="pill W">You can afford it</span>` : ""}</div>`; }).join("")}</div>
    ${shopCur ? `<span class="muted small">You have ${fmt(have)} ${esc(shopCur.name)}. From your screenshots of the event's shop${pr.shopAt ? `, ${esc(agoTxt(pr.shopAt))}` : ""}.</span>` : ""}`;
}

/* ---------- Play-by-play: the tracker saves the board each time you end a turn ---------- */
// That picture shows every card you've played so far (this turn's too) and the opponent's cards revealed before it,
// so comparing one turn's picture with the next shows what each of you played, where, and the Power each location has.
const TURN_PROMPT = (roster, hint) => `This is a MARVEL SNAP match in progress, just after the player (at the bottom) ended turn ${String(hint).slice(5) || "?"}. Read the board.
Valid card names (name cost/power): ${roster}
Reply as JSON: {"turn": the turn number shown (3/6 is 3) or null, "energy": the energy left in the player's energy circle or null, "locations": [{"name": "location name, or empty if not revealed yet", "my": the player's Power here (bottom number), "opp": the opponent's Power here (top number), "myCards": [{"card": "card name, from its art", "power": its Power, "variant": "its art variant if you can tell (artist or style), else empty", "finish": "its finish if it has one (like Ink or Gold), else empty", "flare": "its flare if showing, else empty", "border": "a special border, else empty"}], "oppCards": [{"card": "", "power": number, "variant": "", "finish": "", "flare": "", "border": ""}]}] (exactly three, left to right), "me": {"avatar": "the player's avatar: the character on it if you can tell", "cardback": "the player's card back on their deck pile: its name or the character on it"}, "opp": {"avatar": "the opponent's avatar", "title": "the opponent's title if shown", "cardback": "the opponent's card back if shown", "emotes": ["any emote the opponent is showing"]}, "hand": ["card names in the player's hand"], "oppName": "the opponent's name at the top if shown", "snapped": true if the cube shows the stakes were raised}
List only cards you can see. Never guess.`;
const TURNLOG_KEY = "snapstat.turnLog" + (SLOT ? "." + SLOT : "");
function turnLogs() { if (!turnLogs.c) { turnLogs.c = obj(lsGet(TURNLOG_KEY)); if (S.turnLog && typeof S.turnLog === "object") { Object.assign(turnLogs.c, S.turnLog); delete S.turnLog; lsSet(TURNLOG_KEY, turnLogs.c); } } return turnLogs.c; }
function applyTurnShot(x, t, time, hint, meta) {
  const sess = String(obj(meta).session || ""), n = num(obj(meta).turn) || num(t.turn) || num(String(hint).slice(5));
  if (!sess || !n) { x.status = "A picture from a match, but not which one"; save(); return; }
  const L = turnLogs();
  for (const [k, v] of Object.entries(L)) if (Date.now() - num(obj(v).at) > 2 * DAY) delete L[k];
  const locs = arr(t.locations).slice(0, 3).map((l) => ({ name: String(obj(l).name || "").slice(0, 40), my: nIn(obj(l).my), opp: nIn(obj(l).opp), myCards: turnCards(obj(l).myCards), oppCards: turnCards(obj(l).oppCards) }));
  const e = (L[sess] = obj(L[sess])); e.at = time || Date.now(); e.turns = obj(e.turns);
  e.turns[n] = { locs, energy: nIn(t.energy), at: time };
  if (t.oppName) e.oppName = String(t.oppName).slice(0, 40);
  e.me = mergeWho(e.me, t.me); e.opp = mergeWho(e.opp, t.opp);
  x.status = `Turn ${n} of a match`; x.detail = locs.map((l) => `${l.name || "?"} ${l.my ?? "?"}–${l.opp ?? "?"}`).join(" · ");
  // A match already logged from an earlier end picture gets the new turn too
  lsSet(TURNLOG_KEY, L);
  const m = realMatches().find((mm) => mm.session === sess); if (m) { attachTurns(m, { session: sess }, null); applyMatchLooks(m, null); putMatch(m); }
  save();
}
// Cards as the AI read them ({card, power…}), or as they were saved ({k, p…})
function turnCards(list) {
  return arr(list).map((c) => { const o = obj(c), f = o.k && !o.card ? { key: String(o.k) } : fuzzyCard(o.card); if (!f) return null; const x = { k: f.key, p: nIn(o.power ?? o.p) };
    for (const [from, to] of [["v", "v"], ["b", "b"], ["fi", "fi"], ["fl", "fl"]]) if (o[from] && !o.card) x[to] = String(o[from]).slice(0, 40);
    for (const [from, to] of [["variant", "v"], ["border", "b"], ["finish", "fi"], ["flare", "fl"]]) { const t = lookWord(o[from]); if (t) x[to] = t.slice(0, 40); }
    return x; }).filter(Boolean).slice(0, 8);
}
// What appeared on one side between two boards: [{k, p, loc}]
function boardDiff(a, b, side) {
  const at = (x) => [0, 1, 2].flatMap((i) => arr(obj(arr(x && x.locs)[i])[side]).map((c) => ({ ...c, loc: i })));
  const was = at(a), now = at(b), pool = was.map((c) => c.k), out = [];
  // Cards that stayed where they were first, then ones that moved; whatever's left is new this turn
  const left = now.filter((c) => { const j = was.findIndex((w, wi) => w.k === c.k && w.loc === c.loc && pool[wi] !== null); if (j >= 0) { pool[j] = null; return false; } return true; });
  for (const c of left) { const j = pool.indexOf(c.k); if (j >= 0) pool[j] = null; else out.push(c); }
  return out;
}
function buildTurns(log, mm, deckKeys) {
  const shots = Object.entries(obj(obj(log).turns)).map(([n, s]) => ({ n: Number(n), ...s })).sort((a, b) => a.n - b.n);
  if (!shots.length) return [];
  // The end screen shows the last board, with the opponent's final cards
  const endLocs = mm ? arr(mm.locations).slice(0, 3).map((l) => ({ name: String(obj(l).name || ""), my: nIn(obj(l).my), opp: nIn(obj(l).opp), myCards: turnCards(obj(l).myCards), oppCards: turnCards(obj(l).oppCards) })) : [];
  const end = endLocs.some((l) => l.myCards.length || l.oppCards.length) ? { n: shots[shots.length - 1].n + 1, locs: endLocs, end: true } : null;
  const names = (i) => { for (const s of [...shots].reverse()) { const nm = obj(arr(s.locs)[i]).name; if (nm) return nm; } return obj(endLocs[i]).name || `Location ${i + 1}`; };
  // Energy spent counts the cards from your deck (cards made during the match, like Rocks or Squirrels, cost nothing)
  const inDeck = new Set(arr(deckKeys)), spentOf = (list) => list.reduce((t, c) => t + (inDeck.size && !inDeck.has(c.k) ? 0 : card(c.k).cost === "?" ? 0 : num(card(c.k).cost)), 0);
  const out = [];
  shots.forEach((s, i) => {
    const prev = shots[i - 1] || null, next = shots[i + 1] || end;
    const mine = boardDiff(prev, s, "myCards");             // yours this turn (you see your own cards as you place them)
    const theirs = next ? boardDiff(s, next, "oppCards") : []; // theirs this turn, seen once they're revealed
    const spent = spentOf(mine);
    const pb = next || s; // the Power once this turn's cards were revealed
    // A missing picture: the turns it covers (yours before this one, theirs after it) are shown as a range
    out.push({ n: s.n, mine, theirs, theirsTo: next && !next.end && next.n > s.n + 1 ? next.n - 1 : 0, spent, left: s.energy, power: [0, 1, 2].map((j) => { const l = obj(arr(pb.locs)[j]); return { name: names(j), my: l.my, opp: l.opp }; }), gap: prev ? (s.n - prev.n > 1 ? prev.n + 1 : 0) : s.n > 1 ? 1 : 0 });
  });
  // Cards of yours on the final board that no turn picture showed (the last turn's, if it wasn't saved)
  if (end) { const last = shots[shots.length - 1], extra = boardDiff(last, end, "myCards"), fin = Math.max(num(obj(mm).turn) || 6, last.n); if (extra.length) out.push({ n: Math.min(end.n, fin), mine: extra, theirs: [], spent: spentOf(extra), left: null, power: [0, 1, 2].map((j) => ({ name: names(j), my: obj(end.locs[j]).my, opp: obj(end.locs[j]).opp })), gap: 0, final: true, same: Math.min(end.n, fin) === last.n }); }
  return out.slice(0, 10);
}
function attachTurns(m, meta, mm) {
  const sess = String(obj(meta).session || ""); if (!sess) return;
  m.session = sess; if (obj(meta).vs) m.vs = String(meta.vs).slice(0, 60);
  const log = turnLogs()[sess]; if (!log) return;
  const d = S.decks.find((x) => x.id === m.deckId);
  const t = buildTurns(log, mm || m.endBoard || null, d ? d.cards : null); if (t.length) m.turns = t;
  // The final board, kept small: card, Power and look for each location
  if (mm && arr(mm.locations).length) m.endBoard = { turn: num(mm.turn) || 0, locations: arr(mm.locations).slice(0, 3).map(obj).map((l) => ({ name: String(l.name || "").slice(0, 40), my: nIn(l.my), opp: nIn(l.opp), myCards: turnCards(l.myCards), oppCards: turnCards(l.oppCards) })) };
  if (!m.oppName && log.oppName) m.oppName = log.oppName;
}
function playByPlayHtml(m) {
  const turns = arr(m.turns); if (!turns.length) return "";
  const deck = S.decks.find((d) => d.id === m.deckId) || null;
  const chips = (list, mineSide) => list.map((c) => `<div class="stack" style="gap:2px;align-items:center;width:62px">${cardChip(c.k, { noOwn: true, pow: c.p ?? undefined, deck: mineSide ? deck : null, size: "xs" })}</div>`).join("");
  return `<div class="stack pbp" style="gap:8px"><span class="eyebrow">Play by play</span>${turns.map((t) => {
      const at = (list) => [0, 1, 2].map((j) => list.filter((c) => c.loc === j)).map((cs, j) => (cs.length ? `<div class="stack" style="gap:3px"><span class="muted small">${esc(t.power[j].name)}</span><div class="chiplist">${chips(cs, list === t.mine)}</div></div>` : "")).join("");
      return `<div class="panel stack small" style="gap:6px"><div class="row between"><b>${t.final ? (t.same ? `End of turn ${t.n}` : `Turn ${t.n}`) : t.gap ? `Turns ${t.gap}–${t.n}` : `Turn ${t.n}`}</b><span class="muted">${t.mine.length ? `spent ${t.spent} energy` : "you played nothing"}${t.left !== null && t.left !== undefined ? ` · ${t.left} left` : ""}</span></div>
        ${t.mine.length ? `<span class="small">You played</span><div class="row" style="align-items:flex-start;gap:12px">${at(t.mine)}</div>` : ""}
        ${t.theirs.length ? `<span class="small">They played${t.theirsTo ? ` (turns ${t.n}–${t.theirsTo})` : ""}</span><div class="row" style="align-items:flex-start;gap:12px">${at(t.theirs)}</div>` : ""}
        <span class="muted small">${t.power.map((p) => `${esc(p.name)} ${p.my ?? "?"}–${p.opp ?? "?"}`).join(" · ")}</span></div>`; }).join("")}
    ${m.session ? `<button class="btn sm ghost" data-a="reviewSession" data-id="${esc(m.session)}">See this match's pictures</button>` : ""}
    <span class="muted small">From the tracker's picture of the board each time you ended a turn. Their cards show on the turn they were revealed.</span></div>`;
}
Object.assign(A, {
  reviewSession: async (el) => { rv.session = el.dataset.id; rv.filter = "all"; await reviewOpen(true); },
  natTurnShots: (el) => { S.turnShots = el.dataset.v === "1"; save(); natRules(); render(); toast(S.turnShots ? "Each turn will be saved for the play-by-play" : "Turns won't be saved"); },
});
function turnShotsPanel() {
  if (!NATIVE) return "";
  const on = S.turnShots !== false;
  return `<div class="row between small"><span>Save the board each turn for a play-by-play <span class="muted">(about 6 more AI reads a match)</span></span><button class="btn sm ${on ? "snap" : "ghost"}" data-a="natTurnShots" data-v="${on ? "0" : "1"}" aria-pressed="${on}">${on ? "On" : "Off"}</button></div>`;
}
