import type { MetaClient } from '../metaClient.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';

export type AdSetStatus = 'ACTIVE' | 'PAUSED';

export type BillingEvent =
  | 'IMPRESSIONS' | 'LINK_CLICKS' | 'PAGE_LIKES' | 'POST_ENGAGEMENT'
  | 'VIDEO_VIEWS' | 'LEADS' | 'APP_INSTALLS' | 'MESSAGE_RESPONSES'
  | 'RSVP' | 'THRUPLAY' | 'PURCHASE' | 'LISTING_INTERACTION'
  | 'OFFSITE_CONVERSIONS' | 'ON_INSTALL' | 'ONSITE_CONVERSIONS'
  | 'QUALITY_CALL' | 'REACH' | 'SOCIAL_IMPRESSIONS' | 'VALUE'
  | 'LANDING_PAGE_VIEWS';

export type OptimizationGoal =
  | 'NONE' | 'APP_INSTALLS' | 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS'
  | 'CONVERSATIONS' | 'DERIVED_EVENTS' | 'ENGAGED_USERS'
  | 'EVENT_RESPONSES' | 'IMPRESSIONS' | 'LANDING_PAGE_VIEWS'
  | 'LEAD_GENERATION' | 'LINK_CLICKS' | 'OFFSITE_CONVERSIONS'
  | 'ONSITE_CONVERSIONS' | 'PAGE_LIKES' | 'POST_ENGAGEMENT'
  | 'QUALITY_CALL' | 'REACH' | 'SOCIAL_IMPRESSIONS'
  | 'THRUPLAY' | 'VALUE' | 'VISIT_INSTAGRAM_PROFILE';

export interface AdSetTargeting {
  geoLocations?: {
    countries?: string[];
    regions?: Array<{ key: string; name?: string }>;
    cities?: Array<{ key: string; name?: string }>;
    zips?: Array<{ key: string }>;
    locationTypes?: Array<'home' | 'recent' | 'travel_in' | 'traveling'>;
  };
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  interests?: Array<{ id: string; name?: string }>;
  behaviors?: Array<{ id: string; name?: string }>;
  customAudiences?: Array<{ id: string }>;
  excludedCustomAudiences?: Array<{ id: string }>;
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
  messengerPositions?: string[];
  marketplacePositions?: string[];
  devicePlatforms?: string[];
  flexibleSpec?: Array<Record<string, unknown>>;
  exclusions?: Record<string, unknown>;
  targetingOptimization?: string;
}

export interface CreateAdSetOptions {
  adAccountId: string;
  campaignId: string;
  name: string;
  status?: AdSetStatus;
  dailyBudget?: number;
  lifetimeBudget?: number;
  billingEvent?: BillingEvent;
  optimizationGoal?: OptimizationGoal;
  bidStrategy?: string;
  targeting?: AdSetTargeting;
  promotedObject?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
}

export type CreateAdSetStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CreateAdSetResult {
  operation: 'create_adset';
  status: CreateAdSetStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

/**
 * Create a Meta ad set under an existing campaign.
 *
 * Dry-run by default: returns preview without calling the API.
 * Set dryRun=false + confirmed=true to execute.
 *
 * POST /act_{ad_account_id}/adsets
 *
 * Returns ad set ID on success.
 */
export async function createAdSet(
  client: MetaClient,
  options: CreateAdSetOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreateAdSetResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  const preview = buildAdSetPayload(options);
  const baseResult: CreateAdSetResult = {
    operation: 'create_adset',
    status: 'dry_run',
    executed: false,
    preview,
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  const accountPath = normalizeAccountPath(options.adAccountId);

  try {
    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/adsets`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created ad set',
      };
    }

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      id: response.id,
      response,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildAdSetPayload(options: CreateAdSetOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: options.name.trim(),
    campaign_id: options.campaignId,
    status: options.status ?? 'PAUSED',
    billing_event: options.billingEvent ?? 'IMPRESSIONS',
    optimization_goal: options.optimizationGoal ?? 'REACH',
    bid_strategy: options.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
  };

  if (options.dailyBudget !== undefined) {
    payload.daily_budget = options.dailyBudget;
  }

  if (options.lifetimeBudget !== undefined) {
    payload.lifetime_budget = options.lifetimeBudget;
  }

  if (options.targeting) {
    payload.targeting = buildTargetingPayload(options.targeting);
  }

  if (options.promotedObject) {
    payload.promoted_object = options.promotedObject;
  }

  if (options.startTime) {
    payload.start_time = options.startTime;
  }

  if (options.endTime) {
    payload.end_time = options.endTime;
  }

  return payload;
}

function buildTargetingPayload(targeting: AdSetTargeting): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (targeting.geoLocations) {
    result.geo_locations = targeting.geoLocations;
  }

  if (targeting.ageMin !== undefined) result.age_min = targeting.ageMin;
  if (targeting.ageMax !== undefined) result.age_max = targeting.ageMax;
  if (targeting.genders !== undefined) result.genders = targeting.genders;

  if (targeting.interests !== undefined) result.interests = targeting.interests;
  if (targeting.behaviors !== undefined) result.behaviors = targeting.behaviors;
  if (targeting.customAudiences !== undefined) result.custom_audiences = targeting.customAudiences;
  if (targeting.excludedCustomAudiences !== undefined) result.excluded_custom_audiences = targeting.excludedCustomAudiences;
  if (targeting.publisherPlatforms !== undefined) result.publisher_platforms = targeting.publisherPlatforms;
  if (targeting.facebookPositions !== undefined) result.facebook_positions = targeting.facebookPositions;
  if (targeting.instagramPositions !== undefined) result.instagram_positions = targeting.instagramPositions;
  if (targeting.messengerPositions !== undefined) result.messenger_positions = targeting.messengerPositions;
  if (targeting.marketplacePositions !== undefined) result.marketplace_positions = targeting.marketplacePositions;
  if (targeting.devicePlatforms !== undefined) result.device_platforms = targeting.devicePlatforms;
  if (targeting.flexibleSpec !== undefined) result.flexible_spec = targeting.flexibleSpec;
  if (targeting.exclusions !== undefined) result.exclusions = targeting.exclusions;
  if (targeting.targetingOptimization !== undefined) result.targeting_optimization = targeting.targetingOptimization;

  return result;
}
