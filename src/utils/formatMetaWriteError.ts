import { MetaApiError } from './metaError.js';
import type { StructuredMutationError } from '../types.js';
import { redactErrorMessage } from '../broker/credentials.js';

const SIGNED_URL_PATTERN =
  /https?:\/\/[^\s"'<>]*[?&](?:x-amz-signature|signature|sig|access_token|token)=[^\s"'<>]*/gi;

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
    return redactWriteErrorMessage(parts.join(' '));
  }
  return redactWriteErrorMessage(error instanceof Error ? error.message : String(error));
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
      providerTitle: redactOptionalMessage(error.userTitle),
      providerMessage: redactOptionalMessage(error.userMessage),
      traceId: error.fbtraceId,
      actionableFix: getActionableFix(error, message),
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: formatMetaWriteError(error),
    actionableFix:
      'Retry the request. If the issue persists, inspect server logs without exposing credentials.',
  };
}

function redactOptionalMessage(message: string | undefined): string | undefined {
  return message === undefined ? undefined : redactWriteErrorMessage(message);
}

function redactWriteErrorMessage(message: string): string {
  const signedUrlsRemoved = message.replace(SIGNED_URL_PATTERN, '__URL__');
  return redactErrorMessage(signedUrlsRemoved).replaceAll('__URL__', '[REDACTED_SIGNED_URL]');
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
  if (error.code === 190)
    return 'Reconnect the provider account and ensure the token is not expired.';
  if (error.code === 200 || error.code === 10)
    return 'Reconnect the account with the required Meta Ads permission and verify account access.';
  if (error.subcode === 2061015 || (text.includes('link') && text.includes('wajib'))) {
    return 'Fix the creative CTA link payload. For existing-post WhatsApp creatives, use WHATSAPP_MESSAGE with value.app_destination WHATSAPP and value.link https://api.whatsapp.com/send; avoid wa.me phone URLs. For Instagram Direct existing-post creatives, provide both app_destination and link.';
  }
  if (error.subcode === 1885760) {
    return 'All non-archived ad sets in this campaign must use the same optimization_goal under auto bid/CBO-style delivery. Match the sibling ad set goal or split different goals into separate campaigns.';
  }
  if (error.subcode === 2490408) {
    return (
      'Meta rejected optimization_goal for this campaign objective. For purchase-through-' +
      'messaging on Sales + WhatsApp, use optimization_goal OFFSITE_CONVERSIONS with ' +
      'promoted_object { page_id, whatsapp_phone_number, pixel_id, custom_event_type: ' +
      '"PURCHASE" } — that is the combination Meta\'s ODAX mapping table lists for this ' +
      'conversion location, and it validates. MESSAGING_PURCHASE_CONVERSION is refused on ' +
      'every public API write path (POST /act_X/adsets, /{adset_id}/copies and /{adset_id}, ' +
      'v21.0 through v26.0) even though Ads Manager can set it and ad sets read it back, so ' +
      'retrying it with a different payload or endpoint will not help. Do not silently fall ' +
      'back to CONVERSATIONS if purchase optimization was requested — that optimizes for ' +
      'threads, not purchases.'
    );
  }
  if (text.includes('page'))
    return 'Verify the Page ID or identity is accessible to the connected ad account.';
  if (text.includes('budget'))
    return 'Check budget units, campaign budget settings, and provider budget constraints.';
  if (text.includes('bid'))
    return 'Check bid strategy compatibility and required bid amount or bid constraints.';
  if (text.includes('duplicate'))
    return 'Use a unique name or retry with an idempotency/deduplication key when supported.';
  if (error.code === 4 || error.code === 17 || error.code === 613)
    return 'Retry later or reduce request rate for this provider account.';
  return 'Review the provider error details, fix the highlighted input, and retry the dry-run before executing.';
}

function hasApplicationCapabilityError(error: MetaApiError): boolean {
  return error.code === 3 && /application does not have (the )?capability/i.test(error.message);
}
