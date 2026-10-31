/* ============ More daily data files: promo codes, season art, card backs ============
   Each one is refreshed by the GitHub workflow and loaded like the card data: from this device's copy first,
   then the newest one from the web. */
function makeDataFile(file, cacheKey, ok) {
  const st = { data: null, ver: 0 };
  st.load = async () => {
    if (!window.SNAPSTAT_STANDALONE) return;
    try { const c = localStorage.getItem(cacheKey); if (c) { const j = JSON.parse(c); if (ok(j)) { st.data = j; st.ver++; refreshView(); } } } catch { /* no saved copy */ }
    for (const u of catUrls(file)) {
      try {
        const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) continue;
        const text = await r.text(); const j = JSON.parse(text);
        if (!ok(j)) continue;
        if (st.data && j.updated && j.updated === st.data.updated) return;
        st.data = j; st.ver++; st.from = new URL(".", new URL(u, location.href)).href;
        try { localStorage.setItem(cacheKey, text); } catch { /* fetched again next time */ }
        refreshView(); return;
      } catch { /* try the next copy */ }
    }
  };
  return st;
}

/* ---------- Promo codes: every known code, checked daily ---------- */
const PROMOS = makeDataFile("promo-codes.json", "snapstat-promos-v1", (j) => j && Array.isArray(j.codes));
const PROMO_SHOP = "https://shop.marvelsnap.com/";
// The daily list plus codes players added; a code in both shows once, with the daily check's status.
function autoPromos() {
  return arr(PROMOS.data && PROMOS.data.codes).filter((c) => c && /^[A-Za-z0-9]{4,30}$/.test(String(c.code || ""))).map((c) => ({
    id: "auto:" + String(c.code).toUpperCase(), code: String(c.code), reward: String(c.reward || "").slice(0, 200), status: ["active", "expired"].includes(c.status) ? c.status : "unknown",
    expires: /^\d{4}-\d{2}-\d{2}$/.test(c.expires || "") ? c.expires : "", added: Date.parse(c.firstSeen || "") || 0, checked: String(c.checked || ""), expiredOn: String(c.expiredOn || ""), auto: true, sources: arr(c.sources).map(String).slice(0, 4) }));
}
