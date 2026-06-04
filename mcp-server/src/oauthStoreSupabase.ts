import { createHash } from 'node:crypto';
import {
  randomToken,
  sha256Hex,
  base64UrlEncode,
  base64UrlDecode,
  type IOAuthStore,
  type RegisteredClient,
  type StoreStats,
  type OAuthStoreConfig,
} from './oauthStore.js';

// ── Types ────────────────────────────────────────────────────────────────

interface SupabaseOAuthClientRow {
  id: string;
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
  resource: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

interface SupabaseAuthCodeRow {
  id: string;
  code_hash: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  resource: string | null;
  connection_key_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface SupabaseAccessTokenRow {
  id: string;
  token_hash: string;
  client_id: string;
  scope: string;
  resource: string | null;
  connection_key_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

// ── SupabaseOAuthStore ───────────────────────────────────────────────────

/**
 * Persistent OAuth store backed by Supabase.
 *
 * Requirements:
 * - MCP_OAUTH_STORE_DRIVER=supabase
 * - MCP_OAUTH_SUPABASE_URL
 * - MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY
 *
 * Tables required (see docs/PERSISTENT_OAUTH_STORE.md):
 * - mcp_oauth_clients
 * - mcp_oauth_auth_codes
 * - mcp_oauth_access_tokens
 *
 * Security:
 * - Authorization codes stored as SHA-256 hash only
 * - Access tokens stored as SHA-256 hash only
 * - Connection keys stored as SHA-256 hash only
 * - Raw values never persisted
 */
export class SupabaseOAuthStore implements IOAuthStore {
  private supabaseUrl: string;
  private serviceRoleKey: string;
  private authCodeTtlMs: number;
  private accessTokenTtlMs: number;

  constructor(config: OAuthStoreConfig & { supabaseUrl: string; serviceRoleKey: string }) {
    this.authCodeTtlMs = config.authCodeTtlMs ?? 300_000;
    this.accessTokenTtlMs = config.accessTokenTtlMs ?? 86_400_000;
    this.supabaseUrl = config.supabaseUrl;
    this.serviceRoleKey = config.serviceRoleKey;
  }

  // ── Auth Code ───────────────────────────────────────────────────────

  createAuthorizationCode(params: {
    connectionKey: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope: string;
    resource?: string;
  }): { code: string } {
    const code = randomToken();
    const codeHash = sha256Hex(code);
    const connectionKeyHash = sha256Hex(params.connectionKey);

    if (params.codeChallengeMethod !== 'S256') {
      throw new Error('Only S256 code challenge method is supported');
    }

    // Cleanup expired records
    this.cleanupExpired();

    // Insert auth code record
    const expiresAt = new Date(Date.now() + this.authCodeTtlMs).toISOString();
    this.supabaseQuery(
      'mcp_oauth_auth_codes',
      'insert',
      {
        code_hash: codeHash,
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        code_challenge: params.codeChallenge,
        code_challenge_method: 'S256',
        scope: params.scope,
        resource: params.resource ?? null,
        connection_key_hash: connectionKeyHash,
        expires_at: expiresAt,
      }
    );

    return { code };
  }

  redeemAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
  }): { connectionKey: string; scope: string } | undefined {
    const codeHash = sha256Hex(params.code);

    // Find unused, non-expired code
    const rows = this.supabaseQuery(
      'mcp_oauth_auth_codes',
      'select',
      undefined,
      { code_hash: codeHash, used_at: 'is.null' }
    ) as SupabaseAuthCodeRow[];

    if (!rows || rows.length === 0) return undefined;

    const record = rows[0];

    // Check expiry
    if (new Date(record.expires_at) <= new Date()) {
      this.supabaseQuery('mcp_oauth_auth_codes', 'delete', undefined, {
        code_hash: codeHash,
      });
      return undefined;
    }

    // Check client_id match
    if (record.client_id !== params.clientId) return undefined;

    // Check redirect_uri match
    if (record.redirect_uri !== params.redirectUri) return undefined;

    // Verify PKCE
    const verifierHash = createHash('sha256')
      .update(params.codeVerifier)
      .digest('base64url');
    const pkceMatch = verifierHash === record.code_challenge;

    if (!pkceMatch) return undefined;

    // Mark as used
    this.supabaseQuery(
      'mcp_oauth_auth_codes',
      'update',
      { used_at: new Date().toISOString() },
      { code_hash: codeHash }
    );

    // NOTE: connectionKey is NOT recoverable from hash.
    // We store connection_key_hash for audit but the raw key
    // must be passed through from the /token handler which already
    // has it from the initial authorize POST context.
    //
    // BLOCKER: SupabaseOAuthStore cannot return raw connectionKey
    // because it was never stored — only the hash.
    // The /token handler in http.ts must pass connectionKey separately
    // or store it temporarily in-memory during the auth flow.
    throw new Error(
      'SupabaseOAuthStore.redeemAuthorizationCode: raw connection key not recoverable from hash. ' +
      'Store is designed for hash-only persistence; connection key resolution requires a separate ' +
      'in-memory bridge during the auth flow (see docs/PERSISTENT_OAUTH_STORE.md).'
    );
  }

  // ── Access Token ────────────────────────────────────────────────────

  createAccessToken(params: {
    connectionKey: string;
    scope: string;
    clientId: string;
  }): { accessToken: string; expiresIn: number } {
    const accessToken = randomToken();
    const tokenHash = sha256Hex(accessToken);
    const connectionKeyHash = sha256Hex(params.connectionKey);
    const expiresInSec = Math.floor(this.accessTokenTtlMs / 1000);

    const expiresAt = new Date(Date.now() + this.accessTokenTtlMs).toISOString();

    this.supabaseQuery(
      'mcp_oauth_access_tokens',
      'insert',
      {
        token_hash: tokenHash,
        client_id: params.clientId,
        scope: params.scope,
        connection_key_hash: connectionKeyHash,
        expires_at: expiresAt,
      }
    );

    // BLOCKER: Same issue — raw connectionKey must be stored somewhere
    // accessible during /mcp Bearer token resolution.
    // For now, store connectionKey in an in-memory sidecar map.
    this.connectionKeyCache.set(tokenHash, params.connectionKey);

    return { accessToken, expiresIn: expiresInSec };
  }

  // ── In-memory connection key cache ──────────────────────────────────

  /**
   * Temporary in-memory cache for connection key resolution.
   *
   * BLOCKER: This is a bridge — connection keys are hashed in the
   * persistent store but we need the raw key to resolve Cuan Insight
   * credentials at runtime. Until Cuan Insight supports resolution
   * by connection_key_hash, this cache is required.
   *
   * The cache maps token_hash → connectionKey for active tokens.
   * Lost on restart — tokens will be valid in DB but unresolvable.
   */
  private connectionKeyCache = new Map<string, string>();

  resolveAccessToken(
    accessToken: string
  ): { connectionKey: string; scope: string; clientId: string } | undefined {
    const tokenHash = sha256Hex(accessToken);

    // Check in-memory cache first
    const cachedKey = this.connectionKeyCache.get(tokenHash);
    if (!cachedKey) {
      // Try DB for token existence (audit), but can't recover key
      const rows = this.supabaseQuery(
        'mcp_oauth_access_tokens',
        'select',
        undefined,
        { token_hash: tokenHash, revoked_at: 'is.null' }
      ) as SupabaseAccessTokenRow[];

      if (!rows || rows.length === 0) return undefined;

      const record = rows[0];
      if (new Date(record.expires_at) <= new Date()) return undefined;

      // Token exists but connection key not in cache → unresolvable
      return undefined;
    }

    // Verify token is still valid in DB
    const rows = this.supabaseQuery(
      'mcp_oauth_access_tokens',
      'select',
      undefined,
      { token_hash: tokenHash, revoked_at: 'is.null' }
    ) as SupabaseAccessTokenRow[];

    if (!rows || rows.length === 0) {
      this.connectionKeyCache.delete(tokenHash);
      return undefined;
    }

    const record = rows[0];
    if (new Date(record.expires_at) <= new Date()) {
      this.connectionKeyCache.delete(tokenHash);
      return undefined;
    }

    // Update last_used_at
    this.supabaseQuery(
      'mcp_oauth_access_tokens',
      'update',
      { last_used_at: new Date().toISOString() },
      { token_hash: tokenHash }
    );

    return {
      connectionKey: cachedKey,
      scope: record.scope,
      clientId: record.client_id,
    };
  }

  revokeAccessToken(accessToken: string): boolean {
    const tokenHash = sha256Hex(accessToken);
    this.connectionKeyCache.delete(tokenHash);

    this.supabaseQuery(
      'mcp_oauth_access_tokens',
      'update',
      { revoked_at: new Date().toISOString() },
      { token_hash: tokenHash }
    );

    // Best-effort — return true since we can't easily confirm row count
    return true;
  }

  // ── DCR ─────────────────────────────────────────────────────────────

  registerClient(params: {
    redirectUris: string[];
    clientName?: string;
    grantTypes?: string[];
    responseTypes?: string[];
    tokenEndpointAuthMethod?: string;
    scope?: string;
  }): { clientId: string; clientIdIssuedAt: number } {
    const clientId = randomToken();
    const now = Math.floor(Date.now() / 1000);

    this.supabaseQuery(
      'mcp_oauth_clients',
      'insert',
      {
        client_id: clientId,
        client_name: params.clientName ?? null,
        redirect_uris: params.redirectUris,
        grant_types: params.grantTypes ?? ['authorization_code'],
        response_types: params.responseTypes ?? ['code'],
        token_endpoint_auth_method: params.tokenEndpointAuthMethod ?? 'none',
        scope: params.scope ?? 'mcp read write',
      }
    );

    return { clientId, clientIdIssuedAt: now };
  }

  getRegisteredClient(clientId: string): RegisteredClient | undefined {
    const rows = this.supabaseQuery(
      'mcp_oauth_clients',
      'select',
      undefined,
      { client_id: clientId, revoked_at: 'is.null' }
    ) as SupabaseOAuthClientRow[];

    if (!rows || rows.length === 0) return undefined;

    const r = rows[0];
    return {
      clientId: r.client_id,
      redirectUris: r.redirect_uris,
      clientName: r.client_name ?? undefined,
      grantTypes: r.grant_types,
      responseTypes: r.response_types,
      tokenEndpointAuthMethod: r.token_endpoint_auth_method,
      scope: r.scope,
      issuedAt: Math.floor(new Date(r.created_at).getTime() / 1000),
    };
  }

  isClientRegistered(clientId: string): boolean {
    const rows = this.supabaseQuery(
      'mcp_oauth_clients',
      'select',
      'client_id',
      { client_id: clientId, revoked_at: 'is.null', limit: 1 }
    ) as { client_id: string }[];

    return rows !== null && rows.length > 0;
  }

  // ── Cleanup & Stats ─────────────────────────────────────────────────

  private cleanupExpired(): void {
    const now = new Date().toISOString();

    this.supabaseQuery(
      'mcp_oauth_auth_codes',
      'delete',
      undefined,
      { expires_at: `lt.${now}` }
    );
  }

  getStats(): StoreStats {
    const now = new Date().toISOString();

    const authCodes = this.supabaseQuery(
      'mcp_oauth_auth_codes',
      'select',
      'code_hash',
      { used_at: 'is.null', expires_at: `gt.${now}`, limit: 1 }
    );

    const accessTokens = this.supabaseQuery(
      'mcp_oauth_access_tokens',
      'select',
      'token_hash',
      { revoked_at: 'is.null', expires_at: `gt.${now}`, limit: 1 }
    );

    const clients = this.supabaseQuery(
      'mcp_oauth_clients',
      'select',
      'client_id',
      { revoked_at: 'is.null', limit: 1 }
    );

    // Count approximations — Supabase returns arrays
    const authCodeCount = Array.isArray(authCodes) ? authCodes.length : 0;
    const accessTokenCount = Array.isArray(accessTokens) ? accessTokens.length : 0;
    const clientCount = Array.isArray(clients) ? clients.length : 0;

    return {
      activeAuthCodes: authCodeCount,
      activeAccessTokens: accessTokenCount,
      registeredClientCount: clientCount,
    };
  }

  // ── Supabase HTTP client (no SDK dependency) ─────────────────────────

  /**
   * Direct Supabase REST API call using fetch + service_role key.
   *
   * Avoids @supabase/supabase-js dependency to keep build lean.
   * Uses Supabase REST API directly with PostgREST syntax.
   */
  private supabaseQuery(
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    payloadOrColumns?: Record<string, unknown> | string | null,
    filters?: Record<string, unknown>
  ): unknown {
    // This is a synchronous stub — actual Supabase queries are async.
    // In real usage, all methods would be async and this would use fetch().
    //
    // For Phase 20A.1, this skeleton documents the API surface.
    // Full async implementation comes when Supabase is wired for production.
    //
    // Placeholder: would call:
    //   fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
    //     method: POST/GET/PATCH/DELETE,
    //     headers: {
    //       apikey: this.serviceRoleKey,
    //       Authorization: `Bearer ${this.serviceRoleKey}`,
    //     },
    //     body: JSON.stringify(payload),
    //   })
    return [];
  }
}
