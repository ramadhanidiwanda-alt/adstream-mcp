import { getAdCreativeMapping } from '../../tools/getAdCreativeMapping.js';
import type { AdCreativeMappingResult } from '../../broker/types.js';
import { MetaClient } from '../../metaClient.js';
import { getAdAccounts } from '../../tools/getAdAccounts.js';
import { getAccountInsights } from '../../tools/getAccountInsights.js';
import { getCampaigns } from '../../tools/getCampaigns.js';
import { getAdsInsights } from '../../tools/getAdsInsights.js';
import { getAdsetInsights } from '../../tools/getAdsetInsights.js';
import { getCampaignInsights } from '../../tools/getCampaignInsights.js';
import { getMetaPlacementPerformance } from '../../tools/getMetaPlacementPerformance.js';
import type { GetMetaPlacementPerformanceOptions } from '../../tools/getMetaPlacementPerformance.js';
import type { AccountInsight, AdAccount, AdInsight, AdsetInsight, Campaign, CampaignInsight, MetaConfig, PlacementPerformanceReport } from '../../types.js';
import type { MutationResult } from '../../types.js';
import type { LocationBreakdown } from '../../types.js';
import { pauseCampaign as pauseCampaignTool } from '../../tools/pauseCampaign.js';
import { resumeCampaign as resumeCampaignTool } from '../../tools/resumeCampaign.js';
import { updateCampaignBudget as updateCampaignBudgetTool } from '../../tools/updateCampaignBudget.js';
import { renameCampaign as renameCampaignTool } from '../../tools/renameCampaign.js';
import { createEcommerceCampaignBundle as createEcommerceCampaignBundleTool } from '../../tools/createEcommerceCampaignBundle.js';
import type { EcommerceCampaignBundlePayload as MetaEcommerceCampaignBundlePayload, EcommerceCampaignBundleResult } from '../../tools/createEcommerceCampaignBundle.js';
import type { UploadImageResult } from '../../tools/uploadImage.js';
import type { UploadVideoResult } from '../../tools/uploadVideo.js';
import { uploadImage as uploadImageTool } from '../../tools/uploadImage.js';
import { uploadVideo as uploadVideoTool } from '../../tools/uploadVideo.js';
import { getAccountInfo } from '../../tools/getAccountInfo.js';
import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsChangeHistoryEnvelope,
  AdsChangeHistoryRecord,
  AdsMetricRecord,
  AdsMutationResult,
  AdsProviderAdapter,
  CredentialContext,
  EcommerceCampaignBundlePayload,
  VideoSourceResult,
  ImageUploadResult,
  VideoUploadResult,
  AccountInfoResult,
} from '../../broker/types.js';
import { ADS_PROVIDER_CAPABILITY_MATRIX } from '../../broker/types.js';
import { redactErrorMessage } from '../../broker/credentials.js';
import { assertLocationBreakdowns } from '../../utils/locationBreakdowns.js';
import { normalizeMetaInsights } from './normalizer.js';

interface MetaActivityRecord {
  event_time?: string;
  event_type?: string;
  translated_event_type?: string;
  object_id?: string;
  object_name?: string;
  object_type?: string;
  actor_id?: string;
  actor_name?: string;
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
  object_type?: string;
  object_story_spec?: {
    link_data?: {
      link?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
    video_data?: {
      call_to_action?: { type?: string; value?: { link?: string } };
    };
  };
}

export interface MetaAdsAdapterTools {
  getAdAccounts(client: MetaClient, options?: { limit?: number }): Promise<AdAccount[]>;
  getCampaigns(client: MetaClient, options: { adAccountId: string; limit?: number }): Promise<Campaign[]>;
  getAccountInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number }
  ): Promise<AccountInsight[]>;
  getCampaignInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: Array<LocationBreakdown | 'product_id'> }
  ): Promise<CampaignInsight[]>;
  getAdsetInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: Array<LocationBreakdown | 'product_id'> }
  ): Promise<AdsetInsight[]>;
  getAdsInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: Array<LocationBreakdown | 'product_id'> }
  ): Promise<AdInsight[]>;
  getMetaPlacementPerformance(
    client: MetaClient,
    options: GetMetaPlacementPerformanceOptions
  ): Promise<PlacementPerformanceReport>;
  // --- Write operations ---
  pauseCampaign(client: MetaClient, campaignId: string): Promise<MutationResult>;
  resumeCampaign(client: MetaClient, campaignId: string): Promise<MutationResult>;
  updateCampaignBudget(client: MetaClient, campaignId: string, dailyBudget: number): Promise<MutationResult>;
  renameCampaign(client: MetaClient, campaignId: string, newName: string): Promise<MutationResult>;
  createEcommerceCampaignBundle(
    client: MetaClient,
    payload: MetaEcommerceCampaignBundlePayload,
    options?: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number }
  ): Promise<EcommerceCampaignBundleResult>;
  uploadImage(
    client: MetaClient,
    options: { adAccountId: string; filePath: string; maxRetries?: number }
  ): Promise<UploadImageResult>;
  uploadVideo(
    client: MetaClient,
    options: { adAccountId: string; filePath: string; title?: string; description?: string; maxRetries?: number }
  ): Promise<UploadVideoResult>;
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
      createEcommerceCampaignBundle: createEcommerceCampaignBundleTool,
      uploadImage: uploadImageTool,
      uploadVideo: uploadVideoTool,
      ...options.tools,
    };
  }

  async listAccounts(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdAccount[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    try {
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const accounts = await this.tools.getAdAccounts(this.createClient(context.credential), { limit });
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
        errors: [{
          provider: 'meta',
          code: 'MISSING_ACCOUNT_ID',
          message: 'accountId is required to list campaigns (provide accountId or use ads_list_accounts first)',
        }],
      };
    }

    try {
      const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
      const campaigns = await this.tools.getCampaigns(
        this.createClient(context.credential),
        { adAccountId, limit }
      );
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

  async getCreativePerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    const creativeId = typeof request.params.creativeId === 'string' ? request.params.creativeId : undefined;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [{ provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required for Meta creative assets' }],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const fields = 'id,name,title,body,thumbnail_url,image_url,image_hash,video_id,object_type,object_story_spec';

      if (creativeId) {
        const creative = await client.metaGetObject<MetaCreativeRecord>(`/${creativeId}`, { fields });

        return {
          ok: true,
          provider: 'meta',
          data: [this.normalizeCreative(accountId, creative, request)],
          meta: { nextCursor: null },
        };
      }

      const response = await client.metaGet<{
        data: MetaCreativeRecord[];
        paging?: { cursors?: { after?: string } };
      }>(`/act_${accountId}/adcreatives`, {
        fields,
        limit: typeof request.params.limit === 'number' ? request.params.limit : 100,
        after: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
      });

      return {
        ok: true,
        provider: 'meta',
        data: (response.data ?? []).map((creative) => this.normalizeCreative(accountId, creative, request)),
        meta: { nextCursor: response.paging?.cursors?.after ?? null },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private normalizeCreative(
    accountId: string,
    creative: MetaCreativeRecord,
    request: AdsBrokerRequest
  ): AdsMetricRecord {
    const callToAction = creative.object_story_spec?.link_data?.call_to_action ?? creative.object_story_spec?.video_data?.call_to_action;
    const destinationUrl = creative.object_story_spec?.link_data?.link ?? callToAction?.value?.link;

    return {
      provider: 'meta',
      level: 'creative',
      identity: {
        account_id: accountId,
        creative_id: creative.id,
        creative_name: creative.name,
      },
      time: {
        date_start: request.since ?? '',
        date_stop: request.until ?? '',
      },
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

  async getChangeHistory(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsChangeHistoryEnvelope>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [{ provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required for Meta change history' }],
      };
    }

    try {
      const response = await this.createClient(context.credential).metaGet<{
        data: MetaActivityRecord[];
        paging?: { cursors?: { after?: string } };
      }>(`/act_${accountId}/activities`, {
        fields: 'event_time,event_type,translated_event_type,object_id,object_name,object_type,actor_id,actor_name,extra_data',
        since: request.since,
        until: request.until,
        limit: typeof request.params.limit === 'number' ? request.params.limit : 100,
        after: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
      });

      const rows = (response.data ?? []).map((activity): AdsChangeHistoryRecord => ({
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
        raw: request.params.includeRaw === true ? activity : undefined,
      }));

      return {
        ok: true,
        provider: 'meta',
        data: {
          provider: 'meta',
          account: { id: accountId },
          dateRange: { since: request.since, until: request.until },
          rows,
          paging: { nextCursor: response.paging?.cursors?.after ?? null },
          warnings: rows.length === 0
            ? [{ code: 'NO_CHANGE_HISTORY_ROWS', message: 'Meta returned no change history rows for the requested range.', severity: 'info' }]
            : [],
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

      return {
        ok: true,
        provider: 'meta',
        data,
        meta: {
          ...(validation.options.mode === 'cpas' ? { mode: 'cpas' } : {}),
          nextCursor: insights.paging?.cursors?.after ?? null,
        },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private fetchInsights(
    client: MetaClient,
    level: 'account' | 'campaign' | 'adset' | 'ad',
    options: { adAccountId: string; since: string; until: string; limit?: number; cursor?: string; breakdowns?: Array<LocationBreakdown | 'product_id'>; mode?: 'standard' | 'cpas' }
  ): Promise<Array<AccountInsight | CampaignInsight | AdsetInsight | AdInsight> & { paging?: { cursors?: { after?: string } } }> {
    if (level === 'account') return this.tools.getAccountInsights(client, options);
    if (level === 'campaign') return this.tools.getCampaignInsights(client, options);
    if (level === 'adset') return this.tools.getAdsetInsights(client, options);
    return this.tools.getAdsInsights(client, options);
  }

  private getCredentialContext(request: AdsBrokerRequest):
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
    | { ok: true; options: { adAccountId: string; since: string; until: string; limit?: number; cursor?: string; breakdowns?: Array<LocationBreakdown | 'product_id'>; mode?: 'standard' | 'cpas' } }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const adAccountId = request.accountId ?? credential.accountId;
    const since = request.since;
    const until = request.until;
    const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
    const cursor = typeof request.params.cursor === 'string' ? request.params.cursor : undefined;
    const mode = request.params.mode === 'cpas' ? 'cpas' : undefined;
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

    return { ok: true, options: { adAccountId, since, until, limit, cursor, breakdowns, mode } };
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
      apiVersion: credential.apiVersion ?? 'v20.0',
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
        errors: [{ provider: 'meta', code: 'MISSING_CAMPAIGN_ID', message: 'campaignId is required in request.params' }],
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
        errors: [{ provider: 'meta', code: 'MISSING_CAMPAIGN_ID', message: 'campaignId is required in request.params' }],
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

  async updateCampaignBudget(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const campaignId = this.getEntityId(request);
    const dailyBudget = typeof request.params.dailyBudget === 'number' ? request.params.dailyBudget : undefined;

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

  async uploadImage(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ImageUploadResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const filePath = typeof request.params.filePath === 'string' ? request.params.filePath : undefined;
    if (!adAccountId || !filePath) {
      return {
        ok: false,
        provider: 'meta',
        errors: [{
          provider: 'meta',
          code: 'MISSING_REQUIRED_PARAMS',
          message: 'Meta image upload requires accountId and filePath',
        }],
      };
    }

    try {
      const result = await this.tools.uploadImage(
        this.createClient(context.credential),
        { adAccountId, filePath, maxRetries: typeof request.params.maxRetries === 'number' ? request.params.maxRetries : 3 }
      );
      return { ok: result.status === 'executed', provider: 'meta', data: result };
    } catch (error) {
      return this.writeErrorResponse(error);
    }
  }

  async uploadVideo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoUploadResult>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const adAccountId = request.accountId ?? context.credential.accountId;
    const filePath = typeof request.params.filePath === 'string' ? request.params.filePath : undefined;
    if (!adAccountId || !filePath) {
      return {
        ok: false,
        provider: 'meta',
        errors: [{
          provider: 'meta',
          code: 'MISSING_REQUIRED_PARAMS',
          message: 'Meta video upload requires accountId and filePath',
        }],
      };
    }

    try {
      const result = await this.tools.uploadVideo(
        this.createClient(context.credential),
        {
          adAccountId,
          filePath,
          title: typeof request.params.title === 'string' ? request.params.title : undefined,
          description: typeof request.params.description === 'string' ? request.params.description : undefined,
          maxRetries: typeof request.params.maxRetries === 'number' ? request.params.maxRetries : 3,
        }
      );
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
        errors: [{ provider: 'meta', code: 'MISSING_VIDEO_ID', message: 'videoId is required in request.params' }],
      };
    }

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [{ provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required to fetch video source' }],
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
            warning: 'Direct video source URL not available from Meta API. Fallback to Facebook Watch URL.',
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

  async getAdCreativeMapping(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdCreativeMappingResult[]>> {
    const context = this.getCredentialContext(request);
    if (!context.ok) return context.response;

    const accountId = request.accountId ?? context.credential.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'meta',
        errors: [{ provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required to fetch ad→creative mapping' }],
      };
    }

    try {
      const client = this.createClient(context.credential);
      const adIds = Array.isArray(request.params.adIds) ? request.params.adIds.map(String) : undefined;
      const result = await getAdCreativeMapping(client, {
        adAccountId: accountId,
        adIds,
        limit: typeof request.params.limit === 'number' ? request.params.limit : 100,
        cursor: typeof request.params.cursor === 'string' ? request.params.cursor : undefined,
      });

      // Extract paging from the array augmentation
      const page = result as AdCreativeMappingResult[] & { paging?: { cursors?: { after?: string } } };
      return {
        ok: true,
        provider: 'meta',
        data: page,
        meta: { nextCursor: page.paging?.cursors?.after ?? null },
      };
    } catch (error) {
      return this.errorResponse(error);
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
        errors: [{ provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'Meta account ID is required' }],
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
          errors: [{ provider: 'meta', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required' }],
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
        countries: Array.isArray(params.countries) ? params.countries.filter((country): country is string => typeof country === 'string') : [],
        primaryText: String(params.primaryText ?? ''),
        headline: String(params.headline ?? ''),
        description: typeof params.description === 'string' ? params.description : undefined,
        imageHash: typeof params.imageHash === 'string' ? params.imageHash : undefined,
        videoId: typeof params.videoId === 'string' ? params.videoId : undefined,
        callToActionType: params.callToActionType,
        specialAdCategories: Array.isArray(params.specialAdCategories)
          ? params.specialAdCategories.filter((category): category is string => typeof category === 'string')
          : undefined,
        ageMin: typeof params.ageMin === 'number' ? params.ageMin : undefined,
        ageMax: typeof params.ageMax === 'number' ? params.ageMax : undefined,
        publisherPlatforms: Array.isArray(params.publisherPlatforms)
          ? params.publisherPlatforms.filter((platform): platform is string => typeof platform === 'string')
          : undefined,
        instagramUserId: typeof params.instagramUserId === 'string' ? params.instagramUserId : undefined,
      },
    };
  }

  private getEntityId(request: AdsBrokerRequest): string | undefined {
    return typeof request.params.campaignId === 'string'
      ? request.params.campaignId
      : undefined;
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
    return {
      ok: false,
      provider: 'meta',
      errors: [
        {
          provider: 'meta',
          code: 'META_WRITE_ERROR',
          message: redactErrorMessage(error instanceof Error ? error.message : String(error)),
        },
      ],
    };
  }
}

function parseIdParam(value: unknown): string | string[] | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return undefined;
}

function inferMetaCreativeType(creative: MetaCreativeRecord): string | undefined {
  if (creative.video_id || creative.object_story_spec?.video_data) return 'video';
  if (creative.object_story_spec?.link_data) return 'link';
  return creative.object_type;
}
