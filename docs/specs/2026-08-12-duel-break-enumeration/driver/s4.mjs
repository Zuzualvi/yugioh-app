// S4 — attack, chain response (both branches), second attack in the same turn.
import { setup, snapshot, waitForBoard, layout, startPanelRecorder, dumpRecorder } from "./lib.mjs";

const { browser, goesFirst, goesSecond, log, shot } = await setup("s4-attack-and-chain");
const A = goesFirst,
  B = goesSecond;

const verbs = (p) =>
  p.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="verb-chip-cluster"] [role="menuitem"]'),
    ).map((b) => b.textContent.trim()),
  );
const clickHand = async (p, i) => {
  await p.getByTestId("own-hand-row").getByRole("button").nth(i).click();
  await p.waitForTimeout(180);
};
async function actFromHand(p, verbRe, label) {
  const n = await p.getByTestId("own-hand-row").getByRole("button").count();
  for (let i = 0; i < n; i++) {
    await clickHand(p, i);
    const chip = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: verbRe });
    if ((await chip.count()) > 0) {
      await chip.first().click();
      log(`[${label}] ${verbRe} from hand[${i}]`);
      await p.waitForTimeout(900);
      return true;
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(80);
  }
  log(`[${label}] no ${verbRe} available`);
  return false;
}
async function waitOnClock(p, label, ms = 20000) {
  try {
    await p.waitForFunction(
      () => {
        const b = document.querySelector('[data-testid="end-turn-btn"]');
        return b && !b.disabled;
      },
      null,
      { timeout: ms },
    );
    log(`[${label}] on clock`);
    return true;
  } catch {
    log(`[${label}] NEVER got the clock within ${ms}ms`);
    await snapshot(p, `${label}-stuck`, log);
    return false;
  }
}

await waitForBoard(A);
await waitForBoard(B);

log("### TURN 1 — seat0 summons + sets a trap");
await waitOnClock(A, "seat0");
await actFromHand(A, /^Normal Summon$/, "seat0");
await actFromHand(A, /^Set$/, "seat0");
await A.getByTestId("end-turn-btn").click();

log("### TURN 1 — seat1 summons + sets a trap");
await waitOnClock(B, "seat1");
await actFromHand(B, /^Normal Summon$/, "seat1");
await actFromHand(B, /^Set$/, "seat1");
await shot(B, "seat1-board-after-set");
await B.getByTestId("end-turn-btn").click();

log("### TURN 2 — seat0: summon a second monster, go to Battle Phase");
await waitOnClock(A, "seat0-t2");
await actFromHand(A, /^Normal Summon$/, "seat0-t2");
await snapshot(A, "seat0-t2-before-bp", log);
const bp = A.getByRole("button", { name: /Battle Phase.*advance/i });
log(`[seat0] BP button present: ${await bp.count()}`);
await bp.first().click();
await A.waitForTimeout(1200);
await shot(A, "seat0-battle-phase");
await snapshot(A, "seat0-in-bp", log);

// what does clicking my monster offer now?
const mz = A.locator('[data-testid="my-mzone"] button');
log(`[seat0] my mzone buttons: ${await mz.count()}`);
await mz.first().click();
await A.waitForTimeout(250);
log(`[seat0] verbs on my monster in BP: ${JSON.stringify(await verbs(A))}`);
await shot(A, "seat0-attack-chips");

log("### ATTACK #1 — declare; seat1 should get a chain window (trap set)");
await startPanelRecorder(B);
const atkChip = A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Attack/ });
await atkChip.first().click();
await A.waitForTimeout(1500);
await snapshot(A, "seat0-after-attack-declared", log);
await shot(A, "seat0-after-attack-declared");
await snapshot(B, "seat1-chain-window", log);
await shot(B, "seat1-chain-window");
await dumpRecorder(B, "seat1-chain-window", log);

// If seat1 has a question bar — read it exactly as the player sees it.
const qb = await B.evaluate(() => {
  const q = document.querySelector('[data-testid="question-bar"]');
  if (!q) return null;
  return {
    sentence: document.querySelector('[data-testid="decision-sentence"]')?.textContent ?? null,
    buttons: Array.from(q.querySelectorAll("button")).map((b) => ({
      testid: b.getAttribute("data-testid"),
      text: b.textContent.replace(/\s+/g, " ").trim(),
      disabled: b.disabled,
    })),
    dim: !!document.querySelector('[data-testid="dim-scrim"]'),
  };
});
log("[seat1] question bar: " + JSON.stringify(qb));
await layout(B, "seat1-chain-window", log);

if (qb) {
  log("### BRANCH 1 — DECLINE (No response)");
  const pass = B.getByTestId("pass-option");
  if ((await pass.count()) > 0) {
    await pass.first().click();
  } else {
    log("[seat1] NO pass-option present — cannot decline");
  }
  await B.waitForTimeout(1500);
  await snapshot(B, "seat1-after-decline", log);
  await shot(B, "seat1-after-decline");
}
await A.waitForTimeout(1500);
await snapshot(A, "seat0-after-attack-resolved", log);
await shot(A, "seat0-after-attack-resolved");

log("### ATTACK #2 — same turn, second monster");
await waitOnClock(A, "seat0-bp2", 8000).catch(() => {});
const mz2 = A.locator('[data-testid="my-mzone"] button');
const n2 = await mz2.count();
log(`[seat0] mzone buttons for 2nd attack: ${n2}`);
for (let i = 0; i < n2; i++) {
  await mz2.nth(i).click();
  await A.waitForTimeout(250);
  const v = await verbs(A);
  const refusal = await A.getByTestId("refusal-chip")
    .textContent()
    .catch(() => null);
  log(`[seat0] monster[${i}] verbs=${JSON.stringify(v)} refusal=${JSON.stringify(refusal)}`);
  if (v.some((x) => /Attack/.test(x))) {
    await shot(A, `second-attack-chips-${i}`);
    await A.getByTestId("verb-chip-cluster")
      .getByRole("menuitem", { name: /^Attack/ })
      .first()
      .click();
    log(`[seat0] second attack declared with monster[${i}]`);
    await A.waitForTimeout(2000);
    break;
  }
  await A.keyboard.press("Escape");
  await A.waitForTimeout(100);
}
await snapshot(A, "seat0-after-second-attack", log);
await shot(A, "seat0-after-second-attack");
await snapshot(B, "seat1-after-second-attack", log);
await shot(B, "seat1-after-second-attack");

log("### seat0 ends turn -> seat1 turn, seat1 attacks into seat0's set trap (RESPOND branch)");
const endEnabled = await A.evaluate(
  () => !document.querySelector('[data-testid="end-turn-btn"]').disabled,
);
log(`[seat0] end-turn enabled after attacks: ${endEnabled}`);
if (endEnabled) await A.getByTestId("end-turn-btn").click();
await waitOnClock(B, "seat1-t3");
await shot(B, "seat1-turn3");
const bp2 = B.getByRole("button", { name: /Battle Phase.*advance/i });
if ((await bp2.count()) > 0) {
  await bp2.first().click();
  await B.waitForTimeout(1200);
  const bmz = B.locator('[data-testid="my-mzone"] button');
  const bn = await bmz.count();
  for (let i = 0; i < bn; i++) {
    await bmz.nth(i).click();
    await B.waitForTimeout(250);
    const v = await verbs(B);
    log(`[seat1] monster[${i}] BP verbs=${JSON.stringify(v)}`);
    if (v.some((x) => /Attack/.test(x))) {
      await B.getByTestId("verb-chip-cluster")
        .getByRole("menuitem", { name: /^Attack/ })
        .first()
        .click();
      break;
    }
    await B.keyboard.press("Escape");
  }
  await A.waitForTimeout(1800);
  log("### BRANCH 2 — RESPOND: seat0 should be offered its set trap");
  await snapshot(A, "seat0-chain-window", log);
  await shot(A, "seat0-chain-window");
  const qb2 = await A.evaluate(() => {
    const q = document.querySelector('[data-testid="question-bar"]');
    if (!q) return null;
    return {
      sentence: document.querySelector('[data-testid="decision-sentence"]')?.textContent ?? null,
      buttons: Array.from(q.querySelectorAll("button")).map((b) => ({
        testid: b.getAttribute("data-testid"),
        text: b.textContent.replace(/\s+/g, " ").trim(),
        disabled: b.disabled,
      })),
    };
  });
  log("[seat0] chain question bar: " + JSON.stringify(qb2));
  if (qb2) {
    const cand = A.getByTestId("decision-candidate");
    if ((await cand.count()) > 0) {
      await cand.first().click();
      await A.waitForTimeout(300);
      await shot(A, "seat0-chain-selected");
      const confirm = A.getByTestId("decision-confirm");
      log(
        `[seat0] confirm label: ${JSON.stringify(await confirm.textContent().catch(() => null))} disabled=${await confirm.isDisabled().catch(() => null)}`,
      );
      await confirm.click();
      await A.waitForTimeout(2500);
      await snapshot(A, "seat0-after-chain-activate", log);
      await shot(A, "seat0-after-chain-activate");
      await shot(B, "seat1-sees-chain");
      await snapshot(B, "seat1-sees-chain", log);
    }
  }
}

await browser.close();
