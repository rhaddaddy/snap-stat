/* ============ y40_social.js: social and alliance (October 31, 2026) ============
   61 alliance chat · 62 who's on which bounty · 63 a weekly cube race with a friend · 64 the Deck lab (shared decks with
   likes and comments, using the posts' own likes and comments) · 65 an opt-in alliance activity board · 66 more
   milestone badges · 67 your most played card as your banner · 68 people to follow who play your decks · 69 live
   scores for tournaments with your alliance · 70 a post that goes out when the season ends.
   Alliance chat and bounty claims live in ally/{allianceKey}/m/{uid} (one document per player: their last 25 messages and
   their bounty claims), races in races/{id}. firestore.rules has both (October 31). */
const y40Sec = (title, body, sub = "") => `<section class="sec"><div class="sec-h"><h2>${esc(title)}</h2>${sub ? `<span class="muted small">${sub}</span>` : ""}</div>${body}</section>`;
const y40AK = () => allyKey(S.me.alliance);
const y40Cloud = () => store.mode === "cloud" && !!store.db && !!store.uid && !SLOT;

/* ---------- 61 + 62. The alliance's shared space: chat messages and bounty claims ---------- */
const ally = { key: "", unsub: null, docs: {}, err: "", busy: false, seenAt: num(lsGet("snapstat.allyChatSeen")) };
function allyListen() {
  const k = y40AK();
  if (!y40Cloud() || !k || !flagOn("allyChat")) { if (ally.unsub) { try { ally.unsub(); } catch { /* fine */ } ally.unsub = null; } ally.key = ""; return; }
  if (ally.key === k && ally.unsub) return;
  if (ally.unsub) { try { ally.unsub(); } catch { /* fine */ } }
  ally.key = k; ally.docs = {}; ally.err = "";
  try { ally.unsub = store.db.collection(`ally/${k}/m`).onSnapshot((qs) => { const o = {}; qs.docs.forEach((d) => { const x = d.data(); if (x && typeof x === "object") o[d.id] = x; }); ally.docs = o; ally.err = ""; if (ui.tab === "social") requestRenderY40(); }, (e) => { ally.err = /permission/i.test(errText(e)) ? "rules" : "net"; if (ui.tab === "social") requestRenderY40(); }); }
  catch (e) { ally.err = "net"; }
}
let _y40R = 0; function requestRenderY40() { clearTimeout(_y40R); _y40R = setTimeout(() => { const a = document.activeElement; if (a && a.dataset && a.dataset.chat) return; render(); }, 200); }
EXT.afterRender.push(function y40AllyListen() { if (ui.tab === "social" || ui.tab === "home") allyListen(); });
const myAllyDoc = () => obj(ally.docs[store.uid]);
async function allyWrite(patch) {
  const cur = myAllyDoc(), next = { uid: store.uid, handle: String(S.me.handle || "Player").slice(0, 40), msgs: arr(cur.msgs).slice(-25), claims: obj(cur.claims), ...patch, at: Date.now() };
  ally.docs[store.uid] = next;
  try { await store.db.doc(`ally/${ally.key}/m/${store.uid}`).set(clone(next)); } catch (e) { toast(/permission/i.test(errText(e)) ? "Alliance chat needs the October 31 security rules in Firebase" : "Couldn't send. Check your connection."); throw e; }
}
function chatMessages() { const out = []; for (const [id, d] of Object.entries(ally.docs)) for (const m of arr(obj(d).msgs)) if (m && m.id && (m.t || m.e)) out.push({ ...m, by: id, handle: String(obj(d).handle || "Player") }); return out.sort((a, b) => num(a.ts) - num(b.ts)).slice(-100); }
const CHAT_EMOTES = ["👍", "🔥", "😂", "GG", "🎉", "💀", "👀", "❤️"];
function chatHtml() {
  if (!flagOn("allyChat")) return y40Sec("Alliance chat", `<p class="muted">Alliance chat isn't switched on yet.</p>`);
  if (store.mode !== "cloud") return y40Sec("Alliance chat", `<div class="empty"><strong>Sign in to chat</strong><span>Alliance chat is for signed-in players who entered the same alliance name.</span></div>`);
  if (!y40AK()) return y40Sec("Alliance chat", `<div class="empty"><strong>Add your alliance first</strong><span>Enter your alliance's name in Profile › Your details. Everyone with the same name shares this chat.</span><div class="row"><button class="btn sm snap" data-a="go" data-to="profile">Open Profile</button></div></div>`);
  allyListen(); const ms = chatMessages(); ally.seenAt = Date.now(); lsSet("snapstat.allyChatSeen", ally.seenAt);
  const day = (ts) => localDate(ts); let lastDay = "";
  return y40Sec(`${esc(S.me.alliance)} chat`, `${ally.err === "rules" ? `<p class="note">Alliance chat needs the October 31 security rules (the app owner pastes them in Firebase).</p>` : ""}
    <div class="y40-chat" data-noswipe>${ms.length ? ms.map((m) => { const d = day(m.ts), sep = d !== lastDay ? `<div class="y40-day">${esc(dayStr(m.ts))}</div>` : ""; lastDay = d; const mine = m.by === store.uid;
      return `${sep}<div class="y40-msg ${mine ? "me" : ""}"><span class="y40-who">${esc(mine ? "You" : m.handle)} · ${esc(new Date(num(m.ts)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}</span>${m.e ? `<span class="y40-emo">${esc(m.e)}</span>` : ""}${m.t ? `<span class="y40-txt">${esc(m.t)}</span>` : ""}${mine ? `<button class="y40-del" data-a="chatDel" data-id="${esc(m.id)}" aria-label="Delete">✕</button>` : isModerator() ? `<button class="y40-del" data-a="chatMod" data-uid="${esc(m.by)}" aria-label="Clear this player's messages">⚑</button>` : ""}</div>`; }).join("")
      : `<div class="empty"><strong>No messages yet</strong><span>Say hi to your alliance. Only players who entered “${esc(S.me.alliance)}” can read this.</span></div>`}</div>
    <div class="chips y40-emos">${CHAT_EMOTES.map((e) => `<button class="chip" data-a="chatEmote" data-v="${esc(e)}">${esc(e)}</button>`).join("")}</div>
    <div class="row nowrap"><input type="text" data-chat="1" maxlength="500" placeholder="Message your alliance" aria-label="Message" style="flex:1;min-width:0"><button class="btn snap" data-a="chatSend">Send</button></div>
    <p class="muted small">Be kind: the <a href="terms.html" target="_blank" rel="noopener">community rules</a> apply. Each player's last 25 messages are kept.</p>`);
}
document.addEventListener("keydown", (e) => { const t = e.target; if (t && t.dataset && t.dataset.chat && e.key === "Enter") { e.preventDefault(); A.chatSend(); } });
EXT.socialSubs.push(["chat", "Alliance chat", chatHtml, () => flagOn("allyChat") && !!y40AK()]);
// A small count of new messages on the Social tab's Alliance chat
EXT.afterRender.push(function y40ChatBadge() { const n = chatMessages().filter((m) => m.by !== store.uid && num(m.ts) > ally.seenAt).length; const b = document.querySelector('.subnav [data-to="social/chat"]'); if (b) b.textContent = n ? `Alliance chat (${n})` : "Alliance chat"; });

// 62. Bounty claims: tap "I'll do it" on a bounty; everyone in the alliance sees who's on what
const bountyKey = (b) => keyOf(String(b.text || "") + "|" + String(b.rarity || "")).slice(0, 60);
EXT.alliance.push(function y40Bounties() {
  const D = obj(S.allianceData), bs = arr(D.bounties).filter((b) => b && b.text && !b.done).slice(0, 12); if (!bs.length || !y40Cloud() || !y40AK()) return "";
  allyListen(); const wk = allyWeek(Date.now()).key;
  const who = (k) => Object.entries(ally.docs).filter(([, d]) => obj(obj(d).claims)[k] === wk).map(([id, d]) => (id === store.uid ? "You" : String(obj(d).handle || "Player")));
  return `<div class="panel stack small"><b>Who's on which bounty</b>${bs.map((b) => { const k = bountyKey(b), w = who(k), mine = obj(myAllyDoc().claims)[k] === wk; return `<div class="row between nowrap"><div style="min-width:0"><div>${esc(b.text)}</div><div class="muted">${w.length ? esc(w.join(", ")) : "Nobody yet"}</div></div><button class="btn sm ${mine ? "snap" : ""}" data-a="bountyClaim" data-k="${esc(k)}" aria-pressed="${mine}">${mine ? "✓ Mine" : "I'll do it"}</button></div>`; }).join("")}
    <span class="muted">Claims reset each alliance week.${ally.err === "rules" ? " Needs the October 31 security rules." : ""}</span></div>`;
});

/* ---------- 63. Weekly cube race with a friend ---------- */
const races = { all: {}, unsub: null, on: false };
function racesListen() { if (!y40Cloud() || races.unsub) return; try { races.unsub = store.db.collection("races").onSnapshot((qs) => { const o = {}; qs.docs.forEach((d) => { const x = d.data(); if (x && arr(x.players).includes(store.uid)) o[d.id] = x; }); races.all = o; if (ui.tab === "home" || ui.tab === "social") requestRenderY40(); }, () => { races.all = {}; }); } catch { /* rules not pasted */ } }
EXT.afterRender.push(function y40Races() { if (y40Cloud()) racesListen(); });
function raceCubes(id, wk) { const p = id === store.uid ? { wk: weekStats() } : prof(id); const w = obj(obj(p).wk); return w.key === wk ? { cubes: num(w.cubes), games: num(w.games) } : { cubes: 0, games: 0 }; }
function racesHtml() {
  if (!y40Cloud()) return ""; const wk = allyWeek(Date.now()).key, list = Object.entries(races.all).filter(([, r]) => r.wk === wk && r.status !== "declined");
  if (!list.length) return "";
  return `<section class="sec"><h2>Cube race this week</h2><div class="list">${list.map(([id, r]) => { const other = arr(r.players).find((x) => x !== store.uid), a = raceCubes(store.uid, wk), b = raceCubes(other, wk), pending = r.status === "sent" && r.by !== store.uid;
    return `<div class="li"><div class="grow"><div class="t">You ${signed(a.cubes)} · ${esc(handleOf(other))} ${signed(b.cubes)}</div><div class="s">${pending ? `${esc(handleOf(r.by))} challenged you: beat their cube total this week` : r.status === "sent" ? "Waiting for them to accept" : a.cubes > b.cubes ? "You're ahead" : a.cubes < b.cubes ? "They're ahead" : "All square"} · ends ${cdSpan(allyWeek(Date.now()).end)}</div></div>${pending ? `<button class="btn sm snap" data-a="raceAccept" data-id="${esc(id)}">Accept</button><button class="btn sm ghost" data-a="raceDecline" data-id="${esc(id)}">No</button>` : ""}</div>`; }).join("")}</div><p class="muted small">Cubes from each player's shared weekly stats (Monday to Monday, UTC).</p></section>`;
}
racesHtml.ext = { id: "races", label: "Cube races", sub: "Weekly cube races with friends" };
EXT.homeTop.push(racesHtml);
EXT.playerSheet = arr(EXT.playerSheet);
EXT.playerSheet.push(function y40RaceBtn(id) { return y40Cloud() && id !== store.uid ? `<button class="btn sm" data-a="raceNew" data-id="${esc(id)}">🏁 Beat my cubes this week</button>` : ""; });

/* ---------- 64. Deck lab: shared decks with likes and comments ---------- */
function labHtml() {
  if (!flagOn("deckLab")) return y40Sec("Deck lab", `<p class="muted">The Deck lab isn't switched on yet.</p>`);
  if (store.mode !== "cloud") return y40Sec("Deck lab", `<div class="empty"><strong>Sign in to see the Deck lab</strong><span>Players share decks here, and you can like them, comment and copy them.</span></div>`);
  const wk = Date.now() - 7 * DAY, posts = allPosts().filter((p) => p.type === "deck" && obj(p.payload).deck);
  const scored = posts.map((p) => ({ p, r: reactionsFor(p.author, p.id) })), sort = ui.labSort || "top";
  const list = (sort === "new" ? scored : [...scored].sort((a, b) => (b.r.likes - b.r.dislikes) - (a.r.likes - a.r.dislikes) || (num(b.p.ts) >= wk) - (num(a.p.ts) >= wk) || num(b.p.ts) - num(a.p.ts))).slice(0, 30);
  return `${y40Sec("Deck lab", `<div class="row between"><div class="chips"><button class="chip" data-a="labSort" data-v="top" aria-pressed="${sort === "top"}">Most liked</button><button class="chip" data-a="labSort" data-v="new" aria-pressed="${sort === "new"}">Newest</button></div><button class="btn sm snap" data-a="labShare">Share a deck</button></div>
    <p class="muted small">Decks players shared. Like the good ones, leave a tip in the comments, or save a copy to your decks.</p>`)}
    <section class="sec">${list.length ? list.map(({ p }) => postHtml(p)).join("") : `<div class="empty"><strong>No decks shared yet</strong><span>Be the first: tap Share a deck.</span></div>`}</section>`;
}
EXT.socialSubs.push(["lab", "Deck lab", labHtml, () => flagOn("deckLab")]);

/* ---------- 65. Alliance activity board (opt-in) ---------- */
const _y40Extras = profileExtras;
profileExtras = () => ({ ..._y40Extras(), allyBoard: !!S.allyBoard }); // eslint-disable-line no-func-assign
EXT.alliance.push(function y40Board() {
  if (!flagOn("allyStats") || store.mode !== "cloud" || !y40AK()) return "";
  const wk = allyWeek(Date.now()).key, rows = [];
  if (S.allyBoard) rows.push({ id: store.uid, h: "You", w: weekStats() });
  for (const [id, p] of Object.entries(shared.profiles)) { if (id === store.uid || !sameAlliance(id)) continue; const v = prof(id) || p; if (!obj(v).allyBoard) continue; const w = obj(obj(v).wk); if (w.key === wk) rows.push({ id, h: handleOf(id), w }); }
  rows.sort((a, b) => num(b.w.games) - num(a.w.games) || num(b.w.cubes) - num(a.w.cubes));
  return `<div class="panel stack small"><div class="row between"><b>Most active this week</b><label class="check"><input type="checkbox" data-y40board="1" ${S.allyBoard ? "checked" : ""}> Show me</label></div>
    ${rows.length ? `<div class="list">${rows.slice(0, 15).map((r, i) => `<div class="li"><span class="num muted">${i + 1}</span><div class="grow"><div class="t">${esc(r.h)}</div><div class="s">${num(r.w.games)} games · ${num(r.w.w)} wins</div></div><b class="num">${signed(num(r.w.cubes))}</b></div>`).join("")}</div>` : `<span class="muted">Nobody's sharing yet. Tick “Show me” to be first: alliance members who use SNAP Stat see your games, wins and cubes this week.</span>`}</div>`;
});
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y40board) return; S.allyBoard = !!t.checked; save(); if (typeof syncProfile === "function") syncProfile(); render(); });

/* ---------- 66. More milestone badges ---------- */
const y40Splits = () => Object.values(obj(S.prog)).reduce((n, p) => n + arr(obj(p).splits).length, 0);
if (typeof BADGES !== "undefined") BADGES.push(
  { id: "splits10", name: "Splitter", d: "Split cards 10 times", v: () => y40Splits(), goal: 10 }, { id: "splits100", name: "Shiny collection", d: "Split cards 100 times", v: () => y40Splits(), goal: 100 },
  { id: "win250", name: "Seasoned", d: "Win 250 matches", v: (x) => x.wins, goal: 250 }, { id: "chat1", name: "Team player", d: "Send a message in alliance chat", v: () => (S.chatSent ? 1 : 0), goal: 1 },
  { id: "lab5", name: "Deck doctor", d: "Share 5 decks in the Deck lab", v: () => (typeof myPostItems === "function" ? myPostItems().filter((p) => p.type === "deck").length : 0), goal: 5 },
);

/* ---------- 67. Your most played card as your banner ---------- */
function topCardRecent() { const cnt = {}; realMatches().filter((m) => m.ts >= Date.now() - 30 * DAY).forEach((m) => { const d = S.decks.find((x) => x.id === m.deckId); if (d) arr(d.cards).forEach((k) => { if (!String(k).startsWith("custom:")) cnt[k] = (cnt[k] || 0) + 1; }); }); return (Object.entries(cnt).sort((a, b) => b[1] - a[1])[0] || [""])[0]; }
let _y40BanDay = "";
EXT.afterRender.push(function y40AutoBanner() {
  if (!S.autoBanner || _y40BanDay === localDate(Date.now())) return; _y40BanDay = localDate(Date.now());
  const k = topCardRecent(); if (!k) return; const cur = obj(S.me.banner); if (cur.kind === "card" && cur.ref === k) return;
  S.me.banner = { kind: "card", ref: k }; save(); if (typeof syncProfile === "function") syncProfile(); setTimeout(render, 0);
});
EXT.profile.push(function y40BannerToggle() { const k = topCardRecent(); return `<section class="sec"><div class="panel stack small"><label class="check"><input type="checkbox" data-y40ban="1" ${S.autoBanner ? "checked" : ""}> Use my most played card's art as my banner</label><span class="muted">${k ? `Right now that's ${esc(card(k).name)}. It changes as you play (checked once a day).` : "Play a few games with a deck and it picks the card you use most."}</span></div></section>`; });
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y40ban) return; S.autoBanner = !!t.checked; _y40BanDay = ""; save(); render(); });

/* ---------- 68. People to follow who play your decks ---------- */
function followSuggest() {
  if (store.mode !== "cloud") return []; const mine = (typeof myTopDecks === "function" ? myTopDecks() : []).map((d) => new Set(arr(d.c))); if (!mine.length) return [];
  const out = [];
  for (const [id, p] of Object.entries(shared.profiles)) {
    if (id === store.uid || S.following.includes(id) || !canSee(id) || (typeof isMuted === "function" && isMuted(id))) continue;
    let best = 0, name = ""; for (const d of arr(obj(prof(id) || p).td)) { const c = arr(d.c); for (const m of mine) { const inter = c.filter((k) => m.has(k)).length, j = inter / Math.max(1, new Set([...c, ...m]).size); if (j > best) { best = j; name = String(d.n || ""); } } }
    if (best >= 0.35) out.push({ id, best, name });
  }
  return out.sort((a, b) => b.best - a.best).slice(0, 5);
}
EXT.socialSubs.push(["suggest", "Who to follow", () => { const l = followSuggest(); return y40Sec("Players who play like you", l.length ? `<div class="list">${l.map((x) => `<div class="li">${avatarHtml(obj(prof(x.id)).avatar, handleOf(x.id), x.id)}<div class="grow"><div class="t">${esc(handleOf(x.id))}</div><div class="s">${Math.round(x.best * 100)}% the same cards as one of your decks${x.name ? ` (their ${esc(x.name)})` : ""}</div></div>${followBtn(x.id)}</div>`).join("")}</div>`
  : `<div class="empty"><strong>No suggestions yet</strong><span>${store.mode !== "cloud" ? "Sign in to see players with decks like yours." : "Play a few games with your decks, and players with similar decks show up here."}</span></div>`); }, () => store.mode === "cloud"]);

/* ---------- 69. Live scores for tournaments with your alliance ---------- */
EXT.alliance.push(function y40Tourneys() {
  if (store.mode !== "cloud" || typeof tourneys !== "object") return "";
  const live = Object.entries(tourneys).filter(([, t]) => t && t.status === "live" && t.kind !== "challenge" && arr(t.players).some((p) => p && (p.uid === store.uid || (p.uid && sameAlliance(p.uid))))); if (!live.length) return "";
  return `<div class="panel stack small"><b>Tournaments, live</b>${live.slice(0, 3).map(([id, t]) => { const ms = arr(t.matches), R = typeof tRoundCount === "function" ? tRoundCount(ms) : 1, open = ms.filter((m) => m.w === null || m.w === undefined), r = open.length ? Math.min(...open.map((m) => m.r)) : R - 1, ps = arr(t.players);
    const rows = ms.filter((m) => m.r === r && m.a !== null && m.b !== null && m.a >= 0 && m.b >= 0).map((m) => { let s = null; try { s = typeof tSuggest === "function" ? tSuggest(t, id, m) : null; } catch { s = null; } const ra = s && s.ra ? `${num(s.ra.w)}-${num(s.ra.l)}` : "0-0"; return `<div class="row between nowrap"><span>${esc((ps[m.a] || {}).handle || "?")} <span class="muted">vs</span> ${esc((ps[m.b] || {}).handle || "?")}</span><span class="num ${m.w !== null && m.w !== undefined ? "pos" : ""}">${m.w !== null && m.w !== undefined ? `${esc((ps[m.w] || {}).handle || "")} won` : ra}</span></div>`; }).join("");
    return `<div class="stack" style="gap:4px"><div class="row between"><b>${esc(t.name)}</b><span class="pill">Round ${r + 1} of ${R}</span></div>${rows || `<span class="muted">Waiting for players</span>`}<button class="btn sm ghost" data-a="tourneyOpen" data-id="${esc(id)}">Open the bracket</button></div>`; }).join("")}<span class="muted">Scores come from the matches each player logs against the other, and update by themselves.</span></div>`;
});

/* ---------- 70. A post that goes out when the season ends ---------- */
function schedPostCheck() {
  const P = obj(S.schedPost); if (!P.sid || store.mode !== "cloud" || typeof addPost !== "function") return;
  const s = seasons().find((x) => x.id === P.sid); if (!s || !Number.isFinite(s.endTs) || Date.now() < s.endTs) return;
  const ms = inPeriod(realMatches(), { from: s.startTs, to: s.endTs }), st = statsFor(ms);
  const text = String(P.text || `My ${s.name} season is done!`).slice(0, 600);
  if (addPost("stats", { stats: { label: s.name, rank: S.me.rank, ...slimStats(st) } }, text, {})) { S.schedPost = { done: P.sid }; save(); toast(`Your ${s.name} recap was posted`); }
}
EXT.afterRender.push(function y40SchedPost() { if (obj(S.schedPost).sid) setTimeout(schedPostCheck, 3000); });
EXT.socialSubs.push(["later", "Post later", () => {
  const cs = currentSeason(), P = obj(S.schedPost);
  if (store.mode !== "cloud") return y40Sec("Post when the season ends", `<div class="empty"><strong>Sign in to post</strong><span>Then your season recap can go out the moment the season ends.</span></div>`);
  if (!cs) return y40Sec("Post when the season ends", `<p class="muted">No season is on right now.</p>`);
  return y40Sec("Post when the season ends", `<div class="panel stack small"><p>Your ${esc(cs.name)} recap (games, wins, cubes, rank) is posted to your feed the first time you open SNAP Stat after the season ends (${esc(dateStr(new Date(cs.endTs).toISOString().slice(0, 10)))}).</p>
    <label class="f">Your words (optional)<textarea data-y40post="1" maxlength="600" rows="3" placeholder="What a season!">${esc(P.sid === cs.id ? P.text || "" : "")}</textarea></label>
    <div class="row">${P.sid === cs.id ? `<span class="pill W">Scheduled</span><button class="btn sm ghost" data-a="schedCancel">Cancel</button>` : `<button class="btn sm snap" data-a="schedSet" data-id="${esc(cs.id)}">Post it when the season ends</button>`}</div>${obj(S.schedPost).done ? `<span class="muted">Last one went out for a past season.</span>` : ""}</div>`);
}, () => store.mode === "cloud"]);
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y40post) return; const P = obj(S.schedPost); if (P.sid) { P.text = t.value.slice(0, 600); S.schedPost = P; clearTimeout(ui.y40pt); ui.y40pt = setTimeout(save, 600); } else ui.y40Draft = t.value; });

/* ---------- Taps ---------- */
Object.assign(A, {
  chatSend: async () => {
    const inp = document.querySelector("[data-chat]"), t = String((inp && inp.value) || "").trim().slice(0, 500); if (!t || !ally.key) return;
    if (!S.me.handle.trim()) { toast("Add your in-game name first"); return; }
    const msgs = [...arr(myAllyDoc().msgs), { id: uid(), t, ts: Date.now() }].slice(-25);
    try { await allyWrite({ msgs }); if (inp) inp.value = ""; if (!S.chatSent) { S.chatSent = 1; save(); } render(); const c = document.querySelector(".y40-chat"); if (c) c.scrollTop = c.scrollHeight; } catch { /* toasted */ }
  },
  chatEmote: async (el) => { if (!ally.key) return; const msgs = [...arr(myAllyDoc().msgs), { id: uid(), e: String(el.dataset.v).slice(0, 8), ts: Date.now() }].slice(-25); try { await allyWrite({ msgs }); render(); } catch { /* toasted */ } },
  chatDel: async (el) => { const msgs = arr(myAllyDoc().msgs).filter((m) => m.id !== el.dataset.id); try { await allyWrite({ msgs }); render(); } catch { /* toasted */ } },
  chatMod: async (el) => { if (!isModerator()) return; if (ui.chatModArm !== el.dataset.uid) { ui.chatModArm = el.dataset.uid; toast("Tap ⚑ again to clear this player's messages"); return; } ui.chatModArm = ""; try { await store.db.doc(`ally/${ally.key}/m/${el.dataset.uid}`).delete(); toast("Cleared"); } catch { toast("Couldn't clear them"); } },
  bountyClaim: async (el) => { if (!ally.key) return; const k = el.dataset.k, wk = allyWeek(Date.now()).key, c = { ...obj(myAllyDoc().claims) }; for (const x of Object.keys(c)) if (c[x] !== wk) delete c[x]; if (c[k] === wk) delete c[k]; else c[k] = wk; try { await allyWrite({ claims: c }); render(); } catch { /* toasted */ } },
  raceNew: async (el) => { const other = el.dataset.id, id = uid(), r = { by: store.uid, players: [store.uid, other], wk: allyWeek(Date.now()).key, kind: "cubes", status: "sent", at: Date.now() }; try { await store.db.doc("races/" + id).set(r); races.all[id] = r; toast(`Race sent to ${handleOf(other)}`); render(); } catch (e) { toast(/permission/i.test(errText(e)) ? "Races need the October 31 security rules in Firebase" : "Couldn't send it"); } },
  raceAccept: async (el) => { const r = races.all[el.dataset.id]; if (!r) return; try { await store.db.doc("races/" + el.dataset.id).set({ ...r, status: "on" }); toast("Race on!"); } catch { toast("Couldn't accept it"); } },
  raceDecline: async (el) => { const r = races.all[el.dataset.id]; if (!r) return; try { await store.db.doc("races/" + el.dataset.id).set({ ...r, status: "declined" }); delete races.all[el.dataset.id]; render(); } catch { toast("Couldn't answer it"); } },
  labSort: (el) => { ui.labSort = el.dataset.v; render(); },
  labShare: () => { if (!S.decks.length) { toast("Build a deck first"); return; } pc.type = "deck"; pc.deckId = S.decks[0].id; pc.text = ""; pc.alliance = false; openSheet(composeSheet); },
  schedSet: (el) => { S.schedPost = { sid: el.dataset.id, text: String(ui.y40Draft || "").slice(0, 600) }; save(); render(); toast("Scheduled"); },
  schedCancel: () => { S.schedPost = {}; save(); render(); },
});
EXT.search.push((q) => (/chat|alliance|bounty|race|deck lab|lab|follow|banner|tournament|schedule|post later/i.test(q) ? [{ label: "Alliance chat", sub: "Social", route: "social/chat" }, { label: "Deck lab", sub: "Social", route: "social/lab" }, { label: "Who to follow", sub: "Social", route: "social/suggest" }] : []));
EXT.styles.push(`
.y40-chat { display: flex; flex-direction: column; gap: 6px; max-height: 55vh; overflow-y: auto; padding: 4px 2px 8px; overscroll-behavior: contain; }
.y40-msg { position: relative; align-self: flex-start; max-width: 85%; background: var(--surface); border: 1px solid var(--line); border-radius: 14px 14px 14px 4px; padding: 6px 30px 7px 10px; display: flex; flex-direction: column; gap: 2px; }
.y40-msg.me { align-self: flex-end; background: color-mix(in srgb, var(--snap-a) 16%, var(--surface)); border-radius: 14px 14px 4px 14px; }
.y40-who { font-size: 11px; color: var(--muted); } .y40-txt { overflow-wrap: anywhere; white-space: pre-wrap; } .y40-emo { font-size: 26px; line-height: 1.1; }
.y40-del { position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; border: 0; background: none; color: var(--muted); cursor: pointer; border-radius: 99px; }
.y40-day { align-self: center; font-size: 11px; color: var(--muted); padding: 2px 8px; } .y40-emos { margin: 6px 0; flex-wrap: wrap; } .y40-emos .chip { min-width: 44px; min-height: 40px; justify-content: center; }`);
