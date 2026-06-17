import type { AdsBroker } from './AdsBroker.js';
import type { AdsBrokerRequest, AdsBrokerResponse, AdsMetricRecord, AdsMutationResult, AdsProviderId } from './types.js';
import { isAdsProviderId } from './types.js';
import { redactErrorMessage, redactTokenLikeValues } from './credentials.js';

export const ADS_MCP_TOOL_NAMES = [
  'ads_list_accounts',
  'ads_list_campaigns',
  'ads_get_account_performance',
  'ads_get_campaign_performance',
  'ads_get_adset_or_adgroup_performance',
  'ads_get_ad_performance',
  'ads_get_creative_performance',
  'ads_get_placement_performance',
  'ads_generate_report',
  // --- Write operations ---
  'ads_pause_campaign',
  'ads_resume_campaign',
  'ads_update_campaign_budget',
  'ads_rename_campaign',
] as const;

export type AdsMcpToolName = (typeof ADS_MCP_TOOL_NAMES)[number];

export const ADS_MCP_TOOL_DEFINITIONS = [
  {
    name: 'ads_list_accounts',
    description: 'List ads accounts through the AdsBroker',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_campaigns',
    description: 'List campaigns under an ad account through the AdsBroker',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_account_performance',
    description: 'Fetch normalized account-level performance through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_campaign_performance',
    description: 'Fetch normalized campaign performance through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_adset_or_adgroup_performance',
    description: 'Fetch normalized ad set or ad group performance through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_ad_performance',
    description: 'Fetch normalized ad performance through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_creative_performance',
    description: 'Fetch normalized creative performance through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_placement_performance',
    description: 'Fetch platform and placement performance through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_generate_report',
    description: 'Generate an ads report through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  // --- Write operations ---
  {
    name: 'ads_pause_campaign',
    description: 'Pause a campaign. Returns success/error. Use with caution — campaign will stop spending.',
    inputSchema: createWriteInputSchema(['campaignId']),
  },
  {
    name: 'ads_resume_campaign',
    description: 'Resume a paused campaign. Returns success/error.',
    inputSchema: createWriteInputSchema(['campaignId']),
  },
  {
    name: 'ads_update_campaign_budget',
    description: 'Update a campaign\'s daily budget (in local currency minor units). Safety guard: rejects increases >200% by default.',
    inputSchema: createWriteInputSchema(['campaignId', 'dailyBudget']),
  },
  {
    name: 'ads_rename_campaign',
    description: 'Rename a campaign. Returns success/error.',
    inputSchema: createWriteInputSchema(['campaignId', 'newName']),
  },
] as const;

export function isAdsMcpToolName(name: string): name is AdsMcpToolName {
  return ADS_MCP_TOOL_NAMES.includes(name as AdsMcpToolName);
}

export async function handleAdsMcpToolCall(
  broker: AdsBroker,
  name: AdsMcpToolName,
  args: Record<string, unknown> = {},
  connectionKey?: string
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const request = toAdsBrokerRequest(args, connectionKey);
  const response = await callBrokerMethod(broker, name, request);
  const safeResponse = stripRawFromResponse(redactTokenLikeValues(response)) as AdsBrokerResponse;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(safeResponse, null, 2),
      },
    ],
    isError: !safeResponse.ok || undefined,
  };
}

function stripRawFromResponse<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripRawFromResponse(item)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => key !== 'raw')
      .map(([key, entryValue]) => [key, stripRawFromResponse(entryValue)]);

    return Object.fromEntries(entries) as T;
  }

  return value;
}

export function toAdsBrokerRequest(args: Record<string, unknown>, connectionKey?: string): AdsBrokerRequest {
  // Extract oauth auth context if present (set by createServer.ts from extra.authInfo)
  const oauthAuthContext = (args._oauthAuthContext as AdsBrokerRequest['oauthAuthContext']) ?? undefined;

  return {
    provider: parseProvider(args.provider),
    providers: parseProviders(args.providers),
    accountId: typeof args.accountId === 'string' ? args.accountId : undefined,
    since: typeof args.since === 'string' ? args.since : undefined,
    until: typeof args.until === 'string' ? args.until : undefined,
    params: isPlainObject(args.params) ? args.params : {},
    connectionKey,
    oauthAuthContext,
  };
}

function callBrokerMethod(
  broker: AdsBroker,
  name: AdsMcpToolName,
  request: AdsBrokerRequest
): Promise<AdsBrokerResponse<AdsMetricRecord[] | AdsMutationResult | unknown>> {
  switch (name) {
    case 'ads_list_accounts':
      return broker.listAccounts(request);
    case 'ads_list_campaigns':
      return broker.listCampaigns(request);
    case 'ads_get_account_performance':
      return broker.getAccountPerformance(request);
    case 'ads_get_campaign_performance':
      return broker.getCampaignPerformance(request);
    case 'ads_get_adset_or_adgroup_performance':
      return broker.getAdsetOrAdgroupPerformance(request);
    case 'ads_get_ad_performance':
      return broker.getAdPerformance(request);
    case 'ads_get_creative_performance':
      return broker.getCreativePerformance(request);
    case 'ads_get_placement_performance':
      return broker.getPlacementPerformance(request);
    case 'ads_generate_report':
      return broker.generateReport(request);
    // --- Write operations ---
    case 'ads_pause_campaign':
      return broker.pauseCampaign(request);
    case 'ads_resume_campaign':
      return broker.resumeCampaign(request);
    case 'ads_update_campaign_budget':
      return broker.updateCampaignBudget(request);
    case 'ads_rename_campaign':
      return broker.renameCampaign(request);
  }
}

function createWriteInputSchema(required: string[]) {
  const schema = createAdsInputSchema([]);
  const writeProperties: Record<string, unknown> = {
    campaignId: {
      type: 'string',
      description: 'The campaign ID to mutate (e.g. 120248446250030168)',
    },
    dailyBudget: {
      type: 'number',
      description: 'New daily budget in local currency minor units (e.g. 50000 for Rp50,000)',
    },
    newName: {
      type: 'string',
      description: 'New campaign name',
    },
  };

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      ...writeProperties,
    },
    required,
  };
}

function parseProvider(provider: unknown): AdsProviderId | undefined {
  if (provider === undefined) {
    return undefined;
  }

  if (isAdsProviderId(provider)) {
    return provider;
  }

  return provider as never;
}

function parseProviders(providers: unknown): AdsProviderId[] | undefined {
  if (!Array.isArray(providers)) {
    return undefined;
  }

  return providers.map((provider) => (isAdsProviderId(provider) ? provider : (provider as never)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createAdsInputSchema(required: string[]) {
  return {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['meta', 'tiktok'],
        description: 'Ads provider. Defaults to meta when omitted.',
      },
      providers: {
        type: 'array',
        items: { type: 'string', enum: ['meta', 'tiktok'] },
        description: 'Future multi-provider reporting input. Multiple providers return NOT_IMPLEMENTED for now.',
      },
      accountId: {
        type: 'string',
        description: 'Provider account id. Optional when credentials include a default account.',
      },
      since: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format.',
      },
      until: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format.',
      },
      params: {
        type: 'object',
        description: 'Optional provider-safe parameters such as limit and breakdowns.',
        additionalProperties: true,
      },
    },
    required,
  };
}

export function safeAdsMcpError(error: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${redactErrorMessage(error instanceof Error ? error.message : 'Unknown error')}`,
      },
    ],
    isError: true,
  };
}
