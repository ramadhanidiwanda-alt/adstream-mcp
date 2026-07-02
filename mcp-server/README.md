# Adstream MCP Server

MCP (Model Context Protocol) server wrapper for Adstream MCP. Enables MCP-compatible AI agents and clients to analyze ads and commerce data, starting with Meta and TikTok. Claude Desktop is one supported client example.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io) is an open protocol that standardizes how AI applications provide context to LLMs. This MCP server exposes Adstream MCP tools to any MCP-compatible client.

## Features

- **Broker MCP Tools** - Stable `ads_*` and `commerce_*` tools plus legacy provider-specific tools exposed via MCP protocol
- **Generic MCP Client Compatible** - Works with stdio-capable MCP clients; Claude Desktop is one example
- **Codex Compatible** - Works with Codex CLI
- **Auto-configured** - Uses environment variables for auth
- **Safety-first writes** - Read tools plus guarded campaign-level writes where configured
- **Commerce data surface** - TikTok GMV Max returns normalized records, totals, metadata, and warnings for AI-side reporting

## Current Stable Data Tools

- `ads_get_*_performance` supports Meta, Meta CPAS mode via `params.mode: "cpas"`, TikTok regular read paths, and Google Ads read paths when credentials/client are configured.
- `ads_get_placement_performance` supports Meta and TikTok placement analysis.
- `commerce_get_performance` supports TikTok GMV Max via `provider: "tiktok_gmv"` and returns normalized JSON, not narrative recommendations.

## Installation

### Option 1: From Parent Package

```bash
cd /Users/macbook/Projects/adstream-mcp
npm install
npm run build

cd mcp-server
npm install
npm run build
```

### Option 2: Global Install

```bash
npm install -g adstream-mcp-server
```

## Configuration

### Environment Variables

Set these in your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"
export META_API_VERSION="v20.0"
```

### Generic MCP Client Setup

For generic stdio and Docker setup, see [`../docs/MCP_CLIENT_SETUP.md`](../docs/MCP_CLIENT_SETUP.md).

### Claude Desktop Example

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "node",
      "args": [
        "/Users/macbook/Projects/adstream-mcp/mcp-server/dist/index.js"
      ],
      "env": {
        "META_ACCESS_TOKEN": "EAAxxxxxxxxxx",
        "META_AD_ACCOUNT_ID": "act_123456789"
      }
    }
  }
}
```

Restart Claude Desktop to load the server.

### Codex CLI Setup

Add to `~/.codex/config.json`:

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "node",
      "args": [
        "/Users/macbook/Projects/adstream-mcp/mcp-server/dist/index.js"
      ]
    }
  }
}
```

## Available Tools

### 1. meta_get_ad_accounts

Fetch all ad accounts accessible by the access token.

**Parameters:** None

**Example:**
```
User: "Show me my Meta ad accounts"
AI client: [calls meta_get_ad_accounts]
```

---

### 2. meta_get_campaigns

Fetch campaigns with optional filters.

**Parameters:**
- `adAccountId` (optional): Ad account ID (uses env default if not provided)
- `limit` (optional): Max campaigns to fetch (default: 50)
- `status` (optional): Filter by status array

**Example:**
```
User: "Show me all active campaigns"
AI client: [calls meta_get_campaigns with status: ["ACTIVE"]]
```

---

### 3. meta_get_campaign_insights

Fetch campaign-level performance insights.

**Parameters:**
- `adAccountId` (optional): Ad account ID
- `since` (required): Start date (YYYY-MM-DD)
- `until` (required): End date (YYYY-MM-DD)

**Example:**
```
User: "Show campaign performance from last week"
AI client: [calls meta_get_campaign_insights with date range]
```

---

### 4. meta_get_adset_insights

Fetch adset-level performance insights.

**Parameters:** Same as campaign insights

---

### 5. meta_get_ads_insights

Fetch ad-level performance insights.

**Parameters:** Same as campaign insights

---

### 6. meta_generate_daily_report

Generate comprehensive daily performance report with analysis.

**Parameters:**
- `adAccountId` (optional): Ad account ID
- `since` (required): Start date (YYYY-MM-DD)
- `until` (required): End date (YYYY-MM-DD)

**Example:**
```
User: "Generate a daily report for yesterday"
AI client: [calls meta_generate_daily_report with yesterday's date]
```

---

### 7. meta_analyze_with_rules

Analyze campaigns using 26 pre-built rule templates.

**Parameters:**
- `adAccountId` (optional): Ad account ID
- `since` (required): Start date (YYYY-MM-DD)
- `until` (required): End date (YYYY-MM-DD)
- `category` (optional): Rule category (ecommerce, leadgen, brand, general, all)

**Example:**
```
User: "Analyze my campaigns with e-commerce rules"
AI client: [calls meta_analyze_with_rules with category: "ecommerce"]
```

## Usage Examples

### With an MCP Client

Once configured, you can chat naturally:

**Example 1: Daily Report**
```
You: Check my Meta Ads performance from yesterday

AI client: I'll generate a daily report for your Meta Ads campaigns.
[calls meta_generate_daily_report]

Here's your performance summary for May 28, 2026:
- Total Spend: $4,500
- Total Clicks: 12,000
- Average CTR: 0.8%
- Average CPC: $0.38

Issues found:
1. [HIGH] Summer Sale Campaign - High spend but low CTR
   Action: Test new ad creatives

Want me to analyze any specific campaign?
```

**Example 2: Campaign Audit**
```
You: Audit all my campaigns from last week

AI client: I'll fetch insights and analyze your campaigns.
[calls meta_get_campaign_insights]
[calls meta_analyze_with_rules]

Campaign Audit (May 22-28):
- Analyzed: 12 campaigns
- Total Spend: $31,500

High Priority Issues (3):
1. Summer Sale - High spend, low CTR
2. Product Launch - Expensive conversions
...
```

**Example 3: Custom Analysis**
```
You: Show me campaigns with CTR below 0.5%

AI client: I'll fetch campaign insights and filter by CTR.
[calls meta_get_campaign_insights]

Found 3 campaigns with CTR below 0.5%:
1. Campaign A - CTR: 0.3%, Spend: $2,100
2. Campaign B - CTR: 0.4%, Spend: $1,800
...
```

### With Codex CLI

```bash
# Start Codex session
codex

# Natural language commands
> analyze my meta ads campaigns from last week
> show me campaigns with high CPC
> generate a daily report for yesterday
```

## Development

### Run in Development Mode

```bash
cd mcp-server
npm run dev
```

### Build

```bash
npm run build
```

### Test Locally

```bash
# Set environment variables
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"

# Run server
npm start
```

The server will run on stdio and wait for MCP protocol messages.

## Troubleshooting

### Server Not Starting

**Error:** `Failed to initialize Meta client`

**Solution:** Check environment variables are set:
```bash
echo $META_ACCESS_TOKEN
echo $META_AD_ACCOUNT_ID
```

### Tools Not Appearing in Your MCP Client

**Solution:**
1. Check your MCP client server config syntax
2. Restart the MCP client completely
3. Check your MCP client logs; for Claude Desktop, check `~/Library/Logs/Claude/mcp*.log`

### Invalid Token Error

**Error:** `Invalid OAuth access token`

**Solution:** Generate new token from [Graph API Explorer](https://developers.facebook.com/tools/explorer)

## Architecture

```
┌─────────────────┐
│  MCP Client     │
│  or AI Agent    │
└────────┬────────┘
         │ MCP Protocol
         │ (stdio)
┌────────▼────────┐
│  MCP Server     │
│  (this package) │
└────────┬────────┘
         │ Function Calls
┌────────▼────────┐
│  adstream-mcp   │
└────────┬────────┘
         │ HTTP
┌────────▼────────┐
│  Meta Graph API │
└─────────────────┘
```

## Security

- ✅ Tokens resolved at runtime (environment locally, Cuan Insight remotely)
- ✅ Read tools plus guarded campaign-level writes where configured
- ✅ Write operations require broker permission checks, confirmation, and audit
- ✅ Runs locally (no external server)

## Limitations

- Create operations are not supported yet
- Write operations require explicit configuration and permissions
- Requires valid Meta access token
- Rate limited by Meta API (200 calls/hour)

## Support

**Parent Package:** [adstream-mcp](https://github.com/ramadhanidiwanda-alt/adstream-mcp)  
**MCP Protocol:** https://modelcontextprotocol.io  
**Issues:** https://github.com/ramadhanidiwanda-alt/adstream-mcp/issues

## License

MIT
