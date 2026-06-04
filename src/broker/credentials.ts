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
  /** Per-request connection key override (hosted multi-user). Falls back to env CUAN_INSIGHT_CONNECTION_KEY. */
  connectionKey?: string;
  /** OAuth token auth context — when present, broker resolves via oauth_token flow. */
  oauthAuthContext?: {
    authType: 'oauth_token';
    accessTokenHash: string;
    clientId: string;
    scope: string;
    resource?: string;
    connectionKeyId?: string;
  };
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
const TOKEN_KEY_PATTERN = /(access[_-]?token|authorization|bearer|appsecret[_-]?proof|token|secret|connection[_-]?key)/i;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9._~+/=-]{16,}\b/g;

export function redactErrorMessage(message: string): string {
  return message
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s,;]+/gi, `$1${REDACTED}`)
    .replace(/(x-cuan-mcp-connection-key\s*:\s*)[^\s,;]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?access_token=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?appsecret_proof=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/(accessToken\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(access_token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(connection[_-]?key\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
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
    .replace(/(x-cuan-mcp-connection-key\s*:\s*)[^\s,;]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?access_token=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/([?&]?appsecret_proof=)[^\s&]+/gi, `$1${REDACTED}`)
    .replace(/(accessToken\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(access_token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(token\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`)
    .replace(/(connection[_-]?key\s*[:=]\s*)[^\s,;&]+/gi, `$1${REDACTED}`);
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
  connectionKey?: string;
  authMode?: 'mcp_token' | 'connection_key';
}

export class CuanInsightCredentialProvider implements CredentialProvider {
  readonly source = 'cuan_insight' as const;
  private readonly client?: CuanInsightCredentialClient;
  private readonly callerToken?: string;
  private readonly workspaceId?: string;
  private readonly connectionKey?: string;
  private readonly authMode?: 'mcp_token' | 'connection_key';

  constructor(
    client?: CuanInsightCredentialClient,
    options?: CuanInsightProviderOptions
  ) {
    this.client = client;
    this.callerToken = options?.callerToken;
    this.workspaceId = options?.workspaceId;
    this.connectionKey = options?.connectionKey;
    this.authMode = options?.authMode;
  }

  async resolve(request: CredentialResolveRequest): Promise<CredentialResolveResult> {
    const provider = request.provider;

    if (!isAdsProviderId(provider)) {
      return unsupportedProviderResult();
    }

    if (!this.client) {
      return {
        ok: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Cuan Insight credential client is not configured',
          provider,
        },
      };
    }

    try {
      const isOAuthTokenMode = request.oauthAuthContext?.authType === 'oauth_token';

      const resolveRequest: CuanInsightCredentialResolveRequest = {
        provider,
        accountId: request.accountId,
        workspaceId: this.workspaceId,
        callerToken: this.callerToken,
        connectionKey: request.connectionKey,
        requestedScopes: ['read'],
        params: request.params,
      };

      // Pass oauth_token auth context when available
      if (isOAuthTokenMode && request.oauthAuthContext) {
        resolveRequest.authType = 'oauth_token';
        resolveRequest.tokenHash = request.oauthAuthContext.accessTokenHash;
        resolveRequest.oauthClientId = request.oauthAuthContext.clientId;
        resolveRequest.oauthResource = request.oauthAuthContext.resource;
        resolveRequest.connectionKeyId = request.oauthAuthContext.connectionKeyId;
      }

      // ── Temp debug: credential resolver request ──
      if (process.env.MCP_OAUTH_DEBUG === 'true') {
        console.log('[TOOL_DEBUG] credential.resolve.request', JSON.stringify({
          provider,
          is_oauth_token: isOAuthTokenMode,
          has_connection_key: !!request.connectionKey,
          has_connection_key_id: !!request.oauthAuthContext?.connectionKeyId,
          has_token_hash: !!resolveRequest.tokenHash,
          has_auth_type: !!resolveRequest.authType,
          auth_type: resolveRequest.authType ?? 'none',
        }));
      }

      const response = await this.client.resolve(resolveRequest);

      // ── Temp debug: credential resolver response ──
      if (process.env.MCP_OAUTH_DEBUG === 'true') {
        console.log('[TOOL_DEBUG] credential.resolve.response', JSON.stringify({
          ok: response.ok,
          has_provider_token: !!response.providerToken,
          error_code: response.error?.code ?? null,
          has_identity: !!response.identity,
        }));
      }

      return mapCuanInsightResponseToCredentialResult(
        response,
        provider,
        request
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Cuan Insight credential resolution failed';

      // ── Temp debug: credential resolver exception ──
      if (process.env.MCP_OAUTH_DEBUG === 'true') {
        console.log('[TOOL_DEBUG] credential.resolve.exception', JSON.stringify({
          error_message: message,
          error_name: error instanceof Error ? error.name : typeof error,
          has_stack: error instanceof Error && !!error.stack,
        }));
      }

      return {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: redactErrorMessage(message),
          provider,
        },
      };
    }
  }
}

const SAFE_CUAN_INSIGHT_ERROR_CODE = 'INTERNAL_ERROR';

function mapCuanInsightResponseToCredentialResult(
  response: CuanInsightCredentialResolveResponse,
  provider: AdsProviderId,
  request: CredentialResolveRequest
): CredentialResolveResult {
  if (!response.ok) {
    const errorCode = response.error?.code &&
      isCuanInsightCredentialErrorCode(response.error?.code)
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
      accountId: response.providerAccess?.accountId ?? undefined,
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
