# @yugioh-app/engine

Server-side Edison duel core wrapping ocgcore-wasm. **Server only — web never imports this package.**

## Quick start

### 1. Build the custom WASM (required)

```bash
# From packages/engine/ — requires git, python3, network (~290 MB emsdk download, ~100s build)
npm run build:wasm
```

The stock `ocgcore-wasm@0.1.2` prebuilt **cannot be used** — it silently ignores the 64-bit
`TCG_FAST_EFFECT_IGNITION` flag due to an emscripten 64-bit comparison bug. The custom build
uses emcc 6.0.2 which compiles the flag correctly.

The LP-cost strict patch (Edison rule #10) is applied **unconditionally** by the build script
(see `patches/ocgcore-lp-cost-strict.patch`). This changes `val <= lp` → `val < lp` in
`check_lp_cost` and `PayLPCost`, forbidding LP costs that reduce LP to exactly 0.

### 2. Populate card assets

Copy `cards.cdb` and CardScripts to `assets/`:

```
assets/
  cards.cdb            ← Edison pool DB (from card-data pipeline)
  scripts/             ← ProjectIgnis/CardScripts
    official/
    pre-errata/
    goat/
```

### 3. Edison overrides

The `scripts/edison-overrides/` directory is owned by the **card-script curation slice (40)**.
Place `<passcode>.lua` files there to shadow the base script for specific Edison-pool cards.

## Usage

```typescript
import { createEdisonDuel } from '@yugioh-app/engine';

const duel = await createEdisonDuel({
  seed: 12345n,
  deck0: { main: [...passcodes], extra: [] },
  deck1: { main: [...passcodes], extra: [] },
});

const result = duel.step(); // advance to first decision
if (result.status === 'waiting') {
  const { seat } = result.awaiting!;
  // send result.messages to clients (redacted per seat)
  duel.respond({ type: 1, value: ... }); // feed response
}
```

## EDISON_FLAGS

`0x7f80d072cn` — `MODE_GOAT | TCG_FAST_EFFECT_IGNITION`. Each flag is individually documented
with its hex value in `src/edisonFlags.ts`. Asserted in `edisonFlags.test.ts`.
