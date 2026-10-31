/* ============ One month of your MARVEL SNAP history (Profile › Your SNAP history › a month) ============
   Tapping a month shows everything SNAP Stat knows about it: the season and its dates, when you reached pass level
   25 and 50 (from your data copy), your pass level and rank from SNAP Stat, your matches, cubes and win rate that
   season, the decks you played most, your best opponents' decks, and the events that ran. */
let histMonthKey = "";
function histMonthSheet() {
  const k = histMonthKey, [y, m] = k.split("-").map(Number), H = obj(S.history), P = obj(H.passes)[k] || ["", ""];
  const name = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const s = seasons().find((x) => x.start && x.start.slice(0, 7) === k) || null;
  // The season's own dates when it's known, otherwise the calendar month
  const from = s ? s.startTs : Date.UTC(y, m - 1, 1), to = s && Number.isFinite(s.endTs) ? s.endTs : Date.UTC(y, m, 1) - 1;
  const ms = inPeriod(realMatches(), { from, to }), st = statsFor(ms), pass = s ? obj(S.passes[s.id]) : {}, rk = s ? obj(S.ranks["s:" + s.id]) : {};
  const wr = st.w + st.l ? Math.round((st.w / (st.w + st.l)) * 100) : 0;
  // Your decks that month, most played first
  const decks = new Map(); for (const mt of ms) { const key = mt.deckId || mt.deckName || ""; if (!key) continue; const d = decks.get(key) || { id: mt.deckId || "", name: mt.deckName || (S.decks.find((x) => x.id === mt.deckId) || {}).name || "A deck", ms: [] }; d.ms.push(mt); decks.set(key, d); }
  const top = [...decks.values()].sort((a, b) => b.ms.length - a.ms.length).slice(0, 4);
  const evs = events().filter((e) => e.startTs <= to && (Number.isFinite(e.endTs) ? e.endTs : e.startTs) >= from).slice(0, 8);
  const tile = (v, l) => `<div class="tile"><div class="v num">${v}</div><div class="k">${l}</div></div>`;
  const has = P[0] || P[1] || st.games || pass.level || rk.peak || rk.end || s || evs.length;
  return `${sheetHead(esc(name), s ? esc(s.name) : "")}
    ${s && typeof seasonPic === "function" ? `<div class="hm-art">${seasonPic(s, "sart")}</div>` : ""}
    <div class="stack">
      ${s ? `<p class="small">${esc(dateStr(s.start))}${s.end ? " – " + esc(dateStr(s.end)) : ""}${s.card ? ` · season pass card <b>${esc(card(s.card).name || s.card)}</b>` : ""}</p>` : ""}
      <div class="tiles">
        ${tile(P[1] ? "50" : P[0] ? "25" : pass.level ? esc(pass.level) : "—", P[1] ? `pass level 50 on ${esc(dateStr(P[1]))}` : P[0] ? `pass level 25 on ${esc(dateStr(P[0]))}` : pass.level ? "pass level (from SNAP Stat)" : "no pass record")}
        ${pass.tier ? tile(esc(String(pass.tier).replace(/^./, (c) => c.toUpperCase())), "pass type") : ""}
        ${rk.peak || rk.end ? tile(esc(rk.peak || rk.end), rk.peak ? "best rank" : "rank at the end") : ""}
        ${st.games ? tile(fmt(st.games), `match${st.games === 1 ? "" : "es"} tracked`) : ""}
        ${st.games ? tile(`${st.w}-${st.l}${st.t ? "-" + st.t : ""}`, `wins-losses · ${wr}%`) : ""}
        ${st.games ? tile(signed(st.cubes), "cubes") : ""}
        ${st.snaps ? tile(fmt(st.snaps), `snaps (${st.snapW} won)`) : ""}
      </div>
      ${P[0] && P[1] ? `<p class="small muted">Level 25 on ${esc(dateStr(P[0]))}, level 50 on ${esc(dateStr(P[1]))}.</p>` : ""}
      ${top.length ? `<span class="eyebrow">Your decks</span><div class="list">${top.map((d) => { const x = statsFor(d.ms); return `<${d.id ? `button class="li" data-a="deckOpen" data-id="${esc(d.id)}"` : `div class="li"`}><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${x.games} game${x.games === 1 ? "" : "s"} · ${x.w}-${x.l} · ${signed(x.cubes)} cubes</div></div>${d.id ? `<span class="muted">›</span></button>` : "</div>"}`; }).join("")}</div>` : ""}
      ${evs.length ? `<span class="eyebrow">Events</span><div class="chiplist">${evs.map((e) => `<span class="pill">${esc(e.name)}</span>`).join("")}</div>` : ""}
      ${!has ? `<div class="empty"><strong>Nothing from this month</strong><span>Your data copy has no season pass record for it, and no matches were tracked then.</span></div>` : !st.games ? `<p class="muted small">No matches were tracked in SNAP Stat this month${s ? " season" : ""}.</p>` : ""}
      <div class="row">${s ? `<button class="btn" data-a="histSeason" data-id="${esc(s.id)}">Open the season</button>` : ""}${st.games ? `<button class="btn" data-a="histMatches">See the matches</button>` : ""}<button class="btn snap" data-a="close">Done</button></div>
    </div>`;
}
Object.assign(A, {
  histMonth: (el) => { histMonthKey = el.dataset.k; openSheet(histMonthSheet); },
  histSeason: (el) => { closeSheet(); A.seasonOpen && A.seasonOpen(el); },
  histMatches: () => { closeSheet(); go("home/matches"); },
});
EXT.styles.push(`
.hist-m { border: 0; font: inherit; cursor: pointer; min-height: 36px; padding-inline: 12px; }
.hist-m:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.hm-art { margin: -4px 0 10px; border-radius: 12px; overflow: hidden; }
.hm-art img, .hm-art .sart { width: 100%; height: auto; max-height: 160px; object-fit: cover; display: block; border-radius: 12px; }`);
