import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';
import { mutateStatusWithReadBack } from '../providers/meta/statusMutationReadBack.js';

export interface ResumeAdSetOptions {
  maxRetries?: number;
}

/**
 * Resume a paused ad set by setting status to ACTIVE.
 * POST /{adset_id} with status=ACTIVE, then read the status back.
 *
 * `success` is true only when the read-back confirms the ad set is ACTIVE.
 * An ad set that really is ACTIVE still reports `effective_status:
 * CAMPAIGN_PAUSED` while its parent campaign is paused — that lands in
 * `response.read_back.note`, not in a failure.
 *
 * Throws MetaApiError if the API returns an error.
 */
export async function resumeAdSet(
  client: MetaClient,
  adSetId: string,
  options: ResumeAdSetOptions = {}
): Promise<MutationResult> {
  return mutateStatusWithReadBack(client, adSetId, {
    status: 'ACTIVE',
    operation: 'resume',
    entityType: 'adset',
    maxRetries: options.maxRetries ?? 3,
  });
}
