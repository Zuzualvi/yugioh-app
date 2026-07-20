# Handoff — Deck Builder sidebar shows card IDs instead of titles

**Date:** 2026-07-20
**Author:** CTO session (Zuhayr Alvi)
**Status:** Diagnosed. Fix specified below. NOT yet implemented — awaiting CEO green light.
**Audience:** A fresh CTO session picking this up cold. You have team memory, the repo, and this doc.

---

## 1. The problem (as the CEO reported it)

In the Deck Builder (`/builder/:id`), the right-hand deck sidebar shows most cards as raw
passcodes — e.g. `×3 #22835145` — instead of their titles. Only a couple of cards show real
names (in the reported case, "Blackwing - Gale the Whirlwind" and "Allure of Darkness").

Observed behavior:
- Titles only "fill in" for a deck card once the user pages through the center card browser
  far enough that that card appears in a loaded search page.
- Seeing every title therefore requires scrolling all 62 browser pages.
- A refresh / re-open wipes it back to IDs, forcing the whole process again.

The CEO wants: **on opening the page, every card in the deck shows its title immediately, with
no browsing required** (and it must survive a refresh).

---

## 2. Root cause (verified by reading the code)

All file/line references are in `packages/web/src/screens/DeckBuilderScreen.tsx` unless noted.

**How the sidebar renders a name** — `DeckCard`, line ~1129:

```tsx
<span style={{ lineHeight: 1.3 }}>{card?.name ?? `#${passcode}`}</span>
```

The sidebar looks each deck entry up in a client-side `cardCache`
(`Map<passcode, CardDTO>`, defined ~line 135). If the passcode is **not in the cache**, it
falls back to `#<passcode>`.

**How the cache is populated** — only from search results the user has actually loaded.
`doSearch` (line ~198) calls `addToCache(res.cards)`. So a deck card gets a name only once it
happens to land on a browser page the user has viewed.

**The actual bug** — the deck-load effect, lines ~178-195. When a saved deck is opened it:

1. loads the deck's passcodes, then
2. fetches **page 1 of the general, unfiltered card list** (`searchCards({ page: 1, pageSize: 120 })`)
   — i.e. the first 120 cards in the catalog, **not the cards in the deck**.

It even computes the deck's own passcodes and then discards them:

```js
const allPasscodes = [...new Set([...d.main, ...d.extra, ...d.side])];
return searchCards({ page: 1, pageSize: 120 }).then((res) => {
  addToCache(res.cards);
  void allPasscodes; // "used indirectly via cache"  ← discarded
});
// comment in code: "they'll be populated as the user searches"
```

So the only deck cards that resolve on open are those that coincidentally sit in the first
120-card slice of the catalog — which is why exactly two of the reported deck's cards showed
titles. Because `cardCache` is in-memory React state, a refresh empties it, reproducing the
problem every time.

**Same gap on import** — `handleImport` (line ~316) sets the deck from an imported `.ydk` but
calls `addToCache([])` (line ~321), a no-op. Imported decks therefore also show IDs until the
user browses to each card.

### Secondary symptoms with the SAME root cause (worth fixing together)

The cache also feeds two other pieces of UI, so both are silently wrong until every card is cached:

- **Deck Stats panel** (`deckStats`, line ~383) counts Monsters/Spells/Traps only for cards in
  the cache — hence the reported "Monsters: 1, Spells: 1, Traps: 0" on a 40-card deck.
- **Legality copy-count checks** (`computeValidity`, line ~51) can only enforce max-copies for
  cached cards, so copy-limit violations can be missed until the cache is complete.

Filling the cache with the deck's real cards on open fixes names, stats, and legality in one shot.

---

## 3. Relevant existing API surface

- `GET /api/cards` — search/filter/paginate. Handler: `packages/server/src/routes/cards.ts`
  (`createCardsRouter`). Backed by an in-memory catalog (`catalog.catalog.cards`,
  `catalog.byPasscode`), ~3,681 cards. Query schema: `CardSearchSchema` in
  `packages/contracts/src/card.ts`. **No batch-by-IDs filter today.**
- `GET /api/cards/:passcode` — single card lookup (exists; `catalog.byPasscode.get`).
- Web API wrappers: `packages/web/src/api/cards.ts` (`searchCards`, `getCard`). `searchCards`
  serializes params generically via `URLSearchParams` + `String(val)`, so a `passcodes` array
  would serialize to a comma-separated string automatically.
- `CardDTO` shape and the LOCKED field names are in `packages/contracts/src/card.ts`.

---

## 4. Recommended fix

**Principle:** on deck open (and after import), fetch **exactly the cards in the deck** and put
them in `cardCache`, instead of fetching an arbitrary first page. Do it in **one** network
round-trip via a batch-by-IDs lookup.

### 4a. Contracts — `packages/contracts/src/card.ts`
Add an optional `passcodes` filter to `CardSearchSchema`: a comma-separated list of integers,
coerced to `number[]` (use `z.preprocess` to split on comma and `Number()` each, or model as
`z.string()` and split server-side). Keep all field names consistent with the LOCKED DTO.
Update `CardSearch` type accordingly. Add a schema unit test.

### 4b. Server — `packages/server/src/routes/cards.ts`
In the `GET /api/cards` handler, when `passcodes` is present, filter the catalog to those
passcodes and **return all matches** (do not clip to the pagination cap — a legal deck has at
most 90 cards, and far fewer unique passcodes, but returning all requested keeps the rule
simple and future-proof). Order of other filters is unchanged. Add a route unit test asserting
`?passcodes=a,b,c` returns exactly those cards.

### 4c. Web — `packages/web/src/api/cards.ts` + `DeckBuilderScreen.tsx`
- Ensure `searchCards` passes `passcodes` (already generic; just needs the contract type).
- Replace the "fetch page 1" hack in the deck-load effect (lines ~178-195) with a fetch of the
  deck's **unique passcodes** → `addToCache(res.cards)`. Because this runs on every open, it
  also fixes the refresh case with no extra work.
- Apply the same hydration after `handleImport` (replace the `addToCache([])` no-op at line ~321
  with a real fetch of the imported passcodes).
- Extract a small helper (e.g. `hydrateDeckCards(passcodes: number[])`) used by both paths, so
  there is exactly one shape for "load the deck's cards into cache." Fetch only passcodes not
  already cached to avoid redundant work.

### 4d. Tests (independent QA gate before merge)
- Server: `passcodes` filter returns exactly the requested cards.
- Contracts: `passcodes` parses comma-separated → `number[]`.
- Web: opening a saved deck renders all titles (assert no `#<id>` fallback text appears);
  Deck Stats reflect the full deck. Cover the import path too.
- Full repo-wide `npm run verify` green on a clean checkout is the sign-off.

### Alternatives considered and rejected
- **One `getCard` request per card**: works with today's API but 15-40 round-trips per open —
  chatty and slow. Rejected.
- **Fetch the entire ~3,681-card catalog on open**: fixes it but ships a multi-MB payload every
  time the builder opens. Wasteful. Rejected.

The batch-by-IDs approach is the right-sized fix: one request, typed end-to-end
(contracts → server → web), and it fits the existing dependency graph
(`web` → `contracts` only; the new type lives in `contracts`).
