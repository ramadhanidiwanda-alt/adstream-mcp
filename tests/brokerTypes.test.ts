import { describe, expect, it } from 'vitest';
import {
  ADS_PROVIDER_CAPABILITY_MATRIX,
  ADS_TOOL_CATEGORIES,
  credentialAllowsRequestAccount,
  credentialAllowsRequestProvider,
  credentialHasAnyScope,
  defaultDenyWritePermissionPolicy,
  isAdsProviderId,
  isReadOperation,
} from '../src/broker/types.js';
import type { AdsMetricRecord, AdsProviderId } from '../src/broker/types.js';

describe('Ads MCP Broker rich types and contracts', () => {
  it('accepts only supported provider ids', () => {
    expect(isAdsProviderId('meta')).toBe(true);
    expect(isAdsProviderId('tiktok')).toBe(true);
    expect(isAdsProviderId('google')).toBe(true);
  });

  it('rejects unsupported provider ids', () => {
    expect(isAdsProviderId('shopee')).toBe(false);
    expect(isAdsProviderId('snap')).toBe(false);
    expect(isAdsProviderId('')).toBe(false);
    expect(isAdsProviderId(undefined)).toBe(false);
  });

  it('exposes only approved tool categories', () => {
    expect(ADS_TOOL_CATEGORIES).toEqual([
      'accounts',
      'campaigns',
      'ad_groups',
      'ads',
      'creatives',
      'insights',
      'reports',
      'diagnostics',
    ]);
    expect(ADS_TOOL_CATEGORIES.includes('billing' as never)).toBe(false);
  });

  it('exposes provider capability matrix as the adapter source of truth', () => {
    expect(ADS_PROVIDER_CAPABILITY_MATRIX.meta.operations).toEqual(['read', 'write']);
    expect(ADS_PROVIDER_CAPABILITY_MATRIX.tiktok.operations).toEqual(['read']);
    expect(ADS_PROVIDER_CAPABILITY_MATRIX.google.operations).toEqual(['read']);
    expect(ADS_PROVIDER_CAPABILITY_MATRIX.meta.categories).toContain('reports');
    expect(ADS_PROVIDER_CAPABILITY_MATRIX.tiktok.providers).toEqual(['tiktok']);
    expect(ADS_PROVIDER_CAPABILITY_MATRIX.google.providers).toEqual(['google']);
  });

  it('keeps write operation typed but denied by default', () => {
    const credential = { provider: 'meta' as AdsProviderId, source: 'test' as const };

    expect(isReadOperation('read')).toBe(true);
    expect(isReadOperation('write')).toBe(false);
    expect(defaultDenyWritePermissionPolicy.canRead(credential)).toBe(true);
    expect(defaultDenyWritePermissionPolicy.canWrite(credential)).toBe(false);
    expect(defaultDenyWritePermissionPolicy.requireConfirmation(credential)).toBe(true);
  });

  it('checks credential account, provider, and scope constraints when provided', () => {
    const credential = {
      provider: 'meta' as AdsProviderId,
      accountId: 'act_123',
      allowedAccountIds: ['act_123'],
      scopes: ['ads.read'],
      source: 'test' as const,
    };

    expect(credentialAllowsRequestProvider(credential, { provider: 'meta', params: {} })).toBe(true);
    expect(credentialAllowsRequestProvider(credential, { provider: 'tiktok', params: {} })).toBe(false);
    expect(credentialAllowsRequestAccount(credential, { accountId: 'act_123', params: {} })).toBe(true);
    expect(credentialAllowsRequestAccount(credential, { accountId: 'act_999', params: {} })).toBe(false);
    expect(credentialHasAnyScope(credential, ['ads.read'])).toBe(true);
    expect(credentialHasAnyScope(credential, ['ads.write'])).toBe(false);
  });

  it('accepts a valid Meta AdsMetricRecord sample', () => {
    const record: AdsMetricRecord = {
      provider: 'meta',
      level: 'campaign',
      identity: {
        account_id: 'act_123',
        account_name: 'Main Account',
        campaign_id: 'cmp_123',
        campaign_name: 'Prospecting Campaign',
      },
      setup: {
        objective: 'OUTCOME_SALES',
        status: 'ACTIVE',
        effective_status: 'ACTIVE',
        currency: 'USD',
      },
      time: {
        date_start: '2026-05-01',
        date_stop: '2026-05-07',
        attribution_window: '7d_click',
      },
      delivery: {
        spend: 1250.5,
        impressions: 100000,
        reach: 80000,
        cpm: 12.5,
      },
      clicks: {
        clicks: 2200,
        inline_link_clicks: 1800,
        ctr: 2.2,
        cpc: 0.57,
      },
      commerce: {
        purchases: 40,
        purchase_value: 5000,
        purchase_roas: 4,
      },
      actions: [{ action_type: 'purchase', value: 40, cost_per_action: 31.26 }],
      calculated: {
        conversion_rate: 2.22,
      },
    };

    expect(record.provider).toBe('meta');
    expect(record.delivery.spend).toBe(1250.5);
    expect(typeof record.delivery.impressions).toBe('number');
    expect(record.raw).toBeUndefined();
  });

  it('accepts a valid TikTok AdsMetricRecord sample', () => {
    const record: AdsMetricRecord = {
      provider: 'tiktok',
      level: 'adgroup',
      identity: {
        account_id: 'tt_123',
        campaign_id: 'tt_cmp_123',
        adset_or_adgroup_id: 'tt_adgroup_123',
        adset_or_adgroup_name: 'Broad Ad Group',
        ad_id: 'tt_ad_123',
        ad_name: 'UGC Hook Test',
      },
      setup: {
        objective: 'CONVERSIONS',
        billing_event: 'OCPM',
        status: 'ENABLE',
        currency: 'USD',
      },
      time: {
        date_start: '2026-05-01',
        date_stop: '2026-05-07',
        timezone: 'Asia/Jakarta',
      },
      delivery: {
        spend: 800,
        impressions: 60000,
        reach: 52000,
        frequency: 1.15,
      },
      clicks: {
        clicks: 1500,
        outbound_clicks: 1200,
        ctr: 2.5,
        cpc: 0.53,
      },
      video: {
        video_views: 40000,
        watched_25_percent: 25000,
        watched_100_percent: 8000,
        hook_rate: 66.67,
      },
      conversions: {
        conversions: 25,
        cost_per_conversion: 32,
        conversion_value: 2400,
        roas: 3,
      },
    };

    expect(record.provider).toBe('tiktok');
    expect(record.level).toBe('adgroup');
    expect(typeof record.video?.hook_rate).toBe('number');
    expect(record.raw).toBeUndefined();
  });
});
