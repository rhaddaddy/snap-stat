// Downloads every MARVEL SNAP card and variant from Marvel Snap Zone and saves a small copy
// as card-data.json, which the app reads for card art, card details and the full variant list.
// GitHub runs this once a day (see .github/workflows/update-cards.yml). Needs Node 18 or newer.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SOURCE = process.env.CARD_SOURCE || "https://marvelsnapzone.com/getinfo/?searchtype=cards&searchcardstype=true";
const OUT = "card-data.json";
const SAMPLE = "card-data-sample.json";

const strip = (s) => String(s ?? "")
  .replace(/<\/?(?:span|b|i|em|strong|a|u|font)\b[^>]*>/gi, "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").replace(/\s+([.,:;!?)])/g, "$1").trim();
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

// Marvel Snap Zone's "rarity" is really where a variant comes from. Tidy up the spellings.
const RARITY = { seasonpass: "Season Pass", spotlight: "Spotlight", spotlightcache: "Spotlight", bundle: "Bundle", conditionalbundle: "Conditional Bundle", teamup: "Team-Up", deadpooldiner: "Deadpool's Diner" };
function tidyRarity(r) {
  const s = strip(r); if (!s) return "";
  const k = s.toLowerCase().replace(/[^a-z]/g, "");
  if (RARITY[k]) return RARITY[k];
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
function toDate(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  if (!isNaN(n) && n > 0) return new Date(n < 1e11 ? n * 1000 : n).toISOString().slice(0, 10);
  const d = new Date(String(v)); return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}
// The comic a variant's art comes from is the first link in its description, like "Immortal Hulk (2018) #22 (Variant)".
function comicTitle(html) {
  const m = String(html || "").match(/<li[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
  const t = m ? strip(m[1]).replace(/\s*\((?:variant|cover)\)\s*$/i, "") : "";
  return t.length <= 70 ? t : "";
}

function trimVariant(v, i, cardId) {
  const people = [pick(v, "sketcher", "artist"), pick(v, "inker"), pick(v, "colorist")].map(strip).filter(Boolean);
  const artist = [...new Set(people)].join(" & ");
  const out = {
    id: String(pick(v, "vid", "id", "art_filename") || `${cardId}-${i + 1}`),
    art: String(pick(v, "art", "image", "img")),
    name: strip(pick(v, "name", "title", "variant_name")) || comicTitle(pick(v, "full_description", "description")),
    artist,
    rarity: tidyRarity(pick(v, "rarity", "rarity_name")),
    order: numOr(pick(v, "variant_order", "order")) || i + 1,
    release: toDate(pick(v, "ReleaseDate", "release_date", "releaseDate", "date")),
  };
  if (/unreleased/i.test(strip(pick(v, "status")))) out.unreleased = true;
  return out;
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

// Most art links share one folder, so it's written once as artBase.
const counts = {};
for (const c of cards) for (const u of [c.art, ...c.variants.map((v) => v.art)]) { const m = String(u).match(/^(https?:\/\/.+\/)[^/]+$/); if (m) counts[m[1]] = (counts[m[1]] || 0) + 1; }
const artBase = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
if (artBase) for (const c of cards) { if (c.art.startsWith(artBase)) c.art = c.art.slice(artBase.length); for (const v of c.variants) if (v.art.startsWith(artBase)) v.art = v.art.slice(artBase.length); }
const body = JSON.stringify({ artBase, cards });
if (existsSync(OUT)) {
  try { const prev = JSON.parse(readFileSync(OUT, "utf8")); if (JSON.stringify({ artBase: prev.artBase || "", cards: prev.cards }) === body) { console.log("No changes since last time."); process.exit(0); } } catch { /* rewrite it */ }
}
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "Marvel Snap Zone (marvelsnapzone.com)", count: cards.length, variants: variantCount, artBase, cards }));
console.log("Saved " + OUT);
