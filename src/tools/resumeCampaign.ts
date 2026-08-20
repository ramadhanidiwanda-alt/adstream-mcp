import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';
import { mutateStatusWithReadBack } from '../providers/meta/statusMutationReadBack.js';

export interface ResumeCampaignOptions {
  /** Max retries on rate limit */
  maxRetries?: number;
}

/**
 * Resume a campaign by setting status to ACTIVE.
 * POST /{campaign_id} with status=ACTIVE, then read the status back.
 *
 * `success` is true only when the read-back confirms the campaign is ACTIVE;
 * `response.read_back` carries the observed status and effective_status.
 *
 * Throws MetaApiError if the API returns an error.
 */
export async function resumeCampaign(
  client: MetaClient,
  campaignId: string,
  options: ResumeCampaignOptions = {}
): Promise<MutationResult> {
  return mutateStatusWithReadBack(client, campaignId, {
    status: 'ACTIVE',
    operation: 'resume',
    entityType: 'campaign',
    maxRetries: options.maxRetries ?? 3,
  });
}
