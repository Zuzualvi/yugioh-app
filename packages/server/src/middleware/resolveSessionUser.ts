// ---------------------------------------------------------------------------
// resolveSessionUser — Resolves a session id to a user record.
// Extracted from requireSession so WS handshakes can reuse the logic.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";

export interface SessionUser {
  id: string;
  displayName: string;
  role: "admin" | "member";
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

export function resolveSessionUser(
  db: InstanceType<typeof Database>,
  sid: string,
): SessionUser | null {
  const session = db.prepare("SELECT user_id, expires_at FROM sessions WHERE sid = ?").get(sid) as
    SessionRow | undefined;
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
    return null;
  }

  const user = db
    .prepare("SELECT id, display_name, role FROM users WHERE id = ?")
    .get(session.user_id) as UserRow | undefined;
  if (!user) return null;

  return {
    id: user.id,
    displayName: user.display_name,
    role: user.role as "admin" | "member",
  };
}
