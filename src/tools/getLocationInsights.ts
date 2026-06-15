import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import { assertLocationBreakdowns } from '../utils/locationBreakdowns.js';
import { getCampaignInsights } from './getCampaignInsights.js';
import { getAdsetInsights } from './getAdsetInsights.js';
import { getAdsInsights } from './getAdsInsights.js';
import { summarizeLocationInsights, summarizeNestedLocationInsights } from '../analysis/summarizeLocationInsights.js';
import type { LocationBreakdown, LocationInsightSummary, InsightBreakdownOptions } from '../types.js';

export interface GetLocationInsightsOptions extends InsightBreakdownOptions {
  adAccountId: string;
  since: string;
  until: string;
  level?: 'campaign' | 'adset' | 'ad';
  sortBy?: 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'cpm';
  sortDirection?: 'asc' | 'desc';
  minSpend?: number;
  minClicks?: number;
  limit?: number;
}

export async function getLocationInsights(
  client: MetaClient,
  options: GetLocationInsightsOptions
): Promise<LocationInsightSummary> {
  const {
    since,
    until,
    level = 'campaign',
    sortBy = 'spend',
    sortDirection = 'desc',
    minSpend,
    minClicks,
    limit = 50,
  } = options;

  const adAccountId = normalizeAccountId(options.adAccountId);
  const breakdowns = assertLocationBreakdowns(options.breakdowns) ?? ['country'];

  const fetchOptions = { adAccountId, since, until, limit: 200, breakdowns };

  let insights;
  if (level === 'adset') {
    insights = await getAdsetInsights(client, fetchOptions);
  } else if (level === 'ad') {
    insights = await getAdsInsights(client, fetchOptions);
  } else {
    insights = await getCampaignInsights(client, fetchOptions);
  }

  if (breakdowns.length === 1) {
    return summarizeLocationInsights({
      insights,
      breakdown: breakdowns[0],
      sortBy,
      sortDirection,
      minSpend,
      minClicks,
      limit,
    });
  }

  return summarizeNestedLocationInsights({
    insights,
    breakdowns,
    sortBy,
    sortDirection,
    minSpend,
    minClicks,
    limit,
  });
}
