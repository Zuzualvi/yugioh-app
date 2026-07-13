import { z } from "zod";

// ---------------------------------------------------------------------------
// Placeholder domain types
// ---------------------------------------------------------------------------

/** A player in a duel (placeholder — full type defined in a later spec). */
export interface Player {
  id: string;
  name: string;
}

/** Supported WebSocket message kinds (stub — details TBD in spec). */
export type MessageKind = "duel.start" | "duel.action" | "duel.end";

// ---------------------------------------------------------------------------
// Zod schemas (WebSocket message contract — pinned in spec, not invented)
// ---------------------------------------------------------------------------

/** Schema for the outer WebSocket envelope every message must conform to. */
export const WsMessageSchema = z.object({
  kind: z.enum(["duel.start", "duel.action", "duel.end"]),
  payload: z.unknown(),
  timestamp: z.number().int().positive(),
});

export type WsMessage = z.infer<typeof WsMessageSchema>;
