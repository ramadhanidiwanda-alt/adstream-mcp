import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { connect, createServer as createTcpServer } from 'node:net';
import type { AddressInfo } from 'node:net';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

/**
 * Bind an ephemeral port, then release it, so the test can probe that exact
 * port *before* startHttpMcpServer listens on it. Port 0 is unusable here:
 * the assigned port would not be knowable until listen already happened,
 * which is the very moment under test.
 */
function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createTcpServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/** Resolves true if a TCP connection to the port is accepted. */
function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    const settle = (accepted: boolean) => {
      socket.destroy();
      resolve(accepted);
    };
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
  });
}

/**
 * Poll until the port accepts a connection, or the window closes. The window
 * only has to outlast the handful of sync statements plus the single listen
 * turn that an unawaited load would race ahead through — it is margin for a
 * loaded machine, not a guess at how long startup takes.
 */
async function acceptsConnectionWithin(port: number, windowMs: number): Promise<boolean> {
  const deadline = Date.now() + windowMs;
  for (;;) {
    if (await canConnect(port)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('HTTP MCP startup — persistent OAuth load race', () => {
  // The test below must re-import src/mcp/http.js through vi.resetModules() to
  // get a fresh module-level `oauthStore`, and that first import pays Vite's
  // transform cost for the whole module graph (~2.4s idle, well past the 5s
  // test budget on a loaded machine). Warming the graph here moves that cost
  // into a hook with its own generous budget; the re-import inside the test
  // then hits the warm transform cache and takes ~40ms, so the test's timeout
  // polices the startup race itself rather than build overhead.
  beforeAll(async () => {
    await import('../src/mcp/http.js');
  }, 120_000);

  it('does not accept connections until loadPersistedData resolves', async () => {
    const port = await reservePort();

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
        json: async () => (pathname.endsWith('/mcp_oauth_clients') ? [] : []),
      };
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    vi.resetModules();
    const { startHttpMcpServer } = await import('../src/mcp/http.js');

    const startedPromise = startHttpMcpServer(
      {
        enabled: true,
        host: '127.0.0.1',
        port,
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
    );

    // Surface a startup rejection instead of leaking an unhandled rejection if
    // the assertions below fail before the promise is awaited.
    startedPromise.catch(() => undefined);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // The load is still gated, so persisted OAuth data is not in memory yet.
    // Startup must not have reached listen: a request arriving now would be
    // served by a store that has not been primed.
    expect(await acceptsConnectionWithin(port, 750)).toBe(false);

    releaseLoad();
    const started = await startedPromise;

    try {
      // originalFetch, not the mocked global: this must exercise the real
      // server over a real socket, not replay the fetch mock's canned 200.
      const response = await originalFetch(`http://127.0.0.1:${port}/health`);
      expect(response.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => started.server.close(() => resolve()));
    }
  });
});
