/* ============ Decks take the card back and avatar you use in the game ============
   Whenever SNAP Stat sees which card back and avatar you had on with a deck (a match read by Track & play or from a
   screenshot, a game on PC, or the game's CollectionState.json), the deck's card back and icon follow it by themselves,
   so nobody has to set each deck up by hand. A card back or icon you pick yourself in the deck (backBy/coverBy "hand")
   is never changed. */
// x: { cardback: "name as read", backId: "game id", avatar: "name as read", avDef: { card, v } } · src: "match" | "pc" | "file"
function deckAutoLook(d, x, src) {
  if (!d || !x) return false;
  let changed = false;
  if (d.backBy !== "hand" && typeof cardBacks === "function") {
    const list = cardBacks(); let b = null;
    if (x.backId) b = (typeof cardBackById === "function" && cardBackById(x.backId)) || list.find((y) => lookKey(y.id) === lookKey(x.backId)) || pickByName(list, prettyDef(x.backId), (y) => y.name);
    if (!b && x.cardback) b = pickExact(list, x.cardback, (y) => y.name);
    if (b && d.back !== b.id) { d.back = b.id; d.backBy = src; changed = true; }
  }
  if (d.coverBy !== "hand") {
    const c = x.avDef ? deckAvatarFromDef(x.avDef) : x.avatar ? deckAvatarFromName(x.avatar) : null;
    if (c && (d.cover !== c.k || String(d.coverVar || "") !== c.v)) { d.cover = c.k; d.coverVar = c.v; d.coverBy = src; changed = true; }
  }
  return changed;
}
// The game's own ids for an avatar (the card, and the variant it shows) → the deck icon
function deckAvatarFromDef(a) {
  a = obj(a); const c = cardByDefId(a.card); if (!c || c.unknown) return null;
  const v = a.v ? variantByDefId(a.v) : null;
  return { k: c.key, v: v ? String(v.cat || v.id) : "base" };
}
// An avatar's name as the AI read it ("Venom" or "Venom (Nicola Saviori)") → the deck icon, only when it's clear
function deckAvatarFromName(name) {
  name = String(name || "").trim(); if (!name) return null;
  const cos = arr(S.cosmetics).find((y) => y.kind === "avatar" && y.ref && lookKey(y.name) === lookKey(name));
  if (cos) { const ref = String(cos.ref); const v = /_\d{1,3}$/.test(ref) ? variantByDefId(ref) : null; if (v && v.card) return { k: v.card, v: String(v.cat || v.id) }; const c = cardByDefId(ref); if (c && !c.unknown) return { k: c.key, v: "base" }; }
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(name), c = cardByName(m ? m[1] : name);
  if (!c || c.unknown) return null;
  if (m) { const v = matchVariant(c.key, m[2], m[2]); if (v) return { k: c.key, v: String(v.cat || v.id) }; }
  return { k: c.key, v: "base" };
}
// A deck object in the game's files (or a PC game) → its card back id and avatar, wherever the game keeps them
function gameDeckLooks(d) {
  d = obj(d);
  const backId = String(obj(d.CardBack).CardBackDefId || d.CardBackDefId || "");
  const av = obj(obj(d.Avatar).CardArtAvatar || d.CardArtAvatar || d.Avatar || obj(d.DeckAvatar).CardArtAvatar || d.DeckAvatar);
  const card = typeof av.CardDefId === "string" ? av.CardDefId : "", v = typeof av.ArtVariantDefId === "string" ? av.ArtVariantDefId : "";
  return { backId, avDef: card ? { card, v } : null };
}
// The game's files: each deck you already have in SNAP Stat (same name, or the same 12 cards) takes the file's card back and avatar
function deckLooksFromFile(fileDecks) {
  let n = 0;
  for (const fd of arr(fileDecks)) {
    const keys = arr(fd.cards).map((id) => (cardByDefId(id) || {}).key).filter(Boolean), sig = [...keys].sort().join(",");
    const d = S.decks.find((x) => keyOf(x.name) === keyOf(fd.name)) || S.decks.find((x) => [...arr(x.cards)].sort().join(",") === sig);
    if (d && deckAutoLook(d, { backId: fd.back, avDef: fd.av }, "file")) n++;
  }
  return n;
}
