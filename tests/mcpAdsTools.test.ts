import { describe, expect, it } from 'vitest';
import {
  ADS_MCP_TOOL_DEFINITIONS,
  handleAdsMcpToolCall,
  safeAdsMcpError,
  toAdsBrokerRequest,
} from '../src/broker/mcpTools.js';
import type { AdsBroker } from '../src/broker/AdsBroker.js';
import type { AdsBrokerRequest, AdsBrokerResponse, AdsMetricRecord } from '../src/broker/types.js';

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
    getCampaignPerformance: response,
    getAdsetOrAdgroupPerformance: response,
    getAdPerformance: response,
    getCreativePerformance: async () => ({
      ok: false,
      provider: 'meta',
      errors: [{ provider: 'meta', code: 'NOT_IMPLEMENTED', message: 'not implemented' }],
    }),
    generateReport: async () => ({
      ok: false,
      provider: 'meta',
      errors: [{ provider: 'meta', code: 'NOT_IMPLEMENTED', message: 'not implemented' }],
    }),
  } as unknown as AdsBroker;
}

function parseToolResponse(response: Awaited<ReturnType<typeof handleAdsMcpToolCall>>): AdsBrokerResponse {
  return JSON.parse(response.content[0].text) as AdsBrokerResponse;
}

describe('ads MCP broker tools', () => {
  it('defines new ads tools without removing legacy names from expected server surface', () => {
    const adsToolNames = ADS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name);

    expect(adsToolNames).toEqual([
      'ads_list_accounts',
      'ads_get_campaign_performance',
      'ads_get_adset_or_adgroup_performance',
      'ads_get_ad_performance',
      'ads_get_creative_performance',
      'ads_generate_report',
      'ads_pause_campaign',
      'ads_resume_campaign',
      'ads_update_campaign_budget',
      'ads_rename_campaign',
    ]);
    expect(legacyToolNames).toContain('meta_get_campaign_insights');
    expect(legacyToolNames).toContain('meta_get_ads_insights');
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
    expect(receivedRequest).toMatchObject({ provider: 'meta', accountId: 'act_123', params: { limit: 10 } });
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

  it('returns safe NOT_IMPLEMENTED for creative performance and report generation', async () => {
    const broker = createBrokerStub();

    const creativeResponse = parseToolResponse(
      await handleAdsMcpToolCall(broker, 'ads_get_creative_performance', {})
    );
    const reportResponse = parseToolResponse(await handleAdsMcpToolCall(broker, 'ads_generate_report', {}));

    expect(creativeResponse.errors?.[0].code).toBe('NOT_IMPLEMENTED');
    expect(reportResponse.errors?.[0].code).toBe('NOT_IMPLEMENTED');
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
      await handleAdsMcpToolCall(broker, 'ads_get_campaign_performance', { provider: 'google' })
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
        errors: [{ provider: 'meta' as const, code: 'MISSING_ENV_CREDENTIALS', message: 'Missing credentials' }],
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
        return { ok: true, provider: 'meta', data: [{ account_id: 'act_123', account_name: 'Test' }] };
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
