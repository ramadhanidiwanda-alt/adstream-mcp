import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';
import { mutateStatusWithReadBack } from '../providers/meta/statusMutationReadBack.js';

export interface PauseAdOptions {
  maxRetries?: number;
}

/**
 * Pause an ad by setting status to PAUSED.
 * POST /{ad_id} with status=PAUSED, then read the status back.
 *
 * `success` is true only when the read-back confirms the ad is PAUSED;
 * `response.read_back` carries the observed status and effective_status.
 *
 * Throws MetaApiError if the API returns an error.
 */
export async function pauseAd(
  client: MetaClient,
  adId: string,
  options: PauseAdOptions = {}
): Promise<MutationResult> {
  return mutateStatusWithReadBack(client, adId, {
    status: 'PAUSED',
    operation: 'pause',
    entityType: 'ad',
    maxRetries: options.maxRetries ?? 3,
  });
}
