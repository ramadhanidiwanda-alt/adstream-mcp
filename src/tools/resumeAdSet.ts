import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

export interface ResumeAdSetOptions {
  maxRetries?: number;
}

/**
 * Resume a paused ad set by setting status to ACTIVE.
 * POST /{adset_id} with status=ACTIVE
 *
 * Returns { success, id } on success.
 * Throws MetaApiError if the API returns an error.
 */
export async function resumeAdSet(
  client: MetaClient,
  adSetId: string,
  options: ResumeAdSetOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  const result = await client.metaPost<{ success: boolean }>(
    `/${adSetId}`,
    { status: 'ACTIVE' },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: adSetId,
    operation: 'resume',
    entityType: 'adset',
    response: result as unknown as Record<string, unknown>,
  };
}
