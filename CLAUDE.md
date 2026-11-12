# SNAP Stat: master notes for Claude (read first, keep under 150 lines, overwrite, never append history)

Fan-made MARVEL SNAP companion. Owner: Ryan, a non-coder on a Samsung phone. Reply in plain English, never paste code in chat.
Live: https://rhaddaddy.github.io/snap-stat/ · Repo: rhaddaddy/snap-stat · Firebase project: snap-stat-9549f

## 0. Every new chat: do this first, without asking
1. Repo: if `/home/claude/snap-stat` is missing, attach rhaddaddy/snap-stat with push access, clone it there and register it.
   Then `git config user.name Claude && git config user.email noreply@anthropic.com && git pull --rebase`.
2. Read this file. Read the Project doc "claude/SNAP Stat setup checklist.md" only when the task touches Ryan's own to-dos.
3. Standing approval from Ryan (don't ask him first): edit `src/`, `android/`, `scripts/`, workflows and data files; build;
   run `bash tests/check.sh`; commit and push to `main` (that publishes the web app and, for `android/**`, the Android
   release); update this file and the Project checklist doc; publish summary pages as artifacts.
4. Still stop and ask (or hand Ryan tap-by-tap steps) only for: a product goal that is really unclear; deleting his data,
   branches or releases; anything that costs money; anything needing his own logins (Firebase console rules, GitHub
   secrets, Google Play/Cloud, installing on his phone or PC).
5. Every change: `git pull --rebase` → edit `src/` (a new feature = a new `src/y2N_*.js`, next free number, on `EXT`) → build
   (section 1) → `bash tests/check.sh` must print ALL GOOD twice → copy `index.html` + `version.json` to the root → update
   this file → ONE commit → `git pull --rebase` (other chats push too: merge their CLAUDE.md edits, never drop them) → push →
   `gh run list --limit 4` until Pages (and Android, if touched) show success.
6. Tool quirks: `gh` GraphQL is blocked (`gh release list` fails), so use `gh run list` and `gh api repos/rhaddaddy/snap-stat/...`;
   the GitHub Pages API is blocked; the shell reaches only GitHub and package registries; WebFetch only works on links Ryan
   pasted; Playwright is preinstalled (`require('playwright')`, never reinstall it).
7. Reply to Ryan as "Done:" (1-3 plain bullets) and "Test:" (one sentence). Steps for him: every tap, plain words.

## 1. Stack & publish
- Web app: plain JavaScript, no framework, no bundler, no npm at runtime. One global script built from `src/` into `index.html`.
- Build (the only way to change the app; never hand-edit `index.html`):
  `cd src && mkdir -p ../fb && cp ../firebase-init.js ../fb/ && bash build.sh` → writes `/home/claude/snap-stat-firebase/index.html`
  and `version.json` (+ `/home/claude/cube-ledger.html`, offline copy). Copy those two files to the repo root, then `rm -rf ../fb`.
- Build order = the `CORE` list in `src/build.sh`, then `k_firebase.js`, `z_boot.js`. Top-level `const`/`let` can only be used by
  LATER files (one global scope, TDZ). `node --check` runs inside build.sh.
- Publish: push to `main` → GitHub Pages serves the repo root (~1 min). The app checks `version.json` and reloads itself.
- Android app (`android/`, Kotlin WebView wrapper, package com.rhaddaddy.snapstat): any push touching `android/**` runs
  `.github/workflows/android.yml` → signed APK published to the GitHub release tagged `android` (1.24 = Nov 11 widget edge + see-through). Signing key is
  the `ANDROID_KEYSTORE` secret, never in the repo. Build failures are saved to the `android-build-log` branch.
- Backend: Firebase Auth (Google) + Firestore (`firestore.rules`; Ryan pastes rule changes into the Firebase console himself).
  `firebase-config.js` + `firebase-init.js` load it. AI keys (Gemini, Claude, ChatGPT, Grok, Perplexity) stay on the device;
  `relay/worker.js` is an optional Cloudflare relay for providers that block browsers.
- Daily data (`.github/workflows/update-cards.yml`, 10:23 and 19:17 UTC; `update-faces.yml` 20:41 UTC) run `scripts/*` and
  commit the JSON data files. Bots commit to main often: always `git pull --rebase` before pushing.
- Commits end with the Co-Authored-By and Claude-Session lines from the session's attribution reminder.
- EVERY push that adds, changes or removes a feature adds entries at the top of `CHANGES` in `src/b4_changes.js` (id, date, kind
  new/better/fixed/removed, title, body, where, test steps). It drives What's new for everyone and the owner's "Test this update"
  checklist (Settings › App owner, pops up once per build). Never skip it.
- Firestore rules changes: tell Ryan to paste `firestore.rules` (Firebase › Firestore › Rules › Publish). Oct 31: bugs, config/flags, h2h,
  ally chat, races. Nov 11: bugs `files <= 20` (the app sends files ≤ 8 + `nfiles`, so it works before he pastes it).
- Saves to Firestore go through `fsEnc`/`fsDec` (c_core): lists in lists, empty/`__x__`/`$` keys, depth > 16 are encoded. Keep it on every set/get.
- Rules: never put the owner's email, account ids, tokens, purchases or payment data anywhere, including this file and tests
  (`tests/check.sh` stops if any email address is in `index.html`). Web shop window must never save card/bank details. Never copy values from Ryan's real game
  files or data request into code or tests. Never suggest turning Play Protect off.
- Game rules used everywhere: 7 cubes per rank; cubes double per snap up to 8 and again when the final turn ends; ties left out
  of win %; rank maths uses Ranked only; daily reset 19:00 UTC, mission refresh every 8 h; bundles valued at 80 gold per $1.

## 2. Design system & shared UI
- No `ui/` folder (no framework): the shared kit is CSS classes in `src/a_head.html` + HTML-string helpers in `src/c_core.js`.
- Theme tokens (`:root` in a_head.html, light/dark/true-black): `--bg --bg-2 --surface --surface-2 --line --fg --muted`,
  accent `--snap-a --snap-b --snap-ink --snap-text --snap-soft`, `--cost --power --cube --win --loss --tie --warn`,
  fonts `--comic` (display) `--ui` `--body`, radius `--r`. Never hard-code colours in HTML.
- Building blocks: `section.sec` + `.sec-h h2`, `.panel(.stack .small)`, `.list > .li (.grow .t .s)`, `.tiles > .tile (.k .v)`,
  `.kpis > .kpi`, `.chips > .chip[aria-pressed]`, `.chiplist`, `.seg`, `.grid2`, `.row`, `.eyebrow`, `.pill(.W .warn .dim .gold)`,
  `.btn(.snap .ghost .sm .block .danger)`, `.muted .small .num .pos .neg`, `.empty` (strong + span), `.tbl-wrap > table`,
  `label.check`, `label.f`, `.note`, `.bar`. Phone first (390 px): no sideways scroll, taps ≥ 40 px, light + dark both checked.
- Helpers: `esc()` (ALWAYS for data/user text), `safeUrl()` (https only), `fmt num arr obj clone uid keyOf pct signed cubes()`,
  `cardChip(k, opts)` small card with art, `cardFace(c, opts)` big card tile, `nameChip(name)`, `toast(msg)`,
  `openSheet(fn)` / `sheetHead(title, sub)` / `refreshSheet()` / `closeSheet()`, `go("tab/section")`, `render()`.
- Actions: buttons use `data-a="name"` → `A.name(el, e)` (object `A` in i_actions.js; later files `Object.assign(A, {...})`).
- Extension points (`src/b3_ext.js`, `EXT.*`): homeTop, homeStats, homeSubs, cardsSubs, socialSubs, settingsSubs, settingsApp,
  settingsData, cardSheet, deckSheet, deckTabs, matchSheet, liveMatch, profile, onMatch, afterRender, alerts, topBar, styles,
  search, about, owner (+ y-file hooks: settingsAndroid, alliance, playerSheet, reviewTools). New features = a new `src/yN_*.js`.
  Feature switches: `flagOn(id)` (y32, list in y32a_data.js FLAG_LIST, owner sets Off/Just me/Everyone in config/flags).
  Wrapping a shared function is done by reassigning it (`const _x = fn; fn = () => …`, see profileExtras, widgetState).
  Global names must be unique across src (one scope): check with a duplicate-name scan before building.
- Problems on screen (`src/b5_errors.js`): `errNote(where, e, quiet)` logs to `ERRLOG` (last 30, sent with bug reports) and shows a red
  bar with Report it; `render()`, `refreshSheet()`, every `data-a` button and every EXT hook are wrapped, so a failing page shows
  `errPageHtml()` instead of going blank. Owner Preview panel (y32): tour, safe page, problem bar, update notes, store shots.

## 3. File map (src/, in build order; KB = size)
Data & state: `S` (saved state, c_core) · `ui` (view state) · matches in `matchWeeks` via `realMatches() putMatch(m) removeMatch(id)`
· `card(k) allCards() allVariants() S.decks seasons() events() statsFor(ms) periods()` · `save()` writes device + Firestore.
- `a_head.html` 66 page shell + all CSS (GIANT) · `b_data` starter cards · `b2_cards` deck-code ids · `b3_ext` EXT lists · `b4_changes`
  CHANGES · `b5_errors` on-screen errors · `c_core` 66 helpers, S/ui, matches, stats, sheets, save (GIANT) · `c2_catalog` CAT, art,
  variants · `c3_extras` 59 balance, notifications, AI calls (`aiJson(prompt, {images})`, `aiOn()`) · `c4_clock` reset clock, widgetState
- `d_home_play` Home, play views, match form `mf` · `e_collection` Cards · `f_decks` decks + deck sheet · `g_social` onboarding,
  profile, feed (`allPosts`, `postHtml`, `reactionsFor`) · `h_more` shops, promos, seasons, events, About · `j_import` SnapVault
- `i_actions` render(), routing, `A`, loadExamples · `l_features` 85 insights, albums, deck versions (`d.history`), alliance week,
  tournaments (GIANTEST) · `n_more` 68 draw odds, rivals, goals (`GOAL_KINDS`), BADGES, credits · `p_more` timeline, packs, replays,
  overlay · `q_auto` 67 AI screenshot reading (GIANT) · `r_native` Android bridge (`NATIVE`, `natCan`, `natInfo`) · `t_progress`
  boosters/upgrades/splits (`prog(k)`, `STEP`) · `u_look` pictures, banners (`lookOf`) · `w_wish` wishlist alerts · `x_nav` tabs, NAV
- `y_data` · `y2_more` locations, card backs, PC file · `y3_ideas` matchups, variant goals · `y4_more` Track & play, web shop,
  alliance · `y5_emotes` · `y6_auto` missions from shots · `y7_more` weekly challenge, bundles, `shotLogAll()` · `y8_plans` mission
  decks (`missionTest`), pass pace · `y9_turns` event currencies, play-by-play · `y10_update` · `y11_collect` · `y12_looks` Custom
  Cards (S.looks) · `y13_sweep` · `y14_pc` PC tracker · `y15_stats` · `y16_decks` · `y17_collection` Cards › Plan · `y18_home`
  search, Home switches (`homeShow`, `.ext = {id,label}`), reminders (EXT.alerts) · `y19_social` share pictures (`makePic`),
  `profileExtras` · `y20_knowledge` · `y21_tracker` tracker health, `buzz()` · `y22_live` live helper · `y23_history`
- `y24_swipe` swipe anywhere (`swipeHolding()`, `swipeReset()`, x_nav `swipeBlocked`/`swipeTarget`; `.hscroll`/[data-noswipe])
- `y25_report` Report a bug (`bugOpen`, queue `snapstat.bugQueue`, `S.myBugs`, `bugCheckMine`) · `y26_owner` bug inbox, owner tests
- `y27_reading` · `y28_months` · `y29_decklook` · `y30_mastery_data` · `y31_mastery` `masteryOf(k)`, `masteryWays`, S.looks2
- Oct 31 batch (Ryan's 100 ideas, #2-100; #1 shared AI skipped): `y32a_data`/`y32_publish` tour, safe-mode hooks (inline script at
  the top of a_head.html, `window.__snapBootOk`), Status in About, store screenshot mode, `allMyData()`, flags, bug alerts, update
  notes · `y33a_data`/`y33_fun` trivia, card of the day, BADGES+12, overlay styles (wraps overlayData/Html/Panel), seasonal looks,
  sfx(), new-card quiz, What-if board, photo mode, Year in SNAP · `y34_matches` opp deck guess, snapCall(), retreat regrets, deck
  location tab, replay viewer, rematch alerts, autoTags(), voice notes (IndexedDB snapstat-voice), battery saver, session card ·
  `y35_coach` tilt 2.0, break/hour/snap stats, Infinite date, meta, h2h (h2h/{uid}), weekly goals, AI letter, luck() · `y36b_qr`
  QR encoder (verified with OpenCV) · `y36_decks` link import, health, swap test, folders + auto-retire (`deckInFolder` in vDecks),
  timeline, cheat sheet, hand odds, QR sheet, Build around · `y37_collect` Cards › More tools (10 tools: Mastery 22, splits, cache
  log, price log, artists, value, Series watch, Spotlight, Custom Card gallery, albums) · `y38_seasons` pass date, event shop plan,
  Home › Mission helper (missions from matches, weekly route, Conquest, event currency), season story, .ics export, missed rewards
  · `y39_shops` Home › Shop helper (9 tabs; wishlist in profileExtras) · `y40_social` alliance chat + bounty claims, races, Deck
  lab, alliance board, badges, auto banner, follow suggestions, live tourney scores, post later · `y41_android` lock-screen note
  route `#quicklog=W` / `#playdeck=id` (wraps window.snapNative.on), pop-up tip + mini layout, vibration patterns, deck shortcuts,
  widget wallpaper/offline (wraps widgetLook/widgetState), weekly backup + Drive share, battery & data. `terms.html` at the root.
- Nov 11 (Ryan's 17 reports): `y42_nav` name menu (`meMenu`, Profile/Settings off the bottom bar unless `S.navFull`), tabs open where you
  left off (`S.tabOpen`, localStorage `snapstat.tabLast`), `#subfloat` sections row on scroll-up · `y43_cards` `myVariant(k, d)` (deck variant ›
  Custom Card `S.looks[k].v` › favourite), deckPublic `art` map, sharedDeckHtml/artFail backup art (`data-alt`, LK_HOST), draft row, AI
  builder live search (`aiSuggHtml`) · `y44_more` SnapVault match CSV import (`svcRows`, ids `svc-…`, `svFile`, Diner `eventGain` Bubs;
  bulk via c_core `matchBulk` (onMatch isNew=false), then `onMatchSaved` once; `svcLinkDecks` by name; j_import sync skips logged games), About › On iPhone. Also: y25 reports (20 files, page picker `bug.page`, `bugMineSheet`, `bugTellChange` notifies via showAlert),
  y26 test marks in localStorage too + Checked features + `otShot` bar, y24 quick flick (`swipe.quick`) + prewarmed neighbours (`swipe.pre`),
  y41 widget `S.widgetBg` app/clear/you, `widgetKeepAccent`, `widgetShade`; Widget.kt `bg`/`keepAccent`/`shade`; res `@dimen/widget_radius`.
- `k_firebase.js` 7 · Firebase sign-in/storage · `z_boot.js` · boot, flush on pagehide · `build.sh` · `README.md`
Tests `tests/`: `check.sh` (run before every push) · `serve.py` test server · `mock-firebase-init.js` fake sign-in · `crawl.cjs`.
Root: `index.html` (BUILT, 1.4 MB: never edit or read whole) · `version.json` · `sw.js` (service worker: share target,
notifications) · `manifest.webmanifest` · `privacy.html` · `native-signin.html` · `firestore.rules` · `tracker-rules.json`
(Android tracker words, versioned) · `seed.json` · icons.
Daily data (written by scripts, read-only for the app): `card-data.json` ← update-cards.mjs · `schedule.json` ←
update-schedule.mjs (hand-made corrections go in `schedule-overrides.json`) · `balance-history.json` ← update-history.mjs · `variant-details.json` ←
update-variants.mjs · `albums.json` · `packs.json` · `promo-codes.json` · `webshop.json` · `borders.json` + `borders/` ←
update-borders.py · `art.json` + `cardbacks/` ← update-art.py · `faces.json`, `faces-log.json` ← update-faces.py.
Android `android/app/src/main/java/com/rhaddaddy/snapstat/`: `MainActivity` WebView host · `Bridge` JS bridge · `TrackerService`
screen-capture tracker · `Screenshots` + `ShotQueue` picture reading queue · `Rules` tracker rules · `Usage` usage access ·
`Updater` self-update from releases · `Alerts` notifications · `Widget` home widget · `WebShopActivity` web shop window (pop-ups like
Google sign-in open as a second WebView over the shop via onCreateWindow, so window.opener works) ·
`TrackerTile` Quick Settings tile · `StatusNote` lock-screen reset countdown + Won/Lost/Tie · `EventWidget` event countdown
widget (layout widget_event, xml/event_widget_info) · Bridge: setStatusNote, setBatterySaver, trackerStats, setDeckShortcuts. Res: `values/themes.xml` + `values-night/`, `xml/shortcuts.xml`.
Widget colours: the web app sends `look` (mode, black, accent a/b/ink/text/lightText) in `widgetState()`; `Widget.paint()` tints
ImageView layers (`w_bg`, `w_glow`, `w_edge`, `w_play_bg/hi`) and texts (ids in `WidgetIds.kt`); Auto follows the phone on 12+ via
`RemoteViews.setColorInt`. No Android SDK in the sandbox: Kotlin is only checked by the GitHub build (see android-build-log).

## 4. Status (November 11, 2026)
- This push: "Fix Ryan's 17 reports + SnapVault match CSV" (y42-y44, Android 1.24). Previous code commit: `81ac7c8` (Oct 31, 100 ideas).
  UNDO = `git revert` that commit (bots commit data files in between: revert, don't reset).
- Root cause of "Couldn't save", the tour returning and test answers returning: Firestore rejected the state (nested arrays from AI
  readings) → `fsEnc`. check.sh ALL GOOD both ways; Playwright checks for menu, tabs, subfloat, reports, draft, AI search, CSV, flicks.
- Locked working features (don't change without being asked): match tracking (manual, AI screenshots, Android Track & play,
  PC tracker), SnapVault sync + CSV, game-file import, collection/variants/cosmetics, decks, stats & rank maths, seasons/events/
  shops/missions, alliance & social, profile pictures, widget & notifications, self-update, history import, bug reports.
- Waiting on Ryan: paste firestore.rules (files ≤ 20), install Android 1.24, run the owner test list. Card art in posts: couldn't
  reproduce the blank cards (art hosts blocked in the sandbox); added eager loading + backup art; ask for a new report if it recurs.
- Report-status notifications only come when the app opens (no server push; FCM would need a server). Kotlin untested locally.
- To-do: split GIANT files; feature tests (made-up data) in tests/. Open: deleted SnapVault decks return on sync; two phones saving one week (last wins); News needs a daily job. AI keys stay per player.
