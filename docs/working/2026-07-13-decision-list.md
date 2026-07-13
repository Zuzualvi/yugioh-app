# Yu-Gi-Oh Edison App — Consolidated Findings & Decision List

**Date:** 2026-07-13
**Status:** Awaiting CEO decisions. No engineering handoff produced yet (per CEO instruction).
**Prepared by:** Product Lead, from three parallel research slices.

## Full research briefs (the "findings" — read for detail)
- `docs/working/2026-07-13-research-edison-format.md` — Edison format definition, banlist, pool, era rules.
- `docs/working/2026-07-13-research-engine-landscape.md` — engine/data/image ecosystem, architecture, licensing.
- `docs/working/2026-07-13-research-ux-landscape.md` — competitive UX teardown + V1 UX direction.
(Also copied to `/mnt/session/outputs/` for direct access.)

---

## Synthesis (one paragraph)
The reuse path is real and well-trodden. One dominant, community-trusted rules engine
(`ocgcore`/`ygopro-core`, the core behind EDOPro) is explicitly built to run headless and power
servers; its rulings live in reusable Lua card scripts + a SQLite card DB. A production browser
client (Neos, TS/React/WASM) and a TypeScript WebSocket server (EDOpro-server-ts) already do
essentially "reuse the engine, build a new UI" — near-exact templates for us. This satisfies the
founder's hard constraint (self-hosted engine + verified community rulings, no external ruling
calls mid-duel) and lets us spend our effort exactly where the market gap is: **a modern,
responsive, rules-enforcing Edison app whose UI explains *why* a move is or isn't legal — turning
enforcement into a teacher.** No incumbent occupies "polished + enforcing + Edison + good on
mobile" at once; that intersection is empty.

## Edison facts we confirmed/corrected (so we build the right game)
- Edison = the **March 2010 TCG environment** (named after SJC Edison, NJ). Banlist = **March 2010
  TCG Forbidden & Limited List** (one canonical convention; full lists captured in the brief).
- **Card pool correction:** it is *not* "through The Shining Darkness." TSHD is the **first
  excluded** set (it's what *ended* the format). Standard pool runs **up to & including Duelist
  Pack: Kaiba (Apr 20, 2010)**, last Core Booster = **Absolute Powerforce**, with some Hidden
  Arsenal cards carved out. Including TSHD/later = a variant ("Time Travel Edison").
- Mechanics: **Synchro + Tuners IN**; Fusion/Ritual/Gemini/Union/Spirit/Flip in. **Xyz, Pendulum,
  Link OUT.** Simpler board than modern (no Extra Monster Zones / Pendulum scales).
- Era rules an engine must respect (differ from modern): **Ignition-Effect "priority" is IN
  effect**; the **player going first DOES draw on turn 1**; pre-2014 Damage Step timings; pre-2014
  single-Field-Spell behavior. (The reused engine already models these correctly for the era; this
  is mainly a correctness checklist.)
- Legal pool ≈ **4,000–4,500 unique cards** (community estimate; exact count derived programmatically).

---

## DECISIONS THAT NEED YOU
Only calls that change what gets built. Each has the finding + my lightly-held recommendation.

### Decision 1 — Reuse the community engine, and accept its AGPL license?
**Finding.** The trustworthy engine (`edo9300/ygopro-core`) and the irreplaceable card-effect
scripts (`ProjectIgnis/CardScripts`) are **AGPL-3.0**. For a **private, friends-only, self-hosted**
app the burden is minimal — you'd only owe source to your own users (your friends). The real
consequence: it **effectively rules out a future *closed-source* public/commercial product** built
on this engine. (Building our own engine instead = enormous effort, high risk of subtle rules bugs,
and directly against your "don't let AI invent rules" constraint — not recommended. Not legal advice.)
**Recommendation:** **Reuse the engine + scripts + card DB; accept AGPL; keep the project
private.** It's the only sane path to the accuracy you want. If a public/commercial launch ever
becomes a goal, we revisit then (it would be a licensing + Konami-IP conversation, not a code
rewrite decision made now).

### Decision 2 — Lock the exact Edison legal-pool definition.
**Finding.** Your group's source, **edisonformat.net**, defines the pool as "through Duelist Pack:
Kaiba, minus some Hidden Arsenal cards," on the March 2010 banlist. A common shorthand elsewhere is
"through Absolute Powerforce" — the two differ only by DPKB's reprints + Malefic Blue-Eyes White
Dragon. The exact machine-readable legal list + the enumerated Hidden Arsenal exclusions need to be
pulled and **frozen as a reviewed allow-list** (edisonformat.net renders its lists in JavaScript, so
this is a deliberate build step, not a copy-paste).
**Recommendation:** **Follow edisonformat.net exactly** (it's your group's source of truth):
standard Edison, through DPKB, TSHD and later excluded, March 2010 TCG banlist. We build a frozen
card allow-list and **have you/the group sign off on it** before it's locked. Confirm this is the
convention you play — and whether you ever want a "Time Travel"/extended pool toggle later (I'd say
not in V1).

### Decision 3 — Is the "why is this move illegal?" explanation in V1, or V2?
**Finding.** Every enforcing app today enforces *silently* — illegal moves just don't work, no
reason given (Master Duel only started adding "can't-activate" hints in mid-2025). Our UX team's
signature idea is: show disabled actions and, on tap, give a **plain-language reason** deep-linked
to the rules page. This is the seam your V2 chatbot plugs into. **Caveat:** the engine tells us
*what's legal* but does **not** emit a rich *why-not* reason, so this requires a thin
"reason-mapping" layer we build ourselves — real, bounded work.
**Recommendation:** You explicitly parked *teaching* for V2, so the honest options are:
  - **(a) Pure enforcement in V1** — clean, legal-move-surfacing UI, but "why" waits for V2. Smallest build.
  - **(b) Light "why" in V1** — surface disabled actions + a basic reason where the engine makes it
    cheap, deep-linked to the static rules page; rich explanations + chatbot in V2.
  I lean **(b)**: it's the single thing that differentiates us, the enforcing engine already computes
  legality, and it directly serves your "don't get surprised by a judge" goal — but it does add scope,
  so it's your call on whether V1 carries it or stays pure-enforcement.

---

## FYIs / lighter confirmations (not blocking; flag only if you disagree)
- **Architecture (team recommendation, CTO to finalize):** run the native engine **server-side**,
  browsers talk to it over WebSockets, **server holds authoritative state** (so a client can never
  see the opponent's hand). This means a **small always-on server** to host — trivial cost/effort
  for a handful of friends, but it's not a pure static site. Flag if you'd rather avoid running any
  server. (WASM-in-browser is reserved for a future offline/AI-practice mode.)
- **Data/images:** one-time bulk pull from the YGOPRODeck API, filtered to the Edison allow-list,
  then **self-hosted** (their terms require storing data + images locally — fits your no-external-
  calls constraint perfectly).
- A few small rules-config items (e.g., side deck "0–15 vs exactly 15", exact damage-step/SEGOC
  timing tables) are **non-blocking** and will be resolved in the engineering spec.

## Recommended de-risking spikes (before committing to a full build)
0. **Licensing sign-off** (Decision 1). 1. **Headless duel end-to-end** — prove the engine
integrates and we can read its message stream. 2. **Edison dataset build** — the frozen allow-list +
banlist + self-hosted metadata/images. 3. **Two-client relay** with correct hidden-info redaction.

## Non-blocking open questions (carried into the handoff, not needed to proceed)
- Exact enumerated Hidden Arsenal (and other "printed-but-not-legal") exclusions — resolved during dataset build.
- Whether the reused engine exposes enough to power the "why?" layer cheaply, or needs the mapping layer (scope in Spike 1).
- Card-art quality/legibility at mobile sizes.
