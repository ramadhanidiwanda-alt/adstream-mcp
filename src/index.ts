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
export type * from './broker/types.js';
export {
  ADS_PROVIDER_IDS,
  ADS_ENTITY_LEVELS,
  ADS_OPERATION_KINDS,
  ADS_TOOL_CATEGORIES,
  isAdsProviderId,
  isReadOperation,
  defaultDenyWritePermissionPolicy,
} from './broker/types.js';
export type * from './broker/credentials.js';
export type * from './broker/cuanInsight.js';
export {
  CUAN_INSIGHT_CREDENTIAL_ERROR_CODES,
  isCuanInsightCredentialErrorCode,
  isSupportedCuanInsightProvider,
} from './broker/cuanInsight.js';
export {
  EnvCredentialProvider,
  CuanInsightCredentialProvider,
  CredentialResolver,
  redactTokenLikeValues,
  redactErrorMessage,
} from './broker/credentials.js';
export { AdsBroker } from './broker/AdsBroker.js';
export type * from './broker/AdsBroker.js';
export {
  createDefaultAdsBroker,
  createDefaultCredentialResolver,
  createDefaultProviderRegistry,
} from './broker/factory.js';
export type * from './broker/factory.js';
export {
  ADS_MCP_TOOL_DEFINITIONS,
  ADS_MCP_TOOL_NAMES,
  handleAdsMcpToolCall,
  isAdsMcpToolName,
  safeAdsMcpError,
  toAdsBrokerRequest,
} from './broker/mcpTools.js';
export type * from './broker/mcpTools.js';
export { ProviderRegistry } from './broker/providerRegistry.js';
export { MetaAdsAdapter } from './providers/meta/MetaAdsAdapter.js';
export { normalizeMetaInsight, normalizeMetaInsights } from './providers/meta/normalizer.js';
export type * from './providers/meta/normalizer.js';
export type * from './providers/meta/MetaAdsAdapter.js';
export { TikTokAdsAdapter } from './providers/tiktok/TikTokAdsAdapter.js';
export { normalizeTikTokInsight, normalizeTikTokInsights } from './providers/tiktok/normalizer.js';
export type * from './providers/tiktok/TikTokAdsAdapter.js';
export type * from './providers/tiktok/normalizer.js';

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

export type * from './broker/remoteAuth.js';
export {
  REMOTE_MCP_AUTH_ERROR_CODES,
  parseRemoteMcpAuthHeaders,
  buildCuanInsightCredentialRequestFromRemoteContext,
  isRemoteMcpAuthErrorCode,
} from './broker/remoteAuth.js';
