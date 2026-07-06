import type { AccountInsight, AdInsight, AdsetInsight, CampaignInsight } from '../../types.js';
import type { AdsEntityLevel, AdsMetricRecord, AdsActionMetric, AdsVideoMetrics } from '../../broker/types.js';

export type MetaInsightRecord = AccountInsight | CampaignInsight | AdsetInsight | AdInsight;

export interface NormalizeMetaInsightOptions {
  level: Extract<AdsEntityLevel, 'account' | 'campaign' | 'adset' | 'ad'>;
  accountId: string;
  since: string;
  until: string;
  mode?: 'standard' | 'cpas';
  includeRaw?: boolean;
}

export function normalizeMetaInsight(
  insight: MetaInsightRecord,
  options: NormalizeMetaInsightOptions
): AdsMetricRecord {
  const actions = normalizeActions(insight.actions);
  const purchases = findActionValue(actions, 'purchase');
  const leads = findActionValue(actions, 'lead');
  const purchaseValue = findActionValueFromValues(insight.action_values, 'purchase');
  const purchaseRoasFromMeta = firstNumericValue(insight.purchase_roas);
  const spend = toNumber(insight.spend);
  const purchaseRoas = purchaseRoasFromMeta ?? calculateRoas(findActionValueFromValues(insight.action_values, 'purchase'), spend);
  const videoActions = normalizeVideoActions(insight as MetaInsightRecord);

  const record: AdsMetricRecord = {
    provider: 'meta',
    level: options.level,
    identity: {
      account_id: 'account_id' in insight && insight.account_id ? insight.account_id : options.accountId,
      account_name: 'account_name' in insight ? insight.account_name : undefined,
      campaign_id: 'campaign_id' in insight ? insight.campaign_id : undefined,
      campaign_name: 'campaign_name' in insight ? insight.campaign_name : undefined,
      adset_or_adgroup_id: 'adset_id' in insight ? insight.adset_id : undefined,
      adset_or_adgroup_name: 'adset_name' in insight ? insight.adset_name : undefined,
      ad_id: 'ad_id' in insight ? insight.ad_id : undefined,
      ad_name: 'ad_name' in insight ? insight.ad_name : undefined,
    },
    time: {
      date_start: options.since,
      date_stop: options.until,
    },
    delivery: {
      spend,
      impressions: toNumber(insight.impressions),
      reach: optionalNumber(insight.reach),
      cpm: optionalNumber(insight.cpm),
    },
    clicks: {
      clicks: toNumber(insight.clicks),
      inline_link_clicks: optionalNumber(insight.inline_link_clicks),
      ctr: optionalNumber(insight.ctr),
      cpc: optionalNumber(insight.cpc),
    },
    actions,
    video: videoActions,
  };

  // Map creative_id from ad-level insights
  if ('creative_id' in insight && insight.creative_id) {
    record.identity.creative_id = insight.creative_id;
  }

  if (options.mode === 'cpas') {
    record.setup = {
      ...record.setup,
      buying_type: 'cpas',
    };
  }

  if (purchases !== undefined || purchaseValue !== undefined || purchaseRoas !== undefined) {
    record.commerce = {
      purchases,
      purchase_value: purchaseValue,
      purchase_roas: purchaseRoas,
    };
  }

  if (leads !== undefined) {
    record.leads = { leads };
  }

  const country = 'country' in insight ? insight.country : undefined;
  const region = 'region' in insight ? insight.region : undefined;
  const dma = 'dma' in insight ? insight.dma : undefined;
  const productId = 'product_id' in insight ? insight.product_id : undefined;
  const productName = 'product_name' in insight ? insight.product_name : undefined;
  const productSetId = 'product_set_id' in insight ? insight.product_set_id : undefined;
  const catalogSegmentId = 'catalog_segment_id' in insight ? insight.catalog_segment_id : undefined;

  if (
    country !== undefined ||
    region !== undefined ||
    dma !== undefined ||
    productId !== undefined ||
    productName !== undefined ||
    productSetId !== undefined ||
    catalogSegmentId !== undefined
  ) {
    record.dimensions = {
      country,
      region,
      dma,
      product_id: productId,
      product_name: productName,
      product_set_id: productSetId,
      catalog_segment_id: catalogSegmentId,
    };
  }

  if (purchaseValue !== undefined || purchaseRoas !== undefined) {
    record.conversions = {
      conversion_value: purchaseValue,
      roas: purchaseRoas,
    };
  }

  if (!record.actions?.length) {
    delete record.actions;
  }

  if (options.includeRaw) {
    record.raw = insight;
  }

  return record;
}

export function normalizeMetaInsights(
  insights: MetaInsightRecord[],
  options: NormalizeMetaInsightOptions
): AdsMetricRecord[] {
  return insights.map((insight) => normalizeMetaInsight(insight, options));
}

function normalizeActions(actions: MetaInsightRecord['actions']): AdsActionMetric[] {
  return (actions ?? []).map((action) => ({
    action_type: action.action_type,
    value: toNumber(action.value),
  }));
}

function normalizeVideoActions(insight: MetaInsightRecord): AdsVideoMetrics | undefined {
  const impressions = toNumber(insight.impressions);
  const views = findActionValueByArray(insight.video_play_actions);
  const thruplay = findActionValueByArray(insight.video_thruplay_watched_actions);
  const watched25 = findActionValueByArray(insight.video_p25_watched_actions);
  const watched50 = findActionValueByArray(insight.video_p50_watched_actions);
  const watched75 = findActionValueByArray(insight.video_p75_watched_actions);
  const watched100 = findActionValueByArray(insight.video_p100_watched_actions);
  const avgWatchTime = findActionValueByArray(insight.video_avg_time_watched_actions);

  if (views === undefined && thruplay === undefined && avgWatchTime === undefined) {
    return undefined;
  }

  return {
    video_views: views,
    ...(thruplay !== undefined ? { watched_25_percent: thruplay } : {}),
    ...(watched25 !== undefined ? { watched_25_percent: watched25 } : {}),
    ...(watched50 !== undefined ? { watched_50_percent: watched50 } : {}),
    ...(watched75 !== undefined ? { watched_75_percent: watched75 } : {}),
    ...(watched100 !== undefined ? { watched_100_percent: watched100 } : {}),
    ...(avgWatchTime !== undefined ? { average_watch_time: avgWatchTime } : {}),
    ...(views !== undefined && impressions > 0 ? { video_view_rate: views / impressions } : {}),
  };
}

function findActionValueByArray(values: Array<{ value: string }> | undefined): number | undefined {
  if (!values || values.length === 0) return undefined;
  const val = values[0]?.value;
  return optionalNumber(val);
}

function findActionValue(actions: AdsActionMetric[], actionType: string): number | undefined {
  return actions.find((action) => action.action_type === actionType)?.value;
}

function findActionValueFromValues(
  values: MetaInsightRecord['action_values'],
  actionType: string
): number | undefined {
  const value = values?.find((action) => action.action_type === actionType)?.value;
  return optionalNumber(value);
}

function firstNumericValue(values: Array<{ value: string }> | undefined): number | undefined {
  return optionalNumber(values?.[0]?.value);
}

function toNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function calculateRoas(value: number | undefined, spend: number): number | undefined {
  if (value === undefined || spend <= 0) {
    return undefined;
  }

  return value / spend;
}
