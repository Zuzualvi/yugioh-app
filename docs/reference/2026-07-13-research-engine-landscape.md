# Engine + Card-Data + Image Landscape — Research Brief

**Scope:** Feasibility of "reuse a proven, community-trusted rules engine + its card
scripts + card data, and build our own modern web UI on top" for a **private,
non-commercial, friends-only, Edison-format** Yu-Gi-Oh! duel simulator with remote 1v1.

**Bottom line up front:** The reuse path is real and well-trodden. There is one dominant,
battle-tested rules engine (`ocgcore` / `ygopro-core`) with a matching corpus of
community-maintained Lua card scripts and a SQLite card database. It is explicitly
designed to run headless and power servers, it already has a WebAssembly build and at
least one production-grade browser client that reuses it behind a bespoke UI. The main
things to pin down are **licensing (AGPL)** and **choosing between "native core on a
server" vs "core in WASM in the browser."** Details, sources, and risks below.

A note on terminology: **"ocgcore"** and **"ygopro-core"** refer to the same C++ engine;
"OCG" = Official Card Game. Konami's own digital products are unrelated — this whole
ecosystem is unofficial/fan-made.

---

## 1. The ygopro / EDOPro / Project Ignis ecosystem — the actual components

The ecosystem cleanly separates into **rules engine**, **card effect scripts**, **card
database**, and **card images**. These are different repos with different maintainers and,
importantly, different licenses.

### 1a. The rules engine — `ocgcore` (C++)
Every mainstream YGO simulator is powered by the same core. Per the EDOPro README, *"All
YGOPro forks and known automatic duel simulators are powered by the YGOPro core (ocgcore),
an automated scripting engine for the Yu-Gi-Oh! Official Card Game."* (https://github.com/edo9300/edopro)

- **Original:** `Fluorohydride/ygopro-core` — described as *"The core logic and lua script
  processor of YGOPro. This library can be made external of the project and used to power
  server technologies. It maintains a state engine that is manipulated by Lua scripts."*
  License: **MIT**. (https://github.com/Fluorohydride/ygopro-core)
- **Actively-maintained fork:** `edo9300/ygopro-core` — the core behind **EDOPro**, the
  most current client. It is *"a bleeding-edge fork of YGOPro core with updates to
  accommodate for new cards and features"* and is deliberately *"incompatible with forks
  not derived from this one."* License: **AGPL-3.0-or-later**. (https://github.com/edo9300/ygopro-core)

The engine is pure logic: it holds duel state, runs Lua card scripts, resolves the rules,
and emits a stream of binary "duel messages." **It renders nothing** — the UI is entirely
the host application's job. This is exactly the separation the founder wants.

### 1b. The card effect scripts — Lua (`ProjectIgnis/CardScripts`)
Each card's behavior is a Lua file (e.g. `c<passcode>.lua`). This is the community's
verified, peer-reviewed rulings content — the thing we must *not* re-invent.
- `ProjectIgnis/CardScripts` — *"Project Ignis card script libraries and canonical card
  scripts for EDOPro."* Lua; **AGPL-3.0-or-later**. (https://github.com/ProjectIgnis/CardScripts)
- The engine loads these on demand via a "script reader" callback (see §2).

### 1c. The card database — `cards.cdb` (SQLite; `ProjectIgnis/BabelCDB`)
`cards.cdb` is a plain **SQLite** file (any SQLite client can open it). It holds the
*numeric/textual card metadata the engine needs* — **not images**. Two tables:

```sql
CREATE TABLE datas (            -- one row per card, numeric attributes
  id       INTEGER PRIMARY KEY, -- 8-digit passcode (also the card's game id)
  ot       INTEGER,             -- legality region bitfield: OCG / TCG / both / anime / custom
  alias    INTEGER,             -- "treated as" id (alt-arts, Harpie Ladies) — 0 if none
  setcode  INTEGER,             -- archetype membership (packed hex, up to ~4 archetypes)
  type     INTEGER,             -- card-type bitfield (Monster=1, Normal=16, Effect=32,
                                --   Fusion=64, Synchro=0x2000, Tuner=0x1000, Spell, Trap, …)
  atk      INTEGER,
  def      INTEGER,
  level    INTEGER,             -- low bits = level/rank; high bytes pack Pendulum scales
  race     INTEGER,             -- monster type (Warrior, Dragon, …) bitfield
  attribute INTEGER,            -- DARK/LIGHT/… bitfield
  category INTEGER              -- deck-builder search flags
);
CREATE TABLE texts (            -- one row per card, strings
  id   INTEGER PRIMARY KEY,
  name TEXT,
  desc TEXT,                    -- full card/effect text
  str1 TEXT, … , str16 TEXT     -- effect-choice prompt strings
);
```

Schema verified from a working consumer (`amarillonmc/bastion-bot`) and the community card-
creation docs. `ot` is what YGOPro devs call the legality flag — *"whether a card is legal
in the OCG, TCG, both, or other options."* (https://github.com/amarillonmc/bastion-bot)
`ProjectIgnis/BabelCDB` is the canonical database repo (Python tooling around the `.cdb`s).
(https://github.com/orgs/ProjectIgnis/repositories)

**Key point:** `cards.cdb` stores everything the *engine* needs to instantiate a card, but
**no artwork**. The engine reads only the `datas` table (see the `card_reader` callback in §2).

### 1d. Card images ("pics")
Images are a separate concern entirely — sourced from image packs or a CDN, keyed by
passcode (e.g. `<passcode>.jpg`). EDOPro ships/downloads a `pics` folder; most tooling
pulls images from the **YGOPRODeck** image CDN (see §4). Nothing about images lives in
`cards.cdb` or the engine.

### 1e. Banlists (`ProjectIgnis/LFLists`)
Format legality (Forbidden/Limited/Semi) is expressed in `lflist.conf` files — plain text,
passcode → allowed-count. This is how a format like Edison is enforced at deck-validation
time (see §5).

### How they fit together
```
        ┌──────────────────────────────────────────────┐
        │  Our web UI (new)                              │
        └──────────────────────────────────────────────┘
                 │ player actions            ▲ duel-state messages
                 ▼                            │
        ┌──────────────────────────────────────────────┐
        │  ocgcore  (C++ rules engine, headless)         │
        │   • asks host for card data  ── card_reader ──▶│ reads datas table of cards.cdb
        │   • asks host for scripts    ── script_reader ▶│ reads c<passcode>.lua (CardScripts)
        │   • emits binary duel messages                 │
        └──────────────────────────────────────────────┘
   Deck validation uses lflist.conf (LFLists).  Images are fetched separately by the UI.
```

---

## 2. Can the engine run headless / server-side behind our own UI?

**Yes — this is the engine's intended use.** Fluorohydride's own description says the
library *"can be made external of the project and used to power server technologies."*
(https://github.com/Fluorohydride/ygopro-core) Multiple independent servers already do
exactly this.

### 2a. The engine interface (the C API / callbacks)
The engine is a C library driven by three host-provided callbacks plus a lifecycle API.

**Original API (`Fluorohydride/ygopro-core`):**
- `set_script_reader(f)` — host returns a Lua script by card code.
- `set_card_reader(f)` — host returns a row *"from the `datas` table of `cards.cdb`."*
- `set_message_handler(f)` — error messages.
- Lifecycle: `create_duel(seed)` / `start_duel(options)` / `set_player_info(lp, startcount,
  drawcount)` / `new_card(code, owner, player, location, sequence, position)` / `process()`
  (advance the state machine) / `query_card` / `query_field_card` (read state into a buffer)
  / `set_responsei` / `set_responseb` (feed the player's chosen response).
(https://github.com/Fluorohydride/ygopro-core)

**Modern API (`edo9300/ygopro-core`, "OCGCore v2"):** cleaner and better-documented —
`OCG_CreateDuel(duel, options)` (options carry the data-reader, script-reader, and log
callbacks), `OCG_StartDuel`, `OCG_DuelProcess` (returns `END` / `AWAITING` (needs a player
response) / `CONTINUE`), `OCG_DuelGetMessage` (*"the main interface to the simulation …
returns a pointer to the internal buffer containing all binary messages"* — you copy it
out and render it), `OCG_DuelSetResponse`, `OCG_LoadScript`, and `OCG_DuelQuery / QueryLocation
/ QueryField`. The README points to `common.h` and **`DyXel/ygopen`** for the binary message
format definitions. (https://github.com/edo9300/ygopro-core)

The processing loop is literally: `process → drain messages → render → if awaiting, collect
the player's choice → set response → repeat`.

### 2b. The network protocol (CTOS / STOC)
YGOPro's client↔server wire protocol is a set of TCP packets: **CTOS** (Client-To-Server)
and **STOC** (Server-To-Client). In online play, *"the server sends all the visual
information; the ocgcore is bypassed mostly … it's only needed for replays and offline LAN
mode"* from the client's perspective — i.e. **the core runs on the server**, and the client
is mostly a renderer that *"sends player actions as CTOS packets and processes STOC packets
to update game state."* (https://github.com/SalvationDevelopment/YGOSalvation-Server/issues/98,
https://deepwiki.com/mycard/ygopro) The Neos web client documents the same split: *the
backend sends STOC messages (card positions, chains, damage) for the frontend to display,
and the frontend turns player choices (which effect to activate, which materials to pick)
into CTOS messages.* (https://doc.neos.moe/docs/coding/protocol/)

**Implication:** we are free to design our *own* client↔server protocol (JSON/protobuf over
WebSockets) and are not obligated to speak CTOS/STOC to our own UI. CTOS/STOC only matters
if we want compatibility with existing YGOPro clients/servers (we don't).

### 2c. Existing bindings / wrappers / reuse (real projects)
- **C / native shared lib:** `ocgcore.dll` / `.so` — the default. Server projects
  `IceYGO/ygosharp` (C#) and `garymabin/YGOCore` / `Buttys/YGOCore` (C#) load the native
  core; ygosharp's setup is literally *"put `cards.cdb`, `lflist.conf`, `ocgcore.dll` and
  the script directory next to the executable."* (https://github.com/IceYGO/ygosharp)
- **WebAssembly (in-browser or Node):** **`n1xx1/ocgcore-wasm`** — *"ProjectIgnis' EDOPro
  Core built for WebAssembly using emscripten,"* with a TypeScript API (`createCore`,
  `createDuel({flags, seed, team1, team2, cardReader, scriptReader, errorHandler})`,
  `startDuel`, `duelProcess`, `duelGetMessage`, `duelSetResponse`). The async build needs JS
  Promise Integration (JSPI) / `--experimental-wasm-stack-switching`. The bindings are MIT,
  but they compile the AGPL `edo9300` core (see §6). Small project (few contributors), so
  treat as promising-but-verify. (https://github.com/n1xx1/ocgcore-wasm)
- **Full browser client that already does "reuse core, new UI":** **`DarkNeos/neos-ts`
  (Neos)** — *"web version of Yu-Gi-Oh! game written in TypeScript, React.js and
  WebAssembly,"* in public beta on MyCard. This is the strongest existence proof for our
  exact plan: a modern web front-end over the ygopro engine/ecosystem. (https://github.com/DarkNeos/neos-ts)
- **Reference server architecture in our stack:** **`diangogav/EDOpro-server-ts`** — a
  TypeScript game server, EDOPro-compatible, that pulls `ProjectIgnis/CardScripts` +
  `BabelCDB` + `LFLists`, keeps standard vs. extended **card pools in memory**, and exposes
  a TCP socket server, a REST API, and a **WebSocket server for real-time updates**. Very
  close to the shape we'd build. (https://github.com/diangogav/EDOpro-server-ts)
- **Python:** `sbl1996/ygo-agent` / `ygoenv` wraps `ygopro-core` for RL training — evidence
  the core is easy to embed from high-level languages. (https://github.com/sbl1996/ygo-agent)
- **Unity/desktop:** `YGO Omega` (Duelists Unite) is another large sim, but it's not open
  in the same way; less useful as a reuse base. (https://omega.duelistsunite.org/)

---

## 3. Architecture options for our app

Both options reuse the **same** core + scripts + `cards.cdb`; they differ only in *where the
core executes*.

### Option A — Native core on a server; browser talks to it over WebSockets
The core (`ocgcore.dll/.so`) runs in a server process (one instance per duel room). The
server owns the authoritative duel state, feeds each client a redacted view (you must not
leak the opponent's hand), and receives player choices. `EDOpro-server-ts` is a near-exact
template.

- **Pros:**
  - **Authoritative & cheat-resistant** — hidden information (decks, hands, face-down cards)
    never reaches the client that shouldn't see it. This is the correct model for competitive/
    hidden-info games and matches how real YGOPro servers work.
  - Deterministic single source of truth; trivial to add spectate/replay.
  - Core runs as a normal native binary — mature build path, best performance, easiest to
    debug, no browser-specific constraints.
  - Client stays thin; can ship UI updates without touching the engine.
- **Cons / risks:**
  - You must run and pay for a server process (though for a handful of friends, a single
    small VPS or even a home box is plenty).
  - You must design the per-player state-redaction and the WebSocket message contract
    (this is real work, but bounded and well-understood).
  - Native builds per-OS for the server (manageable — one target).

### Option B — Core compiled to WASM, running in the browser
Each client runs the engine locally via `ocgcore-wasm`. For 2-player remote you still need a
relay, and you must decide who is authoritative.

- **Pros:**
  - No native server to operate for the *engine*; simplest hosting for a static site.
  - Zero round-trip latency for local rules resolution / previews.
  - `ocgcore-wasm` + `neos-ts` prove it's viable in-browser.
- **Cons / risks (significant for a 2-player hidden-info game):**
  - **Trust / hidden information.** If the full duel state (both decks/hands) lives in a
    client to run the sim, a modified client can see the opponent's cards. Avoiding this
    means either (a) running the authoritative sim on only one peer/host (then it's really
    Option A with the "server" being a browser), or (b) complex info-hiding gymnastics. For
    friends this may be acceptable, but it's a real design constraint, not a footnote.
  - **Determinism / desync.** Two independently-running WASM cores must stay perfectly in
    sync (same seed, same message order). Any divergence = desync. Simpler to have one
    authority.
  - **Maturity.** `ocgcore-wasm` is a small project; JSPI/stack-switching requirements and
    bundle size (a multi-MB WASM blob + Lua scripts + `cards.cdb`) need validation across
    target browsers.

### Recommendation on architecture
**Option A (native core on a server, browser ↔ server over WebSockets)** is the lower-risk
default for a *remote, 2-player, hidden-information* game, and it has the closest working
template (`EDOpro-server-ts`). Option B (WASM) is attractive for a **local/offline/hotseat
or single-player-vs-AI mode**, for client-side move previews, and to keep a path open to a
serverless deployment — but it is not the natural fit for authoritative remote 1v1. A
pragmatic build could use the native core server for real duels and optionally the WASM core
for offline testing/goldfishing. (These are directional judgments — see confidence caveats.)

---

## 4. Card metadata + image sources for the deckbuilder / display layer

There's a clean split, and it's worth stating explicitly because it drives two different
data pipelines:

| Concern | Needs | Source of truth |
|---|---|---|
| **Engine correctness** (does the duel resolve right?) | `ocgcore` + Lua **CardScripts** + `cards.cdb` (`datas` table) | Project Ignis repos |
| **Deckbuilder / display** (search, filter, show cards) | Card **metadata** (name, text, type, atk/def, sets, dates) + **images** | YGOPRODeck API and/or `cards.cdb` `texts` |

### 4a. YGOPRODeck API (metadata + images)
Community-run, free, **no API key**, single main endpoint
`https://db.ygoprodeck.com/api/v7/cardinfo.php`. It returns full metadata and is filterable
by `name`, `fname` (fuzzy), `id` (passcode), `konami_id`, `type`, `race`, `attribute`,
`atk`/`def`/`level` (with `lt/lte/gt/gte`), `archetype`, `cardset`, `banlist`, `format`, and
**`startdate`/`enddate`/`dateregion`** (release-date range). Each card includes a
`card_sets` array (with `set_code`, `set_rarity`, and — via `misc=yes` — `tcg_date`), a
`card_images` array (`image_url`, `image_url_small`, `image_url_cropped`), and prices.
(https://ygoprodeck.com/api-guide/)

Supporting endpoints: `cardsets.php` returns *"Set Name, Set Code, Number of Cards and TCG
Date (Release Date)"*; `checkDBVer.php` for cache invalidation; `archetypes.php`;
`randomcard.php`. (https://ygoprodeck.com/api-guide/)

**Terms that matter for us:**
- **Rate limit: 20 requests/second/IP**; exceed → **1-hour block**. No key required.
  (https://ygoprodeck.com/api-guide/, corroborated at https://providers.apis.io/providers/yu-gi-oh/)
- **You must download and store data locally** rather than hammering the API.
- **Images must be downloaded and self-hosted** — *"Do not continually hotlink images…
  Failure to do so will result in an IP blacklist."* Images live on
  `images.ygoprodeck.com` (`/images/cards/`, `/cards_small/`, `/cards_cropped/`), named by
  passcode. (https://ygoprodeck.com/api-guide/)

For our use this is ideal: do a **one-time bulk pull**, filter to the Edison pool, and store
metadata + images **inside our app**, satisfying the founder's "self-hosted, no external
calls mid-duel" requirement.

### 4b. `cards.cdb` as an alternative metadata source
`cards.cdb` already contains names + full text (`texts`) and stats (`datas`), so in
principle the deckbuilder could read straight from the same `.cdb` the engine uses (single
source of truth, no second dataset to reconcile). The trade-offs: the `.cdb` stores stats as
**bitfields/enums** (type/race/attribute/level need decoding), and it has **no set/release-
date info and no images**. So a common pattern is: **use `cards.cdb` for engine truth +
display text, and YGOPRODeck for images, set membership, and release dates** (which we need
for Edison filtering anyway).

### 4c. Era-appropriate images
YGOPRODeck serves the *current* default artwork per passcode; for a period format like
Edison the artwork is generally fine (same cards). If exact first-print artwork matters,
alternate arts appear as extra entries in the `card_images` array keyed by their own
passcode. EDOPro's own `pics` packs are another source. This is a polish detail, not a
blocker.

---

## 5. Filtering the dataset to the Edison pool

**Edison format (verified):** the card pool and banlist from **March 2010**. Legal cards go
*"up to and including the release of Duelist Pack: Kaiba,"* i.e. through **Absolute
Powerforce (ABPF)** and the Duelist Packs, **before The Shining Darkness** — and it uses the
**March 2010 TCG Forbidden & Limited List.** (https://edisonformat.net/rules/banlist,
https://ygoprodeck.com/article/an-introduction-to-sjc-edison-format-93251,
https://www.formatlibrary.com/formats/edison, https://goatworld.community/blog/what-is-edison-format-complete-guide)

> **Nuance / correction to flag to the founder:** the project brief described the pool as
> "~through The Shining Darkness." Standard Edison is up to but **excluding** The Shining
> Darkness (TSHD) — TSHD is exactly the set whose release *ended* the format. Including TSHD
> is a deliberate variant ("Time Travel Edison"). Whether TSHD (and which, if any, later
> cards) are legal should be an explicit config decision, not an accident of a date cutoff.

**Filtering is very feasible.** Several independent, cross-checkable levers:

1. **Release-date cutoff (primary).** Pull sets from YGOPRODeck `cardsets.php` (each has a
   `tcg_date`), keep sets released on/before the ABPF/Duelist-Pack-Kaiba window (~2010-02 to
   2010-04), and/or use the card-level date filter directly:
   `cardinfo.php?startdate=...&enddate=2010-04-xx&dateregion=tcg`. (https://ygoprodeck.com/api-guide/)
2. **Banlist / legality (secondary, and required anyway).** Apply the **March 2010 F&L
   list**. YGOPRODeck even ships a ready-made Edison banlist
   (`ygoprodeck.com/banlist/?list=Edison&date=2010-03-01`), and the engine ecosystem
   enforces banlists via `lflist.conf` (ProjectIgnis/LFLists), so we can drop in an Edison
   `lflist.conf` for deck validation. (https://ygoprodeck.com/banlist/?list=Edison&date=2010-03-01)
3. **Passcode whitelist (most robust for a frozen format).** Because Edison is historically
   fixed, the cleanest approach is to compute the legal set **once** (by date + manual
   corrections for the handful of "printed-but-not-legal" exceptions the community documents)
   and freeze it as an explicit **passcode allow-list**. Store that list; the deckbuilder and
   the server both validate against it. This removes any dependence on date-field edge cases
   and matches how retro-format servers pin their pools.
4. **`cards.cdb` `ot` field** filters OCG-only cards out of a TCG format, but `ot` does *not*
   encode release date, so it complements (doesn't replace) the date/whitelist approach.

**Watch-outs:** date-based filtering has edge cases — promos, reprints in later sets (a card
can have a *later* `tcg_date` on a reprint), and the documented "printed in-window but not
Edison-legal" cards. These are exactly why the community distributes curated banlists and
why a **frozen passcode whitelist** (built once, reviewed by the founder) is the safe design.

---

## 6. Licensing & IP — realistic, not alarmist

### 6a. Engine + scripts + data (copyleft)
- **Original core `Fluorohydride/ygopro-core` = MIT** (permissive).
  (https://github.com/Fluorohydride/ygopro-core)
- **Modern core `edo9300/ygopro-core` = AGPL-3.0-or-later** — its README: *"EDOPro's core is
  free/libre and open source software licensed under the GNU Affero General Public License,
  version 3 or later."* The **EDOPro client** is likewise AGPL. (https://github.com/edo9300/ygopro-core, https://github.com/edo9300/edopro)
- **`ProjectIgnis/CardScripts` = AGPL-3.0-or-later** (*"under the terms of the GNU Affero
  General Public License … version 3 … or any later version."*). (https://github.com/ProjectIgnis/CardScripts) BabelCDB / LFLists live under the same org.
- `n1xx1/ocgcore-wasm` *bindings* are MIT, but they **compile the AGPL `edo9300` core**, so
  the resulting artifact is effectively AGPL.

**What AGPL means in practice.** AGPL-3.0 is strong copyleft with a **network clause**: if
you *convey* the software **or make it available to users over a network**, you must offer
those users the **corresponding source** of the whole combined work (your UI/server
included, to the extent it's a derivative/linked work). Implications:
- For a **private, friends-only** deployment: **low burden.** The people using it are your
  co-conspirators; sharing the source with them (e.g. access to the repo) satisfies the
  obligation. There is no obligation to publish to the world.
- If it ever goes **public**: you would be expected to **release your source under AGPL** to
  your users. That's the real cost of this path — it likely **precludes a closed-source
  public product** built directly on the AGPL core+scripts.
- To keep a *permissive* base you could build on the **MIT `Fluorohydride` core** — but the
  **Lua card scripts are AGPL regardless**, and the scripts are the irreplaceable "verified
  rulings content." So realistically, **reusing the community's rulings = accepting AGPL.**

**Note:** I am not a lawyer; this is an engineering read of the license texts, not legal
advice. If a public/commercial launch is ever on the table, get a proper review.

### 6b. YGOPRODeck API terms
Free, no key, **20 req/s**, **store data locally**, **self-host images (no hotlinking)**.
YGOPRODeck itself notes card data/images are *"copyright 4K Media Inc, a subsidiary of
Konami"* and that the site is unaffiliated. Complying is easy: bulk-pull once, self-host.
(https://ygoprodeck.com/api-guide/)

### 6c. Konami / Shueisha IP (card names, text, artwork)
Card names, card text, and artwork are Konami/Shueisha (4K Media) intellectual property.
The entire simulator ecosystem operates as **unlicensed fan work**; every project carries a
disclaimer (EDOPro: *"Yu-Gi-Oh! is a trademark of Shueisha and Konami. This is not
affiliated with or endorsed by…"*; Format Library uses card text/art *"for informational
purposes under U.S. fair use"*). (https://github.com/edo9300/edopro, https://www.formatlibrary.com/formats/edison)

**Practical risk assessment:**
- **Private, non-commercial, friends-only, self-hosted:** **low practical risk.** This is
  the same footing as the many long-lived fan sims; the sensitive triggers for rights-holders
  are **public distribution, monetization, and hosting large public services** — none of
  which apply here.
- **If it goes public:** risk rises on **two independent axes** — (1) **copyright/trademark**
  exposure from publicly distributing Konami's names/text/art, and (2) the **AGPL** source-
  disclosure obligation. Neither is unusual in this space, but both should be a conscious
  decision, ideally with legal input, before any public or paid launch.

---

## 7. Alternatives to reusing ygopro

- **Use a different open engine.** In practice there isn't a competitive one: essentially
  **every** automatic YGO simulator descends from `ocgcore` (the EDOPro README states this
  outright). Forks differ in currency and features, not in being a fundamentally different
  engine. So "pick another engine" mostly means "pick another ocgcore fork" — the relevant
  choice is **MIT `Fluorohydride` vs AGPL `edo9300`** (currency vs license), and both still
  need the AGPL Lua scripts for real rulings.
- **Write our own rules engine from scratch.** **Very high effort, very high correctness
  risk — and directly against the founder's stated constraint** (no hand-written/AI-invented
  rules). Yu-Gi-Oh! has thousands of cards, an intricate chain/priority/timing system, and
  countless card-specific interactions; ocgcore + its scripts represent many years of
  community effort and bug-fixing. Re-deriving that would (a) take enormous time, (b)
  reliably produce subtle rules bugs, and (c) throw away the exact "verified, community-
  trusted content" the founder wants to keep. **Not recommended.**
- **Hybrid we should *not* do:** hand-writing rules only for Edison-era cards. It sounds
  smaller but still requires re-implementing the core rules machinery (chains, priority,
  Synchro summon procedure, damage step, etc.) — the hard part — for little benefit, and
  reintroduces the AI-invented-rules risk. The Edison pool is still ~4,000+ cards.

---

## Recommendation & confidence

**Is "reuse core + scripts + data, new UI" viable? — Yes, with good confidence.** The
engine is explicitly designed to be embedded and headless; the rulings live in reusable Lua
scripts and a SQLite DB; there is a WASM build and at least one production browser client
(**Neos**) plus a TypeScript server (**EDOpro-server-ts**) that already do essentially what
we want. This directly satisfies the founder's constraints: **self-hosted engine + verified
community rulings content, no external ruling calls mid-duel**, and freedom to build a fresh
UI. The founder's complaint (UI, not correctness) is exactly what this approach lets us fix.

**Recommended architecture:** **native `ocgcore` on a server, browser ↔ server over
WebSockets, authoritative server-side state** (template: `EDOpro-server-ts`), with the
**WASM core reserved for offline/goldfish/AI-practice** and client-side previews. Data plane:
**bulk-pull YGOPRODeck once**, filter to a **frozen Edison passcode whitelist**, **self-host
metadata + images**; run the engine off **CardScripts + a `cards.cdb`** snapshot pinned to
the Edison era, with an Edison `lflist.conf` for deck validation.

**Top technical risks / unknowns:**
1. **Licensing (AGPL) reality.** Using the community rulings (scripts, and the modern core)
   means the project is **AGPL**. Fine for private/friends; a genuine constraint on any
   future public/closed launch. *Decision needed, not just a risk.*
2. **Per-player hidden-information handling & the client↔server contract.** We must design
   state redaction so a client never receives the opponent's hidden cards, and define our own
   WebSocket message schema on top of the engine's binary duel-message stream. Bounded but
   real work; the binary message format (`common.h` / `DyXel/ygopen`) has a learning curve.
3. **WASM build maturity (if we lean on it).** `ocgcore-wasm` is a small project with
   JSPI/stack-switching requirements and a multi-MB payload; needs validation across target
   browsers before we depend on it for anything load-bearing.
4. **Edison pool correctness at the edges.** Date filtering has promo/reprint edge cases and
   documented "printed-but-not-legal" exceptions; mitigated by a curated, founder-reviewed
   passcode whitelist rather than a naive date cut.

**Spikes to de-risk (in priority order):**
- **Spike 1 — Headless duel end-to-end.** Stand up the native core (or `ocgcore-wasm`) with a
  pinned `cards.cdb` + CardScripts snapshot and script a full scripted duel to completion,
  reading the duel-message stream and feeding responses. Proves the engine integrates and the
  message protocol is tractable. *(Also settles native-vs-WASM ergonomics.)*
- **Spike 2 — Edison dataset build.** Produce the frozen Edison passcode whitelist + Edison
  `lflist.conf`, and a self-hosted metadata+image store from a one-time YGOPRODeck pull;
  verify counts/edge cases against a known Edison card list.
- **Spike 3 — Two-client relay with hidden info.** Minimal WebSocket server that runs one
  authoritative core and drives two browser clients with correctly redacted per-player views.
- **Spike 0 (non-code) — Licensing decision.** Confirm the group accepts an AGPL project and
  that this stays private; record the decision (and revisit only if a public launch is considered).

**Confidence & what I could NOT verify firsthand (no code was run in this research):**
- *High confidence:* the ecosystem structure, the `cards.cdb` schema, the engine's headless/
  callback design and API surface, the YGOPRODeck API shape and terms, the AGPL/MIT license
  facts, and the Edison definition — all from primary sources (repo READMEs, the API guide,
  format sites), cited inline.
- *Medium confidence (needs a spike):* the *maturity and completeness* of `ocgcore-wasm`
  specifically, exact bundle sizes, and browser support for JSPI — I read its README but did
  not build or run it.
- *To confirm during Spike 2:* the precise Edison-legal card count and the exact list of
  "printed-in-window-but-banned/illegal" exceptions (the format sites describe these but I
  did not enumerate them here).
