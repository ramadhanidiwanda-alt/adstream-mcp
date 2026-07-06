# Adstream Skills

Skills are instruction and heuristic layers for AI agents. They are not the MCP core contract.

The core rule is:

```text
MCP provides data; AI and skills provide reasoning.
```

A skill may teach an AI how to audit performance, build a weekly report, compare periods, identify top/bottom creative, or explain limitations. It should do that by calling generic data tools such as `ads_get_performance`, `ads_get_creatives`, and `commerce_get_performance`, not by requiring new report-specific MCP tools.

## Boundary

| Layer | Responsibility |
|---|---|
| MCP core | Data access, normalized schemas, pagination, warnings, capabilities, safe writes |
| Skills | Step-by-step analysis workflow, formulas, interpretation guidance, caveats |
| AI client | User-specific reasoning, narrative, recommendation wording, brand context |

Do not use skills as a reason to move recommendation logic into MCP core. If a workflow can be expressed as instructions over canonical data tools, keep it in skills.

## Current Skill Families

- `meta-ads/` — Meta Ads audit, management, launch, and shared references.
- `tiktok-ads/` — TikTok Ads audit instructions and shared references.

These skills may still reference legacy provider-specific tools. As canonical tools mature, prefer generic tool calls in new or updated skill instructions.

## Example: Weekly Report Skill Pattern

A weekly report skill should call canonical data tools and let the AI synthesize the report:

1. Call `ads_list_accounts` if the account is not known.
2. Call `ads_get_performance` for the current period with `level: "campaign"`.
3. Call `ads_get_performance` for the comparison period with the same `metrics`, `dimensions`, and `filters`.
4. Optionally call `ads_get_performance` with `level: "ad"` or `level: "creative"` to inspect top/bottom creatives.
5. Optionally call `commerce_get_performance` when SKU/product/order data is available.
6. Read `warnings`, `unsupportedMetrics`, `capabilities`, and `dataFreshness` before making claims.
7. Produce narrative, insights, caveats, and recommendations in the AI response.

Example canonical request shape:

```json
{
  "provider": "meta",
  "accountId": "act_123",
  "since": "2026-06-29",
  "until": "2026-07-05",
  "level": "campaign",
  "metrics": ["spend", "impressions", "clicks", "purchases", "purchase_value"],
  "dimensions": ["campaign"],
  "breakdowns": ["date"],
  "limit": 100
}
```

The skill should not request a dedicated `weekly_report`, `creative_audit`, `recommendation`, `kpi_score`, or `top_bottom_content` MCP tool. Those are AI workflows over data.

## Extending Skills

When adding or updating a skill:

1. Prefer canonical tools from `docs/MCP_API_DESIGN.md`.
2. State required inputs, comparison windows, metrics, and caveats explicitly.
3. Tell the AI to inspect warnings and unsupported metrics before interpreting data.
4. Keep brand-specific assumptions in the skill or user context, not MCP core.
5. Avoid instructions that require hidden write actions; writes must follow `docs/WRITE_SAFETY_CONTRACT.md`.

## Skills vs Library

| Aspect | Skills | MCP / library |
|---|---|---|
| Interface | Natural language instructions | TypeScript and MCP tool contracts |
| Owns | Workflow, heuristics, interpretation | Data access, schemas, adapters, safety |
| Changes | Markdown iteration | Code, tests, releases |
| Output | AI-authored narrative | Structured provider data |

See `docs/ARCHITECTURE.md`, `docs/MCP_API_DESIGN.md`, and `docs/LEGACY_AND_MIGRATION.md` for the target architecture and migration path.
