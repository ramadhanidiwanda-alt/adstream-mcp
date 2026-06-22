# Roadmap: meta-ads-agent-skill

**Current Version:** v0.5.1  
**Last Updated:** 2026-06-23

---

## Vision

Menjadi **the best Meta Ads toolkit** untuk AI agents dan developers — menggabungkan kekuatan TypeScript library dengan kemudahan AI-native skills.

**Target Audience:**
- 🎯 Primary: End users (marketers) via AI skills
- 🎯 Secondary: Developers via TypeScript library
- 🎯 Tertiary: Agencies managing multiple accounts

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

---

## In Progress 🚧

### v0.6.0 (Target: July 2026) — Write Operations (Adset & Ad)

**Goal:** Extend mutation coverage to adset and ad levels

#### Features
- [ ] **Write Operations**
  - [ ] Pause/enable ad sets + ads
  - [ ] Update ad set budgets
  - [ ] Rename ad sets + ads
- [ ] **Approval Workflow Extension**
  - [ ] Batch operations (pause 5 campaigns at once)
  - [ ] Rollback capability
- [ ] **Safety Guards**
  - [ ] Rate limiting (max X changes per hour)
  - [ ] Blacklist (never touch these campaigns)
  - [ ] Whitelist mode (only touch these campaigns)
- [ ] **Skills Updates**
  - [ ] Update `manage/SKILL.md` to support write ops
  - [ ] Add `shared/references/safe-mutations.md`
- [ ] **Tests**
  - [ ] Adset/ad mutation tests
  - [ ] Batch operation tests

---

## Planned 📅

### v0.5.0 (Target: July 2026) - OAuth & Token Management

**Goal:** Simplify authentication for end users

#### Features
- [ ] **OAuth 2.0 Flow**
  - [ ] Browser-based authentication
  - [ ] PKCE flow (secure for public clients)
  - [ ] Token storage in OS keychain
  - [ ] Automatic token refresh

- [ ] **Token Management**
  - [ ] Check token expiry
  - [ ] Auto-refresh before expiry
  - [ ] Handle revoked tokens
  - [ ] Multi-user support (per-project tokens)

- [ ] **Skills Updates**
  - [ ] Update `preamble.md` to support OAuth
  - [ ] Remove manual token setup
  - [ ] Add OAuth troubleshooting guide

**Why Important:**
- No more manual token copy-paste
- Tokens never expire (auto-refresh)
- Better security (tokens in keychain, not .env)
- Easier onboarding (one-click auth)

**Technical Approach:**
- Use Meta's OAuth 2.0 with PKCE
- Store tokens in OS keychain (keytar library)
- MCP server handles token refresh
- Skills trigger OAuth on first use

---

### v0.6.0 (Target: August 2026) - Multi-Account Support

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

### v0.7.0 (Target: September 2026) - Advanced Analysis

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

### v0.8.0 (Target: October 2026) - Industry Templates

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

### v0.9.0 (Target: November 2026) - Integrations

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
- [ ] Google Ads support (same skills, different platform)
- [ ] TikTok Ads support
- [ ] LinkedIn Ads support
- [ ] Unified cross-platform reporting

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
| Write Operations | High | Medium | High | **P0** (v0.4) |
| OAuth Flow | High | Medium | Medium | **P1** (v0.5) |
| Multi-Account | Medium | Low | High | **P1** (v0.6) |
| Predictive Analytics | Medium | High | Medium | **P2** (v0.7) |
| Industry Templates | High | Low | Medium | **P2** (v0.8) |
| Integrations | High | High | High | **P2** (v0.9) |

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

- **"When will v0.4 be released?"** → Target June 2026, but depends on community contributions
- **"Can I request a feature?"** → Yes! Open an issue with `[Feature Request]` tag
- **"Will v1.0 be free?"** → Yes, open source forever (MIT license)
- **"Will there be a paid version?"** → Maybe enterprise features (SSO, SLA) in the future

---

**Last Updated:** 2026-05-29  
**Maintained By:** Project maintainers + community  
**License:** MIT
