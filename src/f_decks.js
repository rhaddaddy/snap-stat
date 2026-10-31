/* ============ Decks ============ */
let deId = null; const deckEdit = () => S.decks.find((d) => d.id === deId);
const DECK_STATUS = { active: "Ready", draft: "Draft", future: "Future" };
function deckCover(d) { return deckIcon(d); }
function vDecks() {
  const f = ui.deckFilter || "all";
  // A tag filter for a tag no deck has any more is dropped (it left the list empty with nothing to clear it)
  if (ui.deckTag && !allDeckTags().includes(ui.deckTag)) ui.deckTag = "";
  const list0 = S.decks.filter((d) => (f === "all" || d.status === f) && (!ui.deckTag || deckTags(d).includes(ui.deckTag))); const list = typeof deckListOrder === "function" ? deckListOrder(list0) : list0;
  const chip = (v, l) => `<button class="chip" data-a="deckFilter" data-v="${v}" aria-pressed="${f === v}">${l} <span class="muted num">${v === "all" ? S.decks.length : S.decks.filter((d) => d.status === v).length}</span></button>`;
  return `<section class="sec"><h1>Decks</h1>
    <div class="grid2"><button class="btn snap" data-a="deckNew">${ICON.plus} New deck</button><button class="btn" data-a="aiOpen">${ICON.spark} AI deck builder</button>
    <button class="btn" data-a="draftOpen">Draft a deck</button><button class="btn" data-a="importOpen">Paste deck code</button>
    <button class="btn" data-a="svOpen">Import from SnapVault</button><button class="btn" data-a="dhOpen">Draft helper</button></div>
    <div class="chips">${chip("all", "All")}${chip("active", "Ready")}${chip("draft", "Drafts")}${chip("future", "Future")}</div>${deckTagFilterHtml()}${typeof deckSortHtml === "function" ? deckSortHtml() : ""}</section>
  <section class="sec">${list.length ? `<div class="list">${list.map((d) => { const r = statsFor(deckMatches(d)); const avg = avgCost(d.cards); return `<button class="li" data-a="deckOpen" data-id="${esc(d.id)}">${deckCover(d)}<div class="grow"><div class="t">${esc(d.name)} ${d.status !== "active" ? `<span class="pill dim">${DECK_STATUS[d.status]}</span>` : ""}${S.me.featuredDeck === d.id ? ` <span class="pill gold">Featured</span>` : ""}${d.public ? ` <span class="pill dim">Public</span>` : ""}${d.example ? ` <span class="pill dim">Example</span>` : ""}${typeof deckRowPills === "function" ? deckRowPills(d) : ""}</div>${deckTagsRow(d, true)}<div class="s">${d.cards.length}/12 cards · avg cost ${avg}${r.games ? ` · ${r.w}-${r.l}-${r.t}` : ""}${d.svRecord && (d.svRecord.w || d.svRecord.l) ? ` · SnapVault ${num(d.svRecord.w)}-${num(d.svRecord.l)}` : ""}${d.from ? " · from " + esc(d.from) : ""}</div>${typeof deckRowInfo === "function" ? deckRowInfo(d) : ""}</div>${r.games ? `<span class="num" style="font-weight:800">${r.wr}%</span>` : ""}</button>`; }).join("")}</div>`
    : `<div class="empty"><strong>No decks here</strong><span>Build one from your cards, paste a code copied from the game, draft one, or let AI build it.</span></div>`}</section>
  ${buildableHtml()}
  ${metaSection()}`;
}
function avgCost(keys) { const cs = keys.map(card).filter((c) => c.cost !== "?" && c.cost !== ""); const miss = keys.length - cs.length; return (cs.length ? (cs.reduce((s, c) => s + num(c.cost), 0) / cs.length).toFixed(1) : "—") + (miss ? ` (${miss} missing cost)` : ""); }
function curveHtml(keys) {
  const counts = [0, 0, 0, 0, 0, 0]; keys.filter((k) => card(k).cost !== "?").forEach((k) => { const c = num(card(k).cost); counts[clamp(c <= 1 ? 0 : c - 1, 0, 5)]++; });
  const max = Math.max(1, ...counts);
  return `<div class="curve" role="img" aria-label="Cost curve">${counts.map((n, i) => `<div><span class="num">${n || ""}</span><i style="height:${(n / max) * 70}%"></i><span>${i === 0 ? "≤1" : i === 5 ? "6+" : i + 1}</span></div>`).join("")}</div>`;
}
function tagSummary(keys) { const t = {}; keys.forEach((k) => card(k).tags.forEach((x) => (t[x] = (t[x] || 0) + 1))); return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([x, n]) => `<span class="pill dim">${esc(TAGS[x] || x)} ×${n}</span>`).join(" "); }
function deckSheet() {
  const d = deckEdit(); if (!d) return sheetHead("Deck not found");
  const tab = ui.deckTab || "cards";
  const t = (v, l) => `<button data-a="deckTab" data-v="${v}" aria-pressed="${tab === v}">${l}</button>`;
  const ext = extBody(EXT.deckTabs, tab);
  const body = tab === "stats" ? deckStatsHtml(d) : tab === "versions" ? deckVersionsHtml(d) : tab === "test" ? deckTestHtml(d) : tab === "compare" ? deckCompareHtml(d) : ext ? extHtml([arr(EXT.deckTabs).find((x) => x[0] === tab)[2]], d) : deckCardsHtml(d) + extHtml(EXT.deckSheet, d);
  return `${sheetHead(esc(d.name), `${d.cards.length} / 12 cards · ${DECK_STATUS[d.status] || "Ready"}`)}<div class="seg">${t("cards", "Cards")}${t("stats", "Stats")}${t("versions", "Versions")}${t("test", "Test")}${t("compare", "Compare")}${extSubs(EXT.deckTabs).map(([k, l]) => t(k, l)).join("")}</div>${body}`;
}
function deckCardsHtml(d) {
  const cs = [...d.cards].sort((a, b) => num(card(a).cost) - num(card(b).cost));
  const avg = avgCost(cs);
  const missing = cs.filter((k) => !String(k).startsWith("custom:") && !S.owned[k]).length;
  const hasCustom = cs.some((k) => String(k).startsWith("custom:"));
  return `<label class="f">Deck name<input type="text" id="de-name" data-deck="name" value="${esc(d.name)}"></label>
    <div class="seg">${Object.entries(DECK_STATUS).map(([v, l]) => `<button data-a="deckStatus" data-v="${v}" aria-pressed="${d.status === v}">${l}</button>`).join("")}</div>
    ${deckLookHtml(d)}
    <div class="row between"><span class="muted small">Avg cost ${avg}${missing ? ` · ${missing} not owned` : ""}</span></div>
    <div class="list">${cs.map((k) => { const c = card(k); const vs = S.variants.filter((v) => v.card === k && v.owned); const cur = obj(d.variants)[k] || ""; return `<div class="li">${cardChip(k, { deck: d })}${(() => { const x = recentChange(k, 30); return x ? `<span class="pill ${BAL_PILL[x.kind]}" title="${esc(dateStr(x.date))}: ${statLine(x.from)} → ${statLine(x.to)}">${BAL_LABEL[x.kind]}</span>` : ""; })()}<div class="grow"></div>${c.custom ? `<span class="pill dim">Custom</span>` : vs.length ? `<select data-deckvar="${esc(k)}" aria-label="Variant for ${esc(c.name)}" style="width:auto;max-width:46%;padding:5px 8px;font-size:13px"><option value="">${favVariant(k) ? "Favorite: " + esc(favVariant(k).name) : "Default"}</option>${vs.map((v) => `<option value="${esc(v.id)}" ${cur === v.id ? "selected" : ""}>${esc(v.name + byArtist(v))}</option>`).join("")}</select>` : ""}<button class="x" data-a="deckRemove" data-k="${esc(k)}" aria-label="Remove ${esc(c.name)}">${ICON.x}</button></div>`; }).join("") || `<div class="li muted small">No cards yet.</div>`}</div>
    <button class="btn" data-a="deckAddCards">${ICON.plus} Add cards</button>
    ${typeof deckBuildHtml === "function" ? deckBuildHtml(d, cs) : `${cs.length ? curveHtml(cs) : ""}${cs.length ? `<div class="row">${tagSummary(cs)}</div>` : ""}`}
    ${hasCustom ? `<p class="note">Custom cards stay in the app. They're left out of the code you paste into the game.</p>` : ""}
    <label class="toggle-row check"><span>Public: show this deck and its record when others compare decks</span><input type="checkbox" data-deckchk="public" ${d.public ? "checked" : ""}></label>
    <label class="toggle-row check"><span>Featured deck on my profile</span><input type="checkbox" data-deckchk="featured" ${S.me.featuredDeck === d.id ? "checked" : ""}></label>
    <div class="grid2"><button class="btn snap" data-a="deckCopy" ${cs.length ? "" : "disabled"}>${ICON.copy} Copy deck code</button><button class="btn" data-a="deckCopyList" ${cs.length ? "" : "disabled"}>${ICON.copy} Copy card list</button>
    <button class="btn" data-a="aiImprove">${ICON.spark} Improve with AI</button><button class="btn" data-a="postDeck" ${cs.length ? "" : "disabled"}>Post to feed</button><button class="btn" data-a="deckImage" ${cs.length ? "" : "disabled"}>Share as a picture</button><button class="btn" data-a="deckLink" ${cs.length ? "" : "disabled"}>Share a link</button></div>
    <button class="btn" data-a="deckDup">Duplicate</button>
    <p class="muted small">The deck code is in the game's own format: paste it in the game's deck menu. The card list shows your favorite variant for each card, for sharing anywhere else.</p>
    <button class="btn danger" data-a="deckDelete">${ui.deckDelArm === d.id ? "Tap again to delete this deck" : "Delete deck"}</button>`;
}
function deckStatsHtml(d) {
  const ins = deckInsights(d); const st = statsFor(ins.ms);
  const sv = d.svRecord && (num(d.svRecord.w) || num(d.svRecord.l)) ? `<div class="panel row between"><span class="small">SnapVault record${num(d.svRecord.versions) > 1 ? ` across ${num(d.svRecord.versions)} versions` : ""}</span><b class="num">${num(d.svRecord.w)}-${num(d.svRecord.l)} · ${pct(num(d.svRecord.w), num(d.svRecord.w) + num(d.svRecord.l))}%</b></div>` : "";
  if (!ins.ms.length) return `${sv}<div class="empty"><strong>No games with this deck tracked here yet</strong><span>Start a live match with it from Home › Live match. Tracked games fill in card and location stats here.</span></div>`;
  const pick = (r, l, v) => r ? `<div class="tile"><div class="k">${l}</div><div class="v" style="font-size:17px">${esc(card(r.k).name)}</div><div class="small muted">${v(r)}</div></div>` : "";
  return `${sv}<div class="tiles"><div class="tile"><div class="k">Record</div><div class="v">${st.w}-${st.l}-${st.t}</div></div><div class="tile"><div class="k">Win rate</div><div class="v">${st.wr}%</div></div><div class="tile"><div class="k">Net cubes</div><div class="v ${st.cubes >= 0 ? "pos" : "neg"}">${signed(st.cubes)}</div></div></div>
    ${ins.tracked ? `<div class="tiles">${pick(ins.mvp, "MVP", (r) => `${r.wr}% when played`)}${pick(ins.most, "Most played", (r) => `${r.rate}% of games`)}${pick(ins.highest, "Highest power", (r) => `${r.max} power`)}${pick(ins.least, "Least used", (r) => `${r.rate}% of games`)}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Card</th><th class="n">Played</th><th class="n">W-L</th><th class="n">Win %</th><th class="n">Cube impact</th><th class="n wd">Avg pow</th><th class="n wd">Best</th></tr></thead><tbody>${(() => { const imp = cardImpact(ins.ms, ins.rows.map((r) => r.k)); return [...ins.rows].sort((a, b) => b.played - a.played).map((r) => `<tr><td>${esc(card(r.k).name)}</td><td class="n">${r.rate}%</td><td class="n">${r.w}-${r.l}</td><td class="n">${r.played ? r.wr + "%" : "—"}</td><td class="n ${imp[r.k] > 0 ? "pos" : imp[r.k] < 0 ? "neg" : ""}">${imp[r.k] !== undefined ? signed(imp[r.k]) : "—"}</td><td class="n wd">${r.avg || "—"}</td><td class="n wd">${r.max || "—"}</td></tr>`).join(""); })()}</tbody></table></div>
    ${ins.locs.length ? `<h3>Locations</h3>${locHelpHurt(ins.locs)}<div class="tbl-wrap"><table><thead><tr><th>Location</th><th class="n">Games</th><th class="n">Match W%</th><th class="n">Won it</th><th class="n wd">Avg pow</th><th class="n wd">Best</th></tr></thead><tbody>${ins.locs.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${r.games}</td><td class="n">${r.wr}%</td><td class="n">${r.lwr}%</td><td class="n wd">${r.avg}</td><td class="n wd">${r.max}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <p class="muted small">From ${ins.tracked} tracked game${ins.tracked === 1 ? "" : "s"}. “Played” counts games where the card hit the board.</p>
    <button class="btn snap" data-a="aiImprove">${ICON.spark} Suggest swaps from these stats</button>`
    : `<p class="note">These games were logged without the live tracker, so there are no card or location stats yet.</p>`}`;
}
function publicDecks() {
  const out = [];
  for (const [owner, doc] of Object.entries(shared.decks)) { if (owner === store.uid || !canSee(owner)) continue; arr(doc.items).forEach((x) => out.push({ ...x, owner })); }
  return out;
}
function deckCompareHtml(d) {
  if (store.mode !== "cloud") return `<div class="empty"><span>Comparing with other players' public decks works in the signed-in, shared app.</span></div>`;
  const mine = new Set(d.cards.map((k) => keyOf(card(k).name)));
  const rows = publicDecks().map((x) => ({ ...x, overlap: arr(x.cards).filter((n) => mine.has(keyOf(n))).length })).filter((x) => x.overlap >= Math.min(6, mine.size)).sort((a, b) => b.overlap - a.overlap || num(obj(b.stats).games) - num(obj(a.stats).games));
  const same = rows.filter((x) => x.overlap >= Math.max(1, mine.size - 1));
  const agg = same.reduce((s, x) => ({ g: s.g + num(obj(x.stats).games), w: s.w + num(obj(x.stats).w), l: s.l + num(obj(x.stats).l) }), { g: 0, w: 0, l: 0 });
  const me = statsFor(deckMatches(d).filter((m) => !m.example));
  return `<div class="tiles"><div class="tile"><div class="k">You</div><div class="v">${me.games ? me.wr + "%" : "—"}</div><div class="small muted">${me.games} games</div></div><div class="tile"><div class="k">Same build</div><div class="v">${agg.g ? pct(agg.w, agg.w + agg.l) + "%" : "—"}</div><div class="small muted">${same.length} decks · ${agg.g} games</div></div></div>
    ${rows.length ? `<div class="list">${rows.slice(0, 30).map((x) => `<div class="li">${avatarHtml(prof(x.owner)?.avatar, handleOf(x.owner), x.owner)}<div class="grow"><div class="t">${esc(x.name)} <span class="muted">· ${esc(handleOf(x.owner))}</span></div><div class="s">${x.overlap}/12 same cards · ${num(obj(x.stats).games)} games · ${num(obj(x.stats).wr)}%</div></div><button class="btn sm" data-a="saveSharedDeck" data-owner="${esc(x.owner)}" data-id="${esc(x.id)}">${ICON.save} Save</button></div>`).join("")}</div>`
      : `<div class="empty"><span>No public decks share 6 or more cards with this one yet. Decks appear here when players mark them public.</span></div>`}`;
}

const draft = { pool: "owned", picks: [], opts: [], on: false };
function draftRoll() { const pool = allCards().filter((c) => !c.upcoming && c.cost !== "?" && (draft.pool === "all" || S.owned[c.key]) && !draft.picks.includes(c.key)); const opts = []; const p = [...pool]; while (opts.length < 3 && p.length) opts.push(p.splice(Math.floor(Math.random() * p.length), 1)[0].key); draft.opts = opts; }
function draftSheet() {
  if (!draft.on) {
    const ownedN = allCards().filter((c) => S.owned[c.key]).length;
    return `${sheetHead("Draft a deck", "Pick 1 of 3 cards, 12 times")}
      <div class="seg"><button data-a="draftPool" data-v="owned" aria-pressed="${draft.pool === "owned"}">My cards (${ownedN})</button><button data-a="draftPool" data-v="all" aria-pressed="${draft.pool === "all"}">All cards</button></div>
      ${draft.pool === "owned" && ownedN < 14 ? `<p class="note">Mark at least 14 cards as owned in Collection to draft from your own cards.</p>` : ""}
      <button class="btn snap" data-a="draftStart" ${draft.pool === "owned" && ownedN < 14 ? "disabled" : ""}>Start drafting</button>`;
  }
  if (draft.picks.length >= 12 || !draft.opts.length) return `${sheetHead("Your draft", `${draft.picks.length} cards`)}${curveHtml(draft.picks)}<div class="chiplist">${draft.picks.map((k) => cardChip(k)).join("")}</div>
      <label class="f">Deck name<input type="text" id="dr-name" value="Draft ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}"></label><div class="row"><button class="btn snap" data-a="draftSave">Save deck</button><button class="btn" data-a="draftStart">Draft again</button></div>`;
  return `${sheetHead(`Pick ${draft.picks.length + 1} of 12`, "Choose one")}<div class="grid3">${draft.opts.map((k) => cardFace(card(k), { a: "draftPick", cls: "own", sub: card(k).ability ? "" : "" })).join("")}</div>
    <div class="stack small">${draft.opts.map((k) => `<div><b>${esc(card(k).name)}:</b> <span class="muted">${esc(card(k).ability || "No ability")}</span></div>`).join("")}</div>
    ${draft.picks.length ? `<div class="chiplist">${draft.picks.map((k) => cardChip(k, { noOwn: true })).join("")}</div>` : ""}`;
}

const ai = { theme: "", ownedOnly: true, busy: false, result: null, err: "", improve: null, ctl: null, local: false };
function aiSheet() {
  const improving = ai.improve && S.decks.find((d) => d.id === ai.improve);
  const head = sheetHead(improving ? "Improve deck" : "AI deck builder", improving ? esc(improving.name) : "Builds a deck where the cards work together");
  const form = improving ? `<label class="check"><input type="checkbox" data-aichk="ownedOnly" ${ai.ownedOnly ? "checked" : ""}> Only suggest cards I own</label>`
    : `<label class="f">Build around<input type="text" id="ai-theme" data-ai="theme" value="${esc(ai.theme)}" placeholder="A card, a combo, or a style like 'discard' or 'move'"></label><label class="check"><input type="checkbox" data-aichk="ownedOnly" ${ai.ownedOnly ? "checked" : ""}> Only use cards I own</label>`;
  const note = store.sample ? "" : `<p class="note">AI isn't available in this view, so suggestions come from card effects and your stats.</p>`;
  let out = "";
  if (ai.busy) out = `<p class="muted">Thinking…</p>`;
  else if (ai.err) out = `<p class="note">${esc(ai.err)}</p>`;
  else if (ai.result && ai.result.cards) {
    const r = ai.result;
    out = `<div class="panel stack"><h3>${esc(r.name || "Suggested deck")}</h3>${ai.local ? `<span class="pill dim">Synergy pick</span>` : ""}<div class="chiplist">${r.cards.map((k) => cardChip(k)).join("")}</div>${curveHtml(r.cards)}
      ${r.plan ? `<p class="ai-out">${esc(r.plan)}</p>` : ""}${arr(r.synergies).length ? `<div class="stack">${r.synergies.map((s) => `<div class="small"><b>${esc(arr(s.cards).join(" + "))}</b> <span class="muted">${esc(s.why || "")}</span></div>`).join("")}</div>` : ""}
      ${r.mulligan ? `<p class="small"><b>Want early:</b> ${esc(r.mulligan)}</p>` : ""}${arr(r.unknown).length ? `<p class="muted small">Skipped cards not in your list: ${esc(r.unknown.join(", "))}</p>` : ""}
      <button class="btn snap" data-a="aiSave">Save as deck</button></div>`;
  } else if (ai.result && ai.result.swaps) {
    const r = ai.result;
    out = `<div class="panel stack">${r.assessment ? `<p class="ai-out">${esc(r.assessment)}</p>` : ""}
      ${arr(r.swaps).map((s, i) => `<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div class="small" style="min-width:0;flex:1"><b class="neg">−${esc(s.out)}</b> <b class="pos">+${esc(s.in)}</b><div class="muted">${esc(s.why || "")}</div></div><button class="btn sm" data-a="aiSwap" data-i="${i}">Swap</button></div>`).join("") || `<p class="muted small">No swaps suggested.</p>`}
      ${arr(r.synergies).length ? `<h3>Combos in this deck</h3>${r.synergies.map((s) => `<div class="small"><b>${esc(arr(s.cards).join(" + "))}</b> <span class="muted">${esc(s.why || "")}</span></div>`).join("")}` : ""}</div>`;
  }
  return `${head}${form}${note}<div class="row"><button class="btn snap" data-a="${improving ? "aiRunImprove" : "aiRun"}" ${ai.busy ? "disabled" : ""}>${ICON.spark} ${improving ? "Suggest swaps" : "Build deck"}</button>${ai.busy ? `<button class="btn ghost" data-a="aiStop">Stop</button>` : ""}</div>${out}`;
}
function cardListForPrompt(pool) { return pool.map((c) => `${c.name} (${c.cost}/${c.power}${c.ability ? ": " + c.ability : ""})`).join("; "); }
function aiErr(e) { return e && e.code === "not_granted" ? "AI access wasn't allowed for this page." : e && e.code === "rate_limited" ? "AI is busy. Try again in a minute." : e && (e.name === "AbortError" || e.code === "aborted") ? "Stopped." : "Couldn't get a suggestion. Try again."; }
async function runAiBuild() {
  const pool = allCards().filter((c) => !c.upcoming && c.cost !== "?" && (!ai.ownedOnly || S.owned[c.key]));
  if (pool.length < 12) { ai.err = "Mark at least 12 cards as owned, or turn off “Only use cards I own”."; refreshSheet(); return; }
  ai.busy = true; ai.err = ""; ai.result = null; ai.local = false; refreshSheet();
  try {
    if (!store.sample) { ai.result = localBuild(ai.theme, pool); ai.local = true; }
    else {
      ai.ctl = new AbortController();
      const prompt = `You are an expert MARVEL SNAP deck builder. Build one legal 12-card deck (no duplicates)${ai.theme ? ` built around: ${ai.theme}` : ""}.
Use ONLY cards from this list, spelled exactly as written: ${cardListForPrompt(pool)}.
Pick cards that combo well together, keep a playable energy curve for a 6-turn game, and give the deck a clear way to win.
Reply with JSON only: {"name": string, "cards": [12 card names], "plan": "2-3 sentences on how to play it", "synergies": [{"cards": [card names], "why": "short reason"}], "mulligan": "cards you want in your opening hand"}`;
      const r = await store.sample.json(prompt, { modelTier: "default", signal: ai.ctl.signal });
      const keys = [], unknown = [];
      const allowed = new Set(pool.map((c) => c.key));
      arr(r && r.cards).forEach((n) => { const c = cardByName(n); if (c && allowed.has(c.key) && !keys.includes(c.key)) keys.push(c.key); else if (!c || !allowed.has(c.key)) unknown.push(String(n) + (c && ai.ownedOnly && !S.owned[c.key] ? " (not owned)" : "")); });
      ai.result = { name: String(r.name || "AI deck").slice(0, 40), cards: keys.slice(0, 12), plan: String(r.plan || ""), synergies: arr(r.synergies).slice(0, 6), mulligan: String(r.mulligan || ""), unknown };
    }
  } catch (e) { ai.err = aiErr(e); }
  ai.busy = false; refreshSheet();
}
async function runAiImprove() {
  const d = S.decks.find((x) => x.id === ai.improve); if (!d) return;
  ai.busy = true; ai.err = ""; ai.result = null; refreshSheet();
  const pool = allCards().filter((c) => !c.upcoming && c.cost !== "?" && (!ai.ownedOnly || S.owned[c.key]) && !d.cards.includes(c.key));
  const ins = deckInsights(d); const st = statsFor(ins.ms);
  try {
    if (!store.sample) ai.result = localImprove(d, pool, ins);
    else {
      ai.ctl = new AbortController();
      const statLines = ins.rows.map((r) => `${card(r.k).name}: played in ${r.rate}% of games, ${r.wr}% win rate when played, avg ${r.avg} power, best ${r.max}`).join("; ");
      const prompt = `You are an expert MARVEL SNAP coach. Suggest up to 3 one-for-one swaps that make this deck stronger, using the player's own stats.
Deck "${d.name}": ${d.cards.filter((k) => !String(k).startsWith("custom:")).map((k) => `${card(k).name} (${card(k).cost}/${card(k).power})`).join(", ")}.
${st.games ? `Record: ${st.w} wins, ${st.l} losses over ${st.games} games, ${st.cubes} net cubes.` : "No games logged yet."}
${statLines ? `Per-card stats from tracked games: ${statLines}.` : ""}${ins.mvp ? ` MVP: ${card(ins.mvp.k).name}.` : ""}${ins.least ? ` Least used: ${card(ins.least.k).name}.` : ""}
Cards available to add (exact names): ${cardListForPrompt(pool.slice(0, 160))}.
Favor swapping out cards that are rarely played or lose when played, for cards that combo with the deck's best performers.
Reply with JSON only: {"assessment": "2-3 sentences", "swaps": [{"out": card in deck, "in": card from available list, "why": "short reason citing the stats"}], "synergies": [{"cards": [names in the deck], "why": "short reason"}]}`;
      const r = await store.sample.json(prompt, { modelTier: "default", signal: ai.ctl.signal });
      const inPool = new Set(pool.map((c) => c.key));
      ai.result = { assessment: String(obj(r).assessment || ""), swaps: arr(obj(r).swaps).filter((s) => { const o = cardByName(obj(s).out), n = cardByName(obj(s).in); return o && n && d.cards.includes(o.key) && inPool.has(n.key); }).slice(0, 3), synergies: arr(obj(r).synergies).slice(0, 5) };
    }
  } catch (e) { ai.err = aiErr(e); }
  ai.busy = false; refreshSheet();
}
function synergyScore(c, tags) { return c.tags.reduce((s, t) => s + (tags[t] || 0), 0); }
function localBuild(theme, pool) {
  const q = keyOf(theme); const anchors = pool.filter((c) => q && (c.key.includes(q) || q.includes(c.key)));
  const tagHit = Object.entries(TAGS).find(([, v]) => q && keyOf(v).includes(q)); const tags = {};
  anchors.forEach((a) => a.tags.forEach((t) => (tags[t] = (tags[t] || 0) + 3))); if (tagHit) tags[tagHit[0]] = (tags[tagHit[0]] || 0) + 4;
  if (!Object.keys(tags).length) pool.forEach((c) => c.tags.forEach((t) => (tags[t] = (tags[t] || 0) + 0.2)));
  const want = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1 };
  const ranked = pool.map((c) => ({ c, s: synergyScore(c, tags) + (anchors.includes(c) ? 100 : 0) + Math.random() * 0.8 })).sort((a, b) => b.s - a.s);
  const pick = [];
  for (const { c } of ranked) { const b = clamp(num(c.cost) || 1, 1, 6); if (want[b] > 0 || anchors.includes(c)) { pick.push(c.key); want[b]--; } if (pick.length === 12) break; }
  for (const { c } of ranked) { if (pick.length >= 12) break; if (!pick.includes(c.key)) pick.push(c.key); }
  const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => TAGS[t]);
  return { name: (anchors[0] ? anchors[0].name : top[0] || "Synergy") + " deck", cards: pick, plan: `Built from cards that share ${top.join(" and ").toLowerCase() || "common"} effects, with a curve that plays something every turn.`, synergies: [], mulligan: "" };
}
function localImprove(d, pool, ins) {
  const tags = {}; d.cards.forEach((k) => card(k).tags.forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
  const perf = (k) => { const r = ins.rows.find((x) => x.k === k); return r && r.played ? r.wr / 100 + r.rate / 200 : 0.5; };
  const weakest = [...d.cards].filter((k) => !String(k).startsWith("custom:")).sort((a, b) => synergyScore(card(a), tags) * 0.2 + perf(a) - (synergyScore(card(b), tags) * 0.2 + perf(b))).slice(0, 3);
  const best = pool.map((c) => ({ c, s: synergyScore(c, tags) })).sort((a, b) => b.s - a.s); const swaps = [];
  weakest.forEach((k) => { const o = card(k); const rep = best.find(({ c }) => Math.abs(num(c.cost) - num(o.cost)) <= 1 && !swaps.some((s) => s.in === c.name)); const r = ins.rows.find((x) => x.k === k); if (rep) swaps.push({ out: o.name, in: rep.c.name, why: r && r.played ? `${o.name} wins ${r.wr}% when played and hits the board in ${r.rate}% of games. ${rep.c.name} shares more effects with the deck.` : `${rep.c.name} shares more effects with the rest of the deck at a similar cost.` }); });
  return { assessment: `Looks at how often each card is played and wins, plus the deck's main effects (${Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => TAGS[t].toLowerCase()).join(", ")}).`, swaps, synergies: [] };
}
const imp = { text: "", res: null };
function importSheet() {
  return `${sheetHead("Paste a deck code", "Copy a deck in the game or from a post, then paste it here")}${shotInput("deck")}
    <textarea id="imp-text" class="code" data-imp="text" placeholder="Paste the deck code">${esc(imp.text)}</textarea><button class="btn" data-a="importParse">Read deck</button>
    ${imp.res ? (imp.res.cards.length ? `<div class="panel stack"><label class="f">Deck name<input type="text" id="imp-name" value="${esc(imp.res.name || "Imported deck")}"></label><div class="chiplist">${imp.res.cards.map((k) => cardChip(k, { suffix: imp.res.variants[k] ? ` <span class="muted">· ${esc(imp.res.variants[k])}</span>` : "" })).join("")}</div>${imp.res.unknown.length ? `<p class="muted small">${imp.res.unknown.length} card${imp.res.unknown.length > 1 ? "s aren't" : " isn't"} in the app's list yet (${esc(imp.res.unknown.join(", "))}). ${arr(imp.res.unknownCodes).length ? "They'll be added as Unknown card so you can rename them." : "Add them in Collection."}</p>` : ""}
      <label class="f">Save as<select id="imp-status">${Object.entries(DECK_STATUS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label><button class="btn snap" data-a="importSave">Save deck</button></div>` : `<p class="note">Couldn't find any cards in that text. Copy the deck again and paste the whole thing.</p>`) : ""}`;
}
