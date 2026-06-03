# Project Status — Meta Ads Agent Skill

> **Updated:** 2026-06-03  
> **Version:** v0.3.0  
> **Last Phase:** Phase 16c — MCP Server API Migration

---

## A. Project Overview

**meta-ads-agent-skill** is an open-source MCP (Model Context Protocol) server for Meta Ads analysis. It connects MCP-compatible AI clients to Meta Marketing API data through a credential gateway.

### Key Design Decisions

- **Cuan Insight** is the credential authority. It stores and manages all Meta access tokens, user/workspace/plan data, and account mappings.
- **meta-ads-agent-skill** is the MCP server. It does **not** store Meta tokens — credentials are resolved from Cuan Insight at runtime.
- The server supports **multi-user** and **multi-workspace** usage through remote credential resolution.
- All tools are **read-only**. Write operations (pause, budget, create) are not implemented.

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

---

## D. Completed PRs

| Repo | PR | Title | Merge Commit | Summary |
|---|---|---|---|---|
| cuan-insight | [#52](https://github.com/ramadhanidiwanda-alt/cuan-insight/pull/52) | feat(mcp): support provider-level credential resolution | `33c1c89` | Adds provider-level discovery mode to `mcp-resolve-credential` edge function and `resolve_mcp_credential` RPC |
| meta-ads-agent-skill | [#16](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/16) | fix(meta): use provider-level credential resolution for account discovery | `064a487` | Updates `ads_list_accounts` to resolve credentials without accountId; accepts discovery response; maps `null` accountId correctly |
| meta-ads-agent-skill | [#17](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/17) | feat(mcp): add SSE remote transport | `52b4b58` | Adds `MCP_TRANSPORT=sse` support, auth gate, docs update |
| meta-ads-agent-skill | TBD | chore(mcp): upgrade SDK for Streamable HTTP support | TBD | Upgrades MCP SDK to v1.29.0, adds `MCP_TRANSPORT=streamable-http`, preserves stdio and SSE |
| meta-ads-agent-skill | TBD | refactor(mcp): migrate server implementation to McpServer | TBD | Replaces deprecated direct `Server` request-handler registration with `McpServer.registerTool(...)`; preserves stdio, SSE, Streamable HTTP, credential resolver behavior, and tool business logic |

---

## E. Final Validation

All validations were performed after Phase 15.4 deploy on a live staging environment, plus Phase 16a/16b/16c local validation.

| Check | Result |
|---|---|
| `tools/list` | ✅ 13 tools returned (6 `ads_*` + 7 `meta_*`) |
| `ads_list_accounts` | ✅ OK — resolved via provider-level credential, returned 25 ad accounts |
| `ads_get_campaign_performance` | ✅ OK — 2 campaigns (account-scoped) |
| `ads_get_adset_or_adgroup_performance` | ✅ OK — 6 adsets |
| `ads_get_ad_performance` | ✅ OK — 9 ads |
| Unit tests | ✅ 218/218 passed (Phase 16c) |
| TypeScript typecheck | ✅ Passed |
| Build | ✅ Passed |
| MCP server package typecheck | ✅ Passed |
| MCP server package build | ✅ Passed |
| Stdio smoke test | ✅ `tools/list` returned 13 tools with expected names |
| SSE auth gate | ✅ 401 for missing/invalid token, 200 with valid token |
| SSE POST /mcp (no sessionId) | ✅ 501 (SSE still requires `sessionId`) |
| Streamable HTTP `/health` | ✅ 200 with `MCP_TRANSPORT=streamable-http` |
| Streamable HTTP `GET /mcp` | ✅ 501 for new session (POST required) |

---

## F. Security Notes

- **MCP server does not persist Meta tokens.** Credentials are resolved at runtime and discarded after the request completes.
- **providerToken** is used only internally for provider API calls and is never exposed in MCP responses.
- **Raw tokens** (Meta access tokens, providerToken, MCP tokens) must never be logged.
- **No secrets** should appear in test output, stderr, logs, or MCP responses.
- Use environment variables or placeholders (`<CUAN_INSIGHT_SUPABASE_URL>`, `<CUAN_INSIGHT_MCP_TOKEN>`) for all setup instructions.
- All credential errors are redacted through `redactErrorMessage` and `redactTokenLikeValues` utilities before surfacing.
- **SSE auth**: `MCP_HTTP_BEARER_TOKEN` gates all SSE endpoints. Missing/invalid tokens return 401.
- **Streamable HTTP auth**: `MCP_HTTP_BEARER_TOKEN` gates Streamable HTTP endpoints. Missing/invalid tokens return 401.
- **Authorization header** must never be logged by the SSE or Streamable HTTP transport.

---

## G. Known Limitations

### MCP Server API

The MCP SDK is upgraded to `^1.29.0`, Streamable HTTP is implemented, and Phase 16c migrated tool registration to the high-level `McpServer` API.
- Stdio remains the default entrypoint.
- **SSE transport** (`MCP_TRANSPORT=sse`) remains available.
- **Streamable HTTP transport** (`MCP_TRANSPORT=streamable-http`) is available behind explicit env opt-in.
- Direct project usage of deprecated `Server.setRequestHandler(ListToolsRequestSchema/CallToolRequestSchema)` has been removed.
- `McpServer` internally wraps SDK server primitives; this is expected and not project-level deprecated API usage.

### TikTok Provider Support

- TikTok adapter is registered but returns `NOT_IMPLEMENTED` for all performance tools.
- Provider-level credential resolution for TikTok returns `PROVIDER_NOT_READY`.
- Full TikTok support requires additional development.

### Write Operations

All tools are read-only. Write operations (pause/resume campaigns, update budgets, create ads) are planned for v0.4.0.

---

## H. Next Steps (Optional)

1. ✅ **Phase 16a: Implement SSE remote transport** — Done.
2. ✅ **Phase 16b: Upgrade MCP SDK + implement Streamable HTTP** — Done.
3. ✅ **Phase 16c: Migrate** from deprecated direct `Server` handlers to `McpServer` API — Done.
4. ⏳ **Prepare open-source release** notes and contribution guidelines.
5. ⏳ **Add CI live test** only if safe backend test environment is available.
6. ⏳ **Add example MCP client config** with placeholders for `claude_desktop_config.json`.
