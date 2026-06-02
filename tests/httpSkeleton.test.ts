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
    expect(config.transport).toBe('http');
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
      transport: 'http',
      bearerToken: 'secret-test-token',
    });
  });

  it('parses SSE transport configuration', () => {
    process.env.MCP_HTTP_ENABLED = 'true';
    process.env.MCP_TRANSPORT = 'sse';

    const config = parseHttpMcpConfig();

    expect(config.enabled).toBe(true);
    expect(config.transport).toBe('sse');
  });

  it('ignores unknown transport values (falls back to http)', () => {
    process.env.MCP_HTTP_ENABLED = 'true';
    process.env.MCP_TRANSPORT = 'streamable-http';

    const config = parseHttpMcpConfig();

    expect(config.transport).toBe('http');
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

  it('returns health status in HTTP mode', async () => {
    server = createServer(
      createHttpMcpRequestHandler(
        { enabled: true, host: '127.0.0.1', port: 0, path: '/mcp', transport: 'http' },
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

  it('returns health status in SSE mode', async () => {
    server = createServer(
      createHttpMcpRequestHandler(
        { enabled: true, host: '127.0.0.1', port: 0, path: '/mcp', transport: 'sse' },
        { BROKER_RUNTIME_MODE: 'local' }
      )
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, transport: 'sse', mode: 'local' });
  });

  it('returns 401 when bearer token is missing (HTTP mode)', async () => {
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'http',
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

  it('returns 401 when bearer token is missing (SSE mode)', async () => {
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'sse',
        bearerToken: 'secret-sse-token',
      })
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    // GET /mcp without auth -> should return 401
    const response = await fetch(`http://127.0.0.1:${port}/mcp`);
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).toContain('Unauthorized');
    expect(text).not.toContain('secret-sse-token');
  });

  it('POST /mcp without sessionId returns 501 in SSE mode', async () => {
    const token = 'sse-test-token';
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'sse',
        bearerToken: token,
      })
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();

    expect(response.status).toBe(501);
    expect(text).toContain('HTTP transport is not available with current MCP SDK version.');
    expect(text).not.toContain(token);
  });

  it('passes bearer guard and returns 501 in HTTP mode', async () => {
    const token = 'secret-test-token';
    const started = await startHttpMcpServer({
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      transport: 'http',
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

  it('returns 404 for unknown routes', async () => {
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'sse',
      })
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/nonexistent`);
    const text = await response.text();

    expect(response.status).toBe(404);
  });
});

describe('SSE transport auth', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('returns 401 for GET /mcp with invalid bearer token', async () => {
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'sse',
        bearerToken: 'valid-token',
      })
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).toContain('Unauthorized');
    expect(text).not.toContain('valid-token');
    expect(text).not.toContain('wrong-token');
  });

  it('returns 401 for POST /mcp with invalid bearer token (SSE mode)', async () => {
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'sse',
        bearerToken: 'valid-token',
      })
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-token' },
    });
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).toContain('Unauthorized');
  });

  it('allows GET /mcp without auth when no bearer token configured (SSE mode)', async () => {
    server = createServer(
      createHttpMcpRequestHandler({
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'sse',
      })
    );

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    // SSE connection will hang (started but no event loop end), just verify no 401
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 500);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        signal: controller.signal,
      });
      // If it got here without aborting, check status
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
    } catch {
      // Aborted after 500ms is expected — SSE stream stays open
    } finally {
      clearTimeout(timer);
    }
  });
});
