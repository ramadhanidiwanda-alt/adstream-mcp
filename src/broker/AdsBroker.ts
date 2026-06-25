import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsMutationResult,
  AdsProviderAdapter,
  AdsProviderId,
  CredentialContext,
  PermissionPolicy,
} from './types.js';
import { defaultDenyWritePermissionPolicy, isAdsProviderId } from './types.js';
import type { CredentialResolverContract } from './credentials.js';
import { redactErrorMessage, redactTokenLikeValues } from './credentials.js';
import type { ProviderRegistry } from './providerRegistry.js';

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
  | 'getCreativePerformance';

type AdapterWriteMethod =
  | 'pauseCampaign'
  | 'resumeCampaign'
  | 'updateCampaignBudget'
  | 'renameCampaign';

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

  async generateReport(request: AdsBrokerRequest): Promise<AdsBrokerResponse<never>> {
    const provider = this.resolveProviderId(request);
    if (!provider.ok) return provider.response;

    if (this.isMultiProviderRequest(request)) {
      return this.notImplementedResponse('Cross-provider report generation is not implemented yet');
    }

    return this.notImplementedResponse('AdsBroker report generation is not implemented yet', provider.provider);
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

    if (!this.permissionPolicy.canRead(credential.credential)) {
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
    return this.executeWrite(request, 'pauseCampaign');
  }

  resumeCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite(request, 'resumeCampaign');
  }

  updateCampaignBudget(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite(request, 'updateCampaignBudget');
  }

  renameCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite(request, 'renameCampaign');
  }

  private async executeWrite(
    request: AdsBrokerRequest,
    method: AdapterWriteMethod
  ): Promise<AdsBrokerResponse<AdsMutationResult>> {
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

    if (!this.permissionPolicy.canWrite(credential.credential)) {
      return this.errorResponse(provider.provider, 'WRITE_NOT_ALLOWED', 'Write operation is not allowed by the current permission policy');
    }

    const adapter = this.getAdapter(provider.provider);
    if (!adapter.ok) return adapter.response;

    try {
      const adapterRequest = this.withCredential(request, provider.provider, credential.credential);
      const response = await adapter.adapter[method](adapterRequest);
      return this.sanitizeResponse(response as AdsBrokerResponse<AdsMutationResult>);
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
