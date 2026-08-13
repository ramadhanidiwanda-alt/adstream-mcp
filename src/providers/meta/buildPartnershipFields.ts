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
  /** Terisi hanya bila jalur boost memakai post Facebook Page yang sudah ada. */
  objectStoryId?: string;
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
  // branded_content.instagram_boost_post_access_token hanya terdokumentasi untuk
  // mem-boost konten organik yang sudah ada. Pada format creative baru (aset yang
  // diunggah sendiri) tidak ada konten lama yang bisa dirujuk ad code, sehingga
  // kombinasi itu tidak punya makna dan lebih baik ditolak di sini daripada
  // diteruskan ke Meta sebagai payload yang tidak didokumentasikan.
  if (adCode && creativeFormat !== 'existing_post') {
    throw new Error(
      `partnership.adCode hanya berlaku untuk creativeFormat existing_post, bukan ${creativeFormat}. ` +
        'Ad code merujuk konten organik yang sudah ada; untuk creative baru pakai partnership tanpa adCode.'
    );
  }

  const primaryIdentity = partnership.primaryIdentity ?? 'advertiser';
  if (primaryIdentity === 'creator' && !partnerPageId) {
    throw new Error(
      "primaryIdentity 'creator' membutuhkan partnerPageId: tidak ada Page ID kreator yang bisa dipasang sebagai identitas primer."
    );
  }

  // sponsor_* selalu berarti identitas SEKUNDER, di sisi Facebook maupun Instagram.
  // Pada primaryIdentity 'creator' sponsornya adalah advertiser, jadi sponsor_id diisi
  // brandInstagramId — bukan partnerInstagramId.
  const brandInstagramId = trimmed(partnership.brandInstagramId);
  if (primaryIdentity === 'creator' && partnerInstagramId) {
    throw new Error(
      "partnership.partnerInstagramId tidak boleh diisi bersama primaryIdentity 'creator': " +
        'Meta menurunkan akun Instagram kreator dari Page kreator yang dikirim pada object_story_spec.page_id, ' +
        'sehingga mengirim keduanya membuat identitas kreator ambigu. ' +
        'Isi partnership.brandInstagramId (akun Instagram advertiser, yang menjadi sponsor) bila sisi Instagram perlu sponsor.'
    );
  }
  if (primaryIdentity !== 'creator' && brandInstagramId) {
    throw new Error(
      "partnership.brandInstagramId hanya berlaku pada primaryIdentity 'creator'. " +
        "Pada primaryIdentity 'advertiser' sponsornya adalah kreator, jadi isi partnership.partnerInstagramId " +
        'dan hapus partnership.brandInstagramId.'
    );
  }

  // partnerPageId sudah dipastikan ada di cabang 'creator' oleh cek di atas.
  const primaryPageId = primaryIdentity === 'creator' ? (partnerPageId as string) : brandPageId;
  const sponsorPageId = primaryIdentity === 'creator' ? brandPageId : partnerPageId;
  const sponsorInstagramId = primaryIdentity === 'creator' ? brandInstagramId : partnerInstagramId;

  const payload: Record<string, unknown> = {};

  // existing_post tidak punya object_story_spec sama sekali (pasangan itu ditolak
  // Meta sebagai Ambiguous Promoted Object), jadi identitas dibawa object_id.
  //
  // Kecuali bila objectStoryId dipakai: post ID ("{page-id}_{post-id}") sudah
  // meng-anchor Page-nya sendiri, sehingga object_id kedua hanya menambah sinyal
  // identitas yang bertentangan — keluarga yang sama dengan penolakan Ambiguous
  // Promoted Object. BELUM diverifikasi terhadap API live: kombinasi
  // existing_post + objectStoryId + partnership tidak punya contoh resmi di
  // dokumentasi Meta, jadi bentuk ini adalah pilihan paling tidak kontradiktif,
  // bukan bentuk yang sudah terbukti.
  if (creativeFormat === 'existing_post' && !trimmed(input.objectStoryId)) {
    payload.object_id = primaryPageId;
  }

  if (sponsorPageId) {
    payload.facebook_branded_content = { sponsor_page_id: sponsorPageId };
  }
  if (sponsorInstagramId) {
    payload.instagram_branded_content = { sponsor_id: sponsorInstagramId };
  }
  // Contoh boost via media ID di dokumentasi Meta membawa branded_content hanya
  // berisi ad_format, tanpa ad code. adFormat sendirian karena itu tetap dikirim,
  // bukan dibuang diam-diam.
  if (adCode) {
    payload.branded_content = {
      instagram_boost_post_access_token: adCode,
      ad_format: adFormat,
    };
  } else if (adFormat) {
    payload.branded_content = { ad_format: adFormat };
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

  if (partnership.primaryIdentity === 'creator' && !trimmed(partnership.brandInstagramId)) {
    notes.push(
      "primaryIdentity 'creator' dipakai tanpa brandInstagramId, sehingga instagram_branded_content tidak dikirim. " +
        'Meta akan mencoba menautkan akun Instagram advertiser dari sponsor_page_id, ' +
        'tetapi bila Page dan akun Instagram advertiser tidak ter-link, sisi Instagram iklan tidak membawa identitas sponsor.'
    );
  }

  return notes;
}
