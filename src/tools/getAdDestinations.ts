import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import {
  buildMetaIdFilteringRules,
  mergeMetaFilteringRules,
  type MetaFilteringRule,
} from '../utils/metaFiltering.js';

export interface GetAdDestinationsOptions {
  adAccountId: string;
  /** Filter by effective status. Default: ['ACTIVE'] */
  effectiveStatus?: string[];
  /** Optional: filter by specific ad IDs */
  adIds?: string[];
  /** Optional: restrict results to a specific campaign (server-side filter). */
  campaignId?: string | string[];
  /** Optional: restrict results to a specific ad set (server-side filter). */
  adSetId?: string | string[];
  /** Caller-supplied Meta filtering rules, merged with status and entity filters. */
  explicitFilters?: MetaFilteringRule[];
  limit?: number;
  cursor?: string;
}

export interface AdDestinationInfo {
  ad_id: string;
  ad_name?: string;
  status?: string;
  effective_status?: string;
  creative_id?: string;
  creative_type?: string;
  /** The primary destination URL (if found). Null if not available. */
  destination_url: string | null;
  /** All destination URLs found */
  all_urls: string[];
  /** How the URL was resolved */
  resolution_method: string | null;
  /** Warning if URL could not be resolved */
  warning?: string;
  /** Meta delivery issues attached to the ad (for example hard errors). */
  issues_info?: Array<Record<string, unknown>>;
  /** Meta policy review feedback when the ad is rejected or restricted. */
  ad_review_feedback?: Record<string, unknown>;
}

export type AdDestinationPage = AdDestinationInfo[] & { paging?: { cursors?: { after?: string } } };

// ── Meta API response types ──

interface MetaCtaValue {
  link?: string;
}

interface MetaCallToAction {
  type?: string;
  value?: MetaCtaValue;
}

interface MetaLinkData {
  link?: string;
  call_to_action?: MetaCallToAction;
  child_attachments?: Array<{ link?: string }>;
}

interface MetaVideoData {
  video_id?: string;
  call_to_action?: MetaCallToAction;
}

interface MetaObjectStorySpec {
  link_data?: MetaLinkData;
  video_data?: MetaVideoData;
  page_id?: string;
  post_id?: string;
}

interface MetaLinkUrl {
  website_url?: string;
}

interface MetaAssetFeedComponent {
  link_url?: { website_url?: string };
}

interface MetaAssetFeedGroup {
  components?: MetaAssetFeedComponent[];
}

interface MetaAssetFeedSpec {
  link_urls?: MetaLinkUrl[];
  groups?: MetaAssetFeedGroup[];
}

interface MetaCreativeExpanded {
  id?: string;
  object_type?: string;
  object_story_spec?: MetaObjectStorySpec;
  asset_feed_spec?: MetaAssetFeedSpec;
}

interface MetaAdWithCreative {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  issues_info?: Array<Record<string, unknown>>;
  ad_review_feedback?: Record<string, unknown>;
  creative?: MetaCreativeExpanded;
}

// ── Resolution methods ──

const RESOLUTION = {
  LINK_DATA_LINK: 'link_data.link',
  LINK_DATA_CTA: 'link_data.call_to_action.value.link',
  VIDEO_DATA_CTA: 'video_data.call_to_action.value.link',
  CHILD_ATTACHMENT: 'carousel.child_attachment.link',
  ASSET_FEED_URL: 'asset_feed_spec.link_urls',
  ASSET_FEED_GROUP: 'asset_feed_spec.groups.components.link_url',
  NOT_FOUND: null,
} as const;

/**
 * Extract destination URL(s) from a Meta creative's object_story_spec or asset_feed_spec.
 *
 * Handles:
 * - Single image with link (link_data.link)
 * - Single image with CTA (link_data.call_to_action.value.link)
 * - Video with CTA (video_data.call_to_action.value.link)
 * - Carousel (link_data.child_attachments[].link)
 * - Dynamic creative / Advantage+ (asset_feed_spec.link_urls / groups)
 * - Existing post (needs separate post fetch — flagged as NOT_FOUND here)
 */
function extractUrlsFromCreative(creative: MetaCreativeExpanded): {
  primaryUrl: string | null;
  allUrls: string[];
  method: string | null;
  warning?: string;
} {
  const objectType = creative.object_type;
  const spec = creative.object_story_spec;
  const assetFeed = creative.asset_feed_spec;

  const allUrls: string[] = [];

  // ── 1. link_data.link (single image / link ad) ──
  if (spec?.link_data?.link) {
    const url = spec.link_data.link;
    allUrls.push(url);
    return { primaryUrl: url, allUrls: [...new Set(allUrls)], method: RESOLUTION.LINK_DATA_LINK };
  }

  // ── 2. link_data.call_to_action.value.link ──
  if (spec?.link_data?.call_to_action?.value?.link) {
    const url = spec.link_data.call_to_action.value.link;
    allUrls.push(url);
    return { primaryUrl: url, allUrls: [...new Set(allUrls)], method: RESOLUTION.LINK_DATA_CTA };
  }

  // ── 3. Carousel: link_data.child_attachments[].link ──
  if (spec?.link_data?.child_attachments && spec.link_data.child_attachments.length > 0) {
    const carouselUrls = spec.link_data.child_attachments
      .map((child) => child.link)
      .filter((link): link is string => !!link);
    allUrls.push(...carouselUrls);

    if (carouselUrls.length > 0) {
      return {
        primaryUrl: carouselUrls[0],
        allUrls: [...new Set(allUrls)],
        method: RESOLUTION.CHILD_ATTACHMENT,
      };
    }
  }

  // ── 4. video_data.call_to_action.value.link ──
  if (spec?.video_data?.call_to_action?.value?.link) {
    const url = spec.video_data.call_to_action.value.link;
    allUrls.push(url);
    return { primaryUrl: url, allUrls: [...new Set(allUrls)], method: RESOLUTION.VIDEO_DATA_CTA };
  }

  // ── 5. asset_feed_spec.link_urls (Advantage+ / Dynamic) ──
  if (assetFeed?.link_urls && assetFeed.link_urls.length > 0) {
    const feedUrls = assetFeed.link_urls
      .map((u) => u.website_url)
      .filter((url): url is string => !!url);
    allUrls.push(...feedUrls);

    if (feedUrls.length > 0) {
      return {
        primaryUrl: feedUrls[0],
        allUrls: [...new Set(allUrls)],
        method: RESOLUTION.ASSET_FEED_URL,
      };
    }
  }

  // ── 6. asset_feed_spec.groups[].components[].link_url.website_url ──
  if (assetFeed?.groups) {
    for (const group of assetFeed.groups) {
      if (group.components) {
        for (const component of group.components) {
          if (component.link_url?.website_url) {
            allUrls.push(component.link_url.website_url);
          }
        }
      }
    }

    if (allUrls.length > 0) {
      return {
        primaryUrl: allUrls[0],
        allUrls: [...new Set(allUrls)],
        method: RESOLUTION.ASSET_FEED_GROUP,
      };
    }
  }

  // ── 7. Existing post (no direct URL in creative metadata) ──
  if (spec?.page_id && spec?.post_id) {
    return {
      primaryUrl: null,
      allUrls: [],
      method: null,
      warning: `Existing post creative (page ${spec.page_id}, post ${spec.post_id}). Destination URL is in the post itself — use /${spec.post_id}?fields=permalink_url,message,attachments to fetch.`,
    };
  }

  // ── 8. No URL found ──
  const typeHint = objectType ? ` (object_type: ${objectType})` : '';
  return {
    primaryUrl: null,
    allUrls: [],
    method: null,
    warning: `No destination URL found in creative metadata${typeHint}. The creative may use an existing post, or the URL may not be accessible with current permissions.`,
  };
}

// ── Infer creative type from Meta object_type ──

function inferCreativeType(creative: MetaCreativeExpanded): string {
  const objectType = creative.object_type;
  const spec = creative.object_story_spec;
  const assetFeed = creative.asset_feed_spec;

  if (objectType === 'SHARE') return 'existing_post';
  if (objectType === 'PRIVACY_CHECK_FAIL') return 'privacy_check_fail';
  if (objectType === 'STATUS') return 'status_post';
  if (objectType === 'PHOTO') return 'photo_post';
  if (spec?.video_data) return 'video';
  if (spec?.link_data?.child_attachments) return 'carousel';
  if (assetFeed) return 'advantage_plus_dynamic';
  if (spec?.link_data) return 'link';
  return objectType ?? 'unknown';
}

/**
 * Fetch active ads with destination URLs from Meta Ads API.
 *
 * Uses `/act_{id}/ads?fields=id,name,status,effective_status,creative{id,object_type,object_story_spec,asset_feed_spec}`
 * with optional `effective_status` filter.
 */
export async function getAdDestinations(
  client: MetaClient,
  options: GetAdDestinationsOptions
): Promise<AdDestinationPage> {
  const {
    effectiveStatus = ['ACTIVE'],
    adIds,
    campaignId,
    adSetId,
    explicitFilters,
    limit = 100,
    cursor,
  } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);

  // Build fields — request creative expanded with object_story_spec and asset_feed_spec
  const fields =
    'id,name,status,effective_status,issues_info,ad_review_feedback,' +
    'creative{id,object_type,object_story_spec{link_data{link,call_to_action{type,value{link}},child_attachments{link}},video_data{call_to_action{type,value{link}}}},asset_feed_spec{link_urls{website_url},groups{components{link_url{website_url}}}}}';

  const params: Record<string, string | number> = {
    fields,
    limit,
  };

  const filtering = mergeMetaFilteringRules(
    effectiveStatus.length > 0
      ? [{ field: 'effective_status', operator: 'IN', value: effectiveStatus }]
      : undefined,
    buildMetaIdFilteringRules([
      { field: 'campaign.id', value: campaignId },
      { field: 'adset.id', value: adSetId },
      { field: 'id', value: adIds },
    ]),
    explicitFilters
  );

  if (filtering) {
    params.filtering = JSON.stringify(filtering);
  }

  if (cursor) {
    params.after = cursor;
  }

  const response = await client.metaGet<{
    data: MetaAdWithCreative[];
    paging?: { cursors?: { after?: string } };
  }>(`/act_${adAccountId}/ads`, params);

  const ads = response.data || [];

  const result: AdDestinationInfo[] = ads.map((ad) => {
    const creative = ad.creative;
    let destinationUrl: string | null = null;
    let allUrls: string[] = [];
    let resolutionMethod: string | null = null;
    let warning: string | undefined;

    if (creative) {
      const extracted = extractUrlsFromCreative(creative);
      destinationUrl = extracted.primaryUrl;
      allUrls = extracted.allUrls;
      resolutionMethod = extracted.method;
      warning = extracted.warning;
    } else {
      warning = 'Ad has no creative associated. The creative may be deleted or not yet created.';
    }

    const creativeType = creative ? inferCreativeType(creative) : undefined;

    return {
      ad_id: ad.id ?? '',
      ad_name: ad.name,
      status: ad.status,
      effective_status: ad.effective_status,
      issues_info: ad.issues_info,
      ad_review_feedback: ad.ad_review_feedback,
      creative_id: creative?.id,
      creative_type: creativeType,
      destination_url: destinationUrl,
      all_urls: allUrls,
      resolution_method: resolutionMethod,
      warning,
    };
  });

  return Object.assign(result, { paging: response.paging }) as AdDestinationPage;
}
