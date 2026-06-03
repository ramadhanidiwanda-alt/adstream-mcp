# Cuan Insight Connection Key Compatibility

> **Status**: Reference — Connection Key design not yet implemented  
> **Date**: 2026-06-03  
> **Related**: `docs/roadmap/mcp-connector-platform.md` (cuan-insight)

---

## A. Purpose

This document explains how the meta-ads-agent-skill MCP server is designed to work with Cuan Insight as a credential authority, and how the future Cuan Insight Connection Key system should integrate with this server.

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
- TypeScript strict mode, Vitest test suite

---

## C. Existing Auth Modes

### 1. Developer / Self-Host MCP Token

Used when running the MCP server locally or self-hosted with a direct MCP token from Cuan Insight.

- Token passed via `X-Cuan-MCP-Token` header (hosted mode) or `Authorization: Bearer` header (local/dev)
- Token is SHA-256 hashed in Cuan Insight `mcp_access_tokens` table
- Cuan Insight validates hash and resolves provider token

### 2. Remote Cuan Insight Credential Resolver

Used when the MCP server is hosted and needs to authenticate requests from AI clients.

- AI client connects to the MCP server (stdio/SSE/Streamable HTTP)
- MCP server makes HTTP request to Cuan Insight Edge Function
- Cuan Insight validates and returns provider token internally
- MCP server calls provider API

### 3. Local Provider Credential Mode

Available for local development/testing where a direct Meta access token is set via environment.

- `META_ACCESS_TOKEN` env var (local dev only)
- Not used in production or hosted deployments

---

## D. Future Connection Key Support

### What Is a Connection Key?

A Connection Key is a user-facing API key generated in Cuan Insight that allows AI clients to connect to the MCP server without exposing developer-level MCP tokens.

### Key Properties

- Organization-rooted (not workspace-only)
- Scoped by workspace, provider, account, and permission level
- Stored hashed in Cuan Insight
- User sees it once at creation time
- Revokable (immediate invalidation)

### Integration with MCP Server

The MCP server may need an **auth adapter** to validate or exchange a Connection Key:

1. AI client connects with a Connection Key
2. MCP server detects key format (Connection Key vs MCP Token)
3. MCP server calls Cuan Insight resolver with the key
4. Cuan Insight validates key, checks permissions, returns provider token
5. MCP server caches resolved credentials for session lifetime

### Auth Adapter Design Consideration

```typescript
interface AuthAdapter {
  authenticate(request: AuthRequest): Promise<AuthResult>;
}

// Future implementation could support:
class ConnectionKeyAdapter implements AuthAdapter {
  async authenticate(request: AuthRequest): Promise<AuthResult> {
    // Detect key type
    // Call Cuan Insight resolver
    // Return validated credentials
  }
}
```

### Relationship to Existing MCP Token Flow

Connection Keys are **additive** — they do not replace the existing MCP token flow. Both should work:

| Auth Method | Use Case |
|---|---|
| MCP Token | Developer self-host, direct API access |
| Connection Key | End-user AI connector setup (Claude, Codex, Cursor, etc.) |

---

## E. AI Client Compatibility

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

## F. What Must Not Change

- **Do not store provider tokens in MCP server** — they belong in Cuan Insight
- **Do not expose providerToken to AI client** — internal only
- **Do not log Authorization headers or request bodies**
- **Do not change tool business logic unnecessarily** — unless connection-key compatibility requires it
- **Keep stdio as default transport**
- **Preserve SSE and Streamable HTTP support**
- **Keep npm audit at 0 vulnerabilities**

---

## G. Future Work

- Connection-key auth adapter for MCP server
- OAuth-compatible connector support if needed (wait for partner demand)
- Setup docs per AI client (see cuan-insight roadmap Phase 4)
- Live connector testing with real AI clients (Claude, Codex, Cursor, n8n)

---

## H. Agent Instructions

- Treat **Cuan Insight** as credential control plane
- Treat **this repo** as MCP execution layer
- Keep docs and code **client-agnostic**
- **Do not design features solely around Claude**
- **Do not implement Cuan Insight UI** in this repo
- **Do not log providerToken** or auth headers
- **Preserve backward compatibility** — Connection Keys are additive, not replacement
- Read `docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md` before any auth-related work

---

*Part of meta-ads-agent-skill MCP ecosystem. See also: [ROADMAP.md](../ROADMAP.md), [MCP Client Setup](MCP_CLIENT_SETUP.md).*
