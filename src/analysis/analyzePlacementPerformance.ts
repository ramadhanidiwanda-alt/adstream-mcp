import type {
  CampaignInsight,
  PlacementConfidence,
  PlacementPerformance,
  PlacementPerformanceReport,
  PlacementRecommendation,
} from '../types.js';
import { parseActionValue, parseActionValueFromValues } from '../utils/parseActions.js';

export interface AnalyzePlacementPerformanceOptions {
  provider: 'meta' | 'tiktok';
  since: string;
  until: string;
  insights: CampaignInsight[];
  minSpendShare?: number;
  minConversions?: number;
}

interface PlacementAggregate {
  platform: string;
  placement: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

function toNumber(value: string | undefined): number {
  const parsed = parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeCtr(clicks: number, impressions: number): number {
  if (!impressions) return 0;
  return round((clicks / impressions) * 100);
}

function safeCpc(spend: number, clicks: number): number | undefined {
  if (!clicks) return undefined;
  return round(spend / clicks);
}

function safeCpm(spend: number, impressions: number): number {
  if (!impressions) return 0;
  return round((spend / impressions) * 1000);
}

function safeCostPerConversion(spend: number, conversions: number): number | undefined {
  if (!conversions) return undefined;
  return round(spend / conversions);
}

function safeRoas(revenue: number, spend: number): number | undefined {
  if (!spend || !revenue) return undefined;
  return round(revenue / spend);
}

function readConversions(insight: CampaignInsight): number {
  return (
    parseActionValue(insight.actions, 'purchase') ||
    parseActionValue(insight.actions, 'lead') ||
    parseActionValue(insight.actions, 'offsite_conversion.fb_pixel_purchase') ||
    parseActionValue(insight.actions, 'onsite_conversion.lead_grouped')
  );
}

function readRevenue(insight: CampaignInsight): number {
  return (
    parseActionValueFromValues(insight.action_values, 'purchase') ||
    parseActionValueFromValues(insight.action_values, 'offsite_conversion.fb_pixel_purchase')
  );
}

function confidence(
  spendShare: number,
  conversions: number,
  minSpendShare: number,
  minConversions: number
): PlacementConfidence {
  if (spendShare < minSpendShare || conversions < minConversions) return 'low';
  if (conversions < minConversions * 3) return 'medium';
  return 'high';
}

function recommendation(params: {
  spendShare: number;
  conversions: number;
  costPerConversion?: number;
  averageCostPerConversion?: number;
  roas?: number;
  averageRoas?: number;
  minSpendShare: number;
  minConversions: number;
}): { recommendation: PlacementRecommendation; reason: string } {
  if (params.spendShare < params.minSpendShare || params.conversions < params.minConversions) {
    return { recommendation: 'insufficient_data', reason: 'Data belum cukup untuk keputusan aman' };
  }

  if (
    params.roas !== undefined &&
    params.averageRoas !== undefined &&
    params.roas >= params.averageRoas * 1.2
  ) {
    return { recommendation: 'scale', reason: 'ROAS di atas rata-rata akun' };
  }

  if (
    params.costPerConversion !== undefined &&
    params.averageCostPerConversion !== undefined &&
    params.costPerConversion <= params.averageCostPerConversion * 0.8
  ) {
    return { recommendation: 'scale', reason: 'Biaya per hasil lebih murah dari rata-rata akun' };
  }

  if (
    params.spendShare >= 0.15 &&
    params.costPerConversion !== undefined &&
    params.averageCostPerConversion !== undefined &&
    params.costPerConversion >= params.averageCostPerConversion * 1.3
  ) {
    return {
      recommendation: 'reduce',
      reason: 'Spend besar, biaya per hasil lebih mahal dari rata-rata akun',
    };
  }

  return { recommendation: 'monitor', reason: 'Performa campuran, perlu dipantau' };
}

export function analyzePlacementPerformance(
  options: AnalyzePlacementPerformanceOptions
): PlacementPerformanceReport {
  const { provider, since, until, insights, minSpendShare = 0.05, minConversions = 3 } = options;
  const warnings: string[] = [];

  if (!insights.length) {
    warnings.push('No placement insight data returned from ads API');
  }

  const aggregates = new Map<string, PlacementAggregate>();

  for (const insight of insights) {
    const platform = insight.publisher_platform ?? '(unknown)';
    const placement = insight.platform_position ?? '(unknown)';
    const key = `${platform}\u0000${placement}`;
    const aggregate = aggregates.get(key) ?? {
      platform,
      placement,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
    };

    aggregate.spend += toNumber(insight.spend);
    aggregate.impressions += toNumber(insight.impressions);
    aggregate.clicks += toNumber(insight.clicks);
    aggregate.conversions += readConversions(insight);
    aggregate.revenue += readRevenue(insight);
    aggregates.set(key, aggregate);
  }

  const totals = Array.from(aggregates.values()).reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      conversions: acc.conversions + row.conversions,
      revenue: acc.revenue + row.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const averageCostPerConversion = safeCostPerConversion(totals.spend, totals.conversions);
  const averageRoas = safeRoas(totals.revenue, totals.spend);

  const placements = Array.from(aggregates.values())
    .map((row): PlacementPerformance => {
      const spendShare = totals.spend ? row.spend / totals.spend : 0;
      const conversionShare = totals.conversions ? row.conversions / totals.conversions : undefined;
      const costPerConversion = safeCostPerConversion(row.spend, row.conversions);
      const roas = safeRoas(row.revenue, row.spend);
      const decision = recommendation({
        spendShare,
        conversions: row.conversions,
        costPerConversion,
        averageCostPerConversion,
        roas,
        averageRoas,
        minSpendShare,
        minConversions,
      });

      return {
        provider,
        platform: row.platform,
        placement: row.placement,
        spend: round(row.spend),
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: safeCtr(row.clicks, row.impressions),
        cpc: safeCpc(row.spend, row.clicks) ?? 0,
        cpm: safeCpm(row.spend, row.impressions),
        conversions: row.conversions,
        costPerConversion,
        revenue: row.revenue ? round(row.revenue) : undefined,
        roas,
        spendShare: round(spendShare, 4),
        conversionShare: conversionShare === undefined ? undefined : round(conversionShare, 4),
        confidence: confidence(spendShare, row.conversions, minSpendShare, minConversions),
        recommendation: decision.recommendation,
        reason: decision.reason,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const scalable = placements.filter((row) => row.recommendation === 'scale');
  const reducible = placements.filter((row) => row.recommendation === 'reduce');
  const insufficientData = placements.filter((row) => row.recommendation === 'insufficient_data');

  if (insufficientData.length) {
    warnings.push('Some placements have insufficient data; avoid cutting them too early');
  }

  return {
    provider,
    date_range: { since, until },
    totals: {
      spend: round(totals.spend),
      impressions: totals.impressions,
      clicks: totals.clicks,
      conversions: totals.conversions,
      ctr: safeCtr(totals.clicks, totals.impressions),
      cpc: safeCpc(totals.spend, totals.clicks) ?? 0,
      cpm: safeCpm(totals.spend, totals.impressions),
      costPerConversion: averageCostPerConversion,
      revenue: totals.revenue ? round(totals.revenue) : undefined,
      roas: averageRoas,
    },
    placements,
    summary: {
      best: scalable[0],
      worst: reducible[0],
      waste: reducible.sort((a, b) => b.spendShare - a.spendShare)[0],
      insufficient_data: insufficientData,
    },
    warnings,
  };
}
