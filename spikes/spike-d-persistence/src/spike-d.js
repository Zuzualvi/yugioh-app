/**
 * Spike D — Durable Async Duel Persistence & Resume via Response-Log Replay
 *
 * Proves:
 *  D1 — Every committed response persisted to SQLite response_log
 *  D2 — Determinism: replay seed+flags+log through fresh core twice → identical state hash
 *  D3 — Restart/resume: discard in-memory core → rehydrate from log → same state hash
 *  D4 — Deadline math: elapsed deadline resolves as timeout loss for on-clock seat
 *  D5 — README verdict (see README.md)
 */

import createCore, {
  OcgDuelMode, OcgProcessResult, OcgMessageType, OcgLocation, OcgPosition,
} from 'ocgcore-wasm';
import BetterSQLite from 'better-sqlite3';
import { createHash } from 'crypto';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const VENDOR = resolve(__dir, '../vendor');
const CDB_PATH = resolve(VENDOR, 'cdb/cards.cdb');
const SCRIPT_PATH = resolve(VENDOR, 'scripts');

// ── Normal-monster filler IDs (no scripts needed) ─────────────────────────────
const FILLER_IDS = [
  32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
  2863439, 2906250, 3134241, 3170832, 3606209, 4042268, 4148264, 5053103,
  5265750, 5388481, 5434080, 5464695,
];

function fillerDeck(size = 20) {
  const deck = [];
  for (let i = 0; deck.length < size; i++) deck.push(FILLER_IDS[i % FILLER_IDS.length]);
  return deck;
}

// ── Card DB ───────────────────────────────────────────────────────────────────
let _cdb = null;
let _cardStmt = null;
function getCard(code) {
  if (!_cdb) {
    _cdb = new BetterSQLite(CDB_PATH, { readonly: true });
    _cardStmt = _cdb.prepare(
      `SELECT datas.id, datas.alias, datas.setcode, datas.type,
              datas.atk, datas.def, datas.level, datas.race,
              datas.attribute, datas.ot, datas.category
       FROM datas WHERE datas.id = ?`
    );
  }
  const r = _cardStmt.get(code);
  if (!r) return null;
  return {
    code: r.id, alias: r.alias || 0, setcodes: r.setcode ? [r.setcode] : [],
    type: r.type, attack: r.atk, defense: r.def,
    level: r.level & 0xFF, lscale: (r.level >> 24) & 0xFF, rscale: (r.level >> 16) & 0xFF,
    race: BigInt(r.race), attribute: r.attribute, linkMarker: 0,
    ot: r.ot, category: r.category || 0,
  };
}

// ── Script reader ─────────────────────────────────────────────────────────────
function getScript(name) {
  const isCard = /^c\d+\.lua$/.test(name);
  const paths = isCard
    ? [resolve(SCRIPT_PATH,'official',name), resolve(SCRIPT_PATH,'pre-errata',name), resolve(SCRIPT_PATH,'goat',name)]
    : [resolve(SCRIPT_PATH, name)];
  for (const p of paths) {
    if (existsSync(p)) { try { return readFileSync(p, 'utf-8'); } catch {} }
  }
  return null;
}

// ── OCG core factory ──────────────────────────────────────────────────────────
async function newLib() {
  return createCore({ sync: true });
}

// ── Duel creation ─────────────────────────────────────────────────────────────
const GOAT_FLAGS = OcgDuelMode.MODE_GOAT; // 0x3f80d072c

function createDuel(lib, seed, flags, deck1, deck2) {
  const errors = [];
  const handle = lib.createDuel({
    flags,
    seed,
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    cardReader:   (code) => { const c = getCard(code); if (!c) errors.push(`missing ${code}`); return c ?? null; },
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_t, text) => errors.push(text),
  });
  if (!handle) throw new Error('createDuel returned null');
  for (const code of deck1) {
    lib.duelNewCard(handle, { code, team:0, duelist:0, controller:0, location:OcgLocation.DECK, sequence:0, position:OcgPosition.FACEDOWN });
  }
  for (const code of deck2) {
    lib.duelNewCard(handle, { code, team:1, duelist:0, controller:1, location:OcgLocation.DECK, sequence:0, position:OcgPosition.FACEDOWN });
  }
  lib.startDuel(handle);
  return { handle, errors };
}

// ── Message type name ─────────────────────────────────────────────────────────
function msgName(type) {
  return Object.entries(OcgMessageType).find(([,v]) => v === type)?.[0] ?? `MSG#${type}`;
}

// ── Pass responder ────────────────────────────────────────────────────────────
function passRespond(msgs) {
  for (const msg of msgs) {
    switch (msg.type) {
      case OcgMessageType.SELECT_IDLECMD:   return { type:1, action:7 };
      case OcgMessageType.SELECT_BATTLECMD: return { type:0, action:3 };
      case OcgMessageType.SELECT_EFFECTYN:  return { type:2, yes:false };
      case OcgMessageType.SELECT_YESNO:     return { type:3, yes:false };
      case OcgMessageType.SELECT_CHAIN:     return { type:8, index:null };
      case OcgMessageType.ROCK_PAPER_SCISSORS: return { type:20, value:0 };
      case OcgMessageType.SELECT_PLACE:     return { type:10, places:[{ player:msg.player, location:OcgLocation.MZONE, sequence:0 }] };
      case OcgMessageType.SELECT_POSITION:  return { type:11, position: msg.positions & -msg.positions };
      case OcgMessageType.SELECT_OPTION:    return { type:4, index:0 };
      case OcgMessageType.SELECT_CARD:      return { type:5, indicies:[0] };
      case OcgMessageType.SELECT_TRIBUTE:   return { type:12, indicies:[0] };
      case OcgMessageType.SORT_CHAIN:
      case OcgMessageType.SORT_CARD:        return { type:15, order:null };
      default: break;
    }
  }
  return { type:3, yes:false };
}

// ── SQLite schema ─────────────────────────────────────────────────────────────
function openGameDb(path) {
  const db = new BetterSQLite(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS duel (
      id           TEXT PRIMARY KEY,
      seed_json    TEXT NOT NULL,
      duel_flags   TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      deadline_at  INTEGER,
      on_clock_seat INTEGER,
      status       TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS response_log (
      duel_id      TEXT NOT NULL REFERENCES duel(id),
      seq          INTEGER NOT NULL,
      seat         INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      received_at  INTEGER NOT NULL,
      PRIMARY KEY (duel_id, seq)
    );
  `);
  return db;
}

// ── Field state hasher ────────────────────────────────────────────────────────
/**
 * Compute a deterministic hash of duel state: messages stream emitted so far.
 * We hash the full ordered message stream (type + stringified content) for both seats.
 */
function hashMessages(messages) {
  const h = createHash('sha256');
  for (const m of messages) {
    h.update(JSON.stringify({ t: m.type, ...sanitizeMsg(m) }));
    h.update('\n');
  }
  return h.digest('hex');
}

function sanitizeMsg(m) {
  // Convert BigInts to strings for JSON serialization
  return JSON.parse(JSON.stringify(m, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
}

// ── Replay engine ─────────────────────────────────────────────────────────────
/**
 * Replay seed+flags+responses through a fresh core.
 * Returns { messages, lib, handle } — lib+handle remain alive for further queries.
 */
async function replayDuel(seed, flags, deck1, deck2, responses) {
  const lib = await newLib();
  const { handle } = createDuel(lib, seed, flags, deck1, deck2);

  const allMessages = [];
  let respIdx = 0;

  outer: for (let i = 0; i < 200000; i++) {
    const status = lib.duelProcess(handle);
    const msgs = lib.duelGetMessage(handle);
    for (const m of msgs) allMessages.push(m);

    if (status === OcgProcessResult.END) break;

    if (status === OcgProcessResult.WAITING) {
      if (respIdx < responses.length) {
        // Feed the persisted response
        lib.duelSetResponse(handle, responses[respIdx++]);
      } else {
        // No more persisted responses — stop here (mid-game rehydration point)
        break outer;
      }
    }
    // CONTINUE (2) — just loop
  }

  return { messages: allMessages, lib, handle };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Spike D — Durable Async Duel Persistence & Resume        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Clean up previous run
  const DB_PATH = resolve(__dir, '../spike-d-test.db');
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

  const db = openGameDb(DB_PATH);
  const deck = fillerDeck(20);
  const SEED = [1n, 2n, 3n, 4n];
  const FLAGS = GOAT_FLAGS;
  const DUEL_ID = 'spike-d-test-duel-001';

  // ── D1: Drive duel, persist every response ───────────────────────────────
  console.log('═══ D1: Log-driven duel ═══\n');

  const now = Date.now();
  const deadline = now + 30 * 60 * 1000; // 30 min from now

  // Insert duel record
  db.prepare(`INSERT INTO duel (id, seed_json, duel_flags, created_at, deadline_at, on_clock_seat, status)
              VALUES (?, ?, ?, ?, ?, ?, 'active')`)
    .run(DUEL_ID, JSON.stringify(SEED.map(String)), FLAGS.toString(16), now, deadline, 0);

  // Drive a duel to ~50 responses
  const lib1 = await newLib();
  const { handle: h1 } = createDuel(lib1, SEED, FLAGS, deck, [...deck]);

  const persistedResponses = [];
  const liveMessages = [];
  let seq = 0;
  let turnCount = 0;
  let targetResponses = 50;

  const insertResp = db.prepare(
    `INSERT INTO response_log (duel_id, seq, seat, response_json, received_at) VALUES (?, ?, ?, ?, ?)`
  );

  const d1start = performance.now();

  // Drive duel: collect targetResponses, then keep running until next WAITING/END
  // so the captured state matches the replay state (which also stops at next WAITING after last response).
  let gaveLastResponse = false;

  for (let i = 0; i < 200000; i++) {
    const status = lib1.duelProcess(h1);
    const msgs = lib1.duelGetMessage(h1);

    for (const m of msgs) {
      liveMessages.push(m);
      if (m.type === OcgMessageType.NEW_TURN) turnCount++;
      if (m.type === OcgMessageType.WIN) { targetResponses = 0; break; }
    }

    if (status === OcgProcessResult.END) break;

    if (status === OcgProcessResult.WAITING) {
      if (gaveLastResponse) {
        // We've just processed the last response and reached the next WAITING — stop here.
        // This matches the replay boundary.
        break;
      }
      // Determine which seat's turn it is (simplistic: from msgs)
      let seat = 0;
      for (const m of msgs) {
        if (m.player !== undefined) { seat = m.player; break; }
      }
      const resp = passRespond(msgs);
      // Persist
      const respAt = Date.now();
      insertResp.run(DUEL_ID, seq, seat, JSON.stringify(resp), respAt);
      persistedResponses.push(resp);
      lib1.duelSetResponse(h1, resp);
      seq++;
      if (persistedResponses.length >= targetResponses) {
        gaveLastResponse = true;
      }
    }
    // CONTINUE (2) — just loop
  }

  const d1ms = performance.now() - d1start;

  console.log(`  Duel driven to ${persistedResponses.length} responses, ${turnCount} turns`);
  console.log(`  ${liveMessages.length} messages collected`);
  console.log(`  Time for live run: ${d1ms.toFixed(1)} ms\n`);

  // Verify DB
  const logCount = db.prepare('SELECT COUNT(*) as c FROM response_log WHERE duel_id=?').get(DUEL_ID).c;
  const sample = db.prepare('SELECT seq, seat, response_json, received_at FROM response_log WHERE duel_id=? ORDER BY seq LIMIT 5').all(DUEL_ID);
  console.log(`  DB response_log rows: ${logCount}`);
  console.log('  First 5 log entries:');
  for (const r of sample) {
    console.log(`    seq=${r.seq} seat=${r.seat} resp=${r.response_json} at=${r.received_at}`);
  }
  const d1pass = logCount === persistedResponses.length && logCount > 0;
  console.log(`\n  [${d1pass ? 'PASS' : 'FAIL'}] D1: ${logCount}/${persistedResponses.length} responses persisted\n`);

  // Pre-restart state hash (from live run messages up to that point)
  const preRestartHash = hashMessages(liveMessages);
  console.log(`  Pre-restart message hash: ${preRestartHash}\n`);

  // ── D2: Determinism proof ────────────────────────────────────────────────
  console.log('═══ D2: Determinism proof ═══\n');

  // Load persisted responses from DB
  const dbResponses = db.prepare(
    'SELECT response_json FROM response_log WHERE duel_id=? ORDER BY seq'
  ).all(DUEL_ID).map(r => JSON.parse(r.response_json));

  const replayStart1 = performance.now();
  const replay1 = await replayDuel(SEED, FLAGS, deck, [...deck], dbResponses);
  const replay1ms = performance.now() - replayStart1;
  const hash1 = hashMessages(replay1.messages);

  const replayStart2 = performance.now();
  const replay2 = await replayDuel(SEED, FLAGS, deck, [...deck], dbResponses);
  const replay2ms = performance.now() - replayStart2;
  const hash2 = hashMessages(replay2.messages);

  console.log(`  Replay 1 hash:     ${hash1}`);
  console.log(`  Replay 2 hash:     ${hash2}`);
  console.log(`  Hashes match:      ${hash1 === hash2}`);
  console.log(`  Replay 1 msgs:     ${replay1.messages.length}`);
  console.log(`  Replay 2 msgs:     ${replay2.messages.length}`);
  console.log(`  Replay 1 time:     ${replay1ms.toFixed(1)} ms`);
  console.log(`  Replay 2 time:     ${replay2ms.toFixed(1)} ms`);

  const d2pass = hash1 === hash2;
  console.log(`\n  [${d2pass ? 'PASS' : 'FAIL'}] D2: Determinism ${d2pass ? 'CONFIRMED' : 'FAILED — NONDETERMINISM DETECTED'}\n`);

  if (!d2pass) {
    // Diagnose: find first diverging message
    const len = Math.min(replay1.messages.length, replay2.messages.length);
    for (let i = 0; i < len; i++) {
      const a = JSON.stringify(sanitizeMsg(replay1.messages[i]));
      const b = JSON.stringify(sanitizeMsg(replay2.messages[i]));
      if (a !== b) {
        console.error(`  DIVERGENCE at message index ${i}:`);
        console.error(`    Run1: ${a}`);
        console.error(`    Run2: ${b}`);
        break;
      }
    }
  }

  // ── D3: Restart/resume ───────────────────────────────────────────────────
  console.log('═══ D3: Restart/Resume ═══\n');
  console.log('  Simulating server restart: discarding in-memory core...');

  // "Forget" live handle — let it be GC'd (simulates restart)
  // Now rehydrate purely from DB
  const resumeStart = performance.now();
  const resume = await replayDuel(SEED, FLAGS, deck, [...deck], dbResponses);
  const resumeMs = performance.now() - resumeStart;
  const resumeHash = hashMessages(resume.messages);

  console.log(`  Pre-restart hash:  ${preRestartHash}`);
  console.log(`  Resume hash:       ${resumeHash}`);
  console.log(`  Hashes match:      ${preRestartHash === resumeHash}`);
  console.log(`  Resume time:       ${resumeMs.toFixed(1)} ms`);

  const d3pass = preRestartHash === resumeHash;
  console.log(`\n  [${d3pass ? 'PASS' : 'FAIL'}] D3: Resume ${d3pass ? 'matches pre-restart state' : 'MISMATCH — state diverged'}\n`);

  // ── D4: Deadline math ─────────────────────────────────────────────────────
  console.log('═══ D4: Deadline math ═══\n');

  // (a) Duel resumed BEFORE deadline — positive remaining
  const duelsRow = db.prepare('SELECT deadline_at, on_clock_seat FROM duel WHERE id=?').get(DUEL_ID);
  const remainingMs = duelsRow.deadline_at - Date.now();
  const remainingMin = (remainingMs / 60000).toFixed(1);
  console.log(`  (a) deadline_at = ${new Date(duelsRow.deadline_at).toISOString()}`);
  console.log(`      now         = ${new Date().toISOString()}`);
  console.log(`      remaining   = ${remainingMs} ms (${remainingMin} min)`);
  const d4aPass = remainingMs > 0;
  console.log(`      [${d4aPass ? 'PASS' : 'FAIL'}] D4a: positive remaining = ${d4aPass}\n`);

  // (b) Elapsed deadline → timeout loss for on-clock seat
  // Create a new duel with already-elapsed deadline
  const DUEL_ID2 = 'spike-d-timeout-duel';
  if (existsSync(DB_PATH)) {
    // Use same DB, insert expired duel
    const expiredDeadline = Date.now() - 5000; // 5 seconds ago
    db.prepare(`INSERT INTO duel (id, seed_json, duel_flags, created_at, deadline_at, on_clock_seat, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')`)
      .run(DUEL_ID2, JSON.stringify(SEED.map(String)), FLAGS.toString(16), Date.now() - 60000, expiredDeadline, 0);

    // Copy same responses (just to have a mid-game state)
    for (const r of sample) {
      try {
        db.prepare(`INSERT INTO response_log (duel_id, seq, seat, response_json, received_at) VALUES (?, ?, ?, ?, ?)`)
          .run(DUEL_ID2, r.seq, r.seat, r.response_json, r.received_at);
      } catch {}
    }
  }

  // On-resume deadline check
  function checkDeadlineOnResume(duelRow) {
    const now2 = Date.now();
    const remaining2 = duelRow.deadline_at - now2;
    if (remaining2 <= 0) {
      return {
        timedOut: true,
        loser: duelRow.on_clock_seat,
        reason: 'timeout',
        elapsed: now2 - duelRow.deadline_at,
      };
    }
    return { timedOut: false, remaining: remaining2 };
  }

  const expiredRow = db.prepare('SELECT deadline_at, on_clock_seat FROM duel WHERE id=?').get(DUEL_ID2);
  const timeoutResult = checkDeadlineOnResume(expiredRow);
  console.log(`  (b) Expired duel resume:`);
  console.log(`      deadline_at   = ${new Date(expiredRow.deadline_at).toISOString()}`);
  console.log(`      now           = ${new Date().toISOString()}`);
  console.log(`      timed_out     = ${timeoutResult.timedOut}`);
  if (timeoutResult.timedOut) {
    console.log(`      loser seat    = ${timeoutResult.loser}`);
    console.log(`      reason        = ${timeoutResult.reason}`);
    console.log(`      elapsed since deadline = ${timeoutResult.elapsed} ms`);
    // Update DB status
    db.prepare(`UPDATE duel SET status='timeout_loss' WHERE id=?`).run(DUEL_ID2);
    const updatedStatus = db.prepare('SELECT status FROM duel WHERE id=?').get(DUEL_ID2).status;
    console.log(`      DB status after resolve = '${updatedStatus}'`);
  }
  const d4bPass = timeoutResult.timedOut && timeoutResult.loser === 0 && timeoutResult.reason === 'timeout';
  console.log(`      [${d4bPass ? 'PASS' : 'FAIL'}] D4b: elapsed deadline → timeout loss for seat ${expiredRow.on_clock_seat}\n`);

  // ── Replay cost measurement ───────────────────────────────────────────────
  console.log('═══ Replay cost (50-response log) ═══\n');
  const ITERS = 5;
  const times = [];
  for (let i = 0; i < ITERS; i++) {
    const t0 = performance.now();
    await replayDuel(SEED, FLAGS, deck, [...deck], dbResponses);
    times.push(performance.now() - t0);
  }
  const avgMs = times.reduce((a,b) => a+b, 0) / times.length;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  console.log(`  ${dbResponses.length}-response log replay (${ITERS} runs):`);
  console.log(`    avg: ${avgMs.toFixed(1)} ms`);
  console.log(`    min: ${minMs.toFixed(1)} ms`);
  console.log(`    max: ${maxMs.toFixed(1)} ms`);
  console.log(`  → Pure replay is ${avgMs < 500 ? 'fast enough — no snapshotting needed at this scale' : 'slow — consider periodic snapshots'}\n`);

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  D1 [${d1pass ? 'PASS' : 'FAIL'}] ${logCount} responses persisted to SQLite`);
  console.log(`  D2 [${d2pass ? 'PASS' : 'FAIL'}] Determinism: two fresh replays → ${d2pass ? 'identical' : 'DIFFERENT'} state`);
  console.log(`  D3 [${d3pass ? 'PASS' : 'FAIL'}] Resume after restart → ${d3pass ? 'matches' : 'MISMATCHES'} pre-restart state`);
  console.log(`  D4a[${d4aPass ? 'PASS' : 'FAIL'}] Active deadline: ${remainingMin} min remaining`);
  console.log(`  D4b[${d4bPass ? 'PASS' : 'FAIL'}] Elapsed deadline: timeout loss for seat ${expiredRow.on_clock_seat}`);

  const allPass = d1pass && d2pass && d3pass && d4aPass && d4bPass;
  console.log(`\n  ${allPass ? '✅ ALL CHECKS PASS' : '❌ SOME CHECKS FAILED'}`);

  if (!allPass) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
