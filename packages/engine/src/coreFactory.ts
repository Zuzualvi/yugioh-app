// ---------------------------------------------------------------------------
// ocgcore-wasm factory — loads the CUSTOM-built WASM if present in vendor/,
// otherwise throws with a clear message (do NOT fall back to stock 0.1.2,
// which ignores the 64-bit TCG_FAST_EFFECT_IGNITION flag).
//
// Run packages/engine/scripts/build-wasm.sh to produce the custom artifact.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import createCore from "ocgcore-wasm";
import type { OcgCoreSync } from "ocgcore-wasm";

const __dir = dirname(fileURLToPath(import.meta.url));

const CUSTOM_WASM_PATH = resolve(__dir, "../vendor/ocgcore-custom.sync.wasm");

let _corePromise: Promise<OcgCoreSync> | null = null;

/** Load the Edison-patched sync core (lazy singleton). */
export async function loadEdisonCore(): Promise<OcgCoreSync> {
  if (_corePromise) return _corePromise;
  _corePromise = (async () => {
    if (!existsSync(CUSTOM_WASM_PATH)) {
      throw new Error(
        "Custom ocgcore WASM not found at " +
          CUSTOM_WASM_PATH +
          ".\n" +
          "Run packages/engine/scripts/build-wasm.sh to build it.\n" +
          "The stock ocgcore-wasm@0.1.2 prebuilt CANNOT be used — it ignores\n" +
          "the 64-bit TCG_FAST_EFFECT_IGNITION flag (emscripten 64-bit bug).",
      );
    }

    const wasmBinary = readFileSync(CUSTOM_WASM_PATH).buffer as ArrayBuffer;
    const core = await createCore({ sync: true, wasmBinary });
    return core;
  })();
  return _corePromise;
}

/** True if the custom-built WASM exists in vendor/. */
export function isCustomWasmAvailable(): boolean {
  return existsSync(CUSTOM_WASM_PATH);
}
