export { MetaClient } from './metaClient.js';
export { loadConfig, validateTokenFormat, validateAdAccountId, maskToken } from './config.js';
export { MetaApiError } from './utils/metaError.js';

export { getAdAccounts } from './tools/getAdAccounts.js';
export { getCampaigns } from './tools/getCampaigns.js';
export { getCampaignInsights } from './tools/getCampaignInsights.js';
export { getAdsetInsights } from './tools/getAdsetInsights.js';
export { getAdsInsights } from './tools/getAdsInsights.js';
export { generateDailyReport } from './tools/generateDailyReport.js';

export { analyzeCampaignPerformance } from './analysis/analyzeCampaignPerformance.js';
export { recommendActions } from './analysis/recommendActions.js';

export { parseActionValue, parseActionValueFromValues } from './utils/parseActions.js';
export { formatCurrency, formatNumber } from './utils/formatCurrency.js';

export type * from './types.js';

export { RuleEngine } from './rules/engine.js';
export type * from './rules/types.js';

export {
  ecommerceRules,
  leadGenRules,
  brandAwarenessRules,
  generalRules,
  allRuleTemplates,
  getRulesByCategory,
} from './rules/templates/index.js';
