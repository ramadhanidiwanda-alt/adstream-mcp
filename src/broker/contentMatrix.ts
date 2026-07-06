import type {
  AdsContentMatrix,
  AdsContentMatrixComparisonMode,
  AdsContentMatrixGroup,
  AdsContentMatrixGroupBy,
  AdsContentMatrixMetric,
  AdsContentMatrixRow,
  AdsContentMatrixSortDirection,
  AdsMetricRecord,
  AdsProviderId,
} from './types.js';

export interface BuildAdsContentMatrixOptions {
  provider: AdsProviderId;
  since: string;
  until: string;
  groupBy?: AdsContentMatrixGroupBy;
  sortBy?: string;
  sortDirection?: AdsContentMatrixSortDirection;
  topLimit?: number;
  bottomLimit?: number;
  includeAllRows?: boolean;
  comparisonMode?: AdsContentMatrixComparisonMode;
}

const DEFAULT_GROUP_BY: AdsContentMatrixGroupBy = 'campaign';
const DEFAULT_SORT_BY = 'spend';
const DEFAULT_SORT_DIRECTION: AdsContentMatrixSortDirection = 'desc';
const DEFAULT_LIMIT = 3;

export function buildAdsContentMatrix(
  records: AdsMetricRecord[],
  options: BuildAdsContentMatrixOptions
): AdsContentMatrix {
  const groupBy = options.groupBy ?? DEFAULT_GROUP_BY;
  const sortBy = options.sortBy ?? DEFAULT_SORT_BY;
  const sortDirection = options.sortDirection ?? DEFAULT_SORT_DIRECTION;
  const topLimit = normalizeLimit(options.topLimit, DEFAULT_LIMIT);
  const bottomLimit = normalizeLimit(options.bottomLimit, DEFAULT_LIMIT);
  const rows = records.map(toContentMatrixRow);
  const groupedRows = groupRows(rows, groupBy);
  const groups = Array.from(groupedRows.values()).map((groupRowsForKey) =>
    buildGroup(groupRowsForKey, { groupBy, sortBy, sortDirection, topLimit, bottomLimit, includeAllRows: options.includeAllRows })
  );

  return {
    provider: options.provider,
    report_kind: 'content_matrix',
    date_range: { since: options.since, until: options.until },
    comparison: options.comparisonMode && options.comparisonMode !== 'none'
      ? { mode: options.comparisonMode }
      : undefined,
    group_by: groupBy,
    sort: { metric: sortBy, direction: sortDirection },
    groups,
    coverage: {
      rows: rows.length,
      groups: groups.length,
      has_creative_assets: rows.some((row) => row.data_quality.has_creative_asset),
      notes: rows.length ? [] : ['No ad or creative rows returned for the requested scope.'],
    },
  };
}

function toContentMatrixRow(record: AdsMetricRecord): AdsContentMatrixRow {
  const metrics = buildMetrics(record);
  const hasConversion = Boolean(
    record.conversions?.conversions ||
      record.conversions?.results ||
      record.commerce?.purchases ||
      record.leads?.leads ||
      record.leads?.registrations
  );
  const hasCreativeAsset = Boolean(
    record.creative?.creative_url ||
      record.creative?.thumbnail_url ||
      record.creative?.video_id ||
      record.creative?.image_hash ||
      record.creative?.headline ||
      record.creative?.primary_text
  );

  return {
    provider: record.provider,
    account_id: record.identity.account_id,
    campaign_id: record.identity.campaign_id,
    campaign_name: record.identity.campaign_name,
    adset_or_adgroup_id: record.identity.adset_or_adgroup_id,
    adset_or_adgroup_name: record.identity.adset_or_adgroup_name,
    ad_id: record.identity.ad_id,
    ad_name: record.identity.ad_name,
    creative_id: record.identity.creative_id,
    creative_name: record.identity.creative_name,
    content: record.creative ?? {},
    metrics,
    data_quality: {
      has_spend: record.delivery.spend > 0,
      has_impressions: record.delivery.impressions > 0,
      has_clicks: (record.clicks?.clicks ?? 0) > 0,
      has_conversion: hasConversion,
      has_creative_asset: hasCreativeAsset,
      notes: hasCreativeAsset ? [] : ['Creative asset metadata is unavailable for this row.'],
    },
  };
}

function buildGroup(
  rows: AdsContentMatrixRow[],
  options: {
    groupBy: AdsContentMatrixGroupBy;
    sortBy: string;
    sortDirection: AdsContentMatrixSortDirection;
    topLimit: number;
    bottomLimit: number;
    includeAllRows?: boolean;
  }
): AdsContentMatrixGroup {
  const first = rows[0];
  const sortedRows = [...rows].sort((left, right) => compareRows(left, right, options.sortBy, options.sortDirection));
  const bottomDirection: AdsContentMatrixSortDirection = options.sortDirection === 'desc' ? 'asc' : 'desc';
  const bottomRows = [...rows]
    .sort((left, right) => compareRows(left, right, options.sortBy, bottomDirection))
    .slice(0, options.bottomLimit);

  const groupId = options.groupBy === 'adset'
    ? first.adset_or_adgroup_id ?? 'unknown_adset'
    : first.campaign_id ?? 'unknown_campaign';
  const groupName = options.groupBy === 'adset'
    ? first.adset_or_adgroup_name
    : first.campaign_name;

  return {
    group_by: options.groupBy,
    group_id: groupId,
    group_name: groupName,
    campaign_id: first.campaign_id,
    campaign_name: first.campaign_name,
    adset_or_adgroup_id: options.groupBy === 'adset' ? first.adset_or_adgroup_id : undefined,
    adset_or_adgroup_name: options.groupBy === 'adset' ? first.adset_or_adgroup_name : undefined,
    summary_metrics: buildSummaryMetrics(rows),
    top_rows: sortedRows.slice(0, options.topLimit),
    bottom_rows: bottomRows,
    rows: options.includeAllRows ? sortedRows : undefined,
  };
}

function groupRows(rows: AdsContentMatrixRow[], groupBy: AdsContentMatrixGroupBy): Map<string, AdsContentMatrixRow[]> {
  const groups = new Map<string, AdsContentMatrixRow[]>();

  for (const row of rows) {
    const key = groupBy === 'adset'
      ? row.adset_or_adgroup_id ?? 'unknown_adset'
      : row.campaign_id ?? 'unknown_campaign';
    const existingRows = groups.get(key) ?? [];
    existingRows.push(row);
    groups.set(key, existingRows);
  }

  return groups;
}

function buildMetrics(record: AdsMetricRecord): AdsContentMatrixMetric[] {
  const spend = record.delivery.spend;
  const impressions = record.delivery.impressions;
  const clicks = record.clicks?.clicks ?? 0;
  const purchases = record.commerce?.purchases ?? null;
  const purchaseValue = record.commerce?.purchase_value ?? record.conversions?.conversion_value ?? null;

  return [
    observedMetric('spend', spend, 'currency'),
    observedMetric('impressions', impressions, 'count'),
    observedMetric('reach', record.delivery.reach ?? null, 'count'),
    observedMetric('clicks', clicks, 'count'),
    observedMetric('landing_page_views', record.clicks?.landing_page_views ?? null, 'count'),
    observedMetric('purchases', purchases, 'count'),
    observedMetric('purchase_value', purchaseValue, 'currency'),
    ratioMetric('ctr', record.clicks?.ctr ?? null, clicks, impressions, 'clicks / impressions * 100', 'percentage'),
    ratioMetric('cpc', record.clicks?.cpc ?? null, spend, clicks, 'spend / clicks', 'currency'),
    ratioMetric('cpm', record.delivery.cpm ?? null, spend * 1000, impressions, 'spend / impressions * 1000', 'currency'),
    ratioMetric('purchase_roas', record.commerce?.purchase_roas ?? record.conversions?.roas ?? null, purchaseValue, spend, 'purchase_value / spend', 'ratio'),
    ratioMetric('cost_per_purchase', record.commerce?.cost_per_purchase ?? null, spend, purchases, 'spend / purchases', 'currency'),
    observedMetric('engagements', record.engagement?.engagements ?? null, 'count'),
    observedMetric('video_views', record.video?.video_views ?? null, 'count'),
    observedMetric('hook_rate', record.video?.hook_rate ?? record.video?.thumbstop_rate ?? null, 'percentage'),
    observedMetric('hold_rate', record.video?.hold_rate ?? null, 'percentage'),
  ];
}

function buildSummaryMetrics(rows: AdsContentMatrixRow[]): AdsContentMatrixMetric[] {
  const spend = sumMetric(rows, 'spend');
  const impressions = sumMetric(rows, 'impressions');
  const clicks = sumMetric(rows, 'clicks');
  const purchases = sumMetric(rows, 'purchases');
  const purchaseValue = sumMetric(rows, 'purchase_value');

  return [
    observedMetric('spend', spend, 'currency'),
    observedMetric('impressions', impressions, 'count'),
    observedMetric('clicks', clicks, 'count'),
    observedMetric('purchases', purchases, 'count'),
    observedMetric('purchase_value', purchaseValue, 'currency'),
    ratioMetric('ctr', null, clicks, impressions, 'clicks / impressions * 100', 'percentage'),
    ratioMetric('cpc', null, spend, clicks, 'spend / clicks', 'currency'),
    ratioMetric('purchase_roas', null, purchaseValue, spend, 'purchase_value / spend', 'ratio'),
    ratioMetric('cost_per_purchase', null, spend, purchases, 'spend / purchases', 'currency'),
  ];
}

function observedMetric(key: string, value: number | null | undefined, unit: AdsContentMatrixMetric['unit']): AdsContentMatrixMetric {
  return {
    key,
    value: finiteOrNull(value),
    unit,
    source: 'observed',
    available: finiteOrNull(value) !== null,
  };
}

function ratioMetric(
  key: string,
  observedValue: number | null | undefined,
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  formula: string,
  unit: AdsContentMatrixMetric['unit']
): AdsContentMatrixMetric {
  const observed = finiteOrNull(observedValue);
  const safeNumerator = finiteOrNull(numerator);
  const safeDenominator = finiteOrNull(denominator);
  const calculated = safeNumerator !== null && safeDenominator !== null && safeDenominator !== 0
    ? safeNumerator / safeDenominator
    : null;

  return {
    key,
    value: observed ?? calculated,
    unit,
    source: observed === null ? 'calculated' : 'observed',
    numerator: safeNumerator,
    denominator: safeDenominator,
    formula,
    available: (observed ?? calculated) !== null,
  };
}

function compareRows(
  left: AdsContentMatrixRow,
  right: AdsContentMatrixRow,
  sortBy: string,
  direction: AdsContentMatrixSortDirection
): number {
  const leftValue = metricValue(left, sortBy);
  const rightValue = metricValue(right, sortBy);

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;

  return direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
}

function metricValue(row: AdsContentMatrixRow, key: string): number | null {
  return row.metrics.find((metric) => metric.key === key)?.value ?? null;
}

function sumMetric(rows: AdsContentMatrixRow[], key: string): number {
  return rows.reduce((sum, row) => sum + (metricValue(row, key) ?? 0), 0);
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}
