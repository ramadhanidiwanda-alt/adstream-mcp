# Remote MCP HTTP

Phase 12A adds an explicit HTTP entrypoint for self-hosted MCP URL experiments.
Stdio remains default and unchanged.

Phase 17.5C adds Connection Key auth mode for Cuan Insight credential resolution.

## Transport Status

Current MCP SDK version is `@modelcontextprotocol/sdk@1.29.0`.
Streamable HTTP is supported via `MCP_TRANSPORT=streamable-http`.
SSE is supported via `MCP_TRANSPORT=sse`.
Stdio remains the default entrypoint.

## Stdio vs HTTP

- Stdio: local MCP transport for desktop clients, launched by `mcp-server/src/index.ts`.
- HTTP: self-hosted URL entrypoint, launched explicitly by `mcp-server/src/http.ts`.

Do not replace stdio config with HTTP unless your MCP client supports remote URLs and you have auth in place.

## Endpoints

```text
GET /health
GET /.well-known/oauth-authorization-server
GET /.well-known/oauth-protected-resource
GET /authorize
POST /authorize
POST /token
POST /revoke
POST /mcp
```

`GET /health` returns:

```json
{
  "ok": true,
  "transport": "streamable-http",
  "mode": "remote",
  "oauth": true
}
```

`oauth` is `true` when `MCP_PUBLIC_BASE_URL` is configured.

### Debug Mode

Set `MCP_OAUTH_DEBUG=true` to enable safe debug logging for the OAuth flow:

- Output via `console.error` with `[OAUTH_DEBUG]` prefix
- All sensitive fields (connection_key, code, code_verifier, access_token, bearer, key_hash, Authorization header) are **automatically redacted** to `[REDACTED]`
- Only safe metadata is logged: client ID prefix (first 8 chars), redirect URI host, scope, step names
- **Never expose sensitive data even in debug mode**
- Default: `false` (disabled in production)

### OAuth Endpoints (Phase 19)

For native MCP connector compatibility (Claude Desktop, Claude Code, etc.):

- **`GET /.well-known/oauth-authorization-server`** — OAuth metadata for auto-discovery
- **`GET /.well-known/oauth-protected-resource`** — Protected resource metadata
- **`GET /authorize`** — Renders HTML form for Connection Key input
- **`POST /authorize`** — Validates Connection Key, creates authorization code (PKCE), redirects to client
- **`POST /token`** — PKCE exchange: authorization code → Bearer access token
- **`POST /revoke`** — Revoke access token

`mode` is `remote` when `BROKER_RUNTIME_MODE=remote`; otherwise it is `local`.

### OAuth Flow

```
Claude klik Connect
→ redirect ke https://mcp.cuaninsight.com/authorize?...
→ Cuan Insight MCP server tampilkan form "Masukkan Connection Key"
→ user paste Connection Key dari Cuan Insight UI
→ server validasi Connection Key ke Cuan Insight resolver
→ jika valid, server buat authorization code (PKCE S256)
→ redirect balik ke Claude redirect_uri dengan ?code=...&state=...
→ Claude call POST /token dengan code + code_verifier
→ server validasi PKCE
→ server issue access token (Bearer, 24h TTL)
→ Claude call /mcp dengan Authorization: Bearer <access_token>
→ MCP server resolve token → connection context
→ tools/call berjalan
```

### Auth Modes

| Mode | Auth Method | Header | Connector Type |
|---|---|---|---|
| OAuth (Phase 19) | Connection Key via form → Bearer token | `Authorization: Bearer <access_token>` | Native Claude connector |
| Manual Header | Direct Connection Key | `x-cuan-mcp-connection-key` | Custom client |
| Server Token (legacy) | Static bearer token | `Authorization: Bearer <MCP_HTTP_BEARER_TOKEN>` | Simple self-hosted |

### Limitations (MVP)

- OAuth store is **in-memory by default** — auth codes and tokens are lost on server restart
- **Persistent store (Phase 20A)**: `MCP_OAUTH_STORE_DRIVER=supabase` persists tokens in Supabase. See [Persistent OAuth Store](#persistent-oauth-store-phase-20a).
- No refresh token support yet
- Connection Key validation makes a lightweight probe to Cuan Insight; if resolver is unavailable, key is accepted and validated at tool call time
- PKCE challenge is computed using Node.js `digest('base64url')` directly (RFC 7636 compliant); do **not** wrap with additional `base64UrlEncode()` — that would double-encode and break Claude's native connector

## HTTP Env

```env
MCP_HTTP_ENABLED=true
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=8787
MCP_HTTP_PATH=/mcp
MCP_HTTP_BEARER_TOKEN=change_me_for_self_hosted_http
MCP_TRANSPORT=sse
MCP_PUBLIC_BASE_URL=https://mcp.cuaninsight.com
MCP_OAUTH_AUTH_CODE_TTL_SECONDS=300
MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS=86400
```

Defaults:

- `MCP_HTTP_ENABLED=false`
- `MCP_HTTP_HOST=127.0.0.1`
- `MCP_HTTP_PORT=8787`
- `MCP_HTTP_PATH=/mcp`

OAuth defaults (Phase 19):

- `MCP_PUBLIC_BASE_URL` — not set (OAuth disabled)
- `MCP_OAUTH_AUTH_CODE_TTL_SECONDS=300` (5 minutes)
- `MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS=86400` (24 hours)

Binding to `0.0.0.0` requires setting `MCP_HTTP_HOST=0.0.0.0` explicitly.
If `MCP_HTTP_BEARER_TOKEN` is set, endpoints require:

```text
Authorization: Bearer <token>
```

Do not use `CUAN_INSIGHT_MCP_TOKEN` as this bearer token. That token belongs to Cuan Insight credential resolution, not public HTTP access control.

## Cuan Insight Credential Env

Remote broker mode uses Cuan Insight credential resolver env:

### Recommended: Connection Key Mode (Phase 17.5C)

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_API_BASE_URL=https://your-cuan-insight-domain/functions/v1
CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH=/mcp-resolve-credential
CUAN_INSIGHT_SUPABASE_ANON_KEY=your_supabase_anon_key
CUAN_INSIGHT_AUTH_MODE=connection_key
CUAN_INSIGHT_CONNECTION_KEY=<key-from-cuan-insight-ui>
```

- Key dibuat dari Cuan Insight UI > AI/MCP Connectors
- MCP server mengirim header `x-cuan-mcp-connection-key`
- Raw key hanya muncul sekali saat pembuatan

> Current v0.4.0 supports env-based Connection Key for local/single-tenant use. Per-request `x-cuan-mcp-connection-key` passthrough for hosted multi-user remote MCP is planned for a future release. Do not set a global `CUAN_INSIGHT_CONNECTION_KEY` for multi-user deployments.


### Legacy: MCP Token Mode (default, backward compatible)

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_API_BASE_URL=https://your-cuan-insight-domain/functions/v1
CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH=/mcp-resolve-credential
CUAN_INSIGHT_SUPABASE_ANON_KEY=your_supabase_anon_key
CUAN_INSIGHT_AUTH_MODE=mcp_token
CUAN_INSIGHT_MCP_TOKEN=your_cuan_insight_mcp_token
CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME=X-Cuan-MCP-Token
```

Use your own hosted endpoint. Do not hardcode private endpoint, token, anon key, project ref, or domain in this repo.

## Persistent OAuth Store (Phase 20A)

Phase 20A adds a persistent OAuth store foundation via `MCP_OAUTH_STORE_DRIVER`.

### Drivers

| Driver | Description |
|---|---|
| `memory` (default) | In-memory store. Data lost on restart. Backward compatible. |
| `supabase` | Persistent Supabase-backed store. Requires `MCP_OAUTH_SUPABASE_URL` + `MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY`. |

### Env

```env
# OAuth store driver (default: memory)
MCP_OAUTH_STORE_DRIVER=memory

# Supabase (required when driver=supabase)
MCP_OAUTH_SUPABASE_URL=https://<project>.supabase.co
MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Security

- Authorization codes stored as **SHA-256 hash** only — raw code never persisted.
- Access tokens stored as **SHA-256 hash** only — raw token returned once at creation.
- Connection keys stored as **SHA-256 hash** only.
- **Provider tokens are never stored** in the OAuth store.
- `service_role` key must never be committed or logged.

### Supabase Schema

Tables: `mcp_oauth_clients`, `mcp_oauth_auth_codes`, `mcp_oauth_access_tokens`.
Full schema in `docs/PERSISTENT_OAUTH_STORE.md`.

### Current Status (Phase 20A.1)

- `MemoryOAuthStore` (backward compatible default) — production-ready.
- `SupabaseOAuthStore` — **skeleton only**. Implements the `IOAuthStore` interface with stub Supabase queries. Full production wiring requires:
  - SQL migration to Cuan Insight Supabase (Phase 20B)
  - Real Supabase REST API calls (fetch-based, no SDK dependency)
  - Connection key resolution bridge (in-memory cache → Cuan Insight hash-based resolution)
- **No production switch yet.** Default behavior unchanged.

## Troubleshooting

### CUAN_INSIGHT_CONNECTION_KEY is required

```
Error: CUAN_INSIGHT_CONNECTION_KEY is required when CUAN_INSIGHT_AUTH_MODE=connection_key
```

Pastikan `CUAN_INSIGHT_CONNECTION_KEY` di-set jika menggunakan connection_key mode.

### Cuan Insight returned status 404

```
"code": "INTERNAL_ERROR",
"message": "Cuan Insight returned status 404"
```

Endpoint `mcp-resolve-credential` mungkin belum di-deploy atau route salah.

### Revoked Connection Key

Jika key di-revoke dari UI Cuan Insight, MCP call berikutnya akan gagal dengan error revoked/unauthorized. Tidak akan fallback ke credential lain.

## Run Locally

Build first:

```bash
npm run build
cd mcp-server && npm run build
```

Start HTTP server:

```bash
MCP_HTTP_ENABLED=true \
MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT=8787 \
MCP_HTTP_PATH=/mcp \
MCP_HTTP_BEARER_TOKEN=local_test_token \
MCP_TRANSPORT=sse \
node mcp-server/dist/http.js
```

Check health:

```bash
curl http://127.0.0.1:8787/health
```

Check bearer guard:

```bash
curl -i -X POST http://127.0.0.1:8787/mcp
curl -i -X POST http://127.0.0.1:8787/mcp \
  -H 'Authorization: Bearer local_test_token'
```

## Docker

Default Docker command remains stdio:

```bash
node mcp-server/dist/index.js
```

Optional HTTP compose service is behind the `http` profile:

```bash
docker compose -f docker-compose.mcp.example.yml --profile http up --build meta-ads-mcp-http
```

The example maps host loopback `127.0.0.1:8787:8787`. It sets
`MCP_HTTP_HOST=0.0.0.0` explicitly inside the container so Docker port publishing
works, but it does not expose the host port publicly.

## Security

- Do not commit `.env`.
- Do not print tokens, connection keys, or provider tokens.
- Do not expose HTTP mode publicly without HTTPS, reverse proxy, and auth.
- **OAuth flow (Phase 19)**: Connection Key entered via `/authorize` form is validated against Cuan Insight but never stored in HTML, logs, or redirect URLs.
- **Access tokens** from `/token` are stored as SHA-256 hashes; raw tokens are returned only once at creation.
- **Authorization codes** are single-use, short-lived (5 min TTL), and PKCE-protected.
- Connection key redaction covers `x-cuan-mcp-connection-key`, `connectionKey`, `connection_key`, `connection-key`.
- Project scope stays read-only; no write operations are added.


## OAuth Token Auth Mode (Phase 20B.3)

When `MCP_OAUTH_STORE_DRIVER=supabase`, the server uses OAuth token auth mode instead of raw Connection Key:

1. **Authorization**: User submits raw Connection Key only once during `/authorize`
2. **Connection Key ID**: Cuan Insight resolver returns `identity.connectionKeyId` (opaque reference)
3. **Storage**: SupabaseOAuthStore stores `connectionKeyId`, NOT the raw connection key
4. **Token Resolution**: Access tokens are hashed (SHA-256) and resolved through Cuan Insight `mcp-resolve-credential` with `authType: "oauth_token"`
5. **Dual Auth Types**: `resolveAccessToken()` returns `{ authType: "connection_key", connectionKey }` (memory) or `{ authType: "oauth_token", accessTokenHash, ... }` (supabase)

### Security guarantees

- Raw Connection Key never stored in Supabase (only `connectionKeyId` reference)
- Authorization codes stored as SHA-256 hash only
- Access tokens stored as SHA-256 hash only
- Raw values never persisted

### Production switch

Default remains `memory`. To enable Supabase:

```bash
MCP_OAUTH_STORE_DRIVER=supabase
MCP_OAUTH_SUPABASE_URL=https://your-project.supabase.co
MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

### Rollback

```bash
MCP_OAUTH_STORE_DRIVER=memory
```

Production remains memory until DB migrations are applied and env switch is explicitly done.

---

## Phase 20B.4 — Persistent OAuth Remote Mode

Hosted Streamable HTTP deployments now support persistent OAuth through Supabase-backed MCP OAuth storage.

### Required Production Settings

```env
MCP_TRANSPORT=streamable-http
BROKER_RUNTIME_MODE=remote
MCP_OAUTH_STORE_DRIVER=supabase
MCP_OAUTH_DEBUG=false
MCP_SUPABASE_STORE_DEBUG=false
```

`MCP_OAUTH_SUPABASE_URL` and `MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY` are required when `MCP_OAUTH_STORE_DRIVER=supabase`. Keep both outside Git and deployment logs.

### Credential Resolution Flow

1. Client completes MCP OAuth and receives bearer access token.
2. MCP server hashes bearer token to `token_hash`.
3. Supabase OAuth store resolves `token_hash` to `connection_key_id`, `client_id`, `scope`, `resource`, and expiry metadata.
4. Broker calls Cuan Insight resolver with `authType=oauth_token` and `tokenHash`.
5. Cuan Insight maps `connection_key_id` to provider credential context and returns a short-lived provider token.
6. `ads_list_accounts` calls provider account discovery with the resolved OAuth user context.

Raw bearer tokens, raw Connection Keys, and provider tokens never appear in MCP responses.

### Restart Behavior

`startHttpMcpServer()` awaits `loadPersistedData()` before `server.listen()`. This prevents a startup race where a request could arrive before persisted OAuth tokens were loaded into the in-memory cache.

### Remote-Safe Account Listing

`ads_list_accounts` is the canonical remote account discovery tool. `meta_get_ad_accounts` in remote mode routes to the same remote-safe listing path and must not require local `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` environment variables.

### Rollback

Set `MCP_OAUTH_STORE_DRIVER=memory`, restart `cuan-mcp`, then reconnect Claude/ChatGPT connectors if sessions no longer resolve.
