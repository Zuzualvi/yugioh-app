import type { QuickAnswer } from "@yugioh-app/contracts";

/**
 * Curated Quick Answers — the table-side fast path (J1).
 *
 * Each entry maps a question (as a player would say it) to a canonical ID
 * (page id or page id + "#" + anchor). The app resolves these to URLs via
 * the manifest (resolveCanonicalId).
 *
 * Maintained by the content team (Track C). Every target below is verified to
 * resolve to a real page id or an anchor present in the generated manifest.
 */
export const QUICK_ANSWERS: QuickAnswer[] = [
  {
    question: "Who draws on turn 1?",
    canonicalId: "rules.diff.01",
  },
  {
    question: "Who goes first — and do they pick?",
    canonicalId: "rules.primer.turn#who-goes-first",
  },
  {
    question: "Can I attack on turn 1?",
    canonicalId: "rules.primer.turn#no-turn-1-battle-phase",
  },
  {
    question: "Can I use my monster's effect before Bottomless/Torrential? (priority)",
    canonicalId: "rules.diff.06",
  },
  {
    question: "What can be activated in the Damage Step?",
    canonicalId: "rules.diff.08#what-can-activate",
  },
  {
    question: "What order do simultaneous effects go on the chain? (SEGOC)",
    canonicalId: "rules.diff.07#four-step-order",
  },
  {
    question: "Does setting a Field Spell blow up their Field Spell?",
    canonicalId: "rules.diff.02",
  },
  {
    question: "How many Union monsters can equip one monster?",
    canonicalId: "rules.diff.03#one-union-per-monster",
  },
  {
    question: "Can I pay a cost that takes me to exactly 0 LP?",
    canonicalId: "rules.diff.10#cost-to-zero",
  },
  {
    question: "Can I respond to the end-of-turn hand-size discard?",
    canonicalId: "rules.diff.11",
  },
  {
    question: "Do two 0-ATK monsters destroy each other in battle?",
    canonicalId: "rules.diff.13",
  },
  {
    question: "Is Brionac / Sangan / Rescue Cat once-per-turn in Edison?",
    canonicalId: "rules.card.reference#brionac",
  },
  {
    question: "How big can my Side Deck be?",
    canonicalId: "rules.primer.deck#side-deck",
  },
  {
    question: "How does a chain resolve? (last-in-first-out)",
    canonicalId: "rules.primer.chains#resolution-order",
  },
  {
    question: "Is this card pre-errata in Edison?",
    canonicalId: "rules.card.reference",
  },
];
