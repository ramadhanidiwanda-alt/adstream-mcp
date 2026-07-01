import type {
  AdsBrokerRequest,
  AdsMetricRecord,
  AdsMultiProviderReport,
  AdsProviderId,
  AdsReport,
  AdsReportFormat,
  AdsReportLevel,
  AdsReportScorecard,
  AdsReportTotals,
} from './types.js';

const DEFAULT_DISCLAIMER = 'These recommendations are suggestions only. Review performance context and business constraints before taking action.';

export function buildAdsSummaryReport(
  provider: AdsProviderId,
  records: AdsMetricRecord[],
  request: AdsBrokerRequest,
  level: AdsReportLevel = 'account'
): AdsReport {
  const totals = calculateTotals(records);
  const format = parseReportFormat(request.params.format);

  const report: AdsReport = {
    provider,
    report_kind: 'ads',
    format,
    level,
    date_range: {
      since: request.since ?? records[0]?.time.date_start ?? '',
      until: request.until ?? records[0]?.time.date_stop ?? '',
    },
    totals,
    findings: buildFindings(totals, records.length),
    recommendations: buildRecommendations(totals, records.length),
    disclaimer: DEFAULT_DISCLAIMER,
  };

  if (format === 'audit') {
    return {
      ...report,
      scorecard: buildScorecard(totals, records.length),
      efficiency_findings: buildEfficiencyFindings(totals),
      risk_findings: buildRiskFindings(totals, records.length),
      opportunity_findings: buildOpportunityFindings(totals),
      next_actions: buildNextActions(totals),
    };
  }

  return report;
}

export function buildCrossProviderReport(
  perProvider: AdsReport[],
  request: AdsBrokerRequest,
  level: AdsReportLevel
): AdsMultiProviderReport {
  const totals = combineTotals(perProvider.map((report) => report.totals));
  const format = parseReportFormat(request.params.format);
  const providers = perProvider.map((report) => report.provider);

  const currencies = collectCurrencies(perProvider);
  const mixedCurrency = currencies.length > 1;
  const warnings: string[] = [];
  if (mixedCurrency) {
    warnings.push(
      `Mixed currency totals detected (${currencies.join(', ')}); treat combined monetary totals as indicative only.`
    );
  }

  const findings = [
    `Aggregated ${perProvider.length} provider report${perProvider.length === 1 ? '' : 's'}: ${providers.join(', ')}.`,
    `Combined spend was ${formatNumber(totals.spend)} across ${formatNumber(totals.impressions)} impressions.`,
  ];

  return {
    report_kind: 'ads',
    format,
    level,
    providers,
    date_range: {
      since: request.since ?? perProvider[0]?.date_range.since ?? '',
      until: request.until ?? perProvider[0]?.date_range.until ?? '',
    },
    totals,
    per_provider: perProvider,
    currencies,
    mixed_currency: mixedCurrency,
    findings,
    recommendations: ['Compare per-provider efficiency before shifting budget across platforms.'],
    disclaimer: DEFAULT_DISCLAIMER,
    warnings: warnings.length ? warnings : undefined,
  };
}

function combineTotals(all: AdsReportTotals[]): AdsReportTotals {
  const combined: AdsReportTotals = {
    spend: all.reduce((total, item) => total + item.spend, 0),
    impressions: all.reduce((total, item) => total + item.impressions, 0),
    clicks: all.reduce((total, item) => total + item.clicks, 0),
  };

  const reach = sumDefined(all, (item) => item.reach);
  const purchases = sumDefined(all, (item) => item.purchases);
  const purchaseValue = sumDefined(all, (item) => item.purchase_value);
  const leads = sumDefined(all, (item) => item.leads);

  if (reach !== undefined) combined.reach = reach;
  if (purchases !== undefined) combined.purchases = purchases;
  if (purchaseValue !== undefined) combined.purchase_value = purchaseValue;
  if (leads !== undefined) combined.leads = leads;

  if (combined.spend > 0 && purchaseValue !== undefined) {
    combined.roas = roundMetric(purchaseValue / combined.spend);
  }

  if (combined.clicks > 0) {
    combined.cpc = roundMetric(combined.spend / combined.clicks);
  }

  if (combined.impressions > 0) {
    combined.ctr = roundMetric((combined.clicks / combined.impressions) * 100);
    combined.cpm = roundMetric((combined.spend / combined.impressions) * 1000);
  }

  return combined;
}

function collectCurrencies(perProvider: AdsReport[]): string[] {
  const currencies: string[] = [];
  for (const report of perProvider) {
    const currency = report.totals.currency;
    if (currency && !currencies.includes(currency)) {
      currencies.push(currency);
    }
  }
  return currencies;
}

function sumDefined(all: AdsReportTotals[], getValue: (item: AdsReportTotals) => number | undefined): number | undefined {
  let hasValue = false;
  const total = all.reduce((sumValue, item) => {
    const value = getValue(item);
    if (value === undefined) return sumValue;
    hasValue = true;
    return sumValue + value;
  }, 0);

  return hasValue ? total : undefined;
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

  const currency = firstCurrency(records);
  if (currency !== undefined) totals.currency = currency;

  return totals;
}

function firstCurrency(records: AdsMetricRecord[]): string | undefined {
  for (const record of records) {
    if (record.setup?.currency) return record.setup.currency;
  }
  return undefined;
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

function buildScorecard(totals: AdsReportTotals, recordCount: number): AdsReportScorecard {
  if (recordCount === 0) {
    return { score: 0, rating: 'critical', reasons: ['No performance rows were available.'] };
  }

  let score = 65;
  const reasons: string[] = [];

  if (totals.roas !== undefined) {
    if (totals.roas >= 4) {
      score += 20;
      reasons.push('ROAS is strong relative to spend.');
    } else if (totals.roas >= 2) {
      score += 8;
      reasons.push('ROAS is acceptable but should be monitored.');
    } else {
      score -= 20;
      reasons.push('ROAS is below a healthy scaling threshold.');
    }
  }

  if (totals.ctr !== undefined) {
    if (totals.ctr >= 2) {
      score += 7;
      reasons.push('CTR indicates healthy engagement.');
    } else if (totals.ctr < 1) {
      score -= 10;
      reasons.push('CTR suggests weak creative or audience fit.');
    }
  }

  if (totals.spend > 0 && totals.clicks === 0) {
    score -= 20;
    reasons.push('Spend has not produced clicks.');
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    score: normalizedScore,
    rating: scoreToRating(normalizedScore),
    reasons,
  };
}

function buildEfficiencyFindings(totals: AdsReportTotals): string[] {
  const findings: string[] = [];

  if (totals.cpc !== undefined) {
    findings.push(`Average CPC was ${formatNumber(totals.cpc)}.`);
  }

  if (totals.ctr !== undefined) {
    findings.push(`Overall CTR was ${formatNumber(totals.ctr)}%.`);
  }

  if (totals.cpm !== undefined) {
    findings.push(`Overall CPM was ${formatNumber(totals.cpm)}.`);
  }

  return findings.length ? findings : ['Insufficient click and impression data to evaluate efficiency.'];
}

function buildRiskFindings(totals: AdsReportTotals, recordCount: number): string[] {
  const findings: string[] = [];

  if (recordCount === 0) {
    findings.push('No data returned; reporting conclusions are blocked.');
  }

  if (totals.spend > 0 && totals.clicks === 0) {
    findings.push('Spend is present but clicks are zero. Check delivery, objective, tracking, or creative quality.');
  }

  if (totals.roas !== undefined && totals.roas < 2) {
    findings.push('ROAS is below 2.0; avoid scaling until campaign-level drivers are reviewed.');
  }

  return findings.length ? findings : ['No critical efficiency risks detected from the normalized totals.'];
}

function buildOpportunityFindings(totals: AdsReportTotals): string[] {
  const findings: string[] = [];

  if (totals.roas !== undefined && totals.roas >= 3) {
    findings.push('High ROAS indicates potential budget headroom if campaign-level consistency is confirmed.');
  }

  if (totals.leads !== undefined && totals.leads > 0) {
    findings.push('Lead volume is present; connect lead quality or CRM feedback before scaling.');
  }

  return findings.length ? findings : ['Use lower-level breakdowns to identify pockets of scale or waste.'];
}

function buildNextActions(totals: AdsReportTotals): string[] {
  const actions = ['Review campaign-level performance before making budget changes.'];

  if (totals.roas !== undefined && totals.roas >= 3) {
    actions.push('Shortlist high-ROAS campaigns for controlled budget increases.');
  } else if (totals.roas !== undefined) {
    actions.push('Inspect low-ROAS campaigns for creative, targeting, landing page, or tracking issues.');
  }

  actions.push('Do not execute write operations without explicit confirmation and audit logging.');
  return actions;
}

function scoreToRating(score: number): AdsReportScorecard['rating'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 45) return 'needs_attention';
  return 'critical';
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
