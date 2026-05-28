import type { MetaClient } from '../metaClient.js';
import type { DailyReport } from '../types.js';
import { getCampaignInsights } from './getCampaignInsights.js';
import { analyzeCampaignPerformance } from '../analysis/analyzeCampaignPerformance.js';
import { recommendActions } from '../analysis/recommendActions.js';

export interface GenerateDailyReportOptions {
  adAccountId: string;
  since: string;
  until: string;
}

export async function generateDailyReport(
  client: MetaClient,
  options: GenerateDailyReportOptions
): Promise<DailyReport> {
  const { adAccountId, since, until } = options;

  const insights = await getCampaignInsights(client, {
    adAccountId,
    since,
    until,
  });

  const analyses = analyzeCampaignPerformance(insights);
  const actions = recommendActions(analyses);

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  for (const insight of insights) {
    totalSpend += parseFloat(insight.spend) || 0;
    totalImpressions += parseFloat(insight.impressions) || 0;
    totalClicks += parseFloat(insight.clicks) || 0;
  }

  const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  const highlights: string[] = [];
  const goodCampaigns = analyses.filter((a) => a.status === 'good');
  const warningCampaigns = analyses.filter((a) => a.status === 'warning');

  if (goodCampaigns.length > 0) {
    highlights.push(`${goodCampaigns.length} campaign(s) performing well`);
  }
  if (warningCampaigns.length > 0) {
    highlights.push(`${warningCampaigns.length} campaign(s) need attention`);
  }
  if (totalSpend > 0) {
    highlights.push(`Total spend: ${totalSpend.toFixed(2)}`);
  }

  const recommendations = actions
    .filter((a) => a.priority === 'high' || a.priority === 'medium')
    .map((a) => `[${a.priority.toUpperCase()}] ${a.campaign_name}: ${a.action}`);

  return {
    date_range: { since, until },
    totals: {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      average_ctr: averageCtr,
      average_cpc: averageCpc,
    },
    highlights,
    campaign_analysis: analyses,
    recommendations,
  };
}
