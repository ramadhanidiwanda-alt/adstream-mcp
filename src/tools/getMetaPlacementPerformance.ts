import type { MetaClient } from '../metaClient.js';
import { analyzePlacementPerformance } from '../analysis/analyzePlacementPerformance.js';
import type {
  AdInsight,
  AdsetInsight,
  CampaignInsight,
  PlacementPerformanceReport,
} from '../types.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';

export interface GetMetaPlacementPerformanceOptions {
  adAccountId: string;
  since: string;
  until: string;
  level?: 'campaign' | 'adset' | 'ad';
  campaignId?: string | string[];
  adsetId?: string | string[];
  adId?: string | string[];
  limit?: number;
  minSpendShare?: number;
  minConversions?: number;
}

type MetaPlacementInsight = CampaignInsight | AdsetInsight | AdInsight;
type MetaFilteringRule = { field: string; operator: 'IN'; value: string[] };

function toIdList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter((id) => id.trim().length > 0);
}

function buildFiltering(
  options: GetMetaPlacementPerformanceOptions
): MetaFilteringRule[] | undefined {
  const rules: MetaFilteringRule[] = [];
  const campaignIds = toIdList(options.campaignId);
  const adsetIds = toIdList(options.adsetId);
  const adIds = toIdList(options.adId);

  if (campaignIds.length) rules.push({ field: 'campaign.id', operator: 'IN', value: campaignIds });
  if (adsetIds.length) rules.push({ field: 'adset.id', operator: 'IN', value: adsetIds });
  if (adIds.length) rules.push({ field: 'ad.id', operator: 'IN', value: adIds });

  return rules.length ? rules : undefined;
}

export async function getMetaPlacementPerformance(
  client: MetaClient,
  options: GetMetaPlacementPerformanceOptions
): Promise<PlacementPerformanceReport> {
  const { since, until, level = 'campaign', limit = 200, minSpendShare, minConversions } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);
  const filtering = buildFiltering(options);

  const fields = [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'spend',
    'impressions',
    'reach',
    'clicks',
    'inline_link_clicks',
    'ctr',
    'cpc',
    'cpm',
    'actions',
    'action_values',
    'purchase_roas',
  ];

  const response = await client.metaGet<{ data: MetaPlacementInsight[] }>(
    `/act_${adAccountId}/insights`,
    {
      level,
      fields: fields.join(','),
      time_range: JSON.stringify({ since, until }),
      breakdowns: 'publisher_platform,platform_position',
      filtering: filtering ? JSON.stringify(filtering) : undefined,
      limit,
    }
  );

  return analyzePlacementPerformance({
    provider: 'meta',
    since,
    until,
    insights: response.data || [],
    minSpendShare,
    minConversions,
  });
}
