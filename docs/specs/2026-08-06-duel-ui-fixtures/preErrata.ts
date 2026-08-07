/**
 * Cards whose Edison text differs from the modern printing shown on the card image.
 *
 * GENERATED from `packages/card-data/src/preErrataDescOverrides.json` — the repo's own
 * pre-errata override corpus, 36 cards. Do not hand-edit and do not hand-list:
 * the badge keys off MEMBERSHIP OF THIS SET, so a card that gains or loses an override
 * gains or loses the badge with no UI change.
 *
 * In the real client this is NOT shipped as a constant. `packages/card-data` already
 * applies these overrides when it builds the catalog, so it knows; the flag rides on the
 * CardDTO that `/api/cards` already returns. See backend delta ND-6 in
 * component-contract.md. This file stands in for that field in the prototype.
 */

export const PRE_ERRATA_PASSCODES: ReadonlySet<number> = new Set([
  25862681, // Ancient Fairy Dragon
  29071332, // Armory Arm
  71645242, // Black Garden
  87910978, // Brain Control
  50321796, // Brionac, Dragon of the Ice Barrier
  95727991, // Catapult Turtle
  3370104, // Cyber Phoenix
  48092532, // D.D. Survivor
  88643579, // Dark End Dragon
  80168720, // Darkness Approaches
  76263644, // Destiny End Dragoon
  89312388, // Elemental HERO Prisma
  34471458, // Fortune Lady Light
  77565204, // Future Fusion
  7391448, // Goyo Guardian
  44364207, // Jade Knight
  25132288, // Light End Dragon
  47297616, // Light and Darkness Dragon
  95503687, // Lumina, Lightsworn Summoner
  42940404, // Machina Gearframe
  45247637, // Mark of the Rose
  80921533, // Mausoleum of the Emperor
  69279219, // My Body as a Shield
  47355498, // Necrovalley
  20932152, // Quickdraw Synchron
  88264978, // Red-Eyes Darkness Metal Dragon
  14878871, // Rescue Cat
  21502796, // Ryko, Lightsworn Hunter
  26202165, // Sangan
  68005187, // Soul Exchange
  41006930, // Strike Ninja
  40473581, // Susa Soldier
  9126351, // Swap Frog
  12538374, // Treeborn Frog
  80604091, // Ultimate Offering
  94634433, // Urgent Tuning
]);

/** True when our rendered text is the 2010 text and the image is the modern printing. */
export function hasPreErrataText(passcode: number): boolean {
  return PRE_ERRATA_PASSCODES.has(passcode);
}
