import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { formatMetaWriteError, formatStructuredMetaWriteError } from '../utils/formatMetaWriteError.js';

export interface UpdateAdOptions {
  adId: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  /** Points this ad at a different, already-existing creative. */
  creativeId?: string;
  trackingSpecs?: Record<string, unknown>[];
  conversionDomain?: string;
  adScheduleStartTime?: string;
  adScheduleEndTime?: string;
}

export type UpdateAdStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface UpdateAdResult {
  operation: 'update_ad';
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

  const preview = buildUpdateAdPayload(options);
  const baseResult: UpdateAdResult = {
    operation: 'update_ad',
    status: 'dry_run',
    executed: false,
    preview,
    success: false,
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  try {
    const response = await client.metaPost<Record<string, unknown>>(`/${options.adId}`, preview, maxRetries);

    const confirmedCreativeId = options.creativeId
      ? await readBackCreativeId(client, options.adId, maxRetries)
      : undefined;

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      success: true,
      id: options.adId,
      response,
      ...(confirmedCreativeId ? { confirmedCreativeId } : {}),
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      success: false,
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
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
  if (options.adScheduleStartTime !== undefined) payload.ad_schedule_start_time = options.adScheduleStartTime;
  if (options.adScheduleEndTime !== undefined) payload.ad_schedule_end_time = options.adScheduleEndTime;

  return payload;
}
