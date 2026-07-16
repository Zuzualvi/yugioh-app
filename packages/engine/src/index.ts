// ---------------------------------------------------------------------------
// @yugioh-app/engine — public surface
//
// Server-side Edison duel core wrapping ocgcore-wasm.
// Web MUST NOT import this package. Server imports contracts + engine only.
//
// Custom WASM required: run packages/engine/scripts/build-wasm.sh first.
// ---------------------------------------------------------------------------

// Public API (R4 — LOCKED, server codes against this)
export { createEdisonDuel } from "./createEdisonDuel.js";
export { replayEdisonDuel } from "./replayEdisonDuel.js";
export { EdisonDuel } from "./EdisonDuel.js";
export type { DeckLists, EngineStepResult, CreateEdisonDuelOpts } from "./EdisonDuel.js";

// Engine-internal message type (kept in engine, NOT in contracts)
export type { RawEngineMessage } from "./types.js";

// Flags (useful for testing / debugging)
export { EDISON_FLAGS } from "./edisonFlags.js";

// Core availability check (useful for health-check routes)
export { isCustomWasmAvailable } from "./coreFactory.js";

// Redaction utility (server may call this directly on each outgoing message)
export { redactMessageForSeat } from "./redactMessage.js";

// Phase 1 decision adapter (exported for testing and potential server use)
export { messageToDecision } from "./decision/messageToDecision.js";
export { responseToOcgResponse } from "./decision/responseToOcgResponse.js";
export { validateDecisionResponse } from "./decision/validateDecisionResponse.js";
