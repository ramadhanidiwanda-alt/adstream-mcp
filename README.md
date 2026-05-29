# Meta Ads Agent Skill

TypeScript library + AI skills for Meta Ads analysis. Built for both developers who want programmatic control and end users who want AI-powered insights.

[![GitHub](https://img.shields.io/github/license/ramadhanidiwanda-alt/meta-ads-agent-skill)](LICENSE)
[![npm version](https://img.shields.io/npm/v/meta-ads-agent-skill)](https://www.npmjs.com/package/meta-ads-agent-skill)

## Two Ways to Use This Project

### 🤖 For End Users: AI Skills (Zero Code)

Ask your AI agent in natural language:

```
You: Audit my Meta ads
AI: [analyzes account, provides scorecard and recommendations]

You: How are my campaigns doing?
AI: [shows performance, identifies issues, suggests actions]

You: Where am I wasting money?
AI: [finds inefficient spend, calculates savings]
```

**Features:**
- Natural language interface
- Comprehensive account audits
- Daily performance reports
- Creative fatigue detection
- Profitability analysis (ROAS, break-even, headroom)
- Personalized recommendations based on your business context

**Setup:** Configure MCP server (see [Skills Setup](#skills-setup))

**Learn more:** See [`skills/README.md`](skills/README.md)

---

### 💻 For Developers: TypeScript Library

Programmatic access to Meta Ads data for building custom tools, dashboards, and automation.

```typescript
import { MetaClient, getCampaignInsights, analyzeCampaignPerformance } from 'meta-ads-agent-skill';

const client = new MetaClient({
  accessToken: process.env.META_ACCESS_TOKEN,
  apiVersion: 'v20.0'
});

const insights = await getCampaignInsights(client, {
  adAccountId: 'act_123456789',
  datePreset: 'last_30d'
});

const analysis = await analyzeCampaignPerformance(insights);
console.log(analysis.recommendations);
```

**Features:**
- Clean Meta Marketing API wrapper
- 6 read-only tools (campaigns, insights at all levels)
- Performance analysis with recommendations
- Flexible rule engine (26 pre-built templates)
- TypeScript types for everything
- MCP server included

**Setup:** See [Library Installation](#library-installation)

---

## What's Included

| Component | Purpose | For |
|-----------|---------|-----|
| **TypeScript Library** (`src/`) | Programmatic API access | Developers |
| **AI Skills** (`skills/`) | Natural language analysis | End users |
| **MCP Server** (`mcp-server/`) | Bridge between AI and library | Both |
| **Rule Engine** (`src/rules/`) | Custom performance rules | Developers |
| **Examples** (`examples/`) | Code samples | Developers |

---

## Skills Setup

### Prerequisites

1. **AI Agent** — Claude Code, Claude Desktop, or any MCP-compatible agent
2. **Meta Access Token** — See [Authentication](#authentication)
3. **Ad Account ID** — Your Meta ad account ID (format: `act_123456789`)

### Configuration

Create `.mcp.json` in your project root (or add to existing):

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

Or set environment variables:
```bash
export META_ACCESS_TOKEN="your_token_here"
export META_AD_ACCOUNT_ID="act_123456789"
```

### Usage

Ask your AI agent:

- **"Audit my Meta ads"** → Comprehensive account analysis
- **"How are my campaigns doing?"** → Performance overview
- **"Show me yesterday's performance"** → Daily report
- **"Where am I wasting money?"** → Find inefficiencies
- **"What should I scale?"** → Scaling opportunities
- **"Analyze campaign [name]"** → Specific campaign deep-dive

The AI will read the skill files, call MCP tools, and provide natural language analysis with specific recommendations.

---

## Library Installation

### Install

```bash
npm install meta-ads-agent-skill
```

### Setup Environment

Create `.env` file:

```env
META_ACCESS_TOKEN=your_access_token_here
META_AD_ACCOUNT_ID=act_123456789
META_API_VERSION=v20.0
```

### Quick Start

```typescript
import { loadConfig } from 'meta-ads-agent-skill/config';
import { MetaClient } from 'meta-ads-agent-skill';
import { getCampaigns, getCampaignInsights } from 'meta-ads-agent-skill/tools';

// Load config from .env
const config = loadConfig();
const client = new MetaClient(config);

// Get campaigns
const campaigns = await getCampaigns(client, {
  adAccountId: config.adAccountId,
  fields: ['id', 'name', 'status', 'objective']
});

// Get insights
const insights = await getCampaignInsights(client, {
  adAccountId: config.adAccountId,
  datePreset: 'last_30d'
});

console.log(`Found ${campaigns.length} campaigns`);
console.log(`Total spend: $${insights.reduce((sum, i) => sum + i.spend, 0)}`);
```

### Available Tools

- `getAdAccounts()` — List all ad accounts
- `getCampaigns()` — Get campaigns for an account
- `getCampaignInsights()` — Campaign-level performance
- `getAdsetInsights()` — Ad set-level performance
- `getAdsInsights()` — Ad-level performance
- `generateDailyReport()` — Automated daily report

### Analysis & Rules

```typescript
import { analyzeCampaignPerformance } from 'meta-ads-agent-skill/analysis';
import { RuleEngine } from 'meta-ads-agent-skill/rules';
import { ecommerceRules } from 'meta-ads-agent-skill/rules/templates';

// Analyze performance
const analysis = await analyzeCampaignPerformance(insights);

// Use rule engine
const engine = new RuleEngine();
engine.addRules(ecommerceRules);

const results = engine.evaluate(insights);
console.log(results.recommendations);
```

### Rule Templates

26 pre-built rules across 4 categories:

- **E-commerce** (6 rules) — Purchase optimization
- **Lead Generation** (6 rules) — Lead optimization
- **Brand Awareness** (6 rules) — Reach optimization
- **General Performance** (8 rules) — Universal rules

See [`src/rules/templates/`](src/rules/templates/) for details.

---

## Authentication

You need a Meta Access Token with `ads_read` permission.

### Option 1: Graph API Explorer (Quick Testing)

1. Go to [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer)
2. Select your Meta App (or create one)
3. Click "Permissions" and add `ads_read`
4. Click "Generate Access Token"
5. Copy the token (valid for 60 days)

### Option 2: System User Token (Production)

For production or autonomous AI agents, use a System User token that never expires:

1. Go to [Meta Business Settings](https://business.facebook.com/settings)
2. Navigate to **Users** > **System Users**
3. Click **Add** to create a new System User
4. Assign the System User to your Ad Account with **Analyst** role
5. Click **Generate New Token**
6. Select `ads_read` permission
7. Copy the token (never expires)

**Recommended for:** Production use, AI agents, scheduled jobs

---

## Use Cases

### For End Users (Skills)

- Daily performance monitoring
- Account health audits
- Creative fatigue detection
- Budget optimization
- Profitability analysis
- Competitive benchmarking

### For Developers (Library)

- Custom dashboards
- Automated reporting
- Performance alerts
- Budget forecasting
- Multi-account management
- CI/CD integration

---

## Architecture

```
meta-ads-agent-skill/
├── src/                          # TypeScript library
│   ├── metaClient.ts            # API wrapper
│   ├── config.ts                # Config loader
│   ├── types.ts                 # TypeScript types
│   ├── tools/                   # 6 API functions
│   ├── analysis/                # Analysis logic
│   ├── rules/                   # Rule engine + templates
│   └── utils/                   # Helpers
├── skills/                       # AI agent skills
│   └── meta-ads/
│       ├── audit/SKILL.md       # Audit skill
│       ├── manage/SKILL.md      # Management skill
│       └── shared/              # Shared references
├── mcp-server/                   # MCP server
│   └── src/index.ts
├── examples/                     # Code examples
└── tests/                        # Unit tests
```

---

## Examples

See [`examples/`](examples/) directory:

- `daily-report.ts` — Generate daily performance report
- `campaign-audit.ts` — Audit specific campaigns
- `rule-engine-demo.ts` — Use rule engine
- `rule-templates-demo.ts` — Use pre-built templates

Run examples:
```bash
npm run example:daily-report
npm run example:campaign-audit
npm run example:rule-engine
```

---

## Development

```bash
# Install dependencies
npm install

# Build library
npm run build

# Run tests
npm test

# Watch mode (development)
npm run dev

# Format code
npm run format

# Lint code
npm run lint
```

---

## Roadmap

- ✅ v0.1.0 — Core library (read-only tools)
- ✅ v0.2.0 — Advanced rule engine
- ✅ v0.3.0 — AI skills layer
- 🔜 v0.4.0 — Write operations (pause, budget changes)
- 🔜 v0.5.0 — OAuth flow for skills
- 🔜 v0.6.0 — Multi-account support

---

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

For skills contributions, see [`skills/README.md`](skills/README.md).

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Links

- **GitHub:** https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill
- **npm:** https://www.npmjs.com/package/meta-ads-agent-skill
- **Issues:** https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/issues
- **Meta Marketing API:** https://developers.facebook.com/docs/marketing-api

---

## Comparison to Other Tools

| Feature | This Project | NotFair | Meta Official |
|---------|-------------|---------|---------------|
| TypeScript Library | ✅ | ❌ | ❌ |
| AI Skills | ✅ | ✅ | ❌ |
| Self-hosted MCP | ✅ | ❌ (cloud) | N/A |
| Read Operations | ✅ | ✅ | ✅ |
| Write Operations | 🔜 v0.4 | ✅ | ✅ |
| Rule Engine | ✅ | ❌ | ❌ |
| Open Source | ✅ | ✅ | ✅ |
| Target Audience | Both | End users | Developers |

---

## Questions?

- **"Should I use skills or library?"** — Skills for ad-hoc analysis, library for automation
- **"Can I use both?"** — Yes! They're complementary
- **"Is this production-ready?"** — Yes for read operations, write ops coming in v0.4
- **"Does this work with other AI agents?"** — Yes, any MCP-compatible agent
- **"Can I self-host everything?"** — Yes, no external dependencies

See [`SKILL_MIGRATION.md`](SKILL_MIGRATION.md) for more details on the architecture.
