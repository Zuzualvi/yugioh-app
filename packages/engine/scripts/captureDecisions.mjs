#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Decision catalog capture script — Phase 0 Deliverable A (FINAL)
// Captures real OcgMessage examples for all reproducible decision types.
// Run: node packages/engine/scripts/captureDecisions.mjs
// Output: docs/working/decision-capture-raw.json
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import createCore, { OcgLocation, OcgPosition, OcgProcessResult } from "ocgcore-wasm";
import Database from "better-sqlite3";

const __dir = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(__dir, "..");
const ASSETS_DIR = resolve(PACKAGE_DIR, "assets");
const VENDOR_DIR = resolve(PACKAGE_DIR, "vendor");
const SCRIPTS_DIR = resolve(ASSETS_DIR, "scripts");
const OVERRIDES_DIR = resolve(PACKAGE_DIR, "scripts", "edison-overrides");

// ── DB ───────────────────────────────────────────────────────────────────────
const db = new Database(resolve(ASSETS_DIR, "cards.cdb"), { readonly: true });
const cardStmt = db.prepare(
  `SELECT datas.id, datas.alias, datas.setcode, datas.type,
          datas.atk, datas.def, datas.level, datas.race,
          datas.attribute, datas.ot, datas.category
   FROM datas WHERE datas.id = ?`,
);

function getCard(code) {
  const row = cardStmt.get(code);
  if (!row) return null;
  return {
    code: row.id,
    alias: row.alias ?? 0,
    setcodes: row.setcode ? [row.setcode] : [],
    type: row.type,
    level: row.level & 0xff,
    attribute: row.attribute,
    race: BigInt(row.race),
    attack: row.atk,
    defense: row.def,
    lscale: (row.level >> 24) & 0xff,
    rscale: (row.level >> 16) & 0xff,
    link_marker: 0,
    ot: row.ot,
    category: row.category ?? 0,
  };
}

// ── Script loader ─────────────────────────────────────────────────────────────
function loadScript(name) {
  const isCard = /^c\d+\.lua$/.test(name) && name !== "c0.lua";
  const candidates = [];
  if (isCard) {
    candidates.push(
      resolve(OVERRIDES_DIR, name),
      resolve(SCRIPTS_DIR, "official", name),
      resolve(SCRIPTS_DIR, "pre-errata", name),
      resolve(SCRIPTS_DIR, "goat", name),
    );
  }
  candidates.push(resolve(SCRIPTS_DIR, name));
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch {}
    }
  }
  return null;
}

const WASM = readFileSync(resolve(VENDOR_DIR, "ocgcore-custom.sync.wasm")).buffer;
const EDISON_FLAGS = 0x7f80d072cn;
const FILLER = [32864, 1184620, 1761063, 1784619, 2118022];

function makeFiller(n) {
  const out = [];
  for (let i = 0; out.length < n; i++) out.push(FILLER[i % FILLER.length]);
  return out;
}

// ── BigInt-safe JSON ──────────────────────────────────────────────────────────
function safeReplacer(key, val) {
  if (typeof val === "bigint") return val.toString() + "n";
  return val;
}

// ── Duel factory ─────────────────────────────────────────────────────────────
async function createLib() {
  return createCore({ sync: true, wasmBinary: WASM });
}

function makeDuel(lib, opts) {
  const {
    deck0 = makeFiller(20),
    deck1 = makeFiller(20),
    deck0extra = [],
    deck1extra = [],
    extraCards0 = [],
    extraCards1 = [],
    seed = 42n,
  } = opts;
  const errors = [];
  const handle = lib.createDuel({
    flags: EDISON_FLAGS,
    seed: [seed, 0n, 0n, 0n],
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    cardReader: (c) => getCard(c) ?? null,
    scriptReader: loadScript,
    errorHandler: (_t, t) => {
      if (!t.includes("deprecated")) errors.push(t);
    },
  });
  if (!handle) throw new Error("createDuel returned null");
  for (const c of extraCards0)
    lib.duelNewCard(handle, {
      code: c.code,
      team: 0,
      duelist: 0,
      controller: 0,
      location: c.location,
      sequence: c.sequence ?? 0,
      position: c.position ?? OcgPosition.FACEUP,
    });
  for (const c of extraCards1)
    lib.duelNewCard(handle, {
      code: c.code,
      team: 1,
      duelist: 0,
      controller: 1,
      location: c.location,
      sequence: c.sequence ?? 0,
      position: c.position ?? OcgPosition.FACEUP,
    });
  for (const code of deck0)
    lib.duelNewCard(handle, {
      code,
      team: 0,
      duelist: 0,
      controller: 0,
      location: OcgLocation.DECK,
      sequence: 0,
      position: OcgPosition.FACEDOWN,
    });
  for (const code of deck1)
    lib.duelNewCard(handle, {
      code,
      team: 1,
      duelist: 0,
      controller: 1,
      location: OcgLocation.DECK,
      sequence: 0,
      position: OcgPosition.FACEDOWN,
    });
  for (const code of deck0extra)
    lib.duelNewCard(handle, {
      code,
      team: 0,
      duelist: 0,
      controller: 0,
      location: OcgLocation.EXTRA,
      sequence: 0,
      position: OcgPosition.FACEDOWN,
    });
  for (const code of deck1extra)
    lib.duelNewCard(handle, {
      code,
      team: 1,
      duelist: 0,
      controller: 1,
      location: OcgLocation.EXTRA,
      sequence: 0,
      position: OcgPosition.FACEDOWN,
    });
  lib.startDuel(handle);
  return { handle, errors };
}

// ── Field placement helper ────────────────────────────────────────────────────
function respondToPlace(m) {
  const fm = m.field_mask ?? 0;
  const shift = (m.player ?? 0) * 16;
  const pm = (fm >> shift) & 0xffff;
  for (let s = 0; s < 5; s++)
    if (!(pm & (1 << s)))
      return {
        type: 10,
        places: [{ player: m.player ?? 0, location: OcgLocation.MZONE, sequence: s }],
      };
  for (let s = 0; s < 5; s++)
    if (!(pm & (1 << (s + 8))))
      return {
        type: 10,
        places: [{ player: m.player ?? 0, location: OcgLocation.SZONE, sequence: s }],
      };
  return {
    type: 10,
    places: [{ player: m.player ?? 0, location: OcgLocation.SZONE, sequence: 0 }],
  };
}

// ── Default responder ─────────────────────────────────────────────────────────
function defaultRespond(msgs) {
  for (const m of msgs) {
    switch (m.type) {
      case 132:
        return { type: 20, value: 1 };
      case 11:
        return { type: 1, action: 7 };
      case 10:
        return { type: 0, action: 3 };
      case 12:
        return { type: 2, yes: false };
      case 13:
        return { type: 3, yes: false };
      case 16:
        return { type: 8, index: null };
      case 18:
        return respondToPlace(m);
      case 19:
        return { type: 11, position: m.positions & -m.positions };
      case 14:
        return { type: 4, index: 0 };
      case 15:
        return { type: 5, indicies: [0] };
      case 20:
        return { type: 12, indicies: [0] };
      case 21:
        return { type: 15, order: null };
      case 25:
        return { type: 15, order: null };
      case 26:
        return m.can_finish ? { type: 7, index: null } : { type: 7, index: 0 };
      case 140:
        return { type: 16, races: [1n] };
      case 141:
        return { type: 17, attributes: [1] };
      case 142:
        return { type: 18, card: 32864 };
      case 143:
        return { type: 19, value: 0 };
    }
  }
  return { type: 3, yes: false };
}

// ── Captured examples ─────────────────────────────────────────────────────────
const captured = {};
const capturedResponses = {};

function recordMsg(msg) {
  const names = {
    1: "RETRY",
    2: "HINT",
    3: "WAITING",
    4: "START",
    5: "WIN",
    10: "SELECT_BATTLECMD",
    11: "SELECT_IDLECMD",
    12: "SELECT_EFFECTYN",
    13: "SELECT_YESNO",
    14: "SELECT_OPTION",
    15: "SELECT_CARD",
    16: "SELECT_CHAIN",
    18: "SELECT_PLACE",
    19: "SELECT_POSITION",
    20: "SELECT_TRIBUTE",
    21: "SORT_CHAIN",
    22: "SELECT_COUNTER",
    23: "SELECT_SUM",
    24: "SELECT_DISFIELD",
    25: "SORT_CARD",
    26: "SELECT_UNSELECT_CARD",
    30: "CONFIRM_DECKTOP",
    31: "CONFIRM_CARDS",
    32: "SHUFFLE_DECK",
    33: "SHUFFLE_HAND",
    40: "NEW_TURN",
    41: "NEW_PHASE",
    50: "MOVE",
    53: "POS_CHANGE",
    54: "SET",
    60: "SUMMONING",
    61: "SUMMONED",
    62: "SPSUMMONING",
    63: "SPSUMMONED",
    64: "FLIPSUMMONING",
    65: "FLIPSUMMONED",
    70: "CHAINING",
    71: "CHAINED",
    72: "CHAIN_SOLVING",
    73: "CHAIN_SOLVED",
    74: "CHAIN_END",
    75: "CHAIN_NEGATED",
    76: "CHAIN_DISABLED",
    80: "CARD_SELECTED",
    81: "RANDOM_SELECTED",
    83: "BECOME_TARGET",
    90: "DRAW",
    91: "DAMAGE",
    92: "RECOVER",
    93: "EQUIP",
    94: "LPUPDATE",
    96: "CARD_TARGET",
    97: "CANCEL_TARGET",
    100: "PAY_LPCOST",
    110: "ATTACK",
    111: "BATTLE",
    112: "ATTACK_DISABLED",
    113: "DAMAGE_STEP_START",
    114: "DAMAGE_STEP_END",
    130: "TOSS_COIN",
    131: "TOSS_DICE",
    132: "ROCK_PAPER_SCISSORS",
    133: "HAND_RES",
    140: "ANNOUNCE_RACE",
    141: "ANNOUNCE_ATTRIB",
    142: "ANNOUNCE_CARD",
    143: "ANNOUNCE_NUMBER",
    160: "CARD_HINT",
    165: "PLAYER_HINT",
  };
  const name = names[msg.type] ?? `TYPE_${msg.type}`;
  if (!captured[name]) {
    captured[name] = msg;
    console.log(`  ✓ Captured ${name} (type=${msg.type})`);
  }
}

function recordResponse(msgType, response) {
  const names = {
    10: "SELECT_BATTLECMD",
    11: "SELECT_IDLECMD",
    12: "SELECT_EFFECTYN",
    13: "SELECT_YESNO",
    14: "SELECT_OPTION",
    15: "SELECT_CARD",
    16: "SELECT_CHAIN",
    18: "SELECT_PLACE",
    19: "SELECT_POSITION",
    20: "SELECT_TRIBUTE",
    21: "SORT_CHAIN",
    23: "SELECT_SUM",
    24: "SELECT_DISFIELD",
    25: "SORT_CARD",
    26: "SELECT_UNSELECT_CARD",
    132: "ROCK_PAPER_SCISSORS",
    140: "ANNOUNCE_RACE",
    141: "ANNOUNCE_ATTRIB",
    142: "ANNOUNCE_CARD",
    143: "ANNOUNCE_NUMBER",
  };
  const name = names[msgType];
  if (name && !capturedResponses[name]) capturedResponses[name] = response;
}

// ── Drive duel ─────────────────────────────────────────────────────────────────
function driveDuel(lib, handle, decide, maxIter = 8000) {
  const all = [];
  for (let i = 0; i < maxIter; i++) {
    const status = lib.duelProcess(handle);
    const msgs = lib.duelGetMessage(handle);
    for (const m of msgs) recordMsg(m);
    all.push(...msgs);
    if (status === OcgProcessResult.END) break;
    const dec = decide(all, msgs, status);
    if (dec?.stop) break;
    if (status === OcgProcessResult.WAITING) {
      const r = dec?.response ?? defaultRespond(msgs);
      // Record which response goes with which decision type
      const decMsg = msgs.find((m) => m.type !== 1) ?? msgs[0];
      if (decMsg) recordResponse(decMsg.type, r);
      lib.duelSetResponse(handle, r);
    }
  }
  return all;
}

// =============================================================================
// Run all scenarios
// =============================================================================

// S1: Basic start (SELECT_CHAIN, SELECT_IDLECMD)
console.log("\n=== S1: Basic duel start ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, { seed: 1n });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (_all.filter((m) => m.type === 11).length >= 3) return { stop: true };
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S2: Battle phase (SELECT_BATTLECMD, ATTACK, BATTLE) using pre-placed monsters
console.log("\n=== S2: Battle phase ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 2n,
    // Pre-place attacker and target on field
    extraCards0: [
      { code: 32864, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP },
    ],
    extraCards1: [
      { code: 1184620, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["BATTLE"] && _all.filter((m) => m.type === 40).length > 1) return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 4) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (m.to_bp) return { response: { type: 1, action: 6 } };
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 10) {
        if (m.attacks?.length > 0) return { response: { type: 0, action: 1, index: 0 } };
        return { response: { type: 0, action: 3 } };
      }
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S2b: Normal summon with SELECT_PLACE (using simple filler, no scripts)
console.log("\n=== S2b: Normal summon SELECT_PLACE ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, { deck0: makeFiller(20), deck1: makeFiller(20), seed: 22n });
  let summoned = false;
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["SELECT_PLACE"] && captured["SELECT_BATTLECMD"] && captured["BATTLE"])
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 5) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (!summoned && m.summons?.length > 0) {
          summoned = true;
          return { response: { type: 1, action: 0, index: 0 } };
        }
        if (m.to_bp) return { response: { type: 1, action: 6 } };
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 10) {
        if (m.attacks?.length > 0) return { response: { type: 0, action: 1, index: 0 } };
        return { response: { type: 0, action: 3 } };
      }
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S3: Tribute summon (SELECT_TRIBUTE, SELECT_POSITION) - Caius pre-placed in HAND
console.log("\n=== S3: Tribute summon ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 3n,
    // Pre-place Caius in HAND (not drawn from deck)
    extraCards0: [
      { code: 9748752, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
      { code: 32864, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP }, // tribute target
    ],
  });
  let done = false;
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["SELECT_TRIBUTE"] && _all.filter((m) => m.type === 40).length > 2)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 5) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        const ci = m.summons?.findIndex((x) => x.code === 9748752);
        if (ci >= 0 && !done) {
          done = true;
          return { response: { type: 1, action: 0, index: ci } };
        }
        return { response: { type: 1, action: 7 } };
      }
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S4: Synchro summon (SELECT_UNSELECT_CARD, SPSUMMONING)
console.log("\n=== S4: Synchro summon ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: [63977008, 63977008, ...makeFiller(18)],
    deck1: makeFiller(20),
    deck0extra: [60800381, 60800381],
    deck1extra: [44508094],
    extraCards0: [
      { code: 63977008, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP },
      { code: 23571046, location: OcgLocation.MZONE, sequence: 1, position: OcgPosition.FACEUP },
    ],
    seed: 4n,
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["SELECT_UNSELECT_CARD"] && _all.filter((m) => m.type === 40).length > 2)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 5) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (m.special_summons?.length > 0) return { response: { type: 1, action: 1, index: 0 } };
        return { response: { type: 1, action: 7 } };
      }
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S5: Treeborn Frog (SELECT_EFFECTYN)
console.log("\n=== S5: Treeborn Frog EFFECTYN ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: [12538374, ...makeFiller(19)],
    deck1: makeFiller(20),
    seed: 5n,
    extraCards0: [{ code: 12538374, location: OcgLocation.GRAVE, sequence: 0 }],
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["SELECT_EFFECTYN"] && _all.filter((m) => m.type === 40).length > 2)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 5) return { stop: true };
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S6: Flip summon (FLIPSUMMONING, FLIPSUMMONED)
console.log("\n=== S6: Flip summon ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 6n,
    extraCards0: [
      {
        code: 33508719,
        location: OcgLocation.MZONE,
        sequence: 0,
        position: OcgPosition.FACEDOWN_DEFENSE,
      },
    ],
  });
  let fl = false;
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["FLIPSUMMONED"] && _all.filter((m) => m.type === 40).length > 1)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 4) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (!fl && m.pos_changes?.length > 0) {
          fl = true;
          return { response: { type: 1, action: 2, index: 0 } };
        }
        return { response: { type: 1, action: 7 } };
      }
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S7: Select_yesno — Ryko Lightsworn Hunter
console.log("\n=== S7: SELECT_YESNO (Ryko) ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 7n,
    extraCards0: [
      {
        code: 21502796,
        location: OcgLocation.MZONE,
        sequence: 0,
        position: OcgPosition.FACEDOWN_DEFENSE,
      },
    ],
    extraCards1: [
      { code: 32864, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });
  let fl = false;
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["SELECT_YESNO"] && _all.filter((m) => m.type === 40).length > 2)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 4) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (!fl && m.pos_changes?.length > 0) {
          fl = true;
          return { response: { type: 1, action: 2, index: 0 } };
        }
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 13) return { response: { type: 3, yes: true } };
      if (m.type === 15) return { response: { type: 5, indicies: [0] } };
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S8: SELECT_OPTION — Enemy Controller
console.log("\n=== S8: SELECT_OPTION (Enemy Controller) ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 8n,
    extraCards0: [
      { code: 98045062, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
      { code: 32864, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP },
    ],
    extraCards1: [
      { code: 1184620, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["SELECT_OPTION"] && _all.filter((m) => m.type === 40).length > 1)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 4) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (m.activates?.length > 0) return { response: { type: 1, action: 5, index: 0 } };
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 14) return { response: { type: 4, index: 0 } };
      if (m.type === 15) return { response: { type: 5, indicies: [0] } };
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S9: ANNOUNCE_CARD — D.D. Designator
console.log("\n=== S9: ANNOUNCE_CARD (D.D. Designator) ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 9n,
    extraCards0: [
      { code: 33423043, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
    ],
    extraCards1: [
      { code: 32864, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["ANNOUNCE_CARD"] && _all.filter((m) => m.type === 40).length > 1)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 4) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (m.activates?.length > 0) return { response: { type: 1, action: 5, index: 0 } };
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 18) return { response: respondToPlace(m) };
      if (m.type === 142) return { response: { type: 18, card: 32864 } };
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S10: ANNOUNCE_RACE — DNA Surgery
console.log("\n=== S10: ANNOUNCE_RACE (DNA Surgery) ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 10n,
    extraCards0: [
      { code: 74701381, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["ANNOUNCE_RACE"] && _all.filter((m) => m.type === 40).length > 1)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 4) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (m.spell_sets?.length > 0) return { response: { type: 1, action: 4, index: 0 } };
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 18) return { response: respondToPlace(m) };
      if (m.type === 140) return { response: { type: 16, races: [1n] } };
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S11: ANNOUNCE_ATTRIB — Abyssal Designator
console.log("\n=== S11: ANNOUNCE_ATTRIB (Abyssal Designator) ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 11n,
    extraCards0: [
      { code: 89801755, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["ANNOUNCE_ATTRIB"] && _all.filter((m) => m.type === 40).length > 1)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 4) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (m.activates?.length > 0) return { response: { type: 1, action: 5, index: 0 } };
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 18) return { response: respondToPlace(m) };
      if (m.type === 141) return { response: { type: 17, attributes: [1] } };
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// S12: ANNOUNCE_NUMBER — Wall of Revealing Light
console.log("\n=== S12: ANNOUNCE_NUMBER (Wall of Revealing Light) ===");
{
  const lib = await createLib();
  const { handle } = makeDuel(lib, {
    deck0: makeFiller(20),
    deck1: makeFiller(20),
    seed: 12n,
    extraCards0: [
      { code: 17078030, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });
  driveDuel(lib, handle, (_all, msgs, _s) => {
    if (captured["ANNOUNCE_NUMBER"] && _all.filter((m) => m.type === 40).length > 1)
      return { stop: true };
    if (_all.filter((m) => m.type === 40).length > 5) return { stop: true };
    if (s !== OcgProcessResult.WAITING) return {};
    for (const m of msgs) {
      if (m.type === 11) {
        if (m.spell_sets?.some((x) => x.code === 17078030))
          return {
            response: {
              type: 1,
              action: 4,
              index: m.spell_sets.findIndex((x) => x.code === 17078030),
            },
          };
        if (m.activates?.length > 0) return { response: { type: 1, action: 5, index: 0 } };
        return { response: { type: 1, action: 7 } };
      }
      if (m.type === 18) return { response: respondToPlace(m) };
      if (m.type === 143) return { response: { type: 19, value: 0 } };
    }
    return { response: defaultRespond(msgs) };
  });
  lib.destroyDuel(handle);
}

// =============================================================================
// Summary
// =============================================================================
console.log("\n=== Decision Capture Summary ===");
const decisionTypes = [
  "ROCK_PAPER_SCISSORS",
  "SELECT_IDLECMD",
  "SELECT_BATTLECMD",
  "SELECT_EFFECTYN",
  "SELECT_YESNO",
  "SELECT_OPTION",
  "SELECT_CARD",
  "SELECT_CHAIN",
  "SELECT_PLACE",
  "SELECT_POSITION",
  "SELECT_TRIBUTE",
  "SELECT_SUM",
  "SELECT_DISFIELD",
  "SELECT_COUNTER",
  "SELECT_UNSELECT_CARD",
  "SORT_CARD",
  "SORT_CHAIN",
  "ANNOUNCE_RACE",
  "ANNOUNCE_ATTRIB",
  "ANNOUNCE_CARD",
  "ANNOUNCE_NUMBER",
];
for (const t of decisionTypes) {
  const status = captured[t] ? "✓ CAPTURED" : "✗ NOT CAPTURED";
  console.log(`  ${status}: ${t}`);
}

const output = {
  captured,
  capturedResponses,
  notReproducible: decisionTypes.filter((t) => !captured[t]),
};

const outDir = resolve(__dir, "../../../docs/working");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "decision-capture-raw.json");
writeFileSync(outPath, JSON.stringify(output, safeReplacer, 2));
console.log(`\nWritten to ${outPath}`);
