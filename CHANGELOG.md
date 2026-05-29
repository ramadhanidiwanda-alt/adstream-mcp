# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-29

### Added

#### Codex Native Skill Support
- **SKILL.md** - Complete Codex skill definition with 656 lines of documentation
- Trigger keywords for automatic skill detection
- AI agent workflows for common scenarios (daily reports, campaign audits, custom analysis)
- Authentication setup guide
- Error handling documentation
- Quick reference for metrics and commands

#### MCP Server
- **mcp-server/** - Full MCP (Model Context Protocol) server implementation
- 7 MCP tools exposed:
  - `meta_get_ad_accounts` - Fetch ad accounts
  - `meta_get_campaigns` - Fetch campaigns with filters
  - `meta_get_campaign_insights` - Campaign performance data
  - `meta_get_adset_insights` - Adset performance data
  - `meta_get_ads_insights` - Ad performance data
  - `meta_generate_daily_report` - Comprehensive daily report
  - `meta_analyze_with_rules` - Apply 26 rule templates
- Compatible with Claude Desktop, Codex MCP, and other MCP clients
- Complete setup documentation and usage examples

#### Enhanced Authentication
- `validateTokenFormat()` - Validate Meta access token format
- `validateAdAccountId()` - Validate ad account ID format
- `maskToken()` - Safely mask tokens for logging
- Improved error messages with setup instructions
- Comprehensive authentication documentation in README
- Support for 3 token types: Graph API Explorer, System User, OAuth

#### Documentation
- **INTEGRATION_COMPLETE.md** - Complete integration guide
- Enhanced README with authentication section
- MCP server setup guide
- Example workflows for AI agents
- Security best practices

### Changed
- Updated package description to include Codex and MCP support
- Added keywords: codex, mcp, claude
- Enhanced config.ts with better validation and error messages
- Improved error messages to include helpful setup instructions

### Fixed
- Token validation now checks for EAA/EAAG prefix
- Account ID validation ensures act_ prefix
- Better error handling with actionable messages

## [0.2.0] - 2026-05-28

### Added
- **Advanced Rule Engine** with 26 pre-built templates
- 4 rule categories: E-commerce, Lead Generation, Brand Awareness, General Performance
- Flexible rule system with AND/OR logic and 6 operators
- `RuleEngine` class for custom rule evaluation
- Rule templates: `ecommerceRules`, `leadGenRules`, `brandAwarenessRules`, `generalRules`
- `allRuleTemplates` - Combined set of all 26 rules
- `getRulesByCategory()` - Filter rules by category

### Changed
- Enhanced `analyzeCampaignPerformance` to work with rule engine
- Updated examples to demonstrate rule engine usage

## [0.1.0] - 2026-05-28

### Added
- **MetaClient** - Clean wrapper for Meta Marketing API
- **6 Read-only Tools**:
  - `getAdAccounts` - Fetch ad accounts
  - `getCampaigns` - Fetch campaigns with filters
  - `getCampaignInsights` - Campaign-level insights
  - `getAdsetInsights` - Adset-level insights
  - `getAdsInsights` - Ad-level insights
  - `generateDailyReport` - Comprehensive daily report
- **Performance Analysis**:
  - `analyzeCampaignPerformance` - Smart campaign analysis
  - `recommendActions` - Action recommendations with disclaimers
- **Utilities**:
  - `parseActions` - Extract action values (purchases, leads, etc.)
  - `formatCurrency` - Currency formatting
  - `metaError` - Custom error handling
- **Configuration**:
  - `loadConfig` - Environment variable loader with Zod validation
  - Support for `.env` files
- **Examples**:
  - `daily-report.ts` - Daily performance report
  - `campaign-audit.ts` - Campaign audit with 7-day insights
- **Tests**:
  - `analyzeCampaignPerformance.test.ts` - 4 test cases
  - All tests passing with Vitest
- **Documentation**:
  - Comprehensive README with setup instructions
  - API reference
  - Safety notes and disclaimers
  - MIT License

### Security
- Read-only permissions only (ads_read)
- No write operations implemented
- Access tokens not logged
- .env in .gitignore

---

## Release Notes

### v0.3.0 - Multi-Platform AI Agent Support

This release transforms the library into a **multi-platform AI agent skill** that can be used by:
- ✅ Codex CLI (native skill via SKILL.md)
- ✅ Claude Desktop (MCP server)
- ✅ Any MCP-compatible client
- ✅ Direct TypeScript/JavaScript usage

**Key Features:**
- 3 integration methods (Codex, MCP, Direct)
- 7 MCP tools exposed
- Enhanced authentication with validation
- Comprehensive documentation
- 100% backward compatible

**Migration Guide:**
No breaking changes. Existing code continues to work. New features are opt-in.

**Getting Started:**
```bash
# For Codex
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"

# For MCP Server
cd mcp-server
npm install && npm run build
# Configure Claude Desktop with mcp-server/dist/index.js
```

---

[0.3.0]: https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/releases/tag/v0.1.0
