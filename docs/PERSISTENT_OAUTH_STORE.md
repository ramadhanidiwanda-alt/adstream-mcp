# Persistent OAuth Store

> **Phase:** 20A.1  
> **Status:** Foundation (skeleton)  
> **Production:** Not yet — requires Phase 20B  

## Overview

Phase 20A replaces the in-memory-only OAuth store with a driver-based architecture:

- `IOAuthStore` — interface contract for all store implementations
- `MemoryOAuthStore` — in-memory (default, backward compatible, dev/local)
- `SupabaseOAuthStore` — persistent (Supabase-backed, production target)

## Architecture

```
http.ts
  └─ getOAuthStore()
       └─ createOAuthStoreFromEnv(env)
            ├─ MCP_OAUTH_STORE_DRIVER=memory → MemoryOAuthStore
            └─ MCP_OAUTH_STORE_DRIVER=supabase → SupabaseOAuthStore
```

## Env Configuration

```env
# Driver (default: memory)
MCP_OAUTH_STORE_DRIVER=memory

# Supabase (required when driver=supabase)
MCP_OAUTH_SUPABASE_URL=https://<project>.supabase.co
MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Database Schema (Supabase)

### `mcp_oauth_clients`

```sql
CREATE TABLE mcp_oauth_clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT NOT NULL UNIQUE,
  client_name   TEXT,
  redirect_uris JSONB NOT NULL DEFAULT '[]',
  grant_types   JSONB NOT NULL DEFAULT '["authorization_code"]',
  response_types JSONB NOT NULL DEFAULT '["code"]',
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  scope         TEXT NOT NULL DEFAULT 'mcp read write',
  resource      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);
```

### `mcp_oauth_auth_codes`

```sql
CREATE TABLE mcp_oauth_auth_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash             TEXT NOT NULL UNIQUE,    -- SHA-256(code)
  client_id             TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id),
  redirect_uri          TEXT NOT NULL,
  code_challenge        TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scope                 TEXT NOT NULL,
  resource              TEXT,
  connection_key_hash   TEXT NOT NULL,            -- SHA-256(connection_key)
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_codes_code_hash ON mcp_oauth_auth_codes(code_hash);
CREATE INDEX idx_auth_codes_expires ON mcp_oauth_auth_codes(expires_at) WHERE used_at IS NULL;
```

### `mcp_oauth_access_tokens`

```sql
CREATE TABLE mcp_oauth_access_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash          TEXT NOT NULL UNIQUE,       -- SHA-256(token)
  client_id           TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id),
  scope               TEXT NOT NULL,
  resource            TEXT,
  connection_key_hash TEXT NOT NULL,               -- SHA-256(connection_key)
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at        TIMESTAMPTZ
);

CREATE INDEX idx_access_tokens_token_hash ON mcp_oauth_access_tokens(token_hash);
CREATE INDEX idx_access_tokens_expires ON mcp_oauth_access_tokens(expires_at) WHERE revoked_at IS NULL;
```

## Security

- **Authorization codes:** SHA-256 hash stored. Raw code returned once at creation, never persisted.
- **Access tokens:** SHA-256 hash stored. Raw token returned once at creation, never persisted.
- **Connection keys:** SHA-256 hash stored. Raw key never persisted in DB.
- **Provider tokens:** NEVER stored in OAuth store. Resolved from Cuan Insight at runtime.
- **Supabase access:** `service_role` key only. Tables behind RLS — no public access.

## Known Blockers (Phase 20A.1)

### Connection Key Recovery

The `SupabaseOAuthStore` stores `connection_key_hash` but cannot recover the raw `connectionKey` needed to resolve Cuan Insight credentials.

**Current approach:** An in-memory `connectionKeyCache` (Map<tokenHash, connectionKey>) bridges the gap. This cache is lost on restart.

**Resolution needed (Phase 20B):**
- Option A: Cuan Insight supports `resolveByHash(connectionKeyHash)` for credential resolution.
- Option B: Encrypt connection key with server-side key (not hash) for recoverability.
- Option C: Keep in-memory cache and accept re-auth on restart for now.

### Async Interface Mismatch

`IOAuthStore` methods are synchronous but Supabase queries are inherently async. The skeleton uses sync stubs.

**Resolution needed:** Either make `IOAuthStore` async (breaking) or use a sync adapter pattern with pre-fetched data.

## Implementation Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| 20A.1 | IOAuthStore, MemoryOAuthStore, SupabaseOAuthStore skeleton, factory, env config | ✅ Done |
| 20B | SQL migration to Cuan Insight Supabase, real fetch-based REST API, connection key bridge | ⏳ Planned |
| 20C | Refresh token support, multi-replica readiness | ⏳ Planned |
