# Legacy and Migration Plan

This document inventories the current tool surface and maps it toward the smaller canonical MCP API. It is documentation only: do not remove or break existing public tools without explicit approval.

## Migration Principles

- Keep existing public tools working during the transition.
- Mark overlap clearly before removing anything.
- Add canonical tools as wrappers or adapters first.
- Move report/recommendation logic toward skills and AI prompts.
- Keep write operations separate and protected by the write safety contract.

## Current Broker MCP Tools

| Current tool | Classification | Target |
|---|---|---|
| `ads_list_accounts` | Keep | Canonical |
| `ads_list_campaigns` | Keep | Canonical |
| `ads_get_performance` | Keep | Canonical wrapper over level-specific broker methods |
| `ads_get_creatives` | Keep | Canonical wrapper over creative performance; can expand to richer creative assets later |
| `ads_get_change_history` | Keep | Canonical change-history envelope backed by Meta account activities; other providers return structured `NOT_IMPLEMENTED` |
| `ads_get_capabilities` | Keep | Canonical static discovery surface; provider-specific discovery can be expanded later |
| `ads_get_account_performance` | Migrate | Legacy alias for `ads_get_performance` with `level: "account"` |
| `ads_get_campaign_performance` | Migrate | Legacy alias for `ads_get_performance` with `level: "campaign"` |
| `ads_get_adset_or_adgroup_performance` | Migrate | Legacy alias for `ads_get_performance` with `level: "adset"` or `level: "adgroup"` |
| `ads_get_ad_performance` | Migrate | Legacy alias for `ads_get_performance` with `level: "ad"` |
| `ads_get_creative_performance` | Migrate | Legacy alias for `ads_get_performance` with `level: "creative"` or future `ads_get_creatives` |
| `ads_get_placement_performance` | Migrate | `ads_get_performance` with placement breakdowns |
| `ads_content_matrix` | Legacy / skill-owned | Skill workflow over `ads_get_performance` and `ads_get_creatives` |
| `ads_generate_report` | Legacy / skill-owned | Skill workflow over canonical performance tools |
| `ads_pause_campaign` | Keep separate | Optional write tool |
| `ads_resume_campaign` | Keep separate | Optional write tool |
| `ads_update_campaign_budget` | Keep separate | Optional write tool |
| `ads_rename_campaign` | Keep separate | Optional write tool |
| `ads_create_ecommerce_campaign_bundle` | Review / write-only capability | Keep opt-in; do not mix with read analytics |
| `commerce_get_performance` | Keep | Canonical commerce tool |

## Legacy Provider-Specific MCP Tools

The MCP server still exposes older provider-specific tools. Keep them compatible while canonical equivalents mature.

| Legacy tool | Classification | Target |
|---|---|---|
| `meta_get_ad_accounts` | Legacy alias | `ads_list_accounts` with `provider: "meta"` |
| `meta_get_campaigns` | Legacy alias | `ads_list_campaigns` with `provider: "meta"` |
| `meta_get_campaign_insights` | Legacy alias | `ads_get_performance` with `provider: "meta"`, `level: "campaign"` |
| `meta_get_adset_insights` | Legacy alias | `ads_get_performance` with `provider: "meta"`, `level: "adset"` |
| `meta_get_ads_insights` | Legacy alias | `ads_get_performance` with `provider: "meta"`, `level: "ad"` |
| `meta_get_insights_by_breakdown` | Legacy alias | `ads_get_performance` with `breakdowns` |
| `meta_get_location_insights` | Legacy alias | `ads_get_performance` with location breakdowns |
| `meta_generate_daily_report` | Legacy / skill-owned | Weekly/daily report skill over canonical tools |
| `meta_analyze_with_rules` | Internal / skill-owned | AI/skill analysis over canonical data |
| `tiktok_list_advertisers` | Legacy alias | `ads_list_accounts` with `provider: "tiktok"` |
| `tiktok_get_report` | Legacy alias | `ads_get_performance` with `provider: "tiktok"` |
| `tiktok_get_gmv_max_report` | Provider-specific legacy | `ads_get_performance` or `commerce_get_performance` depending on data semantics |
| `tiktok_get_location_insights` | Legacy alias | `ads_get_performance` with location breakdowns |

## Library Utilities and Analysis Modules

| Module / function | Classification | Target |
|---|---|---|
| `getAdAccounts`, `getCampaigns` | Keep as low-level library utilities | Back canonical account/campaign tools |
| `getAccountInsights`, `getCampaignInsights`, `getAdsetInsights`, `getAdsInsights` | Migrate | Back `ads_get_performance` by level |
| `getLocationInsights`, `getMetaPlacementPerformance`, `getTikTokLocationInsights` | Migrate | Breakdowns on `ads_get_performance` |
| `getTikTokReport`, `getGmvMaxReport` | Migrate / provider adapter | Normalize into ads or commerce performance envelopes |
| `generateDailyReport` | Legacy / skill-owned | Skill report workflow over canonical data |
| `analyzeCampaignPerformance`, `recommendActions`, `summarizeLocationInsights`, `analyzePlacementPerformance` | Internal utility or skill reference | Avoid exposing as primary MCP report/recommendation APIs |
| Rule engine templates | Internal / skill reference | Keep out of canonical MCP core contract |
| `pauseCampaign`, `resumeCampaign`, `updateCampaignBudget`, `renameCampaign` | Keep separate | Optional write tools with safety contract |
| `createEcommerceCampaignBundle` | Review | Optional write capability with explicit approval lifecycle |

## Compatibility Risks

- Existing users may rely on `meta_*` or `tiktok_*` tool names in saved prompts.
- Some current tools use input names such as `adAccountId`, `advertiserId`, `startDate`, and `endDate`.
- Report tools may return narrative shapes that differ from canonical data envelopes.
- Provider-specific metrics may not map one-to-one into normalized metric names.
- Write tools require stricter permission and confirmation behavior than read tools.

## Safe Migration Sequence

1. Document canonical contracts and legacy mapping.
2. Add `ads_get_capabilities` so clients can discover supported metrics/levels. Done as canonical metadata plus registered adapter capability discovery.
3. Add `ads_get_performance` as a non-breaking wrapper around existing broker methods. Done for `account`, `campaign`, `adset`, `adgroup`, `ad`, and `creative` levels with a standard response envelope.
4. Add `ads_get_creatives` as the canonical creative read path. Done as a creative-level wrapper; richer asset fetches can be added behind this tool later.
5. Keep old level-specific tools as aliases with deprecation notes. Done in MCP tool descriptions.
6. Move report examples into skills documentation. Started in `skills/README.md` and shared provider preambles.
7. Add `ads_get_change_history` as the canonical history path. Done with Meta account activities fetching and structured unsupported-provider fallback.
8. Add compatibility tests that prove legacy tools still call the same underlying data paths.
9. Propagate canonical pagination cursors through adapters. Done for Meta ads performance/change history, TikTok ads performance, TikTok GMV Max commerce, and explicit Google `null` cursor metadata.
10. Only remove legacy tools in a major version after user approval and release notes.
