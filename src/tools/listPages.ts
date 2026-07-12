import type { MetaClient } from '../metaClient.js';

export interface MetaPageResult {
  id: string;
  name: string;
  category?: string;
  tasks?: string[];
  access_token?: string;
}

export async function listPages(
  client: MetaClient,
  options: { limit?: number } = {}
): Promise<MetaPageResult[]> {
  const response = await client.metaGet<{ data: MetaPageResult[] }>('/me/accounts', {
    fields: 'id,name,category,tasks,access_token',
    limit: options.limit ?? 100,
  });

  return response.data || [];
}
