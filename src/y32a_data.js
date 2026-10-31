/* ============ y32a_data.js: words and lists for getting ready to publish (October 31, 2026) ============
   Data only, so wording can change without touching y32_publish.js. */
// The first-run tour: five cards. "to" is where the card's button goes.
const TOUR_CARDS = [
  { icon: "📈", title: "Every match, counted", text: "Log a match in two taps, or let SNAP Stat do it: the Android app's Track & play, your screenshots, or the PC tracker. Your win rate, cubes and rank climb fill in by themselves.", to: "home/live", btn: "Open Live match" },
  { icon: "🃏", title: "Your whole collection", text: "Cards, variants, splits, avatars, card backs and Mastery. Bring them in from the game's files or SnapVault, or tick them as you go.", to: "cards/cards", btn: "See your cards" },
  { icon: "🧩", title: "Decks that learn", text: "Build decks, paste deck codes, and see how each one really does: by matchup, by location and over time.", to: "cards/decks", btn: "Open decks" },
  { icon: "🤖", title: "Add your own AI key", text: "Reading screenshots and the coach use an AI service you choose. Add a free Gemini key in Settings › AI. It stays on your phone, and only you use it.", to: "settings/ai", btn: "Set up AI" },
  { icon: "⏰", title: "Never miss a reset", text: "The daily reset, missions, seasons, events and shops are all on Home, with reminders if you want them.", to: "home/overview", btn: "Let's go" },
];
// Feature switches the app owner controls (Settings › App owner). "all" = everyone, "me" = only the owner, "off" = nobody.
const FLAG_LIST = [
  { id: "allyChat", label: "Alliance chat", sub: "Social › Alliance", def: "all" },
  { id: "deckLab", label: "Deck lab (likes and comments on shared decks)", sub: "Social › Deck lab", def: "all" },
  { id: "allyStats", label: "Alliance member stats", sub: "Social › Alliance", def: "all" },
  { id: "yearInSnap", label: "Year in SNAP", sub: "Profile", def: "all" },
  { id: "trivia", label: "Daily trivia and card of the day", sub: "Home", def: "all" },
  { id: "aiLetter", label: "AI coach weekly letter", sub: "Home › Stats", def: "all" },
  { id: "seasonalTheme", label: "Seasonal themes", sub: "Everywhere", def: "all" },
];
// Store screenshot mode: the six pages and their captions
const STORE_SHOTS = [
  ["home/overview", "Your MARVEL SNAP season at a glance"],
  ["home/live", "Track every match as you play"],
  ["home/stats", "See what really wins you cubes"],
  ["cards/decks", "Decks that learn from your games"],
  ["cards/cards", "Your whole collection in one place"],
  ["social/alliance", "Plan bounties with your alliance"],
];
// The short version of the community rules, shown where people post
const COMMUNITY_RULES = ["Be kind: no harassment, threats or hate.", "Keep it clean and family-friendly.", "No spam, scams, cheats or selling accounts.", "Don't share anyone's private details.", "Don't fake results or pretend to be someone else."];
