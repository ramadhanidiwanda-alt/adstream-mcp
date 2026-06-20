import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

export interface RenameCampaignOptions {
  /** Max retries on rate limit */
  maxRetries?: number;
}

/**
 * Rename a campaign.
 * POST /{campaign_id} with name={newName}
 *
 * Returns { success, id } on success.
 * Throws MetaApiError if the API returns an error.
 */
export async function renameCampaign(
  client: MetaClient,
  campaignId: string,
  newName: string,
  options: RenameCampaignOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  if (!newName || newName.trim().length === 0) {
    throw new Error('Campaign name cannot be empty');
  }

  const result = await client.metaPost<{ success: boolean }>(
    `/${campaignId}`,
    { name: newName.trim() },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: campaignId,
    operation: 'rename',
    entityType: 'campaign',
    response: result as unknown as Record<string, unknown>,
  };
}
