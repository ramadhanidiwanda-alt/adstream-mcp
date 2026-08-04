import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';
import { getOmnichannelCompatibilityError } from '../providers/meta/omnichannelAdCompatibility.js';
import { getMessagingDestinationCompatibilityError } from '../providers/meta/messagingDestinationCompatibility.js';

export type AdStatus = 'ACTIVE' | 'PAUSED';

export interface CreateAdOptions {
  adAccountId: string;
  name: string;
  adSetId: string;
  creativeId: string;
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
  if (!options.skipOmnichannelCheck) {
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
  if (!options.skipMessagingDestinationCheck) {
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

  if (!options.skipPlacementCompatibilityCheck) {
    const placementCompatibilityError = await getPlacementCompatibilityError(
      client,
      options.adSetId,
      options.creativeId,
      maxRetries
    );
    if (placementCompatibilityError) {
      return {
        ...baseResult,
        status: 'failed',
        executed: false,
        error: placementCompatibilityError,
      };
    }
  }

  if (!options.skipAdSetCreativeFamilyCheck) {
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
): Promise<string | undefined> {
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

  if (adSet.is_dynamic_creative !== true && hasFlexibleMultiVariants) {
    return 'Creative flexible multi-varian dengan beberapa primary text/headline tidak didukung untuk create baru di MCP ini. Jangan set Dynamic Creative untuk iklan normal; gunakan single_image/video/carousel biasa, buat beberapa manual creative/ad terpisah untuk variasi headline/caption/copy/image/video, atau gunakan placement customization dengan asset_customization_rules untuk media per placement.';
  }

  if (
    adSet.destination_type === 'WHATSAPP' &&
    adSet.is_dynamic_creative !== true &&
    hasPlacementRules
  ) {
    return 'Creative placement multi-ukuran via API tidak kompatibel dengan adset WhatsApp non-Dynamic Creative ini. Gunakan satu gambar via API atau atur media per placement secara manual di Ads Manager.';
  }

  return undefined;
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
  const payload: Record<string, unknown> = {
    name: options.name.trim(),
    adset_id: options.adSetId,
    creative: JSON.stringify({ creative_id: options.creativeId }),
    status: options.status ?? 'PAUSED',
  };

  const trackingSpecs = options.trackingSpecs ?? buildPixelTrackingSpecs(options.pixelId);
  if (trackingSpecs) {
    payload.tracking_specs = trackingSpecs;
  }

  if (options.adLabels) {
    payload.adlabels = options.adLabels;
  }

  return payload;
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
