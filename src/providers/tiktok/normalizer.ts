import type { AdsEntityLevel, AdsMetricRecord } from '../../broker/types.js';

export interface TikTokInsightRecord {
  advertiser_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  adgroup_id?: string;
  adgroup_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string | number;
  impressions?: string | number;
  reach?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  conversions?: string | number;
  conversion_value?: string | number;
  roas?: string | number;
  video_views?: string | number;
  video_view_rate?: string | number;
  average_watch_time?: string | number;
  watched_25_percent?: string | number;
  watched_50_percent?: string | number;
  watched_75_percent?: string | number;
  watched_100_percent?: string | number;
}

export interface NormalizeTikTokInsightOptions {
  level: Extract<AdsEntityLevel, 'account' | 'campaign' | 'adgroup' | 'ad' | 'creative'>;
  accountId: string;
  since: string;
  until: string;
  includeRaw?: boolean;
}

export function normalizeTikTokInsight(
  insight: TikTokInsightRecord,
  options: NormalizeTikTokInsightOptions
): AdsMetricRecord {
  const conversionValue = optionalNumber(insight.conversion_value);
  const roas = optionalNumber(insight.roas);

  const record: AdsMetricRecord = {
    provider: 'tiktok',
    level: options.level,
    identity: {
      account_id: options.accountId,
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      adset_or_adgroup_id: insight.adgroup_id,
      adset_or_adgroup_name: insight.adgroup_name,
      ad_id: insight.ad_id,
      ad_name: insight.ad_name,
    },
    time: {
      date_start: options.since,
      date_stop: options.until,
    },
    delivery: {
      spend: toNumber(insight.spend),
      impressions: toNumber(insight.impressions),
      reach: optionalNumber(insight.reach),
      cpm: optionalNumber(insight.cpm),
    },
    clicks: {
      clicks: toNumber(insight.clicks),
      ctr: optionalNumber(insight.ctr),
      cpc: optionalNumber(insight.cpc),
    },
  };

  const conversions = optionalNumber(insight.conversions);
  if (conversions !== undefined || conversionValue !== undefined || roas !== undefined) {
    record.conversions = {
      conversions,
      conversion_value: conversionValue,
      roas,
    };
  }

  if (hasVideoMetrics(insight)) {
    record.video = {
      video_views: optionalNumber(insight.video_views),
      video_view_rate: optionalNumber(insight.video_view_rate),
      average_watch_time: optionalNumber(insight.average_watch_time),
      watched_25_percent: optionalNumber(insight.watched_25_percent),
      watched_50_percent: optionalNumber(insight.watched_50_percent),
      watched_75_percent: optionalNumber(insight.watched_75_percent),
      watched_100_percent: optionalNumber(insight.watched_100_percent),
    };
  }

  if (options.includeRaw) {
    record.raw = insight;
  }

  return record;
}

export function normalizeTikTokInsights(
  insights: TikTokInsightRecord[],
  options: NormalizeTikTokInsightOptions
): AdsMetricRecord[] {
  return insights.map((insight) => normalizeTikTokInsight(insight, options));
}

function hasVideoMetrics(insight: TikTokInsightRecord): boolean {
  return (
    insight.video_views !== undefined ||
    insight.video_view_rate !== undefined ||
    insight.average_watch_time !== undefined ||
    insight.watched_25_percent !== undefined ||
    insight.watched_50_percent !== undefined ||
    insight.watched_75_percent !== undefined ||
    insight.watched_100_percent !== undefined
  );
}

function toNumber(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
