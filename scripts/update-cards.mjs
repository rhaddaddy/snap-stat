// Downloads every MARVEL SNAP card and variant from Marvel Snap Zone and saves a small copy
// as card-data.json, which the app reads for card art, card details and the full variant list.
// GitHub runs this once a day (see .github/workflows/update-cards.yml). Needs Node 18 or newer.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SOURCE = process.env.CARD_SOURCE || "https://marvelsnapzone.com/getinfo/?searchtype=cards&searchcardstype=true";
const OUT = "card-data.json";
const SAMPLE = "card-data-sample.json";

const strip = (s) => String(s ?? "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();
const pick = (o, ...keys) => { for (const k of keys) { const v = o && o[k]; if (v !== undefined && v !== null && v !== "") return v; } return ""; };
const numOr = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? "" : Number(v));

async function download() {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(SOURCE, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SNAP-Stat-card-updater/1.0)", Accept: "application/json,text/plain,*/*" } });
      if (!res.ok) throw new Error(`Marvel Snap Zone answered ${res.status} ${res.statusText}`);
      const text = await res.text();
      try { return JSON.parse(text); } catch { throw new Error("Marvel Snap Zone didn't send JSON. It started with: " + text.slice(0, 200)); }
    } catch (e) { last = e; console.log(`Attempt ${attempt} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 5000 * attempt)); }
  }
  throw last;
}

function trimVariant(v, i, cardId) {
  const people = [pick(v, "sketcher", "artist"), pick(v, "inker"), pick(v, "colorist")].map(strip).filter(Boolean);
  const desc = strip(pick(v, "full_description", "description"));
  const by = desc.match(/\bby ([^.;]+)/i);
  const from = desc.match(/\bfrom (.+?)(?: by |$)/i);
  return {
    id: String(pick(v, "vid", "id", "art_filename") || `${cardId}-${i + 1}`),
    art: String(pick(v, "art", "image", "img")),
    name: strip(pick(v, "name", "title", "variant_name")) || (from && from[1].length <= 60 ? from[1].trim() : ""),
    artist: [...new Set(people)].join(" & ") || (by ? by[1].trim() : ""),
    rarity: strip(pick(v, "rarity", "rarity_name")),
    status: strip(pick(v, "status")),
    order: numOr(pick(v, "variant_order", "order")) || i + 1,
    release: String(pick(v, "release_date", "releaseDate", "ReleaseDate", "date")).slice(0, 10),
  };
}

function trimCard(c) {
  const id = String(pick(c, "carddefid", "defId", "defid", "CardDefId", "cardDefId", "card_def_id"));
  return {
    id,
    name: strip(c.name),
    type: strip(pick(c, "type")),
    cost: numOr(c.cost),
    power: numOr(c.power),
    ability: strip(pick(c, "ability")),
    status: strip(pick(c, "status")),
    source: strip(pick(c, "source")),
    art: String(pick(c, "art", "image", "img")),
    variants: (Array.isArray(c.variants) ? c.variants : []).map((v, i) => trimVariant(v, i, id || c.name)).filter((v) => v.art),
  };
}

const raw = await download();
const list = raw?.success?.cards ?? raw?.cards ?? (Array.isArray(raw) ? raw : null);
if (!Array.isArray(list)) throw new Error("The card list wasn't where it used to be. Top-level keys: " + Object.keys(raw || {}).join(", "));

const cards = list.map(trimCard).filter((c) => c.name);
const variantCount = cards.reduce((n, c) => n + c.variants.length, 0);
console.log(`Found ${cards.length} cards and ${variantCount} variants.`);
// Don't replace good data with a broken download.
if (cards.length < 300) throw new Error(`Only ${cards.length} cards came back, so card-data.json was left as it was.`);

// A peek at the original format, to make fixing this script easier if Marvel Snap Zone changes it.
const keysOf = (objs) => [...new Set(objs.flatMap((o) => Object.keys(o || {})))].sort();
const sample = {
  cardFields: keysOf(list),
  variantFields: keysOf(list.flatMap((c) => (Array.isArray(c.variants) ? c.variants : []))),
  examples: list.filter((c) => Array.isArray(c.variants) && c.variants.length).slice(0, 2).map((c) => ({ ...c, variants: c.variants.slice(0, 3) })),
};
writeFileSync(SAMPLE, JSON.stringify(sample, null, 1));

const body = JSON.stringify(cards);
if (existsSync(OUT)) {
  try { if (JSON.stringify(JSON.parse(readFileSync(OUT, "utf8")).cards) === body) { console.log("No changes since last time."); process.exit(0); } } catch { /* rewrite it */ }
}
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "Marvel Snap Zone (marvelsnapzone.com)", count: cards.length, variants: variantCount, cards }));
console.log("Saved " + OUT);
