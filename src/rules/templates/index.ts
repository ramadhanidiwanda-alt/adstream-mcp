export { ecommerceRules } from './ecommerce.js';
export { leadGenRules } from './leadgen.js';
export { brandAwarenessRules } from './brand.js';
export { generalRules } from './general.js';

import { ecommerceRules } from './ecommerce.js';
import { leadGenRules } from './leadgen.js';
import { brandAwarenessRules } from './brand.js';
import { generalRules } from './general.js';

/**
 * All pre-built rule templates combined
 */
export const allRuleTemplates = [
  ...ecommerceRules,
  ...leadGenRules,
  ...brandAwarenessRules,
  ...generalRules,
];

/**
 * Get rules by category
 */
export function getRulesByCategory(category: 'ecommerce' | 'leadgen' | 'brand' | 'general') {
  switch (category) {
    case 'ecommerce':
      return ecommerceRules;
    case 'leadgen':
      return leadGenRules;
    case 'brand':
      return brandAwarenessRules;
    case 'general':
      return generalRules;
    default:
      return [];
  }
}
