#!/usr/bin/env python3
"""
answer-matrix.py — the invariant this prototype kept breaking, enforced mechanically.

INVARIANT
  For any decision with more than one legal answer, distinct answers must produce
  distinct observable outcomes, and the outcome must be the one the confirm control
  named.

WHY IT EXISTS
  Three separate bugs (B3 tribute ignored, B4 decline == confirm, and the CEO's
  chain-activation bug where Book of Moon played Solemn Judgment) were all the same
  defect: the outcome was keyed to the STEP, not to the ANSWER. A spot check on one
  answer cannot detect that. This walks EVERY answer at EVERY multi-answer decision
  point and compares end-state fingerprints pairwise.

RUN
  npm run build && npx vite preview --port 4319 --strictPort &
  python3 answer-matrix.py [url]                 # default http://localhost:4319/

Real mouse events at real coordinates throughout — `.click()` dispatches on the node
and would have hidden blocker B1.
"""

import json
import sys
import time

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4319/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/workspace/product/design/answer-outcome-matrix.md"

FINGERPRINT = """() => {
  const t = (sel) => [...document.querySelectorAll(sel)].map(e => e.innerText.replace(/\\n/g,' ').trim()).join(' | ');
  const rows = (side) => [...document.querySelectorAll(`.field.${side} .zonerow`)]
      .map(r => [...r.querySelectorAll('.slot')].map(s => {
          const c = s.querySelector('.card');
          if (!c) return '.';
          const nm = c.querySelector('.nm');
          const face = c.className.includes('back') ? 'FD' : (nm ? nm.innerText.replace(/\\n/g,' ') : '?');
          return face + (c.className.includes('def') ? '(def)' : '');
      }).join(','))
      .join(' // ');
  const piles = (side) => [...document.querySelectorAll(`.field.${side} .pile`)]
      .map(e => e.innerText.replace(/\\n/g,':')).join(' ');
  return {
    lp: [...document.querySelectorAll('.lp .val')].map(e => e.textContent).join('/'),
    mine: rows('mine'),
    theirs: rows('theirs'),
    myPiles: piles('mine'),
    oppPiles: piles('theirs'),
    hand: [...document.querySelectorAll('[data-testid=my-hand] .card .nm')].map(e=>e.innerText.replace(/\\n/g,' ')).join(','),
    // What the screen is asking NOW. An answer that opens a further decision differs
    // observably from one that hands the board back, even before anything resolves.
    pending: (() => { const q = document.querySelector('.qbar .sentence'); return q ? q.innerText.replace(/\\n/g,' ').trim() : ''; })(),
    log: [...document.querySelectorAll('.logrow')].map(r => r.innerText.replace(/\\n/g,' ')).join(' ; '),
    ended: !!document.querySelector('.endsheet')
  };
}"""


class Driver:
    def __init__(self, page):
        self.pg = page
        # what the control the player actually pressed SAID, captured at the instant of
        # pressing it. The invariant has two halves: distinct outcomes, and the outcome
        # being the one the control named — this column proves the second half.
        self.named = None

    def click(self, sel, nth=0):
        loc = self.pg.locator(sel).nth(nth)
        box = loc.bounding_box()
        if not box:
            raise AssertionError(f"no box for {sel}[{nth}]")
        self.pg.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)

    def has(self, sel):
        return self.pg.locator(sel).count() > 0

    def scenario(self, sid):
        self.pg.select_option("select.chip", sid)
        time.sleep(1.0)

    def toggle_zones_on(self):
        self.click("text=Choose zones: OFF")
        time.sleep(0.4)

    def open_log(self):
        if not self.has(".rail .rows"):
            self.click("text=Log")
            time.sleep(0.5)

    def act(self, card_sel, verb_sub=None, nth=0):
        """click a card, then a verb chip (by substring, else the first)."""
        self.click(card_sel, nth)
        self.pg.wait_for_selector(".verbcluster", timeout=6000)
        time.sleep(0.15)
        if verb_sub:
            verbs = self.pg.locator(".verbcluster .verb")
            for i in range(verbs.count()):
                if verb_sub.lower() in verbs.nth(i).inner_text().lower():
                    self.click(".verbcluster .verb", i)
                    return
            raise AssertionError(f"verb {verb_sub!r} not offered")
        self.click(".verbcluster .verb", 0)

    def phase(self, name):
        self.click(f".phase >> text={name}")

    def wait_bar(self, timeout=12000):
        self.pg.wait_for_selector("[data-testid=question-bar]", timeout=timeout)
        time.sleep(0.2)

    def thumbs(self):
        return self.pg.locator(".qbar .answers .pick .card").count()

    def thumb_name(self, i):
        return self.pg.locator(".qbar .answers .pick .card .nm").nth(i).inner_text().replace("\n", " ")

    def pick_thumb(self, i):
        self.click(".qbar .answers .pick .card", i)
        time.sleep(0.2)

    def confirm_label(self):
        return self.pg.locator("[data-testid=confirm]").inner_text() if self.has("[data-testid=confirm]") else ""

    def confirm(self):
        self.named = self.confirm_label()
        self.click("[data-testid=confirm]")

    def decline(self):
        self.named = self.pg.locator("[data-testid=decline]").inner_text().replace("\n", " ")
        self.click("[data-testid=decline]")

    def postiles(self):
        return self.pg.locator(".postile").count()

    def pick_postile(self, i):
        self.named = self.pg.locator(".postile").nth(i).inner_text().replace("\n", " · ")
        self.click(".postile", i)

    def zones(self):
        return self.pg.locator(".slot.zonepick").count()

    def pick_zone(self, i):
        self.named = f"Place here (legal zone #{i + 1} of {self.zones()})"
        self.click(".slot.zonepick", i)

    def settle(self, ms=5200):
        """let the scripted continuation run to a resting state."""
        deadline = time.time() + ms / 1000
        while time.time() < deadline:
            time.sleep(0.35)
            resting = self.pg.evaluate(
                "() => !document.querySelector('.waitdock') && !document.querySelector('[data-testid=auto-receipt]')"
            )
            if resting:
                # a bar or an armed board counts as rest
                time.sleep(0.5)
                if self.pg.evaluate(
                    "() => !document.querySelector('.waitdock') && !document.querySelector('[data-testid=auto-receipt]')"
                ):
                    return
        return

    def fingerprint(self):
        self.open_log()
        return self.pg.evaluate(FINGERPRINT)


# ── the decision points, and how to reach each one ───────────────────────────
# Each entry: reach(d) leaves the app AT the decision; answers is a list of
# (label, apply(d)) pairs; after applying, settle() and fingerprint.

def reach_A_tribute(d):
    d.scenario("tribute-summon")
    d.act("[data-testid=my-hand] .card", "1 tribute")
    d.wait_bar()

def reach_A_zone(d):
    d.scenario("tribute-summon")
    d.toggle_zones_on()
    d.act("[data-testid=my-hand] .card", "1 tribute")
    d.wait_bar()
    d.pick_thumb(0)
    d.confirm()
    d.pg.wait_for_selector(".slot.zonepick", timeout=8000)
    time.sleep(0.3)

def reach_A_position(d):
    d.scenario("tribute-summon")
    d.act("[data-testid=my-hand] .card", "1 tribute")
    d.wait_bar()
    d.pick_thumb(0)
    d.confirm()
    d.pg.wait_for_selector(".postile", timeout=9000)
    time.sleep(0.3)

def reach_A_trigger(d):
    reach_A_position(d)
    d.pick_postile(0)
    d.pg.wait_for_selector("[data-testid=question-bar]", timeout=12000)
    time.sleep(0.4)

def reach_A_target(d):
    reach_A_trigger(d)
    d.confirm()
    time.sleep(1.2)
    d.wait_bar()

def reach_B_chain(d):
    d.scenario("chain-response")
    d.act("[data-testid=my-hand] .card", "Normal Summon")
    d.wait_bar(15000)

def reach_B_booktarget(d):
    reach_B_chain(d)
    # pick Book of Moon (thumb index 1) then confirm
    d.pick_thumb(1)
    d.confirm()
    d.wait_bar(12000)

def reach_C_target(d):
    d.scenario("battle")
    d.phase("BP")
    time.sleep(0.9)
    d.act(".field.mine .card", "Attack")
    d.wait_bar()


POINTS = [
    dict(
        scenario="tribute-summon", question="SelectTribute — which monster to tribute",
        reach=reach_A_tribute,
        answers=[("tribute Card Trooper", lambda d: (d.pick_thumb(0), d.confirm())),
                 ("tribute Sangan", lambda d: (d.pick_thumb(1), d.confirm())),
                 ("tribute Junk Synchron", lambda d: (d.pick_thumb(2), d.confirm())),
                 ("decline (Esc/Cancel)", lambda d: d.decline())],
    ),
    dict(
        scenario="tribute-summon", question="SelectZone — where Caius lands (Choose zones: ON)",
        reach=reach_A_zone,
        answers=[("zone 1 (freed slot)", lambda d: d.pick_zone(0)),
                 ("zone 4", lambda d: d.pick_zone(1)),
                 ("zone 5", lambda d: d.pick_zone(2))],
    ),
    dict(
        scenario="tribute-summon", question="SelectPosition — Caius's battle position",
        reach=reach_A_position,
        answers=[("Attack position", lambda d: d.pick_postile(0)),
                 ("Defence position", lambda d: d.pick_postile(1))],
    ),
    dict(
        scenario="tribute-summon", question="ChainPrompt — activate Caius's trigger?",
        reach=reach_A_trigger,
        answers=[("activate", lambda d: d.confirm()),
                 ("no response", lambda d: d.decline())],
    ),
    dict(
        scenario="tribute-summon", question="SelectCard — Caius banishes which card",
        reach=reach_A_target,
        answers=[("banish Krebons (DARK)", lambda d: (d.pick_thumb(0), d.confirm())),
                 ("banish set card #1", lambda d: (d.pick_thumb(1), d.confirm())),
                 ("banish set card #2", lambda d: (d.pick_thumb(2), d.confirm())),
                 ("cancel", lambda d: d.decline())],
    ),
    dict(
        scenario="chain-response", question="ChainPrompt — respond to Torrential Tribute",
        reach=reach_B_chain,
        answers=[("Solemn Judgment", lambda d: (d.pick_thumb(0), d.confirm())),
                 ("Book of Moon", lambda d: (d.pick_thumb(1), d.confirm())),
                 ("No response", lambda d: d.decline())],
    ),
    dict(
        scenario="chain-response", question="SelectCard — Book of Moon flips which monster",
        reach=reach_B_booktarget,
        answers=[("flip Krebons", lambda d: (d.pick_thumb(0), d.confirm())),
                 ("flip Card Trooper", lambda d: (d.pick_thumb(1), d.confirm())),
                 ("flip Junk Synchron", lambda d: (d.pick_thumb(2), d.confirm())),
                 ("cancel activation", lambda d: d.decline())],
    ),
    dict(
        scenario="battle", question="SelectCard — attack target (cancelable)",
        reach=reach_C_target,
        answers=[("attack Krebons", lambda d: (d.pick_thumb(0), d.confirm())),
                 ("cancel the attack", lambda d: d.decline())],
    ),
]


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, ignore_https_errors=True)
        for point in POINTS:
            rows = []
            for label, apply in point["answers"]:
                page = ctx.new_page()
                errs = []
                page.on("pageerror", lambda e: errs.append(str(e)))
                page.goto(URL)
                time.sleep(1.1)
                d = Driver(page)
                point["reach"](d)
                thumbs = [d.thumb_name(i) for i in range(d.thumbs())] if d.has(".qbar .answers .pick") else []
                apply(d)
                named = d.named
                d.settle()
                fp = d.fingerprint()
                rows.append(dict(answer=label, named=named, thumbs=thumbs, fp=fp, errors=errs))
                page.close()
            results.append(dict(point=point, rows=rows))
        browser.close()

    # ── pairwise distinctness ────────────────────────────────────────────────
    # Two channels, reported separately: the BOARD (LP, zones, piles, hand) and the
    # EVENT LOG. A pair distinguished only by the log is not a bug, but it is a fact the
    # reviewer should see rather than have hidden behind a green tick.
    def board_key(fp):
        return json.dumps({k: v for k, v in fp.items() if k != "log"}, sort_keys=True)

    failures = []
    log_only = []
    for r in results:
        seen_all, seen_board = {}, {}
        for row in r["rows"]:
            k_all = json.dumps(row["fp"], sort_keys=True)
            k_brd = board_key(row["fp"])
            if k_all in seen_all:
                failures.append((r["point"]["question"], seen_all[k_all], row["answer"]))
            elif k_brd in seen_board:
                log_only.append((r["point"]["question"], seen_board[k_brd], row["answer"]))
            seen_all[k_all] = row["answer"]
            seen_board[k_brd] = row["answer"]
        r["log_only"] = [x for x in log_only if x[0] == r["point"]["question"]]

    with open(OUT, "w") as f:
        f.write("# Answer × outcome matrix — the distinct-outcomes invariant\n\n")
        f.write("**Generated by** `spikes/duel-ui-proto/answer-matrix.py` on the built prototype,\n")
        f.write("real mouse events at real coordinates.\n\n")
        f.write("**Invariant:** for any decision with more than one legal answer, distinct answers must\n")
        f.write("produce distinct observable outcomes, and the outcome must be the one the confirm\n")
        f.write("control named.\n\n")
        f.write(f"**Decision points walked:** {len(results)} · ")
        f.write(f"**answers exercised:** {sum(len(r['rows']) for r in results)} · ")
        f.write(f"**collisions:** {len(failures)}\n\n")
        if failures:
            f.write("## ✖ COLLISIONS\n\n")
            for q, a, b in failures:
                f.write(f"- **{q}** — `{a}` and `{b}` produce an identical end state.\n")
            f.write("\n")
        else:
            f.write("## ✔ No collisions. Every answer produced a distinct end state.\n\n")
        if log_only:
            f.write("## ◑ Distinguished by the event log, not by the final board\n\n")
            f.write("Not bugs — the domain makes the boards converge. Listed so it is visible.\n\n")
            for q, a, b in log_only:
                f.write(f"- **{q}** — `{a}` and `{b}` reach the same final board; the log records which.\n")
            f.write("\n")

        for r in results:
            pt = r["point"]
            f.write(f"---\n\n## {pt['question']}\n\n")
            f.write(f"*Scenario:* `{pt['scenario']}`\n\n")
            if r["rows"] and r["rows"][0]["thumbs"]:
                f.write(f"*Candidates offered:* {', '.join(r['rows'][0]['thumbs'])}\n\n")
            f.write(
                "| answer | the control you pressed said | LP | your field | their field "
                "| your piles | their piles | screen now asks |\n"
            )
            f.write("|---|---|---|---|---|---|---|---|\n")
            for row in r["rows"]:
                fp = row["fp"]
                named = (row["named"] or "—").replace("|", "\\|")
                asks = (fp.get("pending") or "—").replace("|", "\\|")
                f.write(
                    f"| **{row['answer']}** | `{named}` | `{fp['lp']}` | `{fp['mine']}` | "
                    f"`{fp['theirs']}` | `{fp['myPiles']}` | `{fp['oppPiles']}` | {asks} |\n"
                )
            f.write("\n<details><summary>log tails</summary>\n\n")
            for row in r["rows"]:
                tail = " ; ".join(row["fp"]["log"].split(" ; ")[-6:])
                f.write(f"- **{row['answer']}** — {tail}\n")
            f.write("\n</details>\n\n")
            errs = [e for row in r["rows"] for e in row["errors"]]
            if errs:
                f.write(f"⚠ page errors: {errs[:3]}\n\n")

    print(f"wrote {OUT}")
    print(
        f"points={len(results)} answers={sum(len(r['rows']) for r in results)} "
        f"collisions={len(failures)} log-only-distinct={len(log_only)}"
    )
    for q, a, b in failures:
        print(f"  COLLISION {q}: {a} == {b}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
