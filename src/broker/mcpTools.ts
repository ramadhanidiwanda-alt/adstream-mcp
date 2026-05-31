import type { AdsBroker } from './AdsBroker.js';
import type { AdsBrokerRequest, AdsBrokerResponse, AdsMetricRecord, AdsProviderId } from './types.js';
import { isAdsProviderId } from './types.js';
import { redactErrorMessage, redactTokenLikeValues } from './credentials.js';

export const ADS_MCP_TOOL_NAMES = [
  'ads_list_accounts',
  'ads_get_campaign_performance',
  'ads_get_adset_or_adgroup_performance',
  'ads_get_ad_performance',
  'ads_get_creative_performance',
  'ads_generate_report',
] as const;

export type AdsMcpToolName = (typeof ADS_MCP_TOOL_NAMES)[number];

export const ADS_MCP_TOOL_DEFINITIONS = [
  {
    name: 'ads_list_accounts',
    description: 'List ads accounts through the AdsBroker',
    inputSchema: createAdsInputSchema([]),
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
    name: 'ads_generate_report',
    description: 'Generate an ads report through the AdsBroker',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
] as const;

export function isAdsMcpToolName(name: string): name is AdsMcpToolName {
  return ADS_MCP_TOOL_NAMES.includes(name as AdsMcpToolName);
}

export async function handleAdsMcpToolCall(
  broker: AdsBroker,
  name: AdsMcpToolName,
  args: Record<string, unknown> = {}
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const request = toAdsBrokerRequest(args);
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

export function toAdsBrokerRequest(args: Record<string, unknown>): AdsBrokerRequest {
  return {
    provider: parseProvider(args.provider),
    providers: parseProviders(args.providers),
    accountId: typeof args.accountId === 'string' ? args.accountId : undefined,
    since: typeof args.since === 'string' ? args.since : undefined,
    until: typeof args.until === 'string' ? args.until : undefined,
    params: isPlainObject(args.params) ? args.params : {},
  };
}

function callBrokerMethod(
  broker: AdsBroker,
  name: AdsMcpToolName,
  request: AdsBrokerRequest
): Promise<AdsBrokerResponse<AdsMetricRecord[] | unknown>> {
  switch (name) {
    case 'ads_list_accounts':
      return broker.listAccounts(request);
    case 'ads_get_campaign_performance':
      return broker.getCampaignPerformance(request);
    case 'ads_get_adset_or_adgroup_performance':
      return broker.getAdsetOrAdgroupPerformance(request);
    case 'ads_get_ad_performance':
      return broker.getAdPerformance(request);
    case 'ads_get_creative_performance':
      return broker.getCreativePerformance(request);
    case 'ads_generate_report':
      return broker.generateReport(request);
  }
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
        description: 'Optional provider-safe parameters such as limit.',
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
