// Shared driver harness for ZUH-118 manual play-through.
// Uses the real same-origin e2e harness server on :8123 (real WASM engine).
import { chromium } from "/workspace/yugioh-app/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

export const BASE = "http://localhost:8123";
export const PASSWORD = "e2e-pass-12345";
export const DECK = "ZUH118 Interactive Deck";
export const EV = "/workspace/product/redo/evidence-118";

export function outdir(name) {
  const d = path.join(EV, "shots", name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function mkLogger(name) {
  const f = path.join(EV, "logs", `${name}.log`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const s = fs.createWriteStream(f, { flags: "w" });
  return (...args) => {
    const line = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    s.write(line + "\n");
    console.log(line);
  };
}

/** Attach console + pageerror + websocket frame capture to a page. */
export function instrument(page, tag, log) {
  page.on("console", (m) => log(`[${tag}][console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => log(`[${tag}][pageerror] ${e.message}`));
  page.on("websocket", (ws) => {
    log(`[${tag}][ws] open ${ws.url()}`);
    ws.on("framesent", (d) => log(`[${tag}][ws→] ${String(d.payload).slice(0, 900)}`));
    ws.on("framereceived", (d) => log(`[${tag}][ws←] ${String(d.payload).slice(0, 900)}`));
    ws.on("close", () => log(`[${tag}][ws] close`));
  });
}

export async function login(page, displayName) {
  await page.goto(BASE + "/login");
  await page.getByTestId("display-name-input").fill(displayName);
  await page.getByTestId("password-input").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL((u) => u.pathname === "/");
}

export async function createRoomAsAlice(alice) {
  await alice.goto(BASE + "/duel/new");
  await alice.getByRole("radio", { name: "5 min", exact: true }).click();
  await alice.getByRole("button", { name: /create challenge link/i }).click();
  await alice.waitForURL((u) => u.pathname.includes("/room"));
  const linkText = (await alice.getByTestId("join-link").textContent())?.trim() ?? "";
  return new URL(linkText).pathname;
}

export async function enterRoomAndReachBoard(alice, bob) {
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
  const goesFirst = winner;
  const goesSecond = winner === alice ? bob : alice;
  return { goesFirst, goesSecond };
}

export async function setup(name, { headless = true, viewport = { width: 1440, height: 900 } } = {}) {
  const log = mkLogger(name);
  const dir = outdir(name);
  const browser = await chromium.launch({ headless });
  const ctxA = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport,
  });
  const ctxB = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport,
  });
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  instrument(alice, "alice", log);
  instrument(bob, "bob", log);
  await login(alice, "e2e_alice");
  await login(bob, "e2e_bob");
  const joinPath = await createRoomAsAlice(alice);
  await bob.goto(BASE + joinPath);
  await bob.waitForURL((u) => u.pathname.includes("/room"));
  const seats = await enterRoomAndReachBoard(alice, bob);
  const shot = async (page, label) => {
    const p = path.join(dir, `${String(shotN++).padStart(2, "0")}-${label}.png`);
    await page.screenshot({ path: p, fullPage: false });
    log(`[shot] ${p}`);
    return p;
  };
  let shotN = 1;
  return { browser, alice, bob, ...seats, log, dir, shot };
}

/** Dump a compact view of what the player can currently see/do. */
export async function snapshot(page, label, log) {
  const data = await page.evaluate(() => {
    const t = (id) => document.querySelector(`[data-testid="${id}"]`);
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 400) : null);
    const endTurn = t("end-turn-btn");
    return {
      actionPanel: txt(t("action-panel")),
      questionBar: txt(t("question-bar")),
      noDecision: !!t("no-decision"),
      verbCluster: txt(t("verb-chip-cluster")),
      refusal: txt(t("refusal-chip")),
      phaseRibbon: txt(t("phase-ribbon")),
      clock: txt(t("clock-panel")),
      endTurnEnabled: endTurn ? !endTurn.disabled : null,
      waitBanner: Array.from(document.querySelectorAll('[role="status"]')).map((e) =>
        e.textContent.replace(/\s+/g, " ").trim(),
      ),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((e) =>
        e.textContent.replace(/\s+/g, " ").trim(),
      ),
      duelEnd: txt(t("duel-end-overlay")),
      ownLp: t("own-lp-plate")?.getAttribute("aria-label") ?? null,
      oppLp: t("opp-lp-plate")?.getAttribute("aria-label") ?? null,
      dimScrim: !!document.querySelector('[data-testid="dim-scrim"]'),
    };
  });
  log(`[snap:${label}] ` + JSON.stringify(data));
  return data;
}

/** Wait until the duel board has actually rendered a hand for this seat. */
export async function waitForBoard(page, timeout = 20000) {
  await page.getByTestId("duel-board").waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="own-hand-row"] button').length > 0,
    null,
    { timeout },
  );
}

/** Measure layout: is anything the player needs off-screen or clipped? */
export async function layout(page, label, log) {
  const m = await page.evaluate(() => {
    const r = (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        x: Math.round(b.x), y: Math.round(b.y),
        w: Math.round(b.width), h: Math.round(b.height),
        right: Math.round(b.right), bottom: Math.round(b.bottom),
        offRight: b.right > window.innerWidth,
        offBottom: b.bottom > window.innerHeight,
      };
    };
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      docScrollW: document.documentElement.scrollWidth,
      docScrollH: document.documentElement.scrollHeight,
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
      "end-turn-btn": r("end-turn-btn"),
      "action-panel": r("action-panel"),
      "own-hand-row": r("own-hand-row"),
      "opp-lp-plate": r("opp-lp-plate"),
      "duel-board": r("duel-board"),
      "phase-ribbon": r("phase-ribbon"),
      "clock-panel": r("clock-panel"),
    };
  });
  log(`[layout:${label}] ` + JSON.stringify(m));
  return m;
}

/** Record every DOM change of the action panel + question bar, with timestamps. */
export async function startPanelRecorder(page) {
  await page.evaluate(() => {
    window.__rec = [];
    const t0 = performance.now();
    const push = (why) => {
      const p = document.querySelector('[data-testid="action-panel"]');
      window.__rec.push({
        t: Math.round(performance.now() - t0),
        why,
        panel: p ? p.textContent.replace(/\s+/g, " ").trim().slice(0, 200) : null,
        qb: !!document.querySelector('[data-testid="question-bar"]'),
        receipt: !!document.querySelector('[data-testid="auto-answer-receipt"]'),
        receiptText: document.querySelector('[data-testid="auto-answer-receipt"]')?.textContent ?? null,
      });
    };
    push("init");
    const mo = new MutationObserver(() => push("mutation"));
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__recStop = () => mo.disconnect();
  });
}

export async function dumpRecorder(page, label, log) {
  const rec = await page.evaluate(() => {
    window.__recStop?.();
    return window.__rec ?? [];
  });
  log(`[recorder:${label}] ${rec.length} entries`);
  for (const e of rec) log(`  t=${e.t}ms ${e.why} qb=${e.qb} receipt=${e.receipt} panel=${JSON.stringify(e.panel)}`);
  return rec;
}

/** Card passcodes currently in this seat's own hand, read from the rendered art URLs. */
export async function handCodes(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="own-hand-row"] button')).map((b) => {
      const src = b.querySelector("img")?.getAttribute("src") ?? "";
      const m = src.match(/(\d+)\.jpg$/);
      return m ? Number(m[1]) : 0;
    }),
  );
}
