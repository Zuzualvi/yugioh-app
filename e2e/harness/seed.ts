// ---------------------------------------------------------------------------
// E2E seed — two members + one Edison-legal deck each, for the Playwright
// same-origin duel harness. Idempotent (skips users that already exist).
// ---------------------------------------------------------------------------

import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";

export const E2E_USERS = [
  { displayName: "e2e_alice", password: "e2e-pass-12345" },
  { displayName: "e2e_bob", password: "e2e-pass-12345" },
] as const;

// Verified Edison-legal 40-card main deck: all Normal-frame, unlimited, in pool,
// <=3 copies each. (Generated from packages/card-data/out/edison-card-catalog.json.)
const DECK40 = [
  32864, 32864, 32864, 487395, 487395, 487395, 549481, 549481, 549481, 732302, 732302, 732302,
  1184620, 1184620, 1184620, 1761063, 1761063, 1761063, 1784619, 1784619, 1784619, 2118022, 2118022,
  2118022, 2311603, 2311603, 2311603, 2468169, 2468169, 2468169, 2483611, 2483611, 2483611, 2830619,
  2830619, 2830619, 2863439, 2863439, 2863439, 2964201,
];

export async function seedE2E(db: InstanceType<typeof Database>): Promise<void> {
  const now = new Date().toISOString();
  for (const { displayName, password } of E2E_USERS) {
    const existing = db.prepare("SELECT id FROM users WHERE display_name = ?").get(displayName) as
      { id: string } | undefined;
    if (existing) continue;

    const userId = randomUUID();
    const passwordHash = await hash(password);
    db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
    ).run(userId, displayName, passwordHash, now);

    db.prepare(
      `INSERT INTO decks
         (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at)
       VALUES (?, ?, ?, ?, '[]', '[]', 1, ?, ?)`,
    ).run(randomUUID(), userId, "E2E Test Deck", JSON.stringify(DECK40), now, now);
  }
}
