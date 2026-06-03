# Remote MCP HTTP Evaluation

> **Date:** 2026-06-03  
> **Branch:** `codex/migrate-mcp-server-api`  
> **Author:** Agent Evaluation  
> **Phase:** 16e (Final)

---

## Current Status

| Item | Value |
|---|---|
| Installed MCP SDK | `@modelcontextprotocol/sdk@1.29.0` (upgraded from `0.5.0`) |
| Latest MCP SDK | `@modelcontextprotocol/sdk@1.29.0` |
| Stdio transport | ✅ Fully working, production default |
| SSE transport | ✅ Implemented (Phase 16a) via `MCP_TRANSPORT=sse` |
| Streamable HTTP transport | ✅ **Implemented (Phase 16b)** via `MCP_TRANSPORT=streamable-http` |
| MCP server API | ✅ Migrated to high-level `McpServer.registerTool(...)` API (Phase 16c) |
| `GET /health` | ✅ Returns 200 |
| `POST /mcp` (with sessionId) | ✅ Routes to SSE transport when `MCP_TRANSPORT=sse` |
| `POST /mcp` (without sessionId) | ✅ Creates new Streamable HTTP session when `MCP_TRANSPORT=streamable-http` |
| `POST /mcp` (HTTP mode) | ⚠️ Returns 501 — skeleton only |
| Unit tests | ✅ 218/218 passing |
| TypeScript build | ✅ Main library + MCP server build pass |

---

## MCP SDK v1.29.0

### Transports Available

| Transport | Class | Import Path |
|---|---|---|
| Stdio | `StdioServerTransport` | `@modelcontextprotocol/sdk/server/stdio.js` |
| SSE | `SSEServerTransport` | `@modelcontextprotocol/sdk/server/sse.js` |
| Streamable HTTP | `StreamableHTTPServerTransport` | `@modelcontextprotocol/sdk/server/streamableHttp.js` |
| Web Standard Streamable HTTP | `WebStandardStreamableHTTPServerTransport` | `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js` |
| Express | `createMcpExpressApp()` | `@modelcontextprotocol/sdk/server/express.js` |

### Streamable HTTP Details (Phase 16b/16c)

- **Session ID**: Generated via `sessionIdGenerator` option (uses `randomUUID()`).
- **Auth**: Handled via existing `MCP_HTTP_BEARER_TOKEN` / `Authorization` header.
- **Transport**: `StreamableHTTPServerTransport` wraps Node.js `IncomingMessage`/`ServerResponse` directly.
- **Session management**: Maintained in-memory via `activeStreamableSessions` map.
- **Existing MCP tools reuse**: Yes — tools now registered through `McpServer.registerTool(...)`; handler behavior remains unchanged.
- **Stdio default**: Yes — stdio remains the default. Streamable HTTP is opt-in via `MCP_TRANSPORT=streamable-http`.

### McpServer Migration Details (Phase 16c)

- **Old API**: Low-level direct `Server` usage with `setRequestHandler(ListToolsRequestSchema/CallToolRequestSchema)`.
- **New API**: High-level `McpServer` with `registerTool(...)` and zod input schemas.
- **Tool surface**: Preserved at 13 tools: 6 `ads_*` broker tools and 7 legacy `meta_*` tools.
- **Transports**: Stdio, SSE, and Streamable HTTP still connect through the same factory and remain transport-compatible.
- **Credential resolution**: Unchanged; Cuan Insight remote resolver and local token mode are preserved.
- **Cuan Insight**: No changes required.

### Breaking Changes (SDK v0.5.0 → v1.29.0)

1. **`Server` class deprecated** — Phase 16c removed direct project usage in favor of `McpServer` high-level API.
2. **`SSEServerTransport` deprecated** — `@deprecated` in favor of `StreamableHTTPServerTransport`. Still functional.
3. **New zod dependency** — Requires `zod@^3.25 \|\| ^4.0`. Upgraded from `^3.23.8` to `^3.25.76`.
4. **10+ new transitive dependencies** — Added by SDK v1.29.0.

### Upgrade Path (Phase 16b)

- `mcp-server/package.json`: `@modelcontextprotocol/sdk` `^0.5.0` → `^1.29.0`
- `package.json`: `zod` `^3.23.8` → `^3.25.76`
- `mcp-server/src/http.ts`: Added `StreamableHTTPServerTransport` import and handler
- No changes to `createServer.ts` or tool registration
- No changes to stdio transport
- No changes to SSE transport

### Migration Path (Phase 16c)

- `mcp-server/src/createServer.ts`: Replaced direct `Server` request-handler registration with `McpServer.registerTool(...)`.
- `tests/mcpServerBuilder.test.ts`: Updated schema comparison for normalized `McpServer` JSON Schema and added 13-tool count guard.
- No changes to `mcp-server/src/http.ts` transport wiring.
- No changes to stdio transport.
- No changes to SSE transport.
- No changes to Streamable HTTP transport.

---

## Feasibility Result

**Status: SDK v1.29.0 supports official Streamable HTTP transport, and MCP tool registration now uses `McpServer`. Implementation completed through Phase 16c.**

---

## Final Phase 16 Summary

All Phase 16 sub-phases are complete.

| Phase | Action | Status |
|---|---|---|
| Phase 16 | Evaluation complete | ✅ Done |
| Phase 16a | Implement SSE transport (current SDK, no upgrade) | ✅ Done |
| Phase 16b | Upgrade to SDK v1.29.0 for Streamable HTTP | ✅ Done |
| Phase 16c | Migrate from deprecated `Server` to `McpServer` API | ✅ Done |
| Phase 16d | Dependency audit remediation (0 vulns) | ✅ Done |
| Phase 16e | Final release summary | ✅ This document |

### Risk Level

- **Phase 16b (SDK upgrade + Streamable HTTP):** Low — no breaking changes to existing transports, 217 tests passing.
- **Phase 16c (`McpServer` migration):** Low/medium — tool schema output is normalized by SDK, but tool names, input names, handlers, transports, and credential resolution are preserved; 218 tests passing.
- **Phase 16d (npm audit remediation):** Low — dev-tool-only vitest upgrade, no source changes, 0 vulns.

### Files Changed (Phase 16b)

| File | Change |
|---|---|
| `package.json` | zod `^3.23.8` → `^3.25.76` |
| `package-lock.json` | Updated lockfile for SDK v1.29.0 |
| `mcp-server/package.json` | SDK `^0.5.0` → `^1.29.0` |
| `mcp-server/src/http.ts` | Added Streamable HTTP transport + `TransportType` |
| `tests/httpSkeleton.test.ts` | Added Streamable HTTP config + endpoint tests |
| `docs/REMOTE_MCP_HTTP_EVALUATION.md` | Updated to Phase 16b status |
| `docs/PROJECT_STATUS.md` | Added Phase 16b status |
| `docs/MCP_CLIENT_SETUP.md` | Added Streamable HTTP client config |

### Files Changed (Phase 16c)

| File | Change |
|---|---|
| `mcp-server/src/createServer.ts` | Migrated to `McpServer.registerTool(...)` and zod input schemas |
| `tests/mcpServerBuilder.test.ts` | Updated schema equivalence assertions and added tool-count guard |
| `docs/REMOTE_MCP_HTTP_EVALUATION.md` | Updated to Phase 16c status |
| `docs/PROJECT_STATUS.md` | Added Phase 16c status and validation |
| `docs/PROJECT_STATUS.md` | Phase 16d/e final transport matrix, security notes, pending items |

### Deployment Impact

- **No impact.** Stdio remains default. SSE and Streamable HTTP are opt-in via `MCP_TRANSPORT`.

---

## Security Notes

| Concern | Status |
|---|---|
| Auth token via `Authorization` header | ✅ Standard, sufficient |
| CORS needed | ✅ Yes, if browser-based clients access the HTTP endpoint |
| Public internet exposure | ⚠️ Only behind HTTPS + Bearer token + rate limiting |
| Cloudflare Tunnel / reverse proxy | ✅ Recommended for production remote MCP |
| Rate limiting | ✅ Recommended |
| Log redaction | ✅ `Authorization` and `providerToken` must never appear in logs |
| Request body logging | ⚠️ Must be redacted or disabled |
| `providerToken` leak | ⚠️ Must not appear in error responses or MCP tool responses |
| Pre-existing security patterns in codebase | ✅ Redact functions exist |

---

## Final Assessment

```
Phase 16 series: ✅ COMPLETE

Technical State (final):
  SDK:                 @modelcontextprotocol/sdk@1.29.0
  Zod:                 zod@3.25.76
  Server API:          McpServer (Phase 16c)
  Stdio:               default
  SSE:                 supported (Phase 16a)
  Streamable HTTP:     supported (Phase 16b)
  Tool count:          13
  npm audit:           0 vulnerabilities (Phase 16d)
  Tests:               218/218
  Cuan Insight:        unchanged

Validation:            ✅ 218/218 passed, typecheck/build/transports smokes all OK
Deploy:                ❌ No
Tag/Release:           ❌ No
Version Bump:          ❌ No (stays at v0.3.0)
Tokens Printed:        ❌ No
Secrets Added:         ❌ No

Next: See docs/PROJECT_STATUS.md for recommended next steps (production deploy, live credential test, CI, npm audit monitoring).
```
