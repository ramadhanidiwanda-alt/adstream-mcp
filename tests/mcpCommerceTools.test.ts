import { describe, expect, it } from 'vitest';
import {
  COMMERCE_MCP_TOOL_DEFINITIONS,
  handleCommerceMcpToolCall,
  type CommercePerformanceFetcher,
} from '../src/broker/commerceTools.js';
import type { GmvMaxReportResult } from '../src/tools/getGmvMaxReport.js';

function parseToolResponse(response: Awaited<ReturnType<typeof handleCommerceMcpToolCall>>) {
  return JSON.parse(response.content[0].text) as Record<string, unknown>;
}

describe('commerce MCP tools', () => {
  it('exposes commerce_get_performance as normalized data tool', () => {
    expect(COMMERCE_MCP_TOOL_DEFINITIONS.map((tool) => tool.name)).toContain('commerce_get_performance');
    expect(COMMERCE_MCP_TOOL_DEFINITIONS[0]?.description).toContain('normalized commerce performance data');
  });

  it('returns normalized TikTok GMV Max records and totals without narrative recommendations', async () => {
    let capturedOptions: Record<string, unknown> | undefined;
    const fetcher: CommercePerformanceFetcher = async (options) => {
      capturedOptions = options as unknown as Record<string, unknown>;
      return {
        list: [
          {
            dimensions: {
              store_id: 'store_1',
              product_id: 'sku_1',
              product_name: 'Hero Product',
            },
            metrics: {
              gmv: '1000',
              orders: '10',
              units_sold: '15',
              spend: '200',
            },
          },
          {
            dimensions: {
              store_id: 'store_1',
              product_id: 'sku_2',
            },
            metrics: {
              gmv: '500',
              orders: '5',
              units_sold: '5',
              spend: '100',
            },
          },
        ],
        page_info: {
          page: 1,
          page_size: 100,
          total_number: 2,
          total_page: 1,
        },
      } satisfies GmvMaxReportResult;
    };

    const response = parseToolResponse(await handleCommerceMcpToolCall('commerce_get_performance', {
      provider: 'tiktok_gmv',
      accountId: 'advertiser_1',
      storeIds: ['store_1'],
      since: '2026-05-01',
      until: '2026-05-07',
      dimensions: ['store_id', 'product_id'],
      metrics: ['gmv', 'orders', 'units_sold', 'spend'],
      params: { pageSize: 100 },
    }, { fetchGmvMaxReport: fetcher }));

    expect(capturedOptions).toMatchObject({
      advertiserId: 'advertiser_1',
      storeIds: ['store_1'],
      startDate: '2026-05-01',
      endDate: '2026-05-07',
      dimensions: ['store_id', 'product_id'],
      metrics: ['gmv', 'orders', 'units_sold', 'spend'],
      pageSize: 100,
    });
    expect(response.ok).toBe(true);
    expect(response.provider).toBe('tiktok_gmv');
    expect(response.data).toMatchObject({
      totals: { gmv: 1500, orders: 15, units_sold: 20, ad_spend: 300, roas_commerce: 5, aov: 100 },
      metadata: {
        date_range: { since: '2026-05-01', until: '2026-05-07' },
        source: 'tiktok_gmv_max',
        record_count: 2,
      },
      warnings: [],
    });
    expect((response.data as { records: unknown[] }).records).toHaveLength(2);
    expect((response.data as { records: unknown[] }).records[0]).toMatchObject({
      provider: 'tiktok_gmv',
      account_id: 'advertiser_1',
      store: { id: 'store_1' },
      product: { id: 'sku_1', name: 'Hero Product' },
      metrics: { gmv: 1000, orders: 10, units_sold: 15, ad_spend: 200, roas_commerce: 5, aov: 100 },
    });
    expect(JSON.stringify(response)).not.toContain('recommendations');
    expect(JSON.stringify(response)).not.toContain('findings');
  });

  it('returns a safe validation error for unsupported commerce providers', async () => {
    const response = parseToolResponse(await handleCommerceMcpToolCall('commerce_get_performance', {
      provider: 'shopee',
      accountId: 'seller_1',
      since: '2026-05-01',
      until: '2026-05-07',
    }, {
      fetchGmvMaxReport: async () => ({ list: [], page_info: { page: 1, page_size: 100, total_number: 0, total_page: 0 } }),
    }));

    expect(response.ok).toBe(false);
    expect(response.errors).toEqual([{ code: 'UNSUPPORTED_COMMERCE_PROVIDER', message: 'Only provider "tiktok_gmv" is supported for commerce_get_performance today.' }]);
  });
});
