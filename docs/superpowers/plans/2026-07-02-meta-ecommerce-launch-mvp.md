# Meta Ecommerce Launch MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a safe end-to-end Meta ecommerce campaign launch bundle that creates a PAUSED campaign, ad set, creative, and ad only after dry-run preview and explicit confirmation.

**Architecture:** Add a focused launch-bundle tool under `src/tools/`, expose it through `MetaAdsAdapter`, `AdsBroker`, and the stable `ads_*` MCP surface. Keep provider-neutral request/response types in `src/broker/types.ts`, and make non-Meta providers return safe `NOT_IMPLEMENTED` responses.

**Tech Stack:** TypeScript ESM, Vitest, MCP broker tool schemas, existing `MetaClient.metaPost()` mutation primitive.

## Global Constraints

- Use `.js` extension in TypeScript imports.
- Do not log access tokens, provider tokens, connection keys, or authorization headers.
- Follow `docs/WRITE_SAFETY_CONTRACT.md` for every mutation: dry-run, explicit confirmation, permission checks, audit-safe output.
- MVP is Meta ecommerce sales only: objective `OUTCOME_SALES`, optimization goal `OFFSITE_CONVERSIONS`, default status `PAUSED` for all created entities.
- Do not implement live publish as default; execution creates draft/paused entities only.

---

### Task 1: Launch Bundle Types and Validation

**Files:**
- Modify: `src/broker/types.ts`
- Create: `src/tools/createEcommerceCampaignBundle.ts`
- Test: `tests/createEcommerceCampaignBundle.test.ts`

**Interfaces:**
- Produces: `EcommerceCampaignBundlePayload`, `EcommerceCampaignBundleResult`, `createEcommerceCampaignBundle(client, payload, options)`.
- Consumes: `MetaClient.metaPost()`.

- [x] Write failing tests for required fields, default PAUSED statuses, and dry-run no POST behavior.
- [x] Implement strict payload validation with safe error messages.
- [x] Build Meta payloads for campaign, ad set, creative, and ad.
- [x] Return an audit-safe preview/result with no token-bearing fields.

### Task 2: Meta Adapter and Broker Surface

**Files:**
- Modify: `src/broker/types.ts`
- Modify: `src/broker/AdsBroker.ts`
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `src/providers/tiktok/TikTokAdsAdapter.ts`
- Modify: `src/providers/google/GoogleAdsAdapter.ts`
- Test: `tests/adsBroker.test.ts`, `tests/metaAdsAdapter.test.ts`

**Interfaces:**
- Produces: `AdsBroker.createEcommerceCampaignBundle(request)`.
- Consumes: existing credential resolver and write permission policy.

- [x] Write failing broker/adapter tests for permission-gated launch bundles.
- [x] Add adapter interface method and broker write route.
- [x] Implement Meta adapter parameter mapping.
- [x] Return `NOT_IMPLEMENTED` from TikTok/Google adapters.

### Task 3: MCP Tool Exposure

**Files:**
- Modify: `src/broker/mcpTools.ts`
- Test: `tests/mcpAdsTools.test.ts`

**Interfaces:**
- Produces: `ads_create_ecommerce_campaign_bundle` MCP tool.
- Consumes: `AdsBroker.createEcommerceCampaignBundle()`.

- [x] Write failing MCP tool definition and handler tests.
- [x] Add schema for account, page, pixel, URL, creative copy, targeting, budget, and confirmation.
- [x] Route tool calls through the broker and sanitize raw response.

### Task 4: Exports, Skills, and Verification

**Files:**
- Modify: `src/index.ts`
- Modify: `skills/meta-ads/shared/preamble.md`
- Create: `skills/meta-ads/launch/SKILL.md`
- Test: package build/test commands.

**Interfaces:**
- Produces: public exports and operator guidance for safe ecommerce launch.

- [x] Export new tool and types from public API.
- [x] Update skill guidance to recognize guarded campaign creation support.
- [x] Add launch skill with sales/ecommerce wizard and explicit confirmation gate.
- [x] Run focused tests, then full build/test if focused tests pass.
