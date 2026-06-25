# Release Notes

## v0.5.2 — Account-Level Performance Broker Tool

**Date:** 2026-06-25

### Added
- `ads_get_account_performance` MCP broker tool — fetch account-level performance for an ad account in remote broker mode.
- `getAccountInsights()` — new Meta API wrapper for `GET /act_{id}/insights` using `level=account`.
- `AdsProviderAdapter.getAccountPerformance()` — provider-agnostic interface method.
- `AdsBroker.getAccountPerformance()` — credential-resolved read method.
- Meta adapter normalization for account totals: spend, impressions, reach, clicks, link clicks, CTR, CPC, CPM, actions, purchase value, purchase ROAS, and leads.
- Fallback ROAS calculation from `purchase_value / spend` when Meta does not return `purchase_roas`.
- TikTok adapter returns `NOT_IMPLEMENTED` for account performance until TikTok account-level reporting is implemented.

### Why
- Portfolio and executive reports need account totals for a period, not campaign-by-campaign sums.
- Summing campaign ROAS is mathematically invalid; account ROAS should come from total revenue divided by total spend.
- Meta account-level Insights can be closer to Ads Manager totals for mixed objective, paused, old, CPAS, app, or marketplace campaign setups.

### Compatible
- Fully backward compatible. No breaking API changes.
- Tool count updated from 24 to 25.
- Existing campaign/adset/ad performance tools remain unchanged and should be used for drill-down analysis.

---

## v0.5.1 — Campaign Listing Broker Tool

**Date:** 2026-06-23

### Added
- `ads_list_campaigns` MCP broker tool — list all campaigns under an ad account in remote broker mode.
- `AdsProviderAdapter.listCampaigns()` — new interface method for provider-agnostic campaign listing.
- `AdsBroker.listCampaigns()` — broker method with credential resolution and permission checks.
- Meta adapter uses existing `getCampaigns()` tool (Meta API `GET /act_{id}/campaigns`).
- TikTok adapter uses new `getTikTokCampaigns()` tool (TikTok API `GET /campaign/get/`).
- `getTikTokCampaigns()` — new tool wrapping TikTok Business API campaign endpoint.
- Returns error `MISSING_ACCOUNT_ID` when accountId not provided or resolvable.
- 10 new unit tests (420 total, all passing).

### Why
- `meta_get_campaigns` (legacy) is blocked in remote broker mode because it cannot resolve credentials from Cuan Insight.
- `ads_get_campaign_performance` only returns campaigns with spending data in a given period, not a full listing.
- Users connecting via Cuan Insight connection key need a way to list all campaigns under their ad account.

### Compatible
- Fully backward compatible. No breaking API changes.
- Tool count updated from 23 to 24.

---

## v0.5.0 — Write Operations (Campaign Level)

**Date:** 2026-06-20

### Added
- `metaPost()` — new method on MetaClient for POST mutations to Meta Graph API.
- `pauseCampaign()` — pause a campaign via POST `{status: PAUSED}`.
- `resumeCampaign()` — resume a campaign via POST `{status: ACTIVE}`.
- `updateCampaignBudget()` — update daily budget with safety guard (max 200% increase).
- `renameCampaign()` — rename a campaign via POST `{name}`.
- Approval workflow — `previewCampaignMutation()` (dry-run, show before→after) + `executeCampaignMutation()` (audit log).
- AdsBroker `executeWrite()` with permissions check.
- MetaAdsAdapter: 4 write methods + capabilities `['read', 'write']`.
- MCP tools: `ads_pause_campaign`, `ads_resume_campaign`, `ads_update_campaign_budget`, `ads_rename_campaign`.
- 21 new unit tests (413 total, all passing).
- Real API dry-run verified against live Meta account.

### Compatible
- Fully backward compatible. Read-only tools unchanged.
- TikTok adapter returns NOT_IMPLEMENTED for write ops.

---

## v0.4.2 — Pagination Loop & Rate Limit Safety

**Date:** 2026-06-19

### Added
- Pagination loop — `MetaClient.metaGet(paginate: true)` auto-fetches all pages via cursor/after.
- Rate limit safety — parses `X-Ad-Account-Usage`, auto-delays at >80%, retries 429 with exponential backoff.
- New `paginate`, `maxPages`, `pageDelay` options on all 3 insight tools.
- CI pipeline — GitHub Actions runs `tsc --noEmit` + `npm test` + gitleaks on every PR.
- 16 new unit tests for pagination and rate limit (391 total).

### Changed
- ESLint migrated to flat config (`eslint.config.js`) for v9 compatibility.

### Compatible
- Fully backward compatible. Default `paginate: false` preserves existing behavior.

---

## v0.4.1 — Location Breakdown Insights

**Date:** 2026-06-03

### Added
- Added Cuan Insight Connection Key auth mode via `CUAN_INSIGHT_AUTH_MODE=connection_key`.
- Added `CUAN_INSIGHT_CONNECTION_KEY` env var support.
- Added `x-cuan-mcp-connection-key` resolver header sent to Cuan Insight credential endpoint.
- Documented hosted Cuan Insight credential control plane setup in README and docs.
- Added connection key redaction to `redactErrorMessage` and `redactTokenLikeValues`.
- Added 25 new tests covering config parsing, header behavior, URL construction, and redaction.

### Fixed
- Fixed credential resolver URL construction to preserve base paths such as `/functions/v1` (PR #23).

### Verified
- Live production smoke test passed using Cuan Insight Connection Key:
  - `tools/list` returned 13 MCP tools.
  - `ads_list_accounts` returned 25 Meta ad accounts.
  - Provider-level credential discovery resolved successfully (200 OK).
  - Revoked connection key was rejected with 401.
  - No fallback to other credential modes.
- No providerToken, raw connection key, key_hash, or Authorization header leaked in any output.

### Backward Compatibility
- Existing `CUAN_INSIGHT_MCP_TOKEN` flow remains the default and unchanged.
- `CUAN_INSIGHT_AUTH_MODE` defaults to `mcp_token`.
- All 13 MCP tools preserved.
- Legacy `meta_*` tools still available in local mode.

### PRs in This Release
| PR | Description |
|---|---|
| [#21](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/21) | Connection Key compatibility layer |
| [#22](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/22) | Documentation update |
| [#23](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/23) | Fix credential URL construction |

### Security
- Connection key redaction covers: `x-cuan-mcp-connection-key`, `connectionKey`, `connection_key`, `connection-key`.
- `redactErrorMessage` masks all auth headers and token-like values in error output.
- `gitleaks` clean (7 findings all false positives or gitignored).

---

## v0.3.0 — Multi-Platform AI Agent Support

- MCP server with stdio, SSE, and Streamable HTTP transports
- 13 read-only tools for Meta Ads analysis
- Remote credential resolution via Cuan Insight
- Rule engine with 26 pre-built templates
- AI skills for natural language ad analysis

---

## v0.2.0 — Rule Engine

- 26 pre-built rule templates (ecommerce, leadgen, brand, general)
- Campaign performance analysis
- Recommendation engine

---

## v0.1.0 — Foundation

- TypeScript library for Meta Marketing API
- 6 read-only tools
- MetaClient HTTP wrapper
