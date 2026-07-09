import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

export interface ResumeAdOptions {
  maxRetries?: number;
}

/**
 * Resume a paused ad by setting status to ACTIVE.
 * POST /{ad_id} with status=ACTIVE
 *
 * Returns { success, id } on success.
 * Throws MetaApiError if the API returns an error.
 */
export async function resumeAd(
  client: MetaClient,
  adId: string,
  options: ResumeAdOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  const result = await client.metaPost<{ success: boolean }>(
    `/${adId}`,
    { status: 'ACTIVE' },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: adId,
    operation: 'resume',
    entityType: 'ad',
    response: result as unknown as Record<string, unknown>,
  };
}
