# Spec 13 — Shared Contracts & API (Slice 1+2) — LOCKED

**Owner:** CTO. **Status:** LOCKED output contracts — implementers do not vary field names/shapes. **Consumed by:** Specs 10 (backend), 11 (card-data), 12 (web).

This pins the externally-observable shapes so the three parallel workstreams cannot drift. Behavior/edge cases live in the requirements doc (`docs/working/2026-07-13-v1-requirements.md`) — this pins *shapes only*. Deck-construction rules (§2.1), `.ydk` format (§2.3), and card identity (§2.4) are already locked in that doc — obey them exactly.

The TypeScript/Zod embodiment of everything here lives in **`packages/contracts`** (owned by Spec 10). Web and card-data import from `@yugioh-app/contracts`.

---

## 1. Card DTO (the display/legality unit)
```ts
type Banlist = "forbidden" | "limited" | "semi" | "unlimited";
interface CardDTO {
  passcode: number;        // 8-digit; cards.cdb id / .ydk id (§2.4)
  name: string;
  frame: "normal" | "effect" | "ritual" | "fusion" | "synchro" | "spell" | "trap";
  isExtraDeck: boolean;    // true iff Fusion or Synchro (Extra-only); Ritual is FALSE (Main)
  race: string;            // monster type ("Warrior"…) or spell/trap kind ("Continuous"…); "" if n/a
  attribute: string | null;// "DARK"… ; null for spell/trap
  level: number | null;    // level; null for spell/trap
  atk: number | null;
  def: number | null;
  desc: string;            // full card/effect text
  banlist: Banlist;        // resolved from the Edison lflist
  aliasOf: number | null;  // base passcode this counts as (alt-art/pre-errata), else null
  imageId: number;         // passcode to use for the image file (alias base if applicable)
}
```

## 2. Card-catalog artifact (produced by Spec 11, consumed by Spec 10)
A committed JSON file `packages/card-data/out/edison-card-catalog.json`:
```ts
interface CardCatalog {
  format: "edison-2010-03";
  generatedAt: string;     // ISO-8601
  count: number;           // == cards.length; ~3681
  cards: CardDTO[];        // sorted ascending by passcode
}
```
Plus `packages/card-data/out/alias-index.json` = `{ "<aliasPasscode>": <basePasscode> }` (superset covering Spike B's pre-errata aliases + alt-arts). The image directory is NOT committed (gitignored); Spec 11 documents the bulk image fetch separately.

## 3. HTTP API (JSON over HTTPS; base path `/api`)
All non-auth endpoints require a valid session (see §4) or return **401**. Errors use `{ "error": { "code": string, "message": string } }` with an appropriate HTTP status. Field names are literal.

**Auth**
- `POST /api/auth/redeem-invite` — body `{ inviteCode: string, displayName: string, password: string }` → `201 { user: User }` + sets session cookie. Consumed/expired/invalid invite → `400` `{error:{code:"invite_invalid"…}}`. A consumed invite MUST NOT create a second account.
- `POST /api/auth/login` — body `{ displayName: string, password: string }` → `200 { user: User }` + session cookie. Bad creds → `401` (no account-enumeration distinction).
- `POST /api/auth/logout` → `204`, clears session.
- `GET /api/me` → `200 { user: User }` or `401`.
- `POST /api/admin/invites` (admin only, else `403`) → `201 { inviteCode: string, expiresAt: string }`.

```ts
interface User { id: string; displayName: string; role: "admin" | "member"; }
```

**Cards** (read-only; from the catalog)
- `GET /api/cards` — query params: `q` (name substring), `frame`, `race`, `attribute`, `level`, `atkMin`, `atkMax`, `defMin`, `defMax`, `banlist`, `text` (effect substring), `page` (default 1), `pageSize` (default 60, max 120). → `200 { total: number, page: number, pageSize: number, cards: CardDTO[] }`. Defaults to the Edison pool only.
- `GET /api/cards/:passcode` → `200 CardDTO` or `404`.

**Decks**
```ts
interface DeckSummary { id: string; name: string; isValid: boolean; counts: { main: number; extra: number; side: number }; updatedAt: string; }
interface Deck { id: string; name: string; ownerId: string; main: number[]; extra: number[]; side: number[]; validation: DeckValidation; updatedAt: string; }
interface DeckValidation {
  legal: boolean;
  counts: { main: number; extra: number; side: number };
  violations: Violation[]; // empty iff legal
}
interface Violation { code: string; message: string; passcode?: number; zone?: "main"|"extra"|"side"; line?: number; }
```
Violation `code` ∈ a fixed set: `"main_size"`, `"extra_size"`, `"side_size"`, `"copy_limit"`, `"banlist_forbidden"`, `"banlist_limit"`, `"out_of_pool"`, `"wrong_zone"`, `"unknown_passcode"`, `"parse_error"`.

- `GET /api/decks` → `200 { decks: DeckSummary[] }` (caller's own only).
- `POST /api/decks` — body `{ name: string, main: number[], extra: number[], side: number[] }` → `201 Deck`. Server-side validation is authoritative (§2.1). An invalid deck is still saved (as `isValid:false`) but MUST NOT be duel-selectable later.
- `GET /api/decks/:id` → `200 Deck` (owner only; else `403`/`404`).
- `PUT /api/decks/:id` — same body as POST → `200 Deck`.
- `DELETE /api/decks/:id` → `204`.
- `POST /api/decks/:id/duplicate` → `201 Deck`.
- `POST /api/decks/import` — body: raw `.ydk` text (Content-Type `text/plain`) → `200 { name: string, main: number[], extra: number[], side: number[], validation: DeckValidation }`. Per §2.3: `!side` marker, one passcode per line, LF/CRLF tolerant. Malformed/foreign/over-limit → populated `violations` (never crash/silent-drop); unknown passcode → `unknown_passcode` with the `line`.
- `POST /api/decks/export` — body `{ name?: string, main: number[], extra: number[], side: number[] }` → `200` `.ydk` text (Content-Type `text/plain`), emitting `#created by`, `#main`, `#extra`, `!side` per §2.3 (LF line endings). Round-trip with import MUST preserve the multiset.

## 4. Sessions
- On login/redeem, set an **httpOnly, SameSite=Strict, Secure** cookie named `sid` holding an opaque session id. Sessions persist across reloads (REQ-AUTH-03). No public signup/discovery (REQ-AUTH-01).
- Passwords hashed with a memory-hard KDF (argon2id preferred; bcrypt acceptable). Never store plaintext.

## 5. SQLite schema (V1)
```sql
users(id TEXT PK, display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL);
invites(code TEXT PK, created_by TEXT NOT NULL, expires_at TEXT NOT NULL,
        consumed_by TEXT, consumed_at TEXT);
sessions(sid TEXT PK, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
decks(id TEXT PK, owner_id TEXT NOT NULL, name TEXT NOT NULL,
      main_json TEXT NOT NULL, extra_json TEXT NOT NULL, side_json TEXT NOT NULL,
      is_valid INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
```
`display_name` is not unique (REQ-AUTH-06 — identity binds to `id`). Use `node:sqlite` (Node 22 built-in) or `better-sqlite3`. Migrations are code-managed and idempotent.

## 6. Dependency direction (arch guardrail)
`contracts` → nothing internal. `card-data` → `contracts` only. `server` → `contracts`, `card-data` (and `engine` later). `web` → `contracts` only. Spec 10 owns updating `.dependency-cruiser.cjs` to add `card-data` (allow `server→card-data`, `card-data→contracts`; forbid the rest).
