# duel-redo-proto — ZUH-121

Clickable prototype for the redone duel experience. **Disposable.** `proto/*` is structurally
unmergeable by design; what survives is the component contract, the fixtures and the presentation
layer. See `/workspace/product/redo/design/` in the ZUH-121 session, or the design documents this
branch was delivered alongside.

## Open it without a toolchain

```sh
npm install && npm run build
# then open dist/index.html straight from file://
```

Single self-contained HTML file. No server. The only network dependency is card art
(`https://api.zuhayr.io/images/<passcode>.jpg`, public, no auth), and every art-dependent node has
a bounded 4 s deadline and a text identity that does not depend on it.

## Run the gate

```sh
npx vite preview --port 4321 --strictPort &
python3 answer-matrix.py http://localhost:4321/ out.md
```

Walks every answer at every multi-answer decision point and **exits non-zero on a collision**.
It is a gate, not a report. Descended from `docs/specs/2026-08-06-duel-ui-fixtures/answer-matrix.py`.

## What is real and what is faked

| Real | Faked |
|---|---|
| Interaction, sequencing, layout, states | Data — recorded fixtures, no socket |
| **Every DECISION / STATE / EVENTS frame** — captured from a live duel against the real WASM engine on the repo's own E2E harness, 3,008 frames | Persistence, auth, concurrency, network failure |
| The classification law, the answer-fidelity gate | Rules — nothing here adjudicates legality or resolves an effect |

Fixture provenance is stated per set in `07-coverage-and-provenance.md`; the recorder and the
slicing script ship beside the fixtures.

## Rules this code obeys

- **Zero inline `style={{}}` objects.** Classes only. Every new value is a named token in
  `src/styles.css`.
- **`cancelable` is not read in the auto-answer path.** The one legitimate reader is
  `src/proto/playerCancelExists.ts`, a separate file so the import graph shows the separation.
- **No code path constructs a decline except from a control the player pressed.**
