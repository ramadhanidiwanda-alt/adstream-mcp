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

export { createCampaign } from './tools/createCampaign.js';
export type { CreateCampaignOptions, CreateCampaignResult, CreateCampaignStatus, CampaignStatus, MetaCampaignObjective } from './tools/createCampaign.js';

export { createAdSet } from './tools/createAdSet.js';
export type { CreateAdSetOptions, CreateAdSetResult, CreateAdSetStatus, AdSetStatus, AdSetTargeting, BillingEvent, OptimizationGoal } from './tools/createAdSet.js';

export { createAdCreative } from './tools/createAdCreative.js';
export type { CreateAdCreativeOptions, CreateAdCreativeResult, CreateAdCreativeStatus, CreativeStatus } from './tools/createAdCreative.js';

export { createAd } from './tools/createAd.js';
export type { CreateAdOptions, CreateAdResult, CreateAdStatus, AdStatus } from './tools/createAd.js';

export { archiveAd } from './tools/archiveAd.js';
export type { ArchiveAdOptions, ArchiveAdResult } from './tools/archiveAd.js';

export { updateAdSet } from './tools/updateAdSet.js';
export type { UpdateAdSetOptions, UpdateAdSetResult, UpdateAdSetStatus } from './tools/updateAdSet.js';

export { getTargetingOptions } from './tools/getTargetingOptions.js';
export type { GetTargetingOptionsOptions, GetTargetingOptionsResult, TargetingOption, TargetingOptionType } from './tools/getTargetingOptions.js';

export { uploadImage } from './tools/uploadImage.js';
export type { UploadImageOptions, UploadImageResult } from './tools/uploadImage.js';
export { uploadVideo } from './tools/uploadVideo.js';
export type { UploadVideoOptions, UploadVideoResult } from './tools/uploadVideo.js';

export { getAccountInfo } from './tools/getAccountInfo.js';
export type { GetAccountInfoOptions } from './tools/getAccountInfo.js';

export { listAdImages } from './tools/listAdImages.js';
export type { ListAdImagesOptions } from './tools/listAdImages.js';
export { listAdVideos } from './tools/listAdVideos.js';
export type { ListAdVideosOptions } from './tools/listAdVideos.js';
export { getAdPreview } from './tools/getAdPreview.js';
export type { GetAdPreviewOptions, AdPreviewFormat } from './tools/getAdPreview.js';
export { listPages } from './tools/listPages.js';
export type { MetaPageResult } from './tools/listPages.js';

export { getAdDestinations } from './tools/getAdDestinations.js';
export type { GetAdDestinationsOptions, AdDestinationInfo, AdDestinationPage } from './tools/getAdDestinations.js';

// --- Mutation Tools ---
export { pauseCampaign } from './tools/pauseCampaign.js';
export type * from './tools/pauseCampaign.js';
export { resumeCampaign } from './tools/resumeCampaign.js';
export type * from './tools/resumeCampaign.js';
export { pauseAdSet } from './tools/pauseAdSet.js';
export type * from './tools/pauseAdSet.js';
export { resumeAdSet } from './tools/resumeAdSet.js';
export type * from './tools/resumeAdSet.js';
export { pauseAd } from './tools/pauseAd.js';
export type * from './tools/pauseAd.js';
export { resumeAd } from './tools/resumeAd.js';
export type * from './tools/resumeAd.js';
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
export { normalizeAccountId, normalizeAccountPath } from './utils/normalizeAccountId.js';
export {
  normalizeLocationBreakdowns,
  assertLocationBreakdowns,
} from './utils/locationBreakdowns.js';

export type * from './types.js';
export type * from './broker/types.js';
export {
  VideoSourceResult,
  AdCreativeMappingResult,
  AdDestinationResult,
  AdImageResult,
  AdVideoResult,
  AdPreviewResult,
  ADS_PROVIDER_IDS,
  ADS_ENTITY_LEVELS,
  ADS_OPERATION_KINDS,
  ADS_TOOL_CATEGORIES,
  isAdsProviderId,
  isReadOperation,
  allowWritePermissionPolicy,
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
