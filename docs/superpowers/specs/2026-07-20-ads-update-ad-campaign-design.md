# Design: `ads_update_ad` and `ads_update_campaign`

**Date:** 2026-07-20
**Status:** Approved for planning
**Branch:** `feature/ads-update-ad-campaign`

## Problem

The Meta write surface has no way to update an existing Ad or Campaign beyond
narrow single-purpose tools (`ads_pause_ad`, `ads_archive_ad`,
`ads_pause_campaign`, `ads_rename_campaign`, `ads_update_campaign_budget`,
etc). `ads_update_adset` already exists as a general patch tool for ad sets,
but no equivalent exists at the Ad or Campaign level.

The immediate motivating case: an already-ACTIVE ad's creative has no
`url_tags` (UTM) set, and `url_tags` can only be set at creative-creation
time. The correct fix is not to recreate the ad, but to create a new
creative with `url_tags` and point the existing ad's `creative_id` at it —
which requires an `ads_update_ad` tool that can patch `creative`.

## Scope

Two new tools, both following the existing `ads_update_adset` pattern
exactly: dry-run by default, explicit `confirmed=true` required to execute,
patch (merge) semantics for top-level fields.

### `ads_update_ad`

POST `/{ad_id}`. Fields:

| Field | Meta field | Notes |
|---|---|---|
| `name` | `name` | |
| `status` | `status` | `ACTIVE` \| `PAUSED` \| `ARCHIVED` |
| `creativeId` | `creative` (`{creative_id}`) | The UTM-swap use case. After execute, read back `GET /{ad_id}?fields=creative` and include the resulting creative id in the result so the caller can confirm the swap took. |
| `trackingSpecs` | `tracking_specs` | |
| `conversionDomain` | `conversion_domain` | |
| `adScheduleStartTime` / `adScheduleEndTime` | `ad_schedule_start_time` / `ad_schedule_end_time` | |

Meta-side constraints (e.g. archived ads only accepting `name`/`status=DELETED`)
are not pre-validated locally — they're allowed to surface as a Meta API
error via the existing `formatMetaWriteError`/`formatStructuredMetaWriteError`
path, consistent with how `updateAdSet` handles Meta-side constraints today.

`adset_id` and `social_prefs` are not exposed (Meta rejects changing them).

### `ads_update_campaign`

POST `/{campaign_id}`. Fields:

| Field | Meta field | Notes |
|---|---|---|
| `name` | `name` | |
| `status` | `status` | `ACTIVE` \| `PAUSED` \| `ARCHIVED` \| `DELETED` |
| `lifetimeBudget` | `lifetime_budget` | Reuses the budget safety guard from `updateCampaignBudget.ts` (see below) |
| `spendCap` | `spend_cap` | Same budget safety guard |
| `bidStrategy` | `bid_strategy` | |
| `specialAdCategories` | `special_ad_categories` | |
| `startTime` / `stopTime` | `start_time` / `stop_time` | |

`objective` is deliberately not exposed — Meta treats it as effectively
immutable once a campaign has ads, and changing it is not a supported
workflow here.

**Budget safety guard (reused, not duplicated):** the increase-limit check
in `updateCampaignBudget.ts` (fetch current budget, reject increases beyond
`maxBudgetIncrease`, default 30%, override threshold >100%) is extracted
into a shared helper and applied to `lifetimeBudget` and `spendCap` in
`updateCampaign.ts` the same way it already applies to `dailyBudget`.

**Delete guard:** `status: 'DELETED'` is irreversible via the API. Setting
it requires an additional `deleteConfirmed: true` flag in the same request,
mirroring the `replaceTargetingConfirmed` pattern already used by
`updateAdSet` for its own dangerous sub-operation (targeting replace).
Without it, the tool returns `status: 'failed'` with an actionable error
and does not call the Meta API.

## Result shape

Both tools return the same shape as `UpdateAdSetResult` (operation, status,
executed, preview, success, id, response, error, structuredError) — no new
result type family, just two new interfaces (`UpdateAdResult`,
`UpdateCampaignResult`) following the existing one.

## Wiring (mirrors `ads_update_adset` at every layer)

1. `src/tools/updateAd.ts`, `src/tools/updateCampaign.ts` — business logic,
   dry-run/confirm lifecycle, guards described above.
2. `src/broker/AdsBroker.ts` — add `'updateAd' | 'updateCampaign'` to
   `AdapterWriteMethod`; add `updateAd()`/`updateCampaign()` methods calling
   `this.executeWrite(...)`, same permission-checked path as `updateAdSet`.
3. `src/broker/mcpTools.ts` — two new tool definitions (name, description,
   input schema via new `createUpdateAdInputSchema()` /
   `createUpdateCampaignInputSchema()` builders modeled on
   `createUpdateAdSetInputSchema()`) plus two dispatcher `case` entries.
4. `src/mcp/createServer.ts` — two new Zod input-schema branches mirroring
   the existing `ads_update_adset` branch, so the stdio/local MCP surface
   gets typed schemas too.
5. `src/providers/meta` — wire `updateAd`/`updateCampaign` into the Meta
   provider adapter the same way `updateAdSet` is wired today.
6. `docs/WRITE_SAFETY_CONTRACT.md` — add both tools to the capability
   tables (Batch 2 for ad status/name fields, Batch 3 for the budget-guarded
   campaign fields), documenting the delete-guard and creative-swap
   read-back as part of the contract.

## Testing

`tests/updateAd.test.ts` and `tests/updateCampaign.test.ts`, mirroring
`tests/updateAdSet.test.ts`'s coverage (dry-run, pending_confirmation,
executed, failed) plus tool-specific cases:

- `updateAd`: creative-swap read-back confirms new creative id in the result.
- `updateCampaign`: budget-guard rejection (>30% increase without override),
  budget-guard pass with override, delete without `deleteConfirmed` fails
  without calling the API, delete with `deleteConfirmed` executes.

## Out of scope

- Editing an existing AdCreative object directly (Meta creatives are
  effectively immutable post-creation for most fields — not a supported
  Meta workflow).
- `adlabels`, `display_sequence`, `promoted_object`, `adset_budgets`,
  `adset_bid_amounts`, `iterative_split_test_configs`, and other niche
  Campaign/Ad fields surfaced in the Meta docs but not requested.
- Batch mutations / bulk update across multiple ads or campaigns.
