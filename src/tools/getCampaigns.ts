import type { MetaClient } from '../metaClient.js';
import type { Campaign } from '../types.js';

export interface GetCampaignsOptions {
  adAccountId: string;
  limit?: number;
}

export async function getCampaigns(
  client: MetaClient,
  options: GetCampaignsOptions
): Promise<Campaign[]> {
  const { adAccountId, limit = 100 } = options;

  const response = await client.metaGet<{ data: Campaign[] }>(`/act_${adAccountId}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,created_time,updated_time',
    limit,
  });

  return response.data || [];
}
