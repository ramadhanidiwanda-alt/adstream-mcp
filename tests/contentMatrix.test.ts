import { describe, expect, it } from 'vitest';
import { buildAdsContentMatrix } from '../src/broker/contentMatrix.js';
import type { AdsMetricRecord } from '../src/broker/types.js';

function createRecord(overrides: Partial<AdsMetricRecord> = {}): AdsMetricRecord {
  return {
    provider: 'meta',
    level: 'ad',
    identity: {
      account_id: 'act_1',
      campaign_id: 'cmp_1',
      campaign_name: 'PNP Acne Serum',
      adset_or_adgroup_id: 'adset_1',
      adset_or_adgroup_name: 'Broad',
      ad_id: 'ad_1',
      ad_name: 'Before After Video',
      creative_id: 'creative_1',
      creative_name: 'Before After Creative',
    },
    time: { date_start: '2026-07-01', date_stop: '2026-07-07' },
    delivery: { spend: 100000, impressions: 10000, reach: 8000, cpm: 10000 },
    clicks: { clicks: 200, ctr: 2, cpc: 500 },
    commerce: { purchases: 10, purchase_value: 300000, cost_per_purchase: 10000, purchase_roas: 3 },
    creative: { creative_type: 'video', thumbnail_url: 'https://example.com/thumb.jpg' },
    ...overrides,
  };
}

describe('buildAdsContentMatrix', () => {
  it('groups ad rows by campaign and returns top and bottom rows by selected metric', () => {
    const base = createRecord();
    const matrix = buildAdsContentMatrix(
      [
        createRecord({ identity: { ...base.identity, ad_id: 'ad_1', ad_name: 'A' }, commerce: { purchase_roas: 3 } }),
        createRecord({ identity: { ...base.identity, ad_id: 'ad_2', ad_name: 'B' }, commerce: { purchase_roas: 1 } }),
      ],
      {
        provider: 'meta',
        since: '2026-07-01',
        until: '2026-07-07',
        groupBy: 'campaign',
        sortBy: 'purchase_roas',
        sortDirection: 'desc',
        topLimit: 1,
        bottomLimit: 1,
      }
    );

    expect(matrix.groups).toHaveLength(1);
    expect(matrix.groups[0].top_rows[0].ad_id).toBe('ad_1');
    expect(matrix.groups[0].bottom_rows[0].ad_id).toBe('ad_2');
  });

  it('includes all rows only when requested', () => {
    const matrix = buildAdsContentMatrix([createRecord()], {
      provider: 'meta',
      since: '2026-07-01',
      until: '2026-07-07',
      groupBy: 'campaign',
      includeAllRows: true,
    });

    expect(matrix.groups[0].rows).toHaveLength(1);
  });

  it('does not create recommendations or diagnosis fields', () => {
    const matrix = buildAdsContentMatrix([createRecord()], {
      provider: 'meta',
      since: '2026-07-01',
      until: '2026-07-07',
      groupBy: 'campaign',
    });

    expect(JSON.stringify(matrix)).not.toContain('recommendation');
    expect(JSON.stringify(matrix)).not.toContain('diagnosis');
  });
});
