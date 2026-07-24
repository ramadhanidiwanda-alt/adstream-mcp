import type { MetaCreativeDestinationMode, MetaCreativeFormat } from '../../types.js';

export const META_ODAX_OBJECTIVES = [
  'OUTCOME_AWARENESS',
  'OUTCOME_TRAFFIC',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_SALES',
] as const;

export type MetaOdaxObjective = (typeof META_ODAX_OBJECTIVES)[number];

export const META_CONVERSION_LOCATIONS = [
  'AWARENESS',
  'WEBSITE',
  'POST',
  'VIDEO',
  'INSTANT_FORM',
  'APP',
  'CATALOG',
] as const;

export type MetaConversionLocation = (typeof META_CONVERSION_LOCATIONS)[number];
export type MetaPromotedObjectKind =
  | 'none'
  | 'pixel_lead'
  | 'pixel_purchase'
  | 'page'
  | 'application'
  | 'collaborative_catalog';

export type MetaObjectiveLaunchErrorCode =
  | 'UNSUPPORTED_OBJECTIVE'
  | 'INVALID_OBJECTIVE_GOAL_COMBINATION'
  | 'INVALID_OBJECTIVE_DESTINATION_COMBINATION'
  | 'MISSING_PROMOTED_OBJECT_FIELD'
  | 'MISSING_OBJECTIVE_DEPENDENCY'
  | 'UNSUPPORTED_CREATIVE_FORMAT'
  | 'UNSUPPORTED_API_VERSION';

export interface MetaObjectiveLaunchSpec {
  key:
    | 'awareness'
    | 'traffic_website'
    | 'engagement_post'
    | 'engagement_video'
    | 'leads_website'
    | 'leads_instant_form'
    | 'app_installs'
    | 'sales_website'
    | 'sales_catalog';
  objective: MetaOdaxObjective;
  conversionLocation: MetaConversionLocation;
  optimizationGoal: string;
  allowedOptimizationGoals: readonly string[];
  billingEvent: string;
  destinationType?: string;
  destinationMode: MetaCreativeDestinationMode;
  promotedObjectKind: MetaPromotedObjectKind;
  requiredInputs: readonly string[];
  supportedCreativeFormats: readonly MetaCreativeFormat[];
  defaultCallToAction?: string;
  minApiMajor: 23;
  maxApiMajor: 25;
}

export interface MetaObjectiveLaunchRequest {
  objective: MetaOdaxObjective;
  conversionLocation: MetaConversionLocation;
  optimizationGoal?: string;
  creativeFormat?: MetaCreativeFormat;
  apiVersion?: string;
}

export interface MetaObjectiveLaunchInput {
  pageId?: string;
  pixelId?: string;
  leadFormId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  productSetId?: string;
  customEventType?: string;
}

export class MetaObjectiveLaunchValidationError extends Error {
  constructor(
    readonly code: MetaObjectiveLaunchErrorCode,
    message: string,
    readonly actionableFix: string
  ) {
    super(message);
    this.name = 'MetaObjectiveLaunchValidationError';
  }
}

interface MetaObjectiveLaunchMatrixRow extends Omit<
  MetaObjectiveLaunchSpec,
  'optimizationGoal' | 'allowedOptimizationGoals'
> {
  defaultGoal: string;
  allowedGoals: readonly string[];
}

const MATRIX: Record<MetaObjectiveLaunchSpec['key'], MetaObjectiveLaunchMatrixRow> = {
  awareness: {
    key: 'awareness',
    objective: 'OUTCOME_AWARENESS',
    conversionLocation: 'AWARENESS',
    defaultGoal: 'REACH',
    allowedGoals: ['REACH', 'IMPRESSIONS'],
    billingEvent: 'IMPRESSIONS',
    destinationType: undefined,
    destinationMode: 'NONE',
    promotedObjectKind: 'none',
    requiredInputs: [
      'pageId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video'],
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  traffic_website: {
    key: 'traffic_website',
    objective: 'OUTCOME_TRAFFIC',
    conversionLocation: 'WEBSITE',
    defaultGoal: 'LANDING_PAGE_VIEWS',
    allowedGoals: ['LANDING_PAGE_VIEWS', 'LINK_CLICKS'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'WEBSITE',
    destinationMode: 'EXTERNAL_URL',
    promotedObjectKind: 'none',
    requiredInputs: [
      'pageId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video', 'carousel', 'flexible'],
    defaultCallToAction: 'LEARN_MORE',
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  engagement_post: {
    key: 'engagement_post',
    objective: 'OUTCOME_ENGAGEMENT',
    conversionLocation: 'POST',
    defaultGoal: 'POST_ENGAGEMENT',
    allowedGoals: ['POST_ENGAGEMENT'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'ON_POST',
    destinationMode: 'NONE',
    promotedObjectKind: 'none',
    requiredInputs: ['pageId', 'existingPostId', 'dailyBudget', 'countries', 'specialAdCategories'],
    supportedCreativeFormats: ['existing_post'],
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  engagement_video: {
    key: 'engagement_video',
    objective: 'OUTCOME_ENGAGEMENT',
    conversionLocation: 'VIDEO',
    defaultGoal: 'THRUPLAY',
    allowedGoals: ['THRUPLAY'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'ON_VIDEO',
    destinationMode: 'NONE',
    promotedObjectKind: 'none',
    requiredInputs: [
      'pageId',
      'videoId',
      'dailyBudget',
      'countries',
      'primaryText',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['video'],
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  leads_website: {
    key: 'leads_website',
    objective: 'OUTCOME_LEADS',
    conversionLocation: 'WEBSITE',
    defaultGoal: 'OFFSITE_CONVERSIONS',
    allowedGoals: ['OFFSITE_CONVERSIONS'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'WEBSITE',
    destinationMode: 'EXTERNAL_URL',
    promotedObjectKind: 'pixel_lead',
    requiredInputs: [
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
    supportedCreativeFormats: ['single_image', 'video', 'carousel'],
    defaultCallToAction: 'SIGN_UP',
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  leads_instant_form: {
    key: 'leads_instant_form',
    objective: 'OUTCOME_LEADS',
    conversionLocation: 'INSTANT_FORM',
    defaultGoal: 'LEAD_GENERATION',
    allowedGoals: ['LEAD_GENERATION'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'ON_AD',
    destinationMode: 'INSTANT_FORM',
    promotedObjectKind: 'page',
    requiredInputs: [
      'pageId',
      'leadFormId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video'],
    defaultCallToAction: 'SIGN_UP',
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  app_installs: {
    key: 'app_installs',
    objective: 'OUTCOME_APP_PROMOTION',
    conversionLocation: 'APP',
    defaultGoal: 'APP_INSTALLS',
    allowedGoals: ['APP_INSTALLS'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'APP',
    destinationMode: 'APP',
    promotedObjectKind: 'application',
    requiredInputs: [
      'pageId',
      'applicationId',
      'objectStoreUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video'],
    defaultCallToAction: 'INSTALL_MOBILE_APP',
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  sales_website: {
    key: 'sales_website',
    objective: 'OUTCOME_SALES',
    conversionLocation: 'WEBSITE',
    defaultGoal: 'OFFSITE_CONVERSIONS',
    allowedGoals: ['OFFSITE_CONVERSIONS', 'VALUE'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'WEBSITE',
    destinationMode: 'EXTERNAL_URL',
    promotedObjectKind: 'pixel_purchase',
    requiredInputs: [
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
    supportedCreativeFormats: ['single_image', 'video', 'carousel', 'flexible'],
    defaultCallToAction: 'SHOP_NOW',
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  sales_catalog: {
    key: 'sales_catalog',
    objective: 'OUTCOME_SALES',
    conversionLocation: 'CATALOG',
    defaultGoal: 'OFFSITE_CONVERSIONS',
    allowedGoals: ['OFFSITE_CONVERSIONS', 'VALUE'],
    billingEvent: 'IMPRESSIONS',
    destinationType: 'WEBSITE',
    destinationMode: 'EXTERNAL_URL',
    promotedObjectKind: 'collaborative_catalog',
    requiredInputs: [
      'businessId',
      'catalogId',
      'productSetId',
      'pageId',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'headline',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['single_image', 'video', 'carousel', 'catalog', 'collection'],
    defaultCallToAction: 'SHOP_NOW',
    minApiMajor: 23,
    maxApiMajor: 25,
  },
};

export function parseMetaApiMajor(apiVersion: string): number {
  const match = /^v?(\d+)(?:\.|$)/i.exec(apiVersion.trim());
  return match === null ? Number.NaN : Number(match[1]);
}

export function resolveMetaObjectiveLaunchSpec(
  request: MetaObjectiveLaunchRequest
): MetaObjectiveLaunchSpec {
  const rows = Object.values(MATRIX);
  const objectiveExists = rows.some((row) => row.objective === request.objective);
  if (!objectiveExists) {
    throw new MetaObjectiveLaunchValidationError(
      'UNSUPPORTED_OBJECTIVE',
      `Unsupported Meta objective: ${request.objective}.`,
      `Use one of: ${META_ODAX_OBJECTIVES.join(', ')}.`
    );
  }

  const row = rows.find(
    (candidate) =>
      candidate.objective === request.objective &&
      candidate.conversionLocation === request.conversionLocation
  );
  if (row === undefined) {
    throw new MetaObjectiveLaunchValidationError(
      'INVALID_OBJECTIVE_DESTINATION_COMBINATION',
      `${request.conversionLocation} is not supported for ${request.objective}.`,
      'Choose a supported conversion location for the selected objective.'
    );
  }

  const apiMajor = parseMetaApiMajor(request.apiVersion ?? 'v25.0');
  if (!Number.isInteger(apiMajor) || apiMajor < row.minApiMajor || apiMajor > row.maxApiMajor) {
    throw new MetaObjectiveLaunchValidationError(
      'UNSUPPORTED_API_VERSION',
      `Meta Marketing API ${request.apiVersion ?? 'v25.0'} is not supported for this launch.`,
      `Use a reviewed Meta Marketing API version from v${row.minApiMajor}.0 through v${row.maxApiMajor}.0.`
    );
  }

  const optimizationGoal = request.optimizationGoal ?? row.defaultGoal;
  if (!row.allowedGoals.includes(optimizationGoal)) {
    throw new MetaObjectiveLaunchValidationError(
      'INVALID_OBJECTIVE_GOAL_COMBINATION',
      `${optimizationGoal} is not supported for ${request.objective} at ${request.conversionLocation}.`,
      `Use one of: ${row.allowedGoals.join(', ')}.`
    );
  }

  if (
    request.creativeFormat !== undefined &&
    !row.supportedCreativeFormats.includes(request.creativeFormat)
  ) {
    throw new MetaObjectiveLaunchValidationError(
      'UNSUPPORTED_CREATIVE_FORMAT',
      `${request.creativeFormat} is not supported for ${request.objective} at ${request.conversionLocation}.`,
      `Use one of: ${row.supportedCreativeFormats.join(', ')}.`
    );
  }

  const { defaultGoal: _defaultGoal, allowedGoals, ...spec } = row;
  return {
    ...spec,
    allowedOptimizationGoals: allowedGoals,
    optimizationGoal,
  };
}

export function buildMetaPromotedObject(
  spec: MetaObjectiveLaunchSpec,
  input: MetaObjectiveLaunchInput
): Record<string, string> | undefined {
  switch (spec.promotedObjectKind) {
    case 'none':
      return undefined;
    case 'pixel_lead':
      return { pixel_id: requireInput(input.pixelId, 'pixelId'), custom_event_type: 'LEAD' };
    case 'pixel_purchase':
      return {
        pixel_id: requireInput(input.pixelId, 'pixelId'),
        custom_event_type: input.customEventType?.trim() || 'PURCHASE',
      };
    case 'page':
      return { page_id: requireInput(input.pageId, 'pageId') };
    case 'application':
      return {
        application_id: requireInput(input.applicationId, 'applicationId'),
        object_store_url: requireInput(input.objectStoreUrl, 'objectStoreUrl'),
      };
    case 'collaborative_catalog':
      return { product_set_id: requireInput(input.productSetId, 'productSetId') };
  }
}

function requireInput(value: string | undefined, field: string): string {
  const normalizedValue = value?.trim();
  if (normalizedValue) return normalizedValue;

  throw new MetaObjectiveLaunchValidationError(
    'MISSING_PROMOTED_OBJECT_FIELD',
    `${field} is required for this objective launch.`,
    `Provide ${field}, then run ads_check_launch_readiness again.`
  );
}
