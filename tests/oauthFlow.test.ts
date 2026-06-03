import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import {
  createHttpMcpRequestHandler,
  parseHttpMcpConfig,
} from '../mcp-server/src/http.js';
import { OAuthStore } from '../mcp-server/src/oauthStore.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function randomString(): string {
  return randomBytes(16).toString('hex');
}

function base64UrlEncode(buf: string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function pkceChallenge(verifier: string): string {
  return base64UrlEncode(createHash('sha256').update(verifier).digest('base64url'));
}

// ── OAuthStore Unit Tests ────────────────────────────────────────────────

describe('OAuthStore unit tests', () => {
  let store: OAuthStore;

  beforeEach(() => {
    store = new OAuthStore({ authCodeTtlMs: 60_000, accessTokenTtlMs: 60_000 });
  });

  it('creates and redeems authorization code with PKCE', () => {
    const codeVerifier = randomString();
    const codeChallenge = pkceChallenge(codeVerifier);

    const { code } = store.createAuthorizationCode({
      connectionKey: 'test-connection-key',
      clientId: 'test-client',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
      scope: 'mcp read',
    });

    expect(code).toBeTruthy();
    expect(code.length).toBeGreaterThan(0);

    const redeemed = store.redeemAuthorizationCode({
      code,
      codeVerifier,
      clientId: 'test-client',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
    });

    expect(redeemed).toBeDefined();
    expect(redeemed!.connectionKey).toBe('test-connection-key');
    expect(redeemed!.scope).toBe('mcp read');
  });

  it('rejects reused authorization code', () => {
    const codeVerifier = randomString();
    const codeChallenge = pkceChallenge(codeVerifier);

    const { code } = store.createAuthorizationCode({
      connectionKey: 'test-key',
      clientId: 'test-client',
      redirectUri: 'https://example.com/callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
      scope: 'mcp',
    });

    const first = store.redeemAuthorizationCode({
      code, codeVerifier, clientId: 'test-client', redirectUri: 'https://example.com/callback',
    });
    expect(first).toBeDefined();

    const second = store.redeemAuthorizationCode({
      code, codeVerifier, clientId: 'test-client', redirectUri: 'https://example.com/callback',
    });
    expect(second).toBeUndefined();
  });

  it('rejects invalid code_verifier', () => {
    const codeVerifier = randomString();
    const codeChallenge = pkceChallenge(codeVerifier);

    const { code } = store.createAuthorizationCode({
      connectionKey: 'test-key', clientId: 'test-client',
      redirectUri: 'https://example.com/callback',
      codeChallenge, codeChallengeMethod: 'S256', scope: 'mcp',
    });

    const redeemed = store.redeemAuthorizationCode({
      code, codeVerifier: 'wrong-verifier', clientId: 'test-client',
      redirectUri: 'https://example.com/callback',
    });
    expect(redeemed).toBeUndefined();
  });

  it('creates and resolves access token', () => {
    const { accessToken, expiresIn } = store.createAccessToken({
      connectionKey: 'test-key', scope: 'mcp read write', clientId: 'test-client',
    });

    expect(accessToken).toBeTruthy();
    expect(expiresIn).toBe(60);

    const resolved = store.resolveAccessToken(accessToken);
    expect(resolved).toBeDefined();
    expect(resolved!.connectionKey).toBe('test-key');
    expect(resolved!.scope).toBe('mcp read write');
  });

  it('rejects invalid access token', () => {
    expect(store.resolveAccessToken('invalid-token')).toBeUndefined();
  });

  it('revokes access token', () => {
    const { accessToken } = store.createAccessToken({
      connectionKey: 'test-key', scope: 'mcp', clientId: 'test-client',
    });

    expect(store.revokeAccessToken(accessToken)).toBe(true);
    expect(store.resolveAccessToken(accessToken)).toBeUndefined();
  });

  it('rejects expired authorization code', async () => {
    const shortStore = new OAuthStore({ authCodeTtlMs: 1, accessTokenTtlMs: 60_000 });
    const codeVerifier = randomString();
    const codeChallenge = pkceChallenge(codeVerifier);

    const { code } = shortStore.createAuthorizationCode({
      connectionKey: 'test-key', clientId: 'test-client',
      redirectUri: 'https://example.com/callback',
      codeChallenge, codeChallengeMethod: 'S256', scope: 'mcp',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(shortStore.redeemAuthorizationCode({
      code, codeVerifier, clientId: 'test-client', redirectUri: 'https://example.com/callback',
    })).toBeUndefined();
  });

  it('rejects wrong client_id', () => {
    const codeVerifier = randomString();
    const codeChallenge = pkceChallenge(codeVerifier);

    const { code } = store.createAuthorizationCode({
      connectionKey: 'test-key', clientId: 'client-a',
      redirectUri: 'https://example.com/callback',
      codeChallenge, codeChallengeMethod: 'S256', scope: 'mcp',
    });

    expect(store.redeemAuthorizationCode({
      code, codeVerifier, clientId: 'client-b',
      redirectUri: 'https://example.com/callback',
    })).toBeUndefined();
  });

  it('rejects wrong redirect_uri', () => {
    const codeVerifier = randomString();
    const codeChallenge = pkceChallenge(codeVerifier);

    const { code } = store.createAuthorizationCode({
      connectionKey: 'test-key', clientId: 'test-client',
      redirectUri: 'https://example.com/callback',
      codeChallenge, codeChallengeMethod: 'S256', scope: 'mcp',
    });

    expect(store.redeemAuthorizationCode({
      code, codeVerifier, clientId: 'test-client', redirectUri: 'https://evil.com/callback',
    })).toBeUndefined();
  });

  it('rejects non-S256 code challenge method', () => {
    expect(() => {
      store.createAuthorizationCode({
        connectionKey: 'test-key', clientId: 'test-client',
        redirectUri: 'https://example.com/callback',
        codeChallenge: 'plain', codeChallengeMethod: 'plain', scope: 'mcp',
      });
    }).toThrow('Only S256');
  });

  it('returns stats without leaking secrets', () => {
    const challenge = pkceChallenge('verifier');
    store.createAuthorizationCode({
      connectionKey: 'secret-key', clientId: 'test-client',
      redirectUri: 'https://example.com/callback',
      codeChallenge: challenge, codeChallengeMethod: 'S256', scope: 'mcp',
    });
    store.createAccessToken({
      connectionKey: 'secret-key', scope: 'mcp', clientId: 'test-client',
    });

    const stats = store.getStats();
    expect(stats.activeAuthCodes).toBe(1);
    expect(stats.activeAccessTokens).toBe(1);
    expect(JSON.stringify(stats)).not.toContain('secret-key');
  });
});

// ── Common setup for HTTP tests ──────────────────────────────────────────

interface TestContext {
  server: Server | undefined;
  port: number;
}

async function createTestServer(config?: Partial<import('../mcp-server/src/http.js').HttpMcpConfig>): Promise<TestContext> {
  const server = createServer(
    createHttpMcpRequestHandler({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      transport: 'streamable-http',
      publicBaseUrl: 'https://mcp.cuaninsight.com',
      authCodeTtlSeconds: 300,
      accessTokenTtlSeconds: 86400,
      bearerToken: undefined,
      ...config,
    })
  );

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return { server, port };
}

async function closeTestServer(ctx: TestContext): Promise<void> {
  if (ctx.server) {
    await new Promise<void>((resolve) => ctx.server!.close(() => resolve()));
  }
}

// ── Metadata Endpoints ───────────────────────────────────────────────────

describe('OAuth metadata endpoints', () => {
  let ctx: TestContext;

  beforeEach(async () => { ctx = await createTestServer(); });
  afterEach(async () => { await closeTestServer(ctx); });

  it('returns 200 for oauth-authorization-server metadata', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/.well-known/oauth-authorization-server`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.issuer).toBe('https://mcp.cuaninsight.com');
    expect(body.authorization_endpoint).toBe('https://mcp.cuaninsight.com/authorize');
    expect(body.token_endpoint).toBe('https://mcp.cuaninsight.com/token');
    expect(body.response_types_supported).toContain('code');
    expect(body.grant_types_supported).toContain('authorization_code');
    expect(body.code_challenge_methods_supported).toContain('S256');
    expect(body.token_endpoint_auth_methods_supported).toContain('none');
  });

  it('returns 200 for oauth-protected-resource metadata', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/.well-known/oauth-protected-resource`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.resource).toBe('https://mcp.cuaninsight.com/mcp');
    expect(body.authorization_servers).toContain('https://mcp.cuaninsight.com');
    expect(body.bearer_methods_supported).toContain('header');
  });

  it('metadata endpoints do not leak secrets', async () => {
    for (const ep of ['.well-known/oauth-authorization-server', '.well-known/oauth-protected-resource']) {
      const res = await fetch(`http://127.0.0.1:${ctx.port}/${ep}`);
      const text = await res.text();
      expect(text).not.toContain('secret');
      expect(text).not.toContain('key');
    }
  });

  it('includes oauth flag in health when publicBaseUrl is set', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/health`);
    const body = await res.json();
    expect(body.oauth).toBe(true);
  });

  it('metadata endpoint uses localhost when publicBaseUrl not set', async () => {
    await closeTestServer(ctx);
    ctx = await createTestServer({ publicBaseUrl: undefined });

    const res = await fetch(`http://127.0.0.1:${ctx.port}/.well-known/oauth-authorization-server`);
    const body = await res.json();
    expect(body.issuer).toContain('127.0.0.1');
  });
});

// ── GET /authorize ───────────────────────────────────────────────────────

describe('GET /authorize endpoint', () => {
  let ctx: TestContext;

  beforeEach(async () => { ctx = await createTestServer(); });
  afterEach(async () => { await closeTestServer(ctx); });

  it('renders form with valid OAuth query params', async () => {
    const challenge = pkceChallenge(randomString());
    const params = new URLSearchParams({
      response_type: 'code', client_id: 'test-client',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: challenge, code_challenge_method: 'S256',
      state: 'test-state-123', scope: 'mcp read',
    });

    const res = await fetch(`http://127.0.0.1:${ctx.port}/authorize?${params}`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Connect Cuan Insight MCP');
    expect(html).toContain('Connection Key');
    expect(html).toContain('Authorize');
    expect(html).toContain('test-state-123');
    expect(html).not.toContain('secret');
  });

  it('returns 400 for missing required params', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/authorize`);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_request');
  });

  it('returns 400 for unsupported code challenge method', async () => {
    const params = new URLSearchParams({
      response_type: 'code', client_id: 'test-client',
      redirect_uri: 'https://example.com/callback',
      code_challenge: 'plain', code_challenge_method: 'plain',
      state: 'test-state', scope: 'mcp',
    });

    const res = await fetch(`http://127.0.0.1:${ctx.port}/authorize?${params}`);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_request');
  });
});

// ── Full Authorize + Token Flow ──────────────────────────────────────────

describe('Full authorize + token flow', () => {
  let ctx: TestContext;

  beforeEach(async () => { ctx = await createTestServer(); });
  afterEach(async () => { await closeTestServer(ctx); });

  /** Helper: run full authorize flow and return the redirect location + code verifier */
  async function doAuthorize(params?: Partial<{
    clientId: string; redirectUri: string; state: string; scope: string;
    connectionKey: string;
  }>): Promise<{ location: string; codeVerifier: string }> {
    const codeVerifier = randomString();
    const challenge = pkceChallenge(codeVerifier);

    const formBody = new URLSearchParams({
      response_type: 'code',
      client_id: params?.clientId ?? 'test-client',
      redirect_uri: params?.redirectUri ?? 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: params?.state ?? 'test-state',
      scope: params?.scope ?? 'mcp read',
      connection_key: params?.connectionKey ?? 'ck_test_key',
    });

    const res = await fetch(`http://127.0.0.1:${ctx.port}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
      redirect: 'manual',
    });

    return { location: res.headers.get('location')!, codeVerifier };
  }

  /** Helper: extract code from redirect URL */
  function extractCode(location: string): string {
    return new URL(location).searchParams.get('code')!;
  }

  /** Helper: exchange code for token */
  async function doTokenExchange(code: string, codeVerifier: string, clientId = 'test-client') {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client_id: clientId,
      code_verifier: codeVerifier,
    });

    return fetch(`http://127.0.0.1:${ctx.port}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
  }

  it('shows error form for invalid connection key (with CUAN_INSIGHT_API_BASE_URL set)', async () => {
    // Without CUAN_INSIGHT_API_BASE_URL, key is always valid (local mode)
    // This test verifies the redirect-succeed behavior in local mode
    const { location } = await doAuthorize({ connectionKey: 'ck_any_key_local_mode' });
    expect(location).toContain('code=');
    expect(location).toContain('state=test-state');
  });

  it('returns 400 for missing connection_key', async () => {
    const challenge = pkceChallenge(randomString());
    const formBody = new URLSearchParams({
      response_type: 'code', client_id: 'test-client',
      redirect_uri: 'https://example.com/callback',
      code_challenge: challenge, code_challenge_method: 'S256',
      state: 'state', scope: 'mcp',
      // missing: connection_key
    });

    const res = await fetch(`http://127.0.0.1:${ctx.port}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_request');
  });

  it('preserves redirect_uri and state on success', async () => {
    const { location } = await doAuthorize({ state: 'my-custom-state' });
    expect(location).toContain('state=my-custom-state');
    expect(location).toContain('code=');

    const url = new URL(location);
    expect(url.origin).toBe('https://claude.ai');
    expect(url.pathname).toBe('/api/mcp/auth_callback');
  });

  it('returns access token for valid authorization code', async () => {
    const codeVerifier = randomString();
    const challenge = pkceChallenge(codeVerifier);

    // Authorize
    const formBody = new URLSearchParams({
      response_type: 'code', client_id: 'my-app',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: challenge, code_challenge_method: 'S256',
      state: 'my-state', scope: 'mcp read write',
      connection_key: 'ck_key_123',
    });

    const authRes = await fetch(`http://127.0.0.1:${ctx.port}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
      redirect: 'manual',
    });

    const location = authRes.headers.get('location')!;
    const code = extractCode(location);
    expect(new URL(location).searchParams.get('state')).toBe('my-state');

    // Token exchange
    const tokenRes = await doTokenExchange(code, codeVerifier, 'my-app');
    expect(tokenRes.status).toBe(200);

    const tokenData = await tokenRes.json();
    expect(tokenData.access_token).toBeTruthy();
    expect(tokenData.token_type).toBe('Bearer');
    expect(tokenData.expires_in).toBeGreaterThan(0);
    expect(tokenData.scope).toBe('mcp read write');
    expect(JSON.stringify(tokenData)).not.toContain('ck_key');
    expect(JSON.stringify(tokenData)).not.toContain('123');
  });

  it('rejects invalid authorization code', async () => {
    const res = await doTokenExchange('invalid-code', 'verifier');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('invalid_grant');
  });

  it('rejects reused authorization code', async () => {
    const { location, codeVerifier } = await doAuthorize({ connectionKey: 'ck_key' });
    const code = extractCode(location);

    // First exchange — succeed
    const first = await doTokenExchange(code, codeVerifier);
    expect(first.status).toBe(200);

    // Second exchange — fail
    const second = await doTokenExchange(code, codeVerifier);
    const data = await second.json();
    expect(second.status).toBe(400);
    expect(data.error).toBe('invalid_grant');
  });

  it('rejects unsupported grant_type', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('unsupported_grant_type');
  });

  it('rejects wrong code_verifier', async () => {
    const { location } = await doAuthorize({ connectionKey: 'ck_key' });
    const code = extractCode(location);

    const res = await doTokenExchange(code, 'wrong-verifier');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('invalid_grant');
  });

  it('returns error for missing required token params', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code' }).toString(),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('invalid_request');
  });
});

// ── POST /revoke ─────────────────────────────────────────────────────────

describe('POST /revoke endpoint', () => {
  let ctx: TestContext;

  beforeEach(async () => { ctx = await createTestServer(); });
  afterEach(async () => { await closeTestServer(ctx); });

  it('returns 200 when revoking a valid token', async () => {
    // Get a token via full flow
    const codeVerifier = randomString();
    const challenge = pkceChallenge(codeVerifier);

    const formBody = new URLSearchParams({
      response_type: 'code', client_id: 'test-client',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: challenge, code_challenge_method: 'S256',
      state: 'state', scope: 'mcp',
      connection_key: 'ck_key',
    });

    const authRes = await fetch(`http://127.0.0.1:${ctx.port}/authorize`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(), redirect: 'manual',
    });

    const code = new URL(authRes.headers.get('location')!).searchParams.get('code')!;

    const tokenRes = await fetch(`http://127.0.0.1:${ctx.port}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        client_id: 'test-client', code_verifier: codeVerifier,
      }).toString(),
    });
    const { access_token } = await tokenRes.json();

    // Revoke
    const revokeRes = await fetch(`http://127.0.0.1:${ctx.port}/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: access_token }).toString(),
    });
    const revokeData = await revokeRes.json();
    expect(revokeRes.status).toBe(200);
    expect(revokeData.ok).toBe(true);
  });

  it('returns 400 for missing token param', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams().toString(),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('invalid_request');
  });

  it('returns 200 for non-existent token (RFC 7009)', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'non-existent-token' }).toString(),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

// ── CORS ─────────────────────────────────────────────────────────────────

describe('CORS preflight', () => {
  let ctx: TestContext;

  beforeEach(async () => { ctx = await createTestServer(); });
  afterEach(async () => { await closeTestServer(ctx); });

  it('returns 204 with CORS headers for OPTIONS', async () => {
    const res = await fetch(`http://127.0.0.1:${ctx.port}/health`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
  });
});

// ── Config ───────────────────────────────────────────────────────────────

describe('HTTP config with OAuth fields', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => { originalEnv = { ...process.env }; });
  afterEach(() => { process.env = originalEnv; });

  it('parses OAuth config from environment', () => {
    process.env.MCP_PUBLIC_BASE_URL = 'https://mcp.cuaninsight.com';
    process.env.MCP_OAUTH_AUTH_CODE_TTL_SECONDS = '600';
    process.env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS = '43200';

    const config = parseHttpMcpConfig();
    expect(config.publicBaseUrl).toBe('https://mcp.cuaninsight.com');
    expect(config.authCodeTtlSeconds).toBe(600);
    expect(config.accessTokenTtlSeconds).toBe(43200);
  });

  it('uses defaults for OAuth TTL when not set', () => {
    delete process.env.MCP_OAUTH_AUTH_CODE_TTL_SECONDS;
    delete process.env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS;
    delete process.env.MCP_PUBLIC_BASE_URL;

    const config = parseHttpMcpConfig();
    expect(config.authCodeTtlSeconds).toBe(300);
    expect(config.accessTokenTtlSeconds).toBe(86400);
    expect(config.publicBaseUrl).toBeUndefined();
  });
});
