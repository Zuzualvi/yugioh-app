// S13 — is the DIRECT attack path (empty opposing field) also broken, or only
// attacks into a monster?
import { setup, snapshot, waitForBoard } from "./lib.mjs";

const { browser, goesFirst: A, goesSecond: B, log, shot } = await setup("s14-direct-attack-2");
const verbs = (p) =>
  p.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="verb-chip-cluster"] [role="menuitem"]')).map((b) => b.textContent.trim()),
  );
const clearQ = async (p) => {
  for (let i = 0; i < 12; i++) {
    if (!(await p.getByTestId("question-bar").count())) return;
    const pass = p.getByTestId("pass-option");
    if (await pass.count()) await pass.first().click();
    else break;
    await p.waitForTimeout(700);
  }
};
const onClock = (p) =>
  p.waitForFunction(() => { const b = document.querySelector('[data-testid="end-turn-btn"]'); return b && !b.disabled; }, null, { timeout: 30000 });

await waitForBoard(A); await waitForBoard(B);
await onClock(A);
// seat0 summons one monster
const n = await A.getByTestId("own-hand-row").getByRole("button").count();
for (let i = 0; i < n; i++) {
  await A.getByTestId("own-hand-row").getByRole("button").nth(i).click({ timeout: 3000 }).catch(() => {});
  await A.waitForTimeout(150);
  const c = A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Normal Summon$/ });
  if (await c.count()) { await c.first().click(); log("seat0 summoned"); break; }
  await A.keyboard.press("Escape");
}
await A.waitForTimeout(1200); await clearQ(A);
await A.getByTestId("end-turn-btn").click();
await clearQ(A);

// seat1 passes without summoning — its field stays EMPTY
await onClock(B);
await clearQ(B);
log("seat1 ends turn with an empty field");
await B.getByTestId("end-turn-btn").click();
await clearQ(B);

// seat0 turn 2: battle phase, direct attack
await onClock(A);
await clearQ(A);
const bp = A.getByRole("button", { name: /Battle Phase.*advance/i });
log("BP available: " + (await bp.count()));
await bp.first().click();
await A.waitForTimeout(1500);
await clearQ(A);
const mz = A.locator('[data-testid="my-mzone"] button');
await mz.first().click({ timeout: 4000 });
await A.waitForTimeout(300);
const v = await verbs(A);
log("verbs on my monster (empty opposing field): " + JSON.stringify(v));
await shot(A, "direct-attack-chips");
const lpBefore = await A.evaluate(() => document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"));
await A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Attack/ }).first().click();
for (let r = 0; r < 8; r++) {
  await A.waitForTimeout(900);
  await clearQ(A);
  await clearQ(B);
}
const lpAfter = await A.evaluate(() => document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"));
log(`DIRECT ATTACK: before=${lpBefore} after=${lpAfter} changed=${lpBefore !== lpAfter}`);
await shot(A, "after-direct-attack");
await shot(B, "seat1-after-direct-attack");
await snapshot(A, "after-direct-attack", log);
await snapshot(B, "seat1-after-direct-attack", log);
await browser.close();
