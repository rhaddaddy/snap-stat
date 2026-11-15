/* ============ AI deck builder: pick up to 12 cards, built for the meta (Nov 14) ============
   Tap cards in the AI deck builder to lock them in (up to 12). The AI finds each one's best current meta deck, then fills the
   rest with the partners that win most with them. With all 12 picked it rates the deck against the meta and suggests swaps. */
ai.picks = [];
ai.metaSwaps = null; // { assessment, archetype, swaps: [{out,in,why}], picked: Set of indexes }
const AIP_MAX = 12;
function aipPanel() {
  const n = ai.picks.length;
  return `<div class="panel stack small" style="gap:6px">
    <div class="row between"><span class="eyebrow">Your cards · ${n} of ${AIP_MAX}</span>${n ? `<button class="btn sm ghost" data-a="aipClear">Clear</button>` : ""}</div>
    ${n ? `<div class="chiplist">${ai.picks.map((k) => cardChip(k, { a: "aipDrop", size: "xs" })).join("")}</div><span class="muted">Tap a card to take it out.</span>` : `<span class="muted">Search above and tap cards to add them (up to 12). The AI builds the rest around them from the current meta.</span>`}
    ${n === AIP_MAX ? `<span class="small">All 12 picked: the AI checks this deck against the meta and suggests what to swap.</span>` : n ? `<span class="small">The AI keeps these ${n} and adds the ${AIP_MAX - n} that work best with them in the meta.</span>` : ""}</div>`;
}
function aipMetaHtml() {
  const r = ai.metaSwaps; if (!r) return "";
  const keys = aipApplied();
  return `<div class="panel stack">${r.archetype ? `<span class="eyebrow">${esc(r.archetype)}</span>` : ""}${r.assessment ? `<p class="ai-out">${esc(r.assessment)}</p>` : ""}
    ${arr(r.perCard).length ? `<div class="stack">${r.perCard.map((x) => `<div class="small"><b>${esc(x.card)}</b> <span class="muted">${esc(x.meta || "")}</span></div>`).join("")}</div>` : ""}
    ${r.swaps.length ? `<h3>Swaps for the meta</h3>${r.swaps.map((s, i) => `<label class="check"><input type="checkbox" data-aipswap="${i}" ${r.picked.has(i) ? "checked" : ""}><span><b class="neg">−${esc(s.out)}</b> <b class="pos">+${esc(s.in)}</b><span class="muted small"> ${esc(s.why || "")}</span></span></label>`).join("")}` : `<p class="muted small">No swaps needed: this list already fits the meta well.</p>`}
    <div class="chiplist">${keys.map((k) => cardChip(k)).join("")}</div>${curveHtml(keys)}
    <button class="btn snap" data-a="aipSaveMeta">Save as deck${r.picked.size ? ` with ${r.picked.size} swap${r.picked.size === 1 ? "" : "s"}` : ""}</button></div>`;
}
function aipApplied() {
  const r = ai.metaSwaps; const keys = [...ai.picks];
  r.swaps.forEach((s, i) => { if (!r.picked.has(i)) return; const o = cardByName(s.out), n = cardByName(s.in); const j = o ? keys.indexOf(o.key) : -1; if (j >= 0 && n && !keys.includes(n.key)) keys[j] = n.key; });
  return keys;
}
if (typeof aiSheet === "function") {
  const _aip = aiSheet;
  aiSheet = function () { // eslint-disable-line no-func-assign
    let html = _aip();
    if (ai.improve) return html;
    html = html.replace(/(<label class="check"><input type="checkbox" data-aichk="ownedOnly")/, `${aipPanel()}$1`);
    html = html.replace(`${ICON.spark} Build deck`, `${ICON.spark} ${ai.picks.length === AIP_MAX ? "Check against the meta" : "Build deck"}`);
    if (ai.metaSwaps && !ai.busy && !ai.err) html += aipMetaHtml();
    return html.replace("tap to build around one", "tap to add to your cards");
  };
}
// The meta, as far as the app can tell it: each card's current cost/power/ability, the latest balance changes and your own results
function aipMetaContext(keys) {
  const recent = (typeof balanceChanges === "function" ? balanceChanges() : []).slice(0, 40).map((x) => `${card(x.key).name} ${x.kind} on ${x.date} (now ${x.to.cost}/${x.to.power})`).join("; ");
  const mine = keys.map((k) => { const ms = realMatches().filter((m) => S.decks.some((d) => d.id === m.deckId && d.cards.includes(k))); if (ms.length < 3) return ""; const st = statsFor(ms); return `${card(k).name}: ${st.w}-${st.l} in my decks`; }).filter(Boolean).join("; ");
  return `${recent ? `Latest balance changes (newest first): ${recent}.\n` : ""}${mine ? `My own results with these cards: ${mine}.\n` : ""}`;
}
function aipPool() { return allCards().filter((c) => !c.upcoming && c.cost !== "?" && !c.custom && (!ai.ownedOnly || S.owned[c.key] || ai.picks.includes(c.key))); }
const _aipBuild = runAiBuild;
runAiBuild = async function () { // eslint-disable-line no-func-assign
  ai.metaSwaps = null;
  if (!ai.picks.length || !store.sample) {
    await _aipBuild();
    // Without AI, picked cards still go in: swap them in for the lowest-cost cards that weren't picked
    if (ai.picks.length && ai.result && ai.result.cards) { const rest = ai.result.cards.filter((k) => !ai.picks.includes(k)); ai.result.cards = [...ai.picks, ...rest].slice(0, 12); refreshSheet(); }
    return;
  }
  const pool = aipPool(), picked = ai.picks.map((k) => card(k));
  if (ai.picks.length < AIP_MAX && pool.length < 12) { ai.err = "Mark at least 12 cards as owned, or turn off “Only use cards I own”."; refreshSheet(); return; }
  ai.busy = true; ai.err = ""; ai.result = null; ai.local = false; refreshSheet();
  try {
    ai.ctl = new AbortController();
    const base = `You are a top MARVEL SNAP competitive player who follows the current meta (the strongest decks on ladder and in tournaments right now, as of the most recent season you know). Use each card's CURRENT cost, power and ability as listed below; they include the latest balance changes.
${aipMetaContext(ai.picks)}${aiQ(ai.theme).head.length || aiQ(ai.theme).q ? `Style the player asked for: ${ai.theme}.\n` : ""}`;
    if (ai.picks.length === AIP_MAX) {
      const prompt = `${base}My 12-card deck: ${cardListForPrompt(picked)}.
For each card, name the meta deck it is best in. Then judge how well this deck fits the current meta and suggest up to 4 one-for-one swaps that make it a stronger meta deck (only if they really help).
Cards I can add (exact names): ${cardListForPrompt(pool.filter((c) => !ai.picks.includes(c.key)).slice(0, 220))}.
Reply with JSON only: {"archetype": "the meta deck this is closest to", "assessment": "2-3 sentences", "perCard": [{"card": name, "meta": "its best meta deck and role, short"}], "swaps": [{"out": card in my deck, "in": card from the add list, "why": "short reason"}]}`;
      const r = obj(await store.sample.json(prompt, { modelTier: "default", signal: ai.ctl.signal }));
      const inPool = new Set(pool.map((c) => c.key)), seen = new Set();
      const swaps = arr(r.swaps).filter((s) => { const o = cardByName(obj(s).out), n = cardByName(obj(s).in); if (!o || !n || !ai.picks.includes(o.key) || ai.picks.includes(n.key) || !inPool.has(n.key) || seen.has(o.key) || seen.has(n.key)) return false; seen.add(o.key); seen.add(n.key); return true; }).slice(0, 4)
        .map((s) => ({ out: cardByName(s.out).name, in: cardByName(s.in).name, why: String(s.why || "").slice(0, 200) }));
      ai.metaSwaps = { archetype: String(r.archetype || "").slice(0, 60), assessment: String(r.assessment || ""), perCard: arr(r.perCard).slice(0, 12).map((x) => ({ card: String(obj(x).card || ""), meta: String(obj(x).meta || "").slice(0, 120) })), swaps, picked: new Set(swaps.map((_, i) => i)) };
    } else {
      const need = AIP_MAX - ai.picks.length;
      const prompt = `${base}Build the strongest possible current-meta 12-card deck (no duplicates) that MUST include all of these cards: ${picked.map((c) => c.name).join(", ")}.
First work out the best meta deck for each of those cards, then find where they fit together, and add exactly ${need} more cards that win the most with them in today's meta (proven meta partners first, then curve and tech for the most popular opposing decks).
Use ONLY cards from this list, spelled exactly: ${cardListForPrompt(pool)}.
Reply with JSON only: {"name": string, "archetype": "the meta deck this is", "cards": [all 12 card names, including mine], "perCard": [{"card": one of my cards, "meta": "its best meta deck and role, short"}], "plan": "2-3 sentences on how to play it", "synergies": [{"cards": [names], "why": "short reason"}], "mulligan": "cards you want early"}`;
      const r = obj(await store.sample.json(prompt, { modelTier: "default", signal: ai.ctl.signal }));
      const allowed = new Set(pool.map((c) => c.key)), keys = [...ai.picks], unknown = [];
      arr(r.cards).forEach((nm) => { const c = cardByName(nm); if (c && allowed.has(c.key)) { if (!keys.includes(c.key) && keys.length < 12) keys.push(c.key); } else unknown.push(String(nm)); });
      const per = arr(r.perCard).map((x) => `${obj(x).card}: ${obj(x).meta}`).filter((x) => x.length > 3).join(" · ");
      ai.result = { name: String(r.name || "Meta deck").slice(0, 40), cards: keys, plan: [r.archetype ? `Meta deck: ${r.archetype}.` : "", String(r.plan || ""), per ? `Where your cards shine: ${per}.` : ""].filter(Boolean).join(" "), synergies: arr(r.synergies).slice(0, 6), mulligan: String(r.mulligan || ""), unknown };
      if (keys.length < 12) ai.result.unknown.push(`The AI only found ${keys.length} cards; add the rest by hand`);
    }
  } catch (e) { ai.err = aiErr(e); }
  ai.busy = false; refreshSheet();
};
function aipToggle(k) {
  const i = ai.picks.indexOf(k);
  if (i >= 0) ai.picks.splice(i, 1);
  else if (ai.picks.length >= AIP_MAX) { toast("You've picked 12 cards. Tap one to take it out first."); return; }
  else { ai.picks.push(k); const el = document.getElementById("ai-theme"); ai.theme = aiQ(el ? el.value : ai.theme).head.join(" + "); }
  ai.metaSwaps = null; refreshSheet();
}
Object.assign(A, {
  aiSuggCard: (el) => aipToggle(el.dataset.k),
  aipDrop: (el) => aipToggle(el.dataset.k),
  aipClear: () => { ai.picks = []; ai.metaSwaps = null; refreshSheet(); },
  aipSaveMeta: () => { const r = ai.metaSwaps; if (!r) return; const d = newDeck(r.archetype || "Meta deck", aipApplied()); closeSheet(); render(); openDeck(d.id); toast("Deck saved"); },
});
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || t.dataset.aipswap === undefined || !ai.metaSwaps) return; const i = num(t.dataset.aipswap); if (t.checked) ai.metaSwaps.picked.add(i); else ai.metaSwaps.picked.delete(i); refreshSheet(); });
