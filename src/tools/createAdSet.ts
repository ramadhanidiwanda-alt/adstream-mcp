import type { MetaClient } from '../metaClient.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import { MetaApiError } from '../utils/metaError.js';

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
  /** Bid amount in account currency cents. Required when campaign uses COST_CAP or LOWEST_COST_WITH_BID_CAP. */
  bidAmount?: number;
  /** Bid constraints for LOWEST_COST_WITH_MIN_ROAS. Shape: { roas_average_floor: number } */
  bidConstraints?: Record<string, unknown>;
  targeting?: AdSetTargeting;
  promotedObject?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  /** Where users go: WEBSITE, APP, MESSENGER, WHATSAPP, INSTAGRAM_DIRECT, etc. */
  destinationType?: string;
  /** Attribution window spec. Example: [{ event_type: 'CLICK_THROUGH', window_days: 7 }] */
  attributionSpec?: Array<Record<string, unknown>>;
  /** Frequency cap specs. Example: [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }] */
  frequencyControlSpecs?: Array<Record<string, unknown>>;
  /** Enable Dynamic Creative for this ad set */
  isDynamicCreative?: boolean;
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

interface CampaignInfo {
  id: string;
  bid_strategy?: string;
  daily_budget?: number;
  lifetime_budget?: number;
}

/** Bid strategies that require bid_amount */
const STRATEGIES_REQUIRING_BID_AMOUNT = ['COST_CAP', 'LOWEST_COST_WITH_BID_CAP', 'TARGET_COST'];

/** Map known Meta error subcodes to human-readable messages */
function mapSubcodeError(subcode: number | undefined, bidStrategy?: string): string | null {
  if (subcode === undefined) return null;
  switch (subcode) {
    case 1815857:
      return `Bid amount required. The campaign uses bid strategy '${bidStrategy || 'LOWEST_COST_WITH_BID_CAP'}' which requires a bidAmount. Add bidAmount (in cents) or remove the ad set-level bid_strategy.`;
    case 1885621:
      return 'bid_amount value is invalid or too low. Ensure bidAmount is a positive integer in account currency cents (e.g., 500000 = Rp5.000).';
    case 2446149:
      return 'Unsupported bid_strategy and bid_amount combination. Try using COST_CAP instead of LOWEST_COST_WITH_BID_CAP.';
    case 2446404:
      return 'Missing required parameter. Ensure billing_event and optimization_goal are set correctly for this campaign objective.';
    default:
      return null;
  }
}

/**
 * Create a Meta ad set under an existing campaign.
 *
 * Dry-run by default: returns preview without calling the API.
 * Set dryRun=false + confirmed=true to execute.
 *
 * Includes pre-flight checks to catch common Meta API errors:
 * - Invalid bid_strategy values (e.g., 'LOWEST_COST')
 * - Missing bidAmount for strategies that require it
 * - Missing bidConstraints for LOWEST_COST_WITH_MIN_ROAS
 * - CBO budget conflict (budget at both campaign and ad set level)
 * - Missing bid_amount when campaign uses a bid strategy that requires it
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

  // --- CLIENT-SIDE BID STRATEGY VALIDATION ---
  // These checks don't require an API call

  // Check: Invalid 'LOWEST_COST' value (common mistake)
  if (options.bidStrategy === 'LOWEST_COST') {
    return {
      ...baseResult,
      status: 'failed',
      error: `'LOWEST_COST' is not a valid bid_strategy. Use 'LOWEST_COST_WITHOUT_CAP' instead (no bidAmount required).`,
    };
  }

  // Check: bid_strategy requiring bid_amount but no bidAmount provided
  if (
    options.bidStrategy &&
    STRATEGIES_REQUIRING_BID_AMOUNT.includes(options.bidStrategy) &&
    options.bidAmount === undefined
  ) {
    return {
      ...baseResult,
      status: 'failed',
      error: `bidAmount is required when bidStrategy is '${options.bidStrategy}'. Add bidAmount (in cents), or change bidStrategy to 'LOWEST_COST_WITHOUT_CAP'.`,
    };
  }

  // Check: LOWEST_COST_WITH_MIN_ROAS requires bidConstraints
  if (options.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS' && options.bidConstraints === undefined) {
    return {
      ...baseResult,
      status: 'failed',
      error: `bidConstraints is required when bidStrategy is 'LOWEST_COST_WITH_MIN_ROAS'. Provide bidConstraints with roas_average_floor (target ROAS × 10000). Example: { roas_average_floor: 20000 } for 2.0x ROAS.`,
    };
  }

  // --- PRE-FLIGHT CHECK: fetch campaign data ---
  try {
    const campaign = await client.metaGetObject<CampaignInfo>(
      `/${options.campaignId}`,
      { fields: 'id,bid_strategy,daily_budget,lifetime_budget' },
      maxRetries
    );

    // Check 1: CBO budget conflict
    // Meta doesn't allow budgets at both campaign and ad set level
    const campaignHasBudget = campaign.daily_budget || campaign.lifetime_budget;
    if (campaignHasBudget && (options.dailyBudget !== undefined || options.lifetimeBudget !== undefined)) {
      return {
        ...baseResult,
        status: 'failed',
        error: `Budget conflict: campaign '${options.campaignId}' already has a budget (CBO mode). Meta does not allow budgets at both campaign and ad set level. Remove dailyBudget/lifetimeBudget from your ad set — it will automatically use the campaign budget.`,
      };
    }

    // Check 2: Campaign's bid strategy requires bid_amount on ad set
    const campaignBidStrategy = campaign.bid_strategy;
    if (campaignBidStrategy && STRATEGIES_REQUIRING_BID_AMOUNT.includes(campaignBidStrategy)) {
      if (options.bidAmount === undefined) {
        return {
          ...baseResult,
          status: 'failed',
          error: `bidAmount is required because the parent campaign uses bid_strategy '${campaignBidStrategy}'. Add bidAmount (in account currency cents) to your ad set, or change the campaign's bid_strategy to 'LOWEST_COST_WITHOUT_CAP'.`,
        };
      }
      // Auto-set bid_strategy to match campaign if user only provided bidAmount
      if (options.bidStrategy === undefined) {
        preview.bid_strategy = campaignBidStrategy;
      }
    }
  } catch (error) {
    // If pre-flight check fails (e.g., campaign not found), let the main call proceed
    // Meta will return its own error
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
    // Try to extract subcode for better error message
    let errorMsg = error instanceof Error ? error.message : String(error);
    if (error instanceof MetaApiError) {
      const mapped = mapSubcodeError(error.subcode, preview.bid_strategy as string | undefined);
      if (mapped) {
        errorMsg = `${mapped} (Meta error: ${errorMsg})`;
      }
    }
    return {
      ...baseResult,
      status: 'failed',
      error: errorMsg,
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
  };

  // Only send bid_strategy if user explicitly specified it
  // Otherwise let Meta inherit from the campaign
  if (options.bidStrategy !== undefined) {
    payload.bid_strategy = options.bidStrategy;
  }

  // Send bid_amount if provided
  if (options.bidAmount !== undefined) {
    payload.bid_amount = options.bidAmount;
  }

  // Send bid_constraints if provided (for LOWEST_COST_WITH_MIN_ROAS)
  if (options.bidConstraints !== undefined) {
    payload.bid_constraints = options.bidConstraints;
  }

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

  // New fields
  if (options.destinationType) {
    payload.destination_type = options.destinationType;
  }

  if (options.attributionSpec) {
    payload.attribution_spec = options.attributionSpec;
  }

  if (options.frequencyControlSpecs) {
    payload.frequency_control_specs = options.frequencyControlSpecs;
  }

  if (options.isDynamicCreative !== undefined) {
    payload.is_dynamic_creative = options.isDynamicCreative;
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

  // Meta API v24+ requires targeting_automation.advantage_audience
  // Default to 0 (disabled) when user provides custom targeting
  if (!('targeting_automation' in result)) {
    result.targeting_automation = { advantage_audience: 0 };
  }

  return result;
}
