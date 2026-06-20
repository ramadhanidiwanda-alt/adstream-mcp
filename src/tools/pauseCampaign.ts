import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

export interface PauseCampaignOptions {
  /** Max retries on rate limit */
  maxRetries?: number;
}

/**
 * Pause a campaign by setting status to PAUSED.
 * POST /{campaign_id} with status=PAUSED
 *
 * Returns { success, id } on success.
 * Throws MetaApiError if the API returns an error.
 */
export async function pauseCampaign(
  client: MetaClient,
  campaignId: string,
  options: PauseCampaignOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  const result = await client.metaPost<{ success: boolean }>(
    `/${campaignId}`,
    { status: 'PAUSED' },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: campaignId,
    operation: 'pause',
    entityType: 'campaign',
    response: result as unknown as Record<string, unknown>,
  };
}
