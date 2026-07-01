# Project Status — Adstream MCP

> **Updated:** 2026-06-25  
> **Version:** v0.5.2  
> **Current Roadmap:** v0.6.0 — Write Operations for Adset & Ad

### Phase 17.5 Across Sub-phases
| Phase | Summary | Key Changes | Status |
|---|---|---|---|
| **Phase 17.5B** | Audit credential resolver | Confirmed zero Connection Key support in codebase | ✅ Done |
| **Phase 17.5C** | Connection Key compatibility layer | `CUAN_INSIGHT_AUTH_MODE`, `CUAN_INSIGHT_CONNECTION_KEY`, `x-cuan-mcp-connection-key` header, 21 new tests | ✅ Done (PR #21) |
| **Phase 17.5D** | Cold smoke validation | tools/list (13 tools), ads_list_accounts via stdio, security redaction verified | ✅ Done |
| **Phase 17.5F** | URL fix + live smoke test | Fixed `new URL()` stripping `/functions/v1`, live smoke 25 Meta accounts, revoke 401 verified | ✅ Done (PR #23) |
| **Phase 20A.1** | Persistent OAuth Store Foundation | IOAuthStore interface, MemoryOAuthStore, SupabaseOAuthStore skeleton, createOAuthStoreFromEnv | ✅ Done (PR #30) |
| **Phase 20B.1-2** | Cuan Insight OAuth persistence schema + RPC | mcp_oauth_* tables, resolve_mcp_oauth_token_credential RPC, Edge Function extension | ✅ Done (cuán-insight PR #59, #60) |
| **Phase 20B.3** | Wire SupabaseOAuthStore to credential resolver | SupabaseOAuthStore real persistence, connectionKeyId instead of raw key, dual authType (connection_key / oauth_token), async Supabase HTTP client | ✅ Done (PR #31) |
| **Phase 17.5G** | Release notes & tag v0.4.0 | RELEASE_NOTES.md, version bump, tag | ✅ Done |
| **Phase 17.5E** | Docs & release readiness | Update README.md, CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md, PROJECT_STATUS.md, REMOTE_MCP_HTTP.md | ✅ Done |
| **v0.5.0** | Campaign write operations | `metaPost()`, pause/resume/update budget/rename campaign, dry-run approval workflow, audit entries, safety guard | ✅ Done |
| **v0.5.1** | Campaign listing broker tool | `ads_list_campaigns`, Meta + TikTok provider adapters, remote broker campaign listing | ✅ Done |
| **v0.5.2** | Account-level performance broker tool | `ads_get_account_performance`, `getAccountInsights()`, normalized account metrics, ROAS fallback | ✅ Done |

---

## A. Project Overview

**adstream-mcp** is an open-source MCP (Model Context Protocol) connector hub for ads and commerce analytics. It currently connects MCP-compatible AI clients to Meta and partial TikTok data through a credential gateway, and is being expanded toward Google Ads plus Indonesian marketplace ads.

### Key Design Decisions

- **Cuan Insight** is the credential authority. It stores and manages all Meta access tokens, user/workspace/plan data, and account mappings.
- **adstream-mcp** is the MCP server. It does **not** store provider tokens — credentials are resolved from Cuan Insight at runtime.
- The server supports **multi-user** and **multi-workspace** usage through remote credential resolution (Connection Key or OAuth Token modes).
- Most tools remain read-oriented, but campaign-level write operations are now implemented behind explicit dry-run/confirmation and safety guards. Adset/ad write operations are next.
- **Connection Key support** (Phase 17.5C): MCP server sends `x-cuan-mcp-connection-key` header when `CUAN_INSIGHT_AUTH_MODE=connection_key`.

---

## B. Architecture

### High-Level Flow

```
MCP Client (Claude Desktop, Cline, etc.)
  │
  ├─ [Stdio] ──► adstream-mcp (MCP Server via stdio)
  │
  ├─ [SSE] ───► adstream-mcp (MCP Server via SSE, Phase 16a)
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
  └─ [Streamable HTTP] ──► adstream-mcp (MCP Server via Streamable HTTP, Phase 16b)
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
| **Phase 20A.1** | Persistent OAuth Store Foundation | IOAuthStore interface, MemoryOAuthStore, SupabaseOAuthStore skeleton, createOAuthStoreFromEnv | ✅ Done (PR #30) |
| **Phase 20B.1-2** | Cuan Insight OAuth persistence schema + RPC | mcp_oauth_* tables, resolve_mcp_oauth_token_credential RPC, Edge Function extension | ✅ Done (cuán-insight PR #59, #60) |
| **Phase 20B.3** | Wire SupabaseOAuthStore to credential resolver | SupabaseOAuthStore real persistence, connectionKeyId instead of raw key, dual authType (connection_key / oauth_token), async Supabase HTTP client | ✅ Done (PR #31) |
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

- **Hosted multi-user limitation:** Env-based `CUAN_INSIGHT_CONNECTION_KEY` is still for local/single-tenant deployments. Per-request `x-cuan-mcp-connection-key` header passthrough must be used for hosted multi-user remote MCP. Do not configure a shared global connection key for multi-user deployments.

### OAuth Connector Flow (Phase 19)

- OAuth implementation uses **in-memory store by default** (backward compatible).
- **Persistent store (Phase 20B.4)**: `MCP_OAUTH_STORE_DRIVER=supabase` supports production-verified persistence via Supabase.
- Auth codes and access tokens are lost on server restart when using default memory driver.
- No refresh token support — re-authorize when access token expires.
- Connection Key validation probes Cuan Insight; if resolver is unavailable, key is accepted as valid and errors surface at tool call time.
- Bearer token resolution order: OAuth access token store → `MCP_HTTP_BEARER_TOKEN` (static) → `x-cuan-mcp-connection-key`.

### TikTok Provider Support

- TikTok adapter supports campaign listing via `ads_list_campaigns`, but account performance still returns `NOT_IMPLEMENTED`.
- Provider-level credential resolution for TikTok returns `PROVIDER_NOT_READY`.

### Write Operations

- Campaign-level write operations are implemented for pause, resume, budget update, and rename.
- Write tools must preserve the existing safety model: dry-run first, explicit confirmation before execution, audit entry, no token leakage.
- Adset/ad write operations, batch operations, rollback, and whitelist/blacklist guardrails are planned for v0.6.0.
- Create operations remain out of scope.

---

## H. Next Steps

1. ✅ **Full live smoke test** with real Cuan Insight Connection Key — done (Phase 17.5F, PR #23).
2. ✅ **Phase 19 — OAuth Connection Key flow** — `/authorize`, `/token`, PKCE, Bearer support.
3. ✅ **Phase 20B.4 — Persistent OAuth Supabase Store production verification** — restart-safe OAuth token persistence verified.
4. ✅ **v0.5.0 — Campaign write operations** — pause/resume/budget/rename with dry-run approval workflow.
5. ✅ **v0.5.1 — Campaign listing broker tool** — `ads_list_campaigns` for Meta and TikTok adapter path.
6. ✅ **v0.5.2 — Account-level performance broker tool** — `ads_get_account_performance` for Meta.
7. ⏳ **v0.6.0 — Adset/ad write operations** — extend mutation coverage below campaign level.
8. ⏳ **Safety guard expansion** — batch limits, rollback, whitelist, blacklist, and max-change rate limits.
9. ⏳ **Release hygiene** — keep `package.json`, `CHANGELOG.md`, `ROADMAP.md`, tags, and project status synchronized.

---

## Phase 20B.4 Production Verification — Persistent OAuth Supabase Store

**Status:** ✅ Verified on 2026-06-04

### Final State
- Supabase persistent OAuth store active with `MCP_OAUTH_STORE_DRIVER=supabase`.
- OAuth clients, authorization codes, access tokens, and events persist in Cuan Insight Supabase tables.
- OAuth access tokens are persisted by `token_hash`; raw access tokens are never stored.
- OAuth access token rows store `connection_key_id` as an opaque reference; raw Connection Keys are not stored in OAuth token tables.
- Cuan Insight credential resolver supports `authType=oauth_token` for persisted token resolution.
- `loadPersistedData()` is awaited before `server.listen()` so restart cannot serve requests before token cache hydration finishes.
- `ads_list_accounts` is remote-safe and uses OAuth user token context through Cuan Insight resolver.
- `meta_get_ad_accounts` in remote mode routes to the same remote-safe account listing path instead of depending on local `META_*` environment variables.
- MCP tool responses keep valid MCP content contract: `content[0].type = "text"` and `content[0].text` is a string.
- Production debug flags must stay disabled after verification: `MCP_OAUTH_DEBUG=false`, `MCP_SUPABASE_STORE_DEBUG=false`.

### Production Verification Result
- `ads_list_accounts` works before container restart.
- `ads_list_accounts` works after container restart without reconnect.
- Persistent OAuth token reload confirmed.
- Health response verified: `{"ok":true,"transport":"streamable-http","mode":"remote","oauth":true}`.

### Rollback
1. Set `MCP_OAUTH_STORE_DRIVER=memory`.
2. Restart `cuan-mcp`.
3. Ask Claude/ChatGPT connector users to reconnect if existing OAuth sessions were minted by persistent store.

### Security Notes
- Do not enable `MCP_OAUTH_DEBUG` or `MCP_SUPABASE_STORE_DEBUG` in production after verification.
- Do not log or commit provider tokens, OAuth tokens, auth codes, code verifiers, raw Connection Keys, `key_hash`, full `token_hash`, full `code_hash`, or `Authorization` headers.
