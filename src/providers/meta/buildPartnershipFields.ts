import type { MetaCreativeFormat, MetaPartnershipSpec } from '../../types.js';

/**
 * Format creative yang menerima field partnership. Format katalog, koleksi, dan
 * placement-customized dikecualikan: Meta tidak mendokumentasikan dukungan
 * partnership untuk ketiganya, dan meneruskannya diam-diam akan menghasilkan
 * penolakan Meta yang tidak menyebut sebab sebenarnya.
 */
const PARTNERSHIP_FORMATS = new Set<MetaCreativeFormat>([
  'existing_post',
  'single_image',
  'video',
  'carousel',
]);

export interface BuildPartnershipFieldsInput {
  partnership: MetaPartnershipSpec;
  creativeFormat: MetaCreativeFormat;
  /** Facebook Page ID milik brand/advertiser (options.pageId di createAdCreative). */
  pageId: string;
  /** Terisi hanya bila jalur boost memakai media IG yang sudah ada. */
  sourceInstagramMediaId?: string;
}

export interface PartnershipFields {
  /**
   * Page ID yang harus dipakai sebagai identitas primer creative. Pemanggil
   * menimpa pageId dengan nilai ini sebelum builder format berjalan.
   */
  primaryPageId: string;
  /** Potongan payload Graph yang digabung ke payload creative. */
  payload: Record<string, unknown>;
}

function trimmed(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildPartnershipFields(input: BuildPartnershipFieldsInput): PartnershipFields {
  const { partnership, creativeFormat } = input;

  if (!PARTNERSHIP_FORMATS.has(creativeFormat)) {
    throw new Error(
      `Format ${creativeFormat} tidak mendukung partnership. ` +
        'Pilih existing_post, single_image, video, atau carousel.'
    );
  }

  // Ad creative selalu di-anchor ke sebuah Facebook Page lewat object_id atau
  // object_story_spec.page_id — termasuk partnership ad yang murni tayang di
  // Instagram. Tanpa cek ini Meta menolak dengan error yang tidak menyebut sebabnya.
  const brandPageId = trimmed(input.pageId);
  if (!brandPageId) {
    throw new Error(
      'pageId wajib diisi saat partnership dipakai: ad creative selalu di-anchor ke Facebook Page brand, ' +
        'bahkan untuk partnership ad yang hanya tayang di Instagram.'
    );
  }

  const partnerPageId = trimmed(partnership.partnerPageId);
  const partnerInstagramId = trimmed(partnership.partnerInstagramId);
  if (!partnerPageId && !partnerInstagramId) {
    throw new Error(
      'partnership wajib berisi minimal satu dari partnerPageId atau partnerInstagramId.'
    );
  }

  const adCode = trimmed(partnership.adCode);
  const adFormat = trimmed(partnership.adFormat);
  if (adCode && !adFormat) {
    throw new Error(
      'adFormat wajib diisi bila adCode diisi — branded_content.ad_format adalah field wajib pada jalur ad code.'
    );
  }
  if (adCode && trimmed(input.sourceInstagramMediaId)) {
    throw new Error(
      'adCode dan creativeSpec.sourceInstagramMediaId adalah dua jalur boost yang berbeda. ' +
        'Isi salah satu saja agar sumber konten tidak ambigu.'
    );
  }

  const primaryIdentity = partnership.primaryIdentity ?? 'advertiser';
  if (primaryIdentity === 'creator' && !partnerPageId) {
    throw new Error(
      "primaryIdentity 'creator' membutuhkan partnerPageId: tidak ada Page ID kreator yang bisa dipasang sebagai identitas primer."
    );
  }

  // partnerPageId sudah dipastikan ada di cabang 'creator' oleh cek di atas.
  const primaryPageId = primaryIdentity === 'creator' ? (partnerPageId as string) : brandPageId;
  const sponsorPageId = primaryIdentity === 'creator' ? brandPageId : partnerPageId;

  const payload: Record<string, unknown> = {};

  // existing_post tidak punya object_story_spec sama sekali (pasangan itu ditolak
  // Meta sebagai Ambiguous Promoted Object), jadi identitas dibawa object_id.
  if (creativeFormat === 'existing_post') {
    payload.object_id = primaryPageId;
  }

  if (sponsorPageId) {
    payload.facebook_branded_content = { sponsor_page_id: sponsorPageId };
  }
  if (partnerInstagramId) {
    payload.instagram_branded_content = { sponsor_id: partnerInstagramId };
  }
  if (adCode) {
    payload.branded_content = {
      instagram_boost_post_access_token: adCode,
      ad_format: adFormat,
    };
  }

  return { primaryPageId, payload };
}

/**
 * Catatan yang wajib ikut ke hasil dry-run setiap kali partnership dipakai.
 * Keduanya hanya bergantung pada spec, bukan pada format, sehingga bisa dihitung
 * terpisah dari payload.
 */
export function getPartnershipNotes(partnership: MetaPartnershipSpec): string[] {
  const notes = [
    'Iklan partnership yang dipublish tanpa izin kemitraan tetap diterima Meta, tetapi masuk status pending delivery ' +
      'sampai partner menyetujui permintaan izin. Sukses pada ads_create_ad belum berarti iklan tayang.',
  ];

  if (!trimmed(partnership.partnerPageId)) {
    notes.push(
      'Hanya identitas Instagram partner yang diisi. Meta akan mencoba me-link Page Facebook terkait, ' +
        'tetapi bila kedua akun tidak ter-link, iklan tidak tayang di Facebook.'
    );
  }

  return notes;
}
