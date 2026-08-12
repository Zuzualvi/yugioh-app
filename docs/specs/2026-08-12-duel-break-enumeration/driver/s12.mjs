// S12 — the neutral event log, the settings popover, the card inspector, and
// the first seconds of the duel screen.
import { setup, snapshot, waitForBoard } from "./lib.mjs";

const { browser, goesFirst: A, goesSecond: B, log, shot } = await setup("s12-log-settings");

await waitForBoard(A);
await waitForBoard(B);

log("### settings popover — which toggles exist");
await A.getByTestId("settings-btn").click();
await A.waitForTimeout(300);
await shot(A, "settings-popover");
const settings = await A.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid="settings-popover"] input, [data-testid="settings-popover"] button')).map((e) => ({
    tag: e.tagName,
    type: e.type ?? null,
    label: e.closest("label")?.textContent.replace(/\s+/g, " ").trim() ?? e.textContent.replace(/\s+/g, " ").trim(),
    checked: e.checked ?? null,
  })),
);
log("[settings] " + JSON.stringify(settings));
await A.getByTestId("settings-btn").click();

log("### play one turn so the log has content");
const n = await A.getByTestId("own-hand-row").getByRole("button").count();
for (let i = 0; i < n; i++) {
  await A.getByTestId("own-hand-row").getByRole("button").nth(i).click({ timeout: 3000 }).catch(() => {});
  await A.waitForTimeout(150);
  const chip = A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Normal Summon$/ });
  if (await chip.count()) { await chip.first().click(); break; }
  await A.keyboard.press("Escape");
}
await A.waitForTimeout(1500);
if (await A.getByTestId("question-bar").count()) {
  const pass = A.getByTestId("pass-option");
  if (await pass.count()) await pass.first().click();
  await A.waitForTimeout(800);
}

log("### event log, both seats");
for (const [tag, p] of [["seat0", A], ["seat1", B]]) {
  await p.getByTestId("log-toggle").click();
  await p.waitForTimeout(800);
  await shot(p, `${tag}-event-log`);
  const t = await p.evaluate(() => {
    const r = document.querySelector('[aria-label="Event log"]');
    return r ? r.textContent.replace(/\s+/g, " ").trim().slice(0, 1200) : "NO RAIL";
  });
  log(`[${tag} event log] ${JSON.stringify(t)}`);
}

log("### inspect a card in my own hand");
await A.getByTestId("log-toggle").click().catch(() => {});
await A.waitForTimeout(300);
await A.getByTestId("own-hand-row").getByRole("button").first().click({ timeout: 3000 }).catch(() => {});
await A.waitForTimeout(200);
const insp = A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /Inspect/ });
if (await insp.count()) {
  await insp.first().click();
  await A.waitForTimeout(1200);
  await shot(A, "card-inspector");
  const ins = await A.evaluate(() => {
    const el = document.querySelector('[data-testid="card-inspector"]') ?? document.querySelector('[aria-label*="inspect" i]');
    return el ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 500) : "NO INSPECTOR";
  });
  log("[inspector] " + JSON.stringify(ins));
}
await snapshot(A, "end", log);
await browser.close();
