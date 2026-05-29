# Meta Ads Agent Skill

AI-powered Meta (Facebook) Ads analysis and reporting toolkit. Enables AI agents to read campaign data, analyze performance, and generate actionable insights using the Meta Marketing API.

## Overview

This skill provides AI agents with the ability to:
- Fetch Meta Ads account data and campaign insights
- Analyze campaign performance with 26 pre-built rule templates
- Generate automated daily reports and recommendations
- Evaluate campaigns across multiple categories (e-commerce, lead gen, brand awareness)

**Version:** 0.2.0  
**Type:** Read-only (no write operations)  
**API:** Meta Marketing API v20.0

---

## When to Use This Skill

### Trigger Keywords
- "meta ads", "facebook ads", "instagram ads"
- "campaign performance", "ad performance"
- "daily report", "campaign audit"
- "analyze campaigns", "ad insights"
- "ROAS", "CTR", "CPC", "CPM"

### Use Cases
1. **Daily Performance Reports** - Automated summaries of yesterday's ad performance
2. **Campaign Audits** - Analyze multiple campaigns over 7-30 days
3. **Performance Monitoring** - Track key metrics and identify issues
4. **Rule-Based Analysis** - Apply 26 pre-built rules for optimization recommendations
5. **Custom Analysis** - Define custom rules for specific business needs

---

## Authentication Setup

### Prerequisites
1. Meta Business Manager account
2. Meta App with `ads_read` permission
3. Access Token (User Token or System User Token)

### Environment Variables

**Required:**
```bash
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"
```

**Optional:**
```bash
export META_API_VERSION="v20.0"  # Default: v20.0
```

### Getting Access Token

#### Option 1: Graph API Explorer (Quick Testing)
1. Go to https://developers.facebook.com/tools/explorer
2. Select your app
3. Add permission: `ads_read`
4. Click "Generate Access Token"
5. Copy token (expires in 60 days)

#### Option 2: System User Token (Production/Autonomous Agents)
1. Go to Meta Business Settings
2. Navigate to Users > System Users
3. Create new System User
4. Assign ad account access
5. Generate token (never expires)
6. Store securely in environment

#### Option 3: OAuth Flow (Multi-User Apps)
```typescript
// Redirect user to OAuth dialog
const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?
  client_id=${APP_ID}&
  redirect_uri=${REDIRECT_URI}&
  scope=ads_read`;

// Exchange code for token
const response = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?
  client_id=${APP_ID}&
  client_secret=${APP_SECRET}&
  redirect_uri=${REDIRECT_URI}&
  code=${CODE}`);
```

### Security Best Practices

✅ **DO:**
- Store tokens in environment variables or secure vault
- Use System User tokens for autonomous agents
- Validate token before making API calls
- Never log full access token

❌ **DON'T:**
- Commit tokens to git
- Share tokens in plain text
- Use short-lived tokens for production
- Log tokens in console or files

---

## Available Tools

### 1. getAdAccounts
Fetch all ad accounts accessible by the access token.

**Usage:**
```typescript
const accounts = await getAdAccounts(client);
```

**Returns:**
```typescript
{
  data: [
    {
      id: "act_123456789",
      name: "My Ad Account",
      account_status: 1,
      currency: "USD"
    }
  ]
}
```

---

### 2. getCampaigns
Fetch campaigns with optional filters.

**Usage:**
```typescript
const campaigns = await getCampaigns(client, {
  adAccountId: "act_123456789",
  limit: 50,
  status: ["ACTIVE", "PAUSED"]
});
```

**Parameters:**
- `adAccountId` (required): Ad account ID
- `limit` (optional): Max campaigns to fetch (default: 50)
- `status` (optional): Filter by status

**Returns:**
```typescript
[
  {
    id: "123456",
    name: "Summer Sale Campaign",
    status: "ACTIVE",
    objective: "OUTCOME_SALES",
    created_time: "2026-05-01T10:00:00+0000"
  }
]
```

---

### 3. getCampaignInsights
Fetch campaign-level performance insights.

**Usage:**
```typescript
const insights = await getCampaignInsights(client, {
  adAccountId: "act_123456789",
  since: "2026-05-22",
  until: "2026-05-28"
});
```

**Parameters:**
- `adAccountId` (required): Ad account ID
- `since` (required): Start date (YYYY-MM-DD)
- `until` (required): End date (YYYY-MM-DD)

**Returns:**
```typescript
[
  {
    campaign_id: "123456",
    campaign_name: "Summer Sale",
    spend: "150000",
    impressions: "500000",
    clicks: "2500",
    ctr: "0.5",
    cpc: "60",
    cpm: "300",
    actions: [
      { action_type: "purchase", value: "50" },
      { action_type: "lead", value: "120" }
    ]
  }
]
```

---

### 4. getAdsetInsights
Fetch adset-level performance insights.

**Usage:**
```typescript
const insights = await getAdsetInsights(client, {
  adAccountId: "act_123456789",
  since: "2026-05-22",
  until: "2026-05-28"
});
```

**Returns:** Similar structure to campaign insights, with adset-level data.

---

### 5. getAdsInsights
Fetch ad-level performance insights.

**Usage:**
```typescript
const insights = await getAdsInsights(client, {
  adAccountId: "act_123456789",
  since: "2026-05-22",
  until: "2026-05-28"
});
```

**Returns:** Similar structure to campaign insights, with ad-level data.

---

### 6. generateDailyReport
Generate comprehensive daily performance report.

**Usage:**
```typescript
const report = await generateDailyReport(client, {
  adAccountId: "act_123456789",
  since: "2026-05-28",
  until: "2026-05-29"
});
```

**Returns:**
```typescript
{
  summary: {
    totalSpend: 450000,
    totalImpressions: 1500000,
    totalClicks: 12000,
    averageCTR: 0.8,
    averageCPC: 37.5
  },
  campaigns: [...],
  analyses: [
    {
      campaignId: "123",
      campaignName: "Summer Sale",
      status: "warning",
      recommendations: ["Test new ad creatives", "Review targeting"]
    }
  ],
  actions: {
    high: ["Campaign X: High spend, low CTR - urgent review needed"],
    medium: ["Campaign Y: Consider scaling budget by 20%"],
    low: ["Campaign Z: Maintain current strategy"]
  }
}
```

---

## Rule Engine (v0.2.0)

### Pre-built Rule Templates

**26 rules across 4 categories:**

#### E-commerce Rules (6 rules)
- High Spend Low ROAS
- High Spend Low Purchases
- Expensive Conversions
- Good CTR Low Conversions
- Scaling Opportunity
- Low Spend Testing Phase

#### Lead Generation Rules (6 rules)
- Expensive Leads
- Low Conversion Rate
- High Volume Low Quality
- Good Lead Gen Performance
- Low Reach
- Lead Gen Scaling Opportunity

#### Brand Awareness Rules (6 rules)
- High CPM
- Low Reach Efficiency
- Efficient CPM
- High Reach Low Engagement
- Potential Audience Saturation
- Brand Awareness Scaling

#### General Performance Rules (8 rules)
- Creative Fatigue
- High Cost Per Click
- Low Click-Through Rate
- Budget Pacing Issue
- Good Overall Performance
- Low Impressions
- Excellent CTR
- Testing Phase

### Using Rule Engine

**Apply all rules:**
```typescript
import { RuleEngine, allRuleTemplates } from 'meta-ads-agent-skill';

const engine = new RuleEngine();
const results = engine.applyRulesToInsights(insights, allRuleTemplates);
```

**Apply category-specific rules:**
```typescript
import { ecommerceRules, leadGenRules } from 'meta-ads-agent-skill';

const results = engine.applyRulesToInsights(insights, ecommerceRules);
```

**Custom rules:**
```typescript
const customRules = [
  {
    id: 'my-rule',
    name: 'High Spend Alert',
    description: 'Alert when spend exceeds threshold',
    conditions: [
      { metric: 'spend', operator: '>', value: 100000 },
      { metric: 'ctr', operator: '<', value: 1.0 }
    ],
    logic: 'AND',
    action: 'Review campaign targeting and creative',
    priority: 'high',
    enabled: true
  }
];

const results = engine.applyRulesToInsights(insights, customRules);
```

---

## AI Agent Workflows

### Workflow 1: Daily Performance Check

**User Prompt:**
> "Check my Meta Ads performance from yesterday"

**Agent Actions:**
1. Calculate yesterday's date range
2. Call `generateDailyReport(client, { since: yesterday, until: today })`
3. Parse report and identify issues
4. Respond with natural language summary:
   - Total spend and key metrics
   - Campaigns with issues (high priority first)
   - Recommended actions
5. Ask: "Want me to analyze any specific campaign in detail?"

**Example Response:**
```
📊 Daily Meta Ads Report (May 28, 2026)

Summary:
- Total Spend: $4,500
- Total Clicks: 12,000
- Average CTR: 0.8%
- Average CPC: $0.38

⚠️ Issues Found:
1. [HIGH] Summer Sale Campaign
   - Spend: $1,500 | CTR: 0.3%
   - Issue: High spend but low CTR
   - Action: Test new ad creatives or adjust targeting

2. [MEDIUM] Product Launch Campaign
   - Spend: $800 | CPC: $0.65
   - Issue: CPC above target
   - Action: Review bid strategy

✅ Good Performance:
- Brand Awareness Campaign: Excellent CTR (2.1%)

Want me to create a detailed analysis for any campaign?
```

---

### Workflow 2: Campaign Audit

**User Prompt:**
> "Audit all my Meta Ads campaigns from last week"

**Agent Actions:**
1. Calculate last 7 days date range
2. Call `getCampaignInsights(client, { since, until })`
3. Call `analyzeCampaignPerformance(insights)`
4. Apply rule engine with all templates
5. Group results by priority (high/medium/low)
6. Respond with structured report

**Example Response:**
```
📋 Campaign Audit Report (May 22-28, 2026)

Analyzed: 12 campaigns
Total Spend: $31,500

🚨 High Priority (3 campaigns):
1. Summer Sale Campaign
   - Triggered Rules: High Spend Low CTR, Creative Fatigue
   - Spend: $8,500 | CTR: 0.4% | CPC: $0.85
   - Actions: Refresh creatives, test new audiences

2. Product Launch Campaign
   - Triggered Rules: Expensive Conversions
   - Spend: $6,200 | Cost per Purchase: $124
   - Actions: Optimize landing page, review targeting

⚠️ Medium Priority (4 campaigns):
[...]

✅ Good Performance (5 campaigns):
[...]

Want me to generate a detailed breakdown for any campaign?
```

---

### Workflow 3: Custom Analysis

**User Prompt:**
> "Show me all campaigns with CTR below 0.5% and spend above $1000"

**Agent Actions:**
1. Call `getCampaignInsights(client, { since, until })`
2. Filter insights based on conditions
3. Apply relevant rules
4. Respond with filtered results

---

### Workflow 4: Rule-Based Monitoring

**User Prompt:**
> "Apply e-commerce rules to my campaigns and show scaling opportunities"

**Agent Actions:**
1. Call `getCampaignInsights(client, { since, until })`
2. Apply `ecommerceRules` via RuleEngine
3. Filter results for "Scaling Opportunity" rule
4. Respond with campaigns that match

---

## Error Handling

### Common Errors

**1. Missing Access Token**
```
Error: META_ACCESS_TOKEN is required
Solution: Set environment variable or add to .env file
```

**2. Invalid Ad Account ID**
```
Error: Ad account not found or no access
Solution: Verify account ID format (must start with 'act_')
```

**3. Token Expired**
```
Error: Invalid OAuth access token
Solution: Generate new token from Graph API Explorer
```

**4. Insufficient Permissions**
```
Error: Requires ads_read permission
Solution: Add ads_read permission to your app
```

### Error Response Format

```typescript
{
  error: {
    message: "Invalid OAuth access token",
    type: "OAuthException",
    code: 190,
    fbtrace_id: "xxx"
  }
}
```

---

## Installation

### As NPM Package
```bash
npm install meta-ads-agent-skill
```

### As Local Dependency
```bash
cd /Users/macbook/Projects/meta-ads-agent-skill
npm install
npm run build
```

Then in your project:
```bash
npm install /Users/macbook/Projects/meta-ads-agent-skill
```

---

## Configuration

### Environment Setup

**Option 1: .env file**
```bash
# .env
META_ACCESS_TOKEN=EAAxxxxxxxxxx
META_AD_ACCOUNT_ID=act_123456789
META_API_VERSION=v20.0
```

**Option 2: Shell profile**
```bash
# ~/.zshrc or ~/.bashrc
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"
```

**Option 3: Runtime**
```typescript
process.env.META_ACCESS_TOKEN = "EAAxxxxxxxxxx";
process.env.META_AD_ACCOUNT_ID = "act_123456789";
```

---

## Testing

### Verify Setup
```bash
cd /Users/macbook/Projects/meta-ads-agent-skill
npm run example:daily-report
```

### Run Tests
```bash
npm test
```

### Manual Testing
```typescript
import { MetaClient, loadConfig, getAdAccounts } from 'meta-ads-agent-skill';

const config = loadConfig();
const client = new MetaClient(config);
const accounts = await getAdAccounts(client);
console.log(accounts);
```

---

## Limitations

### Read-Only
- ❌ Cannot create/update/delete campaigns
- ❌ Cannot pause/resume campaigns
- ❌ Cannot modify budgets or bids
- ✅ Only reads data and provides recommendations

### API Limits
- Rate limit: 200 calls per hour per user
- Data retention: 37 months
- Insights delay: ~15 minutes for real-time data

### Permissions Required
- `ads_read` - Read ad account data (required)
- `ads_management` - NOT required (write operations disabled)

---

## Roadmap

- ✅ v0.1.0 - Core read-only tools
- ✅ v0.2.0 - Advanced rule engine with 26 templates
- 🔄 v0.3.0 - MCP server wrapper for Claude Desktop
- 📋 v0.4.0 - Safe write actions with approval workflow
- 🔮 v0.5.0 - Multi-account support and scheduling

---

## Support

**Documentation:** https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill  
**Issues:** https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/issues  
**License:** MIT

---

## Quick Reference

### Common Commands
```bash
# Daily report
npm run example:daily-report

# Campaign audit
npm run example:campaign-audit

# Rule engine demo
npm run example:rule-engine

# Rule templates demo
npm run example:rule-templates
```

### Key Metrics
- **CTR** (Click-Through Rate): clicks / impressions × 100
- **CPC** (Cost Per Click): spend / clicks
- **CPM** (Cost Per Mille): spend / impressions × 1000
- **ROAS** (Return on Ad Spend): revenue / spend
- **Conversion Rate**: conversions / clicks × 100

### Status Levels
- **good** - Campaign performing well, consider scaling
- **watch** - Monitor closely, no immediate action needed
- **warning** - Issues detected, review and optimize recommended

---

**Last Updated:** 2026-05-29  
**Skill Version:** 0.2.0  
**Codex Compatible:** Yes
