#!/usr/bin/env node
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMetaAdsMcpServer } from './createServer.js';

/**
 * EXPERIMENTAL HTTP/SSE MCP SERVER
 * 
 * This is a non-production skeleton for remote MCP transport.
 * 
 * LIMITATIONS:
 * - Uses SSE transport (not Streamable HTTP - SDK support pending)
 * - Requires explicit ENABLE_EXPERIMENTAL_HTTP_MCP=true
 * - No production auth/rate limiting/monitoring
 * - No real Cuan Insight API integration
 * - Stdio remains the default and recommended transport
 * 
 * SECURITY:
 * - Binds to 127.0.0.1 by default (localhost only)
 * - Does not log Authorization headers
 * - Does not expose tokens in responses
 * - Read-only operations only
 */

interface HttpMcpConfig {
  enabled: boolean;
  host: string;
  port: number;
  endpoint: string;
}

function parseHttpMcpConfig(): HttpMcpConfig {
  const enabled = process.env.ENABLE_EXPERIMENTAL_HTTP_MCP === 'true';
  const host = process.env.MCP_HTTP_HOST || '127.0.0.1';
  const portStr = process.env.MCP_HTTP_PORT || '3000';
  const port = parseInt(portStr, 10);
  const endpoint = process.env.MCP_HTTP_ENDPOINT || '/message';

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid MCP_HTTP_PORT: ${portStr}. Must be 1-65535.`);
  }

  return { enabled, host, port, endpoint };
}

function failFastDisabled(): never {
  console.error('ERROR: Experimental HTTP MCP transport is not enabled.');
  console.error('');
  console.error('This is a non-production skeleton. To enable:');
  console.error('  export ENABLE_EXPERIMENTAL_HTTP_MCP=true');
  console.error('');
  console.error('IMPORTANT:');
  console.error('- This uses SSE transport (not Streamable HTTP)');
  console.error('- No production auth/rate limiting');
  console.error('- Stdio remains the default transport');
  console.error('- See docs/REMOTE_MCP_TRANSPORT_DESIGN.md');
  process.exit(1);
}

async function main() {
  const config = parseHttpMcpConfig();

  if (!config.enabled) {
    failFastDisabled();
  }

  console.error('WARNING: Starting EXPERIMENTAL HTTP MCP server');
  console.error('This is NOT production-ready. Use stdio for production.');
  console.error('');
  console.error(`Host: ${config.host}`);
  console.error(`Port: ${config.port}`);
  console.error(`Endpoint: ${config.endpoint}`);
  console.error('');

  const mcpServer = createMetaAdsMcpServer();
  const sessions = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // SSE connection endpoint (GET)
    if (req.method === 'GET' && url.pathname === '/sse') {
      try {
        const transport = new SSEServerTransport(config.endpoint, res);
        const sessionId = transport.sessionId;
        sessions.set(sessionId, transport);

        transport.onclose = () => {
          sessions.delete(sessionId);
          console.error(`Session closed: ${sessionId}`);
        };

        transport.onerror = (error) => {
          console.error(`Session error: ${sessionId}`, error);
          sessions.delete(sessionId);
        };

        await transport.start();
        await mcpServer.connect(transport);
        console.error(`Session started: ${sessionId}`);
      } catch (error) {
        console.error('SSE connection error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
      return;
    }

    // Message endpoint (POST)
    if (req.method === 'POST' && url.pathname === config.endpoint) {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing sessionId parameter');
        return;
      }

      const transport = sessions.get(sessionId);
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Session not found');
        return;
      }

      try {
        await transport.handlePostMessage(req, res);
      } catch (error) {
        console.error('Message handling error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
      return;
    }

    // Health check
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        transport: 'sse',
        experimental: true,
        production: false,
      }));
      return;
    }

    // 404 for all other routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  httpServer.listen(config.port, config.host, () => {
    console.error(`Experimental HTTP MCP server listening on ${config.host}:${config.port}`);
    console.error('SSE endpoint: GET /sse');
    console.error(`Message endpoint: POST ${config.endpoint}?sessionId=<id>`);
    console.error('Health check: GET /health');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.error('Shutting down...');
    httpServer.close(() => {
      console.error('Server closed');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
