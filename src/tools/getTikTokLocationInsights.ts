import type { TikTokApiClient } from '../tiktokClient.js';
import { getTikTokReport, type TikTokDataLevel, type TikTokReportRow } from './getTikTokReport.js';

export type TikTokLocationBreakdown = 'country' | 'province' | 'city';

export const TIKTOK_LOCATION_BREAKDOWNS: TikTokLocationBreakdown[] = ['country', 'province', 'city'];

const DIMENSION_MAP: Record<TikTokLocationBreakdown, string> = {
  country: 'country_code',
  province: 'province_id',
  city: 'city_id',
};

export interface TikTokLocationInsightRow {
  campaign_id?: string;
  country?: string;
  province?: string;
  city?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface TikTokLocationInsightSummary {
  breakdown: TikTokLocationBreakdown | TikTokLocationBreakdown[];
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  top_locations: TikTokLocationInsightRow[];
  warnings: string[];
}

export interface GetTikTokLocationInsightsOptions {
  advertiserId: string;
  breakdowns: TikTokLocationBreakdown[];
  dataLevel?: TikTokDataLevel;
  startDate?: string;
  endDate?: string;
  sortBy?: 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'cpm';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

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

function buildRow(row: TikTokReportRow): TikTokLocationInsightRow {
  const spend = toNumber(row.metrics.spend);
  const impressions = toNumber(row.metrics.impressions);
  const clicks = toNumber(row.metrics.clicks);

  return {
    campaign_id: row.dimensions.campaign_id,
    country: row.dimensions.country_code,
    province: row.dimensions.province_id,
    city: row.dimensions.city_id,
    spend,
    impressions,
    clicks,
    ctr: row.metrics.ctr ? toNumber(row.metrics.ctr) : safeCtr(clicks, impressions),
    cpc: row.metrics.cpc ? toNumber(row.metrics.cpc) : safeCpc(spend, clicks),
    cpm: row.metrics.cpm ? toNumber(row.metrics.cpm) : safeCpm(spend, impressions),
  };
}

function getLocationKey(row: TikTokLocationInsightRow, breakdown: TikTokLocationBreakdown): string {
  const fieldMap: Record<TikTokLocationBreakdown, keyof TikTokLocationInsightRow> = {
    country: 'country',
    province: 'province',
    city: 'city',
  };
  return String(row[fieldMap[breakdown]] ?? '(unknown)');
}

/**
 * Fetch location-breakdown insights from TikTok Ads.
 *
 * Uses the regular TikTok reporting endpoint with location dimensions
 * (country_code, province_id, city_id) to group performance by geography.
 *
 * TikTok does NOT have a separate location insights endpoint — instead,
 * location dimensions are passed to the regular report/integrated/get/ endpoint.
 */
export async function getTikTokLocationInsights(
  client: TikTokApiClient,
  options: GetTikTokLocationInsightsOptions
): Promise<TikTokLocationInsightSummary> {
  const {
    advertiserId,
    breakdowns,
    dataLevel = 'AUCTION_CAMPAIGN',
    startDate,
    endDate,
    sortBy = 'spend',
    sortDirection = 'desc',
    limit = 50,
  } = options;

  const dimensions = breakdowns.map((b) => DIMENSION_MAP[b]);
  dimensions.push('campaign_id'); // always include campaign context

  const report = await getTikTokReport(client, {
    advertiserId,
    reportType: 'BASIC',
    dimensions,
    metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'],
    dataLevel,
    startDate,
    endDate,
    pageSize: 200,
  });

  const warnings: string[] = [];
  if (!report.list.length) {
    warnings.push('No insight data returned from TikTok API');
  }

  // Build parsed rows
  const rows = report.list.map(buildRow);

  // Use the first breakdown as the primary grouping key
  const primaryBreakdown = breakdowns[0];
  const keyFn = (row: TikTokLocationInsightRow) => getLocationKey(row, primaryBreakdown);

  // Group and aggregate
  const groupMap = new Map<string, { rows: TikTokLocationInsightRow[] }>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groupMap.has(key)) {
      groupMap.set(key, { rows: [] });
    }
    groupMap.get(key)!.rows.push(row);
  }

  const locations = Array.from(groupMap.entries()).map(([name, group]) => {
    const locSpend = group.rows.reduce((s, r) => s + r.spend, 0);
    const locImp = group.rows.reduce((s, r) => s + r.impressions, 0);
    const locClicks = group.rows.reduce((s, r) => s + r.clicks, 0);

    const loc: TikTokLocationInsightRow = {
      spend: locSpend,
      impressions: locImp,
      clicks: locClicks,
      ctr: safeCtr(locClicks, locImp),
      cpc: safeCpc(locSpend, locClicks),
      cpm: safeCpm(locSpend, locImp),
    };

    // Set the relevant location field
    if (primaryBreakdown === 'country') loc.country = name;
    else if (primaryBreakdown === 'province') loc.province = name;
    else loc.city = name;

    return loc;
  });

  // Sort
  locations.sort((a, b) => {
    const diff = (b[sortBy] as number) - (a[sortBy] as number);
    return sortDirection === 'desc' ? diff : -diff;
  });

  const topLocations = locations.slice(0, limit);

  const totals = {
    spend: topLocations.reduce((s, l) => s + l.spend, 0),
    impressions: topLocations.reduce((s, l) => s + l.impressions, 0),
    clicks: topLocations.reduce((s, l) => s + l.clicks, 0),
    ctr: safeCtr(
      topLocations.reduce((s, l) => s + l.clicks, 0),
      topLocations.reduce((s, l) => s + l.impressions, 0)
    ),
    cpc: safeCpc(
      topLocations.reduce((s, l) => s + l.spend, 0),
      topLocations.reduce((s, l) => s + l.clicks, 0)
    ),
    cpm: safeCpm(
      topLocations.reduce((s, l) => s + l.spend, 0),
      topLocations.reduce((s, l) => s + l.impressions, 0)
    ),
  };

  return {
    breakdown: breakdowns.length === 1 ? breakdowns[0] : breakdowns,
    totals,
    top_locations: topLocations,
    warnings,
  };
}
