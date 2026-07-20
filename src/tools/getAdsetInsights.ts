import type { MetaClient, MetaGetOptions } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import {
  buildMetaIdFilteringRules,
  mergeMetaFilteringRules,
  type MetaFilteringRule,
} from '../utils/metaFiltering.js';
import type { AdsetInsight, InsightBreakdownOptions, PaginationOptions } from '../types.js';

export interface GetAdsetInsightsOptions extends InsightBreakdownOptions, PaginationOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
  cursor?: string;
  /** Restrict results to specific campaign id(s). */
  campaignId?: string | string[];
  /** Restrict results to specific ad set id(s). */
  adsetId?: string | string[];
  /** Caller-supplied Meta filtering rules, merged with campaignId/adsetId. */
  explicitFilters?: MetaFilteringRule[];
}

export type AdsetInsightPage = AdsetInsight[] & { paging?: { cursors?: { after?: string } } };

export async function getAdsetInsights(
  client: MetaClient,
  options: GetAdsetInsightsOptions
): Promise<AdsetInsight[]> {
  const {
    since,
    until,
    limit = 100,
    breakdowns,
    paginate = false,
    maxPages,
    pageDelay,
    cursor,
  } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);
  const filtering = mergeMetaFilteringRules(
    buildMetaIdFilteringRules([
      { field: 'campaign.id', value: options.campaignId },
      { field: 'adset.id', value: options.adsetId },
    ]),
    options.explicitFilters
  );

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

  const response = await client.metaGet<{
    data: AdsetInsight[];
    paging?: { cursors?: { after?: string } };
  }>(
    `/act_${adAccountId}/insights`,
    {
      level: 'adset',
      fields: fields.join(','),
      time_range: JSON.stringify({ since, until }),
      breakdowns: breakdowns?.join(','),
      filtering: filtering ? JSON.stringify(filtering) : undefined,
      limit,
      after: cursor,
    },
    metaOptions
  );

  return Object.assign(response.data || [], { paging: response.paging }) as AdsetInsightPage;
}
