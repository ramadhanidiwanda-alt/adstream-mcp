import { describe, expect, it } from 'vitest';
import { formatMetaWriteError } from '../src/utils/formatMetaWriteError.js';
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

  it('falls back to plain message for non-Meta errors', () => {
    expect(formatMetaWriteError(new Error('network down'))).toBe('network down');
    expect(formatMetaWriteError('raw string')).toBe('raw string');
  });
});
