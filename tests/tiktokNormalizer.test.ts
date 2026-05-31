import { describe, expect, it } from 'vitest';
import { normalizeTikTokInsight } from '../src/providers/tiktok/normalizer.js';

describe('normalizeTikTokInsight', () => {
  it('maps adgroup fields to adset_or_adgroup identity', () => {
    const record = normalizeTikTokInsight(
      {
        campaign_id: 'cmp_1',
        campaign_name: 'Campaign 1',
        adgroup_id: 'adgroup_1',
        adgroup_name: 'Ad Group 1',
        spend: '10',
        impressions: '100',
        clicks: '5',
      },
      { level: 'adgroup', accountId: 'advertiser_1', since: '2026-05-01', until: '2026-05-07' }
    );

    expect(record.identity.adset_or_adgroup_id).toBe('adgroup_1');
    expect(record.identity.adset_or_adgroup_name).toBe('Ad Group 1');
  });

  it('converts numeric strings to numbers', () => {
    const record = normalizeTikTokInsight(
      {
        spend: '123.45',
        impressions: '1000',
        clicks: '50',
        ctr: '5.5',
        cpc: '2.469',
        cpm: '123.45',
        conversions: '7',
        conversion_value: '700',
        roas: '5.67',
      },
      { level: 'campaign', accountId: 'advertiser_1', since: '2026-05-01', until: '2026-05-07' }
    );

    expect(record.delivery.spend).toBe(123.45);
    expect(record.delivery.impressions).toBe(1000);
    expect(record.clicks?.clicks).toBe(50);
    expect(record.clicks?.ctr).toBe(5.5);
    expect(record.conversions?.conversions).toBe(7);
    expect(record.conversions?.conversion_value).toBe(700);
    expect(record.conversions?.roas).toBe(5.67);
    expect(record.raw).toBeUndefined();
  });

  it('handles video metrics', () => {
    const record = normalizeTikTokInsight(
      {
        spend: 1,
        impressions: 10,
        clicks: 2,
        video_views: '8',
        video_view_rate: '80',
        average_watch_time: '4.5',
        watched_25_percent: '6',
        watched_50_percent: '5',
        watched_75_percent: '4',
        watched_100_percent: '3',
      },
      { level: 'ad', accountId: 'advertiser_1', since: '2026-05-01', until: '2026-05-07' }
    );

    expect(record.video?.video_views).toBe(8);
    expect(record.video?.video_view_rate).toBe(80);
    expect(record.video?.average_watch_time).toBe(4.5);
    expect(record.video?.watched_100_percent).toBe(3);
  });

  it('only includes raw when requested', () => {
    const insight = { spend: '1', impressions: '2', clicks: '3' };
    const record = normalizeTikTokInsight(insight, {
      level: 'campaign',
      accountId: 'advertiser_1',
      since: '2026-05-01',
      until: '2026-05-07',
      includeRaw: true,
    });

    expect(record.raw).toBe(insight);
  });
});
