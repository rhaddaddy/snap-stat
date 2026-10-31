// Test stand-in for firebase-init.js: an in-memory Firestore and a fake Google sign-in (tester@example.com).
// window.__mockdata holds every document by path. The signed-in user survives reloads (localStorage "mock.user").
(() => {
  const data = (window.__mockdata = new Map());
  try { const saved = JSON.parse(localStorage.getItem("mock.db") || "null"); if (saved) for (const [k, v] of saved) data.set(k, v); } catch (e) { /* fresh */ }
  const persist = () => { try { localStorage.setItem("mock.db", JSON.stringify([...data.entries()])); } catch (e) { /* ignore */ } };
  const docL = new Map(), colL = new Map();
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const parent = (p) => p.split("/").slice(0, -1).join("/");
  const snap = (p) => ({ id: p.split("/").pop(), exists: data.has(p), data: () => clone(data.get(p)), metadata: { hasPendingWrites: false, fromCache: false } });
  const colSnap = (p) => { const docs = [...data.keys()].filter((k) => parent(k) === p).map(snap); return { docs, size: docs.length, empty: !docs.length, metadata: { hasPendingWrites: false } }; };
  const fire = (p) => {
    setTimeout(() => {
      for (const fn of docL.get(p) || []) fn(snap(p));
      for (const fn of colL.get(parent(p)) || []) fn(colSnap(parent(p)));
    }, 0);
  };
  const strip = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? strip(v) : v])) : o);
  let n = 0;
  const wrapDoc = (p) => ({
    id: p.split("/").pop(), path: p,
    get: () => Promise.resolve(snap(p)),
    set: (d) => { data.set(p, clone(strip(d))); persist(); fire(p); return Promise.resolve(); },
    update: (d) => { if (!data.has(p)) return Promise.reject(new Error("not-found")); data.set(p, { ...data.get(p), ...clone(strip(d)) }); persist(); fire(p); return Promise.resolve(); },
    delete: () => { data.delete(p); persist(); fire(p); return Promise.resolve(); },
    onSnapshot: (next) => { const a = docL.get(p) || []; a.push(next); docL.set(p, a); setTimeout(() => next(snap(p)), 0); return () => docL.set(p, (docL.get(p) || []).filter((f) => f !== next)); },
    collection: (c) => wrapColl(p + "/" + c),
  });
  const wrapColl = (p) => ({
    path: p,
    doc: (id) => wrapDoc(p + "/" + (id || "auto" + Date.now().toString(36) + (n++))),
    onSnapshot: (next) => { const a = colL.get(p) || []; a.push(next); colL.set(p, a); setTimeout(() => next(colSnap(p)), 0); return () => colL.set(p, (colL.get(p) || []).filter((f) => f !== next)); },
  });
  const authL = [];
  let user = null; // like a fresh sign-in each time the page loads
  const tell = () => setTimeout(() => authL.forEach((fn) => fn(user)), 0);
  if (window.__mockNoConfig || /[?&]noconfig/.test(location.search)) { window.snapFirebaseNeedsConfig = true; window.__resolveFirebase(null); return; }
  window.__resolveFirebase({
    db: { doc: (p) => wrapDoc(p), collection: (p) => wrapColl(p) },
    onAuth: (fn) => { authL.push(fn); setTimeout(() => fn(user), 0); return () => {}; },
    signIn: () => { if (/[?&]blocked/.test(location.search)) { const e = new Error("Firebase: Error (auth/unauthorized-domain)."); e.code = "auth/unauthorized-domain"; return Promise.reject(e); } user = { uid: window.__mockUid || "u_me", displayName: "Test Player", email: "tester@example.com" }; try { localStorage.setItem("mock.user", JSON.stringify(user)); } catch (e) { /* ignore */ } tell(); return Promise.resolve({ user }); },
    signOut: () => { user = null; try { localStorage.removeItem("mock.user"); } catch (e) { /* ignore */ } tell(); return Promise.resolve(); },
    deleteAccount: () => { user = null; try { localStorage.removeItem("mock.user"); } catch (e) { /* ignore */ } return Promise.resolve(); },
  });
})();
