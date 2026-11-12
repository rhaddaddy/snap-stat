/* ============ Nov 11: your own card art everywhere, the draft and the AI deck builder (Ryan's reports) ============
   1 myVariant(k, d): the art you actually use for a card: the variant picked in that deck, else your Custom Card's
     variant (S.looks), else your favourite. Used by shared decks, the auto banner (y40) and the draft.
   2 Shared decks (posts) carry that art, load it straight away and fall back to SNAP Stat's own copy of the art if
     the picture site doesn't answer (PVCK: a posted deck showed empty cards).
   3 Draft a deck: the three cards side by side, each with its name and ability under it like the game, in your art (Q77D).
   4 AI deck builder: live suggestions while you type (cards, by name or by what they do) and every effect type to tap (8VHP). */

/* ---------- 1. The art you use ---------- */
function myVariant(k, d) {
  const any = (id) => (typeof variantAny === "function" ? variantAny(id) : variantById(id));
  const picked = d ? obj(d.variants)[k] : ""; if (picked) { const v = any(picked); if (v) return v; }
  const L = obj(obj(S.looks)[k]); if (L.v) { const v = any(L.v); if (v) return v; }
  return favVariant(k) || null;
}
// SNAP Stat's own copy of a card's art, used when the usual picture doesn't load
function artBackup(k, v) {
  const c = card(k); if (!c || !c.catId || typeof LK_HOST === "undefined") return "";
  const cv = v && v.cat && typeof _catVars !== "undefined" ? _catVars.get(v.cat) : null;
  return `${LK_HOST}art/${c.catId}${cv ? "_" + pad2(cv.order) : ""}.webp`;
}

/* ---------- 2. Shared decks ---------- */
if (typeof deckPublic === "function") {
  const _dp = deckPublic;
  deckPublic = function (d) { // eslint-disable-line no-func-assign
    const out = _dp(d), art = {};
    for (const k of arr(d.cards)) { if (String(k).startsWith("custom:")) continue; const v = myVariant(k, d), u = v ? variantArt(v) : ""; if (u && /^https:\/\//.test(u)) art[card(k).name] = u.slice(0, 300); }
    return { ...out, art };
  };
}
if (typeof sharedDeckHtml === "function") {
  const _sd = sharedDeckHtml;
  sharedDeckHtml = function (dk, author, id) { // eslint-disable-line no-func-assign
    const arts = obj(dk && dk.art), vars = obj(dk && dk.variants);
    const chips = arr(dk && dk.cards).slice(0, 12).map((n) => {
      const c = cardByName(n); if (!c) return nameChip(n);
      const u = safeUrl(arts[n]) || "", chip = cardChip(c.key, { noOwn: true, v: u ? { art: u } : null, a: "cardOpen" });
      const alt = artBackup(c.key, null);
      // Straight away (not when scrolled to), with SNAP Stat's own copy of the art as a backup
      return chip.replace(' loading="lazy"', "").replace('<img class="cimg"', `<img class="cimg" data-alt="${esc(alt)}" title="${esc(vars[n] || "")}"`);
    }).join("");
    const html = _sd(dk, author, id);
    return html.replace(/<div class="chiplist">[\s\S]*?<\/div>/, `<div class="chiplist sdeck">${chips}</div>`);
  };
}
// A picture that fails tries the backup once before giving up
if (typeof artFail === "function") {
  const _af = artFail;
  artFail = function (img) { // eslint-disable-line no-func-assign
    const alt = img && img.dataset && img.dataset.alt;
    if (alt && !img.dataset.tried) { img.dataset.tried = "1"; img.src = alt; return; }
    _af(img);
  };
}
// Pictures still loading after 6 seconds (a slow or blocked site) switch to the backup too
EXT.afterRender.push(function y43ArtWatch() {
  clearTimeout(y43ArtWatch.t);
  y43ArtWatch.t = setTimeout(() => { document.querySelectorAll("img.cimg[data-alt]:not([data-tried])").forEach((img) => { if (!img.complete || !img.naturalWidth) artFail(img); }); }, 6000);
});

/* ---------- 3. Draft a deck ---------- */
if (typeof draftSheet === "function") {
  const _ds = draftSheet;
  draftSheet = function () { // eslint-disable-line no-func-assign
    if (!draft.on || draft.picks.length >= 12 || !draft.opts.length) return _ds();
    const ownedN = allCards().filter((c) => S.owned[c.key]).length;
    return `${sheetHead(`Pick ${draft.picks.length + 1} of 12`, draft.pool === "owned" ? `From your ${ownedN} cards` : "From every card")}
      <div class="draft-row">${draft.opts.map((k) => { const c = card(k), v = myVariant(k, null); return `<div class="draft-pick">${cardFace(c, { a: "draftPick", cls: "own", variant: v, noSub: true })}
        <button class="draft-txt" data-a="draftPick" data-k="${esc(k)}"><b>${esc(c.name)}</b><span class="small muted">${c.cost}·${c.power}</span><span class="small">${esc(c.ability || "No ability")}</span></button></div>`; }).join("")}</div>
      ${draft.picks.length ? `<div class="chiplist">${draft.picks.map((k) => cardChip(k, { noOwn: true, v: myVariant(k, null) })).join("")}</div>` : ""}
      <span class="muted small">Cards show the art you use (your Custom Card or favourite variant). Start again to switch between My cards and All cards.</span>`;
  };
}

/* ---------- 4. AI deck builder: live suggestions ---------- */
const AI_WORDS = [...new Set([...Object.values(TAGS), "End of Turn", "Activate", "Game Start", "Bounce", "Steal", "Afflict", "Copy", "Draw", "Hand size", "Ramp", "Cheap cards", "Moveable", "Zero cost", "Clog", "Junk", "Merge", "Replace", "Ongoing lock", "Big power", "Location control"])];
const aiQ = (v) => { const parts = String(v || "").split(/\s*[+,&]\s*|\s+and\s+/i); return { head: parts.slice(0, -1), q: (parts[parts.length - 1] || "").trim() }; };
// Loose matching, so you don't have to spell it right: words in order, letters in order, or a near miss
function aiScore(text, q, loose = true) {
  text = String(text || "").toLowerCase(); q = q.toLowerCase(); if (!q) return 0;
  if (text.startsWith(q)) return 5; if (text.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return 4; if (text.includes(q)) return 3;
  if (!loose || !text.split(/[^a-z0-9]+/).some((w) => w[0] === q[0])) return 0; let i = 0; for (const ch of text) if (ch === q[i]) i++; if (q.length >= 3 && i >= q.length) return 1.5; // letters in order (agth → Agatha)
  return 0;
}
function aiSuggHtml(value) {
  const { q } = aiQ(value), own = ai.ownedOnly;
  const words = q ? AI_WORDS.filter((w) => aiScore(w, q) >= 3) : AI_WORDS;
  let cards = [];
  if (q.length >= 1) {
    cards = allCards().filter((c) => !c.upcoming && !c.custom && c.cost !== "?").map((c) => { const m = aiScore(c.name, q) * 2 + (q.length >= 3 ? Math.min(3, aiScore(c.ability, q, false)) : 0); return { c, s: m ? m + (own && S.owned[c.key] ? 0.5 : 0) : 0 }; })
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name)).slice(0, 10).map((x) => x.c);
  }
  return `<div class="stack small" style="gap:6px">
    ${cards.length ? `<div class="muted small">Cards${q.length >= 3 ? " (by name or what they do)" : ""}: tap to build around one</div><div class="chiplist ai-cards">${cards.map((c) => cardChip(c.key, { a: "aiSuggCard", size: "xs" })).join("")}</div>` : q ? `<span class="muted small">No card matches “${esc(q)}” yet. Keep typing, or tap an effect.</span>` : ""}
    <div class="muted small">${q ? "Effects that match" : "Or tap an effect type"}</div>
    <div class="chips ai-words">${words.map((w) => `<button class="chip" data-a="aiSuggWord" data-w="${esc(w)}">${esc(w)}</button>`).join("") || `<span class="muted small">—</span>`}</div></div>`;
}
if (typeof aiSheet === "function") {
  const _as = aiSheet;
  aiSheet = function () { // eslint-disable-line no-func-assign
    const html = _as();
    if (ai.improve) return html;
    return html.replace(/(<input type="text" id="ai-theme"[^>]*>)<\/label>/, `$1</label><div id="ai-sugg">${aiSuggHtml(ai.theme)}</div>`).replace('id="ai-theme"', 'id="ai-theme" autocomplete="off" enterkeyhint="search"');
  };
}
document.addEventListener("input", (e) => { const t = e.target; if (!t || t.id !== "ai-theme") return; const box = document.getElementById("ai-sugg"); if (box) box.innerHTML = aiSuggHtml(t.value); });
function aiSuggSet(word) {
  const el = document.getElementById("ai-theme"), { head } = aiQ(el ? el.value : ai.theme);
  ai.theme = [...head, word].join(" + ");
  if (el) { el.value = ai.theme; el.focus(); try { el.setSelectionRange(ai.theme.length, ai.theme.length); } catch { /* fine */ } }
  const box = document.getElementById("ai-sugg"); if (box) box.innerHTML = aiSuggHtml("");
}
Object.assign(A, {
  aiSuggCard: (el) => aiSuggSet(card(el.dataset.k).name),
  aiSuggWord: (el) => aiSuggSet(el.dataset.w),
});

EXT.styles.push(`
.draft-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-items: start; margin-bottom: 12px; }
.draft-pick { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.draft-pick .ct { width: 100%; }
.draft-txt { display: flex; flex-direction: column; gap: 3px; text-align: center; background: none; border: 0; color: var(--fg); font: inherit; padding: 0 2px; cursor: pointer; overflow-wrap: anywhere; }
.draft-txt b { font-size: 14px; line-height: 1.15; }
.draft-txt .small { line-height: 1.3; }
#ai-sugg { margin: 6px 0 10px; }
#ai-sugg .ai-words { flex-wrap: wrap; }
#ai-sugg .ai-cards { max-height: 260px; overflow-y: auto; }`);
EXT.search.push((q) => (/draft|ai deck|build around/i.test(q) ? [{ label: "Draft a deck · AI deck builder", sub: "Cards › Decks", route: "cards/decks" }] : []));
