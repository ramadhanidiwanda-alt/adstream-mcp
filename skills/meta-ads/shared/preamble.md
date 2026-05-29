# Meta Ads Shared Preamble

Every meta-ads skill reads this before doing anything else. Handles MCP detection, config resolution, and onboarding so individual skills don't repeat this logic.

## Step 1: Resolve config

Read config from three locations and merge fields (first non-null, non-empty-string value wins per field):

1. **Project-level** — `.meta-ads.json` in the repository root
2. **User-level** — `~/.meta-ads/config.json`
3. **Environment variables** — `META_AD_ACCOUNT_ID`, `META_ACCESS_TOKEN`

Each file uses the same shared schema:

```json
{
  "adAccountId": "act_123456789",
  "accessToken": "EAAxxxxx...",
  "apiVersion": "v20.0"
}
```

### Resolved data directory

Data files (business-context, personas, account-baseline) are stored project-locally when a project-level config exists:

- If `.meta-ads.json` exists in the current working directory → `{data_dir}` = `.meta-ads/` (relative to project root)
- Otherwise → `{data_dir}` = `~/.meta-ads/`

Create `{data_dir}` if it doesn't exist. Throughout this document and all skills, `{data_dir}` refers to this resolved directory.

**Important:** If using project-local storage (`.meta-ads/`), ensure `.meta-ads.json` and `.meta-ads/` are in the project's `.gitignore` — they contain business-sensitive data that should not be committed.

Continue to Step 2 (MCP detection always runs).

## Step 2: MCP Server Detection

Always verify that a Meta Ads MCP server is available.

1. Check for Meta Ads MCP tools. The MCP server may be exposed under several different tool-name prefixes:
   - `mcp__meta_ads_agent_skill__*` — Your custom MCP server
   - `mcp__meta_ads__*` — Generic Meta Ads MCP
   - Any other prefix matching `mcp__.*meta.*ads__` 

   **How to detect:** scan your available tool list for any tool whose name contains `getCampaigns` or `getInsights` AND whose prefix references Meta. Take everything before the tool name as the detected prefix.

2. If no MCP server exists, guide the user:

> No Meta Ads MCP server detected.
>
> You need to configure an MCP server for Meta Ads. Options:
> 1. Use the built-in MCP server from this project (see `mcp-server/README.md`)
> 2. Use NotFair's hosted MCP server (https://notfair.co/api/mcp/meta_ads)
> 3. Configure your own Meta Ads MCP server
>
> After configuration, restart your AI agent and try again.

Stop here until the MCP server is available.

If `adAccountId` was already resolved in Step 1, skip to Step 3. Otherwise, prompt the user for their Meta Ad Account ID.

## Step 3: Calling tools

Use whichever MCP server prefix was detected in Step 2:

- **Your MCP server:** `mcp__meta_ads_agent_skill__<toolName>`
- **Generic Meta MCP:** `mcp__meta_ads__<toolName>`

Always call tools under the exact prefix detected in Step 2 — do not hardcode any prefix.

### Available tools (from your library)

Based on your MCP server implementation, these tools should be available:

- `getAdAccounts` — List all ad accounts
- `getCampaigns` — Get campaigns for an ad account
- `getCampaignInsights` — Get insights for campaigns
- `getAdsetInsights` — Get insights for ad sets
- `getAdsInsights` — Get insights for individual ads
- `generateDailyReport` — Generate automated daily report

### Reads vs. writes

Your current implementation is **read-only**. All tools fetch data and analyze performance. There are no mutation operations (pause, budget changes, etc.).

When the user asks for write operations (pause campaign, change budget, etc.), explain:

> This skill is currently read-only. I can analyze your Meta Ads performance and provide recommendations, but I cannot make changes directly. You'll need to implement those changes in Meta Ads Manager.

Config is loaded. Hand control back to the invoking skill.
