import type { MetaClient } from '../metaClient.js';
import { createAd } from './createAd.js';
import { createAdCreative } from './createAdCreative.js';
import { createAdSet } from './createAdSet.js';
import { createCampaign } from './createCampaign.js';
import { formatMetaWriteError } from '../utils/formatMetaWriteError.js';

export type CpasCatalogBundleStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CpasCatalogCampaignBundlePayload {
  adAccountId: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  pageId: string;
  productSetId: string;
  pixelId?: string;
  customEventType?: 'PURCHASE' | 'ADD_TO_CART' | 'INITIATED_CHECKOUT';
  dailyBudget: number;
  countries: string[];
  primaryText: string;
  headline: string;
  description?: string;
  destinationUrl: string;
  templateUrl?: string;
  fallbackImageHash?: string;
  callToAction?: 'SHOP_NOW' | 'LEARN_MORE';
  ageMin?: number;
  ageMax?: number;
  publisherPlatforms?: string[];
  instagramUserId?: string;
  threadsProfileId?: string;
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
  product_catalog?: string;
  product_count?: number;
}

export function buildCpasCatalogBundlePreview(
  payload: CpasCatalogCampaignBundlePayload
): CpasCatalogCampaignBundlePreview {
  const productSetId = payload.productSetId.trim();
  const destinationUrl = payload.destinationUrl.trim();
  return {
    campaign: {
      name: payload.campaignName.trim(),
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      special_ad_categories: [],
      daily_budget: payload.dailyBudget,
    },
    adSet: {
      name: payload.adSetName.trim(),
      status: 'PAUSED',
      destination_type: 'CATALOG',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: {
        product_set_id: productSetId,
        ...(payload.pixelId?.trim()
          ? { pixel_id: payload.pixelId.trim(), custom_event_type: payload.customEventType ?? 'PURCHASE' }
          : {}),
      },
    },
    creative: {
      name: payload.adName.trim() + ' Creative',
      product_set_id: productSetId,
      object_story_spec: {
        page_id: payload.pageId.trim(),
        template_data: {
          message: payload.primaryText.trim(),
          name: payload.headline.trim(),
          ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
          link: payload.templateUrl?.trim() || destinationUrl,
          call_to_action: {
            type: payload.callToAction ?? 'SHOP_NOW',
            value: { link: destinationUrl },
          },
        },
      },
    },
    ad: { name: payload.adName.trim(), status: 'PAUSED' },
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
    return failure('preflight', 'INVALID_CPAS_CATALOG_COUNTRIES', 'countries harus berisi minimal satu negara.');
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
    return failure('preflight', 'UNREADABLE_CPAS_PRODUCT_SET', 'Product set CPAS tidak dapat diverifikasi.');
  }
  if (!Number.isFinite(productSet.product_count) || Number(productSet.product_count) <= 0) {
    return failure('preflight', 'EMPTY_CPAS_PRODUCT_SET', 'Product set CPAS tidak memiliki produk yang siap diiklankan.');
  }

  const productSetEvidence = {
    id: productSet.id,
    ...(typeof productSet.product_catalog === 'string' ? { catalogId: productSet.product_catalog } : {}),
    productCount: Number(productSet.product_count),
  };
  const withEvidence = (result: CpasCatalogCampaignBundleResult): CpasCatalogCampaignBundleResult => ({
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
      dailyBudget: payload.dailyBudget,
    },
    { dryRun: false, confirmed: true, maxRetries: options.maxRetries }
  );
  if (!campaign.id) return failedAfterCreate('campaign', campaign.error ?? 'Campaign CPAS gagal dibuat.');
  ids.campaignId = campaign.id;

  const adSet = await createAdSet(
    client,
    {
      adAccountId: payload.adAccountId,
      campaignId: campaign.id,
      name: payload.adSetName,
      mode: 'collaborative_ads',
      status: 'PAUSED',
      destinationType: 'CATALOG',
      billingEvent: 'IMPRESSIONS',
      optimizationGoal: 'OFFSITE_CONVERSIONS',
      collaborativeCatalog: {
        productSetId: payload.productSetId,
        pixelId: payload.pixelId,
        customEventType: payload.customEventType ?? 'PURCHASE',
      },
      targeting: {
        geoLocations: { countries: payload.countries },
        ageMin: payload.ageMin ?? 18,
        ...(payload.ageMax ? { ageMax: payload.ageMax } : {}),
        ...(payload.publisherPlatforms ? { publisherPlatforms: payload.publisherPlatforms } : {}),
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
      creative: {
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
        },
      },
      instagramUserId: payload.instagramUserId,
      threadsProfileId: payload.threadsProfileId,
    },
    { dryRun: false, confirmed: true, maxRetries: options.maxRetries }
  );
  if (!creative.id) return failedAfterCreate('creative', creative.error ?? 'Creative katalog gagal dibuat.');
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
