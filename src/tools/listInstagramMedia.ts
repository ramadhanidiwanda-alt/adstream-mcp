import type { MetaClient } from '../metaClient.js';
import type { InstagramMediaResult } from '../broker/types.js';

export interface ListInstagramMediaOptions {
  igUserId: string;
  limit?: number;
  cursor?: string;
  /**
   * instagram.com post/reel/tv URLs to match against (e.g. what a user pastes
   * in chat). When set, media is paginated (up to maxPages) until every
   * shortcode is found or the page cap is hit, and only matching media is
   * returned — each item's permalink still carries the matched shortcode.
   */
  permalinkUrls?: string[];
  /**
   * How many pages of media to walk when resolving permalinkUrls. Default 10
   * (~500 media). Raise it for archive posts that sit deeper in the feed; each
   * extra page is another Graph call, so it is opt-in rather than unbounded.
   */
  maxPages?: number;
  maxRetries?: number;
}

interface InstagramMediaRaw {
  id: string;
  permalink?: string;
  media_type?: string;
  media_product_type?: string;
  caption?: string;
  timestamp?: string;
  thumbnail_url?: string;
  media_url?: string;
  boost_eligibility_info?: { eligible_to_boost?: boolean };
}

const INSTAGRAM_MEDIA_FIELDS = [
  'id',
  'permalink',
  'media_type',
  'media_product_type',
  'caption',
  'timestamp',
  'thumbnail_url',
  'media_url',
  // Meta only exposes eligible_to_boost here; every other sub-field is rejected
  // with (#100) nonexisting field, so there is no reason code to surface.
  'boost_eligibility_info',
].join(',');

const DEFAULT_MAX_PAGES = 10;
const MAX_MAX_PAGES = 100;

const SHORTCODE_PATTERN = /instagram\.com\/(?:[a-z]{2}\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i;

function extractShortcode(url: string): string | undefined {
  return SHORTCODE_PATTERN.exec(url)?.[1];
}

function toResult(item: InstagramMediaRaw): InstagramMediaResult {
  return {
    id: item.id,
    permalink: item.permalink,
    mediaType: item.media_type,
    mediaProductType: item.media_product_type,
    caption: item.caption,
    timestamp: item.timestamp,
    thumbnailUrl: item.thumbnail_url,
    mediaUrl: item.media_url,
    eligibleToBoost: item.boost_eligibility_info?.eligible_to_boost,
  };
}

/**
 * List media (feed posts, Reels, carousels) for an Instagram Business Account.
 *
 * Calls GET /{ig-user-id}/media
 *
 * Pass permalinkUrls to resolve raw instagram.com URLs (pasted by a user)
 * into media IDs usable as source_instagram_media_id on an ad creative —
 * matching is done by shortcode, tolerant of query strings (?igsh=...).
 */
export async function listInstagramMedia(
  client: MetaClient,
  options: ListInstagramMediaOptions
): Promise<InstagramMediaResult[]> {
  const igUserId = options.igUserId.trim();
  if (!igUserId) throw new Error('igUserId wajib diisi.');

  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_MAX_PAGES) {
    throw new Error(`maxPages harus bilangan bulat 1-${MAX_MAX_PAGES}.`);
  }

  const wantedShortcodes = options.permalinkUrls
    ?.map((url) => extractShortcode(url))
    .filter((code): code is string => Boolean(code));

  const shouldPaginate = Boolean(wantedShortcodes?.length);

  const response = await client.metaGet<{ data: InstagramMediaRaw[] }>(
    `/${igUserId}/media`,
    {
      fields: INSTAGRAM_MEDIA_FIELDS,
      limit: options.limit ?? (shouldPaginate ? 50 : 25),
      after: shouldPaginate ? undefined : options.cursor,
    },
    shouldPaginate
      ? { paginate: true, maxPages, maxRetries: options.maxRetries ?? 3 }
      : { maxRetries: options.maxRetries ?? 3 }
  );

  const items = (response.data ?? []).map(toResult);

  if (!wantedShortcodes?.length) return items;

  const wanted = new Set(wantedShortcodes);
  return items.filter((item) => {
    const shortcode = item.permalink ? extractShortcode(item.permalink) : undefined;
    return shortcode ? wanted.has(shortcode) : false;
  });
}
