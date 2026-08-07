import type { MetaClient } from '../metaClient.js';
import type {
  CreativeAssetCandidate,
  CreativeAssetQuality,
  CreativeAssetResolution,
  CreativeAssetSource,
} from '../broker/types.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import {
  buildMetaIdFilteringRules,
  filterAdsByEntityScope,
  mergeMetaFilteringRules,
  resolveAdsEdgeScope,
  type MetaFilteringRule,
} from '../utils/metaFiltering.js';

export interface ResolveCreativeAssetsOptions {
  adAccountId: string;
  adIds?: string[];
  campaignId?: string | string[];
  adSetId?: string | string[];
  explicitFilters?: MetaFilteringRule[];
  limit?: number;
  cursor?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

export type CreativeAssetResolutionPage = CreativeAssetResolution[] & {
  paging?: { cursors?: { after?: string } };
};

interface MetaCreativeForAssets {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  image_hash?: string;
  video_id?: string;
  effective_instagram_media_id?: string;
  source_instagram_media_id?: string;
  object_story_spec?: {
    link_data?: {
      image_hash?: string;
      picture?: string;
      child_attachments?: Array<{ image_hash?: string; picture?: string; video_id?: string }>;
    };
    video_data?: {
      video_id?: string;
      image_url?: string;
      image_hash?: string;
    };
  };
  asset_feed_spec?: {
    images?: Array<{ hash?: string; url?: string }>;
    videos?: Array<{ video_id?: string; thumbnail_url?: string }>;
  };
}

interface MetaAdWithCreativeAssets {
  id?: string;
  name?: string;
  campaign_id?: string;
  adset_id?: string;
  creative?: MetaCreativeForAssets;
}

interface MetaAdImageAsset {
  hash?: string;
  url?: string;
  url_128?: string;
  width?: number;
  height?: number;
}

interface MetaVideoThumbnail {
  uri?: string;
  source?: string;
  width?: number;
  height?: number;
  is_preferred?: boolean;
}

interface MetaInstagramMedia {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
}

const DEFAULT_THUMBNAIL_WIDTH = 1920;
const DEFAULT_THUMBNAIL_HEIGHT = 1080;

/**
 * Meta accepts a JSON array of hashes on `/act_{id}/adimages`. Batched so a
 * page of ads with many distinct images cannot blow past the URL length limit.
 */
const ADIMAGE_HASH_BATCH_SIZE = 50;

/**
 * Per-entity lookups (video thumbnails, Instagram media) fan out one Graph call
 * each. Capped so a full page of ads cannot fire 100+ concurrent requests and
 * trip Meta's rate limiter.
 */
const GRAPH_FETCH_CONCURRENCY = 5;

export async function resolveCreativeAssets(
  client: MetaClient,
  options: ResolveCreativeAssetsOptions
): Promise<CreativeAssetResolutionPage> {
  const adAccountId = normalizeAccountId(options.adAccountId);
  const ads = await fetchAdsWithCreatives(client, adAccountId, options);
  const imageAssets = await fetchImageAssets(client, adAccountId, collectImageHashes(ads));
  const videoThumbnails = await fetchVideoThumbnails(client, collectVideoIds(ads));
  const instagramMedia = await fetchInstagramMedia(client, collectInstagramMediaIds(ads));

  const result = ads.map((ad) => {
    const creative = ad.creative;
    const imageHashes = creative ? collectCreativeImageHashes(creative) : [];
    const videoId = creative ? getCreativeVideoId(creative) : undefined;
    const instagramMediaId = creative ? getCreativeInstagramMediaId(creative) : undefined;
    const candidates = [
      ...imageHashes.flatMap((hash) => candidatesFromImageAsset(imageAssets.get(hash))),
      ...candidatesFromVideoThumbnails(videoThumbnails.get(videoId ?? '')),
      ...candidatesFromInstagramMedia(instagramMedia.get(instagramMediaId ?? '')),
      ...candidatesFromCreative(creative),
    ].sort(compareCandidates);

    return {
      provider: 'meta' as const,
      ad_id: ad.id ?? '',
      ad_name: ad.name,
      creative_id: creative?.id,
      creative_name: creative?.name,
      media_kind: inferMediaKind(creative, candidates),
      best_thumbnail: candidates[0],
      candidates,
      video_id: videoId,
      image_hashes: imageHashes.length ? imageHashes : undefined,
    };
  });

  return Object.assign(result, { paging: (ads as typeof ads & { paging?: unknown }).paging });
}

async function fetchAdsWithCreatives(
  client: MetaClient,
  adAccountId: string,
  options: ResolveCreativeAssetsOptions
): Promise<MetaAdWithCreativeAssets[] & { paging?: { cursors?: { after?: string } } }> {
  const { path, needsPostFilter } = resolveAdsEdgeScope(
    adAccountId,
    options.campaignId,
    options.adSetId
  );
  const filtering = mergeMetaFilteringRules(
    buildMetaIdFilteringRules([{ field: 'id', value: options.adIds }]),
    options.explicitFilters
  );
  const response = await client.metaGet<{
    data: MetaAdWithCreativeAssets[];
    paging?: { cursors?: { after?: string } };
  }>(path, {
    fields:
      'id,name,campaign_id,adset_id,creative{id,name,thumbnail_url,image_url,image_hash,video_id,effective_instagram_media_id,source_instagram_media_id,object_story_spec,asset_feed_spec}',
    limit: options.limit ?? 100,
    after: options.cursor,
    thumbnail_width: options.thumbnailWidth ?? DEFAULT_THUMBNAIL_WIDTH,
    thumbnail_height: options.thumbnailHeight ?? DEFAULT_THUMBNAIL_HEIGHT,
    ...(filtering ? { filtering: JSON.stringify(filtering) } : {}),
  });
  const rawAds = response.data ?? [];
  const ads = needsPostFilter
    ? filterAdsByEntityScope(
        rawAds,
        options.campaignId,
        options.adSetId,
        (ad) => ad.campaign_id,
        (ad) => ad.adset_id
      )
    : rawAds;

  return Object.assign(ads, { paging: response.paging });
}

/**
 * Looks up the requested hashes explicitly. Without the `hashes` filter Meta
 * returns the account's default page of images, so on accounts with more than
 * a page of assets the hashes we actually need are usually absent and every ad
 * silently degrades to the low-quality AdCreative thumbnail.
 */
async function fetchImageAssets(
  client: MetaClient,
  adAccountId: string,
  hashes: string[]
): Promise<Map<string, MetaAdImageAsset>> {
  if (!hashes.length) return new Map();

  const batches = chunk(hashes, ADIMAGE_HASH_BATCH_SIZE);
  const responses = await mapWithConcurrency(batches, GRAPH_FETCH_CONCURRENCY, async (batch) => {
    const response = await client.metaGet<{ data: MetaAdImageAsset[] }>(
      `/act_${adAccountId}/adimages`,
      {
        fields: 'hash,url,url_128,width,height,name',
        hashes: JSON.stringify(batch),
        limit: batch.length,
      }
    );
    return response.data ?? [];
  });

  return new Map(
    responses
      .flat()
      .filter((image): image is MetaAdImageAsset & { hash: string } => Boolean(image.hash))
      .map((image) => [image.hash, image])
  );
}

async function fetchVideoThumbnails(
  client: MetaClient,
  videoIds: string[]
): Promise<Map<string, MetaVideoThumbnail[]>> {
  const entries = await mapWithConcurrency(
    videoIds,
    GRAPH_FETCH_CONCURRENCY,
    async (videoId): Promise<readonly [string, MetaVideoThumbnail[]]> => {
      // A deleted or permission-restricted video must not fail the whole page:
      // the creative still has lower-quality candidates to fall back on.
      const thumbnails = await ignoreLookupFailure(async () => {
        const response = await client.metaGet<{ data: MetaVideoThumbnail[] }>(
          `/${videoId}/thumbnails`,
          { fields: 'id,uri,source,width,height,is_preferred' }
        );
        return response.data ?? [];
      });
      return [videoId, thumbnails ?? []] as const;
    }
  );
  return new Map(entries);
}

/**
 * Instagram-native placements expose the original media through the IG media
 * node rather than through `/adimages`, so this is the only path to a full-size
 * asset for those ads.
 */
async function fetchInstagramMedia(
  client: MetaClient,
  mediaIds: string[]
): Promise<Map<string, MetaInstagramMedia>> {
  if (!mediaIds.length) return new Map();

  const entries = await mapWithConcurrency(
    mediaIds,
    GRAPH_FETCH_CONCURRENCY,
    async (mediaId): Promise<readonly [string, MetaInstagramMedia | undefined]> => {
      // IG media reads need instagram_basic on the linked account; accounts
      // without it should degrade to the other candidates, not error out.
      const media = await ignoreLookupFailure(() =>
        client.metaGetObject<MetaInstagramMedia>(`/${mediaId}`, {
          fields: 'media_type,media_url,thumbnail_url',
        })
      );
      return [mediaId, media] as const;
    }
  );

  return new Map(
    entries.filter((entry): entry is readonly [string, MetaInstagramMedia] => Boolean(entry[1]))
  );
}

function collectImageHashes(ads: MetaAdWithCreativeAssets[]): string[] {
  return unique(ads.flatMap((ad) => (ad.creative ? collectCreativeImageHashes(ad.creative) : [])));
}

function collectCreativeImageHashes(creative: MetaCreativeForAssets): string[] {
  return unique([
    creative.image_hash,
    creative.object_story_spec?.link_data?.image_hash,
    creative.object_story_spec?.video_data?.image_hash,
    ...(creative.object_story_spec?.link_data?.child_attachments ?? []).map(
      (card) => card.image_hash
    ),
    ...(creative.asset_feed_spec?.images ?? []).map((image) => image.hash),
  ]);
}

function collectVideoIds(ads: MetaAdWithCreativeAssets[]): string[] {
  return unique(ads.map((ad) => (ad.creative ? getCreativeVideoId(ad.creative) : undefined)));
}

function collectInstagramMediaIds(ads: MetaAdWithCreativeAssets[]): string[] {
  return unique(
    ads.map((ad) => (ad.creative ? getCreativeInstagramMediaId(ad.creative) : undefined))
  );
}

function getCreativeInstagramMediaId(creative: MetaCreativeForAssets): string | undefined {
  return creative.effective_instagram_media_id ?? creative.source_instagram_media_id;
}

function getCreativeVideoId(creative: MetaCreativeForAssets): string | undefined {
  return (
    creative.video_id ??
    creative.object_story_spec?.video_data?.video_id ??
    creative.object_story_spec?.link_data?.child_attachments?.find((card) => card.video_id)
      ?.video_id ??
    creative.asset_feed_spec?.videos?.find((video) => video.video_id)?.video_id
  );
}

function candidatesFromImageAsset(image: MetaAdImageAsset | undefined): CreativeAssetCandidate[] {
  if (!image) return [];
  const candidates: CreativeAssetCandidate[] = [];
  if (image.url) {
    candidates.push({
      url: image.url,
      source: 'adimage_url',
      width: image.width,
      height: image.height,
      quality: qualityFromDimensions(image.width, image.height),
      expires_maybe: true,
      media_kind: 'image',
    });
  }
  if (image.url_128) {
    candidates.push({
      url: image.url_128,
      source: 'adimage_url_128',
      width: 128,
      height: 128,
      quality: 'low',
      expires_maybe: true,
      media_kind: 'image',
    });
  }
  return candidates;
}

function candidatesFromVideoThumbnails(
  thumbnails: MetaVideoThumbnail[] | undefined
): CreativeAssetCandidate[] {
  return (thumbnails ?? []).flatMap((thumbnail) => {
    const url = thumbnail.uri ?? thumbnail.source;
    return url
      ? [
          {
            url,
            source: 'video_thumbnail' as const,
            width: thumbnail.width,
            height: thumbnail.height,
            quality: qualityFromDimensions(thumbnail.width, thumbnail.height),
            expires_maybe: true,
            media_kind: 'video' as const,
            is_preferred: thumbnail.is_preferred,
          },
        ]
      : [];
  });
}

function candidatesFromInstagramMedia(
  media: MetaInstagramMedia | undefined
): CreativeAssetCandidate[] {
  if (!media) return [];
  const isVideo = media.media_type === 'VIDEO';
  const candidates: CreativeAssetCandidate[] = [];

  // For VIDEO media `media_url` is the video file itself, not a still, so only
  // `thumbnail_url` is usable as a thumbnail there.
  if (!isVideo && media.media_url) {
    candidates.push({
      url: media.media_url,
      source: 'ig_media_url',
      quality: 'unknown',
      expires_maybe: true,
      media_kind: 'image',
    });
  }
  if (media.thumbnail_url) {
    candidates.push({
      url: media.thumbnail_url,
      source: 'ig_thumbnail_url',
      quality: 'unknown',
      expires_maybe: true,
      media_kind: isVideo ? 'video' : 'image',
    });
  }
  return candidates;
}

function candidatesFromCreative(
  creative: MetaCreativeForAssets | undefined
): CreativeAssetCandidate[] {
  if (!creative) return [];
  const candidates: CreativeAssetCandidate[] = [];
  if (creative.thumbnail_url) {
    candidates.push({
      url: creative.thumbnail_url,
      source: 'adcreative_thumbnail_url',
      quality: 'unknown',
      expires_maybe: true,
      media_kind: creative.video_id ? 'video' : 'unknown',
    });
  }
  if (creative.image_url) {
    candidates.push({
      url: creative.image_url,
      source: 'adcreative_image_url',
      quality: 'unknown',
      expires_maybe: true,
      media_kind: 'image',
    });
  }
  if (creative.object_story_spec?.link_data?.picture) {
    candidates.push({
      url: creative.object_story_spec.link_data.picture,
      source: 'adcreative_image_url',
      quality: 'unknown',
      expires_maybe: true,
      media_kind: 'image',
    });
  }
  if (creative.object_story_spec?.video_data?.image_url) {
    candidates.push({
      url: creative.object_story_spec.video_data.image_url,
      source: 'adcreative_image_url',
      quality: 'unknown',
      expires_maybe: true,
      media_kind: 'video',
    });
  }
  return candidates;
}

function inferMediaKind(
  creative: MetaCreativeForAssets | undefined,
  candidates: CreativeAssetCandidate[]
): 'image' | 'video' | 'unknown' {
  if (creative && getCreativeVideoId(creative)) return 'video';
  if (creative && collectCreativeImageHashes(creative).length) return 'image';
  return candidates.find((candidate) => candidate.media_kind)?.media_kind ?? 'unknown';
}

function compareCandidates(left: CreativeAssetCandidate, right: CreativeAssetCandidate): number {
  return candidateScore(right) - candidateScore(left);
}

function candidateScore(candidate: CreativeAssetCandidate): number {
  const sourceScore: Record<CreativeAssetSource, number> = {
    adimage_url: 600,
    video_thumbnail: 500,
    ig_media_url: 450,
    ig_thumbnail_url: 440,
    adcreative_image_url: 350,
    adcreative_thumbnail_url: 300,
    adimage_url_128: 100,
  };
  const preferredScore = candidate.is_preferred ? 50 : 0;
  const areaScore =
    candidate.width && candidate.height
      ? Math.min(candidate.width * candidate.height, 2_073_600) / 10_000
      : 0;
  return sourceScore[candidate.source] + preferredScore + areaScore;
}

function qualityFromDimensions(width?: number, height?: number): CreativeAssetQuality {
  const largestSide = Math.max(width ?? 0, height ?? 0);
  if (largestSide >= 720) return 'high';
  if (largestSide >= 480) return 'medium';
  if (largestSide > 0) return 'low';
  return 'unknown';
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function chunk<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

/** Runs `worker` over `values`, keeping at most `limit` calls in flight and preserving input order. */
async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await worker(values[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

/** Returns undefined instead of throwing, for optional per-entity asset lookups. */
async function ignoreLookupFailure<T>(lookup: () => Promise<T>): Promise<T | undefined> {
  try {
    return await lookup();
  } catch {
    return undefined;
  }
}
