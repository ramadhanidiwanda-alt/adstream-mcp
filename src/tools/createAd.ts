import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';
import { getOmnichannelCompatibilityError } from '../providers/meta/omnichannelAdCompatibility.js';

export type AdStatus = 'ACTIVE' | 'PAUSED';

export interface CreateAdOptions {
  adAccountId: string;
  name: string;
  adSetId: string;
  creativeId: string;
  status?: AdStatus;
  trackingSpecs?: Array<Record<string, unknown>>;
  adLabels?: Array<{ name: string }>;
  dedupeByName?: boolean;
  externalReference?: string;
  /** Skip the omnichannel creative pre-flight check (use only if the heuristic misfires). */
  skipOmnichannelCheck?: boolean;
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
  const baseResult: CreateAdResult = {
    operation: 'create_ad',
    status: 'dry_run',
    executed: false,
    preview,
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

  if (options.trackingSpecs) {
    payload.tracking_specs = options.trackingSpecs;
  }

  if (options.adLabels) {
    payload.adlabels = options.adLabels;
  }

  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
