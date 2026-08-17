import { getAdCreativeMapping } from '../../tools/getAdCreativeMapping.js';
import { resolveCreativeAssets as resolveCreativeAssetsTool } from '../../tools/resolveCreativeAssets.js';
import {
  AD_CREATIVE_FULL_FIELDS,
  readAdCreativeFull as readAdCreativeFullTool,
} from '../../tools/readAdCreativeFull.js';
import {
  readAdSetFull as readAdSetFullTool,
  listAdSetsFull as listAdSetsFullTool,
  ADSET_FULL_FIELDS,
} from '../../tools/readAdSetFull.js';
import { getAdDestinations } from '../../tools/getAdDestinations.js';
import type { AdCreativeMappingResult } from '../../broker/types.js';
import {
  TOOL_PARAM_HINTS,
  findUnknownParamKeys,
  formatUnknownParamsMessage,
} from '../../broker/toolParamContract.js';
import { MetaClient } from '../../metaClient.js';
import {
  deriveMetaActivePlacements,
  evaluateMetaCreativeCompliance,
  type MetaActivePlacements,
} from './creativeCompliance.js';
import { getAdAccounts } from '../../tools/getAdAccounts.js';
import { getAccountInsights } from '../../tools/getAccountInsights.js';
import { getCampaigns } from '../../tools/getCampaigns.js';
import { getAdsInsights } from '../../tools/getAdsInsights.js';
import { getAdsetInsights } from '../../tools/getAdsetInsights.js';
import { getCampaignInsights } from '../../tools/getCampaignInsights.js';
import { getMetaPlacementPerformance } from '../../tools/getMetaPlacementPerformance.js';
import type { GetMetaPlacementPerformanceOptions } from '../../tools/getMetaPlacementPerformance.js';
import type {
  AccountInsight,
  AdAccount,
  AdInsight,
  AdsetInsight,
  Campaign,
  CampaignInsight,
  MetaAdsMode,
  MetaAppDestination,
  MetaApplinkTreatment,
  MetaCollaborativeAppSpec,
  MetaCollaborativeCatalogContext,
  MetaConfig,
  MetaCreativeFormat,
  MetaPageWelcomeMessage,
  MetaPartnershipSpec,
  MetaStandardAppSpec,
  MetaCreativeSpec,
  PlacementPerformanceReport,
} from '../../types.js';
import { META_CREATIVE_FORMATS } from '../../types.js';
import {
  META_CONVERSION_LOCATIONS,
  META_MESSAGING_DESTINATIONS,
  META_ODAX_OBJECTIVES,
  type MetaConversionLocation,
  type MetaMessagingDestination,
  type MetaOdaxObjective,
} from './objectiveLaunchMatrix.js';
import {
  supportsMediaSourcingSpec,
  supportsThreadsUserIdField,
} from './metaApiVersionSupport.js';
import type { MutationResult } from '../../types.js';
import type { LocationBreakdown } from '../../types.js';
import { pauseCampaign as pauseCampaignTool } from '../../tools/pauseCampaign.js';
import { resumeCampaign as resumeCampaignTool } from '../../tools/resumeCampaign.js';
import { updateCampaignBudget as updateCampaignBudgetTool } from '../../tools/updateCampaignBudget.js';
import { renameCampaign as renameCampaignTool } from '../../tools/renameCampaign.js';
import { createEcommerceCampaignBundle as createEcommerceCampaignBundleTool } from '../../tools/createEcommerceCampaignBundle.js';
import { createCpasCatalogCampaignBundle as createCpasCatalogCampaignBundleTool } from '../../tools/createCpasCatalogCampaignBundle.js';
import { createCampaign as createCampaignTool } from '../../tools/createCampaign.js';
import { createAdSet as createAdSetTool } from '../../tools/createAdSet.js';
import {
  createAdCreative as createAdCreativeTool,
  assetFeedSpecCreateError,
  DYNAMIC_CREATIVE_DISABLED_MESSAGE,
} from '../../tools/createAdCreative.js';
import type { CreativeDestinationType } from '../../tools/createAdCreative.js';
import { getWelcomeMessageTemplate } from '../../tools/welcomeMessageTemplates.js';
import { createAd as createAdTool } from '../../tools/createAd.js';
import { cloneUiAd as cloneUiAdTool } from '../../tools/cloneUiAd.js';
import { archiveAd as archiveAdTool } from '../../tools/archiveAd.js';
import { deleteAudience as deleteAudienceTool } from '../../tools/deleteAudience.js';
import { pauseAd as pauseAdTool } from '../../tools/pauseAd.js';
import { resumeAd as resumeAdTool } from '../../tools/resumeAd.js';
import { pauseAdSet as pauseAdSetTool } from '../../tools/pauseAdSet.js';
import { resumeAdSet as resumeAdSetTool } from '../../tools/resumeAdSet.js';
import { cloneAdSet as cloneAdSetTool } from '../../tools/cloneAdSet.js';
import { updateAdSet as updateAdSetTool } from '../../tools/updateAdSet.js';
import { updateAd as updateAdTool } from '../../tools/updateAd.js';
import { updateCampaign as updateCampaignTool } from '../../tools/updateCampaign.js';
import { getTargetingOptions as getTargetingOptionsTool } from '../../tools/getTargetingOptions.js';
import type {
  EcommerceCampaignBundlePayload as MetaEcommerceCampaignBundlePayload,
  EcommerceCampaignBundleResult,
} from '../../tools/createEcommerceCampaignBundle.js';
import type {
  CpasCatalogCampaignBundlePayload as MetaCpasCatalogCampaignBundlePayload,
  CpasCatalogCampaignBundleResult,
} from '../../tools/createCpasCatalogCampaignBundle.js';
import type {
  CreateCampaignResult,
  CreateAdSetResult,
  CreateProductAudienceResult,
  CreateCustomAudienceResult,
  CreateAdCreativeResult,
  CreateAdResult,
  CloneUiAdResult,
  ArchiveAdResult,
  DeleteAudienceResult,
  CloneAdSetResult,
  UpdateAdSetResult,
  UpdateAdResult,
  UpdateCampaignResult,
  GetTargetingOptionsResult,
} from '../../broker/types.js';
import type { UploadImageResult } from '../../tools/uploadImage.js';
import type { UploadVideoResult } from '../../tools/uploadVideo.js';
import { uploadImage as uploadImageTool } from '../../tools/uploadImage.js';
import { uploadVideo as uploadVideoTool } from '../../tools/uploadVideo.js';
import { getAccountInfo } from '../../tools/getAccountInfo.js';
import { listAdImages } from '../../tools/listAdImages.js';
import { listAdVideos } from '../../tools/listAdVideos.js';
import { getAdPreview } from '../../tools/getAdPreview.js';
import { listPages as listPagesTool } from '../../tools/listPages.js';
import { listLeadForms as listLeadFormsTool } from '../../tools/listLeadForms.js';
import { listInstagramAccounts as listInstagramAccountsTool } from '../../tools/listInstagramAccounts.js';
import { listInstagramMedia as listInstagramMediaTool } from '../../tools/listInstagramMedia.js';
import { listPartnershipContent as listPartnershipContentTool } from '../../tools/listPartnershipContent.js';
import {
  listThreadsProfiles as listThreadsProfilesTool,
  type ThreadsProfileListResult,
} from '../../tools/listThreadsProfiles.js';
import { checkLaunchReadiness as checkLaunchReadinessTool } from '../../tools/checkLaunchReadiness.js';
import {
  createProductAudience as createProductAudienceTool,
  type CreateProductAudienceOptions,
} from '../../tools/createProductAudience.js';
import {
  createCustomAudience as createCustomAudienceTool,
  type CreateCustomAudienceOptions,
} from '../../tools/createCustomAudience.js';
import { listAudiences as listAudiencesTool } from '../../tools/listAudiences.js';
import { createPixel as createPixelTool, type CreatePixelOptions } from '../../tools/createPixel.js';
import { listPixels as listPixelsTool } from '../../tools/listPixels.js';
import { listCatalogs as listCatalogsTool } from '../../tools/listCatalogs.js';
import { listProductSets as listProductSetsTool } from '../../tools/listProductSets.js';
import { listWhatsAppAccounts as listWhatsAppAccountsTool } from '../../tools/listWhatsAppAccounts.js';
import { listWhatsAppPhoneNumbers as listWhatsAppPhoneNumbersTool } from '../../tools/listWhatsAppPhoneNumbers.js';
import { listWhatsAppMessageTemplates as listWhatsAppMessageTemplatesTool } from '../../tools/listWhatsAppMessageTemplates.js';
import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsChangeHistoryEnvelope,
  AdsChangeHistoryRecord,
  AdsMetricRecord,
  AdsMutationResult,
  AdDestinationResult,
  CreativeAssetResolution,
  AdCreativeFullResult,
  AdSetFullResult,
  AdsProviderAdapter,
  CredentialContext,
  EcommerceCampaignBundlePayload,
  VideoSourceResult,
  ImageUploadResult,
  VideoUploadResult,
  AccountInfoResult,
  AdImageResult,
  AdVideoResult,
  AdPreviewResult,
  MetaPageResult,
  MetaLeadFormResult,
  MetaPixelResult,
  CreatePixelResult,
  MetaAudienceResult,
  MetaCatalogResult,
  MetaProductSetResult,
  InstagramAccountResult,
  InstagramMediaResult,
  PartnershipContentResult,
  ThreadsProfileResult,
  WhatsAppAccountResult,
  WhatsAppPhoneNumberResult,
  WhatsAppTemplateResult,
} from '../../broker/types.js';
import type { LaunchReadinessResult } from '../../tools/checkLaunchReadiness.js';
import { ADS_PROVIDER_CAPABILITY_MATRIX } from '../../broker/types.js';
import { redactErrorMessage } from '../../broker/credentials.js';
import { assertLocationBreakdowns } from '../../utils/locationBreakdowns.js';
import { MetaApiError } from '../../utils/metaError.js';
import { normalizeMetaInsights } from './normalizer.js';
import { normalizeAccountId } from '../../utils/normalizeAccountId.js';
import {
  parseCanonicalMetaFilters,
  parseExplicitMetaFilters,
  resolveAdsEdgeScope,
  filterAdsByEntityScope,
  type MetaFilteringRule,
} from '../../utils/metaFiltering.js';

interface MetaActivityRecord {
  event_time?: string;
  event_type?: string;
  translated_event_type?: string;
  object_id?: string;
  object_name?: string;
  object_type?: string;
  actor_id?: string;
  actor_name?: string;
  application_id?: string;
  application_name?: string;
  extra_data?: unknown;
}

interface MetaCreativeRecord {
  id?: string;
  name?: string;
  title?: string;
  body?: string;
  thumbnail_url?: string;
  image_url?: string;
  image_hash?: string;
  video_id?: string;
  source?: string;
  status?: string;
  object_type?: string;
  degrees_of_freedom_spec?: unknown;
  media_sourcing_spec?: unknown;
  asset_feed_spec?: unknown;
  platform_customizations?: unknown;
  portrait_customizations?: unknown;
  image_crops?: unknown;
  object_story_id?: string;
  /**
   * Root-level identity fallback. Most creative formats write these inside
   * object_story_spec, but the existing_post sourceInstagramMediaId path writes
   * them at the payload root instead (no object_story_spec at all there).
   */
  instagram_user_id?: string;
  threads_user_id?: string;
  object_story_spec?: {
    instagram_user_id?: string;
    threads_user_id?: string;
    link_data?: {
      link?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
    video_data?: {
      call_to_action?: { type?: string; value?: { link?: string } };
    };
  };
}

interface MetaActiveAdCreativeRecord {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  adset?: {
    id?: string;
    name?: string;
    targeting?: unknown;
  };
  creative?: MetaCreativeRecord;
}

interface MetaCreativeAuditContext {
  ad?: MetaActiveAdCreativeRecord;
  activePlacements?: MetaActivePlacements;
  requestedFields: {
    degrees_of_freedom_spec: boolean;
    media_sourcing_spec: boolean;
    asset_feed_spec: boolean;
  };
}

export interface MetaAdsAdapterTools {
  getAdAccounts(client: MetaClient, options?: { limit?: number }): Promise<AdAccount[]>;
  getCampaigns(
    client: MetaClient,
    options: { adAccountId: string; limit?: number }
  ): Promise<Campaign[]>;
  getAccountInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number }
  ): Promise<AccountInsight[]>;
  getCampaignInsights(
    client: MetaClient,
    options: {
      adAccountId: string;
      since: string;
      until: string;
      limit?: number;
      breakdowns?: Array<LocationBreakdown | 'product_id'>;
    }
  ): Promise<CampaignInsight[]>;
  getAdsetInsights(
    client: MetaClient,
    options: {
      adAccountId: string;
      since: string;
      until: string;
      limit?: number;
      breakdowns?: Array<LocationBreakdown | 'product_id'>;
    }
  ): Promise<AdsetInsight[]>;
  getAdsInsights(
    client: MetaClient,
    options: {
      adAccountId: string;
      since: string;
      until: string;
      limit?: number;
      breakdowns?: Array<LocationBreakdown | 'product_id'>;
    }
  ): Promise<AdInsight[]>;
  getMetaPlacementPerformance(
    client: MetaClient,
    options: GetMetaPlacementPerformanceOptions
  ): Promise<PlacementPerformanceReport>;
  // --- Write operations ---
  pauseCampaign(client: MetaClient, campaignId: string): Promise<MutationResult>;
  resumeCampaign(client: MetaClient, campaignId: string): Promise<MutationResult>;
  updateCampaignBudget(
    client: MetaClient,
    campaignId: string,
    dailyBudget: number
  ): Promise<MutationResult>;
  renameCampaign(client: MetaClient, campaignId: string, newName: string): Promise<MutationResult>;
  createEcommerceCampaignBundle(
    client: MetaClient,
    payload: MetaEcommerceCampaignBundlePayload,
    options?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<EcommerceCampaignBundleResult>;
  createCpasCatalogCampaignBundle(
    client: MetaClient,
    payload: MetaCpasCatalogCampaignBundlePayload,
    options?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<CpasCatalogCampaignBundleResult>;
  createCampaign(
    client: MetaClient,
    options: import('../../tools/createCampaign.js').CreateCampaignOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/createCampaign.js').CreateCampaignResult>;
  createAdSet(
    client: MetaClient,
    options: import('../../tools/createAdSet.js').CreateAdSetOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/createAdSet.js').CreateAdSetResult>;
  createAdCreative(
    client: MetaClient,
    options: import('../../tools/createAdCreative.js').CreateAdCreativeOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/createAdCreative.js').CreateAdCreativeResult>;
  createAd(
    client: MetaClient,
    options: import('../../tools/createAd.js').CreateAdOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/createAd.js').CreateAdResult>;
  cloneUiAd(
    client: MetaClient,
    options: import('../../tools/cloneUiAd.js').CloneUiAdOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/cloneUiAd.js').CloneUiAdResult>;
  archiveAd(
    client: MetaClient,
    options: import('../../tools/archiveAd.js').ArchiveAdOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/archiveAd.js').ArchiveAdResult>;
  deleteAudience(
    client: MetaClient,
    options: import('../../tools/deleteAudience.js').DeleteAudienceOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/deleteAudience.js').DeleteAudienceResult>;
  pauseAd(client: MetaClient, adId: string): Promise<MutationResult>;
  resumeAd(client: MetaClient, adId: string): Promise<MutationResult>;
  pauseAdSet(client: MetaClient, adSetId: string): Promise<MutationResult>;
  resumeAdSet(client: MetaClient, adSetId: string): Promise<MutationResult>;
  cloneAdSet(
    client: MetaClient,
    options: import('../../tools/cloneAdSet.js').CloneAdSetOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/cloneAdSet.js').CloneAdSetResult>;
  updateAdSet(
    client: MetaClient,
    options: import('../../tools/updateAdSet.js').UpdateAdSetOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/updateAdSet.js').UpdateAdSetResult>;
  updateAd(
    client: MetaClient,
    options: import('../../tools/updateAd.js').UpdateAdOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/updateAd.js').UpdateAdResult>;
  updateCampaign(
    client: MetaClient,
    options: import('../../tools/updateCampaign.js').UpdateCampaignOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<import('../../tools/updateCampaign.js').UpdateCampaignResult>;
  getTargetingOptions(
    client: MetaClient,
    options: import('../../tools/getTargetingOptions.js').GetTargetingOptionsOptions
  ): Promise<import('../../tools/getTargetingOptions.js').GetTargetingOptionsResult>;
  uploadImage(
    client: MetaClient,
    options: { adAccountId: string; filePath: string; maxRetries?: number }
  ): Promise<UploadImageResult>;
  uploadVideo(
    client: MetaClient,
    options: {
      adAccountId: string;
      filePath: string;
      title?: string;
      description?: string;
      maxRetries?: number;
    }
  ): Promise<UploadVideoResult>;
  listAdImages(client: MetaClient, options: { adAccountId: string }): Promise<AdImageResult[]>;
  listAdVideos(
    client: MetaClient,
    options: { adAccountId: string; limit?: number; cursor?: string }
  ): Promise<AdVideoResult[]>;
  resolveCreativeAssets(
    client: MetaClient,
    options: import('../../tools/resolveCreativeAssets.js').ResolveCreativeAssetsOptions
  ): Promise<CreativeAssetResolution[]>;
  getAdPreview(
    client: MetaClient,
    options: { creativeId: string; adFormat: string }
  ): Promise<AdPreviewResult[]>;
  listPages(
    client: MetaClient,
    options?: { limit?: number }
  ): Promise<import('../../tools/listPages.js').MetaPageResult[]>;
  listLeadForms(
    client: MetaClient,
    options: { pageId: string; status?: string[]; limit?: number }
  ): Promise<import('../../tools/listLeadForms.js').MetaLeadFormResult[]>;
  createProductAudience(
    client: MetaClient,
    options: CreateProductAudienceOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<CreateProductAudienceResult>;
  createCustomAudience(
    client: MetaClient,
    options: CreateCustomAudienceOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<CreateCustomAudienceResult>;
  createPixel(
    client: MetaClient,
    options: CreatePixelOptions,
    execOptions?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<CreatePixelResult>;
  listPixels(
    client: MetaClient,
    options: { adAccountId: string; limit?: number }
  ): Promise<MetaPixelResult[]>;
  listAudiences(
    client: MetaClient,
    options: { adAccountId: string; limit?: number }
  ): Promise<MetaAudienceResult[]>;
  listCatalogs(
    client: MetaClient,
    options: { businessId: string; limit?: number }
  ): Promise<MetaCatalogResult[]>;
  listProductSets(
    client: MetaClient,
    options: { catalogId: string; limit?: number }
  ): Promise<MetaProductSetResult[]>;
  listInstagramAccounts(
    client: MetaClient,
    options?: { limit?: number }
  ): Promise<InstagramAccountResult[]>;
  listInstagramMedia(
    client: MetaClient,
    options: {
      igUserId: string;
      limit?: number;
      cursor?: string;
      permalinkUrls?: string[];
    }
  ): Promise<InstagramMediaResult[]>;
  listPartnershipContent(
    client: MetaClient,
    options: {
      businessId: string;
      fbPageId?: string;
      igUserId?: string;
      creatorUsername?: string;
      adCodes?: string[];
      platform?: string;
      mediaType?: string;
      postType?: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<PartnershipContentResult[]>;
  listThreadsProfiles(
    client: MetaClient,
    options?: { limit?: number }
  ): Promise<ThreadsProfileListResult>;
  listWhatsAppAccounts(
    client: MetaClient,
    options?: { businessId?: string; limit?: number }
  ): Promise<WhatsAppAccountResult[]>;
  listWhatsAppPhoneNumbers(
    client: MetaClient,
    options: { wabaId: string; limit?: number }
  ): Promise<WhatsAppPhoneNumberResult[]>;
  listWhatsAppMessageTemplates(
    client: MetaClient,
    options: { wabaId: string; name?: string; status?: string; limit?: number }
  ): Promise<WhatsAppTemplateResult[]>;
}

export interface MetaAdsAdapterOptions {
  clientFactory?: (config: MetaConfig) => MetaClient;
  tools?: Partial<MetaAdsAdapterTools>;
}

export class MetaAdsAdapter implements AdsProviderAdapter {
  readonly id = 'meta' as const;
  readonly displayName = 'Meta Ads';
  readonly capabilities = ADS_PROVIDER_CAPABILITY_MATRIX.meta;

  private readonly clientFactory: (config: MetaConfig) => MetaClient;
  private readonly tools: MetaAdsAdapterTools;

  constructor(options: MetaAdsAdapterOptions = {}) {
    this.clientFactory = options.clientFactory ?? ((config) => new MetaClient(config));
    this.tools = {
      getAdAccounts,
      getCampaigns,
      getAccountInsights,
      getCampaignInsights,
      getAdsetInsights,
      getAdsInsights,
      getMetaPlacementPerformance,
      pauseCampaign: pauseCampaignTool,
      resumeCampaign: resumeCampaignTool,
      updateCampaignBudget: updateCampaignBudgetTool,
      renameCampaign: renameCampaignTool,
      createCampaign: createCampaignTool,
      createAdSet: createAdSetTool,
      createAdCreative: createAdCreativeTool,
      createAd: createAdTool,
      cloneUiAd: cloneUiAdTool,
      archiveAd: archiveAdTool,
      deleteAudience: deleteAudienceTool,
      pauseAd: pauseAdTool,
      resumeAd: resumeAdTool,
      pauseAdSet: pauseAdSetTool,
      resumeAdSet: resumeAdSetTool,
      cloneAdSet: cloneAdSetTool,
      updateAdSet: updateAdSetTool,
      updateAd: updateAdTool,
      updateCampaign: updateCampaignTool,
      getTargetingOptions: getTargetingOptionsTool,
      createEcommerceCampaignBundle: createEcommerceCampaignBundleTool,
      createCpasCatalogCampaignBundle: createCpasCatalogCampaignBundleTool,
      uploadImage: uploadImageTool,
      uploadVideo: uploadVideoTool,
      listAdImages,
      listAdVideos,
      resolveCreativeAssets: resolveCreativeAssetsTool,
      getAdPreview,
      createProductAudience: createProductAudienceTool,
      createCustomAudience: createCustomAudienceTool,
      createPixel: createPixelTool,
      listPixels: listPixelsTool,
      listAudiences: listAudiencesTool,
      listCatalogs: listCatalogsTool,
      listProductSets: listProductSetsTool,
      listPages: listPagesTool,
      listLeadForms: listLeadFormsTool,
      listInstagramAccounts: listInstagramAccountsTool,
      listInstagramMedia: listInstagramMediaTool,
      listPartnershipContent: listPartnershipContentTool,
      listThreadsProfiles: listThreadsProfilesTool,
      listWhatsAppAccounts: listWhatsAppAccountsTool,
      listWhatsAppPhoneNumbers: listWhatsAppPhoneNumbersTool,
      listWhatsAppMessageTemplates: listWhatsAppMessageTemplatesTool,
      ...options.tools,
    };
  }

  async listAccounts(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdAccount[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    try {
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const accounts = await this.tools.getAdAccounts(this.createClient(context.credential), {
        limit,
      });
      return { ok: true, provider: 'meta', data: accounts, accounts };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listCampaigns(request: AdsBrokerRequest): Promise<AdsBrokerResponse<Campaign[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message:
              'accountId is required to list campaigns (provide accountId or use ads_list_accounts first)',
          },
        ],
      };
    }

    try {
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const campaigns = await this.tools.getCampaigns(this.createClient(context.credential), {
        adAccountId,
        limit,
      });
      return { ok: true, provider: 'meta', data: campaigns };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async getAccountPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'account');
  }

  async getCampaignPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'campaign');
  }

  async getAdsetOrAdgroupPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'adset');
  }

  async getAdPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'ad');
  }

  /**
   * Fetch ads with expanded `adset{...}` and `creative{...}` fields, scoped
   * to a single campaign/ad set via `resolveAdsEdgeScope` when possible
   * (Meta does not support scoping `/act_{id}/ads` itself — see that
   * function's doc comment) and post-filtered as a safety net for the
   * multi-id fallback case. Shared by getCreativePerformance's
   * complianceAudit branch and its campaign/adset-scoped creatives branch.
   */
  private async fetchActiveAdsWithCreatives(
    client: MetaClient,
    accountId: string,
    campaignId: string | string[] | undefined,
    adSetId: string | string[] | undefined,
    creativeFieldsFragment: string,
    effectiveStatusFilter: string[] | undefined,
    limit: number,
    cursor: string | undefined
  ): Promise<{ ads: MetaActiveAdCreativeRecord[]; nextCursor: string | null }> {
    const { path, needsPostFilter } = resolveAdsEdgeScope(
      normalizeAccountId(accountId),
      campaignId,
      adSetId
    );
    const params: Record<string, string | number> = {
      fields: `id,name,status,effective_status,campaign_id,adset{id,name,targeting},creative{${creativeFieldsFragment}}`,
      limit,
    };
    if (effectiveStatusFilter) {
      params.filtering = JSON.stringify([
        { field: 'effective_status', operator: 'IN', value: effectiveStatusFilter },
      ]);
    }
    if (cursor) {
      params.after = cursor;
    }

    const response = await client.metaGet<{
      data: MetaActiveAdCreativeRecord[];
      paging?: { cursors?: { after?: string } };
    }>(path, params);

    const ads = needsPostFilter
      ? filterAdsByEntityScope(
          response.data ?? [],
          campaignId,
          adSetId,
          (ad) => ad.campaign_id,
          (ad) => ad.adset?.id
        )
      : (response.data ?? []);

    return { ads, nextCursor: response.paging?.cursors?.after ?? null };
  }

  async getCreativePerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    const creativeId =
      typeof request.params.creativeId === 'string' ? request.params.creativeId : undefined;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required for Meta creative assets',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const mediaSourcingSupported = supportsMediaSourcingSpec(context.credential.apiVersion);
      const threadsUserIdSupported = supportsThreadsUserIdField(context.credential.apiVersion);
      const creativeFields = getMetaCreativeFields(mediaSourcingSupported, threadsUserIdSupported);
      const fields = creativeFields.join(',');
      const auditContext: MetaCreativeAuditContext = {
        requestedFields: {
          degrees_of_freedom_spec: true,
          media_sourcing_spec: mediaSourcingSupported,
          asset_feed_spec: true,
        },
      };
      const campaignId = parseIdParam(request.params.campaignId);
      const adSetId = parseIdParam(request.params.adSetId ?? request.params.adsetId);

      if (request.params.complianceAudit === true && !creativeId) {
        const effectiveStatuses = Array.isArray(request.params.effectiveStatus)
          ? request.params.effectiveStatus.filter(
              (status): status is string => typeof status === 'string'
            )
          : ['ACTIVE'];
        const { ads, nextCursor } = await this.fetchActiveAdsWithCreatives(
          client,
          accountId,
          campaignId,
          adSetId,
          fields,
          effectiveStatuses,
          typeof request.params.limit === 'number' ? request.params.limit : 100,
          typeof request.params.cursor === 'string' ? request.params.cursor : undefined
        );

        return {
          ok: true,
          provider: 'meta',
          data: ads
            .filter(
              (ad): ad is MetaActiveAdCreativeRecord & { creative: MetaCreativeRecord } =>
                ad.creative !== undefined
            )
            .map((ad) =>
              this.normalizeCreative(accountId, ad.creative, request, {
                ...auditContext,
                ad,
                activePlacements: deriveMetaActivePlacements(ad.adset?.targeting),
              })
            ),
          meta: { nextCursor },
        };
      }

      if (creativeId) {
        const creative = await client.metaGetObject<MetaCreativeRecord>(`/${creativeId}`, {
          fields,
        });

        return {
          ok: true,
          provider: 'meta',
          data: [this.normalizeCreative(accountId, creative, request, auditContext)],
          meta: { nextCursor: null },
        };
      }

      if (campaignId !== undefined || adSetId !== undefined) {
        const { ads, nextCursor } = await this.fetchActiveAdsWithCreatives(
          client,
          accountId,
          campaignId,
          adSetId,
          fields,
          undefined,
          typeof request.params.limit === 'number' ? request.params.limit : 100,
          typeof request.params.cursor === 'string' ? request.params.cursor : undefined
        );

        return {
          ok: true,
          provider: 'meta',
          data: ads
            .filter(
              (ad): ad is MetaActiveAdCreativeRecord & { creative: MetaCreativeRecord } =>
                ad.creative !== undefined
            )
            .map((ad) =>
              this.normalizeCreative(accountId, ad.creative, request, {
                ...auditContext,
                ad,
                activePlacements: deriveMetaActivePlacements(ad.adset?.targeting),
              })
            ),
          meta: { nextCursor },
        };
      }

      const response = await client.metaGet<{
        data: MetaCreativeRecord[];
        paging?: { cursors?: { after?: string } };
      }>(`/act_${normalizeAccountId(accountId)}/adcreatives`, {
        fields,
        limit: typeof request.params.limit === 'number' ? request.params.limit : 100,
        after: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
      });

      return {
        ok: true,
        provider: 'meta',
        data: (response.data ?? []).map((creative) =>
          this.normalizeCreative(accountId, creative, request, auditContext)
        ),
        meta: { nextCursor: response.paging?.cursors?.after ?? null },
      };
    } catch (error) {
      if (request.params.complianceAudit === true && isMetaComplianceAuditPermissionError(error)) {
        return {
          ok: false,
          provider: 'meta',
          errors: [
            {
              provider: 'meta',
              code: 'META_COMPLIANCE_AUDIT_PERMISSION_REQUIRED',
              message:
                'Meta blocked the compliance audit. Ensure the access token has ads_read, the token can access this ad account, and the Meta app is enabled for Marketing API reads.',
            },
          ],
        };
      }
      return this.errorResponse(error);
    }
  }

  private normalizeCreative(
    accountId: string,
    creative: MetaCreativeRecord,
    request: AdsBrokerRequest,
    auditContext?: MetaCreativeAuditContext
  ): AdsMetricRecord {
    const callToAction =
      creative.object_story_spec?.link_data?.call_to_action ??
      creative.object_story_spec?.video_data?.call_to_action;
    const destinationUrl = creative.object_story_spec?.link_data?.link ?? callToAction?.value?.link;

    return {
      provider: 'meta',
      level: 'creative',
      identity: {
        account_id: accountId,
        adset_or_adgroup_id: auditContext?.ad?.adset?.id,
        adset_or_adgroup_name: auditContext?.ad?.adset?.name,
        ad_id: auditContext?.ad?.id,
        ad_name: auditContext?.ad?.name,
        creative_id: creative.id,
        creative_name: creative.name,
      },
      time: {
        date_start: request.since ?? '',
        date_stop: request.until ?? '',
      },
      setup: auditContext?.ad
        ? {
            status: auditContext.ad.status,
            effective_status: auditContext.ad.effective_status,
          }
        : undefined,
      delivery: {
        spend: 0,
        impressions: 0,
      },
      creative: {
        creative_type: inferMetaCreativeType(creative),
        creative_url: creative.image_url,
        thumbnail_url: creative.thumbnail_url,
        video_id: creative.video_id,
        video_source_url: creative.source,
        image_hash: creative.image_hash,
        headline: creative.title,
        primary_text: creative.body,
        call_to_action: callToAction?.type,
        destination_url: destinationUrl,
        instagram_user_id:
          creative.object_story_spec?.instagram_user_id ?? creative.instagram_user_id,
        threads_user_id: creative.object_story_spec?.threads_user_id ?? creative.threads_user_id,
        setup_compliance: evaluateMetaCreativeCompliance({
          ...creative,
          requested_fields: auditContext?.requestedFields,
          active_placements: auditContext?.activePlacements,
        }),
      },
      raw: request.params.includeRaw === true ? creative : undefined,
    };
  }

  async getPlacementPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<PlacementPerformanceReport>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const validation = this.getPlacementPerformanceOptions(request, context.credential);
    if (!validation.ok) return validation.response;

    try {
      const data = await this.tools.getMetaPlacementPerformance(
        this.createClient(context.credential),
        validation.options
      );
      return { ok: true, provider: 'meta', data };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async resolveCreativeAssets(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<CreativeAssetResolution[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required for Meta creative asset resolution',
          },
        ],
      };
    }

    const limit = typeof request.params.limit === 'number' ? request.params.limit : 100;

    try {
      const result = await this.tools.resolveCreativeAssets(this.createClient(context.credential), {
        adAccountId: accountId,
        adIds: parseStringArrayParam(request.params.adIds ?? request.params.adId),
        campaignId: parseIdParam(request.params.campaignId),
        adSetId: parseIdParam(request.params.adSetId ?? request.params.adsetId),
        explicitFilters: parseExplicitMetaFilters(request.params.filtering),
        limit,
        cursor: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
        thumbnailWidth: parsePositiveIntegerParam(request.params.thumbnailWidth),
        thumbnailHeight: parsePositiveIntegerParam(request.params.thumbnailHeight),
      });

      // The tool augments the array with Meta's paging; surface it as a cursor
      // because JSON serialization drops non-index array properties.
      const page = result as CreativeAssetResolution[] & {
        paging?: { cursors?: { after?: string }; next?: string };
      };
      const nextCursor = page.paging?.cursors?.after ?? null;
      return {
        ok: true,
        provider: 'meta',
        data: page,
        meta: {
          nextCursor,
          ...partialPageWarningMeta(page.length, limit, nextCursor, Boolean(page.paging?.next)),
        },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async getChangeHistory(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsChangeHistoryEnvelope>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required for Meta change history',
          },
        ],
      };
    }

    const objectId = optionalTrimmedString(request.params.objectId);
    const includeDetails = request.params.includeDetails === true;
    const since = optionalTrimmedString(request.params.startTime) ?? request.since;
    const until = optionalTrimmedString(request.params.endTime) ?? request.until;
    const limit = typeof request.params.limit === 'number' ? request.params.limit : 100;
    const maxScanPages = resolveScanPageBudget(request.params.maxScanPages);
    const filters = {
      fields: META_ACTIVITY_FIELDS,
      since,
      until,
      category: normalizeMetaActivityCategory(request.params.eventCategory),
      uid: optionalTrimmedString(request.params.userId),
    };

    try {
      const client = this.createClient(context.credential);
      const accountPath = `/act_${normalizeAccountId(accountId)}/activities`;
      const cursor = optionalTrimmedString(request.params.cursor);

      // Meta exposes an /activities edge on ad sets only. Campaigns, ads and creatives
      // have no such edge and the account edge ignores object_id, so those fall back to
      // scanning the account feed.
      const scoped = objectId
        ? await fetchObjectActivities(client, objectId, { ...filters, limit, after: cursor })
        : undefined;

      const page =
        scoped ??
        (objectId
          ? await scanAccountActivities(client, accountPath, filters, {
              objectId,
              limit,
              cursor,
              maxScanPages,
            })
          : await fetchActivityPage(client, accountPath, { ...filters, limit, after: cursor }));

      const activities = page.activities;

      const rows = activities.map(
        (activity): AdsChangeHistoryRecord => ({
          provider: 'meta',
          account_id: accountId,
          event_time: activity.event_time,
          event_type: activity.event_type,
          translated_event_type: activity.translated_event_type,
          object_id: activity.object_id,
          object_name: activity.object_name,
          object_type: activity.object_type,
          actor_id: activity.actor_id,
          actor_name: activity.actor_name,
          application_id: activity.application_id,
          application_name: activity.application_name,
          actorId: activity.actor_id,
          actorName: activity.actor_name,
          applicationId: activity.application_id,
          applicationName: activity.application_name,
          changes: includeDetails
            ? normalizeMetaActivityChanges(activity.extra_data, activity.event_type)
            : undefined,
          raw: request.params.includeRaw === true ? activity : undefined,
        })
      );

      const warnings: AdsChangeHistoryEnvelope['warnings'] = [];
      if (rows.length === 0) {
        warnings.push({
          code: 'NO_CHANGE_HISTORY_ROWS',
          message: 'Meta returned no change history rows for the requested range.',
          severity: 'info',
        });
      }
      if (page.scannedPages !== undefined) {
        warnings.push({
          code: 'OBJECT_ID_FILTERED_CLIENT_SIDE',
          message: `Meta has no activities edge for this object and ignores object_id on the account edge, so ${page.scannedPages} account page(s) were scanned and filtered here.`,
          severity: 'info',
        });
      }
      if (page.scanIncomplete === true) {
        warnings.push({
          code: 'CHANGE_HISTORY_SCAN_INCOMPLETE',
          message: `Stopped after the ${maxScanPages}-page scan cap before satisfying limit. Older changes may exist — call again with the returned cursor, or raise maxScanPages.`,
          severity: 'warning',
        });
      }

      return {
        ok: true,
        provider: 'meta',
        data: {
          provider: 'meta',
          account: { id: accountId },
          dateRange: { since, until },
          rows,
          paging: { nextCursor: page.nextCursor },
          warnings,
          dataFreshness: { retrievedAt: new Date().toISOString() },
          capabilities: this.capabilities as unknown as Record<string, unknown>,
        },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private async getPerformance(
    request: AdsBrokerRequest,
    level: 'account' | 'campaign' | 'adset' | 'ad'
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const validation = this.getPerformanceOptions(request, context.credential);
    if (!validation.ok) return validation.response;

    try {
      const client = this.createClient(context.credential);
      const insights = await this.fetchInsights(client, level, validation.options);
      const data = normalizeMetaInsights(insights, {
        level,
        accountId: validation.options.adAccountId,
        since: validation.options.since,
        until: validation.options.until,
        mode: validation.options.mode,
      });

      const nextCursor = insights.paging?.cursors?.after ?? null;

      return {
        ok: true,
        provider: 'meta',
        data,
        meta: {
          ...(validation.options.mode === 'cpas' ? { mode: 'cpas' } : {}),
          nextCursor,
          ...partialPageWarningMeta(
            data.length,
            validation.options.limit,
            nextCursor,
            Boolean(insights.paging?.next)
          ),
        },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private fetchInsights(
    client: MetaClient,
    level: 'account' | 'campaign' | 'adset' | 'ad',
    options: {
      adAccountId: string;
      since: string;
      until: string;
      limit?: number;
      cursor?: string;
      breakdowns?: Array<LocationBreakdown | 'product_id'>;
      mode?: 'standard' | 'cpas';
      campaignId?: string | string[];
      adsetId?: string | string[];
      adId?: string | string[];
      explicitFilters?: MetaFilteringRule[];
    }
  ): Promise<
    Array<AccountInsight | CampaignInsight | AdsetInsight | AdInsight> & {
      paging?: { cursors?: { after?: string }; next?: string };
    }
  > {
    if (level === 'account') return this.tools.getAccountInsights(client, options);
    if (level === 'campaign') return this.tools.getCampaignInsights(client, options);
    if (level === 'adset') return this.tools.getAdsetInsights(client, options);
    return this.tools.getAdsInsights(client, options);
  }

  private getCredentialContext(
    request: AdsBrokerRequest
  ):
    | { ok: true; credential: CredentialContext }
    | { ok: false; response: AdsBrokerResponse<never> } {
    if (request.credentials?.provider !== 'meta' || !request.credentials.accessToken) {
      return {
        ok: false,
        response: {
          ok: false,
          provider: 'meta',
          errors: [
            {
              provider: 'meta',
              code: 'MISSING_META_CREDENTIALS',
              message: 'Meta credentials are required for MetaAdsAdapter',
            },
          ],
        },
      };
    }

    return { ok: true, credential: request.credentials };
  }

  private getPerformanceOptions(
    request: AdsBrokerRequest,
    credential: CredentialContext
  ):
    | {
        ok: true;
        options: {
          adAccountId: string;
          since: string;
          until: string;
          limit?: number;
          cursor?: string;
          breakdowns?: Array<LocationBreakdown | 'product_id'>;
          mode?: 'standard' | 'cpas';
          campaignId?: string | string[];
          adsetId?: string | string[];
          adId?: string | string[];
          explicitFilters?: MetaFilteringRule[];
        };
      }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const adAccountId = request.accountId ?? credential.accountId;
    const since = request.since;
    const until = request.until;
    const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
    const cursor = typeof request.params.cursor === 'string' ? request.params.cursor : undefined;
    const mode = request.params.mode === 'cpas' ? 'cpas' : undefined;
    const explicitFilters = parseCanonicalMetaFilters(request.params.filters);
    const campaignId = parseIdParam(request.params.campaignId);
    const adsetId = parseIdParam(request.params.adsetId ?? request.params.adSetId);
    const adId = parseIdParam(request.params.adId);
    let breakdowns: Array<LocationBreakdown | 'product_id'> | undefined;

    if (mode === 'cpas') {
      breakdowns = ['product_id'];
    } else {
      try {
        breakdowns = assertLocationBreakdowns(request.params.breakdowns);
      } catch (error) {
        return {
          ok: false,
          response: {
            ok: false,
            provider: 'meta',
            errors: [
              {
                provider: 'meta',
                code: 'INVALID_LOCATION_BREAKDOWN',
                message: error instanceof Error ? error.message : 'Invalid location breakdown',
              },
            ],
          },
        };
      }
    }

    if (!adAccountId || !since || !until) {
      return {
        ok: false,
        response: {
          ok: false,
          provider: 'meta',
          errors: [
            {
              provider: 'meta',
              code: 'MISSING_REQUIRED_PARAMS',
              message: 'Meta performance requests require accountId, since, and until',
            },
          ],
        },
      };
    }

    return {
      ok: true,
      options: {
        adAccountId,
        since,
        until,
        limit,
        cursor,
        breakdowns,
        mode,
        campaignId,
        adsetId,
        adId,
        explicitFilters: explicitFilters.length > 0 ? explicitFilters : undefined,
      },
    };
  }

  private getPlacementPerformanceOptions(
    request: AdsBrokerRequest,
    credential: CredentialContext
  ):
    | { ok: true; options: GetMetaPlacementPerformanceOptions }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const adAccountId = request.accountId ?? credential.accountId;
    const since = request.since;
    const until = request.until;
    const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
    const minSpendShare =
      typeof request.params.minSpendShare === 'number' ? request.params.minSpendShare : undefined;
    const minConversions =
      typeof request.params.minConversions === 'number' ? request.params.minConversions : undefined;
    const campaignId = parseIdParam(request.params.campaignId);
    const adsetId = parseIdParam(request.params.adsetId);
    const adId = parseIdParam(request.params.adId);
    const level = request.params.level;

    if (!adAccountId || !since || !until) {
      return {
        ok: false,
        response: {
          ok: false,
          provider: 'meta',
          errors: [
            {
              provider: 'meta',
              code: 'MISSING_REQUIRED_PARAMS',
              message: 'Meta placement performance requests require accountId, since, and until',
            },
          ],
        },
      };
    }

    if (level !== undefined && level !== 'campaign' && level !== 'adset' && level !== 'ad') {
      return {
        ok: false,
        response: {
          ok: false,
          provider: 'meta',
          errors: [
            {
              provider: 'meta',
              code: 'INVALID_LEVEL',
              message: 'Meta placement performance level must be campaign, adset, or ad',
            },
          ],
        },
      };
    }

    return {
      ok: true,
      options: {
        adAccountId,
        since,
        until,
        limit,
        level,
        campaignId,
        adsetId,
        adId,
        minSpendShare,
        minConversions,
      },
    };
  }

  private createClient(credential: CredentialContext): MetaClient {
    return this.clientFactory({
      accessToken: credential.accessToken ?? '',
      adAccountId: credential.accountId ?? '',
      apiVersion: credential.apiVersion ?? 'v25.0',
    });
  }

  private errorResponse(error: unknown): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'meta',
      errors: [
        {
          provider: 'meta',
          code: 'META_ADAPTER_ERROR',
          message: redactErrorMessage(error instanceof Error ? error.message : String(error)),
        },
      ],
    };
  }

  // --- Write Operations ---

  async pauseCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const campaignId = this.getEntityId(request);
    if (!campaignId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_CAMPAIGN_ID',
            message: 'campaignId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.pauseCampaign(client, campaignId);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async resumeCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const campaignId = this.getEntityId(request);
    if (!campaignId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_CAMPAIGN_ID',
            message: 'campaignId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.resumeCampaign(client, campaignId);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async updateCampaignBudget(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const campaignId = this.getEntityId(request);
    const dailyBudget =
      typeof request.params.dailyBudget === 'number' ? request.params.dailyBudget : undefined;

    if (!campaignId || dailyBudget === undefined) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'campaignId and dailyBudget are required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.updateCampaignBudget(client, campaignId, dailyBudget);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async renameCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const campaignId = this.getEntityId(request);
    const newName = typeof request.params.newName === 'string' ? request.params.newName : undefined;

    if (!campaignId || !newName) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'campaignId and newName are required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.renameCampaign(client, campaignId, newName);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createCampaign(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<CreateCampaignResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to create a campaign',
          },
        ],
      };
    }

    const name = typeof request.params.name === 'string' ? request.params.name : undefined;
    const objective =
      typeof request.params.objective === 'string' ? request.params.objective : undefined;

    if (!name || !objective) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'name and objective are required in request.params',
          },
        ],
      };
    }

    if (!META_ODAX_OBJECTIVES.includes(objective as MetaOdaxObjective)) {
      return validationResponse(
        new Error(`objective must be one of: ${META_ODAX_OBJECTIVES.join(', ')}.`)
      );
    }

    let mode: MetaAdsMode | undefined;
    try {
      mode = parseMetaAdsMode(request.params.mode);
    } catch (error) {
      return validationResponse(error);
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createCampaign(
        client,
        {
          adAccountId,
          name,
          objective: objective as import('../../tools/createCampaign.js').MetaCampaignObjective,
          mode,
          status:
            typeof request.params.status === 'string'
              ? (request.params.status as import('../../tools/createCampaign.js').CampaignStatus)
              : undefined,
          specialAdCategories: Array.isArray(request.params.specialAdCategories)
            ? request.params.specialAdCategories.map(String)
            : undefined,
          buyType:
            typeof request.params.buyType === 'string'
              ? (request.params.buyType as 'AUCTION' | 'RESERVED')
              : undefined,
          isAdSetBudgetSharingEnabled:
            typeof request.params.isAdSetBudgetSharingEnabled === 'boolean'
              ? request.params.isAdSetBudgetSharingEnabled
              : undefined,
          dailyBudget:
            typeof request.params.dailyBudget === 'number' ? request.params.dailyBudget : undefined,
          lifetimeBudget:
            typeof request.params.lifetimeBudget === 'number'
              ? request.params.lifetimeBudget
              : undefined,
          bidStrategy:
            typeof request.params.bidStrategy === 'string' ? request.params.bidStrategy : undefined,
          dedupeByName: request.params.dedupeByName === true,
          externalReference:
            typeof request.params.externalReference === 'string'
              ? request.params.externalReference
              : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createProductAudience(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<CreateProductAudienceResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to create a product audience',
          },
        ],
      };
    }

    const name = typeof request.params.name === 'string' ? request.params.name : undefined;
    const productSetId =
      typeof request.params.productSetId === 'string' ? request.params.productSetId : undefined;
    const inclusions = Array.isArray(request.params.inclusions)
      ? (request.params.inclusions as CreateProductAudienceOptions['inclusions'])
      : undefined;

    if (!name || !productSetId || !inclusions) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'name, productSetId, and inclusions are required in request.params',
          },
        ],
      };
    }

    const exclusions = Array.isArray(request.params.exclusions)
      ? (request.params.exclusions as CreateProductAudienceOptions['exclusions'])
      : undefined;

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createProductAudience(
        client,
        { adAccountId, name, productSetId, inclusions, exclusions },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
          maxRetries:
            typeof request.params.maxRetries === 'number' ? request.params.maxRetries : undefined,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createCustomAudience(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<CreateCustomAudienceResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to create a custom audience',
          },
        ],
      };
    }

    const name = typeof request.params.name === 'string' ? request.params.name : undefined;
    const pixelId = typeof request.params.pixelId === 'string' ? request.params.pixelId : undefined;
    const rule =
      typeof request.params.rule === 'object' && request.params.rule !== null
        ? (request.params.rule as Record<string, unknown>)
        : undefined;

    if (!name || !pixelId || !rule) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'name, pixelId, and rule are required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createCustomAudience(
        client,
        {
          adAccountId,
          name,
          subtype: 'WEBSITE',
          pixelId,
          rule,
          retentionDays:
            typeof request.params.retentionDays === 'number'
              ? request.params.retentionDays
              : undefined,
          description:
            typeof request.params.description === 'string' ? request.params.description : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
          maxRetries:
            typeof request.params.maxRetries === 'number' ? request.params.maxRetries : undefined,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createPixel(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreatePixelResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to create a pixel',
          },
        ],
      };
    }

    const name = typeof request.params.name === 'string' ? request.params.name : undefined;
    if (!name) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          { provider: 'meta', code: 'MISSING_REQUIRED_PARAMS', message: 'name is required in request.params' },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createPixel(
        client,
        { adAccountId, name },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
          maxRetries:
            typeof request.params.maxRetries === 'number' ? request.params.maxRetries : undefined,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdSetResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to create an ad set',
          },
        ],
      };
    }

    const campaignId =
      typeof request.params.campaignId === 'string' ? request.params.campaignId : undefined;
    const name = typeof request.params.name === 'string' ? request.params.name : undefined;

    if (!campaignId || !name) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'campaignId and name are required in request.params',
          },
        ],
      };
    }

    let mode: MetaAdsMode | undefined;
    let collaborativeCatalog: MetaCollaborativeCatalogContext | undefined;
    try {
      mode = parseMetaAdsMode(request.params.mode);
      collaborativeCatalog = parseCollaborativeCatalog(request.params.collaborativeCatalog);
    } catch (error) {
      return validationResponse(error);
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createAdSet(
        client,
        {
          adAccountId,
          campaignId,
          name,
          mode,
          collaborativeCatalog,
          status:
            typeof request.params.status === 'string'
              ? (request.params.status as import('../../tools/createAdSet.js').AdSetStatus)
              : undefined,
          dailyBudget:
            typeof request.params.dailyBudget === 'number' ? request.params.dailyBudget : undefined,
          lifetimeBudget:
            typeof request.params.lifetimeBudget === 'number'
              ? request.params.lifetimeBudget
              : undefined,
          billingEvent:
            typeof request.params.billingEvent === 'string'
              ? (request.params.billingEvent as import('../../tools/createAdSet.js').BillingEvent)
              : undefined,
          optimizationGoal:
            typeof request.params.optimizationGoal === 'string'
              ? (request.params
                  .optimizationGoal as import('../../tools/createAdSet.js').OptimizationGoal)
              : undefined,
          conversionLocation:
            typeof request.params.conversionLocation === 'string'
              ? (request.params.conversionLocation as MetaConversionLocation)
              : undefined,
          messagingDestination: parseMetaMessagingDestination(request.params.messagingDestination),
          creativeFormat:
            request.params.creativeFormat === undefined
              ? undefined
              : parseMetaCreativeFormat(request.params.creativeFormat),
          pageId: typeof request.params.pageId === 'string' ? request.params.pageId : undefined,
          whatsappPhoneNumber:
            typeof request.params.whatsappPhoneNumber === 'string'
              ? request.params.whatsappPhoneNumber
              : undefined,
          pixelId: typeof request.params.pixelId === 'string' ? request.params.pixelId : undefined,
          leadFormId:
            typeof request.params.leadFormId === 'string' ? request.params.leadFormId : undefined,
          applicationId:
            typeof request.params.applicationId === 'string'
              ? request.params.applicationId
              : undefined,
          objectStoreUrl:
            typeof request.params.objectStoreUrl === 'string'
              ? request.params.objectStoreUrl
              : undefined,
          productSetId:
            typeof request.params.productSetId === 'string'
              ? request.params.productSetId
              : undefined,
          customEventType:
            typeof request.params.customEventType === 'string'
              ? request.params.customEventType
              : undefined,
          bidStrategy:
            typeof request.params.bidStrategy === 'string' ? request.params.bidStrategy : undefined,
          bidAmount:
            typeof request.params.bidAmount === 'number' ? request.params.bidAmount : undefined,
          bidConstraints:
            typeof request.params.bidConstraints === 'object' &&
            request.params.bidConstraints !== null
              ? (request.params.bidConstraints as Record<string, unknown>)
              : undefined,
          dailySpendCap:
            typeof request.params.dailySpendCap === 'number'
              ? request.params.dailySpendCap
              : undefined,
          dailyMinSpendTarget:
            typeof request.params.dailyMinSpendTarget === 'number'
              ? request.params.dailyMinSpendTarget
              : undefined,
          lifetimeSpendCap:
            typeof request.params.lifetimeSpendCap === 'number'
              ? request.params.lifetimeSpendCap
              : undefined,
          lifetimeMinSpendTarget:
            typeof request.params.lifetimeMinSpendTarget === 'number'
              ? request.params.lifetimeMinSpendTarget
              : undefined,
          targeting: this.parseAdSetTargeting(request),
          promotedObject:
            typeof request.params.promotedObject === 'object' &&
            request.params.promotedObject !== null
              ? (request.params.promotedObject as Record<string, unknown>)
              : undefined,
          startTime:
            typeof request.params.startTime === 'string' ? request.params.startTime : undefined,
          endTime: typeof request.params.endTime === 'string' ? request.params.endTime : undefined,
          destinationType:
            typeof request.params.destinationType === 'string'
              ? request.params.destinationType
              : undefined,
          attributionSpec: Array.isArray(request.params.attributionSpec)
            ? (request.params.attributionSpec as Array<Record<string, unknown>>)
            : undefined,
          frequencyControlSpecs: Array.isArray(request.params.frequencyControlSpecs)
            ? (request.params.frequencyControlSpecs as Array<Record<string, unknown>>)
            : undefined,
          isDynamicCreative:
            typeof request.params.isDynamicCreative === 'boolean'
              ? request.params.isDynamicCreative
              : undefined,
          dsaBeneficiary:
            typeof request.params.dsaBeneficiary === 'string'
              ? request.params.dsaBeneficiary
              : undefined,
          dsaPayor:
            typeof request.params.dsaPayor === 'string' ? request.params.dsaPayor : undefined,
          multiAdvertiserAds:
            typeof request.params.multiAdvertiserAds === 'number'
              ? request.params.multiAdvertiserAds
              : undefined,
          dedupeByName: request.params.dedupeByName === true,
          externalReference:
            typeof request.params.externalReference === 'string'
              ? request.params.externalReference
              : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createAdCreative(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<CreateAdCreativeResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const name = typeof request.params.name === 'string' ? request.params.name : undefined;
    const pageId = typeof request.params.pageId === 'string' ? request.params.pageId : undefined;

    if (!adAccountId || !name) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'accountId and name are required',
          },
        ],
      };
    }

    try {
      assertKnownParams(request.params, CREATE_AD_CREATIVE_PARAMS, CREATE_AD_CREATIVE_PARAM_HINTS);
    } catch (error) {
      return validationResponse(error);
    }

    const hasCreativeFormat = request.params.creativeFormat !== undefined;
    const hasCreativeSpec = request.params.creativeSpec !== undefined;
    if (hasCreativeFormat !== hasCreativeSpec) {
      return validationResponse(
        new Error('creativeFormat dan creativeSpec wajib diberikan bersama-sama.')
      );
    }

    let mode: MetaAdsMode | undefined;
    let creative: MetaCreativeSpec | undefined;
    let collaborativeProductSetId: string | undefined;
    let collaborativeAppSpec: MetaCollaborativeAppSpec | undefined;
    let standardAppSpec: MetaStandardAppSpec | undefined;
    let partnership: MetaPartnershipSpec | undefined;
    let destinationType: CreativeDestinationType | undefined;
    let objective: MetaOdaxObjective | undefined;
    let conversionLocation: MetaConversionLocation | undefined;
    let messagingDestination: MetaMessagingDestination | undefined;
    let welcomeMessageTemplateName: string | undefined;
    try {
      mode = parseMetaAdsMode(request.params.mode);
      destinationType = parseCreativeDestinationType(request.params.destinationType);
      objective = parseMetaOdaxObjective(request.params.objective);
      conversionLocation = parseMetaConversionLocation(request.params.conversionLocation);
      messagingDestination = parseMetaMessagingDestination(request.params.messagingDestination);
      welcomeMessageTemplateName = optionalString(
        request.params.welcomeMessageTemplateName,
        'welcomeMessageTemplateName'
      );
      collaborativeProductSetId = optionalString(
        request.params.collaborativeProductSetId,
        'collaborativeProductSetId'
      );
      collaborativeAppSpec = parseCollaborativeAppSpec(request.params.collaborativeAppSpec);
      standardAppSpec = parseStandardAppSpec(request.params.standardAppSpec);
      partnership = parsePartnershipSpec(request.params.partnership);
      if (hasCreativeFormat && hasCreativeSpec) {
        const creativeFormat = parseMetaCreativeFormat(request.params.creativeFormat);
        creative = parseMetaCreativeSpec(
          creativeFormat,
          await withResolvedWelcomeMessageTemplate(
            requireRecord(request.params.creativeSpec, 'creativeSpec'),
            welcomeMessageTemplateName
          )
        );
      } else if (welcomeMessageTemplateName) {
        throw new Error(
          'welcomeMessageTemplateName hanya dapat digunakan bersama creativeFormat dan creativeSpec.'
        );
      }
    } catch (error) {
      return validationResponse(error);
    }

    if (creative?.creativeFormat === 'flexible') {
      return validationResponse(new Error(DYNAMIC_CREATIVE_DISABLED_MESSAGE));
    }

    const assetFeedBlockError = assetFeedSpecCreateBlockError({
      assetFeedSpec: request.params.assetFeedSpec,
      objectStorySpec: request.params.objectStorySpec,
    });
    if (assetFeedBlockError) {
      return validationResponse(assetFeedBlockError);
    }

    if (request.params.whatsappWelcomeMessageSequenceId !== undefined) {
      return validationResponse(
        new Error(
          `${DYNAMIC_CREATIVE_DISABLED_MESSAGE} whatsappWelcomeMessageSequenceId juga disabled karena menulis asset_feed_spec.additional_data; pakai pageWelcomeMessage manual.`
        )
      );
    }

    if (creative) {
      const ignoredLegacyFields = LEGACY_CREATIVE_FIELDS.filter(
        (field) => request.params[field] !== undefined
      );
      if (ignoredLegacyFields.length > 0) {
        return validationResponse(
          new Error(
            `creativeFormat dan creativeSpec sedang dipakai, tapi field top-level berikut juga diisi dan akan DIABAIKAN (tidak digabung): ${ignoredLegacyFields.join(', ')}. Pindahkan nilainya ke dalam creativeSpec (mis. primaryText untuk teks utama, headline, destinationUrl, callToAction, imageHash/videoId sesuai creativeFormat), atau lepas creativeFormat+creativeSpec sepenuhnya untuk memakai jalur legacy top-level.`
          )
        );
      }
    }

    if ((objective === undefined) !== (conversionLocation === undefined)) {
      return validationResponse(
        new Error('objective dan conversionLocation harus diisi bersama untuk creative launch.')
      );
    }

    // For custom/Flexible asset-feed payloads, page_id may already be nested
    // inside objectStorySpec — don't demand it a second time at top level.
    const objectStorySpecPageId =
      isRecord(request.params.objectStorySpec) &&
      typeof request.params.objectStorySpec.page_id === 'string'
        ? request.params.objectStorySpec.page_id
        : undefined;
    const effectivePageId = pageId ?? objectStorySpecPageId;

    if (!effectivePageId && creative?.creativeFormat !== 'existing_post') {
      return validationResponse(
        new Error('pageId wajib diisi (langsung, atau di dalam objectStorySpec.page_id).')
      );
    }

    try {
      const client = this.createClient(context.credential);
      const link = typeof request.params.link === 'string' ? request.params.link : undefined;
      const message =
        typeof request.params.message === 'string' ? request.params.message : undefined;
      const headline =
        typeof request.params.headline === 'string' ? request.params.headline : undefined;
      const objectStorySpec = isRecord(request.params.objectStorySpec)
        ? request.params.objectStorySpec
        : undefined;
      const assetFeedSpec = isRecord(request.params.assetFeedSpec)
        ? request.params.assetFeedSpec
        : undefined;
      const ctaType =
        typeof request.params.callToActionType === 'string'
          ? request.params.callToActionType
          : 'SHOP_NOW';

      if (!creative && !objectStorySpec && (!link || !message)) {
        return {
          ok: false,
          provider: 'meta',
          errors: [
            {
              provider: 'meta',
              code: 'MISSING_CREATIVE_CONTENT',
              message:
                'Provide link and message for a simple creative, creativeFormat+creativeSpec for new creatives, or objectStorySpec for a custom legacy asset-feed payload.',
            },
          ],
        };
      }

      const linkData =
        !creative && link && message
          ? {
              link,
              message,
              name: headline,
              description:
                typeof request.params.description === 'string'
                  ? request.params.description
                  : undefined,
              imageHash:
                typeof request.params.imageHash === 'string' ? request.params.imageHash : undefined,
              callToAction: { type: ctaType, value: { link } },
            }
          : undefined;

      const result = await this.tools.createAdCreative(
        client,
        {
          adAccountId,
          name,
          pageId: effectivePageId,
          mode,
          objective,
          conversionLocation,
          messagingDestination,
          creative,
          collaborativeProductSetId,
          collaborativeAppSpec,
          standardAppSpec,
          partnership,
          linkData,
          objectStorySpec: creative ? undefined : objectStorySpec,
          assetFeedSpec: creative ? undefined : assetFeedSpec,
          imageHash:
            typeof request.params.imageHash === 'string' ? request.params.imageHash : undefined,
          urlTags: typeof request.params.urlTags === 'string' ? request.params.urlTags : undefined,
          instagramUserId:
            typeof request.params.instagramUserId === 'string'
              ? request.params.instagramUserId
              : undefined,
          threadsProfileId:
            typeof request.params.threadsProfileId === 'string'
              ? request.params.threadsProfileId
              : undefined,
          destinationType,
          pageWelcomeMessage:
            typeof request.params.pageWelcomeMessage === 'string'
              ? request.params.pageWelcomeMessage
              : undefined,
          whatsappWelcomeMessageSequenceId:
            typeof request.params.whatsappWelcomeMessageSequenceId === 'string'
              ? request.params.whatsappWelcomeMessageSequenceId
              : undefined,
          dedupeByName: request.params.dedupeByName === true,
          externalReference:
            typeof request.params.externalReference === 'string'
              ? request.params.externalReference
              : undefined,
          optOutEnhancements: Array.isArray(request.params.optOutEnhancements)
            ? (request.params.optOutEnhancements as string[])
            : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const name = typeof request.params.name === 'string' ? request.params.name : undefined;
    const adSetId = typeof request.params.adSetId === 'string' ? request.params.adSetId : undefined;
    const creativeId =
      typeof request.params.creativeId === 'string' ? request.params.creativeId : undefined;
    const multiMedia = isMultiMediaAdOptions(request.params.multiMedia)
      ? request.params.multiMedia
      : undefined;

    if (!adAccountId || !name || !adSetId || (!creativeId && !multiMedia)) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message:
              'accountId, name, adSetId, and exactly one of creativeId or multiMedia are required',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createAd(
        client,
        {
          adAccountId,
          name,
          adSetId,
          creativeId,
          multiMedia,
          sourceAdId:
            typeof request.params.sourceAdId === 'string' ? request.params.sourceAdId : undefined,
          status:
            typeof request.params.status === 'string'
              ? (request.params.status as import('../../tools/createAd.js').AdStatus)
              : undefined,
          pixelId: typeof request.params.pixelId === 'string' ? request.params.pixelId : undefined,
          trackingSpecs: Array.isArray(request.params.trackingSpecs)
            ? (request.params.trackingSpecs as Record<string, unknown>[])
            : undefined,
          dedupeByName: request.params.dedupeByName === true,
          skipOmnichannelCheck: request.params.skipOmnichannelCheck === true,
          skipPlacementCompatibilityCheck: request.params.skipPlacementCompatibilityCheck === true,
          skipMessagingDestinationCheck: request.params.skipMessagingDestinationCheck === true,
          skipAdSetCreativeFamilyCheck: request.params.skipAdSetCreativeFamilyCheck === true,
          externalReference:
            typeof request.params.externalReference === 'string'
              ? request.params.externalReference
              : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async cloneUiAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CloneUiAdResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const name = typeof request.params.name === 'string' ? request.params.name : undefined;
    const adSetId = typeof request.params.adSetId === 'string' ? request.params.adSetId : undefined;
    const sourceAdId =
      typeof request.params.sourceAdId === 'string' ? request.params.sourceAdId : undefined;

    if (!adAccountId || !name || !adSetId || !sourceAdId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'accountId, name, adSetId, and sourceAdId are required',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.cloneUiAd(
        client,
        {
          adAccountId,
          name,
          adSetId,
          sourceAdId,
          status:
            typeof request.params.status === 'string'
              ? (request.params.status as import('../../tools/cloneUiAd.js').CloneUiAdAdStatus)
              : undefined,
          pixelId: typeof request.params.pixelId === 'string' ? request.params.pixelId : undefined,
          trackingSpecs: Array.isArray(request.params.trackingSpecs)
            ? (request.params.trackingSpecs as Record<string, unknown>[])
            : undefined,
          dedupeByName: request.params.dedupeByName === true,
          externalReference:
            typeof request.params.externalReference === 'string'
              ? request.params.externalReference
              : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async archiveAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ArchiveAdResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adId = typeof request.params.adId === 'string' ? request.params.adId : undefined;
    if (!adId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_AD_ID',
            message: 'adId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.archiveAd(
        client,
        { adId },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async deleteAudience(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<DeleteAudienceResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const audienceId =
      typeof request.params.audienceId === 'string' ? request.params.audienceId : undefined;
    if (!audienceId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_AUDIENCE_ID',
            message: 'audienceId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.deleteAudience(
        client,
        { audienceId },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async pauseAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adId = typeof request.params.adId === 'string' ? request.params.adId : undefined;
    if (!adId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_AD_ID',
            message: 'adId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.pauseAd(client, adId);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async resumeAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adId = typeof request.params.adId === 'string' ? request.params.adId : undefined;
    if (!adId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_AD_ID',
            message: 'adId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.resumeAd(client, adId);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async pauseAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adSetId =
      typeof request.params.adSetId === 'string'
        ? request.params.adSetId
        : typeof request.params.adsetId === 'string'
          ? request.params.adsetId
          : undefined;
    if (!adSetId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ADSET_ID',
            message: 'adSetId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.pauseAdSet(client, adSetId);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async resumeAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adSetId =
      typeof request.params.adSetId === 'string'
        ? request.params.adSetId
        : typeof request.params.adsetId === 'string'
          ? request.params.adsetId
          : undefined;
    if (!adSetId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ADSET_ID',
            message: 'adSetId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.resumeAdSet(client, adSetId);
      return { ok: true, provider: 'meta', data: this.toAdsMutationResult(result) };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async cloneAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CloneAdSetResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    const sourceAdSetId =
      typeof request.params.sourceAdSetId === 'string' ? request.params.sourceAdSetId : undefined;
    if (!accountId || !sourceAdSetId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_CLONE_TARGET',
            message: 'accountId and sourceAdSetId are required to clone an ad set',
          },
        ],
      };
    }

    try {
      // The raw Graph spelling would otherwise be ignored, leaving the caller to
      // believe their attribution override applied when the source's window was
      // copied verbatim.
      if (
        request.params.attribution_spec !== undefined &&
        request.params.attributionSpec === undefined
      ) {
        throw new Error(
          'attribution_spec tidak dikenali dan TIDAK dikirim ke Meta. Pakai attributionSpec (camelCase).'
        );
      }

      const client = this.createClient(context.credential);
      const result = await this.tools.cloneAdSet(
        client,
        {
          adAccountId: accountId,
          sourceAdSetId,
          name: typeof request.params.name === 'string' ? request.params.name : undefined,
          campaignId:
            typeof request.params.campaignId === 'string' ? request.params.campaignId : undefined,
          status:
            request.params.status === 'ACTIVE' || request.params.status === 'PAUSED'
              ? request.params.status
              : undefined,
          startTime:
            typeof request.params.startTime === 'string' ? request.params.startTime : undefined,
          endTime: typeof request.params.endTime === 'string' ? request.params.endTime : undefined,
          dailyBudget:
            typeof request.params.dailyBudget === 'number' ? request.params.dailyBudget : undefined,
          lifetimeBudget:
            typeof request.params.lifetimeBudget === 'number'
              ? request.params.lifetimeBudget
              : undefined,
          optimizationGoal:
            typeof request.params.optimizationGoal === 'string'
              ? request.params.optimizationGoal
              : undefined,
          attributionSpec: parseAttributionSpec(request.params.attributionSpec),
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async updateAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateAdSetResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adSetId = typeof request.params.adSetId === 'string' ? request.params.adSetId : undefined;
    if (!adSetId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ADSET_ID',
            message: 'adSetId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.updateAdSet(
        client,
        {
          adSetId,
          name: typeof request.params.name === 'string' ? request.params.name : undefined,
          status:
            typeof request.params.status === 'string'
              ? (request.params.status as 'ACTIVE' | 'PAUSED')
              : undefined,
          dailyBudget:
            typeof request.params.dailyBudget === 'number' ? request.params.dailyBudget : undefined,
          lifetimeBudget:
            typeof request.params.lifetimeBudget === 'number'
              ? request.params.lifetimeBudget
              : undefined,
          dailySpendCap:
            typeof request.params.dailySpendCap === 'number'
              ? request.params.dailySpendCap
              : undefined,
          dailyMinSpendTarget:
            typeof request.params.dailyMinSpendTarget === 'number'
              ? request.params.dailyMinSpendTarget
              : undefined,
          lifetimeSpendCap:
            typeof request.params.lifetimeSpendCap === 'number'
              ? request.params.lifetimeSpendCap
              : undefined,
          lifetimeMinSpendTarget:
            typeof request.params.lifetimeMinSpendTarget === 'number'
              ? request.params.lifetimeMinSpendTarget
              : undefined,
          bidStrategy:
            typeof request.params.bidStrategy === 'string' ? request.params.bidStrategy : undefined,
          startTime:
            typeof request.params.startTime === 'string' ? request.params.startTime : undefined,
          endTime: typeof request.params.endTime === 'string' ? request.params.endTime : undefined,
          mode: request.params.mode === 'replace' ? 'replace' : 'patch',
          replaceTargetingConfirmed: request.params.replaceTargetingConfirmed === true,
          targeting: this.parseAdSetTargeting(request) as
            | import('../../tools/createAdSet.js').AdSetTargeting
            | undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async updateAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateAdResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adId = typeof request.params.adId === 'string' ? request.params.adId : undefined;
    if (!adId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_AD_ID',
            message: 'adId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.updateAd(
        client,
        {
          adId,
          adAccountId: request.accountId ?? context.credential.accountId,
          name: typeof request.params.name === 'string' ? request.params.name : undefined,
          status:
            typeof request.params.status === 'string'
              ? (request.params.status as 'ACTIVE' | 'PAUSED' | 'ARCHIVED')
              : undefined,
          creativeId:
            typeof request.params.creativeId === 'string' ? request.params.creativeId : undefined,
          trackingSpecs: Array.isArray(request.params.trackingSpecs)
            ? (request.params.trackingSpecs as Record<string, unknown>[])
            : undefined,
          conversionDomain:
            typeof request.params.conversionDomain === 'string'
              ? request.params.conversionDomain
              : undefined,
          adScheduleStartTime:
            typeof request.params.adScheduleStartTime === 'string'
              ? request.params.adScheduleStartTime
              : undefined,
          adScheduleEndTime:
            typeof request.params.adScheduleEndTime === 'string'
              ? request.params.adScheduleEndTime
              : undefined,
          multiMedia: isMultiMediaAdOptions(request.params.multiMedia)
            ? request.params.multiMedia
            : undefined,
          multiMediaCreativeName:
            typeof request.params.multiMediaCreativeName === 'string'
              ? request.params.multiMediaCreativeName
              : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async updateCampaign(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<UpdateCampaignResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const campaignId =
      typeof request.params.campaignId === 'string' ? request.params.campaignId : undefined;
    if (!campaignId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_CAMPAIGN_ID',
            message: 'campaignId is required in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.updateCampaign(
        client,
        {
          campaignId,
          name: typeof request.params.name === 'string' ? request.params.name : undefined,
          status:
            typeof request.params.status === 'string'
              ? (request.params.status as 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED')
              : undefined,
          lifetimeBudget:
            typeof request.params.lifetimeBudget === 'number'
              ? request.params.lifetimeBudget
              : undefined,
          spendCap:
            typeof request.params.spendCap === 'number' ? request.params.spendCap : undefined,
          bidStrategy:
            typeof request.params.bidStrategy === 'string' ? request.params.bidStrategy : undefined,
          specialAdCategories: Array.isArray(request.params.specialAdCategories)
            ? (request.params.specialAdCategories as string[])
            : undefined,
          startTime:
            typeof request.params.startTime === 'string' ? request.params.startTime : undefined,
          stopTime:
            typeof request.params.stopTime === 'string' ? request.params.stopTime : undefined,
          deleteConfirmed: request.params.deleteConfirmed === true,
          adsetBudgets: Array.isArray(request.params.adsetBudgets)
            ? (request.params.adsetBudgets as Array<Record<string, unknown>>).map((entry) => ({
                adsetId: String(entry.adsetId),
                dailyBudget: typeof entry.dailyBudget === 'number' ? entry.dailyBudget : undefined,
                lifetimeBudget:
                  typeof entry.lifetimeBudget === 'number' ? entry.lifetimeBudget : undefined,
              }))
            : undefined,
        },
        {
          dryRun: request.params.dryRun !== false,
          confirmed: request.params.confirmed === true,
        }
      );
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async getTargetingOptions(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<GetTargetingOptionsResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const type =
      typeof request.params.type === 'string'
        ? (request.params.type as import('../../tools/getTargetingOptions.js').TargetingOptionType)
        : undefined;

    if (!adAccountId || !type) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'accountId and type are required',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.getTargetingOptions(client, {
        adAccountId,
        type,
        query: typeof request.params.query === 'string' ? request.params.query : undefined,
        limit: typeof request.params.limit === 'number' ? request.params.limit : undefined,
      });
      return { ok: true, provider: 'meta', data: result };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async createEcommerceCampaignBundle(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const payload = this.getEcommerceCampaignBundlePayload(request, context.credential);
    if (!payload.ok) return payload.response;

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createEcommerceCampaignBundle(client, payload.payload, {
        dryRun: request.params.dryRun !== false,
        confirmed: request.params.confirmed === true,
      });
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async createCpasCatalogCampaignBundle(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<CpasCatalogCampaignBundleResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;
    const payload = this.getCpasCatalogCampaignBundlePayload(request, context.credential);
    if (!payload.ok) return payload.response;
    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.createCpasCatalogCampaignBundle(client, payload.payload, {
        dryRun: request.params.dryRun !== false,
        confirmed: request.params.confirmed === true,
      });
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async uploadImage(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ImageUploadResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const filePath =
      typeof request.params.filePath === 'string' ? request.params.filePath : undefined;
    if (!adAccountId || !filePath) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'Meta image upload requires accountId and filePath',
          },
        ],
      };
    }

    try {
      const result = await this.tools.uploadImage(this.createClient(context.credential), {
        adAccountId,
        filePath,
        maxRetries: typeof request.params.maxRetries === 'number' ? request.params.maxRetries : 3,
      });
      return { ok: result.status === 'executed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async uploadVideo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoUploadResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const filePath =
      typeof request.params.filePath === 'string' ? request.params.filePath : undefined;
    if (!adAccountId || !filePath) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'Meta video upload requires accountId and filePath',
          },
        ],
      };
    }

    try {
      const result = await this.tools.uploadVideo(this.createClient(context.credential), {
        adAccountId,
        filePath,
        title: typeof request.params.title === 'string' ? request.params.title : undefined,
        description:
          typeof request.params.description === 'string' ? request.params.description : undefined,
        maxRetries: typeof request.params.maxRetries === 'number' ? request.params.maxRetries : 3,
      });
      return { ok: result.status !== 'failed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async getVideoSource(request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoSourceResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const videoId = typeof request.params.videoId === 'string' ? request.params.videoId : undefined;
    if (!videoId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_VIDEO_ID',
            message: 'videoId is required in request.params',
          },
        ],
      };
    }

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to fetch video source',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);

      // Step 1: Try direct video node first (source, embed_html, picture)
      let sourceUrl: string | undefined;
      let embedHtml: string | undefined;
      let thumbnailUrl: string | undefined;

      try {
        const directResponse = await client.metaGetObject<{
          id?: string;
          source?: string;
          embed_html?: string;
          picture?: string;
        }>(`/${videoId}`, {
          fields: 'source,embed_html,picture',
        });

        sourceUrl = directResponse.source;
        embedHtml = directResponse.embed_html;
        thumbnailUrl = directResponse.picture;
      } catch {
        // Direct node failed (likely permission), fall through to batch
      }

      if (!sourceUrl) {
        // Step 2: Fallback to batch /advideos endpoint (works with ads_read scope)
        try {
          const batchResponse = await client.metaGet<{
            data: Array<{
              id?: string;
              source?: string;
              embed_html?: string;
              thumbnails?: { uri?: string };
            }>;
          }>(`/act_${accountId}/advideos`, {
            fields: 'id,source,embed_html,thumbnails',
            limit: 200,
          });

          const matchedVideo = (batchResponse.data ?? []).find((v) => v.id === videoId);

          if (matchedVideo?.source) {
            sourceUrl = matchedVideo.source;
            embedHtml = matchedVideo.embed_html;
            thumbnailUrl = matchedVideo.thumbnails?.uri;
          }
        } catch {
          // Batch also failed, fall through to Step 3
        }
      }

      if (!sourceUrl) {
        // Step 3: Return fallback Facebook Watch URL
        return {
          ok: true,
          provider: 'meta',
          data: {
            provider: 'meta',
            video_id: videoId,
            source_url: `https://www.facebook.com/watch/?v=${videoId}`,
          },
          meta: {
            warning:
              'Direct video source URL not available from Meta API. Fallback to Facebook Watch URL.',
          },
        };
      }

      return {
        ok: true,
        provider: 'meta',
        data: {
          provider: 'meta',
          video_id: videoId,
          source_url: sourceUrl,
          embed_html: embedHtml,
          thumbnail_url: thumbnailUrl,
        },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async getAdCreativeMapping(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdCreativeMappingResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to fetch ad→creative mapping',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const adIds = Array.isArray(request.params.adIds)
        ? request.params.adIds.map(String)
        : undefined;
      const campaignId = parseIdParam(request.params.campaignId);
      const adSetId = parseIdParam(request.params.adSetId ?? request.params.adsetId);
      const explicitFilters = parseExplicitMetaFilters(request.params.filtering);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : 100;
      const result = await getAdCreativeMapping(client, {
        adAccountId: accountId,
        adIds,
        campaignId,
        adSetId,
        explicitFilters: explicitFilters.length > 0 ? explicitFilters : undefined,
        limit,
        cursor: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
      });

      // Extract paging from the array augmentation
      const page = result as AdCreativeMappingResult[] & {
        paging?: { cursors?: { after?: string }; next?: string };
      };
      const nextCursor = page.paging?.cursors?.after ?? null;
      return {
        ok: true,
        provider: 'meta',
        data: page,
        meta: {
          nextCursor,
          ...partialPageWarningMeta(page.length, limit, nextCursor, Boolean(page.paging?.next)),
        },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async getAdDestinations(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdDestinationResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'accountId is required to fetch ad destinations',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const adIds = Array.isArray(request.params.adIds)
        ? request.params.adIds.map(String)
        : undefined;
      const effectiveStatus = Array.isArray(request.params.effectiveStatus)
        ? request.params.effectiveStatus.map(String)
        : undefined;
      const campaignId = parseIdParam(request.params.campaignId);
      const adSetId = parseIdParam(request.params.adSetId ?? request.params.adsetId);
      const explicitFilters = parseExplicitMetaFilters(request.params.filtering);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : 100;

      const result = await getAdDestinations(client, {
        adAccountId: accountId,
        effectiveStatus,
        adIds,
        campaignId,
        adSetId,
        explicitFilters: explicitFilters.length > 0 ? explicitFilters : undefined,
        limit,
        cursor: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
      });

      const page = result as AdDestinationResult[] & {
        paging?: { cursors?: { after?: string }; next?: string };
        statusFilter?: { applied: string[]; defaulted: boolean };
      };
      const nextCursor = page.paging?.cursors?.after ?? null;
      // An empty page under the silent ACTIVE default reads exactly like "this
      // campaign has no ads". Say which one it is.
      const emptyDueToStatusFilter =
        page.length === 0 && page.statusFilter?.defaulted === true
          ? {
              warnings: [
                {
                  code: 'EMPTY_DUE_TO_STATUS_FILTER',
                  message:
                    `Tidak ada baris yang cocok, tetapi filter effective_status default ['ACTIVE'] sedang aktif. ` +
                    `Hasil kosong di sini BUKAN berarti tidak ada ad — ad berstatus PENDING_REVIEW, IN_PROCESS, ` +
                    `PAUSED, atau DISAPPROVED tersaring. Kirim effectiveStatus secara eksplisit untuk melihatnya.`,
                  severity: 'info' as const,
                },
              ],
            }
          : {};
      return {
        ok: true,
        provider: 'meta',
        data: page,
        meta: {
          nextCursor,
          statusFilter: page.statusFilter,
          ...partialPageWarningMeta(page.length, limit, nextCursor, Boolean(page.paging?.next)),
          ...emptyDueToStatusFilter,
        },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async readAdCreativeFull(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdCreativeFullResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const creativeId =
      typeof request.params.creativeId === 'string' ? request.params.creativeId : undefined;
    if (!creativeId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_CREATIVE_ID',
            message: 'creativeId is required to read ad creative full details',
          },
        ],
      };
    }

    try {
      assertKnownParams(request.params, READ_CREATIVE_FULL_PARAMS, READ_CREATIVE_FULL_PARAM_HINTS);
    } catch (error) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'UNKNOWN_PARAM',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const rawCreative = await readAdCreativeFullTool(client, { creativeId });

      // Determine which fields were retrieved vs missing
      const allRequestedFields = AD_CREATIVE_FULL_FIELDS;

      const fieldsRetrieved = allRequestedFields.filter((f) => rawCreative[f] !== undefined);
      const fieldsMissing = allRequestedFields.filter((f) => rawCreative[f] === undefined);

      const result: AdCreativeFullResult = {
        operation: 'read_ad_creative_full',
        status: 'executed',
        creative_id: creativeId,
        creative: rawCreative,
        fields_retrieved: fieldsRetrieved,
        fields_missing: fieldsMissing,
      };

      return { ok: true, provider: 'meta', data: result };
    } catch (error) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'CREATIVE_READ_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async readAdSetFull(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdSetFullResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adsetId = typeof request.params.adsetId === 'string' ? request.params.adsetId : undefined;
    const campaignId =
      typeof request.params.campaignId === 'string' ? request.params.campaignId : undefined;
    const accountId = request.accountId ?? context.credential.accountId;
    const warnings: string[] = [];

    if (!adsetId && !campaignId && !accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ADSET_TARGET',
            message:
              'Provide adsetId (single ad set), campaignId (ad sets in a campaign), or accountId (ad sets in an account).',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);

      // Single mode wins if adsetId present.
      if (adsetId) {
        if (campaignId) {
          warnings.push('campaignId ignored because adsetId was provided.');
        }
        const raw = await readAdSetFullTool(client, { adsetId });
        const fieldsRetrieved = ADSET_FULL_FIELDS.filter((f) => raw[f] !== undefined);
        const fieldsMissing = ADSET_FULL_FIELDS.filter((f) => raw[f] === undefined);

        return {
          ok: true,
          provider: 'meta',
          data: {
            operation: 'read_adset_full',
            status: 'executed',
            mode: 'single',
            adset_id: adsetId,
            adset: raw,
            fields_retrieved: fieldsRetrieved,
            fields_missing: fieldsMissing,
            warnings: warnings.length > 0 ? warnings : undefined,
          },
        };
      }

      // List mode: campaign scope preferred, else account scope.
      const limit = typeof request.params.limit === 'number' ? request.params.limit : 25;
      const cursor = typeof request.params.cursor === 'string' ? request.params.cursor : undefined;

      const list = await listAdSetsFullTool(client, {
        campaignId,
        accountId: campaignId ? undefined : accountId,
        limit,
        cursor,
      });

      if (list.droppedFields) {
        warnings.push(
          'Some ad set fields were dropped because Meta rejected the full field set; core fields returned.'
        );
      }

      return {
        ok: true,
        provider: 'meta',
        data: {
          operation: 'read_adset_full',
          status: 'executed',
          mode: 'list',
          adsets: list.adsets,
          next_cursor: list.nextCursor,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'ADSET_READ_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async getAccountInfo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AccountInfoResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          { provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'Meta account ID is required' },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await getAccountInfo(client, { adAccountId });
      return { ok: true, provider: 'meta', data: result };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listAdImages(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdImageResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'Meta account ID is required to list ad images',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.listAdImages(client, { adAccountId });
      return { ok: true, provider: 'meta', data: result };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listAdVideos(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdVideoResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'Meta account ID is required to list ad videos',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.listAdVideos(client, {
        adAccountId,
        limit: typeof request.params.limit === 'number' ? request.params.limit : undefined,
        cursor: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
      });
      return { ok: true, provider: 'meta', data: result };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async getAdPreview(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdPreviewResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const creativeId =
      typeof request.params.creativeId === 'string' ? request.params.creativeId : undefined;
    const adFormat =
      typeof request.params.adFormat === 'string' ? request.params.adFormat : undefined;

    if (!creativeId || !adFormat) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'Meta ad preview requires creativeId and adFormat in request.params',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const result = await this.tools.getAdPreview(client, { creativeId, adFormat });
      return { ok: true, provider: 'meta', data: result };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async checkLaunchReadiness(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<LaunchReadinessResult>> {
    try {
      const result = checkLaunchReadinessTool({
        workflow: optionalPlainString(request.params.workflow),
        objective: optionalPlainString(request.params.objective) as MetaOdaxObjective | undefined,
        conversionLocation: optionalPlainString(request.params.conversionLocation) as
          | MetaConversionLocation
          | undefined,
        optimizationGoal: optionalPlainString(request.params.optimizationGoal),
        creativeFormat: optionalPlainString(request.params.creativeFormat) as
          | MetaCreativeFormat
          | undefined,
        apiVersion: optionalPlainString(request.params.apiVersion),
        messagingDestination: optionalPlainString(request.params.messagingDestination) as
          | MetaMessagingDestination
          | undefined,
        productOrOffer: optionalPlainString(request.params.productOrOffer),
        pageId: optionalPlainString(request.params.pageId),
        pixelId: optionalPlainString(request.params.pixelId),
        destinationUrl: optionalPlainString(request.params.destinationUrl),
        dailyBudget:
          typeof request.params.dailyBudget === 'number' ? request.params.dailyBudget : undefined,
        countries: Array.isArray(request.params.countries)
          ? request.params.countries.filter((item): item is string => typeof item === 'string')
          : undefined,
        primaryText: optionalPlainString(request.params.primaryText),
        headline: optionalPlainString(request.params.headline),
        imageHash: optionalPlainString(request.params.imageHash),
        videoId: optionalPlainString(request.params.videoId),
        imageFilePath: optionalPlainString(request.params.imageFilePath),
        videoFilePath: optionalPlainString(request.params.videoFilePath),
        creativeId: optionalPlainString(request.params.creativeId),
        existingPostId: optionalPlainString(request.params.existingPostId),
        partnershipAdCode: optionalPlainString(request.params.partnershipAdCode),
        sourceAdId: optionalPlainString(request.params.sourceAdId),
        whatsappPhoneNumber: optionalPlainString(request.params.whatsappPhoneNumber),
        whatsappPhoneNumberId: optionalPlainString(request.params.whatsappPhoneNumberId),
        productSetId: optionalPlainString(request.params.productSetId),
        catalogId: optionalPlainString(request.params.catalogId),
        businessId: optionalPlainString(request.params.businessId),
        leadFormId: optionalPlainString(request.params.leadFormId),
        applicationId: optionalPlainString(request.params.applicationId),
        objectStoreUrl: optionalPlainString(request.params.objectStoreUrl),
        appDeepLinkUrl: optionalPlainString(request.params.appDeepLinkUrl),
        specialAdCategories: Array.isArray(request.params.specialAdCategories)
          ? request.params.specialAdCategories.filter(
              (item): item is string => typeof item === 'string'
            )
          : undefined,
        writesEnabled: request.params.writesEnabled === true,
      });
      return { ok: true, provider: 'meta', data: result };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listPixels(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaPixelResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'Meta account ID is required to list pixels',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const pixels = await this.tools.listPixels(client, { adAccountId, limit });
      return { ok: true, provider: 'meta', data: pixels };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listAudiences(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaAudienceResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_ACCOUNT_ID',
            message: 'Meta account ID is required to list audiences',
          },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const audiences = await this.tools.listAudiences(client, { adAccountId, limit });
      return { ok: true, provider: 'meta', data: audiences };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listCatalogs(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaCatalogResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const businessId = optionalPlainString(request.params.businessId);
    if (!businessId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          { provider: 'meta', code: 'MISSING_BUSINESS_ID', message: 'businessId is required' },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const catalogs = await this.tools.listCatalogs(client, { businessId, limit });
      return { ok: true, provider: 'meta', data: catalogs };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listProductSets(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<MetaProductSetResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const catalogId = optionalPlainString(request.params.catalogId);
    if (!catalogId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          { provider: 'meta', code: 'MISSING_CATALOG_ID', message: 'catalogId is required' },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const productSets = await this.tools.listProductSets(client, { catalogId, limit });
      return { ok: true, provider: 'meta', data: productSets };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listInstagramAccounts(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<InstagramAccountResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;
    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const accounts = await this.tools.listInstagramAccounts(client, { limit });
      return { ok: true, provider: 'meta', data: accounts };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listInstagramMedia(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<InstagramMediaResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const igUserId = optionalPlainString(request.params.igUserId);
    if (!igUserId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [{ provider: 'meta', code: 'MISSING_IG_USER_ID', message: 'igUserId is required' }],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const cursor = typeof request.params.cursor === 'string' ? request.params.cursor : undefined;
      const permalinkUrls = Array.isArray(request.params.permalinkUrls)
        ? request.params.permalinkUrls.filter((url): url is string => typeof url === 'string')
        : undefined;
      const media = await this.tools.listInstagramMedia(client, {
        igUserId,
        limit,
        cursor,
        permalinkUrls,
      });
      return { ok: true, provider: 'meta', data: media };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listPartnershipContent(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<PartnershipContentResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const businessId = optionalPlainString(request.params.businessId);
    if (!businessId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          { provider: 'meta', code: 'MISSING_BUSINESS_ID', message: 'businessId is required' },
        ],
      };
    }

    try {
      const client = this.createClient(context.credential);
      // Entri non-string ditolak, bukan disaring diam-diam: ad code yang hilang
      // tanpa kabar membuat hasil discovery tampak lengkap padahal tidak.
      const adCodes = optionalStringArray(request.params.adCodes, 'adCodes');
      const content = await this.tools.listPartnershipContent(client, {
        businessId,
        fbPageId: optionalPlainString(request.params.fbPageId),
        igUserId: optionalPlainString(request.params.igUserId),
        creatorUsername: optionalPlainString(request.params.creatorUsername),
        adCodes,
        platform: optionalPlainString(request.params.platform),
        mediaType: optionalPlainString(request.params.mediaType),
        postType: optionalPlainString(request.params.postType),
        limit: typeof request.params.limit === 'number' ? request.params.limit : undefined,
        cursor: optionalPlainString(request.params.cursor),
      });
      return { ok: true, provider: 'meta', data: content };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listThreadsProfiles(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<ThreadsProfileResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;
    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const { profiles, warnings } = await this.tools.listThreadsProfiles(client, { limit });
      return {
        ok: true,
        provider: 'meta',
        data: profiles,
        ...(warnings.length > 0 ? { meta: { warnings } } : {}),
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listWhatsAppAccounts(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<WhatsAppAccountResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;
    try {
      const client = this.createClient(context.credential);
      const businessId =
        typeof request.params.businessId === 'string' ? request.params.businessId : undefined;
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const accounts = await this.tools.listWhatsAppAccounts(client, { businessId, limit });
      return { ok: true, provider: 'meta', data: accounts };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listWhatsAppPhoneNumbers(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<WhatsAppPhoneNumberResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;
    try {
      const client = this.createClient(context.credential);
      const wabaId = typeof request.params.wabaId === 'string' ? request.params.wabaId : '';
      if (!wabaId)
        return { ok: false, errors: [{ code: 'MISSING_WABA_ID', message: 'wabaId is required' }] };
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const numbers = await this.tools.listWhatsAppPhoneNumbers(client, { wabaId, limit });
      return { ok: true, provider: 'meta', data: numbers };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listWhatsAppMessageTemplates(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<WhatsAppTemplateResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;
    try {
      const client = this.createClient(context.credential);
      const wabaId = typeof request.params.wabaId === 'string' ? request.params.wabaId : '';
      if (!wabaId)
        return { ok: false, errors: [{ code: 'MISSING_WABA_ID', message: 'wabaId is required' }] };
      const name = typeof request.params.name === 'string' ? request.params.name : undefined;
      const status = typeof request.params.status === 'string' ? request.params.status : undefined;
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const templates = await this.tools.listWhatsAppMessageTemplates(client, {
        wabaId,
        name,
        status,
        limit,
      });
      return { ok: true, provider: 'meta', data: templates };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listPages(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaPageResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    try {
      const client = this.createClient(context.credential);
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const pages = await this.tools.listPages(client, { limit });
      return {
        ok: true,
        provider: 'meta',
        data: pages.map((page) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          tasks: page.tasks,
          can_advertise: page.tasks?.some((task) =>
            ['ADVERTISE', 'CREATE_ADS', 'MANAGE'].includes(task)
          ),
        })),
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listLeadForms(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaLeadFormResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const pageId = optionalPlainString(request.params.pageId);
    if (!pageId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [
          {
            provider: 'meta',
            code: 'MISSING_PAGE_ID',
            message: 'pageId is required to list Instant Forms',
          },
        ],
      };
    }

    try {
      const status = Array.isArray(request.params.status)
        ? request.params.status.filter((value): value is string => typeof value === 'string')
        : undefined;
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const forms = await this.tools.listLeadForms(this.createClient(context.credential), {
        pageId,
        status,
        limit,
      });
      return { ok: true, provider: 'meta', data: forms };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private getEcommerceCampaignBundlePayload(
    request: AdsBrokerRequest,
    credential: CredentialContext
  ):
    | { ok: true; payload: MetaEcommerceCampaignBundlePayload }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const params = request.params as Partial<EcommerceCampaignBundlePayload>;
    const adAccountId = request.accountId ?? credential.accountId;

    if (!adAccountId) {
      return {
        ok: false,
        response: {
          ok: false,
          provider: 'meta',
          errors: [
            { provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required' },
          ],
        },
      };
    }

    return {
      ok: true,
      payload: {
        adAccountId,
        campaignName: String(params.campaignName ?? ''),
        adSetName: String(params.adSetName ?? ''),
        adName: String(params.adName ?? ''),
        pageId: String(params.pageId ?? ''),
        pixelId: String(params.pixelId ?? ''),
        destinationUrl: String(params.destinationUrl ?? ''),
        dailyBudget: Number(params.dailyBudget),
        currency: typeof params.currency === 'string' ? params.currency : undefined,
        countries: Array.isArray(params.countries)
          ? params.countries.filter((country): country is string => typeof country === 'string')
          : [],
        primaryText: String(params.primaryText ?? ''),
        headline: String(params.headline ?? ''),
        description: typeof params.description === 'string' ? params.description : undefined,
        imageHash: typeof params.imageHash === 'string' ? params.imageHash : undefined,
        videoId: typeof params.videoId === 'string' ? params.videoId : undefined,
        callToActionType: params.callToActionType,
        specialAdCategories: Array.isArray(params.specialAdCategories)
          ? params.specialAdCategories.filter(
              (category): category is string => typeof category === 'string'
            )
          : undefined,
        ageMin: typeof params.ageMin === 'number' ? params.ageMin : undefined,
        ageMax: typeof params.ageMax === 'number' ? params.ageMax : undefined,
        publisherPlatforms: Array.isArray(params.publisherPlatforms)
          ? params.publisherPlatforms.filter(
              (platform): platform is string => typeof platform === 'string'
            )
          : undefined,
        instagramUserId:
          typeof params.instagramUserId === 'string' ? params.instagramUserId : undefined,
        threadsProfileId:
          typeof params.threadsProfileId === 'string' ? params.threadsProfileId : undefined,
      },
    };
  }

  private getCpasCatalogCampaignBundlePayload(
    request: AdsBrokerRequest,
    credential: CredentialContext
  ):
    | { ok: true; payload: MetaCpasCatalogCampaignBundlePayload }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const nestedParams =
      request.params.params &&
      typeof request.params.params === 'object' &&
      !Array.isArray(request.params.params)
        ? request.params.params
        : {};
    const params = {
      ...request.params,
      ...nestedParams,
    } as Partial<MetaCpasCatalogCampaignBundlePayload>;
    const adAccountId = request.accountId ?? credential.accountId;
    if (!adAccountId) {
      return {
        ok: false,
        response: {
          ok: false,
          provider: 'meta',
          errors: [
            { provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required' },
          ],
        },
      };
    }
    return {
      ok: true,
      payload: {
        adAccountId,
        campaignName: String(params.campaignName ?? ''),
        adSetName: String(params.adSetName ?? ''),
        adName: String(params.adName ?? ''),
        pageId: String(params.pageId ?? ''),
        productSetId: String(params.productSetId ?? ''),
        pixelId: typeof params.pixelId === 'string' ? params.pixelId : undefined,
        destinationMode:
          params.destinationMode === 'app_omnichannel' ? 'app_omnichannel' : 'catalog_web',
        collaborativeAppSpec: parseCollaborativeAppSpec(params.collaborativeAppSpec),
        objectStoreUrls: Array.isArray(params.objectStoreUrls)
          ? params.objectStoreUrls.filter((url): url is string => typeof url === 'string')
          : [],
        customEventType: params.customEventType,
        dailyBudget: Number(params.dailyBudget),
        countries: Array.isArray(params.countries)
          ? params.countries.filter((country): country is string => typeof country === 'string')
          : [],
        primaryText: String(params.primaryText ?? ''),
        headline: String(params.headline ?? ''),
        description: typeof params.description === 'string' ? params.description : undefined,
        creativeFormat:
          params.creativeFormat === 'collection' ||
          params.creativeFormat === 'catalog_single_image' ||
          params.creativeFormat === 'catalog_carousel' ||
          params.creativeFormat === 'catalog_video' ||
          params.creativeFormat === 'catalog_video_carousel'
            ? params.creativeFormat
            : 'catalog',
        collection:
          params.collection &&
          typeof params.collection === 'object' &&
          !Array.isArray(params.collection)
            ? {
                instantExperienceId:
                  typeof params.collection.instantExperienceId === 'string'
                    ? params.collection.instantExperienceId
                    : '',
                coverImageHash:
                  typeof params.collection.coverImageHash === 'string'
                    ? params.collection.coverImageHash
                    : undefined,
                coverVideoId:
                  typeof params.collection.coverVideoId === 'string'
                    ? params.collection.coverVideoId
                    : undefined,
              }
            : undefined,
        video:
          params.video && typeof params.video === 'object' && !Array.isArray(params.video)
            ? {
                videoId: typeof params.video.videoId === 'string' ? params.video.videoId : '',
                instantExperienceId:
                  typeof params.video.instantExperienceId === 'string'
                    ? params.video.instantExperienceId
                    : '',
                retailerAppId:
                  typeof params.video.retailerAppId === 'string' ? params.video.retailerAppId : '',
                retailerItemIds: Array.isArray(params.video.retailerItemIds)
                  ? params.video.retailerItemIds.filter(
                      (item): item is string => typeof item === 'string'
                    )
                  : undefined,
                thumbnailImageHash:
                  typeof params.video.thumbnailImageHash === 'string'
                    ? params.video.thumbnailImageHash
                    : undefined,
                thumbnailImageUrl:
                  typeof params.video.thumbnailImageUrl === 'string'
                    ? params.video.thumbnailImageUrl
                    : undefined,
              }
            : undefined,
        hybridVideo:
          params.hybridVideo &&
          typeof params.hybridVideo === 'object' &&
          !Array.isArray(params.hybridVideo)
            ? {
                videoId:
                  typeof params.hybridVideo.videoId === 'string' ? params.hybridVideo.videoId : '',
                thumbnailUrl:
                  typeof params.hybridVideo.thumbnailUrl === 'string'
                    ? params.hybridVideo.thumbnailUrl
                    : '',
              }
            : undefined,
        destinationUrl: String(params.destinationUrl ?? ''),
        templateUrl: typeof params.templateUrl === 'string' ? params.templateUrl : undefined,
        fallbackImageHash:
          typeof params.fallbackImageHash === 'string' ? params.fallbackImageHash : undefined,
        callToAction: params.callToAction,
        ageMin: typeof params.ageMin === 'number' ? params.ageMin : undefined,
        ageMax: typeof params.ageMax === 'number' ? params.ageMax : undefined,
        publisherPlatforms: Array.isArray(params.publisherPlatforms)
          ? params.publisherPlatforms.filter((value): value is string => typeof value === 'string')
          : undefined,
        instagramUserId:
          typeof params.instagramUserId === 'string' ? params.instagramUserId : undefined,
        threadsProfileId:
          typeof params.threadsProfileId === 'string' ? params.threadsProfileId : undefined,
      },
    };
  }

  private getEntityId(request: AdsBrokerRequest): string | undefined {
    return typeof request.params.campaignId === 'string' ? request.params.campaignId : undefined;
  }

  private parseAdSetTargeting(request: AdsBrokerRequest): Record<string, unknown> | undefined {
    const geoLocations = request.params.geoLocations;
    const ageMin = typeof request.params.ageMin === 'number' ? request.params.ageMin : undefined;
    const ageMax = typeof request.params.ageMax === 'number' ? request.params.ageMax : undefined;
    const ageRange =
      Array.isArray(request.params.ageRange) &&
      request.params.ageRange.length === 2 &&
      request.params.ageRange.every((n): n is number => typeof n === 'number')
        ? ([request.params.ageRange[0], request.params.ageRange[1]] as [number, number])
        : undefined;
    const publisherPlatforms = request.params.publisherPlatforms;
    const interests = request.params.interests;
    const behaviors = request.params.behaviors;
    const workEmployers = request.params.workEmployers;
    const workPositions = request.params.workPositions;
    const genders = request.params.genders;
    const metaTargetingOverride =
      typeof request.params.targeting === 'object' && request.params.targeting !== null
        ? (request.params.targeting as Record<string, unknown>)
        : undefined;
    const advantageAudience =
      typeof request.params.advantageAudience === 'number'
        ? request.params.advantageAudience
        : undefined;
    const targetingAutomation = request.params.targetingAutomation;
    const customAudiences = request.params.customAudiences;
    const excludedCustomAudiences = request.params.excludedCustomAudiences;
    const facebookPositions = request.params.facebookPositions;
    const instagramPositions = request.params.instagramPositions;
    const threadsPositions = request.params.threadsPositions;
    const messengerPositions = request.params.messengerPositions;
    const marketplacePositions = request.params.marketplacePositions;
    const devicePlatforms = request.params.devicePlatforms;

    if (
      !geoLocations &&
      ageMin === undefined &&
      ageMax === undefined &&
      ageRange === undefined &&
      !publisherPlatforms &&
      !interests &&
      !behaviors &&
      !workEmployers &&
      !workPositions &&
      !genders &&
      !metaTargetingOverride &&
      advantageAudience === undefined &&
      !targetingAutomation &&
      !customAudiences &&
      !excludedCustomAudiences &&
      !facebookPositions &&
      !instagramPositions &&
      !threadsPositions &&
      !messengerPositions &&
      !marketplacePositions &&
      !devicePlatforms
    ) {
      return undefined;
    }

    const targeting: Record<string, unknown> = {};
    if (geoLocations && typeof geoLocations === 'object') targeting.geoLocations = geoLocations;
    if (ageMin !== undefined) targeting.ageMin = ageMin;
    if (ageMax !== undefined) targeting.ageMax = ageMax;
    if (ageRange !== undefined) targeting.ageRange = ageRange;
    if (Array.isArray(publisherPlatforms)) targeting.publisherPlatforms = publisherPlatforms;
    if (Array.isArray(interests)) targeting.interests = interests;
    if (Array.isArray(genders)) targeting.genders = genders;
    if (Array.isArray(customAudiences)) targeting.customAudiences = customAudiences;
    if (Array.isArray(excludedCustomAudiences))
      targeting.excludedCustomAudiences = excludedCustomAudiences;
    if (Array.isArray(facebookPositions)) targeting.facebookPositions = facebookPositions;
    if (Array.isArray(instagramPositions)) targeting.instagramPositions = instagramPositions;
    if (Array.isArray(threadsPositions)) targeting.threadsPositions = threadsPositions;
    if (Array.isArray(messengerPositions)) targeting.messengerPositions = messengerPositions;
    if (Array.isArray(marketplacePositions)) targeting.marketplacePositions = marketplacePositions;
    if (Array.isArray(devicePlatforms)) targeting.devicePlatforms = devicePlatforms;
    if (targetingAutomation && typeof targetingAutomation === 'object') {
      targeting.targetingAutomation = targetingAutomation as Record<string, unknown>;
    } else if (advantageAudience !== undefined) {
      targeting.targetingAutomation = { advantage_audience: advantageAudience };
    }

    // behaviors/work_employers/work_positions are only valid inside flexible_spec
    // (unlike interests, which Meta also accepts as a top-level shorthand field).
    // Grouped into one entry so they're OR'd with each other and AND'd against interests.
    const flexibleSpecGroup: Record<string, unknown> = {};
    if (Array.isArray(behaviors)) flexibleSpecGroup.behaviors = behaviors;
    if (Array.isArray(workEmployers)) flexibleSpecGroup.work_employers = workEmployers;
    if (Array.isArray(workPositions)) flexibleSpecGroup.work_positions = workPositions;
    if (Object.keys(flexibleSpecGroup).length > 0) {
      targeting.flexibleSpec = [flexibleSpecGroup];
    }

    if (metaTargetingOverride) targeting.metaTargetingOverride = metaTargetingOverride;

    return targeting;
  }

  private toAdsMutationResult(result: MutationResult): AdsMutationResult {
    return {
      success: result.success,
      id: result.id,
      operation: result.operation,
      response: result.response,
      error: result.error,
    };
  }

  private writeErrorResponse(error: unknown): AdsBrokerResponse<never> {
    const message = redactErrorMessage(error instanceof Error ? error.message : String(error));
    const details =
      error instanceof MetaApiError
        ? {
            metaCode: error.code,
            metaType: error.type,
            metaSubcode: error.subcode,
            fbtraceId: error.fbtraceId,
          }
        : undefined;

    return {
      ok: false,
      provider: 'meta',
      errors: [
        {
          provider: 'meta',
          code: 'META_WRITE_ERROR',
          message,
          details,
        },
      ],
    };
  }
}

// Top-level params that only apply to the legacy (no creativeFormat/creativeSpec)
// linkData path in createAdCreative. When creativeFormat+creativeSpec are used
// instead, these are silently ignored rather than merged — flag the ambiguity
// instead of letting the caller assume they were applied.
const LEGACY_CREATIVE_FIELDS = [
  'link',
  'message',
  'headline',
  'description',
  'imageHash',
  'videoId',
  'callToActionType',
  // buildCreativePayload only consults these inside its linkData branch, so with
  // creativeFormat + creativeSpec they would apply to nothing.
  'destinationType',
  'pageWelcomeMessage',
] as const;

// Every param ads_create_adcreative accepts, across both tool surfaces (the Zod
// schema in mcp/createServer.ts and the JSON Schema in broker/mcpTools.ts).
// Anything else is rejected rather than dropped — see assertKnownParams.
export const CREATE_AD_CREATIVE_PARAMS = new Set([
  'name',
  'pageId',
  'mode',
  'objective',
  'conversionLocation',
  'messagingDestination',
  'creativeFormat',
  'creativeSpec',
  'collaborativeProductSetId',
  'collaborativeAppSpec',
  'standardAppSpec',
  'partnership',
  'link',
  'message',
  'headline',
  'description',
  'imageHash',
  'videoId',
  'callToActionType',
  'urlTags',
  'welcomeMessageTemplateName',
  'instagramUserId',
  'threadsProfileId',
  'destinationType',
  'pageWelcomeMessage',
  'whatsappWelcomeMessageSequenceId',
  'objectStorySpec',
  'assetFeedSpec',
  'dedupeByName',
  'externalReference',
  'optOutEnhancements',
  'dryRun',
  'confirmed',
]);

// Hints live with the shared contract in broker/toolParamContract.ts so this
// guard and the broker-layer one name the same typed field for the same key.
const CREATE_AD_CREATIVE_PARAM_HINTS: Record<string, string> =
  TOOL_PARAM_HINTS.ads_create_adcreative ?? {};

/**
 * params is not a raw Graph API passthrough — the adapter reads a fixed set of
 * typed fields and would otherwise ignore the rest without a word, so a caller
 * sees a clean dry-run preview that is missing exactly the field they cared
 * about. Reject unknown keys instead, naming the typed field where one exists.
 */
function assertKnownParams(
  params: Record<string, unknown>,
  allowed: Set<string>,
  hints: Record<string, string>
): void {
  const unknown = findUnknownParamKeys(params, allowed);
  if (unknown.length === 0) return;

  throw new Error(formatUnknownParamsMessage(unknown, hints));
}

// Read tools accept the shared envelope plus their own id. Everything else was
// previously swallowed, so params.fields looked like a field-selection override
// and quietly did nothing at all.
export const READ_CREATIVE_FULL_PARAMS = new Set([
  'provider',
  'providers',
  'accountId',
  'since',
  'until',
  'creativeId',
]);

const READ_CREATIVE_FULL_PARAM_HINTS: Record<string, string> =
  TOOL_PARAM_HINTS.ads_read_creative_full ?? {};

/**
 * attribution_spec override for a clone. Accepts Meta's own array shape; null and []
 * both mean "drop the source's attribution_spec". The raw `attribution_spec` spelling
 * is named explicitly rather than accepted, so a caller who reaches for it learns the
 * right key instead of watching their override disappear.
 */
function parseAttributionSpec(value: unknown): Array<Record<string, unknown>> | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error(
      'attributionSpec harus berupa array attribution_spec Meta, mis. [{ event_type: "CLICK_THROUGH", window_days: 1 }], atau null untuk membuang attribution_spec bawaan sumber.'
    );
  }
  return value.map((entry, index) => requireRecord(entry, `attributionSpec[${index}]`));
}

function parseIdParam(value: unknown): string | string[] | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return undefined;
}

function parseStringArrayParam(value: unknown): string[] | undefined {
  if (typeof value === 'string' && value.trim()) return [value];
  if (Array.isArray(value)) {
    const values = value.filter(
      (item): item is string => typeof item === 'string' && Boolean(item.trim())
    );
    return values.length ? values : undefined;
  }
  return undefined;
}

function parsePositiveIntegerParam(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * Meta's Graph API may return fewer rows than the requested `limit` for
 * reasons outside this client's control — most commonly an internal query
 * complexity budget for endpoints requesting deeply nested fields (e.g.
 * object_story_spec/asset_feed_spec on every ad). This is easy to mistake
 * for "the tool ignored my limit". Surface it explicitly whenever the page
 * came back short of the request AND Meta says there's more (a nextCursor),
 * so callers reach for pagination instead of assuming the row count is final.
 */
export function partialPageWarningMeta(
  rowCount: number,
  requestedLimit: number | undefined,
  nextCursor: string | null,
  hasNextPage: boolean
): { warnings?: Array<{ code: string; message: string; severity: 'info' }> } {
  // `cursors.after` is NOT a "more data" signal — Meta populates it on
  // exhausted edges too, which made this warning fire on nearly every call and
  // trained callers to ignore it. `paging.next` is the real signal.
  if (
    typeof requestedLimit !== 'number' ||
    rowCount >= requestedLimit ||
    nextCursor === null ||
    !hasNextPage
  ) {
    return {};
  }
  return {
    warnings: [
      {
        code: 'PARTIAL_PAGE',
        message: `Meta returned ${rowCount} row(s), fewer than the requested limit of ${requestedLimit}, but more data is available (paging.next is set). This is usually Meta's own query-complexity budget for heavily nested fields, not a client-side cap — pass cursor to fetch the next page instead of assuming this is the full result set.`,
        severity: 'info',
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMultiMediaAdOptions(
  value: unknown
): value is import('../../tools/createAd.js').MetaMultiMediaAdOptions {
  if (!isRecord(value) || !Array.isArray(value.images)) return false;
  return (
    typeof value.pageId === 'string' &&
    typeof value.destinationUrl === 'string' &&
    typeof value.primaryImageHash === 'string' &&
    typeof value.callToAction === 'string'
  );
}

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

const META_ACTIVITY_FIELDS =
  'event_time,event_type,translated_event_type,object_id,object_name,object_type,actor_id,actor_name,application_id,application_name,extra_data';

/**
 * Account pages scanned when filtering by an object Meta cannot filter on. Measured against
 * the live API, large pages are far cheaper per row than small ones (500 rows in ~3.8s versus
 * ~10s for five 100-row pages), so the scan uses big pages and few of them: the default keeps
 * one tool call near seven seconds, and the caller goes deeper with maxScanPages or the cursor.
 */
export const CHANGE_HISTORY_DEFAULT_SCAN_PAGES = 2;
export const CHANGE_HISTORY_MAX_SCAN_PAGES = 25;
const CHANGE_HISTORY_SCAN_PAGE_SIZE = 500;

function resolveScanPageBudget(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return CHANGE_HISTORY_DEFAULT_SCAN_PAGES;
  return Math.min(Math.max(Math.trunc(value), 1), CHANGE_HISTORY_MAX_SCAN_PAGES);
}

interface MetaActivityPage {
  activities: MetaActivityRecord[];
  nextCursor: string | null;
  /** Set only when the account feed was scanned and filtered locally. */
  scannedPages?: number;
  scanIncomplete?: boolean;
}

async function fetchActivityPage(
  client: MetaClient,
  path: string,
  params: Record<string, unknown>
): Promise<MetaActivityPage & { hasNextPage: boolean }> {
  const response = await client.metaGet<{
    data: MetaActivityRecord[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(path, params);

  const after = response.paging?.cursors?.after ?? null;
  return {
    activities: response.data ?? [],
    nextCursor: after,
    hasNextPage: Boolean(response.paging?.next) && after !== null,
  };
}

/** True for Meta's "nonexisting field (activities)" rejection on nodes without that edge. */
function isMissingActivitiesEdgeError(error: unknown): boolean {
  return (
    error instanceof MetaApiError &&
    error.code === 100 &&
    /nonexisting field \(activities\)/i.test(error.message)
  );
}

/**
 * Ad sets expose /{id}/activities, which filters server side. Every other object type
 * rejects the edge, and that rejection is the signal to fall back to an account scan.
 */
async function fetchObjectActivities(
  client: MetaClient,
  objectId: string,
  params: Record<string, unknown>
): Promise<MetaActivityPage | undefined> {
  try {
    return await fetchActivityPage(client, `/${objectId}/activities`, params);
  } catch (error) {
    if (isMissingActivitiesEdgeError(error)) return undefined;
    throw error;
  }
}

async function scanAccountActivities(
  client: MetaClient,
  accountPath: string,
  filters: Record<string, unknown>,
  options: { objectId: string; limit: number; cursor?: string; maxScanPages: number }
): Promise<MetaActivityPage> {
  const matches: MetaActivityRecord[] = [];
  let after = options.cursor;
  let scannedPages = 0;
  let hasNextPage = false;

  while (scannedPages < options.maxScanPages && matches.length < options.limit) {
    const page = await fetchActivityPage(client, accountPath, {
      ...filters,
      limit: CHANGE_HISTORY_SCAN_PAGE_SIZE,
      after,
    });
    scannedPages += 1;
    matches.push(...page.activities.filter((activity) => activity.object_id === options.objectId));
    after = page.nextCursor ?? undefined;
    hasNextPage = page.hasNextPage;
    if (!hasNextPage) break;
  }

  return {
    activities: matches.slice(0, options.limit),
    nextCursor: hasNextPage ? (after ?? null) : null,
    scannedPages,
    scanIncomplete: hasNextPage && matches.length < options.limit,
  };
}

/** Meta activity categories accepted by the /activities edge (documented enum). */
export const META_ACTIVITY_CATEGORIES = [
  'ACCOUNT',
  'AD',
  'AD_KEYWORDS',
  'AD_SET',
  'AUDIENCE',
  'BID',
  'BUDGET',
  'CAMPAIGN',
  'DATE',
  'STATUS',
  'TARGETING',
] as const;

function normalizeMetaActivityCategory(value: unknown): string | undefined {
  const category = optionalTrimmedString(value)?.toUpperCase();
  if (!category) return undefined;
  return (META_ACTIVITY_CATEGORIES as readonly string[]).includes(category) ? category : undefined;
}

/**
 * Meta returns `extra_data` as a JSON-encoded string. Two shapes occur in practice:
 * a flat `{ old_value, new_value }` describing the event itself, and a nested
 * `{ field: { old_value, new_value } }` map. Both are normalized to change rows.
 */
function normalizeMetaActivityChanges(
  extraData: unknown,
  eventType?: string
): Array<{ field: string; oldValue?: unknown; newValue?: unknown }> | undefined {
  const parsed = typeof extraData === 'string' ? safeJsonParse(extraData) : extraData;
  if (!isRecord(parsed)) return undefined;

  if (parsed.old_value !== undefined || parsed.new_value !== undefined) {
    return [
      { field: eventType ?? 'value', oldValue: parsed.old_value, newValue: parsed.new_value },
    ];
  }

  const changes = Object.entries(parsed).flatMap(([field, value]) => {
    if (!isRecord(value)) return [];
    if (value.old_value === undefined && value.new_value === undefined) return [];
    return [{ field, oldValue: value.old_value, newValue: value.new_value }];
  });

  return changes.length > 0 ? changes : undefined;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function assetFeedSpecCreateBlockError(request: {
  assetFeedSpec?: unknown;
  objectStorySpec?: unknown;
}): Error | undefined {
  if (request.assetFeedSpec !== undefined) {
    const error = assetFeedSpecCreateError(request.assetFeedSpec);
    if (error) return error;
  }
  const nested = isRecord(request.objectStorySpec)
    ? request.objectStorySpec.asset_feed_spec
    : undefined;
  if (isRecord(nested)) {
    const error = assetFeedSpecCreateError(nested);
    if (error) return error;
  }
  return undefined;
}

const CREATIVE_DESTINATION_TYPES: readonly CreativeDestinationType[] = [
  'WEB',
  'WHATSAPP',
  'MESSENGER',
  'INSTAGRAM_DIRECT',
  'APP',
  'MESSAGING_INSTAGRAM_DIRECT_MESSENGER',
  'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP',
  'MESSAGING_INSTAGRAM_DIRECT_WHATSAPP',
  'MESSAGING_MESSENGER_WHATSAPP',
];

/**
 * Note this enum is NOT the ad set's destination_type (WEBSITE, APP, ...) — that
 * one is Meta's own field, while this one only steers the creative's CTA type.
 * Reject unknown values rather than forwarding a silently inert string.
 */
function parseCreativeDestinationType(value: unknown): CreativeDestinationType | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !CREATIVE_DESTINATION_TYPES.includes(value as CreativeDestinationType)
  ) {
    throw new Error(
      `destinationType harus salah satu dari ${CREATIVE_DESTINATION_TYPES.join(', ')}. Field ini beda dari destinationType milik ads_create_adset (WEBSITE/APP/...).`
    );
  }
  return value as CreativeDestinationType;
}

function parseMetaAdsMode(value: unknown): MetaAdsMode | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('mode harus berupa standard atau collaborative_ads.');
  }
  switch (value) {
    case 'standard':
    case 'collaborative_ads':
      return value;
    default:
      throw new Error('mode harus berupa standard atau collaborative_ads.');
  }
}

function parseMetaOdaxObjective(value: unknown): MetaOdaxObjective | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !META_ODAX_OBJECTIVES.includes(value as MetaOdaxObjective)) {
    throw new Error(`objective harus salah satu dari: ${META_ODAX_OBJECTIVES.join(', ')}.`);
  }
  return value as MetaOdaxObjective;
}

function parseMetaConversionLocation(value: unknown): MetaConversionLocation | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !META_CONVERSION_LOCATIONS.includes(value as MetaConversionLocation)
  ) {
    throw new Error(
      `conversionLocation harus salah satu dari: ${META_CONVERSION_LOCATIONS.join(', ')}.`
    );
  }
  return value as MetaConversionLocation;
}

function parseMetaMessagingDestination(value: unknown): MetaMessagingDestination | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !META_MESSAGING_DESTINATIONS.includes(value as MetaMessagingDestination)
  ) {
    throw new Error(
      `messagingDestination harus salah satu dari: ${META_MESSAGING_DESTINATIONS.join(', ')}.`
    );
  }
  return value as MetaMessagingDestination;
}

function parseMetaCreativeFormat(value: unknown): MetaCreativeFormat {
  switch (value) {
    case 'single_image':
    case 'video':
    case 'carousel':
    case 'catalog':
    case 'collection':
    case 'placement_image':
    case 'placement_customized_ctwa':
    case 'existing_post':
      return value;
    case 'flexible':
      throw new Error(
        'Dynamic Creative/Flexible asset-feed creation is disabled. Untuk variasi headline/caption/copy/image/video, buat beberapa manual creative/ad terpisah, carousel, atau placement customization dengan asset_customization_rules.'
      );
    default:
      throw new Error(
        'creativeFormat harus berupa single_image, video, carousel, catalog, collection, placement_image, placement_customized_ctwa, atau existing_post.'
      );
  }
}

function parseCollaborativeCatalog(value: unknown): MetaCollaborativeCatalogContext | undefined {
  if (value === undefined) return undefined;
  const catalog = requireRecord(value, 'collaborativeCatalog');
  return {
    productSetId: requireString(catalog.productSetId, 'collaborativeCatalog.productSetId'),
    pixelId: optionalString(catalog.pixelId, 'collaborativeCatalog.pixelId'),
    customEventType: optionalString(
      catalog.customEventType,
      'collaborativeCatalog.customEventType'
    ),
    destinationUrl: optionalString(catalog.destinationUrl, 'collaborativeCatalog.destinationUrl'),
    applicationId: optionalString(catalog.applicationId, 'collaborativeCatalog.applicationId'),
    objectStoreUrls: optionalStringArray(
      catalog.objectStoreUrls,
      'collaborativeCatalog.objectStoreUrls'
    ),
  };
}

function parseCollaborativeAppSpec(value: unknown): MetaCollaborativeAppSpec | undefined {
  if (value === undefined) return undefined;
  const app = requireRecord(value, 'collaborativeAppSpec');
  const android =
    app.android === undefined
      ? undefined
      : requireRecord(app.android, 'collaborativeAppSpec.android');
  const ios =
    app.ios === undefined ? undefined : requireRecord(app.ios, 'collaborativeAppSpec.ios');

  return {
    applicationId: requireString(app.applicationId, 'collaborativeAppSpec.applicationId'),
    ...(android
      ? {
          android: {
            appName: requireString(android.appName, 'collaborativeAppSpec.android.appName'),
            packageName: requireString(
              android.packageName,
              'collaborativeAppSpec.android.packageName'
            ),
          },
        }
      : {}),
    ...(ios
      ? {
          ios: {
            appName: requireString(ios.appName, 'collaborativeAppSpec.ios.appName'),
            appStoreId: requireString(ios.appStoreId, 'collaborativeAppSpec.ios.appStoreId'),
          },
        }
      : {}),
  };
}

function parseStandardAppSpec(value: unknown): MetaStandardAppSpec | undefined {
  if (value === undefined) return undefined;
  const app = requireRecord(value, 'standardAppSpec');
  return {
    applicationId: requireString(app.applicationId, 'standardAppSpec.applicationId'),
    objectStoreUrl: requireString(app.objectStoreUrl, 'standardAppSpec.objectStoreUrl'),
    deepLinkUrl: optionalString(app.deepLinkUrl, 'standardAppSpec.deepLinkUrl'),
  };
}

function parsePartnershipSpec(value: unknown): MetaPartnershipSpec | undefined {
  if (value === undefined) return undefined;
  const spec = requireRecord(value, 'partnership');

  const primaryIdentity =
    spec.primaryIdentity === undefined
      ? undefined
      : requireString(spec.primaryIdentity, 'partnership.primaryIdentity');
  if (
    primaryIdentity !== undefined &&
    primaryIdentity !== 'advertiser' &&
    primaryIdentity !== 'creator'
  ) {
    throw new Error("partnership.primaryIdentity harus 'advertiser' atau 'creator'.");
  }

  return {
    partnerPageId:
      spec.partnerPageId === undefined
        ? undefined
        : requireString(spec.partnerPageId, 'partnership.partnerPageId'),
    partnerInstagramId:
      spec.partnerInstagramId === undefined
        ? undefined
        : requireString(spec.partnerInstagramId, 'partnership.partnerInstagramId'),
    brandInstagramId:
      spec.brandInstagramId === undefined
        ? undefined
        : requireString(spec.brandInstagramId, 'partnership.brandInstagramId'),
    primaryIdentity,
    adCode:
      spec.adCode === undefined ? undefined : requireString(spec.adCode, 'partnership.adCode'),
    adFormat:
      spec.adFormat === undefined
        ? undefined
        : requireString(spec.adFormat, 'partnership.adFormat'),
  };
}

/**
 * Every field each creativeFormat actually reads, mirroring the specs in types.ts.
 * parseMetaCreativeSpec picks fields by name, so anything missing from these sets
 * used to vanish between a clean dry-run and the Graph API call — which is how a
 * Click-to-Instagram ad shipped with a dead button on 2026-07-26. Keep in sync with
 * the corresponding interface whenever a field is added.
 */
const COMMON_CREATIVE_COPY_FIELDS = [
  'primaryText',
  'headline',
  'description',
  'callToAction',
  'destinationUrl',
] as const;

const CREATIVE_SPEC_FIELDS: Record<MetaCreativeFormat, ReadonlySet<string>> = {
  single_image: new Set([
    ...COMMON_CREATIVE_COPY_FIELDS,
    'imageHash',
    'leadFormId',
    'pageWelcomeMessage',
    'applinkTreatment',
  ]),
  video: new Set([
    ...COMMON_CREATIVE_COPY_FIELDS,
    'videoId',
    'leadFormId',
    'thumbnailImageHash',
    'thumbnailImageUrl',
    'pageWelcomeMessage',
    'applinkTreatment',
    'retailerItemIds',
    'postClickConfiguration',
    'templateUrlSpec',
  ]),
  carousel: new Set([...COMMON_CREATIVE_COPY_FIELDS, 'cards']),
  catalog: new Set([
    ...COMMON_CREATIVE_COPY_FIELDS,
    'productSetId',
    'templateUrl',
    'fallbackImageHash',
  ]),
  collection: new Set([
    ...COMMON_CREATIVE_COPY_FIELDS,
    'instantExperienceId',
    'coverImageHash',
    'coverVideoId',
    'productSetId',
  ]),
  flexible: new Set([
    ...COMMON_CREATIVE_COPY_FIELDS,
    'primaryTexts',
    'imageHashes',
    'videoIds',
    'headlines',
    'descriptions',
    'messageExtensions',
  ]),
  placement_image: new Set([
    ...COMMON_CREATIVE_COPY_FIELDS,
    'feedImageHash',
    'verticalImageHash',
    'pageWelcomeMessage',
    'messageExtensions',
  ]),
  placement_customized_ctwa: new Set([
    ...COMMON_CREATIVE_COPY_FIELDS,
    'feedImageHash',
    'verticalImageHash',
    'pageWelcomeMessage',
  ]),
  existing_post: new Set([
    'objectStoryId',
    'sourceInstagramMediaId',
    'destinationUrl',
    'callToAction',
    'appDestination',
    'pageWelcomeMessage',
    'applinkTreatment',
  ]),
};

/** Raw Graph API spellings callers reach for, mapped back to the typed field. */
const CREATIVE_SPEC_FIELD_HINTS: Record<string, string> = {
  app_destination: 'creativeSpec.appDestination',
  page_welcome_message: 'creativeSpec.pageWelcomeMessage',
  source_instagram_media_id: 'creativeSpec.sourceInstagramMediaId',
  object_story_id: 'creativeSpec.objectStoryId',
  image_hash: 'creativeSpec.imageHash',
  video_id: 'creativeSpec.videoId',
  product_set_id: 'creativeSpec.productSetId',
  lead_gen_form_id: 'creativeSpec.leadFormId',
  call_to_action: 'creativeSpec.callToAction',
  call_to_action_type: 'creativeSpec.callToAction',
  link: 'creativeSpec.destinationUrl',
  message: 'creativeSpec.primaryText',
  title: 'creativeSpec.headline',
  applink_treatment: 'creativeSpec.applinkTreatment',
};

function assertKnownCreativeSpecFields(
  format: MetaCreativeFormat,
  spec: Record<string, unknown>
): void {
  const allowed = CREATIVE_SPEC_FIELDS[format];
  const unknown = Object.keys(spec).filter((key) => !allowed.has(key));
  if (unknown.length === 0) return;

  const detail = unknown
    .map((key) => {
      const hint = CREATIVE_SPEC_FIELD_HINTS[key];
      if (hint) return `${key} → ${hint}`;
      const owners = META_CREATIVE_FORMATS.filter((candidate) =>
        CREATIVE_SPEC_FIELDS[candidate].has(key)
      );
      return owners.length > 0 ? `${key} (hanya untuk creativeFormat ${owners.join(', ')})` : key;
    })
    .join('; ');

  throw new Error(
    `Field berikut tidak dikenali pada creativeSpec untuk creativeFormat ${format} dan TIDAK dikirim ke Meta: ${detail}. creativeSpec bukan passthrough mentah ke Graph API — pakai field bertipe yang sesuai, atau hapus field ini.`
  );
}

function parseMetaCreativeSpec(
  format: MetaCreativeFormat,
  spec: Record<string, unknown>
): MetaCreativeSpec {
  assertKnownCreativeSpecFields(format, spec);

  switch (format) {
    case 'single_image':
      return {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: requireString(spec.imageHash, 'creativeSpec.imageHash'),
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          destinationUrl: optionalString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          leadFormId: optionalString(spec.leadFormId, 'creativeSpec.leadFormId'),
          headline: optionalString(spec.headline, 'creativeSpec.headline'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
          pageWelcomeMessage: optionalPageWelcomeMessage(
            spec.pageWelcomeMessage,
            'creativeSpec.pageWelcomeMessage'
          ),
          applinkTreatment: optionalApplinkTreatment(
            spec.applinkTreatment,
            'creativeSpec.applinkTreatment'
          ),
        },
      };
    case 'video':
      return {
        creativeFormat: 'video',
        creativeSpec: {
          videoId: requireString(spec.videoId, 'creativeSpec.videoId'),
          thumbnailImageHash: optionalString(
            spec.thumbnailImageHash,
            'creativeSpec.thumbnailImageHash'
          ),
          thumbnailImageUrl: optionalString(
            spec.thumbnailImageUrl,
            'creativeSpec.thumbnailImageUrl'
          ),
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          destinationUrl: optionalString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          leadFormId: optionalString(spec.leadFormId, 'creativeSpec.leadFormId'),
          headline: optionalString(spec.headline, 'creativeSpec.headline'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
          pageWelcomeMessage: optionalPageWelcomeMessage(
            spec.pageWelcomeMessage,
            'creativeSpec.pageWelcomeMessage'
          ),
          applinkTreatment: optionalApplinkTreatment(
            spec.applinkTreatment,
            'creativeSpec.applinkTreatment'
          ),
          retailerItemIds: optionalStringArray(
            spec.retailerItemIds,
            'creativeSpec.retailerItemIds'
          ),
          postClickConfiguration: spec.postClickConfiguration
            ? {
                itemHeadline: requireString(
                  requireRecord(spec.postClickConfiguration, 'creativeSpec.postClickConfiguration')
                    .itemHeadline,
                  'creativeSpec.postClickConfiguration.itemHeadline'
                ),
                itemDescription: optionalString(
                  requireRecord(spec.postClickConfiguration, 'creativeSpec.postClickConfiguration')
                    .itemDescription,
                  'creativeSpec.postClickConfiguration.itemDescription'
                ),
              }
            : undefined,
          templateUrlSpec: spec.templateUrlSpec
            ? {
                applicationId: requireString(
                  requireRecord(spec.templateUrlSpec, 'creativeSpec.templateUrlSpec').applicationId,
                  'creativeSpec.templateUrlSpec.applicationId'
                ),
              }
            : undefined,
        },
      };
    case 'carousel':
      return {
        creativeFormat: 'carousel',
        creativeSpec: {
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          destinationUrl: optionalString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          headline: optionalString(spec.headline, 'creativeSpec.headline'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
          cards: requireRecordArray(spec.cards, 'creativeSpec.cards').map((card, index) => ({
            imageHash: optionalString(card.imageHash, `creativeSpec.cards[${index}].imageHash`),
            videoId: optionalString(card.videoId, `creativeSpec.cards[${index}].videoId`),
            headline: requireString(card.headline, `creativeSpec.cards[${index}].headline`),
            description: optionalString(
              card.description,
              `creativeSpec.cards[${index}].description`
            ),
            destinationUrl: requireString(
              card.destinationUrl,
              `creativeSpec.cards[${index}].destinationUrl`
            ),
          })),
        },
      };
    case 'catalog':
      return {
        creativeFormat: 'catalog',
        creativeSpec: {
          productSetId: requireString(spec.productSetId, 'creativeSpec.productSetId'),
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          destinationUrl: optionalString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          headline: optionalString(spec.headline, 'creativeSpec.headline'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
          templateUrl: optionalString(spec.templateUrl, 'creativeSpec.templateUrl'),
          fallbackImageHash: optionalString(
            spec.fallbackImageHash,
            'creativeSpec.fallbackImageHash'
          ),
        },
      };
    case 'collection':
      return {
        creativeFormat: 'collection',
        creativeSpec: {
          instantExperienceId: requireString(
            spec.instantExperienceId,
            'creativeSpec.instantExperienceId'
          ),
          coverImageHash: optionalString(spec.coverImageHash, 'creativeSpec.coverImageHash'),
          coverVideoId: optionalString(spec.coverVideoId, 'creativeSpec.coverVideoId'),
          productSetId: optionalString(spec.productSetId, 'creativeSpec.productSetId'),
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          destinationUrl: optionalString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          headline: optionalString(spec.headline, 'creativeSpec.headline'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
        },
      };
    case 'flexible':
      return {
        creativeFormat: 'flexible',
        creativeSpec: {
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          primaryTexts: requireStringArray(spec.primaryTexts, 'creativeSpec.primaryTexts'),
          imageHashes: optionalStringArray(spec.imageHashes, 'creativeSpec.imageHashes'),
          videoIds: optionalStringArray(spec.videoIds, 'creativeSpec.videoIds'),
          headlines: optionalStringArray(spec.headlines, 'creativeSpec.headlines'),
          descriptions: optionalStringArray(spec.descriptions, 'creativeSpec.descriptions'),
          destinationUrl: requireString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          headline: optionalString(spec.headline, 'creativeSpec.headline'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
          messageExtensions: optionalMessageExtensions(
            spec.messageExtensions,
            'creativeSpec.messageExtensions'
          ),
        },
      };
    case 'placement_image':
      return {
        creativeFormat: 'placement_image',
        creativeSpec: {
          feedImageHash: requireString(spec.feedImageHash, 'creativeSpec.feedImageHash'),
          verticalImageHash: requireString(
            spec.verticalImageHash,
            'creativeSpec.verticalImageHash'
          ),
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          headline: requireString(spec.headline, 'creativeSpec.headline'),
          destinationUrl: requireString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
          pageWelcomeMessage: optionalString(
            spec.pageWelcomeMessage,
            'creativeSpec.pageWelcomeMessage'
          ),
          messageExtensions: optionalMessageExtensions(
            spec.messageExtensions,
            'creativeSpec.messageExtensions'
          ),
        },
      };
    case 'placement_customized_ctwa':
      return {
        creativeFormat: 'placement_customized_ctwa',
        creativeSpec: {
          feedImageHash: requireString(spec.feedImageHash, 'creativeSpec.feedImageHash'),
          verticalImageHash: requireString(
            spec.verticalImageHash,
            'creativeSpec.verticalImageHash'
          ),
          primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
          headline: requireString(spec.headline, 'creativeSpec.headline'),
          destinationUrl: requireString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          description: optionalString(spec.description, 'creativeSpec.description'),
          pageWelcomeMessage: optionalString(
            spec.pageWelcomeMessage,
            'creativeSpec.pageWelcomeMessage'
          ),
        },
      };
    case 'existing_post':
      // Both source fields are optional here on purpose: buildExistingPost owns the
      // "exactly one of objectStoryId / sourceInstagramMediaId" rule so direct tool
      // callers and broker callers get the identical error.
      return {
        creativeFormat: 'existing_post',
        creativeSpec: {
          objectStoryId: optionalString(spec.objectStoryId, 'creativeSpec.objectStoryId'),
          sourceInstagramMediaId: optionalString(
            spec.sourceInstagramMediaId,
            'creativeSpec.sourceInstagramMediaId'
          ),
          destinationUrl: optionalString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
          callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
          appDestination: optionalAppDestination(
            spec.appDestination,
            'creativeSpec.appDestination'
          ),
          pageWelcomeMessage: optionalPageWelcomeMessage(
            spec.pageWelcomeMessage,
            'creativeSpec.pageWelcomeMessage'
          ),
          applinkTreatment: optionalApplinkTreatment(
            spec.applinkTreatment,
            'creativeSpec.applinkTreatment'
          ),
        },
      };
  }
}

async function withResolvedWelcomeMessageTemplate(
  spec: Record<string, unknown>,
  templateName: string | undefined
): Promise<Record<string, unknown>> {
  if (!templateName) return spec;
  if (spec.pageWelcomeMessage !== undefined) {
    throw new Error(
      'welcomeMessageTemplateName tidak dapat digunakan bersamaan dengan creativeSpec.pageWelcomeMessage.'
    );
  }

  const template = await getWelcomeMessageTemplate(templateName);
  if (!template) {
    throw new Error(`Welcome message template "${templateName}" tidak ditemukan.`);
  }

  return {
    ...spec,
    pageWelcomeMessage: template.pageWelcomeMessage,
  };
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} harus berupa object.`);
  return value;
}

function requireRecordArray(value: unknown, path: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${path} harus berupa array.`);
  return value.map((item, index) => requireRecord(item, `${path}[${index}]`));
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${path} wajib berupa string yang tidak kosong.`);
  }
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, path);
}

const APP_DESTINATIONS: readonly MetaAppDestination[] = [
  'INSTAGRAM_DIRECT',
  'MESSENGER',
  'WHATSAPP',
];

/**
 * Unlike CTA types (a free string — Meta owns that enum and it is long), the
 * app_destination enum is short, documented, and closed. A typo here produces a
 * button that silently does nothing, so reject rather than forward.
 */
function optionalAppDestination(value: unknown, path: string): MetaAppDestination | undefined {
  if (value === undefined) return undefined;
  const normalized = requireString(value, path);
  if (!APP_DESTINATIONS.includes(normalized as MetaAppDestination)) {
    throw new Error(`${path} harus salah satu dari: ${APP_DESTINATIONS.join(', ')}.`);
  }
  return normalized as MetaAppDestination;
}

/**
 * page_welcome_message is a JSON object in Meta's VISUAL_EDITOR form; the legacy
 * Click-to-WhatsApp path passes a plain greeting string. Accept both, reject anything
 * else — a number or array here would be dropped by Meta with no useful error.
 */
function optionalPageWelcomeMessage(
  value: unknown,
  path: string
): MetaPageWelcomeMessage | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return requireString(value, path);
  if (isRecord(value)) return value;
  throw new Error(
    `${path} harus berupa string atau object page_welcome_message (mis. { type: 'VISUAL_EDITOR', ... }).`
  );
}

function optionalApplinkTreatment(value: unknown, path: string): MetaApplinkTreatment | undefined {
  // Deliberately not a closed local validation: Meta owns the real enum. Same
  // free-string policy as CTA types — pass through and let Meta reject unknowns.
  return optionalString(value, path) as MetaApplinkTreatment | undefined;
}

function optionalPlainString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} harus berupa array string.`);
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  return requireStringArray(value, path);
}

function optionalMessageExtensions(
  value: unknown,
  path: string
): Array<{ type: string }> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${path} harus berupa array.`);
  return value.map((item, index) => {
    const extension = requireRecord(item, `${path}[${index}]`);
    return { type: requireString(extension.type, `${path}[${index}].type`) };
  });
}

function validationResponse(error: unknown): AdsBrokerResponse<never> {
  return {
    ok: false,
    provider: 'meta',
    errors: [
      {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

function isMetaComplianceAuditPermissionError(error: unknown): boolean {
  if (!(error instanceof MetaApiError)) return false;
  return (
    [3, 10, 200].includes(error.code) ||
    /capabilit|permission|not authorized|not approved/i.test(
      [error.message, error.userTitle, error.userMessage].filter(Boolean).join(' ')
    )
  );
}

function getMetaCreativeFields(
  mediaSourcingSupported: boolean,
  threadsUserIdSupported: boolean
): string[] {
  const fields = [
    'id',
    'name',
    'title',
    'body',
    'thumbnail_url',
    'image_url',
    'image_hash',
    'video_id',
    'object_type',
    'object_story_spec',
    'object_story_id',
    'instagram_user_id',
    'status',
    'degrees_of_freedom_spec',
    'asset_feed_spec',
    'platform_customizations',
    'portrait_customizations',
    'image_crops',
  ];
  if (threadsUserIdSupported) fields.push('threads_user_id');
  if (mediaSourcingSupported) fields.push('media_sourcing_spec');
  return fields;
}

function inferMetaCreativeType(creative: MetaCreativeRecord): string | undefined {
  if (creative.video_id || creative.object_story_spec?.video_data) return 'video';
  if (creative.object_story_spec?.link_data) return 'link';
  return creative.object_type;
}
