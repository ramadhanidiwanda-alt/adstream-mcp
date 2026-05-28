import type { Rule } from '../types.js';

/**
 * E-commerce focused rules for campaigns optimizing for purchases and revenue
 */
export const ecommerceRules: Rule[] = [
  {
    id: 'ecom-high-spend-low-roas',
    name: 'High Spend Low ROAS',
    description: 'Campaign spending significantly but not generating good return on ad spend',
    conditions: [
      { metric: 'spend', operator: '>', value: 50000 },
      // Note: purchase_roas would need to be added to supported metrics
    ],
    logic: 'AND',
    action: 'Review campaign profitability and consider pausing or optimizing',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'ecom-high-spend-low-purchases',
    name: 'High Spend Low Purchases',
    description: 'Significant spend but very few purchases',
    conditions: [
      { metric: 'spend', operator: '>', value: 100000 },
      { metric: 'cpc', operator: '>', value: 30000 },
    ],
    logic: 'AND',
    action: 'Check conversion tracking, landing page, and product pricing',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'ecom-expensive-conversions',
    name: 'Expensive Conversions',
    description: 'Cost per conversion is too high for profitability',
    conditions: [
      { metric: 'cpc', operator: '>', value: 50000 },
    ],
    logic: 'AND',
    action: 'Optimize targeting, test new audiences, or improve ad creative',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'ecom-good-ctr-low-conversions',
    name: 'Good CTR Low Conversions',
    description: 'Getting clicks but not converting - possible landing page issue',
    conditions: [
      { metric: 'ctr', operator: '>', value: 1.5 },
      { metric: 'cpc', operator: '>', value: 40000 },
    ],
    logic: 'AND',
    action: 'Review landing page experience, checkout flow, and product pricing',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'ecom-scaling-opportunity',
    name: 'Scaling Opportunity',
    description: 'Campaign performing well with good metrics - ready to scale',
    conditions: [
      { metric: 'spend', operator: '>', value: 20000 },
      { metric: 'ctr', operator: '>', value: 1.0 },
      { metric: 'cpc', operator: '<', value: 25000 },
    ],
    logic: 'AND',
    action: 'Consider increasing budget by 20-30% to scale successful campaign',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'ecom-low-spend-testing',
    name: 'Low Spend Testing Phase',
    description: 'Campaign in testing phase with low spend',
    conditions: [
      { metric: 'spend', operator: '<', value: 10000 },
    ],
    logic: 'AND',
    action: 'Continue testing, gather more data before making decisions',
    priority: 'low',
    enabled: true,
  },
];
