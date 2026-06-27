import { describe, expect, it } from 'vitest';
import {
  analyzePlacementPerformance,
  getMetaPlacementPerformance,
  type CampaignInsight,
  type MetaClient,
} from '../src/index.js';

function insight(overrides: Partial<CampaignInsight> = {}): CampaignInsight {
  return {
    campaign_id: 'cmp_1',
    campaign_name: 'Campaign 1',
    publisher_platform: 'instagram',
    platform_position: 'reels',
    spend: '100',
    impressions: '1000',
    reach: '900',
    clicks: '50',
    inline_link_clicks: '40',
    ctr: '5',
    cpc: '2',
    cpm: '100',
    actions: [{ action_type: 'purchase', value: '5' }],
    action_values: [{ action_type: 'purchase', value: '500' }],
    ...overrides,
  };
}

describe('analyzePlacementPerformance', () => {
  it('ranks placement performance with simple recommendations', () => {
    const report = analyzePlacementPerformance({
      provider: 'meta',
      since: '2026-06-01',
      until: '2026-06-14',
      insights: [
        insight({
          publisher_platform: 'instagram',
          platform_position: 'reels',
          spend: '100',
          clicks: '50',
          impressions: '1000',
          actions: [{ action_type: 'purchase', value: '10' }],
          action_values: [{ action_type: 'purchase', value: '1000' }],
        }),
        insight({
          publisher_platform: 'facebook',
          platform_position: 'feed',
          spend: '300',
          clicks: '30',
          impressions: '3000',
          actions: [{ action_type: 'purchase', value: '3' }],
          action_values: [{ action_type: 'purchase', value: '150' }],
        }),
        insight({
          publisher_platform: 'audience_network',
          platform_position: 'rewarded_video',
          spend: '10',
          clicks: '2',
          impressions: '200',
          actions: [{ action_type: 'purchase', value: '0' }],
          action_values: [{ action_type: 'purchase', value: '0' }],
        }),
      ],
    });

    expect(report.totals.spend).toBe(410);
    expect(report.placements).toHaveLength(3);
    expect(report.summary.best?.platform).toBe('instagram');
    expect(report.summary.best?.placement).toBe('reels');
    expect(report.summary.worst?.platform).toBe('facebook');
    expect(report.summary.insufficient_data[0].platform).toBe('audience_network');
    expect(report.warnings).toContain(
      'Some placements have insufficient data; avoid cutting them too early'
    );
  });

  it('handles empty insights', () => {
    const report = analyzePlacementPerformance({
      provider: 'meta',
      since: '2026-06-01',
      until: '2026-06-14',
      insights: [],
    });

    expect(report.placements).toHaveLength(0);
    expect(report.totals.spend).toBe(0);
    expect(report.warnings).toContain('No placement insight data returned from ads API');
  });
});

describe('getMetaPlacementPerformance', () => {
  it('requests Meta insights with platform and placement breakdowns', async () => {
    const calls: Array<{ path: string; params: Record<string, unknown> }> = [];
    const client = {
      metaGet: async (path: string, params: Record<string, unknown>) => {
        calls.push({ path, params });
        return { data: [insight()] };
      },
    } as unknown as MetaClient;

    const report = await getMetaPlacementPerformance(client, {
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-14',
      level: 'adset',
      limit: 25,
    });

    expect(calls[0].path).toBe('/act_123/insights');
    expect(calls[0].params.level).toBe('adset');
    expect(calls[0].params.breakdowns).toBe('publisher_platform,platform_position');
    expect(calls[0].params.limit).toBe(25);
    expect(report.provider).toBe('meta');
    expect(report.placements[0].platform).toBe('instagram');
  });

  it('adds entity filters to Meta insights requests', async () => {
    const calls: Array<{ path: string; params: Record<string, unknown> }> = [];
    const client = {
      metaGet: async (path: string, params: Record<string, unknown>) => {
        calls.push({ path, params });
        return { data: [insight()] };
      },
    } as unknown as MetaClient;

    await getMetaPlacementPerformance(client, {
      adAccountId: '123',
      since: '2026-06-01',
      until: '2026-06-14',
      campaignId: ['cmp_1', 'cmp_2'],
      adsetId: 'adset_1',
      adId: 'ad_1',
    });

    expect(calls[0].path).toBe('/act_123/insights');
    expect(JSON.parse(calls[0].params.filtering as string)).toEqual([
      { field: 'campaign.id', operator: 'IN', value: ['cmp_1', 'cmp_2'] },
      { field: 'adset.id', operator: 'IN', value: ['adset_1'] },
      { field: 'ad.id', operator: 'IN', value: ['ad_1'] },
    ]);
  });
});
