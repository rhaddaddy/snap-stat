/* ============ Navigation: six tabs at the bottom, each with its own sections along the top ============
   Home: what's on now, the live tracker, your matches and stats, seasons, events, shops, balance changes and promo codes.
   Collection, Decks and Social as before (locations, upgrades and custom cards moved into Collection; tournaments and reports into Social).
   Profile: your picture, banner, details, posts and achievements. Settings: everything about how the app works. */
const isModerator = () => store.mode === "cloud" && !!store.uid && (isAppOwner() || arr(store.admins).includes(store.uid));
const NAV = {
  home: { title: "Home", key: "homeSub", subs: () => [["overview", "Overview"], ["live", live.on ? "Live match ●" : "Live match"], ["missions", "Missions"], ["matches", "Matches"], ["stats", "Stats"], ["seasons", "Seasons"], ["events", "Events"], ["shops", "Shops"], ["balance", "Balance changes"], ["promos", "Promo codes"], ...extSubs(EXT.homeSubs)] },
  cards: { title: "Cards", key: "cardsSeg", subs: () => [["cards", "Cards"], ["decks", "Decks"], ["variants", "Variants"], ["upcoming", "Coming soon"], ["goals", "Variant goals"], ["albums", "Albums"], ["cosmetics", "Cosmetics"], ["wish", "Wishlist"], ["locations", "Locations"], ["progress", "Upgrades"], ["custom", "Custom cards"], ...extSubs(EXT.cardsSubs)] },
  social: { title: "Social", key: "social", subs: () => [["feed", "Feed"], ["people", incomingRequests().length ? `People (${incomingRequests().length})` : "People"], ["alliance", "Alliance"], ["board", "Leaders"], ["tournaments", "Tournaments"], ...(isModerator() ? [["reports", "Reports"]] : []), ...extSubs(EXT.socialSubs)] },
  profile: { title: "Profile" },
  settings: { title: "Settings", key: "setSub", subs: () => [["app", "App"], ["ai", "AI"], ...(NATIVE || (window.SNAPSTAT_STANDALONE && /Android/i.test(navigator.userAgent)) ? [["android", "Android"]] : []), ["data", "Import & backup"], ["stream", "Stream overlay"], ["account", "Account"], ...(store.provider === "firebase" && (isAppOwner() || store.ownerUid === "") ? [["owner", "App owner"]] : []), ["about", "About"], ...extSubs(EXT.settingsSubs)] },
};
// Older links (#shops, #play, #account…) still land in the right place.
const LEGACY = { decks: ["cards", "decks"], missions: ["home", "missions"], play: ["home", "live"], live: ["home", "live"], log: ["home", "matches"], matches: ["home", "matches"], insights: ["home", "stats"], stats: ["home", "stats"],
  seasons: ["home", "seasons"], events: ["home", "events"], shops: ["home", "shops"], balance: ["home", "balance"], promos: ["home", "promos"], catchup: ["home", "catchup"],
  variants: ["cards", "variants"], upcoming: ["cards", "upcoming"], albums: ["cards", "albums"], cosmetics: ["cards", "cosmetics"], wishlist: ["cards", "wish"], locations: ["cards", "locations"], progress: ["cards", "progress"], custom: ["cards", "custom"],
  feed: ["social", "feed"], people: ["social", "people"], alliance: ["social", "alliance"], board: ["social", "board"], tournaments: ["social", "tournaments"], reports: ["social", "reports"],
  more: ["profile"], account: ["profile"], me: ["profile"], about: ["settings", "about"], ai: ["settings", "ai"], android: ["settings", "android"], backup: ["settings", "data"] };
function navTarget(h) {
  const [t, s] = String(h || "").split("/");
  // Only real page names (an address like #constructor isn't one)
  if (Object.prototype.hasOwnProperty.call(NAV, t)) return [t, s || ""];
  if (Object.prototype.hasOwnProperty.call(LEGACY, t)) return LEGACY[t];
  return null;
}
function applyNav(t, s) {
  ui.tab = t; ui.more = null;
  const n = NAV[t];
  if (n && n.key) { const ok = n.subs().map(([k]) => k); if (s === "catchup" && t === "home") ui[n.key] = "catchup"; else if (s && ok.includes(s)) ui[n.key] = s; else ui[n.key] = ok[0]; } // a tab on its own opens its first section
}
// The row of sections along the top of a tab. Taps change the address, so Back works.
function subNav(tab) {
  const n = NAV[tab]; if (!n || !n.subs) return "";
  const cur = ui[n.key];
  const subs = n.subs(), first = subs[0];
  // At the end of the row, a way straight back to the first section
  return `<nav class="subnav" aria-label="${esc(n.title)} sections">${subs.map(([k, l]) => `<button data-a="go" data-to="${tab}/${k}" aria-current="${cur === k ? "page" : "false"}">${esc(l)}</button>`).join("")}${cur !== first[0] ? `<button class="subhome" data-a="go" data-to="${tab}/${first[0]}">↩ ${esc(first[1])}</button>` : ""}</nav>`;
}
function tabHead(tab, extra = "") { return `<section class="sec tabhead"><h1>${esc(NAV[tab].title)}</h1>${extra}${subNav(tab)}</section>`; }

/* ---------- Home ---------- */
function vHomeTab() {
  const s = ui.homeSub || "overview";
  const body = { overview: vHomeOverview, live: vLive, missions: vMissions, matches: vLog, stats: vHomeStats, seasons: vSeasons, events: vEvents, shops: vShops, balance: vBalance, promos: vPromos,
    catchup: () => `<section class="sec">${catchUpSheet().replace(/<div class="sheet-h">[\s\S]*?<\/button><\/div>/, "")}</section>` }[s] || extBody(EXT.homeSubs, s) || vHomeOverview;
  return `${tabHead("home")}${body()}`;
}

/* ---------- Collection: the old tab plus locations, upgrades and custom cards ---------- */
function vCardsTab() {
  const s = ui.cardsSeg || "cards";
  const body = { cards: vCardGrid, decks: () => vDecks().replace('<section class="sec"><h1>Decks</h1>', '<section class="sec">'), variants: vVariants, upcoming: vUpcomingVariants, goals: vVariantGoals, albums: vAlbums, cosmetics: vCosmetics, wish: vWishlist, locations: vLocations, progress: vProgress, custom: vCustom }[s] || extBody(EXT.cardsSubs, s) || vCardGrid;
  return `${tabHead("cards")}${body()}`;
}

/* ---------- Social ---------- */
function vSocialTab() {
  if (ui.social === "tournaments") return `${tabHead("social")}${vTournaments()}`;
  const ext = extBody(EXT.socialSubs, ui.social); if (ext) return `${tabHead("social")}${ext()}`;
  if (ui.social === "reports") return `${tabHead("social")}${isModerator() ? vReports() : `<section class="sec"><p class="muted">Only the app owner and social admins can see reports.</p></section>`}`;
  return vSocial().replace(/<section class="sec"><h1>Social<\/h1><div class="seg">[\s\S]*?<\/div>/, tabHead("social").replace(/<\/section>$/, ""));
}

/* ---------- Profile ---------- */
function vProfileTab() {
  const vis = S.me.visibility || "public";
  const mine = store.mode === "cloud" ? allPosts().filter((p) => p.author === store.uid) : [];
  const fol = store.mode === "cloud" ? followersOf(store.uid).length : 0, ing = arr(S.following).length;
  const p = myProfileView(), st = obj(obj(p.stats).season);
  return `<section class="sec tabhead"><h1>Profile</h1></section>${natUpdateBanner()}
  <section class="sec">
    ${bannerHtml(S.me.banner, S.me.handle)}
    <div class="prof-head">${avatarHtml(S.me.avatar, S.me.handle || "?", store.uid || "me", "lg")}<div class="stack" style="gap:2px;min-width:0;flex:1"><b style="font-size:18px">${esc(S.me.handle || "Your in-game name")}</b><span class="muted small">${[S.me.country ? flag(S.me.country) + " " + esc(countryName(S.me.country)) : "", S.me.alliance ? esc(S.me.alliance) : ""].filter(Boolean).join(" · ") || "Add your details below"}</span>
      ${store.mode === "cloud" ? `<span class="small">${fol} follower${fol === 1 ? "" : "s"} · ${ing} following${S.me.colLevel ? ` · CL ${fmt(S.me.colLevel)}` : ""}</span>` : ""}</div>${rankBadge(S.me.rank)}</div>
    <div class="grid2" style="margin-top:12px"><button class="btn snap" data-a="lkOpen" data-v="avatar">Change picture</button><button class="btn snap" data-a="lkOpen" data-v="banner">Change banner</button></div>
    ${S.me.avatar || S.me.banner ? `<div class="grid2">${S.me.avatar ? `<button class="btn sm" data-a="lkOpen" data-v="avatar" data-step="edit">${S.me.avatar.border ? "Picture border: " + esc(borderName(S.me.avatar.border) || "none") : "Add a picture border"}</button>` : "<span></span>"}${S.me.banner ? `<button class="btn sm" data-a="lkOpen" data-v="banner" data-step="edit">${S.me.banner.border ? "Banner border: " + esc(borderName(S.me.banner.border) || "none") : "Add a banner border"}</button>` : ""}</div>` : ""}
    ${store.assets ? `<div class="row"><label class="btn sm">Upload a picture<input type="file" accept="image/*" data-upload="avatar" hidden></label><label class="btn sm">Upload a banner<input type="file" accept="image/*" data-upload="banner" hidden></label></div>` : ""}
    ${num(st.games) ? `<div class="tiles" style="margin-top:4px"><div class="tile"><div class="k">This season</div><div class="v">${num(st.wr)}%</div></div><div class="tile"><div class="k">Games</div><div class="v">${fmt(st.games)}</div></div><div class="tile"><div class="k">Cubes</div><div class="v">${signed(num(st.cubes))}</div></div></div>` : ""}
  </section>
  ${extHtml(EXT.profile)}<section class="sec"><details class="panel" ${ui.profEdit || !S.me.handle ? "open" : ""} data-profedit="1"><summary><b>Your details</b> <span class="muted small">name, ID, country, alliance, rank</span></summary><div class="stack" style="margin-top:10px">
      <div class="grid2"><label class="f">Your name<input type="text" id="me-name" data-bind="me.name" value="${esc(S.me.name)}" maxlength="40"></label><label class="f">In-game name<input type="text" id="me-handle" data-bind="me.handle" value="${esc(S.me.handle)}" maxlength="40"></label></div>
      <div class="grid2"><label class="f">Marvel Snap user ID<input type="text" id="me-snapid" data-bind="me.snapId" value="${esc(S.me.snapId)}" maxlength="40"></label><label class="f">Country<select id="me-country" data-bind="me.country">${countryOptions(S.me.country)}</select></label></div>
      <div class="grid2"><label class="f">Alliance<input type="text" id="me-alliance" data-bind="me.alliance" value="${esc(S.me.alliance)}" maxlength="40"></label><label class="f">Collection level<input type="number" id="me-cl" data-bind="me.colLevel" data-num="1" value="${esc(S.me.colLevel)}" inputmode="numeric"></label></div>
      <div class="grid2"><label class="f">Current rank<input type="text" id="me-rank" data-bind="me.rank" value="${esc(S.me.rank)}" placeholder="e.g. 72 or Infinite"></label><label class="f">Peak rank this season<input type="text" id="me-peak" data-bind="me.peak" value="${esc(S.me.peak)}"></label></div>
      ${peakAllTime() ? `<span class="small">All-time peak rank: <b>${esc(peakAllTime())}</b>${S.me.peakAllSeason ? ` <span class="muted">(${esc(S.me.peakAllSeason)})</span>` : ""}</span>` : ""}
      <label class="f">Featured deck<select id="me-feat" data-bind="me.featuredDeck"><option value="">None</option>${S.decks.map((d) => `<option value="${esc(d.id)}" ${S.me.featuredDeck === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>
      <div class="seg"><button data-a="setVis" data-v="public" aria-pressed="${vis === "public"}">Public</button><button data-a="setVis" data-v="private" aria-pressed="${vis === "private"}">${ICON.lock} Private</button></div>
      <p class="muted small">${vis === "private" ? "Followers need your approval. Approved followers and your alliance see your stats, decks and posts." : "Anyone using the app can see your profile and follow you."}</p>
      <label class="toggle-row check"><span>Share my profile, stats and posts</span><input type="checkbox" data-mechk="share" ${S.me.share ? "checked" : ""}></label>
      ${store.mode === "cloud" ? `<button class="btn" data-a="profileOpen" data-id="${esc(store.uid)}">See my profile as others do</button>` : ""}</div></details></section>
  ${store.mode === "cloud" ? `<section class="sec"><div class="sec-h"><h2>Your posts</h2><button class="btn sm snap" data-a="compose">${ICON.plus} Post</button></div>${mine.length ? mine.slice(0, 30).map(postHtml).join("") : `<div class="empty"><span>You haven't posted yet. Share a win, a deck or your season stats.</span></div>`}</section>` : ""}
  ${badgesHtml()}${accountsHtml()}`;
}

/* ---------- Settings ---------- */
function vSettingsTab() {
  const s = ui.setSub === "owner" && !isAppOwner() && store.ownerUid !== "" ? "app" : ui.setSub || "app";
  const sync = store.mode === "cloud" ? "Saved to your account" : store.ready ? "Saved on this device" : "Loading…";
  const body = {
    app: () => `${appPanel()}${lookHtml()}<section class="sec"><h2>Cards and variants</h2><div class="panel small"><label class="check"><input type="checkbox" data-soonchk ${showSoon() ? "checked" : ""}> Show cards and variants that aren't out yet</label></div></section>${extHtml(EXT.settingsApp)}`,
    ai: () => aiPanel(),
    android: () => androidPanel() || `<section class="sec"><p class="muted">The Android app is for Android phones.</p></section>`,
    data: () => `<section class="sec"><h2>Bring your data in</h2><div class="panel stack small">
        <p>MARVEL SNAP doesn't let other apps read your account, so SNAP Stat brings things in from these instead.</p>
        <div class="grid2"><button class="btn" data-a="svOpen">Import from SnapVault</button><button class="btn" data-a="importOpen">Paste a deck code</button></div>
        <label class="btn">Import the game's files<input type="file" accept=".json,application/json,text/plain" data-collfile="1" multiple hidden></label><button class="btn ghost" data-a="sweepOpen">Update everything</button>
        <span class="muted">If you also play MARVEL SNAP on a PC, the game keeps your whole collection in a file called <b>CollectionState.json</b> (in <code>AppData\\LocalLow\\Second Dinner\\SNAP\\Standalone\\States\\nvprod</code>). Choose it here to bring in every card, variant, avatar, emote and card back you own, your decks, Custom Cards, boosters, upgrade levels, splits and Collection Level. From the same folder, <b>CharacterMasteryState.json</b> adds Mastery levels and <b>ClanState.json</b> your alliance's week; it's fine to pick every file there.</span></div></section>
      ${sfPanel()}${extHtml(EXT.settingsData)}
      <section class="sec"><h2>Backup</h2><div class="row"><button class="btn" data-a="csvMatches">Matches spreadsheet</button><button class="btn" data-a="csvCollection">Collection spreadsheet</button></div><div class="row"><button class="btn" data-a="backupCopy">${ICON.copy} Copy backup</button>${store.downloads ? `<button class="btn" data-a="backupSave">Save backup file</button>` : ""}<button class="btn" data-a="restoreOpen">Restore</button></div>
        ${allMatches().some((m) => m.example) || S.decks.some((d) => d.example) ? `<button class="btn ghost" data-a="clearExamples">Clear example data</button>` : ""}
        <button class="btn ghost danger" data-a="resetAll">${ui.resetArm ? "Tap again to erase everything" : "Erase all my data"}</button></section>`,
    // The overlay needs the signed-in app on your main account; otherwise say so instead of showing an empty page
    stream: () => overlayPanel() || `<section class="sec"><h2>Stream overlay</h2><div class="panel stack small"><p>Share a live overlay for streaming in OBS or Streamlabs: your rank, today's record and the live tracker.</p>
        <span class="muted">${!window.SNAPSTAT_STANDALONE ? "It works in the SNAP Stat app, not in this view." : SLOT ? "It uses your main account. Switch back to it in Profile › MARVEL SNAP accounts to turn it on." : "Sign in to turn it on."}</span>${window.SNAPSTAT_STANDALONE && !SLOT && store.mode !== "cloud" && store.fb ? `<div><button class="btn sm snap" data-a="signIn">Sign in</button></div>` : ""}</div></section>`,
    account: () => `<section class="sec"><h2>Account</h2><div class="panel stack small"><p class="muted">${esc(sync)}${SLOT ? " · " + esc(currentAccountName()) : ""}</p>
        ${store.provider === "firebase" ? `<p><b>${accountLine()}</b></p><p>${store.mode === "cloud" ? "Your data follows you to any device where you sign in." : "Sign in to keep your data across devices and use the social features. Anything saved here moves into your account when you sign in."}</p>${store.mode === "cloud" ? `<div><button class="btn sm" data-a="signOut">Sign out</button></div>` : store.fb ? `<div><button class="btn sm snap" data-a="signIn">Sign in</button></div>` : ""}` : `<p>${store.mode === "cloud" ? "You're signed in with your Claude account, and your data follows you across devices." : "Your data is saved on this device."}</p>`}</div></section>${dangerPanel()}`,
    owner: () => `${ownerPanel()}${adminsPanel()}`,
    about: () => vAbout(),
  }[s] || extBody(EXT.settingsSubs, s) || (() => appPanel());
  return `${tabHead("settings")}${s !== "android" ? natUpdateBanner() : ""}${body()}<section class="sec"><p class="muted small">${window.SNAPSTAT_STANDALONE ? privacyLink() + " · " : ""}Unofficial fan-made app. Not affiliated with or endorsed by Marvel or Second Dinner.</p></section>`;
}
// The old "‹ More" bar above each section is gone; the section row at the top of each tab does that job now.
function backBar(t) { return ""; }

/* ---------- Social admins: people the app owner trusts to review reported posts ---------- */
async function loadAdmins() {
  if (store.mode !== "cloud" || !store.db) return;
  try { const s = await store.db.doc("config/admins").get(); store.admins = s.exists ? arr((s.data() || {}).uids).map(String) : []; } catch { store.admins = []; }
  render();
}
function adminsPanel() {
  if (!isAppOwner()) return "";
  const admins = arr(store.admins);
  const people = Object.entries(shared.profiles).filter(([id, p]) => id !== store.uid && p && p.handle && !admins.includes(id)).sort((a, b) => String(a[1].handle).localeCompare(String(b[1].handle)));
  return `<section class="sec"><h2>Social admins</h2><div class="panel stack small">
    <p>Social admins can review reported posts and remove them. Nobody else sees reports.</p>
    ${admins.length ? `<div class="list">${admins.map((id) => `<div class="li">${avatarHtml(prof(id)?.avatar, handleOf(id), id)}<div class="grow"><div class="t">${esc(handleOf(id))}</div></div><button class="btn sm ghost" data-a="adminDel" data-id="${esc(id)}">Remove</button></div>`).join("")}</div>` : `<span class="muted">No social admins yet. Only you can review reports.</span>`}
    ${people.length ? `<div class="row nowrap"><select id="admin-pick" aria-label="Player to make a social admin"><option value="">Pick a player…</option>${people.slice(0, 300).map(([id, p]) => `<option value="${esc(id)}">${esc(p.handle)}</option>`).join("")}</select><button class="btn sm snap" data-a="adminAdd">Add</button></div>` : ""}
    <span class="muted">Adding admins needs the latest security rules in Firebase (Firestore Database › Rules).</span></div></section>`;
}
async function saveAdmins(list) {
  if (list.length > 20) { toast("There can be up to 20 social admins. Remove one first."); return false; }
  try { await store.db.doc("config/admins").set({ uids: list.slice(0, 20), at: Date.now() }); store.admins = list.slice(0, 20); render(); return true; }
  catch { toast("Couldn't save. Paste the latest security rules into Firebase first."); return false; }
}
Object.assign(A, {
  adminAdd: async () => { const id = ($("#admin-pick") || {}).value; if (!id) { toast("Pick a player"); return; } if (await saveAdmins([...new Set([...arr(store.admins), id])])) toast(`${handleOf(id)} is a social admin now`); },
  unrelMore: () => { ui.unrelLim = (ui.unrelLim || 60) + 60; render(); },
  adminDel: async (el) => { if (await saveAdmins(arr(store.admins).filter((x) => x !== el.dataset.id))) toast("Removed"); },
});
document.addEventListener("toggle", (e) => { if (e.target && e.target.dataset && e.target.dataset.profedit) ui.profEdit = e.target.open; }, true);

/* ---------- Swipe left or right to move through a tab's sections ---------- */
// After the last section a swipe goes back to the first. Rows that scroll sideways, fields and open sheets keep their own swipes.
function swipeBlocked(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.nodeType !== 1) continue;
    if (n.matches("input, textarea, select, .subnav, .board, [data-noswipe], canvas")) return true;
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 4) return true;
  }
  return false;
}
// The section a swipe lands on (1 = next, -1 = previous), or null if there isn't one
function swipeTarget(dir) {
  const n = NAV[ui.tab]; if (!n || !n.subs) return null;
  const subs = n.subs().map(([k]) => k), i = Math.max(0, subs.indexOf(ui[n.key]));
  let j = i + dir; if (j >= subs.length) j = 0; if (j < 0 || subs[j] === subs[i]) return null;
  return subs[j];
}
function swipeSection(dir) {
  const k = swipeTarget(dir); if (!k) return false;
  ui.swipeDir = dir; go(`${ui.tab}/${k}`); return true;
}
// The finger-following swipe itself lives in y24_swipe.js
