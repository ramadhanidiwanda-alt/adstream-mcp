import type { Rule } from '../types.js';

/**
 * General performance rules applicable to most campaign types
 */
export const generalRules: Rule[] = [
  {
    id: 'general-creative-fatigue',
    name: 'Creative Fatigue',
    description: 'CTR declining, possible creative fatigue',
    conditions: [
      { metric: 'ctr', operator: '<', value: 0.8 },
      { metric: 'spend', operator: '>', value: 50000 },
    ],
    logic: 'AND',
    action: 'Refresh ad creative, test new images/videos, or update copy',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'general-high-cpc',
    name: 'High Cost Per Click',
    description: 'CPC is significantly high',
    conditions: [
      { metric: 'cpc', operator: '>', value: 50000 },
    ],
    logic: 'AND',
    action: 'Review targeting, optimize bids, or improve ad relevance',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'general-low-ctr',
    name: 'Low Click-Through Rate',
    description: 'CTR below acceptable threshold',
    conditions: [
      { metric: 'ctr', operator: '<', value: 0.5 },
      { metric: 'impressions', operator: '>', value: 50000 },
    ],
    logic: 'AND',
    action: 'Improve ad creative, test different messaging, or refine targeting',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'general-budget-pacing',
    name: 'Budget Pacing Issue',
    description: 'Spending too quickly or too slowly',
    conditions: [
      { metric: 'spend', operator: '>', value: 200000 },
      { metric: 'cpm', operator: '>', value: 80000 },
    ],
    logic: 'AND',
    action: 'Adjust budget pacing or bid strategy',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'general-good-performance',
    name: 'Good Overall Performance',
    description: 'Campaign metrics are healthy',
    conditions: [
      { metric: 'ctr', operator: '>', value: 1.0 },
      { metric: 'cpc', operator: '<', value: 30000 },
    ],
    logic: 'AND',
    action: 'Maintain current strategy, monitor for changes',
    priority: 'low',
    enabled: true,
  },
  {
    id: 'general-low-impressions',
    name: 'Low Impressions',
    description: 'Not getting enough impressions',
    conditions: [
      { metric: 'impressions', operator: '<', value: 10000 },
      { metric: 'spend', operator: '>', value: 20000 },
    ],
    logic: 'AND',
    action: 'Increase budget, expand targeting, or check ad approval status',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'general-excellent-ctr',
    name: 'Excellent CTR',
    description: 'Very high click-through rate',
    conditions: [
      { metric: 'ctr', operator: '>', value: 3.0 },
    ],
    logic: 'AND',
    action: 'Excellent engagement, consider scaling or testing similar creative',
    priority: 'low',
    enabled: true,
  },
  {
    id: 'general-testing-phase',
    name: 'Testing Phase',
    description: 'Campaign in early testing with limited data',
    conditions: [
      { metric: 'spend', operator: '<', value: 10000 },
      { metric: 'impressions', operator: '<', value: 20000 },
    ],
    logic: 'AND',
    action: 'Continue gathering data, avoid making changes too early',
    priority: 'low',
    enabled: true,
  },
];
