import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// requireOpsToken — bearer-token middleware for the /api/ops mount.
//
// Auth scheme: Authorization: Bearer <token>
// Token source: process.env["OPS_ADMIN_TOKEN"] (Fly secret, set by deploy pipeline)
//
// Unset/empty → 503 ops_disabled  (keeps the endpoint harmless before the
//   secret is provisioned — the server safely advertises "not configured"
//   rather than denying or silently returning 401 for an unknown reason)
// Missing/malformed header → 401 unauthenticated
// Wrong token → 401 unauthenticated
// Length mismatch must NOT throw from timingSafeEqual — check lengths first.
//
// NEVER log, echo, or include the token value in any response.
// ---------------------------------------------------------------------------

export function requireOpsToken(req: Request, res: Response, next: NextFunction): void {
  const configured = process.env["OPS_ADMIN_TOKEN"];
  if (!configured) {
    res.status(503).json({
      error: { code: "ops_disabled", message: "Ops API is not configured." },
    });
    return;
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "unauthenticated", message: "Ops credential required." },
    });
    return;
  }

  const provided = authHeader.slice("Bearer ".length);

  const configuredBuf = Buffer.from(configured, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  // timingSafeEqual throws if buffers have different lengths — compare first.
  if (configuredBuf.length !== providedBuf.length) {
    res.status(401).json({
      error: { code: "unauthenticated", message: "Ops credential required." },
    });
    return;
  }

  if (!timingSafeEqual(configuredBuf, providedBuf)) {
    res.status(401).json({
      error: { code: "unauthenticated", message: "Ops credential required." },
    });
    return;
  }

  next();
}
