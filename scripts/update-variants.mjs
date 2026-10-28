// Builds variant-details.json: for every variant, its name, artists, rarity, vault tier, where it comes from
// (General Pool, Token Shop, Bundle, Season Pass, Spotlight, an event shop...) and when it came out,
// from the variant gallery on each card's snap.fan page. The first run reads every card (about ten minutes);
// after that it rereads cards with new variants, recent ones, and a few of the oldest each day.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.SCHEDULE_SOURCE || "https://snap.fan";
const OUT = "variant-details.json";
const UA = "Mozilla/5.0 (compatible; SNAP-Stat-card-updater/1.0)";
const DELAY = Number(process.env.VARIANT_DELAY || 700);
const BUDGET_MS = Number(process.env.VARIANT_BUDGET_MS || 25 * 60e3); // stop early so the job never times out
const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();

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

// Cards to read: every card in the card data that has variants.
const cards = JSON.parse(readFileSync("card-data.json", "utf8")).cards.filter((c) => c.id && (c.variants || []).length);
let prev = { variants: {}, cards: {} };
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* start fresh */ } }
const variants = { ...(prev.variants || {}) }, seen = { ...(prev.cards || {}) };

const today = new Date().toISOString().slice(0, 10), recentCut = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
const due = cards.filter((c) => {
  const s = seen[c.id];
  if (!s) return true; // never read
  if (!s.img && s.found) return true; // read before pictures were kept
  if (s.count !== c.variants.length) return true; // a variant was added or removed
  if (!s.found) return s.at < today; // the page had no gallery last time; try again
  if (c.variants.some((v) => v.unreleased || (v.release && v.release >= recentCut))) return s.at < today; // new ones change details
  return false;
});
// Plus a few of the longest-unread cards, so everything stays fresh over time.
const rest = cards.filter((c) => !due.includes(c)).sort((a, b) => String((seen[a.id] || {}).at || "").localeCompare(String((seen[b.id] || {}).at || ""))).slice(0, 15);
const queue = [...due, ...rest];
console.log(`Reading ${queue.length} card pages (${due.length} due, ${rest.length} refresh).`);

let read = 0;
for (const c of queue) {
  if (Date.now() - started > BUDGET_MS) { console.log("Out of time for today; the rest will be read next run."); break; }
  const page = await get(`/cards/${c.id}/`); await sleep(DELAY);
  if (!page) continue;
  let n = 0;
  for (const block of page.split('<li class="group overflow-hidden').slice(1)) {
    const id = (block.match(/href="\/cards\/[A-Za-z0-9]+\/([A-Za-z0-9]+_\d+)\/"/) || [])[1];
    if (!id) continue;
    const field = (label) => strip((block.match(new RegExp(`>${label}: <\\/span>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>\\s*<\\/div>`)) || [])[1]);
    const name = strip((block.match(/font-ultimatum[^>]*>\s*<a [^>]*>([\s\S]*?)<\/a>/) || [])[1]);
    const artists = [...block.matchAll(/href="\/artists\/[^"]+"[^>]*>([^<]+)<\/a>/g)].map((m) => strip(m[1]));
    // The card picture on snap.fan's image server (it allows other sites to read it, which the app needs to compare variants with a screenshot).
    const pic = (block.match(/card_variant_images\/([A-Za-z0-9_]+-[0-9a-f]{16,}\.webp)/) || [])[1];
    const d = { n: name, s: field("Source"), r: field("Rarity"), t: field("Vault Tier"), d: field("Released"), a: [...new Set(artists)].join(" & "), i: pic || "" };
    for (const k of Object.keys(d)) if (!d[k] || d[k] === "Unknown") delete d[k];
    variants[id] = d; n++;
  }
  seen[c.id] = { count: c.variants.length, found: n, at: today, img: 1 };
  read++;
}
console.log(`Read ${read} pages. ${Object.keys(variants).length} variants have details.`);
if (Object.keys(variants).length < Number(process.env.VARIANT_MIN || 100)) throw new Error("Too few variant details came through, so the file was left as it was.");

const body = JSON.stringify(variants);
if (JSON.stringify(prev.variants || {}) === body && read === 0) { console.log("No changes since last time."); process.exit(0); }
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "snap.fan variant galleries", format: { n: "name", s: "source", r: "rarity", t: "vault tier", d: "released", a: "artists", i: "picture at https://game-assets.snap.fan/card_variant_images/" }, variants, cards: seen }));
console.log(`Saved ${OUT}.`);
