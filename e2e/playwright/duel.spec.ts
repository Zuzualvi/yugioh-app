import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Live 2-player duel BACKBONE (Part 2). Proves the transport + engine + relay
// loop end-to-end on the same-origin harness (see e2e/harness/server.ts):
//   • both seats connect over the real WS,
//   • both boards render REAL per-seat engine STATE,
//   • the on-clock seat's pending decision is DELIVERED on connect (Fix #2),
//   • a client→server→broadcast round-trip via RESIGN reaches BOTH players.
//
// NOTE (honest scope): the web ActionPanel's decision decode/encode layer is
// still mock-shaped and does NOT drive real gameplay moves, so this suite does
// NOT play a full duel — it proves the loop's plumbing + engine, then resigns.
// ---------------------------------------------------------------------------

const PASSWORD = "e2e-pass-12345";

async function login(page: Page, displayName: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("display-name-input").fill(displayName);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((u) => u.pathname === "/");
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
