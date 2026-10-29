// Builds promo-codes.json: MARVEL SNAP web shop codes, with what they give and whether they still work.
// Read from sites that keep a checked list (Dexerto's and Popverse's code pages). A code is "active" while a site
// lists it as working, "expired" once any site lists it as expired, and "unknown" if it stops being listed anywhere.
// Codes are never removed, so the list keeps their history. Run daily by .github/workflows/update-cards.yml.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "promo-codes.json";
const UA = "Mozilla/5.0 (compatible; SNAP-Stat-code-updater/1.0; +https://github.com/rhaddaddy/snap-stat)";
const today = new Date().toISOString().slice(0, 10);
const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;|&#8217;|’/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#8211;|&ndash;/g, "–").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
const looksLikeCode = (c) => /^[A-Za-z0-9]{5,24}$/.test(c) && (/[0-9]/.test(c) || /^[A-Z0-9]+$/.test(c));
async function get(url) {
  try { const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(45000) }); return r.ok ? await r.text() : ""; } catch { return ""; }
}
const found = new Map(); // CODE -> { code, reward, active: Set(sources), expired: Set(sources) }
const note = (code, src, status, reward = "") => {
  code = String(code).trim(); if (!looksLikeCode(code)) return;
  const k = code.toUpperCase(); const f = found.get(k) || { code, reward: "", active: new Set(), expired: new Set() };
  if (reward && reward.length > f.reward.length) f.reward = reward.slice(0, 200);
  f[status].add(src); found.set(k, f);
};

// Dexerto: a table of active codes (rows with the code as their id), then a list of expired ones.
{
  const page = await get("https://www.dexerto.com/marvel-snap/marvel-snap-codes-3361570/");
  if (page) {
    const exp = page.search(/<h2[^>]*>[^<]*Expired/i);
    const active = exp > 0 ? page.slice(0, exp) : page, expired = exp > 0 ? page.slice(exp, exp + 20000) : "";
    for (const m of active.matchAll(/<tr id="([A-Za-z0-9]+)"[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) note(m[1], "Dexerto", "active", strip(m[2]));
    const nx = expired.slice(10).search(/<h2/i); // the expired list ends at the next heading
    const expEnd = nx >= 0 ? expired.slice(0, nx + 10) : expired.slice(0, 6000);
    for (const m of expEnd.matchAll(/<(?:li|strong|td)[^>]*>\s*(?:<[^>]+>\s*)*([A-Za-z0-9]{5,24})\s*(?:<\/[^>]+>\s*)*(?:[-–:][^<]*)?<\/(?:li|strong|td)>/g)) note(m[1], "Dexerto", "expired");
    for (const m of expEnd.matchAll(/<tr id="([A-Za-z0-9]+)"/g)) note(m[1], "Dexerto", "expired");
  }
}
// Popverse: "CODE – reward" lines under "Working Marvel Snap codes", and maybe an expired list.
{
  const page = strip(await get("https://www.thepopverse.com/gaming-marvel-snap-codes-nuverse-second-dinner-active-new/"));
  const w = page.search(/Working Marvel Snap codes/i);
  if (w >= 0) {
    const rest = page.slice(w + 25);
    const stop = rest.search(/How to redeem|Expired Marvel Snap codes/i);
    const block = stop > 0 ? rest.slice(0, stop) : rest.slice(0, 4000);
    for (const m of block.matchAll(/([A-Za-z0-9]{5,24}) – (.+?)(?= [A-Za-z0-9]{5,24} – |$)/g)) note(m[1], "Popverse", "active", m[2].trim());
    const e = rest.search(/Expired Marvel Snap codes/i);
    if (e >= 0) { const eb = rest.slice(e + 25, e + 3000); const end = eb.search(/How to redeem|What are|Where to find/i); for (const m of (end > 0 ? eb.slice(0, end) : eb).matchAll(/\b([A-Za-z0-9]{5,24})\b/g)) if (/[0-9]/.test(m[1]) || /^[A-Z0-9]+$/.test(m[1])) note(m[1], "Popverse", "expired"); }
  }
}

let prev = { codes: [] };
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* start fresh */ } }
const byCode = new Map(prev.codes.map((c) => [c.code.toUpperCase(), c]));
if (found.size < 3 && byCode.size) { console.log("The code pages didn't come through; keeping the old list."); process.exit(0); }
for (const [k, f] of found) {
  const old = byCode.get(k) || { code: f.code, firstSeen: today };
  // A site listing it as working wins over one listing it as expired (the working lists are the ones kept up to date).
  const status = f.active.size ? "active" : f.expired.size ? "expired" : old.status || "unknown";
  const exp = (f.reward.match(/(?:expires?|until|ends?)\s+(?:on\s+)?([A-Z][a-z]+ \d{1,2},? \d{4})/i) || [])[1];
  if (status !== "expired") delete old.expiredOn;
  byCode.set(k, { ...old, code: old.code || f.code, reward: f.reward || old.reward || "", status, lastSeen: today, checked: today,
    sources: [...new Set([...f.active, ...f.expired])], ...(status === "expired" && old.status !== "expired" ? { expiredOn: today } : {}),
    ...(exp && !isNaN(Date.parse(exp)) ? { expires: new Date(Date.parse(exp)).toISOString().slice(0, 10) } : {}) });
}
// Codes that no site lists any more: after a week, they're probably gone.
for (const [k, c] of byCode) if (!found.has(k) && c.status === "active" && c.lastSeen && (Date.parse(today) - Date.parse(c.lastSeen)) / 864e5 > 7) byCode.set(k, { ...c, status: "unknown" });
const codes = [...byCode.values()].sort((a, b) => (a.status === "active" ? 0 : a.status === "unknown" ? 1 : 2) - (b.status === "active" ? 0 : b.status === "unknown" ? 1 : 2) || String(b.firstSeen).localeCompare(String(a.firstSeen)) || a.code.localeCompare(b.code));
const body = { source: "Dexerto and Popverse code lists, checked daily", shop: "https://marvelsnap.com", codes };
if (JSON.stringify(prev.codes) === JSON.stringify(codes)) { console.log("No changes."); process.exit(0); }
writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), ...body }, null, 0));
console.log(`Saved ${codes.length} codes (${codes.filter((c) => c.status === "active").length} active).`);
