import type { CampaignInsight, CampaignAnalysis } from '../types.js';
import { parseActionValue } from '../utils/parseActions.js';

export function analyzeCampaignPerformance(insights: CampaignInsight[]): CampaignAnalysis[] {
  return insights.map((insight) => {
    const spend = parseFloat(insight.spend) || 0;
    const ctr = parseFloat(insight.ctr) || 0;
    const cpc = parseFloat(insight.cpc) || 0;
    const cpm = parseFloat(insight.cpm) || 0;

    const purchases = parseActionValue(insight.actions, 'purchase');
    const leads = parseActionValue(insight.actions, 'lead');

    let status: CampaignAnalysis['status'] = 'watch';
    let recommendation: CampaignAnalysis['recommendation'] = 'hold';
    let reason = 'Insufficient data or low spend';

    if (spend > 100000 && ctr < 1) {
      status = 'warning';
      recommendation = 'fix_creative';
      reason = 'High spend with low CTR indicates creative fatigue or poor targeting';
    } else if (ctr >= 1.5 && cpc > 0 && cpc < 5000) {
      status = 'good';
      recommendation = 'scale';
      reason = 'Strong CTR and reasonable CPC indicate good performance';
    } else if (purchases > 0 && spend > 0) {
      status = 'good';
      recommendation = 'hold';
      reason = 'Campaign is generating purchases, monitor ROAS closely';
    } else if (leads > 0 && spend > 0) {
      status = 'good';
      recommendation = 'hold';
      reason = 'Campaign is generating leads, evaluate lead quality';
    } else if (spend > 50000 && ctr < 0.5) {
      status = 'warning';
      recommendation = 'review';
      reason = 'Low engagement despite moderate spend, review targeting and creative';
    } else if (spend < 10000) {
      status = 'watch';
      recommendation = 'hold';
      reason = 'Campaign still in learning phase, need more data';
    }

    return {
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      spend,
      ctr,
      cpc,
      cpm,
      purchases,
      leads,
      status,
      recommendation,
      reason,
    };
  });
}
