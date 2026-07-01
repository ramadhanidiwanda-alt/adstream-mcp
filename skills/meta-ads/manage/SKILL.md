---
name: meta-ads-manage
description: Analyze and provide recommendations for Meta Ads campaigns. Use for performance analysis, optimization suggestions, and ongoing management. Trigger on "analyze my Meta ads", "how are my campaigns doing", "optimize my Meta ads", "show performance", or any performance-related questions.
argument-hint: "<campaign name or 'show performance'>"
---

# Meta Ads — Analyze and Recommend

This skill analyzes Meta Ads performance and provides actionable recommendations. It's the analytical brain that turns raw insights into informed decisions.

## Setup

Follow `../shared/preamble.md` — MCP detection, config resolution, ad account selection.

## Intent Discovery Gate

Before calling data tools or proposing changes, confirm the user's real objective. This skill is for non-technical marketers, so guide them with choices instead of making them write a full brief.

### When to ask first

Ask at least one clarifying question before analysis or mutation planning unless the user already gave all three:

1. **Objective** — what outcome they want
2. **Scope** — account, campaign, ad set, ad, or timeframe
3. **Mode** — analyze, recommend, dry-run, or execute after confirmation

Do not treat vague requests like "optimize this", "fix my ads", or "make it better" as permission to mutate anything. Clarify intent first.

### First question — single choice

Use this as the default first question:

```text
Sebelum saya ambil data, tujuan utamanya yang mana?
1. Cari masalah performa
2. Cari peluang scaling
3. Turunkan CPA/CPL
4. Buat laporan cepat
5. Siapkan dry-run perubahan campaign
```

If the user already states the objective, skip this and ask the next missing piece.

### Constraint question — multi-select

When the request could lead to recommendations or write operations, ask for constraints. The user may choose multiple:

```text
Constraint apa yang harus saya ikuti? Pilih boleh lebih dari satu:
- Jangan ubah budget
- Jangan pause campaign aktif
- Fokus spend terbesar
- Fokus 7/14/30 hari terakhir
- Prioritaskan ROAS/profit
- Prioritaskan lead volume
```

### Mode selection

Map the user's answer into one mode and state it back before proceeding:

| Mode | Use when | Allowed behavior |
|---|---|---|
| `analyze_only` | User wants to understand performance | Read data, summarize findings, no action plan required |
| `recommend_only` | User wants what to do next | Read data, rank top 3 actions, no mutation calls |
| `dry_run_mutation` | User wants to preview a campaign change | Use supported dry-run write tools only; show before/after and expected impact |
| `execute_after_confirmation` | User explicitly asks to execute a supported campaign change | Run dry-run first, ask for explicit confirmation, then execute only the confirmed change |

Execution requires a separate confirmation after the dry-run result. Never execute in the same response that first proposes the change.

### Scope defaults

If the user does not specify timeframe, default to `last_30d` for strategic analysis and `last_7d` for urgent troubleshooting. If they do not specify entity scope, start at campaign level and drill down only when the data points to an ad set or ad issue.

## Operating principles

1. **Recommend, then explain.** When you spot waste or opportunity, present the finding with evidence and expected impact.
2. **Show numbers in dollars, percentages, and the right denominator.** Format spend as USD, CPM and CPC always cited with context. Use **link** clicks not all-clicks for CTR.
3. **Frequency-first triage.** Before recommending budget changes, check frequency and CPM trend. Cold prospecting at frequency > 3.0 with rising CPM is a creative problem — adding budget makes it worse.
4. **Ground in business context.** If `{data_dir}/business-context.json` exists, use AOV and profit margin to frame recommendations in dollar terms (Headroom $, Break-Even ROAS). If missing, suggest running `/meta-ads-audit` first.

## Reference framework — when to read what

Pick the lens that matches the user's question. Don't pre-load all of these; load on demand.

| The user wants to… | Read |
|---|---|
| Understand profitability, ROAS, break-even | `../shared/meta-math.md` |
| Check if metrics are good/bad for their industry | `../shared/meta-math.md` (benchmarks section) |
| Diagnose creative fatigue | Check frequency + CPM trend + CTR trend |
| Find wasted spend | Compare CPA to break-even, find high-spend low-ROAS campaigns |
| Decide whether to scale | Check Headroom $, frequency, CPM trend |

For business context (AOV, profit margin, brand voice), read `{data_dir}/business-context.json`. If missing or stale (>90 days), suggest `/meta-ads-audit`.

For anomaly detection, read `{data_dir}/account-baseline.json`. Compare recent metrics to rolling averages.

## Common analysis patterns

### Daily Performance Report

When user asks "how did yesterday go" or "show me today's performance":

1. Call `generateDailyReport` with `datePreset: 'yesterday'` or `'today'`
2. Parse the results and present in natural language
3. Highlight anomalies (metrics that changed >30% from baseline)
4. If business context exists, calculate profitability (Headroom $, ROAS vs Break-Even)

**Report structure:**
```
# Meta Ads Performance — [Date]

**Summary:** $X spent, Y conversions, ROAS Z.Zx

**Top Performers:**
- [Campaign name]: $X spent, Y conversions, ROAS Z.Zx

**Underperformers:**
- [Campaign name]: $X spent, Y conversions, ROAS Z.Zx (losing $X/day)

**Anomalies:**
- [Campaign name]: CPM up 45% vs 30-day average (frequency 3.8 — creative fatigue)

**Recommendation:** [Top action to take today]
```

### Campaign Analysis

When user asks about specific campaign(s):

1. Call `getCampaignInsights` for the campaign(s)
2. If they mention ad sets or ads, also call `getAdsetInsights` or `getAdsInsights`
3. Score performance using the rubric from `../shared/meta-math.md`
4. Check for common issues:
   - Creative fatigue (frequency > 3.0, CPM rising, CTR falling)
   - Budget waste (CPA > break-even, low ROAS)
   - Concentration risk (one ad set > 70% of spend)
   - Audience saturation (frequency > 4.0)

**Analysis structure:**
```
# [Campaign Name] Analysis

**Performance:** [Good/Acceptable/Poor]
- Spend: $X (last 30 days)
- ROAS: X.Xx ([above/below] break-even of X.Xx)
- CPA: $X (break-even: $Y)
- Headroom: $X/month ([profitable/losing money])

**Key Metrics:**
- CPM: $X ([trend])
- Link CTR: X.X% ([vs benchmark])
- Frequency: X.X ([status])

**Issues Found:**
1. [Issue with evidence]
2. [Issue with evidence]

**Recommendations:**
1. [Action] — expected impact: $X/month
2. [Action] — expected impact: $Y/month
```

### Find Waste

When user asks "where am I wasting money" or "what should I pause":

1. Call `getCampaignInsights` for all active campaigns (last 30 days)
2. Calculate profitability for each (if business context exists)
3. Identify campaigns/ad sets with:
   - Negative Headroom $ (losing money)
   - ROAS < 1.0x (spending more than earning)
   - High spend + zero conversions
   - CPA > 2x break-even

4. Sort by dollar impact (highest waste first)
5. Present as actionable list

**Report structure:**
```
# Wasted Spend Analysis

**Total Waste:** $X/month across Y campaigns

**Top Offenders:**

1. **[Campaign name]** — losing $X/month
   - Spend: $Y/month
   - ROAS: X.Xx (break-even: Y.Yy)
   - CPA: $X (break-even: $Y)
   - **Action:** Pause or restructure

2. **[Campaign name]** — losing $X/month
   - [Same structure]

**Quick Wins:**
- Pause [N] campaigns → save $X/month immediately
- Refresh creative on [N] campaigns → recover $Y/month
```

### Scale Recommendations

When user asks "what should I scale" or "where should I spend more":

1. Call `getCampaignInsights` for all active campaigns
2. Calculate Headroom $ for each (requires business context)
3. Check frequency and CPM trend (don't scale saturated audiences)
4. Identify campaigns with:
   - Positive Headroom $ > $500/month
   - Frequency < 2.5
   - CPM stable or declining
   - ROAS > break-even by 20%+

5. Sort by Headroom $ (highest opportunity first)
6. Apply 20% scaling rule (don't recommend >20% budget increase)

**Report structure:**
```
# Scale Opportunities

**Total Opportunity:** $X/month across Y campaigns

**Top Candidates:**

1. **[Campaign name]** — $X/month headroom
   - Current spend: $Y/day
   - ROAS: X.Xx (break-even: Y.Yy)
   - Frequency: X.X (healthy)
   - **Action:** Increase budget to $Z/day (+20%) — expected gain: $X/month

2. **[Campaign name]** — $Y/month headroom
   - [Same structure]

**Caution:**
- [Campaign name] has high ROAS but frequency 3.2 — refresh creative before scaling
```

## Tool usage patterns

### Read-only operations

Your MCP server provides these tools:

- `getAdAccounts` — List all ad accounts (use for account selection)
- `getCampaigns` — Get campaigns for an ad account
- `getCampaignInsights` — Get insights for campaigns (most common)
- `getAdsetInsights` — Get insights for ad sets (drill-down)
- `getAdsInsights` — Get insights for individual ads (creative analysis)
- `generateDailyReport` — Automated daily report (convenience wrapper)

**Best practices:**
- Use `datePreset` for common ranges: `'yesterday'`, `'last_7d'`, `'last_30d'`
- Use `timeRange` for custom ranges: `{ since: '2026-05-01', until: '2026-05-28' }`
- Request only the fields you need to reduce API latency
- Make parallel calls when analyzing multiple campaigns

### Guarded write operations

Campaign-level write operations may be available through broker/MCP tools, depending on the connected server. Supported campaign operations are pause, resume, budget update, and rename.

For the full lifecycle and confirmation requirements, follow `../../../docs/WRITE_SAFETY_CONTRACT.md`.

**Rules:**
- Always start with `dry_run_mutation` for write-like requests.
- Show the before/after diff, expected impact, risks, and audit intent.
- Ask for explicit confirmation after the dry-run result.
- Execute only the exact confirmed operation and entity.
- Never expose access tokens, provider tokens, connection keys, or raw authorization headers.

When the user asks for unsupported operations — ad set/ad writes, targeting changes, creative upload, or campaign creation — explain the limitation and offer a safe alternative:

> I can't execute that operation from this skill yet. I can analyze the data, prepare a recommended change, or create a dry-run plan for supported campaign-level operations.

## Conditional handoffs

After analysis, proactively offer the right next action:

- **No business context, or context >90 days old** → "Run `/meta-ads-audit` first to set up business context — it'll make my recommendations more accurate and dollar-specific."
- **Creative fatigue across multiple ad sets** → "You have creative fatigue in [N] ad sets. I can't upload new creatives, but I can help you identify which ones need refresh."
- **First-time user** → "This is your first time using Meta Ads analysis. Run `/meta-ads-audit` to set up your account baseline and business context."

## Anomaly detection

If `{data_dir}/account-baseline.json` exists, compare recent metrics to rolling averages:

```
Recent CPM: $45
Rolling 30d average: $28
Change: +61% (anomaly — investigate)
```

**Anomaly threshold:** >30% change from rolling average

**Common anomaly patterns:**
- CPM spike + frequency spike = creative fatigue
- CPM spike + frequency stable = auction pressure
- CTR drop + frequency spike = creative fatigue
- ROAS drop + no metric change = attribution drift or external factor

## Guardrails

1. **Discovery first.** Confirm objective, scope, and mode before tool calls unless the user already gave all three.
2. **Ground in data.** Every recommendation must cite specific metrics. "Your CPM is high" is not a finding. "Campaign X has CPM $45, which is 50% above the $30 industry benchmark" is a finding.
3. **Use business context when available.** If `business-context.json` exists, frame recommendations in dollar terms (Headroom $, Break-Even ROAS). If missing, use relative terms (ROAS, CPA) and suggest running audit.
4. **Cite attribution window.** Always mention "7DC1DV" or whatever window is used when reporting ROAS/CPA.
5. **Don't over-recommend.** Focus on top 3 actions, not a laundry list. Prioritize by dollar impact.
6. **Mutation safety.** Campaign writes require dry-run, explicit confirmation, and exact-scope execution. Adset/ad writes remain unsupported until v0.6.0.
