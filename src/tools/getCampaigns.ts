import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { Campaign } from '../types.js';

export interface GetCampaignsOptions {
  adAccountId: string;
  limit?: number;
}

export async function getCampaigns(
  client: MetaClient,
  options: GetCampaignsOptions
): Promise<Campaign[]> {
  const { limit = 100 } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);

  const response = await client.metaGet<{ data: Campaign[] }>(`/act_${adAccountId}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,created_time,updated_time',
    limit,
  });

  return response.data || [];
}
