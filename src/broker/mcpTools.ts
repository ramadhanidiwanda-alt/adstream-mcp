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
  'ads_content_matrix',
  'ads_generate_report',
  'ads_pause_campaign',
  'ads_resume_campaign',
  'ads_update_campaign_budget',
  'ads_rename_campaign',
  'ads_create_ecommerce_campaign_bundle',
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
    name: 'ads_content_matrix',
    description: 'Return data-only ad/creative performance matrix grouped by campaign or adset',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_generate_report',
    description: 'Generate an ads report through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
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
  {
    name: 'ads_create_ecommerce_campaign_bundle',
    description: 'Create a PAUSED Meta ecommerce sales campaign bundle (campaign, ad set, creative, ad) after dry-run preview and explicit confirmation.',
    inputSchema: createEcommerceLaunchInputSchema(),
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
  const oauthAuthContext = (args._oauthAuthContext as AdsBrokerRequest['oauthAuthContext']) ?? undefined;

  return {
    provider: parseProvider(args.provider),
    providers: parseProviders(args.providers),
    accountId: typeof args.accountId === 'string' ? args.accountId : undefined,
    since: typeof args.since === 'string' ? args.since : undefined,
    until: typeof args.until === 'string' ? args.until : undefined,
    params: extractParams(args),
    connectionKey,
    oauthAuthContext,
  };
}

function extractParams(args: Record<string, unknown>): Record<string, unknown> {
  const params = isPlainObject(args.params) ? { ...args.params } : {};
  const reserved = new Set(['provider', 'providers', 'accountId', 'since', 'until', 'params', '_oauthAuthContext']);

  for (const [key, value] of Object.entries(args)) {
    if (!reserved.has(key)) params[key] = value;
  }

  return params;
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
    case 'ads_content_matrix':
      return broker.getContentMatrix(request);
    case 'ads_generate_report':
      return broker.generateReport(request);
    case 'ads_pause_campaign':
      return broker.pauseCampaign(request);
    case 'ads_resume_campaign':
      return broker.resumeCampaign(request);
    case 'ads_update_campaign_budget':
      return broker.updateCampaignBudget(request);
    case 'ads_rename_campaign':
      return broker.renameCampaign(request);
    case 'ads_create_ecommerce_campaign_bundle':
      return broker.createEcommerceCampaignBundle(request);
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

function createEcommerceLaunchInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      campaignName: { type: 'string', description: 'Campaign name. MVP uses OUTCOME_SALES.' },
      adSetName: { type: 'string', description: 'Ad set name.' },
      adName: { type: 'string', description: 'Ad name.' },
      pageId: { type: 'string', description: 'Meta Page ID used in object_story_spec.' },
      pixelId: { type: 'string', description: 'Meta Pixel ID for ecommerce conversion optimization.' },
      destinationUrl: { type: 'string', description: 'Product or landing page URL.' },
      dailyBudget: { type: 'number', description: 'Daily budget in account minor currency units.' },
      countries: { type: 'array', items: { type: 'string' }, description: 'ISO country codes, e.g. ["ID"].' },
      primaryText: { type: 'string', description: 'Primary ad text.' },
      headline: { type: 'string', description: 'Ad headline.' },
      description: { type: 'string', description: 'Optional ad description.' },
      imageHash: { type: 'string', description: 'Uploaded Meta image hash. Required for MVP static creative.' },
      callToActionType: { type: 'string', enum: ['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER'] },
      specialAdCategories: { type: 'array', items: { type: 'string' }, description: 'Meta special ad categories. Defaults to [] only when not applicable.' },
      ageMin: { type: 'number' },
      ageMax: { type: 'number' },
      publisherPlatforms: { type: 'array', items: { type: 'string' } },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'campaignName', 'adSetName', 'adName', 'pageId', 'pixelId', 'destinationUrl', 'dailyBudget', 'countries', 'primaryText', 'headline', 'imageHash'],
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
        enum: ['meta', 'tiktok', 'google'],
        description: 'Ads provider. Defaults to meta when omitted.',
      },
      providers: {
        type: 'array',
        items: { type: 'string', enum: ['meta', 'tiktok', 'google'] },
        description: 'Multi-provider reporting input for supported read providers.',
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
