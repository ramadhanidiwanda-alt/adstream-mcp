import type { MetaClient } from '../metaClient.js';
import type { MetaCatalogResult } from '../broker/types.js';

export interface ListCatalogsOptions {
  businessId: string;
  limit?: number;
}

interface MetaCatalogRaw {
  id: string;
  name?: string;
  product_count?: number;
  vertical?: string;
}

export async function listCatalogs(
  client: MetaClient,
  options: ListCatalogsOptions
): Promise<MetaCatalogResult[]> {
  const response = await client.metaGet<{ data: MetaCatalogRaw[] }>(
    `/${options.businessId}/owned_product_catalogs`,
    { fields: 'id,name,product_count,vertical', limit: options.limit ?? 100 }
  );

  return (response.data ?? []).map((catalog) => ({
    id: catalog.id,
    name: catalog.name,
    product_count: catalog.product_count,
    vertical: catalog.vertical,
  }));
}
