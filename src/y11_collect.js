/* ============ Collectibles: where each one comes from, and ticking the ones you have ============
   For a season or event's cards, variants, avatars, titles and card backs this works out where to get each one
   (the season pass level from your screenshots of the pass, the Premium or Premium+ pass, an event's reward track
   or shop, the Collector's Token shop, a bundle, or what the season's announcement says), and ticks "Got it" when
   your collection, your screenshots or your pass level show you have it. Anything you tick or untick yourself stays
   that way. */
const KIND_WORD = { variant: /variant/, avatar: /avatar|icon/, title: /title/, cardback: /cardback|back/, emote: /emote/, border: /border/ };
const collKey = (src, it) => `${keyOf(src)}|${it.kind}|${keyOf(it.name)}`;
const collAnyKey = (it) => `*|${it.kind}|${keyOf(it.name)}`;
// How well a reward's text (from a pass, a reward track or a shop) matches a collectible, word by word: 0 is no match,
// 1 or 2 is "probably" (shown as where to get it), 3 or more is the same thing (and only that ticks it as yours).
// Matching whole words stops "Red Hulk Venomized Rider Variant" counting as a Hulk variant, or "Giant-Man" as Ant-Man.
const KIND_OF_WORD = { variant: "variant", variants: "variant", avatar: "avatar", avatars: "avatar", icon: "avatar", title: "title", titles: "title", cardback: "cardback", back: "cardback", emote: "emote", emotes: "emote", border: "border", borders: "border", card: "card" };
const rewardWords = (t) => String(t || "").toLowerCase().replace(/card\s*backs?/g, "cardback").replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
function rewardScore(text, it) {
  const rw = rewardWords(text); if (!rw.length) return 0;
  const sv = it.kind === "variant" ? splitVariant(it.name) : null;
  const base = sv ? sv.card : String(it.name).replace(/^.*?:\s*/, "");
  const bw = rewardWords(it.kind === "cardback" ? base.replace(/\s*#?\d{1,3}$/, "") : base); if (bw.join("").length < 3) return 0;
  const said = new Set(rw.filter((w) => !bw.includes(w)).map((w) => KIND_OF_WORD[w]).filter(Boolean));
  // The text says it's another kind of thing ("Dracula Avatar" isn't the Dracula card)
  for (const k of said) if (k !== it.kind && !(k === "card" && (it.kind === "variant" || it.kind === "cardback"))) return 0;
  const rest = rw.filter((w) => bw.includes(w) || (!KIND_OF_WORD[w] && !/^x?\d+$/.test(w) && !["the", "a", "an", "new"].includes(w)));
  const seqIn = (seq, list) => { for (let i = 0; i + seq.length <= list.length; i++) if (seq.every((w, j) => list[i + j] === w)) return true; return false; };
  if (!seqIn(bw, rest)) return 0;
  const lw = sv ? rewardWords(sv.label).filter((w) => !["season", "pass", "variant"].includes(w)) : [];
  const labelHit = lw.length > 0 && lw.every((w) => rest.includes(w));
  const lwAll = sv ? rewardWords(sv.label) : [];
  const extra = rest.filter((w) => !bw.includes(w) && !(labelHit && lwAll.includes(w)) && !(it.kind === "variant" && ["season", "pass"].includes(w)));
  if (extra.length) return 1;
  if (it.kind === "variant") return said.has("variant") || labelHit ? 3 + (labelHit ? 1 : 0) : 1; // "Dracula" alone is more likely the card or avatar
  return said.has(it.kind) || it.kind === "card" ? 3 : 2;
}
const best = (list, score) => { let top = null, sc = 0; for (const x of list) { const v = score(x); if (v > sc) { sc = v; top = x; } } return top; };

// ctx: { name, when, season, events }. Returns { lines: [where to get it], level, side, locked, reached, why: proof you have it }
function collWhere(it, ctx) {
  const out = { lines: [], level: 0, side: "", locked: false, reached: false, why: "", sure: false };
  const proof = (why, sure) => { if (!out.why || (sure && !out.sure)) { out.why = why; out.sure = !!sure; } };
  const s = ctx.season, ck = it.kind === "card" ? keyOf(it.name) : it.kind === "variant" ? keyOf(splitVariant(it.name).card) : "";
  if (s) {
    const P = obj(S.passes[s.id]), tier = P.tier || "free", have = num(P.level), lv = obj(obj(obj(S.passTrack)[s.id]).levels);
    // 1. The season pass track, from your screenshots of it
    const hits = []; for (const [L, r] of Object.entries(lv)) for (const side of ["free", "premium"]) { const sc = rewardScore(obj(r)[side], it); if (sc) hits.push({ L: Number(L), side, sc }); }
    const h = best(hits, (x) => x.sc + (x.side === "free" ? 0.1 : 0));
    if (h) {
      out.level = h.L; out.side = h.side; out.locked = h.side === "premium" && tier === "free"; out.reached = have >= h.L;
      out.lines.push(`Season pass level ${h.L} · ${h.side === "premium" ? "Premium" : "Free"}${out.locked && !out.reached ? " (needs Premium)" : ""}`);
      if (out.reached && !out.locked) proof(`You've reached level ${h.L} on the pass`, h.sc >= 3);
    }
    // 2. The Premium and Premium+ cards
    if (it.kind === "card" && keyOf(s.passCard) === ck) { if (!h) out.lines.push("Season pass card · comes with Premium"); if (tier === "premium" || tier === "plus") proof("You have the Premium pass", true); }
    if (it.kind === "card" && keyOf(s.superCard) === ck) { if (!h) out.lines.push("Season pass · comes with Premium+"); if (tier === "plus") proof("You have Premium+", true); }
    // 3. What the season's announcement says
    const said = Object.entries(obj(s.sources)).find(([n]) => keyOf(n) === keyOf(it.name) || (ck && keyOf(n) === ck && it.kind === "card")); if (said) out.lines.push(String(said[1]));
    if (!h && it.kind === "variant" && /season ?pass/i.test(it.name)) out.lines.push("Season pass (open it with Track & play on to see the level)");
  }
  // 4. Events: their reward tracks and shops, from your screenshots, and the rewards they list
  for (const e of arr(ctx.events)) {
    const pr = obj(S.eventProg[e.id]);
    const m = best(arr(pr.ms), (x) => rewardScore(x.reward, it));
    if (m) { out.lines.push(`${e.name} reward track · level ${m.level}${m.premium ? " (premium)" : ""}`); if (m.claimed) proof(`Claimed in ${e.name}`, rewardScore(m.reward, it) >= 3); }
    const shScore = (x) => { const sc = rewardScore(x.name, it); return sc ? sc + (keyOf(x.kind) === it.kind ? 1 : 0) : 0; };
    const sh = best(arr(pr.shop), shScore);
    if (sh) { out.lines.push(`${e.name} shop${sh.price ? ` · ${fmt(sh.price)} ${sh.currency || ""}`.trimEnd() : ""}`); if (sh.sold) proof(`Bought in the ${e.name} shop`, shScore(sh) >= 3); }
    if (!m && !sh && collectibleItems(e).some((x) => x.kind === it.kind && keyOf(x.name) === keyOf(it.name))) out.lines.push(`${e.name} (${dateStr(e.start)}${e.end ? " – " + dateStr(e.end) : ""})`);
  }
  // 5. Shops: today's Collector's Token shop, bundles you've screenshotted and the shop list
  const D = obj(S.dailyCards);
  // Today's Collector's Token shop: for a variant, it has to be that variant (any variant of the card used to count)
  const fv = it.kind === "variant" ? findCollectible(it, ctx.name, ctx.when).v : null;
  const sameVar = (name) => { const a = keyOf(name); return !!a && !!fv && [fv.name, fv.artist].some((n) => keyOf(n) && (a.includes(keyOf(n)) || keyOf(n).includes(a))); };
  if (ck && D.day === gameDay()) { const d = arr(D.cards).find((x) => keyOf(x.card) === ck && (it.kind === "card" ? !x.variant : !!x.variant && sameVar(x.variant))); if (d) { out.lines.push(`In today's Collector's Token shop${d.price ? " · " + d.price : ""}${d.pinned ? " (pinned)" : ""}`); if (d.sold) proof("Bought in the Token shop", true); } }
  const b = best(Object.values(obj(S.gameBundles)).filter((x) => !x.endsAt || x.endsAt > Date.now()), (x) => Math.max(0, ...arr(x.contents).map((c) => rewardScore(c, it))));
  if (b) { out.lines.push(`In the shop: ${b.name}${b.price ? " · " + b.price : ""}`); if (b.sold) proof(`Bought in ${b.name}`, Math.max(0, ...arr(b.contents).map((c) => rewardScore(c, it))) >= 3); }
  else if (ck && typeof autoOffers === "function") {
    const v = fv;
    const o = autoOffers().find((x) => x.cardKey === ck && (it.kind === "card" ? !x.variant : x.variant && (!v || !v.cat || x.cat === v.cat)));
    if (o) out.lines.push(`${o.shop}${o.title ? ": " + o.title : ""} · ${offerPrice(o)}`);
  }
  // 6. Any card: its series
  if (it.kind === "card" && !out.lines.length) { const c = card(ck), sr = typeof seriesOf === "function" ? String(seriesOf(c) || "") : String(c.source || ""); if (/series [1-5]/i.test(sr)) out.lines.push(`${sr} card${/[45]/.test(sr) ? " · Collector's Token shop" : ""}`); }
  if (!out.lines.length && s && it.kind !== "card") out.lines.push("Season reward · its level shows once you open the season pass with Track & play on");
  return out;
}

// Ticks what your pass level, events and shops show you have. Returns true if anything changed.
function collSync(ctx, items) {
  S.collManual = obj(S.collManual); S.collAuto = obj(S.collAuto);
  let changed = false;
  for (const it of items) {
    const key = collKey(ctx.name, it); if (S.collManual[key] === false || S.collManual[collAnyKey(it)] === false) continue;
    // An old hand-made "Season Pass" variant: move its tick onto the card data's variant
    if (it.kind === "variant") {
      const sv = splitVariant(it.name), old = S.variants.find((x) => x.card === keyOf(sv.card) && !x.cat && keyOf(x.name) === keyOf(sv.label) && x.source === ctx.name);
      if (old) { const cands = allVariants().filter((x) => x.cat && x.card === old.card && keyOf(x.source) === keyOf(sv.label)); if (cands.length) { S.variants = S.variants.filter((x) => x !== old); const v = collVariant(it, ctx.name, ctx.when); if (v && old.owned) setCollectible(it, ctx.name, "owned", true, ctx.when); if (v && old.wish) setCollectible(it, ctx.name, "wish", true, ctx.when); changed = true; } }
    }
    const w = collWhere(it, ctx); if (!w.why || !w.sure) continue;
    if (!findCollectible(it, ctx.name, ctx.when).owned) { setCollectible(it, ctx.name, "owned", true, ctx.when); changed = true; }
    if (S.collAuto[key] !== w.why) { S.collAuto[key] = w.why; changed = true; }
  }
  if (changed) save();
  return changed;
}
const seasonCtx = (s) => ({ name: s.name, when: s.startTs, season: s, events: events().filter((e) => e.startTs <= s.endTs && e.endTs >= s.startTs) });
const eventCtx = (e) => ({ name: e.name, when: e.startTs, season: null, events: [e] });
// After a screenshot of the pass, an event or a shop: tick what it shows for this season and the events on now
function collSyncNow() {
  try {
    const cs = currentSeason(); if (cs) collSync(seasonCtx(cs), collectibleItems(cs));
    for (const e of events().filter((x) => timeState(x) === "live")) collSync(eventCtx(e), collectibleItems(e));
  } catch { /* not ready yet */ }
}

// The list itself: art, name, where to get it, and Got it / Want
function collRowsHtml(rows, ctx) {
  lastColl = { items: rows.map((r) => r.it), src: ctx.name, when: ctx.when };
  return `<div class="list">${rows.map(({ it, w }, i) => {
    const f = findCollectible(it, ctx.name, ctx.when), key = collKey(ctx.name, it), auto = obj(S.collAuto)[key];
    const ac = it.kind === "avatar" ? cardByName(it.name) : null;
    const ck = it.kind === "card" ? keyOf(it.name) : it.kind === "variant" ? keyOf(splitVariant(it.name).card) : ac ? ac.key : "";
    const art = ck && !card(ck).unknown ? cardChip(ck, { noOwn: true, size: "xs", v: it.kind === "variant" ? f.v : null }) : "";
    const how = f.owned ? (auto ? `✓ ${esc(auto)}` : it.kind === "card" || it.kind === "variant" ? "✓ In your collection" : "✓ You have it") : w.reached && w.locked ? `${ICON.lock} You're past level ${esc(w.level)}, but it needs Premium` : "";
    return `<div class="li coll"><div class="collart">${art || `<span class="pill ${f.owned ? "W" : "dim"}">${esc(KIND_TXT[it.kind] || "Reward")}</span>`}</div>
      <div class="grow"><div class="t">${esc(it.name.replace(/\s*[-–]\s*Season Pass$/i, ""))}</div><div class="s">${esc(KIND_TXT[it.kind] || "Reward")}${it.kind === "variant" && f.v && f.v.artist ? ` by ${esc(f.v.artist)}` : ""}</div>
        ${w.lines.map((l) => `<div class="s">${esc(l)}</div>`).join("")}${how ? `<div class="s ${f.owned ? "pos" : ""}">${how}</div>` : ""}</div>
      <div class="collchk"><label class="check small"><input type="checkbox" data-coll="owned" data-i="${i}" ${f.owned ? "checked" : ""}> Got it</label>${it.kind !== "other" ? `<label class="check small"><input type="checkbox" data-coll="wish" data-i="${i}" ${f.wish ? "checked" : ""}> Want</label>` : ""}</div></div>`; }).join("")}</div>`;
}

/* ---------- Screenshots of your avatars, titles, card backs or emotes ---------- */
const COS_TABS = { avatars: "avatar", avatar: "avatar", titles: "title", title: "title", cardbacks: "cardback", cardback: "cardback", emotes: "emote", emote: "emote" };
function applyShotCosmetics(x, c) {
  const kind = COS_TABS[keyOf(c.tab)] || "";
  if (kind) (S.seen = obj(S.seen))["cos:" + kind] = Date.now();
  let n = 0;
  for (const i of arr(c.items).slice(0, 60)) {
    const name = String(obj(i).name || "").trim().slice(0, 60), k = COS_TABS[keyOf(obj(i).kind)] || kind;
    if (!name || !k || obj(i).owned !== true) continue;
    if (markCosmetic(k, name, true)) n++;
  }
  if (!kind && !n) { x.status = "A cosmetics screen, but I couldn't tell which kind"; return; }
  x.status = n ? `${n} ${(COS[kind] || "cosmetic").toLowerCase()}${n === 1 ? "" : "s"} ticked as yours` : `${COS[kind] || "Cosmetics"}: nothing new`;
  save(); collSyncNow();
}
