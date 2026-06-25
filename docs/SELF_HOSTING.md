# Self-hosting and Client Setup

This guide explains the supported ways to use `adstream-mcp` from Claude, OpenAI, and other MCP-compatible clients.

## Choose your setup

| User type | Recommended setup | Why |
| --- | --- | --- |
| Non-coding user who wants the least setup | Cuan Insight connection key | No Meta token handling, no custom credential plumbing |
| Developer using a local laptop | Docker stdio | No public server, no domain, no HTTPS |
| Developer comfortable with Node.js | Node stdio | Fast local development |
| Team or server deployment | Remote Streamable HTTP | Share one MCP endpoint behind HTTPS/auth |
| OpenAI API developer | Responses API + remote MCP | Use OpenAI tool type `mcp` |
| Custom GPT / GPT Actions user | REST/OpenAPI wrapper | GPT Actions are REST/OpenAPI, not raw MCP |

## Important positioning

Cuan Insight is still the easiest path for non-coding users.

Self-hosted direct-token mode is for developers and advanced users who want to run their own MCP server and manage their own Meta credentials.

## Option A — Cuan Insight connection key (easiest for non-coders)

Use this when you want the lowest-friction setup and do not want to manage Meta tokens manually.

```env
BROKER_RUNTIME_MODE=remote
CUAN_INSIGHT_AUTH_MODE=connection_key
CUAN_INSIGHT_CONNECTION_KEY=your_connection_key
CUAN_INSIGHT_API_BASE_URL=https://your-cuan-insight-domain/functions/v1
```

Security notes:
- Do not commit `.env`.
- Do not share the connection key publicly.
- For hosted multi-user MCP, do not configure one shared global key; pass a per-user connection key per request.

## Option B — Claude Code / Claude Desktop with Docker stdio (recommended for local developers)

Use this when the user wants to run everything on their own laptop without a public server.

```bash
git clone https://github.com/ramadhanidiwanda-alt/adstream-mcp.git
cd adstream-mcp
cp .env.example .env
```

Edit `.env`:

```env
BROKER_RUNTIME_MODE=local
META_ACCESS_TOKEN=your_meta_access_token
META_AD_ACCOUNT_ID=act_your_ad_account_id
META_API_VERSION=v20.0
```

Build local Docker image:

```bash
docker build -f Dockerfile.mcp -t adstream-mcp:local .
```

MCP client config:

```json
{
  "mcpServers": {
    "adstream-mcp": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file",
        "/absolute/path/to/adstream-mcp/.env",
        "adstream-mcp:local"
      ]
    }
  }
}
```

Keep `-i`. Stdio MCP requires stdin to stay attached. If the container waits silently when run manually, that is normal.

## Option C — Node stdio (developer local mode)

```bash
git clone https://github.com/ramadhanidiwanda-alt/adstream-mcp.git
cd adstream-mcp
npm install
npm run build
npm run build --workspace=mcp-server
```

Example MCP config:

```json
{
  "mcpServers": {
    "adstream-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/adstream-mcp/mcp-server/dist/index.js"
      ],
      "env": {
        "BROKER_RUNTIME_MODE": "local",
        "META_ACCESS_TOKEN": "your_meta_access_token",
        "META_AD_ACCOUNT_ID": "act_your_ad_account_id",
        "META_API_VERSION": "v20.0"
      }
    }
  }
}
```

For Node stdio, ensure the MCP process receives the environment variables. Do not assume your interactive shell `.env` is automatically loaded by the MCP client.

## Option D — Remote Streamable HTTP server

Use this for VPS/server/team deployments.

```env
MCP_HTTP_ENABLED=true
MCP_TRANSPORT=streamable-http
MCP_HTTP_HOST=0.0.0.0
MCP_HTTP_PORT=8787
MCP_HTTP_BEARER_TOKEN=your_random_mcp_bearer_token
```

Generate a random bearer token:

```bash
openssl rand -hex 32
```

Start the HTTP service:

```bash
docker compose -f docker-compose.mcp.example.yml --profile http up -d --build meta-ads-mcp-http
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Remote MCP endpoint:

```text
https://mcp.example.com/mcp
```

Protect remote deployments with HTTPS, a reverse proxy or tunnel, and a dedicated MCP bearer token.

## Option E — OpenAI Responses API with remote MCP

```python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5.5",
    tools=[
        {
            "type": "mcp",
            "server_label": "adstream",
            "server_url": "https://mcp.example.com/mcp",
            "authorization": "Bearer YOUR_MCP_BEARER_TOKEN",
            "require_approval": "always",
            "allowed_tools": [
                "ads_get_account_performance",
                "ads_list_campaigns",
                "ads_get_campaign_performance"
            ]
        }
    ],
    input="Get Meta Ads account performance for act_your_ad_account_id from 2026-01-01 to 2026-06-24."
)

print(response.output_text)
```

Notes:
- The remote MCP server must be reachable by OpenAI, unless you use a supported secure tunnel.
- Use `require_approval: "always"` when testing or handling sensitive data.
- Use `allowed_tools` to limit cost, latency, and risk.
- The authorization value is not stored by OpenAI; pass it with each request.

## Option F — Custom GPT Actions

Custom GPT Actions are not raw MCP. They use REST API + OpenAPI schema.

A future REST/OpenAPI wrapper could expose endpoints like:

```text
POST /api/meta/account-performance
```

Example body:

```json
{
  "accountId": "act_your_ad_account_id",
  "since": "2026-01-01",
  "until": "2026-06-24"
}
```

## Test account-level performance

After connecting an MCP client, test `ads_get_account_performance` with:

```json
{
  "provider": "meta",
  "accountId": "act_your_ad_account_id",
  "since": "2026-01-01",
  "until": "2026-06-24"
}
```

This fetches Meta Insights at `level=account` and does not sum campaign rows.

## Security checklist

- Never commit `.env`.
- Never paste real Meta tokens into issues, docs, screenshots, or chat transcripts.
- Use a separate random bearer token for remote MCP HTTP.
- Do not expose `/mcp` publicly without HTTPS and authentication.
- Prefer local stdio for personal laptop usage.
- Prefer Cuan Insight connection key for non-coding users who do not want to manage Meta credentials directly.
