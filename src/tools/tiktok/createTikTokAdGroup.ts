import type { TikTokApiClient } from '../../tiktokClient.js';

// ── Payloads ──

export interface TargetingObject {
  age_groups?: string[];
  audience_ids?: string[];
  audience_rule?: Record<string, unknown>;
  carrier_ids?: string[];
  device_model_ids?: string[];
  device_price_ranges?: number[];
  excluded_audience_ids?: string[];
  excluded_custom_actions?: Array<{ action_type: string }>;
  excluded_pangle_audience_package_ids?: string[];
  gender?: string;
  household_income?: string[];
  interest_category_ids?: string[];
  interest_keyword_ids?: string[];
  isp_ids?: string[];
  languages?: string[];
  location_ids?: string[];
  min_android_version?: string;
  min_ios_version?: string;
  network_types?: string[];
  operating_systems?: string[];
}

export interface CreateTikTokAdGroupOptions {
  advertiserId: string;
  campaignId: string;
  adgroupName: string;
  budgetMode: string;
  budget: number;
  bidType: string;
  bidPrice: number;
  optimizationGoal: string;
  billingEvent: string;
  placementType: string;
  operationStatus?: string;
  targeting?: TargetingObject;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  creativeMaterialMode?: string;
  conversionBidPrice?: number;
  frequency?: number;
  frequencySchedule?: number;
  dayparting?: string;
  identityType?: string;
  identityId?: string;
}

export interface TikTokAdGroupResult {
  adgroup_id?: string;
  adgroup_name?: string;
  status?: string;
}

export interface TikTokAdGroupStatusOptions {
  advertiserId: string;
  adgroupId: string;
  status: 'ENABLE' | 'DISABLE' | 'DELETE';
}

export interface TikTokAdGroupBudgetOptions {
  advertiserId: string;
  adgroupId: string;
  budget: number;
  budgetMode?: string;
}

// ── Tool Functions ──

/**
 * Create a TikTok ad group.
 * POST /v1.3/adgroup/create/
 */
export async function createTikTokAdGroup(
  client: TikTokApiClient,
  options: CreateTikTokAdGroupOptions
): Promise<TikTokAdGroupResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
    adgroup_name: options.adgroupName,
    budget_mode: options.budgetMode,
    budget: options.budget,
    bid_type: options.bidType,
    bid_price: options.bidPrice,
    optimization_goal: options.optimizationGoal,
    billing_event: options.billingEvent,
    operation_status: options.operationStatus ?? 'ENABLE',
  };

  // Placements
  body.placement_type = options.placementType;
  if (options.placementType !== 'PLACEMENT_TYPE_AUTO' && options.targeting) {
    body.targeting = buildTargeting(options.targeting);
  }

  if (options.scheduleStartTime) body.schedule_start_time = options.scheduleStartTime;
  if (options.scheduleEndTime) body.schedule_end_time = options.scheduleEndTime;
  if (options.creativeMaterialMode) body.creative_material_mode = options.creativeMaterialMode;
  if (options.conversionBidPrice !== undefined) body.conversion_bid_price = options.conversionBidPrice;
  if (options.frequency !== undefined) body.frequency = options.frequency;
  if (options.frequencySchedule !== undefined) body.frequency_schedule = options.frequencySchedule;
  if (options.dayparting) body.dayparting = options.dayparting;
  if (options.identityType) body.identity_type = options.identityType;
  if (options.identityId) body.identity_id = options.identityId;

  return client.post<TikTokAdGroupResult>('/adgroup/create/', body);
}

/**
 * Update TikTok ad group status.
 * POST /v1.3/adgroup/status/update/
 */
export async function updateTikTokAdGroupStatus(
  client: TikTokApiClient,
  options: TikTokAdGroupStatusOptions
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/adgroup/status/update/', {
    advertiser_id: options.advertiserId,
    adgroup_id: options.adgroupId,
    status: options.status,
  });
}

/**
 * Update TikTok ad group budget.
 * POST /v1.3/adgroup/budget/update/
 */
export async function updateTikTokAdGroupBudget(
  client: TikTokApiClient,
  options: TikTokAdGroupBudgetOptions
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/adgroup/budget/update/', {
    advertiser_id: options.advertiserId,
    adgroup_id: options.adgroupId,
    budget: options.budget,
    budget_mode: options.budgetMode,
  });
}

// ── Helpers ──

function buildTargeting(t: TargetingObject): Record<string, unknown> {
  const targeting: Record<string, unknown> = {};

  if (t.age_groups) targeting.age_groups = t.age_groups;
  if (t.audience_ids) targeting.audience_ids = t.audience_ids;
  if (t.audience_rule) targeting.audience_rule = t.audience_rule;
  if (t.carrier_ids) targeting.carrier_ids = t.carrier_ids;
  if (t.device_model_ids) targeting.device_model_ids = t.device_model_ids;
  if (t.device_price_ranges) targeting.device_price_ranges = t.device_price_ranges;
  if (t.excluded_audience_ids) targeting.excluded_audience_ids = t.excluded_audience_ids;
  if (t.excluded_custom_actions) targeting.excluded_custom_actions = t.excluded_custom_actions;
  if (t.excluded_pangle_audience_package_ids) targeting.excluded_pangle_audience_package_ids = t.excluded_pangle_audience_package_ids;
  if (t.gender) targeting.gender = t.gender;
  if (t.household_income) targeting.household_income = t.household_income;
  if (t.interest_category_ids) targeting.interest_category_ids = t.interest_category_ids;
  if (t.interest_keyword_ids) targeting.interest_keyword_ids = t.interest_keyword_ids;
  if (t.isp_ids) targeting.isp_ids = t.isp_ids;
  if (t.languages) targeting.languages = t.languages;
  if (t.location_ids) targeting.location_ids = t.location_ids;
  if (t.min_android_version) targeting.min_android_version = t.min_android_version;
  if (t.min_ios_version) targeting.min_ios_version = t.min_ios_version;
  if (t.network_types) targeting.network_types = t.network_types;
  if (t.operating_systems) targeting.operating_systems = t.operating_systems;

  return targeting;
}
