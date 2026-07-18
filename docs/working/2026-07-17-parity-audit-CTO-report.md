# Edison Parity Audit — CTO Completion Report

_Date: 2026-07-17 · Author: CTO · Audience: Product Lead (parity sign-off) + CEO_
_Final verified commit: `74761e4` (engine) · matrix consolidated `061df5a` · CI-hardening `1e6a239`_

> **This is the resume trigger.** Track B (engine parity) and Track B4 (/learn docs shell) are COMPLETE and
> QA-verified. The Product Lead can now (1) review the populated matrix + the RECONCILE list below,
> (2) record the parity sign-off, (3) start Track C (author the docs) against the verified matrix and the
> `docs-manifest.json` schema at the end of this report.

---

## 1. Final matrix rollup (127 acceptance-gate rows — 100% populated)

Consolidated in `docs/working/2026-07-17-parity-matrix.md` @ `061df5a`. Every §1/§2/§3 row now has a
verdict; §4 fixtures and §5 eng-items resolved.

| Status | Count | Meaning |
|--------|------:|---------|
| **VERIFIED-PASS** | **107** | A passing automated accuracy test asserts the Edison behavior. |
| **CARVE-OUT** | **17** | Engine cannot match the ruling (or it's judge-adjudicated); DOCUMENTED as a known table-difference in the rules guide. Not fixed, per CEO decision (`/decisions/2026-07-17-parity-defect-fix-depth.md`). |
| **RECONCILE** | **3** | The reference's *example card* is out of our pool; the RULE is verified via sibling rows. Product Lead decides: stock the card or accept the substitute. |

Plus **§4 = 17 Tier-3 fixtures VERIFIED-PASS** (all pool-legal + load/step) and **§5 = 2 eng-items RESOLVED**.

**Verification:** whole accuracy suite green on a clean checkout @ `74761e4` — QA cloned fresh, built/loaded
the custom WASM, ran all 12 accuracy files (**0 hard failures, 15 documented `it.fails`, 5 documented skips**),
and `npm run verify` passed end-to-end (63 files, 1038 tests). Skips are the 5 documented below.

---

## 2. Defects found & FIXED (with fix commit SHAs)

The audit surfaced 18 real defects; the tractable ones were fixed in the fix phase:

| Defect | Fix | Commit |
|--------|-----|--------|
| **R04-B1/B3 — LADD infinite-negate loop** (Light & Darkness Dragon negated a mandatory trigger every activation → could hang a duel) | `c47297616.lua`: register the once-per-phase negate flag unconditionally | `1f04c24` |
| **R03-B1 — "1 Union per monster" not enforced** | new `c78349103.lua` (Machina Peacekeeper) equip-target checks union status | `1f04c24` |
| **R03-B3 — non-listed Unions wrongly protected their monster** (modern errata leaking in) | new `c65622692.lua` (Y-Dragon Head) + `c64500000.lua` (Z-Metal Tank): no destruction-substitute | `1f04c24` |
| **R05-B6b — My Body as a Shield couldn't protect a Trap Monster vs Lightning Vortex** | `c69279219.lua`: keep the fast-effect flags, add an `IsDamageStep()` guard (correct Edison: can't activate in the DS, can elsewhere) | `28da687` |
| **ERR-URGENTTUNING — Solemn could wrongly negate the Synchro Summon** | `c94634433.lua`: perform the Synchro Summon inside the effect operation (summon-on-resolution) | `4774850` |
| **ERR-NECROVALLEY — over-negated non-targeting GY effects (e.g. Treeborn)** | re-authored `c511002998.lua`: only negate GY-*targeting* effects | `09b6fb7` |
| **ERR-STRIKENINJA / ERR-SWAPFROG script bugs** (wrong GY searched; Frog the Jam wrongly excluded) | `c41006930.lua`, `c9126351.lua` | `09b6fb7` |
| **ERR-TREEBORN "defect" was a false positive** — revival works via `SELECT_EFFECTYN`; replaced the stale wrong-method test with a correct passing test | `edisonErrata.b2.accuracy.test.ts` | `74761e4` |

**No open unresolved defects.** Everything not fixed above is a deliberate, documented CARVE-OUT (§3).

---

## 3. Carve-outs (documented, NOT fixed) — with rationale

CEO-approved (`go with your rec`): fix the clear/tractable defects, transparently document the deep
engine-level ones as known table-differences. Each of these becomes an honest "at a real table, watch for
this" note in the rules guide.

**Engine cannot match the ruling (ocgcore-level; our scripts are logically correct):**
- **R02-B3, R02-B7a, R02-B7b — field-spell edge cases** (can't SET a field spell while one is active;
  same-player replacement over own field spell). Engine shared-field-zone model. (Investigated: the earlier
  "zone mix-up" theory was a red herring — genuine limitation.)
- **R05-B3 / R05-B4 / R05-B4b / R05-B5a — trap-monster reversion / zone / owner-vs-controller** cases. ocgcore
  doesn't reset the monster-attribute state or track owner-vs-controller for trap-monster reversion.
- **R06-B4a — ignition priority vs Black Garden.** The engine's obsolete-ignition flag opens turn-player
  priority before an opponent's continuous-event mandatory trigger; not script-fixable.
- **R08-S5 — Gorz not offered at S5** on battle damage (EVENT_DAMAGE timing inside the 6-step damage step).
- **ERR-BLACKGARDEN / ERR-LIGHTENDDRAGON / ERR-FORTUNELADYLIGHT — face-down-trigger cluster.** ocgcore does
  not fire these triggers when the relevant monster is FACE-DOWN. Shared engine root cause; rare in play.

**Harness-observability only — GAMEPLAY VERIFIED WORKING (not a real defect):**
- **R04-B1 / R04-B3 — Lightsworn End-Phase mill / Spirit return re-fire after LADD negation.** The LADD
  infinite-loop is FIXED. QA confirmed **Lightsworn End-Phase MILL WORKS in a real duel** (normal-summoned
  Lumina milled 3 cards deck→GY). The `it.fails` persists only because `EFFECT_TYPE_FIELD+TRIGGER_F` effects
  emit no message-stream MOVE when the source is *direct-placed* in the low-level test harness. **No player
  impact.**

**Human judge-call (R12 verdict — answers the open handoff question):**
- **R12-B1 / R12-B2 — infinite loops.** Spike-confirmed: **ocgcore does NOT enforce Edison voluntary-loop
  illegality** (a loop-causing board state reaches normal play with no block). This matches every Edison
  simulator: infinite loops are a human judge-call. → Document as human-adjudicated. No engine work.

**Documentation-only:**
- **R06-B5 — "priority is a right whether declared or not"** — a framing rule with no discrete engine
  assertion; covered by the rules-guide prose.

---

## 4. RECONCILE list (the single input the Product Lead most needs before authoring docs)

Places the reference/matrix disagree with our pool/catalog. **The engine is trusted; these are reference
data errors or product decisions — resolve before writing docs so card names/passcodes are correct.**

**A. Matrix/reference PASSCODE CORRECTIONS (7 — the reference passcodes were unreliable; use these):**
| Card | Correct passcode | Matrix had | (matrix's wrong code was actually) |
|------|------------------|-----------|-----|
| Secret Village of the Spellcasters | 68462976 | 03282221 | — |
| Geartown | 37694547 | 08067863 | — |
| Monster Reincarnation | 74848038 | 08491961 | Lyrilusc – Recital Starling |
| Degenerate Circuit | 36995273 | 39168895 | Berserk Gorilla |
| Embodiment of Apophis | 28649820 | 46461247 | Trap Master |
| Metal Reflect Slime | 26905245 | 26593934 | — |
| Fake Trap | 3027001 | 69826768 | — |

**B. OUT-OF-POOL example cards (3 RECONCILE rows) — the RULE is verified via sibling rows; the specific
demo isn't automatable in our pool. Decide: stock the card+script, or accept the substitute in the docs:**
- R09-B2b — Necroface (12057781): in the catalog but has NO Lua script (would not function in a duel — also a
  playability follow-up: audit for other script-less catalog cards).
- R09-B2c — Aslla Piscu (05334927): not in pool.
- R11-B4 — Peten the Dark Clown (40991692) / Red-Eyes Wyvern (10068575): not in pool.
- (White Stone of Legend 30596061 also not in pool; R11-B3 verified using a Dandylion substitute — fine.)

**C. Doc-wording reconcile:** ERR-MARKOFTHEROSE — its Standby "regain control" effect is CONTINUOUS (it
silently re-applies), not a chain-starting Trigger; the reference's "both triggers start chains" is imprecise.

**D. Substitoad — RESOLVED (CEO-confirmed):** stays UNLIMITED on our March-2010 list (period-accurate);
the STP-15 Frognarch fixture keeps 3× Substitoad. No change.

---

## 5. Acceptance criteria (AC-1…AC-6)

- **AC-1 — MET.** Matrix 100% populated; every Tier-1 behavior is VERIFIED-PASS or a documented CARVE-OUT/RECONCILE.
- **AC-2 — MET.** All 36 functional-errata cards VERIFIED-PASS or documented (3 face-down carve-outs).
- **AC-3 — MET.** All 17 Tier-3 fixtures pool-legal + load/step green (2 passcode swaps; Substitoad 3× kept).
- **AC-4 — MET.** `/learn` ships behind auth; the content set renders; `docs-manifest.json` builds at build
  time; Quick Answers + client search work on desktop + mobile. (Placeholder content only — real content is
  Track C, gated on sign-off.)
- **AC-5 — ENABLED, pending Track C.** The traceability infrastructure exists (matrix maps each behavior →
  edisonformat source + a named passing test); the actual rules-guide claims get authored + traced in Track C.
- **AC-6 — PENDING.** This report is the input; Product Lead records the parity sign-off next.

---

## 6. CI status (green) + hardening

- **Master is green** on the final engineering commit `74761e4` and the docs/CI commits after it
  (`061df5a`, `1e6a239`). Vercel READY (app.zuhayr.io), Fly DEPLOYED (api.zuhayr.io).
- **CI-hardening (`1e6a239`):** the `accuracy` CI job (both the master gate in `deploy.yml` and the PR gate in
  `ci.yml`) now runs the **full parity matrix** (all `*.accuracy.test.ts` + the fixture loader) instead of
  only the baseline 7 — so no audited behavior can silently regress, and new accuracy files are gated
  automatically. Also pinned the card-script base + emsdk for reproducible builds (`4862bcc`).

---

## 7. Track B4 — `/learn` docs surface (shipped) + the schema Track C must satisfy

**Shipped shell** (`07da6e7`→`5fa92a9`): route `/learn` (+ `/rules` alias) behind `RequireAuth`; Home
"Rules & Guides" card repointed; Markdown/MDX renderer; build-time `docs-manifest.json` (vite plugin);
client-side search; Quick Answers Q→anchor index; category nav + prev/next; duel-screen "?" generic slide-in;
responsive. Ships with clearly-marked PLACEHOLDER content only — **real rules content is Track C, gated on
this sign-off** (shipping unverified rules would be a correctness bug).

**Schema Track C content must satisfy** (typed in `packages/contracts/src/docsManifest.ts`):
- **Frontmatter (per `.md`):** `id` (canonical, immutable — grammar `{section}.{group}.{key}`; rule-diffs are
  `rules.diff.01`…`rules.diff.13`, zero-padded, frozen to edisonformat #1–13), `section`
  (`"rules"|"howto"`), `group` (`"primer"|"difference"|"card"|"howto"`), `title`, `slug`, `summary`
  (one sentence — TL;DR + search + future chatbot), `ruleNumber` (differences only, 1–13), optional
  `keywords[]` (card names/concepts), `aliases[]` (old slugs → redirect), `prevId`/`nextId`.
- **Heading anchors:** `## Heading {#immutable-slug}` — the slug is immutable once shipped (headings may be
  reworded; anchors never change). Build validates anchor uniqueness + ID grammar.
- **Quick Answers** (`quickAnswers.ts`): array of `{ question, canonicalId }` where `canonicalId` resolves to
  a page or a heading (`{pageId}#{anchor}`) via the manifest.
- **`docs-manifest.json`:** flat `DocsManifestEntry[]` — `id, url, slug, section, group, title, summary,
  keywords, anchors[{id,text,url}], aliases, ruleNumber?, prevId?, nextId?`.

**Content the docs are authored FROM:** the authoritative reference `docs/working/2026-07-17-edison-rules-reference.md`
(the 13 rule-differences + 36 errata) — NOT the engine — with each claim traced to (a) an edisonformat.com
source and (b) the passing test named in the matrix. **Apply the §4 passcode corrections + carve-out
disclosures.** The 17 carve-outs each become a visible "known table-difference" callout.

---

## 8. Product Lead resume point
1. Review the populated matrix (`docs/working/2026-07-17-parity-matrix.md`) + the RECONCILE list (§4 above).
2. Record the **parity sign-off** (decision record + STATUS update).
3. Adjudicate the RECONCILE items (fix reference data / stock cards / accept substitutes).
4. Start **Track C** — author the docs against the verified matrix + the §7 manifest schema, applying the
   passcode corrections and the 17 carve-out disclosures.

_Working notes + full decision trail: team memory `docs-and-parity-phase.md`,
`/decisions/2026-07-17-parity-audit-scope.md`, `/decisions/2026-07-17-parity-defect-fix-depth.md`._
