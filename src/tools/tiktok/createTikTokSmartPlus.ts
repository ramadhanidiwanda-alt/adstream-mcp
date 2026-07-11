import type { TikTokApiClient } from '../../tiktokClient.js';

// ── Smart Plus Campaign ──

export interface CreateSmartPlusCampaignOptions {
  advertiserId: string;
  campaignName: string;
  objectiveType: string;
  budget: number;
  budgetMode?: string;
  operationStatus?: string;
}

export interface UpdateSmartPlusCampaignOptions {
  advertiserId: string;
  campaignId: string;
  campaignName?: string;
  budget?: number;
  budgetMode?: string;
}

export interface SmartPlusCampaignResult {
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
}

export interface SmartPlusCampaignStatusOptions {
  advertiserId: string;
  campaignId: string;
  status: 'ENABLE' | 'DISABLE';
}

// ── Smart Plus Ad Group ──

export interface CreateSmartPlusAdGroupOptions {
  advertiserId: string;
  campaignId: string;
  adgroupName: string;
  budget: number;
  budgetMode?: string;
  operationStatus?: string;
  // Smart Plus handles targeting automatically, minimal params needed
  landingPageUrl: string;
  identityId?: string;
  identityType?: string;
}

export interface UpdateSmartPlusAdGroupOptions {
  advertiserId: string;
  adgroupId: string;
  adgroupName?: string;
  budget?: number;
  budgetMode?: string;
}

export interface SmartPlusAdGroupResult {
  adgroup_id?: string;
  adgroup_name?: string;
  status?: string;
}

export interface SmartPlusAdGroupStatusOptions {
  advertiserId: string;
  adgroupId: string;
  status: 'ENABLE' | 'DISABLE' | 'DELETE';
}

// ── Material Report ──

export interface SmartPlusMaterialReviewOptions {
  advertiserId: string;
  materialIds: string[];
}

export interface SmartPlusMaterialReportOptions {
  advertiserId: string;
  campaignId?: string;
  adgroupId?: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  metrics?: string[];
  page?: number;
  pageSize?: number;
}

// ── Tool Functions ──

/**
 * Create a Smart Plus campaign.
 * POST /v1.3/smart_plus/campaign/create/
 */
export async function createSmartPlusCampaign(
  client: TikTokApiClient,
  options: CreateSmartPlusCampaignOptions
): Promise<SmartPlusCampaignResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_name: options.campaignName,
    objective_type: options.objectiveType,
    budget: options.budget,
    operation_status: options.operationStatus ?? 'ENABLE',
  };

  if (options.budgetMode) body.budget_mode = options.budgetMode;

  return client.post<SmartPlusCampaignResult>('/smart_plus/campaign/create/', body);
}

/**
 * Update a Smart Plus campaign.
 * POST /v1.3/smart_plus/campaign/update/
 */
export async function updateSmartPlusCampaign(
  client: TikTokApiClient,
  options: UpdateSmartPlusCampaignOptions
): Promise<SmartPlusCampaignResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
  };

  if (options.campaignName) body.campaign_name = options.campaignName;
  if (options.budget !== undefined) body.budget = options.budget;
  if (options.budgetMode) body.budget_mode = options.budgetMode;

  return client.post<SmartPlusCampaignResult>('/smart_plus/campaign/update/', body);
}

/**
 * Update Smart Plus campaign status.
 * POST /v1.3/smart_plus/campaign/status/update/
 */
export async function updateSmartPlusCampaignStatus(
  client: TikTokApiClient,
  options: SmartPlusCampaignStatusOptions
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/smart_plus/campaign/status/update/', {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
    status: options.status,
  });
}

/**
 * Get Smart Plus campaign info.
 * GET /v1.3/smart_plus/campaign/get/
 */
export async function getSmartPlusCampaign(
  client: TikTokApiClient,
  options: { advertiserId: string; campaignIds?: string[] }
): Promise<SmartPlusCampaignResult[]> {
  const params: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
  };
  if (options.campaignIds) params.campaign_ids = JSON.stringify(options.campaignIds);

  return client.get<{ list: SmartPlusCampaignResult[] }>('/smart_plus/campaign/get/', params)
    .then(r => r.list ?? []);
}

/**
 * Create a Smart Plus ad group.
 * POST /v1.3/smart_plus/adgroup/create/
 * Smart Plus handles targeting, creatives, and placement automatically.
 */
export async function createSmartPlusAdGroup(
  client: TikTokApiClient,
  options: CreateSmartPlusAdGroupOptions
): Promise<SmartPlusAdGroupResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
    adgroup_name: options.adgroupName,
    budget: options.budget,
    operation_status: options.operationStatus ?? 'ENABLE',
  };

  if (options.budgetMode) body.budget_mode = options.budgetMode;
  if (options.landingPageUrl) body.landing_page_url = options.landingPageUrl;
  if (options.identityId) body.identity_id = options.identityId;
  if (options.identityType) body.identity_type = options.identityType;

  return client.post<SmartPlusAdGroupResult>('/smart_plus/adgroup/create/', body);
}

/**
 * Update a Smart Plus ad group.
 * POST /v1.3/smart_plus/adgroup/update/
 */
export async function updateSmartPlusAdGroup(
  client: TikTokApiClient,
  options: UpdateSmartPlusAdGroupOptions
): Promise<SmartPlusAdGroupResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    adgroup_id: options.adgroupId,
  };

  if (options.adgroupName) body.adgroup_name = options.adgroupName;
  if (options.budget !== undefined) body.budget = options.budget;
  if (options.budgetMode) body.budget_mode = options.budgetMode;

  return client.post<SmartPlusAdGroupResult>('/smart_plus/adgroup/update/', body);
}

/**
 * Update Smart Plus ad group status.
 * POST /v1.3/smart_plus/adgroup/status/update/
 */
export async function updateSmartPlusAdGroupStatus(
  client: TikTokApiClient,
  options: SmartPlusAdGroupStatusOptions
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/smart_plus/adgroup/status/update/', {
    advertiser_id: options.advertiserId,
    adgroup_id: options.adgroupId,
    status: options.status,
  });
}

/**
 * Get review info for Smart Plus materials.
 * GET /v1.3/smart_plus/material/review_info/
 */
export async function getSmartPlusMaterialReview(
  client: TikTokApiClient,
  options: SmartPlusMaterialReviewOptions
): Promise<Record<string, unknown>> {
  return client.get<Record<string, unknown>>('/smart_plus/material/review_info/', {
    advertiser_id: options.advertiserId,
    material_ids: JSON.stringify(options.materialIds),
  });
}
