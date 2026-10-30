"use strict";
/* ============ Starter card list: name|cost|power|tags|ability. Balance patches change these; every card is editable in the app. ============ */
const CARD_SRC = `Wasp|0|1||
Ant-Man|1|1|O B|Ongoing: If you have 3 other cards here, +3 Power.
Agent 13|1|2|R S|On Reveal: Add a random card to your hand.
Bast|1|1|R B|On Reveal: Set the Power of all cards in your hand to 3.
Blade|1|3|R X|On Reveal: Discard the rightmost card from your hand.
Deadpool|1|1|D B|When this is destroyed, return it to your hand with double the Power.
Elektra|1|2|R D|On Reveal: Destroy a random enemy 1-Cost card at this location.
Hawkeye|1|1|R B|On Reveal: If you play a card here next turn, +3 Power.
Iceman|1|2|R C|On Reveal: Give a random card in your opponent's hand +1 Cost.
Iron Fist|1|2|R M|On Reveal: After you play your next card, move it one location to the left.
Korg|1|2|R J|On Reveal: Shuffle a Rock into your opponent's deck.
Mantis|1|2|R S|On Reveal: If your opponent plays a card here this turn, draw a card from their deck.
Misty Knight|1|2||
Nightcrawler|1|2|M|You can move this once.
Nova|1|1|D B|When this is destroyed, give your cards +1 Power.
Quicksilver|1|2||Starts in your opening hand.
Rocket Raccoon|1|2|R B|On Reveal: If your opponent played a card here this turn, +2 Power.
Silver Sable|1|2|R C|On Reveal: Steal 2 Power from the top card of your opponent's deck.
Squirrel Girl|1|2|R S|On Reveal: Add a Squirrel to each other location.
Sunspot|1|0|O P|At the end of each turn, gain +1 Power for each unspent Energy.
The Hood|1|-2|X S|When this is discarded, add a Demon to your hand.
Titania|1|5|J|Plays on your opponent's side of the location.
Yondu|1|2|R C|On Reveal: Remove the lowest-Cost card from your opponent's deck.
Angela|2|2|O B M|After you play a card here, +1 Power.
Armor|2|3|O|Ongoing: Cards at this location can't be destroyed.
Bucky Barnes|2|1|D S|When this is destroyed, create the Winter Soldier in its place.
Cable|2|2|R C|On Reveal: Draw the bottom card of your opponent's deck.
Carnage|2|2|R D B|On Reveal: Destroy your other cards here. +2 Power for each one destroyed.
Collector|2|2|O S B|When a card enters your hand from anywhere except your deck, +1 Power.
Colossus|2|3||Can't be destroyed, moved, or have its Power reduced.
Forge|2|2|R B|On Reveal: Give the next card you play +2 Power.
Hazmat|2|2|R C|On Reveal: Afflict all other cards with -1 Power.
Kraven|2|2|O M B|When a card moves here, this gains +2 Power.
Lizard|2|5|O|Ongoing: -4 Power if your opponent has 4 cards here.
Medusa|2|2|R|On Reveal: If this is at the middle location, +3 Power.
Mister Sinister|2|2|R S|On Reveal: Add a Sinister Clone with the same Power to this location.
Morbius|2|0|O X B|Ongoing: +2 Power for each time you discarded a card this game.
Multiple Man|2|3|M S|When this moves, add a copy to the old location.
Psylocke|2|1|R P|On Reveal: Next turn, you get +1 Energy.
Scarlet Witch|2|3|R L|On Reveal: Replace this location with a random location.
Sentinel|2|3|R S|On Reveal: Add another Sentinel to your hand.
Shocker|2|3||
Star-Lord|2|2|R B|On Reveal: If your opponent played a card here this turn, +3 Power.
Swarm|2|3|X S|When this is discarded, add two copies that cost 0 to your hand.
Wolverine|2|2|D B|When this is discarded or destroyed, regenerate it with +2 Power at a random location.
Zabu|2|2|O P|Ongoing: Your 4-Cost cards cost 1 less.
Bishop|3|1|O B|Whenever you play a card, this gains +1 Power.
Brood|3|2|R S|On Reveal: Add 2 Broodlings to this location with the same Power.
Captain America|3|3|O B|Ongoing: Your other cards at this location have +1 Power.
Cerebro|3|0|O B|Ongoing: Your highest Power cards get +2 Power.
Cosmo|3|3|O C|Ongoing: On Reveal abilities won't happen at this location.
Cyclops|3|4||
Debrii|3|3|R J|On Reveal: Add a Rock to each other location, for both players.
Doctor Strange|3|3|R M|On Reveal: Move your highest Power cards to this location.
Electro|3|2|R P|On Reveal: +1 Max Energy. Ongoing: You can only play 1 card a turn.
Hulkbuster|3|3|R B|On Reveal: Merge this with one of your other cards at this location.
Ironheart|3|0|R B|On Reveal: Give 3 other friendly cards +2 Power.
Killmonger|3|3|R D|On Reveal: Destroy all 1-Cost cards.
Lady Sif|3|5|R X|On Reveal: Discard the highest-Cost card from your hand.
Mister Fantastic|3|2|O B|Ongoing: Adjacent locations have +2 Power.
Mobius M. Mobius|3|3|O C|Ongoing: Your Costs can't be increased. Your opponent's Costs can't be reduced.
Mystique|3|0|R O|On Reveal: If the last card you played has an Ongoing ability, this gains it.
Patriot|3|1|O B|Ongoing: Your cards with no abilities have +2 Power.
Silver Surfer|3|2|R B|On Reveal: Give your other 3-Cost cards +2 Power.
Storm|3|2|R L|On Reveal: Flood this location. Next turn is the last turn cards can be played here.
Sword Master|3|6|R X|On Reveal: Discard a card from your hand.
Wave|3|3|R P|On Reveal: Until the end of next turn, all cards cost 4.
Wolfsbane|3|1|R B|On Reveal: +2 Power for each other card you have here.
Dracula|4|0|X B|At the end of the game, discard a card from your hand. This gains its Power.
Enchantress|4|5|R C|On Reveal: Remove the abilities from all Ongoing cards at this location.
Ghost Rider|4|3|R X|On Reveal: Return a discarded card to this location.
High Evolutionary|4|4|O B|At the start of the game, unlock the hidden abilities of cards with no abilities.
Jessica Jones|4|5|O|On Reveal: If you don't play a card here next turn, +4 Power.
Jubilee|4|1|R S|On Reveal: Play a card from your deck at this location.
Ka-Zar|4|4|O B|Ongoing: Your 1-Cost cards have +1 Power.
Mister Negative|4|-1|R P|On Reveal: Swap the Power and Cost of all cards in your deck.
Moon Girl|4|5|R S|On Reveal: Duplicate your hand.
Namor|4|5|O|Ongoing: +5 Power if this is your only card here.
Sandman|4|1|O C|Ongoing: Players can only play 1 card a turn.
Sentry|4|10|R J|Can't be played at the right location. On Reveal: Add a Void to the right location.
Shang-Chi|4|3|R D C|On Reveal: Destroy all enemy cards at this location that have 10 or more Power.
Shuri|4|2|R B|On Reveal: Double the Power of the next card you play.
Spider-Man|4|3|R C|On Reveal: Your opponent can't play cards at this location next turn.
Thing|4|6||
Wong|4|2|O|Ongoing: Your On Reveal abilities at this location happen twice.
Abomination|5|9|H|
Black Panther|5|4|R B|On Reveal: Double this card's Power.
Blue Marvel|5|3|O B|Ongoing: Your other cards have +1 Power.
Devil Dinosaur|5|3|O B|Ongoing: +2 Power for each card in your hand.
Gamora|5|7|R|On Reveal: If your opponent played a card here this turn, +5 Power.
Iron Man|5|0|O B|Ongoing: Your total Power is doubled at this location.
Klaw|5|4|O B|Ongoing: The location to the right has +6 Power.
Red Skull|5|14|O H|Ongoing: Enemy cards at this location have +2 Power.
Sera|5|4|O P|Ongoing: Cards in your hand cost 1 less (minimum 1).
Taskmaster|5|0|R B|On Reveal: Set this card's Power to the Power of the last card you played.
White Tiger|5|1|R S|On Reveal: Add a 7-Power Tiger to another location.
Apocalypse|6|8|X B|When you discard this from your hand, put it back with +4 Power.
Destroyer|6|15|R D H|On Reveal: Destroy your other cards.
Doctor Doom|6|5|R S|On Reveal: Add a 5-Power DoomBot to each other location.
Hela|6|6|X|On Reveal: Resurrect all cards you discarded to random locations.
Hulk|6|12|H|
Infinaut|6|20|H|If you played a card last turn, you can't play this.
Knull|6|0|D B|Ongoing: Has the combined Power of all cards destroyed this game.
Magneto|6|12|R C M|On Reveal: Move all opposing 3 and 4-Cost cards to this location.
Odin|6|8|R|On Reveal: Activate the On Reveal abilities of your other cards at this location.
Onslaught|6|7|O|Ongoing: Double your other Ongoing effects at this location.
Spectrum|6|5|R B|On Reveal: Give your Ongoing cards +2 Power.
Thanos|6|10|R S|At the start of the game, shuffle the six Infinity Stones into your deck.
Ultron|6|8|R S|On Reveal: Create Drones at each other location.
Death|8|12|D|Costs 1 less for each card destroyed this game.`;

const TAGS = { R: "On Reveal", O: "Ongoing", D: "Destroy", X: "Discard", M: "Move", B: "Buff", C: "Disrupt", J: "Gives cards", P: "Energy", S: "Adds cards", L: "Location", H: "Big body" };
const RARITIES = ["Rare", "Super Rare", "Spotlight", "Amazing", "Sensational", "Exquisite", "Ultimate"];
const VAR_SOURCES = ["General Pool", "Token Shop", "Bundle", "Season Pass", "Spotlight", "Album", "Promo", "Live Release", "Conquest Shop", "Champion Arena", "Sanctum Showdown", "Deadpool's Diner", "High Voltage", "Team-Up", "Overloaded", "Event"];
const COS = { cardback: "Card back", avatar: "Avatar", title: "Title", emote: "Emote" };
const SHOPS = { snap: "Snap Shop", collector: "Collector's Shop", web: "Web Shop" };
const CURR = { gold: "Gold", tokens: "Collector's Tokens", credits: "Credits", usd: "USD" };
const EVENT_TYPES = { mode: "Limited-time mode", event: "Event", spotlight: "Spotlight", sprint: "Sprint", login: "Login event", other: "Other" };
const PASS_TIERS = { free: "Free", premium: "Premium", plus: "Premium+" };
const COUNTRY_CODES = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");
let _regionNames = null;
function countryName(code) {
  if (!code) return "";
  try { _regionNames = _regionNames || new Intl.DisplayNames(undefined, { type: "region" }); return _regionNames.of(code) || code; } catch { return code; }
}
function flag(code) { return code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : ""; }
function countryOptions(sel) { return `<option value="">Choose a country</option>` + COUNTRY_CODES.map((c) => [c, countryName(c)]).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => `<option value="${c}" ${sel === c ? "selected" : ""}>${n}</option>`).join(""); }
