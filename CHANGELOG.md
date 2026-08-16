# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Ad set spend controls & audience segments

- **`ads_create_adset`** and **`ads_update_adset`** — new `dailySpendCap`,
  `dailyMinSpendTarget`, `lifetimeSpendCap`, and `lifetimeMinSpendTarget`
  parameters, mapping to Meta's `daily_spend_cap`, `daily_min_spend_target`,
  `lifetime_spend_cap`, and `lifetime_min_spend_target`. Carried through by
  **`ads_read_adset_full`** and **`ads_clone_adset`**.
- **`ads_get_account_info`** — now returns `existing_customers`, the ad
  account's audience-segment custom audience IDs (Ads Manager: Advertising
  settings → Segmen pemirsa). Optional and absent when segments were never
  configured; read-only.
- New reference doc,
  `skills/meta-ads/shared/references/ui-label-to-api-field.md`, mapping Ads
  Manager UI labels to Marketing API field names, including the deprecated
  `existing_customer_budget_percentage`.

### Added — Creative asset resolution

- **`ads_resolve_creative_assets`** — read-only Meta tool that resolves the best
  available thumbnail for each ad instead of settling for the generic AdCreative
  `thumbnail_url`. Returns ranked candidates with `url`, `source`, `width`,
  `height`, `quality`, and `media_kind`, plus `best_thumbnail`, `video_id`, and
  `image_hashes`. It resolves assets from three places: `image_hash` via
  `/act_{id}/adimages` (looked up by explicit `hashes`, batched 50 per call),
  `video_id` via `/{video_id}/thumbnails`, and Instagram-native placements via
  the IG media node (`effective_instagram_media_id` /
  `source_instagram_media_id`). Per-entity lookups are capped at 5 concurrent
  Graph calls, and a failing video or Instagram lookup degrades to the remaining
  candidates rather than failing the page. Supports `adIds`, `campaignId`,
  `adSetId`, raw `filtering`, `limit`, `cursor`, and
  `thumbnailWidth`/`thumbnailHeight`; the next page cursor is returned as
  `meta.nextCursor`. The tool resolves URLs only — it does not download files or
  build a report. Google and TikTok return structured `NOT_IMPLEMENTED`.

### Fixed — Unknown `params` keys are rejected, not dropped

`params` was never a raw Graph API passthrough, but unknown keys were silently
discarded: a caller passing `params: { fields: "id,name" }` got a normal-looking
successful response with their input gone and no way to tell. The contract is now
enforced once, in `handleAdsMcpToolCall`, for every tool that opts in.

- **`ads_read_adset_full`**, **`ads_read_creative_full`**, and
  **`ads_create_adcreative`** — unknown `params` keys now return
  `ok: false` with error code `UNKNOWN_PARAM`, naming each unrecognized key and
  mapping raw Graph API spellings to the typed option where one exists (for
  example `image_hash → imageHash`). The broker never reaches the provider.
- The allowed keys are derived from each tool's own `inputSchema`, so the
  contract cannot drift from what the tool publicly declares.
- Every other tool is unchanged and still accepts free-form `params`. See
  "Strict `params` Contract" in `docs/MCP_API_DESIGN.md` for how a tool opts in.

### Fixed — Creative read-back no longer fails a creative that was created

- **`ads_create_adcreative`** — the post-create read-back requested
  `media_sourcing_spec` without a version gate, while `getMetaCreativeFields`
  gated the same field. Because the read-back is one combined Graph request, an
  unsupported field 400s the whole call, which became a `warning` verification —
  and the `placement_image` and video-CTWA paths escalate anything that is not
  `verified` into `status: 'failed'`, telling the caller not to use a creative
  that Meta had in fact created. Requests on supported versions are byte-for-byte
  unchanged. Note that live probing showed Meta silently upgrades a requested
  version below the calling app's floor — v18.0 through v24.0 were all served as
  v25.0 per the `facebook-api-version` response header — so an app on a v25.0
  floor could never reach the failing path regardless; see the findings recorded
  in `src/providers/meta/metaApiVersionSupport.ts`.
- `supportsMediaSourcingSpec` moved from `MetaAdsAdapter` into the shared
  `metaApiVersionSupport` module next to `supportsThreadsUserIdField`, which had
  been an identical copy of the same version check.

### Fixed — Click-to-message creative integrity

A Click-to-Instagram-Direct ad shipped with a dead CTA button and no welcome
message while the dry-run stayed green, because fields the tool accepted were
dropped before the Graph API call. Full account in
`docs/superpowers/specs/2026-07-26-ctx-messaging-creative-gaps-design.md`.

- **`ads_create_adcreative`** — `creativeSpec.appDestination` now becomes
  `call_to_action.value.app_destination`, and `creativeSpec.pageWelcomeMessage` is sent
  as `page_welcome_message` at the creative root (where Ads Manager stores it for
  existing-post creatives). `pageWelcomeMessage` accepts Meta's VISUAL_EDITOR object,
  not just a string.
- **`ads_create_adcreative`** — `existing_post` Instagram Direct messaging accepts
  `creativeSpec.appDestination` and `creativeSpec.destinationUrl` together, sending
  `call_to_action.value.app_destination` and `call_to_action.value.link`. Meta rejects
  this path with subcode 2061015 when the link is absent, so `destinationUrl` remains
  required for this specific combination.
- **`ads_create_adcreative`** — `welcomeMessageTemplateName` expands a saved local
  welcome message template into `creativeSpec.pageWelcomeMessage` before the creative
  payload is built.
- **`ads_create_welcome_message_template`** and
  **`ads_list_welcome_message_templates`** — local reusable welcome-message template
  tools for Messenger/Instagram creatives.
- **`ads_create_ad`** — rejects a click-to-message ad set paired with a CTA for a
  different inbox, covering the four `MESSAGING_*` combinations and
  `value.app_destination`. Bypass with `skipMessagingDestinationCheck`.
- **`ads_clone_adset`** — new `attributionSpec` parameter overrides the source's
  `attribution_spec`; `null` or `[]` drops it. Cloning a 7-day-click source to
  `optimization_goal: CONVERSATIONS` was previously impossible (Meta subcode 1885423).
- **`ads_get_ad_preview`** — `adFormat` now uses Meta's real `ad_format` enum. All ten
  previously offered values were misspelled and rejected by Meta; the old names are
  rejected with their correct replacements.
- **`ads_update_ad`** — a dry-run reports `success: true` instead of `false`.

### Changed

- **Breaking for malformed input:** `creativeSpec` rejects fields it does not map, for
  all nine creative formats, naming the typed field for raw Graph spellings. Previously
  these were dropped silently, so a clean dry-run did not mean a complete payload.
- **`ads_create_adcreative`** — `destinationType` gains Meta's four `MESSAGING_*`
  multi-destination values.
- **`ads_check_launch_readiness`** — new `engagement_messaging` workflow for CTX/CTWA
  (`MESSAGING` conversion location, `CONVERSATIONS`, new `messagingDestination` input),
  recommending `ads_clone_ui_ad` and warning that `CONVERSATIONS` requires a 1-day
  attribution window. The `whatsapp_sales` alias now resolves here instead of
  `sales_website`.
- **`ads_get_ad_creative_mapping`** — description now documents the `campaignId`,
  `adSetId`, `filtering`, `limit` and `cursor` parameters, which already worked but were
  undiscoverable. Scoping is covered by regression tests.

## [0.6.0] - 2026-07-06

### Added — Canonical MCP Connector API

- **`ads_get_performance`** — canonical read tool that returns a standard performance envelope (`provider`, `account`, `dateRange`, `currency`, `level`, `dimensions`, `metrics`, `rows`, `paging`, `warnings`, `dataFreshness`, `capabilities`, `unsupportedMetrics`). Routes to existing level-specific broker methods.
- **`ads_get_creatives`** — canonical creative read tool backed by Meta `/act_{id}/adcreatives` asset fetching; returns creative metadata in the canonical envelope.
- **`ads_get_change_history`** — canonical change-history tool backed by Meta account activities; unsupported providers return structured `NOT_IMPLEMENTED`.
- **`ads_get_capabilities`** — canonical discovery tool combining static metadata, metric catalogs, and registered provider adapter capabilities.
- Canonical pagination cursors propagated through adapters: Meta ads/creatives/change history pass Meta cursors, TikTok ads and GMV Max commerce use next-page cursors, Google reports explicit `null`.
- Standard commerce envelope for **`commerce_get_performance`** alongside existing `records`/`totals`/`metadata` fields.
- New docs: `docs/ARCHITECTURE.md`, `docs/MCP_API_DESIGN.md`, `docs/LEGACY_AND_MIGRATION.md`; canonical migration example `examples/canonical-migration.ts`.

### Changed

- Repositioned README, skills, and MCP server README around the connector/data-access-layer vision (MCP provides data; AI/skills provide reasoning).
- Legacy provider-specific and level-specific tools now carry deprecation/migration guidance in their descriptions.

### Backward Compatible

- No public MCP tools were removed; legacy `meta_*`, `tiktok_*`, and level-specific tools remain registered.
- `commerce_get_performance` keeps existing response fields.

## [0.5.2] - 2026-06-25

### Added — Account-Level Performance Broker Tool

- **`ads_get_account_performance`** MCP broker tool — fetch total Meta ad account performance directly from Meta Insights at `level=account`.
- **`getAccountInsights()`** — new Meta API tool calling `GET /act_{id}/insights` with `level: 'account'`.
- **`AdsProviderAdapter.getAccountPerformance()`** and **`AdsBroker.getAccountPerformance()`** — broker method with credential resolution and permission checks.
- **Meta adapter** — returns normalized account-level metrics for spend, impressions, reach, clicks, link clicks, CTR, CPC, CPM, actions, purchase value, purchase ROAS, and leads.
- **ROAS fallback** — when Meta does not return `purchase_roas`, normalized output calculates ROAS from `purchase_value / spend` when both values are available.
- **TikTok adapter** — returns `NOT_IMPLEMENTED` for account performance until TikTok account-level reporting is implemented.

### Backward Compatible

- No breaking API changes.
- Existing campaign/adset/ad/creative performance tools are unchanged.
- Tool count updated from 24 to 25.

## [0.5.1] - 2026-06-23

### Added — Campaign Listing Broker Tool

- **`ads_list_campaigns`** MCP broker tool — list all campaigns under an ad account in remote broker mode
- **`AdsProviderAdapter.listCampaigns()`** — new interface method for provider-agnostic campaign listing
- **`AdsBroker.listCampaigns()`** — broker method with credential resolution and permission checks
- **Meta adapter** — uses existing `getCampaigns()` tool (Meta API `GET /act_{id}/campaigns`)
- **TikTok adapter** — new `getTikTokCampaigns()` tool (TikTok API `GET /campaign/get/`)
- **`getTikTokCampaigns()`** — new tool wrapping TikTok Business API campaign endpoint
- Returns error `MISSING_ACCOUNT_ID` when accountId not provided or resolvable
- 10 new unit tests (420 total, all passing)
- Closes gap where `meta_get_campaigns` was blocked in remote broker mode

### Backward Compatible

- No breaking API changes
- Tool count updated from 23 to 24
- TikTok adapter returns `NOT_IMPLEMENTED` when no client configured (same pattern as existing tools)

## [0.5.0] - 2026-06-20

### Added — Write Operations (Campaign Level)

- **`metaPost()`**: New method on `MetaClient` for POST mutations to Meta Graph API
- **4 Campaign Mutation Tools**:
  - `pauseCampaign()` — POST `{status: PAUSED}`
  - `resumeCampaign()` — POST `{status: ACTIVE}`
  - `updateCampaignBudget()` — POST `{daily_budget}` with safety guard (max 200% increase)
  - `renameCampaign()` — POST `{name}`
- **Approval Workflow** (`campaignMutations.ts`):
  - `previewCampaignMutation()` — fetch current state, show diff (before → after)
  - `executeCampaignMutation()` — dry-run mode (no changes) or execute mode
  - Audit log entry with status: `dry_run` → `executed` / `failed`
- **AdsBroker**: `executeWrite()` with permissions check
- **MetaAdsAdapter**: 4 write methods + capabilities updated to `['read', 'write']`
- **MCP tools**: `ads_pause_campaign`, `ads_resume_campaign`, `ads_update_campaign_budget`, `ads_rename_campaign`
- **Tests**: 21 new unit tests (5 test files) — 413 total, all passing
- **Real API verified**: Dry-run tested against live Meta account — confirmed safe

### Backward Compatible

- No breaking API changes
- Write tools require explicit dry-run or confirmation — read-only mode unchanged
- TikTok adapter returns NOT_IMPLEMENTED for write ops

## [0.4.2] - 2026-06-19

### Added — Pagination Loop & Rate Limit Safety

- **Pagination loop**: `MetaClient.metaGet()` now supports `paginate: true` — auto-fetches all pages using Meta's cursor/after pagination
- **Rate limit safety**:
  - Parses `X-Ad-Account-Usage` header, tracks usage percentage
  - Auto-delays between pages when usage >80%
  - HTTP 429 retry with exponential backoff (max 3 retries)
- **New options**: `paginate`, `maxPages`, `pageDelay` on `getCampaignInsights`, `getAdsetInsights`, `getAdsInsights`
- **New types**: `MetaPaging`, `MetaPaginatedResponse<T>`, `PaginationOptions`, `RateLimitInfo`, `MetaGetOptions`
- **CI pipeline**: GitHub Actions workflow — `tsc --noEmit` + `npm test` + gitleaks secret scan on every PR
- **ESLint**: Migrated to flat config (`eslint.config.js`) for ESLint v9 compatibility
- **Tests**: 16 new unit tests covering pagination loop, max pages, empty pages, 429 retry, rate limit header parsing, backward compatibility

### Backward Compatible

- `paginate: false` is default — all existing code works unchanged
- No breaking API changes

## [0.4.1] - 2026-06-14

### Added - Location Breakdown Insights

- **New types**: `LocationBreakdown` (`country`, `region`, `dma`), `InsightBreakdownOptions`, `LocationInsightRow`, `LocationInsightSummary`
- **New tools**: `getLocationInsights()` — ranked/filtered location summary with totals
- **New MCP tools**:
  - `meta_get_insights_by_breakdown` — raw insight rows by country/region/dma
  - `meta_get_location_insights` — grouped summary with ranking, totals, and warnings
- **New utilities**: `summarizeLocationInsights()` — aggregation/ranking/filter engine, `assertLocationBreakdowns()` — safe validation
- **Broker passthrough**: `params.breakdowns` forwarded through `MetaAdsAdapter`
- **Normalizer**: maps `country`/`region`/`dma` to `dimensions` in `AdsMetricRecord`
- **Tests**: 8 new unit tests for location insights, ranking, filters, empty edge cases
- **Script**: `npm run test:local-meta-breakdown` for real Meta API testing with sanitized output

### Changed

- Existing `getCampaignInsights`, `getAdsetInsights`, `getAdsInsights` now accept optional `breakdowns` param
- Existing MCP tools (`meta_get_campaign_insights`, etc.) now accept optional `breakdowns`

### Rules

- AGENTS.md add: merge verification checklist — confirm `git diff HEAD --stat` empty before merge

## [0.3.0] - 2026-05-29

### Added - AI Skills Layer

**Major architectural addition:** Skills-based interface for AI agents alongside existing TypeScript library.

#### New Skills
- `/meta-ads-audit` — Comprehensive account audit with business context setup
- `/meta-ads-manage` — Ongoing performance analysis and recommendations
- Shared preamble for MCP detection and config resolution
- Meta math formulas and benchmarks reference
- Analysis heuristics and decision trees
- Creative fatigue diagnosis guide

#### Skills Features
- Natural language interface for end users
- Business context persistence (AOV, profit margin, brand voice)
- Persona discovery from campaign data
- Account baseline for anomaly detection
- Profitability analysis (Headroom $, Break-Even ROAS)
- Industry benchmarks (CTR, CPM, ROAS by vertical)
- Creative fatigue detection (frequency + CPM + CTR analysis)
- Dollar-denominated recommendations

#### Documentation
- `skills/README.md` — Skills overview and usage guide
- `SKILL_MIGRATION.md` — Migration guide and architecture explanation
- Updated main `README.md` to explain both library and skills
- `.mcp.json` configuration for MCP server

### Changed
- README now explains two ways to use the project (library vs skills)
- Cleaned up development artifact files (`*_COMPLETE.md`, `*_SUMMARY.md`)

### Philosophy
- Skills are **instructions** for AI agents, not hard-coded logic
- AI interprets markdown heuristics and adapts to context
- Library remains unchanged — skills are an additional interface
- Serves both developers (library) and end users (skills)

## [0.2.0] - 2026-05-28

### Added - Advanced Rule Engine

#### Rule Engine Core
- Flexible rule system with conditions and logic operators
- Support for AND/OR logic combinations
- 6 comparison operators: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Priority-based recommendation sorting
- Rule evaluation with detailed results

#### Pre-built Rule Templates (26 rules)
- **E-commerce Rules** (6 rules)
  - High ROAS campaigns
  - Low ROAS campaigns
  - High CPA detection
  - Low conversion rate
  - Cart abandonment optimization
  - Purchase funnel optimization

- **Lead Generation Rules** (6 rules)
  - Cost per lead optimization
  - Lead quality scoring
  - Form completion rate
  - Lead nurturing opportunities
  - High-intent lead identification
  - Lead volume scaling

- **Brand Awareness Rules** (6 rules)
  - Reach optimization
  - Frequency capping
  - CPM efficiency
  - Video view optimization
  - Engagement rate tracking
  - Brand lift opportunities

- **General Performance Rules** (8 rules)
  - Low CTR detection
  - High CPC alerts
  - Budget utilization
  - Ad fatigue detection
  - Audience saturation
  - Dayparting opportunities
  - Device performance
  - Placement optimization

#### Examples
- `examples/rule-engine-demo.ts` — Basic rule engine usage
- `examples/rule-templates-demo.ts` — Pre-built templates usage

### Changed
- Updated package.json to v0.2.0
- Enhanced documentation with rule engine examples

## [0.1.0] - 2026-05-27

### Added - Initial Release

#### Core Features
- **MetaClient** — Clean wrapper for Meta Marketing API
- **Configuration** — Environment-based config with Zod validation
- **Type Safety** — Full TypeScript types for all API responses

#### Tools (6 read-only functions)
- `getAdAccounts` — List all ad accounts
- `getCampaigns` — Get campaigns for an ad account
- `getCampaignInsights` — Campaign-level performance data
- `getAdsetInsights` — Ad set-level performance data
- `getAdsInsights` — Ad-level performance data
- `generateDailyReport` — Automated daily performance report

#### Analysis
- `analyzeCampaignPerformance` — Smart campaign analysis
- `recommendActions` — Actionable recommendations based on performance

#### Utilities
- `parseActionValue` — Parse Meta actions array
- `formatCurrency` — Format numbers as currency
- `MetaApiError` — Custom error class for API errors

#### MCP Server
- Basic MCP server implementation in `mcp-server/`
- Exposes all tools via Model Context Protocol
- Compatible with Claude Code and other MCP clients

#### Examples
- `examples/daily-report.ts` — Daily report generation
- `examples/campaign-audit.ts` — Campaign audit example

#### Tests
- Unit tests for core functionality
- Test coverage for analysis and utilities

#### Documentation
- Comprehensive README with setup instructions
- API documentation
- Authentication guide (Graph API Explorer + System User)
- AGENTS.md for AI agent guidelines

### Technical Details
- TypeScript 5.4+
- ESM modules only
- Zod for runtime validation
- Vitest for testing
- tsup for building

---

## Version History Summary

- **v0.3.0** (2026-05-29) — AI Skills Layer
- **v0.2.0** (2026-05-28) — Advanced Rule Engine
- **v0.1.0** (2026-05-27) — Initial Release

---

## Upcoming

### v0.4.0 (Planned)
- Write operations (pause campaigns, update budgets)
- Approval workflow for mutations
- Audit log for all changes

### v0.5.0 (Planned)
- OAuth flow for skills (browser-based auth)
- Token management and refresh
- Multi-user support

### v0.6.0 (Planned)
- Multi-account support
- Account switching
- Cross-account reporting

---

## Migration Notes

### From v0.2.0 to v0.3.0

**No breaking changes.** The TypeScript library API remains unchanged.

**New features:**
- Skills layer added in `skills/` directory
- `.mcp.json` configuration for MCP server
- New documentation files

**Action required:**
- None if using library only
- Configure `.mcp.json` if using skills with AI agents

### From v0.1.0 to v0.2.0

**No breaking changes.** All v0.1.0 APIs remain unchanged.

**New features:**
- Rule engine in `src/rules/`
- 26 pre-built rule templates
- New examples for rule engine

**Action required:**
- None, rule engine is opt-in

---

## Links

- [GitHub Repository](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill)
- [npm Package](https://www.npmjs.com/package/meta-ads-agent-skill)
- [Issues](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/issues)
