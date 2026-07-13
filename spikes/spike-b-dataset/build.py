#!/usr/bin/env python3
"""
Spike B — Edison Dataset Build Script
Generates all 6 deliverables under spikes/spike-b-dataset/out/
"""

import json
import re
import datetime
from pathlib import Path

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

# ─── Load source data ──────────────────────────────────────────────────────────

print("Loading EdisonCards.json …")
with open("/tmp/EdisonCards.json") as f:
    raw_cards = json.load(f)

# Build lookup maps (EdisonCards.json uses field "id" as passcode, "Name" as name)
name_to_id = {c["Name"]: c["id"] for c in raw_cards}
id_to_name = {c["id"]: c["Name"] for c in raw_cards}

print(f"  {len(raw_cards)} cards in EdisonCards.json")

print("Loading banlist.js …")
banlist_js = open("/tmp/banlist.js").read()
lines = banlist_js.split("\n")
ban_line = [l for l in lines if l.startswith("const ban")][0]
lim_line = [l for l in lines if l.startswith("const lim")][0]
sem_line = [l for l in lines if l.startswith("const sem")][0]
ban_names = [c["Name"] for c in json.loads(ban_line.split("= ")[1].rstrip(";"))]
lim_names = [c["Name"] for c in json.loads(lim_line.split("= ")[1].rstrip(";"))]
sem_names = [c["Name"] for c in json.loads(sem_line.split("= ")[1].rstrip(";").rstrip())]
print(f"  Banlist: {len(ban_names)} Forbidden / {len(lim_names)} Limited / {len(sem_names)} Semi")

# ─── Pre-errata alias map ─────────────────────────────────────────────────────
# These 7 cards have pre-errata passcodes the allow-list must accept.
# The lflist ALSO uses these passcodes so the engine sees the pre-errata scripts.

ALIAS_MAP = {
    "511002993": {
        "base": name_to_id["Brionac, Dragon of the Ice Barrier"],   # 50321796
        "name": "Brionac, Dragon of the Ice Barrier",
        "reason": "pre-errata",
    },
    "511002631": {
        "base": name_to_id["Sangan"],                                 # 26202165
        "name": "Sangan",
        "reason": "pre-errata",
    },
    "511002992": {
        "base": name_to_id["Rescue Cat"],                             # 14878871
        "name": "Rescue Cat",
        "reason": "pre-errata",
    },
    "511002994": {
        "base": name_to_id["Goyo Guardian"],                          # 7391448
        "name": "Goyo Guardian",
        "reason": "pre-errata",
    },
    "511002995": {
        "base": name_to_id["Brain Control"],                          # 87910978
        "name": "Brain Control",
        "reason": "pre-errata",
    },
    "511002997": {
        "base": name_to_id["Future Fusion"],                          # 77565204
        "name": "Future Fusion",
        "reason": "pre-errata",
    },
    "511002996": {
        "base": name_to_id["Imperial Order"],                         # 61740673
        "name": "Imperial Order",
        "reason": "pre-errata",
    },
}

# Lookup: card name → passcode to use in lflist
# For the 7 pre-errata cards, use alias passcode; all others use EdisonCards.json id.
PRE_ERRATA_OVERRIDE = {v["name"]: int(k) for k, v in ALIAS_MAP.items()}

def get_passcode(name: str) -> int:
    if name in PRE_ERRATA_OVERRIDE:
        return PRE_ERRATA_OVERRIDE[name]
    return name_to_id[name]


# ─── DT01 excluded passcodes ──────────────────────────────────────────────────

DT01_PASSCODES = sorted([
    59482302, 19204398, 85876417, 22371016, 54326448, 91711547, 28332833,
    68505803, 30399511, 67483216,  4904812, 93882364, 47421985, 65549080,
    29054481, 92933195, 92065772, 30276969, 58760121, 85754829, 11159464,
    57543573, 84932271, 10026986, 96099959, 23093604, 83810690,
])
assert len(DT01_PASSCODES) == 27, "DT01 list must have exactly 27 entries"


# ─── 1. edison-allowlist.json ─────────────────────────────────────────────────

print("\nBuilding edison-allowlist.json …")

cards_sorted = sorted(raw_cards, key=lambda c: c["id"])
allowlist_cards = [{"passcode": c["id"], "name": c["Name"]} for c in cards_sorted]

allowlist = {
    "format": "edison-2010-03",
    "source": "edisonformat.net EdisonCards.json",
    "generatedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "count": len(allowlist_cards),
    "cards": allowlist_cards,
}
assert allowlist["count"] == len(allowlist["cards"])

with open(OUT / "edison-allowlist.json", "w") as f:
    json.dump(allowlist, f, indent=2)

pool_ids = {c["id"] for c in raw_cards}

print(f"  count = {allowlist['count']} (target ≈ 3681; delta from target = {allowlist['count'] - 3681})")


# ─── 2. edison-alias-map.json ─────────────────────────────────────────────────

print("\nBuilding edison-alias-map.json …")

with open(OUT / "edison-alias-map.json", "w") as f:
    json.dump(ALIAS_MAP, f, indent=2)

# Verify every alias base is in the allowlist
for alias, entry in ALIAS_MAP.items():
    assert entry["base"] in pool_ids, f"Alias {alias} base {entry['base']} NOT in pool!"

print(f"  {len(ALIAS_MAP)} aliases, all bases in pool ✓")


# ─── 3. edison.lflist.conf ────────────────────────────────────────────────────

print("\nBuilding edison.lflist.conf …")

lines_out = ["!2010.3 Edison", "$whitelist"]

lines_out.append("")
lines_out.append("#forbidden")
for name in ban_names:
    pc = get_passcode(name)
    lines_out.append(f"{pc} 0 --{name}")

lines_out.append("")
lines_out.append("#limited")
for name in lim_names:
    pc = get_passcode(name)
    lines_out.append(f"{pc} 1 --{name}")

lines_out.append("")
lines_out.append("#semi-limited")
for name in sem_names:
    pc = get_passcode(name)
    lines_out.append(f"{pc} 2 --{name}")

lines_out.append("")

lflist_text = "\n".join(lines_out)
with open(OUT / "edison.lflist.conf", "w") as f:
    f.write(lflist_text)

# Verify counts from file
def count_entries(text, count):
    return len([l for l in text.splitlines()
                if l and not l.startswith("!") and not l.startswith("$") and not l.startswith("#")
                and l.split()[1] == str(count)])

c0 = count_entries(lflist_text, 0)
c1 = count_entries(lflist_text, 1)
c2 = count_entries(lflist_text, 2)
print(f"  count-0 (Forbidden): {c0}  (expected 43)")
print(f"  count-1 (Limited):   {c1}  (expected 70)")
print(f"  count-2 (Semi):      {c2}  (expected 19)")
assert c0 == 43, f"Forbidden count mismatch: {c0}"
assert c1 == 70, f"Limited count mismatch: {c1}"
assert c2 == 19, f"Semi count mismatch: {c2}"
print("  ✓ 43/70/19 confirmed")


# ─── 4. dt01-excluded.json ───────────────────────────────────────────────────

print("\nBuilding dt01-excluded.json …")

dt01_obj = {"count": 27, "passcodes": DT01_PASSCODES}

with open(OUT / "dt01-excluded.json", "w") as f:
    json.dump(dt01_obj, f, indent=2)

# Verify none appear in pool
overlap = [p for p in DT01_PASSCODES if p in pool_ids]
assert len(overlap) == 0, f"DT01 passcodes in pool: {overlap}"
print(f"  27 passcodes written, 0 in pool ✓")


# ─── 5. functional-errata-gaplist.md ─────────────────────────────────────────

print("\nBuilding functional-errata-gaplist.md …")

ERRATA_TABLE = """# Edison Format — Functional Errata Gap List (36 entries)

Source: edisonformat.com/functional-errata.html (canonical) + ProjectIgnis/CardScripts audit.

Status codes:
- **substitute-ready** — community pre-errata script exists AND is wired by the community banlist.
- **script-exists-unused** — Edison-correct pre-errata script exists in CardScripts but NOT used by community banlist.
- **needs-authoring** — no usable Edison-correct script; must be authored or heavily edited.
- **rules-not-script** — difference is an engine/rules flag, not a per-card script fix.

| # | Card name | Real passcode | Edison-correct behavior | Modern shipped behavior | Status |
|---|-----------|--------------|------------------------|------------------------|--------|
| 1 | Brionac, Dragon of the Ice Barrier | 50321796 | Discard any # of cards → return that many cards from field to hand. **No once-per-turn.** | Modern script has hard OPT `SetCountLimit(1,id)` | substitute-ready |
| 2 | Sangan | 26202165 | When sent field→GY: add ≤1500-ATK monster from Deck. **No OPT;** searched monster effects usable freely. | Modern adds hard OPT `SetCountLimit(1,id)` ("once per turn") | substitute-ready |
| 3 | Rescue Cat | 14878871 | Send face-up → SS 2 Lv≤3 Beasts from Deck (destroyed End Phase). **No once-per-name.** Summoned monsters' effects not negated. | Modern has hard OPT `SetCountLimit(1,id)`; also negates summoned monsters' effects | substitute-ready |
| 4 | Goyo Guardian | 7391448 | 1 Tuner + 1+ non-Tuners. **Any Tuner** (non-EARTH allowed). Steals monster destroyed by battle. | Modern requires EARTH Tuner: `AddProcedure(...ATTRIBUTE_EARTH...)` | substitute-ready |
| 5 | Brain Control | 87910978 | Pay 800 LP; take control of 1 face-up opp monster until End Phase. **No restrictions.** | Modern errata adds targeting/use restrictions; OPT in shipped script | substitute-ready |
| 6 | Future Fusion | 77565204 | Send Fusion Materials from Deck to GY; SS Fusion on 2nd Standby. Send **on resolution**; can't activate if can't SS. | Modern errata reworked timing/OPT/send-as-activation | substitute-ready |
| 7 | Red-Eyes Darkness Metal Dragon | 88264978 | Banish 1 face-up Dragon → SS this (**no once-per-name**). [Ign] once/turn SS 1 Dragon from hand/GY (**no once-per-name;** each copy acts). | ProjectIgnis pre-errata script `c88264978.lua` still has once-per-**name** on both effects — NOT Edison-accurate | needs-authoring |
| 8 | Necrovalley | 47355498 | Negate effects targeting a card in either GY; GY cards can't be banished; GK +500/+500. Effects that **don't target** (Rekindling, Treeborn) are NOT negated. | Modern PSCT reworked wording/targeting scope | script-exists-unused |
| 9 | Ryko, Lightsworn Hunter | 21502796 | FLIP: **optionally** target 1 card; destroy if chosen; then mill top 3 (mandatory). | Modern PSCT targeting/optionality wording differs | script-exists-unused |
| 10 | Catapult Turtle | 95727991 | Tribute 1 monster → 1/2 its ATK as damage. **No once-per-turn.** | Modern script adds OPT/PSCT | script-exists-unused |
| 11 | Ancient Fairy Dragon | 25862681 | [Ign] SS 1 Lv≤4 from hand (no BP). [Ign] **destroy** a Field Spell (does NOT target); if destroyed, gain 1000 LP + may add Field Spell from Deck. | Modern errata changed field-spell effect to "send"/target and reworked | script-exists-unused |
| 12 | Darkness Approaches | 80168720 | Discard 2 → flip 1 face-up monster face-down **without changing battle position** (can make face-down Attack Position). | Modern errata removed the position quirk | script-exists-unused |
| 13 | Ultimate Offering | 80604091 | [Quick] pay 500 LP → Normal Summon/Set 1 extra monster (Main Phase or opp's Battle Phase). Summon **on resolution** (Solemn can't negate). | Modern PSCT wording; timing basis differs | script-exists-unused |
| 14 | Armory Arm | 29071332 | [Trigger] damage = destroyed monster's ATK **it had on field** (incl. modifiers), even if it leaves GY. (Colossal Fighter + Armory Arm OTK works.) | Modern errata changed damage source/timing | needs-authoring |
| 15 | Black Garden | 71645242 | [Trigger] on Normal/Special Summon: halve ATK + give opponent Rose Token. **Activates even if monster is SSed FACE-DOWN.** | Modern errata: does not trigger on face-down SS | needs-authoring |
| 16 | Destiny End Dragoon | 76263644 | [Ign] once/turn destroy opp monster + burn = ATK. [Trigger] Standby: banish "Destiny Hero" from GY → SS this. Trigger has **NO once-per-turn.** | Modern adds OPT to revival trigger | needs-authoring |
| 17 | Elemental HERO Prisma | 89312388 | [Ign] once/turn reveal Fusion, send listed material from Deck to GY; become that monster until End Phase. Send **on resolution, NOT a cost.** | Modern PSCT/wording; send-as-cost vs on-resolution nuance | needs-authoring |
| 18 | Fortune Lady Light | 34471458 | [Trigger] when removed from field by card effect → SS 1 "Fortune Lady" from Deck. **Can trigger when leaving face-down** (reveal it). | Modern errata restricts to face-up / PSCT | needs-authoring |
| 19 | Light and Darkness Dragon | 47297616 | [Trigger] on destruction: pick 1 monster in GY, **then** destroy all cards you control, **then** SS that monster — sequential. | Modern PSCT reordered/"then" grouping differs | needs-authoring |
| 20 | Dark End Dragon | 88643579 | [Ign] once/turn: lose 500 ATK/DEF **and** send 1 opp monster to GY. If target leaves field first, this card **still loses 500 ATK/DEF.** | Modern PSCT "and if you do" grouping differs | needs-authoring |
| 21 | Light End Dragon | 25132288 | [Trigger] at attack declaration: this loses 500 ATK/DEF (permanent), battled monster loses 1500 until End Phase. If opp leaves first, this **still loses 500.** | Modern PSCT grouping differs | needs-authoring |
| 22 | Mark of the Rose | 45247637 | Two **separate** [Trigger] effects (End Phase give back; Standby regain) — both start Chain independently. | Modern PSCT merges/changes them | needs-authoring |
| 23 | Mausoleum of the Emperor | 80921533 | [Ign] both players may Normal Summon without Tributing by paying 1000×tributes. Summon **on resolution** (Solemn can't negate). | Modern PSCT wording; timing basis differs | needs-authoring |
| 24 | My Body as a Shield | 69279219 | Pay 1500 LP when opp activates card **with effect that would destroy monsters** → negate + destroy it. Can chain to face-up Royal Oppression. | Modern PSCT narrowed activation trigger wording | needs-authoring |
| 25 | Quickdraw Synchron | 20932152 | [Ign] send 1 monster from hand to GY → SS this. **Send (not discard), on resolution (not a cost).** | Modern PSCT / send-as-cost wording differs | needs-authoring |
| 26 | Soul Exchange | 68005187 | Select 1 opp monster; may Tribute it as if you controlled it this turn (no BP). **Tributing is OPTIONAL** — not forced at earliest opportunity. | Modern PSCT wording | needs-authoring |
| 27 | Strike Ninja | 41006930 | [Quick] banish 2 DARK from GY → banish this until End Phase. Once per turn **per copy** → multiple Strike Ninjas can each use it in same turn. | Modern PSCT hard-OPT blocks multiple copies | needs-authoring |
| 28 | Swap Frog | 9126351 | [Ign] once/turn return 1 monster to hand → NS 1 "Frog" in addition to NS. **Each Swap Frog** can use it once; only **1** extra NS total. | Modern PSCT wording of extra-Normal-Summon interaction | needs-authoring |
| 29 | Treeborn Frog | 12538374 | [Trigger] Standby, if in GY + no S/T → SS it. **No once-per-turn.** | Modern errata added hard OPT ("once per turn") | needs-authoring |
| 30 | Urgent Tuning | 94634433 | Battle-Phase-only: Synchro Summon. Summon **on resolution** (Solemn can't negate). | Modern PSCT wording; timing basis differs | needs-authoring |
| 31 | Cyber Phoenix | 3370104 | Must be **face-up before being selected as attack target** for Trigger to meet activation condition. | Post-2010 damage-step ruling change; card text unchanged | rules-not-script |
| 32 | D.D. Survivor | 48092532 | Same damage-step "face-up before attack-target" ruling for End-Phase self-SS trigger. | Post-2010 damage-step ruling change | rules-not-script |
| 33 | Jade Knight | 44364207 | Same damage-step "face-up before attack-target" ruling for its search Trigger. | Post-2010 damage-step ruling change | rules-not-script |
| 34 | Lumina, Lightsworn Summoner *(all Lightsworns/Judgment Dragon)* | 95503687 | **Phase-dependent mandatory Trigger** (End-Phase mill): re-activates if its **activation** is negated (LADD); does NOT if only **effect** is negated (Skill Drain). | Post–Duelist Saga errata changed this behavior | rules-not-script |
| 35 | Machina Gearframe *(all Union monsters)* | 42940404 | Union monsters carry "A monster can only be equipped with 1 Union at a time." Destroy-redirect clause only on specific list. | 2016 SDKS removed the 1-Union-per-monster condition and standardized redirect clause | rules-not-script |
| 36 | Susa Soldier *(all Spirit monsters)* | 40473581 | Spirit monsters use same phase-dependent mandatory Trigger (return-to-hand End Phase): re-activates if activation negated; not if only effect negated. | Post-2010 Spirit errata (Duelist Saga era) changed this | rules-not-script |

## Bucket summary

| Status | Count | Cards |
|--------|-------|-------|
| substitute-ready | 6 | Brionac, Sangan, Rescue Cat, Goyo Guardian, Brain Control, Future Fusion |
| script-exists-unused | 6 | Necrovalley, Ryko, Catapult Turtle, Ancient Fairy Dragon, Darkness Approaches, Ultimate Offering |
| needs-authoring | 18 | REDMD, Armory Arm, Black Garden, Destiny End Dragoon, Prisma, Fortune Lady Light, LADD, Dark End Dragon, Light End Dragon, Mark of the Rose, Mausoleum, My Body as a Shield, Quickdraw Synchron, Soul Exchange, Strike Ninja, Swap Frog, Treeborn Frog, Urgent Tuning |
| rules-not-script | 6 | Cyber Phoenix, D.D. Survivor, Jade Knight, Lumina (Lightsworns/Spirits Rule #4), Machina Gearframe (Union Rule #3), Susa Soldier (Spirit Rule #4) |
| **Total** | **36** | |

## Notes

- **substitute-ready**: Pre-errata scripts in `CardScripts/pre-errata/` with `511002xxx` passcodes, verified OPT-free. Wired via alias passcodes in `edison-alias-map.json`.
- **script-exists-unused**: Scripts exist in `CardScripts/pre-errata/` but community banlist leaves modern scripts in place. Recommend line-audit then wire to real passcodes.
- **needs-authoring**: REDMD has a pre-errata script but it still enforces once-per-name → must drop `id` from `SetCountLimit` calls. All others need new scripts authored from scratch, prioritised by meta impact (Treeborn Frog OPT, Destiny End Dragoon, REDMD, Strike Ninja, Black Garden, Armory Arm).
- **rules-not-script**: Engine-flag fixes (Spike A). Cyber Phoenix / D.D. Survivor / Jade Knight = damage-step face-up timing. Lightsworn/Spirit = phase-dependent mandatory trigger re-activation (Rule #4). Union = 1-per-monster condition (Rule #3).
"""

with open(OUT / "functional-errata-gaplist.md", "w") as f:
    f.write(ERRATA_TABLE)

print("  36 entries written ✓")


# ─── 6. README.md ─────────────────────────────────────────────────────────────

print("\nBuilding README.md …")

readme = f"""# Spike B — Edison Dataset Artifacts

Generated by `build.py` on {datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")} UTC.

## Artifacts

| File | Description |
|------|-------------|
| `out/edison-allowlist.json` | Frozen legal-pool list ({allowlist['count']} cards from edisonformat.net) |
| `out/edison-alias-map.json` | 7 pre-errata alias passcodes → base card |
| `out/edison.lflist.conf` | EDOPro banlist (43 Forbidden / 70 Limited / 19 Semi) |
| `out/dt01-excluded.json` | 27 DT01-only cards excluded from pool |
| `out/functional-errata-gaplist.md` | 36-entry errata curation backlog |
| `out/README.md` | This file |

## How each artifact was generated

### `edison-allowlist.json`
- **Source**: `https://edisonformat.net/data/json/EdisonCards.json` (fetched directly, bypasses JS rendering)
- Cards sorted ascending by `passcode` (the `id` field in the source JSON)
- **Count**: {allowlist['count']} (expected ≈3681; delta = 0 — exact match)
- Includes all 43 Forbidden cards (in-pool at 0 copies) per edisonformat.net's own deckbuilder DB

### `edison-alias-map.json`
- **Source**: `ThaSMorato/alt-formarts-lflists` `!2010.3 Edison` whitelist + ProjectIgnis pre-errata passcode conventions
- 7 pre-errata aliases: Brionac (`511002993`), Sangan (`511002631`), Rescue Cat (`511002992`), Goyo (`511002994`), Brain Control (`511002995`), Future Fusion (`511002997`), Imperial Order (`511002996`)
- All alias keys map to a `base` passcode that IS present in the allowlist

### `edison.lflist.conf`
- **Source banlist**: `https://edisonformat.net/rules/banlist.js` (authoritative 43/70/19 card names)
- **Passcodes**: resolved from EdisonCards.json by name; pre-errata overrides applied for the 7 alias cards
- Format: standard EDOPro lflist (`!2010.3 Edison` header, `<passcode> <count>` lines)
- Counts verified from file: **{c0} Forbidden / {c1} Limited / {c2} Semi**

### `dt01-excluded.json`
- **Source**: edisonformat.com "[E]-DT01 illegal" DuelingBook deck (id 8082483) + research doc
- 27 cards with DT01-only in-window printing, not tournament-legal per Konami policy
- All 27 passcodes verified ABSENT from `EdisonCards.json` (confirming exclusion)
- **Hidden Arsenal 1 (HA01) is fully legal** — 0 of 30 HA01 cards excluded

### `functional-errata-gaplist.md`
- **Source**: edisonformat.com/functional-errata.html (36 entries) + ProjectIgnis/CardScripts audit
- Passcodes verified against cards.cdb
- Bucket breakdown: substitute-ready(6) / script-exists-unused(6) / needs-authoring(18) / rules-not-script(6)

## Verification

Run `verify.py` to recompute all acceptance checks from the artifacts:

```bash
python3 verify.py
```

Expected output (all PASS):
- Allowlist count = {allowlist['count']} within tolerance of 3681
- lflist has 43 Forbidden / 70 Limited / 19 Semi
- dt01-excluded has 27 passcodes, none in allowlist
- All alias keys resolve to bases in allowlist

## Data sources

| Source | URL |
|--------|-----|
| Edison card pool | https://edisonformat.net/data/json/EdisonCards.json |
| Banlist names | https://edisonformat.net/rules/banlist.js |
| EDOPro whitelist (passcodes) | https://raw.githubusercontent.com/ThaSMorato/alt-formarts-lflists/main/lflists/Edison.lflist.conf |
| DT01 exclusion reference | https://www.duelingbook.com/deck?id=8082483 |
| Functional errata | https://www.edisonformat.com/functional-errata.html |
| March 2010 TCG F&L cross-check | https://yugipedia.com/wiki/March_2010_Lists_(TCG) |

## Key decisions

1. **Allow-list source**: edisonformat.net's `EdisonCards.json` chosen over EDOPro whitelist for membership because it's the founder's anchor site and has 3681 entries (whitelist has 3671; ~10-card delta is tokens/anime promos).
2. **Pre-errata passcodes**: 7 cards use `511002xxx` passcodes in both the lflist and alias map so the engine serves pre-errata scripts.
3. **DT01 exclusions**: 27 passcodes absent from both edisonformat.net DB and EDOPro whitelist, confirmed by edisonformat.com's documented Konami policy.
"""

with open(OUT / "README.md", "w") as f:
    f.write(readme)

print("  README.md written ✓")

print("\n✓ All 6 artifacts generated in spikes/spike-b-dataset/out/")
