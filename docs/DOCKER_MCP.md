# Docker MCP Server

This Docker setup runs the Meta Ads MCP stdio server:

```bash
node mcp-server/dist/index.js
```

It is not a Remote MCP HTTP URL. Claude Remote URL / HTTP MCP needs a separate HTTP transport phase.

## Build

```bash
docker build -f Dockerfile.mcp -t meta-ads-agent-skill:mcp .
```

## Run

Create your runtime env file first:

```bash
cp .env.example .env
# edit .env
```

Then run the stdio server container:

```bash
docker run --rm --env-file .env meta-ads-agent-skill:mcp
```

## Docker Compose

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

## Security Notes

- Do not commit `.env`.
- Do not use a Supabase service role key.
- Do not share your MCP token.
- Pass secrets at runtime with `--env-file` or your container platform secret manager.
- Do not hardcode private endpoints, access tokens, anon keys, or project refs in Docker files.

## Limitations

- This image runs stdio MCP only.
- It does not expose an HTTP endpoint.
- Claude Remote URL / HTTP MCP requires a separate HTTP transport implementation.
- Current project scope remains read-only; no production write operations are added here.
