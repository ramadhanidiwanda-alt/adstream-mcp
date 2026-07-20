import type { MetaClient } from '../metaClient.js';
import { analyzePlacementPerformance } from '../analysis/analyzePlacementPerformance.js';
import type {
  AdInsight,
  AdsetInsight,
  CampaignInsight,
  PlacementPerformanceReport,
} from '../types.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import { buildMetaIdFilteringRules } from '../utils/metaFiltering.js';

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

export async function getMetaPlacementPerformance(
  client: MetaClient,
  options: GetMetaPlacementPerformanceOptions
): Promise<PlacementPerformanceReport> {
  const { since, until, level = 'campaign', limit = 200, minSpendShare, minConversions } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);
  const filtering = buildMetaIdFilteringRules([
    { field: 'campaign.id', value: options.campaignId },
    { field: 'adset.id', value: options.adsetId },
    { field: 'ad.id', value: options.adId },
  ]);

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
