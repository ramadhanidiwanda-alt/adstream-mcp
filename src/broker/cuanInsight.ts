import type { AdsProviderId } from './types.js';
import { isAdsProviderId } from './types.js';

/**
 * Stable error codes returned by the Cuan Insight credential contract.
 *
 * These codes MUST be safe to surface to AI clients and callers; they never
 * reveal token material or internal stack traces.
 */
export const CUAN_INSIGHT_CREDENTIAL_ERROR_CODES = [
  'UNSUPPORTED_PROVIDER',
  'AUTHENTICATION_REQUIRED',
  'IDENTITY_NOT_FOUND',
  'WORKSPACE_NOT_FOUND',
  'ACCOUNT_NOT_ALLOWED',
  'PROVIDER_TOKEN_EXPIRED',
  'PROVIDER_TOKEN_REVOKED',
  'PROVIDER_TOKEN_MISSING',
  'PLAN_LIMIT_EXCEEDED',
  'READ_ONLY_VIOLATION',
  'INTERNAL_ERROR',
] as const;

export type CuanInsightCredentialErrorCode =
  (typeof CUAN_INSIGHT_CREDENTIAL_ERROR_CODES)[number];

/**
 * Identity payload describing which Cuan Insight user/workspace the broker is
 * acting on behalf of. The broker treats this as opaque metadata; only Cuan
 * Insight is the source of truth for membership and plan.
 */
export interface CuanInsightMcpIdentity {
  userId?: string;
  workspaceId: string;
  plan: string;
  email?: string;
  displayName?: string;
}

/**
 * Provider access entry. Cuan Insight is the source of truth for which ad
 * accounts a caller may read, with what scopes, on which provider.
 */
export interface CuanInsightProviderAccess {
  provider: AdsProviderId;
  accountId: string;
  accountName?: string;
  scopes: ReadonlyArray<'read'>;
  allowed: boolean;
}

/**
 * Plan and quota information returned alongside credentials. The broker may
 * surface this in MCP `meta` for visibility but does not enforce it locally.
 */
export interface CuanInsightPlanLimits {
  plan: string;
  dailyRequestQuota?: number;
  remainingRequests?: number;
  resetAt?: string;
  notes?: string;
}

/**
 * Request payload sent from the broker to Cuan Insight when resolving
 * credentials for a remote MCP call.
 *
 * Tokens (callerToken, etc.) MUST never be logged or echoed back to clients.
 */
export interface CuanInsightCredentialResolveRequest {
  provider: AdsProviderId;
  accountId?: string;
  workspaceId?: string;
  callerToken?: string;
  requestedScopes?: ReadonlyArray<'read'>;
  params?: Record<string, unknown>;
}

/**
 * Response payload returned by Cuan Insight to the broker.
 *
 * `providerToken` is short-lived and MUST be redacted from any logs, error
 * messages, or MCP responses surfaced to clients.
 */
export interface CuanInsightCredentialResolveResponse {
  ok: boolean;
  identity?: CuanInsightMcpIdentity;
  providerAccess?: CuanInsightProviderAccess;
  providerToken?: string;
  providerApiVersion?: string;
  tokenExpiresAt?: string;
  planLimits?: CuanInsightPlanLimits;
  error?: {
    code: CuanInsightCredentialErrorCode;
    message: string;
  };
}

/**
 * Dependency-injected client used by the broker to talk to Cuan Insight.
 *
 * The broker does not bind to a concrete URL or transport. Implementations
 * may be HTTP, in-process mocks, or test doubles.
 */
export interface CuanInsightCredentialClient {
  resolve(
    request: CuanInsightCredentialResolveRequest
  ): Promise<CuanInsightCredentialResolveResponse>;
}

export function isCuanInsightCredentialErrorCode(
  value: unknown
): value is CuanInsightCredentialErrorCode {
  return (
    typeof value === 'string' &&
    (CUAN_INSIGHT_CREDENTIAL_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function isSupportedCuanInsightProvider(
  value: unknown
): value is AdsProviderId {
  return isAdsProviderId(value);
}
