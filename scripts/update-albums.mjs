// Builds albums.json: every variant album (its variants and the rewards for collecting them), plus the list of
// card split finishes, from snap.fan. Album pages don't change once they're out, so only new albums (and ones
// from the last two months) are read again.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.SCHEDULE_SOURCE || "https://snap.fan";
const OUT = "albums.json";
const UA = "Mozilla/5.0 (compatible; SNAP-Stat-card-updater/1.0)";
const DELAY = Number(process.env.VARIANT_DELAY || 700);
const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

async function get(path) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(45000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${path} answered ${res.status}`);
      return await res.text();
    } catch (e) { console.log(`Attempt ${attempt} for ${path} failed: ${e.message}`); await sleep(4000 * attempt); }
  }
  return null;
}
function isoDate(text) {
  const m = String(text || "").match(/([A-Za-z]+) (\d{1,2}), (\d{4})/); if (!m) return "";
  const mi = MONTHS.indexOf(m[1].toLowerCase()); return mi < 0 ? "" : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

let prev = { albums: {}, splits: [] };
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* start fresh */ } }
const albums = { ...(prev.albums || {}) };

const list = await get("/albums/");
if (!list) throw new Error("Couldn't load the album list.");
const listed = new Map([...list.matchAll(/data-album-key="([^"]+)"[\s\S]*?font-ultimatum[^>]*>([^<]+)</g)].map((m) => [m[1], strip(m[2])]));
const keys = [...listed.keys()];
console.log(`${keys.length} albums listed.`);
const recent = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
let read = 0;
for (const key of keys) {
  const old = albums[key];
  if (old && old.variants && old.variants.length && (!old.date || old.date < recent)) { if (listed.get(key)) old.name = listed.get(key); continue; }
  const page = await get(`/albums/${encodeURIComponent(key)}/`); await sleep(DELAY);
  if (!page) continue;
  const main = (page.match(/<main[\s\S]*?<\/main>/) || [page])[0];
  const name = listed.get(key) || strip((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]) || key;
  const [varPart, rewardPart = ""] = main.split(/<h2[^>]*>\s*Rewards/);
  const variants = [...new Set([...varPart.matchAll(/href="\/cards\/[A-Za-z0-9]+\/([A-Za-z0-9]+_\d+)\/"/g)].map((m) => m[1]))];
  const rewards = rewardPart.split(/<span class="font-ultimatum text-lg text-white">/).slice(1).map((blk) => {
    const at = strip(blk.split("</span>")[0]);
    const items = [...blk.matchAll(/<div class="truncate[^"]*">([^<]+)<\/div>\s*<div class="text-xs[^"]*">([^<]+)<\/div>/g)].map((m) => ({ name: strip(m[1]), type: strip(m[2]) }));
    const extra = items.length ? [] : [strip(blk.replace(/^[^<]*<\/span>/, "")).replace(/^Collected\s*/, "").slice(0, 80)].filter(Boolean).map((n) => ({ name: n, type: "" }));
    return { at, items: [...items, ...extra] };
  });
  albums[key] = { name, date: isoDate(strip(main)), variants, rewards };
  read++;
}
console.log(`Read ${read} album pages.`);

// Split finishes (the surface effects a card can unlock as you upgrade it).
let splits = prev.splits || [];
const sp = await get("/cosmetics/split-effects/");
if (sp) {
  const found = [...sp.matchAll(/href="\/cosmetics\/split-effects\/[^"]+"[\s\S]*?font-ultimatum[^>]*>([^<]+)<\/div>\s*(?:<div[^>]*>([^<]*)<\/div>)?\s*(?:<div[^>]*>([^<]*)<\/div>)?/g)]
    .map((m) => ({ name: strip(m[1]).replace(/([a-z])([A-Z])/g, "$1 $2"), rarity: strip(m[2] || ""), source: strip(m[3] || "") }));
  if (found.length > 10) splits = found;
}
console.log(`${splits.length} split finishes.`);

if (Object.keys(albums).length < 10) throw new Error("Too few albums came through, so the file was left as it was.");
const body = JSON.stringify({ albums, splits });
if (JSON.stringify({ albums: prev.albums || {}, splits: prev.splits || [] }) === body) { console.log("No changes since last time."); process.exit(0); }
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "snap.fan albums and split effects", albums, splits }));
console.log(`Saved ${OUT}.`);
