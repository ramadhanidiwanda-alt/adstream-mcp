import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMetaAdsMcpServer } from '../src/mcp/createServer.js';
import { ADS_MCP_TOOL_DEFINITIONS, getAdsMcpToolDefinitions } from '../src/broker/mcpTools.js';
import { COMMERCE_MCP_TOOL_DEFINITIONS } from '../src/broker/commerceTools.js';
import { META_ODAX_OBJECTIVES } from '../src/providers/meta/objectiveLaunchMatrix.js';
import type { AdsBroker } from '../src/broker/AdsBroker.js';

const legacyToolNames = [
  'meta_get_ad_accounts',
  'meta_get_campaigns',
  'meta_get_campaign_insights',
  'meta_get_adset_insights',
  'meta_get_ads_insights',
  'meta_get_insights_by_breakdown',
  'meta_get_location_insights',
  'meta_generate_daily_report',
  'meta_analyze_with_rules',
  'tiktok_list_advertisers',
  'tiktok_get_report',
  'tiktok_get_gmv_max_report',
  'tiktok_get_location_insights',
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
  'ADSTREAM_ENABLE_WRITES',
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  (typeof envKeys)[number],
  string | undefined
>;

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
    createAdCreative: vi.fn(async () => ({
      ok: true,
      provider: 'meta',
      data: { status: 'dry_run' },
    })),
    getCampaignPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getAdsetOrAdgroupPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getAdPerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getCreativePerformance: async () => ({ ok: true, provider: 'meta', data: [] }),
    getCapabilities: () => ({ ok: true, provider: 'meta', data: { registeredProviders: [] } }),
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
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

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

    for (const expectedTool of getAdsMcpToolDefinitions({ includeWrites: false })) {
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

    expect(response.tools).toHaveLength(
      getAdsMcpToolDefinitions({ includeWrites: false }).length +
        COMMERCE_MCP_TOOL_DEFINITIONS.length +
        legacyToolNames.length
    );
  });

  it('keeps full tool order stable for stdio and future transports', async () => {
    const response = await listRegisteredTools();
    const names = response.tools.map((tool) => tool.name);

    expect(names).toEqual([
      ...getAdsMcpToolDefinitions({ includeWrites: false }).map((tool) => tool.name),
      ...COMMERCE_MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
      ...legacyToolNames,
    ]);
  });

  it('hides write tools by default and exposes them only when enabled', async () => {
    let response = await listRegisteredTools();
    let names = response.tools.map((tool) => tool.name);

    expect(names).not.toContain('ads_create_campaign');
    expect(names).not.toContain('ads_archive_ad');

    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    response = await listRegisteredTools();
    names = response.tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining(ADS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name))
    );
  });

  it('dispatches ads_list_adimages and ads_list_advideos to the broker (previously fell through to UNSUPPORTED_OPERATION)', async () => {
    const adsBroker = {
      ...createBrokerStub(),
      listAdImages: vi.fn(async () => ({
        ok: true,
        provider: 'meta',
        data: [{ hash: 'image-hash-1' }],
      })),
      listAdVideos: vi.fn(async () => ({ ok: true, provider: 'meta', data: [{ id: 'video-1' }] })),
    } as unknown as AdsBroker;
    const { client, server } = await createConnectedClient({
      config: { adAccountId: 'act_123' },
      adsBroker,
    });

    try {
      const imagesResponse = await client.callTool({
        name: 'ads_list_adimages',
        arguments: { accountId: 'act_123' },
      });
      expect(imagesResponse.isError).not.toBe(true);
      expect(adsBroker.listAdImages).toHaveBeenCalledTimes(1);

      const videosResponse = await client.callTool({
        name: 'ads_list_advideos',
        arguments: { accountId: 'act_123' },
      });
      expect(videosResponse.isError).not.toBe(true);
      expect(adsBroker.listAdVideos).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('registers and dispatches ads_pause_adset/ads_resume_adset (previously named but never wired up)', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const adsBroker = {
      ...createBrokerStub(),
      pauseAdSet: vi.fn(async () => ({
        ok: true,
        provider: 'meta',
        data: { success: true, id: 'adset_1' },
      })),
      resumeAdSet: vi.fn(async () => ({
        ok: true,
        provider: 'meta',
        data: { success: true, id: 'adset_1' },
      })),
    } as unknown as AdsBroker;
    const { client, server } = await createConnectedClient({
      config: { adAccountId: 'act_123' },
      adsBroker,
    });

    try {
      const tools = await client.listTools();
      const names = tools.tools.map((tool) => tool.name);
      expect(names).toContain('ads_pause_adset');
      expect(names).toContain('ads_resume_adset');

      const pauseResponse = await client.callTool({
        name: 'ads_pause_adset',
        arguments: { accountId: 'act_123', adSetId: 'adset_1' },
      });
      expect(pauseResponse.isError).not.toBe(true);
      expect(adsBroker.pauseAdSet).toHaveBeenCalledTimes(1);

      const resumeResponse = await client.callTool({
        name: 'ads_resume_adset',
        arguments: { accountId: 'act_123', adSetId: 'adset_1' },
      });
      expect(resumeResponse.isError).not.toBe(true);
      expect(adsBroker.resumeAdSet).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('documents flexible asset-feed inputs without encouraging legacy Dynamic Creative defaults', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const response = await listRegisteredTools();
    const adSetTool = response.tools.find((tool) => tool.name === 'ads_create_adset');
    const creativeTool = response.tools.find((tool) => tool.name === 'ads_create_adcreative');

    expect(adSetTool?.inputSchema.properties.isDynamicCreative.description).toMatch(/legacy/i);
    expect(adSetTool?.inputSchema.properties.isDynamicCreative.description).toMatch(
      /jangan diisi/i
    );
    expect(creativeTool?.inputSchema.properties).toHaveProperty('objectStorySpec');
    expect(creativeTool?.inputSchema.properties).toHaveProperty('assetFeedSpec');
    expect(creativeTool?.inputSchema.properties).toHaveProperty('urlTags');
    expect(creativeTool?.inputSchema.required).not.toContain('message');
    expect(creativeTool?.description).toContain('Flexible');
    expect(creativeTool?.inputSchema.properties.assetFeedSpec.description).toContain('Flexible');
  });

  it('accepts urlTags at the MCP schema boundary for Meta URL parameters', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const adsBroker = createBrokerStub();
    const urlTags =
      'utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.id}}';
    const { client, server } = await createConnectedClient({
      config: { adAccountId: 'act_123' },
      adsBroker,
    });

    try {
      const response = await client.callTool({
        name: 'ads_create_adcreative',
        arguments: {
          accountId: 'act_123',
          name: 'Creative with URL tags',
          pageId: 'page_123',
          link: 'https://example.com',
          message: 'Belanja sekarang',
          urlTags,
        },
      });

      expect(response.isError).not.toBe(true);
      expect(adsBroker.createAdCreative).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ urlTags }),
        })
      );
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('exposes canonical Collaborative Ads and creative-format fields without adding create tools', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const response = await listRegisteredTools();
    const toolNames = response.tools.map((tool) => tool.name);
    const campaignTool = response.tools.find((tool) => tool.name === 'ads_create_campaign');
    const adsetTool = response.tools.find((tool) => tool.name === 'ads_create_adset');
    const creativeTool = response.tools.find((tool) => tool.name === 'ads_create_adcreative');
    const campaignProperties = campaignTool?.inputSchema.properties as Record<
      string,
      Record<string, unknown>
    >;
    const adsetProperties = adsetTool?.inputSchema.properties as Record<
      string,
      Record<string, unknown>
    >;
    const creativeProperties = creativeTool?.inputSchema.properties as Record<
      string,
      Record<string, unknown>
    >;

    expect(campaignProperties).toHaveProperty('mode');
    const campaignObjectiveEnum = campaignProperties.objective.enum;
    expect(campaignObjectiveEnum).toEqual([...META_ODAX_OBJECTIVES]);
    expect(campaignProperties.isAdSetBudgetSharingEnabled).toMatchObject({
      type: 'boolean',
    });
    expect(campaignProperties.isAdSetBudgetSharingEnabled.description).toMatch(
      /berbagi.*20%|20%.*anggaran/i
    );
    expect(adsetProperties).toHaveProperty('collaborativeCatalog');
    expect(adsetProperties).toHaveProperty('conversionLocation');
    expect(adsetProperties).toHaveProperty('creativeFormat');
    expect(creativeProperties).toHaveProperty('creativeFormat');
    expect(creativeProperties).toHaveProperty('creativeSpec');
    const canonicalCreateToolNames = [
      'ads_create_campaign',
      'ads_create_adset',
      'ads_create_adcreative',
      'ads_create_ad',
    ];
    expect(toolNames.filter((name) => canonicalCreateToolNames.includes(name))).toEqual(
      canonicalCreateToolNames
    );
    expect(toolNames.filter((name) => name.startsWith('ads_create_'))).toEqual([
      ...canonicalCreateToolNames,
      'ads_create_ecommerce_campaign_bundle',
    ]);

    expect(campaignProperties.mode).toMatchObject({
      type: 'string',
      enum: ['standard', 'collaborative_ads'],
    });
    expect(campaignProperties.mode.description).toMatch(/iklan Meta biasa.*katalog retailer/i);

    expect(adsetProperties.collaborativeCatalog).toMatchObject({
      type: 'object',
      required: ['productSetId'],
      properties: {
        productSetId: { type: 'string' },
        pixelId: { type: 'string' },
        customEventType: { type: 'string' },
        destinationUrl: { type: 'string' },
        applicationId: { type: 'string' },
        objectStoreUrls: { type: 'array', items: { type: 'string' } },
      },
    });
    expect(adsetProperties.collaborativeCatalog.description).toMatch(/katalog.*retailer/i);
    expect(adsetProperties.mode).toMatchObject({
      type: 'string',
      enum: ['standard', 'collaborative_ads'],
    });

    expect(creativeProperties.creativeFormat).toMatchObject({
      type: 'string',
      enum: [
        'single_image',
        'video',
        'carousel',
        'catalog',
        'collection',
        'flexible',
        'placement_image',
        'placement_customized_ctwa',
        'existing_post',
      ],
    });
    expect(creativeProperties.mode).toMatchObject({
      type: 'string',
      enum: ['standard', 'collaborative_ads'],
    });
    expect(creativeProperties.creativeSpec).toMatchObject({ type: 'object' });
    const creativeSpecDescription = creativeProperties.creativeSpec.description as string;
    expect(creativeSpecDescription).toMatch(/format.*field/i);
    for (const fieldName of [
      'imageHash',
      'primaryText',
      'destinationUrl',
      'videoId',
      'thumbnailImageHash',
      'cards',
      'productSetId',
      'templateUrl',
      'fallbackImageHash',
      'instantExperienceId',
      'coverImageHash',
      'coverVideoId',
      'imageHashes',
      'videoIds',
      'primaryTexts',
      'headlines',
      'descriptions',
      'objectStoryId',
    ]) {
      expect(creativeSpecDescription).toContain(fieldName);
    }
    expect(creativeProperties.collaborativeProductSetId).toMatchObject({ type: 'string' });
    expect(creativeProperties.collaborativeProductSetId.description).toMatch(
      /ad set.*Collaborative Ads/i
    );
    expect(creativeProperties.collaborativeAppSpec).toMatchObject({
      type: 'object',
      required: ['applicationId'],
    });
    expect(creativeProperties.message.description).toMatch(/legacy|backward-compatible/i);
    expect(creativeProperties.objectStorySpec.description).toMatch(/advanced|backward-compatible/i);
  });

  it('accepts an existing_post creative without pageId at the MCP schema boundary', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const adsBroker = createBrokerStub();
    const { client, server } = await createConnectedClient({
      config: { adAccountId: 'act_123' },
      adsBroker,
    });

    try {
      const response = await client.callTool({
        name: 'ads_create_adcreative',
        arguments: {
          accountId: 'act_123',
          name: 'Existing post creative',
          creativeFormat: 'existing_post',
          creativeSpec: { objectStoryId: 'page-1_post-1' },
        },
      });

      expect(response.isError).not.toBe(true);
      expect(adsBroker.createAdCreative).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ creativeFormat: 'existing_post' }),
        })
      );
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('accepts a non-enumerated callToActionType (e.g. BOOK_TRAVEL) at the MCP schema boundary', async () => {
    // Regression: callToActionType used to be a closed Zod enum missing many
    // real Meta CTA types (BOOK_TRAVEL, WHATSAPP_MESSAGE, ...) used in
    // practice, while creativeSpec.callToAction already accepted any string.
    // It's now a free string too, matching the field it duplicates.
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const adsBroker = createBrokerStub();
    const { client, server } = await createConnectedClient({
      config: { adAccountId: 'act_123' },
      adsBroker,
    });

    try {
      const response = await client.callTool({
        name: 'ads_create_adcreative',
        arguments: {
          accountId: 'act_123',
          name: 'CPAS Shopee creative',
          pageId: 'page_123',
          link: 'https://example.com',
          message: 'Belanja sekarang',
          callToActionType: 'BOOK_TRAVEL',
        },
      });

      expect(response.isError).not.toBe(true);
      expect(adsBroker.createAdCreative).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ callToActionType: 'BOOK_TRAVEL' }),
        })
      );
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('rejects a Dynamic Creative payload without headline variants', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const { client, server } = await createConnectedClient();

    try {
      const response = await client.callTool({
        name: 'ads_create_adcreative',
        arguments: {
          accountId: 'act_123',
          name: 'Incomplete Dynamic Creative',
          pageId: 'page_123',
          objectStorySpec: {
            asset_feed_spec: {
              bodies: [{ text: 'Primary text' }],
              link_urls: [{ website_url: 'https://example.com/product' }],
            },
          },
        },
      });

      expect(response.isError).toBe(true);
      expect(response.content[0]?.text).toMatch(/titles/i);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('passes every Dynamic Creative variant from MCP input to the broker', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const adsBroker = createBrokerStub();
    const objectStorySpec = { page_id: 'page_123' };
    const assetFeedSpec = {
      ad_formats: ['AUTOMATIC_FORMAT'],
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      images: [{ hash: 'image_hash_1' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
      call_to_action_types: ['LEARN_MORE'],
    };
    const { client, server } = await createConnectedClient({
      config: { adAccountId: 'act_123' },
      adsBroker,
    });

    try {
      const response = await client.callTool({
        name: 'ads_create_adcreative',
        arguments: {
          accountId: 'act_123',
          name: 'Complete Dynamic Creative',
          pageId: 'page_123',
          objectStorySpec,
          assetFeedSpec,
        },
      });

      expect(response.isError).not.toBe(true);
      expect(adsBroker.createAdCreative).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ objectStorySpec, assetFeedSpec }),
        })
      );
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('continues to accept the legacy nested Dynamic Creative asset feed', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const adsBroker = createBrokerStub();
    const objectStorySpec = {
      page_id: 'page_123',
      asset_feed_spec: {
        bodies: [{ text: 'Primary text A' }],
        titles: [{ text: 'Headline A' }],
        link_urls: [{ website_url: 'https://example.com/product' }],
      },
    };
    const { client, server } = await createConnectedClient({
      config: { adAccountId: 'act_123' },
      adsBroker,
    });

    try {
      const response = await client.callTool({
        name: 'ads_create_adcreative',
        arguments: {
          accountId: 'act_123',
          name: 'Legacy Dynamic Creative',
          pageId: 'page_123',
          objectStorySpec,
        },
      });

      expect(response.isError).not.toBe(true);
      expect(adsBroker.createAdCreative).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ objectStorySpec }),
        })
      );
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('starts in remote mode without legacy Meta env', async () => {
    useRemoteBrokerEnv();

    const { client, server } = await createConnectedClient({});

    try {
      const response = await client.listTools();
      const names = response.tools.map((tool) => tool.name);

      expect(names).toEqual(expect.arrayContaining(legacyToolNames));
      expect(names).toEqual(
        expect.arrayContaining(
          getAdsMcpToolDefinitions({ includeWrites: false }).map((tool) => tool.name)
        )
      );
      expect(names).toEqual(
        expect.arrayContaining(COMMERCE_MCP_TOOL_DEFINITIONS.map((tool) => tool.name))
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

    expect(adsBroker.listAccounts).toHaveBeenCalledWith(expect.objectContaining({ params: {} }));
  });

  it('routes meta_get_ad_accounts through remote-safe ads_list_accounts', async () => {
    useRemoteBrokerEnv();
    const adsBroker = createBrokerStub();
    const { client, server } = await createConnectedClient({
      adsBroker,
    });

    try {
      const response = await client.callTool({
        name: 'meta_get_ad_accounts',
        arguments: {},
      });

      const text = response.content[0]?.text ?? '';
      expect(text).toContain('"ok": true');
      expect(text).not.toContain('test-mcp-token-secret');
      expect(text).not.toContain('test-supabase-anon-key');
      expect(text).not.toContain('META_ACCESS_TOKEN is required');
    } finally {
      await Promise.all([client.close(), server.close()]);
    }

    expect(adsBroker.listAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'meta', params: {} })
    );
  });

  it('keeps local mode requiring legacy Meta env at initialization', () => {
    delete process.env.BROKER_RUNTIME_MODE;
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;

    expect(() => createMetaAdsMcpServer()).toThrow('META_ACCESS_TOKEN is required');
  });
});
