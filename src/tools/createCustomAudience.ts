import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export interface CreateCustomAudienceOptions {
  adAccountId: string;
  name: string;
  /** Only WEBSITE is supported in this release — see the spec's "Out of scope" section. */
  subtype: 'WEBSITE';
  pixelId: string;
  /**
   * Raw Website Custom Audience Rule object, exactly as Meta's Audience rule
   * builder / Marketing API reference specifies. Passed through as-is because
   * this grammar is deep and revised by Meta independently of this MCP —
   * mirrors how AdSetTargeting.flexibleSpec/metaTargetingOverride already
   * accept raw JSON at a similarly open-ended boundary.
   */
  rule: Record<string, unknown>;
  retentionDays?: number;
  description?: string;
}

export type CreateCustomAudienceStatus =
  | 'dry_run'
  | 'pending_confirmation'
  | 'executed'
  | 'failed';

export interface CreateCustomAudienceResult {
  operation: 'create_custom_audience';
  status: CreateCustomAudienceStatus;
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
 * Create a Meta WEBSITE custom audience (pixel-based website-visitor retargeting).
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 *
 * POST /act_{ad_account_id}/customaudiences
 *
 * Returns the audience ID on success.
 */
export async function createCustomAudience(
  client: MetaClient,
  options: CreateCustomAudienceOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreateCustomAudienceResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  let preview: Record<string, unknown>;
  try {
    preview = buildCustomAudiencePayload(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      operation: 'create_custom_audience',
      status: 'failed',
      executed: false,
      preview: { name: options.name?.trim() },
      error: message,
      structuredError: {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message,
        actionableFix: 'Perbaiki input custom audience pada dry-run sebelum menjalankan perubahan.',
      },
    };
  }

  const baseResult: CreateCustomAudienceResult = {
    operation: 'create_custom_audience',
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
      `${accountPath}/customaudiences`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created custom audience',
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

function buildCustomAudiencePayload(
  options: CreateCustomAudienceOptions
): Record<string, unknown> {
  const name = requiredString(options.name, 'name');
  const pixelId = requiredString(options.pixelId, 'pixelId');

  if (options.subtype !== 'WEBSITE') {
    throw new Error('subtype hanya mendukung WEBSITE pada rilis ini.');
  }
  if (!options.rule || Object.keys(options.rule).length === 0) {
    throw new Error('rule wajib diisi (Website Custom Audience Rule).');
  }
  if (
    options.retentionDays !== undefined &&
    (options.retentionDays < 1 || options.retentionDays > 180)
  ) {
    throw new Error('retentionDays harus antara 1 dan 180.');
  }

  return {
    name,
    subtype: 'WEBSITE',
    pixel_id: pixelId,
    rule: options.rule,
    ...(options.retentionDays !== undefined ? { retention_days: options.retentionDays } : {}),
    ...(options.description?.trim() ? { description: options.description.trim() } : {}),
  };
}

function requiredString(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} wajib diisi.`);
  return normalized;
}
