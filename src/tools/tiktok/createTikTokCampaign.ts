import type { TikTokApiClient } from '../../tiktokClient.js';

// ── Payloads ──

export interface CreateTikTokCampaignOptions {
  advertiserId: string;
  campaignName: string;
  campaignType: string;
  objectiveType: string;
  budgetMode: string;
  budget: number;
  bidType?: string;
  operationStatus?: string;
  budgetOptimizeOn?: boolean;
  specialIndustries?: string[];
}

export interface UpdateTikTokCampaignOptions {
  advertiserId: string;
  campaignId: string;
  campaignName?: string;
  budget?: number;
  budgetMode?: string;
}

export interface TikTokCampaignStatusOptions {
  advertiserId: string;
  campaignId: string;
  status: 'ENABLE' | 'DISABLE' | 'DELETE';
}

export interface TikTokCampaignResult {
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
}

// ── Tool Functions ──

/**
 * Create a TikTok campaign.
 * POST /v1.3/campaign/create/
 */
export async function createTikTokCampaign(
  client: TikTokApiClient,
  options: CreateTikTokCampaignOptions
): Promise<TikTokCampaignResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_name: options.campaignName,
    campaign_type: options.campaignType,
    objective_type: options.objectiveType,
    budget_mode: options.budgetMode,
    budget: options.budget,
    operation_status: options.operationStatus ?? 'ENABLE',
  };

  if (options.bidType) body.bid_type = options.bidType;
  if (options.budgetOptimizeOn !== undefined) body.budget_optimize_on = options.budgetOptimizeOn;
  if (options.specialIndustries) body.special_industries = options.specialIndustries;

  return client.post<TikTokCampaignResult>('/campaign/create/', body);
}

/**
 * Update a TikTok campaign (name, budget).
 * POST /v1.3/campaign/update/
 */
export async function updateTikTokCampaign(
  client: TikTokApiClient,
  options: UpdateTikTokCampaignOptions
): Promise<TikTokCampaignResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
  };

  if (options.campaignName) body.campaign_name = options.campaignName;
  if (options.budget !== undefined) body.budget = options.budget;
  if (options.budgetMode) body.budget_mode = options.budgetMode;

  return client.post<TikTokCampaignResult>('/campaign/update/', body);
}

/**
 * Update TikTok campaign status (ENABLE / DISABLE / DELETE).
 * POST /v1.3/campaign/status/update/
 */
export async function updateTikTokCampaignStatus(
  client: TikTokApiClient,
  options: TikTokCampaignStatusOptions
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/campaign/status/update/', {
    advertiser_id: options.advertiserId,
    campaign_id: options.campaignId,
    status: options.status,
  });
}
