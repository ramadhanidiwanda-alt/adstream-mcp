import { describe, expect, it } from 'vitest';
import { AdsBroker } from '../src/broker/AdsBroker.js';
import { ProviderRegistry } from '../src/broker/providerRegistry.js';
import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsMultiProviderReport,
  AdsProviderAdapter,
  AdsProviderId,
  CredentialContext,
} from '../src/broker/types.js';
import type { CredentialResolveRequest, CredentialResolveResult } from '../src/broker/credentials.js';

class StubCredentialResolver {
  async resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult> {
    return {
      ok: true,
      credential: {
        provider: request.provider,
        accessToken: 'secret-token-value',
        accountId: request.accountId ?? 'acc_1',
        source: 'test',
      } satisfies CredentialContext,
    };
  }
}

function accountRecord(provider: AdsProviderId, options: Partial<AdsMetricRecord> = {}): AdsMetricRecord {
  return {
    provider,
    level: 'account',
    identity: { account_id: 'acc_1' },
    time: { date_start: '2026-05-01', date_stop: '2026-05-07' },
    delivery: { spend: 100, impressions: 1000 },
    clicks: { clicks: 50 },
    ...options,
  };
}

function createAdapter(
  id: AdsProviderId,
  accountResponse: () => Promise<AdsBrokerResponse<AdsMetricRecord[]>>
): AdsProviderAdapter {
  const notUsed = async (): Promise<AdsBrokerResponse<AdsMetricRecord[]>> => ({ ok: true, provider: id, data: [] });
  return {
    id,
    displayName: `${id} stub`,
    capabilities: { providers: [id], categories: ['insights', 'reports'], operations: ['read'] },
    listAccounts: async () => ({ ok: true, provider: id, data: [] }),
    listCampaigns: async () => ({ ok: true, provider: id, data: [] }),
    getAccountPerformance: accountResponse,
    getCampaignPerformance: notUsed,
    getAdsetOrAdgroupPerformance: notUsed,
    getAdPerformance: notUsed,
    getCreativePerformance: notUsed,
    getPlacementPerformance: async () => ({ ok: true, provider: id, data: [] }),
    pauseCampaign: async () => ({ ok: false, provider: id, errors: [{ provider: id, code: 'NOT_IMPLEMENTED', message: 'no' }] }),
    resumeCampaign: async () => ({ ok: false, provider: id, errors: [{ provider: id, code: 'NOT_IMPLEMENTED', message: 'no' }] }),
    updateCampaignBudget: async () => ({ ok: false, provider: id, errors: [{ provider: id, code: 'NOT_IMPLEMENTED', message: 'no' }] }),
    renameCampaign: async () => ({ ok: false, provider: id, errors: [{ provider: id, code: 'NOT_IMPLEMENTED', message: 'no' }] }),
  } as AdsProviderAdapter;
}

function createBroker(adapters: AdsProviderAdapter[]): AdsBroker {
  const registry = new ProviderRegistry();
  for (const adapter of adapters) registry.register(adapter);
  return new AdsBroker({ providerRegistry: registry, credentialResolver: new StubCredentialResolver() });
}

const baseRequest: AdsBrokerRequest = {
  accountId: 'acc_1',
  since: '2026-05-01',
  until: '2026-05-07',
  params: {},
};

describe('AdsBroker cross-provider reports', () => {
  it('aggregates account totals across providers', async () => {
    const meta = createAdapter('meta', async () => ({
      ok: true,
      provider: 'meta',
      data: [accountRecord('meta', {
        delivery: { spend: 100, impressions: 1000 },
        clicks: { clicks: 50 },
        commerce: { purchase_value: 400 },
      })],
    }));
    const tiktok = createAdapter('tiktok', async () => ({
      ok: true,
      provider: 'tiktok',
      data: [accountRecord('tiktok', {
        delivery: { spend: 50, impressions: 500 },
        clicks: { clicks: 30 },
        conversions: { conversion_value: 200 },
      })],
    }));

    const broker = createBroker([meta, tiktok]);
    const response = await broker.generateReport({ ...baseRequest, providers: ['meta', 'tiktok'] });

    expect(response.ok).toBe(true);
    const report = response.data as AdsMultiProviderReport;
    expect(report.report_kind).toBe('ads');
    expect(report.providers).toEqual(['meta', 'tiktok']);
    expect(report.totals.spend).toBe(150);
    expect(report.totals.impressions).toBe(1500);
    expect(report.totals.clicks).toBe(80);
    expect(report.totals.purchase_value).toBe(600);
    expect(report.per_provider).toHaveLength(2);
    expect(report.errors ?? []).toHaveLength(0);
  });

  it('continues with partial failure and reports provider errors', async () => {
    const meta = createAdapter('meta', async () => ({
      ok: true,
      provider: 'meta',
      data: [accountRecord('meta')],
    }));
    const tiktok = createAdapter('tiktok', async () => ({
      ok: false,
      provider: 'tiktok',
      errors: [{ provider: 'tiktok', code: 'TIKTOK_ADAPTER_ERROR', message: 'temporary failure' }],
    }));

    const broker = createBroker([meta, tiktok]);
    const response = await broker.generateReport({ ...baseRequest, providers: ['meta', 'tiktok'] });

    expect(response.ok).toBe(true);
    const report = response.data as AdsMultiProviderReport;
    expect(report.providers).toEqual(['meta']);
    expect(report.per_provider).toHaveLength(1);
    expect(report.totals.spend).toBe(100);
    expect(report.errors?.[0]).toMatchObject({ provider: 'tiktok', code: 'TIKTOK_ADAPTER_ERROR' });
  });

  it('fails only when all providers fail', async () => {
    const meta = createAdapter('meta', async () => ({
      ok: false,
      provider: 'meta',
      errors: [{ provider: 'meta', code: 'MISSING_ENV_CREDENTIALS', message: 'missing' }],
    }));
    const tiktok = createAdapter('tiktok', async () => ({
      ok: false,
      provider: 'tiktok',
      errors: [{ provider: 'tiktok', code: 'TIKTOK_ADAPTER_ERROR', message: 'boom' }],
    }));

    const broker = createBroker([meta, tiktok]);
    const response = await broker.generateReport({ ...baseRequest, providers: ['meta', 'tiktok'] });

    expect(response.ok).toBe(false);
    expect(response.errors).toHaveLength(2);
  });

  it('flags mixed currencies so totals are not silently wrong', async () => {
    const meta = createAdapter('meta', async () => ({
      ok: true,
      provider: 'meta',
      data: [accountRecord('meta', { setup: { currency: 'USD' }, delivery: { spend: 100, impressions: 1000 } })],
    }));
    const tiktok = createAdapter('tiktok', async () => ({
      ok: true,
      provider: 'tiktok',
      data: [accountRecord('tiktok', { setup: { currency: 'IDR' }, delivery: { spend: 50, impressions: 500 } })],
    }));

    const broker = createBroker([meta, tiktok]);
    const response = await broker.generateReport({ ...baseRequest, providers: ['meta', 'tiktok'] });

    const report = response.data as AdsMultiProviderReport;
    expect(report.currencies).toEqual(['USD', 'IDR']);
    expect(report.mixed_currency).toBe(true);
    expect(report.warnings?.some((w) => w.toLowerCase().includes('currency'))).toBe(true);
  });
});
