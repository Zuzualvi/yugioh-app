// Recorder harness for ZUH-121 fixture capture.
// Captures EVERY WebSocket frame in FULL (no truncation) from both seats of a
// real duel driven through the shipped client against the real WASM engine.
import { chromium } from "/tmp/1786580109-24621-ygo/repo/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

export const BASE = "http://localhost:8231";
export const PASSWORD = "e2e-pass-12345";
export const DECK = "ZUH121 Deck";
export const OUT = "/tmp/1786580109-24621-ygo/rec/out";

export function mkRecorder(name) {
  fs.mkdirSync(OUT, { recursive: true });
  const frames = [];
  const notes = [];
  const t0 = Date.now();
  return {
    frames,
    notes,
    note: (...a) => {
      const line = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
      notes.push({ t: Date.now() - t0, line });
      console.log(`[${name}] ${line}`);
    },
    attach(page, seatTag) {
      page.on("pageerror", (e) => notes.push({ t: Date.now() - t0, line: `PAGEERROR ${seatTag} ${e.message}` }));
      page.on("websocket", (ws) => {
        ws.on("framesent", (d) => push(seatTag, "out", d.payload));
        ws.on("framereceived", (d) => push(seatTag, "in", d.payload));
      });
      function push(tag, dir, payload) {
        const s = String(payload);
        let obj = null;
        try {
          obj = JSON.parse(s);
        } catch {
          return;
        }
        frames.push({ t: Date.now() - t0, seat: tag, dir, frame: obj });
      }
    },
    save() {
      const f = path.join(OUT, `${name}.json`);
      fs.writeFileSync(f, JSON.stringify({ name, frames, notes }, null, 0));
      console.log(`[${name}] wrote ${frames.length} frames -> ${f}`);
      return f;
    },
  };
}

export async function login(page, displayName) {
  await page.goto(BASE + "/login");
  await page.getByTestId("display-name-input").fill(displayName);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((u) => u.pathname === "/");
}

export async function setup(name, { promptEveryWindow = [] } = {}) {
  const rec = mkRecorder(name);
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctxA = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  rec.attach(alice, "alice");
  rec.attach(bob, "bob");
  await login(alice, "e2e_alice");
  await login(bob, "e2e_bob");

  // Response-prompt level lives in localStorage; set "every" so the shipped
  // client does not suppress the decisions we are trying to record. This is a
  // RECORDING aid only — it changes which questions the shipped client asks,
  // never what the engine sends.
  for (const [p, who] of [[alice, "alice"], [bob, "bob"]]) {
    if (promptEveryWindow.includes(who)) {
      await p.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          if (/prompt/i.test(k)) localStorage.setItem(k, JSON.stringify("every"));
        }
        localStorage.setItem("duel.responsePromptLevel", JSON.stringify("every"));
        localStorage.setItem("duel:responsePromptLevel", "every");
      });
    }
  }

  await alice.goto(BASE + "/duel/new");
  await alice.getByRole("radio", { name: "5 min", exact: true }).click();
  await alice.getByRole("button", { name: /create challenge link/i }).click();
  await alice.waitForURL((u) => u.pathname.includes("/room"));
  const linkText = (await alice.getByTestId("join-link").textContent())?.trim() ?? "";
  const joinPath = new URL(linkText).pathname;
  await bob.goto(BASE + joinPath);
  await bob.waitForURL((u) => u.pathname.includes("/room"));

  await alice.getByTestId("deck-option").filter({ hasText: DECK }).click();
  await bob.getByTestId("deck-option").filter({ hasText: DECK }).click();
  await alice.getByTestId("room-ready-btn").click();
  await bob.getByTestId("room-ready-btn").click();

  let winner = null;
  const deadline = Date.now() + 20000;
  while (!winner && Date.now() < deadline) {
    for (const [i, p] of [alice, bob].entries()) {
      if (await p.getByTestId("seat-first-btn").isVisible().catch(() => false)) {
        winner = i === 0 ? alice : bob;
        break;
      }
    }
    if (!winner) await alice.waitForTimeout(200);
  }
  if (!winner) throw new Error("seat-choice never appeared");
  await winner.getByTestId("seat-first-btn").click();
  await alice.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/room"));
  await bob.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/room"));
  const first = winner;
  const second = winner === alice ? bob : alice;
  await waitForBoard(first);
  await waitForBoard(second);
  return { browser, alice, bob, first, second, rec };
}

export async function waitForBoard(page, timeout = 25000) {
  await page.getByTestId("duel-board").waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="own-hand-row"] button').length > 0,
    null,
    { timeout },
  );
}

/** Verb chips currently offered for hand card `i` (opens the cluster). */
export async function handChips(page, i) {
  const btns = page.locator('[data-testid="own-hand-row"] button');
  if ((await btns.count()) <= i) return [];
  await btns.nth(i).click();
  await page.waitForTimeout(220);
  return page.locator('[data-testid="verb-chip-cluster"] button').allInnerTexts();
}

export async function clickVerb(page, sub) {
  const chips = page.locator('[data-testid="verb-chip-cluster"] button');
  const n = await chips.count();
  for (let i = 0; i < n; i++) {
    const t = (await chips.nth(i).innerText()).toLowerCase();
    if (t.includes(sub.toLowerCase())) {
      await chips.nth(i).click();
      return true;
    }
  }
  return false;
}

export async function fieldChips(page, i) {
  const btns = page.locator('[data-testid="my-mzone"] button');
  if ((await btns.count()) <= i) return [];
  await btns.nth(i).click();
  await page.waitForTimeout(220);
  return page.locator('[data-testid="verb-chip-cluster"] button').allInnerTexts();
}

export async function answerFirstCandidateAndConfirm(page) {
  const cands = page.locator('[data-testid="question-bar"] button');
  const n = await cands.count();
  if (n === 0) return false;
  await cands.nth(0).click();
  await page.waitForTimeout(200);
  const confirm = page.getByRole("button", { name: /select|activate|confirm|place|tribute/i }).last();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
    return true;
  }
  return false;
}

export async function phase(page, name) {
  const b = page.getByRole("button", { name: new RegExp(`^${name}$`, "i") });
  if (await b.isVisible().catch(() => false)) {
    await b.click();
    return true;
  }
  return false;
}

export async function endTurn(page) {
  const b = page.getByTestId("end-turn-btn");
  if (await b.isEnabled().catch(() => false)) {
    await b.click();
    return true;
  }
  return false;
}
