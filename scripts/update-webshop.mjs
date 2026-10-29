// Saves the MARVEL SNAP web shop's public catalog as webshop.json: every bundle with its price, contents, dates and
// Web Points, the gold packs (for comparing a bundle's value), and the season's Web Points reward track.
// This is the same list the web shop shows anyone who isn't signed in; it holds nothing about any player.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
const URL = "https://shop.marvelsnap.com/api/catalog?lang=en";
const r = await fetch(URL, { headers: { "user-agent": "Mozilla/5.0 (compatible; SNAP-Stat/1.0; +https://github.com/rhaddaddy/snap-stat)", accept: "application/json" } });
if (!r.ok) { console.log("The web shop didn't answer:", r.status); process.exit(0); }
const j = await r.json();
const ms = (s) => { const t = Date.parse(s || ""); return Number.isFinite(t) ? t : 0; };
const lines = (d) => { const b = String(d || "").split("\n").map((l) => l.replace(/^\s*[•*-]\s*/, "").trim()).filter((l) => l && !/^contents:?$/i.test(l)); return b.length > 1 || !/^contents/i.test(String(d)) ? b : []; };
const offers = (j.offers || []).map((o) => {
  const contents = lines(o.description).slice(0, 14), price = o.market && o.market.priceHundredths ? o.market.priceHundredths / 100 : 0;
  const gold = (String(o.name).match(/^([\d,]+)\s+gold$/i) || [])[1];
  return { key: String(o.offerKey || "").slice(0, 60), name: String(o.name || "").slice(0, 80), group: arrFirst(o.groups), price, currency: (o.market && o.market.currency) || "", from: ms(o.dateFrom), until: ms(o.dateUntil), points: o.webPoints || 0, contents, free: !!o.isFree, image: String(o.imageUrl || ""), ...(gold ? { gold: Number(gold.replace(/,/g, "")) } : {}) };
}).filter((o) => o.name);
function arrFirst(a) { return Array.isArray(a) && a.length ? String(a[0]) : ""; }
const chains = (j.rewardChains || []).map((c) => ({ id: String(c.id || ""), name: String(c.name || ""), starts: ms(c.startsAt), ends: ms(c.endsAt), point: String(c.pointName || "Web Point"),
  steps: (c.steps || []).map((s) => ({ id: s.id, points: s.pointsRequired || 0, rewards: (s.rewards || []).map((x) => String(x.name || "").replace(/^(\d+)x\s+/, "$1 ")).join(" + ") })) }));
const body = { source: "MARVEL SNAP web shop (shop.marvelsnap.com), its public catalog", offers, chains };
const prev = existsSync("webshop.json") ? JSON.parse(readFileSync("webshop.json", "utf8")) : {};
delete prev.updated;
if (JSON.stringify(prev) === JSON.stringify(body)) { console.log("No changes."); process.exit(0); }
writeFileSync("webshop.json", JSON.stringify({ updated: new Date().toISOString(), ...body }));
console.log(offers.length, "offers,", chains.length, "reward track(s)");
