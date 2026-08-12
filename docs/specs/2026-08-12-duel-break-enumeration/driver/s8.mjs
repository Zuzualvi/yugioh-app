// S8 — attack declaration, a second attack in the same turn, and a chain
// response taken BOTH ways (decline, then respond).
import { setup, snapshot, waitForBoard, handCodes } from "./lib.mjs";

const { browser, goesFirst: A, goesSecond: B, log, shot } = await setup("s8-attack-chain-both");

const qb = (p) => p.getByTestId("question-bar");
const verbs = (p) =>
  p.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="verb-chip-cluster"] [role="menuitem"]')).map((b) =>
      b.textContent.trim(),
    ),
  );
async function readQuestion(p, tag) {
  const d = await p.evaluate(() => {
    const q = document.querySelector('[data-testid="question-bar"]');
    if (!q) return null;
    return {
      sentence: document.querySelector('[data-testid="decision-sentence"]')?.textContent ?? null,
      ribbon: document.querySelector('[data-testid="intent-ribbon"]')?.textContent.replace(/\s+/g, " ").trim() ?? null,
      chainStrip: document.querySelector('[data-testid="chain-strip"]')?.textContent.replace(/\s+/g, " ").trim() ?? null,
      buttons: Array.from(q.querySelectorAll("button")).map((b) => ({
        testid: b.getAttribute("data-testid"),
        text: b.textContent.replace(/\s+/g, " ").trim(),
        disabled: b.disabled,
      })),
      inspectorOpen: !!document.querySelector('[data-testid="card-inspector"]'),
    };
  });
  log(`[question:${tag}] ` + JSON.stringify(d));
  return d;
}
async function waitQuestion(p, ms = 4000) {
  for (let t = 0; t < ms / 100; t++) {
    if (await qb(p).count()) return true;
    await p.waitForTimeout(100);
  }
  return false;
}
async function declineIfAsked(p, tag) {
  if (await waitQuestion(p, 2500)) {
    await readQuestion(p, tag);
    const pass = p.getByTestId("pass-option");
    if (await pass.count()) await pass.first().click();
    else await p.keyboard.press("Escape");
    await p.waitForTimeout(800);
    log(`[${tag}] declined a question window`);
    return true;
  }
  return false;
}
async function onClock(p, tag, ms = 25000) {
  try {
    await p.waitForFunction(
      () => {
        const b = document.querySelector('[data-testid="end-turn-btn"]');
        return b && !b.disabled;
      },
      null,
      { timeout: ms },
    );
    return true;
  } catch {
    log(`[${tag}] never got the clock`);
    await snapshot(p, `${tag}-stuck`, log);
    await shot(p, `${tag}-stuck`);
    return false;
  }
}
async function actFromHand(p, re, tag) {
  const n = await p.getByTestId("own-hand-row").getByRole("button").count();
  for (let i = 0; i < n; i++) {
    const btn = p.getByTestId("own-hand-row").getByRole("button").nth(i);
    const ok = await btn.click({ timeout: 3000 }).then(() => true).catch(() => false);
    if (!ok) {
      log(`[${tag}] hand[${i}] NOT CLICKABLE (occluded)`);
      return false;
    }
    await p.waitForTimeout(160);
    const chip = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: re });
    if (await chip.count()) {
      await chip.first().click();
      log(`[${tag}] ${re} from hand[${i}]`);
      await p.waitForTimeout(900);
      return true;
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(80);
  }
  log(`[${tag}] no verb matching ${re}`);
  return false;
}

await waitForBoard(A);
await waitForBoard(B);

log("### TURN 1 seat0");
await onClock(A, "seat0-t1");
log("seat0 hand: " + JSON.stringify(await handCodes(A)));
await actFromHand(A, /^Normal Summon$/, "seat0-t1");
await declineIfAsked(A, "seat0-selfchain-after-summon");
await actFromHand(A, /^Set$/, "seat0-t1");
await declineIfAsked(A, "seat0-selfchain-after-set");
await A.getByTestId("end-turn-btn").click();
await declineIfAsked(A, "seat0-ep-window");

log("### TURN 1 seat1");
await onClock(B, "seat1-t1");
log("seat1 hand: " + JSON.stringify(await handCodes(B)));
await actFromHand(B, /^Normal Summon$/, "seat1-t1");
await declineIfAsked(B, "seat1-selfchain");
await actFromHand(B, /^Set$/, "seat1-t1");
await declineIfAsked(B, "seat1-selfchain2");
await shot(B, "seat1-field-set");
await B.getByTestId("end-turn-btn").click();
await declineIfAsked(B, "seat1-ep-window");

log("### TURN 2 seat0 — second monster, then Battle Phase");
await onClock(A, "seat0-t2");
await actFromHand(A, /^Normal Summon$/, "seat0-t2");
await declineIfAsked(A, "seat0-t2-selfchain");
await snapshot(A, "seat0-t2-main", log);
const bp = A.getByRole("button", { name: /Battle Phase.*advance/i });
log("BP button count: " + (await bp.count()));
if (await bp.count()) {
  await bp.first().click();
  await A.waitForTimeout(1500);
}
await declineIfAsked(A, "seat0-bp-entry-window");
await shot(A, "seat0-bp");
await snapshot(A, "seat0-bp", log);

log("### ATTACK 1");
const mz = A.locator('[data-testid="my-mzone"] button');
log("my monsters: " + (await mz.count()));
let attacked = 0;
for (let i = 0; i < (await mz.count()); i++) {
  await mz.nth(i).click({ timeout: 3000 }).catch(() => log(`monster[${i}] not clickable`));
  await A.waitForTimeout(250);
  const v = await verbs(A);
  const ref = await A.getByTestId("refusal-chip").textContent().catch(() => null);
  log(`[seat0] monster[${i}] verbs=${JSON.stringify(v)} refusal=${JSON.stringify(ref)}`);
  if (v.some((x) => /^Attack/.test(x))) {
    await shot(A, `attack-chips-${i}`);
    await A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Attack/ }).first().click();
    attacked++;
    log(`[seat0] attack #${attacked} declared with monster[${i}]`);
    // seat1 should now be asked
    const asked = await waitQuestion(B, 5000);
    log(`[seat1] chain window offered after attack #${attacked}: ${asked}`);
    if (asked) {
      await readQuestion(B, `seat1-attack${attacked}`);
      await shot(B, `seat1-chain-window-${attacked}`);
      await snapshot(B, `seat1-chain-window-${attacked}`, log);
      if (attacked === 1) {
        log("--- BRANCH A: decline ---");
        await B.getByTestId("pass-option").first().click();
      } else {
        log("--- BRANCH B: respond ---");
        const cand = B.getByTestId("decision-candidate");
        log("candidates: " + (await cand.count()));
        await cand.first().click();
        await B.waitForTimeout(300);
        await shot(B, "seat1-chain-selected");
        const cf = B.getByTestId("decision-confirm");
        log("confirm: " + JSON.stringify(await cf.textContent()) + " disabled=" + (await cf.isDisabled()));
        await cf.click();
      }
      await B.waitForTimeout(2500);
      await shot(B, `seat1-after-branch-${attacked}`);
      await snapshot(B, `seat1-after-branch-${attacked}`, log);
      await shot(A, `seat0-after-branch-${attacked}`);
      await snapshot(A, `seat0-after-branch-${attacked}`, log);
      const chainA = await A.evaluate(() => document.querySelector('[data-testid="chain-strip"]')?.textContent ?? null);
      log(`[seat0] chain strip during resolution: ${JSON.stringify(chainA)}`);
    }
    await A.waitForTimeout(2000);
    await declineIfAsked(A, `seat0-after-attack${attacked}`);
    if (attacked >= 2) break;
  } else {
    await A.keyboard.press("Escape");
    await A.waitForTimeout(100);
  }
}
log(`### attacks declared this turn: ${attacked}`);
await snapshot(A, "seat0-after-attacks", log);
await shot(A, "seat0-after-attacks");
await snapshot(B, "seat1-after-attacks", log);

log("### event log rail");
await A.getByTestId("log-toggle").click().catch(async () => {
  await A.getByRole("button", { name: /log/i }).first().click();
});
await A.waitForTimeout(600);
await shot(A, "event-log-open");
const logText = await A.evaluate(() => {
  const r = document.querySelector('[data-testid="event-log-rail"]');
  return r ? r.textContent.replace(/\s+/g, " ").trim().slice(0, 1500) : null;
});
log("[event log] " + JSON.stringify(logText));

await browser.close();
