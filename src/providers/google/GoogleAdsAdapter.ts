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
import { normalizeGoogleAdsRows, type GoogleAdsRow } from './normalizer.js';

export interface GoogleAdsApiClient {
  listAccessibleCustomers(): Promise<unknown[]>;
  search(customerId: string, query: string): Promise<unknown[]>;
}

export interface GoogleAdsRestClientOptions {
  accessToken: string;
  developerToken: string;
  apiVersion?: string;
  loginCustomerId?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export interface GoogleAdsAdapterOptions {
  client?: GoogleAdsApiClient;
  clientFactory?: (request: AdsBrokerRequest) => GoogleAdsApiClient | undefined;
}

type GoogleReadLevel = 'account' | 'campaign' | 'adgroup' | 'ad';

export class GoogleAdsAdapter implements AdsProviderAdapter {
  readonly id = 'google' as const;
  readonly displayName = 'Google Ads';
  readonly capabilities = ADS_PROVIDER_CAPABILITY_MATRIX.google;

  constructor(private readonly options: GoogleAdsAdapterOptions = {}) {}

  async listAccounts(): Promise<AdsBrokerResponse<unknown[]>> {
    const client = this.getClient({ params: {} });
    if (!client) return this.notImplemented();

    try {
      const accounts = await client.listAccessibleCustomers();
      return { ok: true, provider: 'google', data: accounts, accounts };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async listCampaigns(request: AdsBrokerRequest): Promise<AdsBrokerResponse<unknown[]>> {
    return this.queryRows(request, 'campaign', buildListCampaignsQuery());
  }

  async getAccountPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'account');
  }

  async getCampaignPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'campaign');
  }

  async getAdsetOrAdgroupPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'adgroup');
  }

  async getAdPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.getPerformance(request, 'ad');
  }

  async getCreativePerformance(): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.notImplemented('Google creative performance is not implemented yet');
  }

  async getPlacementPerformance(): Promise<AdsBrokerResponse> {
    return this.notImplemented('Google placement performance is not implemented yet');
  }

  async getChangeHistory(): Promise<AdsBrokerResponse<AdsChangeHistoryEnvelope>> {
    return this.notImplemented('Google change history is not implemented yet');
  }

  async getVideoSource(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoSourceResult>> {
    return Promise.resolve(this.notImplemented('Google video source is not implemented yet') as unknown as AdsBrokerResponse<VideoSourceResult>);
  }

  async getAdCreativeMapping(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdCreativeMappingResult[]>> {
    return Promise.resolve(this.notImplemented('Google ad→creative mapping is not implemented yet') as unknown as AdsBrokerResponse<AdCreativeMappingResult[]>);
  }

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
    return this.notImplemented('Google Ads ecommerce launch bundle is not implemented yet');
  }

  async uploadImage(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<ImageUploadResult>> {
    return this.notImplemented('Google Ads image upload is not implemented yet');
  }

  async uploadVideo(_request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoUploadResult>> {
    return this.notImplemented('Google Ads video upload is not implemented yet');
  }

  private async getPerformance(
    request: AdsBrokerRequest,
    level: GoogleReadLevel
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    const validation = this.validatePerformanceRequest(request);
    if (!validation.ok) return validation.response;
    const client = this.getClient(request);
    if (!client) return this.notImplemented();

    try {
      const rows = await client.search(validation.accountId, buildPerformanceQuery(level, validation));
      return {
        ok: true,
        provider: 'google',
        data: normalizeGoogleAdsRows(rows as GoogleAdsRow[], {
          level,
          accountId: validation.accountId,
          since: validation.since,
          until: validation.until,
        }),
        meta: { nextCursor: null },
      };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private async queryRows(
    request: AdsBrokerRequest,
    level: GoogleReadLevel,
    query: string
  ): Promise<AdsBrokerResponse<unknown[]>> {
    const accountId = request.accountId ?? request.credentials?.accountId;
    if (!accountId) {
      return {
        ok: false,
        provider: 'google',
        errors: [{ provider: 'google', code: 'MISSING_ACCOUNT_ID', message: 'accountId is required for Google Ads requests' }],
      };
    }
    const client = this.getClient(request);
    if (!client) return this.notImplemented();

    try {
      const rows = await client.search(accountId, query);
      return { ok: true, provider: 'google', data: rows, meta: { level } };
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  private validatePerformanceRequest(request: AdsBrokerRequest):
    | { ok: true; accountId: string; since: string; until: string }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const accountId = request.accountId ?? request.credentials?.accountId;
    if (!accountId || !request.since || !request.until) {
      return {
        ok: false,
        response: {
          ok: false,
          provider: 'google',
          errors: [
            {
              provider: 'google',
              code: 'MISSING_REQUIRED_PARAMS',
              message: 'Google Ads performance requests require accountId, since, and until',
            },
          ],
        },
      };
    }

    return { ok: true, accountId, since: request.since, until: request.until };
  }

  private getClient(request: AdsBrokerRequest): GoogleAdsApiClient | undefined {
    if (this.options.client) return this.options.client;
    if (this.options.clientFactory) return this.options.clientFactory(request);

    const accessToken = request.credentials?.accessToken;
    const developerToken = typeof request.params.developerToken === 'string'
      ? request.params.developerToken
      : process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!accessToken || !developerToken) return undefined;

    return new GoogleAdsRestClient({
      accessToken,
      developerToken,
      apiVersion: request.credentials?.apiVersion ?? process.env.GOOGLE_ADS_API_VERSION,
      loginCustomerId: typeof request.params.loginCustomerId === 'string'
        ? request.params.loginCustomerId
        : process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    });
  }

  private notImplemented(message = 'Google Ads adapter requires a client to be configured'): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'google',
      errors: [{ provider: 'google', code: 'NOT_IMPLEMENTED', message }],
    };
  }

  private writeNotImplemented(): AdsBrokerResponse<AdsMutationResult> {
    return {
      ok: false,
      provider: 'google',
      errors: [{ provider: 'google', code: 'WRITE_NOT_IMPLEMENTED', message: 'Google Ads write operations are not implemented yet' }],
    };
  }

  private errorResponse(error: unknown): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'google',
      errors: [
        {
          provider: 'google',
          code: 'GOOGLE_ADS_ADAPTER_ERROR',
          message: redactErrorMessage(error instanceof Error ? error.message : String(error)),
        },
      ],
    };
  }
}

export class GoogleAdsRestClient implements GoogleAdsApiClient {
  private readonly accessToken: string;
  private readonly developerToken: string;
  private readonly apiVersion: string;
  private readonly loginCustomerId?: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GoogleAdsRestClientOptions) {
    this.accessToken = options.accessToken;
    this.developerToken = options.developerToken;
    this.apiVersion = options.apiVersion ?? 'v24';
    this.loginCustomerId = options.loginCustomerId;
    this.baseUrl = options.baseUrl ?? 'https://googleads.googleapis.com';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async listAccessibleCustomers(): Promise<unknown[]> {
    const response = await this.request<{ resourceNames?: string[] }>('/customers:listAccessibleCustomers', {
      method: 'GET',
    });
    return (response.resourceNames ?? []).map((resourceName) => ({ resourceName }));
  }

  async search(customerId: string, query: string): Promise<unknown[]> {
    const response = await this.request<Array<{ results?: unknown[] }>>(
      `/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      }
    );

    return response.flatMap((chunk) => chunk.results ?? []);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}/${this.apiVersion}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.accessToken}`,
        'developer-token': this.developerToken,
        ...(this.loginCustomerId ? { 'login-customer-id': this.loginCustomerId } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Google Ads API error ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }
}

function buildPerformanceQuery(level: GoogleReadLevel, range: { since: string; until: string }): string {
  const fields = [
    'customer.id',
    'customer.descriptive_name',
    'customer.currency_code',
    'metrics.cost_micros',
    'metrics.impressions',
    'metrics.clicks',
    'metrics.ctr',
    'metrics.average_cpc',
    'metrics.average_cpm',
    'metrics.conversions',
    'metrics.conversions_value',
  ];

  if (level !== 'account') fields.push('campaign.id', 'campaign.name', 'campaign.status', 'campaign.advertising_channel_type');
  if (level === 'adgroup' || level === 'ad') fields.push('ad_group.id', 'ad_group.name', 'ad_group.status');
  if (level === 'ad') fields.push('ad_group_ad.ad.id', 'ad_group_ad.ad.name', 'ad_group_ad.status');

  return `SELECT ${fields.join(', ')} FROM ${resourceForLevel(level)} WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`;
}

function buildListCampaignsQuery(): string {
  return 'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign';
}

function resourceForLevel(level: GoogleReadLevel): string {
  if (level === 'ad') return 'ad_group_ad';
  if (level === 'adgroup') return 'ad_group';
  return 'campaign';
}
