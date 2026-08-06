/**
 * Card records — REAL rows lifted verbatim from
 * packages/card-data/out/edison-card-catalog.json (the Edison catalog the app ships).
 * Shape matches CardDTO in packages/contracts/src/card.ts, which is what
 * GET /api/cards?passcodes= already returns today (backend delta NH-1: no change needed).
 *
 * No card art in the prototype: the static build must open from file:// with no network,
 * and this is a flow instrument, not a pixel instrument.
 */

export interface CardDTO {
  passcode: number;
  name: string;
  frame: "effect" | "normal" | "spell" | "trap" | "synchro" | "fusion" | "ritual";
  race: string;
  attribute: string | null;
  level: number | null;
  atk: number | null;
  def: number | null;
  desc: string;
}

export const CARDS: Record<number, CardDTO> = {
  9748752: {
    passcode: 9748752,
    name: "Caius the Shadow Monarch",
    frame: "effect",
    race: "Fiend",
    attribute: "DARK",
    level: 6,
    atk: 2400,
    def: 1000,
    desc: "If this card is Tribute Summoned: Target 1 card on the field; banish that target, and if you do, inflict 1000 damage to your opponent if it is a DARK monster.",
  },
  53582587: {
    passcode: 53582587,
    name: "Torrential Tribute",
    frame: "trap",
    race: "Normal",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "When a monster(s) is Summoned: Destroy all monsters on the field.",
  },
  41420027: {
    passcode: 41420027,
    name: "Solemn Judgment",
    frame: "trap",
    race: "Counter",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "When a monster(s) would be Summoned, OR a Spell/Trap Card is activated: Pay half your LP; negate the Summon or activation, and if you do, destroy that card.",
  },
  29401950: {
    passcode: 29401950,
    name: "Bottomless Trap Hole",
    frame: "trap",
    race: "Normal",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "When your opponent Summons a monster(s) with 1500 or more ATK: Destroy that monster(s) with 1500 or more ATK, and if you do, banish it.",
  },
  12538374: {
    passcode: 12538374,
    name: "Treeborn Frog",
    frame: "effect",
    race: "Aqua",
    attribute: "WATER",
    level: 1,
    atk: 100,
    def: 100,
    desc: "If this card is in your Graveyard during your Standby Phase and there are no Spell or Trap Cards on your side of the field, you can Special Summon this card to your side of the field.",
  },
  44330098: {
    passcode: 44330098,
    name: "Gorz the Emissary of Darkness",
    frame: "effect",
    race: "Fiend",
    attribute: "DARK",
    level: 7,
    atk: 2700,
    def: 2500,
    desc: "When you take damage from a card in your opponent's possession: You can Special Summon this card from your hand. You must control no cards to activate and to resolve this effect.",
  },
  63977008: {
    passcode: 63977008,
    name: "Junk Synchron",
    frame: "effect",
    race: "Warrior",
    attribute: "DARK",
    level: 3,
    atk: 1300,
    def: 500,
    desc: "When this card is Normal Summoned: You can target 1 Level 2 or lower monster in your Graveyard; Special Summon that target in Defense Position, but it has its effects negated.",
  },
  70095154: {
    passcode: 70095154,
    name: "Cyber Dragon",
    frame: "effect",
    race: "Machine",
    attribute: "LIGHT",
    level: 5,
    atk: 2100,
    def: 1600,
    desc: "If only your opponent controls a monster, you can Special Summon this card (from your hand).",
  },
  85087012: {
    passcode: 85087012,
    name: "Card Trooper",
    frame: "effect",
    race: "Machine",
    attribute: "EARTH",
    level: 3,
    atk: 400,
    def: 400,
    desc: "Once per turn: You can choose a number from 1 to 3, then send that many cards from the top of your Deck to the GY; this card gains 500 ATK for each card sent this way.",
  },
  5318639: {
    passcode: 5318639,
    name: "Mystical Space Typhoon",
    frame: "spell",
    race: "Quick-Play",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "Target 1 Spell/Trap on the field; destroy that target.",
  },
  14087893: {
    passcode: 14087893,
    name: "Book of Moon",
    frame: "spell",
    race: "Quick-Play",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "Target 1 face-up monster on the field; change that target to face-down Defense Position.",
  },
  26202165: {
    passcode: 26202165,
    name: "Sangan",
    frame: "effect",
    race: "Fiend",
    attribute: "DARK",
    level: 3,
    atk: 1000,
    def: 600,
    desc: "When this card is sent from the field to the Graveyard, move 1 monster with an ATK of 1500 or less from your Deck to your hand.",
  },
  59575539: {
    passcode: 59575539,
    name: "Krebons",
    frame: "effect",
    race: "Psychic",
    attribute: "DARK",
    level: 2,
    atk: 1200,
    def: 400,
    desc: "When this card is targeted for an attack: You can pay 800 LP; negate the attack.",
  },
  70342110: {
    passcode: 70342110,
    name: "Dimensional Prison",
    frame: "trap",
    race: "Normal",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "When an opponent's monster declares an attack: Target that attacking monster; banish that target.",
  },
  21502796: {
    passcode: 21502796,
    name: "Ryko, Lightsworn Hunter",
    frame: "effect",
    race: "Beast",
    attribute: "LIGHT",
    level: 2,
    atk: 200,
    def: 100,
    desc: "FLIP: You can destroy 1 card on the field. Send the top 3 cards of your Deck to the Graveyard.",
  },
  47355498: {
    passcode: 47355498,
    name: "Necrovalley",
    frame: "spell",
    race: "Field",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "All effects that involve Graveyards are negated and neither player can banish cards in the Graveyards.",
  },
  50321796: {
    passcode: 50321796,
    name: "Brionac, Dragon of the Ice Barrier",
    frame: "synchro",
    race: "Sea Serpent",
    attribute: "WATER",
    level: 6,
    atk: 2300,
    def: 1400,
    desc: "1 Tuner + 1 or more non-Tuner monsters\nYou can discard any number of cards to return the same number of cards from the field to the hand.",
  },
  44508094: {
    passcode: 44508094,
    name: "Stardust Dragon",
    frame: "synchro",
    race: "Dragon",
    attribute: "WIND",
    level: 8,
    atk: 2500,
    def: 2000,
    desc: "1 Tuner + 1+ non-Tuner monsters\nWhen a card or effect is activated that would destroy a card(s) on the field (Quick Effect): You can Tribute this card; negate the activation, and if you do, destroy it.",
  },
};

export function card(code: number): CardDTO | null {
  return CARDS[code] ?? null;
}
export function cardName(code: number): string {
  return CARDS[code]?.name ?? (code === 0 ? "Face-down card" : `Unknown card (${code})`);
}
