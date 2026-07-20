# Spec — Deck Builder: resolve every card's title on open (batch passcode lookup)

**Owner:** one Full-Stack Engineer (owns the whole slice: contracts → server → web + tests)
**Status:** Ready to implement. CEO greenlit 2026-07-20.
**Origin:** `docs/working/2026-07-20-deckbuilder-name-resolution-handoff.md` (diagnosis; verified still accurate on master `e9d2909`).

---

## 1. Problem

In the Deck Builder (`/builder/:id`), the right-hand deck sidebar shows most cards as raw
passcodes (`×3 #22835145`) instead of titles. Titles only fill in when the user pages the
center browser far enough to load that card; a refresh wipes it. Root cause: on deck open the
code fetches page 1 of the *general* catalog instead of the deck's own cards, and literally
discards the deck's passcodes (`void allPasscodes`). The client-side `cardCache`
(`Map<passcode, CardDTO>`) therefore only holds cards the user happened to browse. The same
under-filled cache also makes the **Deck Stats** panel and **legality copy-count** checks wrong
until every card is cached.

**Goal:** on opening a saved deck (and after importing a `.ydk`), every card in the deck shows
its title immediately, with zero browsing, surviving refresh. Deck Stats and legality then also
reflect the full deck.

---

## 2. Approach (locked)

On deck open and after import, fetch **exactly the deck's cards** in **one** request via a new
batch-by-passcodes filter on `GET /api/cards`, and load them into `cardCache`. Typed end-to-end:
`contracts → server → web`. No dependency-graph violations (`web → contracts` only).

Rejected alternatives (do not implement): N single-card requests (chatty); fetch entire
~3,681-card catalog (multi-MB payload per open).

---

## 3. LOCKED output contract (do not deviate)

### Query parameter
- Name: **`passcodes`** (plural).
- Wire format: **comma-separated positive integers**, e.g. `?passcodes=22835145,12345678,33396948`.
- Parsed type on `CardSearch`: **`passcodes?: number[]`**.
- Absent → `undefined` → no passcode filtering (existing behavior unchanged).

### Server behavior for `GET /api/cards` when `passcodes` is present
- Treat `passcodes` as an **additional filter** in the existing filter chain — a card matches iff
  its `passcode` is in the requested set. It composes with other filters as an intersection
  (same as every other filter). Place the passcodes filter **first** in the chain (cheap set
  membership prunes the list before the other predicates run).
- **Pagination bypass in passcodes mode:** when `passcodes` is present, return **all** matched
  cards (do NOT `slice` to `page`/`pageSize`). A legal deck is ≤ 90 cards / far fewer unique
  passcodes, and returning all requested keeps the rule simple and future-proof.
- Response body (must satisfy the existing `CardListResponseSchema`, whose `pageSize` is
  `.int().positive()`):
  - `total`   = number of matched cards
  - `cards`   = all matched cards
  - `page`    = `1`
  - `pageSize`= `matches.length` when `matches.length > 0`, else `1` (guard so `pageSize` stays a
    positive int when zero cards match, e.g. an unknown passcode).
- **Ordering:** results preserve catalog order (the catalog is sorted ascending by passcode), so
  the response is deterministic and testable. Do not re-sort by request order.
- Unknown / non-matching passcodes are silently skipped (no error) — the deck may legitimately
  reference a passcode; if it isn't in the catalog it simply isn't returned.

### When `passcodes` is absent
- Existing behavior is **unchanged**: all other filters apply, then `page`/`pageSize` slicing as
  today.

---

## 4. Files & exact changes

### 4a. `packages/contracts/src/card.ts`
Add an optional `passcodes` field to `CardSearchSchema` that accepts a comma-separated string on
the wire and yields `number[]` (or `undefined`). Suggested shape (engineer may adjust the zod
incantation as long as the observable contract in §3 holds and the type is `number[] | undefined`):

```ts
passcodes: z
  .preprocess(
    (val) => {
      if (typeof val !== "string" || val.trim() === "") return undefined;
      return val.split(",").map((s) => Number(s.trim()));
    },
    z.array(z.number().int().positive()),
  )
  .optional(),
```

- `CardSearch` type is inferred from the schema, so `passcodes?: number[]` follows automatically.
- Keep every existing field name/behavior LOCKED (Spec 13 §3). Do not touch `CardDTO`.

### 4b. `packages/server/src/routes/cards.ts`
- Destructure `passcodes` from `parsed.data`.
- Add the passcodes filter to the chain (place first). Use a `Set` for membership:
  ```ts
  if (passcodes !== undefined) {
    const wanted = new Set(passcodes);
    cards = cards.filter((c) => wanted.has(c.passcode));
  }
  ```
- Replace the final pagination/response block so that in passcodes mode it returns all matches
  per §3 (bypass the `slice`), and otherwise behaves exactly as today.
- Do not change the `GET /api/cards/:passcode` route.

### 4c. `packages/web/src/api/cards.ts`
- No functional change required: `searchCards` already serializes params generically via
  `URLSearchParams` + `String(val)`, so `passcodes: [1,2,3]` → `passcodes=1,2,3`. Once the
  contract type carries `passcodes`, TS accepts it. **Verify** the serialization produces
  `1,2,3` (no brackets/spaces); add a tiny unit test if the package has one, otherwise rely on
  the web integration test in §5.

### 4d. `packages/web/src/screens/DeckBuilderScreen.tsx`
Add one helper and use it in both hydration paths. The helper must fetch only passcodes **not
already in `cardCache`** to avoid redundant work, and be a no-op when everything is cached.

Suggested helper (place near `addToCache`, ~line 143). It reads current cache via the functional
setState pattern already used, or accept the current cache Map — engineer's discretion, but keep
it a single well-named function `hydrateDeckCards(passcodes: number[])`:

```ts
const hydrateDeckCards = useCallback(
  async (passcodes: number[]) => {
    const unique = [...new Set(passcodes)];
    const missing = unique.filter((p) => !cardCache.has(p));
    if (missing.length === 0) return;
    const res = await searchCards({ passcodes: missing });
    addToCache(res.cards);
  },
  [cardCache, addToCache],
);
```
> Note the `cardCache` dependency: the deck-load effect (§below) currently depends on
> `[deckId, isNew, addToCache, addToast]`. If you make the effect call `hydrateDeckCards`, either
> inline the fetch in the effect using the deck's own passcodes (simplest, avoids a churny
> `cardCache` dependency in the effect), or keep the helper for the import path and inline the
> open path. **Requirement:** on open, the cache is filled from the deck's own passcodes in one
> request; do not reintroduce a `cardCache`-dependency loop that refetches on every cache change.
> Recommended: in the deck-load effect, compute `allPasscodes` and call
> `searchCards({ passcodes: allPasscodes }).then(res => addToCache(res.cards))` directly (cache is
> empty on open anyway); use `hydrateDeckCards` for the import path where the cache may be
> partially warm.

- **Deck-load effect (lines ~178–195):** replace the `searchCards({ page: 1, pageSize: 120 })`
  hack (and the `void allPasscodes` discard) with a fetch of the deck's **unique** passcodes →
  `addToCache(res.cards)`. Because this runs on every open, the refresh case is fixed for free.
- **`handleImport` (line ~321):** replace the `addToCache([])` no-op with a real hydration of the
  imported deck's passcodes (`result.main` + `result.extra` + `result.side`) via
  `hydrateDeckCards`. Keep the existing `setDeck(...)` / `setImportResult(...)` calls intact.
- Do not change unrelated behavior (search, inspector, export, save).

---

## 5. Tests (merge in the same PR — AGENTS.md rule)

- **Contracts** (`packages/contracts`): `CardSearchSchema` parses `passcodes: "1,2,3"` →
  `[1,2,3]`; absent → `undefined`; a non-numeric entry (`"1,x"`) is rejected (400-worthy). Assert
  the inferred type is `number[]`.
- **Server** (`packages/server`): `GET /api/cards?passcodes=a,b,c` returns exactly those cards
  (assert `total` and the returned passcode set), in ascending-passcode order; an unknown
  passcode in the list is silently skipped; passcodes mode returns all matches even when more than
  `pageSize` would allow (construct a case with a passcode list longer than the default page).
- **Web** (`packages/web`): opening a saved deck renders **all** titles — assert no `#<id>`
  fallback text is present in the deck sidebar — and Deck Stats reflect the full deck counts.
  Cover the **import** path too (import a `.ydk`, assert titles resolve without browsing). Mock
  the `/api/cards?passcodes=…` response. Use the existing web test setup/conventions.

---

## 6. Acceptance criteria

1. Open a saved deck cold (fresh load / after refresh): **every** deck card in the sidebar shows
   its title; **no** `#<passcode>` fallback appears for cards that exist in the catalog. No
   browsing required.
2. Deck Stats panel shows correct Monsters/Spells/Traps counts for the full deck immediately on
   open.
3. Legality copy-count checks operate over the full deck immediately on open.
4. Importing a `.ydk` resolves all titles immediately (same guarantees as open).
5. Exactly **one** network request to `/api/cards` for hydration on open (batch), not one per
   card and not the whole catalog.
6. Absent `passcodes` → `GET /api/cards` behaves exactly as before (regression-safe).
7. Repo-wide `npm run verify` is green on a clean checkout (typecheck → lint → arch:check → test).

---

## 7. Delivery protocol (from AGENTS.md)

- Branch: work on `master` per the repo's shared-tree protocol (commit only paths you own;
  `git pull --rebase --autostash origin master` before push; retry with backoff; verify
  `local == remote`; report the pushed SHA).
- Run scoped checks for your packages before pushing (`tsc --noEmit`, `eslint`, `vitest` for
  contracts/server/web). The CTO runs the full repo-wide `verify` on a clean checkout and QA
  independently verifies before sign-off.
- Reply to the CTO with ≤ ~10 lines + file paths + the pushed SHA. Deliver detail as files, not
  pasted walls.
