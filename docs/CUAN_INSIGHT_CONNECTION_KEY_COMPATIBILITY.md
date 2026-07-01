# Cuan Insight Connection Key Compatibility

> **Status**: Live production verified — v0.4.0  
> **Date**: 2026-06-03  
> **Updated**: 2026-06-03 (Phase 17.5G release)  
> **Related**: `docs/roadmap/mcp-connector-platform.md` (cuan-insight)

---

## A. Purpose

This document explains how the adstream-mcp MCP server is designed to work with Cuan Insight as a credential authority, and how the Cuan Insight Connection Key system integrates with this server.

Key principles:
- This MCP server is the **execution layer** — it runs tools, not credentials.
- Cuan Insight is the **control plane** — it stores and validates credentials.
- This repo must stay **client-agnostic** — no single AI client dependency.

---

## B. Current State

- Uses `McpServer` from the official MCP SDK (high-level API)
- Supports three transports: stdio (default), SSE (`MCP_TRANSPORT=sse`), Streamable HTTP (`MCP_TRANSPORT=streamable-http`)
- Exposes 13 read-only tools for Meta Ads analysis
- Resolves provider credentials from Cuan Insight at runtime via `mcp-resolve-credential` Edge Function
- Calls Meta Ads Graph API directly using resolved token
- `providerToken` must never be logged
- npm audit: 0 vulnerabilities
- TypeScript strict mode, Vitest test suite (239 tests)
- **Connection Key support: ✅ implemented (Phase 17.5C, PR #21)**

---

> **Hosted multi-user limitation:** Current v0.4.0 supports env-based `CUAN_INSIGHT_CONNECTION_KEY` for local/single-tenant use. Per-request `x-cuan-mcp-connection-key` header passthrough for hosted multi-user remote MCP is planned for a future release. Do not configure one shared global connection key for multi-user deployments.


## C. Auth Modes

### 1. Recommended Hosted Mode — Connection Key (Phase 17.5C)

Used when running the MCP server with a Connection Key generated from Cuan Insight UI.

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_AUTH_MODE=connection_key
CUAN_INSIGHT_CONNECTION_KEY=<key-from-cuan-insight-ui>
CUAN_INSIGHT_API_BASE_URL=<cuan-insight-functions-base-url>
CUAN_INSIGHT_SUPABASE_ANON_KEY=<supabase-anon-key-if-required>
```

- Key dibuat dari Cuan Insight UI > AI/MCP Connectors
- Raw key hanya muncul sekali saat pembuatan
- MCP server mengirim header `x-cuan-mcp-connection-key`
- Provider token tidak pernah ditampilkan ke AI client
- Jika `CUAN_INSIGHT_SUPABASE_ANON_KEY` tersedia, hosted Supabase auth tetap dipakai (`Authorization: Bearer <supabaseAnonKey>`)
- Key dapat di-revoke dari UI Cuan Insight (immediate invalidation)

> ⚠️ **Multi-user warning:** A Connection Key gives access to ad data for the organization. For hosted multi-user servers, never configure one shared global `CUAN_INSIGHT_CONNECTION_KEY`. Clients must send `x-cuan-mcp-connection-key` per request. This is planned for a future release.


### 2. Legacy / Default Mode — MCP Token

Used when running the MCP server locally or self-hosted with a direct MCP token from Cuan Insight.

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_AUTH_MODE=mcp_token
CUAN_INSIGHT_MCP_TOKEN=<mcp-token>
CUAN_INSIGHT_API_BASE_URL=<cuan-insight-functions-base-url>
CUAN_INSIGHT_SUPABASE_ANON_KEY=<supabase-anon-key-if-required>
```

- Default mode (backward compatible)
- Token passed via `X-Cuan-MCP-Token` header (hosted mode) or `Authorization: Bearer` header (local/dev)
- Token is SHA-256 hashed in Cuan Insight `mcp_access_tokens` table
- Cuan Insight validates hash and resolves provider token
- Dipertahankan untuk developer/self-host/server env

### 3. Local Provider Credential Mode

Available for local development/testing where a direct Meta access token is set via environment.

```env
BROKER_RUNTIME_MODE=local
META_ACCESS_TOKEN=<meta-access-token>
META_AD_ACCOUNT_ID=act_123456789
```

- Not used in production or hosted deployments

---

## D. Connection Key Implementation (Phase 17.5C)

### Files Changed

| File | Change |
|---|---|
| `src/broker/config.ts` | Parse `CUAN_INSIGHT_AUTH_MODE` and `CUAN_INSIGHT_CONNECTION_KEY` env vars |
| `src/broker/cuanInsightClient.ts` | Send `x-cuan-mcp-connection-key` header when `authMode=connection_key` |
| `src/broker/credentials.ts` | Add connection key redaction to `redactErrorMessage` |
| `src/broker/factory.ts` | Wire `authMode` and `connectionKey` through `createRemoteCredentialResolver` |
| `.env.example` | Document both legacy MCP token and recommended Connection Key modes |
| `tests/*` | 21 new tests covering config, headers, redaction, security |

### Validation

- `npm test`: 20 files, 239 tests — PASS
- `npm run build`: ESM 73.04 KB — PASS
- `npm audit`: 0 vulnerabilities — PASS
- Cold smoke test (stdio): tools/list (13 tools), ads_list_accounts — PASS
- Security: zero secret leak in output/log/stderr

### Verified (Phase 17.5F)

- ✅ Live production smoke test: Connection Key → `ads_list_accounts` → 25 Meta accounts returned
- ✅ Revoke test: key revoked via Cuan Insight UI → `ads_list_accounts` rejected with 401
- ✅ URL construction fixed (PR #23): preserve `/functions/v1` base path
- ✅ No secret leak in any output, log, or error message

---

## E. Troubleshooting

### CUAN_INSIGHT_CONNECTION_KEY is required

```
Error: CUAN_INSIGHT_CONNECTION_KEY is required when CUAN_INSIGHT_AUTH_MODE=connection_key
```

Pastikan `CUAN_INSIGHT_CONNECTION_KEY` di-set jika menggunakan `connection_key` mode.

### Cuan Insight returned status 404

```
"code": "INTERNAL_ERROR",
"message": "Cuan Insight returned status 404"
```

Penyebab umum:
- Endpoint `mcp-resolve-credential` belum di-deploy
- `CUAN_INSIGHT_API_BASE_URL` atau `CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH` salah
- Route belum terdaftar di Cuan Insight Edge Function

### Revoked key

Jika key di-revoke dari UI Cuan Insight, MCP call berikutnya akan gagal dengan:
- `PROVIDER_TOKEN_REVOKED` atau `AUTHENTICATION_REQUIRED`
- Tidak akan fallback ke credential lain
- Error message aman (redacted)

### Header x-cuan-mcp-connection-key belum diterima backend

Pastikan Cuan Insight backend menerima dan memvalidasi header `x-cuan-mcp-connection-key`.

---

## F. AI Client Compatibility

This MCP server is designed to work with any MCP-compatible AI client:

- Claude (Claude for Work custom connectors)
- Codex (OpenAI Codex CLI)
- Cursor
- Windsurf
- OpenAI Agents
- Hermes (n8n Hermes MCP)
- n8n
- Other MCP-compatible agents

Each client uses the same MCP protocol. The transport mode (stdio/SSE/Streamable HTTP) and auth mechanism (Connection Key / MCP Token) are the only differences in setup.

---

## G. Security Rules

- Never print raw connection key
- Never print providerToken
- Never print key_hash
- Never print Authorization header
- Never commit `.env`
- Use `.env.local` or shell export for real key
- Run `gitleaks detect --source . --redact` if available
- Connection key redaction covers: `x-cuan-mcp-connection-key`, `connectionKey`, `connection_key`, `connection-key`

---

## H. What Must Not Change

- **Do not store provider tokens in MCP server** — they belong in Cuan Insight
- **Do not expose providerToken to AI client** — internal only
- **Do not log Authorization headers, connection keys, or request bodies**
- **Do not change tool business logic unnecessarily**
- **Keep stdio as default transport**
- **Preserve SSE and Streamable HTTP support**
- **Keep npm audit at 0 vulnerabilities**
- **Preserve backward compatibility** — Connection Keys are additive, not replacement

---

## I. Future Work

- Full live smoke test with real Cuan Insight Connection Key
- OAuth-compatible connector support if needed (wait for partner demand)
- Setup docs per AI client (see cuan-insight roadmap Phase 4)
- Live connector testing with real AI clients (Claude, Codex, Cursor, n8n)

---

## J. Agent Instructions

- Treat **Cuan Insight** as credential control plane
- Treat **this repo** as MCP execution layer
- Keep docs and code **client-agnostic**
- **Do not design features solely around Claude**
- **Do not implement Cuan Insight UI** in this repo
- **Do not log providerToken**, connection keys, or auth headers
- **Preserve backward compatibility** — Connection Keys are additive, not replacement
- Read `docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md` before any auth-related work

---

*Part of adstream-mcp MCP ecosystem. See also: [ROADMAP.md](../ROADMAP.md), [MCP Client Setup](MCP_CLIENT_SETUP.md).*
