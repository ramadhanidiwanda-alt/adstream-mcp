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

/** Canonical Website Sales values consumed by legacy bundle compatibility paths. */
export const META_SALES_WEBSITE_OPTIMIZATION_GOALS = ['OFFSITE_CONVERSIONS', 'VALUE'] as const;
export const META_SALES_WEBSITE_CREATIVE_FORMATS = [
  'single_image',
  'video',
  'carousel',
] as const satisfies readonly MetaCreativeFormat[];

export const META_CONVERSION_LOCATIONS = [
  'AWARENESS',
  'WEBSITE',
  'POST',
  'VIDEO',
  'INSTANT_FORM',
  'APP',
  'CATALOG',
  /**
   * Click-to-message: the ad opens a conversation in Instagram Direct, Messenger or
   * WhatsApp instead of sending the user anywhere. Which inbox is chosen by
   * messagingDestination, since one row cannot carry all five destination_type values.
   */
  'MESSAGING',
] as const;

/**
 * Ad set destination_type values a messaging launch can use, from
 * https://developers.facebook.com/docs/marketing-api/adset/destination_type/
 */
export const META_MESSAGING_DESTINATIONS = [
  'INSTAGRAM_DIRECT',
  'MESSENGER',
  'WHATSAPP',
  'MESSAGING_INSTAGRAM_DIRECT_MESSENGER',
  'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP',
  'MESSAGING_INSTAGRAM_DIRECT_WHATSAPP',
  'MESSAGING_MESSENGER_WHATSAPP',
] as const;

export type MetaMessagingDestination = (typeof META_MESSAGING_DESTINATIONS)[number];

/** The CTA each messaging destination pairs with. Multi-destination rows lead with Instagram. */
const MESSAGING_DESTINATION_DEFAULT_CTA: Readonly<Record<MetaMessagingDestination, string>> = {
  INSTAGRAM_DIRECT: 'INSTAGRAM_MESSAGE',
  MESSENGER: 'MESSAGE_PAGE',
  WHATSAPP: 'WHATSAPP_MESSAGE',
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER: 'INSTAGRAM_MESSAGE',
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP: 'INSTAGRAM_MESSAGE',
  MESSAGING_INSTAGRAM_DIRECT_WHATSAPP: 'INSTAGRAM_MESSAGE',
  MESSAGING_MESSENGER_WHATSAPP: 'MESSAGE_PAGE',
};

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
    | 'engagement_messaging'
    | 'app_installs'
    | 'sales_website'
    | 'sales_messaging'
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
  /**
   * Which inbox a MESSAGING launch opens. Resolves the row's destinationType and
   * defaultCallToAction; ignored by every other conversion location.
   */
  messagingDestination?: MetaMessagingDestination;
}

export interface MetaObjectiveLaunchInput {
  pageId?: string;
  whatsappPhoneNumber?: string;
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
  /**
   * Required inputs that replace `requiredInputs` when a specific creative
   * format is requested. Used where the format itself changes what the
   * advertiser has to supply — an existing post already carries its own media
   * and copy, so asking for creativeAsset/primaryText/headline is wrong.
   */
  requiredInputsByCreativeFormat?: Partial<Record<MetaCreativeFormat, readonly string[]>>;
}

/**
 * Boosting an existing Page post or Instagram media is a creative choice, not a
 * conversion location: Ads Manager keeps conversion location on Website and
 * swaps only the creative for the post. The post already carries its own media
 * and copy, so creativeAsset/primaryText/headline give way to existingPostId,
 * while destinationUrl stays mandatory — buildExistingPost sends it as the
 * top-level call_to_action that drives clicks off the post.
 */
const WEBSITE_EXISTING_POST_REQUIRED_INPUTS = [
  'pageId',
  'existingPostId',
  'destinationUrl',
  'dailyBudget',
  'countries',
  'specialAdCategories',
] as const;

/** Same, for the rows that also optimize against a pixel (Leads and Sales). */
const WEBSITE_EXISTING_POST_REQUIRED_INPUTS_WITH_PIXEL = [
  'pageId',
  'pixelId',
  'existingPostId',
  'destinationUrl',
  'dailyBudget',
  'countries',
  'specialAdCategories',
] as const;

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
    supportedCreativeFormats: ['single_image', 'video', 'carousel', 'existing_post'],
    requiredInputsByCreativeFormat: {
      existing_post: WEBSITE_EXISTING_POST_REQUIRED_INPUTS,
    },
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
  /**
   * Click-to-message (CTX / CTWA). Before this row existed, a click-to-message launch
   * resolved to engagement_post with destinationType ON_POST — boosting likes and
   * comments, not opening a conversation.
   *
   * An existing post carries its own media and copy, and a messaging CTA carries no
   * link, so this row asks for neither creativeAsset/primaryText/headline nor
   * destinationUrl. messagingDestination decides which inbox opens.
   */
  engagement_messaging: {
    key: 'engagement_messaging',
    objective: 'OUTCOME_ENGAGEMENT',
    conversionLocation: 'MESSAGING',
    defaultGoal: 'CONVERSATIONS',
    allowedGoals: ['CONVERSATIONS', 'LINK_CLICKS', 'IMPRESSIONS'],
    billingEvent: 'IMPRESSIONS',
    // Replaced with the resolved messagingDestination; there is no single default.
    destinationType: undefined,
    destinationMode: 'NONE',
    promotedObjectKind: 'page',
    requiredInputs: [
      'pageId',
      'messagingDestination',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['existing_post', 'single_image', 'video'],
    requiredInputsByCreativeFormat: {
      existing_post: [
        'pageId',
        'messagingDestination',
        'existingPostId',
        'dailyBudget',
        'countries',
        'specialAdCategories',
      ],
    },
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
    supportedCreativeFormats: ['single_image', 'video', 'carousel', 'existing_post'],
    requiredInputsByCreativeFormat: {
      existing_post: WEBSITE_EXISTING_POST_REQUIRED_INPUTS_WITH_PIXEL,
    },
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
    allowedGoals: META_SALES_WEBSITE_OPTIMIZATION_GOALS,
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
    supportedCreativeFormats: [...META_SALES_WEBSITE_CREATIVE_FORMATS, 'existing_post'],
    requiredInputsByCreativeFormat: {
      existing_post: WEBSITE_EXISTING_POST_REQUIRED_INPUTS_WITH_PIXEL,
    },
    defaultCallToAction: 'SHOP_NOW',
    minApiMajor: 23,
    maxApiMajor: 25,
  },
  sales_messaging: {
    key: 'sales_messaging',
    objective: 'OUTCOME_SALES',
    conversionLocation: 'MESSAGING',
    defaultGoal: 'CONVERSATIONS',
    allowedGoals: ['MESSAGING_PURCHASE_CONVERSION', 'CONVERSATIONS', 'LINK_CLICKS', 'IMPRESSIONS'],
    billingEvent: 'IMPRESSIONS',
    // Replaced with the resolved messagingDestination; there is no single default.
    destinationType: undefined,
    destinationMode: 'EXTERNAL_URL',
    promotedObjectKind: 'page',
    requiredInputs: [
      'pageId',
      'messagingDestination',
      'whatsappPhoneNumber',
      'pixelId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'creativeAsset',
      'primaryText',
      'specialAdCategories',
    ],
    supportedCreativeFormats: ['existing_post', 'single_image', 'video'],
    requiredInputsByCreativeFormat: {
      existing_post: [
        'pageId',
        'messagingDestination',
        'whatsappPhoneNumber',
        'pixelId',
        'existingPostId',
        'dailyBudget',
        'countries',
        'specialAdCategories',
      ],
    },
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

  const { defaultGoal: _defaultGoal, allowedGoals, requiredInputsByCreativeFormat, ...spec } = row;
  const formatRequiredInputs =
    request.creativeFormat === undefined
      ? undefined
      : requiredInputsByCreativeFormat?.[request.creativeFormat];

  // A messaging row has no single destination_type — the caller's chosen inbox is what
  // makes the resolved spec actionable, and it also picks the matching CTA.
  const messagingDestination =
    row.conversionLocation === 'MESSAGING' ? request.messagingDestination : undefined;
  if (
    messagingDestination !== undefined &&
    !META_MESSAGING_DESTINATIONS.includes(messagingDestination)
  ) {
    throw new MetaObjectiveLaunchValidationError(
      'INVALID_OBJECTIVE_DESTINATION_COMBINATION',
      `${messagingDestination} is not a supported messaging destination.`,
      `Use one of: ${META_MESSAGING_DESTINATIONS.join(', ')}.`
    );
  }

  return {
    ...spec,
    ...(messagingDestination
      ? {
          destinationType: messagingDestination,
          defaultCallToAction: MESSAGING_DESTINATION_DEFAULT_CTA[messagingDestination],
        }
      : {}),
    requiredInputs: formatRequiredInputs ?? spec.requiredInputs,
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
      return {
        page_id: requireInput(input.pageId, 'pageId'),
        ...(input.whatsappPhoneNumber?.trim()
          ? { whatsapp_phone_number: input.whatsappPhoneNumber.trim() }
          : {}),
      };
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
