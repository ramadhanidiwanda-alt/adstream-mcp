#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMetaAdsMcpServer } from './createServer.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { OAuthStore, type IOAuthStore, type OAuthResolvedToken, createOAuthStoreFromEnv } from './oauthStore.js';
import { renderAuthorizeForm } from './authorizeForm.js';

const HTTP_TRANSPORT_UNAVAILABLE_MESSAGE =
  'Streamable HTTP transport requires MCP_TRANSPORT=streamable-http.';

export type TransportType = 'http' | 'sse' | 'streamable-http';

export interface HttpMcpConfig {
  enabled: boolean;
  host: string;
  port: number;
  path: string;
  transport: TransportType;
  bearerToken?: string;
  /** Public base URL for OAuth metadata (e.g. https://mcp.cuaninsight.com) */
  publicBaseUrl?: string;
  /** OAuth auth code TTL in seconds */
  authCodeTtlSeconds: number;
  /** OAuth access token TTL in seconds */
  accessTokenTtlSeconds: number;
  /** Allowed OAuth client IDs (comma-separated from env). Empty = all clients allowed. */
  allowedClientIds?: string[];
}

export interface StartedHttpMcpServer {
  server: ReturnType<typeof createServer>;
  url: string;
  config: HttpMcpConfig;
}

/**
 * Active SSE transport sessions, keyed by session ID.
 */
const activeSseSessions = new Map<string, SSEServerTransport>();

/**
 * Active Streamable HTTP sessions, keyed by session ID.
 */
const activeStreamableSessions = new Map<string, StreamableHTTPServerTransport>();

// ── Safe debug logging ──────────────────────────────────────────────────
const OAUTH_DEBUG = (env?: NodeJS.ProcessEnv): boolean =>
  (env ?? process.env).MCP_OAUTH_DEBUG === 'true';

function oauthDebug(stage: string, data: Record<string, unknown>, env?: NodeJS.ProcessEnv): void {
  if (OAUTH_DEBUG(env)) {
    // Redact all potentially sensitive keys
    const safe: Record<string, unknown> = {};
    const blocked = new Set([
      'connection_key', 'key', 'code', 'code_verifier', 'access_token',
      'token', 'secret', 'client_secret', 'password', 'authorization',
      'body', 'key_hash', 'bearer',
    ]);
    for (const [k, v] of Object.entries(data)) {
      if (blocked.has(k.toLowerCase()) || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token') || k.toLowerCase().includes('key')) {
        safe[k] = '[REDACTED]';
      } else {
        safe[k] = v;
      }
    }
    console.error(`[OAUTH_DEBUG] ${stage}`, JSON.stringify(safe));
  }
}

// ── OAuth store ──────────────────────────────────────────────────────────
let oauthStore: IOAuthStore | undefined;

function getOAuthStore(env: NodeJS.ProcessEnv = process.env): IOAuthStore {
  if (!oauthStore) {
    oauthStore = createOAuthStoreFromEnv(env);
  }
  return oauthStore;
}

export function parseHttpMcpConfig(env: NodeJS.ProcessEnv = process.env): HttpMcpConfig {
  const portValue = env.MCP_HTTP_PORT ?? '8787';
  const port = Number.parseInt(portValue, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid MCP_HTTP_PORT: ${portValue}. Must be 1-65535.`);
  }

  const path = env.MCP_HTTP_PATH ?? '/mcp';

  if (!path.startsWith('/')) {
    throw new Error('Invalid MCP_HTTP_PATH. Must start with /.');
  }

  const transportRaw = env.MCP_TRANSPORT ?? 'http';
  let transport: TransportType;
  if (transportRaw === 'streamable-http') {
    transport = 'streamable-http';
  } else if (transportRaw === 'sse') {
    transport = 'sse';
  } else {
    transport = 'http';
  }

  return {
    enabled: env.MCP_HTTP_ENABLED === 'true',
    host: env.MCP_HTTP_HOST ?? '127.0.0.1',
    port,
    path,
    transport,
    bearerToken: env.MCP_HTTP_BEARER_TOKEN,
    publicBaseUrl: env.MCP_PUBLIC_BASE_URL,
    authCodeTtlSeconds: Number(env.MCP_OAUTH_AUTH_CODE_TTL_SECONDS) || 300,
    accessTokenTtlSeconds: Number(env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS) || 86400,
    allowedClientIds: parseAllowedClientIds(env.MCP_OAUTH_ALLOWED_CLIENT_IDS),
  };
}

/**
 * Parse comma-separated allowed OAuth client IDs from env var.
 * Returns undefined when not configured (all clients allowed in dev).
 */
function parseAllowedClientIds(raw?: string): string[] | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/**
 * Check if a client_id is allowed based on allowlist config.
 * If allowlist is not configured, all clients are accepted.
 */
function isClientIdAllowed(
  clientId: string,
  allowedIds?: string[],
  store?: IOAuthStore
): boolean {
  if (!allowedIds || allowedIds.length === 0) return true;
  if (allowedIds.includes(clientId)) return true;
  // Also check DCR-registered clients
  if (store && store.isClientRegistered(clientId)) return true;
  return false;
}

export function getHttpMcpMode(env: NodeJS.ProcessEnv = process.env): 'remote' | 'local' {
  return env.BROKER_RUNTIME_MODE === 'remote' ? 'remote' : 'local';
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cuan-mcp-connection-key, mcp-session-id',
  });
  res.end(body);
}

function writeJsonWithWwwAuth(res: ServerResponse, statusCode: number, payload: unknown, wwwAuth?: string): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': wwwAuth ?? 'Bearer realm="Cuan Insight MCP"',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cuan-mcp-connection-key, mcp-session-id',
  });
  res.end(body);
}

function writeHtml(res: ServerResponse, statusCode: number, html: string): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

function hasValidBearerToken(req: IncomingMessage, expectedToken?: string): boolean {
  if (!expectedToken) {
    return true;
  }

  const authorization = req.headers.authorization;
  return authorization === `Bearer ${expectedToken}`;
}

function sendUnauthorized(res: ServerResponse, wwwAuth?: string): void {
  writeJsonWithWwwAuth(res, 401, { error: 'Unauthorized' }, wwwAuth);
}

function sendNotFound(res: ServerResponse): void {
  writeJson(res, 404, { error: 'Not found' });
}

function sendNotImplemented(res: ServerResponse): void {
  writeJson(res, 501, { error: HTTP_TRANSPORT_UNAVAILABLE_MESSAGE });
}

/**
 * Extract auth context from request headers for hosted multi-user mode.
 * Supports three modes in order of precedence:
 * 1. OAuth Bearer token → resolves via OAuthStore
 *    - connection_key authType → returns connectionKey string
 *    - oauth_token authType → returns oauth resolved token context
 * 2. x-cuan-mcp-connection-key header (manual client)
 * 3. Authorization: Bearer *** as direct connection key (alias, fallback)
 *
 * Returns { connectionKey } for legacy/connection_key mode,
 * or { connectionKey, oauthAuthContext } for oauth_token mode.
 *
 * Does NOT read env fallback — that belongs in the credential resolver.
 */
function extractAuthContext(
  req: IncomingMessage,
  store?: IOAuthStore
): { connectionKey?: string; oauthAuthContext?: OAuthResolvedToken } | undefined {
  // Mode 1: OAuth Bearer token
  const authorization = req.headers.authorization;
  if (authorization && typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    const bearerValue = authorization.slice(7).trim();

    if (bearerValue) {
      // First try: OAuth access token
      if (store) {
        const resolved = store.resolveAccessToken(bearerValue);
        if (resolved) {
          if (resolved.authType === 'connection_key') {
            return { connectionKey: resolved.connectionKey };
          }
          // oauth_token mode: return full auth context
          return { oauthAuthContext: resolved };
        }
      }

      // Fallback — treat bearer as direct connection key alias
      const connectionKeyFromBearer = bearerValue;
      if (connectionKeyFromBearer) {
        return { connectionKey: connectionKeyFromBearer };
      }
    }
  }

  // Mode 2: x-cuan-mcp-connection-key header
  const headerValue = req.headers['x-cuan-mcp-connection-key'];
  if (headerValue) {
    const key = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const trimmed = key?.trim();
    if (trimmed) return { connectionKey: trimmed };
  }

  return undefined;
}

/** Backward-compat: extract connectionKey string for legacy callers. */
function extractConnectionKey(
  req: IncomingMessage,
  store?: IOAuthStore
): string | undefined {
  const ctx = extractAuthContext(req, store);
  return ctx?.connectionKey;
}

/**
 * Build AuthInfo carrying the connection key + oauth context so it flows through
 * the MCP transport into tool handler extra.authInfo.
 *
 * In connection_key mode: extra.connectionKey = raw key string
 * In oauth_token mode: extra.connectionKey = '' (empty) + extra.oauthAuthContext = resolved token
 *
 * Checks:
 * 1. OAuth Bearer token (resolved via OAuthStore)
 * 2. x-cuan-mcp-connection-key header
 * 3. Authorization: Bearer *** alias
 */
function buildRequestAuth(
  req: IncomingMessage,
  store?: IOAuthStore
): AuthInfo | undefined {
  const ctx = extractAuthContext(req, store);
  if (!ctx) return undefined;

  if (ctx.oauthAuthContext) {
    return {
      token: '',
      clientId: ctx.oauthAuthContext.clientId,
      scopes: (ctx.oauthAuthContext.scope || '').split(' ').filter(Boolean),
      extra: {
        connectionKey: '',
        oauthAuthContext: ctx.oauthAuthContext,
      },
    };
  }

  if (ctx.connectionKey) {
    return {
      token: '',
      clientId: '',
      scopes: [],
      extra: { connectionKey: ctx.connectionKey },
    };
  }

  return undefined;
}

/**
 * Check if request has valid MCP authentication for protected /mcp.
 * Returns true if any auth method succeeds.
 * Never leaks the credential value or type in logs or responses.
 */
function hasValidMcpAuth(
  req: IncomingMessage,
  config: HttpMcpConfig,
  store?: IOAuthStore
): boolean {
  // Check 1: MCP_HTTP_BEARER_TOKEN (legacy static token)
  if (config.bearerToken) {
    const authorization = req.headers.authorization;
    if (authorization && authorization === `Bearer ${config.bearerToken}`) {
      return true;
    }
  }

  // Check 2: OAuth Bearer token via OAuthStore
  const authorization = req.headers.authorization;
  if (authorization && typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    const bearerValue = authorization.slice(7).trim();
    if (bearerValue && store) {
      const resolved = store.resolveAccessToken(bearerValue);
      if (resolved) {
        return true;
      }
    }
  }

  // Check 3: x-cuan-mcp-connection-key header (manual client)
  const headerValue = req.headers['x-cuan-mcp-connection-key'];
  if (headerValue) {
    return true;
  }

  return false;
}

// ── OAuth Route Handlers ─────────────────────────────────────────────────

function handleWellKnownAuthorizationServer(
  config: HttpMcpConfig,
  res: ServerResponse
): void {
  const issuer = config.publicBaseUrl ?? `http://${config.host}:${config.port}`;
  writeJson(res, 200, {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp', 'read', 'write'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}

function handleWellKnownProtectedResource(
  config: HttpMcpConfig,
  res: ServerResponse
): void {
  const issuer = config.publicBaseUrl ?? `http://${config.host}:${config.port}`;
  writeJson(res, 200, {
    resource: `${issuer}${config.path}`,
    authorization_servers: [issuer],
    scopes_supported: ['mcp', 'read', 'write'],
    bearer_methods_supported: ['header'],
  });
}

async function handleGetAuthorize(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  allowedClientIds: string[] | undefined,
): Promise<void> {
  const responseType = url.searchParams.get('response_type');
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const state = url.searchParams.get('state');
  const scope = url.searchParams.get('scope');
  const resource = url.searchParams.get('resource') || undefined;

  oauthDebug('authorize.get.start', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    redirect_uri_host: redirectUri ? (() => { try { return new URL(redirectUri).host; } catch { return 'invalid'; } })() : 'none',
    has_response_type: !!responseType,
    has_scope: !!scope,
    has_resource: !!resource,
    has_state: !!state,
    has_code_challenge: !!codeChallenge,
    has_code_challenge_method: !!codeChallengeMethod,
  }, process.env);

  // Validate required params
  const errors: string[] = [];
  if (!responseType) errors.push('response_type required');
  if (!clientId) errors.push('client_id required');
  if (!redirectUri) errors.push('redirect_uri required');
  if (!codeChallenge) errors.push('code_challenge required');
  if (!codeChallengeMethod) errors.push('code_challenge_method required');
  if (codeChallengeMethod && codeChallengeMethod !== 'S256') errors.push('Only S256 code_challenge_method is supported');
  if (!state) errors.push('state required');
  if (!scope) errors.push('scope required');

  if (errors.length > 0) {
    writeJson(res, 400, { error: 'invalid_request', error_description: errors.join('; ') });
    return;
  }

  // Validate client_id against allowlist (if configured) including DCR
  const store = getOAuthStore();
  if (!isClientIdAllowed(clientId!, allowedClientIds, store)) {
    writeJson(res, 400, { error: 'invalid_client', error_description: 'Client ID tidak dikenal.' });
    return;
  }

  // For DCR-registered clients, validate redirect_uri matches one of the registered URIs
  const registeredClient = store.getRegisteredClient(clientId!);
  if (registeredClient) {
    if (!registeredClient.redirectUris.includes(redirectUri!)) {
      writeJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri not registered for this client.' });
      return;
    }
  }

  // Render form
  const html = renderAuthorizeForm({
    responseType: responseType!,
    clientId: clientId!,
    redirectUri: redirectUri!,
    codeChallenge: codeChallenge!,
    codeChallengeMethod: codeChallengeMethod!,
    state: state!,
    scope: scope!,
    resource,
  });

  oauthDebug('authorize.get.success', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    response_type: responseType,
    has_resource: !!resource,
  }, process.env);

  writeHtml(res, 200, html);
}

async function handlePostAuthorize(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv,
  allowedClientIds: string[] | undefined,
): Promise<void> {
  // Read form body
  const body = await readBody(req);
  const params = new URLSearchParams(body);

  const responseType = params.get('response_type');
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const codeChallenge = params.get('code_challenge');
  const codeChallengeMethod = params.get('code_challenge_method');
  const state = params.get('state');
  const scope = params.get('scope');
  const connectionKey = params.get('connection_key');
  const resource = params.get('resource') || undefined;

  oauthDebug('authorize.post.start', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    redirect_uri_host: redirectUri ? (() => { try { return new URL(redirectUri).host; } catch { return 'invalid'; } })() : 'none',
    has_connection_key: !!connectionKey,
    has_resource: !!resource,
    has_state: !!state,
    has_code_challenge: !!codeChallenge,
  }, env);

  // Validate all required params
  const errors: string[] = [];
  if (!responseType) errors.push('response_type required');
  if (!clientId) errors.push('client_id required');
  if (!redirectUri) errors.push('redirect_uri required');
  if (!codeChallenge) errors.push('code_challenge required');
  if (!codeChallengeMethod) errors.push('code_challenge_method required');
  if (codeChallengeMethod && codeChallengeMethod !== 'S256') errors.push('Only S256 code_challenge_method is supported');
  if (!state) errors.push('state required');
  if (!scope) errors.push('scope required');
  if (!connectionKey) errors.push('connection_key required');

  if (errors.length > 0) {
    writeJson(res, 400, { error: 'invalid_request', error_description: errors.join('; ') });
    return;
  }

  // Validate client_id against allowlist (if configured) including DCR
  const store = getOAuthStore();
  if (!isClientIdAllowed(clientId!, allowedClientIds, store)) {
    writeJson(res, 400, { error: 'invalid_client', error_description: 'Client ID tidak dikenal.' });
    return;
  }

  // For DCR-registered clients, validate redirect_uri matches one of the registered URIs
  const registeredClient = store.getRegisteredClient(clientId!);
  if (registeredClient) {
    if (!registeredClient.redirectUris.includes(redirectUri!)) {
      writeJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri not registered for this client.' });
      return;
    }
  }

  // Validate redirect_uri is a valid URL
  try {
    new URL(redirectUri!);
  } catch {
    writeJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri is not a valid URL' });
    return;
  }

  // Validate Connection Key via Cuan Insight resolver
  // Returns { valid, connectionKeyId } — connectionKeyId from identity (PR #59)
  const keyValidation = await validateConnectionKey(connectionKey!, env);

  if (!keyValidation.valid) {
    oauthDebug('authorize.post.connection_key_invalid', {
      client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    }, env);
    // Re-render form with error
    const html = renderAuthorizeForm({
      responseType: responseType!,
      clientId: clientId!,
      redirectUri: redirectUri!,
      codeChallenge: codeChallenge!,
      codeChallengeMethod: codeChallengeMethod!,
      state: state!,
      scope: scope!,
      resource: params.get('resource') || undefined,
      error: 'Connection Key tidak valid atau sudah dicabut.',
    });
    writeHtml(res, 200, html);
    return;
  }

  // Create authorization code
  // (store already initialized above for client validation)

  const isSupabaseDriver = (env.MCP_OAUTH_STORE_DRIVER ?? 'memory') === 'supabase';

  oauthDebug('authorize.post.connection_key_valid', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    has_resource: !!resource,
    has_connection_key_id: !!keyValidation.connectionKeyId,
    driver: isSupabaseDriver ? 'supabase' : 'memory',
  }, env);

  // Build auth code params based on driver mode
  const authCodeParams: Parameters<typeof store.createAuthorizationCode>[0] = {
    clientId: clientId!,
    redirectUri: redirectUri!,
    codeChallenge: codeChallenge!,
    codeChallengeMethod: codeChallengeMethod!,
    scope: scope!,
    resource,
  };

  if (isSupabaseDriver && keyValidation.connectionKeyId) {
    // Supabase mode: store connectionKeyId reference, NOT raw connection key
    authCodeParams.connectionKeyId = keyValidation.connectionKeyId;
  } else {
    // Memory mode (default): store connectionKey directly
    authCodeParams.connectionKey = connectionKey!;
  }

  const { code } = store.createAuthorizationCode(authCodeParams);

  oauthDebug('authorize.post.code_created', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    has_resource: !!resource,
    redirect_uri_host: (() => { try { return new URL(redirectUri!).host; } catch { return 'invalid'; } })(),
  }, env);

  // Redirect back
  const redirectUrl = new URL(redirectUri!);
  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', state!);

  oauthDebug('authorize.post.redirect', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    redirect_uri_scheme_host: `${redirectUrl.protocol}//${redirectUrl.host}`,
    has_code: true,
    has_state: true,
  }, env);

  res.writeHead(302, { Location: redirectUrl.toString() });
  res.end();
}

async function handlePostToken(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv,
  allowedClientIds: string[] | undefined,
): Promise<void> {
  const body = await readBody(req);
  const params = new URLSearchParams(body);

  const grantType = params.get('grant_type');
  const code = params.get('code');
  const redirectUri = params.get('redirect_uri');
  const clientId = params.get('client_id');
  const codeVerifier = params.get('code_verifier');

  oauthDebug('token.post.start', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    grant_type: grantType,
    has_code: !!code,
    has_redirect_uri: !!redirectUri,
    has_code_verifier: !!codeVerifier,
  }, env);

  // Validate
  if (grantType !== 'authorization_code') {
    writeJson(res, 400, { error: 'unsupported_grant_type' });
    return;
  }

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    writeJson(res, 400, {
      error: 'invalid_request',
      error_description: 'Missing required parameters: code, redirect_uri, client_id, code_verifier',
    });
    return;
  }

  // Validate client_id against allowlist (if configured) including DCR
  const store = getOAuthStore(env);
  if (!isClientIdAllowed(clientId, allowedClientIds, store)) {
    oauthDebug('token.post.client_invalid', {
      client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    }, env);
    writeJson(res, 400, { error: 'invalid_client', error_description: 'Client ID tidak dikenal.' });
    return;
  }

  oauthDebug('token.post.client_valid', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
  }, env);

  // Redeem auth code
  // (store already initialized above for client validation)
  const redeemed = store.redeemAuthorizationCode({
    code,
    codeVerifier,
    clientId,
    redirectUri,
  });

  if (!redeemed) {
    oauthDebug('token.post.redeem_failed', {
      client_id_prefix: clientId?.slice(0, 8) ?? 'none',
      redirect_uri_match: false, // unknown which check failed
    }, env);
    writeJson(res, 400, { error: 'invalid_grant', error_description: 'Authorization code is invalid, expired, or already used' });
    return;
  }

  oauthDebug('token.post.code_found', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    scope: redeemed.scope,
  }, env);

  // Create access token — pass whichever credential reference was redeemed
  const { accessToken, expiresIn } = store.createAccessToken({
    connectionKey: redeemed.connectionKey,
    connectionKeyId: redeemed.connectionKeyId,
    scope: redeemed.scope,
    clientId,
    resource: redeemed.resource,
  });

  oauthDebug('token.post.issued', {
    client_id_prefix: clientId?.slice(0, 8) ?? 'none',
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: redeemed.scope,
  }, env);

  writeJson(res, 200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: redeemed.scope,
  });
}

/**
 * Handle Dynamic Client Registration (RFC 7591).
 *
 * Accepts JSON body from MCP clients (e.g. Claude) to auto-register
 * without requiring manual OAuth Client ID entry.
 *
 * Logs safe metadata only (client_id prefix, redirect_uris count, client_name).
 * Never logs raw registration body or sensitive fields.
 */
async function handlePostRegister(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const body = await readBody(req);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    writeJson(res, 400, { error: 'invalid_client_metadata', error_description: 'Request body must be valid JSON.' });
    return;
  }

  oauthDebug('dcr.register.start', {
    redirect_uris_count: Array.isArray(payload.redirect_uris) ? (payload.redirect_uris as unknown[]).length : 0,
    client_name: payload.client_name || 'unnamed',
    has_grant_types: !!payload.grant_types,
    has_response_types: !!payload.response_types,
  }, env);

  // Validate redirect_uris
  const redirectUris = payload.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    writeJson(res, 400, {
      error: 'invalid_client_metadata',
      error_description: 'redirect_uris is required and must be a non-empty array.',
    });
    return;
  }

  // Validate token_endpoint_auth_method
  const tokenEndpointAuthMethod = (payload.token_endpoint_auth_method as string) || 'none';
  if (tokenEndpointAuthMethod && tokenEndpointAuthMethod !== 'none') {
    writeJson(res, 400, {
      error: 'invalid_client_metadata',
      error_description: 'Only token_endpoint_auth_method=none is supported for public PKCE clients.',
    });
    return;
  }

  // Validate grant_types if provided
  const grantTypes = (payload.grant_types as string[]) || undefined;
  if (grantTypes && !grantTypes.includes('authorization_code')) {
    writeJson(res, 400, {
      error: 'invalid_client_metadata',
      error_description: 'grant_types must include authorization_code.',
    });
    return;
  }

  // Validate response_types if provided
  const responseTypes = (payload.response_types as string[]) || undefined;
  if (responseTypes && !responseTypes.includes('code')) {
    writeJson(res, 400, {
      error: 'invalid_client_metadata',
      error_description: 'response_types must include code.',
    });
    return;
  }

  const store = getOAuthStore(env);
  const { clientId, clientIdIssuedAt } = store.registerClient({
    redirectUris: redirectUris as string[],
    clientName: payload.client_name as string | undefined,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod,
    scope: payload.scope as string | undefined,
  });

  oauthDebug('dcr.register.success', {
    client_id_prefix: clientId.slice(0, 8),
    redirect_uris_count: redirectUris.length,
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    scope: payload.scope || 'mcp read write',
  }, env);

  // Safe logging — never log raw body or secrets
  console.error(
    `DCR: registered client ${clientId.slice(0, 8)}... ` +
    `(${redirectUris.length} redirect_uri(s), name: ${payload.client_name || 'unnamed'})`
  );

  const resolvedGrantTypes = grantTypes ?? ['authorization_code'];
  const resolvedResponseTypes = responseTypes ?? ['code'];
  const resolvedScope = (payload.scope as string) || 'mcp read write';

  writeJson(res, 201, {
    client_id: clientId,
    client_id_issued_at: clientIdIssuedAt,
    redirect_uris: redirectUris,
    grant_types: resolvedGrantTypes,
    response_types: resolvedResponseTypes,
    token_endpoint_auth_method: 'none',
    scope: resolvedScope,
  });
}

async function handlePostRevoke(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const body = await readBody(req);
  const params = new URLSearchParams(body);
  const token = params.get('token');

  if (!token) {
    writeJson(res, 400, { error: 'invalid_request', error_description: 'token parameter is required' });
    return;
  }

  const store = getOAuthStore(env);
  store.revokeAccessToken(token);

  // RFC 7009: always return 200, even if token was invalid
  writeJson(res, 200, { ok: true });
}

/**
 * Safely extract connectionKeyId from Cuan Insight resolver response.
 * Checks multiple possible response shapes:
 * - identity.connectionKeyId (camelCase, direct)
 * - identity.connection_key_id (snake_case, Supabase RPC convention)
 * - data.identity.connectionKeyId (wrapped in data envelope)
 * - data.identity.connection_key_id (wrapped + snake_case)
 * - result.identity.connectionKeyId (wrapped in result)
 * - result.identity.connection_key_id (wrapped result + snake_case)
 */
function extractConnectionKeyId(body: Record<string, unknown>): string | undefined {
  const candidates: Array<Record<string, unknown> | undefined> = [
    body.identity as Record<string, unknown> | undefined,
    body.data ? (body.data as Record<string, unknown>).identity as Record<string, unknown> | undefined : undefined,
    body.result ? (body.result as Record<string, unknown>).identity as Record<string, unknown> | undefined : undefined,
  ];

  for (const identity of candidates) {
    if (!identity) continue;
    const id = identity.connectionKeyId ?? identity.connection_key_id;
    if (typeof id === 'string' && id.length > 0) return id;
    // Also try number (unlikely but safe)
    if (typeof id === 'number' && id > 0) return String(id);
  }

  return undefined;
}

/**
 * Validate a connection key by making a lightweight probe call to Cuan Insight.
 * Returns validation result with optional connectionKeyId from identity response.
 * Never leaks the key in logs or errors.
 */
async function validateConnectionKey(
  connectionKey: string,
  env: NodeJS.ProcessEnv
): Promise<{ valid: boolean; connectionKeyId?: string }> {
  // If we have Cuan Insight resolver configured, probe it
  // This is a lightweight resolve call — just checks key validity
  const baseUrl = env.CUAN_INSIGHT_API_BASE_URL;
  const supabaseAnonKey = env.CUAN_INSIGHT_SUPABASE_ANON_KEY;

  // If no resolver configured, trust the key (local/single-tenant fallback)
  if (!baseUrl || !supabaseAnonKey) {
    // In local mode, connection key is validated at tool call time by the broker
    return { valid: true };
  }

  try {
    const endpointPath = env.CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH ?? '/mcp/resolve-credential';
    const url = new URL(baseUrl.replace(/\/+$/, '') + endpointPath);

    const resolveResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-cuan-mcp-connection-key': connectionKey,
      },
      body: JSON.stringify({
        provider: 'meta', // Any supported provider for validation
        requestedScopes: ['read'], // Required by Edge Function
      }),
      signal: AbortSignal.timeout(10000),
    });

    // Safe debug: log response status and body shape regardless of outcome
    if (OAUTH_DEBUG(env)) {
      try {
        const debugBody = await resolveResponse.clone().json() as Record<string, unknown>;
        const topKeys = Object.keys(debugBody);
        const identityRaw = debugBody.identity as Record<string, unknown> | undefined;
        console.error('[OAUTH_DEBUG] validate_connection_key.http_response', JSON.stringify({
          status: resolveResponse.status,
          ok: resolveResponse.ok,
          top_level_keys: topKeys,
          has_identity: !!identityRaw,
          identity_keys: identityRaw ? Object.keys(identityRaw) : [],
          has_data: 'data' in debugBody,
          has_error: 'error' in debugBody,
          error_code: typeof debugBody.error === 'object' && debugBody.error ? (debugBody.error as Record<string,unknown>).code : null,
          content_type: resolveResponse.headers.get('content-type'),
        }));
      } catch {
        console.error('[OAUTH_DEBUG] validate_connection_key.http_response', JSON.stringify({
          status: resolveResponse.status,
          ok: resolveResponse.ok,
          top_level_keys: 'unparseable',
        }));
      }
    }

    if (resolveResponse.ok) {
      // Parse identity to extract connectionKeyId (added in Cuan Insight PR #59)
      try {
        const body = await resolveResponse.json() as Record<string, unknown>;

        // Safe extraction: check multiple possible paths
        const connectionKeyId = extractConnectionKeyId(body);

        // Safe structural debug (no secret values logged)
        if (OAUTH_DEBUG(env)) {
          const topKeys = Object.keys(body);
          const identityRaw = body.identity as Record<string, unknown> | undefined;
          const dataRaw = body.data as Record<string, unknown> | undefined;
          const dataIdentity = dataRaw?.identity as Record<string, unknown> | undefined;
          const resultRaw = body.result as Record<string, unknown> | undefined;
          const resultIdentity = resultRaw?.identity as Record<string, unknown> | undefined;

          console.error('[OAUTH_DEBUG] validate_connection_key.response_shape', JSON.stringify({
            status: resolveResponse.status,
            top_level_keys: topKeys,
            has_identity: !!identityRaw,
            identity_keys: identityRaw ? Object.keys(identityRaw) : [],
            has_data: !!dataRaw,
            has_data_identity: !!dataIdentity,
            data_identity_keys: dataIdentity ? Object.keys(dataIdentity) : [],
            has_result: !!resultRaw,
            has_result_identity: !!resultIdentity,
            result_identity_keys: resultIdentity ? Object.keys(resultIdentity) : [],
            has_providerAccess: 'providerAccess' in body || 'provider_access' in body,
            extracted_connection_key_id: !!connectionKeyId,
          }));
        }

        return { valid: true, connectionKeyId };
      } catch {
        return { valid: true };
      }
    }

    // 401 = invalid/revoked key
    if (resolveResponse.status === 401) {
      return { valid: false };
    }

    // Other errors — key might still be valid (network issue), allow through
    // The tool call will do proper validation
    return { valid: true };
  } catch {
    // Network error — allow through, tool call will validate properly
    return { valid: true };
  }
}

/**
 * Read request body as string.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/**
 * Check if request is an OAuth-related path.
 */
function isOAuthPath(pathname: string): boolean {
  return (
    pathname === '/authorize' ||
    pathname === '/token' ||
    pathname === '/revoke' ||
    pathname === '/register' ||
    pathname === '/oauth/register' ||
    pathname.startsWith('/.well-known/')
  );
}

// ── Main request handler ─────────────────────────────────────────────────

export function createHttpMcpRequestHandler(
  config: HttpMcpConfig,
  env: NodeJS.ProcessEnv = process.env
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

    // ── CORS preflight ──
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cuan-mcp-connection-key, mcp-session-id',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    // ── OAuth metadata endpoints ──
    if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
      handleWellKnownAuthorizationServer(config, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource') {
      handleWellKnownProtectedResource(config, res);
      return;
    }

    // ── OAuth authorize (GET: form) ──
    if (req.method === 'GET' && url.pathname === '/authorize') {
      handleGetAuthorize(req, res, url, config.allowedClientIds).catch(() => sendNotFound(res));

      return;
    }

    // ── OAuth authorize (POST: submit connection key) ──
    if (req.method === 'POST' && url.pathname === '/authorize') {
      handlePostAuthorize(req, res, env, config.allowedClientIds).catch((e) => {
        console.error('[POST /authorize] ERROR:', e instanceof Error ? e.message : String(e));
        sendNotFound(res);
      });

      return;
    }

    // ── OAuth token ──
    if (req.method === 'POST' && url.pathname === '/token') {
      handlePostToken(req, res, env, config.allowedClientIds).catch(() => sendNotFound(res));

      return;
    }

    // ── OAuth revoke ──
    if (req.method === 'POST' && url.pathname === '/revoke') {
      handlePostRevoke(req, res, env).catch(() => sendNotFound(res));
      return;
    }

    // ── Dynamic Client Registration (POST /register, POST /oauth/register) ──
    if (req.method === 'POST' && (url.pathname === '/register' || url.pathname === '/oauth/register')) {
      handlePostRegister(req, res, env).catch(() => sendNotFound(res));
      return;
    }

    // ── Health endpoint — always available ──
    if (req.method === 'GET' && url.pathname === '/health') {
      writeJson(res, 200, {
        ok: true,
        transport: config.transport,
        mode: getHttpMcpMode(env),
        oauth: config.publicBaseUrl ? true : false,
      });
      return;
    }

    // ── SSE transport ──
    if (config.transport === 'sse') {
      handleSseRequest(config, req, res, url).catch(() => {});
      return;
    }

    // ── Streamable HTTP transport ──
    if (config.transport === 'streamable-http') {
      handleStreamableHttpRequest(config, req, res, url, env).catch(() => {});
      return;
    }

    // ── HTTP mode (default, skeleton) ──
    if (req.method === 'POST' && url.pathname === config.path) {
      if (!hasValidBearerToken(req, config.bearerToken)) {
        sendUnauthorized(res);
        return;
      }

      sendNotImplemented(res);
      return;
    }

    sendNotFound(res);
  };
}

// ── SSE handler ──────────────────────────────────────────────────────────

async function handleSseRequest(
  config: HttpMcpConfig,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<void> {
  const store = getOAuthStore();

  // OAuth mode: gate /mcp behind valid auth
  if (config.publicBaseUrl) {
    if (!hasValidMcpAuth(req, config, store)) {
      const wwwAuth = `Bearer realm="Cuan Insight MCP", authorization_uri="${config.publicBaseUrl}/authorize"`;
      sendUnauthorized(res, wwwAuth);
      return;
    }
  } else if (!hasValidBearerToken(req, config.bearerToken)) {
    // Legacy mode: check MCP_HTTP_BEARER_TOKEN only
    sendUnauthorized(res);
    return;
  }

  if (req.method === 'GET' && url.pathname === config.path) {
    (req as IncomingMessage & { auth?: AuthInfo }).auth = buildRequestAuth(req, store);
    await handleSseConnect(config, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === config.path) {
    const sessionId = url.searchParams.get('sessionId');

    if (sessionId) {
      const transport = activeSseSessions.get(sessionId);
      if (!transport) {
        sendNotFound(res);
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    sendNotImplemented(res);
    return;
  }

  sendNotFound(res);
}

async function handleSseConnect(config: HttpMcpConfig, res: ServerResponse): Promise<void> {
  const transport = new SSEServerTransport(config.path, res);
  const mcpServer = createMetaAdsMcpServer();

  transport.onclose = () => {
    activeSseSessions.delete(transport.sessionId);
  };

  try {
    await mcpServer.connect(transport);
    activeSseSessions.set(transport.sessionId, transport);
    console.error(`SSE session established: ${transport.sessionId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SSE connection failed';
    console.error(`SSE connection error: ${message}`);
    activeSseSessions.delete(transport.sessionId);
  }
}

// ── Streamable HTTP handler ──────────────────────────────────────────────

async function handleStreamableHttpRequest(
  config: HttpMcpConfig,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const store = getOAuthStore();

  // OAuth mode: gate /mcp behind valid auth
  if (config.publicBaseUrl) {
    const authHeader = req.headers.authorization;
    const hasBearer = !!authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

    if (hasBearer) {
      oauthDebug('mcp.auth.bearer_present', {
        path: url.pathname,
        method: req.method,
      }, env);
    }

    if (!hasValidMcpAuth(req, config, store)) {
      const wwwAuth = `Bearer realm="Cuan Insight MCP", authorization_uri="${config.publicBaseUrl}/authorize"`;
      sendUnauthorized(res, wwwAuth);
      return;
    }

    // Check if token resolved via OAuth
    if (hasBearer) {
      const bearerValue = authHeader!.slice(7).trim();
      const resolved = store.resolveAccessToken(bearerValue);
      oauthDebug('mcp.auth.token_resolved', {
        resolved: !!resolved,
        path: url.pathname,
      }, env);
    }

    const authInfo = buildRequestAuth(req, store);
    oauthDebug('mcp.auth.connection_context_resolved', {
      has_oauth_context: !!authInfo?.extra?.oauthAuthContext,
      has_connection_key: !!authInfo?.extra?.connectionKey,
      path: url.pathname,
    }, env);
  } else if (!hasValidBearerToken(req, config.bearerToken)) {
    // Legacy mode: check MCP_HTTP_BEARER_TOKEN only
    sendUnauthorized(res);
    return;
  }

  if (url.pathname !== config.path) {
    sendNotFound(res);
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Existing session
  if (sessionId) {
    (req as IncomingMessage & { auth?: AuthInfo }).auth = buildRequestAuth(req, store);
    const transport = activeStreamableSessions.get(sessionId);
    if (!transport) {
      sendNotFound(res);
      return;
    }
    await transport.handleRequest(req, res);
    return;
  }

  // New session — only allow POST (initialize)
  if (req.method !== 'POST') {
    sendNotImplemented(res);
    return;
  }

  (req as IncomingMessage & { auth?: AuthInfo }).auth = buildRequestAuth(req, store);
  await handleStreamableHttpNewSession(req, res);
}

async function handleStreamableHttpNewSession(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const mcpServer = createMetaAdsMcpServer();

  transport.onclose = () => {
    if (transport.sessionId) {
      activeStreamableSessions.delete(transport.sessionId);
    }
  };

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);

    if (transport.sessionId) {
      activeStreamableSessions.set(transport.sessionId, transport);
      console.error(`Streamable HTTP session established: ${transport.sessionId}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Streamable HTTP request failed';
    console.error(`Streamable HTTP error: ${message}`);
  }
}

// ── Server startup ───────────────────────────────────────────────────────

export async function startHttpMcpServer(
  config: HttpMcpConfig = parseHttpMcpConfig(),
  env: NodeJS.ProcessEnv = process.env
): Promise<StartedHttpMcpServer> {
  if (!config.enabled) {
    throw new Error('HTTP MCP transport is disabled. Set MCP_HTTP_ENABLED=true to enable it.');
  }

  // Prime the OAuth store caches from persistent storage BEFORE the
  // server starts accepting requests. Avoids a race where the first
  // request arrives before persisted tokens are loaded into memory.
  const store = getOAuthStore(env);
  if (typeof (store as unknown as Record<string, unknown>).loadPersistedData === 'function') {
    await (store as unknown as { loadPersistedData(): Promise<void> }).loadPersistedData();
  }

  const server = createServer(createHttpMcpRequestHandler(config, env));

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;

  if (!config.bearerToken) {
    console.error(
      'WARNING: MCP_HTTP_BEARER_TOKEN is not set. Keep HTTP MCP bound to localhost or protect it behind a reverse proxy.'
    );
  }

  console.error(`MCP HTTP server listening on ${config.host}:${address.port}`);

  switch (config.transport) {
    case 'streamable-http':
      console.error(`Streamable HTTP endpoint: ${config.path} (POST to initialize)`);
      console.error('Session ID is returned in response headers for stateful mode.');
      break;
    case 'sse':
      console.error(`SSE endpoint: GET ${config.path}`);
      console.error(`Message endpoint: POST ${config.path}?sessionId=<id>`);
      break;
    default:
      console.error(`MCP endpoint: POST ${config.path}`);
      console.error('Health endpoint: GET /health');
      console.error(HTTP_TRANSPORT_UNAVAILABLE_MESSAGE);
  }

  // Log OAuth info
  if (config.publicBaseUrl) {
    console.error(`OAuth authorization endpoint: ${config.publicBaseUrl}/authorize`);
    console.error(`OAuth token endpoint: ${config.publicBaseUrl}/token`);
    console.error(`OAuth metadata: ${config.publicBaseUrl}/.well-known/oauth-authorization-server`);
  } else {
    console.error('OAuth flow: disabled (set MCP_PUBLIC_BASE_URL to enable)');
  }

  return {
    server,
    url: `http://${config.host}:${address.port}`,
    config: { ...config, port: address.port },
  };
}

function failFastDisabled(): never {
  console.error('ERROR: HTTP MCP transport is disabled.');
  console.error('Set MCP_HTTP_ENABLED=true to start the HTTP server.');
  console.error('Available MCP_TRANSPORT values: sse, streamable-http');
  console.error('Stdio remains the default entrypoint: mcp-server/src/index.ts');
  process.exit(1);
}

async function main(): Promise<void> {
  const config = parseHttpMcpConfig();

  if (!config.enabled) {
    failFastDisabled();
  }

  const started = await startHttpMcpServer(config);

  process.on('SIGINT', () => {
    started.server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    started.server.close(() => {
      process.exit(0);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'HTTP MCP server failed.');
    process.exit(1);
  });
}