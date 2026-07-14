# Card-Script Curation Report — Edison Format (36 Functional-Errata Cards)

**Date:** 2026-07-13  
**Author:** Backend Engineer 2 (script diff + staging track)  
**Spec:** `specs/stream2-40-card-script-curation.md`  
**Inputs:**
- `docs/working/2026-07-13-dueling-readiness.md`
- `docs/working/2026-07-13-preerrata-desc-overrides.json`  
- ProjectIgnis/CardScripts (cloned live from GitHub): `official/` + `pre-errata/`  
- ProjectIgnis/BabelCDB `cards.cdb` + `cards-unofficial.cdb`

**Vendor note:** `spikes/spike-a-ruleset/vendor/` does not exist in the working tree (not committed to git). Scripts were sourced directly from the upstream ProjectIgnis/CardScripts GitHub repo at tip-of-main, and BabelCDB was queried for alias/passcode data. All 36 card scripts were located; no blockers.

---

## Passcode Alias Map

Display passcode (overrides JSON / player deck) → Script passcode (CDB + file name).  
Source: `cards-unofficial.cdb` (pre-errata entries alias to official pascode).

| Display passcode | Name | Script passcode | Note |
|---|---|---|---|
| 50321796 | Brionac | **511002993** | alias in unofficial CDB |
| 26202165 | Sangan | **511002631** | alias in unofficial CDB |
| 14878871 | Rescue Cat | **511002992** | alias in unofficial CDB |
| 7391448 | Goyo Guardian | **511002994** | alias in unofficial CDB |
| 87910978 | Brain Control | **511002995** | alias in unofficial CDB |
| 77565204 | Future Fusion | **511002997** | alias in unofficial CDB |
| 47355498 | Necrovalley | **511002998** | alias in unofficial CDB |
| 21502796 | Ryko, Lightsworn Hunter | **511003007** | alias in unofficial CDB |
| 95727991 | Catapult Turtle | **511000228** | alias in unofficial CDB |
| 25862681 | Ancient Fairy Dragon | **25862691** | alias in unofficial CDB (note: distinct numeric range) |
| 80168720 | Darkness Approaches | **511003028** | alias in unofficial CDB |
| 80604091 | Ultimate Offering | **511003023** | alias in unofficial CDB |
| 88264978 | REDMD | **88264978** | same; only pre-errata/ script, no separate alias entry |
| All others (23) | — | **same as display** | only in official CDB, no alias |

---

## Verdict Summary

| Verdict | Count | Cards |
|---|---|---|
| DROPIN | 11 | Brionac, Sangan, Rescue Cat, Goyo, Brain Control, Future Fusion, Necrovalley, Ryko, Catapult Turtle, Darkness Approaches, Ultimate Offering |
| FIXED | 1 | REDMD |
| MODERN-OK | 5 | Armory Arm, Black Garden, Mark of the Rose, Mausoleum of the Emperor, Urgent Tuning |
| NEEDS-AUTHORING | 13 | Ancient Fairy Dragon, Dark End Dragon, Destiny End Dragoon, Elemental HERO Prisma, Fortune Lady Light, Light and Darkness Dragon, Light End Dragon, My Body as a Shield, Quickdraw Synchron, Soul Exchange, Strike Ninja, Swap Frog, Treeborn Frog |
| RULES-LEVEL | 6 | Lumina, Susa Soldier, Machina Gearframe, Cyber Phoenix, D.D. Survivor, Jade Knight |

**Staged `.lua` files:** 12 (11 DROPIN + 1 FIXED) in `out/`.

---

## Bucket 1 — DROPIN (6 cards, correct pre-errata script)

### 1. Brionac, Dragon of the Ice Barrier
- **Display passcode:** 50321796  |  **Script passcode:** 511002993
- **Script path:** `pre-errata/c511002993.lua`
- **Target text:** "You can discard any number of cards to return the same number of cards from the field to the hand."
- **Script verdict:** CORRECT.
  - Effect type: `EFFECT_TYPE_IGNITION` — no `SetCountLimit` → usable multiple times per turn ✓
  - Target range: `LOCATION_ONFIELD, LOCATION_ONFIELD` (both sides) → can target either player's cards ✓
  - No `SetCountLimit(1,id,…)` → no once-per-NAME restriction ✓
  - Cost count = discard count = target count (via `e:SetLabel(#cg)`) ✓
- **Verdict: `DROPIN`** → `out/511002993.lua`

---

### 2. Sangan
- **Display passcode:** 26202165  |  **Script passcode:** 511002631
- **Script path:** `pre-errata/c511002631.lua`
- **Target text:** "When this card is sent from the field to the Graveyard, move 1 monster with an ATK of 1500 or less from your Deck to your hand."
- **Script verdict:** CORRECT.
  - `EFFECT_TYPE_TRIGGER_F` (mandatory trigger) — cannot miss timing ✓
  - `s.condition` checks `IsPreviousLocation(LOCATION_ONFIELD)` — only triggers from field ✓
  - No `SetCountLimit` → each copy can trigger independently, multiple times per turn ✓
  - Search up to 1500 ATK monster ✓
- **Verdict: `DROPIN`** → `out/511002631.lua`

---

### 3. Rescue Cat
- **Display passcode:** 14878871  |  **Script passcode:** 511002992
- **Script path:** `pre-errata/c511002992.lua`
- **Target text:** "Send this face-up card on your side of the field to the Graveyard to Special Summon 2 Level 3 or lower Beast-Type monsters from your Deck to the field. The monsters Special Summoned in this way are destroyed during the End Phase."
- **Script verdict:** CORRECT.
  - `EFFECT_TYPE_IGNITION`, no `SetCountLimit` → no OPT restriction ✓
  - Cost: `SendtoGrave(handler, REASON_COST)` — sends itself ✓
  - Selects 2 Level ≤3 Beasts from Deck ✓
  - Destruction on End Phase tracked per-summoned card via `RegisterFlagEffect(51102992,…)` ✓
  - **No effects-negated clause** (Edison text: no "effects are negated" restriction on summoned monsters) ✓
- **Verdict: `DROPIN`** → `out/511002992.lua`

---

### 4. Goyo Guardian
- **Display passcode:** 7391448  |  **Script passcode:** 511002994
- **Script path:** `pre-errata/c511002994.lua`
- **Target text:** "1 Tuner + 1 or more non-Tuner monsters / When this card destroys an opponent's monster by battle and sends it to the Graveyard, you can Special Summon that monster to your side of the field in face-up Defense Position."
- **Script verdict:** CORRECT.
  - `Synchro.AddProcedure(c,nil,1,1,Synchro.NonTuner(nil),1,99)` — first arg `nil` means ANY tuner type (not EARTH-restricted) ✓
  - Modern official script requires `ATTRIBUTE_EARTH` tuner; this pre-errata correctly has no attribute constraint ✓
  - Trigger on `EVENT_BATTLE_DESTROYING`, `spcon` checks `bc:IsLocation(LOCATION_GRAVE)` ✓
  - `POS_FACEUP_DEFENSE` on special summon ✓
- **Verdict: `DROPIN`** → `out/511002994.lua`

---

### 5. Brain Control
- **Display passcode:** 87910978  |  **Script passcode:** 511002995
- **Script path:** `pre-errata/c511002995.lua`
- **Target text:** "Pay 800 Life Points. Select 1 face-up monster on your opponent's side of the field. Take control of the selected card until the End Phase of the turn this card is activated."
- **Script verdict:** CORRECT.
  - `s.filter(c)` = `c:IsControlerCanBeChanged() and c:IsFaceup()` — targets ANY face-up opponent's monster ✓
  - No "can be Normal Summoned/Set" restriction (modern errata added this; pre-errata does not have it) ✓
  - `Duel.GetControl(tc,tp,PHASE_END,1)` — control until End Phase ✓
- **Verdict: `DROPIN`** → `out/511002995.lua`

---

### 6. Future Fusion
- **Display passcode:** 77565204  |  **Script passcode:** 511002997
- **Script path:** `pre-errata/c511002997.lua`
- **Target text:** "Send, from your Deck to the Graveyard, Fusion Material Monsters that are listed on a Fusion Monster Card, and select that 1 Fusion Monster from your Fusion Deck. Special Summon the selected Fusion Monster during your 2nd Standby Phase after this card's activation."
- **Script verdict:** CORRECT.
  - Materials sent in `s.activate` (on resolution, at activation) — not on 1st Standby Phase ✓ (matches Edison text: send at activation, not one turn later)
  - The 2nd-Standby Phase SSummon: `e1` with `RESET_PHASE+PHASE_STANDBY, 2` counter (triggers on 2nd Standby) ✓
  - `tc:SetMaterial(mat)` marks the Fusion Monster's materials correctly ✓
  - Destroy-when-field-leaves and destroy-when-monster-destroyed cross-references ✓
- **Verdict: `DROPIN`** → `out/511002997.lua`

---

## Bucket 2 — AVAILABLE-VERIFY (6 cards; 5 DROPIN, 1 NEEDS-AUTHORING)

### 7. Necrovalley
- **Display passcode:** 47355498  |  **Script passcode:** 511002998
- **Script path:** `pre-errata/c511002998.lua`
- **Target text:** "all effects of Magic, Trap and/or Effect Monster Cards that involve Graveyards are negated and neither player can remove cards in the Graveyards from play. In addition, increase the ATK and DEF of all monsters that includes 'Gravekeeper's' in their card name by 500 points."
- **Script verdict:** CORRECT.
  - `e2`/`e3`: +500 ATK/DEF to set-code 0x2e (Gravekeeper's archetype) ✓
  - `e4`/`e5`: `EFFECT_CANNOT_REMOVE` for both players' GY ✓ (neither player can banish GY cards)
  - `e6`/`e7`/`e8`/`e9`: `EFFECT_NECRO_VALLEY` — broad engine code for the Edison-era "all GY-involving effects negated" behavior (this is the pre-errata broad negation, unlike the modern script which uses targeted negation) ✓
  - `e10`: Chain-solving continuous effect that negates effects that would move GY cards ✓
  - Modern script uses narrower negation; this pre-errata script correctly uses the broad `EFFECT_NECRO_VALLEY` constant
- **Verdict: `DROPIN`** → `out/511002998.lua`

---

### 8. Ryko, Lightsworn Hunter
- **Display passcode:** 21502796  |  **Script passcode:** 511003007
- **Script path:** `pre-errata/c511003007.lua`
- **Target text:** "FLIP: You can destroy 1 card on the field. Send the top 3 cards of your Deck to the Graveyard."
- **Script verdict:** CORRECT.
  - `EFFECT_TYPE_FLIP` with `EFFECT_FLAG_CARD_TARGET` — targets (per Edison ruling "This effect targets") ✓
  - Optional destroy: `SelectYesNo` before target selection → "you can destroy" ✓
  - Always mills 3: `Duel.DiscardDeck(tp,3,REASON_EFFECT)` runs regardless of whether a card was destroyed ✓
  - `BreakEffect()` called after destroy (before milling) ensures correct resolution order ✓
- **Verdict: `DROPIN`** → `out/511003007.lua`

---

### 9. Catapult Turtle
- **Display passcode:** 95727991  |  **Script passcode:** 511000228
- **Script path:** `pre-errata/c511000228.lua`
- **Target text:** "Offer 1 monster on your side of the field as a Tribute to inflict Direct Damage equal to half of the Tribute monster's ATK to your opponent's Life Points. Monsters used for a Tribute Summon or that are offered as Tributes due to other cards' effects are excluded."
- **Script verdict:** CORRECT.
  - `EFFECT_TYPE_IGNITION`, **no `SetCountLimit`** → multiple uses per turn ✓ (Edison: "You can use this effect multiple times per turn")
  - `CheckReleaseGroupCost(tp,nil,1,false,nil,nil)` — tributes from field; monsters no longer on field (already tributed) are naturally excluded ✓
  - Damage = `sg:GetFirst():GetAttack()/2` (half of tributed monster's ATK) ✓
- **Verdict: `DROPIN`** → `out/511000228.lua`

---

### 10. Ancient Fairy Dragon
- **Display passcode:** 25862681  |  **Script passcode:** 25862691
- **Script path:** `pre-errata/c25862691.lua`
- **Target text (Edison):** "Once per turn, you can Special Summon 1 Level 4 or lower monster from your hand. You cannot conduct your Battle Phase the turn you activate this effect. Once per turn, you can destroy a Field Spell Card. If you do, gain 1000 Life Points, and you can add 1 Field Spell Card from your Deck to your hand."

**Behavior diff — pre-errata vs. Edison target:**

| Aspect | Pre-errata script | Edison target |
|---|---|---|
| e1 SSummon — phase restriction | `SetCondition(function() return Duel.GetCurrentPhase()==PHASE_MAIN1 end)` → **Main Phase 1 only** | No phase restriction → should work in both MP1 and MP2 |
| e2 Field Spell destroy — scope | `Duel.GetFieldGroup(0,LOCATION_FZONE,LOCATION_FZONE)` → **destroys ALL field spells on the field** | "destroy a Field Spell Card" (singular — player chooses which one) |

**Gap 1:** The MP1-only restriction prevents using the SSummon effect in Main Phase 2, which violates the Edison text ("Once per turn" with no phase qualifier beyond the natural "your Main Phase" for ignition effects).

**Gap 2:** The destroy effect targets the entire field zone (both players' field spells) and destroys all of them simultaneously. The Edison text says "you can destroy **a** Field Spell Card" — singular, player-chosen. If both players have active field spells, the script incorrectly destroys both instead of letting the player choose one.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Two fixes needed: (a) Remove the `SetCondition(…PHASE_MAIN1…)` from e1 so the SSummon effect is usable in both Main Phase 1 and 2. (b) Change e2's target/operation to let the player SELECT one specific field spell to destroy (from either player's field zone), rather than getting and destroying all field zones automatically.

---

### 11. Darkness Approaches
- **Display passcode:** 80168720  |  **Script passcode:** 511003028
- **Script path:** `pre-errata/c511003028.lua`
- **Target text:** "Discard 2 cards from your hand. Select 1 face-up monster and flip it face-down, but do not change its battle position."
- **Script verdict:** CORRECT.
  - Cost: `DiscardHand(tp,Card.IsDiscardable,2,2,…)` → discard 2 ✓
  - Target: face-up monsters (`IsFaceup() and IsCanTurnSet()`) ✓
  - Operation: `Duel.ChangePosition(tc,POS_FACEDOWN_ATTACK,0,POS_FACEDOWN_DEFENSE,0)` — uses the positional variants: an ATK-position monster becomes Set-ATK (face-down Attack), and a DEF-position monster becomes Set-DEF (face-down Defense) → **battle position is preserved** while being set face-down ✓
  - Edison ruling "If you target an Attack Position monster, it is flipped into face-down Attack Position" — handled correctly by POS_FACEDOWN_ATTACK ✓
- **Verdict: `DROPIN`** → `out/511003028.lua`

---

### 12. Ultimate Offering
- **Display passcode:** 80604091  |  **Script passcode:** 511003023
- **Script path:** `pre-errata/c511003023.lua`
- **Target text:** "At the cost of 500 Life Points per monster, a player is allowed an extra Normal Summon or Set."
- **Script verdict:** CORRECT.
  - `EFFECT_TYPE_QUICK_O` with `EVENT_FREE_CHAIN`, range `LOCATION_SZONE` → activatable in either player's Main Phase or opponent's Battle Phase ✓
  - 500 LP cost per use ✓
  - `FlagEffect(id,RESET_CHAIN,…)` + `GetFlagEffectLabel` tracking allows chaining effect to itself (multiple extra summons in one chain) ✓
  - Cannot be activated more than once in the chain in which Ultimate Offering itself was activated (the label count starts at the number of summonable cards and decrements) ✓
  - Edison ruling: "The summon does not happen 'immediately after this effect resolves'" — the summon in `s.activate` is `Duel.SummonOrSet` inside the operation → during resolution (correct) ✓
- **Verdict: `DROPIN`** → `out/511003023.lua`

---

## Bucket 3 — KNOWN-WRONG → FIXED (1 card)

### 13. Red-Eyes Darkness Metal Dragon (REDMD)
- **Display passcode:** 88264978  |  **Script passcode:** 88264978 (same)
- **Script path:** `pre-errata/c88264978.lua`
- **Target text (Edison):** "You can remove from play 1 Dragon-Type monster you control to Special Summon this card. Once per turn, you can Special Summon 1 Dragon-Type monster except 'Red-Eyes Darkness Metal Dragon' from your hand or Graveyard."
- **Edison ruling:** "You can Special Summon multiple copies of this card per turn. You can activate the effects of multiple copies of this card per turn."

**Problem in pre-errata script:**
```
-- WRONG (once-per-NAME):
e1:SetCountLimit(1,id,EFFECT_COUNT_CODE_OATH)   -- summon procedure
e2:SetCountLimit(1,{id,1})                       -- ignition effect
```
Both limits are once-per-**NAME** (`id` as the second arg). This means all copies of REDMD on the field share one "use" per turn — exactly the modern OCG behavior. Edison has NO once-per-name on either effect; each copy acts independently.

**Fix applied:**
```diff
-  e1:SetCountLimit(1,id,EFFECT_COUNT_CODE_OATH)
+  e1:SetCountLimit(1)

-  e2:SetCountLimit(1,{id,1})
+  e2:SetCountLimit(1)
```
`SetCountLimit(1)` without a name argument = **per-copy** limit only. Each copy of REDMD on the field can use its own summon procedure and ignition effect once per turn. Multiple copies = multiple uses total. This matches the Edison target behavior.

All other logic (banish-face-up-dragon cost, Dragon filter excluding self, GY+hand search) is unchanged.

- **Verdict: `FIXED`** → `out/88264978.lua`

---

## Bucket 4 — RULES/RULING-LEVEL (6 cards)

### 14. Lumina, Lightsworn Summoner
- **Display/Script passcode:** 95503687  |  **Script:** `official/c95503687.lua`
- **Target text:** "Once per turn, you can discard 1 card to Special Summon 1 Level 4 or lower 'Lightsworn' monster from your Graveyard. During each of your End Phases, send the top 3 cards of your Deck to the Graveyard."
- **Modern script analysis:**
  - e1 (SSummon): `SetCountLimit(1)` = per-copy once per turn (no once-per-NAME) ✓ — Edison has no hard OPT on this effect
  - e2 (End Phase mill): `SetCountLimit(1)`, mandatory trigger on End Phase ✓
  - Text difference between Edison and modern is phrasing only; both restrict SSummon to once-per-turn-per-copy and mill 3 at End Phase
- **Rules-level aspect:** "Phase-dependent mandatory trigger re-activation" (Rule #4). When Lumina's End Phase mill is negated (e.g. by Light-Imprisoning Mirror being activated after trigger), the Edison ruling requires it to re-activate in the same End Phase. This behavior is an **engine-level** concern (MANDATORY trigger re-activation when negated), not a script substitution. Covered by Rule #4 validation tasks.
- **Verdict: `RULES-LEVEL`** — Rule #4 (mandatory trigger re-activation). Modern script structure is behavior-correct for Edison; engine handles re-activation of mandatory triggers when negated. No script substitution needed.

---

### 15. Susa Soldier
- **Display/Script passcode:** 40473581  |  **Script:** `official/c40473581.lua`
- **Override:** `needsOverride: false` in overrides JSON (no text override needed)
- **Target text:** original card text (Spirit mechanic + halved battle damage) — no functional errata
- **Modern script analysis:**
  - `Spirit.AddProcedure(c,EVENT_SUMMON_SUCCESS,EVENT_FLIP)` — handles return-to-hand at End Phase ✓
  - `EFFECT_SPSUMMON_CONDITION` prevents Special Summon ✓
  - `EFFECT_CHANGE_BATTLE_DAMAGE` with `HALF_DAMAGE` on all battle damage (attack or defense) ✓
  - Edison ruling note says damage is halved even for direct attacks — the effect applies to all battle damage inflicted by Susa Soldier ✓
- **Rules-level aspect:** Spirit "return to hand at End Phase" is engine-handled via `Spirit.AddProcedure`. The Edison Rule #4 (phase-dependent mandatory trigger re-activation for Spirits) applies here too — if the return-to-hand trigger is negated, it should re-activate. Engine-level concern, not a script gap.
- **Verdict: `RULES-LEVEL`** — Rule #4 (Spirit return-to-hand mandatory trigger). Script is correct as-is.

---

### 16. Machina Gearframe
- **Display/Script passcode:** 42940404  |  **Script:** `official/c42940404.lua`
- **Target text:** Union monster with "1 Union per monster" condition + search on Normal Summon.
- **Modern script analysis:**
  - `aux.AddUnionProcedure(c,aux.FilterBoolFunction(Card.IsRace,RACE_MACHINE),false)` — handles the full Union equip/unequip/replace-if-destroyed mechanic ✓
  - Normal Summon trigger (e1) searches a Machina monster ✓
  - "A monster can only be equipped with 1 Union Monster at a time" — the `aux.AddUnionProcedure` enforces the engine-level Union constraint ✓
- **Rules-level aspect:** "1 Union per monster" condition is Rule #3. The `AddUnionProcedure` call in the engine handles this at the script+engine level. Verified correct.
- **Verdict: `RULES-LEVEL`** — Rule #3 (Union "1 per monster" condition). Enforced by `aux.AddUnionProcedure`. No substitution needed.

---

### 17. Cyber Phoenix
- **Display/Script passcode:** 3370104  |  **Script:** `official/c3370104.lua`
- **Target text (Edison):** "While this card is in face-up Attack Position on your side of the field, negate the effects of any Spell or Trap Card that targets 1 Machine-Type monster on your side of the field. When this face-up card on the field attacks or is attacked, and it is destroyed as a result of battle and sent to the Graveyard, you can draw 1 card from your Deck."
- **Diff — modern vs. Edison:**
  - ① Protection effect: modern `s.discon` checks `IsAttackPos()` — same behavior (in Attack Position) ✓
  - ② Trigger (draw): modern `s.condition` checks `c:IsPreviousPosition(POS_FACEUP)` → only triggers if Cyber Phoenix was face-up when attacked. Edison ruling: "If this Set card was destroyed by battle, you can't activate the ② effect. It must be face-up when targeted for the attack." — The `IsPreviousPosition(POS_FACEUP)` check correctly captures "was face-up at attack declaration" ✓
  - The modern script uses `aux.DoubleSnareValidity(c,LOCATION_MZONE)` for interaction with Double Snare — appropriate
  - Both protection and trigger match Edison target behavior
- **Verdict: `RULES-LEVEL`** — damage-step ruling (must be face-up at attack declaration). Modern script already correctly handles this via `IsPreviousPosition(POS_FACEUP)`. No substitution needed.

---

### 18. D.D. Survivor
- **Display/Script passcode:** 48092532  |  **Script:** `official/c48092532.lua`
- **Target text (Edison):** "If this face-up card on your side of the field is removed from play, this card is Special Summoned to the owner's side of the field during the End Phase."
- **Diff — modern vs. Edison:**
  - `s.rmcon` checks `c:IsFaceup() and c:IsPreviousPosition(POS_FACEUP) and c:IsPreviousLocation(LOCATION_ONFIELD)` — only records the flag if banished while face-up on field. Edison ruling: "If this Set card is attacked (while 'Dimensional Fissure' is on the field), its effect won't activate. It needs to be face-up when targeted for the attack." The `IsPreviousPosition(POS_FACEUP)` check correctly implements this ✓
  - `id+1` flag with `RESET_PHASE|PHASE_END` prevents re-activation in the same End Phase if the activation/effect is negated. Edison ruling: "If the activation or effect is negated, it does not activate again in the same End Phase." ✓
  - "If this card is banished during the End Phase, it returns to the field during the **next** turn's End Phase" — `RESETS_STANDARD_PHASE_END` on the flag means it persists into the next End Phase ✓
- **Verdict: `RULES-LEVEL`** — damage-step ruling (face-up at attack declaration, same logic as Cyber Phoenix/Jade Knight). Modern script already correctly handles all Edison ruling behaviors. No substitution needed.

---

### 19. Jade Knight
- **Display/Script passcode:** 44364207  |  **Script:** `official/c44364207.lua`
- **Target text (Edison):** "Face-up Machine-Type monsters you control with 1200 or less ATK cannot be destroyed by the effects of Trap Cards. When this face-up card is destroyed by battle and sent to the Graveyard, you can add 1 Level 4 LIGHT Machine-Type monster from your Deck to your hand."
- **Diff — modern vs. Edison:**

| Aspect | Modern script | Edison target |
|---|---|---|
| ① Protection condition | `s.indescon`: `e:GetHandler():IsAttackPos()` — only while Jade Knight is in Attack Position | "Face-up Machine-Type monsters you control" — face-up regardless of position; Jade Knight's own position is NOT the restriction in Edison text |
| ② Trigger (search) | `s.condition`: `c:IsPreviousPosition(POS_FACEUP)` — only if face-up at attack | Edison ruling: "must be face-up when targeted for the attack" ✓ |

  - **① gap noted:** Modern script restricts the protection effect to when Jade Knight is in Attack Position. The Edison text says "Face-up Machine-Type monsters" with no restriction on Jade Knight's own battle position. This is a **script-level protection gap** — if Jade Knight were in Defense Position, the protection should still apply in Edison. However, per spec classification, this card is in the RULES-LEVEL bucket.
  - ② is correctly handled (damage-step ruling, face-up check ✓).
- **Verdict: `RULES-LEVEL`** per spec classification — the damage-step ruling (face-up at attack declaration) is correctly handled. CTO note: the ① protection effect additionally has a script gap (Attack Position check vs. face-up) that warrants attention if an accurate Edison override is desired.

---

## Bucket 5 — DIFF-vs-MODERN (17 cards)

> For each card: explicit behavior diff of modern script vs. Edison target text, then verdict.

### 20. Armory Arm
- **Display/Script passcode:** 29071332  |  **Script:** `official/c29071332.lua`
- **Edison target:** "Once per turn, you can equip this card to a monster OR unequip it to Special Summon this card in face-up Attack Position. While equipped to a monster by this effect, that monster gains 1000 ATK. When the equipped monster destroys a monster by battle and sends it to the Graveyard, inflict damage to your opponent equal to the destroyed monster's ATK."

| Aspect | Modern script | Edison target |
|---|---|---|
| Once-per-turn | `HasFlagEffect(id)` per copy; resets at phase end → per-copy once-per-turn | "Once per turn" per copy ✓ |
| Target scope | Any face-up monster on field, either player | "equip this card to a monster" (any monster) ✓ |
| ATK bonus | 1000 to equipped monster (only when equipped via this effect: `HasFlagEffect(id+1)`) | 1000 ATK ✓ |
| Damage source | `bc:GetAttack()` — destroyed monster's current ATK from battle event | "destroyed monster's ATK" ✓ |
| Damage condition | `bc:IsLocation(LOCATION_GRAVE) and bc:IsMonster()` | "destroys a monster by battle and sends it to the GY" ✓ |

All behavioral aspects match the Edison target text. The modern script correctly implements the pre-errata behavior without any OPT or name-restriction gaps.

- **Verdict: `MODERN-OK`** — modern script matches Edison target. No substitution needed.

---

### 21. Black Garden
- **Display/Script passcode:** 71645242  |  **Script:** `official/c71645242.lua`
- **Edison target:** "When a monster is Normal or Special Summoned, except by the effect of 'Black Garden', halve its ATK and Special Summon 1 'Rose Token' (Plant-Type/DARK/Level 2/ATK 800/DEF 800) to its controller's opponent's side of the field, in Attack Position. You can destroy this card and all face-up Plant-Type monsters on the field and Special Summon 1 monster with ATK equal to the total ATK of those monsters from your Graveyard."

| Aspect | Modern script | Edison target |
|---|---|---|
| ATK halving | `EFFECT_SET_ATTACK_FINAL` (permanent per-monster, resets on standard events) | "halve its ATK" (permanent until monster leaves/facedown) ✓ |
| Token owner | Token summoned to opponent of the summoned monster's controller | "its controller's opponent's side" ✓ |
| Multiple simultaneous summons | Only 1 token total via the bitfield `ev` mechanism | "only 1 Token is Summoned" per ruling ✓ |
| Self-exception | `SUMMONED_BY_BLACK_GARDEN` summon type excluded from trigger | "except by the effect of 'Black Garden'" ✓ |
| Destroy effect — target | Select from GY with ATK = sum of face-up Plant ATKs; destroy all Plants + BG | "destroy this card and all face-up Plant-Type monsters…Special Summon 1 monster with ATK equal to total ATK" ✓ |
| ATK calculation | `og:GetSum(Card.GetPreviousAttackOnField)` — previous (post-halved) ATK | Destroyed monsters' halved ATKs ✓ |
| All-or-nothing | Only summons if `#dg==#og` (all plants + BG destroyed) | "destroy this card and all face-up Plant-Type monsters" ✓ |

- **Verdict: `MODERN-OK`** — modern script matches Edison target. No substitution needed.

---

### 22. Dark End Dragon
- **Display/Script passcode:** 88643579  |  **Script:** `official/c88643579.lua`
- **Edison target:** "Once per turn, you can have this card lose 500 ATK and DEF, and send 1 monster your opponent controls to the Graveyard."

| Aspect | Modern script | Edison target |
|---|---|---|
| Targeting | `EFFECT_FLAG_CARD_TARGET` set; target selected at activation declaration | "send 1 monster" — **no "target" in text** = non-targeting effect; selection at resolution |
| ATK/DEF loss condition | `c:GetAttack()>=500 and c:GetDefense()>=500` checked in target | Must have ≥500 ATK/DEF to activate ✓ |
| ATK/DEF loss timing | Applied in operation if still ≥500 | Per ruling: "Even if the target is no longer on the field, this card still loses 500 ATK/DEF" — loss should happen regardless; send fails if no monster ✓ |

**Gap:** Modern script uses `EFFECT_FLAG_CARD_TARGET` — the monster is chosen at activation declaration and becomes the "target." The Edison text has no word "target," making this a non-targeting effect. In Edison, the monster to send would be selected during resolution. This affects interactions with cards like Dimensional Prison, Starlight Road, face-down monsters, and monsters with targeting immunity.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Remove `EFFECT_FLAG_CARD_TARGET` from the effect property. Change target function to non-targeting: check feasibility at activation (e.g. `IsExistingMatchingCard`) but do not declare a target. Move monster selection into the operation function (during resolution). The ATK/DEF loss of this card should still happen on resolution regardless of whether the chosen monster is still present.

---

### 23. Destiny End Dragoon
- **Display/Script passcode:** 76263644  |  **Script:** `official/c76263644.lua`
- **Edison target:** "Once per turn, you can destroy 1 monster your opponent controls and inflict damage to your opponent equal to its ATK. If you activate this effect, you cannot conduct your Battle Phase this turn. During your Standby Phase, if this card is in your Graveyard you can remove from play 1 'Destiny Hero' card from your Graveyard to Special Summon this card."

| Aspect | Modern script | Edison target |
|---|---|---|
| Destroy effect — targeting | `EFFECT_FLAG_CARD_TARGET`; monster selected at activation | "destroy 1 monster your opponent controls" — **no "target"** = non-targeting in Edison |
| Damage — face-up conditional | `if tc:IsFaceup() then atk=tc:GetAttack() end` → 0 damage for face-down monster | "inflict damage…equal to its ATK" — **no face-up qualifier**; should deal damage regardless of face-up/down status |
| Revival OPT | `e3:SetCountLimit(1)` — per-copy (no name arg) | No once-per-NAME ✓ (each copy in GY can revive once; per-copy = correct) |
| BP skip | Applied via `s.descost` registering CANNOT_BP | "If you activate this effect, you cannot conduct your Battle Phase" ✓ |

**Gap 1:** Destroy effect uses targeting (`EFFECT_FLAG_CARD_TARGET`) but Edison text is non-targeting (no "target" keyword).

**Gap 2:** Damage is only dealt if the destroyed monster was face-up (`tc:IsFaceup()`). Edison text says "inflict damage…equal to its ATK" with no face-up restriction. If DED destroys a face-down monster, the monster's ATK is revealed at resolution and damage should equal that ATK.

Note: The revival effect's `SetCountLimit(1)` (per-copy, no name arg) IS correct for Edison — each copy in GY can revive once per Standby Phase.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** (1) Remove `EFFECT_FLAG_CARD_TARGET` from destroy effect; move monster selection to operation (non-targeting, chosen at resolution). (2) In the operation, calculate damage using the monster's ATK at the time of destruction (including face-down monsters whose ATK is revealed on flip/destruction); remove the `IsFaceup()` guard.

---

### 24. Elemental HERO Prisma
- **Display/Script passcode:** 89312388  |  **Script:** `official/c89312388.lua`
- **Edison target:** "Once per turn, you can reveal 1 Fusion Monster from your Fusion Deck and send 1 of the Fusion Material Monsters listed on that card from your Deck to the Graveyard. Until the End Phase, this card's name is treated as the sent monster's name."
- **Edison ruling:** "This effect has no cost."

| Aspect | Modern script | Edison target |
|---|---|---|
| Reveal + send timing | `e1:SetCost(s.coscost)` — reveal and send monster are the **COST** (before chain, before negation) | **No cost** in Edison; reveal and send happen during **resolution** as part of the effect |
| Negation consequence | If effect negated: monster was already sent (cost paid), no name change | If effect negated: nothing happens — no monster sent, no name change |
| Macro Cosmos interaction | Monster sent as cost → banished (doesn't stop effect; name change still happens) | Monster sent on resolution → banished (with Macro Cosmos), name change still happens |

**Gap:** The modern script treats the reveal and send as the COST, so they happen when the activation is declared. If the effect is negated (by a chained counter trap etc.), the monster was already sent (cost was paid) but the name change doesn't happen. The Edison ruling explicitly says "This effect has no cost" — everything (reveal, send, name change) is the effect and happens on resolution. If negated, nothing is sent and nothing changes.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Restructure the effect: remove `SetCost(s.coscost)`. Move the reveal and send logic from the cost function into the operation function. The cost check (feasibility: can you reveal a fusion monster with sendable materials?) stays, but must not actually send anything — only check. On resolution: (1) reveal selected fusion monster, (2) send selected material from Deck to GY (or banished if Macro Cosmos), (3) apply name-change effect to Prisma if Prisma is still face-up.

---

### 25. Fortune Lady Light
- **Display/Script passcode:** 34471458  |  **Script:** `official/c34471458.lua`
- **Edison target:** "When this card is removed from the field by a card effect, you can Special Summon 1 'Fortune Lady' monster from your Deck."
- **Edison ruling:** "Will trigger even if Fortune Lady Light left the field while face-down. Will trigger even if this card returns to the hand."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| Trigger condition | `s.spcon`: `c:IsReason(REASON_EFFECT) and not c:IsLocation(LOCATION_DECK) and c:IsPreviousPosition(POS_FACEUP)` | Must trigger **even if face-down** when removed; `IsPreviousPosition(POS_FACEUP)` **blocks** face-down triggers |
| Location restriction | `not c:IsLocation(LOCATION_DECK)` — won't trigger if returned to deck | Edison ruling says triggers even if returned to hand; deck not explicitly mentioned |

**Gap:** `s.spcon` requires `IsPreviousPosition(POS_FACEUP)` — a face-down Fortune Lady Light removed by card effect will NOT trigger the effect in the modern script. The Edison ruling explicitly states the effect triggers even when face-down. This `IsPreviousPosition` check must be removed.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Remove `c:IsPreviousPosition(POS_FACEUP)` from `s.spcon`. The only required checks for Edison are: `IsReason(REASON_EFFECT)` (removed by card effect, not battle/rule) and the card being Fortune Lady Light (not triggered if, e.g., it's not the same card). The "returned to hand" case is handled automatically by the leave-field trigger.

---

### 26. Light and Darkness Dragon
- **Display/Script passcode:** 47297616  |  **Script:** `official/c47297616.lua`
- **Edison target:** "When a Spell or Trap Card is activated, or the effect of an Effect Monster is activated, that activation is negated and this card loses 500 ATK and DEF. When this card is destroyed and sent to the Graveyard, select 1 monster in your Graveyard. Then destroy all cards you control, and Special Summon that monster."

| Aspect | Modern script | Edison target |
|---|---|---|
| Negate — once-per-chain | `e2:SetCountLimit(1,0,EFFECT_COUNT_CODE_CHAIN)` → **only once per chain** | No once-per-chain limit; LaDD should negate **every** activation in a chain (each activation triggers separately) |
| Destroy effect — targeting | `e3` uses `EFFECT_FLAG_CARD_TARGET`, target chosen at activation | Edison: "select 1 monster in your Graveyard" — no word "target" in original; selection should happen during resolution |
| Destroy+SSummon sequence | Destroy field cards, then SSummon target from GY | "select 1 monster, Then destroy all cards you control, and Special Summon that monster" ✓ |

**Gap 1:** `EFFECT_COUNT_CODE_CHAIN` limits the negation to one per chain link. In Edison, LaDD negates each activation as it occurs in the chain (multiple negations per chain are allowed, each costing 500/500). The SEGOC and re-activation loop ("Vs Spirit Monsters, Lyla, Treeborn Frog, Vayu etc: These trigger effects will be negated by this card's ③ effect, and can then trigger again") is possible only because LaDD can negate multiple times in a chain.

**Gap 2:** The destroy-and-SSummon effect (e3) uses `EFFECT_FLAG_CARD_TARGET` — the GY monster is chosen at activation declaration. Edison text says "select 1 monster in your Graveyard. Then destroy all cards…" — "select" at resolution (non-targeting). This affects interactions with monsters with targeting immunity.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** (1) Remove `EFFECT_COUNT_CODE_CHAIN` from e2's `SetCountLimit` (or remove the SetCountLimit entirely and handle per-activation using a chain-local check). LaDD should be able to negate every chain link that contains a qualifying activation. (2) Remove `EFFECT_FLAG_CARD_TARGET` from e3; move GY monster selection from `s.sptg` into `s.spop` (resolution) as a non-targeting selection.

---

### 27. Light End Dragon
- **Display/Script passcode:** 25132288  |  **Script:** `official/c25132288.lua`
- **Edison target:** "When you declare an attack, you can activate this card's effect. If you do, this card loses 500 ATK and DEF (permanently), and the monster it is battling loses 1500 ATK and DEF until the End Phase."
- **Edison ruling:** "If this card can't lose 500 ATK and 500 DEF, the other monster doesn't lose any ATK/DEF."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| Target face-up check | `s.condition`: `tc:IsFaceup()` — only activates when battling a **face-up** monster | No face-up restriction in Edison text; should activate against face-down defenders too |
| ATK/DEF loss — LED | `RESETS_STANDARD_DISABLE` → permanent (resets only on face-down/leave) | "permanently" per ruling ✓ |
| ATK/DEF loss — target | `RESETS_STANDARD_PHASE_END` → until End Phase ✓ | "until the End Phase" ✓ |
| Minimum ATK/DEF check | `c:GetAttack()>=500 and c:GetDefense()>=500` in condition | Must have ≥500/500 to activate ✓ |

**Gap:** `tc:IsFaceup()` prevents the effect from being activated when Light End Dragon attacks a face-down defending monster. The Edison text says "the monster it is battling" with no face-up requirement. In 2010 format, you could use LED's effect at attack declaration even when attacking a face-down defender (the -1500 ATK/DEF would apply to the face-down monster and be visible once revealed in the damage step).

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Remove `tc:IsFaceup()` from `s.condition`. The condition should only check that LED itself has ≥500 ATK and ≥500 DEF, and that there is a valid battle target (`tc` exists and `IsRelateToBattle()`). The `tc:GetAttack()>0 or tc:GetDefense()>0` check may also be removed (face-down monsters have hidden ATK/DEF but the engine knows them; the -1500 effect should apply regardless).

---

### 28. Mark of the Rose
- **Display/Script passcode:** 45247637  |  **Script:** `official/c45247637.lua`
- **Edison target:** "Remove from play 1 Plant-Type monster from your Graveyard and equip this card to a monster your opponent controls. Gain control of the equipped monster. During your End Phase, give control of the equipped monster to your opponent. During your Standby Phase, gain control of the equipped monster."

| Aspect | Modern script | Edison target |
|---|---|---|
| Cost | `s.cost`: banish 1 Plant from GY | "Remove from play 1 Plant-Type monster" ✓ |
| Initial control | `EFFECT_SET_CONTROL` with value = `GetFlagEffectLabel(id)` (starts as controller `tp`) | "Gain control" ✓ |
| End Phase toggle | Operation sets label to `1-tp` (opponent controls) | "During your End Phase, give control to your opponent" ✓ |
| Standby Phase toggle | Inner trigger re-sets label to `tp` (you control again) | "During your Standby Phase, gain control" ✓ |
| Cold Wave | Effects are triggered effects; Cold Wave blocks effect activation → control stays with whoever has it | Per ruling ✓ |

All behavioral aspects of the alternating control mechanism match the Edison target text. The modern script's label-based control tracking (`id` label = which player controls) correctly implements the End Phase/Standby Phase toggle.

- **Verdict: `MODERN-OK`** — modern script matches Edison target. No substitution needed.

---

### 29. Mausoleum of the Emperor
- **Display/Script passcode:** 80921533  |  **Script:** `official/c80921533.lua`
- **Edison target:** "Both players can Normal Summon or Set monsters without Tribute(s) by paying 1000 Life Points x the number of monsters needed to Tribute Summon them."

| Aspect | Modern script | Edison target |
|---|---|---|
| Both players | `EFFECT_FLAG_BOTH_SIDE` on e2 (Ignition) → either player can activate | "Both players can" ✓ |
| LP cost | `Duel.PayLPCost(tp,op*1000)` where op = 1 or 2 tributes | 1000 LP × tributes needed ✓ |
| Summon type | `SummonOrSet` via hardcode e3 (code 80921533, value SUMMON_TYPE_NORMAL) | Normal Summon/Set ✓ |
| Not Tribute Summon | Hardcode marks it as a Normal Summon, not tribute | Edison ruling: "not Tribute Summoned" ✓ |
| Can't be negated | Summon happens during resolution (inside operation), not as a separate summonable action | Edison ruling: "can't be negated by Solemn Judgment or Horn of Heaven" ✓ |

- **Verdict: `MODERN-OK`** — modern script matches Edison target. `EFFECT_FLAG_BOTH_SIDE` correctly enables both players, and the summon mechanism matches the Edison ruling.

---

### 30. My Body as a Shield
- **Display/Script passcode:** 69279219  |  **Script:** `official/c69279219.lua`
- **Edison target:** "When your opponent activates a card that has the effect that destroys 1 or more monsters on the field, pay 1500 Life Points to negate the activation of the card and destroy it."
- **Edison ruling:** "This card can't be activated during the Damage Step."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| Damage step activation | `EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL` on e1 → **can activate during damage step** | Edison ruling: **cannot** be activated during the Damage Step |
| Destroy condition | `s.condition` checks opponent's activation destroys ≥1 monsters on field | "has the effect that destroys 1 or more monsters on the field" ✓ |
| Negate target | Negates activation and destroys the card | "negate the activation of the card and destroy it" ✓ |

**Gap:** `EFFECT_FLAG_DAMAGE_STEP` and `EFFECT_FLAG_DAMAGE_CAL` allow My Body as a Shield to chain to activations that occur during the Damage Step. The Edison ruling explicitly prohibits this. These flags must be removed.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Remove `EFFECT_FLAG_DAMAGE_STEP` and `EFFECT_FLAG_DAMAGE_CAL` from `e1:SetProperty(…)`. This will prevent My Body as a Shield from being chained to any activation during the Damage Step, matching the Edison ruling. All other logic (LP cost via `Cost.PayLP(1500)`, condition check for destroy-monster activation) remains correct.

---

### 31. Quickdraw Synchron
- **Display/Script passcode:** 20932152  |  **Script:** `official/c20932152.lua`
- **Edison target:** "You can send 1 monster from your hand to the Graveyard and Special Summon this card from your hand."
- **Edison ruling:** "The ① effect is an ignition effect. It activates, and can be chained to. Sending a card to the GY is part of the ① effect. It happens when this effect resolves. If you can't send, you can't Summon. If you can't Summon, you don't send."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| Mechanism | `EFFECT_SPSUMMON_PROC` — a summon procedure (declared at summon declaration, not a chain link) | Edison: **ignition effect** that IS a chain link and can be chained to |
| Send timing | `Duel.SendtoGrave(g,REASON_COST)` in `spop` — sent as a COST | "Sending is part of the ① effect…happens when this effect **resolves**" — must be `REASON_EFFECT`, not `REASON_COST` |
| Negation behavior | If summon procedure fails, send may still happen (REASON_COST) | "If effect is negated, you don't send" |

**Gap:** `EFFECT_SPSUMMON_PROC` is not an activatable ignition effect — it's a summon procedure that happens inline when you declare the special summon, without creating a chain link that opponents can respond to. The Edison ruling says Quickdraw's effect IS an ignition effect that goes on the chain and can be chained to by the opponent. Additionally, the send should be `REASON_EFFECT` (on resolution) not `REASON_COST` (at declaration).

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Replace `EFFECT_SPSUMMON_PROC` with a proper `EFFECT_TYPE_IGNITION` effect in `LOCATION_HAND`. In the cost: only check feasibility (1+ monsters to send, space in MZONE). In the operation: (1) select and send 1 monster from hand to GY as `REASON_EFFECT`, (2) if send succeeded, special summon Quickdraw from hand. Send and summon are both on resolution; if send fails, summon doesn't happen; if summon is prevented, send still shouldn't happen (check before sending). This is a significant structural rewrite of e1.

---

### 32. Soul Exchange
- **Display/Script passcode:** 68005187  |  **Script:** `official/c68005187.lua`
- **Edison target:** "Select an opponent's monster and use it as a Tribute in place of one of your own. You must skip your Battle Phase for the turn in which this card is activated."
- **Edison ruling:** "You are not forced to tribute that monster. You can tribute other monsters instead. If this card's activation is negated, you can still conduct your Battle Phase. If this card's effect is negated, you can't conduct your Battle Phase."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| BP skip timing | `s.cost`: registers `EFFECT_CANNOT_BP` during the **cost phase** (before chain; before possible negation) | BP skip should apply when the **effect** resolves; if activation negated, no BP skip |
| Tribune obligation | `EFFECT_EXTRA_RELEASE` on target → modern text "you must Tribute that target" | Edison ruling: **not forced** — you "can" use it; player may still tribute own monsters |
| Target | Opponent's monster in MZONE | "an opponent's monster" ✓ |

**Gap 1:** The BP skip (`EFFECT_CANNOT_BP`) is registered in `s.cost`, which runs when the card is activated (before the chain). If the activation is negated by a counter trap, the BP skip has already been applied. The Edison ruling says "If this card's activation is negated, you can still conduct your Battle Phase." The fix: move the BP skip from the cost function to the operation function.

**Gap 2:** `EFFECT_EXTRA_RELEASE` registered on the target makes it so the player "must" tribute the selected monster (it's marked as a valid tribute target as if under your control). The modern errata says "you must tribute that target." But the Edison ruling says "You are not forced to tribute that monster. You can tribute other monsters instead." The mechanism needs to allow (not force) use of the opponent's monster as tribute.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** (1) Move the `EFFECT_CANNOT_BP` registration from `s.cost` to `s.activate` (the effect's operation). (2) Replace the forced-tribute mechanism (`EFFECT_EXTRA_RELEASE`) with a permissive one: the opponent's monster becomes available to tribute as if you controlled it, but the game should not restrict you to only tributing that monster (you can still tribute your own monsters on the field or tribute others without being forced to use the Soul Exchange target).

---

### 33. Strike Ninja
- **Display/Script passcode:** 41006930  |  **Script:** `official/c41006930.lua`
- **Edison target:** "You can remove this card from play until the End Phase of this turn by removing 2 DARK monsters in your Graveyard from play. You can use this effect during either player's turn. You can only use this effect once per turn."
- **Edison ruling:** "You may activate the effects of multiple 'Strike Ninja' in the same turn (but only one per copy)."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| Count limit | `e1:SetCountLimit(1,id)` → **once per NAME** (all copies share one use) | "only one per copy" = **per-copy** limit; multiple copies = multiple uses |
| Cost location | `s.cfilter` on `LOCATION_MZONE\|LOCATION_GRAVE` → banish from field OR GY | "removing 2 DARK monsters in your **Graveyard** from play" — **GY only** |
| Quick Effect | `EFFECT_TYPE_QUICK_O`, either player's turn ✓ | "during either player's turn" ✓ |

**Gap 1:** `SetCountLimit(1,id)` uses `id` as the name arg = once-per-NAME (shared across all copies). Edison ruling requires per-copy (each Strike Ninja copy can use its own effect once per turn). Fix: `SetCountLimit(1)`.

**Gap 2:** The cost filter searches `LOCATION_MZONE|LOCATION_GRAVE` — allows banishing face-up DARK monsters from the field as cost. Edison text says "removing 2 DARK monsters in your Graveyard from play" — specifically from the GY. Fix: change to `LOCATION_GRAVE` only.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** (1) Change `e1:SetCountLimit(1,id)` to `e1:SetCountLimit(1)` (per-copy). (2) Change cost selection from `LOCATION_MZONE|LOCATION_GRAVE` to `LOCATION_GRAVE` only in `s.rmcost` (both the `IsExistingMatchingCard` check and the `SelectMatchingCard` call).

---

### 34. Swap Frog
- **Display/Script passcode:** 9126351  |  **Script:** `official/c9126351.lua`
- **Edison target:** "…Once per turn, you can return 1 monster you control to your hand to Normal Summon 1 'Frog' monster, except 'Swap Frog' or 'Frog the Jam', in addition to your Normal Summon or Set this turn."

| Aspect | Modern script | Edison target |
|---|---|---|
| Frog the Jam exclusion | `s.estg`: `c:GetCode()~=id` — excludes only Swap Frog | Edison text: "except 'Swap Frog' **or 'Frog the Jam'**" — **must also exclude Frog the Jam** |
| Send from field — face-up | `s.tgfilter`: `(c:IsLocation(LOCATION_DECK) or c:IsFaceup())` — face-down field monsters excluded | Edison text: "from your Deck or **your side of the field**" — no face-up restriction; face-down field monsters are includable |

**Gap 1:** The modern errata dropped Frog the Jam from the exclusion list. The Edison text explicitly excludes both Swap Frog and Frog the Jam. The `s.estg` filter must also exclude Frog the Jam (passcode 68999286).

**Gap 2:** `s.tgfilter` requires `c:IsFaceup()` for field cards — prevents sending a face-down monster from your side of the field to the GY. The Edison text "from your Deck or your side of the field" has no face-up restriction for field cards.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** (1) In `s.estg`, add `and c:GetCode()~=68999286` (Frog the Jam) to exclude it from the extra Normal Summon. (2) In `s.tgfilter`, change the field card condition from `c:IsFaceup()` to `c:IsLocation(LOCATION_MZONE)` (allow any face-down or face-up field monster you control).

---

### 35. Treeborn Frog
- **Display/Script passcode:** 12538374  |  **Script:** `official/c12538374.lua`
- **Audit note:** No pre-errata script exists in the community repo (audit confirmed). Modern script is the only option.
- **Edison target:** "If this card is in your Graveyard during your Standby Phase and there are no Spell or Trap Cards on your side of the field, you can Special Summon this card to your side of the field. This effect cannot be activated if there is a face-up 'Treeborn Frog' on your side of the field."
- **Edison ruling:** "If this card's effect/activation is negated, it can activate again in the same Phase."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| Once-per-copy limit | `e1:SetCountLimit(1)` → once per turn per copy | `SetCountLimit(1)` **blocks re-activation after negation** within the same Standby Phase |
| Re-activation after negation | SetCountLimit(1) consumed on activation attempt → can't re-activate | Edison ruling: **must be able to re-activate** after negation |
| Condition | No Spell/Trap on your field + no face-up Treeborn Frog ✓ | ✓ |
| Turn player check | `tp==Duel.GetTurnPlayer()` ✓ | ✓ (your Standby Phase) |

**Gap:** `SetCountLimit(1)` prevents re-activation after the effect is negated (the counter is consumed). The Edison ruling says Treeborn Frog can re-activate in the same Standby Phase after being negated (e.g. if the opponent uses a Counter Trap to negate the activation, Treeborn should try again). Removing `SetCountLimit(1)` is required; natural constraints (card leaves GY when summoned, one copy in GY at a time) prevent infinite loops.

- **Verdict: `NEEDS-AUTHORING`**
- **Gap note (for CTO):** Remove `e1:SetCountLimit(1)` from the Standby Phase SSummon effect. The once-per-activation-per-copy limit is not needed: each Treeborn Frog copy in the GY can only trigger once naturally (after it's summoned, it's no longer in the GY). Allowing re-activation after negation matches the Edison ruling. Also remove `s.listed_names={id}` if it causes interference (it's a display hint, not gameplay-affecting, but should be reviewed).

---

### 36. Urgent Tuning
- **Display/Script passcode:** 94634433  |  **Script:** `official/c94634433.lua`
- **Edison target:** "Activate only during the Battle Phase. Synchro Summon 1 Synchro Monster. (Send the appropriate Synchro Material Monsters to the Graveyard.)"
- **Edison ruling:** "The Synchro Summon occurs when this effect resolves, it does not occur immediately after this effect resolves. Solemn Judgment can't negate the Synchro Summon performed when this effect resolves."

| Aspect | Modern script | Edison target / ruling |
|---|---|---|
| Synchro Summon timing | `s.scop` calls `Duel.SynchroSummon(tp,sg:GetFirst(),nil)` directly in the operation → **during resolution** | "Synchro Summon occurs when this effect resolves" ✓ |
| Battle Phase only | `s.sccon`: `Duel.IsBattlePhase()` ✓ | "Activate only during the Battle Phase" ✓ |
| Solemn Judgment | Summon during operation cannot be responded to separately | "Solemn Judgment can't negate" ✓ |

The modern card text says "Immediately after this effect resolves, Synchro Summon…" (suggesting a separate trigger post-resolution). However, the **modern script** actually implements the summon DURING the operation (on resolution), not as a post-resolution action. This means the script already matches the Edison behavior, regardless of the modern text wording.

- **Verdict: `MODERN-OK`** — modern script already implements the Edison behavior (Synchro Summon on resolution, not post-resolution). No substitution needed.

---

## Staged Files (`out/`)

| File | Verdict | Source | Notes |
|---|---|---|---|
| `out/511002993.lua` | DROPIN | `pre-errata/c511002993.lua` | Brionac; script passcode ≠ display passcode |
| `out/511002631.lua` | DROPIN | `pre-errata/c511002631.lua` | Sangan; script passcode ≠ display passcode |
| `out/511002992.lua` | DROPIN | `pre-errata/c511002992.lua` | Rescue Cat; script passcode ≠ display passcode |
| `out/511002994.lua` | DROPIN | `pre-errata/c511002994.lua` | Goyo; script passcode ≠ display passcode |
| `out/511002995.lua` | DROPIN | `pre-errata/c511002995.lua` | Brain Control; script passcode ≠ display passcode |
| `out/511002997.lua` | DROPIN | `pre-errata/c511002997.lua` | Future Fusion; script passcode ≠ display passcode |
| `out/511002998.lua` | DROPIN | `pre-errata/c511002998.lua` | Necrovalley; script passcode ≠ display passcode |
| `out/511003007.lua` | DROPIN | `pre-errata/c511003007.lua` | Ryko; script passcode ≠ display passcode |
| `out/511000228.lua` | DROPIN | `pre-errata/c511000228.lua` | Catapult Turtle; script passcode ≠ display passcode |
| `out/511003028.lua` | DROPIN | `pre-errata/c511003028.lua` | Darkness Approaches; script passcode ≠ display passcode |
| `out/511003023.lua` | DROPIN | `pre-errata/c511003023.lua` | Ultimate Offering; script passcode ≠ display passcode |
| `out/88264978.lua` | FIXED | `pre-errata/c88264978.lua` (modified) | REDMD; 2-line change (per-name → per-copy) |

---

## CTO Authoring Worklist

Cards marked **NEEDS-AUTHORING** (13 total). For each: what the current script does vs. what Edison target text requires, and the minimal change needed.

---

### A1. Ancient Fairy Dragon (25862681 / script 25862691)
**What script does:** (1) SSummon effect locked to Main Phase 1 via condition `Duel.GetCurrentPhase()==PHASE_MAIN1`. (2) Destroy effect destroys ALL field spells from both field zones simultaneously.  
**What Edison requires:** (1) SSummon during any Main Phase (MP1 or MP2). (2) "Destroy a Field Spell Card" — player chooses ONE field spell to destroy.  
**Minimal change:** (1) Remove the `PHASE_MAIN1` condition from e1 (the engine already restricts ignition effects to Main Phases naturally). (2) Rewrite e2 target/operation to let the player select one field spell (from either player's field zone) using `SelectTarget`, then destroy only that one card.

---

### A2. Dark End Dragon (88643579)
**What script does:** Uses `EFFECT_FLAG_CARD_TARGET` — the monster to send is selected at activation declaration (targeting). Modern text says "target 1 monster."  
**What Edison requires:** Non-targeting effect — "send 1 monster your opponent controls to the Graveyard" (no "target" keyword). Monster is chosen at resolution.  
**Minimal change:** Remove `EFFECT_FLAG_CARD_TARGET` from e1. Remove the `chkc` path and `HINTMSG_TOGRAVE` from `s.target` (rename to a feasibility-only check). Move monster selection (`SelectMatchingCard`) into `s.operation` (resolution). The ATK/DEF loss of Dark End Dragon still applies on resolution even if the selected monster is no longer present.

---

### A3. Destiny End Dragoon (76263644)
**What script does:** (1) Destroy effect uses `EFFECT_FLAG_CARD_TARGET`. (2) Damage only dealt if destroyed monster was face-up (`tc:IsFaceup()`). Revival effect's `SetCountLimit(1)` is per-copy (already correct).  
**What Edison requires:** (1) Non-targeting destroy effect (no "target" in Edison text). (2) "Inflict damage equal to its ATK" with no face-up qualifier — damage based on ATK at time of destruction, including face-down monsters whose ATK is revealed.  
**Minimal change:** (1) Remove `EFFECT_FLAG_CARD_TARGET`. Move `SelectMatchingCard` to operation. (2) In operation, get the monster's ATK after the destroy call (the engine knows the revealed ATK of face-down monsters after they're destroyed) and deal that as damage unconditionally.

---

### A4. Elemental HERO Prisma (89312388)
**What script does:** The reveal and send of a Fusion Material are the **cost** (`e1:SetCost(s.coscost)`). If the effect is negated, the monster was already sent. Edison ruling: "This effect has no cost."  
**What Edison requires:** Reveal and send happen on resolution as part of the effect. If activation is negated, nothing is sent. If Prisma leaves the field before resolution, nothing is sent (effect resolves without effect).  
**Minimal change:** Remove `e1:SetCost(s.coscost)`. Create a feasibility-check cost function that only checks `IsExistingMatchingCard` without sending anything. Move the actual reveal (ConfirmCards) and send (SendtoGrave/or banish) from `s.coscost` into `s.cosoperation`. Keep the existing `if not c:IsRelateToEffect(e) or c:IsFacedown() then return end` guard in the operation (if Prisma is not face-up, operation returns early with no send and no name change).

---

### A5. Fortune Lady Light (34471458)
**What script does:** `s.spcon` requires `c:IsPreviousPosition(POS_FACEUP)` — effect does not trigger if Fortune Lady Light was face-down when removed.  
**What Edison requires:** "When this card is removed from the field by a card effect" — no face-up restriction. Edison ruling explicitly says: "Will trigger even if Fortune Lady Light left the field while face-down."  
**Minimal change:** Remove `c:IsPreviousPosition(POS_FACEUP)` from `s.spcon`. The remaining conditions (`IsReason(REASON_EFFECT)`, `not c:IsLocation(LOCATION_DECK)`) are sufficient. Optionally also revisit the `not c:IsLocation(LOCATION_DECK)` check vs. the ruling "Will trigger even if this card returns to the hand" — returning to hand should trigger, returning to deck is less clear from the ruling.

---

### A6. Light and Darkness Dragon (47297616)
**What script does:** (1) Negate effect has `EFFECT_COUNT_CODE_CHAIN` — only negates once per chain. (2) Destroy-and-SSummon effect uses `EFFECT_FLAG_CARD_TARGET` (target chosen at activation).  
**What Edison requires:** (1) No once-per-chain limit — LaDD negates every qualifying activation in the chain (each loses 500/500). (2) "Select 1 monster in your Graveyard" — non-targeting (selection during resolution).  
**Minimal change:** (1) Replace `e2:SetCountLimit(1,0,EFFECT_COUNT_CODE_CHAIN)` with a per-chain-link check that doesn't globally block further activations of e2 in the same chain (or remove SetCountLimit entirely and rely on `s.negtg`'s `HasFlagEffect(id)` per-activation flag as the single-activation-per-chain-link guard, resetting per link). (2) Remove `EFFECT_FLAG_CARD_TARGET` from e3; move GY target selection from `s.sptg` into `s.spop` (after destroying field cards, select from remaining GY monsters).

---

### A7. Light End Dragon (25132288)
**What script does:** `s.condition` checks `tc:IsFaceup()` on the battle target — won't activate when attacking a face-down defending monster.  
**What Edison requires:** "The monster it is battling loses 1500 ATK and DEF until the End Phase" — no face-up restriction on the battle target. Should work against face-down defenders too.  
**Minimal change:** Remove `tc:IsFaceup()` from `s.condition`. Also remove `tc:GetAttack()>0 or tc:GetDefense()>0` if present (face-down monsters have ATK/DEF that the engine knows; the loss applies regardless). Keep `c:GetAttack()>=500 and c:GetDefense()>=500` (LED's own check) and `tc` validity checks.

---

### A8. My Body as a Shield (69279219)
**What script does:** `e1:SetProperty(EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL)` — allows My Body as a Shield to chain to activations during the Damage Step and during damage calculation.  
**What Edison requires:** "This card can't be activated during the Damage Step." Per Edison ruling, My Body as a Shield cannot respond to anything happening in the Damage Step.  
**Minimal change:** Change `e1:SetProperty(EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL)` to remove both flags (or `e1:SetProperty(0)` if no other flags are needed). All other logic (LP cost via `Cost.PayLP(1500)`, condition checking for monster-destroy activation, negate + destroy) remains correct.

---

### A9. Quickdraw Synchron (20932152)
**What script does:** Uses `EFFECT_SPSUMMON_PROC` — a summon procedure that occurs inline when the special summon is declared, not a chain-link ignition effect. Send is `REASON_COST`.  
**What Edison requires:** "The ① effect is an ignition effect. It activates, and can be chained to." Send happens on resolution as part of the effect, not as a cost.  
**Minimal change:** Replace e1 (`EFFECT_SPSUMMON_PROC`) with an `EFFECT_TYPE_IGNITION` effect in `LOCATION_HAND`. Cost function: check feasibility (1+ sendable monster in hand, space in MZONE), but do NOT send. Operation: select + send 1 monster from hand to GY as `REASON_EFFECT`; if sent successfully, special summon Quickdraw from hand. Keep e2 (synchro material restriction) and e3 (marker) unchanged.

---

### A10. Soul Exchange (68005187)
**What script does:** (1) Battle Phase skip applied in `s.cost` (before chain). (2) `EFFECT_EXTRA_RELEASE` forces the player to tribute only the selected monster.  
**What Edison requires:** (1) BP skip should NOT apply if activation is negated (Edison ruling). (2) Player is not forced to tribute the selected monster — can still tribute own monsters (Edison ruling).  
**Minimal change:** (1) Move the `EFFECT_CANNOT_BP` registration from `s.cost` to `s.activate` (the operation). The cost function should only check `Duel.GetCurrentPhase()~=PHASE_MAIN2` (can't activate in MP2). (2) Replace `EFFECT_EXTRA_RELEASE` on the target with a mechanism that makes the opponent's monster available as a tribute target without forcing it — the engine may support a "can be tributed as if your own" flag that doesn't mandate it; investigate `EFFECT_SET_CONTROL` (temp) or `EFFECT_TRIBUTE_PERMIT` alternatives.

---

### A11. Strike Ninja (41006930)
**What script does:** `e1:SetCountLimit(1,id)` — once per NAME (all copies share one use per turn). Cost draws from `LOCATION_MZONE|LOCATION_GRAVE`.  
**What Edison requires:** Per-copy limit (each copy can use it once per turn). GY only for cost.  
**Minimal change:** (1) `e1:SetCountLimit(1,id)` → `e1:SetCountLimit(1)`. (2) In `s.rmcost`, change the location from `LOCATION_MZONE|LOCATION_GRAVE` to `LOCATION_GRAVE` in both the check (`IsExistingMatchingCard`) and the selection (`SelectMatchingCard`). No other changes needed.

---

### A12. Swap Frog (9126351)
**What script does:** (1) `s.estg` excludes only Swap Frog from extra Normal Summon (not Frog the Jam). (2) `s.tgfilter` requires `c:IsFaceup()` for field cards — excludes face-down field monsters.  
**What Edison requires:** (1) "except 'Swap Frog' or 'Frog the Jam'" — Frog the Jam (passcode 68999286) must also be excluded. (2) "from your Deck or your side of the field" — no face-up restriction on field cards.  
**Minimal change:** (1) In `s.estg`, add `and c:GetCode()~=68999286` (Frog the Jam passcode). (2) In `s.tgfilter`, replace `(c:IsLocation(LOCATION_DECK) or c:IsFaceup())` with `(c:IsLocation(LOCATION_DECK) or c:IsLocation(LOCATION_MZONE))` to include face-down field monsters.

---

### A13. Treeborn Frog (12538374)
**What script does:** `e1:SetCountLimit(1)` — once per copy per turn. After a negated activation, the counter is spent → cannot re-activate in the same Standby Phase.  
**What Edison requires:** "If this card's effect/activation is negated, it can activate again in the same Phase."  
**Minimal change:** Remove `e1:SetCountLimit(1)` from the Standby Phase trigger effect. Natural constraints (card leaves GY once summoned) prevent unintended re-triggering. Optional: add a comment explaining why no limit is needed (per-copy in-GY presence is the natural limiter).

---

*End of report.*
