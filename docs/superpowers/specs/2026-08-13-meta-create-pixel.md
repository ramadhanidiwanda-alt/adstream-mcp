# ads_create_pixel — Spec

**Date:** 2026-08-13
**Status:** Approved for planning

## Problem

`adstream-mcp` has `ads_list_pixels` (read) but no way to create a Meta Pixel. An advertiser setting up conversion tracking for the first time (or a new ad account) has to leave the MCP and create the pixel by hand in Events Manager before any tool here can reference a `pixelId` (e.g. `ads_create_custom_audience`'s `subtype: WEBSITE`, `ads_create_adset` conversion tracking).

## Research (official docs + live verification, 2026-08-13, against Meena CPAS act_593081075980481)

- `POST /act_{ad_account_id}/adspixels` — the only required field is `name`.
- **Live-verified at v25.0** with `execution_options: ["validate_only"]` (no real object created): the request passed all field validation and failed only on a genuine business rule — `(#6200) A pixel already exists for this account`, with `error_data.pixel_owner_business_id`/`pixel_owner_business_name` identifying the existing pixel's owner. This confirms `name` is still the correct, sufficient field in v25.0, and surfaces an important real-world behavior this tool's callers will hit: **an ad account can only have one pixel**; creating a second one on an account that already has one fails with code 6200, not a generic validation error.

## Scope

One new tool, following the exact 5-layer pattern (`src/tools/*.ts` → `MetaAdsAdapter.ts` → `AdsBroker.ts` → `broker/types.ts` → `broker/mcpTools.ts`), modeled directly on `createProductAudience.ts` (single required field, dry-run + confirmed gate, no subtype branching):

- **`ads_create_pixel`** — `POST /act_{ad_account_id}/adspixels`, `{ name }`. Dry-run by default; executes only with `dryRun=false && confirmed=true`, gated by `ADSTREAM_ENABLE_WRITES` via `ADDITIVE_WRITE_TOOLS`.
- `formatMetaWriteError`'s `getActionableFix` gets one new case for Meta error code `6200`, pointing the caller at the existing pixel instead of a generic retry — this is a real, live-confirmed failure mode, not speculative.

## Out of scope

- No delete/update tool for pixels — not requested, and Meta's pixel deletion semantics (only deletable if never fired, in some cases) are not verified in this pass; do not build it speculatively.
- No automatic re-use of an existing pixel when code 6200 is hit — the tool surfaces the clear error (including the owning business id/name Meta already returns) and lets the caller decide; `ads_list_pixels` already exists to look the existing one up.

## Acceptance criteria

- `ads_create_pixel(name, dryRun=false, confirmed=true)` on an ad account with no existing pixel creates a real Meta pixel and returns its `id`.
- On an ad account that already has a pixel (e.g. Meena CPAS's test account), the same call fails with a clear, actionable error identifying the existing pixel's owner, not a generic "Invalid parameter".
- Dry-run by default; requires `confirmed=true` to execute; gated behind `ADSTREAM_ENABLE_WRITES`.
