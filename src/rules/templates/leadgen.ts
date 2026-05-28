import type { Rule } from '../types.js';

/**
 * Lead generation focused rules for campaigns optimizing for leads and form submissions
 */
export const leadGenRules: Rule[] = [
  {
    id: 'leadgen-expensive-leads',
    name: 'Expensive Leads',
    description: 'Cost per lead is too high for target acquisition cost',
    conditions: [
      { metric: 'cpc', operator: '>', value: 15000 },
      { metric: 'spend', operator: '>', value: 50000 },
    ],
    logic: 'AND',
    action: 'Optimize targeting, test new ad formats, or adjust lead form',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'leadgen-low-conversion-rate',
    name: 'Low Conversion Rate',
    description: 'Getting traffic but low form submission rate',
    conditions: [
      { metric: 'clicks', operator: '>', value: 1000 },
      { metric: 'ctr', operator: '>', value: 1.0 },
      { metric: 'cpc', operator: '>', value: 20000 },
    ],
    logic: 'AND',
    action: 'Simplify lead form, improve value proposition, or test instant forms',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'leadgen-high-volume-low-quality',
    name: 'High Volume Low Quality',
    description: 'Generating many leads but quality may be low',
    conditions: [
      { metric: 'cpc', operator: '<', value: 5000 },
      { metric: 'ctr', operator: '>', value: 2.0 },
    ],
    logic: 'AND',
    action: 'Review lead quality, add qualification questions, or tighten targeting',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'leadgen-good-performance',
    name: 'Good Lead Gen Performance',
    description: 'Balanced cost per lead with good volume',
    conditions: [
      { metric: 'cpc', operator: '>=', value: 8000 },
      { metric: 'cpc', operator: '<=', value: 15000 },
      { metric: 'ctr', operator: '>', value: 1.0 },
    ],
    logic: 'AND',
    action: 'Maintain current strategy, consider scaling budget',
    priority: 'low',
    enabled: true,
  },
  {
    id: 'leadgen-low-reach',
    name: 'Low Reach',
    description: 'Campaign not reaching enough people',
    conditions: [
      { metric: 'reach', operator: '<', value: 10000 },
      { metric: 'spend', operator: '>', value: 20000 },
    ],
    logic: 'AND',
    action: 'Expand targeting, increase budget, or test broader audiences',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'leadgen-scaling-opportunity',
    name: 'Lead Gen Scaling Opportunity',
    description: 'Efficient lead generation ready for scale',
    conditions: [
      { metric: 'cpc', operator: '<', value: 12000 },
      { metric: 'spend', operator: '>', value: 30000 },
      { metric: 'ctr', operator: '>', value: 1.2 },
    ],
    logic: 'AND',
    action: 'Scale budget by 25-50% to increase lead volume',
    priority: 'medium',
    enabled: true,
  },
];
