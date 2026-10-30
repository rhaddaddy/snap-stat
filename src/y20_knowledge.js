/* ============ y20_knowledge.js: game knowledge ============
   Cards › Glossary (the game's words in plain English, with the cards that use each mechanic), tips for each location,
   cards in your decks that a patch changed, the next card releases, an Infinite calculator, smarter ability search,
   how to get a card you don't own, what your Token Shop showed, a bundle calculator, this week's Spotlight and news. */

/* ---------- Small shared helpers ---------- */
const _knRe = new Map();
// A search word as a pattern that matches at the start of a word ("move" finds "moves", not "remove")
function knWordRe(w) {
  let r = _knRe.get(w); if (r) return r;
  const e = String(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  r = new RegExp((/^\w/.test(w) ? "\\b" : "") + e, "i");
  if (_knRe.size > 400) _knRe.clear(); _knRe.set(w, r); return r;
}
/* Ability search (used by the card grid's search box): the words must start a word in the ability text, and with
   several words, each one has to be there, in any order ("destroy power" finds Lady Deathstrike). */
function abilityHas(ab, q) {
  const a = String(ab || "").toLowerCase(), s = String(q || "").toLowerCase().trim();
  if (!s) return true; if (!a) return false;
  if (knWordRe(s).test(a)) return true;
  const words = s.split(/\s+/).filter((w) => w.length > 1);
  return words.length > 1 && words.every((w) => knWordRe(w).test(a));
}
const knDay = (d) => dayStr(dayStart(d));
// "today", "tomorrow", "in 5 days": calendar days from today
function knDaysTo(d) { const n = Math.round((dayStart(d) - dayStart(localDate(Date.now()))) / DAY); return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`; }
// Up to 5 small card tiles (one row on a phone), then "and 12 more"
function knChips(list, max = 5) {
  if (!list.length) return "";
  return `<div class="chiplist knchips">${list.slice(0, max).map((c) => cardChip(c.key, { a: "cardOpen", size: "xs" })).join("")}</div>${list.length > max ? `<span class="muted small">and ${fmt(list.length - max)} more</span>` : ""}`;
}
// Your deck cards first, then cards you own, then the rest
function knRank(list) {
  const inDecks = deckCardKeys();
  return [...list].sort((a, b) => (inDecks.has(b.key) ? 2 : 0) + (S.owned[b.key] ? 1 : 0) - (inDecks.has(a.key) ? 2 : 0) - (S.owned[a.key] ? 1 : 0) || a.name.localeCompare(b.name));
}
// Released cards you could have (no custom, mode-only or unknown ones)
function knPool() { return allCards().filter((c) => !c.upcoming && !c.custom && !c.unknownName && c.cost !== "?"); }

/* ============ 1. Glossary (Cards › Glossary) ============
   q: what the card search box gets for "See cards" (the count is the same search, so the numbers agree);
   cost: a cost filter instead; re / tag: deck styles that a search can't express, shown as example cards. */
const GLOSS_GROUPS = [["abil", "Card abilities"], ["style", "Deck styles"], ["play", "Playing"], ["coll", "Collecting"]];
const GLOSS = [
  { k: "reveal", t: "On Reveal", g: "abil", q: "on reveal", d: "An effect that happens once, right when the card flips face up at the end of the turn. Cards flip in the order they were played, and the player who's ahead flips first." },
  { k: "ongoing", t: "Ongoing", g: "abil", q: "ongoing", d: "An effect that's always on while the card is in play, like “Your other cards here have +1 Power.” If the card leaves or loses its ability, the effect stops." },
  { k: "destroy", t: "Destroy", g: "abil", q: "destroy", d: "Removes a card from the board for good. Destroy decks destroy their own cards on purpose to power up cards like Death (cheaper) and Knull (stronger)." },
  { k: "discard", t: "Discard", g: "abil", q: "discard", d: "Throwing a card away from your hand. Discard decks do it on purpose: Apocalypse comes back stronger, and Dracula gains the Power of the card he discards." },
  { k: "move", t: "Move", g: "abil", q: "move", d: "Changing location after a card is played. Some cards move themselves, some move others, and payoffs like Human Torch double their Power when they move." },
  { k: "activate", t: "Activate", g: "abil", q: "activate", d: "A button on the card. Once it's in play, tap it on your turn to use its ability when you choose. Each one works once unless the card says otherwise." },
  { k: "bounce", t: "Bounce", g: "abil", q: "return", d: "Returning your own cards to your hand so you can play them again, often cheaper or stronger (Beast, Falcon, Kitty Pryde). Great for replaying On Reveal effects." },
  { k: "zoo", t: "Zoo / 1-Cost", g: "abil", cost: "1", d: "Fill the board with lots of cheap cards early, then make them all stronger with cards like Ka-Zar (+1 Power to your 1-Cost cards) or Blue Marvel." },
  { k: "ramp", t: "Ramp", g: "abil", q: "energy", d: "Getting more Energy than the turn number so you can play your big cards early. Electro and Corvus Glaive give +1 Max Energy." },
  { k: "control", t: "Control", g: "style", tag: "C", d: "Decks that mess with the other player's plan instead of racing for Power: blocking their abilities (Cosmo), removing them (Enchantress) or destroying their big cards (Shang-Chi)." },
  { k: "lockdown", t: "Lockdown", g: "style", re: /only way to add or remove|can'?t be (added|removed|moved|changed|destroyed)|\bflood|can'?t move/, d: "Locking a location once you're ahead there, so nothing more can change: Professor X stops cards being added or removed, and Storm floods it so it closes a turn early." },
  { k: "lane", t: "Lane control", g: "style", re: /can'?t play|can'?t be played|last turn cards can be played|\bpull|switch(es)? sides/, d: "Winning a location by deciding who gets to play there: stop the other player adding cards to it, or drag their cards somewhere else (Spider-Man pulls an enemy card away)." },
  { k: "bighand", t: "Big hand", g: "style", re: /for each card in your hand|cards in your hand|copy your hand|your hand is full/, d: "Keeping lots of cards in your hand instead of playing them: Devil Dinosaur gets +2 Power for each one, and Moon Girl copies your hand to fill it up." },
  { k: "junk", t: "Junk", g: "style", re: /(into|to) (your )?opponent'?s (deck|hand)/, d: "Useless cards you give the other player, like the Rocks that Rockslide shuffles into their deck, so their draws get worse." },
  { k: "mill", t: "Mill", g: "style", re: /opponent'?s deck/, d: "Shrinking or messing with the other player's deck so they draw fewer good cards. Some cards pull cards straight out of it, like Gladiator." },
  { k: "clog", t: "Clog", g: "style", re: /switch(es)? sides|add a rock|their side/, d: "Filling the other player's side with junk (each side of a location holds only 4 cards), so they run out of room for their real cards. Green Goblin switches sides to clog them." },
  { k: "energy", t: "Energy", g: "play", d: "What you spend to play cards. You get 1 Energy on turn 1, 2 on turn 2, and so on up to 6 on turn 6. Energy you don't spend is gone at the end of the turn." },
  { k: "power", t: "Power", g: "play", d: "The number on a card. Whoever has more total Power at a location wins it, and you win the game by winning 2 of the 3 locations. If that's tied, more total Power wins." },
  { k: "snap", t: "Snap", g: "play", d: "Tap Snap when you think you'll win: the game is then worth double the Cubes. If both players snap it doubles again, and it doubles once more before the last turn, up to 8 Cubes." },
  { k: "retreat", t: "Retreat", g: "play", d: "Leaving a game early. You only lose the Cubes at stake right now, not what you'd lose by staying, so retreating a game you're losing saves Cubes." },
  { k: "cubes", t: "Cubes", g: "play", d: `Ranked points. You win or lose 1 to 8 a game. Every ${cpr()} Cubes is one rank, and rank 100 is Infinite.`, tool: "inf" },
  { k: "infinite", t: "Infinite", g: "play", d: "The top rank (100). Once you reach it you can't drop out of it for the rest of the season. Every 10 ranks before it is a new tier, like Bronze or Gold.", tool: "inf" },
  { k: "conquest", t: "Conquest", g: "play", d: "A mode where you play the same opponent again and again until one of you runs out of health. Win to move up from Proving Grounds to Silver, Gold and Infinite, and earn Medals for the Conquest shop." },
  { k: "alliance", t: "Alliances", g: "play", d: "Groups of up to 30 players. Members pick weekly bounties (goals like “destroy 30 cards”), and finishing them earns rewards." },
  { k: "series", t: "Series", g: "coll", d: "How hard a card is to get, from Series 1 (easy) to Series 5 (newest and hardest). Cards move down to lower Series over time, which makes them easier to get." },
  { k: "cl", t: "Collection Level", g: "coll", d: "Goes up each time you upgrade a card. Each step on the Collection track gives a reward: Credits, Boosters, Collector's Tokens, new cards or caches." },
  { k: "upgrade", t: "Upgrades & Boosters", g: "coll", d: "Spend a card's Boosters plus Credits to upgrade it to its next rarity. It only changes the card's look, but it raises your Collection Level. Boosters come from playing games with that card." },
  { k: "tokens", t: "Collector's Tokens", g: "coll", d: "The currency of the Token Shop, where you buy the exact Series 4 or 5 card you want, or open packs. You get them from the Collection track, the Season Pass and the shop's free daily tokens.", tool: "rb" },
  { k: "spotlight", t: "Spotlight Caches", g: "coll", d: "Each week a few cards are in the Spotlight. Spotlight Caches on your Collection track give one you don't own yet, so they're the main free way to get new Series 4 and 5 cards." },
  { k: "split", t: "Infinity Split", g: "coll", d: "Once a card is upgraded to Infinity, you can split it into another copy with a random finish (like Foil, Prism or Ink) and a flare. Split Reroll Coins let you redo a finish you don't like." },
  { k: "custom", t: "Custom Cards", g: "coll", d: "Choose how a card looks in your decks: the variant art you own, plus the border, finish and flare you've unlocked." },
  { k: "variant", t: "Variants", g: "coll", d: "Different art for the same card. They're only for looks: a variant plays exactly like the card." },
];
let _glSig = "", _glMap = new Map();
// The cards behind each mechanic, worked out once per card-data change (about 30 searches over the card list)
function glossCards() {
  const sig = `${catVer}|${vdVer}|${schedVer}|${S.addedCards.length}|${Object.keys(obj(S.cardEdits)).length}|${showSoon()}`;
  if (sig === _glSig) return _glMap;
  const all = allCards(), pool = knPool(), out = new Map();
  for (const g of GLOSS) {
    if (g.q) out.set(g.k, all.filter((c) => (!c.upcoming || showSoon()) && cardMatches(c, g.q)));
    else if (g.cost) out.set(g.k, all.filter((c) => (!c.upcoming || showSoon()) && String(c.cost) === g.cost));
    else if (g.re) out.set(g.k, pool.filter((c) => g.re.test(String(c.ability || "").toLowerCase())));
    else if (g.tag) out.set(g.k, pool.filter((c) => cardTags(c).includes(g.tag)));
  }
  _glSig = sig; _glMap = out; return out;
}
function glossRow(g, cards) {
  const list = cards.get(g.k), n = list ? list.length : 0;
  const see = g.q || g.cost ? `<button class="btn sm ghost" data-a="glossCards" data-q="${esc(g.q || "")}" data-cost="${esc(g.cost || "")}">See ${fmt(n)} card${n === 1 ? "" : "s"} ›</button>` : "";
  const tool = g.tool === "inf" ? `<button class="btn sm ghost" data-a="infOpen">Infinite calculator</button>` : g.tool === "rb" ? `<button class="btn sm ghost" data-a="rbOpen">Rate a bundle</button>` : "";
  return `<div class="li gl-row" id="gl-${g.k}"><div class="row between nowrap" style="gap:8px"><b class="gl-t">${esc(g.t)}</b>${list ? `<span class="pill dim num">${fmt(n)} card${n === 1 ? "" : "s"}</span>` : ""}</div>
    <p class="small gl-d">${esc(g.d)}</p>${g.re || g.tag ? knChips(knRank(list || [])) : ""}${see || tool ? `<div class="row">${see}${tool}</div>` : ""}</div>`;
}
function vGlossary() {
  const kind = ui.glKind || "", q = String(ui.glQ || "").trim().toLowerCase(), cards = CAT ? glossCards() : new Map();
  const list = GLOSS.filter((g) => (!kind || g.g === kind) && (!q || g.t.toLowerCase().includes(q) || g.d.toLowerCase().includes(q)));
  const chip = (v, l) => `<button class="chip" data-a="glossKind" data-v="${v}" aria-pressed="${kind === v}">${l}</button>`;
  return `<section class="sec"><h2>Glossary</h2><p class="muted small">The words players use, in plain English. “See cards” opens the card list searched for that ability, and the counts are cards that are out now.</p>
    <div class="panel row between" style="gap:8px"><span class="small"><b>Handy tools</b></span><div class="row"><button class="btn sm" data-a="infOpen">Infinite calculator</button><button class="btn sm" data-a="rbOpen">Rate a bundle</button></div></div>
    <input type="search" id="gl-q" data-ui="glQ" value="${esc(ui.glQ || "")}" placeholder="Search the glossary" aria-label="Search the glossary">
    <div class="chips">${chip("", "All")}${GLOSS_GROUPS.map(([v, l]) => chip(v, l)).join("")}</div>
    ${!CAT ? `<p class="muted small">Card counts show once the card list has loaded.</p>` : ""}
    ${list.length ? GLOSS_GROUPS.filter(([v]) => list.some((g) => g.g === v)).map(([v, l]) => `<h3>${esc(l)}</h3><div class="list">${list.filter((g) => g.g === v).map((g) => glossRow(g, cards)).join("")}</div>`).join("")
      : `<div class="empty"><strong>Nothing matches</strong><span>Try another word, or clear the search.</span></div>`}</section>`;
}
EXT.cardsSubs.push(["glossary", "Glossary", vGlossary]);
EXT.search.push((q) => { const s = String(q || "").trim().toLowerCase(); if (s.length < 3) return []; return GLOSS.filter((g) => g.t.toLowerCase().includes(s)).slice(0, 4).map((g) => ({ label: g.t, sub: "Glossary · " + g.d.slice(0, 70) + "…", route: "#cards/glossary" })); });

/* ============ 4. Location tips (in a location's sheet) ============
   A word match between the location's text and card abilities. "Careful with" when the location's sentence with that
   word also says can't / won't / don't / not, or gives cards -Power. */
const LOC_MECH = [
  { w: "Destroy", loc: /\bdestroy/, card: /\bdestroy/ },
  { w: "Discard", loc: /\bdiscard/, card: /\bdiscard/ },
  { w: "Move", loc: /\bmov(e|es|ed|ing)\b/, card: /\bmov(e|es|ed|ing)\b|\bmoveable/ },
  { w: "Ongoing", loc: /\bongoing\b/, card: /\bongoing\b/ },
  { w: "On Reveal", loc: /\bon reveal\b/, card: /\bon reveal\b/ },
  { w: "Energy", loc: /\benergy\b/, card: /\benergy\b/ },
  { w: "Big hand", loc: /\bdraw|your hand/, card: /for each card in your hand|cards in your hand|copy your hand/ },
];
const LOC_NEG = /can'?t|cannot|won'?t|don'?t|doesn'?t|do not|does not|isn'?t|aren'?t|\bnot\b|no longer|instead|afflict|-\d+ power/;
let _ltSig = "", _lt = new Map();
function locTips(l) {
  const sig = `${catVer}|${vdVer}|${saveVer}`; if (sig !== _ltSig) { _ltSig = sig; _lt = new Map(); }
  const key = keyOf(l.name); if (_lt.has(key)) return _lt.get(key);
  const text = String(l.ability || "").toLowerCase(), clauses = text.split(/[.;]\s*/).filter(Boolean), pool = knPool();
  const good = new Map(), bad = new Map(), why = { good: [], bad: [] };
  const add = (into, label, cards) => { if (!cards.length) return; why[into === good ? "good" : "bad"].push(label); for (const c of cards) into.set(c.key, c); };
  for (const m of LOC_MECH) {
    const hits = clauses.filter((s) => m.loc.test(s)); if (!hits.length) continue;
    const cards = pool.filter((c) => m.card.test(String(c.ability || "").toLowerCase()));
    add(hits.some((s) => !LOC_NEG.test(s)) ? good : bad, m.w, cards);
  }
  // Card costs: "1-Cost cards here have +2 Power", "Cards that cost 4 or more can't be played here"
  for (const s of clauses) {
    const exact = s.match(/\b(\d+)-cost\b/), more = s.match(/cost (\d+) or more/), less = s.match(/cost (\d+) or less/);
    const test = exact ? (c) => num(c.cost) === num(exact[1]) : more ? (c) => num(c.cost) >= num(more[1]) : less ? (c) => num(c.cost) <= num(less[1]) : null;
    if (!test) continue;
    const label = exact ? `${exact[1]}-Cost cards` : more ? `cards that cost ${more[1]}+` : `cards that cost ${less[1]} or less`;
    add(LOC_NEG.test(s) ? bad : good, label, pool.filter(test));
  }
  if (/no abilit/.test(text)) add(good, "cards with no ability", pool.filter((c) => !String(c.ability || "").trim()));
  for (const k of bad.keys()) good.delete(k);
  const r = { good: knRank([...good.values()]), bad: knRank([...bad.values()]), why };
  _lt.set(key, r); return r;
}
function locTipsHtml(l) {
  if (!l || !String(l.ability || "").trim() || !CAT) return "";
  const t = locTips(l);
  const part = (label, list, words) => (list.length ? `<div class="stack" style="gap:6px"><span class="small"><b>${label}</b> <span class="muted">${esc(words.join(", "))}</span></span>${knChips(list)}</div>` : "");
  return `<div class="panel stack small loctips"><span class="eyebrow">Tips for this location</span>
    ${t.good.length || t.bad.length ? `${part("Good with", t.good, t.why.good)}${part("Careful with", t.bad, t.why.bad)}` : `<span class="muted">No card tips for this one: its effect works about the same for every card.</span>`}
    <span class="muted small">How these are picked: cards whose ability uses the same word as the location (destroy, discard, move, Ongoing, On Reveal, Energy, your hand, or a card cost). “Careful with” means the location blocks or punishes it. Your deck cards and cards you own come first. It's a word match, so read the card before you count on it.</span></div>`;
}

/* ============ 3. Cards a patch changed: in the deck sheet and on Home ============ */
const BAL_VERB = { buff: "buffed", nerf: "nerfed", changed: "reworked" };
function deckPatchHtml(d) {
  if (!d || !BAL) return "";
  const xs = [...new Set(arr(d.cards))].filter((k) => !String(k).startsWith("custom:")).map((k) => recentChange(k, 30)).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  if (!xs.length) return "";
  return `<p class="note small patchline"><b>Changed recently:</b> ${xs.map((x) => `<button class="linkbtn" data-a="cardOpen" data-k="${esc(x.key)}">${esc(card(x.key).name)}</button> <span class="muted">(${BAL_VERB[x.kind] || "changed"} ${esc(knDay(x.date))})</span>`).join(", ")}</p>`;
}
EXT.deckSheet.push(deckPatchHtml);
// The last patch: the newest change in the history, plus anything logged up to 3 days before it
function lastPatch() {
  const all = balanceChanges(); if (!all.length) return null;
  const latest = all[0].date; if (latest < localDate(Date.now() - 30 * DAY)) return null;
  const from = localDate(dayStart(latest) - 3 * DAY);
  return { date: latest, list: all.filter((x) => x.date >= from) };
}
function patchHomeHtml() {
  if (!BAL) return "";
  const p = lastPatch(); if (!p) return "";
  const decks = S.decks.filter((d) => d.status !== "draft" && arr(d.cards).length);
  const changed = new Map(p.list.map((x) => [x.key, x]));
  const mine = [...new Set(decks.flatMap((d) => d.cards))].filter((k) => changed.has(k));
  if (!mine.length) return "";
  const hit = decks.filter((d) => d.cards.some((k) => changed.has(k)));
  const names = mine.slice(0, 4).map((k) => `${card(k).name} (${BAL_VERB[changed.get(k).kind] || "changed"})`).join(", ") + (mine.length > 4 ? ` and ${mine.length - 4} more` : "");
  return `<section class="sec"><button class="panel row between nowrap knpatch" data-a="knBalance" style="width:100%;text-align:left"><span class="small" style="white-space:normal;min-width:0"><b>${plural(mine.length, "card")} in your decks changed in the last patch</b> <span class="muted">(${esc(knDay(p.date))})</span><br>${esc(names)}<br><span class="muted">Check ${hit.length === 1 ? "your deck" : `these ${hit.length} decks`}: ${esc(hit.slice(0, 4).map((d) => d.name).join(", "))}${hit.length > 4 ? "…" : ""}</span></span><span class="pill gold">Balance ›</span></button></section>`;
}

/* ============ 6. Coming up: the next new cards, on Home ============
   From the seasons and events (snap.fan's schedule and your own): a season's card releases on the day its
   "from October 13" note says, else when the season starts. */
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
function srcDate(s, name) {
  const t = String(obj(s.sources)[name] || "").toLowerCase(), m = t.match(/from (\w+) (\d{1,2})\b/); if (!m) return "";
  const mo = MONTHS.indexOf(m[1]); if (mo < 0) return "";
  const start = String(s.start || ""), y0 = num(start.slice(0, 4)) || new Date().getFullYear(), y = mo + 1 < num(start.slice(5, 7)) ? y0 + 1 : y0;
  const d = `${y}-${pad2(mo + 1)}-${pad2(num(m[2]))}`;
  return d >= start ? d : "";
}
let _upSig = "", _up = [];
function nextReleases() {
  const sig = `${schedVer}|${catVer}|${sharedVer}|${S.localSeasons.length}|${S.localEvents.length}|${Object.keys(S.owned).length}|${Math.floor(Date.now() / 6e4)}`;
  if (sig === _upSig) return _up;
  const now = Date.now(), by = new Map();
  const put = (name, date, from, how) => {
    const c = cardByName(name); if (!c || c.hidden || c.custom || S.owned[c.key] || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    // Already in the game (the card data lists it in a Series): a future event that offers it isn't a new release
    if (!c.upcoming && c.catId && !c.catUnreleased && /^Series \d$/.test(seriesOf(c))) return;
    const t = resetOn(date); if (!(t > now)) return;
    const o = by.get(c.key); if (!o || date < o.date) by.set(c.key, { c, date, from, how });
  };
  for (const s of seasons()) for (const n of [...arr(s.cards), s.passCard].filter(Boolean)) put(String(n), srcDate(s, n) || s.start, s.name, keyOf(n) === keyOf(s.passCard) ? "Season Pass card" : String(obj(s.sources)[n] || "").replace(/,? from \w+ \d{1,2}\b/i, "").slice(0, 60));
  for (const e of events()) for (const x of arr(e.collectibles).map(parseLine)) if (x.kind === "card") put(x.name, e.start, e.name, "Event");
  for (const c of allCards()) if (c.upcoming && c.release && !by.has(c.key)) put(c.name, c.release, c.from || "", "");
  _up = [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.c.name.localeCompare(b.c.name)); _upSig = sig; return _up;
}
function comingUpHtml() {
  const list = nextReleases().slice(0, 4); if (!list.length) return "";
  return `<section class="sec comingup"><div class="sec-h"><h2>Coming up</h2><button class="btn sm ghost" data-a="go" data-to="cards/upcoming">Coming soon ›</button></div>
    <div class="panel upgrid">${list.map((x) => `<div class="upc">${cardChip(x.c.key, { a: "cardOpen", noOwn: true, size: "xs" })}<span class="pill gold" title="${esc(dateStr(x.date))}">${esc(knDaysTo(x.date))}</span><span class="upf">${esc([x.from, x.how].filter(Boolean).join(" · ") || "New card")}</span></div>`).join("")}</div></section>`;
}

/* ============ 10. Infinite calculator (a sheet, and a line on Home › Stats) ============ */
const inf = { rank: null, cubes: null, cpg: null, gpd: null };
function infDefaults() {
  const st0 = climbNow(), st = st0 && !st0.stale ? st0 : null;
  const sp = currentSeasonPeriod(), ranked = (sp ? inPeriod(realMatches(), sp) : []).filter((m) => modeOf(m) === "Ranked");
  const ss = statsFor(ranked), pace = climbPace(), season = ss.cubeGames >= 3;
  return { rank: st ? st.rank : rankFromStr(S.me.rank), cubes: st ? st.cubes : 0, cpg: season ? ss.cpg : Math.round(pace.cpg * 100) / 100,
    from: season ? `this season's ${plural(ss.cubeGames, "Ranked game")}` : pace.n ? `your last ${plural(pace.n, "Ranked game")}` : "", gpd: pace.gpd ? Math.round(pace.gpd * 10) / 10 : 0 };
}
function infMath(rank, cubesIn, cpg, gpd) {
  const r = clamp(Math.round(num(rank)), 1, 100), c = clamp(Math.round(num(cubesIn)), 0, cpr() - 1), per = num(cpg), day = num(gpd);
  const need = r >= 100 ? 0 : (100 - r) * cpr() - c;
  const games = per > 0 ? Math.ceil(need / per) : 0, days = games && day > 0 ? Math.ceil(games / day) : 0;
  return { r, c, need, games, days };
}
function infOut() {
  const d = infDefaults(), v = (k) => (inf[k] === null || inf[k] === undefined ? d[k] : inf[k]);
  if (!num(v("rank"))) return `<p class="muted small">Enter your rank from the game (1 to 100) to see how far Infinite is.</p>`;
  const m = infMath(v("rank"), v("cubes"), v("cpg"), v("gpd")), cs = currentSeason();
  if (m.r >= 100) return `<p class="small"><b>You're Infinite.</b> That's the top: nothing left to climb this season.</p>`;
  const left = cs && Number.isFinite(cs.endTs) ? Math.max(0, Math.floor((cs.endTs - Date.now()) / DAY)) : 0;
  const kpi = (val, k) => `<div class="kpi"><b class="num">${val}</b><span>${k}</span></div>`, blank = v("cpg") === "" || (inf.cpg === null && !d.from);
  return `<div class="kpis">${kpi(fmt(m.need), "cubes to go")}${kpi(m.games ? "≈" + fmt(m.games) : "—", "games")}${kpi(m.days ? "≈" + fmt(m.days) : "—", "days")}</div>
    <p class="small">${100 - m.r} ranks × ${cpr()} cubes${m.c ? `, less the ${m.c} you have in this rank` : ""} = <b>${fmt(m.need)} cubes</b>.
    ${num(v("cpg")) > 0 ? ` At ${signed(Math.round(num(v("cpg")) * 100) / 100)} cubes a game that's about <b>${fmt(m.games)} games</b>${m.days ? `, or ${fmt(m.days)} days at ${num(v("gpd"))} games a day` : ""}.` : blank ? " Enter how many cubes you win a game on average (like 1.5) to see how many games that is." : " With 0 or fewer cubes a game you won't climb: try a bigger number to see what it takes."}
    ${left && m.games ? ` The season ends in ${plural(left, "day")}: that's about ${fmt(Math.ceil(m.games / Math.max(1, left)))} games a day.` : ""}</p>`;
}
function infSheet() {
  const d = infDefaults(), v = (k) => (inf[k] === null || inf[k] === undefined ? d[k] : inf[k]);
  const f = (k, l, extra) => `<label class="f">${l}<input type="number" id="inf-${k}" data-inf="${k}" value="${esc(v(k) === 0 && k !== "cubes" ? "" : v(k))}" ${extra}></label>`;
  return `${sheetHead("Infinite calculator", "How many games until rank 100")}
    <div class="grid2">${f("rank", "Rank now (1–100)", 'min="1" max="100" inputmode="numeric"')}${f("cubes", `Cubes into this rank (0–${cpr() - 1})`, `min="0" max="${cpr() - 1}" inputmode="numeric"`)}
      ${f("cpg", "Cubes a game", 'step="0.1" inputmode="decimal"')}${f("gpd", "Games a day", 'step="1" min="0" inputmode="decimal"')}</div>
    <p class="muted small">${d.rank ? "Filled in from your rank" : "Your rank isn't set yet"}${d.from ? ` and ${esc(d.from)} (${signed(d.cpg)} cubes a game)` : ""}. Change any number to try “what if”. Nothing here is saved.</p>
    <div id="inf-out" class="stack">${infOut()}</div>
    <p class="note small">Cubes a game goes up when you snap the games you're winning and retreat the ones you're losing.</p>
    <div class="row"><button class="btn ghost" data-a="infReset">Use my numbers</button></div>
    <button class="btn snap block" data-a="close">Done</button>`;
}
function infStatsHtml() {
  const d = infDefaults(); if (!d.rank || d.rank >= 100) return "";
  const m = infMath(d.rank, d.cubes, d.cpg, d.gpd);
  const at = (x) => infMath(d.rank, d.cubes, x, 0).games;
  const better = [2, 3].filter((x) => x > d.cpg + 0.25).map((x) => `${signed(x)} a game is ≈${fmt(at(x))} games`);
  return `<section class="sec"><div class="sec-h"><h2>Infinite calculator</h2><button class="btn sm" data-a="infOpen">Try numbers</button></div>
    <div class="panel small"><p>From rank ${m.r}, Infinite is <b>${fmt(m.need)} cubes</b> away. ${d.cpg > 0 ? `At ${signed(d.cpg)} a game (${esc(d.from)}) that's about <b>${fmt(m.games)} games</b>.` : d.from ? `You're not gaining cubes in ${esc(d.from)} yet.` : "Log a few Ranked games and this shows how many games that is."}${better.length ? ` Winning a bit bigger: ${better.join(", ")}.` : ""}</p></div></section>`;
}
EXT.homeStats.push(infStatsHtml);

/* ---------- Everything this file shows on Home › Overview ---------- */
EXT.homeTop.push(() => patchHomeHtml() + comingUpHtml() + newsHomeHtml());

/* ============ 8. What your Token Shop showed: remembered from your shop screenshots ============
   S.tokenSeen: { cardKey: [time seen, "price as shown", "variant name"] }, the newest 150 cards. The daily cards (S.dailyCards)
   only keep today's, so this is what lets a card's sheet say when you last saw it there. */
const TS_MAX = 150;
let _tsSig = "", _tsDirty = false;
function tokenShopReads() {
  const out = [], D = obj(S.dailyCards);
  for (const d of arr(D.cards)) out.push({ ts: num(D.at), card: obj(d).card, variant: obj(d).variant, price: obj(d).price });
  for (const s of arr(S.shopSeen)) if (/token|collector/i.test(String(obj(s).shop || ""))) for (const it of arr(s.items)) if (!/border|other/i.test(String(obj(it).kind || ""))) out.push({ ts: num(s.ts), card: it.card, variant: it.variant, price: it.price });
  for (const o of arr(S.shops)) if (o && (o.shop === "collector" || o.currency === "tokens") && /^(card|variant)$/i.test(String(o.kind || ""))) out.push({ ts: num(o.added), card: o.item, variant: "", price: `${fmt(o.price)} ${CURR[o.currency] || ""}`.trim() });
  return out.filter((x) => x.ts && x.card);
}
function tokenSeenSync() {
  const D = obj(S.dailyCards), sig = `${num(D.at)}|${arr(D.cards).length}|${arr(S.shopSeen).map((s) => num(obj(s).ts)).join(",")}|${arr(S.shops).length}`;
  if (sig === _tsSig) return obj(S.tokenSeen);
  _tsSig = sig;
  const T = { ...obj(S.tokenSeen) }; let changed = false;
  for (const x of tokenShopReads()) {
    const c = fuzzyCard(String(x.card)); if (!c || c.custom) continue;
    const old = arr(T[c.key]); if (num(old[0]) >= x.ts) continue;
    T[c.key] = [x.ts, String(x.price || "").slice(0, 24), String(x.variant || "").slice(0, 50)]; changed = true;
  }
  if (changed) { S.tokenSeen = Object.fromEntries(Object.entries(T).sort((a, b) => num(b[1][0]) - num(a[1][0])).slice(0, TS_MAX)); _tsDirty = true; }
  return obj(S.tokenSeen);
}
function tokenSeenLine(k) {
  const x = arr(obj(tokenSeenSync())[k]); if (!x.length) return "";
  const ts = num(x[0]), price = String(x[1] || ""), variant = String(x[2] || ""), today = gameDay(ts) === gameDay();
  const p = /^[\d.,\s]+k?$/i.test(price) ? `${price} tokens` : price;
  return `<span>${today ? "<b>In your Token Shop today</b>" : `<b>Last seen in your Token Shop</b> on ${esc(dateStr(localDate(ts)))}`}${p ? ` for ${esc(p)}` : ""}${variant ? ` <span class="muted">(${esc(variant)})</span>` : ""}.</span>`;
}
// Saved after the page is drawn, never while it's being drawn
EXT.afterRender.push(() => { tokenSeenSync(); if (_tsDirty) { _tsDirty = false; save(); } });

/* ============ 5. How to get a card you don't own (in its sheet) ============ */
function cardOrigin(c) {
  const k = c.key;
  for (const s of seasons()) {
    if (s.passCard && keyOf(s.passCard) === k) return { s, pass: true };
    const n = arr(s.cards).find((x) => keyOf(x) === k); if (n) return { s, src: String(obj(s.sources)[n] || ""), date: srcDate(s, n) || s.start };
  }
  for (const e of events()) if (arr(e.collectibles).map(parseLine).some((x) => x.kind === "card" && keyOf(x.name) === k)) return { e };
  return null;
}
function howLines(c) {
  const P = { ...DEF_PRICES, ...obj(S.prices) }, ser = seriesOf(c), o = cardOrigin(c), lines = [], today = localDate(Date.now());
  const date = (o && o.date) || c.release || "";
  if (o && o.pass && timeState(o.s) !== "past") lines.push(`The <b>Season Pass card</b> of ${esc(o.s.name)}: it's the first reward on the premium pass while the season runs. After the season it usually joins Series 5.`);
  else if (o && o.src) lines.push(`This season: ${esc(o.src)}.`);
  else if (o && o.e && timeState(o.e) !== "past") lines.push(`From the <b>${esc(o.e.name)}</b> event (${esc(dateStr(o.e.start))}${o.e.end ? ` to ${esc(dateStr(o.e.end))}` : ""}).`);
  if (c.upcoming && date && date >= today) lines.push(`Comes out ${esc(dateStr(date))} (${esc(knDaysTo(date))}).${o && (o.src || o.pass) ? "" : " New cards can be bought in the Token Shop and are in that week's Spotlight Caches."}`);
  const price = ser === "Series 5" ? num(P.s5) : ser === "Series 4" ? num(P.s4) : 0;
  if (ser === "Starter") lines.push("A starter card: everyone gets it from the first Collection Levels and the Recruit Season.");
  else if (ser === "Series 1") lines.push("<b>Series 1</b>: unlocks on the Collection track in the early Collection Levels. It can't be bought: upgrade any of your cards to raise your Collection Level.");
  else if (ser === "Series 2") lines.push("<b>Series 2</b>: unlocks on the Collection track once Series 1 is done. Keep upgrading cards to get there.");
  else if (ser === "Series 3") lines.push(`<b>Series 3</b>: comes at random from Collection Level rewards once Series 1 and 2 are done, or from the Old Series 3 pack in the Token Shop (${fmt(P.s3)} tokens for a random Series 3 card you don't have).`);
  else if (price && !c.upcoming) lines.push(`<b>${esc(ser)}</b>: buy it in the Token Shop for <b>${fmt(price)} Collector's Tokens</b>, or get it from a Spotlight Cache in a week it's in the Spotlight.`);
  if (typeof packPools === "function" && !c.upcoming) { const pp = packPools(), pk = pp ? pp.seasonal.find((p) => p.keys.includes(c.key)) : null; if (pk) lines.push(`It's in the <b>${esc(pk.name)}</b> pack right now (${fmt(pk.price)} tokens, which gives a card from that pack you don't own yet).`); }
  const have = num(S.wallet.tokens);
  if (price && !c.upcoming && (have || S.walletAt)) lines.push(`You have <b>${fmt(have)} tokens</b>${have >= price ? ": enough to buy it." : `: ${fmt(price - have)} to go.`}`);
  if (!lines.length) lines.push(c.catModeOnly ? "This version only exists inside a game mode." : "Where it comes from isn't in the card data yet.");
  return lines;
}
function howToGetHtml(k) {
  if (String(k).startsWith("custom:")) return "";
  const c = card(k); if (!c || c.custom || c.unknown) return "";
  const seen = tokenSeenLine(k);
  if (S.owned[k]) return seen ? `<div class="panel stack small howget"><span class="eyebrow">Token Shop</span>${seen}</div>` : "";
  return `<div class="panel stack small howget"><span class="eyebrow">How to get it</span>${howLines(c).map((l) => `<span>${l}</span>`).join("")}
    ${seen || `<span class="muted">Not seen in your Token Shop yet. Screenshot the shop's Cards tab and what's in it is remembered here.</span>`}</div>`;
}
EXT.cardSheet.push(howToGetHtml);

/* ============ 9. Rate a bundle: what it's worth against plain gold ============
   The values the app's bundle ratings use: Gold as itself, Credits and Collector's Tokens by the shop's prices (GOLD_PER),
   a variant at 700 Gold and a card back, avatar or title at 300 (about their shop prices), compared with a gold pack. */
const rb = { price: "", gold: "", credits: "", tokens: "", vars: "", cos: "" };
const RB_ITEM = { vars: 700, cos: 300 };
function rbCalc() {
  const usd = num(rb.price);
  const parts = [["Gold", num(rb.gold) * GOLD_PER.gold], ["Credits", num(rb.credits) * GOLD_PER.credits], ["Collector's Tokens", num(rb.tokens) * GOLD_PER.tokens], ["Variants", num(rb.vars) * RB_ITEM.vars], ["Card backs, avatars, titles", num(rb.cos) * RB_ITEM.cos]].filter(([, g]) => g > 0);
  const gold = Math.round(parts.reduce((t, [, g]) => t + g, 0));
  const pct = usd > 0 && gold > 0 ? Math.round((gold / goldForMoney(usd)) * 100) : 0;
  return { usd, gold, pct, parts, per: usd > 0 ? Math.round(gold / usd) : 0, base: usd > 0 ? Math.round(goldForMoney(usd) / usd) : 0 };
}
function rbOut() {
  const r = rbCalc();
  if (!(r.usd > 0) || !r.gold) return `<p class="muted small">Enter the price and what's inside to see if it's worth it.</p>`;
  const [v, cls] = bundleVerdict(r.pct), kpi = (val, k) => `<div class="kpi"><b class="num">${val}</b><span>${k}</span></div>`;
  return `<div class="row between"><span class="pill ${cls} rb-verdict">${esc(v)}</span><b class="num">${fmt(r.pct)}% value</b></div>
    <div class="kpis">${kpi(fmt(r.gold), "Gold of stuff inside")}${kpi(fmt(r.per), "Gold per $1 here")}${kpi(fmt(r.base), "Gold per $1 from a Gold pack")}</div>
    <p class="small">${r.pct >= 100 ? `You'd get about ${(r.pct / 100).toFixed(1)}× what the same $${esc(r.usd.toFixed(2))} buys as plain Gold.` : `You'd get less than buying Gold with the same $${esc(r.usd.toFixed(2))}.`} It's only a good deal if you want what's inside.</p>
    <div class="tbl-wrap"><table><tbody>${r.parts.map(([n, g]) => `<tr><td>${esc(n)}</td><td class="n">${fmt(Math.round(g))}</td></tr>`).join("")}<tr><td><b>Total</b></td><td class="n"><b>${fmt(r.gold)}</b></td></tr></tbody></table></div>`;
}
function rbSheet() {
  const f = (k, l, step) => `<label class="f">${l}<input type="number" id="rb-${k}" data-rb="${k}" value="${esc(rb[k])}" min="0" step="${step}" inputmode="decimal"></label>`;
  return `${sheetHead("Rate a bundle", "Is it worth the money?")}
    <div class="grid2">${f("price", "Price ($)", "0.01")}${f("gold", "Gold", "1")}${f("credits", "Credits", "1")}${f("tokens", "Collector's Tokens", "1")}${f("vars", "Variants (how many)", "1")}${f("cos", "Card backs, avatars, titles", "1")}</div>
    <div id="rb-out" class="stack">${rbOut()}</div>
    <p class="muted small">How it's worked out, with the same values as the app's bundle ratings: Gold counts as itself, 500 Credits as 400 Gold and 1,000 Collector's Tokens as 1,300 Gold (the shop's own prices). A variant counts as ${fmt(RB_ITEM.vars)} Gold and a card back, avatar or title as ${fmt(RB_ITEM.cos)}, about what they cost in the shop. That's compared with a plain Gold pack for the same money: 100% is what Gold alone would give (about 70 to 80 Gold per $1).</p>
    <div class="row"><button class="btn ghost" data-a="rbClear">Clear</button></div>
    <button class="btn snap block" data-a="close">Done</button>`;
}

/* ============ 11. This week's Spotlight (Home › Shops), when the daily schedule has it ============
   Reads schedule.json "spotlight": { weeks: [{ start: "YYYY-MM-DD", end?: "YYYY-MM-DD", cards: ["name"], variants: ["Card - Variant" | { card, name, artist?, cat? }] }] }.
   A week without an end runs until the next week starts (or 7 days). Nothing shows when there's no week for today. */
function spotlightWeek() {
  const sp = obj(SCHED && SCHED.spotlight), today = localDate(Date.now()), isD = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
  const weeks = arr(sp.weeks).filter((w) => w && isD(w.start) && arr(w.cards).length).sort((a, b) => a.start.localeCompare(b.start));
  let cur = null;
  weeks.forEach((w, i) => { const end = isD(w.end) ? w.end : weeks[i + 1] ? localDate(dayStart(weeks[i + 1].start) - DAY) : localDate(dayStart(w.start) + 6 * DAY); if (w.start <= today && today <= end) cur = { ...w, end }; });
  return cur;
}
function spotlightHtml() {
  const w = spotlightWeek(); if (!w) return "";
  const cards = arr(w.cards).slice(0, 8).map((n) => ({ n: String(n).slice(0, 60), c: fuzzyCard(String(n)) }));
  const miss = cards.filter((x) => !(x.c && S.owned[x.c.key])).length;
  const vars = arr(w.variants).slice(0, 8).map((v) => {
    const o = typeof v === "string" ? { name: v } : obj(v); let cn = String(o.card || ""), nm = String(o.name || "");
    if (!cn && /\s[-–·]\s/.test(nm)) [cn, nm] = nm.split(/\s[-–·]\s/);
    const c = cn ? fuzzyCard(cn) : null, vv = o.cat ? allVariants().find((x) => x.cat === o.cat) : c ? matchVariant(c.key, nm, String(o.artist || "")) : null;
    return { label: [c ? c.name : cn, nm].filter(Boolean).join(" · ").slice(0, 80), own: !!(vv && vv.owned), wish: !!(vv && vv.wish) };
  }).filter((v) => v.label);
  return `<section class="sec spotweek"><h2>Spotlight this week</h2><div class="panel stack small"><span class="eyebrow">${esc(knDay(w.start))} – ${esc(knDay(w.end))}</span>
    <div class="chiplist">${cards.map((x) => (x.c ? cardChip(x.c.key, { a: "cardOpen", suffix: S.owned[x.c.key] ? ' <span class="muted">✓</span>' : "" }) : `<span class="cchip miss">${esc(x.n)}</span>`)).join("")}</div>
    <span>${miss ? `You're missing <b>${miss} of these ${cards.length}</b>. Each Spotlight Cache you open this week gives one you don't have yet.` : `You own all ${cards.length}, so this week's caches give you other rewards instead.`}</span>
    ${vars.length ? `<span class="eyebrow">Spotlight variants</span><div class="chiplist">${vars.map((v) => `<span class="cchip ${v.own ? "" : "miss"}">${v.wish ? "♥ " : ""}${esc(v.label)}${v.own ? ' <span class="muted">✓</span>' : ""}</span>`).join("")}</div>` : ""}
    <span class="muted small">From the app's daily schedule update. ✓ marks what you own.</span></div></section>`;
}
// Home › Shops (through a one-line hook in vShops): this week's Spotlight and the bundle calculator
function knowShopsHtml() {
  return `${spotlightHtml()}<section class="sec"><div class="panel row between nowrap" style="gap:10px"><span class="small" style="white-space:normal"><b>Thinking about a bundle?</b> See what it's really worth.</span><button class="btn sm" data-a="rbOpen">Rate a bundle</button></div></section>`;
}

/* ============ 7. News (Home › News, and the newest two on Home) ============
   Reads news.json next to the app, refreshed by a daily job: { updated, items: [{ title, url, date: "YYYY-MM-DD",
   kind: "patch" | "balance" | "news" | "ota", summary }] }. Cached on this phone like the other daily files. */
const NEWS = makeDataFile("news.json", "snapstat-news-v1", (j) => j && Array.isArray(j.items));
setTimeout(() => { try { NEWS.load(); } catch { /* no news yet */ } }, 0);
const NEWS_KIND = { patch: ["Patch notes", "gold"], balance: ["Balance", "warn"], news: ["News", "dim"], ota: ["Game update", "dim"] };
let _nwVer = -1, _nw = [];
function newsItems() {
  if (_nwVer === NEWS.ver) return _nw;
  _nw = arr(NEWS.data && NEWS.data.items).map((x0, i) => { const x = obj(x0); return { i, title: String(x.title || "").trim().slice(0, 200), url: safeUrl(String(x.url || "")), date: /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || "")) ? x.date : "", kind: NEWS_KIND[x.kind] ? x.kind : "news", summary: String(x.summary || "").trim().slice(0, 400) }; })
    .filter((x) => x.title).sort((a, b) => b.date.localeCompare(a.date) || a.i - b.i).slice(0, 60);
  _nwVer = NEWS.ver; return _nw;
}
function newsRow(x) {
  const [kl, kc] = NEWS_KIND[x.kind], fresh = x.date && x.date >= localDate(Date.now() - 3 * DAY);
  const inner = `<div class="grow"><div class="t" style="white-space:normal">${esc(x.title)}</div><div class="s"><span class="pill ${kc}">${esc(kl)}</span>${fresh ? ` <span class="pill W">New</span>` : ""} ${x.date ? esc(dateStr(x.date)) : ""}</div>${x.summary ? `<div class="s" style="white-space:normal">${esc(x.summary)}</div>` : ""}</div>`;
  return x.url ? `<a class="li news" href="${esc(x.url)}" target="_blank" rel="noopener">${inner}<span class="muted" aria-hidden="true">↗</span></a>` : `<div class="li news">${inner}</div>`;
}
function vNews() {
  const list = newsItems(), up = NEWS.data && NEWS.data.updated ? String(NEWS.data.updated).slice(0, 10) : "";
  return `<section class="sec"><h2>News</h2><p class="muted small">MARVEL SNAP news, patch notes and balance updates from marvelsnap.com${up && /^\d{4}-\d{2}-\d{2}$/.test(up) ? `, checked ${esc(dateStr(up))}` : ", checked daily"}. Tap one to read it there.</p>
    ${list.length ? `<div class="list">${list.map(newsRow).join("")}</div>` : `<div class="empty"><strong>No news yet</strong><span>News will appear here once the app's daily update runs.</span></div>`}</section>`;
}
function newsHomeHtml() {
  const list = newsItems().slice(0, 2); if (!list.length) return "";
  return `<section class="sec newshome"><div class="sec-h"><h2>News</h2><button class="btn sm ghost" data-a="go" data-to="home/news">All news ›</button></div><div class="list">${list.map(newsRow).join("")}</div></section>`;
}
EXT.homeSubs.push(["news", "News", vNews]);

/* ---------- Actions and inputs ---------- */
Object.assign(A, {
  glossKind: (el) => { ui.glKind = el.dataset.v || ""; render(); },
  glossCards: (el) => { ui.cardQ = el.dataset.q || ""; ui.cardCost = el.dataset.cost || "any"; ui.cardFilter = "all"; ui.cardSeries = ""; ui.powMin = ""; ui.powMax = ""; go("cards/cards"); try { window.scrollTo(0, 0); } catch { /* fine */ } },
  knBalance: () => { ui.balFilter = "decks"; go("home/balance"); },
  infOpen: () => { inf.rank = inf.cubes = inf.cpg = inf.gpd = null; openSheet(infSheet); },
  infReset: () => { inf.rank = inf.cubes = inf.cpg = inf.gpd = null; refreshSheet(); },
  rbOpen: () => openSheet(rbSheet),
  rbClear: () => { for (const k of Object.keys(rb)) rb[k] = ""; refreshSheet(); },
});
document.addEventListener("input", (e) => {
  const t = e.target, d = t && t.dataset; if (!d) return;
  if (d.inf) { inf[d.inf] = t.value === "" ? "" : num(t.value); const o = $("#inf-out"); if (o) o.innerHTML = infOut(); }
  if (d.rb) { rb[d.rb] = t.value; const o = $("#rb-out"); if (o) o.innerHTML = rbOut(); }
});

EXT.styles.push(`
.gl-row { flex-direction: column; align-items: stretch; gap: 6px; }
.gl-row .gl-d { margin: 0; line-height: 1.45; }
.gl-row .chiplist { margin-top: 2px; }
.loctips .chiplist { gap: 6px; }
.patchline { margin: 8px 0 0; line-height: 1.6; }
.knpatch .pill { flex: none; }
.upgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 10px; }
.upc { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; text-align: center; }
.upc .cchip { max-width: 100%; overflow: hidden; }
.upc .upf { font-size: 11px; line-height: 1.2; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.howget b { font-weight: 700; }
.newshome .li .s, .li.news .s { white-space: normal; }
.spotweek .chiplist { gap: 6px; }
`);
