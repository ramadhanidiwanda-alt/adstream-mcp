import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

describe('HTTP MCP startup — persistent OAuth load race', () => {
  it('awaits loadPersistedData before listen accepts requests', async () => {
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const fetchMock = vi.fn(async (url: string | URL) => {
      await loadGate;
      const pathname = new URL(String(url)).pathname;
      return {
        ok: true,
        status: 200,
        json: async () => pathname.endsWith('/mcp_oauth_clients') ? [] : [],
      };
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    vi.resetModules();
    const { startHttpMcpServer } = await import('../src/mcp/http.js');

    let resolved = false;
    const startedPromise = startHttpMcpServer(
      {
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        transport: 'streamable-http',
        publicBaseUrl: 'https://mcp.cuaninsight.com',
        authCodeTtlSeconds: 300,
        accessTokenTtlSeconds: 86400,
      },
      {
        MCP_OAUTH_STORE_DRIVER: 'supabase',
        MCP_OAUTH_SUPABASE_URL: 'https://supabase.example',
        MCP_OAUTH_SUPABASE_SERVICE_ROLE_KEY: 'service-role-placeholder',
      } as NodeJS.ProcessEnv
    ).then((started) => {
      resolved = true;
      return started;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalled();
    expect(resolved).toBe(false);

    releaseLoad();
    const started = await startedPromise;

    try {
      expect(resolved).toBe(true);
      const response = await fetch(`${started.url}/health`);
      expect(response.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => started.server.close(() => resolve()));
    }
  });
});
