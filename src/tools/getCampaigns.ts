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
    // bid_strategy + the budget pair decide whether Meta's "one optimization_goal
    // per campaign" rule applies (Advantage campaign budget under auto bid), which
    // ad-set writes are gated on. Without them on the read surface there is no way
    // to see why a write was blocked. Meta omits the budget fields entirely when
    // the budget lives on the ad sets, so their absence is itself the signal.
    fields:
      'id,name,status,effective_status,objective,created_time,updated_time,' +
      'bid_strategy,daily_budget,lifetime_budget',
    limit,
  });

  return response.data || [];
}
