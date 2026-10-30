/* ============ Update everything: a guided sweep through the game, and how fresh each part is ============
   Each part of your data remembers when a screenshot last updated it. The sweep lists the game's screens in order,
   ticks each one as its picture is read (from Track & play or a screenshot you take), and shows what changed. */
const SWEEP = [
  { k: "numbers", label: "Home screen", how: "The game's home screen", why: "Credits, Gold, Collection Level and pass level", days: 1 },
  { k: "collection", label: "Your cards", how: "Collection › Cards: scroll to the end, taking a screenshot of each screenful", why: "Cards you own and their boosters", days: 14 },
  { k: "variants", label: "Variants", how: "Tap a card, then its Variants, for any card you've got something new for", why: "Variants you own", days: 30 },
  { k: "album", label: "Albums", how: "Collection › Albums, and open each one you're working on", why: "Album progress and variants", days: 14 },
  { k: "cos:avatar", label: "Avatars", how: "Your profile's Avatars", why: "Avatars you own", days: 30 },
  { k: "cos:title", label: "Titles", how: "Your profile's Titles", why: "Titles you own", days: 30 },
  { k: "cos:cardback", label: "Card backs", how: "Your Card Backs", why: "Card backs you own", days: 30 },
  { k: "cos:emote", label: "Emotes", how: "Your Emotes", why: "Emotes you own", days: 30 },
  { k: "pass", label: "Season pass", how: "The season pass, scrolled to the end of its track", why: "Your pass level and every reward's level", days: 3 },
  { k: "missions", label: "Missions", how: "Missions: today's, the weekly challenge and the season chapters", why: "Mission progress", days: 1 },
  { k: "shop", label: "Shop", how: "The shop's Offers, Cards and Credits tabs", why: "Bundles, daily cards and free credits", days: 1 },
  { k: "alliance", label: "Alliance", how: "Your alliance's Bounties, Members and Leaderboard", why: "Bounties and points", days: 3 },
];
// When a screenshot last updated something, by the kind it was read as
function noteSeen(x) {
  // A read that found nothing doesn't count ("nothing from your wishlist" is a shop that was read fine)
  const st = String(x.status || "").replace(/nothing from your wishlist/i, "");
  if (!x || !x.kind || x.dupe || x.failed || /couldn't|nothing|already read|already logged|but no|but i couldn't|isn't|doesn't|didn't look|wasn't logged|not read|older than the ones saved|no numbers|not which one|no variants/i.test(st)) return;
  (S.seen = obj(S.seen))[x.kind] = Date.now();
}
// The newest time anything updated a part, including the other places that keep a time
function seenAt(k) {
  const cs = typeof currentSeason === "function" ? currentSeason() : null;
  const cosFile = num(obj(S.seen).cosfile);
  const other = { "cos:avatar": cosFile, "cos:title": cosFile, "cos:cardback": cosFile, "cos:emote": cosFile, numbers: num(S.walletAt), collection: num(S.collFileAt), variants: num(S.collFileAt), pass: cs ? num(obj(obj(S.passTrack)[cs.id]).at) : 0, missions: num(obj(obj(S.gameMissions).daily).at), shop: num(obj(S.dailyCards).at), alliance: num(obj(S.allianceData).at) }[k] || 0;
  return Math.max(num(obj(S.seen)[k]), other);
}
const staleOf = (st) => { const t = seenAt(st.k); return t && Date.now() - t > st.days * DAY; };
function sweepCounts() {
  const cos = (kind) => S.cosmetics.filter((c) => c.kind === kind && c.owned).length;
  return { cards: Object.keys(S.owned).filter((k) => S.owned[k]).length, variants: S.variants.filter((v) => v.owned).length, avatars: cos("avatar"), titles: cos("title"), cardbacks: cos("cardback"), emotes: cos("emote"), looks: Object.keys(obj(S.looks)).length, cl: num(S.me.colLevel), credits: num(S.wallet.credits), gold: num(S.wallet.gold) };
}
const SWEEP_LBL = { cards: "cards", variants: "variants", avatars: "avatars", titles: "titles", cardbacks: "card backs", emotes: "emotes", looks: "Custom Cards", cl: "Collection Level", credits: "credits", gold: "gold" };
function sweepChanges() {
  const b = obj(obj(S.sweep).before), now = sweepCounts();
  return Object.keys(SWEEP_LBL).map((k) => ({ k, d: num(now[k]) - num(b[k]) })).filter((x) => x.d);
}
function sweepSheet() {
  const sw = obj(S.sweep), on = !!sw.at;
  const done = on ? SWEEP.filter((st) => seenAt(st.k) >= sw.at).length : 0;
  const rows = SWEEP.map((st, i) => {
    const t = seenAt(st.k), now = on && t >= sw.at, old = staleOf(st);
    return `<div class="li" style="align-items:flex-start"><span class="pill ${now ? "W" : old ? "live" : "dim"}" style="min-width:26px;text-align:center">${now ? "✓" : i + 1}</span><div class="grow" style="min-width:0"><div class="t" style="white-space:normal">${esc(st.label)}</div><div class="s" style="white-space:normal">${esc(st.how)}</div>
      <div class="s" style="white-space:normal">${now ? "Done" : t ? `Last updated ${esc(agoTxt(t))}${old ? " · getting old" : ""}` : "Never read yet"}</div></div></div>`;
  }).join("");
  const ch = on ? sweepChanges() : [];
  return `${sheetHead("Update everything", on ? `${done} of ${SWEEP.length} done` : "Walk through the game once and everything here catches up")}
    ${on ? "" : `<p class="small">${NATIVE ? "Tap <b>Start</b>: Track & play opens MARVEL SNAP and saves each screen you visit." : "Open each screen below in MARVEL SNAP and take a screenshot, then share them to SNAP Stat."} Go through the list in order. For any screen that doesn't tick, take a screenshot (Power + Volume down) and it's read the next time you open SNAP Stat.</p>`}
    <div class="row">${on ? `${NATIVE ? `<button class="btn snap" data-a="natPlay">Open MARVEL SNAP</button>` : ""}<button class="btn" data-a="sweepEnd">Finish</button>` : `<button class="btn snap" data-a="sweepStart">Start</button>`}</div>
    ${on ? `<div class="panel small stack" style="gap:4px"><b>What's changed since you started</b>${ch.length ? ch.map((x) => `<span>${x.d > 0 ? "+" : ""}${fmt(x.d)} ${esc(SWEEP_LBL[x.k])}</span>`).join("") : `<span class="muted">Nothing yet. Pictures are read when you come back to SNAP Stat.</span>`}</div>` : ""}
    <div class="list">${rows}</div>
    <p class="muted small">Tip: a reward pop-up (a new card, variant, avatar or card back) ticks what you got too, and every match you play ticks the variants, card back and avatar you used.</p>`;
}
// A short line on Home when a part you've read before is getting old
function freshNudgeHtml() {
  const sw = obj(S.sweep);
  if (sw.at) { const done = SWEEP.filter((st) => seenAt(st.k) >= sw.at).length; return `<section class="sec"><button class="panel row between nowrap" data-a="sweepOpen" style="width:100%;text-align:left"><span class="small"><b>Updating everything</b> · ${done} of ${SWEEP.length} done</span><span class="muted">›</span></button></section>`; }
  const old = SWEEP.filter(staleOf); if (!old.length) return "";
  return `<section class="sec"><button class="panel row between nowrap" data-a="sweepOpen" style="width:100%;text-align:left"><span class="small" style="white-space:normal"><b>Getting old:</b> ${old.slice(0, 4).map((st) => `${esc(st.label)} (${esc(ago(seenAt(st.k)))})`).join(", ")}${old.length > 4 ? ` and ${old.length - 4} more` : ""}</span><span class="pill dim">Update</span></button></section>`;
}
Object.assign(A, {
  sweepOpen: () => openSheet(sweepSheet),
  sweepStart: async () => { S.sweep = { at: Date.now(), before: sweepCounts() }; save(); refreshSheet(); render(); if (NATIVE) { try { await A.natPlay(); } catch { /* the button is there */ } } },
  sweepEnd: () => { const ch = sweepChanges(); S.sweep = null; save(); closeSheet(); render(); toast(ch.length ? `Updated: ${ch.slice(0, 4).map((x) => `${x.d > 0 ? "+" : ""}${fmt(x.d)} ${SWEEP_LBL[x.k]}`).join(", ")}` : "Nothing new this time"); },
});
