# Yu-Gi-Oh! Edison Duel App — V1 Requirements

**Author:** Product Owner (subagent) · **Date:** 2026-07-13 · **Status:** V1 requirements for CTO/eng handoff
**Audience:** CTO + engineering + QA.
**Grounding sources (do not contradict):**
- `/workspace/product/research/edison-format.md` — format definition, banlist, deck rules, era-specific gameplay rules (cited as EF §n).
- `/workspace/product/research/engine-landscape.md` — engine/data/image ecosystem, `cards.cdb`, Edison filtering, licensing (cited as EL §n).
- `/workspace/product/research/ux-landscape.md` — competitive teardown + V1 screen inventory & UX principles (cited as UX §Bn).
- Locked decisions: `/mnt/memory/yugioh-app-team-memory/decisions/2026-07-13-*.md`.

---

## 0. How to read this document

- Requirements are `MUST` / `SHOULD` / `COULD` (RFC-2119 sense), each with a unique ID (`REQ-<AREA>-NN`) and written as a **testable** statement.
- **Edge cases** are attached to the requirement they bear on. They are things QA must exercise, not separate requirements.
- **Output contracts** (§2) pin externally observable formats character-for-character (team lesson: *Explicit Output Contracts*). Where a requirement produces an observable artifact, it references the pinned contract rather than restating it.
- **Architecture-agnostic:** per the locked governance decision, this document does **not** choose native-server vs WASM, nor card-data/image hosting. Those are CTO decisions. Requirements are phrased as observable behavior (e.g., "hidden information must never reach a client not entitled to see it") without dictating mechanism.
- **The engine owns the rules.** We reuse `ocgcore`/EDOPro + ProjectIgnis CardScripts + `cards.cdb` (EL §1). Requirements below define **what the app requests from the engine and renders for the player, and the surrounding flows** — not new rules. Where a rule is stated, it is a **correctness expectation of the engine** (a QA checklist, §REQ-RULE), not an instruction to re-implement.

### V1 scope boundary — enforce, do NOT explain (locked decision 2026-07-13)

V1 **enforces** rules and **surfaces legal moves**; it does **NOT** ship the in-duel plain-language "why is this greyed out?" explanation. To prevent load-bearing features from being cut by mistake, the boundary is:

**IN V1** (enforcement / surfacing legal moves):
- Marking cards/actions that currently **have** a legal action.
- **Priority / quick-effect response windows**: the engine pauses and offers a player their legal responses (quick effect / Trap / Spell Speed 2+) **only when they actually have one**, and auto-passes otherwise.
- Chain-stack visualization + step-by-step resolution.
- Deck-builder legality **badges** (Forbidden/Limited/Semi) and prevention of illegal decks.

**OUT of V1** (deferred to V2):
- Tapping a disabled action to read a plain-language reason.
- Deep-links from disabled actions into the rules-reference page.
- The shared `{engine reason → human string → rules anchor}` reason-mapping layer.

Every requirement below respects this boundary. Requirements never mandate a textual reason for *why* an action is unavailable.

---

## 1. Personas & top-level goals (context, not requirements)

- **The group** = the founder + a handful of friends; **closed, private, non-commercial**. No anonymous/public users ever.
- Primary jobs-to-be-done: (a) **build an Edison-legal deck**, (b) **duel a specific friend remotely**, (c) **learn/verify Edison rules** so nobody is surprised by a judge in person.
- The differentiator is a **modern, responsive, rules-enforcing** experience for a format no polished app supports (UX §A7).

---

## 2. Global conventions & OUTPUT CONTRACTS (pinned)

These are locked so downstream code, import/export, and QA all agree.

### 2.1 Deck-construction contract (EF §3, §2; locked Edison-pool decision)

| Zone | Min | Max | Contents allowed |
|---|---|---|---|
| **Main Deck** | **40** | **60** | Normal/Effect/Ritual monsters, Spells, Traps (Edison-legal pool only). Ritual **monsters live in the Main Deck**, not the Extra Deck. |
| **Extra Deck** | **0** | **15** | **Fusion and Synchro monsters only.** No Xyz/Pendulum/Link (not in pool). |
| **Side Deck** | **0** | **15** | Same pool as Main+Extra. |

- **Bounds are inclusive.** A deck of exactly 40 Main is legal; 39 is not; 60 is legal; 61 is not. Extra of exactly 15 is legal; 16 is not. Side of exactly 15 is legal; 16 is not.
- **Copy cap:** at most **3** copies of a given card **name** across **Main + Extra + Side combined**, further restricted by banlist: **Forbidden = 0, Limited = 1, Semi-Limited = 2**. The March 2010 TCG F&L List is the banlist (EF §2). Forbidden cards may not appear in **any** of the three decks.
- **"Same name" / alias:** cards that share an `alias` in `cards.cdb` (alt-arts, e.g., multiple Harpie Lady printings) count as the **same card** for the copy cap. Counting is by the resolved base card, not by distinct passcode (EL §1c).
- **Side-deck "exactly 15" ambiguity:** the game rule is 0–15. A 2010 tournament policy requiring an *exactly-15-if-used* side deck could not be verified from a primary source (EF §3 note, §8). **V1 default = 0–15.** Any strict toggle is an OPEN QUESTION (§16), not a V1 requirement.

### 2.2 Duel constants (EF §6 "same as modern")

- Starting **Life Points = 8000** per player.
- Opening hand = **5** cards.
- Hand-size limit at End Phase = **6** (discard down if over).
- **Normal Summon/Set = once per turn** (baseline; card effects may grant more).
- Turn/phase order: **Draw → Standby → Main 1 → Battle (Start / Battle / Damage / End steps) → Main 2 → End**.
- **The player who goes first DRAWS on turn 1** (Edison uses the pre-2014 rule; EF §6.2). This is a correctness expectation of the engine, not an app override.

### 2.3 `.ydk` deck file contract (import/export) — the community standard (EL §3, UX §B6; deck builder requirement REQ-DECK-14/15)

`.ydk` is the de-facto community deck interchange format (used by EDOPro, YGOPro, Dueling Nexus, edisonformat.net export). V1 MUST read and write it exactly as specified:

- **File extension:** `.ydk`. **Encoding:** UTF-8 plain text. **Line endings:** accept both `\n` (LF) and `\r\n` (CRLF) on import; **emit LF** on export.
- **Line grammar:**
  - A line whose first non-whitespace character is `#` is a **comment/section marker**.
  - The marker `#main` begins the **Main Deck** list; `#extra` begins the **Extra Deck** list; `!side` begins the **Side Deck** list. **Note the side marker uses `!`, not `#`** — this is a real, load-bearing quirk of the format; emitting `#side` is non-conformant.
  - Every non-marker, non-blank line is a single card **passcode**, expressed as a base-10 integer (the `id` in `cards.cdb` / the YGOPRODeck passcode). Leading zeros are not required and are not significant.
  - **One line per copy** (3 copies of a card = 3 identical lines).
- **Export MUST emit, in this order:** an optional first comment line `#created by <display name>`, then `#main` followed by the Main passcodes, then `#extra` followed by the Extra passcodes, then `!side` followed by the Side passcodes. A section with zero cards emits its marker followed by no passcode lines.
- **Order within a section:** preserved on export (Main in the builder's display order); order is **not** semantically meaningful and MUST NOT affect legality.
- **Round-trip guarantee:** exporting a legal deck and re-importing it MUST yield an identical Main/Extra/Side multiset of passcodes.

### 2.4 Card identity

- Cards are identified everywhere by **8-digit passcode** (`cards.cdb.id`), matching `.ydk`, the engine, and the image filenames (EL §1c, §4a).
- The **legal pool is a frozen passcode allow-list** derived once from the Edison convention and signed off by the founder (locked decision; EL §5). All legality checks reference this allow-list plus the Edison `lflist.conf`.

---

## 3. Accounts & login — REQ-AUTH (closed, invite-only group)

- **REQ-AUTH-01 (MUST):** The system MUST NOT offer public self-service signup or any public user discovery/search. A new account can be created **only** via an invite issued by an existing admin/founder (invite link or invite code).
  - *Edge:* an invite already consumed MUST NOT create a second account; a revoked/expired invite MUST be rejected with a clear failure (not a silent no-op).
- **REQ-AUTH-02 (MUST):** A user MUST authenticate before reaching any lobby, deck, or duel surface. Unauthenticated requests to those surfaces MUST be rejected (no data returned).
- **REQ-AUTH-03 (MUST):** An authenticated session MUST persist across page reloads and MUST be usable to re-attach to an in-progress duel (see REQ-NET-05 reconnect).
- **REQ-AUTH-04 (SHOULD):** An admin SHOULD be able to **revoke** a member; a revoked member MUST immediately lose access to all surfaces (existing session invalidated).
- **REQ-AUTH-05 (SHOULD):** The system SHOULD support credential recovery (e.g., reset) without exposing whether an arbitrary identifier belongs to a member (no account-enumeration oracle).
- **REQ-AUTH-06 (MUST):** Display names MUST be shown to other group members; the system MUST tolerate duplicate/confusable display names by also carrying a stable unique user id internally (so challenges/duels bind to the id, not the display string).
  - *Edge:* two members choose the same display name — challenges, duel seats, and logs MUST still resolve unambiguously.
- **REQ-AUTH-07 (COULD):** The system COULD let a member edit their own display name and cosmetic profile (card-back/theme) — cosmetic only, no effect on identity.

---

## 4. Home / lobby & challenge-a-friend — REQ-LOBBY (UX §B7)

- **REQ-LOBBY-01 (MUST):** The home screen MUST present the three primary actions **Duel a friend**, **Build a deck**, **Rules & rulings**, each reachable in one action from landing.
- **REQ-LOBBY-02 (SHOULD):** The lobby SHOULD show which group members are currently **online** and SHOULD show any **pending challenges** addressed to or from the current user.
- **REQ-LOBBY-03 (MUST):** A user MUST be able to **challenge** another group member by selecting them, which sends that member a challenge they can **Accept** or **Decline**.
  - *Edge:* challenging an **offline** member — the challenge is either queued/notified or blocked with clear feedback (define one behavior; do not silently drop). *Edge:* challenge **declined** returns the challenger to the lobby with feedback. *Edge:* challenge **times out** with no response — it MUST expire and free both users (no zombie challenge).
- **REQ-LOBBY-04 (SHOULD):** A user SHOULD be able to create a shareable **invite/challenge link** (to paste into an external group chat) that, when opened by an authenticated member, drops them into the pre-duel room. Non-members opening the link MUST be denied (REQ-AUTH-01).
- **REQ-LOBBY-05 (MUST):** A user who is already in an active duel or pre-duel room MUST NOT be able to silently start a second concurrent duel; a new challenge in that state MUST be blocked or queued with clear feedback.
  - *Edge:* **A challenges B while B is simultaneously challenging A** — the system MUST resolve to a single duel room, not two.
  - *Edge:* **A challenges B and C at once** — at most one can be accepted into a room; accepting one MUST invalidate the other or clearly reflect the busy state.
- **REQ-LOBBY-06 (SHOULD):** A challenger SHOULD be able to **cancel** an outstanding challenge before it is accepted, releasing the invitee.

---

## 5. Pre-duel room — REQ-ROOM (UX §B7)

- **REQ-ROOM-01 (MUST):** The room MUST show both seats, each player's **ready state**, and the **deck each has selected**.
- **REQ-ROOM-02 (MUST):** A player MUST select one of **their own saved decks** before they can ready-up. A deck that fails legality (§2.1) MUST NOT be selectable for a duel (see REQ-DECK-09).
  - *Edge:* a player edits/deletes the selected deck between selection and start — the room MUST re-validate at Start and block if the deck is now missing/illegal.
- **REQ-ROOM-03 (MUST):** The duel MUST NOT start until **both** players are ready with legal decks selected.
- **REQ-ROOM-04 (MUST):** The room MUST determine **who goes first** by a method **neither player can rig**, and MUST show the result to both players before the duel starts.
  - *Edge:* a player disconnects **during** the first-turn determination — on reconnect the determined result MUST be consistent for both (no re-roll that could differ per client).
- **REQ-ROOM-05 (SHOULD):** V1 SHOULD implement the tournament-accurate flow: the **winner of the toss chooses to go first or second** (rather than the app forcing an assignment). If not implemented, the fallback MUST be a fair random assignment (REQ-ROOM-04). *(Which of these the group wants is an OPEN QUESTION, §16.)*
- **REQ-ROOM-06 (COULD):** The room COULD provide lightweight text chat between the two players (friends want to talk trash — UX §B7). Chat MUST NOT carry any hidden game information.
- **REQ-ROOM-07 (MUST):** Either player MUST be able to **leave** the room before Start, which returns both to the lobby and voids the pending duel.
- **REQ-ROOM-08 (SHOULD):** V1 targets **single games** per duel by default. Best-of-3 matches with **side-decking between games** are NOT required for V1; if a match mode is added, side-deck swaps MUST re-validate against §2.1. *(Match support is an OPEN QUESTION, §16 — it interacts with the side-deck's purpose.)*

---

## 6. Deck builder & deck management — REQ-DECK (UX §B6; EF §2–3; EL §4–5)

### Construction & legality

- **REQ-DECK-01 (MUST):** The builder MUST enforce the deck-construction contract in **§2.1** exactly (Main 40–60, Extra 0–15 Fusion/Synchro only, Side 0–15, ≤3/name, banlist caps across all three combined).
  - *Edge:* exactly-40 / exactly-60 Main accepted; 39 / 61 rejected. Exactly-15 / 16 Extra and Side likewise.
  - *Edge:* a **Semi-Limited** card placed 1 in Main + 1 in Side = 2 total = legal; adding a 3rd anywhere = illegal (combined count).
  - *Edge:* a **Forbidden** card MUST be un-addable to any of the three zones.
  - *Edge:* attempting to add a **Ritual monster** places it in **Main**, never Extra; attempting to add a **Fusion/Synchro** places it in **Extra**.
- **REQ-DECK-02 (MUST):** Only cards on the **frozen Edison passcode allow-list** (§2.4) MUST be addable to a deck. Cards outside the pool (later sets, HA carve-outs, Xyz/Pendulum/Link) MUST NOT be addable.
  - *Edge:* a card printed in-window but documented as not-Edison-legal (some Hidden Arsenal cards, EF §1) MUST be treated as out-of-pool.
- **REQ-DECK-03 (MUST):** Each card MUST display a persistent **legality badge**: Forbidden, Limited (max 1), Semi-Limited (max 2), or unrestricted (max 3). Badges MUST pair colour with an icon/label, never colour alone (REQ-UX-06).
- **REQ-DECK-04 (MUST):** When a card is at its allowed copy count for the current deck, the builder MUST prevent adding further copies (silent enforcement — no explanatory tooltip required in V1; the badge + disabled state is sufficient).
- **REQ-DECK-05 (MUST):** The builder MUST show **live per-zone counts** (Main / Extra / Side) and a **validity indicator** that reflects §2.1 in real time as cards are added/removed.
- **REQ-DECK-06 (MUST):** Alias/alt-art copies MUST count toward the same card's cap (§2.1); the builder MUST NOT allow 3× "Harpie Lady art A" + 3× "art B" to bypass the 3-copy rule.
- **REQ-DECK-07 (SHOULD):** The builder SHOULD show deck statistics: monster/spell/trap split, level/attribute distribution, **Tuner count** (Synchro-relevant), and a list of cards currently at their cap (UX §B6).
- **REQ-DECK-08 (MUST):** The system MUST prevent **saving** a deck flagged as usable/complete in an illegal state OR MUST clearly persist it as an explicitly-marked **invalid draft** that cannot be selected for a duel. Choose one; either way an illegal deck MUST NEVER be usable in a duel (see REQ-ROOM-02).
- **REQ-DECK-09 (MUST):** A deck MUST pass §2.1 validation to be **selectable for a duel**. The same validation MUST run server-side/authoritatively at duel start (client validation is not trusted alone).

### Search, filter, inspect

- **REQ-DECK-10 (MUST):** The builder MUST provide a **text search** by card name.
- **REQ-DECK-11 (SHOULD):** The builder SHOULD provide filters matching the proven Nexus set (UX §B6): card category (Monster/Spell/Trap), monster Type/race, Attribute, Level, ATK/DEF range, effect-text search, and banlist status.
- **REQ-DECK-12 (MUST):** Results MUST default to the **Edison pool only**. Showing out-of-pool cards (as non-addable, clearly marked) is a COULD; if offered it MUST be an explicit toggle, and such cards MUST remain un-addable (REQ-DECK-02).
- **REQ-DECK-13 (MUST):** Tapping/selecting any card MUST open a **Card Inspector** showing full, legible card text + stats + art (shared component with the duel field and rules page — UX §B6, §B9). *Rulings text* in the inspector is a COULD in V1 (the standalone rules page, REQ-REF, is the required home for rulings).

### Import / export / management

- **REQ-DECK-14 (MUST):** The builder MUST **export** a deck to `.ydk` per the contract in **§2.3**.
- **REQ-DECK-15 (MUST):** The builder MUST **import** a `.ydk` file per **§2.3**, routing cards to Main/Extra/Side by the file's section markers, and MUST validate the result against §2.1–§2.4.
  - *Edge (illegal import):* an imported deck that violates size/copy/pool rules MUST be loaded into an explicitly-marked **invalid** state showing which rules are violated (which cards are out-of-pool / over-limit / which zone is out of range) — it MUST NOT be silently truncated or silently accepted, and MUST NOT be usable in a duel until fixed.
  - *Edge (foreign deck):* importing a **modern** deck containing Xyz/Pendulum/Link monsters or later-set cards — those cards MUST be flagged as out-of-pool per card, not cause a crash or an all-or-nothing failure.
  - *Edge (unknown passcode):* a passcode not present in `cards.cdb`/allow-list MUST be reported with the offending line/passcode, not silently dropped.
  - *Edge (malformed file):* missing section markers, `#side` instead of `!side`, blank file, or non-numeric card lines MUST produce a clear, specific error (state what/where), not a partial mystery import. Comment lines other than the recognized markers MUST be ignored.
  - *Edge (wrong-zone listing):* a Fusion/Synchro erroneously listed under `#main` (or a Main-only card under `#extra`) MUST be corrected to its proper zone or flagged, never placed somewhere that violates §2.1.
- **REQ-DECK-16 (MUST):** "My Decks" MUST let a user **list, open, rename, duplicate, and delete** their own saved decks.
  - *Edge:* deleting a deck currently selected in a pre-duel room MUST be handled (block deletion or force re-selection — do not leave a room pointing at a deleted deck; see REQ-ROOM-02).
- **REQ-DECK-17 (MUST):** A user MUST only be able to view/edit **their own** decks (no access to others' decklists — this is hidden pre-duel information; a decklist is not shared with the opponent). *Sharing a deck by link is a COULD and, if added, is an explicit user action.*

---

## 7. Remote 1v1 duel — field & flow — REQ-DUEL (EF §6; UX §B2–B5)

**Framing:** the engine drives the state machine and emits the set of legal decisions; the app renders state and turns the player's choice into an engine response (EL §2a). Requirements describe what the app must render/request, not new rules.

### Board & state rendering

- **REQ-DUEL-01 (MUST):** The field MUST render, for both players, the Edison zone set: 5 Monster Zones, 5 Spell/Trap Zones, 1 Field Spell zone, Deck, **Extra Deck (Fusion/Synchro)**, Graveyard, and Banished zone. It MUST NOT render Extra Monster Zones, Pendulum scales, or Link arrows (not in Edison — EF §4, UX §B2).
- **REQ-DUEL-02 (MUST):** At all times the field MUST answer three questions at a glance (UX §B0.3): **whose turn & which phase**, **both players' Life Points**, and **what the game is currently waiting on this player to do**.
- **REQ-DUEL-03 (MUST):** The current phase MUST be shown on a persistent phase indicator, with only the legal next phase(s)/actions enabled; the player MUST be able to advance phases and **end their turn** through it (UX §B2).
- **REQ-DUEL-04 (MUST):** Life Points MUST be shown as a **number** (bar is a SHOULD) for both players and MUST update to reflect every engine-reported LP change.
- **REQ-DUEL-05 (SHOULD):** LP changes SHOULD render a visible delta (e.g., "−1800") so damage math is auditable/legible (UX §B2, teaching value).
- **REQ-DUEL-06 (MUST):** Cards/actions that currently **have at least one legal action** MUST be visibly marked as actionable (UX §B0.1, §B2). The app MUST NOT display a textual reason for cards that have **no** legal action (that explanation is V2 — §0 boundary). Simple visual disabling/omission is allowed; a "why" string is not.
- **REQ-DUEL-07 (MUST):** The opponent's hand MUST render as a **face-down count only**; opponent deck order, set (face-down) Spell/Trap cards, and face-down defence-position monsters MUST render as concealed (identity hidden) to this player (see REQ-NET-01 hidden info).

### Summoning & actions (engine-offered)

- **REQ-DUEL-08 (MUST):** The app MUST support the player performing every in-era summon/action **when the engine offers it as legal**: Normal Summon, Normal Set, Tribute (Advance) Summon, Flip Summon, Special Summon, **Fusion Summon** (incl. Contact Fusion), **Ritual Summon**, and **Synchro Summon** (EF §4). It MUST NOT present Xyz/Pendulum/Link summon UI.
- **REQ-DUEL-09 (MUST):** When the engine requires a **sub-selection** (tributes to release, Fusion/Synchro materials, Ritual tribute set, a target, a position face-up/face-down attack/defence, a zone), the app MUST render the engine's prompt and let the player make exactly the choice the engine expects, then submit it as the engine response (EL §2a).
  - *Edge:* Synchro material selection where multiple non-Tuner combinations sum to the exact Level — the app MUST let the player pick among the engine-offered valid combinations (EF §6.5).
  - *Edge:* GY-based / card-specific Synchro exceptions (e.g., Blackwing - Vayu) — the app MUST faithfully render whatever the engine offers; it MUST NOT hard-code the "Tuner + non-Tuner on field" assumption in a way that hides an engine-offered alternative (EF §6.5).
  - *Edge:* choosing summon **position** (face-up attack, face-up defence, face-down defence) — the app MUST honor which positions the engine allows for that summon type (e.g., no face-down for a Special Summon that specifies face-up).
- **REQ-DUEL-10 (MUST):** The app MUST render the **Battle Phase** interactions the engine offers: declaring attacks, choosing attack targets (incl. direct attacks), and any Damage Step decision points the engine surfaces (EF §6.3). It MUST NOT let the player declare an attack the engine has not offered.
  - *Edge:* Damage-Step activation is restricted in this era (EF §6.3) — the app must only offer what the engine offers during the Damage Step (e.g., Honest-type ATK/DEF modifiers, Counter Traps), and auto-pass otherwise.

### Hand size, win/loss/draw, surrender

- **REQ-DUEL-11 (MUST):** At the End Phase, if the player's hand exceeds 6, the app MUST render the engine's **discard-to-6** prompt and submit the player's choice (§2.2).
- **REQ-DUEL-12 (MUST):** The app MUST detect and render **game end** as reported by the engine and route both players to the post-duel summary (REQ-LOG-04). Recognized end states: a player's LP reaches **0**; **deck-out**; an **alternate win condition** fired by a card effect (e.g., assembling all five Exodia pieces — the pieces are in-pool/Limited, EF §2); mutual/simultaneous end = **DRAW**; **surrender**.
  - *Edge (deck-out):* a player loses when they are **required to draw and cannot** (empty deck at draw), **not** merely when their deck becomes empty (EF §6 — Master Rule draw rule). QA must confirm the timing.
  - *Edge (simultaneous):* both players reach 0 LP in the same resolution → **DRAW**, rendered as such for both.
  - *Edge (Exodia):* assembling all five pieces in hand triggers an immediate win — the app must render this win reason.
- **REQ-DUEL-13 (MUST):** A player MUST be able to **surrender/concede** at any point during their duel; on surrender the opponent is recorded as the winner and both are routed to the summary.
  - *Edge:* surrender **mid-chain** or **mid-response-window** must cleanly end the duel without leaving the other client stuck awaiting a response.
- **REQ-DUEL-14 (SHOULD):** The duel outcome (winner/loser/draw + reason) SHOULD be persisted so it appears in each player's history and in the post-duel summary (REQ-LOG-04).

---

## 8. Chains, priority & quick-effect response windows — REQ-CHAIN (EF §6.1, §6.6; UX §B4; locked decision — this is IN V1)

- **REQ-CHAIN-01 (MUST):** The app MUST present a **response/priority window to a player only when the engine indicates that player currently has ≥1 legal response** (quick effect / Trap / Spell Speed 2+). When the engine reports no legal response, the app MUST **auto-pass** without prompting (locked decision; EL §2a — the engine drives this).
- **REQ-CHAIN-02 (MUST):** A response prompt MUST clearly offer **Respond/Activate…** vs **Pass**, and MUST keep the board readable behind it (non-blocking of context — UX §B4). A player MUST NOT be able to accidentally pass a response they intended to make in a single stray tap (the choice is explicit).
- **REQ-CHAIN-03 (MUST):** V1 response windows have **no countdown timer** (friends, UX §B4/open-Q3); the prompt UI MUST leave structural room for a future soft timer without requiring one now.
- **REQ-CHAIN-04 (MUST):** As chain links are added, the app MUST render a **chain stack**: each link shown with its card and its **owner**, in resolution order (Link 1 resolves last; the most-recently-added link resolves first) (UX §B4).
- **REQ-CHAIN-05 (MUST):** The app MUST play back **resolution step-by-step**, indicating which link is resolving, in the order the engine resolves them. (V1 shows *what* resolves and in *what order*; it does not add a plain-language *why* — §0 boundary.)
- **REQ-CHAIN-06 (MUST):** Targeting prompts MUST clearly distinguish **valid targets** (selectable) from invalid ones (not selectable), using shape/state, not colour alone (UX §B3, REQ-UX-06).
- **REQ-CHAIN-07 (MUST):** The app MUST correctly surface the **Edison ignition-effect priority** window: after a Summon, when the engine offers the **turn player** the chance to activate an Ignition Effect **with priority** (before the opponent's Spell-Speed-2 window), the app MUST render that as an available action (EF §6.1). This is the single most important era-specific interaction — see REQ-RULE-02.
- **REQ-CHAIN-08 (MUST):** When the engine requires the player to **order simultaneous effects** on a chain (SEGOC — EF §6.6), the app MUST render that ordering choice and submit it.
  - *Edge:* mixed mandatory/optional, turn-player vs non-turn-player ordering — the app renders whatever ordering decision the engine asks for; it must not impose its own ordering.

---

## 9. Edison-era rule correctness — REQ-RULE (engine configuration + QA checklist) (EF §6)

**These are correctness expectations of the reused engine, not app-implemented rules.** The app's obligation is (a) to run the engine **configured to Edison-era behavior**, and (b) to faithfully render/pass whatever the engine produces. QA MUST verify each item against a live duel. If the chosen engine build cannot reproduce an item, that is a **flow break** (see §15, R1) to escalate — not something the app should paper over.

- **REQ-RULE-01 (MUST):** The engine MUST be configured to the **Master Rule (1st edition, 2008–2011) / March 2010** ruleset and the **March 2010 TCG banlist** (`lflist.conf`), with the frozen Edison pool loaded (EF §6.7, §2; EL §5). QA verifies via the checklist below.
- **REQ-RULE-02 (MUST — verify):** **Ignition Effect Priority is IN EFFECT.** After a Summon, if no Trigger Effect activates, the **turn player may activate a monster Ignition Effect as Chain Link 1 with priority**, before the opponent can respond with a Spell-Speed-2 effect (e.g., Bottomless Trap Hole / Torrential Tribute) — and it need not be the just-summoned monster (EF §6.1). *QA test:* Summon a monster with an ignition effect while the opponent holds Bottomless Trap Hole; confirm the turn player is offered priority to activate before the opponent's response window.
- **REQ-RULE-03 (MUST — verify):** **The player who goes first draws on turn 1** (EF §6.2). *QA test:* start hands = 5; after going first and entering Draw Phase, the first player's hand becomes 6 (they drew).
- **REQ-RULE-04 (MUST — verify):** **Damage Step activation follows the pre-2014 model** (restrictive: Counter Traps, mandatory triggers, direct ATK/DEF modifiers like Honest) (EF §6.3). *QA test:* attempt to activate a non-Damage-Step-legal card during the Damage Step and confirm it is not offered; confirm Honest-type and Counter Traps are offered.
- **REQ-RULE-05 (MUST — verify):** **Field Spell behavior is pre-MR3**: a single shared Field Spell context, and activating a new Field Spell **destroys** the existing one (including the opponent's) rather than the modern per-player field zone that sends the old one to the GY (EF §6.4, labelled an inference grounded in the MR3 change text). *QA test:* with a Field Spell active, activate a new Field Spell and confirm the previous one is destroyed per pre-2014 behavior. *(This item carries the most uncertainty in the research — flag if engine differs; §16.)*
- **REQ-RULE-06 (MUST — verify):** **Synchro Summon procedure** = 1 Tuner + one or more non-Tuners whose Levels sum **exactly** to the Synchro Monster's Level, from the Extra Deck (EF §6.5). Card-specific exceptions accommodated (REQ-DUEL-09 edge).
- **REQ-RULE-07 (MUST — verify):** Duel constants hold: **8000** starting LP, **5**-card opening hand, hand limit **6**, one Normal Summon/Set per turn, standard phase order (§2.2, EF §6).
- **REQ-RULE-08 (MUST):** The app MUST NOT allow any in-pool card that belongs to an **out-of-era mechanic** (Xyz/Pendulum/Link) to enter a duel — this is guaranteed upstream by the frozen pool (REQ-DECK-02) but MUST also hold at duel start validation (REQ-DECK-09).

---

## 10. Networking, hidden information & connection handling — REQ-NET (EL §2b, §3, §6; locked governance = architecture-agnostic)

- **REQ-NET-01 (MUST):** **Hidden information MUST never be transmitted to a client not entitled to see it.** Specifically, a player's client MUST NOT receive the identities of: the opponent's hand cards, the opponent's deck contents or order, the opponent's set (face-down) Spell/Trap cards, or the opponent's face-down defence monsters — until/unless a game effect legitimately reveals them to that player. This is a hard requirement regardless of the chosen architecture (native-server vs WASM) (EL §3, §6).
  - *Edge (legitimate reveal):* effects that reveal hidden cards to a specific player (e.g., Trap Dustshoot revealing the opponent's hand to its controller; hand-peek effects) MUST show the revealed information **only to the entitled player**, and any re-concealment afterward MUST be honored. The app must never over-reveal beyond what the engine reveals.
  - *Edge (Flip):* a Flip monster / face-down flipped face-up becomes public and MUST then render for both players.
- **REQ-NET-02 (MUST):** The authoritative duel state MUST live where the opponent cannot read another player's hidden state from their own client (e.g., not by inspecting client memory/network). *(How — server authority, redaction, etc. — is the CTO's choice; the observable requirement is no leak.)*
- **REQ-NET-03 (MUST):** All rules/ruling resolution during a duel MUST use the **self-hosted** engine + card data; the app MUST make **no external network call to any third-party rules/ruling service mid-duel** (EL §6, project constraint "no external ruling calls").
- **REQ-NET-04 (MUST):** On a player **disconnect**, the duel state MUST be preserved (no corruption, no loss of the pending decision) and the opponent MUST be informed the player disconnected. Hidden information MUST remain hidden throughout.
  - *Edge (mid-chain):* disconnect while a chain is building or resolving MUST resume at the exact same decision point on reconnect, with no double-resolution and no skipped link.
  - *Edge (mid-response-window):* if a player disconnects while it is their response window, V1 behavior MUST be defined and consistent (candidate: hold the window open pending reconnect for the friends use-case, vs auto-pass). *This exact policy is an OPEN QUESTION — §16.*
- **REQ-NET-05 (MUST):** A disconnected player MUST be able to **reconnect** to the in-progress duel (via their authenticated session, REQ-AUTH-03) and be restored to the **current, correctly-redacted** state.
  - *Edge (seat integrity):* only the rightful player may reclaim a seat; a reconnect MUST NOT let anyone else attach to that seat and thereby view its hidden information.
  - *Edge (both disconnect):* if both players drop, the duel state MUST survive for later reconnection (or be resolved by a defined policy).
- **REQ-NET-06 (SHOULD):** The system SHOULD define a **prolonged-disconnect** policy (how long a duel is held before it is abandoned/forfeit). *Default and exact policy is an OPEN QUESTION (§16); V1 MUST NOT silently auto-forfeit without a defined, communicated rule.*

---

## 11. Rules & rulings reference page — REQ-REF (UX §B8; EF §6)

- **REQ-REF-01 (MUST):** V1 MUST include a **standalone, static, searchable** rules & rulings reference covering the game **through Edison**, readable on its own without opening a duel.
- **REQ-REF-02 (MUST):** Content MUST cover, at minimum: turn structure/phases; summon types (incl. **Synchro/Tuners**, Fusion, Ritual, Flip); chains, priority & SEGOC; card types (Normal/Effect/Ritual/Fusion/Synchro/Gemini/Union/Spirit/Flip); and the **Edison-specific banlist + notable era rulings** (EF §6, §7). It MUST reflect **March 2010** rules/banlist, not the modern game.
- **REQ-REF-03 (MUST):** The reference MUST be served from **self-hosted** content with **no external calls** at read time (consistent with REQ-NET-03).
- **REQ-REF-04 (SHOULD):** Sections SHOULD have **deep-linkable anchors** (stable URLs/ids) so future features can jump to a rule. *(Note: the disabled-action → rules-page deep-link and the reason-mapping layer are V2 — §0 boundary. The anchors themselves may exist in V1.)*
- **REQ-REF-05 (MUST):** The reference MUST be usable on mobile: collapsible sections, persistent/sticky search, and body text meeting REQ-UX-05.
  - *Edge:* a search with no matches MUST show a clear empty state, not a blank page.

---

## 12. Duel log & post-duel summary — REQ-LOG (UX §B1.10)

- **REQ-LOG-01 (MUST):** During a duel, the app MUST maintain a **chronological action log** of significant engine-reported events: phase/turn changes, draws (the viewer's own), summons, card activations, chain builds and per-link resolutions, LP changes, attacks/battle results, and card movements between zones.
- **REQ-LOG-02 (MUST):** The log a player sees MUST respect hidden information: it MUST only include information that player was **entitled to see at the moment it occurred** (REQ-NET-01). It MUST NOT retroactively leak the opponent's hidden cards.
  - *Edge (post-duel full reveal):* whether the summary reveals both full decklists **after** the game ends is an OPEN QUESTION (§16). V1 default = show only what was revealed during play.
- **REQ-LOG-03 (MUST):** A player MUST be able to **scroll back** through the log during and after the duel to review what happened, in order.
- **REQ-LOG-04 (MUST):** On game end, the app MUST show a **post-duel summary** stating the **winner/loser or draw** and the **end reason** (LP to 0 / deck-out / effect win / surrender), plus turn count. LP timeline/key events are a SHOULD.
- **REQ-LOG-05 (SHOULD):** The completed log/summary SHOULD be **reviewable later** from a duel-history list (it is the teaching artifact; note V1 records *what* happened, not *why* — §0 boundary).
  - *Edge (long duels):* the log MUST remain performant and complete for long games (no truncation that loses events).
- **REQ-LOG-06 (COULD):** The log/replay COULD be exportable (e.g., a shareable replay/log file) for later study.

---

## 13. Cross-cutting: responsive UX & accessibility — REQ-UX (UX §B2–B5, §B9)

- **REQ-UX-01 (MUST):** All primary surfaces (lobby, deck builder, duel field, rules page, summary) MUST be usable and correctly laid out across **phone-portrait, tablet, and desktop** widths using one responsive layout system (UX §B5e).
- **REQ-UX-02 (MUST):** On the duel field, **every action MUST be completable by tap** (tap card → choose action → choose destination). **Drag MUST NOT be required** for any action (drag MAY be an optional desktop accelerator) (UX §B5b).
- **REQ-UX-03 (MUST):** On phone-portrait, the duel field MUST use the "**your-field-first**" model: the current player's half rendered full-size and actionable; the opponent's half compressed into a status strip (LP, hand count, thumbnail zones) that expands on demand (UX §B5a). The player MUST NOT be required to zoom in order to act on their own board.
- **REQ-UX-04 (MUST):** **Reading a card is always available**: from any zone/hand/list, one deliberate action (tap art / long-press) MUST open the full-size, legible **Card Inspector** with full effect text. Inspecting MUST be separable from acting so a player can read a card without risking triggering it (UX §B5c, §B9).
- **REQ-UX-05 (MUST):** Minimum touch-target ≈ **44px**; minimum mobile body text ≈ **16px**; the app MUST respect the OS/browser text-size setting (UX §B9).
- **REQ-UX-06 (MUST):** Meaning MUST NOT be encoded in **colour alone**. Banlist status, card ownership (you vs opponent), and legal/illegal/actionable states MUST each pair colour with an icon/shape/label (colorblind-safe — UX §B9).
- **REQ-UX-07 (SHOULD):** The app SHOULD provide a **reduced-motion** setting that keeps LP/chain/resolution feedback informative without animation (vestibular sensitivity, low-end phones — UX §B9).
- **REQ-UX-08 (SHOULD):** The app SHOULD ship a legible **dark theme** with sufficient contrast (the community reaches for dark-mode fixes on incumbents — UX §B9).
- **REQ-UX-09 (MUST):** At board size, cards MUST render **art + name + key stats** (ATK/DEF/Level/Attribute) legibly; the app MUST NOT rely on the player reading full effect text at zone size (full text is one tap away, REQ-UX-04) (UX §B9).
- **REQ-UX-10 (SHOULD):** The layout logic SHOULD be kept portable toward a future native app and MUST NOT design out the V2 "why?" explanation layer (reserve the seam; don't build it) (UX §B0.6, §B10).

---

## 14. Card data & Edison pool (self-hosted) — REQ-DATA (EL §1, §4, §5; locked Edison-pool decision)

- **REQ-DATA-01 (MUST):** The Edison legal pool MUST be a **frozen passcode allow-list** built once from the edisonformat.net convention (through Duelist Pack: Kaiba; TSHD and later excluded; documented HA/other carve-outs excluded) and **signed off by the founder** before lock (locked decision; EF §1, §8).
- **REQ-DATA-02 (MUST):** Card **metadata and images** MUST be **self-hosted** (no runtime hotlinking to third-party CDNs) (EL §4a terms, §6b). No external calls are made during a duel (REQ-NET-03).
- **REQ-DATA-03 (MUST):** Banlist legality MUST be driven by an **Edison `lflist.conf`** (March 2010 TCG) consistent with the deck-builder caps in §2.1 (EL §5).
- **REQ-DATA-04 (MUST):** The pool MUST contain **no** Xyz/Pendulum/Link cards and no post-cutoff cards (EF §4; enforced by REQ-DATA-01).
- **REQ-DATA-05 (SHOULD):** The deck-builder display dataset and the engine's `cards.cdb` MUST agree on card identity (passcode) and legality; where they draw from different sources (e.g., display metadata vs engine truth — EL §4b), the build pipeline SHOULD reconcile them so a card cannot be builder-legal but engine-illegal (or vice versa).

---

## 15. Flow breaks & risks (things I expect to bite)

1. **R1 — Does the reused engine reproduce Edison-era rules out of the box? (HIGHEST RISK.)** Current `ocgcore`/CardScripts target the *modern* ruleset. The era-defining behaviors the founder cares about — **ignition-effect priority** (REQ-RULE-02), first-turn draw, pre-2014 Damage Step, pre-MR3 Field Spell (REQ-RULE-03/04/05) — were *removed* from the game after Edison. If the chosen build cannot be configured to reproduce them (EDOPro exposes duel-rule/master-rule options and the community runs Edison lobbies, but ignition priority specifically is uncertain), the "accuracy is sacred" promise fails on exactly the rules that make Edison *Edison*. **This must be a first spike (goes with EL's Spike 1), before UI investment.**
2. **R2 — Boundary confusion around "enforce but don't explain."** The line between "mark actionable cards / show response windows" (IN) and "explain why an action is unavailable" (OUT) is subtle. Risk in both directions: engineers over-build the V2 reason tooltip, or under-build and hide legal options. §0 + REQ-DUEL-06 + REQ-CHAIN-01 pin the boundary; QA must test that legal options are surfaced **and** that no "why" strings appear.
3. **R3 — Hidden-information leakage, especially on reconnect and legitimate reveals.** A client must never receive the opponent's hidden cards (REQ-NET-01/02). The sharp edges: reconnect must re-redact per seat (no seat hijack), and reveal-effects (Trap Dustshoot, hand-peeks) must reveal *only* to the entitled player and re-conceal after. A WASM-in-browser architecture makes this materially harder (full state in the client) — flagged to the CTO, who owns the architecture choice.
4. **R4 — Disconnect mid-chain / mid-response-window.** Resuming at the exact engine decision point with no double-resolution, and defining what happens to a **pending response** on disconnect (hold vs auto-pass), is unspecified in the research. REQ-NET-04 requires a defined, consistent behavior; the exact policy is an open question.
5. **R5 — `.ydk` import of illegal/foreign decks.** Modern decks (Xyz/Link/Pendulum), out-of-pool cards, over-limit copies, and malformed files (`#side` vs `!side`) must fail *informatively* per card/line, never crash or silently mutate the deck (REQ-DECK-15). This is the most likely user-facing data-quality bug.
6. **R6 — Alias / alt-art copy-limit evasion.** If copy counting keys on raw passcode instead of the resolved `alias` base, a user can slip 6 "Harpie Lady" or extra alt-art copies past the 3-cap/banlist (REQ-DECK-06). Easy to get wrong; must be tested explicitly.
7. **R7 — Deck-out timing.** Losing must trigger on *failing a required draw from an empty deck*, not on the deck merely reaching zero (REQ-DUEL-12). A naive "deck empty = loss" implementation is a rules bug.
8. **R8 — First-player / first-turn-draw interaction.** Who chooses play/draw (REQ-ROOM-05) and the Edison first-turn-draw (REQ-RULE-03) must both be honored; getting either wrong is an immediately-noticeable correctness bug.
9. **R9 — Lobby race conditions.** Simultaneous mutual challenges, challenging while busy, and multi-challenge acceptance (REQ-LOBBY-05) can produce two rooms or a zombie challenge if not resolved atomically.
10. **R10 — Field-Spell model divergence.** If the engine models modern per-player Field Spell zones, it will diverge from pre-MR3 single-shared-destroy behavior (REQ-RULE-05); this is the research's lowest-confidence rule and needs live verification.

---

## 16. Open questions (product-direction — for the CEO/founder; I did not invent answers)

1. **Side deck: 0–15 vs exactly-15-if-used.** Research could not verify a 2010 "exactly 15" tournament rule (EF §3, §8). V1 defaults to 0–15 (§2.1). Does the group want a strict "0 or 15" toggle?
2. **Who goes first: winner-of-toss chooses, or app auto-assigns?** REQ-ROOM-05 prefers the tournament-accurate "winner chooses play/draw"; confirm this is wanted vs a simple random first-player.
3. **Match play (Bo3) with side-decking.** V1 defaults to single games (REQ-ROOM-08). Do the friends want best-of-3 matches (which is the whole point of a Side Deck) in V1, or is that deferred?
4. **Pending-response behavior on disconnect.** Hold the window open pending reconnect, or auto-pass? (REQ-NET-04.)
5. **Prolonged-disconnect / abandonment policy.** How long is a duel held before it's forfeit/abandoned, and what's the recorded outcome? (REQ-NET-06.)
6. **Post-duel full decklist reveal.** After a game ends, does the summary reveal both full decklists (friendly review) or only what was revealed in play? (REQ-LOG-02.) Default = only-what-was-revealed.
7. **Exact HA/other carve-out list & the precise legal pool count.** The enumerated exclusions must be pulled from edisonformat.net/Format Library and founder-signed-off before lock (EF §8; EL §5, §Spike 2). This is a data-build prerequisite, not something to guess.
8. **Engine-config feasibility of Edison-era rules (R1).** Not a product-direction question but a CTO spike whose answer changes scope — surfaced here because it gates the accuracy promise.

---

## 17. Acceptance criteria for V1 (testable, end-to-end)

V1 is accepted when **all** of the following pass. Each maps to requirements above.

- **AC-01 (Access):** A non-invited person cannot create an account or reach any lobby/deck/duel surface; an invited person can, via an invite link/code; a revoked member loses access immediately. *(REQ-AUTH-01/02/04)*
- **AC-02 (Challenge):** From the lobby, a member can challenge an online friend, the friend can Accept/Decline, and Accept lands both in a pre-duel room; simultaneous mutual challenges resolve to exactly one room; a declined/timed-out challenge frees both. *(REQ-LOBBY-03/05, REQ-ROOM-01)*
- **AC-03 (Start):** A duel cannot start unless both players have readied with a **legal** deck; the first player is determined by a method neither can rig and is shown to both. *(REQ-ROOM-02/03/04, REQ-DECK-09)*
- **AC-04 (Deck legality — positive):** A deck of 40–60 Main / 0–15 Extra (Fusion+Synchro only) / 0–15 Side, ≤3 per name and within banlist caps across all three combined, validates as legal and is duel-selectable. *(REQ-DECK-01/09, §2.1)*
- **AC-05 (Deck legality — negative):** Each of these is prevented/flagged: 39-Main, 61-Main, 16-Extra, 16-Side, a 3rd copy of a Semi-Limited across zones, any copy of a Forbidden card, any out-of-pool card, a Fusion/Synchro placed in Main, an alt-art used to exceed the 3-copy cap. *(REQ-DECK-01/02/04/06)*
- **AC-06 (`.ydk` round-trip):** A legal deck exported to `.ydk` (with `#created by`, `#main`, `#extra`, `!side`) re-imports to an identical Main/Extra/Side multiset. *(REQ-DECK-14/15, §2.3)*
- **AC-07 (`.ydk` illegal import):** Importing a modern/foreign or over-limit or malformed `.ydk` (including one using `#side`) yields a specific per-card/per-line report and an explicitly-invalid, non-duel-usable deck — never a crash, silent drop, or silent accept. *(REQ-DECK-15)*
- **AC-08 (Duel plays a full game):** Two remote clients complete a full duel: draw/standby/main/battle/main2/end phases advance; Normal/Tribute/Flip/Special/Fusion/Ritual/Synchro summons work when offered; attacks resolve; LP updates; a winner (LP-to-0), a **deck-out** loss, an **Exodia** win, a **draw** (simultaneous 0), and a **surrender** each end the game correctly and route to a summary. *(REQ-DUEL-08/10/12/13)*
- **AC-09 (Response windows):** A player is prompted to respond **only** when they have a legal response and is auto-passed otherwise; the response is explicit (no accidental single-tap pass). *(REQ-CHAIN-01/02)*
- **AC-10 (Chain visualization):** A multi-link chain renders each link with owner and order and resolves step-by-step top-down in the engine's order. *(REQ-CHAIN-04/05)*
- **AC-11 (Edison rules checklist):** QA confirms, in live duels: ignition-effect priority is offered after a summon before the opponent's SS2 window; the first player draws on turn 1; Damage-Step activation is restricted to era-legal effects; Synchro requires exact-Level Tuner+non-Tuner; Field-Spell replacement behaves pre-MR3; constants are 8000 LP / 5-card hand / limit 6. *(REQ-RULE-02..07)* — Any failure here is a release blocker or an escalated engine limitation (R1).
- **AC-12 (Hidden info):** Across a full duel — including a legitimate reveal effect (e.g., Trap Dustshoot) and a reconnect — no client ever receives the opponent's hand identities, deck order, set Spell/Trap identities, or face-down monster identities; reveals reach only the entitled player. *(REQ-NET-01/02/05)*
- **AC-13 (Reconnect):** A player who disconnects mid-duel (including mid-chain) can reconnect via their session and is restored to the correct, redacted current state with no double-resolution; only the rightful player can reclaim the seat. *(REQ-NET-04/05)*
- **AC-14 (No external ruling calls):** With third-party network egress blocked, a full duel resolves correctly (engine + data self-hosted). *(REQ-NET-03, REQ-DATA-02)*
- **AC-15 (Rules reference):** The rules & rulings page is reachable standalone, is searchable, covers Edison-era content (incl. Synchro/Tuners, chains/priority/SEGOC, banlist), and works on mobile — with no external calls. *(REQ-REF-01..05)*
- **AC-16 (Log & summary):** During and after a duel the action log is reviewable, respects hidden info, and the post-duel summary states winner/loser/draw + reason + turn count. *(REQ-LOG-01..04)*
- **AC-17 (Responsive/tap):** On a 375px-wide phone in portrait, a player can complete an entire duel by tap alone (no required drag, no zoom-to-act), read any card's full text on demand, and every interactive target meets the 44px/16px minimums. *(REQ-UX-01..05, REQ-UX-09)*
- **AC-18 (Accessibility):** Banlist status, ownership, and actionable/legal states are each conveyed by icon/shape/label in addition to colour; a reduced-motion setting keeps feedback informative without animation. *(REQ-UX-06/07)*

---

## Appendix A — Requirement count by strength

| Area | MUST | SHOULD | COULD | Total |
|---|---|---|---|---|
| AUTH | 4 | 2 | 1 | 7 |
| LOBBY | 3 | 3 | 0 | 6 |
| ROOM | 5 | 2 | 1 | 8 |
| DECK | 15 | 2 | 0 | 17 |
| DUEL | 12 | 2 | 0 | 14 |
| CHAIN | 8 | 0 | 0 | 8 |
| RULE | 8 | 0 | 0 | 8 |
| NET | 5 | 1 | 0 | 6 |
| REF | 4 | 1 | 0 | 5 |
| LOG | 4 | 1 | 1 | 6 |
| UX | 7 | 3 | 0 | 10 |
| DATA | 4 | 1 | 0 | 5 |
| **Total** | **79** | **18** | **3** | **100** |

*(Counts are of individually-numbered `REQ-*` items; edge cases and acceptance criteria are additional and not counted here.)*
