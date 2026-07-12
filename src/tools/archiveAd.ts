import type { MetaClient } from '../metaClient.js';
import { formatMetaWriteError } from '../utils/formatMetaWriteError.js';

export interface ArchiveAdOptions {
  adId: string;
}

export interface ArchiveAdResult {
  operation: 'archive_ad';
  status: 'executed' | 'failed';
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Archive (soft-delete) a Meta ad.
 *
 * POST /{ad_id} with status=ARCHIVED
 *
 * Returns success/error.
 */
export async function archiveAd(
  client: MetaClient,
  options: ArchiveAdOptions,
  maxRetries: number = 3
): Promise<ArchiveAdResult> {
  const { adId } = options;

  try {
    const result = await client.metaPost<{ success: boolean }>(
      `/${adId}`,
      { status: 'ARCHIVED' },
      maxRetries
    );

    return {
      operation: 'archive_ad',
      status: 'executed',
      success: result.success ?? true,
      id: adId,
    };
  } catch (error) {
    return {
      operation: 'archive_ad',
      status: 'failed',
      success: false,
      error: formatMetaWriteError(error),
    };
  }
}