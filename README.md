# adstream-mcp

Open-source MCP connector and data access layer for ads and commerce analytics, powered by Cuan Insight credentials.

`adstream-mcp` connects AI clients to provider data from Meta, TikTok, Google, and commerce/marketplace sources through small, generic, reusable tools. The project is intentionally not a central recommendation engine, benchmark engine, or automated audit product.

```text
MCP = data access and safe provider actions
Skills / prompts = how to fetch, compare, and interpret data
AI = analysis, report narrative, recommendations, and brand context
```

## Positioning

The core product boundary is:

- **MCP core:** provider-agnostic tools, input validation, normalized data envelopes, pagination, warnings, capability metadata, and safe action lifecycle.
- **Provider adapters:** Meta/TikTok/Google/native API mapping behind a consistent public contract.
- **Cuan Insight credential layer:** organization/workspace-scoped credential resolution without exposing tokens to the AI client.
- **Library utilities:** TypeScript helpers used by the broker, adapters, examples, and tests.
- **AI skills:** markdown instructions and heuristics that teach an AI how to produce audits, weekly reports, comparisons, and recommendations from generic data tools.
- **Optional write tools:** scoped mutation tools that remain separate from read-only analytics and require explicit safety checks.

MCP provides structured data. AI and skills provide reasoning.

## Target MCP Tool Surface

The intended public API should stay small:

| Tool                          | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `ads_list_accounts`           | List accessible ads accounts                                          |
| `ads_list_campaigns`          | List campaign identity/status metadata                                |
| `ads_get_performance`         | Fetch normalized ads performance rows across levels                   |
| `ads_get_creatives`           | Fetch creative metadata and creative metrics                          |
| `ads_resolve_creative_assets` | Resolve ranked image/video thumbnail URLs for creatives (Meta)        |
| `ads_get_change_history`      | Fetch provider change history when available                          |
| `ads_get_capabilities`        | Discover supported providers, metrics, breakdowns, levels, and writes |
| `commerce_get_performance`    | Fetch commerce/SKU/product/order performance when available           |

## Write tools (scoped mutations; creation tools use dry-run + confirmation):

| Tool                                  | Purpose                                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ads_create_campaign`                 | Create a campaign under an ad account                                                                                         |
| `ads_create_adset`                    | Create an ad set with pre-flight validation (bid strategy, CBO, budget)                                                       |
| `ads_create_adcreative`               | Create ad creative with page link, media, existing post, messaging CTA, `pageWelcomeMessage`, or `welcomeMessageTemplateName` |
| `ads_create_ad`                       | Create an ad linking ad set and creative                                                                                      |
| `ads_update_adset`                    | Update ad set settings (budget, status, targeting)                                                                            |
| `ads_pause_campaign`                  | Pause an active campaign                                                                                                      |
| `ads_resume_campaign`                 | Resume a paused campaign                                                                                                      |
| `ads_update_campaign_budget`          | Change campaign daily budget                                                                                                  |
| `ads_rename_campaign`                 | Rename a campaign                                                                                                             |
| `ads_archive_ad`                      | Archive an ad or campaign                                                                                                     |
| `ads_delete_audience`                 | Permanently delete a Meta Custom Audience (including product/dynamic audiences)                                               |
| `ads_upload_image`                    | Upload image to Meta Ads Image Library                                                                                        |
| `ads_upload_video`                    | Upload video to Meta Ads Video Library                                                                                        |
| `ads_create_welcome_message_template` | Save a local reusable Messenger/Instagram welcome message template                                                            |
| `ads_list_welcome_message_templates`  | List local reusable welcome message templates                                                                                 |
| `ads_create_product_audience`         | Create a dynamic product (catalog retargeting) audience for CPAS                                                              |
| `ads_list_audiences`                  | List Meta Custom Audiences, including product audiences                                                                       |
| `ads_create_custom_audience`          | Create a WEBSITE custom audience (pixel-based retargeting)                                                                    |
| `ads_create_pixel`                    | Create a Meta Pixel for conversion tracking (an ad account can only have one)                                                 |

## WhatsApp Discovery Tools (read-only, Meta-specific)

| Tool                                  | Purpose                                                      |
| ------------------------------------- | ------------------------------------------------------------ |
| `ads_list_whatsapp_accounts`          | Discover WhatsApp Business Accounts (owned + client-shared)  |
| `ads_list_whatsapp_phone_numbers`     | List phone numbers per WABA (get `phone_number_id` for CTWA) |
| `ads_list_whatsapp_message_templates` | List WhatsApp message templates (filter by name/status)      |

### Standard and Collaborative Ads creative formats

**Standard Ads** are regular Meta campaigns that use the advertiser's own assets and destinations. **Collaborative Ads** use a catalog or product set that a retailer has already shared with the advertiser; this connector does not request the partnership or create the shared product set.

Use `ads_list_catalogs(businessId)` to find the `productSetId`/catalog ID before building a CPAS campaign. It merges two Meta Business edges: `owned_product_catalogs` (catalogs the business owns) and `client_product_catalogs` (catalog segments a retailer shared with the business via Collaborative Ads' Collaboration Center). A CPAS brand's own catalog is frequently empty — it only has retailer-shared segments — so both are always queried; each result is tagged `source: "owned" | "client"`, and client-sourced rows include `permitted_roles`.

Standard Ads creation supports `single_image`, `video`, `carousel`, `catalog`, `collection`, and `existing_post`. Dynamic Creative / Flexible asset-feed creation is disabled in this connector. The initial Collaborative Ads support covers `single_image`, `video`, `carousel`, `catalog`, and `collection`. Collaborative `existing_post` remains unsupported because its account- and catalog-specific compatibility cannot yet be validated safely.

Use the same four tools for either mode: create the campaign with `ads_create_campaign`, create one ad set with `ads_create_adset`, create each format separately with `ads_create_adcreative`, then connect each creative to that ad set with `ads_create_ad`. One `adsetId` can be reused by compatible manual formats such as image and video ads, but do not mix manual/static ads with Dynamic Creative, flexible asset-feed, catalog/product, or placement-customized asset-feed ads in the same Ad Set. The `ads_create_ad` dry-run checks the target Ad Set's existing ads first and blocks mismatched creative families before Meta returns error `#1885274`. A `collection` creative must reuse an existing `instantExperienceId`—the connector does not build Instant Experience content.

For an existing Instagram post/Reel that clicks to Instagram Direct, keep the post reference as `creativeSpec.sourceInstagramMediaId`; do not upload the media again. Use `callToAction: "INSTAGRAM_MESSAGE"`, `appDestination: "INSTAGRAM_DIRECT"`, and `destinationUrl: "https://www.instagram.com/"` so the Graph payload includes both `call_to_action.value.app_destination` and `call_to_action.value.link`. Add either an inline `pageWelcomeMessage` or a reusable `welcomeMessageTemplateName`; the template expands into `pageWelcomeMessage` before creative creation.

The four creation tools above use dry-run by default and execute only when `dryRun=false` and `confirmed=true` are both supplied. Created campaigns, ad sets, and ads default to `PAUSED`, so review the returned preview and IDs in Meta Ads Manager before activation.

#### Catalog creative format options

For `creativeFormat: 'catalog'`, `creativeSpec` also accepts (all live-verified at v25.0): `showMultipleImages` (show multiple product photos per card — Meta requires `multi_share_end_card: false` alongside it, applied automatically), `preferredImageTags` (prioritize catalog images by tag), `formatOption` (e.g. `carousel_slideshows`), and `categorizationCriteria` (category-based dynamic ads instead of per-product — the catalog needs enough items per category or Meta rejects the create with a clear error, not silently). **`showMultipleImages` and `formatOption` cannot be combined** — Meta rejects both together as `ObjectStorySpecRedundant`; this connector validates that before calling Meta.

Meta's catalog ads also auto-generate video from product images by default (`media_type_automation`, `enroll_status: OPT_IN`) since October 2025 — no code or extra field is needed here to get it; every catalog creative already created through this connector has it live-verified as active. To opt out for a specific creative, pass `optOutEnhancements: ['media_type_automation']` on `ads_create_adcreative` (the existing generic Advantage+ opt-out mechanism), though note that catalog-format creatives don't currently route `optOutEnhancements` into `degrees_of_freedom_spec` the way single_image/video/carousel do.

### Copy variations vs Dynamic Creative

When a marketer asks for several headline/caption/copy/image/video options, treat that as manual creative testing by default: create separate manual creatives/ads, each with one chosen media asset, one `primaryText`, and one `headline`; or use carousel cards when the intended format is a carousel. Do not switch to Dynamic Creative just because there are multiple copy or media options.

### Audiences (CPAS retargeting)

`ads_create_product_audience` builds the retargeting half of the standard CPAS pattern: a "prospecting" ad set with no audience, plus a "retargeting" ad set targeting people who viewed or added-to-cart a catalog product but did not purchase. It creates the audience via `POST /act_{id}/product_audiences` from a `productSetId` and typed `inclusions`/`exclusions` (event + retention window in seconds); Meta's own examples commonly use 14 days for `ViewContent`, 7 days for `AddToCart`, and a 30-day `Purchase` exclusion, but this connector never applies those as silent defaults — pass them explicitly.

`ads_create_custom_audience` currently supports only `subtype: WEBSITE` (pixel-based website-visitor retargeting); its `rule` field is the raw Website Custom Audience Rule object from Meta's own rule builder/reference, passed through unmodified.

Use `ads_list_audiences` to find an existing audience's `id`, then pass that `id` into `ads_create_adset`'s `targeting.customAudiences` (or `targeting.excludedCustomAudiences` to exclude it) — the same field that already accepts any Custom Audience ID today.

`ads_delete_audience` permanently deletes a Custom Audience (including product/dynamic audiences). Like `ads_archive_ad`, deletion cannot be undone via the API, so it requires `ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS=true` in addition to `ADSTREAM_ENABLE_WRITES=true`.

Do not use Dynamic Creative / Flexible asset-feed for new creates. `creativeFormat: "flexible"` and `isDynamicCreative: true` are rejected so the MCP cannot accidentally create a Dynamic Creative family. `assetFeedSpec` and nested `objectStorySpec.asset_feed_spec` are accepted only for placement customization with `asset_customization_rules`, including image/video media tailored per placement. Simple creatives using one media asset, one `primaryText`, and one `headline` remain supported.

Write tools are turned off by default for safety, so only read tools appear until you enable them. Set `ADSTREAM_ENABLE_WRITES=true` to expose the write tools above. While they are off, calling one returns a `WRITE_TOOLS_DISABLED` error that explains how to enable them, and `ads_get_capabilities` reports `writes.enabled: false`.

Archiving or deleting a campaign, ad set, ad, or audience is permanent — Meta treats `ARCHIVED` and `DELETED` as equally irreversible (neither can be reverted via the API), and Custom Audience deletion is a real object delete with no undo. These calls (`ads_archive_ad`, `ads_delete_audience`, and `ads_update_ad`/`ads_update_campaign` when setting status to `ARCHIVED` or `DELETED`) need a second, separate flag: `ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS=true`, off by default. Without it they fail with `DESTRUCTIVE_ACTIONS_DISABLED` even if `ADSTREAM_ENABLE_WRITES` is on.

Legacy and provider-specific tools remain available for compatibility, but new report-specific tools should be avoided. Daily reports, weekly reports, creative audits, KPI scoring, and recommendations should be implemented as AI/skill workflows over the same canonical data tools.

`ads_get_performance`, `ads_get_creatives`, `ads_get_change_history`, and `ads_get_capabilities` are available as non-breaking canonical entry points. Existing level-specific and provider-specific tools remain for compatibility during migration.

## Design Principles

1. Less is more: fewer tools, stronger schemas.
2. One data need should have one main tool path.
3. Public MCP inputs should use canonical names such as `provider`, `accountId`, `since`, `until`, `level`, `metrics`, `dimensions`, `breakdowns`, `filters`, `limit`, and `cursor`.
4. Provider-native terms belong inside adapters unless explicitly documented as extensions.
5. Responses should include structured rows, metadata, pagination, warnings, data freshness, unsupported metrics, and provider capabilities.
6. Missing commerce, SKU, attribution, or conversion mapping data must be stated clearly instead of inferred.
7. Write operations are opt-in, scoped, and governed by `docs/WRITE_SAFETY_CONTRACT.md`.

## Documentation Map

- `docs/ARCHITECTURE.md` explains the MCP, broker, adapter, skill, AI client, and Cuan Insight boundaries.
- `docs/MCP_API_DESIGN.md` defines the target tool surface and canonical input/output contracts.
- `docs/LEGACY_AND_MIGRATION.md` inventories current tools and maps them toward canonical replacements.
- `docs/WRITE_SAFETY_CONTRACT.md` defines required safety behavior for mutations.
- `skills/README.md` explains how skills should sit above MCP data tools.

---

## MCP Server Setup

### 1. Minimal (via npx — no install needed)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "npx",
      "args": ["-y", "adstream-mcp"],
      "env": {
        "META_ACCESS_TOKEN": "EAAxxxxxxxxxx"
      }
    }
  }
}
```

> `META_AD_ACCOUNT_ID` is **optional**. AI agent can call `ads_list_accounts` first to discover available accounts.

### 2. Local Install

```bash
git clone https://github.com/ramadhanidiwanda-alt/adstream-mcp.git
cd adstream-mcp
npm install && npm run build
```

Then in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "node",
      "args": ["/path/to/adstream-mcp/dist/mcp/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "EAAxxxxxxxxxx"
      }
    }
  }
}
```

### 3. Docker (Production / Self-Hosted)

```bash
docker compose up -d
```

The HTTP MCP server listens on `http://127.0.0.1:8000` (configurable via env).

See [docs/DOCKER_MCP.md](docs/DOCKER_MCP.md) for full Docker setup.

### 4. Remote Mode (Cuan Insight Credential Broker)

For hosted multi-user deployments with credential resolution via Cuan Insight:

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "npx",
      "args": ["-y", "adstream-mcp"],
      "env": {
        "CUAN_INSIGHT_AUTH_MODE": "connection_key",
        "CUAN_INSIGHT_CONNECTION_KEY": "<your-connection-key>"
      }
    }
  }
}
```

See [Remote Mode](#configuration--remote-mode-with-cuan-insight) for full setup.

### Environment Variables

| Variable                              | Required | Default | Description                                                                                                                                                             |
| ------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `META_ACCESS_TOKEN`                   | ✅       | —       | Meta Ads access token                                                                                                                                                   |
| `META_AD_ACCOUNT_ID`                  | ❌       | —       | Default ad account (optional, AI can pick via `ads_list_accounts`)                                                                                                      |
| `META_API_VERSION`                    | ❌       | `v25.0` | Meta Graph API version                                                                                                                                                  |
| `TIKTOK_ACCESS_TOKEN`                 | ❌       | —       | TikTok Ads access token                                                                                                                                                 |
| `MCP_HTTP_ENABLED`                    | ❌       | `false` | Enable HTTP transport                                                                                                                                                   |
| `ADSTREAM_ENABLE_WRITES`              | ❌       | `false` | Expose the optional write tools; off by default so only read tools appear                                                                                               |
| `ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS` | ❌       | `false` | Separate kill switch for archive/delete calls (`ads_archive_ad`, `ads_delete_audience`, `ARCHIVED`/`DELETED` status changes); off by default even if writes are enabled |
| `CUAN_INSIGHT_AUTH_MODE`              | ❌       | —       | Set to `connection_key` for remote mode                                                                                                                                 |

---

## Quick Start

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
  fields: ['id', 'name', 'status', 'objective'],
});

// Get insights
const insights = await getCampaignInsights(client, {
  adAccountId: config.adAccountId,
  datePreset: 'last_30d',
});

console.log(`Found ${campaigns.length} campaigns`);
console.log(`Total spend: $${insights.reduce((sum, i) => sum + i.spend, 0)}`);
```

### Current Library Utilities

The TypeScript library still exports legacy Meta-focused helpers for compatibility:

- `getAdAccounts()` — List Meta ad accounts
- `getCampaigns()` — Fetch campaign metadata
- `getCampaignInsights()` — Fetch campaign-level performance metrics
- `getAdsetInsights()` — Fetch ad set performance metrics
- `getAdsInsights()` — Fetch individual ad metrics
- `generateDailyReport()` — Legacy report utility; prefer AI/skill workflows over canonical performance data for new work

The target MCP surface is documented in `docs/MCP_API_DESIGN.md`. Optional write tools exist separately and are governed by `docs/WRITE_SAFETY_CONTRACT.md`. For remote credential resolution via Cuan Insight, see [Remote Mode](#configuration--remote-mode-with-cuan-insight).

### Pagination

By default, insight tools return only the first page (up to 100 rows). To fetch all data across multiple pages, enable pagination:

```typescript
import { getCampaignInsights } from 'adstream-mcp';

const allInsights = await getCampaignInsights(client, {
  adAccountId: 'act_123456789',
  since: '2026-06-01',
  until: '2026-06-19',
  paginate: true, // ← auto-fetch all pages
  pageDelay: 100, // ms delay between pages
  maxPages: 10, // safety limit
});

console.log(`Total: ${allInsights.length} rows`);
```

The client automatically handles Meta's cursor/after pagination, rate limit headers (`X-Ad-Account-Usage`), and HTTP 429 retries with exponential backoff.

Available options for all insight tools (`getCampaignInsights`, `getAdsetInsights`, `getAdsInsights`):

| Option      | Default | Description                       |
| ----------- | ------- | --------------------------------- |
| `paginate`  | `false` | Enable multi-page fetching        |
| `maxPages`  | `10`    | Max pages to fetch (safety limit) |
| `pageDelay` | `200`   | Delay between pages (ms)          |
| `limit`     | `100`   | Rows per page                     |

---

## Rule Engine

The repository includes legacy rule templates and analysis utilities. Treat these as library utilities or skill references, not the direction for new MCP core APIs. New recommendation, benchmark, scoring, or report workflows should live in skills/AI prompts that call canonical data tools.

See `docs/LEGACY_AND_MIGRATION.md` for the migration classification.

---

## Authentication

You need a Meta Access Token with `ads_read` and `ads_management` permissions.

> **Important:** Write tools (create campaign, ad set, creative, ad, upload media) require `ads_management` permission. Read-only tools only need `ads_read`.

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
4. Assign the System User to your Ad Account with **Analyst** role (or **Advertiser** role for write access)
5. Click **Generate New Token**
6. Select `ads_read` and `ads_management` permissions
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

### For AI Clients and Skills

- Fetch normalized ads and commerce data
- Compare periods and entities
- Inspect warnings, unsupported metrics, and data freshness
- Build narrative reports and recommendations outside MCP core

### For Developers

- Build custom dashboards on provider data
- Integrate normalized ads/commerce metrics into internal systems
- Self-host an MCP server with scoped credentials
- Add provider adapters behind canonical contracts

---

## Architecture

```
adstream-mcp/
├── src/                          # TypeScript library + MCP server
│   ├── index.ts                 # Library barrel export
│   ├── metaClient.ts            # Meta API wrapper
│   ├── config.ts                # Config loader (META_ACCESS_TOKEN optional)
│   ├── types.ts                 # TypeScript types
│   ├── mcp/                     # MCP server entry points
│   │   ├── index.ts             # Stdio entrypoint (Claude Desktop, Codex)
│   │   ├── http.ts              # HTTP/SSE/Streamable HTTP server
│   │   └── createServer.ts      # McpServer factory (all tools)
│   ├── tools/                   # Library helpers and write utilities
│   ├── analysis/                # Analysis utilities
│   ├── rules/                   # Rule templates
│   ├── broker/                  # Credential broker (multi-provider)
│   │   ├── cuanInsightClient.ts # Cuan Insight HTTP client
│   │   ├── credentials.ts       # Credential resolver + redaction
│   │   ├── config.ts            # Broker config + env parsing
│   │   └── factory.ts           # Broker factory
│   └── utils/                   # Helpers
├── skills/                       # AI instruction/heuristic layer
│   └── meta-ads/
│       ├── audit/SKILL.md       # Audit skill
│       ├── manage/SKILL.md      # Management skill
│       └── shared/              # Shared references
├── dist/                         # Build output
│   ├── index.js                 # Library (import 'adstream-mcp')
│   └── mcp/
│       ├── index.js             # CLI binary (npx adstream-mcp)
│       └── http.js              # HTTP server (node dist/mcp/http.js)
├── examples/                     # Code examples
└── tests/                        # Unit tests (480+ tests)
```

---

## Examples

See [`examples/`](examples/) directory:

- `daily-report.ts` — Legacy report utility example
- `campaign-audit.ts` — Legacy campaign audit example
- `canonical-migration.ts` — Canonical `ads_get_performance` migration example
- `rule-engine-demo.ts` — Legacy rule engine example
- `rule-templates-demo.ts` — Legacy rule template example

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
- ✅ v0.4.0 — Write operations (campaign, ad set, creative, ad, media upload)
- ✅ v0.5.0 — Pre-flight bid strategy validation (bid_amount, CBO detection, subcode mapping)
- 🔜 v0.6.0 — OAuth flow for skills
- 🔜 v0.7.0 — Multi-account support

---

## Security

- Do not commit `.env` or real credentials
- Do not print `providerToken`, connection keys, or `Authorization` headers
- Use `redactErrorMessage` / `redactTokenLikeValues` for safe error surfacing
- Run `gitleaks detect --source . --redact` if available
- See [`docs/WRITE_SAFETY_CONTRACT.md`](docs/WRITE_SAFETY_CONTRACT.md) for full write-safety guidelines

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

| Feature             | This Project                             | NotFair    | Meta Official |
| ------------------- | ---------------------------------------- | ---------- | ------------- |
| TypeScript Library  | ✅                                       | ❌         | ❌            |
| AI Skills           | ✅                                       | ✅         | ❌            |
| Self-hosted MCP     | ✅                                       | ❌ (cloud) | N/A           |
| Read Operations     | ✅                                       | ✅         | ✅            |
| Write Operations    | ✅ (creation tools: dry-run + confirmed) | ✅         | ✅            |
| Rule Engine         | ✅                                       | ❌         | ❌            |
| Open Source         | ✅                                       | ✅         | ✅            |
| Target Audience     | Both                                     | End users  | Developers    |
| Connection Key Auth | ✅                                       | ❌         | ❌            |

---

## Questions?

- **"Should I use skills or library?"** — Skills for ad-hoc analysis, library for automation
- **"Can I use both?"** — Yes! They're complementary
- **"Is this production-ready?"** — Yes. Read tools are stable, write tools have operation-specific safety checks, and the four creation tools use dry-run plus confirmation. Pre-flight bid validation is included.
- **"Does this work with other AI agents?"** — Yes, any MCP-compatible agent
- **"Can I self-host everything?"** — Yes, no external dependencies
- **"Connection Key vs MCP Token?"** — Connection Key is recommended for end-user AI connector setups; MCP Token for developer self-host

