import type { CampaignAnalysis } from '../types.js';

export interface ActionRecommendation {
  campaign_id: string;
  campaign_name: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  disclaimer: string;
}

export function recommendActions(analyses: CampaignAnalysis[]): ActionRecommendation[] {
  const recommendations: ActionRecommendation[] = [];

  for (const analysis of analyses) {
    let priority: ActionRecommendation['priority'] = 'low';
    let action = '';
    const rationale = analysis.reason;

    if (analysis.status === 'warning') {
      priority = 'high';
      if (analysis.recommendation === 'fix_creative') {
        action = 'Consider testing new ad creatives or refreshing existing ones';
      } else if (analysis.recommendation === 'review') {
        action = 'Review targeting parameters and audience settings';
      }
    } else if (analysis.status === 'good') {
      if (analysis.recommendation === 'scale') {
        priority = 'medium';
        action = 'Consider gradually increasing budget by 10-20%';
      } else {
        priority = 'low';
        action = 'Continue monitoring performance, no immediate action needed';
      }
    } else {
      priority = 'low';
      action = 'Allow campaign to gather more data before making changes';
    }

    recommendations.push({
      campaign_id: analysis.campaign_id,
      campaign_name: analysis.campaign_name,
      priority,
      action,
      rationale,
      disclaimer:
        'This is an automated recommendation. Manual review and approval required before taking any action.',
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
