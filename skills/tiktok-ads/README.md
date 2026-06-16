# TikTok Ads Skills

AI-native skills for TikTok Ads analysis. Ask your AI agent in natural language — no code required.

## Available Skills

### `tiktok-ads-audit`
Comprehensive TikTok ad account audit. Analyzes both regular TikTok Ads campaigns and GMV Max (Shop Ads) performance.

**Trigger phrases:**
- "audit my TikTok ads"
- "how's my TikTok account"
- "TikTok shop ads report"
- "GMV Max check"

## Setup

TikTok Ads skills require the MCP server to be configured with:
- `TIKTOK_ACCESS_TOKEN` — OAuth token from TikTok Ads Manager
- `TIKTOK_ADVERTISER_ID` — (optional) default advertiser account

## MCP Tools Used

| Tool | Description |
|---|---|
| `tiktok_list_advertisers` | List accessible advertiser accounts |
| `tiktok_get_report` | Fetch campaign/adgroup/ad-level performance |
| `tiktok_get_gmv_max_report` | Fetch GMV Max (Shop Ads) performance |

## Supported Features

- ✅ Regular TikTok Ads campaign performance (spend, impressions, clicks, CTR, CPC, CPM, conversions)
- ✅ GMV Max / TikTok Shop Ads (GMV, orders, ROAS)
- ✅ Multi-level reporting (campaign, adgroup, ad)
- ✅ Date range filtering
- ✅ Natural language question support

## API Reference

Based on TikTok Business API v1.3:
- Reporting: `GET /open_api/v1.3/report/integrated/get/`
- GMV Max: `GET /open_api/v1.3/gmv_max/report/get/`
- Advertiser: `GET /open_api/v1.3/advertiser/info/`

[Official TikTok API Docs](https://business-api.tiktok.com/portal/docs)
[Business API SDK](https://github.com/tiktok/tiktok-business-api-sdk)
