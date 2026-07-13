import type { WsMessage } from "@yugioh-app/contracts";

// ---------------------------------------------------------------------------
// Adapter boundary — the engine talks to an ocgcore process behind this
// interface. Implementation lives in a later spec.
// ---------------------------------------------------------------------------

/** The result returned after the engine processes one game action. */
export interface EngineResult {
  success: boolean;
  newState: unknown;
}

/**
 * Adapter interface that every ocgcore binding must implement.
 * Depends only on the contracts package — no server or web imports allowed.
 */
export interface OcgCoreAdapter {
  /** Process an incoming duel action and return the updated game state. */
  processMessage(message: WsMessage): Promise<EngineResult>;
  /** Gracefully shut down the underlying engine process. */
  dispose(): Promise<void>;
}
