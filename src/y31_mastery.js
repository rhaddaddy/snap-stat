/* ============ Character Mastery for each card, and the second Custom Card ============
   Each card's Mastery level and XP: the game's own numbers when they're known (CharacterMasteryState.json from PC, a
   card's screen, or typed in Cards › Upgrades), otherwise worked out from the variants and Infinity Splits you own.
   Shows the XP to the next level, what that level gives and the quickest ways to get there.
   From level 22 a card has a second Custom Card slot: it's kept in S.looks2 next to the first (S.looks). */
const levelFromXp = (xp) => { let lv = 1; for (let i = 0; i < MASTERY_XP.length; i++) if (xp >= MASTERY_XP[i]) lv = i + 1; return lv; };
function varGain(v) {
  if (/spotlight/i.test(`${v.rarity} ${v.source}`)) return MASTERY_GAIN.Spotlight;
  return MASTERY_GAIN[v.rarity] || MASTERY_GAIN.other;
}
// Your variants of every card, and the ones you don't have, in one pass (the list is long)
function masteryVariants() {
  const own = new Map(), miss = new Map();
  for (const v of allVariants()) { if (!v || !v.card || v.unreleased) continue; const m = v.owned ? own : miss; const l = m.get(v.card) || []; l.push(v); m.set(v.card, l); }
  return { own, miss };
}
function masteryOf(k, mv) {
  const p = obj(obj(S.prog)[k]), vs = (mv || masteryVariants()).own.get(k) || [];
  const est = vs.reduce((s, v) => s + varGain(v), 0) + arr(p.splits).length * MASTERY_GAIN.split;
  const exact = Number.isFinite(p.mx) && p.mx >= 0;
  const known = exact || num(p.ml) > 0;
  let level = Math.max(num(p.ml), levelFromXp(exact ? p.mx : est), S.owned[k] ? 1 : 0);
  level = Math.min(MASTERY_MAX, level);
  const xp = Math.max(exact ? p.mx : est, level ? MASTERY_XP[level - 1] : 0);
  const next = level && level < MASTERY_MAX ? level + 1 : null;
  return { k, level, xp, exact, known, est, next, need: next ? Math.max(0, MASTERY_XP[next - 1] - xp) : 0, reward: next ? masteryReward(next) : "", slot2: level >= MASTERY_SLOT2, variants: vs.length, splits: arr(p.splits).length };
}
// The quickest ways to cover the XP still needed
function masteryWays(k, need, mv) {
  if (need <= 0) return "";
  const miss = ((mv || masteryVariants()).miss.get(k) || []), byGain = {};
  for (const v of miss) { const g = varGain(v); byGain[g] = (byGain[g] || 0) + 1; }
  const splits = Math.ceil(need / MASTERY_GAIN.split);
  const one = Object.keys(byGain).map(Number).filter((g) => g >= need).sort((a, b) => a - b)[0];
  const name = (g) => (g === MASTERY_GAIN.Spotlight ? "Spotlight" : g === MASTERY_GAIN.Ultimate ? "Ultimate" : g === MASTERY_GAIN["Super Rare"] ? "Super Rare" : g === MASTERY_GAIN.Rare ? "Rare" : "other") + " variant";
  return [`${splits} Infinity Split${splits === 1 ? "" : "s"} (${MASTERY_GAIN.split} XP each)`, one ? `1 ${name(one)} (${one} XP; ${byGain[one]} you don't have)` : ""].filter(Boolean).join(", or ");
}
const masteryBar = (m) => { if (!m.next) return 100; const a = MASTERY_XP[m.level - 1], b = MASTERY_XP[m.next - 1]; return clamp(Math.round(((m.xp - a) / Math.max(1, b - a)) * 100), 0, 100); };
const masterySrc = (m) => (m.exact ? "XP from the game's files" : m.known ? "level from the game; XP worked out from your variants and splits" : "worked out from the variants and splits you own (open the PC files for the game's own numbers)");

/* ---------- A card's page ---------- */
EXT.cardSheet.push(function masteryCardHtml(k) {
  const c = card(k); if (!c || c.unknown || c.custom || !S.owned[k]) return "";
  const mv = masteryVariants(), m = masteryOf(k, mv);
  return `<div class="panel stack small mastery"><div class="row between"><b>Mastery</b><span class="pill gold">Level ${m.level}${m.level >= MASTERY_MAX ? " · max" : ""}</span></div>
    <div class="bar" role="img" aria-label="${m.next ? `${m.need} XP to level ${m.next}` : "Highest level"}"><i style="width:${masteryBar(m)}%"></i></div>
    <span>${fmt(m.xp)} XP${m.next ? ` · <b>${fmt(m.need)} XP</b> to level ${m.next}: ${esc(m.reward)}` : " · every level reached"}</span>
    ${m.next ? `<span class="muted small">Quickest: ${esc(masteryWays(k, m.need, mv))}.</span>` : ""}
    ${m.slot2 ? `<span class="small">✓ Second Custom Card slot unlocked</span>` : m.level < MASTERY_SLOT2 ? `<span class="muted small">Second Custom Card slot at level ${MASTERY_SLOT2}: ${fmt(Math.max(0, MASTERY_XP[MASTERY_SLOT2 - 1] - m.xp))} XP to go.</span>` : ""}
    <details><summary class="small">Every level and its reward</summary><div class="list mlevels">${MASTERY_XP.map((x, i) => `<div class="li ${i + 1 <= m.level ? "done" : ""}"><span class="num">${i + 1}</span><div class="grow small">${esc(masteryReward(i + 1))}</div><span class="muted small num">${fmt(x)} XP</span></div>`).join("")}</div></details>
    <span class="muted small">${esc(masterySrc(m))} · ${m.variants} variant${m.variants === 1 ? "" : "s"}, ${m.splits} split${m.splits === 1 ? "" : "s"} counted.</span></div>`;
});
// The second Custom Card on a card's page, under the first
EXT.cardSheet.push(function look2CardHtml(k) {
  const L = obj(obj(S.looks2)[k]), t = typeof lookText === "function" ? lookText(L) : ""; if (!t) return "";
  return `<div class="panel stack small" style="gap:4px"><div class="row between"><b>Custom Card 2</b><button class="btn sm ghost" data-a="leOpen2" data-k="${esc(k)}">Edit</button></div><span>${esc(t)}</span>${L.src && LOOK_SRC[L.src] ? `<span class="muted small">${esc(LOOK_SRC[L.src])}</span>` : ""}</div>`;
});

/* ---------- Cards › Custom cards: every card's Mastery ---------- */
const ms = { all: false };
function masteryListHtml() {
  const mv = masteryVariants(), list = allCards().filter((c) => S.owned[c.key] && !c.unknown && !c.custom).map((c) => masteryOf(c.key, mv));
  if (!list.length) return "";
  const known = list.filter((m) => m.known).length, slot2 = list.filter((m) => m.slot2), max = list.filter((m) => m.level >= MASTERY_MAX).length;
  const avg = list.reduce((s, m) => s + m.level, 0) / list.length;
  const close = list.filter((m) => m.next).sort((a, b) => a.need - b.need || b.level - a.level);
  const row = (m) => `<button class="li" data-a="cardOpen" data-k="${esc(m.k)}"><div class="collart" style="width:52px">${cardChip(m.k, { noOwn: true, size: "xs" })}</div><div class="grow"><div class="t">${esc(card(m.k).name)} <span class="pill ${m.slot2 ? "W" : "dim"}">Lvl ${m.level}</span></div>
    <div class="s">${m.next ? `${fmt(m.need)} XP to ${m.next}: ${esc(m.reward)}` : "Max level"}${m.exact ? "" : " · est."}</div><div class="bar" style="margin-top:4px"><i style="width:${masteryBar(m)}%"></i></div></div></button>`;
  const shown = ms.all ? [...list].sort((a, b) => b.level - a.level || card(a.k).name.localeCompare(card(b.k).name)) : close.slice(0, 12);
  return `<section class="sec"><div class="sec-h"><h2>Mastery</h2><span class="muted small">${known ? `${fmt(known)} from the game` : "worked out"}</span></div>
    <div class="tiles"><div class="tile"><div class="v num">${avg.toFixed(1)}</div><div class="k">average level</div></div><div class="tile"><div class="v num">${fmt(slot2.length)}</div><div class="k">with a 2nd Custom Card slot (lvl ${MASTERY_SLOT2}+)</div></div><div class="tile"><div class="v num">${fmt(max)}</div><div class="k">at level ${MASTERY_MAX}</div></div></div>
    <div class="chips"><button class="chip" data-a="msAll" data-v="" aria-pressed="${!ms.all}">Closest to the next level</button><button class="chip" data-a="msAll" data-v="1" aria-pressed="${ms.all}">Every card (${list.length})</button></div>
    <div class="list">${shown.slice(0, ms.all ? 600 : 12).map(row).join("")}</div>
    ${known ? "" : `<p class="muted small">These are worked out from your variants and splits. For the game's own levels and XP, choose CharacterMasteryState.json in Settings › Import & backup (or connect Playing on PC).</p>`}</section>`;
}
Object.assign(A, {
  msAll: (el) => { ms.all = !!el.dataset.v; render(); },
  leOpen2: (el) => { le.k = el.dataset.k; le.slot = 2; openSheet(leSheet); },
});

/* ---------- The second Custom Card from the game's files and from screenshots ---------- */
function noteLook2(k, look, src) {
  const c = card(k); if (!c || c.unknown || c.custom) return false;
  const L = (S.looks2 = obj(S.looks2)), old = obj(L[k]);
  const n = { v: look.v || "", vname: lookWord(look.vname), border: lookWord(look.border), finish: lookWord(look.finish), flare: lookWord(look.flare) };
  if (!n.v && !LOOK_F.some((f) => n[f])) return false;
  // A look that's the same as Custom Card 1 isn't a second one
  const one = obj(obj(S.looks)[k]); if ((n.v || "") === (one.v || "") && LOOK_F.every((f) => (n[f] || "") === (one[f] || ""))) return false;
  const changed = ["v", ...LOOK_F].some((f) => (n[f] || "") !== (old[f] || ""));
  L[k] = { ...n, at: changed || !old.at ? Date.now() : old.at, src: src || old.src || "" };
  return changed;
}
// Mastery XP in the game's CharacterMasteryState.json, wherever the file keeps it for each card
function readMasteryXp(ss) {
  const out = {}, data = obj(obj(obj(ss).CharacterMasteryProgress).CharacterProgressData);
  for (const [id, d0] of Object.entries(data)) {
    const d = obj(d0), key = Object.keys(d).find((x) => /^(current|total)?(mastery)?(xp|experience|points)$/i.test(x) && Number.isFinite(Number(d[x])));
    const xp = key ? Math.round(Number(d[key])) : NaN; if (GAME_ID.test(id) && Number.isFinite(xp) && xp >= 0 && xp <= 100000) out[id] = xp;
  }
  return Object.keys(out).length ? out : null;
}
EXT.styles.push(`
.mlevels .li { padding: 6px 0; gap: 10px; }
.mlevels .li .num:first-child { width: 22px; text-align: right; color: var(--muted); }
.mlevels .li.done .num:first-child { color: var(--win); }`);
