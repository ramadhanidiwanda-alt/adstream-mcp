import { describe, expect, it } from 'vitest';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../src/utils/formatMetaWriteError.js';
import { MetaApiError } from '../src/utils/metaError.js';

describe('formatMetaWriteError', () => {
  it('surfaces Meta user title and subcode for MetaApiError', () => {
    const error = new MetaApiError({
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 1443120,
      error_user_title: 'Invalid Page ID',
      error_user_msg: 'The Page ID specified in object story spec is invalid.',
      fbtrace_id: 'trace_123',
    });

    const message = formatMetaWriteError(error);

    expect(message).toContain('Invalid parameter');
    expect(message).toContain('Invalid Page ID');
    expect(message).toContain('The Page ID specified in object story spec is invalid.');
    expect(message).toContain('subcode 1443120');
  });

  it('returns a structured safe error for MetaApiError', () => {
    const error = new MetaApiError({
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 1443120,
      error_user_title: 'Invalid Page ID',
      error_user_msg: 'The Page ID specified in object story spec is invalid.',
      fbtrace_id: 'trace_123',
    });

    expect(formatStructuredMetaWriteError(error)).toMatchObject({
      code: 'INVALID_PARAMETER',
      message: expect.stringContaining('Invalid Page ID'),
      provider: 'meta',
      providerCode: '100',
      providerSubcode: '1443120',
      traceId: 'trace_123',
      actionableFix: expect.stringContaining('Page ID'),
    });
  });

  it('preserves every provider-native Meta error detail separately', () => {
    const error = new MetaApiError({
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 2310068,
      error_user_title: 'Product set is not available',
      error_user_msg: 'The product set is not shared with this ad account.',
      fbtrace_id: 'trace_native_123',
    });

    expect(formatStructuredMetaWriteError(error)).toMatchObject({
      providerCode: '100',
      providerSubcode: '2310068',
      providerTitle: 'Product set is not available',
      providerMessage: 'The product set is not shared with this ad account.',
      traceId: 'trace_native_123',
    });
  });

  it('falls back to plain message for non-Meta errors', () => {
    expect(formatMetaWriteError(new Error('network down'))).toBe('network down');
    expect(formatMetaWriteError('raw string')).toBe('raw string');
  });

  it('returns INTERNAL_ERROR for non-Meta structured errors', () => {
    expect(formatStructuredMetaWriteError(new Error('network down'))).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'network down',
      actionableFix:
        'Retry the request. If the issue persists, inspect server logs without exposing credentials.',
    });
  });

  it('redacts credentials from generic write errors and structured messages', () => {
    const token = 'task8_super_secret_token_123456789';
    const error = new Error(
      `Provider failed: access_token=${token}; Authorization: Bearer ${token}`
    );

    const plain = formatMetaWriteError(error);
    const structured = formatStructuredMetaWriteError(error);
    const json = JSON.stringify({ plain, structured });

    expect(plain).toContain('[REDACTED]');
    expect(structured.message).toContain('[REDACTED]');
    expect(json).not.toContain(token);
    expect(json).not.toContain(`access_token=${token}`);
    expect(json).not.toContain(`Authorization: Bearer ${token}`);
  });

  it('redacts credentials from provider-native Meta detail fields', () => {
    const token = 'task8_meta_secret_token_123456789';
    const error = new MetaApiError({
      message: `Invalid parameter access_token=${token}`,
      type: 'OAuthException',
      code: 100,
      error_user_title: `Authorization: Bearer ${token}`,
      error_user_msg: `Catalog lookup failed for ${token}`,
    });

    const structured = formatStructuredMetaWriteError(error);
    const json = JSON.stringify(structured);

    expect(structured.providerTitle).toContain('[REDACTED]');
    expect(structured.providerMessage).toContain('[REDACTED]');
    expect(json).not.toContain(token);
  });

  it('removes signed asset URLs from write errors', () => {
    const signature = 'task8_asset_signature_123456789';
    const signedUrl = `https://cdn.example.test/private/creative.jpg?X-Amz-Signature=${signature}&expires=60`;

    const formatted = formatMetaWriteError(new Error(`Creative fetch failed: ${signedUrl}`));

    expect(formatted).toContain('[REDACTED_SIGNED_URL]');
    expect(formatted).not.toContain(signedUrl);
    expect(formatted).not.toContain('cdn.example.test/private/creative.jpg');
    expect(formatted).not.toContain(signature);
  });

  it('explains when Meta blocks a Dynamic Creative request at the application capability layer', () => {
    const error = new MetaApiError({
      message: 'Application does not have the capability to make this API call.',
      type: 'OAuthException',
      code: 3,
    });

    expect(formatStructuredMetaWriteError(error)).toMatchObject({
      code: 'META_APPLICATION_CAPABILITY_UNAVAILABLE',
      actionableFix: expect.stringContaining('Meta app'),
    });
  });

  it('explains Meta link-required creative errors as CTA payload conflicts', () => {
    const error = new MetaApiError({
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 2061015,
      error_user_title: 'Kolom Wajib Kosong',
      error_user_msg: 'Kolom link wajib. Harap isi bidang tersebut untuk melanjutkan.',
    });

    expect(formatStructuredMetaWriteError(error)).toMatchObject({
      code: 'INVALID_PARAMETER',
      providerSubcode: '2061015',
      actionableFix: expect.stringMatching(/WHATSAPP_MESSAGE.*api\.whatsapp\.com\/send/i),
    });
  });

  it('explains mixed campaign optimization goals from Meta subcode 1885760', () => {
    const error = new MetaApiError({
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 1885760,
      error_user_title: 'Invalid optimization goal',
    });

    expect(formatStructuredMetaWriteError(error)).toMatchObject({
      providerSubcode: '1885760',
      actionableFix: expect.stringContaining('same optimization_goal'),
    });
  });

  it('explains unavailable messaging purchase performance goal from Meta subcode 2490408', () => {
    const error = new MetaApiError({
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 2490408,
      error_user_title: 'Target kinerja tidak tersedia',
    });

    expect(formatStructuredMetaWriteError(error)).toMatchObject({
      providerSubcode: '2490408',
      actionableFix: expect.stringContaining('MESSAGING_PURCHASE_CONVERSION'),
    });
  });

  // 2490408 on this goal is an eligibility gate (10+ purchase events in 30 days, per Page,
  // per channel), not a payload defect. The guidance has to name the threshold and the way
  // to satisfy it, and must not offer OFFSITE_CONVERSIONS as a substitute.
  it('tells subcode 2490408 how to clear the purchase-event eligibility gate', () => {
    const error = new MetaApiError({
      message: 'Invalid parameter',
      type: 'OAuthException',
      code: 100,
      error_subcode: 2490408,
      error_user_title: 'Target kinerja tidak tersedia',
    });

    const { actionableFix } = formatStructuredMetaWriteError(error);

    expect(actionableFix).toMatch(/10\+ purchase events/);
    expect(actionableFix).toContain('30 days');
    expect(actionableFix).toContain('per Facebook Page');
    expect(actionableFix).toContain('Conversions API for Business Messaging');
    expect(actionableFix).toContain('Do not substitute OFFSITE_CONVERSIONS');
  });
});

describe('formatStructuredMetaWriteError recovery hints', () => {
  // An agent that cannot name the tool it needs next tends to retry the same bad
  // payload; every recovery hint should point at the tool that resolves the input.
  describe('actionable fixes name the recovery tool', () => {
    function fixFor(overrides: Partial<Parameters<typeof metaError>[0]> = {}) {
      return formatStructuredMetaWriteError(metaError(overrides)).actionableFix;
    }

    function metaError(overrides: Record<string, unknown> = {}) {
      return new MetaApiError({
        message: 'Invalid parameter',
        type: 'OAuthException',
        code: 100,
        ...overrides,
      } as never);
    }

    it('points a Page failure at ads_list_pages', () => {
      expect(fixFor({ error_user_title: 'Invalid Page ID' })).toContain('ads_list_pages');
    });

    it('points a pixel failure at ads_list_pixels', () => {
      expect(fixFor({ error_user_msg: 'The pixel id is invalid' })).toContain('ads_list_pixels');
    });

    it('points an image hash failure at the upload and library tools', () => {
      const fix = fixFor({ error_user_msg: 'Invalid image hash supplied' });

      expect(fix).toContain('ads_list_adimages');
      expect(fix).toContain('ads_upload_image');
    });

    it('points an Instagram identity failure at ads_list_instagram_accounts', () => {
      expect(fixFor({ error_user_title: 'Instagram account not available' })).toContain(
        'ads_list_instagram_accounts'
      );
    });

    it('points a targeting failure at ads_get_targeting_options', () => {
      expect(fixFor({ error_user_msg: 'Invalid targeting interest id' })).toContain(
        'ads_get_targeting_options'
      );
    });

    it('falls back to re-running the readiness check instead of a bare retry', () => {
      expect(fixFor({ error_user_title: 'Something unclassified' })).toContain(
        'ads_check_launch_readiness'
      );
    });
  });
});
