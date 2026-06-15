import type { TikTokApiClient } from '../tiktokClient.js';

export interface TikTokAdvertiser {
  advertiser_id: string;
  advertiser_name: string;
  status: string;
  currency?: string;
  timezone?: string;
  industry?: string;
  country?: string;
  balance?: number;
  valid_balance?: number;
}

/**
 * Get advertiser account information from TikTok Ads.
 *
 * Endpoint: GET /advertiser/info/
 * Docs: TikTok Business API SDK — yml_files/advertiser_info.yml
 */
export async function getTikTokAdvertisers(
  client: TikTokApiClient,
  advertiserIds?: string[]
): Promise<TikTokAdvertiser[]> {
  const params: Record<string, unknown> = {};

  if (advertiserIds?.length) {
    params.advertiser_ids = advertiserIds;
  }

  const response = await client.get<{ list: TikTokAdvertiser[] }>(
    '/advertiser/info/',
    params
  );

  return response.list ?? [];
}
