# TikTok Ads Shared Preamble

Every tiktok-ads skill reads this before doing anything else. Handles MCP detection, config resolution, and onboarding so individual skills don't repeat this logic.

## Step 1: Detect MCP availability

Check if an Adstream/TikTok MCP server is connected by listing available tools. Prefer canonical Adstream tools first:

If any of these canonical tools are found:
- `ads_get_capabilities`
- `ads_list_accounts`
- `ads_get_performance`
- `commerce_get_performance`

Then MCP is active. Use `provider: "tiktok"` for TikTok Ads requests. Skip to Step 2.

If canonical tools are unavailable, fall back to legacy TikTok tools starting with `tiktok_`:

If any of these tools are found:
- `tiktok_list_advertisers`
- `tiktok_get_report`
- `tiktok_get_gmv_max_report`

Then MCP is active in legacy mode. Skip to Step 2.

If none are found, explain to the user:
> "To analyze TikTok Ads, you need to connect the TikTok MCP server. Go to your MCP client settings and add the TikTok Ads MCP server configuration."

## Step 2: Resolve config

Read config from environment variables:

1. `TIKTOK_ACCESS_TOKEN` — OAuth access token for TikTok Business API
2. `TIKTOK_ADVERTISER_ID` — advertiser account ID (required for reporting)

If `TIKTOK_ACCESS_TOKEN` is not set:
> "To analyze TikTok Ads, set your TIKTOK_ACCESS_TOKEN environment variable. Get one from TikTok Ads Manager → Settings → API."

If `TIKTOK_ADVERTISER_ID` is not set:
> "Set TIKTOK_ADVERTISER_ID in your environment for default account selection."

## Step 3: Select advertiser

Call `ads_list_accounts` with `provider: "tiktok"` to get all accessible accounts. If only legacy tools are available, call `tiktok_list_advertisers` instead.

If only one account is found, auto-select it.
If multiple accounts, let the user choose:

```
Found {N} TikTok advertiser accounts:

1. {name} (ID: {id})
2. {name} (ID: {id})
3. {name} (ID: {id})

Which account would you like to analyze?
```

## Data directory

Data files are stored in:
- `~/.tiktok-ads/` — user-level (default)
- `.tiktok-ads/` — project-level (if `.tiktok-ads.json` config exists)

## Capabilities summary

| Tool | What It Does |
|---|---|
| `ads_get_capabilities` | Discover supported TikTok levels, metrics, breakdowns, warnings, and limitations |
| `ads_list_accounts` | List accessible advertiser accounts with `provider: "tiktok"` |
| `ads_get_performance` | Fetch campaign/adgroup/ad-level performance with `provider: "tiktok"` |
| `commerce_get_performance` | Fetch commerce/GMV Max performance when available |

Legacy tools such as `tiktok_list_advertisers`, `tiktok_get_report`, and `tiktok_get_gmv_max_report` may still exist for compatibility. Use them only when canonical tools are unavailable.

## Common report dimensions

- `campaign_id`, `campaign_name`
- `adgroup_id`, `adgroup_name`
- `ad_id`, `ad_name`

## Common report metrics

- `spend` — total spend
- `impressions` — ad impressions
- `clicks` — total clicks
- `ctr` — click-through rate
- `cpc` — cost per click
- `cpm` — cost per mille (1000 impressions)
- `conversions` — total conversions
- `conversion_value` — total conversion value
- `roas` — return on ad spend

## GMV Max specific dimensions

- `campaign_id`, `adgroup_id`, `ad_id`
- `product_id` — TikTok Shop product
- `store_id` — TikTok Shop store

## GMV Max specific metrics

- `gmv` — Gross Merchandise Value
- `order_count` — number of orders
- `spend` — ad spend
- `roas` — return on ad spend
