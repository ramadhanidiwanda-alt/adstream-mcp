import type { StructuredMutationError } from '../../types.js';

type CreativeErrorDetails = Pick<
  StructuredMutationError,
  'code' | 'message' | 'provider' | 'providerCode' | 'providerSubcode'
>;

const PROVIDER_GUIDANCE: Readonly<Record<string, string>> = {
  '100:2310068':
    'Pastikan katalog atau product set sudah dibagikan ke akun iklan yang membuat creative, lalu pilih product set yang terhubung.',
  '100:1443120':
    'Pastikan Page ID dapat diakses oleh akun iklan dan identitas Page pada creative sudah benar.',
  // Meta's message for this subcode ("video Instagram harus diunggah ke Facebook")
  // points at the wrong fix; that requirement was lifted in June 2023. The create
  // fails because Meta cannot tell which IG account owns the media. Verified live
  // against v25.0: the identical request succeeds once instagram_user_id is sent.
  // IMAGE media is inferred, so only video and Reels hit this.
  '100:1815279':
    'Video/Reel Instagram tidak perlu diunggah ulang ke Page. Isi instagramUserId (ID akun Instagram pemilik media, dari ads_list_instagram_accounts) bersama creativeSpec.sourceInstagramMediaId, lalu ulangi dry-run.',
};

/** Return user-facing guidance without replacing the provider's original details. */
export function getMetaCreativeErrorGuidance(
  error: Partial<CreativeErrorDetails> & Pick<CreativeErrorDetails, 'message'>
): string {
  if (error.code === 'INTERNAL_ERROR' || (!error.provider && error.code !== 'VALIDATION_ERROR')) {
    return 'Terjadi kegagalan internal saat memproses creative. Coba lagi; jika tetap gagal, periksa log server tanpa mengekspos kredensial.';
  }

  const providerKey = `${error.providerCode ?? ''}:${error.providerSubcode ?? ''}`;
  const providerGuidance = error.provider === 'meta' ? PROVIDER_GUIDANCE[providerKey] : undefined;
  if (providerGuidance) return providerGuidance;

  if (error.code === 'VALIDATION_ERROR') {
    if (/product set|katalog/i.test(error.message)) {
      return 'Periksa product set creative dan ad set, lalu pastikan katalog yang dipakai sudah dibagikan ke akun iklan.';
    }
    return 'Periksa kembali input creative yang ditandai, perbaiki nilainya, lalu ulangi dry-run.';
  }

  if (error.provider !== 'meta') {
    return 'Terjadi kegagalan saat memproses creative. Periksa detail error, lalu coba lagi.';
  }

  return 'Meta menolak pembuatan creative. Periksa detail asli Meta di bawah, perbaiki input yang disebutkan, lalu coba lagi.';
}
