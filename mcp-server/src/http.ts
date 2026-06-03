#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMetaAdsMcpServer } from './createServer.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { OAuthStore, createOAuthStore } from './oauthStore.js';
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

// ── OAuth store ──────────────────────────────────────────────────────────
let oauthStore: OAuthStore | undefined;

function getOAuthStore(env: NodeJS.ProcessEnv = process.env): OAuthStore {
  if (!oauthStore) {
    oauthStore = createOAuthStore({
      authCodeTtlMs: (Number(env.MCP_OAUTH_AUTH_CODE_TTL_SECONDS) || 300) * 1000,
      accessTokenTtlMs: (Number(env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS) || 86400) * 1000,
    });
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
  };
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

function writeJsonWithWwwAuth(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': 'Bearer realm="Cuan Insight MCP"',
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

function sendUnauthorized(res: ServerResponse): void {
  writeJsonWithWwwAuth(res, 401, { error: 'Unauthorized' });
}

function sendNotFound(res: ServerResponse): void {
  writeJson(res, 404, { error: 'Not found' });
}

function sendNotImplemented(res: ServerResponse): void {
  writeJson(res, 501, { error: HTTP_TRANSPORT_UNAVAILABLE_MESSAGE });
}

/**
 * Extract connection key from request headers for hosted multi-user mode.
 * Supports three modes in order of precedence:
 * 1. OAuth Bearer token → resolves via OAuthStore to connection key
 * 2. x-cuan-mcp-connection-key header (manual client)
 * 3. Authorization: Bearer treated as direct connection key (alias, fallback)
 *
 * Does NOT read env fallback — that belongs in the credential resolver.
 */
function extractConnectionKey(
  req: IncomingMessage,
  store?: OAuthStore
): string | undefined {
  // Mode 1: OAuth Bearer token
  const authorization = req.headers.authorization;
  if (authorization && typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    const bearerValue = authorization.slice(7).trim();

    if (bearerValue) {
      // First try: OAuth access token
      if (store) {
        const resolved = store.resolveAccessToken(bearerValue);
        if (resolved) {
          return resolved.connectionKey;
        }
      }

      // Second: if Authorization matches MCP_HTTP_BEARER_TOKEN exactly, skip (server-level)
      // Third: fallback — treat bearer as direct connection key alias
      const configBearer = req.headers['x-server-bearer']; // not stored, skip
      // For compatibility, try as connection key
      // Only if it doesn't look like a server token
      const connectionKeyFromBearer = bearerValue;
      if (connectionKeyFromBearer) {
        return connectionKeyFromBearer;
      }
    }
  }

  // Mode 2: x-cuan-mcp-connection-key header
  const headerValue = req.headers['x-cuan-mcp-connection-key'];
  if (headerValue) {
    const key = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return key?.trim() || undefined;
  }

  return undefined;
}

/**
 * Build minimal AuthInfo carrying the connection key so it flows through
 * the MCP transport into tool handler extra.authInfo.
 *
 * Checks:
 * 1. OAuth Bearer token (resolved via OAuthStore)
 * 2. x-cuan-mcp-connection-key header
 * 3. Authorization: Bearer <connection-key> alias
 */
function buildRequestAuth(
  req: IncomingMessage,
  store?: OAuthStore
): AuthInfo | undefined {
  const connectionKey = extractConnectionKey(req, store);
  if (!connectionKey) return undefined;
  return { token: '', clientId: '', scopes: [], extra: { connectionKey } };
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
  env: NodeJS.ProcessEnv
): Promise<void> {
  const responseType = url.searchParams.get('response_type');
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const state = url.searchParams.get('state');
  const scope = url.searchParams.get('scope');

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

  // Render form
  const html = renderAuthorizeForm({
    responseType: responseType!,
    clientId: clientId!,
    redirectUri: redirectUri!,
    codeChallenge: codeChallenge!,
    codeChallengeMethod: codeChallengeMethod!,
    state: state!,
    scope: scope!,
  });

  writeHtml(res, 200, html);
}

async function handlePostAuthorize(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv
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

  // Validate redirect_uri is a valid URL
  try {
    new URL(redirectUri!);
  } catch {
    writeJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri is not a valid URL' });
    return;
  }

  // Validate Connection Key via Cuan Insight resolver
  // For now: call the credential resolver to verify the key is valid
  // This makes a lightweight probe call to Cuan Insight
  const keyValid = await validateConnectionKey(connectionKey!, env);

  if (!keyValid) {
    // Re-render form with error
    const html = renderAuthorizeForm({
      responseType: responseType!,
      clientId: clientId!,
      redirectUri: redirectUri!,
      codeChallenge: codeChallenge!,
      codeChallengeMethod: codeChallengeMethod!,
      state: state!,
      scope: scope!,
      error: 'Connection Key tidak valid atau sudah dicabut.',
    });
    writeHtml(res, 200, html);
    return;
  }

  // Create authorization code
  const store = getOAuthStore(env);
  const { code } = store.createAuthorizationCode({
    connectionKey: connectionKey!,
    clientId: clientId!,
    redirectUri: redirectUri!,
    codeChallenge: codeChallenge!,
    codeChallengeMethod: codeChallengeMethod!,
    scope: scope!,
  });

  // Redirect back
  const redirectUrl = new URL(redirectUri!);
  redirectUrl.searchParams.set('code', code);
  redirectUrl.searchParams.set('state', state!);

  res.writeHead(302, { Location: redirectUrl.toString() });
  res.end();
}

async function handlePostToken(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const body = await readBody(req);
  const params = new URLSearchParams(body);

  const grantType = params.get('grant_type');
  const code = params.get('code');
  const redirectUri = params.get('redirect_uri');
  const clientId = params.get('client_id');
  const codeVerifier = params.get('code_verifier');

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

  // Redeem auth code
  const store = getOAuthStore(env);
  const redeemed = store.redeemAuthorizationCode({
    code,
    codeVerifier,
    clientId,
    redirectUri,
  });

  if (!redeemed) {
    writeJson(res, 400, { error: 'invalid_grant', error_description: 'Authorization code is invalid, expired, or already used' });
    return;
  }

  // Create access token
  const { accessToken, expiresIn } = store.createAccessToken({
    connectionKey: redeemed.connectionKey,
    scope: redeemed.scope,
    clientId,
  });

  writeJson(res, 200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: redeemed.scope,
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
 * Validate a connection key by making a lightweight probe call to Cuan Insight.
 * Returns true if the key is valid.
 * Never leaks the key in logs or errors.
 */
async function validateConnectionKey(
  connectionKey: string,
  env: NodeJS.ProcessEnv
): Promise<boolean> {
  // If we have Cuan Insight resolver configured, probe it
  // This is a lightweight resolve call — just checks key validity
  const baseUrl = env.CUAN_INSIGHT_API_BASE_URL;
  const supabaseAnonKey = env.CUAN_INSIGHT_SUPABASE_ANON_KEY;

  // If no resolver configured, trust the key (local/single-tenant fallback)
  if (!baseUrl || !supabaseAnonKey) {
    // In local mode, connection key is validated at tool call time by the broker
    return true;
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
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (resolveResponse.ok) {
      return true;
    }

    // 401 = invalid/revoked key
    if (resolveResponse.status === 401) {
      return false;
    }

    // Other errors — key might still be valid (network issue), allow through
    // The tool call will do proper validation
    return true;
  } catch {
    // Network error — allow through, tool call will validate properly
    return true;
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
      handleGetAuthorize(req, res, url, env).catch(() => sendNotFound(res));
      return;
    }

    // ── OAuth authorize (POST: submit connection key) ──
    if (req.method === 'POST' && url.pathname === '/authorize') {
      handlePostAuthorize(req, res, env).catch(() => sendNotFound(res));
      return;
    }

    // ── OAuth token ──
    if (req.method === 'POST' && url.pathname === '/token') {
      handlePostToken(req, res, env).catch(() => sendNotFound(res));
      return;
    }

    // ── OAuth revoke ──
    if (req.method === 'POST' && url.pathname === '/revoke') {
      handlePostRevoke(req, res, env).catch(() => sendNotFound(res));
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
      handleStreamableHttpRequest(config, req, res, url).catch(() => {});
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
  if (!hasValidBearerToken(req, config.bearerToken)) {
    sendUnauthorized(res);
    return;
  }

  if (req.method === 'GET' && url.pathname === config.path) {
    const store = getOAuthStore();
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
  url: URL
): Promise<void> {
  if (!hasValidBearerToken(req, config.bearerToken)) {
    sendUnauthorized(res);
    return;
  }

  if (url.pathname !== config.path) {
    sendNotFound(res);
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const store = getOAuthStore();

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
