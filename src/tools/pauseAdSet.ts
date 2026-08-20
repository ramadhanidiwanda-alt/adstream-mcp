import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';
import { mutateStatusWithReadBack } from '../providers/meta/statusMutationReadBack.js';

export interface PauseAdSetOptions {
  maxRetries?: number;
}

/**
 * Pause an ad set by setting status to PAUSED.
 * POST /{adset_id} with status=PAUSED, then read the status back.
 *
 * `success` is true only when the read-back confirms the ad set is PAUSED;
 * `response.read_back` carries the observed status and effective_status.
 *
 * Throws MetaApiError if the API returns an error.
 */
export async function pauseAdSet(
  client: MetaClient,
  adSetId: string,
  options: PauseAdSetOptions = {}
): Promise<MutationResult> {
  return mutateStatusWithReadBack(client, adSetId, {
    status: 'PAUSED',
    operation: 'pause',
    entityType: 'adset',
    maxRetries: options.maxRetries ?? 3,
  });
}
