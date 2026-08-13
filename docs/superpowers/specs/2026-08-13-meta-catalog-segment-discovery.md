# Meta Catalog Segment Discovery (brand-side) — Spec

**Date:** 2026-08-13
**Status:** Approved for planning

## Problem

`ads_list_catalogs` (`src/tools/listCatalogs.ts`) calls `GET /{business_id}/owned_product_catalogs` — catalogs the business **owns**. For a CPAS **brand** (the party being advertised to by a retailer's shared catalog segment, not the retailer itself), this edge is frequently empty, because the brand does not own any catalog — it only has been granted access to catalog *segments* the retailer created and shared with it via Collaborative Ads' Collaboration Center.

Today `adstream-mcp` has no way to discover the `catalog_segment_id` / `product_set_id` a brand actually needs to build a CPAS campaign (`ads_create_cpas_catalog_bundle`, `ads_create_adcreative` catalog format) — the advertiser has to go find it manually in Meta Business Suite.

## Research (verified live 2026-08-13 against Meena CPAS business 157232184690085 / PT. Palm Burnet Rumania)

- Official Graph API reference confirms a second, separate business edge: `GET /{business-id}/client_product_catalogs` — "Retrieves product catalogs that a business has access to through client ownership." Returns `ProductCatalog` nodes plus a `permitted_roles` field per catalog. Read-only (no create/update/delete). No query parameters beyond standard paging. https://developers.facebook.com/docs/marketing-api/reference/business/client_product_catalogs/
- Live verification against business `157232184690085`:
  - `GET /157232184690085/owned_product_catalogs` → `{"data":[]}` (empty — confirms the reported gap).
  - `GET /157232184690085/client_product_catalogs` → returned **8 real catalog segments** shared by retailers (e.g. `"CPAS - ID - Meena.id(CuanManagement) - Direct"`, id `393683993005921`, `product_count: 11`, `permitted_roles: ["ADVERTISE"]`), confirming this is the correct endpoint for brand-side catalog segment discovery.
- Both edges return the exact same `ProductCatalog` node shape (`id`, `name`, `product_count`, `vertical`) that `listCatalogs.ts` already maps, plus `client_product_catalogs` additionally exposes `permitted_roles`.

## Scope

Extend `ads_list_catalogs` (not a new tool — same data shape, same business-scoped discovery use case). No new input parameter — mirror the exact precedent this codebase already established for `listWhatsAppAccounts` (`src/tools/listWhatsAppAccounts.ts`), which always queries both `owned_whatsapp_business_accounts` and `client_whatsapp_business_accounts` for a business and merges the results, tagging each with `owner_type: 'owned' | 'client'`.

`listCatalogs.ts` will do the same: always call both `GET /{business_id}/owned_product_catalogs` and `GET /{business_id}/client_product_catalogs`, merge the two lists, and tag each result with `source: 'owned' | 'client'`. Client-sourced results additionally carry `permitted_roles: string[]` when Meta returns it.

This requires zero new input schema surface (no `source` param to document/validate) and fixes the reported gap unconditionally: a brand calling `ads_list_catalogs(businessId)` today gets an empty array when it owns no catalog; after this change it gets its shared catalog segments too, with no behavior change required from the caller.

`MetaCatalogResult` gains two new fields: `source: 'owned' | 'client'` (always present) and `permitted_roles?: string[]` (present only on client-sourced rows, when Meta returns it).

## Out of scope

- No new MCP tool name — this is a parameter addition to the existing `ads_list_catalogs`, per the "tambahan ke ads_list_catalogs" option in the task brief.
- No change to `ads_create_cpas_catalog_bundle` or any other tool that consumes a `product_set_id`/`catalog_segment_id` — this spec only adds discovery, not campaign creation changes.
- No write/accept-sharing-invitation capability (Meta's Collaboration Center accept flow is UI-only per the docs read during research — the docs describe accepting a shared asset via "Go to the Collaboration Center", not a Graph API write). If that turns out to be wrong, it's a separate spec.

## Acceptance criteria

- `ads_list_catalogs(businessId)` against Meena CPAS's business returns the 8 real client-shared catalog segments that `owned_product_catalogs` alone misses (verified live in this session).
- Existing callers that only ever saw `owned_product_catalogs` rows still see them, now additionally tagged `source: 'owned'` — no regression, `toMatchObject`-style assertions on existing fields still pass.
- Each returned row has `source: 'owned' | 'client'`; client-sourced rows carry `permitted_roles` when Meta returns it.
