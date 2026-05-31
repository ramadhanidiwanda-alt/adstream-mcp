# Mini PRD — Ads MCP Broker untuk Cuan Insight

## 1. Product Summary

This project is an open-source Ads MCP Broker for Meta Ads and TikTok Ads. It provides MCP tools that let AI clients safely query ad account and performance data, normalize provider-specific metrics, and return analysis-ready results.

The broker is designed to run in two modes:

- Remote Cuan Insight Mode for Cuan Insight users connecting AI clients to a hosted remote MCP URL.
- Local/Self-Hosted Mode for developers running the MCP server themselves with credentials from environment variables.

Cuan Insight is the primary SaaS product. This repository is the MCP and ads data broker layer, not the SaaS application itself.

## 2. Problem

AI agents need safe, structured access to Meta Ads and TikTok Ads data without requiring users to manually paste provider tokens into each AI client.

Without a broker:

- Credentials are hard to manage safely across AI clients.
- Meta Ads and TikTok Ads return different shapes and metric names.
- Account access rules are difficult to enforce consistently.
- Cross-provider reporting requires repeated provider-specific logic.
- Future write operations would be risky without a central safety layer.

This broker solves the problem by separating credential resolution, provider adapters, normalized metrics, MCP tools, and safety policy.

## 3. Target User

- Cuan Insight users: marketers, founders, and operators who connect Claude, ChatGPT, or another MCP-compatible AI client to a remote Cuan Insight MCP URL.
- Developer self-hosted users: developers who run the broker locally or in Docker and provide Meta/TikTok credentials through environment variables.
- Agency and freelancer ads operators: ads specialists who need fast account audits, campaign reports, and normalized Meta/TikTok analysis through AI workflows.

## 4. Scope

### IN SCOPE

- Meta Ads.
- TikTok Ads.
- Read-only analytics.
- MCP tools for ads reporting.
- Normalized metrics across providers.
- Provider adapter pattern.
- Credential resolver abstraction.
- Token redaction.
- Rule engine integration.
- Campaign, ad set/ad group, ad, and creative performance reporting.
- Remote credential resolution through Cuan Insight API.
- Local credential resolution from environment variables.

### OUT OF SCOPE

- Google Ads.
- Snap Ads.
- Reddit Ads.
- Shopee Ads.
- Supabase as a provider.
- n8n as a provider.
- Google Sheets as a provider.
- CRM systems.
- Finance/accounting systems.
- OAuth implementation inside this MCP repository.
- Billing implementation inside this MCP repository.
- UI dashboard implementation inside this MCP repository.
- Write operations in the initial phase.
- Non-ads providers.

## 5. Product Modes

### Remote Cuan Insight Mode

Remote mode is used by Cuan Insight users. Users connect their AI client to a remote MCP URL operated by Cuan Insight.

In this mode:

- The MCP request must be authenticated.
- The MCP server validates the caller through Cuan Insight.
- Cuan Insight remains responsible for user login, workspace membership, plan limits, OAuth, token storage, and ad account mapping.
- The MCP broker requests scoped provider credentials from Cuan Insight.
- The MCP broker calls official provider APIs directly.
- The MCP broker normalizes the provider response.
- The MCP broker returns normalized, token-free data to the AI client.

The MCP broker must not implement Cuan Insight billing, UI, OAuth, or token storage.

### Local/Self-Hosted Mode

Local mode is used by open-source developers and self-hosted users.

In this mode:

- The developer runs the MCP server locally or through Docker.
- Provider credentials are read from environment variables.
- No Cuan Insight account is required.
- The same provider adapters and normalized output schema are used.
- The same read-only safety constraints apply.

Local mode must remain useful without Cuan Insight while keeping the same MCP tool contracts where possible.

## 6. Repo Responsibility Split

### Cuan Insight Repo

Cuan Insight is responsible for:

- User login.
- Workspace management.
- Plan and billing logic.
- Meta Ads OAuth.
- TikTok Ads OAuth.
- Provider token storage.
- User-to-ad-account mapping.
- Access limits and usage policy.
- Dashboard GUI.
- Report GUI.
- Remote MCP authentication/session/API key issuance.
- Source-of-truth permission checks for remote users.

### Ads MCP Broker Repo

This repository is responsible for:

- MCP server runtime.
- MCP tool definitions.
- AdsBroker orchestration.
- CredentialResolver abstraction.
- Cuan Insight credential provider client contract.
- Environment credential provider.
- Provider registry.
- Meta Ads adapter.
- TikTok Ads adapter.
- Normalized metrics schema.
- Response normalization.
- Rule engine integration.
- Permission policy enforcement.
- Token redaction.
- Read-only ads analytics.

This repository should not store user tokens in remote mode. It should request scoped credentials from Cuan Insight when needed.

## 7. Core User Flow

### Remote Flow

1. User signs up for Cuan Insight.
2. User connects Meta Ads and/or TikTok Ads through Cuan Insight.
3. Cuan Insight stores provider credentials and account mappings.
4. User connects Claude, ChatGPT, or another MCP-compatible client to the Cuan Insight remote MCP URL.
5. The AI client calls an ads MCP tool, such as `ads_get_campaign_performance`.
6. The MCP server validates the request with Cuan Insight.
7. The MCP broker resolves allowed provider credentials through Cuan Insight.
8. The provider adapter calls the official provider API.
9. The broker normalizes the response.
10. The broker returns normalized, token-free data to the AI client.

### Local Flow

1. Developer installs and runs the MCP server locally or through Docker.
2. Developer sets provider credentials through environment variables.
3. Developer connects an MCP-compatible AI client.
4. The AI client calls an ads MCP tool.
5. The credential resolver reads credentials from the environment.
6. The provider adapter calls the official provider API.
7. The broker normalizes the response.
8. The broker returns normalized, token-free data to the AI client.

## 8. Architecture Brief

Core components:

- MCP Server: exposes tools to MCP-compatible AI clients and handles transport concerns.
- AdsBroker: central orchestration layer for provider selection, credentials, adapter calls, normalization, and reporting.
- CredentialResolver: resolves credentials from the correct source based on runtime mode.
- CuanInsightCredentialProvider: remote-mode credential provider that requests scoped provider credentials from Cuan Insight.
- EnvCredentialProvider: local-mode credential provider that reads credentials from environment variables.
- ProviderRegistry: registers and resolves supported provider adapters. Only `meta` and `tiktok` are allowed.
- MetaAdsAdapter: wraps Meta Ads read-only operations and maps Meta responses into normalized metrics.
- TikTokAdsAdapter: wraps TikTok Ads read-only operations and maps TikTok responses into normalized metrics.
- Normalized Metrics Schema: shared output format for provider performance data.
- Rule Engine: applies ads analysis rules to normalized metrics.
- PermissionPolicy: enforces read-only behavior and blocks unsupported providers or write operations.
- Token Redaction: shared safety utility for logs, errors, and responses.

Target flow:

```text
AI Client
  -> MCP Server
  -> AdsBroker
  -> CredentialResolver
  -> ProviderRegistry
  -> ProviderAdapter
  -> Official Provider API
  -> Normalizer
  -> Rule Engine / Report Builder
  -> MCP Response
```

## 9. Security Requirements

- Provider tokens must never appear in MCP responses.
- Provider tokens must never be written to logs.
- Remote MCP requests must be authenticated.
- The broker must not trust a user ID, workspace ID, or account ID from the request without validation through Cuan Insight in remote mode.
- Provider access must be checked through Cuan Insight in remote mode.
- Local mode must only read credentials from environment variables.
- Write operations must be disabled by default.
- Non-ads providers must be rejected.
- Unsupported providers must be rejected.
- Error messages must not include full provider URLs containing sensitive query parameters.
- Remote mode must not silently fall back to global environment provider tokens.
- Credential scope should include provider, account, and caller context.
- Tests should assert that tokens do not appear in success responses or error responses.

## 10. MCP Tool Scope MVP

Public MCP tools remain MVP:

- `ads_list_accounts`
- `ads_get_campaign_performance`
- `ads_get_adset_or_adgroup_performance`
- `ads_get_ad_performance`
- `ads_get_creative_performance`
- `ads_generate_report`

The internal contract may prepare richer tool categories inspired by mature ads MCP surfaces such as Pipeboard:

- `accounts`
- `campaigns`
- `ad_groups`
- `ads`
- `creatives`
- `insights`
- `reports`
- `diagnostics`

All tools should support:

- `provider: "meta"`
- `provider: "tiktok"`
- Future `providers: ["meta", "tiktok"]` for cross-provider reporting

Tool naming recommendation:

- Use generic broker-level names with the `ads_` prefix.
- Keep provider-specific behavior inside adapters.
- Avoid exposing many provider-specific tools in the MVP.
- Preserve existing Meta tools only as compatibility surface until a migration path is defined.
- Do not implement all Pipeboard-level tools now.
- Do not use richer categories as justification to expand the MVP public tool surface.

## 11. Normalized Metrics Schema

Recommended rich normalized schema:

```ts
type AdsProviderId = 'meta' | 'tiktok';

type AdsEntityLevel = 'account' | 'campaign' | 'adset' | 'adgroup' | 'ad' | 'creative';

interface AdsIdentity {
  provider: AdsProviderId;
  account_id: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_or_adgroup_id?: string;
  adset_or_adgroup_name?: string;
  ad_id?: string;
  ad_name?: string;
  creative_id?: string;
  creative_name?: string;
}

interface AdsSetup {
  objective?: string;
  optimization_goal?: string;
  buying_type?: string;
  status?: string;
  currency?: string;
}

interface AdsTimeRange {
  date_start: string;
  date_stop: string;
  timezone?: string;
}

interface AdsDeliveryMetrics {
  spend?: number;
  impressions?: number;
  reach?: number;
  frequency?: number;
  cpm?: number;
}

interface AdsClickMetrics {
  clicks?: number;
  link_clicks?: number;
  outbound_clicks?: number;
  ctr?: number;
  link_ctr?: number;
  cpc?: number;
  cost_per_link_click?: number;
}

interface AdsConversionMetrics {
  conversions?: number;
  conversion_value?: number;
  cost_per_conversion?: number;
  conversion_rate?: number;
}

interface AdsCommerceMetrics {
  purchases?: number;
  purchase_value?: number;
  roas?: number;
  add_to_cart?: number;
  checkout_initiated?: number;
}

interface AdsLeadMetrics {
  leads?: number;
  cost_per_lead?: number;
}

interface AdsVideoMetrics {
  video_views?: number;
  video_plays_25?: number;
  video_plays_50?: number;
  video_plays_75?: number;
  video_plays_100?: number;
  thruplays?: number;
}

interface AdsEngagementMetrics {
  engagements?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
}

interface AdsCreativeMetadata {
  creative_type?: string;
  format?: string;
  title?: string;
  body?: string;
  call_to_action?: string;
  landing_url?: string;
}

interface AdsDiagnostics {
  delivery_status?: string;
  issues?: string[];
  warnings?: string[];
  recommendations?: string[];
}

interface AdsActionMetric {
  action_type: string;
  value: number;
  cost_per_action?: number;
  action_value?: number;
}

interface AdsCalculatedMetrics {
  cpa?: number;
  roas?: number;
  engagement_rate?: number;
  conversion_rate?: number;
}

interface AdsMetricRecord {
  level: AdsEntityLevel;
  identity: AdsIdentity;
  setup?: AdsSetup;
  time_range: AdsTimeRange;
  delivery?: AdsDeliveryMetrics;
  clicks?: AdsClickMetrics;
  conversions?: AdsConversionMetrics;
  commerce?: AdsCommerceMetrics;
  leads?: AdsLeadMetrics;
  video?: AdsVideoMetrics;
  engagement?: AdsEngagementMetrics;
  creative?: AdsCreativeMetadata;
  diagnostics?: AdsDiagnostics;
  actions?: AdsActionMetric[];
  calculated?: AdsCalculatedMetrics;
  raw?: unknown;
}
```

Mapping guidance:

- Common fields belong in the main schema.
- Provider-specific fields belong in `raw` or narrow metadata fields.
- Core numeric metrics must be `number`, not provider-native numeric strings.
- `raw` is optional and must not appear by default in public MCP responses.
- Schema may be rich from the start while implementation remains incremental.
- Meta and TikTok fields that are unavailable in early adapters may stay optional.
- Meta `adset_id` maps to `identity.adset_or_adgroup_id`.
- Meta `adset_name` maps to `identity.adset_or_adgroup_name`.
- TikTok `adgroup_id` maps to `identity.adset_or_adgroup_id`.
- TikTok `adgroup_name` maps to `identity.adset_or_adgroup_name`.
- ROAS should be normalized into `commerce.roas` or `calculated.roas` when available or computable.
- Conversion value should be normalized into `conversions.conversion_value` when available.

## 12. Implementation Plan

Current implementation status: Phases 1-5 have an implemented foundation in this repository.
This includes rich types and contracts, `CredentialResolver`, `ProviderRegistry`, `MetaAdsAdapter` wrapper, `AdsBroker`, MVP `ads_*` MCP tools, and `TikTokAdsAdapter` skeleton/mock.
TikTok support is currently skeleton/mock only: there is no real TikTok Business API call and no TikTok OAuth implementation in this MCP repository yet.

### Phase 0 — Audit

- Confirm current Meta tools, MCP tools, types, examples, and tests.
- Identify Meta-specific type names and MCP server coupling.
- Compare Pipeboard concepts at architecture level only.
- Do not copy Pipeboard code.

### Phase 1 — Types & Contracts

- Define `AdsProviderId`.
- Define `AdsToolCategory` with `accounts`, `campaigns`, `ad_groups`, `ads`, `creatives`, `insights`, `reports`, and `diagnostics`.
- Define `AdsEntityLevel`.
- Define rich normalized metrics types.
- Define `AdsMetricRecord`.
- Define `AdsProviderAdapter`.
- Define `AdsBrokerRequest` and `AdsBrokerResponse`.
- Define `CredentialContext`.
- Define `PermissionPolicy`.
- Add a sample Meta `AdsMetricRecord` fixture.
- Add a sample TikTok `AdsMetricRecord` fixture.
- Add tests for Meta and TikTok providers only.
- Add tests that write operations are denied by default.
- Add tests that sample normalized records are valid.

### Phase 2 — CredentialResolver

- Add `CredentialResolver` contract.
- Add `EnvCredentialProvider` for local mode.
- Add `CuanInsightCredentialProvider` interface/client boundary for remote mode.
- Add token redaction utilities.
- Add runtime mode selection.

### Phase 3 — ProviderRegistry + Meta Adapter

- Add provider registry with only `meta` and `tiktok`.
- Wrap existing Meta read-only tools in `MetaAdsAdapter`.
- Add Meta-to-normalized metrics mapping.
- Keep current Meta behavior stable.

### Phase 4 — MCP Tools via Broker

- Add broker-level tool registry.
- Route MVP `ads_*` tools through AdsBroker.
- Keep existing Meta tools until deprecation strategy is defined.
- Ensure remote credential access goes through CredentialResolver.

### Phase 5 — TikTok Adapter Skeleton/Mock

- Add `TikTokAdsAdapter` skeleton.
- Add mock response mapping for contract tests.
- Do not hardcode TikTok logic directly into the MCP server.
- Defer real TikTok Business API integration until contracts and tests are stable.
- Current status: implemented as skeleton/mock only; no real TikTok API calls are made.

### Phase 6 — Tests

- Add provider adapter contract tests.
- Add provider registry tests.
- Add credential resolver tests.
- Add token redaction tests.
- Add MCP tool contract tests.
- Add Meta adapter regression tests.
- Add TikTok adapter mock tests.
- Add tests that reject non-ads and unsupported providers.

### Phase 7 — Docs

- Document remote and local modes.
- Document local environment variables.
- Document the Cuan Insight credential resolver contract at a public-safe level.
- Document MCP tool contracts.
- Document read-only safety policy.
- Document deferred work and non-goals.

## 13. What Not To Do Yet

- Do not implement OAuth in this MCP repository.
- Do not implement billing.
- Do not implement UI or dashboard features.
- Do not implement write operations.
- Do not deploy remote production MCP before the auth contract is clear.
- Do not add providers outside Meta Ads and TikTok Ads.
- Do not implement all Pipeboard-level tools now.
- Do not treat the rich schema as a reason to implement many features at once.
- Do not expose `raw` by default in public MCP responses.
- Do not force provider-specific metrics into common fields when they only apply to one provider.
- Do not rename the package yet.
- Do not remove existing Meta tools yet.
- Do not copy Pipeboard code directly.
- Do not port the Pipeboard Python implementation.
- Do not build generic non-ads integrations.
- Do not hardcode TikTok directly into the MCP server.

## 14. Open Questions

- What public-safe endpoint contract should the MCP broker use to resolve credentials from Cuan Insight?
- What auth format should remote MCP clients use: API key, bearer token, JWT, or another opaque token?
- Should the broker receive workspace context explicitly, or should Cuan Insight infer it from the caller token?
- Should plan limits be enforced only by Cuan Insight or also mirrored in the MCP broker?
- Should ad account mapping be returned by Cuan Insight or fetched live from provider APIs?
- What should the remote MCP path be?
- What is the expected expiration and refresh behavior for credentials returned by Cuan Insight?
- How should the broker handle expired provider credentials?
- Should cross-provider reports allow partial success when one provider fails?
- What conversion event should be the default for ROAS and conversions across providers?
- What is the minimum useful creative performance schema for TikTok Ads?
- When should legacy Meta-only MCP tools be deprecated?
- Which transport should be prioritized first for remote mode?
- Known issue: `mcp-server` DTS build still needs dependency/workspace setup. Root `npm run test` and root `npm run build` pass, but this should be resolved before final packaging or release.

## 15. Recommendation

The first implementation step should be defining `AdsProviderAdapter`, `CredentialResolver`, and `AdsMetricRecord` before adding TikTok or remote-mode code.

This keeps the project from becoming two hardcoded provider integrations and creates the foundation for safe remote credential resolution, local self-hosted usage, normalized reporting, and future write-operation safety.
