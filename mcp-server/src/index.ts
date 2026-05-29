#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
} from 'meta-ads-agent-skill';

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

// Initialize Meta client
let client: MetaClient;
let config: any;

try {
  config = loadConfig();
  client = new MetaClient(config);
} catch (error) {
  console.error('Failed to initialize Meta client:', error);
  process.exit(1);
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
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
          adAccountId: args.adAccountId || config.adAccountId,
          limit: args.limit,
          status: args.status,
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
          adAccountId: args.adAccountId || config.adAccountId,
          since: args.since,
          until: args.until,
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
          adAccountId: args.adAccountId || config.adAccountId,
          since: args.since,
          until: args.until,
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
          adAccountId: args.adAccountId || config.adAccountId,
          since: args.since,
          until: args.until,
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
          adAccountId: args.adAccountId || config.adAccountId,
          since: args.since,
          until: args.until,
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
          adAccountId: args.adAccountId || config.adAccountId,
          since: args.since,
          until: args.until,
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
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Meta Ads MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
