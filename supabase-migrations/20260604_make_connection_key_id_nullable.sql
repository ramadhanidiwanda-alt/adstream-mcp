-- Migration: Make connection_key_id nullable in OAuth tables
-- 
-- Problem: mcp_oauth_access_tokens and mcp_oauth_auth_codes have
-- connection_key_id UUID NOT NULL REFERENCES mcp_connection_keys(id).
-- When the Edge Function does not return connectionKeyId (PR #59 not deployed),
-- the MCP server passes '' (empty string) which is not a valid UUID,
-- causing silent FK constraint failures and 0 persisted rows.
--
-- After this migration:
-- - connection_key_id is nullable
-- - FK constraint uses ON DELETE SET NULL
-- - Tokens without a resolved connectionKeyId are still persisted
-- - loadPersistedData skips rows without connection_key_id

-- Step 1: Drop existing FK constraints
ALTER TABLE mcp_oauth_access_tokens
  DROP CONSTRAINT IF EXISTS mcp_oauth_access_tokens_connection_key_id_fkey;

ALTER TABLE mcp_oauth_auth_codes
  DROP CONSTRAINT IF EXISTS mcp_oauth_auth_codes_connection_key_id_fkey;

-- Step 2: Make columns nullable
ALTER TABLE mcp_oauth_access_tokens
  ALTER COLUMN connection_key_id DROP NOT NULL;

ALTER TABLE mcp_oauth_auth_codes
  ALTER COLUMN connection_key_id DROP NOT NULL;

-- Step 3: Re-add FK constraints with ON DELETE SET NULL
ALTER TABLE mcp_oauth_access_tokens
  ADD CONSTRAINT mcp_oauth_access_tokens_connection_key_id_fkey
  FOREIGN KEY (connection_key_id)
  REFERENCES mcp_connection_keys(id)
  ON DELETE SET NULL;

ALTER TABLE mcp_oauth_auth_codes
  ADD CONSTRAINT mcp_oauth_auth_codes_connection_key_id_fkey
  FOREIGN KEY (connection_key_id)
  REFERENCES mcp_connection_keys(id)
  ON DELETE SET NULL;
