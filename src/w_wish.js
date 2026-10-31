/* ============ Owned variants filled in for you, and wishlist alerts from any shop you screenshot ============
   The game doesn't share which variants you own with other apps, so SNAP Stat fills them in from what it can see:
   the base card of every card you own, screenshots of a card's variants screen or of a variant (read by AI), and
   screenshots of your shops. Ticks you change by hand always win, and the app won't change them again. */
const OWN_BY = { shot: "from a screenshot", shop: "from a shop screenshot", card: "from a card screenshot", file: "from your PC collection file", album: "from an album screenshot" };
// allVariants() hands out copies of your saved variants, so the change goes on the saved one (it was lost before).
// A card-data variant you haven't touched only gets a saved entry when it actually changes.
function setVarOwned(v, owned, by) {
  if (!v) return false;
  if (v.virtual) { if (!owned) return false; v = materializeVar(v.id); } else v = S.variants.find((x) => x.id === v.id) || v;
  if (!v) return false;
  if (v.manual || !!v.owned === !!owned) return false;
  v.owned = !!owned; v.ownBy = by; v.ownAt = Date.now(); return true;
}
// A variant of card k that matches a name, artist or style the AI read.
function matchVariant(k, name, artist) {
  const vs = allVariants().filter((v) => v.card === k), n = keyOf(name), a = keyOf(artist);
  if (!vs.length || (!n && !a)) return null;
  const by = (f) => vs.filter(f);
  let hit = a ? by((v) => keyOf(v.artist) === a || (a.length > 4 && keyOf(v.artist).includes(a))) : [];
  if (hit.length > 1 && n) { const h2 = hit.filter((v) => keyOf(v.name) === n || keyOf(v.name).includes(n)); if (h2.length) hit = h2; }
  if (!hit.length && n) hit = by((v) => keyOf(v.name) === n || (n.length > 3 && (keyOf(v.name).includes(n) || keyOf(v.artist) === n)));
  return hit.length === 1 ? hit[0] : null;
}
/* A card's variants screen: which ones the player has. A second look compares the screenshot with a numbered sheet of
   every variant's picture (from snap.fan), which works even where the game shows no names, like the Custom Card editor. */
const loadPic = (u, ms = 9000) => new Promise((res) => {
  const im = new Image(); let done = false; const end = (v) => { if (!done) { done = true; res(v); } };
  im.crossOrigin = "anonymous"; im.referrerPolicy = "no-referrer"; im.onload = () => end(im); im.onerror = () => end(null); setTimeout(() => end(null), ms); im.src = u;
});
async function variantContactSheet(cands) {
  const list = cands.slice(0, 48).map((v, i) => { const cv = v.cat && _catVars.get(v.cat); return { n: i + 1, u: cv ? cv.pic : "" }; });
  if (list.filter((x) => x.u).length < 2 || typeof document === "undefined") return null;
  const pics = await Promise.all(list.map((x) => (x.u ? loadPic(x.u) : null)));
  if (pics.filter(Boolean).length < 2) return null;
  const cols = 6, cw = 150, ih = 150, lh = 26, rows = Math.ceil(list.length / cols);
  const cv = document.createElement("canvas"); cv.width = cols * cw; cv.height = rows * (ih + lh);
  const g = cv.getContext("2d"); g.fillStyle = "#14102a"; g.fillRect(0, 0, cv.width, cv.height);
  list.forEach((x, i) => {
    const X = (i % cols) * cw, Y = Math.floor(i / cols) * (ih + lh), im = pics[i];
    if (im) { const s = Math.min((cw - 8) / im.width, (ih - 4) / im.height), w = im.width * s, h = im.height * s; g.drawImage(im, X + (cw - w) / 2, Y + 2 + (ih - 4 - h) / 2, w, h); }
    else { g.fillStyle = "#2a2450"; g.fillRect(X + 10, Y + 10, cw - 20, ih - 20); }
    g.fillStyle = "#ffd84d"; g.font = "bold 20px sans-serif"; g.textAlign = "center"; g.fillText("#" + x.n, X + cw / 2, Y + ih + 20);
  });
  try { const url = cv.toDataURL("image/jpeg", 0.82); return { media_type: "image/jpeg", data: url.slice(url.indexOf(",") + 1) }; } catch { return null; }
}
async function applyShotVariants(x, vv, img) {
  const c = fuzzyCard(vv.card); if (!c) { x.status = "Couldn't tell which card's variants these are"; return; }
  const k = c.key, cands = allVariants().filter((v) => v.card === k).sort((a, b) => catOrder(a) - catOrder(b));
  if (!cands.length) { x.status = `${c.name}: no variants in the card list yet`; return; }
  // The Custom Card editor only lists the variants you own.
  const editor = /editor|custom/i.test(String(vv.screen || ""));
  // Only a clear yes or no counts: a variant the AI didn't say either way is left as it is
  const yesNo = (o) => (o === true || o === "true" ? true : o === false || o === "false" ? false : null);
  let items = arr(vv.items).slice(0, 60).map((it) => ({ ...obj(it), v: matchVariant(k, obj(it).name, obj(it).artist), owned: editor ? true : yesNo(obj(it).owned) }));
  if (img && store.sample && (editor || items.some((it) => !it.v) || !items.length)) {
    const sheet = await variantContactSheet(cands).catch(() => null);
    const list = cands.map((v, i) => `${i + 1}. ${[v.name, v.artist && "by " + v.artist, v.source, v.rarity, v.release && "released " + v.release].filter(Boolean).join(" · ")}`).join("\n");
    const how = editor ? "This is the Custom Card editor's art picker, which only lists variants the player owns, so every variant on it is owned." : "Owned ones look normal; ones the player doesn't have are greyed out, locked, or show a price or a way to get them.";
    const ask = sheet
      ? `The first picture is a MARVEL SNAP screenshot showing variants of ${c.name}. The second picture is a numbered sheet with every ${c.name} variant's art (the number is under each one). Match each variant picture in the screenshot to the sheet by its art: the pose, colours and style. Their list, in the same order:\n${list}\n${how} Only include pictures you can match with confidence.\nReply as JSON: {"items": [{"n": number on the sheet, "owned": true | false}]}`
      : `This MARVEL SNAP screenshot shows variants of ${c.name}. Here is the full list of ${c.name}'s variants:\n${list}\nFor each variant picture on the screen, give its number from the list and whether the player owns it. ${how} Only include pictures you can match with confidence.\nReply as JSON: {"items": [{"n": number from the list, "owned": true | false}]}`;
    try {
      const r = obj(await store.sample.json(ask, { images: sheet ? [img, sheet] : [img], modelTier: "default" }));
      const got = arr(r.items).map((it) => ({ v: cands[num(obj(it).n) - 1], owned: editor ? true : yesNo(obj(it).owned) })).filter((it) => it.v);
      // Matching by picture beats matching by a name the first look guessed.
      if (got.length) items = sheet ? [...got, ...items.filter((it) => it.v && !got.some((g) => g.v.id === it.v.id) && (it.name || it.artist))] : [...items.filter((it) => it.v), ...got.filter((g) => !items.some((it) => it.v && it.v.id === g.v.id))];
    } catch { /* keep what the first look found */ }
  }
  let own = 0, miss = 0, same = 0;
  for (const it of items) if (it.v && typeof it.owned === "boolean") { if (setVarOwned(it.v, it.owned, "shot")) { if (it.owned) own++; else miss++; } else same++; }
  if (!own && !miss && !items.some((it) => it.v)) { x.status = `${c.name}: couldn't match the variants`; x.detail = "Tick them in Collection › Variants instead."; return; }
  // Having a variant means having the card; a screen of locked ones (a shop's, or a card you haven't got) doesn't
  if (items.some((it) => it.owned === true)) S.owned[k] = true;
  save();
  x.status = `${c.name} variants updated`; x.detail = [own && `${own} marked owned`, miss && `${miss} marked not owned`, same && `${same} already right`].filter(Boolean).join(" · ") || "Everything was already right"; x.cardKey = k;
}

/* Any shop screen (your Token Shop, Spotlight, a bundle, an event shop): tell you about anything on your wishlist. */
function wishHits(items) {
  const hits = [];
  for (const it0 of arr(items).slice(0, 40)) {
    const it = obj(it0), c = fuzzyCard(it.card); if (!c) continue;
    const kind = String(it.kind || "").toLowerCase();
    if (kind !== "card") {
      const wished = allVariants().filter((v) => v.card === c.key && v.wish && !v.owned);
      const v = matchVariant(c.key, it.variant, it.artist) || (wished.length === 1 && !it.variant && !it.artist && kind === "variant" ? wished[0] : null);
      if (v && v.wish && !v.owned) { hits.push({ name: `${c.name} · ${v.artist || v.name}`, key: "v:" + (v.cat || v.id), price: String(it.price || "") }); continue; }
    }
    if ((kind === "card" || !kind) && S.wishCards[c.key] && !S.owned[c.key]) hits.push({ name: c.name, key: "c:" + c.key, price: String(it.price || "") });
  }
  return hits;
}
function applyShotShop(x, sh, time) {
  const more = applyShopMore(sh, time || Date.now()); setTimeout(collSyncNow, 0);
  const shop = String(sh.shop || "a shop").slice(0, 40), items = [...arr(sh.items), ...dailyAsItems(sh)].slice(0, 40);
  S.shopSeen = [{ ts: time || Date.now(), shop, items: items.map((it) => ({ card: String(obj(it).card || "").slice(0, 40), variant: String(obj(it).variant || obj(it).artist || "").slice(0, 60), price: String(obj(it).price || "").slice(0, 30), kind: String(obj(it).kind || "").slice(0, 10) })) }, ...arr(S.shopSeen).filter((s) => s.shop !== shop)].slice(0, 8);
  const hits = wishHits(items);
  save(); setTimeout(checkBundleAlerts, 500);
  if (!hits.length) { x.status = `${shop}: nothing from your wishlist`; x.detail = [...more, items.length && !more.length ? `Saw ${items.length} item${items.length > 1 ? "s" : ""}.` : ""].filter(Boolean).join(" · "); return; }
  x.status = `On your wishlist, in ${shop}!`; x.detail = [hits.map((h) => h.name + (h.price ? ` (${h.price})` : "")).join(" · "), ...more].join(" · ");
  const day = gameDay(time || Date.now());
  const fresh = hits.filter((h) => !arr(S.shopTold).includes(`${h.key}|${shop}|${day}`));
  if (fresh.length) {
    S.shopTold = [...arr(S.shopTold), ...fresh.map((h) => `${h.key}|${shop}|${day}`)].slice(-60); save();
    notifyNow("On your wishlist, in " + shop, fresh.map((h) => h.name + (h.price ? ` · ${h.price}` : "")).join("\n"), "seen:" + shop + ":" + day, "#shops");
  }
}
/* A notification right now: from the Android app, or from the installed web app when it's allowed. */
async function notifyNow(title, body, tag, route) {
  try {
    if (window.SnapStatNative && typeof SnapStatNative.showAlert === "function") { if (SnapStatNative.showAlert(title, body, tag, route || "#home")) return true; }
    else if ("Notification" in window && Notification.permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, { body, tag, icon: "icon-192-v2.png", badge: "icon-192-v2.png", data: { url: new URL(route || "#home", location.href).href } }); return true;
    }
  } catch { /* fall through to the in-app note */ }
  // Wait for a message that's showing now (like the result of what you just did) instead of covering it
  const msg = title + ": " + String(body || "").split("\n")[0];
  const show = (n) => { const t = $("#toast"); if (t && !t.hidden && n < 5) setTimeout(() => show(n + 1), 2800); else toast(msg); };
  show(0);
  return false;
}
/* What your last shop screenshots showed, on the Shops page. */
function shopSeenHtml() {
  const list = arr(S.shopSeen).filter((s) => Date.now() - num(s.ts) < 3 * DAY);
  if (!list.length) return "";
  return `<section class="sec"><div class="sec-h"><h2>Your shops, from screenshots</h2></div><div class="list">${list.map((s) => {
    const hits = wishHits(s.items);
    return `<div class="li"><div class="grow"><div class="t">${esc(s.shop)} <span class="muted small">${esc(ago(num(s.ts)))}</span></div><div class="s" style="white-space:normal">${hits.length ? `<b>On your wishlist:</b> ${hits.map((h) => esc(h.name)).join(", ")}` : arr(s.items).slice(0, 6).map((it) => esc([it.card, it.variant].filter(Boolean).join(" · "))).join(", ") || "Nothing listed"}</div></div></div>`;
  }).join("")}</div><p class="muted small">Your Token Shop is different for every player, so SNAP Stat can only see it when you screenshot it. With automatic screenshots on, that's all it takes.</p></section>`;
}
