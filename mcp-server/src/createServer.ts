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
    .enum(['meta', 'tiktok', 'google'])
    .optional()
    .describe('Ads provider. Defaults to meta when omitted.'),
  providers: z
    .array(z.enum(['meta', 'tiktok', 'google']))
    .optional()
    .describe('Multi-provider reporting input for supported read providers.'),
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

const adsPerformanceInputSchema = {
  ...sinceUntilInputSchema,
  level: z
    .enum(['account', 'campaign', 'adset', 'adgroup', 'ad', 'creative'])
    .optional()
    .describe('Normalized entity level. Defaults to campaign when omitted.'),
  metrics: z.array(z.string()).optional().describe('Normalized metric names to request when supported.'),
  dimensions: z.array(z.string()).optional().describe('Normalized dimensions to include in rows.'),
  breakdowns: z
    .array(z.string())
    .optional()
    .describe('Provider-supported breakdowns such as date, country, platform, or placement.'),
  filters: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('Explicit filters over normalized or provider-supported fields.'),
  sortBy: z.string().optional().describe('Metric or dimension used for sorting.'),
  sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction.'),
  limit: z.number().optional().describe('Maximum number of rows to return.'),
  cursor: z.string().optional().describe('Opaque pagination cursor from a previous response.'),
};

const ecommerceLaunchInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for ecommerce campaign creation.'),
  campaignName: z.string().describe('Campaign name. MVP uses OUTCOME_SALES.'),
  adSetName: z.string().describe('Ad set name.'),
  adName: z.string().describe('Ad name.'),
  pageId: z.string().describe('Meta Page ID used in object_story_spec.'),
  pixelId: z.string().describe('Meta Pixel ID for ecommerce conversion optimization.'),
  destinationUrl: z.string().describe('Product or landing page URL.'),
  dailyBudget: z.number().describe('Daily budget in account minor currency units.'),
  countries: z.array(z.string()).describe('ISO country codes, e.g. ["ID"].'),
  primaryText: z.string().describe('Primary ad text.'),
  headline: z.string().describe('Ad headline.'),
  description: z.string().optional().describe('Optional ad description.'),
  imageHash: z.string().optional().describe('Uploaded Meta image hash. Required for static creative unless imageFilePath is provided.'),
  imageFilePath: z.string().optional().describe('Local image file path. Alternative to imageHash — auto-uploads before creative creation.'),
  videoFilePath: z.string().optional().describe('Local video file path. Alternative to videoId — auto-uploads before creative creation.'),
  callToActionType: z.enum(['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER']).optional(),
  specialAdCategories: z.array(z.string()).optional().describe('Meta special ad categories.'),
  ageMin: z.number().optional(),
  ageMax: z.number().optional(),
  publisherPlatforms: z.array(z.string()).optional(),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const createCampaignInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for campaign creation.'),
  name: z.string().describe('Campaign name.'),
  objective: z.enum([
    'OUTCOME_SALES', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT',
    'OUTCOME_LEADS', 'OUTCOME_AWARENESS', 'OUTCOME_APP_PROMOTION',
    'OUTCOME_CONVERSATIONS', 'OUTCOME_RESHARES', 'OUTCOME_VALUE',
    'OUTCOME_VIDEO_VIEWS', 'OUTCOME_POST_ENGAGEMENT',
    'OUTCOME_LANDING_PAGE_VIEWS', 'OUTCOME_REACH',
    'OUTCOME_MESSAGES', 'OUTCOME_THRUPLAY',
  ]).describe('Campaign objective.'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Campaign status. Defaults to PAUSED.'),
  specialAdCategories: z.array(z.string()).optional().describe('Meta special ad categories.'),
  buyType: z.enum(['AUCTION', 'RESERVED']).optional().describe('Buying type. Defaults to AUCTION.'),
  dailyBudget: z.number().optional().describe('Daily budget in local currency minor units.'),
  lifetimeBudget: z.number().optional().describe('Lifetime budget in local currency minor units.'),
  bidStrategy: z.string().optional().describe('Bid strategy.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const createAdSetInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for ad set creation.'),
  campaignId: z.string().describe('The campaign ID to create the ad set under.'),
  name: z.string().describe('Ad set name.'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Ad set status. Defaults to PAUSED.'),
  dailyBudget: z.number().optional().describe('Daily budget in local currency minor units.'),
  lifetimeBudget: z.number().optional().describe('Lifetime budget in local currency minor units.'),
  billingEvent: z.enum(['IMPRESSIONS', 'LINK_CLICKS', 'PAGE_LIKES', 'POST_ENGAGEMENT', 'VIDEO_VIEWS', 'LEADS', 'APP_INSTALLS', 'REACH', 'VALUE', 'LANDING_PAGE_VIEWS', 'OFFSITE_CONVERSIONS']).optional().describe('Billing event. Defaults to IMPRESSIONS.'),
  optimizationGoal: z.enum(['NONE', 'APP_INSTALLS', 'CONVERSATIONS', 'ENGAGED_USERS', 'IMPRESSIONS', 'LANDING_PAGE_VIEWS', 'LEAD_GENERATION', 'LINK_CLICKS', 'OFFSITE_CONVERSIONS', 'PAGE_LIKES', 'POST_ENGAGEMENT', 'REACH', 'THRUPLAY', 'VALUE']).optional().describe('Optimization goal. Defaults to REACH.'),
  bidStrategy: z.string().optional().describe('Bid strategy. Defaults to LOWEST_COST_WITHOUT_CAP.'),
  geoLocations: z.record(z.unknown()).optional().describe('Geo targeting object with countries[], regions[], cities[].'),
  ageMin: z.number().optional().describe('Minimum age target (e.g. 18).'),
  ageMax: z.number().optional().describe('Maximum age target (e.g. 65).'),
  publisherPlatforms: z.array(z.string()).optional().describe('Publisher platforms (e.g. facebook, instagram).'),
  interests: z.array(z.record(z.unknown())).optional().describe('Interest targeting array [{ id, name }].'),
  promotedObject: z.record(z.unknown()).optional().describe('Promoted object (e.g. { pixel_id, custom_event_type }).'),
  startTime: z.string().optional().describe('Start time in ISO format.'),
  endTime: z.string().optional().describe('End time in ISO format.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
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
    const hasCampaignName = toolDefinition.inputSchema.required.includes('campaignName');
    const hasFilePath = toolDefinition.inputSchema.required.includes('filePath');
    const hasCreativeId = toolDefinition.inputSchema.required.includes('creativeId');

    let inputSchema: Record<string, z.ZodType<unknown>>;
    if (toolDefinition.name === 'ads_get_performance' || toolDefinition.name === 'ads_get_creatives') {
      inputSchema = adsPerformanceInputSchema;
    } else if (toolDefinition.name === 'ads_create_campaign') {
      inputSchema = createCampaignInputSchema;
    } else if (toolDefinition.name === 'ads_create_adset') {
      inputSchema = createAdSetInputSchema;
    } else if (hasCampaignName) {
      inputSchema = ecommerceLaunchInputSchema;
    } else if (hasCampaignId) {
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
    } else if (hasFilePath) {
      inputSchema = {
        ...adsBaseInputSchema,
        filePath: z.string().describe('Absolute path to the local file to upload. Example: /Users/name/Downloads/ad-image.jpg'),
        title: z.string().optional().describe('Optional title for video uploads.'),
        description: z.string().optional().describe('Optional description for video uploads.'),
      };
    } else if (hasCreativeId) {
      inputSchema = {
        ...adsBaseInputSchema,
        creativeId: z.string().describe('The creative ID to generate a preview for.'),
        adFormat: z
          .enum([
            'DESKTOP_FEED',
            'MOBILE_FEED',
            'INSTAGRAM_FEED',
            'INSTAGRAM_EXPLORE',
            'INSTAGRAM_REELS',
            'INSTAGRAM_STORIES',
            'FACEBOOK_STORIES',
            'MESSENGER_INBOX',
            'MARKETPLACE',
            'REWARDS_PLATFORM',
            'FACEBOOK_REELS',
          ])
          .describe('The ad format/platform to preview on.'),
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
