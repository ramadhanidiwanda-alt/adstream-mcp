import type { MetaClient } from '../metaClient.js';
import { createAd } from './createAd.js';
import { createAdCreative } from './createAdCreative.js';
import { createAdSet } from './createAdSet.js';
import { createCampaign } from './createCampaign.js';
import { formatMetaWriteError } from '../utils/formatMetaWriteError.js';
import type { MetaCollaborativeAppSpec } from '../types.js';

export type CpasCatalogBundleStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
export type CpasCatalogDestinationMode = 'catalog_web' | 'app_omnichannel';
export type CpasCatalogCreativeFormat =
  | 'catalog'
  | 'catalog_single_image'
  | 'catalog_carousel'
  | 'catalog_video'
  | 'catalog_video_carousel'
  | 'collection';

export interface CpasCatalogCollectionSpec {
  instantExperienceId: string;
  coverImageHash?: string;
  coverVideoId?: string;
}

export interface CpasCatalogVideoSpec {
  videoId: string;
  instantExperienceId: string;
  retailerAppId: string;
  retailerItemIds?: string[];
  thumbnailImageHash?: string;
  thumbnailImageUrl?: string;
}

export interface CpasCatalogHybridVideoSpec {
  videoId: string;
  thumbnailUrl: string;
}

export interface CpasCatalogCampaignSettings {
  specialAdCategories?: string[];
  buyType?: 'AUCTION' | 'RESERVED';
  isAdSetBudgetSharingEnabled?: boolean;
}

export interface CpasCatalogAdSetSettings {
  bidStrategy?: string;
  bidAmount?: number;
  bidConstraints?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  attributionSpec?: Array<Record<string, unknown>>;
  customAudiences?: Array<{ id: string }>;
  excludedCustomAudiences?: Array<{ id: string }>;
  advantageAudience?: 0 | 1;
  facebookPositions?: string[];
  instagramPositions?: string[];
  threadsPositions?: string[];
  messengerPositions?: string[];
  devicePlatforms?: string[];
  dsaBeneficiary?: string;
  dsaPayor?: string;
  multiAdvertiserAds?: 0 | 1;
}

export interface CpasCatalogCreativeSettings {
  showMultipleImages?: boolean;
  preferredImageTags?: string[];
  formatOption?: string;
  categorizationCriteria?: string;
  urlTags?: string;
  optOutEnhancements?: string[];
}

export interface CpasCatalogCampaignBundlePayload {
  adAccountId: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  pageId: string;
  productSetId: string;
  pixelId?: string;
  /** Defaults to catalog_web, the catalog-only CPAS route verified from the active RTG ad set. */
  destinationMode?: CpasCatalogDestinationMode;
  /** Required only when destinationMode is app_omnichannel and the account has app-event permission. */
  collaborativeAppSpec?: MetaCollaborativeAppSpec;
  /** Required only when destinationMode is app_omnichannel. */
  objectStoreUrls?: string[];
  customEventType?: 'PURCHASE' | 'ADD_TO_CART' | 'INITIATED_CHECKOUT';
  dailyBudget: number;
  countries: string[];
  primaryText: string;
  headline: string;
  description?: string;
  creativeFormat?: CpasCatalogCreativeFormat;
  collection?: CpasCatalogCollectionSpec;
  video?: CpasCatalogVideoSpec;
  hybridVideo?: CpasCatalogHybridVideoSpec;
  destinationUrl: string;
  templateUrl?: string;
  fallbackImageHash?: string;
  callToAction?: 'SHOP_NOW' | 'LEARN_MORE';
  ageMin?: number;
  ageMax?: number;
  publisherPlatforms?: string[];
  instagramUserId?: string;
  threadsProfileId?: string;
  campaignSettings?: CpasCatalogCampaignSettings;
  adSetSettings?: CpasCatalogAdSetSettings;
  creativeSettings?: CpasCatalogCreativeSettings;
}

export interface CpasCatalogCampaignBundleOptions {
  dryRun?: boolean;
  confirmed?: boolean;
  maxRetries?: number;
}

export interface CpasCatalogCampaignBundlePreview {
  campaign: Record<string, unknown>;
  adSet: Record<string, unknown>;
  creative: Record<string, unknown>;
  ad: Record<string, unknown>;
}

export interface CpasCatalogCampaignBundleResult {
  operation: 'create_cpas_catalog_bundle';
  status: CpasCatalogBundleStatus;
  executed: boolean;
  preview: CpasCatalogCampaignBundlePreview;
  productSet?: { id: string; catalogId?: string; productCount: number };
  ids?: { campaignId?: string; adSetId?: string; creativeId?: string; adId?: string };
  stage?: 'preflight' | 'campaign' | 'adSet' | 'creative' | 'ad';
  error?: string;
  code?: string;
  warnings: string[];
}

interface ProductSetRead extends Record<string, unknown> {
  id?: string;
  product_catalog?: string | { id?: string };
  product_count?: number;
}

export function buildCpasCatalogBundlePreview(
  payload: CpasCatalogCampaignBundlePayload
): CpasCatalogCampaignBundlePreview {
  const productSetId = payload.productSetId.trim();
  const destinationUrl = payload.destinationUrl.trim();
  const appOmnichannel = payload.destinationMode === 'app_omnichannel';
  const creativeFormat = payload.creativeFormat ?? 'catalog';
  const collection = payload.collection;
  const video = payload.video;
  const campaignSettings = payload.campaignSettings;
  const adSetSettings = payload.adSetSettings;
  const creativeSettings = payload.creativeSettings;
  const catalogPresentation =
    creativeFormat === 'catalog_single_image'
      ? 'single_image'
      : creativeFormat === 'catalog_carousel'
        ? 'carousel'
        : creativeFormat === 'catalog_video_carousel'
          ? 'video_carousel'
          : undefined;
  return {
    campaign: {
      name: payload.campaignName.trim(),
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      special_ad_categories: [],
      ...(campaignSettings?.specialAdCategories
        ? { special_ad_categories: campaignSettings.specialAdCategories }
        : {}),
      ...(campaignSettings?.buyType ? { buying_type: campaignSettings.buyType } : {}),
      ...(campaignSettings?.isAdSetBudgetSharingEnabled !== undefined
        ? { is_adset_budget_sharing_enabled: campaignSettings.isAdSetBudgetSharingEnabled }
        : {}),
      daily_budget: payload.dailyBudget,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    },
    adSet: {
      name: payload.adSetName.trim(),
      status: 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      bid_strategy: adSetSettings?.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
      destination_type: 'UNDEFINED',
      ...(adSetSettings?.bidAmount !== undefined ? { bid_amount: adSetSettings.bidAmount } : {}),
      ...(adSetSettings?.bidConstraints ? { bid_constraints: adSetSettings.bidConstraints } : {}),
      ...(adSetSettings?.startTime ? { start_time: adSetSettings.startTime } : {}),
      ...(adSetSettings?.endTime ? { end_time: adSetSettings.endTime } : {}),
      ...(adSetSettings?.attributionSpec
        ? { attribution_spec: adSetSettings.attributionSpec }
        : {}),
      ...(adSetSettings?.dsaBeneficiary ? { dsa_beneficiary: adSetSettings.dsaBeneficiary } : {}),
      ...(adSetSettings?.dsaPayor ? { dsa_payor: adSetSettings.dsaPayor } : {}),
      ...(adSetSettings?.multiAdvertiserAds !== undefined
        ? { multi_advertiser_ads: adSetSettings.multiAdvertiserAds }
        : {}),
      targeting: buildCpasTargetingPreview(payload),
      promoted_object: {
        product_set_id: productSetId,
        ...(appOmnichannel
          ? {}
          : {
              custom_event_type: payload.customEventType ?? 'PURCHASE',
              variation: 'PRODUCT_SET_AND_OMNICHANNEL',
              smart_pse_enabled: false,
            }),
        ...(appOmnichannel
          ? {
              smart_pse_enabled: false,
              omnichannel_object: {
                app: [
                  {
                    application_id: payload.collaborativeAppSpec?.applicationId.trim(),
                    custom_event_type: payload.customEventType ?? 'PURCHASE',
                    object_store_urls: (payload.objectStoreUrls ?? [])
                      .map((url) => url.trim())
                      .filter(Boolean),
                  },
                ],
                ...(payload.pixelId?.trim()
                  ? {
                      pixel: [
                        {
                          pixel_id: payload.pixelId.trim(),
                          custom_event_type: payload.customEventType ?? 'PURCHASE',
                        },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
      },
    },
    creative:
      creativeFormat === 'collection'
        ? {
            name: payload.adName.trim() + ' Creative',
            object_story_spec: {
              page_id: payload.pageId.trim(),
              ...(payload.instagramUserId?.trim()
                ? { instagram_user_id: payload.instagramUserId.trim() }
                : {}),
              ...(payload.threadsProfileId?.trim()
                ? { threads_user_id: payload.threadsProfileId.trim() }
                : {}),
              link_data: {
                ...(collection?.coverImageHash?.trim()
                  ? { image_hash: collection.coverImageHash.trim() }
                  : {}),
                message: payload.primaryText.trim(),
                ...(payload.headline.trim() ? { name: payload.headline.trim() } : {}),
                ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
                link: `https://fb.com/canvas_doc/${collection?.instantExperienceId.trim() ?? ''}`,
                call_to_action: { type: payload.callToAction ?? 'SHOP_NOW' },
              },
            },
          }
        : creativeFormat === 'catalog_video'
          ? {
              name: payload.adName.trim() + ' Creative',
              template_url_spec: { config: { app_id: video?.retailerAppId.trim() ?? '' } },
              object_story_spec: {
                page_id: payload.pageId.trim(),
                ...(payload.instagramUserId?.trim()
                  ? { instagram_user_id: payload.instagramUserId.trim() }
                  : {}),
                ...(payload.threadsProfileId?.trim()
                  ? { threads_user_id: payload.threadsProfileId.trim() }
                  : {}),
                video_data: {
                  video_id: video?.videoId.trim() ?? '',
                  message: payload.primaryText.trim(),
                  ...(payload.headline.trim() ? { title: payload.headline.trim() } : {}),
                  ...(video?.thumbnailImageHash?.trim()
                    ? { image_hash: video.thumbnailImageHash.trim() }
                    : video?.thumbnailImageUrl?.trim()
                      ? { image_url: video.thumbnailImageUrl.trim() }
                      : {}),
                  call_to_action: {
                    type: payload.callToAction ?? 'SHOP_NOW',
                    value: {
                      link: `https://fb.com/canvas_doc/${video?.instantExperienceId.trim() ?? ''}`,
                    },
                  },
                  retailer_item_ids: video?.retailerItemIds
                    ?.map((id) => id.trim())
                    .filter(Boolean) ?? ['0', '0', '0', '0'],
                  post_click_configuration: {
                    post_click_item_headline: '{{product.name}}',
                    post_click_item_description: '{{product.current_price strip_zeros}}',
                  },
                },
              },
            }
          : {
              name: payload.adName.trim() + ' Creative',
              product_set_id: productSetId,
              ...(creativeSettings?.categorizationCriteria
                ? { categorization_criteria: creativeSettings.categorizationCriteria }
                : {}),
              ...(creativeSettings?.urlTags ? { url_tags: creativeSettings.urlTags } : {}),
              ...(creativeSettings?.optOutEnhancements?.length
                ? {
                    degrees_of_freedom_spec: {
                      creative_features_spec: Object.fromEntries(
                        creativeSettings.optOutEnhancements.map((feature) => [
                          feature,
                          { enroll_status: 'OPT_OUT' },
                        ])
                      ),
                    },
                  }
                : {}),
              object_story_spec: {
                page_id: payload.pageId.trim(),
                ...(payload.instagramUserId?.trim()
                  ? { instagram_user_id: payload.instagramUserId.trim() }
                  : {}),
                ...(payload.threadsProfileId?.trim()
                  ? { threads_user_id: payload.threadsProfileId.trim() }
                  : {}),
                template_data: {
                  message: payload.primaryText.trim(),
                  name: payload.headline.trim(),
                  ...(payload.description?.trim()
                    ? { description: payload.description.trim() }
                    : {}),
                  link: payload.templateUrl?.trim() || destinationUrl,
                  call_to_action: {
                    type: payload.callToAction ?? 'SHOP_NOW',
                    ...(appOmnichannel ? { value: { link: destinationUrl } } : {}),
                  },
                  ...(creativeSettings?.preferredImageTags?.length
                    ? { preferred_image_tags: creativeSettings.preferredImageTags }
                    : {}),
                  ...(creativeSettings?.formatOption
                    ? { format_option: creativeSettings.formatOption }
                    : {}),
                  ...(catalogPresentation === 'single_image'
                    ? {
                        multi_share_end_card: true,
                        show_multiple_images: false,
                        force_single_link: true,
                      }
                    : catalogPresentation === 'carousel'
                      ? { multi_share_end_card: false, show_multiple_images: false }
                      : catalogPresentation === 'video_carousel'
                        ? {
                            child_attachments: [
                              {
                                link: payload.templateUrl?.trim() || destinationUrl,
                                picture: payload.hybridVideo?.thumbnailUrl.trim() ?? '',
                                name: payload.headline.trim(),
                                call_to_action: { type: payload.callToAction ?? 'SHOP_NOW' },
                                video_id: payload.hybridVideo?.videoId.trim() ?? '',
                                static_card: true,
                              },
                              {
                                link: payload.templateUrl?.trim() || destinationUrl,
                                name: '{{product.name}}',
                                call_to_action: { type: payload.callToAction ?? 'SHOP_NOW' },
                              },
                            ],
                            multi_share_end_card: false,
                            show_multiple_images: false,
                          }
                        : {}),
                  ...(creativeSettings?.showMultipleImages
                    ? {
                        show_multiple_images: true,
                        multi_share_end_card: false,
                        force_single_link: false,
                      }
                    : {}),
                },
              },
              ...(catalogPresentation === 'carousel' || catalogPresentation === 'video_carousel'
                ? {
                    asset_feed_spec: {
                      bodies: [{ text: payload.primaryText.trim() }],
                      ad_formats: ['CAROUSEL', 'COLLECTION'],
                      optimization_type: 'FORMAT_AUTOMATION',
                    },
                  }
                : {}),
            },
    ad: { name: payload.adName.trim(), status: 'PAUSED' },
  };
}

function buildCpasTargetingPreview(
  payload: CpasCatalogCampaignBundlePayload
): Record<string, unknown> {
  const settings = payload.adSetSettings;
  return {
    geo_locations: { countries: payload.countries },
    age_min: payload.ageMin ?? 18,
    ...(payload.ageMax ? { age_max: payload.ageMax } : {}),
    ...(payload.publisherPlatforms ? { publisher_platforms: payload.publisherPlatforms } : {}),
    ...(settings?.customAudiences ? { custom_audiences: settings.customAudiences } : {}),
    ...(settings?.excludedCustomAudiences
      ? { excluded_custom_audiences: settings.excludedCustomAudiences }
      : {}),
    ...(settings?.facebookPositions ? { facebook_positions: settings.facebookPositions } : {}),
    ...(settings?.instagramPositions ? { instagram_positions: settings.instagramPositions } : {}),
    ...(settings?.threadsPositions ? { threads_positions: settings.threadsPositions } : {}),
    ...(settings?.messengerPositions ? { messenger_positions: settings.messengerPositions } : {}),
    ...(settings?.devicePlatforms ? { device_platforms: settings.devicePlatforms } : {}),
    targeting_automation: { advantage_audience: settings?.advantageAudience ?? 0 },
  };
}

export async function createCpasCatalogCampaignBundle(
  client: MetaClient,
  payload: CpasCatalogCampaignBundlePayload,
  options: CpasCatalogCampaignBundleOptions = {}
): Promise<CpasCatalogCampaignBundleResult> {
  const preview = buildCpasCatalogBundlePreview(payload);
  const base = (): CpasCatalogCampaignBundleResult => ({
    operation: 'create_cpas_catalog_bundle',
    status: 'dry_run',
    executed: false,
    preview,
    warnings: [
      'Semua objek dibuat PAUSED; aktivasi delivery memerlukan operasi dan konfirmasi terpisah.',
      'Creative ini adalah katalog dinamis. Jangan mencampurnya dengan creative poster/video/carousel manual pada ad set yang sama.',
    ],
  });
  const failure = (
    stage: NonNullable<CpasCatalogCampaignBundleResult['stage']>,
    code: string,
    error: string,
    ids?: CpasCatalogCampaignBundleResult['ids']
  ): CpasCatalogCampaignBundleResult => ({
    ...base(),
    status: 'failed',
    stage,
    code,
    error,
    ...(ids ? { ids } : {}),
  });

  const required = [
    ['campaignName', payload.campaignName],
    ['adSetName', payload.adSetName],
    ['adName', payload.adName],
    ['pageId', payload.pageId],
    ['productSetId', payload.productSetId],
    ['primaryText', payload.primaryText],
    ['headline', payload.headline],
    ['destinationUrl', payload.destinationUrl],
  ];
  const missing = required.find(([, value]) => !value.trim());
  if (missing) {
    return failure(
      'preflight',
      'MISSING_REQUIRED_CPAS_CATALOG_FIELD',
      missing[0] + ' wajib diisi.'
    );
  }
  if (!Number.isFinite(payload.dailyBudget) || payload.dailyBudget <= 0) {
    return failure('preflight', 'INVALID_CPAS_CATALOG_BUDGET', 'dailyBudget harus lebih dari 0.');
  }
  if (payload.countries.length === 0 || payload.countries.some((country) => !country.trim())) {
    return failure(
      'preflight',
      'INVALID_CPAS_CATALOG_COUNTRIES',
      'countries harus berisi minimal satu negara.'
    );
  }
  const creativeFormat = payload.creativeFormat ?? 'catalog';
  if (creativeFormat === 'collection') {
    const collection = payload.collection;
    if (!collection?.instantExperienceId.trim()) {
      return failure(
        'preflight',
        'MISSING_CPAS_COLLECTION_INSTANT_EXPERIENCE',
        'Collection memerlukan instantExperienceId.'
      );
    }
    if (Boolean(collection.coverImageHash?.trim()) === Boolean(collection.coverVideoId?.trim())) {
      return failure(
        'preflight',
        'INVALID_CPAS_COLLECTION_COVER',
        'Collection memerlukan tepat satu coverImageHash atau coverVideoId.'
      );
    }
  }
  if (creativeFormat === 'catalog_video') {
    const video = payload.video;
    if (
      !video?.videoId.trim() ||
      !video.instantExperienceId.trim() ||
      !video.retailerAppId.trim()
    ) {
      return failure(
        'preflight',
        'MISSING_CPAS_CATALOG_VIDEO_FIELD',
        'Catalog video memerlukan videoId, instantExperienceId, dan retailerAppId.'
      );
    }
    if (video.retailerItemIds?.some((id) => !id.trim())) {
      return failure(
        'preflight',
        'INVALID_CPAS_CATALOG_VIDEO_ITEMS',
        'retailerItemIds tidak boleh kosong.'
      );
    }
  }
  if (creativeFormat === 'catalog_video_carousel') {
    const hybridVideo = payload.hybridVideo;
    if (!hybridVideo?.videoId.trim() || !hybridVideo.thumbnailUrl.trim()) {
      return failure(
        'preflight',
        'MISSING_CPAS_CATALOG_HYBRID_VIDEO_FIELD',
        'Catalog video-carousel memerlukan hybridVideo.videoId dan hybridVideo.thumbnailUrl.'
      );
    }
  }
  if (
    payload.creativeSettings?.showMultipleImages === true &&
    payload.creativeSettings.formatOption
  ) {
    return failure(
      'preflight',
      'INVALID_CPAS_CATALOG_CREATIVE_SETTINGS',
      'showMultipleImages dan formatOption tidak dapat digunakan bersamaan pada catalog creative.'
    );
  }
  const appOmnichannel = payload.destinationMode === 'app_omnichannel';
  if (
    appOmnichannel &&
    (!payload.collaborativeAppSpec?.applicationId.trim() ||
      (payload.objectStoreUrls ?? []).length === 0 ||
      (payload.objectStoreUrls ?? []).some((url) => !url.trim()))
  ) {
    return failure(
      'preflight',
      'MISSING_CPAS_OMNICHANNEL_APP',
      'Mode app_omnichannel memerlukan collaborativeAppSpec dan objectStoreUrls.'
    );
  }

  let productSet: ProductSetRead;
  try {
    productSet = await client.metaGetObject<ProductSetRead>(
      '/' + payload.productSetId.trim(),
      { fields: 'id,name,product_catalog,product_count' },
      options.maxRetries
    );
  } catch (error) {
    return failure('preflight', 'UNREADABLE_CPAS_PRODUCT_SET', formatMetaWriteError(error));
  }
  if (productSet.id?.trim() !== payload.productSetId.trim()) {
    return failure(
      'preflight',
      'UNREADABLE_CPAS_PRODUCT_SET',
      'Product set CPAS tidak dapat diverifikasi.'
    );
  }
  if (!Number.isFinite(productSet.product_count) || Number(productSet.product_count) <= 0) {
    return failure(
      'preflight',
      'EMPTY_CPAS_PRODUCT_SET',
      'Product set CPAS tidak memiliki produk yang siap diiklankan.'
    );
  }

  const productCatalogId =
    typeof productSet.product_catalog === 'string'
      ? productSet.product_catalog
      : productSet.product_catalog?.id;
  if (productCatalogId?.trim()) {
    preview.campaign.promoted_object = {
      product_catalog_id: productCatalogId.trim(),
      smart_pse_enabled: false,
    };
  }
  const productSetEvidence = {
    id: productSet.id,
    ...(productCatalogId?.trim() ? { catalogId: productCatalogId.trim() } : {}),
    productCount: Number(productSet.product_count),
  };
  const withEvidence = (
    result: CpasCatalogCampaignBundleResult
  ): CpasCatalogCampaignBundleResult => ({
    ...result,
    productSet: productSetEvidence,
  });
  if (options.dryRun !== false) return withEvidence(base());
  if (!options.confirmed) {
    return withEvidence({
      ...base(),
      status: 'pending_confirmation',
      error: 'Konfirmasi eksplisit diperlukan setelah dry-run.',
    });
  }

  const ids: NonNullable<CpasCatalogCampaignBundleResult['ids']> = {};
  const failedAfterCreate = (
    stage: NonNullable<CpasCatalogCampaignBundleResult['stage']>,
    error: string
  ) => withEvidence(failure(stage, 'CPAS_CATALOG_CREATE_FAILED', error, ids));

  const campaign = await createCampaign(
    client,
    {
      adAccountId: payload.adAccountId,
      name: payload.campaignName,
      objective: 'OUTCOME_SALES',
      mode: 'collaborative_ads',
      status: 'PAUSED',
      specialAdCategories: payload.campaignSettings?.specialAdCategories,
      buyType: payload.campaignSettings?.buyType,
      isAdSetBudgetSharingEnabled: payload.campaignSettings?.isAdSetBudgetSharingEnabled,
      dailyBudget: payload.dailyBudget,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      ...(productCatalogId?.trim()
        ? {
            promotedObject: {
              product_catalog_id: productCatalogId.trim(),
              smart_pse_enabled: false,
            },
          }
        : {}),
    },
    { dryRun: false, confirmed: true, maxRetries: options.maxRetries }
  );
  if (!campaign.id)
    return failedAfterCreate('campaign', campaign.error ?? 'Campaign CPAS gagal dibuat.');
  ids.campaignId = campaign.id;

  const adSet = await createAdSet(
    client,
    {
      adAccountId: payload.adAccountId,
      campaignId: campaign.id,
      name: payload.adSetName,
      mode: 'collaborative_ads',
      status: 'PAUSED',
      conversionLocation: 'CATALOG',
      destinationType: 'UNDEFINED',
      billingEvent: 'IMPRESSIONS',
      optimizationGoal: 'OFFSITE_CONVERSIONS',
      bidStrategy: payload.adSetSettings?.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
      bidAmount: payload.adSetSettings?.bidAmount,
      bidConstraints: payload.adSetSettings?.bidConstraints,
      startTime: payload.adSetSettings?.startTime,
      endTime: payload.adSetSettings?.endTime,
      attributionSpec: payload.adSetSettings?.attributionSpec,
      dsaBeneficiary: payload.adSetSettings?.dsaBeneficiary,
      dsaPayor: payload.adSetSettings?.dsaPayor,
      multiAdvertiserAds: payload.adSetSettings?.multiAdvertiserAds,
      productSetId: payload.productSetId,
      collaborativeCatalog: {
        productSetId: payload.productSetId,
        ...(appOmnichannel
          ? {
              pixelId: payload.pixelId,
              customEventType: payload.customEventType ?? 'PURCHASE',
              applicationId: payload.collaborativeAppSpec?.applicationId,
              objectStoreUrls: payload.objectStoreUrls,
            }
          : {
              customEventType: payload.customEventType ?? 'PURCHASE',
              variation: 'PRODUCT_SET_AND_OMNICHANNEL',
              smartPseEnabled: false,
            }),
      },
      targeting: {
        geoLocations: { countries: payload.countries },
        ageMin: payload.ageMin ?? 18,
        ...(payload.ageMax ? { ageMax: payload.ageMax } : {}),
        ...(payload.publisherPlatforms ? { publisherPlatforms: payload.publisherPlatforms } : {}),
        ...(payload.adSetSettings?.customAudiences
          ? { customAudiences: payload.adSetSettings.customAudiences }
          : {}),
        ...(payload.adSetSettings?.excludedCustomAudiences
          ? { excludedCustomAudiences: payload.adSetSettings.excludedCustomAudiences }
          : {}),
        ...(payload.adSetSettings?.facebookPositions
          ? { facebookPositions: payload.adSetSettings.facebookPositions }
          : {}),
        ...(payload.adSetSettings?.instagramPositions
          ? { instagramPositions: payload.adSetSettings.instagramPositions }
          : {}),
        ...(payload.adSetSettings?.threadsPositions
          ? { threadsPositions: payload.adSetSettings.threadsPositions }
          : {}),
        ...(payload.adSetSettings?.messengerPositions
          ? { messengerPositions: payload.adSetSettings.messengerPositions }
          : {}),
        ...(payload.adSetSettings?.devicePlatforms
          ? { devicePlatforms: payload.adSetSettings.devicePlatforms }
          : {}),
        targetingAutomation: {
          advantage_audience: payload.adSetSettings?.advantageAudience ?? 0,
        },
      },
    },
    { dryRun: false, confirmed: true, maxRetries: options.maxRetries }
  );
  if (!adSet.id) return failedAfterCreate('adSet', adSet.error ?? 'Ad set CPAS gagal dibuat.');
  ids.adSetId = adSet.id;

  const creative = await createAdCreative(
    client,
    {
      adAccountId: payload.adAccountId,
      name: payload.adName + ' Creative',
      pageId: payload.pageId,
      mode: 'collaborative_ads',
      objective: 'OUTCOME_SALES',
      conversionLocation: 'CATALOG',
      collaborativeProductSetId: payload.productSetId,
      catalogOnly: !appOmnichannel,
      urlTags: payload.creativeSettings?.urlTags,
      optOutEnhancements: payload.creativeSettings?.optOutEnhancements,
      ...(appOmnichannel ? { collaborativeAppSpec: payload.collaborativeAppSpec } : {}),
      creative:
        creativeFormat === 'collection'
          ? {
              creativeFormat: 'collection',
              creativeSpec: {
                instantExperienceId: payload.collection?.instantExperienceId ?? '',
                coverImageHash: payload.collection?.coverImageHash,
                coverVideoId: payload.collection?.coverVideoId,
                primaryText: payload.primaryText,
                headline: payload.headline,
                description: payload.description,
                destinationUrl: `https://fb.com/canvas_doc/${payload.collection?.instantExperienceId ?? ''}`,
                callToAction: payload.callToAction ?? 'SHOP_NOW',
              },
            }
          : creativeFormat === 'catalog_video'
            ? {
                creativeFormat: 'video',
                creativeSpec: {
                  videoId: payload.video?.videoId ?? '',
                  primaryText: payload.primaryText,
                  headline: payload.headline,
                  destinationUrl: `https://fb.com/canvas_doc/${payload.video?.instantExperienceId ?? ''}`,
                  thumbnailImageHash: payload.video?.thumbnailImageHash,
                  thumbnailImageUrl: payload.video?.thumbnailImageUrl,
                  callToAction: payload.callToAction ?? 'SHOP_NOW',
                  retailerItemIds: payload.video?.retailerItemIds ?? ['0', '0', '0', '0'],
                  postClickConfiguration: {
                    itemHeadline: '{{product.name}}',
                    itemDescription: '{{product.current_price strip_zeros}}',
                  },
                  templateUrlSpec: { applicationId: payload.video?.retailerAppId ?? '' },
                },
              }
            : {
                creativeFormat: 'catalog',
                creativeSpec: {
                  productSetId: payload.productSetId,
                  primaryText: payload.primaryText,
                  headline: payload.headline,
                  description: payload.description,
                  destinationUrl: payload.destinationUrl,
                  templateUrl: payload.templateUrl,
                  fallbackImageHash: payload.fallbackImageHash,
                  callToAction: payload.callToAction ?? 'SHOP_NOW',
                  showMultipleImages: payload.creativeSettings?.showMultipleImages,
                  preferredImageTags: payload.creativeSettings?.preferredImageTags,
                  formatOption: payload.creativeSettings?.formatOption,
                  categorizationCriteria: payload.creativeSettings?.categorizationCriteria,
                  ...(creativeFormat === 'catalog_single_image'
                    ? { presentation: 'single_image' as const }
                    : creativeFormat === 'catalog_carousel'
                      ? { presentation: 'carousel' as const }
                      : creativeFormat === 'catalog_video_carousel'
                        ? {
                            presentation: 'video_carousel' as const,
                            hybridVideo: {
                              videoId: payload.hybridVideo?.videoId ?? '',
                              thumbnailUrl: payload.hybridVideo?.thumbnailUrl ?? '',
                            },
                          }
                        : {}),
                },
              },
      instagramUserId: payload.instagramUserId,
      threadsProfileId: payload.threadsProfileId,
    },
    { dryRun: false, confirmed: true, maxRetries: options.maxRetries }
  );
  if (!creative.id)
    return failedAfterCreate('creative', creative.error ?? 'Creative katalog gagal dibuat.');
  ids.creativeId = creative.id;

  const ad = await createAd(
    client,
    {
      adAccountId: payload.adAccountId,
      name: payload.adName,
      adSetId: adSet.id,
      creativeId: creative.id,
      status: 'PAUSED',
    },
    { dryRun: false, confirmed: true, maxRetries: options.maxRetries }
  );
  if (!ad.id) return failedAfterCreate('ad', ad.error ?? 'Ad katalog gagal dibuat.');
  ids.adId = ad.id;

  return withEvidence({ ...base(), status: 'executed', executed: true, ids });
}
