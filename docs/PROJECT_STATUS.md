# Project Status — Meta Ads Agent Skill

> **Updated:** 2026-06-04  
> **Version:** v0.4.2  
> **Last Phase:** Phase 20A.1 — Persistent OAuth Store Foundation

### Phase 17.5 Across Sub-phases
| Phase | Summary | Key Changes | Status |
|---|---|---|---|
| **Phase 17.5B** | Audit credential resolver | Confirmed zero Connection Key support in codebase | ✅ Done |
| **Phase 17.5C** | Connection Key compatibility layer | `CUAN_INSIGHT_AUTH_MODE`, `CUAN_INSIGHT_CONNECTION_KEY`, `x-cuan-mcp-connection-key` header, 21 new tests | ✅ Done (PR #21) |
| **Phase 17.5D** | Cold smoke validation | tools/list (13 tools), ads_list_accounts via stdio, security redaction verified | ✅ Done |
| **Phase 17.5F** | URL fix + live smoke test | Fixed `new URL()` stripping `/functions/v1`, live smoke 25 Meta accounts, revoke 401 verified | ✅ Done (PR #23) |
| **Phase 17.5G** | Release notes & tag v0.4.0 | RELEASE_NOTES.md, version bump, tag | ✅ Done |
| **Phase 17.5E** | Docs & release readiness | Update README.md, CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md, PROJECT_STATUS.md, REMOTE_MCP_HTTP.md | ✅ Done |

---

## A. Project Overview

**meta-ads-agent-skill** is an open-source MCP (Model Context Protocol) server for Meta Ads analysis. It connects MCP-compatible AI clients to Meta Marketing API data through a credential gateway.

### Key Design Decisions

- **Cuan Insight** is the credential authority. It stores and manages all Meta access tokens, user/workspace/plan data, and account mappings.
- **meta-ads-agent-skill** is the MCP server. It does **not** store Meta tokens — credentials are resolved from Cuan Insight at runtime.
- The server supports **multi-user** and **multi-workspace** usage through remote credential resolution.
- All tools are **read-only**. Write operations (pause, budget, create) are not implemented.
- **Connection Key support** (Phase 17.5C): MCP server sends `x-cuan-mcp-connection-key` header when `CUAN_INSIGHT_AUTH_MODE=connection_key`.

---

## B. Architecture

### High-Level Flow

```
MCP Client (Claude Desktop, Cline, etc.)
  │
  ├─ [Stdio] ──► meta-ads-agent-skill (MCP Server via stdio)
  │
  ├─ [SSE] ───► meta-ads-agent-skill (MCP Server via SSE, Phase 16a)
  │                 │
  │                 ├─ [Remote Mode] ──► Cuan Insight mcp-resolve-credential
  │                 │                       │
  │                 │                       ▼
  │                 │                   Meta / TikTok Provider Token
  │                 │
  │                 └─ [Local Mode] ──► Direct META_ACCESS_TOKEN env var
  │                                       │
  │                                       ▼
  │                                   Meta Marketing API
  │                                       │
  │                                       ▼
  │                                   Normalized MCP Tool Response
  │
  └─ [Streamable HTTP] ──► meta-ads-agent-skill (MCP Server via Streamable HTTP, Phase 16b)
```

### Auth Modes (Phase 17.5C)

| Auth Mode | Env | Header | Use Case |
|---|---|---|---|
| `mcp_token` (default) | `CUAN_INSIGHT_MCP_TOKEN` | `Authorization: Bearer` or `X-Cuan-MCP-Token` | Developer self-host, legacy |
| `connection_key` | `CUAN_INSIGHT_CONNECTION_KEY` | `x-cuan-mcp-connection-key` | Cuan Insight UI AI/MCP Connector |

MCP tools are registered through the high-level `McpServer.registerTool(...)` API as of Phase 16c. Transports still connect through the same stdio, SSE, and Streamable HTTP entrypoints.

### Discovery Flow (`ads_list_accounts`)

```
ads_list_accounts
  │
  ▼
resolve credential with provider=meta, accountId=null
  │
  ▼ (provider-level discovery mode)
Cuan Insight returns discovery credential (accountId: null, discovery: true)
  │
  ▼
Call Meta /me/adaccounts
  │
  ▼
Return available ad accounts
```

### Account-Scoped Flow (Performance Tools)

```
ads_get_campaign_performance
ads_get_adset_or_adgroup_performance
ads_get_ad_performance
  │
  ▼
resolve credential with provider=meta, accountId=<selected>
  │
  ▼ (account-scoped mode)
Cuan Insight validates account mapping and returns account-scoped token
  │
  ▼
Call Meta /act_<id>/insights
  │
  ▼
Return normalized performance data
```

---

## C. Completed Phases

| Phase | Description |
|---|---|
| Phase 1-11 | Foundation, read-only tools, rule engine, AI skills |
| Phase 12A | Docker MCP support |
| Phase 12B | Remote MCP HTTP skeleton |
| Phase 13 | Credential resolver architecture and production |
| Phase 14 | Meta OAuth platform connection sync fix, `act_` prefix fix |
| Phase 15.1 | Generic MCP client setup docs |
| Phase 15.2 | Provider-level credential resolution (cuan-insight RPC + edge function) |
| Phase 15.3 | `ads_list_accounts` uses provider-level credential resolution |
| Phase 15.4 | Controlled deploy + live MCP client test |
| Phase 15.5 | Final project documentation |
| **Phase 16** | **Remote MCP HTTP evaluation** — SDK supports Streamable HTTP in v1.29+, but upgrade has medium risk |
| **Phase 16a** | **SSE remote transport implemented** — using existing SDK v0.5.0, no upgrade needed |
| **Phase 16b** | **MCP SDK upgraded to v1.29.0 + Streamable HTTP implemented** — stdio default and SSE preserved |
| **Phase 16c** | **MCP server migrated to `McpServer` API** — deprecated direct `Server` request handlers removed, 13-tool surface preserved |
| **Phase 16d** | **Dependency audit remediated** — `vitest` upgraded to 4.1.8, audit reduced from 4 vulnerabilities to 0 |
| **Phase 17.5B** | **Audit credential resolver** — confirmed zero Connection Key support in codebase |
| **Phase 17.5C** | **Connection Key compatibility layer** — `CUAN_INSIGHT_AUTH_MODE`, `CUAN_INSIGHT_CONNECTION_KEY`, `x-cuan-mcp-connection-key` header, 21 new tests, PR #21 merged |
| **Phase 17.5D** | **Cold smoke validation** — tools/list (13 tools), ads_list_accounts via stdio, security redaction verified |
| **Phase 17.5F** | URL fix + live smoke test | Fixed `new URL()` stripping `/functions/v1`, live smoke 25 Meta accounts, revoke 401 verified | ✅ Done (PR #23) |
| **Phase 17.5G** | Release notes & tag v0.4.0 | RELEASE_NOTES.md, version bump, tag | ✅ Done |
| **Phase 17.5E** | **Docs & release readiness** — README, CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY, PROJECT_STATUS, REMOTE_MCP_HTTP updated |
|| **Phase 19** | **MCP OAuth Connection Key Authorization Flow** — `/authorize`, `/token`, PKCE, Bearer token support, `.well-known/` metadata, 30+ tests, docs | ✅ Done |
|| **Phase 19.4** | **Claude Native Connector Verification** — PKCE `digest('base64url')` fix, resource param preservation, DCR auto-register, Claude token exchange, 25 Meta ad accounts, safe debug logging, production debug disabled | ✅ Done |
|
---

## D. Completed PRs

| PR | Title | Merge Commit | Summary |
|---|---|---|---|
| #21 | docs(mcp): document Cuan Insight connection key auth mode | `fed1321` | Connection Key compatibility layer + 21 tests + docs |

---

## E. Transport Matrix

| Transport | Status | Env | Notes |
|---|---|---|---|
| stdio | default | (none) | Safest local/client mode; legacy `meta_*` tools available |
| SSE | supported | `MCP_TRANSPORT=sse` | Remote option; Bearer auth required via `MCP_HTTP_BEARER_TOKEN` |
| Streamable HTTP | supported | `MCP_TRANSPORT=streamable-http` | Official remote HTTP transport via SDK v1.29; Bearer auth required; OAuth (Phase 19) via `/authorize` + `/token` |

Test results:
| Test | Result |
|---|---|
| Stdio smoke test | ✅ `tools/list` returned 13 tools with expected names |
| SSE auth gate | ✅ 401 for missing/invalid token, 200 with valid token |
| SSE POST /mcp (no sessionId) | ✅ 501 (SSE still requires `sessionId`) |
| Streamable HTTP `/health` | ✅ 200 with `MCP_TRANSPORT=streamable-http` |
| Streamable HTTP `GET /mcp` | ✅ 501 for new session (POST required) |
| Connection Key cold smoke | ✅ tools/list (13 tools), ads_list_accounts, safe errors |

---

## F. Security Notes

- **MCP server does not persist Meta tokens.** Credentials are resolved at runtime and discarded after the request completes.
- **providerToken** is used only internally for provider API calls and is never exposed in MCP responses.
- **Raw tokens** (Meta access tokens, providerToken, MCP tokens, connection keys) must never be logged.
- **No secrets** should appear in test output, stderr, logs, or MCP responses.
- Use environment variables or placeholders (`<CUAN_INSIGHT_CONNECTION_KEY>`, `<CUAN_INSIGHT_MCP_TOKEN>`) for all setup instructions.
- All credential errors are redacted through `redactErrorMessage` and `redactTokenLikeValues` utilities before surfacing.
- **SSE auth**: `MCP_HTTP_BEARER_TOKEN` gates all SSE endpoints. Missing/invalid tokens return 401.
- **Streamable HTTP auth**: `MCP_HTTP_BEARER_TOKEN` gates Streamable HTTP endpoints. Missing/invalid tokens return 401.
- **Authorization header** must never be logged by the SSE or Streamable HTTP transport.
- **Connection key redaction** covers: `x-cuan-mcp-connection-key`, `connectionKey`, `connection_key`, `connection-key` (Phase 17.5C).
- **OAuth flow (Phase 19)**: Connection Key entered via `/authorize` form is validated against Cuan Insight but never stored in HTML, logs, or redirect URLs.
- **Access tokens** from `/token` are stored as SHA-256 hashes; raw tokens returned only once at creation.
- **Authorization codes** are single-use, short-lived (5 min TTL), and PKCE-protected.
- **Dependency audit**: 0 vulnerabilities.

---

## G. Known Limitations

### MCP Server API

The MCP SDK is upgraded to `^1.29.0`, Streamable HTTP is implemented, and Phase 16c migrated tool registration to the high-level `McpServer` API.
- Stdio remains the default entrypoint.
- **SSE transport** (`MCP_TRANSPORT=sse`) remains available.
- **Streamable HTTP transport** (`MCP_TRANSPORT=streamable-http`) is available behind explicit env opt-in.
- Direct project usage of deprecated `Server.setRequestHandler(ListToolsRequestSchema/CallToolRequestSchema)` has been removed.
- `McpServer` internally wraps SDK server primitives; this is expected and not project-level deprecated API usage.

### Connection Key

- Connection Key compatibility layer merged (Phase 17.5C, PR #21).
- **Live production verified:** 25 Meta ad accounts returned via Connection Key, revoked key rejected 401 (Phase 17.5F, PR #23).
- Account-scoped tools require account connection in Cuan Insight UI (`ACCOUNT_NOT_CONNECTED`).

- **Hosted multi-user limitation:** Current v0.4.0 supports env-based `CUAN_INSIGHT_CONNECTION_KEY` for local/single-tenant use only. Per-request `x-cuan-mcp-connection-key` header passthrough for hosted multi-user remote MCP is not yet implemented and is planned for a future release. Do not configure a shared global connection key for multi-user deployments.

### OAuth Connector Flow (Phase 19)

- OAuth implementation uses **in-memory store by default** (backward compatible).
- **Persistent store (Phase 20A)**: `MCP_OAUTH_STORE_DRIVER=supabase` supports persistence via Supabase. `SupabaseOAuthStore` is skeleton-only in 20A.1; full production wiring in Phase 20B.
- Auth codes and access tokens are lost on server restart when using default memory driver.
- No refresh token support — re-authorize when access token expires.
- Connection Key validation probes Cuan Insight; if resolver is unavailable, key is accepted as valid and errors surface at tool call time.
- Bearer token resolution order: OAuth access token store → `MCP_HTTP_BEARER_TOKEN` (static) → `x-cuan-mcp-connection-key`.

### TikTok Provider Support

- TikTok adapter is registered but returns `NOT_IMPLEMENTED` for all performance tools.
- Provider-level credential resolution for TikTok returns `PROVIDER_NOT_READY`.

### Write Operations

All tools are read-only. Write operations (pause/resume campaigns, update budgets, create ads) are planned for v0.4.0.

---

## H. Next Steps

1. ✅ **Full live smoke test** with real Cuan Insight Connection Key — done (Phase 17.5F, PR #23).
2. ✅ **Release notes** created (`RELEASE_NOTES.md`, v0.4.0).
| 3. ✅ **Phase 19 — OAuth Connection Key flow** — `/authorize`, `/token`, PKCE, Bearer support (this PR).
| 4. ✅ **Phase 19.4 — Claude Native Connector Verification** — PKCE fix, DCR auto-register, token exchange, 25 Meta accounts, production debug disabled.
| 5. ⏳ **Add CI live test** only if safe backend test environment is available.
| 6. ⏳ **Add example MCP client config** with placeholders for `claude_desktop_config.json`.
| 7. ⏳ **Continue periodic `npm audit` monitoring** (currently 0).
| 8. ✅ **Phase 20A.1 — Persistent OAuth store foundation** — IOAuthStore interface, MemoryOAuthStore, SupabaseOAuthStore skeleton, factory, env config.
| 9. ⏳ **Phase 20B — Supabase production wiring** — SQL migration, real REST API, connection key bridge.
