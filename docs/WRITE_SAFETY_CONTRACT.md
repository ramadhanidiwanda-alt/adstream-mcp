# Write Safety Contract

**Status:** Active for campaign write operations; required for v0.6.0 adset/ad write operations.
**Last updated:** 2026-07-01

This contract defines the minimum safety behavior for any Meta Ads mutation exposed by the library, broker, MCP server, or AI skills.

## Capability Boundary

### Supported today

Campaign-level mutations are supported when the connected server exposes the broker write tools:

- Pause campaign
- Resume campaign
- Update campaign daily budget
- Rename campaign

### Not supported yet

These remain out of scope until explicitly implemented and tested:

- Pause/resume ad sets
- Pause/resume ads
- Rename ad sets
- Rename ads
- Update ad set budgets
- Batch mutations
- Rollback mutations
- Targeting changes
- Creative upload
- Campaign/ad set/ad creation

Unsupported operations must fail closed with a clear limitation message. They must not fall back to direct API calls, inferred endpoints, or generic mutation helpers.

## Required Write Lifecycle

Every write operation must follow this lifecycle:

1. **Intent discovery** — confirm objective, scope, and mode before write planning.
2. **Permission check** — verify the resolved credential allows writes.
3. **Preview** — fetch current entity state and produce a before/after diff.
4. **Dry run** — return the preview without mutating by default.
5. **Explicit confirmation** — require a separate user confirmation after preview.
6. **Exact execution** — execute only the confirmed operation and entity.
7. **Audit result** — return an audit entry with status `executed` or `failed`.
8. **Sanitized response** — redact secrets from all success and error responses.

Execution must never happen in the same assistant response that first proposes the mutation.

## Mode Semantics

| Mode | Mutates? | Requirements |
|---|---:|---|
| `analyze_only` | No | Read data and summarize findings only |
| `recommend_only` | No | Rank recommended actions, no mutation tool calls |
| `dry_run_mutation` | No | Produce preview/audit diff for supported operations |
| `execute_after_confirmation` | Yes | Requires prior dry run plus explicit confirmation |

Agents must not infer `execute_after_confirmation` from vague commands like “optimize”, “fix”, “improve”, or “scale”.

## Confirmation Contract

A confirmation is valid only when all fields are unambiguous:

- Provider
- Account ID
- Entity type
- Entity ID
- Operation
- Payload values
- Dry-run preview timestamp or equivalent preview reference

Examples of insufficient confirmation:

- “ok” after a broad list of suggested changes
- “do it” when multiple entities are shown
- “optimize all bad campaigns”
- confirmation given before a dry-run preview

## Audit Contract

Every mutation workflow must return or create an audit entry with:

- `timestamp`
- `operation`
- `entityType`
- `entityId`
- `before`
- `after`
- `fields`
- `status`
- `error` when failed

Valid statuses:

- `dry_run`
- `pending_confirmation`
- `executed`
- `failed`

Audit entries must not include access tokens, provider tokens, connection keys, OAuth tokens, authorization headers, or raw request URLs containing secrets.

## Permission Contract

Write operations must pass through the broker permission policy before adapter execution.

Required behavior:

- Missing write permission returns `WRITE_NOT_ALLOWED`.
- Cross-provider writes fail closed as not implemented.
- Provider adapters must not bypass broker credential resolution for MCP/broker write paths.
- Local direct library helpers may exist, but MCP-exposed writes must use broker permission checks.

## Budget Safety Contract

Budget changes require stricter validation than status/name changes:

- Budget must be positive.
- Budget must be in provider minor units when using Meta campaign budget tools.
- Budget increase must respect the configured maximum increase threshold.
- The dry-run preview must show old and new budget values.
- Future ad set budget tools must reuse the same max-increase semantics unless a stricter limit is chosen.

## Error and Redaction Contract

All errors returned through broker/MCP surfaces must be sanitized.

Never expose:

- Meta access tokens
- Cuan Insight provider tokens
- Connection Keys
- OAuth access tokens
- Authorization headers
- Full URLs containing `access_token`
- Raw request/response payloads that include secrets

Errors should be actionable but safe, for example:

- `MISSING_CAMPAIGN_ID`
- `MISSING_REQUIRED_PARAMS`
- `WRITE_NOT_ALLOWED`
- `UNSUPPORTED_OPERATION`
- `PROVIDER_NOT_REGISTERED`

## v0.6.0 Implementation Gate

Before adding adset/ad write operations, the implementation must prove:

- Existing campaign write tests still pass.
- New adset/ad write tools support dry-run previews before execution.
- Broker methods enforce write permission before adapter calls.
- MCP tools expose precise schemas for entity IDs and payloads.
- Unsupported write operations fail closed.
- Tests cover dry run, execution, missing params, permission denial, and sanitized errors.

## Media Upload Operations

Media upload (`ads_upload_image`, `ads_upload_video`) are write operations with a modified lifecycle:

- **No dry-run preview:** File content cannot be meaningfully previewed. Validation (file exists, type, size) is done inline.
- **Direct execution:** Upload executes on confirmed call; no separate dry-run step.
- **File validation:** Checks file existence, type (jpg/png for images, mp4/mov/avi/wmv for videos), and size limits (30MB images, 1GB videos) before hitting Meta API.
- **Error handling:** File validation errors return immediately without API call. Meta API errors include descriptive messages.
- **No audit entry:** Upload operations return the result directly; standalone uploads do not create audit log entries.
- **Bundle integration:** When used via `createEcommerceCampaignBundle.imageFilePath`/`videoFilePath`, upload happens at execution time (after dry-run preview + confirmation of the bundle).

## Recommended v0.6.0 Sequence

1. Add adset/ad pause and resume direct tools.
2. Add adset/ad rename direct tools.
3. Add adset budget update only after status/name mutations are stable.
4. Extend broker interfaces and Meta adapter methods.
5. Expose MCP tools with precise schemas.
6. Update `meta-ads-manage` supported-operation language.
7. Add batch, rollback, blacklist, whitelist, and rate-limit guards in a later phase.
