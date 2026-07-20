import type { MetaClient } from '../metaClient.js';
import type { MetaProductSetResult } from '../broker/types.js';

export interface ListProductSetsOptions {
  catalogId: string;
  limit?: number;
}

interface MetaProductSetRaw {
  id: string;
  name?: string;
  product_count?: number;
  product_catalog?: { id?: string };
}

export async function listProductSets(
  client: MetaClient,
  options: ListProductSetsOptions
): Promise<MetaProductSetResult[]> {
  const response = await client.metaGet<{ data: MetaProductSetRaw[] }>(
    `/${options.catalogId}/product_sets`,
    { fields: 'id,name,product_count,product_catalog', limit: options.limit ?? 100 }
  );

  return (response.data ?? []).map((set) => ({
    id: set.id,
    name: set.name,
    product_count: set.product_count,
    catalog_id: set.product_catalog?.id ?? options.catalogId,
  }));
}
