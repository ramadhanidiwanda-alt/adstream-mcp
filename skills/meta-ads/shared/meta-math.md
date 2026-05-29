# Meta Ads Math — Profitability and Performance Calculators

Formulas and interpretation rules used throughout the Meta Ads skills. Load this when a finding needs dollar-denominated impact, profitability framing, or a forecast.

**Priority rule:** When `business-context.json` has `profit_margin` and `aov`, use break-even-based thresholds. Otherwise fall back to account-average heuristics. Never mix the two in a single finding — the framing should be consistent.

Meta is creative-led, paid-social, and bought on impressions, not clicks. CPM is a primary lever (creative quality drives it down); CTR alone is not a goal — landing-page conversion rate and ROAS are.

---

## Core Formulas

```
CPM            = (Spend / Impressions) × 1000
CPC            = Spend / Link Clicks                  (link clicks, NOT all clicks)
CTR (link)     = Link Clicks / Impressions × 100      (use link CTR, not all-CTR)
Hook Rate      = 3-Sec Video Views / Impressions × 100 (video creative)
Hold Rate      = ThruPlays / 3-Sec Video Views × 100   (video creative)
CPA            = Spend / Results                       (results = the optimization event)
ROAS           = Purchase Conversion Value / Spend     (ratio, e.g. 3.5x)
ROAS%          = (Purchase Value - Spend) / Spend × 100
Frequency      = Impressions / Reach
CVR (LP)       = Landing Page Conversions / Landing Page Views × 100
```

**Always disambiguate "CTR" and "clicks" in Meta reports.** Meta surfaces both `clicks (all)` (which counts every click on the ad including profile, like, see-more) and `link clicks` (clicks that send the user to the destination). Optimization decisions use **link** clicks — total clicks are vanity. When pulling from insights, request `inline_link_clicks` and treat that as the real click count.

---

## Profitability Formulas (require margin + AOV)

```
Break-Even ROAS     = 1 / Profit Margin
Break-Even CPA      = AOV × Profit Margin
Max Profitable CPA  = Break-Even CPA                    (bid up to this, no higher)
Unit Profit         = AOV × Profit Margin - CPA
Headroom $          = (Break-Even CPA - Current CPA) × Monthly Conversions
```

**ROAS is the dominant frame for ecom.** Lead-gen and SaaS rely on CPA / CPL. For lead-gen, also compute `Lead-to-Customer Rate × AOV × Profit Margin` if the user has the lead-conversion data — the CPA off the platform is meaningless without a downstream rate.

| Headroom | Framing | Action |
|---|---|---|
| Negative | "Losing $X/month on this ad set" | Pause or restructure immediately |
| $0–$500/mo | "Barely break-even" | Refresh creative; tighten audience before scaling |
| $500–$2,000/mo | "Profitable but tight" | Selective scaling (cautious budget increments) |
| > $2,000/mo | "Strong unit economics" | Scale via duplication or +20% budget steps |

---

## Frequency, Saturation, and Audience Reach

```
Frequency Cap (cold)   ≤ 2.0/week before fatigue
Frequency Cap (warm)   2.0–3.5/week is normal for retargeting
Frequency Cap (red flag) > 4.0/week on cold prospecting
Audience Saturation    Reach / Estimated Audience Size
```

**Fatigue heuristic:** When a campaign's CPM rises ≥30% week-over-week with no creative change AND frequency > 3.0, the audience is saturated. The fix is fresh creative or a fresh audience — raising budget makes it worse.

**Audience size guidance:**

| Audience Size | Viability | Notes |
|---|---|---|
| < 1M | Too narrow for prospecting | Use as a custom-audience seed for lookalikes only |
| 1M–10M | Lookalike sweet spot | Most LAL 1–3% audiences land here |
| 10M–50M | Healthy interest / behavior cold audience | Allow Meta's algorithm room to optimize |
| > 50M | Broad targeting | Often the best for Advantage+ Shopping campaigns |

---

## CTR and CPM Benchmarks

| Industry | Good Link CTR | Acceptable | Poor | Good CPM | High CPM |
|----------|---------------|------------|------|----------|----------|
| E-commerce | > 1.5% | 0.8-1.5% | < 0.8% | < $15 | > $30 |
| Lead Gen | > 2.0% | 1.0-2.0% | < 1.0% | < $20 | > $40 |
| B2B SaaS | > 1.2% | 0.6-1.2% | < 0.6% | < $25 | > $50 |
| Local Services | > 2.5% | 1.5-2.5% | < 1.5% | < $10 | > $25 |

**Context matters:** Holiday season (Q4) CPMs are 40-60% higher. iOS 14.5+ attribution loss means reported ROAS understates true ROAS by 20-40% for ecom.

---

## ROAS Benchmarks by Industry

| Industry | Excellent | Good | Acceptable | Poor |
|----------|-----------|------|------------|------|
| E-commerce | > 4.0x | 2.5-4.0x | 1.5-2.5x | < 1.5x |
| Lead Gen (CPA) | N/A | < $50 | $50-$150 | > $150 |
| B2B SaaS (CPL) | N/A | < $100 | $100-$300 | > $300 |

**Always cite the attribution window** when reporting ROAS or CPA. "ROAS 3.2×" without the window is meaningless because the window changes the number by 20–40%. Default is 7-day click, 1-day view (7DC1DV).

---

## Budget Forecasting

```
Projected Spend       = Daily Budget × Days in Period
Projected Conversions = Projected Spend / Historical CPA
Projected Revenue     = Projected Conversions × AOV
```

Present 3 scenarios, enforcing the **20% scaling rule** — Meta's learning phase resets when you change budget or targeting by more than ~20%, so larger steps cost a relearn:

| Scenario | Budget Change | Risk |
|----------|---------------|------|
| Conservative | +10% | Minimal learning disruption |
| Moderate | +20% | Acceptable (standard scaling) |
| Aggressive | +50% | High risk — may reset learning |

---

## Creative Performance Metrics (Video)

```
Hook Rate      = 3-Sec Video Views / Impressions × 100
Hold Rate      = ThruPlays / 3-Sec Video Views × 100
Completion Rate = Video Plays at 95% / Video Plays at 25% × 100
```

| Hook Rate | Quality |
|-----------|---------|
| > 30% | Excellent |
| 20-30% | Good |
| 10-20% | Acceptable |
| < 10% | Poor — creative not stopping scroll |

| Hold Rate | Quality |
|-----------|---------|
| > 50% | Excellent |
| 30-50% | Good |
| 15-30% | Acceptable |
| < 15% | Poor — losing attention after hook |

---

## When to Use Each Formula

| User Question | Formula to Apply |
|---------------|------------------|
| "Is this campaign profitable?" | Break-Even ROAS, Headroom $ |
| "Should I scale this ad set?" | Headroom $, Frequency, CPM trend |
| "Why is my CPM rising?" | Frequency, Audience Saturation |
| "Is my creative working?" | Hook Rate, Hold Rate, Link CTR |
| "What's a good ROAS for my industry?" | ROAS Benchmarks table |
| "How much can I spend next month?" | Budget Forecasting |

Always ground recommendations in **observable metrics** from the user's account, not just benchmarks. "Your CPM is $45, which is 50% above the $30 industry benchmark" is actionable. "CPM should be lower" is not.
