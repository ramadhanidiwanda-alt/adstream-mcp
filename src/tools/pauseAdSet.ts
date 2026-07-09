import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

export interface PauseAdSetOptions {
  maxRetries?: number;
}

/**
 * Pause an ad set by setting status to PAUSED.
 * POST /{adset_id} with status=PAUSED
 *
 * Returns { success, id } on success.
 * Throws MetaApiError if the API returns an error.
 */
export async function pauseAdSet(
  client: MetaClient,
  adSetId: string,
  options: PauseAdSetOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  const result = await client.metaPost<{ success: boolean }>(
    `/${adSetId}`,
    { status: 'PAUSED' },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: adSetId,
    operation: 'pause',
    entityType: 'adset',
    response: result as unknown as Record<string, unknown>,
  };
}
