import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { CampaignInsight } from '../types.js';

export interface GetCampaignInsightsOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
}

export async function getCampaignInsights(
  client: MetaClient,
  options: GetCampaignInsightsOptions
): Promise<CampaignInsight[]> {
  const { since, until, limit = 100 } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = [
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

  const response = await client.metaGet<{ data: CampaignInsight[] }>(
    `/act_${adAccountId}/insights`,
    {
      level: 'campaign',
      fields: fields.join(','),
      time_range: JSON.stringify({ since, until }),
      limit,
    }
  );

  return response.data || [];
}
