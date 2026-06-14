import { describe, expect, it } from 'vitest';
import { getLocationInsights } from '../src/tools/getLocationInsights.js';
import { summarizeLocationInsights } from '../src/analysis/summarizeLocationInsights.js';
import type { CampaignInsight, MetaClient } from '../src/index.js';

function createClientStub(insights: CampaignInsight[]): MetaClient {
  return {
    metaGet: async () => ({ data: insights }),
  } as unknown as MetaClient;
}

function basicInsight(overrides: Partial<CampaignInsight> = {}): CampaignInsight {
  return {
    campaign_id: 'cmp_1',
    campaign_name: 'Campaign 1',
    country: 'ID',
    spend: '100',
    impressions: '1000',
    reach: '800',
    clicks: '50',
    inline_link_clicks: '40',
    ctr: '5',
    cpc: '2',
    cpm: '100',
    ...overrides,
  };
}

describe('getLocationInsights', () => {
  it('returns summary with totals and ranked locations', async () => {
    const client = createClientStub([
      basicInsight({ campaign_id: '1', campaign_name: 'A', country: 'ID', spend: '200', impressions: '2000', clicks: '80' }),
      basicInsight({ campaign_id: '2', campaign_name: 'B', country: 'MY', spend: '100', impressions: '1000', clicks: '30' }),
      basicInsight({ campaign_id: '3', campaign_name: 'C', country: 'ID', spend: '50', impressions: '500', clicks: '10' }),
    ]);

    const result = await getLocationInsights(client, {
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
    });

    expect(result.breakdown).toBe('country');
    expect(result.top_locations).toHaveLength(2);
    expect(result.top_locations[0].country).toBe('ID');
    expect(result.top_locations[0].spend).toBe(250);
    expect(result.top_locations[0].impressions).toBe(2500);
    expect(result.top_locations[0].clicks).toBe(90);
    expect(result.top_locations[0].campaigns).toBe(2);
    expect(result.top_locations[1].country).toBe('MY');
    expect(result.totals.spend).toBe(350);
    expect(result.totals.campaigns).toBe(3);
  });

  it('ranks by clicks asc', async () => {
    const client = createClientStub([
      basicInsight({ campaign_id: '1', country: 'ID', clicks: '10' }),
      basicInsight({ campaign_id: '2', country: 'MY', clicks: '50' }),
    ]);

    const result = await getLocationInsights(client, {
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
      sortBy: 'clicks',
      sortDirection: 'asc',
    });

    expect(result.top_locations[0].country).toBe('ID');
    expect(result.top_locations[1].country).toBe('MY');
  });

  it('filters by minSpend', async () => {
    const client = createClientStub([
      basicInsight({ campaign_id: '1', country: 'ID', spend: '500' }),
      basicInsight({ campaign_id: '2', country: 'MY', spend: '50' }),
    ]);

    const result = await getLocationInsights(client, {
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
      minSpend: 100,
    });

    expect(result.top_locations).toHaveLength(1);
    expect(result.top_locations[0].country).toBe('ID');
    expect(result.warnings).toContain('Filtered spend >= 100');
  });

  it('handles empty insights gracefully', async () => {
    const client = createClientStub([]);

    const result = await getLocationInsights(client, {
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
    });

    expect(result.top_locations).toHaveLength(0);
    expect(result.warnings).toContain('No insight data returned from Meta API');
    expect(result.totals.spend).toBe(0);
  });

  it('defaults missing CTR/CPC/CPM from computed values', async () => {
    const client = createClientStub([
      basicInsight({ campaign_id: '1', country: 'ID', spend: '200', impressions: '1000', clicks: '50', ctr: undefined, cpc: undefined, cpm: undefined }),
    ]);

    const result = await getLocationInsights(client, {
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
    });

    expect(result.top_locations[0].ctr).toBe(5);
    expect(result.top_locations[0].cpc).toBe(4);
    expect(result.top_locations[0].cpm).toBe(200);
  });
});

describe('summarizeLocationInsights edge cases', () => {
  it('handles unknown country gracefully', () => {
    const result = summarizeLocationInsights({
      insights: [basicInsight({ country: undefined })],
      breakdown: 'country',
    });

    expect(result.top_locations[0].country).toBe('(unknown)');
  });

  it('respects limit parameter', () => {
    const insights = Array.from({ length: 5 }, (_, i) =>
      basicInsight({ campaign_id: `${i}`, country: `C${i}`, spend: `${100 - i * 10}` })
    );

    const result = summarizeLocationInsights({
      insights,
      breakdown: 'country',
      limit: 3,
    });

    expect(result.top_locations).toHaveLength(3);
    expect(result.totals.campaigns).toBe(3);
  });

  it('works with region breakdown', () => {
    const result = summarizeLocationInsights({
      insights: [basicInsight({ country: undefined, region: 'Jawa Barat' })],
      breakdown: 'region',
    });

    expect(result.breakdown).toBe('region');
    expect(result.top_locations[0].region).toBe('Jawa Barat');
  });
});
