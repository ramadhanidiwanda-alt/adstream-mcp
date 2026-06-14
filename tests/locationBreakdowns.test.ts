import { describe, expect, it } from 'vitest';
import { getAdsInsights } from '../src/tools/getAdsInsights.js';
import { getCampaignInsights } from '../src/tools/getCampaignInsights.js';
import { MetaAdsAdapter } from '../src/providers/meta/MetaAdsAdapter.js';
import type { MetaClient } from '../src/metaClient.js';

function createClientStub() {
  const calls: Array<{ path: string; params: Record<string, unknown> }> = [];
  const client = {
    metaGet: async (path: string, params: Record<string, unknown>) => {
      calls.push({ path, params });
      return { data: [] };
    },
  } as unknown as MetaClient;

  return { client, calls };
}

describe('location breakdown insights', () => {
  it('passes location breakdowns to campaign insights requests', async () => {
    const { client, calls } = createClientStub();

    await getCampaignInsights(client, {
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
      breakdowns: ['country'],
    });

    expect(calls[0]).toMatchObject({
      path: '/act_123/insights',
      params: expect.objectContaining({ level: 'campaign', breakdowns: 'country' }),
    });
  });

  it('passes multiple location breakdowns to ad insights requests', async () => {
    const { client, calls } = createClientStub();

    await getAdsInsights(client, {
      adAccountId: '123',
      since: '2026-06-01',
      until: '2026-06-14',
      breakdowns: ['country', 'region'],
    });

    expect(calls[0]).toMatchObject({
      path: '/act_123/insights',
      params: expect.objectContaining({ level: 'ad', breakdowns: 'country,region' }),
    });
  });

  it('forwards broker breakdown params and normalizes location dimensions', async () => {
    let receivedBreakdowns: unknown;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getCampaignInsights: async (_client, options) => {
          receivedBreakdowns = options.breakdowns;
          return [
            {
              campaign_id: 'cmp_1',
              campaign_name: 'Campaign 1',
              country: 'ID',
              spend: '10',
              impressions: '100',
              reach: '80',
              clicks: '5',
              inline_link_clicks: '4',
              ctr: '5',
              cpc: '2',
              cpm: '100',
            },
          ];
        },
      },
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
      params: { breakdowns: ['country'] },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(receivedBreakdowns).toEqual(['country']);
    expect(response.data?.[0].dimensions).toEqual({ country: 'ID', region: undefined, dma: undefined });
  });

  it('rejects unsupported broker location breakdowns', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
      params: { breakdowns: ['city'] },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('INVALID_LOCATION_BREAKDOWN');
  });
});
