/* ============ Render & routing ============ */
const VIEWS = { home: vHomeTab, cards: vCardsTab, social: vSocialTab, profile: vProfileTab, settings: vSettingsTab };
function render() {
  if (window.__overlay) return;
  applyLook();
  keepFocus(() => { $("#view").innerHTML = (VIEWS[ui.tab] || VIEWS.home)(); });
  // A swipe to the next section slides it in from that side
  if (ui.swipeDir) { const v = $("#view"), c = ui.swipeDir > 0 ? "swipe-l" : "swipe-r"; ui.swipeDir = 0; v.classList.remove("swipe-l", "swipe-r"); void v.offsetWidth; v.classList.add(c); setTimeout(() => v.classList.remove(c), 260); }
  const sn = document.querySelector("#view .subnav"), cur = sn && sn.querySelector('[aria-current="page"]');
  if (cur) sn.scrollLeft = Math.max(0, cur.offsetLeft - sn.clientWidth / 2 + cur.offsetWidth / 2);
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-current", b.dataset.to.split("/")[0] === ui.tab ? "page" : "false"));
  $("#mechip").innerHTML = `${avatarHtml(S.me.avatar, S.me.handle || "?", store.uid || "me")}<span class="h">${esc(S.me.handle || "Set up profile")}</span>`;
  $("#sync").textContent = SLOT ? currentAccountName() : ""; $("#sync").hidden = !SLOT;
  updateBadge();
  extStyles(); const tb = $("#topext"); if (tb) tb.innerHTML = extHtml(EXT.topBar);
  extRun(EXT.afterRender);
}
const TABS = Object.keys(VIEWS);
function route() {
  const h = location.hash.slice(1);
  if ((h.startsWith("deck=") || h === "quicklog" || h.startsWith("replay=") || h.startsWith("overlay") || h === "shared") && specialRoute(h)) return;
  const to = navTarget(h) || ["home", "overview"];
  const sameTab = ui.tab === to[0];
  applyNav(to[0], to[1]);
  closeSheet(); render();
  // Changing sections keeps the section row in view; changing tabs starts at the top.
  if (!sameTab) window.scrollTo(0, 0); else { const hd = document.querySelector(".tabhead"); if (hd && window.scrollY > hd.offsetTop + hd.offsetHeight) window.scrollTo(0, Math.max(0, hd.offsetTop - 8)); }
}
function go(h) { if (location.hash.slice(1) === h) route(); else location.hash = h; }
window.addEventListener("hashchange", route);

/* ============ Mutations ============ */
function setPath(o, path, val) { const ks = path.split("."); for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; }
function addPost(type, payload, text, extra = {}) {
  if (store.mode !== "cloud") { toast("Posting needs the signed-in shared app."); return false; }
  if (!S.me.handle.trim()) { toast("Add your in-game name first."); openSheet(onboardSheet); return false; }
  if (!S.me.share) { toast("Turn on “Share my profile, stats and posts” in your profile to post."); return false; }
  const items = [{ id: uid(), ts: Date.now(), type, text: String(text || "").slice(0, 600), payload, ...extra }, ...myPostItems()].slice(0, 60);
  writeMyPosts(items);
  return true;
}
let reactWriting = Promise.resolve();
function myReactions() { const r = obj(shared.reactions[store.uid]); return { likes: { ...obj(r.likes) }, dislikes: { ...obj(r.dislikes) }, comments: [...arr(r.comments)], emotes: { ...obj(r.emotes) } }; }
function writeReactions(r) { shared.reactions[store.uid] = r; reactWriting = reactWriting.then(() => store.db.doc("reactions/" + store.uid).set(clone(r))).catch((e) => handleDbErr(e, "save that")); }
let sharedWriting = Promise.resolve();
function writeShared(path, body, what) { sharedWriting = sharedWriting.then(() => store.db.doc(path).set(clone(body))).catch((e) => handleDbErr(e, what)); }
function newDeck(name, cards, status = "active", extra = {}) { const d = { id: uid(), name: name || "New deck", cards: arr(cards).slice(0, 12), status, variants: {}, created: Date.now(), ...extra }; S.decks.unshift(d); save(); return d; }
function openDeck(id) { deId = id; ui.deckDelArm = ""; const d = S.decks.find((x) => x.id === id); if (d && d.confirmDel) delete d.confirmDel; openSheet(deckSheet); }
function findSharedDeck(owner, id) {
  if (id === "featured") { if (owner === store.uid) { const d = S.decks.find((x) => x.id === S.me.featuredDeck); return d ? deckPublic(d) : null; } return obj(shared.profiles[owner]).featured || null; }
  const post = arr(obj(shared.posts[owner]).items).find((p) => p.id === id); if (post && post.payload && post.payload.deck) return post.payload.deck;
  return arr(obj(shared.decks[owner]).items).find((x) => x.id === id) || null;
}
async function uploadImage(file, which) {
  if (!store.assets) { toast("Uploading pictures isn't available for you here."); return; }
  if (!file || !/^image\//.test(file.type)) { toast("Choose an image file."); return; }
  toast("Uploading…");
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = store.assets.maxSize ? store.assets.maxSize(which) : which === "banner" ? 1400 : 480; const sc = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", store.assets.quality ? store.assets.quality(which) : 0.85));
    const r = await store.assets.upload(blob, which);
    const keepBorder = (S.me[which] && S.me[which].border) || "";
    S.me[which] = r.fs ? { kind: "img", fs: r.fs, border: keepBorder } : { kind: "img", url: r.url, id: r.id, border: keepBorder }; save(); render(); toast(which === "banner" ? "Banner updated" : "Profile picture updated");
  } catch (e) { toast(e && e.code === "quota_exceeded" ? "Storage is full, so the picture wasn't saved." : "Couldn't upload that picture. Try a smaller image."); }
}

const LOCS = ["Xavier's Mansion", "Atlantis", "Central Park", "Wakanda", "Asgard", "Sanctum Sanctorum", "Knowhere", "Baxter Building", "Kamar-Taj", "Daily Bugle", "Stark Tower", "Bar Sinister", "Nidavellir", "Sakaar", "Muir Island", "The Raft", "Limbo", "Ego"];
function loadExamples() {
  const pick = (names) => names.map((n) => cardByName(n)).filter(Boolean).map((c) => c.key);
  const d1 = { id: uid(), name: "Move It", cards: pick(["Nightcrawler", "Iron Fist", "Kraven", "Multiple Man", "Angela", "Doctor Strange", "Cosmo", "Captain America", "Spider-Man", "Shang-Chi", "Magneto", "Odin"]), status: "active", variants: {}, example: true, created: Date.now() };
  const d2 = { id: uid(), name: "Discard Pile", cards: pick(["Blade", "The Hood", "Morbius", "Swarm", "Lady Sif", "Sword Master", "Dracula", "Ghost Rider", "Hela", "Apocalypse", "Collector", "Wolverine"]), status: "active", variants: {}, example: true, created: Date.now() };
  S.decks.push(d1, d2);
  const opp = allCards().filter((c) => c.cost !== "?").map((c) => c.name);
  const names = ["StarForge88", "Cube Goblin", "nyx_plays", "MoltenCore", "Player7731", "Jade.Fury", "SnapDaddy", "Ozzie"];
  for (let i = 0; i < 40; i++) {
    const ts = Date.now() - Math.floor(Math.random() * 80 * DAY) - 3600e3; const deck = Math.random() < 0.6 ? d1 : d2;
    const tracked = Math.random() < 0.75; let plays = [], locs = [];
    const locNames = [...LOCS].sort(() => Math.random() - 0.5).slice(0, 3);
    if (tracked) {
      const hand = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, 5 + Math.floor(Math.random() * 3));
      plays = hand.map((k) => ({ k, loc: Math.floor(Math.random() * 3), power: Math.max(0, num(card(k).power) + Math.floor(Math.random() * 5) - 1) }));
      locs = locNames.map((n, li) => { const my = plays.filter((p) => p.loc === li).reduce((s, p) => s + p.power, 0); return { name: n, my, opp: Math.max(0, my + Math.floor(Math.random() * 13) - 6) }; });
    }
    const wonLocs = locs.filter((l) => l.my > l.opp).length;
    const result = tracked ? (wonLocs >= 2 ? "W" : wonLocs === 1 && Math.random() < 0.15 ? "T" : "L") : Math.random() < 0.55 ? "W" : "L";
    const snapped = Math.random() < 0.3; const mag = result === "T" ? 0 : [1, 2, 2, 2, 4, 4, 8][Math.floor(Math.random() * 7)];
    const oc = [...new Set(Array.from({ length: 4 + Math.floor(Math.random() * 4) }, () => opp[Math.floor(Math.random() * opp.length)]))];
    putMatch({ id: uid(), ts, result, cubes: result === "W" ? mag : result === "L" ? -Math.max(1, mag) : 0, mode: "Ranked", deckId: deck.id, deckName: deck.name, oppName: names[i % names.length], oppCards: oc, snapped, oppSnapped: Math.random() < 0.25, retreated: result === "L" && Math.random() < 0.4, oppRetreated: result === "W" && Math.random() < 0.4, turn: 6, bot: Math.random() < 0.12 ? "likely" : "unsure", notes: "", example: true, tracked, plays, locs, gy: { my: { destroyed: [], discarded: [], banished: [] }, opp: { destroyed: [], discarded: [], banished: [] } } });
  }
  save(); render(); toast("Example data loaded");
}
function clearExamples() {
  for (const wk of Object.keys(matchWeeks)) { const before = matchWeeks[wk].length; matchWeeks[wk] = matchWeeks[wk].filter((m) => !m.example); if (matchWeeks[wk].length !== before) dirtyWeek(wk); }
  _mVer++; S.decks = S.decks.filter((d) => !d.example); save(); render(); toast("Example data cleared");
}
function backupJson() { return JSON.stringify({ app: "cube-ledger", v: 2, exported: new Date().toISOString(), state: S, matches: matchWeeks }); }
const rs = { text: "", err: "" };
function restoreSheet() { return `${sheetHead("Restore a backup", "Replaces your current data")}<textarea id="rs-text" class="code" data-rs="text" placeholder="Paste a backup">${esc(rs.text)}</textarea>${rs.err ? `<p class="note">${esc(rs.err)}</p>` : ""}<button class="btn snap" data-a="restoreRun">Restore</button>`; }
function saveSeasonLike(kind, rec, body) {
  const coll = kind === "season" ? "seasons" : "events", local = kind === "season" ? "localSeasons" : "localEvents";
  if (store.mode === "cloud") { shared[coll][rec.id] = body; sharedVer++; writeShared(coll + "/" + rec.id, body, "save that"); }
  else { S[local] = [...S[local].filter((s) => s.id !== rec.id), { ...body, id: rec.id }]; save(); }
}
function deleteSeasonLike(kind, id) {
  const coll = kind === "season" ? "seasons" : "events", local = kind === "season" ? "localSeasons" : "localEvents";
  // Seasons and events from the daily schedule would come back, so remember that you removed this one.
  if (SCHED && (SCHED.seasons[id] || SCHED.events[id])) { S.hiddenSched = [...new Set([...arr(S.hiddenSched), id])]; save(); }
  if (store.mode === "cloud") { delete shared[coll][id]; sharedVer++; store.db.doc(coll + "/" + id).delete().catch((e) => handleDbErr(e, "delete that")); }
  else { S[local] = S[local].filter((s) => s.id !== id); save(); }
}
function liveEndToForm() {
  const score = botScore(live.sig, live.turn, live.oppSnap);
  const locs = [0, 1, 2].map((i) => ({ name: live.locs[i] || "", ...locTotals(i) }));
  const plays = Object.entries(live.my).filter(([, z]) => z.startsWith("L")).map(([k, z]) => ({ k, loc: num(z.slice(1)), power: num(live.myPow[k] ?? card(k).power) }));
  const gz = (z) => Object.entries(live.my).filter(([, x]) => x === z).map(([k]) => k);
  const oz = (z) => live.opp.filter((o) => o.zone === z).map((o) => card(o.key).name);
  const won = locs.filter((l) => l.my > l.opp).length, lost = locs.filter((l) => l.my < l.opp).length;
  const tot = locs.reduce((s, l) => s + l.my - l.opp, 0);
  const result = won >= 2 ? "W" : lost >= 2 ? "L" : tot > 0 ? "W" : tot < 0 ? "L" : "T";
  const stakes = Math.min(8, Math.pow(2, (live.mySnap ? 1 : 0) + (live.oppSnap ? 1 : 0)) * 2);
  liveSnapshot();
  openMatchForm(null);
  mf.replay = arr(live.log).length ? { locs: [...live.locs], turns: clone(live.log) } : undefined;
  Object.assign(mf, { result, deckId: live.deckId, deckName: live.deckName === "No deck" ? "" : live.deckName, oppName: live.oppName, oppCards: [...new Set(live.opp.map((o) => card(o.key).name))], snapped: live.mySnap, oppSnapped: live.oppSnap, snapTurn: live.mySnap ? live.snapTurn || live.turn : 0, oppSnapTurn: live.oppSnap ? live.oppSnapTurn || live.turn : 0, turn: live.turn, bot: botLabel(score), botScore: score, fromLive: true, mag: result === "T" ? 0 : stakes, tracked: true, plays, locs, gy: { my: { destroyed: gz("destroyed"), discarded: gz("discarded"), banished: gz("banished") }, opp: { destroyed: oz("destroyed"), discarded: oz("discarded"), banished: oz("banished") } } });
  refreshSheet();
}

/* ============ Click actions ============ */
/* Shows a location's effect under its name as soon as it's recognized */
function showLocInfo(input) {
  const lh = input.closest(".lh"); if (!lh) return;
  lh.querySelectorAll(".lab, .ltip").forEach((x) => x.remove());
  const info = locByName(input.value);
  if (info && info.ability) { const lab = document.createElement("div"); lab.className = "lab"; lab.textContent = info.ability; lh.appendChild(lab); }
  if (/^live-loc-/.test(input.id)) { const tip = locTip(input.value, live.deckId); if (tip) lh.insertAdjacentHTML("beforeend", tip); }
}
/* Deletes that can't be undone take two taps: the first only asks (a toast), a second tap on the same thing within 4 seconds does it */
const delArm = { key: "", at: 0 };
function armDel(key, msg) { if (delArm.key === key && Date.now() - delArm.at < 4000) { delArm.key = ""; return true; } delArm.key = key; delArm.at = Date.now(); toast(msg); return false; }
function starFlip(el, on) { el.setAttribute("aria-pressed", on); el.setAttribute("aria-label", el.getAttribute("aria-label").replace(/^(On|Add to) wishlist/, on ? "On wishlist" : "Add to wishlist")); }
const A = {
  go: (el) => go(el.dataset.to), close: () => closeSheet(),
  period: (el) => { ui.period = el.dataset.v; render(); }, playSeg: (el) => { ui.playSeg = el.dataset.v; render(); }, statView: (el) => { ui.statView = el.dataset.v; render(); },
  loadExamples, clearExamples,
  onboard: () => openSheet(onboardSheet),
  onboardDone: () => { if (!S.me.handle.trim()) { toast("Add your in-game name"); return; } S.me.onboarded = true; save(); closeSheet(); render(); toast("Profile saved"); },
  setVis: (el) => { S.me.visibility = el.dataset.v; save(); render(); if (sheetFn) refreshSheet(); },

  liveStart: (el) => { const d = S.decks.find((x) => x.id === el.dataset.id); live = newLive(d); saveLive(); render(); },
  liveCancel: () => { if (!live.confirmCancel) { live.confirmCancel = true; render(); setTimeout(() => { if (live.on) { live.confirmCancel = false; if (ui.tab === "home") render(); } }, 4000); return; } live = { on: false }; saveLive(); render(); toast("Match discarded"); },
  turn: (el) => { liveSnapshot(); live.turn = clamp(live.turn + num(el.dataset.v), 1, live.lastTurn); saveLive(); render(); },
  oppHand: (el) => { live.oppHand = clamp(live.oppHand + num(el.dataset.v), 0, 12); saveLive(); render(); },
  emote: (el) => { live.sig.emotes = clamp(num(live.sig.emotes) + num(el.dataset.v), 0, 99); saveLive(); render(); },
  draw: (el) => { live.my[el.dataset.k] = "hand"; saveLive(); render(); },
  myCard: (el) => openSheet(myCardSheet(el.dataset.k)),
  mySet: (el) => { const k = el.dataset.k; live.my[k] = el.dataset.v; if (el.dataset.v.startsWith("L") && live.myPow[k] === undefined) live.myPow[k] = num(card(k).power); saveLive(); render(); if (el.dataset.v.startsWith("L")) refreshSheet(); else closeSheet(); },
  myPow: (el) => { const k = el.dataset.k; live.myPow[k] = num(live.myPow[k] ?? card(k).power) + num(el.dataset.v); saveLive(); render(); refreshSheet(); },
  oppAdd: () => openPicker("opp"),
  oppCard: (el) => openSheet(oppCardSheet(num(el.dataset.i))),
  oppSet: (el) => { const o = live.opp[num(el.dataset.i)]; if (!o) return; o.zone = el.dataset.v; saveLive(); render(); if (o.zone.startsWith("L")) refreshSheet(); else closeSheet(); },
  oppPow: (el) => { const o = live.opp[num(el.dataset.i)]; if (!o) return; o.power = num(o.power) + num(el.dataset.v); saveLive(); render(); refreshSheet(); },
  oppRemove: (el) => { live.opp.splice(num(el.dataset.i), 1); saveLive(); closeSheet(); render(); },
  oppZone: (el) => { const k = picker.pending; const z = el.dataset.v; live.opp.push({ key: k, zone: z, power: num(card(k).power), turn: live.turn }); if (z.startsWith("L")) live.oppHand = Math.max(0, live.oppHand - 1); saveLive(); closeSheet(); render(); },
  locAdj: (el) => openSheet(locAdjSheet(num(el.dataset.v))),
  adj: (el) => { const s = el.dataset.s, i = num(el.dataset.i); live.adj[s][i] = num(live.adj[s][i]) + num(el.dataset.v); saveLive(); render(); refreshSheet(); },
  predict: () => runPredict(),
  liveEnd: () => liveEndToForm(),

  pick: (el) => {
    const k = el.dataset.k;
    if (picker.mode === "doffer" || picker.mode === "dpick") { draftHelpPick(k); return; }
    if (picker.mode === "opp") { picker.pending = k; refreshSheet(); return; }
    if (picker.mode === "mf") { const n = card(k).name; const i = mf.oppCards.indexOf(n); if (i >= 0) mf.oppCards.splice(i, 1); else mf.oppCards.push(n); refreshSheet(); return; }
    if (picker.mode === "deck") { const d = deckEdit(); if (!d) return; const i = d.cards.indexOf(k); if (i >= 0) d.cards.splice(i, 1); else if (d.cards.length < 12) d.cards.push(k); else { toast("A deck holds 12 cards"); return; } save(); refreshSheet(); return; }
    if (picker.mode === "avatar") { S.me.avatar = { kind: "card", ref: k }; save(); closeSheet(); render(); toast("Profile picture updated"); return; }
    if (picker.mode === "cover") { const d = deckEdit(); if (d) { d.cover = k; save(); } openDeck(deId); return; }
  },
  pickNew: () => { const name = picker.q.trim(); if (!name) return; const k = keyOf(name); if (!allCards().some((c) => c.key === k)) { S.addedCards.push({ key: k, name, cost: 0, power: 0, tags: [], ability: "", series: "" }); save(); } picker.q = ""; A.pick({ dataset: { k } }); if (picker.mode !== "opp") refreshSheet(); },
  pickDone: () => { if (picker.mode === "deck") openDeck(deId); else if (picker.mode === "mf") openSheet(matchSheet); },

  matchNew: () => openMatchForm(null),
  matchEdit: (el) => { const m = allMatches().find((x) => x.id === el.dataset.id); if (m) openMatchForm(m); },
  mfResult: (el) => { mf.result = el.dataset.v; if (mf.result !== "T" && !mf.mag && !mf.noCubes) mf.mag = 1; refreshSheet(); },
  mfCubes: (el) => { mf.mag = num(el.dataset.v); refreshSheet(); },
  mfOppAdd: () => openPicker("mf"),
  mfOppRemove: (el) => { mf.oppCards.splice(num(el.dataset.i), 1); refreshSheet(); },
  mfSave: () => {
    // A time in the future (a typo in the year, say) would sit at the top of every list and streak, so it's refused
    const was = allMatches().find((x) => x.id === mf.id);
    if (num(mf.ts) > Date.now() + 5 * 60e3 && (!was || was.ts !== mf.ts)) { toast("That date is in the future. Check the When field."); return; }
    const d = S.decks.find((x) => x.id === mf.deckId);
    const locs = arr(mf.locs).filter((l) => String(l.name).trim() || l.my !== "" || l.opp !== "").map((l) => ({ name: String(l.name).trim(), my: num(l.my), opp: num(l.opp) }));
    const m = { ...mf, locs, tracked: !!(mf.tracked || locs.length), deckName: d ? d.name : mf.deckId ? mf.deckName : "", cubes: mf.result === "W" ? mf.mag : mf.result === "L" ? -mf.mag : 0 };
    const fromLive = m.fromLive; ["mag", "isNew", "confirmDel", "fromLive", "fromShot"].forEach((k) => delete m[k]);
    if (!m.snapped) delete m.snapTurn; else if (m.snapTurn !== undefined) m.snapTurn = clamp(num(m.snapTurn), 0, 7);
    m.turn = clamp(Math.round(num(m.turn)) || 6, 1, 8); // an emptied or mistyped Final turn field (0, 66) becomes a real turn
    putMatch(m); onMatchSaved(m); if (fromLive) { live = { on: false }; saveLive(); }
    closeSheet(); render(); toast("Match saved");
  },
  mfDelete: () => { if (!mf.confirmDel) { mf.confirmDel = true; refreshSheet(); return; } removeMatchFix(mf.id); save(); closeSheet(); render(); toast("Match deleted"); },

  cardsSeg: (el) => { ui.cardsSeg = el.dataset.v; render(); }, cardFilter: (el) => { ui.cardFilter = el.dataset.v; render(); }, cardCost: (el) => { ui.cardCost = el.dataset.v; render(); }, varCost: (el) => { ui.varCost = el.dataset.v; render(); },
  cardOpen: (el) => openSheet(cardSheet(el.dataset.k)),
  toggleOwn: (el) => { const k = el.dataset.k; if (S.owned[k]) delete S.owned[k]; else S.owned[k] = true; save(); render(); },
  cardAdd: () => openSheet(() => `${sheetHead("Add a card", "For new releases not in the list")}<label class="f">Name<input type="text" id="na-name" data-autofocus></label><div class="grid2"><label class="f">Cost<input type="number" id="na-cost" value="1"></label><label class="f">Power<input type="number" id="na-power" value="1"></label></div><label class="f">Ability<textarea id="na-ab" rows="2"></textarea></label><div class="grid2"><label class="f">Main effect<select id="na-tag"><option value="">None</option>${Object.entries(TAGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label class="f">Release date<input type="date" id="na-rel"></label></div><label class="check"><input type="checkbox" id="na-own" checked> I own it</label><button class="btn snap" data-a="cardAddSave">Add card</button>`),
  cardAddSave: () => {
    const name = $("#na-name").value.trim(); if (!name) { toast("Enter the card's name"); return; }
    const k = keyOf(name); if (baseCards().some((c) => c.key === k) || S.addedCards.some((c) => c.key === k)) { toast("That card is already in your list"); return; }
    S.addedCards.push({ key: k, name, cost: num($("#na-cost").value), power: num($("#na-power").value), ability: $("#na-ab").value.trim(), tags: $("#na-tag").value ? [$("#na-tag").value] : [], series: "", release: $("#na-rel").value });
    if ($("#na-own").checked) S.owned[k] = true; save(); closeSheet(); render(); toast(name + " added");
  },
  cardSaveEdit: (el) => {
    const k = el.dataset.k; const cv = $("#cd-cost").value, pv = $("#cd-power").value;
    const e = { cost: cv === "" ? "?" : num(cv), power: pv === "" ? "?" : num(pv), series: $("#cd-series").value.trim(), ability: $("#cd-ab").value.trim(), release: $("#cd-rel").value, ai: false };
    const nm = $("#cd-name2") ? $("#cd-name2").value.trim() : ""; if (nm) e.name = nm.slice(0, 60);
    const added = S.addedCards.find((c) => c.key === k); if (added) Object.assign(added, e); else S.cardEdits[k] = e; save(); refreshSheet(); render(); toast("Saved");
  },
  cardResetEdit: (el) => { delete S.cardEdits[el.dataset.k]; save(); refreshSheet(); render(); },
  cardDelete: (el) => { const k = el.dataset.k; if (!armDel("card:" + k, "Tap Remove card again to remove it")) return; S.addedCards = S.addedCards.filter((c) => c.key !== k); delete S.owned[k]; delete S.wishCards[k]; save(); closeSheet(); render(); },
  varNew: (el) => { ve = { isNew: true, id: uid(), card: el.dataset.k || allCards()[0].key, name: "", artist: "", rarity: "", source: "", release: "", owned: false, wish: false, favorite: false }; openSheet(variantSheet); },
  varOpen: (el) => {
    const v = variantAny(el.dataset.id); if (!v) return;
    if (v.virtual) { ve = { ...clone(v), id: uid(), isNew: true, fromCat: true }; delete ve.virtual; }
    else { const shown = allVariants().find((x) => x.id === v.id) || v; ve = { artist: "", rarity: "", source: "", release: "", ...clone(shown) }; delete ve.tier; }
    openSheet(variantSheet);
  },
  wishCard: (el) => { const k = el.dataset.k; if (S.wishCards[k]) delete S.wishCards[k]; else S.wishCards[k] = true; save(); if (ui.cardFilter === "wish") render(); else starFlip(el, !!S.wishCards[k]); },
  wishVar: (el) => { const v = materializeVar(el.dataset.id); if (!v) return; v.wish = !v.wish; save(); if (ui.varFilter === "wish") render(); else starFlip(el, v.wish); },
  balFilter: (el) => { ui.balFilter = el.dataset.v; render(); },
  seriesFilter: (el) => { const v = el.dataset.v; if (ui.cardSeries === v) { ui.cardSeries = ""; ui.cardFilter = "all"; } else { ui.cardSeries = v; ui.cardFilter = "missing"; } render(); },
  seriesClear: () => { ui.cardSeries = ""; render(); },
  deckImage: () => { const d = deckEdit(); if (d) shareDeckImage(d); },
  metaCheckOpen: () => { mc.text = ""; mc.res = null; openSheet(metaCheckSheet); },
  metaCheck: () => { mc.text = ($("#mc-text") || {}).value || mc.text; mc.res = parseDeckCode(mc.text); refreshSheet(); },
  metaSave: () => { const r = mc.res; if (!r || !r.cards.length) return; S.decks.push({ id: uid(), name: r.name || "Checked deck", cards: r.cards.slice(0, 12), status: "future", variants: {}, created: Date.now() }); save(); closeSheet(); ui.deckFilter = "all"; go("decks"); toast("Saved to your decks as a future deck"); },
  aiKeySave: (el) => { const p = el.dataset.p; const k = String(($("#ai-key-" + p) || {}).value || "").trim(); if (!k) { toast("Paste the key first"); return; } if (!lsPut(aiKeyName(p), k)) { toast("This browser won't save the key."); return; } setAiState(p, null); delete aiTests[p]; setupAI(); render(); toast(`${AI_PROVIDERS[p].name} key saved. Tap Test it to check it.`); },
  aiKeyRemove: (el) => { const p = el.dataset.p; if (!armDel("ai:" + p, "Tap Remove key again to remove it. You'd need to paste it again.")) return; lsPut(aiKeyName(p), ""); setAiState(p, null); delete aiTests[p]; setupAI(); render(); toast(`${AI_PROVIDERS[p].name} key removed`); },
  aiKeyTest: async (el) => {
    const p = el.dataset.p, n = AI_PROVIDERS[p].name; if (obj(aiTests[p]).busy) return;
    const ask = () => aiJson('Return {"ok": true, "card": "the name of any MARVEL SNAP card"}', { only: p });
    const good = (r) => (r && r.ok ? { ok: true, msg: `${n} works. It picked ${r.card || "a card"}.` } : { ok: false, msg: `${n} answered, but not in the expected way. Try again.` });
    aiTests[p] = { busy: true }; toast(`Asking ${n}…`); refreshView();
    if (p === "gemini") {
      // Check every way and model at once (about 45 seconds at most), then use whichever answers first.
      aiTests[p] = { busy: true, msg: "Checking your key and Google's models. This can take up to 45 seconds…" }; render();
      const pr = await gemProbe(aiKeyFor("gemini"));
      const trouble = pr.steps.some((x) => !x.ok);
      if (pr.works) {
        setAiState("gemini", { mode: pr.works, models: [pr.model, ...pr.models.filter((m) => m !== pr.model)], modelsAt: Date.now(), pickV: AI_PICK_V, until: 0, why: "", msg: "" });
        aiWaitNow = 30e3; try { aiTests[p] = { ...good(await ask()), steps: trouble ? pr.steps : [] }; } catch (e) { aiTests[p] = { ok: false, msg: e.message, steps: pr.steps }; }
      } else {
        const bad = pr.steps.find((x) => /^Ask/.test(x.label) && x.status) || pr.steps.find((x) => !x.ok);
        aiTests[p] = { ok: false, msg: !pr.steps[0].ok && !pr.steps[1].ok ? `${n} turned down the key or can't be reached.` : `Your key works, but Google's AI models didn't answer just now${bad && bad.status ? ` (${bad.status})` : ""}. Try again in a few minutes.`, steps: pr.steps };
      }
    } else {
      aiWaitNow = 20e3;
      try { aiTests[p] = good(await ask()); } catch (e) { aiTests[p] = { ok: false, msg: e.message || `${n} didn't answer.` }; }
    }
    aiWaitNow = 0; toast(aiTests[p].msg); render();
  },
  aiMove: (el) => { const o = aiOrder(); const i = o.indexOf(el.dataset.p), j = i + num(el.dataset.v); if (i < 0 || j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; lsPut(AI_ORDER_KEY, o.join(",")); render(); },
  aiRelaySave: () => { const v = String(($("#ai-relay") || {}).value || "").trim().replace(/\/+$/, ""); if (v && !/^https:\/\/[^\s/]+/.test(v)) { toast("The relay address starts with https://"); return; } lsPut(AI_RELAY_KEY, v); setAiState("perplexity", null); setAiState("xai", null); render(); toast(v ? "Relay saved" : "Relay removed"); },
  installApp: async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch { /* ignore */ } installEvt = null; render(); },
  notifyOn: () => enableNotifications(),
  notifyOff: () => disableNotifications(),
  claimOwner: async () => { try { await store.db.doc("config/owner").set({ uid: store.uid, at: Date.now() }); store.ownerUid = store.uid; render(); toast("You're the app owner now"); } catch (e) { toast("Couldn't claim it. Paste the new security rules first, or someone already owns the app."); loadOwner(); } },
  deleteAccount: () => { if (!ui.delArm) { ui.delArm = true; render(); setTimeout(() => { ui.delArm = false; if (ui.tab === "settings") render(); }, 6000); return; } ui.delArm = false; deleteAccount(); },
  reportOpen: (el) => { rp.author = el.dataset.k; rp.id = el.dataset.id; rp.reason = "spam"; rp.note = ""; openSheet(reportSheet); },
  reportSend: async () => { try { await store.db.collection("reports").doc().set({ author: rp.author, post: rp.id, reason: rp.reason, note: String(rp.note || "").slice(0, 400), by: store.uid, at: Date.now() }); closeSheet(); toast("Report sent. Thanks."); } catch { toast("Couldn't send the report right now."); } },
  muteAuthor: (el) => { const id = el.dataset.id; if (!id || id === store.uid) return; S.muted = isMuted(id) ? arr(S.muted).filter((x) => x !== id) : [...arr(S.muted), id]; save(); closeSheet(); render(); toast(isMuted(id) ? "Muted. Their posts are hidden from your feed." : "Unmuted"); },
  modRemove: async (el) => { const r = arr(reports).find((x) => x.id === el.dataset.id); if (!r) return; if (!armDel("mod:" + r.id, "Tap Remove post again to delete it for everyone")) return; const doc = obj(shared.posts[r.author]); const items = arr(doc.items).filter((p) => p.id !== r.post); try { if (pdetails[r.author]) await store.db.doc("pdetail/" + r.author).set({ ...pdetails[r.author], posts: items }); else await store.db.doc("posts/" + r.author).set({ ...obj(sharedRaw.posts[r.author]), items }); await store.db.doc("reports/" + r.id).delete(); reports = reports.filter((x) => x.id !== r.id); render(); toast("Post removed"); } catch { toast("Couldn't remove it. Check the security rules."); } },
  modDismiss: async (el) => { try { await store.db.doc("reports/" + el.dataset.id).delete(); reports = arr(reports).filter((x) => x.id !== el.dataset.id); render(); } catch { toast("Couldn't dismiss it."); } },
  varTick: (el) => { const v = materializeVar(el.dataset.id); if (!v) return; v.owned = !v.owned; v.manual = true; delete v.ownBy; save(); render(); },
  varMore: () => { ui.varLimit = (ui.varLimit || 200) + 200; render(); },
  veSave: () => {
    if (!veUpsert()) return;
    closeSheet(); render(); toast(ve.isNew && !ve.fromCat ? "Variant added" : "Saved");
  },
  veDelete: () => { if (!ve.confirmDel) { ve.confirmDel = true; refreshSheet(); return; } S.variants = S.variants.filter((v) => v.id !== ve.id); S.decks.forEach((d) => { for (const k of Object.keys(obj(d.variants))) if (d.variants[k] === ve.id) delete d.variants[k]; }); if (S.me.banner && (S.me.banner.ref === ve.id || S.me.banner.var === ve.id)) S.me.banner = null; if (S.me.avatar && (S.me.avatar.ref === ve.id || S.me.avatar.var === ve.id)) S.me.avatar = null; save(); closeSheet(); render(); },
  veBanner: () => { if (!veUpsert()) return; const v = variantById(ve.id); if (!v) return; S.me.banner = { kind: "look", card: v.card, cat: v.cat || "", ...(v.cat ? {} : { var: v.id }), src: "art", fit: "whole", border: (S.me.banner && S.me.banner.border) || "" }; save(); closeSheet(); render(); toast("Banner updated"); },
  veAvatar: () => { if (!veUpsert()) return; const v = variantById(ve.id); if (!v) return; S.me.avatar = { kind: "look", card: v.card, cat: v.cat || "", ...(v.cat ? {} : { var: v.id }), src: "face", border: (S.me.avatar && S.me.avatar.border) || "" }; save(); closeSheet(); render(); toast("Profile picture updated"); },
  varFilter: (el) => { ui.varFilter = el.dataset.v; render(); },
  cosKind: (el) => { ui.cosKind = el.dataset.v; render(); },
  cosAdd: (el) => { const n = $("#nc-name").value.trim(); if (!n) { toast("Enter a name"); return; } S.cosmetics.push({ id: uid(), kind: el.dataset.v, name: n, source: $("#nc-src").value.trim(), owned: $("#nc-owned").checked, wish: false }); save(); render(); },
  cosDel: (el) => { if (!armDel("cos:" + el.dataset.id, "Tap ✕ again to remove it")) return; S.cosmetics = S.cosmetics.filter((c) => c.id !== el.dataset.id); save(); render(); },

  deckFilter: (el) => { ui.deckFilter = el.dataset.v; render(); },
  deckNew: () => { const d = newDeck("New deck", []); ui.deckTab = "cards"; render(); openDeck(d.id); },
  deckOpen: (el) => { ui.deckTab = "cards"; openDeck(el.dataset.id); },
  deckTab: (el) => { ui.deckTab = el.dataset.v; refreshSheet(); },
  deckStatus: (el) => { deckEdit().status = el.dataset.v; save(); refreshSheet(); render(); },
  deckRemove: (el) => { const d = deckEdit(); d.cards = d.cards.filter((k) => k !== el.dataset.k); delete d.variants[el.dataset.k]; if (d.cover === el.dataset.k) delete d.cover; save(); refreshSheet(); render(); },
  deckAddCards: () => openPicker("deck", Object.keys(S.owned).length >= 12),
  deckCover: () => A.dkcOpen(),
  deckCopy: () => copyText(deckCode(deckEdit()), "Deck code copied. Paste it in the game's deck menu."),
  deckCopyList: () => copyText(deckList(deckEdit()), "Card list copied"),
  svOpen: () => { sv.text = ""; sv.res = null; sv.err = ""; sv.showAll = false; openSheet(svSheet); },
  svParse: () => { sv.text = $("#sv-text").value; const r = parseSnapVault(sv.text); sv.err = r.err || ""; sv.res = r.err ? null : r; refreshSheet(); },
  svShowAll: () => { sv.showAll = true; refreshSheet(); },
  svImport: () => { const r = applySnapVault(); S.svLast = r; if (sv.res && sv.res.date && !(Date.parse(S.svExportDate || "") > Date.parse(sv.res.date))) S.svExportDate = sv.res.date; save(); closeSheet(); render(); toast(`Imported: ${r.owned} cards marked owned, ${r.made} new deck${r.made === 1 ? "" : "s"}, ${r.updated} updated${r.games ? `, ${r.games} result${r.games === 1 ? "" : "s"} added as matches` : ""}${r.first ? ". New wins and losses come in as matches from the next sync on." : ""}`); },
  aiFill: () => aiFillCards(),
  deckDup: () => { const d = deckEdit(); const n = newDeck(d.name + " copy", d.cards, d.status, { variants: { ...obj(d.variants) }, cover: d.cover }); render(); openDeck(n.id); toast("Deck duplicated"); },
  deckDelete: () => { const d = deckEdit(); if (ui.deckDelArm !== d.id) { ui.deckDelArm = d.id; refreshSheet(); return; } ui.deckDelArm = ""; S.decks = S.decks.filter((x) => x.id !== d.id); if (S.me.featuredDeck === d.id) S.me.featuredDeck = ""; save(); closeSheet(); render(); toast("Deck deleted"); },
  postDeck: () => { const d = deckEdit(); pc.type = "deck"; pc.deckId = d.id; pc.text = ""; openSheet(composeSheet); },
  aiOpen: () => { ai.improve = null; ai.result = null; ai.err = ""; openSheet(aiSheet); },
  aiImprove: () => { ai.improve = deId; ai.result = null; ai.err = ""; openSheet(aiSheet); },
  aiRun: () => runAiBuild(), aiRunImprove: () => runAiImprove(),
  aiStop: () => { try { ai.ctl && ai.ctl.abort(); } catch { /* ignore */ } ai.busy = false; refreshSheet(); },
  aiSave: () => { const r = ai.result; const d = newDeck(r.name, r.cards); closeSheet(); render(); openDeck(d.id); toast("Deck saved"); },
  aiSwap: (el) => { const d = S.decks.find((x) => x.id === ai.improve); const s = ai.result.swaps[num(el.dataset.i)]; const o = cardByName(s.out), n = cardByName(s.in); if (!d || !o || !n) return; const i = d.cards.indexOf(o.key); if (i >= 0 && !d.cards.includes(n.key)) { d.cards[i] = n.key; delete d.variants[o.key]; save(); ai.result.swaps.splice(num(el.dataset.i), 1); refreshSheet(); render(); toast(`Swapped in ${n.name}`); } },
  draftOpen: () => { draft.on = false; draft.picks = []; openSheet(draftSheet); }, draftPool: (el) => { draft.pool = el.dataset.v; refreshSheet(); },
  draftStart: () => { draft.on = true; draft.picks = []; draftRoll(); refreshSheet(); },
  draftPick: (el) => { draft.picks.push(el.dataset.k); if (draft.picks.length < 12) draftRoll(); else draft.opts = []; refreshSheet(); },
  draftSave: () => { const d = newDeck($("#dr-name").value.trim() || "Draft deck", draft.picks, "draft"); draft.on = false; closeSheet(); render(); openDeck(d.id); },
  importOpen: () => { imp.text = ""; imp.res = null; openSheet(importSheet); },
  importParse: () => { imp.text = $("#imp-text").value; imp.res = parseDeckCode(imp.text); refreshSheet(); },
  importSave: () => { const cards = [...imp.res.cards, ...arr(imp.res.unknownCodes).map(ensureCodeCard)].slice(0, 12); const variants = {}; for (const [k, n] of Object.entries(obj(imp.res.variants))) { if (!cards.includes(k)) continue; const mm = String(n).match(/^(.*?)(?:\s+by\s+(.+))?$/) || [], v0 = matchVariant(k, mm[1] || n, mm[2] || mm[1] || n); const v = v0 ? materializeVar(v0.id) : null; if (v) variants[k] = v.id; } const d = newDeck($("#imp-name").value.trim() || "Imported deck", cards, $("#imp-status").value, { variants }); closeSheet(); render(); openDeck(d.id); toast("Deck imported"); },
  saveSharedDeck: (el) => { const dk = findSharedDeck(el.dataset.owner, el.dataset.id); if (!dk) { toast("That deck isn't available any more"); return; } const keys = arr(dk.cards).map((n) => cardByName(n)).filter(Boolean).map((c) => c.key); newDeck(dk.name, keys, "future", { from: handleOf(el.dataset.owner) }); render(); toast(`Saved to your Future decks${keys.length < arr(dk.cards).length ? " (some cards aren't in your list)" : ""}`); },
  copySharedCode: (el) => { const dk = findSharedDeck(el.dataset.author, el.dataset.id); if (dk && dk.code) copyText(String(dk.code), "Deck code copied. Paste it in the game's deck menu."); },

  socialSeg: (el) => { ui.social = el.dataset.v; render(); }, feedFilter: (el) => { ui.feedFilter = el.dataset.v; render(); }, allianceSort: (el) => { ui.allianceSort = el.dataset.v; render(); }, lbScope: (el) => { ui.lbScope = el.dataset.v; render(); },
  compose: () => { pc.type = "text"; pc.text = ""; pc.alliance = false; pc.deckId = ""; pc.matchId = ""; pc.customId = ""; pc.variantId = ""; openSheet(composeSheet); }, pcType: (el) => { pc.type = el.dataset.v; refreshSheet(); },
  postSubmit: () => {
    let type = pc.type; const payload = {};
    if (type === "result") { const m = allMatches().find((x) => x.id === (($("#pc-match") || {}).value || pc.matchId)); if (!m) { toast("Pick a match"); return; } if (m.result === "T") { toast("A tie can't be posted as a result. Pick a win or a loss."); return; } const d = S.decks.find((x) => x.id === m.deckId); type = m.result === "W" ? "win" : "loss"; payload.match = { cubes: num(m.cubes), deckName: m.deckName, opp: m.oppName, turn: m.turn, cards: d ? d.cards.map((k) => card(k).name) : [], oppCards: arr(m.oppCards).slice(0, 12), locs: arr(m.locs).slice(0, 3) }; }
    if (type === "deck") { const d = S.decks.find((x) => x.id === (($("#pc-deck") || {}).value || pc.deckId)); if (!d) { toast("Pick a deck"); return; } payload.deck = deckPublic(d); }
    if (type === "stats") { const p = periodById(pc.period || ($("#pc-period") || {}).value); payload.stats = { label: p.label, rank: S.me.rank, ...slimStats(statsFor(inPeriod(realMatches(), p))) }; }
    if (type === "variant") { const v = S.variants.find((x) => x.id === (($("#pc-var") || {}).value || pc.variantId)); if (!v) { toast("Pick a variant"); return; } payload.variant = { card: card(v.card).name, name: v.name, artist: v.artist, rarity: v.rarity, art: variantArt(v) || "" }; }
    if (type === "custom") { const c = S.custom.find((x) => x.id === (($("#pc-custom") || {}).value || pc.customId)); if (!c) { toast("Pick a card"); return; } payload.custom = { name: c.name, cost: c.cost, power: c.power, ability: c.ability, frame: c.frame }; }
    const text = $("#pc-text").value.trim(); if (type === "text" && !text) { toast("Write something first"); return; }
    const toAlliance = !!(pc.alliance && allyKey(S.me.alliance));
    if (addPost(type, payload, text, toAlliance ? { alliance: allyKey(S.me.alliance) } : {})) { pc.text = ""; pc.alliance = false; closeSheet(); if (ui.tab === "social") { ui.social = toAlliance ? "alliance" : "feed"; render(); } else go(toAlliance ? "social/alliance" : "social/feed"); toast(toAlliance ? "Posted to your alliance" : "Posted"); }
  },
  postDelete: (el) => { const id = el.dataset.id; if (ui.postDelArm !== id) { ui.postDelArm = id; render(); if (sheetFn) refreshSheet(); setTimeout(() => { if (ui.postDelArm === id) { ui.postDelArm = ""; render(); } }, 5000); return; } ui.postDelArm = ""; writeMyPosts(myPostItems().filter((p) => p.id !== id)); render(); if (sheetFn) refreshSheet(); },
  react: (el) => { if (store.mode !== "cloud") return; const r = myReactions(); const k = el.dataset.k; const up = el.dataset.v === "1"; const [on, off] = up ? [r.likes, r.dislikes] : [r.dislikes, r.likes]; if (on[k]) delete on[k]; else { on[k] = 1; delete off[k]; } writeReactions(r); requestRender(); },
  toggleComments: (el) => { const k = el.dataset.k; ui.openComments[k] = !ui.openComments[k]; render(); if (sheetFn) refreshSheet(); },
  comment: (el) => { const k = el.dataset.k; const inp = (el.closest(".row") && el.closest(".row").querySelector("input")) || $("#cm-" + k.replace(/[^a-zA-Z0-9]/g, "")); const t = inp ? inp.value.trim() : ""; if (!t) return; if (!S.me.handle.trim()) { toast("Add your in-game name first."); return; } const r = myReactions(); r.comments = [...r.comments, { id: uid(), k, text: t.slice(0, 300), ts: Date.now() }].slice(-200); writeReactions(r); inp.value = ""; render(); if (sheetFn) refreshSheet(); },
  follow: (el) => {
    const id = el.dataset.id; const st = followState(id); const req = { to: { ...obj(obj(shared.followreq[store.uid]).to) } };
    if (st === "none") { S.following.push(id); if (shared.profiles[id] && shared.profiles[id].visibility === "private") { req.to[id] = Date.now(); shared.followreq[store.uid] = req; writeShared("followreq/" + store.uid, req, "send the request"); toast("Follow request sent"); } }
    else { S.following = S.following.filter((x) => x !== id); if (req.to[id]) { delete req.to[id]; shared.followreq[store.uid] = req; writeShared("followreq/" + store.uid, req, "cancel the request"); } }
    save(); render(); if (sheetFn) refreshSheet();
  },
  reqApprove: (el) => { const a = approvalsOf(store.uid); a.ok[el.dataset.id] = 1; delete a.no[el.dataset.id]; shared.approvals[store.uid] = a; writeShared("approvals/" + store.uid, a, "approve"); render(); toast("Approved"); },
  reqDeny: (el) => { const a = approvalsOf(store.uid); a.no[el.dataset.id] = Date.now(); delete a.ok[el.dataset.id]; shared.approvals[store.uid] = a; writeShared("approvals/" + store.uid, a, "deny"); render(); toast("Request denied"); },
  profileOpen: (el) => openSheet(profileSheet(el.dataset.id)),

  tabState: (el) => { ui[el.dataset.k] = el.dataset.v; render(); },
  seasonNew: () => { se = { isNew: true, edit: true, id: uid(), name: "", start: localDate(Date.now()), end: "", passCard: "", passLevels: 50, cards: [], variants: [], rewards: [], notes: "" }; openSheet(seasonSheet); },
  seasonOpen: (el) => { const s = seasons().find((x) => x.id === el.dataset.id); if (!s) return; try { collSync(seasonCtx(s), collectibleItems(s)); } catch { /* shown as is */ } se = { id: s.id, name: s.name, start: s.start, end: s.end || "", passCard: s.passCard || "", passLevels: s.passLevels || 50, cards: arr(s.cards), variants: arr(s.variants), rewards: arr(s.rewards), notes: s.notes || "" }; openSheet(seasonSheet); },
  seasonEdit: () => { se.edit = true; refreshSheet(); }, seasonView: () => { se.edit = false; se.confirmDel = false; refreshSheet(); },
  seasonSave: () => {
    if (!se.name.trim() || !se.start) { toast("Add a name and start date"); return; }
    if (se.end && se.end < se.start) { toast("The end date is before the start date"); return; }
    saveSeasonLike("season", se, { name: se.name.trim().slice(0, 60), start: se.start, end: se.end || "", passCard: String(se.passCard || "").trim().slice(0, 60), passLevels: clamp(Math.round(num(se.passLevels, 50)) || 50, 1, 200), cards: arr(se.cards).slice(0, 60), variants: arr(se.variants).slice(0, 150), rewards: arr(se.rewards).slice(0, 150), notes: String(se.notes || "").slice(0, 1500), by: store.uid || "me", updated: Date.now() });
    se.edit = false; se.isNew = false; render(); refreshSheet(); toast("Season saved");
  },
  seasonDel: () => { if (!se.confirmDel) { se.confirmDel = true; refreshSheet(); return; } deleteSeasonLike("season", se.id); closeSheet(); render(); },
  passStep: (el) => { const id = el.dataset.id; const s = seasons().find((x) => x.id === id); const p = (S.passes[id] = obj(S.passes[id])); p.levelAt = Date.now(); p.level = clamp(num(p.level) + num(el.dataset.v), 0, num(s && s.passLevels) || 50); save(); refreshSheet(); render(); },
  passTier: (el) => { const id = el.dataset.id; (S.passes[id] = obj(S.passes[id])).tier = el.dataset.v; save(); refreshSheet(); render(); },
  eventNew: () => { ee = { isNew: true, edit: true, id: uid(), name: "", type: "mode", start: localDate(Date.now()), end: "", shopUntil: "", passLevels: 0, collectibles: [], desc: "" }; openSheet(eventSheet); },
  eventOpen: (el) => { const e = events().find((x) => x.id === el.dataset.id); if (!e) return; try { collSync(eventCtx(e), collectibleItems(e)); } catch { /* shown as is */ } ee = { id: e.id, name: e.name, type: e.type || "event", start: e.start, end: e.end || "", shopUntil: e.shopUntil || "", passLevels: num(e.passLevels), collectibles: arr(e.collectibles), desc: e.desc || "" }; openSheet(eventSheet); },
  eventEdit: () => { ee.edit = true; refreshSheet(); }, eventView: () => { ee.edit = false; ee.confirmDel = false; refreshSheet(); },
  eventSave: () => {
    if (!ee.name.trim() || !ee.start) { toast("Add a name and start date"); return; }
    if ((ee.end && ee.end < ee.start) || (ee.shopUntil && ee.shopUntil < ee.start)) { toast("The end date is before the start date"); return; }
    saveSeasonLike("event", ee, { name: ee.name.trim().slice(0, 60), type: ee.type || "event", start: ee.start, end: ee.end || "", shopUntil: ee.shopUntil || "", passLevels: clamp(Math.round(num(ee.passLevels)), 0, 200), collectibles: arr(ee.collectibles).slice(0, 150), desc: String(ee.desc || "").slice(0, 1500), by: store.uid || "me", updated: Date.now() });
    ee.edit = false; ee.isNew = false; render(); refreshSheet(); toast("Saved");
  },
  eventDel: () => { if (!ee.confirmDel) { ee.confirmDel = true; refreshSheet(); return; } deleteSeasonLike("event", ee.id); closeSheet(); render(); },
  evStep: (el) => { const id = el.dataset.id; const e = events().find((x) => x.id === id); const p = (S.eventProg[id] = obj(S.eventProg[id])); p.level = clamp(num(p.level) + num(el.dataset.v), 0, num(e && e.passLevels) || 100); save(); refreshSheet(); render(); },
  evTier: (el) => { const id = el.dataset.id; (S.eventProg[id] = obj(S.eventProg[id])).tier = el.dataset.v; save(); refreshSheet(); },

  offerAdd: () => {
    const item = $("#no-item").value.trim(), rawP = String($("#no-price").value).trim(), price = rawP === "" ? NaN : Number(rawP);
    if (!item || !Number.isFinite(price) || price < 0) { toast("Enter the item and its price"); return; }
    const w = wishItems().find((x) => x.name === item);
    S.shops.push({ id: uid(), shop: $("#no-shop").value, kind: $("#no-kind").value, item, ref: w ? w.ref : "", price, currency: $("#no-cur").value, expires: $("#no-exp").value, added: Date.now() });
    save(); render(); toast(wishAlerts().some((a) => a.o.item === item) ? "On your wishlist! See the alert above." : "Offer added");
  },
  offerDel: (el) => { if (!armDel("offer:" + el.dataset.id, "Tap ✕ again to remove this offer")) return; S.shops = S.shops.filter((o) => o.id !== el.dataset.id); save(); render(); },
  promoCopy: (el) => copyText(el.dataset.v),
  promoAdd: () => {
    const code = $("#np-code").value.trim().toUpperCase(); if (!code) { toast("Enter the code"); return; }
    if (promoList().some((p) => p.code.toUpperCase() === code)) { toast("That code is already listed"); return; }
    const p = { code: code.slice(0, 40), reward: $("#np-reward").value.trim().slice(0, 120), status: $("#np-status").value, expires: $("#np-exp").value, added: Date.now(), by: store.uid || "me" };
    if (store.mode === "cloud") { const id = uid(); shared.promos[id] = p; writeShared("promos/" + id, p, "add that code"); } else { S.localPromos.push({ ...p, id: uid() }); save(); }
    render(); toast("Code added");
  },
  promoDel: (el) => { const id = el.dataset.id; if (!armDel("promo:" + id, "Tap Remove again to remove this code")) return; if (store.mode === "cloud") { delete shared.promos[id]; store.db.doc("promos/" + id).delete().catch((e) => handleDbErr(e, "remove that code")); } else { S.localPromos = S.localPromos.filter((p) => p.id !== id); save(); } render(); },
  cdFrame: (el) => { cd.frame = num(el.dataset.v); render(); },
  cdSave: () => { if (!cd.name.trim()) { toast("Name your card"); return; } const body = { name: cd.name.trim(), cost: num(cd.cost), power: num(cd.power), ability: cd.ability.trim(), frame: cd.frame }; if (cd.editing) Object.assign(S.custom.find((x) => x.id === cd.editing), body); else S.custom.unshift({ id: uid(), ...body }); Object.assign(cd, { name: "", cost: 3, power: 4, ability: "", frame: 0, editing: null }); save(); render(); toast("Card saved"); },
  cdNew: () => { Object.assign(cd, { name: "", cost: 3, power: 4, ability: "", frame: 0, editing: null }); render(); },
  cdEdit: (el) => { const c = S.custom.find((x) => x.id === el.dataset.id); if (!c) return; Object.assign(cd, { ...c, editing: c.id }); if (ui.more !== "custom") go("custom"); else { render(); window.scrollTo(0, 0); } },
  cdDel: (el) => { if (!armDel("cd:" + el.dataset.id, "Tap Delete again to delete this card")) return; S.custom = S.custom.filter((c) => c.id !== el.dataset.id); save(); render(); },
  cdPost: (el) => { pc.type = "custom"; pc.customId = el.dataset.id; pc.text = ""; openSheet(composeSheet); },
  pickAvatar: () => openLook("avatar"),
  backupCopy: () => copyText(backupJson(), "Backup copied"),
  backupSave: async () => { try { const r = await store.downloads.save({ filename: `snap-stat-backup-${localDate(Date.now())}.json`, data: backupJson() }); if (r && r.status === "saved") toast("Backup saved"); } catch { toast("Couldn't save the file. Use Copy backup instead."); } },
  restoreOpen: () => { rs.text = ""; rs.err = ""; openSheet(restoreSheet); },
  restoreRun: () => {
    try { const j = JSON.parse($("#rs-text").value); if (!j || j.app !== "cube-ledger" || !j.state) throw new Error("bad");
      S = mergeDefaults(j.state); const old = Object.keys(matchWeeks); matchWeeks = obj(j.matches); if (store.mode !== "cloud") { const t = Date.now(); for (const w of Object.values(matchWeeks)) for (const m of arr(w)) if (m && typeof m === "object") m.added = t; } _mVer++; [...new Set([...old, ...Object.keys(matchWeeks)])].forEach(dirtyWeek); save(); closeSheet(); render(); toast("Backup restored");
    } catch { rs.err = "That doesn't look like a SNAP Stat backup. Copy the whole backup text and try again."; rs.text = $("#rs-text").value; refreshSheet(); }
  },
  resetAll: () => { if (!ui.resetArm) { ui.resetArm = true; render(); setTimeout(() => { ui.resetArm = false; if (ui.tab === "settings") render(); }, 5000); return; } ui.resetArm = false; const old = Object.keys(matchWeeks); S = defaultState(); matchWeeks = {}; _mVer++; old.forEach(dirtyWeek); live = { on: false }; saveLive(); save(); render(); toast("All data erased"); },
};
document.addEventListener("click", (e) => {
  if (e.target.id === "sheet") { closeSheet(); return; }
  const el = e.target.closest("[data-a]"); if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sheetFn) closeSheet();
  if (e.key === "Enter" && e.target.id && e.target.id.startsWith("cm-")) { const b = e.target.parentElement.querySelector('[data-a="comment"]'); if (b) b.click(); }
});

/* ============ Input bindings ============ */
document.addEventListener("input", (e) => {
  const t = e.target, d = t.dataset;
  if (d.bind) {
    setPath(S, d.bind, d.num ? (t.value === "" ? "" : Math.max(0, num(t.value))) : t.value); save(); // every number field here (wallet, prices, levels, points) is a count, never below 0
    if (d.bind.startsWith("me.")) $("#mechip").innerHTML = `${avatarHtml(S.me.avatar, S.me.handle || "?", store.uid || "me")}<span class="h">${esc(S.me.handle || "Set up profile")}</span>`;
    if (d.bind.startsWith("wallet.")) { const box = $("#shop-alerts"); if (box) box.innerHTML = shopAlertsHtml(); }
    if (d.bind === "me.rank" || d.bind === "me.peak") { const cs = currentSeason(); if (cs) { const r = (S.ranks["s:" + cs.id] = obj(S.ranks["s:" + cs.id])); r[d.bind === "me.rank" ? "end" : "peak"] = t.value; } }
    return;
  }
  if (d.rpnote) { rp.note = t.value; return; }
  if (d.mc) { mc.text = t.value; return; }
  if (d.ui) { ui[d.ui] = t.value; render(); return; }
  if (d.live) { if (d.live.startsWith("loc")) { live.locs[num(d.live.slice(3))] = t.value; showLocInfo(t); } else live[d.live] = t.value; saveLive(); return; }
  if (d.livewp) { live.sig.winPct = t.value; saveLive(); return; }
  if (d.pick) { picker.q = t.value; refreshSheet(); return; }
  if (d.mf) { mf[d.mf] = d.mf === "ts" ? (new Date(t.value).getTime() || mf.ts) : d.mf === "turn" ? num(t.value, 6) : t.value; return; }
  if (d.mfloc) { mf.locs[num(d.i)][d.mfloc] = t.value; return; }
  if (d.deck) { const dk = deckEdit(); if (dk) { dk[d.deck] = t.value; save(); } return; }
  if (d.ai) { ai[d.ai] = t.value; return; }
  if (d.imp) { imp.text = t.value; return; }
  if (d.rs) { rs.text = t.value; return; }
  if (d.sv) { sv.text = t.value; return; }
  if (d.pc) { pc[d.pc] = t.value; return; }
  if (d.se) { se[d.se] = ["cards", "variants", "rewards"].includes(d.se) ? t.value.split("\n").map((s) => s.trim()).filter(Boolean) : t.value; return; }
  if (d.ee) { ee[d.ee] = d.ee === "collectibles" ? t.value.split("\n").map((s) => s.trim()).filter(Boolean) : t.value; return; }
  if (d.ve) { ve[d.ve] = t.value; return; }
  if (d.prog) { const key = "s:" + d.id; const r = (S.ranks[key] = obj(S.ranks[key])); r[d.f] = t.value; const cs = currentSeason(); if (cs && cs.id === d.id) { if (d.f === "end") S.me.rank = t.value; if (d.f === "peak") S.me.peak = t.value; } save(); return; }
  if (d.evnotes) { (S.eventProg[d.evnotes] = obj(S.eventProg[d.evnotes])).notes = t.value; save(); return; }
  if (d.cd) { cd[d.cd] = t.value; const prev = $("#cd-prev"); if (prev) prev.innerHTML = customCardHtml(cd); return; }
});
document.addEventListener("change", (e) => {
  const t = e.target, d = t.dataset;
  if (d.livechk) { if (d.livechk === "extra") { live.lastTurn = t.checked ? 7 : 6; live.turn = Math.min(num(live.turn) || 1, live.lastTurn); } else live[d.livechk] = t.checked; saveLive(); render(); return; }
  if (d.livesig) { live.sig[d.livesig] = t.checked; saveLive(); render(); return; }
  if (d.livewp) { setTimeout(render, 0); return; }
  if (d.pickchk) { picker[d.pickchk] = t.checked; refreshSheet(); return; }
  if (d.mfchk) { mf[d.mfchk] = t.checked; return; }
  if (d.uichk) { ui[d.uichk] = t.checked; render(); return; }
  if (d.notifychk) { S.notify = { ...notifyPrefs(), [d.notifychk]: t.checked }; save(); saveNotifyState(); return; }
  if (d.rp) { rp.reason = d.rp; return; }
  if ("soonchk" in d) { S.showSoon = t.checked; save(); render(); return; }
  if (d.uisel) { ui[d.uisel] = t.value; render(); return; }
  if (d.cardchk) { const k = d.k; const tgt = d.cardchk === "owned" ? S.owned : d.cardchk === "wish" ? S.wishCards : S.favCards; if (t.checked) tgt[k] = true; else delete tgt[k]; save(); render(); return; }
  if (d.varchk) { const v = materializeVar(d.id); if (v) { v[d.varchk] = t.checked; if (d.varchk === "owned") { v.manual = true; delete v.ownBy; } save(); render(); if (sheetFn) refreshSheet(); } return; }
  if (d.vechk) { ve[d.vechk] = t.checked; return; }
  if (d.coschk) { const c = S.cosmetics.find((x) => x.id === d.id); if (c) { c[d.coschk] = t.checked; save(); render(); } return; }
  if (d.aichk) { ai[d.aichk] = t.checked; return; }
  if (d.mechk) { S.me[d.mechk] = t.checked; save(); return; }
  if (d.promored) { if (t.checked) S.redeemed[d.promored] = true; else delete S.redeemed[d.promored]; save(); return; }
  if (d.promostatus) {
    const id = d.promostatus;
    if (store.mode === "cloud") { if (shared.promos[id]) { shared.promos[id] = { ...shared.promos[id], status: t.value }; store.db.doc("promos/" + id).update({ status: t.value }).catch((er) => handleDbErr(er, "update that code")); } }
    else { const p = S.localPromos.find((x) => x.id === id); if (p) { p.status = t.value; save(); } }
    render(); return;
  }
  if (d.deckvar) { const dk = deckEdit(); if (dk) { if (t.value) dk.variants[d.deckvar] = t.value; else delete dk.variants[d.deckvar]; save(); render(); } return; }
  if (d.deckchk) { const dk = deckEdit(); if (!dk) return; if (d.deckchk === "public") dk.public = t.checked; else S.me.featuredDeck = t.checked ? dk.id : S.me.featuredDeck === dk.id ? "" : S.me.featuredDeck; save(); render(); refreshSheet(); return; }
  if (d.coll) { const it = lastColl.items[num(d.i)]; if (it) { setCollectible(it, lastColl.src, d.coll, t.checked, lastColl.when); if (d.coll === "owned") { const k = collKey(lastColl.src, it); S.collManual = obj(S.collManual); S.collManual[k] = t.checked; S.collManual[collAnyKey(it)] = t.checked; if (!t.checked) delete obj(S.collAuto)[k]; } save(); render(); refreshSheet(); } return; }
  if (d.evchk) { (S.eventProg[d.id] = obj(S.eventProg[d.id]))[d.evchk] = t.checked; save(); return; }
  if (d.avsel) { if (t.value) { S.me[d.avsel] = { kind: "variant", ref: t.value }; save(); render(); toast(d.avsel === "banner" ? "Banner updated" : "Profile picture updated"); } return; }
  if (d.upload) { const f = t.files && t.files[0]; t.value = ""; if (f) uploadImage(f, d.upload); return; }
  if (d.svquick) { const f = t.files && t.files[0]; t.value = ""; if (!f) return; f.text().then(svQuickSync).catch(() => toast("Couldn't read that file.")); return; }
  if (d.svfile) { const f = t.files && t.files[0]; t.value = ""; if (!f) return; f.text().then((txt) => { sv.text = ""; const r = parseSnapVault(txt); sv.err = r.err || ""; sv.res = r.err ? null : r; refreshSheet(); }).catch(() => { sv.err = "Couldn't read that file."; refreshSheet(); }); return; }
  if (d.svchk) { sv[d.svchk] = t.checked; refreshSheet(); return; }
  if (d.deck) { render(); return; }
  if (d.bind && t.tagName === "SELECT") { render(); return; }
});


// Signing in after using the app without an account: which data to keep (see subscribeCloud)
Object.assign(A, {
  reportsRetry: () => { reports = null; render(); },
  keepCloudState: () => { pendingLocal = null; closeSheet(); },
  keepLocalState: () => { if (pendingLocal) { S = mergeDefaults(pendingLocal); pendingLocal = null; save(); toast("Using this phone's data"); } closeSheet(); render(); },
});
