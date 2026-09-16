import type { MetaClient } from '../metaClient.js';
import type {
  AdLibraryAd,
  AdLibraryRange,
  AdLibrarySearchResult,
  SearchAdLibraryOptions,
} from '../types.js';
import { META_AD_LIBRARY_COUNTRIES } from '../types.js';

export const META_AD_LIBRARY_FIELDS = [
  'id',
  'page_id',
  'page_name',
  'ad_snapshot_url',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_creative_link_captions',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'publisher_platforms',
  'spend',
  'impressions',
  'currency',
  'bylines',
] as const;

interface MetaAdLibraryRangeRaw {
  lower_bound?: string | number;
  upper_bound?: string | number;
}

interface MetaAdLibraryAdRaw {
  id?: string;
  page_id?: string;
  page_name?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
  spend?: MetaAdLibraryRangeRaw;
  impressions?: MetaAdLibraryRangeRaw;
  currency?: string;
  bylines?: string;
}

interface MetaAdLibraryResponse {
  data?: MetaAdLibraryAdRaw[];
  paging?: { cursors?: { after?: string } };
}

export async function searchAdLibrary(
  client: MetaClient,
  options: SearchAdLibraryOptions
): Promise<AdLibrarySearchResult> {
  assertValidSearchOptions(options);
  const adType = options.adType ?? 'ALL';
  const response = await client.metaGet<MetaAdLibraryResponse>('/ads_archive', {
    fields: META_AD_LIBRARY_FIELDS.join(','),
    ad_reached_countries: options.countries,
    search_terms: options.searchTerms,
    search_page_ids: options.pageIds,
    ad_type: adType,
    ad_active_status: options.activeStatus ?? 'ACTIVE',
    ad_delivery_date_min: options.dateMin,
    ad_delivery_date_max: options.dateMax,
    media_type: options.mediaType,
    publisher_platforms: options.publisherPlatforms,
    languages: options.languages,
    search_type: options.searchType,
    limit: options.limit ?? 25,
    after: options.cursor,
  });

  return {
    ads: (response.data ?? []).map(normalizeAd),
    paging: { nextCursor: response.paging?.cursors?.after ?? null },
    coverage: {
      adType,
      countries: [...options.countries],
      conversionMetricsAvailable: false,
      limitations: [
        'Commercial-ad availability is limited by Meta Ad Library API country and retention rules.',
        'The API does not expose conversion, click-through, revenue, or ROAS metrics for these ads.',
      ],
    },
  };
}

function assertValidSearchOptions(options: SearchAdLibraryOptions): void {
  if (options.countries.length === 0) {
    throw new Error('At least one reached country is required');
  }
  const supportedCountries = new Set<string>(META_AD_LIBRARY_COUNTRIES);
  if (options.countries.some((country) => !supportedCountries.has(country))) {
    throw new Error('countries contains an unsupported Meta Ad Library country');
  }
  if (!options.searchTerms?.trim() && !options.pageIds?.length) {
    throw new Error('At least one of searchTerms or pageIds is required');
  }
  if (options.searchTerms && options.searchTerms.length > 100) {
    throw new Error('searchTerms must be 100 characters or fewer');
  }
  if (options.pageIds && options.pageIds.length > 10) {
    throw new Error('pageIds supports at most 10 Page IDs');
  }
  if (options.dateMin && options.dateMax && options.dateMin > options.dateMax) {
    throw new Error('dateMin must be earlier than or equal to dateMax');
  }
  if (options.limit !== undefined && (options.limit < 1 || options.limit > 100)) {
    throw new Error('limit must be between 1 and 100');
  }
}

function normalizeAd(item: MetaAdLibraryAdRaw): AdLibraryAd {
  const transparency = {
    spendRange: normalizeRange(item.spend),
    impressionsRange: normalizeRange(item.impressions),
    currency: item.currency,
    byline: item.bylines,
  };
  const hasTransparency = Object.values(transparency).some((value) => value !== undefined);

  return {
    libraryId: item.id ?? '',
    pageId: item.page_id,
    pageName: item.page_name,
    snapshotUrl: sanitizeSnapshotUrl(item.ad_snapshot_url),
    creative: {
      bodies: item.ad_creative_bodies ?? [],
      titles: item.ad_creative_link_titles ?? [],
      descriptions: item.ad_creative_link_descriptions ?? [],
      linkCaptions: item.ad_creative_link_captions ?? [],
    },
    delivery: {
      startedAt: item.ad_delivery_start_time,
      stoppedAt: item.ad_delivery_stop_time,
      platforms: (item.publisher_platforms ?? []).map((platform) => platform.toUpperCase()),
    },
    transparency: hasTransparency ? transparency : undefined,
  };
}

function sanitizeSnapshotUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.replaceAll('&amp;', '&'));
    url.searchParams.delete('access_token');
    return url.toString();
  } catch {
    return value.replace(/([?&]|&amp;)access_token=[^&]*/gi, '');
  }
}

function normalizeRange(range?: MetaAdLibraryRangeRaw): AdLibraryRange | undefined {
  if (!range) return undefined;
  const lower = toFiniteNumber(range.lower_bound);
  const upper = toFiniteNumber(range.upper_bound);
  return lower === undefined && upper === undefined ? undefined : { lower, upper };
}

function toFiniteNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
