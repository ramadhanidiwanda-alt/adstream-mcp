import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AdInsight, InsightBreakdownOptions } from '../types.js';

export interface GetAdsInsightsOptions extends InsightBreakdownOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
}

export async function getAdsInsights(
  client: MetaClient,
  options: GetAdsInsightsOptions
): Promise<AdInsight[]> {
  const { since, until, limit = 100, breakdowns } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = [
    'ad_id',
    'ad_name',
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
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

  const response = await client.metaGet<{ data: AdInsight[] }>(`/act_${adAccountId}/insights`, {
    level: 'ad',
    fields: fields.join(','),
    time_range: JSON.stringify({ since, until }),
    breakdowns: breakdowns?.join(','),
    limit,
  });

  return response.data || [];
}
