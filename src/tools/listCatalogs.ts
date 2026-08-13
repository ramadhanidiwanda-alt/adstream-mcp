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
  permitted_roles?: string[];
}

/**
 * Discover product catalogs a business can use for CPAS/catalog sales workflows.
 *
 * A business can relate to a catalog two ways: owning it directly, or having a
 * catalog *segment* shared to it by a retailer via Collaborative Ads' Collaboration
 * Center. For a CPAS brand the owned edge is frequently empty — the brand never
 * owns a catalog, it only has retailer-shared segments — so both edges are always
 * queried and merged, mirroring how listWhatsAppAccounts merges owned + client WABAs.
 */
export async function listCatalogs(
  client: MetaClient,
  options: ListCatalogsOptions
): Promise<MetaCatalogResult[]> {
  const limit = options.limit ?? 100;
  const fields = 'id,name,product_count,vertical';
  const clientFields = `${fields},permitted_roles`;

  const [owned, client_] = await Promise.all([
    client.metaGet<{ data?: MetaCatalogRaw[] }>(`/${options.businessId}/owned_product_catalogs`, {
      fields,
      limit,
    }),
    client.metaGet<{ data?: MetaCatalogRaw[] }>(`/${options.businessId}/client_product_catalogs`, {
      fields: clientFields,
      limit,
    }),
  ]);

  return [
    ...(owned.data ?? []).map((catalog) => mapCatalog(catalog, 'owned')),
    ...(client_.data ?? []).map((catalog) => mapCatalog(catalog, 'client')),
  ];
}

function mapCatalog(
  catalog: MetaCatalogRaw,
  source: 'owned' | 'client'
): MetaCatalogResult {
  return {
    id: catalog.id,
    name: catalog.name,
    product_count: catalog.product_count,
    vertical: catalog.vertical,
    source,
    ...(source === 'client' ? { permitted_roles: catalog.permitted_roles } : {}),
  };
}
