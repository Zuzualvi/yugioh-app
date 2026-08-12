// S1 — the first ten seconds. Reach the board, observe both seats without acting.
import { setup, snapshot } from "./lib.mjs";

const { browser, goesFirst, goesSecond, log, shot } = await setup("s1-first-ten-seconds");

log("=== board reached ===");
await shot(goesFirst, "first-t0");
await shot(goesSecond, "second-t0");
await snapshot(goesFirst, "first-t0", log);
await snapshot(goesSecond, "second-t0", log);

await goesFirst.waitForTimeout(3000);
await shot(goesFirst, "first-t3s");
await shot(goesSecond, "second-t3s");
await snapshot(goesFirst, "first-t3s", log);
await snapshot(goesSecond, "second-t3s", log);

await goesFirst.waitForTimeout(7000);
await snapshot(goesFirst, "first-t10s", log);
await snapshot(goesSecond, "second-t10s", log);
await shot(goesFirst, "first-t10s");
await shot(goesSecond, "second-t10s");

// What is in my hand, per the accessible names the player gets?
for (const [tag, p] of [
  ["first", goesFirst],
  ["second", goesSecond],
]) {
  const hand = await p.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="own-hand-row"] button')).map((b) => ({
      aria: b.getAttribute("aria-label"),
      text: b.textContent.trim(),
      img: b.querySelector("img")?.getAttribute("src") ?? null,
      imgShown: b.querySelector("img")?.style.display ?? "",
    })),
  );
  log(`[${tag}] hand: ` + JSON.stringify(hand));
}

await browser.close();
