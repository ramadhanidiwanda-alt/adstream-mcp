import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  MetaClient,
  loadConfig,
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
  handleAdsMcpToolCall,
  isAdsMcpToolName,
  safeAdsMcpError,
} from 'meta-ads-agent-skill';

export interface CreateMetaAdsMcpServerOptions {
  client?: MetaClient;
  config?: { adAccountId?: string };
  adsBroker?: ReturnType<typeof createDefaultAdsBroker>;
}

export function createMetaAdsMcpServer(
  options: CreateMetaAdsMcpServerOptions = {}
): Server {
  const server = new Server(
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

  const config = options.config ?? loadConfig();
  const client = options.client ?? new MetaClient(config);
  const adsBroker = options.adsBroker ?? createDefaultAdsBroker();

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...ADS_MCP_TOOL_DEFINITIONS,
        {
          name: 'meta_get_ad_accounts',
          description: 'Fetch all Meta ad accounts accessible by the access token',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'meta_get_campaigns',
          description: 'Fetch campaigns from a Meta ad account with optional filters',
          inputSchema: {
            type: 'object',
            properties: {
              adAccountId: {
                type: 'string',
                description: 'Ad account ID (e.g., act_123456789)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of campaigns to fetch (default: 50)',
              },
              status: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by campaign status (e.g., ["ACTIVE", "PAUSED"])',
              },
            },
            required: ['adAccountId'],
          },
        },
        {
          name: 'meta_get_campaign_insights',
          description: 'Fetch campaign-level performance insights for a date range',
          inputSchema: {
            type: 'object',
            properties: {
              adAccountId: {
                type: 'string',
                description: 'Ad account ID (e.g., act_123456789)',
              },
              since: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              until: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
            },
            required: ['adAccountId', 'since', 'until'],
          },
        },
        {
          name: 'meta_get_adset_insights',
          description: 'Fetch adset-level performance insights for a date range',
          inputSchema: {
            type: 'object',
            properties: {
              adAccountId: {
                type: 'string',
                description: 'Ad account ID (e.g., act_123456789)',
              },
              since: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              until: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
            },
            required: ['adAccountId', 'since', 'until'],
          },
        },
        {
          name: 'meta_get_ads_insights',
          description: 'Fetch ad-level performance insights for a date range',
          inputSchema: {
            type: 'object',
            properties: {
              adAccountId: {
                type: 'string',
                description: 'Ad account ID (e.g., act_123456789)',
              },
              since: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              until: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
            },
            required: ['adAccountId', 'since', 'until'],
          },
        },
        {
          name: 'meta_generate_daily_report',
          description: 'Generate comprehensive daily performance report with analysis',
          inputSchema: {
            type: 'object',
            properties: {
              adAccountId: {
                type: 'string',
                description: 'Ad account ID (e.g., act_123456789)',
              },
              since: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              until: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
            },
            required: ['adAccountId', 'since', 'until'],
          },
        },
        {
          name: 'meta_analyze_with_rules',
          description: 'Analyze campaign insights using 26 pre-built rule templates',
          inputSchema: {
            type: 'object',
            properties: {
              adAccountId: {
                type: 'string',
                description: 'Ad account ID (e.g., act_123456789)',
              },
              since: {
                type: 'string',
                description: 'Start date in YYYY-MM-DD format',
              },
              until: {
                type: 'string',
                description: 'End date in YYYY-MM-DD format',
              },
              category: {
                type: 'string',
                enum: ['ecommerce', 'leadgen', 'brand', 'general', 'all'],
                description: 'Rule category to apply (default: all)',
              },
            },
            required: ['adAccountId', 'since', 'until'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as {
      adAccountId?: string;
      since?: string;
      until?: string;
      status?: string;
      limit?: number;
      category?: string;
    };

    try {
      if (isAdsMcpToolName(name)) {
        return await handleAdsMcpToolCall(adsBroker, name, args ?? {});
      }

      switch (name) {
        case 'meta_get_ad_accounts': {
          const accounts = await getAdAccounts(client);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(accounts, null, 2),
              },
            ],
          };
        }

        case 'meta_get_campaigns': {
          const campaigns = await getCampaigns(client, {
            adAccountId: (args.adAccountId || config.adAccountId) as string,
            limit: args.limit,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(campaigns, null, 2),
              },
            ],
          };
        }

        case 'meta_get_campaign_insights': {
          const insights = await getCampaignInsights(client, {
            adAccountId: (args.adAccountId || config.adAccountId) as string,
            since: args.since as string,
            until: args.until as string,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(insights, null, 2),
              },
            ],
          };
        }

        case 'meta_get_adset_insights': {
          const insights = await getAdsetInsights(client, {
            adAccountId: (args.adAccountId || config.adAccountId) as string,
            since: args.since as string,
            until: args.until as string,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(insights, null, 2),
              },
            ],
          };
        }

        case 'meta_get_ads_insights': {
          const insights = await getAdsInsights(client, {
            adAccountId: (args.adAccountId || config.adAccountId) as string,
            since: args.since as string,
            until: args.until as string,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(insights, null, 2),
              },
            ],
          };
        }

        case 'meta_generate_daily_report': {
          const report = await generateDailyReport(client, {
            adAccountId: (args.adAccountId || config.adAccountId) as string,
            since: args.since as string,
            until: args.until as string,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(report, null, 2),
              },
            ],
          };
        }

        case 'meta_analyze_with_rules': {
          const insights = await getCampaignInsights(client, {
            adAccountId: (args.adAccountId || config.adAccountId) as string,
            since: args.since as string,
            until: args.until as string,
          });

          const engine = new RuleEngine();
          const results = engine.applyRulesToInsights(insights, allRuleTemplates);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return safeAdsMcpError(error);
    }
  });

  return server;
}
