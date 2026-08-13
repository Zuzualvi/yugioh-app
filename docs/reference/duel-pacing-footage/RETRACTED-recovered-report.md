# RETRACTED — there was never anything to recover

A file named `RECOVERED-zuh-131-report.md` was committed here on 2026-08-13 ~04:09, claiming
ZUH-131's deliverable had been lost with a terminated sandbox and reconstructing its summary
from a session trace. **That claim was false and the file has been deleted.**

**The deliverable was never lost.** It is at `docs/specs/2026-08-13-duel-pacing/` on branch
`docs/duel-experience-redo-discovery` — 847 lines across README, `01-pacing-findings.md`
(P1–P12), `02-needs-model-test.md` (C1–C6), `03-timing-budgets.md` (B1–B6) and `04-method.md`,
pushed at **03:52 UTC**, seventeen minutes *before* the retracted file was written.

**Use the real deliverable. It is longer, evidence-tagged per finding, and authored by the
researcher that did the work.**

## How the mistake happened, since the method is the reusable part

The check was `git ls-tree -r --name-only <ref> | grep -iE "pacing|2026-08-13" | head -6`. The
design docs sort first and filled all six lines; the pacing files were below the cut. **Absence
was concluded from a truncated list** — the grep never said the files were missing, it was
simply not allowed to finish.

🔑 **A negative result from a truncated command is not a negative result.** Count matches before
trusting that there are none.

## What in that directory IS still good

`turn-badges/` and `dense/` stand — both were produced against the researcher's own written
asks and neither depends on the retracted claim.
