/* ============ y22_live.js: live match helpers ============
   A "Match helper" section under the live tracker: the turn & energy line, a snap hint, retreat math, a turn-by-turn strip,
   draw odds for every card still in your deck, "watch out for" warnings from the opponent's cards, a rough count of their
   hand and deck, and a quick reference for the three locations. Plus post-match tags on the match form and a Tags panel in
   Home › Stats. Everything here is display-only help: nothing changes cubes or results on its own.
   Live state lives on `live` (saved by saveLive); only match tags (`m.tags`, a few short words) are saved with matches. */

/* ---------- Small shared reads of the live object ---------- */
const LIVE_MAX_CUBES = 8;
// The game's cube rule: 1 cube, doubled by each snap (max 8), doubled again when the final turn ends.
function liveStakes(L) {
  const snaps = (L.mySnap ? 1 : 0) + (L.oppSnap ? 1 : 0);
  const now = Math.min(LIVE_MAX_CUBES, Math.pow(2, snaps));   // what retreating right now costs
  const end = Math.min(LIVE_MAX_CUBES, now * 2);              // what staying to the end costs or wins
  const more = Math.min(LIVE_MAX_CUBES, end * 2);             // the same after one more snap
  return { snaps, now, end, more, maxed: snaps >= 2 };
}
function liveLanes() {
  const lanes = [0, 1, 2].map((i) => locTotals(i));
  return { lanes, lead: lanes.filter((t) => t.my > t.opp).length, behind: lanes.filter((t) => t.my < t.opp).length, any: lanes.some((t) => t.my || t.opp) };
}
const liveOppNames = (L) => arr(L.opp).map((o) => card(o.key).name);
const liveDet = (k) => obj(ui.liveDet)[k];   // open/closed state of the collapsible panels (not saved)

/* ---------- 2. Turn & energy line ---------- */
function liveTurnLine(L) {
  const t = num(L.turn) || 1, last = num(L.lastTurn) || 6, e = liveEnergy(L), extra = e > t;
  const bits = [`Turn ${t} of ${last}`, `${e} energy`];
  if (last === 7) bits.push(t === 7 ? "Limbo turn" : "7-turn game");
  if (t >= last) bits.push("final turn");
  return `<div class="row between nowrap"><b class="lv-turn">${esc(bits.join(" · "))}</b><button class="chip" data-a="liveExtraEnergy" aria-pressed="${extra}" aria-label="Extra energy this turn">+1 energy</button></div>
    <span class="muted">${t >= last ? "Cubes double when this turn ends." : extra ? `Counting ${e - t} extra energy this turn (a ramp card or location).` : "Tap +1 energy when a ramp card or location gives you more this turn."}</span>`;
}

/* ---------- 4. Snap hint: one sentence from the lanes, the turn and the snaps ---------- */
function liveSnapHint(L) {
  const { lead, behind, any } = liveLanes(), st = liveStakes(L), t = num(L.turn) || 1, last = num(L.lastTurn) || 6;
  const cube = (n) => `${n} cube${n === 1 ? "" : "s"}`;
  let txt;
  if (!any) txt = "Add your plays and theirs to the board and this hint reads the lanes for you.";
  else if (lead >= 2 && !L.mySnap && !L.oppSnap) txt = `You lead ${lead} lanes and they haven't snapped, so consider snapping.`;
  else if (lead >= 2 && L.oppSnap && !L.mySnap) txt = `You still lead ${lead} lanes after their snap, so snapping back would make it ${cube(st.more)} if the board holds.`;
  else if (lead >= 2) txt = `You lead ${lead} lanes with your snap in, so stay and watch for a turn-${last} swing.`;
  else if (behind >= 2 && t >= last - 1) txt = `Behind in ${behind} lanes on turn ${t}: retreating saves ${cube(st.end - st.now)} (you'd lose ${st.now} now instead of ${st.end}).`;
  else if (behind >= 2 && L.oppSnap) txt = `They snapped and lead ${behind} lanes, so retreating now costs ${cube(st.now)} instead of ${st.end} at the end.`;
  else if (behind >= 2) txt = `Behind in ${behind} lanes, but it's only turn ${t}, so hold off and see what you draw.`;
  else txt = `${lead === behind ? "Even board" : lead > behind ? "Slightly ahead" : "Slightly behind"} on turn ${t}, so hold your snap until you lead two lanes.`;
  return `<div class="note lv-hint"><b>Hint:</b> ${esc(txt)}</div>`;
}

/* ---------- 5. Retreat math: three boxes (retreat now, play it out, one more snap) ---------- */
function liveRetreatChips(L) {
  const st = liveStakes(L), final = num(L.turn) >= num(L.lastTurn);
  const cell = (l, n, sub) => `<div class="lvc"><span class="muted">${l}</span>${cubes(n)}${sub ? `<span class="muted">${sub}</span>` : ""}</div>`;
  const third = st.maxed ? cell("Both snapped", st.end, "the most") : cell(L.oppSnap ? "If you snap" : "If they snap", st.more);
  return `<div class="lv-cubes" role="group" aria-label="Cubes at stake">${cell("Retreat now", st.now)}${cell(final ? "At the end" : "Play it out", st.end)}${third}</div>`;
}

/* ---------- 9. Their hand and deck, roughly ---------- */
function liveTheirCards(L) {
  const seen = arr(L.opp).filter((o) => o.zone !== "hand").length, known = arr(L.opp).filter((o) => o.zone === "hand").length;
  const hand = clamp(num(L.oppHand), 0, 12), left = clamp(12 - seen - hand, 0, 12);
  return `<span>They hold about <b class="num">${hand}</b> card${hand === 1 ? "" : "s"}${known ? ` (${known} known)` : ""} · about <b class="num">${left}</b> left in their deck <span class="muted">(12 − ${seen} seen − ${hand} in hand)</span></span>`;
}

/* ---------- 1. Draw odds for the cards still in your deck ---------- */
// Chance that at least one of k wanted cards shows up in d draws from n cards
function drawAnyPct(n, k, d) {
  if (!n || !k || !d) return 0; if (k >= n || d >= n) return 100;
  let miss = 1; for (let i = 0; i < d; i++) miss *= (n - k - i) / (n - i);
  return Math.round((1 - Math.max(0, miss)) * 100);
}
function liveDrawOdds(L) {
  const open = liveDet("odds") !== false;
  const keys = Object.entries(L.my).filter(([, z]) => z === "deck").map(([k]) => k).sort((a, b) => num(card(a).cost) - num(card(b).cost) || card(a).name.localeCompare(card(b).name));
  const n = keys.length, left = Math.max(0, (num(L.lastTurn) || 6) - (num(L.turn) || 1));
  const wrap = (body, sub) => `<details class="panel small lv-det" data-livedet="odds" ${open ? "open" : ""}><summary><b>Draw odds</b> <span class="muted">· ${sub}</span></summary><div class="stack" style="margin-top:8px">${body}</div></details>`;
  if (!Object.keys(L.my).length) return wrap(`<span class="muted">Start a match with one of your decks and you'll see the chance of drawing each card.</span>`, "no deck picked");
  if (!n) return wrap(`<span class="muted">Every card is drawn. Nothing left in your deck.</span>`, "deck empty");
  if (!left) return wrap(`<span class="muted">No draws left this game. ${n} card${n === 1 ? "" : "s"} stay${n === 1 ? "s" : ""} in your deck.</span>`, `${n} in deck · no draws left`);
  const each = Math.round(100 / n), byEnd = Math.round(Math.min(1, left / n) * 100), nextTurn = (num(L.turn) || 1) + 1;
  const groups = []; keys.forEach((k) => { const c = num(card(k).cost); const g = groups.find((x) => x.cost === c); if (g) g.ks.push(k); else groups.push({ cost: c, ks: [k] }); });
  const rows = groups.map((g) => `<tr><td><div class="chiplist">${g.ks.map((k) => cardChip(k, { noOwn: true, text: true })).join("")}</div></td><td class="n"><b>${drawAnyPct(n, g.ks.length, 1)}%</b>${g.ks.length > 1 ? `<div class="muted">one of ${g.ks.length}</div>` : ""}</td></tr>`).join("");
  const playable = keys.filter((k) => num(card(k).cost, 99) <= nextTurn).length;
  return wrap(`<span>Each card left: <b>${each}%</b> next turn · <b>${byEnd}%</b> by turn ${num(L.lastTurn) || 6}</span>
    <div class="tbl-wrap"><table class="lv-odds"><thead><tr><th>Still in your deck, by cost</th><th class="n">Next turn</th></tr></thead><tbody>${rows}</tbody></table></div>
    <span class="muted">${playable} of ${n} cost ${nextTurn} or less, so ${drawAnyPct(n, playable, 1)}% of the time your next draw is playable right away. One draw a turn; card-draw effects raise these.</span>`,
    `${n} in deck · ${plural(left, "draw")} left`);
}

/* ---------- 3. Watch out for: rules from their deck type and the cards they've shown ---------- */
// Deck type (from archetypeOf) → one line of advice
const LIVE_ARCH_TIPS = {
  Destroy: "Destroy deck: expect Killmonger or Shang-Chi. Don't flood 1-Costs or lean on one 10+ power card.",
  Discard: "Discard deck: Hela or Apocalypse can land late. Watch for Sword Master and Blade.",
  Move: "Move deck: Vision, Nightcrawler and Heimdall shift power on turn 6. A lane you lead may not stay yours.",
  Ongoing: "Ongoing deck: Enchantress or Rogue beat it. Expect Spectrum on turn 6.",
  Buff: "Buff deck: their small cards grow fast (Ka-Zar, Blue Marvel). Count the buffs before you commit.",
  Ramp: "Ramp deck: expect a big card a turn early (Wave, Electro, Sunspot).",
  Disrupt: "Disruption deck: expect Cosmo, Enchantress or Leech to turn off your tricks.",
  "Card generation": "They make extra cards: expect more plays than usual and surprises on the last turn.",
  "Gives you cards": "They put cards in your hand or deck. Watch for Black Widow and Debrii clogging you.",
  Location: "They play around locations: expect Storm, Rhino or Scarlet Witch to change a lane.",
  "Low-cost": "Cheap deck: expect several plays on turn 6. Killmonger punishes them.",
  "High-cost": "Big deck: their turn-6 play decides it. Keep a Shang-Chi or Enchantress answer.",
};
// A card they've shown → the partner or play to expect (keyOf the name → text)
const LIVE_CARD_TIPS = {
  wong: "Wong seen: Odin, Black Panther or Hazmat next, and their On Reveals fire twice.",
  zabu: "Zabu seen: cheap 4-Costs incoming (Shang-Chi, Enchantress, Jubilee).",
  mystique: "Mystique copies their last Ongoing card. A second Iron Man or Patriot is possible.",
  galactus: "Galactus seen: Knull or Death follows. Keep power in the lane that survives.",
  wave: "Wave seen: every card costs 4 next turn, so a big card is coming early.",
  electro: "Electro seen: one card a turn for them, but big ones (Doom, Death, Infinaut).",
  sera: "Sera seen: a flood of cheap cards on turn 6.",
  dracula: "Dracula seen: they'll discard a big card at the end (Apocalypse, Infinaut).",
  hela: "Hela seen: discarded big cards come back. Count what they've discarded.",
  swarm: "Swarm seen: cheap copies will flood a lane late.",
  death: "Death seen: it gets cheaper with every destroy. Expect it late.",
  knull: "Knull seen: its power is everything destroyed so far. Don't fuel it.",
  killmonger: "Killmonger already played: your 1-Costs are safer now.",
  shangchi: "Shang-Chi already played: your big cards are safer now.",
  enchantress: "Enchantress already played: your Ongoing cards are safer now.",
  cosmo: "Cosmo shuts off On Reveals in its lane. Play your reveals elsewhere.",
  professorx: "Professor X locks a lane. Commit early where you want to win.",
  storm: "Storm floods a lane after next turn. Commit early or skip it.",
  daredevil: "Daredevil shows them your turn-5 play. Expect a counter.",
  alioth: "Alioth seen: they'll end on a lane they lead. Don't trust a late swing there.",
  leader: "Leader copies your turn-6 plays. Spread power or play around it.",
  leech: "Leech seen: your hand loses abilities. Play key cards before it lands.",
  magneto: "Magneto pulls your 3- and 4-Costs. Plan the lane they'd go to.",
  aero: "Aero moves your last card. Play what you want moved last.",
  rogue: "Rogue steals an Ongoing. Keep your best Ongoing out of open lanes.",
  redguardian: "Red Guardian flattens a card with less power than it. Don't lean on one small buff.",
  patriot: "Patriot seen: no-ability cards grow. Mystique or Onslaught doubles it.",
  cerebro: "Cerebro seen: their same-power cards all grow. Mystique may copy it.",
  thanos: "Thanos seen: the stones draw and ramp. Lockjaw or Blob can follow.",
  lockjaw: "Lockjaw swaps their cheap cards for big ones from the deck.",
  silversurfer: "Silver Surfer seen: their 3-Costs get +2 across lanes on turn 6.",
  sunspot: "Sunspot seen: unused energy becomes power, so they may skip plays.",
  doctordoom: "Doom seen: a Doombot in every lane. Onslaught or Doom 2099 may follow.",
  blackpanther: "Black Panther seen: Arnim Zola or Odin can double it again.",
  sandman: "Sandman seen: one card a turn for both sides. Big single plays only.",
  spectrum: "Spectrum pumps all their Ongoings. Expect it on turn 6.",
  onslaught: "Onslaught doubles their Ongoings in a lane. That lane is theirs late.",
  negasonicteenagewarhead: "Negasonic destroys the next card played in its lane. Play elsewhere first.",
  armor: "Armor stops destroys in its lane. Your Killmonger or Shang-Chi won't work there.",
  darkhawk: "Darkhawk grows with your deck size. Rockslide or Korg make it worse.",
  loki: "Loki copies your deck. Expect your own cards played against you.",
  odin: "Odin already fired their On Reveals again. Fewer surprises left.",
  blob: "Blob seen: it ate their deck. Their turn-6 options are thin now.",
};
function liveThreats(L) {
  const names = liveOppNames(L), keys = names.map(keyOf), seen = new Set(keys), out = [];
  const arch = archetypeOf(names), costOnly = /cost$/.test(arch);   // "Low-cost"/"High-cost" is only a guess from the average cost, so wait for 4 cards
  if (arch && LIVE_ARCH_TIPS[arch] && (!costOnly || names.length >= 4)) out.push(LIVE_ARCH_TIPS[arch]);
  const reveals = arr(L.opp).filter((o) => cardTags(card(o.key)).includes("R")).length;
  if (reveals >= 3 && arch !== "Destroy" && arch !== "Discard") out.push("On Reveal deck: Cosmo shuts a lane's reveals, and Odin or Wong fire them again.");
  const myMax = Object.entries(L.my).filter(([, z]) => String(z).startsWith("L")).reduce((m, [k]) => Math.max(m, num(L.myPow[k] ?? card(k).power)), 0);
  if (myMax >= 10 && !seen.has("shangchi")) out.push(`You have a ${myMax}-power card on the board: Shang-Chi would destroy it.`);
  for (const k of [...keys].reverse()) if (LIVE_CARD_TIPS[k] && !out.includes(LIVE_CARD_TIPS[k])) out.push(LIVE_CARD_TIPS[k]);   // latest reveals first
  return out.slice(0, 4);
}
function liveWatchOut(L) {
  const open = liveDet("watch") === true, lines = liveThreats(L), n = arr(L.opp).length;
  const body = lines.length ? `<ul class="lv-ul">${lines.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<span class="muted">${n ? "Nothing special yet. More of their cards sharpen this." : "Add the cards they reveal (Add their card, above) and warnings show up here."}</span>`;
  return `<details class="panel small lv-det" data-livedet="watch" ${open ? "open" : ""}><summary><b>Watch out for</b> <span class="muted">· ${lines.length ? plural(lines.length, "thing") : n ? "nothing yet" : "add their cards"}</span></summary><div class="stack" style="margin-top:8px">${body}${liveTheirCards(L)}</div></details>`;
}

/* ---------- 6. Location quick reference ---------- */
// The 3 closest location names to what was typed: a shared start of the name counts most, then the typed text inside
// the name, then shared letter pairs (so a typo in the middle still finds it)
function nearLocs(name) {
  const k = keyOf(name); if (k.length < 2) return [];
  const common = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  const pairs = (s) => { const p = new Set(); for (let i = 0; i < s.length - 1; i++) p.add(s.slice(i, i + 2)); return p; };
  const kp = pairs(k);
  return allLocations().filter((l) => !l.soon).map((l) => {
    const lk = keyOf(l.name), lp = pairs(lk); let both = 0; kp.forEach((x) => { if (lp.has(x)) both++; });
    const dice = kp.size + lp.size ? (2 * both) / (kp.size + lp.size) : 0;
    return { l, s: common(k, lk) * 2 + (lk.includes(k) ? k.length : 0) + dice * 6 };
  }).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s || a.l.name.length - b.l.name.length).slice(0, 3).map((x) => x.l.name);
}
function liveLocRef(L) {
  const sel = num(ui.liveLocInfo, -1);
  const chips = [0, 1, 2].map((i) => `<button class="chip" data-a="liveLocInfo" data-i="${i}" aria-pressed="${sel === i}">${esc(String(L.locs[i] || "").trim() || "Location " + (i + 1))}</button>`).join("");
  let box = "";
  if (sel >= 0 && sel <= 2) {
    const name = String(L.locs[sel] || "").trim();
    if (!name) box = `<div class="note">Type the location's name on the board above, then tap it here to see what it does.</div>`;
    else {
      const info = locByName(name);
      if (info) box = `<div class="note"><b>${esc(info.name)}</b> · ${esc(info.ability || "No effect text for this one yet.")}</div>`;
      else { const near = nearLocs(name); box = `<div class="note stack" style="gap:6px"><span>No location called “${esc(name)}”.${near.length ? " Did you mean:" : " Check the spelling on the board."}</span>${near.length ? `<div class="chips">${near.map((n) => `<button class="chip" data-a="liveLocPick" data-i="${sel}" data-name="${esc(n)}">${esc(n)}</button>`).join("")}</div>` : ""}</div>`; }
    }
  }
  return `<div class="panel stack small"><div class="row between"><b>Locations</b><span class="muted">Tap one for what it does</span></div><div class="chips">${chips}</div>${box}</div>`;
}

/* ---------- 10. Turn by turn strip ---------- */
function liveTimeline(L) {
  const last = clamp(num(L.lastTurn) || 6, 6, 7), now = num(L.turn) || 1, pt = obj(L.playTurn);
  // A card's play turn: recorded when you placed it, or else the first end-of-turn snapshot (live.log) that has it on the board
  const fromLog = {}; arr(L.log).forEach((s) => arr(s && s.my).forEach((x) => { if (String(x[1]).startsWith("L") && !fromLog[x[0]]) fromLog[x[0]] = num(s.t); }));
  const mine = (t) => Object.entries(L.my).filter(([k, z]) => String(z).startsWith("L") && num(pt[k] || fromLog[k]) === t).map(([k]) => card(k).name);
  const theirs = (t) => arr(L.opp).filter((o) => o.zone !== "hand" && num(o.turn) === t).map((o) => card(o.key).name);
  const ms = L.mySnap ? num(L.snapTurn) || now : 0, os = L.oppSnap ? num(L.oppSnapTurn) || now : 0;
  const few = (ns) => esc(ns.slice(0, 2).join(", ")) + (ns.length > 2 ? ` <span class="muted">+${ns.length - 2}</span>` : "");   // keeps each cell short
  let cells = "", anything = false;
  for (let t = 1; t <= last; t++) {
    const m = mine(t), o = theirs(t); if (m.length || o.length || ms === t || os === t) anything = true;
    cells += `<div class="ltc ${t === now ? "now" : t > now ? "later" : ""}"><b>${t}</b>${ms === t ? `<span class="sn">you snapped</span>` : ""}${os === t ? `<span class="sno">they snapped</span>` : ""}${m.length ? `<span class="me" title="${esc(m.join(", "))}">${few(m)}</span>` : ""}${o.length ? `<span class="them" title="${esc(o.join(", "))}">${few(o)}</span>` : ""}</div>`;
  }
  return `<div class="panel stack small"><div class="row between"><b>Turn by turn</b><span class="muted">your plays · <span class="lv-them">theirs</span> · snaps</span></div><div class="ltl" style="grid-template-columns:repeat(${last},minmax(0,1fr))">${cells}</div>${anything ? "" : `<span class="muted">Cards you play and theirs show up under their turn, with any snaps.</span>`}</div>`;
}

/* ---------- The section under the live tracker ---------- */
function liveHelperHtml() {
  const L = live; if (!L || !L.on) return "";
  return `<section class="sec"><div class="sec-h"><h2>Match helper</h2><span class="muted small">Hints only. Nothing here changes your cubes.</span></div>
    <div class="panel stack small">${liveTurnLine(L)}${liveSnapHint(L)}${liveRetreatChips(L)}</div>
    ${liveTimeline(L)}
    ${liveDrawOdds(L)}
    ${liveWatchOut(L)}
    ${liveLocRef(L)}</section>`;
}
EXT.liveMatch.push(liveHelperHtml);

/* ---------- 8. Post-match tags ---------- */
const MATCH_TAGS = [["misplay", "Misplay"], ["lucky", "Lucky"], ["unlucky", "Unlucky"], ["bot", "Bot"], ["gg", "Great game"], ["bait", "Concede-bait"], ["tilt", "Tilt"]];
const matchTags = (m) => [...new Set(arr(m && m.tags).map(String).filter((t) => MATCH_TAGS.some(([k]) => k === t)))];
EXT.matchSheet.push((f) => `<div class="stack" style="gap:6px"><span class="eyebrow">Tags</span><div class="chips flow">${MATCH_TAGS.map(([k, l]) => `<button class="chip" data-a="mfTag" data-v="${k}" aria-pressed="${matchTags(f).includes(k)}">${l}</button>`).join("")}</div><span class="muted small">Tap what happened. Home › Stats adds up how each one goes for you.</span></div>`);
let _tagRows = { key: "", rows: [] };   // cached per match change, period and mode
function tagRows() {
  const key = `${_mVer}|${ui.period}|${ui.homeMode || ""}`; if (_tagRows.key === key) return _tagRows.rows;
  const ms = byMode(inPeriod(allMatches(), periodById(ui.period))).filter((m) => arr(m.tags).length);
  const rows = MATCH_TAGS.map(([k, l]) => ({ k, l, st: statsFor(ms.filter((m) => matchTags(m).includes(k))) })).filter((r) => r.st.games).sort((a, b) => b.st.games - a.st.games);
  _tagRows = { key, rows }; return rows;
}
function tagsStatsHtml() {
  const rows = tagRows();
  if (!rows.length) return `<section class="sec"><h2>Tags</h2><p class="muted small">Tag matches when you log them (Misplay, Lucky, Tilt…) and this shows how often each happens and how it goes for you.</p></section>`;
  const worst = [...rows].filter((r) => r.st.games >= 3).sort((a, b) => a.st.cubes - b.st.cubes)[0];
  const tip = worst && worst.st.cubes < 0 ? `<p class="muted small">“${esc(worst.l)}” games have cost you ${Math.abs(worst.st.cubes)} cubes over ${worst.st.games} games${worst.k === "tilt" ? ". A short break after a tilt game usually pays for itself" : worst.k === "misplay" ? ". Worth a look at those decks' replays" : ""}.</p>` : "";
  return `<section class="sec"><h2>Tags</h2><div class="tbl-wrap"><table><thead><tr><th>Tag</th><th class="n">Games</th><th class="n">Win %</th><th class="n">Cubes</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.l)}</td><td class="n">${r.st.games}</td><td class="n ${r.st.wr >= 50 ? "pos" : "neg"}">${r.st.wr}%</td><td class="n ${r.st.cubes >= 0 ? "pos" : "neg"}">${signed(r.st.cubes)}</td></tr>`).join("")}</tbody></table></div>${tip}<p class="muted small">From the tags you add on the match form. One match can have several tags.</p></section>`;
}
EXT.homeStats.push(tagsStatsHtml);

/* ---------- 7. Opponent name: the record already shows under the name in Bot check; add a first-meeting line ---------- */
const rivalLineBase = rivalLine;
rivalLine = function (name) {
  const html = rivalLineBase(name); if (html) return html;
  const n = String(name || "").trim(); if (n.length < 2) return "";
  return `<div class="note">First time you've logged ${esc(n)}. Next time you meet, your record against them shows here.</div>`;
};

/* ---------- Actions ---------- */
const liveMySetBase = A.mySet, liveOppSetBase = A.oppSet;
Object.assign(A, {
  liveExtraEnergy: () => { if (!live.on) return; const base = num(live.turn) || 1; live.energy = { t: base, v: liveEnergy(live) > base ? base : base + 1 }; saveLive(); render(); },
  liveLocInfo: (el) => { const i = num(el.dataset.i); ui.liveLocInfo = num(ui.liveLocInfo, -1) === i ? -1 : i; render(); },
  liveLocPick: (el) => { const i = clamp(num(el.dataset.i), 0, 2); live.locs[i] = String(el.dataset.name || ""); ui.liveLocInfo = i; saveLive(); render(); },
  mfTag: (el) => { if (!mf) return; const v = el.dataset.v, t = matchTags(mf); mf.tags = t.includes(v) ? t.filter((x) => x !== v) : [...t, v].slice(-MATCH_TAGS.length); refreshSheet(); },
  // Remember the turn a card was played on, for the turn-by-turn strip (moving it back to hand or deck forgets it)
  mySet: (el, e) => { const k = el.dataset.k, v = String(el.dataset.v || ""), was = String(live.my[k] || ""); live.playTurn = obj(live.playTurn); if (v.startsWith("L")) { if (!was.startsWith("L")) live.playTurn[k] = num(live.turn) || 1; } else if (v === "hand" || v === "deck") delete live.playTurn[k]; return liveMySetBase(el, e); },
  // Their card moved onto the board: stamp the turn, and a card known in their hand leaves it (as adding one straight to a lane already does)
  oppSet: (el, e) => { const o = live.opp[num(el.dataset.i)], v = String(el.dataset.v || ""); if (o && v.startsWith("L") && !String(o.zone).startsWith("L")) { o.turn = num(live.turn) || 1; if (o.zone === "hand") live.oppHand = Math.max(0, num(live.oppHand) - 1); } return liveOppSetBase(el, e); },
});
// Keep the collapsible panels the way you left them across redraws (toggle doesn't bubble, so listen in the capture phase)
document.addEventListener("toggle", (e) => { const d = e.target && e.target.dataset ? e.target.dataset.livedet : ""; if (d) { ui.liveDet = obj(ui.liveDet); ui.liveDet[d] = !!e.target.open; } }, true);

EXT.styles.push(`
.lv-turn { font-family: var(--ui); font-size: 17px; letter-spacing: .02em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lv-hint { font-size: 13px; color: var(--fg); }
.lv-cubes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.lvc { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; font-size: 12px; line-height: 1.2; }
.lvc .cube { font-size: 17px; font-weight: 800; }
.lv-det > summary { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.lv-ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
.lv-odds th, .lv-odds td { vertical-align: top; }
.lv-odds { width: 100%; } .lv-odds td.n { width: 86px; } .lv-odds td.n b { font-size: 15px; } .lv-odds td.n .muted { font-size: 11px; }
.lv-odds .chiplist { gap: 4px; }
.lv-odds .cchip { font-size: 12px; padding: 2px 6px 2px 2px; gap: 4px; }
.lv-odds .cchip .c { width: 18px; height: 18px; font-size: 11px; }
.ltl { display: grid; gap: 4px; }
.ltc { background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 4px 3px; min-height: 46px; display: flex; flex-direction: column; gap: 2px; font-size: 10px; line-height: 1.15; min-width: 0; hyphens: auto; overflow-wrap: anywhere; text-align: center; }
.ltc b { font-family: var(--ui); font-size: 14px; line-height: 1; }
.ltc.now { border-color: var(--snap-a); box-shadow: inset 0 0 0 1px var(--snap-a); }
.ltc.later { opacity: .55; }
.ltc .me { color: var(--fg); } .ltc .them, .lv-them { color: var(--loss); }
.ltc .sn { font-weight: 700; color: var(--snap-text); } .ltc .sno { font-weight: 700; color: var(--loss); }
`);
