import type { MetaClient } from '../metaClient.js';
import type { MetaMultiMediaAdOptions, StructuredMutationError } from '../types.js';
import { buildMultiMediaCreative } from './createAd.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export interface UpdateAdOptions {
  adId: string;
  /** Required only when multiMedia creates the replacement creative. */
  adAccountId?: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  /** Points this ad at a different, already-existing creative. */
  creativeId?: string;
  trackingSpecs?: Record<string, unknown>[];
  conversionDomain?: string;
  adScheduleStartTime?: string;
  adScheduleEndTime?: string;
  /**
   * Creates a standalone documented multi-media creative, then swaps this same
   * ad to it. It deliberately cannot change status or other ad fields.
   */
  multiMedia?: MetaMultiMediaAdOptions;
  /** Name for the replacement creative. The ad's own name is never changed. */
  multiMediaCreativeName?: string;
}

export type UpdateAdStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

const DRY_RUN_NOTICE =
  'DRY RUN — no changes were sent to Meta. Review the preview, then call again with dryRun=false and confirmed=true to execute. ' +
  'Dry-run assembles the payload locally and sends nothing to Meta, so it cannot detect invalid IDs, permission problems, or eligibility rules — those surface only on execution.';

const PENDING_CONFIRMATION_NOTICE =
  'NOT EXECUTED — waiting on explicit confirmation. Review the preview, then call again with confirmed=true to execute.';

export interface UpdateAdResult {
  operation: 'update_ad' | 'replace_ad_media';
  status: UpdateAdStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  success: boolean;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
  /**
   * Set only when creativeId was provided and the post-update read-back
   * of /{ad_id}?fields=creative confirmed the new creative id. The
   * read-back is best-effort: its failure does not fail the operation.
   */
  confirmedCreativeId?: string;
  /** Set when this operation created the standalone multi-media creative. */
  createdCreativeId?: string;
  verification?: {
    status: 'verified' | 'unverified';
    expectedImageHashes: string[];
    confirmedImageHashes: string[];
    placementExclusionsVerified: boolean;
    pageWelcomeMessageVerified: boolean;
  };
  /** True when this workflow paused a previously active ad before its creative changed. */
  adPausedForVerification?: boolean;
  /** A no-retry transport failure can be ambiguous: Meta may have created the creative. */
  ambiguousCreativeCreation?: boolean;
  /**
   * Human-readable statement of what did or did not reach Meta. success stays
   * true on a dry run because the call did what was asked — but a caller reading
   * only that boolean concludes the update landed, so the prose has to carry the
   * part the boolean cannot.
   */
  notice?: string;
}

/**
 * Update an existing Meta ad.
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 *
 * POST /{ad_id}
 */
export async function updateAd(
  client: MetaClient,
  options: UpdateAdOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<UpdateAdResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  if (options.multiMedia) {
    return replaceAdMedia(client, options, { dryRun, confirmed, maxRetries });
  }

  const preview = buildUpdateAdPayload(options);
  // success means "the call did what was asked, no error" — a dry-run that produced a
  // preview did. It used to report false here, which reads as a failed update.
  const baseResult: UpdateAdResult = {
    operation: 'update_ad',
    status: 'dry_run',
    executed: false,
    preview,
    success: true,
    notice: DRY_RUN_NOTICE,
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      success: false,
      notice: PENDING_CONFIRMATION_NOTICE,
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  try {
    const response = await client.metaPost<Record<string, unknown>>(
      `/${options.adId}`,
      preview,
      maxRetries
    );

    const confirmedCreativeId = options.creativeId
      ? await readBackCreativeId(client, options.adId, maxRetries)
      : undefined;

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      success: true,
      notice: undefined,
      id: options.adId,
      response,
      ...(confirmedCreativeId ? { confirmedCreativeId } : {}),
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      success: false,
      notice: undefined,
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

async function replaceAdMedia(
  client: MetaClient,
  options: UpdateAdOptions,
  execOptions: { dryRun: boolean; confirmed: boolean; maxRetries: number }
): Promise<UpdateAdResult> {
  if (!options.adAccountId?.trim()) {
    throw new Error('adAccountId is required when multiMedia replaces an existing ad creative.');
  }
  if (hasOtherUpdateFields(options)) {
    throw new Error(
      'multiMedia replacement cannot be combined with name, status, creativeId, tracking, conversion, or schedule updates. It preserves the existing ad unchanged except for its creative.'
    );
  }

  const creativeName =
    options.multiMediaCreativeName?.trim() || `Multi-media replacement for ad ${options.adId}`;
  const creativePayload = {
    name: creativeName,
    ...buildMultiMediaCreative(options.multiMedia!),
  };
  const expectedImageHashes = options.multiMedia!.images.map((image) => image.imageHash.trim());
  const preview = {
    create_creative: creativePayload,
    update_ad: { creative: { creative_id: '<created-creative-id>' } },
    preserves: ['ad_id', 'ad_set_id', 'ad_name', 'existing_ad_set_configuration'],
    safety:
      'This multiMedia replacement pauses the ad before swapping if it is ACTIVE at execution time, and never resumes it automatically. A plain creativeId swap does not pause the ad.',
  };
  const baseResult: UpdateAdResult = {
    operation: 'replace_ad_media',
    status: 'dry_run',
    executed: false,
    success: true,
    id: options.adId,
    preview,
    notice: DRY_RUN_NOTICE,
  };

  if (execOptions.dryRun) return baseResult;
  if (!execOptions.confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      success: false,
      notice: PENDING_CONFIRMATION_NOTICE,
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  let createdCreativeId: string | undefined;
  let adPausedForVerification = false;
  try {
    const currentStatus = await readCurrentAdStatus(client, options.adId, execOptions.maxRetries);
    if (currentStatus.status === 'ACTIVE' || currentStatus.effectiveStatus === 'ACTIVE') {
      await client.metaPost<Record<string, unknown>>(
        `/${options.adId}`,
        { status: 'PAUSED' },
        execOptions.maxRetries
      );
      adPausedForVerification = true;
    }

    const creativeResponse = await client.metaPost<{ id?: string }>(
      `${normalizeAccountPath(options.adAccountId)}/adcreatives`,
      creativePayload,
      0
    );
    createdCreativeId = creativeResponse.id;
    if (!createdCreativeId || typeof createdCreativeId !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        success: false,
        notice: undefined,
        error: 'Meta did not return an id for the replacement multi-media creative.',
      };
    }

    const response = await client.metaPost<Record<string, unknown>>(
      `/${options.adId}`,
      { creative: { creative_id: createdCreativeId } },
      execOptions.maxRetries
    );
    const readBack = await readBackMultiMediaCreative(client, options.adId, execOptions.maxRetries);
    const confirmedImageHashes =
      readBack.mediaSourcingSpec?.images
        ?.map((image) => image.hash)
        .filter((hash): hash is string => typeof hash === 'string') ?? [];
    const verified =
      readBack.creativeId === createdCreativeId &&
      expectedImageHashes.every((hash) => confirmedImageHashes.includes(hash)) &&
      placementExclusionsMatch(options.multiMedia!, readBack.mediaSourcingSpec) &&
      pageWelcomeMessageMatches(
        options.multiMedia!.pageWelcomeMessage,
        readBack.pageWelcomeMessage
      );
    const placementExclusionsVerified = placementExclusionsMatch(
      options.multiMedia!,
      readBack.mediaSourcingSpec
    );
    const pageWelcomeMessageVerified = pageWelcomeMessageMatches(
      options.multiMedia!.pageWelcomeMessage,
      readBack.pageWelcomeMessage
    );

    if (!verified) {
      return {
        ...baseResult,
        status: 'failed',
        executed: true,
        success: false,
        notice: undefined,
        createdCreativeId,
        ...(adPausedForVerification ? { adPausedForVerification } : {}),
        confirmedCreativeId: readBack.creativeId,
        response,
        verification: {
          status: 'unverified',
          expectedImageHashes,
          confirmedImageHashes,
          placementExclusionsVerified,
          pageWelcomeMessageVerified,
        },
        error:
          'Meta accepted the creative swap, but read-back could not verify the expected multi-media creative. Do not activate or make further changes until this ad is inspected in Ads Manager.',
      };
    }

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      success: true,
      notice: undefined,
      createdCreativeId,
      ...(adPausedForVerification ? { adPausedForVerification } : {}),
      confirmedCreativeId: readBack.creativeId,
      response,
      verification: {
        status: 'verified',
        expectedImageHashes,
        confirmedImageHashes,
        placementExclusionsVerified,
        pageWelcomeMessageVerified,
      },
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      success: false,
      notice: undefined,
      ...(createdCreativeId ? { createdCreativeId } : {}),
      ...(adPausedForVerification ? { adPausedForVerification } : {}),
      ...(!createdCreativeId ? { ambiguousCreativeCreation: true } : {}),
      error:
        formatMetaWriteError(error) +
        (createdCreativeId
          ? ` A standalone replacement creative (${createdCreativeId}) was created, but the ad swap did not complete; it is not attached to the ad.`
          : ` Meta may have created "${creativeName}" in account ${options.adAccountId}; inspect the creative library before retrying.`) +
        (adPausedForVerification ? ' The previously active ad remains PAUSED.' : ''),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

async function readCurrentAdStatus(
  client: MetaClient,
  adId: string,
  maxRetries: number
): Promise<{ status?: string; effectiveStatus?: string }> {
  const ad = await client.metaGetObject<{ status?: string; effective_status?: string }>(
    `/${adId}`,
    { fields: 'status,effective_status' },
    maxRetries
  );
  return {
    status: String(ad.status ?? '').toUpperCase() || undefined,
    effectiveStatus: String(ad.effective_status ?? '').toUpperCase() || undefined,
  };
}

function hasOtherUpdateFields(options: UpdateAdOptions): boolean {
  return [
    options.name,
    options.status,
    options.creativeId,
    options.trackingSpecs,
    options.conversionDomain,
    options.adScheduleStartTime,
    options.adScheduleEndTime,
  ].some((value) => value !== undefined);
}

async function readBackMultiMediaCreative(
  client: MetaClient,
  adId: string,
  maxRetries: number
): Promise<{
  creativeId?: string;
  mediaSourcingSpec?: {
    images?: Array<{
      hash?: string;
      placement_customizations?: Array<{
        publisher_platform?: string;
        placement_exclusions?: string[];
      }>;
    }>;
  };
  pageWelcomeMessage?: unknown;
}> {
  try {
    const ad = await client.metaGetObject<{
      creative?: {
        id?: string;
        media_sourcing_spec?: {
          images?: Array<{
            hash?: string;
            placement_customizations?: Array<{
              publisher_platform?: string;
              placement_exclusions?: string[];
            }>;
          }>;
        };
        object_story_spec?: { link_data?: { page_welcome_message?: unknown } };
      };
    }>(`/${adId}`, { fields: 'creative{id,media_sourcing_spec,object_story_spec}' }, maxRetries);
    return {
      creativeId: ad.creative?.id,
      mediaSourcingSpec: ad.creative?.media_sourcing_spec,
      pageWelcomeMessage: ad.creative?.object_story_spec?.link_data?.page_welcome_message,
    };
  } catch {
    return {};
  }
}

function placementExclusionsMatch(
  expected: MetaMultiMediaAdOptions,
  actual:
    | {
        images?: Array<{
          hash?: string;
          placement_customizations?: Array<{
            publisher_platform?: string;
            placement_exclusions?: string[];
          }>;
        }>;
      }
    | undefined
): boolean {
  return expected.images.every((expectedImage) => {
    const actualImage = actual?.images?.find(
      (image) => image.hash === expectedImage.imageHash.trim()
    );
    return (expectedImage.placementExclusions ?? []).every((expectedExclusion) => {
      const actualExclusion = actualImage?.placement_customizations?.find(
        (customization) =>
          customization.publisher_platform === expectedExclusion.publisherPlatform.trim()
      );
      return expectedExclusion.positions.every((position) =>
        actualExclusion?.placement_exclusions?.includes(position.trim())
      );
    });
  });
}

function pageWelcomeMessageMatches(expected: unknown, actual: unknown): boolean {
  return expected === undefined || isSameJsonValue(expected, actual);
}

function isSameJsonValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => isSameJsonValue(value, right[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.hasOwn(rightRecord, key) && isSameJsonValue(leftRecord[key], rightRecord[key])
    )
  );
}

async function readBackCreativeId(
  client: MetaClient,
  adId: string,
  maxRetries: number
): Promise<string | undefined> {
  try {
    const fields = await client.metaGetObject<{ creative?: { id?: string } }>(
      `/${adId}`,
      { fields: 'creative' },
      maxRetries
    );
    return fields.creative?.id;
  } catch {
    // Best-effort only — the update itself already succeeded.
    return undefined;
  }
}

function buildUpdateAdPayload(options: UpdateAdOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (options.name !== undefined) payload.name = options.name.trim();
  if (options.status !== undefined) payload.status = options.status;
  if (options.creativeId !== undefined) payload.creative = { creative_id: options.creativeId };
  if (options.trackingSpecs !== undefined) payload.tracking_specs = options.trackingSpecs;
  if (options.conversionDomain !== undefined) payload.conversion_domain = options.conversionDomain;
  if (options.adScheduleStartTime !== undefined)
    payload.ad_schedule_start_time = options.adScheduleStartTime;
  if (options.adScheduleEndTime !== undefined)
    payload.ad_schedule_end_time = options.adScheduleEndTime;

  return payload;
}
