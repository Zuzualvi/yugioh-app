# Report — Deck Builder now shows every card's title on open

**Date:** 2026-07-20
**Status:** ✅ DONE, VERIFIED, and LIVE.
**Shipped SHA:** `4b6b2db`

---

## What you reported
In the Deck Builder, the deck sidebar showed most cards as raw passcodes (e.g. `×3 #22835145`)
instead of their titles. Titles only appeared after browsing far enough through the card list to
load each card, and a refresh wiped it back to IDs.

## What was wrong
On opening a deck the app fetched the *first page of the general card catalog* instead of the
cards actually in the deck — and then discarded the deck's own card IDs. So only the handful of
deck cards that happened to sit in that first slice got names; everything else fell back to
`#<id>`. Because the name cache lived only in memory, a refresh emptied it every time. The same
gap quietly made the **Deck Stats** panel and the **legality copy-count** checks wrong until every
card had been browsed.

## What we changed
The app now fetches **exactly the cards in the deck, in one request**, the moment a deck opens (and
after importing a `.ydk`). One clean batch lookup, wired properly through the shared type
definitions so the front-end and back-end can't drift.

Result:
- Every deck card shows its **title immediately on open** — no browsing required.
- **Survives refresh.**
- **Deck Stats** and **legality checks** are now correct from the moment the deck loads.
- Imported decks resolve titles immediately too.

## How we know it's right (independent verification)
- One engineer implemented the whole slice (types + server + UI) with tests in the same commit.
- A **separate QA engineer** verified it on a clean checkout: the full repo-wide pipeline
  (typecheck → lint → architecture check → tests) is **green — 876 tests passed, 0 failed**.
- The product-promise tests specifically assert the sidebar shows **no `#<id>` fallbacks** and
  Deck Stats counts are correct — and would fail on the old buggy code.
- The deploy is **live** on the current production hosting (frontend and backend both confirmed
  up at this commit).

## Alternatives we rejected (and why)
- One request per card → 15–40 round-trips per open; chatty and slow.
- Download the whole ~3,681-card catalog on open → multi-MB payload every time; wasteful.

The batch-by-IDs approach is the right-sized fix: one request, correctly typed, no new
architectural coupling.

## One thing for your awareness (not urgent)
This repo deploys to production on **every push to master with no automated CI gate in front of
it** (GitHub Actions isn't wired). It worked out fine here because QA caught everything on a clean
checkout, but it means a bad push would go straight to prod. I can have Infra wire the GitHub
Actions gate as a small standalone task if you want that safety net — your call.
