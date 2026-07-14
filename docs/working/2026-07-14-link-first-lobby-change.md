# Link-First Duel Initiation — REQ-LOBBY change spec

**Author:** Product Owner (subagent) · **Date:** 2026-07-14 · **Status:** Requirements delta for CTO/eng handoff
**Supersedes:** §4 "REQ-LOBBY" (items 01–06), risk **R9**, and **AC-02** of `docs/working/2026-07-13-v1-requirements.md`.
**Grounding (do not contradict):**
- CEO decision: `/mnt/memory/yugioh-app-team-memory/decisions/2026-07-14-link-first-duel-initiation.md` (link-first; matchmaking a PERMANENT non-goal).
- Existing requirements it edits: v1-requirements §4 (REQ-LOBBY), §5 (REQ-ROOM), §15 (REQ-TIMER), §16 R9, §18 AC-02.
- Style: RFC-2119 `MUST`/`SHOULD`/`COULD`, testable statements, *Edge:* cases attached to the requirement they bear on (same as the parent doc).

**What changed at the product level:** the shareable **invite-to-play link** is now the **PRIMARY and ONLY** V1 way to start a duel. The in-app **online-presence display** and the **directed "challenge a specific online member"** system are **CUT**. The **pre-duel room** (REQ-ROOM) and the **per-move-timer informed-consent** (REQ-TIMER-01/11) are **KEPT** unchanged. **True matchmaking** (auto-pairing strangers via a queue + skill/rating) remains a **PERMANENT non-goal** — not added here.

**Model being specced:** member taps **"Start a duel"** → picks a **deck** + a **per-move timer** → app **mints a shareable invite-to-play link** (carrying that timer) → member pastes it into their **own external group chat** → an invited group member **opens the link** → lands in the **pre-duel room** → **both confirm the timer** → **Start**. Async multi-day play and the existing **"Your move" queue** (REQ-TIMER-08/09) are **unchanged**.

---

## 1. REQ-LOBBY items 01–06 — disposition + rewritten text

**Summary table**

| ID | Was | Disposition | Now |
|---|---|---|---|
| REQ-LOBBY-01 | Home = 3 primary actions incl. "Duel a friend" | **REWRITE** | Rename first action to **"Start a duel"** (mints a link); home surfaces the "Your move" queue |
| REQ-LOBBY-02 | Presence ("who's online") + pending challenges (SHOULD) | **DROP** | Cut entirely (the "Your move"/"waiting" lists live in REQ-TIMER-08/09, not here) |
| REQ-LOBBY-03 | Directed in-app challenge → Accept/Decline (MUST) | **REWRITE (replace)** | **Create invite-to-play link** (deck + timer chosen at creation) |
| REQ-LOBBY-04 | Shareable link → pre-duel room (SHOULD) | **REWRITE + PROMOTE** | **Opening the link is the primary MUST**; the only V1 path into a room |
| REQ-LOBBY-05 | No silent 2nd concurrent duel; mutual/multi-challenge edges (MUST) | **REWRITE (adjust)** | Same busy guarantee; edges re-pointed at the link model |
| REQ-LOBBY-06 | Cancel an outstanding challenge (SHOULD) | **REWRITE (adjust)** | **Revoke/cancel an unconsumed invite link** |

IDs are preserved so the CTO can swap these into §4 in place. No new IDs invented.

---

### REQ-LOBBY-01 (MUST) — REWRITE

The home screen MUST present the three primary actions **Start a duel**, **Build a deck**, **Rules & rulings**, each reachable in **one action** from landing. **"Start a duel"** MUST lead to the invite-to-play link-creation flow (REQ-LOBBY-03); it MUST NOT present any list of members to select, any online/presence indicator, or any directed-challenge affordance (those are cut — REQ-LOBBY-02). The home screen MUST also surface the **"Your move" queue** (the primary in-app duel loop; specified in REQ-TIMER-08, not restated here).
- *Edge:* a member with in-progress duels lands on home — the "Your move" queue MUST be visible without a second navigation (REQ-TIMER-08); "Start a duel" MUST remain reachable in one action regardless of how many duels are in progress.
- *Edge:* nothing pending — "Start a duel" is still present and actionable (REQ-TIMER-08 governs the empty-queue state).

---

### REQ-LOBBY-02 — **DROP**

The lobby presence display ("which group members are currently online") and the in-app "pending challenges to/from me" list are **removed from V1**. Rationale: the group's own external group chat is the presence/coordination layer (CEO decision 2026-07-14); a presence service and challenge inbox are two subsystems for a job the group already does out-of-band.

**Not lost by this drop:** the home-screen obligations that REQ-LOBBY-02 formerly *pointed at* — the **"Your move" queue** (REQ-TIMER-08, MUST) and the **"waiting on opponent"** list (REQ-TIMER-09, SHOULD) — are **unaffected** and remain the required home of the async loop. Only *human presence* and *directed-challenge inbox* are cut.

---

### REQ-LOBBY-03 (MUST) — REWRITE (replaces the directed-challenge requirement)

A member MUST be able to **create an invite-to-play link** to start a duel. In the creation flow the member MUST (a) select **one of their own saved decks** that passes legality (§2.1, REQ-DECK-09) and (b) choose a **per-move timer** value (REQ-TIMER-01/02). On confirmation the system MUST **mint a shareable invite-to-play link** that carries the chosen **per-move timer** and reserves the creator's seat (with the selected deck) in a **pending pre-duel room** (REQ-ROOM). The link is a **member-only capability** (REQ-AUTH-01): opening it requires an authenticated member (REQ-LOBBY-04). The creator then shares the link **out-of-band** (their external group chat); the app does not send it.
- *Edge (timer required):* the link MUST NOT be minted without a valid timer value; if the creator makes no explicit choice, the documented default preset applies (REQ-TIMER-01 edge; default preset is §17 Q7 / OPEN DECISION (b) below). A link carrying no/invalid timer MUST NOT be creatable (REQ-TIMER-11).
- *Edge (deck legality at creation vs Start):* the creator's deck MUST be legal to mint the link; if the creator edits/deletes that deck before Start, the room MUST re-validate at Start and block (REQ-ROOM-02 edge, REQ-DECK-16 edge).
- *Edge (no decklist leak):* the link and the invitee-side room view MUST NOT expose the **creator's decklist** — a decklist is hidden pre-duel information (REQ-DECK-17, REQ-NET-01). The link carries the timer and a room/seat reference only, never card identities.
- *Edge (link is not a credential grant):* opening the link MUST NOT create or elevate an account; a non-member who opens it is still denied (REQ-AUTH-01, REQ-LOBBY-04). The link grants entry to *one duel room*, nothing else.
- *Edge (already busy at creation):* a member who is already the occupant of an active duel or a pending/live pre-duel room MUST NOT silently mint a second concurrent duel (REQ-LOBBY-05).

---

### REQ-LOBBY-04 (MUST) — REWRITE + PROMOTE (was a SHOULD; now the primary path)

Opening an invite-to-play link MUST be the **primary and only** V1 way for a second player to enter a duel. When an **authenticated group member** opens a **valid, unconsumed** invite-to-play link, the system MUST place them into the **pre-duel room** (REQ-ROOM) as the invitee, in the **open seat** reserved by the creator (REQ-LOBBY-03), and MUST show them the duel's **per-move timer before they confirm/ready** (REQ-TIMER-11, REQ-ROOM-09). A non-member — or an unauthenticated visitor who cannot authenticate as a member — MUST be **denied** with clear feedback (REQ-AUTH-01/02); the link MUST NOT be consumed by a denied attempt.
- *Edge (auth wall):* opening the link while unauthenticated MUST route through login (REQ-AUTH-02) and, on success as a member, land in the room; on failure to authenticate as a member, deny — never silently drop.
- *Edge (invalid/expired/consumed/revoked link):* an expired, already-consumed, or creator-revoked link MUST be rejected with a **clear, specific** failure state (e.g., "this invite is no longer valid"), never a silent no-op and never a blank screen (mirrors REQ-AUTH-01 invite semantics).
- *Edge (creator opens own link):* the creator opening their own link MUST NOT create a self-duel; it MUST return them to (or keep them in) their own pending room, not claim the invitee seat.
- *Edge (invitee already busy):* a member who opens a valid link while already in an active duel or another pre-duel room MUST be blocked with clear feedback and MUST NOT consume the link (REQ-LOBBY-05).

---

### REQ-LOBBY-05 (MUST) — REWRITE (adjust edges to the link model)

A member who is already the occupant of an **active duel or a pending/live pre-duel room** MUST NOT be able to **silently** start or join a second concurrent duel. Any attempt (minting a new link, or opening a received link) in that state MUST be **blocked or explicitly queued with clear feedback** — never a silent second room. Claiming the open (invitee) seat of a pending room MUST be an **atomic single-claim** operation: exactly one member can occupy it, and one minted link MUST resolve to at most **one** room.
- *Edge (two opens race):* two members open the **same** single-use link near-simultaneously — the atomic claim MUST admit **exactly one** to the room; the loser MUST see a clear "already claimed" state (not a second room, not a silent failure).
- *Edge (open while busy):* opening a link while already in a duel/room is **blocked** with feedback and MUST NOT consume the link (so the intended invitee can still use it).
- *Edge (self-duel):* the creator cannot occupy both seats (REQ-LOBBY-04 edge).
- *Retired edges:* the former "A challenges B while B challenges A" (simultaneous mutual challenge) and "A challenges B and C at once" (multi-challenge acceptance) edges are **removed** — there is no directed-challenge mechanism to race. See §2 (R9) for the residual surface that remains.

---

### REQ-LOBBY-06 (SHOULD) — REWRITE (adjust to the link model)

A creator SHOULD be able to **revoke/cancel an unconsumed invite-to-play link** before it is opened, which invalidates it and releases the reserved seat/pending room. A revoked link MUST thereafter be rejected on open per REQ-LOBBY-04 (clear "no longer valid" state). Once a link has been **consumed** (both seats filled → a live pre-duel room), revocation no longer applies; either player instead **leaves the room** (REQ-ROOM-07), which voids the pending duel and returns both to the lobby.
- *Edge (revoke race):* if the creator revokes at the same moment an invitee opens, the outcome MUST be deterministic and single-valued — either the open wins (a room exists; use REQ-ROOM-07 to leave) or the revoke wins (the open is rejected per REQ-LOBBY-04) — never both a live room and a "revoked" state.
- *Edge (no zombie link):* a link that is neither consumed nor revoked MUST still expire on its own (OPEN DECISION (b)); revocation is an early-release convenience, not the only cleanup path.

---

## 2. Risk R9 (lobby race conditions) — largely RETIRED; residual surface

**R9 as written is retired.** Its three named failure modes — simultaneous mutual challenges, challenging-while-busy producing double rooms, and multi-challenge acceptance — **cannot occur** under link-first: there is no presence service, no challenge state machine, and no "select a member and send a challenge" path. Removing those removes the concurrency surface R9 described.

**Residual concurrency edges under the link model (narrow, and all reducible to one atomic operation — "claim the single open invitee seat / consume the link"):**

- **R9a — Two members open the same link.** Only relevant if links are single-use (OPEN DECISION (a)). Mitigation: **atomic single-claim** of the open seat (REQ-LOBBY-05); exactly one enters, the other gets a clear "already claimed" state. This is the *only* genuine race left and it is a single-row compare-and-set, not a multi-party negotiation.
- **R9b — A member opens a link (or mints one) while already in an active duel/room.** Mitigation: busy-state block with feedback; the link is **not** consumed by a blocked open (REQ-LOBBY-04/05 edges), so the real invitee can still use it.
- **R9c — Expired / consumed / revoked link opened.** Mitigation: reject with a clear, specific state, never a silent no-op or blank screen (REQ-LOBBY-04 edge). Consistent with REQ-AUTH-01 consumed/revoked-invite handling.
- **R9d — Revoke vs open race.** Mitigation: deterministic single-valued outcome (REQ-LOBBY-06 edge).
- **R9e — Creator opens own link / occupies both seats.** Mitigation: self-duel prevention (REQ-LOBBY-04/05 edges).

**Net:** R9 downgrades from "lobby race conditions (multiple interacting state machines)" to a **single atomic seat-claim/link-consume invariant**. Recommend restating R9 in §16 as: *"R9 — Invite-link seat-claim atomicity. One link MUST resolve to at most one room; claiming the open seat MUST be atomic (single-claim); expired/consumed/revoked links MUST reject explicitly; a busy member's open MUST NOT consume the link."* Severity drops from the old multi-way race to a bounded, testable invariant.

---

## 3. AC-02 — rewritten for the link flow

Replace AC-02 in §18 with:

> **AC-02 (Start-a-duel via invite link):** From the home screen, a member can **Start a duel** by selecting one of their own **legal** decks and a **per-move timer**, and the app **mints a shareable invite-to-play link** carrying that timer. When an **authenticated group member** opens the link, they land in the **pre-duel room** with the **timer shown before they confirm** (informed consent). A **non-member / un-authenticatable** opener is **denied** and the link is **not** consumed. The residual concurrency edges resolve safely: **two members opening the same single-use link** land **exactly one** in the room (the other sees a clear "already claimed" state); **opening while already in a duel/room** is blocked with feedback and does **not** consume the link; an **expired / consumed / creator-revoked** link is rejected with a **specific** failure (never a silent no-op). *(REQ-LOBBY-01/03/04/05/06, REQ-ROOM-01/09, REQ-TIMER-01/11, REQ-AUTH-01/02)*

(For context, the retired AC-02 tested directed challenge → Accept/Decline, simultaneous-mutual-challenge resolution, and declined/timed-out challenges — all removed with REQ-LOBBY-02/03. The one-room guarantee it protected is preserved above via the atomic seat-claim.)

---

## 4. Interaction with REQ-ROOM and REQ-TIMER — CONFIRMED unchanged

**REQ-ROOM (pre-duel room) — KEPT, unchanged.** The room remains the required confirmation surface between opening the link and Start. All of REQ-ROOM-01…09 still apply verbatim:
- REQ-ROOM-01 — both seats, ready state, each selected deck, and the configured **per-move timer** are shown.
- REQ-ROOM-02/03 — each player selects one of their own legal decks; the duel does not start until **both** are ready with legal decks (re-validated at Start). The **creator's** deck is pre-selected at link creation (REQ-LOBBY-03); the **invitee** selects theirs in the room.
- REQ-ROOM-04/05 — who-goes-first by a method neither can rig, shown to both (winner-of-toss-chooses per HANDOFF; §17 Q2).
- REQ-ROOM-07 — either player leaving before Start voids the pending duel and returns both to the lobby. **This is now also the "cancel after the link is consumed" path** (see REQ-LOBBY-06): pre-consume → revoke the link; post-consume → leave the room.
- REQ-ROOM-09 — the room MUST display the timer carried by the link, unchanged from challenge→room→Start (no silent alteration; any change is re-shown for re-confirmation).

**REQ-TIMER-01 — CONFIRMED.** The timer is **chosen at link-creation time** and **carried in the link**. Terminology mapping for the existing text (no rewrite of REQ-TIMER needed): the **"inviter"** in REQ-TIMER-01/11 is now the **link creator**, and **"duel-creation (challenge) time"** is now **link-mint time (REQ-LOBBY-03)**. Everything else in REQ-TIMER-01 holds: exactly one per-move value per duel, fixed once the duel starts, never an "unlimited" state, documented default preset if unset.

**REQ-TIMER-11 — CONFIRMED.** The **invitee MUST see the timer value before they confirm/ready** in the pre-duel room (REQ-ROOM-09) — informed consent to the pace of play is preserved. A link that does not carry a valid timer value (REQ-TIMER-01/02) MUST NOT be mintable or openable into a confirmable room (REQ-LOBBY-03/04 edges).

*(Cross-refs elsewhere that assume "challenge" — e.g. REQ-DUEL-02's "inviter", REQ-TIMER-01's "(REQ-LOBBY-03)" — remain valid because REQ-LOBBY-03 still exists and still owns timer selection; only its mechanism changed from directed-challenge to link-mint. No renumbering required.)*

---

## 5. OPEN DECISIONS (link semantics — these genuinely change what gets built)

Each is a product-direction call for the CEO/founder. I give my **recommended default** so the build is not blocked, plus a one-line rationale. None of these were invented as answers — they are the knobs the CEO decision explicitly left open.

- **(a) Single-use vs reusable link.** **Recommend: single-use** (one link → at most one duel). *Rationale: a duel binds exactly two seats, so single-use makes "claim the open seat / consume the link" one atomic step and eliminates the reusable-link "which of N opens starts the duel?" ambiguity; a reusable "standing" link is a nice-to-have, not needed for a 6-person group.*

- **(b) Link expiry + its default.** **Recommend: links expire, default 7 days (168 h), fixed in V1 (not per-link configurable).** *Rationale: covers realistic "I'll open it when I next check chat" behavior in a hobby group while preventing stale links accumulating; comfortably longer than the 48 h per-move ceiling so expiry never surprises an in-flight duel (expiry governs the UNOPENED link only — once Started, REQ-TIMER governs). Also resolves §17 Q7's neighbor: the timer-picker default preset — recommend **24 h** as the default per-move value (async-friendly for friends in different timezones).*

- **(c) Link bound to a specific invitee vs open to any group member.** **Recommend: open to any authenticated group member — first eligible opener claims the invitee seat; NOT bound to a named member.** *Rationale: the member-picker/presence UI was deliberately cut, and the creator already targets a specific friend by choosing which chat they paste into; binding in-app would reintroduce the very member-selection surface the CEO removed. Non-members are still denied (REQ-AUTH-01).*

- **(d) Two members open the same link / a member opens while already busy.** **Recommend: first successful claim wins (atomic single-claim); the loser sees a clear "already claimed" state; a member who opens while already in a duel/room is blocked and does NOT consume the link; the creator cannot claim their own link.** *Rationale: preserves the "one link → one room" invariant with a single compare-and-set, keeps the residual R9 surface to one testable operation (§2), and never silently strands the intended invitee.*

- **(e) Creator revoke/cancel of an unused link.** **Recommend: yes — the creator MUST be able to revoke an unconsumed link; a revoked link is rejected on open exactly like an expired one; once consumed, use REQ-ROOM-07 (leave the room) instead.** *Rationale: mirrors the affordance of the retired REQ-LOBBY-06 (cancel outstanding challenge) and REQ-AUTH-01 revoked-invite semantics; cheap to build and prevents zombie links/rooms.*

**Dependency note for the CTO:** (a) single-use is the hinge — it makes (d) a single atomic seat-claim and makes (e) a simple state flip. If the CEO instead chooses **reusable** links, then (c)/(d)/(e) all grow (a reusable link needs its own "which open starts a duel," per-open busy checks, and a distinct revoke-vs-still-live model) — i.e., reusable links partially **re-inflate R9**. Recommend confirming (a) first.
