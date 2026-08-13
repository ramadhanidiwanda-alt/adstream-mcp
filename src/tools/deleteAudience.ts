import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export interface DeleteAudienceOptions {
  audienceId: string;
}

export type DeleteAudienceStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface DeleteAudienceResult {
  operation: 'delete_audience';
  status: DeleteAudienceStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  success: boolean;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

/**
 * Delete a Meta Custom Audience (including product/dynamic audiences —
 * they are Custom Audience objects once created, see createProductAudience).
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 * Deletion is permanent and cannot be undone via the API — same
 * dry-run/confirm lifecycle as archiveAd, and gated the same way by the
 * caller's isIrreversibleAdsCall check in mcpTools.ts.
 *
 * DELETE /{audience_id}
 */
export async function deleteAudience(
  client: MetaClient,
  options: DeleteAudienceOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<DeleteAudienceResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  const audienceId = options.audienceId?.trim();
  if (!audienceId) {
    return {
      operation: 'delete_audience',
      status: 'failed',
      executed: false,
      preview: {},
      success: false,
      error: 'audienceId wajib diisi.',
      structuredError: {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message: 'audienceId wajib diisi.',
        actionableFix: 'Isi audienceId sebelum menjalankan perubahan.',
      },
    };
  }

  const preview: Record<string, unknown> = { audienceId };
  const baseResult: DeleteAudienceResult = {
    operation: 'delete_audience',
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
        'Explicit confirmation is required after reviewing the dry-run preview — deleting an audience is permanent and cannot be undone via the API.',
    };
  }

  try {
    const response = await client.metaDelete<Record<string, unknown>>(`/${audienceId}`, maxRetries);

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      success: true,
      id: audienceId,
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
