# Fixture recorder — how `src/fixtures/*.json` were made

Not invented. Captured 2026-08-13 against `master` `f86683c` on the repo's own same-origin E2E
harness — real WASM ocgcore, real `/api`, real duel WebSocket — with two independent Chromium
contexts at 1440×900 and **every frame logged in full**. The ZUH-118 evidence logs truncate at 900
characters, which loses every `STATE` frame; that is why this exists rather than reusing them.

```sh
# once
bash packages/engine/scripts/build-wasm.sh
bash packages/engine/scripts/fetch-assets.sh
VITE_IMAGE_BASE_URL=https://api.zuhayr.io/images npm run build:web
PORT=8231 DB_PATH=/tmp/zuh121.db npx tsx e2e/harness/server.ts &
DB_PATH=/tmp/zuh121.db node recorder/insertDeck.mjs      # Edison-legal 40, Monarchs + traps

# capture, then slice
node recorder/record.mjs r1-full-duel 90
python3 recorder/extract.py out/r1-full-duel.json ../src/fixtures
```

`record.mjs` sets **Response prompts → Every window** on both seats before play. That is a
recording aid only: it stops the shipped client suppressing decisions, so the engine's real
decision sequence reaches the wire. It never changes what the engine sends.

Yield from one run: 3,008 frames · 141 `DECISION` · 282 `STATE` · 255 `EVENTS` · 8
`DECISION_CONTEXT` · 0 `DUEL_END` (see ZUH-132).
