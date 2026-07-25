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

  // Meta's own message for this subcode says the Instagram video "must be
  // uploaded to Facebook", which sends people down a dead end: nothing needs
  // uploading, the create just needs instagramUserId so Meta can resolve the
  // owning IG account. Verified live against v25.0 on 2026-07-25.
  it('points a rejected existing IG video at the missing instagramUserId', () => {
    const guidance = getMetaCreativeErrorGuidance({
      provider: 'meta',
      providerCode: '100',
      providerSubcode: '1815279',
      message: 'Invalid parameter (Video Instagram Harus Diunggah ke Facebook)',
    });
    expect(guidance).toMatch(/instagramUserId/);
    expect(guidance).toMatch(/tidak perlu|tanpa perlu/i);
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
