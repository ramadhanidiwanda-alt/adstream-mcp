import type { MetaClient } from '../metaClient.js';
import type { AdAccount } from '../types.js';

export async function getAdAccounts(client: MetaClient, options: { limit?: number } = {}): Promise<AdAccount[]> {
  const response = await client.metaGet<{ data: AdAccount[] }>('/me/adaccounts', {
    fields: 'id,name,account_id,account_status,currency,timezone_name',
    limit: options.limit,
  });

  return response.data || [];
}
