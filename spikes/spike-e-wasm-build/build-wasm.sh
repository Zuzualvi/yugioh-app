#!/usr/bin/env bash
# build-wasm.sh — Build ocgcore WASM from edo9300/ygopro-core + n1xx1/ocgcore-wasm
# Reproducible. Run from the spike-e-wasm-build/ directory.
# Output: vendor/ocgcore-wasm/lib/ocgcore.sync.{mjs,wasm}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR="$SCRIPT_DIR/vendor"

# ── Pinned versions ──────────────────────────────────────────────────────────
# n1xx1/ocgcore-wasm repo: branch main, HEAD at build time
OCGCORE_WASM_REPO="https://github.com/n1xx1/ocgcore-wasm.git"
# edo9300/ygopro-core: the submodule commit at n1xx1/ocgcore-wasm HEAD
# Both commits are recorded in REPORT.md
EDO9300_COMMIT="8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272"

echo "=== Spike E: ocgcore WASM build ==="
echo "Target edo9300 commit: $EDO9300_COMMIT"
echo "Output: $VENDOR/ocgcore-wasm/lib/ocgcore.sync.{mjs,wasm}"
echo ""

# ── Step 1: emsdk ───────────────────────────────────────────────────────────
if [ ! -d "$VENDOR/emsdk" ]; then
  echo "[1/5] Cloning emsdk..."
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$VENDOR/emsdk"
fi

echo "[2/5] Installing / activating emsdk latest..."
cd "$VENDOR/emsdk"
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh 2>/dev/null || true
export PATH="$VENDOR/emsdk/upstream/emscripten:$VENDOR/emsdk:$PATH"

emcc --version | head -1
echo ""

# ── Step 2: Clone ocgcore-wasm ───────────────────────────────────────────────
if [ ! -d "$VENDOR/ocgcore-wasm" ]; then
  echo "[3/5] Cloning n1xx1/ocgcore-wasm..."
  git clone "$OCGCORE_WASM_REPO" "$VENDOR/ocgcore-wasm"
fi

cd "$VENDOR/ocgcore-wasm"
echo "[3/5] n1xx1/ocgcore-wasm HEAD: $(git rev-parse HEAD)"

# ── Step 3: Init submodules (lua 5.3 + edo9300 ygopro-core) ─────────────────
if [ ! -f "cpp/ygo/ocgapi.h" ]; then
  echo "[4/5] Initializing submodules..."
  git submodule update --init --depth 1
fi

# Verify the edo9300 commit
ACTUAL_COMMIT="$(cd cpp/ygo && git rev-parse HEAD)"
echo "[4/5] edo9300/ygopro-core submodule commit: $ACTUAL_COMMIT"
if [ "$ACTUAL_COMMIT" != "$EDO9300_COMMIT" ]; then
  echo "WARNING: submodule commit differs from pinned ($EDO9300_COMMIT)"
  echo "  Pinned commit had TCG_FAST_EFFECT_IGNITION. Current may differ."
fi

# Verify TCG_FAST_EFFECT_IGNITION is present
if ! grep -q "TCG_FAST_EFFECT_IGNITION" cpp/ygo/ocgapi_constants.h; then
  echo "ERROR: TCG_FAST_EFFECT_IGNITION not found in ocgapi_constants.h!"
  echo "       This commit lacks GY ignition priority support. Aborting."
  exit 1
fi
echo "  [OK] TCG_FAST_EFFECT_IGNITION found in ocgapi_constants.h"

# ── Step 4: Build sync WASM ──────────────────────────────────────────────────
echo ""
echo "[5/5] Building sync WASM..."
mkdir -p lib

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
  -sENVIRONMENT=web \
  "-sEXPORTED_FUNCTIONS=['_malloc','_free']" \
  "-sEXPORTED_RUNTIME_METHODS=['stackSave','stackRestore','stackAlloc','getValue','stringToUTF8','lengthBytesUTF8','HEAP8','HEAPU8']" \
  -I./cpp/lua \
  $FILES_LUA \
  $FILES_YGO \
  ./cpp/wasm.cpp \
  -o lib/ocgcore.sync.mjs

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo ""
echo "=== Build complete ==="
echo "Time:    ${BUILD_TIME}s"
echo "WASM:    $(du -h lib/ocgcore.sync.wasm | cut -f1) — lib/ocgcore.sync.wasm"
echo "JS shim: $(du -h lib/ocgcore.sync.mjs  | cut -f1) — lib/ocgcore.sync.mjs"
echo ""
echo "To use in your Node project:"
echo "  Copy lib/ocgcore.sync.wasm and lib/ocgcore.sync.mjs into your"
echo "  node_modules/ocgcore-wasm/lib/ directory, replacing the 0.1.2 prebuilt files."
echo ""
echo "Edison flags (use raw BigInt — TCG_FAST_EFFECT_IGNITION not in JS constants):"
echo "  const EDISON_FLAGS = OcgDuelMode.MODE_GOAT | 0x400000000n; // 0x7f80d072c"
