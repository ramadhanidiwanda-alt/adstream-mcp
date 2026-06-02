# Project Status — Meta Ads Agent Skill

> **Updated:** 2026-06-02  
> **Version:** v0.3.0  
> **Last Phase:** Phase 16a — SSE Remote Transport

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
  └─ [Future: Streamable HTTP] ──► Requires SDK upgrade (Phase 16b)
```

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

---

## D. Completed PRs

| Repo | PR | Title | Merge Commit | Summary |
|---|---|---|---|---|
| cuan-insight | [#52](https://github.com/ramadhanidiwanda-alt/cuan-insight/pull/52) | feat(mcp): support provider-level credential resolution | `33c1c89` | Adds provider-level discovery mode to `mcp-resolve-credential` edge function and `resolve_mcp_credential` RPC |
| meta-ads-agent-skill | [#16](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/16) | fix(meta): use provider-level credential resolution for account discovery | `064a487` | Updates `ads_list_accounts` to resolve credentials without accountId; accepts discovery response; maps `null` accountId correctly |
| meta-ads-agent-skill | TBD | feat(mcp): add SSE remote transport | TBD | Adds `MCP_TRANSPORT=sse` support, auth gate, docs update |

---

## E. Final Validation

All validations were performed after Phase 15.4 deploy on a live staging environment, plus Phase 16a local validation.

| Check | Result |
|---|---|
| `tools/list` | ✅ 13 tools returned (6 `ads_*` + 7 `meta_*`) |
| `ads_list_accounts` | ✅ OK — resolved via provider-level credential, returned 25 ad accounts |
| `ads_get_campaign_performance` | ✅ OK — 2 campaigns (account-scoped) |
| `ads_get_adset_or_adgroup_performance` | ✅ OK — 6 adsets |
| `ads_get_ad_performance` | ✅ OK — 9 ads |
| Unit tests | ✅ 211/211 passed (Phase 16a) |
| TypeScript typecheck | ✅ Passed |
| Build | ✅ Passed |
| SSE auth gate | ✅ 401 for missing/invalid token, 200 with valid token |
| SSE POST /mcp (no sessionId) | ✅ 501 (Streamable HTTP not implemented) |

---

## F. Security Notes

- **MCP server does not persist Meta tokens.** Credentials are resolved at runtime and discarded after the request completes.
- **providerToken** is used only internally for provider API calls and is never exposed in MCP responses.
- **Raw tokens** (Meta access tokens, providerToken, MCP tokens) must never be logged.
- **No secrets** should appear in test output, stderr, logs, or MCP responses.
- Use environment variables or placeholders (`<CUAN_INSIGHT_SUPABASE_URL>`, `<CUAN_INSIGHT_MCP_TOKEN>`) for all setup instructions.
- All credential errors are redacted through `redactErrorMessage` and `redactTokenLikeValues` utilities before surfacing.
- **SSE auth**: `MCP_HTTP_BEARER_TOKEN` gates all SSE endpoints. Missing/invalid tokens return 401.
- **Authorization header** must never be logged by the SSE transport.

---

## G. Known Limitations

### Remote MCP HTTP Transport (Streamable HTTP) Not Complete

The current MCP SDK version (`^0.5.0`) does not support the official **Streamable HTTP** server transport.
- An HTTP entrypoint (`POST /mcp`) exists and returns **501 Not Implemented** for MCP messages without a `sessionId` query parameter.
- **SSE transport** (`MCP_TRANSPORT=sse`) is now available as a remote alternative using the current SDK.
- Streamable HTTP should be revisited after MCP SDK upgrade (Phase 16b).

### TikTok Provider Support

- TikTok adapter is registered but returns `NOT_IMPLEMENTED` for all performance tools.
- Provider-level credential resolution for TikTok returns `PROVIDER_NOT_READY`.
- Full TikTok support requires additional development.

### Write Operations

All tools are read-only. Write operations (pause/resume campaigns, update budgets, create ads) are planned for v0.4.0.

---

## H. Next Steps (Optional)

1. ✅ **Phase 16a: Implement SSE remote transport** — Done.
2. 🔜 **Phase 16b: Upgrade MCP SDK** to v1.29+ for Streamable HTTP support.
3. 🔜 **Phase 16c: Migrate** from deprecated `Server` to `McpServer` API.
4. ⏳ **Prepare open-source release** notes and contribution guidelines.
5. ⏳ **Add CI live test** only if safe backend test environment is available.
6. ⏳ **Add example MCP client config** with placeholders for `claude_desktop_config.json`.
