import type {
  CommerceProviderId,
  CommerceRecord,
  CommerceReport,
  CommerceReportFormat,
  CommerceReportTotals,
} from './types.js';

const DEFAULT_COMMERCE_DISCLAIMER = 'These commerce recommendations are suggestions only. Review actual order quality, cancellations, fees, and margins before taking action.';

export interface BuildCommerceReportOptions {
  provider: CommerceProviderId;
  format?: CommerceReportFormat;
  since: string;
  until: string;
}

export function buildCommerceReport(
  records: CommerceRecord[],
  options: BuildCommerceReportOptions
): CommerceReport {
  const totals = calculateTotals(records);

  return {
    provider: options.provider,
    report_kind: 'commerce',
    format: options.format ?? 'summary',
    date_range: {
      since: options.since,
      until: options.until,
    },
    totals,
    findings: buildFindings(totals, records.length),
    recommendations: buildRecommendations(totals, records.length),
    disclaimer: DEFAULT_COMMERCE_DISCLAIMER,
  };
}

function calculateTotals(records: CommerceRecord[]): CommerceReportTotals {
  const totals: CommerceReportTotals = {
    gmv: sum(records, (record) => record.metrics.gmv),
    orders: sum(records, (record) => record.metrics.orders),
  };

  const unitsSold = sumOptional(records, (record) => record.metrics.units_sold);
  const adSpend = sumOptional(records, (record) => record.metrics.ad_spend);

  if (unitsSold !== undefined) totals.units_sold = unitsSold;
  if (adSpend !== undefined) totals.ad_spend = adSpend;
  if (adSpend !== undefined && adSpend > 0) totals.roas_commerce = roundMetric(totals.gmv / adSpend);
  if (totals.orders > 0) totals.aov = roundMetric(totals.gmv / totals.orders);

  return totals;
}

function buildFindings(totals: CommerceReportTotals, recordCount: number): string[] {
  if (recordCount === 0) return ['No commerce rows were returned for this date range.'];

  const findings = [
    `Analyzed ${recordCount} commerce row${recordCount === 1 ? '' : 's'}.`,
    `Total GMV was ${formatNumber(totals.gmv)} from ${formatNumber(totals.orders)} orders.`,
  ];

  if (totals.roas_commerce !== undefined) {
    findings.push(`Commerce ROAS was ${formatNumber(totals.roas_commerce)} based on GMV and ad spend.`);
  }

  return findings;
}

function buildRecommendations(totals: CommerceReportTotals, recordCount: number): string[] {
  if (recordCount === 0) return ['Confirm store IDs, date range, and GMV Max access before drawing conclusions.'];

  if (totals.roas_commerce !== undefined && totals.roas_commerce >= 3) {
    return ['Review SKU/store-level consistency before scaling GMV Max budgets.'];
  }

  if (totals.roas_commerce !== undefined) {
    return ['Review product feed, offer competitiveness, and conversion quality before scaling GMV Max spend.'];
  }

  return ['Connect ad spend and GMV metrics before making budget recommendations.'];
}

function sum(records: CommerceRecord[], getValue: (record: CommerceRecord) => number | undefined): number {
  return records.reduce((total, record) => total + (getValue(record) ?? 0), 0);
}

function sumOptional(records: CommerceRecord[], getValue: (record: CommerceRecord) => number | undefined): number | undefined {
  let hasValue = false;
  const total = records.reduce((sumValue, record) => {
    const value = getValue(record);
    if (value === undefined) return sumValue;
    hasValue = true;
    return sumValue + value;
  }, 0);

  return hasValue ? total : undefined;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
