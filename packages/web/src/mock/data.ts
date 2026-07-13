/**
 * In-memory mock data matching Spec-13 shapes.
 * Used by the Vite dev-server middleware and by component tests.
 */
import type { CardDTO, Deck, DeckSummary, User } from "../types/contracts";

export const MOCK_USER: User = {
  id: "user-1",
  displayName: "TestUser",
  role: "member",
};

export const MOCK_CARDS: CardDTO[] = [
  {
    passcode: 89631139,
    name: "Blue-Eyes White Dragon",
    frame: "normal",
    isExtraDeck: false,
    race: "Dragon",
    attribute: "LIGHT",
    level: 8,
    atk: 3000,
    def: 2500,
    desc: "This legendary dragon is a powerful engine of destruction. Virtually invincible, very few have faced this awesome creature and lived to tell the tale.",
    banlist: "unlimited",
    aliasOf: null,
    imageId: 89631139,
  },
  {
    passcode: 46986414,
    name: "Dark Magician",
    frame: "normal",
    isExtraDeck: false,
    race: "Spellcaster",
    attribute: "DARK",
    level: 7,
    atk: 2500,
    def: 2100,
    desc: "The ultimate wizard in terms of attack and defense.",
    banlist: "unlimited",
    aliasOf: null,
    imageId: 46986414,
  },
  {
    passcode: 14558127,
    name: "Stardust Dragon",
    frame: "synchro",
    isExtraDeck: true,
    race: "Dragon",
    attribute: "WIND",
    level: 8,
    atk: 2500,
    def: 2000,
    desc: "1 Tuner + 1 or more non-Tuner monsters. During either player's turn, when a card or effect is activated that would destroy a card(s) on the field, you can Tribute this card to negate the activation, and if you do, destroy it. During the End Phase, if this effect was activated this turn, Special Summon this card from your Graveyard.",
    banlist: "unlimited",
    aliasOf: null,
    imageId: 14558127,
  },
  {
    passcode: 34541863,
    name: "Blackwing - Gale the Whirlwind",
    frame: "effect",
    isExtraDeck: false,
    race: "Winged Beast",
    attribute: "DARK",
    level: 3,
    atk: 1300,
    def: 400,
    desc: 'If you control a face-up "Blackwing" monster other than "Blackwing - Gale the Whirlwind", you can Special Summon this card from your hand. Once per turn, you can select 1 face-up monster your opponent controls. That monster\'s ATK and DEF become half its current ATK and DEF.',
    banlist: "semi",
    aliasOf: null,
    imageId: 34541863,
  },
  {
    passcode: 72302403,
    name: "Goyo Guardian",
    frame: "synchro",
    isExtraDeck: true,
    race: "Warrior",
    attribute: "EARTH",
    level: 6,
    atk: 2800,
    def: 2000,
    desc: "1 Tuner + 1 or more non-Tuner monsters. When this card destroys an opponent's monster by battle and sends it to the Graveyard, you can Special Summon that monster to your side of the field in Defense Position.",
    banlist: "limited",
    aliasOf: null,
    imageId: 72302403,
  },
  {
    passcode: 83764719,
    name: "Black Luster Soldier - Envoy of the Beginning",
    frame: "effect",
    isExtraDeck: false,
    race: "Warrior",
    attribute: "LIGHT",
    level: 8,
    atk: 3000,
    def: 2500,
    desc: "Cannot be Normal Summoned/Set. Must first be Special Summoned (from your hand) by banishing 1 LIGHT and 1 DARK monster from your GY. Once per turn, you can use 1 of these effects. ●: Target 1 monster on the field; banish it. ●: If this card destroyed a monster by battle: It can make a second attack during the Battle Phase of this turn.",
    banlist: "forbidden",
    aliasOf: null,
    imageId: 83764719,
  },
  {
    passcode: 55144522,
    name: "Pot of Greed",
    frame: "spell",
    isExtraDeck: false,
    race: "Normal",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "Draw 2 cards.",
    banlist: "forbidden",
    aliasOf: null,
    imageId: 55144522,
  },
  {
    passcode: 47942077,
    name: "Monster Reborn",
    frame: "spell",
    isExtraDeck: false,
    race: "Normal",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "Target 1 monster in either GY; Special Summon it.",
    banlist: "limited",
    aliasOf: null,
    imageId: 47942077,
  },
  {
    passcode: 53129443,
    name: "Mirror Force",
    frame: "trap",
    isExtraDeck: false,
    race: "Normal",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "When an opponent's monster declares an attack: Destroy all Attack Position monsters your opponent controls.",
    banlist: "limited",
    aliasOf: null,
    imageId: 53129443,
  },
  {
    passcode: 77585513,
    name: "Blackwing - Bora the Spear",
    frame: "effect",
    isExtraDeck: false,
    race: "Winged Beast",
    attribute: "DARK",
    level: 4,
    atk: 1700,
    def: 800,
    desc: 'If you control a face-up "Blackwing" monster other than "Blackwing - Bora the Spear", you can Special Summon this card from your hand. This card cannot be used as a Synchro Material Monster, except for the Synchro Summon of a "Blackwing" monster.',
    banlist: "unlimited",
    aliasOf: null,
    imageId: 77585513,
  },
  {
    passcode: 61705989,
    name: "Blackwing Armed Wing",
    frame: "synchro",
    isExtraDeck: true,
    race: "Winged Beast",
    attribute: "DARK",
    level: 6,
    atk: 2300,
    def: 1500,
    desc: '1 "Blackwing" Tuner + 1 or more non-Tuner monsters. If this card attacks a Defense Position monster, inflict piercing battle damage to your opponent.',
    banlist: "unlimited",
    aliasOf: null,
    imageId: 61705989,
  },
  {
    passcode: 17631198,
    name: "Torrential Tribute",
    frame: "trap",
    isExtraDeck: false,
    race: "Normal",
    attribute: null,
    level: null,
    atk: null,
    def: null,
    desc: "When a monster(s) is Normal or Special Summoned: Destroy all monsters on the field.",
    banlist: "semi",
    aliasOf: null,
    imageId: 17631198,
  },
];

const sessions: Map<string, User> = new Map();
const decks: Map<string, Deck & { ownerId: string }> = new Map();
let deckCounter = 1;

export function mockLogin(displayName: string, _password: string): User | null {
  if (displayName === "TestUser" || displayName === "admin") {
    return MOCK_USER;
  }
  return null;
}

export function mockRedeemInvite(
  inviteCode: string,
  displayName: string,
  _password: string,
): User | null {
  if (inviteCode === "TESTINVITE") {
    return { id: "user-new-" + Date.now(), displayName, role: "member" };
  }
  return null;
}

export function getSession(sid: string): User | null {
  return sessions.get(sid) ?? null;
}

export function createSession(user: User): string {
  const sid = "mock-sid-" + Math.random().toString(36).slice(2);
  sessions.set(sid, user);
  return sid;
}

export function deleteSession(sid: string): void {
  sessions.delete(sid);
}

export function getUserDecks(userId: string): DeckSummary[] {
  return Array.from(decks.values())
    .filter((d) => d.ownerId === userId)
    .map(deckToSummary);
}

export function getDeckById(id: string): (Deck & { ownerId: string }) | undefined {
  return decks.get(id);
}

function validateDeck(
  main: number[],
  extra: number[],
  side: number[],
): import("../types/contracts").DeckValidation {
  const violations: import("../types/contracts").Violation[] = [];

  if (main.length < 40) {
    violations.push({
      code: "main_size",
      message: `Main deck has ${main.length} cards (need 40–60)`,
      zone: "main",
    });
  } else if (main.length > 60) {
    violations.push({
      code: "main_size",
      message: `Main deck has ${main.length} cards (max 60)`,
      zone: "main",
    });
  }

  if (extra.length > 15) {
    violations.push({
      code: "extra_size",
      message: `Extra deck has ${extra.length} cards (max 15)`,
      zone: "extra",
    });
  }

  if (side.length > 15) {
    violations.push({
      code: "side_size",
      message: `Side deck has ${side.length} cards (max 15)`,
      zone: "side",
    });
  }

  // Check copy counts and banlist
  const copyCounts = new Map<number, number>();
  for (const p of [...main, ...extra, ...side]) {
    const card = MOCK_CARDS.find((c) => c.passcode === p);
    const basePasscode = card?.aliasOf ?? p;
    copyCounts.set(basePasscode, (copyCounts.get(basePasscode) ?? 0) + 1);
  }

  for (const [passcode, count] of copyCounts) {
    const card = MOCK_CARDS.find((c) => c.passcode === passcode || c.aliasOf === passcode);
    if (!card) {
      violations.push({
        code: "unknown_passcode",
        message: `Unknown passcode ${passcode}`,
        passcode,
      });
      continue;
    }
    if (card.banlist === "forbidden" && count > 0) {
      violations.push({
        code: "banlist_forbidden",
        message: `${card.name} is Forbidden`,
        passcode,
      });
    } else if (card.banlist === "limited" && count > 1) {
      violations.push({
        code: "banlist_limit",
        message: `${card.name} is Limited (max 1); you have ${count}`,
        passcode,
      });
    } else if (card.banlist === "semi" && count > 2) {
      violations.push({
        code: "banlist_limit",
        message: `${card.name} is Semi-Limited (max 2); you have ${count}`,
        passcode,
      });
    } else if (count > 3) {
      violations.push({
        code: "copy_limit",
        message: `${card.name}: max 3 copies; you have ${count}`,
        passcode,
      });
    }
  }

  return {
    legal: violations.length === 0,
    counts: { main: main.length, extra: extra.length, side: side.length },
    violations,
  };
}

export function saveDeck(
  ownerId: string,
  name: string,
  main: number[],
  extra: number[],
  side: number[],
  id?: string,
): Deck & { ownerId: string } {
  const deckId = id ?? `deck-${deckCounter++}`;
  const validation = validateDeck(main, extra, side);
  const deck: Deck & { ownerId: string } = {
    id: deckId,
    name,
    ownerId,
    main,
    extra,
    side,
    validation,
    updatedAt: new Date().toISOString(),
  };
  decks.set(deckId, deck);
  return deck;
}

export function deleteDeckById(id: string): boolean {
  return decks.delete(id);
}

function deckToSummary(d: Deck & { ownerId: string }): DeckSummary {
  return {
    id: d.id,
    name: d.name,
    isValid: d.validation.legal,
    counts: d.validation.counts,
    updatedAt: d.updatedAt,
  };
}

export function filterCards(params: Record<string, string>): {
  total: number;
  page: number;
  pageSize: number;
  cards: CardDTO[];
} {
  let results = [...MOCK_CARDS];

  if (params.q) {
    const q = params.q.toLowerCase();
    results = results.filter((c) => c.name.toLowerCase().includes(q));
  }
  if (params.frame) {
    results = results.filter((c) => c.frame === params.frame);
  }
  if (params.attribute) {
    results = results.filter((c) => c.attribute === params.attribute);
  }
  if (params.banlist) {
    results = results.filter((c) => c.banlist === params.banlist);
  }
  if (params.text) {
    const t = params.text.toLowerCase();
    results = results.filter((c) => c.desc.toLowerCase().includes(t));
  }

  const page = parseInt(params.page ?? "1", 10);
  const pageSize = parseInt(params.pageSize ?? "60", 10);
  const total = results.length;
  const start = (page - 1) * pageSize;
  const cards = results.slice(start, start + pageSize);

  return { total, page, pageSize, cards };
}

export function parseYdk(ydkText: string): {
  name: string;
  main: number[];
  extra: number[];
  side: number[];
  validation: ReturnType<typeof validateDeck>;
} {
  const main: number[] = [];
  const extra: number[] = [];
  const side: number[] = [];
  const violations: import("../types/contracts").Violation[] = [];

  let zone: "main" | "extra" | "side" | null = null;
  let lineNum = 0;
  const lines = ydkText.replace(/\r\n/g, "\n").split("\n");

  for (const rawLine of lines) {
    lineNum++;
    const line = rawLine.trim();
    if (line === "") continue;
    if (line === "#main") {
      zone = "main";
      continue;
    }
    if (line === "#extra") {
      zone = "extra";
      continue;
    }
    if (line === "!side") {
      zone = "side";
      continue;
    }
    if (line.startsWith("#") || line.startsWith("!")) {
      continue; // comment or unknown marker
    }

    const passcode = parseInt(line, 10);
    if (isNaN(passcode)) {
      violations.push({
        code: "parse_error",
        message: `Line ${lineNum}: "${line}" is not a valid passcode`,
        line: lineNum,
      });
      continue;
    }

    if (zone === null) {
      violations.push({
        code: "parse_error",
        message: `Line ${lineNum}: passcode ${passcode} before any section marker`,
        line: lineNum,
        passcode,
      });
      continue;
    }

    const card = MOCK_CARDS.find((c) => c.passcode === passcode);
    if (!card) {
      violations.push({
        code: "unknown_passcode",
        message: `Line ${lineNum}: passcode ${passcode} not in Edison pool`,
        line: lineNum,
        passcode,
      });
    }

    // Route to correct zone
    if (card?.isExtraDeck && zone === "main") {
      extra.push(passcode);
    } else if (card && !card.isExtraDeck && zone === "extra") {
      main.push(passcode);
    } else {
      (zone === "main" ? main : zone === "extra" ? extra : side).push(passcode);
    }
  }

  const deckValidation = validateDeck(main, extra, side);
  deckValidation.violations.unshift(...violations);
  deckValidation.legal = deckValidation.violations.length === 0;

  return { name: "Imported Deck", main, extra, side, validation: deckValidation };
}

export function buildYdk(
  name: string | undefined,
  main: number[],
  extra: number[],
  side: number[],
): string {
  const lines: string[] = [];
  if (name) lines.push(`#created by ${name}`);
  lines.push("#main");
  for (const p of main) lines.push(String(p));
  lines.push("#extra");
  for (const p of extra) lines.push(String(p));
  lines.push("!side");
  for (const p of side) lines.push(String(p));
  return lines.join("\n") + "\n";
}
