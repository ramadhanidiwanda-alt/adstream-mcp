# Meta Creative Compliance Audit Design

## Capability

Extend the existing canonical `ads_get_creatives` read path so an AI client can assess whether each Meta ad creative complies with three setup requirements: AI creative features are disabled, related media is not configured, and placement-specific media exists for Feed, Reels, and Stories. The feature remains read-only and does not add a new public MCP tool.

## Scope

- Request the Meta creative fields required for compliance evaluation.
- Return normalized compliance metadata on each creative record.
- Preserve the existing creative metadata and pagination behavior.
- Support both account creative listing and a single `creativeId` lookup.
- Use `PASS`, `FAIL`, and `UNKNOWN`; missing provider data is never treated as safe.
- Mark visual crop safety as requiring placement previews because structured API fields cannot prove the final rendered composition.

## Non-goals

- Do not change or create ads, creatives, media, or placement settings.
- Do not add a public `ads_audit_*` MCP tool.
- Do not claim that Meta's rendered output is crop-safe without preview review.
- Do not make account-level recommendation data a source of truth for creative-level configuration.

## Architecture

### Meta field retrieval

`MetaAdsAdapter.getCreativePerformance` will request these additional fields from the Ad Creative node:

- `status`
- `degrees_of_freedom_spec`
- `media_sourcing_spec`
- `asset_feed_spec`
- `platform_customizations`
- `portrait_customizations`
- `image_crops`

The adapter will retain the full provider payload only when `includeRaw` is requested. Compliance evaluation will operate on a narrowly typed internal Meta creative shape and expose only normalized results by default.

### Evaluator boundary

Provider-specific evaluation will live in `src/providers/meta/creativeCompliance.ts`. The module will be pure: it accepts the relevant creative configuration and returns normalized compliance without network access. `MetaAdsAdapter` remains responsible only for fetching, normalizing existing creative metadata, and attaching the evaluator result.

### Public normalized contract

`AdsCreativeMetadata` will gain an optional `setup_compliance` field:

```typescript
type AdsComplianceStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

interface AdsCreativeSetupCompliance {
  ai_creative: {
    status: AdsComplianceStatus;
    enabled_features: string[];
    reasons: string[];
  };
  related_media: {
    status: AdsComplianceStatus;
    reasons: string[];
  };
  placement_customization: {
    status: AdsComplianceStatus;
    feed: AdsComplianceStatus;
    reels: AdsComplianceStatus;
    story: AdsComplianceStatus;
    reasons: string[];
    preview_required: boolean;
  };
}
```

The field is optional so existing providers and consumers remain backward compatible.

## Evaluation Rules

### AI creative

- `FAIL` when any returned creative feature has `enroll_status: "OPT_IN"`.
- `PASS` when `creative_features_spec` exists, contains at least one feature, and every returned feature is explicitly `OPT_OUT`.
- `UNKNOWN` when the degrees-of-freedom configuration, feature map, or explicit enrollment statuses are absent or unrecognized.
- `enabled_features` contains the names of every `OPT_IN` feature.

This evaluates the effective configuration Meta returns; it does not maintain a hard-coded list that would become stale as Meta adds features.

### Related media

- `FAIL` when `media_sourcing_spec.related_media` is present and non-empty.
- `PASS` when `media_sourcing_spec` is returned and `related_media` is absent or empty.
- `UNKNOWN` when `media_sourcing_spec` itself is not returned.

### Placement customization

- Inspect `asset_feed_spec.asset_customization_rules` and the referenced image/video labels.
- A placement passes only when at least one customization rule explicitly maps a labeled asset to that placement family.
- Feed includes Facebook Feed or Instagram Feed/Stream mappings.
- Reels includes Facebook Reels or Instagram Reels mappings.
- Story includes Facebook Stories or Instagram Stories mappings.
- The aggregate status is `PASS` only when all three families pass, `FAIL` when configuration is present but one or more families are missing, and `UNKNOWN` when the asset feed or rules are unavailable or unrecognized.
- `preview_required` is always `true`; existing `ads_get_ad_preview` remains the verification surface for rendered output.

## Error Handling and Compatibility

- Provider omissions produce `UNKNOWN`, not an exception.
- Unknown creative feature names are evaluated using their returned `enroll_status`.
- Unknown placement values are ignored and recorded in reasons when they prevent a conclusive result.
- Existing creative records remain valid because the new field is optional and additive.
- No access token, signed URL, or raw provider response is added to normalized compliance output.

## Testing

Unit tests for the pure evaluator will cover:

- all returned AI features explicitly opted out;
- one or multiple AI features opted in;
- missing and unrecognized AI enrollment data;
- empty, populated, and missing related-media specs;
- complete Feed/Reels/Story mappings;
- partial placement mappings;
- missing or malformed customization rules.

Adapter tests will prove that both list and single-creative requests include the new Meta fields, attach normalized compliance, preserve cursors, and do not leak credentials. The final verification commands are `npm test`, `npm run build`, `npm run lint`, and `npm run format -- --check` when the repository script supports check mode.

## Success Criteria

- `ads_get_creatives` returns deterministic normalized compliance for Meta creatives without a new public tool.
- Missing Meta data is reported as `UNKNOWN`.
- A creative with any explicit AI opt-in or non-empty related media is reported as `FAIL` in the corresponding section.
- Placement compliance cannot pass unless Feed, Reels, and Story each have an explicit labeled asset rule.
- Existing tests and public responses remain backward compatible.
