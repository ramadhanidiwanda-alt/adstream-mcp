import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsChangeHistoryEnvelope,
  AdsMetricRecord,
  AdsMutationResult,
  EcommerceCampaignBundleResult,
  AdsProviderAdapter,
  VideoSourceResult,
  AdCreativeMappingResult,
  ImageUploadResult,
  VideoUploadResult,
} from '../../broker/types.js';
import { ADS_PROVIDER_CAPABILITY_MATRIX } from '../../broker/types.js';
import { redactErrorMessage } from '../../broker/credentials.js';
import { normalizeTikTokInsights, type TikTokInsightRecord } from './normalizer.js';
import type { TikTokApiClient } from '../../tiktokClient.js';
import { getTikTokReport } from '../../tools/getTikTokReport.js';
import { getTikTokAdvertisers } from '../../tools/getTikTokAdvertisers.js';
import { getTikTokCampaigns } from '../../tools/getTikTokCampaigns.js';
import type { TikTokCampaign } from '../../tools/getTikTokCampaigns.js';

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

  // --- Write Operations (not implemented for TikTok) ---

  async pauseCampaign(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.writeNotImplemented();
  }

  async resumeCampaign(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.writeNotImplemented();
  }

  async updateCampaignBudget(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.writeNotImplemented();
  }

  async renameCampaign(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.writeNotImplemented();
  }

  async createEcommerceCampaignBundle(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    return this.writeNotImplemented();
  }

  async uploadImage(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<ImageUploadResult>> {
    return this.writeNotImplemented();
  }

  async uploadVideo(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoUploadResult>> {
    return this.writeNotImplemented();
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
