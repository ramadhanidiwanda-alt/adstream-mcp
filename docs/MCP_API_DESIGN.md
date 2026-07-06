# MCP API Design

This document defines the target public MCP API for `adstream-mcp`. It is a design contract for future changes; it does not remove existing public tools by itself.

Implementation note: `ads_get_performance`, `ads_get_creatives`, and `ads_get_capabilities` are now present as non-breaking canonical entry points. `ads_get_performance` routes to existing level-specific broker methods and wraps successful rows in the standard performance envelope. `ads_get_capabilities` combines canonical static metadata with registered provider adapter capabilities.

## Design Principles

1. Prefer fewer tools with stronger input and output contracts.
2. One data need should have one main tool path.
3. Public MCP tools should be provider-agnostic when possible.
4. Provider-specific details belong in adapters or explicitly documented extensions.
5. Reports and recommendations belong in AI/skills, not MCP core.
6. Legacy tools remain available until a documented migration is approved.
7. Write tools are opt-in and separate from read-only analytics.

## Canonical Public Tools

| Tool | Purpose | Status |
|---|---|---|
| `ads_list_accounts` | List accessible ads accounts for a provider | Canonical |
| `ads_list_campaigns` | List campaigns with identity/status metadata | Canonical |
| `ads_get_performance` | Fetch normalized performance rows at account/campaign/adset/ad/creative level | Canonical wrapper implemented |
| `ads_get_creatives` | Fetch creative assets and creative metadata/metrics | Canonical wrapper implemented |
| `ads_get_change_history` | Fetch provider change history when available | Meta account activities fetch implemented; unsupported providers return structured `NOT_IMPLEMENTED` |
| `ads_get_capabilities` | Discover supported levels, metrics, breakdowns, writes, and provider limitations | Canonical static discovery implemented |
| `commerce_get_performance` | Fetch normalized commerce/SKU/order/product performance when available | Canonical |

Optional write tools:

| Tool | Purpose | Boundary |
|---|---|---|
| `ads_pause_campaign` | Pause one campaign | Requires write contract |
| `ads_resume_campaign` | Resume one campaign | Requires write contract |
| `ads_update_campaign_budget` | Update one campaign budget | Requires write contract |
| `ads_rename_campaign` | Rename one campaign | Requires write contract |

Do not add new public tools for report formats such as daily reports, weekly reports, creative audits, KPI scoring, or recommendations. Implement those as skills that call canonical data tools.

## Standard Analytics Input Contract

Analytics tools should use public names consistently:

| Field | Meaning |
|---|---|
| `provider` | Provider identifier such as `meta`, `tiktok`, or `google` |
| `accountId` | Public account identifier used by the MCP contract |
| `since` | Inclusive start date, `YYYY-MM-DD` |
| `until` | Inclusive end date, `YYYY-MM-DD` |
| `level` | Entity level: `account`, `campaign`, `adset`, `adgroup`, `ad`, `creative` |
| `metrics` | Requested normalized metric names |
| `dimensions` | Requested normalized dimensions |
| `breakdowns` | Provider-supported breakdowns such as date, country, platform, placement |
| `filters` | Explicit filter objects over normalized fields |
| `sortBy` | Metric or dimension used for sorting |
| `sortDirection` | `asc` or `desc` |
| `limit` | Maximum rows to return |
| `cursor` | Opaque pagination cursor from the previous response |

Avoid new public inputs like `adAccountId`, `advertiserId`, `startDate`, and `endDate`. Provider adapters may translate `accountId` into native terms internally.

Provider-specific extension fields should be named and documented. Use `params` only as an escape hatch for provider functionality that cannot yet be normalized.

## Standard Performance Response Envelope

Canonical performance tools return a consistent envelope. Legacy level-specific tools may still return legacy response shapes during migration.

```json
{
  "provider": "meta",
  "account": {
    "id": "act_123",
    "name": "Example Brand"
  },
  "dateRange": {
    "since": "2026-06-29",
    "until": "2026-07-05",
    "timezone": "Asia/Jakarta"
  },
  "currency": "IDR",
  "level": "campaign",
  "dimensions": ["campaign"],
  "metrics": ["spend", "impressions", "clicks", "purchases", "purchase_value"],
  "rows": [],
  "paging": {
    "nextCursor": null
  },
  "warnings": [],
  "dataFreshness": {
    "retrievedAt": "2026-07-06T00:00:00.000Z"
  },
  "capabilities": {},
  "unsupportedMetrics": []
}
```

Add attribution and data-source metadata when providers expose it. If SKU, sales, offline conversion, or conversion mapping data is unavailable, the response must say so through `warnings`, `capabilities`, or explicit null/empty fields. Do not infer unavailable commerce data.

## Pagination

- `cursor` is opaque and provider-neutral.
- `paging.nextCursor` is `null` when there are no additional rows. Meta ads performance and change history pass through Meta cursor values; TikTok ads and GMV Max commerce use the next page number as an opaque cursor; Google currently reports `null` because the current SearchStream path returns the requested result stream without a follow-up cursor.
- Tools should avoid exposing provider-native paging tokens unless wrapped in the opaque cursor.
- `limit` should be documented per tool and bounded to safe provider/API limits.

## Warnings

Warnings are non-fatal limitations the AI should surface or consider:

```json
{
  "code": "UNSUPPORTED_METRIC",
  "message": "purchase_value is not available for this provider/level.",
  "field": "metrics.purchase_value",
  "severity": "warning"
}
```

Use warnings for unsupported metrics, partial data, unavailable breakdowns, attribution limitations, delayed reporting, and missing commerce mappings.

## Errors

Fatal errors should be structured and sanitized:

```json
{
  "error": {
    "code": "PROVIDER_PERMISSION_DENIED",
    "message": "The resolved credential cannot access this account.",
    "provider": "meta",
    "retryable": false
  }
}
```

Never include access tokens, full signed URLs, or raw provider responses containing secrets.

## Capability Discovery

`ads_get_capabilities` lets AI clients discover canonical metadata, metric catalogs, and registered adapter capabilities:

- supported providers;
- supported levels;
- supported metrics and dimensions;
- supported breakdowns;
- attribution metadata availability;
- data freshness behavior;
- supported write operations;
- known limitations and provider-specific extension fields.

Capability discovery should be the preferred alternative to creating many provider-specific tools.

## Naming Rules

Before adding a public tool, ask:

1. Is this a new provider capability, or only a report/analysis workflow?
2. Can `ads_get_performance` satisfy this with `level`, `dimensions`, `breakdowns`, and `filters`?
3. Can a skill explain the workflow instead of adding core logic?
4. Does this require provider-specific behavior that belongs behind an adapter?
5. Does this mutate state and therefore belong in the opt-in write surface?

Do not add a new tool if the need can be met by `ads_get_performance` plus explicit parameters.
