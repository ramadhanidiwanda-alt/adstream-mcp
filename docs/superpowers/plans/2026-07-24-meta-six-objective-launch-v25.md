# Meta Six-Objective Launch v25 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Meta write surface safely create complete PAUSED campaign hierarchies for all six ODAX objectives on Marketing API v25, while preserving CPAS/Collaborative Ads and requiring a separate approval for activation.

**Architecture:** Add one pure Meta objective-launch matrix and resolver, then make campaign, ad-set, readiness, creative, and bundle paths consume that shared contract. Keep the four existing public creation tools; objective-specific orchestration lives in the Meta AI skill, while provider-specific validation stays behind the Meta adapter.

**Tech Stack:** TypeScript ESM, Zod, MCP SDK, Vitest, Meta Marketing API v25, tsup, ESLint, Prettier.

## Global Constraints

- All new imports use `.js` extensions.
- Public types and functions are exported from `src/index.ts`.
- Every provider write remains dry-run first and requires explicit confirmation.
- Every newly created campaign, ad set, and ad defaults to `PAUSED`.
- Activation is a separate second approval and proceeds campaign → ad set → ad.
- Never log or return access tokens, connection keys, authorization headers, or unredacted signed URLs.
- Meta Marketing API v25 is the preferred contract; v23/v24 compatibility is explicit and never a silent downgrade.
- Do not add objective-specific public MCP tools.
- Collaborative Ads remains a Meta mode, not a provider or objective.
- Partial multi-step success returns completed IDs and does not automatically delete or archive provider objects.
- Unit tests never call the live Meta API.
- Live contract tests require separate explicit approval and create only PAUSED objects.
- Update existing documentation only where behavior changes; do not create unrelated Markdown files.

---

## File Map

### New production files

- `src/providers/meta/objectiveLaunchMatrix.ts` — six-objective constants, version parser, launch specs, resolver, promoted-object builder, and structured local errors.
- `src/tools/listLeadForms.ts` — read-only discovery of Instant Forms for a Page.

### Existing production files to modify

- `src/types.ts` — Instant Form and standard app creative inputs.
- `src/metaClient.ts` — expose normalized configured API version without exposing credentials.
- `src/config.ts` — change the default Meta API version from v23 to v25.
- `src/tools/createCampaign.ts` — accept only six ODAX create objectives and reject invalid runtime input.
- `src/tools/createAdSet.ts` — resolve objective-specific defaults and validate the parent campaign objective.
- `src/tools/checkLaunchReadiness.ts` — objective-aware readiness result.
- `src/tools/launchPresets.ts` — marketer-facing presets for canonical workflows.
- `src/tools/createAdCreative.ts` — pass typed Instant Form and standard app creative inputs.
- `src/providers/meta/buildCreativeFormatPayload.ts` — build Instant Form CTA and standard app destinations.
- `src/tools/createEcommerceCampaignBundle.ts` — repair video flow and consume the Sales contract.
- `src/providers/meta/MetaAdsAdapter.ts` — parse and forward new canonical fields, API version, and lead-form discovery.
- `src/broker/types.ts` — broker contract for lead forms and resolved readiness.
- `src/broker/mcpTools.ts` — shared enums in JSON schemas and lead-form discovery registration.
- `src/mcp/createServer.ts` — matching Zod schemas and tool registration.
- `src/index.ts` — export new public types/read helper.
- `skills/meta-ads/shared/preamble.md` — remove the stale statement that non-sales creation is unsupported.
- `skills/meta-ads/manage/SKILL.md` — six-objective marketer workflow, dry-run summary, and approval boundary.
- `docs/PLAN.md` — roadmap milestone and deferred variants.
- `ROADMAP.md` — public project roadmap for six-objective delivery.
- `README.md`, `.env.example`, and self-hosting docs — document the v25 default.
- `docs/PROJECT_STATUS.md` — update only after the baseline actually ships.

### Test files

- `tests/metaObjectiveLaunchMatrix.test.ts`
- `tests/config.test.ts`
- `tests/createCampaign.test.ts`
- `tests/createAdSet.test.ts`
- `tests/launchPresets.test.ts`
- `tests/metaAdsAdapter.test.ts`
- `tests/mcpAdsTools.test.ts`
- `tests/mcpServerBuilder.test.ts`
- `tests/metaCreativeFormatPayload.test.ts`
- `tests/createAdCreative.test.ts`
- `tests/createEcommerceCampaignBundle.test.ts`
- `tests/listLeadForms.test.ts`

---

### Task 1: Introduce the v25 objective-launch source of truth

**Files:**
- Create: `src/providers/meta/objectiveLaunchMatrix.ts`
- Create: `tests/metaObjectiveLaunchMatrix.test.ts`
- Modify: `src/metaClient.ts`
- Modify: `src/config.ts`
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `src/index.ts`
- Create: `tests/config.test.ts`

**Interfaces:**
- Produces: `META_ODAX_OBJECTIVES`, `MetaOdaxObjective`, `MetaConversionLocation`, `MetaObjectiveLaunchSpec`, `MetaObjectiveLaunchInput`, `MetaObjectiveLaunchErrorCode`, `MetaObjectiveLaunchValidationError`, `resolveMetaObjectiveLaunchSpec()`, `buildMetaPromotedObject()`, and `parseMetaApiMajor()`.
- Consumes later: Tasks 2–10 import these values instead of maintaining local enum lists.

- [ ] **Step 1: Write the failing matrix tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  META_ODAX_OBJECTIVES,
  MetaObjectiveLaunchValidationError,
  buildMetaPromotedObject,
  parseMetaApiMajor,
  resolveMetaObjectiveLaunchSpec,
} from '../src/providers/meta/objectiveLaunchMatrix.js';

describe('Meta objective launch matrix', () => {
  it('exposes exactly the six ODAX create objectives', () => {
    expect(META_ODAX_OBJECTIVES).toEqual([
      'OUTCOME_AWARENESS',
      'OUTCOME_TRAFFIC',
      'OUTCOME_ENGAGEMENT',
      'OUTCOME_LEADS',
      'OUTCOME_APP_PROMOTION',
      'OUTCOME_SALES',
    ]);
  });

  it('resolves website traffic to landing-page views by default', () => {
    expect(
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_TRAFFIC',
        conversionLocation: 'WEBSITE',
        creativeFormat: 'single_image',
        apiVersion: 'v25.0',
      })
    ).toMatchObject({
      key: 'traffic_website',
      optimizationGoal: 'LANDING_PAGE_VIEWS',
      billingEvent: 'IMPRESSIONS',
      destinationType: 'WEBSITE',
    });
  });

  it('rejects a sales/reach combination before any provider call', () => {
    expect(() =>
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_SALES',
        conversionLocation: 'WEBSITE',
        optimizationGoal: 'REACH',
        creativeFormat: 'single_image',
        apiVersion: 'v25.0',
      })
    ).toThrowError(
      expect.objectContaining<Partial<MetaObjectiveLaunchValidationError>>({
        code: 'INVALID_OBJECTIVE_GOAL_COMBINATION',
      })
    );
  });

  it('builds website lead and app-install promoted objects', () => {
    const lead = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_LEADS',
      conversionLocation: 'WEBSITE',
      creativeFormat: 'single_image',
      apiVersion: 'v25.0',
    });
    expect(buildMetaPromotedObject(lead, { pixelId: 'pixel-1' })).toEqual({
      pixel_id: 'pixel-1',
      custom_event_type: 'LEAD',
    });

    const app = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_APP_PROMOTION',
      conversionLocation: 'APP',
      creativeFormat: 'video',
      apiVersion: 'v25.0',
    });
    expect(
      buildMetaPromotedObject(app, {
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
      })
    ).toEqual({
      application_id: 'app-1',
      object_store_url: 'https://apps.apple.com/app/id123',
    });
  });

  it('parses supported versions and rejects unreviewed versions', () => {
    expect(parseMetaApiMajor('v25.0')).toBe(25);
    expect(parseMetaApiMajor('24')).toBe(24);
    expect(() =>
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_AWARENESS',
        conversionLocation: 'AWARENESS',
        creativeFormat: 'single_image',
        apiVersion: 'v26.0',
      })
    ).toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_API_VERSION' }));
  });
});
```

- [ ] **Step 2: Write the failing v25-default test**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const originalToken = process.env.META_ACCESS_TOKEN;
const originalApiVersion = process.env.META_API_VERSION;

afterEach(() => {
  if (originalToken === undefined) delete process.env.META_ACCESS_TOKEN;
  else process.env.META_ACCESS_TOKEN = originalToken;
  if (originalApiVersion === undefined) delete process.env.META_API_VERSION;
  else process.env.META_API_VERSION = originalApiVersion;
});

describe('Meta config', () => {
  it('defaults new connections to Marketing API v25.0', () => {
    process.env.META_ACCESS_TOKEN = 'EAA-test-token';
    delete process.env.META_API_VERSION;
    expect(loadConfig().apiVersion).toBe('v25.0');
  });
});
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run:

```bash
npx vitest run tests/metaObjectiveLaunchMatrix.test.ts tests/config.test.ts
```

Expected: FAIL because `objectiveLaunchMatrix.ts` does not exist and config still defaults to v23.

- [ ] **Step 4: Implement the objective contracts and matrix**

Use these exact public constants and core types:

```ts
import type { MetaCreativeFormat } from '../../types.js';

export const META_ODAX_OBJECTIVES = [
  'OUTCOME_AWARENESS',
  'OUTCOME_TRAFFIC',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_SALES',
] as const;

export type MetaOdaxObjective = (typeof META_ODAX_OBJECTIVES)[number];

export const META_CONVERSION_LOCATIONS = [
  'AWARENESS',
  'WEBSITE',
  'POST',
  'VIDEO',
  'INSTANT_FORM',
  'APP',
  'CATALOG',
] as const;

export type MetaConversionLocation = (typeof META_CONVERSION_LOCATIONS)[number];
export type MetaPromotedObjectKind =
  | 'none'
  | 'pixel_lead'
  | 'pixel_purchase'
  | 'page'
  | 'application'
  | 'collaborative_catalog';

export type MetaObjectiveLaunchErrorCode =
  | 'UNSUPPORTED_OBJECTIVE'
  | 'INVALID_OBJECTIVE_GOAL_COMBINATION'
  | 'INVALID_OBJECTIVE_DESTINATION_COMBINATION'
  | 'MISSING_PROMOTED_OBJECT_FIELD'
  | 'MISSING_OBJECTIVE_DEPENDENCY'
  | 'UNSUPPORTED_CREATIVE_FORMAT'
  | 'UNSUPPORTED_API_VERSION';

export interface MetaObjectiveLaunchSpec {
  key:
    | 'awareness'
    | 'traffic_website'
    | 'engagement_post'
    | 'engagement_video'
    | 'leads_website'
    | 'leads_instant_form'
    | 'app_installs'
    | 'sales_website'
    | 'sales_catalog';
  objective: MetaOdaxObjective;
  conversionLocation: MetaConversionLocation;
  optimizationGoal: string;
  allowedOptimizationGoals: readonly string[];
  billingEvent: string;
  destinationType?: string;
  promotedObjectKind: MetaPromotedObjectKind;
  requiredInputs: readonly string[];
  supportedCreativeFormats: readonly MetaCreativeFormat[];
  defaultCallToAction?: string;
  minApiMajor: 23;
  maxApiMajor: 25;
}

export interface MetaObjectiveLaunchRequest {
  objective: MetaOdaxObjective;
  conversionLocation: MetaConversionLocation;
  optimizationGoal?: string;
  creativeFormat?: MetaCreativeFormat;
  apiVersion?: string;
}

export interface MetaObjectiveLaunchInput {
  pageId?: string;
  pixelId?: string;
  leadFormId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  productSetId?: string;
  customEventType?: string;
}

export class MetaObjectiveLaunchValidationError extends Error {
  constructor(
    readonly code: MetaObjectiveLaunchErrorCode,
    message: string,
    readonly actionableFix: string
  ) {
    super(message);
    this.name = 'MetaObjectiveLaunchValidationError';
  }
}
```

Define the canonical rows:

```ts
const MATRIX = {
  awareness: {
    objective: 'OUTCOME_AWARENESS',
    conversionLocation: 'AWARENESS',
    defaultGoal: 'REACH',
    allowedGoals: ['REACH', 'IMPRESSIONS'],
    destinationType: undefined,
    promotedObjectKind: 'none',
    requiredInputs: [
      'pageId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video'],
  },
  traffic_website: {
    objective: 'OUTCOME_TRAFFIC',
    conversionLocation: 'WEBSITE',
    defaultGoal: 'LANDING_PAGE_VIEWS',
    allowedGoals: ['LANDING_PAGE_VIEWS', 'LINK_CLICKS'],
    destinationType: 'WEBSITE',
    promotedObjectKind: 'none',
    requiredInputs: [
      'pageId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video', 'carousel', 'flexible'],
    defaultCallToAction: 'LEARN_MORE',
  },
  engagement_post: {
    objective: 'OUTCOME_ENGAGEMENT',
    conversionLocation: 'POST',
    defaultGoal: 'POST_ENGAGEMENT',
    allowedGoals: ['POST_ENGAGEMENT'],
    destinationType: 'ON_POST',
    promotedObjectKind: 'none',
    requiredInputs: [
      'pageId',
      'existingPostId',
      'dailyBudget',
      'countries',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['existing_post'],
  },
  engagement_video: {
    objective: 'OUTCOME_ENGAGEMENT',
    conversionLocation: 'VIDEO',
    defaultGoal: 'THRUPLAY',
    allowedGoals: ['THRUPLAY'],
    destinationType: 'ON_VIDEO',
    promotedObjectKind: 'none',
    requiredInputs: [
      'pageId',
      'videoId',
      'dailyBudget',
      'countries',
      'primaryText',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['video'],
  },
  leads_website: {
    objective: 'OUTCOME_LEADS',
    conversionLocation: 'WEBSITE',
    defaultGoal: 'OFFSITE_CONVERSIONS',
    allowedGoals: ['OFFSITE_CONVERSIONS'],
    destinationType: 'WEBSITE',
    promotedObjectKind: 'pixel_lead',
    requiredInputs: [
      'pageId',
      'pixelId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video', 'carousel'],
    defaultCallToAction: 'SIGN_UP',
  },
  leads_instant_form: {
    objective: 'OUTCOME_LEADS',
    conversionLocation: 'INSTANT_FORM',
    defaultGoal: 'LEAD_GENERATION',
    allowedGoals: ['LEAD_GENERATION'],
    destinationType: 'ON_AD',
    promotedObjectKind: 'page',
    requiredInputs: [
      'pageId',
      'leadFormId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video'],
    defaultCallToAction: 'SIGN_UP',
  },
  app_installs: {
    objective: 'OUTCOME_APP_PROMOTION',
    conversionLocation: 'APP',
    defaultGoal: 'APP_INSTALLS',
    allowedGoals: ['APP_INSTALLS'],
    destinationType: 'APP',
    promotedObjectKind: 'application',
    requiredInputs: [
      'pageId',
      'applicationId',
      'objectStoreUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video'],
    defaultCallToAction: 'INSTALL_MOBILE_APP',
  },
  sales_website: {
    objective: 'OUTCOME_SALES',
    conversionLocation: 'WEBSITE',
    defaultGoal: 'OFFSITE_CONVERSIONS',
    allowedGoals: ['OFFSITE_CONVERSIONS', 'VALUE'],
    destinationType: 'WEBSITE',
    promotedObjectKind: 'pixel_purchase',
    requiredInputs: [
      'pageId',
      'pixelId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video', 'carousel', 'flexible'],
    defaultCallToAction: 'SHOP_NOW',
  },
  sales_catalog: {
    objective: 'OUTCOME_SALES',
    conversionLocation: 'CATALOG',
    defaultGoal: 'OFFSITE_CONVERSIONS',
    allowedGoals: ['OFFSITE_CONVERSIONS', 'VALUE'],
    destinationType: 'WEBSITE',
    promotedObjectKind: 'collaborative_catalog',
    requiredInputs: [
      'businessId',
      'catalogId',
      'productSetId',
      'pageId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: [
      'single_image',
      'video',
      'carousel',
      'catalog',
      'collection',
    ],
    defaultCallToAction: 'SHOP_NOW',
  },
} as const;
```

All rows use `billingEvent: 'IMPRESSIONS'`, `minApiMajor: 23`, and
`maxApiMajor: 25`. `resolveMetaObjectiveLaunchSpec()` finds one row by objective
and conversion location, validates requested goal, format, and API major, and
returns a copy containing the resolved goal.

`buildMetaPromotedObject()` returns:

```ts
switch (spec.promotedObjectKind) {
  case 'none':
    return undefined;
  case 'pixel_lead':
    return { pixel_id: requireInput(input.pixelId, 'pixelId'), custom_event_type: 'LEAD' };
  case 'pixel_purchase':
    return {
      pixel_id: requireInput(input.pixelId, 'pixelId'),
      custom_event_type: input.customEventType?.trim() || 'PURCHASE',
    };
  case 'page':
    return { page_id: requireInput(input.pageId, 'pageId') };
  case 'application':
    return {
      application_id: requireInput(input.applicationId, 'applicationId'),
      object_store_url: requireInput(input.objectStoreUrl, 'objectStoreUrl'),
    };
  case 'collaborative_catalog':
    return { product_set_id: requireInput(input.productSetId, 'productSetId') };
}
```

Implement `requireInput()` as a private helper that trims strings and throws:

```ts
throw new MetaObjectiveLaunchValidationError(
  'MISSING_PROMOTED_OBJECT_FIELD',
  `${field} is required for this objective launch.`,
  `Provide ${field}, then run ads_check_launch_readiness again.`
);
```

- [ ] **Step 5: Change the runtime default to Meta v25**

In `src/config.ts`, replace both `v23.0` defaults with `v25.0`.
In `MetaAdsAdapter.createClient()`, replace the credential fallback with
`credential.apiVersion ?? 'v25.0'`. Change `supportsMediaSourcingSpec()` to use
`v25.0` only as its missing-version parser fallback; keep its existing
version-specific behavior otherwise.

- [ ] **Step 6: Expose the configured API version safely**

Modify `MetaClient` without exposing its token:

```ts
export class MetaClient {
  private baseUrl: string;
  private accessToken: string;
  readonly apiVersion: string;

  constructor(config: MetaConfig) {
    this.apiVersion = config.apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.accessToken = config.accessToken;
  }
}
```

- [ ] **Step 7: Export the new source of truth**

Add to `src/index.ts`:

```ts
export {
  META_ODAX_OBJECTIVES,
  META_CONVERSION_LOCATIONS,
  MetaObjectiveLaunchValidationError,
  buildMetaPromotedObject,
  parseMetaApiMajor,
  resolveMetaObjectiveLaunchSpec,
} from './providers/meta/objectiveLaunchMatrix.js';
export type * from './providers/meta/objectiveLaunchMatrix.js';
```

- [ ] **Step 8: Run the focused tests**

Run:

```bash
npx vitest run tests/metaObjectiveLaunchMatrix.test.ts tests/config.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit the foundation**

```bash
git add src/providers/meta/objectiveLaunchMatrix.ts src/metaClient.ts src/config.ts src/providers/meta/MetaAdsAdapter.ts src/index.ts tests/metaObjectiveLaunchMatrix.test.ts tests/config.test.ts
git commit -m "feat: add Meta objective launch matrix"
```

---

### Task 2: Enforce the six-objective campaign and objective-aware ad-set contract

**Files:**
- Modify: `src/tools/createCampaign.ts`
- Modify: `src/tools/createAdSet.ts`
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `src/broker/mcpTools.ts`
- Modify: `src/mcp/createServer.ts`
- Test: `tests/createCampaign.test.ts`
- Test: `tests/createAdSet.test.ts`
- Test: `tests/metaAdsAdapter.test.ts`
- Test: `tests/mcpServerBuilder.test.ts`

**Interfaces:**
- Consumes: `MetaOdaxObjective`, `MetaConversionLocation`, `META_ODAX_OBJECTIVES`, `resolveMetaObjectiveLaunchSpec()`, and `buildMetaPromotedObject()`.
- Produces: `CreateAdSetOptions.conversionLocation`, objective-aware previews, and runtime validation before Meta writes.

- [ ] **Step 1: Add failing campaign contract tests**

Add tests proving:

```ts
it('rejects non-ODAX campaign objectives at runtime', async () => {
  const result = await createCampaign(
    mockClient,
    { ...validOptions, objective: 'OUTCOME_MESSAGES' as never },
    { dryRun: true }
  );
  expect(result).toMatchObject({
    status: 'failed',
    executed: false,
    structuredError: { code: 'UNSUPPORTED_OBJECTIVE' },
  });
  expect(mockMetaPost).not.toHaveBeenCalled();
});
```

Also add a table test that all six values in `META_ODAX_OBJECTIVES` produce a dry-run preview.

- [ ] **Step 2: Add failing ad-set compatibility tests**

Update the mock parent campaign to include `objective`. Add:

```ts
it('defaults website traffic to landing page views through the matrix', async () => {
  const client = createMockClient({
    objective: 'OUTCOME_TRAFFIC',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: undefined,
  });
  const result = await createAdSet(client, {
    ...defaultOptions,
    conversionLocation: 'WEBSITE',
    targeting: { geoLocations: { countries: ['ID'] } },
  });
  expect(result.preview).toMatchObject({
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LANDING_PAGE_VIEWS',
    destination_type: 'WEBSITE',
  });
});

it('rejects a sales ad set optimized for reach', async () => {
  const client = createMockClient({
    objective: 'OUTCOME_SALES',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: undefined,
  });
  const result = await createAdSet(client, {
    ...defaultOptions,
    conversionLocation: 'WEBSITE',
    optimizationGoal: 'REACH',
  });
  expect(result.structuredError?.code).toBe('INVALID_OBJECTIVE_GOAL_COMBINATION');
  expect(client.metaPost).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run focused tests and verify failure**

```bash
npx vitest run tests/createCampaign.test.ts tests/createAdSet.test.ts
```

Expected: FAIL because the runtime and ad-set matrix checks do not exist.

- [ ] **Step 4: Implement campaign runtime validation**

Replace the local objective union with:

```ts
import {
  META_ODAX_OBJECTIVES,
  type MetaOdaxObjective,
} from '../providers/meta/objectiveLaunchMatrix.js';

export type MetaCampaignObjective = MetaOdaxObjective;
```

Before building the preview, reject any runtime value not included in `META_ODAX_OBJECTIVES`, returning a failed result with structured code `UNSUPPORTED_OBJECTIVE`.

- [ ] **Step 5: Implement objective-aware ad-set resolution**

Add to `CreateAdSetOptions`:

```ts
conversionLocation?: MetaConversionLocation;
creativeFormat?: MetaCreativeFormat;
pageId?: string;
pixelId?: string;
leadFormId?: string;
applicationId?: string;
objectStoreUrl?: string;
productSetId?: string;
customEventType?: string;
```

Extend `CampaignInfo` and the parent fetch:

```ts
interface CampaignInfo {
  id: string;
  objective?: string;
  bid_strategy?: string;
  daily_budget?: number;
  lifetime_budget?: number;
}

{ fields: 'id,objective,bid_strategy,daily_budget,lifetime_budget' }
```

Rules:

- When `conversionLocation` is supplied, resolve the matrix using the parent objective, caller goal, format, and `client.apiVersion ?? 'v25.0'`.
- Fill `billing_event`, `optimization_goal`, and `destination_type` from the resolved spec.
- If `promotedObject` is absent, call `buildMetaPromotedObject()` with
  `pageId`, `pixelId`, `leadFormId`, `applicationId`, `objectStoreUrl`,
  `productSetId`, and `customEventType`.
- When `conversionLocation` is absent, preserve legacy explicit parameters but do not inject `optimization_goal: 'REACH'`.
- If neither matrix context nor an explicit `optimizationGoal` exists, return `MISSING_OBJECTIVE_DEPENDENCY` before POST.

Change `buildAdSetPayload()` so it has no universal goal fallback:

```ts
const payload: Record<string, unknown> = {
  name: options.name.trim(),
  campaign_id: options.campaignId,
  status: options.status ?? 'PAUSED',
  billing_event: options.billingEvent ?? 'IMPRESSIONS',
};
if (options.optimizationGoal) payload.optimization_goal = options.optimizationGoal;
```

- [ ] **Step 6: Update both public schema surfaces from shared constants**

In Zod:

```ts
objective: z.enum(META_ODAX_OBJECTIVES)
```

In JSON schema:

```ts
objective: {
  type: 'string',
  enum: [...META_ODAX_OBJECTIVES],
  description: 'Meta ODAX campaign objective.',
}
```

Add `conversionLocation`, `creativeFormat`, `pageId`, `pixelId`, `leadFormId`,
`applicationId`, `objectStoreUrl`, `productSetId`, and `customEventType` to both
ad-set schemas. Use the shared constants and creative-format list. Remove
descriptions claiming `REACH` is the ad-set default.

- [ ] **Step 7: Forward API version and canonical fields through the adapter**

The adapter must validate objective strings with:

```ts
META_ODAX_OBJECTIVES.includes(objective as MetaOdaxObjective)
```

It then passes the canonical conversion, creative, and dependency fields and
creates the client before matrix resolution so
`credential.apiVersion ?? 'v25.0'` is honored.

- [ ] **Step 8: Add schema parity assertions**

Extend `tests/mcpServerBuilder.test.ts` and `tests/metaAdsAdapter.test.ts` to assert:

```ts
expect(campaignObjectiveEnum).toEqual([...META_ODAX_OBJECTIVES]);
expect(adSetProperties).toHaveProperty('conversionLocation');
expect(adSetProperties).toHaveProperty('creativeFormat');
```

- [ ] **Step 9: Verify and commit**

```bash
npx vitest run tests/createCampaign.test.ts tests/createAdSet.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
npm run build
git add src/tools/createCampaign.ts src/tools/createAdSet.ts src/providers/meta/MetaAdsAdapter.ts src/broker/mcpTools.ts src/mcp/createServer.ts tests/createCampaign.test.ts tests/createAdSet.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
git commit -m "feat: enforce objective-aware Meta creation"
```

---

### Task 3: Replace legacy readiness presets with six-objective readiness

**Files:**
- Modify: `src/tools/checkLaunchReadiness.ts`
- Modify: `src/tools/launchPresets.ts`
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `src/broker/mcpTools.ts`
- Modify: `src/mcp/createServer.ts`
- Test: `tests/launchPresets.test.ts`
- Test: `tests/metaAdsAdapter.test.ts`
- Test: `tests/mcpAdsTools.test.ts`

**Interfaces:**
- Produces: objective-aware `LaunchReadinessOptions`, `LaunchReadinessResult.resolvedSpec`, and marketer-facing canonical workflow presets.
- Consumes later: the Meta management skill uses `resolvedSpec` to call the existing four write tools.

- [ ] **Step 1: Write failing table-driven readiness tests**

Test these exact canonical workflow keys:

```ts
const cases = [
  ['awareness', 'OUTCOME_AWARENESS', 'AWARENESS'],
  ['traffic_website', 'OUTCOME_TRAFFIC', 'WEBSITE'],
  ['engagement_post', 'OUTCOME_ENGAGEMENT', 'POST'],
  ['engagement_video', 'OUTCOME_ENGAGEMENT', 'VIDEO'],
  ['leads_website', 'OUTCOME_LEADS', 'WEBSITE'],
  ['leads_instant_form', 'OUTCOME_LEADS', 'INSTANT_FORM'],
  ['app_installs', 'OUTCOME_APP_PROMOTION', 'APP'],
  ['sales_website', 'OUTCOME_SALES', 'WEBSITE'],
  ['sales_catalog', 'OUTCOME_SALES', 'CATALOG'],
] as const;
```

For each case, assert preset objective/location and that a minimal incomplete request returns the correct missing IDs. Add focused expectations:

- Awareness does not require Pixel or URL.
- Traffic requires URL.
- Engagement Post requires existing post ID.
- Engagement Video requires video.
- Leads Website requires Pixel and URL.
- Instant Form requires Page and lead form.
- App installs requires application ID and store URL.
- Sales Website requires Pixel and URL.
- Sales Catalog requires product set and catalog context.

- [ ] **Step 2: Run the readiness tests and verify failure**

```bash
npx vitest run tests/launchPresets.test.ts tests/metaAdsAdapter.test.ts
```

Expected: FAIL because the legacy six workflow names do not represent the six objectives.

- [ ] **Step 3: Replace `MetaLaunchWorkflow` and presets**

Use:

```ts
export type MetaLaunchWorkflow =
  | 'awareness'
  | 'traffic_website'
  | 'engagement_post'
  | 'engagement_video'
  | 'leads_website'
  | 'leads_instant_form'
  | 'app_installs'
  | 'sales_website'
  | 'sales_catalog';
```

Retain these aliases inside `normalizeWorkflow()` for compatibility:

```ts
const LEGACY_WORKFLOW_ALIASES = {
  website_sales: 'sales_website',
  lead_generation: 'leads_website',
  existing_post: 'engagement_post',
  cpas_catalog_sales: 'sales_catalog',
} as const;
```

Keep `whatsapp_sales` and `creative_testing` as deprecated readiness aliases that return a warning and map to the closest existing legacy path; do not claim they are canonical v25 baseline workflows.

- [ ] **Step 4: Expand readiness input/output**

Add:

```ts
objective?: MetaOdaxObjective;
conversionLocation?: MetaConversionLocation;
optimizationGoal?: string;
creativeFormat?: MetaCreativeFormat;
apiVersion?: string;
leadFormId?: string;
applicationId?: string;
objectStoreUrl?: string;
appDeepLinkUrl?: string;
```

Add to the result:

```ts
resolvedSpec?: {
  key: string;
  objective: MetaOdaxObjective;
  conversionLocation: MetaConversionLocation;
  optimizationGoal: string;
  billingEvent: string;
  destinationType?: string;
  defaultCallToAction?: string;
  supportedCreativeFormats: readonly MetaCreativeFormat[];
};
```

`checkLaunchReadiness()` obtains the preset, resolves the matrix, then checks only `requiredInputs` from that resolved spec plus shared budget/audience/special-category fields.

- [ ] **Step 5: Update adapter and both schema surfaces**

Forward every new field through `MetaAdsAdapter.checkLaunchReadiness()`. Use the same enum constants in Zod and JSON schema. Update the tool description to say that it resolves one of the six ODAX objectives and does not perform writes.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/launchPresets.test.ts tests/metaAdsAdapter.test.ts tests/mcpAdsTools.test.ts
npm run build
git add src/tools/checkLaunchReadiness.ts src/tools/launchPresets.ts src/providers/meta/MetaAdsAdapter.ts src/broker/mcpTools.ts src/mcp/createServer.ts tests/launchPresets.test.ts tests/metaAdsAdapter.test.ts tests/mcpAdsTools.test.ts
git commit -m "feat: add six-objective launch readiness"
```

---

### Task 4: Deliver Awareness, Traffic, and Engagement vertical slices

**Files:**
- Modify: `src/providers/meta/objectiveLaunchMatrix.ts`
- Modify: `src/tools/createAdSet.ts`
- Modify: `src/providers/meta/buildCreativeFormatPayload.ts`
- Test: `tests/metaObjectiveLaunchMatrix.test.ts`
- Test: `tests/createAdSet.test.ts`
- Test: `tests/metaCreativeFormatPayload.test.ts`

**Interfaces:**
- Produces: tested canonical payloads for Awareness Reach/Impressions, Traffic LPV/Link Clicks, Engagement Post, and Engagement Video/ThruPlay.

- [ ] **Step 1: Write exact payload tests for each vertical slice**

Add table tests asserting:

```ts
[
  {
    objective: 'OUTCOME_AWARENESS',
    location: 'AWARENESS',
    goal: undefined,
    expected: { optimization_goal: 'REACH', billing_event: 'IMPRESSIONS' },
  },
  {
    objective: 'OUTCOME_AWARENESS',
    location: 'AWARENESS',
    goal: 'IMPRESSIONS',
    expected: { optimization_goal: 'IMPRESSIONS', billing_event: 'IMPRESSIONS' },
  },
  {
    objective: 'OUTCOME_TRAFFIC',
    location: 'WEBSITE',
    goal: undefined,
    expected: {
      optimization_goal: 'LANDING_PAGE_VIEWS',
      billing_event: 'IMPRESSIONS',
      destination_type: 'WEBSITE',
    },
  },
  {
    objective: 'OUTCOME_ENGAGEMENT',
    location: 'POST',
    goal: undefined,
    expected: {
      optimization_goal: 'POST_ENGAGEMENT',
      billing_event: 'IMPRESSIONS',
      destination_type: 'ON_POST',
    },
  },
  {
    objective: 'OUTCOME_ENGAGEMENT',
    location: 'VIDEO',
    goal: undefined,
    expected: {
      optimization_goal: 'THRUPLAY',
      billing_event: 'IMPRESSIONS',
      destination_type: 'ON_VIDEO',
    },
  },
]
```

Add creative tests proving:

- Awareness single image can omit an external CTA/URL.
- Traffic single image requires URL and emits `LEARN_MORE`.
- Engagement existing post does not fabricate a URL.
- Engagement video uses the existing video builder and thumbnail fallback.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
npx vitest run tests/metaObjectiveLaunchMatrix.test.ts tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts
```

- [ ] **Step 3: Make awareness copy URL-optional without weakening traffic/sales**

Do not globally relax `destinationUrl`. Add explicit creative destination behavior:

```ts
export type MetaCreativeDestinationMode = 'EXTERNAL_URL' | 'NONE' | 'INSTANT_FORM' | 'APP';
```

Pass the resolved destination mode into the creative spec. For `NONE`, build `object_story_spec.photo_data` or `video_data` without a fabricated external link/CTA. Existing external-link builders continue requiring a URL.

Add `destinationMode?: MetaCreativeDestinationMode` to `MetaCreativeCopy`.
Use this exact single-image branch before the existing link-data builder:

```ts
if (creativeSpec.destinationMode === 'NONE') {
  return withDegreesOfFreedomSpec(
    {
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        ...instagramIdentity(input),
        photo_data: {
          image_hash: required(creativeSpec.imageHash, 'imageHash'),
          message: required(creativeSpec.primaryText, 'primaryText'),
        },
      },
    },
    input.optOutEnhancements
  );
}
```

For video `destinationMode: 'NONE'`, use the existing thumbnail logic but omit
`call_to_action`:

```ts
const videoData = {
  video_id: required(creativeSpec.videoId, 'videoId'),
  message: required(creativeSpec.primaryText, 'primaryText'),
  ...(creativeSpec.headline?.trim() ? { title: creativeSpec.headline.trim() } : {}),
  ...(thumbnailImageHash ? { image_hash: thumbnailImageHash } : {}),
  ...(!thumbnailImageHash && thumbnailImageUrl ? { image_url: thumbnailImageUrl } : {}),
};
```

- [ ] **Step 4: Verify exact payloads and no regressions**

```bash
npx vitest run tests/metaObjectiveLaunchMatrix.test.ts tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts tests/createAdCreative.test.ts
npm run build
```

- [ ] **Step 5: Commit the first three objective slices**

```bash
git add src/providers/meta/objectiveLaunchMatrix.ts src/tools/createAdSet.ts src/providers/meta/buildCreativeFormatPayload.ts src/types.ts tests/metaObjectiveLaunchMatrix.test.ts tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts tests/createAdCreative.test.ts
git commit -m "feat: add awareness traffic and engagement launches"
```

---

### Task 5: Add Instant Form discovery and both Leads paths

**Files:**
- Create: `src/tools/listLeadForms.ts`
- Create: `tests/listLeadForms.test.ts`
- Modify: `src/types.ts`
- Modify: `src/tools/createAdCreative.ts`
- Modify: `src/providers/meta/buildCreativeFormatPayload.ts`
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `src/broker/types.ts`
- Modify: `src/broker/mcpTools.ts`
- Modify: `src/mcp/createServer.ts`
- Modify: `src/index.ts`
- Test: `tests/metaCreativeFormatPayload.test.ts`
- Test: `tests/createAdCreative.test.ts`
- Test: `tests/metaAdsAdapter.test.ts`
- Test: `tests/mcpServerBuilder.test.ts`

**Interfaces:**
- Produces: read-only `ads_list_lead_forms`, `MetaLeadFormResult`, and typed `leadFormId` creative input.
- Consumes: Leads readiness and matrix contracts from Tasks 1–3.

- [ ] **Step 1: Write failing lead-form discovery tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { listLeadForms } from '../src/tools/listLeadForms.js';

it('lists active Instant Forms for a Page without returning sensitive fields', async () => {
  const metaGet = vi.fn().mockResolvedValue({
    data: [
      { id: 'form-1', name: 'Consultation', status: 'ACTIVE', locale: 'en_US' },
      { id: 'form-2', name: 'Old form', status: 'ARCHIVED', locale: 'en_US' },
    ],
  });
  const result = await listLeadForms({ metaGet } as never, {
    pageId: 'page-1',
    status: ['ACTIVE'],
  });
  expect(metaGet).toHaveBeenCalledWith('/page-1/leadgen_forms', {
    fields: 'id,name,status,locale,created_time',
    filtering: JSON.stringify([{ field: 'status', operator: 'IN', value: ['ACTIVE'] }]),
    limit: 50,
  });
  expect(result).toEqual([
    expect.objectContaining({ lead_form_id: 'form-1', name: 'Consultation', status: 'ACTIVE' }),
  ]);
});
```

- [ ] **Step 2: Write failing Instant Form creative tests**

Use a single-image creative with:

```ts
creativeSpec: {
  imageHash: 'hash-1',
  primaryText: 'Book a consultation',
  headline: 'Talk to our team',
  callToAction: 'SIGN_UP',
  leadFormId: 'form-1',
}
```

Expected Meta payload:

```ts
{
  object_story_spec: {
    page_id: 'page-1',
    link_data: {
      image_hash: 'hash-1',
      message: 'Book a consultation',
      name: 'Talk to our team',
      call_to_action: {
        type: 'SIGN_UP',
        value: { lead_gen_form_id: 'form-1' },
      },
    },
  },
}
```

Also assert that providing both `leadFormId` and external `destinationUrl` is rejected for the canonical Instant Form path.

- [ ] **Step 3: Run focused tests and verify failure**

```bash
npx vitest run tests/listLeadForms.test.ts tests/metaCreativeFormatPayload.test.ts
```

- [ ] **Step 4: Implement the read-only discovery helper**

Use:

```ts
export interface MetaLeadFormResult {
  lead_form_id: string;
  name: string;
  status?: string;
  locale?: string;
  created_time?: string;
}

export async function listLeadForms(
  client: MetaClient,
  options: { pageId: string; status?: string[]; limit?: number }
): Promise<MetaLeadFormResult[]> {
  // GET /{pageId}/leadgen_forms, filter locally as a defense if Meta ignores filtering.
}
```

Register `ads_list_lead_forms` as a read-only provider capability. Its input is `accountId`, `pageId`, optional `status[]`, and optional `limit`. This is asset discovery, not an objective-specific workflow tool.

Registration changes are explicit:

- add `ads_list_lead_forms` to `ADS_MCP_TOOL_NAMES`;
- add a read-only definition beside `ads_list_pages`;
- dispatch it to `broker.listLeadForms(request)`;
- add `listLeadForms()` to the broker/provider interface;
- implement it in `MetaAdsAdapter`;
- register the matching Zod schema in `createServer.ts`;
- export the helper and result type from `src/index.ts`.

- [ ] **Step 5: Add typed form support to image and video specs**

Add `leadFormId?: string` to `MetaSingleImageCreativeSpec` and `MetaVideoCreativeSpec`. Update the CTA helper so `leadFormId` produces `value.lead_gen_form_id` and does not require a link. Do not change external-link CTA behavior.

- [ ] **Step 6: Wire both Leads contracts**

- Website Leads: `OFFSITE_CONVERSIONS`, `WEBSITE`, `{ pixel_id, custom_event_type: 'LEAD' }`, URL required.
- Instant Form: `LEAD_GENERATION`, `ON_AD`, `{ page_id }`, `leadFormId` required and Page must match the form owner when Meta exposes that field.

Readiness must recommend `ads_list_lead_forms` when `leadFormId` is missing.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run tests/listLeadForms.test.ts tests/metaObjectiveLaunchMatrix.test.ts tests/metaCreativeFormatPayload.test.ts tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
npm run build
git add src/tools/listLeadForms.ts src/types.ts src/tools/createAdCreative.ts src/providers/meta/buildCreativeFormatPayload.ts src/providers/meta/MetaAdsAdapter.ts src/broker/types.ts src/broker/mcpTools.ts src/mcp/createServer.ts src/index.ts tests/listLeadForms.test.ts tests/metaCreativeFormatPayload.test.ts tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
git commit -m "feat: add website and Instant Form lead launches"
```

---

### Task 6: Add the standard App Promotion install path

**Files:**
- Modify: `src/types.ts`
- Modify: `src/providers/meta/objectiveLaunchMatrix.ts`
- Modify: `src/providers/meta/buildCreativeFormatPayload.ts`
- Modify: `src/tools/createAdCreative.ts`
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `src/broker/mcpTools.ts`
- Modify: `src/mcp/createServer.ts`
- Test: `tests/metaObjectiveLaunchMatrix.test.ts`
- Test: `tests/metaCreativeFormatPayload.test.ts`
- Test: `tests/createAdCreative.test.ts`
- Test: `tests/metaAdsAdapter.test.ts`

**Interfaces:**
- Produces: `MetaStandardAppSpec` and canonical app-install creative payloads.

- [ ] **Step 1: Write failing app-install tests**

Matrix expectation:

```ts
expect(
  resolveMetaObjectiveLaunchSpec({
    objective: 'OUTCOME_APP_PROMOTION',
    conversionLocation: 'APP',
    creativeFormat: 'video',
    apiVersion: 'v25.0',
  })
).toMatchObject({
  optimizationGoal: 'APP_INSTALLS',
  billingEvent: 'IMPRESSIONS',
  destinationType: 'APP',
  promotedObjectKind: 'application',
});
```

Creative expectation:

```ts
expect(result).toMatchObject({
  object_story_spec: {
    page_id: 'page-1',
    video_data: {
      video_id: 'video-1',
      call_to_action: {
        type: 'INSTALL_MOBILE_APP',
        value: {
          link: 'myapp://home',
          app_link: 'myapp://home',
          application: 'app-1',
        },
      },
    },
  },
});
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
npx vitest run tests/metaObjectiveLaunchMatrix.test.ts tests/metaCreativeFormatPayload.test.ts
```

- [ ] **Step 3: Add the standard app contract**

Add:

```ts
export interface MetaStandardAppSpec {
  applicationId: string;
  objectStoreUrl: string;
  deepLinkUrl?: string;
}
```

Expose `standardAppSpec?: MetaStandardAppSpec` on canonical single-image and video creative inputs. Keep it separate from `MetaCollaborativeAppSpec`; CPAS omnichannel fields must not be emitted for a standard app-install ad.

- [ ] **Step 4: Build app CTA values explicitly**

For standard app installs:

```ts
{
  type: creativeSpec.callToAction ?? 'INSTALL_MOBILE_APP',
  value: {
    link: standardAppSpec.deepLinkUrl ?? standardAppSpec.objectStoreUrl,
    app_link: standardAppSpec.deepLinkUrl ?? standardAppSpec.objectStoreUrl,
    application: standardAppSpec.applicationId,
  },
}
```

Reject missing app ID/store URL during dry-run. Readiness emits a warning that SDK/MMP and app-event setup cannot be proven by the connector.

- [ ] **Step 5: Update schema and adapter mappings**

Add the same `standardAppSpec` object to Zod, JSON schema, `CREATE_AD_CREATIVE_PARAMS`, and adapter parsing. Add a parity test that the object reaches `buildMetaCreativeFormatPayload()`.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/metaObjectiveLaunchMatrix.test.ts tests/metaCreativeFormatPayload.test.ts tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
npm run build
git add src/types.ts src/providers/meta/objectiveLaunchMatrix.ts src/providers/meta/buildCreativeFormatPayload.ts src/tools/createAdCreative.ts src/providers/meta/MetaAdsAdapter.ts src/broker/mcpTools.ts src/mcp/createServer.ts tests/metaObjectiveLaunchMatrix.test.ts tests/metaCreativeFormatPayload.test.ts tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
git commit -m "feat: add Meta app install launch path"
```

---

### Task 7: Repair and refactor Website Sales image/video launch

**Files:**
- Modify: `src/tools/createEcommerceCampaignBundle.ts`
- Modify: `src/providers/meta/objectiveLaunchMatrix.ts`
- Test: `tests/createEcommerceCampaignBundle.test.ts`
- Test: `tests/metaAdsAdapter.test.ts`

**Interfaces:**
- Produces: a bundle that uses the shared Sales contract and creates either a typed image or typed video creative.

- [ ] **Step 1: Write the missing successful video tests**

Add one test for existing `videoId` and one for uploaded `videoFilePath`. Assert the creative POST contains `object_story_spec.video_data.video_id` and never `link_data` without media:

```ts
expect(mockPost.mock.calls[2][1]).toMatchObject({
  object_story_spec: {
    page_id: payload.pageId,
    video_data: {
      video_id: 'video_uploaded',
      message: payload.primaryText,
      title: payload.headline,
    },
  },
});
```

For the upload path, mock `metaUploadMultipart` to return `{ id: 'video_uploaded' }`.

- [ ] **Step 2: Run the bundle test and verify failure**

```bash
npx vitest run tests/createEcommerceCampaignBundle.test.ts
```

Expected: FAIL because the uploaded ID is dropped and the creative always uses legacy `linkData`.

- [ ] **Step 3: Resolve the Sales contract before building preview/execution**

Call:

```ts
const salesSpec = resolveMetaObjectiveLaunchSpec({
  objective: 'OUTCOME_SALES',
  conversionLocation: 'WEBSITE',
  optimizationGoal: payload.optimizationGoal,
  creativeFormat: hasVideo ? 'video' : 'single_image',
  apiVersion: client.apiVersion ?? 'v25.0',
});
```

Use `salesSpec` for campaign/ad-set preview and execution values. Build promoted object with `pixelId` and `customEventType`, allowing the existing bundle's `PURCHASE`, `ADD_TO_CART`, and `INITIATED_CHECKOUT` override only when explicitly supplied.

- [ ] **Step 4: Preserve and use uploaded video IDs**

Use:

```ts
let videoId = payload.videoId?.trim();
if (payload.videoFilePath?.trim() && !videoId) {
  const uploadResult = await uploadVideo(client, {
    adAccountId: payload.adAccountId,
    filePath: payload.videoFilePath.trim(),
    maxRetries,
  });
  if (uploadResult.status === 'failed' || !uploadResult.video_id) {
    return failedResult(`Video upload failed: ${uploadResult.error ?? 'unknown error'}`);
  }
  videoId = uploadResult.video_id;
}
```

Create exactly one typed creative:

```ts
creative: videoId
  ? {
      creativeFormat: 'video',
      creativeSpec: {
        videoId,
        primaryText: payload.primaryText.trim(),
        headline: payload.headline.trim(),
        description: payload.description?.trim(),
        destinationUrl: payload.destinationUrl.trim(),
        callToAction: payload.callToActionType ?? 'SHOP_NOW',
      },
    }
  : {
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: requireBundleImageHash(imageHash),
        primaryText: payload.primaryText.trim(),
        headline: payload.headline.trim(),
        description: payload.description?.trim(),
        destinationUrl: payload.destinationUrl.trim(),
        callToAction: payload.callToActionType ?? 'SHOP_NOW',
      },
    }
```

Add this private helper beside `requireNonEmpty()`:

```ts
function requireBundleImageHash(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error('Image launch requires imageHash or a successful image upload');
  }
  return value.trim();
}
```

- [ ] **Step 5: Verify partial success and redaction remain intact**

```bash
npx vitest run tests/createEcommerceCampaignBundle.test.ts tests/metaAdsAdapter.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/createEcommerceCampaignBundle.ts src/providers/meta/objectiveLaunchMatrix.ts tests/createEcommerceCampaignBundle.test.ts tests/metaAdsAdapter.test.ts
git commit -m "fix: support image and video website sales launches"
```

---

### Task 8: Protect CPAS/Collaborative Ads under v25

**Files:**
- Modify: `src/providers/meta/objectiveLaunchMatrix.ts`
- Modify: `src/tools/createAdSet.ts`
- Modify: `src/providers/meta/buildCreativeFormatPayload.ts`
- Modify: `src/providers/meta/omnichannelAdCompatibility.ts`
- Test: `tests/createAdSet.test.ts`
- Test: `tests/metaCreativeFormatPayload.test.ts`
- Test: `tests/omnichannelAdCompatibility.test.ts`
- Test: `tests/metaAdsAdapter.test.ts`

**Interfaces:**
- Produces: `sales_catalog` compatibility checks and v25 CPAS regression coverage without changing CPAS into a new objective.

- [ ] **Step 1: Add failing CPAS v25 matrix tests**

Assert:

```ts
const spec = resolveMetaObjectiveLaunchSpec({
  objective: 'OUTCOME_SALES',
  conversionLocation: 'CATALOG',
  creativeFormat: 'catalog',
  apiVersion: 'v25.0',
});
expect(spec).toMatchObject({
  key: 'sales_catalog',
  promotedObjectKind: 'collaborative_catalog',
  destinationType: 'WEBSITE',
});
```

Add table-driven creative regression for `single_image`, `video`, `carousel`, `catalog`, and `collection` in `collaborative_ads` mode. Each row must retain the existing matching product-set and omnichannel requirements.

- [ ] **Step 2: Run CPAS tests and capture failures**

```bash
npx vitest run tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts tests/omnichannelAdCompatibility.test.ts tests/metaAdsAdapter.test.ts
```

- [ ] **Step 3: Integrate matrix validation without replacing existing CPAS builders**

When `mode === 'collaborative_ads'`, require `conversionLocation: 'CATALOG'` for canonical calls, then layer the existing `collaborativeCatalog` promoted object over the resolved `sales_catalog` spec. Preserve:

- product-set access/read preflight;
- pixel/app/object-store fields;
- product-set equality checks;
- omnichannel creative compatibility;
- structured Meta error guidance.

Legacy CPAS calls that already pass explicit objective parameters remain supported
without changing their current response shape.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts tests/omnichannelAdCompatibility.test.ts tests/metaAdsAdapter.test.ts
npm run build
git add src/providers/meta/objectiveLaunchMatrix.ts src/tools/createAdSet.ts src/providers/meta/buildCreativeFormatPayload.ts src/providers/meta/omnichannelAdCompatibility.ts tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts tests/omnichannelAdCompatibility.test.ts tests/metaAdsAdapter.test.ts
git commit -m "test: protect CPAS workflows on Meta v25"
```

---

### Task 9: Add read-back launch audit and marketer-facing orchestration

**Files:**
- Modify: `src/tools/checkLaunchReadiness.ts`
- Modify: `skills/meta-ads/shared/preamble.md`
- Modify: `skills/meta-ads/manage/SKILL.md`
- Modify: `tests/metaAdsAdapter.test.ts`
- Modify: `tests/mcpAdsTools.test.ts`

**Interfaces:**
- Produces: one documented AI workflow that uses the existing create/read/resume tools and a structured PAUSED handoff.

- [ ] **Step 1: Write failing readiness/audit response tests**

Extend `LaunchReadinessResult` with:

```ts
recommendedTools: string[];
creationOrder: ['ads_create_campaign', 'ads_create_adset', 'ads_create_adcreative', 'ads_create_ad'];
verificationTools: ['ads_list_campaigns', 'ads_read_adset_full', 'ads_read_creative_full'];
activationOrder: ['ads_resume_campaign', 'ads_resume_adset', 'ads_resume_ad'];
requiresSecondActivationApproval: true;
```

Assert that every canonical workflow returns this safety metadata and that no readiness result recommends activation before creation/read-back.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
npx vitest run tests/metaAdsAdapter.test.ts tests/mcpAdsTools.test.ts
```

- [ ] **Step 3: Update the shared preamble**

Replace the statement that non-sales creation is unsupported. Document:

- call `ads_check_launch_readiness`;
- discover required assets;
- dry-run all four create tools;
- show marketer summary;
- ask for one creation confirmation;
- execute only PAUSED creation;
- read back campaign/ad set/creative;
- report partial IDs if any step fails;
- ask for a separate activation confirmation;
- activate parent to child.

- [ ] **Step 4: Add a six-objective launch section to the manage skill**

For each canonical workflow, list marketer inputs and the resolved technical setup without requiring the marketer to know Meta field names. Include this exact safety sentence:

> Semua struktur dibuat PAUSED. Saya akan meminta persetujuan terpisah sebelum mengaktifkan campaign, ad set, dan ad.

Document that Messaging, Calls, Quality Leads, broader app-event/value optimization, and additional Advantage+ variants are roadmap items rather than silently supported paths.

- [ ] **Step 5: Verify skill references and commit**

```bash
rg -n "unsupported|website_sales|lead_generation|OUTCOME_" skills/meta-ads
npx vitest run tests/metaAdsAdapter.test.ts tests/mcpAdsTools.test.ts
git diff --check
git add src/tools/checkLaunchReadiness.ts skills/meta-ads/shared/preamble.md skills/meta-ads/manage/SKILL.md tests/metaAdsAdapter.test.ts tests/mcpAdsTools.test.ts
git commit -m "docs: add six-objective Meta launch workflow"
```

---

### Task 10: Update roadmap and run the complete verification loop

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `ROADMAP.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/SELF_HOSTING.md`
- Modify: `docs/DOCKER_MCP.md`
- Modify: `skills/meta-ads/shared/preamble.md`
- Modify only as required by failures: files changed in Tasks 1–9

**Interfaces:**
- Produces: a verified branch and an accurate marketer-readable roadmap.

- [ ] **Step 1: Update the roadmap with shipped and deferred scope**

In `docs/PLAN.md`, add one Meta v25 subsection containing:

- six ODAX baseline workflows;
- PAUSED creation and second activation approval;
- CPAS v25 regression;
- v23/v24 explicit compatibility;
- deferred Messaging, Calls, broader Catalog/CPAS, app events/value/re-engagement, Ad Recall Lift, Quality Leads/CRM, and additional Advantage+ variants.

Do not mark a baseline workflow complete until its focused tests and full suite pass.

Mirror the marketer-facing milestones and deferred variants in `ROADMAP.md`.
Change documented defaults from v20/v23 to v25 in `README.md`, `.env.example`,
`docs/SELF_HOSTING.md`, `docs/DOCKER_MCP.md`, and the shared skill preamble.
If `.env.example` does not yet contain the setting, add
`META_API_VERSION=v25.0` rather than implying that an existing line was changed.
Historical examples in security documentation may remain version-specific when
they illustrate URL construction rather than the runtime default.

- [ ] **Step 2: Update project status using marketer-facing language**

Record:

- which objectives are operational;
- which canonical destination each supports;
- that activation remains separate;
- that live account eligibility still belongs to Meta;
- that no live contract test was run unless separately approved.

- [ ] **Step 3: Format only the touched files**

Run Prettier explicitly so unrelated source files are not rewritten:

```bash
npx prettier --write \
  src/providers/meta/objectiveLaunchMatrix.ts \
  src/providers/meta/buildCreativeFormatPayload.ts \
  src/providers/meta/MetaAdsAdapter.ts \
  src/providers/meta/omnichannelAdCompatibility.ts \
  src/tools/createCampaign.ts \
  src/tools/createAdSet.ts \
  src/tools/checkLaunchReadiness.ts \
  src/tools/launchPresets.ts \
  src/tools/listLeadForms.ts \
  src/tools/createAdCreative.ts \
  src/tools/createEcommerceCampaignBundle.ts \
  src/metaClient.ts \
  src/config.ts \
  src/types.ts \
  src/broker/types.ts \
  src/broker/mcpTools.ts \
  src/mcp/createServer.ts \
  src/index.ts \
  tests/metaObjectiveLaunchMatrix.test.ts \
  tests/config.test.ts \
  tests/createCampaign.test.ts \
  tests/createAdSet.test.ts \
  tests/launchPresets.test.ts \
  tests/listLeadForms.test.ts \
  tests/metaCreativeFormatPayload.test.ts \
  tests/createAdCreative.test.ts \
  tests/createEcommerceCampaignBundle.test.ts \
  tests/metaAdsAdapter.test.ts \
  tests/mcpAdsTools.test.ts \
  tests/mcpServerBuilder.test.ts \
  skills/meta-ads/shared/preamble.md \
  skills/meta-ads/manage/SKILL.md \
  .env.example \
  README.md \
  ROADMAP.md \
  docs/PLAN.md \
  docs/PROJECT_STATUS.md \
  docs/SELF_HOSTING.md \
  docs/DOCKER_MCP.md
```

- [ ] **Step 4: Run static verification**

```bash
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Run focused security and write tests**

```bash
npx vitest run \
  tests/metaObjectiveLaunchMatrix.test.ts \
  tests/createCampaign.test.ts \
  tests/createAdSet.test.ts \
  tests/createAdCreative.test.ts \
  tests/createAd.test.ts \
  tests/createEcommerceCampaignBundle.test.ts \
  tests/credentials.test.ts
```

Expected: PASS and no token-like fixture appears in serialized error output.

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 7: Review the final diff and repository status**

```bash
git diff --stat main...HEAD
git diff --check main...HEAD
git status --short
```

Confirm:

- no `.env` or token files;
- no unrelated formatting;
- no new objective-specific public MCP write tools;
- all create defaults remain PAUSED;
- activation tools were not called;
- docs match shipped behavior.

- [ ] **Step 8: Commit final documentation/hardening**

```bash
git add .env.example README.md ROADMAP.md docs/PLAN.md docs/PROJECT_STATUS.md docs/SELF_HOSTING.md docs/DOCKER_MCP.md skills/meta-ads/shared/preamble.md
git commit -m "docs: roadmap Meta six-objective launch support"
```

- [ ] **Step 9: Request code review**

Use `superpowers:requesting-code-review` against `main...HEAD`. Resolve all high- and medium-confidence correctness, safety, schema-parity, and credential-redaction findings before declaring the branch complete.

---

## Execution Notes

- Each task is independently reviewable and should not be squashed during development.
- If Meta v25 rejects a documented payload during an explicitly approved live test, capture only the redacted code/subcode and update the matrix or capability warning; never copy tokens or signed URLs into fixtures.
- If a canonical combination cannot be created through Marketing API v25 for third-party apps, mark it as capability-limited and move it to the roadmap rather than bypassing validation with raw payloads.
- No live activation is part of this plan.
