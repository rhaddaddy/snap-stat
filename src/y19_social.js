/* ============ y19_social.js: social & sharing (October 30, 2026) ============
   A picture of your week, a better deck picture, decks that fit each alliance bounty, whether the alliance is on pace
   for its next milestone, comparing yourself with a friend, feed filters by post type, milestone posts, a friends
   board for the week, private notes on players, your record against a player, and an alliance roll call.
   New hooks (filled by tiny edits in g_social.js): EXT.alliance (panels in Social › Alliance), EXT.playerSheet
   (a player's profile sheet, after the buttons) and EXT.leaders (above the leaderboard). A few shared functions are
   redefined here to improve them: bountyDeckLine (y8_plans.js), rivalLine (n_more.js) and the deckImage action. */
EXT.alliance = arr(EXT.alliance); EXT.playerSheet = arr(EXT.playerSheet); EXT.leaders = arr(EXT.leaders);
EXT.styles.push(`.y19-pic img { width: 100%; border-radius: 12px; border: 1px solid var(--line); display: block; }
.y19-cmp { width: 100%; table-layout: fixed; } .y19-cmp th, .y19-cmp td { padding: 8px 10px; overflow: hidden; text-overflow: ellipsis; }
.y19-cmp th:first-child, .y19-cmp td:first-child { width: 46%; white-space: normal; } .y19-cmp td.best { color: var(--win); font-weight: 800; }
.y19-ms { display: flex; flex-direction: column; gap: 6px; }
.y19-chips { display: flex; flex-wrap: wrap; gap: 6px; }`);

/* ---------- Pictures: one preview sheet for every picture the app makes ---------- */
// A card's art, but only if it arrives quickly (2 s): a slow connection shouldn't hold the picture up
function quickImage(url, ms = 2000) { return url ? Promise.race([loadCorsImage(url), new Promise((r) => setTimeout(() => r(null), ms))]) : Promise.resolve(null); }
// Dark purple background with a halftone dot pattern, like the app
function picBackdrop(g, W, H) {
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#2A1670"); bg.addColorStop(0.55, "#120D3A"); bg.addColorStop(1, "#0A0918"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.05)"; for (let yy = 0; yy < H; yy += 28) for (let xx = (yy / 28) % 2 ? 14 : 0; xx < W; xx += 28) { g.beginPath(); g.arc(xx, yy, 3, 0, 7); g.fill(); }
}
// Draws text no wider than maxW, cutting it with "…" if it has to
function picText(g, text, x, y, maxW) { let t = String(text ?? ""); if (g.measureText(t).width <= maxW) { g.fillText(t, x, y); return; } while (t.length > 1 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1); g.fillText(t + "…", x, y); }
function picFooter(g, W, H) { g.textAlign = "left"; g.fillStyle = "#8E88B8"; g.font = "600 24px system-ui, sans-serif"; g.fillText("Made with SNAP Stat · unofficial fan app", 60, H - 40); }
function canvasBlob(cv) { return new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"); } catch (e) { rej(e); } }); }
// The picture being previewed: what it is, the PNG, and the buttons under it
const pic = { kind: "", title: "", sub: "", file: "", shareTitle: "", url: "", blob: null, busy: false, w: 0, h: 0, extra: "", make: null };
async function makePic(o) {
  if (pic.url) URL.revokeObjectURL(pic.url);
  Object.assign(pic, { url: "", blob: null, busy: true, w: 0, h: 0, extra: "", back: "" }, o);
  openSheet(picSheet);
  let blob = null; try { blob = await pic.make(true); } catch { try { blob = await pic.make(false); } catch { blob = null; } }
  pic.blob = blob; pic.url = blob ? URL.createObjectURL(blob) : ""; pic.busy = false;
  if (sheetFn === picSheet) refreshSheet();
}
function picSheet() {
  return `${sheetHead(esc(pic.title), esc(pic.sub))}
    ${pic.back ? `<button class="btn sm" data-a="dkBack" data-v="">‹ Back to the deck</button>` : ""}
    <div class="y19-pic">${pic.busy ? `<p class="muted">Making the picture…</p>` : pic.url ? `<img src="${pic.url}" alt="${esc(pic.title)}">` : `<p class="note">Couldn't make the picture. Try again in a moment.</p>`}</div>
    <div class="grid2"><button class="btn snap" data-a="picShare" ${pic.blob ? "" : "disabled"}>Share</button><button class="btn" data-a="picSave" ${pic.blob ? "" : "disabled"}>Save picture</button></div>
    ${pic.extra || ""}
    <p class="muted small">Share sends the picture to another app, or saves it to your phone when sharing isn't possible.</p>
    <button class="btn snap block" data-a="close">Done</button>`;
}

/* ---------- 1. Share my week: your week on one 1080 × 1080 card ---------- */
// This week's matches (the alliance week, Monday to Monday UTC, the same week the alliance challenge uses)
function weekPicData() {
  const wk = allyWeek(Date.now()); const ms = realMatches().filter((m) => m.ts >= wk.start && m.ts < wk.end); const s = statsFor(ms);
  const by = {}; ms.forEach((m) => { const k = m.deckName || ""; if (k) (by[k] = by[k] || []).push(m); });
  const deck = Object.entries(by).map(([name, l]) => ({ name, st: statsFor(l) })).sort((a, b) => b.st.w - a.st.w || b.st.wr - a.st.wr || b.st.games - a.st.games)[0] || null;
  const big = [...ms].sort((a, b) => num(b.cubes) - num(a.cubes))[0];
  let run = 0, streak = 0; [...ms].sort((a, b) => a.ts - b.ts).forEach((m) => { if (m.result === "W") { run++; streak = Math.max(streak, run); } else if (m.result === "L") run = 0; });
  const topKey = (() => { const cnt = {}; ms.forEach((m) => { const d = S.decks.find((x) => x.id === m.deckId); if (d) d.cards.forEach((k) => (cnt[k] = (cnt[k] || 0) + 1)); }); return (Object.entries(cnt).sort((a, b) => b[1] - a[1])[0] || [""])[0]; })();
  return { ms, s, deck, big: big && num(big.cubes) > 0 ? big : null, streak, topKey, start: wk.start, end: wk.end, rank: String(S.me.rank || ""), peak: String(S.me.peak || ""), snapsWon: ms.filter((m) => m.snapped && m.result === "W").length };
}
// The alliance week's days, Monday to Sunday (in UTC, so a Monday 00:00 UTC start isn't shown as Sunday in California)
const weekRange = (x) => { const d = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }); return `${d(x.start)} – ${d(x.end - 1)}`; };
async function weekBlob(withArt = true) {
  const x = weekPicData(); const W = 1080, H = 1080;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  picBackdrop(g, W, H);
  // The card you played most this week, as a picture on the right (if its art loads quickly)
  const c = x.topKey ? card(x.topKey) : null; const img = withArt && c && !c.custom && typeof showArt === "function" && showArt() ? await quickImage(variantArt(favVariant(x.topKey)) || c.art) : null;
  if (img) { const s = Math.min(380 / img.width, 500 / img.height), w = img.width * s, h = img.height * s; g.globalAlpha = 0.92; g.drawImage(img, W - 60 - w, 250 + (500 - h) / 2, w, h); g.globalAlpha = 1; }
  g.textAlign = "left"; g.fillStyle = "#FFD23F"; g.font = "italic 800 44px system-ui, sans-serif"; g.fillText("MY WEEK IN MARVEL SNAP", 60, 96);
  g.fillStyle = "#FFFFFF"; g.font = "800 60px system-ui, sans-serif"; picText(g, S.me.handle || "SNAP Stat player", 60, 168, img ? 560 : 960);
  g.fillStyle = "#C9C3EE"; g.font = "600 28px system-ui, sans-serif"; g.fillText(weekRange(x), 60, 212);
  const stat = (k, v, xx, y, color = "#FFFFFF") => { g.fillStyle = "#A39DC9"; g.font = "700 24px system-ui, sans-serif"; g.fillText(k.toUpperCase(), xx, y); g.fillStyle = color; g.font = "800 68px system-ui, sans-serif"; picText(g, v, xx, y + 70, 280); };
  const rec = `${x.s.w}-${x.s.l}${x.s.t ? "-" + x.s.t : ""}`;
  if (x.s.games) {
    stat("Record", rec, 60, 300); stat("Net cubes", signed(x.s.cubes), 360, 300, x.s.cubes >= 0 ? "#8FE3FF" : "#FF5D7B");
    stat("Win rate", `${x.s.wr}%`, 60, 440, "#3DD68C"); stat("Games", fmt(x.s.games), 360, 440);
  } else { g.fillStyle = "#FFFFFF"; g.font = "800 44px system-ui, sans-serif"; g.fillText("No matches logged yet this week", 60, 340); g.fillStyle = "#C9C3EE"; g.font = "600 28px system-ui, sans-serif"; g.fillText("Log a match and it shows up here.", 60, 392); }
  const rows = [x.deck ? ["Best deck", `${x.deck.name} (${x.deck.st.w}-${x.deck.st.l}${x.deck.st.t ? "-" + x.deck.st.t : ""})`] : null, x.rank ? ["Rank", /^inf/i.test(x.rank) ? "Infinite" : x.rank + (x.peak && rankFromStr(x.peak) > rankFromStr(x.rank) ? ` (peak ${x.peak})` : "")] : null,
    x.big ? ["Biggest win", `+${num(x.big.cubes)} cubes${x.big.oppName ? " vs " + x.big.oppName : ""}`] : null, x.streak >= 2 ? ["Longest win streak", String(x.streak)] : null, x.snapsWon ? ["Snapped and won", plural(x.snapsWon, "time")] : null].filter(Boolean).slice(0, 4);
  let y = x.s.games ? 640 : 520; rows.forEach(([k, v]) => { g.fillStyle = "#A39DC9"; g.font = "700 24px system-ui, sans-serif"; g.fillText(k.toUpperCase(), 60, y); g.fillStyle = "#FFFFFF"; g.font = "700 36px system-ui, sans-serif"; picText(g, v, 60, y + 46, 960); y += 92; });
  picFooter(g, W, H);
  pic.w = W; pic.h = H;
  return canvasBlob(cv);
}
// A short panel with this week's record and the share button (Home › Stats and Profile)
function weekShareHtml() {
  const x = weekPicData();
  return `<section class="sec"><div class="panel stack" style="gap:8px"><div class="row between"><div class="stack" style="gap:2px"><b>Share my week</b><span class="muted small">${x.s.games ? `${plural(x.s.games, "game")} since Monday: ${x.s.w}-${x.s.l}${x.s.t ? "-" + x.s.t : ""}, ${signed(x.s.cubes)} cubes${x.deck ? `, best with ${esc(x.deck.name)}` : ""}` : "No matches logged yet this week. The picture still shows your name and rank."}</span></div><button class="btn sm snap" data-a="weekPic">Make the picture</button></div></div></section>`;
}
EXT.homeStats.push(weekShareHtml);
EXT.profile.push(weekShareHtml);

/* ---------- 2. Deck picture: the deck sheet's "Share as a picture", now a 1080 × 1350 card with a preview ---------- */
// A deck's record this season (or all time when no season is known)
function deckSeasonRecord(d) {
  const p = currentSeasonPeriod(); const all = deckMatches(d).filter((m) => !m.example);
  return { label: p ? "This season" : "All time", st: statsFor(p ? inPeriod(all, p) : all) };
}
async function deckPicBlob(d, withArt = true) {
  const keys = [...arr(d.cards)].slice(0, 12).sort((a, b) => num(card(a).cost) - num(card(b).cost) || card(a).name.localeCompare(card(b).name));
  const W = 1080, H = 1350, cols = 3, cw = 316, ch = 196, gap = 16, x0 = 50, top = 262;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  picBackdrop(g, W, H);
  g.textAlign = "left"; g.fillStyle = "#FFD23F"; g.font = "italic 800 60px system-ui, sans-serif"; picText(g, d.name || "My deck", 60, 104, 960);
  const r = deckSeasonRecord(d);
  g.fillStyle = "#C9C3EE"; g.font = "600 28px system-ui, sans-serif"; picText(g, [`${keys.length} cards`, `avg cost ${avgCost(keys)}`, S.me.handle ? `by ${S.me.handle}` : ""].filter(Boolean).join("  ·  "), 60, 158, 960);
  g.fillStyle = "#FFFFFF"; g.font = "700 30px system-ui, sans-serif"; picText(g, r.st.games ? `${r.label}: ${r.st.w}-${r.st.l}${r.st.t ? "-" + r.st.t : ""} · ${r.st.wr}% wins · ${signed(r.st.cubes)} cubes` : `${r.label}: no matches logged with it yet`, 60, 212, 960);
  const art = withArt && typeof showArt === "function" && showArt();
  const imgs = await Promise.all(keys.map((k) => { const c = card(k); return art && !c.custom ? quickImage(variantArt(deckVariant(d, k)) || c.art) : Promise.resolve(null); }));
  const rr = (x, y, w, h, rad) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, rad); else g.rect(x, y, w, h); };
  keys.forEach((k, i) => {
    const c = card(k), x = x0 + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap), img = imgs[i];
    g.save(); rr(x, y, cw, ch, 20); g.clip();
    const h = hue(c.key); const gr = g.createLinearGradient(x, y, x + cw, y + ch); gr.addColorStop(0, `hsl(${h} 70% 46%)`); gr.addColorStop(1, `hsl(${(h + 48) % 360} 65% 16%)`); g.fillStyle = gr; g.fillRect(x, y, cw, ch);
    if (img) { const s = Math.max(cw / img.width, ch / img.height), w = img.width * s, hh = img.height * s; g.drawImage(img, x + (cw - w) / 2, y + Math.min(0, (ch - hh) / 2) * 0.35, w, hh); } // the top of the art shows, where faces usually are
    else { g.fillStyle = "rgba(255,255,255,.22)"; g.font = "italic 800 120px system-ui, sans-serif"; g.textAlign = "center"; g.fillText((c.name[0] || "?").toUpperCase(), x + cw / 2, y + 128); g.textAlign = "left"; }
    const sh = g.createLinearGradient(0, y + ch - 90, 0, y + ch); sh.addColorStop(0, "rgba(10,9,24,0)"); sh.addColorStop(1, "rgba(10,9,24,.92)"); g.fillStyle = sh; g.fillRect(x, y + ch - 90, cw, 90);
    g.fillStyle = "#FFFFFF"; g.font = "700 26px system-ui, sans-serif"; g.textAlign = "left"; picText(g, c.name, x + 16, y + ch - 18, cw - 32);
    // Cost (left) and Power (right) in small circles at the top
    const pill = (txt, cx, color) => { g.fillStyle = color; g.beginPath(); g.arc(cx, y + 30, 22, 0, 7); g.fill(); g.fillStyle = "#FFFFFF"; g.font = "800 24px system-ui, sans-serif"; g.textAlign = "center"; g.fillText(String(txt), cx, y + 39); g.textAlign = "left"; };
    pill(c.cost, x + 30, "#2B6CF6"); pill(c.power, x + cw - 30, "#F0632F");
    g.restore();
  });
  const code = deckCode(d); const lines = code.match(/.{1,74}/g) || [];
  g.fillStyle = "#A39DC9"; g.font = "700 24px system-ui, sans-serif"; g.fillText("DECK CODE", 60, 1142);
  g.fillStyle = "#E6E2FF"; g.font = "500 22px ui-monospace, monospace"; lines.slice(0, 4).forEach((l, i) => g.fillText(l, 60, 1178 + i * 30));
  if (lines.length > 4) { g.fillStyle = "#8E88B8"; g.font = "600 20px system-ui, sans-serif"; g.fillText("(the code goes on; share the deck for the full code)", 60, 1178 + 4 * 30); }
  picFooter(g, W, H);
  pic.w = W; pic.h = H;
  return canvasBlob(cv);
}

Object.assign(A, {
  weekPic: () => makePic({ kind: "week", title: "Your week", sub: `${weekRange(weekPicData())} · a picture to share`, file: `snap-stat-week-${localDate(Date.now())}.png`, shareTitle: "My week in MARVEL SNAP", make: weekBlob,
    extra: store.mode === "cloud" && S.me.handle.trim() ? `<button class="btn block" data-a="weekPost">Post this week's stats to the feed</button>` : "" }),
  weekPost: () => { const x = weekPicData(); if (addPost("stats", { stats: { label: `This week (${weekRange(x)})`, rank: S.me.rank, ...slimStats(x.s) } }, "")) { closeSheet(); toast("Posted your week"); if (ui.tab === "social") render(); } },
  // Replaces the older action: same button in the deck sheet, now with a preview and the season record
  deckImage: () => { const d = deckEdit(); if (!d) return; if (!arr(d.cards).length) { toast("Add some cards first"); return; } makePic({ kind: "deck", title: d.name || "Deck", sub: "A picture of the deck to share", file: (d.name || "deck").replace(/[^\w-]+/g, "-").slice(0, 40) + ".png", shareTitle: d.name || "My deck", make: (art) => deckPicBlob(d, art), back: d.id,
    extra: `<button class="btn block" data-a="picCode" data-id="${esc(d.id)}">${ICON.copy} Copy the deck code</button>` }); },
  picShare: () => { if (pic.blob) shareBlob(pic.blob, pic.file || "snap-stat.png", pic.shareTitle || pic.title); },
  picSave: () => { if (pic.blob) saveBlob(pic.blob, pic.file || "snap-stat.png"); },
  picCode: (el) => { const d = S.decks.find((x) => x.id === el.dataset.id); if (d) copyText(deckCode(d), "Deck code copied. Paste it in the game's deck menu."); },
});

/* ---------- 3. Bounty helper: every deck of yours that fits each alliance bounty ---------- */
// What a bounty asks for, as a count of a deck's cards ("with X in your deck" asks for one card instead).
// Tags come from cardTags (the card list's tags, or the ability text when a card has none); the ability text backs them up.
const BOUNTY_KINDS = [[/discard/, "X", /discard/, "Discard", 3], [/destroy/, "D", /destroy/, "Destroy", 3], [/\bmov(e|es|ed|ing)\b/, "M", /\bmov(e|es|ed|ing)\b/, "Move", 3], [/ongoing/, "O", /ongoing/, "Ongoing", 4], [/on reveal/, "R", /on reveal/, "On Reveal", 5]];
function bountyTest(text) {
  const t = String(text || "").toLowerCase().replace(/^hard\s*:\s*/, ""); let m;
  if ((m = t.match(/with (?:a |an |the )?(.+?) in (?:your|the|a) deck/)) || (m = t.match(/(?:including|featuring) (?:a |an |the )?(.+?)(?:$|[.,!]| in )/))) { const c = fuzzyCard(m[1].trim()); if (c) return { card: c.key, what: c.name }; }
  if ((m = t.match(/(\d+)\s*-?\s*cost/))) { const n = Number(m[1]); return { what: `${n}-Cost cards`, count: (cs) => cs.filter((c) => c.cost !== "?" && num(c.cost) === n).length, need: n <= 1 ? 4 : 3 }; }
  for (const [re, tag, abRe, label, need] of BOUNTY_KINDS) if (re.test(t)) return { what: `${label} cards`, count: (cs) => cs.filter((c) => cardTags(c).includes(tag) || abRe.test(String(c.ability || "").toLowerCase())).length, need };
  const mt = typeof missionTest === "function" ? missionTest(text) : null; // power, energy, cheap cards…
  return mt && !mt.rate ? mt : null;
}
// Win rates of your decks, worked out once per change to your matches
let _y19WrVer = -1, _y19Wr = new Map();
function deckWrCached(d) { if (_y19WrVer !== _mVer) { _y19Wr = new Map(); _y19WrVer = _mVer; } if (!_y19Wr.has(d.id)) _y19Wr.set(d.id, statsFor(deckMatches(d).filter((m) => !m.example))); return _y19Wr.get(d.id); }
function bountyFits(b) {
  const test = bountyTest(b.text); if (!test) return null;
  const pool = S.decks.filter((d) => arr(d.cards).length >= 6), ready = pool.filter((d) => d.status === "active"), decks = ready.length ? ready : pool;
  const rows = decks.map((d) => ({ d, n: test.card ? (d.cards.includes(test.card) ? 1 : 0) : test.count(d.cards.map(card)) }));
  const rank = (a, b2) => b2.n - a.n || num(deckWrCached(b2.d).wr) - num(deckWrCached(a.d).wr);
  return { test, decks, fits: rows.filter((r) => (test.card ? r.n : r.n >= test.need)).sort(rank), close: rows.filter((r) => !test.card && r.n > 0 && r.n < test.need).sort(rank)[0] || null };
}
function bountyFitHtml(b) {
  if (b.goal && num(b.progress) >= b.goal) return "";
  const f = bountyFits(b); if (!f) return null; if (!f.decks.length) return "";
  const link = (d) => `<button class="linkbtn" data-a="deckOpen" data-id="${esc(d.id)}">${esc(d.name)}</button>`;
  if (f.fits.length) return `<span class="small">${f.test.card ? `Decks with ${esc(f.test.what)}: ` : "Decks that fit: "}${f.fits.slice(0, 3).map((r) => link(r.d) + (f.test.card ? "" : ` <span class="muted">(${r.n} ${esc(f.test.what)})</span>`)).join(" · ")}${f.fits.length > 3 ? ` <span class="muted">and ${f.fits.length - 3} more</span>` : ""}</span>`;
  if (f.test.card) return `<span class="small muted">None of your decks has ${esc(f.test.what)} yet${S.owned[f.test.card] ? "" : " (and you don't own it)"}.</span>`;
  return `<span class="small muted">No deck fits yet (it needs ${f.test.need} ${esc(f.test.what)}).${f.close ? ` Closest: ${link(f.close.d)} with ${f.close.n}.` : ""}</span>`;
}
// Improves the one-deck suggestion from y8_plans.js; bounties it can't read still get the old suggestion
const _y19BountyBase = bountyDeckLine;
bountyDeckLine = (b) => { const h = bountyFitHtml(obj(b)); return h === null ? _y19BountyBase(b) : h; };

/* ---------- Social › Alliance panels (the EXT.alliance hook in allianceExtraHtml, y4_more.js) ---------- */
// cx = { V: allianceView() with last week's team points dropped, D: S.allianceData, teamPts, myPts, myNext }
function allyWeekEnd(V) { const now = Date.now(); return num(V.endsAt) > now ? { at: num(V.endsAt), known: true } : { at: allyWeek(now).end, known: false }; }

/* ---------- 4. Alliance week planner: is the alliance on pace for its next milestone? ---------- */
function allyPlanHtml(cx) {
  const V = obj(cx.V), D = obj(cx.D), team = obj(V.team), now = Date.now(), have = num(cx.teamPts), mine = num(cx.myPts);
  if (!team.at && !have) return `<div class="panel stack small" style="gap:6px"><b>Week planner</b><span class="muted">Screenshot your alliance's Bounties tab (it shows the alliance's points) and this shows whether you're on pace for the next milestone, and your share.</span></div>`;
  const tn = obj(team.next), tr = ALLY_TEAM_TRACK.find(([p]) => have < p);
  const next = num(tn.points) > have ? { points: num(tn.points), reward: String(tn.reward || "") } : tr ? { points: tr[0], reward: tr[1] } : null;
  if (!next) return `<div class="panel stack small" style="gap:6px"><b>Week planner</b><span><span class="pill W">All done</span> Your alliance has every milestone this week. Nice work.</span></div>`;
  const end = allyWeekEnd(V), start = end.at - 7 * DAY, asOf = clamp(num(team.at) || now, start, now);
  const left = Math.max(0, next.points - have), daysLeft = Math.max(0, (end.at - now) / DAY), elapsed = (asOf - start) / DAY;
  const rate = elapsed >= 0.5 && have > 0 ? have / elapsed : 0, projected = rate ? Math.round(have + rate * Math.max(0, end.at - asOf) / DAY) : 0;
  const perDay = Math.ceil(left / Math.max(daysLeft, 0.25));
  const members = num(D.count) || arr(V.members).length;
  const verdict = !rate ? `<span class="pill dim">Too early to tell</span> <span class="muted">Check again after a day of play.</span>`
    : projected >= next.points ? `<span class="pill W">On pace</span> At this rate the alliance gets about ${fmt(projected)} points by the reset.`
    : `<span class="pill warn">Behind</span> At this rate it ends near ${fmt(projected)}, about ${fmt(next.points - projected)} short. It needs about ${fmt(perDay)} a day from here.`;
  return `<div class="panel stack small" style="gap:6px"><div class="row between"><b>Week planner</b><span class="muted">${end.known ? "resets" : "the week ends"} in ${cdSpan(end.at)}</span></div>
    <div class="row between nowrap"><span>Next: <b>${fmt(next.points)}</b>${next.reward ? ` · ${esc(next.reward)}` : ""}</span><span class="num">${fmt(left)} to go</span></div>${progBar(have, next.points, `${have} of ${next.points} alliance points`)}
    <span>${verdict}</span>
    <span>${mine ? `Your part so far: <b>${fmt(mine)}</b> points${have ? ` (${pct(mine, have)}% of the alliance's)` : ""}.` : "Your points this week aren't known yet."}${members > 1 && left ? ` Split evenly, that's about ${fmt(Math.ceil(left / members))} more each for ${members} members.` : ""}</span>
    ${team.at ? `<span class="muted">Alliance points from a screenshot ${esc(agoTxt(num(team.at)))}.${end.known ? "" : " The reset time isn't known yet, so this counts to Monday."}</span>` : ""}</div>`;
}

/* ---------- 11. Roll call: who on the members list hasn't been around ---------- */
function rollCallHtml(cx) {
  const V = obj(cx.V), mem = arr(V.members), at = num(V.membersAt), now = Date.now();
  const btn = canReadShots() ? `<div class="row">${shotInput("numbers")}</div>` : "";
  if (!mem.length) return `<div class="panel stack small" style="gap:6px"><b>Roll call</b><span class="muted">Screenshot the alliance's Members tab to see who hasn't played this week.</span>${btn}</div>`;
  const age = Math.max(0, Math.floor((now - at) / DAY)), old = age >= 7;
  // Players who use SNAP Stat count as seen when their app last shared their profile
  const users = new Map(Object.entries(shared.profiles).filter(([, p]) => p && p.handle && allyKey(p.alliance) === allyKey(S.me.alliance)).map(([, p]) => [keyOf(p.handle), p]));
  const lastSeen = (m) => Math.max(num(m.at), num(obj(users.get(keyOf(m.name))).updated));
  const weekStart = allyWeekEnd(V).at - 7 * DAY, thisWeek = at >= weekStart;
  const gone = old ? [] : mem.filter((m) => lastSeen(m) && lastSeen(m) < now - 7 * DAY);
  const quiet = thisWeek ? mem.filter((m) => m.points === 0) : [];
  const names = (l) => l.slice(0, 12).map((m) => esc(m.name)).join(", ") + (l.length > 12 ? ` and ${l.length - 12} more` : "");
  const counted = mem.some((m) => m.points !== null && m.points !== undefined);
  return `<div class="panel stack small" style="gap:6px"><div class="row between"><b>Roll call</b><span class="muted">${plural(mem.length, "member")}</span></div>
    <span class="${old ? "note" : "muted"}">The members list is ${age ? `${plural(age, "day")} old` : "from today"}${old ? ", so it can't tell who's been playing. Screenshot the Members tab to update it." : "."}</span>
    ${quiet.length ? `<span><b>No points yet this week (${quiet.length}):</b> ${names(quiet)}</span>` : thisWeek && counted ? `<span><span class="pill W">Everyone's in</span> Every member on the list has points this week.</span>` : !old ? `<span class="muted">Points on this list are from last week, so they can't show who's playing this week.</span>` : ""}
    ${gone.length ? `<span><b>Not seen for a week (${gone.length}):</b> ${names(gone)}</span>` : ""}
    ${old || !thisWeek ? btn : ""}</div>`;
}
EXT.alliance.push(allyPlanHtml, rollCallHtml);

/* ---------- A player's sheet (the EXT.playerSheet hook in profileSheet, g_social.js): 10. rivalry, 5. compare, 9. note ---------- */
// Your season, week and collection next to theirs. Theirs come from their shared profile, so only when you can see it.
function cmpRows(p) {
  const cur = currentSeasonPeriod(), ms = cur ? inPeriod(realMatches(), cur) : [], me = slimStats(statsFor(ms)), wk = weekStats();
  const ts = obj(obj(p.stats).season), tw = obj(p.wk).key === allyWeek(Date.now()).key ? obj(p.wk) : null;
  const sid = (() => { const cs = currentSeason(); return cs ? "s:" + cs.id : ""; })(), myPeak = Math.max(rankFromStr(S.me.peak), rankFromStr(obj(S.ranks[sid]).peak));
  const rk = (v) => (v ? rankStr(v) : "—");
  return [
    ["Season win %", me.games ? me.wr : null, num(ts.games) ? num(ts.wr) : null, (v) => v + "%"],
    ["Season games", me.games, num(ts.games), fmt],
    ["Season cubes", me.cubes, num(ts.cubes), signed],
    ["Cubes this week", wk.cubes, tw ? num(tw.cubes) : null, signed],
    ["Rank now", rankFromStr(S.me.rank) || null, rankFromStr(p.rank) || null, rk],
    ["Best rank this season", myPeak || null, rankFromStr(p.peak) || null, rk],
    ["Collection Level", num(S.me.colLevel) || null, num(p.colLevel) || null, fmt],
    ["Cards owned", Object.keys(S.owned).length, p.owned !== undefined ? num(p.owned) : null, fmt],
    ["Variants owned", S.variants.filter((v) => v && v.owned).length, p.vars !== undefined ? num(p.vars) : null, fmt],
    ["Achievements", earnedBadges().length, Array.isArray(p.badges) ? p.badges.length : null, fmt],
  ];
}
function compareHtml(id, p) {
  const rows = cmpRows(p), both = rows.filter(([, a, b]) => a !== null && b !== null), ahead = both.filter(([, a, b]) => a > b).length;
  const cell = (v, f, best) => `<td class="n${best ? " best" : ""}">${v === null ? "—" : esc(f(v))}</td>`;
  const myLabel = plainLabel(currentSeasonPeriod()), theirLabel = String(p.seasonLabel || "");
  return `<div class="stack" style="gap:6px"><div class="tbl-wrap"><table class="y19-cmp"><thead><tr><th></th><th class="n me">You</th><th class="n">${esc(String(p.handle || "Them").slice(0, 16))}</th></tr></thead><tbody>
    ${rows.map(([l, a, b, f]) => `<tr><td>${esc(l)}</td>${cell(a, f, a !== null && b !== null && a > b)}${cell(b, f, a !== null && b !== null && b > a)}</tr>`).join("")}</tbody></table></div>
    <span class="muted small">${both.length ? `You're ahead on ${ahead} of ${both.length}. ` : ""}Green is the higher number. Theirs are from their profile, updated when they last opened SNAP Stat${theirLabel && myLabel && theirLabel !== myLabel ? ` (their season numbers are for ${esc(theirLabel)})` : ""}.</span></div>`;
}
EXT.playerSheet.push((id, p, see) => {
  if (!id || id === store.uid || !p) return "";
  const h = String(p.handle || "").trim(), k = keyOf(h); if (!k) return "";
  const r = rivalStats(h), note = String(obj(obj(S.opp)[k]).note || ""), open = ui.y19cmp === id;
  const rec = r && r.ms.length ? `<div class="row between nowrap"><span class="small" style="min-width:0">You vs ${esc(h)}: <b class="num">${r.st.w}-${r.st.l}${r.st.t ? "-" + r.st.t : ""}</b> · <span class="${r.st.cubes >= 0 ? "pos" : "neg"}">${signed(r.st.cubes)} cubes</span> · last ${esc(agoTxt(r.last))}</span><button class="btn sm ghost" data-a="rivalOpen" data-v="${esc(r.name)}">Games</button></div>`
    : `<span class="muted small">No matches against ${esc(h)} logged yet. When you play them, type their name as the opponent and your record shows here.</span>`;
  return `<div class="panel stack" style="gap:8px">${rec}
    ${see ? `<button class="btn sm ${open ? "snap" : ""}" data-a="cmpToggle" data-id="${esc(id)}" aria-pressed="${open}">${open ? "Hide the comparison" : "Compare with me"}</button>${open ? compareHtml(id, p) : ""}` : ""}
    <label class="f">Your private note<textarea id="pnote" data-pnote="${esc(k)}" data-pname="${esc(h.slice(0, 40))}" maxlength="400" placeholder="Only you can see this. It also shows when you log a match against them.">${esc(note)}</textarea></label></div>`;
});

/* ---------- 9. Player notes: saved with your opponent notes (S.opp), so a note on a friend shows when you play them ---------- */
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset || t.dataset.pnote === undefined) return;
  const k = t.dataset.pnote; if (!k) return;
  const o = (S.opp = { ...obj(S.opp) }), v = String(t.value || "").slice(0, 400);
  if (!v.trim()) delete o[k]; else o[k] = { ...obj(o[k]), name: String(obj(o[k]).name || t.dataset.pname || k).slice(0, 40), note: v, at: Date.now() };
  // At most 200 players: the notes changed longest ago go first
  const ks = Object.keys(o); if (ks.length > 200) ks.filter((x) => x !== k).sort((a, b) => num(obj(o[a]).at) - num(obj(o[b]).at)).slice(0, ks.length - 200).forEach((x) => delete o[x]);
  save();
});

/* ---------- 6. Feed filters: what kind of post, next to the existing who-posted chips (hooks in vFeed, g_social.js) ---------- */
const FEED_TYPES = [["any", "All posts"], ["deck", "Decks"], ["result", "Results"], ["stats", "Stats"], ["milestone", "Milestones"]];
function feedTypeOk(p) { const t = ui.feedType || "any"; return t === "any" || (t === "result" ? p.type === "win" || p.type === "loss" : p.type === t); }
function feedTypeChips() { const t = ui.feedType || "any"; return `<div class="chips" role="group" aria-label="Kind of post">${FEED_TYPES.map(([v, l]) => `<button class="chip" data-a="feedType" data-v="${v}" aria-pressed="${t === v}">${l}</button>`).join("")}</div>`; }

/* ---------- 7. Milestone posts: Infinite, a new best rank, a Collection Level in the thousands ---------- */
// The milestones you're at right now: Infinite this season, your best rank ever (by tens, from 30) and your Collection Level (by thousands)
function milestoneNow() {
  const out = [], cs = currentSeason(), r = cs ? obj(S.ranks["s:" + cs.id]) : {};
  const inf = cs ? Math.max(rankFromStr(r.peak), rankFromStr(r.end), S.me.peakSeason === cs.id ? rankFromStr(S.me.peak) : 0) >= 100 : rankFromStr(S.me.rank) >= 100;
  if (inf) out.push({ id: "inf:" + (cs ? cs.id : localDate(Date.now()).slice(0, 7)), kind: "inf", value: 100, season: cs ? String(cs.name || "").slice(0, 40) : "" });
  const best = rankFromStr(peakAllTime()); if (best >= 30 && best < 100) out.push({ id: "peak:" + Math.floor(best / 10) * 10, kind: "peak", value: best });
  const cl = num(S.me.colLevel); if (cl >= 1000 && cl < 100000) out.push({ id: "cl:" + Math.floor(cl / 1000) * 1000, kind: "cl", value: Math.floor(cl / 1000) * 1000 });
  return out;
}
const MS_TEXT = { inf: () => "Reached Infinite in MARVEL SNAP this season!", peak: (m) => `New best rank in MARVEL SNAP: ${m.value}!`, cl: (m) => `Collection Level ${fmt(m.value)} in MARVEL SNAP!` };
const msTitle = (m) => (m.kind === "inf" ? "Reached Infinite" : m.kind === "peak" ? `New best rank: ${num(m.value)}` : m.kind === "cl" ? `Collection Level ${fmt(num(m.value))}` : "A new milestone");
const msLoaded = () => store.ready && (store.mode !== "cloud" || store.stateLoaded);
// The milestones you've just reached. Ones that were already true when this first ran, or that came with data you
// brought in from nothing (a first Collection Level, a first rank), are counted as seen and never shown.
function pendingMilestones() {
  if (!msLoaded()) return [];
  const now = milestoneNow(), cur = { cl: num(S.me.colLevel), peak: rankFromStr(peakAllTime()) };
  const M = obj(S.milestones);
  if (!Array.isArray(M.seen)) { S.milestones = { seen: now.map((m) => m.id).slice(-30), v: cur }; save(); return []; }
  const prev = obj(M.v); let changed = false; const seen = [...M.seen];
  for (const m of now) if (!seen.includes(m.id) && !(m.kind === "cl" ? num(prev.cl) : num(prev.peak))) { seen.push(m.id); changed = true; }
  if (num(prev.cl) !== cur.cl || num(prev.peak) !== cur.peak) changed = true;
  if (changed) { S.milestones = { seen: seen.slice(-30), v: cur }; save(); }
  return now.filter((m) => !seen.includes(m.id));
}
function msMark(id) { const M = obj(S.milestones); S.milestones = { ...M, seen: [...arr(M.seen).filter((x) => x !== id), id].slice(-30) }; save(); }
EXT.homeTop.push(() => {
  const m = pendingMilestones()[0]; if (!m) return "";
  const sub = m.kind === "inf" ? `${m.season ? esc(m.season) + ": the" : "The"} top of the ladder.` : m.kind === "peak" ? "Your highest rank ever." : "A big round number.";
  return `<section class="sec"><div class="panel stack halftone" style="gap:8px"><span class="eyebrow">${ICON.spark} New milestone</span>
    <div class="row nowrap" style="gap:12px">${m.kind === "cl" ? `<span class="pill gold">CL</span>` : rankBadge(m.kind === "inf" ? "Infinite" : String(m.value))}<div class="stack" style="gap:2px;min-width:0"><b style="font-size:18px">${esc(msTitle(m))}</b><span class="small muted">${sub} ${store.mode === "cloud" ? "Share it posts it to the feed." : "Share it copies a message you can paste anywhere."}</span></div></div>
    <div class="row"><button class="btn snap sm" data-a="msShare" data-id="${esc(m.id)}">Share it</button><button class="btn sm ghost" data-a="msDismiss" data-id="${esc(m.id)}">Not now</button></div></div></section>`;
});
// How a milestone post looks in the feed (the hook in postHtml, g_social.js). Built from the kind and number, not the poster's words.
function milestoneAttHtml(pa) {
  const m = obj(obj(pa).milestone), k = ["inf", "peak", "cl"].includes(m.kind) ? m.kind : "";
  const badge = k === "inf" ? rankBadge("Infinite") : k === "peak" ? rankBadge(String(clamp(Math.round(num(m.value)), 1, 100))) : `<span class="pill gold">${k === "cl" ? "CL" : "★"}</span>`;
  return `<div class="att"><div class="row nowrap" style="gap:12px">${badge}<div class="stack" style="gap:2px;min-width:0"><b>${esc(msTitle({ kind: k, value: k === "peak" ? clamp(Math.round(num(m.value)), 1, 100) : Math.round(num(m.value)) }))}</b>${m.season ? `<span class="muted small">${esc(String(m.season).slice(0, 40))}</span>` : ""}</div></div></div>`;
}
POST_LABEL.milestone = "Milestone";

/* ---------- 8. Friends leaderboard: you and who you follow, this week (above Social › Leaders) ---------- */
function friendsBoardHtml() {
  const wk = allyWeek(Date.now()).key, cur = currentSeasonPeriod(), sort = ui.fbSort === "wr" ? "wr" : "week";
  const rows = [...new Set(arr(S.following))].filter((id) => id !== store.uid && followState(id) === "following" && canSee(id) && obj(shared.profiles[id]).handle && !isMuted(id))
    .map((id) => { const p = shared.profiles[id]; return { id, p, w: obj(p.wk).key === wk ? obj(p.wk) : null, s: obj(obj(p.stats).season) }; });
  const hd = `<div class="sec-h"><h2>Friends this week</h2><span class="muted small">resets in ${cdSpan(allyWeek(Date.now()).end)}</span></div>`;
  if (!rows.length) return `<section class="sec">${hd}<div class="empty"><strong>Follow a few players</strong><span>Follow friends in People and you'll race them here every week, by cubes and by win rate.</span><button class="btn snap" data-a="go" data-to="social/people">Find players</button></div></section>`;
  rows.push({ id: store.uid, me: true, p: { handle: S.me.handle || "You", avatar: S.me.avatar }, w: weekStats(), s: slimStats(statsFor(cur ? inPeriod(realMatches(), cur) : [])) });
  const val = (r) => (sort === "wr" ? (num(r.s.games) >= 5 ? num(r.s.wr) : -1) : r.w ? num(r.w.cubes) : -1e9);
  rows.sort((a, b) => val(b) - val(a) || num(obj(b.w).games) - num(obj(a.w).games));
  const ch = (v, l) => `<button class="chip" data-a="fbSort" data-v="${v}" aria-pressed="${sort === v}">${l}</button>`;
  const big = (r) => (sort === "wr" ? (num(r.s.games) >= 5 ? num(r.s.wr) + "%" : "—") : r.w ? signed(num(r.w.cubes)) : "—");
  return `<section class="sec">${hd}<div class="chips">${ch("week", "Cubes this week")}${ch("wr", "Season win %")}</div>
    <div class="list">${rows.map((r, i) => `<div class="li"><span class="num" style="width:22px;font-weight:800">${i + 1}</span>${avatarHtml(r.p.avatar, r.p.handle, r.id)}<button class="grow" ${r.me ? "" : `data-a="profileOpen" data-id="${esc(r.id)}"`} style="background:none;border:0;text-align:left;padding:0;min-width:0;color:inherit"><div class="t">${esc(r.p.handle)}${r.me ? ` <span class="muted small">you</span>` : ""}</div><div class="s">${r.w ? `${plural(num(r.w.games), "game")}, ${num(r.w.w)} won` : "No games yet"} · ${num(r.s.games) >= 5 ? `${num(r.s.wr)}% season` : "new this season"}</div></button><span class="num ${sort === "week" && r.w ? (num(r.w.cubes) >= 0 ? "pos" : "neg") : ""}" style="font-weight:800;font-size:17px">${big(r)}</span></div>`).join("")}</div>
    <p class="muted small">This week runs Monday to Monday (UTC), like the alliance challenge. Friends' numbers update when they open SNAP Stat.</p></section>`;
}
const _y19Leaders = vLeaderboard;
vLeaderboard = () => friendsBoardHtml() + _y19Leaders();

/* ---------- Your shared profile also says how many variants you own (for Compare) ---------- */
const _y19Extras = profileExtras;
profileExtras = () => ({ ..._y19Extras(), vars: S.variants.filter((v) => v && v.owned).length });

Object.assign(A, {
  feedType: (el) => { ui.feedType = el.dataset.v; render(); },
  fbSort: (el) => { ui.fbSort = el.dataset.v; render(); },
  cmpToggle: (el) => { ui.y19cmp = ui.y19cmp === el.dataset.id ? "" : el.dataset.id; refreshSheet(); },
  msDismiss: (el) => { msMark(el.dataset.id); render(); },
  msShare: (el) => {
    const m = milestoneNow().find((x) => x.id === el.dataset.id); if (!m) { msMark(el.dataset.id); render(); return; }
    const text = MS_TEXT[m.kind](m);
    if (store.mode !== "cloud") { copyText(text, "Copied. Paste it anywhere you like."); msMark(m.id); render(); return; }
    if (addPost("milestone", { milestone: { kind: m.kind, value: m.value, season: m.season || "" } }, text)) { msMark(m.id); render(); toast("Posted to the feed"); }
  },
});
