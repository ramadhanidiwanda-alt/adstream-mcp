import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { buildMetaIdFilteringRules } from '../src/utils/metaFiltering.js';
import { getCampaignInsights } from '../src/tools/getCampaignInsights.js';
import { getAdsetInsights } from '../src/tools/getAdsetInsights.js';
import { getAdsInsights } from '../src/tools/getAdsInsights.js';
import { getAdDestinations } from '../src/tools/getAdDestinations.js';

function createGetSpy(data: unknown[] = []) {
  return vi.fn().mockResolvedValue({ data });
}

describe('buildMetaIdFilteringRules', () => {
  it('builds one IN rule per non-empty id filter', () => {
    expect(
      buildMetaIdFilteringRules([
        { field: 'campaign.id', value: 'cmp_1' },
        { field: 'adset.id', value: ['as_1', 'as_2'] },
        { field: 'ad.id', value: undefined },
      ])
    ).toEqual([
      { field: 'campaign.id', operator: 'IN', value: ['cmp_1'] },
      { field: 'adset.id', operator: 'IN', value: ['as_1', 'as_2'] },
    ]);
  });

  it('returns undefined when no filter has a value', () => {
    expect(buildMetaIdFilteringRules([{ field: 'campaign.id', value: undefined }])).toBeUndefined();
  });

  it('drops blank ids', () => {
    expect(buildMetaIdFilteringRules([{ field: 'campaign.id', value: [' ', ''] }])).toBeUndefined();
  });
});

describe('getCampaignInsights filtering', () => {
  it('omits filtering when no campaignId is given', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getCampaignInsights(client, {
      adAccountId: 'act_123',
      since: '2026-07-01',
      until: '2026-07-31',
    });

    const params = metaGet.mock.calls[0][1];
    expect(params.filtering).toBeUndefined();
  });

  it('sends a campaign.id IN filter when campaignId is given', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getCampaignInsights(client, {
      adAccountId: 'act_123',
      since: '2026-07-01',
      until: '2026-07-31',
      campaignId: '120216685951590415',
    });

    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'campaign.id', operator: 'IN', value: ['120216685951590415'] },
    ]);
  });
});

describe('getAdsetInsights filtering', () => {
  it('sends campaign.id and adset.id IN filters when both are given', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdsetInsights(client, {
      adAccountId: 'act_123',
      since: '2026-07-01',
      until: '2026-07-31',
      campaignId: 'cmp_1',
      adsetId: ['as_1', 'as_2'],
    });

    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'campaign.id', operator: 'IN', value: ['cmp_1'] },
      { field: 'adset.id', operator: 'IN', value: ['as_1', 'as_2'] },
    ]);
  });
});

describe('getAdsInsights filtering', () => {
  it('sends only the ad.id filter when just adId is given', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdsInsights(client, {
      adAccountId: 'act_123',
      since: '2026-07-01',
      until: '2026-07-31',
      adId: 'ad_1',
    });

    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([{ field: 'ad.id', operator: 'IN', value: ['ad_1'] }]);
  });
});

describe('getAdDestinations filtering', () => {
  it('merges effective_status with campaignId/adSetId filters', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdDestinations(client, {
      adAccountId: 'act_123',
      campaignId: 'cmp_1',
      adSetId: 'as_1',
    });

    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
      { field: 'campaign.id', operator: 'IN', value: ['cmp_1'] },
      { field: 'adset.id', operator: 'IN', value: ['as_1'] },
    ]);
  });

  it('only sends effective_status when no campaignId/adSetId is given', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdDestinations(client, { adAccountId: 'act_123' });

    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
    ]);
  });

  it('actually filters results to the requested ad set (regression for the reported bug)', async () => {
    // Simulates the exact scenario the user hit: asking for ads in one specific
    // ad set should not silently return ads from other ad sets too.
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        { id: 'ad_in_adset', name: 'POSTER', status: 'ACTIVE', effective_status: 'ACTIVE' },
      ],
    });
    const client = { metaGet } as unknown as MetaClient;

    const result = await getAdDestinations(client, {
      adAccountId: 'act_123',
      adSetId: '120251877326190415',
    });

    expect(result).toHaveLength(1);
    expect(result[0].ad_id).toBe('ad_in_adset');
    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toContainEqual({
      field: 'adset.id',
      operator: 'IN',
      value: ['120251877326190415'],
    });
  });
});
