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

// ── Secure helpers ───────────────────────────────────────────────────────

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

// ── Store ────────────────────────────────────────────────────────────────

/**
 * In-memory OAuth store for MVP.
 *
 * Limitations:
 * - Data is lost on server restart
 * - Not suitable for multi-replica deployments
 * - No persistent backing store (Redis/DB planned)
 */
export class OAuthStore {
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

  /**
   * Create a new authorization code.
   * Returns the raw code (only returned once at creation).
   */
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

    // Cleanup old records periodically
    this.cleanupExpired();

    return { code };
  }

  /**
   * Redeem an authorization code and return the stored data if valid.
   * Returns undefined if code is invalid, expired, or already used.
   */
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
    if (record.used) return undefined;

    // Validate client_id
    if (record.clientId !== params.clientId) return undefined;

    // Validate redirect_uri
    if (record.redirectUri !== params.redirectUri) return undefined;

    // Validate PKCE: base64url(sha256(code_verifier)) === code_challenge
    const verifierHash = base64UrlEncode(
      createHash('sha256').update(params.codeVerifier).digest('base64url')
    );
    if (verifierHash !== record.codeChallenge) return undefined;

    // Mark as used
    record.used = true;

    return {
      connectionKey: record.connectionKey,
      scope: record.scope,
    };
  }

  // ── Access Token ────────────────────────────────────────────────────

  /**
   * Create a new access token.
   * Returns the raw token (only returned once at creation).
   */
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

  /**
   * Resolve an access token to connection context.
   * Returns undefined if token is invalid or expired.
   */
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

  /**
   * Revoke an access token.
   */
  revokeAccessToken(accessToken: string): boolean {
    const tokenHash = sha256Hex(accessToken);
    return this.accessTokens.delete(tokenHash);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

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

  /**
   * Get store stats (safe for logging — no secrets).
   */
  // ── Dynamic Client Registration ──────────────────────────────────────

  /**
   * Register a new OAuth client via Dynamic Client Registration (RFC 7591).
   * Returns the generated client_id (no client_secret for public PKCE clients).
   */
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

  /**
   * Get a registered client by client_id.
   */
  getRegisteredClient(clientId: string): RegisteredClient | undefined {
    return this.registeredClients.get(clientId);
  }

  /**
   * Check if a client_id is registered via DCR.
   */
  isClientRegistered(clientId: string): boolean {
    return this.registeredClients.has(clientId);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  getStats(): { activeAuthCodes: number; activeAccessTokens: number } {
    this.cleanupExpired();
    return {
      activeAuthCodes: this.authCodes.size,
      activeAccessTokens: this.accessTokens.size,
      registeredClientCount: this.registeredClients.size,
    };
  }
}

export function createOAuthStore(config?: OAuthStoreConfig): OAuthStore {
  return new OAuthStore(config);
}