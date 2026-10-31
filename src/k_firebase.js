/* ============ Standalone (Firebase) sign-in and storage ============ */
const FB_CFG_KEY = "snapstat.firebaseConfig", FB_SKIP_KEY = "snapstat.skipSignIn";
function parseFirebaseConfig(text) {
  const o = {}; for (const m of String(text || "").matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g)) o[m[1]] = m[2];
  return o.apiKey && o.authDomain && o.projectId && o.appId ? o : null;
}
const fbui = { busy: false, err: "", cfgText: "", cfgErr: "" };
function signInSheet() {
  const apple = window.SNAPSTAT_OPTIONS && window.SNAPSTAT_OPTIONS.apple;
  return `${sheetHead("Sign in to SNAP Stat", "Keep your stats on every device and use the social features")}
    <button class="btn snap block" data-a="signInGoogle" ${fbui.busy ? "disabled" : ""}>Continue with Google</button>
    ${apple ? `<button class="btn block" data-a="signInApple" ${fbui.busy ? "disabled" : ""}>Continue with Apple</button>` : ""}
    ${fbui.err ? `<p class="note">${esc(fbui.err)}</p>` : ""}
    <button class="btn ghost block" data-a="skipSignIn">Use without an account</button>
    <p class="muted small">Without an account, everything is saved on this device only. ${privacyLink()}</p>`;
}
function setupSheet() {
  return `${sheetHead("Connect your Firebase project", "One-time setup")}
    <p class="small">In the Firebase console, open Project settings, scroll to Your apps, and copy the <b>firebaseConfig</b> block. Paste it here.</p>
    <textarea id="fb-cfg" class="code" data-fbcfg="1" placeholder="const firebaseConfig = { apiKey: ... }">${esc(fbui.cfgText)}</textarea>
    ${fbui.cfgErr ? `<p class="note">${esc(fbui.cfgErr)}</p>` : ""}
    <button class="btn snap" data-a="saveFbConfig">Connect</button>
    <p class="muted small">This saves the settings on this device. To make sign-in work for everyone, also paste them into firebase-config.js before you upload the app.</p>`;
}
function fbErrText(e) {
  const c = (e && e.code) || "";
  if (c.includes("popup-closed") || c.includes("cancelled-popup")) return "";
  if (c.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  if (c.includes("unauthorized-domain")) return "This web address isn't allowed to sign in yet. In Firebase, add it under Authentication › Settings › Authorized domains.";
  if (c.includes("operation-not-allowed")) return "This sign-in method isn't turned on yet. In Firebase, turn it on under Authentication › Sign-in method.";
  if (c.includes("network")) return "Couldn't reach Google. Check your connection and try again.";
  if (c.includes("web-storage") || c.includes("internal")) return "Sign-in didn't finish. If you opened this link inside another app, open it in Safari or Chrome instead.";
  return "Sign-in didn't work. Try again, or open the app in Safari or Chrome.";
}
async function doSignIn(kind) {
  // The sign-in service never loaded (no connection when the app opened): say that, not "open it in Chrome"
  if (!store.fb) { fbui.err = "Couldn't reach the sign-in service. Check your connection, then close SNAP Stat and open it again."; refreshSheet(); return; }
  fbui.busy = true; fbui.err = ""; refreshSheet();
  try { await store.fb.signIn(kind); closeSheet(); }
  catch (e) { fbui.err = fbErrText(e); if (sheetFn) refreshSheet(); }
  fbui.busy = false; if (sheetFn) refreshSheet();
}
async function initFirebase(local, lm) {
  store.provider = "firebase";
  store.downloads = { save: ({ filename, data }) => { const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return Promise.resolve({ status: "saved" }); } };
  const ready = window.snapFirebaseReady || Promise.resolve(null);
  const api = await Promise.race([ready, new Promise((r) => setTimeout(() => r(null), 12000))]);
  if (!api) {
    store.ready = true; render();
    if (window.snapFirebaseNeedsConfig) { openSheet(setupSheet); return; }
    toast("Couldn't reach the server yet, so changes are saved on this phone. They're added to your account once it connects.");
    // Keep waiting: when it connects, switch over (what you did meanwhile is added to your account)
    ready.then((late) => { if (late && !store.fb) fbStart(late, local, lm); }).catch(() => {});
    maybeOnboard();
    return;
  }
  fbStart(api, local, lm);
}
function fbStart(api, local, lm) {
  store.fb = api;
  if (window.__overlay) { store.ready = true; startOverlay(window.__overlay === "me" ? "" : window.__overlay, api); return; }
  let started = false;
  api.onAuth((user) => {
    const wasLocal = store.mode === "local" && store.ready;
    if (user) {
      if (started && store.uid === user.uid) return;
      store.user = { uid: user.uid, name: user.displayName || "", email: user.email || "" };
      store.db = api.db; store.uid = user.uid; store.mode = "cloud"; started = true;
      // Offered in the profile setup form, where you see it; never filled in behind your back on a profile that's already shared
      if (!S.me.name && store.user.name && !S.me.onboarded) S.me.name = store.user.name;
      store.assets = firebaseAssets;
      // Signing in after using the app without an account: start from what's on screen now, not what was there at start-up
      if (wasLocal) { if (dirty) { clearTimeout(saveTimer); lsSet(LS.state, clone(S)); lsSet(LOCAL_AT, Date.now()); } if (dirtyWeeks.size) { clearTimeout(weekTimer); dirtyWeeks.clear(); lsSet(LS.matches, matchWeeks); lsSet(LOCAL_AT, Date.now()); } dirty = false; local = clone(S); lm = clone(matchWeeks); }
      subscribeCloud(local, lm); store.ready = true; render(); loadOwner(); loadAccounts();
    } else {
      if (started) { location.reload(); return; }
      store.mode = "local"; store.ready = true; render();
      let skip = false; try { skip = localStorage.getItem(FB_SKIP_KEY) === "1"; } catch { /* ignore */ }
      if (!skip && !sheetFn) openSheet(signInSheet); else maybeOnboard();
    }
  });
}
async function loadSeed() {
  if (store.mode !== "cloud") { toast("Sign in first"); return; }
  try {
    const seed = await (await fetch("seed.json", { cache: "no-store" })).json();
    for (const [id, s] of Object.entries(obj(seed.seasons))) await store.db.doc("seasons/" + id).set(s);
    for (const [id, e] of Object.entries(obj(seed.events))) await store.db.doc("events/" + id).set(e);
    toast("Season and event history loaded");
  } catch (e) { toast("Couldn't load the season list. Try again."); }
}
Object.assign(A, {
  signIn: () => { fbui.err = ""; openSheet(signInSheet); },
  signInGoogle: () => doSignIn("google"),
  signInApple: () => doSignIn("apple"),
  skipSignIn: () => { try { localStorage.setItem(FB_SKIP_KEY, "1"); } catch { /* ignore */ } closeSheet(); maybeOnboard(); },
  signOut: async () => { store.signingOut = true; try { if ("caches" in window) await caches.delete("snapstat-notify"); } catch { /* fine */ } if (typeof natAlerts === "function" && natAlerts()) try { SnapStatNative.setAlerts(JSON.stringify({ prefs: { on: false }, saved: Date.now() })); } catch { /* older app */ } try { localStorage.removeItem(FB_SKIP_KEY); localStorage.removeItem("snapstat.slot"); localStorage.removeItem("snapstat.accounts"); } catch { /* ignore */ } try { await store.fb.signOut(); } catch { /* ignore */ } location.reload(); },
  saveFbConfig: () => { const cfg = parseFirebaseConfig($("#fb-cfg").value); if (!cfg) { fbui.cfgText = $("#fb-cfg").value; fbui.cfgErr = "That doesn't look like a firebaseConfig block. It needs apiKey, authDomain, projectId and appId."; refreshSheet(); return; } try { localStorage.setItem(FB_CFG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ } location.reload(); },
  loadSeed: () => loadSeed(),
});
document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.fbcfg) fbui.cfgText = e.target.value; });
