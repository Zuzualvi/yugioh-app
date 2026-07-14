# Edison Format Card Script Overrides

Each file here takes precedence over the official script when the engine loads a card for Edison format duels. The scriptLoader requests files as `c<scriptpasscode>.lua`.

## DROPIN (11) — pre-errata script used as-is

| Display passcode | Card name                          | Script passcode | File           |
| ---------------- | ---------------------------------- | --------------- | -------------- |
| 50321796         | Brionac, Dragon of the Ice Barrier | 511002993       | c511002993.lua |
| 26202165         | Sangan                             | 511002631       | c511002631.lua |
| 14878871         | Rescue Cat                         | 511002992       | c511002992.lua |
| 7391448          | Goyo Guardian                      | 511002994       | c511002994.lua |
| 87910978         | Brain Control                      | 511002995       | c511002995.lua |
| 77565204         | Future Fusion                      | 511002997       | c511002997.lua |
| 47355498         | Necrovalley                        | 511002998       | c511002998.lua |
| 21502796         | Ryko, Lightsworn Hunter            | 511003007       | c511003007.lua |
| 95727991         | Catapult Turtle                    | 511000228       | c511000228.lua |
| 80168720         | Darkness Approaches                | 511003028       | c511003028.lua |
| 80604091         | Ultimate Offering                  | 511003023       | c511003023.lua |

## FIXED (1) — pre-errata script with targeted fix

| Display passcode | Card name                      | Script passcode | File          | Change                                                                                                                                                                   |
| ---------------- | ------------------------------ | --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 88264978         | Red-Eyes Darkness Metal Dragon | 88264978        | c88264978.lua | `SetCountLimit(1,id,OATH)` → `SetCountLimit(1)` and `SetCountLimit(1,{id,1})` → `SetCountLimit(1)` on both summon procedure and ignition effect (per-copy, not per-name) |

## AUTHORED (13) — modern base script with minimal Edison changes

| Display passcode | Card name                 | Script passcode | File          | Change                                                                                                                                                                            |
| ---------------- | ------------------------- | --------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25862681         | Ancient Fairy Dragon      | 25862691        | c25862691.lua | (1) Removed `PHASE_MAIN1` condition from SSummon effect (works in MP1+MP2). (2) Changed field-spell destroy to target-select ONE card (not destroy all)                           |
| 88643579         | Dark End Dragon           | 88643579        | c88643579.lua | Removed `EFFECT_FLAG_CARD_TARGET`; monster selected at resolution (non-targeting)                                                                                                 |
| 76263644         | Destiny End Dragoon       | 76263644        | c76263644.lua | (1) Removed `EFFECT_FLAG_CARD_TARGET` from destroy effect; monster selected at resolution. (2) Removed `IsFaceup()` guard on damage calculation                                   |
| 89312388         | Elemental HERO Prisma     | 89312388        | c89312388.lua | Moved reveal+send from cost to operation (Edison ruling: "no cost"); cost is feasibility-check only                                                                               |
| 34471458         | Fortune Lady Light        | 34471458        | c34471458.lua | Removed `IsPreviousPosition(POS_FACEUP)` from trigger condition (triggers even if face-down)                                                                                      |
| 47297616         | Light and Darkness Dragon | 47297616        | c47297616.lua | (1) Removed `EFFECT_COUNT_CODE_CHAIN` from negate effect (negates every chain activation). (2) Removed `EFFECT_FLAG_CARD_TARGET` from destroy+SSummon; GY selection at resolution |
| 25132288         | Light End Dragon          | 25132288        | c25132288.lua | Removed `tc:IsFaceup()` from condition and operation (activates against face-down defenders too)                                                                                  |
| 69279219         | My Body as a Shield       | 69279219        | c69279219.lua | Removed `EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL` (cannot activate during Damage Step)                                                                                     |
| 20932152         | Quickdraw Synchron        | 20932152        | c20932152.lua | Replaced `EFFECT_SPSUMMON_PROC` with `EFFECT_TYPE_IGNITION`; send changed to `REASON_EFFECT` at resolution (not cost)                                                             |
| 68005187         | Soul Exchange             | 68005187        | c68005187.lua | Moved `EFFECT_CANNOT_BP` from cost to operation (BP skip only if effect resolves, not on activation)                                                                              |
| 41006930         | Strike Ninja              | 41006930        | c41006930.lua | (1) `SetCountLimit(1,id)` → `SetCountLimit(1)` (per-copy). (2) Cost location `LOCATION_MZONE\|LOCATION_GRAVE` → `LOCATION_GRAVE` only                                             |
| 9126351          | Swap Frog                 | 9126351         | c9126351.lua  | (1) `s.estg`: added exclusion of Frog the Jam (passcode 68999286). (2) `s.tgfilter`: `IsFaceup()` → `IsLocation(LOCATION_MZONE)`                                                  |
| 12538374         | Treeborn Frog             | 12538374        | c12538374.lua | Removed `SetCountLimit(1)` (re-activates after negation per Edison ruling)                                                                                                        |
