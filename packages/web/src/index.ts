import type { WsMessage } from "@yugioh-app/contracts";

// ---------------------------------------------------------------------------
// Web package stub
// The real React app wiring (Vite entry, router, components) lives in later
// specs. Only contracts is imported here — never server or engine.
// ---------------------------------------------------------------------------

/**
 * Format a WebSocket message for display in the UI.
 * Pure utility — no framework dependency.
 */
export function formatMessage(message: WsMessage): string {
  return `[${new Date(message.timestamp * 1000).toISOString()}] ${message.kind}`;
}
