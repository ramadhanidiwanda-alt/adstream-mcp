# Docker MCP Server

This Docker setup runs the Meta Ads MCP server. Default transport is **stdio**.
A remote HTTP server can be started via the `meta-ads-mcp-http` service with `MCP_TRANSPORT=sse` or `MCP_TRANSPORT=streamable-http`.

## Build

```bash
docker build -f Dockerfile.mcp -t meta-ads-agent-skill:mcp .
```

## Run (Stdio — Default)

Create your runtime env file first:

```bash
cp .env.example .env
# edit .env
```

Then run the stdio server container:

```bash
docker run --rm --env-file .env meta-ads-agent-skill:mcp
```

## Run (SSE Remote Transport)

Start the HTTP server with SSE transport:

```bash
docker run --rm \
  --env-file .env \
  -e MCP_HTTP_ENABLED=true \
  -e MCP_TRANSPORT=sse \
  -e MCP_HTTP_BEARER_TOKEN=<MCP_REMOTE_AUTH_TOKEN> \
  -p 127.0.0.1:8787:8787 \
  meta-ads-agent-skill:mcp \
  node mcp-server/dist/http.js
```

The server exposes:

- `GET /mcp` — SSE connection endpoint
- `POST /mcp?sessionId=<id>` — JSON-RPC message endpoint
- `GET /health` — Health check

Always bind to `127.0.0.1` unless behind a reverse proxy.

## Run (Streamable HTTP Remote Transport)

Start the HTTP server with Streamable HTTP transport:

```bash
docker run --rm \
  --env-file .env \
  -e MCP_HTTP_ENABLED=true \
  -e MCP_TRANSPORT=streamable-http \
  -e MCP_HTTP_BEARER_TOKEN=<MCP_REMOTE_AUTH_TOKEN> \
  -p 127.0.0.1:8787:8787 \
  meta-ads-agent-skill:mcp \
  node mcp-server/dist/http.js
```

The server exposes:

- `POST /mcp` — Streamable HTTP session initialization
- `GET /health` — Health check

Always bind to `127.0.0.1` unless behind a reverse proxy.

### Docker Compose (SSE or Streamable HTTP)

The optional HTTP compose service uses the `http` profile:

```bash
docker compose -f docker-compose.mcp.example.yml --profile http up --build meta-ads-mcp-http
```

The compose example maps host loopback `127.0.0.1:8787:8787`, runs
`node mcp-server/dist/http.js`, and sets `MCP_HTTP_HOST=0.0.0.0` explicitly inside
the container so Docker port publishing works.

Add `MCP_TRANSPORT=sse` or `MCP_TRANSPORT=streamable-http` to the compose env or override to enable the desired remote transport.

## Docker Compose (Stdio)

```bash
cp .env.example .env
# edit .env
docker compose -f docker-compose.mcp.example.yml up --build
```

The compose example uses service name `meta-ads-mcp`, builds from `Dockerfile.mcp`, reads `.env`, and restarts unless stopped.

## Remote Credential Mode

Set these values in `.env`:

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_API_BASE_URL=https://your-cuan-insight-domain/functions/v1
CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH=/mcp-resolve-credential
CUAN_INSIGHT_SUPABASE_ANON_KEY=your_supabase_anon_key
CUAN_INSIGHT_MCP_TOKEN=your_cuan_insight_mcp_token
CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME=X-Cuan-MCP-Token
```

Use your own hosted endpoint. Do not bake these values into the image.

## Local Legacy Mode

Set these values in `.env` if you still use direct Meta token mode:

```env
BROKER_RUNTIME_MODE=local
META_ACCESS_TOKEN=your_meta_access_token
META_AD_ACCOUNT_ID=act_your_ad_account_id
META_API_VERSION=v20.0
```

## Remote Transport Notes

- **Stdio remains the default transport.** Remote transports must be explicitly enabled with `MCP_TRANSPORT`.
- SSE is enabled with `MCP_TRANSPORT=sse`.
- Streamable HTTP is enabled with `MCP_TRANSPORT=streamable-http`.
- Each remote session creates its own MCP server instance. Sessions are cleaned up on disconnect.
- `MCP_HTTP_BEARER_TOKEN` is used for remote HTTP auth. Set it to a secure random value.

## Security Notes

- Do not commit `.env`.
- Do not use a Supabase service role key.
- Do not share your MCP token.
- Pass secrets at runtime with `--env-file` or your container platform secret manager.
- Do not hardcode private endpoints, access tokens, anon keys, or project refs in Docker files.
- For remote HTTP mode, always set `MCP_HTTP_BEARER_TOKEN`. Without it, the remote endpoint has no auth.
- Use a reverse proxy or Cloudflare Tunnel for public exposure. Never bind remote MCP directly to `0.0.0.0` on a public interface.

## Limitations

- This image runs stdio MCP by default.
- Remote mode must be started explicitly with `MCP_TRANSPORT=sse` or `MCP_TRANSPORT=streamable-http`.
- Default HTTP skeleton mode still returns 501 unless a remote transport is selected.
- Current project scope remains read-only; no production write operations are added here.
