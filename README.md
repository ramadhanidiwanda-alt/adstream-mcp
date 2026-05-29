# Meta Ads Agent Skill

Read-only Meta Ads insights toolkit for AI agents. Built to help AI agents analyze and report on Meta (Facebook) advertising campaigns using the official Meta Marketing API.

[![GitHub](https://img.shields.io/github/license/ramadhanidiwanda-alt/meta-ads-agent-skill)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-14%2F14%20passing-brightgreen)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()

## What is this?

This is an open-source TypeScript library that provides AI agents with the ability to:
- Read Meta Ads account data
- Fetch campaign, adset, and ad-level insights
- Analyze campaign performance with flexible rule engine
- Generate automated reports and recommendations
- Use pre-built rule templates for common scenarios

**Current Status:** v0.2.0 - Advanced rule engine with 26 pre-built templates

## Features

### ✅ v0.1.0 - Core Features
- **MetaClient** - Clean wrapper for Meta Marketing API
- **6 Read-only Tools** - getAdAccounts, getCampaigns, insights at all levels
- **Performance Analysis** - Smart campaign analysis with recommendations
- **Daily Reports** - Automated report generation

### 🆕 v0.2.0 - Advanced Rule Engine
- **Flexible Rule System** - Define custom rules with conditions and logic
- **26 Pre-built Templates** - Ready-to-use rules for common scenarios
- **4 Rule Categories**:
  - E-commerce (6 rules) - Purchase optimization
  - Lead Generation (6 rules) - Lead optimization
  - Brand Awareness (6 rules) - Reach optimization
  - General Performance (8 rules) - Universal rules
- **Smart Evaluation** - AND/OR logic, 6 operators, priority-based recommendations

## Use Cases

- **Daily Performance Reports**: Automated daily summaries of ad performance
- **Campaign Audits**: Analyze multiple campaigns and identify optimization opportunities
- **Performance Monitoring**: Track key metrics like CTR, CPC, CPM, conversions
- **AI-Powered Analysis**: Let AI agents interpret your ad data and provide recommendations
- **Custom Rule Evaluation**: Define your own rules for specific business needs

## Installation

```bash
npm install meta-ads-agent-skill
```

## Quick Start

### 1. Setup Environment

Create a `.env` file:

## Authentication

### Getting Your Access Token

You need a Meta Access Token with `ads_read` permission to use this library.

#### Option 1: Graph API Explorer (Quick Testing)

1. Go to [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer)
2. Select your Meta App (or create one)
3. Click "Permissions" and add `ads_read`
4. Click "Generate Access Token"
5. Copy the token (valid for 60 days)

#### Option 2: System User Token (Production/Autonomous Agents)

For production use or autonomous AI agents, use a System User token that never expires:

1. Go to [Meta Business Settings](https://business.facebook.com/settings)
2. Navigate to **Users** > **System Users**
3. Click **Add** to create a new System User
4. Assign the System User to your Ad Account with **Analyst** role
5. Click **Generate New Token**
6. Select your app and add `ads_read` permission
7. Copy and securely store the token

**Recommended for:**
- Production environments
- Autonomous AI agents
- Scheduled/cron jobs
- Long-running applications

#### Option 3: OAuth Flow (Multi-User Applications)

For web applications with multiple users:

```typescript
// 1. Redirect user to OAuth dialog
const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?
  client_id=${APP_ID}&
  redirect_uri=${REDIRECT_URI}&
  scope=ads_read&
  state=${STATE}`;

// 2. Handle callback and exchange code for token
const response = await fetch(
  `https://graph.facebook.com/v20.0/oauth/access_token?` +
  `client_id=${APP_ID}&` +
  `client_secret=${APP_SECRET}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `code=${CODE}`
);

const { access_token } = await response.json();
```

### Environment Setup

Create a `.env` file in your project root:

```env
META_ACCESS_TOKEN=EAAxxxxxxxxxx
META_AD_ACCOUNT_ID=act_123456789
META_API_VERSION=v20.0
```

Or set environment variables in your shell:

```bash
# Add to ~/.zshrc or ~/.bashrc
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"
export META_API_VERSION="v20.0"
```

### Finding Your Ad Account ID

1. Go to [Meta Ads Manager](https://business.facebook.com/adsmanager)
2. Look at the URL: `https://business.facebook.com/adsmanager/manage/campaigns?act=123456789`
3. Your Ad Account ID is `act_123456789`

### Security Best Practices

✅ **DO:**
- Store tokens in environment variables or secure vault (AWS Secrets Manager, 1Password, etc.)
- Use System User tokens for production/autonomous agents
- Validate token format before making API calls
- Use the `maskToken()` utility when logging

❌ **DON'T:**
- Commit tokens to git repositories
- Share tokens in plain text (Slack, email, etc.)
- Use short-lived User tokens for production
- Log full access tokens in console or files

### Token Validation

The library automatically validates token format:

```typescript
import { loadConfig, validateTokenFormat, maskToken } from 'meta-ads-agent-skill';

// Automatic validation on load
try {
  const config = loadConfig();
  console.log('Token valid:', maskToken(config.accessToken));
} catch (error) {
  console.error('Configuration error:', error.message);
  // Output: Helpful error with setup instructions
}

// Manual validation
if (!validateTokenFormat('EAAxxxxxxxxxx')) {
  throw new Error('Invalid token format');
}
```

### Token Expiry

- **User Access Token**: Expires in 60 days
- **System User Token**: Never expires (recommended)
- **App Access Token**: Never expires but limited permissions

**Check token expiry:**

```typescript
const response = await fetch(
  `https://graph.facebook.com/debug_token?` +
  `input_token=${ACCESS_TOKEN}&` +
  `access_token=${ACCESS_TOKEN}`
);

const { data } = await response.json();
console.log('Expires at:', new Date(data.expires_at * 1000));
console.log('Is valid:', data.is_valid);
```


```env
META_ACCESS_TOKEN=your_access_token_here
META_AD_ACCOUNT_ID=act_123456789
META_API_VERSION=v20.0
```

### 2. Basic Usage

```typescript
import { MetaClient, loadConfig, generateDailyReport } from 'meta-ads-agent-skill';

const config = loadConfig();
const client = new MetaClient(config);

const report = await generateDailyReport(client, {
  adAccountId: config.adAccountId,
  since: '2026-05-27',
  until: '2026-05-28',
});

console.log(report);
```

### 3. Using Rule Engine (v0.2.0)

#### Pre-built Templates

```typescript
import { RuleEngine, ecommerceRules, getCampaignInsights } from 'meta-ads-agent-skill';

const client = new MetaClient(loadConfig());
const insights = await getCampaignInsights(client, {
  adAccountId: 'act_123456789',
  since: '2026-05-21',
  until: '2026-05-28',
});

const engine = new RuleEngine();
const results = engine.applyRulesToInsights(insights, ecommerceRules);

results.forEach(result => {
  console.log(`Campaign: ${result.campaignName}`);
  console.log(`Status: ${result.overallStatus}`);
  console.log(`Actions: ${result.recommendedActions.join(', ')}`);
});
```

#### Custom Rules

```typescript
import { RuleEngine } from 'meta-ads-agent-skill';

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
    enabled: true,
  }
];

const engine = new RuleEngine();
const results = engine.applyRulesToInsights(insights, customRules);
```

#### All Templates Combined

```typescript
import { allRuleTemplates, RuleEngine } from 'meta-ads-agent-skill';

const engine = new RuleEngine();
const results = engine.applyRulesToInsights(insights, allRuleTemplates);
// Evaluates all 26 rules across all categories
```

## Rule Templates

### E-commerce Rules (6 rules)
- High Spend Low ROAS
- High Spend Low Purchases
- Expensive Conversions
- Good CTR Low Conversions
- Scaling Opportunity
- Low Spend Testing Phase

### Lead Generation Rules (6 rules)
- Expensive Leads
- Low Conversion Rate
- High Volume Low Quality
- Good Lead Gen Performance
- Low Reach
- Lead Gen Scaling Opportunity

### Brand Awareness Rules (6 rules)
- High CPM
- Low Reach Efficiency
- Efficient CPM
- High Reach Low Engagement
- Potential Audience Saturation
- Brand Awareness Scaling

### General Performance Rules (8 rules)
- Creative Fatigue
- High Cost Per Click
- Low Click-Through Rate
- Budget Pacing Issue
- Good Overall Performance
- Low Impressions
- Excellent CTR
- Testing Phase

## API Reference

### Core Functions

```typescript
// Meta API Client
const client = new MetaClient(config);

// Fetch data
getAdAccounts(client)
getCampaigns(client, { adAccountId, limit })
getCampaignInsights(client, { adAccountId, since, until })
getAdsetInsights(client, { adAccountId, since, until })
getAdsInsights(client, { adAccountId, since, until })

// Generate reports
generateDailyReport(client, { adAccountId, since, until })

// Rule Engine (v0.2.0)
const engine = new RuleEngine();
engine.evaluateRule(insight, rule)
engine.applyRules(insight, rules)
engine.applyRulesToInsights(insights, rules)

// Rule Templates
import { 
  ecommerceRules, 
  leadGenRules, 
  brandAwarenessRules, 
  generalRules,
  allRuleTemplates,
  getRulesByCategory 
} from 'meta-ads-agent-skill';
```

### Analysis Functions

```typescript
analyzeCampaignPerformance(insights)
recommendActions(analyses)
```

### Utilities

```typescript
parseActionValue(actions, actionType)
formatCurrency(amount, currency)
formatNumber(num, decimals)
```

## Setup Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add the "Marketing API" product
4. Generate a User Access Token with `ads_read` permission
5. Find your Ad Account ID in Meta Ads Manager (format: `act_123456789`)

## Examples

Run the included examples:

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

## Development

```bash
# Build the library
npm run build

# Run tests
npm run test

# Watch mode
npm run dev
```

## Safety & Permissions

This library is designed with safety in mind:
- **Read-only by default**: Only uses `ads_read` permission
- **No automatic actions**: Recommendations are suggestions only, never executed automatically
- **No write operations**: Cannot pause campaigns, update budgets, or create ads
- **Explicit approval required**: All recommendations include disclaimers

## Roadmap

- **v0.1** ✅ Read-only insights and basic analysis
- **v0.2** ✅ Advanced rule engine with 26 pre-built templates
- **v0.3** 🔄 MCP (Model Context Protocol) server wrapper
- **v0.4** 📋 Safe write actions with approval layer

## For AI Agents

If you're an AI agent working on this codebase, please read [`AGENTS.md`](./AGENTS.md) for:
- Code style and conventions
- Security guidelines
- How to add new features
- Testing patterns
- Common code patterns

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Disclaimer

This is an unofficial tool and is not affiliated with Meta Platforms, Inc. Use at your own risk. Always review automated recommendations before taking action on your ad campaigns.

## Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ using TypeScript, Node.js, and AI assistance**
