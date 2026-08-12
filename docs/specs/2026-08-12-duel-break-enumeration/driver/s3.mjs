// S3 — a real first turn at the declared 1440x900 floor.
//  * layout measurement (is anything the player needs off-screen?)
//  * verb chips per hand card
//  * Normal Summon -> auto zone -> receipt lifetime (measured via MutationObserver)
//  * Set
//  * end turn / handover
import { setup, snapshot, waitForBoard, layout, startPanelRecorder, dumpRecorder } from "./lib.mjs";

const { browser, goesFirst, goesSecond, log, shot } = await setup("s3-turn1-real");

await waitForBoard(goesFirst);
await waitForBoard(goesSecond);
log("=== board rendered for both seats ===");
await shot(goesFirst, "seat0-board");
await shot(goesSecond, "seat1-board");
await layout(goesFirst, "seat0-idle", log);
await layout(goesSecond, "seat1-waiting", log);
await snapshot(goesFirst, "seat0-idle", log);

const hand = await goesFirst.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid="own-hand-row"] button')).map((b, i) => ({
    i,
    aria: b.getAttribute("aria-label"),
    title: b.getAttribute("title"),
    text: b.textContent.trim(),
  })),
);
log("[seat0] hand as the player sees it: " + JSON.stringify(hand));

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

log("=== verb chips per hand card ===");
for (let i = 0; i < hand.length; i++) {
  await clickHand(goesFirst, i);
  const v = await verbs(goesFirst);
  const refusal = await goesFirst
    .getByTestId("refusal-chip")
    .textContent()
    .catch(() => null);
  log(`[seat0] hand[${i}] verbs=${JSON.stringify(v)} refusal=${JSON.stringify(refusal)}`);
  if (i === 0) {
    await shot(goesFirst, "verbchips-hand0");
    const chipRects = await goesFirst.evaluate(() => {
      const c = document.querySelector('[data-testid="verb-chip-cluster"]');
      if (!c) return null;
      const b = c.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, offBottom: b.bottom > innerHeight, offRight: b.right > innerWidth };
    });
    log("[seat0] verb cluster rect: " + JSON.stringify(chipRects));
  }
  await goesFirst.keyboard.press("Escape");
  await goesFirst.waitForTimeout(120);
}

log("=== Normal Summon (recorder on) ===");
await startPanelRecorder(goesFirst);
let summonedAt = -1;
for (let i = 0; i < hand.length && summonedAt < 0; i++) {
  await clickHand(goesFirst, i);
  const chip = goesFirst
    .getByTestId("verb-chip-cluster")
    .getByRole("menuitem", { name: /^Normal Summon$/ });
  if ((await chip.count()) > 0) {
    await chip.first().click();
    summonedAt = i;
  } else {
    await goesFirst.keyboard.press("Escape");
    await goesFirst.waitForTimeout(100);
  }
}
log(`[seat0] Normal Summon from hand[${summonedAt}]`);
await goesFirst.waitForTimeout(1500);
await dumpRecorder(goesFirst, "normal-summon", log);
await shot(goesFirst, "after-summon");
await shot(goesSecond, "seat1-sees-summon");

const mz = await goesFirst.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid="my-mzone"] > *')).map((e) => ({
    testid: e.getAttribute("data-testid"),
    aria: e.getAttribute("aria-label"),
    text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 80),
  })),
);
log("[seat0] my mzone after summon: " + JSON.stringify(mz));
const oppView = await goesSecond.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid="opp-mzone"] > *')).map((e) => ({
    testid: e.getAttribute("data-testid"),
    aria: e.getAttribute("aria-label"),
  })),
);
log("[seat1] opp mzone as seen by opponent: " + JSON.stringify(oppView));

log("=== Set a spell/trap ===");
const hand2 = await goesFirst.getByTestId("own-hand-row").getByRole("button").count();
for (let i = 0; i < hand2; i++) {
  await clickHand(goesFirst, i);
  const chip = goesFirst.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Set$/ });
  if ((await chip.count()) > 0) {
    await chip.first().click();
    log(`[seat0] Set from hand[${i}]`);
    break;
  }
  await goesFirst.keyboard.press("Escape");
  await goesFirst.waitForTimeout(100);
}
await goesFirst.waitForTimeout(1200);
await shot(goesFirst, "after-set");
await snapshot(goesFirst, "after-set", log);
const sz = await goesFirst.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid="my-szone"] > *')).map((e) => ({
    testid: e.getAttribute("data-testid"),
    aria: e.getAttribute("aria-label"),
  })),
);
log("[seat0] my szone after set: " + JSON.stringify(sz));

log("=== end turn ===");
await startPanelRecorder(goesSecond);
await goesFirst.getByTestId("end-turn-btn").click();
await goesFirst.waitForTimeout(2000);
await snapshot(goesFirst, "seat0-after-handover", log);
await shot(goesFirst, "seat0-after-handover");
await dumpRecorder(goesSecond, "seat1-gets-control", log);
await snapshot(goesSecond, "seat1-now-on-clock", log);
await shot(goesSecond, "seat1-now-on-clock");
await layout(goesFirst, "seat0-offclock", log);

await browser.close();
