import type { WsMessage } from "@yugioh-app/contracts";
import type { OcgCoreAdapter } from "@yugioh-app/engine";

// ---------------------------------------------------------------------------
// Server entry-point stub
// The real HTTP / WebSocket server wiring lives in a later spec.
// ---------------------------------------------------------------------------

/** Minimal server configuration (placeholder). */
export interface ServerConfig {
  port: number;
  adapter: OcgCoreAdapter;
}

/**
 * Placeholder function that wires a WebSocket message into the engine.
 * Full implementation comes in a later spec.
 */
export function handleMessage(config: ServerConfig, message: WsMessage): Promise<void> {
  return config.adapter.processMessage(message).then(() => undefined);
}
