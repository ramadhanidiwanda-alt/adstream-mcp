# Meta Six-Objective Launch v25 Design

## Capability

Enable a digital marketer to create a complete Meta Ads hierarchy for each of
Meta's six ODAX objectives without composing provider-native payloads. Every
workflow resolves the correct objective setup, validates its dependencies,
previews the full campaign, creates campaign/ad set/creative/ad entities in
`PAUSED` state after explicit confirmation, and verifies the created entities.
Activation remains a separate approval-gated action.

The six supported create objectives are:

- `OUTCOME_AWARENESS`
- `OUTCOME_TRAFFIC`
- `OUTCOME_ENGAGEMENT`
- `OUTCOME_LEADS`
- `OUTCOME_APP_PROMOTION`
- `OUTCOME_SALES`

Meta Marketing API v25 is the primary contract. Credentials configured for
v23 or v24 remain usable only when the selected launch specification explicitly
supports that version. The system must not silently downgrade a v25 workflow.

## User Experience

The user describes the marketing goal and provides marketer-facing inputs such
as budget, destination, audience, asset, Page, Pixel, form, or app. The AI
workflow calls `ads_check_launch_readiness` to resolve the canonical setup and
ask only for missing business inputs.

The launch sequence is:

1. Resolve the credential and configured Meta API version.
2. Resolve an objective launch specification.
3. Discover or validate required dependencies.
4. Preview the complete campaign hierarchy.
5. Ask for explicit confirmation to create.
6. Create campaign, ad set, creative, and ad in `PAUSED` state.
7. Read the created entities back and report the effective configuration.
8. Stop and present the result for review.
9. Activate campaign, ad set, and ad from parent to child only after a second
   explicit approval.

The product must explain results in marketer-facing language while retaining
Meta error codes and technical diagnostics for support.

## Architecture

The existing public write surface remains:

- `ads_create_campaign`
- `ads_create_adset`
- `ads_create_adcreative`
- `ads_create_ad`

No objective-specific public MCP tools are added. Objective-specific behavior
lives in AI/skill workflows over these data and write tools, consistent with
the repository's MCP tool design rules.

A focused internal Meta objective-launch module becomes the source of truth for:

- ODAX objective;
- conversion location;
- optimization/performance goal;
- billing event;
- destination type;
- required promoted object;
- required business inputs and provider dependencies;
- compatible creative formats and default CTA;
- supported Meta API versions.

`ads_check_launch_readiness` consumes this module and returns the resolved
launch contract, missing inputs, warnings, verified dependency IDs, and the
recommended next action. Campaign, ad-set, creative, and bundle builders consume
the same source of truth so schema and execution cannot drift.

Advanced raw Meta fields remain available only where the current compatibility
surface already exposes them. They do not bypass objective compatibility
validation.

## Data Contract

The design introduces internal contracts equivalent to:

```ts
export type MetaOdaxObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_APP_PROMOTION'
  | 'OUTCOME_SALES';

export interface MetaObjectiveLaunchSpec {
  objective: MetaOdaxObjective;
  conversionLocation: string;
  optimizationGoal: string;
  billingEvent: string;
  destinationType?: string;
  requiredInputs: string[];
  supportedCreativeFormats: MetaCreativeFormat[];
  defaultCallToAction?: string;
  supportedApiVersions: string[];
}
```

The concrete implementation may use discriminated unions so the compiler can
enforce objective-specific promoted-object requirements. A pure resolver accepts
the objective, conversion location, optional requested optimization goal,
creative format, and API version. It returns a complete immutable launch
specification or a structured validation error.

Create contracts accept only the six ODAX objectives. Legacy objectives may
still be read from existing campaigns but cannot be used to create new
campaigns through the canonical surface.

There is no universal fallback optimization goal. If the caller omits the goal,
the resolver chooses the default for the selected objective and conversion
location. Unknown combinations fail during dry-run before any provider write.

## Validation and Errors

Local validation must reject known-invalid combinations before calling Meta.
Account-specific eligibility and rollout restrictions that cannot be proven
locally are sent to Meta only after dry-run confirmation.

Structured validation codes include:

- `UNSUPPORTED_OBJECTIVE`
- `INVALID_OBJECTIVE_GOAL_COMBINATION`
- `INVALID_OBJECTIVE_DESTINATION_COMBINATION`
- `MISSING_PROMOTED_OBJECT_FIELD`
- `MISSING_OBJECTIVE_DEPENDENCY`
- `UNSUPPORTED_CREATIVE_FORMAT`
- `UNSUPPORTED_API_VERSION`

Provider errors retain the original Meta code, subcode, user title, user
message, and trace ID when available. Credentials, access tokens, signed URLs,
and connection keys are always redacted.

Multi-step creation is not transactional. If an early entity succeeds and a
later entity fails, the response returns all successful IDs, the failed step,
and a safe next action. The workflow does not automatically archive or delete
partial entities. Every created entity remains `PAUSED`.

## Canonical Objective Workflows

### Awareness

Baseline paths:

- maximize reach;
- maximize impressions.

Inputs include Page, budget, audience, creative asset, copy, and special-ad
category decision. Pixel and destination URL are required only when the chosen
creative or CTA needs them. Baseline formats are single image and video.

### Traffic

Baseline path:

- website destination optimized for landing-page views;
- link-click optimization available as the documented fallback.

Inputs include Page, website URL, budget, audience, creative asset, copy, CTA,
and special-ad category decision.

### Engagement

Baseline paths:

- existing Facebook/Instagram post optimized for post engagement;
- video optimized for ThruPlay.

The workflow requires exactly the identity or video inputs used by the selected
path. It must not require a website URL for an existing post that does not use
an external CTA.

### Leads

Baseline paths:

- website leads using the correct Pixel/conversion event contract;
- Instant Form leads using a verified Page and form ID.

The two paths have distinct promoted-object and creative requirements. The
system must not model a website lead as an Instant Form lead or use
`LEAD_GENERATION` as a universal leads fallback.

### App Promotion

Baseline path:

- app installs.

Inputs include the Meta app identity, platform/store information, destination
or deep-link behavior where applicable, creative asset, budget, audience, and
measurement prerequisites. Missing app-event/SDK/MMP prerequisites are surfaced
as readiness warnings or blockers according to the selected optimization goal.

### Sales

Baseline path:

- website purchase using Pixel and `PURCHASE`.

The current ecommerce bundle is refactored to consume the shared launch
contract. Image and video launch paths must both work and produce the correct
typed creative payload. Existing catalog, collection, and Collaborative Ads
support is preserved.

## Collaborative Ads / CPAS v25 Regression

Collaborative Ads remains a mode inside the Meta adapter, not a new objective
or provider.

The Sales milestone includes a CPAS v25 regression lane that:

- resolves `OUTCOME_SALES` through the shared objective matrix;
- preserves shared catalog/product-set discovery;
- validates product-set access and eligibility;
- preserves catalog, collection, image, video, carousel, and supported
  omnichannel creative behavior;
- verifies promoted-object and creative compatibility;
- adds dry-run, read-back, and regression contract tests;
- prevents the six-objective changes from breaking existing CPAS callers.

Retailer catalog sharing and other Business Manager setup remain external
prerequisites. Building those relationships is a non-goal.

## Delivery Milestones

All work occurs on `codex/meta-six-objective-launch-v25`. Each milestone ends
with focused tests, a reviewable commit, and a working vertical result.

1. **Shared foundation**
   - v25 objective contracts and version resolution;
   - shared resolver and structured validation;
   - MCP/Zod/TypeScript schema parity.
2. **Awareness**
   - reach and impression workflows.
3. **Traffic**
   - website landing-page-view and link-click workflows.
4. **Engagement**
   - existing-post engagement and video/ThruPlay workflows.
5. **Leads**
   - website leads and Instant Form leads.
6. **App Promotion**
   - app-install workflow and app dependency validation.
7. **Sales**
   - website purchase image/video workflow;
   - ecommerce bundle repair and refactor.
8. **CPAS v25 regression**
   - compatibility validation and regression coverage.
9. **Shared launch audit**
   - hierarchy read-back, partial-success reporting, and PAUSED handoff;
   - activation remains a separately confirmed workflow.
10. **Hardening and documentation**
    - full verification;
    - roadmap and capability-status updates;
    - v23/v24 compatibility behavior documented.

## Testing Strategy

Tests are layered:

- pure unit tests for launch-spec resolution;
- table-driven tests for every supported and rejected combination;
- schema parity tests across public MCP JSON schema, Zod, adapter mapping, and
  exported TypeScript types;
- exact-payload tests for campaign, ad set, creative, and ad creation;
- workflow tests for dry-run, confirmation, success, missing dependencies,
  invalid combinations, read-back, and partial failures;
- security tests for token and signed-URL redaction;
- regression tests for existing standard and Collaborative Ads workflows.

Live contract tests are optional, require explicit user approval, use a test ad
account, create only `PAUSED` entities, and never print credentials. Unit tests
continue to mock external Meta calls.

Final verification requires:

```bash
npm run format
npm run lint
npm run build
npm test
git diff --check
git status --short
```

Formatting changes must remain scoped to files touched by this feature.

## Documentation and Roadmap

Implementation updates `docs/PLAN.md` with:

- the six-objective v25 baseline;
- the CPAS v25 regression milestone;
- the separately approved activation boundary;
- deferred objective variants.

Capability/status documentation is updated only where behavior actually ships.
No credentials, live account IDs, or sensitive provider payloads are recorded.

Deferred roadmap variants include:

- Messaging for Traffic, Engagement, Leads, and Sales;
- Calls for Traffic and Leads;
- broader Catalog, Collection, CPAS, and omnichannel Sales workflows;
- app events, value optimization, and re-engagement;
- Ad Recall Lift and additional Awareness goals;
- Quality Leads, CRM conversion leads, and related measurement paths;
- additional Advantage+ automation variants.

## Non-Goals

- Automatically activating newly created ads.
- Automatically deleting or archiving partial creations.
- Creating retailer catalog-sharing relationships.
- Guaranteeing account-specific Meta eligibility before Meta evaluates it.
- Adding objective-specific public MCP tools.
- Implementing every Meta conversion location in the first baseline.

## Acceptance Criteria

- New campaign creation accepts exactly the six ODAX objectives.
- Every baseline objective resolves to a valid objective-specific setup without
  a universal `REACH` fallback.
- Known-invalid objective/destination/goal combinations fail during dry-run.
- Each canonical workflow can create a complete PAUSED hierarchy after explicit
  confirmation and returns its IDs.
- Successful creations are read back and compared with the intended setup.
- Partial failures preserve and report completed IDs without unsafe cleanup.
- Website Sales works with both image and video creative paths.
- Leads distinguishes website and Instant Form contracts.
- App Promotion validates app-install prerequisites.
- Existing CPAS behavior passes v25 regression coverage.
- Activation requires a separate explicit approval.
- Build, lint, full tests, security checks, and diff checks pass.
