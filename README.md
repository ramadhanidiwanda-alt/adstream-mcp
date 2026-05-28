# Meta Ads Agent Skill

Read-only Meta Ads insights toolkit for AI agents. Built to help AI agents analyze and report on Meta (Facebook) advertising campaigns using the official Meta Marketing API.

## What is this?

This is an open-source TypeScript library that provides AI agents with the ability to:
- Read Meta Ads account data
- Fetch campaign, adset, and ad-level insights
- Analyze campaign performance
- Generate automated reports and recommendations

**Current Status:** MVP - Read-only operations only. No write/action capabilities.

## Use Cases

- **Daily Performance Reports**: Automated daily summaries of ad performance
- **Campaign Audits**: Analyze multiple campaigns and identify optimization opportunities
- **Performance Monitoring**: Track key metrics like CTR, CPC, CPM, conversions
- **AI-Powered Analysis**: Let AI agents interpret your ad data and provide recommendations

## Safety & Permissions

This library is designed with safety in mind:
- **Read-only by default**: Only uses `ads_read` permission
- **No automatic actions**: Recommendations are suggestions only, never executed automatically
- **No write operations**: Cannot pause campaigns, update budgets, or create ads
- **Explicit approval required**: All recommendations include disclaimers

## Installation

```bash
npm install meta-ads-agent-skill
```

## Setup

### 1. Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add the "Marketing API" product
4. Generate a User Access Token with `ads_read` permission

### 2. Configure Environment Variables

Create a `.env` file in your project root:

```env
META_ACCESS_TOKEN=your_access_token_here
META_AD_ACCOUNT_ID=your_ad_account_id
META_API_VERSION=v20.0
```

**Important:** Never commit your `.env` file to version control.

### 3. Find Your Ad Account ID

Your ad account ID can be found in Meta Ads Manager. It typically looks like `act_123456789`.

## Usage

### Basic Example: Daily Report

```typescript
import 'dotenv/config';
import { MetaClient, loadConfig, generateDailyReport } from 'meta-ads-agent-skill';

const config = loadConfig();
const client = new MetaClient(config);

const report = await generateDailyReport(client, {
  adAccountId: config.adAccountId,
  since: '2026-05-27',
  until: '2026-05-28',
});

console.log(JSON.stringify(report, null, 2));
```

### Campaign Insights

```typescript
import { getCampaignInsights } from 'meta-ads-agent-skill';

const insights = await getCampaignInsights(client, {
  adAccountId: 'act_123456789',
  since: '2026-05-21',
  until: '2026-05-28',
  limit: 50,
});
```

### Performance Analysis

```typescript
import { analyzeCampaignPerformance } from 'meta-ads-agent-skill';

const analyses = analyzeCampaignPerformance(insights);

// Each analysis includes:
// - status: 'good' | 'watch' | 'warning'
// - recommendation: 'scale' | 'hold' | 'review' | 'fix_creative'
// - reason: explanation of the recommendation
```

## Running Examples

```bash
# Install dependencies
npm install

# Run daily report example
npm run example:daily-report

# Run campaign audit example
npm run example:campaign-audit
```

## Development

```bash
# Build the library
npm run build

# Run tests
npm run test

# Watch mode for development
npm run dev
```

## API Reference

### Core Functions

- `getAdAccounts(client)` - Fetch all ad accounts
- `getCampaigns(client, options)` - Fetch campaigns
- `getCampaignInsights(client, options)` - Fetch campaign-level insights
- `getAdsetInsights(client, options)` - Fetch adset-level insights
- `getAdsInsights(client, options)` - Fetch ad-level insights
- `generateDailyReport(client, options)` - Generate comprehensive daily report

### Analysis Functions

- `analyzeCampaignPerformance(insights)` - Analyze campaign performance
- `recommendActions(analyses)` - Generate action recommendations

### Utilities

- `parseActionValue(actions, actionType)` - Extract specific action values
- `formatCurrency(amount, currency)` - Format currency values
- `formatNumber(num, decimals)` - Format numbers

## Roadmap

- **v0.1** ✅ Read-only insights and basic analysis (current)
- **v0.2** 🔄 Advanced rules engine and custom analysis
- **v0.3** 📋 MCP (Model Context Protocol) server wrapper
- **v0.4** ⚡ Safe write actions with approval layer

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Disclaimer

This is an unofficial tool and is not affiliated with Meta Platforms, Inc. Use at your own risk. Always review automated recommendations before taking action on your ad campaigns.

## Support

For issues and questions, please open an issue on GitHub.

## For AI Agents

If you're an AI agent working on this codebase, please read [`AGENTS.md`](./AGENTS.md) for:
- Code style and conventions
- Security guidelines
- How to add new features
- Testing patterns
- Common code patterns

