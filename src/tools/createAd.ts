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
  /** Skip the ad-set creative-family pre-flight check (use only if Meta changes this constraint). */
  skipAdSetCreativeFamilyCheck?: boolean;
}

export type CreateAdStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed' | 'deduped';

export interface CreateAdResult {
  operation: 'create_ad';
  status: CreateAdStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
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
          'Ad Set creative-family pre-flight skipped by request. Continue only if Ads Manager confirms this Ad Set can accept the new creative format.',
        ]
      : []),
  ];
  const warnings = skipWarnings.length > 0 ? skipWarnings : undefined;
  const baseResult: CreateAdResult = {
    operation: 'create_ad',
    status: 'dry_run',
    executed: false,
    preview,
    ...(warnings ? { warnings } : {}),
  };

  // Pre-flight: an omnichannel ad set requires an omnichannel-ready creative.
  // Surface this during dry-run so the mismatch is caught before any ad is made.
  if (options.creativeId && !options.skipOmnichannelCheck) {
    const omnichannelError = await getOmnichannelCompatibilityError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (omnichannelError) {
      return { ...baseResult, status: 'failed', executed: false, error: omnichannelError };
    }
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
      return {
        ...baseResult,
        status: 'failed',
        executed: false,
        error: messagingDestinationError,
      };
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
      return {
        ...baseResult,
        status: 'failed',
        executed: false,
        error: dynamicCreativePolicyError,
      };
    }
  } else if (options.creativeId) {
    const placementCompatibility = await getPlacementCompatibilityError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (placementCompatibility) {
      return {
        ...baseResult,
        status: 'failed',
        executed: false,
        error: placementCompatibility.message,
      };
    }
  }

  if (options.creativeId && !options.skipAdSetCreativeFamilyCheck) {
    const adSetCreativeFamilyError = await getAdSetCreativeFamilyCompatibilityError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (adSetCreativeFamilyError) {
      return {
        ...baseResult,
        status: 'failed',
        executed: false,
        error: adSetCreativeFamilyError,
      };
    }
  }

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  const accountPath = normalizeAccountPath(options.adAccountId);

  if (options.dedupeByName) {
    const existing = await findExistingAdByName(client, options.adSetId, options.name, maxRetries);
    if (existing) {
      return {
        ...baseResult,
        status: 'deduped',
        executed: false,
        id: existing.id,
        response: { deduped: true, existing },
      };
    }
  }

  try {
    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/ads`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created ad',
      };
    }

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      id: response.id,
      response,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
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
    client.metaGetObject<Record<string, unknown>>(
      `/${creativeId}`,
      { fields: 'asset_feed_spec' },
      maxRetries
    ),
  ]);

  const assetFeedSpec = isRecord(creative.asset_feed_spec) ? creative.asset_feed_spec : undefined;
  const hasPlacementRules = Array.isArray(assetFeedSpec?.asset_customization_rules)
    ? assetFeedSpec.asset_customization_rules.length > 0
    : false;
  const hasFlexibleMultiVariants = hasMultiVariantTextAssets(assetFeedSpec) && !hasPlacementRules;
  const hasDynamicAssetFeed =
    assetFeedSpec !== undefined &&
    Object.keys(assetFeedSpec).length > 0 &&
    !hasPlacementRules &&
    !hasCatalogSignal(creative, assetFeedSpec);

  if (adSet.is_dynamic_creative === true) {
    return {
      message:
        'Dynamic Creative ad set is disabled in this MCP. Create or use a normal manual ad set instead.',
      policyBlocked: true,
    };
  }

  if (hasDynamicAssetFeed) {
    return {
      message: hasFlexibleMultiVariants
        ? 'Creative flexible multi-varian dengan beberapa primary text/headline tidak didukung untuk create baru di MCP ini. Jangan set Dynamic Creative untuk iklan normal; gunakan single_image/video/carousel biasa, buat beberapa manual creative/ad terpisah untuk variasi headline/caption/copy/image/video, atau gunakan placement customization dengan asset_customization_rules untuk media per placement.'
        : 'Dynamic Creative/Flexible asset-feed ads are disabled in this MCP. Use separate manual ads, catalog or collection ads, or placement customization with asset_customization_rules instead.',
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

function buildMultiMediaCreative(options: MetaMultiMediaAdOptions): Record<string, unknown> {
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

type CreativeFamily =
  | 'manual_static'
  | 'dynamic_flexible'
  | 'catalog_dynamic'
  | 'placement_customized';

interface ExistingAdWithCreative extends Record<string, unknown> {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  creative?: Record<string, unknown>;
}

async function getAdSetCreativeFamilyCompatibilityError(
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

    const newFamily = classifyCreativeFamily(newCreative);
    const conflictingAd = existingAdsResponse.data
      ?.filter((ad) => !isArchivedOrDeleted(ad))
      .map((ad) => ({ ad, family: classifyCreativeFamily(ad.creative) }))
      .find(({ family }) => family !== undefined && creativeFamiliesConflict(family, newFamily));

    if (!conflictingAd) return undefined;

    return (
      `Ad Set ${adSetId} sudah berisi iklan ${creativeFamilyLabel(conflictingAd.family)} ` +
      `(${conflictingAd.ad.name ?? conflictingAd.ad.id ?? 'existing ad'}), tetapi creative baru ` +
      `${creativeId} terdeteksi sebagai ${creativeFamilyLabel(newFamily)}. Meta menolak campuran ` +
      'format creative yang berbeda dalam 1 Ad Set (sering muncul sebagai error #1885274). ' +
      'Buat Ad Set baru/duplikat untuk format baru ini, atau gunakan creative dengan family yang sama.'
    );
  } catch {
    return undefined;
  }
}

function classifyCreativeFamily(creative: Record<string, unknown> | undefined): CreativeFamily {
  if (!creative) return 'manual_static';

  const assetFeedSpec = isRecord(creative.asset_feed_spec) ? creative.asset_feed_spec : undefined;
  if (hasCatalogSignal(creative, assetFeedSpec)) return 'catalog_dynamic';

  if (assetFeedSpec) {
    const hasPlacementRules = Array.isArray(assetFeedSpec.asset_customization_rules)
      ? assetFeedSpec.asset_customization_rules.length > 0
      : false;
    return hasPlacementRules ? 'placement_customized' : 'dynamic_flexible';
  }

  return 'manual_static';
}

function creativeFamiliesConflict(left: CreativeFamily, right: CreativeFamily): boolean {
  return left !== right;
}

function creativeFamilyLabel(family: CreativeFamily): string {
  switch (family) {
    case 'manual_static':
      return 'manual/static';
    case 'dynamic_flexible':
      return 'dynamic/flexible asset-feed';
    case 'catalog_dynamic':
      return 'catalog/dynamic product';
    case 'placement_customized':
      return 'placement-customized asset-feed';
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
