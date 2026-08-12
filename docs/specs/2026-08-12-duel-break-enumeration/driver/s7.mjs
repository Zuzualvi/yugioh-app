// S7 — the per-handover clock and the timeout forfeit. 3-minute room; the player
// on clock simply does nothing. Runs ~4 minutes.
import { setup, snapshot, waitForBoard } from "./lib.mjs";
import fs from "node:fs";

// setup() hardcodes the 5 min preset; re-implement with 3 min here.
import { chromium } from "/workspace/yugioh-app/node_modules/playwright/index.mjs";
import { BASE, PASSWORD, DECK, mkLogger, instrument, login, outdir } from "./lib.mjs";

const log = mkLogger("s7-timeout-forfeit");
const dir = outdir("s7-timeout-forfeit");
let sn = 1;
const shot = async (p, l) => {
  const f = `${dir}/${String(sn++).padStart(2, "0")}-${l}.png`;
  await p.screenshot({ path: f });
  log("[shot] " + f);
};

const browser = await chromium.launch({ headless: true });
const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const alice = await ctxA.newPage();
const bob = await ctxB.newPage();
instrument(alice, "alice", log);
instrument(bob, "bob", log);
await login(alice, "e2e_alice");
await login(bob, "e2e_bob");

await alice.goto(BASE + "/duel/new");
await alice.getByRole("radio", { name: "3 min", exact: true }).click();
await alice.getByRole("button", { name: /create challenge link/i }).click();
await alice.waitForURL((u) => u.pathname.includes("/room"));
const linkText = (await alice.getByTestId("join-link").textContent()).trim();
const joinPath = new URL(linkText).pathname;
await bob.goto(BASE + joinPath);
await bob.waitForURL((u) => u.pathname.includes("/room"));
await alice.getByTestId("deck-option").filter({ hasText: DECK }).click();
await bob.getByTestId("deck-option").filter({ hasText: DECK }).click();
await alice.getByTestId("room-ready-btn").click();
await bob.getByTestId("room-ready-btn").click();
let winner = null;
const dl = Date.now() + 20000;
while (!winner && Date.now() < dl) {
  for (const [i, p] of [alice, bob].entries()) {
    if (await p.getByTestId("seat-first-btn").isVisible().catch(() => false)) winner = i === 0 ? alice : bob;
  }
  if (!winner) await alice.waitForTimeout(200);
}
await winner.getByTestId("seat-first-btn").click();
const A = winner;
const B = winner === alice ? bob : alice;
await A.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/room"));
await B.waitForURL((u) => u.pathname.startsWith("/duel/") && !u.pathname.includes("/room"));
await waitForBoard(A);
await waitForBoard(B);

const readClock = async (p, tag) => {
  const c = await p.evaluate(() => ({
    own: document.querySelector('[data-testid="clock-row-own"]')?.textContent.replace(/\s+/g, " ").trim(),
    opp: document.querySelector('[data-testid="clock-row-opp"]')?.textContent.replace(/\s+/g, " ").trim(),
    alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((e) => e.textContent.trim()),
  }));
  log(`[clock ${tag}] ` + JSON.stringify(c));
  return c;
};

log("### on-clock seat does nothing for 3 minutes");
for (const t of [0, 30, 60, 120, 150, 170, 178, 185]) {
  const wait = t === 0 ? 0 : t;
  await A.waitForTimeout(wait === 0 ? 500 : (t - (readClock.last ?? 0)) * 1000);
  readClock.last = t;
  await readClock(A, `on-clock t+${t}s`);
  await readClock(B, `off-clock t+${t}s`);
  if ([0, 150, 178].includes(t)) {
    await shot(A, `onclock-t${t}`);
    await shot(B, `offclock-t${t}`);
  }
  const ended = await A.getByTestId("duel-end-overlay").count();
  if (ended) break;
}

await A.waitForTimeout(20000);
log("### after the deadline");
const endA = await A.evaluate(() => {
  const o = document.querySelector('[data-testid="duel-end-overlay"]');
  return o ? o.textContent.replace(/\s+/g, " ").trim() : null;
});
const endB = await B.evaluate(() => {
  const o = document.querySelector('[data-testid="duel-end-overlay"]');
  return o ? o.textContent.replace(/\s+/g, " ").trim() : null;
});
log("[on-clock seat overlay] " + JSON.stringify(endA));
log("[off-clock seat overlay] " + JSON.stringify(endB));
await shot(A, "onclock-end");
await shot(B, "offclock-end");
await snapshot(A, "onclock-final", log);
await snapshot(B, "offclock-final", log);
fs.writeFileSync(`${dir}/summary.json`, JSON.stringify({ endA, endB }, null, 2));
await browser.close();
