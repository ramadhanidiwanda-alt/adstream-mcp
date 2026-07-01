import type { CommerceProviderId, CommerceRecord } from '../../broker/types.js';
import type { GmvMaxReportRow } from '../../tools/getGmvMaxReport.js';

export interface NormalizeGmvMaxRowsOptions {
  provider: Extract<CommerceProviderId, 'tiktok_gmv'>;
  accountId: string;
  storeId: string;
  since: string;
  until: string;
  includeRaw?: boolean;
}

export function normalizeGmvMaxRows(
  rows: GmvMaxReportRow[],
  options: NormalizeGmvMaxRowsOptions
): CommerceRecord[] {
  return rows.map((row) => normalizeGmvMaxRow(row, options));
}

function normalizeGmvMaxRow(row: GmvMaxReportRow, options: NormalizeGmvMaxRowsOptions): CommerceRecord {
  const gmv = toNumber(row.metrics.gmv ?? row.metrics.gross_revenue ?? row.metrics.revenue);
  const orders = toNumber(row.metrics.orders ?? row.metrics.order_count ?? row.metrics.purchases);
  const unitsSold = optionalNumber(row.metrics.units_sold ?? row.metrics.item_sold_count);
  const adSpend = optionalNumber(row.metrics.spend ?? row.metrics.cost);

  const record: CommerceRecord = {
    provider: options.provider,
    account_id: options.accountId,
    store: {
      id: row.dimensions.store_id ?? options.storeId,
      name: row.dimensions.store_name,
      region: row.dimensions.region,
    },
    product: {
      id: row.dimensions.product_id ?? row.dimensions.item_id ?? row.dimensions.sku_id,
      name: row.dimensions.product_name ?? row.dimensions.item_name ?? row.dimensions.sku_name,
    },
    time: {
      date_start: options.since,
      date_stop: options.until,
    },
    metrics: {
      gmv,
      orders,
    },
  };

  if (unitsSold !== undefined) record.metrics.units_sold = unitsSold;
  if (adSpend !== undefined) record.metrics.ad_spend = adSpend;
  if (adSpend !== undefined && adSpend > 0) record.metrics.roas_commerce = roundMetric(gmv / adSpend);
  if (orders > 0) record.metrics.aov = roundMetric(gmv / orders);

  if (!record.product?.id && !record.product?.name) {
    delete record.product;
  }

  if (options.includeRaw) record.raw = row;
  return record;
}

function toNumber(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}
