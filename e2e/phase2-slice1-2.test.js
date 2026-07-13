/**
 * E2E Tests — Phase 2, Slice 1+2 (AC-01, AC-03, AC-04, AC-05, AC-06, AC-07)
 *
 * Real HTTP requests against the live Express server + real 3,681-card catalog.
 * No workarounds. All three bugs fixed upstream; alias resolution wired (177 entries).
 *
 * Alias tests exercise:
 *   (a) Pre-errata passcode (Brionac 511002993 → base 50321796, Limited):
 *       legal as single copy; banlist_limit when combined with base copy.
 *   (b) Alt-art alias (Harpie Lady 2 / 3 → Harpie Lady 76812113, unlimited):
 *       3× base + 1× alias = 4 copies → copy_limit (REQ-DECK-06).
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
// Shared state populated in beforeAll
// -----------------------------------------------------------------------
let baseUrl;
let adminSid;
let catalogCount;

// Legal 40-card main deck — all unlimited, all real passcodes from the Edison pool.
const LEGAL_MAIN_40 = [
  27551, 32864, 50755, 62121, 102380, 114932, 126218, 131182, 191749, 213326, 218704, 242146,
  295517, 296499, 303660, 313513, 403847, 423705, 425934, 473469, 487395, 549481, 564541, 596051,
  612115, 652362, 674561, 691925, 732302, 759393, 967928, 980973, 984114, 1036974, 1073952, 1082946,
  1102515, 1149109, 1184620, 1200843,
];

// Legal extra deck (Fusion + Synchro from real catalog)
const LEGAL_EXTRA = [1412158, 1546123]; // Super Roboyarou (Fusion), Cyber End Dragon (Fusion)

// Passcodes used in violation tests
const POT_OF_GREED = 55144522; // Forbidden
const SUMMONER_MONK = 423585; // Limited (main deck)
const DESTINY_HERO_MALICIOUS = 9411399; // Semi-Limited
const TREEBORN_FROG = 12538374; // Semi-Limited
const FUSION_CARD = 1412158; // Super Roboyarou — Fusion/Extra Deck
const MODERN_PASSCODE = 84013237; // Number 39: Utopia — NOT in Edison catalog

// Alias passcodes (from alias-index.json, 177 entries)
const BRIONAC_BASE = 50321796; // Brionac, Dragon of the Ice Barrier — Limited, Synchro/Extra
const BRIONAC_ALIAS = 511002993; // Pre-errata alias → resolves to BRIONAC_BASE
const HARPIE_LADY_BASE = 76812113; // Harpie Lady — unlimited, main deck
const HARPIE_LADY_2 = 27927359; // Harpie Lady 2 — alt-art alias → HARPIE_LADY_BASE

beforeAll(async () => {
  const result = await startServer();
  baseUrl = result.baseUrl;
  adminSid = result.admin.adminSid;

  // Confirm real catalog is loaded
  const res = await authedFetch(baseUrl, adminSid, "/api/cards?pageSize=1");
  const body = await res.json();
  catalogCount = body.total;
  console.log(`Server at ${baseUrl} — catalog: ${catalogCount} cards`);
});

afterAll(async () => {
  await stopServer();
});

// -----------------------------------------------------------------------
// AC-01 — Access control
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

  test("Admin can create invite (POST /api/admin/invites → 201)", async () => {
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
    console.log("  Invite created:", inviteCode.slice(0, 8) + "…");
  });

  test("Redeeming valid invite creates account and sets sid cookie", async () => {
    const res = await fetch(`${baseUrl}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode, displayName: "TestMember", password: "memberPass!1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.displayName).toBe("TestMember");
    expect(body.user.role).toBe("member");
    memberSid = extractSid(res);
    expect(memberSid).toBeTruthy();
    console.log("  Member created, cookie set:", !!memberSid);
  });

  test("Member session works — GET /api/me returns created user", async () => {
    const res = await authedFetch(baseUrl, memberSid, "/api/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.displayName).toBe("TestMember");
    expect(body.user.role).toBe("member");
  });

  test("Consumed invite cannot create a second account → 400 invite_invalid", async () => {
    const res = await fetch(`${baseUrl}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode, displayName: "AnotherMember", password: "another!1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invite_invalid");
    console.log("  Consumed invite rejected:", body.error.message);
  });

  test("Non-existent invite code → 400 invite_invalid", async () => {
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

  test("Member cannot access POST /api/admin/invites → 403", async () => {
    const res = await authedFetch(baseUrl, memberSid, "/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });
});

// -----------------------------------------------------------------------
// AC-03 — Session persistence
// -----------------------------------------------------------------------
describe("AC-03: Session persistence", () => {
  test("Same sid cookie returns identical user across multiple GET /api/me calls", async () => {
    const [res1, res2] = await Promise.all([
      authedFetch(baseUrl, adminSid, "/api/me"),
      authedFetch(baseUrl, adminSid, "/api/me"),
    ]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const u1 = (await res1.json()).user;
    const u2 = (await res2.json()).user;
    expect(u1.id).toBe(u2.id);
    expect(u1.role).toBe("admin");
    console.log("  Session stable for:", u1.displayName, u1.id);
  });

  test("Real catalog loaded — GET /api/cards total is 3681", async () => {
    const res = await authedFetch(baseUrl, adminSid, "/api/cards?pageSize=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    // 3681 total: Shunoros remapped from passcode 0 → 7634581 (BUG-2 fix);
    // no passcode-0 filtering needed, all 3681 are valid.
    expect(body.total).toBe(3681);
    console.log(`  Catalog total: ${body.total}`);
  });

  test("Invalid sid → 401", async () => {
    const res = await authedFetch(
      baseUrl,
      "deadbeef0000000000000000000000000000000000000000000000000000dead",
      "/api/me",
    );
    expect(res.status).toBe(401);
  });

  test("POST /api/auth/login returns 200 and sets a new sid cookie", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "E2EAdmin", password: "e2eBootstrap!Secure1" }),
    });
    expect(res.status).toBe(200);
    const sid = extractSid(res);
    expect(sid).toBeTruthy();
    const body = await res.json();
    expect(body.user.displayName).toBe("E2EAdmin");
    console.log("  Login OK, new sid:", !!sid);
  });

  test("Wrong password → 401 bad_credentials", async () => {
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
// AC-04 — Legal Edison deck validates as legal (isValid:true)
// -----------------------------------------------------------------------
describe("AC-04: Legal deck validated as legal", () => {
  test("40-card unlimited deck (real passcodes) → legal:true, 0 violations", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Legal 40-Card Deck",
      main: LEGAL_MAIN_40,
      extra: LEGAL_EXTRA,
      side: [],
    });
    expect(res.status).toBe(201);
    const deck = await res.json();
    console.log("  Deck validation:", JSON.stringify(deck.validation));
    expect(deck.validation.legal).toBe(true);
    expect(deck.validation.violations).toHaveLength(0);
    expect(deck.validation.counts.main).toBe(40);
    expect(deck.validation.counts.extra).toBe(2);
  });

  test("Deck with 1× Limited + 2× Semi-Limited (each) + fill → legal", async () => {
    const main = [
      SUMMONER_MONK, // 1× Limited
      DESTINY_HERO_MALICIOUS,
      DESTINY_HERO_MALICIOUS, // 2× Semi
      TREEBORN_FROG,
      TREEBORN_FROG, // 2× Semi
      ...LEGAL_MAIN_40.slice(0, 35), // 35× unlimited
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Banlist-Legal Deck",
      main,
      extra: [],
      side: [],
    });
    expect(res.status).toBe(201);
    const deck = await res.json();
    console.log("  Banlist-legal violations:", deck.validation.violations);
    expect(deck.validation.legal).toBe(true);
    expect(deck.validation.violations).toHaveLength(0);
  });

  test("Exactly 15 Extra Deck cards → legal (no extra_size violation)", async () => {
    // Use 15 known Extra Deck cards (fusions from real catalog)
    const extra15 = [
      1412158, 1546123, 1641882, 3160395, 4423675, 4942659, 5043010, 5834749, 7225454, 9036276,
      9354455, 9844158, 10000080, 10561352, 11899760,
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "15-Extra Deck",
      main: LEGAL_MAIN_40,
      extra: extra15,
      side: [],
    });
    expect(res.status).toBe(201);
    const deck = await res.json();
    const sizevio = deck.validation.violations.find((v) => v.code === "extra_size");
    expect(sizevio).toBeUndefined();
    console.log(
      `  15-extra: extra_size absent=${!sizevio}, violations=${deck.validation.violations.map((v) => v.code)}`,
    );
  });
});

// -----------------------------------------------------------------------
// AC-05 — Illegal decks rejected with correct Violation codes
// -----------------------------------------------------------------------
describe("AC-05: Illegal deck rejection with correct Violation codes", () => {
  test("39-card main → main_size violation", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "39-Card Deck",
      main: LEGAL_MAIN_40.slice(0, 39),
      extra: [],
      side: [],
    });
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

  test("61-card main → main_size violation", async () => {
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

  test("16-card extra → extra_size violation", async () => {
    // Build 16 unique extra-deck cards from real catalog fusions
    const extra16 = [
      1412158, 1546123, 1641882, 3160395, 4423675, 4942659, 5043010, 5834749, 7225454, 9036276,
      9354455, 9844158, 10000080, 10561352, 11899760, 12521277,
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
    expect(deck.validation.violations.some((v) => v.code === "extra_size")).toBe(true);
  });

  test("16-card side → side_size violation", async () => {
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

  test("Semi-Limited card ×3 across zones (2 main + 1 side) → banlist_limit", async () => {
    const main = [
      DESTINY_HERO_MALICIOUS,
      DESTINY_HERO_MALICIOUS, // 2 in main
      ...LEGAL_MAIN_40.slice(0, 38),
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Semi ×3 Deck",
      main,
      extra: [],
      side: [DESTINY_HERO_MALICIOUS], // 1 in side → 3 total
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

  test("Forbidden card (Pot of Greed 55144522) → banlist_forbidden", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Forbidden Deck",
      main: [POT_OF_GREED, ...LEGAL_MAIN_40.slice(0, 39)],
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

  test("Out-of-pool passcode (Xyz 84013237, not in Edison catalog) → unknown_passcode", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Modern Card Deck",
      main: [MODERN_PASSCODE, ...LEGAL_MAIN_40.slice(0, 39)],
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Modern card violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) =>
        (v.code === "unknown_passcode" || v.code === "out_of_pool") &&
        v.passcode === MODERN_PASSCODE,
    );
    expect(vio).toBeDefined();
  });

  test("Fusion in Main Deck → wrong_zone violation", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Fusion In Main",
      main: [FUSION_CARD, ...LEGAL_MAIN_40.slice(0, 39)],
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

  test("Non-extra card in Extra Deck → wrong_zone violation", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Trap In Extra",
      main: LEGAL_MAIN_40,
      extra: [27551], // Limit Reverse (Trap, not an Extra Deck monster)
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

  test("Limited card ×2 (Summoner Monk 423585) → banlist_limit", async () => {
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Limited ×2 Deck",
      main: [SUMMONER_MONK, SUMMONER_MONK, ...LEGAL_MAIN_40.slice(0, 38)],
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

  // Alias copy-cap tests (REQ-DECK-06) — real alias pairs from alias-index.json (177 entries)

  test("AC-05 alias (a): pre-errata Brionac (511002993) alone in extra → legal (1× Limited ok)", async () => {
    // 511002993 resolves to base 50321796 (Limited) via alias-index.
    // 1 copy is within the Limited cap.
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Brionac Alias Legal",
      main: LEGAL_MAIN_40,
      extra: [BRIONAC_ALIAS], // 1× pre-errata alias → Brionac (Limited)
      side: [],
    });
    const deck = await res.json();
    console.log("  Brionac alias-only violations:", deck.validation.violations);
    expect(deck.validation.legal).toBe(true);
    expect(deck.validation.violations).toHaveLength(0);
  });

  test("AC-05 alias (a): 1× Brionac alias (511002993) + 1× base (50321796) = 2 Limited → banlist_limit", async () => {
    // Both alias and base resolve to the same card (Limited max 1).
    // Combined count = 2 → banlist_limit on base passcode 50321796.
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Brionac Alias+Base",
      main: LEGAL_MAIN_40,
      extra: [BRIONAC_ALIAS, BRIONAC_BASE], // alias + base = 2 copies of Limited
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Brionac alias+base violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "banlist_limit" && v.passcode === BRIONAC_BASE,
    );
    expect(vio).toBeDefined();
  });

  test("AC-05 alias (b): 3× Harpie Lady (base) + 1× Harpie Lady 2 (alias) = 4 copies → copy_limit", async () => {
    // Harpie Lady 2 (27927359) resolves to Harpie Lady (76812113) via alias-index.
    // 3×base + 1×alias = 4 total for unlimited card → copy_limit on base.
    const main = [
      HARPIE_LADY_BASE,
      HARPIE_LADY_BASE,
      HARPIE_LADY_BASE, // 3× base
      HARPIE_LADY_2, // 1× alias → same card
      ...LEGAL_MAIN_40.slice(0, 36), // fill to 40
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Harpie Lady Alias Exceed",
      main,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log(
      "  Harpie alt-art violations:",
      deck.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
    expect(deck.validation.legal).toBe(false);
    const vio = deck.validation.violations.find(
      (v) => v.code === "copy_limit" && v.passcode === HARPIE_LADY_BASE,
    );
    expect(vio).toBeDefined();
  });

  test("AC-05 alias (b): 2× Harpie Lady (base) + 1× Harpie Lady 2 (alias) = 3 copies → legal", async () => {
    // 3 copies of the same card (unlimited) is exactly at the cap.
    const main = [
      HARPIE_LADY_BASE,
      HARPIE_LADY_BASE, // 2× base
      HARPIE_LADY_2, // 1× alias
      ...LEGAL_MAIN_40.slice(0, 37), // fill to 40
    ];
    const res = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Harpie Lady Alias 3-copy Legal",
      main,
      extra: [],
      side: [],
    });
    const deck = await res.json();
    console.log("  Harpie 3-copy alias violations:", deck.validation.violations);
    expect(deck.validation.legal).toBe(true);
    expect(deck.validation.violations).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// AC-06 — .ydk round-trip: export then import → identical multiset
// -----------------------------------------------------------------------
describe("AC-06: .ydk round-trip", () => {
  test("Export a legal deck to .ydk, then import → identical multiset, no violations", async () => {
    const deckData = {
      name: "Round-Trip Deck",
      main: LEGAL_MAIN_40,
      extra: LEGAL_EXTRA,
      side: [27551, 32864],
    };

    // Save + confirm legal
    const saveRes = await jsonPost(baseUrl, adminSid, "/api/decks", deckData);
    expect(saveRes.status).toBe(201);
    const saved = await saveRes.json();
    expect(saved.validation.legal).toBe(true);

    // Export to .ydk
    const exportRes = await authedFetch(baseUrl, adminSid, "/api/decks/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deckData),
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toMatch(/text\/plain/);
    const ydk = await exportRes.text();
    console.log("  YDK head:", ydk.split("\n").slice(0, 5).join(" | "));
    expect(ydk).toContain("#main");
    expect(ydk).toContain("#extra");
    expect(ydk).toContain("!side");
    expect(ydk).not.toMatch(/#side\b/i);
    expect(ydk).not.toContain("\r\n"); // must use LF not CRLF

    // Re-import
    const importRes = await authedFetch(baseUrl, adminSid, "/api/decks/import", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: ydk,
    });
    expect(importRes.status).toBe(200);
    const result = await importRes.json();
    console.log(
      "  Import: main=",
      result.main.length,
      "extra=",
      result.extra.length,
      "side=",
      result.side.length,
      "violations=",
      result.validation.violations.length,
    );

    // Multiset identity (order may differ — sort both)
    expect([...result.main].sort((a, b) => a - b)).toEqual(
      [...deckData.main].sort((a, b) => a - b),
    );
    expect([...result.extra].sort((a, b) => a - b)).toEqual(
      [...deckData.extra].sort((a, b) => a - b),
    );
    expect([...result.side].sort((a, b) => a - b)).toEqual(
      [...deckData.side].sort((a, b) => a - b),
    );
    expect(result.validation.violations).toHaveLength(0);
  });

  test("Round-trip with pre-errata alias Brionac (511002993) in extra → survives export+import", async () => {
    const deckData = {
      name: "Brionac Alias Round-Trip",
      main: LEGAL_MAIN_40,
      extra: [BRIONAC_ALIAS], // pre-errata alias passcode
      side: [],
    };

    const exportRes = await authedFetch(baseUrl, adminSid, "/api/decks/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deckData),
    });
    expect(exportRes.status).toBe(200);
    const ydk = await exportRes.text();
    console.log("  Brionac alias ydk snippet:", ydk.split("\n").slice(0, 6).join(" | "));
    expect(ydk).toContain(String(BRIONAC_ALIAS));

    const importRes = await authedFetch(baseUrl, adminSid, "/api/decks/import", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: ydk,
    });
    expect(importRes.status).toBe(200);
    const result = await importRes.json();
    console.log("  Brionac alias import violations:", result.validation.violations);
    expect(result.extra).toContain(BRIONAC_ALIAS);
    expect(result.validation.violations).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// AC-07 — .ydk import: malformed/foreign/over-limit → violations, never crash
// -----------------------------------------------------------------------
describe("AC-07: .ydk import — malformed/foreign/over-limit inputs", () => {
  /** Import a raw .ydk string; always expects HTTP 200 (no crash). */
  async function importYdk(ydkText) {
    const res = await authedFetch(baseUrl, adminSid, "/api/decks/import", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: ydkText,
    });
    expect(res.status).toBe(200);
    return res.json();
  }

  test("Modern/foreign deck (Xyz passcode 84013237) → unknown_passcode violation, no crash", async () => {
    const ydk = [
      "#main",
      String(MODERN_PASSCODE),
      ...LEGAL_MAIN_40.slice(0, 39).map(String),
      "#extra",
      "!side",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log(
      "  Modern deck violations:",
      result.validation.violations.map((v) => `${v.code}(${v.passcode})`),
    );
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

  test("#side instead of !side → parse_error naming #side, no crash", async () => {
    const ydk = [
      "#main",
      ...LEGAL_MAIN_40.map(String),
      "#extra",
      "#side", // wrong marker
      "27551",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log("  #side violations:", result.validation.violations);
    expect(result.validation.violations.some((v) => v.code === "parse_error")).toBe(true);
    const vio = result.validation.violations.find((v) => v.code === "parse_error");
    expect(vio.message).toContain("#side");
  });

  test("Non-numeric line → parse_error with line number, no crash", async () => {
    const ydk = [
      "#main",
      ...LEGAL_MAIN_40.slice(0, 5).map(String),
      "NOTANUMBER",
      ...LEGAL_MAIN_40.slice(5, 39).map(String),
      "#extra",
      "!side",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log("  Non-numeric violations:", result.validation.violations);
    const vio = result.validation.violations.find((v) => v.code === "parse_error");
    expect(vio).toBeDefined();
    expect(typeof vio.line).toBe("number");
    expect(vio.message).toContain("NOTANUMBER");
  });

  test("Unknown passcode (99999999, not in DB) → unknown_passcode with line number", async () => {
    const UNKNOWN = 99999999;
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
    expect(typeof vio.line).toBe("number");
  });

  test("Fusion under #main in .ydk → wrong_zone violation + re-routed to extra, no crash", async () => {
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
    expect(result.extra).toContain(FUSION_CARD);
    expect(result.main).not.toContain(FUSION_CARD);
  });

  test("Blank .ydk file → empty arrays, no crash", async () => {
    const result = await importYdk("   \n   \n");
    console.log("  Blank file result:", {
      main: result.main.length,
      extra: result.extra.length,
      side: result.side.length,
    });
    expect(result.main).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.side).toHaveLength(0);
  });

  test("Passcode before any section marker → parse_error, no crash", async () => {
    const ydk = "27551\n#main\n" + LEGAL_MAIN_40.map(String).join("\n") + "\n#extra\n!side\n";
    const result = await importYdk(ydk);
    console.log("  Pre-section violations:", result.validation.violations);
    expect(result.validation.violations.some((v) => v.code === "parse_error")).toBe(true);
  });

  test("Pre-errata alias (Brionac 511002993) in #extra → legal, not unknown_passcode", async () => {
    const ydk = [
      "#main",
      ...LEGAL_MAIN_40.map(String),
      "#extra",
      String(BRIONAC_ALIAS),
      "!side",
    ].join("\n");
    const result = await importYdk(ydk);
    console.log("  Brionac alias import violations:", result.validation.violations);
    // Alias is recognized → should NOT be unknown_passcode
    expect(result.validation.violations.some((v) => v.code === "unknown_passcode")).toBe(false);
    expect(result.extra).toContain(BRIONAC_ALIAS);
    // The deck itself is legal (1 Limited copy)
    expect(result.validation.legal).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Deck CRUD sanity
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

  test("GET /api/decks lists created deck", async () => {
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

  test("PUT /api/decks/:id updates deck name", async () => {
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

  test("POST /api/decks/:id/duplicate creates a copy", async () => {
    const res = await authedFetch(baseUrl, adminSid, `/api/decks/${deckId}/duplicate`, {
      method: "POST",
    });
    expect(res.status).toBe(201);
    const dup = await res.json();
    expect(dup.id).not.toBe(deckId);
    expect(dup.name.toLowerCase()).toContain("copy");
  });

  test("DELETE /api/decks/:id deletes deck → 204, then 404", async () => {
    const res = await authedFetch(baseUrl, adminSid, `/api/decks/${deckId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    const get = await authedFetch(baseUrl, adminSid, `/api/decks/${deckId}`);
    expect(get.status).toBe(404);
  });

  test("GET /api/cards/:passcode returns card data", async () => {
    const res = await authedFetch(baseUrl, adminSid, `/api/cards/${POT_OF_GREED}`);
    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.name).toBe("Pot of Greed");
    expect(card.banlist).toBe("forbidden");
    expect(card.passcode).toBe(POT_OF_GREED);
  });

  test("Cross-user deck access → 403", async () => {
    // Create a deck as admin
    const createRes = await jsonPost(baseUrl, adminSid, "/api/decks", {
      name: "Admin Private Deck",
      main: LEGAL_MAIN_40,
      extra: [],
      side: [],
    });
    const deck = await createRes.json();

    // Create a fresh member via invite
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
