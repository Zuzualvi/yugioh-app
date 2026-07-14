# Link-First Duel Initiation — Revised UX Flow

**Author:** UX/UI (subagent) · **Date:** 2026-07-14 · **Status:** wireframe-level build handoff
**Supersedes:** the presence/directed-challenge portions of `docs/working/2026-07-13-v1-ux-flows.md` — specifically the challenge/accept loop in §1, the roster / "who's online" and "pending challenges" blocks in §3 (Home), and the entire §4 (Invite / Challenge-a-friend flow).
**Builds on (unchanged, do not re-derive):** §5 Pre-Duel Room, the per-move timer model, and the async "Your move" queue.
**Decision this implements:** `decisions/2026-07-14-link-first-duel-initiation.md` (CEO-confirmed). Duel initiation is **link-first**; in-app presence + directed in-app challenge are **cut**; auto-pairing/matchmaking is a **permanent non-goal**.

> **Convention note (carried from the source doc, applies throughout):** three responsive tiers (phone-portrait / tablet / desktop, one component system reflowed); **tap-first** (targets ≥44 px, body text ≥16 px, native share sheet on mobile, no drag required); **never meaning by color alone** — every status pairs a color with an icon **and** a text label (colorblind-safe). ASCII sketches are structural, not pixel-accurate. `[ ]` = tappable control.

---

## Two different "links" — do not conflate them

The app now has **two** kinds of link. Keeping them distinct in copy and code prevents the single most likely user confusion here.

| | **Club invite link** (existing, §2 Login) | **Invite-to-play link** (this doc) |
|---|---|---|
| Purpose | Onboard a new person **into the 6-friend club** (set display name + passcode) | Start **one specific duel** with an already-onboarded member |
| Issued by | Founder, rarely | Any member, any time they want a game |
| Consumes | A club seat | A single duel slot |
| Out of scope here | ✔ unchanged | — this document |

Everything below concerns the **invite-to-play link** only. Copy should always call it an **"invite to play"** or **"duel invite,"** never just "invite link," to avoid collision with the club-onboarding link.

---

## Link semantics this design assumes (resolving the decision record's OPEN list)

The decision record left five link-semantics questions open. The states the brief asks for (used / expired / non-member) only make sense under a specific set of choices, so this design **commits to the following** and flags them for CEO confirmation (see Open Questions). Each choice is justified by user outcome, not by what's easy to build.

- **(a) Single-use.** One link = one duel = one opponent. Once a member claims it (enters the Pre-Duel Room), the link is **consumed**. → *Outcome:* there is never ambiguity about who "the opponent" is, and the "already claimed" state is meaningful rather than a race.
- **(b) Expires.** A link is claimable for a bounded window, then dies. **Default: 24 h**, shown humanized ("expires in 23 h", "⧗ expires in 40 m"), same language grammar as the "Your move" queue. → *Outcome:* a stale link dropped in chat last week can't silently pull someone into a duel the inviter forgot about.
- **(c) Open to any member, not bound to a named person.** The inviter drops it in their group chat; **whichever free member grabs it first** becomes the opponent. This is exactly how the group already coordinates — and it is why the directed "challenge a specific online person" flow was cut. → *Outcome:* zero presence tracking; the group chat *is* the presence layer.
- **(c′) Members only.** A non-member (anyone without club credentials) is **denied** — this is a closed club. → *Outcome:* the closed-group guarantee holds even if a link leaks.
- **(d) First claim wins; later opens hit "already claimed."** No "busy" concept — async is first-class, so a member can be in several duels at once and opening a new invite simply starts another. Opening **your own** invite just returns you to Home (you can't duel yourself).
- **(e) The inviter can revoke** an unclaimed link at any time from Home. → *Outcome:* "changed my mind / nobody bit" has a clean exit, and the link can't be claimed after revoke.
- **One active outgoing invite per member at a time** (see Open Questions — flagged, not load-bearing). → *Outcome:* Home always answers "is my invite still out there?" with a single unambiguous card.

---

## §A. Revised initiation flow map

**One line:**
`Login → Home ⇄ {Deck Builder ⇄ My Decks · Rules & Rulings · Settings}; Home → [Start a duel] → Create invite (pick deck + time-per-move) → app generates shareable invite-to-play link → member shares it in their own external group chat → an invited member opens the link → (log in if needed) → Pre-Duel Room → both Ready + first-turn set → Start → Duel Field ⇄ {Inspector · Priority/Chain} → Summary/Replay → (Rematch → Pre-Duel Room | Home)`.
**Async loop (unchanged):** `Home ("Your move" queue) → [Resume] → Duel Field` for any in-progress durable duel — no re-invite, no room.

**Transition graph (replaces the §1 CHALLENGE-FLOW subgraph):**

```
   ┌────────┐  ok   ┌─────────────┐
   │ LOGIN  ├──────►│    HOME      │◄──────────────── resume in-progress async duel ─────────┐
   └───┬────┘       └─┬─┬─┬─┬──────┘   ("Your move" queue)                                   │
       │              │ │ │ └───────────────► SETTINGS · RULES & RULINGS · MY DECKS/BUILDER   │
       │              │ │ │                                                                   │
       │              │ │ └──► [Start a duel] ─► ┌──────────────────────────┐                 │
       │              │ │                        │  CREATE INVITE           │                 │
       │              │ │                        │  1 pick your deck        │                 │
       │              │ │                        │  2 pick time-per-move    │                 │
       │              │ │                        │  3 GENERATE LINK         │                 │
       │              │ │                        │    [Copy] [Share] ⧗expiry│                 │
       │              │ │                        └───────┬──────────────────┘                 │
       │              │ │      inviter returns to Home    │  (link pasted into EXTERNAL group  │
       │              │ │  ┌── PENDING INVITE card ◄──────┘   chat — outside the app)          │
       │              │ │  │   [Copy again][Share][Revoke]                                     │
       │              │ │  │        ▲                                                          │
       │              │ │  │        │ opponent claimed → card becomes "Opponent joined         │
       │              │ │  │        │                     — [Enter room]"                       │
       │              │ ▼  ▼        │                                                          │
       │        ┌───────────────┐  │                                                          │
       │        │  "Your move"  │  │           ┌──── invited member OPENS the LINK ────┐       │
       │        │    queue      │  │           │ logged out? → LOGIN (join context) ────┼──► ok │
       │        └───────────────┘  │           │ not a member? → DENIED (members only)  │       │
       │                           │           │ already claimed? → USED message        │       │
       │                           │           │ past expiry / revoked? → EXPIRED msg   │       │
       │                           │           └────────────────┬───────────────────────┘       │
       │                           │                            │ valid + member                │
       │                           │                            ▼                               │
       │                           │                  ┌───────────────────┐  both Ready +       │
       │                           └─────────────────►│  PRE-DUEL ROOM     │  first-turn set     │
       │        (inviter enters here when opponent     │  (UNCHANGED §5)    ├──► START ──► DUEL ──┘
       │         joins, or via "Wait in room")         │  ⏱ timer shown to  │      FIELD
       │                                               │  BOTH before Start │
       │                                               └────────┬──────────┘
       │                                                        │ (either leaves)
       └────────────────────────────────────────────────────── HOME
```

**What changed vs. §1:**
- **Removed:** the `pick friend` branch, the "incoming challenge banner → Accept" branch, and the outgoing-challenge-pending state.
- **Replaced with:** `[Start a duel] → Create invite → link`, the external-chat hop (explicitly *outside* the app), and the **link-open gate** with its four states.
- **Unchanged:** the Pre-Duel Room, the Duel Field loop, the Summary/Replay loop, and the async resume loop.

---

## §B. Revised Home

Home's job is unchanged in priority order: **(1) where do I owe a move? (2) what do I want to do?** Removing presence/challenges makes Home *calmer*, not emptier — there's simply less that manufactures obligation for six friends.

### REMOVED from Home
- ❌ **"Who's online" / GROUP roster with presence dots** (desktop right rail; mobile GROUP strip). No presence anywhere in V1.
- ❌ **"Pending challenges — incoming"** (`Alex challenges you — 15 min/move [Accept][✕]`). There is no directed in-app challenge to receive.
- ❌ **"Pending challenges — outgoing"** directed-challenge row (`you → Priya waiting… [✕]`). Replaced by the **Pending invite** card (below), which is link-shaped, not person-shaped.
- ❌ The old **"Duel a friend"** action (it opened the roster/challenge modal).
- ❌ The **tap-a-roster-name-to-pre-target** shortcut.

### REMAINS on Home (unchanged)
- ✅ **"Your move" queue — pinned top.** Exactly as specced: durable in-progress duels waiting on *you*, one row each (opponent · humanized time-left · turn/phase hint · **[Resume]**), sorted least-time-first, ⚠ on near-expiry, collapses to "all caught up" when empty. This is the reason most people open the app and it stays first.
- ✅ **"Waiting on opponent"** list (in-progress duels where it's *their* clock; **[Open]** = read-only review). This is about *active* duels, not initiation, so it is untouched.
- ✅ **Build a deck · Rules & rulings** secondary actions.
- ✅ Header: display name/avatar → **Settings / sign-out**.
- ✅ **Recent duel / [Replay]** row.

### ADDED / CHANGED on Home
- ➕ **"Start a duel"** — the single **primary** initiation action (replaces "Duel a friend"). One tap → **Create invite** flow (§C). Icon+label ⚔ so it never rides on color alone.
- ➕ **Pending invite card** — appears **only while you have a live outgoing invite-to-play link**. It occupies the primary-action slot (one active invite at a time), and shows:
  - the deck + time-per-move the invite was created with (so you remember what you offered),
  - **status with icon + label + color:** `🔗 Waiting for someone to join · ⧗ expires in 23 h`,
  - **[Copy link]** · **[Share]** (re-copy / re-share into chat) · **[Revoke]**.
  - When someone claims it, the card **transforms in place** to `✓ Alex joined your duel` + **[Enter room ▸]** (this is how an async inviter learns a game is on without push notifications — see §D.5).

**Desktop (roster rail is gone → calmer single main column):**

```
┌───────────────────────────────────────────────────────────────┐
│  ⟡ Edison Duel                                   ● You  ▾        │
├───────────────────────────────────────────────────────────────┤
│  ▶ YOUR MOVE  (2)                          ← pinned top, unchanged
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ vs Alex    ⚠ 12m left    T6 · your MP1            [Resume] │ │
│  │ vs Priya     23h left    T3 · your draw           [Resume] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────┐   ┌──────────┐  ┌────────────┐  │
│  │  ⚔  START A DUEL          │   │ 🂡 Build  │  │ 📖 Rules & │  │
│  │  (creates an invite link) │   │  a deck  │  │  rulings   │  │
│  └───────────────────────────┘   └──────────┘  └────────────┘  │
│                                                                 │
│  ── or, when an invite is live, that button becomes: ─────────  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🔗 INVITE PENDING · Blackwings · 24h/move                  │ │
│  │    Waiting for someone to join  ·  ⧗ expires in 23 h        │ │
│  │    [ Copy link ]   [ Share ]              [ Revoke ]        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  WAITING ON OPPONENT  (1)                                       │
│   · vs Mo    Mo's clock · 1d 4h left                    [Open]  │
│                                                                 │
│   Recent: last duel vs Sam — you won                  [Replay]  │
└───────────────────────────────────────────────────────────────┘
```

**Mobile (portrait):** "Your move" queue still **pinned to the very top**. The primary **Start a duel** button sits directly beneath it (this is now the top *action*, since incoming challenges are gone). Pending-invite card replaces that button when a link is live. Secondary actions, "Waiting on opponent," and Recent stack below. **No GROUP strip.**

```
┌───────────────────────┐          (invite live)
│ ⟡ Edison Duel     ☰   │          ┌───────────────────────┐
├───────────────────────┤          │ ⟡ Edison Duel     ☰   │
│ ▶ YOUR MOVE (2)        │  pinned  ├───────────────────────┤
│ ┌───────────────────┐ │          │ ▶ YOUR MOVE (2)        │
│ │ vs Alex   ⚠ 12m    │ │          │ ┌───────────────────┐ │
│ │ T6 · MP1 [ Resume ]│ │          │ │ …                 │ │
│ ├───────────────────┤ │          │ └───────────────────┘ │
│ │ vs Priya    23h    │ │          ├───────────────────────┤
│ │ your draw[ Resume ]│ │          │ 🔗 INVITE PENDING      │
│ └───────────────────┘ │          │ Blackwings · 24h/move  │
├───────────────────────┤          │ ⧗ expires in 23 h      │
│ ┌───────────────────┐ │          │ [ Copy ] [ Share ]     │
│ │ ⚔  START A DUEL   │ │  primary │ [ Revoke ]             │
│ └───────────────────┘ │          ├───────────────────────┤
│ ┌────────┐ ┌────────┐ │          │ … Build · Rules …      │
│ │🂡 Build │ │📖 Rules│ │          └───────────────────────┘
│ └────────┘ └────────┘ │
├───────────────────────┤
│ WAITING ON OPP (1)     │
│ · vs Mo  1d 4h [Open]  │
├───────────────────────┤
│ Recent: vs Sam [Replay]│
└───────────────────────┘   ← no GROUP / presence strip
```

**Home states:**
- **No invite out:** primary slot = **[Start a duel]**.
- **Invite pending:** primary slot = pending-invite card (`🔗` + "Waiting for someone to join" + ⧗ expiry; Copy/Share/Revoke).
- **Invite near expiry:** ⧗ escalates to **⚠ expires in 40 m** (icon + amber, plus label) — mirrors the "Your move" urgency grammar so it reads the same everywhere.
- **Opponent joined (async):** card = `✓ Alex joined your duel — [Enter room ▸]`.
- **Invite expired/revoked without a claim:** card clears back to **[Start a duel]** with a one-line, dismissible note (`Your last invite expired — start a new one.`). Never a lingering dead card.

**Notes.** The presence rail is *deliberately deleted*, not hidden — its absence is a feature (nothing to stare at, nothing to maintain, no "who's actually online?" doubt). The group's real presence signal lives in their chat, which is where the link goes anyway. Home never nags: an empty "Your move" queue collapses, and there's no invite card unless *you* created one.

---

## §C. Create invite (the "Start a duel" flow)

**Purpose.** Turn "I want a game" into a shareable link in the fewest possible taps, framed entirely around the user's goal (*which deck, how fast*), never the mechanism.

**Structure — two picks, then a link.** Same two decisions as the old §4 minus the "Who?" step (there is no "who" anymore — the group chat decides that).

1. **Your deck** — pick from My Decks; each shows its legality chip. **Illegal decks can't be used** (Generate disabled, issue count shown). Consistent with §10/§12. A sensible last-used deck is pre-selected.
2. **Time per move** — the existing preset chips `5 min · 15 min · 1 hr · 12 hr · 24 hr · 48 hr` + bounded **[Custom]** (floor ~1 min → ceiling 48 h; **no "unlimited"**). Framed as *"how fast do you play? short = live now · long = over days."* Default **24 h** pre-selected so one tap reaches Generate. Copy unchanged from §4.
3. **[Generate invite link ▸]** — produces the link + its share affordances.

> **The per-move timer and the link expiry are different clocks — the UI must keep them visually separate.** "Time per move" governs the *duel* once it starts (a duel attribute). "Expires in…" governs how long the *link* stays claimable (a link attribute). They are labeled distinctly and never share a widget.

**Desktop (single modal over Home) — step 1→2:**

```
┌──────────────────── START A DUEL ─────────────────────┐
│  1 · Your deck                                         │
│  ( ) Quickdraw Plant   ✓ Edison-legal                  │
│  (•) Blackwings        ✓ Edison-legal                  │
│  ( ) Test brew         ⚠ 2 issues — can't use          │
│                                                        │
│  2 · Time per move      (how fast do you play?)        │
│  [5 min][15 min][1 hr][12 hr][● 24 hr][48 hr][Custom]  │
│    ⏱ Each player gets 24 hr per move.                  │
│    Short = play live now · Long = play over days       │
│                                                        │
│              [ Cancel ]     [ Generate invite link ▸ ] │
└─────────────────────────────────────────────────────────┘
        [Custom] expands inline:  [ __ ] [ min | hr ▾ ]  (1 min – 48 hr)
```

**Desktop — after Generate (step 3, same modal):**

```
┌──────────────────── YOUR INVITE IS READY ──────────────┐
│  Blackwings · 24 hr per move                            │
│                                                         │
│  🔗  https://edisonduel.club/j/7Qk2-Rf9                 │
│      [ 📋 Copy link ]        [ 🔗 Share… ]               │
│                                                         │
│  ⧗ Expires in 24 h · single use · members only          │
│  Paste it into your group chat — whoever's free grabs   │
│  it first.                                              │
│                                                         │
│           [ Done ]              [ Wait in the room ▸ ]   │
└──────────────────────────────────────────────────────────┘
```

**Mobile (portrait):** the two picks are a full-screen sheet (deck list, then the chip row that wraps to two lines with the "each player gets X" line under it), **[Generate]** pinned bottom. After generate, the link view uses the **OS native share sheet** for **[Share…]** (the primary mobile affordance — one tap into WhatsApp/Signal/iMessage/Discord) with **[Copy link]** as the secondary. **[Done]** and **[Wait in the room ▸]** pinned bottom.

**Two exits after generating (serves both play speeds):**
- **[Done]** → back to **Home**, where the **Pending invite card** now holds the link (Copy again / Share / Revoke). Best for **async** — create it, drop it in chat, put the phone down. When someone joins later, Home tells you (§D.5).
- **[Wait in the room ▸]** → the inviter enters the **Pre-Duel Room** now in a `waiting for opponent to join…` state. Best for **live/blitz** — you want to be ready the second they arrive.

Either way the same claim → Pre-Duel Room → Start sequence follows; the two buttons only differ in whether the inviter waits in-room or on Home.

**States.** deck selected · deck **illegal → Generate disabled** (issue count shown; enforcement/legality only, no per-card "why") · time selected (chip highlighted, "each player gets X" updates live) · custom out of bounds (clamps to 1 min–48 h) · **link generated** (link + Copy/Share + expiry) · **copied** (toast `✓ Link copied`) · **shared** (native sheet dismissed).

**Notes.** No "Who?" step, no roster, no send-and-wait-for-accept. The only new copy vs. §4 is the three link facts — **"Expires in 24 h · single use · members only"** — stated plainly at creation so the inviter's expectations match the four link-open states before they ever share it.

---

## §D. Opening the link — the invitee experience and its states

A member taps the link in their external chat. The app resolves it through a single **gate** that lands them in exactly one of five outcomes. Every terminal state has a clear message **and an onward action — no dead-ends.**

### D.1 Happy path — logged-in member, valid link
Link opens → membership + link validity confirmed → **straight into the Pre-Duel Room** (§5). The inviter's deck + the agreed time-per-move are already shown; the invitee's first action is **Pick your deck**, then **Ready** (see §E).

### D.2 Opened while logged OUT (recognized member)
Link opens → **Login screen in "join" context** (a variant of §2), so the reason is obvious:

```
┌───────────────────────────────┐
│        ⟡  EDISON DUEL         │
│                               │
│  Alex invited you to a duel.   │  ← contextual line = why you're here
│  Log in to join.               │
│                               │
│  Display name [___________]   │
│  Passcode     [___________]   │
│        [   Log in & join ▸ ]   │
└───────────────────────────────┘
```

On success → the app resumes the link and lands them in the **Pre-Duel Room** (D.1). The join context is preserved across login so the link is never "lost" behind auth. If the link expires or is claimed by someone else *while* they were logging in, they land on the appropriate state below (D.4 / D.3) with its message — not a blank room.

### D.3 Already USED (claimed by another member)
Single-use link, someone got there first (or you're opening a link for a duel that already started):

```
┌───────────────────────────────────────┐
│  🔒  This duel invite is already taken. │
│  Sam joined Alex's duel.                │
│                                         │
│  Want in on the next one?               │
│  [ Back to Home ]   [ Start a duel ]    │
└───────────────────────────────────────┘
```

Icon (🔒) + label + color; onward paths to Home or to create their own invite. Never a dead-end.

### D.4 EXPIRED or REVOKED
The link passed its 24 h window, or the inviter revoked it:

```
┌───────────────────────────────────────┐
│  ⧗  This duel invite has expired.       │
│  (or: Alex canceled this invite.)       │
│                                         │
│  Ask Alex for a fresh link, or:         │
│  [ Back to Home ]   [ Start a duel ]    │
└───────────────────────────────────────┘
```

Distinct icon (⧗) + label from "used" so the invitee knows *why* it failed (timed out vs. taken vs. canceled) without guessing. Same non-dead-end onward paths.

### D.5 NON-MEMBER — denied (members only)
The visitor is not part of the closed club (a leaked/forwarded link). Because there is **no self-serve signup** (§2), they cannot get in — but they get a clear, non-confusing wall rather than a login loop:

```
┌───────────────────────────────────────┐
│  🔒  Members only                       │
│  Edison Duel is a private club. This    │
│  invite only works for members.         │
│                                         │
│  Know someone in the club? Ask them.    │
│              [ Close ]                   │
└───────────────────────────────────────┘
```

**How the gate decides "non-member":** in the closed group there is no logged-in-but-unauthorized identity, so in practice "non-member" = "cannot present valid club credentials." The gate shows the D.2 join-login first; if the visitor has no valid member login (repeated non-match, or an explicit *"I don't have a login"* affordance on the join screen), it routes to this **Members-only** wall instead of trapping them in an error loop. This keeps a genuine outsider from a frustrating dead-end while still letting a real member who fat-fingered their passcode simply retry. *(See Open Questions — the exact member/non-member detection depends on whether the identity model ever yields "authenticated but not a member"; confirm with eng/PO.)*

### D.6 Inviter learns the invite was claimed (no push notifications in V1)
When a member claims the link and enters the Pre-Duel Room, the inviter is told **in-app** (consistent with the source doc's "no push/email in V1; toast if you're mid-app" pattern):
- **On Home:** the Pending-invite card transforms to `✓ Alex joined your duel — [Enter room ▸]`.
- **If the inviter is elsewhere in-app:** a toast `Alex joined your duel — Enter room` (reuses the existing toast pattern).
- **If the inviter chose "Wait in the room":** they're already there; the empty opponent slot fills in live.

This closes the async gap: the inviter can create a link, walk away, and still find the game waiting for them on Home — no notification service required.

### D.7 Opening your OWN invite link
If the inviter taps their own link, they are **not** joined as the opponent (you can't duel yourself) — they land on **Home** with the Pending-invite card focused (Copy/Share/Revoke). Small case, explicitly handled so it can't create a broken self-duel.

**Link-open states summary (each = icon + label + color, never color alone):**

| State | Icon | User sees | Onward action |
|---|---|---|---|
| Valid, logged in | — | Pre-Duel Room | Pick deck → Ready |
| Valid, logged out | — | Join-context login | Log in & join → room |
| Already claimed | 🔒 | "This invite is already taken" | Home · Start a duel |
| Expired / revoked | ⧗ | "…has expired / canceled" | Home · Start a duel |
| Non-member | 🔒 | "Members only" | Close |
| Own link | 🔗 | Home, Pending-invite focused | Copy · Share · Revoke |

---

## §E. Pre-Duel Room — confirmed UNCHANGED (§5)

The Pre-Duel Room ships **exactly as specced in §5**. Nothing in the link-first change touches it. Confirming the points the brief calls out:

- **The per-move timer is shown to BOTH players and to the invitee *before* Start.** The room's match-settings line `⏱ Time per move: 24 hr · Format: Edison` is read-only and visible to both. Because the invitee lands here *before* readying up, they see the pace they're agreeing to before committing — the informed-consent guarantee is preserved even though there's no longer an "Accept" banner that used to state it.
- **Where the invitee picks their deck:** the old §4 "Accept → deck picker" step is gone, so the invitee's deck choice now happens **inside the room**, using the room's existing **[Change deck]** / deck slot (§5 already allows changing deck until Ready). The invitee arrives with an empty deck slot → **Pick your deck** → **Ready**. The inviter's deck is pre-filled from the Create-invite step. This is a **behavioral consequence of removing §4, not a change to §5's layout** — the room already supports it.
- Ready toggles, coin/dice first-turn decision, chat, [Start duel] (enabled only when both Ready + first turn resolved), [Leave] → all unchanged.
- The timer **locks at Start** and is not renegotiable (unchanged).

No wireframe reproduced here — see §5 of the source doc, which stands as-is.

---

## §F. Consistency with existing conventions (checklist)

- **Responsive tiers.** Desktop = single calm main column (roster rail deleted). Mobile-portrait = "Your move" pinned top, Start-a-duel primary beneath, no GROUP strip. Create-invite = modal on desktop / full-screen sheet on mobile. Tablet reflows between them (same components). One component system, three densities — unchanged philosophy.
- **Tap-first.** All controls ≥44 px. **Share uses the OS native share sheet** on mobile (the natural "into my group chat" gesture). Copy is one tap with a `✓ Link copied` toast. No drag anywhere in this flow.
- **Color + icon pairing, never color alone.** Pending invite `🔗`; near-expiry `⚠`; expiry `⧗`; claimed/members-only `🔒`; joined `✓`; deck legality chips `✓ / ⚠`. Every one carries an icon **and** a text label so status survives in colorblind-safe mode and at any text size.
- **Neutral, goal-framed copy.** The timer stays framed as "how fast do you play?"; the link facts are stated plainly ("single use · members only · expires in 24 h"); denial/used/expired messages state *what happened* and offer a next step — no blame, no dead-ends, no system jargon.
- **No presence, no matchmaking, no directed challenge** anywhere — permanently, per the decision record.

---

## Open questions (UX-level, for CEO / PO confirmation)

1. **Default link expiry = 24 h — confirm the value.** 24 h fits "drop it in chat, someone grabs it today." If the group often sets up days ahead, a longer default (or a small expiry picker on the Create screen) may fit better. I've kept expiry **fixed, not user-chosen**, to avoid a second clock in the picker — confirm that's acceptable rather than exposing it.
2. **One active outgoing invite per member — confirm.** Simplest, keeps Home unambiguous. If members will realistically want to fish for **two** simultaneous duels, the Pending-invite slot becomes a short *list* (each with its own Copy/Share/Revoke) — low cost, but it complicates Home. Flagging before committing.
3. **Non-member detection.** The Members-only wall (D.5) assumes the identity model can yield "this visitor is not a member" (or that repeated auth failure is a good enough proxy). If auth can ever produce "authenticated but unauthorized," the wall should key off that instead of failed logins. Needs an eng/PO answer on the identity model.
4. **"I don't have a login" affordance on the join screen (D.2/D.5).** Including it gives outsiders a graceful exit to the Members-only wall; omitting it keeps the login screen minimal (§2's ethos) but risks an outsider looping on a non-matching passcode. Recommend including it in the *join* context only. Confirm.
5. **Reusable-link opt-in (future, not V1).** Single-use is right for V1. If the group ever wants a standing "always-open table" link, that's a deliberate future toggle — noting it here so single-use isn't mistaken for a permanent constraint.
