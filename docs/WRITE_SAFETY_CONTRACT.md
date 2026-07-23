# Write Safety Contract

**Status:** Active for all write operations.
**Last updated:** 2026-07-09

This contract defines the minimum safety behavior for every Meta Ads mutation exposed by the library, broker, MCP server, or AI skills.

---

## 1. Capability Boundary

### ✅ Supported — Batch 1 (Foundation Write)

Full campaign creation lifecycle with pre-flight validation:

| Tool | Domain | Pre-flight | CTWA |
|------|--------|------------|------|
| `ads_create_campaign` | Campaign | None (campaign-level params validated at schema) | — |
| `ads_create_adset` | Ad Set | Campaign fetch (CBO conflict, bid strategy requirement, `targeting_automation`) | — |
| `ads_create_adcreative` | Creative | None (page/link/media validated at Meta) | ✅ `destinationType`, `pageWelcomeMessage`, `whatsappPhoneNumberId` |
| `ads_create_ad` | Ad | None (adset + creative existence validated at Meta) | — |
| `ads_upload_image` | Media | File existence, type (jpg/png), size (< 30MB) | — |
| `ads_upload_video` | Media | File existence, type, size (< 1GB) | — |
| `ads_get_ad_preview` | Preview | None (read-only render check) | — |

### ✅ Supported — Batch 2 (Light Mutation)

Safe single-entity status/name changes:

| Tool | Entity | Risk |
|------|--------|------|
| `ads_pause_campaign` | Campaign | Low |
| `ads_resume_campaign` | Campaign | Low |
| `ads_pause_adset` | Ad Set | Low |
| `ads_resume_adset` | Ad Set | Low |
| `ads_pause_ad` | Ad | Low |
| `ads_resume_ad` | Ad | Low |
| `ads_rename_campaign` | Campaign | Low |
| `ads_rename_adset` | Ad Set | Low |
| `ads_rename_ad` | Ad | Low |
| `ads_archive_ad` | Ad | Low (permanent — see §13) |
| `ads_update_ad` | Ad | Medium (name/status/creative swap; see §12a) |
| `ads_update_campaign` | Campaign | Medium (name/status/budget/schedule; see §12a) |

### ✅ Supported — Batch 3 (Budget Write)

Budget changes with mandatory safety limits:

| Tool | Safety Limit |
|------|--------------|
| `ads_update_campaign_budget` | Max increase 30% by default; >100% requires explicit override |
| `ads_update_adset_budget` | Max increase 30% by default; >100% requires explicit override |
| `ads_update_adset_targeting` | Dry-run only; confirms diff before execution |

### 🔜 Planned — Batch 4 (Targeting & Bid Write)

Higher-risk mutations requiring additional validation:

| Tool | Status |
|------|--------|
| `ads_update_adset_bid_strategy` | Not implemented |
| `ads_update_adset_optimization` | Not implemented |
| Batch mutations | Not implemented |
| Rollback mutations | Not implemented |

---

## 2. Required Write Lifecycle

Every write operation MUST follow this lifecycle:

1. **Intent discovery** — confirm objective, scope, and mode before write planning.
2. **Permission check** — verify the resolved credential allows writes.
3. **Preview** — fetch current entity state and produce a before/after diff.
4. **Dry run** — return the preview without mutating by default.
5. **Explicit confirmation** — require a separate user confirmation after preview.
6. **Exact execution** — execute only the confirmed operation and entity.
7. **Audit result** — return an audit entry with status `executed` or `failed`.
8. **Sanitized response** — redact secrets from all success and error responses.

Execution MUST never happen in the same assistant response that first proposes the mutation.

---

## 3. Mode Semantics

| Mode | Mutates? | Requirements |
|------|:--------:|--------------|
| `analyze_only` | No | Read data and summarize findings only |
| `recommend_only` | No | Rank recommended actions, no mutation tool calls |
| `dry_run_mutation` | No | Produce preview/audit diff for supported operations |
| `execute_after_confirmation` | Yes | Requires prior dry run plus explicit confirmation |

Agents MUST NOT infer `execute_after_confirmation` from vague commands like "optimize", "fix", "improve", or "scale".

---

## 4. Confirmation Contract

A confirmation is valid ONLY when all fields are unambiguous:

- Provider
- Account ID
- Entity type
- Entity ID
- Operation
- Payload values
- Dry-run preview timestamp or equivalent preview reference

**Insufficient confirmation examples:**
- "ok" after a broad list of suggested changes
- "do it" when multiple entities are shown
- "optimize all bad campaigns"
- Confirmation given before a dry-run preview

---

## 5. Audit Contract

Every mutation workflow MUST return or create an audit entry with:

- `timestamp`
- `operation`
- `entityType`
- `entityId`
- `before` (where applicable — always for updates, omitted for creates)
- `after`
- `fields`
- `status`
- `error` (when failed)

Valid statuses:

- `dry_run`
- `pending_confirmation`
- `executed`
- `failed`

Audit entries MUST NOT include access tokens, provider tokens, connection keys, OAuth tokens, authorization headers, or raw request URLs containing secrets.

---

## 6. Permission Contract

Write operations MUST pass through the broker permission policy before adapter execution.

Required behavior:

- Missing write permission returns `WRITE_NOT_ALLOWED`.
- Cross-provider writes fail closed as not implemented.
- Provider adapters MUST NOT bypass broker credential resolution for MCP/broker write paths.
- Local direct library helpers may exist, but MCP-exposed writes MUST use broker permission checks.

---

## 7. Budget Safety Contract

Budget changes require stricter validation than status/name changes:

- Budget MUST be positive.
- Budget MUST be in provider minor units when using Meta campaign budget tools.
- Budget increase MUST respect the configured maximum increase threshold.
- **Default maximum increase:** 30%.
- **Override threshold:** >100% requires explicit user override in the confirmation.
- The dry-run preview MUST show old and new budget values.
- Future batch budget tools MUST reuse the same max-increase semantics unless a stricter limit is chosen.

---

## 8. Error and Redaction Contract

All errors returned through broker/MCP surfaces MUST be sanitized.

**Never expose:**
- Meta access tokens
- Cuan Insight provider tokens
- Connection Keys
- OAuth access tokens
- Authorization headers
- Full URLs containing `access_token`
- Raw request/response payloads that include secrets

**Errors should be actionable but safe:**

- `MISSING_CAMPAIGN_ID`
- `MISSING_REQUIRED_PARAMS`
- `WRITE_NOT_ALLOWED`
- `UNSUPPORTED_OPERATION`
- `PROVIDER_NOT_REGISTERED`

---

## 9. Pre-flight Validation Contract

For entity creation tools (especially `ads_create_adset`), the tool MUST perform pre-flight checks before calling the Meta API:

- **CBO budget conflict:** If parent campaign has `daily_budget` or `lifetime_budget`, reject ad-set-level budget with a clear error.
- **Bid strategy requirement:** If parent campaign uses `COST_CAP`, `LOWEST_COST_WITH_BID_CAP`, or `TARGET_COST`, require `bidAmount` on the ad set.
- **Invalid bid strategy values:** Reject `LOWEST_COST` (invalid) — suggest `LOWEST_COST_WITHOUT_CAP`.
- **MIN_ROAS bid constraints:** If `bid_strategy = LOWEST_COST_WITH_MIN_ROAS`, require `bidConstraints.roas_average_floor`.

Pre-flight errors MUST be returned BEFORE any Meta API call with an actionable message.

---

## 10. Error Subcode Mapping

Meta API errors carry subcodes that SHOULD be mapped to human-readable messages:

| Subcode | Message |
|---------|---------|
| `1815857` | "Bid amount required. Add bidAmount or use LOWEST_COST_WITHOUT_CAP." |
| `1815198` | "Frequency cap is immutable. Set it during ad set creation." |
| `1885154` | "promoted_object/page_id required for this engagement ad set." |
| `1815715` | "destination_type is incompatible with this campaign objective." |
| `1885621` | "bid_amount value is invalid or too low." |
| `2446149` | "Unsupported bid_strategy and bid_amount combination." |
| `4834011` | "special_ad_categories required for this campaign/objective combination." |

---

## 11. Media Upload Operations

Media upload (`ads_upload_image`, `ads_upload_video`) are write operations with a modified lifecycle:

- **No dry-run preview:** File content cannot be meaningfully previewed. Validation (file exists, type, size) is done inline.
- **Direct execution:** Upload executes on confirmed call; no separate dry-run step.
- **File validation:** Checks file existence, type (jpg/png for images, mp4/mov/avi/wmv for videos), and size limits (30MB images, 1GB videos) before hitting Meta API.
- **Error handling:** File validation errors return immediately without API call. Meta API errors include descriptive messages.
- **No audit entry:** Upload operations return the result directly; standalone uploads do not create audit log entries.
- **Bundle integration:** When used via `createEcommerceCampaignBundle.imageFilePath`/`videoFilePath`, upload happens at execution time (after dry-run preview + confirmation of the bundle).

---

## 12. Recommended Next Sequence

Once Batch 1–3 are stable:

1. Add `ads_update_adset_bid_strategy` and `ads_update_adset_optimization` (Batch 4).
2. Add batch pause/resume by campaign or account.
3. Add rate-limit guards per account per hour.
4. Add blacklist/whitelist for high-risk entities.
5. Add budget schedule tools (start/end time + budget allocation).

All Batch 4 and beyond additions MUST update this contract and pass the existing test suite before merging.

---

## 12a. `ads_update_ad` / `ads_update_campaign` Notes

Added alongside `ads_update_adset` as the general update tools for Ad and
Campaign entities. Both follow the same dry-run/confirm lifecycle as every
other write tool in this contract (§2).

- **`ads_update_ad` creative swap:** `creativeId` points an existing ad at a
  different, already-created creative — the supported way to change
  UTM/tracking parameters on a live ad, since Meta only accepts `url_tags`
  at creative-creation time. After a successful swap, the tool reads back
  `/{ad_id}?fields=creative` and reports the confirmed creative id in the
  result; this read-back is best-effort and does not fail the operation if
  it errors.
- **`ads_update_campaign` budget guard:** `lifetimeBudget` and `spendCap`
  reuse the exact increase-safety guard from `ads_update_campaign_budget`
  (fetch current value, reject if the new value exceeds
  `current * (1 + maxBudgetIncrease)`, default `maxBudgetIncrease` 2.0).
- **`ads_update_campaign` delete guard:** `status: "DELETED"` additionally
  requires `deleteConfirmed: true` in the same request, mirroring the
  `replaceTargetingConfirmed` pattern `ads_update_adset` uses for its own
  dangerous sub-operation. Without it, the tool returns `status: "failed"`
  and does not call the Meta API. `status: "ARCHIVED"` is **not** a safer
  alternative — see §13.
- **`objective` is not exposed** on `ads_update_campaign` — Meta treats it
  as effectively immutable once a campaign has ads.

---

## 13. Destructive Actions Contract (ARCHIVED / DELETED)

Since Meta's Oct 2014 status-semantics change, `ARCHIVED` and `DELETED` are
equally permanent for campaigns, ad sets, and ads: neither can be reverted
back to `ACTIVE`/`PAUSED` via the API. They differ only in query and quota
behavior (`ARCHIVED` objects stay queryable as edges and count against a
50,000-per-type-per-account limit; `DELETED` objects don't), not in
reversibility. Treat any tool call that sets either status as equally
irreversible.

- **Gated tools:** `ads_archive_ad` (always), `ads_update_ad` with
  `status: "ARCHIVED"`, `ads_update_campaign` with `status: "ARCHIVED"` or
  `"DELETED"`.
- **Kill switch:** `ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS` (default `false`,
  independent of `ADSTREAM_ENABLE_WRITES`). While off, calls to the tools
  above are rejected before dispatch with a `DESTRUCTIVE_ACTIONS_DISABLED`
  error, even with `dryRun`/`confirmed` set — this is an operator-level
  gate, not something a caller can talk its way past.
  `ads_get_capabilities` reports current state under `destructiveActions`.
- **Still required when the switch is on:** the standard dry-run/confirm
  lifecycle (§2) applies on top of the kill switch — `ads_archive_ad`
  follows it the same way `ads_update_ad`/`ads_update_campaign` do.
