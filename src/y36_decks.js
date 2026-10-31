/* ============ y36_decks.js: deck tools (October 31, 2026) ============
   21 import a deck from a link or any pasted text · 22 a deck health meter · 23 a 10-game swap test · 24 deck folders ·
   25 a timeline of every change · 26 a one-page cheat sheet · 27 starting-hand odds · 28 retire decks you stopped playing ·
   29 a QR code for each deck (y36b_qr.js) · 30 "Build around this card". Deck sheet tabs, plus a line in Cards › Decks. */
const y36Deck = () => (typeof deckEdit === "function" ? deckEdit() : null);
const y36Owned = () => Object.keys(S.owned).filter((k) => S.owned[k]);

/* ---------- 21. Import from a link (marvelsnapzone, snap.fan, Untapped…) or any pasted text ---------- */
// Sites can't be read from here, so this pulls what it can out of the link itself: a deck code in it, or card names in it
function deckFromAnything(text) {
  let t = String(text || "").trim(); if (!t) return { cards: [], why: "Paste a link or a deck code first." };
  let dec = t; try { dec = decodeURIComponent(t); } catch { dec = t; }
  // Values in the link (?deck=…, #deck=…&n=Name) on their own lines, so a code inside a link is found
  const params = {}; for (const m of dec.matchAll(/[?&#]([A-Za-z_]+)=([^&#\s]+)/g)) params[m[1].toLowerCase()] = m[2];
  const found = parseDeckCode(Object.values(params).join("\n") + "\n" + dec + "\n" + t);
  if (found.cards.length >= 6) return { ...found, name: found.name || String(params.n || params.name || "").replace(/\+/g, " ").slice(0, 40), how: "code" };
  // Card names in the link or text: "…/decks/nightcrawler-iron-fist-…", "Odin, Hela, …"
  const words = dec.toLowerCase().replace(/https?:\/\/[^/\s]+/g, " ").replace(/[^a-z0-9\s-]/g, " ");
  const flat = " " + words.replace(/[-_/]+/g, " ").replace(/\s+/g, " ") + " ";
  const hits = allCards().filter((c) => !c.custom && c.name.length > 2).map((c) => ({ c, at: flat.indexOf(" " + c.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/[-\s]+/g, " ").trim() + " ") })).filter((x) => x.at >= 0)
    .sort((a, b) => b.c.name.length - a.c.name.length);
  const used = [], keys = []; for (const h of hits) { const len = h.c.name.length; if (used.some(([a, b]) => h.at < b && h.at + len > a)) continue; used.push([h.at, h.at + len]); keys.push({ k: h.c.key, at: h.at }); }
  const cards = keys.sort((a, b) => a.at - b.at).map((x) => x.k).slice(0, 12);
  if (cards.length >= 6) return { cards, name: "", how: "names", variants: {} };
  const site = /marvelsnapzone/i.test(t) ? "Marvel Snap Zone" : /snap\.fan/i.test(t) ? "snap.fan" : /untapped/i.test(t) ? "Untapped" : "";
  return { cards: [], why: site ? `That ${site} link doesn't have the cards in it. On ${site}, tap “Copy deck code” and paste that here instead.` : "No deck found in that. Paste a deck code (from the game's Copy Deck button) or a deck link." };
}
const imp36 = { text: "", res: null };
function import36Sheet() {
  const r = imp36.res;
  return `${sheetHead("Import a deck", "From a link, a deck code or a list of cards")}
    <label class="f">Paste it here<textarea data-imp36="1" rows="4" placeholder="A Marvel Snap Zone, snap.fan or Untapped link, a deck code, or card names">${esc(imp36.text)}</textarea></label>
    <div class="row"><button class="btn snap" data-a="imp36Read">Find the deck</button>${navigator.clipboard && navigator.clipboard.readText ? `<button class="btn ghost" data-a="imp36Paste">Paste</button>` : ""}</div>
    ${r && r.cards.length ? `<div class="panel stack small"><b>${r.cards.length} card${r.cards.length === 1 ? "" : "s"} found${r.how === "names" ? " from the card names" : ""}</b><div class="chiplist">${r.cards.map((k) => cardChip(k, { size: "xs" })).join("")}</div>
      ${r.cards.length < 12 ? `<span class="muted">Fewer than 12: you can add the rest in the deck.</span>` : ""}<label class="f">Deck name<input type="text" data-imp36name="1" maxlength="40" value="${esc(r.name || "Imported deck")}"></label><button class="btn snap" data-a="imp36Save">Save the deck</button></div>`
      : r ? `<p class="note">${esc(r.why || "No deck found.")}</p>` : ""}`;
}
document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset) return; if (t.dataset.imp36) imp36.text = t.value; if (t.dataset.imp36name && imp36.res) imp36.res.name = t.value; });

/* ---------- 22. Deck health ---------- */
function deckHealth(d) {
  const ks = arr(d.cards), cs = ks.map(card).filter((c) => c && c.cost !== "?" && c.cost !== ""), tips = [], parts = [];
  const avg = cs.length ? cs.reduce((s, c) => s + num(c.cost), 0) / cs.length : 0, cheap = cs.filter((c) => num(c.cost) <= 2).length, big = cs.filter((c) => num(c.cost) >= 6).length;
  let curve = 30; if (ks.length < 12) { curve -= 12; tips.push(`Add ${12 - ks.length} more card${12 - ks.length === 1 ? "" : "s"}.`); }
  if (avg > 3.9) { curve -= 8; tips.push("Lots of expensive cards: add a 1 or 2-cost card so the early turns aren't empty."); } else if (avg && avg < 2.3) { curve -= 4; tips.push("Very cheap deck: make sure it has a strong finish on turns 5 and 6."); }
  if (cheap < 3 && ks.length >= 10) { curve -= 6; tips.push(`Only ${cheap} cards cost 2 or less.`); } if (big > 3) { curve -= 6; tips.push(`${big} six-cost cards is a lot: you can only play one or two.`); }
  parts.push(["Curve", Math.max(0, curve), 30]);
  const cnt = {}; cs.forEach((c) => cardTags(c).forEach((t) => { if (t !== "R" && ARCH_NAMES[t]) cnt[t] = (cnt[t] || 0) + 1; }));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0], plan = top ? top[1] : 0;
  parts.push(["Plan", Math.min(30, plan * 5), 30]); if (plan < 4) tips.push(top ? `Only ${plan} ${ARCH_NAMES[top[0]]} cards: a deck works best with 4 or more cards that help the same plan.` : "The cards don't share a plan yet (Destroy, Discard, Move, Ongoing…).");
  const tech = cs.filter((c) => typeof COUNTER_CARDS !== "undefined" && COUNTER_CARDS.has(keyOf(c.name)));
  parts.push(["Tech", tech.length ? 15 : 5, 15]); if (!tech.length) tips.push("No tech card (like Cosmo, Shang-Chi or Enchantress) to answer the deck you're facing.");
  // Compared with the best known version: the community tier list's closest deck, or your own best version
  let ref = null, refName = "", missing = [];
  try { const rows = typeof tierRows === "function" ? tierRows() : []; let bestO = 0; for (const r of rows) { const o = r.c.filter((k) => ks.includes(k)).length; if (o > bestO && o >= 7 && r.wr >= 50) { bestO = o; ref = r.c; refName = `${r.name} (${r.wr}% wins, community)`; } } } catch { ref = null; }
  if (!ref) { const h = arr(d.history), ms = deckMatches(d); let bw = -1; h.forEach((v, i) => { const from = i === 0 ? 0 : num(v.ts), nx = h[i + 1], l = ms.filter((m) => m.ts >= from && (!nx || m.ts < num(nx.ts))), st = statsFor(l); if (st.games >= 8 && st.wr > bw) { bw = st.wr; ref = arr(v.cards); refName = `your version from ${dayStr(v.ts || d.created)} (${st.wr}% wins)`; } }); }
  if (ref) { missing = ref.filter((k) => !ks.includes(k)); const same = ref.length - missing.length; parts.push(["Like the best version", Math.round((same / Math.max(1, ref.length)) * 25), 25]); if (missing.length && missing.length <= 4) tips.push(`The best version also has ${missing.map((k) => card(k).name).join(", ")}.`); }
  else parts.push(["Like the best version", 15, 25]);
  const score = Math.round(parts.reduce((s, p) => s + p[1], 0) / parts.reduce((s, p) => s + p[2], 0) * 100);
  return { score, parts, tips: tips.slice(0, 4), avg: Math.round(avg * 10) / 10, refName, missing, plan: top ? ARCH_NAMES[top[0]] : "" };
}
EXT.deckTabs.push(["health", "Health", (d) => {
  if (!arr(d.cards).length) return `<div class="empty"><strong>Add some cards first</strong><span>The health check looks at the curve, the plan and the tech cards.</span></div>`;
  const h = deckHealth(d), cls = h.score >= 75 ? "W" : h.score >= 55 ? "warn" : "L";
  return `<div class="stack small"><div class="row nowrap y36-health"><div class="y36-meter" style="--p:${h.score}"><span class="num">${h.score}</span></div><div class="grow"><b>${h.score >= 75 ? "In good shape" : h.score >= 55 ? "Could be better" : "Needs work"}</b><div class="muted">${h.plan ? esc(h.plan) + " · " : ""}average cost ${h.avg}</div></div><span class="pill ${cls}">${h.score}/100</span></div>
    <div class="list">${h.parts.map(([n, v, max]) => `<div class="li"><div class="grow"><div class="t">${esc(n)}</div><div class="bar"><i style="width:${pct(v, max)}%"></i></div></div><span class="num muted">${v}/${max}</span></div>`).join("")}</div>
    ${h.tips.length ? `<span class="eyebrow">To improve it</span><ul class="y36-ul">${h.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="pos">Nothing to fix. Nice deck.</p>`}
    ${h.refName ? `<span class="muted">Compared with ${esc(h.refName)}.</span>` : `<span class="muted">Play 8 games with a version (or share your profile) to compare with the best one.</span>`}</div>`;
}]);

/* ---------- 23. Swap test: 10 games with a swap, against the 10 before ---------- */
function swapState(d) { const t = obj(d.swapTest); if (!t.at) return null; const ms = deckMatches(d).filter((m) => m.ts >= t.at).sort((a, b) => a.ts - b.ts).slice(0, 10); return { ...t, ms, st: statsFor(ms), done: ms.length >= 10 }; }
EXT.deckTabs.push(["swap", "Swap", (d) => {
  const t = swapState(d);
  if (t) {
    const b = obj(t.before), better = t.st.wr - num(b.wr), cpg = t.st.cpg - num(b.cpg);
    return `<div class="stack small"><div class="panel stack"><b>Testing: ${esc(card(t.out).name)} → ${esc(card(t.in).name)}</b><div class="bar"><i style="width:${t.ms.length * 10}%"></i></div><span>${t.ms.length} of 10 games${t.ms.length ? ` · ${t.st.w}-${t.st.l} · ${signed(t.st.cubes)} cubes` : ""}</span>
      <span class="muted">Before the swap: ${num(b.games) ? `${b.w}-${b.l} (${b.wr}%), ${signed(b.cpg)} cubes a game over ${b.games} games` : "no games yet"}.</span></div>
      ${t.done ? `<div class="panel stack"><b class="${better >= 0 && cpg >= 0 ? "pos" : better < 0 && cpg < 0 ? "neg" : ""}">${better >= 5 && cpg >= 0 ? `Keep it: ${better} points more wins` : better <= -5 && cpg <= 0 ? `Swap back: ${-better} points fewer wins` : "About the same"}</b><span class="muted">${signed(Math.round(cpg * 100) / 100)} cubes a game compared with before. Ten games is a small test, so trust a big difference more than a small one.</span>
        <div class="row"><button class="btn sm snap" data-a="swapKeep">Keep the swap</button><button class="btn sm" data-a="swapUndo">Swap back</button></div></div>` : `<div class="row"><button class="btn sm ghost" data-a="swapUndo">Stop and swap back</button><button class="btn sm ghost" data-a="swapKeep">Stop and keep it</button></div>`}</div>`;
  }
  const own = new Set(y36Owned()), pool = allCards().filter((c) => !c.upcoming && !arr(d.cards).includes(c.key) && (!own.size || own.has(c.key))).sort((a, b) => num(a.cost) - num(b.cost) || a.name.localeCompare(b.name));
  if (arr(d.cards).length < 12) return `<div class="empty"><strong>Finish the deck first</strong><span>A swap test needs all 12 cards.</span></div>`;
  return `<div class="stack small"><p>Try one change for 10 games and SNAP Stat compares it with your last 10 games before it.</p>
    <label class="f">Take out<select data-swap36="out">${arr(d.cards).map((k) => `<option value="${esc(k)}" ${ui.swapOut === k ? "selected" : ""}>${esc(card(k).name)} (${esc(card(k).cost)})</option>`).join("")}</select></label>
    <label class="f">Put in<select data-swap36="in"><option value="">Pick a card…</option>${pool.slice(0, 700).map((c) => `<option value="${esc(c.key)}" ${ui.swapIn === c.key ? "selected" : ""}>${esc(c.name)} (${esc(c.cost)})</option>`).join("")}</select></label>
    <button class="btn snap" data-a="swapStart">Start the 10-game test</button><span class="muted">${own.size ? "Only cards you own are listed." : "Tip: import your collection to list only cards you own."}</span></div>`;
}]);
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.swap36) return; if (t.dataset.swap36 === "out") ui.swapOut = t.value; else ui.swapIn = t.value; });

/* ---------- 24. Deck folders (and 28. Retired) ---------- */
const DECK_FOLDERS = ["Ladder", "Conquest", "Fun", "Draft"];
const folderOf = (d) => String(d.folder || "");
function deckFolders() { return [...new Set([...DECK_FOLDERS, ...S.decks.map(folderOf).filter(Boolean)])].filter((f) => f !== "Retired"); }
// Called by vDecks: whether a deck shows with the folder picked. Retired decks only show in Retired.
function deckInFolder(d) { const f = ui.deckFolder || ""; return f ? folderOf(d) === f : folderOf(d) !== "Retired"; }
function deckFolderHtml() {
  const fs = deckFolders(), n = (f) => S.decks.filter((d) => folderOf(d) === f).length, ret = n("Retired");
  return `<div class="row y36-imp"><button class="btn sm ghost" data-a="imp36Open">🔗 Import from a link</button></div><div class="chips y36-folders"><button class="chip" data-a="deckFolder" data-v="" aria-pressed="${!ui.deckFolder}">📁 All folders</button>${fs.map((f) => `<button class="chip" data-a="deckFolder" data-v="${esc(f)}" aria-pressed="${ui.deckFolder === f}">${esc(f)} <span class="muted num">${n(f)}</span></button>`).join("")}${ret ? `<button class="chip" data-a="deckFolder" data-v="Retired" aria-pressed="${ui.deckFolder === "Retired"}">Retired <span class="muted num">${ret}</span></button>` : ""}</div>`;
}
EXT.deckSheet.push(function y36FolderPick(d) {
  const cur = folderOf(d);
  return `<div class="stack small y36-fold"><span class="eyebrow">Folder</span><div class="chips">${["", ...deckFolders(), ...(cur === "Retired" ? ["Retired"] : [])].map((f) => `<button class="chip" data-a="deckFolderSet" data-v="${esc(f)}" aria-pressed="${cur === f}">${f ? esc(f) : "None"}</button>`).join("")}</div><div class="row nowrap"><input type="text" data-y36folder="1" maxlength="24" placeholder="New folder name" aria-label="New folder name" style="flex:1;min-width:0"><button class="btn sm" data-a="deckFolderNew">Add</button></div></div>`;
});
// 28. Decks not played for 30 days move to Retired by themselves (never deleted; pinned and new decks stay)
function autoRetire() {
  if (S.autoRetire === false || !S.decks.length) return 0; const cut = Date.now() - 30 * DAY; let n = 0;
  for (const d of S.decks) {
    if (d.example || folderOf(d) === "Retired" || num(d.created) > cut || (typeof deckPinned === "function" && deckPinned(d)) || num(d.unretiredAt) > cut) continue;
    const last = deckMatches(d).reduce((a, m) => Math.max(a, m.ts), 0); if (!last || last > cut) continue;
    d.prevFolder = folderOf(d); d.folder = "Retired"; d.retiredAt = Date.now(); n++;
  }
  if (n) { save(); toast(`${n} deck${n === 1 ? "" : "s"} you haven't played in 30 days moved to Retired`); }
  return n;
}
EXT.afterRender.push(function y36RetireDaily() { const day = localDate(Date.now()); if (S.retireDay === day || !store.ready) return; S.retireDay = day; setTimeout(() => { if (autoRetire()) render(); else save(); }, 3000); });
EXT.settingsApp.push(() => `<section class="sec"><h2>Decks</h2><div class="panel stack small"><label class="check"><input type="checkbox" data-y36retire="1" ${S.autoRetire === false ? "" : "checked"}> Move decks I haven't played in 30 days to a Retired folder</label><span class="muted">Nothing is deleted. Pinned decks, new decks and example decks always stay put.</span></div></section>`);
document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.y36retire) return; S.autoRetire = !!t.checked; save(); });

/* ---------- 25. Timeline of every change ---------- */
EXT.deckTabs.push(["timeline", "Timeline", (d) => {
  const h = arr(d.history), ms = deckMatches(d);
  if (h.length < 2) return `<div class="empty"><strong>No changes yet</strong><span>Each time you change this deck's cards, the change shows here with the win rate before and after.</span></div>`;
  const per = h.map((v, i) => { const from = i === 0 ? 0 : num(v.ts), nx = h[i + 1]; return statsFor(ms.filter((m) => m.ts >= from && (!nx || m.ts < num(nx.ts)))); });
  return `<ol class="y36-tl">${h.map((v, i) => { if (i === 0) return `<li><b>Built</b> <span class="muted">${esc(dayStr(v.ts || d.created))}</span><div class="small">${per[0].games ? `${per[0].w}-${per[0].l} · ${per[0].wr}%` : "no games"}</div></li>`;
    const prev = h[i - 1], add = arr(v.cards).filter((k) => !arr(prev.cards).includes(k)), rem = arr(prev.cards).filter((k) => !arr(v.cards).includes(k)), a = per[i - 1], b = per[i], diff = a.games && b.games ? b.wr - a.wr : null;
    return `<li><b>${esc(dayStr(v.ts))}</b>${diff !== null ? ` <span class="pill ${diff >= 0 ? "W" : "L"} num">${signed(diff)} pts</span>` : ""}<div class="small">${add.map((k) => `<span class="pos">＋ ${esc(card(k).name)}</span>`).join(" ")} ${rem.map((k) => `<span class="neg">－ ${esc(card(k).name)}</span>`).join(" ")}</div><div class="muted small">Before: ${a.games ? `${a.wr}% (${a.games})` : "no games"} · after: ${b.games ? `${b.wr}% (${b.games})` : "no games yet"}</div></li>`; }).reverse().join("")}</ol>`;
}]);

/* ---------- 26. Cheat sheet ---------- */
function cheatSheet(d) {
  const ms = deckMatches(d), plan = String(d.plan || "").trim(), by = {};
  ms.filter((m) => arr(m.oppCards).length >= 2).forEach((m) => { const a = m.oppArch || archetypeOf(m.oppCards); if (a) (by[a] = by[a] || []).push(m); });
  const arch = Object.entries(by).map(([a, l]) => ({ a, st: statsFor(l) })).filter((x) => x.st.games >= 2).sort((x, y) => x.st.wr - y.st.wr);
  const fear = {}; ms.filter((m) => m.result === "L").forEach((m) => arr(m.oppCards).forEach((n) => (fear[n] = (fear[n] || 0) + 1)));
  const fearTop = Object.entries(fear).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
  const sn = statsFor(ms.filter((m) => m.snapped)), cs = arr(d.cards).map(card).sort((a, b) => num(a.cost) - num(b.cost));
  const keep = cs.filter((c) => num(c.cost) <= 2).slice(0, 3).map((c) => c.name);
  const bring = arch.length && typeof Y16_TECH === "object" ? arr(Y16_TECH[arch[0].a]).filter(([n]) => cardByName(n)).slice(0, 2) : [];
  return { plan, keep, worst: arch.slice(0, 3), best: arch.slice(-2).reverse().filter((x) => x.st.wr >= 50), fearTop, sn, bring, games: ms.length };
}
function cheatText(d) { const c = cheatSheet(d); return [`${d.name}: cheat sheet`, c.plan ? `Plan: ${c.plan}` : "", c.keep.length ? `Keep early: ${c.keep.join(", ")}` : "", c.worst.length ? `Hardest matchups: ${c.worst.map((x) => `${x.a} ${x.st.wr}%`).join(", ")}` : "", c.fearTop.length ? `Watch out for: ${c.fearTop.join(", ")}` : "", c.sn.games ? `Snaps: ${c.sn.wr}% won` : "", "", "Made with SNAP Stat"].filter((x, i, a) => x || (i === a.length - 2)).join("\n"); }
EXT.deckTabs.push(["cheat", "Cheat", (d) => {
  const c = cheatSheet(d);
  return `<div class="stack small y36-cheat"><div class="panel stack"><b>Before the match</b>${c.plan ? `<span>${esc(c.plan).replace(/\n/g, "<br>")}</span>` : `<span class="muted">Write your gameplan in the Plan tab and it shows here.</span>`}${c.keep.length ? `<span><b>Keep early:</b> ${esc(c.keep.join(", "))}</span>` : ""}</div>
    <div class="panel stack"><b>Hardest matchups</b>${c.worst.length ? c.worst.map((x) => `<span>${esc(x.a)}: <b class="${x.st.wr >= 50 ? "pos" : "neg"}">${x.st.wr}%</b> <span class="muted">(${x.st.games} games)</span></span>`).join("") : `<span class="muted">Add opponents' cards to your matches to see these.</span>`}${c.bring.length ? `<span class="muted">Against ${esc(c.worst[0].a)}, think about ${c.bring.map(([n, why]) => `<b>${esc(n)}</b> (${esc(why)})`).join(" or ")}.</span>` : ""}</div>
    ${c.fearTop.length ? `<div class="panel stack"><b>What to fear</b><span>Cards in your losses most often: ${esc(c.fearTop.join(", "))}</span></div>` : ""}
    <div class="panel stack"><b>When to snap</b><span>${c.sn.games >= 3 ? `You won ${c.sn.wr}% of ${c.sn.games} snapped games with this deck.` : "Not enough snapped games yet."} ${c.sn.games >= 3 && c.sn.wr < 50 ? "Snap later, on turn 5 or 6." : c.sn.games >= 3 ? "Your snaps pay off: trust them." : ""}</span></div>
    <button class="btn" data-a="cheatCopy">${ICON.copy} Copy as text</button></div>`;
}]);

/* ---------- 27. Starting-hand odds ---------- */
// MARVEL SNAP: 3 cards to start, one more each turn, so by turn N you've seen 3 + N of the 12 (ignoring draw effects)
const binom = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const oddsAll = (k, seen, deck = 12) => binom(deck - k, seen - k) / binom(deck, seen);
const oddsAny = (k, seen, deck = 12) => 1 - binom(deck - k, seen) / binom(deck, seen);
EXT.deckTabs.push(["odds", "Odds", (d) => {
  const ks = arr(d.cards); if (ks.length < 12) return `<div class="empty"><strong>Finish the deck first</strong><span>The odds need all 12 cards.</span></div>`;
  const pick = arr(obj(S.comboPick)[d.id]).filter((k) => ks.includes(k)).slice(0, 3);
  const cell = (p) => `<td class="n num ${p >= 0.6 ? "pos" : p < 0.3 ? "neg" : ""}">${Math.round(p * 100)}%</td>`;
  return `<div class="stack small"><p>Pick up to 3 key cards. See how likely you are to have them in hand by each turn.</p>
    <div class="chiplist y36-pick">${ks.map((k) => `<button class="chip" data-a="comboPick" data-k="${esc(k)}" aria-pressed="${pick.includes(k)}">${esc(card(k).name)}</button>`).join("")}</div>
    ${pick.length ? `<div class="tbl-wrap"><table><thead><tr><th>By turn</th><th class="n">${pick.length > 1 ? "All of them" : "Have it"}</th>${pick.length > 1 ? `<th class="n">At least one</th>` : ""}</tr></thead><tbody>${[3, 4, 5, 6].map((t) => `<tr><td>Turn ${t} <span class="muted">(${3 + t} cards seen)</span></td>${cell(oddsAll(pick.length, 3 + t))}${pick.length > 1 ? cell(oddsAny(pick.length, 3 + t)) : ""}</tr>`).join("")}</tbody></table></div>
      <span class="muted">Exact odds for a 12-card deck: 3 cards to start and one more each turn. Cards that draw or add cards change it.</span>` : `<span class="muted">Tap the cards your combo needs.</span>`}</div>`;
}]);

/* ---------- 29. QR code for a deck ---------- */
function deckQrSheet() {
  const d = y36Deck(); if (!d) return sheetHead("Deck not found");
  let svg = ""; try { svg = qrSvg(deckLink(d), "M"); } catch (e) { errNote("the QR code", e); }
  return `${sheetHead("Scan to copy this deck", esc(d.name))}<div class="y36-qr">${svg || `<p class="note">Couldn't make the code.</p>`}</div>
    <p class="small">A friend points their phone's camera at it: the link opens SNAP Stat with this deck ready to save, and from there they can copy its code into MARVEL SNAP.</p>
    <div class="grid2"><button class="btn" data-a="qrCopyLink">${ICON.copy} Copy the link</button><button class="btn snap" data-a="close">Done</button></div>`;
}
EXT.deckSheet.push(function y36QrBtn(d) { return arr(d.cards).length ? `<div class="row"><button class="btn sm ghost" data-a="deckQr">▦ QR code</button></div>` : ""; });

/* ---------- 30. Build around this card ---------- */
const KEYWORDS = ["discard", "destroy", "move", "ongoing", "on reveal", "location", "energy", "power", "hand", "deck", "add", "copy", "afflict", "bounce", "return", "merge", "activate", "end of turn", "game start", "turn 6", "cost", "empty", "split", "steal"];
function y36Synergy(a, b) {
  const ta = new Set(cardTags(a)), tb = cardTags(b); let s = tb.filter((t) => ta.has(t) && t !== "R").length * 3 + (ta.has("R") && tb.includes("R") ? 1 : 0);
  const xa = String(a.ability || "").toLowerCase(), xb = String(b.ability || "").toLowerCase(); for (const k of KEYWORDS) if (xa.includes(k) && xb.includes(k)) s += 1;
  if (xb.includes(a.name.toLowerCase()) || xa.includes(b.name.toLowerCase())) s += 6; return s;
}
function buildAroundIdeas(k) {
  const c = card(k), own = new Set(y36Owned()), usingAll = own.size < 30;
  const pool = allCards().filter((x) => x.key !== k && !x.upcoming && !x.custom && x.cost !== "?" && (usingAll || own.has(x.key))).map((x) => ({ x, s: y36Synergy(c, x) }));
  const pickCurve = (list, n) => { const out = [], byCost = [0, 0, 0, 0, 0, 0, 0]; for (const { x } of list) { const cc = clamp(num(x.cost), 0, 6), cap = cc <= 1 ? 3 : cc <= 3 ? 3 : cc <= 5 ? 2 : 1; if (byCost[cc] >= cap) continue; byCost[cc]++; out.push(x.key); if (out.length >= n) break; } return out; };
  const syn = [...pool].sort((a, b) => b.s - a.s || num(a.x.cost) - num(b.x.cost));
  const fill = (keys) => { const set = [k, ...keys]; for (const { x } of syn) { if (set.length >= 12) break; if (!set.includes(x.key)) set.push(x.key); } return set.slice(0, 12); };
  const techs = pool.filter(({ x }) => typeof COUNTER_CARDS !== "undefined" && COUNTER_CARDS.has(keyOf(x.name))).map(({ x }) => x.key).slice(0, 2);
  return { usingAll, ideas: [
    { name: `${c.name}: all in`, why: "The cards that work best with it", cards: fill(syn.slice(0, 11).map((y) => y.x.key)) },
    { name: `${c.name}: smooth curve`, why: "Good partners at every cost, so every turn has a play", cards: fill(pickCurve(syn.filter((y) => y.s > 0), 11)) },
    { name: `${c.name}: with answers`, why: "Its best partners plus tech cards for tough matchups", cards: fill([...techs, ...syn.filter((y) => !techs.includes(y.x.key)).slice(0, 11 - techs.length).map((y) => y.x.key)]) },
  ] };
}
let baKey = "";
function buildAroundSheet() {
  const c = card(baKey); if (!c || !c.name) return sheetHead("Card not found");
  const r = buildAroundIdeas(baKey);
  return `${sheetHead(`Build around ${esc(c.name)}`, r.usingAll ? "Your collection isn't in yet, so these use every card" : "Using only cards you own")}
    ${r.ideas.map((d, i) => `<div class="panel stack small"><div class="row between"><b>${esc(d.name)}</b><span class="muted">avg cost ${avgCost(d.cards)}</span></div><span class="muted">${esc(d.why)}</span><div class="chiplist">${d.cards.map((k) => cardChip(k, { size: "xs" })).join("")}</div><button class="btn sm snap" data-a="baSave" data-i="${i}">Save as a deck</button></div>`).join("")}
    <p class="muted small">Ideas from the cards' abilities and types. Play a few games and tune them.</p>`;
}
EXT.cardSheet.push(function y36BuildBtn(k) { const c = card(k); return c && !c.custom && !c.upcoming ? `<button class="btn sm ghost" data-a="buildAround" data-k="${esc(k)}">🧩 Build around this card</button>` : ""; });

/* ---------- Taps ---------- */
Object.assign(A, {
  imp36Open: () => { imp36.text = ""; imp36.res = null; openSheet(import36Sheet); },
  imp36Paste: async () => { try { imp36.text = await navigator.clipboard.readText(); imp36.res = deckFromAnything(imp36.text); refreshSheet(); } catch { toast("Couldn't read the clipboard. Long-press the box and paste."); } },
  imp36Read: () => { imp36.res = deckFromAnything(imp36.text); refreshSheet(); },
  imp36Save: () => { const r = imp36.res; if (!r || !r.cards.length) return; const d = newDeck(String(r.name || "Imported deck").slice(0, 40), r.cards); closeSheet(); render(); openDeck(d.id); toast("Deck saved"); },
  swapStart: () => {
    const d = y36Deck(); if (!d) return; const out = ui.swapOut && d.cards.includes(ui.swapOut) ? ui.swapOut : d.cards[0], inn = ui.swapIn;
    if (!inn || d.cards.includes(inn)) { toast("Pick a card to put in"); return; }
    const last10 = deckMatches(d).sort((a, b) => b.ts - a.ts).slice(0, 10), b = statsFor(last10);
    d.cards = d.cards.map((k) => (k === out ? inn : k)); d.swapTest = { at: Date.now(), out, in: inn, before: { games: b.games, w: b.w, l: b.l, wr: b.wr, cpg: b.cpg } }; save(); refreshSheet(); toast("Swap made. Play 10 games with it.");
  },
  swapUndo: () => { const d = y36Deck(); const t = d && obj(d.swapTest); if (!d || !t.at) return; d.cards = d.cards.map((k) => (k === t.in ? t.out : k)); delete d.swapTest; save(); refreshSheet(); toast(`${card(t.out).name} is back in`); },
  swapKeep: () => { const d = y36Deck(); if (!d) return; delete d.swapTest; save(); refreshSheet(); toast("Swap kept"); },
  deckFolder: (el) => { ui.deckFolder = el.dataset.v || ""; render(); },
  deckFolderSet: (el) => { const d = y36Deck(); if (!d) return; const v = el.dataset.v || ""; if (folderOf(d) === "Retired" && v !== "Retired") d.unretiredAt = Date.now(); if (v) d.folder = v; else delete d.folder; save(); refreshSheet(); render(); },
  deckFolderNew: () => { const d = y36Deck(); if (!d) return; const el = document.querySelector("[data-y36folder]"), n = String((el && el.value) || "").trim().slice(0, 24); if (!n) { toast("Type a folder name first"); return; } if (n === "Retired") { toast("Pick another name"); return; } d.folder = n; save(); refreshSheet(); render(); toast(`Moved to ${n}`); },
  cheatCopy: () => { const d = y36Deck(); if (d) copyText(cheatText(d), "Cheat sheet copied"); },
  comboPick: (el) => { const d = y36Deck(); if (!d) return; const all = obj(S.comboPick), cur = arr(all[d.id]), k = el.dataset.k; all[d.id] = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].slice(-3); S.comboPick = all; save(); refreshSheet(); },
  deckQr: () => openSheet(deckQrSheet),
  qrCopyLink: () => { const d = y36Deck(); if (d) copyText(deckLink(d), "Link copied"); },
  buildAround: (el) => { baKey = el.dataset.k; openSheet(buildAroundSheet); },
  baSave: (el) => { const r = buildAroundIdeas(baKey), x = r.ideas[num(el.dataset.i)]; if (!x) return; const d = newDeck(x.name.slice(0, 40), x.cards); closeSheet(); render(); openDeck(d.id); toast("Deck saved"); },
});
EXT.search.push((q) => (/import|link|qr|folder|retire|swap|odds|cheat|health|build around/i.test(q) ? [{ label: "Decks: import, folders, health, odds, QR", sub: "Cards › Decks", route: "cards/decks" }] : []));
EXT.styles.push(`
.y36-health { gap: 12px; align-items: center; }
.y36-meter { --p: 0; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; flex: none; background: conic-gradient(var(--snap-a) calc(var(--p) * 1%), var(--surface-2) 0); }
.y36-meter span { width: 50px; height: 50px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; font-weight: 800; font-size: 18px; }
.y36-ul { margin: 0; padding-left: 18px; } .y36-ul li { margin: 3px 0; }
.y36-folders { margin-top: 6px; } .y36-fold { margin-top: 10px; }
.y36-tl { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--line); } .y36-tl li { position: relative; padding: 0 0 12px 12px; display: flex; flex-direction: column; gap: 2px; }
.y36-tl li::before { content: ""; position: absolute; left: -21px; top: 5px; width: 12px; height: 12px; border-radius: 50%; background: var(--snap-a); border: 2px solid var(--bg); }
.y36-cheat .panel { gap: 4px; } .y36-pick .chip { min-height: 40px; }
.y36-qr { background: #fff; border-radius: 14px; padding: 10px; max-width: 320px; margin: 0 auto 10px; } .qr-svg { width: 100%; height: auto; display: block; }`);
