import { z } from "zod";

// ---------------------------------------------------------------------------
// WebSocket message envelope — used by the engine adapter boundary.
// Kept for backward compatibility with packages/engine.
// ---------------------------------------------------------------------------

export const WsMessageSchema = z.object({
  kind: z.enum(["duel.start", "duel.action", "duel.end"]),
  payload: z.unknown(),
  timestamp: z.number().int().positive(),
});

export type WsMessage = z.infer<typeof WsMessageSchema>;
