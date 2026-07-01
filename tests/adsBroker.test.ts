import { describe, expect, it } from 'vitest';
import { AdsBroker } from '../src/broker/AdsBroker.js';
import { ProviderRegistry } from '../src/broker/providerRegistry.js';
import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsProviderAdapter,
  CredentialContext,
} from '../src/broker/types.js';
import type { CredentialResolveRequest, CredentialResolveResult } from '../src/broker/credentials.js';

class StubCredentialResolver {
  calls: CredentialResolveRequest[] = [];

  constructor(private readonly result: CredentialResolveResult) {}

  async resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult> {
    this.calls.push(request);
    return this.result;
  }
}

function createCredential(provider: 'meta' | 'tiktok' = 'meta'): CredentialContext {
  return {
    provider,
    accessToken: 'secret-token-value',
    accountId: 'act_123',
    source: 'test',
  };
}

function createMetricRecord(options: Partial<AdsMetricRecord> = {}): AdsMetricRecord {
  return {
    provider: 'meta',
    level: 'campaign',
    identity: {
      account_id: 'act_123',
      campaign_id: 'cmp_123',
    },
    time: {
      date_start: '2026-05-01',
      date_stop: '2026-05-07',
    },
    delivery: {
      spend: 10,
      impressions: 100,
    },
    ...options,
  };
}

function createAdapter(overrides: Partial<AdsProviderAdapter> = {}): AdsProviderAdapter {
  const response = async (): Promise<AdsBrokerResponse<AdsMetricRecord[]>> => ({
    ok: true,
    provider: 'meta',
    data: [createMetricRecord()],
  });

  return {
    id: 'meta',
    displayName: 'Meta Ads Stub',
    capabilities: {
      providers: ['meta'],
      categories: ['accounts', 'campaigns'],
      operations: ['read'],
    },
    listAccounts: async () => ({ ok: true, provider: 'meta', data: [] }),
    getCampaignPerformance: response,
    getAdsetOrAdgroupPerformance: response,
    getAdPerformance: response,
    getCreativePerformance: response,
    ...overrides,
  };
}

function createBroker(
  adapter: AdsProviderAdapter = createAdapter(),
  credentialResolver = new StubCredentialResolver({ ok: true, credential: createCredential() })
): { broker: AdsBroker; credentialResolver: StubCredentialResolver; registry: ProviderRegistry } {
  const registry = new ProviderRegistry();
  registry.register(adapter);
  return {
    broker: new AdsBroker({ providerRegistry: registry, credentialResolver }),
    credentialResolver,
    registry,
  };
}

const baseRequest: AdsBrokerRequest = {
  provider: 'meta',
  accountId: 'act_123',
  since: '2026-05-01',
  until: '2026-05-07',
  params: {},
};

describe('AdsBroker', () => {
  it('rejects unknown provider', async () => {
    const { broker } = createBroker();
    const response = await broker.getCampaignPerformance({ ...baseRequest, provider: 'google' as never });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('UNSUPPORTED_PROVIDER');
  });

  it('defaults empty provider to meta for backward-safe local testing', async () => {
    const { broker } = createBroker();
    const response = await broker.getCampaignPerformance({ ...baseRequest, provider: undefined });

    expect(response.ok).toBe(true);
    expect(response.provider).toBe('meta');
  });

  it('uses CredentialResolver before calling adapter', async () => {
    const resolver = new StubCredentialResolver({ ok: true, credential: createCredential() });
    const { broker } = createBroker(createAdapter(), resolver);

    await broker.getCampaignPerformance(baseRequest);

    expect(resolver.calls).toEqual([{ provider: 'meta', accountId: 'act_123', params: {} }]);
  });

  it('uses ProviderRegistry to find adapter', async () => {
    const registry = new ProviderRegistry();
    const broker = new AdsBroker({
      providerRegistry: registry,
      credentialResolver: new StubCredentialResolver({ ok: true, credential: createCredential() }),
    });

    const response = await broker.getCampaignPerformance(baseRequest);

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('PROVIDER_NOT_REGISTERED');
  });

  it('calls Meta adapter for campaign performance', async () => {
    let called = false;
    const adapter = createAdapter({
      getCampaignPerformance: async (request) => {
        called = true;
        expect(request.credentials?.accessToken).toBe('secret-token-value');
        return { ok: true, provider: 'meta', data: [createMetricRecord()] };
      },
    });
    const { broker } = createBroker(adapter);

    const response = await broker.getCampaignPerformance(baseRequest);

    expect(called).toBe(true);
    expect(response.ok).toBe(true);
    expect(response.data?.[0].delivery.spend).toBe(10);
  });

  it('redacts token-like adapter errors', async () => {
    const adapter = createAdapter({
      getCampaignPerformance: async () => {
        throw new Error('Authorization: Bearer secret-token-value access_token=secret-token-value');
      },
    });
    const { broker } = createBroker(adapter);

    const response = await broker.getCampaignPerformance(baseRequest);

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].message).not.toContain('secret-token-value');
    expect(response.errors?.[0].message).toContain('[REDACTED]');
  });

  it('does not include raw by default in sanitized response', async () => {
    const adapter = createAdapter({
      getCampaignPerformance: async () => ({
        ok: true,
        provider: 'meta',
        data: [createMetricRecord({ raw: { accessToken: 'secret-token-value' } })],
      }),
    });
    const { broker } = createBroker(adapter);

    const response = await broker.getCampaignPerformance(baseRequest);

    expect(response.ok).toBe(true);
    expect(response.data?.[0].raw).toBeUndefined();
    expect(JSON.stringify(response)).not.toContain('secret-token-value');
  });

  it('returns NOT_IMPLEMENTED for creative performance when adapter does not support it yet', async () => {
    const adapter = createAdapter({
      getCreativePerformance: async () => ({
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'NOT_IMPLEMENTED',
            message: 'Meta creative performance is not implemented in the MVP adapter yet',
          },
        ],
      }),
    });
    const { broker } = createBroker(adapter);

    const response = await broker.getCreativePerformance(baseRequest);

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });

  it('returns NOT_IMPLEMENTED for multi-provider request', async () => {
    const { broker } = createBroker();
    const response = await broker.getCampaignPerformance({
      ...baseRequest,
      provider: undefined,
      providers: ['meta', 'tiktok'],
    });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });

  it('generates a single-provider account report from normalized metrics', async () => {
    const adapter = createAdapter({
      getAccountPerformance: async () => ({
        ok: true,
        provider: 'meta',
        data: [
          createMetricRecord({
            level: 'account',
            delivery: { spend: 100, impressions: 1000, reach: 800 },
            clicks: { clicks: 50, ctr: 5, cpc: 2 },
            commerce: { purchases: 4, purchase_value: 400, purchase_roas: 4 },
            leads: { leads: 6 },
          }),
        ],
      }),
    });
    const { broker } = createBroker(adapter);

    const response = await broker.generateReport({
      ...baseRequest,
      params: { format: 'summary' },
    });

    expect(response.ok).toBe(true);
    expect(response.provider).toBe('meta');
    expect(response.data).toMatchObject({
      provider: 'meta',
      report_kind: 'ads',
      format: 'summary',
      date_range: { since: '2026-05-01', until: '2026-05-07' },
      totals: {
        spend: 100,
        impressions: 1000,
        clicks: 50,
        reach: 800,
        purchases: 4,
        purchase_value: 400,
        leads: 6,
        roas: 4,
      },
    });
    expect(response.data?.findings.length).toBeGreaterThan(0);
    expect(response.data?.recommendations.length).toBeGreaterThan(0);
    expect(response.data?.disclaimer).toContain('suggestion');
  });

  it('generates campaign-level reports when params.level is campaign', async () => {
    let accountCalled = false;
    let campaignCalled = false;
    const adapter = createAdapter({
      getAccountPerformance: async () => {
        accountCalled = true;
        return { ok: true, provider: 'meta', data: [] };
      },
      getCampaignPerformance: async () => {
        campaignCalled = true;
        return {
          ok: true,
          provider: 'meta',
          data: [
            createMetricRecord({
              level: 'campaign',
              identity: { account_id: 'act_123', campaign_id: 'cmp_scale', campaign_name: 'Scale Candidate' },
              delivery: { spend: 200, impressions: 2000 },
              clicks: { clicks: 100 },
              commerce: { purchases: 10, purchase_value: 1000 },
            }),
          ],
        };
      },
    });
    const { broker } = createBroker(adapter);

    const response = await broker.generateReport({ ...baseRequest, params: { level: 'campaign' } });

    expect(response.ok).toBe(true);
    expect(accountCalled).toBe(false);
    expect(campaignCalled).toBe(true);
    expect(response.data?.level).toBe('campaign');
    expect(response.data?.totals.roas).toBe(5);
  });

  it('adds audit sections for audit format reports', async () => {
    const adapter = createAdapter({
      getCampaignPerformance: async () => ({
        ok: true,
        provider: 'meta',
        data: [
          createMetricRecord({
            delivery: { spend: 100, impressions: 2000 },
            clicks: { clicks: 40 },
            commerce: { purchases: 1, purchase_value: 120 },
          }),
          createMetricRecord({
            identity: { account_id: 'act_123', campaign_id: 'cmp_good' },
            delivery: { spend: 50, impressions: 1000 },
            clicks: { clicks: 60 },
            commerce: { purchases: 4, purchase_value: 400 },
          }),
        ],
      }),
    });
    const { broker } = createBroker(adapter);

    const response = await broker.generateReport({
      ...baseRequest,
      params: { level: 'campaign', format: 'audit' },
    });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      format: 'audit',
      scorecard: {
        score: expect.any(Number),
        rating: expect.any(String),
      },
    });
    expect(response.data?.efficiency_findings.length).toBeGreaterThan(0);
    expect(response.data?.risk_findings.length).toBeGreaterThan(0);
    expect(response.data?.opportunity_findings.length).toBeGreaterThan(0);
    expect(response.data?.next_actions.length).toBeGreaterThan(0);
  });
});
