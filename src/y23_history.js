/* ============ Your MARVEL SNAP history, from the data copy you asked Second Dinner for ============
   The data request arrives as a zip ("copy report"). Its Braze/Braze.json holds the game's own milestone events with the first and
   last time each happened: every season pass you took to level 25 and 50, Infinite, 8-cube wins, new cards unlocked, the tutorial.
   SNAP Stat reads ONLY those milestone names, dates and counts and the game's list of your top cards. The same file also has your
   email, devices, push tokens, purchases and spending: none of that is read, kept or sent anywhere. */
const HIST_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// The three name formats, e.g. "Season019December2023_level_50", "April2026SeasonPassLevel50", "Season036May2025SeasonPassLevel25"
const HIST_PASS = new RegExp(`^(?:Season\\d{3})?(${HIST_MONTHS.join("|")})(\\d{4})(?:SeasonPass)?_?level_?(25|50)$`, "i");
const histDay = (s) => { const t = Date.parse(String(s || "")); return Number.isFinite(t) && t > Date.UTC(2022, 0, 1) && t < Date.now() + DAY ? new Date(t).toISOString().slice(0, 10) : ""; };

// The smallest zip reader that covers what a data request zip uses: stored or deflated entries, found through the central directory
async function unzipEntries(buf, want) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), out = {};
  let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip");
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < n && p + 46 <= u8.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + xlen + clen;
    if (!want(name) || csize > 30e6) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = u8.subarray(start, start + csize);
    if (method === 0) out[name] = new TextDecoder().decode(raw);
    else if (method === 8 && typeof DecompressionStream === "function") out[name] = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}
// Braze.json (as it comes, with the profile as a JSON string inside "brazeData", or already unwrapped) → the milestones only
function readHistory(text) {
  let j; try { j = JSON.parse(String(text || "").replace(/^﻿/, "")); } catch { return null; }
  if (j && typeof j.brazeData === "string") { try { j = JSON.parse(j.brazeData); } catch { return null; } }
  const evs = arr(obj(j).custom_events).filter((e) => e && typeof e.name === "string" && !/purchase|revenue|subscribe|email/i.test(e.name));
  if (!evs.length) return null;
  const h = { passes: {}, counts: {}, firsts: {}, lasts: {}, top: [] };
  const ev = (name) => evs.find((e) => e.name === name);
  for (const e of evs) {
    const m = e.name.match(HIST_PASS); if (!m) continue;
    const mi = HIST_MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()), key = `${m[2]}-${String(mi + 1).padStart(2, "0")}`, d = histDay(e.first);
    if (!d) continue; const slot = (h.passes[key] = h.passes[key] || ["", ""]), i = m[3] === "50" ? 1 : 0; if (!slot[i] || d < slot[i]) slot[i] = d;
  }
  const take = (id, name) => { const e = ev(name); if (!e) return; const c = Math.round(Number(e.count)); if (Number.isFinite(c) && c > 0 && c < 1e6) h.counts[id] = c; const f = histDay(e.first), l = histDay(e.last); if (f) h.firsts[id] = f; if (l) h.lasts[id] = l; };
  take("infinite", "SeasonInfinite"); take("eightCube", "First8CubeWin"); take("passDone", "CompleteSeasonPass"); take("newCards", "UnlockNewlyReleasedCard");
  take("draft", "DraftModePlayed"); take("split", "InfinitySplit"); take("review", "Review_Submitted_Positive");
  // When you started: the tutorial if it's there, otherwise the earliest milestone
  const t1 = ev("Tutorial_1"); h.since = histDay(t1 && t1.first) || evs.map((e) => histDay(e.first)).filter(Boolean).sort()[0] || "";
  h.top = arr(obj(obj(j).custom_attributes).top_cards).filter((x) => typeof x === "string" && /^[A-Za-z0-9]+$/.test(x)).slice(0, 10);
  h.any = Object.keys(h.passes).length > 0 || Object.keys(h.counts).length > 0;
  return h.any ? h : null;
}
// Read a picked file (the zip, or Braze.json on its own) and keep the result
async function importHistoryFile(file) {
  let text = "";
  if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
    const got = await unzipEntries(await file.arrayBuffer(), (n) => /(^|\/)Braze\.json$/i.test(n));
    text = Object.values(got)[0] || "";
    if (!text) { toast(typeof DecompressionStream === "function" ? "That zip doesn't have the Braze.json file the history comes from." : "This browser can't open zip files. Unzip it and choose Braze/Braze.json instead."); return; }
  } else text = await file.text();
  const h = readHistory(text);
  if (!h) { toast("That doesn't look like a MARVEL SNAP data copy. Choose the zip you got, or the Braze.json inside it."); return; }
  const top = h.top.map((id) => (typeof cardByDefId === "function" ? cardByDefId(id) : null)).filter(Boolean).map((c) => c.key);
  S.history = { at: Date.now(), since: h.since, passes: h.passes, counts: h.counts, firsts: h.firsts, lasts: h.lasts, top };
  // Infinite in the history counts for your all-time best, even from seasons SNAP Stat never saw
  if (h.counts.infinite && typeof rankFromStr === "function" && rankFromStr(S.me.peakAll) < 100) {
    S.me.peakAll = "Infinite"; const d = h.firsts.infinite, s = d && seasons().find((x) => x.start && x.start.slice(0, 7) === d.slice(0, 7)); S.me.peakAllSeason = s ? s.name : dateStr(d);
  }
  save(); render();
  const n = Object.values(h.passes).filter((p) => p[1]).length;
  toast(`History read: ${n} season pass${n === 1 ? "" : "es"} finished${h.counts.infinite ? ", Infinite" : ""}${h.since ? `, playing since ${dateStr(h.since)}` : ""}.`);
}
document.addEventListener("change", async (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.histfile) return;
  const f = t.files && t.files[0]; t.value = ""; if (!f) return;
  try { await importHistoryFile(f); } catch (err) { console.error("history", err); toast("Couldn't read that file."); }
});

function histPanel() {
  const H = obj(S.history);
  return `<section class="sec"><h2>Your MARVEL SNAP history</h2><div class="panel stack small">
    <p>MARVEL SNAP lets you ask for a copy of your data. Choose the zip you get (or the <b>Braze.json</b> inside it) to bring in every season pass you finished, when you hit Infinite, your 8-cube wins and when you started playing.</p>
    <label class="btn">${H.at ? "Read a newer copy" : "Choose the data copy"}<input type="file" accept=".zip,.json,application/zip,application/json" data-histfile="1" hidden></label>
    <span class="muted">Only those milestone dates and counts are kept. The file also has your email, devices and purchases: SNAP Stat never reads, saves or sends them.${H.at ? ` Last read ${esc(agoTxt(H.at))}.` : ""}</span></div></section>`;
}
EXT.settingsData.push(histPanel);

// Profile: the timeline
function histHtml() {
  const H = obj(S.history); if (!H.at) return "";
  const P = obj(H.passes), C = obj(H.counts), F = obj(H.firsts), keys = Object.keys(P).sort();
  const done = keys.filter((k) => P[k][1]), years = H.since ? Math.floor((Date.now() - Date.parse(H.since)) / (365.25 * DAY)) : 0;
  const monthLbl = (k) => { const [y, m] = k.split("-"); return `${HIST_MONTHS[Number(m) - 1].slice(0, 3)} ${y.slice(2)}`; };
  const seasonOf = (k) => seasons().find((s) => s.start && s.start.slice(0, 7) === k);
  // Every month from the first season in the history to now: finished (50), halfway (25) or no record
  const months = []; if (keys.length) { let [y, m] = keys[0].split("-").map(Number); const end = new Date(); while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth() + 1)) { months.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } if (months.length > 120) break; } }
  const cell = (k) => { const p = P[k] || ["", ""], s = seasonOf(k), st = p[1] ? "W" : p[0] ? "warn" : "dim"; return `<button class="pill ${st} hist-m" data-a="histMonth" data-k="${esc(k)}" aria-label="${esc(monthLbl(k) + ": " + (s ? s.name + ", " : "") + (p[1] ? "level 50 on " + dateStr(p[1]) : p[0] ? "level 25 on " + dateStr(p[0]) : "no record"))}">${esc(monthLbl(k))}</button>`; };
  const tiles = [
    H.since ? [dateStr(H.since), years >= 1 ? `playing for ${years} year${years === 1 ? "" : "s"}` : "when you started"] : null,
    [fmt(done.length), `season pass${done.length === 1 ? "" : "es"} finished`],
    C.infinite ? ["Infinite", `${C.infinite > 1 ? fmt(C.infinite) + " times, first " : ""}${esc(dateStr(F.infinite))}`] : null,
    C.eightCube ? [fmt(C.eightCube), "8-cube wins"] : null,
    C.newCards ? [fmt(C.newCards), `new cards unlocked since ${esc(dateStr(F.newCards))}`] : null,
    C.draft ? [fmt(C.draft), "draft-mode games"] : null,
  ].filter(Boolean);
  const top = arr(H.top).filter((k) => !card(k).unknown);
  return `<section class="sec"><div class="sec-h"><h2>Your SNAP history</h2><span class="muted small">from your data copy</span></div>
    <div class="tiles">${tiles.map(([v, k]) => `<div class="tile"><div class="v num">${esc(v)}</div><div class="k">${k}</div></div>`).join("")}</div>
    ${months.length ? `<div class="panel stack small"><span class="eyebrow">Season passes</span><div class="chiplist">${months.map(cell).join("")}</div><span class="muted">Green: level 50 · yellow: level 25 · grey: no record. Tap a month to see everything from it.</span></div>` : ""}
    ${top.length ? `<div class="panel stack small"><span class="eyebrow">The game's list of your top cards</span><div class="chiplist">${top.map((k) => cardChip(k, { noOwn: true, size: "xs" })).join("")}</div></div>` : ""}
    ${F.split ? `<p class="muted small">First Infinity Split: ${esc(dateStr(F.split))}.${F.eightCube ? ` First 8-cube win: ${esc(dateStr(F.eightCube))}.` : ""}</p>` : ""}</section>`;
}
EXT.profile.push(histHtml);
EXT.search.push((q) => (/histor|data copy|data request|braze|since/i.test(q) ? [{ label: "Your MARVEL SNAP history", sub: "Settings › Import & backup", route: "settings/data" }] : []));
