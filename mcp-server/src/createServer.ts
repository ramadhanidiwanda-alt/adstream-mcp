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
  generateDailyReport,
  RuleEngine,
  allRuleTemplates,
  ADS_MCP_TOOL_DEFINITIONS,
  createDefaultAdsBroker,
  createAdsBrokerFromConfig,
  handleAdsMcpToolCall,
  isAdsMcpToolName,
  parseBrokerConfigFromEnv,
  safeAdsMcpError,
} from 'meta-ads-agent-skill';

export interface CreateMetaAdsMcpServerOptions {
  client?: MetaClient;
  config?: MetaConfig;
  adsBroker?: ReturnType<typeof createDefaultAdsBroker>;
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
    .describe('Optional provider-safe parameters such as limit.'),
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
};

export function createMetaAdsMcpServer(
  options: CreateMetaAdsMcpServerOptions = {}
): McpServer {
  const server = new McpServer(
    {
      name: 'meta-ads-mcp-server',
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

  const adsBroker = options.adsBroker ?? createAdsBrokerFromConfig(brokerConfig);

  for (const toolDefinition of ADS_MCP_TOOL_DEFINITIONS) {
    server.registerTool(
      toolDefinition.name,
      {
        description: toolDefinition.description,
        inputSchema: toolDefinition.inputSchema.required.includes('since')
          ? sinceUntilInputSchema
          : adsBaseInputSchema,
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

  server.registerTool(
    'meta_get_ad_accounts',
    {
      description: 'Fetch all Meta ad accounts accessible by the access token',
      inputSchema: {},
    },
    async () => handleLegacyMetaToolCall('meta_get_ad_accounts', {}, { isRemoteBrokerMode, client, config })
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

  return server;
}

async function handleLegacyMetaToolCall(
  name: string,
  args: ToolArguments,
  context: {
    isRemoteBrokerMode: boolean;
    client?: MetaClient;
    config?: MetaConfig;
  }
) {
  try {
    if (isAdsMcpToolName(name)) {
      throw new Error(`Unexpected ads tool in legacy handler: ${name}`);
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
        });
        return asTextContent(insights);
      }

      case 'meta_get_adset_insights': {
        const insights = await getAdsetInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
        });
        return asTextContent(insights);
      }

      case 'meta_get_ads_insights': {
        const insights = await getAdsInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
        });
        return asTextContent(insights);
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
