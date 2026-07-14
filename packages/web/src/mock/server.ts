/**
 * Node.js request handler for the Vite dev-server mock API.
 * Implements every Spec-13 endpoint used by the web package.
 */
import type * as http from "http";
import {
  buildYdk,
  createSession,
  deleteDeckById,
  deleteSession,
  filterCards,
  getDeckById,
  getSession,
  getUserDecks,
  MOCK_CARDS,
  mockCreateInvite,
  mockLogin,
  mockRedeemInvite,
  parseYdk,
  saveDeck,
} from "./data.js";

function parseCookies(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (cookieHeader ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k.trim()] = v.join("=").trim();
  }
  return out;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(data);
}

function text(res: http.ServerResponse, status: number, body: string) {
  res.writeHead(status, {
    "Content-Type": "text/plain",
    "Access-Control-Allow-Credentials": "true",
  });
  res.end(body);
}

function err(res: http.ServerResponse, status: number, code: string, message: string) {
  json(res, status, { error: { code, message } });
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname; // already without /api prefix (middleware strips it)
  const cookies = parseCookies(req.headers.cookie ?? "");
  const sid = cookies.sid;
  const currentUser = sid ? getSession(sid) : null;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // ─── Auth endpoints ───────────────────────────────────────────────────────
  if (path === "/auth/login" && method === "POST") {
    const body = JSON.parse(await readBody(req)) as {
      displayName: string;
      password: string;
    };
    const user = mockLogin(body.displayName, body.password);
    if (!user) {
      err(res, 401, "bad_credentials", "Display name or password incorrect");
      return;
    }
    const newSid = createSession(user);
    res.setHeader("Set-Cookie", `sid=${newSid}; HttpOnly; SameSite=Strict; Path=/`);
    json(res, 200, { user });
    return;
  }

  if (path === "/auth/redeem-invite" && method === "POST") {
    const body = JSON.parse(await readBody(req)) as {
      inviteCode: string;
      displayName: string;
      password: string;
    };
    const user = mockRedeemInvite(body.inviteCode, body.displayName, body.password);
    if (!user) {
      err(res, 400, "invite_invalid", "Invite code is invalid or already used");
      return;
    }
    const newSid = createSession(user);
    res.setHeader("Set-Cookie", `sid=${newSid}; HttpOnly; SameSite=Strict; Path=/`);
    json(res, 201, { user });
    return;
  }

  if (path === "/auth/logout" && method === "DELETE") {
    if (sid) deleteSession(sid);
    res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === "/me" && method === "GET") {
    if (!currentUser) {
      err(res, 401, "unauthenticated", "Not authenticated");
      return;
    }
    json(res, 200, { user: currentUser });
    return;
  }

  // ─── Cards endpoints ───────────────────────────────────────────────────────
  if (path === "/cards" && method === "GET") {
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      params[k] = v;
    });
    const result = filterCards(params);
    json(res, 200, result);
    return;
  }

  const cardMatch = path.match(/^\/cards\/(\d+)$/);
  if (cardMatch && method === "GET") {
    const passcode = parseInt(cardMatch[1] ?? "0", 10);
    const card = MOCK_CARDS.find((c) => c.passcode === passcode);
    if (!card) {
      err(res, 404, "not_found", `Card ${passcode} not found`);
      return;
    }
    json(res, 200, card);
    return;
  }

  // ─── Deck endpoints ────────────────────────────────────────────────────────
  if (!currentUser && path.startsWith("/decks")) {
    err(res, 401, "unauthenticated", "Not authenticated");
    return;
  }

  if (path === "/decks/import" && method === "POST") {
    const body = await readBody(req);
    const result = parseYdk(body);
    json(res, 200, result);
    return;
  }

  if (path === "/decks/export" && method === "POST") {
    const body = JSON.parse(await readBody(req)) as {
      name?: string;
      main: number[];
      extra: number[];
      side: number[];
    };
    const ydkText = buildYdk(body.name, body.main, body.extra, body.side);
    text(res, 200, ydkText);
    return;
  }

  if (path === "/decks" && method === "GET") {
    const summaries = getUserDecks(currentUser!.id);
    json(res, 200, { decks: summaries });
    return;
  }

  if (path === "/decks" && method === "POST") {
    const body = JSON.parse(await readBody(req)) as {
      name: string;
      main: number[];
      extra: number[];
      side: number[];
    };
    const deck = saveDeck(currentUser!.id, body.name, body.main, body.extra, body.side);
    json(res, 201, deck);
    return;
  }

  const deckMatch = path.match(/^\/decks\/([^/]+)$/);
  if (deckMatch) {
    const deckId = deckMatch[1] ?? "";

    if (method === "GET") {
      const deck = getDeckById(deckId);
      if (!deck) {
        err(res, 404, "not_found", "Deck not found");
        return;
      }
      if (deck.ownerId !== currentUser!.id) {
        err(res, 403, "forbidden", "Not your deck");
        return;
      }
      json(res, 200, deck);
      return;
    }

    if (method === "PUT") {
      const existing = getDeckById(deckId);
      if (!existing) {
        err(res, 404, "not_found", "Deck not found");
        return;
      }
      if (existing.ownerId !== currentUser!.id) {
        err(res, 403, "forbidden", "Not your deck");
        return;
      }
      const body = JSON.parse(await readBody(req)) as {
        name: string;
        main: number[];
        extra: number[];
        side: number[];
      };
      const deck = saveDeck(currentUser!.id, body.name, body.main, body.extra, body.side, deckId);
      json(res, 200, deck);
      return;
    }

    if (method === "DELETE") {
      const existing = getDeckById(deckId);
      if (!existing) {
        err(res, 404, "not_found", "Deck not found");
        return;
      }
      if (existing.ownerId !== currentUser!.id) {
        err(res, 403, "forbidden", "Not your deck");
        return;
      }
      deleteDeckById(deckId);
      res.writeHead(204);
      res.end();
      return;
    }
  }

  const dupMatch = path.match(/^\/decks\/([^/]+)\/duplicate$/);
  if (dupMatch && method === "POST") {
    const deckId = dupMatch[1] ?? "";
    const existing = getDeckById(deckId);
    if (!existing) {
      err(res, 404, "not_found", "Deck not found");
      return;
    }
    if (existing.ownerId !== currentUser!.id) {
      err(res, 403, "forbidden", "Not your deck");
      return;
    }
    const copy = saveDeck(
      currentUser!.id,
      existing.name + " (copy)",
      [...existing.main],
      [...existing.extra],
      [...existing.side],
    );
    json(res, 201, copy);
    return;
  }

  // ─── Duel endpoints ────────────────────────────────────────────────────────
  if (path === "/duels" && method === "POST") {
    if (!currentUser) {
      err(res, 401, "unauthenticated", "Not authenticated");
      return;
    }
    const duelId = `duel-${Date.now()}`;
    const joinToken = `join-${Math.random().toString(36).slice(2)}`;
    const creatorSeatToken = `seat-${Math.random().toString(36).slice(2)}`;
    json(res, 201, {
      duelId,
      joinToken,
      creatorSeatToken,
      seat: 0,
    });
    return;
  }

  if (path === "/duels/join" && method === "POST") {
    if (!currentUser) {
      err(res, 401, "unauthenticated", "Not authenticated");
      return;
    }
    const duelId = `duel-${Date.now()}`;
    const seatToken = `seat-${Math.random().toString(36).slice(2)}`;
    json(res, 200, {
      duelId,
      seat: 1,
      seatToken,
    });
    return;
  }

  // ─── Admin endpoints ───────────────────────────────────────────────────────
  if (path === "/admin/invites" && method === "POST") {
    if (!currentUser) {
      err(res, 401, "unauthenticated", "Not authenticated");
      return;
    }
    if (currentUser.role !== "admin") {
      err(res, 403, "forbidden", "Admin access required");
      return;
    }
    json(res, 201, mockCreateInvite());
    return;
  }

  // Not found
  err(res, 404, "not_found", `No route: ${method} /api${path}`);
}
