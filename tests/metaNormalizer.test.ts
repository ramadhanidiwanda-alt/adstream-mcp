import { describe, expect, it } from 'vitest';
import { normalizeMetaInsight } from '../src/providers/meta/normalizer.js';
import type { AccountInsight, AdsetInsight, CampaignInsight } from '../src/types.js';

describe('normalizeMetaInsight', () => {
  it('derives cost-per-result metrics from Meta purchase actions', () => {
    const record = normalizeMetaInsight(
      {
        campaign_id: 'cmp_1',
        spend: '120',
        impressions: '1000',
        clicks: '50',
        actions: [{ action_type: 'purchase', value: '3' }],
        action_values: [{ action_type: 'purchase', value: '360' }],
      },
      {
        level: 'campaign',
        accountId: 'act_123',
        since: '2026-07-01',
        until: '2026-07-07',
      }
    );

    expect(record.conversions).toMatchObject({
      results: 3,
      result_type: 'purchase',
      cost_per_result: 40,
    });
    expect(record.commerce).toMatchObject({ cost_per_purchase: 40 });
  });

  it('maps account-level insight and calculates fallback ROAS from purchase value and spend', () => {
    const insight: AccountInsight = {
      account_id: 'act_123',
      account_name: 'Main Account',
      spend: '200',
      impressions: '2000',
      reach: '1500',
      clicks: '100',
      inline_link_clicks: '80',
      ctr: '5',
      cpc: '2',
      cpm: '100',
      actions: [{ action_type: 'lead', value: '12' }],
      action_values: [{ action_type: 'purchase', value: '1000' }],
    };

    const record = normalizeMetaInsight(insight, {
      level: 'account',
      accountId: 'act_123',
      since: '2026-01-01',
      until: '2026-06-24',
    });

    expect(record.level).toBe('account');
    expect(record.identity.account_name).toBe('Main Account');
    expect(record.delivery.spend).toBe(200);
    expect(record.commerce?.purchase_value).toBe(1000);
    expect(record.commerce?.purchase_roas).toBe(5);
    expect(record.leads?.leads).toBe(12);
  });

  it('converts numeric strings to numbers', () => {
    const insight: CampaignInsight = {
      campaign_id: 'cmp_1',
      campaign_name: 'Campaign 1',
      spend: '123.45',
      impressions: '1000',
      reach: '800',
      clicks: '50',
      inline_link_clicks: '40',
      ctr: '5',
      cpc: '2.469',
      cpm: '123.45',
    };

    const record = normalizeMetaInsight(insight, {
      level: 'campaign',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.delivery.spend).toBe(123.45);
    expect(record.delivery.impressions).toBe(1000);
    expect(record.delivery.reach).toBe(800);
    expect(record.clicks?.clicks).toBe(50);
    expect(record.clicks?.inline_link_clicks).toBe(40);
    expect(record.raw).toBeUndefined();
  });

  it('maps adset fields to adset_or_adgroup identity', () => {
    const insight: AdsetInsight = {
      campaign_id: 'cmp_1',
      campaign_name: 'Campaign 1',
      adset_id: 'adset_1',
      adset_name: 'Adset 1',
      spend: '10',
      impressions: '100',
      reach: '90',
      clicks: '5',
      inline_link_clicks: '4',
      ctr: '5',
      cpc: '2',
      cpm: '100',
    };

    const record = normalizeMetaInsight(insight, {
      level: 'adset',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.identity.adset_or_adgroup_id).toBe('adset_1');
    expect(record.identity.adset_or_adgroup_name).toBe('Adset 1');
  });

  it('handles missing optional fields safely', () => {
    const insight = {
      campaign_id: 'cmp_1',
      campaign_name: 'Campaign 1',
      spend: '0',
      impressions: '0',
      reach: undefined,
      clicks: '0',
      inline_link_clicks: undefined,
      ctr: undefined,
      cpc: undefined,
      cpm: undefined,
    } satisfies CampaignInsight;

    const record = normalizeMetaInsight(insight, {
      level: 'campaign',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.delivery.spend).toBe(0);
    expect(record.delivery.reach).toBeUndefined();
    expect(record.actions).toBeUndefined();
    expect(record.commerce).toBeUndefined();
  });

  it('maps actions, action values, and purchase roas', () => {
    const insight: CampaignInsight = {
      campaign_id: 'cmp_1',
      campaign_name: 'Campaign 1',
      spend: '100',
      impressions: '1000',
      reach: '900',
      clicks: '100',
      inline_link_clicks: '90',
      ctr: '10',
      cpc: '1',
      cpm: '100',
      actions: [
        { action_type: 'purchase', value: '3' },
        { action_type: 'lead', value: '7' },
      ],
      action_values: [{ action_type: 'purchase', value: '300' }],
      purchase_roas: [{ action_type: 'omni_purchase', value: '3' }],
    };

    const record = normalizeMetaInsight(insight, {
      level: 'campaign',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.actions).toEqual([
      { action_type: 'purchase', value: 3 },
      { action_type: 'lead', value: 7 },
    ]);
    expect(record.commerce?.purchases).toBe(3);
    expect(record.commerce?.purchase_value).toBe(300);
    expect(record.commerce?.purchase_roas).toBe(3);
    expect(record.leads?.leads).toBe(7);
    expect(record.conversions?.conversion_value).toBe(300);
    expect(record.conversions?.roas).toBe(3);
  });

  it('maps CPAS catalog dimensions and mode metadata', () => {
    const insight = {
      campaign_id: 'cmp_1',
      campaign_name: 'CPAS Campaign',
      product_id: 'sku_1',
      product_name: 'Hero SKU',
      product_set_id: 'set_1',
      catalog_segment_id: 'segment_1',
      spend: '100',
      impressions: '1000',
      reach: '900',
      clicks: '100',
      inline_link_clicks: '90',
      ctr: '10',
      cpc: '1',
      cpm: '100',
      actions: [{ action_type: 'purchase', value: '4' }],
      action_values: [{ action_type: 'purchase', value: '400' }],
    } satisfies CampaignInsight;

    const record = normalizeMetaInsight(insight, {
      level: 'campaign',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      mode: 'cpas',
    });

    expect(record.setup?.buying_type).toBe('cpas');
    expect(record.dimensions).toMatchObject({
      product_id: 'sku_1',
      product_name: 'Hero SKU',
      product_set_id: 'set_1',
      catalog_segment_id: 'segment_1',
    });
    expect(record.commerce?.purchase_roas).toBe(4);
  });

  it('extracts video metrics from video action fields', () => {
    const insight: CampaignInsight = {
      campaign_id: 'cmp_1',
      campaign_name: 'Video Campaign',
      spend: '500',
      impressions: '50000',
      reach: '30000',
      clicks: '500',
      inline_link_clicks: '400',
      ctr: '1',
      cpc: '1',
      cpm: '10',
      video_play_actions: [{ action_type: 'video_view', value: '15000' }],
      video_thruplay_watched_actions: [{ action_type: 'video_thruplay_watched', value: '8000' }],
      video_p25_watched_actions: [{ action_type: 'video_p25_watched', value: '12000' }],
      video_p50_watched_actions: [{ action_type: 'video_p50_watched', value: '9000' }],
      video_p75_watched_actions: [{ action_type: 'video_p75_watched', value: '6000' }],
      video_p100_watched_actions: [{ action_type: 'video_p100_watched', value: '3000' }],
      video_avg_time_watched_actions: [{ action_type: 'video_avg_time_watched', value: '12.5' }],
    };

    const record = normalizeMetaInsight(insight, {
      level: 'campaign',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.video).toBeDefined();
    expect(record.video?.video_views).toBe(15000);
    expect(record.video?.watched_25_percent).toBe(12000);
    expect(record.video?.watched_50_percent).toBe(9000);
    expect(record.video?.watched_75_percent).toBe(6000);
    expect(record.video?.watched_100_percent).toBe(3000);
    expect(record.video?.average_watch_time).toBe(12.5);
    expect(record.video?.video_view_rate).toBe(0.3);
  });

  it('maps creative_id from ad-level insights', () => {
    const insight = {
      campaign_id: 'cmp_1',
      campaign_name: 'Campaign',
      adset_id: 'adset_1',
      adset_name: 'Adset',
      ad_id: 'ad_1',
      ad_name: 'Hero Ad',
      creative_id: 'creative_1',
      spend: '50',
      impressions: '500',
      reach: '400',
      clicks: '25',
      inline_link_clicks: '20',
      ctr: '5',
      cpc: '2',
      cpm: '100',
    } satisfies CampaignInsight & {
      ad_id: string;
      ad_name: string;
      adset_id: string;
      adset_name: string;
      creative_id: string;
    };

    const record = normalizeMetaInsight(insight, {
      level: 'ad',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.identity.creative_id).toBe('creative_1');
    expect(record.identity.ad_id).toBe('ad_1');
  });

  it('omits video when no video action data is present', () => {
    const insight: CampaignInsight = {
      campaign_id: 'cmp_1',
      campaign_name: 'No Video',
      spend: '10',
      impressions: '100',
      reach: '80',
      clicks: '5',
      inline_link_clicks: '4',
      ctr: '5',
      cpc: '2',
      cpm: '100',
    };

    const record = normalizeMetaInsight(insight, {
      level: 'campaign',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.video).toBeUndefined();
  });
});
