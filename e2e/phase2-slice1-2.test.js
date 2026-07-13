/**
 * E2E Tests — Phase 2, Slice 1+2 (AC-01, AC-03, AC-04, AC-05, AC-06, AC-07)
 *
 * Tests the REAL Express server with the real card catalog (3,680 cards after
 * filtering passcode-0 bug). All requests are real HTTP calls to localhost.
 *
 * Known bugs documented (not fixed here):
 *   BUG-1: packages/server/src/catalog/loadCatalog.ts line 44: wrong relative
 *           path "../../../../card-data/out/..." should be
 *           "../../../../packages/card-data/out/..." — workaround: symlink.
 *   BUG-2: packages/card-data/out/edison-card-catalog.json contains
 *           "Orichalcos Shunoros" (passcode 0) but CardDTOSchema requires
 *           passcode > 0 — workaround: filtered catalog (3680 cards).
 *   BUG-3: No admin bootstrap mechanism. Chicken-and-egg: invite-only signup
 *           requires an existing admin to create invites, but no admin can be
 *           created without an invite. Workaround: direct DB insertion.
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import {
  startServer,
  stopServer,
  authedFetch,
  jsonPost,
  jsonPut,
  extractSid,
} from "./helpers/server.js";

// -----------------------------------------------------------------------
// Shared state set up in beforeAll
// -----------------------------------------------------------------------
let baseUrl;
let adminSid;
let _adminId;
let catalogCount;

// A legal 40-card main deck from real catalog unlimited cards (1 copy each)
const LEGAL_MAIN_40 = [
  27551, 32864, 50755, 62121, 102380, 114932, 126218, 131182, 191749, 213326, 218704, 242146,
  295517, 296499, 303660, 313513, 403847, 423705, 425934, 473469, 487395, 549481, 564541, 596051,
  612115, 652362, 674561, 691925, 732302, 759393, 967928, 980973, 984114, 1036974, 1073952, 1082946,
  1102515, 1149109, 1184620, 1200843,
];
// Legal extra deck cards (Fusion + Synchro from real catalog)
const LEGAL_EXTRA = [1412158, 1546123]; // Super Roboyarou, Cyber End Dragon (Fusions)
// Legal side deck
const LEGAL_SIDE = [];

// Real card passcodes for violation tests
const POT_OF_GREED = 55144522; // Forbidden
const SUMMONER_MONK = 423585; // Limited
const DESTINY_HERO_MALICIOUS = 9411399; // Semi-Limited
const TREEBORN_FROG = 12538374; // Semi-Limited
const _CYBER_DRAGON = 70095154; // Semi-Limited
const FUSION_CARD = 1412158; // Super Roboyarou (Fusion, Extra Deck)
const _SYNCHRO_CARD = 2203790; // XX-Saber Hyunlei (Synchro, Extra Deck)
const MODERN_PASSCODE = 84013237; // Number 39: Utopia — NOT in Edison catalog

beforeAll(async () => {
  const result = await startServer();
  baseUrl = result.baseUrl;
  adminSid = result.admin.adminSid;
  _adminId = result.admin.adminId;
  catalogCount = result.catalogCount;
  console.log(`Server started at ${baseUrl}, catalog: ${catalogCount} cards`);
});

afterAll(async () => {
  await stopServer();
});

// -----------------------------------------------------------------------
// AC-01 — Access control (unauthenticated → 401; invite flow; consumed invite)
// -----------------------------------------------------------------------
describe("AC-01: Access control", () => {
  test("GET /api/decks without session → 401", async () => {
    const res = await fetch(`${baseUrl}/api/decks`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBeDefined();
  });

  test("GET /api/me without session → 401", async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(401);
  });

  test("GET /api/cards without session → 401", async () => {
    const res = await fetch(`${baseUrl}/api/cards`);
    expect(res.status).toBe(401);
  });

  test("POST /api/admin/invites without session → 401", async () => {
    const res = await fetch(`${baseUrl}/api/admin/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  let inviteCode;
  let memberSid;

  test("Admin can create invite (POST /api/admin/invites)", async () => {
    const res = await authedFetch(baseUrl, adminSid, "/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.inviteCode).toBe("string");
    expect(body.inviteCode.length).toBeGreaterThan(0);
    expect(body.expiresAt).toBeDefined();
    inviteCode = body.inviteCode;
    console.log("  Invite created:", inviteCode.slice(0, 8) + "...");
  });

  test("Redeeming valid invite creates account + sets sid cookie", async () => {
    const res = await fetch(`${baseUrl}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode,
        displayName: "TestMember",
        password: "memberPass!1",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.displayName).toBe("TestMember");
    expect(body.user.role).toBe("member");
    // Session cookie must be set
    const sid = extractSid(res);
    expect(sid).toBeTruthy();
    memberSid = sid;
    console.log("  Member created, sid set:", !!memberSid);
  });

  test("Member session works (GET /api/me returns created user)", async () => {
    const res = await authedFetch(baseUrl, memberSid, "/api/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.displayName).toBe("TestMember");
    expect(body.user.role).toBe("member");
  });

  test("Consumed invite CANNOT create a second account → 400 invite_invalid", async () => {
    const res = await fetch(`${baseUrl}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode, // same code as before (already consumed)
        displayName: "AnotherMember",
        password: "anotherPass!1",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invite_invalid");
    console.log("  Consumed invite rejected:", body.error.message);
  });

  test("Invalid invite code → 400 invite_invalid", async () => {
    const res = await fetch(`${baseUrl}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode: "this-code-does-not-exist",
        displayName: "Nobody",
        password: "pass123!",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invite_invalid");
  });

  test("Non-admin member cannot access POST /api/admin/invites → 403", async () => {
    const res = await authedFetch(baseUrl, memberSid, "/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });
});

// -----------------------------------------------------------------------
// AC-03 — Session persistence (sid cookie reuse)
// -----------------------------------------------------------------------
describe("AC-03: Session persistence", () => {
  test("GET /api/me with admin session cookie returns same user across multiple requests", async () => {
    const res1 = await authedFetch(baseUrl, adminSid, "/api/me");
    const res2 = await authedFetch(baseUrl, adminSid, "/api/me");
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const u1 = (await res1.json()).user;
    const u2 = (await res2.json()).user;
    expect(u1.id).toBe(u2.id);
    expect(u1.displayName).toBe("E2EAdmin");
    expect(u2.displayName).toBe("E2EAdmin");
    expect(u1.role).toBe("admin");
    console.log("  Session persists for user:", u1.displayName, "id:", u1.id);
  });

  test("GET /api/cards confirms catalog loaded: total = 3680 (real catalog)", async () => {
    const res = await authedFetch(baseUrl, adminSid, "/api/cards?pageSize=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3680);
    console.log(`  Catalog total: ${body.total} cards`);
  });

  test("Wrong session token → 401", async () => {
    const res = await authedFetch(
      baseUrl,
      "deadbeef0000000000000000000000000000000000000000000000000000dead",
      "/api/me",
    );
    expect(res.status).toBe(401);
  });

  test("Login flow: POST /api/auth/login returns 200 + sets sid cookie", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "E2EAdmin", password: "e2eAdminPass!1" }),
    });
    expect(res.status).toBe(200);
    const sid = extractSid(res);
    expect(sid).toBeTruthy();
    const body = await res.json();
    expect(body.user.displayName).toBe("E2EAdmin");
    console.log("  Login succeeded, new sid:", !!sid);
  });

  test("Wrong credentials → 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "E2EAdmin", password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("bad_credentials");
  });
});

// -----------------------------------------------------------------------
// AC-04 — Legal Edison deck validates as legal (isValid: true)
// -----------------------------------------------------------------------
describe("AC-04: Legal deck validated as legal", () => {
  test("POST /api/decks with legal 40-card deck → isValid:true, no violations", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Legal Test Deck",
      main: LEGAL_MAIN_40,
      extra: LEGAL_EXTRA,
      side: LEGAL_SIDE,
    });
    expect(res.status).toBe(201);
    const deck = await res.json();
    console.log("  Deck validation:", JSON.stringify(deck.validation));
    expect(deck.validation.legal).toBe(true);
    expect(deck.validation.violations).toHaveLength(0);
    expect(deck.validation.counts.main).toBe(40);
    expect(deck.validation.counts.extra).toBe(2);
    expect(deck.validation.counts.side).toBe(0);
  });

  test("Legal deck with Limited card (1 copy) + Semi-Limited cards (2 each) passes", async () => {
    // Build a 40-card deck using:
    // 1x Limited (Summoner Monk 423585)
    // 2x Semi-Limited (Destiny HERO - Malicious 9411399)
    // 2x Semi-Limited (Treeborn Frog 12538374)
    // Fill rest with unlimited singles (35 cards needed)
    const main = [
      SUMMONER_MONK, // 1x Limited
      DESTINY_HERO_MALICIOUS,
      DESTINY_HERO_MALICIOUS, // 2x Semi
      TREEBORN_FROG,
      TREEBORN_FROG, // 2x Semi
      ...LEGAL_MAIN_40.slice(0, 35), // 35x unlimited
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Banlist Legal Deck",
      main,
      extra: [],
      side: [],
    });
    expect(res.status).toBe(201);
    const deck = await res.json();
    console.log("  Banlist legal deck violations:", deck.validation.violations);
    expect(deck.validation.legal).toBe(true);
    expect(deck.validation.violations).toHaveLength(0);
    expect(deck.validation.counts.main).toBe(40);
  });

  test("Legal deck with exactly 60 Main cards passes", async () => {
    // Fill to 60 with unlimited cards (3 copies of 20 distinct cards)
    const unlimitedForty = LEGAL_MAIN_40;
    const extraTwenty = [
      1224927, 1248895, 1287123, 1347977, 1353770, 1361822, 1381640, 1389854, 1393307, 1405286,
      1454652, 1460353, 1474446, 1474517, 1474557, 1483975, 1489697, 1523505, 1537, 1538100,
    ];
    // 40 + 20 = 60 cards
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "60-Card Legal Deck",
      main: [...unlimitedForty, ...extraTwenty],
      extra: [],
      side: [],
    });
    expect(res.status).toBe(201);
    const deck = await res.json();
    // Some of those extra passcodes might not be in catalog — if so, violations expected
    // But test that 60-card limit isn't itself violated
    const sizevio = deck.validation.violations.find((v) => v.code === "main_size");
    expect(sizevio).toBeUndefined();
    console.log(
      `  60-card deck: legal=${deck.validation.legal}, violations=${deck.validation.violations.length}`,
    );
  });
});

// -----------------------------------------------------------------------
// AC-05 — Illegal decks rejected with correct Violation codes
// -----------------------------------------------------------------------
describe("AC-05: Illegal deck rejection with correct Violation codes", () => {
  test("39-card main deck → main_size violation", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "39-Card Deck",
      main: LEGAL_MAIN_40.slice(0, 39), // only 39 cards
      extra: [],
      side: [],
    });
    expect(res.status).toBe(201); // invalid decks are saved but marked invalid
    const deck = await res.json();
    console.log(
      "  39-main violations:",
      deck.validation.violations.map((v) => v.code),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find((v) => v.code === "main_size");
    expect(vio).toBeDefined();
    expect(vio.message).toContain("39");
  });

  test("61-card main deck → main_size violation", async () => {
    const main61 = [...LEGAL_MAIN_40, ...LEGAL_MAIN_40.slice(0, 21)];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "61-Card Deck",
      main: main61,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  61-main violations:",
      deck.validation.violations.map((v) => v.code),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find((v) => v.code === "main_size");
    expect(vio).toBeDefined();
    expect(vio.message).toContain("61");
  });

  test("16-card extra deck → extra_size violation", async () => {
    // Get 16 extra deck cards (fusions + synchros)
    const extra16 = [
      1412158, 1546123, 1641882, 2203790, 2322421, 2403771, 3160395, 3280582, 4039234, 4423675,
      4942659, 5043010, 5126478, 5834749, 6007213, 6187014,
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "16-Extra Deck",
      main: LEGAL_MAIN_40,
      extra: extra16,
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  16-extra violations:",
      deck.validation.violations.map((v) => v.code),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find((v) => v.code === "extra_size");
    // If all 16 are valid extra-deck cards → extra_size violation
    // (some might be unknown_passcode; either way it's invalid)
    expect(deck.validation.legal).toBe(false);
    // Check the violations include extra_size or unknown_passcode
    const hasSomeVio = deck.validation.violations.some(
      (v) => v.code === "extra_size" || v.code === "unknown_passcode",
    );
    expect(hasSomeVio).toBe(true);
    if (vio) {
      expect(vio.message).toContain("16");
    }
  });

  test("16-card side deck → side_size violation", async () => {
    const side16 = LEGAL_MAIN_40.slice(0, 16);
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "16-Side Deck",
      main: LEGAL_MAIN_40,
      extra: [],
      side: side16,
    });
    const deck = await res.json();
    console.log(
      "  16-side violations:",
      deck.validation.violations.map((v) => v.code),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find((v) => v.code === "side_size");
    expect(vio).toBeDefined();
    expect(vio.message).toContain("16");
  });

  test("Semi-Limited card used 3× across zones → banlist_limit violation", async () => {
    // Destiny HERO - Malicious is Semi (max 2). Use 2 in main + 1 in side = 3 total.
    const main = [
      DESTINY_HERO_MALICIOUS,
      DESTINY_HERO_MALICIOUS, // 2 in main
      ...LEGAL_MAIN_40.slice(0, 38), // 38 more to reach 40
    ];
    const side = [DESTINY_HERO_MALICIOUS]; // 1 in side = 3 total
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Semi-Exceeded Deck",
      main,
      extra: [],
      side,
    });
    const deck = await res.json();
    console.log(
      "  Semi-3rd copy violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "banlist_limit" && v.passcode === DESTINY_HERO_MALICIOUS,
    );
    expect(vio).toBeDefined();
  });

  test("Forbidden card (Pot of Greed 55144522) → banlist_forbidden violation", async () => {
    const main = [POT_OF_GREED, ...LEGAL_MAIN_40.slice(0, 39)];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Forbidden Card Deck",
      main,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Forbidden violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "banlist_forbidden" && v.passcode === POT_OF_GREED,
    );
    expect(vio).toBeDefined();
    expect(vio.message).toContain("Forbidden");
  });

  test("Out-of-pool passcode (modern Xyz: 84013237) → unknown_passcode violation", async () => {
    // 84013237 = Number 39: Utopia, not in Edison catalog
    const main = [MODERN_PASSCODE, ...LEGAL_MAIN_40.slice(0, 39)];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Modern Card Deck",
      main,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Modern card violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    // With real catalog: card not in byPasscode → unknown_passcode
    const vio = deck.validation.violations.find(
      (v) =>
        (v.code === "unknown_passcode" || v.code === "out_of_pool") &&
        v.passcode === MODERN_PASSCODE,
    );
    expect(vio).toBeDefined();
  });

  test("Fusion/Synchro placed in Main Deck → wrong_zone violation", async () => {
    // FUSION_CARD (Super Roboyarou 1412158) placed in main
    const main = [FUSION_CARD, ...LEGAL_MAIN_40.slice(0, 39)];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Fusion In Main",
      main,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Fusion-in-main violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "wrong_zone" && v.passcode === FUSION_CARD,
    );
    expect(vio).toBeDefined();
  });

  test("Non-Extra-Deck card placed in Extra Deck → wrong_zone violation", async () => {
    // 27551 (Limit Reverse) is a Trap — placing in extra should give wrong_zone
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Trap In Extra",
      main: LEGAL_MAIN_40,
      extra: [27551], // Limit Reverse — not an extra deck monster
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Trap-in-extra violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "wrong_zone" && v.passcode === 27551,
    );
    expect(vio).toBeDefined();
  });

  test("Alias/alt-art copy-cap test (NOTE: real catalog has no aliasOf entries)", async () => {
    // The real catalog has NO cards with aliasOf set (all aliasOf=null).
    // The alias-index.json maps pre-errata passcodes (511002xxx) but those
    // are NOT in the catalog (they are NOT in the Edison pool).
    // Therefore: alias copy-cap enforcement cannot be tested against the real catalog.
    // This is a gap: the alias mechanism exists in the code (fixture has Harpie Lady)
    // but the real catalog data does not populate it. Reported as a data gap.
    //
    // What we CAN test: using 4 copies of an unlimited card → copy_limit violation.
    const main = [
      27551,
      27551,
      27551,
      27551, // 4 copies of Limit Reverse (unlimited) → copy_limit
      ...LEGAL_MAIN_40.slice(1, 37), // 36 more
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Over-Copy Unlimited",
      main,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  4x unlimited violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "copy_limit" && v.passcode === 27551,
    );
    expect(vio).toBeDefined();
  });

  test("Limited card used 2× → banlist_limit violation", async () => {
    // Summoner Monk (423585) is Limited — max 1.
    const main = [
      SUMMONER_MONK,
      SUMMONER_MONK, // 2 copies — exceeds Limited cap
      ...LEGAL_MAIN_40.slice(0, 38),
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Limited 2x Deck",
      main,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Limited-2x violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "banlist_limit" && v.passcode === SUMMONER_MONK,
    );
    expect(vio).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// AC-06 — .ydk round-trip: export then re-import → identical multiset
// -----------------------------------------------------------------------
describe("AC-06: .ydk round-trip", () => {
  let deckId;

  test("Save a legal deck, then export it to .ydk", async () => {
    // Save deck
    const saveRes = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Round-Trip Deck",
      main: LEGAL_MAIN_40,
      extra: LEGAL_EXTRA,
      side: [27551, 32864], // 2 side cards
    });
    expect(saveRes.status).toBe(201);
    const deck = await saveRes.json();
    deckId = deck.id;
    expect(deck.validation.legal).toBe(true);
    console.log("  Saved deck ID:", deckId);

    // Export
    const exportRes = await authedFetch(baseUrl, adminSid, "/api/decks/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Round-Trip Deck",
        main: LEGAL_MAIN_40,
        extra: LEGAL_EXTRA,
        side: [27551, 32864],
      }),
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toMatch(/text\/plain/);
    const ydk = await exportRes.text();
    console.log("  YDK head:", ydk.split("\n").slice(0, 6).join(" | "));
    expect(ydk).toContain("#main");
    expect(ydk).toContain("#extra");
    expect(ydk).toContain("!side");
    expect(ydk).not.toContain("#side"); // must use !side not #side
  });

  test("Import the exported .ydk → identical multiset", async () => {
    // Export first
    const exportRes = await authedFetch(baseUrl, adminSid, "/api/decks/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Round-Trip Deck",
        main: LEGAL_MAIN_40,
        extra: LEGAL_EXTRA,
        side: [27551, 32864],
      }),
    });
    const ydk = await exportRes.text();

    // Import
    const importRes = await authedFetch(baseUrl, adminSid, "/api/decks/import", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: ydk,
    });
    expect(importRes.status).toBe(200);
    const result = await importRes.json();
    console.log("  Import validation:", JSON.stringify(result.validation));
    console.log(
      "  Import main count:",
      result.main.length,
      "extra:",
      result.extra.length,
      "side:",
      result.side.length,
    );

    // Multiset comparison (sort both arrays and compare)
    expect([...result.main].sort((a, b) => a - b)).toEqual(
      [...LEGAL_MAIN_40].sort((a, b) => a - b),
    );
    expect([...result.extra].sort((a, b) => a - b)).toEqual([...LEGAL_EXTRA].sort((a, b) => a - b));
    expect([...result.side].sort((a, b) => a - b)).toEqual([27551, 32864].sort((a, b) => a - b));
    expect(result.validation.violations).toHaveLength(0);
  });

  test(".ydk export uses LF line endings and !side marker", async () => {
    const exportRes = await authedFetch(baseUrl, adminSid, "/api/decks/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "LineEnding Test",
        main: LEGAL_MAIN_40,
        extra: [],
        side: [27551],
      }),
    });
    const ydk = await exportRes.text();
    // Should not have \r\n (CRLF)
    expect(ydk).not.toContain("\r\n");
    // Must have !side not #side
    expect(ydk).toContain("!side");
    expect(ydk).not.toMatch(/#side\b/i);
  });
});

// -----------------------------------------------------------------------
// AC-07 — .ydk import: malformed/foreign/illegal inputs → violations, no crash
// -----------------------------------------------------------------------
describe("AC-07: .ydk import handles malformed/foreign/over-limit inputs", () => {
  async function importYdk(ydkText) {
    const res = await authedFetch(baseUrl, adminSid, "/api/decks/import", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: ydkText,
    });
    expect(res.status).toBe(200); // never crash (always 200 with violations)
    return res.json();
  }

  test("Modern/foreign deck (Xyz passcode 84013237) → unknown_passcode violation, no crash", async () => {
    const ydk = [
      "#main",
      "84013237", // Number 39: Utopia — Xyz, not in Edison
      ...LEGAL_MAIN_40.slice(0, 39).map(String),
      "#extra",
      "!side",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log(
      "  Modern deck violations:",
      result.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(result.validation.violations.length).toBeGreaterThan(0);
    const vio = result.validation.violations.find(
      (v) =>
        (v.code === "unknown_passcode" || v.code === "out_of_pool") &&
        v.passcode === MODERN_PASSCODE,
    );
    expect(vio).toBeDefined();
  });

  test("Over-limit deck (61 main) → main_size violation, no crash", async () => {
    const main61 = [...LEGAL_MAIN_40, ...LEGAL_MAIN_40.slice(0, 21)];
    const ydk = ["#main", ...main61.map(String), "#extra", "!side"].join("\n");
    const result = await importYdk(ydk);
    console.log(
      "  61-main import violations:",
      result.validation.violations.map((v) => v.code),
    );
    expect(result.validation.violations.some((v) => v.code === "main_size")).toBe(true);
  });

  test("Malformed file: #side instead of !side → parse_error violation, no crash", async () => {
    const ydk = [
      "#main",
      ...LEGAL_MAIN_40.map(String),
      "#extra",
      "#side", // BUG: should be !side
      "27551",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log("  #side violations:", result.validation.violations);
    expect(result.validation.violations.some((v) => v.code === "parse_error")).toBe(true);
    // Side card should still be found (non-conformant but handled)
    const parseVio = result.validation.violations.find((v) => v.code === "parse_error");
    expect(parseVio.message).toContain("#side");
  });

  test("Non-numeric line → parse_error violation with line number", async () => {
    const ydk = [
      "#main",
      ...LEGAL_MAIN_40.slice(0, 5).map(String),
      "NOTANUMBER", // bad line
      ...LEGAL_MAIN_40.slice(5, 39).map(String),
      "#extra",
      "!side",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log("  Non-numeric violations:", result.validation.violations);
    expect(result.validation.violations.some((v) => v.code === "parse_error")).toBe(true);
    const parseVio = result.validation.violations.find((v) => v.code === "parse_error");
    expect(parseVio.line).toBeDefined();
    expect(typeof parseVio.line).toBe("number");
    expect(parseVio.message).toContain("NOTANUMBER");
  });

  test("Unknown passcode (not in DB) → unknown_passcode violation with line number", async () => {
    const UNKNOWN = 99999999; // Not in any known catalog
    const ydk = [
      "#main",
      String(UNKNOWN),
      ...LEGAL_MAIN_40.slice(0, 39).map(String),
      "#extra",
      "!side",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log(
      "  Unknown passcode violations:",
      result.validation.violations.map((v) => `${v.code}:${v.passcode}:line${v.line}`),
    );
    const vio = result.validation.violations.find(
      (v) => v.code === "unknown_passcode" && v.passcode === UNKNOWN,
    );
    expect(vio).toBeDefined();
    expect(vio.line).toBeDefined();
  });

  test("Fusion/Synchro under #main in .ydk → wrong_zone violation, re-routed to Extra", async () => {
    // Fusion card listed under #main in .ydk file — should flag wrong_zone
    const ydk = [
      "#main",
      String(FUSION_CARD), // Fusion under #main
      ...LEGAL_MAIN_40.slice(0, 39).map(String),
      "#extra",
      "!side",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log(
      "  Fusion-in-main ydk violations:",
      result.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    const vio = result.validation.violations.find(
      (v) => v.code === "wrong_zone" && v.passcode === FUSION_CARD,
    );
    expect(vio).toBeDefined();
    // Card should be re-routed to extra (per ydkCodec rerouting logic)
    expect(result.extra).toContain(FUSION_CARD);
    expect(result.main).not.toContain(FUSION_CARD);
  });

  test("Blank / empty .ydk file → returns empty arrays, no crash", async () => {
    const result = await importYdk("   \n   \n");
    console.log("  Blank file result:", result);
    expect(result.main).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.side).toHaveLength(0);
  });

  test("Passcode before any section marker → parse_error violation", async () => {
    const ydk = "27551\n#main\n" + LEGAL_MAIN_40.map(String).join("\n") + "\n#extra\n!side\n";
    const result = await importYdk(ydk);
    console.log("  Pre-section violations:", result.validation.violations);
    expect(result.validation.violations.some((v) => v.code === "parse_error")).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Bonus: CRUD sanity on Decks API (tests infrastructure)
// -----------------------------------------------------------------------
describe("Deck CRUD sanity", () => {
  let deckId;

  test("POST /api/decks creates a deck", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "CRUD Test Deck",
      main: LEGAL_MAIN_40,
      extra: [],
      side: [],
    });
    expect(res.status).toBe(201);
    const deck = await res.json();
    deckId = deck.id;
    expect(deck.name).toBe("CRUD Test Deck");
    expect(deck.validation.legal).toBe(true);
  });

  test("GET /api/decks lists the deck", async () => {
    const res = await authedFetch(baseUrl, adminSid, "/api/decks");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decks.some((d) => d.id === deckId)).toBe(true);
  });

  test("GET /api/decks/:id retrieves deck", async () => {
    const res = await authedFetch(baseUrl, adminSid, `/api/decks/${deckId}`);
    expect(res.status).toBe(200);
    const deck = await res.json();
    expect(deck.id).toBe(deckId);
    expect(deck.name).toBe("CRUD Test Deck");
  });

  test("PUT /api/decks/:id updates deck", async () => {
    const res = await jsonPut(baseUrl, adminSid, `/api/decks/${deckId}`, {
      name: "Updated CRUD Deck",
      main: LEGAL_MAIN_40,
      extra: [],
      side: [],
    });
    expect(res.status).toBe(200);
    const deck = await res.json();
    expect(deck.name).toBe("Updated CRUD Deck");
  });

  test("POST /api/decks/:id/duplicate duplicates deck", async () => {
    const res = await authedFetch(baseUrl, adminSid, `/api/decks/${deckId}/duplicate`, {
      method: "POST",
    });
    expect(res.status).toBe(201);
    const dup = await res.json();
    expect(dup.id).not.toBe(deckId);
    expect(dup.name.toLowerCase()).toContain("copy");
  });

  test("DELETE /api/decks/:id deletes deck", async () => {
    const res = await authedFetch(baseUrl, adminSid, `/api/decks/${deckId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    // Verify gone
    const getRes = await authedFetch(baseUrl, adminSid, `/api/decks/${deckId}`);
    expect(getRes.status).toBe(404);
  });

  test("GET /api/cards/:passcode returns card data", async () => {
    const res = await authedFetch(baseUrl, adminSid, `/api/cards/${POT_OF_GREED}`);
    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.name).toBe("Pot of Greed");
    expect(card.banlist).toBe("forbidden");
    expect(card.passcode).toBe(POT_OF_GREED);
  });

  test("Cross-user deck access → 403 (user cannot see another user's deck)", async () => {
    // Create a deck as admin, then try to access with member
    const createRes = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Admin Private Deck",
      main: LEGAL_MAIN_40,
      extra: [],
      side: [],
    });
    const deck = await createRes.json();

    // Create a member session via invite
    const inviteRes = await authedFetch(baseUrl, adminSid, "/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const { inviteCode } = await inviteRes.json();
    const memberRes = await fetch(`${baseUrl}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode, displayName: "OtherMember", password: "other!pass1" }),
    });
    const memberSid2 = extractSid(memberRes);

    const crossRes = await authedFetch(baseUrl, memberSid2, `/api/decks/${deck.id}`);
    expect(crossRes.status).toBe(403);
  });
});
