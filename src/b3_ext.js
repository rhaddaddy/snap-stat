/* ============ Extension points ============
   Later files add features by registering here instead of editing the shared views. Every list holds functions; a function
   that throws is skipped (and logged), so one broken feature can't blank the app. Register at the top level of your file:
     EXT.homeTop.push(() => `<section class="sec">…</section>`);
   The order of the build (build.sh) is the order on screen. */
const EXT = {
  homeTop: [],       // () => html · Home › Overview, under the clock and shop panels, before the match stats
  homeStats: [],     // () => html · Home › Stats, after the cards & locations and decks tables
  homeSubs: [],      // [key, label, () => html] · an extra section along the top of Home
  cardsSubs: [],     // [key, label, () => html] · an extra section along the top of Cards
  socialSubs: [],    // [key, label, () => html] · an extra section along the top of Social
  settingsSubs: [],  // [key, label, () => html] · an extra section along the top of Settings
  settingsApp: [],   // () => html · panels at the end of Settings › App
  settingsData: [],  // () => html · panels at the end of Settings › Import & backup
  cardSheet: [],     // (k) => html · a card's sheet, after the existing extras
  deckSheet: [],     // (d) => html · the deck sheet's Cards tab, after the card list
  deckTabs: [],      // [key, label, (d) => html] · an extra tab in the deck sheet
  matchSheet: [],    // (mf) => html · the match form, above the Save button (mf is the form state; mf.id, mf.isNew)
  liveMatch: [],     // () => html · Home › Live match while a match is on, under the board
  profile: [],       // () => html · the Profile tab, after your details
  onMatch: [],       // (m, isNew) => void · a match was saved (new, edited or merged)
  afterRender: [],   // () => void · after the page or a sheet was drawn (draw canvases, attach observers)
  alerts: [],        // () => [{ id, at, until, title, body, route, pref }] · reminders the phone shows once, between at and until (ms)
  topBar: [],        // () => html · small buttons in the top bar, next to your profile chip
  styles: [],        // css text, added to the page once
  search: [],        // (q) => [{ label, sub, route }] · results for the global search
};
// Runs each registered function and joins what they return; a broken one is logged and skipped.
function extHtml(list, ...args) {
  let out = "";
  for (const f of arr(list)) { try { out += f(...args) || ""; } catch (e) { console.error("extension", e); if (typeof errNote === "function") errNote(`a panel${f.name ? ` (${f.name})` : ""}`, e); } }
  return out;
}
function extRun(list, ...args) { for (const f of arr(list)) { try { f(...args); } catch (e) { console.error("extension", e); if (typeof errNote === "function") errNote(`a background step${f.name ? ` (${f.name})` : ""}`, e); } } }
// An optional 4th item says whether the section shows right now (it stays reachable by its address)
function extSubs(list) { return arr(list).filter((x) => { if (!Array.isArray(x) || !x[0] || !x[1]) return false; try { return typeof x[3] !== "function" || !!x[3](); } catch { return false; } }).map(([k, l]) => [k, l]); }
function extBody(list, key) { const x = arr(list).find((x) => Array.isArray(x) && x[0] === key); return x ? () => extHtml([x[2]]) : null; }
let extStyled = false;
function extStyles() {
  if (extStyled || !EXT.styles.length) return; extStyled = true;
  const st = document.createElement("style"); st.id = "ext-styles"; st.textContent = EXT.styles.join("\n"); document.head.appendChild(st);
}
