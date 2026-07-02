# Provider Onboarding Guide

> **Status:** Phase 0 foundation guide
> **Last Updated:** 2026-07-01
> **Scope:** Adding ads or commerce providers to `adstream-mcp`

This guide defines the minimum contract for adding a provider adapter without weakening credential safety, MCP stability, or normalized reporting.

---

## 1. Provider Readiness Checklist

Before writing code, confirm:

- [ ] Provider API access is legally available for the target account/workspace.
- [ ] Credential ownership and refresh model are understood.
- [ ] Cuan Insight can resolve the provider credential at request time.
- [ ] Required entities are mapped: account, campaign, ad group/adset, ad, creative, or commerce store/SKU.
- [ ] Rate limits and pagination behavior are documented.
- [ ] Write/create permissions are explicitly separate from read permissions.

Do not add write/create operations until read, normalization, redaction, and capability gating are stable.

---

## 2. Adapter Steps

1. **Add provider id**
   - Extend `ADS_PROVIDER_IDS` in `src/broker/types.ts` only when the adapter is ready to register.
   - Add provider capability data to `ADS_PROVIDER_CAPABILITY_MATRIX` in the same file.

2. **Create provider folder**
   - Use `src/providers/<provider>/`.
   - Recommended files:
     - `<Provider>AdsAdapter.ts`
     - `normalizer.ts`
     - Optional provider-specific client if no reusable client exists.

3. **Implement `AdsProviderAdapter`**
   - Required methods: accounts, campaigns, account/campaign/adgroup/ad/creative performance, placement performance, campaign write methods.
   - Unsupported methods must fail closed with `NOT_IMPLEMENTED`, not throw raw provider errors.
   - `capabilities` must come from `ADS_PROVIDER_CAPABILITY_MATRIX`.

4. **Normalize provider data**
   - Ads metrics map to `AdsMetricRecord`.
   - Commerce/GMV metrics map to the future `CommerceRecord` contract.
   - Keep provider `raw` data optional and ensure MCP responses strip it before returning.

5. **Register provider**
   - Add adapter registration in `createDefaultProviderRegistry()` in `src/broker/factory.ts`.
   - Ensure remote credential resolution supports the provider before exposing it publicly.

6. **Export public API**
   - Export adapter, normalizer, and useful types from `src/index.ts`.
   - Keep ESM `.js` import paths.

7. **Add tests**
   - Unit tests for normalizer edge cases.
   - Adapter tests with mocked provider client/data.
   - Credential and redaction tests for provider-specific error shapes.
   - Capability matrix test to confirm expected categories and operations.

8. **Update docs**
   - Update `docs/PLAN.md` capability matrix if provider status changes.
   - Update `ROADMAP.md` and `docs/PROJECT_STATUS.md` when capability ships.
   - Add provider setup notes if credentials require special handling.

---

## 3. Required Safety Rules

- Never log access tokens, refresh tokens, connection keys, authorization headers, raw request URLs with secrets, or provider tokens.
- Never return raw provider credentials in MCP responses.
- Redact errors through `redactErrorMessage()` / `redactTokenLikeValues()` before surfacing them.
- Keep write/create operations behind broker permission checks; provider adapters must not bypass credential resolution.
- Write/create operations must follow `docs/WRITE_SAFETY_CONTRACT.md`.

---

## 4. Capability Matrix Expectations

Provider capabilities should be honest and conservative:

- `operations: ['read']` until write support is implemented and tested.
- Include `reports` only when provider data can feed report generation.
- Include `diagnostics` only when errors/statuses are normalized enough for agent use.
- Use `NOT_IMPLEMENTED` for unsupported methods even if the provider API could theoretically support them.

Current source of truth: `ADS_PROVIDER_CAPABILITY_MATRIX` in `src/broker/types.ts`.

---

## 5. Report Integration

Ads reporting and commerce reporting are separate by design:

- **Ads report** — lead, awareness, traffic, sales, and other campaign objectives.
- **Commerce/GMV data surface** — normalized JSON for GMV, orders, SKU/store performance, TikTok GMV Max, and marketplace sales ads. The MCP returns records/totals/metadata/warnings; the AI client writes the narrative report.

Do not force commerce-only metrics into ads report semantics unless the metric has a clear ads equivalent.

---

## 6. Provider Launch Levels

Use these levels to communicate status:

| Level | Meaning | Public Exposure |
|---|---|---|
| `experimental` | Adapter/normalizer exists with mock tests only | Internal or opt-in |
| `read_beta` | Read methods work with real credentials, write disabled | Public read tools allowed |
| `report_ready` | Provider feeds ads or commerce report engine | Public report tools allowed |
| `write_beta` | Write methods follow safety contract | Opt-in with confirmation |
| `create_beta` | Create flow supports preview/confirm/audit | Restricted, RBAC required |
| `stable` | Production-ready docs, tests, redaction, and monitoring | Default public |

---

## 7. Minimal Adapter Skeleton

```typescript
import type { AdsProviderAdapter, AdsBrokerRequest, AdsBrokerResponse } from '../../broker/types.js';
import { ADS_PROVIDER_CAPABILITY_MATRIX } from '../../broker/types.js';

export class ExampleAdsAdapter implements AdsProviderAdapter {
  readonly id = 'example' as const;
  readonly displayName = 'Example Ads';
  readonly capabilities = ADS_PROVIDER_CAPABILITY_MATRIX.example;

  async listAccounts(request: AdsBrokerRequest): Promise<AdsBrokerResponse> {
    // Resolve credential from request.credentials; never read global secrets here.
    return { ok: false, provider: this.id, errors: [{ provider: this.id, code: 'NOT_IMPLEMENTED', message: 'Example provider is not implemented yet' }] };
  }

  // Implement all required adapter methods, returning NOT_IMPLEMENTED until ready.
}
```

The skeleton is illustrative; `example` must not be added to `ADS_PROVIDER_IDS` until a real provider adapter is being implemented.
