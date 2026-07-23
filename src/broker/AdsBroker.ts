import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsChangeHistoryEnvelope,
  AdsContentMatrix,
  AdsContentMatrixGroupBy,
  AdsContentMatrixSortDirection,
  AdsMetricRecord,
  AdsMutationResult,
  AdDestinationResult,
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
  AdsReport,
  AdsMultiProviderReport,
  AdsProviderReportError,
  AdsProviderAdapter,
  AdsProviderId,
  CredentialContext,
  PermissionPolicy,
  VideoSourceResult,
  AdCreativeMappingResult,
  ImageUploadResult,
  VideoUploadResult,
  AccountInfoResult,
  AdImageResult,
  AdVideoResult,
  AdPreviewResult,
  MetaPageResult,
  MetaPixelResult,
  MetaCatalogResult,
  MetaProductSetResult,
  InstagramAccountResult,
  InstagramMediaResult,
  ThreadsProfileResult,
  WhatsAppAccountResult,
  WhatsAppPhoneNumberResult,
  WhatsAppTemplateResult,
  AdCreativeFullResult,
  AdSetFullResult,
} from './types.js';
import { defaultDenyWritePermissionPolicy, isAdsProviderId } from './types.js';
import type { LaunchReadinessResult } from '../tools/checkLaunchReadiness.js';
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
  | 'getPlacementPerformance'
  | 'getChangeHistory'
  | 'getVideoSource'
  | 'getAdCreativeMapping'
  | 'getAccountInfo'
  | 'listAdImages'
  | 'listAdVideos'
  | 'getAdPreview'
  | 'getTargetingOptions'
  | 'getAdDestinations'
  | 'readAdCreativeFull'
  | 'readAdSetFull';

type AdapterWriteMethod =
  | 'pauseCampaign'
  | 'resumeCampaign'
  | 'updateCampaignBudget'
  | 'renameCampaign'
  | 'createCampaign'
  | 'createAdSet'
  | 'createAdCreative'
  | 'createAd'
  | 'cloneUiAd'
  | 'archiveAd'
  | 'pauseAd'
  | 'resumeAd'
  | 'pauseAdSet'
  | 'resumeAdSet'
  | 'cloneAdSet'
  | 'updateAdSet'
  | 'updateAd'
  | 'updateCampaign'
  | 'createEcommerceCampaignBundle'
  | 'uploadImage'
  | 'uploadVideo';

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

  getChangeHistory(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsChangeHistoryEnvelope>> {
    return this.executeRead(request, 'getChangeHistory');
  }

  getVideoSource(request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoSourceResult>> {
    return this.executeRead(request, 'getVideoSource');
  }

  getAdCreativeMapping(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdCreativeMappingResult[]>> {
    return this.executeRead(request, 'getAdCreativeMapping');
  }

  getAdDestinations(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdDestinationResult[]>> {
    return this.executeRead(request, 'getAdDestinations');
  }

  readAdCreativeFull(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdCreativeFullResult>> {
    return this.executeRead<AdCreativeFullResult>(request, 'readAdCreativeFull');
  }

  readAdSetFull(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdSetFullResult>> {
    return this.executeRead<AdSetFullResult>(request, 'readAdSetFull');
  }

  getAccountInfo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AccountInfoResult>> {
    return this.executeRead(request, 'getAccountInfo');
  }

  listAdImages(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdImageResult[]>> {
    return this.executeRead(request, 'listAdImages');
  }

  listAdVideos(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdVideoResult[]>> {
    return this.executeRead(request, 'listAdVideos');
  }

  getAdPreview(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdPreviewResult[]>> {
    return this.executeRead(request, 'getAdPreview');
  }

  checkLaunchReadiness(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<LaunchReadinessResult>> {
    return this.callOptionalReadMethod(request, 'checkLaunchReadiness');
  }

  listPixels(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaPixelResult[]>> {
    return this.callOptionalReadMethod(request, 'listPixels');
  }

  listCatalogs(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaCatalogResult[]>> {
    return this.callOptionalReadMethod(request, 'listCatalogs');
  }

  listProductSets(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaProductSetResult[]>> {
    return this.callOptionalReadMethod(request, 'listProductSets');
  }

  listPages(request: AdsBrokerRequest): Promise<AdsBrokerResponse<MetaPageResult[]>> {
    return this.callOptionalReadMethod(request, 'listPages');
  }

  listInstagramAccounts(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<InstagramAccountResult[]>> {
    return this.callOptionalReadMethod(request, 'listInstagramAccounts');
  }

  listInstagramMedia(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<InstagramMediaResult[]>> {
    return this.callOptionalReadMethod(request, 'listInstagramMedia');
  }

  listThreadsProfiles(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<ThreadsProfileResult[]>> {
    return this.callOptionalReadMethod(request, 'listThreadsProfiles');
  }

  listWhatsAppAccounts(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<WhatsAppAccountResult[]>> {
    return this.callOptionalReadMethod(request, 'listWhatsAppAccounts');
  }

  listWhatsAppPhoneNumbers(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<WhatsAppPhoneNumberResult[]>> {
    return this.callOptionalReadMethod(request, 'listWhatsAppPhoneNumbers');
  }

  listWhatsAppMessageTemplates(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<WhatsAppTemplateResult[]>> {
    return this.callOptionalReadMethod(request, 'listWhatsAppMessageTemplates');
  }

  private async callOptionalReadMethod<TData>(
    request: AdsBrokerRequest,
    method: keyof Pick<
      AdsProviderAdapter,
      | 'checkLaunchReadiness'
      | 'listPixels'
      | 'listCatalogs'
      | 'listProductSets'
      | 'listPages'
      | 'listInstagramAccounts'
      | 'listInstagramMedia'
      | 'listThreadsProfiles'
      | 'listWhatsAppAccounts'
      | 'listWhatsAppPhoneNumbers'
      | 'listWhatsAppMessageTemplates'
    >
  ): Promise<AdsBrokerResponse<TData>> {
    const provider = this.resolveProviderId(request);
    if (!provider.ok) return provider.response;

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
      return this.errorResponse(
        provider.provider,
        'READ_NOT_ALLOWED',
        'Read operation is not allowed'
      );
    }

    const adapter = this.getAdapter(provider.provider);
    if (!adapter.ok) return adapter.response;

    const optionalMethod = adapter.adapter[method];
    if (!optionalMethod) {
      return this.errorResponse(
        provider.provider,
        'PROVIDER_METHOD_NOT_IMPLEMENTED',
        `${method} is not implemented for provider ${provider.provider}`
      );
    }

    try {
      const adapterRequest = this.withCredential(request, provider.provider, credential.credential);
      const callable = optionalMethod as (
        request: AdsBrokerRequest
      ) => Promise<AdsBrokerResponse<TData>>;
      const response = await callable.call(adapter.adapter, adapterRequest);
      return this.sanitizeResponse(response as AdsBrokerResponse<TData>);
    } catch (error) {
      return this.errorResponse(
        provider.provider,
        'BROKER_ADAPTER_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  getCapabilities(request: AdsBrokerRequest): AdsBrokerResponse<Record<string, unknown>> {
    const requestedProvider = request.provider;
    const adapters = this.providerRegistry
      .list()
      .filter((adapter) => !requestedProvider || adapter.id === requestedProvider);

    if (requestedProvider && adapters.length === 0) {
      return this.errorResponse(
        requestedProvider,
        'PROVIDER_NOT_REGISTERED',
        'Provider adapter is not registered'
      );
    }

    return {
      ok: true,
      provider: requestedProvider,
      data: {
        registeredProviders: adapters.map((adapter) => ({
          id: adapter.id,
          displayName: adapter.displayName,
          capabilities: adapter.capabilities,
        })),
      },
    };
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
        bottomLimit:
          typeof request.params.bottomLimit === 'number' ? request.params.bottomLimit : undefined,
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

    const performance =
      reportLevel === 'campaign'
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

      const performance =
        reportLevel === 'campaign'
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
      return this.errorResponse(
        provider.provider,
        'READ_NOT_ALLOWED',
        'Read operation is not allowed'
      );
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

  createCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateCampaignResult>> {
    return this.executeWrite<CreateCampaignResult>(request, 'createCampaign');
  }

  createAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdSetResult>> {
    return this.executeWrite<CreateAdSetResult>(request, 'createAdSet');
  }

  createAdCreative(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdCreativeResult>> {
    return this.executeWrite<CreateAdCreativeResult>(request, 'createAdCreative');
  }

  createAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdResult>> {
    return this.executeWrite<CreateAdResult>(request, 'createAd');
  }

  cloneUiAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CloneUiAdResult>> {
    return this.executeWrite<CloneUiAdResult>(request, 'cloneUiAd');
  }

  archiveAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ArchiveAdResult>> {
    return this.executeWrite<ArchiveAdResult>(request, 'archiveAd');
  }

  pauseAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'pauseAd');
  }

  resumeAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'resumeAd');
  }

  pauseAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'pauseAdSet');
  }

  resumeAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.executeWrite<AdsMutationResult>(request, 'resumeAdSet');
  }

  cloneAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CloneAdSetResult>> {
    return this.executeWrite<CloneAdSetResult>(request, 'cloneAdSet');
  }

  updateAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateAdSetResult>> {
    return this.executeWrite<UpdateAdSetResult>(request, 'updateAdSet');
  }

  updateAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateAdResult>> {
    return this.executeWrite<UpdateAdResult>(request, 'updateAd');
  }

  updateCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateCampaignResult>> {
    return this.executeWrite<UpdateCampaignResult>(request, 'updateCampaign');
  }

  getTargetingOptions(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<GetTargetingOptionsResult>> {
    return this.executeRead<GetTargetingOptionsResult>(request, 'getTargetingOptions');
  }

  createEcommerceCampaignBundle(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    return this.executeWrite<EcommerceCampaignBundleResult>(
      request,
      'createEcommerceCampaignBundle'
    );
  }

  uploadImage(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ImageUploadResult>> {
    return this.executeWrite<ImageUploadResult>(request, 'uploadImage');
  }

  uploadVideo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoUploadResult>> {
    return this.executeWrite<VideoUploadResult>(request, 'uploadVideo');
  }

  // --- TikTok GMV Max (routed via optional interface methods) ---

  gmvMaxCreateCampaign(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    return this.callOptionalMethod<EcommerceCampaignBundleResult>(request, 'gmvMaxCreateCampaign');
  }

  gmvMaxUpdateCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'gmvMaxUpdateCampaign');
  }

  gmvMaxCreateSession(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'gmvMaxCreateSession');
  }

  gmvMaxUpdateSession(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'gmvMaxUpdateSession');
  }

  gmvMaxDeleteSession(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'gmvMaxDeleteSession');
  }

  gmvMaxGetCampaignInfo(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<Record<string, unknown>[]>> {
    return this.callOptionalMethod<Record<string, unknown>[]>(request, 'gmvMaxGetCampaignInfo');
  }

  // --- TikTok Smart Plus (routed via optional interface methods) ---

  smartPlusCreateCampaign(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>> {
    return this.callOptionalMethod<EcommerceCampaignBundleResult>(
      request,
      'smartPlusCreateCampaign'
    );
  }

  smartPlusPauseCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'smartPlusPauseCampaign');
  }

  smartPlusResumeCampaign(
    request: AdsBrokerRequest
  ): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'smartPlusResumeCampaign');
  }

  smartPlusCreateAdGroup(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdSetResult>> {
    return this.callOptionalMethod<CreateAdSetResult>(request, 'smartPlusCreateAdGroup');
  }

  smartPlusPauseAdGroup(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'smartPlusPauseAdGroup');
  }

  smartPlusResumeAdGroup(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>> {
    return this.callOptionalMethod<AdsMutationResult>(request, 'smartPlusResumeAdGroup');
  }

  private async executeWrite<
    TData extends
      | AdsMutationResult
      | EcommerceCampaignBundleResult
      | CreateCampaignResult
      | CreateAdSetResult
      | CreateAdCreativeResult
      | CreateAdResult
      | CloneUiAdResult
      | ArchiveAdResult
      | CloneAdSetResult
      | UpdateAdSetResult
      | UpdateAdResult
      | UpdateCampaignResult
      | GetTargetingOptionsResult
      | ImageUploadResult
      | VideoUploadResult,
  >(request: AdsBrokerRequest, method: AdapterWriteMethod): Promise<AdsBrokerResponse<TData>> {
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
      return this.errorResponse(
        provider.provider,
        'WRITE_NOT_ALLOWED',
        'Write operation is not allowed by the current permission policy'
      );
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

  private resolveProviderId(
    request: AdsBrokerRequest
  ): { ok: true; provider: AdsProviderId } | { ok: false; response: AdsBrokerResponse<never> } {
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

  private getAdapter(
    provider: AdsProviderId
  ): { ok: true; adapter: AdsProviderAdapter } | { ok: false; response: AdsBrokerResponse<never> } {
    try {
      const adapter = this.providerRegistry.get(provider);
      if (!adapter) {
        return {
          ok: false,
          response: this.errorResponse(
            provider,
            'PROVIDER_NOT_REGISTERED',
            'Provider adapter is not registered'
          ),
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

  /**
   * Call an optional TikTok-specific method on the adapter.
   * Falls back to "not implemented" if method is not defined by the adapter.
   */
  private async callOptionalMethod<TData>(
    request: AdsBrokerRequest,
    method: string
  ): Promise<AdsBrokerResponse<TData>> {
    const resolved = this.resolveProviderId(request);
    if (!resolved.ok) return resolved.response as unknown as AdsBrokerResponse<TData>;

    const adapterResult = this.getAdapter(resolved.provider);
    if (!adapterResult.ok) return adapterResult.response as unknown as AdsBrokerResponse<TData>;

    const adapter = adapterResult.adapter;
    const methodFn = (adapter as unknown as Record<string, unknown>)[method] as
      | ((req: AdsBrokerRequest) => Promise<AdsBrokerResponse<TData>>)
      | undefined;

    if (typeof methodFn !== 'function') {
      return {
        ok: false,
        provider: resolved.provider,
        errors: [
          {
            provider: resolved.provider,
            code: 'NOT_IMPLEMENTED',
            message: `Method ${method} is not implemented by this provider`,
          },
        ],
      } as AdsBrokerResponse<TData>;
    }

    return methodFn.call(adapter, request);
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

  private notImplementedResponse(
    message: string,
    provider?: AdsProviderId
  ): AdsBrokerResponse<never> {
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
