# Remote MCP HTTP Skeleton

Phase 12A adds an explicit HTTP entrypoint for self-hosted MCP URL experiments.
Stdio remains default and unchanged.

## Transport Status

Current MCP SDK version is `@modelcontextprotocol/sdk@0.5.0`.
This version includes stdio and SSE transports, but no official Streamable HTTP server transport.
Because Streamable HTTP is not available, `POST /mcp` fails fast with:

```text
HTTP transport is not available with current MCP SDK version.
```

This is not production-ready remote MCP. It is a safe skeleton for future SDK upgrade work.
SSE exists in this SDK, but it is not wired as default production transport in this phase.

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
  "transport": "http",
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
```

Defaults:

- `MCP_HTTP_ENABLED=false`
- `MCP_HTTP_HOST=127.0.0.1`
- `MCP_HTTP_PORT=8787`
- `MCP_HTTP_PATH=/mcp`

Binding to `0.0.0.0` requires setting `MCP_HTTP_HOST=0.0.0.0` explicitly.
If `MCP_HTTP_BEARER_TOKEN` is set, `POST /mcp` requires:

```text
Authorization: Bearer <token>
```

Do not use `CUAN_INSIGHT_MCP_TOKEN` as this bearer token. That token belongs to Cuan Insight credential resolution, not public HTTP access control.

## Cuan Insight Credential Env

Remote broker mode still uses Cuan Insight credential resolver env:

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_API_BASE_URL=https://your-cuan-insight-domain/functions/v1
CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH=/mcp-resolve-credential
CUAN_INSIGHT_SUPABASE_ANON_KEY=your_supabase_anon_key
CUAN_INSIGHT_MCP_TOKEN=your_cuan_insight_mcp_token
CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME=X-Cuan-MCP-Token
```

Use your own hosted endpoint. Do not hardcode private endpoint, token, anon key, project ref, or domain in this repo.

## Run Locally

Build first:

```bash
npm run build
cd mcp-server && npm run build
```

Start HTTP skeleton explicitly:

```bash
MCP_HTTP_ENABLED=true \
MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT=8787 \
MCP_HTTP_PATH=/mcp \
MCP_HTTP_BEARER_TOKEN=local_test_token \
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
- Do not print tokens.
- Do not expose HTTP mode publicly without HTTPS, reverse proxy, and bearer/OAuth.
- Do not deploy this skeleton as production remote MCP.
- OAuth Cuan Insight login is not implemented in Phase 12A.
- Claude user login is not implemented in Phase 12A.
- Project scope stays read-only; no write operations are added.
