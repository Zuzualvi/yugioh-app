// ---------------------------------------------------------------------------
// Engine-internal types — NOT exported from contracts.
// RawEngineMessage is the UN-redacted form from ocgcore-wasm.
// ---------------------------------------------------------------------------

/** UN-redacted engine message exactly as returned by duelProcess(). */
export interface RawEngineMessage {
  type: number;
  /** Player field — present on decision/reveal/player-targeted messages. */
  player?: 0 | 1;
  /** All message-specific payload fields. */
  [key: string]: unknown;
}
