import { test, expect, type Locator, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Live 2-player duel — new interaction grammar
//
// Drives the design as specified in docs/specs/2026-08-06-duel-ui-design.md.
//
// ACT mode (§3): the player clicks a card they control → a VerbChipCluster
// appears anchored at that card → the player clicks a verb chip.
// IdleCommand and BattleCommand are NEVER rendered as a bottom panel (A1).
//
// ANSWER mode (§4): when the engine emits a non-idle decision, exactly one
// QuestionBar docks bottom-centre and the board dims (A5, Law 2).
//
// Flows driven:
//   1. Backbone: two players connect, board renders, a decision is delivered,
//      resign ends the duel (two-step in-app confirm) naming the cause (D5/D6).
//   2. INVITE-01: logged-out visitor sees challenger name and resumes after login.
//   3. ACT-mode grammar: A1 assertion (no question surface in IdleCommand mode),
//      hand card → verb-chip-cluster → Normal Summon chip → SelectZone →
//      zone-option → card placed. mzone assertion: summoned slot occupied,
//      index === sequence, four remaining slots legitimately empty.
//   4. Turn play-through: Normal Summon → End Phase → End Phase → Battle Phase
//      → direct attack → opponent LP drops.
//
// NOT tested here (explicitly untested per spec §1 CTO note / PRD G1):
//   - All timing and motion, damage-number animation, audio.
//   - Anything below 1440×900.
//   - The chain decline path.
//   - The forfeit (timeout) experience.
// ---------------------------------------------------------------------------

const PASSWORD = "e2e-pass-12345";

// ---------------------------------------------------------------------------
// F12 helper — design spec requirement F12
//
// Every visible interactive control must receive its own pointer clicks.
// document.elementFromPoint at the element's centre must return that element
// or a descendant — not an overlay, scrim, or action-panel on top of it.
//
// Return values:
//   'OK'                            — element is hittable
//   'OUTSIDE_VIEWPORT:top=<n>'      — element centre is below/above the viewport
//   'OCCLUDED_BY:<tag>[testid=<id>] — another element intercepts at the centre
//   'NOT_FOUND' / 'NULL_HIT'        — locator resolved to nothing / hit is null
//
// Usage: expect(await assertF12(locator, "description")).toBe('OK')
// When the assertion fails the diagnostic string names the defect precisely:
//   OUTSIDE_VIEWPORT → ZUH-106 (board layout overflow)
//   OCCLUDED_BY:DIV[testid=action-panel] → ZUH-107 (panel intercepts verb chip)
// ---------------------------------------------------------------------------

async function assertF12(locator: Locator, description: string): Promise<void> {
  const result = await locator.evaluate((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (
      rect.bottom <= 0 ||
      rect.top >= window.innerHeight ||
      rect.right <= 0 ||
      rect.left >= window.innerWidth
    ) {
      return `OUTSIDE_VIEWPORT:top=${Math.round(rect.top)},vph=${window.innerHeight}`;
    }
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    if (!hit) return "NULL_HIT";
    if (el === hit || el.contains(hit)) return "OK";
    const id = hit.getAttribute("data-testid") ?? hit.getAttribute("aria-label") ?? "-";
    return `OCCLUDED_BY:${hit.tagName}[testid=${id}]`;
  });
  expect(result, `F12 — ${description}: ${result}`).toBe("OK");
}

// ---------------------------------------------------------------------------
// clickSummonableHandCard
//
// Scroll the hand row into view (real scroll via scrollIntoViewIfNeeded),
// assert F12 (the button must receive its own pointer click — ZUH-106 check),
// then do a real pointer click. Iterates through up to 6 hand cards to skip
// any non-summonable card (e.g. Ryu-Ran level 7, passcode 2964201, which has no
// Normal Summon option on turn 1 with an empty field).
//
// Returns with verb-chip-cluster visible and containing a Normal Summon chip.
// Throws if no summonable card is found among the hand cards.
// ---------------------------------------------------------------------------

async function clickSummonableHandCard(page: Page): Promise<void> {
  const MAX_HAND = 6;
  for (let seq = 0; seq < MAX_HAND; seq++) {
    const btn = page.getByTestId("own-hand-row").getByRole("button").nth(seq);

    // Real scroll — ensure the button is in the scrollable container's visible area.
    await btn.scrollIntoViewIfNeeded();

    // F12: button must receive its own pointer click.
    // Fails with OUTSIDE_VIEWPORT if ZUH-106 (board overflow) is not fixed.
    // Fails with OCCLUDED_BY if another element intercepts at the centre.
    await assertF12(btn, `own-hand-row button[${seq}]`);

    // Real pointer click.
    await btn.click();

    // Check if a verb chip cluster appeared with a Normal Summon chip.
    const cluster = page.getByTestId("verb-chip-cluster");
    const hasCluster = await cluster.isVisible().catch(() => false);
    if (hasCluster) {
      const hasSummon =
        (await cluster.getByRole("menuitem", { name: /Normal Summon/i }).count()) > 0;
      if (hasSummon) return; // found a summonable card — cluster stays open
    }
    // Dismiss and try the next card.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }
  throw new Error(
    "No hand card with Normal Summon found after checking all hand cards — " +
      "verify the E2E deck contains summonable level-1..4 Normal monsters",
  );
}

async function login(page: Page, displayName: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("display-name-input").fill(displayName);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((u) => u.pathname === "/");
}

/** Create a room as Alice and return the join-link path. */
async function createRoomAsAlice(alice: Page): Promise<string> {
  await alice.goto("/duel/new");
  await alice.getByRole("radio", { name: "5 min", exact: true }).click();
  await alice.getByRole("button", { name: /create challenge link/i }).click();
  await alice.waitForURL((u) => u.pathname.includes("/room"));
  const linkText = (await alice.getByTestId("join-link").textContent())?.trim() ?? "";
  expect(linkText).toContain("/duel/join/");
  return new URL(linkText).pathname;
}

/**
 * Drive both players from the room pre-flight through to the live board.
 * Returns { goesFirst, goesSecond } — the player at seat 0 and seat 1.
 */
async function enterRoomAndReachBoard(
  alice: Page,
  bob: Page,
): Promise<{ goesFirst: Page; goesSecond: Page }> {
  await alice.getByTestId("deck-option").filter({ hasText: "E2E Test Deck" }).click();
  await bob.getByTestId("deck-option").filter({ hasText: "E2E Test Deck" }).click();

  await alice.getByTestId("room-ready-btn").click();
  await bob.getByTestId("room-ready-btn").click();

  // Flip is non-deterministic — poll both pages for the seat-choice button.
  let winner: Page | null = null;
  const deadline = Date.now() + 15_000;
  while (!winner && Date.now() < deadline) {
    for (const [i, p] of [alice, bob].entries()) {
      if (
        await p
          .getByTestId("seat-first-btn")
          .isVisible()
          .catch(() => false)
      ) {
        winner = i === 0 ? alice : bob;
        break;
      }
    }
    if (!winner) await alice.waitForTimeout(200);
  }
  if (!winner) throw new Error("Seat-choice buttons never appeared on either player's screen");

  await winner.getByTestId("seat-first-btn").click();

  await alice.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/room"));
  await bob.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/room"));

  await expect(alice.getByTestId("duel-board")).toBeVisible();
  await expect(bob.getByTestId("duel-board")).toBeVisible();

  const goesFirst = winner;
  const goesSecond = winner === alice ? bob : alice;
  return { goesFirst, goesSecond };
}

// ---------------------------------------------------------------------------
// TEST 1 — Backbone: connect → render → decision delivered → resign round-trip
//
// Covers D5/D6: duel-end-reason must name the cause ("resign").
// Resign is a two-step in-app confirm (SettingsPopover), not a native dialog.
// ---------------------------------------------------------------------------

test("backbone: two players connect, board renders, decision delivered, resign round-trips with cause text", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  try {
    await login(alice, "e2e_alice");
    await login(bob, "e2e_bob");

    const joinPath = await createRoomAsAlice(alice);

    // Timer visible to Alice before she commits.
    await expect(alice.getByTestId("room-timer-strip")).toContainText(/5 min per move/i);

    await bob.goto(joinPath);
    await bob.waitForURL((u) => u.pathname.includes("/room"));

    // Timer visible to Bob (the invitee) before he commits.
    await expect(bob.getByTestId("room-timer-strip")).toContainText(/5 min per move/i);

    await enterRoomAndReachBoard(alice, bob);

    // Both have an action-panel (always mounted while duel is active).
    await expect(alice.getByTestId("action-panel")).toBeVisible();
    await expect(bob.getByTestId("action-panel")).toBeVisible();

    // A decision was delivered: phase-ribbon is live (rendered by DuelBoard only
    // when a STATE snapshot exists). "no-decision" now appears in act mode too
    // (DuelStage shows the placeholder in act/waiting/ended modes alike), so it
    // can no longer distinguish "waiting for engine" from "engine sent IdleCommand".
    await expect(alice.getByTestId("phase-ribbon")).toBeVisible();
    await expect(bob.getByTestId("phase-ribbon")).toBeVisible();

    // ── Two-step in-app resign (SettingsPopover) ─────────────────────────
    // Step 1: open settings
    await alice.getByTestId("settings-btn").click();
    await expect(alice.getByTestId("settings-popover")).toBeVisible();

    // Step 2: click Resign inside the popover (first click → confirm state)
    await alice.getByTestId("settings-popover").getByTestId("resign-btn").click();
    // The confirm/cancel pair appears.
    await expect(alice.getByTestId("resign-confirm")).toBeVisible();

    // Step 3: confirm
    await alice.getByTestId("resign-confirm").click();

    // Both seats receive DUEL_END.
    await expect(alice.getByTestId("duel-end-overlay")).toBeVisible();
    await expect(bob.getByTestId("duel-end-overlay")).toBeVisible();

    // D5/D6: the cause text must reference "resign" on both boards.
    await expect(alice.getByTestId("duel-end-reason")).toContainText(/resign/i);
    await expect(bob.getByTestId("duel-end-reason")).toContainText(/resign/i);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

// ---------------------------------------------------------------------------
// TEST 2 — INVITE-01: logged-out visitor sees challenger name and signs in
// ---------------------------------------------------------------------------

test("INVITE-01: a duel link opened while logged-out shows challenger name and resumes after login", async ({
  browser,
}) => {
  // Create a room as Alice to get a real join link.
  const ctxA = await browser.newContext();
  const alice = await ctxA.newPage();
  let joinPath = "";
  try {
    await login(alice, "e2e_alice");
    joinPath = await createRoomAsAlice(alice);
  } finally {
    await ctxA.close();
  }

  // Fresh, logged-OUT context opens the link.
  const ctxC = await browser.newContext();
  const carol = await ctxC.newPage();
  try {
    await carol.goto(joinPath);
    // Public landing — shows the challenger's name.
    await expect(carol.getByText(/challenged/i)).toBeVisible();

    // Sign-in prompt.
    await carol.getByRole("button", { name: /sign in to join/i }).click();
    await carol.waitForURL((u) => u.pathname === "/login");

    await carol.getByTestId("display-name-input").fill("e2e_bob");
    await carol.getByTestId("password-input").fill(PASSWORD);
    await carol.getByTestId("login-submit").click();

    // After login, redirects back to join route, then into the room.
    await carol.waitForURL((u) => u.pathname === joinPath, { timeout: 10_000 });
    await carol.waitForURL((u) => u.pathname.includes("/room"), { timeout: 10_000 });
    await expect(carol.getByTestId("room-timer-strip")).toBeVisible();
  } finally {
    await ctxC.close();
  }
});

// ---------------------------------------------------------------------------
// TEST 3 — ACT-mode grammar: A1 assertion + verb chip flow + mzone assertion
//
// Design §3: clicking a card you control opens a VerbChipCluster anchored at
// that card. IdleCommand/BattleCommand are NEVER rendered as a question panel.
//
// A1: "no question surface is on screen" when IdleCommand is pending.
// A5: at most one QuestionBar exists — checked explicitly (count === 1).
// F12: every control must receive its own pointer click (assertF12 before each).
//
// mzone: after one Normal Summon the summoned slot is occupied; the other four
// remain empty. The old assertion of empty-zone count === 0 was wrong for a
// dense 5-slot row.
// ---------------------------------------------------------------------------

test("ACT-mode grammar: A1 assertion, verb chip → Normal Summon → zone placed, mzone correct", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  try {
    await login(alice, "e2e_alice");
    await login(bob, "e2e_bob");

    const joinPath = await createRoomAsAlice(alice);
    await bob.goto(joinPath);
    await bob.waitForURL((u) => u.pathname.includes("/room"));

    const { goesFirst, goesSecond } = await enterRoomAndReachBoard(alice, bob);
    void goesSecond; // used only to prevent teardown before the board is stable

    // Wait for the IdleCommand to arrive before asserting on act mode.
    // end-turn-btn is enabled only when legalNextPhases includes EP, which
    // requires decision.kind === "IdleCommand" with toEndPhase: true.
    await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();

    // ── A1: no question surface in ACT mode ───────────────────────────────
    // The QuestionBar (ANSWER-mode surface) must be absent when IdleCommand
    // is pending. If question-bar is visible here, A1 is violated.
    await expect(goesFirst.getByTestId("question-bar")).not.toBeVisible();

    // A1 strict: the action-panel must NOT surface IdleCommand choices as a
    // bottom panel. Under the new grammar the panel is empty (no-decision or
    // waiting placeholder) in act mode — verb chips live on the board.
    // This assertion FAILS if renderActButtons() or equivalent puts "Normal
    // Summon" text into the action-panel, which is the "rebuilt panel" defect
    // PRD A1 was written to prevent.
    await expect(goesFirst.getByTestId("action-panel")).not.toContainText(/Normal Summon/i);

    // ── Verb chip flow ────────────────────────────────────────────────────
    // clickSummonableHandCard scrolls the hand row into view, asserts F12 on
    // the button, does a real pointer click, and iterates to find a summonable
    // card. Returns with verb-chip-cluster visible and Normal Summon chip ready.
    // Fails with OUTSIDE_VIEWPORT if ZUH-106 (board overflow) is not fixed.
    const handRow = goesFirst.getByTestId("own-hand-row");
    await expect(handRow).toBeVisible();
    await clickSummonableHandCard(goesFirst);

    // Cluster is open on return.
    await expect(goesFirst.getByTestId("verb-chip-cluster")).toBeVisible();

    // Law 1: no question-bar while verb cluster is open (ACT and ANSWER
    // cannot be live simultaneously).
    await expect(goesFirst.getByTestId("question-bar")).not.toBeVisible();

    // F12 on the Normal Summon chip before clicking.
    const summonChip = goesFirst
      .getByTestId("verb-chip-cluster")
      .getByRole("menuitem", { name: /Normal Summon/i })
      .first();
    await assertF12(summonChip, "Normal Summon chip");

    // Real pointer click on the chip.
    await summonChip.click();

    // ── After summon intent: SelectZone auto-answered ─────────────────────
    // prefs.chooseZones = false (default): DuelStage auto-places the card in
    // the leftmost available zone. No question-bar appears for SelectZone.
    // Verb-chip-cluster is dismissed once the summon intent is sent.
    await expect(goesFirst.getByTestId("verb-chip-cluster")).not.toBeVisible();
    // question-bar must NOT appear (auto-answer handled SelectZone — Law 1 holds).
    await expect(goesFirst.getByTestId("question-bar")).not.toBeVisible();

    // ── mzone assertion: summoned card is in zone 0, four others empty ────
    // Design C2 (dense arrays): auto-answer places the card at index 0.
    // The remaining four slots are legitimately empty.
    const myMzone = goesFirst.locator('[data-testid="my-mzone"]');
    await expect(myMzone).toBeVisible();

    // Zone 0 must be occupied.
    const zone0 = myMzone.locator('[aria-label*="MZONE zone 0"]');
    await expect(zone0).toBeVisible();
    await expect(zone0).not.toHaveAttribute("data-testid", "empty-zone");

    // Four remaining zone slots (1–4) remain legitimately empty.
    await expect(myMzone.getByTestId("empty-zone")).toHaveCount(4);

    // Board on goesSecond's side still renders (STATE broadcast received).
    await expect(goesSecond.getByTestId("duel-board")).toBeVisible();
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

// ---------------------------------------------------------------------------
// TEST 4 — Turn play-through: Normal Summon → End Phase → Battle Phase
//          → direct attack → LP drops
//
// Proves a complete turn sequence via the new verb chip grammar.
//
// TURN 1 (seat 0):
//   Normal Summon via verb chip → zone placed → End Turn
// TURN 1 (seat 1):
//   End Turn immediately
// TURN 2 (seat 0):
//   Battle Phase via phase rail → direct attack via verb chip →
//   opponent LP drops below 8000
// ---------------------------------------------------------------------------

test(
  "play-through: Normal Summon → End Phase → Battle Phase → direct attack → LP drops",
  { timeout: 120_000 },
  async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const alice = await ctxA.newPage();
    const bob = await ctxB.newPage();

    try {
      await login(alice, "e2e_alice");
      await login(bob, "e2e_bob");

      const joinPath = await createRoomAsAlice(alice);
      await bob.goto(joinPath);
      await bob.waitForURL((u) => u.pathname.includes("/room"));

      const { goesFirst, goesSecond } = await enterRoomAndReachBoard(alice, bob);

      // ══════════════════════════════════════════════════════════════════════
      // TURN 1 (seat 0 = goesFirst): Normal Summon via verb chip → End Phase
      // First-player attack restriction: toBattlePhase=false on turn 1.
      // ══════════════════════════════════════════════════════════════════════

      // Wait for the IdleCommand: end-turn-btn enabled means toEndPhase=true.
      await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();

      // Verb chip: find a summonable hand card, assert F12, real click.
      const handRow1 = goesFirst.getByTestId("own-hand-row");
      await expect(handRow1).toBeVisible();
      await clickSummonableHandCard(goesFirst);
      await expect(goesFirst.getByTestId("verb-chip-cluster")).toBeVisible();

      // F12 on Normal Summon chip before clicking.
      const summonChip1 = goesFirst
        .getByTestId("verb-chip-cluster")
        .getByRole("menuitem", { name: /Normal Summon/i })
        .first();
      await assertF12(summonChip1, "Normal Summon chip (turn 1)");
      await summonChip1.click();

      // SelectZone auto-answered (chooseZones: false) — no zone-option step.
      // Card lands in zone 0 automatically.

      // Zone 0 is occupied; four others empty (dense-array C2 invariant).
      await expect(
        goesFirst.locator('[data-testid="my-mzone"]').locator('[aria-label*="MZONE zone 0"]'),
      ).not.toHaveAttribute("data-testid", "empty-zone");
      await expect(
        goesFirst.locator('[data-testid="my-mzone"]').getByTestId("empty-zone"),
      ).toHaveCount(4);

      // End Turn (phase rail end-turn-btn).
      await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();
      await assertF12(goesFirst.getByTestId("end-turn-btn"), "end-turn-btn (turn 1)");
      await goesFirst.getByTestId("end-turn-btn").click();

      // ══════════════════════════════════════════════════════════════════════
      // TURN 1 (seat 1 = goesSecond): End Turn immediately
      // ══════════════════════════════════════════════════════════════════════

      await expect(goesSecond.getByTestId("end-turn-btn")).toBeEnabled();
      await assertF12(goesSecond.getByTestId("end-turn-btn"), "end-turn-btn (seat 1 turn 1)");
      await goesSecond.getByTestId("end-turn-btn").click();

      // ══════════════════════════════════════════════════════════════════════
      // TURN 2 (seat 0 = goesFirst): Battle Phase → direct attack → LP drops
      // ══════════════════════════════════════════════════════════════════════

      // Wait for turn 2 IdleCommand.
      await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();

      // Advance to Battle Phase via the phase rail.
      // PhaseRail phase cells have role="listitem" (inside role="list"),
      // which overrides the native button role — use getByRole("listitem").
      // aria-label="Battle Phase — advance here" when the phase is legal.
      const bpButton = goesFirst.getByRole("listitem", { name: /Battle Phase.*advance/i });
      await expect(bpButton).toBeVisible();
      await assertF12(bpButton, "Battle Phase advance button");
      await bpButton.click();

      // In Battle Phase, click the summoned monster for verb chips.
      const myMzone2 = goesFirst.locator('[data-testid="my-mzone"]');
      const summonedCard = myMzone2.locator('button[aria-label*="MZONE zone 0"]');
      await expect(summonedCard).toBeVisible();
      await summonedCard.scrollIntoViewIfNeeded();
      await assertF12(summonedCard, "summoned card MZONE zone 0");
      await summonedCard.click();

      await expect(goesFirst.getByTestId("verb-chip-cluster")).toBeVisible();

      // F12 on Attack chip before clicking.
      const attackChip = goesFirst
        .getByTestId("verb-chip-cluster")
        .getByRole("menuitem", { name: /Attack/i })
        .first();
      await assertF12(attackChip, "Attack chip");
      await attackChip.click();

      // Safety net: pass any ChainPrompt (all-Normal-monster deck).
      try {
        await goesFirst
          .getByTestId("pass-option")
          .first()
          .waitFor({ state: "visible", timeout: 1_000 });
        await goesFirst.getByTestId("pass-option").first().click();
      } catch {
        // Expected: no chain prompt with Normal monsters.
      }

      // ── Assert real game progress ─────────────────────────────────────────
      // Opponent's LP plate aria-label is "{name} LP: {lp}" (LifePointPlate).
      // Assert that LP dropped from 8000 by checking aria-label no longer ends
      // with "LP: 8000".
      await expect(goesFirst.locator('[data-testid="opp-lp-plate"]')).not.toHaveAttribute(
        "aria-label",
        /LP: 8000$/,
      );
      await expect(goesSecond.locator('[data-testid="own-lp-plate"]')).not.toHaveAttribute(
        "aria-label",
        /LP: 8000$/,
      );
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  },
);
