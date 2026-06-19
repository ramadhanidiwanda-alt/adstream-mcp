# Release Notes

## v0.4.2 — Pagination Loop & Rate Limit Safety

**Date:** 2026-06-19

### Added
- Pagination loop — `MetaClient.metaGet(paginate: true)` auto-fetches all pages via cursor/after.
- Rate limit safety — parses `X-Ad-Account-Usage`, auto-delays at >80%, retries 429 with exponential backoff.
- New `paginate`, `maxPages`, `pageDelay` options on all 3 insight tools.
- CI pipeline — GitHub Actions runs `tsc --noEmit` + `npm test` + gitleaks on every PR.
- 16 new unit tests for pagination and rate limit (391 total).

### Changed
- ESLint migrated to flat config (`eslint.config.js`) for v9 compatibility.

### Compatible
- Fully backward compatible. Default `paginate: false` preserves existing behavior.

---

## v0.4.1 — Location Breakdown Insights

**Date:** 2026-06-03

### Added
- Added Cuan Insight Connection Key auth mode via `CUAN_INSIGHT_AUTH_MODE=connection_key`.
- Added `CUAN_INSIGHT_CONNECTION_KEY` env var support.
- Added `x-cuan-mcp-connection-key` resolver header sent to Cuan Insight credential endpoint.
- Documented hosted Cuan Insight credential control plane setup in README and docs.
- Added connection key redaction to `redactErrorMessage` and `redactTokenLikeValues`.
- Added 25 new tests covering config parsing, header behavior, URL construction, and redaction.

### Fixed
- Fixed credential resolver URL construction to preserve base paths such as `/functions/v1` (PR #23).

### Verified
- Live production smoke test passed using Cuan Insight Connection Key:
  - `tools/list` returned 13 MCP tools.
  - `ads_list_accounts` returned 25 Meta ad accounts.
  - Provider-level credential discovery resolved successfully (200 OK).
  - Revoked connection key was rejected with 401.
  - No fallback to other credential modes.
- No providerToken, raw connection key, key_hash, or Authorization header leaked in any output.

### Backward Compatibility
- Existing `CUAN_INSIGHT_MCP_TOKEN` flow remains the default and unchanged.
- `CUAN_INSIGHT_AUTH_MODE` defaults to `mcp_token`.
- All 13 MCP tools preserved.
- Legacy `meta_*` tools still available in local mode.

### PRs in This Release
| PR | Description |
|---|---|
| [#21](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/21) | Connection Key compatibility layer |
| [#22](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/22) | Documentation update |
| [#23](https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/pull/23) | Fix credential URL construction |

### Security
- Connection key redaction covers: `x-cuan-mcp-connection-key`, `connectionKey`, `connection_key`, `connection-key`.
- `redactErrorMessage` masks all auth headers and token-like values in error output.
- `gitleaks` clean (7 findings all false positives or gitignored).

---

## v0.3.0 — Multi-Platform AI Agent Support

- MCP server with stdio, SSE, and Streamable HTTP transports
- 13 read-only tools for Meta Ads analysis
- Remote credential resolution via Cuan Insight
- Rule engine with 26 pre-built templates
- AI skills for natural language ad analysis

---

## v0.2.0 — Rule Engine

- 26 pre-built rule templates (ecommerce, leadgen, brand, general)
- Campaign performance analysis
- Recommendation engine

---

## v0.1.0 — Foundation

- TypeScript library for Meta Marketing API
- 6 read-only tools
- MetaClient HTTP wrapper
