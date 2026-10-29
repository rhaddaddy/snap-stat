// Builds packs.json: the Card Shop's Snap Packs from snap.fan, with their token prices, dates and what's in them.
// Seasonal Series 4 and 5 packs list cards; special packs list variants.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.SCHEDULE_SOURCE || "https://snap.fan";
const OUT = "packs.json";
const UA = "Mozilla/5.0 (compatible; SNAP-Stat-card-updater/1.0)";
const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const isoDate = (t) => { const m = String(t || "").match(/([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})/); if (!m) return ""; const mi = MONTHS.indexOf(m[1].toLowerCase()); return mi < 0 ? "" : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`; };

async function get(path) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(45000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${path} answered ${res.status}`);
      return await res.text();
    } catch (e) { console.log(`Attempt ${attempt} for ${path} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 4000 * attempt)); }
  }
  return null;
}

const page = await get("/packs/");
if (!page) throw new Error("Couldn't load the packs page.");
const main = (page.match(/<main[\s\S]*?<\/main>/) || [page])[0];
const packs = [];
for (const blk of main.split('<div class="pack-card ').slice(1)) {
  const name = strip((blk.match(/pack-card__name-text[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
  if (!name) continue;
  const slug = (blk.match(/href="\/packs\/([^"/]+)\/"/) || [])[1] || name.replace(/\W+/g, "");
  const dates = strip((blk.match(/pack-card__date[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
  const [start, end] = dates.split(/[–-]\s/).map(isoDate);
  const price = Number(strip((blk.match(/collector-token-price__value[^>]*>([\s\S]*?)<\/span>/) || [])[1]).replace(/[^\d]/g, "")) || 0;
  const value = Number(strip((blk.match(/pack-card__cost-percent-value[^>]*>([\s\S]*?)<\/span>/) || [])[1]).replace(/[^\d]/g, "")) || 0;
  const cards = [], variants = [];
  for (const m of blk.matchAll(/href="\/cards\/([A-Za-z0-9]+)\/([A-Za-z0-9_]+)\/"/g)) {
    if (m[2] === m[1]) { if (!cards.includes(m[1])) cards.push(m[1]); }
    else if (/_\d+$/.test(m[2]) && !variants.includes(m[2])) variants.push(m[2]);
  }
  const series = (name.match(/Series (\d)/) || [])[1] || "";
  packs.push({ slug, name, kind: /^Seasonal Series/.test(name) ? "seasonal" : "special", series, start: start || "", end: end || "", price, value, cards, variants });
}
console.log(`${packs.length} packs: ${packs.map((p) => `${p.name} (${p.cards.length + p.variants.length})`).join(", ")}`);
if (packs.length < 2 || !packs.some((p) => p.kind === "seasonal" && p.cards.length)) throw new Error("The packs page didn't look right, so the file was left as it was.");

let prev = null; if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { prev = null; } }
if (prev && JSON.stringify(prev.packs) === JSON.stringify(packs)) { console.log("No changes since last time."); process.exit(0); }
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "snap.fan packs", oldPacks: { 5: 4000, 4: 2000, 3: 650 }, direct: { 5: 6000, 4: 3000 }, packs }));
console.log(`Saved ${OUT}.`);
