import type { AdInsight, AdsetInsight, CampaignInsight } from '../../types.js';
import type { AdsEntityLevel, AdsMetricRecord, AdsActionMetric } from '../../broker/types.js';

export type MetaInsightRecord = CampaignInsight | AdsetInsight | AdInsight;

export interface NormalizeMetaInsightOptions {
  level: Extract<AdsEntityLevel, 'campaign' | 'adset' | 'ad'>;
  accountId: string;
  since: string;
  until: string;
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
  const purchaseRoas = firstNumericValue(insight.purchase_roas);

  const record: AdsMetricRecord = {
    provider: 'meta',
    level: options.level,
    identity: {
      account_id: options.accountId,
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
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
      spend: toNumber(insight.spend),
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
  };

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

  if (insight.country !== undefined || insight.region !== undefined || insight.dma !== undefined) {
    record.dimensions = {
      country: insight.country,
      region: insight.region,
      dma: insight.dma,
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
