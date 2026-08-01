# Production Baseline — 2026-07-31

**Captured:** 2026-07-31 ~22:35–22:41 UTC  
**git SHA of master at capture time:** `15f6bdc693a548e214c7d8aa9b7a7e2fe7d96dd3`  
**Frontend URL:** https://app.zuhayr.io (Vercel SPA)  
**Backend URL:** https://api.zuhayr.io (Fly.io Express API)  
**Purpose:** Pre-refactor production baseline. Records what IS, not what should be.

Tag legend: `OBSERVED` = ran the exact command shown and saw this output.
`UNVERIFIED` = inferred from code inspection, could not run.

> **⚠ READ THE CORRECTION AT THE END OF THIS FILE BEFORE TRUSTING ANY TLS-LAYER CLAIM HERE.**
> Everything in this document was captured from an agent sandbox whose egress **intercepts TLS**.
> HTTP status codes and response bodies are trustworthy — the gateway forwards HTTP/1.1 faithfully.
> **ALPN, HTTP/2 settings, and the WebSocket 502 are NOT.** They describe the intercepting proxy,
> not `api.zuhayr.io`. The 502-based conclusion recorded below in the 2026-08-01 authenticated
> pass has been **retracted**. See "Correction — 2026-08-01 (2)".

---

## Part 0 — Network reachability

```
curl -sS -i https://api.zuhayr.io/healthz
```

**Result (OBSERVED):**
```
HTTP/2 200
{"status":"ok","cards":3673}
```

Sandbox has full outbound HTTPS access to both `api.zuhayr.io` and `app.zuhayr.io`.

---

## Part 1 — Unauthenticated HTTP probe matrix

All probes run from sandbox against `https://api.zuhayr.io`. Exact status codes recorded.

### Service / health routes

| Command | Status | Body |
|---------|--------|------|
| `GET /` | **200** | `{"service":"yugioh-edison-api"}` |
| `GET /healthz` | **200** | `{"status":"ok","cards":3673}` |
| `GET /images/test.jpg` | **404** | HTML "Cannot GET /images/test.jpg" — Express static 404, NOT JSON. Image volume appears empty or file not present. |
| `GET /api/does-not-exist` | **404** | `{"error":{"code":"not_found","message":"Route not found."}}` |

`OBSERVED` for all four.

### Auth routes (`/api/auth/*`)

| Command | Status | Notes |
|---------|--------|-------|
| `POST /api/auth/redeem-invite` (empty body) | **400** | `{"error":{"code":"invalid_input",...}}` — schema validation fires |
| `POST /api/auth/login` (bad creds) | **401** | `{"error":{"code":"bad_credentials","message":"Invalid credentials."}}` |
| `POST /api/auth/logout` (no cookie) | **204** | Clears cookie, succeeds even without active session |

`OBSERVED` for all three.

No `POST /api/auth/register` route exists. Registration is invite-only via `POST /api/auth/redeem-invite`.

### `/api/me`

| Command | Status | Body |
|---------|--------|------|
| `GET /api/me` (no auth) | **401** | `{"error":{"code":"unauthenticated","message":"No session."}}` |

`OBSERVED`.

### Card routes (`/api/cards/*`)

| Command | Status | Body |
|---------|--------|------|
| `GET /api/cards` (no auth) | **401** | `{"error":{"code":"unauthenticated","message":"No session."}}` |
| `GET /api/cards/46986414` (no auth) | **401** | Same 401 |

`OBSERVED`. Note: `prod-server.ts` wraps `/api/cards` with `requireSession(db)` before mounting the cards router.

### Deck routes (`/api/decks/*`)

| Command | Status | Body |
|---------|--------|------|
| `GET /api/decks` (no auth) | **401** | `{"error":{"code":"unauthenticated","message":"No session."}}` |

`OBSERVED`. All deck routes require session (router mounted behind `requireSession` in `prod-server.ts`).

### Admin routes (`/api/admin/*`)

| Command | Status | Body |
|---------|--------|------|
| `POST /api/admin/invites` (no auth) | **401** | Standard 401 |

`OBSERVED`.

### Room routes (`/api/duels/*` — from `roomRouter.ts`)

All probes use `FAKE_ID = 00000000-0000-0000-0000-000000000000`.

| Route | Status | Notes |
|-------|--------|-------|
| `POST /api/duels` (create room, no auth) | **401** | `requireSession` guard in roomRouter |
| `GET /api/duels/join/badtoken` (unauthenticated) | **404** | `{"error":{"code":"invalid_token","message":"Join token not found."}}` — this is the ONE route that passes unauthenticated. Bad token → 404. |
| `POST /api/duels/join` (claim, no auth) | **401** | `requireSession` guard |
| `GET /api/duels/:id/room` (no auth) | **401** | `requireSession` guard |
| `POST /api/duels/:id/room/deck` (no auth) | **401** | `requireSession` guard |
| `POST /api/duels/:id/room/ready` (no auth) | **401** | `requireSession` guard |
| `POST /api/duels/:id/room/unready` (no auth) | **401** | `requireSession` guard |
| `POST /api/duels/:id/room/choice` (no auth) | **401** | `requireSession` guard |
| `POST /api/duels/:id/room/leave` (no auth) | **401** | `requireSession` guard |
| `GET /api/duels/:id/seat` (no auth) | **401** | `requireSession` guard |

`OBSERVED` for all.

**Verdict:** The "expected shape" described in the task is CONFIRMED — exactly one room route answers unauthenticated (`GET /api/duels/join/:joinToken`), returning 404 for a bad token. All others return 401.

### Duel board routes (`/api/duels/*` — from `duelRoutes.ts`)

| Route | Status | Notes |
|-------|--------|-------|
| `GET /api/duels/:id` (no auth) | **401** | `prod-server.ts` wraps this router with `requireSession(db)` at mount |

`OBSERVED`.

### CORS behavior

```
OPTIONS /api/auth/login  Origin: https://app.zuhayr.io
```
→ 204 with `Access-Control-Allow-Origin: https://app.zuhayr.io`, `Access-Control-Allow-Credentials: true` `OBSERVED`

```
OPTIONS /api/auth/login  Origin: https://evil.example.com
```
→ 204 but NO `Access-Control-Allow-Origin` header (request blocked) `OBSERVED`

---

## Part 2 — WebSocket upgrade probes

**CRITICAL NOTE:** All WS probes use `--http1.1` to force HTTP/1.1 and make the
`Upgrade` header meaningful. Without this flag, curl negotiates HTTP/2 where
the `Upgrade` header is silently ignored and WS upgrades return 401.

### Board WS: `GET /api/duels/:id/ws`

Exact command template used:
```
curl -sS -i --http1.1 -N \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  [-H "Origin: <value>"] \
  https://api.zuhayr.io/api/duels/00000000-0000-0000-0000-000000000000/ws
```

| Origin header | Status | Frame data |
|---------------|--------|------------|
| (none) | **101 Switching Protocols** | `{"type":"ERROR","message":"duel not found or not started"}` |
| `https://evil.example.com` | **101 Switching Protocols** | Same error message |
| `https://app.zuhayr.io` (no cookie) | **101 Switching Protocols** | Same error message |

`OBSERVED` for all three.

**Finding (OBSERVED):** The board WS endpoint (`/api/duels/:id/ws`) performs NO Origin check and NO session auth check at the upgrade level. Any host, any client, with no credentials can open a WebSocket connection. The "duel not found" error is an application-level guard fired after the upgrade — it does not prevent the protocol upgrade itself.

### Room WS: `GET /api/duels/:id/room/ws`

Exact command template used:
```
curl -sS -i --http1.1 -N --max-time 5 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  [-H "Origin: <value>"] \
  https://api.zuhayr.io/api/duels/00000000-0000-0000-0000-000000000000/room/ws
```

| Origin header | Status | Notes |
|---------------|--------|-------|
| (none) | **403 Forbidden** | Origin check fires — no origin = not allowed |
| `https://evil.example.com` | **403 Forbidden** | CORS origin check rejects unknown origin |
| `https://app.zuhayr.io` (no cookie) | **401 Unauthorized** | Origin accepted, but session check fails — no `sid` cookie |

`OBSERVED` for all three.

**Finding (OBSERVED):** The room WS endpoint performs BOTH an Origin check and a session check. This is the opposite of the board WS — it is properly guarded at the protocol upgrade level.

---

## Part 3 — Browser / logged-in flow

### Frontend reachability

Playwright/Chromium (headless, `ignoreHTTPSErrors: true`) loaded `https://app.zuhayr.io`.

`OBSERVED`:
- Redirects to `/login`
- Page title: "Edison Duel"
- Body text: "EDISON DUEL / a private duel club / Sign in / Display name / Password / Enter › / First time? Open your invite link to set up."
- API call made automatically: `GET /api/me → 401`
- No WebSocket events observed at the login screen

### Registration / account creation

`OBSERVED`: No public registration endpoint exists. The API has `POST /api/auth/redeem-invite` which requires an admin-generated invite code. `POST /api/auth/login` with unknown credentials returns 401. The UI login page confirms this: "First time? Open your invite link to set up."

**BLOCKED:** Cannot proceed without invite codes or pre-existing credentials. Did not attempt to brute-force or bypass.

### Full room flow (create → join → pick deck → ready → flip → seat → board)

**COULD NOT VERIFY** — blocked by absent credentials.

Nobody on the team has observed this working on production. This remains unverified.

### WebSocket cookie question: does `sid` reach the cross-origin room WS upgrade?

**COULD NOT VERIFY** via live browser — no logged-in session available.

**Reasoned from code and observations (UNVERIFIED):**

1. Cookie set in `packages/server/src/routes/auth.ts`:
   ```
   sameSite: "lax",
   secure: true,   // (NODE_ENV=production)
   ```
2. Production split-origin: SPA at `app.zuhayr.io`, API at `api.zuhayr.io`.
3. Browser behavior for `SameSite=Lax` cookies on cross-origin WebSocket upgrades:
   browsers treat cross-subdomain WS upgrades as cross-site requests where Lax
   cookies are NOT sent (no top-level navigation, different registrable domain
   only if the two subdomains differ in eTLD+1, but `zuhayr.io` is the eTLD+1
   for both — they share the same registrable domain so Lax cookies SHOULD be
   sent... however WS upgrades are not GET navigations so Lax may still not
   apply).
4. Room WS probe (valid Origin, no cookie) → **401** `OBSERVED`. This confirms
   that the server does gate on the cookie, and that cookie absence = 401.

**Likely outcome (UNVERIFIED by browser observation):** The room WS upgrade
probably fails (401) from the browser, causing `useRoom` to fall back to 3-second
polling. The key observable is whether `GET /api/duels/:id/room` repeats every
~3 seconds in the network panel — if it does, the socket is dead. This was NOT
directly observed. Direct browser observation requires a logged-in session.

---

## Production artifacts created

None. No test accounts were created (no invite codes available). No rooms were
created. No cleanup required.

---

## Surprising findings

1. **Board WS has no auth guard at the upgrade level** (OBSERVED): `/api/duels/:id/ws`
   upgrades to 101 for any caller, any origin, no cookie. The "duel not found"
   error fires after the upgrade. This is asymmetric with the room WS, which has
   both CORS and session guards before the 101.

2. **`GET /api/duels/:id` (duel board info) requires session** (OBSERVED): the
   `duelRoutes.ts` file shows no `requireSession` on that route handler, but
   `prod-server.ts` mounts it as
   `app.use("/api/duels", requireSession(db), createDuelRouter(...))`, so the
   middleware applies to all routes in that router.

3. **`GET /images/test.jpg` returns HTML 404, not JSON** (OBSERVED): the
   `/images` route uses `express.static` which returns Express's default HTML
   error page. This is inconsistent with the JSON 404 that `/api/*` returns.
   Non-blocking, but worth noting.

4. **Image volume appears empty or inaccessible** (UNVERIFIED — could be the
   test path, not the volume being empty): the `/images/test.jpg` 404 could be
   just the specific file not existing; the volume may contain real images at
   passcode-named paths.

---

## Authenticated pass — 2026-08-01

**Captured:** 2026-08-01 ~05:40–05:49 UTC  
**git SHA of master at capture time:** `d160a7ef1e4f9f49250b2fcc5db1d0af1aef03e0`  
**Context:** `prod-server.ts` now calls `createApp()` (PR #21 merged). The unauthenticated contract was verified byte-identical before and after the collapse (33/33 assertions diffed). This pass adds the authenticated browser observations that were blocked in the first pass.

**Accounts created:** `qa-alice` (user id `abaad6e9-6022-4a56-85a2-99df9f76b18e`) and `qa-bob` (user id `d48870a1-0fc8-4a41-b465-e6ada7414eca`) — both `member` role. Decks created: "QA Test Deck" (40-card Edison-legal) for each. Rooms created: 4 (rooms `d8b8297e32bf2052bd58fcc3`, `92d8747773abbc9dedd9d648`, `ae2bc2e2a7ec45648af3a88b`, and one left open from the flow test). Duel started: `ae2bc2e2a7ec45648af3a88b` (status `active`). **Not cleaned up** — left for the CEO to remove if desired.

**Method:** Playwright/Chromium headless with `ignoreHTTPSErrors: true` (sandbox CA limitation — see friction filed ZUH-51). CDP (`Network.enable`) used to capture exact WS handshake response codes. curl with `--http1.1` used for raw WS probes.

---

### R11 — Session cookie and the cross-origin WebSocket upgrade

**Verdict: COULD NOT CONFIRM 101. Both WS endpoints return 502 from Fly.io in a real browser.**

#### Room WS (`wss://api.zuhayr.io/api/duels/:id/room/ws`) — OBSERVED

Playwright CDP captured the exact error on every attempt across three separate rooms:

```
WebSocket connection to 'wss://api.zuhayr.io/api/duels/.../room/ws' failed:
Error during WebSocket handshake: Unexpected response code: 502
```

Pattern OBSERVED:
1. Browser sends WS upgrade to `wss://api.zuhayr.io/api/duels/:id/room/ws`
2. Fly.io proxy returns **502 Bad Gateway** — not 101, not 401
3. Client (`useRoom.ts` / `openRoomSocket`) sees a close event, increments `failCount`
4. Reconnects twice more (same 502 each time)
5. After 3 failures (`failCount >= MAX_FAILS`), calls `onUnavailable()` → polling fallback
6. `GET /api/duels/:id/room` fires at exactly **~3-second intervals** (2997ms, 2997ms, 3005ms, 2999ms, 3002ms, 2998ms, 2997ms observed across 7 intervals) — confirming `POLL_INTERVAL_MS = 3000` in `useRoom.ts`
7. Room works correctly via polling (all 200, room state visible in UI)

**Root cause (UNVERIFIED — inferred):** The browser negotiates HTTP/2 via TLS ALPN. Fly.io's proxy accepts the TCP connection but returns 502 when it cannot forward a WebSocket Upgrade request through an HTTP/2 session. Standard WebSocket (RFC 6455) requires HTTP/1.1; WebSocket over HTTP/2 (RFC 8441) requires explicit support. The Fly.io proxy or the backend is not handling the HTTP/2 case.

**Not a regression from PR #21 (UNVERIFIED):** The collapse only moved route registration from `prod-server.ts` into `createApp()`. The WS upgrade path (`attachUpgradeRouter`, `attachDuelWsServer`, `createRoomWss`) is unchanged. The 502 likely predates this change; it had never been observed before because no previous session drove a real browser session against production.

**curl with `--http1.1` works (OBSERVED — from 2026-07-31 baseline):** Raw probes forcing HTTP/1.1 showed 401 for valid origin with no cookie, and 403 for bad origin. So the server-side WS handlers ARE reachable at HTTP/1.1. The 502 is specific to the browser's HTTP/2 path.

**Cookie question answer:** Cannot be confirmed — the WS never reaches the application layer (Fly.io returns 502 before the auth check). The cookie DOES attach to the request (it's same-site: both `app.zuhayr.io` and `api.zuhayr.io` share registrable domain `zuhayr.io`, so `SameSite=Lax` cookies ARE sent). But the auth check never runs. UNVERIFIED by direct observation.

#### Board WS (`wss://api.zuhayr.io/api/duels/:id/ws?token=...`) — OBSERVED

Same 502 pattern. Board renders `"Duel (connecting…) ⚠ Connection error — reconnecting…"` and never loads game state. Duel IS active on the server (API returns `status: active`, seat tokens valid) but the board cannot connect. The board WS retries with exponential backoff and shows a persistent connection error in the UI.

---

### Room flow — `create → join → claim → pick deck → ready → coin flip → seat choice → board`

#### Step-by-step results (mix of browser + API) — OBSERVED

| Step | Method | Result |
|------|--------|--------|
| Alice login via UI | Playwright | 200, redirects to `/`, session cookie set |
| Bob login via UI | Playwright | 200, redirects to `/`, session cookie set |
| `POST /api/auth/redeem-invite` | curl | 201, both accounts created |
| Alice creates room via UI (`/duel/new`) | Playwright | 200, navigates to `/duel/:id/room`, join link visible on page |
| Unauthenticated join token lookup | curl (no cookie) | 200 `{"creatorDisplayName":"qa-alice","usable":true}` |
| Bob visits join URL (`/duel/join/:token`) | Playwright | Auto-redirects to `/duel/:id/room` (Bob was logged in, claim auto-accepted) |
| Bob's room page shows both players, deck picker | Playwright (page text) | `status: filled`, both players listed, deck selector with "QA Test Deck" visible |
| Alice picks deck | API call from Playwright context | 200 |
| Bob picks deck | API call from Playwright context | 200 |
| Alice ready | API | 200, `status: filled` |
| Bob ready | API | 200, `status: awaiting_choice` — coin flip resolved, Bob won |
| Bob submits seat choice `{choice:"first"}` | API | 200, `status: starting`, seats assigned |
| Seat credential (`GET /api/duels/:id/seat`) | API | 200, `{"seat":1,"seatToken":"4db05fc4-..."}` |
| Duel board info (`GET /api/duels/:id`) | API | 200, `{"status":"active"}` — WASM engine started |
| Board WS | Playwright/CDP | 502 from Fly.io (same as room WS) |
| Board in browser | Playwright | `"Duel (connecting…) ⚠ Connection error — reconnecting…"` |

**Flow reached:** Duel board loaded and active on the server. The board WS fails in the browser (502), so the board UI shows a connection error and never renders game state. The flow is fully functional from the server's perspective; blocked by the WS 502 for the client.

---

### Image rendering — OBSERVED

**API route (`/images/:passcode.jpg`):** Works. `GET /images/46986414.jpg` → 200; `GET /images/32864.jpg` → 200 (OBSERVED via curl). The Fly.io volume has card images seeded.

**Browser (Playwright, cards page `/cards`):** 0 `<img>` elements in the DOM. No `/images/*` HTTP requests captured. OBSERVED on three separate visits. The `/cards` page renders a text list of card names without inline thumbnails — no card art in list view. This is a UI design choice, not a missing image route.

**Browser (board page):** 0 `<img>` elements. Expected — the board WS never connected, so no card state was loaded and no card images were rendered.

**`VITE_IMAGE_BASE_URL` (UNVERIFIED):** The production SPA bundle uses `import.meta.env.VITE_IMAGE_BASE_URL` at build time (set on Vercel). Images would render in the deck builder / card inspector when a card is hovered or selected. These views were not reached in this session because the board WS is broken.

---

### Regressions from the `createApp()` collapse — OBSERVED

**None found.** All HTTP routes (unauthenticated and authenticated) responded identically to the pre-collapse baseline. The room flow, deck management, auth, and invite flows all work correctly. The WS 502 is infrastructure-level and predates the collapse.

---

### Items left open

- `wss://` WebSocket connections from browsers return 502 from Fly.io (both endpoints). This blocks the live duel experience in production. Root cause is HTTP/2 ALPN negotiation — the fix is either Fly.io configuration (`[http_service] force_https = true` + an `http_options` ALPN setting) or a server-side implementation of RFC 8441 (WebSocket over HTTP/2). **This needs investigation and a fix before the duel board is usable in production.**
- Four rooms and one active duel remain in production from this QA session. Accounts `qa-alice` and `qa-bob` remain registered.

---

## Correction — 2026-08-01 (2)

Added by the CTO after the CEO re-ran the checks **from a real machine outside the sandbox**. This
section supersedes any conflicting claim above.

### The instrument was wrong

Agent containers egress through a TLS-intercepting gateway:

```
api.zuhayr.io   issuer=O = Anthropic, CN = Egress Gateway SDS Issuing CA (production)
example.com     issuer=O = Anthropic, CN = Egress Gateway SDS Issuing CA (production)
```

**OBSERVED:** every host probed from the sandbox — `api.zuhayr.io`, `example.com`, `www.iana.org`,
`cloudflare.com`, `github.com` — presents a certificate from that same issuer and reports
`enableConnectProtocol = true`. That is the gateway's configuration, not a property of any of
those servers. TLS terminates at the gateway, and ALPN is negotiated during the TLS handshake, so
**no ALPN or HTTP/2 observation made from a sandbox describes the real origin.**

The tell was present from the first capture and was misread as noise: Playwright needed
`ignoreHTTPSErrors: true` to load `app.zuhayr.io` (filed as ZUH-51). That is an interception
notice.

### What is retracted

- The `502` on both WebSocket upgrades, and the conclusion that **"duels cannot be played in a
  browser on production."** The 502 came from the gateway, which terminates HTTP/2 and cannot
  forward RFC 8441 extended CONNECT upstream. Chrome inside the sandbox negotiated h2 with the
  *gateway*, saw extended CONNECT advertised, used it, and failed. Fly was never shown to be at
  fault.
- Every ALPN reading and every `enableConnectProtocol` reading in this document.
- The 3-second polling fallback measurements: real, but they were the client correctly reacting
  to a gateway-induced failure, not to a production one.

### What survives

All HTTP status codes and bodies; the unauthenticated route matrix; board WS reaching `101` and
room WS returning `403` on bad Origin / raw `401` for a valid Origin with no session, when probed
over HTTP/1.1; and the fact that `useRoom` has a polling fallback while the duel board has none
(read from source, not measured).

### R11 — RESOLVED, and it passes

**The question:** does the `sid` session cookie reach the cross-origin WebSocket upgrade on the
deployed split-origin stack (`app.zuhayr.io` → `wss://api.zuhayr.io`)? Open since the room
shipped; never validly observable until now.

**OBSERVED by the CEO, real browser, real network, 2026-08-01.** Full flow completed: room
created, joined from a second account in incognito, both decks picked, coin flip, seat choice,
board loaded with cards. No errors. DevTools with Preserve log, 24 requests total:

- Two WebSockets, **both `101`**.
- One with a bare `ws` name — open ~1.2 min, closed on leaving the room.
- One `ws?token=…` — still open on the board.
- **Zero `/room` requests in the entire log.**

**Mapping confirmed from source** (the CEO flagged it as inferred; verified rather than assumed):

- `packages/web/src/api/roomSocket.ts:31` → `${wsBase}/api/duels/${roomId}/room/ws` — **no query
  string**. DevTools shows the final path segment, so this renders as a bare `ws`.
- `packages/web/src/api/duelSocket.ts:41` → `${wsBase}/api/duels/${duelId}/ws?token=…` — the board
  socket **always** carries `?token=`.

So the bare `ws` is the room socket, and it reached `101`.

**Independently corroborated, and this holds even if the name mapping were wrong:** polling is
enabled only by `setUsePolling(true)` inside the `onUnavailable` callback
(`packages/web/src/hooks/useRoom.ts:79`), which `openRoomSocket` fires only after three
consecutive failed connects. Zero `/room` requests means `onUnavailable` never fired, which means
the room socket connected.

**Conclusion: the session cookie DOES reach the cross-origin WebSocket upgrade in production.**
The ws-ticket contingency in implementation spec §5.5 is moot and should not be built.

### Fly edge ALPN

`fly.toml` restricts the edge to `alpn = ["http/1.1"]` (ADR 0004; evidence corrected by ADR 0005).
**OBSERVED by the CEO from a real network:** offering `h2,http/1.1` negotiates `http/1.1`;
offering `h2` alone gets "No ALPN negotiated"; `curl` to `/healthz` uses HTTP/1.1 and returns 200.
The setting is applied and honoured.

**UNVERIFIED and now unknowable:** whether the restriction was ever *needed*. Nobody measured the
pre-change state from a clean network. CEO decision: keep it — it works, it is harmless, and no
further time is to be spent establishing whether it was necessary.

### Production artefacts still present

Accounts `qa-alice` and `qa-bob`, four rooms and one active duel remain on production. CEO chose
to leave them. There is no way to delete a user, room or duel through the app at all — parked as
ZUH-60.
