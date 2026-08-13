import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listCatalogs } from '../src/tools/listCatalogs.js';

describe('listCatalogs', () => {
  it('merges owned and client-shared catalogs, tagging each with its source', async () => {
    const metaGet = vi.fn(async (path: string) => {
      if (path === '/business-1/owned_product_catalogs') {
        return { data: [{ id: 'owned-1', name: 'Owned Catalog', product_count: 10 }] };
      }
      if (path === '/business-1/client_product_catalogs') {
        return {
          data: [
            {
              id: 'client-1',
              name: 'Retailer Shared Segment',
              product_count: 11,
              vertical: 'commerce',
              permitted_roles: ['ADVERTISE'],
            },
          ],
        };
      }
      return { data: [] };
    });
    const client = { metaGet } as unknown as MetaClient;

    const result = await listCatalogs(client, { businessId: 'business-1' });

    expect(result).toEqual([
      { id: 'owned-1', name: 'Owned Catalog', product_count: 10, vertical: undefined, source: 'owned' },
      {
        id: 'client-1',
        name: 'Retailer Shared Segment',
        product_count: 11,
        vertical: 'commerce',
        source: 'client',
        permitted_roles: ['ADVERTISE'],
      },
    ]);
  });

  it('returns owned catalogs alone (tagged) when the business has no client-shared catalogs', async () => {
    const client = {
      metaGet: vi.fn(async (path: string) => {
        if (path === '/business-1/owned_product_catalogs') {
          return { data: [{ id: 'owned-1', name: 'Owned Catalog' }] };
        }
        return { data: [] };
      }),
    } as unknown as MetaClient;

    const result = await listCatalogs(client, { businessId: 'business-1' });

    expect(result).toEqual([
      {
        id: 'owned-1',
        name: 'Owned Catalog',
        product_count: undefined,
        vertical: undefined,
        source: 'owned',
      },
    ]);
  });

  it('returns client-shared catalogs alone (tagged) when the business owns none — the reported CPAS brand gap', async () => {
    const client = {
      metaGet: vi.fn(async (path: string) => {
        if (path === '/business-1/owned_product_catalogs') return { data: [] };
        if (path === '/business-1/client_product_catalogs') {
          return { data: [{ id: 'client-1', name: 'Shared Segment', product_count: 5 }] };
        }
        return { data: [] };
      }),
    } as unknown as MetaClient;

    const result = await listCatalogs(client, { businessId: 'business-1' });

    expect(result).toEqual([
      {
        id: 'client-1',
        name: 'Shared Segment',
        product_count: 5,
        vertical: undefined,
        source: 'client',
        permitted_roles: undefined,
      },
    ]);
  });

  it('passes limit through to both edges', async () => {
    const metaGet = vi.fn(async () => ({ data: [] }));
    const client = { metaGet } as unknown as MetaClient;

    await listCatalogs(client, { businessId: 'business-1', limit: 25 });

    expect(metaGet).toHaveBeenCalledWith(
      '/business-1/owned_product_catalogs',
      expect.objectContaining({ limit: 25 })
    );
    expect(metaGet).toHaveBeenCalledWith(
      '/business-1/client_product_catalogs',
      expect.objectContaining({ limit: 25 })
    );
  });

  it('returns an empty array when the business has neither owned nor client catalogs', async () => {
    const client = { metaGet: vi.fn(async () => ({})) } as unknown as MetaClient;
    const result = await listCatalogs(client, { businessId: 'business-1' });
    expect(result).toEqual([]);
  });
});
