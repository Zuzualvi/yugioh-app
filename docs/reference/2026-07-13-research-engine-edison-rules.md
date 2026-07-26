# Can the reused engine reproduce Edison-era (March 2010 / Master Rule 1) GAMEPLAY RULES?

**Research brief — the "accuracy is sacred" linchpin question.**
Author: product-research subagent. Date: 2026-07-13.
Scope: ocgcore / ygopro-core (edo9300 fork) + EDOPro + ProjectIgnis CardScripts.
Method: direct reading of the engine C++ source (cloned repos, file:line cited), the
ProjectIgnis Lua scripts, the community EDOPro Edison banlist, plus web research on the
Edison rules and the retro community. Facts are cited; inferences are labelled **[INFERENCE]**.

---

## TL;DR VERDICT

| Behavior | Verdict | Mechanism |
|---|---|---|
| 1. Ignition-effect **priority** | ✅ **Out of the box** (with correct flag) | `DUEL_TCG_FAST_EFFECT_IGNITION` (or `DUEL_OCG_OBSOLETE_IGNITION`) |
| 2. **First player draws** turn 1 | ✅ **Out of the box** | `DUEL_1ST_TURN_DRAW` |
| 3. Pre-2014 **Damage Step** timing | 🟡 **With work** (flags exist, not in MR1 preset) | `DUEL_6_STEP_BATLLE_STEP` + `DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP` |
| 4. Pre-MR3 **Field Spell** (single, destroys old) | ✅ **Out of the box** | `DUEL_1_FACEUP_FIELD` |
| **Card-level errata residual risk** | 🟠 **MEDIUM** — mitigable but laborious; requires curating a pre-errata card set | — |

**Bottom line:** The engine **can** reproduce the Edison 2010 *ruleset*. All four behaviors are
real, individually-settable duel-option flags that gate the actual logic in the engine — this is
*not* "the banlist runs on modern mechanics." The key correction to the founder's mental model:
these engines do **not** merely apply the 2010 banlist on modern rules — the edo9300 fork was
deliberately built with granular era-rule flags. The residual accuracy gap is **card-level errata**:
individual card scripts ship with *modern* (post-2010) errata wording, and fixing that requires
curating a pre-errata card set (scripts + database + banlist substitutions), exactly as the retro
community already does. So "accuracy is sacred" is **honorable for the rules engine out of the box**,
and **honorable for card text with ongoing curation work** (with a small documented residual).

---

## 0. Critical framing correction

The brief's worry — "do 'Edison' setups merely apply the 2010 banlist + card pool while running
MODERN mechanics?" — is a real risk for **naive** setups, and it is exactly what the *banlist file
alone* does. But the **edo9300 ygopro-core fork** (the one EDOPro and the wasm bindings use, and the
one our project has committed to) was explicitly refactored to split the historical Master Rules into
independent toggleable "parameters." The original PR describes it directly: <cite index="14-1">the change split all the different rules present in the various master rules into 5 "parameters": obsolete ignition, draw during the 1st turn, only 1 field spell on the field at the same time, pendulum zones and extra monster zones</cite>, and <cite index="14-2">the game now sees the master rules as "premade packs" of those rules, allowing the player to choose freely among these options</cite>.

So the era-rule machinery is a first-class engine feature, not an afterthought.

**One caveat that recurs below:** the *banlist file* (`.lflist.conf`) only curates the **card pool**;
it carries **no** rule directive. Selecting an "Edison" banlist does **not** switch the engine into
2010 rules — the duel-option flags are set separately (in EDOPro's host UI; in our own build, by the
`duelFlags` value we pass to `OCG_CreateDuel`). We control that value directly.

---

## 1. Ignition-Effect Priority — ✅ REPRODUCIBLE OUT OF THE BOX

### What Edison requires
This is the defining Edison rule. <cite index="12-5">In Edison format, the turn player has "priority" to activate an Ignition Effect of a successfully Summoned monster before the opponent can respond — e.g. Normal Summon Brionac and immediately activate its bounce effect before the opponent can activate Bottomless Trap Hole or Torrential Tribute; this rule was removed in 2012</cite>. The precise condition: <cite index="4-2">the turn player can activate an Ignition Effect as Chain Link 1 in the Summon response timing, so long as that Summon did not start a Chain; the turn player does NOT have Ignition Effect Priority when the Summon starts a chain</cite>. Crucially, Edison (a TCG format) extends this priority to **Graveyard** ignition effects too: e.g. <cite index="5-3">its controller retains their Ignition Priority and can activate the ignition effect of "Plaguespreader Zombie" in their GY</cite>.

### What the engine does
The flag exists and gates the real logic. In `ocgapi_constants.h`:
```
#define DUEL_OCG_OBSOLETE_IGNITION      0x100
#define DUEL_TCG_FAST_EFFECT_IGNITION   0x400000000
```
In `processor.cpp` (case 8, lines ~796–835), an entire "Obsolete ignition effect ruling" block is
gated on these flags:
```cpp
if(skip_freechain || !(is_flag(DUEL_OCG_OBSOLETE_IGNITION) || is_flag(DUEL_TCG_FAST_EFFECT_IGNITION))
   || (infos.phase != PHASE_MAIN1 && infos.phase != PHASE_MAIN2))
    return FALSE;                       // <-- without a flag, priority logic is skipped entirely
```
When enabled and the turn player just Summoned (or a chain just ended) with no chain started, the
engine builds a list `core.ignition_priority_chains` letting the turn player activate an Ignition
Effect as Chain Link 1 **before** the opponent gets a response window. This precisely matches the
Edison rule.

### The important nuance (OCG flag vs TCG flag)
There are **two** flavors and they differ in scope (`processor.cpp:809` and `:826`):
- `DUEL_OCG_OBSOLETE_IGNITION`: grants priority **only to Ignition Effects of monsters in the Monster
  Zone** (`phandler->current.location == LOCATION_MZONE`), and only in the summon-success/chain-end window.
- `DUEL_TCG_FAST_EFFECT_IGNITION`: grants priority to Ignition Effects in **any location** (including
  Graveyard effects like Destiny HERO – Malicious and Plaguespreader Zombie), at every open fast-effect
  timing in the Main Phase.

Because Edison is a **TCG** format and its rulings explicitly give priority to GY ignition effects
(Malicious, Plaguespreader — see the cited examples), **we should set `DUEL_TCG_FAST_EFFECT_IGNITION`**
(optionally alongside the OCG flag) for full accuracy. Using only `DUEL_OCG_OBSOLETE_IGNITION` would
under-grant priority for GY effects. This is a subtle correctness trap worth encoding in our defaults.

### Community confirmation this works in practice
Dueling Nexus (a browser sim in the same ocgcore family) reproduces it: <cite index="26-1">Ignition Effect Priority IS a thing in Edison Format on their platform, so Bottomlessing a Judgment Dragon will still nuke your board</cite>.

**Verdict: OUT OF THE BOX** — set the flag. High confidence (verified in source + confirmed live on a sibling sim).

---

## 2. First Player Draws on Turn 1 — ✅ REPRODUCIBLE OUT OF THE BOX

### What Edison requires
<cite index="28-2">In Edison Format a card is drawn during the first draw phase of the duel, so the player who goes first starts the duel with 6 cards.</cite> (The skip-draw rule is a 2014 MR3 change.)

### What the engine does
`ocgapi_constants.h`: `#define DUEL_1ST_TURN_DRAW 0x200`. In `processor.cpp:3381`:
```cpp
if(is_flag(DUEL_1ST_TURN_DRAW) || (infos.turn_id > 1)) {   // turn-1 draw only happens if flag set
    int32_t count = get_draw_count(infos.turn_player);
    ...
    draw(nullptr, REASON_RULE, turn_player, turn_player, count);
}
```
Without the flag, the first turn's draw is skipped (modern behavior). With it, the first player draws.
This flag is part of the `DUEL_MODE_MR1`, `DUEL_MODE_MR2` and `DUEL_MODE_GOAT` presets.

**Verdict: OUT OF THE BOX.** High confidence.

---

## 3. Pre-2014 Damage Step Timing — 🟡 REPRODUCIBLE WITH WORK

### What Edison requires
<cite index="12-5">The Damage Step in Edison follows 2010 rules, which are more restrictive about what effects can be activated during it compared to modern Yu-Gi-Oh.</cite> There is also a related battle rule: <cite index="28-5">in Edison, when two Attack Position monsters with 0 ATK battle each other they destroy one another, and a 0-ATK attacker cannot destroy a 0-DEF Defense Position monster by battle</cite>.

### What the engine does
The relevant flags exist:
```
#define DUEL_6_STEP_BATLLE_STEP              0x08          // old multi-substep battle/damage step
#define DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP  0x40000000    // one chain per damage substep (old)
#define DUEL_0_ATK_DESTROYED                 0x10000000    // the 0-ATK battle rule above
```
They gate real logic: `DUEL_6_STEP_BATLLE_STEP` at `processor.cpp:2305, 2345, 2585`;
`DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP` at `processor.cpp:2315, 2356, 2387, 2597, 2639`;
`DUEL_0_ATK_DESTROYED` at `processor.cpp:2974`. The 0-ATK rule flag confirming the Edison battle
rule (`28-5`) is direct evidence these "old battle" flags target exactly this era.

### Why "with work" and not "out of the box"
These damage-step flags are **not** in the `DUEL_MODE_MR1` preset. They live only in `DUEL_MODE_GOAT`:
```
DUEL_MODE_MR1  = OCG_OBSOLETE_IGNITION | 1ST_TURN_DRAW | 1_FACEUP_FIELD | (3 old-summon flags)
DUEL_MODE_GOAT = DUEL_MODE_MR1 | TCG_FAST_EFFECT_IGNITION | 6_STEP_BATLLE_STEP
                 | SINGLE_CHAIN_IN_DAMAGE_SUBSTEP | 0_ATK_DESTROYED | TCG_SEGOC_* | ...
```
So a bare "Master Rule 1" selection gives you priority + first-turn-draw + single field spell, but
**not** the older damage-step behavior. To reproduce the 2010 damage step you must build a **custom
flag set** that adds the GOAT-family damage-step flags on top of the MR1 base (see §6).

**[INFERENCE — flagged uncertainty]:** `DUEL_MODE_GOAT` is designed for the 2005 GOAT format, also a
pre-2011 TCG environment. Both GOAT (2005) and Edison (2010) predate the 2014 damage-step
simplification, so the "old damage step" flags are broadly correct for Edison. However, I have **not**
verified that every GOAT-era damage-step micro-ruling is identical to the 2010 environment. This
warrants a small validation spike against known Edison damage-step rulings before we lock defaults.

**Verdict: WITH WORK** (flags exist; require custom composition; minor residual uncertainty on exact
2010-vs-2005 micro-differences). Medium-high confidence.

---

## 4. Pre-MR3 Field Spell (single shared field, new one destroys old) — ✅ OUT OF THE BOX

### What Edison requires
<cite index="28-2">In Edison only one Field Spell can be active at a time; setting a Field Spell does not destroy an opponent's active Field Spell, but activating a new one does — e.g. activating "Mountain" while the opponent's "Umi" is active destroys "Umi" when "Mountain" resolves.</cite>

### What the engine does
`ocgapi_constants.h`: `#define DUEL_1_FACEUP_FIELD 0x400`. Three code sites implement the exact behavior:
- `processor.cpp:4162` — on activating a Field Spell, if the flag is set, the **opponent's** face-up
  Field Spell has its field effect disabled (single active field).
- `processor.cpp:4294` — on resolution/cleanup, the opponent's face-up Field Spell is **destroyed**
  (`destroy(fscard, ...)`) — matching "activating a new one destroys the old."
- `operations.cpp:4914` — when a Field Spell enters the field zone that already holds one: with the flag
  set it is **destroyed**; without it (modern) it is sent to the Graveyard. (Modern rules give each
  player their own field zone; the old rule is a single shared face-up field.)

This flag is in both the MR1 and MR2 presets.

**Verdict: OUT OF THE BOX.** High confidence.

---

## 5. Card-Level Errata — 🟠 RESIDUAL RISK: MEDIUM

This is the real, subtle gap. Even with perfect core-rule flags, **individual card scripts reflect
CURRENT (post-2010) errata**, not the card's 2010 text/behavior.

### The community treats pre-errata text as mandatory (not "close enough")
Per the Edison rules authority: <cite index="27-2">due to the time period the format is set in, all cards must use the text of the latest printings as of April 24, 2010, known as their Pre-Errata versions.</cite> The Edison community maintains a formal "Functional Errata" list of cards that "work differently in Edison" — roughly three dozen cards, including Brionac, Sangan, Brain Control, Rescue Cat, Ryko, Treeborn Frog, Red-Eyes Darkness Metal Dragon, Elemental HERO Prisma, Goyo Guardian, Necrovalley, Future Fusion, Black Garden, and others (source: edisonformat.com/functional-errata.html).

### Concrete proof the default scripts are wrong for Edison
I read the shipping ProjectIgnis script for **Brionac, Dragon of the Ice Barrier**
(`CardScripts/official/c50321796.lua`). Its Ignition Effect registers `e1:SetCountLimit(1,id)` — a
**hard once-per-turn** limit. That is the *modern errata*. The Edison functional-errata entry states
Brionac's ignition effect **"has no once-per-turn restriction"** in Edison
(edisonformat.com/functional-errata.html). So a stock EDOPro/CardScripts install would incorrectly cap
Brionac at one activation per turn — a meta-relevant, format-defining bug (repeated Brionac bounces
were central to the era). This is a clean, verified example of the residual risk biting.

### Pre-errata scripts exist, but coverage is GOAT-oriented, not Edison-complete
ProjectIgnis CardScripts has dedicated `pre-errata/` (68 scripts), `goat/` (191 scripts), and
`pre-release/` directories — the mechanism to run era-accurate behavior exists. **But** the
`pre-errata/` directory's coverage skews to GOAT (2005) staples. Checking the key Edison functional-
errata cards at their real passcodes: Brionac (50321796), Sangan (26202165), Ryko (21502796), Treeborn
Frog (12538374), and Black Garden (71645242) are **not** present in `pre-errata/`; only Red-Eyes
Darkness Metal Dragon (88264978) is. (Pre-errata versions that do exist tend to live under alternate
"anime" passcodes in the 511xxxxxx / 504700xxx ranges, i.e. `pre-errata` is authored per-alias, not
per-real-card.) So we cannot assume the official repo already covers Edison's errata cards — some must
be sourced, substituted via alias, or authored.

### The community's mitigation — and its limits
There is a community EDOPro Edison card-pool banlist (diamonddudetcg/edopro-custom-banlists, "Edison"
release: `Edison.lflist.conf`, header `!2010.3 Edison`, ~6,300 lines). It does exactly the curation
described above: it has a **`#Modern Erratums`** section that forbids (count `-1`) the modern passcodes
of the errata cards — including 26202165 (Sangan), 50321796 (Brionac), 21502796 (Ryko), 47355498
(Necrovalley), 7391448 (Goyo Guardian), 88264978 (REDMD), 87910978 (Prisma) — plus `#Anime Alias`,
`#Goat Alias`, and `#Name Clause Alias` sections that whitelist the era-accurate substitute passcodes.
This proves the approach is viable and already field-tested. **Note:** this banlist only fixes the card
*pool/substitution*; it carries no rule flags, so it must be paired with the correct duel-option flags.

### How purists rate the automated sims (honest assessment)
The Edison community's own simulator comparison (edisonformat.net/beginners/simulators) is blunt:
<cite index="34-2">some simulators which "support edison format" don't feature the correct rulings or card text.</cite>
Their table rates **manual DuelingBook** (with human judges) as the accuracy gold standard, and marks
**EDOPro** as **"Edison Errata ❌ / Correct Rulings ❌"** (relying on the external community banlist for
the card pool). Dueling Nexus and YGO Omega are rated **"Edison Errata: Partially / Correct Rulings ❌."**
So even the retro community regards the automated engines as imperfect on card errata and edge-case
rulings — the rules *engine* is fine, but the *card text/ruling fidelity* is where they dock points.

**[INFERENCE]:** The "Correct Rulings ❌" marks conflate two things: (a) core-rule behavior — which we
have proven is flaggable and correct — and (b) per-card errata + rare edge-case interactions. Our
build can be *more* accurate than a stock EDOPro install by shipping the correct flag set *and* a
curated pre-errata card set by default (which stock EDOPro does not do out of the box).

### Feasibility proof
Dueling Nexus already ships this exact combination: <cite index="29-1">Edison Format on Dueling Nexus includes support for Master Rule 1 (2008), the March 2010 Banlist, Pre-Errata cards, and a retro card pool of all TCG-legal cards released before May 2010.</cite> A sibling ocgcore-family automated sim has therefore already done rules + pre-errata for Edison — so this is a solved problem in principle, and our residual work is curation, not invention.

**Residual risk rating: MEDIUM.** Not low (the default scripts are genuinely wrong for ~3 dozen
format-relevant cards, some meta-defining). Not high (the fix is well-understood, partially pre-built
by the community, and doesn't touch the engine). It is **ongoing curation work + a documented gap list**.

---

## 6. Recommended configuration for our build

We build our own server/UI on top of ocgcore, so we set the duel-option bitmask directly in
`OCG_CreateDuel(options.duelFlags)`. Recommended Edison flag set (start from MR1, add the TCG-era
behaviors that are Edison-correct):

```
duelFlags =
    DUEL_OCG_OBSOLETE_IGNITION       // 0x100        base ignition-priority window
  | DUEL_TCG_FAST_EFFECT_IGNITION    // 0x400000000  extend priority to GY effects (TCG-accurate)
  | DUEL_1ST_TURN_DRAW               // 0x200        first player draws turn 1
  | DUEL_1_FACEUP_FIELD              // 0x400        single shared Field Spell
  | DUEL_6_STEP_BATLLE_STEP          // 0x08         pre-2014 damage step structure
  | DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP // 0x40000000 old damage-substep chaining
  | DUEL_0_ATK_DESTROYED             // 0x10000000   Edison 0-ATK battle rule
  | DUEL_TCG_SEGOC_NONPUBLIC         // 0x100000000  TCG SEGOC handling
  | DUEL_TCG_SEGOC_FIRSTTRIGGER      // 0x200000000  Edison rule #7 (earlier trigger goes first)
  // + the MR1 "old summon" flags: DUEL_SPSUMMON_ONCE_OLD_NEGATE, DUEL_RETURN_TO_DECK_TRIGGERS,
  //   DUEL_CANNOT_SUMMON_OATH_OLD
  // + forbidden-types mask = TYPE_XYZ | TYPE_PENDULUM | TYPE_LINK (DUEL_MODE_MR1_FORB)
```
This is essentially `DUEL_MODE_GOAT` restricted to the flags that are 2010-correct. Note that Edison
Rule #7 (SEGOC "earlier trigger placed first", <cite index="28-1">a minor exception to SEGOC that would be changed in 2017</cite>) maps to `DUEL_TCG_SEGOC_FIRSTTRIGGER`, and the 0-ATK rule maps to
`DUEL_0_ATK_DESTROYED` — both present in the engine.

**Action items:**
1. Pass the custom Edison `duelFlags` above to `OCG_CreateDuel` (server-authoritative). Do **not** rely
   on the banlist to set rules.
2. **Validate** the exact flag set with a small spike against known Edison rulings (especially damage
   step and which GOAT-only flags are 2005-specific vs 2010-correct — e.g. review
   `DUEL_USE_TRAPS_IN_NEW_CHAIN`, `DUEL_EQUIP_NOT_SENT_IF_MISSING_TARGET` for 2010 applicability).
3. Set `DUEL_TCG_FAST_EFFECT_IGNITION` (not merely the OCG flag) so GY ignition effects get priority.
4. **Curate a pre-errata card set:** start from the community Edison banlist's substitution scheme
   (forbid modern errata passcodes, whitelist pre-errata/alias passcodes), pull existing
   `pre-errata/` + `goat/` scripts, and author the missing Edison-specific pre-errata scripts (Brionac
   no-OPT, Sangan, Ryko, Treeborn, Black Garden, etc.). Maintain a **documented gap list** of any card
   we knowingly leave on modern errata.
5. Use the **edo9300 fork** (not the old Fluorohydride MIT core) — only the edo9300 fork has these
   granular flags; the old core had a single coarse `DUEL_OBSOLETE_RULING` flag and far less control.

---

## 7. Source appendix (primary evidence)

Engine source (edo9300/ygopro-core, cloned 2026-07-13):
- `ocgapi_constants.h` — all `DUEL_*` flag definitions; `DUEL_MODE_MR1/MR2/MR3/MR4/MR5/GOAT` presets.
  Notably `DUEL_MODE_MR2` = MR1 **without** `DUEL_OCG_OBSOLETE_IGNITION`, matching the historical fact
  that Master Rule 2 (OCG 2011) removed ignition priority.
- `processor.cpp:796–835` — ignition priority; `:3381` first-turn draw; `:4162/4294` field spell;
  `:2305–2639` damage-step flags; `:2974` 0-ATK rule.
- `operations.cpp:4914` — field spell destroy-vs-send-to-grave.
EDOPro client (edo9300/edopro): `gframe/game.cpp:3097` `UpdateDuelParam()` builds `duelFlags` from a
`chkCustomRules[]` checkbox panel (each checkbox = one flag; the host can hand-craft any combination);
`cbDuelRule` dropdown offers MR1–MR5, Speed, Rush, GOAT, and Custom. ProjectIgnis FAQ confirms: <cite index="20-1">when hosting a room you can select any of the Master Rules (with/without TCG quirks), Speed Duel, Rush Duel, GOAT, or a variety of custom rules via the Custom button next to the Rule selection box.</cite>
CardScripts (ProjectIgnis): `pre-errata/` (68), `goat/` (191), `pre-release/`, `official/`; modern
Brionac `official/c50321796.lua` has `SetCountLimit(1,id)`.
Community banlist: diamonddudetcg/edopro-custom-banlists "Edison" release `Edison.lflist.conf`.

Web sources:
- edisonformat.com/functional-errata.html, /edison-rule-differences.html, /priority.html
- edisonformat.net/beginners/simulators, /rules/compendium/*
- yugiohedison.com/rules ; goatworld.community Edison guide
- duelingnexus.com/blog/game-update-edison-format, /blog/edison
- Fluorohydride/ygopro PR #2051 (edo9300, "split master rules into parameters")
- projectignis.github.io/faq.html
