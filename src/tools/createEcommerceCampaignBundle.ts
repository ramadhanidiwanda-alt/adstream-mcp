import type { MetaClient } from '../metaClient.js';
import { uploadImage } from './uploadImage.js';
import { uploadVideo } from './uploadVideo.js';
import { createCampaign } from './createCampaign.js';
import { createAdSet } from './createAdSet.js';
import { createAdCreative } from './createAdCreative.js';
import { createAd } from './createAd.js';
import { formatMetaWriteError } from '../utils/formatMetaWriteError.js';

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
  threadsProfileId?: string;
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
  summary: {
    goal: string;
    budget: string;
    destination: string;
    audience: string;
    creative: string;
    statusAfterCreate: string;
    needsReview: boolean;
  };
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

/**
 * Create a complete ecommerce campaign bundle (campaign + ad set + creative + ad).
 *
 * Refactored to use the new standalone create tools for each entity.
 * Dry-run by default — set dryRun=false + confirmed=true to execute.
 */
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
    summary: buildHumanSummary(payload),
    preview,
    warnings: [
      'All entities are created as PAUSED by default; review in Meta Ads Manager before publishing.',
      'This ecommerce MVP optimizes for the PURCHASE pixel event using OUTCOME_SALES.',
      ...(payload.imageFilePath?.trim()
        ? [
            `Will upload image file: ${payload.imageFilePath.trim().split('/').pop() || payload.imageFilePath.trim()}`,
          ]
        : []),
      ...(payload.videoFilePath?.trim()
        ? [
            `Will upload video file: ${payload.videoFilePath.trim().split('/').pop() || payload.videoFilePath.trim()}`,
          ]
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

  const ids: NonNullable<EcommerceCampaignBundleResult['ids']> = {};
  const failedResult = (error: unknown): EcommerceCampaignBundleResult => ({
    ...baseResult,
    status: 'failed',
    ...(Object.keys(ids).length > 0 ? { ids: { ...ids } } : {}),
    error: formatMetaWriteError(error),
  });

  try {
    // Step 1: Create campaign (PAUSED, OUTCOME_SALES)
    const campaignResult = await createCampaign(
      client,
      {
        adAccountId: payload.adAccountId,
        name: payload.campaignName.trim(),
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        specialAdCategories: payload.specialAdCategories,
        dailyBudget: payload.dailyBudget,
        bidStrategy: payload.bidStrategy,
      },
      { dryRun: false, confirmed: true, maxRetries }
    );

    if (campaignResult.status === 'failed' || !campaignResult.id) {
      return failedResult(`Campaign creation failed: ${campaignResult.error}`);
    }
    const campaignId = campaignResult.id;
    ids.campaignId = campaignId;

    // Step 2: Create ad set
    const adSetResult = await createAdSet(
      client,
      {
        adAccountId: payload.adAccountId,
        campaignId,
        name: payload.adSetName.trim(),
        status: 'PAUSED',
        billingEvent: payload.billingEvent ?? 'IMPRESSIONS',
        optimizationGoal: payload.optimizationGoal ?? 'OFFSITE_CONVERSIONS',
        bidStrategy: payload.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
        targeting: {
          geoLocations: { countries: payload.countries },
          ageMin: payload.ageMin ?? 18,
          ...(payload.ageMax ? { ageMax: payload.ageMax } : {}),
          ...(payload.publisherPlatforms ? { publisherPlatforms: payload.publisherPlatforms } : {}),
        },
        promotedObject: {
          pixel_id: payload.pixelId.trim(),
          custom_event_type: payload.customEventType ?? 'PURCHASE',
        },
      },
      { dryRun: false, confirmed: true, maxRetries }
    );

    if (adSetResult.status === 'failed' || !adSetResult.id) {
      return failedResult(`Ad set creation failed: ${adSetResult.error}`);
    }
    const adSetId = adSetResult.id;
    ids.adSetId = adSetId;

    // Step 3: Upload image if filePath provided
    let imageHash = payload.imageHash?.trim();
    if (payload.imageFilePath?.trim() && !imageHash) {
      const uploadResult = await uploadImage(client, {
        adAccountId: payload.adAccountId,
        filePath: payload.imageFilePath.trim(),
        maxRetries,
      });
      if (uploadResult.status === 'failed' || !uploadResult.image_hash) {
        return failedResult(`Image upload failed: ${uploadResult.error ?? 'unknown error'}`);
      }
      imageHash = uploadResult.image_hash;
    } else if (payload.videoFilePath?.trim() && !payload.videoId?.trim()) {
      const uploadResult = await uploadVideo(client, {
        adAccountId: payload.adAccountId,
        filePath: payload.videoFilePath.trim(),
        maxRetries,
      });
      if (uploadResult.status === 'failed' || !uploadResult.video_id) {
        return failedResult(`Video upload failed: ${uploadResult.error ?? 'unknown error'}`);
      }
    }

    // Step 4: Create creative
    const creativeResult = await createAdCreative(
      client,
      {
        adAccountId: payload.adAccountId,
        name: `${payload.adName.trim()} Creative`,
        pageId: payload.pageId.trim(),
        linkData: {
          link: payload.destinationUrl.trim(),
          message: payload.primaryText.trim(),
          name: payload.headline.trim(),
          description: payload.description?.trim(),
          imageHash,
          callToAction: {
            type: payload.callToActionType ?? 'SHOP_NOW',
            value: { link: payload.destinationUrl.trim() },
          },
        },
        instagramUserId: payload.instagramUserId?.trim(),
        threadsProfileId: payload.threadsProfileId?.trim(),
      },
      { dryRun: false, confirmed: true, maxRetries }
    );

    if (creativeResult.status === 'failed' || !creativeResult.id) {
      return failedResult(`Creative creation failed: ${creativeResult.error}`);
    }
    const creativeId = creativeResult.id;
    ids.creativeId = creativeId;

    // Step 5: Create ad
    const adResult = await createAd(
      client,
      {
        adAccountId: payload.adAccountId,
        name: payload.adName.trim(),
        adSetId,
        creativeId,
        status: 'PAUSED',
      },
      { dryRun: false, confirmed: true, maxRetries }
    );

    if (adResult.status === 'failed' || !adResult.id) {
      return failedResult(`Ad creation failed: ${adResult.error}`);
    }
    const adId = adResult.id;
    ids.adId = adId;

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      ids,
      responses: {
        campaign: campaignResult.response,
        adSet: adSetResult.response,
        creative: creativeResult.response,
        ad: adResult.response,
      },
    };
  } catch (error) {
    return failedResult(error);
  }
}

function buildHumanSummary(
  payload: EcommerceCampaignBundlePayload
): NonNullable<EcommerceCampaignBundleResult['summary']> {
  const currency = payload.currency?.trim() || 'account currency';
  const creative = payload.imageFilePath?.trim()
    ? `Image file: ${payload.imageFilePath.trim().split('/').pop() || payload.imageFilePath.trim()}`
    : payload.videoFilePath?.trim()
      ? `Video file: ${payload.videoFilePath.trim().split('/').pop() || payload.videoFilePath.trim()}`
      : payload.imageHash?.trim()
        ? 'Existing Meta image hash'
        : payload.videoId?.trim()
          ? 'Existing Meta video'
          : 'Creative asset belum dipilih';

  return {
    goal: 'Sales ke website',
    budget: `${currency} ${payload.dailyBudget}/hari`,
    destination: payload.destinationUrl.trim(),
    audience: payload.countries.join(', '),
    creative,
    statusAfterCreate: 'PAUSED',
    needsReview: true,
  };
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
  if (payload.threadsProfileId?.trim()) {
    objectStorySpec.threads_profile_id = payload.threadsProfileId.trim();
  }

  return {
    campaign: {
      name: payload.campaignName.trim(),
      objective: 'OUTCOME_SALES',
      buying_type: 'AUCTION',
      status: 'PAUSED',
      special_ad_categories: payload.specialAdCategories ?? [],
      daily_budget: payload.dailyBudget,
    },
    adSet: {
      name: payload.adSetName.trim(),
      status: 'PAUSED',
      billing_event: payload.billingEvent ?? 'IMPRESSIONS',
      optimization_goal: payload.optimizationGoal ?? 'OFFSITE_CONVERSIONS',
      bid_strategy: payload.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
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

  if (
    !payload.imageHash?.trim() &&
    !payload.videoId?.trim() &&
    !payload.imageFilePath?.trim() &&
    !payload.videoFilePath?.trim()
  ) {
    throw new Error(
      'imageHash, videoId, imageFilePath, or videoFilePath is required for the launch creative'
    );
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
