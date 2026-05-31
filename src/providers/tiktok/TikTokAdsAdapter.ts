import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsProviderAdapter,
  AdsProviderCapabilities,
} from '../../broker/types.js';
import { redactErrorMessage } from '../../broker/credentials.js';
import { normalizeTikTokInsights, type TikTokInsightRecord } from './normalizer.js';

export interface TikTokAdsAdapterMockData {
  accounts?: unknown[];
  campaigns?: TikTokInsightRecord[];
  adgroups?: TikTokInsightRecord[];
  ads?: TikTokInsightRecord[];
  creatives?: TikTokInsightRecord[];
}

export interface TikTokAdsAdapterOptions {
  mockData?: TikTokAdsAdapterMockData;
}

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

  async listAccounts(): Promise<AdsBrokerResponse<unknown[]>> {
    if (!this.options.mockData?.accounts) {
      return this.notImplemented();
    }

    return { ok: true, provider: 'tiktok', data: this.options.mockData.accounts };
  }

  async getCampaignPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getMockPerformance(request, 'campaign', this.options.mockData?.campaigns);
  }

  async getAdsetOrAdgroupPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getMockPerformance(request, 'adgroup', this.options.mockData?.adgroups);
  }

  async getAdPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getMockPerformance(request, 'ad', this.options.mockData?.ads);
  }

  async getCreativePerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getMockPerformance(request, 'creative', this.options.mockData?.creatives);
  }

  private async getMockPerformance(
    request: AdsBrokerRequest,
    level: 'campaign' | 'adgroup' | 'ad' | 'creative',
    mockData: TikTokInsightRecord[] | undefined
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    if (!mockData) {
      return this.notImplemented();
    }

    try {
      const accountId = request.accountId ?? request.credentials?.accountId;
      if (!accountId || !request.since || !request.until) {
        return {
          ok: false,
          provider: 'tiktok',
          errors: [
            {
              provider: 'tiktok',
              code: 'MISSING_REQUIRED_PARAMS',
              message: 'TikTok mock performance requests require accountId, since, and until',
            },
          ],
        };
      }

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
  }

  private notImplemented(): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'tiktok',
      errors: [
        {
          provider: 'tiktok',
          code: 'NOT_IMPLEMENTED',
          message: 'TikTok Ads adapter is not implemented yet',
        },
      ],
    };
  }
}
