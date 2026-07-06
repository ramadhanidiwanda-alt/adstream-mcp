export { MetaClient } from './metaClient.js';
export type { MetaGetOptions } from './metaClient.js';
export { loadConfig, validateTokenFormat, validateAdAccountId, maskToken } from './config.js';
export { MetaApiError } from './utils/metaError.js';

export { TikTokApiClient, TikTokApiError } from './tiktokClient.js';
export type * from './tiktokClient.js';

export { getTikTokReport } from './tools/getTikTokReport.js';
export type * from './tools/getTikTokReport.js';
export { getGmvMaxReport } from './tools/getGmvMaxReport.js';
export type * from './tools/getGmvMaxReport.js';
export { normalizeGmvMaxRows } from './providers/tiktok/gmvMaxNormalizer.js';
export type * from './providers/tiktok/gmvMaxNormalizer.js';
export { getTikTokAdvertisers } from './tools/getTikTokAdvertisers.js';
export type * from './tools/getTikTokAdvertisers.js';
export { getTikTokCampaigns } from './tools/getTikTokCampaigns.js';
export type * from './tools/getTikTokCampaigns.js';
export { getTikTokLocationInsights } from './tools/getTikTokLocationInsights.js';
export type * from './tools/getTikTokLocationInsights.js';

export { getAdAccounts } from './tools/getAdAccounts.js';
export { getAccountInsights } from './tools/getAccountInsights.js';
export { getCampaigns } from './tools/getCampaigns.js';
export { getCampaignInsights } from './tools/getCampaignInsights.js';
export { getAdsetInsights } from './tools/getAdsetInsights.js';
export { getAdsInsights } from './tools/getAdsInsights.js';
export { generateDailyReport } from './tools/generateDailyReport.js';
export { getLocationInsights } from './tools/getLocationInsights.js';
export type * from './tools/getLocationInsights.js';
export { getMetaPlacementPerformance } from './tools/getMetaPlacementPerformance.js';
export type * from './tools/getMetaPlacementPerformance.js';
export { createEcommerceCampaignBundle } from './tools/createEcommerceCampaignBundle.js';
export type {
  EcommerceCampaignBundleOptions,
  EcommerceCampaignBundlePreview,
  EcommerceLaunchStatus,
  MetaEcommerceCallToActionType,
} from './tools/createEcommerceCampaignBundle.js';

// --- Mutation Tools ---
export { pauseCampaign } from './tools/pauseCampaign.js';
export type * from './tools/pauseCampaign.js';
export { resumeCampaign } from './tools/resumeCampaign.js';
export type * from './tools/resumeCampaign.js';
export { updateCampaignBudget } from './tools/updateCampaignBudget.js';
export type * from './tools/updateCampaignBudget.js';
export { renameCampaign } from './tools/renameCampaign.js';
export type * from './tools/renameCampaign.js';
export {
  previewCampaignMutation,
  executeCampaignMutation,
} from './tools/campaignMutations.js';
export type { CampaignMutationWorkflowOptions, CampaignMutationWorkflowResult } from './tools/campaignMutations.js';

export { analyzeCampaignPerformance } from './analysis/analyzeCampaignPerformance.js';
export { recommendActions } from './analysis/recommendActions.js';
export { summarizeLocationInsights, summarizeNestedLocationInsights } from './analysis/summarizeLocationInsights.js';
export type * from './analysis/summarizeLocationInsights.js';
export { analyzePlacementPerformance } from './analysis/analyzePlacementPerformance.js';
export type * from './analysis/analyzePlacementPerformance.js';

export { parseActionValue, parseActionValueFromValues } from './utils/parseActions.js';
export { formatCurrency, formatNumber } from './utils/formatCurrency.js';
export { normalizeAccountId } from './utils/normalizeAccountId.js';
export {
  normalizeLocationBreakdowns,
  assertLocationBreakdowns,
} from './utils/locationBreakdowns.js';

export type * from './types.js';
export type * from './types.js';
export {
  VideoSourceResult,
  AdCreativeMappingResult,
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
export {
  COMMERCE_MCP_TOOL_DEFINITIONS,
  COMMERCE_MCP_TOOL_NAMES,
  handleCommerceMcpToolCall,
  safeCommerceMcpError,
} from './broker/commerceTools.js';
export type * from './broker/commerceTools.js';
export type * from './broker/reportEngine.js';
export { buildAdsSummaryReport } from './broker/reportEngine.js';
export type * from './broker/commerceReportEngine.js';
export { buildCommerceReport } from './broker/commerceReportEngine.js';
export { ProviderRegistry } from './broker/providerRegistry.js';
export { MetaAdsAdapter } from './providers/meta/MetaAdsAdapter.js';
export { normalizeMetaInsight, normalizeMetaInsights } from './providers/meta/normalizer.js';
export type * from './providers/meta/normalizer.js';
export type * from './providers/meta/MetaAdsAdapter.js';
export { TikTokAdsAdapter } from './providers/tiktok/TikTokAdsAdapter.js';
export { normalizeTikTokInsight, normalizeTikTokInsights } from './providers/tiktok/normalizer.js';
export type * from './providers/tiktok/TikTokAdsAdapter.js';
export type * from './providers/tiktok/normalizer.js';
export { GoogleAdsAdapter } from './providers/google/GoogleAdsAdapter.js';
export { normalizeGoogleAdsRow, normalizeGoogleAdsRows } from './providers/google/normalizer.js';
export type * from './providers/google/GoogleAdsAdapter.js';
export type * from './providers/google/normalizer.js';

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

export type * from './broker/config.js';
export { parseBrokerConfigFromEnv } from './broker/config.js';
export {
  createRemoteCredentialResolver,
  createRemoteAdsBroker,
  createAdsBrokerFromConfig,
} from './broker/factory.js';
