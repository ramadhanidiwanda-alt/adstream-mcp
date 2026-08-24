import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';
import { mutateStatusWithReadBack } from '../providers/meta/statusMutationReadBack.js';

export interface ResumeAdOptions {
  maxRetries?: number;
}

/**
 * Resume a paused ad by setting status to ACTIVE.
 * POST /{ad_id} with status=ACTIVE, then read the status back.
 *
 * `success` is true only when the read-back confirms the ad is ACTIVE. An ad
 * that really is ACTIVE still reports `effective_status: ADSET_PAUSED` or
 * `CAMPAIGN_PAUSED` while a parent is paused — that lands in
 * `response.read_back.note`, not in a failure. The note names the parent it
 * actually read, and `response.read_back.issues` carries Meta's `issues_info`
 * when the ad is rejected rather than merely waiting on a parent.
 *
 * Throws MetaApiError if the API returns an error.
 */
export async function resumeAd(
  client: MetaClient,
  adId: string,
  options: ResumeAdOptions = {}
): Promise<MutationResult> {
  return mutateStatusWithReadBack(client, adId, {
    status: 'ACTIVE',
    operation: 'resume',
    entityType: 'ad',
    maxRetries: options.maxRetries ?? 3,
  });
}
