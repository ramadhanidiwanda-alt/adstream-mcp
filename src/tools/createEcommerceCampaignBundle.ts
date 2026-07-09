import type { MetaClient } from '../metaClient.js';
import { uploadImage } from './uploadImage.js';
import { uploadVideo } from './uploadVideo.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';

export type EcommerceLaunchStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
export type MetaEcommerceCallToActionType = 'SHOP_NOW' | 'LEARN_MORE' | 'SIGN_UP' | 'GET_OFFER';

export interface EcommerceCampaignBundlePayload {
  adAccountId: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  pageId: string;
  pixelId: string;
  destinationUrl: string;
  dailyBudget: number;
  currency?: string;
  countries: string[];
  primaryText: string;
  headline: string;
  description?: string;
  imageHash?: string;
  videoId?: string;
  imageFilePath?: string;
  videoFilePath?: string;
  callToActionType?: MetaEcommerceCallToActionType;
  bidStrategy?: 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP';
  billingEvent?: 'IMPRESSIONS';
  optimizationGoal?: 'OFFSITE_CONVERSIONS';
  customEventType?: 'PURCHASE' | 'ADD_TO_CART' | 'INITIATED_CHECKOUT';
  specialAdCategories?: string[];
  ageMin?: number;
  ageMax?: number;
  publisherPlatforms?: string[];
  instagramUserId?: string;
}

export interface EcommerceCampaignBundleOptions {
  dryRun?: boolean;
  confirmed?: boolean;
  maxRetries?: number;
}

export interface EcommerceCampaignBundlePreview {
  campaign: Record<string, unknown>;
  adSet: Record<string, unknown>;
  creative: Record<string, unknown>;
  ad: Record<string, unknown>;
}

export interface EcommerceCampaignBundleResult {
  operation: 'create_ecommerce_campaign_bundle';
  status: EcommerceLaunchStatus;
  executed: boolean;
  preview: EcommerceCampaignBundlePreview;
  ids?: {
    campaignId?: string;
    adSetId?: string;
    creativeId?: string;
    adId?: string;
  };
  responses?: {
    campaign?: Record<string, unknown>;
    adSet?: Record<string, unknown>;
    creative?: Record<string, unknown>;
    ad?: Record<string, unknown>;
  };
  error?: string;
  warnings: string[];
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

export async function createEcommerceCampaignBundle(
  client: MetaClient,
  payload: EcommerceCampaignBundlePayload,
  options: EcommerceCampaignBundleOptions = {}
): Promise<EcommerceCampaignBundleResult> {
  validatePayload(payload);

  const { dryRun = true, confirmed = false, maxRetries = 3 } = options;
  const preview = buildPreview(payload);
  const baseResult: EcommerceCampaignBundleResult = {
    operation: 'create_ecommerce_campaign_bundle',
    status: 'dry_run',
    executed: false,
    preview,
    warnings: [
      'All entities are created as PAUSED by default; review in Meta Ads Manager before publishing.',
      'This ecommerce MVP optimizes for the PURCHASE pixel event using OUTCOME_SALES.',
      ...(payload.imageFilePath?.trim()
        ? [`Will upload image file: ${payload.imageFilePath.trim().split('/').pop() || payload.imageFilePath.trim()}`]
        : []),
      ...(payload.videoFilePath?.trim()
        ? [`Will upload video file: ${payload.videoFilePath.trim().split('/').pop() || payload.videoFilePath.trim()}`]
        : []),
    ],
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  const accountPath = normalizeAccountPath(payload.adAccountId);

  try {
    const campaign = await client.metaPost<MetaIdResponse>(
      `${accountPath}/campaigns`,
      preview.campaign,
      maxRetries
    );
    const campaignId = requireCreatedId(campaign, 'campaign');

    const adSetPayload = { ...preview.adSet, campaign_id: campaignId };
    const adSet = await client.metaPost<MetaIdResponse>(`${accountPath}/adsets`, adSetPayload, maxRetries);
    const adSetId = requireCreatedId(adSet, 'ad set');

    // Auto-upload file if filePath is provided instead of hash/ID
    const creativePayload = { ...preview.creative };
    if (payload.imageFilePath?.trim() && !payload.imageHash?.trim()) {
      const uploadResult = await uploadImage(client, {
        adAccountId: payload.adAccountId,
        filePath: payload.imageFilePath.trim(),
        maxRetries,
      });
      if (uploadResult.status === 'failed' || !uploadResult.image_hash) {
        return {
          ...baseResult,
          status: 'failed' as const,
          error: `Image upload failed: ${uploadResult.error ?? 'unknown error'}`,
        };
      }
      // Inject image_hash into creative link_data
      if (creativePayload.object_story_spec) {
        const linkData = (creativePayload.object_story_spec as Record<string, unknown>).link_data as Record<string, unknown> | undefined;
        if (linkData) {
          linkData.image_hash = uploadResult.image_hash;
        }
      }
    } else if (payload.videoFilePath?.trim() && !payload.videoId?.trim()) {
      const uploadResult = await uploadVideo(client, {
        adAccountId: payload.adAccountId,
        filePath: payload.videoFilePath.trim(),
        maxRetries,
      });
      if (uploadResult.status === 'failed' || !uploadResult.video_id) {
        return {
          ...baseResult,
          status: 'failed' as const,
          error: `Video upload failed: ${uploadResult.error ?? 'unknown error'}`,
        };
      }
      // For video creative, the object_story_spec uses video_data instead of link_data
      // This is handled by the caller providing the correct spec; for MVP link_data,
      // video is referenced by video_id but not used in link_data.image_hash
    }

    const creative = await client.metaPost<MetaIdResponse>(
      `${accountPath}/adcreatives`,
      creativePayload,
      maxRetries
    );
    const creativeId = requireCreatedId(creative, 'creative');

    const adPayload = {
      ...preview.ad,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: creativeId }),
    };
    const ad = await client.metaPost<MetaIdResponse>(`${accountPath}/ads`, adPayload, maxRetries);
    const adId = requireCreatedId(ad, 'ad');

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      ids: { campaignId, adSetId, creativeId, adId },
      responses: { campaign, adSet, creative, ad },
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildPreview(payload: EcommerceCampaignBundlePayload): EcommerceCampaignBundlePreview {
  const destinationUrl = payload.destinationUrl.trim();
  const callToActionType = payload.callToActionType ?? 'SHOP_NOW';
  const linkData: Record<string, unknown> = {
    link: destinationUrl,
    message: payload.primaryText.trim(),
    name: payload.headline.trim(),
    call_to_action: {
      type: callToActionType,
      value: { link: destinationUrl },
    },
  };

  if (payload.description?.trim()) linkData.description = payload.description.trim();
  if (payload.imageHash?.trim()) linkData.image_hash = payload.imageHash.trim();

  const creativePreviewName = payload.imageFilePath?.trim()
    ? `${payload.adName.trim()} Creative (will upload: ${payload.imageFilePath.trim().split('/').pop() || payload.imageFilePath.trim()})`
    : payload.videoFilePath?.trim()
      ? `${payload.adName.trim()} Creative (will upload: ${payload.videoFilePath.trim().split('/').pop() || payload.videoFilePath.trim()})`
      : `${payload.adName.trim()} Creative`;

  const objectStorySpec: Record<string, unknown> = {
    page_id: payload.pageId.trim(),
    link_data: linkData,
  };

  if (payload.instagramUserId?.trim()) {
    objectStorySpec.instagram_user_id = payload.instagramUserId.trim();
  }

  return {
    campaign: {
      name: payload.campaignName.trim(),
      objective: 'OUTCOME_SALES',
      buying_type: 'AUCTION',
      status: 'PAUSED',
      special_ad_categories: payload.specialAdCategories ?? [],
    },
    adSet: {
      name: payload.adSetName.trim(),
      status: 'PAUSED',
      billing_event: payload.billingEvent ?? 'IMPRESSIONS',
      optimization_goal: payload.optimizationGoal ?? 'OFFSITE_CONVERSIONS',
      bid_strategy: payload.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: payload.dailyBudget,
      targeting: {
        geo_locations: { countries: payload.countries },
        age_min: payload.ageMin ?? 18,
        ...(payload.ageMax ? { age_max: payload.ageMax } : {}),
        ...(payload.publisherPlatforms ? { publisher_platforms: payload.publisherPlatforms } : {}),
      },
      promoted_object: {
        pixel_id: payload.pixelId.trim(),
        custom_event_type: payload.customEventType ?? 'PURCHASE',
      },
    },
    creative: {
      name: creativePreviewName,
      object_story_spec: objectStorySpec,
    },
    ad: {
      name: payload.adName.trim(),
      status: 'PAUSED',
    },
  };
}

function validatePayload(payload: EcommerceCampaignBundlePayload): void {
  requireNonEmpty(payload.adAccountId, 'adAccountId');
  requireNonEmpty(payload.campaignName, 'campaignName');
  requireNonEmpty(payload.adSetName, 'adSetName');
  requireNonEmpty(payload.adName, 'adName');
  requireNonEmpty(payload.pageId, 'pageId');
  requireNonEmpty(payload.pixelId, 'pixelId');
  requireNonEmpty(payload.destinationUrl, 'destinationUrl');
  requireNonEmpty(payload.primaryText, 'primaryText');
  requireNonEmpty(payload.headline, 'headline');

  if (!Number.isFinite(payload.dailyBudget) || payload.dailyBudget <= 0) {
    throw new Error('dailyBudget must be a positive number in minor currency units');
  }

  if (!Array.isArray(payload.countries) || payload.countries.length === 0) {
    throw new Error('countries must include at least one ISO country code');
  }

  if (!payload.imageHash?.trim() && !payload.videoId?.trim() && !payload.imageFilePath?.trim() && !payload.videoFilePath?.trim()) {
    throw new Error('imageHash, videoId, imageFilePath, or videoFilePath is required for the launch creative');
  }

  try {
    const url = new URL(payload.destinationUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
  } catch {
    throw new Error('destinationUrl must be a valid absolute URL');
  }
}

function requireNonEmpty(value: string | undefined, field: string): void {
  if (!value?.trim()) throw new Error(`${field} is required`);
}

function requireCreatedId(response: MetaIdResponse, entity: string): string {
  if (!response.id || typeof response.id !== 'string') {
    throw new Error(`Meta did not return an id for created ${entity}`);
  }
  return response.id;
}
