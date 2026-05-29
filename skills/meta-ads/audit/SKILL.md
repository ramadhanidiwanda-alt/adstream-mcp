---
name: meta-ads-audit
description: Meta Ads (Facebook + Instagram) account audit and business context setup. Run this first — it gathers business information, analyzes account health, and saves context that all other Meta ads skills reuse. Trigger on "audit my Meta ads", "audit my Facebook ads", "Meta ads audit", "set up my Meta ads", "Meta account overview", "how's my Meta account", "Meta health check", or when the user is new and hasn't run an audit before.
argument-hint: "<account name or 'audit my Meta ads'>"
---

# Meta Ads Audit

Diagnose Meta (Facebook + Instagram) account health and persist business context for downstream analysis. **Read-only** — never mutates the account.

## Setup

Follow `../shared/preamble.md` — MCP detection, config resolution, ad account selection.

## Filesystem contract (MUST persist)

| Artifact | Path | When |
|---|---|---|
| Business context | `{data_dir}/business-context.json` | First full audit, or refresh when `audit_date` is >90 days old |
| Personas | `{data_dir}/personas.json` | Every full audit |
| Account baseline | `{data_dir}/account-baseline.json` | Every audit (for anomaly detection) |

These are the handoff to future analysis — write them even if the report itself is short. Otherwise downstream analysis operates without business context and produces generic output.

**business-context.json schema:**
```json
{
  "business_name": "string",
  "industry": "string",
  "website": "string",
  "services": ["string"],
  "locations": ["string"],
  "target_audience": "string",
  "brand_voice": {
    "tone": "string",
    "words_to_use": ["string"],
    "words_to_avoid": ["string"]
  },
  "differentiators": ["string"],
  "competitors": ["string"],
  "seasonality": {
    "peak_months": ["string"],
    "slow_months": ["string"],
    "seasonal_hooks": ["string"]
  },
  "unit_economics": {
    "aov_usd": 0,
    "profit_margin": 0,
    "ltv_usd": 0,
    "source": "user_provided | estimated"
  },
  "meta_funnel_events": {
    "top_of_funnel": "string",
    "mid_of_funnel": "string",
    "conversion": "string"
  },
  "notes": "string",
  "audit_date": "ISO 8601",
  "account_id": "string"
}
```

**personas.json schema:**
```json
{
  "account_id": "string",
  "saved_at": "ISO 8601",
  "personas": [
    {
      "name": "string",
      "demographics": "string",
      "primary_goal": "string",
      "pain_points": ["string"],
      "decision_trigger": "string",
      "value": "string",
      "creative_angles": ["string"],
      "visual_cues": ["string"]
    }
  ]
}
```

**account-baseline.json schema:**
```json
{
  "account_id": "string",
  "last_updated": "ISO 8601",
  "campaigns": {
    "<campaignId>": {
      "name": "string",
      "objective": "string",
      "rolling30d": {
        "avgDailySpend": 0,
        "totalPurchases": 0,
        "purchaseValue": 0,
        "avgCpa": 0,
        "avgRoas": 0,
        "avgCpm": 0,
        "avgLinkCtr": 0,
        "avgFrequency": 0
      },
      "recent7d": {
        "spend": 0,
        "purchases": 0,
        "purchaseValue": 0,
        "cpa": 0,
        "roas": 0,
        "cpm": 0,
        "linkCtr": 0,
        "frequency": 0
      },
      "snapshotDate": "ISO 8601"
    }
  }
}
```

## Phase 1 — Pull the audit dataset

Use the available MCP tools to gather data. Make parallel calls when possible to reduce latency.

A complete audit needs at minimum:

1. **Campaigns** — Get all campaigns from last 90 days
   - Call: `getCampaigns` with appropriate filters
   - Fields needed: id, name, status, objective, daily_budget, lifetime_budget

2. **Campaign Insights** — Performance data for last 30 days
   - Call: `getCampaignInsights` with date range
   - Fields needed: spend, impressions, reach, clicks, ctr, cpc, cpm, frequency
   - Actions: purchases, leads, or primary conversion event
   - Breakdowns: none (campaign-level aggregate)

3. **Ad Set Insights** — Performance by ad set for last 30 days
   - Call: `getAdsetInsights` with date range
   - Same fields as campaign insights
   - This reveals which ad sets are carrying the load

4. **Ad Insights** — Creative-level performance for last 30 days
   - Call: `getAdsInsights` with date range
   - Same fields plus creative info
   - This reveals creative fatigue patterns

Make these calls in parallel where the MCP server supports it. If not, make them sequentially but cache results.

## Phase 2 — Analyze the data

### Campaign Health Scorecard

Score each dimension 0–5:

| Score | Label | Meaning |
|---|---|---|
| 0 | Critical | Immediate action required |
| 1 | Poor | Significant opportunity |
| 2 | Needs Work | Several clear issues |
| 3 | Acceptable | Functional, room to improve |
| 4 | Good | Well-managed, minor opportunities |
| 5 | Excellent | Best-practice |

**Dimensions to score:**

1. **Spend Efficiency**
   - 5: ROAS > 4.0x or CPA < break-even by 50%+
   - 4: ROAS 2.5-4.0x or CPA < break-even by 20-50%
   - 3: ROAS 1.5-2.5x or CPA near break-even
   - 2: ROAS 1.0-1.5x or CPA 20% above break-even
   - 1: ROAS 0.5-1.0x or CPA 50% above break-even
   - 0: ROAS < 0.5x or CPA 100%+ above break-even

2. **Creative Performance**
   - Check link CTR against benchmarks (see `../shared/meta-math.md`)
   - Check frequency (> 3.0 = fatigue risk)
   - Check CPM trend (rising 30%+ w/w = saturation)

3. **Budget Allocation**
   - Are top-performing campaigns getting enough budget?
   - Are underperforming campaigns wasting spend?
   - Is there concentration risk (one ad set > 70% of spend)?

4. **Campaign Structure**
   - Are campaigns organized by objective?
   - Are ad sets testing meaningful variables?
   - Is there audience overlap between ad sets?

5. **Conversion Tracking**
   - Are conversion events firing?
   - Is attribution window appropriate?
   - Are there gaps in the funnel?

### Encoded heuristics — apply these

- **Frequency × CPM trend = creative diagnosis.** Frequency > 3.0 with CPM rising ≥ 30% w/w is fatigue — recommend creative refresh, not budget cuts.
- **One ad set carrying > 70% of a campaign is fragility.** When it fatigues, the campaign collapses.
- **CTR below industry benchmark + high frequency = creative problem.** See `../shared/meta-math.md` for benchmarks.
- **ROAS systematically overstates true ROAS.** Cross-check Meta-reported numbers against actual revenue where possible. The gap is typically 20–40% in ecom.
- **Rising CPM without frequency increase = auction pressure.** Competitors are bidding up, or audience is too narrow.

## Phase 3 — Business context

Derive what you can from the data already pulled:

| Field | Source |
|---|---|
| `business_name` | Ad account name |
| `services` | Top campaigns by spend, ad set names |
| `locations` | Targeting geo (if available in ad set data) |
| `brand_voice` | Top-performing ad copy (if available) |
| `meta_funnel_events.conversion` | Most common optimization event |
| `website` | Landing page URLs from ads |

Then ask the user for what cannot be derived:

**Essential (always ask):**
- Differentiators (what makes you different from competitors?)
- Competitors (who are you competing against?)
- **AOV + profit margin** (essential for ROAS-aware scoring)

**Optional (ask only if data + crawl can't answer):**
- Seasonality (peak months, slow months)
- Target audience description
- Brand voice guidelines

## Phase 4 — Personas

Discover 2–3 personas from:
- Top-spending audiences (if available in targeting data)
- Top-converting creative angles (from ad performance)
- Landing page content (if you can fetch it)

Each persona must be grounded in **observable evidence** — no inventing. If you can't derive personas from data, ask the user to describe their top 2-3 customer types.

## Phase 5 — Account baseline

Update `{data_dir}/account-baseline.json` for anomaly detection across sessions.

For each campaign with spend > $0 in last 30 days:
1. Calculate `recent7d` metrics from the insights data
2. If baseline exists, update `rolling30d = (0.7 × previous_rolling30d) + (0.3 × recent7d × (30/7))`
3. If no baseline, initialize `rolling30d` from `recent7d` directly

Cap at 50 campaigns (top spenders only) so the file stays small.

When a metric in `recent7d` differs from `rolling30d` by more than 30%, that's an anomaly to surface in the report.

## Phase 6 — Report

Lead with the verdict, then the top 3 actions (with dollar impact when possible), then the scorecard, then evidence for dimensions scoring 0–2 only. Cite specific campaigns, ad sets, and dollar amounts. Cap at ~80 lines.

**Report structure:**

```
# Meta Ads Audit — [Business Name]

**Verdict:** [One-line summary of account health]

**Top 3 Actions:**
1. [Action with dollar impact] — saves/gains $X/month
2. [Action with dollar impact] — saves/gains $Y/month
3. [Action with dollar impact] — saves/gains $Z/month

**Scorecard:**
| Dimension | Score | Status |
|-----------|-------|--------|
| Spend Efficiency | X/5 | [Label] |
| Creative Performance | X/5 | [Label] |
| Budget Allocation | X/5 | [Label] |
| Campaign Structure | X/5 | [Label] |
| Conversion Tracking | X/5 | [Label] |

**Overall Score:** X/25

---

## Findings

[Only include dimensions scoring 0–2]

### [Dimension Name] — Score X/5

**Evidence:**
- [Specific campaign/ad set name]: [metric] is [value] ([comparison to benchmark])
- [Another specific example]

**Impact:** $X/month wasted or $Y/month opportunity

**Recommendation:** [Specific action to take]

---

## Next Steps

Your business context and personas have been saved to `{data_dir}/`. 

To act on these recommendations, use `/meta-ads-manage` or make changes directly in Meta Ads Manager.

To see daily performance updates, use `/meta-ads-daily-report`.
```

## Guardrails

1. **Read-only skill.** Diagnose; don't mutate. Every fix routes through user action or `/meta-ads-manage`.
2. **Always persist** `business-context.json`, `personas.json`, and `account-baseline.json` even if the report itself is short — downstream skills depend on them.
3. **Name names.** Every finding cites specific campaigns, ad sets, and dollar amounts. "Some ad sets are underperforming" is not a finding.
4. **Never report Meta-reported ROAS without footnoting the modeled-conversion premium.** "ROAS 3.2× (Meta-reported — typically overstates actual ROAS by 20–40%)" is honest. "ROAS 3.2×" is misleading.
5. **Ground in data.** Every recommendation must cite specific metrics from the audit dataset. No generic advice.
