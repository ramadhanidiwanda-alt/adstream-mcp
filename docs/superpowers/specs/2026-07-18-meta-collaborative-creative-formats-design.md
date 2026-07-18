# Meta Collaborative and Standard Creative Formats Design

## Capability

Extend the existing Meta write flow so a marketer can create campaigns, ad sets, creatives, and ads for both standard Meta Ads and advertiser-side Collaborative Ads. The marketer chooses a mode and an ad format; the system builds the provider payload, validates the combination, previews it, and creates the objects in `PAUSED` status after explicit confirmation.

The feature extends the four existing public tools:

- `ads_create_campaign`
- `ads_create_adset`
- `ads_create_adcreative`
- `ads_create_ad`

It does not add one MCP tool per format and does not create a separate CPAS provider.

## User Experience

The workflow follows the hierarchy familiar from Meta Ads Manager:

1. Create a campaign and choose its objective.
2. Create an ad set and choose budget, audience, placements, optimization, and conversion settings.
3. For Collaborative Ads, select the shared Shopee catalog segment or product set.
4. Add multiple ads to the same ad set. Each ad can use a different supported format.
5. Review a dry-run preview and compatibility checks.
6. Confirm creation.
7. Receive the campaign, ad set, creative, and ad IDs, plus a clear summary of anything that failed.

The public interface uses marketer-facing names. Meta-native fields remain inside the Meta adapter unless an advanced legacy input is already supported.

## Scope

### Modes

- `standard`: regular Meta advertising.
- `collaborative_ads`: advertiser-side Collaborative Ads using a catalog segment or product set already shared by a retailer such as Shopee.

The legacy read alias `cpas` remains compatible, but new write inputs use `collaborative_ads` as the canonical name.

### Creative formats

| Format | Marketer provides | Meta payload family |
|---|---|---|
| `single_image` | Image, primary text, headline, destination, CTA | `object_story_spec.link_data` |
| `video` | Video, optional thumbnail, copy, destination, CTA | `object_story_spec.video_data` |
| `carousel` | Two or more cards with image/video, title, and destination | `object_story_spec.link_data.child_attachments` |
| `catalog` | Product set, template copy, CTA, destination | `object_story_spec.template_data` plus top-level `product_set_id` |
| `collection` | Cover image/video, existing Instant Experience ID, optional product set | Collection attachment linked to an existing Canvas/Instant Experience |
| `flexible` | Multiple media and copy variants | `asset_feed_spec` with the required ad-set compatibility |
| `existing_post` | Facebook or Instagram post ID | `object_story_id` |

One ad set may contain several ads with different formats when Meta permits the combination. Collection support in this scope attaches an existing Instant Experience/Canvas ID; building the Instant Experience content itself is a non-goal.

## Non-goals

- Do not manage retailer onboarding, collaboration requests, catalog sharing, or catalog-segment creation.
- Do not create or edit Instant Experience/Canvas content.
- Do not create a provider named `cpas` or `shopee`.
- Do not add a public tool for each creative format.
- Do not activate ads automatically.
- Do not hide or replace the original Meta error code, subcode, title, message, or trace ID.
- Do not claim that a format is impossible through the API solely because one payload combination fails.

## Public Contract

The existing create tools gain two marketer-facing discriminators where relevant:

```typescript
type MetaAdsMode = 'standard' | 'collaborative_ads';

type MetaCreativeFormat =
  | 'single_image'
  | 'video'
  | 'carousel'
  | 'catalog'
  | 'collection'
  | 'flexible'
  | 'existing_post';
```

`ads_create_campaign` accepts `mode` so the response and later steps retain campaign intent. `ads_create_adset` accepts `mode` and a simple catalog context for Collaborative Ads. `ads_create_adcreative` accepts `mode`, `creativeFormat`, and a format-specific `creativeSpec`. `ads_create_ad` continues to connect an ad set and creative; it does not duplicate format fields.

The format-specific input is a discriminated object. A caller supplies only the fields relevant to the selected format. Existing simple and advanced creative inputs remain supported for backward compatibility, but new documentation and agent guidance prefer `creativeFormat` plus `creativeSpec`.

## Provider Mapping

### Standard ads

The Meta adapter maps each format to the correct `object_story_spec` family. Flexible creative remains distinct from catalog creative. The presence of `asset_feed_spec` alone must not be treated as proof that a catalog ad or Collaborative Ad is configured correctly.

### Collaborative Ads

The advertiser must already have access to a retailer-shared catalog segment or product set. Before creation, the adapter verifies that the referenced catalog is readable and represents an eligible catalog segment when Meta returns that information.

For a catalog-based ad:

- the ad set receives `promoted_object.product_set_id` and the required conversion event context;
- the creative receives top-level `product_set_id`;
- the creative uses `object_story_spec.template_data`, not the generic DCO builder;
- the adapter builds any required omnichannel destination structure from the marketer-facing destination input;
- the final ad connects the validated ad set and creative IDs.

Known-invalid combinations are rejected locally. Account-, catalog-, or rollout-specific restrictions that cannot be proven locally are sent only after dry-run confirmation and returned as structured Meta errors.

## Internal Boundaries

Provider-specific construction is separated from orchestration:

- A creative compatibility module decides whether a requested mode and format can proceed and lists required inputs.
- A creative payload builder converts the canonical format input into Meta fields.
- The existing Meta adapter resolves credentials, maps public inputs, and calls the builder.
- The existing create tools perform dry-run, confirmation, deduplication, API execution, and structured result handling.
- The broker continues to expose only the four canonical create tools.

This separation prevents `createAdCreative.ts` and `MetaAdsAdapter.ts` from becoming a single large set of format-specific conditionals.

## Validation and Safety

Validation runs before any provider write and covers:

- objective and campaign compatibility;
- budget, audience, placement, optimization, and conversion settings;
- access to the Collaborative Ads catalog segment or product set;
- presence of every required asset and copy field for the selected format;
- at least two valid cards for carousel;
- completed image or video upload references;
- an existing Instant Experience ID for collection;
- product set placement at both the ad-set and creative levels for catalog formats;
- known conflicts between catalog, flexible/DCO, and optional creative features;
- matching mode and catalog context between ad set and creative.

All writes retain the existing safety contract:

- dry-run by default;
- explicit confirmation required for execution;
- created campaigns, ad sets, and ads default to `PAUSED`;
- no automatic fallback to a materially different format;
- no access token, signed URL, or secret in logs or error output.

## Errors and Partial Results

Errors have two layers:

1. A plain-language explanation for a marketer, such as “The Shopee product set has not been attached to the ad set.”
2. The original structured Meta details: provider code, subcode, user title, user message, and trace ID when available.

Multi-step workflows report each completed and failed object separately. If campaign, ad set, or creative creation succeeds but a later ad fails, the successful IDs are returned. The system does not describe a dry run as a completed creation and does not describe a creative as created unless Meta returned its ID.

## Verification

After a successful create call, the workflow reads the created object back from Meta when practical. Creative verification uses the existing full-creative read capability to confirm the effective format, product set, object story, asset feed, and destination fields returned by Meta.

Read-back verification is reported separately from creation. A temporary read failure does not erase a successful creation result, but it produces a clear verification warning.

## Testing

Unit tests cover every format builder in both applicable modes without calling the live Meta API. Tests assert the exact preview payload and prove that invalid input fails before execution.

Compatibility tests cover:

- standard single image, video, carousel, collection, flexible, catalog, and existing-post inputs;
- advertiser-side Collaborative Ads catalog payloads;
- multiple formats attached to one ad set;
- catalog product set consistency between ad set and creative;
- missing catalog access, media, carousel cards, or Instant Experience ID;
- known DCO/catalog conflicts;
- dry-run and explicit confirmation behavior;
- partial success reporting and preservation of Meta error details;
- absence of credentials in results and logs;
- backward compatibility for existing creative inputs and public tool names.

Adapter tests mock Meta responses. An optional live smoke test may use a real test ad account only with explicit user approval, must create `PAUSED` objects, and must never log credentials.

## Delivery Order

1. Add canonical mode, format, and format-specific input types plus the compatibility rules.
2. Add standard single-image, video, carousel, and existing-post builders.
3. Add advertiser-side Collaborative Ads catalog handling at ad-set and creative levels.
4. Add collection with an existing Instant Experience and flexible creative.
5. Add read-back verification, plain-language errors, and end-to-end mocked workflows.
6. Run format, build, lint, and the complete test suite before considering the branch ready.

Each delivery step is independently tested and committed. No step is pushed or merged without explicit user permission.

## Success Criteria

- A marketer can use the existing four create tools without writing a Meta-native payload.
- One ad set can contain multiple supported creative formats.
- Standard and advertiser-side Collaborative Ads use the same public workflow with different validated provider mappings.
- Collaborative Ads catalog creation places the product set correctly at both ad-set and creative levels.
- Collection uses an existing Instant Experience ID.
- Every executed object starts in `PAUSED` status unless an existing safety rule is stricter.
- Successful responses include the relevant Meta IDs, and partial failures preserve IDs already created.
- Errors are understandable to a marketer while retaining the original Meta diagnostic details.
- Created creatives can be read back and verified against the intended format.
- Existing public tool names and supported legacy inputs remain backward compatible.
