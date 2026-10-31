/* ============ Emotes: every one in the game, which you have, and emote reactions on posts and comments ============
   The list comes from art.json (built daily from Marvel Snap Zone and snap.fan). Text emotes are the ones everyone starts with. */
let _emoSrc = null, _emoList = [], _emoById = new Map();
function emoteCatalog() {
  const src = ART.data && ART.data.emotes;
  if (src !== _emoSrc) {
    _emoSrc = src;
    _emoList = arr(src).filter((e) => e && /^[A-Za-z0-9_]+$/.test(String(e.id || "")) && String(e.name || "").length <= 80)
      .map((e) => ({ id: String(e.id), name: String(e.name || e.id), kind: ["text", "anim", "image"].includes(e.kind) ? e.kind : "image", img: safeUrl(e.img), sf: safeUrl(e.sf), texts: arr(e.texts).map(String).slice(0, 2), added: String(e.added || ""), src: String(e.src || "") }));
    _emoById = new Map(_emoList.map((e) => [e.id, e]));
  }
  return _emoList;
}
const emoteById = (id) => (emoteCatalog(), _emoById.get(String(id || ""))) || null;
const emoteCos = (e) => S.cosmetics.find((c) => c.kind === "emote" && c.ref === e.id) || S.cosmetics.find((c) => c.kind === "emote" && !c.ref && keyOf(c.name) === keyOf(e.name)) || null;
const emoteOwned = (e) => e.kind === "text" || !!(emoteCos(e) || {}).owned;
const emoteWanted = (e) => !!(emoteCos(e) || {}).wish;
function emoteSet(e, field, val) {
  let c = emoteCos(e);
  if (!c) { c = { id: uid(), kind: "emote", name: e.name, source: e.added ? "Update " + e.added : "", owned: false, wish: false, ref: e.id }; S.cosmetics.push(c); }
  c.ref = e.id; c[field] = val; if (field === "owned" && val) c.wish = false;
}
// The emote's picture (snap.fan's first, since it loads everywhere), or a speech bubble for the text ones.
function emotePic(e, cls = "") {
  if (!e) return "";
  if (e.kind === "text") return `<span class="emo-txt ${cls}">${esc(e.texts[0] || e.name)}</span>`;
  const a = e.sf || e.img, b = e.sf && e.img ? e.img : "";
  if (!a || !showArt()) return `<span class="emo-txt ${cls}">${esc(e.name)}</span>`;
  return `<img class="emo-img ${cls}" src="${esc(a)}" alt="${esc(e.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"${b ? ` data-alt="${esc(b)}"` : ""} onerror="emoFail(this)">`;
}
// The other picture, then the emote's name in a bubble (a broken picture looks like the app is broken)
function emoFail(img) { const b = img.dataset.alt; if (b) { img.dataset.alt = ""; img.src = b; return; } const t = document.createElement("span"); t.className = img.className.replace("emo-img", "emo-txt"); t.textContent = img.alt || "?"; img.replaceWith(t); }

/* ---------- Collection › Cosmetics › Emotes ---------- */
function emoteGallery() {
  const all = emoteCatalog(); if (!all.length) return "";
  const q = keyOf(ui.emoQ), f = ui.emoF || "all", k = ui.emoK || "", n = ui.emoN || 48;
  const list = all.filter((e) => (!k || e.kind === k) && (!q || keyOf(e.name).includes(q) || keyOf(e.id).includes(q) || e.texts.some((t) => keyOf(t).includes(q)))
    && (f === "all" || (f === "own" ? emoteOwned(e) : f === "want" ? emoteWanted(e) : !emoteOwned(e))));
  const own = all.filter(emoteOwned).length;
  const chip = (a, v, cur, l) => `<button class="chip" data-a="${a}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`;
  return `<div class="panel stack"><div class="row between"><b>Every emote</b><span class="muted small num">${own} of ${all.length} collected</span></div>
    <input type="search" id="emo-q" data-ui="emoQ" value="${esc(ui.emoQ || "")}" placeholder="Search emotes" autocomplete="off">
    <div class="chips">${chip("emoF", "all", f, "All")}${chip("emoF", "own", f, "Collected")}${chip("emoF", "missing", f, "Not yet")}${chip("emoF", "want", f, "Wishlist")}</div>
    <div class="chips">${chip("emoK", "", k, "Every kind")}${chip("emoK", "image", k, "Pictures")}${chip("emoK", "anim", k, "Moving")}${chip("emoK", "text", k, "Text")}</div>
    ${list.length ? `<div class="emo-grid">${list.slice(0, n).map((e) => { const o = emoteOwned(e), w = emoteWanted(e); return `<div class="emo-tile ${o ? "own" : ""}">
        <button class="emo-pick" data-a="emoOwn" data-v="${esc(e.id)}" aria-pressed="${o}" ${e.kind === "text" ? "disabled" : ""} aria-label="${esc(e.name)}${o ? ", collected" : ""}">${emotePic(e)}${o ? `<span class="emo-tick">✓</span>` : ""}</button>
        <div class="emo-info"><span class="emo-n">${esc(e.kind === "text" ? (e.texts[1] ? e.texts.join(" / ") : e.name) : e.name)}</span>${e.kind !== "text" ? `<button class="star" data-a="emoWish" data-v="${esc(e.id)}" aria-pressed="${w}" aria-label="Wishlist">${HEART}</button>` : ""}</div>
        <span class="emo-d">${e.kind === "text" ? "Everyone has it" : esc([e.kind === "anim" ? "Moving" : "", e.src, e.added && (/^\d/.test(e.added) ? "Update " + e.added : e.added)].filter(Boolean).join(" · "))}</span></div>`; }).join("")}</div>` : `<p class="muted small">No emotes match.</p>`}
    ${list.length > n ? `<div><button class="btn sm" data-a="emoMore">Show more (${list.length - n} more)</button></div>` : ""}
    <p class="muted small">Tap each emote you have to tick it, and ♡ the ones you want. In the game they're in your Collection › Emotes. You can react to posts and comments in Social with any emote.</p></div>`;
}

/* ---------- Emote reactions ---------- */
// Everyone's emote reactions for one post or comment: [{ e, n, mine }], most used first.
function emoteCounts(k) {
  const c = new Map(); let mine = "";
  for (const [who, r] of Object.entries(shared.reactions)) {
    const id = obj(obj(r).emotes)[k]; if (!id || !emoteById(id)) continue;
    c.set(id, (c.get(id) || 0) + 1); if (who === store.uid) mine = id;
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ e: emoteById(id), n, mine: id === mine }));
}
function emoteBar(k, small) {
  const list = emoteCounts(k); if (!list.length) return "";
  return `<div class="emo-bar ${small ? "sm" : ""}">${list.slice(0, 8).map((x) => `<button class="emo-chip ${x.mine ? "on" : ""}" data-a="emoReact" data-k="${esc(k)}" data-v="${esc(x.e.id)}" aria-pressed="${x.mine}" aria-label="${esc(x.e.name)}, ${x.n}">${emotePic(x.e, "xs")}<span class="num">${x.n}</span></button>`).join("")}</div>`;
}
const EMO_ICON = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/></svg>`;
const emoBtn = (k, mode, label) => `<button data-a="emoPick" data-k="${esc(k)}" data-mode="${mode}" aria-label="${label}">${EMO_ICON}</button>`;
// A comment that is an emote shows the emote; others show their words.
const commentBody = (c) => { const e = c.emote ? emoteById(c.emote) : null; return e ? `<span class="emo-sticker">${emotePic(e, "md")}</span>` : `<span style="overflow-wrap:anywhere">${esc(c.text)}</span>`; };

let emo = { k: "", mode: "react", q: "" };
function emoteSheet() {
  const all = emoteCatalog();
  if (!all.length) return `${sheetHead("Emotes")}<p class="muted">The emote list hasn't loaded yet. Try again in a moment.</p>`;
  const q = keyOf(emo.q), fit = (e) => !q || keyOf(e.name).includes(q) || e.texts.some((t) => keyOf(t).includes(q));
  const mine = emo.mode === "react" ? obj(obj(shared.reactions[store.uid]).emotes)[emo.k] : "";
  const own = all.filter((e) => emoteOwned(e) && fit(e)), rest = all.filter((e) => !emoteOwned(e) && fit(e));
  const tile = (e) => `<button class="emo-opt ${mine === e.id ? "on" : ""}" data-a="emoChoose" data-v="${esc(e.id)}" aria-label="${esc(e.name)}">${emotePic(e, "md")}<span>${esc(e.kind === "text" ? "" : e.name)}</span></button>`;
  return `${sheetHead(emo.mode === "comment" ? "Send an emote" : "React with an emote", emo.mode === "comment" ? "It's posted as your comment." : mine ? "Tap yours again to take it back." : "")}
    <input type="search" id="emo-sq" data-emoq="1" value="${esc(emo.q)}" placeholder="Search emotes" autocomplete="off">
    ${own.length ? `<span class="eyebrow">Your emotes</span><div class="emo-opts">${own.slice(0, 80).map(tile).join("")}</div>` : ""}
    ${rest.length ? `<span class="eyebrow">${own.length ? "More emotes" : "Emotes"}</span><div class="emo-opts">${rest.slice(0, ui.emoSheetN || 60).map(tile).join("")}</div>${rest.length > (ui.emoSheetN || 60) ? `<button class="btn sm" data-a="emoSheetMore">Show more</button>` : ""}` : ""}
    ${!own.length || own.every((e) => e.kind === "text") ? `<p class="muted small">Tick the emotes you have in Collection › Cosmetics › Emotes and they show up first here.</p>` : ""}`;
}

document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.emoq) { emo.q = t.value; const pos = t.selectionStart; refreshSheet(); const n = $("#emo-sq"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* fine */ } } } });
Object.assign(A, {
  emoF: (el) => { ui.emoF = el.dataset.v; ui.emoN = 48; render(); },
  emoK: (el) => { ui.emoK = el.dataset.v; ui.emoN = 48; render(); },
  emoMore: () => { ui.emoN = (ui.emoN || 48) + 96; render(); },
  emoOwn: (el) => { const e = emoteById(el.dataset.v); if (!e || e.kind === "text") return; emoteSet(e, "owned", !emoteOwned(e)); save(); render(); },
  emoWish: (el) => { const e = emoteById(el.dataset.v); if (!e) return; emoteSet(e, "wish", !emoteWanted(e)); save(); render(); },
  emoPick: (el) => {
    if (store.mode !== "cloud") { toast("Sign in to react."); return; }
    if (el.dataset.mode === "comment" && !S.me.handle.trim()) { toast("Add your in-game name first."); return; }
    emo = { k: el.dataset.k, mode: el.dataset.mode === "comment" ? "comment" : "react", q: "" }; ui.emoSheetN = 60; openSheet(emoteSheet);
  },
  emoSheetMore: () => { ui.emoSheetN = (ui.emoSheetN || 60) + 120; refreshSheet(); },
  emoChoose: (el) => {
    const e = emoteById(el.dataset.v); if (!e || !emo.k) return;
    const r = myReactions();
    if (emo.mode === "comment") r.comments = [...r.comments, { id: uid(), k: emo.k, text: "", emote: e.id, ts: Date.now() }].slice(-200);
    else { const cur = r.emotes[emo.k]; if (cur === e.id) delete r.emotes[emo.k]; else r.emotes[emo.k] = e.id; }
    writeReactions(r); closeSheet(); render();
  },
  // Tapping an emote under a post adds yours (or takes it back if it's already yours)
  emoReact: (el) => {
    if (store.mode !== "cloud") { toast("Sign in to react."); return; }
    const e = emoteById(el.dataset.v), k = el.dataset.k; if (!e || !k) return;
    const r = myReactions(); if (r.emotes[k] === e.id) delete r.emotes[k]; else r.emotes[k] = e.id;
    writeReactions(r); render(); if (sheetFn) refreshSheet();
  },
});
