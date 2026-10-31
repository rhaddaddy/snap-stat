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
  `.github/workflows/android.yml` → signed APK published to the GitHub release tagged `android` (1.20 live; next build adds the web shop sign-in pop-up). Signing key is
  the `ANDROID_KEYSTORE` secret, never in the repo. Build failures are saved to the `android-build-log` branch.
- Backend: Firebase Auth (Google) + Firestore (`firestore.rules`; Ryan pastes rule changes into the Firebase console himself).
  `firebase-config.js` + `firebase-init.js` load it. AI keys (Gemini, Claude, ChatGPT, Grok, Perplexity) stay on the device;
  `relay/worker.js` is an optional Cloudflare relay for providers that block browsers.
- Daily data (`.github/workflows/update-cards.yml`, 10:23 and 19:17 UTC; `update-faces.yml` 20:41 UTC) run `scripts/*` and
  commit the JSON data files. Bots commit to main often: always `git pull --rebase` before pushing.
- Commits end with the Co-Authored-By and Claude-Session lines from the session's attribution reminder.
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
  search. New features should be a new `src/y2N_*.js` (next free number) that registers here instead of editing shared views.
- Not built yet (from the new project rules): an on-screen global error toast and a Dev/Preview toggle.

## 3. File map (src/, in build order; KB = size)
Data & state: `S` (saved state, c_core) · `ui` (view state) · matches in `matchWeeks` via `realMatches() putMatch(m) removeMatch(id)`
· `card(k) allCards() allVariants() S.decks seasons() events() statsFor(ms) periods()` · `save()` writes device + Firestore.
- `a_head.html` 66 · page shell, all CSS and themes (GIANT: split CSS into a separate file later)
- `b_data.js` 10 · starter card list · `b2_cards.js` 10 · deck-code card ids · `b3_ext.js` 3 · EXT extension lists
- `c_core.js` 66 · helpers, S/ui, matches, stats, cardChip/cardFace, toast, sheets, save (GIANT: split later)
- `c2_catalog.js` 17 · card-data.json (CAT), art, variants, imgTag/artFail · `c3_extras.js` 59 · balance history, notifications,
  account delete, misc (GIANT) · `c4_clock.js` 9 · 19:00 UTC reset clock, countdowns
- `d_home_play.js` 39 · Home overview, period chips, play views · `e_collection.js` 32 · Cards tab, cosmetics, variants
- `f_decks.js` 27 · decks and deck sheet · `g_social.js` 28 · onboarding, profile setup, social feed
- `h_more.js` 37 · shops, promos, seasons, events, locations views · `j_import.js` 15 · SnapVault import
- `i_actions.js` 57 · render(), routing, VIEWS, the `A` actions object (GIANT) · `l_features.js` 85 · insights, albums, planner,
  splits, deck versions, alliance week, tournaments (GIANTEST: split first) · `n_more.js` 68 · draw odds, rivals, coach chat,
  missions, credits planner (GIANT) · `p_more.js` 47 · timeline, pack planner, replays, recaps
- `q_auto.js` 67 · AI screenshot reading, auto-fill numbers, shared files (GIANT) · `r_native.js` 18 · Android bridge
  (`window.SnapStatNative`) · `t_progress.js` 26 · boosters, upgrades, splits, borders · `u_look.js` 27 · profile pictures, banners
- `w_wish.js` 11 · owned-variant fill, wishlist alerts · `x_nav.js` 20 · bottom tabs Home/Cards/Social/Profile/Settings + sections
- `y_data.js` 2 · promo/season-art/card-back data · `y2_more.js` 55 · locations, deck icons, card backs, PC collection file (GIANT)
- `y3_ideas.js` 14 · matchups, variant goals · `y4_more.js` 38 · Track & play, web shop, numbers, event passes, alliance, deck tags
- `y5_emotes.js` 10 · `y6_auto.js` 10 · albums/missions from screenshots · `y7_more.js` 33 · weekly challenge, bundles, pass track
- `y8_plans.js` 14 · mission/bounty decks, pass pace, token planner · `y9_turns.js` 13 · event currencies, play-by-play
- `y10_update.js` 3 · self-update · `y11_collect.js` 13 · collectibles · `y12_looks.js` 22 · Custom Cards, avatars, titles
- `y13_sweep.js` 7 · Update everything · `y14_pc.js` 41 · PC tracker (File System Access API on the game's nvprod folder)
- `y15_stats.js` 33 · stats & coaching · `y16_decks.js` 31 · deck tools · `y17_collection.js` 34 · Cards › Plan
- `y18_home.js` 44 · search, shortcuts, Home layout switches (`homeShow(id)`) · `y19_social.js` 37 · share pictures, bounties
- `y20_knowledge.js` 45 · glossary, tips, News (needs a news.json job) · `y21_tracker.js` 14 · tracker health, match buzz
- `y22_live.js` 26 · live match helper · `y23_history.js` 10 · data-request history import (milestone dates only)
- `y24_swipe.js` 6 · finger-following section swipe: `swipeLock/swipeMove/swipeEnd`, preview `.view-peek` drawn from `VIEWS`
  (x_nav.js keeps `swipeBlocked`, `swipeTarget(dir)`, `swipeSection(dir)`); commit = pushState + route() in one frame
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
`TrackerTile` Quick Settings tile. Res: `values/themes.xml` + `values-night/`, `xml/shortcuts.xml`.

## 4. Status (October 30, 2026)
- Last working code commit before this push: `b81d70e`. This push: "Swipe pages follow your finger; web shop Google sign-in".
  UNDO = `git revert` that commit (bots commit data files to main in between, so revert, don't reset).
- Oct 30 night: section swipe now follows the finger (preview of the next section, springs back under 30%, flick works,
  wraps last→first, Back works); Playwright swipe test passed. Web shop: Google sign-in ended on a blank white page because
  the WebView had no pop-up support (GSI popup replaced the shop, then had no opener); fixed in WebShopActivity, untested on a
  real phone yet. Earlier: 65 automatic Playwright tests + a full page crawl passed (Oct 30 update)
  In the repo now: `tests/check.sh` (serves the root via `tests/serve.py` with `tests/mock-firebase-init.js`, a fake offline
  sign-in, then `tests/crawl.cjs` opens every page and panel, dark + light, signed out + in; about 1.5 min). The other 64
  feature tests stayed in the old session (some used Ryan's real exports, so they can't go in this public repo).
- Locked working features (don't change without being asked): match tracking (manual, AI screenshots, Android Track & play,
  PC tracker), SnapVault sync, game-file import, collection/variants/cosmetics, decks, stats & rank maths, seasons/events/
  shops/missions, alliance & social, profile pictures, widget & notifications, self-update, history import.
- Waiting on Ryan: install 1.20, try the PC tracker, import his history zip.
- Open decisions: deleted SnapVault decks return on next sync; two phones saving the same week at once (last save wins);
  News needs a daily news job; no retreat-on-final-turn PC game seen yet.
- Next tech to-dos: split the GIANT files (l_features, n_more, q_auto, c_core, a_head CSS), add a global error toast +
  preview toggle, write feature tests (made-up data only) under `tests/`.
