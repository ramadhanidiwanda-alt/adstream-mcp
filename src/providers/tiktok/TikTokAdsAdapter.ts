import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsChangeHistoryEnvelope,
  AdsMetricRecord,
  AdsMutationResult,
  ArchiveAdResult,
  CloneUiAdResult,
  CloneAdSetResult,
  CreateAdCreativeResult,
  CreateAdResult,
  CreateAdSetResult,
  CreateCampaignResult,
  GetTargetingOptionsResult,
  UpdateAdSetResult,
  UpdateAdResult,
  UpdateCampaignResult,
  EcommerceCampaignBundleResult,
  AdsProviderAdapter,
  VideoSourceResult,
  AdCreativeMappingResult,
  ImageUploadResult,
  VideoUploadResult,
  AccountInfoResult,
  AdImageResult,
  AdVideoResult,
  AdPreviewResult,
  AdDestinationResult,
  AdCreativeFullResult,
  AdSetFullResult,
} from '../../broker/types.js';
import { ADS_PROVIDER_CAPABILITY_MATRIX } from '../../broker/types.js';
import { redactErrorMessage } from '../../broker/credentials.js';
import { normalizeTikTokInsights, type TikTokInsightRecord } from './normalizer.js';
import type { TikTokApiClient } from '../../tiktokClient.js';
import { getTikTokReport } from '../../tools/getTikTokReport.js';
import { getTikTokAdvertisers } from '../../tools/getTikTokAdvertisers.js';
import { getTikTokCampaigns } from '../../tools/getTikTokCampaigns.js';
import type { TikTokCampaign } from '../../tools/getTikTokCampaigns.js';
import {
  createTikTokCampaign,
  updateTikTokCampaign,
  updateTikTokCampaignStatus,
} from '../../tools/tiktok/createTikTokCampaign.js';
import type {
  CreateTikTokCampaignOptions,
  UpdateTikTokCampaignOptions,
} from '../../tools/tiktok/createTikTokCampaign.js';
import {
  createTikTokAdGroup,
  updateTikTokAdGroupStatus,
  updateTikTokAdGroupBudget,
} from '../../tools/tiktok/createTikTokAdGroup.js';
import type {
  CreateTikTokAdGroupOptions,
  TikTokAdGroupStatusOptions,
  TikTokAdGroupBudgetOptions,
} from '../../tools/tiktok/createTikTokAdGroup.js';
import {
  createTikTokAd,
  updateTikTokAdStatus,
} from '../../tools/tiktok/createTikTokAd.js';
import type {
  CreateTikTokAdOptions,
  TikTokAdStatusOptions,
} from '../../tools/tiktok/createTikTokAd.js';
import {
  createGmvMaxCampaign,
  updateGmvMaxCampaign,
  createGmvMaxSession,
  updateGmvMaxSession,
  deleteGmvMaxSession,
  getGmvMaxCampaignInfo,
  getGmvMaxBidRecommend,
} from '../../tools/tiktok/createTikTokGmvMax.js';
import type {
  CreateGmvMaxCampaignOptions,
  CreateGmvMaxSessionOptions,
} from '../../tools/tiktok/createTikTokGmvMax.js';
import {
  createSmartPlusCampaign,
  updateSmartPlusCampaign,
  updateSmartPlusCampaignStatus,
  createSmartPlusAdGroup,
  updateSmartPlusAdGroup,
  updateSmartPlusAdGroupStatus,
  getSmartPlusCampaign,
} from '../../tools/tiktok/createTikTokSmartPlus.js';
import type {
  CreateSmartPlusCampaignOptions,
  CreateSmartPlusAdGroupOptions,
} from '../../tools/tiktok/createTikTokSmartPlus.js';

export interface TikTokAdsAdapterMockData {
  accounts?: unknown[];
  tiktokCampaigns?: TikTokCampaign[];
  account?: TikTokInsightRecord[];
  campaigns?: TikTokInsightRecord[];
  adgroups?: TikTokInsightRecord[];
  ads?: TikTokInsightRecord[];
  creatives?: TikTokInsightRecord[];
}

export interface TikTokAdsAdapterOptions {
  /** Provide mock data for testing (legacy) */
  mockData?: TikTokAdsAdapterMockData;
  /** Provide a real TikTok API client */
  client?: TikTokApiClient;
}

export class TikTokAdsAdapter implements AdsProviderAdapter {
  readonly id = 'tiktok' as const;
  readonly displayName = 'TikTok Ads';
  readonly capabilities = ADS_PROVIDER_CAPABILITY_MATRIX.tiktok;

  constructor(private readonly options: TikTokAdsAdapterOptions = {}) {}

  private get client(): TikTokApiClient | undefined {
    return this.options.client;
  }

  async listAccounts(): Promise<AdsBrokerResponse<unknown[]>> {
    if (this.client) {
      try {
        const accounts = await getTikTokAdvertisers(this.client);
        return { ok: true, provider: 'tiktok', data: accounts };
      } catch (error) {
        return this.errorResponse(error);
      }
    }

    if (this.options.mockData?.accounts) {
      return { ok: true, provider: 'tiktok', data: this.options.mockData.accounts };
    }

    return this.notImplemented();
  }

  async listCampaigns(request: AdsBrokerRequest): Promise<AdsBrokerResponse<TikTokCampaign[]>> {
    // Mock fallback (legacy pattern)
    if (!this.client && this.options.mockData?.tiktokCampaigns) {
      return { ok: true, provider: 'tiktok', data: this.options.mockData.tiktokCampaigns };
    }

    // No client
    if (!this.client) {
      return this.notImplemented();
    }

    const accountId = request.accountId ?? request.credentials?.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'tiktok',
        errors: [{
          provider: 'tiktok',
          code: 'MISSING_ACCOUNT_ID',
          message: 'accountId is required to list TikTok campaigns (provide accountId or use ads_list_accounts first)',
        }],
      };
    }

    try {
      const page = typeof request.params.page === 'number' ? request.params.page : undefined;
      const pageSize = typeof request.params.pageSize === 'number' ? request.params.pageSize : undefined;
      const campaigns = await getTikTokCampaigns(this.client, { advertiserId: accountId, page, pageSize });
      return { ok: true, provider: 'tiktok', data: campaigns };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async getAccountPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'account', this.options.mockData?.account);
  }

  async getCampaignPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'campaign', this.options.mockData?.campaigns);
  }

  async getAdsetOrAdgroupPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'adgroup', this.options.mockData?.adgroups);
  }

  async getAdPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'ad', this.options.mockData?.ads);
  }

  async getCreativePerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'creative', this.options.mockData?.creatives);
  }

  async getPlacementPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPlacementPerformanceForRequest(request);
  }

  async getChangeHistory(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsChangeHistoryEnvelope>> {
    return this.notImplemented('TikTok change history is not implemented yet');
  }

  async getVideoSource(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoSourceResult>> {
    return Promise.resolve(this.notImplemented('TikTok video source is not implemented yet') as unknown as AdsBrokerResponse<VideoSourceResult>);
  }

  async getAdCreativeMapping(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdCreativeMappingResult[]>> {
    return Promise.resolve(this.notImplemented('TikTok ad→creative mapping is not implemented yet') as unknown as AdsBrokerResponse<AdCreativeMappingResult[]>);
  }

  async getAdDestinations(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdDestinationResult[]>> {
    return Promise.resolve(this.notImplemented('TikTok ad destinations are not implemented yet') as unknown as AdsBrokerResponse<AdDestinationResult[]>);
  }

  async readAdCreativeFull(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdCreativeFullResult>> {
    return Promise.resolve(this.notImplemented('TikTok readAdCreativeFull is not implemented yet') as unknown as AdsBrokerResponse<AdCreativeFullResult>);
  }

  async readAdSetFull(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdSetFullResult>> {
    return Promise.resolve(this.notImplemented('TikTok readAdSetFull is not implemented yet') as unknown as AdsBrokerResponse<AdSetFullResult>);
  }

  private async getPlacementPerformanceForRequest(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    const accountId = request.accountId ?? request.credentials?.accountId;
    if (!accountId || !request.since || !request.until) {
      return {
        ok: false,
        provider: 'tiktok',
        errors: [
          {
            provider: 'tiktok',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'TikTok placement performance requests require accountId, since, and until',
          },
        ],
      };
    }

    if (!this.client) {
      return this.notImplemented();
    }

    try {
      const report = await getTikTokReport(this.client, {
        advertiserId: accountId,
        reportType: 'BASIC',
        dimensions: ['adgroup_id'],
        metrics: ['placement_type', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions', 'conversion_value', 'real_time_conversion_value_per_cost'],
        dataLevel: 'AUCTION_ADGROUP',
        startDate: request.since,
        endDate: request.until,
      });

      const records: TikTokInsightRecord[] = report.list.map((row) => ({
        advertiser_id: accountId,
        adgroup_id: row.dimensions.adgroup_id,
        placement_type: row.metrics.placement_type ?? row.dimensions.placement_type,
        spend: row.metrics.spend,
        impressions: row.metrics.impressions,
        clicks: row.metrics.clicks,
        ctr: row.metrics.ctr,
        cpc: row.metrics.cpc,
        cpm: row.metrics.cpm,
        conversions: row.metrics.conversions,
        conversion_value: row.metrics.conversion_value,
        roas: row.metrics.real_time_conversion_value_per_cost,
      }));

      return {
        ok: true,
        provider: 'tiktok',
        data: normalizeTikTokInsights(records, {
          level: 'account',
          accountId,
          since: request.since,
          until: request.until,
        }),
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private async getPerformance(
    request: AdsBrokerRequest,
    level: 'account' | 'campaign' | 'adgroup' | 'ad' | 'creative',
    mockData: TikTokInsightRecord[] | undefined
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    // No client and no mock → not implemented
    if (!this.client && !mockData) {
      return this.notImplemented();
    }

    const accountId = request.accountId ?? request.credentials?.accountId;
    if (!accountId || !request.since || !request.until) {
      return {
        ok: false,
        provider: 'tiktok',
        errors: [
          {
            provider: 'tiktok',
            code: 'MISSING_REQUIRED_PARAMS',
            message: 'TikTok performance requests require accountId, since, and until',
          },
        ],
      };
    }

    // Real API client
    if (this.client) {
      try {
        const dataLevel = level === 'account' ? 'AUCTION_ADVERTISER'
          : level === 'campaign' ? 'AUCTION_CAMPAIGN'
          : level === 'adgroup' ? 'AUCTION_ADGROUP'
          : level === 'ad' ? 'AUCTION_AD'
          : 'AUCTION_CAMPAIGN';

        const report = await getTikTokReport(this.client, {
          advertiserId: accountId,
          reportType: 'BASIC',
          dimensions: [
            level === 'account' ? 'advertiser_id'
              : level === 'ad' ? 'ad_id'
              : level === 'adgroup' ? 'adgroup_id'
              : 'campaign_id',
          ],
          metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions', 'conversion_value', 'real_time_conversion_value_per_cost'],
          dataLevel,
          startDate: request.since,
          endDate: request.until,
          page: parsePage(request.params.page) ?? parsePage(request.params.cursor),
          pageSize: parsePage(request.params.pageSize),
        });

        const records: TikTokInsightRecord[] = report.list.map((row) => ({
          advertiser_id: accountId,
          campaign_id: row.dimensions.campaign_id,
          adgroup_id: row.dimensions.adgroup_id,
          ad_id: row.dimensions.ad_id,
          objective_type: row.dimensions.objective_type,
          operation_status: row.dimensions.operation_status,
          spend: row.metrics.spend,
          impressions: row.metrics.impressions,
          clicks: row.metrics.clicks,
          ctr: row.metrics.ctr,
          cpc: row.metrics.cpc,
          cpm: row.metrics.cpm,
          conversions: row.metrics.conversions,
          conversion_value: row.metrics.conversion_value,
          roas: row.metrics.real_time_conversion_value_per_cost,
        }));

        return {
          ok: true,
          provider: 'tiktok',
          data: normalizeTikTokInsights(records, {
            level,
            accountId,
            since: request.since,
            until: request.until,
          }),
          meta: { nextCursor: getTikTokNextCursor(report.page_info) },
        };
      } catch (error) {
        return this.errorResponse(error);
      }
    }

    // Mock fallback (legacy)
    if (mockData) {
      try {
        return {
          ok: true,
          provider: 'tiktok',
          data: normalizeTikTokInsights(mockData, {
            level,
            accountId,
            since: request.since,
            until: request.until,
          }),
        };
      } catch (error) {
        return this.errorResponse(error);
      }
    }

    return this.notImplemented();
  }

  private notImplemented(message = 'TikTok Ads adapter requires a client or mock data to be configured'): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'tiktok',
      errors: [
        {
          provider: 'tiktok',
          code: 'NOT_IMPLEMENTED',
          message,
        },
      ],
    };
  }

  private errorResponse(error: unknown): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'tiktok',
      errors: [
        {
          provider: 'tiktok',
          code: 'TIKTOK_ADAPTER_ERROR',
          message: redactErrorMessage(error instanceof Error ? error.message : String(error)),
        },
      ],
    };
  }

  // --- Write Operations ---

  async createCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateCampaignResult>> {
    if (!this.client) return this.writeNotImplemented();
    const params = request.params;
    try {
      const result = await createTikTokCampaign(this.client, {
        advertiserId: String(params.advertiserId ?? request.accountId ?? ''),
        campaignName: String(params.campaignName ?? ''),
        campaignType: String(params.campaignType ?? 'REGULAR'),
        objectiveType: String(params.objectiveType ?? ''),
        budgetMode: String(params.budgetMode ?? 'DAILY'),
        budget: Number(params.budget ?? 0),
        bidType: params.bidType as string | undefined,
        operationStatus: params.operationStatus as string | undefined,
        budgetOptimizeOn: params.budgetOptimizeOn as boolean | undefined,
        specialIndustries: Array.isArray(params.specialIndustries) ? params.specialIndustries.map(String) : undefined,
      });
      return {
        ok: true, provider: 'tiktok',
        data: { operation: 'create_campaign', status: 'executed', executed: true, id: result.campaign_id ?? '', preview: {}, response: result as unknown as Record<string, unknown> },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async pauseCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.campaignStatusUpdate(request, 'DISABLE');
  }

  async resumeCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.campaignStatusUpdate(request, 'ENABLE');
  }

  async updateCampaignBudget(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    const campaignId = String(request.params.campaignId ?? '');
    const dailyBudget = Number(request.params.dailyBudget ?? 0);
    if (!campaignId || !dailyBudget) {
      return { ok: false, provider: 'tiktok', errors: [{ provider: 'tiktok', code: 'MISSING_REQUIRED_PARAMS', message: 'campaignId and dailyBudget are required' }] };
    }
    try {
      const result = await updateTikTokCampaign(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignId,
        budget: dailyBudget,
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: campaignId, operation: 'update_campaign_budget', response: result as unknown as Record<string, unknown> } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async renameCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    const campaignId = String(request.params.campaignId ?? '');
    const newName = String(request.params.newName ?? '');
    if (!campaignId || !newName) {
      return { ok: false, provider: 'tiktok', errors: [{ provider: 'tiktok', code: 'MISSING_REQUIRED_PARAMS', message: 'campaignId and newName are required' }] };
    }
    try {
      const result = await updateTikTokCampaign(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignId,
        campaignName: newName,
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: campaignId, operation: 'rename_campaign', response: result as unknown as Record<string, unknown> } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private async campaignStatusUpdate(request: AdsBrokerRequest, status: 'ENABLE' | 'DISABLE'): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    const campaignId = String(request.params.campaignId ?? '');
    if (!campaignId) {
      return { ok: false, provider: 'tiktok', errors: [{ provider: 'tiktok', code: 'MISSING_CAMPAIGN_ID', message: 'campaignId is required' }] };
    }
    try {
      await updateTikTokCampaignStatus(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignId,
        status,
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: campaignId, operation: status === 'ENABLE' ? 'resume_campaign' : 'pause_campaign' } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async createAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdSetResult>> {
    if (!this.client) return this.writeNotImplemented();
    const params = request.params;
    try {
      const result = await createTikTokAdGroup(this.client, {
        advertiserId: String(params.advertiserId ?? request.accountId ?? ''),
        campaignId: String(params.campaignId ?? ''),
        adgroupName: String(params.name ?? ''),
        budgetMode: String(params.budgetMode ?? 'DAILY'),
        budget: Number(params.budget ?? 0),
        bidType: String(params.bidType ?? 'BID_TYPE_CPM'),
        bidPrice: Number(params.bidPrice ?? 0),
        optimizationGoal: String(params.optimizationGoal ?? ''),
        billingEvent: String(params.billingEvent ?? ''),
        placementType: String(params.placementType ?? 'PLACEMENT_TYPE_AUTO'),
        operationStatus: params.operationStatus as string | undefined,
        scheduleStartTime: params.scheduleStartTime as string | undefined,
        scheduleEndTime: params.scheduleEndTime as string | undefined,
        creativeMaterialMode: params.creativeMaterialMode as string | undefined,
        conversionBidPrice: params.conversionBidPrice as number | undefined,
        frequency: params.frequency as number | undefined,
        identityType: params.identityType as string | undefined,
        identityId: params.identityId as string | undefined,
      });
      return {
        ok: true, provider: 'tiktok',
        data: { operation: 'create_adset', status: 'executed', executed: true, id: result.adgroup_id ?? '', preview: {}, response: result as unknown as Record<string, unknown> },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async updateAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateAdSetResult>> {
    if (!this.client) return this.writeNotImplemented();
    const adSetId = String(request.params.adSetId ?? '');
    if (!adSetId) {
      return { ok: false, provider: 'tiktok', errors: [{ provider: 'tiktok', code: 'MISSING_ADSET_ID', message: 'adSetId is required' }] };
    }

    const status = request.params.status as string | undefined;
    const budget = request.params.dailyBudget as number | undefined;
    const budgetMode = request.params.budgetMode as string | undefined;

    try {
      if (status) {
        await updateTikTokAdGroupStatus(this.client, {
          advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
          adgroupId: adSetId,
          status: status === 'ACTIVE' ? 'ENABLE' : 'DISABLE',
        });
      }
      if (budget !== undefined) {
        await updateTikTokAdGroupBudget(this.client, {
          advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
          adgroupId: adSetId,
          budget,
          budgetMode: budgetMode ?? 'DAILY',
        });
      }
      return { ok: true, provider: 'tiktok', data: { operation: 'update_adset', status: 'executed', executed: true, success: true, id: adSetId, preview: {}, response: {} } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async updateAd(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateAdResult>> {
    return this.writeNotImplemented() as unknown as AdsBrokerResponse<UpdateAdResult>;
  }

  async updateCampaign(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateCampaignResult>> {
    return this.writeNotImplemented() as unknown as AdsBrokerResponse<UpdateCampaignResult>;
  }

  async createAdCreative(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdCreativeResult>> {
    // TikTok creatives are created as part of ad creation (ad_create includes creatives array)
    return Promise.resolve({
      ok: false, provider: 'tiktok',
      errors: [{ provider: 'tiktok', code: 'NOT_IMPLEMENTED', message: 'TikTok creatives are created inline via ad_create. Use createAd with creatives[] parameter.' }],
    } as AdsBrokerResponse<CreateAdCreativeResult>);
  }

  async createAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdResult>> {
    if (!this.client) return this.writeNotImplemented();
    const params = request.params;
    try {
      const creatives = Array.isArray(params.creatives) ? params.creatives : [];
      const result = await createTikTokAd(this.client, {
        advertiserId: String(params.advertiserId ?? request.accountId ?? ''),
        adgroupId: String(params.adSetId ?? ''),
        adName: String(params.name ?? ''),
        creatives: creatives.map((c: Record<string, unknown>) => ({
          creative_name: String(c.creative_name ?? ''),
          creative_material: c.creative_material as { video_id?: string; image_id?: string; title: string; call_to_action: string; landing_page_url: string },
          creative_type: c.creative_type as string | undefined,
          ad_format: c.ad_format as string | undefined,
          identity_id: c.identity_id as string | undefined,
          identity_type: c.identity_type as string | undefined,
        })),
        adFormat: params.adFormat as string | undefined,
        creativeMaterialMode: params.creativeMaterialMode as string | undefined,
        displayMode: params.displayMode as string | undefined,
        operationStatus: params.operationStatus as string | undefined,
      });
      return {
        ok: true, provider: 'tiktok',
        data: { operation: 'create_ad', status: 'executed', executed: true, id: result.ad_id ?? '', preview: {}, response: result as unknown as Record<string, unknown> },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async pauseAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.adStatusUpdate(request, 'DISABLE');
  }

  async resumeAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.adStatusUpdate(request, 'ENABLE');
  }

  async pauseAdSet(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.writeNotImplemented();
  }

  async resumeAdSet(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.writeNotImplemented();
  }

  async archiveAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ArchiveAdResult>> {
    const adId = String(request.params.adId ?? '') || undefined;
    const preview: Record<string, unknown> = { status: 'DELETE' };
    const dryRun = request.params.dryRun !== false;
    const confirmed = request.params.confirmed === true;

    if (dryRun) {
      return {
        ok: true,
        provider: 'tiktok',
        data: { operation: 'archive_ad', status: 'dry_run', executed: false, preview, success: false, id: adId },
      };
    }

    if (!confirmed) {
      return {
        ok: true,
        provider: 'tiktok',
        data: {
          operation: 'archive_ad',
          status: 'pending_confirmation',
          executed: false,
          preview,
          success: false,
          id: adId,
          error:
            'Explicit confirmation is required after reviewing the dry-run preview — archiving is permanent and cannot be undone via the API.',
        },
      };
    }

    const r = await this.adStatusUpdate(request, 'DELETE');
    return {
      ok: r.ok,
      provider: 'tiktok',
      data: {
        operation: 'archive_ad',
        status: r.ok ? 'executed' as const : 'failed' as const,
        executed: r.ok,
        preview,
        success: r.ok,
        id: r.data?.id ?? adId,
        error: !r.ok ? 'Failed to archive ad' : undefined,
      },
    };
  }

  async cloneUiAd(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<CloneUiAdResult>> {
    return Promise.resolve(this.writeNotImplemented() as unknown as AdsBrokerResponse<CloneUiAdResult>);
  }

  async cloneAdSet(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<CloneAdSetResult>> {
    return Promise.resolve(this.writeNotImplemented() as unknown as AdsBrokerResponse<CloneAdSetResult>);
  }

  private async adStatusUpdate(request: AdsBrokerRequest, status: 'ENABLE' | 'DISABLE' | 'DELETE'): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    const adId = String(request.params.adId ?? '');
    if (!adId) {
      return { ok: false, provider: 'tiktok', errors: [{ provider: 'tiktok', code: 'MISSING_AD_ID', message: 'adId is required' }] };
    }
    try {
      await updateTikTokAdStatus(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        adId,
        status: status as 'ENABLE' | 'DISABLE' | 'DELETE',
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: adId, operation: status === 'ENABLE' ? 'resume_ad' : status === 'DELETE' ? 'archive_ad' : 'pause_ad' } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async getTargetingOptions(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<GetTargetingOptionsResult>> {
    return this.writeNotImplemented();
  }

  async createEcommerceCampaignBundle(request: AdsBrokerRequest): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    if (!this.client) return this.writeNotImplemented();
    const params = request.params;
    const platform = String(params.platform ?? 'tiktok_gmv');

    try {
      if (platform === 'smart_plus') {
        const campaign = await createSmartPlusCampaign(this.client, {
          advertiserId: String(params.advertiserId ?? request.accountId ?? ''),
          campaignName: String(params.campaignName ?? ''),
          objectiveType: String(params.objectiveType ?? ''),
          budget: Number(params.budget ?? 0),
          budgetMode: String(params.budgetMode ?? 'DAILY'),
          operationStatus: String(params.operationStatus ?? 'ENABLE'),
        });
        return { ok: true, provider: 'tiktok', data: { operation: 'create_ecommerce_campaign_bundle', status: 'executed', executed: true, preview: { campaign: {}, adSet: {}, creative: {}, ad: {} }, warnings: [], ids: { campaignId: campaign.campaign_id }, responses: { campaign: campaign as unknown as Record<string, unknown> } } };
      }

      // Default: create GMV Max campaign
      const result = await createGmvMaxCampaign(this.client, {
        advertiserId: String(params.advertiserId ?? request.accountId ?? ''),
        campaignName: String(params.campaignName ?? ''),
        objectiveType: String(params.objectiveType ?? ''),
        storeIds: Array.isArray(params.storeIds) ? params.storeIds.map(String) : [],
        budget: params.budget as number | undefined,
        budgetMode: String(params.budgetMode ?? 'DAILY'),
        scheduleType: params.scheduleType as string | undefined,
        scheduleStartTime: params.scheduleStartTime as string | undefined,
        operationStatus: String(params.operationStatus ?? 'ENABLE'),
      });
      return { ok: true, provider: 'tiktok', data: { operation: 'create_ecommerce_campaign_bundle', status: 'executed', executed: true, preview: { campaign: {}, adSet: {}, creative: {}, ad: {} }, warnings: [], ids: { campaignId: result.campaign_id }, responses: { campaign: result as unknown as Record<string, unknown> } } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  // ── TikTok GMV Max specific methods ──

  async gmvMaxCreateCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    if (!this.client) return this.writeNotImplemented();
    const params = request.params;
    try {
      const result = await createGmvMaxCampaign(this.client, {
        advertiserId: String(params.advertiserId ?? request.accountId ?? ''),
        campaignName: String(params.campaignName ?? ''),
        objectiveType: String(params.objectiveType ?? ''),
        storeIds: Array.isArray(params.storeIds) ? params.storeIds.map(String) : [],
        budget: params.budget as number | undefined,
        budgetMode: String(params.budgetMode ?? 'DAILY'),
        scheduleType: params.scheduleType as string | undefined,
        scheduleStartTime: params.scheduleStartTime as string | undefined,
        operationStatus: String(params.operationStatus ?? 'ENABLE'),
      });
      return { ok: true, provider: 'tiktok', data: { operation: 'create_ecommerce_campaign_bundle', status: 'executed', executed: true, preview: { campaign: {}, adSet: {}, creative: {}, ad: {} }, warnings: [], ids: { campaignId: result.campaign_id }, responses: { campaign: result as unknown as Record<string, unknown> } } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async gmvMaxUpdateCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      const result = await updateGmvMaxCampaign(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignId: String(request.params.campaignId ?? ''),
        campaignName: request.params.campaignName as string | undefined,
        budget: request.params.budget as number | undefined,
        operationStatus: request.params.operationStatus as string | undefined,
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: String(request.params.campaignId ?? ''), operation: 'gmv_max_update_campaign', response: result as unknown as Record<string, unknown> } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async gmvMaxCreateSession(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      const result = await createGmvMaxSession(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignId: String(request.params.campaignId ?? ''),
        sessionName: String(request.params.sessionName ?? ''),
        startTime: String(request.params.startTime ?? ''),
        endTime: String(request.params.endTime ?? ''),
        sessionType: request.params.sessionType as string | undefined,
        sessionBudget: request.params.sessionBudget as number | undefined,
        productIds: Array.isArray(request.params.productIds) ? request.params.productIds.map(String) : undefined,
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: result.session_id ?? '', operation: 'gmv_max_create_session', response: result as unknown as Record<string, unknown> } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async gmvMaxUpdateSession(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      const result = await updateGmvMaxSession(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        sessionId: String(request.params.sessionId ?? ''),
        sessionName: request.params.sessionName as string | undefined,
        sessionBudget: request.params.sessionBudget as number | undefined,
        startTime: request.params.startTime as string | undefined,
        endTime: request.params.endTime as string | undefined,
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: String(request.params.sessionId ?? ''), operation: 'gmv_max_update_session', response: result as unknown as Record<string, unknown> } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async gmvMaxDeleteSession(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      await deleteGmvMaxSession(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        sessionId: String(request.params.sessionId ?? ''),
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: String(request.params.sessionId ?? ''), operation: 'gmv_max_delete_session' } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async gmvMaxGetCampaignInfo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<Record<string, unknown>[]>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      const campaignIds = Array.isArray(request.params.campaignIds) ? request.params.campaignIds.map(String) : [];
      const result = await getGmvMaxCampaignInfo(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignIds,
      });
      return { ok: true, provider: 'tiktok', data: result as unknown as Record<string, unknown>[] };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  // ── TikTok Smart Plus specific methods ──

  async smartPlusCreateCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      const result = await createSmartPlusCampaign(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignName: String(request.params.campaignName ?? ''),
        objectiveType: String(request.params.objectiveType ?? ''),
        budget: Number(request.params.budget ?? 0),
        budgetMode: String(request.params.budgetMode ?? 'DAILY'),
        operationStatus: String(request.params.operationStatus ?? 'ENABLE'),
      });
      return { ok: true, provider: 'tiktok', data: { operation: 'create_ecommerce_campaign_bundle', status: 'executed', executed: true, preview: { campaign: {}, adSet: {}, creative: {}, ad: {} }, warnings: [], ids: { campaignId: result.campaign_id }, responses: { campaign: result as unknown as Record<string, unknown> } } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async smartPlusPauseCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.smartPlusCampaignStatus(request, 'DISABLE');
  }

  async smartPlusResumeCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.smartPlusCampaignStatus(request, 'ENABLE');
  }

  private async smartPlusCampaignStatus(request: AdsBrokerRequest, status: 'ENABLE' | 'DISABLE'): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      await updateSmartPlusCampaignStatus(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignId: String(request.params.campaignId ?? ''),
        status,
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: String(request.params.campaignId ?? ''), operation: status === 'ENABLE' ? 'smart_plus_resume_campaign' : 'smart_plus_pause_campaign' } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async smartPlusCreateAdGroup(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdSetResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      const result = await createSmartPlusAdGroup(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        campaignId: String(request.params.campaignId ?? ''),
        adgroupName: String(request.params.name ?? request.params.adgroupName ?? ''),
        budget: Number(request.params.budget ?? 0),
        budgetMode: String(request.params.budgetMode ?? 'DAILY'),
        operationStatus: String(request.params.operationStatus ?? 'ENABLE'),
        landingPageUrl: String(request.params.landingPageUrl ?? ''),
        identityId: request.params.identityId as string | undefined,
        identityType: request.params.identityType as string | undefined,
      });
      return { ok: true, provider: 'tiktok', data: { operation: 'create_adset', status: 'executed', executed: true, id: result.adgroup_id ?? '', preview: {}, response: result as unknown as Record<string, unknown> } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async smartPlusPauseAdGroup(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.smartPlusAdGroupStatus(request, 'DISABLE');
  }

  async smartPlusResumeAdGroup(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.smartPlusAdGroupStatus(request, 'ENABLE');
  }

  private async smartPlusAdGroupStatus(request: AdsBrokerRequest, status: 'ENABLE' | 'DISABLE' | 'DELETE'): Promise<AdsBrokerResponse<AdsMutationResult>> {
    if (!this.client) return this.writeNotImplemented();
    try {
      await updateSmartPlusAdGroupStatus(this.client, {
        advertiserId: String(request.accountId ?? request.credentials?.accountId ?? ''),
        adgroupId: String(request.params.adgroupId ?? ''),
        status: status as 'ENABLE' | 'DISABLE' | 'DELETE',
      });
      return { ok: true, provider: 'tiktok', data: { success: true, id: String(request.params.adgroupId ?? ''), operation: status === 'ENABLE' ? 'smart_plus_resume_adgroup' : status === 'DELETE' ? 'smart_plus_delete_adgroup' : 'smart_plus_pause_adgroup' } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async uploadImage(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<ImageUploadResult>> {
    return this.writeNotImplemented();
  }

  async uploadVideo(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoUploadResult>> {
    return this.writeNotImplemented();
  }

  async getAccountInfo(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AccountInfoResult>> {
    return this.writeNotImplemented();
  }

  async listAdImages(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdImageResult[]>> {
    return Promise.resolve(this.notImplemented('TikTok ad image library is not implemented yet') as unknown as AdsBrokerResponse<AdImageResult[]>);
  }

  async listAdVideos(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdVideoResult[]>> {
    return Promise.resolve(this.notImplemented('TikTok ad video library is not implemented yet') as unknown as AdsBrokerResponse<AdVideoResult[]>);
  }

  async getAdPreview(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdPreviewResult[]>> {
    return Promise.resolve(this.notImplemented('TikTok ad preview is not implemented yet') as unknown as AdsBrokerResponse<AdPreviewResult[]>);
  }

  private writeNotImplemented(): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'tiktok',
      errors: [
        {
          provider: 'tiktok',
          code: 'NOT_IMPLEMENTED',
          message: 'Write operations are not implemented for TikTok Ads yet',
        },
      ],
    };
  }
}

function parsePage(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getTikTokNextCursor(pageInfo: { page: number; total_page: number } | undefined): string | null {
  if (!pageInfo || pageInfo.page >= pageInfo.total_page) return null;
  return String(pageInfo.page + 1);
}
