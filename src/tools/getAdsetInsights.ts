import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AdsetInsight } from '../types.js';

export interface GetAdsetInsightsOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
}

export async function getAdsetInsights(
  client: MetaClient,
  options: GetAdsetInsightsOptions
): Promise<AdsetInsight[]> {
  const { since, until, limit = 100 } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = [
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

  const response = await client.metaGet<{ data: AdsetInsight[] }>(`/act_${adAccountId}/insights`, {
    level: 'adset',
    fields: fields.join(','),
    time_range: JSON.stringify({ since, until }),
    limit,
  });

  return response.data || [];
}
