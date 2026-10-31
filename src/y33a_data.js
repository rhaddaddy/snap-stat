/* ============ y33a_data.js: words for the fun extras (October 31, 2026) ============ */
// MARVEL SNAP history and rules for the daily trivia: [question, right answer, three wrong answers]
const TRIVIA_FACTS = [
  ["When did MARVEL SNAP come out worldwide?", "October 2022", ["March 2021", "June 2023", "January 2022"]],
  ["Which studio makes MARVEL SNAP?", "Second Dinner", ["Blizzard", "Riot Games", "Supercell"]],
  ["How many cards are in a MARVEL SNAP deck?", "12", ["10", "15", "20"]],
  ["How many locations are in a normal match?", "3", ["2", "4", "5"]],
  ["How many cards can one location hold on your side?", "4", ["3", "5", "6"]],
  ["What's the most cubes one match can be worth?", "8", ["4", "6", "16"]],
  ["What rank do you reach Infinite at?", "100", ["70", "90", "120"]],
  ["How many turns does a normal match last?", "6", ["5", "7", "8"]],
  ["What's the most cards you can hold in your hand?", "7", ["6", "8", "10"]],
  ["Which award did MARVEL SNAP win at The Game Awards 2022?", "Best Mobile Game", ["Game of the Year", "Best Strategy Game", "Best Debut Indie Game"]],
  ["When both players win one location and tie one, what decides the winner?", "Total Power across all locations", ["Whoever played last", "The location revealed first", "It's always a tie"]],
  ["How much energy do you get on turn 4?", "4", ["3", "5", "6"]],
  ["On which turns are the three locations revealed?", "1, 2 and 3", ["1, 3 and 5", "All on turn 1", "2, 4 and 6"]],
  ["What happens to the cubes when the final turn ends?", "They double", ["They reset", "They halve", "Nothing"]],
  ["How many cards do you start a match with in your hand?", "3", ["4", "5", "2"]],
  ["Who was Second Dinner's chief development officer, formerly Hearthstone's game director?", "Ben Brode", ["Jeff Kaplan", "Hidetaka Miyazaki", "Ed McMillen"]],
];
// Sounds: [frequency Hz, start s, length s] notes for each moment
const SFX_NOTES = {
  win: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.22]],
  loss: [[392, 0, 0.16], [330, 0.14, 0.26]],
  snap: [[880, 0, 0.06], [1320, 0.05, 0.1]],
  tap: [[660, 0, 0.03]],
};
// Seasonal looks: [id, name, from "MM-DD", to "MM-DD", emoji]
const SEASONAL = [["halloween", "Halloween", "10-24", "11-01", "🎃"], ["holidays", "Holidays", "12-18", "12-30", "❄️"], ["newyear", "New Year", "12-31", "01-02", "🎆"], ["valentine", "Valentine's", "02-12", "02-14", "💜"], ["anniversary", "SNAP's birthday", "10-17", "10-19", "🎂"]];
// Stream overlay styles
const OV_STYLES = [["app", "App colours"], ["accent", "My accent"], ["glass", "See-through"], ["mono", "Black & white"]];
const OV_SIZES = [["compact", "Compact"], ["normal", "Normal"], ["big", "Big"]];
