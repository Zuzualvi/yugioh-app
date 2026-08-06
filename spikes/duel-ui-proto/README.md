# Duel UI prototype — ZUH-81

**DISPOSABLE.** This branch (`proto/duel-ui`) is structurally unmergeable and is meant to be.
It answers *"should it work like this?"*, never *"does it work?"*. No persistence, no auth, no
error handling, no tests. What survives is `/workspace/product/design/component-contract.md`
and the fixtures in `src/fixtures/`.

## Run it

```sh
cd spikes/duel-ui-proto
npm install
npm run dev      # http://localhost:5173
```

Or build the self-contained file (one HTML, opens from `file://`, no server):

```sh
npm run build    # → dist/index.html
```

## What is real and what is faked

| Real | Faked |
|---|---|
| Interaction grammar (ACT vs ANSWER, verb chips, one Question Bar) | Data — scripted fixtures, no backend |
| Sequencing and round-trip latency | Persistence (refresh resets) |
| Layout, dim law, ownership colour law, states | Auth, concurrency, network failure |
| Clock behaviour incl. timeout forfeit | Responsive / a11y / perf / tests |
|  | Card art — deliberately absent so the build is self-contained |

## Fixtures

- `src/fixtures/cards.ts` — **real rows** from `packages/card-data/out/edison-card-catalog.json`.
- `src/fixtures/types.ts` — decision shapes copied from `packages/contracts/src/duelDecision.ts`
  (all 20 variants); snapshot shapes from `packages/contracts/src/duel.ts` **extended with the
  approved MH-1 delta** (`sequence`, dense arrays, typed atk/def/level, field zone, turn number).
  Every added field is marked `// MH-1`.
- `src/fixtures/scenarios.ts` — four scripted scenarios. Decision payloads follow the empirical
  capture `docs/reference/decision-capture-raw.json`.

## Scenarios

1. **Tribute Summon Caius** — the flagship. One intent → 6 engine decisions, one clock, one
   ribbon, and an explicit point of no return.
2. **Respond to a chain** — the Question Bar naming the card, location-badged candidates,
   decline of equal weight, the chain strip, auto-pushed card text.
3. **Attack with everything** — targets picked on the board; `attacks[]` re-indexed between cycles.
4. **Waiting · clock · forfeit** — the off-clock screen, clock escalation, timeout forfeit.

## Prototype-only chrome

The three controls left of the `│` in the top bar do not exist in the product:
scenario picker, Restart, and **"Showing auto-answered steps"** — which reveals the decisions the
client answers on the player's behalf. Turn it off to see what a player actually sees.
The grey **Design note** at bottom-right is also prototype-only.
