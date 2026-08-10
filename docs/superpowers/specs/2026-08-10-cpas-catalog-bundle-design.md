# CPAS Catalog Bundle Design

## Goal

Add one safe Meta MCP workflow, `ads_create_cpas_catalog_bundle`, to create a Sales CPAS catalog campaign, catalog ad set, catalog creative, and ad from one consistent input. Every created object starts `PAUSED`.

## Why a bundle

The existing generic tools can create each object, but CPAS catalog launch requires the retailer-shared product set, catalog promoted object, creative family, and optional app destination to agree across several calls. Copying these values manually creates a real risk of a rejected or incorrectly configured ad. The existing omnichannel repair applies to manual poster/video creatives; this is a separate catalog-product workflow.

## Chosen architecture

Create a new Meta-only orchestration tool beside `createEcommerceCampaignBundle`; do not alter generic create-tool behavior. It composes the existing `createCampaign`, `createAdSet`, `createAdCreative`, and `createAd` functions.

1. Read and validate the retailer-shared product set.
2. Return a complete dry-run payload preview.
3. Only when `dryRun: false` and `confirmed: true`, create campaign, ad set, creative, and ad in that order.
4. Read back the ad set and ad/creative relation.

The new tool never activates delivery. Resume remains a separate approved operation.

## Input contract

The tool receives regular Meta account/credential fields plus:

- Names: `campaignName`, `adSetName`, `adName`.
- Identity: `pageId`, optional `instagramUserId` and `threadsProfileId`.
- Catalog: one required `productSetId`; optional `pixelId` and `customEventType` (default `PURCHASE`).
- Delivery: `dailyBudget`, `countries`, optional age, placement, bidding, and schedule.
- Catalog creative: `primaryText`, `headline`, optional `description`, `destinationUrl`, `templateUrl`, `fallbackImageHash`, CTA (default `SHOP_NOW`).
- Format: `catalog` by default, or `collection` only with `instantExperienceId` and exactly one cover asset.
- Optional retailer app destination: application identity, Android/iOS identity, and store URLs.
- Safety: `dryRun` defaults to true; execution requires `confirmed: true`.

The public API accepts only one product-set ID. The orchestrator derives every internal product-set field from it and never accepts separate values for ad set and creative.

## Object mapping

| Object | Fixed values | Derived values |
|---|---|---|
| Campaign | `OUTCOME_SALES`, `collaborative_ads`, `PAUSED` | name, budget, bid, special categories |
| Ad set | `collaborative_ads`, `CATALOG`, `PAUSED` | campaign ID, targeting, schedule, catalog promoted object |
| Creative | `collaborative_ads`, `OUTCOME_SALES`, `CATALOG` | page, catalog/collection format, copy, CTA, same product set |
| Ad | `PAUSED` | ad set ID, creative ID, name |

The tool does not accept manual single-image, video, or manual-carousel creative settings. Dynamic catalog creative and manual creative must remain in separate ad sets.

## Validation and errors

Before any POST:

- Require nonblank names, Page, product set, budget, countries, and copy.
- Read `/{productSetId}?fields=id,name,product_catalog,product_count`; reject unreadable or empty sets.
- Permit only `catalog` and `collection`.
- Require an Instant Experience and exactly one cover asset for collection.
- Reject an app/catalog combination that existing Meta payload builders cannot represent without dropping app/deep-link fields.

Execution failures return the failed stage, sanitized provider error, and every ID created before the failure. The tool never deletes or archives automatically; partial objects stay paused for human review.

## Verification

The response includes preview payloads, product-set evidence, IDs, sanitized provider responses, and a verification block. It must confirm the product set in the ad set, the ad-to-creative relationship, and paused statuses. A failed read-back returns the IDs and `stage: verification`; it does not make another mutation.

## Compatibility and rollout

- Meta-only; other providers get the existing unsupported-operation response.
- Existing primitive tools and `ads_create_ecommerce_campaign_bundle` stay backward compatible.
- First release supports `catalog` and `collection`, not manual carousel presented as dynamic catalog.
- Roll out under the new explicit tool name. If Meta behavior diverges, disable only this registry entry or return a structured unavailable result; do not weaken generic CPAS preflight.

## Test strategy

Mock Meta clients only. Cover dry run, confirmation, product-set lookup failure, empty set, product-set propagation, catalog payload, collection rules, app incompatibility, sequential creation, failure at every stage, sanitized errors, read-back mismatch, adapter parsing, broker routing, MCP schema, exports, full test suite, lint, and build.

## Official Meta constraints

Meta positions Sales catalog advertising as a catalog/inventory-led workflow: [Sales objective](https://www.facebook.com/business/ads/ad-objectives/sales). Its hierarchy assigns objective to campaign, audience/budget/placement to ad set, and format/media to ad: [campaign structure](https://www.facebook.com/help/messenger-app/621956575422138). Manual carousel is a separate card format, not proof of a dynamic catalog workflow: [Carousel ads](https://www.facebook.com/business/ads/carousel-ad-format). The Graph creative field names used by existing code are listed in Meta's official SDK: [AdCreative](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreative.py), [omnichannel link spec](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativeomnichannellinkspec.py), and [link CTA value](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativelinkdatacalltoactionvalue.py).
