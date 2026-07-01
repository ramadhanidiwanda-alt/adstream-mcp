#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMetaAdsMcpServer } from './createServer.js';

async function main() {
  const server = createMetaAdsMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Adstream MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
