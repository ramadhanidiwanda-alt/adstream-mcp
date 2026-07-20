import type { MetaClient, MetaGetOptions } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import {
  buildMetaIdFilteringRules,
  mergeMetaFilteringRules,
  type MetaFilteringRule,
} from '../utils/metaFiltering.js';
import type { CampaignInsight, InsightBreakdownOptions, PaginationOptions } from '../types.js';

export interface GetCampaignInsightsOptions extends InsightBreakdownOptions, PaginationOptions {
  adAccountId: string;
  since: string;
  until: string;
  limit?: number;
  cursor?: string;
  /** Restrict results to specific campaign id(s). */
  campaignId?: string | string[];
  /** Caller-supplied Meta filtering rules (already {field, operator, value} shaped), merged with campaignId. */
  explicitFilters?: MetaFilteringRule[];
}

export type CampaignInsightPage = CampaignInsight[] & { paging?: { cursors?: { after?: string } } };

export async function getCampaignInsights(
  client: MetaClient,
  options: GetCampaignInsightsOptions
): Promise<CampaignInsight[]> {
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
    buildMetaIdFilteringRules([{ field: 'campaign.id', value: options.campaignId }]),
    options.explicitFilters
  );

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
    data: CampaignInsight[];
    paging?: { cursors?: { after?: string } };
  }>(
    `/act_${adAccountId}/insights`,
    {
      level: 'campaign',
      fields: fields.join(','),
      time_range: JSON.stringify({ since, until }),
      breakdowns: breakdowns?.join(','),
      filtering: filtering ? JSON.stringify(filtering) : undefined,
      limit,
      after: cursor,
    },
    metaOptions
  );

  return Object.assign(response.data || [], { paging: response.paging }) as CampaignInsightPage;
}
