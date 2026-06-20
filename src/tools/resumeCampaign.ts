import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

export interface ResumeCampaignOptions {
  /** Max retries on rate limit */
  maxRetries?: number;
}

/**
 * Resume a campaign by setting status to ACTIVE.
 * POST /{campaign_id} with status=ACTIVE
 *
 * Returns { success, id } on success.
 * Throws MetaApiError if the API returns an error.
 */
export async function resumeCampaign(
  client: MetaClient,
  campaignId: string,
  options: ResumeCampaignOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  const result = await client.metaPost<{ success: boolean }>(
    `/${campaignId}`,
    { status: 'ACTIVE' },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: campaignId,
    operation: 'resume',
    entityType: 'campaign',
    response: result as unknown as Record<string, unknown>,
  };
}
