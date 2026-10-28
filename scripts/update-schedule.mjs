// Builds schedule.json: every MARVEL SNAP season (name, pass cards, rewards), limited-time event (name, dates),
// and what's for sale (bundles and event shops) from snap.fan's public pages. GitHub runs it once a day after update-cards.mjs.
// Season dates aren't listed on those pages, so they're estimated: seasons start on the first Tuesday of the month.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.SCHEDULE_SOURCE || "https://snap.fan";
const OUT = "schedule.json";
const UA = "Mozilla/5.0 (compatible; SNAP-Stat-card-updater/1.0)";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON3 = MONTHS.map((m) => m.slice(0, 3));

const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

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

let names = {}, varByOrder = {};
try {
  for (const c of JSON.parse(readFileSync("card-data.json", "utf8")).cards) {
    if (!c.id) continue; names[c.id] = c.name;
    // snap.fan names variants like GhostRider_18; Marvel Snap Zone numbers the same variant 18.
    for (const v of c.variants || []) varByOrder[`${c.id}_${String(v.order).padStart(2, "0")}`] = `${c.id}:${v.id}`;
  }
} catch { /* names fall back to splitting the ID */ }
const cardName = (id) => names[id] || String(id).replace(/([a-z])([A-Z])/g, "$1 $2");

const firstTuesday = (y, m) => { const d = new Date(Date.UTC(y, m, 1)); while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1); return d; };
const dayBefore = (d) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - 1); return x; };

let prev = { seasons: {}, events: {} };
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* start fresh */ } }

/* ---------- Seasons ---------- */
const list = await get("/seasons/");
if (!list) throw new Error("Couldn't load the season list.");
const items = [...list.matchAll(/<a href="\/seasons\/([a-z]+)(\d{4})\/"[\s\S]*?font-ultimatum[^>]*>\s*([^<]+?)\s*<\/div>\s*<div[^>]*>\s*([^<]+?)\s*<\/div>\s*<p[^>]*>\s*([^<]*?)\s*<\/p>/g)]
  .map(([, mon, year, name, , tagline]) => ({ m: MONTHS.indexOf(mon), y: Number(year), slug: mon + year, name: strip(name), tagline: strip(tagline) }))
  .filter((s) => s.m >= 0)
  .sort((a, b) => a.y - b.y || a.m - b.m);
if (items.length < 20) throw new Error(`Only ${items.length} seasons were found, so ${OUT} was left as it was.`);

const now = new Date();
const recent = (s) => (s.y * 12 + s.m) >= (now.getUTCFullYear() * 12 + now.getUTCMonth() - 3);
const seasons = {};
for (let i = 0; i < items.length; i++) {
  const s = items[i], id = `s-${s.y}-${pad(s.m + 1)}`;
  const start = firstTuesday(s.y, s.m);
  const next = items[i + 1] ? firstTuesday(items[i + 1].y, items[i + 1].m) : firstTuesday(s.m === 11 ? s.y + 1 : s.y, (s.m + 1) % 12);
  const old = prev.seasons && prev.seasons[id];
  const out = { name: s.name, start: iso(start), end: iso(dayBefore(next)), passLevels: 50, passCard: "", cards: [], variants: [], rewards: [],
    notes: `${s.tagline ? s.tagline + " " : ""}Dates are estimated: seasons start on the first Tuesday of the month.`, link: `https://snap.fan/seasons/${s.slug}/`, by: "snap.fan" };
  if (old && !recent(s)) { seasons[id] = { ...out, passCard: old.passCard || "", superCard: old.superCard || "", cards: old.cards || [], variants: old.variants || [] }; continue; }
  const page = await get(`/seasons/${s.slug}/`); await sleep(800);
  if (page) {
    const cardsSec = (page.match(/<section id="cards">([\s\S]*?)<\/section>/) || [])[1] || "";
    for (const [, cid, tier] of cardsSec.matchAll(/href="\/cards\/([A-Za-z0-9]+)\/"[\s\S]*?tracking-wide[^>]*>\s*([^<]+?)\s*</g)) {
      if (/super/i.test(tier)) out.superCard = cardName(cid); else if (!out.passCard) out.passCard = cardName(cid);
    }
    const rewardsSec = (page.match(/<section id="rewards"[^>]*>([\s\S]*?)<\/section>/) || [])[1] || "";
    for (const [, cid, vid, nm] of rewardsSec.matchAll(/href="\/cards\/([A-Za-z0-9]+)\/(?:([A-Za-z0-9_]+)\/)?"[\s\S]*?card-grid__cell-name">([^<]+)</g)) {
      const n = strip(nm) || cardName(cid);
      if (vid) { const v = `${n} - Season Pass`; if (!out.variants.includes(v)) out.variants.push(v); }
      else if (!out.cards.includes(n)) out.cards.push(n);
    }
    if (out.superCard) out.notes = `${out.superCard} is the Super Premium card. ${out.notes}`;
  } else if (old) { Object.assign(out, { passCard: old.passCard || "", superCard: old.superCard || "", cards: old.cards || [], variants: old.variants || [] }); }
  seasons[id] = out;
}

/* ---------- Limited-time events ---------- */
const evPage = await get("/events/");
const events = {};
if (evPage) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rows = [...evPage.matchAll(/banner-date__dates">([^<]+)<\/span>[\s\S]*?<a href="\/events\/([^"/]+)\/"[^>]*>\s*([^<]+?)\s*<\/a>/g)];
  for (const [, dates, slug, rawName] of rows) {
    if (/spare/i.test(slug)) continue;
    const m = strip(dates).match(/^([A-Za-z]{3})[a-z]* (\d{1,2})(?:, (\d{4}))? - (?:([A-Za-z]{3})[a-z]* )?(\d{1,2})(?:, (\d{4}))?$/);
    if (!m) continue;
    const m1 = MON3.indexOf(m[1].toLowerCase()), m2 = m[4] ? MON3.indexOf(m[4].toLowerCase()) : m1;
    if (m1 < 0 || m2 < 0) continue;
    // The year: written out, or from the event's ID (like HighVoltage_WeekendNov26), or the closest one to today.
    let y2 = m[6] ? Number(m[6]) : m[3] ? Number(m[3]) : 0;
    const fromSlug = slug.match(/([A-Z][a-z]{2})(\d{2})(?:_\d+)?$/);
    if (!y2 && fromSlug) y2 = 2000 + Number(fromSlug[2]);
    if (!y2) { const c = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1]; y2 = c.sort((a, b) => Math.abs(Date.UTC(a, m1, +m[2]) - today) - Math.abs(Date.UTC(b, m1, +m[2]) - today))[0]; }
    const y1 = m[3] ? Number(m[3]) : m1 > m2 ? y2 - 1 : y2;
    const start = new Date(Date.UTC(y1, m1, +m[2])), end = new Date(Date.UTC(y2, m2, +m[5]));
    if (start.getTime() > today + 400 * 864e5) continue;
    let name = strip(rawName).replace(/\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2}$/i, "");
    if (name === name.toUpperCase()) name = name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
    const id = "sf-" + slug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    events[id] = { name, type: "mode", start: iso(start), end: iso(end), passLevels: 0, collectibles: [], desc: "", link: `https://snap.fan/events/${slug}/`, by: "snap.fan" };
  }
}
if (Object.keys(events).length < 5) { console.log("The event list looked wrong, so the previous events were kept."); Object.assign(events, prev.events || {}); }

/* ---------- Filling gaps and fixing names ---------- */
// snap.fan sometimes skips a season (October 2026 wasn't listed). Marvel Snap Zone's season list (art.json, from
// update-art.py) and the season history (seed.json) fill in missing months, and schedule-overrides.json holds
// corrections checked by hand. Seasons start at the daily reset on the first Tuesday of the month.
{
  const read = (f) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; } catch { return null; } };
  const art = read("art.json"), seed = read("seed.json"), fix = read("schedule-overrides.json") || {};
  const have = new Set(Object.keys(seasons));
  const months = new Set([...Object.keys((art && art.seasons) || {}).map((k) => "s-" + k), ...Object.keys((seed && seed.seasons) || {})]);
  const known = Object.keys(seasons).sort(), first = known[0] || "", last = known[known.length - 1] || "";
  for (const id of months) {
    if (have.has(id) || id < first || id > last || !/^s-\d{4}-\d{2}$/.test(id)) continue; // only gaps inside snap.fan's list
    const [y, m] = id.slice(2).split("-").map(Number), sd = (seed && seed.seasons && seed.seasons[id]) || {}, a = (art && art.seasons && art.seasons[id.slice(2)]) || {};
    const name = String(sd.name || a.title || "").trim(); if (!name) continue;
    seasons[id] = { name, start: iso(firstTuesday(y, m - 1)), end: "", passLevels: 50, passCard: sd.passCard || "", superCard: sd.superCard || "", cards: sd.cards || [], variants: sd.variants || [], rewards: sd.rewards || [],
      notes: "Dates are estimated: seasons start on the first Tuesday of the month.", link: a.link || "", by: "Marvel Snap Zone" };
    console.log(`Added the missing season ${id}: ${name}`);
  }
  for (const [id, o] of Object.entries(fix.seasons || {})) if (seasons[id] || o.name) seasons[id] = { ...(seasons[id] || { passLevels: 50, cards: [], variants: [], rewards: [], notes: "" }), ...o };
  // Each season ends the day before the next one starts.
  const ids = Object.keys(seasons).sort();
  ids.forEach((id, i) => { const next = seasons[ids[i + 1]]; if (next && next.start) seasons[id].end = iso(dayBefore(new Date(next.start + "T00:00:00Z"))); else if (!seasons[id].end) { const [y, m] = id.slice(2).split("-").map(Number); seasons[id].end = iso(dayBefore(firstTuesday(m === 12 ? y + 1 : y, m % 12))); } });
  const renames = fix.eventNames || {}, drop = new Set((fix.dropEvents || []).map((n) => n.toLowerCase()));
  for (const [id, e] of Object.entries(events)) {
    if (drop.has(String(e.name).toLowerCase())) { delete events[id]; continue; }
    if (renames[e.name]) e.name = renames[e.name];
    if (fix.events && fix.events[id]) Object.assign(e, fix.events[id]);
  }
}

/* ---------- What's for sale: bundles and event shops ---------- */
const itemsFrom = (html) => [...html.matchAll(/<a href="\/cards\/([A-Za-z0-9]+)\/(?:([A-Za-z0-9_]+)\/)?"[\s\S]*?bundle-card__item-text">([^<]+)</g)]
  .map(([, cid, vid, label]) => { const isVar = !!vid && /_\d+$/.test(vid); return { cardId: cid, cardName: cardName(cid), variantId: isVar ? vid : "", cat: isVar ? varByOrder[vid] || "" : "", label: strip(label) }; });
const shops = [];
const nowMs = Date.now();
for (let pageNo = 1; pageNo <= 6; pageNo++) {
  const page = await get(pageNo === 1 ? "/bundles/" : `/bundles/page/${pageNo}/`); await sleep(800);
  if (!page) break;
  const cards = page.split('<article class="bundle-card"').slice(1);
  if (!cards.length) break;
  for (const b of cards) {
    const name = strip((b.match(/bundle-card__name">([^<]+)</) || [])[1]);
    const start = (b.match(/data-start="([^"]+)"/) || [])[1] || "", end = (b.match(/data-end="([^"]+)"/) || [])[1] || "";
    const price = (b.match(/bundle-card__cost">\s*\$([\d.,]+)/) || [])[1] || "";
    const items = itemsFrom(b);
    // snap.fan rates each bundle: its value (in gold) against its price, plus a breakdown of what's inside.
    const pcts = Object.fromEntries([...b.matchAll(/bundle-card__cost-percent-label">\s*([^<]+?)\s*<\/span>\s*<span class="bundle-card__cost-percent-value[^"]*">\s*([\d,]+)\s*%/g)].map((m) => [strip(m[1]).toLowerCase(), Number(m[2].replace(/,/g, ""))]));
    const breakdown = [...b.matchAll(/<td class="px-3 py-1\.5 text-snap-gray-100">([\s\S]*?)<\/td>\s*<td class="px-3 py-1\.5 text-right[^"]*">\s*([\d,]+)\s*<\/td>/g)].map((m) => [strip(m[1]).replace(/([a-z])([A-Z])/g, "$1 $2").slice(0, 60), Number(m[2].replace(/,/g, ""))]).slice(0, 15);
    const goldValue = Number(((b.match(/Total Gold Value<\/td>\s*<td[^>]*>\s*([\d,]+)/) || [])[1] || "").replace(/,/g, "")) || 0;
    if (!name || (!items.length && !goldValue) || (end && Date.parse(end) < nowMs - 864e5)) continue;
    shops.push({ source: "bundle", shop: "Bundle", title: name, start: start.slice(0, 10), end: end.slice(0, 10), endsAt: end, price: price ? Number(price.replace(/,/g, "")) : "", currency: "usd", items, value: pcts["bundle value"] || 0, currencyValue: pcts["currency value"] || 0, goldValue, breakdown });
  }
}
for (const [id, e] of Object.entries(events)) {
  const end = Date.parse(e.end + "T23:59:59Z"), start = Date.parse(e.start + "T00:00:00Z");
  if (end < nowMs || start > nowMs + 14 * 864e5 || !e.link) continue;
  const page = await get(e.link.replace("https://snap.fan", "")); await sleep(800);
  const shopHtml = page ? (page.match(/<h2>Shop<\/h2>([\s\S]*?)(?:<h2>|<\/main>)/) || [])[1] || "" : "";
  for (const part of shopHtml.split(/(?=<div class="event-card__section">)|(?=<div class="event-card__offer">)/)) {
    const items = itemsFrom(part), cost = part.match(/([\d,]+)\s*<span class="event-card__cost-label">([^<]+)<\/span>(?:\s*<span class="event-card__gold">\(≈ ([\d,]+) Gold\))?/);
    if (!items.length || !cost) continue;
    const sec = strip((part.match(/event-card__section-name">([^<]+)</) || [])[1]);
    shops.push({ source: "event", eventId: id, shop: `${e.name} shop`, title: sec && !/all offers/i.test(sec) ? sec : "", start: e.start, end: e.end, price: Number(cost[1].replace(/,/g, "")), currency: "event", gold: cost[3] ? Number(cost[3].replace(/,/g, "")) : "", items });
  }
}
console.log(`Found ${shops.length} shop offers.`);

const body = JSON.stringify({ seasons, events, shops });
try { if (JSON.stringify({ seasons: prev.seasons, events: prev.events, shops: prev.shops || [] }) === body) { console.log("No changes since last time."); process.exit(0); } } catch { /* write it */ }
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: "snap.fan", seasons, events, shops }));
console.log(`Saved ${OUT}: ${Object.keys(seasons).length} seasons, ${Object.keys(events).length} events, ${shops.length} shop offers.`);
