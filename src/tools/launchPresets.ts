import type { MetaLaunchWorkflow } from './checkLaunchReadiness.js';

export interface LaunchPreset {
  workflow: MetaLaunchWorkflow;
  label: string;
  mode: 'standard' | 'collaborative_ads';
  objective: string;
  destinationType?: string;
  optimizationGoal: string;
  billingEvent: string;
  defaultCallToAction: string;
  creativeFormats: string[];
  requiredInputs: string[];
  recommendedTools: string[];
  safetyNotes: string[];
}

const PRESETS: Record<MetaLaunchWorkflow, LaunchPreset> = {
  whatsapp_sales: {
    workflow: 'whatsapp_sales',
    label: 'Jualan ke WhatsApp',
    mode: 'standard',
    objective: 'OUTCOME_SALES',
    destinationType: 'WHATSAPP',
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    billingEvent: 'IMPRESSIONS',
    defaultCallToAction: 'WHATSAPP_MESSAGE',
    creativeFormats: ['single_image', 'video', 'placement_image'],
    requiredInputs: [
      'productOrOffer',
      'pageId',
      'whatsappPhoneNumberId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    recommendedTools: [
      'ads_check_launch_readiness',
      'ads_list_pages',
      'ads_list_whatsapp_accounts',
      'ads_list_whatsapp_phone_numbers',
      'ads_upload_image',
      'ads_create_campaign',
      'ads_create_adset',
      'ads_create_adcreative',
      'ads_create_ad',
    ],
    safetyNotes: [
      'Create entities PAUSED first, then ask for a second approval before activation.',
    ],
  },
  website_sales: {
    workflow: 'website_sales',
    label: 'Jualan ke Website',
    mode: 'standard',
    objective: 'OUTCOME_SALES',
    destinationType: 'WEBSITE',
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    billingEvent: 'IMPRESSIONS',
    defaultCallToAction: 'SHOP_NOW',
    creativeFormats: ['single_image', 'video', 'carousel', 'flexible'],
    requiredInputs: [
      'productOrOffer',
      'pageId',
      'pixelId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    recommendedTools: [
      'ads_check_launch_readiness',
      'ads_list_pages',
      'ads_list_pixels',
      'ads_upload_image',
      'ads_create_ecommerce_campaign_bundle',
    ],
    safetyNotes: ['Use dry-run preview before execute; default bundle entities remain PAUSED.'],
  },
  lead_generation: {
    workflow: 'lead_generation',
    label: 'Cari Leads',
    mode: 'standard',
    objective: 'OUTCOME_LEADS',
    destinationType: 'WEBSITE',
    optimizationGoal: 'LEAD_GENERATION',
    billingEvent: 'IMPRESSIONS',
    defaultCallToAction: 'SIGN_UP',
    creativeFormats: ['single_image', 'video', 'carousel'],
    requiredInputs: [
      'productOrOffer',
      'pageId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    recommendedTools: [
      'ads_check_launch_readiness',
      'ads_list_pages',
      'ads_create_campaign',
      'ads_create_adset',
      'ads_create_adcreative',
      'ads_create_ad',
    ],
    safetyNotes: ['Confirm whether special ad categories apply before launching lead ads.'],
  },
  cpas_catalog_sales: {
    workflow: 'cpas_catalog_sales',
    label: 'CPAS / Catalog Sales',
    mode: 'collaborative_ads',
    objective: 'OUTCOME_SALES',
    destinationType: 'WEBSITE',
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    billingEvent: 'IMPRESSIONS',
    defaultCallToAction: 'SHOP_NOW',
    creativeFormats: ['single_image', 'video', 'carousel', 'catalog', 'collection'],
    requiredInputs: [
      'productOrOffer',
      'businessId',
      'catalogId',
      'productSetId',
      'pixelId',
      'pageId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    recommendedTools: [
      'ads_check_launch_readiness',
      'ads_list_catalogs',
      'ads_list_product_sets',
      'ads_list_pixels',
      'ads_create_campaign',
      'ads_create_adset',
      'ads_create_adcreative',
      'ads_create_ad',
    ],
    safetyNotes: [
      'Catalog/product set sharing must already be configured in Meta; this connector only uses accessible IDs.',
    ],
  },
  creative_testing: {
    workflow: 'creative_testing',
    label: 'Test Banyak Creative',
    mode: 'standard',
    objective: 'OUTCOME_SALES',
    destinationType: 'WEBSITE',
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    billingEvent: 'IMPRESSIONS',
    defaultCallToAction: 'LEARN_MORE',
    creativeFormats: ['flexible', 'placement_image'],
    requiredInputs: [
      'productOrOffer',
      'pageId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    recommendedTools: [
      'ads_check_launch_readiness',
      'ads_list_adimages',
      'ads_list_advideos',
      'ads_create_adset',
      'ads_create_adcreative',
      'ads_create_ad',
    ],
    safetyNotes: [
      'Use isDynamicCreative=true on the ad set when attaching a flexible asset_feed_spec creative with multiple bodies/titles. Verified live: Meta rejects ad creation with "Dynamic Creative Ad cannot be created under a non-Dynamic Creative Ad Set" (subcode 1885998) when this is unset, even though creative creation itself succeeds. Some third-party sources claim Flexible Ad Format replaces Dynamic Creative and makes this unnecessary — that does not hold for this API path.',
    ],
  },
  existing_post: {
    workflow: 'existing_post',
    label: 'Boost Existing Post',
    mode: 'standard',
    objective: 'OUTCOME_ENGAGEMENT',
    destinationType: 'WEBSITE',
    optimizationGoal: 'POST_ENGAGEMENT',
    billingEvent: 'IMPRESSIONS',
    defaultCallToAction: 'LEARN_MORE',
    creativeFormats: ['existing_post'],
    requiredInputs: [
      'productOrOffer',
      'pageId',
      'existingPostId',
      'dailyBudget',
      'countries',
      'specialAdCategories',
    ],
    recommendedTools: [
      'ads_check_launch_readiness',
      'ads_list_pages',
      'ads_create_campaign',
      'ads_create_adset',
      'ads_create_adcreative',
      'ads_create_ad',
    ],
    safetyNotes: ['Use objectStoryId from an existing post; do not invent post IDs.'],
  },
};

export function getLaunchPreset(workflow: string | undefined): LaunchPreset {
  const normalized = normalizeWorkflow(workflow);
  return PRESETS[normalized];
}

export function inferLaunchWorkflow(intent: string): MetaLaunchWorkflow {
  const text = intent.toLowerCase();
  if (/(cpas|catalog|katalog|product set|produk set)/i.test(text)) return 'cpas_catalog_sales';
  if (/(whatsapp|wa|ctwa)/i.test(text)) return 'whatsapp_sales';
  if (/(boost|postingan|existing post|post existing)/i.test(text)) return 'existing_post';
  if (/(lead|leads|form|daftar)/i.test(text)) return 'lead_generation';
  if (/(test|testing|banyak creative|variasi|dynamic)/i.test(text)) return 'creative_testing';
  return 'website_sales';
}

function normalizeWorkflow(workflow: string | undefined): MetaLaunchWorkflow {
  if (workflow && workflow in PRESETS) return workflow as MetaLaunchWorkflow;
  return 'website_sales';
}
