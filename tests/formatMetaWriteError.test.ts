import { describe, expect, it } from 'vitest';
import { formatMetaWriteError, formatStructuredMetaWriteError } from '../src/utils/formatMetaWriteError.js';
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
      actionableFix: 'Retry the request. If the issue persists, inspect server logs without exposing credentials.',
    });
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
});
