/* ============ Character Mastery: the game's numbers (data only) ============
   Total Mastery XP each level needs (level 1 = 0 XP … level 30 = 1,300 XP) and what each level gives, as listed by
   Marvel Snap Zone after the September 15, 2026 update (which added the second Custom Card slot at level 22).
   XP comes from owning the card's variants and Infinity Splits (the ones you already had count too). */
const MASTERY_XP = [0, 5, 10, 20, 35, 50, 70, 95, 120, 150, 185, 220, 260, 305, 355, 405, 460, 520, 585, 650, 715, 780, 845, 910, 975, 1040, 1105, 1170, 1235, 1300];
const MASTERY_MAX = MASTERY_XP.length; // 30
const MASTERY_SLOT2 = 22;               // the level that adds a second Custom Card slot
const MASTERY_REWARDS = {
  1: "Mastery unlocked", 4: "30 Character Boosters", 8: "20 Wild Boosters", 10: "Refraction Finish", 12: "30 Wild Boosters and the card's Reaction Set",
  15: "Cosmic Flare", 17: "A Split Reroll Coin", 20: "Gold Metallic Finish", 22: "A second Custom Card slot", 25: "Fire Finish", 27: "An Unowned God Split",
  30: "50 Wild Boosters and the Gold Diamond Flare",
};
// Every other level is a Mastery Cache: a random Finish or Flare from its tier
const masteryReward = (lv) => MASTERY_REWARDS[lv] || (lv >= 2 && lv <= 29 ? `Mastery Cache (tier ${lv < 10 ? 1 : lv < 20 ? 2 : 3}: a random Finish or Flare)` : "");
// Mastery XP for each thing you own of a card
const MASTERY_GAIN = { split: 50, Rare: 75, "Super Rare": 150, Spotlight: 400, Ultimate: 600, other: 200 };
