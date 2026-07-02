import { describe, expect, it } from 'vitest';
import { normalizeGoogleAdsRow } from '../src/providers/google/normalizer.js';

const baseMetrics = {
  costMicros: '123450000',
  impressions: '1000',
  clicks: '50',
  ctr: 0.05,
  averageCpc: '2469000',
  averageCpm: '123450000',
  conversions: 7,
  conversionsValue: 700,
};

describe('normalizeGoogleAdsRow', () => {
  it('normalizes campaign GAQL rows into AdsMetricRecord', () => {
    const record = normalizeGoogleAdsRow({
      customer: { id: '1234567890', descriptiveName: 'Main Account', currencyCode: 'IDR' },
      campaign: { id: '111', name: 'Search Campaign', status: 'ENABLED', advertisingChannelType: 'SEARCH' },
      metrics: baseMetrics,
      segments: { date: '2026-05-01' },
    }, {
      level: 'campaign',
      accountId: '1234567890',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record).toMatchObject({
      provider: 'google',
      level: 'campaign',
      identity: {
        account_id: '1234567890',
        account_name: 'Main Account',
        campaign_id: '111',
        campaign_name: 'Search Campaign',
      },
      setup: {
        status: 'ENABLED',
        objective: 'SEARCH',
        currency: 'IDR',
      },
      delivery: {
        spend: 123.45,
        impressions: 1000,
        cpm: 123.45,
      },
      clicks: {
        clicks: 50,
        ctr: 5,
        cpc: 2.469,
      },
      conversions: {
        conversions: 7,
        conversion_value: 700,
        roas: 5.6703,
      },
    });
    expect(record.raw).toBeUndefined();
  });

  it('maps ad group and ad identities', () => {
    const record = normalizeGoogleAdsRow({
      customer: { id: '1234567890' },
      campaign: { id: '111', name: 'Campaign' },
      adGroup: { id: '222', name: 'Ad Group', status: 'ENABLED' },
      adGroupAd: { ad: { id: '333', name: 'Responsive Search Ad' }, status: 'ENABLED' },
      metrics: baseMetrics,
    }, {
      level: 'ad',
      accountId: '1234567890',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(record.identity).toMatchObject({
      campaign_id: '111',
      adset_or_adgroup_id: '222',
      adset_or_adgroup_name: 'Ad Group',
      ad_id: '333',
      ad_name: 'Responsive Search Ad',
    });
  });
});
