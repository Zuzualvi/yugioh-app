# ADR 0004 — Fly edge serves HTTP/1.1 only (ALPN restricted)

**Status:** Accepted  
**Date:** 2026-08-01  
**Decided by:** CTO, with CEO notified.  
**Relates to:** `fly.toml`, `scripts/smoke-artifact.mjs`  
**Superseded in part by:** [ADR 0005](0005-alpn-guard-cannot-run-behind-intercepting-egress.md)

> ⚠️ **THE DECISION BELOW STANDS. THE EVIDENCE FOR IT DOES NOT — read ADR 0005 first.**
> Every measurement in the Context section was taken from an agent container whose outbound TLS is
> terminated by an intercepting egress gateway. ALPN and the HTTP/2 SETTINGS frame are negotiated at
> that gateway, so those readings describe the gateway and **not** `api.zuhayr.io`. Three specific
> claims in this file are therefore withdrawn: that Fly advertises RFC 8441 extended CONNECT, that
> Fly returns 502 when it is used, and that duels failed "for every Chrome and Firefox user on a
> modern version" — the CEO subsequently played a full duel in a real browser. The regression guard
> described under Consequences no longer fails on these conditions; it reports **CANNOT VERIFY**
> whenever it detects interception (PR #23).
>
> Whether the ALPN restriction was ever *needed* is now unknowable — no one measured the pre-change
> state from an un-intercepted network, and that window has closed. It is harmless and it stays.

---

## Context

`api.zuhayr.io` is served by Fly.io's proxy with TLS termination at the edge.
By default, Fly's edge negotiates **HTTP/2** via ALPN and advertises
`SETTINGS_ENABLE_CONNECT_PROTOCOL = 1` (RFC 8441) in its HTTP/2 SETTINGS frame.

**Chrome 121** (January 2024) and **Firefox** changed their WebSocket
implementation: when an existing HTTP/2 session is open to a host _and_ that
host advertises `SETTINGS_ENABLE_CONNECT_PROTOCOL`, the browser uses the RFC
8441 **extended CONNECT** method (`:method CONNECT` / `:protocol websocket`)
instead of the classic HTTP/1.1 `Upgrade:` handshake.

The SPA on `app.zuhayr.io` makes ordinary REST calls to `api.zuhayr.io` before
opening any WebSocket. Those calls open an h2 session. When the SPA then opens
`wss://api.zuhayr.io/api/duels/:id/ws`, Chrome routes the WebSocket upgrade
through that existing h2 session using extended CONNECT.

**Fly's proxy advertises the capability but cannot fulfil it.** The extended
CONNECT request is not passed through to the Node.js backend — it returns
`:status 502` at the proxy layer. The Node.js server never sees the request.
The result is that the duel board's WebSocket fails for every user whose browser
has established an h2 session to the API host, which in practice means every
Chrome and Firefox user on a modern version.

Evidence collected against the live `api.zuhayr.io` endpoint before this fix:

| Probe | Result |
|---|---|
| `curl` ALPN negotiation | `h2` (server offers h2) |
| `node:http2` `remoteSettings.enableConnectProtocol` | `true` |
| Extended CONNECT `:method CONNECT` / `:protocol websocket` to `/api/duels/test/room/ws` | `:status 502` |
| Same path over HTTP/1.1 Upgrade (raw TLS socket, `ALPNProtocols: ['http/1.1']`) | `HTTP/1.1 401` (correct session guard) |
| Board WS over HTTP/1.1 (`ws` library, `wss://`) | `101` + ERROR frame for nonexistent duel |

This failure class is not Fly-specific: the same mechanism has been reported for
WebSocket servers behind any h2 proxy that advertises RFC 8441 but does not
tunnel the CONNECT request correctly — see
[mattermost/mattermost#30285](https://github.com/mattermost/mattermost/issues/30285)
and [socketio/socket.io#5067](https://github.com/socketio/socket.io/issues/5067).

## Decision

Restrict Fly's edge TLS negotiation to **HTTP/1.1 only** by adding to `fly.toml`:

```toml
[http_service.tls_options]
  alpn = ["http/1.1"]
```

This prevents h2 from being negotiated at the TLS handshake level. Browsers
fall back to HTTP/1.1 for all connections to `api.zuhayr.io`, including
WebSocket upgrades, which use the standard `Upgrade:` header and work correctly
with the Node.js `ws` library.

**Do not add `"h2"` back to this list** unless Fly has documented that their
proxy correctly tunnels RFC 8441 extended CONNECT to HTTP/1.1 backends and you
have verified it end-to-end in a browser. `scripts/smoke-artifact.mjs` (remote
mode) asserts both conditions — ALPN returns `http/1.1` and
`enableConnectProtocol` is false — and will fail if the restriction is removed.

## Alternatives rejected

**Separate WebSocket subdomain (`ws.zuhayr.io`).**  
Defeated by HTTP/2 connection coalescing (RFC 7540 §9.1.1). Chrome reuses an
existing h2 session for a new hostname if the session's TLS certificate covers
the hostname _and_ the hostname resolves to an IP already in the session's
address set. Fly uses anycast routing: for a user in the same region, both
`api.zuhayr.io` and `ws.zuhayr.io` resolve to the same anycast IP. If the cert
is a wildcard `*.zuhayr.io`, Chrome will coalesce the h2 sessions and the
subdomain offer is invisible. This would fix it for users who happen to land on
different anycast IPs and fail for others — a probabilistic fix that makes the
failure harder to reproduce, not absent.

**Cloudflare in front.**  
Cloudflare also speaks HTTP/2 and supports RFC 8441 extended CONNECT, which
means the fix would require configuring Cloudflare WebSocket proxying correctly
rather than eliminating the problem. Adds cost (Cloudflare Workers or Pro plan
for WS proxying), adds a second proxy hop, changes the production networking
topology, and leaves the extended CONNECT path alive under a different
operator's implementation. Larger blast radius than the ALPN restriction for
no net benefit.

**SSE or long-poll fallback for the duel board.**  
`openDuelSocket` in `packages/web/src/api/duelSocket.ts` reconnects via
WebSocket on close but has no alternative transport. Adding SSE or long-poll
would require a server-sent events endpoint, a POST-for-actions pattern, and
client-side logic to switch transports — a real feature. More importantly, a
duel turn has a hard countdown timer (currently 30 s): 1–3 s polling lag is a
gameplay regression in a real-time game, not just a graceful degradation. The
room pre-game screen already has a 3-second polling fallback (`useRoom`) and
survives; the duel board genuinely cannot. This remains a gap if the ALPN fix
ever breaks, but it is the wrong tool for this fire.

## Consequences

- **HTTP/1.1 only at the edge.** The REST API loses h2 multiplexing. For this
  workload shape — authenticated API calls, one active WebSocket per duel — the
  difference is not measurable.
- **Regression guard is live.** `SMOKE_TARGET=https://api.zuhayr.io npm run smoke:artifact`
  asserts ALPN returns `http/1.1` and `SETTINGS_ENABLE_CONNECT_PROTOCOL` is
  false. If either assertion fails, the output names the exact fly.toml line to
  restore.
- **R11 (cross-origin session cookie on WS upgrade) is now testable for the first time.**
  While duels failed at the proxy, it was impossible to observe whether the
  `SameSite=Lax` session cookie reached the `api.zuhayr.io` WebSocket upgrade
  from the `app.zuhayr.io` SPA. That question was open throughout development.
  The first browser duel after this fix ships is the first real test of R11.
  If the board connects but immediately receives an auth error, the cookie is not
  reaching the upgrade — that is a separate investigation.
