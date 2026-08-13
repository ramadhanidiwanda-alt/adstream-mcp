import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export interface CreatePixelOptions {
  adAccountId: string;
  name: string;
}

export type CreatePixelStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CreatePixelResult {
  operation: 'create_pixel';
  status: CreatePixelStatus;
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
 * Create a Meta Pixel for conversion tracking.
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 *
 * POST /act_{ad_account_id}/adspixels
 *
 * An ad account can only have one pixel — Meta rejects a second create with
 * error code 6200 (see formatMetaWriteError's actionable fix). Use
 * ads_list_pixels to find the existing one instead of retrying.
 */
export async function createPixel(
  client: MetaClient,
  options: CreatePixelOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreatePixelResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  let preview: Record<string, unknown>;
  try {
    preview = buildPixelPayload(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      operation: 'create_pixel',
      status: 'failed',
      executed: false,
      preview: { name: options.name?.trim() },
      error: message,
      structuredError: {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message,
        actionableFix: 'Perbaiki input pixel pada dry-run sebelum menjalankan perubahan.',
      },
    };
  }

  const baseResult: CreatePixelResult = {
    operation: 'create_pixel',
    status: 'dry_run',
    executed: false,
    preview,
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  const accountPath = normalizeAccountPath(options.adAccountId);

  try {
    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/adspixels`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created pixel',
      };
    }

    return { ...baseResult, status: 'executed', executed: true, id: response.id, response };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

function buildPixelPayload(options: CreatePixelOptions): Record<string, unknown> {
  return { name: requiredString(options.name, 'name') };
}

function requiredString(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} wajib diisi.`);
  return normalized;
}
