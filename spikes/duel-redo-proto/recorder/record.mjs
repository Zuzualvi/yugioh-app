// ZUH-121 fixture recorder — drives a full duel through the shipped client with
// response-prompt suppression OFF on both seats (so the engine's real decision
// sequence is not hidden by the mechanism this redesign deletes), and captures
// every WebSocket frame in full from both seats.
import { setup, waitForBoard } from "./lib.mjs";

const NAME = process.argv[2] ?? "full-duel";
const MAX_STEPS = Number(process.argv[3] ?? 120);

const { browser, first: A, second: B, rec } = await setup(NAME);
const seats = [
  { p: A, tag: "seat0" },
  { p: B, tag: "seat1" },
];

async function setEveryWindow(p, tag) {
  try {
    await p.getByTestId("response-prompt-control").click();
    await p.waitForTimeout(250);
    await p.getByRole("option", { name: /Every window/i }).first().click();
    await p.waitForTimeout(300);
    rec.note(`${tag} prompt level = ${await p.getByTestId("response-prompt-control").textContent()}`);
  } catch (e) {
    rec.note(`${tag} prompt level FAILED: ${e.message}`);
  }
}

async function st(p) {
  return p.evaluate(() => {
    const q = document.querySelector('[data-testid="question-bar"]');
    const et = document.querySelector('[data-testid="end-turn-btn"]');
    return {
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
      ended: !!document.querySelector('[data-testid="duel-end-overlay"]'),
      lpOwn: document.querySelector('[data-testid="own-lp-plate"]')?.getAttribute("aria-label"),
      lpOpp: document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"),
    };
  });
}

const verbs = (p) =>
  p.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="verb-chip-cluster"] [role="menuitem"]')).map((b) =>
      b.textContent.trim(),
    ),
  );

let chainRespond = 0;
const deadAttacks = {};

async function handleQuestion(seat, s) {
  const p = seat.p;
  rec.note(`${seat.tag} Q: ${JSON.stringify(s.sentence)} btns=${JSON.stringify(s.buttons.map((b) => b.t + "=" + b.x))}`);
  if (/Chain a card or effect/.test(s.sentence ?? "")) {
    const cands = p.getByTestId("decision-candidate");
    if (chainRespond < 3 && (await cands.count()) > 0) {
      chainRespond++;
      await cands.first().click();
      await p.waitForTimeout(220);
      const cf = p.getByTestId("decision-confirm");
      rec.note(`${seat.tag} chain RESPOND confirm=${JSON.stringify(await cf.textContent())}`);
      await cf.click();
    } else {
      await p.getByTestId("pass-option").first().click();
    }
    await p.waitForTimeout(1100);
    return true;
  }
  const cands = p.getByTestId("decision-candidate");
  if ((await cands.count()) > 0) {
    await cands.first().click();
    await p.waitForTimeout(200);
  }
  const cf = p.getByTestId("decision-confirm");
  if ((await cf.count()) && !(await cf.first().isDisabled())) {
    rec.note(`${seat.tag} confirm=${JSON.stringify(await cf.first().textContent())}`);
    await cf.first().click();
    await p.waitForTimeout(1000);
    return true;
  }
  const other = s.buttons.find((b) => !b.d && b.t && b.t !== "decision-decline");
  if (other) {
    await p.getByTestId(other.t).first().click();
    await p.waitForTimeout(900);
    return true;
  }
  const dec = s.buttons.find((b) => !b.d);
  if (dec && dec.t) {
    await p.getByTestId(dec.t).first().click();
    await p.waitForTimeout(900);
    return true;
  }
  rec.note(`${seat.tag} DEAD END — question with no answerable control`);
  return false;
}

async function takeTurn(seat) {
  const p = seat.p;
  const hand = () => p.getByTestId("own-hand-row").getByRole("button");
  const n = await hand().count();
  for (let i = 0; i < n; i++) {
    const ok = await hand().nth(i).click({ timeout: 2200 }).then(() => true).catch(() => false);
    if (!ok) continue;
    await p.waitForTimeout(140);
    const v = await verbs(p);
    if (v.length) rec.note(`${seat.tag} hand[${i}] chips=${JSON.stringify(v)}`);
    const trib = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /tribute/i });
    if (await trib.count()) {
      rec.note(`${seat.tag} TRIBUTE SUMMON hand[${i}]`);
      await trib.first().click();
      await p.waitForTimeout(1200);
      return "tribute";
    }
    const ns = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Normal Summon$/ });
    if (await ns.count()) {
      await ns.first().click();
      rec.note(`${seat.tag} NORMAL SUMMON hand[${i}]`);
      await p.waitForTimeout(1000);
      return "summon";
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(50);
  }
  const bp = p.getByRole("button", { name: /Battle Phase.*advance/i });
  if (await bp.count()) {
    rec.note(`${seat.tag} → Battle Phase`);
    await bp.first().click();
    await p.waitForTimeout(1000);
    return "to-bp";
  }
  const mz = p.locator('[data-testid="my-mzone"] button');
  const mzn = await mz.count();
  for (let i = 0; i < mzn; i++) {
    const ok = await mz.nth(i).click({ timeout: 1800 }).then(() => true).catch(() => false);
    if (!ok) continue;
    await p.waitForTimeout(180);
    const atk = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Attack/ });
    if (await atk.count()) {
      const label = (await atk.first().textContent()) ?? "";
      const key = `${seat.tag}:${i}:${label}`;
      if ((deadAttacks[key] ?? 0) >= 2) {
        await p.keyboard.press("Escape");
        continue;
      }
      deadAttacks[key] = (deadAttacks[key] ?? 0) + 1;
      const before = await p.evaluate(() => document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"));
      rec.note(`${seat.tag} ATTACK monster[${i}] "${label}" oppLpBefore=${before}`);
      await atk.first().click();
      await p.waitForTimeout(1500);
      const after = await p.evaluate(() => document.querySelector('[data-testid="opp-lp-plate"]')?.getAttribute("aria-label"));
      rec.note(`${seat.tag} attack result oppLp ${before} -> ${after}`);
      return "attack";
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(50);
  }
  for (let i = 0; i < (await hand().count()); i++) {
    const ok = await hand().nth(i).click({ timeout: 1800 }).then(() => true).catch(() => false);
    if (!ok) continue;
    await p.waitForTimeout(140);
    const set = p.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Set$/ });
    if (await set.count()) {
      await set.first().click();
      rec.note(`${seat.tag} SET hand[${i}]`);
      await p.waitForTimeout(1000);
      return "set";
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(50);
  }
  const et = p.getByTestId("end-turn-btn");
  if (await et.isEnabled().catch(() => false)) {
    rec.note(`${seat.tag} END TURN`);
    await et.click();
    await p.waitForTimeout(1200);
    return "end-turn";
  }
  return "nothing";
}

try {
  await setEveryWindow(A, "seat0");
  await setEveryWindow(B, "seat1");
  rec.note("### duel begins");

  for (let step = 0; step < MAX_STEPS; step++) {
    let acted = false;
    for (const seat of seats) {
      const s = await st(seat.p);
      if (s.ended) {
        rec.note(`${seat.tag} DUEL ENDED lpOwn=${s.lpOwn} lpOpp=${s.lpOpp}`);
        throw new Error("__ended__");
      }
      if (s.hasQuestion) {
        acted = (await handleQuestion(seat, s)) || acted;
        continue;
      }
      if (s.endTurnEnabled) {
        const what = await takeTurn(seat);
        rec.note(`step ${step} ${seat.tag} -> ${what}`);
        acted = acted || what !== "nothing";
      }
    }
    if (!acted) await A.waitForTimeout(500);
  }
} catch (e) {
  if (e.message !== "__ended__") rec.note(`ABORT ${e.message}`);
} finally {
  rec.save();
  await browser.close();
}
