import type { MetaClient } from '../metaClient.js';
import { createAd } from './createAd.js';
import { createAdCreative } from './createAdCreative.js';
import { createAdSet } from './createAdSet.js';
import { createCampaign } from './createCampaign.js';
import { formatMetaWriteError } from '../utils/formatMetaWriteError.js';
import type { MetaCollaborativeAppSpec } from '../types.js';
import { assertSupportedCatalogCreativeSettings } from '../providers/meta/buildCreativeFormatPayload.js';

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
  resumeFrom?: {
    campaignId: string;
    adSetId?: string;
    creativeId?: string;
    adId?: string;
  };
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
  resumeFrom?: { campaignId?: string; adSetId?: string; creativeId?: string; adId?: string };
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
                  link: destinationUrl,
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
                                link: destinationUrl,
                                picture: payload.hybridVideo?.thumbnailUrl.trim() ?? '',
                                name: payload.headline.trim(),
                                call_to_action: { type: payload.callToAction ?? 'SHOP_NOW' },
                                video_id: payload.hybridVideo?.videoId.trim() ?? '',
                                static_card: true,
                              },
                              {
                                link: destinationUrl,
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
      ...(payload.creativeSettings?.categorizationCriteria
        ? [
            'Kelayakan kategori produk ditentukan Meta saat creative dibuat; product_count saja tidak menjamin kategori memenuhi syarat.',
          ]
        : []),
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
    ...(ids && Object.keys(ids).length > 0 ? { resumeFrom: { ...ids } } : {}),
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
  const resumeFrom = payload.resumeFrom;
  if (
    (resumeFrom && !resumeFrom.campaignId?.trim()) ||
    (resumeFrom && Object.values(resumeFrom).some((id) => typeof id !== 'string' || !id.trim())) ||
    (resumeFrom?.adSetId && !resumeFrom.campaignId) ||
    (resumeFrom?.creativeId && !resumeFrom.adSetId) ||
    (resumeFrom?.adId && !resumeFrom.creativeId)
  ) {
    return failure(
      'preflight',
      'INVALID_CPAS_CATALOG_RESUME_CHAIN',
      'resumeFrom harus berurutan: campaignId, adSetId, creativeId, lalu adId.'
    );
  }
  if (
    resumeFrom &&
    (Object.keys(payload.campaignSettings ?? {}).length > 0 ||
      Object.keys(payload.adSetSettings ?? {}).length > 0 ||
      Object.keys(payload.creativeSettings ?? {}).length > 0 ||
      payload.destinationMode === 'app_omnichannel' ||
      (payload.ageMin !== undefined && payload.ageMin !== 18) ||
      payload.ageMax !== undefined ||
      payload.publisherPlatforms !== undefined ||
      (payload.customEventType !== undefined && payload.customEventType !== 'PURCHASE') ||
      (payload.callToAction !== undefined && payload.callToAction !== 'SHOP_NOW') ||
      payload.description !== undefined ||
      payload.instagramUserId !== undefined ||
      payload.threadsProfileId !== undefined)
  ) {
    return failure(
      'preflight',
      'UNVERIFIABLE_CPAS_CATALOG_RESUME_SETTINGS',
      'resumeFrom hanya didukung untuk konfigurasi CPAS dasar yang dapat diverifikasi melalui readback. Pengaturan lanjutan memerlukan pembuatan baru atau verifikasi manual.'
    );
  }
  if (payload.countries.length === 0 || payload.countries.some((country) => !country.trim())) {
    return failure(
      'preflight',
      'INVALID_CPAS_CATALOG_COUNTRIES',
      'countries harus berisi minimal satu negara.'
    );
  }
  const creativeFormat = payload.creativeFormat ?? 'catalog';
  if (
    creativeFormat.startsWith('catalog') &&
    creativeFormat !== 'catalog_video' &&
    payload.fallbackImageHash?.trim()
  ) {
    return failure(
      'preflight',
      'UNSUPPORTED_CPAS_CATALOG_FALLBACK_IMAGE',
      'Catalog dinamis mengambil gambar dari produk; fallbackImageHash manual ditolak Meta (subcode 2446380).'
    );
  }
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
  try {
    assertSupportedCatalogCreativeSettings(payload.creativeSettings ?? {});
  } catch (error) {
    return failure(
      'preflight',
      'INVALID_CPAS_CATALOG_CREATIVE_SETTINGS',
      error instanceof Error ? error.message : 'Pengaturan creative katalog tidak valid.'
    );
  }
  const appOmnichannel = payload.destinationMode === 'app_omnichannel';
  if (
    appOmnichannel &&
    !(
      (payload.collaborativeAppSpec?.android?.appName.trim() &&
        payload.collaborativeAppSpec.android.packageName.trim()) ||
      (payload.collaborativeAppSpec?.ios?.appName.trim() &&
        payload.collaborativeAppSpec.ios.appStoreId.trim())
    )
  ) {
    return failure(
      'preflight',
      'MISSING_CPAS_OMNICHANNEL_PLATFORM',
      'Mode app_omnichannel memerlukan platform_specs Android atau iOS pada collaborativeAppSpec.'
    );
  }
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

  if (resumeFrom?.campaignId) {
    const expectedAccountId = payload.adAccountId.trim().replace(/^act_/, '');
    const readResumeObject = async (id: string, fields: string): Promise<Record<string, unknown>> =>
      client.metaGetObject<Record<string, unknown>>(`/${id}`, { fields }, options.maxRetries);
    const objectId = (value: unknown): string | undefined => {
      if (typeof value === 'string') return value.trim();
      if (value && typeof value === 'object' && 'id' in value) {
        const id = (value as { id?: unknown }).id;
        return typeof id === 'string' ? id.trim() : undefined;
      }
      return undefined;
    };
    const unsafe = (reason: string): CpasCatalogCampaignBundleResult =>
      withEvidence(failure('preflight', 'UNSAFE_CPAS_CATALOG_RESUME', reason));
    try {
      const campaign = await readResumeObject(
        resumeFrom.campaignId,
        'id,account_id,name,status,objective,daily_budget,bid_strategy,promoted_object'
      );
      const campaignCatalogId =
        campaign.promoted_object && typeof campaign.promoted_object === 'object'
          ? objectId((campaign.promoted_object as Record<string, unknown>).product_catalog_id)
          : undefined;
      if (
        campaign.id !== resumeFrom.campaignId ||
        objectId(campaign.account_id) !== expectedAccountId ||
        campaign.name !== payload.campaignName.trim() ||
        campaign.status !== 'PAUSED' ||
        campaign.objective !== 'OUTCOME_SALES' ||
        Number(campaign.daily_budget) !== payload.dailyBudget ||
        campaign.bid_strategy !== 'LOWEST_COST_WITHOUT_CAP' ||
        !productCatalogId ||
        campaignCatalogId !== productCatalogId
      )
        return unsafe(
          'Campaign resume tidak cocok dengan akun, nama, status PAUSED, budget, bid strategy, objective, atau katalog.'
        );

      if (resumeFrom.adSetId) {
        const adSet = await readResumeObject(
          resumeFrom.adSetId,
          'id,account_id,name,campaign_id,status,destination_type,optimization_goal,billing_event,bid_strategy,targeting,promoted_object'
        );
        const adSetProductId =
          adSet.promoted_object && typeof adSet.promoted_object === 'object'
            ? objectId((adSet.promoted_object as Record<string, unknown>).product_set_id)
            : undefined;
        const targeting = adSet.targeting as Record<string, unknown> | undefined;
        const geoLocations = targeting?.geo_locations as Record<string, unknown> | undefined;
        const targetingAutomation = targeting?.targeting_automation as
          | Record<string, unknown>
          | undefined;
        const actualCountries = geoLocations?.countries;
        const expectedCountries = payload.countries.map((country) => country.trim()).sort();
        const unexpectedTargeting =
          Object.keys(targeting ?? {}).some(
            (key) => !['geo_locations', 'age_min', 'age_max', 'targeting_automation'].includes(key)
          ) ||
          Object.keys(geoLocations ?? {}).some((key) => key !== 'countries') ||
          Object.keys(targetingAutomation ?? {}).some((key) => key !== 'advantage_audience') ||
          (targetingAutomation?.advantage_audience !== undefined &&
            targetingAutomation.advantage_audience !== 0) ||
          (targeting?.age_max !== undefined && targeting.age_max !== 65);
        if (
          adSet.id !== resumeFrom.adSetId ||
          objectId(adSet.account_id) !== expectedAccountId ||
          adSet.name !== payload.adSetName.trim() ||
          objectId(adSet.campaign_id) !== resumeFrom.campaignId ||
          adSet.status !== 'PAUSED' ||
          adSet.destination_type !== 'UNDEFINED' ||
          adSet.optimization_goal !== 'OFFSITE_CONVERSIONS' ||
          adSet.billing_event !== 'IMPRESSIONS' ||
          adSet.bid_strategy !== 'LOWEST_COST_WITHOUT_CAP' ||
          targeting?.age_min !== (payload.ageMin ?? 18) ||
          unexpectedTargeting ||
          !Array.isArray(actualCountries) ||
          actualCountries.length !== expectedCountries.length ||
          actualCountries.some((country) => typeof country !== 'string') ||
          (Array.isArray(actualCountries) &&
            (actualCountries as string[])
              .slice()
              .sort()
              .some((country, index) => country !== expectedCountries[index])) ||
          adSetProductId !== payload.productSetId.trim()
        )
          return unsafe(
            'Ad set resume tidak cocok dengan akun, nama, campaign, status PAUSED, delivery, negara, atau product set.'
          );
      }

      if (resumeFrom.creativeId) {
        const creative = await readResumeObject(
          resumeFrom.creativeId,
          'id,account_id,product_set_id,categorization_criteria,asset_feed_spec,object_story_spec,template_url_spec'
        );
        const story = creative.object_story_spec as Record<string, unknown> | undefined;
        const videoData = story?.video_data as Record<string, unknown> | undefined;
        const linkData = story?.link_data as Record<string, unknown> | undefined;
        const templateData = story?.template_data as Record<string, unknown> | undefined;
        const catalogCta = templateData?.call_to_action as Record<string, unknown> | undefined;
        const ctaLink = (data: Record<string, unknown> | undefined): string | undefined => {
          const action = data?.call_to_action as Record<string, unknown> | undefined;
          const value = action?.value as Record<string, unknown> | undefined;
          return objectId(value?.link);
        };
        const instantExperienceUrl =
          creativeFormat === 'collection'
            ? `https://fb.com/canvas_doc/${payload.collection?.instantExperienceId.trim()}`
            : `https://fb.com/canvas_doc/${payload.video?.instantExperienceId.trim()}`;
        const templateUrlSpec = creative.template_url_spec as Record<string, unknown> | undefined;
        const templateUrlConfig = templateUrlSpec?.config as Record<string, unknown> | undefined;
        const assetFeedSpec = creative.asset_feed_spec as Record<string, unknown> | undefined;
        const adFormats = assetFeedSpec?.ad_formats;
        const childAttachments = templateData?.child_attachments;
        const firstChild = Array.isArray(childAttachments)
          ? (childAttachments[0] as Record<string, unknown> | undefined)
          : undefined;
        const catalogPresentationMatches =
          creativeFormat === 'catalog_single_image'
            ? payload.creativeSettings?.showMultipleImages
              ? templateData?.show_multiple_images === true
              : templateData?.force_single_link === true &&
                templateData?.show_multiple_images === false
            : creativeFormat === 'catalog_carousel'
              ? Array.isArray(adFormats) &&
                adFormats.includes('CAROUSEL') &&
                childAttachments === undefined &&
                templateData?.force_single_link !== true
              : creativeFormat === 'catalog_video_carousel'
                ? Array.isArray(adFormats) &&
                  adFormats.includes('CAROUSEL') &&
                  objectId(firstChild?.video_id) === payload.hybridVideo?.videoId.trim()
                : creativeFormat === 'catalog'
                  ? assetFeedSpec === undefined &&
                    templateData?.force_single_link !== true &&
                    templateData?.show_multiple_images !== true &&
                    childAttachments === undefined
                  : true;
        const collectionCoverMatches =
          creativeFormat !== 'collection' ||
          (payload.collection?.coverImageHash
            ? objectId(linkData?.image_hash) === payload.collection.coverImageHash.trim() &&
              objectId(linkData?.link) === instantExperienceUrl
            : objectId(videoData?.video_id) === payload.collection?.coverVideoId?.trim() &&
              ctaLink(videoData) === instantExperienceUrl);
        const staticData = payload.collection?.coverImageHash ? linkData : videoData;
        const staticCta = staticData?.call_to_action as Record<string, unknown> | undefined;
        const videoCta = videoData?.call_to_action as Record<string, unknown> | undefined;
        if (
          creative.id !== resumeFrom.creativeId ||
          objectId(creative.account_id) !== expectedAccountId ||
          objectId(story?.page_id) !== payload.pageId.trim() ||
          !catalogPresentationMatches ||
          (creativeFormat !== 'collection' &&
            creativeFormat !== 'catalog_video' &&
            (templateData?.link !== payload.destinationUrl.trim() ||
              templateData.message !== payload.primaryText.trim() ||
              templateData.name !== payload.headline.trim() ||
              catalogCta?.type !== 'SHOP_NOW')) ||
          !collectionCoverMatches ||
          (creativeFormat === 'collection' &&
            (staticData?.message !== payload.primaryText.trim() ||
              (payload.collection?.coverImageHash
                ? staticData?.name !== payload.headline.trim()
                : staticData?.title !== payload.headline.trim()) ||
              staticCta?.type !== 'SHOP_NOW')) ||
          (creativeFormat === 'catalog_video' &&
            (objectId(videoData?.video_id) !== payload.video?.videoId.trim() ||
              videoData?.message !== payload.primaryText.trim() ||
              videoData?.title !== payload.headline.trim() ||
              videoCta?.type !== 'SHOP_NOW' ||
              ctaLink(videoData) !== instantExperienceUrl ||
              objectId(templateUrlConfig?.app_id) !== payload.video?.retailerAppId.trim())) ||
          (creativeFormat !== 'collection' &&
            creativeFormat !== 'catalog_video' &&
            objectId(creative.product_set_id) !== payload.productSetId.trim())
        )
          return unsafe('Creative resume tidak cocok dengan akun atau product set.');
      }

      if (resumeFrom.adId) {
        const ad = await readResumeObject(
          resumeFrom.adId,
          'id,account_id,name,campaign_id,adset_id,status,creative'
        );
        if (
          ad.id !== resumeFrom.adId ||
          objectId(ad.account_id) !== expectedAccountId ||
          ad.name !== payload.adName.trim() ||
          objectId(ad.campaign_id) !== resumeFrom.campaignId ||
          objectId(ad.adset_id) !== resumeFrom.adSetId ||
          objectId(ad.creative) !== resumeFrom.creativeId ||
          ad.status !== 'PAUSED'
        )
          return unsafe(
            'Ad resume tidak cocok dengan akun, hierarki, creative, atau status PAUSED.'
          );
      }
    } catch {
      return unsafe(
        'Objek resume tidak dapat dibaca dan diverifikasi; tidak ada objek baru dibuat.'
      );
    }
  }

  const ids: NonNullable<CpasCatalogCampaignBundleResult['ids']> = { ...resumeFrom };
  const failedAfterCreate = (
    stage: NonNullable<CpasCatalogCampaignBundleResult['stage']>,
    error: string
  ) => withEvidence(failure(stage, 'CPAS_CATALOG_CREATE_FAILED', error, ids));

  const campaign = resumeFrom?.campaignId
    ? { id: resumeFrom.campaignId }
    : await createCampaign(
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
    return failedAfterCreate(
      'campaign',
      ('error' in campaign ? campaign.error : undefined) ?? 'Campaign CPAS gagal dibuat.'
    );
  ids.campaignId = campaign.id;

  const adSet = resumeFrom?.adSetId
    ? { id: resumeFrom.adSetId }
    : await createAdSet(
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
            ...(payload.publisherPlatforms
              ? { publisherPlatforms: payload.publisherPlatforms }
              : {}),
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
  if (!adSet.id)
    return failedAfterCreate(
      'adSet',
      ('error' in adSet ? adSet.error : undefined) ?? 'Ad set CPAS gagal dibuat.'
    );
  ids.adSetId = adSet.id;

  const creative = resumeFrom?.creativeId
    ? { id: resumeFrom.creativeId }
    : await createAdCreative(
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
    return failedAfterCreate(
      'creative',
      ('error' in creative ? creative.error : undefined) ?? 'Creative katalog gagal dibuat.'
    );
  ids.creativeId = creative.id;

  const ad = resumeFrom?.adId
    ? { id: resumeFrom.adId }
    : await createAd(
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
  if (!ad.id)
    return failedAfterCreate(
      'ad',
      ('error' in ad ? ad.error : undefined) ?? 'Ad katalog gagal dibuat.'
    );
  ids.adId = ad.id;

  return withEvidence({ ...base(), status: 'executed', executed: true, ids });
}
