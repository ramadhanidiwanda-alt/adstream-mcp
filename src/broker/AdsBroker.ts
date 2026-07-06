import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsContentMatrix,
  AdsContentMatrixGroupBy,
  AdsContentMatrixSortDirection,
  AdsMetricRecord,
  AdsMutationResult,
  EcommerceCampaignBundleResult,
  AdsReport,
  AdsMultiProviderReport,
  AdsProviderReportError,
  AdsProviderAdapter,
  AdsProviderId,
  CredentialContext,
  PermissionPolicy,
} from './types.js';
import { defaultDenyWritePermissionPolicy, isAdsProviderId } from './types.js';
import type { CredentialResolverContract } from './credentials.js';
import { redactErrorMessage, redactTokenLikeValues } from './credentials.js';
import type { ProviderRegistry } from './providerRegistry.js';
import { buildAdsSummaryReport, buildCrossProviderReport } from './reportEngine.js';
import { buildAdsContentMatrix } from './contentMatrix.js';

export interface AdsBrokerOptions {
  providerRegistry: ProviderRegistry;
  credentialResolver: CredentialResolverContract;
  permissionPolicy?: PermissionPolicy;
  defaultProvider?: AdsProviderId;
}

type AdapterMethod =
  | 'listAccounts'
  | 'listCampaigns'
  | 'getAccountPerformance'
  | 'getCampaignPerformance'
  | 'getAdsetOrAdgroupPerformance'
  | 'getAdPerformance'
  | 'getCreativePerformance'
  | 'getPlacementPerformance';

type AdapterWriteMethod =
  | 'pauseCampaign'
  | 'resumeCampaign'
  | 'updateCampaignBudget'
  | 'renameCampaign'
  | 'createEcommerceCampaignBundle';

export class AdsBroker {
  private readonly providerRegistry: ProviderRegistry;
  private readonly credentialResolver: CredentialResolverContract;
  private readonly permissionPolicy: PermissionPolicy;
  private readonly defaultProvider: AdsProviderId;

  constructor(options: AdsBrokerOptions) {
    this.providerRegistry = options.providerRegistry;
    this.credentialResolver = options.credentialResolver;
    this.permissionPolicy = options.permissionPolicy ?? defaultDenyWritePermissionPolicy;
    this.defaultProvider = options.defaultProvider ?? 'meta';
  }

  listAccounts(request: AdsBrokerRequest): Promise<AdsBrokerResponse> {
    return this.executeRead(request, 'listAccounts');
  }

  listCampaigns(request: AdsBrokerRequest): Promise<AdsBrokerResponse> {
    return this.executeRead(request, 'listCampaigns');
  }

  getAccountPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.executeRead(request, 'getAccountPerformance');
  }

  getCampaignPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.executeRead(request, 'getCampaignPerformance');
  }

  getAdsetOrAdgroupPerformance(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.executeRead(request, 'getAdsetOrAdgroupPerformance');
  }

  getAdPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.executeRead(request, 'getAdPerformance');
  }

  getCreativePerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.executeRead(request, 'getCreativePerformance');
  }

  getPlacementPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse> {
    return this.executeRead(request, 'getPlacementPerformance');
  }

  async getContentMatrix(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsContentMatrix>> {
    const provider = this.resolveProviderId(request);
    if (!provider.ok) return provider.response;

    const performance = await this.getAdPerformance(request);
    if (!performance.ok) {
      return {
        ok: false,
        provider: performance.provider,
        errors: performance.errors,
      };
    }

    return {
      ok: true,
      provider: provider.provider,
      data: buildAdsContentMatrix(performance.data ?? [], {
        provider: provider.provider,
        since: request.since ?? '',
        until: request.until ?? '',
        groupBy: parseGroupBy(request.params.groupBy),
        sortBy: typeof request.params.sortBy === 'string' ? request.params.sortBy : undefined,
        sortDirection: parseSortDirection(request.params.sortDirection),
        topLimit: typeof request.params.topLimit === 'number' ? request.params.topLimit : undefined,
        bottomLimit: typeof request.params.bottomLimit === 'number' ? request.params.bottomLimit : undefined,
        includeAllRows: request.params.includeAllRows === true,
        comparisonMode: request.params.comparisonMode === 'none' ? 'none' : 'previous_period',
      }),
    };
  }

  async generateReport(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsReport | AdsMultiProviderReport>> {
    const provider = this.resolveProviderId(request);
    if (!provider.ok) return provider.response;

    const reportLevel = request.params.level === 'campaign' ? 'campaign' : 'account';

    if (this.isMultiProviderRequest(request)) {
      return this.generateCrossProviderReport(request, reportLevel);
    }

    const performance = reportLevel === 'campaign'
      ? await this.getCampaignPerformance(request)
      : await this.getAccountPerformance(request);
    if (!performance.ok) {
      return {
        ok: false,
        provider: performance.provider,
        errors: performance.errors,
      };
    }

    return {
      ok: true,
      provider: provider.provider,
      data: buildAdsSummaryReport(provider.provider, performance.data ?? [], request, reportLevel),
    };
  }

  private async generateCrossProviderReport(
    request: AdsBrokerRequest,
    reportLevel: 'account' | 'campaign'
  ): Promise<AdsBrokerResponse<AdsMultiProviderReport>> {
    const providers = (request.providers ?? []).filter(isAdsProviderId);
    const perProvider: AdsReport[] = [];
    const errors: AdsProviderReportError[] = [];

    for (const providerId of providers) {
      const singleRequest: AdsBrokerRequest = {
        ...request,
        provider: providerId,
        providers: undefined,
      };

      const performance = reportLevel === 'campaign'
        ? await this.getCampaignPerformance(singleRequest)
        : await this.getAccountPerformance(singleRequest);

      if (!performance.ok) {
        for (const error of performance.errors ?? []) {
          errors.push({
            provider: error.provider ?? providerId,
            code: error.code ?? 'PROVIDER_REPORT_ERROR',
            message: error.message,
          });
        }
        continue;
      }

      perProvider.push(
        buildAdsSummaryReport(providerId, performance.data ?? [], singleRequest, reportLevel)
      );
    }

    if (perProvider.length === 0) {
      return { ok: false, errors };
    }

    const report = buildCrossProviderReport(perProvider, request, reportLevel);
    return {
      ok: true,
      data: { ...report, errors: errors.length ? errors : undefined },
    };
  }

  private async executeRead<TData>(
    request: AdsBrokerRequest,
    method: AdapterMethod
  ): Promise<AdsBrokerResponse<TData>> {
    const provider = this.resolveProviderId(request);
    if (!provider.ok) return provider.response;

    if (this.isMultiProviderRequest(request)) {
      return this.notImplementedResponse('Cross-provider broker requests are not implemented yet');
    }

    const credential = await this.credentialResolver.resolve({
      provider: provider.provider,
      accountId: request.accountId,
      connectionKey: request.connectionKey,
      oauthAuthContext: request.oauthAuthContext,
      params: request.params,
    });

    if (!credential.ok) {
      return this.errorResponse(provider.provider, credential.error.code, credential.error.message);
    }

    if (!this.permissionPolicy.canRead(credential.credential, request)) {
      return this.errorResponse(provider.provider, 'READ_NOT_ALLOWED', 'Read operation is not allowed');
    }

    const adapter = this.getAdapter(provider.provider);
    if (!adapter.ok) return adapter.response;

    try {
      const adapterRequest = this.withCredential(request, provider.provider, credential.credential);
      const response = await adapter.adapter[method](adapterRequest);
      return this.sanitizeResponse(response as AdsBrokerResponse<TData>);
    } catch (error) {
      return this.errorResponse(
        provider.provider,
        'BROKER_ADAPTER_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  pauseCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'pauseCampaign');
  }

  resumeCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'resumeCampaign');
  }

  updateCampaignBudget(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'updateCampaignBudget');
  }

  renameCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'renameCampaign');
  }

  createEcommerceCampaignBundle(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    return this.executeWrite<EcommerceCampaignBundleResult>(request, 'createEcommerceCampaignBundle');
  }

  private async executeWrite<TData extends AdsMutationResult | EcommerceCampaignBundleResult>(
    request: AdsBrokerRequest,
    method: AdapterWriteMethod
  ): Promise<AdsBrokerResponse<TData>> {
    const provider = this.resolveProviderId(request);
    if (!provider.ok) return provider.response;

    if (this.isMultiProviderRequest(request)) {
      return this.notImplementedResponse('Cross-provider write requests are not implemented yet');
    }

    const credential = await this.credentialResolver.resolve({
      provider: provider.provider,
      accountId: request.accountId,
      connectionKey: request.connectionKey,
      oauthAuthContext: request.oauthAuthContext,
      params: request.params,
    });

    if (!credential.ok) {
      return this.errorResponse(provider.provider, credential.error.code, credential.error.message);
    }

    if (!this.permissionPolicy.canWrite(credential.credential, request)) {
      return this.errorResponse(provider.provider, 'WRITE_NOT_ALLOWED', 'Write operation is not allowed by the current permission policy');
    }

    const adapter = this.getAdapter(provider.provider);
    if (!adapter.ok) return adapter.response;

    try {
      const adapterRequest = this.withCredential(request, provider.provider, credential.credential);
      const response = await adapter.adapter[method](adapterRequest);
      return this.sanitizeResponse(response as AdsBrokerResponse<TData>);
    } catch (error) {
      return this.errorResponse(
        provider.provider,
        'BROKER_ADAPTER_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private resolveProviderId(request: AdsBrokerRequest):
    | { ok: true; provider: AdsProviderId }
    | { ok: false; response: AdsBrokerResponse<never> } {
    const provider = request.provider ?? request.providers?.[0] ?? this.defaultProvider;

    if (!isAdsProviderId(provider)) {
      return {
        ok: false,
        response: this.errorResponse(undefined, 'UNSUPPORTED_PROVIDER', 'Unsupported ads provider'),
      };
    }

    return { ok: true, provider };
  }

  private isMultiProviderRequest(request: AdsBrokerRequest): boolean {
    return Array.isArray(request.providers) && request.providers.length > 1;
  }

  private getAdapter(provider: AdsProviderId):
    | { ok: true; adapter: AdsProviderAdapter }
    | { ok: false; response: AdsBrokerResponse<never> } {
    try {
      const adapter = this.providerRegistry.get(provider);
      if (!adapter) {
        return {
          ok: false,
          response: this.errorResponse(provider, 'PROVIDER_NOT_REGISTERED', 'Provider adapter is not registered'),
        };
      }

      return { ok: true, adapter };
    } catch (error) {
      return {
        ok: false,
        response: this.errorResponse(
          provider,
          'PROVIDER_REGISTRY_ERROR',
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  private withCredential(
    request: AdsBrokerRequest,
    provider: AdsProviderId,
    credential: CredentialContext
  ): AdsBrokerRequest {
    return {
      ...request,
      provider,
      credentials: credential,
      params: request.params ?? {},
    };
  }

  private sanitizeResponse<TData>(response: AdsBrokerResponse<TData>): AdsBrokerResponse<TData> {
    return stripRawFromResponse(redactTokenLikeValues(response)) as AdsBrokerResponse<TData>;
  }

  private errorResponse(
    provider: AdsProviderId | undefined,
    code: string,
    message: string
  ): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider,
      errors: [
        {
          provider,
          code,
          message: redactErrorMessage(message),
        },
      ],
    };
  }

  private notImplementedResponse(message: string, provider?: AdsProviderId): AdsBrokerResponse<never> {
    return this.errorResponse(provider, 'NOT_IMPLEMENTED', message);
  }
}

function parseGroupBy(value: unknown): AdsContentMatrixGroupBy | undefined {
  return value === 'campaign' || value === 'adset' ? value : undefined;
}

function parseSortDirection(value: unknown): AdsContentMatrixSortDirection | undefined {
  return value === 'asc' || value === 'desc' ? value : undefined;
}

function stripRawFromResponse<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripRawFromResponse(item)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => key !== 'raw')
      .map(([key, entryValue]) => [key, stripRawFromResponse(entryValue)]);

    return Object.fromEntries(entries) as T;
  }

  return value;
}
