import type { Request, Response, NextFunction } from "express";
import Database from "better-sqlite3";
import { resolveSessionUser } from "./resolveSessionUser.js";
export type { SessionUser } from "./resolveSessionUser.js";

// ---------------------------------------------------------------------------
// Session resolution middleware.
// Reads the 'sid' cookie, looks up the session in SQLite, and attaches the
// user record to req.user. Returns 401 if no valid session.
// ---------------------------------------------------------------------------

// Augment Express Request to carry the resolved user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: import("./resolveSessionUser.js").SessionUser;
    }
  }
}

export function requireSession(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sid = req.cookies?.sid as string | undefined;
    if (!sid) {
      res.status(401).json({ error: { code: "unauthenticated", message: "No session." } });
      return;
    }

    const user = resolveSessionUser(db, sid);
    if (!user) {
      res.status(401).json({ error: { code: "unauthenticated", message: "Invalid session." } });
      return;
    }

    req.user = user;
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "forbidden", message: "Admin access required." } });
    return;
  }
  next();
}
