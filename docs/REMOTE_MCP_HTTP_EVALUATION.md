# Remote MCP HTTP Evaluation

> **Date:** 2026-06-03  
> **Branch:** `codex/upgrade-mcp-sdk-streamable-http`  
> **Author:** Agent Evaluation  
> **Phase:** 16b

---

## Current Status

| Item | Value |
|---|---|
| Installed MCP SDK | `@modelcontextprotocol/sdk@1.29.0` (upgraded from `0.5.0`) |
| Latest MCP SDK | `@modelcontextprotocol/sdk@1.29.0` |
| Stdio transport | ✅ Fully working, production default |
| SSE transport | ✅ Implemented (Phase 16a) via `MCP_TRANSPORT=sse` |
| Streamable HTTP transport | ✅ **Implemented (Phase 16b)** via `MCP_TRANSPORT=streamable-http` |
| `GET /health` | ✅ Returns 200 |
| `POST /mcp` (with sessionId) | ✅ Routes to SSE transport when `MCP_TRANSPORT=sse` |
| `POST /mcp` (without sessionId) | ✅ Creates new Streamable HTTP session when `MCP_TRANSPORT=streamable-http` |
| `POST /mcp` (HTTP mode) | ⚠️ Returns 501 — skeleton only |
| Unit tests | ✅ 217/217 passing |
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

### Streamable HTTP Details (Phase 16b)

- **Session ID**: Generated via `sessionIdGenerator` option (uses `randomUUID()`).
- **Auth**: Handled via existing `MCP_HTTP_BEARER_TOKEN` / `Authorization` header.
- **Transport**: `StreamableHTTPServerTransport` wraps Node.js `IncomingMessage`/`ServerResponse` directly.
- **Session management**: Maintained in-memory via `activeStreamableSessions` map.
- **Existing MCP tools reuse**: Yes — tools registered via `Server.setRequestHandler(CallToolRequestSchema, ...)` remain unchanged.
- **Stdio default**: Yes — stdio remains the default. Streamable HTTP is opt-in via `MCP_TRANSPORT=streamable-http`.

### Breaking Changes (SDK v0.5.0 → v1.29.0)

1. **`Server` class deprecated** — `@deprecated` in favor of `McpServer` high-level API. Still functional in v1.29.0.
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

---

## Feasibility Result

**Status: SDK v1.29.0 supports official Streamable HTTP transport. Implementation completed in Phase 16b.**

---

## Recommendation

**Phase 16c: Migrate deprecated `Server` API to `McpServer`.**

| Phase | Action | Status |
|---|---|---|
| Phase 16 | Evaluation complete | ✅ Done |
| Phase 16a | Implement SSE transport (current SDK, no upgrade) | ✅ Done |
| Phase 16b | Upgrade to SDK v1.29.0 for Streamable HTTP | ✅ **DONE** |
| Phase 16c | Migrate from deprecated `Server` to `McpServer` API | ⏳ Next |

### Risk Level

- **Phase 16b (SDK upgrade + Streamable HTTP):** Low — no breaking changes to existing transports, 217 tests passing.

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
SDK Currently Installed:   @modelcontextprotocol/sdk@1.29.0 (was 0.5.0)
Zod Installed:             zod@3.25.76 (was 3.23.8)
SSE Transport:             ✅ Implemented (Phase 16a)
Streamable HTTP:           ✅ Implemented (Phase 16b)
Current POST /mcp Status:
  - HTTP mode:             501 (skeleton)
  - SSE mode:              Routes to SSE transport
  - Streamable HTTP mode:  Creates new Streamable HTTP session
Recommendation:            Phase 16c: Migrate deprecated Server → McpServer
Branch:                    codex/upgrade-mcp-sdk-streamable-http
Validation:                ✅ 217/217 tests passing, build OK
Deploy:                    ❌ No
Tag/Release:               ❌ No
Version Bump:              ❌ No (project stays at v0.3.0)
Tokens Printed:            ❌ No
Secrets Added:             ❌ No
Cuan Insight Changes:      ❌ Not required
```
