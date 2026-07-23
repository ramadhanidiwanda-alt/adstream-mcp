import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { formatMetaWriteError, formatStructuredMetaWriteError } from '../utils/formatMetaWriteError.js';

export interface ArchiveAdOptions {
  adId: string;
}

export type ArchiveAdStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface ArchiveAdResult {
  operation: 'archive_ad';
  status: ArchiveAdStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  success: boolean;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

/**
 * Archive a Meta ad (sets status to ARCHIVED).
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 * ARCHIVED cannot be reverted to ACTIVE/PAUSED via the API — Meta has
 * treated it as equally permanent as DELETED since Oct 2014 (they only
 * differ in query/quota behavior, not reversibility), so this follows the
 * same dry-run/confirm lifecycle as ads_update_ad and ads_update_campaign.
 *
 * POST /{ad_id} with status=ARCHIVED
 */
export async function archiveAd(
  client: MetaClient,
  options: ArchiveAdOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<ArchiveAdResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;
  const { adId } = options;

  const preview: Record<string, unknown> = { status: 'ARCHIVED' };
  const baseResult: ArchiveAdResult = {
    operation: 'archive_ad',
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
      error:
        'Explicit confirmation is required after reviewing the dry-run preview — archiving is permanent and cannot be undone via the API.',
    };
  }

  try {
    const response = await client.metaPost<Record<string, unknown>>(`/${adId}`, preview, maxRetries);

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      success: true,
      id: adId,
      response,
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
