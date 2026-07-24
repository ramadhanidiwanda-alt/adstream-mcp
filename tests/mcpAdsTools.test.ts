import { describe, expect, it } from 'vitest';
import {
  ADS_MCP_TOOL_DEFINITIONS,
  getAdsMcpToolDefinitions,
  getAdsMcpToolAnnotations,
  handleAdsMcpToolCall,
  isAdsMcpWriteTool,
  safeAdsMcpError,
  toAdsBrokerRequest,
} from '../src/broker/mcpTools.js';
import type { AdsBroker } from '../src/broker/AdsBroker.js';
import {
  META_CONVERSION_LOCATIONS,
  META_ODAX_OBJECTIVES,
} from '../src/providers/meta/objectiveLaunchMatrix.js';
import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsReport,
} from '../src/broker/types.js';

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
];

const LEGACY_READINESS_WORKFLOW_ALIASES = [
  'website_sales',
  'lead_generation',
  'existing_post',
  'cpas_catalog_sales',
] as const;

function createRecord(raw?: unknown): AdsMetricRecord {
  return {
    provider: 'meta',
    level: 'campaign',
    identity: { account_id: 'act_123', campaign_id: 'cmp_123' },
    time: { date_start: '2026-05-01', date_stop: '2026-05-07' },
    delivery: { spend: 10, impressions: 100 },
    raw,
  };
}

function createBrokerStub(): AdsBroker {
  const response = async (): Promise<AdsBrokerResponse<AdsMetricRecord[]>> => ({
    ok: true,
    provider: 'meta',
    data: [createRecord()],
  });

  return {
    listAccounts: async () => ({ ok: true, provider: 'meta', data: [] }),
    listCampaigns: async () => ({ ok: true, provider: 'meta', data: [] }),
    getAccountPerformance: response,
    getCampaignPerformance: response,
    getAdsetOrAdgroupPerformance: response,
    getAdPerformance: response,
    getCreativePerformance: async () => ({
      ok: false,
      provider: 'meta',
      errors: [{ provider: 'meta', code: 'NOT_IMPLEMENTED', message: 'not implemented' }],
    }),
    getCapabilities: () => ({
      ok: true,
      provider: 'meta',
      data: {
        registeredProviders: [{ id: 'meta', displayName: 'Meta Ads Stub' }],
      },
    }),
    getChangeHistory: async () => ({
      ok: true,
      provider: 'meta',
      data: {
        provider: 'meta',
        account: { id: 'act_123' },
        dateRange: { since: '2026-05-01', until: '2026-05-07' },
        rows: [],
        paging: { nextCursor: null },
        warnings: [],
        dataFreshness: { retrievedAt: new Date().toISOString() },
        capabilities: {},
      },
    }),
    getPlacementPerformance: response,
    getContentMatrix: async () => ({
      ok: true,
      provider: 'meta',
      data: {
        provider: 'meta',
        report_kind: 'content_matrix',
        date_range: { since: '2026-05-01', until: '2026-05-07' },
        group_by: 'campaign',
        sort: { metric: 'spend', direction: 'desc' },
        groups: [],
        coverage: { rows: 0, groups: 0, has_creative_assets: false, notes: [] },
      },
    }),
    generateReport: async () => ({
      ok: true,
      provider: 'meta',
      data: {
        provider: 'meta',
        report_kind: 'ads',
        format: 'summary',
        level: 'account',
        date_range: { since: '2026-05-01', until: '2026-05-07' },
        totals: { spend: 10, impressions: 100, clicks: 0 },
        findings: ['Analyzed 1 normalized ads performance row.'],
        recommendations: [
          'Review objective-specific success metrics before making optimization decisions.',
        ],
        disclaimer:
          'These recommendations are suggestions only. Review performance context and business constraints before taking action.',
      } satisfies AdsReport,
    }),
    getAdDestinations: async () => ({
      ok: true,
      provider: 'meta',
      data: [
        {
          ad_id: 'ad_123',
          ad_name: 'Test Ad',
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          creative_id: 'cr_123',
          creative_type: 'link',
          destination_url: 'https://example.com',
          all_urls: ['https://example.com'],
          resolution_method: 'link_data.link',
        },
      ],
    }),
    readAdCreativeFull: async () => ({
      ok: true,
      provider: 'meta',
      data: {
        operation: 'read_ad_creative_full',
        status: 'executed',
        creative_id: 'cr_123',
        creative: { id: 'cr_123', name: 'Test Creative', object_type: 'SHARE' },
        fields_retrieved: ['id', 'name', 'object_type'],
        fields_missing: [],
      },
    }),
    readAdSetFull: async () => ({
      ok: true,
      provider: 'meta',
      data: {
        operation: 'read_adset_full',
        status: 'executed',
        mode: 'single',
        adset_id: 'as_1',
        adset: { id: 'as_1', name: 'Set A', targeting: { age_min: 18 } },
        fields_retrieved: ['id', 'name', 'targeting'],
        fields_missing: [],
      },
    }),
  } as unknown as AdsBroker;
}

function parseToolResponse(
  response: Awaited<ReturnType<typeof handleAdsMcpToolCall>>
): AdsBrokerResponse {
  return JSON.parse(response.content[0].text) as AdsBrokerResponse;
}

describe('ads MCP broker tools', () => {
  it('labels read tools as safe to read repeatedly', () => {
    expect(getAdsMcpToolAnnotations('ads_get_performance')).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
  });

  it('labels additive create tools as non-destructive writes', () => {
    expect(getAdsMcpToolAnnotations('ads_create_campaign')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
  });

  it('labels risky mutation tools as destructive writes', () => {
    expect(getAdsMcpToolAnnotations('ads_archive_ad')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    });
  });

  it('labels upload tools as additive writes', () => {
    expect(getAdsMcpToolAnnotations('ads_upload_image')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
  });

  it('separates read tools from write tools for default MCP exposure', () => {
    expect(isAdsMcpWriteTool('ads_get_performance')).toBe(false);
    expect(isAdsMcpWriteTool('ads_create_campaign')).toBe(true);
    expect(isAdsMcpWriteTool('ads_archive_ad')).toBe(true);

    const defaultToolNames = getAdsMcpToolDefinitions({ includeWrites: false }).map(
      (tool) => tool.name
    );
    const fullToolNames = getAdsMcpToolDefinitions({ includeWrites: true }).map(
      (tool) => tool.name
    );

    expect(defaultToolNames).toContain('ads_get_performance');
    expect(defaultToolNames).toContain('ads_get_capabilities');
    expect(defaultToolNames).not.toContain('ads_create_campaign');
    expect(defaultToolNames).not.toContain('ads_archive_ad');
    expect(defaultToolNames).not.toContain('ads_upload_image');
    expect(fullToolNames).toEqual(ADS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name));
  });

  it('defines a structured canonical filter schema for ads_get_performance', () => {
    const tool = ADS_MCP_TOOL_DEFINITIONS.find(({ name }) => name === 'ads_get_performance');
    const properties = tool?.inputSchema.properties as Record<string, unknown>;
    const filters = properties.filters as {
      items?: {
        type?: string;
        properties?: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
      };
    };

    expect(filters.items).toMatchObject({
      type: 'object',
      required: ['field', 'operator', 'value'],
      additionalProperties: false,
      properties: {
        field: { type: 'string' },
        operator: {
          type: 'string',
          enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'not_contains'],
        },
      },
    });
  });

  it('does not require since/until for ads_get_creatives compliance audits', () => {
    const tool = ADS_MCP_TOOL_DEFINITIONS.find(({ name }) => name === 'ads_get_creatives');

    expect(tool?.inputSchema.required).not.toContain('since');
    expect(tool?.inputSchema.required).not.toContain('until');
  });

  it('exposes urlTags on ads_create_adcreative for Meta URL parameters', () => {
    const tool = ADS_MCP_TOOL_DEFINITIONS.find(({ name }) => name === 'ads_create_adcreative');
    const properties = tool?.inputSchema.properties as Record<string, unknown>;

    expect(properties.urlTags).toMatchObject({
      type: 'string',
    });
  });

  it('exposes canonical objective and conversionLocation for objective-aware creatives', () => {
    const tool = ADS_MCP_TOOL_DEFINITIONS.find(({ name }) => name === 'ads_create_adcreative');
    const properties = tool?.inputSchema.properties as Record<string, unknown>;

    expect(properties.objective).toMatchObject({
      type: 'string',
      enum: [...META_ODAX_OBJECTIVES],
    });
    expect(properties.conversionLocation).toMatchObject({
      type: 'string',
      enum: [...META_CONVERSION_LOCATIONS],
    });
  });

  it('exposes applinkTreatment enum on ads_create_adcreative for omnichannel creatives', () => {
    const tool = ADS_MCP_TOOL_DEFINITIONS.find(({ name }) => name === 'ads_create_adcreative');
    const creativeSpec = (tool?.inputSchema.properties as Record<string, unknown>).creativeSpec as {
      properties?: Record<string, unknown>;
    };

    expect(creativeSpec.properties?.applinkTreatment).toMatchObject({
      type: 'string',
      enum: [
        'deeplink_with_appstore_fallback',
        'deeplink_with_web_fallback',
        'web_only',
        'deeplink_disabled',
      ],
    });
  });

  it('defines new ads tools without removing legacy names from expected server surface', () => {
    const adsToolNames = ADS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name);

    expect(adsToolNames).toEqual([
      'ads_list_accounts',
      'ads_list_campaigns',
      'ads_check_launch_readiness',
      'ads_get_performance',
      'ads_get_creatives',
      'ads_get_change_history',
      'ads_get_capabilities',
      'ads_get_account_performance',
      'ads_get_campaign_performance',
      'ads_get_adset_or_adgroup_performance',
      'ads_get_ad_performance',
      'ads_get_creative_performance',
      'ads_get_placement_performance',
      'ads_content_matrix',
      'ads_generate_report',
      'ads_pause_campaign',
      'ads_resume_campaign',
      'ads_update_campaign_budget',
      'ads_rename_campaign',
      'ads_create_campaign',
      'ads_create_adset',
      'ads_create_adcreative',
      'ads_create_ad',
      'ads_clone_ui_ad',
      'ads_archive_ad',
      'ads_pause_ad',
      'ads_resume_ad',
      'ads_pause_adset',
      'ads_resume_adset',
      'ads_clone_adset',
      'ads_update_adset',
      'ads_update_ad',
      'ads_update_campaign',
      'ads_get_targeting_options',
      'ads_create_ecommerce_campaign_bundle',
      'ads_get_video_source',
      'ads_get_ad_creative_mapping',
      'ads_upload_image',
      'ads_upload_video',
      'ads_get_account_info',
      'ads_list_adimages',
      'ads_list_advideos',
      'ads_get_ad_preview',
      'ads_get_ad_destinations',
      'ads_read_creative_full',
      'ads_read_adset_full',
      'ads_list_pages',
      'ads_list_instagram_accounts',
      'ads_list_instagram_media',
      'ads_list_threads_profiles',
      'ads_list_pixels',
      'ads_list_catalogs',
      'ads_list_product_sets',
      'ads_list_whatsapp_accounts',
      'ads_list_whatsapp_phone_numbers',
      'ads_list_whatsapp_message_templates',
      'tiktok_gmv_max_create_campaign',
      'tiktok_gmv_max_update_campaign',
      'tiktok_gmv_max_create_session',
      'tiktok_gmv_max_update_session',
      'tiktok_gmv_max_delete_session',
      'tiktok_gmv_max_get_campaign_info',
      'tiktok_smart_plus_create_campaign',
      'tiktok_smart_plus_pause_campaign',
      'tiktok_smart_plus_resume_campaign',
      'tiktok_smart_plus_create_adgroup',
      'tiktok_smart_plus_pause_adgroup',
      'tiktok_smart_plus_resume_adgroup',
    ]);
    expect(legacyToolNames).toContain('meta_get_campaign_insights');
    expect(legacyToolNames).toContain('meta_get_ads_insights');
  });

  it('dispatches launch readiness checks and CPAS discovery tools to the broker', async () => {
    const calls: string[] = [];
    let readinessRequest: AdsBrokerRequest | undefined;
    const broker = {
      ...createBrokerStub(),
      checkLaunchReadiness: async (request: AdsBrokerRequest) => {
        calls.push('checkLaunchReadiness');
        readinessRequest = request;
        return {
          ok: true,
          provider: 'meta',
          data: {
            ready: false,
            workflow: 'leads_instant_form',
            recommendedWorkflow: 'leads_instant_form',
            missing: ['pageId'],
            nextQuestions: ['Page Facebook mana yang mau dipakai?'],
            checks: [],
            warnings: [],
            summary: 'Belum siap dibuat. Ada 1 informasi yang masih kurang.',
            writesEnabled: request.params.writesEnabled === true,
          },
        };
      },
      listPixels: async () => {
        calls.push('listPixels');
        return { ok: true, provider: 'meta', data: [{ id: 'pixel-1', name: 'Pixel 1' }] };
      },
      listCatalogs: async () => {
        calls.push('listCatalogs');
        return { ok: true, provider: 'meta', data: [{ id: 'catalog-1', name: 'Catalog 1' }] };
      },
      listProductSets: async () => {
        calls.push('listProductSets');
        return { ok: true, provider: 'meta', data: [{ id: 'set-1', name: 'Set 1' }] };
      },
    } as unknown as AdsBroker;

    for (const [name, args] of [
      [
        'ads_check_launch_readiness',
        {
          accountId: 'act_123',
          workflow: 'leads_instant_form',
          objective: 'OUTCOME_LEADS',
          conversionLocation: 'INSTANT_FORM',
          optimizationGoal: 'LEAD_GENERATION',
          creativeFormat: 'single_image',
          apiVersion: 'v25.0',
          leadFormId: 'form-1',
          applicationId: 'app-1',
          objectStoreUrl: 'https://apps.apple.com/app/example',
          appDeepLinkUrl: 'example://open',
        },
      ],
      ['ads_list_pixels', { accountId: 'act_123' }],
      ['ads_list_catalogs', { accountId: 'act_123', businessId: 'business-1' }],
      ['ads_list_product_sets', { accountId: 'act_123', catalogId: 'catalog-1' }],
    ] as const) {
      const parsed = parseToolResponse(await handleAdsMcpToolCall(broker, name, args));
      expect(parsed.ok).toBe(true);
    }

    expect(calls).toEqual([
      'checkLaunchReadiness',
      'listPixels',
      'listCatalogs',
      'listProductSets',
    ]);
    expect(readinessRequest?.params).toMatchObject({
      workflow: 'leads_instant_form',
      objective: 'OUTCOME_LEADS',
      conversionLocation: 'INSTANT_FORM',
      optimizationGoal: 'LEAD_GENERATION',
      creativeFormat: 'single_image',
      apiVersion: 'v25.0',
      leadFormId: 'form-1',
      applicationId: 'app-1',
      objectStoreUrl: 'https://apps.apple.com/app/example',
      appDeepLinkUrl: 'example://open',
    });
  });

  it('accepts legacy readiness workflow aliases at the JSON Schema boundary', () => {
    const readinessTool = getAdsMcpToolDefinitions({ includeWrites: false }).find(
      (tool) => tool.name === 'ads_check_launch_readiness'
    );
    const workflowSchema = readinessTool?.inputSchema.properties.workflow as
      | { enum?: readonly string[] }
      | undefined;

    expect(workflowSchema?.enum).toEqual(expect.arrayContaining(LEGACY_READINESS_WORKFLOW_ALIASES));
  });

  it('routes canonical ads_get_performance by level without removing legacy tools', async () => {
    let receivedRequest: AdsBrokerRequest | undefined;
    const broker = {
      ...createBrokerStub(),
      getCampaignPerformance: async (request: AdsBrokerRequest) => {
        receivedRequest = request;
        return { ok: true, provider: 'meta' as const, data: [createRecord()] };
      },
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_performance', {
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      level: 'campaign',
      metrics: ['spend', 'impressions'],
      dimensions: ['campaign'],
      breakdowns: ['date'],
      filters: [{ field: 'campaign.status', operator: 'eq', value: 'ACTIVE' }],
      sortBy: 'spend',
      sortDirection: 'desc',
      limit: 25,
      cursor: 'opaque-cursor',
    });

    const parsed = parseToolResponse(response);
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toMatchObject({
      provider: 'meta',
      account: { id: 'act_123' },
      dateRange: { since: '2026-05-01', until: '2026-05-07' },
      level: 'campaign',
      metrics: ['spend', 'impressions'],
      dimensions: ['campaign'],
      rows: expect.any(Array),
      paging: { nextCursor: null },
      warnings: expect.any(Array),
      dataFreshness: { retrievedAt: expect.any(String) },
      capabilities: expect.any(Object),
      unsupportedMetrics: [],
    });
    expect(receivedRequest).toMatchObject({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {
        level: 'campaign',
        metrics: ['spend', 'impressions'],
        dimensions: ['campaign'],
        breakdowns: ['date'],
        filters: [{ field: 'campaign.status', operator: 'eq', value: 'ACTIVE' }],
        sortBy: 'spend',
        sortDirection: 'desc',
        limit: 25,
        cursor: 'opaque-cursor',
      },
    });
  });

  it('returns unsupported metrics and warnings in canonical performance envelope', async () => {
    const broker = {
      ...createBrokerStub(),
      getCampaignPerformance: async () => ({
        ok: true,
        provider: 'meta' as const,
        data: [createRecord()],
      }),
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_performance', {
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      metrics: ['spend', 'made_up_metric'],
    });

    const parsed = parseToolResponse(response);
    expect(parsed.data).toMatchObject({
      unsupportedMetrics: ['made_up_metric'],
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: 'UNSUPPORTED_METRIC', field: 'metrics.made_up_metric' }),
      ]),
    });
  });

  it('aliases cpa to cost_per_result and omits unrequested heavy metric groups', async () => {
    const row: AdsMetricRecord = {
      ...createRecord(),
      conversions: { results: 2, result_type: 'purchase', cost_per_result: 5 },
      actions: Array.from({ length: 20 }, (_, index) => ({
        action_type: `action_${index}`,
        value: index,
      })),
      video: { video_views: 500, watched_100_percent: 100 },
    };
    const broker = {
      ...createBrokerStub(),
      getAdPerformance: async () => ({ ok: true, provider: 'meta' as const, data: [row] }),
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_performance', {
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      level: 'ad',
      metrics: ['spend', 'cpa'],
    });

    const parsed = parseToolResponse(response);
    expect(parsed.data).toMatchObject({
      metrics: ['spend', 'cost_per_result'],
      unsupportedMetrics: [],
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: 'METRIC_ALIAS', field: 'metrics.cpa' }),
      ]),
      rows: [
        expect.objectContaining({
          conversions: { cost_per_result: 5 },
        }),
      ],
    });
    expect(parsed.data?.rows?.[0]).not.toHaveProperty('actions');
    expect(parsed.data?.rows?.[0]).not.toHaveProperty('video');
  });

  it('routes ads_get_creatives to creative performance with canonical creative envelope', async () => {
    let receivedRequest: AdsBrokerRequest | undefined;
    const broker = {
      ...createBrokerStub(),
      getCreativePerformance: async (request: AdsBrokerRequest) => {
        receivedRequest = request;
        return { ok: true, provider: 'meta' as const, data: [createRecord()] };
      },
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_creatives', {
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      limit: 10,
      complianceAudit: true,
    });

    expect(parseToolResponse(response).data).toMatchObject({ level: 'creative' });
    expect(receivedRequest).toMatchObject({
      params: { level: 'creative', limit: 10, complianceAudit: true },
    });
  });

  it('returns canonical change history response for Meta and structured fallback for other providers', async () => {
    const metaResponse = parseToolResponse(
      await handleAdsMcpToolCall(createBrokerStub(), 'ads_get_change_history', {
        provider: 'meta',
        accountId: 'act_123',
        since: '2026-05-01',
        until: '2026-05-07',
      })
    );

    expect(metaResponse).toMatchObject({ ok: true, provider: 'meta' });
    expect(metaResponse.data).toMatchObject({
      provider: 'meta',
      account: { id: 'act_123' },
      dateRange: { since: '2026-05-01', until: '2026-05-07' },
      rows: expect.any(Array),
      paging: { nextCursor: null },
      dataFreshness: { retrievedAt: expect.any(String) },
    });

    const tiktokResponse = parseToolResponse(
      await handleAdsMcpToolCall(createBrokerStub(), 'ads_get_change_history', {
        provider: 'tiktok',
        accountId: 'advertiser_1',
      })
    );

    expect(tiktokResponse).toMatchObject({
      ok: false,
      provider: 'tiktok',
      errors: [expect.objectContaining({ code: 'NOT_IMPLEMENTED' })],
    });
  });

  it('returns canonical capabilities without requiring provider credentials', async () => {
    const broker = createBrokerStub();

    const response = await handleAdsMcpToolCall(broker, 'ads_get_capabilities', {
      provider: 'meta',
    });

    const parsed = parseToolResponse(response);
    expect(parsed).toMatchObject({ ok: true, provider: 'meta' });
    expect(parsed.data).toMatchObject({
      canonicalTools: expect.arrayContaining([
        'ads_get_performance',
        'ads_get_creatives',
        'ads_get_capabilities',
      ]),
      registeredProviders: expect.arrayContaining([expect.objectContaining({ id: 'meta' })]),
      metricCatalog: expect.objectContaining({
        common: expect.arrayContaining(['spend', 'impressions', 'clicks']),
        byProvider: expect.objectContaining({ meta: expect.arrayContaining(['purchase_roas']) }),
      }),
      read: expect.objectContaining({
        levels: expect.arrayContaining(['account', 'campaign', 'ad']),
        metrics: expect.arrayContaining(['cost_per_result']),
      }),
      writes: expect.objectContaining({
        optionalTools: expect.arrayContaining(['ads_pause_campaign']),
      }),
    });
  });

  it('never advertises a read breakdown that assertLocationBreakdowns() actually rejects', async () => {
    // Regression: ads_get_capabilities used to list ['date', 'country', 'region',
    // 'platform', 'placement', 'product'] as supported breakdowns, but the real
    // validator behind ads_get_performance / meta_get_location_insights only
    // ever accepted ['country', 'region', 'dma'] — every other advertised value
    // failed with "Invalid location breakdown: <value>" the moment a caller
    // actually tried it.
    const { assertLocationBreakdowns } = await import('../src/utils/locationBreakdowns.js');
    const broker = createBrokerStub();

    const response = parseToolResponse(
      await handleAdsMcpToolCall(broker, 'ads_get_capabilities', { provider: 'meta' })
    );
    const advertisedBreakdowns = (response.data as { read: { breakdowns: string[] } }).read
      .breakdowns;

    expect(advertisedBreakdowns.length).toBeGreaterThan(0);
    for (const breakdown of advertisedBreakdowns) {
      expect(
        () => assertLocationBreakdowns([breakdown]),
        `${breakdown} is advertised in ads_get_capabilities but rejected by assertLocationBreakdowns()`
      ).not.toThrow();
    }
  });

  it('never advertises optionalTools without a real, dispatchable tool definition behind it', async () => {
    // Regression: optionalTools used to be derived from the raw
    // ADS_MCP_TOOL_NAMES array, which can (and did) contain names with no
    // corresponding entry in ADS_MCP_TOOL_DEFINITIONS and no dispatch case —
    // capabilities() claimed those tools existed while every call to them
    // returned UNSUPPORTED_OPERATION. It must now be a subset of the
    // actually-registered write tool definitions.
    const broker = createBrokerStub();
    process.env.ADSTREAM_ENABLE_WRITES = 'true';

    try {
      const response = parseToolResponse(
        await handleAdsMcpToolCall(broker, 'ads_get_capabilities', { provider: 'meta' })
      );
      const optionalTools = (response.data as { writes: { optionalTools: string[] } }).writes
        .optionalTools;
      const registeredWriteNames = new Set(
        getAdsMcpToolDefinitions({ includeWrites: true })
          .map((tool) => tool.name)
          .filter((name) => isAdsMcpWriteTool(name))
      );

      expect(optionalTools.length).toBeGreaterThan(0);
      for (const name of optionalTools) {
        expect(registeredWriteNames.has(name), `${name} is advertised but not registered`).toBe(
          true
        );
      }
    } finally {
      delete process.env.ADSTREAM_ENABLE_WRITES;
    }
  });

  it('reports write-tool availability that follows the enable flag', async () => {
    const broker = createBrokerStub();
    const previous = process.env.ADSTREAM_ENABLE_WRITES;

    try {
      delete process.env.ADSTREAM_ENABLE_WRITES;
      const disabled = parseToolResponse(
        await handleAdsMcpToolCall(broker, 'ads_get_capabilities', { provider: 'meta' })
      );
      expect(disabled.data).toMatchObject({
        writes: expect.objectContaining({
          optIn: true,
          enabled: false,
          enableFlag: 'ADSTREAM_ENABLE_WRITES',
          optionalTools: expect.arrayContaining(['ads_create_campaign', 'ads_archive_ad']),
        }),
      });

      process.env.ADSTREAM_ENABLE_WRITES = 'true';
      const enabled = parseToolResponse(
        await handleAdsMcpToolCall(broker, 'ads_get_capabilities', { provider: 'meta' })
      );
      expect(enabled.data).toMatchObject({
        writes: expect.objectContaining({ enabled: true }),
      });
    } finally {
      if (previous === undefined) {
        delete process.env.ADSTREAM_ENABLE_WRITES;
      } else {
        process.env.ADSTREAM_ENABLE_WRITES = previous;
      }
    }
  });

  it('refuses write tools with a friendly error when they are turned off', async () => {
    const broker = createBrokerStub();
    const previous = process.env.ADSTREAM_ENABLE_WRITES;

    try {
      delete process.env.ADSTREAM_ENABLE_WRITES;
      const response = await handleAdsMcpToolCall(broker, 'ads_create_campaign', {
        provider: 'meta',
        accountId: 'act_123',
      });

      expect(response.isError).toBe(true);
      const parsed = parseToolResponse(response);
      expect(parsed.ok).toBe(false);
      expect(parsed.errors?.[0]).toMatchObject({
        code: 'WRITE_TOOLS_DISABLED',
        enableFlag: 'ADSTREAM_ENABLE_WRITES',
      });
      expect(parsed.errors?.[0]?.actionableFix).toContain('ADSTREAM_ENABLE_WRITES=true');
    } finally {
      if (previous === undefined) {
        delete process.env.ADSTREAM_ENABLE_WRITES;
      } else {
        process.env.ADSTREAM_ENABLE_WRITES = previous;
      }
    }
  });

  describe('destructive actions gate (ARCHIVED/DELETED)', () => {
    const ENABLE_WRITES = 'ADSTREAM_ENABLE_WRITES';
    const ENABLE_DESTRUCTIVE = 'ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS';

    function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
      const previous: Record<string, string | undefined> = {};
      for (const key of Object.keys(vars)) previous[key] = process.env[key];

      return (async () => {
        try {
          for (const [key, value] of Object.entries(vars)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
          }
          await fn();
        } finally {
          for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
          }
        }
      })();
    }

    it('blocks ads_archive_ad by default even when writes are enabled', async () => {
      await withEnv({ [ENABLE_WRITES]: 'true', [ENABLE_DESTRUCTIVE]: undefined }, async () => {
        const broker = createBrokerStub();
        const response = await handleAdsMcpToolCall(broker, 'ads_archive_ad', {
          provider: 'meta',
          adId: 'ad_123',
        });

        expect(response.isError).toBe(true);
        const parsed = parseToolResponse(response);
        expect(parsed.errors?.[0]).toMatchObject({
          code: 'DESTRUCTIVE_ACTIONS_DISABLED',
          enableFlag: ENABLE_DESTRUCTIVE,
        });
        expect(parsed.errors?.[0]?.actionableFix).toContain(`${ENABLE_DESTRUCTIVE}=true`);
      });
    });

    it('blocks ads_update_ad(status=ARCHIVED) but allows other statuses', async () => {
      await withEnv({ [ENABLE_WRITES]: 'true', [ENABLE_DESTRUCTIVE]: undefined }, async () => {
        const broker = {
          ...createBrokerStub(),
          updateAd: async () => ({
            ok: true,
            provider: 'meta' as const,
            data: {
              operation: 'update_ad',
              status: 'dry_run',
              executed: false,
              preview: {},
              success: false,
            },
          }),
        } as unknown as AdsBroker;

        const archived = await handleAdsMcpToolCall(broker, 'ads_update_ad', {
          provider: 'meta',
          adId: 'ad_123',
          status: 'ARCHIVED',
        });
        expect(parseToolResponse(archived).errors?.[0]?.code).toBe('DESTRUCTIVE_ACTIONS_DISABLED');

        const paused = await handleAdsMcpToolCall(broker, 'ads_update_ad', {
          provider: 'meta',
          adId: 'ad_123',
          status: 'PAUSED',
        });
        expect(parseToolResponse(paused).ok).toBe(true);
      });
    });

    it('blocks ads_update_campaign for ARCHIVED and DELETED alike', async () => {
      await withEnv({ [ENABLE_WRITES]: 'true', [ENABLE_DESTRUCTIVE]: undefined }, async () => {
        const broker = createBrokerStub();

        for (const status of ['ARCHIVED', 'DELETED']) {
          const response = await handleAdsMcpToolCall(broker, 'ads_update_campaign', {
            provider: 'meta',
            campaignId: 'cmp_123',
            status,
          });
          expect(parseToolResponse(response).errors?.[0]?.code).toBe(
            'DESTRUCTIVE_ACTIONS_DISABLED'
          );
        }
      });
    });

    it('allows ads_archive_ad once both flags are enabled', async () => {
      await withEnv({ [ENABLE_WRITES]: 'true', [ENABLE_DESTRUCTIVE]: 'true' }, async () => {
        const broker = {
          ...createBrokerStub(),
          archiveAd: async () => ({
            ok: true,
            provider: 'meta' as const,
            data: {
              operation: 'archive_ad',
              status: 'dry_run',
              executed: false,
              preview: { status: 'ARCHIVED' },
              success: false,
            },
          }),
        } as unknown as AdsBroker;

        const response = await handleAdsMcpToolCall(broker, 'ads_archive_ad', {
          provider: 'meta',
          adId: 'ad_123',
        });

        expect(response.isError).toBeFalsy();
        expect(parseToolResponse(response).ok).toBe(true);
      });
    });

    it('reports destructiveActions state through ads_get_capabilities', async () => {
      await withEnv({ [ENABLE_DESTRUCTIVE]: undefined }, async () => {
        const broker = createBrokerStub();
        const disabled = parseToolResponse(
          await handleAdsMcpToolCall(broker, 'ads_get_capabilities', { provider: 'meta' })
        );
        expect(disabled.data).toMatchObject({
          destructiveActions: expect.objectContaining({
            enabled: false,
            enableFlag: ENABLE_DESTRUCTIVE,
            gatedTools: expect.arrayContaining([
              'ads_archive_ad',
              'ads_update_ad',
              'ads_update_campaign',
            ]),
          }),
        });
      });

      await withEnv({ [ENABLE_DESTRUCTIVE]: 'true' }, async () => {
        const broker = createBrokerStub();
        const enabled = parseToolResponse(
          await handleAdsMcpToolCall(broker, 'ads_get_capabilities', { provider: 'meta' })
        );
        expect(enabled.data).toMatchObject({
          destructiveActions: expect.objectContaining({ enabled: true }),
        });
      });
    });
  });

  it('routes ads_get_account_performance through AdsBroker', async () => {
    let receivedRequest: AdsBrokerRequest | undefined;
    const broker = {
      ...createBrokerStub(),
      getAccountPerformance: async (request: AdsBrokerRequest) => {
        receivedRequest = request;
        return { ok: true, provider: 'meta' as const, data: [createRecord()] };
      },
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_account_performance', {
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-01-01',
      until: '2026-06-24',
    });

    expect(parseToolResponse(response).ok).toBe(true);
    expect(receivedRequest).toMatchObject({ provider: 'meta', accountId: 'act_123' });
  });

  it('routes ads_get_campaign_performance through AdsBroker', async () => {
    let receivedRequest: AdsBrokerRequest | undefined;
    const broker = {
      ...createBrokerStub(),
      getCampaignPerformance: async (request: AdsBrokerRequest) => {
        receivedRequest = request;
        return { ok: true, provider: 'meta' as const, data: [createRecord()] };
      },
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_campaign_performance', {
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { limit: 10 },
    });

    expect(parseToolResponse(response).ok).toBe(true);
    expect(receivedRequest).toMatchObject({
      provider: 'meta',
      accountId: 'act_123',
      params: { limit: 10 },
    });
  });

  it('routes ads_create_ecommerce_campaign_bundle through AdsBroker with top-level params', async () => {
    const previousEnableWrites = process.env.ADSTREAM_ENABLE_WRITES;
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    let receivedRequest: AdsBrokerRequest | undefined;
    const broker = {
      ...createBrokerStub(),
      createEcommerceCampaignBundle: async (request: AdsBrokerRequest) => {
        receivedRequest = request;
        return {
          ok: true,
          provider: 'meta' as const,
          data: {
            operation: 'create_ecommerce_campaign_bundle' as const,
            status: 'dry_run' as const,
            executed: false,
            preview: { campaign: {}, adSet: {}, creative: {}, ad: {} },
            warnings: [],
          },
        };
      },
    } as unknown as AdsBroker;

    try {
      const response = await handleAdsMcpToolCall(
        broker,
        'ads_create_ecommerce_campaign_bundle' as never,
        {
          provider: 'meta',
          accountId: 'act_123',
          campaignName: 'Sales Campaign',
          dailyBudget: 150000,
          dryRun: true,
        }
      );

      expect(parseToolResponse(response).ok).toBe(true);
      expect(receivedRequest).toMatchObject({
        provider: 'meta',
        accountId: 'act_123',
        params: { campaignName: 'Sales Campaign', dailyBudget: 150000, dryRun: true },
      });
    } finally {
      if (previousEnableWrites === undefined) {
        delete process.env.ADSTREAM_ENABLE_WRITES;
      } else {
        process.env.ADSTREAM_ENABLE_WRITES = previousEnableWrites;
      }
    }
  });

  it('routes adset/adgroup and ad performance through AdsBroker', async () => {
    const calls: string[] = [];
    const broker = {
      ...createBrokerStub(),
      getAdsetOrAdgroupPerformance: async () => {
        calls.push('adgroup');
        return { ok: true, provider: 'meta' as const, data: [createRecord()] };
      },
      getAdPerformance: async () => {
        calls.push('ad');
        return { ok: true, provider: 'meta' as const, data: [createRecord()] };
      },
    } as unknown as AdsBroker;

    await handleAdsMcpToolCall(broker, 'ads_get_adset_or_adgroup_performance', {});
    await handleAdsMcpToolCall(broker, 'ads_get_ad_performance', {});

    expect(calls).toEqual(['adgroup', 'ad']);
  });

  it('routes ads_content_matrix through AdsBroker with matrix params', async () => {
    let receivedRequest: AdsBrokerRequest | undefined;
    const broker = {
      ...createBrokerStub(),
      getContentMatrix: async (request: AdsBrokerRequest) => {
        receivedRequest = request;
        return {
          ok: true,
          provider: 'meta' as const,
          data: {
            provider: 'meta' as const,
            report_kind: 'content_matrix' as const,
            date_range: { since: '2026-05-01', until: '2026-05-07' },
            group_by: 'campaign' as const,
            sort: { metric: 'spend', direction: 'desc' as const },
            groups: [],
            coverage: { rows: 0, groups: 0, has_creative_assets: false, notes: [] },
          },
        };
      },
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_content_matrix', {
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      groupBy: 'campaign',
      sortBy: 'purchase_roas',
      topLimit: 3,
      bottomLimit: 3,
    });

    expect(parseToolResponse(response).ok).toBe(true);
    expect(receivedRequest).toMatchObject({
      provider: 'meta',
      accountId: 'act_123',
      params: { groupBy: 'campaign', sortBy: 'purchase_roas', topLimit: 3, bottomLimit: 3 },
    });
  });

  it('returns safe NOT_IMPLEMENTED for creative performance and routes report generation', async () => {
    const broker = createBrokerStub();

    const creativeResponse = parseToolResponse(
      await handleAdsMcpToolCall(broker, 'ads_get_creative_performance', {})
    );
    const reportResponse = parseToolResponse(
      await handleAdsMcpToolCall(broker, 'ads_generate_report', {})
    );

    expect(creativeResponse.errors?.[0].code).toBe('NOT_IMPLEMENTED');
    expect(reportResponse.ok).toBe(true);
    expect(reportResponse.data).toMatchObject({
      provider: 'meta',
      report_kind: 'ads',
      format: 'summary',
    });
  });

  it('returns safe invalid provider response from AdsBroker path', async () => {
    const broker = {
      ...createBrokerStub(),
      getCampaignPerformance: async () => ({
        ok: false,
        errors: [{ code: 'UNSUPPORTED_PROVIDER', message: 'Unsupported ads provider' }],
      }),
    } as unknown as AdsBroker;

    const response = parseToolResponse(
      await handleAdsMcpToolCall(broker, 'ads_get_campaign_performance', { provider: 'shopee' })
    );

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].message).toBe('Unsupported ads provider');
  });

  it('returns missing env errors without token values', async () => {
    const broker = {
      ...createBrokerStub(),
      getCampaignPerformance: async () => ({
        ok: false,
        provider: 'meta' as const,
        errors: [
          {
            provider: 'meta' as const,
            code: 'MISSING_ENV_CREDENTIALS',
            message: 'Missing credentials',
          },
        ],
      }),
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_campaign_performance', {});

    expect(response.content[0].text).toContain('MISSING_ENV_CREDENTIALS');
    expect(response.content[0].text).not.toContain('secret-token');
  });

  it('does not include raw by default and redacts token-like values in response', async () => {
    const broker = {
      ...createBrokerStub(),
      getCampaignPerformance: async () => ({
        ok: true,
        provider: 'meta' as const,
        data: [createRecord({ accessToken: 'secret-token-value' })],
        meta: { authorization: 'Bearer secret-token-value' },
      }),
    } as unknown as AdsBroker;

    const response = await handleAdsMcpToolCall(broker, 'ads_get_campaign_performance', {});

    expect(response.content[0].text).not.toContain('raw');
    expect(response.content[0].text).not.toContain('secret-token-value');
    expect(response.content[0].text).toContain('[REDACTED]');
  });

  it('redacts token-like uncaught errors', () => {
    const response = safeAdsMcpError(new Error('access_token=secret-token-value'));

    expect(response.content[0].text).not.toContain('secret-token-value');
    expect(response.content[0].text).toContain('[REDACTED]');
  });

  describe('handleAdsMcpToolCall — per-request connectionKey passthrough', () => {
    it('passes connectionKey through to AdsBrokerRequest', async () => {
      let capturedRequest: AdsBrokerRequest | undefined;
      const broker = {
        ...createBrokerStub(),
        listAccounts: async (request: AdsBrokerRequest) => {
          capturedRequest = request;
          return {
            ok: true,
            provider: 'meta',
            data: [{ account_id: 'act_123', account_name: 'Test' }],
          };
        },
      } as unknown as AdsBroker;

      const response = await handleAdsMcpToolCall(
        broker,
        'ads_list_accounts',
        {},
        'cuk_test-key-123'
      );

      expect(response.isError).toBeFalsy();
      expect(capturedRequest?.connectionKey).toBe('cuk_test-key-123');
    });

    it('passes undefined connectionKey when not provided', async () => {
      let capturedRequest: AdsBrokerRequest | undefined;
      const broker = {
        ...createBrokerStub(),
        listAccounts: async (request: AdsBrokerRequest) => {
          capturedRequest = request;
          return { ok: true, provider: 'meta', data: [] };
        },
      } as unknown as AdsBroker;

      await handleAdsMcpToolCall(broker, 'ads_list_accounts', {});
      expect(capturedRequest?.connectionKey).toBeUndefined();
    });

    it('returns a valid MCP text response contract for ads_list_accounts', async () => {
      const broker = {
        ...createBrokerStub(),
        listAccounts: async () => ({
          ok: true,
          provider: 'meta' as const,
          data: [{ account_id: 'act_123', account_name: 'Test Account' }],
        }),
      } as unknown as AdsBroker;

      const response = await handleAdsMcpToolCall(broker, 'ads_list_accounts', {});

      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0]?.type).toBe('text');
      expect(typeof response.content[0]?.text).toBe('string');
      expect(response.content[0]?.text).not.toContain('response does not match expected contract');
      expect(JSON.parse(response.content[0]!.text)).toMatchObject({ ok: true, provider: 'meta' });
    });

    it('passes OAuth auth context to remote-safe ads_list_accounts flow', async () => {
      let capturedRequest: AdsBrokerRequest | undefined;
      const broker = {
        ...createBrokerStub(),
        listAccounts: async (request: AdsBrokerRequest) => {
          capturedRequest = request;
          return { ok: true, provider: 'meta' as const, data: [] };
        },
      } as unknown as AdsBroker;

      await handleAdsMcpToolCall(broker, 'ads_list_accounts', {
        provider: 'meta',
        _oauthAuthContext: {
          authType: 'oauth_token',
          accessTokenHash: 'oauth-token-hash',
          clientId: 'client_123',
          scope: 'mcp read',
          connectionKeyId: 'ck_123',
        },
      });

      expect(capturedRequest?.connectionKey).toBeUndefined();
      expect(capturedRequest?.oauthAuthContext).toMatchObject({
        authType: 'oauth_token',
        accessTokenHash: 'oauth-token-hash',
        connectionKeyId: 'ck_123',
      });
    });

    it('toAdsBrokerRequest includes connectionKey', () => {
      const request = toAdsBrokerRequest({ provider: 'meta' }, 'cuk_key');
      expect(request.connectionKey).toBe('cuk_key');
    });

    it('toAdsBrokerRequest has undefined connectionKey when omitted', () => {
      const request = toAdsBrokerRequest({ provider: 'meta' });
      expect(request.connectionKey).toBeUndefined();
    });
  });
});
