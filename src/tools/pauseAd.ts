import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

export interface PauseAdOptions {
  maxRetries?: number;
}

/**
 * Pause an ad by setting status to PAUSED.
 * POST /{ad_id} with status=PAUSED
 *
 * Returns { success, id } on success.
 * Throws MetaApiError if the API returns an error.
 */
export async function pauseAd(
  client: MetaClient,
  adId: string,
  options: PauseAdOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  const result = await client.metaPost<{ success: boolean }>(
    `/${adId}`,
    { status: 'PAUSED' },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: adId,
    operation: 'pause',
    entityType: 'ad',
    response: result as unknown as Record<string, unknown>,
  };
}
