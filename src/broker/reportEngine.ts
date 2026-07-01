import type { AdsBrokerRequest, AdsMetricRecord, AdsProviderId, AdsReport, AdsReportFormat, AdsReportTotals } from './types.js';

const DEFAULT_DISCLAIMER = 'These recommendations are suggestions only. Review performance context and business constraints before taking action.';

export function buildAdsSummaryReport(
  provider: AdsProviderId,
  records: AdsMetricRecord[],
  request: AdsBrokerRequest
): AdsReport {
  const totals = calculateTotals(records);
  const format = parseReportFormat(request.params.format);

  return {
    provider,
    report_kind: 'ads',
    format,
    date_range: {
      since: request.since ?? records[0]?.time.date_start ?? '',
      until: request.until ?? records[0]?.time.date_stop ?? '',
    },
    totals,
    findings: buildFindings(totals, records.length),
    recommendations: buildRecommendations(totals, records.length),
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

function calculateTotals(records: AdsMetricRecord[]): AdsReportTotals {
  const totals: AdsReportTotals = {
    spend: sum(records, (record) => record.delivery.spend),
    impressions: sum(records, (record) => record.delivery.impressions),
    clicks: sum(records, (record) => record.clicks?.clicks),
  };

  const reach = sumOptional(records, (record) => record.delivery.reach);
  const purchases = sumOptional(records, (record) => record.commerce?.purchases);
  const purchaseValue = sumOptional(records, (record) => record.commerce?.purchase_value ?? record.conversions?.conversion_value);
  const leads = sumOptional(records, (record) => record.leads?.leads);

  if (reach !== undefined) totals.reach = reach;
  if (purchases !== undefined) totals.purchases = purchases;
  if (purchaseValue !== undefined) totals.purchase_value = purchaseValue;
  if (leads !== undefined) totals.leads = leads;

  if (totals.spend > 0 && purchaseValue !== undefined) {
    totals.roas = roundMetric(purchaseValue / totals.spend);
  }

  if (totals.clicks > 0) {
    totals.cpc = roundMetric(totals.spend / totals.clicks);
  }

  if (totals.impressions > 0) {
    totals.ctr = roundMetric((totals.clicks / totals.impressions) * 100);
    totals.cpm = roundMetric((totals.spend / totals.impressions) * 1000);
  }

  return totals;
}

function buildFindings(totals: AdsReportTotals, recordCount: number): string[] {
  if (recordCount === 0) {
    return ['No ads performance rows were returned for this date range.'];
  }

  const findings = [
    `Analyzed ${recordCount} normalized ads performance row${recordCount === 1 ? '' : 's'}.`,
    `Total spend was ${formatNumber(totals.spend)} with ${formatNumber(totals.impressions)} impressions and ${formatNumber(totals.clicks)} clicks.`,
  ];

  if (totals.roas !== undefined) {
    findings.push(`Purchase ROAS was ${formatNumber(totals.roas)} based on reported purchase value.`);
  }

  if (totals.leads !== undefined) {
    findings.push(`Lead volume was ${formatNumber(totals.leads)} for the selected period.`);
  }

  return findings;
}

function buildRecommendations(totals: AdsReportTotals, recordCount: number): string[] {
  if (recordCount === 0) {
    return ['Confirm the account, date range, and provider credential before drawing conclusions.'];
  }

  const recommendations: string[] = [];

  if (totals.roas !== undefined) {
    recommendations.push(
      totals.roas >= 3
        ? 'Consider reviewing budget headroom for high-ROAS campaigns before scaling gradually.'
        : 'Review spend allocation and creative quality before increasing budget.'
    );
  } else if (totals.leads !== undefined) {
    recommendations.push('Review lead quality and cost per lead before making budget changes.');
  } else {
    recommendations.push('Review objective-specific success metrics before making optimization decisions.');
  }

  recommendations.push('Use campaign/adset/ad-level breakdowns before applying any changes.');
  return recommendations;
}

function parseReportFormat(value: unknown): AdsReportFormat {
  if (value === 'daily' || value === 'audit' || value === 'executive') {
    return value;
  }

  return 'summary';
}

function sum(records: AdsMetricRecord[], getValue: (record: AdsMetricRecord) => number | undefined): number {
  return records.reduce((total, record) => total + (getValue(record) ?? 0), 0);
}

function sumOptional(
  records: AdsMetricRecord[],
  getValue: (record: AdsMetricRecord) => number | undefined
): number | undefined {
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
