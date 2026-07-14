#!/usr/bin/env bash
# build-wasm.sh — Build ocgcore WASM for the Edison engine package.
#
# Produces vendor/ocgcore-custom.sync.{mjs,wasm} (gitignored).
# Apply the LP-cost strict patch (rule #10) unconditionally — this WASM
# artifact is Edison-dedicated; the patch is applied via patches/ dir.
#
# Approach chosen: UNCONDITIONAL patch (not flag-gated).
#   Rationale: gating behind a new duel-flag bit would require modifying the
#   upstream C++ flag enum (adding a new flag constant) and the Lua script
#   interface — non-trivial and more fragile than a surgical 2-line patch.
#   Since our WASM is Edison-only, unconditional application is safer.
#
# Run from any directory; script self-locates.
# Requirements: git, python3 (for emsdk), network access (~290 MB emsdk download).
# Build time: ~100s on a fast machine.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR="$ENGINE_DIR/vendor"
PATCHES_DIR="$ENGINE_DIR/patches"

# ── Pinned versions ──────────────────────────────────────────────────────────
OCGCORE_WASM_REPO="https://github.com/n1xx1/ocgcore-wasm.git"
EDO9300_COMMIT="8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272"

echo "=== Edison Engine: ocgcore WASM build ==="
echo "Target edo9300 commit: $EDO9300_COMMIT"
echo "Output: $VENDOR/ocgcore-custom.sync.{mjs,wasm}"
echo ""

# ── Step 1: emsdk ────────────────────────────────────────────────────────────
if [ ! -d "$VENDOR/emsdk" ]; then
  echo "[1/6] Cloning emsdk..."
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$VENDOR/emsdk"
fi

echo "[2/6] Installing / activating emsdk latest..."
cd "$VENDOR/emsdk"
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh 2>/dev/null || true
export PATH="$VENDOR/emsdk/upstream/emscripten:$VENDOR/emsdk:$PATH"

emcc --version | head -1
echo ""

# ── Step 2: Clone ocgcore-wasm ───────────────────────────────────────────────
if [ ! -d "$VENDOR/ocgcore-wasm-src" ]; then
  echo "[3/6] Cloning n1xx1/ocgcore-wasm..."
  git clone "$OCGCORE_WASM_REPO" "$VENDOR/ocgcore-wasm-src"
fi

cd "$VENDOR/ocgcore-wasm-src"
echo "[3/6] n1xx1/ocgcore-wasm HEAD: $(git rev-parse HEAD)"

# ── Step 3: Init submodules ──────────────────────────────────────────────────
if [ ! -f "cpp/ygo/ocgapi.h" ]; then
  echo "[4/6] Initializing submodules..."
  git submodule update --init --depth 1
fi

ACTUAL_COMMIT="$(cd cpp/ygo && git rev-parse HEAD)"
echo "[4/6] edo9300/ygopro-core submodule commit: $ACTUAL_COMMIT"
if [ "$ACTUAL_COMMIT" != "$EDO9300_COMMIT" ]; then
  echo "WARNING: submodule commit differs from pinned ($EDO9300_COMMIT)"
fi

if ! grep -q "TCG_FAST_EFFECT_IGNITION" cpp/ygo/ocgapi_constants.h; then
  echo "ERROR: TCG_FAST_EFFECT_IGNITION not found — aborting."
  exit 1
fi
echo "  [OK] TCG_FAST_EFFECT_IGNITION present"

# ── Step 4: Apply LP-cost strict patch (rule #10, unconditional) ─────────────
echo ""
echo "[5/6] Applying LP-cost strict patch (Edison rule #10)..."
echo "  Strategy: UNCONDITIONAL (see patches/ocgcore-lp-cost-strict.patch)"
echo "  Changes: check_lp_cost + PayLPCost: val <= lp  →  val < lp"
echo "  (Forbids paying LP cost that reduces LP to exactly 0)"
patch -p1 < "$PATCHES_DIR/ocgcore-lp-cost-strict.patch" || {
  echo "  Patch already applied or failed — checking..."
  if grep -q "val < player\[playerid\]\.lp" cpp/ygo/field.cpp; then
    echo "  Already patched (idempotent). Continuing."
  else
    echo "ERROR: Patch failed and file is not already patched. Aborting."
    exit 1
  fi
}
echo "  [OK] LP-cost patch applied"

# ── Step 5: Build sync WASM ──────────────────────────────────────────────────
echo ""
echo "[6/6] Building sync WASM..."
mkdir -p "$VENDOR"

FILES_YGO="./cpp/ygo/card.cpp ./cpp/ygo/duel.cpp ./cpp/ygo/effect.cpp ./cpp/ygo/field.cpp \
  ./cpp/ygo/interpreter.cpp ./cpp/ygo/libcard.cpp ./cpp/ygo/libdebug.cpp ./cpp/ygo/libduel.cpp \
  ./cpp/ygo/libeffect.cpp ./cpp/ygo/libgroup.cpp ./cpp/ygo/ocgapi.cpp ./cpp/ygo/operations.cpp \
  ./cpp/ygo/playerop.cpp ./cpp/ygo/processor_visit.cpp ./cpp/ygo/processor.cpp ./cpp/ygo/scriptlib.cpp"

FILES_LUA="./cpp/lua/lapi.c ./cpp/lua/lauxlib.c ./cpp/lua/lbaselib.c ./cpp/lua/lcode.c \
  ./cpp/lua/lcorolib.c ./cpp/lua/lctype.c ./cpp/lua/ldblib.c ./cpp/lua/ldebug.c \
  ./cpp/lua/ldo.c ./cpp/lua/ldump.c ./cpp/lua/lfunc.c ./cpp/lua/lgc.c ./cpp/lua/linit.c \
  ./cpp/lua/liolib.c ./cpp/lua/llex.c ./cpp/lua/lmathlib.c ./cpp/lua/lmem.c \
  ./cpp/lua/loadlib.c ./cpp/lua/lobject.c ./cpp/lua/lopcodes.c ./cpp/lua/loslib.c \
  ./cpp/lua/lparser.c ./cpp/lua/lstate.c ./cpp/lua/lstring.c ./cpp/lua/lstrlib.c \
  ./cpp/lua/ltable.c ./cpp/lua/ltablib.c ./cpp/lua/ltm.c ./cpp/lua/lundump.c \
  ./cpp/lua/lutf8lib.c ./cpp/lua/lvm.c ./cpp/lua/lzio.c"

BUILD_START=$(date +%s)

em++ \
  -Os -g0 --closure 1 -sASSERTIONS=0 \
  -sMODULARIZE=1 -sALLOW_MEMORY_GROWTH=1 -sMALLOC=emmalloc \
  -fwasm-exceptions -sSUPPORT_LONGJMP=wasm \
  -fno-rtti \
  -sNO_EXIT_RUNTIME=1 \
  -sENVIRONMENT=node \
  "-sEXPORTED_FUNCTIONS=['_malloc','_free']" \
  "-sEXPORTED_RUNTIME_METHODS=['stackSave','stackRestore','stackAlloc','getValue','stringToUTF8','lengthBytesUTF8','HEAP8','HEAPU8']" \
  -I./cpp/lua \
  $FILES_LUA \
  $FILES_YGO \
  ./cpp/wasm.cpp \
  -o "$VENDOR/ocgcore-custom.sync.mjs"

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo ""
echo "=== Build complete ==="
echo "Time:    ${BUILD_TIME}s"
echo "WASM:    $(du -h "$VENDOR/ocgcore-custom.sync.wasm" | cut -f1) — vendor/ocgcore-custom.sync.wasm"
echo "JS shim: $(du -h "$VENDOR/ocgcore-custom.sync.mjs"  | cut -f1) — vendor/ocgcore-custom.sync.mjs"
echo ""
echo "To activate: the engine automatically loads from vendor/ at runtime."
echo "EDISON_FLAGS = 0x7f80d072cn (MODE_GOAT | TCG_FAST_EFFECT_IGNITION)"
