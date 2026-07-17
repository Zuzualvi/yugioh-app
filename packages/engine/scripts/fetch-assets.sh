#!/usr/bin/env bash
# fetch-assets.sh — Fetch card database and Lua scripts for the Edison engine.
#
# Produces:
#   assets/cards.cdb                   — ProjectIgnis/BabelCDB card database
#   assets/scripts/c0.lua              — Synthetic system bootstrap (constant+utility+chain+proc_*)
#   assets/scripts/*.lua               — Individual system scripts (constant.lua, utility.lua, …)
#   assets/scripts/official/<name>     — Official card scripts
#   assets/scripts/pre-errata/<name>   — Pre-errata overrides (slice 40 backlog)
#   assets/scripts/goat/<name>         — Goat-format scripts
#
# Pinned sources:
#   BabelCDB  @ 736536e0ce8bb1fafc798aea641631c690db9e83
#   CardScripts @ 105d350039ee58a2e465ca8d9fe19b673107f921
#
# Run from any directory; script self-locates.
# Requirements: git, curl, network access.
# Idempotent: re-running skips already-present files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$ENGINE_DIR/assets"

# ── Pinned commits ────────────────────────────────────────────────────────────
BABEL_COMMIT="736536e0ce8bb1fafc798aea641631c690db9e83"
CARDSCRIPTS_COMMIT="105d350039ee58a2e465ca8d9fe19b673107f921"

BABEL_URL="https://github.com/ProjectIgnis/BabelCDB/raw/${BABEL_COMMIT}/cards.cdb"
BABEL_UNOFFICIAL_URL="https://github.com/ProjectIgnis/BabelCDB/raw/${BABEL_COMMIT}/cards-unofficial.cdb"
CARDSCRIPTS_URL="https://github.com/ProjectIgnis/CardScripts.git"

echo "=== Edison Engine: asset fetch ==="
echo "BabelCDB commit:    $BABEL_COMMIT"
echo "CardScripts commit: $CARDSCRIPTS_COMMIT"
echo "Output:             $ASSETS_DIR"
echo ""

# ── Create directory structure ────────────────────────────────────────────────
mkdir -p "$ASSETS_DIR/scripts/official"
mkdir -p "$ASSETS_DIR/scripts/pre-errata"
mkdir -p "$ASSETS_DIR/scripts/goat"

# ── Step 1: cards.cdb ─────────────────────────────────────────────────────────
CDB_PATH="$ASSETS_DIR/cards.cdb"
if [ -f "$CDB_PATH" ]; then
  echo "[1/3] cards.cdb already present — skipping download."
else
  echo "[1/3] Downloading BabelCDB cards.cdb..."
  curl -fsSL "$BABEL_URL" -o "$CDB_PATH"
  echo "      Done: $(du -h "$CDB_PATH" | cut -f1)"
fi

# ── Step 1b: Merge cards-unofficial.cdb into cards.cdb ───────────────────────
# cards-unofficial.cdb contains pre-errata 511xxx passcode entries (with alias
# pointing to the official passcode). These are required to load DROPIN override
# scripts like c511002993.lua. INSERT OR IGNORE preserves all official rows.
UNOFFICIAL_MERGED_MARKER="$ASSETS_DIR/.unofficial-merged"
if [ -f "$UNOFFICIAL_MERGED_MARKER" ]; then
  echo "[1b] cards-unofficial.cdb already merged — skipping."
else
  echo "[1b] Downloading and merging cards-unofficial.cdb..."
  UNOFFICIAL_TMP="$(mktemp --suffix=.cdb)"
  curl -fsSL "$BABEL_UNOFFICIAL_URL" -o "$UNOFFICIAL_TMP"
  python3 - "$UNOFFICIAL_TMP" "$CDB_PATH" <<'PYEOF'
import sqlite3, sys
src_path, dst_path = sys.argv[1], sys.argv[2]
src = sqlite3.connect(src_path)
dst = sqlite3.connect(dst_path)
with dst:
    for row in src.execute("SELECT * FROM datas"):
        dst.execute(
            "INSERT OR IGNORE INTO datas VALUES (" + ",".join("?" * len(row)) + ")",
            row,
        )
    for row in src.execute("SELECT * FROM texts"):
        dst.execute(
            "INSERT OR IGNORE INTO texts VALUES (" + ",".join("?" * len(row)) + ")",
            row,
        )
src.close()
dst.close()
print(f"Merged unofficial entries into {dst_path}")
PYEOF
  rm -f "$UNOFFICIAL_TMP"
  touch "$UNOFFICIAL_MERGED_MARKER"
  echo "      Merge complete."
fi

# ── Step 2: Clone CardScripts ─────────────────────────────────────────────────
CLONE_DIR="$(mktemp -d)"
trap 'rm -rf "$CLONE_DIR"' EXIT

echo "[2/3] Cloning CardScripts @ ${CARDSCRIPTS_COMMIT:0:7}..."
git clone --quiet --depth 1 "$CARDSCRIPTS_URL" "$CLONE_DIR"
git -C "$CLONE_DIR" fetch --depth 1 origin 105d350039ee58a2e465ca8d9fe19b673107f921
git -C "$CLONE_DIR" checkout --quiet 105d350039ee58a2e465ca8d9fe19b673107f921
ACTUAL_COMMIT="$(git -C "$CLONE_DIR" rev-parse HEAD)"
if [ "$ACTUAL_COMMIT" != "$CARDSCRIPTS_COMMIT" ]; then
  echo "ERROR: CardScripts HEAD ($ACTUAL_COMMIT) does not match pinned ($CARDSCRIPTS_COMMIT). Aborting."
  exit 1
fi
echo "      Cloned @ $ACTUAL_COMMIT"

# ── Step 3: Assemble scripts ──────────────────────────────────────────────────
echo "[3/3] Assembling scripts..."

# 3a. Synthesize c0.lua (engine requests this first; concatenation of all system scripts)
# c0.lua is the bootstrap loaded by the engine on duel init. It must define all
# constants, utility functions, chain helpers, and procedure templates.
C0_PATH="$ASSETS_DIR/scripts/c0.lua"
if [ -f "$C0_PATH" ]; then
  echo "      c0.lua already present — skipping synthesis."
else
  echo "      Synthesizing c0.lua from system scripts..."
  C0_SOURCES=(
    "$CLONE_DIR/constant.lua"
    "$CLONE_DIR/utility.lua"
    "$CLONE_DIR/chain.lua"
    "$CLONE_DIR/proc_normal.lua"
    "$CLONE_DIR/proc_ritual.lua"
    "$CLONE_DIR/proc_fusion.lua"
    "$CLONE_DIR/proc_fusion_spell.lua"
    "$CLONE_DIR/proc_synchro.lua"
    "$CLONE_DIR/proc_xyz.lua"
    "$CLONE_DIR/proc_link.lua"
    "$CLONE_DIR/proc_pendulum.lua"
    "$CLONE_DIR/proc_maximum.lua"
    "$CLONE_DIR/proc_gemini.lua"
    "$CLONE_DIR/proc_spirit.lua"
    "$CLONE_DIR/proc_union.lua"
    "$CLONE_DIR/proc_equip.lua"
    "$CLONE_DIR/proc_persistent.lua"
    "$CLONE_DIR/proc_rush.lua"
    "$CLONE_DIR/proc_skill.lua"
    "$CLONE_DIR/proc_workaround.lua"
    "$CLONE_DIR/cards_specific_functions.lua"
    "$CLONE_DIR/card_counter_constants.lua"
    "$CLONE_DIR/archetype_setcode_constants.lua"
  )
  : > "$C0_PATH"
  for f in "${C0_SOURCES[@]}"; do
    cat "$f" >> "$C0_PATH"
    printf '\n' >> "$C0_PATH"
  done
  echo "      c0.lua: $(wc -c < "$C0_PATH") bytes"
fi

# 3b. Copy individual system scripts (engine may also request by individual name)
SYSTEM_SCRIPTS=(
  constant.lua utility.lua chain.lua
  proc_normal.lua proc_ritual.lua proc_fusion.lua proc_fusion_spell.lua
  proc_synchro.lua proc_xyz.lua proc_link.lua proc_pendulum.lua proc_maximum.lua
  proc_gemini.lua proc_spirit.lua proc_union.lua proc_equip.lua proc_persistent.lua
  proc_rush.lua proc_skill.lua proc_workaround.lua
  cards_specific_functions.lua card_counter_constants.lua archetype_setcode_constants.lua
)
for script in "${SYSTEM_SCRIPTS[@]}"; do
  dest="$ASSETS_DIR/scripts/$script"
  if [ ! -f "$dest" ]; then
    cp "$CLONE_DIR/$script" "$dest" 2>/dev/null || true
  fi
done
echo "      System scripts copied."

# 3c. Card scripts — official/
OFFICIAL_COUNT=0
for f in "$CLONE_DIR/official/"*.lua; do
  dest="$ASSETS_DIR/scripts/official/$(basename "$f")"
  if [ ! -f "$dest" ]; then
    cp "$f" "$dest"
    OFFICIAL_COUNT=$((OFFICIAL_COUNT + 1))
  fi
done
TOTAL_OFFICIAL=$(ls "$ASSETS_DIR/scripts/official/" | wc -l)
echo "      Official: $OFFICIAL_COUNT new, $TOTAL_OFFICIAL total"

# 3d. Card scripts — pre-errata/
PREERRATA_COUNT=0
for f in "$CLONE_DIR/pre-errata/"*.lua; do
  dest="$ASSETS_DIR/scripts/pre-errata/$(basename "$f")"
  if [ ! -f "$dest" ]; then
    cp "$f" "$dest"
    PREERRATA_COUNT=$((PREERRATA_COUNT + 1))
  fi
done
TOTAL_PREERRATA=$(ls "$ASSETS_DIR/scripts/pre-errata/" | wc -l)
echo "      Pre-errata: $PREERRATA_COUNT new, $TOTAL_PREERRATA total"

# 3e. Card scripts — goat/
GOAT_COUNT=0
for f in "$CLONE_DIR/goat/"*.lua; do
  dest="$ASSETS_DIR/scripts/goat/$(basename "$f")"
  if [ ! -f "$dest" ]; then
    cp "$f" "$dest"
    GOAT_COUNT=$((GOAT_COUNT + 1))
  fi
done
TOTAL_GOAT=$(ls "$ASSETS_DIR/scripts/goat/" | wc -l)
echo "      Goat: $GOAT_COUNT new, $TOTAL_GOAT total"

echo ""
echo "=== fetch-assets complete ==="
echo "  cards.cdb:                    $(du -h "$ASSETS_DIR/cards.cdb" | cut -f1)"
echo "  assets/scripts/c0.lua:        $(wc -c < "$ASSETS_DIR/scripts/c0.lua") bytes"
echo "  assets/scripts/official/:     $TOTAL_OFFICIAL scripts"
echo "  assets/scripts/pre-errata/:   $TOTAL_PREERRATA scripts"
echo "  assets/scripts/goat/:         $TOTAL_GOAT scripts"
echo ""
echo "To rebuild WASM: bash packages/engine/scripts/build-wasm.sh"
echo "To run tests:    cd packages/engine && npx vitest run"
