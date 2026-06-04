import { randomBytes, createHash } from 'node:crypto';

// ── Types ────────────────────────────────────────────────────────────────

export interface AuthorizationCodeRecord {
  /** SHA-256 hash of the auth code (never store raw code) */
  codeHash: string;
  /** Connection key (stored only for resolution — never logged) */
  connectionKey: string;
  clientId: string;
  redirectUri: string;
  /** Raw code_challenge for PKCE verification */
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  scope: string;
  /** Optional resource parameter from MCP spec */
  resource?: string;
  expiresAt: number; // Unix timestamp ms
  used: boolean;
}

export interface AccessTokenRecord {
  /** SHA-256 hash of the access token */
  tokenHash: string;
  /** Connection key associated with this token */
  connectionKey: string;
  scope: string;
  expiresAt: number; // Unix timestamp ms
  clientId: string;
}

export interface RegisteredClient {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  scope: string;
  issuedAt: number;
}

export interface OAuthStoreConfig {
  /** TTL for authorization codes in ms (default: 5 min) */
  authCodeTtlMs?: number;
  /** TTL for access tokens in ms (default: 24 hours) */
  accessTokenTtlMs?: number;
}

export interface StoreStats {
  activeAuthCodes: number;
  activeAccessTokens: number;
  registeredClientCount: number;
}

// ── IOAuthStore interface ─────────────────────────────────────────────────

/**
 * OAuth store interface.
 *
 * Implementations:
 * - MemoryOAuthStore (default, in-memory, dev/local)
 * - SupabaseOAuthStore (persistent, production-ready)
 */
export interface IOAuthStore {
  // ── Auth Code ──────────────────────────────────────────────────────────

  /** Create authorization code. Returns raw code only once. */
  createAuthorizationCode(params: {
    connectionKey: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope: string;
    resource?: string;
  }): { code: string };

  /** Redeem authorization code with PKCE verification. */
  redeemAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
  }): { connectionKey: string; scope: string } | undefined;

  // ── Access Token ───────────────────────────────────────────────────────

  /** Create access token. Returns raw token only once. */
  createAccessToken(params: {
    connectionKey: string;
    scope: string;
    clientId: string;
  }): { accessToken: string; expiresIn: number };

  /** Resolve access token to connection context. */
  resolveAccessToken(
    accessToken: string
  ): { connectionKey: string; scope: string; clientId: string } | undefined;

  /** Revoke an access token. */
  revokeAccessToken(accessToken: string): boolean;

  // ── DCR ────────────────────────────────────────────────────────────────

  /** Register a new OAuth client (DCR RFC 7591). */
  registerClient(params: {
    redirectUris: string[];
    clientName?: string;
    grantTypes?: string[];
    responseTypes?: string[];
    tokenEndpointAuthMethod?: string;
    scope?: string;
  }): { clientId: string; clientIdIssuedAt: number };

  /** Get a registered client by client_id. */
  getRegisteredClient(clientId: string): RegisteredClient | undefined;

  /** Check if client_id is registered. */
  isClientRegistered(clientId: string): boolean;

  // ── Admin ──────────────────────────────────────────────────────────────

  /** Get store stats (safe for logging). */
  getStats(): StoreStats;
}

// ── Secure helpers ───────────────────────────────────────────────────────

export function randomToken(): string {
  return randomBytes(32).toString('hex');
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function base64UrlDecode(input: string): string {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

// ── MemoryOAuthStore ─────────────────────────────────────────────────────

/**
 * In-memory OAuth store for local development and single-replica deployments.
 *
 * Limitations:
 * - Data is lost on server restart
 * - Not suitable for multi-replica deployments
 * - No persistent backing store
 *
 * For production multi-replica deployments, use SupabaseOAuthStore.
 */
export class MemoryOAuthStore implements IOAuthStore {
  private authCodes = new Map<string, AuthorizationCodeRecord>();
  private accessTokens = new Map<string, AccessTokenRecord>();
  private registeredClients = new Map<string, RegisteredClient>();
  private authCodeTtlMs: number;
  private accessTokenTtlMs: number;

  constructor(config: OAuthStoreConfig = {}) {
    this.authCodeTtlMs = config.authCodeTtlMs ?? 300_000; // 5 min
    this.accessTokenTtlMs = config.accessTokenTtlMs ?? 86_400_000; // 24h
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

    if (params.codeChallengeMethod !== 'S256') {
      throw new Error('Only S256 code challenge method is supported');
    }

    this.authCodes.set(codeHash, {
      codeHash,
      connectionKey: params.connectionKey,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      scope: params.scope,
      resource: params.resource,
      expiresAt: Date.now() + this.authCodeTtlMs,
      used: false,
    });

    this.cleanupExpired();

    return { code };
  }

  redeemAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
  }): { connectionKey: string; scope: string } | undefined {
    const codeHash = sha256Hex(params.code);
    const record = this.authCodes.get(codeHash);

    if (!record) return undefined;

    // Check expiry
    if (Date.now() > record.expiresAt) {
      this.authCodes.delete(codeHash);
      return undefined;
    }

    // Check already used
    if (record.used) {
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
      .digest('base64url');
    const pkceMatch = verifierHash === record.codeChallenge;

    if (process.env.MCP_OAUTH_DEBUG === 'true') {
      console.error('[OAUTH_DEBUG] token.post.pkce_match', JSON.stringify({
        match: pkceMatch,
        challenge_len: record.codeChallenge.length,
        verifier_hash_len: verifierHash.length,
      }));
    }

    if (!pkceMatch) return undefined;

    // Mark as used
    record.used = true;

    return {
      connectionKey: record.connectionKey,
      scope: record.scope,
    };
  }

  // ── Access Token ────────────────────────────────────────────────────

  createAccessToken(params: {
    connectionKey: string;
    scope: string;
    clientId: string;
  }): { accessToken: string; expiresIn: number } {
    const accessToken = randomToken();
    const tokenHash = sha256Hex(accessToken);
    const expiresInSec = Math.floor(this.accessTokenTtlMs / 1000);

    this.accessTokens.set(tokenHash, {
      tokenHash,
      connectionKey: params.connectionKey,
      scope: params.scope,
      expiresAt: Date.now() + this.accessTokenTtlMs,
      clientId: params.clientId,
    });

    this.cleanupExpired();

    return { accessToken, expiresIn: expiresInSec };
  }

  resolveAccessToken(
    accessToken: string
  ): { connectionKey: string; scope: string; clientId: string } | undefined {
    const tokenHash = sha256Hex(accessToken);
    const record = this.accessTokens.get(tokenHash);

    if (!record) return undefined;

    // Check expiry
    if (Date.now() > record.expiresAt) {
      this.accessTokens.delete(tokenHash);
      return undefined;
    }

    return {
      connectionKey: record.connectionKey,
      scope: record.scope,
      clientId: record.clientId,
    };
  }

  revokeAccessToken(accessToken: string): boolean {
    const tokenHash = sha256Hex(accessToken);
    return this.accessTokens.delete(tokenHash);
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

    return { clientId, clientIdIssuedAt: now };
  }

  getRegisteredClient(clientId: string): RegisteredClient | undefined {
    return this.registeredClients.get(clientId);
  }

  isClientRegistered(clientId: string): boolean {
    return this.registeredClients.has(clientId);
  }

  // ── Cleanup & Stats ─────────────────────────────────────────────────

  private cleanupExpired(): void {
    const now = Date.now();

    for (const [hash, record] of this.authCodes) {
      if (now > record.expiresAt) {
        this.authCodes.delete(hash);
      }
    }

    for (const [hash, record] of this.accessTokens) {
      if (now > record.expiresAt) {
        this.accessTokens.delete(hash);
      }
    }
  }

  getStats(): StoreStats {
    this.cleanupExpired();
    return {
      activeAuthCodes: this.authCodes.size,
      activeAccessTokens: this.accessTokens.size,
      registeredClientCount: this.registeredClients.size,
    };
  }
}

// ── Backward compatibility alias ─────────────────────────────────────────

/** @deprecated Use MemoryOAuthStore directly. Kept for backward compatibility. */
export { MemoryOAuthStore as OAuthStore };

// ── Factory ──────────────────────────────────────────────────────────────


// ── Factory ──────────────────────────────────────────────────────────────

export type OAuthStoreDriver = 'memory' | 'supabase';

export interface CreateOAuthStoreOptions extends OAuthStoreConfig {
  driver?: OAuthStoreDriver;
  supabaseUrl?: string;
  serviceRoleKey?: string;
}

/**
 * Create an OAuth store based on MCP_OAUTH_STORE_DRIVER env var or explicit driver.
 *
 * Drivers:
 * - memory (default): In-memory store, lost on restart. Dev/local only.
 * - supabase: Persistent store backed by Supabase. Requires MCP_OAUTH_SUPABASE_URL
 *   and MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY.
 *
 * Env vars:
 * - MCP_OAUTH_STORE_DRIVER=memory|supabase (default: memory)
 * - MCP_OAUTH_SUPABASE_URL (required when driver=supabase)
 * - MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY (required when driver=supabase)
 */
export function createOAuthStore(config?: OAuthStoreConfig): MemoryOAuthStore {
  return new MemoryOAuthStore(config);
}

/**
 * Create OAuth store from environment configuration.
 *
 * Reads MCP_OAUTH_STORE_DRIVER to determine which implementation to use.
 * Returns MemoryOAuthStore by default for backward compatibility.
 */
export function createOAuthStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env
): IOAuthStore {
  const driver = (env.MCP_OAUTH_STORE_DRIVER ?? 'memory') as OAuthStoreDriver;

  const config: OAuthStoreConfig = {
    authCodeTtlMs: (Number(env.MCP_OAUTH_AUTH_CODE_TTL_SECONDS) || 300) * 1000,
    accessTokenTtlMs: (Number(env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS) || 86400) * 1000,
  };

  switch (driver) {
    case 'memory':
      return new MemoryOAuthStore(config);

    case 'supabase': {
      const supabaseUrl = env.MCP_OAUTH_SUPABASE_URL;
      const serviceRoleKey = env.MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
          'MCP_OAUTH_SUPABASE_URL and MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY ' +
          'are required when MCP_OAUTH_STORE_DRIVER=supabase'
        );
      }

      // Dynamic import to avoid requiring @supabase/supabase-js at build time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SupabaseOAuthStore } = require('./oauthStoreSupabase.js');
      return new SupabaseOAuthStore({ ...config, supabaseUrl, serviceRoleKey });
    }

    default:
      throw new Error(
        `Invalid MCP_OAUTH_STORE_DRIVER: ${driver}. Valid values: memory, supabase`
      );
  }
}
