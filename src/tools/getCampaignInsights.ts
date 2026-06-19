import type { MetaClient, MetaGetOptions } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { CampaignInsight, InsightBreakdownOptions, PaginationOptions } from '../types.js';

export interface GetCampaignInsightsOptions
  extends InsightBreakdownOptions,
    PaginationOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
}

export async function getCampaignInsights(
  client: MetaClient,
  options: GetCampaignInsightsOptions
): Promise<CampaignInsight[]> {
  const { since, until, limit = 100, breakdowns, paginate = false, maxPages, pageDelay } = options;
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

  const metaOptions: MetaGetOptions = {
    paginate,
    maxPages,
    pageDelay,
  };

  const response = await client.metaGet<{ data: CampaignInsight[] }>(
    `/act_${adAccountId}/insights`,
    {
      level: 'campaign',
      fields: fields.join(','),
      time_range: JSON.stringify({ since, until }),
      breakdowns: breakdowns?.join(','),
      limit,
    },
    metaOptions
  );

  return response.data || [];
}
