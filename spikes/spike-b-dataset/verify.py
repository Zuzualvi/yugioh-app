#!/usr/bin/env python3
"""
Spike B — Artifact Verification Script
Recomputes all acceptance assertions from generated artifacts and prints PASS/FAIL.
"""

import json
import sys
from pathlib import Path

OUT = Path(__file__).parent / "out"

results = []

def check(label: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    suffix = f"  ({detail})" if detail else ""
    print(f"  [{status}] {label}{suffix}")
    results.append(ok)
    return ok


print("=" * 60)
print("Spike B — Artifact Verification")
print("=" * 60)


# ─── Load artifacts ───────────────────────────────────────────────────────────

allowlist = json.loads((OUT / "edison-allowlist.json").read_text())
alias_map = json.loads((OUT / "edison-alias-map.json").read_text())
lflist_text = (OUT / "edison.lflist.conf").read_text()
dt01 = json.loads((OUT / "dt01-excluded.json").read_text())
errata_md = (OUT / "functional-errata-gaplist.md").read_text()

print()
print("── 1. edison-allowlist.json ─────────────────────────────────")

# count == cards.length
check(
    "count field == len(cards)",
    allowlist["count"] == len(allowlist["cards"]),
    f"count={allowlist['count']} len={len(allowlist['cards'])}",
)

# count within tolerance of 3681
delta = abs(allowlist["count"] - 3681)
check(
    "count within tolerance of 3681",
    delta <= 20,
    f"count={allowlist['count']} delta={allowlist['count']-3681}",
)

# cards sorted ascending by passcode
pcs = [c["passcode"] for c in allowlist["cards"]]
check(
    "cards sorted ascending by passcode",
    pcs == sorted(pcs),
    f"first={pcs[0]} last={pcs[-1]}",
)

# format field correct
check(
    'format == "edison-2010-03"',
    allowlist["format"] == "edison-2010-03",
    allowlist.get("format"),
)

print()
print("── 2. edison-alias-map.json ─────────────────────────────────")

pool_ids = {c["passcode"] for c in allowlist["cards"]}

# All alias bases are in the allowlist
all_bases_in_pool = all(v["base"] in pool_ids for v in alias_map.values())
check(
    "all alias bases in allowlist",
    all_bases_in_pool,
    f"{len(alias_map)} aliases checked",
)

# Expected 7 aliases
check("alias count == 7", len(alias_map) == 7, f"count={len(alias_map)}")

# Specific required aliases present (from spec)
required = {
    "511002993": 50321796,  # Brionac
    "511002631": 26202165,  # Sangan
    "511002992": 14878871,  # Rescue Cat
    "511002994": 7391448,   # Goyo
    "511002995": 87910978,  # Brain Control
    "511002997": 77565204,  # Future Fusion
    "511002996": 61740673,  # Imperial Order
}
for alias, base in required.items():
    present = alias in alias_map
    base_ok = present and alias_map[alias]["base"] == base
    check(
        f"alias {alias} → base {base}",
        base_ok,
        f"found={present} base={alias_map.get(alias, {}).get('base')}",
    )

print()
print("── 3. edison.lflist.conf ────────────────────────────────────")

# Count entries by type
def count_by_type(text, count_val):
    entries = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("!") or line.startswith("$") or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1] == str(count_val):
            entries.append(parts[0])
    return entries

forbidden_entries = count_by_type(lflist_text, 0)
limited_entries   = count_by_type(lflist_text, 1)
semi_entries      = count_by_type(lflist_text, 2)

c0, c1, c2 = len(forbidden_entries), len(limited_entries), len(semi_entries)
print(f"  Counts from file: {c0} Forbidden / {c1} Limited / {c2} Semi")

check("lflist has exactly 43 Forbidden (count-0) entries", c0 == 43, f"got {c0}")
check("lflist has exactly 70 Limited (count-1) entries",   c1 == 70, f"got {c1}")
check("lflist has exactly 19 Semi (count-2) entries",      c2 == 19, f"got {c2}")

# Header line present
check(
    'lflist header is "!2010.3 Edison"',
    "!2010.3 Edison" in lflist_text,
)

# Pre-errata passcodes present in lflist
for alias in ["511002993", "511002631", "511002992", "511002994", "511002995", "511002997", "511002996"]:
    check(
        f"pre-errata passcode {alias} in lflist",
        alias in lflist_text,
    )

print()
print("── 4. dt01-excluded.json ────────────────────────────────────")

# Exactly 27 passcodes
check("count == 27", dt01["count"] == 27, f"count={dt01['count']}")
check("passcodes length == 27", len(dt01["passcodes"]) == 27, f"len={len(dt01['passcodes'])}")

# None appear in allowlist
overlap = [p for p in dt01["passcodes"] if p in pool_ids]
check(
    "no DT01 passcode appears in allowlist",
    len(overlap) == 0,
    f"overlap={overlap}" if overlap else "0 overlap",
)

# No duplicates
check(
    "no duplicate DT01 passcodes",
    len(set(dt01["passcodes"])) == len(dt01["passcodes"]),
)

print()
print("── 5. functional-errata-gaplist.md ─────────────────────────")

# Check bucket counts in the markdown summary table
import re

# Count rows in main table: data rows have a numeric first cell (| 1 | ... | 36 |)
table_rows = []
for line in errata_md.splitlines():
    if not line.startswith("| "):
        continue
    cell = line.split("|")[1].strip()
    if cell.isdigit():
        table_rows.append(line)
check("errata table has 36 data rows", len(table_rows) == 36, f"found {len(table_rows)}")

# Bucket counts
statuses = {"substitute-ready": 0, "script-exists-unused": 0, "needs-authoring": 0, "rules-not-script": 0}
for row in table_rows:
    for s in statuses:
        if s in row:
            statuses[s] += 1
            break

check("substitute-ready count == 6",   statuses["substitute-ready"] == 6,   f"got {statuses['substitute-ready']}")
check("script-exists-unused count == 6", statuses["script-exists-unused"] == 6, f"got {statuses['script-exists-unused']}")
check("needs-authoring count == 18",   statuses["needs-authoring"] == 18,   f"got {statuses['needs-authoring']}")
check("rules-not-script count == 6",   statuses["rules-not-script"] == 6,   f"got {statuses['rules-not-script']}")
check("total == 36", sum(statuses.values()) == 36, f"total={sum(statuses.values())}")

print()
print("── 6. README.md ─────────────────────────────────────────────")
readme = (OUT / "README.md").read_text()
check("README.md exists and non-empty", len(readme) > 100, f"{len(readme)} bytes")

print()
print("=" * 60)
passed = sum(results)
total = len(results)
print(f"Results: {passed}/{total} PASS")
if passed == total:
    print("✓ ALL CHECKS PASSED")
else:
    print(f"✗ {total - passed} CHECKS FAILED")
print("=" * 60)

sys.exit(0 if passed == total else 1)
