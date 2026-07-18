import { describe, expect, it } from 'vitest';
import { getMetaCreativeErrorGuidance } from '../src/providers/meta/metaCreativeErrorGuidance.js';

describe('getMetaCreativeErrorGuidance', () => {
  it('explains a missing collaborative product-set attachment', () => {
    expect(
      getMetaCreativeErrorGuidance({
        provider: 'meta',
        providerCode: '100',
        providerSubcode: '2310068',
        message: 'Invalid parameter',
      })
    ).toMatch(/katalog.*dibagikan|product set/i);
  });

  it('does not replace the original Meta details', () => {
    const guidance = getMetaCreativeErrorGuidance({
      provider: 'meta',
      providerCode: '100',
      providerSubcode: '999999',
      message: 'Original Meta message',
    });
    expect(guidance).toMatch(/Meta menolak/i);
  });

  it('uses neutral guidance for an internal non-provider failure', () => {
    expect(
      getMetaCreativeErrorGuidance({
        code: 'INTERNAL_ERROR',
        message: 'network down',
      })
    ).toBe(
      'Terjadi kegagalan internal saat memproses creative. Coba lagi; jika tetap gagal, periksa log server tanpa mengekspos kredensial.'
    );
  });
});
