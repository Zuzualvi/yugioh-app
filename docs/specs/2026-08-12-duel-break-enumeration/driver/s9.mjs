// S9 — drive BOTH seats to the end of a duel with a pump loop.
// Exercises: tribute summon + trigger effect, attacks (incl. a second attack in
// the same turn), chain responses both ways, and the duel-end overlay.
import { setup, snapshot, waitForBoard, handCodes } from "./lib.mjs";

const { browser, goesFirst: A, goesSecond: B, log, shot } = await setup("s9-full-duel");
const seats = [
  { p: A, tag: "seat0" },
  { p: B, tag: "seat1" },
];

async function state(p) {
  return p.evaluate(() => {
    const own = document.querySelector('[data-testid="clock-row-own"]')?.textContent ?? "";
    const q = document.querySelector('[data-testid="question-bar"]');
    const et = document.querySelector('[data-testid="end-turn-btn"]');
    return {
      ownRunning: /RUNNING/.test(own),
      hasQuestion: !!q,
      sentence: document.querySelector('[data-testid="decision-sentence"]')?.textContent ?? null,
      buttons: q
        ? Array.from(q.querySelectorAll("button")).map((b) => ({
            t: b.getAttribute("data-testid"),
            x: b.textContent.replace(/\s+/g, " ").trim(),
            d: b.disabled,
          }))
        : [],
      endTurnEnabled: et ? !et.disabled : false,
      dim: !!document.querySelector('[data-testid="dim-scrim"]'),
      ended: !!document.querySelector('[data-testid="duel-end-overlay"]'),
      lpOwn: document.querySelector('[data-testid="own-lp-plate"]')?.getAttribute("aria-label"),
      lpOpp: document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"),
      phases: Array.from(document.querySelectorAll('[data-testid="phase-ribbon"] button'))
        .filter((b) => !b.disabled)
        .map((b) => b.getAttribute("aria-label")),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((e) => e.textContent.trim()),
      chain: document.querySelector('[data-testid="chain-strip"]')?.textContent.replace(/\s+/g, " ").trim() ?? null,
      ribbon: document.querySelector('[data-testid="intent-ribbon"]')?.textContent.replace(/\s+/g, " ").trim() ?? null,
    };
  });
}
const verbs = (p) =>
  p.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="verb-chip-cluster"] [role="menuitem"]')).map((b) =>
      b.textContent.trim(),
    ),
  );

let chainRespondCount = 0;
let attacksThisTurn = 0;
let lastTurnOwner = null;

async function handleQuestion(s, seat, st) {
  log(`[${seat.tag}] QUESTION: ${JSON.stringify(st.sentence)} buttons=${JSON.stringify(st.buttons.map((b) => b.t + ":" + b.x))} ribbon=${JSON.stringify(st.ribbon)} chain=${JSON.stringify(st.chain)}`);
  await shot(seat.p, `${s}-${seat.tag}-question`);
  const p = seat.p;
  // Chain windows: decline the first, respond to the second.
  if (/Chain a card or effect/.test(st.sentence ?? "")) {
    const cands = p.getByTestId("decision-candidate");
    if (chainRespondCount === 0 && (await cands.count()) > 0) {
      chainRespondCount++;
      log(`[${seat.tag}] chain BRANCH=respond`);
      await cands.first().click();
      await p.waitForTimeout(250);
      const cf = p.getByTestId("decision-confirm");
      log(`[${seat.tag}] confirm label=${JSON.stringify(await cf.textContent())} disabled=${await cf.isDisabled()}`);
      await shot(seat.p, `${s}-${seat.tag}-chain-selected`);
      await cf.click();
    } else {
      log(`[${seat.tag}] chain BRANCH=decline`);
      await p.getByTestId("pass-option").first().click();
    }
    await p.waitForTimeout(1200);
    return true;
  }
  // Tribute selection
  if (/Tribute/.test(st.sentence ?? "")) {
    const cands = p.getByTestId("decision-candidate");
    log(`[${seat.tag}] tribute candidates: ${await cands.count()}`);
    if (await cands.count()) {
      await cands.first().click();
      await p.waitForTimeout(200);
      const cf = p.getByTestId("decision-confirm");
      log(`[${seat.tag}] tribute confirm=${JSON.stringify(await cf.textContent())} disabled=${await cf.isDisabled()}`);
      await shot(seat.p, `${s}-${seat.tag}-tribute-selected`);
      await cf.click();
      await p.waitForTimeout(1200);
      return true;
    }
  }
  // Anything else with a confirm/candidate: take the first legal option.
  const first = st.buttons.find((b) => !b.d && b.t && b.t !== "decision-decline");
  if (first) {
    log(`[${seat.tag}] answering with ${first.t} "${first.x}"`);
    await p.getByTestId(first.t).first().click();
    await p.waitForTimeout(1000);
    return true;
  }
  const dec = st.buttons.find((b) => !b.d);
  if (dec) {
    await p.getByTestId(dec.t ?? "pass-option").first().click();
    await p.waitForTimeout(1000);
    return true;
  }
  log(`[${seat.tag}] QUESTION WITH NO ANSWERABLE CONTROL — dead end`);
  return false;
}

async function takeTurn(s, seat, st) {
  const p = seat.p;
  if (lastTurnOwner !== seat.tag) {
    attacksThisTurn = 0;
    lastTurnOwner = seat.tag;
  }
  // 1. try a tribute summon or normal summon from hand
  const n = await p.getByTestId("own-hand-row").getByRole("button").count();
  for (let i = 0; i < n; i++) {
    const ok = await p
      .getByTestId("own-hand-row")
      .getByRole("button")
      .nth(i)
      .click({ timeout: 2500 })
      .then(() => true)
      .catch(() => false);
    if (!ok) {
      log(`[${seat.tag}] hand[${i}] UNCLICKABLE (occluded by panel)`);
      continue;
    }
    await p.waitForTimeout(150);
    const v = await verbs(p);
    if (v.length) log(`[${seat.tag}] hand[${i}] chips=${JSON.stringify(v)}`);
    const trib = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /tribute/i });
    if (await trib.count()) {
      log(`[${seat.tag}] TRIBUTE SUMMON from hand[${i}]`);
      await shot(seat.p, `${s}-${seat.tag}-tribute-chip`);
      await trib.first().click();
      await p.waitForTimeout(1200);
      return "tribute-summon";
    }
    const ns = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Normal Summon$/ });
    if (await ns.count()) {
      await ns.first().click();
      log(`[${seat.tag}] normal summon hand[${i}]`);
      await p.waitForTimeout(1000);
      return "summon";
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(60);
  }
  // 2. battle phase / attacks
  const bp = p.getByRole("button", { name: /Battle Phase.*advance/i });
  if (await bp.count()) {
    log(`[${seat.tag}] → Battle Phase`);
    await bp.first().click();
    await p.waitForTimeout(1000);
    return "to-bp";
  }
  const mz = p.locator('[data-testid="my-mzone"] button');
  const mzn = await mz.count();
  for (let i = 0; i < mzn; i++) {
    const ok = await mz.nth(i).click({ timeout: 2000 }).then(() => true).catch(() => false);
    if (!ok) continue;
    await p.waitForTimeout(200);
    const v = await verbs(p);
    const refusal = await p.getByTestId("refusal-chip").textContent().catch(() => null);
    if (v.length || refusal) log(`[${seat.tag}] monster[${i}] chips=${JSON.stringify(v)} refusal=${JSON.stringify(refusal)}`);
    const atk = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Attack/ });
    if (await atk.count()) {
      attacksThisTurn++;
      log(`[${seat.tag}] ATTACK #${attacksThisTurn} with monster[${i}]`);
      await atk.first().click();
      await p.waitForTimeout(1200);
      return "attack";
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(60);
  }
  // 3. set something
  for (let i = 0; i < (await p.getByTestId("own-hand-row").getByRole("button").count()); i++) {
    const ok = await p.getByTestId("own-hand-row").getByRole("button").nth(i).click({ timeout: 2000 }).then(() => true).catch(() => false);
    if (!ok) continue;
    await p.waitForTimeout(150);
    const set = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Set$/ });
    if (await set.count()) {
      await set.first().click();
      log(`[${seat.tag}] set hand[${i}]`);
      await p.waitForTimeout(900);
      return "set";
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(60);
  }
  // 4. end turn
  const et = p.getByTestId("end-turn-btn");
  if (!(await et.isDisabled())) {
    log(`[${seat.tag}] END TURN`);
    await et.click();
    await p.waitForTimeout(1200);
    return "end-turn";
  }
  return "nothing";
}

await waitForBoard(A);
await waitForBoard(B);
log("seat0 hand: " + JSON.stringify(await handCodes(A)));
log("seat1 hand: " + JSON.stringify(await handCodes(B)));

let steps = 0;
let idle = 0;
for (; steps < 140; steps++) {
  const sa = await state(A);
  const sb = await state(B);
  if (sa.ended || sb.ended) {
    log("### DUEL ENDED");
    break;
  }
  // report the stale-question condition: a question bar on the seat that is NOT on clock
  for (const [st, seat] of [
    [sa, seats[0]],
    [sb, seats[1]],
  ]) {
    if (st.hasQuestion && !st.ownRunning) {
      log(`[${seat.tag}] STALE QUESTION while off clock: ${JSON.stringify(st.sentence)} dim=${st.dim} endTurn=${st.endTurnEnabled} phases=${JSON.stringify(st.phases)}`);
      await shot(seat.p, `${steps}-${seat.tag}-stale-question`);
    }
    if (st.alerts.length) log(`[${seat.tag}] ALERT ${JSON.stringify(st.alerts)}`);
  }

  let acted = false;
  for (const [st, seat] of [
    [sa, seats[0]],
    [sb, seats[1]],
  ]) {
    if (st.ownRunning && st.hasQuestion) {
      acted = (await handleQuestion(steps, seat, st)) || acted;
    } else if (st.ownRunning && st.endTurnEnabled) {
      const what = await takeTurn(steps, seat, st);
      log(`[step ${steps}] ${seat.tag} did ${what}`);
      acted = acted || what !== "nothing";
    }
  }
  if (!acted) {
    idle++;
    await A.waitForTimeout(500);
    if (idle % 6 === 0) {
      log(`[step ${steps}] idle x${idle}: A=${JSON.stringify(sa)} B=${JSON.stringify(sb)}`);
      await shot(A, `${steps}-A-idle`);
      await shot(B, `${steps}-B-idle`);
    }
    if (idle > 24) {
      log("### STUCK — neither seat can act for 12s");
      await snapshot(A, "stuck-A", log);
      await snapshot(B, "stuck-B", log);
      break;
    }
  } else {
    idle = 0;
  }
}
log(`### finished after ${steps} steps`);
await snapshot(A, "final-A", log);
await snapshot(B, "final-B", log);
await shot(A, "final-A");
await shot(B, "final-B");
const endA = await A.evaluate(() => document.querySelector('[data-testid="duel-end-overlay"]')?.textContent.replace(/\s+/g, " ").trim() ?? null);
const endB = await B.evaluate(() => document.querySelector('[data-testid="duel-end-overlay"]')?.textContent.replace(/\s+/g, " ").trim() ?? null);
log("[end overlay seat0] " + JSON.stringify(endA));
log("[end overlay seat1] " + JSON.stringify(endB));
await browser.close();
