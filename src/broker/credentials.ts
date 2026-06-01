import type { AdsProviderId, CredentialContext } from './types.js';
import { isAdsProviderId } from './types.js';
import type {
  CuanInsightCredentialClient,
  CuanInsightCredentialErrorCode,
  CuanInsightCredentialResolveRequest,
  CuanInsightCredentialResolveResponse,
  CuanInsightMcpIdentity,
  CuanInsightPlanLimits,
  CuanInsightProviderAccess,
} from './cuanInsight.js';
import { isCuanInsightCredentialErrorCode } from './cuanInsight.js';

export type CredentialSource = 'env' | 'cuan_insight' | 'request' | 'test';
export type BrokerRuntimeMode = 'local' | 'remote' | 'test';

export interface CredentialResolveRequest {
  provider: unknown;
  accountId?: string;
  params?: Record<string, unknown>;
}

export type CredentialResolveResult =
  | {
      ok: true;
      credential: CredentialContext;
      meta?: Record<string, unknown>;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        provider?: AdsProviderId;
      };
      meta?: Record<string, unknown>;
    };

export interface CredentialProvider {
  source: CredentialSource;
  resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult>;
}

export interface CredentialResolverContract {
  resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult>;
}

export type {
  CuanInsightCredentialClient,
  CuanInsightCredentialErrorCode,
  CuanInsightCredentialResolveRequest,
  CuanInsightCredentialResolveResponse,
  CuanInsightMcpIdentity,
  CuanInsightPlanLimits,
  CuanInsightProviderAccess,
};

export interface CredentialResolverOptions {
  mode: BrokerRuntimeMode;
  envProvider?: CredentialProvider;
  cuanInsightProvider?: CredentialProvider;
  testProvider?: CredentialProvider;
}

const REDACTED = '[REDACTED]';
const TOKEN_KEY_PATTERN = /(access[_-]?token|authorization|bearer|appsecret[_-]?proof|token|secret)/i;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9._~+/=-]{16,}\b/g;

export function redactErrorMessage(message: string): string {
  return message
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s,;]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?access_token=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?appsecret_proof=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/(accessToken\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(access_token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(LONG_TOKEN_PATTERN, REDACTED);
}

export function redactTokenLikeValues<T>(value: T): T | string {
  if (typeof value === 'string') {
    return redactStructuredString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactTokenLikeValues(item)) as T;
  }

  if (value && typeof value === 'object') {
    const redactedEntries = Object.entries(value).map(([key, entryValue]) => {
      if (TOKEN_KEY_PATTERN.test(key)) {
        return [key, REDACTED];
      }

      return [key, redactTokenLikeValues(entryValue)];
    });

    return Object.fromEntries(redactedEntries) as T;
  }

  return value;
}

function redactStructuredString(message: string): string {
  return message
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s,;]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?access_token=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?appsecret_proof=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/(accessToken\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(access_token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`);
}

export class EnvCredentialProvider implements CredentialProvider {
  readonly source = 'env' as const;

  async resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult> {
    if (!isAdsProviderId(request.provider)) {
      return unsupportedProviderResult();
    }

    const credential = request.provider === 'meta' ? this.resolveMeta() : this.resolveTikTok();

    if (!credential.accessToken || !credential.accountId) {
      return {
        ok: false,
        error: {
          code: 'MISSING_ENV_CREDENTIALS',
          message: `Missing required environment credentials for ${request.provider}`,
          provider: request.provider,
        },
      };
    }

    return { ok: true, credential };
  }

  private resolveMeta(): CredentialContext {
    return {
      provider: 'meta',
      accessToken: process.env.META_ACCESS_TOKEN,
      accountId: process.env.META_AD_ACCOUNT_ID,
      apiVersion: process.env.META_API_VERSION,
      source: 'env',
    };
  }

  private resolveTikTok(): CredentialContext {
    return {
      provider: 'tiktok',
      accessToken: process.env.TIKTOK_ACCESS_TOKEN,
      accountId: process.env.TIKTOK_ADVERTISER_ID,
      apiVersion: process.env.TIKTOK_API_VERSION,
      source: 'env',
    };
  }
}

export interface CuanInsightProviderOptions {
  callerToken?: string;
  workspaceId?: string;
}

export class CuanInsightCredentialProvider implements CredentialProvider {
  readonly source = 'cuan_insight' as const;

  constructor(
    private readonly client?: CuanInsightCredentialClient,
    private readonly options: CuanInsightProviderOptions = {}
  ) {}

  async resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult> {
    if (!isAdsProviderId(request.provider)) {
      return unsupportedProviderResult();
    }

    if (!this.client) {
      return {
        ok: false,
        error: {
          code: 'CUAN_INSIGHT_CLIENT_NOT_CONFIGURED',
          message: 'Cuan Insight credential client is not configured',
          provider: request.provider,
        },
      };
    }

    let response: CuanInsightCredentialResolveResponse;
    try {
      response = await this.client.resolve(this.toContractRequest(request));
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'CUAN_INSIGHT_CREDENTIAL_RESOLUTION_FAILED',
          message: redactErrorMessage(
            error instanceof Error ? error.message : String(error)
          ),
          provider: request.provider,
        },
      };
    }

    return mapCuanInsightResponse(
      { ...request, provider: request.provider },
      response
    );
  }

  private toContractRequest(
    request: CredentialResolveRequest
  ): CuanInsightCredentialResolveRequest {
    if (!isAdsProviderId(request.provider)) {
      throw new Error('Unsupported ads provider');
    }

    return {
      provider: request.provider,
      accountId: request.accountId,
      workspaceId: this.options.workspaceId,
      callerToken: this.options.callerToken,
      requestedScopes: ['read'],
      params: request.params,
    };
  }
}

const SAFE_CUAN_INSIGHT_ERROR_CODE: CuanInsightCredentialErrorCode = 'INTERNAL_ERROR';

function mapCuanInsightResponse(
  request: CredentialResolveRequest & { provider: AdsProviderId },
  response: CuanInsightCredentialResolveResponse
): CredentialResolveResult {
  const provider = request.provider;

  if (!response.ok) {
    const errorCode: CuanInsightCredentialErrorCode = isCuanInsightCredentialErrorCode(
      response.error?.code
    )
      ? (response.error!.code as CuanInsightCredentialErrorCode)
      : SAFE_CUAN_INSIGHT_ERROR_CODE;

    const errorMessage = redactErrorMessage(
      response.error?.message ?? 'Cuan Insight credential resolution failed'
    );

    return {
      ok: false,
      error: {
        code: errorCode,
        message: errorMessage,
        provider,
      },
      meta: buildSafeMeta(response),
    };
  }

  if (response.providerAccess && response.providerAccess.provider !== provider) {
    return {
      ok: false,
      error: {
        code: 'ACCOUNT_NOT_ALLOWED',
        message: 'Cuan Insight returned access for a different provider',
        provider,
      },
      meta: buildSafeMeta(response),
    };
  }

  if (response.providerAccess && response.providerAccess.allowed === false) {
    return {
      ok: false,
      error: {
        code: 'ACCOUNT_NOT_ALLOWED',
        message: 'Account access is not allowed by Cuan Insight',
        provider,
      },
      meta: buildSafeMeta(response),
    };
  }

  if (
    request.accountId &&
    response.providerAccess?.accountId &&
    response.providerAccess.accountId !== request.accountId
  ) {
    return {
      ok: false,
      error: {
        code: 'ACCOUNT_NOT_ALLOWED',
        message: 'Account access is not allowed by Cuan Insight',
        provider,
      },
      meta: buildSafeMeta(response),
    };
  }

  if (isExpiredIsoTimestamp(response.tokenExpiresAt)) {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_TOKEN_EXPIRED',
        message: 'Provider token has expired',
        provider,
      },
      meta: buildSafeMeta(response),
    };
  }

  if (!response.providerToken) {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_TOKEN_MISSING',
        message: 'Cuan Insight did not return a provider token',
        provider,
      },
      meta: buildSafeMeta(response),
    };
  }

  return {
    ok: true,
    credential: {
      provider,
      accessToken: response.providerToken,
      accountId: response.providerAccess?.accountId,
      apiVersion: response.providerApiVersion,
      source: 'cuan_insight',
    },
    meta: buildSafeMeta(response),
  };
}

function isExpiredIsoTimestamp(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function buildSafeMeta(
  response: CuanInsightCredentialResolveResponse
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  if (response.identity) {
    const identity: CuanInsightMcpIdentity = response.identity;
    meta.identity = {
      userId: identity.userId,
      workspaceId: identity.workspaceId,
      plan: identity.plan,
    };
  }

  if (response.providerAccess) {
    const access: CuanInsightProviderAccess = response.providerAccess;
    meta.providerAccess = {
      provider: access.provider,
      accountId: access.accountId,
      accountName: access.accountName,
      scopes: [...access.scopes],
      allowed: access.allowed,
    };
  }

  if (response.planLimits) {
    const plan: CuanInsightPlanLimits = response.planLimits;
    meta.planLimits = {
      plan: plan.plan,
      dailyRequestQuota: plan.dailyRequestQuota,
      remainingRequests: plan.remainingRequests,
      resetAt: plan.resetAt,
      notes: plan.notes,
    };
  }

  if (response.tokenExpiresAt) {
    meta.tokenExpiresAt = response.tokenExpiresAt;
  }

  return meta;
}

export class CredentialResolver implements CredentialResolverContract {
  private readonly envProvider: CredentialProvider;
  private readonly cuanInsightProvider: CredentialProvider;
  private readonly testProvider?: CredentialProvider;

  constructor(private readonly options: CredentialResolverOptions) {
    this.envProvider = options.envProvider ?? new EnvCredentialProvider();
    this.cuanInsightProvider = options.cuanInsightProvider ?? new CuanInsightCredentialProvider();
    this.testProvider = options.testProvider;
  }

  async resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult> {
    if (!isAdsProviderId(request.provider)) {
      return unsupportedProviderResult();
    }

    if (this.options.mode === 'local') {
      return this.envProvider.resolve(request);
    }

    if (this.options.mode === 'remote') {
      return this.cuanInsightProvider.resolve(request);
    }

    if (this.testProvider) {
      return this.testProvider.resolve(request);
    }

    return {
      ok: false,
      error: {
        code: 'TEST_CREDENTIAL_PROVIDER_NOT_CONFIGURED',
        message: 'Test credential provider is not configured',
        provider: request.provider,
      },
    };
  }
}

function unsupportedProviderResult(): CredentialResolveResult {
  return {
    ok: false,
    error: {
      code: 'UNSUPPORTED_PROVIDER',
      message: 'Unsupported ads provider',
    },
  };
}
