# User Documentation — Information Architecture & In-App Presentation

**Author:** UX/UI (subagent) · **Date:** 2026-07-17 · **Status:** wireframe-level build handoff (shell is implementable from this)
**Scope:** IA + in-app placement + wireframes for a NEW two-part docs section. **Not** the content — that is written separately and slots into this shell.
**Builds on & matches fidelity of:** `docs/working/2026-07-13-v1-ux-flows.md` (the house UX spec — same wireframe grammar, same §0 conventions, same accessibility bar). This document is the docs-section analogue of that file.
**Grounded in the live app:** `packages/web/src` — routing in `App.tsx`; screen patterns in `screens/*.tsx`; design tokens in `styles/global.css`; the existing (stub) **"Rules & rulings" `ActionCard`** on `HomeScreen.tsx` (icon `📖`, `comingSoon`, `href="#"`). We repoint that card; we do **not** invent a new design system.

> The app today has **no** rules/help/reference surface at all. Home ships a placeholder "Rules & rulings" card marked **Soon**. This spec turns that placeholder into a real section.

---

## How to read this

- **§0 Design intent & the user jobs** — who opens this, why, and the one bar everything is measured against.
- **§1 Information Architecture** — the full doc tree (both sections), the page list, and the three ways a user finds an answer fast.
- **§2 In-app placement** — routes, the Home entry, and the contextual "?" entry points (what's in-bounds vs. the V1/V2 locks).
- **§3 Anchor / structure convention** — stable IDs that are human-skimmable AND chatbot-consumable.
- **§4 Wireframes** — (a) docs landing/index, (b) a rules-guide article, (c) an app how-to page. Desktop + mobile, low-fi. Plus a supplementary sketch of the card-reference index.
- **§5 App how-to page list** — the minimal set (titles + one-line scope).
- **§6 Assumptions** and **§7 Handoff notes for engineering.**

ASCII wireframes are structural, not pixel-accurate (same convention as the house doc): `[ ]` = tappable control/zone, `▸`/`▾` = collapsed/expanded disclosure, `🔍` = search, `🔗` = copy-anchor affordance, `›` = breadcrumb separator.

---

## §0. Design intent & the user jobs

The docs exist to serve **five concrete jobs**, in priority order. Every IA decision below traces to one of these.

| # | Job (user's words) | What they need | Primary surface |
|---|---|---|---|
| **J1** | *"Something just happened at the table and I need the rule NOW."* (in-person tournament, **no engine assist**) | A specific answer in **≤2 taps**, readable on a phone | **Quick Answers** + **Search** |
| **J2** | *"I'm new to Edison — teach me enough to play confidently in person."* | A guided, ordered learn path | **Base-Rules Primer → 13 Rule-Differences** |
| **J3** | *"How do I do X in the app?"* (build a deck, join a duel, play a turn) | Short task-shaped how-tos | **Using the App** section |
| **J4** | *"Does this specific card actually work how I think?"* | Per-card Edison behavior vs. what modern players expect | **Cards That Play Differently** reference |
| **J5** (future) | *"Why did that happen?"* — an in-app chatbot | Stable, citable anchors it can point at | The **anchor convention (§3)** makes every rule addressable |

**The success bar (from the brief):** a group member can read the Rules section and **confidently play Edison at a physical table with no engine**. That means the rules content must be *teach-first* (J2) **and** *answer-fast* (J1) at the same time — so the IA carries **both** a learning spine and a lookup layer over the same pages.

**Design consequence:** we do NOT make the user choose "browse vs. search." The landing page leads with **Quick Answers** (the table-side reflex), keeps **Search** always visible (sticky), and lays the **learn path** underneath for the sit-down session. One surface, three depths.

---

## §1. Information Architecture

### 1.1 The two sections at a glance

```
LEARN  (/learn — the docs home)
│
├── 1 · USING THE APP  (how-to)        ← small, task-shaped; the app is intuitive
│      Getting Started · Build & Manage Decks · Start or Join a Duel ·
│      Play a Turn · Reading the Board          (+ optional: Responses, Chains & Priority in-app)
│
└── 2 · EDISON FORMAT RULES            ← the teaching backbone; maps 1:1 to edisonformat.com
       ├── QUICK ANSWERS  (curated Q→anchor index — the table-side fast path)
       ├── BASE-RULES PRIMER           (learn the game from scratch, Edison-flavored)
       ├── THE 13 RULE-DIFFERENCES     (Rule #1 … #13, frozen numbering)
       └── CARDS THAT PLAY DIFFERENTLY (~36 entries: 33 cards + 3 archetype groups)
```

### 1.2 Full doc tree (page list + hierarchy)

Every leaf is one page (one canonical URL, one stable ID — see §3). Slugs shown are the human-facing URL tails.

```
/learn                                             DocsLanding  (search + Quick Answers + both section indexes)
│
├─ USING THE APP
│  /learn/how-to/getting-started
│  /learn/how-to/build-a-deck
│  /learn/how-to/start-or-join-a-duel
│  /learn/how-to/play-a-turn
│  /learn/how-to/reading-the-board
│  /learn/how-to/responses-and-priority          (optional — split from play-a-turn if playtests show it needs its own page)
│
└─ EDISON FORMAT RULES
   /learn/rules                                    RulesIndex  (Quick Answers full view + the 4 groups below)
   │
   ├─ QUICK ANSWERS  (not a page of prose — a curated index; rendered on /learn and /learn/rules)
   │
   ├─ BASE-RULES PRIMER  (writer defines exact split; proposed ~5 pages)
   │  /learn/rules/primer-how-a-turn-works        (phases DP▸SP▸MP1▸BP▸MP2▸EP; who goes first; turn-1 draw & no turn-1 Battle Phase)
   │  /learn/rules/primer-summoning               (Normal/Tribute/Flip/Set; Special; Synchro + Tuners; Fusion; Ritual; Extra Deck = Fusion+Synchro only)
   │  /learn/rules/primer-chains-and-spell-speed  (activation, Spell Speed 1/2/3, LIFO resolution, targeting, when you get to respond)
   │  /learn/rules/primer-battle-phase            (attack steps; Damage Step overview at a base level; replay)
   │  /learn/rules/primer-deck-building           (Main 40–60, Extra 0–15, Side 0–15; copies F0/L1/S2; what the banlist is)
   │
   ├─ THE 13 RULE-DIFFERENCES  (frozen 1:1 to edisonformat.com; number is the stable key)
   │  /learn/rules/difference-01-starting-player-draws
   │  /learn/rules/difference-02-one-active-field-spell
   │  /learn/rules/difference-03-union-monster-conditions
   │  /learn/rules/difference-04-phase-dependent-mandatory-triggers
   │  /learn/rules/difference-05-trap-monster-zone-blocking
   │  /learn/rules/difference-06-ignition-effect-priority
   │  /learn/rules/difference-07-segoc
   │  /learn/rules/difference-08-seven-timing-damage-step
   │  /learn/rules/difference-09-trigger-location-and-recognition
   │  /learn/rules/difference-10-life-point-costs
   │  /learn/rules/difference-11-end-of-turn-discard
   │  /learn/rules/difference-12-infinite-loops
   │  /learn/rules/difference-13-zero-atk-monsters
   │
   └─ CARDS THAT PLAY DIFFERENTLY  (reference; ~36 entries)
      /learn/rules/cards                           CardReferenceIndex  (searchable/filterable table)
      /learn/rules/cards/:cardSlug                 CardReferenceEntry  (e.g. .../cards/brionac, .../cards/sangan,
                                                                        .../cards/rescue-cat, group entries:
                                                                        .../cards/lightsworn-mill, .../cards/union-monsters,
                                                                        .../cards/spirit-monsters)
```

**Why this shape.**
- **Two top-level sections, never blended.** J3 (app) and J1/J2/J4 (rules) are different mindsets. A player mid-duel who taps "?" wants the *rules*; a first-timer wants the *app*. Keeping them as two labeled sections on one landing means neither buries the other, and search still spans both.
- **The 13 differences are their own group with frozen numbering.** This is the content's spine and the chatbot's spine (J5). Rule #6 is *always* `rules.diff.06`, whatever we rename the page to.
- **Primer sits *before* the differences** in reading order because J2 (learn from scratch) needs the base game first, then "here's where Edison diverges." A modern player who already knows the base game skips straight to the 13.
- **Card reference is a table, not 36 prose pages to scroll.** J4 is a *lookup* ("is Brionac once-per-turn?") — so the entry point is a filterable index, and each entry is short and deep-linkable.

### 1.3 How a user finds a specific rule FAST — three complementary mechanisms

Fast-find is the make-or-break for J1 (table-side, no engine). We ship **three layers over the same content**, cheap-to-build because the content set is small and static:

**(1) Quick Answers — the curated Q→anchor index (the reflex path).**
A hand-authored list of the ~15 most-asked table questions, each a one-tap link to the exact anchor. This is the single highest-value fast-find feature because at a table people ask the *same* questions. It leads the landing page and has a full view on `/learn/rules`. Proposed seed set (each maps to a canonical ID from §3):

| Question (as a player says it) | → Canonical target |
|---|---|
| "Who draws on turn 1?" | `rules.diff.01` |
| "Who goes first — and do they pick?" | `rules.primer.turn#who-goes-first` |
| "Can I attack on turn 1?" | `rules.primer.turn#no-turn-1-battle-phase` |
| "Can I use my monster's effect before their Bottomless/Torrential?" (priority) | `rules.diff.06` |
| "What can be activated in the Damage Step?" | `rules.diff.08` |
| "What order do simultaneous effects go on the chain?" (SEGOC) | `rules.diff.07` |
| "Does setting a Field Spell blow up their Field Spell?" | `rules.diff.02` |
| "How many Unions can equip one monster?" | `rules.diff.03` |
| "Can I pay a cost that takes me to exactly 0 LP?" | `rules.diff.10` |
| "Can I respond to the end-of-turn hand-size discard?" | `rules.diff.11` |
| "Do two 0-ATK monsters destroy each other?" | `rules.diff.13` |
| "Is Brionac / Sangan / Rescue Cat / Goyo once-per-turn here?" | `rules.card.brionac` etc. |
| "How big can my Side Deck be?" | `rules.primer.deck#side-deck` |
| "How does a chain resolve?" (last-in-first-out) | `rules.primer.chains#resolution-order` |
| "Is this card pre-errata in Edison?" | `rules.cards` (index) |

**(2) Search — the "I know a keyword" path.**
A **sticky search box** on every docs screen. Client-side index over: page titles, all anchored heading text, `keywords` frontmatter, and **card names/aliases** (so "goyo" jumps to the Goyo entry). Content is small (~30 pages + ~36 card rows) → a prebuilt JSON index, no backend. Results group by section ("Rules" / "Using the app" / "Cards") and show the matching heading, not just the page. Enter on mobile → results view; on desktop → dropdown under the box.

**(3) Category nav — the browse/learn path.**
The landing's left rail (desktop) / accordion (mobile) exposes the full tree in 1.2, so J2 learners walk it in order and J4 browsers scan the card table. Every article carries **prev/next** within its group so the primer and the 13 read like chapters.

> **Design note:** Quick Answers and Search both resolve to the *same anchors* the chatbot will cite (§3). We are not building three separate content stores — we're building **one anchored content set** with three doorways.

---

## §2. In-app placement

### 2.1 Route & nav entry

**Route namespace: `/learn`.** Chosen over `/rules` (the section is bigger than rules — it also teaches the app) and over `/docs`/`/help` (dev-y / app-only flavor). `/learn` matches the dual content and the founder's stated goal that players *learn the real rules* so they aren't surprised by a judge in person.

Route table (drops into `App.tsx` alongside the existing protected routes; all `RequireAuth` — this is a closed 6-friend club, no public docs needed):

```
/learn                          → DocsLanding
/learn/how-to/:slug             → HowToArticle
/learn/rules                    → RulesIndex
/learn/rules/:slug              → RulesArticle        (primer-*, difference-NN-*)
/learn/rules/cards              → CardReferenceIndex
/learn/rules/cards/:cardSlug    → CardReferenceEntry
/rules                          → <Navigate to="/learn/rules" replace />   (alias; the Home card historically said "Rules")
```

All article routes are **one content-registry-driven component per shape** (HowToArticle / RulesArticle / CardReferenceEntry), reading the page from a static content module keyed by slug — not one hand-written screen per page. Unknown slug → docs-flavored 404 that offers Search + "Back to Learn" (never the app-wide catch-all `Navigate to="/"`, which would silently swallow a mistyped/renamed anchor).

### 2.2 Reachable from Home

**Repoint the existing card — do not add a new one.** `HomeScreen.tsx` already renders a third `ActionCard`:

```tsx
<ActionCard icon="📖" title="Rules & rulings"
  description="Edison format rules, ban list, and card rulings reference."
  comingSoon href="#" />
```

Change: drop `comingSoon`, set `href="/learn"`, retitle to **"Rules & Guides"**, update copy to reflect both sections:

```tsx
<ActionCard icon="📖" title="Rules & Guides"
  description="Learn Edison format and how to use the app — rules, the damage step, priority, and card references."
  href="/learn" />
```

That's the primary door, and it's already in the intended layout (the 3-up action grid: *Start a duel · Build a deck · Rules & Guides*). No new Home real estate needed.

### 2.3 Contextual entry points (propose, in-bounds only)

The house doc locks two things we must respect (§17/§18 of `v1-ux-flows.md`): **no deep-links from disabled actions into rules** in V1, and **no in-duel "why did that happen?" chatbot** in V1. It *also* explicitly KEEPS: *"Rules & Rulings … reachable from Home and (as a slide-in) from within the Duel Field, so a player never has to abandon a duel to check a rule."* So the in-bounds contextual entries are **generic doorways**, not event-specific deep-links:

- **[HIGH VALUE, in-bounds] Duel screen "?" button.** Add a `?` icon button to the `DuelScreen` header (next to `← Home` / `⚔ Duel`). Tapping it opens **Learn as a slide-in overlay** (docs landing with Search + Quick Answers), so a player can look up "what can I do in the Damage Step?" *without leaving the live board*. This is exactly the §1 "slide-in inside the Duel Field" the house doc preserves. It opens the **generic** docs surface — it does NOT auto-target a rule from the current game state (that targeting is the V2 seam, see below). Overlay reuses the existing `.overlay-backdrop`/`.overlay-panel` pattern from `global.css`.
- **[MEDIUM, in-bounds] Card Inspector → card reference.** `CardInspector.tsx` already reserves a static **"Rulings (Edison)"** block (§9 of the house doc). When the inspected card is one of the ~36 "plays differently" cards, render a **"How this card plays in Edison ›"** link to `rules.card.{slug}`. This is static reference text (allowed), not a live why-explanation. High learning payoff for J4 at the exact moment of curiosity.
- **[LOW, optional] Deck Builder "?".** A small `?` in the `DeckBuilderScreen` header → `how-to/build-a-deck` (and the deck-building primer for Side/Extra limits). Nice-to-have; the builder is already legality-visualized so this is low urgency.
- **Global fallback:** every docs screen has a persistent header path back to Home and a sticky Search, so the section is never a dead end from any depth.

**V2 seam (design it, ship nothing):** because every rule is addressed by a stable canonical ID (§3), a later "why did that happen?" affordance — the chatbot, or an event→rule deep-link from a chain-resolution caption — drops in by mapping an engine event to a `canonicalId` and reusing the same slide-in. **Do not build the event→rule mapping in V1**; just don't preclude it. The `?` button ships the *generic* version now; the *contextual* version is the same button pointed at a specific anchor later.

---

## §3. Anchor / structure convention (human-skimmable **and** chatbot-consumable)

This is the load-bearing convention: it must let a human copy a link to an exact rule, let Search/Quick Answers target exact headings, and let a future chatbot **cite** rules that never break when we re-word a heading. The trick is to **decouple the stable identifier from the display text and the pretty URL.**

### 3.1 The rules

1. **Content is authored in Markdown/MDX with frontmatter.** Every page starts with:
   ```yaml
   ---
   id: rules.diff.06                 # canonical, immutable page ID (see grammar below)
   section: rules                    # rules | howto
   group: difference                 # primer | difference | card | howto
   ruleNumber: 6                     # present only for the 13 differences
   title: "Ignition Effect Priority" # display title — may be re-worded freely
   slug: difference-06-ignition-effect-priority   # URL tail — stable; renames leave an alias
   keywords: [priority, ignition, summon, chain link 1, bottomless, torrential]
   summary: "The turn player may activate an Ignition Effect as Chain Link 1..."  # feeds TL;DR + search + chatbot
   ---
   ```

2. **Every targetable heading carries an explicit, author-assigned anchor** — NOT auto-slugified from the heading text:
   ```md
   ## When the summon does NOT start a chain {#summon-no-chain}
   ## When the summon DOES start a chain {#summon-starts-a-chain}
   ```
   The `{#…}` slug is **immutable once shipped**. You may re-word the visible heading anytime; the anchor never changes. This is what buys BOTH human readability and rename-stability.

3. **Canonical ID grammar (the stable address for humans, search, and the chatbot):**
   ```
   {section}.{group}.{key}[.{sub}]      or, for a heading:  {pageId}#{anchor}
   ```
   Examples:
   ```
   howto.build-deck                         → /learn/how-to/build-a-deck
   rules.primer.turn                        → /learn/rules/primer-how-a-turn-works
   rules.primer.turn#who-goes-first         → …/primer-how-a-turn-works#who-goes-first
   rules.diff.06                            → /learn/rules/difference-06-ignition-effect-priority
   rules.diff.06#summon-starts-a-chain      → …/difference-06-ignition-effect-priority#summon-starts-a-chain
   rules.card.brionac                       → /learn/rules/cards/brionac
   ```
   For the 13 differences the `key` is the **zero-padded rule number** (`01`…`13`) — frozen to edisonformat.com's numbering. This is the single most important stability guarantee: **"why did that happen?" → a rule number → `rules.diff.NN`**, forever.

4. **A build step emits `docs-manifest.json`** — one flat array of every page and every anchored heading:
   ```json
   [
     { "id": "rules.diff.06", "url": "/learn/rules/difference-06-ignition-effect-priority",
       "section": "rules", "group": "difference", "ruleNumber": 6,
       "title": "Ignition Effect Priority", "summary": "…", "keywords": ["priority","…"],
       "anchors": [
         { "id": "rules.diff.06#summon-no-chain", "text": "When the summon does NOT start a chain",
           "url": "/learn/rules/difference-06-ignition-effect-priority#summon-no-chain" },
         { "id": "rules.diff.06#summon-starts-a-chain", "text": "…", "url": "…#summon-starts-a-chain" }
       ],
       "aliases": [] }
   ]
   ```
   This single manifest is the **one source** for: the in-app Search index, the Quick Answers link resolution, prev/next ordering, and (later) the chatbot's retrieval + citation. The chatbot cites `id`; the app resolves `id → url`. Nothing else needs to know how URLs are spelled.

5. **Every anchored heading renders a `🔗` copy-link affordance** (visible on hover desktop, shown inline on mobile) that copies the canonical **URL**. So a human sharing "look at rule 6's second case" in the group chat produces the *same* deep link the chatbot would cite. Consistency for free.

6. **URL renames are non-breaking.** If a slug ever changes, keep the old slug in `aliases[]`; the router 301/`<Navigate>`s old → new. The canonical `id` never changes, so no external citation ever rots.

### 3.2 Why this satisfies both consumers

- **Human-skimmable:** pretty URLs, real heading text, a visible copy-anchor, a "On this page" mini-TOC generated from the anchors (§4).
- **Chatbot-consumable:** a flat, keyworded, summarized manifest with immutable IDs; frozen rule numbers; per-heading granularity so the bot can cite `rules.diff.06#summon-starts-a-chain` rather than a whole page. The `summary` field gives the bot a retrieval unit per page without scraping rendered HTML.

---

## §4. Wireframes

Same grammar/fidelity as `2026-07-13-v1-ux-flows.md`. Reuses live components/tokens: header pattern from `HomeScreen`/`MyDecksScreen` (`⟡ EDISON DUEL`, back button, `.btn`), `.panel`, `.section-title`, `.validity-chip`/`.badge`, `.overlay-*`, dark tokens (`--bg-*`, `--text-*`, `--accent`). Responsive tiers match §0 of the house doc and the `768px` breakpoint in `global.css`: **phone <768 · tablet 768–1024 · desktop ≥1024**. Two-pane appears ≥1024; 768–1024 uses single-column + a collapsible Contents drawer.

### (a) Docs landing / index — `/learn`

**Purpose.** Answer J1 in one glance (Quick Answers + Search on top), while exposing the full learn path (J2/J3/J4) underneath. This screen must not make the user choose "search vs. browse."

**Key elements.** Sticky header (wordmark + back-to-Home); **sticky Search**; **Quick Answers** block (the reflex path); two section blocks (**Using the App**, **Edison Format Rules**) each showing their sub-groups; the 13 differences shown as a compact numbered list so they're one tap deep.

**Desktop (≥1024) — contents rail + content:**
```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Home     ⟡ EDISON DUEL · Learn                         [ 🔍 search ] │  ← sticky
├──────────────────────┬────────────────────────────────────────────────┤
│ CONTENTS             │  ⚡ QUICK ANSWERS                                 │
│ ▾ Using the app      │  ┌────────────────────────────────────────────┐ │
│   · Getting started  │  │ ▸ Who draws on turn 1?                      │ │
│   · Build a deck     │  │ ▸ Can I attack on turn 1?                   │ │
│   · Start/join duel  │  │ ▸ Effect before their Bottomless? (priority)│ │
│   · Play a turn      │  │ ▸ What activates in the Damage Step?        │ │
│   · Reading board    │  │ ▸ SEGOC — what order on the chain?          │ │
│ ▾ Edison rules       │  │ ▸ Side Deck size?          … [ see all → ]  │ │
│   · Quick answers    │  └────────────────────────────────────────────┘ │
│   ▾ Base-rules primer│                                                  │
│     · How a turn works│  📱 USING THE APP                                │
│     · Summoning      │  ┌──────────────┐┌──────────────┐┌────────────┐ │
│     · Chains & speed │  │Getting started││ Build a deck ││Start/join  │ │
│     · Battle phase   │  └──────────────┘└──────────────┘└────────────┘ │
│     · Deck building  │  ┌──────────────┐┌──────────────┐                │
│   ▾ 13 differences   │  │ Play a turn  ││Reading board │                │
│     1 · Turn-1 draw  │  └──────────────┘└──────────────┘                │
│     2 · 1 Field Spell│                                                  │
│     3 · Union cond.  │  📖 EDISON FORMAT RULES                           │
│     … 13 · 0-ATK     │  Base-rules primer  › learn the game from scratch │
│   ▾ Cards that play  │  ┌────────────────────────────────────────────┐ │
│      differently     │  │ The 13 Rule-Differences                     │ │
│                      │  │ 1 Starting player draws   2 One Field Spell │ │
│                      │  │ 3 Union conditions        4 Phase triggers  │ │
│                      │  │ 5 Trap-monster zones      6 Ignition priority│ │
│                      │  │ 7 SEGOC                   8 Damage Step (7)  │ │
│                      │  │ 9 Trigger location       10 LP costs        │ │
│                      │  │ 11 End-of-turn discard    12 Infinite loops │ │
│                      │  │ 13 0-ATK monsters                           │ │
│                      │  └────────────────────────────────────────────┘ │
│                      │  Cards that play differently  › 36-card reference │
│                      │  [ Open card reference → ]                       │
└──────────────────────┴────────────────────────────────────────────────┘
```

**Mobile (<768) — search + Quick Answers pinned; sections as accordions:**
```
┌───────────────────────┐
│ ← ⟡ Learn        🔍   │  ← tap 🔍 → full-screen search
├───────────────────────┤
│ [ 🔍 Search the docs ]│  ← sticky
├───────────────────────┤
│ ⚡ QUICK ANSWERS       │  ← pinned first; the table-side reflex
│ ▸ Who draws turn 1?    │
│ ▸ Attack on turn 1?    │
│ ▸ Priority vs Bottomless│
│ ▸ Damage Step?         │
│ ▸ SEGOC order?         │
│ [ See all quick answers]│
├───────────────────────┤
│ 📱 USING THE APP    ▸ │  ← accordion (collapsed)
├───────────────────────┤
│ 📖 EDISON RULES     ▾ │  ← expanded
│  Quick answers         │
│  ▸ Base-rules primer   │
│  ▾ 13 Rule-Differences │
│     1 Turn-1 draw      │
│     2 One Field Spell  │
│     3 Union conditions │
│     … 13 0-ATK monsters│
│  ▸ Cards that play diff│
└───────────────────────┘
```

**States.** Default · search-focused (results replace body) · search-empty ("No match — try 'priority', 'damage step', a card name") · offline/loaded-from-cache (docs are static → fully readable offline once visited; matters for a phone at a venue). **Notes.** Quick Answers is hand-curated content (part of the writer's job); the shell just renders the list from a small `quick-answers.json` of `{question, canonicalId}`.

---

### (b) A rules-guide article — e.g. `/learn/rules/difference-06-ignition-effect-priority`

**Purpose.** Teach one rule clearly (J2) and be the precise landing target for Quick Answers / Search / the future chatbot (J1/J5). Must read top-to-bottom for a learner AND let a table-side player jump to the exact case.

**Key elements.** Breadcrumb; **Rule #N badge** (for the 13); title; **TL;DR box** (the one-sentence answer, from `summary` — this is what a table-side player reads first); **"On this page" mini-TOC** built from the page's anchors; body with **anchored, `🔗`-copyable headings**; worked **Examples** (the content backbone leans on examples); **"Related cards → Inspector"** chips that open the Card Inspector / card-reference; **prev/next** within the group.

**Desktop (≥1024):**
```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Learn    ⟡ EDISON DUEL · Learn                        [ 🔍 search ]  │
├──────────────────────┬────────────────────────────────────────────────┤
│ CONTENTS             │  Learn › Rules › 13 Differences › #6             │
│  … (rail, current    │  ┌─────────┐                                     │
│   article expanded)  │  │ RULE #6 │  Ignition Effect Priority           │
│  ▾ 13 differences    │  └─────────┘                                     │
│    5 Trap-monster    │  ┌────────────────────────────────────────────┐ │
│  ▸ 6 Ignition prio.  │  │ TL;DR  On your turn, after a Summon that     │ │
│      ‣ Summon, no    │  │ didn't start a chain, YOU may activate an     │ │
│        chain         │  │ Ignition Effect as Chain Link 1 before your   │ │
│      ‣ Summon starts │  │ opponent can respond (e.g. before Bottomless).│ │
│        a chain       │  └────────────────────────────────────────────┘ │
│    7 SEGOC           │                                                  │
│                      │  ON THIS PAGE                                    │
│                      │   · When the summon does NOT start a chain       │
│                      │   · When the summon DOES start a chain           │
│                      │                                                  │
│                      │  When the summon does NOT start a chain      🔗  │  ← anchor #summon-no-chain
│                      │  <body text …>                                   │
│                      │  ┌ Example ──────────────────────────────────┐  │
│                      │  │ Discard Malicious to SS Dark Grepher, then │  │
│                      │  │ banish Malicious with priority before D.D. │  │
│                      │  │ Crow. …                                    │  │
│                      │  └────────────────────────────────────────────┘ │
│                      │  When the summon DOES start a chain          🔗  │  ← anchor #summon-starts-a-chain
│                      │  <body text …>                                   │
│                      │                                                  │
│                      │  Related cards:  [Chaos Sorcerer] [Sangan] [Brionac]│ ← open Inspector/card ref
│                      │  ─────────────────────────────────────────────  │
│                      │  [ ‹ #5 Trap-monster zones ]   [ #7 SEGOC › ]    │
└──────────────────────┴────────────────────────────────────────────────┘
```

**Mobile (<768):**
```
┌───────────────────────┐
│ ← Rules          🔍   │
├───────────────────────┤
│ Rules › #6            │  ← breadcrumb (condensed)
│ [RULE #6]             │
│ Ignition Effect       │
│ Priority              │
├───────────────────────┤
│ ┌───────────────────┐ │
│ │ TL;DR  After a     │ │  ← the table-side answer, first thing on screen
│ │ Summon that didn't │ │
│ │ start a chain, you │ │
│ │ get priority to use│ │
│ │ an Ignition Effect.│ │
│ └───────────────────┘ │
│ ▸ On this page        │  ← collapsible mini-TOC
├───────────────────────┤
│ When the summon does  │
│ NOT start a chain  🔗 │
│ <body …>              │
│ ┌ Example ──────────┐ │
│ │ …                 │ │
│ └───────────────────┘ │
│ When it DOES start a  │
│ chain             🔗  │
│ <body …>              │
├───────────────────────┤
│ Related: [Chaos Sorc.]│
│ [Sangan] [Brionac]    │
├───────────────────────┤
│ [ ‹ #5 ]      [ #7 › ]│
└───────────────────────┘
```

**States.** Default · deep-linked-with-fragment (page scrolls to the anchor and briefly highlights it — critical for Quick Answers/Search/chatbot landings) · "Related cards" present/absent · first/last in group (prev/next disables its edge). **Notes.** TL;DR renders from frontmatter `summary`, so the *same* string powers the box, Search snippets, and chatbot retrieval — write it once. The primer pages and the 13 differences share this exact shell (primer pages omit the `RULE #N` badge).

---

### (c) An app how-to page — e.g. `/learn/how-to/build-a-deck`

**Purpose.** Get a user through one app task fast (J3). These are short and task-shaped, not reference prose. Same shell as (b), minus the rule badge, plus **numbered steps** and room for a screenshot/callout.

**Desktop (≥1024):**
```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Learn    ⟡ EDISON DUEL · Learn                        [ 🔍 search ]  │
├──────────────────────┬────────────────────────────────────────────────┤
│ CONTENTS             │  Learn › Using the app › Build a deck            │
│ ▾ Using the app      │  Build a deck                                    │
│  · Getting started   │  ┌────────────────────────────────────────────┐ │
│  ▸ Build a deck      │  │ Goal  Make an Edison-legal deck and save it. │ │
│  · Start/join duel   │  └────────────────────────────────────────────┘ │
│  · Play a turn       │                                                  │
│  · Reading board     │  1 ▸ Open  Home → Build a deck  (or My Decks →   │
│ ▾ Edison rules …     │       New deck).                              🔗 │
│                      │  2 ▸ Search & filter the card pool (banlist,     │
│                      │       type, attribute, level, ATK/DEF, text).    │
│                      │       ┌───────────── [ screenshot ] ───────────┐ │
│                      │       │  builder search + filter rail           │ │
│                      │       └─────────────────────────────────────────┘│
│                      │  3 ▸ Add cards. Legality shows live: 🚫 / ① / ②  │
│                      │       and copies grey out at the limit.          │
│                      │  4 ▸ Watch the counts: Main 40–60 · Extra ≤15 ·  │
│                      │       Side ≤15.  Extra = Fusion + Synchro only.   │
│                      │  5 ▸ Save. Duplicate / Import·Export .ydk from    │
│                      │       the ⋯ menu.                                │
│                      │                                                  │
│                      │  See also:  [Deck-building rules →]  [Start a duel →]│
│                      │  ────────────────────────────────────────────── │
│                      │  [ ‹ Getting started ]   [ Start or join a duel ›]│
└──────────────────────┴────────────────────────────────────────────────┘
```

**Mobile (<768):**
```
┌───────────────────────┐
│ ← Using the app   🔍  │
├───────────────────────┤
│ Build a deck          │
│ ┌───────────────────┐ │
│ │ Goal  An Edison-   │ │
│ │ legal deck, saved. │ │
│ └───────────────────┘ │
│ ▸ On this page        │
├───────────────────────┤
│ 1 Open Home → Build   │
│   a deck.             │
│ 2 Search & filter the │
│   pool.               │
│   ┌ screenshot ─────┐ │
│   │                 │ │
│   └─────────────────┘ │
│ 3 Add cards — banlist │
│   shows live 🚫/①/②. │
│ 4 Counts: Main 40–60· │
│   Extra ≤15 · Side ≤15│
│ 5 Save / Export .ydk. │
├───────────────────────┤
│ See also:             │
│ [Deck-building rules →]│
├───────────────────────┤
│ [ ‹ Prev ]   [ Next › ]│
└───────────────────────┘
```

**States.** Default · screenshot present/absent · "See also" cross-links (how-to ↔ rules) present/absent. **Notes.** How-to pages should cross-link into the rules primer where a *rule* underlies an app step (e.g. "Extra = Fusion+Synchro only" links to `rules.primer.summoning`) — this is how J3 users discover J2 content without a hard sell.

---

### (supplementary) Card-reference index — `/learn/rules/cards`

Not one of the three required wireframes, but shown so the ~36-card backbone is decision-ready. It's a **filterable table**, not prose — J4 is a lookup.

```
┌───────────────────────────────────────────────────────────────────────┐
│  ← Rules   ⟡ Learn · Cards that play differently        [ 🔍 filter ]  │
├───────────────────────────────────────────────────────────────────────┤
│  These ~36 cards behave differently in Edison than a modern player      │
│  expects (pre-errata text or era rulings).                              │
│  Filter: [ All ] [ Pre-errata ] [ Archetype groups ] [ Damage step ]    │
├──────────────────────────┬──────────────────────────────────────────────┤
│  Card                     │  How it differs in Edison (one line)         │
│  ─────────────────────────┼───────────────────────────────────────────  │
│  Brionac, Dragon of the…  │  No once-per-turn; discard any number.   ›   │
│  Sangan                   │  No once-per-turn on the search.         ›   │
│  Rescue Cat               │  No "once per name"; summons not negated. ›  │
│  Goyo Guardian            │  Any Tuner (not just EARTH).             ›   │
│  …                        │  …                                            │
│  ▸ Lightsworn mill (group)│  Phase-dependent mandatory trigger.      ›   │
│  ▸ Union monsters (group) │  1 Union per monster; see Rule #3.       ›   │
│  ▸ Spirit monsters (group)│  Phase-dependent mandatory trigger.      ›   │
└──────────────────────────┴──────────────────────────────────────────────┘
```

Each row → `/learn/rules/cards/:cardSlug` (a short entry: Edison behavior · what modern players expect · the rule it ties to, e.g. `rules.diff.04` for the archetype groups). The 3 archetype rows (Lightsworns, Unions, Spirits) are group entries covering many physical cards. Mobile: the table collapses to stacked rows (card name + one-line diff + `›`).

---

## §5. App how-to page list (minimal set)

The app is intuitive, so this is deliberately small. Titles + one-line scope (content written separately). The four areas the brief named — deck builder, creating/joining a duel, playing a turn, reading the board — map to pages 2–5; page 1 is the front door.

| # | Page (title) | One-line scope | Canonical ID |
|---|---|---|---|
| 1 | **Getting Started** | Logging in via an invite, the Home screen, and where everything lives (duels, decks, learn). | `howto.getting-started` |
| 2 | **Build & Manage Decks** | The deck builder: search/filter the pool, live legality badges, Main/Extra/Side limits, save · duplicate · import/export `.ydk`. | `howto.build-deck` |
| 3 | **Start or Join a Duel** | Create an invite-to-play link (pick deck + time-per-move), share it, join from a link; picking who goes first in the Pre-Duel Room. | `howto.start-or-join-a-duel` |
| 4 | **Play a Turn** | The tap → action-sheet → destination model; phases and End Turn; inspecting a card safely (never triggers a play); responding when the app offers a window. | `howto.play-a-turn` |
| 5 | **Reading the Board** | Zones, LP, phase rail, whose-turn, the "actionable" marker, opponent status strip, and the per-move timer / "Your move" queue / async resume. | `howto.reading-the-board` |
| 6 | *(optional)* **Responses, Chains & Priority (in the app)** | How the response prompt + chain stack look and behave **on screen** — the app mechanic only; the *rule* lives in Rules #6/#7 and the chains primer. Split from #4 only if playtests show turn-play needs it separated. | `howto.responses-and-priority` |

Recommendation: **ship 1–5; hold 6** unless playtesting shows the priority/response window (the app's known hardest interaction) needs its own how-to distinct from the rule. Each page ends with cross-links into the matching Rules primer so app-learners drift naturally into format-learning.

---

## §6. Assumptions (made to avoid blocking)

1. **Content is static, ships with the frontend, and is versioned in-repo** (Markdown/MDX modules), not fetched from a CMS or backend. Rationale: the set is tiny (~30 pages + ~36 rows), it must be readable offline at a venue (J1), and the app is a Vite SPA. If the team prefers a `docs` package or a `/content` dir, the IA/anchors are unchanged.
2. **The docs live behind `RequireAuth`** like every other route — it's a closed 6-friend club; no need for a public marketing-style docs site. (Trivial to make `/learn` public later; nothing here depends on the guard.)
3. **`/learn` naming.** Chosen over `/rules`, `/help`, `/docs` per §2.1. `/rules` kept as an alias redirect. If the team insists on matching the Home card's old word, retitling the card (§2.2) is the cleaner fix.
4. **The 13 rule-differences and their numbering are frozen to edisonformat.com** (verified this session — Rule #1 Starting Player Draws … #13 0-ATK Monsters). The card reference = edisonformat.com/functional-errata.html's **36 entries (33 cards + 3 archetype groups)**. If the writer restructures these, the frozen `ruleNumber`/`rules.diff.NN` keys must be preserved for chatbot stability.
5. **Base-rules primer split (~5 pages) is a proposal**, not a mandate — the content writer owns the exact chapterization. The shell renders whatever primer pages the manifest lists, in `order` sequence.
6. **Search is client-side** over a prebuilt index from `docs-manifest.json`; no search backend in scope.
7. **Screenshots for how-to pages** are produced separately; the shell just has slots. Absent screenshots degrade gracefully (text-only).
8. **Respecting the V1/V2 locks:** the duel-screen `?` opens the **generic** docs slide-in only. No disabled-action→rule deep-links, no event→rule mapping, no "why did that happen?" chatbot in V1 (all V2 per `v1-ux-flows.md` §17/§18). The anchor convention (§3) is the seam that makes those V2 features cheap later.

---

## §7. Handoff notes for engineering

- **Build order for a thin shell:** (1) content-registry + `docs-manifest.json` build step; (2) `DocsLanding` with Search + Quick Answers; (3) `RulesArticle`/`HowToArticle` shared shell (breadcrumb, TL;DR, anchored headings with `🔗`, prev/next); (4) `CardReferenceIndex`/`Entry`; (5) repoint the Home card; (6) duel-screen `?` slide-in. Content authors fill Markdown against the frontmatter contract in §3.1 in parallel — the shell renders empty-but-valid pages from stubs.
- **Reuse, don't reinvent:** header (`HomeScreen`/`MyDecksScreen` pattern), `.panel`, `.section-title`, `.btn*`, `.badge*`/`.validity-chip`, `.overlay-backdrop`/`.overlay-panel`, `.loading-spinner`, and all `--bg/--text/--accent` tokens from `global.css`. Two-pane at ≥1024; single-column + Contents drawer 768–1024; accordion <768 (matches the `768px` breakpoint already in `global.css`).
- **Accessibility carries over unchanged from the house doc §16:** body/rule text ≥16px on mobile and honoring OS text-size; tap targets ≥44px; the `🔗` anchor affordance is keyboard-reachable and has an accessible label; deep-link landings move focus to the target heading (not just scroll) for screen-reader users; no meaning by color alone (Quick Answers, badges, and the card-filter chips all pair icon+label).
- **`contracts` boundary (AGENTS.md):** `web` imports `contracts` only. The docs content set is web-local static data — it does **not** need a contracts type unless the future chatbot consumes the manifest server-side; if so, put the `DocsManifestEntry` shape in `contracts` at that point, not now.
- **The manifest is the contract with the future chatbot.** Keep `id`, `ruleNumber`, `summary`, `keywords`, and `anchors[]` populated for every page from day one even though V1 has no bot — it's near-zero cost now and is the difference between "the bot can cite an exact rule" and "someone re-tags 30 pages later."

---

*End. Sections: §0 intent/jobs · §1 IA (tree, page list, fast-find) · §2 placement (routes, Home card, contextual `?`) · §3 anchor convention (human + chatbot) · §4 wireframes (landing · rules article · how-to · card-index) · §5 how-to page list · §6 assumptions · §7 eng handoff.*
