/* ============ Less typing: screenshots shared from Android (or picked several at once) are read by AI and logged,
   your numbers (rank, Collection Level, currencies) come from screenshots, and matches can flow in from a snap.fan link ============ */
const dataReady = () => store.ready && (store.mode !== "cloud" || (store.stateLoaded && store.matchesLoaded));
const whenDataReady = (fn, tries = 0, fail) => { if (dataReady()) fn(); else if (tries < 120) setTimeout(() => whenDataReady(fn, tries + 1, fail), 500); else if (fail) fail(); };

/* ---------- Reading any MARVEL SNAP screenshot ---------- */
const shots = { items: [], busy: false };
function shotHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); }
// Game modes to choose from: the standard ones plus events and limited-time modes running around now
const modeNames = () => [...new Set([...MODES.filter((m) => !["Other", "Event", "Limited-time mode"].includes(m)), ...events().filter((e) => e.endTs > Date.now() - 30 * DAY && e.startTs < Date.now() + 7 * DAY).map((e) => String(e.name))])];
const SCREEN_NAMES = { reward: "reward pop-up", cosmetics: "avatars, titles, card backs or emotes", collection: "collection", alliance: "alliance", event: "event pass", eventshop: "event shop", seasonpass: "season pass", shop: "shop (offers and bundles)", shopcurrency: "shop's Credits and Gold", shoptokens: "shop's Collector's Token", shopmedals: "Conquest medal shop", home: "home", albums: "variant albums", missions: "missions", card: "card upgrade", split: "card split result", collectionlevel: "Collection Level" };
// What each screen's top bar shows, so its numbers aren't mixed up (an event's currencies aren't Credits).
const TOP_BAR = "MARVEL SNAP's top bar shows two of the player's currencies. Top right, beside a gold bar in an orange box, is always Gold. Top left is Credits when its icon is a blue crystal shard in a blue box (the home screen and the shop's Offers tab), and Collector's Tokens when its icon is a purple token in a purple box (the shop's Cards tab). Put the top-left one in \"topLeft\" with its icon, and the top-right one in \"topRight\".";
const HOME_TIPS = "On the home screen: the number in the green badge under the player's picture (like 33,706) is the Collection Level; the small number at the right end of the Season Pass bar is the season pass level; the big number in the circle beside PLAY is the rank, and the one under it (like 4/7) is cubes toward the next rank.";
const NOT_YOURS = "Numbers inside offers, bundles, packs and price buttons (like 3,600, 500, 1,200 or 6,000) are things for sale, not the player's.";
const SCREEN_TIPS = {
  reward: "Read it as \"reward\": list everything the pop-up shows the player got. " + NOT_YOURS,
  cosmetics: "Read it as \"cosmetics\": every avatar, title, card back or emote shown, and whether the player has it (locked, greyed-out or priced ones they don't). Leave \"numbers\" out.",
  collection: "Read it as \"collection\": every card in the grid, by its name and art, with the booster number on it as shown (like 20 or 99+). Leave out the deck shown at the side.",
  home: "Read it as \"numbers\". " + TOP_BAR + " " + HOME_TIPS + " Collector's Tokens aren't shown on the home screen.",
  shop: "Read it as \"shop\". " + TOP_BAR + " " + NOT_YOURS + " Put each bundle or special offer in \"bundles\" with its price, everything in it and the time it has left.",
  shopcurrency: "Read it as \"shop\" (Credits and Gold offers, the Gold Pass and the free credits). " + TOP_BAR + " " + NOT_YOURS + " A red \"Available In 5h 17m\" on the free credits is \"freeCreditsIn\"; \"329 DAYS LEFT\" is \"goldPassDays\", and a timer under the Gold Pass's gold (like 13h 17m) is \"goldPassClaimIn\".",
  shoptokens: "Read it as \"shop\". This is the shop's Cards tab, so the number at the top left (purple box) is Collector's Tokens, not Credits. " + NOT_YOURS + " A CLAIMED! button under the free tokens means \"freeTokensClaimed\": true. Put each Daily Card (marked Pinned! if the player pinned it) in \"daily\", and each Collector's Pack or Seasonal Spotlight pack (COMPLETE! when the player has all its cards) in \"packs\".",
  shopmedals: "Read it as \"shop\" (the Conquest medal shop). The number at the top is Conquest medals.",
  seasonpass: "Read it as \"pass\": the season pass level, the points toward the next level (like 368/1,000), whether the player has the Premium pass (premium rewards without locks) and every level's rewards you can see on the track (the top row is free, the row with locks or the PREMIUM label is premium). " + TOP_BAR,
  collectionlevel: "Read it as \"numbers\". The player's Collection Level is the big number in the green box at the bottom (like 33,706); the smaller numbers along the track are levels still to come, so don't use them. \"NEXT 3000 IN: 24\" at the top means the next Collector's Tokens reward (3,000) comes in 24 more levels: put those in \"clNextReward\" and \"clNextIn\". This screen has no Credits or Gold.",
  event: "Read it as \"event\". The numbers along the top of an event's screens are that event's own currencies, not Credits or Gold, so leave \"numbers\" out. Write amounts in full (21.2K is 21200). In Deadpool\'s Diner the top bar has two currencies: Nachos (the shop\'s currency, with an N or nacho icon, like 560; the Diner shop\'s prices are in Nachos) and Bubs (earned by playing Diner matches, like 21.2K). Gold is at the top right and isn\'t an event currency.",
  eventshop: "Read it as \"event\" (the event's shop). The numbers along the top are the event's own currencies, not Credits or Gold, so leave \"numbers\" out. Put each item for sale in \"shop\" with its price, and SOLD! ones as sold. Write amounts in full (21.2K is 21200). In Deadpool\'s Diner the top bar has two currencies: Nachos (the shop\'s currency, with an N or nacho icon, like 560; the Diner shop\'s prices are in Nachos) and Bubs (earned by playing Diner matches, like 21.2K). Gold is at the top right and isn\'t an event currency.",
  alliance: "Read it as \"alliance\". Leave \"numbers\" out. ACTIVE BOUNTIES lists the bounties being worked on, each with its rarity (LEGENDARY, EPIC…), points and progress (like 10/70); PERSONAL 8/100 is the player's points toward their next milestone and ALLIANCE 8/4,000 the alliance's.",
  missions: "Read it as \"missions\". This screen scrolls: today's missions (\"Missions refill in 2h 10m\"), then the WEEKLY CHALLENGE (like 6/6 Missions, with HARD: missions and its points track), then the season's chapters (like VAMPIRES VS. ZOMBIES: CHAPTER 4, Insatiable Immortal), each COMPLETE or with its missions and their progress, and \"UNLOCKS IN 13H 29M\" on ones still locked. Read whichever parts you can see.",
  albums: "Read it as \"album\". An open album shows its variants (greyed out when missing) and its reward track (like 3/12, 6/12 with a reward each).",
  card: "Read it as \"card\".",
  split: "Read it as \"split\".",
};
// Which of your numbers each saved screen really shows. The rest are left alone, so a number in the same spot on
// another screen (the Collector's Token tab's tokens, say, where the home screen has credits) can't land in the wrong place.
const CG = ["credits", "gold"];
const SCREEN_NUMS = { home: [...CG, "collectionLevel", "passLevel", "rank", "rankCubes", "rankCubesNeed"], shop: CG, shopcurrency: [...CG, "goldPassDays", "goldPassClaimIn", "freeCreditsIn"], shoptokens: ["tokens", "gold", "freeTokensClaimed"], shopmedals: ["medals", "gold"],
  seasonpass: [...CG, "passLevel", "passXp", "passXpNext", "passTier"], collectionlevel: ["collectionLevel", "clNextReward", "clNextIn"], albums: CG, missions: CG, card: CG, split: CG, event: [], eventshop: [], alliance: [] , reward: CG, cosmetics: [], collection: CG };
// The kinds each saved screen can be; anything else the reader says is set aside.
const SCREEN_KINDS = { reward: ["reward", "variants", "card", "numbers"], cosmetics: ["cosmetics"], collection: ["collection", "card", "numbers"], home: ["numbers"], shop: ["shop", "numbers", "variants"], shopcurrency: ["shop", "numbers"], shoptokens: ["shop", "numbers"], shopmedals: ["shop", "numbers"], seasonpass: ["pass", "numbers"], collectionlevel: ["numbers"], event: ["event"], eventshop: ["event", "shop"], alliance: ["alliance"], missions: ["missions"], albums: ["album"], card: ["card", "split", "variants"], split: ["split"] };
const SHOT_PROMPT = (roster, hint) => `You are reading a screenshot from the mobile game MARVEL SNAP. Decide what screen it shows and pull out everything visible that's listed below.
Valid card names (name cost/power): ${roster}
Game modes and events: ${modeNames().join("; ")}
${/^screen:/.test(hint || "") ? `This picture was saved automatically while the player was on the game's ${SCREEN_NAMES[String(hint).slice(7)] || "menu"} screen. ${SCREEN_TIPS[String(hint).slice(7)] || ""}\n` : hint ? `Just before this, the player's screen mentioned "${String(hint).slice(0, 60)}". Use that for the game mode if the picture itself doesn't show the mode, except that a result with cubes won or lost is a Ranked match (or Conquest, with medals).\n` : ""}Reply as JSON:
{"kind": "match" (end of a match, or the board during one) | "numbers" (home, profile, rank, shop, collection or season pass screens showing the player's numbers) | "deck" (a deck of cards) | "card" (one card's own screen: its upgrade level, boosters, splits, variants or Custom Card) | "collection" (the collection grid, with booster counts on the cards) | "split" (the result of an Infinity Split) | "variants" (one card's variants screen, showing which of its variants the player has) | "shop" (a shop screen: the Token Shop, Spotlight Caches, the shop's daily and special offers, a bundle or the Season Pass) | "event" (an event or limited-time mode's own pass, reward track or shop, like Deadpool's Diner's, with levels, XP, rewards, its currency and its collectibles) | "alliance" (any alliance screen: members, bounties, milestones or the alliance leaderboard) | "album" (the variant albums list, or one album with its variants) | "missions" (the Missions screen: daily missions, the weekly challenge or the season's chapters) | "pass" (the season pass reward track) | "cosmetics" (the player's own avatars, titles, card backs or emotes to pick from, in their profile or collection) | "reward" (a pop-up showing what the player just got: a new card, variant, avatar, title, card back, emote, or what a cache, pack or reward gave) | "other",
 "match": {"result": "W" | "L" | "T" | "" (from the player's side at the bottom), "cubes": cubes won or lost as a positive number (0 if not shown), "medals": Conquest medals won or lost as a positive number (0 if none), "retreated": true if the player retreated, "oppRetreated": true if the opponent retreated, "snapped": true if the player snapped, "oppSnapped": true if the opponent snapped, "mode": one of the game modes and events above, or the mode or event name shown, or "", "oppName": "", "locations": [{"name": "", "my": bottom player's power, "opp": top player's power, "myCards": [{"card": "each of the player's cards here", "power": number, "variant": "its art variant if you can tell (the artist or style, like Kael Ngu, Pixel or Baby), else empty", "border": "its border if it has a special one, else empty", "finish": "its finish if it has one (like Ink, Gold, Foil, Prism or Glitch), else empty", "flare": "its flare if one is showing (like Glimmer, Comic, Kirby or Sparkle), else empty"}], "oppCards": [{"card": "each opponent card here", "power": number, "variant": "its art variant if you can tell (the artist or style, like Kael Ngu, Pixel or Baby), else empty", "border": "its border if it has a special one, else empty", "finish": "its finish if it has one (like Ink, Gold, Foil, Prism or Glitch), else empty", "flare": "its flare if one is showing (like Glimmer, Comic, Kirby or Sparkle), else empty"}]}] (left to right), "me": {"avatar": "the player's avatar at the bottom: the character or name if you can tell, else empty", "title": "the player's title if shown", "cardback": "the player's card back (on their deck pile or cards in hand): its name or the character on it, else empty", "emotes": ["any emote the player is showing"]}, "opp": {"avatar": "the opponent's avatar at the top: the character or name", "title": "the opponent's title if shown", "cardback": "the opponent's card back: its name or the character on it", "emotes": ["each emote the opponent is showing, by its name or what it shows"]}, "eventGain": {"name": "an event currency won this match, like Bubs", "amount": number written in full (+1.2K is 1200)}, "oppCards": ["card names on the top side"], "myCards": ["card names on the bottom side"], "turn": final turn number or null, "boosters": [{"card": "card name", "n": boosters this card earned, as shown on the results}]},
 "numbers": {"topLeft": {"amount": the number at the top left of the top bar or null, "icon": "credits" (blue crystal, blue box) | "tokens" (purple token, purple box) | "other"}, "topRight": {"amount": the number at the top right or null, "icon": "gold" | "other"}, "rank": rank number 1-99, or "Infinite", or null, "rankCubes": cubes toward the next rank (the 4 in 4/7) or null, "rankCubesNeed": cubes the next rank needs (the 7 in 4/7) or null, "collectionLevel": the Collection Level (in a green badge) or null, "clNextReward": "the next big Collection Level reward if shown, like 3000 Collector's Tokens", "clNextIn": Collection Levels until it or null, "credits": Credits (blue crystal icon) or null, "gold": Gold (gold bar icon) or null, "tokens": Collector's Tokens (purple token icon) or null, "passLevel": season pass level or null, "passXp": points toward the next season pass level or null, "passXpNext": points that level needs in all or null, "passTier": "free" | "premium" | "premium+" | "" (which season pass the player has, if you can tell), "rerollCoins": Split Reroll Coins or null, "wildBoosters": Wild Boosters or null, "medals": Conquest medals or null, "goldPassDays": days left on the Gold Pass if shown or null, "goldPassClaimIn": "time until the Gold Pass's daily gold can be claimed, as shown, or empty", "freeTokensClaimed": true if today's free Collector's Tokens show as claimed, false if they can be claimed, else null, "freeCreditsIn": "time until the shop's free credits can be claimed again, as shown, like 7h 22m, or empty"},
 "deck": {"name": "", "cards": ["card names"]},
 "card": {"card": "card name", "variant": "variant name if shown, else empty", "rarity": "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Ultra" | "Infinity" | "", "boosters": this card's boosters or null, "splits": number of Infinity Splits if shown or null, "finish": "split finish if shown", "flare": "split flare if shown", "border": "border name if shown", "masteryLevel": Character Mastery level or null, "masteryXp": the Mastery XP shown (the first number of something like 360/405) or null},
 "collection": {"cards": [{"card": "card name", "boosters": "the booster number on the card as shown, like 20 or 99+", "rarity": "upgrade level if you can tell, else empty"}]},
 "split": {"card": "card name", "finish": "finish it got", "flare": "flare it got", "rerolled": true if the player rerolled, "usedCoin": true if a Split Reroll Coin was spent},
 "variants": {"card": "card name", "screen": "editor" if this is the Custom Card editor's art picker (it only lists variants the player owns), otherwise "collection", "count": how many variant pictures you can see, "items": [{"name": "variant name or style if shown", "artist": "artist if shown", "owned": true if the player has it, false if it's greyed out, locked or shows a price}]},
 "shop": {"shop": "the shop's name, like Token Shop, Spotlight, an event shop's name, or a bundle's name", "bundles": [{"name": "the bundle's title, like Signature Bundle or Special Offer", "price": "its price as shown, like $29.99 or 1,200 Gold", "contents": ["each thing in it, like 3,600 Credits, Bucky Barnes Exiles Variant or 155 Ghost Rider Boosters"], "endsIn": "time it has left as shown, like 1d 13h", "value": "a value label if shown, like ~250 Collection Level Value!", "sold": true if bought or sold out}], "daily": [{"card": "card name", "variant": "variant name if it's a variant", "price": "its price", "pinned": true if marked Pinned!, "sold": true if bought}], "dailyRefreshIn": "time until the daily cards change, as shown", "packs": [{"name": "like Seasonal Series 5 or Series 4", "price": "its price", "complete": true if marked COMPLETE!}], "items": [{"card": "card name", "kind": "variant" | "card" | "border" | "other", "variant": "variant name or style if shown", "artist": "artist if shown", "price": "price as shown"}]},
 "event": {"event": "event or mode name", "level": current pass level or null, "levels": total levels or null, "xp": points toward the next level or null, "xpNext": points that level needs in all or null, "xpName": "what those points are called, like Event XP", "currency": {"name": "the event's main currency if shown, like Bubs", "amount": number or null}, "currencies": [{"name": "each of the event's currencies shown, by its label or icon, like Bubs or Nachos", "amount": number written in full, "use": "match" if it's earned by playing matches, "shop" if it's spent in the event's shop, else ""}], "shop": [{"name": "an item in the event's shop", "kind": "card" | "variant" | "avatar" | "title" | "cardback" | "border" | "emote" | "credits" | "pack" | "other", "price": number, "currency": "what it costs, like Nachos", "sold": true if bought}], "nextReward": "the next reward on the track", "milestones": [{"level": number, "reward": "", "claimed": true | false, "premium": true if it's on the paid track}], "collectibles": [{"name": "", "kind": "card" | "variant" | "avatar" | "title" | "cardback" | "border" | "emote" | "other", "owned": true if it's claimed, owned or marked SOLD in the event's shop}]},
 "alliance": {"name": "alliance name", "tab": "members" | "bounties" | "milestones" | "leaderboard" | "other", "teamPoints": the alliance's points this week or null, "myPoints": the player's own points this week or null, "nextMilestone": {"points": points needed or null, "reward": ""}, "resetsIn": "time left in the week as shown, like 2d 5h", "dropsLeft": bounty drops left this week or null, "myNext": points the player's next personal milestone needs or null, "members": [{"name": "", "role": "Leader" | "Officer" | "Member" | "", "points": alliance points this week or null, "cubes": cubes, or points from cubes on the contributors list, or null, "bounties": bounties done, or points from bounties on the contributors list, or null, "score": total points or score or null, "collectionLevel": Collection Level or null, "rank": "rank as shown, like Infinite or 75, or empty"}], "memberCount": how many members it has or null, "bounties": [{"text": "what to do, as written", "rarity": "Common" | "Epic" | "Legendary" | "", "points": points it gives or null, "progress": done so far or null, "goal": how many it needs or null, "mine": true if the player has it active}], "board": [{"rank": number, "name": "alliance name", "points": null, "cubes": null, "bounties": null, "mine": true if it's the player's alliance}]},
 "album": {"name": "the album's name if one album is open, else empty", "have": variants collected or null, "of": variants in it or null, "rewards": [{"at": "like 6/12", "reward": "what it gives", "claimed": true if collected}], "cards": [{"card": "card name of each variant shown", "variant": "the variant's name or style if shown", "artist": "artist if shown", "owned": true if the player has it, false if it's greyed out or locked}], "albums": [{"name": "", "have": number, "of": number}] for the albums list},
 "missions": {"tab": "daily" | "season" | "other", "refreshIn": "time until new daily missions, as shown, or empty", "items": [{"text": "today's mission, as written", "progress": done so far or null, "goal": how many it needs or null, "reward": "what it gives, like 100 Season Pass XP", "done": true if it's complete or claimed}], "weekly": {"done": weekly challenge missions done or null, "of": how many it has or null, "points": the challenge's points so far or null, "pointsNext": points for its next reward or null, "endsIn": "time until the weekly challenge resets, if shown", "items": [{"text": "the mission without the HARD: label", "hard": true if marked HARD:, "progress": number or null, "goal": number or null, "reward": "", "done": true | false}]}, "chapters": [{"number": the chapter number, "name": "its name, like Insatiable Immortal", "complete": true if marked COMPLETE, "unlocksIn": "time until it unlocks if locked, as shown", "items": [{"text": "", "progress": number or null, "goal": number or null, "reward": "", "done": true | false, "unlocksIn": "if this mission is still locked"}]}]},
 "reward": {"from": "what gave it, like Spotlight Cache, Collector's Reserve, Collection Level 3,000 or Season Pass level 12", "items": [{"kind": "card" | "variant" | "avatar" | "title" | "cardback" | "emote" | "border" | "credits" | "gold" | "tokens" | "boosters" | "other", "card": "the card's name, for a card or variant", "name": "the variant's name or artist, or the cosmetic's name", "amount": number or null}]},
 "cosmetics": {"tab": "avatars" | "titles" | "cardbacks" | "emotes" | "", "items": [{"name": "each one's name as shown", "kind": "avatar" | "title" | "cardback" | "emote", "owned": true if the player has it, false if it's greyed out, locked or shows a price}]},
 "pass": {"level": season pass level or null, "xp": points toward the next level or null, "xpNext": points it needs or null, "tier": "free" | "premium" | "premium+" | "", "track": [{"level": number, "free": "the free reward at this level, or empty", "premium": "the premium reward at this level, or empty", "got": true if the player has reached it or it shows as claimed}], "spotlight": {"name": "the reward in the spotlight", "unlocksAt": level or null}}}
If the screen also shows the player's own currencies along the top, or their Collection Level or season pass level, fill "numbers" too, whatever the kind. ${TOP_BAR} ${NOT_YOURS} An event's screens show the event's own currencies along the top instead (like Bubs): those go in "event", never in "numbers".
Leave out sections that don't apply. Never guess numbers you can't read.`;
const refreshShots = () => { if (sheetFn === shotsSheet || (typeof reviewSheet === "function" && sheetFn === reviewSheet)) refreshSheet(); };
function trimShots() { const done = shots.items.filter((x) => x.done); if (done.length <= 40) return; const drop = new Set(done.slice(0, done.length - 40)); drop.forEach((x) => { try { if (x.url) URL.revokeObjectURL(x.url); } catch { /* fine */ } }); shots.items = shots.items.filter((x) => !drop.has(x)); }
// Lists in what the AI sends back can have empty entries; those are dropped so one can't stop the rest being read
function cleanAI(v, depth = 0) { if (depth > 8) return null; if (Array.isArray(v)) return v.slice(0, 200).map((e) => (e === null || e === undefined ? {} : cleanAI(e, depth + 1))); if (v && typeof v === "object") { const o = {}; for (const [k, e] of Object.entries(v)) if (k !== "__proto__" && k !== "constructor" && k !== "prototype") o[k] = cleanAI(e, depth + 1); return o; } if (typeof v === "string") return v.slice(0, 600); return v; }
async function fileToShot(file) { const img = await imageForAI(file); return { img, hash: shotHash(img.data), time: num(file.lastModified) || Date.now(), url: URL.createObjectURL(file) }; }
function shotsSheet() {
  const rows = shots.items.map((x, i) => `<div class="li" style="align-items:flex-start">${x.url ? `<img src="${x.url}" alt="" class="shot-thumb">` : ""}<div class="grow" style="min-width:0"><div class="t small">${esc(x.status || "Waiting…")}</div>${x.detail ? `<div class="s" style="white-space:normal">${esc(x.detail)}</div>` : ""}
    <div class="row" style="margin-top:4px">${x.matchId ? `<button class="btn sm" data-a="matchEdit" data-id="${esc(x.matchId)}">Check</button>` : ""}${x.deckId ? `<button class="btn sm" data-a="deckOpen" data-id="${esc(x.deckId)}">Open deck</button>` : ""}${x.cardKey ? `<button class="btn sm" data-a="cardOpen" data-k="${esc(x.cardKey)}">Open card</button>` : ""}${x.undo || x.undoNums ? `<button class="btn sm ghost" data-a="shotUndo" data-i="${i}">Undo</button>` : ""}</div></div></div>`).join("");
  const done = shots.items.filter((x) => x.done).length;
  return `${sheetHead("Screenshots", shots.busy || (typeof nat !== "undefined" && nat.busy) ? `Reading ${Math.min(done + 1, shots.items.length)} of ${shots.items.length}…` : `${done} of ${shots.items.length} read`)}
    ${!canReadShots() ? `<p class="note">Reading screenshots needs an AI key. Add one in Settings › AI, then share them again.</p>` : ""}
    <div class="list">${rows || `<div class="li muted small">No screenshots yet.</div>`}</div>
    <button class="btn sm ghost" data-a="reviewOpen">See every screenshot it's read</button>
    <p class="muted small">Match screens are logged straight away. Screens with your rank, Collection Level or currencies update those numbers, card, collection and split screens update your boosters, upgrades and splits, a card's variants screen ticks the variants you own, and shop screens tell you about anything on your wishlist. Tap Check to fix anything the AI got wrong.</p>`;
}
// Free AI keys allow a few answers a minute, so screenshots are read a few seconds apart.
let aiLastAt = 0, aiGapMs = 3500, shotRetryMs = 65e3;
async function aiPace(gap = aiGapMs) { const w = aiLastAt + gap - Date.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); aiLastAt = Date.now(); }
// The AI being busy or out of free answers for now, or no connection: worth trying again later.
const aiBusyErr = (e) => !!e && (e.status === 429 || e.status >= 500 || e.reach || e.slow || /busy|limit|resting|none of your ai|timed? ?out|took too long|can't be reached|failed to fetch|network|load failed/i.test(String(e.message || "")));
const aiSetupErr = (e) => !!e && ([401, 402, 403, 404].includes(e.status) || (e.status === 400 && /api.?key|key not valid|permission|billing|model|credential/i.test(String(e.message || ""))) || /add an ai key|no ai key|set up ai|isn't set up/i.test(String(e.message || "")));
// An answer that was empty, cut off or not JSON: worth one more try straight away
const shotRetryable = (e) => !!e && (e.empty || /expected format|didn't answer|empty|cut off|unexpected end|JSON/i.test(String(e.message || "")));
// How many times a picture timed out, so one the AI can never finish doesn't hold up the queue forever
const SLOW_KEY = "snapstat.slowShots";
function slowCount(id, add) { let m = {}; try { m = JSON.parse(localStorage.getItem(SLOW_KEY) || "{}"); } catch { /* none */ } if (add) { m[id] = num(m[id]) + 1; const keys = Object.keys(m); if (keys.length > 50) delete m[keys[0]]; try { localStorage.setItem(SLOW_KEY, JSON.stringify(m)); } catch { /* fine */ } } return num(m[id]); }
// One screenshot is read at a time, whether it came from the share menu or the tracker
let shotChain = Promise.resolve();
// Reads one screenshot, waiting and trying again (up to 3 times) when the AI is busy. "retry" means it's still unread.
function readShotItem(x) { const p = shotChain.then(() => readShotItemNow(x)); shotChain = p.catch(() => {}); return p; }
async function readShotItemNow(x) {
  for (let tries = 0; ; tries++) {
    try { await readOneShot(x); noteSeen(x); await shotLogSave(x); return "ok"; }
    catch (e) {
      // Nothing from this one was saved, so it isn't marked as read
      if (x.hash) S.shotSeen = arr(S.shotSeen).filter((h) => h !== x.hash);
      if (aiSetupErr(e)) { x.status = "Your AI key isn't working, so this one waits"; x.detail = `${e && e.message ? String(e.message).slice(0, 160) + " · " : ""}Fix it in Settings › AI${x.native ? " and the waiting pictures are read next time" : ", then share it again"}.`; x.setup = true; return "retry"; }
      // A garbled or empty answer is usually fine the second time (another model is asked if the first one balks)
      if (!aiBusyErr(e) && shotRetryable(e) && tries < 1) { x.status = "The AI's answer was cut off. Asking again…"; refreshShots(); await aiPace(); x.status = "Reading…"; continue; }
      if (!aiBusyErr(e)) {
        const code = e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError;
        if (code) errNote("reading a screenshot", e, true); // goes with bug reports, so the owner can see it
        x.status = "Couldn't read this one"; x.detail = code ? `A problem in SNAP Stat itself (${String(e.message).slice(0, 140)}). It's been noted; Read again after the next update.` : e && e.message ? e.message : "The picture couldn't be opened (it may be empty or damaged).";
        await shotLogSave(x); return "ok";
      }
      if (x.native && e && e.slow && slowCount(x.native, true) >= 4) { x.status = "Couldn't read this one"; x.detail = "The AI kept running out of time on this picture, so it was skipped."; await shotLogSave(x); return "ok"; }
      if (tries >= 2) { x.status = "The AI is busy, so this one waits"; x.detail = x.native ? "I'll read it next time you open SNAP Stat." : "Share it again in a few minutes."; return "retry"; }
      x.status = "The AI is busy. Trying again in a minute…"; x.detail = ""; refreshShots();
      await new Promise((r) => setTimeout(r, shotRetryMs));
      x.status = "Reading…"; refreshShots();
    }
  }
}
async function readShots(files) {
  // Oldest first, so several pictures shared at once (galleries often send the newest first) are read in the order they were taken
  const pics = [...files].filter((f) => f && /^image\//.test(f.type || "image/")).sort((a, b) => num(a.lastModified) - num(b.lastModified));
  files = pics.slice(0, 20); if (!files.length) return;
  if (pics.length > 20) toast(`Reading the first 20 of ${pics.length} screenshots. Share the rest after these.`);
  for (const f of files) shots.items.push({ file: f, status: "Waiting…" });
  trimShots(); openSheet(shotsSheet);
  if (shots.busy || !canReadShots()) { refreshShots(); return; }
  shots.busy = true;
  whenDataReady(async () => {
    try {
      for (let x; (x = shots.items.find((y) => !y.done && y.file && !y.native)); ) {
        x.status = "Reading…"; refreshShots();
        const res = await readShotItem(x);
        x.done = true; x.file = null; refreshShots();
        if (res === "retry" && x.setup) { shots.items.forEach((y) => { if (!y.done && !y.native && y.file) { y.status = "Not read: your AI key isn't working"; y.done = true; y.file = null; } }); break; }
      }
    } finally { shots.busy = false; refreshShots(); render(); }
  }, 0, () => { shots.busy = false; shots.items.forEach((y) => { if (!y.done && !y.native && y.file) { y.status = "Not read: your saved data didn't finish loading"; y.detail = "Share it again once SNAP Stat has loaded."; y.done = true; y.file = null; } }); refreshShots(); });
}
async function readOneShot(x) {
  const s = await fileToShot(x.file); x.url = s.url;
  const seen = arr(S.shotSeen); if (seen.includes(s.hash) && !x.again) { x.status = "Already read this screenshot"; x.dupe = true; return; }
  x.hash = s.hash;
  let hint = x.file && x.file.snapHint ? String(x.file.snapHint) : "";
  // Before Android 1.13 the tracker could carry an event's name from its hub over to a ranked match, so its game mode guess can't be trusted.
  if (hint && !/^screen:/.test(hint) && NATIVE && verCmp(String(natInfo().version || "0"), "1.13") < 0) hint = "";
  await aiPace();
  if (/^turn:/.test(hint)) { const t = obj(cleanAI(await store.sample.json(TURN_PROMPT(cardRoster(), hint), { images: [s.img], modelTier: "default" }))); S.shotSeen = [...seen.filter((h) => h !== s.hash), s.hash].slice(-200); x.raw = t; x.kind = "turn"; x.hint = hint; return applyTurnShot(x, t, s.time, hint, x.file && x.file.snapMeta); }
  const r = obj(cleanAI(await store.sample.json(SHOT_PROMPT(cardRoster(), hint), { images: [s.img], modelTier: "default" })));
  S.shotSeen = [...seen.filter((h) => h !== s.hash), s.hash].slice(-200);
  x.raw = r;
  let kind = String(r.kind || "");
  const sk = /^screen:/.test(hint) ? SCREEN_KINDS[hint.slice(7)] : null;
  if (sk && !sk.includes(kind)) {
    if (sk.includes("numbers") && r.numbers) kind = "numbers";
    else { x.status = "Saved by the tracker, but it didn't look like that screen"; x.detail = `${SCREEN_NAMES[hint.slice(7)] || hint.slice(7)} · read as ${kind || "nothing"}`; save(); return; }
  }
  // Keep only the numbers this screen really shows (event and alliance screens: none of them are yours)
  const keep = /^screen:/.test(hint) ? SCREEN_NUMS[hint.slice(7)] : null;
  // An event's or alliance's screen shows their currencies and other players' numbers, never yours
  if (!keep && ["event", "alliance"].includes(kind)) r.numbers = null;
  if (r.numbers) {
    const raw = obj(r.numbers);
    if (keep) r.numbers = Object.fromEntries(Object.entries(raw).filter(([k]) => keep.includes(k)));
    r.numbers = sortTopBar(obj(r.numbers), raw, hint, await topLeftColour(x.file).catch(() => ""));
    // A screen that shows none of your numbers (your cosmetics) stays that way, even if the top bar looked like it
    if (keep && !keep.length) r.numbers = {};
  }
  x.hint = hint;
  x.kind = kind;
  if (kind === "match") return applyShotMatch(x, obj(r.match), s.time, hint, x.file && x.file.snapMeta);
  // (card, collection, split and variants screens show your Credits and Gold along the top too)
  if (kind === "card") { applyShotCard(x, obj(r.card)); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "collection") { applyShotCollection(x, obj(r.collection).cards); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "split") { applyShotSplit(x, obj(r.split)); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "numbers") return applyShotNumbers(x, obj(r.numbers), s.time);
  if (kind === "deck") return applyShotDeck(x, obj(r.deck));
  if (kind === "variants") { await applyShotVariants(x, obj(r.variants), s.img); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "shop") { applyShotShop(x, obj(r.shop), s.time); return alsoNumbers(x, r.numbers, s.time); }
  // (what it left is kept with Undo, so undoing it later keeps what newer screenshots changed)
  if (kind === "event") { applyShotEvent(x, obj(r.event), s.time); if (x.undo && x.undo.type === "event") x.undo.after = clone(obj(S.eventProg[x.undo.id])); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "alliance") { applyShotAlliance(x, obj(r.alliance), s.time); if (x.undo && x.undo.type === "alliance") { x.undo.after = clone(obj(S.allianceData)); x.undo.meAfter = { alliance: S.me.alliance, points: S.alliance.points }; } return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "album") { await applyShotAlbum(x, obj(r.album), s.time, s.img); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "missions") { applyShotMissions(x, obj(r.missions), s.time); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "pass") { applyShotPass(x, obj(r.pass), s.time); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "cosmetics") { applyShotCosmetics(x, obj(r.cosmetics)); return alsoNumbers(x, r.numbers, s.time); }
  if (kind === "reward") { applyShotReward(x, obj(r.reward)); return alsoNumbers(x, r.numbers, s.time); }
  x.status = "Nothing to log in this one"; save();
}
/* ---------- Telling Credits, Collector's Tokens, Gold and Collection Level apart ---------- */
// The top-left box is blue for Credits (home, the shop's Offers tab) and purple for Collector's Tokens (the shop's Cards tab).
// Its colour is checked on the picture itself, so it doesn't depend on the AI telling the icons apart.
async function topLeftColour(file) {
  if (!file || typeof createImageBitmap !== "function") return "";
  const bmp = await createImageBitmap(file); const W = bmp.width, H = bmp.height;
  if (!W || H < W * 1.3) { bmp.close && bmp.close(); return ""; }  // only tall phone screenshots
  const c = document.createElement("canvas"); c.width = 90; c.height = 30; const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, W * 0.02, W * 0.12, W * 0.36, W * 0.085, 0, 0, 90, 30); bmp.close && bmp.close();
  const d = g.getImageData(0, 0, 90, 30).data; let sat = 0, blue = 0, purple = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (mx < 0.35 || mx === 0 || (mx - mn) / mx < 0.45) continue;
    sat++; const dd = mx - mn; let h = mx === r ? ((gg - b) / dd) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4; h = (h * 60 + 360) % 360;
    if (h >= 185 && h <= 235) blue++; else if (h >= 250 && h <= 300) purple++;
  }
  if (sat < 300) return "";
  return blue / sat >= 0.75 ? "credits" : purple / sat >= 0.6 ? "tokens" : "";
}
// What the top-left number is on each saved screen (the medal shop and event screens have their own currencies there)
const LEFT_BY_SCREEN = { home: "credits", shop: "credits", shopcurrency: "credits", seasonpass: "credits", shoptokens: "tokens" };
const NO_TOP_BAR = ["event", "eventshop", "alliance", "shopmedals", "collectionlevel"];
function sortTopBar(n, raw, hint, colour) {
  const h = /^screen:/.test(hint || "") ? hint.slice(7) : "", tl = obj(raw.topLeft), tr = obj(raw.topRight);
  const amt = (v) => { const z = Number(String(v ?? "").replace(/[,\s]/g, "")); return String(v ?? "").trim() !== "" && Number.isFinite(z) && z >= 0 ? Math.round(z) : null; };
  const out = { ...n }; delete out.topLeft; delete out.topRight;
  const sure = new Set();
  if (!NO_TOP_BAR.includes(h) || (colour && h !== "shopmedals" && !["event", "eventshop", "alliance"].includes(h))) {
    const ai = tl.icon === "credits" || tl.icon === "tokens" ? tl.icon : "";
    // The colour wins on the shop and home screens (a mislabelled shop tab is caught); elsewhere the colour and the AI must agree.
    // When the AI says it's some other currency, it's left alone unless the screen is one that always shows Credits or Tokens there.
    const left = LEFT_BY_SCREEN[h] ? colour || ai || LEFT_BY_SCREEN[h] : tl.icon === "other" ? "" : !h ? colour || ai : colour && ai && colour === ai ? colour : "";
    const v = amt(tl.amount);
    if (left && v !== null) {
      const other = left === "credits" ? "tokens" : "credits";
      out[left] = v; sure.add(left);
      if (amt(out[other]) === v) delete out[other];  // the same number can't be both
    }
    if (!NO_TOP_BAR.includes(h) || colour) { const g = amt(tr.amount); if (g !== null && tr.icon !== "other") { out.gold = g; sure.add("gold"); } }
  }
  // The same number in two places: keep the one the top bar settled, drop the rest
  const keys = ["credits", "tokens", "gold", "collectionLevel"], seen = {};
  for (const k of keys) { const v = amt(out[k]); if (v === null || v === 0) continue; (seen[v] = seen[v] || []).push(k); }
  for (const ks of Object.values(seen)) if (ks.length > 1) for (const k of ks) if (!sure.has(k)) delete out[k];
  // A number that's another of your numbers as saved (and that one isn't on this screen) is probably that one, misplaced
  const saved = { credits: num(S.wallet.credits), tokens: num(S.wallet.tokens), gold: num(S.wallet.gold), collectionLevel: num(S.me.colLevel) };
  for (const k of keys) {
    const v = amt(out[k]); if (v === null || v === 0 || sure.has(k) || saved[k] === v) continue;
    if (keys.some((o) => o !== k && saved[o] === v && amt(out[o]) === null)) delete out[k];
  }
  return out;
}
// "W", "Win", "Victory"... as the result, or "" when it can't be told
function normResult(v) { const s = String(v || "").trim().toLowerCase(); return /^(w|win|won|victory|victorious)\b/.test(s) ? "W" : /^(l|loss|lost|lose|defeat|defeated)\b/.test(s) ? "L" : /^(t|tie|tied|draw)\b/.test(s) ? "T" : ""; }
// The same match read from a second picture (the tracker saves the results screen again if you stay on it, or you
// screenshot it yourself): within a few minutes, same result, and the same opponent or the same locations
function sameMatchAs(m) {
  const locs = (x) => { const l = arr(x.locs).map((L) => allyKey(L.name)).filter(Boolean); return l.length === 3 ? l.sort().join("|") : ""; };
  const opp = allyKey(m.oppName);
  return allMatches().find((o) => o.id !== m.id && !o.example && ((m.session && o.session === m.session) || (Math.abs(num(o.ts) - num(m.ts)) <= 4 * 60e3 && o.result === m.result && ((opp && allyKey(o.oppName) === opp) || (locs(m) && locs(o) === locs(m)))))) || null;
}
function applyShotMatch(x, mm, time, hint, meta) {
  const res = normResult(mm.result) || (mm.retreated ? "L" : mm.oppRetreated ? "W" : "");
  if (!res) { x.status = "Couldn't tell who won, so it wasn't logged"; x.detail = "If this was the end of a match, add it with the + button on Home."; return; }
  const plays = [...new Set(arr(mm.myCards).map((n) => (fuzzyCard(n) || {}).key).filter(Boolean))];
  // The deck sharing the most of the cards you played (at least 4 of them, or all of them if you played fewer)
  const ranked = plays.length >= 3 ? S.decks.map((dk) => ({ dk, n: plays.filter((k) => dk.cards.includes(k)).length })).filter((r) => r.n >= Math.min(4, plays.length)).sort((a, b) => b.n - a.n) : [];
  const d = (ranked[0] && ranked[0].dk) || deckByLooks(obj(mm.me), plays);
  const locs = arr(mm.locations).slice(0, 3).map((l) => obj(l)).map((l) => ({ name: String(l.name || "").slice(0, 40), my: num(l.my), opp: num(l.opp) }));
  const pickMode = (v) => { const kv = keyOf(v || ""); return kv ? [...modeNames(), ...MODES].find((mo) => keyOf(mo) === kv) || null : null; };
  const mag = clamp(Math.abs(num(mm.cubes)), 0, 8), medals = Math.abs(Math.round(num(mm.medals)));
  let mode = pickMode(mm.mode) || (mm.mode ? String(mm.mode).slice(0, 30) : pickMode(hint) || (hint ? String(hint).slice(0, 30) : "Ranked"));
  // Cubes only change hands in Ranked: a match with cubes isn't the event the player last looked at
  if (mag && !pickMode(mm.mode) && !mm.mode && mode !== "Ranked") mode = "Ranked";
  // Only Ranked has cubes. Conquest has medals; events and other modes have their own rewards.
  const noCubes = mode !== "Ranked" && !mag;
  const m = { id: uid(), ts: time, result: res || "W", cubes: noCubes ? 0 : res === "L" ? -mag : res === "T" ? 0 : mag, ...(noCubes ? { noCubes: true } : {}), ...(medals ? { medals: res === "L" ? -medals : medals } : {}), mode, deckId: d ? d.id : "", deckName: d ? d.name : "", oppName: String(mm.oppName || "").slice(0, 40),
    oppCards: [...new Set(arr(mm.oppCards).map((n) => (fuzzyCard(n) || {}).name).filter(Boolean))].slice(0, 12), snapped: !!mm.snapped, oppSnapped: !!mm.oppSnapped, retreated: !!mm.retreated, oppRetreated: !!mm.oppRetreated,
    turn: clamp(num(mm.turn) || 6, 1, 8), bot: "unsure", notes: "", locs, tracked: locs.length === 3, plays: plays.map((k) => ({ k, loc: -1, power: num(card(k).power) })), shot: true };
  attachTurns(m, meta, mm);
  const eg = obj(mm.eventGain); if (eg.name && nIn(eg.amount)) m.eventGain = { name: String(eg.name).slice(0, 20), amount: nIn(eg.amount) };
  // "Read again" in the review log: the new reading replaces that match (same match, not a second one)
  if (x.reMatch && findMatch(x.reMatch)) { const was = allMatches().find((o) => o.id === x.reMatch); m.id = x.reMatch; m.notes = was.notes || ""; m.bot = was.bot || "unsure"; for (const f of ["botAuto", "botWhy", "eventGain", "turns", "session", "vs", "tags", "replay", "looks", "me", "opp", "endBoard"]) if (!m[f] && was[f]) m[f] = was[f]; putMatch(m); onMatchSaved(m); save(); x.matchId = m.id; x.status = `Read again: ${res === "W" ? "win" : res === "L" ? "loss" : "tie"}${m.cubes ? " " + signed(m.cubes) : ""}`; x.detail = "The match was updated with this reading."; return; }
  const old = sameMatchAs(m);
  if (old) {
    // Fill in what the first reading missed, and leave the rest as it was
    for (const f of ["oppName", "deckId", "deckName", "turns", "endBoard", "eventGain", "session", "vs"]) if (!old[f] && m[f]) old[f] = m[f];
    if (!old.tracked && m.tracked) { old.locs = m.locs; old.tracked = true; }
    if (!arr(old.oppCards).length && m.oppCards.length) old.oppCards = m.oppCards;
    putMatch(old); save();
    x.matchId = old.id; x.status = "Already logged this match"; x.detail = "Anything the first picture missed was added to it."; return;
  }
  const bot = applyAutoBot(m, meta, mm);
  const had = ownedIds(), gotLooks = applyMatchLooks(m, mm), ticked = [...ownedIds()].filter((id) => !had.has(id));
  putMatch(m); onMatchSaved(m);
  const boosters = applyMatchBoosters(m, mm.boosters);
  x.matchId = m.id; x.undo = { type: "match", id: m.id, ticked };
  { x.status = `Logged: ${res === "W" ? "win" : res === "L" ? "loss" : "tie"}${m.cubes ? " " + signed(m.cubes) : ""}${m.oppName ? " vs " + m.oppName : ""}`; x.detail = [mode !== "Ranked" ? mode : "", m.medals ? `${signed(m.medals)} medals` : "", d ? d.name : "", locs.map((l) => `${l.name} ${l.my}–${l.opp}`).join(", "), boosters ? `+${boosters} boosters` : "", m.eventGain ? `+${fmt(m.eventGain.amount)} ${m.eventGain.name}` : "", arr(m.turns).length ? `play-by-play for ${m.turns.length} turn${m.turns.length === 1 ? "" : "s"}` : "", bot && m.bot !== "unsure" ? (m.bot === "likely" ? "probably a bot" : "probably a person") : ""].filter(Boolean).join(" · "); }
  if (gotLooks && gotLooks.length) x.detail = [x.detail, `Ticked: ${gotLooks.slice(0, 3).join(", ")}${gotLooks.length > 3 ? ` and ${gotLooks.length - 3} more` : ""}`].filter(Boolean).join(" · ");
  save();
}
// A shop, event or alliance screen that also shows your currencies along the top: those update too.
function alsoNumbers(x, n, time) {
  n = obj(n); if (!["credits", "gold", "tokens", "collectionLevel", "passLevel", "passXp", "medals", "goldPassDays", "clNextIn"].some((k) => n[k] !== null && n[k] !== undefined && Number.isFinite(Number(n[k]))) && typeof n.freeTokensClaimed !== "boolean" && !n.freeCreditsIn && !n.goldPassClaimIn) return;
  const y = { hint: x.hint, alongside: true }; applyShotNumbers(y, { credits: n.credits, gold: n.gold, tokens: n.tokens, collectionLevel: n.collectionLevel, passLevel: n.passLevel, passXp: n.passXp, passXpNext: n.passXpNext, medals: n.medals, goldPassDays: n.goldPassDays, goldPassClaimIn: n.goldPassClaimIn, clNextReward: n.clNextReward, clNextIn: n.clNextIn, freeTokensClaimed: n.freeTokensClaimed, freeCreditsIn: n.freeCreditsIn }, time);
  if (y.detail) x.detail = [x.detail, y.detail].filter(Boolean).join(" · ");
  if (y.undo) x.undoNums = y.undo;
}
// The parts of your data a numbers screenshot can change, so Undo can put back only those it changed
const NUM_PATHS = ["wallet.credits", "wallet.gold", "wallet.tokens", "wallet.rerolls", "wallet.wild", "wallet.medals", "walletLog", "walletAt", "me.colLevel", "colLow", "me.rank", "me.peak", "me.peakAll", "climb", "passes", "ranks", "goldPass", "freeTokens", "freeCredits", "clNext"];
const pathGet = (p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), S);
const pathSet = (p, v) => { const ks = p.split("."), last = ks.pop(); const o = ks.reduce((a, k) => (a[k] = a[k] && typeof a[k] === "object" ? a[k] : {}), S); if (v === undefined) delete o[last]; else o[last] = clone(v); };
const numSnap = () => Object.fromEntries(NUM_PATHS.map((p) => [p, clone(pathGet(p) ?? null)]));
function undoNumbers(u) {
  if (!u.after) { S.wallet = u.before.wallet; S.me.colLevel = u.before.col; S.me.rank = u.before.rank; S.me.peak = u.before.peak; S.climb = u.before.climb; S.passes = u.before.passes; if ("goldPass" in u.before) { S.goldPass = u.before.goldPass; S.freeTokens = u.before.freeTokens; S.freeCredits = u.before.freeCredits; } if ("clNext" in u.before) S.clNext = u.before.clNext; return; }
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  for (const p of NUM_PATHS) { const b = u.before[p], a = u.after[p]; if (same(a, b) || !same(pathGet(p), a)) continue; pathSet(p, b === null ? undefined : b); }
}
const numVal = (v) => { if (v === null || v === undefined || String(v).trim() === "") return NaN; const z = Number(String(v).replace(/[,\s]/g, "")); return Number.isFinite(z) ? z : NaN; };
function applyShotNumbers(x, n, time) {
  n = { ...obj(n) };
  for (const k of ["credits", "gold", "tokens", "rerollCoins", "rerolls", "wildBoosters", "wild", "medals", "collectionLevel", "passLevel", "passXp", "passXpNext", "goldPassDays", "clNextIn", "rankCubes"]) if (typeof n[k] === "string") { const z = numVal(n[k]); n[k] = Number.isFinite(z) ? z : null; }
  const before = numSnap();
  const done = [];
  // A picture taken before your numbers were last updated (read late, or picked out of order) doesn't overwrite newer ones
  const t0 = time || Date.now(), olderThan = (at) => num(at) > 0 && t0 < num(at) - 60e3;
  const staleWallet = olderThan(S.walletAt);
  if (n.rerollCoins !== undefined) n.rerolls = n.rerollCoins; if (n.wildBoosters !== undefined) n.wild = n.wildBoosters;
  // A 0 for credits, gold or tokens is nearly always a number the AI couldn't see, unless it came from the screen that shows it
  const zeroOk = (k) => /^screen:(shoptokens|home|shopcurrency)/.test(String(x.hint || "")) && (k !== "tokens" || /shoptokens/.test(String(x.hint)));
  for (const [k, l] of [["credits", "credits"], ["gold", "gold"], ["tokens", "tokens"], ["rerolls", "Split Reroll Coins"], ["wild", "Wild Boosters"], ["medals", "Conquest medals"]]) if (!staleWallet && n[k] !== null && n[k] !== undefined && String(n[k]).trim() !== "" && Number.isFinite(Number(n[k])) && Number(n[k]) < 1e8 && (Number(n[k]) > 0 || !["credits", "gold", "tokens"].includes(k) || zeroOk(k))) { S.wallet[k] = Math.max(0, Math.round(Number(n[k]))); done.push(`${fmt(S.wallet[k])} ${l}`); if (k === "tokens") { const lg = arr(S.walletLog); lg.push({ t: time, v: S.wallet.tokens }); S.walletLog = lg.slice(-60); } }
  // Collection Level only goes up, so a lower one is usually a misreading: it's used once two screenshots agree on it
  const cl = Math.round(Number(n.collectionLevel)), old = num(S.me.colLevel);
  if (n.collectionLevel !== null && n.collectionLevel !== undefined && Number.isFinite(cl) && cl > 0 && cl < 200000) {
    const low = obj(S.colLow);
    // (a lower one from a picture older than your newest numbers is just from before, so it doesn't count)
    if (!old || cl >= old || (!staleWallet && low.v && Math.abs(low.v - cl) <= 50)) { done.push(cl !== old ? `Collection Level ${fmt(cl)}` : `Collection Level ${fmt(cl)} (no change)`); S.me.colLevel = cl; S.colLow = null; }
    else if (!staleWallet) S.colLow = { v: cl, at: time || Date.now() };
  }
  const rk = /^inf/i.test(String(n.rank)) ? 100 : Number(n.rank);
  if (rk >= 1 && rk <= 100 && !olderThan(obj(S.climb).at)) { notePeak(Math.round(rk)); S.climb = { rank: Math.round(rk), cubes: clamp(num(n.rankCubes), 0, cpr() - 1), at: time }; syncRankFromClimb(); if (!climbNow()) { S.me.rank = rankStr(Math.round(rk)); } done.push(rk >= 100 ? "rank Infinite" : `rank ${Math.round(rk)}`); }
  // The season the picture was taken in (an old picture doesn't change this season's pass)
  const cs0 = currentSeason(), cs = cs0 && (!time || (time >= cs0.startTs && time <= cs0.endTs)) ? cs0 : null;
  const tierIn = String(n.passTier || "").toLowerCase(); if (cs && /^(free|premium|premium\+)$/.test(tierIn) && !olderThan(obj(S.passes[cs.id]).tierAt)) { const p = (S.passes[cs.id] = obj(S.passes[cs.id])); p.tier = tierIn === "premium+" ? "plus" : tierIn; p.tierAt = time || Date.now(); }
  const passOld = cs && olderThan(obj(S.passes[cs.id]).xpAt || obj(S.passes[cs.id]).levelAt);
  if (cs && !passOld && Number(n.passLevel) > 0 && Number(n.passLevel) <= 500) { const p = (S.passes[cs.id] = obj(S.passes[cs.id])); const lv = Math.round(Number(n.passLevel)); if (num(p.level) !== lv && !(Number(n.passXpNext) > 0)) { p.xp = 0; p.xpNext = 0; } p.level = lv; p.levelAt = t0; done.push(`pass level ${p.level}`); }
  if (cs && !passOld && Number(n.passXpNext) > 0 && Number(n.passXp) >= 0) { const p = (S.passes[cs.id] = obj(S.passes[cs.id])); p.xp = Math.round(Number(n.passXp)); p.xpNext = Math.round(Number(n.passXpNext)); p.xpAt = time || Date.now(); done.push(`${fmt(p.xp)}/${fmt(p.xpNext)} toward the next pass level`); }
  if (cs && !passOld && Number(n.passLevel) > 0) { const p = obj(S.passes[cs.id]); notePass(cs.id, num(p.level), num(p.xp), num(p.xpNext), time || Date.now()); }
  // Daily things the shop shows: Gold Pass days left, today's free Collector's Tokens, and when the free credits come back
  // (each from a picture older than the one saved is left out, so reading pictures out of order doesn't put back an old time)
  const t = time || Date.now(), gpOld = olderThan(obj(S.goldPass).at);
  if (!gpOld && Number(n.goldPassDays) > 0 && Number(n.goldPassDays) < 2000) { S.goldPass = { ...obj(S.goldPass), days: Math.round(Number(n.goldPassDays)), at: t }; done.push(`Gold Pass ${S.goldPass.days} days left`); }
  const gc = parseLeft(n.goldPassClaimIn); if (!gpOld && gc > 0 && gc <= DAY && obj(S.goldPass).days) { S.goldPass.claimAt = t + gc; done.push(`Gold Pass gold in ${String(n.goldPassClaimIn).slice(0, 12)}`); }
  if (!olderThan(obj(S.clNext).at) && Number(n.clNextIn) > 0 && Number(n.clNextIn) < 5000 && n.clNextReward) { S.clNext = { reward: String(n.clNextReward).slice(0, 40), left: Math.round(Number(n.clNextIn)), cl: num(S.me.colLevel), at: t }; done.push(`next: ${S.clNext.reward} in ${S.clNext.left} levels`); }
  const ftOld = olderThan(obj(S.freeTokens).at);
  if (!ftOld && n.freeTokensClaimed === true) { S.freeTokens = { claimed: gameDay(t), at: t }; done.push("free tokens claimed"); }
  else if (!ftOld && n.freeTokensClaimed === false && obj(S.freeTokens).claimed !== gameDay(t)) { S.freeTokens = { claimed: "", at: t }; done.push("free tokens ready"); }
  const fc = parseLeft(n.freeCreditsIn); if (!olderThan(obj(S.freeCredits).at) && fc > 0 && fc <= 8 * 3600e3) { S.freeCredits = { nextAt: t + fc, at: t }; done.push(`free credits in ${String(n.freeCreditsIn).slice(0, 12)}`); }
  if (!done.length) { x.status = staleWallet ? "These numbers are older than the ones saved, so they were left as they are" : "No numbers I could read"; x.failed = !staleWallet; return; }
  if (!staleWallet) S.walletAt = Math.max(num(S.walletAt), t0);
  x.status = "Updated your numbers"; x.detail = done.join(" · "); x.undo = { type: "numbers", before, after: numSnap() }; save();
}
function applyShotDeck(x, dd) {
  const keys = [...new Set(arr(dd.cards).map((n) => (fuzzyCard(n) || {}).key).filter(Boolean))].slice(0, 12);
  if (keys.length < 6) { x.status = "Looks like a deck, but I couldn't read enough cards"; return; }
  // A deck you've already saved (another picture of it) isn't saved twice
  const had = S.decks.find((dk) => arr(dk.cards).length === keys.length && keys.every((k) => dk.cards.includes(k)));
  if (had) { x.status = `You already have this deck: ${had.name}`; x.deckId = had.id; return; }
  const d = newDeck(String(dd.name || "Deck from a screenshot").slice(0, 60), keys, "draft");
  x.status = `Saved a deck: ${d.name}`; x.detail = `${keys.length} cards`; x.deckId = d.id; x.undo = { type: "deck", id: d.id };
}
// Puts back the parts of a saved object that a screenshot changed. A part changed again since (by a later screenshot)
// keeps its newer value, so undoing one screenshot never wipes what later ones added.
const sameJ = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function undoParts(cur, before, after) {
  const c = obj(cur), b = obj(before), a = obj(after); let kept = 0;
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) { if (sameJ(b[k], a[k]) || sameJ(c[k], b[k])) continue; if (!sameJ(c[k], a[k])) { if (k !== "at") kept++; continue; } if (b[k] === undefined) delete c[k]; else c[k] = clone(b[k]); }
  return { v: c, kept };
}
// Variants and cosmetics you own, to see which ones a screenshot ticked
const ownedIds = () => new Set([...arr(S.variants).filter((v) => v.owned).map((v) => v.id), ...arr(S.cosmetics).filter((c) => c.owned).map((c) => c.id)]);
function shotUndo(i) {
  const x = shots.items[i]; if (!x || (!x.undo && !x.undoNums)) return; const u = x.undo || { type: "none" };
  if (x.undoNums) { undoNumbers(x.undoNums); x.undoNums = null; if (u.type === "none") { x.undo = null; x.status = "Undone"; x.detail = ""; save(); refreshShots(); render(); return; } }
  // Older readings (no "after") put back the whole part, as before
  const part = (cur, set) => { if (!u.after) { set(u.before); return 0; } const r = undoParts(cur, u.before, u.after); set(r.v); return r.kept; };
  // Parts a later screenshot changed again stay; its Undo stays too, to finish once that later one is undone
  const fin = (kept) => { if (kept) { x.status = "Partly undone"; x.detail = "A later screenshot changed some of this again. Undo that one first, then tap Undo here again."; } else { x.undo = null; x.status = "Undone"; x.detail = ""; } save(); render(); refreshSheet(); };
  if (u.type === "event") { const kept = part(obj(S.eventProg)[u.id], (v) => { S.eventProg[u.id] = v; }); for (const it of arr(u.ticked)) try { if (findCollectible(it, u.evName, u.evTs).owned) setCollectible(it, u.evName, "owned", false, u.evTs); } catch { /* gone */ } fin(kept); return; }
  if (u.type === "alliance") { const kept = part(S.allianceData, (v) => { S.allianceData = v; }); if (u.me) { const ma = obj(u.meAfter); if (!u.meAfter || S.me.alliance === ma.alliance) S.me.alliance = u.me.alliance; if (!u.meAfter || S.alliance.points === ma.points) S.alliance.points = u.me.points; } fin(kept); return; }
  if (u.type === "album") { const kept = part(S.albumProg, (v) => { S.albumProg = v; }); for (const id of arr(u.vars)) { const v = S.variants.find((y) => y.id === id); if (v && v.ownBy === "album") { v.owned = false; delete v.ownBy; } } fin(kept); return; }
  if (u.type === "missions") { const kept = part(S.gameMissions, (v) => { S.gameMissions = v; }); if (u.check && sameJ(S.missions, u.check[1])) S.missions = u.check[0]; fin(kept); return; }
  if (u.type === "match") {
    removeMatchFix(u.id);
    // take back boosters this match added
    const mine = arr(S.progLog).filter((e) => e.match === u.id); mine.forEach((e) => { const p = prog(e.k); if (p.b !== null && e.applied !== false) p.b = Math.max(0, num(p.b) - num(e.n)); });
    if (mine.length) S.progLog = arr(S.progLog).filter((e) => e.match !== u.id);
    // and the variants, card back, avatar, title and emotes it ticked as yours
    for (const id of arr(u.ticked)) { const v = arr(S.variants).find((y) => y.id === id); if (v) { if (v.owned && v.ownBy === "match") { v.owned = false; delete v.ownBy; } continue; } const c = arr(S.cosmetics).find((y) => y.id === id); if (c && c.owned) c.owned = false; }
  }
  if (u.type === "prog") undoProg(u);
  if (u.type === "deck") S.decks = S.decks.filter((d) => d.id !== u.id);
  if (u.type === "numbers") undoNumbers(u);
  x.undo = null; x.matchId = ""; x.deckId = ""; x.status = "Undone"; x.detail = ""; save(); refreshShots(); render();
}

/* ---------- Screenshots shared from Android's share menu ---------- */
async function takeSharedShots() {
  if (!("caches" in window)) return [];
  try {
    const c = await caches.open("snapstat-share"); const keys = (await c.keys()).filter((r) => r.url.includes("/shared/"));
    const files = [];
    for (const k of keys) { const r = await c.match(k); if (r) { const b = await r.blob(); files.push(new File([b], decodeURIComponent(r.headers.get("x-name") || "shot.png"), { type: b.type || "image/png", lastModified: num(r.headers.get("x-time")) || Date.now() })); } }
    for (const k of keys) await c.delete(k).catch(() => {});
    return files;
  } catch { return []; }
}
function sharedRoute() {
  applyNav("home", "matches"); render();
  try { history.replaceState(null, "", "#home/matches"); } catch { /* fine */ }
  setTimeout(async () => {
    const files = await takeSharedShots();
    if (!files.length) { let t = ""; try { const c = await caches.open("snapstat-share"); const r = await c.match("shared-text"); if (r) { t = await r.text(); await c.delete("shared-text"); } } catch { /* nothing kept */ } if (t && typeof window.snapSharedText === "function") { window.snapSharedText(t); return; } }
    // A SnapVault export shared from the Files app syncs your cards and decks; screenshots get read.
    const isData = (f) => /json|text\/plain/.test(f.type || "") || /\.json$/i.test(f.name || "");
    const data = files.filter(isData), pics = files.filter((f) => !isData(f));
    if (data.length) {
      if (!pics.length) { ui.tab = "home"; ui.more = null; try { history.replaceState(null, "", "#home"); } catch { /* fine */ } render(); }
      for (const f of data) { try { svQuickSync(await f.text()); } catch { toast("Couldn't read that file."); } }
    }
    if (pics.length) readShots(pics);
    if (!files.length) toast("Nothing came through. Try sharing it again.");
  }, 0);
  return true;
}

/* ---------- Matches from a snap.fan link ---------- */
const sfl = { busy: false, msg: "", raw: "" };
function findMatchArray(j, depth = 0) {
  if (depth > 5 || !j || typeof j !== "object") return null;
  if (Array.isArray(j)) {
    const objs = j.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    if (objs.length && objs.some((o) => Object.keys(o).some((k) => /cube|result|outcome|won|win/i.test(k)))) return objs;
    for (const x of j) { const f = findMatchArray(x, depth + 1); if (f) return f; }
    return null;
  }
  for (const v of Object.values(j)) { const f = findMatchArray(v, depth + 1); if (f) return f; }
  return null;
}
function pick(o, re) { for (const [k, v] of Object.entries(obj(o))) if (re.test(k)) return v; return undefined; }
function cardKeyFrom(x) { const id = typeof x === "string" ? x : pick(x, /^(cardDefId|carddefid|defId|cardId|id|name|card)$/i); if (!id) return ""; const c = cardByCode(cardCode(String(id))) || cardByName(String(id)) || fuzzyCard(String(id)); return c ? c.key : ""; }
function mapSfMatch(o) {
  let t = pick(o, /^(ended|endedAt|end|finished|finishedAt|createdAt|created|playedAt|played|time|timestamp|date)$/i); t = typeof t === "number" ? (t < 1e12 ? t * 1000 : t) : Date.parse(t);
  const cubesV = num(pick(o, /cube/i)); let res = pick(o, /^(result|outcome|matchResult)$/i); const wonV = pick(o, /^(won|win|isWin|victory|isVictory)$/i);
  res = String(res || "").toLowerCase(); let r = /win|won|victory/.test(res) ? "W" : /los|defeat/.test(res) ? "L" : /tie|draw/.test(res) ? "T" : wonV === true ? "W" : wonV === false ? "L" : cubesV > 0 ? "W" : cubesV < 0 ? "L" : "";
  const deckV = pick(o, /^(deck|myDeck|playerDeck|deckCards|cards)$/i); const deckCards = arr(Array.isArray(deckV) ? deckV : obj(deckV).cards || obj(deckV).Cards).map(cardKeyFrom).filter(Boolean);
  const oppV = pick(o, /^(opponent|opp|enemy)$/i); const oppName = typeof oppV === "string" ? oppV : pick(oppV, /name/i) || pick(o, /opponent.?name|opp.?name/i) || "";
  const oppCards = arr(pick(o, /opponent.?cards|opp.?cards/i) || pick(oppV, /cards/i)).map(cardKeyFrom).filter(Boolean).map((k) => card(k).name);
  const modeV = String(pick(o, /^(mode|gameMode|queue|type|matchType)$/i) || ""); const mode = /conquest/i.test(modeV) ? "Conquest" : /friend/i.test(modeV) ? "Friendly" : /draft/i.test(modeV) ? "Draft" : /rank/i.test(modeV) || !modeV ? "Ranked" : modeV.slice(0, 30);
  const locsV = arr(pick(o, /^(locations|locs|zones)$/i)); const locs = locsV.slice(0, 3).map((l) => ({ name: String(typeof l === "string" ? l : pick(l, /name/i) || "").slice(0, 40), my: num(pick(l, /^(my|mine|me|ours?|player|playerPower|ourPower|myPower|myScore|playerScore)$/i)), opp: num(pick(l, /^(opp|opponent|theirs?|enemy|theirPower|oppPower|opponentPower|enemyPower|oppScore|opponentScore)$/i)) }));
  const id = String(pick(o, /^(id|matchId|gameId|uuid|_id)$/i) || (Number.isFinite(t) ? t : "")).slice(0, 60);
  return { id, ts: Number.isFinite(t) ? t : 0, result: r, cubes: r === "W" ? Math.abs(cubesV) : r === "L" ? -Math.abs(cubesV) : 0, mode, deckCards, oppName: String(oppName).slice(0, 40), oppCards, locs,
    snapped: !!pick(o, /^(snapped|playerSnapped|iSnapped)$/i), oppSnapped: !!pick(o, /opponent.?snapped|opp.?snapped/i), retreated: !!pick(o, /^(retreated|playerRetreated)$/i), oppRetreated: !!pick(o, /opponent.?retreated|opp.?retreated/i) };
}
async function fetchSfLink(link) {
  try { const r = await fetch(link, { cache: "no-store" }); if (r.ok) return await r.text(); throw new Error("status " + r.status); }
  catch (e) {
    const relay = aiRelay(); if (!relay) throw new Error("snap.fan didn't let the app read the link directly. Set up the relay (Settings › AI; account › AI features) and try again.");
    const r = await fetch(`${relay}/fetch?url=${encodeURIComponent(link)}`, { cache: "no-store" }); if (!r.ok) throw new Error(`The relay couldn't read the link (${r.status}). Update the relay code if you set it up before October 28.`); return r.text();
  }
}
async function checkSfLink(manual) {
  const link = String(S.sfLink || "").trim(); if (!link || sfl.busy) return;
  if (!dataReady()) { setTimeout(() => checkSfLink(manual), 1500); return; }
  sfl.busy = true; if (manual) { sfl.msg = "Checking…"; requestRender(); }
  try {
    const text = await fetchSfLink(link); sfl.raw = text.slice(0, 20000);
    let j; try { j = JSON.parse(text); } catch { throw new Error("The link didn't return data the app can read. Copy what it shows and send it to Claude to connect it."); }
    const list = findMatchArray(j); if (!list) throw new Error("No matches found in what the link returned. Play a game, or copy what it shows and send it to Claude.");
    const seen = new Set(arr(S.sfSeen)); let added = 0;
    for (const o of list.slice(0, 200)) {
      const m = mapSfMatch(o); if (!m.result || !m.ts) continue; const key = "sf-" + (m.id || m.ts); if (seen.has(key) || findMatch(key)) continue;
      const sig = [...m.deckCards].sort().join(","); const d = m.deckCards.length >= 10 ? S.decks.find((x) => [...x.cards].sort().join(",") === sig) || S.decks.find((x) => m.deckCards.filter((k) => x.cards.includes(k)).length >= 10) : null;
      const match = { id: key, ts: m.ts, result: m.result, cubes: m.cubes, mode: m.mode, deckId: d ? d.id : "", deckName: d ? d.name : "", oppName: m.oppName, oppCards: m.oppCards, snapped: m.snapped, oppSnapped: m.oppSnapped, retreated: m.retreated, oppRetreated: m.oppRetreated, turn: 6, bot: "unsure", notes: "", locs: m.locs.filter((l) => l.name), tracked: m.locs.filter((l) => l.name).length === 3, sf: true };
      putMatch(match); seen.add(key); added++;
    }
    S.sfSeen = [...seen].slice(-600); S.sfChecked = Date.now(); if (added) { onMatchSaved(); S.sfAdded = num(S.sfAdded) + added; } save();
    sfl.msg = added ? `Added ${plural(added, "new match", "new matches")}.` : "No new matches."; if (added) toast(`snap.fan: ${plural(added, "new match", "new matches")} logged`);
  } catch (e) { sfl.msg = e && e.message ? e.message : "Couldn't check the link."; }
  sfl.busy = false; requestRender();
}
function sfPanel() {
  // snap.fan removed match history (August 31, 2026), so this only shows for someone who already saved a link
  if (!window.SNAPSTAT_STANDALONE || !S.sfLink) return "";
  return `<section class="sec"><h2>Automatic matches from snap.fan</h2><div class="panel stack small">
    <p>snap.fan can see your matches once you sign in there with the same login you use for MARVEL SNAP. It gives you a free personal link (SnapVault calls it a “personal API URL”). Paste it here and SNAP Stat brings in new matches whenever you open the app.</p>
    <ol class="tips"><li>Go to <a href="https://snap.fan/" target="_blank" rel="noopener">snap.fan</a> and sign in with the same Google, Apple or other login your game uses.</li><li>In your snap.fan account settings, find your personal API link and copy it.</li><li>Paste it below and tap Save.</li></ol>
    <label class="f">Your snap.fan link<input type="url" id="sf-link" value="${esc(S.sfLink || "")}" placeholder="https://snap.fan/…" autocomplete="off"></label>
    <div class="row"><button class="btn snap" data-a="sfSave">Save</button>${S.sfLink ? `<button class="btn" data-a="sfCheck" ${sfl.busy ? "disabled" : ""}>Check now</button><button class="btn ghost danger" data-a="sfRemove">Remove</button>` : ""}</div>
    ${sfl.msg ? `<p class="${/Added|No new/.test(sfl.msg) ? "" : "note"}">${esc(sfl.msg)}</p>` : ""}
    ${S.sfChecked ? `<span class="muted">Last checked ${esc(ago(S.sfChecked))}${num(S.sfAdded) ? ` · ${fmt(S.sfAdded)} matches added so far` : ""}.</span>` : ""}
    ${sfl.raw && !/Added|No new/.test(sfl.msg) ? `<button class="btn sm" data-a="sfCopyRaw">${ICON.copy} Copy what the link returned</button>` : ""}
    <span class="muted">This gives snap.fan access to your game login. Only do it if you're comfortable with that. The link stays in your private account data.</span></div></section>`;
}

/* ---------- Wiring ---------- */
Object.assign(A, {
  shotUndo: (el) => shotUndo(num(el.dataset.i)),
  shotsOpen: () => openSheet(shotsSheet),
  sfSave: () => { const v = String(($("#sf-link") || {}).value || "").trim(); if (v && !/^https:\/\/([a-z0-9-]+\.)*snap\.fan\//i.test(v)) { toast("That doesn't look like a snap.fan link"); return; } S.sfLink = v; save(); sfl.msg = ""; render(); if (v) checkSfLink(true); },
  sfCheck: () => checkSfLink(true),
  sfRemove: () => { S.sfLink = ""; sfl.msg = ""; sfl.raw = ""; save(); render(); },
  sfCopyRaw: () => copyText(sfl.raw, "Copied. Paste it to Claude in your chat."),
});
document.addEventListener("change", (e) => {
  const t = e.target, d = t.dataset;
  if (d.shots) { const fs = [...(t.files || [])]; t.value = ""; if (fs.length) readShots(fs); }
});
// Check the snap.fan link when the app opens and every 5 minutes while it's open.
setTimeout(() => whenDataReady(() => { if (S.sfLink) checkSfLink(false); }), 3000);
setInterval(() => { if (S.sfLink && document.visibilityState === "visible") checkSfLink(false); }, 5 * 60e3);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.sfLink && Date.now() - num(S.sfChecked) > 60e3) checkSfLink(false); });
