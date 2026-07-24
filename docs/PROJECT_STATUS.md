# Project Status — Adstream MCP

> **Updated:** 2026-07-21  
> **Version:** v0.6.0  
> **Current Roadmap:** v0.6.0 — Canonical MCP Connector API

### Phase 17.5 Across Sub-phases

| Phase             | Summary                                        | Key Changes                                                                                                                                           | Status                             |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Phase 17.5B**   | Audit credential resolver                      | Confirmed zero Connection Key support in codebase                                                                                                     | ✅ Done                            |
| **Phase 17.5C**   | Connection Key compatibility layer             | `CUAN_INSIGHT_AUTH_MODE`, `CUAN_INSIGHT_CONNECTION_KEY`, `x-cuan-mcp-connection-key` header, 21 new tests                                             | ✅ Done (PR #21)                   |
| **Phase 17.5D**   | Cold smoke validation                          | tools/list (13 tools), ads_list_accounts via stdio, security redaction verified                                                                       | ✅ Done                            |
| **Phase 17.5F**   | URL fix + live smoke test                      | Fixed `new URL()` stripping `/functions/v1`, live smoke 25 Meta accounts, revoke 401 verified                                                         | ✅ Done (PR #23)                   |
| **Phase 20A.1**   | Persistent OAuth Store Foundation              | IOAuthStore interface, MemoryOAuthStore, SupabaseOAuthStore skeleton, createOAuthStoreFromEnv                                                         | ✅ Done (PR #30)                   |
| **Phase 20B.1-2** | Cuan Insight OAuth persistence schema + RPC    | `mcp_oauth_*` tables, resolve_mcp_oauth_token_credential RPC, Edge Function extension                                                                 | ✅ Done (cuán-insight PR #59, #60) |
| **Phase 20B.3**   | Wire SupabaseOAuthStore to credential resolver | SupabaseOAuthStore real persistence, connectionKeyId instead of raw key, dual authType (connection_key / oauth_token), async Supabase HTTP client     | ✅ Done (PR #31)                   |
| **Phase 17.5G**   | Release notes & tag v0.4.0                     | RELEASE_NOTES.md, version bump, tag                                                                                                                   | ✅ Done                            |
| **Phase 17.5E**   | Docs & release readiness                       | Update README.md, CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md, PROJECT_STATUS.md, REMOTE_MCP_HTTP.md                                                 | ✅ Done                            |
| **v0.5.0**        | Campaign write operations                      | `metaPost()`, pause/resume/update budget/rename campaign, dry-run approval workflow, audit entries, safety guard                                      | ✅ Done                            |
| **v0.5.1**        | Campaign listing broker tool                   | `ads_list_campaigns`, Meta + TikTok provider adapters, remote broker campaign listing                                                                 | ✅ Done                            |
| **v0.5.2**        | Account-level performance broker tool          | `ads_get_account_performance`, `getAccountInsights()`, normalized account metrics, ROAS fallback                                                      | ✅ Done                            |
| **v0.6.0**        | Canonical MCP connector API                    | `ads_get_performance`, `ads_get_creatives`, `ads_get_change_history`, `ads_get_capabilities`, canonical envelopes, cursor propagation, connector docs | ✅ Done                            |

---

## A. Project Overview

**adstream-mcp** is an open-source MCP (Model Context Protocol) connector hub for ads and commerce analytics. It currently connects MCP-compatible AI clients to Meta, Meta CPAS mode, TikTok regular ads, and TikTok GMV Max commerce data through local or Cuan Insight-backed credential flows, and is being expanded toward Google Ads plus Indonesian marketplace ads.

### Key Design Decisions

- **Cuan Insight** is the credential authority. It stores and manages all Meta access tokens, user/workspace/plan data, and account mappings.
- **adstream-mcp** is the MCP server. It does **not** store provider tokens — credentials are resolved from Cuan Insight at runtime.
- The server supports **multi-user** and **multi-workspace** usage through remote credential resolution (Connection Key or OAuth Token modes).
- Most tools remain read-oriented, but full write operations are now implemented across campaigns, ad sets, and ads — including create, update, pause/resume, archive, clone, and safety guards (budget cap, dry-run approval workflow).
- Broker permission policy now performs minimal credential-aware read gating for provider, account allow-list, and ads scopes while keeping writes denied by default unless explicitly configured.
- **Connection Key support** (Phase 17.5C): MCP server sends `x-cuan-mcp-connection-key` header when `CUAN_INSIGHT_AUTH_MODE=connection_key`.
- **Meta v25 objective baseline:** the six ODAX objectives are operational through the existing guarded creation workflow. Marketers can prepare Awareness (`AWARENESS`), Traffic (`WEBSITE`), Engagement (`POST`/`VIDEO`), Leads (`WEBSITE`/`INSTANT_FORM`), App Promotion (`APP`), and Sales (`WEBSITE`) structures. Focused coverage passes; release completion remains pending a green full suite.
- Creation is not activation: campaign, ad set, and ad start `PAUSED`, are read back for audit, and require a second explicit approval before resume. Meta still decides live-account eligibility, policy approval, and delivery.

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

| Auth Mode             | Env                           | Header                                        | Use Case                         |
| --------------------- | ----------------------------- | --------------------------------------------- | -------------------------------- |
| `mcp_token` (default) | `CUAN_INSIGHT_MCP_TOKEN`      | `Authorization: Bearer` or `X-Cuan-MCP-Token` | Developer self-host, legacy      |
| `connection_key`      | `CUAN_INSIGHT_CONNECTION_KEY` | `x-cuan-mcp-connection-key`                   | Cuan Insight UI AI/MCP Connector |

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
Call provider insights/report endpoint
  │
  ▼
Return normalized ads or commerce performance data
```

---

## C. Completed Phases

| Phase                                  | Description                                                                                                                                                    | Key changes                                                                                                              | Status                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Phase 1-11                             | Foundation, read-only tools, rule engine, AI skills                                                                                                            | —                                                                                                                        | ✅ Done                                             |
| Phase 12A                              | Docker MCP support                                                                                                                                             | —                                                                                                                        | ✅ Done                                             |
| Phase 12B                              | Remote MCP HTTP skeleton                                                                                                                                       | —                                                                                                                        | ✅ Done                                             |
| Phase 13                               | Credential resolver architecture and production                                                                                                                | —                                                                                                                        | ✅ Done                                             |
| Phase 14                               | Meta OAuth platform connection sync fix, `act_` prefix fix                                                                                                     | —                                                                                                                        | ✅ Done                                             |
| Phase 15.1                             | Generic MCP client setup docs                                                                                                                                  | —                                                                                                                        | ✅ Done                                             |
| Phase 15.2                             | Provider-level credential resolution (Cuan Insight RPC + Edge Function)                                                                                        | —                                                                                                                        | ✅ Done                                             |
| Phase 15.3                             | `ads_list_accounts` uses provider-level credential resolution                                                                                                  | —                                                                                                                        | ✅ Done                                             |
| Phase 15.4                             | Controlled deploy + live MCP client test                                                                                                                       | —                                                                                                                        | ✅ Done                                             |
| Phase 15.5                             | Final project documentation                                                                                                                                    | —                                                                                                                        | ✅ Done                                             |
| **Phase 16**                           | **Remote MCP HTTP evaluation** — SDK supports Streamable HTTP in v1.29+, but upgrade has medium risk                                                           | —                                                                                                                        | ✅ Done                                             |
| **Phase 16a**                          | **SSE remote transport implemented** — using existing SDK v0.5.0, no upgrade needed                                                                            | —                                                                                                                        | ✅ Done                                             |
| **Phase 16b**                          | **MCP SDK upgraded to v1.29.0 + Streamable HTTP implemented** — stdio default and SSE preserved                                                                | —                                                                                                                        | ✅ Done                                             |
| **Phase 16c**                          | **MCP server migrated to `McpServer` API** — deprecated direct `Server` request handlers removed, 13-tool surface preserved                                    | —                                                                                                                        | ✅ Done                                             |
| **Phase 16d**                          | **Dependency audit remediated** — `vitest` upgraded to 4.1.8, audit reduced from 4 vulnerabilities to 0                                                        | —                                                                                                                        | ✅ Done                                             |
| **Phase 17.5B**                        | **Audit credential resolver** — confirmed zero Connection Key support in codebase                                                                              | —                                                                                                                        | ✅ Done                                             |
| **Phase 17.5C**                        | **Connection Key compatibility layer**                                                                                                                         | `CUAN_INSIGHT_AUTH_MODE`, `CUAN_INSIGHT_CONNECTION_KEY`, `x-cuan-mcp-connection-key` header, 21 new tests, PR #21 merged | ✅ Done (PR #21)                                    |
| **Phase 17.5D**                        | **Cold smoke validation**                                                                                                                                      | tools/list (13 tools), ads_list_accounts via stdio, security redaction verified                                          | ✅ Done                                             |
| **Phase 17.5F**                        | URL fix + live smoke test                                                                                                                                      | Fixed `new URL()` stripping `/functions/v1`, live smoke 25 Meta accounts, revoke 401 verified                            | ✅ Done (PR #23)                                    |
| **Phase 20A.1**                        | Persistent OAuth Store Foundation                                                                                                                              | IOAuthStore interface, MemoryOAuthStore, SupabaseOAuthStore skeleton, createOAuthStoreFromEnv                            | ✅ Done (PR #30)                                    |
| **Phase 20B.1-2**                      | Cuan Insight OAuth persistence schema + RPC                                                                                                                    | `mcp_oauth_*` tables, resolver RPC, Edge Function extension                                                              | ✅ Done (Cuan Insight PR #59, #60)                  |
| **Phase 20B.3**                        | Wire SupabaseOAuthStore to credential resolver                                                                                                                 | Persistent store, opaque `connectionKeyId`, dual auth type, async Supabase client                                        | ✅ Done (PR #31)                                    |
| **Phase 17.5G**                        | Release notes & tag v0.4.0                                                                                                                                     | RELEASE_NOTES.md, version bump, tag                                                                                      | ✅ Done                                             |
| **Phase 17.5E**                        | **Docs & release readiness**                                                                                                                                   | README, connection-key compatibility, project status, and remote transport docs updated                                  | ✅ Done                                             |
| **Meta v25 objective launch baseline** | Six ODAX objectives with canonical destination validation, PAUSED creation/read-back flow, v23/v24/v25 compatibility, and CPAS catalog v25 regression coverage | Focused tests pass; no live contract test or activation run                                                              | ⚠️ Not release-complete until the full suite passes |
| **Phase 19**                           | **MCP OAuth Connection Key Authorization Flow**                                                                                                                | `/authorize`, `/token`, PKCE, Bearer token support, `.well-known/` metadata, 30+ tests, docs                             | ✅ Done                                             |
| **Phase 19.4**                         | **Claude Native Connector Verification**                                                                                                                       | PKCE base64url fix, resource preservation, DCR auto-register, token exchange, 25 Meta accounts, safe debug logging       | ✅ Done                                             |

## D. Completed PRs

| PR  | Title                                                     | Merge Commit | Summary                                              |
| --- | --------------------------------------------------------- | ------------ | ---------------------------------------------------- |
| #21 | docs(mcp): document Cuan Insight connection key auth mode | `fed1321`    | Connection Key compatibility layer + 21 tests + docs |

---

## E. Transport Matrix

| Transport       | Status    | Env                             | Notes                                                                                                            |
| --------------- | --------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| stdio           | default   | (none)                          | Safest local/client mode; legacy `meta_*` tools available                                                        |
| SSE             | supported | `MCP_TRANSPORT=sse`             | Remote option; Bearer auth required via `MCP_HTTP_BEARER_TOKEN`                                                  |
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

- TikTok adapter supports campaign listing via `ads_list_campaigns`.
- TikTok regular read paths support account, campaign, adgroup, ad, and placement performance through normalized `AdsMetricRecord` rows.
- TikTok placement performance uses report `placement_type` and maps it into normalized `dimensions.platform` / `dimensions.placement`.
- TikTok GMV Max is exposed through `commerce_get_performance provider=tiktok_gmv` with normalized `CommerceRecord[]`, totals, metadata, and warnings.

### Google Ads Provider Support

- Google Ads provider id, capability matrix entry, provider registry registration, and MCP schemas are implemented.
- Google Ads read paths normalize account, campaign, adgroup, and ad rows into `AdsMetricRecord`.
- Google Ads REST client uses OAuth access token + developer token for `googleAds:searchStream`.
- Hosted provider credential availability still depends on Cuan Insight provider configuration and scopes.

### Write Operations

- Full write operations are now implemented across all entity levels: campaign, ad set, ad, and creative.
- Campaign-level: pause, resume, budget update, rename, create, update.
- Ad set-level: pause, resume, create, update, clone.
- Ad-level: pause, resume, create, update, archive.
- Creative-level: create (flexible, video, single_image, carousel), upload image/video.
- TikTok GMV Max: create/update/delete campaigns and sessions.
- TikTok Smart Plus: create/pause/resume campaigns and ad groups.
- Safety guards: `budgetSafetyGuard` (max 200% increase), `campaignBudgetSafetyGuard`, rate-limit awareness.
- Approval workflow: dry-run → confirm → execute → audit entry, no token leakage. MCP tool annotations separate destructive (archive, pause, update) from additive (create, resume) writes.
- Clone tools: `ads_clone_adset`, `ads_clone_ui_ad` (duplicate UI ad configuration from an existing ad).
- Read-full tools: `ads_read_creative_full` (reverse-engineer creative payload), `ads_read_adset_full` (full targeting/budget config).
- Create operations remain behind explicit confirmation.

### Meta v25 Objective Launch Baseline

- The default Meta API version is `v25.0`; canonical baseline combinations are explicitly compatible with v23, v24, and v25.
- The operational objectives are Awareness → `AWARENESS`, Traffic → `WEBSITE`, Engagement → `POST` or `VIDEO`, Leads → `WEBSITE` or `INSTANT_FORM`, App Promotion → `APP`, and Sales → `WEBSITE`.
- Collaborative Ads / CPAS catalog sales is covered by a v25 regression path only; it needs catalog and product-set access already granted in Meta.
- No live Meta contract test was run for this release scope. Focused tests validate payloads and safety contracts; the full suite must be green before the baseline is release-complete. Meta account eligibility, policy approval, and delivery remain external decisions.
- Deferred: Messaging, Calls, broader Catalog/CPAS, app events/value/re-engagement, Ad Recall Lift, Quality Leads/CRM, and additional Advantage+ variants.

---

## H. Next Steps

1. ✅ **Full live smoke test** with real Cuan Insight Connection Key — done (Phase 17.5F, PR #23).
2. ✅ **Phase 19 — OAuth Connection Key flow** — `/authorize`, `/token`, PKCE, Bearer support.
3. ✅ **Phase 20B.4 — Persistent OAuth Supabase Store production verification** — restart-safe OAuth token persistence verified.
4. ✅ **v0.5.0 — Campaign write operations** — pause/resume/budget/rename with dry-run approval workflow.
5. ✅ **v0.5.1 — Campaign listing broker tool** — `ads_list_campaigns` for Meta and TikTok adapter path.
6. ✅ **v0.5.2 — Account-level performance broker tool** — `ads_get_account_performance` for Meta and TikTok.
7. ✅ **TikTok parity + Meta CPAS read mode** — TikTok regular placement/read parity, TikTok GMV Max commerce data, and Meta CPAS `params.mode="cpas"`.
8. ✅ **Google Ads read-only provider foundation** — account/campaign/adgroup/ad performance normalizer, provider registration, and REST SearchStream client.
9. ✅ **RBAC minimal foundation** — provider/account/scope read gating plus default-deny write policy.
10. ✅ **v0.6.0 — Adset/ad write operations** — create, update, pause/resume, archive, clone across ad sets and ads plus creative creation.
11. ✅ **Safety guard expansion** — `budgetSafetyGuard`, `campaignBudgetSafetyGuard`, destructive/additive tool annotations, rate-limit awareness.
12. ✅ **TikTok write operations** — GMV Max create/update/delete campaigns and sessions; Smart Plus create/pause/resume campaigns and ad groups.
13. ✅ **Read-full tools** — `ads_read_creative_full`, `ads_read_adset_full` for reverse engineering live ad configurations.
14. ⏳ **Release hygiene** — keep `package.json`, `CHANGELOG.md`, `ROADMAP.md`, tags, and project status synchronized.

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
