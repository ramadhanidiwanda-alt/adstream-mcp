# CPAS Catalog Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe Meta MCP tool that creates a paused Sales CPAS catalog bundle with one verified retailer product set.

**Architecture:** Add a narrowly scoped orchestrator beside the existing ecommerce bundle. It composes existing create tools and forces CPAS catalog invariants at the boundary. Wire it through the Meta adapter, broker, MCP registry, and library exports without changing existing contracts.

**Tech Stack:** TypeScript ESM, Vitest, Meta Graph API client, MCP tool registry.

## Global Constraints

- Meta-only; keep the existing unsupported-operation behavior elsewhere.
- Create only `OUTCOME_SALES`, `collaborative_ads`, `CATALOG`, and `PAUSED` objects.
- One public `productSetId` is copied to all internal payload positions.
- Default dry run; execution needs `dryRun: false` and `confirmed: true`.
- No real Meta writes in automated tests and no token/error leakage.
- No bypass of omnichannel or creative-family preflight.
- No automatic delete/archive rollback.

## Files

- Create `src/tools/createCpasCatalogCampaignBundle.ts`: input/result types, preflight, preview, orchestration, and verification.
- Modify `src/providers/meta/MetaAdsAdapter.ts`: parse and route the request.
- Modify `src/broker/AdsBroker.ts`: broker write method.
- Modify `src/broker/mcpTools.ts`: schema, registry, and dispatch.
- Modify `src/index.ts`: public exports.
- Modify `tests/support/adapter.ts`: adapter stub.
- Create `tests/createCpasCatalogCampaignBundle.test.ts`: mocked client tests.
- Modify `tests/metaAdsAdapter.test.ts` and `tests/mcpAdsTools.test.ts`: integration boundaries.

### Task 1: Contract and dry-run preview

**Files:** Create `src/tools/createCpasCatalogCampaignBundle.ts`; create `tests/createCpasCatalogCampaignBundle.test.ts`.

- [ ] Write a failing dry-run test:

```ts
const result = await createCpasCatalogCampaignBundle(client, validPayload);
expect(result).toMatchObject({ status: 'dry_run', executed: false });
expect(client.metaPost).not.toHaveBeenCalled();
expect(result.preview.adSet.promoted_object).toMatchObject({ product_set_id: 'ps_1' });
expect(result.preview.creative.product_set_id).toBe('ps_1');
```

- [ ] Run `npx vitest run tests/createCpasCatalogCampaignBundle.test.ts`; confirm module failure.
- [ ] Define payload/options/preview/result types and pure `buildCpasCatalogBundlePreview(payload)`.
- [ ] Build campaign as Sales/collaborative/paused, ad set as catalog/paused, a typed catalog creative, and a paused ad.
- [ ] Re-run the test; confirm no POST.
- [ ] Commit with `feat: define CPAS catalog bundle contract`.

### Task 2: Read-only catalog preflight

**Files:** Modify the new tool and its test.

- [ ] Write failing tests for blank product set, unreadable product set, `product_count: 0`, manual creative format, invalid collection, and incomplete app destination.
- [ ] Mock `GET /{productSetId}?fields=id,name,product_catalog,product_count`.
- [ ] Run focused tests; confirm failures.
- [ ] Implement `validateCpasCatalogPayload` and `readCollaborativeProductSet`.
- [ ] Return structured `failed` results with stage `preflight` and codes `MISSING_CPAS_PRODUCT_SET`, `UNREADABLE_CPAS_PRODUCT_SET`, `EMPTY_CPAS_PRODUCT_SET`, `INVALID_CPAS_COLLECTION`, or `UNSUPPORTED_CPAS_CATALOG_APP_COMBINATION`.
- [ ] Re-run tests; commit with `feat: validate CPAS catalog bundle preflight`.

### Task 3: Paused orchestration and partial failure

**Files:** Modify the new tool and its test.

- [ ] Write failing tests for confirmation gate, successful four-step creation, and one failure after each creation stage.
- [ ] Assert partial failure returns earlier IDs and does not call later POSTs.
- [ ] Run focused tests; confirm failures.
- [ ] Compose `createCampaign`, `createAdSet`, `createAdCreative`, and `createAd` in order, each with `status: PAUSED`, `dryRun: false`, and `confirmed: true`.
- [ ] Pass the one product set through `collaborativeCatalog.productSetId`, `collaborativeProductSetId`, and `creativeSpec.productSetId`.
- [ ] Return stage, IDs, and sanitized error; never issue archive/delete.
- [ ] Re-run tests; commit with `feat: create paused CPAS catalog bundles`.

### Task 4: Read-back verification

**Files:** Modify the new tool and its test.

- [ ] Write failing tests for a verified response and for mismatched ad-set product set or ad/creative mapping.
- [ ] Implement read-only verification of product set, IDs, relationships, and paused statuses.
- [ ] Return `stage: verification` with retained IDs if any check fails.
- [ ] Re-run focused tests; commit with `feat: verify CPAS catalog bundle read-back`.

### Task 5: Adapter and broker routing

**Files:** Modify `src/providers/meta/MetaAdsAdapter.ts`, `src/broker/AdsBroker.ts`, `tests/support/adapter.ts`, and `tests/metaAdsAdapter.test.ts`.

- [ ] Write failing adapter tests for parsing, default dry run, and Meta-only routing.
- [ ] Add `createCpasCatalogCampaignBundle` to `MetaAdsAdapterTools`, adapter defaults, and the adapter method.
- [ ] Add the broker method and `AdapterWriteMethod` entry so existing permission policy applies.
- [ ] Parse explicit types with existing helpers and forward only `dryRun` and `confirmed`.
- [ ] Re-run adapter tests; commit with `feat: route CPAS catalog bundle through Meta broker`.

### Task 6: MCP registry and package API

**Files:** Modify `src/broker/mcpTools.ts`, `src/index.ts`, and `tests/mcpAdsTools.test.ts`.

- [ ] Write failing discovery, dispatch, required-field, and default-dry-run tests.
- [ ] Register `ads_create_cpas_catalog_bundle` and add the dispatch branch.
- [ ] Require account, names, Page, product set, budget, countries, and catalog copy.
- [ ] Expose only `catalog` and `collection`; do not expose bypass flags.
- [ ] Export the function and public types from `src/index.ts`.
- [ ] Re-run MCP tests; commit with `feat: expose CPAS catalog bundle MCP tool`.

### Task 7: Verification and release gate

**Files:** Only fix files required by verification.

- [ ] Run focused tests: `npx vitest run tests/createCpasCatalogCampaignBundle.test.ts tests/metaAdsAdapter.test.ts tests/mcpAdsTools.test.ts`.
- [ ] Run `npm run test && npm run lint && npm run build`.
- [ ] Run `git diff --check && git status --short`; inspect for scope and token-like data.
- [ ] Commit verified final fixes with `test: verify CPAS catalog bundle workflow`.

## Coverage Check

Tasks 1–3 cover single-source product-set mapping, paused creation, confirmation, and failure behavior. Task 4 covers read-back. Tasks 5–6 cover the public MCP route and permission boundary. Task 7 covers build/test quality. No live Meta write is included; any later production validation requires a separately approved dry-run followed by explicit paused execution.
