# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-06-14

### Added - Location Breakdown Insights

- **New types**: `LocationBreakdown` (`country`, `region`, `dma`), `InsightBreakdownOptions`, `LocationInsightRow`, `LocationInsightSummary`
- **New tools**: `getLocationInsights()` — ranked/filtered location summary with totals
- **New MCP tools**:
  - `meta_get_insights_by_breakdown` — raw insight rows by country/region/dma
  - `meta_get_location_insights` — grouped summary with ranking, totals, and warnings
- **New utilities**: `summarizeLocationInsights()` — aggregation/ranking/filter engine, `assertLocationBreakdowns()` — safe validation
- **Broker passthrough**: `params.breakdowns` forwarded through `MetaAdsAdapter`
- **Normalizer**: maps `country`/`region`/`dma` to `dimensions` in `AdsMetricRecord`
- **Tests**: 8 new unit tests for location insights, ranking, filters, empty edge cases
- **Script**: `npm run test:local-meta-breakdown` for real Meta API testing with sanitized output

### Changed

- Existing `getCampaignInsights`, `getAdsetInsights`, `getAdsInsights` now accept optional `breakdowns` param
- Existing MCP tools (`meta_get_campaign_insights`, etc.) now accept optional `breakdowns`

### Rules

- AGENTS.md add: merge verification checklist — confirm `git diff HEAD --stat` empty before merge

## [0.3.0] - 2026-05-29

### Added - AI Skills Layer

**Major architectural addition:** Skills-based interface for AI agents alongside existing TypeScript library.

#### New Skills
- `/meta-ads-audit` — Comprehensive account audit with business context setup
- `/meta-ads-manage` — Ongoing performance analysis and recommendations
- Shared preamble for MCP detection and config resolution
- Meta math formulas and benchmarks reference
- Analysis heuristics and decision trees
- Creative fatigue diagnosis guide

#### Skills Features
- Natural language interface for end users
- Business context persistence (AOV, profit margin, brand voice)
- Persona discovery from campaign data
- Account baseline for anomaly detection
- Profitability analysis (Headroom $, Break-Even ROAS)
- Industry benchmarks (CTR, CPM, ROAS by vertical)
- Creative fatigue detection (frequency + CPM + CTR analysis)
- Dollar-denominated recommendations

#### Documentation
- `skills/README.md` — Skills overview and usage guide
- `SKILL_MIGRATION.md` — Migration guide and architecture explanation
- Updated main `README.md` to explain both library and skills
- `.mcp.json` configuration for MCP server

### Changed
- README now explains two ways to use the project (library vs skills)
- Cleaned up development artifact files (`*_COMPLETE.md`, `*_SUMMARY.md`)

### Philosophy
- Skills are **instructions** for AI agents, not hard-coded logic
- AI interprets markdown heuristics and adapts to context
- Library remains unchanged — skills are an additional interface
- Serves both developers (library) and end users (skills)

## [0.2.0] - 2026-05-28

### Added - Advanced Rule Engine

#### Rule Engine Core
- Flexible rule system with conditions and logic operators
- Support for AND/OR logic combinations
- 6 comparison operators: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Priority-based recommendation sorting
- Rule evaluation with detailed results

#### Pre-built Rule Templates (26 rules)
- **E-commerce Rules** (6 rules)
  - High ROAS campaigns
  - Low ROAS campaigns
  - High CPA detection
  - Low conversion rate
  - Cart abandonment optimization
  - Purchase funnel optimization

- **Lead Generation Rules** (6 rules)
  - Cost per lead optimization
  - Lead quality scoring
  - Form completion rate
  - Lead nurturing opportunities
  - High-intent lead identification
  - Lead volume scaling

- **Brand Awareness Rules** (6 rules)
  - Reach optimization
  - Frequency capping
  - CPM efficiency
  - Video view optimization
  - Engagement rate tracking
  - Brand lift opportunities

- **General Performance Rules** (8 rules)
  - Low CTR detection
  - High CPC alerts
  - Budget utilization
  - Ad fatigue detection
  - Audience saturation
  - Dayparting opportunities
  - Device performance
  - Placement optimization

#### Examples
- `examples/rule-engine-demo.ts` — Basic rule engine usage
- `examples/rule-templates-demo.ts` — Pre-built templates usage

### Changed
- Updated package.json to v0.2.0
- Enhanced documentation with rule engine examples

## [0.1.0] - 2026-05-27

### Added - Initial Release

#### Core Features
- **MetaClient** — Clean wrapper for Meta Marketing API
- **Configuration** — Environment-based config with Zod validation
- **Type Safety** — Full TypeScript types for all API responses

#### Tools (6 read-only functions)
- `getAdAccounts` — List all ad accounts
- `getCampaigns` — Get campaigns for an ad account
- `getCampaignInsights` — Campaign-level performance data
- `getAdsetInsights` — Ad set-level performance data
- `getAdsInsights` — Ad-level performance data
- `generateDailyReport` — Automated daily performance report

#### Analysis
- `analyzeCampaignPerformance` — Smart campaign analysis
- `recommendActions` — Actionable recommendations based on performance

#### Utilities
- `parseActionValue` — Parse Meta actions array
- `formatCurrency` — Format numbers as currency
- `MetaApiError` — Custom error class for API errors

#### MCP Server
- Basic MCP server implementation in `mcp-server/`
- Exposes all tools via Model Context Protocol
- Compatible with Claude Code and other MCP clients

#### Examples
- `examples/daily-report.ts` — Daily report generation
- `examples/campaign-audit.ts` — Campaign audit example

#### Tests
- Unit tests for core functionality
- Test coverage for analysis and utilities

#### Documentation
- Comprehensive README with setup instructions
- API documentation
- Authentication guide (Graph API Explorer + System User)
- AGENTS.md for AI agent guidelines

### Technical Details
- TypeScript 5.4+
- ESM modules only
- Zod for runtime validation
- Vitest for testing
- tsup for building

---

## Version History Summary

- **v0.3.0** (2026-05-29) — AI Skills Layer
- **v0.2.0** (2026-05-28) — Advanced Rule Engine
- **v0.1.0** (2026-05-27) — Initial Release

---

## Upcoming

### v0.4.0 (Planned)
- Write operations (pause campaigns, update budgets)
- Approval workflow for mutations
- Audit log for all changes

### v0.5.0 (Planned)
- OAuth flow for skills (browser-based auth)
- Token management and refresh
- Multi-user support

### v0.6.0 (Planned)
- Multi-account support
- Account switching
- Cross-account reporting

---

## Migration Notes

### From v0.2.0 to v0.3.0

**No breaking changes.** The TypeScript library API remains unchanged.

**New features:**
- Skills layer added in `skills/` directory
- `.mcp.json` configuration for MCP server
- New documentation files

**Action required:**
- None if using library only
- Configure `.mcp.json` if using skills with AI agents

### From v0.1.0 to v0.2.0

**No breaking changes.** All v0.1.0 APIs remain unchanged.

**New features:**
- Rule engine in `src/rules/`
- 26 pre-built rule templates
- New examples for rule engine

**Action required:**
- None, rule engine is opt-in

---

## Links

- [GitHub Repository](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill)
- [npm Package](https://www.npmjs.com/package/meta-ads-agent-skill)
- [Issues](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/issues)
