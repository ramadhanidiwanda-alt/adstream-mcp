import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMetaAdsMcpServer } from '../mcp-server/src/createServer.js';
import { ADS_MCP_TOOL_DEFINITIONS } from '../src/broker/mcpTools.js';
import type { AdsBroker } from '../src/broker/AdsBroker.js';

const legacyToolNames = [
  'meta_get_ad_accounts',
  'meta_get_campaigns',
  'meta_get_campaign_insights',
  'meta_get_adset_insights',
  'meta_get_ads_insights',
  'meta_generate_daily_report',
  'meta_analyze_with_rules',
];

function createBrokerStub(): AdsBroker {
  return {
    listAccounts: async () => ({ ok: true, provider: 'meta', data: [] }),
    getCampaignPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getAdsetOrAdgroupPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getAdPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getCreativePerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    generateReport: async () => ({ ok: true, provider: 'meta', data: [] }),
  } as unknown as AdsBroker;
}

async function listRegisteredTools() {
  const server = createMetaAdsMcpServer({
    config: { adAccountId: 'act_123' },
    adsBroker: createBrokerStub(),
  });
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  try {
    return await client.listTools();
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
}

describe('MCP server builder', () => {
  it('registers existing legacy Meta tools', async () => {
    const response = await listRegisteredTools();
    const names = response.tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining(legacyToolNames));
  });

  it('registers existing ads broker tools without schema changes', async () => {
    const response = await listRegisteredTools();
    const toolsByName = new Map(response.tools.map((tool) => [tool.name, tool]));

    for (const expectedTool of ADS_MCP_TOOL_DEFINITIONS) {
      expect(toolsByName.get(expectedTool.name)).toEqual(expectedTool);
    }
  });

  it('keeps full tool order stable for stdio and future transports', async () => {
    const response = await listRegisteredTools();
    const names = response.tools.map((tool) => tool.name);

    expect(names).toEqual([
      ...ADS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
      ...legacyToolNames,
    ]);
  });
});
