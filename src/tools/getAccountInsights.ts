import type { MetaClient, MetaGetOptions } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AccountInsight, PaginationOptions } from '../types.js';

export interface GetAccountInsightsOptions extends PaginationOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
  cursor?: string;
}

export type AccountInsightPage = AccountInsight[] & { paging?: { cursors?: { after?: string } } };

export async function getAccountInsights(
  client: MetaClient,
  options: GetAccountInsightsOptions
): Promise<AccountInsight[]> {
  const { since, until, limit = 100, paginate = false, maxPages, pageDelay, cursor } = options;
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
    'video_play_actions',
    'video_thruplay_watched_actions',
    'video_30_sec_watched_actions',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p100_watched_actions',
    'video_avg_time_watched_actions',
  ];

  const metaOptions: MetaGetOptions = {
    paginate,
    maxPages,
    pageDelay,
  };

  const response = await client.metaGet<{ data: AccountInsight[]; paging?: { cursors?: { after?: string } } }>(
    `/act_${adAccountId}/insights`,
    {
      level: 'account',
      fields: fields.join(','),
      time_range: JSON.stringify({ since, until }),
      limit,
      after: cursor,
    },
    metaOptions
  );

  return Object.assign(response.data || [], { paging: response.paging }) as AccountInsightPage;
}
