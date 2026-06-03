# MCP Client Setup

## Overview

`meta-ads-agent-skill` is a generic MCP server for Meta Ads analysis. It exposes read-only ads tools through the Model Context Protocol so MCP-compatible AI clients and agents can call the same tool surface.

Current default transport is **stdio**. Remote transport can use **SSE** via `MCP_TRANSPORT=sse` or **Streamable HTTP** via `MCP_TRANSPORT=streamable-http`.

---

## Supported Modes

### Stdio via Node (Default)

Use this mode when your MCP client can run a local command and pass environment variables to it.

```text
node /absolute/path/to/meta-ads-agent-skill/mcp-server/dist/index.js
```

Build before first use:

```bash
npm install
npm run build
cd mcp-server
npm run build
```

### Stdio via Docker

Use this mode when your MCP client can launch Docker as a stdio command.

Build the local image first:

```bash
docker build -f Dockerfile.mcp -t meta-ads-agent-skill:mcp-local .
```

Then point your MCP client at `docker run` with `-i` so stdio stays attached.

### SSE Remote Transport (New in Phase 16a)

Remote SSE transport is available using the current SDK. Start the server:

```bash
MCP_HTTP_ENABLED=true \
MCP_TRANSPORT=sse \
MCP_HTTP_BEARER_TOKEN=<MCP_REMOTE_AUTH_TOKEN> \
node mcp-server/dist/http.js
```

SSE is compatible with MCP clients that support remote SSE connections. The server exposes two endpoints:

- `GET /mcp` — Establishes SSE connection stream
- `POST /mcp?sessionId=<id>` — Sends JSON-RPC messages (sessionId from SSE endpoint event)

See [SSE Client Config](#sse-remote-client-config) for client setup.

Note: Streamable HTTP is implemented behind explicit opt-in. Use `MCP_TRANSPORT=streamable-http` to enable it.


### Streamable HTTP Remote Transport (New in Phase 16b)

Start the Streamable HTTP server:

```bash
MCP_HTTP_ENABLED=true \
MCP_TRANSPORT=streamable-http \
MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT=8787 \
MCP_HTTP_BEARER_TOKEN=<MCP_REMOTE_AUTH_TOKEN> \
node /absolute/path/to/meta-ads-agent-skill/mcp-server/dist/http.js
```

The server exposes:

- `GET /health` — Health check
- `POST /mcp` — Initializes Streamable HTTP session
- Subsequent requests use the `Mcp-Session-Id` response header value

Client config shape for clients that support remote Streamable HTTP:

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "url": "http://localhost:8787/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_REMOTE_AUTH_TOKEN>"
      }
    }
  }
}
```

Security notes:

- Always set `MCP_HTTP_BEARER_TOKEN` when exposing the HTTP server.
- Do not reuse Meta access tokens, `providerToken`, `CUAN_INSIGHT_MCP_TOKEN`, or `CUAN_INSIGHT_SUPABASE_ANON_KEY` as the bearer token.
- Keep production deployments behind HTTPS and a trusted reverse proxy.

### Transport Comparison

| Transport | Mode | Default | Remote | Status |
|-----------|------|---------|--------|--------|
| Stdio | Local | ✅ Yes | ❌ No | ✅ Production ready |
| SSE | Remote | ❌ Opt-in | ✅ Yes | ✅ Implemented (Phase 16a) |
| Streamable HTTP | Remote | ❌ Opt-in | ✅ Yes | ✅ Implemented (Phase 16b) |

---

## Required Env for Remote Cuan Insight Mode

Remote Cuan Insight mode resolves provider credentials through the Cuan Insight broker. Configure these variables without committing them:

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_API_BASE_URL=<cuan-insight-api-base-url>
CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH=<credential-resolve-path>
CUAN_INSIGHT_SUPABASE_ANON_KEY=<supabase-anon-key>
CUAN_INSIGHT_MCP_TOKEN=<mcp-token>
CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME=<mcp-token-header-name>
```

Security notes:

- Do not commit `.env`.
- Do not hardcode private endpoints or tokens in client config files that may be shared.
- Do not print or log `CUAN_INSIGHT_SUPABASE_ANON_KEY`, `CUAN_INSIGHT_MCP_TOKEN`, `providerToken`, or Meta access tokens.
- `BROKER_RUNTIME_MODE=remote` should not require `META_ACCESS_TOKEN` in the local MCP container.

---

## Generic Stdio Client Config

Use this shape for any MCP-compatible client that supports stdio servers. Replace paths and placeholders with your local values.

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "command": "node",
      "args": [
        "/absolute/path/to/meta-ads-agent-skill/mcp-server/dist/index.js"
      ],
      "env": {
        "BROKER_RUNTIME_MODE": "remote",
        "CUAN_INSIGHT_API_BASE_URL": "<cuan-insight-api-base-url>",
        "CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH": "<credential-resolve-path>",
        "CUAN_INSIGHT_SUPABASE_ANON_KEY": "<supabase-anon-key>",
        "CUAN_INSIGHT_MCP_TOKEN": "<mcp-token>",
        "CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME": "<mcp-token-header-name>"
      }
    }
  }
}
```

If your client supports inheriting environment variables from the shell, you can omit the `env` block and set variables outside the client process instead.

---

## Generic Docker Stdio Client Config

Build the image locally before using this config:

```bash
docker build -f Dockerfile.mcp -t meta-ads-agent-skill:mcp-local .
```

Use this shape for MCP-compatible clients that can launch Docker:

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file",
        "/absolute/path/to/meta-ads-agent-skill/.env",
        "meta-ads-agent-skill:mcp-local"
      ]
    }
  }
}
```

Keep `-i` in the Docker args. MCP stdio clients need stdin attached to exchange protocol messages.

---

## SSE Remote Client Config

For MCP clients that support remote SSE servers (connecting via URL rather than launching a local command), use this config shape.

Start the SSE server:

```bash
MCP_HTTP_ENABLED=true \
MCP_TRANSPORT=sse \
MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT=8787 \
MCP_HTTP_BEARER_TOKEN=<MCP_REMOTE_AUTH_TOKEN> \
node /absolute/path/to/meta-ads-agent-skill/mcp-server/dist/http.js
```

Client config (if your client supports SSE URL-based MCP):

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "url": "http://localhost:8787/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_REMOTE_AUTH_TOKEN>"
      }
    }
  }
}
```

### SSE Security Notes

- Keep `MCP_HTTP_HOST=127.0.0.1` for local-only access.
- For public exposure, use a reverse proxy (nginx, Caddy) or Cloudflare Tunnel with HTTPS.
- Always set `MCP_HTTP_BEARER_TOKEN` when exposing beyond localhost.
- Do not reuse Meta access tokens, `CUAN_INSIGHT_MCP_TOKEN`, or `CUAN_INSIGHT_SUPABASE_ANON_KEY` as the SSE bearer token.
- The `Authorization` header is used for MCP transport auth, not provider credential resolution.

### SSE vs Streamable HTTP

SSE is a valid MCP transport protocol. However, the newer **Streamable HTTP** specification offers:
- Simpler GET/POST endpoint separation without SSE streams for simple responses
- Official SDK support starting from `@modelcontextprotocol/sdk@1.x`
- Better support for stateless request/response patterns

Streamable HTTP is available through SDK v1.29.0. SSE remains available for clients that still use remote SSE.

---

## Client Examples

### Claude Desktop Example (Stdio)

Claude Desktop is one MCP client example. Add a server entry with the same command and env shape your local setup uses.

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "command": "node",
      "args": [
        "/absolute/path/to/meta-ads-agent-skill/mcp-server/dist/index.js"
      ],
      "env": {
        "BROKER_RUNTIME_MODE": "remote",
        "CUAN_INSIGHT_API_BASE_URL": "<cuan-insight-api-base-url>",
        "CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH": "<credential-resolve-path>",
        "CUAN_INSIGHT_SUPABASE_ANON_KEY": "<supabase-anon-key>",
        "CUAN_INSIGHT_MCP_TOKEN": "<mcp-token>",
        "CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME": "<mcp-token-header-name>"
      }
    }
  }
}
```

Other MCP-compatible agents can adapt the same command, args, and env shape. The project does not require Claude-specific behavior.

---

## Available Tools

Current broker MCP tools:

| Tool | Status | Purpose |
| --- | --- | --- |
| `ads_list_accounts` | available | List connected ads accounts through the broker. |
| `ads_get_campaign_performance` | available | Fetch normalized campaign performance for a date range. |
| `ads_get_adset_or_adgroup_performance` | available | Fetch normalized ad set or ad group performance for a date range. |
| `ads_get_ad_performance` | available | Fetch normalized ad performance for a date range. |
| `ads_get_creative_performance` | available in current tool registry | Fetch normalized creative performance for a date range when provider support is available. |
| `ads_generate_report` | available in current tool registry | Generate an ads report through the broker when provider support is available. |

Common inputs:

- `provider`: optional; defaults to `meta` when omitted.
- `accountId`: optional when resolved credentials include a default account.
- `since`: required by performance and report tools; format `YYYY-MM-DD`.
- `until`: required by performance and report tools; format `YYYY-MM-DD`.
- `params`: optional provider-safe parameters such as `limit`.

---

## Troubleshooting

### Missing Env

Symptoms:

- Server exits at startup.
- Tool calls return configuration errors.

Checks:

- Confirm required remote-mode env names exist.
- Confirm values are supplied to the MCP client process, not only to your interactive shell.
- For Docker, confirm `--env-file /absolute/path/.env` points to the intended file.

### Invalid MCP Token

Symptoms:

- Credential resolution fails.
- Broker returns auth-related errors.

Checks:

- Confirm `CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME` matches the broker endpoint expectation.
- Rotate the token if it may have been exposed.
- Do not paste the token into logs, issues, or chat transcripts.

### `ACCOUNT_NOT_CONNECTED`

Symptoms:

- Account listing or performance calls return `ACCOUNT_NOT_CONNECTED`.

Checks:

- Confirm the requested `accountId` is connected for the current user or workspace.
- Reconnect the ads account in the upstream product that owns credential resolution.
- Retry without `accountId` if credentials include a default account.

### No Records

Symptoms:

- Tool returns success with empty records.

Checks:

- Confirm `since` and `until` cover dates with spend or delivery.
- Confirm the connected account has active or historical campaigns.
- Try a wider date range before assuming data is missing.

### Docker Command Exits

Symptoms:

- Docker starts and exits immediately.

Checks:

- If run manually without MCP input, clean exit can be normal when stdin closes.
- In client config, keep `-i` so stdin remains attached.
- Run `docker run --rm -i --env-file /absolute/path/.env meta-ads-agent-skill:mcp-local` from a terminal to test interactive startup.

### HTTP `/mcp` Returns 501

This is expected in default HTTP skeleton mode. Set `MCP_TRANSPORT=streamable-http` to enable Streamable HTTP. In SSE mode, use `POST /mcp?sessionId=<id>` after establishing `GET /mcp`.

### SSE Connection Fails

Symptoms:

- Client cannot connect to SSE endpoint.
- `GET /mcp` returns non-200 status.

Checks:

- Confirm `MCP_HTTP_ENABLED=true` and `MCP_TRANSPORT=sse`.
- Confirm `MCP_HTTP_BEARER_TOKEN` matches the token in your client config.
- Confirm the host and port are reachable from your client.
- Check server logs for connection errors.
