# @yugioh-app/card-data

Build-time data tooling that produces the frozen Edison card catalog consumed by the deck builder and server.

## What's in here

| Path                           | Description                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `out/edison-card-catalog.json` | Frozen catalog of 3,681 Edison-legal cards (CardCatalog shape, Spec 13 §2)    |
| `out/alias-index.json`         | `{ aliasPasscode: basePasscode }` — 7 pre-errata alias entries                |
| `src/index.ts`                 | Typed loader: `loadCatalog`, `buildCardMap`, `loadAliasIndex`, `resolveAlias` |
| `scripts/build-catalog.mjs`    | Pipeline: fetches YGOPRODeck, filters to allow-list, writes catalog           |
| `scripts/download-images.mjs`  | Image fetcher (sample or full pull)                                           |
| `scripts/verify.mjs`           | 31-assertion acceptance suite; exits non-zero on any failure                  |
| `images/`                      | **gitignored** — self-hosted card images; never committed                     |

## Catalog overview

- **Format**: `edison-2010-03` (Duelist Pack: Kaiba pool, March 2010 TCG banlist)
- **Count**: 3,681 cards (matches the Spike-B Edison allow-list exactly)
- **Source**: [YGOPRODeck `cardinfo.php`](https://db.ygoprodeck.com/api-guide/) — pulled once at build time; no runtime calls
- **Passcode ground truth**: `spikes/spike-b-dataset/out/edison-allowlist.json`
- **Banlist ground truth**: `spikes/spike-b-dataset/out/edison.lflist.conf`

### Known passcode corrections

Two cards in the allow-list use passcodes that differ from YGOPRODeck's canonical ID:

| Allowlist passcode | Card                | YGOPRODeck ID | Reason                                                |
| ------------------ | ------------------- | ------------- | ----------------------------------------------------- |
| `0`                | Orichalcos Shunoros | `7634581`     | Anime card; virtual passcode in community allow-list  |
| `80604091`         | Ultimate Offering   | `80604092`    | Off-by-one in YGOPRODeck full-dump vs single-card API |

These cards use `imageId` pointing to the YGOPRODeck ID so image fetches succeed.

### Pre-errata aliases

Seven pre-errata card scripts in the Edison banlist use substitute passcodes (`511002xxx`). These are NOT separate catalog entries — the catalog contains only the base passcodes. The `alias-index.json` carries the mapping; base cards inherit their banlist status via a reverse-alias lookup.

| Alias passcode | Base passcode | Card                               | Banlist   |
| -------------- | ------------- | ---------------------------------- | --------- |
| 511002993      | 50321796      | Brionac, Dragon of the Ice Barrier | limited   |
| 511002631      | 26202165      | Sangan                             | limited   |
| 511002992      | 14878871      | Rescue Cat                         | limited   |
| 511002994      | 7391448       | Goyo Guardian                      | limited   |
| 511002995      | 87910978      | Brain Control                      | forbidden |
| 511002996      | 61740673      | Imperial Order                     | forbidden |
| 511002997      | 77565204      | Future Fusion                      | forbidden |

## Regenerating the catalog

Requires network access (YGOPRODeck) and Node 22+.

```sh
node scripts/build-catalog.mjs
```

Output: `out/edison-card-catalog.json`, `out/alias-index.json`.

## Running acceptance checks

```sh
node scripts/verify.mjs
```

Prints PASS/FAIL for 31 assertions covering structure, pool membership, banlist resolution, `isExtraDeck`, and alias correctness.

## Fetching card images

Images are self-hosted and **must not be hot-linked at runtime** (YGOPRODeck ToS).
Images are named `<imageId>.jpg` where `imageId` comes from the CardDTO.

```sh
# Sample (~30 cards) — safe to run during development
node scripts/download-images.mjs --sample

# Full pull (~3,681 images, ~500 MB) — run at deploy time only
node scripts/download-images.mjs
```

Images land in `packages/card-data/images/` which is gitignored.

## Typed loader usage

```ts
import { loadCatalog, buildCardMap, loadAliasIndex, resolveAlias } from "@yugioh-app/card-data";

const catalog = loadCatalog(); // CardCatalog
const cardMap = buildCardMap(catalog); // Map<number, CardDTO>
const aliasIndex = loadAliasIndex(); // AliasIndex

// Look up by passcode
const brionac = cardMap.get(50321796);

// Resolve a pre-errata alias to its base
const base = resolveAlias(511002993, aliasIndex); // → 50321796
```

## Dependency rule

`card-data` → `contracts` only (arch guardrail enforced by dep-cruiser).
