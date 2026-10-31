// SNAP Stat's service worker. It lets the app open without a connection, and checks for things
// to notify you about: a wishlist item on sale, an event starting, the season ending, a daily goal or checklist.
// It also receives screenshots and SnapVault exports shared to the app from Android's share menu.
const VERSION = "snapstat-v3";
const SHELL = ["./", "index.html", "firebase-config.js", "firebase-init.js", "manifest.webmanifest?v=2", "icon-192-v2.png", "icon-512-v2.png", "apple-touch-icon-v2.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("snapstat-v") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Screenshots shared to SNAP Stat from Android's share menu: keep them for the app to read, then open it.
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const form = await req.formData(); const files = [...form.getAll("shots"), ...form.getAll("data")].filter((f) => f && typeof f === "object" && f.size);
        const c = await caches.open("snapstat-share"); let i = 0;
        for (const f of files.slice(0, 20)) await c.put(`shared/${Date.now()}-${i++}`, new Response(f, { headers: { "content-type": f.type || "image/png", "x-name": encodeURIComponent(f.name || "screenshot.png"), "x-time": String(f.lastModified || Date.now()) } }));
        // Text shared with no file (a deck code from a post): kept apart from the pictures, for the app's #shared page to hand to snapSharedText
        const text = ["title", "text", "url"].map((k) => form.get(k)).filter((v) => typeof v === "string" && v.trim()).join("\n").slice(0, 20000);
        if (text && !files.length) await c.put("shared-text", new Response(text, { headers: { "content-type": "text/plain" } }));
      } catch { /* nothing saved; the app says so */ }
      return Response.redirect(new URL("./#shared", self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const data = url.hostname === "raw.githubusercontent.com" && url.pathname.endsWith(".json");
  const sdk = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (sdk) {
    // Firebase's code never changes for a given version number, so the saved copy is always good.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  if (!same && !data) return;
  // Network first, so updates show up right away. The saved copy is for when you're offline.
  e.respondWith(
    fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});

/* ---------- Notifications ---------- */
const pad = (n) => String(n).padStart(2, "0");
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
async function readJson(cache, key) { const r = await cache.match(key); return r ? r.json() : null; }

async function check() {
  const cache = await caches.open("snapstat-notify");
  const st = await readJson(cache, "state.json");
  if (!st || !st.prefs || !st.prefs.on) return;
  const seen = (await readJson(cache, "seen.json")) || {};
  const now = new Date(), today = localDay(now), tomorrow = localDay(new Date(now.getTime() + 864e5));
  const notes = [];
  const once = (id, note) => { if (!seen[id] && !notes.some((n) => n.tag === id)) notes.push({ ...note, tag: id }); };

  if (st.prefs.wish && ((st.wishCats || []).length || (st.wishCards || []).length)) {
    let sched = null;
    for (const u of st.urls || []) { try { const r = await fetch(u, { cache: "no-cache" }); if (r.ok) { sched = await r.json(); break; } } catch { /* try the next copy */ } }
    for (const s of (sched && sched.shops) || []) {
      if (s.end && s.end < today) continue;
      if (s.start && Date.parse(s.start + "T19:00:00Z") > Date.now()) continue;  // not on sale yet
      for (const it of s.items || []) {
        const w = it.cat ? (st.wishCats || []).find((x) => x.cat === it.cat) : !it.variantId ? (st.wishCards || []).find((x) => x.id === it.cardId) : null;
        if (!w) continue;
        once(`shop:${it.cat || it.cardId}:${s.shop}:${s.end}`, { title: "On your wishlist and on sale", body: `${w.name} · ${s.title || s.shop}${s.end ? " · until " + s.end : ""}`, url: st.app + "#shops" });
      }
    }
  }
  if (st.prefs.events) for (const e of st.events || []) if (e.start === today) once(`event:${e.id}`, { title: "Starting today", body: e.name, url: st.app + "#events" });
  // An evening nudge for daily goals that aren't done, and a reminder a couple of hours before the daily checklist resets.
  if (st.prefs.goals !== false && now.getHours() >= 18) for (const g of st.goals || []) if (g.day === today && g.left > 0) once(`goal:${g.id}:${today}`, { title: "Today's goal", body: `${g.text}: ${g.left} to go.`, url: st.app + "#home" });
  if (st.prefs.missions !== false && st.missions && st.missions.left > 0 && st.missions.resetAt > Date.now() && st.missions.resetAt - Date.now() < 3 * 3600e3) once(`missions:${st.missions.key}`, { title: "Daily checklist", body: `${st.missions.left} thing${st.missions.left > 1 ? "s" : ""} left before the game's day resets.`, url: st.app + "#home" });
  if (st.prefs.daily !== false && st.today && st.today.day === today && st.today.games > 0 && now.getHours() >= 21) { const t = st.today; once(`daily:${today}`, { title: "Your day in MARVEL SNAP", body: `${t.games} game${t.games > 1 ? "s" : ""} · ${t.w}-${t.l}${t.t ? "-" + t.t : ""} · ${t.cubes > 0 ? "+" : ""}${t.cubes} cubes`, url: st.app + "#home" }); }
  if (st.prefs.season && st.season && st.season.end === tomorrow) once(`season:${st.season.id}`, { title: "The season ends tomorrow", body: `${st.season.name}: finish your pass and climb while you can.`, url: st.app + "#seasons" });
  // Reminders the app worked out itself (series drops, the spotlight reset, bounties…): each between its start and end, when its preference is on
  for (const a of st.alerts || []) { if (!a || !a.id || !a.title) continue; const t = Date.now(); if (t < a.at || t > (a.until || a.at + 12 * 3600e3)) continue; if (a.pref && st.prefs[a.pref] === false) continue; once(`x:${a.id}`, { title: a.title, body: a.body || "", url: st.app + (a.route || "#home") }); }

  // Show up to five at a time. Each one is remembered only once it was actually shown.
  for (const n of notes.slice(0, 5)) {
    try { await self.registration.showNotification(n.title, { body: n.body, tag: n.tag, icon: "icon-192-v2.png", badge: "icon-192-v2.png", data: { url: n.url } }); seen[n.tag] = Date.now(); }
    catch { /* notifications are blocked; try again next time */ }
  }
  // Forget old notices after two months.
  for (const [k, t] of Object.entries(seen)) if (Date.now() - t > 60 * 864e5) delete seen[k];
  await cache.put("seen.json", new Response(JSON.stringify(seen), { headers: { "content-type": "application/json" } }));
}

self.addEventListener("periodicsync", (e) => { if (e.tag === "snapstat-check") e.waitUntil(check()); });
self.addEventListener("message", (e) => { if (e.data && e.data.type === "check") e.waitUntil(check()); });
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if ("focus" in w) { w.navigate(url).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
