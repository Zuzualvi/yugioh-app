# Spec 11 — Edison Card-Data Pipeline & Catalog (self-hosted)

**Owner role:** Backend Engineer (or Infra — build-time data tooling). **Status:** ready (Phase 2, Slice 1). **Repo:** `/workspace/yugioh-app`, branch `master`.

## Goal
Produce the self-hosted Edison card catalog the deck builder & server run on: display metadata for the 3,681 legal cards (decoded, human-readable), banlist status baked in, alias handling, plus the image-fetch mechanism. This satisfies "self-hosted, no external calls at runtime" (REQ-DATA-02/03, REQ-NET-03).

## Read first
- `/workspace/specs/13-contracts-and-api.md` §1 (CardDTO) + §2 (CardCatalog artifact) — the LOCKED output shape. Produce exactly this.
- Spike B artifacts already in the repo: `spikes/spike-b-dataset/out/edison-allowlist.json` (3,681 passcodes+names), `edison-alias-map.json`, `edison.lflist.conf`, `dt01-excluded.json`. These are your ground truth for membership, aliases, and banlist. Do NOT re-derive the pool — start from these.
- `docs/working/2026-07-13-research-engine-landscape.md` §4 (YGOPRODeck API: `cardinfo.php`, no key, 20 req/s, MUST store locally + self-host images, no hotlinking) and §4b (cards.cdb as metadata source).

## Exclusive file ownership
Create/edit ONLY under `packages/card-data/**`. Do NOT touch root config, other packages, docs, specs, or spikes. (The package is auto-included by the `packages/*` workspace glob; Spec 10 adds the dep-cruiser rule.)

## Pipeline
1. **Metadata:** one-time bulk pull from YGOPRODeck `cardinfo.php` (full dump), OR read the ProjectIgnis `cards.cdb` — your choice; YGOPRODeck gives already-decoded type/race/attribute + is easier. Filter to the Spike B allow-list passcodes. Decode each to a `CardDTO` (Spec 13 §1): set `frame`, `isExtraDeck` (true iff Fusion or Synchro — Ritual is FALSE/Main), `banlist` (resolve from `edison.lflist.conf`: count 0→forbidden, 1→limited, 2→semi, absent→unlimited), `aliasOf` (from the alias map; base passcode) and `imageId` (alias base if aliased, else own passcode).
2. **Output** `packages/card-data/out/edison-card-catalog.json` (the `CardCatalog` shape, cards sorted asc by passcode, count==length≈3681) and `packages/card-data/out/alias-index.json` (`{aliasPasscode: basePasscode}` — superset of Spike B's pre-errata aliases plus any alt-art aliases you find).
3. **Typed loader:** `packages/card-data/src/index.ts` exports a function to load the catalog + a passcode→CardDTO map + an alias resolver, typed with `@yugioh-app/contracts` types.
4. **Images:** prove the download mechanism on a SAMPLE (~30 cards) into a gitignored `packages/card-data/images/` dir (respect 20 req/s; self-host, no hotlinking). Provide a script that does the FULL pull (run at deploy) but do NOT commit images or run the full multi-hundred-MB pull now. Document image naming (`<imageId>.jpg`).

## What IS vs ISN'T committed
- COMMIT: the pipeline scripts, the typed loader, `out/edison-card-catalog.json`, `out/alias-index.json`, a README. (The catalog is a frozen artifact — Edison doesn't change — so committing it is intentional and keeps runtime offline.)
- GITIGNORE (do not commit): `images/`, `node_modules/`, any raw YGOPRODeck dump / vendored `cards.cdb`.

## Acceptance (real output)
- Catalog `count` within a stated/explained tolerance of 3,681; print it. Every catalog passcode ∈ Spike B allow-list; none ∈ `dt01-excluded.json`.
- Banlist spot-checks: print a few known Forbidden (e.g. count-0 entries) resolving to `banlist:"forbidden"`, a Limited to `"limited"`, unrestricted to `"unlimited"`.
- `isExtraDeck` correct: assert all Fusion+Synchro are `true`, all Ritual/Main-deck monsters `false`, on a sample.
- Alias check: a pre-errata alias (e.g. Brionac 511002993) resolves `aliasOf`→base and `imageId`→base.
- A `verify` script recomputes these and prints PASS/FAIL. Sample image download works (show N files fetched). Paste output.

## Git / push protocol
Commit locally → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify remote == local HEAD → report pushed SHA. Only `git add` under `packages/card-data/`; NEVER `git add -A`/`clean`/`stash`/`checkout --` outside it (other engineers + untracked spikes are live here).

## Report back
The catalog count + tolerance explanation, the assertion/verify output, the sample image-fetch result, the committed artifact paths, the pushed SHA, and any YGOPRODeck/cdb data issue (with how you handled it).
