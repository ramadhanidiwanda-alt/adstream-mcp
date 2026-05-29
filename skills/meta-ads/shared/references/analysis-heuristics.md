# Analysis Heuristics

Decision trees and rules of thumb for analyzing Meta Ads performance. Apply these when raw metrics need interpretation.

## The Triage Framework

When analyzing any campaign or ad set, ask these questions in order:

### 1. Is tracking working?

Before anything else, verify:
- Are conversion events firing?
- Is the conversion count plausible (not zero, not absurdly high)?
- Does ROAS roughly match what you'd expect from revenue data?

If tracking is broken, **stop analysis** and recommend fixing tracking first. All downstream recommendations are unreliable without good data.

### 2. Is the campaign profitable?

Calculate (requires business context):
```
Headroom $ = (Break-Even CPA - Current CPA) × Monthly Conversions
```

| Headroom | Action |
|----------|--------|
| > $2,000/mo | Scale aggressively |
| $500-$2,000/mo | Scale cautiously |
| $0-$500/mo | Optimize before scaling |
| Negative | Pause or restructure |

If business context is missing, fall back to ROAS:
- ROAS > 3.0x → likely profitable
- ROAS 1.5-3.0x → marginally profitable
- ROAS < 1.5x → likely losing money

### 3. Is the creative working?

Check link CTR against industry benchmark:
- E-commerce: > 1.5% (good), < 0.8% (poor)
- Lead gen: > 2.0% (good), < 1.0% (poor)
- B2B SaaS: > 1.2% (good), < 0.6% (poor)

If CTR is poor:
- Check frequency (> 3.0 = fatigue, refresh creative)
- Check audience (too broad? too narrow?)
- Check creative quality (does it stop the scroll?)

### 4. Is the audience saturated?

Check frequency:
- < 2.0 → healthy, room to scale
- 2.0-3.0 → monitor closely
- > 3.0 → saturation, refresh creative or audience

Check CPM trend:
- Stable or declining → healthy
- Rising 15-30% w/w → warning
- Rising 30%+ w/w → action needed

### 5. Is the budget allocated correctly?

Check distribution:
- Is one ad set carrying > 70% of campaign spend? → fragility risk
- Are multiple ad sets at similar performance? → good diversification
- Are losing ad sets still getting spend? → wasted budget

## Common Diagnoses

### Diagnosis: Creative Fatigue

**Signs:**
- Frequency > 3.0
- CPM rising 30%+ w/w
- CTR falling 20%+ w/w
- ROAS declining

**Action:** Refresh creative. See `creative-fatigue.md` for detailed guidance.

### Diagnosis: Audience Saturation

**Signs:**
- Frequency > 4.0
- Reach plateauing (impressions growing but unique users not)
- CPM rising even with fresh creative

**Action:** Expand audience (broader targeting, new lookalike seed) or rotate to fresh audience.

### Diagnosis: Auction Pressure

**Signs:**
- CPM rising 30%+ w/w
- Frequency stable (< 3.0)
- CTR stable or rising
- Reach growing normally

**Action:** This is competitor pressure, not your problem. Options:
- Bid more aggressively (if profitable headroom allows)
- Shift budget to less competitive times (dayparting)
- Accept higher CPMs as cost of doing business

### Diagnosis: Tracking Drift

**Signs:**
- Reported ROAS doesn't match actual revenue
- Conversion count seems wrong
- iOS conversions specifically dropping (post iOS 14.5)

**Action:** 
- Implement Conversions API (CAPI) if not already
- Improve event match quality (EMQ score)
- Cross-check with Shopify/GA4/server-side data

### Diagnosis: Learning Phase Stuck

**Signs:**
- Ad set in "Learning" status for > 7 days
- < 50 conversions in last 7 days
- Performance erratic

**Action:**
- Consolidate ad sets (combine to hit 50 events/week)
- Move to higher-volume optimization event (e.g., Add to Cart instead of Purchase)
- Increase budget if profitable (more spend = more events = faster learning)

### Diagnosis: Concentration Risk

**Signs:**
- One ad set carrying > 70% of campaign spend
- One creative carrying > 70% of ad set conversions
- Single point of failure

**Action:**
- Diversify by testing additional ad sets/creatives
- Don't pause the winner, but reduce dependency
- Build pipeline of backup creatives

## Decision Trees

### Should I scale this ad set?

```
Is ROAS > break-even by 20%+?
├─ No → Don't scale (fix profitability first)
└─ Yes → Is frequency < 2.5?
    ├─ No → Refresh creative first
    └─ Yes → Is CPM stable or declining?
        ├─ No → Investigate why CPM is rising
        └─ Yes → Scale by +20% (don't exceed)
```

### Should I pause this ad set?

```
Is ROAS < 1.0x for 7+ days?
├─ Yes → Pause immediately (losing money)
└─ No → Is CPA > 2x break-even?
    ├─ Yes → Pause (unlikely to recover)
    └─ No → Is it in learning phase?
        ├─ Yes → Don't pause (give it 7 days)
        └─ No → Is creative fatigued?
            ├─ Yes → Refresh creative, don't pause
            └─ No → Monitor for 7 more days
```

### Should I refresh creative?

```
Is frequency > 3.0?
├─ No → Creative is probably fine
└─ Yes → Is CPM rising 30%+ w/w?
    ├─ No → Audience saturation, not creative fatigue
    └─ Yes → Is CTR falling 20%+ w/w?
        ├─ Yes → Refresh creative immediately
        └─ No → Audience saturation, expand targeting
```

## Anti-Patterns to Avoid

❌ **Adding budget to fatigued ad sets** — accelerates the death spiral
❌ **Pausing ad sets in learning** — wastes the data already collected
❌ **Changing targeting on profitable ad sets** — resets learning, costs $$
❌ **Recommending creative refresh without specifying what to test** — vague advice is useless
❌ **Reporting ROAS without attribution window** — meaningless without context
❌ **Comparing your account to industry benchmarks without considering business context** — a high-AOV business can sustain higher CPAs
❌ **Treating Meta-reported ROAS as ground truth** — typically overstates by 20-40%

## When to Defer to the User

Some decisions require business judgment, not data analysis:

- **Brand vs performance tradeoff** — should we prioritize reach or conversions?
- **Seasonal strategy** — should we double down on Q4 or save budget?
- **New product launch** — willing to spend at break-even for awareness?
- **Competitive response** — should we match competitor bids?

Surface the data, frame the tradeoff, but let the user decide.

## Output Standards

Every analysis output should include:

1. **Verdict** — one-line summary (good/bad/needs work)
2. **Evidence** — specific metrics from the account
3. **Comparison** — vs benchmarks or vs the account's own baseline
4. **Impact** — dollar terms when possible
5. **Action** — specific, implementable recommendation

**Bad:** "Your CTR is low, you should improve creative."

**Good:** "Campaign 'Summer Sale' has link CTR of 0.7%, which is 50% below the e-commerce benchmark of 1.5%. Combined with frequency of 3.8 (up from 2.1 last week), this indicates creative fatigue costing approximately $340/week in lost efficiency. Refresh creative within 48 hours — try UGC-style video to replace the current static product image."
