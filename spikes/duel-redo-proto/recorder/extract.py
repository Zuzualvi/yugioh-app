#!/usr/bin/env python3
"""
extract.py — cut the ZUH-121 recorded capture into named fixture slices.

INPUT   rec/out/*.json  — every WebSocket frame of a real duel, in full, both
                          seats, captured 2026-08-13 against master f86683c on
                          the repo's own same-origin E2E harness (real WASM
                          ocgcore, two Chromium contexts, 1440x900).
OUTPUT  one JSON per slice: an ordered list of frames as seen BY ONE SEAT,
        starting at a named anchor and running to a named stop.

Nothing here invents a frame. Where a fixture needed a frame the capture does
not contain, it is written into `hand-authored.json` instead, with a reason —
never mixed into a recorded slice.
"""
import json, sys, pathlib, collections

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "out/r1-full-duel.json")
DST = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "fixtures")
DST.mkdir(parents=True, exist_ok=True)

cap = json.loads(SRC.read_text())
frames = cap["frames"]
TAGS = []

# Frames are tagged with the browser context that saw them ("alice"/"bob").
# Map to seats via SEAT_ASSIGNED.
seat_of = {}
for f in frames:
    if f["frame"].get("type") == "SEAT_ASSIGNED":
        seat_of[f["seat"]] = f["frame"]["seat"]
assert len(seat_of) == 2, seat_of
TAGS.extend(seat_of.keys())
A, B = TAGS[0], TAGS[1]


def stream(tag):
    """All frames one seat saw or sent, in order, with MSG dropped (the raw
    relay is legacy; EVENTS is the typed feed this design builds on)."""
    return [f for f in frames if f["seat"] == tag and f["frame"].get("type") != "MSG"]


def find(tag, pred, start=0):
    s = stream(tag)
    for i in range(start, len(s)):
        if pred(s[i]):
            return i
    return None


def dec(kind):
    return lambda f: f["frame"].get("type") == "DECISION" and f["frame"]["decision"]["kind"] == kind


def resp(kind, **kw):
    def p(f):
        if f["frame"].get("type") != "DECISION_RESPONSE":
            return False
        r = f["frame"]["response"]
        return r["kind"] == kind and all(r.get(k) == v for k, v in kw.items())

    return p


def slice_out(name, tag, start_pred, count, note, occurrence=0, needLpAbove=0):
    for cand_tag in ([tag] + [t for t in TAGS if t != tag]):
        r = _slice(name, cand_tag, start_pred, count, note, occurrence, needLpAbove)
        if r:
            return r
    print(f"  !! {name}: anchor not found on either seat")
    return None


def _slice(name, tag, start_pred, count, note, occurrence, needLpAbove):
    s = stream(tag)
    hits = [i for i in range(len(s)) if start_pred(s[i])]
    if needLpAbove:
        def lp_ok(i):
            for j in range(i, -1, -1):
                if s[j]["frame"].get("type") == "STATE":
                    return min(s[j]["frame"]["state"]["lp"]) > needLpAbove
            return False
        hits = [i for i in hits if lp_ok(i)]
    if len(hits) <= occurrence:
        return None
    i = hits[occurrence]
    # Rewind to the most recent STATE so the slice opens on a full board.
    j = i
    while j > 0 and s[j]["frame"].get("type") != "STATE":
        j -= 1
    sl = s[j : i + count]
    out = {
        "name": name,
        "provenance": "RECORDED",
        "source": f"{SRC.name} · seat {seat_of[tag]} ({tag}) · frames {j}..{i+count} of that seat's stream",
        "note": note,
        "mySeat": seat_of[tag],
        "frames": [{"dir": f["dir"], "t": f["t"], "frame": f["frame"]} for f in sl],
    }
    p = DST / f"{name}.json"
    p.write_text(json.dumps(out, separators=(",", ":")))
    kinds = collections.Counter(
        f["frame"].get("type")
        + (
            ":" + f["frame"]["decision"]["kind"]
            if f["frame"].get("type") == "DECISION"
            else ":" + f["frame"]["response"]["kind"]
            if f["frame"].get("type") == "DECISION_RESPONSE"
            else ""
        )
        for f in sl
    )
    print(f"  {name}: {len(sl)} frames  {dict(kinds)}")
    return out




print("slices:")
# 1 — the first ten seconds: seating through the first decision.
slice_out(
    "s01-duel-start",
    A,
    lambda f: f["frame"].get("type") == "SEAT_ASSIGNED",
    14,
    "Seating: SEAT_ASSIGNED, first STATE, first CONTROL(=CLOCK), first IdleCommand.",
)

# 2 — normal summon: IdleCommand -> summon -> SelectZone -> events
slice_out(
    "s02-normal-summon",
    A,
    resp("IdleCommand", action="summon"),
    18,
    "Normal summon from hand: the engine's SelectZone step and the events that follow.",
)

# 3 — tribute summon: the multi-step intent, with the tribute step
slice_out(
    "s03-tribute-summon",
    A,
    lambda f: f["frame"].get("type") == "DECISION"
    and f["frame"]["decision"]["kind"] == "SelectTribute"
    and len(f["frame"]["decision"]["cards"]) >= 2,
    20,
    "SelectTribute with TWO legal tributes (min=1,max=1,cards=2,cancelable=true) — two substantive answers, so it is asked. Then SelectZone, which has no cancel in the protocol.",
    needLpAbove=1,
)

# 4 — attack declaration into a monster, with the target step PRESENTED
slice_out(
    "s04-attack-target",
    B,
    lambda f: f["frame"].get("type") == "DECISION"
    and f["frame"]["decision"]["kind"] == "SelectCard"
    and f["frame"]["decision"].get("cancelable") is True
    and all(c["location"] == "MZONE" for c in f["frame"]["decision"]["cards"]),
    6,
    "BattleCommand attack -> SelectCard target (cancelable:true). This is the decision the shipped client auto-declined; here it is on the wire with the target list intact.",
)

# 5 — chain window offered
slice_out(
    "s05-chain-window",
    A,
    dec("ChainPrompt"),
    20,
    "ChainPrompt offered with candidates. Note selects[] carries code:0/name:'' for the asked player's OWN set card — ND-9.",
)

# 6 — hand-size discard at end phase: SelectCard over the player's own hand
slice_out(
    "s06-hand-discard",
    A,
    lambda f: f["frame"].get("type") == "DECISION"
    and f["frame"]["decision"]["kind"] == "SelectCard"
    and all(c["location"] == "HAND" for c in f["frame"]["decision"]["cards"]),
    8,
    "End-phase hand-size discard: SelectCard over the player's own hand, every candidate code:0/name:'' — the same ND-9 defect, on the most-anonymous surface possible.",
)

# 7 — a whole opponent turn as the off-clock seat sees it (the DELTA source)
i_lose = find(A, resp("BattleCommand", action="toEP"))
if i_lose is not None:
    s = stream(A)
    j = i_lose
    k = j
    while k < len(s) and not (s[k]["frame"].get("type") == "DECISION"):
        k += 1
    out = {
        "name": "s07-opponent-turn",
        "provenance": "RECORDED",
        "source": f"{SRC.name} · seat {seat_of[A]} ({A}) · from its own toEP to the next decision it is asked",
        "note": "Everything the off-clock seat receives across one opponent turn. This is the input to the 'While you were away' delta.",
        "mySeat": seat_of[A],
        "frames": [{"dir": f["dir"], "t": f["t"], "frame": f["frame"]} for f in s[j : k + 2]],
    }
    (DST / "s07-opponent-turn.json").write_text(json.dumps(out, separators=(",", ":")))
    ev = sum(
        len(f["frame"]["events"]) for f in s[j : k + 2] if f["frame"].get("type") == "EVENTS"
    )
    print(f"  s07-opponent-turn: {k+2-j} frames, {ev} events")

# 8 — BattleCommand with no attack available (arming the board in BP)
slice_out(
    "s08-battle-command",
    A,
    dec("BattleCommand"),
    6,
    "BattleCommand arming the board — never rendered as a question panel (cleared decision, carried forward).",
)

print("\ncard passcodes referenced across all slices:")
codes = set()
for p in sorted(DST.glob("s*.json")):
    d = json.loads(p.read_text())
    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("code"), int) and o["code"] > 0:
                codes.add(o["code"])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(d)
print(" ", sorted(codes), f"({len(codes)} cards)")
(DST / "passcodes.json").write_text(json.dumps(sorted(codes)))
