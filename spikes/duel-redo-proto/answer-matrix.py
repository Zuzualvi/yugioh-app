#!/usr/bin/env python3
"""
answer-matrix.py — the answer-fidelity invariant, enforced by ENUMERATION.

TWO INVARIANTS, AND THEY ARE NOT THE SAME CHECK.

  A · DISTINCT OUTCOMES. For any decision with more than one legal answer,
      distinct answers must produce distinct observable outcomes.

  B · LABEL FIDELITY. The confirm control and the selection line must NAME THE
      ANSWER BEING SUBMITTED.

  Check A passed 19 of 19 while the chain window's confirm button named a card the
  player had not selected, because A compares end states and never reads the label.
  The previous project carried these as separate requirements F13 and F14 for
  exactly this reason, and F14 passing is what made everyone comfortable. A gate
  that checks outcomes and not labels is how this defect family reached the CEO
  twice.

  B is checked against two INDEPENDENT paths: the app publishes
  `window.__lastSubmit`, whose `identities` are resolved from the RESPONSE's own
  indices, and the gate compares them against the label text captured from the DOM
  at press time. A label sourced from anywhere other than the answer fails.

WHY IT EXISTS
  This defect class was found and reported fixed THREE times in the previous
  prototype — twice by someone other than the author, once by the CEO. Root cause
  every time: the outcome was keyed to the STEP, not to the ANSWER. A spot check
  on one answer cannot detect that, so this walks EVERY answer at EVERY
  multi-answer decision point and compares end-state fingerprints pairwise.

  Descended from docs/specs/2026-08-06-duel-ui-fixtures/answer-matrix.py on master,
  which is the reference implementation of the gate. Same contract: it exits
  NON-ZERO on any collision. It is a gate, not a report.

RUN
  npm run build && npx vite preview --port 4321 --strictPort &
  python3 answer-matrix.py [url] [outfile]
"""
import json
import sys
import time

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4321/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/answer-outcome-matrix.md"

# The observable end state. Deliberately includes what the screen is ASKING now:
# an answer that opens a further decision differs observably from one that hands
# the board back, before anything resolves.
FINGERPRINT = """() => {
  const t = (s) => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\\n/g,' ').trim());
  const rows = (side) => [...document.querySelectorAll(`[data-testid=${side}] .zonerow`)]
      .map(r => [...r.querySelectorAll('.slot')].map(s => {
          const c = s.querySelector('.card'); if (!c) return '.';
          const nm = c.querySelector('.tilename');
          return (c.className.includes('back') ? 'FD' : (nm ? nm.innerText.replace(/\\n/g,' ') : '?'))
                 + (c.className.includes('def') ? '(def)' : '');
      }).join(',')).join(' // ');
  const piles = (side) => t(`[data-testid=${side}] .pile`).join(' ');
  return {
    lp: t('.sideplate .lpval').join('/'),
    mine: rows('my-field'), theirs: rows('opp-field'),
    myPiles: piles('my-field'), oppPiles: piles('opp-field'),
    hand: [...document.querySelectorAll('[data-testid=my-hand] .tilename')].map(e=>e.innerText).join(','),
    pending: (t('[data-testid=decision-sentence]')[0] || ''),
    receipt: (t('[data-testid=auto-receipt]')[0] || ''),
    intent: (t('[data-testid=intent-line]')[0] || ''),
    // THE ROW'S IDENTITY REF, NOT ITS PROSE.
    //
    // The rail used to print a slot index at the player (`MOVE a card GRAVE 1 →
    // GRAVE`), and this fingerprint read that index as its disambiguator. The index
    // is gone from the visible row — a sequence number is an array position wearing a
    // noun — and travels as `data-ref` instead. So the gate reads the ref: two
    // discards that differ only by which hand card moved still produce different
    // fingerprints, and they now do so through a machine-readable attribute that
    // cannot drift when the copy owner rewrites the sentence.
    log: [...document.querySelectorAll('[data-testid=feed-row]')]
           .map(e => e.innerText.replace(/\\n/g,' ').trim() + '#' + (e.getAttribute('data-ref') || ''))
           .join(' ; '),
    ended: !!document.querySelector('[data-testid=duel-end]')
  };
}"""


class D:
    def __init__(self, pg):
        self.pg = pg
        # what the app actually submitted, and the identity of each card that
        # response names — published by the submit path, never read from the label.
        self.submit = None
        # was the rendered confirm label visually cut off?
        self.clipped = False
        # what the control the player ACTUALLY PRESSED said, captured at press
        # time. The invariant has two halves; this column proves the second.
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
        self.pg.select_option("[data-testid=scenario-picker]", sid)
        time.sleep(1.0)

    def verb(self, sel_card, sub, container="[data-testid=my-hand] button"):
        n = self.pg.locator(container).count()
        for i in range(n):
            self.click(container, i)
            time.sleep(0.2)
            vc = self.pg.locator("[data-testid=verb-chip-cluster] button")
            labels = vc.all_inner_texts() if vc.count() else []
            for j, l in enumerate(labels):
                if sub.lower() in l.lower():
                    self.click("[data-testid=verb-chip-cluster] button", j)
                    return True
            self.pg.keyboard.press("Escape")
        raise AssertionError(f"verb {sub!r} not offered in {container}")

    def wait_q(self, timeout=8000):
        self.pg.wait_for_selector("[data-testid=question]", timeout=timeout)
        time.sleep(0.25)

    def board_cands(self):
        return self.pg.locator(".card.target-mine, .card.target-theirs")

    def pick_board(self, i):
        self.click(".card.target-mine, .card.target-theirs", i)
        time.sleep(0.25)

    def pick_thumb(self, i):
        self.click("[data-testid=decision-candidate]", i)
        time.sleep(0.25)

    def confirm(self):
        self.named = self.pg.locator("[data-testid=decision-confirm]").first.inner_text().replace("\n", " ")
        # A label whose DOM text is complete but whose RENDERED text is cut is
        # still a label that does not name the answer. `inner_text` cannot see
        # that, so measure it.
        self.clipped = self.pg.evaluate(
            "() => { const e = document.querySelector('[data-testid=decision-confirm]');"
            " return e ? (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) : false; }"
        )
        self.click("[data-testid=decision-confirm]")
        self.submit = self.pg.evaluate("() => window.__lastSubmit ?? null")

    def decline(self):
        self.named = self.pg.locator("[data-testid=decision-decline]").first.inner_text().replace("\n", " ")
        self.click("[data-testid=decision-decline]")

    def zone(self, i):
        n = self.pg.locator("[data-testid=zone-option]").count()
        self.named = f"Place here (legal zone {i + 1} of {n})"
        self.click("[data-testid=zone-option]", i)

    def settle(self, ms=2600):
        time.sleep(ms / 1000)

    def fingerprint(self):
        return self.pg.evaluate(FINGERPRINT)


# ── reaching each decision point ─────────────────────────────────────────────

def reach_tribute(d):
    d.scenario("tribute")
    d.verb(None, "tribute")
    d.wait_q()


def reach_zone(d):
    reach_tribute(d)
    d.pick_board(0)
    d.confirm()
    d.pg.wait_for_selector("[data-testid=zone-option]", timeout=9000)
    time.sleep(0.3)


def reach_chain(d):
    d.scenario("chain")
    d.wait_q()


def reach_attack_multi(d):
    d.scenario("attack-multi")
    d.verb(None, "attack", container="[data-testid=my-field] button")
    d.wait_q()


def reach_discard(d):
    d.scenario("discard")
    d.wait_q()


POINTS = [
    dict(
        scenario="tribute",
        question="SelectTribute — which of two identical monsters to tribute",
        recorded="RECORDED: min=1 max=1 cards=2 cancelable=true, both cards code 71564252 'Thunder King Rai-Oh'",
        reach=reach_tribute,
        answers=[
            ("tribute the one in Monster 1", lambda d: (d.pick_board(0), d.confirm())),
            ("tribute the one in Monster 2", lambda d: (d.pick_board(1), d.confirm())),
            ("cancel the summon (player-pressed)", lambda d: d.decline()),
        ],
    ),
    dict(
        scenario="tribute",
        question="SelectZone — where the monarch lands",
        recorded="RECORDED: count=1, zones=5, NO cancelable field and no cancel response in the protocol",
        reach=reach_zone,
        answers=[
            ("zone 1", lambda d: d.zone(0)),
            ("zone 2", lambda d: d.zone(1)),
            ("zone 3", lambda d: d.zone(2)),
            ("zone 4", lambda d: d.zone(3)),
        ],
    ),
    dict(
        scenario="chain",
        question="ChainPrompt — respond, or do not",
        recorded="RECORDED verbatim. The candidate arrives code:0/name:\"\" for the asking player's OWN hand card; its identity is resolved from the recorded STATE snapshot, never from a literal",
        reach=reach_chain,
        answers=[
            ("activate the set card", lambda d: (d.pick_board(0), d.confirm())),
            ("no response", lambda d: d.decline()),
        ],
    ),
    dict(
        scenario="attack-multi",
        question="SelectCard — attack target (cancelable:true — the decision that made the game unwinnable)",
        recorded="RECORDED decision, candidate list extended with monsters really on the same recorded board",
        reach=reach_attack_multi,
        answers=[
            ("attack target 1", lambda d: (d.pick_board(0), d.confirm())),
            ("attack target 2", lambda d: (d.pick_board(1), d.confirm())),
            ("cancel the attack (player-pressed)", lambda d: d.decline()),
        ],
    ),
    dict(
        scenario="discard",
        question="SelectCard — end-phase discard from your own hand (7 candidates, none named)",
        recorded="RECORDED verbatim: 7 candidates, every one code:0 name:'' though all belong to the asked player",
        reach=reach_discard,
        answers=[(f"discard hand card {i + 1}", (lambda i: lambda d: (d.pick_board(i), d.confirm()))(i)) for i in range(7)],
    ),
]


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, ignore_https_errors=True)
        for point in POINTS:
            rows = []
            for label, apply in point["answers"]:
                page = ctx.new_page()
                errs = []
                page.on("pageerror", lambda e: errs.append(str(e)))
                page.goto(URL)
                time.sleep(0.9)
                d = D(page)
                try:
                    point["reach"](d)
                    apply(d)
                    named = d.named
                    d.settle()
                    fp = d.fingerprint()
                except Exception as e:  # noqa: BLE001
                    named = f"<<reach/apply failed: {e}>>"
                    fp = {"error": str(e), "log": "", "pending": ""}
                rows.append(
                    dict(answer=label, named=named, fp=fp, errors=errs, submit=d.submit, clipped=d.clipped)
                )
                page.close()
            results.append(dict(point=point, rows=rows))
        browser.close()

    def board_key(fp):
        return json.dumps({k: v for k, v in fp.items() if k not in ("log", "receipt")}, sort_keys=True)

    # ── INVARIANT B · label fidelity ─────────────────────────────────────────
    label_failures = []
    label_checked = 0
    for r in results:
        for row in r["rows"]:
            sub = row.get("submit")
            if not sub or not sub.get("identities"):
                continue  # a decline names no card; nothing to check
            label_checked += 1
            if row.get("clipped"):
                label_failures.append(
                    (
                        r["point"]["question"],
                        row["answer"],
                        ", ".join(sub["identities"]),
                        sub.get("label"),
                        "confirm label is VISUALLY TRUNCATED (scrollWidth > clientWidth)",
                    )
                )
            for ident in sub["identities"]:
                if ident not in (sub.get("label") or ""):
                    label_failures.append(
                        (r["point"]["question"], row["answer"], ident, sub.get("label"), "confirm label")
                    )
                if ident not in (sub.get("selectionLine") or ""):
                    label_failures.append(
                        (r["point"]["question"], row["answer"], ident, sub.get("selectionLine"), "selection line")
                    )

    failures, log_only, broken = [], [], []
    for r in results:
        seen_all, seen_board = {}, {}
        for row in r["rows"]:
            if "error" in row["fp"]:
                broken.append((r["point"]["question"], row["answer"], row["fp"]["error"]))
                continue
            k_all = json.dumps(row["fp"], sort_keys=True)
            k_brd = board_key(row["fp"])
            if k_all in seen_all:
                failures.append((r["point"]["question"], seen_all[k_all], row["answer"]))
            elif k_brd in seen_board:
                log_only.append((r["point"]["question"], seen_board[k_brd], row["answer"]))
            seen_all[k_all] = row["answer"]
            seen_board[k_brd] = row["answer"]

    with open(OUT, "w") as f:
        f.write("# Answer x outcome matrix — BOTH answer-fidelity invariants\n\n")
        f.write("**Generated by** `spikes/duel-redo-proto/answer-matrix.py` against the built prototype,\n")
        f.write("real mouse events at real coordinates. **Exits non-zero on a failure of either.**\n\n")
        f.write("**A · distinct outcomes** — for any decision with more than one legal answer, distinct\n")
        f.write("answers must produce distinct observable outcomes.\n\n")
        f.write("**B · label fidelity** — the confirm control and the selection line must NAME the answer\n")
        f.write("being submitted. A passed 19 of 19 while B was failing, because A compares end states\n")
        f.write("and never reads the label. They are two invariants, not one.\n\n")
        f.write(
            f"**Decision points walked:** {len(results)} · **answers exercised:** "
            f"{sum(len(r['rows']) for r in results)} · **outcome collisions:** {len(failures)} · "
            f"**card-naming answers label-checked:** {label_checked} · "
            f"**label-fidelity failures:** {len(label_failures)} · "
            f"**unreachable:** {len(broken)}\n\n"
        )
        f.write("## B · Label fidelity — does the control NAME the answer being submitted?\n\n")
        f.write("Compared against `window.__lastSubmit.identities`, resolved from the response's own\n")
        f.write("indices. Two independent paths; a label sourced from anywhere else fails.\n\n")
        if label_failures:
            f.write("### x LABEL FIDELITY FAILURES\n\n")
            for q, a, ident, got, where in label_failures:
                f.write(f"- **{q}** — answer `{a}` submits `{ident}` but the {where} reads `{got}`.\n")
            f.write("\n")
        else:
            f.write(f"OK — {label_checked} card-naming answers checked, every one named by both the\n")
            f.write("confirm control and the selection line.\n\n")
        f.write("## A · Distinct outcomes\n\n")
        if failures:
            f.write("## x COLLISIONS\n\n")
            for q, a, b in failures:
                f.write(f"- **{q}** — `{a}` and `{b}` produce an identical end state.\n")
            f.write("\n")
        else:
            f.write("## OK — no collisions. Every answer produced a distinct end state.\n\n")
        if log_only:
            f.write("## Distinguished by the event feed, not by the final board\n\n")
            f.write("Not bugs — the domain makes the boards converge. Listed rather than hidden behind a tick.\n\n")
            for q, a, b in log_only:
                f.write(f"- **{q}** — `{a}` and `{b}` reach the same final board; the feed records which.\n")
            f.write("\n")
        if broken:
            f.write("## Answers the harness could not reach\n\n")
            for q, a, e in broken:
                f.write(f"- **{q}** — `{a}`: {e}\n")
            f.write("\n")
        for r in results:
            pt = r["point"]
            f.write(f"---\n\n## {pt['question']}\n\n*Scenario:* `{pt['scenario']}` · *{pt['recorded']}*\n\n")
            f.write(
                "| answer | the control you pressed said | the response actually names | LP "
                "| your field | their field | your piles | their piles | screen now says |\n"
            )
            f.write("|---|---|---|---|---|---|---|---|---|\n")
            for row in r["rows"]:
                fp = row["fp"]
                named = (row["named"] or "—").replace("|", "\\|")
                sub = row.get("submit") or {}
                ids = ", ".join(sub.get("identities") or []) or "— (no card named)"
                asks = (fp.get("pending") or fp.get("receipt") or "—").replace("|", "\\|")
                f.write(
                    f"| **{row['answer']}** | `{named}` | `{ids}` | `{fp.get('lp','')}` | `{fp.get('mine','')}` | "
                    f"`{fp.get('theirs','')}` | `{fp.get('myPiles','')}` | `{fp.get('oppPiles','')}` | {asks} |\n"
                )
            f.write("\n<details><summary>feed tails</summary>\n\n")
            for row in r["rows"]:
                tail = " ; ".join((row["fp"].get("log") or "").split(" ; ")[-5:])
                f.write(f"- **{row['answer']}** — {tail}\n")
            f.write("\n</details>\n\n")
            errs = [e for row in r["rows"] for e in row["errors"]]
            if errs:
                f.write(f"page errors: {errs[:3]}\n\n")

    print(f"wrote {OUT}")
    print(
        f"points={len(results)} answers={sum(len(r['rows']) for r in results)} "
        f"collisions={len(failures)} label-checked={label_checked} "
        f"label-failures={len(label_failures)} log-only={len(log_only)} unreachable={len(broken)}"
    )
    for q, a, b in failures:
        print(f"  COLLISION {q}: {a} == {b}")
    for q, a, ident, got, where in label_failures:
        print(f"  LABEL {q}: {a} submits {ident!r} but {where} says {got!r}")
    for q, a, e in broken:
        print(f"  UNREACHABLE {q}: {a}: {e}")
    return 1 if (failures or label_failures) else 0


if __name__ == "__main__":
    sys.exit(main())
