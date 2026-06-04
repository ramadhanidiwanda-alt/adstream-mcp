import { randomBytes, createHash } from 'node:crypto';
import { SupabaseOAuthStore } from './oauthStoreSupabase.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface AuthorizationCodeRecord {
  /** SHA-256 hash of the auth code (never store raw code) */
  codeHash: string;
  /** Connection key (only for memory mode — never logged). Supabase mode stores connectionKeyId instead. */
  connectionKey: string;
  /** Cuan Insight connection key ID (only for supabase mode — never stores raw key) */
  connectionKeyId?: string;
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
  /** Connection key (only for memory mode). Supabase mode stores connectionKeyId instead. */
  connectionKey: string;
  /** Cuan Insight connection key ID (only for supabase mode). Used to resolve via mcp-resolve-credential. */
  connectionKeyId?: string;
  scope: string;
  expiresAt: number; // Unix timestamp ms
  clientId: string;
  /** Resource from OAuth authorization */
  resource?: string;
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

// ── OAuth Resolved Token types ────────────────────────────────────────────

/** Connection key auth — returned by MemoryOAuthStore. */
export interface OAuthConnectionKeyResult {
  authType: 'connection_key';
  connectionKey: string;
  scope: string;
  clientId: string;
}

/** OAuth token auth — returned by SupabaseOAuthStore. */
export interface OAuthOAuthTokenResult {
  authType: 'oauth_token';
  accessTokenHash: string;
  clientId: string;
  scope: string;
  resource?: string;
  connectionKeyId?: string;
}

/** Union type for resolveAccessToken return. */
export type OAuthResolvedToken = OAuthConnectionKeyResult | OAuthOAuthTokenResult;

/** Params for createAuthorizationCode — accepts either connectionKey or connectionKeyId. */
export interface CreateAuthCodeParams {
  /** Raw connection key (memory mode) */
  connectionKey?: string;
  /** Cuan Insight connection key ID (supabase mode) */
  connectionKeyId?: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  resource?: string;
}

/** Params for createAccessToken — accepts either connectionKey or connectionKeyId. */
export interface CreateAccessTokenParams {
  /** Raw connection key (memory mode) */
  connectionKey?: string;
  /** Cuan Insight connection key ID (supabase mode) */
  connectionKeyId?: string;
  scope: string;
  clientId: string;
  resource?: string;
}

/** Redeem result — returns connectionKey for memory, connectionKeyId for supabase. */
export interface RedeemAuthCodeResult {
  connectionKey?: string;
  connectionKeyId?: string;
  scope: string;
  resource?: string;
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
  createAuthorizationCode(params: CreateAuthCodeParams): { code: string };

  /** Redeem authorization code with PKCE verification. */
  redeemAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
  }): RedeemAuthCodeResult | undefined;

  // ── Access Token ───────────────────────────────────────────────────────

  /** Create access token. Returns raw token only once. */
  createAccessToken(params: CreateAccessTokenParams): { accessToken: string; expiresIn: number };

  /** Resolve access token to connection context. */
  resolveAccessToken(
    accessToken: string
  ): OAuthResolvedToken | undefined;

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
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString();
}

// ── MemoryOAuthStore ─────────────────────────────────────────────────────

/**
 * In-memory OAuth store implementation.
 *
 * Default store for development and single-tenant deployments.
 * All data lost on restart.
 *
 * Supports both connection_key and connectionKeyId modes:
 * - connection_key: legacy mode — stores raw connection key reference
 * - connectionKeyId: supabase-compatible mode — stores Cuan Insight key ID only
 *
 * Security:
 * - Authorization codes stored as SHA-256 hash only
 * - Access tokens stored as SHA-256 hash only
 * - PKCE enforced on all code redemptions (S256 required)
 */
export class MemoryOAuthStore implements IOAuthStore {
  private authCodes: Map<string, AuthorizationCodeRecord>;
  private accessTokens: Map<string, AccessTokenRecord>;
  private registeredClients: Map<string, RegisteredClient>;
  private authCodeTtlMs: number;
  private accessTokenTtlMs: number;

  constructor(config?: OAuthStoreConfig) {
    this.authCodes = new Map();
    this.accessTokens = new Map();
    this.registeredClients = new Map();
    this.authCodeTtlMs = config?.authCodeTtlMs ?? 300_000; // 5 min default
    this.accessTokenTtlMs = config?.accessTokenTtlMs ?? 86_400_000; // 24h default
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
    const connectionKey = params.connectionKey ?? '';

    if (params.codeChallengeMethod !== 'S256') {
      throw new Error('Only S256 code challenge method is supported');
    }

    this.cleanupExpired();

    const record: AuthorizationCodeRecord = {
      codeHash,
      connectionKey,
      connectionKeyId: params.connectionKeyId,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      scope: params.scope,
      resource: params.resource,
      expiresAt: Date.now() + this.authCodeTtlMs,
      used: false,
    };

    this.authCodes.set(codeHash, record);
    return { code };
  }

  redeemAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
  }): RedeemAuthCodeResult | undefined {
    const codeHash = sha256Hex(params.code);
    const record = this.authCodes.get(codeHash);

    if (!record) return undefined;

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
    const verifierHash = base64UrlEncode(
      createHash('sha256').update(params.codeVerifier).digest()
    );

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

    this.cleanupExpired();

    const record: AccessTokenRecord = {
      tokenHash,
      connectionKey: params.connectionKey ?? '',
      connectionKeyId: params.connectionKeyId,
      scope: params.scope,
      expiresAt: Date.now() + this.accessTokenTtlMs,
      clientId: params.clientId,
      resource: params.resource,
    };

    this.accessTokens.set(tokenHash, record);

    return { accessToken, expiresIn: Math.floor(this.accessTokenTtlMs / 1000) };
  }

  resolveAccessToken(
    accessToken: string
  ): OAuthResolvedToken | undefined {
    const tokenHash = sha256Hex(accessToken);
    const record = this.accessTokens.get(tokenHash);

    if (!record) return undefined;

    // Check expiry
    const now = Date.now();
    if (now > record.expiresAt) {
      this.accessTokens.delete(tokenHash);
      return undefined;
    }

    // Return appropriate auth type
    if (record.connectionKeyId) {
      return {
        authType: 'oauth_token',
        accessTokenHash: record.tokenHash,
        clientId: record.clientId,
        scope: record.scope,
        resource: record.resource,
        connectionKeyId: record.connectionKeyId,
      };
    }
    if (record.connectionKey) {
      return {
        authType: 'connection_key',
        connectionKey: record.connectionKey,
        scope: record.scope,
        clientId: record.clientId,
      };
    }
    return undefined;
  }

  revokeAccessToken(accessToken: string): boolean {
    const tokenHash = sha256Hex(accessToken);
    const record = this.accessTokens.get(tokenHash);
    if (!record) return false;

    this.accessTokens.delete(tokenHash);
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

      return new SupabaseOAuthStore({ ...config, supabaseUrl, serviceRoleKey });
    }

    default:
      throw new Error(
        `Invalid MCP_OAUTH_STORE_DRIVER: ${driver}. Valid values: memory, supabase`
      );
  }
}
