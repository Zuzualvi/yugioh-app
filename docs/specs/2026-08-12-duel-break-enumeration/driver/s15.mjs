// S15 — is the attack no-op caused by the response-prompt level?
// Same flow as S11 but with "Every window" selected on the attacking seat.
import { setup, snapshot, waitForBoard } from "./lib.mjs";

const { browser, goesFirst: A, goesSecond: B, log, shot } = await setup("s15-attack-promptlevel");
const verbs = (p) =>
  p.evaluate(() => Array.from(document.querySelectorAll('[data-testid="verb-chip-cluster"] [role="menuitem"]')).map((b) => b.textContent.trim()));
const clearQ = async (p, tag) => {
  for (let i = 0; i < 10; i++) {
    if (!(await p.getByTestId("question-bar").count())) return;
    const s = await p.evaluate(() => document.querySelector('[data-testid="decision-sentence"]')?.textContent);
    const pass = p.getByTestId("pass-option");
    const cand = p.getByTestId("decision-candidate");
    const cf = p.getByTestId("decision-confirm");
    if (await pass.count()) { log(`[${tag}] passing on "${s}"`); await pass.first().click(); }
    else if (await cand.count()) {
      log(`[${tag}] answering "${s}" by picking the first candidate: ${JSON.stringify(await cand.first().textContent())}`);
      await cand.first().click(); await p.waitForTimeout(250);
      if ((await cf.count()) && !(await cf.isDisabled())) await cf.click();
    } else break;
    await p.waitForTimeout(900);
  }
};
const onClock = (p) => p.waitForFunction(() => { const b = document.querySelector('[data-testid="end-turn-btn"]'); return b && !b.disabled; }, null, { timeout: 30000 });
const summon = async (p, tag) => {
  const n = await p.getByTestId("own-hand-row").getByRole("button").count();
  for (let i = 0; i < n; i++) {
    await p.getByTestId("own-hand-row").getByRole("button").nth(i).click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(150);
    const c = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Normal Summon$/ });
    if (await c.count()) { await c.first().click(); log(`${tag} summoned hand[${i}]`); await p.waitForTimeout(1200); return true; }
    await p.keyboard.press("Escape");
  }
  return false;
};

await waitForBoard(A); await waitForBoard(B);

log("### set seat0's Response prompts to 'Every window'");
await A.getByTestId("response-prompt-control").click();
await A.waitForTimeout(300);
await shot(A, "prompt-level-menu");
const opts = await A.evaluate(() => Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.textContent.replace(/\s+/g, " ").trim()));
log("prompt options: " + JSON.stringify(opts));
await A.getByRole("option", { name: /Every window/i }).first().click();
await A.waitForTimeout(400);
log("prompt level now: " + (await A.getByTestId("response-prompt-control").textContent()));

await onClock(A);
await summon(A, "seat0");
await clearQ(A, "seat0");
await A.getByTestId("end-turn-btn").click();
await clearQ(A, "seat0");

await onClock(B);
await summon(B, "seat1");
await clearQ(B, "seat1");
await B.getByTestId("end-turn-btn").click();
await clearQ(B, "seat1");

await onClock(A);
await clearQ(A, "seat0");
const bp = A.getByRole("button", { name: /Battle Phase.*advance/i });
await bp.first().click();
await A.waitForTimeout(1500);
await clearQ(A, "seat0");
const mz = A.locator('[data-testid="my-mzone"] button');
await mz.first().click({ timeout: 4000 });
await A.waitForTimeout(300);
log("verbs: " + JSON.stringify(await verbs(A)));
const before = await A.evaluate(() => document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"));
await A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Attack/ }).first().click();
await A.waitForTimeout(1200);
// The attack-target question should now be OFFERED rather than auto-declined.
const q = await A.evaluate(() => {
  const el = document.querySelector('[data-testid="question-bar"]');
  return el ? { sentence: document.querySelector('[data-testid="decision-sentence"]')?.textContent, text: el.textContent.replace(/\s+/g, " ").trim() } : null;
});
log("[seat0] question after attack declaration: " + JSON.stringify(q));
await shot(A, "attack-target-question");
for (let r = 0; r < 8; r++) { await A.waitForTimeout(900); await clearQ(A, "seat0"); await clearQ(B, "seat1"); }
const after = await A.evaluate(() => document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"));
const ownAfter = await A.evaluate(() => document.querySelector('[data-testid="own-lp-plate"]')?.getAttribute("aria-label"));
log(`ATTACK INTO A MONSTER with 'Every window': oppLp ${before} -> ${after} (ownLp ${ownAfter})`);
await shot(A, "after-attack");
await snapshot(A, "after-attack", log);
await browser.close();
