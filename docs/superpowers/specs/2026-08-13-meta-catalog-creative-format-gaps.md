# Catalog Creative Format Gaps — Spec

**Date:** 2026-08-13
**Status:** Approved for planning

## Problem

`buildCatalog()` (`src/providers/meta/buildCreativeFormatPayload.ts`) builds the `template_data` payload for `creativeFormat: 'catalog'`, but does not expose four fields Meta's catalog ads support: showing multiple product images per card, preferring images by tag, category-based (rather than per-product) dynamic ads, and a carousel-slideshow format option.

## Research (live-verified 2026-08-13 at v25.0 against Meena CPAS act_593081075980481, using `execution_options: ["validate_only"]` — validates the full payload against Meta's schema and business rules without creating a real object)

Per the lesson from the audience-tools work (`subtype` on `customaudiences` was in Meta's docs but silently unsupported) — every field below was verified against a live `validate_only` POST, not assumed from documentation, which was largely unhelpful/outdated for these specific fields.

| Field | Result | Correct location |
|---|---|---|
| `show_multiple_images` | **Valid.** Must be paired with `multi_share_end_card: false`, or Meta rejects with a specific error ("If 'show_multiple_images' is set to true, then multi_share_end_card must be set to false") — this is a real business-rule check, not silent. | `object_story_spec.template_data` |
| `preferred_image_tags` | **Valid**, accepted alone with no pairing requirement. | `object_story_spec.template_data` |
| `format_option: "carousel_slideshows"` | **Valid** inside `template_data`. **Invalid** at `asset_feed_spec` top level — Meta rejected it there with `(#100) Unexpected key "format_option" on param asset_feed_spec`, ruling out that documented-elsewhere location. | `object_story_spec.template_data` |
| `categorization_criteria` | **Valid**, but **not** inside `template_data` (Meta: "Kolom categorization_criteria tidak didukung di kolom template_data pada object_story_spec"). Sending it at the top level of the `adcreatives` POST body (sibling to `object_story_spec`/`product_set_id`) passed all field validation and instead hit a genuine catalog-content business rule ("Materi Iklan Kategori Dinamis Tidak Punya Aset Kategori yang Memadai" — the test catalog doesn't have enough per-category assets), confirming this is the correct location. | **Top level** of the `adcreatives` create payload, not nested |

**Additional finding from combined end-to-end testing** (each field above was first verified in isolation; testing them together surfaced a real interaction none of the isolated tests could catch): `format_option` and `show_multiple_images` are **mutually exclusive**. Setting both on the same `template_data` is rejected live with `(#100)` subcode `1443051`, `error_user_title: "ObjectStorySpecRedundant"`, `error_user_msg: "Hanya salah satu dari format_option dan show_multiple_images yang harus ditentukan di kolom template_data object_story_spec."` `preferred_image_tags` was confirmed compatible with both `show_multiple_images` and `format_option` independently — only the `format_option` + `show_multiple_images` pair conflicts. `buildCatalog()` throws a clear validation error for this combination before ever calling Meta, rather than letting the caller hit Meta's less-obvious error message.

## Scope

Add four new optional fields to `MetaCatalogCreativeSpec` (`src/types.ts`):

```typescript
export interface MetaCatalogCreativeSpec extends MetaCreativeCopy {
  productSetId: string;
  templateUrl?: string;
  fallbackImageHash?: string;
  presentation?: 'single_image' | 'carousel' | 'video_carousel';
  hybridVideo?: { videoId: string; thumbnailUrl: string };
  /** Show multiple product images per card instead of one. Meta requires multi_share_end_card=false when true; buildCatalog sets that automatically. */
  showMultipleImages?: boolean;
  /** Prefer catalog images tagged with any of these tags when Meta selects which image to show. */
  preferredImageTags?: string[];
  /** Category-based dynamic ads instead of per-product. Requires the catalog to have enough items per category — Meta rejects this at create time otherwise, not silently. */
  categorizationCriteria?: string;
  /** Presentation variant for the rendered catalog template, e.g. 'carousel_slideshows'. */
  formatOption?: string;
}
```

`buildCatalog()` throws when `showMultipleImages` and `formatOption` are both set, before calling Meta.

Wire them through `buildCatalog()`:
- `showMultipleImages` → `templateData.show_multiple_images`; when `true`, also force `templateData.multi_share_end_card = false` (overriding whatever the `presentation` branch set), matching the live-confirmed pairing requirement.
- `preferredImageTags` → `templateData.preferred_image_tags` (array passthrough).
- `formatOption` → `templateData.format_option`.
- `categorizationCriteria` → returned at the **top level** of `buildCatalog()`'s return object (sibling to `product_set_id`), not inside `object_story_spec`/`template_data`.

Also update the `ads_create_adcreative` MCP tool description in `src/broker/mcpTools.ts` (the `catalog memakai ...` sentence) to mention the four new fields — the existing description already omits `presentation`/`hybridVideo` (a pre-existing gap, not introduced by this change), so this pass also closes that for the four new fields to avoid repeating the same undocumented-field problem.

## Out of scope

- Not fixing the pre-existing `presentation`/`hybridVideo` documentation gap in `mcpTools.ts` beyond what's needed for consistency with the new fields (separate concern, not requested).
- No change to `createCpasCatalogCampaignBundle.ts`'s own separate schema (it has its own `hybridVideo`/`templateUrl`/`fallbackImageHash` properties) — out of scope unless requested.
- No validation of `categorizationCriteria`'s value against a fixed enum — Meta's own error message is the validation (catalog must have enough category assets), and hardcoding an enum here risks the exact "docs say X, API wants Y" trap this spec's research was built to avoid.

## Acceptance criteria

- `buildCatalog()` with `showMultipleImages: true` produces `template_data.show_multiple_images: true` and `template_data.multi_share_end_card: false` together, matching the live-verified valid combination.
- `buildCatalog()` with `preferredImageTags` produces `template_data.preferred_image_tags` as an array.
- `buildCatalog()` with `formatOption` produces `template_data.format_option`.
- `buildCatalog()` with `categorizationCriteria` produces it at the top level of the returned payload, not inside `object_story_spec`.
- All four combined pass a live `validate_only` POST against Meena CPAS (field-level validation only — the categorization_criteria business-rule rejection on this specific catalog's category coverage is expected and out of scope to fix).
