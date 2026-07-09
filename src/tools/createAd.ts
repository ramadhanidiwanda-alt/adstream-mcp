import type { MetaClient } from '../metaClient.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';

export type AdStatus = 'ACTIVE' | 'PAUSED';

export interface CreateAdOptions {
  adAccountId: string;
  name: string;
  adSetId: string;
  creativeId: string;
  status?: AdStatus;
  trackingSpecs?: Array<Record<string, unknown>>;
  adLabels?: Array<{ name: string }>;
}

export type CreateAdStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CreateAdResult {
  operation: 'create_ad';
  status: CreateAdStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
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
  const baseResult: CreateAdResult = {
    operation: 'create_ad',
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
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
