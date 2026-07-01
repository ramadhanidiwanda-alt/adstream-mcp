import { describe, expect, it } from 'vitest';
import { buildCommerceReport } from '../src/broker/commerceReportEngine.js';
import { normalizeGmvMaxRows } from '../src/providers/tiktok/gmvMaxNormalizer.js';
import type { GmvMaxReportRow } from '../src/tools/getGmvMaxReport.js';

describe('TikTok GMV Max commerce normalization and report', () => {
  const rows: GmvMaxReportRow[] = [
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
        product_name: 'Second Product',
      },
      metrics: {
        gmv: '500',
        orders: '5',
        units_sold: '5',
        spend: '100',
      },
    },
  ];

  it('normalizes GMV Max rows into CommerceRecord rows', () => {
    const records = normalizeGmvMaxRows(rows, {
      provider: 'tiktok_gmv',
      accountId: 'advertiser_1',
      storeId: 'store_1',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      provider: 'tiktok_gmv',
      account_id: 'advertiser_1',
      store: { id: 'store_1' },
      product: { id: 'sku_1', name: 'Hero Product' },
      metrics: {
        gmv: 1000,
        orders: 10,
        units_sold: 15,
        ad_spend: 200,
        roas_commerce: 5,
        aov: 100,
      },
    });
    expect(records[0].raw).toBeUndefined();
  });

  it('builds a commerce report from normalized GMV records', () => {
    const records = normalizeGmvMaxRows(rows, {
      provider: 'tiktok_gmv',
      accountId: 'advertiser_1',
      storeId: 'store_1',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    const report = buildCommerceReport(records, {
      provider: 'tiktok_gmv',
      format: 'summary',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(report).toMatchObject({
      provider: 'tiktok_gmv',
      report_kind: 'commerce',
      format: 'summary',
      date_range: { since: '2026-05-01', until: '2026-05-07' },
      totals: {
        gmv: 1500,
        orders: 15,
        units_sold: 20,
        ad_spend: 300,
        roas_commerce: 5,
        aov: 100,
      },
    });
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.disclaimer).toContain('suggestions');
  });
});
