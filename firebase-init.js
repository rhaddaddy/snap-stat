// Connects SNAP Stat to your Firebase project: Google/Apple sign-in and the Firestore database.
// Loads Firebase from Google's CDN. The settings come from firebase-config.js (or the in-app setup screen).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { initializeFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// In the SNAP Stat Android app, Google sign-in happens in Chrome (Google blocks it inside apps), which hands back a Google token.
const inAndroidApp = () => !!window.SnapStatNative;
function googleFromApp() {
  return new Promise((resolve, reject) => {
    window.__snapNativeToken = (token) => { window.__snapNativeToken = null; token ? resolve(GoogleAuthProvider.credential(token)) : reject(new Error("Sign-in didn't finish. Try again.")); };
    window.SnapStatNative.openSignIn();
  });
}

function readConfig() {
  const c = window.FIREBASE_CONFIG;
  if (c && c.apiKey && !/paste/i.test(c.apiKey)) return c;
  try { const s = JSON.parse(localStorage.getItem("snapstat.firebaseConfig") || "null"); if (s && s.apiKey) return s; } catch (e) { /* ignore */ }
  return null;
}

const cfg = readConfig();
if (!cfg) {
  window.snapFirebaseNeedsConfig = true;
  window.__resolveFirebase(null);
} else {
  try {
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
    const snap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
    const wrapColl = (ref) => ({
      path: ref.path,
      doc: (id) => wrapDoc(id ? doc(ref, id) : doc(ref)),
      onSnapshot: (next, err) => onSnapshot(ref, (qs) => next({ docs: qs.docs.map(snap), size: qs.size, empty: qs.empty, metadata: qs.metadata }), err),
    });
    const wrapDoc = (ref) => ({
      id: ref.id, path: ref.path,
      get: () => getDoc(ref).then(snap),
      set: (d) => setDoc(ref, d),
      update: (d) => updateDoc(ref, d),
      delete: () => deleteDoc(ref),
      onSnapshot: (next, err) => onSnapshot(ref, (s) => next(snap(s)), err),
      collection: (p) => wrapColl(collection(ref, p)),
    });
    // Sign-in that arrives from Chrome after the page reloaded (Android app)
    window.__snapSignInToken = (token) => signInWithCredential(auth, GoogleAuthProvider.credential(token));
    window.__resolveFirebase({
      db: { doc: (p) => wrapDoc(doc(fs, p)), collection: (p) => wrapColl(collection(fs, p)) },
      onAuth: (fn) => onAuthStateChanged(auth, fn),
      signIn: (kind) => {
        if (inAndroidApp() && kind !== "apple") return googleFromApp().then((cred) => signInWithCredential(auth, cred));
        const p = kind === "apple" ? new OAuthProvider("apple.com") : new GoogleAuthProvider();
        if (kind === "apple") { p.addScope("email"); p.addScope("name"); }
        return signInWithPopup(auth, p);
      },
      signOut: () => signOut(auth),
      // Removes the sign-in account itself. Firebase asks you to confirm with Google again if you signed in a while ago.
      deleteAccount: async () => {
        const u = auth.currentUser; if (!u) return;
        try { await deleteUser(u); }
        catch (e) {
          if (e && e.code === "auth/requires-recent-login") {
            const apple = u.providerData.some((p) => p.providerId === "apple.com");
            if (inAndroidApp() && !apple) await reauthenticateWithCredential(u, await googleFromApp());
            else await reauthenticateWithPopup(u, apple ? new OAuthProvider("apple.com") : new GoogleAuthProvider());
            await deleteUser(u);
          } else throw e;
        }
      },
    });
  } catch (e) {
    console.error(e);
    window.__resolveFirebase(undefined);
  }
}
