/* ============ More ============ */
function vMore() {
  if (ui.more) return { shops: vShops, promos: vPromos, seasons: vSeasons, events: vEvents, locations: vLocations, balance: vBalance, reports: vReports, tournaments: vTournaments, progress: vProgress, catchup: () => `<section class="sec">${backBar("Catch-up plan")}</section><section class="sec">${catchUpSheet().replace(/<div class="sheet-h">[\s\S]*?<\/button><\/div>/, "")}</section>`, custom: vCustom, account: vAccount, about: vAbout }[ui.more]();
  const item = (to, t, s) => `<button class="li" data-a="go" data-to="${to}"><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="muted">›</span></button>`;
  const alerts = wishAlerts().length; const promos = promoList().filter((p) => p.status === "active" && !S.redeemed[p.id]).length;
  const cs = currentSeason(); const liveEv = events().filter((e) => timeState(e) === "live").length;
  return `<section class="sec"><h1>More</h1><div class="list">
    ${item("seasons", "Seasons, ranks & passes", cs ? `${esc(cs.name)} · ${endsTxt(cs.endTs)}` : `${seasons().length} tracked`)}
    ${item("events", "Events & limited-time modes", liveEv ? `${liveEv} live now` : `${events().length} tracked`)}
    ${item("locations", "Locations", allLocations().length ? `${allLocations().filter((l) => !l.soon).length} locations, their effects and how you do on them` : "How you do on each location")}
    ${item("balance", "Balance changes", (() => { const n = balanceChanges().filter((x) => x.date >= localDate(Date.now() - 14 * DAY) && deckCardKeys().has(x.key)).length; return n ? `${n} change${n > 1 ? "s" : ""} to cards in your decks lately` : "Every buff, nerf and rework"; })())}
    ${item("catchup", "Catch-up plan", "New or coming back? What to do first")}
    ${item("tournaments", "Tournaments", (() => { const n = Object.values(tourneys).filter((t) => t && t.name && tVisible(t) && t.status !== "done").length; return n ? `${n} open or being played` : "Brackets with friends or your alliance"; })())}
    ${isAppOwner() ? item("reports", "Reported posts", "Review what players reported") : ""}
    ${item("shops", "Shops & wishlist alerts", alerts ? `${alerts} wishlist item${alerts > 1 ? "s" : ""} on sale` : "Credits, gold, tokens and current offers")}
    ${item("promos", "Promo codes", promos ? `${promos} active code${promos > 1 ? "s" : ""} you haven't redeemed` : "Codes for the web shop")}
    ${item("progress", "Upgrades & boosters", (() => { const n = readyUpgrades().length; return n ? `${n} card${n === 1 ? "" : "s"} ready to upgrade` : "Boosters, upgrades, splits, borders and Reroll Coins"; })())}
    ${item("custom", "Custom cards", `${Object.keys(obj(S.looks)).length} from the game`)}
    ${item("account", "Profile & account", S.me.handle ? esc(S.me.handle) : "Set up your profile")}
    ${item("about", "About & legal", "Fan-made app disclaimer")}</div>
    <p class="muted small">Unofficial fan-made app. Not affiliated with or endorsed by Marvel or Second Dinner.</p></section>`;
}
function vAbout() {
  return `<section class="sec">${backBar("About")}
    <div class="panel stack halftone"><h2>SNAP Stat</h2><p class="small">A fan-made companion for tracking your MARVEL SNAP matches, collection, decks, seasons and alliance.</p></div></section>
  <section class="sec"><h2>Disclaimer</h2><div class="panel stack">
    <p>SNAP Stat is an unofficial fan-made app. It is not affiliated with, endorsed, sponsored or approved by Marvel or Second Dinner.</p>
    <p>MARVEL SNAP and all related names, characters, cards and images are trademarks and copyrights of their respective owners and are used here only to identify them.</p>
    ${showArt() ? `<p class="muted small">Card art, variant art, card details and the variant list are loaded from Marvel Snap Zone (marvelsnapzone.com), a fan site. The art belongs to Marvel and Second Dinner. SNAP Stat doesn't store or host it, and shows a styled tile when it can't load.</p>` : `<p class="muted small">SNAP Stat doesn't use official card art or logos. Card tiles, avatars and banners are drawn by the app or uploaded by players.</p>`}
    ${window.SNAPSTAT_STANDALONE ? `<p class="small">${privacyLink()}</p>` : ""}
    <p class="muted small">Card, season and event details are entered by players or gathered from public community sources${showArt() ? " (Marvel Snap Zone for cards, variants and locations; snap.fan for seasons and limited-time events)" : ""}, and may be incomplete or out of date. Season dates from snap.fan are estimated.</p></div></section>`;
}
/* Locations: every one in the game (from the card data file) plus your results on each */
function vLocations() {
  const q = keyOf(ui.locQ || ""), ql = String(ui.locQ || "").toLowerCase();
  const stats = new Map(locationAnalytics(realMatches()).map((r) => [keyOf(r.name), r]));
  let all = allLocations();
  if (!all.length) all = [...stats.values()].map((r) => ({ name: r.name, ability: "", art: "", soon: false }));
  const soonN = all.filter((l) => l.soon).length;
  let list = all.filter((l) => (showSoon() || !l.soon || stats.has(keyOf(l.name))) && (!q || keyOf(l.name).includes(q) || String(l.ability || "").toLowerCase().includes(ql)));
  const st = (l) => stats.get(keyOf(l.name));
  const sorters = { name: (a, b) => a.name.localeCompare(b.name), played: (a, b) => ((st(b) || {}).games || 0) - ((st(a) || {}).games || 0) || a.name.localeCompare(b.name), win: (a, b) => (st(b) ? st(b).wr : -1) - (st(a) ? st(a).wr : -1) || ((st(b) || {}).games || 0) - ((st(a) || {}).games || 0) || a.name.localeCompare(b.name) };
  list = [...list].sort(sorters[ui.locSort] || sorters.name);
  const row = (l) => { const r = st(l);
    return `<button class="li lrow" data-a="locOpen" data-name="${esc(l.name)}">${locPic(l, "lph")}
      <div class="grow"><div class="t">${esc(l.name)} ${l.soon ? `<span class="pill gold">Soon</span>` : ""}</div>${l.ability ? `<div class="s">${esc(l.ability)}</div>` : ""}
      ${r ? `<div class="s num">You: ${r.games} game${r.games === 1 ? "" : "s"} · ${r.wr}% match wins · won it ${r.lwr}% · avg power ${r.avg}</div>` : ""}${locCommunityLine(l.name)}</div><span class="muted">›</span></button>`; };
  return `<section class="sec">${backBar("Locations")}
    <p class="muted small">${CAT ? "Every location in the game with its effect, updated daily from Marvel Snap Zone. " : ""}Tap a location for your win rate, power and the cards you play there. Your numbers come from tracked matches where the locations were named.</p>
    <input type="search" id="loc-q" data-ui="locQ" value="${esc(ui.locQ || "")}" placeholder="Search name or effect" aria-label="Search locations">
    <div class="grid2"><label class="f">Sort<select id="loc-sort" data-uisel="locSort">${[["name", "Name"], ["played", "Most played"], ["win", "Best win rate"]].map(([v, l]) => `<option value="${v}" ${(ui.locSort || "name") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    ${soonN ? `<label class="check"><input type="checkbox" data-soonchk ${showSoon() ? "checked" : ""}> Show ones that aren't out yet</label>` : ""}
    <span class="muted small">${list.length} location${list.length === 1 ? "" : "s"}</span>
    ${list.length ? `<div class="list">${list.map(row).join("")}</div>` : `<div class="empty"><strong>No locations here</strong><span>${all.length ? "Try a different search." : "Name the locations when you track a match and they'll show up here."}</span></div>`}</section>`;
}
// The link names the site it really goes to (some point to marvelsnap.com, not snap.fan)
function srcLink(x) { const u = safeUrl(x.link); if (!u) return ""; let site = "the web"; try { site = new URL(u).hostname.replace(/^www\./, ""); } catch { /* keep "the web" */ } return `<p class="small"><a href="${esc(u)}" target="_blank" rel="noopener">${x.auto ? "Filled in from snap.fan · " : ""}Rewards and details on ${esc(site)} ↗</a></p>`; }
function backBar(t) { return `<div class="row"><button class="btn sm ghost" data-a="go" data-to="more">‹ More</button></div><h1>${t}</h1>`; }
function stateTabs(key, counts) { const v = ui[key]; const b = (x, l) => `<button data-a="tabState" data-k="${key}" data-v="${x}" aria-pressed="${v === x}">${l} ${counts[x] ? `<span class="num">${counts[x]}</span>` : ""}</button>`; return `<div class="seg">${b("current", "Now")}${b("upcoming", "Upcoming")}${b("past", "Past")}</div>`; }
const st2tab = (s) => (s === "live" ? "current" : s);

/* Seasons */
function vSeasons() {
  const all = seasons(); const counts = { current: 0, upcoming: 0, past: 0 }; all.forEach((s) => counts[st2tab(timeState(s))]++);
  const list = all.filter((s) => st2tab(timeState(s)) === ui.seasonTab); if (ui.seasonTab === "upcoming") list.reverse();
  return `<section class="sec">${backBar("Seasons")}
    <p class="muted small">Each season's dates, pass card, new cards, variants and rewards, plus your rank, pass level and what you collected.${store.mode === "cloud" ? " Season info is shared with everyone using this app." : ""}</p>
    ${stateTabs("seasonTab", counts)}
    ${list.length ? `<div class="list">${list.map(seasonRow).join("")}</div>` : `<div class="empty"><span>${ui.seasonTab === "current" ? "No season running right now in your list." : ui.seasonTab === "upcoming" ? "No upcoming seasons added yet." : "No past seasons added yet."}</span>${store.provider === "firebase" && store.mode === "cloud" && canEditShared() && !seasons().length && !events().length ? `<button class="btn snap" data-a="loadSeed">Load season & event history</button>` : ""}</div>`}
    ${canEditShared() ? `<button class="btn snap" data-a="seasonNew">${ICON.plus} Add season</button>` : `<p class="muted small">Seasons fill in automatically. The app owner can add or fix them.</p>`}</section>`;
}
function seasonRow(s) {
  const st = timeState(s); const p = obj(S.passes[s.id]); const r = obj(S.ranks["s:" + s.id]); const items = collectibleItems(s); const got = items.filter((it) => findCollectible(it, s.name, s.startTs).owned).length;
  return `<button class="li" data-a="seasonOpen" data-id="${esc(s.id)}">${seasonPic(s, "sart")}<div class="grow"><div class="t">${esc(s.name)} ${st === "live" ? `<span class="pill live">Live</span>` : ""}</div>
    <div class="s" style="white-space:normal">${esc(dateStr(s.start))}${s.end ? " – " + esc(dateStr(s.end)) : ""}${st === "live" ? " · " + endsTxt(s.endTs) : st === "upcoming" ? " · starts in " + cdSpan(s.startTs) : ""}${items.length ? ` · ${got}/${items.length} collected` : ""}${p.level ? ` · pass ${num(p.level)}` : ""}${r.peak ? ` · peak ${esc(r.peak)}` : ""}</div></div><span class="muted">›</span></button>`;
}
let se = null;
function seasonSheet() {
  if (se.edit) return seasonEditHtml();
  const s = seasons().find((x) => x.id === se.id) || { ...se, startTs: dayStart(se.start), endTs: se.end ? dayEnd(se.end) : Infinity };
  const st = timeState(s); const p = obj(S.passes[s.id]); const r = obj(S.ranks["s:" + s.id]); const of = num(s.passLevels) || 50;
  const ms = realMatches().filter((m) => m.ts >= s.startTs && m.ts <= s.endTs); const stat = statsFor(ms);
  const items = collectibleItems(s); const got = items.filter((it) => findCollectible(it, s.name, s.startTs).owned).length;
  const evs = events().filter((e) => e.startTs <= s.endTs && e.endTs >= s.startTs);
  return `${sheetHead(esc(s.name), `${esc(dateStr(s.start))}${s.end ? " – " + esc(dateStr(s.end)) : ""} · ${st === "live" ? endsTxt(s.endTs) : st === "upcoming" ? "starts in " + cdSpan(s.startTs) : "ended"}`)}
    ${seasonPic(s, "shero")}
    ${s.passCard ? `<div class="row">${nameChip(s.passCard)}<span class="pill gold">Season pass card</span></div>` : ""}
    ${st !== "upcoming" ? `<div class="panel stack"><h3>My season</h3>
      <div class="grid2"><label class="f">${st === "live" ? "Current rank" : "Final rank"}<input type="text" id="sp-end" data-prog="season" data-id="${esc(s.id)}" data-f="end" value="${esc(r.end || (st === "live" ? S.me.rank : ""))}" placeholder="e.g. 72 or Infinite"></label><label class="f">Peak rank this season<input type="text" id="sp-peak" data-prog="season" data-id="${esc(s.id)}" data-f="peak" value="${esc(r.peak || "")}"></label></div>
      ${peakAllTime() ? `<span class="small">All-time peak: <b>${esc(peakAllTime())}</b>${S.me.peakAllSeason ? ` <span class="muted">(${esc(S.me.peakAllSeason)})</span>` : ""}</span>` : ""}
      <div class="row between"><span>Season pass level</span><div class="stepper"><button data-a="passStep" data-id="${esc(s.id)}" data-v="-1" aria-label="Lower">−</button><span>${num(p.level)}</span><button data-a="passStep" data-id="${esc(s.id)}" data-v="1" aria-label="Higher">+</button></div></div>
      ${passBar(num(p.level), of)}<span class="muted small">${num(p.level)} of ${of} levels${num(p.xpNext) ? ` · ${fmt(num(p.xp))}/${fmt(num(p.xpNext))} to the next` : ""}${p.tierAt ? " · pass type from your screenshots" : ""}</span>
      ${st === "live" ? passPaceHtml(s) : ""}
      <div class="seg">${Object.entries(PASS_TIERS).map(([k, l]) => `<button data-a="passTier" data-id="${esc(s.id)}" data-v="${k}" aria-pressed="${(p.tier || "free") === k}">${l}</button>`).join("")}</div>
      ${stat.games ? `<span class="small">You: ${stat.w}-${stat.l}-${stat.t} · ${stat.wr}% · ${signed(stat.cubes)} cubes</span>` : ""}</div>` : ""}
    <div class="sec-h"><h3>Collectibles</h3><span class="muted small">${items.length ? `${got}/${items.length} collected` : ""}</span></div>
    ${items.length ? (st === "live" ? passCollectiblesHtml(s, items) : collectibleList(items, s.name, seasonCtx(s))) : `<p class="muted small">${canEditShared() ? "No rewards listed. Edit the season to add them." : "No rewards listed yet."}</p>`}
    ${evs.length ? `<h3>Events this season</h3><div class="list">${evs.map((e) => `<button class="li" data-a="eventOpen" data-id="${esc(e.id)}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(EVENT_TYPES[e.type] || "Event")} · ${esc(dateStr(e.start))}${e.end ? " – " + esc(dateStr(e.end)) : ""}</div></div><span class="muted">›</span></button>`).join("")}</div>` : ""}
    ${st !== "upcoming" && ms.length ? `<button class="btn block" data-a="recapSeason" data-id="${esc(s.id)}">Make my ${esc(s.name)} recap picture</button>` : ""}
    ${s.notes ? `<p class="small muted" style="white-space:pre-wrap">${esc(s.notes)}</p>` : ""}${srcLink(s)}
    ${canEditShared() ? `<div class="row"><button class="btn" data-a="seasonEdit">Edit season info</button></div>` : ""}`;
}
let lastColl = { items: [], src: "" };
function collectibleList(items, srcName, ctx) {
  ctx = ctx || { name: srcName, when: 0, season: null, events: [] };
  return collRowsHtml(items.map((it) => ({ it, w: collWhere(it, ctx) })), ctx);
}
function linesOf(a) { return arr(a).join("\n"); }
function seasonEditHtml() {
  return `${sheetHead(se.isNew ? "Add season" : "Edit season")}
    <label class="f">Season name<input type="text" id="se-name" data-se="name" value="${esc(se.name)}" data-autofocus></label>
    <div class="grid2"><label class="f">Starts<input type="date" id="se-start" data-se="start" value="${esc(se.start)}"></label><label class="f">Ends<input type="date" id="se-end" data-se="end" value="${esc(se.end)}"></label></div>
    <div class="grid2"><label class="f">Season pass card<input type="text" id="se-pass" data-se="passCard" value="${esc(se.passCard || "")}"></label><label class="f">Pass levels<input type="number" id="se-levels" data-se="passLevels" value="${esc(se.passLevels || 50)}"></label></div>
    <label class="f">New cards (one per line)<textarea id="se-cards" data-se="cards">${esc(linesOf(se.cards))}</textarea></label>
    <label class="f">New variants (one per line, like “Dracula - Season Pass”)<textarea id="se-vars" data-se="variants">${esc(linesOf(se.variants))}</textarea></label>
    <label class="f">Other rewards (one per line, like “Avatar: Dracula” or “Title: Out for Blood”)<textarea id="se-rew" data-se="rewards">${esc(linesOf(se.rewards))}</textarea></label>
    <label class="f">Notes<textarea id="se-notes" data-se="notes">${esc(se.notes || "")}</textarea></label>
    <div class="row"><button class="btn snap" data-a="seasonSave">Save season</button>${se.isNew ? "" : `<button class="btn ghost" data-a="seasonView">Cancel</button><button class="btn danger" data-a="seasonDel">${se.confirmDel ? "Tap again to delete" : "Delete"}</button>`}</div>`;
}

/* Events */
function vEvents() {
  const all = events(); const counts = { current: 0, upcoming: 0, past: 0 }; all.forEach((e) => counts[st2tab(timeState(e))]++);
  let list = all.filter((e) => st2tab(timeState(e)) === ui.eventTab); if (ui.eventTab === "past") list = list.reverse();
  return `<section class="sec">${backBar("Events")}
    <p class="muted small">Events and limited-time game modes with their dates, reward tracks and collectibles, plus your progress on each pass.${store.mode === "cloud" ? " Event info is shared with everyone using this app." : ""}</p>
    ${stateTabs("eventTab", counts)}
    ${list.length ? `<div class="list">${list.map((e) => { const st = timeState(e); const pr = obj(S.eventProg[e.id]); const items = collectibleItems(e); const got = items.filter((it) => findCollectible(it, e.name, e.startTs).owned).length; return `<button class="li" data-a="eventOpen" data-id="${esc(e.id)}"><span class="pill ${st === "live" ? "live" : "dim"}">${st === "live" ? "LIVE" : esc(dayStr(e.startTs))}</span><div class="grow"><div class="t">${esc(e.name)}</div><div class="s" style="white-space:normal">${esc(EVENT_TYPES[e.type] || "Event")} · ${st === "live" ? endsTxt(e.endTs) : st === "upcoming" ? "starts in " + cdSpan(e.startTs) : esc(dateStr(e.start))}${items.length ? ` · ${got}/${items.length} collected` : ""}${num(e.passLevels) ? ` · pass ${num(pr.level)}/${num(e.passLevels)}` : ""}</div></div><span class="muted">›</span></button>`; }).join("")}</div>`
      : `<div class="empty"><span>${ui.eventTab === "current" ? "Nothing live right now in your list." : ui.eventTab === "upcoming" ? "No upcoming events added yet." : "No past events added yet."}</span>${store.provider === "firebase" && store.mode === "cloud" && canEditShared() && !seasons().length && !events().length ? `<button class="btn snap" data-a="loadSeed">Load season & event history</button>` : ""}</div>`}
    ${canEditShared() ? `<button class="btn snap" data-a="eventNew">${ICON.plus} Add event or mode</button>` : `<p class="muted small">Events fill in automatically. The app owner can add or fix them.</p>`}</section>`;
}
let ee = null;
function eventSheet() {
  if (ee.edit) return eventEditHtml();
  const e = events().find((x) => x.id === ee.id) || { ...ee, startTs: dayStart(ee.start), endTs: ee.end ? dayEnd(ee.end) : dayEnd(ee.start) };
  const st = timeState(e); const pr = obj(S.eventProg[e.id]); const items = collectibleItems(e); const got = items.filter((it) => findCollectible(it, e.name, e.startTs).owned).length;
  // Games logged in this mode by its own name (like "Deadpool's Diner" for "Deadpool's Diner mode"), or as "Event" or "Limited-time mode"
  const evKey = keyOf(e.name), isEvMode = (md) => md === "Event" || md === "Limited-time mode" || (!STD_MODES.has(md) && md !== "Other" && keyOf(md).length >= 4 && evKey.includes(keyOf(md)));
  const ms = realMatches().filter((m) => isEvMode(modeOf(m)) && m.ts >= e.startTs && m.ts <= e.endTs); const stat = statsFor(ms);
  return `${sheetHead(esc(e.name), `${esc(EVENT_TYPES[e.type] || "Event")} · ${esc(dateStr(e.start))}${e.end ? " – " + esc(dateStr(e.end)) : ""} · ${st === "live" ? endsTxt(e.endTs) : st === "upcoming" ? "starts in " + cdSpan(e.startTs) : "ended"}`)}
    ${dateStr(e.shopUntil) ? `<p class="small">${resetOn(e.shopUntil) <= Date.now() ? "Event shop closed on" : "Event shop open until"} ${esc(dateStr(e.shopUntil))}</p>` : ""}${e.desc ? `<p class="small" style="white-space:pre-wrap">${esc(e.desc)}</p>` : ""}${srcLink(e)}
    ${st !== "upcoming" ? `<div class="panel stack"><h3>My progress</h3>
      ${eventPassHtml(e, false)}
      ${num(e.passLevels) ? `<div class="row between"><span>Event pass level</span><div class="stepper"><button data-a="evStep" data-id="${esc(e.id)}" data-v="-1" aria-label="Lower">−</button><span>${num(pr.level)}</span><button data-a="evStep" data-id="${esc(e.id)}" data-v="1" aria-label="Higher">+</button></div></div>${passBar(num(pr.level), num(e.passLevels))}<span class="muted small">${num(pr.level)} of ${num(e.passLevels)}</span>
      <div class="seg">${Object.entries(PASS_TIERS).map(([k, l]) => `<button data-a="evTier" data-id="${esc(e.id)}" data-v="${k}" aria-pressed="${(pr.tier || "free") === k}">${l}</button>`).join("")}</div>` : ""}
      <label class="check"><input type="checkbox" data-evchk="played" data-id="${esc(e.id)}" ${pr.played ? "checked" : ""}> I played this</label>
      <label class="f">Notes<textarea id="ev-notes" data-evnotes="${esc(e.id)}" placeholder="Best result, decks that worked…">${esc(pr.notes || "")}</textarea></label>
      ${stat.games ? `<span class="small">Logged event games: ${stat.w}-${stat.l}-${stat.t} · ${stat.wr}%</span>` : `<span class="muted small">Log games in this mode (or as “Event”) during these dates to see your record here.</span>`}</div>` : ""}
    ${eventRecapHtml(e)}
    <div class="sec-h"><h3>Rewards & collectibles</h3><span class="muted small">${items.length ? `${got}/${items.length} collected` : ""}</span></div>
    ${items.length ? collectibleList(items, e.name, eventCtx(e)) : `<p class="muted small">${canEditShared() ? "No rewards listed. Edit the event to add them." : "No rewards listed yet."}</p>`}
    ${canEditShared() ? `<div class="row"><button class="btn" data-a="eventEdit">Edit event info</button></div>` : ""}`;
}
function eventEditHtml() {
  return `${sheetHead(ee.isNew ? "Add event or mode" : "Edit event")}
    <label class="f">Name<input type="text" id="ee-name" data-ee="name" value="${esc(ee.name)}" data-autofocus></label>
    <label class="f">Type<select id="ee-type" data-ee="type">${Object.entries(EVENT_TYPES).map(([k, l]) => `<option value="${k}" ${ee.type === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <div class="grid3"><label class="f">Starts<input type="date" id="ee-start" data-ee="start" value="${esc(ee.start)}"></label><label class="f">Ends<input type="date" id="ee-end" data-ee="end" value="${esc(ee.end)}"></label><label class="f">Shop open until<input type="date" id="ee-shop" data-ee="shopUntil" value="${esc(ee.shopUntil || "")}"></label></div>
    <label class="f">Event pass levels (0 if none)<input type="number" id="ee-levels" data-ee="passLevels" value="${esc(ee.passLevels || 0)}"></label>
    <label class="f">Rewards & collectibles (one per line, like “Card: Mordred” or “Variant: Thor - Event”)<textarea id="ee-coll" data-ee="collectibles">${esc(linesOf(ee.collectibles))}</textarea></label>
    <label class="f">Description<textarea id="ee-desc" data-ee="desc">${esc(ee.desc || "")}</textarea></label>
    <div class="row"><button class="btn snap" data-a="eventSave">Save</button>${ee.isNew ? "" : `<button class="btn ghost" data-a="eventView">Cancel</button><button class="btn danger" data-a="eventDel">${ee.confirmDel ? "Tap again to delete" : "Delete"}</button>`}</div>`;
}

/* Shops */
function shopAlertsHtml(alerts = wishAlerts()) { return alerts.length ? `<div class="list">${alerts.map(alertRow).join("")}</div>` : `<div class="empty"><span>No wishlist items in your shops right now. Add today's offers below and anything on your wishlist will light up here.</span></div>`; }
function vShops() {
  const now = Date.now(); const byShop = Object.keys(SHOPS).map((s) => ({ s, list: S.shops.filter((o) => o.shop === s) }));
  return `<section class="sec">${backBar("Shops")}
    <div class="grid3">${[["credits", "Credits"], ["gold", "Gold"], ["tokens", "Collector's Tokens"], ["rerolls", "Split Reroll Coins"], ["wild", "Wild Boosters"]].map(([k, l]) => `<label class="f">${l}<input type="number" id="w-${k}" data-bind="wallet.${k}" data-num="1" value="${esc(S.wallet[k])}" inputmode="numeric"></label>`).join("")}</div>
    <p class="muted small">Update these from the game when they change, or share a screenshot of the game's shop or home screen and they fill in. Alerts compare offer prices against them. A screenshot of any shop (your Token Shop too) also checks it for your wishlist.</p>${canReadShots() ? `<div class="row"><label class="btn sm">${ICON.spark} Read from a screenshot<input type="file" accept="image/*" multiple data-shots="1" hidden></label></div>` : ""}</section>
  ${typeof knowShopsHtml === "function" ? knowShopsHtml() : ""}
  ${shopNowHtml()}
  ${shopSeenHtml()}
  ${plannerHtml()}
  ${packHelperHtml()}
  ${finishHtml()}
  ${creditsHtml()}
  <section class="sec"><h2>Wishlist alerts</h2><div id="shop-alerts">${shopAlertsHtml()}</div></section>
  ${bundleRatingsHtml()}
  ${autoShopSection()}
  ${byShop.map(({ s, list }) => `<section class="sec"><h2>${SHOPS[s]}</h2>${list.length ? `<div class="list">${list.map((o) => { const exp = o.expires && dayEnd(o.expires) < now; return `<div class="li"><div class="grow"><div class="t">${esc(o.item)}</div><div class="s">${esc(o.kind)} · ${fmt(o.price)} ${esc(CURR[o.currency] || "")}${o.expires ? ` · ${exp ? "ended" : "until"} ${esc(dateStr(o.expires))}` : ""}</div></div>${exp ? `<span class="pill dim">Ended</span>` : ""}<button class="x" data-a="offerDel" data-id="${esc(o.id)}" aria-label="Remove offer">${ICON.x}</button></div>`; }).join("")}</div>` : `<p class="muted small">No offers added.</p>`}</section>`).join("")}
  <section class="sec"><div class="panel stack"><h3>Add an offer you see in game</h3>
    <div class="grid2"><label class="f">Shop<select id="no-shop">${Object.entries(SHOPS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label class="f">Type<select id="no-kind">${["Card", "Variant", "Card back", "Avatar", "Title", "Emote", "Bundle"].map((x) => `<option>${x}</option>`).join("")}</select></label></div>
    <label class="f">Item<input type="text" id="no-item" list="no-items" placeholder="Name as shown in the shop"><datalist id="no-items">${wishItems().map((w) => `<option value="${esc(w.name)}">`).join("")}</datalist></label>
    <div class="grid3"><label class="f">Price<input type="number" id="no-price" inputmode="decimal" step="any" min="0"></label><label class="f">Currency<select id="no-cur">${Object.entries(CURR).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label class="f">Ends<input type="date" id="no-exp"></label></div>
    <button class="btn snap" data-a="offerAdd">Add offer</button></div></section>`;
}
function promoList() {
  const src = (store.mode === "cloud" ? Object.entries(shared.promos).map(([id, p]) => ({ ...p, id })) : S.localPromos).filter((p) => p && p.code);
  const auto = autoPromos(), have = new Set(auto.map((p) => p.code.toUpperCase()));
  // A code someone added that the daily check also knows: keep the check's details, and their redeemed tick still counts.
  for (const p of src) if (have.has(String(p.code).toUpperCase()) && S.redeemed[p.id]) { S.redeemed["auto:" + String(p.code).toUpperCase()] = true; delete S.redeemed[p.id]; }
  const rank = (p) => (p.status === "active" ? 0 : p.status === "unknown" ? 1 : 2);
  return [...auto, ...src.filter((p) => !have.has(String(p.code).toUpperCase()))].sort((a, b) => rank(a) - rank(b) || (S.redeemed[a.id] ? 1 : 0) - (S.redeemed[b.id] ? 1 : 0) || num(b.added) - num(a.added));
}
const PST = { active: "Active", expired: "Expired", unknown: "Not sure" };
function vPromos() {
  const list = promoList();
  return `<section class="sec">${backBar("Promo codes")}
    <div class="panel row between nowrap"><div class="small"><b>${list.filter((p) => p.status === "active" && !S.redeemed[p.id]).length} active code${list.filter((p) => p.status === "active" && !S.redeemed[p.id]).length === 1 ? "" : "s"} to redeem</b><div class="muted">Copy a code, then redeem it in the official web shop, signed in with your Snap ID. Rewards arrive in your in-game mail.</div></div><a class="btn snap" href="${PROMO_SHOP}" target="_blank" rel="noopener">Web shop</a></div>
    <p class="muted small">${PROMOS.data ? `The list is checked every day${PROMOS.data.updated ? ` (last ${esc(dateStr(String(PROMOS.data.updated).slice(0, 10)))})` : ""} against Dexerto's and Popverse's code pages, so new codes show up and old ones get marked expired on their own.` : "Codes you add are listed here."} ${store.mode === "cloud" ? "Codes you add are shared with everyone using this app; your redeemed ticks are private." : ""}</p>
    ${list.length ? `<div class="list">${list.map((p) => `<div class="li promo ${S.redeemed[p.id] ? "done" : ""}" style="flex-wrap:wrap"><div class="grow" style="min-width:0"><div class="t" style="font-family:ui-monospace,monospace;letter-spacing:.04em">${esc(p.code)}</div><div class="s" style="white-space:normal">${esc(p.reward || "Reward not noted")}${p.expires ? ` · ends ${esc(dateStr(p.expires))}` : ""}${p.status === "expired" && p.expiredOn ? ` · expired by ${esc(dateStr(p.expiredOn))}` : ""}</div></div>
      <span class="pill ${p.status === "active" ? "W" : p.status === "expired" ? "L" : "dim"}">${PST[p.status] || "Not checked"}</span>${p.status !== "expired" ? `<button class="btn sm" data-a="promoCopy" data-v="${esc(p.code)}">${ICON.copy} Copy</button>` : ""}
      <div class="row" style="width:100%;justify-content:space-between"><label class="check small"><input type="checkbox" data-promored="${esc(p.id)}" ${S.redeemed[p.id] ? "checked" : ""}> I redeemed it</label>
      ${p.auto ? `<span class="muted small">${p.checked ? `Checked ${esc(dateStr(p.checked))}` : "Checked daily"}${p.sources.length ? " · " + esc(p.sources.join(", ")) : ""}</span>` : `<select data-promostatus="${esc(p.id)}" aria-label="Status" style="width:auto">${Object.entries(PST).map(([k, v]) => `<option value="${k}" ${p.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>`}
      ${!p.auto && (store.mode !== "cloud" || p.by === store.uid) ? `<button class="btn sm ghost danger" data-a="promoDel" data-id="${esc(p.id)}">Remove</button>` : ""}</div></div>`).join("")}</div>`
      : `<div class="empty"><strong>No codes yet</strong><span>When you spot a code from an official stream, post or newsletter, add it here with what it gives.</span></div>`}
    <details class="panel stack"><summary><b>Add a code that isn't listed</b></summary><div class="stack" style="margin-top:10px"><div class="grid2"><label class="f">Code<input type="text" id="np-code" autocapitalize="characters"></label><label class="f">Status<select id="np-status">${Object.entries(PST).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
    <div class="grid2"><label class="f">What it gives<input type="text" id="np-reward" placeholder="e.g. 300 credits"></label><label class="f">Ends<input type="date" id="np-exp"></label></div><button class="btn snap" data-a="promoAdd">Add code</button></div></details></section>`;
}

/* Custom cards */
const FRAMES = ["Cosmic", "Crimson", "Emerald", "Gold", "Steel", "Prism"];
const cd = { name: "", cost: 3, power: 4, ability: "", frame: 0, editing: null };
function customCardHtml(c, small) {
  const n = String(c.name || "?").trim();
  return `<div class="cc fr-${clamp(num(c.frame), 0, 5)}" ${small ? 'style="width:110px"' : ""}><span class="pip cost">${esc(c.cost)}</span><span class="pip pow">${esc(c.power)}</span><span class="glyph">${esc((n[0] || "?").toUpperCase())}</span><span class="nm">${esc(n || "Untitled")}</span>${c.ability ? `<span class="ab">${esc(c.ability)}</span>` : ""}</div>`;
}
// Cards › Custom cards shows the Custom Cards you've made in the game (y12_looks.js)
function vCustom() { return vGameCustom(); }

/* Profile & account */
function vAccount() {
  const vis = S.me.visibility || "public";
  return `<section class="sec">${backBar("Profile")}
    ${bannerHtml(S.me.banner, S.me.handle)}
    <div class="prof-head">${avatarHtml(S.me.avatar, S.me.handle || "?", store.uid || "me", "lg")}<div class="stack" style="gap:2px;min-width:0"><b>${esc(S.me.handle || "Your in-game name")}</b><span class="muted small">${S.me.country ? flag(S.me.country) + " " + esc(countryName(S.me.country)) : "No country set"}</span></div></div>
    <div class="panel stack"><h3>Profile picture & banner</h3>
      <div class="grid2"><button class="btn snap" data-a="lkOpen" data-v="avatar">Change profile picture</button><button class="btn snap" data-a="lkOpen" data-v="banner">Change banner</button></div>
      ${S.me.avatar || S.me.banner ? `<div class="grid2">${S.me.avatar ? `<button class="btn sm" data-a="lkOpen" data-v="avatar" data-step="edit">${S.me.avatar.border ? "Picture border: " + esc(borderName(S.me.avatar.border) || "none") : "Add a picture border"}</button>` : "<span></span>"}${S.me.banner ? `<button class="btn sm" data-a="lkOpen" data-v="banner" data-step="edit">${S.me.banner.border ? "Banner border: " + esc(borderName(S.me.banner.border) || "none") : "Add a banner border"}</button>` : ""}</div>` : ""}
      ${store.assets ? `<div class="row"><label class="btn sm">Upload a picture<input type="file" accept="image/*" data-upload="avatar" hidden></label><label class="btn sm">Upload a banner<input type="file" accept="image/*" data-upload="banner" hidden></label></div>` : ""}
      <p class="muted small">${showArt() ? "Pick any card and any of its variants, owned or not. Your profile picture uses the character's face from the game, your banner uses the full art without the frame, cost or power, and both can have any Custom Card border." : "Official card art can't be shown here, so cards and variants get a styled tile. Upload your own picture if you'd rather."}</p></div>
    <div class="panel stack">
      <div class="grid2"><label class="f">Your name<input type="text" id="me-name" data-bind="me.name" value="${esc(S.me.name)}" maxlength="40"></label><label class="f">In-game name<input type="text" id="me-handle" data-bind="me.handle" value="${esc(S.me.handle)}" maxlength="40"></label></div>
      <div class="grid2"><label class="f">Marvel Snap user ID<input type="text" id="me-snapid" data-bind="me.snapId" value="${esc(S.me.snapId)}" maxlength="40"></label><label class="f">Country<select id="me-country" data-bind="me.country">${countryOptions(S.me.country)}</select></label></div>
      <div class="grid2"><label class="f">Alliance<input type="text" id="me-alliance" data-bind="me.alliance" value="${esc(S.me.alliance)}" maxlength="40"></label><label class="f">Collection level<input type="number" id="me-cl" data-bind="me.colLevel" data-num="1" value="${esc(S.me.colLevel)}" inputmode="numeric"></label></div>
      <div class="grid2"><label class="f">Current rank<input type="text" id="me-rank" data-bind="me.rank" value="${esc(S.me.rank)}" placeholder="e.g. 72 or Infinite"></label><label class="f">Peak rank this season<input type="text" id="me-peak" data-bind="me.peak" value="${esc(S.me.peak)}"></label></div>
      <label class="f">Featured deck<select id="me-feat" data-bind="me.featuredDeck"><option value="">None</option>${S.decks.map((d) => `<option value="${esc(d.id)}" ${S.me.featuredDeck === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>
      <div class="seg"><button data-a="setVis" data-v="public" aria-pressed="${vis === "public"}">Public</button><button data-a="setVis" data-v="private" aria-pressed="${vis === "private"}">${ICON.lock} Private</button></div>
      <p class="muted small">${vis === "private" ? "Followers need your approval. Approved followers and your alliance see your stats, decks and posts." : "Anyone using the app can see your profile and follow you."}</p>
      <label class="toggle-row check"><span>Share my profile, stats and posts</span><input type="checkbox" data-mechk="share" ${S.me.share ? "checked" : ""}></label>
      ${store.mode === "cloud" ? `<button class="btn" data-a="profileOpen" data-id="${esc(store.uid)}">Preview my profile</button>` : ""}</div></section>
  <section class="sec"><h2>Account</h2><div class="panel stack small">
    ${store.provider === "firebase" ? `<p><b>${accountLine()}</b></p><p>${store.mode === "cloud" ? "Your data follows you to any device where you sign in." : "Sign in to keep your data across devices and use the social features. Anything saved here moves into your account when you sign in."}</p>${store.mode === "cloud" ? `<div><button class="btn sm" data-a="signOut">Sign out</button></div>` : store.fb ? `<div><button class="btn sm snap" data-a="signIn">Sign in</button></div>` : ""}`
      : `<p>${store.mode === "cloud" ? "You're signed in with your Claude account, and your data follows you across devices." : "Your data is saved on this device. Open the app signed in to Claude to keep it across devices and use the social features."}</p>`}
    <p>MARVEL SNAP has no official way for other apps to read your account. To bring in your collection and decks, use SnapVault sync on the Home screen.</p></div></section>
  ${androidPanel()}${sfPanel()}${accountsHtml()}${lookHtml()}${badgesHtml()}${overlayPanel()}${aiPanel()}${appPanel()}${ownerPanel()}
  <section class="sec"><h2>Backup</h2><div class="row"><button class="btn" data-a="csvMatches">Matches spreadsheet</button><button class="btn" data-a="csvCollection">Collection spreadsheet</button></div><div class="row"><button class="btn" data-a="backupCopy">${ICON.copy} Copy backup</button>${store.downloads ? `<button class="btn" data-a="backupSave">Save backup file</button>` : ""}<button class="btn" data-a="restoreOpen">Restore</button><button class="btn" data-a="svOpen">Import from SnapVault</button></div>
    ${allMatches().some((m) => m.example) || S.decks.some((d) => d.example) ? `<button class="btn ghost" data-a="clearExamples">Clear example data</button>` : ""}
    <button class="btn ghost danger" data-a="resetAll">${ui.resetArm ? "Tap again to erase everything" : "Erase all my data"}</button></section>
  ${dangerPanel()}
  <section class="sec"><p class="muted small">${privacyLink()} · <a href="#about">About & legal</a></p></section>`;
}
function privacyLink() { return window.SNAPSTAT_STANDALONE ? `<a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a>` : "Privacy: your data stays in your Claude account"; }
