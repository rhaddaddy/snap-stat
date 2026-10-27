// Builds balance-history.json: every time a collectible card's cost, power or ability changed,
// from snap.fan's card history pages. The first run reads every year; after that, just this year.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.SCHEDULE_SOURCE || "https://snap.fan";
const OUT = "balance-history.json";
const UA = "Mozilla/5.0 (compatible; SNAP-Stat-card-updater/1.0)";
const MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const strip = (s) => String(s ?? "").replace(/<\/?(?:span|b|i|em|strong|a)\b[^>]*>/gi, "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "").replace(/\s+/g, " ").replace(/\s+([.,:;!?)])/g, "$1").replace(/^!+\s*/, "").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");

async function get(path) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${path} answered ${res.status}`);
      return await res.text();
    } catch (e) { console.log(`Attempt ${attempt} for ${path} failed: ${e.message}`); await sleep(4000 * attempt); }
  }
  return null;
}

// Only cards people can collect (not game-mode versions, tokens or unreleased ones).
const keep = new Set();
try { for (const c of JSON.parse(readFileSync("card-data.json", "utf8")).cards) if (c.id && /^released$/i.test(c.status) && c.source && !/^none$|not available|token/i.test(c.source)) keep.add(c.id); } catch { /* keep everything */ }

let prev = { entries: [] };
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* start fresh */ } }
const now = new Date(), year = now.getUTCFullYear();
const years = prev.entries && prev.entries.length ? [year, ...(now.getUTCMonth() === 0 ? [year - 1] : [])] : Array.from({ length: year - 2021 }, (_, i) => 2022 + i);

const found = [];
for (const y of years) {
  const page = await get(y === year ? "/cards/history/" : `/cards/history/${y}/`); await sleep(1000);
  if (!page) { console.log(`No history page for ${y}.`); continue; }
  let curYear = y, curDate = "";
  const re = /<h2 id="history-([A-Za-z]+) (\d{4})"|<h3[^>]*>\s*([A-Za-z]{3}) (\d{1,2})\s*<\/h3>|<li class="snap-history-row[^"]*"[^>]*>\s*<a href="\/cards\/([A-Za-z0-9]+)\/"[^>]*>[\s\S]*?<\/a>\s*<span[^>]*>\s*\((-?\d+|\?)\/(-?\d+|\?)\)\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/li>/g;
  for (const m of page.matchAll(re)) {
    if (m[1]) { curYear = Number(m[2]); continue; }
    if (m[3]) { const mi = MON3.indexOf(m[3].toLowerCase()); if (mi >= 0) curDate = `${curYear}-${pad(mi + 1)}-${pad(m[4])}`; continue; }
    if (!curDate || (keep.size && !keep.has(m[5]))) continue;
    if (m[6] === "0" && m[7] === "0" && !strip(m[8])) continue; // a placeholder before the card was finished
    found.push([curDate, m[5], m[6] === "?" ? "" : Number(m[6]), m[7] === "?" ? "" : Number(m[7]), strip(m[8])]);
  }
}
console.log(`Read ${found.length} card changes from ${years.join(", ")}.`);
if (!found.length && !(prev.entries || []).length) throw new Error("No card history came through.");

// Merge with what we had, one entry per card per day.
const all = new Map();
for (const e of [...(prev.entries || []), ...found]) all.set(e[0] + "|" + e[1], e);
const entries = [...all.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
const body = JSON.stringify(entries);
if (JSON.stringify(prev.entries || []) === body) { console.log("No changes since last time."); process.exit(0); }
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "snap.fan card history", format: ["date", "cardId", "cost", "power", "ability"], entries }));
console.log(`Saved ${OUT}: ${entries.length} entries.`);
