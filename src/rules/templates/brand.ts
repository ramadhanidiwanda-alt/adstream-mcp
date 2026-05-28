import type { Rule } from '../types.js';

/**
 * Brand awareness focused rules for campaigns optimizing for reach and impressions
 */
export const brandAwarenessRules: Rule[] = [
  {
    id: 'brand-high-cpm',
    name: 'High CPM',
    description: 'Cost per thousand impressions is too high',
    conditions: [
      { metric: 'cpm', operator: '>', value: 100000 },
      { metric: 'spend', operator: '>', value: 50000 },
    ],
    logic: 'AND',
    action: 'Optimize targeting, test different placements, or adjust creative',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'brand-low-reach',
    name: 'Low Reach Efficiency',
    description: 'Not reaching enough unique users relative to spend',
    conditions: [
      { metric: 'reach', operator: '<', value: 50000 },
      { metric: 'spend', operator: '>', value: 100000 },
    ],
    logic: 'AND',
    action: 'Expand audience targeting or test broader demographics',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'brand-good-cpm',
    name: 'Efficient CPM',
    description: 'Getting impressions at good cost',
    conditions: [
      { metric: 'cpm', operator: '<', value: 50000 },
      { metric: 'impressions', operator: '>', value: 100000 },
    ],
    logic: 'AND',
    action: 'Good reach efficiency, consider scaling to increase brand awareness',
    priority: 'low',
    enabled: true,
  },
  {
    id: 'brand-high-reach-low-engagement',
    name: 'High Reach Low Engagement',
    description: 'Reaching many people but low click-through rate',
    conditions: [
      { metric: 'reach', operator: '>', value: 100000 },
      { metric: 'ctr', operator: '<', value: 0.5 },
    ],
    logic: 'AND',
    action: 'Test more engaging creative or add clear call-to-action',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'brand-audience-saturation',
    name: 'Potential Audience Saturation',
    description: 'High frequency may indicate audience fatigue',
    conditions: [
      { metric: 'impressions', operator: '>', value: 1000000 },
      { metric: 'reach', operator: '<', value: 200000 },
    ],
    logic: 'AND',
    action: 'Expand targeting to reach new audiences or refresh creative',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'brand-scaling-opportunity',
    name: 'Brand Awareness Scaling',
    description: 'Efficient reach and impressions, ready to scale',
    conditions: [
      { metric: 'cpm', operator: '<', value: 60000 },
      { metric: 'reach', operator: '>', value: 50000 },
      { metric: 'spend', operator: '>', value: 30000 },
    ],
    logic: 'AND',
    action: 'Scale budget to increase brand reach and awareness',
    priority: 'medium',
    enabled: true,
  },
];
