# Project Status — Meta Ads Agent Skill

> **Updated:** 2026-06-03  
> **Version:** v0.3.0  
> **Last Phase:** Phase 17.5E — Docs & Release Readiness

### Phase 17.5 Across Sub-phases
| Phase | Summary | Key Changes | Status |
|---|---|---|---|
| **Phase 17.5B** | Audit credential resolver | Confirmed zero Connection Key support in codebase | ✅ Done |
| **Phase 17.5C** | Connection Key compatibility layer | `CUAN_INSIGHT_AUTH_MODE`, `CUAN_INSIGHT_CONNECTION_KEY`, `x-cuan-mcp-connection-key` header, 21 new tests | ✅ Done (PR #21) |
| **Phase 17.5D** | Cold smoke validation | tools/list (13 tools), ads_list_accounts via stdio, security redaction verified | ✅ Done |
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
| **Phase 17.5E** | **Docs & release readiness** — README, CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY, PROJECT_STATUS, REMOTE_MCP_HTTP updated |

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
| Streamable HTTP | supported | `MCP_TRANSPORT=streamable-http` | Official remote HTTP transport via SDK v1.29; Bearer auth required |

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

### Connection Key — Full Live Test Pending

- Connection Key compatibility layer is merged (Phase 17.5C, PR #21).
- Cold smoke test passed via stdio MCP server.
- **Full live smoke test requires a real Connection Key from Cuan Insight UI.**
- Live revoke test not yet performed.

### TikTok Provider Support

- TikTok adapter is registered but returns `NOT_IMPLEMENTED` for all performance tools.
- Provider-level credential resolution for TikTok returns `PROVIDER_NOT_READY`.

### Write Operations

All tools are read-only. Write operations (pause/resume campaigns, update budgets, create ads) are planned for v0.4.0.

---

## H. Next Steps

1. ⏳ **Full live smoke test** with real Cuan Insight Connection Key (create → resolve → revoke → verify fail)
2. ⏳ **Prepare open-source release** notes and contribution guidelines.
3. ⏳ **Add CI live test** only if safe backend test environment is available.
4. ⏳ **Add example MCP client config** with placeholders for `claude_desktop_config.json`.
5. ⏳ **Continue periodic `npm audit` monitoring** (currently 0).
