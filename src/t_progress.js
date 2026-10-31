/* ============ Card progress: boosters, upgrades, Infinity Splits, finishes, flares, borders, Split Reroll Coins ============
   Boosters belong to the character. Each copy you own (the base card, each variant, each split) has its own upgrade level.
   Every change goes in a log, so you can see boosters gained and spent, and what each upgrade or split gave you. */
const UP_LEVELS = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Ultra", "Infinity"];
// What the step INTO each rarity costs: [credits, boosters, Collection Levels]
const STEP = [null, [25, 5, 1], [100, 10, 2], [200, 20, 4], [300, 30, 6], [400, 40, 8], [500, 50, 10]];
// The game's current Infinity Split effects (Marvel Snap Zone, 2026). Older names stay valid for splits logged before.
const SPLIT_FINISHES = ["Foil", "Prism", "Pink Rays", "Black and White Rays", "Red Rays", "Blue Rays", "Green Rays", "Orange Rays", "Bananas", "Copper Metallic", "Water", "Galactic Storm", "Refraction", "Gold Metallic", "Foil Metallic", "Fire", "Ink", "Gold", "Frosted Glass", "Psychedelic", "Glass Circuits", "Cosmic", "Steel Metallic", "Gilded Prism", "Gold Prism", "Black Prism", "Wakandan Glass"];
const SPLIT_FLARES = [...["Green", "Blue", "Red", "Purple", "White", "Gold", "Black", "Rainbow"].flatMap((c) => [`${c} Tone`, `${c} Stardust`, `${c} Glimmer`]), "Green Embers", "Blue Embers", "Fire Embers", "Cosmic", "Bananas", "Rainbow Confetti", "Neon Trails", "Bubbles", "Snowflakes", "Galactic Storm", ...["Red", "Blue", "Purple", "White", "Green", "Gold", "Rainbow", "Black"].map((c) => `${c} Krackle`), "Purple Wakandan Tech", "Gold Wakandan Tech", "Gold Diamond Flare"];
const BORDERS = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Ultra", "Infinity"];
// Every Custom Card border once the border list has loaded, the upgrade-level ones until then.
const borderNames = () => (typeof BDL !== "undefined" && BDL ? [...new Set(BDL.list.map((b) => b.name || b.id))] : BORDERS);

function prog(k) {
  S.prog = obj(S.prog);
  let p = S.prog[k];
  if (!p) {
    p = S.prog[k] = { b: null, ml: null, base: null, vr: {}, splits: [], borders: [], custom: null };
    // Splits counted before this page existed
    const old = obj(obj(S.splits)[k]), n = num(old.n), fins = arr(old.f);
    for (let i = 0; i < Math.max(n, fins.length); i++) p.splits.push({ id: uid(), fin: String(fins[i] || ""), fl: "", r: null, at: 0 });
  }
  p.vr = obj(p.vr); p.splits = arr(p.splits); p.borders = arr(p.borders);
  return p;
}
const hasProg = (k) => !!(S.prog && S.prog[k]);
function progLogAdd(e) { const l = arr(S.progLog); l.push({ t: Date.now(), ...e, ...(typeof progTag !== "undefined" && progTag ? { tag: progTag } : {}) }); S.progLog = l.slice(-600); }
// Keep the old split counter in step, for the parts of the app that read it
function syncSplitCount(k) { const p = prog(k); S.splits = obj(S.splits); S.splits[k] = { n: p.splits.length, f: p.splits.map((s) => s.fin).filter(Boolean) }; }
const rarityIdx = (v) => { if (v === null || v === undefined || v === "") return null; const i = typeof v === "number" ? v : UP_LEVELS.findIndex((r) => keyOf(r) === keyOf(v)); return i >= 0 && i < UP_LEVELS.length ? i : null; };
const nextStep = (r) => (r === null || r >= 6 ? null : STEP[r + 1]);

/* Copies you own: the base card, owned variants and splits, each with its upgrade level */
function progCopies(k) {
  const p = prog(k), out = [{ id: "base", label: "Base card", r: p.base }];
  allVariants().filter((v) => v.card === k && v.owned).forEach((v) => out.push({ id: "v:" + v.id, label: v.name || "Variant", r: rarityIdx(p.vr[v.id]) }));
  p.splits.forEach((s, i) => out.push({ id: "s:" + s.id, label: `Split ${i + 1}${s.fin || s.fl ? ` · ${[s.fin, s.fl].filter(Boolean).join(" + ")}` : ""}`, r: rarityIdx(s.r) }));
  return out;
}
function setCopyRarity(k, id, r) {
  const p = prog(k);
  if (id === "base") p.base = r;
  else if (id.startsWith("v:")) p.vr[id.slice(2)] = r;
  else if (id.startsWith("s:")) { const s = p.splits.find((x) => x.id === id.slice(2)); if (s) s.r = r; }
}
function copyRarity(k, id) { return (progCopies(k).find((c) => c.id === id) || {}).r ?? null; }

/* Upgrade one copy a step: spends the card's boosters and your credits, and adds Collection Level */
function upgradeCopy(k, id) {
  if (!S.owned[k]) return "Tick Owned first: only cards you have can be upgraded.";
  const p = prog(k), from = copyRarity(k, id) ?? 0, step = nextStep(from); if (!step) return "That copy is already Infinity.";
  const [cr, bo, cl] = step;
  if (p.b !== null && num(p.b) < bo) return `It needs ${bo} boosters and this card has ${num(p.b)}.`;
  if (num(S.wallet.credits) && num(S.wallet.credits) < cr) return `It needs ${fmt(cr)} credits and you have ${fmt(num(S.wallet.credits))}.`;
  if (p.b !== null) p.b = num(p.b) - bo;
  if (num(S.wallet.credits)) S.wallet.credits = num(S.wallet.credits) - cr;
  if (num(S.me.colLevel)) S.me.colLevel = num(S.me.colLevel) + cl;
  setCopyRarity(k, id, from + 1);
  progLogAdd({ k, a: "upgrade", copy: copyLabel(k, id), from: UP_LEVELS[from], to: UP_LEVELS[from + 1], n: -bo, cr: -cr, cl });
  save(); return "";
}
function copyLabel(k, id) { return (progCopies(k).find((c) => c.id === id) || {}).label || "Base card"; }

// When you haven't noted a card's boosters yet, a gain is logged but the count stays unknown (5 gained isn't 5 owned)
function addBoosters(k, n, why, extra = {}) {
  if (!n) return; const p = prog(k);
  const applied = p.b !== null;
  if (applied) p.b = Math.max(0, num(p.b) + n);
  progLogAdd({ k, a: "boost", n, why, applied, ...extra });
}
function setBoosters(k, v, why) {
  const p = prog(k), was = p.b === null ? null : num(p.b), now = Math.max(0, Math.round(num(v)));
  p.b = now;
  if (was !== null && now !== was) progLogAdd({ k, a: "boost", n: now - was, why });
  else if (was === null) progLogAdd({ k, a: "set", n: now, why });
}

/* A new Infinity Split: the new copy starts at Common. A reroll can be free (Mastery 10+) or cost a Split Reroll Coin. */
function addSplit(k, fin, fl, reroll) {
  const p = prog(k), s = { id: uid(), fin: String(fin || "").slice(0, 40), fl: String(fl || "").slice(0, 40), r: 0, at: Date.now(), reroll: reroll || "" };
  p.splits.push(s);
  if (reroll === "coin" && num(S.wallet.rerolls) > 0) { S.wallet.rerolls = num(S.wallet.rerolls) - 1; s.coinTaken = true; }
  progLogAdd({ k, a: "split", fin: s.fin, fl: s.fl, reroll: reroll || "" });
  syncSplitCount(k); save(); return s;
}

const fmtRarity = (r) => (r === null || r === undefined ? "?" : UP_LEVELS[r]);
const rarityPill = (r) => `<span class="pill ${r === 6 ? "W" : r >= 4 ? "warn" : "dim"}">${esc(fmtRarity(r))}</span>`;
const logLine = (e) => {
  const c = esc(card(e.k).name), when = esc(ago(e.t));
  if (e.a === "boost") return `${num(e.n) >= 0 ? "+" : ""}${num(e.n)} boosters for ${c}${e.why ? ` · ${esc(e.why)}` : ""} · ${when}`;
  if (e.a === "set") return `${c}: ${num(e.n)} boosters${e.why ? ` · ${esc(e.why)}` : ""} · ${when}`;
  if (e.a === "upgrade") return `${c} ${esc(e.copy || "")}: ${esc(e.from)} → ${esc(e.to)} (${num(e.n)} boosters, ${fmt(num(e.cr))} credits, +${num(e.cl)} CL) · ${when}`;
  if (e.a === "split") return `${c} split: ${esc([e.fin, e.fl].filter(Boolean).join(" + ") || "effect not noted")}${e.reroll === "coin" ? " · used a Split Reroll Coin" : e.reroll === "free" ? " · free reroll" : ""} · ${when}`;
  if (e.a === "border") return `${c}: got the ${esc(e.border)} border · ${when}`;
  if (e.a === "mastery") return `${c}: Mastery level ${num(e.n)} · ${when}`;
  if (e.a === "wild") return `${num(e.n) >= 0 ? "+" : ""}${num(e.n)} Wild Boosters${e.why ? ` · ${esc(e.why)}` : ""} · ${when}`;
  return `${c} · ${when}`;
};

/* ---- The card sheet section ---- */
function progHtml(k) {
  const c = card(k); if (c.custom) return "";
  const p = prog(k), copies = progCopies(k), b = p.b;
  const copyRow = (cp) => {
    const st = nextStep(cp.r ?? 0), can = st && (b === null || num(b) >= st[1]);
    return `<div class="li" style="gap:8px"><div class="grow" style="min-width:0"><div class="t small">${esc(cp.label)}</div>
      <select data-progr="${esc(cp.id)}" data-k="${esc(k)}" aria-label="Upgrade level of ${esc(cp.label)}" style="width:auto;margin-top:4px"><option value="">Level?</option>${UP_LEVELS.map((r, i) => `<option value="${i}" ${cp.r === i ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      ${st ? `<button class="btn sm ${can ? "snap" : ""}" data-a="progUp" data-k="${esc(k)}" data-id="${esc(cp.id)}" ${can ? "" : "disabled"} title="${st[1]} boosters, ${st[0]} credits">Upgrade<span class="muted small"> ${st[1]}b</span></button>` : `<span class="pill W">Infinity</span>`}</div>`;
  };
  const log = arr(S.progLog).filter((e) => e.k === k).slice(-8).reverse();
  const usedCombos = new Set(p.splits.map((s) => `${s.fin}|${s.fl}`));
  return `<div class="sec-h"><h3>Boosters & upgrades</h3></div>
    <div class="panel stack small">
      <div class="row between nowrap"><b>Boosters</b><div class="stepper"><button data-a="progB" data-k="${esc(k)}" data-v="-1" aria-label="One fewer booster">−</button><input type="number" id="pg-b" data-progb="${esc(k)}" value="${b === null ? "" : esc(b)}" placeholder="?" inputmode="numeric" style="width:64px;text-align:center" aria-label="Boosters"><button data-a="progB" data-k="${esc(k)}" data-v="1" aria-label="One more booster">+</button></div></div>
      <div class="row between nowrap"><span>Character Mastery level</span><input type="number" min="1" max="30" data-progml="${esc(k)}" value="${p.ml === null ? "" : esc(p.ml)}" placeholder="?" inputmode="numeric" style="width:64px;text-align:center" aria-label="Mastery level"></div>
      <span class="muted">Boosters are shared by all your copies of ${esc(c.name)}. Upgrading spends them, plus credits, and adds Collection Level.</span>
    </div>
    <div class="list">${copies.map(copyRow).join("")}</div>
    <div class="panel stack small"><b>Log an Infinity Split</b>
      <div class="grid2"><label class="f">Finish<input type="text" id="sp-fin" list="sp-fins" autocomplete="off" placeholder="e.g. Prism"></label><label class="f">Flare<input type="text" id="sp-fl" list="sp-fls" autocomplete="off" placeholder="e.g. Red Krackle"></label></div>
      <datalist id="sp-fins">${SPLIT_FINISHES.map((f) => `<option value="${esc(f)}">`).join("")}</datalist><datalist id="sp-fls">${SPLIT_FLARES.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
      <label class="f">Rerolled it?<select id="sp-rr"><option value="">No</option><option value="free">Yes, the free reroll</option><option value="coin">Yes, with a Split Reroll Coin${num(S.wallet.rerolls) ? ` (you have ${fmt(num(S.wallet.rerolls))})` : ""}</option></select></label>
      <button class="btn snap" data-a="progSplit" data-k="${esc(k)}">Add split</button>
      ${p.splits.length ? `<span class="muted">${p.splits.length} split${p.splits.length === 1 ? "" : "s"} so far. Each finish and flare pair only comes once per character.</span>` : ""}</div>
    <div class="panel stack small"><b>Borders</b>
      ${p.borders.length ? `<div class="chiplist">${p.borders.map((x, i) => `<button class="cchip" data-a="progBorderDel" data-k="${esc(k)}" data-i="${i}" aria-label="Remove ${esc(x)}"><span>${esc(x)}</span>✕</button>`).join("")}</div>` : `<span class="muted">Borders you've collected for ${esc(c.name)}'s Custom Card.</span>`}
      <div class="row nowrap"><input type="text" id="pg-border" list="pg-borders" placeholder="Add a border" autocomplete="off" aria-label="Border"><datalist id="pg-borders">${borderNames().map((x) => `<option value="${esc(x)}">`).join("")}</datalist><button class="btn sm" data-a="progBorder" data-k="${esc(k)}">Add</button></div>
      ${(p.splits.length || allVariants().some((v) => v.card === k && v.owned)) && (p.custom || !obj(S.looks)[k]) ? `<label class="f">Custom Card<select data-progcustom="${esc(k)}"><option value="">Not set</option>${(() => {
        const vs = [["base", "Base art"], ...allVariants().filter((v) => v.card === k && v.owned).map((v) => ["v:" + v.id, v.name || "Variant"])];
        const brd = ["", ...p.borders, ...borderNames().filter((x) => !p.borders.includes(x))];
        const combos = ["", ...usedCombos].filter((x, i, a) => a.indexOf(x) === i);
        const cur = obj(p.custom), val = cur.v ? `${cur.v}~${cur.border || ""}~${cur.combo || ""}` : "";
        return vs.flatMap(([vid, vn]) => brd.slice(0, 4).flatMap((bd) => combos.slice(0, 4).map((cb) => { const v = `${vid}~${bd}~${cb}`; return `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc([vn, bd ? bd + " border" : "", cb ? cb.replace("|", " + ") : ""].filter(Boolean).join(" · "))}</option>`; }))).slice(0, 60).join("");
      })()}</select></label>` : ""}</div>
    ${log.length ? `<div class="panel stack small"><b>History</b>${log.map((e) => `<span>${logLine(e)}</span>`).join("")}</div>` : ""}`;
}

/* ---- The Upgrades & boosters page (More) ---- */
function progTotals(since) {
  const l = arr(S.progLog).filter((e) => num(e.t) >= since);
  const gained = l.filter((e) => e.a === "boost" && num(e.n) > 0).reduce((t, e) => t + num(e.n), 0);
  const spent = l.filter((e) => e.a === "upgrade").reduce((t, e) => t - num(e.n), 0) + l.filter((e) => e.a === "boost" && num(e.n) < 0).reduce((t, e) => t - num(e.n), 0);
  const ups = l.filter((e) => e.a === "upgrade"), credits = ups.reduce((t, e) => t - num(e.cr), 0), cl = ups.reduce((t, e) => t + num(e.cl), 0);
  return { gained, spent, ups: ups.length, credits, cl, splits: l.filter((e) => e.a === "split").length, coins: l.filter((e) => e.a === "split" && e.reroll === "coin").length };
}
function readyUpgrades() {
  const out = [];
  for (const [k, p0] of Object.entries(obj(S.prog))) {
    if (!S.owned[k] || p0.b === null || p0.b === undefined) continue;
    const copies = progCopies(k); const low = copies.filter((c) => c.r !== null && c.r < 6).sort((a, b) => a.r - b.r)[0] || (copies[0].r === null ? copies[0] : null);
    if (!low) continue; const st = nextStep(low.r ?? 0); if (st && num(p0.b) >= st[1]) out.push({ k, copy: low, st, b: num(p0.b) });
  }
  return out.sort((a, b) => b.b - a.b);
}
function vProgress() {
  const wk = progTotals(Date.now() - 7 * DAY), all = progTotals(0);
  const tracked = Object.keys(obj(S.prog)).filter((k) => S.owned[k] && obj(S.prog[k]).b !== null && obj(S.prog[k]).b !== undefined);
  const totalB = tracked.reduce((t, k) => t + num(S.prog[k].b), 0);
  const ready = readyUpgrades(), readyCr = ready.reduce((t, r) => t + r.st[0], 0);
  const splits = Object.values(obj(S.prog)).reduce((t, p) => t + arr(p.splits).length, 0);
  const log = arr(S.progLog).slice(-40).reverse();
  const tile = (k, v, s) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="small muted">${s}</div>` : ""}</div>`;
  return `<section class="sec">${backBar("Upgrades & boosters")}
    <div class="tiles">${tile("Boosters", fmt(totalB), `on ${fmt(tracked.length)} card${tracked.length === 1 ? "" : "s"} you've noted`)}${tile("Wild Boosters", fmt(num(S.wallet.wild)))}${tile("Split Reroll Coins", fmt(num(S.wallet.rerolls)))}${tile("Infinity Splits", fmt(splits))}</div>
    <p class="muted small">Screenshots of your collection, a card's upgrade screen, a split or your end-of-match rewards fill this in. You can also change any card from its page.</p></section>
  <section class="sec"><h2>This week</h2><div class="tiles">${tile("Boosters gained", fmt(wk.gained))}${tile("Boosters spent", fmt(wk.spent))}${tile("Upgrades", fmt(wk.ups), wk.cl ? `+${fmt(wk.cl)} Collection Level, ${fmt(wk.credits)} credits` : "")}${tile("Splits", fmt(wk.splits), wk.coins ? `${wk.coins} Reroll Coin${wk.coins === 1 ? "" : "s"} used` : "")}</div>
    <p class="muted small">All time: ${fmt(all.gained)} boosters gained, ${fmt(all.spent)} spent, ${fmt(all.ups)} upgrade${all.ups === 1 ? "" : "s"}, ${fmt(all.splits)} split${all.splits === 1 ? "" : "s"}.</p></section>
  <section class="sec"><h2>Ready to upgrade</h2>${ready.length ? `<p class="small">${ready.length} card${ready.length === 1 ? " has" : "s have"} enough boosters. Upgrading all of them once costs ${fmt(readyCr)} credits${num(S.wallet.credits) ? ` (you have ${fmt(num(S.wallet.credits))})` : ""}.</p><div class="list">${ready.slice(0, 40).map((r) => `<button class="li" data-a="cardOpen" data-k="${esc(r.k)}"><div class="grow"><div class="t">${esc(card(r.k).name)}</div><div class="s">${esc(r.copy.label)} · ${esc(fmtRarity(r.copy.r ?? 0))} → ${esc(UP_LEVELS[(r.copy.r ?? 0) + 1])} · ${r.st[1]} boosters, ${fmt(r.st[0])} credits</div></div><span class="num">${fmt(r.b)}</span></button>`).join("")}</div>` : `<p class="muted small">Once you note boosters for your cards (from a collection screenshot, or on a card's page), the cards you can upgrade show up here.</p>`}</section>
  <section class="sec"><h2>History</h2>${log.length ? `<div class="panel stack small">${log.map((e) => `<span>${logLine(e)}</span>`).join("")}</div>` : `<p class="muted small">Nothing yet.</p>`}</section>`;
}

/* ---- From screenshots ----
   Each screenshot's changes are tagged, so Undo takes back only what that screenshot changed, even after later ones. */
let progTag = "";
const tagged = (fn) => { const t = uid(); progTag = t; try { fn(); } finally { progTag = ""; } return t; };
const snapFields = (k) => { const p = prog(k); return { k, owned: !!S.owned[k], b: p.b, base: p.base, ml: p.ml, vr: { ...p.vr }, borders: [...p.borders], splitR: Object.fromEntries(p.splits.map((sp) => [sp.id, sp.r])), splitF: Object.fromEntries(p.splits.map((sp) => [sp.id, [sp.fin, sp.fl]])), splitIds: p.splits.map((sp) => sp.id) }; };
function applyShotCard(x, cc) {
  const c = fuzzyCard(cc.card); if (!c) { x.status = "Couldn't tell which card this is"; return; }
  const k = c.key, before = snapFields(k), done = [];
  const tag = tagged(() => {
    const p = prog(k); S.owned[k] = true;
    if (cc.boosters !== null && cc.boosters !== undefined && Number.isFinite(Number(cc.boosters))) { setBoosters(k, cc.boosters, "from a screenshot"); done.push(`${fmt(num(cc.boosters))} boosters`); }
    const r = rarityIdx(cc.rarity);
    if (r !== null) {
      const vName = String(cc.variant || "").trim(); const v0 = vName && matchVariant(k, vName, ""); const v = v0 ? materializeVar(v0.id) : null;
      const sp = (cc.finish || cc.flare) && p.splits.find((x2) => keyOf(x2.fin) === keyOf(cc.finish || "") && keyOf(x2.fl) === keyOf(cc.flare || ""));
      if (sp) { sp.r = r; done.push(`split ${UP_LEVELS[r]}`); }
      // A split you hadn't logged yet: it's yours, so it's added with its level
      else if (cc.finish || cc.flare) { const empty = p.splits.find((x2) => !x2.fin && !x2.fl); if (empty) { empty.fin = String(cc.finish || "").slice(0, 40); empty.fl = String(cc.flare || "").slice(0, 40); empty.r = r; } else p.splits.push({ id: uid(), fin: String(cc.finish || "").slice(0, 40), fl: String(cc.flare || "").slice(0, 40), r, at: Date.now() }); syncSplitCount(k); done.push(`split ${UP_LEVELS[r]}`); }
      else if (v) { if (!v.owned) before.varOwned = [{ id: v.id }]; setVarOwned(v, true, "card"); p.vr[v.id] = r; done.push(`${v.name} ${UP_LEVELS[r]}`); }
      // A variant I couldn't match: its level isn't put on the base card
      else if (vName) done.push(`(couldn't match the variant "${vName.slice(0, 30)}", so its level wasn't saved)`);
      else { setCopyRarity(k, "base", r); done.push(UP_LEVELS[r]); }
    }
    if (cc.splits !== null && cc.splits !== undefined && Number(cc.splits) > p.splits.length && Number(cc.splits) < 200) { while (p.splits.length < Number(cc.splits)) p.splits.push({ id: uid(), fin: "", fl: "", r: null, at: 0 }); syncSplitCount(k); done.push(`${p.splits.length} splits`); }
    if (Number(cc.masteryLevel) >= 1) { p.ml = clamp(Math.round(Number(cc.masteryLevel)), 1, 30); progLogAdd({ k, a: "mastery", n: p.ml }); done.push(`Mastery ${p.ml}`); }
    if (cc.masteryXp !== null && cc.masteryXp !== undefined && Number.isFinite(Number(cc.masteryXp)) && Number(cc.masteryXp) >= 0 && Number(cc.masteryXp) <= 100000) { p.mx = Math.round(Number(cc.masteryXp)); p.mxAt = Date.now(); }
    if (cc.border) { const bd = String(cc.border).slice(0, 40); if (!p.borders.includes(bd)) { p.borders.push(bd); progLogAdd({ k, a: "border", border: bd }); done.push(`${bd} border`); } }
  });
  { const vn = String(cc.variant || "").trim(), v0 = vn ? matchVariant(k, vn, vn) : null; if (noteLook(k, { v: v0 ? (v0.virtual ? "cat:" + v0.cat : v0.id) : "", vname: vn, border: cc.border, finish: cc.finish, flare: cc.flare }, "card")) done.push("Custom Card saved"); }
  if (!done.length) { x.status = `${c.name}: nothing I could read`; return; }
  before.after = snapFields(k);
  x.status = `Updated ${c.name}`; x.detail = done.join(" · "); x.undo = { type: "prog", items: [before], tag }; x.cardKey = k; save();
}
function applyShotCollection(x, list) {
  const items = []; let n = 0, ticked = 0, nb = 0;
  const tag = tagged(() => {
    for (const it of arr(list).slice(0, 40)) {
      const c = fuzzyCard(it.card); if (!c || c.unknown) continue;
      items.push(snapFields(c.key));
      if (!S.owned[c.key]) { S.owned[c.key] = true; ticked++; }
      // Every card in your collection grid is yours. "99+" boosters means at least 99.
      const raw = String(it.boosters === null || it.boosters === undefined ? "" : it.boosters).trim(), plus = /\+$/.test(raw), b = Number(raw.replace(/[+,\s]/g, ""));
      if (raw && Number.isFinite(b) && b >= 0 && b < 100000) { if (!plus || num(prog(c.key).b) < b) setBoosters(c.key, b, "from a collection screenshot"); nb++; }
      const r = rarityIdx(it.rarity); if (r !== null) setCopyRarity(c.key, "base", r);
      n++;
    }
  });
  items.forEach((it) => (it.after = snapFields(it.k)));
  if (!n) { x.status = "Couldn't read the cards on this screen"; return; }
  x.status = `${n} card${n === 1 ? "" : "s"} from your collection${ticked ? ` (${ticked} newly ticked)` : ""}${nb ? ` · boosters for ${nb}` : ""}`; x.detail = items.slice(0, 6).map((i) => card(i.k).name).join(", ") + (items.length > 6 ? "…" : "");
  x.undo = { type: "prog", items, tag }; save();
}
function applyShotSplit(x, sp) {
  const c = fuzzyCard(sp.card); if (!c) { x.status = "Couldn't tell which card was split"; return; }
  const fin = SPLIT_FINISHES.find((f) => keyOf(f) === keyOf(sp.finish)) || String(sp.finish || "").slice(0, 40), fl = SPLIT_FLARES.find((f) => keyOf(f) === keyOf(sp.flare)) || String(sp.flare || "").slice(0, 40);
  const how = sp.rerolled ? (sp.usedCoin ? "coin" : "free") : "";
  if ((fin || fl) && prog(c.key).splits.some((s) => keyOf(s.fin) === keyOf(fin) && keyOf(s.fl) === keyOf(fl))) { x.status = `${c.name}: that split is already logged`; x.cardKey = c.key; return; }
  let made = null; const tag = tagged(() => { made = addSplit(c.key, fin, fl, how); });
  x.status = `Logged a split of ${c.name}`; x.detail = [fin, fl].filter(Boolean).join(" + ") || "Effect not shown";
  x.undo = { type: "prog", items: [], split: { k: c.key, id: made.id, coin: !!made.coinTaken }, tag }; x.cardKey = c.key;
}
/* Boosters shown on the end-of-match screen */
function applyMatchBoosters(m, list) {
  let n = 0;
  for (const it of arr(list).slice(0, 12)) { const c = fuzzyCard(it.card); const v = Math.round(num(it.n)); if (c && v > 0 && v <= 20) { addBoosters(c.key, v, "from a match", { match: m.id }); n += v; } }
  return n;
}
// Only what this screenshot changed is put back: a field that has changed again since (a later screenshot, an
// upgrade you tapped) keeps its newer value, and boosters lose just this screenshot's change.
function undoProg(u) {
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const it of arr(u.items)) {
    if (!S.prog || !S.prog[it.k]) continue; const p = prog(it.k), af = it.after;
    if (!af) { // saved by an older version
      p.b = it.b; p.base = it.base; p.ml = it.ml; p.vr = it.vr; p.borders = it.borders;
      p.splits = p.splits.filter((sp) => it.splitIds.includes(sp.id) || num(sp.at) > 0);
      p.splits.forEach((sp) => { if (sp.id in it.splitR) sp.r = it.splitR[sp.id]; });
      syncSplitCount(it.k); continue;
    }
    if (same(p.b, af.b)) p.b = it.b; else if (p.b !== null && af.b !== null && it.b !== null) p.b = Math.max(0, num(p.b) - (num(af.b) - num(it.b)));
    for (const f of ["base", "ml"]) if (same(p[f], af[f])) p[f] = it[f];
    for (const id of new Set([...Object.keys(obj(af.vr)), ...Object.keys(obj(it.vr))])) if (same(p.vr[id], af.vr[id])) { if (it.vr[id] === undefined) delete p.vr[id]; else p.vr[id] = it.vr[id]; }
    const addedB = arr(af.borders).filter((b) => !arr(it.borders).includes(b)); p.borders = p.borders.filter((b) => !addedB.includes(b));
    const addedS = arr(af.splitIds).filter((id) => !arr(it.splitIds).includes(id)); p.splits = p.splits.filter((sp) => !addedS.includes(sp.id));
    p.splits.forEach((sp) => { if (sp.id in it.splitR && same(sp.r, obj(af.splitR)[sp.id])) sp.r = it.splitR[sp.id]; const f0 = obj(it.splitF)[sp.id]; if (f0 && same([sp.fin, sp.fl], obj(af.splitF)[sp.id])) { sp.fin = f0[0]; sp.fl = f0[1]; } });
    syncSplitCount(it.k);
    if (it.owned === false && af.owned === true && S.owned[it.k]) delete S.owned[it.k];
    for (const vo of arr(it.varOwned)) { const v = S.variants.find((x) => x.id === vo.id); if (v && v.owned) v.owned = false; }
  }
  if (u.split) { const p = prog(u.split.k); p.splits = p.splits.filter((sp) => sp.id !== u.split.id); syncSplitCount(u.split.k); if (u.split.coin) S.wallet.rerolls = num(S.wallet.rerolls) + 1; }
  if (u.tag) S.progLog = arr(S.progLog).filter((e) => e.tag !== u.tag);
}

Object.assign(A, {
  progB: (el) => { const k = el.dataset.k; if (prog(k).b === null) setBoosters(k, Math.max(0, num(el.dataset.v)), "changed by hand"); else addBoosters(k, num(el.dataset.v), "changed by hand"); save(); refreshSheet(); },
  progUp: (el) => { const err = upgradeCopy(el.dataset.k, el.dataset.id); if (err) toast(err); else toast("Upgraded"); refreshSheet(); },
  progSplit: (el) => {
    const k = el.dataset.k, fin = String(($("#sp-fin") || {}).value || "").trim(), fl = String(($("#sp-fl") || {}).value || "").trim(), rr = String(($("#sp-rr") || {}).value || "");
    const p = prog(k); if ((fin || fl) && p.splits.some((s) => keyOf(s.fin) === keyOf(fin) && keyOf(s.fl) === keyOf(fl))) { toast("You already have that finish and flare pair for this card"); return; }
    const s = addSplit(k, fin, fl, rr); toast(s.coinTaken ? "Split saved and 1 Split Reroll Coin taken off" : "Split saved"); refreshSheet();
  },
  progBorder: (el) => { const k = el.dataset.k, v = String(($("#pg-border") || {}).value || "").trim().slice(0, 40); if (!v) return; const p = prog(k); if (!p.borders.includes(v)) { p.borders.push(v); progLogAdd({ k, a: "border", border: v }); save(); } refreshSheet(); },
  progBorderDel: (el) => { const p = prog(el.dataset.k); p.borders = p.borders.filter((_, i) => i !== num(el.dataset.i)); save(); refreshSheet(); },
});
document.addEventListener("change", (e) => {
  const t = e.target, d = t.dataset;
  if (d.progr !== undefined) { const k = d.k, r = t.value === "" ? null : num(t.value); setCopyRarity(k, d.progr, r); save(); refreshSheet(); }
  else if (d.progb) { if (String(t.value).trim() === "") prog(d.progb).b = null; else setBoosters(d.progb, t.value, "changed by hand"); save(); refreshSheet(); }
  else if (d.progml) { const p = prog(d.progml); const v = t.value === "" ? null : clamp(Math.round(num(t.value)), 1, 30); if (v !== p.ml) { p.ml = v; if (v) progLogAdd({ k: d.progml, a: "mastery", n: v }); save(); } }
  else if (d.progcustom) { const p = prog(d.progcustom); const [v, border, combo] = String(t.value).split("~"); p.custom = v ? { v, border: border || "", combo: combo || "" } : null; save(); }
});

