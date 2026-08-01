# ADR 0005 — ALPN guard cannot run reliably behind an intercepting egress proxy

**Status:** Accepted  
**Date:** 2026-08-01  
**Decided by:** CTO.  
**Amends:** ADR 0004 (evidence section only — decision stands).  
**Relates to:** `scripts/smoke-artifact.mjs`

---

## Context

ADR 0004 restricts Fly's edge TLS to `http/1.1` via
`[http_service.tls_options] alpn = ["http/1.1"]` to prevent Chrome 121+'s
RFC 8441 extended CONNECT from breaking the duel board WebSocket. It also
added a regression guard in `scripts/smoke-artifact.mjs` (remote mode) that
asserts:

1. ALPN negotiation with the target returns `http/1.1`, not `h2`.
2. An HTTP/2 connection to the target does not set
   `SETTINGS_ENABLE_CONNECT_PROTOCOL`.

After the fix was written and confirmed at the OS level by the CEO from a real
network (`openssl` offering `h2,http/1.1` negotiates `http/1.1`; `curl` gets
HTTP/1.1 and a 200), the same guard was run from an agent container and produced
the opposite reading: ALPN returned `h2`, `enableConnectProtocol` was `true`.
That contradiction exposed the problem.

### The mechanism

Agent containers route outbound TCP/443 through a **TLS-intercepting egress
gateway** operated by Anthropic. The gateway terminates the inbound TLS
connection, presents its own certificate signed by its own CA, and opens a
fresh TLS connection to the real target. The certificate chain observed inside
the container does not come from the target; it comes from the gateway:

```
issuer: O = Anthropic, CN = Egress Gateway SDS Issuing CA (production)
subject: CN = *.zuhayr.io
```

The same issuer signs the certificate for `example.com`, `www.iana.org`, and
every other host — the gateway substitutes itself into every TLS handshake.

ALPN negotiation happens inside the TLS handshake. The container therefore
observes the gateway's ALPN configuration (which includes `h2` and sets
`SETTINGS_ENABLE_CONNECT_PROTOCOL = 1`), not the target server's. HTTP status
codes and response bodies — including WebSocket upgrade responses — are
forwarded by the gateway without modification and remain trustworthy.

### Which evidence from ADR 0004 survives

**Survives (HTTP/1.1 traffic, forwarded faithfully):**

- All 30 HTTP route assertions against `api.zuhayr.io` returned the correct
  status codes (200, 400, 401, 404, 204 as expected per manifest).
- Board WS `wss://api.zuhayr.io/api/duels/:id/ws` → `101` Upgrade accepted,
  followed by `{"type":"ERROR","message":"duel not found or not started"}`.
  The gateway forwarded the HTTP/1.1 `Upgrade:` handshake correctly.
- Room WS bad-origin → `403`. Room WS valid-origin no-session → `401`.
- The Node.js server-side handlers are correctly wired (routes, CORS, session
  guards, upgrade router).

**Contaminated (TLS-layer, observed at gateway not target):**

- `ALPN returns h2` — this was the gateway's ALPN, not Fly's.
- `remoteSettings.enableConnectProtocol = true` — this was the gateway's HTTP/2
  SETTINGS, not Fly's.
- The `:status 502` on the extended CONNECT probe — the gateway forwarded this,
  which is consistent with the real target returning 502, but it cannot be
  distinguished from the gateway itself generating the 502. The CEO's real-
  network evidence (Fly returns HTTP/1.1 after the fix) is the authoritative
  reading.

**Implication:** "duels cannot be played in a browser on production" was
the CTO's conclusion from the contaminated evidence. That conclusion may be
correct (Fly was advertising h2 and not handling extended CONNECT), but it
cannot be verified from an agent container. It can only be settled from an
un-intercepted network (which the CEO confirmed: after the fix, the edge
negotiates `http/1.1`).

## Decision

The two TLS-layer assertions in `scripts/smoke-artifact.mjs` (remote mode)
**detect egress interception before running** by comparing the TLS peer
certificate issuer for the smoke target against the issuer for `example.com`.
A legitimate public CA issues certificates for specific domains; an intercepting
proxy signs both with the same internal CA. When the issuers match, both
assertions report **CANNOT VERIFY** instead of a result.

The detection logic:

```js
const [targetIssuer, exampleIssuer] = await Promise.all([
  getTlsIssuer(wsHost),        // e.g. api.zuhayr.io
  getTlsIssuer("example.com"),
]);
const intercepted = targetIssuer !== null
  && exampleIssuer !== null
  && targetIssuer === exampleIssuer;
```

When intercepted, the script prints a `⚠ CANNOT VERIFY` line for each TLS
assertion with an explanation naming the intercepting issuer and pointing to
this ADR. It does **not** add these to the failure count.

**Exit code:** the run exits 0 if all route and WebSocket assertions pass
regardless of whether TLS assertions report CANNOT VERIFY. A CANNOT VERIFY is a
skipped check, not a failing one. The summary line explicitly prints the
cannot-verify count so the output is never misleadingly clean.
Rationale: treating CANNOT VERIFY as a failure would make the script always
fail from agent containers, making it useless as a tool for that context while
also providing no signal. The route and WS assertions — which are reliable in
any context — should still gate normally.

**When NOT intercepted** (e.g. the CEO running from a real network), the
assertions run as originally designed and any failure exits 1.

## Consequences

- The guard is honest about what it can and cannot observe from each network
  context.
- Running from an agent container gives a clean read on routes and WebSocket
  behaviour; TLS-layer assertions are transparently deferred.
- Running from a real network gives a full read including ALPN and extended
  CONNECT.
- Any future TLS-layer assertion added to the smoke script must go through the
  same interception gate.
- The general rule is now recorded: **TLS handshake properties (ALPN, cipher,
  certificate chain, HTTP/2 SETTINGS) cannot be trusted from an agent container
  that routes through an intercepting egress proxy.**
