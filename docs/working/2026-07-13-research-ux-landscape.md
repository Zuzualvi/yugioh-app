# UX Landscape & Direction Brief — Yu-Gi-Oh (Edison) Duel App

**Author:** UX/UI (subagent)  ·  **Date:** 2026-07-13  ·  **Status:** direction doc, not final mockups
**Audience for this doc:** product/eng team + CEO decision meeting.
**Scope reminder:** browser-based, responsive (desktop + mobile), rules-*enforcing* 1v1 duels, deck builder over the Edison-legal pool, static rules/rulings reference, closed private group. Native app and the V2 in-duel "why?" chatbot are out of scope but must not be designed *out*.

---

## How to read this
Part A tears down the six incumbents through a UX lens (board, deck builder, mobile) and isolates the gap we can own. Part B proposes principles and a wireframe-level screen inventory for V1, with the mobile card-field problem treated head-on. Every recommendation is tied to a *user outcome*, not taste. Sources are listed at the bottom; anything I couldn't verify live is flagged in "Confidence & open questions."

**The one-sentence thesis:** *Every existing app makes the player think about the simulator; none make the player think about the game.* Our wedge is a UI that surfaces exactly the legal moves, explains why the illegal ones are greyed out, and does it beautifully on a phone — for a format none of the polished apps support.

---

# PART A — Competitive UX Teardown

Two axes matter for positioning:

- **Automation:** does the app *enforce* rules (you cannot make an illegal move) or is it a *manual* tabletop (you move cards yourself, honor system)?
- **UI vintage:** modern/responsive vs. dated desktop-era.

| App | Enforces rules? | Platform | UI vintage | Edison support |
|---|---|---|---|---|
| Master Duel | Yes (auto) | Native (PC/console/mobile) | Modern, heavy, console-style | No (modern game only) |
| Duelingbook | **No (manual)** | Browser | Dated, "janky" | Yes (banlist/cardpool configurable) |
| EDOPro / Project Ignis | Yes (auto) | Desktop + Android/iOS build | Dated (Irrlicht game engine) | Yes (community lists) |
| Dueling Nexus | Yes (auto) | Browser (desktop + mobile) | Functional, mid-2010s web | Yes (Edison filter) |
| YGO Omega | Yes + manual mode | Desktop + mobile | Sleeker than EDOPro, still client | Yes (custom lists) |
| edisonformat.net deckbuilder | n/a (builder only) | Web (desktop only) | Utilitarian | **Edison-native** |

The table already tells the story: the *polished, rules-enforcing* option (Master Duel) doesn't do Edison; the *Edison-capable* options are either manual (Duelingbook) or wear dated client UIs (EDOPro, Omega, Nexus). **Nobody offers polished + enforcing + Edison + good-on-mobile.** That intersection is empty. That's us.

---

## A1. Konami Master Duel — the polished bar we're measured against

**What it is:** Konami's official automatic simulator, the "definitive edition" of the competitive game, free-to-play with gacha monetization, available across PC, console, and mobile (iOS/Android). It is the *only* incumbent with genuinely modern production values, and it is explicitly the game whose UI the CEO admires but whose *format* (modern-only: Synchro/Xyz/Pendulum/Link) rules it out for us.

**(i) Duel field/board.** Strong, console-first presentation: 3D animated summons, cut-ins, dramatic camera. Critically for us, Konami has *recently* been retrofitting clarity features that validate our thesis:
- The July 2025 update added **card-status icons** — when a card's effect *cannot* be activated, an icon now indicates its status, rather than the card simply doing nothing. It also added **pinnable info panels** (the card-detail panel can be kept open instead of auto-closing). This is Konami admitting the field alone doesn't communicate *why* an action is unavailable — exactly the problem we intend to solve natively.
- Chains/priority are handled with modal prompts and a chain-link readout, but the flow is widely felt to be *fast and unforgiving* — new/returning players struggle to follow *what just happened* and *why*.

**Weaknesses / what feels dated (for our purpose):** it's a heavy native download (multi-GB; ~11 GB PC / ~3 GB mobile per one 2025 update), console-paced, and optimized for spectacle over comprehension. There is no honest "explain this interaction" layer — the animation *is* the explanation, which fails a learner. And none of it helps Edison players: the entire card pool, ruleset, and board (extra-monster zones, Links) is modern.

**Takeaways for us:** match its *legibility and polish*, not its spectacle. Steal the recent "status icon + pinnable card detail" ideas and make them first-class from day one. Reject the heaviness — we are a lightweight web app.

## A2. Duelingbook — the format community's default, and its UX ceiling

**What it is:** a browser-based YGO simulator, the de-facto home of retro/alternative formats (Edison players use it heavily). Crucially it is a **manual** simulator: it does *not* enforce rules — players move their own cards, and social norms + a visible log keep everyone honest.

**(i) Duel field/board.** A flat 2D top-down mat. Because nothing is enforced, the interface exposes *everything*: right-click menus with long action lists, and a large surface of **chat/slash commands** (`/calc` for life-point math, `/ex`/`/excavate` to dig cards, etc.). The board is information-dense and the interaction model is "you are the rules engine." Power users are fast; newcomers are lost.

**(ii) Deck builder.** Serviceable: room/deck setup exposes real format controls — **banlist/cardpool selection, "cards must be TCG/OCG legal," release-date windows, and deck-check toggles** — which is more format-aware than most. But the builder UI is cramped and dated.

**(iii) Mobile/responsive.** Weak. It's a desktop-mouse paradigm (right-click menus, drag, tiny hit targets) shoe-horned into a browser; a healthy third-party ecosystem (e.g. "DuelingBook Enhanced," "Dueling Book Unlock") exists *specifically* to paper over the base UI with hotkeys, dark mode, and a less "janky menu" — a loud signal that the native UX is the weak point.

**Takeaways for us:** Duelingbook proves the *demand* (retro-format players are here because nothing better exists) and simultaneously proves the *opportunity*: it is manual, dated, and desktop-bound. Our enforcing engine removes the entire class of "did they do that legally?" friction, and our job is to make the *reduced* action set beautiful rather than exposing the full manual toolbox.

## A3. EDOPro / Project Ignis — the accuracy benchmark, wearing a game-engine UI

**What it is:** the leading open-source *automatic* simulator (ocgcore rules engine + Lua card scripts), current release line 41.x ("Bagooska"), on Windows/Mac/Linux with Android APKs and an iOS build in-tree. This is almost certainly the engine we reuse for correctness — so it's our *rules floor*, and the CEO's complaint about it is explicitly **the UI, not the accuracy**.

**(i) Duel field/board.** Rendered in the Irrlicht 3D game engine. Functional and complete — it correctly walks chains, priority windows, targeting prompts, phase transitions — but it looks and feels like a 2013 desktop game: dense toolbars, small type, modal dialog stacks, skinnable only via XML. It communicates *state* accurately but not *intuitively*; it assumes you already know the rules.

**(ii) Deck builder.** Powerful and complete (full pool, test-hand, custom banlists), but the layout is utilitarian and steep for anyone who isn't already an EDOPro native.

**(iii) Mobile/responsive.** An Android APK (and iOS build) exists, but it's the desktop UI ported onto a touchscreen, not a responsive design — small controls, no touch-first rethink. Multiplayer invites lean on **Discord** rather than an in-app flow.

**Takeaways for us:** this is the clearest statement of our whole project. The engine is right; the presentation is where we win. Everything the EDOPro UI does with cramped toolbars and modal stacks, we re-express as a clean, touch-first, explain-itself web UI. We can also treat EDOPro's prompt *taxonomy* (what kinds of decisions the engine asks the player to make) as a spec for the prompts our UI must render.

## A4. Dueling Nexus — the closest thing to "browser + enforcing + responsive"

**What it is:** a free browser-based *automatic* simulator with all cards unlocked. It's the incumbent nearest our technical shape: **runs in the browser, enforces rules ("impossible to make an invalid move"), and explicitly supports mobile browsers (Chrome/Safari)**, plus AI (Nyx), ranked/unranked, replays, and a custom-card maker.

**(i) Duel field/board.** Clean-ish 2D web board, enforcement handled automatically. It's the most "web-native" duel field of the enforcing crowd, but visually it's mid-2010s web — flat, generic, limited feedback on *why* something can/can't be done. It tells you what's legal by only letting you do legal things; it doesn't *teach*.

**(ii) Deck builder.** Genuinely strong and the feature we should study most: a search bar + **extensive filters (card pool, banlist, type, monster Type, Attribute, Ability, effect text, ATK/DEF, release date, OCG/TCG)**, drag-to-add, `.ydk` import/export, per-card detail (alt arts, sets), and public/link/private deck sharing. Banlists (incl. historical) are supported. This is the deck-builder bar to beat.

**(iii) Mobile/responsive.** Officially supported on modern mobile browsers — but "runs on mobile" is not "designed for mobile." Reports frame it as playable-on-mobile rather than mobile-first, and the recommended experience is still a real computer.

**Takeaways for us:** Nexus proves the architecture is viable (enforcing rules engine in a browser, on phones). Our differentiation over Nexus is (a) *design quality and mobile-first layout*, (b) an *explain-why* layer instead of silent enforcement, and (c) Edison focus. Its deck builder is the reference standard for filtering/preview.

## A5. YGO Omega — enforcing *and* manual, sleeker client, still a download

**What it is:** Duelists Unite's simulator, notable for supporting **both automatic and full-manual play**, all cards free, on Windows/Linux/Mac/Android/iOS, with Swiss-tournament/ranking systems and cosmetic themes.

**(i) Duel field/board.** More modern-feeling than EDOPro, and the auto/manual toggle is a genuinely smart idea — automation for convenience, manual for edge cases the engine can't express. Still fundamentally a downloadable client's board, not a responsive web layout.

**(ii) Deck builder.** Full-pool builder with custom/community banlists; competent, client-style.

**(iii) Mobile/responsive.** Mobile builds exist but, again, it's a client experience rather than a responsive-web one.

**Takeaways for us:** the auto+manual duality is worth noting philosophically — but for a *teaching* app targeting in-person-tournament readiness, we should stay firmly **enforcing** (manual escape hatches undermine the "learn the real rules" outcome). Omega mostly reinforces that "download a client" is the norm we're breaking by being web-first.

## A6. edisonformat.net deckbuilder — Edison-native, desktop-only

**What it is:** the community's Edison-specific builder — **search the Edison banlist, preview rulings and stats, export to Duel(ingbook)**. It's the closest thing to a purpose-built Edison tool and a likely data cross-reference for our legality rules (Edison = March 2010 banlist; pool through ~Duelist Pack: Kaiba / early 2010).

**(ii) Deck builder.** Format-correct and ruling-aware (its edge: it knows Edison legality and shows rulings), but visually utilitarian — a filter panel + results grid + list.

**(iii) Mobile/responsive.** **Explicitly not available on mobile** — the site itself says "Deckbuilder not available on mobile" and offers a separate cut-down "Mobile Deckbuilder." This is a concrete, verifiable example of the exact gap we're filling: even the *Edison-native* tool gives up on phones.

**Takeaways for us:** we can be strictly better by being *one* responsive builder that is Edison-correct, ruling-aware, and equally good on phone and desktop. Its ruling-preview feature is a nice-to-borrow that also seeds our teaching angle.

---

## A7. Synthesis — where the incumbents leave the door open

Patterns across all six:

1. **Silent enforcement, no explanation.** The enforcing apps prevent illegal moves by simply not letting you make them — the card does nothing, no reason given. Even Master Duel only *recently* (mid-2025) added icons hinting *why* an effect can't activate. **None explain the "why" in plain language.** For a group whose stated goal is to *not get surprised by a judge in person*, this silence is the single biggest miss.
2. **Manual vs. dated is a false choice.** Today an Edison player picks Duelingbook (manual, honor-system, dated) or a dated enforcing client. Modern + enforcing + Edison doesn't exist.
3. **Mobile is an afterthought everywhere.** The best-case is "runs in a mobile browser" (Nexus); the Edison-native builder outright refuses mobile. A truly mobile-first 1v1 field is unclaimed territory.
4. **Deck builders are the most mature surface.** Nexus and edisonformat.net set a real bar for filtering, preview, and legality. We must meet it — but with our responsive, banlist-visualized-live twist.
5. **Onboarding to *a specific duel with a specific friend* is clunky.** EDOPro leans on Discord; the big apps optimize for matchmaking/ranked ladders we don't need. A dead-simple "challenge your friend" flow is both easy for us and neglected by everyone else (because their audience is anonymous ranked play; ours is six friends).

**The gap we win on:** *a modern, responsive, browser-based, rules-**enforcing** Edison duel app whose field explains **why** every action is or isn't legal — turning the enforced ruleset from a cage into a teacher.*

---

# PART B — UX Principles & Proposed V1 Screen Inventory

## B0. North-star principles (each earns its place by a user outcome)

1. **Surface legal actions; don't make the player hunt.** The engine knows every legal move. The UI's #1 job is to *show* them. *Outcome:* the player thinks about strategy, never about "can I even do this?"
2. **Every "no" comes with a "why."** Illegal/unavailable actions are visible but disabled, and one tap reveals a plain-language reason ("Can't activate: it's your opponent's turn and this is a Normal Spell"). *Outcome:* players learn the real rules and aren't blindsided by a judge in person. *This is the seam the V2 chatbot plugs into — same data, richer explanation.*
3. **The board always answers three questions at a glance: Whose turn/phase? What's the score? What is the game waiting on *me* for?** *Outcome:* no lost players, no "wait, was I supposed to do something?"
4. **One mental model across devices.** Same layout logic, screen down to phone; tap-first everywhere (drag optional, never required). *Outcome:* a friend on a couch with a phone and a friend at a desk have the same competence.
5. **Reading the card is sacred.** Any card, any zone, one tap → large, legible full text. Dense Yu-Gi-Oh text is the game's core information; never trap it behind a hover or a squint. *Outcome:* decisions are made on real information.
6. **Don't design out the future.** Reserve space/data for the V2 "why did that happen?" chatbot and a later native app; don't build features that assume ranked ladders or gacha we'll never have.

---

## B1. V1 Screen inventory (the whole app, at a glance)

1. **Login** — closed-group auth (email/passcode or invite link). Minimal.
2. **Home / Lobby** — "Duel a friend," "Build a deck," "Rules & rulings." Shows who's online in the group + any pending challenges.
3. **Invite / Challenge flow** — pick a friend (or share a link) + pick which of your decks → creates a duel room.
4. **Duel Room / pre-duel** — both players' ready state, deck selected, coin toss / who-goes-first, then Start.
5. **Duel Field** — the core screen (B2–B5). Desktop and mobile variants.
6. **Card Inspector** — full-screen/overlay card detail with rulings (reused by builder, field, and rules page).
7. **Deck Builder** — search/filter, live legality, deck stats/validation (B6).
8. **My Decks** — list/manage/duplicate/import-export decklists.
9. **Rules & Rulings Reference** — static, standalone, searchable (B8).
10. **Duel Summary / Log replay** — post-duel recap + reviewable action log (also the teaching artifact).
11. **Settings/Profile** — display name, card-back/theme, accessibility toggles (text size, reduced motion, colorblind-safe).

---

## B2. The Duel Field — desktop layout

Edison's board is *simpler* than modern YGO (no Xyz/Pendulum/Link, so no Extra Monster Zones or Pendulum scales) — 5 Monster Zones, 5 Spell/Trap Zones, Field Spell, Deck, Extra Deck (Fusion/Synchro), Graveyard, Banish per player. We should exploit that simplicity for breathing room and readability rather than cram.

```
┌───────────────────────────────────────────────────────────────────────┐
│  OPPONENT  ● Alex        LP ▓▓▓▓▓▓▓░░ 5400        Hand: 🂠🂠🂠🂠 (4)      │  ← opponent id, LP bar+number, hand count
│                                                                         │
│   [GY] [Ban]   [ M ][ M ][ M ][ M ][ M ]              [Extra] [Deck]     │  ← opponent back row mirrored
│   [Field]      [S/T][S/T][S/T][S/T][S/T]                                 │
│─────────────────────────  ⚔ BATTLE (opp)  ───────────────────────────  │  ← center: phase/turn ribbon
│   [Deck][Extra]      [S/T][S/T][S/T][S/T][S/T]              [Field]      │  ← YOUR field (nearest you)
│                      [ M ][ M ][ M ][ M ][ M ]              [GY][Ban]    │
│                                                                         │
│  YOU  ● you              LP ▓▓▓▓▓▓▓▓▓ 8000                               │
│                                                                         │
│   ┌─ YOUR HAND ───────────────────────────────────────────────────┐    │
│   │  [card] [card] [card•] [card] [card]                           │    │  ← • = has a legal action now (glow/dot)
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  [ PHASE BAR:  DP → SP → MP1 → BP → MP2 → EP ]        [ End Turn ▸ ]     │  ← always-visible phase rail
└───────────────────────────────────────────────────────────────────────┘
```

Design decisions and their outcomes:

- **Your half is always nearest you, opponent's mirrored across a center ribbon.** Matches the physical tabletop mental model. *Outcome:* zero re-orientation cost.
- **Persistent phase rail** with the current phase highlighted and the phases you *can* advance to enabled. The single most common "what do I do now?" question is "what phase am I in and how do I move on?" — answer it permanently, not in a menu. *Outcome:* turn structure is learned passively.
- **Turn/phase ribbon in the dead center** states whose turn + phase in words ("Your Main Phase 1"). *Outcome:* principle #3, always answerable.
- **LP as bar *and* number**, with animated deltas ("–1800" floats up, bar drains). LP swings are the scoreboard and the drama; make them impossible to miss and easy to audit. *Outcome:* players always know the stakes; damage math is legible for learning.
- **Actionable cards are marked** (a subtle glow/corner dot) whenever they have ≥1 legal action *right now*. This is the literal implementation of principle #1: the board points at your options. *Outcome:* no pixel-hunting; strategy over mechanics.
- **Hand is a distinct tray**, cards fanned and readable; the opponent's hand is a face-down count only.

## B3. Communicating legal vs. illegal — the mechanic that defines us

Three visual states for any card/zone/action:

- **Available:** normal, with the "actionable" marker if it can do something this instant.
- **Unavailable-now:** visible but dimmed/greyed. *Not hidden.* Seeing a disabled option is itself information ("this Trap exists but can't fire yet").
- **Illegal-target / blocked:** during a targeting or placement step, invalid destinations are clearly non-highlighted while valid ones pulse.

**The "why" affordance (our signature):** tapping/long-pressing any dimmed card or a small "ⓘ why?" chip shows a one-line, plain-language reason:

```
   ┌─────────────────────────────────────────────┐
   │  Mirror Force — can't activate right now      │
   │  ⓘ  Reason: Trap Cards can't be activated the │
   │     turn you Set them. Set this turn.         │
   │                              [ Got it ]  [?]  │
   └─────────────────────────────────────────────┘
```

Why this matters and why it's low-risk to build: **the enforcing engine already computes legality** — to grey the card out at all, it evaluated a rule and a reason. We surface that reason instead of discarding it. *Outcome:* the enforced ruleset becomes a teacher; players arrive at in-person tournaments already understanding *why*, not just *what*. The `[?]` deep-links to the relevant Rules page section (B8); in V2 the same chip opens the chatbot with full game context pre-loaded. **Design note:** define a stable "reason code + human string + rules-anchor" contract now so the engine, the tooltip, the rules page, and the future chatbot all read one source. Flag for eng: EDOPro's core surfaces *hints/decision types* but not always rich denial reasons — we may need a thin reason-mapping layer. (See open questions.)

## B4. Chains, priority & prompts — the highest-stakes moment for clarity

Chains are where Yu-Gi-Oh confuses everyone and where the enforcing engine earns its keep. The UI must slow *down* here (opposite of Master Duel's pace) without feeling sluggish.

- **Priority prompt** is an unmissable but non-blocking-of-context bar: *"You have priority — respond, or pass?"* with **[Activate…] [Pass]** and a countdown only if we ever add timers (not V1). The board stays visible behind it. *Outcome:* players never accidentally pass on a response they wanted, a classic frustration.
- **Chain builder / stack visualization:** as links are added, show a vertical stack (Link 1 at bottom → resolves last, top resolves first), each link a mini card + owner color.

```
   RESPONDING?  Opponent activated Bottomless Trap Hole.
   ┌── CHAIN ──────────────┐
   │ CL2  [Your card?]  ▲  │   ← you may add CL2
   │ CL1  Bottomless (Alex)│
   └───────────────────────┘
   [ Add to chain… ]   [ Let it resolve ▸ ]
```

- **Resolution playback:** resolve top-down with a brief highlight per link and a plain caption ("Resolving Link 1: Bottomless — banish the summoned monster"). *Outcome:* the player sees *the order things happen*, which is the single most-misunderstood rule in the game and the thing judges correct people on.
- **Targeting** uses the same valid-target pulse from B3.
- Every prompt is phrased as the *question the engine is asking* ("Select a target," "Respond to this activation?"), never as raw engine state. *Outcome:* principle #3 at the decision level.

## B5. The Duel Field — mobile (the hard problem, addressed directly)

A 2-player, ~24-zone board on a 375-px-wide phone is the central UX risk of V1. Cramming both full fields at readable size is impossible; so we **don't**. Strategy:

**(a) Portrait, "your-field-first" vertical stack — you never zoom to act.**
Your half of the board gets the bottom ~60% of the screen at full size. The opponent's half is compressed into a **status strip** at the top (their LP, hand count, and *thumbnail* zone row) that expands to full detail on tap. Rationale: 90% of the time you act on *your* board and only *read* the opponent's. Optimize the common case; make the rare case one tap away.

```
┌───────────────────────┐
│ Alex  LP 5400  ✋4  ▾  │  ← opp status strip (tap ▾ = expand opp board)
│ [m][m][m][m][m] mini   │
│ [s][s][s][s][s] mini   │
├───────────────────────┤
│  ⚔  YOUR MAIN 1        │  ← turn/phase ribbon
├───────────────────────┤
│ [S/T][S/T][S/T][S/T][S]│  ← YOUR board, full size, tap targets ≥44px
│ [ M ][ M ][ M ][ M ][M]│
│ GY  Ban   Field  Deck  │
├───────────────────────┤
│  YOUR HAND  (swipe →)  │  ← horizontally scrollable fan
│  [card][card][card•]   │
├───────────────────────┤
│ ◀ DP SP [MP1] BP MP2 EP│  ← compact phase rail
│           [ End Turn ▸]│
└───────────────────────┘
```

**(b) Tap-to-select, never drag-required.** Drag is fragile on touch (scroll conflicts, fat-finger drops) and impossible one-handed. Model: **tap a card → a radial/sheet of its legal actions appears → tap the action → tap the destination (which pulses).** Every action is 2–3 taps, all forgiving, all cancelable. *Outcome:* full play on a phone with one thumb; no dexterity tax. (Drag *may* be offered as an optional accelerator on desktop, but nothing requires it.)

```
   Tap a hand card →
   ┌───────────────┐
   │  Stardust…    │
   │ ▸ Summon      │
   │ ▸ Set         │
   │ ▸ Activate    │
   │ ⓘ Why not …?  │  ← greyed actions still listed, with reason
   │ ✕ Cancel      │
   └───────────────┘
```

**(c) Inspect/zoom is a dedicated, deliberate gesture** — tap the card's art (not its action zone) or long-press → full-screen Card Inspector with full text + rulings. Separating "inspect" from "act" prevents the Duelingbook problem where every touch risks doing something. *Outcome:* you can always read a card without fear of triggering it.

**(d) Landscape offered, not required.** Landscape can show a scaled-down both-fields view for players who want the "tabletop" feel, but portrait one-field-first is the primary, because phones are held portrait and duels are long. *Outcome:* comfort over a multi-turn game.

**(e) Responsive tiers (one layout system, three densities):** phone-portrait (your-field-first, strip for opp) → tablet/small-laptop (both fields, condensed) → desktop (B2 full). Same components, same interaction grammar, reflowed. *Outcome:* principle #4 — one mental model everywhere.

## B6. Deck Builder

Meets the Nexus/edisonformat bar, then beats it on *live legality visualization* and responsiveness.

```
┌──────────────── DECK BUILDER ──────────────────────────────────────────┐
│  Search [ blackwing            ]   Filters ▾                            │
│  ┌ Filters ────────────┐   ┌ RESULTS (grid) ─────────────┐  ┌ DECK ───┐ │
│  │ Card pool: Edison ✓ │   │ [c][c][c][c]               │  │ Main 39 │ │
│  │ Type: Monster/S/T   │   │ [c][c][c][c]               │  │ ▓ valid │ │
│  │ Attribute / Level   │   │ [c🚫][c①][c][c]            │  │ Extra 12│ │
│  │ ATK/DEF range       │   │  ↑forbidden ↑limited badge │  │ Side  8 │ │
│  │ Effect text search  │   │                            │  │─────────│ │
│  │ Banlist status      │   │                            │  │ Curve▁▂▅│ │
│  └─────────────────────┘   └────────────────────────────┘  └─────────┘ │
│  Selected: Blackwing - Gale ①  "You already have the 1 copy allowed."   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Legality is *visualized as you build*, not validated at the end.** Each card carries a persistent banlist badge — 🚫 Forbidden, ① Limited (max 1), ② Semi-Limited (max 2), or clean for 3-copy legal. When you've hit a card's max, further copies grey out with the reason inline. Out-of-Edison-pool cards are filtered out by default (with a visible "Edison pool" toggle so it's a *choice*, not a mystery). *Outcome:* you cannot accidentally build an illegal deck, and you learn the banlist by seeing it — same teach-by-enforcement philosophy as the field.
- **Three deck bins (Main 40–60, Extra ≤15, Side ≤15)** with live counts and a validity chip. Edison-specific: Extra Deck holds Fusion + Synchro only (no Xyz/Link), so the Extra bin is simpler — reflect that, don't show modern categories.
- **Deck stats:** monster/spell/trap split, level/attribute curve, tuner count (Synchro-relevant), copies-at-limit list. *Outcome:* fast sanity-checking of a build.
- **Card preview / Inspector** on tap: full text + Edison rulings (borrowing edisonformat.net's ruling-preview). Ties the builder into the same teaching spine.
- **Filters** match the Nexus standard (pool, banlist, type, monster Type, attribute, level, ATK/DEF, effect-text search) — the proven set.
- **Mobile builder:** this is where edisonformat.net *gives up*; we won't. Search + filters collapse into a top sheet; results grid becomes 3-across tappable tiles; the deck is a bottom sheet you can peek/expand; tap a result to add, tap a deck card to remove. Being genuinely usable on a phone here is a concrete, checkable win over the Edison-native incumbent.

## B7. Login, Lobby & Invite-a-Friend (right-sized for six people)

The big apps optimize for anonymous matchmaking and ranked ladders. **We have a closed group of friends** — so the flow should feel like a group chat that starts duels, not a competitive queue.

- **Login:** minimal — email + passcode, or a one-time invite link the founder sends. No account discovery, no social graph. *Outcome:* friends get in without ceremony; strangers don't get in at all.
- **Home/Lobby:** three primary actions — **Duel a friend · Build a deck · Rules & rulings** — plus a small "who's online" list of the group and any **pending challenges**. *Outcome:* the two things people actually come to do (play a friend, tweak a deck) are one tap from landing.
- **Challenge flow:** pick a friend from the group (or **copy an invite link** to drop in your group chat) → pick which of your decks → send. They get a prompt: *"Alex challenges you — Accept / Decline,"* pick their deck, and you're in the Duel Room. *Outcome:* "let's duel right now" takes seconds and needs no external tool (vs. EDOPro's Discord-dependency).
- **Duel Room:** shows both players ready-state + chosen deck, a first-turn decision (coin/dice), then **Start**. Optional lightweight text chat (friends will want to talk trash). *Outcome:* the social ritual of starting a game is preserved.

## B8. Rules & Rulings Reference (standalone + the teaching backbone)

- A **searchable, sectioned static reference** covering the game *through Edison* — turn structure/phases, summon types (incl. Synchro/Tuners), chains & priority/SEGOC, card types, and Edison-specific banlist + notable rulings. Readable entirely on its own (principle: a friend can bookmark it and learn without ever opening a duel).
- **Deep-linkable anchors** so the field's `[?]` chips and the builder's badges jump straight to the relevant rule. *Outcome:* the reference isn't a separate silo — it's the explanation layer the whole app points into, and the exact surface the V2 chatbot will summarize/converse over.
- Mobile: collapsible sections, sticky search, large type. Dense rules text has the same readability duty as card text.

## B9. Readability & accessibility (non-negotiable, because card text *is* the game)

- **Two-tier card rendering:** at board size, show art + name + key stats (ATK/DEF/Level/Attribute) legibly; never rely on the player reading full effect text at zone size. Full text lives one deliberate tap away in the Inspector. *Outcome:* no squinting to make decisions.
- **Minimum tap target 44px; minimum body text ~16px on mobile.** Type scale honors the OS/browser text-size setting.
- **Don't encode meaning in color alone:** banlist status, ownership (you vs. opponent), and legal/illegal all pair color with an icon/shape/label. *Outcome:* colorblind-safe (≈8% of men).
- **Reduced-motion setting** that keeps LP/chain feedback informative without animation, for vestibular sensitivity and low-end phones.
- **Contrast/dark mode:** the community reaches for dark-mode extensions on incumbents; ship a good dark theme natively.

## B10. Deliberately deferred (so we don't over-build V1)

- V2 "why did that happen?" chatbot — but B3/B8's reason-code contract is built now so it drops in cleanly.
- Native mobile app — responsive web must be excellent first; keep layout logic portable.
- AI opponent, ranked/matchmaking, spectating, tournaments, cosmetics/gacha — none serve six friends playing each other; skip entirely for V1.

---

## Confidence & open questions

**High confidence (verified live, 2026-07-13):**
- Master Duel is modern-game-only and, in its **July 2025 (v2.4.0)** update, added *card-status icons for effects that can't be activated* and *pinnable info panels* — direct evidence that "explain why" is an unmet need even Konami is only now patching. [MD-App-Store, MD-Meta-Jul2025]
- Duelingbook is a **manual** (non-enforcing) browser simulator with slash-commands and format/cardpool room settings; a third-party enhancement ecosystem exists to fix its dated UX. [DB, DB-Enhanced]
- EDOPro/Project Ignis is the open-source **enforcing** engine (ocgcore), current line **41.x "Bagooska,"** Irrlicht-based desktop UI + Android/iOS builds, Discord-based invites. [Ignis, EDOPro-GH, EDOPro-DeepWiki, Ignis-Distribution]
- Dueling Nexus is a **browser, enforcing, mobile-browser-supported** simulator with a strong filter-rich deck builder and banlists. [DNX-builder, DNX-browsercraft]
- YGO Omega supports **auto + manual** play across desktop/mobile, all cards free. [Omega, Omega-Informer]
- The **edisonformat.net deckbuilder** is Edison-native, ruling-aware, and **explicitly not available on mobile** (separate cut-down mobile builder). Edison = **March 2010 banlist**, pool through ~Duelist Pack: Kaiba. [Edison-DB, Edison-Banlist]

**Medium confidence / not directly verified this session:**
- Exact *current* in-duel feel of each app (I did not run live sessions here); board/interaction descriptions lean on my prior knowledge plus these sources. Screenshots/live walkthroughs would sharpen A1–A5 before we finalize visual targets.
- Whether Nexus/Omega have quietly improved mobile layouts recently — I verified *support*, not layout quality. Treat "mobile is an afterthought" as strongly-indicated, not lab-tested.

**Open questions for eng / product (affect UX feasibility):**
1. **Does our chosen engine (likely EDOPro/ocgcore) expose a machine-readable *reason* for every denied/greyed action, or only the decision-request/hint types?** B3's "why?" chip is our signature; if the core only says *what's askable* and not *why-not*, we need a thin reason-mapping layer (rule-anchor + human string). This is the biggest UX-blocking unknown. **Recommend the CTO scope this early.**
2. **Card image licensing/quality** — the Inspector and board both depend on clean, legible card art at multiple sizes. What's our image source and can we render crisp text-legible cards on hi-dpi phones?
3. **Latency model for chains/priority** over remote 1v1 — how long can a priority prompt wait, and do we want (later) a soft timer? V1 assumes no timer (friends), but the prompt UI should leave room for one.
4. **Reason-code contract ownership** — who owns the shared map of {engine reason → human string → rules-page anchor} that the field, builder, rules page, and future chatbot all consume? Recommend it live with the rules-reference content, versioned alongside the banlist.

---

## Sources
- Master Duel — App Store / Google Play update notes: https://apps.apple.com/us/app/yu-gi-oh-master-duel/id1554247785 · https://play.google.com/store/apps/details?id=jp.konami.masterduel
- Master Duel Meta, July 2025 (v2.4.0) update — card status icons, pinnable info: https://www.masterduelmeta.com/articles/news/july-30-2025/master-duel-update
- Master Duel official (platforms, modern summon methods): https://www.konami.com/yugioh/masterduel/us/en/
- Duelingbook: https://www.duelingbook.com/ · https://www.duelingbook.com/deck
- DuelingBook Enhanced / Unlock (third-party UX fixes): https://chromewebstore.google.com/detail/duelingbookenhanced/hccoembadcmbnmldjjiijababfoppcel
- Project Ignis / EDOPro: https://projectignis.github.io/ · https://github.com/edo9300/edopro · https://deepwiki.com/edo9300/edopro (v41.x "Bagooska") · https://github.com/ProjectIgnis/Distribution (Discord invites)
- Dueling Nexus deck builder & platform support: https://duelingnexus.com/blog/yugioh-deck-builder/ · https://browsercraft.com/game/dueling-nexus
- YGO Omega: https://omega.duelistsunite.org/ · https://ygo-omega.software.informer.com/
- edisonformat.net deckbuilder (mobile-not-supported) & banlist: https://edisonformat.net/deckbuilder · https://edisonformat.net/rules/banlist
- Format Library (Edison overview): https://www.formatlibrary.com/formats/edison
