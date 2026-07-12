---
name: adstream-mcp-tool-design
description: Design or review Adstream MCP public tools, especially analytics and write tools. Use when adding, changing, or evaluating MCP tool contracts, response schemas, dry-run behavior, preflight validation, idempotency, structured provider errors, capability discovery, or deciding whether logic belongs in MCP core versus AI skills.
argument-hint: "<tool or capability to design/review>"
---

# Adstream MCP Tool Design

Use this skill to keep Adstream's MCP surface general-purpose, provider-aware, safe for agents, and free of campaign-specific workflow sprawl.

## Primary Rule

MCP exposes reliable primitives. AI skills compose workflows.

Do not add public MCP tools for daily reports, weekly reports, creative audits, KPI scoring, recommendations, affiliate workflows, top/bottom rankings, or campaign-specific playbooks. Express those as skills over canonical tools unless the provider capability truly cannot be represented by existing contracts.

## Before Adding a Public Tool

Ask these in order:

1. Can `ads_get_performance` cover this with `level`, `metrics`, `dimensions`, `breakdowns`, `filters`, `sortBy`, `sortDirection`, `limit`, and `cursor`?
2. Is this a provider capability or only an analysis/reporting workflow?
3. Can `ads_get_capabilities` expose the limitation instead of a new provider-specific tool?
4. Can provider-native complexity live behind an adapter while the public contract stays canonical?
5. If it mutates provider state, does it belong in the opt-in write surface with dry-run, confirmation, and audit behavior?

Only add a new public tool when the answer shows a real missing primitive.

## Canonical Public Inputs

Prefer these public names:

- `provider`
- `accountId`
- `since`
- `until`
- `level`
- `metrics`
- `dimensions`
- `breakdowns`
- `filters`
- `sortBy`
- `sortDirection`
- `limit`
- `cursor`

Avoid introducing provider-native names such as `adAccountId`, `advertiserId`, `startDate`, or `endDate` in new public contracts. Translate those inside adapters or legacy compatibility layers.

## Standard Write Response Envelope

All write tools should return a consistent normalized envelope:

```json
{
  "operationId": "op_...",
  "provider": "meta",
  "tool": "ads_create_adset",
  "entityType": "adset",
  "entityId": "120...",
  "status": "previewed|validated|executed|failed|partially_executed|verified",
  "executed": false,
  "dryRun": true,
  "preview": {},
  "verification": null,
  "response": {},
  "error": null
}
```

Normalize top-level fields with camelCase. Keep provider-native payloads under `response` or `providerResponse`, not as inconsistent top-level fields such as `image_hash` beside `imageHash`.

## Write Safety Checklist

Every mutation tool must define:

- **Dry-run parity:** dry-run builds the same payload as execute and runs read-only preflight checks where possible.
- **Explicit confirmation:** execution requires `dryRun=false` and `confirmed=true` or the repository's approved equivalent.
- **Preflight validation:** validate account, parent entity, identity/page/asset, status, budget conflicts, permission, and provider constraints before mutation.
- **Idempotency:** support `idempotencyKey`, `externalReference`, or at minimum an explicit dedupe mode such as `dedupeByName=true` for create tools.
- **Audit trail:** return or record `operationId`, tool name, provider, timestamp, dry-run/execute mode, and affected entity IDs.
- **Verification:** when practical, perform read-after-write verification or provide a canonical verification tool path.

## Partial Update Safety

Nested updates default to `patch` semantics. Never replace large nested provider objects such as targeting, promoted objects, or asset feed specs unless the input explicitly requests `replace` and the confirmation states that full overwrite will happen.

Use:

- `mode: "patch"` for merge/update behavior.
- `mode: "replace"` only for deliberate full replacement.

Dry-run previews must show the before/after diff for risky nested changes.

## Structured Errors

Return safe, actionable errors instead of raw provider strings:

```json
{
  "code": "MISSING_PERMISSION",
  "message": "Token does not have write access to this ad account.",
  "providerCode": "200",
  "providerSubcode": null,
  "traceId": "fbtrace_id_or_provider_trace",
  "actionableFix": "Reconnect the account with ads_management permission."
}
```

Differentiate token expired, missing scope, no account access, no asset/page access, object not found, unsupported objective, invalid budget, duplicate name, and provider rate limit. Never expose access tokens, connection keys, authorization headers, or URLs containing secrets.

## Time and Scheduling

Any tool accepting a date-time must normalize and preview:

- original input
- assumed or supplied timezone
- resolved local time
- resolved UTC time

Reject ambiguous scheduling input when timezone affects execution. Dates used for analytics remain `YYYY-MM-DD` with documented account/provider timezone.

## Capability Discovery

Keep `ads_get_capabilities` machine-readable and complete. Include supported providers, levels, metrics, breakdowns, objectives, status values, placements, optimization goals, write tool availability, permission requirements, and provider limitations.

Prefer exposing unsupported capability metadata over adding one-off tools.

## Good vs Bad Boundaries

Good public MCP primitive:

```text
ads_get_performance(provider, accountId, since, until, level, metrics, dimensions, breakdowns, filters)
```

Bad public MCP workflow:

```text
ads_generate_weekly_scaling_recommendations_for_affiliate_campaigns(...)
```

Good write primitive:

```text
ads_update_adset(adSetId, mode="patch", targetingPatch, dryRun=true)
```

Bad write primitive:

```text
ads_optimize_campaign_for_roas(campaignId)
```

## Required References

Before implementing or changing public MCP contracts, check:

- `docs/MCP_API_DESIGN.md`
- `docs/WRITE_SAFETY_CONTRACT.md`
- `docs/LEGACY_AND_MIGRATION.md` when changing legacy/provider-specific surfaces
- `skills/README.md` when deciding whether logic belongs in a skill instead of MCP core
