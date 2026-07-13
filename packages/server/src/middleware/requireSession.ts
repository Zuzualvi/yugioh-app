import type { Request, Response, NextFunction } from "express";
import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Session resolution middleware.
// Reads the 'sid' cookie, looks up the session in SQLite, and attaches the
// user record to req.user. Returns 401 if no valid session.
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  displayName: string;
  role: "admin" | "member";
}

// Augment Express Request to carry the resolved user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

interface UserRow {
  id: string;
  display_name: string;
  role: string;
}

interface SessionRow {
  user_id: string;
  expires_at: string;
}

export function requireSession(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const sid = req.cookies?.sid as string | undefined;
    if (!sid) {
      res.status(401).json({ error: { code: "unauthenticated", message: "No session." } });
      return;
    }

    const session = db.prepare("SELECT user_id, expires_at FROM sessions WHERE sid = ?").get(sid) as SessionRow | undefined;
    if (!session) {
      res.status(401).json({ error: { code: "unauthenticated", message: "Invalid session." } });
      return;
    }

    if (new Date(session.expires_at) < new Date()) {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      res.status(401).json({ error: { code: "unauthenticated", message: "Session expired." } });
      return;
    }

    const user = db
      .prepare("SELECT id, display_name, role FROM users WHERE id = ?")
      .get(session.user_id) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ error: { code: "unauthenticated", message: "User not found." } });
      return;
    }

    req.user = { id: user.id, displayName: user.display_name, role: user.role as "admin" | "member" };
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
