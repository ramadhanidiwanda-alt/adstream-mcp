# Adstream MCP

Open-source MCP connector hub for ads and commerce analytics. It started as a Meta Ads toolkit and is evolving into Cuan Insight's client-agnostic execution layer for Meta, Meta CPAS, TikTok regular, TikTok GMV Max, Google Ads, and Indonesian marketplace ads.

[![GitHub](https://img.shields.io/github/license/ramadhanidiwanda-alt/adstream-mcp)](LICENSE)
[![npm version](https://img.shields.io/npm/v/adstream-mcp)](https://www.npmjs.com/package/adstream-mcp)
[![tests](https://img.shields.io/badge/tests-448%20passed-brightgreen)]()
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)]()


## Account-Level Performance Tool

`ads_get_account_performance` fetches Meta ad account totals directly from Meta Insights using `level=account`. Use this for portfolio summaries, executive reports, and account-level analysis where totals should not be derived by summing campaign rows.

Example input:

```json
{
  "provider": "meta",
  "accountId": "act_662014947775593",
  "since": "2026-01-01",
  "until": "2026-06-24"
}
```

Returned metrics include spend, impressions, reach, clicks, link clicks, CTR, CPC, CPM, actions, purchase value, purchase ROAS, and leads when Meta provides them. If Meta omits `purchase_roas`, normalized output can calculate ROAS from `purchase_value / spend` when both values are available.

## Meta CPAS and TikTok GMV Max

Meta CPAS is not a separate provider. Use the regular Meta provider with `params.mode: "cpas"` to request catalog/product breakdowns and receive normalized catalog metadata.

```json
{
  "provider": "meta",
  "accountId": "act_123",
  "since": "2026-05-01",
  "until": "2026-05-07",
  "params": { "mode": "cpas" }
}
```

TikTok GMV Max uses the commerce data surface so AI clients can read structured JSON and write their own analysis/report narrative.

```json
{
  "provider": "tiktok_gmv",
  "accountId": "advertiser_123",
  "storeIds": ["store_1"],
  "since": "2026-05-01",
  "until": "2026-05-07"
}
```


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

**MCP client setup:** See [`docs/MCP_CLIENT_SETUP.md`](docs/MCP_CLIENT_SETUP.md) for generic stdio client and Docker setup.

**Open-source setup guide:** See [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) to choose between Cuan Insight connection keys, local Docker stdio, remote HTTP, and OpenAI Responses API.

**Learn more:** See [`skills/README.md`](skills/README.md)

---

### 💻 For Developers: TypeScript Library

Programmatic access to Meta Ads data for building custom tools, dashboards, and automation.

```typescript
import { MetaClient, getCampaignInsights, analyzeCampaignPerformance } from 'adstream-mcp';

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
- Clean Meta Marketing API wrapper plus broker adapters for Meta and TikTok
- Stable `ads_*` MCP tools for account, campaign, adgroup/adset, ad, placement, and report data
- Meta CPAS mode via `params.mode: "cpas"` with catalog/product metadata
- TikTok regular performance plus TikTok GMV Max commerce data via `commerce_get_performance`
- Performance analysis with recommendations where appropriate; commerce tools return normalized JSON for AI-side analysis
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


### Recommended Hosted Setup

Use Cuan Insight UI to create a Connection Key.

**For local stdio / single-tenant:**
```env
CUAN_INSIGHT_AUTH_MODE=connection_key
CUAN_INSIGHT_CONNECTION_KEY=<your-connection-key>
```

**For hosted multi-user Streamable HTTP:**
Do not set a global connection key.
Client must send `x-cuan-mcp-connection-key` per request.

> Env-based Connection Key is for local/single-tenant use.
> Hosted multi-user deployments should pass `x-cuan-mcp-connection-key` per request.

### Self-Hosted Setup

Developer may self-host the MCP server.
They can either:

1. Still use Cuan Insight credential resolver with their own Connection Key, or
2. Extend/configure provider-token handling themselves if they want to bypass Cuan Insight.

For provider-token mode, set:
```env
BROKER_RUNTIME_MODE=local
META_ACCESS_TOKEN=<your-meta-access-token>
META_AD_ACCOUNT_ID=act_123456789
```

### xe2x9axa0xefxb8x8f Warning

A Connection Key gives access to ad data available to the organization in Cuan Insight.
Do not commit it.
Do not share it.
For hosted multi-user servers, never configure one shared global key.

### Prerequisites

1. **AI Agent** — Any MCP-compatible agent or client; Claude Desktop is one example
2. **Meta Access Token** — See [Authentication](#authentication)
3. **Ad Account ID** — Your Meta ad account ID (format: `act_123456789`)

### Configuration — Local Mode

Create `.mcp.json` in your project root (or add to existing):

```json
{
  "mcpServers": {
    "adstream-mcp": {
      "command": "node",
      "args": ["./node_modules/adstream-mcp/mcp-server/dist/index.js"],
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

### Configuration — Remote Mode with Cuan Insight

For hosted deployments using Cuan Insight as credential control plane:

**Recommended: Connection Key Mode**

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_AUTH_MODE=connection_key
CUAN_INSIGHT_CONNECTION_KEY=<key-from-cuan-insight-ui>
CUAN_INSIGHT_API_BASE_URL=https://your-cuan-insight-domain/functions/v1
CUAN_INSIGHT_SUPABASE_ANON_KEY=<supabase-anon-key-if-required>
```

- Key dibuat dari **Cuan Insight UI > AI/MCP Connectors**
- MCP server mengirim header `x-cuan-mcp-connection-key`
- Provider token tidak pernah ditampilkan ke AI client
- Key dapat di-revoke kapan saja dari UI

> Env-based Connection Key is for local/single-tenant use. Hosted multi-user deployments should pass `x-cuan-mcp-connection-key` per request.


**Legacy: MCP Token Mode (default, backward compatible)**

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_AUTH_MODE=mcp_token
CUAN_INSIGHT_MCP_TOKEN=<mcp-token>
CUAN_INSIGHT_API_BASE_URL=https://your-cuan-insight-domain/functions/v1
CUAN_INSIGHT_SUPABASE_ANON_KEY=<supabase-anon-key-if-required>
```

See [`docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md`](docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md) for full auth mode documentation.

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
npm install adstream-mcp
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
import { loadConfig } from 'adstream-mcp/config';
import { MetaClient } from 'adstream-mcp';
import { getCampaigns, getCampaignInsights } from 'adstream-mcp/tools';

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
- `getCampaigns()` — Fetch campaigns with filters
- `getCampaignInsights()` — Campaign-level performance metrics
- `getAdsetInsights()` — Ad set performance metrics
- `getAdsInsights()` — Individual ad metrics
- `generateDailyReport()` — Comprehensive daily analysis

All tools are **read-only**. For remote credential resolution via Cuan Insight, see [Remote Mode](#configuration--remote-mode-with-cuan-insight).

### Pagination

By default, insight tools return only the first page (up to 100 rows). To fetch all data across multiple pages, enable pagination:

```typescript
import { getCampaignInsights } from 'adstream-mcp';

const allInsights = await getCampaignInsights(client, {
  adAccountId: 'act_123456789',
  since: '2026-06-01',
  until: '2026-06-19',
  paginate: true,      // ← auto-fetch all pages
  pageDelay: 100,      // ms delay between pages
  maxPages: 10,        // safety limit
});

console.log(`Total: ${allInsights.length} rows`);
```

The client automatically handles Meta's cursor/after pagination, rate limit headers (`X-Ad-Account-Usage`), and HTTP 429 retries with exponential backoff.

Available options for all insight tools (`getCampaignInsights`, `getAdsetInsights`, `getAdsInsights`):

| Option | Default | Description |
|--------|---------|-------------|
| `paginate` | `false` | Enable multi-page fetching |
| `maxPages` | `10` | Max pages to fetch (safety limit) |
| `pageDelay` | `200` | Delay between pages (ms) |
| `limit` | `100` | Rows per page |

---

## Rule Engine

26 pre-built rule templates for automatic performance analysis:

- **E-Commerce** (6 rules) — ROAS, purchases, conversion optimization
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

### Option 3: Cuan Insight Connection Key (Hosted)

For hosted MCP deployments using Cuan Insight as credential control plane:

1. Generate Connection Key from **Cuan Insight UI > AI/MCP Connectors**
2. Set `CUAN_INSIGHT_AUTH_MODE=connection_key`
3. Set `CUAN_INSIGHT_CONNECTION_KEY=<key>`
4. MCP server resolves provider tokens via Cuan Insight — no direct Meta token needed

See [Remote Mode](#configuration--remote-mode-with-cuan-insight) for full setup.

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
adstream-mcp/
├── src/                          # TypeScript library
│   ├── metaClient.ts            # API wrapper
│   ├── config.ts                # Config loader
│   ├── types.ts                 # TypeScript types
│   ├── tools/                   # 6 API functions
│   ├── analysis/                # Analysis logic
│   ├── rules/                   # Rule engine + templates
│   ├── broker/                  # Credential broker (multi-provider)
│   │   ├── cuanInsightClient.ts # Cuan Insight HTTP client
│   │   ├── credentials.ts       # Credential resolver + redaction
│   │   ├── config.ts            # Broker config + env parsing
│   │   └── factory.ts           # Broker factory
│   └── utils/                   # Helpers
├── skills/                       # AI agent skills
│   └── meta-ads/
│       ├── audit/SKILL.md       # Audit skill
│       ├── manage/SKILL.md      # Management skill
│       └── shared/              # Shared references
├── mcp-server/                   # MCP server
│   └── src/
│       ├── index.ts             # Stdio entrypoint
│       ├── createServer.ts      # McpServer factory
│       └── http.ts              # HTTP/SSE/Streamable HTTP entrypoint
├── examples/                     # Code examples
└── tests/                        # Unit tests (239 tests)
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
- ✅ Connection Key auth mode (Phase 17.5C)
- 🔜 v0.4.0 — Write operations (pause, budget changes)
- 🔜 v0.5.0 — OAuth flow for skills
- 🔜 v0.6.0 — Multi-account support

---

## Security

- Do not commit `.env` or real credentials
- Do not print `providerToken`, connection keys, or `Authorization` headers
- Use `redactErrorMessage` / `redactTokenLikeValues` for safe error surfacing
- Run `gitleaks detect --source . --redact` if available
- See [`docs/KEAMANAN.md`](docs/KEAMANAN.md) for full security guidelines

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

- **GitHub:** https://github.com/ramadhanidiwanda-alt/adstream-mcp
- **npm:** https://www.npmjs.com/package/adstream-mcp
- **Issues:** https://github.com/ramadhanidiwanda-alt/adstream-mcp/issues
- **Meta Marketing API:** https://developers.facebook.com/docs/marketing-api
- **Docker MCP server setup:** [docs/DOCKER_MCP.md](docs/DOCKER_MCP.md)
- **Connection Key docs:** [docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md](docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md)

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
| Connection Key Auth | ✅ | ❌ | ❌ |

---

## Questions?

- **"Should I use skills or library?"** — Skills for ad-hoc analysis, library for automation
- **"Can I use both?"** — Yes! They're complementary
- **"Is this production-ready?"** — Yes for read operations, write ops coming in v0.4
- **"Does this work with other AI agents?"** — Yes, any MCP-compatible agent
- **"Can I self-host everything?"** — Yes, no external dependencies
- **"Connection Key vs MCP Token?"** — Connection Key is recommended for end-user AI connector setups; MCP Token for developer self-host

See [`SKILL_MIGRATION.md`](SKILL_MIGRATION.md) for more details on the architecture.
