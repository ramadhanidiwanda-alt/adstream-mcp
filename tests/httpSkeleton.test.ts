import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import {
  createHttpMcpRequestHandler,
  parseHttpMcpConfig,
  startHttpMcpServer,
} from '../mcp-server/src/http.js';

describe('HTTP MCP skeleton config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to disabled without affecting stdio', () => {
    delete process.env.MCP_HTTP_ENABLED;

    const config = parseHttpMcpConfig();

    expect(config.enabled).toBe(false);
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8787);
    expect(config.path).toBe('/mcp');
  });

  it('parses explicit HTTP configuration', () => {
    process.env.MCP_HTTP_ENABLED = 'true';
    process.env.MCP_HTTP_HOST = '0.0.0.0';
    process.env.MCP_HTTP_PORT = '8788';
    process.env.MCP_HTTP_PATH = '/custom-mcp';
    process.env.MCP_HTTP_BEARER_TOKEN = 'secret-test-token';

    const config = parseHttpMcpConfig();

    expect(config).toEqual({
      enabled: true,
      host: '0.0.0.0',
      port: 8788,
      path: '/custom-mcp',
      bearerToken: 'secret-test-token',
    });
  });
});

describe('HTTP MCP skeleton endpoints', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
    server = undefined;
  });

  it('returns health status', async () => {
    server = createServer(
      createHttpMcpRequestHandler(
        { enabled: true, host: '127.0.0.1', port: 0, path: '/mcp' },
        { BROKER_RUNTIME_MODE: 'remote' }
      )
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, transport: 'http', mode: 'remote' });
  });

  it('returns 401 when bearer token is missing', async () => {
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        bearerToken: 'secret-test-token',
      })
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST' });
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).toContain('Unauthorized');
    expect(text).not.toContain('secret-test-token');
  });

  it('passes bearer guard and fails fast on unavailable transport', async () => {
    const token = 'secret-test-token';
    const started = await startHttpMcpServer({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      bearerToken: token,
    });
    server = started.server;

    const response = await fetch(`${started.url}/mcp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();

    expect(response.status).toBe(501);
    expect(text).toContain('HTTP transport is not available with current MCP SDK version.');
    expect(text).not.toContain(token);
  });
});
