# MCP Client Setup

## Overview

`meta-ads-agent-skill` is a generic MCP server for Meta Ads analysis. It exposes read-only ads tools through the Model Context Protocol so MCP-compatible AI clients and agents can call the same tool surface.

Current recommended transport is stdio. Any MCP client that can launch a local stdio server can use this project with the Node or Docker commands below.

Remote HTTP is not production-ready yet. The HTTP entrypoint is a skeleton for future transport work, and `POST /mcp` currently returns a fast-fail 501 response.

## Supported Modes

### Stdio via Node

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

### HTTP Skeleton Status

The HTTP entrypoint is intentionally not production-ready.

- `GET /health` exists for local checks.
- `POST /mcp` currently returns 501 because current SDK wiring does not provide production Streamable HTTP transport in this project.
- Do not expose `/mcp` publicly for production use.
- Keep using stdio until the HTTP transport is upgraded and validated.

See `docs/REMOTE_MCP_HTTP.md` for current HTTP skeleton details.

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

## Client Examples

### Claude Desktop Example

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

This is expected in the current HTTP skeleton. Use stdio via Node or Docker for MCP clients until HTTP transport is production-ready.
