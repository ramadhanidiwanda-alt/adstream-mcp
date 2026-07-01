import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  MetaClient,
  loadConfig,
  type MetaConfig,
  getAdAccounts,
  getCampaigns,
  getCampaignInsights,
  getAdsetInsights,
  getAdsInsights,
  getLocationInsights,
  generateDailyReport,
  RuleEngine,
  allRuleTemplates,
  ADS_MCP_TOOL_DEFINITIONS,
  COMMERCE_MCP_TOOL_DEFINITIONS,
  createDefaultAdsBroker,
  createAdsBrokerFromConfig,
  handleAdsMcpToolCall,
  handleCommerceMcpToolCall,
  isAdsMcpToolName,
  parseBrokerConfigFromEnv,
  safeAdsMcpError,
  assertLocationBreakdowns,
  TikTokApiClient,
  getTikTokReport,
  getGmvMaxReport,
  getTikTokAdvertisers,
  getTikTokLocationInsights,
  } from 'adstream-mcp';
import type { LocationBreakdown } from 'adstream-mcp';

export interface CreateMetaAdsMcpServerOptions {
  client?: MetaClient;
  config?: MetaConfig;
  adsBroker?: ReturnType<typeof createDefaultAdsBroker>;
  tiktokClient?: TikTokApiClient;
}

type ToolArguments = {
  provider?: string;
  providers?: string[];
  accountId?: string;
  params?: Record<string, unknown>;
  adAccountId?: string;
  since?: string;
  until?: string;
  status?: string[];
  limit?: number;
  level?: 'campaign' | 'adset' | 'ad';
  breakdowns?: unknown;
  category?: string;
};

const adsBaseInputSchema = {
  provider: z
    .enum(['meta', 'tiktok'])
    .optional()
    .describe('Ads provider. Defaults to meta when omitted.'),
  providers: z
    .array(z.enum(['meta', 'tiktok']))
    .optional()
    .describe('Future multi-provider reporting input. Multiple providers return NOT_IMPLEMENTED for now.'),
  accountId: z
    .string()
    .optional()
    .describe('Provider account id. Optional when credentials include a default account.'),
  since: z.string().optional().describe('Start date in YYYY-MM-DD format.'),
  until: z.string().optional().describe('End date in YYYY-MM-DD format.'),
  params: z
    .record(z.unknown())
    .optional()
    .describe('Optional provider-safe parameters such as limit and breakdowns.'),
};

const sinceUntilInputSchema = {
  ...adsBaseInputSchema,
  since: z.string().describe('Start date in YYYY-MM-DD format.'),
  until: z.string().describe('End date in YYYY-MM-DD format.'),
};

const legacyAdAccountId = z
  .string()
  .describe('Ad account ID (e.g., act_123456789)');

const legacyDateRangeInputSchema = {
  adAccountId: legacyAdAccountId,
  since: z.string().describe('Start date in YYYY-MM-DD format'),
  until: z.string().describe('End date in YYYY-MM-DD format'),
  breakdowns: z
    .array(z.enum(['country', 'region', 'dma']))
    .optional()
    .describe('Optional location breakdowns. Supported: country, region, dma.'),
};

const locationBreakdownSchema = z
  .array(z.enum(['country', 'region', 'dma']))
  .min(1)
  .describe('Location breakdowns to apply. Supported: country, region, dma.');

const legacyLocationBreakdownInputSchema = {
  ...legacyDateRangeInputSchema,
  adAccountId: z.string().optional().describe('Ad account ID (optional, uses env META_AD_ACCOUNT_ID if omitted)'),
  level: z.enum(['campaign', 'adset', 'ad']).describe('Insight level to fetch.'),
  breakdowns: locationBreakdownSchema,
  limit: z.number().optional().describe('Maximum number of insight rows to fetch (default: 100)'),
};

const legacyLocationInsightsInputSchema = {
  ...legacyLocationBreakdownInputSchema,
  adAccountId: z.string().optional().describe('Ad account ID (optional, uses env META_AD_ACCOUNT_ID if omitted)'),
  sortBy: z.enum(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm']).optional().describe('Sort top locations by metric (default: spend)'),
  sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: desc)'),
  minSpend: z.number().optional().describe('Minimum location spend filter'),
  minClicks: z.number().optional().describe('Minimum location clicks filter'),
};

export function createMetaAdsMcpServer(
  options: CreateMetaAdsMcpServerOptions = {}
): McpServer {
  const server = new McpServer(
    {
      name: 'adstream-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const brokerConfig = parseBrokerConfigFromEnv();
  const isRemoteBrokerMode = brokerConfig.mode === 'remote';
  const config = isRemoteBrokerMode ? options.config : options.config ?? loadConfig();
  let client = options.client;

  if (!isRemoteBrokerMode && !client) {
    client = new MetaClient(options.config ?? loadConfig());
  }

  // TikTok client — from env if not provided explicitly
  let tiktokClient = options.tiktokClient;
  if (!tiktokClient && process.env.TIKTOK_ACCESS_TOKEN) {
    tiktokClient = new TikTokApiClient({
      accessToken: process.env.TIKTOK_ACCESS_TOKEN,
      apiVersion: process.env.TIKTOK_API_VERSION,
    });
  }

  const adsBroker = options.adsBroker ?? createAdsBrokerFromConfig(brokerConfig);

  for (const toolDefinition of ADS_MCP_TOOL_DEFINITIONS) {
    const hasSince = toolDefinition.inputSchema.required.includes('since');
    const hasCampaignId = toolDefinition.inputSchema.required.includes('campaignId');

    let inputSchema: Record<string, z.ZodType<unknown>>;
    if (hasCampaignId) {
      const base = hasSince ? sinceUntilInputSchema : adsBaseInputSchema;
      const requiresBudget = toolDefinition.inputSchema.required.includes('dailyBudget');
      const requiresNewName = toolDefinition.inputSchema.required.includes('newName');

      inputSchema = {
        ...base,
        campaignId: z.string().describe('The campaign ID to mutate (e.g. 120248446250030168)'),
        dailyBudget: requiresBudget
          ? z.number().describe('New daily budget (e.g. 50000 for Rp50,000)')
          : z.number().optional().describe('New daily budget (e.g. 50000 for Rp50,000)'),
        newName: requiresNewName
          ? z.string().describe('New campaign name')
          : z.string().optional().describe('New campaign name'),
      };
    } else if (hasSince) {
      inputSchema = sinceUntilInputSchema;
    } else {
      inputSchema = adsBaseInputSchema;
    }

    server.registerTool(
      toolDefinition.name,
      {
        description: toolDefinition.description,
        inputSchema,
      },
      async (args: Record<string, unknown>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        const connectionKey = extra.authInfo?.extra?.connectionKey as string | undefined;
        const oauthAuthContext = extra.authInfo?.extra?.oauthAuthContext;
        // Pass oauth context through params for oauth_token mode
        const toolArgs = args ?? {};
        if (oauthAuthContext && !connectionKey) {
          (toolArgs as Record<string, unknown>)._oauthAuthContext = oauthAuthContext;
        }
        return handleAdsMcpToolCall(adsBroker, toolDefinition.name, toolArgs, connectionKey);
      }
    );
  }

  for (const toolDefinition of COMMERCE_MCP_TOOL_DEFINITIONS) {
    server.registerTool(
      toolDefinition.name,
      {
        description: toolDefinition.description,
        inputSchema: {
          provider: z.enum(['tiktok_gmv']).describe('Commerce provider. Only tiktok_gmv is supported today.'),
          accountId: z.string().describe('Provider account or advertiser id.'),
          storeIds: z.array(z.string()).describe('Commerce store ids to query.'),
          since: z.string().describe('Start date in YYYY-MM-DD format.'),
          until: z.string().describe('End date in YYYY-MM-DD format.'),
          dimensions: z.array(z.string()).optional().describe('Provider dimensions to request.'),
          metrics: z.array(z.string()).optional().describe('Provider metrics to request.'),
          params: z.record(z.unknown()).optional().describe('Optional provider-safe parameters.'),
        },
      },
      async (args: Record<string, unknown>) => handleCommerceMcpToolCall(toolDefinition.name, args ?? {}, {
        fetchGmvMaxReport: tiktokClient
          ? (options) => getGmvMaxReport(tiktokClient, options)
          : undefined,
      })
    );
  }

  server.registerTool(
    'meta_get_ad_accounts',
    {
      description: 'Fetch all Meta ad accounts accessible by the access token',
      inputSchema: {},
    },
    async (args: ToolArguments, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) =>
      handleLegacyMetaToolCall('meta_get_ad_accounts', args ?? {}, { isRemoteBrokerMode, client, config, adsBroker, extra })
  );

  server.registerTool(
    'meta_get_campaigns',
    {
      description: 'Fetch campaigns from a Meta ad account with optional filters',
      inputSchema: {
        adAccountId: legacyAdAccountId,
        limit: z.number().optional().describe('Maximum number of campaigns to fetch (default: 50)'),
        status: z
          .array(z.string())
          .optional()
          .describe('Filter by campaign status (e.g., ["ACTIVE", "PAUSED"])'),
      },
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_get_campaigns', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_get_campaign_insights',
    {
      description: 'Fetch campaign-level performance insights for a date range',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_get_campaign_insights', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_get_adset_insights',
    {
      description: 'Fetch adset-level performance insights for a date range',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_get_adset_insights', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_get_ads_insights',
    {
      description: 'Fetch ad-level performance insights for a date range',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_get_ads_insights', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_get_insights_by_breakdown',
    {
      description: 'Fetch Meta Ads insights by supported location breakdowns (country, region, dma)',
      inputSchema: legacyLocationBreakdownInputSchema,
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_get_insights_by_breakdown', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_get_location_insights',
    {
      description: 'Fetch Meta Ads insights grouped and ranked by location (country, region, dma) with totals',
      inputSchema: legacyLocationInsightsInputSchema,
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_get_location_insights', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_generate_daily_report',
    {
      description: 'Generate comprehensive daily performance report with analysis',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_generate_daily_report', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_analyze_with_rules',
    {
      description: 'Analyze campaign insights using 26 pre-built rule templates',
      inputSchema: {
        ...legacyDateRangeInputSchema,
        category: z
          .enum(['ecommerce', 'leadgen', 'brand', 'general', 'all'])
          .optional()
          .describe('Rule category to apply (default: all)'),
      },
    },
    async (args: ToolArguments) => handleLegacyMetaToolCall('meta_analyze_with_rules', args, { isRemoteBrokerMode, client, config })
  );

  // ── TikTok Ads tools ──

  server.registerTool(
    'tiktok_list_advertisers',
    {
      description: 'List TikTok advertiser accounts accessible by the access token',
      inputSchema: {},
    },
    async () => handleTikTokToolCall('tiktok_list_advertisers', {}, tiktokClient)
  );

  server.registerTool(
    'tiktok_get_report',
    {
      description: 'Fetch a synchronous TikTok Ads report (campaign, adgroup, or ad level)',
      inputSchema: {
        advertiserId: z.string().describe('TikTok advertiser ID'),
        reportType: z.string().optional().default('BASIC').describe('Report type (default: BASIC)'),
        dimensions: z.array(z.string()).describe('Dimension fields (e.g., [\"campaign_id\"])'),
        metrics: z.array(z.string()).describe('Metric fields (e.g., [\"spend\", \"impressions\"])'),
        dataLevel: z.enum(['AUCTION_CAMPAIGN', 'AUCTION_ADGROUP', 'AUCTION_AD']).describe('Data aggregation level'),
        startDate: z.string().optional().describe('Start date YYYY-MM-DD'),
        endDate: z.string().optional().describe('End date YYYY-MM-DD'),
        page: z.number().optional().describe('Page number (default: 1)'),
        pageSize: z.number().optional().describe('Page size (default: 100)'),
      },
    },
    async (args: Record<string, unknown>) => handleTikTokToolCall('tiktok_get_report', args, tiktokClient)
  );

  server.registerTool(
    'tiktok_get_gmv_max_report',
    {
      description: 'Fetch a GMV Max report from TikTok Shop Ads',
      inputSchema: {
        advertiserId: z.string().describe('TikTok advertiser ID'),
        storeIds: z.array(z.string()).describe('Store IDs (1-3 stores)'),
        dimensions: z.array(z.string()).describe('Dimension fields'),
        metrics: z.array(z.string()).describe('Metric fields'),
        startDate: z.string().describe('Start date YYYY-MM-DD'),
        endDate: z.string().describe('End date YYYY-MM-DD'),
        page: z.number().optional().describe('Page number (default: 1)'),
        pageSize: z.number().optional().describe('Page size (default: 100)'),
      },
    },
    async (args: Record<string, unknown>) => handleTikTokToolCall('tiktok_get_gmv_max_report', args, tiktokClient)
  );

  server.registerTool(
    'tiktok_get_location_insights',
    {
      description: 'Fetch TikTok Ads insights grouped by location (country, province, city) with totals and ranking',
      inputSchema: {
        advertiserId: z.string().describe('TikTok advertiser ID'),
        breakdowns: z.array(z.enum(['country', 'province', 'city'])).describe('Location breakdown dimensions (e.g., ["country"])'),
        dataLevel: z.enum(['AUCTION_CAMPAIGN', 'AUCTION_ADGROUP', 'AUCTION_AD']).optional().describe('Data level (default: AUCTION_CAMPAIGN)'),
        startDate: z.string().optional().describe('Start date YYYY-MM-DD'),
        endDate: z.string().optional().describe('End date YYYY-MM-DD'),
        sortBy: z.enum(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm']).optional().describe('Sort metric (default: spend)'),
        sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: desc)'),
        limit: z.number().optional().describe('Max locations (default: 50)'),
      },
    },
    async (args: Record<string, unknown>) => handleTikTokToolCall('tiktok_get_location_insights', args, tiktokClient)
  );

  return server;
}

async function handleLegacyMetaToolCall(
  name: string,
  args: ToolArguments,
  context: {
    isRemoteBrokerMode: boolean;
    client?: MetaClient;
    config?: MetaConfig;
    adsBroker?: ReturnType<typeof createDefaultAdsBroker>;
    extra?: RequestHandlerExtra<ServerRequest, ServerNotification>;
  }
) {
  try {
    if (isAdsMcpToolName(name)) {
      throw new Error(`Unexpected ads tool in legacy handler: ${name}`);
    }

    if (context.isRemoteBrokerMode && name === 'meta_get_ad_accounts' && context.adsBroker) {
      const toolArgs: Record<string, unknown> = {
        provider: 'meta',
        params: typeof args.limit === 'number' ? { limit: args.limit } : {},
      };
      const connectionKey = context.extra?.authInfo?.extra?.connectionKey as string | undefined;
      const oauthAuthContext = context.extra?.authInfo?.extra?.oauthAuthContext;
      if (oauthAuthContext && !connectionKey) {
        toolArgs._oauthAuthContext = oauthAuthContext;
      }
      return handleAdsMcpToolCall(context.adsBroker, 'ads_list_accounts', toolArgs, connectionKey);
    }

    if (context.isRemoteBrokerMode) {
      return legacyMetaToolUnavailableInRemoteMode();
    }

    if (!context.client || !context.config) {
      throw new Error('Legacy meta_* tools require local META_* env');
    }

    switch (name) {
      case 'meta_get_ad_accounts': {
        const accounts = await getAdAccounts(context.client);
        return asTextContent(accounts);
      }

      case 'meta_get_campaigns': {
        const campaigns = await getCampaigns(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          limit: args.limit,
        });
        return asTextContent(campaigns);
      }

      case 'meta_get_campaign_insights': {
        const insights = await getCampaignInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        });
        return asTextContent(insights);
      }

      case 'meta_get_adset_insights': {
        const insights = await getAdsetInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        });
        return asTextContent(insights);
      }

      case 'meta_get_ads_insights': {
        const insights = await getAdsInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        });
        return asTextContent(insights);
      }

      case 'meta_get_insights_by_breakdown': {
        const options = {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          limit: args.limit,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        };

        if (args.level === 'campaign') {
          return asTextContent(await getCampaignInsights(context.client, options));
        }

        if (args.level === 'adset') {
          return asTextContent(await getAdsetInsights(context.client, options));
        }

        return asTextContent(await getAdsInsights(context.client, options));
      }

      case 'meta_get_location_insights': {
        const summary = await getLocationInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          level: (args.level as 'campaign' | 'adset' | 'ad') ?? 'campaign',
          breakdowns: assertLocationBreakdowns(args.breakdowns) as LocationBreakdown[] | undefined,
          sortBy: args.sortBy as 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'cpm' | undefined,
          sortDirection: args.sortDirection as 'asc' | 'desc' | undefined,
          minSpend: typeof args.minSpend === 'number' ? args.minSpend : undefined,
          minClicks: typeof args.minClicks === 'number' ? args.minClicks : undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        });
        return asTextContent(summary);
      }

      case 'meta_generate_daily_report': {
        const report = await generateDailyReport(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
        });
        return asTextContent(report);
      }

      case 'meta_analyze_with_rules': {
        const insights = await getCampaignInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
        });

        const engine = new RuleEngine();
        const results = engine.applyRulesToInsights(insights, allRuleTemplates);

        return asTextContent(results);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return safeAdsMcpError(error);
  }
}

function asTextContent(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function legacyMetaToolUnavailableInRemoteMode() {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            ok: false,
            error: {
              code: 'LEGACY_META_TOOLS_UNAVAILABLE_IN_REMOTE_MODE',
              message: 'Legacy meta_* tools require local META_* env',
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleTikTokToolCall(
  name: string,
  args: Record<string, unknown>,
  tiktokClient?: TikTokApiClient
) {
  try {
    if (!tiktokClient) {
      return asTextContent({
        ok: false,
        error: {
          code: 'TIKTOK_CLIENT_NOT_CONFIGURED',
          message: 'Set TIKTOK_ACCESS_TOKEN env to use TikTok tools',
        },
      });
    }

    switch (name) {
      case 'tiktok_list_advertisers': {
        const advertisers = await getTikTokAdvertisers(tiktokClient);
        return asTextContent(advertisers);
      }

      case 'tiktok_get_report': {
        const report = await getTikTokReport(tiktokClient, {
          advertiserId: args.advertiserId as string,
          reportType: (args.reportType as string) ?? 'BASIC',
          dimensions: args.dimensions as string[],
          metrics: args.metrics as string[],
          dataLevel: args.dataLevel as 'AUCTION_CAMPAIGN' | 'AUCTION_ADGROUP' | 'AUCTION_AD',
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          page: typeof args.page === 'number' ? args.page : undefined,
          pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
        });
        return asTextContent(report);
      }

      case 'tiktok_get_gmv_max_report': {
        const report = await getGmvMaxReport(tiktokClient, {
          advertiserId: args.advertiserId as string,
          storeIds: args.storeIds as string[],
          dimensions: args.dimensions as string[],
          metrics: args.metrics as string[],
          startDate: args.startDate as string,
          endDate: args.endDate as string,
          page: typeof args.page === 'number' ? args.page : undefined,
          pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
        });
        return asTextContent(report);
      }

      case 'tiktok_get_location_insights': {
        const summary = await getTikTokLocationInsights(tiktokClient, {
          advertiserId: args.advertiserId as string,
          breakdowns: (args.breakdowns as 'country' | 'province' | 'city'[]) ?? ['country'],
          dataLevel: args.dataLevel as 'AUCTION_CAMPAIGN' | 'AUCTION_ADGROUP' | 'AUCTION_AD' | undefined,
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          sortBy: args.sortBy as 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'cpm' | undefined,
          sortDirection: args.sortDirection as 'asc' | 'desc' | undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        });
        return asTextContent(summary);
      }

      default:
        throw new Error(`Unknown TikTok tool: ${name}`);
    }
  } catch (error) {
    return safeAdsMcpError(error);
  }
}
