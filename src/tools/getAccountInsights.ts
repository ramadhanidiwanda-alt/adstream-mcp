import type { MetaClient, MetaGetOptions } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AccountInsight, PaginationOptions } from '../types.js';

export interface GetAccountInsightsOptions extends PaginationOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
}

export async function getAccountInsights(
  client: MetaClient,
  options: GetAccountInsightsOptions
): Promise<AccountInsight[]> {
  const { since, until, limit = 100, paginate = false, maxPages, pageDelay } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = [
    'account_id',
    'account_name',
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

  const response = await client.metaGet<{ data: AccountInsight[] }>(
    `/act_${adAccountId}/insights`,
    {
      level: 'account',
      fields: fields.join(','),
      time_range: JSON.stringify({ since, until }),
      limit,
    },
    metaOptions
  );

  return response.data || [];
}
