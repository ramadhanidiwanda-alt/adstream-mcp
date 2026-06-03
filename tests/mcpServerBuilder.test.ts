import { afterEach, describe, expect, it, vi } from 'vitest';
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

const envKeys = [
  'BROKER_RUNTIME_MODE',
  'CUAN_INSIGHT_API_BASE_URL',
  'CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH',
  'CUAN_INSIGHT_SUPABASE_ANON_KEY',
  'CUAN_INSIGHT_MCP_TOKEN',
  'CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME',
  'META_ACCESS_TOKEN',
  'META_AD_ACCOUNT_ID',
] as const;

const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]])
) as Record<(typeof envKeys)[number], string | undefined>;

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function useRemoteBrokerEnv() {
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
  process.env.BROKER_RUNTIME_MODE = 'remote';
  process.env.CUAN_INSIGHT_API_BASE_URL = 'https://broker.example.test';
  process.env.CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH = '/mcp/credentials/resolve';
  process.env.CUAN_INSIGHT_SUPABASE_ANON_KEY = 'test-supabase-anon-key';
  process.env.CUAN_INSIGHT_MCP_TOKEN = 'test-mcp-token-secret';
  process.env.CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME = 'X-Test-MCP-Token';
}

function createBrokerStub(): AdsBroker {
  return {
    listAccounts: vi.fn(async () => ({ ok: true, provider: 'meta', data: [] })),
    getCampaignPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getAdsetOrAdgroupPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getAdPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getCreativePerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    generateReport: async () => ({ ok: true, provider: 'meta', data: [] }),
  } as unknown as AdsBroker;
}

async function createConnectedClient(
  options: Parameters<typeof createMetaAdsMcpServer>[0] = {
    config: { adAccountId: 'act_123' },
    adsBroker: createBrokerStub(),
  }
) {
  const server = createMetaAdsMcpServer(options);
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return { client, server };
}

async function listRegisteredTools() {
  const { client, server } = await createConnectedClient();

  try {
    return await client.listTools();
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
}

describe('MCP server builder', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('registers existing legacy Meta tools', async () => {
    const response = await listRegisteredTools();
    const names = response.tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining(legacyToolNames));
  });

  it('registers existing ads broker tools with equivalent McpServer schemas', async () => {
    const response = await listRegisteredTools();
    const toolsByName = new Map(response.tools.map((tool) => [tool.name, tool]));

    for (const expectedTool of ADS_MCP_TOOL_DEFINITIONS) {
      const actualTool = toolsByName.get(expectedTool.name);

      expect(actualTool?.name).toBe(expectedTool.name);
      expect(actualTool?.description).toBe(expectedTool.description);
      expect(Object.keys(actualTool?.inputSchema.properties ?? {})).toEqual(
        Object.keys(expectedTool.inputSchema.properties)
      );
      expect(actualTool?.inputSchema.required ?? []).toEqual(expectedTool.inputSchema.required);
    }
  });

  it('keeps the expected MCP tool count', async () => {
    const response = await listRegisteredTools();

    expect(response.tools).toHaveLength(13);
  });

  it('keeps full tool order stable for stdio and future transports', async () => {
    const response = await listRegisteredTools();
    const names = response.tools.map((tool) => tool.name);

    expect(names).toEqual([
      ...ADS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
      ...legacyToolNames,
    ]);
  });

  it('starts in remote mode without legacy Meta env', async () => {
    useRemoteBrokerEnv();

    const { client, server } = await createConnectedClient({});

    try {
      const response = await client.listTools();
      const names = response.tools.map((tool) => tool.name);

      expect(names).toEqual(expect.arrayContaining(legacyToolNames));
      expect(names).toEqual(
        expect.arrayContaining(ADS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name))
      );
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('routes ads tools through remote-mode ads broker', async () => {
    useRemoteBrokerEnv();
    const adsBroker = createBrokerStub();
    const { client, server } = await createConnectedClient({ adsBroker });

    try {
      await client.callTool({ name: 'ads_list_accounts', arguments: {} });
    } finally {
      await Promise.all([client.close(), server.close()]);
    }

    expect(adsBroker.listAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ params: {} })
    );
  });

  it('returns safe legacy tool error in remote mode without crashing initialization', async () => {
    useRemoteBrokerEnv();
    const { client, server } = await createConnectedClient({
      adsBroker: createBrokerStub(),
    });

    try {
      const response = await client.callTool({
        name: 'meta_get_ad_accounts',
        arguments: {},
      });

      const text = response.content[0]?.text ?? '';
      expect(text).toContain('Legacy meta_* tools require local META_* env');
      expect(text).not.toContain('test-mcp-token-secret');
      expect(text).not.toContain('test-supabase-anon-key');
      expect(text).not.toContain('META_ACCESS_TOKEN is required');
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('keeps local mode requiring legacy Meta env at initialization', () => {
    delete process.env.BROKER_RUNTIME_MODE;
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;

    expect(() => createMetaAdsMcpServer()).toThrow('META_ACCESS_TOKEN is required');
  });
});
