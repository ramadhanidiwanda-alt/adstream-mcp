import { MetaClient } from '../../metaClient.js';
import { getAdAccounts } from '../../tools/getAdAccounts.js';
import { getAdsInsights } from '../../tools/getAdsInsights.js';
import { getAdsetInsights } from '../../tools/getAdsetInsights.js';
import { getCampaignInsights } from '../../tools/getCampaignInsights.js';
import type { AdAccount, AdInsight, AdsetInsight, CampaignInsight, MetaConfig } from '../../types.js';
import type { LocationBreakdown } from '../../types.js';
import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsProviderCapabilities,
  AdsProviderAdapter,
  CredentialContext,
} from '../../broker/types.js';
import { redactErrorMessage } from '../../broker/credentials.js';
import { assertLocationBreakdowns } from '../../utils/locationBreakdowns.js';
import { normalizeMetaInsights } from './normalizer.js';

export interface MetaAdsAdapterTools {
  getAdAccounts(client: MetaClient, options?: { limit?: number }): Promise<AdAccount[]>;
  getCampaignInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: LocationBreakdown[] }
  ): Promise<CampaignInsight[]>;
  getAdsetInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: LocationBreakdown[] }
  ): Promise<AdsetInsight[]>;
  getAdsInsights(
    client: MetaClient,
    options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: LocationBreakdown[] }
  ): Promise<AdInsight[]>;
}

export interface MetaAdsAdapterOptions {
  clientFactory?: (config: MetaConfig) => MetaClient;
  tools?: Partial<MetaAdsAdapterTools>;
}

export class MetaAdsAdapter implements AdsProviderAdapter {
  readonly id = 'meta' as const;
  readonly displayName = 'Meta Ads';
  readonly capabilities: AdsProviderCapabilities = {
    providers: ['meta'],
    categories: ['accounts', 'campaigns', 'ad_groups', 'ads', 'creatives', 'insights', 'reports', 'diagnostics'],
    operations: ['read'],
    supportsRaw: false,
  };

  private readonly clientFactory: (config: MetaConfig) => MetaClient;
  private readonly tools: MetaAdsAdapterTools;

  constructor(options: MetaAdsAdapterOptions = {}) {
    this.clientFactory = options.clientFactory ?? ((config) => new MetaClient(config));
    this.tools = {
      getAdAccounts,
      getCampaignInsights,
      getAdsetInsights,
      getAdsInsights,
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

  async getCreativePerformance(): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return {
      ok: false,
      provider: 'meta',
      errors: [
        {
          provider: 'meta',
          code: 'NOT_IMPLEMENTED',
          message: 'Meta creative performance is not implemented in the MVP adapter yet',
        },
      ],
    };
  }

  private async getPerformance(
    request: AdsBrokerRequest,
    level: 'campaign' | 'adset' | 'ad'
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
      });

      return { ok: true, provider: 'meta', data };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private fetchInsights(
    client: MetaClient,
    level: 'campaign' | 'adset' | 'ad',
    options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: LocationBreakdown[] }
  ): Promise<Array<CampaignInsight | AdsetInsight | AdInsight>> {
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
    | { ok: true; options: { adAccountId: string; since: string; until: string; limit?: number; breakdowns?: LocationBreakdown[] } }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const adAccountId = request.accountId ?? credential.accountId;
    const since = request.since;
    const until = request.until;
    const limit = typeof request.params.limit === 'number' ? request.params.limit : undefined;
    let breakdowns: LocationBreakdown[] | undefined;

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

    return { ok: true, options: { adAccountId, since, until, limit, breakdowns } };
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
}
