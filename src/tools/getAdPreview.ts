import type { MetaClient } from '../metaClient.js';
import type { AdPreviewResult } from '../broker/types.js';

/**
 * ad_format values Meta accepts on GET /{creative_id}/previews, taken verbatim from
 * https://developers.facebook.com/docs/marketing-api/reference/adgroup/previews/
 *
 * Every value this tool previously offered — DESKTOP_FEED, MOBILE_FEED,
 * INSTAGRAM_FEED, INSTAGRAM_STORIES, FACEBOOK_STORIES, MESSENGER_INBOX, MARKETPLACE,
 * REWARDS_PLATFORM, FACEBOOK_REELS, INSTAGRAM_EXPLORE — was misspelled and rejected by
 * Meta. See LEGACY_AD_PREVIEW_FORMATS for the mapping.
 */
export const AD_PREVIEW_FORMATS = [
  'AUDIENCE_NETWORK_INSTREAM_VIDEO',
  'AUDIENCE_NETWORK_INSTREAM_VIDEO_MOBILE',
  'AUDIENCE_NETWORK_OUTSTREAM_VIDEO',
  'AUDIENCE_NETWORK_REWARDED_VIDEO',
  'BIZ_DISCO_FEED_MOBILE',
  'DESKTOP_FEED_STANDARD',
  'FACEBOOK_IFU_REELS_MOBILE',
  'FACEBOOK_PROFILE_FEED_DESKTOP',
  'FACEBOOK_PROFILE_FEED_MOBILE',
  'FACEBOOK_PROFILE_REELS_MOBILE',
  'FACEBOOK_REELS_BANNER',
  'FACEBOOK_REELS_BANNER_DESKTOP',
  'FACEBOOK_REELS_BANNER_FEED_ANDROID',
  'FACEBOOK_REELS_BANNER_FEED_ANDROID_LARGE',
  'FACEBOOK_REELS_BANNER_FULLSCREEN_IOS',
  'FACEBOOK_REELS_BANNER_FULLSCREEN_MOBILE',
  'FACEBOOK_REELS_MOBILE',
  'FACEBOOK_REELS_POSTLOOP',
  'FACEBOOK_REELS_POSTLOOP_FEED',
  'FACEBOOK_REELS_SIMILAR_PRODUCTS_MOBILE',
  'FACEBOOK_REELS_STICKER',
  'FACEBOOK_STORY_MOBILE',
  'FACEBOOK_STORY_STICKER_MOBILE',
  'INSTAGRAM_EXPLORE_CONTEXTUAL',
  'INSTAGRAM_EXPLORE_GRID_HOME',
  'INSTAGRAM_EXPLORE_IMMERSIVE',
  'INSTAGRAM_FEED_WEB',
  'INSTAGRAM_FEED_WEB_M_SITE',
  'INSTAGRAM_LEAD_GEN_MULTI_SUBMIT_ADS',
  'INSTAGRAM_PROFILE_FEED',
  'INSTAGRAM_PROFILE_REELS',
  'INSTAGRAM_REELS',
  'INSTAGRAM_REELS_OVERLAY',
  'INSTAGRAM_REELS_WEB',
  'INSTAGRAM_REELS_WEB_M_SITE',
  'INSTAGRAM_SEARCH_CHAIN',
  'INSTAGRAM_SEARCH_GRID',
  'INSTAGRAM_STANDARD',
  'INSTAGRAM_STORY',
  'INSTAGRAM_STORY_EFFECT_TRAY',
  'INSTAGRAM_STORY_WEB',
  'INSTAGRAM_STORY_WEB_M_SITE',
  'INSTANT_ARTICLE_RECIRCULATION_AD',
  'INSTANT_ARTICLE_STANDARD',
  'INSTREAM_BANNER_DESKTOP',
  'INSTREAM_BANNER_FEED_IOS',
  'INSTREAM_BANNER_FULLSCREEN_IOS',
  'INSTREAM_BANNER_FULLSCREEN_MOBILE',
  'INSTREAM_BANNER_IMMERSIVE_MOBILE',
  'INSTREAM_BANNER_MOBILE',
  'INSTREAM_VIDEO_DESKTOP',
  'INSTREAM_VIDEO_FULLSCREEN_IOS',
  'INSTREAM_VIDEO_FULLSCREEN_MOBILE',
  'INSTREAM_VIDEO_IMAGE',
  'INSTREAM_VIDEO_IMMERSIVE_MOBILE',
  'INSTREAM_VIDEO_MOBILE',
  'JOB_BROWSER_DESKTOP',
  'JOB_BROWSER_MOBILE',
  'MARKETPLACE_MOBILE',
  'MESSENGER_MOBILE_INBOX_MEDIA',
  'MESSENGER_MOBILE_STORY_MEDIA',
  'MOBILE_BANNER',
  'MOBILE_FEED_BASIC',
  'MOBILE_FEED_STANDARD',
  'MOBILE_FULLWIDTH',
  'MOBILE_INTERSTITIAL',
  'MOBILE_MEDIUM_RECTANGLE',
  'MOBILE_NATIVE',
  'RIGHT_COLUMN_STANDARD',
  'SUGGESTED_VIDEO_DESKTOP',
  'SUGGESTED_VIDEO_FULLSCREEN_MOBILE',
  'SUGGESTED_VIDEO_IMMERSIVE_MOBILE',
  'SUGGESTED_VIDEO_MOBILE',
  'WATCH_FEED_HOME',
  'WATCH_FEED_MOBILE',
  'WHATSAPP_STATUS_MEDIA',
] as const;

export type AdPreviewFormat = (typeof AD_PREVIEW_FORMATS)[number];

/**
 * Names this tool used to accept and Meta never did, mapped to the nearest real
 * placement. Callers get the correct spelling instead of Meta's bare enum rejection —
 * and the remap is named rather than silent, since these are not always exact
 * equivalents (REWARDS_PLATFORM in particular becomes an Audience Network format).
 */
export const LEGACY_AD_PREVIEW_FORMATS: Readonly<Record<string, AdPreviewFormat>> = {
  DESKTOP_FEED: 'DESKTOP_FEED_STANDARD',
  MOBILE_FEED: 'MOBILE_FEED_STANDARD',
  INSTAGRAM_FEED: 'INSTAGRAM_STANDARD',
  INSTAGRAM_EXPLORE: 'INSTAGRAM_EXPLORE_GRID_HOME',
  INSTAGRAM_STORIES: 'INSTAGRAM_STORY',
  FACEBOOK_STORIES: 'FACEBOOK_STORY_MOBILE',
  MESSENGER_INBOX: 'MESSENGER_MOBILE_INBOX_MEDIA',
  MARKETPLACE: 'MARKETPLACE_MOBILE',
  REWARDS_PLATFORM: 'AUDIENCE_NETWORK_REWARDED_VIDEO',
  FACEBOOK_REELS: 'FACEBOOK_REELS_MOBILE',
};

const AD_PREVIEW_FORMAT_SET: ReadonlySet<string> = new Set(AD_PREVIEW_FORMATS);

export function isAdPreviewFormat(value: string): value is AdPreviewFormat {
  return AD_PREVIEW_FORMAT_SET.has(value);
}

/** Throws with the corrected spelling when a caller passes a value Meta rejects. */
export function assertAdPreviewFormat(value: string): AdPreviewFormat {
  const normalized = value.trim().toUpperCase();
  if (isAdPreviewFormat(normalized)) return normalized;

  const replacement = LEGACY_AD_PREVIEW_FORMATS[normalized];
  if (replacement) {
    throw new Error(
      `adFormat ${normalized} tidak dikenali Meta. Gunakan ${replacement}. (Daftar resmi: GET /{ad_id}/previews pada dokumentasi Marketing API.)`
    );
  }

  throw new Error(
    `adFormat ${normalized} tidak ada pada enum ad_format Meta. Lihat daftar resmi di dokumentasi GET /{ad_id}/previews.`
  );
}

export interface GetAdPreviewOptions {
  creativeId: string;
  adFormat: AdPreviewFormat;
}

interface AdPreviewRaw {
  body?: string;
  preview_url?: string;
  platform?: string;
  ad_format?: string;
}

interface AdPreviewsResponse {
  data: AdPreviewRaw[];
}

export async function getAdPreview(
  client: MetaClient,
  options: GetAdPreviewOptions
): Promise<AdPreviewResult[]> {
  const { creativeId } = options;
  const adFormat = assertAdPreviewFormat(options.adFormat);

  // Meta expects creative ID without act_ prefix
  const cleanCreativeId = creativeId.replace(/^act_/, '');

  const response = await client.metaGet<AdPreviewsResponse>(`/${cleanCreativeId}/previews`, {
    ad_format: adFormat,
  });

  return (response.data ?? []).map((item) => ({
    preview_url: item.preview_url ?? '',
    platform: item.platform ?? 'unknown',
    ad_format: item.ad_format ?? adFormat,
    body: item.body,
  }));
}
