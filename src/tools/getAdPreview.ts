import type { MetaClient } from '../metaClient.js';
import type { AdPreviewResult } from '../broker/types.js';

export const AD_PREVIEW_FORMATS = [
  'DESKTOP_FEED',
  'MOBILE_FEED',
  'INSTAGRAM_FEED',
  'INSTAGRAM_EXPLORE',
  'INSTAGRAM_REELS',
  'INSTAGRAM_STORIES',
  'FACEBOOK_STORIES',
  'MESSENGER_INBOX',
  'MARKETPLACE',
  'REWARDS_PLATFORM',
  'FACEBOOK_REELS',
] as const;

export type AdPreviewFormat = (typeof AD_PREVIEW_FORMATS)[number];

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
  const { creativeId, adFormat } = options;

  // Meta expects creative ID without act_ prefix
  const cleanCreativeId = creativeId.replace(/^act_/, '');

  const response = await client.metaGet<AdPreviewsResponse>(
    `/${cleanCreativeId}/previews`,
    { ad_format: adFormat }
  );

  return (response.data ?? []).map((item) => ({
    preview_url: item.preview_url ?? '',
    platform: item.platform ?? 'unknown',
    ad_format: item.ad_format ?? adFormat,
    body: item.body,
  }));
}
