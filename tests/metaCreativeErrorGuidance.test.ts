import { describe, expect, it } from 'vitest';
import { getMetaCreativeErrorGuidance } from '../src/providers/meta/metaCreativeErrorGuidance.js';

describe('getMetaCreativeErrorGuidance', () => {
  it('explains a missing collaborative product-set attachment', () => {
    expect(
      getMetaCreativeErrorGuidance({
        providerCode: '100',
        providerSubcode: '2310068',
        message: 'Invalid parameter',
      })
    ).toMatch(/katalog.*dibagikan|product set/i);
  });

  it('does not replace the original Meta details', () => {
    const guidance = getMetaCreativeErrorGuidance({
      providerCode: '100',
      providerSubcode: '999999',
      message: 'Original Meta message',
    });
    expect(guidance).toMatch(/Meta menolak/i);
  });
});
