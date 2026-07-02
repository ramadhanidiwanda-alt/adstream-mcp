import type { AdsEntityLevel, AdsMetricRecord } from '../../broker/types.js';

export interface GoogleAdsMetrics {
  costMicros?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  averageCpc?: string | number;
  averageCpm?: string | number;
  conversions?: string | number;
  conversionsValue?: string | number;
}

export interface GoogleAdsRow {
  customer?: {
    id?: string | number;
    descriptiveName?: string;
    currencyCode?: string;
  };
  campaign?: {
    id?: string | number;
    name?: string;
    status?: string;
    advertisingChannelType?: string;
  };
  adGroup?: {
    id?: string | number;
    name?: string;
    status?: string;
  };
  adGroupAd?: {
    status?: string;
    ad?: {
      id?: string | number;
      name?: string;
      type?: string;
    };
  };
  metrics?: GoogleAdsMetrics;
  segments?: {
    date?: string;
  };
}

export interface NormalizeGoogleAdsRowOptions {
  level: Extract<AdsEntityLevel, 'account' | 'campaign' | 'adgroup' | 'ad'>;
  accountId: string;
  since: string;
  until: string;
  includeRaw?: boolean;
}

export function normalizeGoogleAdsRow(row: GoogleAdsRow, options: NormalizeGoogleAdsRowOptions): AdsMetricRecord {
  const metrics = row.metrics ?? {};
  const spend = microsToUnit(metrics.costMicros);
  const conversionValue = optionalNumber(metrics.conversionsValue);
  const conversions = optionalNumber(metrics.conversions);
  const record: AdsMetricRecord = {
    provider: 'google',
    level: options.level,
    identity: {
      account_id: toStringValue(row.customer?.id) ?? options.accountId,
      account_name: row.customer?.descriptiveName,
      campaign_id: toStringValue(row.campaign?.id),
      campaign_name: row.campaign?.name,
      adset_or_adgroup_id: toStringValue(row.adGroup?.id),
      adset_or_adgroup_name: row.adGroup?.name,
      ad_id: toStringValue(row.adGroupAd?.ad?.id),
      ad_name: row.adGroupAd?.ad?.name,
    },
    setup: {
      objective: row.campaign?.advertisingChannelType,
      status: row.adGroupAd?.status ?? row.adGroup?.status ?? row.campaign?.status,
      currency: row.customer?.currencyCode,
    },
    time: {
      date_start: options.since,
      date_stop: options.until,
    },
    delivery: {
      spend,
      impressions: toNumber(metrics.impressions),
      cpm: microsToOptionalUnit(metrics.averageCpm),
    },
    clicks: {
      clicks: toNumber(metrics.clicks),
      ctr: ratioToPercent(metrics.ctr),
      cpc: microsToOptionalUnit(metrics.averageCpc),
    },
  };

  if (conversions !== undefined || conversionValue !== undefined) {
    record.conversions = {
      conversions,
      conversion_value: conversionValue,
      roas: calculateRoas(conversionValue, spend),
    };
  }

  if (options.includeRaw) record.raw = row;
  return record;
}

export function normalizeGoogleAdsRows(rows: GoogleAdsRow[], options: NormalizeGoogleAdsRowOptions): AdsMetricRecord[] {
  return rows.map((row) => normalizeGoogleAdsRow(row, options));
}

function toStringValue(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

function toNumber(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function microsToUnit(value: string | number | undefined): number {
  return toNumber(value) / 1_000_000;
}

function microsToOptionalUnit(value: string | number | undefined): number | undefined {
  const parsed = optionalNumber(value);
  return parsed === undefined ? undefined : parsed / 1_000_000;
}

function ratioToPercent(value: string | number | undefined): number | undefined {
  const parsed = optionalNumber(value);
  return parsed === undefined ? undefined : parsed * 100;
}

function calculateRoas(value: number | undefined, spend: number): number | undefined {
  if (value === undefined || spend <= 0) return undefined;
  return Number((value / spend).toFixed(4));
}
