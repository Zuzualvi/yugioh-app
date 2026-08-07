import { test, expect, type Page } from "@playwright/test";

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

/**
 * Click the first button inside the own-hand-row.
 *
 * The duel board layout (opponent hand + two field groups + phase rail + own
 * hand) exceeds the 900px viewport when rendered at 1440×900. The own hand row
 * sits below the viewport bottom and therefore outside Playwright's hit-test
 * region. The three-step approach here:
 *   1. Scroll the board's overflow:auto container by wheeling the mouse at the
 *      board centre, which brings the hand row into the viewport.
 *   2. Allow one animation frame for React to re-measure positions.
 *   3. Dispatch the full mouse event sequence through DOM so React's onClick
 *      fires with a real rect, which VerbChipCluster uses to anchor itself.
 *
 * PRODUCT NOTE (W1): the board height overflows the viewport, meaning the own
 * hand is unreachable without scrolling. DuelStage's board div should be
 * constrained to `max-height: calc(100vh - 40px)` (40px = DuelTopBar) so that
 * it scrolls internally and the hand row stays in the initial viewport.
 * Filed as a product defect in the report.
 */
async function clickSummonableHandCard(page: Page): Promise<void> {
  // Wheel the board to scroll the hand row into the viewport.
  // The board layout (two field groups + phase rail) overflows the 900px viewport
  // at 1440×900 — the own hand row sits ~30-50px below the viewport bottom.
  // PRODUCT NOTE (W1): DuelStage's overflow:auto board div needs max-height:
  // calc(100vh - 40px) so the hand row stays within the initial viewport.
  await page.mouse.move(720, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(150);

  // Iterate through hand cards (max 6) until one shows a Normal Summon chip.
  // One card in the 40-card E2E deck is level 7 (Ryu-Ran, passcode 2964201)
  // and cannot be summoned on turn 1 (no tributes available). Clicking it
  // produces a refusal chip instead of a verb chip cluster.
  const MAX_HAND = 6;
  for (let seq = 0; seq < MAX_HAND; seq++) {
    await page.evaluate((s: number) => {
      const btns = document.querySelectorAll("[data-testid='own-hand-row'] button");
      const btn = btns[s] as HTMLElement | null;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);
      for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        btn.dispatchEvent(
          new MouseEvent(t, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: cx,
            clientY: cy,
          }),
        );
      }
    }, seq);

    // Short wait for React to process the click.
    await page.waitForTimeout(200);

    // Check if a verb chip cluster appeared with a Normal Summon chip.
    const cluster = page.getByTestId("verb-chip-cluster");
    const hasCluster = await cluster.isVisible().catch(() => false);
    if (hasCluster) {
      const hasSummon =
        (await cluster.getByRole("menuitem", { name: /Normal Summon/i }).count()) > 0;
      if (hasSummon) return; // found a summonable card
    }
    // Dismiss whatever appeared (refusal chip or wrong cluster) and try the next card.
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

  // Seat 0 is whoever clicked seat-first-btn (the flip winner).
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
// TEST 2 — INVITE-01: logged-out visitor sees challenger name and resumes after login
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
// A5: at most one QuestionBar exists — checked implicitly (question-bar absent
//     in act mode, present in answer mode).
//
// mzone: after one Normal Summon the summoned slot is occupied; the other four
// remain empty. This is correct for a dense 5-slot row — the old test asserting
// `empty-zone` count === 0 was arithmetically wrong.
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
    // requires decision.kind==="IdleCommand" with toEndPhase:true (mode==="act").
    await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();

    // ── A1: no question surface in ACT mode ───────────────────────────────
    // The QuestionBar (ANSWER-mode surface) must be absent when IdleCommand
    // is pending. If question-bar is visible here, A1 is violated.
    await expect(goesFirst.getByTestId("question-bar")).not.toBeVisible();

    // A1 strict: the action-panel must NOT surface IdleCommand choices as a
    // bottom panel. Under the new grammar the panel is empty (no-decision or
    // waiting placeholder) in act mode — verb chips live on the board.
    // This assertion is deliberately assertive: it FAILS if renderActButtons()
    // or equivalent puts "Normal Summon" text into the action-panel, which is
    // the "rebuilt panel" defect PRD A1 was written to prevent.
    await expect(goesFirst.getByTestId("action-panel")).not.toContainText(/Normal Summon/i);

    // ── Verb chip flow ────────────────────────────────────────────────────
    // Click a summonable hand card → verb-chip-cluster appears with Normal Summon.
    // clickSummonableHandCard scrolls the board and iterates cards until it
    // finds one with a Normal Summon chip, returning with the cluster visible.
    const handRow = goesFirst.getByTestId("own-hand-row");
    await expect(handRow).toBeVisible();
    await clickSummonableHandCard(goesFirst);

    // clickSummonableHandCard returns with the cluster visible and Normal Summon
    // present — these assertions confirm the product state at return time.
    await expect(goesFirst.getByTestId("verb-chip-cluster")).toBeVisible();

    // No question-bar while verb cluster is open (Law 1 — ACT and ANSWER
    // cannot be live simultaneously).
    await expect(goesFirst.getByTestId("question-bar")).not.toBeVisible();

    // Click the "Normal Summon" verb chip.
    await goesFirst
      .getByTestId("verb-chip-cluster")
      .getByRole("menuitem", { name: /Normal Summon/i })
      .first()
      .click();

    // ── After summon intent: SelectZone decision ──────────────────────────
    // The engine follows up with SelectZone. In answer mode:
    //   - question-bar should appear (A5: exactly one)
    //   - verb-chip-cluster must be dismissed (Law 1)
    await expect(goesFirst.getByTestId("question-bar")).toBeVisible();
    await expect(goesFirst.getByTestId("verb-chip-cluster")).not.toBeVisible();

    // A5: exactly one question-bar at any instant.
    await expect(goesFirst.getByTestId("question-bar")).toHaveCount(1);

    // ── Zone selection ────────────────────────────────────────────────────
    // zone-option buttons are rendered by DecisionRenderer for SelectZone
    // when prefs.chooseZones === true (set in DuelStage).
    await expect(goesFirst.getByTestId("zone-option").first()).toBeVisible();
    const zoneOptions = goesFirst.getByTestId("zone-option");
    const firstZone = zoneOptions.first();
    await firstZone.click({ force: true });

    // ── mzone assertion: summoned card is in zone 0, four others empty ────
    // Design C2 (dense arrays): index === sequence. Clicking zone-option[0]
    // places the card at sequence 0. The remaining four slots are legitimately
    // empty — asserting empty-zone count === 0 was wrong (old test defect).
    const myMzone = goesFirst.locator('[data-testid="my-mzone"]');
    await expect(myMzone).toBeVisible();

    // Zone 0 must be occupied (aria-label contains "zone 0", not "Empty").
    // ZoneSlot renders empty as: aria-label="Empty MZONE zone 0"
    // ZoneSlot renders occupied as: aria-label="Card in MZONE zone 0"
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
//          → direct attack → opponent LP drops
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

test("play-through: Normal Summon → End Phase → Battle Phase → direct attack → LP drops", async ({
  browser,
}) => {
  // This test drives two full turns with multiple server round-trips; raise the
  // test-level timeout above the 60s config default.
  test.setTimeout(120_000);
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

    // Wait for the IdleCommand to arrive: end-turn-btn becomes enabled only
    // when legalNextPhases includes EP (derived from IdleCommand.toEndPhase).
    // "no-decision" appears in act/waiting/ended modes alike so it cannot
    // distinguish a live decision from the waiting state.
    await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();

    // Verb chip: click first hand card.
    const handRow1 = goesFirst.getByTestId("own-hand-row");
    await expect(handRow1).toBeVisible();
    await clickSummonableHandCard(goesFirst);
    await expect(goesFirst.getByTestId("verb-chip-cluster")).toBeVisible();

    // Click "Normal Summon" chip.
    await goesFirst
      .getByTestId("verb-chip-cluster")
      .getByRole("menuitem", { name: /Normal Summon/i })
      .first()
      .click();

    // SelectZone — pick first available zone.
    await expect(goesFirst.getByTestId("zone-option").first()).toBeVisible();
    await goesFirst.getByTestId("zone-option").first().click({ force: true });

    // Zone 0 is occupied; four others empty (dense-array C2 invariant).
    await expect(
      goesFirst.locator('[data-testid="my-mzone"]').locator('[aria-label*="MZONE zone 0"]'),
    ).not.toHaveAttribute("data-testid", "empty-zone");
    await expect(
      goesFirst.locator('[data-testid="my-mzone"]').getByTestId("empty-zone"),
    ).toHaveCount(4);

    // End Turn (phase rail end-turn-btn).
    await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();
    await goesFirst.getByTestId("end-turn-btn").click();

    // ══════════════════════════════════════════════════════════════════════
    // TURN 1 (seat 1 = goesSecond): End Turn immediately
    // ══════════════════════════════════════════════════════════════════════

    // Wait for goesSecond's IdleCommand: end-turn-btn enabled means the
    // engine has delivered a decision for this seat.
    await expect(goesSecond.getByTestId("end-turn-btn")).toBeEnabled();
    await goesSecond.getByTestId("end-turn-btn").click();

    // ══════════════════════════════════════════════════════════════════════
    // TURN 2 (seat 0 = goesFirst): Battle Phase → direct attack → LP drops
    // ══════════════════════════════════════════════════════════════════════

    // Wait for turn 2 IdleCommand (toBattlePhase=true → BP button enabled).
    await expect(goesFirst.getByTestId("end-turn-btn")).toBeEnabled();

    // Advance to Battle Phase via the phase rail.
    // PhaseRail renders BP cell as: aria-label="Battle Phase — advance here"
    const bpButton = goesFirst.getByRole("button", { name: /Battle Phase.*advance/i });
    await expect(bpButton).toBeVisible();
    await bpButton.click();

    // In Battle Phase, click the summoned monster to get verb chips.
    const myMzone2 = goesFirst.locator('[data-testid="my-mzone"]');
    const summonedCard = myMzone2.locator('button[aria-label*="MZONE zone 0"]');
    await expect(summonedCard).toBeVisible();
    await summonedCard.click();
    await expect(goesFirst.getByTestId("verb-chip-cluster")).toBeVisible();

    // Click "Attack" or "Attack directly" verb chip.
    await goesFirst
      .getByTestId("verb-chip-cluster")
      .getByRole("menuitem", { name: /Attack/i })
      .first()
      .click();

    // Safety net: pass any ChainPrompt (all-Normal-monster deck — should not fire).
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
});
