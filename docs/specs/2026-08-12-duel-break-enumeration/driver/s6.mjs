// S6 — the self-chain window after your own Normal Summon:
// what it says, what it hides, and whether the hand is still reachable.
import { setup, snapshot, waitForBoard, layout, handCodes } from "./lib.mjs";

const { browser, goesFirst: A, goesSecond: B, log, shot } = await setup("s6-selfchain-block");

async function probe(p, label) {
  const d = await p.evaluate(() => {
    const rect = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) };
    };
    const row = document.querySelector('[data-testid="own-hand-row"]');
    const btns = Array.from(row?.querySelectorAll("button") ?? []);
    return {
      mode_questionBar: !!document.querySelector('[data-testid="question-bar"]'),
      dimScrim: !!document.querySelector('[data-testid="dim-scrim"]'),
      sentence: document.querySelector('[data-testid="decision-sentence"]')?.textContent ?? null,
      panelText: document.querySelector('[data-testid="action-panel"]')?.textContent.replace(/\s+/g, " ").trim() ?? null,
      panel: rect('[data-testid="action-panel"]'),
      handRow: rect('[data-testid="own-hand-row"]'),
      endTurnDisabled: document.querySelector('[data-testid="end-turn-btn"]')?.disabled ?? null,
      phaseButtonsEnabled: Array.from(document.querySelectorAll('[data-testid="phase-ribbon"] button')).filter((b) => !b.disabled).map((b) => b.getAttribute("aria-label")),
      qbButtons: Array.from(document.querySelectorAll('[data-testid="question-bar"] button')).map((b) => ({ testid: b.getAttribute("data-testid"), text: b.textContent.replace(/\s+/g, " ").trim(), disabled: b.disabled })),
      handHits: btns.map((b, i) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        return { i, hit: hit ? hit.tagName + "[" + (hit.getAttribute("data-testid") ?? "-") + "]" : null, hittable: !!hit && (hit === b || b.contains(hit)) };
      }),
    };
  });
  log(`[probe:${label}] ` + JSON.stringify(d));
  return d;
}

await waitForBoard(A);
await waitForBoard(B);
await A.waitForFunction(() => { const b = document.querySelector('[data-testid="end-turn-btn"]'); return b && !b.disabled; }, null, { timeout: 20000 });

const BOOK = 14087893; // Book of Moon — quick-play, chainable from hand
const hA = await handCodes(A);
const hB = await handCodes(B);
log("seat0 hand codes: " + JSON.stringify(hA));
log("seat1 hand codes: " + JSON.stringify(hB));
let actor = A;
if (!hA.includes(BOOK) && hB.includes(BOOK)) {
  log("seat0 has no quick-play; passing turn so seat1 (who holds Book of Moon) acts");
  await A.getByTestId("end-turn-btn").click();
  await B.waitForFunction(() => { const b = document.querySelector('[data-testid="end-turn-btn"]'); return b && !b.disabled; }, null, { timeout: 20000 });
  actor = B;
} else if (!hA.includes(BOOK)) {
  log("NEITHER seat holds a quick-play this run — self-chain window will not fire");
}
const A0 = A;
// rebind: from here on "A" means the acting seat
// eslint-disable-next-line no-global-assign
globalThis.__actor = actor;
const n = await actor.getByTestId("own-hand-row").getByRole("button").count();
for (let i = 0; i < n; i++) {
  await actor.getByTestId("own-hand-row").getByRole("button").nth(i).click();
  await actor.waitForTimeout(180);
  const chip = actor.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Normal Summon$/ });
  if ((await chip.count()) > 0) { await chip.first().click(); log(`summoned from hand[${i}]`); break; }
  await actor.keyboard.press("Escape");
  await actor.waitForTimeout(80);
}

// Poll for a question bar for up to 4s.
let sawQb = false;
for (let t = 0; t < 40; t++) {
  await actor.waitForTimeout(100);
  if (await actor.getByTestId("question-bar").count()) { sawQb = true; break; }
}
log("question bar appeared after own summon: " + sawQb);
await shot(actor, "after-own-summon");
const p1 = await probe(actor, "after-own-summon");
await layout(actor, "answer-mode", log);

if (sawQb) {
  log("### the player tries to keep playing: click a hand card");
  const e = await actor.getByTestId("own-hand-row").getByRole("button").first().click({ timeout: 4000 }).then(() => null).catch((x) => x.message.split("\n").slice(0, 3).join(" | "));
  log("hand click while question bar up → " + (e ?? "OK (no interception)"));
  await actor.waitForTimeout(400);
  await shot(actor, "hand-click-during-question");
  await probe(actor, "after-hand-click");

  log("### the player tries End Turn instead");
  const et = await actor.evaluate(() => document.querySelector('[data-testid="end-turn-btn"]').disabled);
  log("end-turn disabled during question: " + et);

  log("### Esc — the documented escape hatch");
  await actor.keyboard.press("Escape");
  await actor.waitForTimeout(800);
  await probe(actor, "after-escape");
  await shot(actor, "after-escape");
}

// Answer it properly if still up.
if (await actor.getByTestId("question-bar").count()) {
  const pass = actor.getByTestId("pass-option");
  log("pass-option count: " + (await pass.count()));
  if (await pass.count()) {
    await pass.first().click();
    await actor.waitForTimeout(1200);
    await probe(actor, "after-no-response");
    await shot(actor, "after-no-response");
  }
}
await snapshot(actor, "final", log);
await browser.close();
