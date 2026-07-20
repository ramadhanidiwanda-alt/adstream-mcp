import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import {
  buildMetaIdFilteringRules,
  parseCanonicalMetaFilters,
  parseExplicitMetaFilters,
} from '../src/utils/metaFiltering.js';
import { getCampaignInsights } from '../src/tools/getCampaignInsights.js';
import { getAdsetInsights } from '../src/tools/getAdsetInsights.js';
import { getAdsInsights } from '../src/tools/getAdsInsights.js';
import { getAdCreativeMapping } from '../src/tools/getAdCreativeMapping.js';
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

describe('explicit Meta filter parsing', () => {
  it('translates canonical operators and preserves scalar values', () => {
    expect(
      parseCanonicalMetaFilters([
        { field: 'campaign.status', operator: 'eq', value: 'ACTIVE' },
        { field: 'impressions', operator: 'gte', value: 100 },
      ])
    ).toEqual([
      { field: 'campaign.status', operator: 'EQUAL', value: 'ACTIVE' },
      { field: 'impressions', operator: 'GREATER_THAN_OR_EQUAL', value: 100 },
    ]);
  });

  it('preserves provider-native operators and numeric values for raw filtering', () => {
    expect(
      parseExplicitMetaFilters([{ field: 'impressions', operator: 'GREATER_THAN', value: 100 }])
    ).toEqual([{ field: 'impressions', operator: 'GREATER_THAN', value: 100 }]);
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
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'ad.id', operator: 'IN', value: ['ad_1'] },
    ]);
  });
});

describe('getAdDestinations filtering', () => {
  it('returns Meta delivery and review diagnostics for each ad', async () => {
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'ad_with_issue',
          name: 'Rejected Ad',
          status: 'ACTIVE',
          effective_status: 'WITH_ISSUES',
          issues_info: [{ level: 'AD', error_code: 1359187, error_message: 'Missing URL' }],
          ad_review_feedback: { global: { reason: 'DESTINATION_MISMATCH' } },
        },
      ],
    });
    const client = { metaGet } as unknown as MetaClient;

    const result = await getAdDestinations(client, { adAccountId: 'act_123' });

    expect(metaGet.mock.calls[0][1].fields).toContain('issues_info');
    expect(metaGet.mock.calls[0][1].fields).toContain('ad_review_feedback');
    expect(result[0]).toMatchObject({
      ad_id: 'ad_with_issue',
      effective_status: 'WITH_ISSUES',
      issues_info: [{ error_code: 1359187, error_message: 'Missing URL' }],
      ad_review_feedback: { global: { reason: 'DESTINATION_MISMATCH' } },
    });
  });

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

  it('merges raw Meta filtering with status and entity filters', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdDestinations(client, {
      adAccountId: 'act_123',
      campaignId: 'cmp_1',
      explicitFilters: [{ field: 'impressions', operator: 'GREATER_THAN', value: 100 }],
    });

    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toContainEqual({
      field: 'impressions',
      operator: 'GREATER_THAN',
      value: 100,
    });
  });

  it('actually filters results to the requested ad set (regression for the reported bug)', async () => {
    // Simulates the exact scenario the user hit: asking for ads in one specific
    // ad set should not silently return ads from other ad sets too.
    const metaGet = vi.fn().mockResolvedValue({
      data: [{ id: 'ad_in_adset', name: 'POSTER', status: 'ACTIVE', effective_status: 'ACTIVE' }],
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

describe('getAdCreativeMapping filtering', () => {
  it('merges raw Meta filtering with campaign/ad set filters', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdCreativeMapping(client, {
      adAccountId: 'act_123',
      campaignId: 'cmp_1',
      adSetId: 'as_1',
      explicitFilters: [{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }],
    });

    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'campaign.id', operator: 'IN', value: ['cmp_1'] },
      { field: 'adset.id', operator: 'IN', value: ['as_1'] },
      { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] },
    ]);
  });
});
