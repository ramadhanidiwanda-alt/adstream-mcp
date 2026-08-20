import type { MetaClient } from '../metaClient.js';
import type {
  MetaMultiMediaAdOptions,
  MetaMultiMediaTextCustomizations,
  StructuredMutationError,
} from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';
import { getOmnichannelCompatibilityError } from '../providers/meta/omnichannelAdCompatibility.js';
import { getMessagingDestinationCompatibilityError } from '../providers/meta/messagingDestinationCompatibility.js';
import {
  classifyCreativeFamily,
  creativeFamilyLabel,
  familyRequiresDynamicCreativeAdSet,
  readOptimizationType,
  type CreativeFamily,
} from '../providers/meta/assetFeedSpecFamily.js';

export type AdStatus = 'ACTIVE' | 'PAUSED';

/** @deprecated Import MetaMultiMediaPlacementExclusion from ../types.js instead. */
export type MultiMediaPlacementExclusion = import('../types.js').MetaMultiMediaPlacementExclusion;
export type {
  MetaMultiMediaAdOptions,
  MetaMultiMediaImage,
  MetaMultiMediaTextCustomizations,
  MetaMultiMediaTextVariant,
} from '../types.js';

export interface CreateAdOptions {
  adAccountId: string;
  name: string;
  adSetId: string;
  creativeId?: string;
  /** Inline Meta multi-media creative (2-10 images), mutually exclusive with creativeId. */
  multiMedia?: MetaMultiMediaAdOptions;
  /**
   * Optional Ads Manager source ad. Meta uses this composer context for CTWA
   * state that is not expressed by a standalone creative, while creativeId
   * remains the creative attached to the new ad.
   */
  sourceAdId?: string;
  status?: AdStatus;
  /** Meta Pixel ID to attach as ad-level offsite conversion tracking_specs. */
  pixelId?: string;
  trackingSpecs?: Array<Record<string, unknown>>;
  adLabels?: Array<{ name: string }>;
  dedupeByName?: boolean;
  externalReference?: string;
  /** Skip the omnichannel creative pre-flight check (use only if the heuristic misfires). */
  skipOmnichannelCheck?: boolean;
  /**
   * Skip the placement compatibility pre-flight check.
   * Use for CTWA placement customization paths that intentionally do not rely on Dynamic Creative.
   */
  skipPlacementCompatibilityCheck?: boolean;
  /** Skip the messaging destination/CTA cross-check (use only if the mapping misfires). */
  skipMessagingDestinationCheck?: boolean;
  /** Skip the ad-set creative-family advisory (suppresses the warning and its Graph reads). */
  skipAdSetCreativeFamilyCheck?: boolean;
}

export type CreateAdStatus =
  | 'dry_run'
  | 'pending_confirmation'
  | 'executed'
  /** Sebuah pre-flight LOKAL menolak permintaan ini. Meta belum pernah dihubungi. */
  | 'preflight_blocked'
  /** Meta yang menolak: `error` berasal dari respons Graph API sungguhan. */
  | 'failed'
  | 'deduped';

/**
 * Asal sebuah `error`.
 *
 * `local_preflight` adalah PREDIKSI heuristik milik MCP ini, bukan jawaban Meta —
 * jangan pernah melaporkannya sebagai "Meta menolak". `meta_api` berarti error
 * benar-benar dikembalikan Graph API.
 */
export type CreateAdErrorSource = 'local_preflight' | 'meta_api';

export interface CreateAdResult {
  operation: 'create_ad';
  status: CreateAdStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  /** Dari mana `error` berasal. Absen bila tidak ada error. */
  errorSource?: CreateAdErrorSource;
  /** Nama pre-flight lokal yang memblokir, bila `errorSource` = local_preflight. */
  preflightCheck?: string;
  structuredError?: StructuredMutationError;
  warnings?: string[];
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

/**
 * Create a Meta ad under an existing ad set with a reference to an existing creative.
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 *
 * POST /act_{ad_account_id}/ads
 *
 * Returns ad ID on success.
 */
export async function createAd(
  client: MetaClient,
  options: CreateAdOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreateAdResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  const preview = buildAdPayload(options);
  if (options.externalReference) {
    preview.external_reference = options.externalReference;
  }
  const skipWarnings = [
    ...(options.skipPlacementCompatibilityCheck
      ? [
          'Placement compatibility pre-flight skipped by request. Continue only after reviewing the creative payload and Meta preview.',
        ]
      : []),
    ...(options.skipMessagingDestinationCheck
      ? [
          'Messaging destination/CTA cross-check skipped by request. Confirm in Ads Manager that the CTA button opens the intended inbox before activating.',
        ]
      : []),
    ...(options.skipAdSetCreativeFamilyCheck
      ? [
          'Ad Set creative-family advisory skipped by request. Mixing formats is not blocked either way — no Meta rule forbids it; without the advisory you will not be told what the Ad Set already contains.',
        ]
      : []),
  ];
  const advisories: string[] = [...skipWarnings];
  const buildResult = (overrides: Partial<CreateAdResult> = {}): CreateAdResult => ({
    operation: 'create_ad',
    status: 'dry_run',
    executed: false,
    preview,
    ...(advisories.length > 0 ? { warnings: [...advisories] } : {}),
    ...overrides,
  });

  // Semua blok di bawah ini adalah pre-flight LOKAL: Meta belum dihubungi sama
  // sekali. Hasilnya ditandai `preflight_blocked` + errorSource `local_preflight`
  // supaya tidak pernah terbaca sebagai penolakan Graph API oleh sesi/agent lain.
  const preflightBlocked = (check: string, message: string): CreateAdResult =>
    buildResult({
      status: 'preflight_blocked',
      executed: false,
      error: message,
      errorSource: 'local_preflight',
      preflightCheck: check,
    });

  // Pre-flight: an omnichannel ad set requires an omnichannel-ready creative.
  // Surface this during dry-run so the mismatch is caught before any ad is made.
  if (options.creativeId && !options.skipOmnichannelCheck) {
    const omnichannelError = await getOmnichannelCompatibilityError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (omnichannelError) return preflightBlocked('omnichannel_compatibility', omnichannelError);
  }

  // Pre-flight: a click-to-message ad set needs a creative whose CTA opens the same
  // inbox. Meta accepts the mismatch and the ad runs with a button pointing elsewhere.
  if (options.creativeId && !options.skipMessagingDestinationCheck) {
    const messagingDestinationError = await getMessagingDestinationCompatibilityError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (messagingDestinationError) {
      return preflightBlocked('messaging_destination', messagingDestinationError);
    }
  }

  if (options.creativeId && options.skipPlacementCompatibilityCheck) {
    const dynamicCreativePolicyError = await getDynamicCreativePolicyError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (dynamicCreativePolicyError) {
      return preflightBlocked('dynamic_creative_policy', dynamicCreativePolicyError);
    }
  } else if (options.creativeId) {
    const placementCompatibility = await getPlacementCompatibilityError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (placementCompatibility) {
      return preflightBlocked('placement_compatibility', placementCompatibility.message);
    }
  }

  // Advisory only. Meta's documented constraint lives on the AD SET
  // (`is_dynamic_creative=true` requires an empty ad set and allows a single ad),
  // and that case is already hard-blocked above by the Dynamic Creative policy
  // check. Meta publishes no error for mixing creative families inside a normal
  // `is_dynamic_creative=false` ad set, and live creates on 2026-08-18 confirmed
  // it accepts manual/static ads next to an existing asset-feed ad. So surface
  // the mismatch and let Meta decide — a rejected POST creates nothing.
  if (options.creativeId && !options.skipAdSetCreativeFamilyCheck) {
    const adSetCreativeFamilyWarning = await getAdSetCreativeFamilyWarning(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (adSetCreativeFamilyWarning) advisories.push(adSetCreativeFamilyWarning);
  }

  if (dryRun) return buildResult();

  if (!confirmed) {
    return buildResult({
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    });
  }

  const accountPath = normalizeAccountPath(options.adAccountId);

  if (options.dedupeByName) {
    const existing = await findExistingAdByName(client, options.adSetId, options.name, maxRetries);
    if (existing) {
      return buildResult({
        status: 'deduped',
        executed: false,
        id: existing.id,
        response: { deduped: true, existing },
      });
    }
  }

  try {
    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/ads`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return buildResult({
        status: 'failed',
        errorSource: 'meta_api',
        error: 'Meta did not return an id for created ad',
      });
    }

    return buildResult({
      status: 'executed',
      executed: true,
      id: response.id,
      response,
    });
  } catch (error) {
    return buildResult({
      status: 'failed',
      errorSource: 'meta_api',
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    });
  }
}

/**
 * Baca creative untuk pre-flight kompatibilitas.
 *
 * `object_story_spec` dan `product_set_id` dibutuhkan untuk mendeteksi sinyal
 * katalog; tanpa keduanya creative katalog salah diklasifikasi sebagai Dynamic
 * Creative dan diblokir. Tapi Meta menolak sebagian field per creative/versi API
 * dengan `(#100) Tried accessing nonexisting field`, dan pemanggil pre-flight ini
 * tidak dibungkus try/catch — satu field yang ditolak akan menggagalkan seluruh
 * create. Karena itu field tambahan bersifat best-effort: kalau ditolak, ulangi
 * dengan `asset_feed_spec` saja, yang cukup untuk keputusan Dynamic Creative.
 */
async function readCreativeForCompatibility(
  client: MetaClient,
  creativeId: string,
  maxRetries: number
): Promise<Record<string, unknown>> {
  try {
    return await client.metaGetObject<Record<string, unknown>>(
      `/${creativeId}`,
      { fields: 'asset_feed_spec,object_story_spec,product_set_id' },
      maxRetries
    );
  } catch {
    return client.metaGetObject<Record<string, unknown>>(
      `/${creativeId}`,
      { fields: 'asset_feed_spec' },
      maxRetries
    );
  }
}

async function getPlacementCompatibilityError(
  client: MetaClient,
  adSetId: string,
  creativeId: string,
  maxRetries: number
): Promise<{ message: string; policyBlocked: boolean } | undefined> {
  const [adSet, creative] = await Promise.all([
    client.metaGetObject<Record<string, unknown>>(
      `/${adSetId}`,
      { fields: 'destination_type,is_dynamic_creative' },
      maxRetries
    ),
    readCreativeForCompatibility(client, creativeId, maxRetries),
  ]);

  const assetFeedSpec = isRecord(creative.asset_feed_spec) ? creative.asset_feed_spec : undefined;
  // Creative ini DIBACA dari Meta, bukan input yang kita kirim: satu rule saja
  // sudah membuktikan ini asset customization. Ambang minimal 2 rules milik Meta
  // hanya berlaku di jalur create.
  const hasPlacementRules = Array.isArray(assetFeedSpec?.asset_customization_rules)
    ? assetFeedSpec.asset_customization_rules.length > 0
    : false;
  const family = classifyCreativeFamily(creative, {
    hasCatalogSignal: hasCatalogSignal(creative, assetFeedSpec),
  });
  const hasMultiVariants = hasMultiVariantTextAssets(assetFeedSpec);
  const optimizationTypeSent = readOptimizationType(assetFeedSpec) !== undefined;

  if (adSet.is_dynamic_creative === true) {
    return {
      message:
        'Dynamic Creative ad set is disabled in this MCP. Create or use a normal manual ad set instead.',
      policyBlocked: true,
    };
  }

  // Hanya Dynamic Creative (optimization_type REGULAR, atau tidak dikirim sama
  // sekali sehingga Meta mengisinya REGULAR) yang butuh ad set dynamic.
  // DEGREES_OF_FREEDOM dan asset customization adalah ad biasa — keduanya lolos.
  if (familyRequiresDynamicCreativeAdSet(family)) {
    return {
      message: hasMultiVariants
        ? `Creative ini punya beberapa primary text/headline di asset_feed_spec dengan optimization_type ${optimizationTypeSent ? 'REGULAR' : 'kosong (Meta mengisinya REGULAR)'} — itu jalur Dynamic Creative, yang menuntut ad set is_dynamic_creative=true dan membatasi ad set jadi satu ad, dan tidak didukung di MCP ini. Yang menentukan adalah optimization_type, bukan jumlah aset: kirim optimization_type "DEGREES_OF_FREEDOM" dan beberapa varian teks yang sama justru sah pada ad biasa (Advantage+ text variations). Alternatif lain: asset_customization_rules (minimal 2) untuk aset per placement/language/segment, atau beberapa manual creative/ad terpisah.`
        : `asset_feed_spec dengan optimization_type ${optimizationTypeSent ? 'REGULAR' : 'kosong (Meta mengisinya REGULAR)'} adalah jalur Dynamic Creative dan tidak didukung di MCP ini. Set optimization_type "DEGREES_OF_FREEDOM" untuk varian teks pada ad biasa, tambahkan asset_customization_rules (minimal 2) untuk asset customization, atau pakai manual/catalog/collection ad.`,
      policyBlocked: true,
    };
  }

  if (
    adSet.destination_type === 'WHATSAPP' &&
    adSet.is_dynamic_creative !== true &&
    hasPlacementRules
  ) {
    return {
      message:
        'Creative placement multi-ukuran via API tidak kompatibel dengan adset WhatsApp non-Dynamic Creative ini. Gunakan satu gambar via API atau atur media per placement secara manual di Ads Manager.',
      policyBlocked: false,
    };
  }

  return undefined;
}

async function getDynamicCreativePolicyError(
  client: MetaClient,
  adSetId: string,
  creativeId: string,
  maxRetries: number
): Promise<string | undefined> {
  const placementCompatibility = await getPlacementCompatibilityError(
    client,
    adSetId,
    creativeId,
    maxRetries
  );
  return placementCompatibility?.policyBlocked ? placementCompatibility.message : undefined;
}

interface ExistingNamedAd extends Record<string, unknown> {
  id: string;
  name?: string;
  status?: string;
}

async function findExistingAdByName(
  client: MetaClient,
  adSetId: string,
  name: string,
  maxRetries: number
): Promise<ExistingNamedAd | null> {
  const response = await client.metaGet<{ data?: ExistingNamedAd[] }>(
    `/${adSetId}/ads`,
    {
      fields: 'id,name,status',
      limit: 100,
    },
    { maxRetries, paginate: true, maxPages: 20 }
  );

  return response.data?.find((ad) => ad.name === name.trim()) ?? null;
}

function buildAdPayload(options: CreateAdOptions): Record<string, unknown> {
  const hasCreativeId = Boolean(options.creativeId?.trim());
  const hasMultiMedia = options.multiMedia !== undefined;
  if (hasCreativeId === hasMultiMedia) {
    throw new Error('Isi tepat satu dari creativeId atau multiMedia.');
  }

  const payload: Record<string, unknown> = {
    name: options.name.trim(),
    adset_id: options.adSetId,
    creative: JSON.stringify(
      options.multiMedia
        ? buildMultiMediaCreative(options.multiMedia)
        : { creative_id: options.creativeId }
    ),
    status: options.status ?? 'PAUSED',
  };

  const sourceAdId = options.sourceAdId?.trim();
  if (sourceAdId) payload.source_ad_id = sourceAdId;

  const trackingSpecs = options.trackingSpecs ?? buildPixelTrackingSpecs(options.pixelId);
  if (trackingSpecs) {
    payload.tracking_specs = trackingSpecs;
  }

  if (options.adLabels) {
    payload.adlabels = options.adLabels;
  }

  return payload;
}

export function buildMultiMediaCreative(options: MetaMultiMediaAdOptions): Record<string, unknown> {
  const pageId = requiredString(options.pageId, 'multiMedia.pageId');
  const primaryImageHash = requiredString(options.primaryImageHash, 'multiMedia.primaryImageHash');
  const destinationUrl = requiredString(options.destinationUrl, 'multiMedia.destinationUrl');
  const callToAction = requiredString(options.callToAction, 'multiMedia.callToAction');
  if (options.images.length < 2 || options.images.length > 10) {
    throw new Error('multiMedia.images harus berisi 2 sampai 10 gambar.');
  }

  const hashes = options.images.map((image) =>
    requiredString(image.imageHash, 'multiMedia.images[].imageHash')
  );
  if (!hashes.includes(primaryImageHash)) {
    throw new Error('multiMedia.primaryImageHash harus tercantum di multiMedia.images.');
  }
  if (new Set(hashes).size !== hashes.length) {
    throw new Error('multiMedia.images tidak boleh berisi imageHash duplikat.');
  }

  const primaryText = optionalString(options.primaryText);
  const headline = optionalString(options.headline);
  const description = optionalString(options.description);

  return {
    object_story_spec: {
      page_id: pageId,
      ...(optionalString(options.instagramUserId)
        ? { instagram_user_id: options.instagramUserId!.trim() }
        : {}),
      link_data: {
        link: destinationUrl,
        image_hash: primaryImageHash,
        ...(primaryText ? { message: primaryText } : {}),
        ...(headline ? { name: headline } : {}),
        ...(description ? { description } : {}),
        call_to_action: { type: callToAction },
        ...(options.pageWelcomeMessage ? { page_welcome_message: options.pageWelcomeMessage } : {}),
      },
    },
    media_sourcing_spec: {
      ...(primaryText ? { bodies: [{ text: primaryText }] } : {}),
      ...(headline ? { titles: [{ text: headline }] } : {}),
      ...(description ? { descriptions: [{ text: description }] } : {}),
      images: options.images.map((image) => {
        const textCustomizations = buildTextCustomizations(image.textCustomizations);
        return {
          hash: image.imageHash.trim(),
          source: 'multi_media',
          opt_in_status: 'opt_in',
          ...(image.placementExclusions?.length
            ? {
                placement_customizations: image.placementExclusions.map((exclusion) => ({
                  publisher_platform: requiredString(
                    exclusion.publisherPlatform,
                    'multiMedia.images[].placementExclusions[].publisherPlatform'
                  ),
                  placement_exclusions: nonEmptyStrings(
                    exclusion.positions,
                    'multiMedia.images[].placementExclusions[].positions'
                  ),
                })),
              }
            : {}),
          ...(textCustomizations ? { text_customizations: textCustomizations } : {}),
        };
      }),
    },
  };
}

function buildTextCustomizations(
  customizations: MetaMultiMediaTextCustomizations | undefined
): Record<string, Array<{ text: string }>> | undefined {
  if (!customizations) return undefined;

  const titles = normalizeTextVariants(customizations.titles, 'textCustomizations.titles');
  const bodies = normalizeTextVariants(customizations.bodies, 'textCustomizations.bodies');
  const descriptions = normalizeTextVariants(
    customizations.descriptions,
    'textCustomizations.descriptions'
  );
  const result = {
    ...(titles ? { titles } : {}),
    ...(bodies ? { bodies } : {}),
    ...(descriptions ? { descriptions } : {}),
  };

  if (Object.keys(result).length === 0) {
    throw new Error(
      'multiMedia.images[].textCustomizations harus berisi minimal satu text variant.'
    );
  }

  return result;
}

function normalizeTextVariants(
  variants: Array<{ text: string }> | undefined,
  field: string
): Array<{ text: string }> | undefined {
  if (!variants) return undefined;
  const normalized = variants
    .map((variant) => ({ text: requiredString(variant.text, `${field}[].text`) }))
    .filter((variant) => Boolean(variant.text));
  if (normalized.length === 0) throw new Error(`${field} harus berisi minimal satu text variant.`);
  return normalized;
}

function requiredString(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} wajib diisi.`);
  return normalized;
}

function optionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function nonEmptyStrings(values: string[], field: string): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) throw new Error(`${field} harus berisi minimal satu placement.`);
  return normalized;
}

function buildPixelTrackingSpecs(
  pixelId: string | undefined
): Array<Record<string, unknown>> | undefined {
  const normalizedPixelId = pixelId?.trim();
  if (!normalizedPixelId) return undefined;
  return [
    {
      'action.type': ['offsite_conversion'],
      fb_pixel: [normalizedPixelId],
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasMultiVariantTextAssets(assetFeedSpec: Record<string, unknown> | undefined): boolean {
  if (!assetFeedSpec) return false;
  return countArray(assetFeedSpec.bodies) > 1 || countArray(assetFeedSpec.titles) > 1;
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

interface ExistingAdWithCreative extends Record<string, unknown> {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  creative?: Record<string, unknown>;
}

/**
 * Laporkan bahwa Ad Set tujuan sudah berisi keluarga creative yang berbeda.
 *
 * Murni informasi — tidak pernah memblokir. Tidak ada aturan Meta yang melarang
 * campuran format creative dalam satu Ad Set; klaim lama bahwa Meta menolaknya
 * dengan `#1885274` tidak terbukti (kode itu tidak ada di error reference Meta
 * maupun sumber lain), dan ad set produksi terbukti menjalankan creative
 * manual/static berdampingan dengan creative DEGREES_OF_FREEDOM. Satu-satunya
 * batasan level ad set yang terdokumentasi milik Dynamic Creative, dan itu
 * ditegakkan terpisah oleh getPlacementCompatibilityError.
 *
 * Klasifikasinya memakai optimization_type supaya varian teks Advantage+ tidak
 * salah dilabeli Dynamic Creative di teks catatan ini.
 */
async function getAdSetCreativeFamilyWarning(
  client: MetaClient,
  adSetId: string,
  creativeId: string,
  maxRetries: number
): Promise<string | undefined> {
  try {
    const [newCreative, existingAdsResponse] = await Promise.all([
      client.metaGetObject<Record<string, unknown>>(
        `/${creativeId}`,
        {
          fields:
            'id,name,asset_feed_spec,object_story_spec,product_set_id,omnichannel_link_spec,applink_treatment',
        },
        maxRetries
      ),
      client.metaGet<{ data?: ExistingAdWithCreative[] }>(
        `/${adSetId}/ads`,
        {
          fields:
            'id,name,status,effective_status,creative{id,name,asset_feed_spec,object_story_spec,product_set_id,omnichannel_link_spec,applink_treatment}',
          limit: 100,
        },
        { maxRetries, paginate: true, maxPages: 20 }
      ),
    ]);

    const classify = (creative: Record<string, unknown> | undefined): CreativeFamily =>
      classifyCreativeFamily(creative, {
        hasCatalogSignal: creative
          ? hasCatalogSignal(
              creative,
              isRecord(creative.asset_feed_spec) ? creative.asset_feed_spec : undefined
            )
          : false,
      });

    const newFamily = classify(newCreative);
    const differentAd = existingAdsResponse.data
      ?.filter((ad) => !isArchivedOrDeleted(ad))
      .map((ad) => ({ ad, family: classify(ad.creative) }))
      .find(({ family }) => family !== newFamily);

    if (!differentAd) return undefined;

    return (
      `Ad Set ${adSetId} sudah berisi iklan ${creativeFamilyLabel(differentAd.family)} ` +
      `(${differentAd.ad.name ?? differentAd.ad.id ?? 'existing ad'}), sedangkan creative baru ` +
      `${creativeId} terdeteksi sebagai ${creativeFamilyLabel(newFamily)}. Ini catatan informasi, ` +
      'bukan masalah: tidak ada aturan Meta yang melarang campuran format creative dalam satu Ad ' +
      'Set, dan create tetap dilanjutkan. Satu-satunya batasan level ad set milik Meta adalah ' +
      'Dynamic Creative ("your ad set must be empty ... You can only create one ad per ad set"), ' +
      'yang sudah ditolak lebih dulu oleh pre-flight tersendiri. Set ' +
      'skipAdSetCreativeFamilyCheck=true untuk mematikan catatan ini beserta dua Graph read-nya.'
    );
  } catch {
    return undefined;
  }
}

function isArchivedOrDeleted(ad: ExistingAdWithCreative): boolean {
  const status = String(ad.effective_status ?? ad.status ?? '').toUpperCase();
  return status === 'ARCHIVED' || status === 'DELETED';
}

function hasCatalogSignal(
  creative: Record<string, unknown>,
  assetFeedSpec: Record<string, unknown> | undefined
): boolean {
  if (typeof creative.product_set_id === 'string' && creative.product_set_id.trim()) return true;
  if (typeof assetFeedSpec?.product_set_id === 'string' && assetFeedSpec.product_set_id.trim()) {
    return true;
  }

  const storySpec = isRecord(creative.object_story_spec) ? creative.object_story_spec : undefined;
  const templateData =
    storySpec && isRecord(storySpec.template_data) ? storySpec.template_data : undefined;
  return templateData !== undefined || isRecord(creative.template_data);
}
