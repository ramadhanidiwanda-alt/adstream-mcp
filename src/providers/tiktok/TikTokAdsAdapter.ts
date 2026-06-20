import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsMutationResult,
  AdsProviderAdapter,
  AdsProviderCapabilities,
  AdsToolCategory,
  AdsToolDefinition,
  CredentialContext,
} from '../../broker/types.js';
import { redactErrorMessage } from '../../broker/credentials.js';
import { normalizeTikTokInsights, type TikTokInsightRecord } from './normalizer.js';
import type { TikTokApiClient } from '../../tiktokClient.js';
import { getTikTokReport, type TikTokDataLevel } from '../../tools/getTikTokReport.js';
import { getTikTokAdvertisers } from '../../tools/getTikTokAdvertisers.js';

export interface TikTokAdsAdapterMockData {
  accounts?: unknown[];
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

const LEVEL_TO_DATA_LEVEL: Record<string, TikTokDataLevel> = {
  campaign: 'AUCTION_CAMPAIGN',
  adgroup: 'AUCTION_ADGROUP',
  ad: 'AUCTION_AD',
};

export class TikTokAdsAdapter implements AdsProviderAdapter {
  readonly id = 'tiktok' as const;
  readonly displayName = 'TikTok Ads';
  readonly capabilities: AdsProviderCapabilities = {
    providers: ['tiktok'],
    categories: ['accounts', 'campaigns', 'ad_groups', 'ads', 'creatives', 'insights', 'reports', 'diagnostics'],
    operations: ['read'],
    supportsRaw: false,
  };

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

  private async getPerformance(
    request: AdsBrokerRequest,
    level: 'campaign' | 'adgroup' | 'ad' | 'creative',
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
        const dataLevel = level === 'campaign' ? 'AUCTION_CAMPAIGN'
          : level === 'adgroup' ? 'AUCTION_ADGROUP'
          : level === 'ad' ? 'AUCTION_AD'
          : 'AUCTION_CAMPAIGN';

        const report = await getTikTokReport(this.client, {
          advertiserId: accountId,
          reportType: 'BASIC',
          dimensions: [
            level === 'ad' ? 'ad_id' : level === 'adgroup' ? 'adgroup_id' : 'campaign_id',
          ],
          metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions', 'conversion_value'],
          dataLevel,
          startDate: request.since,
          endDate: request.until,
        });

        const records: TikTokInsightRecord[] = report.list.map((row) => ({
          advertiser_id: accountId,
          campaign_id: row.dimensions.campaign_id,
          adgroup_id: row.dimensions.adgroup_id,
          ad_id: row.dimensions.ad_id,
          spend: row.metrics.spend,
          impressions: row.metrics.impressions,
          clicks: row.metrics.clicks,
          ctr: row.metrics.ctr,
          cpc: row.metrics.cpc,
          cpm: row.metrics.cpm,
          conversions: row.metrics.conversions,
          conversion_value: row.metrics.conversion_value,
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

  private notImplemented(): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'tiktok',
      errors: [
        {
          provider: 'tiktok',
          code: 'NOT_IMPLEMENTED',
          message: 'TikTok Ads adapter requires a client or mock data to be configured',
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
