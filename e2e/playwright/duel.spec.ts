import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Live 2-player duel BACKBONE (Part 2). Proves the transport + engine + relay
// loop end-to-end on the same-origin harness (see e2e/harness/server.ts):
//   • both seats connect over the real WS,
//   • both boards render REAL per-seat engine STATE,
//   • the on-clock seat's pending decision is DELIVERED on connect (Fix #2),
//   • a client→server→broadcast round-trip via RESIGN reaches BOTH players.
//
// Phase 3 adds a full real-turn play-through verified at two viewports:
//   • Alice (seat 0) normal-summons a monster (turn 1), ends turn.
//   • Bob (seat 1) skips his turn (End Phase immediately).
//   • Alice (turn 2) advances to Battle Phase and declares a direct attack;
//     Bob's LP drops — all via real panels driven by the real WASM engine.
//   • Runs on BOTH a desktop (1280×800) and mobile-portrait (393×851) viewport
//     via the two Playwright projects defined in playwright.config.ts.
//
// Engine / implementation notes (findings from Phase 3 diagnostic):
//   • Normal Summon → SelectZone → card placed; SelectPosition is NOT emitted
//     for Simple Normal Monsters in the Edison engine.
//   • duelQueryLocation returns code=0 for MZONE cards (known limitation of the
//     current STATE snapshot); the card renders as face-down-card even when
//     face-up. The observable proof of placement is the empty-zone disappearing.
//   • currentPhase tracking is not yet wired (always 0); the phase ribbon never
//     shows "Battle". Proof of entering Battle Phase is the attack button
//     appearing in Alice's ActionPanel (BattleCommand decision delivered).
//   • Turn 1 has the first-player attack restriction (Edison OCG rules):
//     toBattlePhase=false. Alice can only End Phase on turn 1; she attacks on
//     turn 2 after Bob skips his turn.
//   • LP IS tracked correctly (via DAMAGE messages in updatePhaseFromMessage);
//     the LP drop is a reliable real-progress assertion.
// ---------------------------------------------------------------------------

const PASSWORD = "e2e-pass-12345";

async function login(page: Page, displayName: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("display-name-input").fill(displayName);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((u) => u.pathname === "/");
}

/** Pass any ChainPrompt that may have surfaced to the given player. No-op if none. */
async function passIfChain(page: Page): Promise<void> {
  try {
    await page.getByTestId("pass-option").first().waitFor({ state: "visible", timeout: 1_000 });
    await page.getByTestId("pass-option").first().click();
  } catch {
    // No chain prompt — expected for Normal-monster-only decks.
  }
}

test("two-player live duel backbone: connect, render, decision delivered, resign round-trips", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  try {
    await login(alice, "e2e_alice");
    await login(bob, "e2e_bob");

    // Alice creates a duel (deck + 5-min per-move timer) and gets a join link.
    await alice.goto("/duel/new");
    await alice.getByText("E2E Test Deck").click();
    await alice.getByRole("button", { name: "5 min", exact: true }).click();
    await alice.getByRole("button", { name: /create duel/i }).click();

    const linkText = (await alice.getByTestId("join-link").textContent())?.trim() ?? "";
    expect(linkText).toContain("/duel/join/");
    const joinPath = new URL(linkText).pathname;

    // Bob opens the link, sees the per-move timer (INVITE-02), picks a deck, joins.
    await bob.goto(joinPath);
    await expect(bob.getByTestId("join-timer")).toContainText("min");
    await bob.getByText("E2E Test Deck").click();
    await bob.getByRole("button", { name: /accept/i }).click();
    await bob.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/join/"));
    // Bob's board renders REAL engine STATE over the live WS.
    await expect(bob.getByTestId("duel-board")).toBeVisible();

    // Alice enters the duel (after Bob joined → engine started, deterministic).
    await alice.getByRole("button", { name: /enter duel/i }).click();
    await alice.waitForURL(
      (u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/join/"),
    );
    await expect(alice.getByTestId("duel-board")).toBeVisible();

    // Fix #2: the on-clock seat (Alice, seat 0) receives its pending decision on
    // connect — the ActionPanel is NOT stuck on the "Waiting for engine…"
    // placeholder. (Without the fix this placeholder never clears → timeout.)
    await expect(alice.getByTestId("action-panel")).toBeVisible();
    await expect(alice.getByTestId("no-decision")).toHaveCount(0);

    // Client→server→broadcast round-trip: Alice resigns; BOTH clients get DUEL_END.
    alice.on("dialog", (d) => void d.accept());
    await alice.getByTestId("resign-btn").click();

    await expect(alice.getByTestId("duel-end-banner")).toBeVisible();
    await expect(bob.getByTestId("duel-end-banner")).toBeVisible();
    // Alice resigned → she loses, Bob wins; both banners reference the resign.
    await expect(alice.getByTestId("duel-end-reason")).toContainText(/resign/i);
    await expect(bob.getByTestId("duel-end-reason")).toContainText(/resign/i);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("INVITE-01: a duel link opened while logged-out resumes after login", async ({ browser }) => {
  // Create a fresh duel as Alice to get a real join link.
  const ctxA = await browser.newContext();
  const alice = await ctxA.newPage();
  let joinPath = "";
  try {
    await login(alice, "e2e_alice");
    await alice.goto("/duel/new");
    await alice.getByText("E2E Test Deck").click();
    await alice.getByRole("button", { name: "5 min", exact: true }).click();
    await alice.getByRole("button", { name: /create duel/i }).click();
    const linkText = (await alice.getByTestId("join-link").textContent())?.trim() ?? "";
    joinPath = new URL(linkText).pathname;
  } finally {
    await ctxA.close();
  }

  // Fresh, logged-OUT context opens the link → bounced to /login → after login
  // lands back on the Join screen (not Home).
  const ctxC = await browser.newContext();
  const carol = await ctxC.newPage();
  try {
    await carol.goto(joinPath);
    await carol.waitForURL((u) => u.pathname === "/login");
    await carol.getByTestId("display-name-input").fill("e2e_bob");
    await carol.getByTestId("password-input").fill(PASSWORD);
    await carol.getByTestId("login-submit").click();
    await carol.waitForURL((u) => u.pathname === joinPath);
    await expect(carol.getByText(/challenged/i)).toBeVisible();
  } finally {
    await ctxC.close();
  }
});

// ---------------------------------------------------------------------------
// Phase 3 — real-turn play-through (desktop + mobile viewports via projects).
//
// Proves a complete turn sequence through the real panel UI:
//
//   TURN 1 (Alice):
//     IdleCommand → Normal Summon → SelectZone → card placed in MZONE
//     (first-player attack restriction: cannot battle on turn 1) → End Phase
//
//   TURN 1 (Bob):
//     IdleCommand → End Phase immediately (Bob skips his turn)
//
//   TURN 2 (Alice):
//     IdleCommand → Proceed to Battle Phase
//     BattleCommand → direct attack (opponent has no monsters)
//     Bob's LP drops below 8000 — confirmed in STATE on BOTH boards
//
// DECK40 = all Normal monsters → no effects → no chain windows.
// The passIfChain helper is a safety net; it should never activate.
// ---------------------------------------------------------------------------

test("real-turn play-through: normal summon → battle phase → direct attack → LP drops", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  try {
    // ── Login ──────────────────────────────────────────────────────────────
    await login(alice, "e2e_alice");
    await login(bob, "e2e_bob");

    // ── Alice creates duel ─────────────────────────────────────────────────
    await alice.goto("/duel/new");
    await alice.getByText("E2E Test Deck").click();
    await alice.getByRole("button", { name: "5 min", exact: true }).click();
    await alice.getByRole("button", { name: /create duel/i }).click();

    const linkText = (await alice.getByTestId("join-link").textContent())?.trim() ?? "";
    expect(linkText).toContain("/duel/join/");
    const joinPath = new URL(linkText).pathname;

    // ── Bob joins ──────────────────────────────────────────────────────────
    await bob.goto(joinPath);
    await bob.getByText("E2E Test Deck").click();
    await bob.getByRole("button", { name: /accept/i }).click();
    await bob.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/join/"));
    await expect(bob.getByTestId("duel-board")).toBeVisible();

    // ── Alice enters the duel board ────────────────────────────────────────
    await alice.getByRole("button", { name: /enter duel/i }).click();
    await alice.waitForURL(
      (u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/join/"),
    );
    await expect(alice.getByTestId("duel-board")).toBeVisible();

    // ── Assert Alice has a real IdleCommand (not the "Waiting…" placeholder) ─
    await expect(alice.getByTestId("action-panel")).toBeVisible();
    await expect(alice.getByTestId("no-decision")).toHaveCount(0);
    // IdleCommand populates summons[] from the hand — Normal Summon buttons present.
    await expect(alice.getByRole("button", { name: /Normal Summon/i }).first()).toBeVisible();

    // ════════════════════════════════════════════════════════════════════════
    // TURN 1 (Alice): Normal Summon → End Phase
    // First-player attack restriction: toBattlePhase=false on turn 1.
    // Alice summons a monster and must End Phase instead of going to Battle.
    // ════════════════════════════════════════════════════════════════════════

    // Pick the first hand card's Normal Summon action.
    await alice
      .getByRole("button", { name: /Normal Summon/i })
      .first()
      .click();

    // SelectZone: choose the first available monster zone slot.
    // zone-option buttons carry the select-zone-pulse infinite CSS animation
    // (transform: scale(1.015)); use force:true to bypass Playwright's bounding-box
    // stability check, which would otherwise loop until the test timeout.
    await expect(alice.getByTestId("zone-option").first()).toBeVisible();
    await alice.getByTestId("zone-option").first().click({ force: true });

    // Assert: the monster zone slot is occupied.
    // Note: duelQueryLocation returns code=0 for MZONE cards in the current
    // implementation (known limitation). The card therefore renders as
    // face-down-card, not face-up-card. The disappearance of empty-zone is the
    // reliable, observable proof that the card was placed in the zone.
    await expect(alice.locator('[data-testid="my-mzone"]').getByTestId("empty-zone")).toHaveCount(
      0,
    );

    // Bob's board re-renders from the STATE broadcast — both sides update.
    await expect(bob.getByTestId("duel-board")).toBeVisible();

    // End Phase — no Battle Phase available on turn 1 (toBattlePhase=false).
    await expect(alice.getByRole("button", { name: "End Phase" })).toBeVisible();
    await alice.getByRole("button", { name: "End Phase" }).click();

    // ════════════════════════════════════════════════════════════════════════
    // TURN 1 (Bob): Skip immediately — End Phase
    // ════════════════════════════════════════════════════════════════════════

    // Bob's IdleCommand arrives (no-decision disappears on Bob's page).
    await expect(bob.getByTestId("no-decision")).toHaveCount(0);
    await expect(bob.getByRole("button", { name: "End Phase" })).toBeVisible();
    await bob.getByRole("button", { name: "End Phase" }).click();

    // ════════════════════════════════════════════════════════════════════════
    // TURN 2 (Alice): Battle Phase → direct attack → LP drops
    // toBattlePhase=true (first-turn restriction lifted on turn 2).
    // ════════════════════════════════════════════════════════════════════════

    // Alice's turn-2 IdleCommand arrives.
    await expect(alice.getByTestId("no-decision")).toHaveCount(0);

    // Advance to Battle Phase.
    await expect(alice.getByRole("button", { name: "Proceed to Battle Phase" })).toBeVisible();
    await alice.getByRole("button", { name: "Proceed to Battle Phase" }).click();

    // Proof of entering Battle Phase: BattleCommand decision is delivered,
    // showing the attack button (canDirectAttack=true, opponent has no monsters).
    // (currentPhase tracking is not yet wired in EdisonDuel, so the phase ribbon
    // cannot be used as the assertion — the attack button is the real indicator.)
    await expect(alice.getByRole("button", { name: /Attack with/i }).first()).toBeVisible();
    await alice
      .getByRole("button", { name: /Attack with/i })
      .first()
      .click();

    // Safety net: pass any ChainPrompt that may surface to Bob during damage.
    // DECK40 is all Normal monsters (no effects) — this should never activate.
    await passIfChain(bob);

    // ── Assert real game progress ──────────────────────────────────────────
    // After the direct attack, the engine calculates damage and broadcasts a
    // STATE with Bob's updated LP. expect().not.toHaveAttribute polls for up to
    // 15 s (expect.timeout) until the LP changes.

    // On Alice's board: opponent strip (top) shows Bob's LP — first LP element.
    await expect(alice.locator('[aria-label^="LP: "]').first()).not.toHaveAttribute(
      "aria-label",
      "LP: 8000",
    );
    // On Bob's own board: "You" section (bottom) shows Bob's LP — last LP element.
    await expect(bob.locator('[aria-label^="LP: "]').last()).not.toHaveAttribute(
      "aria-label",
      "LP: 8000",
    );
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
