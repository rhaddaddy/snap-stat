/* ============ AI keys checked every time SNAP Stat opens (Nov 14) ============
   Screenshots weren't read until "Test it" was tapped: the test re-finds Gemini's working way and models and wakes up a
   resting service. Now that same test runs on its own when the app opens (and when it comes back after 10+ minutes), one
   service after another, then the pictures waiting on the phone or in the reading window are read. */
const aiAuto = { at: 0, busy: false };
async function aiAutoCheck() {
  if (aiAuto.busy || !window.SNAPSTAT_STANDALONE || typeof aiKeyTestRun !== "function") return;
  const list = aiOrder().filter((p) => aiKeyFor(p)); if (!list.length) return;
  aiAuto.busy = true; aiAuto.at = Date.now();
  const bad = [];
  try {
    for (const p of list) {
      try { const r = await aiKeyTestRun(p); if (!obj(r).ok) bad.push(`${AI_PROVIDERS[p].name}: ${obj(r).msg || "didn't answer"}`); }
      catch (e) { aiTests[p] = { ok: false, msg: errText(e) }; bad.push(`${AI_PROVIDERS[p].name}: ${errText(e)}`); }
    }
  } finally { aiAuto.busy = false; aiWaitNow = 0; }
  setupAI();
  if (bad.length === list.length) toast(`AI key check: ${bad[0]}. Screenshots wait until it works (Settings › AI).`);
  aiAutoResume();
  try { if (ui.tab === "settings") render(); else if (sheetFn) refreshSheet(); } catch { /* next render */ }
}
// Pictures that were waiting for a working key get read now
function aiAutoResume() {
  if (!canReadShots()) return;
  try { if (NATIVE && typeof natPull === "function") natPull(); } catch { /* older app */ }
  try {
    if (typeof shots !== "object" || shots.busy) return;
    const wait = shots.items.filter((y) => !y.done && y.file && !y.native); if (!wait.length) return;
    shots.items = shots.items.filter((y) => !wait.includes(y));
    readShots(wait.map((y) => y.file));
  } catch (e) { errNote("reading waiting screenshots", e, true); }
}
setTimeout(() => { aiAutoCheck(); }, 2500);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - aiAuto.at > 10 * 60e3) aiAutoCheck(); });
