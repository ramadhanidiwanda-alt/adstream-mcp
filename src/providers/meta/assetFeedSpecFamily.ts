/**
 * Klasifikasi asset_feed_spec berdasarkan optimization_type.
 *
 * Beberapa fitur Meta yang sama sekali berbeda sama-sama memakai field
 * `asset_feed_spec`, dan isinya terlihat mirip (beberapa bodies/titles). Yang
 * membedakan fitur mana yang dipakai adalah `optimization_type` — BUKAN jumlah
 * aset, dan bukan pula sekadar ada tidaknya `asset_customization_rules`:
 *
 * - `REGULAR`            -> Dynamic Creative. Ad set wajib `is_dynamic_creative=true`,
 *                          ad set harus kosong, dan hanya boleh berisi SATU ad.
 *                          "Then set is_dynamic_creative to true." / "At this point,
 *                          your ad set must be empty. ... You can only create one ad
 *                          per ad set."
 *                          https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/asset-feed-spec/dynamic-creative
 * - `DEGREES_OF_FREEDOM` -> Advantage+ creative / text generation: beberapa varian
 *                          primary text & headline pada ad BIASA. Tidak ada syarat
 *                          `is_dynamic_creative`, tidak ada batas satu ad per ad set.
 *                          Contoh POST resmi mengirim optimization_type ini bersama
 *                          5 bodies + 5 titles tanpa rules sama sekali:
 *                          https://developers.facebook.com/docs/app-ads/advantage-app-campaigns/
 *                          https://developers.facebook.com/documentation/ads-commerce/marketing-api/creative/generative-ai-features
 * - `ASSET_CUSTOMIZATION` / `PLACEMENT` / `LANGUAGE`
 *                       -> Asset customization lewat `asset_customization_rules`.
 *                          "set is_dynamic_creative to false" / "You can create
 *                          multiple ads per ad set." Meta mensyaratkan minimal dua
 *                          rules: "All ads using asset_feed_spec must contain at
 *                          least two target customization rules."
 *                          https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/asset-feed-spec/asset-customization-rules
 * - `FORMAT_AUTOMATION`  -> Advantage+ creative for catalog.
 *
 * PENTING soal default: `optimization_type` bersifat opsional, dan bila tidak
 * dikirim Meta mengisinya `REGULAR`. Jadi asset_feed_spec multi-teks yang dikirim
 * TANPA optimization_type akan menjadi Dynamic Creative dan attach-nya ditolak
 * `(#100) subcode 1885998` di ad set non-dynamic. Itulah yang membuat probe lama
 * menyimpulkan "multi-teks = Dynamic Creative": yang terbukti sebenarnya adalah
 * "multi-teks tanpa optimization_type = Dynamic Creative".
 */

/** Nilai optimization_type yang dikenal dari dokumentasi Meta. */
export type AssetFeedOptimizationType =
  | 'REGULAR'
  | 'ASSET_CUSTOMIZATION'
  | 'PLACEMENT'
  | 'LANGUAGE'
  | 'DEGREES_OF_FREEDOM'
  | 'FORMAT_AUTOMATION';

const CUSTOMIZATION_OPTIMIZATION_TYPES = new Set<AssetFeedOptimizationType>([
  'ASSET_CUSTOMIZATION',
  'PLACEMENT',
  'LANGUAGE',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Baca optimization_type dari sebuah asset_feed_spec.
 *
 * Mengembalikan `undefined` bila field-nya tidak ada — yang secara efektif berarti
 * `REGULAR`, tapi pemanggil perlu bisa membedakan "tidak dikirim" dari "dikirim
 * REGULAR" supaya pesan errornya bisa menyarankan mengisi field tersebut.
 */
export function readOptimizationType(value: unknown): AssetFeedOptimizationType | undefined {
  if (!isRecord(value)) return undefined;
  const raw = value.optimization_type;
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toUpperCase();
  switch (normalized) {
    case 'REGULAR':
    case 'ASSET_CUSTOMIZATION':
    case 'PLACEMENT':
    case 'LANGUAGE':
    case 'DEGREES_OF_FREEDOM':
    case 'FORMAT_AUTOMATION':
      return normalized;
    default:
      return undefined;
  }
}

/** Jumlah asset_customization_rules pada sebuah asset_feed_spec. */
export function countCustomizationRules(value: unknown): number {
  if (!isRecord(value)) return 0;
  const rules = value.asset_customization_rules;
  return Array.isArray(rules) ? rules.length : 0;
}

/**
 * Keluarga creative untuk jalur BACA (creative yang sudah ada di Meta).
 *
 * Di jalur baca, satu rule saja sudah membuktikan ini asset customization —
 * ambang minimal 2 rules milik Meta hanya berlaku saat create.
 */
export type CreativeFamily =
  | 'manual_static'
  | 'advantage_text'
  | 'asset_customized'
  | 'dynamic_creative'
  | 'flexible_ad'
  | 'catalog_dynamic';

export function creativeFamilyLabel(family: CreativeFamily): string {
  switch (family) {
    case 'manual_static':
      return 'manual/static';
    case 'advantage_text':
      return 'Advantage+ text variations (DEGREES_OF_FREEDOM)';
    case 'asset_customized':
      return 'asset customization (asset_customization_rules)';
    case 'dynamic_creative':
      return 'Dynamic Creative (REGULAR tanpa rules)';
    case 'flexible_ad':
      return 'asset_feed_spec ad (non-dynamic creative ad set)';
    case 'catalog_dynamic':
      return 'catalog/dynamic product';
  }
}

/**
 * Hanya `dynamic_creative` yang punya batasan level ad set menurut dokumentasi
 * Meta (ad set wajib dynamic, harus kosong, maksimum satu ad). Keluarga lain
 * adalah ad biasa dan boleh berdampingan dengan ad mana pun di ad set yang sama.
 */
export function familyRequiresDynamicCreativeAdSet(family: CreativeFamily): boolean {
  return family === 'dynamic_creative';
}

/**
 * Di ad set non-dynamic (`is_dynamic_creative` false/absent), creative dengan
 * asset_feed_spec REGULAR bukan Dynamic Creative yang fungsional — Ads Manager
 * bisa membuat creative dengan `asset_feed_spec` REGULAR di ad set biasa lewat
 * jalur internal yang tidak terdokumentasi di Marketing API publik. Fungsi ini
 * me-remap `dynamic_creative` → `flexible_ad` supaya label dan perbandingan di
 * advisory akurat dan tidak menyesatkan user.
 */
export function remapFamilyForNonDynamicAdSet(family: CreativeFamily): CreativeFamily {
  return family === 'dynamic_creative' ? 'flexible_ad' : family;
}

/**
 * Klasifikasi creative yang DIBACA dari Meta.
 *
 * `hasCatalogSignal` diserahkan ke pemanggil karena sinyal katalog tersebar di
 * beberapa field di luar asset_feed_spec (product_set_id, template_data).
 */
export function classifyCreativeFamily(
  creative: Record<string, unknown> | undefined,
  options: { hasCatalogSignal?: boolean } = {}
): CreativeFamily {
  if (!creative) return 'manual_static';

  const assetFeedSpec = isRecord(creative.asset_feed_spec) ? creative.asset_feed_spec : undefined;
  const optimizationType = readOptimizationType(assetFeedSpec);

  if (options.hasCatalogSignal || optimizationType === 'FORMAT_AUTOMATION') {
    return 'catalog_dynamic';
  }
  if (!assetFeedSpec || Object.keys(assetFeedSpec).length === 0) return 'manual_static';
  if (optimizationType === 'DEGREES_OF_FREEDOM') return 'advantage_text';
  if (countCustomizationRules(assetFeedSpec) > 0) return 'asset_customized';
  if (optimizationType !== undefined && CUSTOMIZATION_OPTIMIZATION_TYPES.has(optimizationType)) {
    return 'asset_customized';
  }

  // REGULAR, atau optimization_type tidak dikirim (Meta mengisinya REGULAR).
  return 'dynamic_creative';
}

/** Verdict untuk jalur CREATE (asset_feed_spec yang akan KITA kirim). */
export type AssetFeedSpecCreateVerdict =
  | 'asset_customized'
  | 'advantage_text'
  | 'catalog_automation'
  | 'dynamic_creative'
  | 'too_few_rules';

/**
 * Klasifikasi asset_feed_spec untuk jalur CREATE.
 *
 * Berbeda dari jalur baca, di sini ambang minimal 2 rules milik Meta ditegakkan
 * supaya 1 rule gagal lokal dengan pesan jelas, bukan gagal di Graph API dengan
 * pesan yang membingungkan.
 */
export function classifyAssetFeedSpecForCreate(value: unknown): AssetFeedSpecCreateVerdict {
  const optimizationType = readOptimizationType(value);
  const ruleCount = countCustomizationRules(value);

  if (optimizationType === 'FORMAT_AUTOMATION') return 'catalog_automation';

  if (
    ruleCount > 0 ||
    (optimizationType !== undefined && CUSTOMIZATION_OPTIMIZATION_TYPES.has(optimizationType))
  ) {
    return ruleCount >= 2 ? 'asset_customized' : 'too_few_rules';
  }

  if (optimizationType === 'DEGREES_OF_FREEDOM') return 'advantage_text';

  // REGULAR, atau optimization_type tidak dikirim (Meta mengisinya REGULAR).
  return 'dynamic_creative';
}
