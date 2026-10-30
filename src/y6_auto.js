/* ============ More filled in from screenshots: albums, the game's missions, and the shop's daily freebies ============ */

/* ---------- Variant albums ---------- */
function albumByName(name) {
  if (!ALB) return null;
  const k = keyOf(name); if (!k) return null;
  const all = Object.entries(ALB.albums);
  const hit = all.find(([, a]) => keyOf(a.name) === k) || all.find(([, a]) => k.length > 5 && (keyOf(a.name).includes(k) || k.includes(keyOf(a.name))));
  return hit ? hit[0] : null;
}
// The game's own count for an album (from a screenshot), when it says more than the variants you've ticked.
function albumGameNote(a) {
  const g = obj(obj(S.albumProg)[a.key]); if (!g.of) return "";
  return g.have !== a.have ? `The game says ${g.have}/${g.of}${g.have > a.have ? ` · ${g.have - a.have} more to tick` : ""}` : "";
}
async function applyShotAlbum(x, al, time, img) {
  if (!ALB) { x.status = "An album screen, but the album list hasn't loaded yet. Try again in a moment."; return; }
  const before = clone(obj(S.albumProg)), P = (S.albumProg = obj(S.albumProg)), done = [], vars = [];
  const n = (v) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
  let listed = 0;
  for (const a of arr(al.albums).slice(0, 40)) { const k = albumByName(obj(a).name); if (k && n(a.have) !== null && n(a.of)) { P[k] = { have: Math.min(n(a.have), n(a.of)), of: n(a.of), at: time }; listed++; } }
  if (listed) done.push(`${listed} album${listed === 1 ? "" : "s"}' progress`);
  if (al.name) {
    const k = albumByName(al.name);
    if (k) {
      if (n(al.have) !== null && n(al.of)) P[k] = { have: Math.min(n(al.have), n(al.of)), of: n(al.of), at: time };
      const info = albumInfo(k), inAlbum = info.vars.filter((vv) => vv.v);
      const tick = (v) => { const real = v && v.virtual ? materializeVar(v.id) : v; if (real && setVarOwned(real, true, "album")) vars.push(real.id); };
      // Albums of one character (all Miles Morales, say) can't be told apart by card name: compare the pictures instead.
      const sameCard = new Set(inAlbum.map((vv) => vv.v.card)).size < inAlbum.length;
      let byPicture = false;
      if (sameCard && img && store.sample) {
        const cands = inAlbum.map((vv) => vv.v), sheet = await variantContactSheet(cands).catch(() => null);
        if (sheet) {
          try {
            const r = obj(await store.sample.json(`The first picture is a MARVEL SNAP screenshot of the "${info.name}" variant album. The second is a numbered sheet of every variant in that album (the number is under each one). For each variant picture in the screenshot, find it on the sheet by its art and say whether the player has it: ones they have look normal, missing ones are greyed out, dark or locked. Only include pictures you can match. Reply as JSON: {"items": [{"n": number, "owned": true | false}]}`, { images: [img, sheet], modelTier: "default" }));
            for (const it of arr(r.items)) if (obj(it).owned) tick(cands[num(obj(it).n) - 1]);
            byPicture = true;
          } catch { /* fall back to names */ }
        }
      }
      if (!byPicture) for (const c of arr(al.cards).slice(0, 30)) {
        if (!obj(c).owned) continue;
        const ck = (fuzzyCard(c.card) || {}).key; if (!ck) continue;
        const cand = inAlbum.filter((vv) => vv.v.card === ck);
        let hit = cand.length === 1 ? cand[0] : null;
        if (cand.length > 1 && (c.variant || c.artist)) { const mv = matchVariant(ck, c.variant, c.artist); hit = mv ? cand.find((vv) => (mv.cat && vv.v.cat === mv.cat) || vv.v.id === mv.id) : null; }
        if (hit) tick(hit.v);
      }
      done.push(`${info.name}${P[k] ? ` ${P[k].have}/${P[k].of}` : ""}`);
      if (vars.length) done.push(`${vars.length} variant${vars.length === 1 ? "" : "s"} ticked as owned`);
    } else if (!listed) { x.status = "An album I couldn't find in the album list"; x.detail = String(al.name).slice(0, 60); return; }
  }
  if (!done.length) { x.status = "An albums screen, but nothing I could read"; return; }
  x.status = "Albums updated"; x.detail = done.join(" · "); x.undo = { type: "album", before, vars }; save();
}

/* ---------- The game's missions (daily and season) ---------- */
function applyShotMissions(x, m, time) {
  const n = (v) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(String(v).replace(/,/g, ""))) ? Math.max(0, Math.round(Number(String(v).replace(/,/g, "")))) : null);
  // The weekly or another tab's list isn't today's missions
  const tab = m.tab === "season" ? "season" : !m.tab || m.tab === "daily" ? "daily" : "";
  const items = arr(m.items).map((i) => { const o = obj(i), p = n(o.progress), g = n(o.goal); return { text: String(o.text || "").trim().slice(0, 90), progress: p, goal: g, reward: String(o.reward || "").slice(0, 40), done: !!o.done || (g ? num(p) >= g : false) }; }).filter((i) => i.text).slice(0, 14);
  const before = clone(S.gameMissions || null), G = (S.gameMissions = obj(S.gameMissions)), left = parseLeft(m.refreshIn);
  const more = applyChallenges(G, m, time);
  if ((!items.length || !tab) && !more.length) { S.gameMissions = before; x.status = "A missions screen, but nothing I could read"; return; }
  if (items.length && tab) G[tab] = { items, at: time, day: gameDay(time), refreshAt: left > 0 && left < 40 * DAY ? time + left : 0 };
  // Every daily mission done: tick "Finish today's missions" on your checklist too
  if (tab === "daily" && items.length && items.every((i) => i.done) && gameDay(time || Date.now()) === missionDay()) {
    const mi = missionState(), first = mi.items.find((i) => /mission/i.test(i.text));
    if (first && !mi.done.includes(first.id)) S.missions = { ...obj(S.missions), items: mi.items, done: { day: missionDay(), ids: [...mi.done, first.id] } };
  }
  const d = items.filter((i) => i.done).length;
  x.status = items.length ? `${tab === "season" ? "Season" : "Daily"} missions updated` : "Missions updated"; x.detail = [items.length ? `${d} of ${items.length} done` : "", ...more].filter(Boolean).join(" · "); x.undo = { type: "missions", before }; save();
}
function gameMissionsHtml() {
  const G = obj(S.gameMissions), today = gameDay();
  const daily = obj(G.daily).day === today ? G.daily : null, oldDaily = daily && num(daily.refreshAt) && daily.refreshAt < Date.now(), season = G.season && (!currentSeason() || num(G.season.at) >= currentSeason().startTs) ? G.season : null;
  if (!daily && !season) return "";
  const row = (i) => `<div class="stack" style="gap:3px"><div class="row between nowrap small"><span class="${i.done ? "muted" : ""}">${i.done ? "✓ " : ""}${esc(i.text)}</span>${i.goal ? `<span class="num muted">${fmt(Math.min(num(i.progress), i.goal))}/${fmt(i.goal)}</span>` : ""}</div>${i.goal && !i.done ? progBar(num(i.progress), i.goal, `${num(i.progress)} of ${i.goal}`) : ""}${i.reward && !i.done ? `<span class="muted small">${esc(i.reward)}</span>` : ""}</div>`;
  const part = (label, g) => g ? `<div class="stack" style="gap:8px"><div class="row between small"><b>${label}</b><span class="muted">${g.items.filter((i) => i.done).length}/${g.items.length} done · ${esc(agoTxt(g.at))}</span></div>${g.items.map(row).join("")}</div>` : "";
  return `<div class="panel stack small gmis">${part(oldDaily ? "Missions before the last refresh" : "Today's missions", daily)}${part("Season missions", season)}
    <span class="muted small">From your screenshots of the game's Missions screen${natCan("trackAndPlay") ? " (the tracker saves it while you play)" : ""}.</span></div>`;
}

/* ---------- The shop's daily freebies ---------- */
function freebiesHtml() {
  const out = [], now = Date.now(), gd = gameDay();
  const ft = obj(S.freeTokens);
  if (ft.at) out.push(ft.claimed === gd ? `<span class="pill W">✓ Free tokens claimed</span>` : obj(S.freeTokens).at && gameDay(ft.at) === gd ? `<span class="pill gold">Free tokens to claim</span>` : "");
  const fc = obj(S.freeCredits);
  // "Ready" only while that's still likely (a day later, you've probably claimed it)
  if (fc.nextAt) out.push(fc.nextAt > now ? `<span class="pill dim">Free credits in ${cdSpan(fc.nextAt)}</span>` : now - fc.nextAt < 8 * 3600e3 ? `<span class="pill gold">Free credits ready</span>` : "");
  const gp = obj(S.goldPass);
  // Days left go down at the daily reset, not 24 hours after the screenshot
  const lastReset = (t) => { const h = RESET_UTC_HOUR * 3600e3; return Math.floor((t - h) / DAY) * DAY + h; };
  if (gp.days) { const left = Math.max(0, gp.days - Math.round((lastReset(now) - lastReset(num(gp.at))) / DAY)); if (left > 0) out.push(`<span class="pill ${left <= 3 ? "gold" : "dim"}">Gold Pass: ${left} day${left === 1 ? "" : "s"} left</span>`);
    if (gp.claimAt && left > 0) out.push(gp.claimAt > now ? `<span class="pill dim">Gold Pass gold in ${cdSpan(gp.claimAt)}</span>` : now - gp.claimAt < DAY ? `<span class="pill gold">Gold Pass gold ready</span>` : ""); }
  const list = out.filter(Boolean);
  return list.length ? `<div class="chiplist">${list.join("")}</div>` : "";
}

/* ---------- Once: an event level that was really the season pass level ---------- */
// Before October 29, 2026 the home screen (season pass level beside the event's banner) could be read as the event's level.
setTimeout(() => whenDataReady(() => { try {
  if (obj(S.fixes).evlv) return;
  const cs = currentSeason(), lv = cs ? num(obj(S.passes[cs.id]).level) : 0; let changed = false;
  if (lv) for (const pr of Object.values(obj(S.eventProg))) if (pr && num(pr.level) === lv && !num(pr.xpNext) && !arr(pr.ms).length) { delete pr.level; changed = true; }
  S.fixes = { ...obj(S.fixes), evlv: 1 }; save(); if (changed) render();
} catch { /* next time */ } }), 2500);
