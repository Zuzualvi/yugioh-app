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

const CUSTOM_WASM_PATH =
  process.env["EDISON_WASM_PATH"] ?? resolve(__dir, "../vendor/ocgcore-custom.sync.wasm");

/** Cached WASM bytes (read once from disk; reused across all createEdisonCore calls). */
let _wasmBytes: ArrayBuffer | null = null;

function getWasmBytes(): ArrayBuffer {
  if (_wasmBytes) return _wasmBytes;
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
  _wasmBytes = readFileSync(CUSTOM_WASM_PATH).buffer as ArrayBuffer;
  return _wasmBytes;
}

/**
 * Create a fresh, isolated ocgcore core instance for ONE duel.
 * Each call returns a brand-new core so duel Lua states never share memory.
 * The WASM bytes are read from disk only once and reused across calls.
 */
export async function createEdisonCore(): Promise<OcgCoreSync> {
  const wasmBinary = getWasmBytes();
  return createCore({ sync: true, wasmBinary });
}

/** True if the custom-built WASM exists in vendor/. */
export function isCustomWasmAvailable(): boolean {
  return existsSync(CUSTOM_WASM_PATH);
}
