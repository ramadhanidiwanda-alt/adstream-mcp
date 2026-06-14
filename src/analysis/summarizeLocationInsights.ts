import type { CampaignInsight, LocationInsightRow, LocationInsightSummary, LocationBreakdown } from '../types.js';

export interface SummarizeLocationOptions {
  insights: CampaignInsight[];
  breakdown: LocationBreakdown;
  sortBy?: 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'cpm';
  sortDirection?: 'asc' | 'desc';
  minSpend?: number;
  minClicks?: number;
  limit?: number;
}

const DIMENSION_KEY: Record<LocationBreakdown, 'country' | 'region' | 'dma'> = {
  country: 'country',
  region: 'region',
  dma: 'dma',
};

function toNumber(value: string | undefined): number {
  const parsed = parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeCtr(clicks: number, impressions: number): number {
  if (!impressions) return 0;
  return Math.round((clicks / impressions) * 10000) / 100;
}

function safeCpc(spend: number, clicks: number): number {
  if (!clicks) return 0;
  return Math.round((spend / clicks) * 100) / 100;
}

function safeCpm(spend: number, impressions: number): number {
  if (!impressions) return 0;
  return Math.round((spend / impressions) * 100000) / 100;
}

function buildRow(insight: CampaignInsight): LocationInsightRow {
  const spend = toNumber(insight.spend);
  const impressions = toNumber(insight.impressions);
  const clicks = toNumber(insight.clicks);

  return {
    campaign_id: insight.campaign_id,
    campaign_name: insight.campaign_name,
    country: insight.country,
    region: insight.region,
    dma: insight.dma,
    spend,
    impressions,
    reach: toNumber(insight.reach),
    clicks,
    inline_link_clicks: toNumber(insight.inline_link_clicks),
    ctr: insight.ctr !== undefined ? toNumber(insight.ctr) : safeCtr(clicks, impressions),
    cpc: insight.cpc !== undefined ? toNumber(insight.cpc) : safeCpc(spend, clicks),
    cpm: insight.cpm !== undefined ? toNumber(insight.cpm) : safeCpm(spend, impressions),
  };
}

export function summarizeLocationInsights(options: SummarizeLocationOptions): LocationInsightSummary {
  const {
    insights,
    breakdown,
    sortBy = 'spend',
    sortDirection = 'desc',
    minSpend,
    minClicks,
    limit = 50,
  } = options;

  const key = DIMENSION_KEY[breakdown];
  const warnings: string[] = [];

  // Build rows with parsed numbers
  const rows = insights.map(buildRow);

  // Filter
  let filtered = rows;
  if (minSpend !== undefined) {
    filtered = filtered.filter((row) => row.spend >= minSpend);
    warnings.push(`Filtered spend >= ${minSpend}`);
  }
  if (minClicks !== undefined) {
    filtered = filtered.filter((row) => row.clicks >= minClicks);
    warnings.push(`Filtered clicks >= ${minClicks}`);
  }

  // Group by location dimension
  const groupMap = new Map<string, { rows: LocationInsightRow[] }>();
  for (const row of filtered) {
    const value = row[key] ?? '(unknown)';
    if (!groupMap.has(value)) {
      groupMap.set(value, { rows: [] });
    }
    groupMap.get(value)!.rows.push(row);
  }

  // Aggregate per location
  const locations = Array.from(groupMap.entries()).map(([name, group]) => {
    const locSpend = group.rows.reduce((sum, r) => sum + r.spend, 0);
    const locImpressions = group.rows.reduce((sum, r) => sum + r.impressions, 0);
    const locClicks = group.rows.reduce((sum, r) => sum + r.clicks, 0);

    return {
      [key]: name,
      spend: locSpend,
      impressions: locImpressions,
      clicks: locClicks,
      ctr: safeCtr(locClicks, locImpressions),
      cpc: safeCpc(locSpend, locClicks),
      cpm: safeCpm(locSpend, locImpressions),
      campaigns: group.rows.length,
    };
  });

  // Sort
  locations.sort((a, b) => {
    const diff = (b[sortBy] as number) - (a[sortBy] as number);
    return sortDirection === 'desc' ? diff : -diff;
  });

  const topLocations = locations.slice(0, limit);

  // Totals across top locations
  const totals = {
    spend: topLocations.reduce((s, l) => s + l.spend, 0),
    impressions: topLocations.reduce((s, l) => s + l.impressions, 0),
    clicks: topLocations.reduce((s, l) => s + l.clicks, 0),
    ctr: 0,
    cpc: 0,
    cpm: 0,
    campaigns: topLocations.reduce((s, l) => s + l.campaigns, 0),
  };
  totals.ctr = safeCtr(totals.clicks, totals.impressions);
  totals.cpc = safeCpc(totals.spend, totals.clicks);
  totals.cpm = safeCpm(totals.spend, totals.impressions);

  if (!insights.length) {
    warnings.push('No insight data returned from Meta API');
  }

  return {
    breakdown,
    totals,
    top_locations: topLocations,
    warnings,
  };
}
