#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMetaAdsMcpServer } from './createServer.js';

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
  };
}

export function getHttpMcpMode(env: NodeJS.ProcessEnv = process.env): 'remote' | 'local' {
  return env.BROKER_RUNTIME_MODE === 'remote' ? 'remote' : 'local';
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function hasValidBearerToken(req: IncomingMessage, expectedToken?: string): boolean {
  if (!expectedToken) {
    return true;
  }

  const authorization = req.headers.authorization;
  return authorization === `Bearer ${expectedToken}`;
}

function sendUnauthorized(res: ServerResponse): void {
  writeJson(res, 401, { error: 'Unauthorized' });
}

function sendNotFound(res: ServerResponse): void {
  writeJson(res, 404, { error: 'Not found' });
}

function sendNotImplemented(res: ServerResponse): void {
  writeJson(res, 501, { error: HTTP_TRANSPORT_UNAVAILABLE_MESSAGE });
}

export function createHttpMcpRequestHandler(
  config: HttpMcpConfig,
  env: NodeJS.ProcessEnv = process.env
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

    // Health endpoint — always available
    if (req.method === 'GET' && url.pathname === '/health') {
      writeJson(res, 200, {
        ok: true,
        transport: config.transport,
        mode: getHttpMcpMode(env),
      });
      return;
    }

    // SSE transport
    if (config.transport === 'sse') {
      handleSseRequest(config, req, res, url).catch(() => {});
      return;
    }

    // Streamable HTTP transport
    if (config.transport === 'streamable-http') {
      handleStreamableHttpRequest(config, req, res, url).catch(() => {});
      return;
    }

    // HTTP mode (default, skeleton)
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

// ── SSE handler ──────────────────────────────────────────────────────

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

// ── Streamable HTTP handler ──────────────────────────────────────────

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

  // Existing session
  if (sessionId) {
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

// ── Server startup ───────────────────────────────────────────────────

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
