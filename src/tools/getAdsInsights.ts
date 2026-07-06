import type { MetaClient, MetaGetOptions } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AdInsight, InsightBreakdownOptions, PaginationOptions } from '../types.js';

export interface GetAdsInsightsOptions
  extends InsightBreakdownOptions,
    PaginationOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
  cursor?: string;
}

export type AdInsightPage = AdInsight[] & { paging?: { cursors?: { after?: string } } };

export async function getAdsInsights(
  client: MetaClient,
  options: GetAdsInsightsOptions
): Promise<AdInsight[]> {
  const { since, until, limit = 100, breakdowns, paginate = false, maxPages, pageDelay, cursor } = options;
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
    'video_play_actions',
    'video_thruplay_watched_actions',
    'video_30_sec_watched_actions',
    'video_p25_watched_actions',
    'video_p50_watched_actions',
    'video_p75_watched_actions',
    'video_p100_watched_actions',
    'video_avg_time_watched_actions',
    'creative_id',
  ];

  const metaOptions: MetaGetOptions = {
    paginate,
    maxPages,
    pageDelay,
  };

  const response = await client.metaGet<{ data: AdInsight[]; paging?: { cursors?: { after?: string } } }>(`/act_${adAccountId}/insights`, {
    level: 'ad',
    fields: fields.join(','),
    time_range: JSON.stringify({ since, until }),
    breakdowns: breakdowns?.join(','),
    limit,
    after: cursor,
  }, metaOptions);

  return Object.assign(response.data || [], { paging: response.paging }) as AdInsightPage;
}
