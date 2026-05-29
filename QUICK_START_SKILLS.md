# Quick Start: Using AI Skills

This is the **simplest way** to use meta-ads-agent-skill. No coding required.

## Setup (5 minutes)

### 1. Install the package

```bash
npm install -g meta-ads-agent-skill
```

Or use it locally in your project:
```bash
npm install meta-ads-agent-skill
```

### 2. Configure MCP Server

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "command": "node",
      "args": ["./node_modules/meta-ads-agent-skill/mcp-server/dist/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "${META_ACCESS_TOKEN}",
        "META_AD_ACCOUNT_ID": "${META_AD_ACCOUNT_ID}"
      }
    }
  }
}
```

### 3. Set Environment Variables

```bash
export META_ACCESS_TOKEN="your_token_here"
export META_AD_ACCOUNT_ID="act_123456789"
```

Or create `.env` file:
```env
META_ACCESS_TOKEN=your_token_here
META_AD_ACCOUNT_ID=act_123456789
```

### 4. Restart Your AI Agent

Restart Claude Code, Claude Desktop, or your MCP-compatible AI agent.

---

## Usage

Just ask your AI agent in natural language:

### First Time: Run Audit

```
You: Audit my Meta ads

AI: [Analyzes your account and provides:]
- Account health scorecard (5 dimensions, 0-5 each)
- Top 3 optimization opportunities with dollar impact
- Specific findings with evidence
- Saves business context for future analysis
```

**What it does:**
- Pulls all campaign, ad set, and ad data
- Scores your account health
- Identifies waste and opportunities
- Asks about your business (AOV, profit margin, etc.)
- Saves context for future sessions

### Daily: Check Performance

```
You: How are my campaigns doing?

AI: [Shows:]
- Performance overview
- Anomalies vs baseline
- Issues detected (creative fatigue, wasted spend)
- Specific recommendations
```

```
You: Show me yesterday's performance

AI: [Generates daily report with:]
- Total spend, conversions, ROAS
- Top performers
- Underperformers
- Anomalies
```

### Find Problems

```
You: Where am I wasting money?

AI: [Identifies:]
- Campaigns losing money (negative headroom)
- High spend, zero conversions
- CPA > 2x break-even
- Sorted by dollar impact
- Quick wins (pause X → save $Y/month)
```

```
You: What should I scale?

AI: [Recommends:]
- Campaigns with positive headroom
- Healthy frequency (< 2.5)
- Stable/declining CPM
- +20% budget increases
- Expected gains in $/month
```

### Analyze Specific Campaign

```
You: Analyze campaign "Summer Sale 2026"

AI: [Deep-dive:]
- Performance vs benchmarks
- Profitability (ROAS vs break-even)
- Creative fatigue check
- Budget allocation
- Specific recommendations
```

---

## What AI Knows About Your Business

After running `/meta-ads-audit`, AI remembers:

- **Business info** — Name, industry, website, services
- **Economics** — AOV, profit margin, LTV
- **Brand voice** — Tone, words to use/avoid
- **Personas** — Customer types, pain points, creative angles
- **Baseline** — Rolling 30-day averages for anomaly detection

This enables **personalized, dollar-denominated recommendations**:
- "Campaign X is losing $340/week (ROAS 1.8x, break-even 2.86x)"
- "Scale Campaign Y by 20% → expected gain $1,200/month"
- "Creative fatigue detected: frequency 3.8, CPM up 55%"

---

## Example Conversation

```
You: Audit my Meta ads

AI: Connected to your Meta Ads account (MyStore).

    3 campaigns active. $2,400 spent this month.

    Scorecard:
    ┌──────────────────────┬──────────┬──────────────────────────────┐
    │ Dimension            │ Status   │ Summary                      │
    ├──────────────────────┼──────────┼──────────────────────────────┤
    │ Spend Efficiency     │ Warning  │ 1 campaign below break-even  │
    │ Creative Performance │ Critical │ 2 ad sets fatigued           │
    │ Budget Allocation    │ Good     │ Well distributed             │
    │ Campaign Structure   │ Good     │ Clear objectives             │
    │ Conversion Tracking  │ OK       │ Events firing correctly      │
    └──────────────────────┴──────────┴──────────────────────────────┘

    Top 3 actions:
    1. Refresh creative on "Summer Sale" campaign — save $340/week
    2. Pause "Winter Promo" ad set — save $210/month
    3. Scale "Spring Collection" by 20% — gain $1,200/month

    Business context saved. I can now provide dollar-specific recommendations.

You: Do the first two actions

AI: I can analyze and recommend, but I cannot make changes directly (read-only).
    
    Here's what to do in Meta Ads Manager:
    
    1. Summer Sale campaign:
       - Go to Ads Manager → Summer Sale campaign
       - Current creative: Static product image (frequency 3.8)
       - Replace with: UGC-style video testimonial
       - Keep ad set running at 50% budget while new creative learns
    
    2. Winter Promo ad set:
       - Go to Ads Manager → Winter Promo campaign → "LAL 1%" ad set
       - Click toggle to pause
       - Reason: ROAS 0.8x (break-even 2.86x), losing $210/month

You: Show me yesterday's performance

AI: Meta Ads Performance — May 28, 2026

    Summary: $82 spent, 12 conversions, ROAS 3.2x

    Top Performers:
    - Spring Collection: $45 spent, 8 conversions, ROAS 4.1x ✅

    Underperformers:
    - Winter Promo: $18 spent, 1 conversion, ROAS 0.9x ⚠️

    Anomalies:
    - Summer Sale: CPM up 45% vs 30-day average (frequency 3.8 — creative fatigue)

    Recommendation: Refresh Summer Sale creative today to prevent further CPM increases.
```

---

## Tips

### Get Better Recommendations

1. **Run audit first** — Provides business context for dollar-specific recommendations
2. **Update business context quarterly** — Re-run audit when AOV or margins change
3. **Be specific** — "Analyze campaign X" is better than "how are things"
4. **Ask follow-ups** — "Why is CPM rising?" "What creative should I test?"

### Common Questions

**Q: Do I need to code?**
A: No. Just ask questions in natural language.

**Q: Can AI make changes automatically?**
A: Not yet (read-only in v0.3). You implement recommendations in Meta Ads Manager.

**Q: How does AI know my business?**
A: After running audit, it saves business-context.json with your info.

**Q: Can I use this for multiple ad accounts?**
A: Yes, but you need to switch `META_AD_ACCOUNT_ID` env var.

**Q: Is my data safe?**
A: Yes. Everything runs locally. No data sent to external servers (except Meta API).

**Q: What if I don't have business context?**
A: AI will ask you during audit (AOV, profit margin, etc.). Takes 2 minutes.

---

## Troubleshooting

### "No Meta Ads MCP server detected"

1. Check `.mcp.json` exists and is valid JSON
2. Check `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID` are set
3. Restart your AI agent
4. Try: `echo $META_ACCESS_TOKEN` to verify env var

### "Access token invalid"

1. Get new token from [Graph API Explorer](https://developers.facebook.com/tools/explorer)
2. Make sure `ads_read` permission is enabled
3. Update `META_ACCESS_TOKEN` env var

### "Ad account not found"

1. Check `META_AD_ACCOUNT_ID` format: `act_123456789` (with `act_` prefix)
2. Verify you have access to this ad account in Meta Business Manager
3. Try listing accounts: Ask AI "List my ad accounts"

### AI doesn't understand my question

Try these formats:
- "Audit my Meta ads" (not "check my facebook")
- "How are my campaigns doing?" (not "what's up")
- "Show me yesterday's performance" (not "how was yesterday")

---

## Next Steps

After getting comfortable with basic usage:

1. **Explore advanced questions**
   - "Compare campaign X vs campaign Y"
   - "Why is my CPM rising?"
   - "What creative angles should I test?"

2. **Set up daily monitoring**
   - Ask "Show me yesterday's performance" every morning
   - AI will detect anomalies automatically

3. **Use for planning**
   - "If I increase budget by $500/month, what's the expected return?"
   - "What's my break-even ROAS for this campaign?"

4. **Learn from AI**
   - Ask "Why did you recommend X?"
   - AI explains reasoning with specific metrics

---

## Learn More

- **Full documentation:** See main [README.md](README.md)
- **Skills details:** See [skills/README.md](skills/README.md)
- **Migration guide:** See [SKILL_MIGRATION.md](SKILL_MIGRATION.md)
- **For developers:** See [examples/](examples/) directory

---

**Ready to start?** Just ask your AI agent: "Audit my Meta ads" 🚀
