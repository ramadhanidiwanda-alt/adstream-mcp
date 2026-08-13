# Meta Audience Tools — Spec

**Date:** 2026-08-13
**Status:** Approved for planning (scope narrowed to Audience only; see "Out of scope")

## Problem

`adstream-mcp` already has a mature, end-to-end path for Meta Collaborative Ads / CPAS: `ads_create_cpas_catalog_bundle` plus the granular `ads_create_campaign` / `ads_create_adset` / `ads_create_adcreative` / `ads_create_ad` tools create a full campaign → ad set → creative → ad chain, always `PAUSED`, always dry-run-first.

What is missing is **Audience**. `ads_create_adset`'s `targeting.customAudiences` / `targeting.excludedCustomAudiences` fields (`src/tools/createAdSet.ts:92-93`) already accept an array of `{ id }` — but there is no tool anywhere in the codebase that creates or discovers that `id`. Today an advertiser must open Meta Ads Manager, build the audience by hand, and paste its ID back into `adstream-mcp`. This blocks the retargeting half of the standard CPAS pattern ("prospecting" ad set with no audience + "retargeting" ad set targeting people who viewed/added-to-cart but didn't purchase).

## Research (official Meta docs, verified 2026-08-13)

- Collaborative Ads overview: https://developers.facebook.com/docs/marketing-api/collaborative-ads/ — CPAS campaign/ad set/creative/ad structure matches what `createCpasCatalogCampaignBundle.ts` already builds (`promoted_object.product_catalog_id` / `product_set_id`). No changes needed there.
- Custom Audience reference: https://developers.facebook.com/docs/marketing-api/reference/custom-audience/ — generic audiences created via `POST /act_{ad_account_id}/customaudiences` with `name`, `subtype` (`WEBSITE`, `CUSTOM`, `ENGAGEMENT`, `APP`, `OFFLINE_CONVERSION`, `LOOKALIKE`), plus subtype-specific optional fields (`rule`, `retention_days`, `customer_file_source`, `pixel_id`, `description`).
- Dynamic Product Audiences guide: https://developers.facebook.com/docs/marketing-api/audiences/guides/dynamic-product-audiences/ — catalog retargeting audiences are created via a **separate** endpoint, `POST /act_{ad_account_id}/product_audiences`, with `name`, `product_set_id`, `inclusions` (array of `{ retention_seconds, rule: { event: { eq: <EventName> } } }`), optional `exclusions` (same shape). Supported event names: `Search`, `ViewContent`, `AddToCart`, `Purchase`. This is the mechanism behind "people who viewed/carted but didn't buy."
- Confirmed via a second web search: "Once you create a product audience, you can retrieve it with the Custom Audiences API" — i.e. a product audience becomes a normal Custom Audience object once created (listable via `GET /act_{id}/customaudiences`, subtype shows it originated from `product_audiences`). This was **not independently verified with a live API call** in this session (Meta Developer Tools connector auth kept failing) — Task 2 below includes an explicit manual-verification note before this assumption is treated as load-bearing for production use.

## Scope (this plan)

Three new MCP tools, following the exact 5-layer pattern every existing write/list tool in this repo uses (`src/tools/*.ts` → `src/providers/meta/MetaAdsAdapter.ts` → `src/broker/AdsBroker.ts` → `src/broker/types.ts` → `src/broker/mcpTools.ts`):

1. **`ads_create_product_audience`** — `POST /act_{id}/product_audiences`. Dynamic catalog retargeting audience tied to a `product_set_id`, built from typed `inclusions`/`exclusions` (event + retention window). This is the audience type CPAS retargeting ad sets actually need.
2. **`ads_list_audiences`** — `GET /act_{id}/customaudiences`. Read-only discovery so an advertiser (or the model acting for them) can find an audience ID that already exists, including ones created by tool 1.
3. **`ads_create_custom_audience`** — `POST /act_{id}/customaudiences`, **`subtype: WEBSITE` only** for this pass. Website-visitor retargeting audience (pixel + rule + retention). `rule` is accepted as a raw JSON pass-through (`Record<string, unknown>`) — Meta's Website Custom Audience Rule grammar is deep and version-sensitive, and this codebase already has precedent for accepting raw JSON at that boundary (`AdSetTargeting.flexibleSpec`, `metaTargetingOverride` in `src/tools/createAdSet.ts:101,106`) rather than mistyping something Meta itself revises.

All three follow existing conventions: PAUSED-equivalent safety isn't applicable (audiences don't have a delivery status to pause), but create tools still gate behind `dryRun=false && confirmed=true` and behind `ADSTREAM_ENABLE_WRITES=true`, exactly like every other `ads_create_*` tool.

## Out of scope (explicitly deferred, do not build)

- `subtype: CUSTOM` (customer file / hashed PII upload), `ENGAGEMENT`, `APP`, `OFFLINE_CONVERSION`, `LOOKALIKE` — each has materially different required parameters (file upload + hashing, page/IG connection, app events, offline event set, seed audience + ratio/country) and deserves its own spec if/when needed.
- Any change to `src/tools/createAdSet.ts`'s `AdSetTargeting` type, `buildTargetingPayload`, or `MetaAdsAdapter.ts` targeting parsing. The existing `customAudiences: Array<{ id }>` field is assumed sufficient to target an audience created by tool 1 or 3, per the "retrievable via Custom Audiences API" finding above. **Do not widen targeting schema in this plan** — if live testing later shows `customAudiences` does NOT accept a product-audience ID, that is new information requiring a follow-up spec, not silent scope creep here.
- Any change to `ads_create_cpas_catalog_bundle` (no automatic prospecting+retargeting two-ad-set composition). Composing a retargeting ad set is a second, manual call to `ads_create_adset` reusing the same `campaignId`, once tool 1 exists.
- Hardcoded default retention windows. Meta's common examples (e.g. 14 days ViewContent, 7 days AddToCart, 30-day Purchase exclusion) belong in tool descriptions as guidance text, never as silent defaults.
- Catalog segment discovery (surfacing catalog segments a retailer shared with the brand, distinct from `ads_list_catalogs`'s own-catalog listing) — needs its own endpoint research.
- Pixel creation (`POST /act_{id}/adspixels`), catalog creative format gaps (`show_multiple_images`, `preferred_image_tags`, category-based ads, slideshow), and "automatic video from catalog" — all discussed with the user, all deferred to separate future specs.
- `src/mcp/createServer.ts` (the hosted OAuth/HTTP MCP server variant). Precedent: `ads_list_pixels`, `ads_list_catalogs`, and `ads_list_product_sets` are **not** registered there either — only in `src/broker/mcpTools.ts`. This plan follows that precedent and does not touch `createServer.ts`.

## Acceptance criteria

- `ads_create_product_audience(dryRun=false, confirmed=true)` creates a real Meta product audience and returns its `id`.
- `ads_list_audiences` returns existing audiences (including ones this tool created) with `id`, `name`, `subtype`, `approximate_count_lower_bound/upper_bound`, `delivery_status`.
- `ads_create_custom_audience(subtype='WEBSITE', dryRun=false, confirmed=true)` creates a real Meta website custom audience and returns its `id`.
- All three tools are dry-run-by-default, require `confirmed=true` to execute (create tools only), and respect `ADSTREAM_ENABLE_WRITES`.
- An ID returned by tool 1 or tool 3, pasted into `ads_create_adset`'s `targeting.customAudiences`, is accepted by Meta at ad-set-create time (manual verification step in Task 2 — not automatable in this session because the Meta Developer Tools connector's OAuth flow could not complete).
