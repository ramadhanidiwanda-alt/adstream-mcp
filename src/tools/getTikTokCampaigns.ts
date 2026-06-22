import type { TikTokApiClient } from "../tiktokClient.js";

export interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  objective: string;
  status: string;
  budget_mode?: string;
  budget?: number;
  optimization_goal?: string;
  buying_type?: string;
  campaign_create_time?: string;
  campaign_modify_time?: string;
}

export interface GetTikTokCampaignsOptions {
  advertiserId: string;
  page?: number;
  pageSize?: number;
}

/**
 * List campaigns for a TikTok advertiser.
 *
 * Endpoint: GET /campaign/get/
 * Docs: TikTok Business API - campaign management
 */
export async function getTikTokCampaigns(
  client: TikTokApiClient,
  options: GetTikTokCampaignsOptions
): Promise<TikTokCampaign[]> {
  const params: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
  };

  if (options.page) params.page = options.page;
  if (options.pageSize) params.page_size = options.pageSize;

  const response = await client.get<{ list: TikTokCampaign[] }>(
    "/campaign/get/",
    params
  );

  return response.list ?? [];
}
