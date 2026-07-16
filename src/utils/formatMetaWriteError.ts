import { MetaApiError } from './metaError.js';
import type { StructuredMutationError } from '../types.js';

/**
 * Build a descriptive error message from a Meta write failure.
 *
 * Meta often returns a generic "Invalid parameter" message while the actionable
 * detail lives in error_user_title / error_subcode. This helper surfaces that
 * detail without leaking tokens.
 */
export function formatMetaWriteError(error: unknown): string {
  if (error instanceof MetaApiError) {
    const parts: string[] = [error.message];
    if (error.userTitle) parts.push(`(${error.userTitle})`);
    if (error.userMessage && error.userMessage !== error.userTitle) parts.push(error.userMessage);
    if (error.subcode) parts.push(`[subcode ${error.subcode}]`);
    return parts.join(' ');
  }
  return error instanceof Error ? error.message : String(error);
}

export function formatStructuredMetaWriteError(error: unknown): StructuredMutationError {
  if (error instanceof MetaApiError) {
    const message = formatMetaWriteError(error);
    return {
      code: mapMetaErrorCode(error),
      message,
      provider: 'meta',
      providerCode: error.code !== undefined ? String(error.code) : undefined,
      providerSubcode: error.subcode !== undefined ? String(error.subcode) : undefined,
      traceId: error.fbtraceId,
      actionableFix: getActionableFix(error, message),
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: formatMetaWriteError(error),
    actionableFix: 'Retry the request. If the issue persists, inspect server logs without exposing credentials.',
  };
}

function mapMetaErrorCode(error: MetaApiError): string {
  if (hasApplicationCapabilityError(error)) return 'META_APPLICATION_CAPABILITY_UNAVAILABLE';
  if (error.code === 190) return 'TOKEN_EXPIRED_OR_INVALID';
  if (error.code === 200 || error.code === 10) return 'MISSING_PERMISSION';
  if (error.code === 100) return 'INVALID_PARAMETER';
  if (error.code === 4 || error.code === 17 || error.code === 613) return 'PROVIDER_RATE_LIMIT';
  return 'PROVIDER_ERROR';
}

function getActionableFix(error: MetaApiError, message: string): string {
  const text = `${error.userTitle ?? ''} ${error.userMessage ?? ''} ${message}`.toLowerCase();
  if (hasApplicationCapabilityError(error)) {
    return 'This Meta app or token is not enabled for this API capability. Verify the app’s Marketing API access and request the required Meta capability; changing the MCP payload alone cannot bypass this restriction.';
  }
  if (error.code === 190) return 'Reconnect the provider account and ensure the token is not expired.';
  if (error.code === 200 || error.code === 10) return 'Reconnect the account with the required Meta Ads permission and verify account access.';
  if (text.includes('page')) return 'Verify the Page ID or identity is accessible to the connected ad account.';
  if (text.includes('budget')) return 'Check budget units, campaign budget settings, and provider budget constraints.';
  if (text.includes('bid')) return 'Check bid strategy compatibility and required bid amount or bid constraints.';
  if (text.includes('duplicate')) return 'Use a unique name or retry with an idempotency/deduplication key when supported.';
  if (error.code === 4 || error.code === 17 || error.code === 613) return 'Retry later or reduce request rate for this provider account.';
  return 'Review the provider error details, fix the highlighted input, and retry the dry-run before executing.';
}

function hasApplicationCapabilityError(error: MetaApiError): boolean {
  return error.code === 3 && /application does not have (the )?capability/i.test(error.message);
}
