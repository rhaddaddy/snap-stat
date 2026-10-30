/* ============ Profile setup ============ */
function maybeOnboard() { if (!S.me.onboarded && !sheetFn && (store.mode !== "cloud" || store.stateLoaded)) openSheet(onboardSheet); }
function onboardSheet() {
  const vis = S.me.visibility || "public";
  return `${sheetHead("Create your profile", accountLine())}
    <div class="grid2"><label class="f">Your name<input type="text" id="ob-name" data-bind="me.name" value="${esc(S.me.name)}" maxlength="40" data-autofocus></label><label class="f">In-game name<input type="text" id="ob-handle" data-bind="me.handle" value="${esc(S.me.handle)}" maxlength="40"></label></div>
    <div class="grid2"><label class="f">Marvel Snap user ID (optional)<input type="text" id="ob-snapid" data-bind="me.snapId" value="${esc(S.me.snapId)}" maxlength="40" placeholder="From your in-game profile"></label><label class="f">Country<select id="ob-country" data-bind="me.country">${countryOptions(S.me.country)}</select></label></div>
    <div class="grid2"><label class="f">Alliance<input type="text" id="ob-alliance" data-bind="me.alliance" value="${esc(S.me.alliance)}" maxlength="40"></label><label class="f">Collection level<input type="number" id="ob-cl" data-bind="me.colLevel" data-num="1" value="${esc(S.me.colLevel)}" inputmode="numeric"></label></div>
    <div class="stack" style="gap:6px"><span class="eyebrow">Profile</span><div class="seg"><button data-a="setVis" data-v="public" aria-pressed="${vis === "public"}">Public</button><button data-a="setVis" data-v="private" aria-pressed="${vis === "private"}">${ICON.lock} Private</button></div>
      <p class="muted small">${vis === "private" ? "Only followers you approve, and players who enter the same alliance name, see your stats, decks and posts." : "Anyone using the app can see your stats, featured deck and posts, and follow you."}</p></div>
    <div class="note">Linking: MARVEL SNAP has no public sign-in that outside apps can connect to, so your game ID is for display and friends. Matches, decks and collection come from what you track here.</div>
    <button class="btn snap" data-a="onboardDone">Save profile</button>`;
}

/* ============ Social ============ */
function allPosts() {
  const out = [];
  for (const [author, doc] of Object.entries(shared.posts)) { if (!canSee(author) || (author !== store.uid && isMuted(author))) continue; for (const p of arr(obj(doc).items).slice(0, 80)) if (p && typeof p === "object" && p.id && (!p.alliance || author === store.uid || p.alliance === allyKey(S.me.alliance))) out.push({ ...p, payload: obj(p.payload), author }); }
  const now = Date.now(), t = (p) => Math.min(num(p.ts), now);
  return out.sort((a, b) => t(b) - t(a));
}
function reactionsFor(author, id) {
  const k = author + ":" + id; let likes = 0, dislikes = 0, mine = 0; const comments = [];
  for (const [who, r] of Object.entries(shared.reactions)) {
    if (obj(r.likes)[k]) { likes++; if (who === store.uid) mine = 1; }
    if (obj(r.dislikes)[k]) { dislikes++; if (who === store.uid) mine = -1; }
    if (who !== store.uid && isMuted(who)) continue;
    for (const c of arr(r.comments)) if (c && c.k === k) comments.push({ ...c, who });
  }
  comments.sort((a, b) => num(a.ts) - num(b.ts));
  return { k, likes, dislikes, mine, comments };
}
function vSocial() {
  if (store.mode !== "cloud" && ui.social === "alliance" && obj(S.allianceData).at) return `<section class="sec"><h1>Social</h1><div class="seg"></div><p class="note">${store.ready ? "Sign in so your alliance can see this and you can see theirs." : "Connecting…"}</p>${allianceExtraHtml()}</section>`;
  if (store.mode !== "cloud" && store.provider === "firebase") return `<section class="sec"><h1>Social</h1><div class="seg"></div><div class="empty"><strong>${store.ready ? "Sign in to use social" : "Connecting…"}</strong><span>Sign in to post, follow players, compare decks with your alliance and show up on the leaderboards.</span>${store.fb ? `<button class="btn snap" data-a="signIn">Sign in</button>` : ""}</div></section>`;
  if (store.mode !== "cloud") return `<section class="sec"><h1>Social</h1><div class="seg"></div><div class="empty"><strong>${store.ready ? "Social needs the signed-in, shared app" : "Connecting…"}</strong><span>Open this app while signed in to Claude, then share it with your alliance at Contributor access. Everyone who opens it can post, follow, compare decks and show up on the leaderboards.</span></div></section>`;
  const reqs = incomingRequests().length;
  const seg = (v, l) => `<button data-a="socialSeg" data-v="${v}" aria-pressed="${ui.social === v}">${l}</button>`;
  const need = !S.me.handle.trim() || !S.me.share ? `<div class="note">${!S.me.handle.trim() ? "Add your in-game name" : "Turn on sharing"} so others can find and follow you. <button class="btn sm ghost" data-a="onboard">Profile</button></div>` : "";
  const body = ui.social === "people" ? vPeople() : ui.social === "alliance" ? vAlliance() : ui.social === "board" ? vLeaderboard() : vFeed();
  return `<section class="sec"><h1>Social</h1><div class="seg">${seg("feed", "Feed")}${seg("people", reqs ? `People (${reqs})` : "People")}${seg("alliance", "Alliance")}${seg("board", "Leaders")}</div>${need}</section>${body}`;
}
function vFeed() {
  const f = (v, l) => `<button class="chip" data-a="feedFilter" data-v="${v}" aria-pressed="${ui.feedFilter === v}">${l}</button>`;
  let posts = allPosts();
  if (ui.feedFilter === "following") posts = posts.filter((p) => followState(p.author) === "following" || p.author === store.uid);
  if (ui.feedFilter === "alliance") posts = posts.filter((p) => p.author === store.uid || sameAlliance(p.author));
  if (ui.feedFilter === "mine") posts = posts.filter((p) => p.author === store.uid);
  if (typeof feedTypeOk === "function") posts = posts.filter(feedTypeOk);
  return `<section class="sec"><div class="sec-h"><div class="chips">${f("all", "Everyone")}${f("following", "Following")}${f("alliance", "Alliance")}${f("mine", "Mine")}</div><button class="btn sm snap" data-a="compose">${ICON.plus} Post</button></div>${typeof feedTypeChips === "function" ? feedTypeChips() : ""}
    ${posts.length ? posts.slice(0, 60).map(postHtml).join("") : `<div class="empty"><strong>Nothing here yet</strong><span>Post a win, a deck, or your season stats to get things going.</span><button class="btn snap" data-a="compose">Write a post</button></div>`}</section>`;
}
const POST_LABEL = { win: "Win", loss: "Loss", deck: "Deck", stats: "Stats", variant: "Variant pull", custom: "Custom card", text: "" };
function sharedDeckHtml(dk, author, id) {
  const vars = obj(dk.variants);
  return `<b>${esc(dk.name)}</b><div class="chiplist">${arr(dk.cards).slice(0, 12).map((n) => nameChip(n, vars[n] ? ` <span class="muted">· ${esc(vars[n])}</span>` : "")).join("")}</div>
    ${arr(dk.custom).filter((c) => c && typeof c === "object").length ? `<div class="row">${arr(dk.custom).filter((c) => c && typeof c === "object").slice(0, 3).map((c) => customCardHtml(c, true)).join("")}</div>` : ""}
    ${dk.stats && num(dk.stats.games) ? `<span class="muted small">${num(dk.stats.w)}-${num(dk.stats.l)}-${num(dk.stats.t)} · ${num(dk.stats.wr)}% over ${num(dk.stats.games)} games</span>` : ""}
    <div class="row">${dk.code ? `<button class="btn sm" data-a="copySharedCode" data-author="${esc(author)}" data-id="${esc(id)}">${ICON.copy} Copy deck code</button>` : ""}${author !== store.uid ? `<button class="btn sm" data-a="saveSharedDeck" data-owner="${esc(author)}" data-id="${esc(id)}">${ICON.save} Save to my decks</button>` : ""}</div>`;
}
function postHtml(p) {
  const r = reactionsFor(p.author, p.id); const pa = obj(p.payload); const pr = prof(p.author) || {};
  let att = "";
  if ((p.type === "win" || p.type === "loss") && pa.match) {
    const m = obj(pa.match);
    att = `<div class="att"><div class="row between"><span class="pill ${p.type === "win" ? "W" : "L"}">${p.type === "win" ? "Win" : "Loss"}</span>${cubes(signed(num(m.cubes)), num(m.cubes) >= 0 ? "pos" : "neg")}</div>
      <div class="small"><b>${esc(m.deckName || "No deck")}</b>${m.opp ? ` <span class="muted">vs ${esc(m.opp)}</span>` : ""}${m.turn ? ` <span class="muted">· turn ${esc(m.turn)}</span>` : ""}</div>
      ${arr(m.cards).length ? `<div class="chiplist">${arr(m.cards).filter((n) => typeof n === "string").slice(0, 12).map((n) => nameChip(n)).join("")}</div>` : ""}
      ${arr(m.locs).length ? `<div class="small muted">${arr(m.locs).map(obj).map((l) => `${esc(l.name || "?")} ${num(l.my)}–${num(l.opp)}`).join(" · ")}</div>` : ""}
      ${arr(m.oppCards).length ? `<div class="small muted">They played: ${esc(arr(m.oppCards).slice(0, 12).map(String).join(", "))}</div>` : ""}</div>`;
  } else if (p.type === "deck" && pa.deck) att = `<div class="att">${sharedDeckHtml(pa.deck, p.author, p.id)}</div>`;
  else if (p.type === "stats" && pa.stats) { const s = pa.stats; att = `<div class="att"><div class="eyebrow">${esc(s.label)}</div><div class="tiles"><div class="tile"><div class="k">Win rate</div><div class="v">${num(s.wr)}%</div></div><div class="tile"><div class="k">Record</div><div class="v">${num(s.w)}-${num(s.l)}</div></div><div class="tile"><div class="k">Net cubes</div><div class="v ${num(s.cubes) >= 0 ? "pos" : "neg"}">${signed(num(s.cubes))}</div></div></div>${s.rank ? `<span class="small muted">Rank ${esc(s.rank)}</span>` : ""}</div>`; }
  else if (p.type === "variant" && pa.variant) att = `<div class="att"><div class="row nowrap"><div style="width:96px;flex:none">${cardFace({ key: keyOf(pa.variant.card), name: String(pa.variant.card), cost: cardByName(pa.variant.card)?.cost ?? "?", power: cardByName(pa.variant.card)?.power ?? "?", tags: [] }, { a: "noop", cls: "own", variant: { id: pa.variant.name, name: String(pa.variant.name) }, art: safeUrl(pa.variant.art) || (cardByName(pa.variant.card) || {}).art })}</div><div class="stack small"><b>${esc(pa.variant.card)}</b><span>${esc(pa.variant.name)}</span>${pa.variant.artist && keyOf(pa.variant.artist) !== keyOf(pa.variant.name) ? `<span class="muted">by ${esc(pa.variant.artist)}</span>` : ""}${pa.variant.rarity ? `<span class="muted">${esc(pa.variant.rarity)}</span>` : ""}</div></div></div>`;
  else if (p.type === "custom" && pa.custom) att = `<div class="att" style="align-items:flex-start">${customCardHtml(pa.custom)}</div>`;
  else if (p.type === "milestone" && typeof milestoneAttHtml === "function") att = milestoneAttHtml(pa);
  const open = ui.openComments[r.k];
  return `<article class="post"><div class="post-h"><button data-a="profileOpen" data-id="${esc(p.author)}" style="background:none;border:0;padding:0">${avatarHtml(pr.avatar, handleOf(p.author), p.author)}</button><div class="who"><b>${esc(handleOf(p.author))}</b><span class="muted small">${pr.country ? flag(pr.country) + " " : ""}${pr.alliance ? esc(pr.alliance) + " · " : ""}${esc(ago(num(p.ts)))}</span></div>${p.alliance ? `<span class="pill gold">Alliance</span>` : ""}${POST_LABEL[p.type] ? `<span class="pill dim">${POST_LABEL[p.type]}</span>` : ""}</div>
    ${p.text ? `<div class="body">${esc(p.text)}</div>` : ""}${att}
    <div class="acts"><button class="${r.mine === 1 ? "on" : ""}" data-a="react" data-v="1" data-k="${esc(r.k)}" aria-pressed="${r.mine === 1}" aria-label="Like">${ICON.up}${r.likes || ""}</button><button class="down ${r.mine === -1 ? "on" : ""}" data-a="react" data-v="-1" data-k="${esc(r.k)}" aria-pressed="${r.mine === -1}" aria-label="Dislike">${ICON.down}${r.dislikes || ""}</button><button data-a="toggleComments" data-k="${esc(r.k)}">${ICON.talk}${r.comments.length || ""}</button>${emoBtn(r.k, "react", "React with an emote")}
    ${p.author === store.uid ? `<button data-a="postDelete" data-id="${esc(p.id)}" style="margin-left:auto">${ui.postDelArm === p.id ? "Tap again to delete" : "Delete"}</button>` : store.mode === "cloud" ? `<button data-a="reportOpen" data-k="${esc(p.author)}" data-id="${esc(p.id)}" style="margin-left:auto">Report</button>` : ""}</div>
    ${emoteBar(r.k)}
    ${open ? `<div class="stack">${r.comments.map((c) => { const ck = "c:" + String(c.id || ""); return `<div class="cmt-w"><div class="cmt"><b>${esc(handleOf(c.who))}</b>${commentBody(c)}${c.id ? `<span class="cmt-emo">${emoBtn(ck, "react", "React to this comment")}</span>` : ""}</div>${c.id ? emoteBar(ck, true) : ""}</div>`; }).join("")}
      <div class="row nowrap"><input type="text" id="cm-${esc(r.k.replace(/[^a-zA-Z0-9]/g, ""))}" placeholder="Add a comment" aria-label="Add a comment"><span class="cmt-emo big">${emoBtn(r.k, "comment", "Send an emote")}</span><button class="btn sm" data-a="comment" data-k="${esc(r.k)}">Send</button></div></div>` : ""}</article>`;
}
function followBtn(id) {
  const st = followState(id); const priv = shared.profiles[id] && shared.profiles[id].visibility === "private";
  const label = { none: priv ? "Request" : "Follow", following: "Following", pending: "Requested", denied: "Not approved · Cancel", self: "" }[st];
  return st === "self" ? "" : `<button class="btn sm ${st === "none" ? "snap" : ""}" data-a="follow" data-id="${esc(id)}">${label}</button>`;
}
function vPeople() {
  const q = keyOf(ui.peopleQ || ""); const reqs = incomingRequests();
  const list = Object.entries(shared.profiles).filter(([id, p]) => id !== store.uid && p.handle && (!q || [p.handle, p.name, p.alliance, countryName(p.country)].some((s) => keyOf(s).includes(q))));
  return `${reqs.length ? `<section class="sec"><h2>Follow requests</h2><div class="list">${reqs.map((id) => `<div class="li">${avatarHtml(prof(id)?.avatar, handleOf(id), id)}<div class="grow"><div class="t">${esc(handleOf(id))}</div><div class="s">${esc(prof(id)?.alliance || "")}</div></div><button class="btn sm snap" data-a="reqApprove" data-id="${esc(id)}">Approve</button><button class="btn sm" data-a="reqDeny" data-id="${esc(id)}">Deny</button></div>`).join("")}</div></section>` : ""}
  <section class="sec"><div class="row between"><span class="muted small">${followersOf(store.uid).length} followers · ${S.following.filter((id) => followState(id) === "following").length} following</span><button class="btn sm" data-a="profileOpen" data-id="${esc(store.uid)}">My profile</button></div>
    <input type="search" id="people-q" data-ui="peopleQ" value="${esc(ui.peopleQ || "")}" placeholder="Search players, alliances or countries" aria-label="Search players">
    ${list.length ? `<div class="list">${list.map(([id, p]) => { const s = obj(obj(p.stats).season); const see = canSee(id); return `<div class="li">${avatarHtml(p.avatar, p.handle, id)}<button class="grow" data-a="profileOpen" data-id="${esc(id)}" style="background:none;border:0;text-align:left;padding:0;min-width:0"><div class="t">${p.country ? flag(p.country) + " " : ""}${esc(p.handle)}${p.visibility === "private" ? " " + ICON.lock : ""}</div><div class="s">${p.alliance ? esc(p.alliance) + " · " : ""}${see ? (num(s.games) ? `${num(s.wr)}% this season · ${signed(num(s.cubes))} cubes` : "No games this season") : "Private profile"}</div></button>${followBtn(id)}</div>`; }).join("")}</div>`
      : `<div class="empty"><strong>No other players yet</strong><span>Share this app with friends. Anyone who sets up a profile shows up here.</span></div>`}</section>`;
}
function profileSheet(id) {
  return () => {
    const p = prof(id); if (!p) return sheetHead("Player not found");
    const isMe = id === store.uid; const see = canSee(id);
    const st = isMe ? { all: slimStats(statsFor(realMatches())), season: slimStats(statsFor((() => { const c = currentSeasonPeriod(); return c ? inPeriod(realMatches(), c) : []; })())), d30: slimStats(statsFor(inPeriod(realMatches(), periodById("d30")))) } : obj(p.stats);
    const blk = (l, s) => `<div class="tile"><div class="k">${esc(l)}</div><div class="v">${num(s && s.wr)}%</div><div class="small muted num">${num(s && s.w)}-${num(s && s.l)}-${num(s && s.t)} · ${signed(num(s && s.cubes))}</div></div>`;
    const featured = isMe ? (S.decks.find((d) => d.id === S.me.featuredDeck) ? deckPublic(S.decks.find((d) => d.id === S.me.featuredDeck)) : null) : p.featured;
    const posts = allPosts().filter((x) => x.author === id).slice(0, 8);
    const pass = isMe ? (() => { const cs = currentSeason(); return cs ? { level: num(obj(S.passes[cs.id]).level), of: num(cs.passLevels) || 50, tier: obj(S.passes[cs.id]).tier } : null; })() : p.pass;
    return `${sheetHead(esc(p.handle || "Player"), [p.name, p.country ? flag(p.country) + " " + countryName(p.country) : ""].filter(Boolean).map(esc).join(" · "))}
      ${bannerHtml(p.banner, p.handle)}
      <div class="prof-head">${avatarHtml(p.avatar, p.handle, id, "lg")}<div class="stack" style="gap:2px;flex:1;min-width:0"><span class="small muted">${[p.alliance, p.snapId ? "ID " + p.snapId : ""].filter(Boolean).map(esc).join(" · ")}</span><span class="small">${followersOf(id).length} followers · ${arr(p.following).length} following${p.colLevel ? ` · CL ${fmt(p.colLevel)}` : ""}</span></div>${rankBadge(p.rank)}</div>
      <div class="row">${isMe ? `<button class="btn sm" data-a="go" data-to="account">Edit profile</button>` : followBtn(id) + (store.mode === "cloud" && p.handle ? `<button class="btn sm" data-a="challengeOpen" data-id="${esc(id)}">Challenge</button>` : "") + `<button class="btn sm ghost" data-a="muteAuthor" data-id="${esc(id)}">${isMuted(id) ? "Unmute" : "Mute"}</button>`}${p.visibility === "private" ? `<span class="pill dim">${ICON.lock} Private</span>` : ""}${p.peak ? `<span class="pill gold">Peak ${esc(p.peak)}</span>` : ""}</div>${extHtml(EXT.playerSheet, id, p, see)}
      ${!see ? `<div class="empty"><strong>${ICON.lock} This profile is private</strong><span>Send a follow request. Once approved you'll see their stats, decks and posts.</span></div>` : `
      <div class="tiles">${blk("All time", st.all)}${blk(p.seasonLabel || "This season", st.season)}${blk("Last 30", st.d30)}</div>
      ${badgeChips(isMe ? earnedBadges() : p.badges)}
      ${pass ? `<div class="stack" style="gap:4px"><span class="small">Season pass level <b>${num(pass.level)}</b> / ${num(pass.of)}${pass.tier && pass.tier !== "free" ? " · " + esc(PASS_TIERS[pass.tier] || "") : ""}</span>${passBar(num(pass.level), num(pass.of) || 50)}</div>` : ""}
      ${featured ? `<h3>Featured deck</h3><div class="post"><div class="att">${sharedDeckHtml(featured, id, "featured")}</div></div>` : ""}
      ${posts.length ? `<h3>Recent posts</h3>${posts.map(postHtml).join("")}` : ""}`}`;
  };
}
function allianceRows() {
  const mine = allyKey(S.me.alliance); if (!mine) return [];
  const rows = Object.entries(shared.profiles).filter(([id, p]) => id !== store.uid && allyKey(p.alliance) === mine).map(([id, p]) => ({ id, p, s: obj(obj(p.stats).season) }));
  const cur = currentSeasonPeriod();
  rows.push({ id: store.uid, p: { handle: S.me.handle || "You", country: S.me.country, rank: S.me.rank, colLevel: S.me.colLevel, alliancePts: num(S.alliance.points), allianceTier: num(S.alliance.tier), allianceTiers: num(S.alliance.tiers), allianceRole: S.alliance.role, avatar: S.me.avatar }, s: slimStats(statsFor(cur ? inPeriod(realMatches(), cur) : [])), me: true });
  return rows;
}
function vAlliance() {
  if (!allyKey(S.me.alliance)) return `<section class="sec"><div class="empty"><strong>Add your alliance name</strong><span>Members who enter the same alliance name are grouped here with their stats, alliance points and reward progress.</span><button class="btn snap" data-a="onboard">Set alliance</button></div></section>`;
  const sortBy = ui.allianceSort || "pts"; const rows = allianceRows();
  const val = { pts: (r) => num(r.p.alliancePts), cubes: (r) => num(r.s.cubes), wr: (r) => num(r.s.wr), games: (r) => num(r.s.games), rank: (r) => rankVal(r.p.rank), cl: (r) => num(r.p.colLevel) };
  rows.sort((a, b) => val[sortBy](b) - val[sortBy](a));
  const totalPts = rows.reduce((s, r) => s + num(r.p.alliancePts), 0);
  const ch = (k, l) => `<button class="chip" data-a="allianceSort" data-v="${k}" aria-pressed="${sortBy === k}">${l}</button>`;
  return `<section class="sec"><div class="sec-h"><h2>${esc(S.me.alliance)}</h2><span class="muted small">${rows.length} member${rows.length === 1 ? "" : "s"} · ${fmt(totalPts)} alliance points</span></div>
    ${allianceExtraHtml()}
    ${allianceWeekHtml()}
    <div class="panel stack"><h3>My alliance progress</h3>
      <div class="grid2"><label class="f">Alliance points this week<input type="number" id="al-pts" data-bind="alliance.points" data-num="1" value="${esc(S.alliance.points)}" inputmode="numeric"></label><label class="f">Role<input type="text" id="al-role" data-bind="alliance.role" value="${esc(S.alliance.role)}" placeholder="Leader, Officer, Member"></label></div>
      <div class="grid2"><label class="f">Reward tiers reached<input type="number" id="al-tier" data-bind="alliance.tier" data-num="1" value="${esc(S.alliance.tier)}" inputmode="numeric"></label><label class="f">Out of<input type="number" id="al-tiers" data-bind="alliance.tiers" data-num="1" value="${esc(S.alliance.tiers)}" inputmode="numeric"></label></div></div>
    <div class="chips">${ch("pts", "Alliance pts")}${ch("cubes", "Season cubes")}${ch("wr", "Win %")}${ch("games", "Games")}${ch("rank", "Rank")}${ch("cl", "Collection")}</div>
    <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Player</th><th class="n">Pts</th><th class="n">Rewards</th><th class="n">Rank</th><th class="n">Cubes</th><th class="n">Win %</th><th class="n">Games</th><th class="n">CL</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${r.me ? `<b>${esc(r.p.handle)}</b> <span class="muted small">you</span>` : `<button class="chip" data-a="profileOpen" data-id="${esc(r.id)}">${r.p.country ? flag(r.p.country) + " " : ""}${esc(r.p.handle)}</button>`}${r.p.allianceRole ? ` <span class="muted small">${esc(r.p.allianceRole)}</span>` : ""}</td><td class="n">${fmt(r.p.alliancePts)}</td><td class="n">${num(r.p.allianceTiers) ? `${num(r.p.allianceTier)}/${num(r.p.allianceTiers)}` : "—"}</td><td class="n">${esc(r.p.rank || "—")}</td><td class="n ${num(r.s.cubes) >= 0 ? "pos" : "neg"}">${signed(num(r.s.cubes))}</td><td class="n">${num(r.s.wr)}%</td><td class="n">${num(r.s.games)}</td><td class="n">${r.p.colLevel ? fmt(r.p.colLevel) : "—"}</td></tr>`).join("")}</tbody></table></div>
    <p class="muted small">Members appear after they open this app and enter the same alliance name. Season columns cover this season.</p>
    <div class="row"><button class="btn sm" data-a="go" data-to="tournaments">Tournaments</button></div></section>
  <section class="sec">${allianceBoardHtml()}</section>`;
}
function vLeaderboard() {
  const scope = ui.lbScope, sortBy = ui.lbSort; const cur = currentSeasonPeriod();
  let rows = Object.entries(shared.profiles).filter(([id, p]) => id !== store.uid && p.handle && canSee(id)).map(([id, p]) => ({ id, p, s: obj(obj(p.stats).season), a: obj(obj(p.stats).all) }));
  if (S.me.handle.trim()) rows.push({ id: store.uid, p: { handle: S.me.handle, country: S.me.country, rank: S.me.rank, colLevel: S.me.colLevel, alliance: S.me.alliance, avatar: S.me.avatar }, s: slimStats(statsFor(cur ? inPeriod(realMatches(), cur) : [])), a: slimStats(statsFor(realMatches())), me: true });
  if (scope === "country") rows = rows.filter((r) => S.me.country && r.p.country === S.me.country);
  if (scope === "following") rows = rows.filter((r) => r.me || followState(r.id) === "following");
  if (scope === "alliance") rows = rows.filter((r) => r.me || sameAlliance(r.id));
  const val = { cubes: (r) => num(r.s.cubes), wr: (r) => (num(r.s.games) >= 5 ? num(r.s.wr) : -1), games: (r) => num(r.s.games), rank: (r) => rankVal(r.p.rank), cl: (r) => num(r.p.colLevel), allcubes: (r) => num(r.a.cubes) };
  rows.sort((a, b) => val[sortBy](b) - val[sortBy](a));
  const sc = (v, l) => `<button class="chip" data-a="lbScope" data-v="${v}" aria-pressed="${scope === v}">${l}</button>`;
  const show = { cubes: (r) => signed(num(r.s.cubes)), wr: (r) => (num(r.s.games) >= 5 ? num(r.s.wr) + "%" : "—"), games: (r) => num(r.s.games), rank: (r) => esc(r.p.rank || "—"), cl: (r) => (r.p.colLevel ? fmt(r.p.colLevel) : "—"), allcubes: (r) => signed(num(r.a.cubes)) };
  return `<section class="sec"><h2>Leaderboard</h2>${percentilesHtml()}
    <div class="chips">${sc("all", "Everyone")}${sc("country", S.me.country ? flag(S.me.country) + " My country" : "My country")}${sc("following", "Following")}${sc("alliance", "Alliance")}</div>
    <label class="f">Rank by<select id="lb-sort" data-uisel="lbSort">${[["cubes", "Season cubes"], ["wr", "Season win % (5+ games)"], ["games", "Season games"], ["rank", "Current rank"], ["cl", "Collection level"], ["allcubes", "All-time cubes"]].map(([v, l]) => `<option value="${v}" ${sortBy === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    ${scope === "country" && !S.me.country ? `<p class="note">Add your country in your profile to see your country's board.</p>` : ""}
    ${rows.length ? `<div class="list">${rows.slice(0, 100).map((r, i) => `<div class="li"><span class="num" style="width:26px;font-weight:800;font-size:17px">${i + 1}</span>${avatarHtml(r.p.avatar, r.p.handle, r.id)}<button class="grow" data-a="profileOpen" data-id="${esc(r.id)}" style="background:none;border:0;text-align:left;padding:0;min-width:0"><div class="t">${r.p.country ? flag(r.p.country) + " " : ""}${esc(r.p.handle)}${r.me ? ` <span class="muted small">you</span>` : ""}</div><div class="s">${[r.p.alliance, r.p.country ? countryName(r.p.country) : ""].filter(Boolean).map(esc).join(" · ")}</div></button><span class="num" style="font-weight:800;font-size:17px">${show[sortBy](r)}</span></div>`).join("")}</div>`
      : `<div class="empty"><span>No players on this board yet.</span></div>`}
    <p class="muted small">Ranks players using this app${cur ? ` for ${esc(plainLabel(cur))}` : ""}. Private profiles appear only to approved followers and their alliance.</p></section>`;
}
const pc = { type: "text", text: "", matchId: "", deckId: "", period: "", variantId: "", customId: "" };
function composeSheet() {
  const t = (v, l) => `<button class="chip" data-a="pcType" data-v="${v}" aria-pressed="${pc.type === v}">${l}</button>`;
  const recent = allMatches().filter((m) => m.result !== "T").slice(0, 30);
  let pick = "";
  if (pc.type === "result") pick = recent.length ? `<label class="f">Match<select id="pc-match" data-pc="matchId">${recent.map((m) => `<option value="${esc(m.id)}" ${pc.matchId === m.id ? "selected" : ""}>${m.result === "W" ? "Win" : "Loss"} ${signed(num(m.cubes))} · ${esc(m.deckName || "No deck")} · ${esc(dayStr(m.ts))}</option>`).join("")}</select></label>` : `<p class="note">Log a match first.</p>`;
  if (pc.type === "deck") pick = S.decks.length ? `<label class="f">Deck<select id="pc-deck" data-pc="deckId">${S.decks.map((d) => `<option value="${esc(d.id)}" ${pc.deckId === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label><p class="muted small">Shows your favorite variant on each card. Others can copy the code or save the deck.</p>` : `<p class="note">Build a deck first.</p>`;
  if (pc.type === "stats") pick = `<label class="f">Period<select id="pc-period" data-pc="period">${periods().map((p) => `<option value="${esc(p.id)}" ${pc.period === p.id ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>`;
  if (pc.type === "variant") pick = S.variants.filter((v) => v.owned).length ? `<label class="f">Variant<select id="pc-var" data-pc="variantId">${S.variants.filter((v) => v.owned).map((v) => `<option value="${esc(v.id)}" ${pc.variantId === v.id ? "selected" : ""}>${esc(card(v.card).name)} · ${esc(v.name)}</option>`).join("")}</select></label>` : `<p class="note">Mark a variant as owned in Collection first.</p>`;
  if (pc.type === "custom") pick = S.custom.length ? `<label class="f">Custom card<select id="pc-custom" data-pc="customId">${S.custom.map((c) => `<option value="${esc(c.id)}" ${pc.customId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>` : `<p class="note">Design a custom card in More first.</p>`;
  return `${sheetHead("New post", S.me.visibility === "private" ? "Your profile is private: followers you approve, and players who enter your alliance's name, see this" : "")}<div class="chips">${t("text", "Text")}${t("result", "Win / loss")}${t("deck", "Deck")}${t("stats", "Stats")}${t("variant", "Variant")}${t("custom", "Custom card")}</div>${pick}
    <label class="f">What's up?<textarea id="pc-text" data-pc="text" maxlength="600" placeholder="Say something about it">${esc(pc.text)}</textarea></label>${S.me.alliance.trim() ? `<label class="check"><input type="checkbox" data-pcchk="alliance" ${pc.alliance ? "checked" : ""}> Only on my alliance's board (${esc(S.me.alliance)})</label>` : ""}<button class="btn snap" data-a="postSubmit">Post</button>`;
}
