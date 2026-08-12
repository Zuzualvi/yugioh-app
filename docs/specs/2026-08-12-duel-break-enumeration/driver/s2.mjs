// S2 — turn 1: normal summon, set, end turn, and what happens to the player who
// just handed over control.
import { setup, snapshot } from "./lib.mjs";

const { browser, goesFirst, goesSecond, log, shot } = await setup("s2-turn1-handover");

async function verbs(page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="verb-chip-cluster"] [role="menuitem"]'),
    ).map((b) => b.textContent.trim()),
  );
}
async function clickHand(page, i) {
  await page.getByTestId("own-hand-row").getByRole("button").nth(i).click();
  await page.waitForTimeout(200);
}

log("=== A. seat0 board at start ===");
await snapshot(goesFirst, "t1-start", log);
const handInfo = await goesFirst.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid="own-hand-row"] button')).map((b, i) => ({
    i,
    aria: b.getAttribute("aria-label"),
    src: b.querySelector("img")?.getAttribute("src"),
  })),
);
log("[first] hand: " + JSON.stringify(handInfo));

log("=== B. click each hand card, record the verb chips offered ===");
for (let i = 0; i < handInfo.length; i++) {
  await clickHand(goesFirst, i);
  const v = await verbs(goesFirst);
  const refusal = await goesFirst
    .getByTestId("refusal-chip")
    .textContent()
    .catch(() => null);
  log(`[first] hand[${i}] verbs=${JSON.stringify(v)} refusal=${JSON.stringify(refusal)}`);
  if (i === 0) await shot(goesFirst, `verbchips-hand0`);
  await goesFirst.keyboard.press("Escape");
  await goesFirst.waitForTimeout(120);
}

log("=== C. Normal Summon the first summonable card ===");
let summoned = false;
for (let i = 0; i < handInfo.length && !summoned; i++) {
  await clickHand(goesFirst, i);
  const chip = goesFirst
    .getByTestId("verb-chip-cluster")
    .getByRole("menuitem", { name: /^Normal Summon$/ });
  if ((await chip.count()) > 0) {
    await shot(goesFirst, "before-summon");
    await chip.first().click();
    summoned = true;
    log(`[first] clicked Normal Summon on hand[${i}]`);
  } else {
    await goesFirst.keyboard.press("Escape");
  }
}
// Look at the very next 400ms — the auto-answer receipt lives 240ms.
for (const d of [60, 150, 300, 600]) {
  await goesFirst.waitForTimeout(d === 60 ? 60 : d - 0);
  const s = await snapshot(goesFirst, `after-summon+${d}`, log);
  void s;
}
await shot(goesFirst, "after-summon");
await shot(goesSecond, "opponent-sees-summon");
await snapshot(goesSecond, "opp-after-summon", log);

log("=== D. set a trap from hand ===");
for (let i = 0; i < handInfo.length; i++) {
  await clickHand(goesFirst, i);
  const chip = goesFirst.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Set$/ });
  if ((await chip.count()) > 0) {
    await chip.first().click();
    log(`[first] Set from hand[${i}]`);
    break;
  }
  await goesFirst.keyboard.press("Escape");
}
await goesFirst.waitForTimeout(800);
await shot(goesFirst, "after-set");
await snapshot(goesFirst, "after-set", log);

log("=== E. End turn — then watch the seat that just handed over ===");
await goesFirst.getByTestId("end-turn-btn").click();
await goesFirst.waitForTimeout(400);
await snapshot(goesFirst, "just-ended-turn+400ms", log);
await shot(goesFirst, "after-end-turn");
await goesFirst.waitForTimeout(2500);
await snapshot(goesFirst, "just-ended-turn+3s", log);
await shot(goesFirst, "after-end-turn-3s");

log("=== F. off-clock seat clicks its own cards anyway ===");
const nHand = await goesFirst.getByTestId("own-hand-row").getByRole("button").count();
log(`[first] hand buttons now: ${nHand}`);
if (nHand > 0) {
  await clickHand(goesFirst, 0);
  const v = await verbs(goesFirst);
  log(`[first] OFF-CLOCK verbs offered: ${JSON.stringify(v)}`);
  await shot(goesFirst, "offclock-verbs");
  if (v.length > 1) {
    // pick the first non-Inspect verb and see what the server says
    const chip = goesFirst
      .getByTestId("verb-chip-cluster")
      .getByRole("menuitem")
      .filter({ hasNotText: "Inspect" })
      .first();
    await chip.click();
    await goesFirst.waitForTimeout(700);
    await snapshot(goesFirst, "offclock-after-verb-click", log);
    await shot(goesFirst, "offclock-after-verb-click");
  }
}
log("=== G. also try the phase rail while off clock ===");
const endTurnEnabled = await goesFirst.evaluate(
  () => !document.querySelector('[data-testid="end-turn-btn"]').disabled,
);
log(`[first] end-turn enabled while off clock: ${endTurnEnabled}`);

log("=== H. meanwhile seat 1 ===");
await snapshot(goesSecond, "seat1-on-clock", log);
await shot(goesSecond, "seat1-on-clock");

await browser.close();
