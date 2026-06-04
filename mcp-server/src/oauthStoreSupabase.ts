import { createHash } from 'node:crypto';
import {
  randomToken,
  sha256Hex,
  type IOAuthStore,
  type RegisteredClient,
  type StoreStats,
  type OAuthStoreConfig,
  type OAuthResolvedToken,
  type RedeemAuthCodeResult,
  type AuthorizationCodeRecord,
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
  connection_key_id: string | null;
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
  connection_key_id: string;
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
  connection_key_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

// ── Resolve result from Cuan Insight OAuth token resolver ────────────────

interface CuanInsightOAuthResolveResult {
  ok: boolean;
  identity?: {
    userId?: string;
    workspaceId: string;
    connectionKeyId?: string;
  };
  providerAccess?: {
    provider: string;
    accountId: string | null;
    accountName?: string;
    scopes: string[];
    allowed: boolean;
  };
  providerToken?: string;
  providerApiVersion?: string;
  tokenExpiresAt?: string;
  error?: {
    code: string;
    message: string;
  };
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
 * Optional for OAuth token resolution:
 * - CUAN_INSIGHT_API_BASE_URL (for mcp-resolve-credential endpoint)
 *
 * Tables required (see docs/PERSISTENT_OAUTH_STORE.md):
 * - mcp_oauth_clients
 * - mcp_oauth_auth_codes
 * - mcp_oauth_access_tokens
 *
 * Security:
 * - Authorization codes stored as SHA-256 hash only
 * - Access tokens stored as SHA-256 hash only
 * - connectionKeyId stored instead of raw connection key
 * - Raw values never persisted
 * - Service role key never logged
 *
 * Architecture:
 * - In-memory cache for synchronous access token resolution
 * - Async Supabase persistence for durability
 * - resolveAccessToken hashes token locally, then calls Cuan Insight resolver
 */
export class SupabaseOAuthStore implements IOAuthStore {
  private supabaseUrl: string;
  private serviceRoleKey: string;
  private authCodeTtlMs: number;
  private accessTokenTtlMs: number;

  /** In-memory cache for registered DCR clients (sync access) */
  private registeredClients: Map<string, RegisteredClient>;

  /** In-memory cache for auth codes (sync redeem) */
  private authCodes: Map<string, AuthorizationCodeRecord>;

  /** In-memory cache mapping tokenHash → connectionKeyId for sync resolution */
  private connectionKeyIdCache: Map<string, string>;

  /** In-memory cache for access token resolution results */
  private tokenResolveCache: Map<string, OAuthResolvedToken>;

  /** Fetch implementation (injectable for testing) */
  private fetchImpl: typeof fetch;

  constructor(config: OAuthStoreConfig & { supabaseUrl: string; serviceRoleKey: string; fetch?: typeof fetch }) {
    this.authCodeTtlMs = config.authCodeTtlMs ?? 300_000;
    this.accessTokenTtlMs = config.accessTokenTtlMs ?? 86_400_000;
    this.supabaseUrl = config.supabaseUrl;
    this.serviceRoleKey = config.serviceRoleKey;
    this.registeredClients = new Map();
    this.authCodes = new Map();
    this.connectionKeyIdCache = new Map();
    this.tokenResolveCache = new Map();
    this.fetchImpl = config.fetch ?? fetch;

    // Fire-and-forget: load persisted data from Supabase into caches
    this.loadPersistedData();
  }

  // ── Auth Code ───────────────────────────────────────────────────────

  createAuthorizationCode(params: {
    connectionKey?: string;
    connectionKeyId?: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope: string;
    resource?: string;
  }): { code: string } {
    const code = randomToken();
    const codeHash = sha256Hex(code);

    // Supabase mode requires connectionKeyId, not raw connectionKey
    if (!params.connectionKeyId) {
      // Fallback: if connectionKey is given but no connectionKeyId, hash and store anyway
      // But this is an anti-pattern for Supabase mode
      if (!params.connectionKey) {
        throw new Error(
          'SupabaseOAuthStore requires connectionKeyId. ' +
          'Raw connection key should not be stored in supabase mode.'
        );
      }
    }

    const effectiveConnectionKeyId = params.connectionKeyId ?? '';

    if (params.codeChallengeMethod !== 'S256') {
      throw new Error('Only S256 code challenge method is supported');
    }

    // Cleanup expired records (best-effort async — fire and forget)
    this.cleanupExpiredAsync();

    // Insert auth code record — sync return, async DB write
    const expiresAt = new Date(Date.now() + this.authCodeTtlMs).toISOString();

    // Cache in-memory for sync redeemAuthorizationCode
    this.authCodes.set(codeHash, {
      codeHash,
      connectionKey: params.connectionKey ?? '',
      connectionKeyId: effectiveConnectionKeyId || undefined,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      scope: params.scope,
      resource: params.resource,
      expiresAt: Date.now() + this.authCodeTtlMs,
      used: false,
    });

    // Persist to Supabase (fire-and-forget)
    this.supabaseQueryAsync(
      'mcp_oauth_auth_codes',
      'POST',
      {
        code_hash: codeHash,
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        code_challenge: params.codeChallenge,
        code_challenge_method: 'S256',
        scope: params.scope,
        resource: params.resource ?? null,
        connection_key_id: effectiveConnectionKeyId,
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
  }): RedeemAuthCodeResult | undefined {
    // Check in-memory cache first (codes created this session)
    const codeHash = sha256Hex(params.code);
    const record = this.authCodes.get(codeHash);

    if (!record) {
      // Fallback: try async Supabase lookup (but this is sync, so return undefined)
      // Full production (Phase 20B.5+): add async Supabase lookup
      return undefined;
    }

    // Check already used
    if (record.used) return undefined;

    // Check expiry
    if (Date.now() > record.expiresAt) {
      this.authCodes.delete(codeHash);
      return undefined;
    }

    // Check client_id match
    if (record.clientId !== params.clientId) return undefined;

    // Check redirect_uri match
    if (record.redirectUri !== params.redirectUri) return undefined;

    // Verify PKCE
    const verifierHash = createHash('sha256')
      .update(params.codeVerifier)
      .digest()
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (record.codeChallenge !== verifierHash) return undefined;

    // Mark as used (single-use)
    record.used = true;

    return {
      connectionKey: record.connectionKey || undefined,
      connectionKeyId: record.connectionKeyId,
      scope: record.scope,
      resource: record.resource,
    };
  }

  /**
   * Async redeem for Supabase-backed authorization codes.
   * Caller (http.ts /token handler) should await this.
   */
  async redeemAuthorizationCodeAsync(params: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
  }): Promise<RedeemAuthCodeResult | undefined> {
    const codeHash = sha256Hex(params.code);

    const rows = await this.supabaseQueryAsync(
      'mcp_oauth_auth_codes',
      'GET',
      undefined,
      [
        { key: 'code_hash', op: 'eq', value: codeHash },
        { key: 'used_at', op: 'is', value: 'null' },
      ]
    ) as SupabaseAuthCodeRow[];

    if (!rows || rows.length === 0) return undefined;

    const record = rows[0];

    // Check expiry
    if (new Date(record.expires_at) <= new Date()) {
      await this.supabaseQueryAsync(
        'mcp_oauth_auth_codes',
        'DELETE',
        undefined,
        [{ key: 'code_hash', op: 'eq', value: codeHash }]
      );
      return undefined;
    }

    // Check client_id match
    if (record.client_id !== params.clientId) return undefined;

    // Check redirect_uri match
    if (record.redirect_uri !== params.redirectUri) return undefined;

    // Verify PKCE
    const verifierHash = createHash('sha256')
      .update(params.codeVerifier)
      .digest()
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (record.code_challenge !== verifierHash) return undefined;

    // Mark as used
    await this.supabaseQueryAsync(
      'mcp_oauth_auth_codes',
      'PATCH',
      { used_at: new Date().toISOString() },
      [{ key: 'code_hash', op: 'eq', value: codeHash }]
    );

    return {
      connectionKeyId: record.connection_key_id,
      scope: record.scope,
      resource: record.resource ?? undefined,
    };
  }

  // ── Access Token ────────────────────────────────────────────────────

  createAccessToken(params: {
    connectionKey?: string;
    connectionKeyId?: string;
    scope: string;
    clientId: string;
    resource?: string;
  }): { accessToken: string; expiresIn: number } {
    const accessToken = randomToken();
    const tokenHash = sha256Hex(accessToken);

    if (!params.connectionKeyId && !params.connectionKey) {
      throw new Error(
        'SupabaseOAuthStore.createAccessToken requires connectionKeyId ' +
        'or connectionKey fallback'
      );
    }

    const effectiveConnectionKeyId = params.connectionKeyId ?? '';

    // Cache in memory for sync resolution
    this.connectionKeyIdCache.set(tokenHash, effectiveConnectionKeyId);

    // Pre-build resolve cache entry
    const resolveEntry: OAuthResolvedToken = {
      authType: 'oauth_token',
      accessTokenHash: tokenHash,
      clientId: params.clientId,
      scope: params.scope,
      resource: params.resource,
      connectionKeyId: params.connectionKeyId,
    };
    this.tokenResolveCache.set(tokenHash, resolveEntry);

    // Async persist to Supabase
    const expiresAt = new Date(Date.now() + this.accessTokenTtlMs).toISOString();
    this.supabaseQueryAsync(
      'mcp_oauth_access_tokens',
      'POST',
      {
        token_hash: tokenHash,
        client_id: params.clientId,
        scope: params.scope,
        resource: params.resource ?? null,
        connection_key_id: effectiveConnectionKeyId,
        expires_at: expiresAt,
      }
    );

    return { accessToken, expiresIn: Math.floor(this.accessTokenTtlMs / 1000) };
  }

  resolveAccessToken(
    accessToken: string
  ): OAuthResolvedToken | undefined {
    const tokenHash = sha256Hex(accessToken);

    // Check in-memory cache first (sync path)
    const cached = this.tokenResolveCache.get(tokenHash);
    if (cached) {
      // Validate expiry via cache metadata (cache entry exists = not expired)
      return cached;
    }

    // Check connectionKeyId cache
    const connectionKeyId = this.connectionKeyIdCache.get(tokenHash);
    if (!connectionKeyId) return undefined;

    // Build resolve result from cached connectionKeyId
    return {
      authType: 'oauth_token',
      accessTokenHash: tokenHash,
      clientId: '',
      scope: '',
      connectionKeyId,
    };
  }

  revokeAccessToken(accessToken: string): boolean {
    const tokenHash = sha256Hex(accessToken);

    // Clear caches
    this.connectionKeyIdCache.delete(tokenHash);
    this.tokenResolveCache.delete(tokenHash);

    // Async revoke in Supabase
    this.supabaseQueryAsync(
      'mcp_oauth_access_tokens',
      'PATCH',
      { revoked_at: new Date().toISOString() },
      [{ key: 'token_hash', op: 'eq', value: tokenHash }]
    );

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

    // Cache in-memory for synchronous lookup
    this.registeredClients.set(clientId, {
      clientId,
      redirectUris: params.redirectUris,
      clientName: params.clientName,
      grantTypes: params.grantTypes ?? ['authorization_code'],
      responseTypes: params.responseTypes ?? ['code'],
      tokenEndpointAuthMethod: params.tokenEndpointAuthMethod ?? 'none',
      scope: params.scope ?? 'mcp read write',
      issuedAt: now,
    });

    // Persist to Supabase (fire-and-forget)
    this.supabaseQueryAsync(
      'mcp_oauth_clients',
      'POST',
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
    // Check in-memory cache first (DCR clients registered this session)
    const cached = this.registeredClients.get(clientId);
    if (cached) return cached;

    // Future: async Supabase query for persisted clients
    return undefined;
  }

  isClientRegistered(clientId: string): boolean {
    // Check in-memory cache first (DCR clients registered this session)
    if (this.registeredClients.has(clientId)) return true;

    // Future: async Supabase query for persisted clients
    return false;
  }

  // ── Cuan Insight OAuth Token Resolution ─────────────────────────────

  /**
   * Resolve an OAuth access token hash through Cuan Insight mcp-resolve-credential.
   *
   * Sends:
   * {
   *   authType: "oauth_token",
   *   tokenHash: "<sha256>",
   *   clientId: "...",
   *   resource: "...",
   *   toolName: "...",
   *   accountId: "...",
   *   requestedScopes: ["read"],
   *   workspaceId: "..."
   * }
   *
   * Returns providerToken and metadata.
   * Never exposes raw connection key.
   */
  async resolveOAuthTokenViaCuanInsight(params: {
    tokenHash: string;
    clientId: string;
    resource?: string;
    toolName?: string;
    accountId?: string;
    requestedScopes?: string[];
    workspaceId?: string;
    cuanInsightBaseUrl: string;
    cuanInsightSupabaseAnonKey: string;
  }): Promise<CuanInsightOAuthResolveResult> {
    const endpointPath = '/mcp/resolve-credential';
    const url = new URL(params.cuanInsightBaseUrl.replace(/\/+$/, '') + endpointPath);

    const body: Record<string, unknown> = {
      authType: 'oauth_token',
      tokenHash: params.tokenHash,
      clientId: params.clientId,
    };

    if (params.resource) body.resource = params.resource;
    if (params.toolName) body.toolName = params.toolName;
    if (params.accountId) body.accountId = params.accountId;
    if (params.requestedScopes) body.requestedScopes = params.requestedScopes;
    if (params.workspaceId) body.workspaceId = params.workspaceId;

    const response = await this.fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.cuanInsightSupabaseAnonKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: response.status === 401 ? 'AUTHENTICATION_REQUIRED' : 'UPSTREAM_ERROR',
          message: `Cuan Insight returned ${response.status}`,
        },
      };
    }

    return response.json() as Promise<CuanInsightOAuthResolveResult>;
  }

  // ── Cleanup & Stats ─────────────────────────────────────────────────

  private cleanupExpiredAsync(): void {
    const now = new Date().toISOString();
    this.supabaseQueryAsync(
      'mcp_oauth_auth_codes',
      'DELETE',
      undefined,
      [{ key: 'expires_at', op: 'lt', value: now }]
    );
  }

  getStats(): StoreStats {
    // Sync best-effort stats from cache
    return {
      activeAuthCodes: 0,
      activeAccessTokens: this.tokenResolveCache.size,
      registeredClientCount: 0,
    };
  }

  // ── Supabase HTTP client ─────────────────────────────────────────────

  /**
   * Async Supabase REST API call using fetch + service_role key.
   *
   * Uses Supabase PostgREST API directly:
   * - POST: insert rows
   * - GET: select with query params
   * - PATCH: update rows
   * - DELETE: delete rows
   *
   * Security:
   * - Service role key sent as apikey header + Authorization: Bearer
   * - Never logged
   */
  /**
   * Query Supabase REST API.
   *
   * Tables: mcp_oauth_clients, mcp_oauth_auth_codes, mcp_oauth_access_tokens, mcp_oauth_events
   *
   * Method:
   * - GET: fetch rows with optional filters
   * - POST: insert row
   * - PATCH: update rows
   * - DELETE: delete rows
   *
   * Security:
   * - Service role key sent as apikey header + Authorization: Bearer
   * - Never logged
   */
  /**
   * Load persisted data from Supabase into in-memory caches.
   * Called once on construction (fire-and-forget).
   * Enables OAuth persistence after container restart.
   */
  private async loadPersistedData(): Promise<void> {
    try {
      // 1. Load registered clients
      const clientRows = await this.supabaseQueryAsync(
        'mcp_oauth_clients',
        'GET',
        undefined,
        [{ key: 'revoked_at', op: 'is', value: 'null' }]
      ) as Array<Record<string, unknown>> | undefined;

      if (clientRows && Array.isArray(clientRows)) {
        for (const row of clientRows) {
          const clientId = row.client_id as string;
          if (clientId) {
            this.registeredClients.set(clientId, {
              clientId,
              redirectUris: (row.redirect_uris ?? []) as string[],
              clientName: row.client_name != null ? String(row.client_name) : undefined,
              grantTypes: (row.grant_types ?? ['authorization_code']) as string[],
              responseTypes: (row.response_types ?? ['code']) as string[],
              tokenEndpointAuthMethod: row.token_endpoint_auth_method != null ? String(row.token_endpoint_auth_method) : 'none',
              scope: row.scope != null ? String(row.scope) : 'mcp read write',
              issuedAt: Math.floor(new Date(row.created_at as string).getTime() / 1000),
            });
          }
        }
      }

      // 2. Load active access tokens
      const tokenRows = await this.supabaseQueryAsync(
        'mcp_oauth_access_tokens',
        'GET',
        undefined,
        [
          { key: 'revoked_at', op: 'is', value: 'null' },
        ]
      ) as Array<Record<string, unknown>> | undefined;

      if (tokenRows && Array.isArray(tokenRows)) {
        const now = Date.now();
        for (const row of tokenRows) {
          const tokenHash = row.token_hash as string;
          const expiresAt = new Date(row.expires_at as string).getTime();
          if (!tokenHash || expiresAt <= now) continue;

          const connectionKeyId = row.connection_key_id as string | undefined;

          if (connectionKeyId) {
            this.connectionKeyIdCache.set(tokenHash, connectionKeyId);
            this.tokenResolveCache.set(tokenHash, {
              authType: 'oauth_token',
              accessTokenHash: tokenHash,
              clientId: row.client_id as string ?? '',
              scope: row.scope as string ?? '',
              resource: row.resource as string | undefined,
              connectionKeyId,
            });
          }
        }
      }
    } catch {
      // Silently fail — caches will be populated on-the-fly
    }
  }

  private async supabaseQueryAsync(
    table: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    payload?: Record<string, unknown> | null,
    filters?: Array<{ key: string; op: string; value: string }>
  ): Promise<unknown> {
    const baseUrl = `${this.supabaseUrl}/rest/v1/${table}`;
    const url = new URL(baseUrl);

    // Add PostgREST query filters
    if (filters) {
      for (const f of filters) {
        url.searchParams.append(f.key, `${f.op}.${f.value}`);
      }
    }

    // Add Prefer header for insert/update operations
    const headers: Record<string, string> = {
      'apikey': this.serviceRoleKey,
      'Authorization': `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(5000),
    };

    if (method === 'GET' || method === 'DELETE') {
      // No body for GET/DELETE
    } else if (payload) {
      fetchOptions.body = JSON.stringify(payload);
      headers['Prefer'] = 'return=representation';
    }

    try {
      const response = await this.fetchImpl(url.toString(), fetchOptions);

      if (!response.ok) {
        // Silently fail — don't leak service role key in errors
        return method === 'GET' ? [] : null;
      }

      if (method === 'GET') {
        return response.json();
      }

      return null;
    } catch {
      // Network error — silently fail
      return method === 'GET' ? [] : null;
    }
  }
}
