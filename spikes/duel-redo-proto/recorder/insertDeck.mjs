// Inserts a "ZUH121 Deck" for both e2e users, directly into the
// harness sqlite DB. No repo source is modified. Deck is Edison-legal
// (validated by the server's own validateDeck at room-ready).
import { createRequire } from "node:module";
const require = createRequire("/tmp/1786580109-24621-ygo/repo/package.json");
const Database = require("better-sqlite3");
import { randomUUID } from "node:crypto";

const DB = process.env.DB_PATH ?? "/tmp/zuh121.db";
const NAME = "ZUH121 Deck";

const MAIN = [
  ...Array(3).fill(9748752), // Caius the Shadow Monarch  L6 trigger (banish target)
  ...Array(3).fill(4929256), // Mobius the Frost Monarch  L6 trigger
  ...Array(3).fill(73125233), // Raiza the Storm Monarch   L6 trigger
  ...Array(3).fill(51945556), // Zaborg the Thunder Monarch L5 trigger
  ...Array(3).fill(71564252), // Thunder King Rai-Oh       L4
  ...Array(3).fill(1184620), // Kojikocy                  L4 vanilla
  ...Array(3).fill(1784619), // Uraby                     L4 vanilla
  ...Array(3).fill(2311603), // Overdrive                 L4 vanilla
  ...Array(3).fill(2118022), // Hyosube                   L4 vanilla
  ...Array(3).fill(70342110), // Dimensional Prison  trap
  ...Array(2).fill(29401950), // Bottomless Trap Hole trap
  53582587, // Torrential Tribute
  41420027, // Solemn Judgment
  44095762, // Mirror Force
  ...Array(3).fill(14087893), // Book of Moon (quick-play, chain from hand)
  5318639, // Mystical Space Typhoon
  19613556, // Heavy Storm
];

if (MAIN.length !== 40) throw new Error("main deck must be 40, got " + MAIN.length);

const db = new Database(DB);
const now = new Date().toISOString();
const users = db.prepare("SELECT id, display_name FROM users").all();
for (const u of users) {
  const existing = db
    .prepare("SELECT id FROM decks WHERE owner_id = ? AND name = ?")
    .get(u.id, NAME);
  if (existing) continue;
  db.prepare(
    `INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at)
     VALUES (?, ?, ?, ?, '[]', '[]', 1, ?, ?)`,
  ).run(randomUUID(), u.id, NAME, JSON.stringify(MAIN), now, now);
  console.log("deck inserted for", u.display_name);
}
console.log("done");
