export const TIKTOK_OBJECTIVES = [
  'REACH',
  'TRAFFIC',
  'VIDEO_VIEWS',
  'ENGAGEMENT',
  'LEAD_GENERATION',
  'APP_PROMOTION',
  'WEB_CONVERSIONS',
  'PRODUCT_SALES',
] as const;

export type TikTokObjective = (typeof TIKTOK_OBJECTIVES)[number];

export type TikTokObjectiveLaunchErrorCode =
  | 'UNSUPPORTED_OBJECTIVE'
  | 'INVALID_OBJECTIVE_GOAL_COMBINATION'
  | 'MISSING_OBJECTIVE_FIELD';

export class TikTokObjectiveLaunchValidationError extends Error {
  constructor(
    readonly code: TikTokObjectiveLaunchErrorCode,
    message: string,
    readonly actionableFix: string
  ) {
    super(message);
    this.name = 'TikTokObjectiveLaunchValidationError';
  }
}

export interface TikTokObjectiveLaunchSpec {
  key:
    | 'reach'
    | 'traffic'
    | 'video_views'
    | 'engagement'
    | 'lead_generation'
    | 'app_promotion'
    | 'web_conversions'
    | 'product_sales';
  objectiveType: TikTokObjective;
  defaultOptimizationGoal: string;
  optimizationGoal: string;
  allowedOptimizationGoals: readonly string[];
  billingEvent: string;
  requiredInputs: readonly string[];
}

export interface TikTokObjectiveLaunchRequest {
  objectiveType: TikTokObjective;
  optimizationGoal?: string;
}

export interface TikTokObjectiveLaunchInput {
  appId?: string;
  promotionType?: 'APP_INSTALL' | 'APP_RETARGETING';
  pixelId?: string;
  optimizationEvent?: string;
  instantFormPageId?: string;
  catalogId?: string;
  storeId?: string;
  productSource?: string;
  itemGroupIds?: string[];
}

export interface TikTokObjectiveFieldSet {
  adgroup: Record<string, unknown>;
  creative: Record<string, unknown>;
}

type MatrixRow = Omit<TikTokObjectiveLaunchSpec, 'optimizationGoal'>;

const BASE_REQUIRED_INPUTS = [
  'advertiserId',
  'campaignName',
  'dailyBudget',
  'adgroupName',
  'identityId',
  'identityType',
  'creativeAsset',
  'landingPageUrl',
  'callToAction',
] as const;

const MATRIX: Record<TikTokObjectiveLaunchSpec['key'], MatrixRow> = {
  reach: {
    key: 'reach',
    objectiveType: 'REACH',
    defaultOptimizationGoal: 'REACH',
    allowedOptimizationGoals: ['REACH'],
    billingEvent: 'CPM',
    requiredInputs: BASE_REQUIRED_INPUTS,
  },
  traffic: {
    key: 'traffic',
    objectiveType: 'TRAFFIC',
    defaultOptimizationGoal: 'CLICK',
    allowedOptimizationGoals: ['CLICK', 'LANDING_PAGE_VIEW'],
    billingEvent: 'CPC',
    requiredInputs: BASE_REQUIRED_INPUTS,
  },
  video_views: {
    key: 'video_views',
    objectiveType: 'VIDEO_VIEWS',
    defaultOptimizationGoal: 'VIDEO_VIEW',
    allowedOptimizationGoals: ['VIDEO_VIEW', 'ENGAGED_VIEW'],
    billingEvent: 'CPM',
    requiredInputs: BASE_REQUIRED_INPUTS,
  },
  engagement: {
    key: 'engagement',
    objectiveType: 'ENGAGEMENT',
    defaultOptimizationGoal: 'ENGAGED_VIEW',
    allowedOptimizationGoals: ['ENGAGED_VIEW', 'FOLLOWERS'],
    billingEvent: 'CPM',
    requiredInputs: BASE_REQUIRED_INPUTS,
  },
  lead_generation: {
    key: 'lead_generation',
    objectiveType: 'LEAD_GENERATION',
    defaultOptimizationGoal: 'LEAD_GENERATION',
    allowedOptimizationGoals: ['LEAD_GENERATION'],
    billingEvent: 'CPM',
    requiredInputs: [...BASE_REQUIRED_INPUTS, 'instantFormPageId'],
  },
  app_promotion: {
    key: 'app_promotion',
    objectiveType: 'APP_PROMOTION',
    defaultOptimizationGoal: 'APP_INSTALLS',
    allowedOptimizationGoals: ['APP_INSTALLS', 'IN_APP_EVENT'],
    billingEvent: 'CPM',
    requiredInputs: [...BASE_REQUIRED_INPUTS, 'appId', 'promotionType'],
  },
  web_conversions: {
    key: 'web_conversions',
    objectiveType: 'WEB_CONVERSIONS',
    defaultOptimizationGoal: 'CONVERT',
    allowedOptimizationGoals: ['CONVERT', 'VALUE'],
    billingEvent: 'CPM',
    requiredInputs: [...BASE_REQUIRED_INPUTS, 'pixelId', 'optimizationEvent'],
  },
  product_sales: {
    key: 'product_sales',
    objectiveType: 'PRODUCT_SALES',
    defaultOptimizationGoal: 'VALUE',
    allowedOptimizationGoals: ['VALUE', 'CONVERT'],
    billingEvent: 'CPM',
    requiredInputs: [...BASE_REQUIRED_INPUTS, 'catalogId', 'itemGroupIds'],
  },
};

export function resolveTikTokObjectiveLaunchSpec(
  request: TikTokObjectiveLaunchRequest
): TikTokObjectiveLaunchSpec {
  const row = Object.values(MATRIX).find(
    (candidate) => candidate.objectiveType === request.objectiveType
  );
  if (row === undefined) {
    throw new TikTokObjectiveLaunchValidationError(
      'UNSUPPORTED_OBJECTIVE',
      `Unsupported TikTok objective: ${request.objectiveType}.`,
      `Use one of: ${TIKTOK_OBJECTIVES.join(', ')}.`
    );
  }

  const optimizationGoal = request.optimizationGoal ?? row.defaultOptimizationGoal;
  if (!row.allowedOptimizationGoals.includes(optimizationGoal)) {
    throw new TikTokObjectiveLaunchValidationError(
      'INVALID_OBJECTIVE_GOAL_COMBINATION',
      `${optimizationGoal} is not supported for ${request.objectiveType}.`,
      `Use one of: ${row.allowedOptimizationGoals.join(', ')}.`
    );
  }

  return { ...row, optimizationGoal };
}

export function buildTikTokObjectiveFields(
  spec: TikTokObjectiveLaunchSpec,
  input: TikTokObjectiveLaunchInput
): TikTokObjectiveFieldSet {
  const adgroup: Record<string, unknown> = {};
  const creative: Record<string, unknown> = {};

  switch (spec.key) {
    case 'app_promotion':
      adgroup.app_id = requireInput(input.appId, 'appId');
      adgroup.promotion_type = requireInput(input.promotionType, 'promotionType');
      break;
    case 'web_conversions':
      adgroup.pixel_id = requireInput(input.pixelId, 'pixelId');
      adgroup.optimization_event = requireInput(input.optimizationEvent, 'optimizationEvent');
      break;
    case 'lead_generation':
      creative.page_id = requireInput(input.instantFormPageId, 'instantFormPageId');
      break;
    case 'product_sales':
      adgroup.catalog_id = requireInput(input.catalogId, 'catalogId');
      if (input.storeId) adgroup.store_id = input.storeId;
      if (input.productSource) adgroup.product_source = input.productSource;
      creative.item_group_ids = requireArrayInput(input.itemGroupIds, 'itemGroupIds');
      break;
    case 'reach':
    case 'traffic':
    case 'video_views':
    case 'engagement':
      break;
  }

  return { adgroup, creative };
}

function requireInput(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (normalized) return normalized;
  throw new TikTokObjectiveLaunchValidationError(
    'MISSING_OBJECTIVE_FIELD',
    `${field} is required for this TikTok objective launch.`,
    `Provide ${field}, then run ads_check_launch_readiness again with provider=tiktok.`
  );
}

function requireArrayInput(value: string[] | undefined, field: string): string[] {
  if (value && value.length > 0) return value;
  throw new TikTokObjectiveLaunchValidationError(
    'MISSING_OBJECTIVE_FIELD',
    `${field} is required for this TikTok objective launch.`,
    `Provide ${field}, then run ads_check_launch_readiness again with provider=tiktok.`
  );
}
