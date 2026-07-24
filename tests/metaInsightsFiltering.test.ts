import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import {
  buildMetaIdFilteringRules,
  parseCanonicalMetaFilters,
  parseExplicitMetaFilters,
  resolveAdsEdgeScope,
  filterAdsByEntityScope,
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

    expect(metaGet.mock.calls[0][0]).toBe('/act_123/ads');
    expect(metaGet.mock.calls[0][1].fields).toContain('issues_info');
    expect(metaGet.mock.calls[0][1].fields).toContain('ad_review_feedback');
    expect(result[0]).toMatchObject({
      ad_id: 'ad_with_issue',
      effective_status: 'WITH_ISSUES',
      issues_info: [{ error_code: 1359187, error_message: 'Missing URL' }],
      ad_review_feedback: { global: { reason: 'DESTINATION_MISMATCH' } },
    });
  });

  it('only sends effective_status when no campaignId/adSetId is given', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdDestinations(client, { adAccountId: 'act_123' });

    expect(metaGet.mock.calls[0][0]).toBe('/act_123/ads');
    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
    ]);
  });

  it('sends effective_status only — never connected-object filtering — when both campaignId and adSetId are given, since /ads does not support that', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdDestinations(client, {
      adAccountId: 'act_123',
      campaignId: 'cmp_1',
      adSetId: 'as_1',
    });

    expect(metaGet.mock.calls[0][0]).toBe('/act_123/ads');
    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toEqual([
      { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
    ]);
  });

  it('scopes to the campaign endpoint and merges raw Meta filtering when only campaignId is given', async () => {
    const metaGet = createGetSpy();
    const client = { metaGet } as unknown as MetaClient;

    await getAdDestinations(client, {
      adAccountId: 'act_123',
      campaignId: 'cmp_1',
      explicitFilters: [{ field: 'impressions', operator: 'GREATER_THAN', value: 100 }],
    });

    expect(metaGet.mock.calls[0][0]).toBe('/cmp_1/ads');
    const params = metaGet.mock.calls[0][1];
    expect(JSON.parse(params.filtering)).toContainEqual({
      field: 'impressions',
      operator: 'GREATER_THAN',
      value: 100,
    });
  });

  it('actually filters results to the requested ad set by calling its nested /ads edge (regression for the reported bug)', async () => {
    // Simulates the exact scenario the user hit: asking for ads in one specific
    // ad set should not silently return ads from other ad sets, or nothing at all.
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'ad_in_adset',
          name: 'POSTER',
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          adset_id: '120251877326190415',
        },
      ],
    });
    const client = { metaGet } as unknown as MetaClient;

    const result = await getAdDestinations(client, {
      adAccountId: 'act_123',
      adSetId: '120251877326190415',
    });

    expect(metaGet.mock.calls[0][0]).toBe('/120251877326190415/ads');
    expect(result).toHaveLength(1);
    expect(result[0].ad_id).toBe('ad_in_adset');
  });

  it('drops ads outside the requested ad sets when multiple adSetId values force the account-level endpoint', async () => {
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'ad_in',
          name: 'In Scope',
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          adset_id: 'as_1',
        },
        {
          id: 'ad_out',
          name: 'Out Of Scope',
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          adset_id: 'as_other',
        },
      ],
    });
    const client = { metaGet } as unknown as MetaClient;

    const result = await getAdDestinations(client, {
      adAccountId: 'act_123',
      adSetId: ['as_1', 'as_2'],
    });

    expect(metaGet.mock.calls[0][0]).toBe('/act_123/ads');
    expect(result).toHaveLength(1);
    expect(result[0].ad_id).toBe('ad_in');
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

describe('resolveAdsEdgeScope', () => {
  it('scopes to the nested ad set endpoint when only a single adSetId is given', () => {
    expect(resolveAdsEdgeScope('123', undefined, 'as_1')).toEqual({
      path: '/as_1/ads',
      needsPostFilter: false,
    });
  });

  it('scopes to the nested campaign endpoint when only a single campaignId is given', () => {
    expect(resolveAdsEdgeScope('123', 'cmp_1', undefined)).toEqual({
      path: '/cmp_1/ads',
      needsPostFilter: false,
    });
  });

  it('falls back to the account endpoint with no post-filter when neither is given', () => {
    expect(resolveAdsEdgeScope('123', undefined, undefined)).toEqual({
      path: '/act_123/ads',
      needsPostFilter: false,
    });
  });

  it('falls back to the account endpoint and requires a post-filter when both are given', () => {
    expect(resolveAdsEdgeScope('123', 'cmp_1', 'as_1')).toEqual({
      path: '/act_123/ads',
      needsPostFilter: true,
    });
  });

  it('falls back to the account endpoint and requires a post-filter when adSetId is an array', () => {
    expect(resolveAdsEdgeScope('123', undefined, ['as_1', 'as_2'])).toEqual({
      path: '/act_123/ads',
      needsPostFilter: true,
    });
  });

  it('prefers a single-element array the same as a bare string', () => {
    expect(resolveAdsEdgeScope('123', undefined, ['as_1'])).toEqual({
      path: '/as_1/ads',
      needsPostFilter: false,
    });
  });
});

describe('filterAdsByEntityScope', () => {
  const ads = [
    { id: 'a1', campaign_id: 'cmp_1', adset_id: 'as_1' },
    { id: 'a2', campaign_id: 'cmp_1', adset_id: 'as_2' },
    { id: 'a3', campaign_id: 'cmp_2', adset_id: 'as_1' },
  ];
  const getCampaignId = (ad: (typeof ads)[number]) => ad.campaign_id;
  const getAdSetId = (ad: (typeof ads)[number]) => ad.adset_id;

  it('returns all ads unchanged when neither filter is given', () => {
    expect(filterAdsByEntityScope(ads, undefined, undefined, getCampaignId, getAdSetId)).toEqual(
      ads
    );
  });

  it('keeps only ads matching the given adSetId', () => {
    const result = filterAdsByEntityScope(ads, undefined, 'as_1', getCampaignId, getAdSetId);
    expect(result.map((ad) => ad.id)).toEqual(['a1', 'a3']);
  });

  it('keeps only ads matching both campaignId and adSetId', () => {
    const result = filterAdsByEntityScope(ads, 'cmp_1', 'as_1', getCampaignId, getAdSetId);
    expect(result.map((ad) => ad.id)).toEqual(['a1']);
  });

  it('matches against any id in an array filter', () => {
    const result = filterAdsByEntityScope(
      ads,
      undefined,
      ['as_1', 'as_2'],
      getCampaignId,
      getAdSetId
    );
    expect(result.map((ad) => ad.id)).toEqual(['a1', 'a2', 'a3']);
  });
});
