import type { TikTokApiClient } from '../../tiktokClient.js';

// ── GMV Max Campaign ──

export interface CreateGmvMaxCampaignOptions {
  advertiserId: string;
  campaignName: string;
  objectiveType: string;
  storeIds: string[];
  budget?: number;
  budgetMode?: string;
  scheduleType?: string;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  bidType?: string;
  operationStatus?: string;
}

export interface UpdateGmvMaxCampaignOptions {
  advertiserId: string;
  campaignId: string;
  campaignName?: string;
  budget?: number;
  budgetMode?: string;
  operationStatus?: string;
}

export interface GmvMaxCampaignResult {
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
}

// ── GMV Max Session ──

export interface CreateGmvMaxSessionOptions {
  advertiserId: string;
  campaignId: string;
  sessionName: string;
  sessionType?: string;
  sessionBudget?: number;
  budgetMode?: string;
  startTime: string;
  endTime: string;
  productIds?: string[];
  storeId?: string;
}

export interface UpdateGmvMaxSessionOptions {
  advertiserId: string;
  sessionId: string;
  sessionName?: string;
  sessionBudget?: number;
  budgetMode?: string;
  startTime?: string;
  endTime?: string;
}

export interface GmvMaxSessionResult {
  session_id?: string;
  session_name?: string;
  status?: string;
}

export interface GmvMaxBidRecommendOptions {
  advertiserId: string;
  campaignId: string;
  storeIds: string[];
}

// ── Tool Functions ──

/**
 * Create a GMV Max campaign.
 * POST /v1.3/campaign/gmv_max/create/
 */
export async function createGmvMaxCampaign(
  client: TikTokApiClient,
  options: CreateGmvMaxCampaignOptions
): Promise<GmvMaxCampaignResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_name: options.campaignName,
    objective_type: options.objectiveType,
    store_ids: options.storeIds,
    operation_status: options.operationStatus ?? 'ENABLE',
  };

  if (options.budget !== undefined) body.budget = options.budget;
  if (options.budgetMode) body.budget_mode = options.budgetMode;
  if (options.scheduleType) body.schedule_type = options.scheduleType;
  if (options.scheduleStartTime) body.schedule_start_time = options.scheduleStartTime;
  if (options.scheduleEndTime) body.schedule_end_time = options.scheduleEndTime;
  if (options.bidType) body.bid_type = options.bidType;

  return client.post<GmvMaxCampaignResult>('/campaign/gmv_max/create/', body);
}

/**
 * Update a GMV Max campaign.
 * POST /v1.3/campaign/gmv_max/update/
 */
export async function updateGmvMaxCampaign(
  client: TikTokApiClient,
  options: UpdateGmvMaxCampaignOptions
): Promise<GmvMaxCampaignResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
  };

  if (options.campaignName) body.campaign_name = options.campaignName;
  if (options.budget !== undefined) body.budget = options.budget;
  if (options.budgetMode) body.budget_mode = options.budgetMode;
  if (options.operationStatus) body.operation_status = options.operationStatus;

  return client.post<GmvMaxCampaignResult>('/campaign/gmv_max/update/', body);
}

/**
 * Create a GMV Max session (live session / sale event).
 * POST /v1.3/campaign/gmv_max/session/create/
 */
export async function createGmvMaxSession(
  client: TikTokApiClient,
  options: CreateGmvMaxSessionOptions
): Promise<GmvMaxSessionResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
    session_name: options.sessionName,
    start_time: options.startTime,
    end_time: options.endTime,
  };

  if (options.sessionType) body.session_type = options.sessionType;
  if (options.sessionBudget !== undefined) body.session_budget = options.sessionBudget;
  if (options.budgetMode) body.budget_mode = options.budgetMode;
  if (options.productIds) body.product_ids = options.productIds;
  if (options.storeId) body.store_id = options.storeId;

  return client.post<GmvMaxSessionResult>('/campaign/gmv_max/session/create/', body);
}

/**
 * Update a GMV Max session.
 * POST /v1.3/campaign/gmv_max/session/update/
 */
export async function updateGmvMaxSession(
  client: TikTokApiClient,
  options: UpdateGmvMaxSessionOptions
): Promise<GmvMaxSessionResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    session_id: options.sessionId,
  };

  if (options.sessionName) body.session_name = options.sessionName;
  if (options.sessionBudget !== undefined) body.session_budget = options.sessionBudget;
  if (options.budgetMode) body.budget_mode = options.budgetMode;
  if (options.startTime) body.start_time = options.startTime;
  if (options.endTime) body.end_time = options.endTime;

  return client.post<GmvMaxSessionResult>('/campaign/gmv_max/session/update/', body);
}

/**
 * Delete a GMV Max session.
 * POST /v1.3/campaign/gmv_max/session/delete/
 */
export async function deleteGmvMaxSession(
  client: TikTokApiClient,
  options: { advertiserId: string; sessionId: string }
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/campaign/gmv_max/session/delete/', {
    advertiser_id: options.advertiserId,
    session_id: options.sessionId,
  });
}

/**
 * Get GMV Max campaign info.
 * GET /v1.3/campaign/gmv_max/info/
 */
export async function getGmvMaxCampaignInfo(
  client: TikTokApiClient,
  options: { advertiserId: string; campaignIds: string[] }
): Promise<GmvMaxCampaignResult[]> {
  return client.get<{ list: GmvMaxCampaignResult[] }>('/campaign/gmv_max/info/', {
    advertiser_id: options.advertiserId,
    campaign_ids: JSON.stringify(options.campaignIds),
  }).then(r => r.list ?? []);
}

/**
 * Get bid recommendation for a GMV Max campaign.
 * POST /v1.3/gmv_max/bid/recommend/
 */
export async function getGmvMaxBidRecommend(
  client: TikTokApiClient,
  options: GmvMaxBidRecommendOptions
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/gmv_max/bid/recommend/', {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
    store_ids: options.storeIds,
  });
}
