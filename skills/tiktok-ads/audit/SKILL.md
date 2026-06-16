---
name: tiktok-ads-audit
description: TikTok Ads account audit and overview. Analyze TikTok ad account performance including regular campaigns and GMV Max (Shop Ads). Trigger on "audit my TikTok ads", "TikTok ads audit", "how's my TikTok account", "TikTok performance", "TikTok shop ads report", "GMV Max check", or when setting up TikTok for the first time.
argument-hint: "<account name or 'audit my TikTok ads'>"
---

# TikTok Ads Audit

Diagnose TikTok ad account health — both regular TikTok Ads campaigns and GMV Max (Shop Ads) performance. **Read-only** — never mutates the account.

## Setup

Follow `../shared/preamble.md` — MCP detection, config resolution, advertiser selection.

## Step 1: Account overview

Call `tiktok_list_advertisers` to get the selected advertiser's details.

Display:
- Advertiser name and ID
- Account status
- Currency and timezone

## Step 2: Campaign performance (regular TikTok Ads)

Call `tiktok_get_report` with these parameters:

```json
{
  "advertiserId": "<selected-advertiser-id>",
  "reportType": "BASIC",
  "dimensions": ["campaign_id"],
  "metrics": ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "conversions"],
  "dataLevel": "AUCTION_CAMPAIGN",
  "startDate": "<30-days-ago>",
  "endDate": "<today>"
}
```

Analyze the results:

### Performance flags
- **High CPM > $10** → May indicate competitive auction — suggest audience refinement or creative refresh
- **Low CTR < 0.5%** → Weak creative or poor targeting — suggest new ad creative
- **High CPC > $1** → Expensive clicks — check landing page relevance
- **No conversions** → Conversion tracking may be broken or campaign objective mismatch

### Report format

```
═══════════════════════════════════
📊 TikTok Ads Campaign Overview
Last 30 Days
═══════════════════════════════════

Total Spend:    ${spend}
Impressions:    {impressions}
Clicks:         {clicks}
CTR:            {ctr}%
CPC:            ${cpc}
CPM:            ${cpm}
Conversions:    {conversions}

{A flag per campaign with notable issues}
```

## Step 3: GMV Max (TikTok Shop Ads)

If the user mentions TikTok Shop or asks about GMV Max, call `tiktok_get_gmv_max_report`.

First, call `tiktok_list_advertisers` to discover available store IDs.

Then call `tiktok_get_gmv_max_report` with:

```json
{
  "advertiserId": "<selected-advertiser-id>",
  "storeIds": ["<store-id>"],
  "dimensions": ["campaign_id"],
  "metrics": ["gmv", "spend", "order_count", "roas", "impressions", "clicks"],
  "startDate": "<30-days-ago>",
  "endDate": "<today>"
}
```

### GMV Max analysis

Display:
- **GMV (Gross Merchandise Value)** — total sales value
- **Orders** — number of orders placed
- **ROAS** — return on ad spend (GMV ÷ spend)
- **Spend** — total ad spend

### GMV Max health check

- **ROAS < 2.0** → Underperforming — review product pricing or creative
- **High spend, low orders** → Product may not resonate — check product page conversion
- **Low impressions** → Budget or audience too narrow

### Report format

```
═══════════════════════════════════
🛒 TikTok Shop GMV Max Report
Last 30 Days
═══════════════════════════════════

Store:          {store-id}
GMV:            ${gmv}
Orders:         {orders}
Ad Spend:       ${spend}
ROAS:           {roas}x
Impressions:    {impressions}
Clicks:         {clicks}

{Actionable recommendations}
```

## Edge cases

### No data
If reports return empty lists:
> "No campaign data found for the selected date range. Your campaigns may be paused, or the date range may have no activity."

### Missing GMV Max
If the user asks for GMV Max but no store IDs are found:
> "No TikTok Shop stores found for this advertiser. GMV Max report requires an active TikTok Shop linked to your ad account."

### Token expired
If API calls return auth errors:
> "Your TikTok access token appears to be expired. Please refresh it from TikTok Ads Manager → Settings → API."

## After the audit

Suggest next steps based on findings:
- Regular campaigns with high CPM → "Try narrowing your audience targeting or refreshing your creative"
- GMV Max with low ROAS → "Check your product pricing and landing page conversion"
- No GMV Max campaigns → "Consider setting up GMV Max if you sell products on TikTok Shop"
