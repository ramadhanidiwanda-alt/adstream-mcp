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
POST /mcp
```

`GET /health` returns:

```json
{
  "ok": true,
  "transport": "sse",
  "mode": "remote"
}
```

`mode` is `remote` when `BROKER_RUNTIME_MODE=remote`; otherwise it is `local`.

## HTTP Env

```env
MCP_HTTP_ENABLED=true
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=8787
MCP_HTTP_PATH=/mcp
MCP_HTTP_BEARER_TOKEN=change_me_for_self_hosted_http
MCP_TRANSPORT=sse
```

Defaults:

- `MCP_HTTP_ENABLED=false`
- `MCP_HTTP_HOST=127.0.0.1`
- `MCP_HTTP_PORT=8787`
- `MCP_HTTP_PATH=/mcp`

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
- Do not expose HTTP mode publicly without HTTPS, reverse proxy, and bearer/OAuth.
- Do not deploy this skeleton as production remote MCP without auth.
- OAuth Cuan Insight login is not implemented.
- Connection key redaction covers `x-cuan-mcp-connection-key`, `connectionKey`, `connection_key`, `connection-key`.
- Project scope stays read-only; no write operations are added.
