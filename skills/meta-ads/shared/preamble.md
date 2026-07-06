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

1. Check for Adstream/Meta Ads MCP tools. Prefer canonical Adstream tools when available. The MCP server may be exposed under several different tool-name prefixes:
   - `mcp__meta_ads_agent_skill__*` — Your custom MCP server
   - `mcp__meta_ads__*` — Generic Meta Ads MCP
   - Any other prefix matching `mcp__.*meta.*ads__` 

   **How to detect:** scan your available tool list for canonical tools such as `ads_get_performance`, `ads_get_capabilities`, or `ads_list_campaigns`. If those are not present, fall back to legacy Meta tool names whose prefix references Meta.

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

### Preferred canonical tools

Use these generic Adstream MCP tools first when they are available:

- `ads_get_capabilities` — Discover available providers, levels, metrics, breakdowns, warnings, and optional writes.
- `ads_list_accounts` — List all accessible ad accounts.
- `ads_list_campaigns` — Get campaigns for an ad account.
- `ads_get_performance` — Get normalized performance rows using `provider: "meta"`, `accountId`, `since`, `until`, `level`, `metrics`, `dimensions`, `breakdowns`, `filters`, `limit`, and `cursor`.
- `ads_get_creatives` — Get creative-level metadata and metrics when supported.
- `commerce_get_performance` — Get commerce/SKU/product performance when available.

Legacy tools such as `getCampaignInsights`, `getAdsetInsights`, `getAdsInsights`, or `generateDailyReport` may still exist for compatibility. Use them only when canonical tools are unavailable. Do not request new MCP report tools for daily reports, weekly reports, audits, or recommendations; build those narratives in the AI response from canonical data.

### Reads vs. guarded writes

Read operations are the default path. The core analysis tools fetch data and summarize performance.

Campaign-level write operations may be available in broker mode on newer servers. Supported campaign mutations are pause, resume, budget update, rename, and guarded ecommerce campaign bundle creation. These must always follow the safety workflow:

1. Clarify objective, scope, and mode first.
2. Run a dry-run/preview before execution.
3. Show the before/after diff and risk.
4. Ask for explicit confirmation after the dry-run result.
5. Execute only the exact confirmed operation.
6. Never log or expose access tokens, provider tokens, connection keys, or authorization headers.

Unsupported write operations outside the guarded ecommerce launch bundle — arbitrary ad set/ad writes, targeting changes, creative upload variations, and non-sales campaign creation — should be handled as analysis or recommendation tasks. Explain the limitation and offer to prepare a safe implementation plan or Meta Ads Manager instructions.

Config is loaded. Hand control back to the invoking skill.
