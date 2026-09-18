import type { MetaErrorResponse } from '../types.js';

export class MetaApiError extends Error {
  public code: number;
  public type: string;
  public subcode?: number;
  public userTitle?: string;
  public userMessage?: string;
  public fbtraceId?: string;

  constructor(errorResponse: MetaErrorResponse['error']) {
    super(errorResponse.message);
    this.name = 'MetaApiError';
    this.code = errorResponse.code;
    this.type = errorResponse.type;
    this.subcode = errorResponse.error_subcode;
    this.userTitle = errorResponse.error_user_title;
    this.userMessage = errorResponse.error_user_msg;
    this.fbtraceId = errorResponse.fbtrace_id;
  }
}

/**
 * Permissions required by Meta for Instagram Partnership Ads discovery and
 * creation. Kept in one place so discovery + creative error paths share the
 * same hint text.
 */
export const PARTNERSHIP_ADS_REQUIRED_SCOPES = [
  'ads_management',
  'business_management',
  'pages_read_engagement',
  'pages_show_list',
  'instagram_basic',
  'instagram_branded_content_ads_brand',
];

export const FACEBOOK_PARTNERSHIP_ADS_REQUIRED_SCOPES = [
  'ads_management',
  'business_management',
  'pages_read_engagement',
  'pages_show_list',
  'facebook_branded_content_ads_brand',
];

/**
 * Translate common Meta permission errors into an actionable, token-safe hint.
 * This only adds context; the original error message is preserved by callers.
 */
export function getMetaPermissionScopeHint(
  error: MetaApiError,
  context: { endpointKind?: 'partnership_discovery' | 'partnership_create' | 'generic' } = {}
): string | undefined {
  const kind = context.endpointKind ?? 'generic';
  const isPermissionError =
    error.code === 200 ||
    error.code === 10 ||
    error.code === 403 ||
    /permission|forbidden|scope|not authorized|not allowed/i.test(error.message);

  if (!isPermissionError) return undefined;

  if (kind === 'partnership_discovery' || kind === 'partnership_create') {
    return (
      'Meta menolak karena izin/token kurang. Untuk Instagram Partnership Ads, token wajib memiliki scope: ' +
      PARTNERSHIP_ADS_REQUIRED_SCOPES.join(', ') +
      '. Untuk Facebook partnership ads saja, minimal: ' +
      FACEBOOK_PARTNERSHIP_ADS_REQUIRED_SCOPES.join(', ') +
      '. Pastikan scope instagram_branded_content_ads_brand diberikan bersama instagram_basic pada akun IG profesional yang sama, ' +
      'dan token berasal dari user dengan role ADVERTISE pada Page yang ter-link ke akun IG tersebut.'
    );
  }

  return undefined;
}

export function isMetaErrorResponse(data: any): data is MetaErrorResponse {
  return data && typeof data === 'object' && 'error' in data;
}
