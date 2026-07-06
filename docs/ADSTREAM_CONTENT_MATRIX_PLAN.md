# Adstream Content Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple, data-only `ads_content_matrix` MCP tool that returns normalized ad/creative performance grouped by campaign or adset for AI-generated ads reports.

**Architecture:** The MCP tool should reuse the existing AdsBroker provider abstraction and normalized `AdsMetricRecord` rows. It should not add KPI targets, hardcoded business rules, recommendations, or consulting-style diagnosis; AI skills can analyze the returned data later.

**Tech Stack:** TypeScript ESM, existing `AdsBroker`, existing MCP tool registration, Vitest.

## Global Constraints

- Keep the tool provider-agnostic; Meta is the first source, but the contract must work for TikTok/Google normalized rows later.
- Keep the tool read-only; do not mutate campaigns, budgets, ads, or creatives.
- Use `.js` extensions in TypeScript imports.
- Do not log access tokens, full signed URLs, or raw provider payloads in MCP responses.
- Skip KPI targets for this MVP.
- Skip automated recommendations, status labels, winner/loser labels, and rule-based diagnosis in MCP output.
- Default comparison mode is `previous_period` when `since` and `until` are present.
- Campaign name is enough for SKU/product context in MVP; no campaign-to-SKU mapping table is required.

---

### Task 1: Define Content Matrix Types

**Files:**
- Modify: `src/broker/types.ts`

**Interfaces:**
- Consumes: existing `AdsMetricRecord`, `AdsProviderId`, `AdsMetricDimensions`, `AdsCreativeMetadata`.
- Produces: `AdsContentMatrix`, `AdsContentMatrixGroup`, `AdsContentMatrixRow`, `AdsContentMatrixMetric`, `AdsContentMatrixComparison`, `AdsContentMatrixDataQuality`.

- [ ] **Step 1: Add data-only content matrix types**

Add these exports near the existing report types in `src/broker/types.ts`:

```ts
export type AdsContentMatrixGroupBy = 'campaign' | 'adset';
export type AdsContentMatrixSortDirection = 'asc' | 'desc';
export type AdsContentMatrixComparisonMode = 'previous_period' | 'none';

export interface AdsContentMatrixMetric {
  key: string;
  value: number | null;
  unit: 'currency' | 'count' | 'percentage' | 'ratio' | 'seconds';
  source: 'observed' | 'calculated';
  numerator?: number | null;
  denominator?: number | null;
  formula?: string;
  available: boolean;
}

export interface AdsContentMatrixComparison {
  key: string;
  current: number | null;
  previous: number | null;
  absolute_change: number | null;
  percentage_change: number | null;
}

export interface AdsContentMatrixDataQuality {
  has_spend: boolean;
  has_impressions: boolean;
  has_clicks: boolean;
  has_conversion: boolean;
  has_creative_asset: boolean;
  notes: string[];
}

export interface AdsContentMatrixRow {
  provider: AdsProviderId;
  account_id: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_or_adgroup_id?: string;
  adset_or_adgroup_name?: string;
  ad_id?: string;
  ad_name?: string;
  creative_id?: string;
  creative_name?: string;
  content: AdsCreativeMetadata;
  metrics: AdsContentMatrixMetric[];
  comparison?: AdsContentMatrixComparison[];
  data_quality: AdsContentMatrixDataQuality;
}

export interface AdsContentMatrixGroup {
  group_by: AdsContentMatrixGroupBy;
  group_id: string;
  group_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_or_adgroup_id?: string;
  adset_or_adgroup_name?: string;
  summary_metrics: AdsContentMatrixMetric[];
  top_rows: AdsContentMatrixRow[];
  bottom_rows: AdsContentMatrixRow[];
  rows?: AdsContentMatrixRow[];
}

export interface AdsContentMatrix {
  provider: AdsProviderId;
  report_kind: 'content_matrix';
  date_range: {
    since: string;
    until: string;
  };
  comparison?: {
    mode: AdsContentMatrixComparisonMode;
    date_range?: {
      since: string;
      until: string;
    };
  };
  group_by: AdsContentMatrixGroupBy;
  sort: {
    metric: string;
    direction: AdsContentMatrixSortDirection;
  };
  groups: AdsContentMatrixGroup[];
  coverage: {
    rows: number;
    groups: number;
    has_creative_assets: boolean;
    notes: string[];
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run build`

Expected: build succeeds or only fails on unrelated existing issues.

---

### Task 2: Build Content Matrix Data Transformer

**Files:**
- Create: `src/broker/contentMatrix.ts`
- Test: `tests/contentMatrix.test.ts`

**Interfaces:**
- Consumes: `AdsMetricRecord[]` and optional previous-period `AdsMetricRecord[]`.
- Produces: `buildAdsContentMatrix(records, options): AdsContentMatrix`.

- [ ] **Step 1: Write focused tests**

Create `tests/contentMatrix.test.ts` with tests for:

```ts
import { describe, expect, it } from 'vitest';
import { buildAdsContentMatrix } from '../src/broker/contentMatrix.js';
import type { AdsMetricRecord } from '../src/broker/types.js';

function record(overrides: Partial<AdsMetricRecord>): AdsMetricRecord {
  return {
    provider: 'meta',
    level: 'ad',
    identity: {
      account_id: 'act_1',
      campaign_id: 'cmp_1',
      campaign_name: 'PNP Acne Serum',
      adset_or_adgroup_id: 'adset_1',
      adset_or_adgroup_name: 'Broad',
      ad_id: 'ad_1',
      ad_name: 'Before After Video',
      creative_id: 'creative_1',
      creative_name: 'Before After Creative',
    },
    time: { date_start: '2026-07-01', date_stop: '2026-07-07' },
    delivery: { spend: 100000, impressions: 10000, reach: 8000, cpm: 10000 },
    clicks: { clicks: 200, ctr: 2, cpc: 500 },
    commerce: { purchases: 10, purchase_value: 300000, cost_per_purchase: 10000, purchase_roas: 3 },
    creative: { creative_type: 'video', thumbnail_url: 'https://example.com/thumb.jpg' },
    ...overrides,
  };
}

describe('buildAdsContentMatrix', () => {
  it('groups ad rows by campaign and returns top and bottom rows by selected metric', () => {
    const matrix = buildAdsContentMatrix([
      record({ identity: { ...record({}).identity, ad_id: 'ad_1', ad_name: 'A' }, commerce: { purchase_roas: 3 } }),
      record({ identity: { ...record({}).identity, ad_id: 'ad_2', ad_name: 'B' }, commerce: { purchase_roas: 1 } }),
    ], {
      provider: 'meta',
      since: '2026-07-01',
      until: '2026-07-07',
      groupBy: 'campaign',
      sortBy: 'purchase_roas',
      sortDirection: 'desc',
      topLimit: 1,
      bottomLimit: 1,
    });

    expect(matrix.groups).toHaveLength(1);
    expect(matrix.groups[0].top_rows[0].ad_id).toBe('ad_1');
    expect(matrix.groups[0].bottom_rows[0].ad_id).toBe('ad_2');
  });

  it('does not create recommendations or diagnosis fields', () => {
    const matrix = buildAdsContentMatrix([record({})], {
      provider: 'meta',
      since: '2026-07-01',
      until: '2026-07-07',
      groupBy: 'campaign',
    });

    expect(JSON.stringify(matrix)).not.toContain('recommendation');
    expect(JSON.stringify(matrix)).not.toContain('diagnosis');
  });
});
```

- [ ] **Step 2: Implement transformer**

Create `src/broker/contentMatrix.ts` with:

```ts
export function buildAdsContentMatrix(
  records: AdsMetricRecord[],
  options: BuildAdsContentMatrixOptions
): AdsContentMatrix
```

The implementation must:
- group by `campaign_id` when `groupBy` is `campaign`
- group by `adset_or_adgroup_id` when `groupBy` is `adset`
- default `sortBy` to `spend`
- default `sortDirection` to `desc`
- default `topLimit` and `bottomLimit` to `3`
- include all rows only when `includeAllRows` is true
- calculate `ctr`, `cpc`, `cpm`, `purchase_roas`, and `cost_per_purchase` with numerator/denominator when source values are absent
- return data quality booleans only, not judgments

- [ ] **Step 3: Run focused tests**

Run: `npm run test -- tests/contentMatrix.test.ts`

Expected: PASS.

---

### Task 3: Add MCP Tool Routing

**Files:**
- Modify: `src/broker/mcpTools.ts`
- Modify: `src/broker/AdsBroker.ts`
- Modify: `src/broker/types.ts`
- Test: `tests/mcpAdsTools.test.ts`

**Interfaces:**
- Consumes: `ads_content_matrix` MCP args.
- Produces: broker response with `AdsContentMatrix` data.

- [ ] **Step 1: Add tool name and definition**

Add `ads_content_matrix` to `ADS_MCP_TOOL_NAMES` and `ADS_MCP_TOOL_DEFINITIONS` with `since` and `until` required.

- [ ] **Step 2: Add broker method**

Add this method to `AdsBroker`:

```ts
async getContentMatrix(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsContentMatrix>>
```

The method should fetch `getAdPerformance(request)`, then call `buildAdsContentMatrix` with `request.params.groupBy`, `sortBy`, `sortDirection`, `topLimit`, `bottomLimit`, and `includeAllRows`.

- [ ] **Step 3: Route MCP call**

Add a switch case in `callBrokerMethod`:

```ts
case 'ads_content_matrix':
  return broker.getContentMatrix(request);
```

- [ ] **Step 4: Update MCP tests**

Update `tests/mcpAdsTools.test.ts` to expect the new tool name and verify it routes to `getContentMatrix`.

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- tests/mcpAdsTools.test.ts tests/contentMatrix.test.ts`

Expected: PASS.

---

### Task 4: Verify Build

**Files:**
- No code changes.

**Interfaces:**
- Consumes: all changed TypeScript files.
- Produces: verified build/test status.

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Run relevant tests**

Run: `npm run test -- tests/contentMatrix.test.ts tests/mcpAdsTools.test.ts`

Expected: PASS.

---

## Self-Review

- Spec coverage: KPI target is intentionally excluded; content matrix is data-only; default comparison decision is documented for future extension.
- Placeholder scan: no `TBD`, `TODO`, or implementation gaps are required for MVP beyond explicit future comparison fetching.
- Type consistency: content matrix type names use `AdsContentMatrix*`; MCP tool name is `ads_content_matrix`; broker method is `getContentMatrix`.

