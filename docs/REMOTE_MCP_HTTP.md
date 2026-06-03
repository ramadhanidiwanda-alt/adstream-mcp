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

- OAuth store is **in-memory only** — auth codes and tokens are lost on server restart
- Not suitable for multi-replica deployments without Redis/DB-backed store
- No refresh token support yet
- Connection Key validation makes a lightweight probe to Cuan Insight; if resolver is unavailable, key is accepted and validated at tool call time

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
