# Roadmap: adstream-mcp

**Current Version:** v0.6.0
**Last Updated:** 2026-07-21

---

## Vision

Menjadi **open-source Ads + Commerce MCP connector hub** untuk AI agents dan developers — menggabungkan TypeScript library, MCP server, AI-native skills, dan Cuan Insight sebagai credential control plane.

**Target Audience:**
- 🎯 Primary: End users (marketers) via AI skills
- 🎯 Secondary: Developers via TypeScript library + MCP
- 🎯 Tertiary: Agencies and Cuan Insight workspaces managing multiple providers/accounts

---

## Completed ✅

### v0.1.0 (2026-05-27) - Foundation
- ✅ Core MetaClient wrapper
- ✅ 6 read-only tools (campaigns, insights at all levels)
- ✅ Basic analysis & recommendations
- ✅ MCP server implementation
- ✅ TypeScript types & Zod validation

### v0.2.0 (2026-05-28) - Rule Engine
- ✅ Flexible rule system (AND/OR logic, 6 operators)
- ✅ 26 pre-built rule templates (4 categories)
- ✅ Priority-based recommendations
- ✅ Custom rule creation

### v0.3.0 (2026-05-29) - AI Skills Layer
- ✅ Markdown-based skills (audit, manage)
- ✅ Business context persistence
- ✅ Dollar-denominated recommendations
- ✅ Anomaly detection (rolling averages)
- ✅ Industry benchmarks
- ✅ Creative fatigue diagnosis
- ✅ Decision trees & heuristics

### v0.4.1 (2026-06-14) - Location Breakdown Insights
- ✅ Location Breakdown API with country/region/DMA
- ✅ Custom sortable top-locations view
- ✅ Cuan Insight Connection Key auth mode
- ✅ minSpend/minClicks filtering

### v0.4.2 (2026-06-19) - Pagination & CI Pipeline
- ✅ Pagination loop — auto-fetch all pages via cursor/after
- ✅ Rate limit safety — auto-delay at >80%, retry 429
- ✅ GitHub Actions CI: tsc + test + gitleaks
- ✅ ESLint flat config migration
- ✅ 16 new pagination tests (391 total)

### v0.5.0 (2026-06-20) - Write Operations (Campaign)
- ✅ `metaPost()` — POST mutations to Meta Graph API
- ✅ 4 campaign tools: pause, resume, budget, rename
- ✅ Approval workflow: dry-run → confirm → execute → audit
- ✅ Safety guard: max 200% budget increase
- ✅ AdsBroker + MetaAdsAdapter write support
- ✅ 4 MCP write tools
- ✅ 21 new mutation tests (413 total)
- ✅ Real API dry-run verified

### v0.5.1 (2026-06-23) - Campaign Listing Broker Tool
- ✅ `ads_list_campaigns` MCP broker tool (Meta + TikTok)
- ✅ `AdsProviderAdapter.listCampaigns()` interface method
- ✅ `AdsBroker.listCampaigns()` with credential resolution
- ✅ Meta adapter uses existing `getCampaigns()` tool
- ✅ TikTok adapter with new `getTikTokCampaigns()` tool
- ✅ 10 new unit tests (420 total)
- ✅ Closes gap where `meta_get_campaigns` was blocked in remote mode

### v0.5.2 (2026-06-25) - Account-Level Performance Broker Tool
- ✅ `ads_get_account_performance` MCP broker tool
- ✅ Meta Insights `level=account` via new `getAccountInsights()` tool
- ✅ Account-level normalized metrics for spend, reach, clicks, purchases, purchase value, ROAS, and leads
- ✅ ROAS fallback from `purchase_value / spend` when Meta omits `purchase_roas`
- ✅ TikTok account performance stub returns `NOT_IMPLEMENTED`

### Phase 0 (2026-07) — Adstream MCP Foundation Sync

**Goal:** Align the repository with the `adstream-mcp` multi-platform direction before deeper feature work.

- ✅ Sync package, README, and repository metadata from legacy Meta-first naming to `adstream-mcp`
- ✅ Keep Meta CPAS as a Meta adapter mode, not a separate provider
- ✅ Add provider capability matrix as code and use it as adapter source of truth
- ✅ Add `docs/PROVIDER_ONBOARDING.md` for future provider adapters
- ✅ Mark `ads_*` as stable public MCP surface and `meta_*`/`tiktok_*` as legacy/debug surfaces

### v0.6.0 (2026-07) — Write Operations (Adset, Ad & Creative) + Expanded Tools

**Goal:** Extend mutation coverage to ad set, ad, and creative levels with full write parity across all entity levels.

#### Features
- ✅ **Safety Contract Prerequisite**
  - ✅ Follow `docs/WRITE_SAFETY_CONTRACT.md` for every new mutation
  - ✅ Prove dry-run, confirmation, permission, audit, and redaction behavior before exposing tools
- ✅ **Write Operations**
  - ✅ Pause/enable ad sets + ads (`ads_pause_adset`, `ads_resume_adset`, `ads_pause_ad`, `ads_resume_ad`)
  - ✅ Update ad set budgets (`ads_update_adset`)
  - ✅ Rename ad sets + ads (`ads_update_adset`, `ads_update_ad`, `ads_update_campaign`)
  - ✅ **Create operations:** `ads_create_campaign`, `ads_create_adset`, `ads_create_ad`, `ads_create_adcreative` (flexible, video, single_image, carousel, dll)
  - ✅ **Archive:** `ads_archive_ad`
  - ✅ **Clone:** `ads_clone_adset`, `ads_clone_ui_ad` (duplicate UI ad from existing config)
  - ✅ **Read-full:** `ads_read_creative_full` (reverse-engineer creative payloads), `ads_read_adset_full` (full targeting/budget config)
  - ✅ **Upload tools:** `ads_upload_image`, `ads_upload_video`
  - ✅ **TikTok GMV Max:** create/update/delete campaigns and sessions
  - ✅ **TikTok Smart Plus:** create/pause/resume campaigns and ad groups
- ✅ **Approval Workflow Extension**
  - ✅ Batch operations support via tool annotations (destructive vs additive)
  - ✅ MCP tool annotations for destructive/additive/idempotent hints
- ✅ **Safety Guards**
  - ✅ `budgetSafetyGuard` — max 200% budget increase
  - ✅ `campaignBudgetSafetyGuard` — campaign-level budget constraints
  - ✅ Rate-limit awareness (auto-delay, HTTP 429 retry)
  - ✅ Destructive write tool annotations (archive, pause, update)
- ✅ **Skills Updates**
  - ✅ Update `manage/SKILL.md` to support write ops
  - ✅ Add `shared/references/safe-mutations.md`
- ✅ **Tests**
  - ✅ Adset/ad mutation tests
  - ✅ Budget safety guard tests
  - ✅ MCP tool dispatch completeness tests

**Additional tools shipped in v0.6.0:**
- `ads_get_targeting_options` — search Meta targeting options
- `ads_get_video_source` — get raw video source URL
- `ads_get_ad_creative_mapping` — link ads to creatives
- `ads_get_account_info` — account metadata
- `ads_list_adimages`, `ads_list_advideos` — asset library listing
- `ads_get_ad_preview` — preview URL per ad format
- `ads_get_ad_destinations` — destination URL extraction
- `ads_list_pages`, `ads_list_instagram_accounts`, `ads_list_threads_profiles` — page/profile discovery
- `ads_list_pixels`, `ads_list_catalogs`, `ads_list_product_sets` — commerce infrastructure discovery
- `ads_list_whatsapp_accounts`, `ads_list_whatsapp_phone_numbers`, `ads_list_whatsapp_message_templates` — WhatsApp discovery
- `ads_create_ecommerce_campaign_bundle` — e-commerce campaign bundle creation

---

## In Progress 🚧

### v0.6.x — Release Hygiene & Remaining Items

- [x] All write operations implemented across campaign, ad set, ad, and creative levels.
- [x] TikTok write tools (GMV Max + Smart Plus) implemented.
- [x] Safety guards and approval workflow proven.
- [ ] **Release hygiene:** bump `package.json`, update `CHANGELOG.md`, tag release, update `RELEASE_NOTES.md`.
- [ ] **Docs sweep:** ensure all new tools are documented in MCP_API_DESIGN.md.
- [ ] **Whitelist/blacklist guardrails:** optional campaign allow/block lists for write tools.

**See also:** `docs/PLAN.md` for the full multi-platform master plan.

---

## Planned 📅

### v0.7.0 (Target: August 2026) — Remaining Guardrails & Polish

**Goal:** Tighten safety and complete the write tool experience.

#### Features
- [ ] **Whitelist mode** — only allow writes to explicitly listed campaigns/adsets/ads
- [ ] **Blacklist mode** — never allow writes to certain campaigns/adsets/ads
- [ ] **Batch operations** — pause/resume/archive multiple entities in one call
- [ ] **Rollback** — undo last write operation
- [ ] **Rate limiting** — max X changes per hour configurable
- [ ] **Changelog + release** — bump to v0.7.0, update CHANGELOG.md, tag release

#### Why Important
- Whitelist/blacklist prevent accidental writes to critical campaigns
- Batch ops save time for agencies managing many campaigns
- Rollback provides safety net for mistakes

---

### v0.8.0 (Target: September 2026) - Multi-Account Support

**Goal:** Support agencies managing multiple ad accounts

#### Features
- [ ] **Account Management**
  - [ ] List all accessible accounts
  - [ ] Switch between accounts
  - [ ] Account nicknames (e.g., "Client A", "Client B")
  - [ ] Per-account business context

- [ ] **Cross-Account Features**
  - [ ] Compare performance across accounts
  - [ ] Aggregate reporting (all accounts)
  - [ ] Bulk operations (pause all underperformers)
  - [ ] Account-level benchmarks

- [ ] **Skills Updates**
  - [ ] Add account selector to preamble
  - [ ] Support "analyze all accounts"
  - [ ] Add cross-account comparison skill

**Why Important:**
- Agencies manage 10-100+ accounts
- Need to compare performance across clients
- Bulk operations save time

**Data Structure:**
```json
{
  "accounts": {
    "act_123": {
      "nickname": "Client A - E-commerce",
      "businessContext": { ... },
      "personas": [ ... ]
    },
    "act_456": {
      "nickname": "Client B - Lead Gen",
      "businessContext": { ... },
      "personas": [ ... ]
    }
  },
  "activeAccount": "act_123"
}
```

---

### v0.9.0 (Target: October 2026) - Advanced Analysis

**Goal:** Deeper insights and predictive analytics

#### Features
- [ ] **Predictive Analytics**
  - [ ] Budget forecasting (if I spend $X, expect Y conversions)
  - [ ] Seasonality detection (auto-detect patterns)
  - [ ] Trend analysis (CPM rising/falling, why?)
  - [ ] Saturation prediction (when will this audience fatigue?)

- [ ] **Competitive Intelligence**
  - [ ] CPM trends (industry-wide)
  - [ ] Benchmark updates (quarterly)
  - [ ] Auction pressure detection
  - [ ] Competitor spend estimates (if available)

- [ ] **Creative Analysis**
  - [ ] Hook rate analysis (video ads)
  - [ ] Hold rate analysis (video ads)
  - [ ] Creative element breakdown (what works?)
  - [ ] A/B test recommendations

- [ ] **Skills Updates**
  - [ ] Add `shared/references/predictive-analytics.md`
  - [ ] Add `shared/references/creative-analysis.md`
  - [ ] Update `manage/SKILL.md` with new analysis

**Why Important:**
- Proactive recommendations (before problems happen)
- Data-driven creative decisions
- Competitive advantage

**Technical Approach:**
- Time-series analysis (rolling averages, trends)
- Statistical models (linear regression, ARIMA)
- Historical data (store 90 days minimum)

---

### v1.0.0 (Target: November 2026) - Industry Templates

**Goal:** Pre-built playbooks for common verticals

#### Features
- [ ] **E-commerce Playbook**
  - [ ] Product catalog campaigns
  - [ ] Dynamic product ads (DPA)
  - [ ] Cart abandonment retargeting
  - [ ] Seasonal promotions (Black Friday, etc.)
  - [ ] AOV optimization

- [ ] **Lead Gen Playbook**
  - [ ] Lead form optimization
  - [ ] Lead quality scoring
  - [ ] Nurture sequence integration
  - [ ] Cost per qualified lead (CPQL)

- [ ] **B2B SaaS Playbook**
  - [ ] Free trial campaigns
  - [ ] Demo request optimization
  - [ ] Account-based marketing (ABM)
  - [ ] Long sales cycle tracking

- [ ] **Local Services Playbook**
  - [ ] Local awareness campaigns
  - [ ] Store visits optimization
  - [ ] Call tracking
  - [ ] Service area targeting

- [ ] **Skills Updates**
  - [ ] Add `skills/meta-ads/playbooks/` directory
  - [ ] Industry-specific SKILL.md files
  - [ ] Auto-detect industry from business context

**Why Important:**
- Faster onboarding (pre-built best practices)
- Industry-specific recommendations
- Higher success rate

**Structure:**
```
skills/meta-ads/playbooks/
├── ecommerce/
│   ├── PLAYBOOK.md
│   ├── dpa-setup.md
│   └── seasonal-strategy.md
├── leadgen/
│   ├── PLAYBOOK.md
│   └── lead-quality.md
├── b2b-saas/
│   ├── PLAYBOOK.md
│   └── free-trial.md
└── local-services/
    ├── PLAYBOOK.md
    └── store-visits.md
```

---

### v1.1.0 (Target: December 2026) - Integrations

**Goal:** Connect with other tools in the marketing stack

#### Features
- [ ] **Shopify Integration**
  - [ ] Sync product catalog
  - [ ] Actual revenue (vs Meta-reported)
  - [ ] Customer LTV data
  - [ ] Inventory-aware campaigns

- [ ] **Google Analytics 4 Integration**
  - [ ] Cross-platform attribution
  - [ ] Funnel analysis
  - [ ] Assisted conversions
  - [ ] Multi-touch attribution

- [ ] **CRM Integration** (HubSpot, Salesforce)
  - [ ] Lead quality feedback loop
  - [ ] Sales cycle data
  - [ ] Customer LTV
  - [ ] Closed-won attribution

- [ ] **Slack/Discord Notifications**
  - [ ] Daily performance summary
  - [ ] Anomaly alerts
  - [ ] Budget alerts
  - [ ] Approval requests (for write ops)

- [ ] **Skills Updates**
  - [ ] Add `shared/references/integrations.md`
  - [ ] Auto-detect integrations
  - [ ] Use integration data in analysis

**Why Important:**
- Meta data alone is incomplete
- Need actual revenue (not Meta-reported)
- Need LTV for true profitability
- Notifications keep users engaged

**Technical Approach:**
- OAuth for each integration
- Webhook listeners for real-time data
- Data sync every 24 hours
- Store in `.meta-ads/integrations/`

---

### v1.0.0 (Target: December 2026) - Production Ready

**Goal:** Stable, feature-complete, production-grade

#### Features
- [ ] **Stability**
  - [ ] 95%+ test coverage
  - [ ] Error handling for all edge cases
  - [ ] Graceful degradation (if API down)
  - [ ] Retry logic with exponential backoff

- [ ] **Performance**
  - [ ] Response time < 2s for most queries
  - [ ] Caching (avoid redundant API calls)
  - [ ] Batch operations (parallel API calls)
  - [ ] Lazy loading (only fetch what's needed)

- [ ] **Documentation**
  - [ ] Complete API reference
  - [ ] Video tutorials
  - [ ] Case studies
  - [ ] FAQ

- [ ] **Enterprise Features**
  - [ ] SSO support
  - [ ] Role-based access control (RBAC)
  - [ ] Audit logs (compliance)
  - [ ] SLA guarantees

**Why Important:**
- Ready for production use
- Enterprise customers need these features
- Competitive with paid tools

---

## Future Ideas 💡

### Beyond v1.0.0

**Advanced Features:**
- [ ] Machine learning models (predict ROAS, detect fraud)
- [ ] Automated optimization (AI makes changes automatically)
- [ ] Custom dashboards (drag-and-drop)
- [ ] White-label solution (agencies can rebrand)
- [ ] API for third-party integrations

**Platform Expansion:**
- [ ] Google Ads support (next major provider after report engine)
- [ ] TikTok parity (regular ads + GMV Max commerce reporting)
- [ ] Indonesian marketplace ads (Shopee/Tokopedia/Lazada/Blibli), pursued in parallel based on API access
- [ ] Unified cross-platform ads reporting and separate commerce/GMV reporting

**Community:**
- [ ] Public skill marketplace (users share custom skills)
- [ ] Plugin system (extend functionality)
- [ ] Community templates
- [ ] Discord community

---

## Prioritization Framework

**How we decide what to build next:**

1. **User Impact** (High/Medium/Low)
   - How many users benefit?
   - How much time/money does it save?

2. **Technical Complexity** (High/Medium/Low)
   - How long to build?
   - How risky?

3. **Strategic Value** (High/Medium/Low)
   - Does it differentiate us?
   - Does it unlock new markets?

**Priority Matrix:**

| Feature | Impact | Complexity | Strategic | Priority |
|---------|--------|------------|-----------|----------|
| Campaign Write Operations | High | Medium | High | ✅ Done (v0.5.0) |
| Adset & Ad Write Operations | High | Medium | High | ✅ Done (v0.6.0) |
| Safety Guards & Whitelist/Blacklist | High | Medium | High | **P0** (v0.7.0) |
| Multi-Account | Medium | Low | High | **P1** (v0.8.0) |
| Predictive Analytics | Medium | High | Medium | **P2** (v0.9.0) |
| Industry Templates | High | Low | Medium | **P2** (v1.0.0) |
| Integrations | High | High | High | **P2** (v1.1.0) |

---

## Success Metrics

**How we measure success:**

### Adoption
- [ ] 1,000 npm downloads/month (v0.4)
- [ ] 5,000 npm downloads/month (v0.6)
- [ ] 10,000 npm downloads/month (v1.0)

### Engagement
- [ ] 100 active users (v0.4)
- [ ] 500 active users (v0.6)
- [ ] 1,000 active users (v1.0)

### Quality
- [ ] 90%+ test coverage (v0.6)
- [ ] < 5 bugs/month (v1.0)
- [ ] 4.5+ stars on npm (v1.0)

### Community
- [ ] 10 GitHub contributors (v0.6)
- [ ] 50 GitHub stars (v0.6)
- [ ] 200 GitHub stars (v1.0)

---

## Contributing

Want to help build this roadmap?

1. **Pick an item** from the roadmap
2. **Open an issue** to discuss approach
3. **Submit a PR** with implementation
4. **Get feedback** and iterate

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Questions?

- **"What should we build next?"** → v0.7.0: whitelist/blacklist guardrails, batch operations, rollback, and rate limiting.
- **"Can I request a feature?"** → Yes! Open an issue with `[Feature Request]` tag
- **"Will v1.0 be free?"** → Yes, open source forever (MIT license)
- **"Will there be a paid version?"** → Maybe enterprise features (SSO, SLA) in the future

---

**Last Updated:** 2026-07-21  
**Maintained By:** Project maintainers + community  
**License:** MIT
