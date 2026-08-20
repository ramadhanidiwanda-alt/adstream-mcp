import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';
import { mutateStatusWithReadBack } from '../providers/meta/statusMutationReadBack.js';

export interface PauseCampaignOptions {
  /** Max retries on rate limit */
  maxRetries?: number;
}

/**
 * Pause a campaign by setting status to PAUSED.
 * POST /{campaign_id} with status=PAUSED, then read the status back.
 *
 * `success` is true only when the read-back confirms the campaign is PAUSED;
 * `response.read_back` carries the observed status and effective_status.
 *
 * Throws MetaApiError if the API returns an error.
 */
export async function pauseCampaign(
  client: MetaClient,
  campaignId: string,
  options: PauseCampaignOptions = {}
): Promise<MutationResult> {
  return mutateStatusWithReadBack(client, campaignId, {
    status: 'PAUSED',
    operation: 'pause',
    entityType: 'campaign',
    maxRetries: options.maxRetries ?? 3,
  });
}
