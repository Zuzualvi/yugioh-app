// S5 — the hand becomes unclickable. Precise geometry, no Playwright auto-scroll.
import { setup, snapshot, waitForBoard, layout } from "./lib.mjs";

const { browser, goesFirst: A, goesSecond: B, log, shot } = await setup("s5-hand-blocked");

async function handProbe(p, label) {
  const data = await p.evaluate(() => {
    const row = document.querySelector('[data-testid="own-hand-row"]');
    const panel = document.querySelector('[data-testid="action-panel"]');
    const scroller = row?.closest("div[style*='overflow']");
    const btns = Array.from(row?.querySelectorAll("button") ?? []);
    const rect = (e) => {
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) };
    };
    return {
      viewport: { w: innerWidth, h: innerHeight },
      handRow: rect(row),
      panel: rect(panel),
      panelStyle: panel ? getComputedStyle(panel).position + " z=" + getComputedStyle(panel).zIndex + " pe=" + getComputedStyle(panel).pointerEvents : null,
      scroller: (() => {
        // find the nearest scrollable ancestor of the hand row
        let e = row;
        while (e && e !== document.body) {
          const cs = getComputedStyle(e);
          if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight) {
            return { scrollTop: e.scrollTop, scrollHeight: e.scrollHeight, clientHeight: e.clientHeight, maxScroll: e.scrollHeight - e.clientHeight };
          }
          e = e.parentElement;
        }
        return null;
      })(),
      cards: btns.map((b, i) => {
        const r = b.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        const inViewport = r.top >= 0 && r.bottom <= innerHeight;
        return {
          i,
          cy,
          inViewport,
          hit: hit ? hit.tagName + "[" + (hit.getAttribute("data-testid") ?? hit.getAttribute("aria-label") ?? "-") + "]" : null,
          hittable: !!hit && (hit === b || b.contains(hit)),
        };
      }),
    };
  });
  log(`[F12:${label}] ` + JSON.stringify(data));
  return data;
}

await waitForBoard(A);
await A.waitForFunction(
  () => { const b = document.querySelector('[data-testid="end-turn-btn"]'); return b && !b.disabled; },
  null, { timeout: 20000 },
);

log("### BEFORE any action");
await handProbe(A, "before-summon");
await shot(A, "before-summon");

log("### Normal Summon (no scrolling, force:false)");
const n = await A.getByTestId("own-hand-row").getByRole("button").count();
let done = false;
for (let i = 0; i < n && !done; i++) {
  await A.getByTestId("own-hand-row").getByRole("button").nth(i).click({ timeout: 5000 }).catch((e) => log("click failed: " + e.message.split("\n")[0]));
  await A.waitForTimeout(200);
  const chip = A.getByTestId("verb-chip-cluster").getByRole("menuitem", { name: /^Normal Summon$/ });
  if ((await chip.count()) > 0) {
    await chip.first().click();
    done = true;
    log(`summoned from hand[${i}]`);
  } else {
    await A.keyboard.press("Escape");
  }
}
await A.waitForTimeout(1500);

log("### AFTER the summon — is the hand still reachable?");
const after = await handProbe(A, "after-summon");
await shot(A, "after-summon-full");
await A.screenshot({ path: `${process.env.EVDIR ?? "/workspace/product/redo/evidence-118/shots/s5-hand-blocked"}/zz-after-summon-fullpage.png`, fullPage: true });

log("### try to click hand card 0 the way a player would (no auto-scroll)");
const res = await A.evaluate(() => {
  const b = document.querySelector('[data-testid="own-hand-row"] button');
  if (!b) return "no hand";
  const r = b.getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return hit ? hit.tagName + "[" + (hit.getAttribute("data-testid") ?? "-") + "]" : "null";
});
log("elementFromPoint over hand card 0 = " + res);

// Playwright click WITH its normal auto-scroll — this is what failed in S4.
const t0 = Date.now();
const err = await A.getByTestId("own-hand-row")
  .getByRole("button")
  .first()
  .click({ timeout: 8000 })
  .then(() => null)
  .catch((e) => e.message.split("\n").slice(0, 6).join(" | "));
log(`playwright click after ${Date.now() - t0}ms → ${err ?? "OK"}`);
await handProbe(A, "after-scroll-attempt");
await shot(A, "after-scroll-attempt");
await layout(A, "after-summon", log);
await snapshot(A, "after-summon", log);

await browser.close();
