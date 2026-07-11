import type { TikTokApiClient } from '../../tiktokClient.js';

// ── Creative Material ──

export interface CreativeMaterial {
  video_id?: string;
  image_id?: string;
  title: string;
  call_to_action: string;
  landing_page_url: string;
  ad_format?: string;
  creative_type?: string;
  deeplink?: string;
  open_type?: string;
  click_tracking_url?: string;
  impression_tracking_url?: string;
  playlist_id?: string;
}

export interface AdCreative {
  creative_name: string;
  creative_material: CreativeMaterial;
  creative_type?: string;
  ad_format?: string;
  creative_authorized_bc_id?: string;
  identity_id?: string;
  identity_type?: string;
}

// ── Options ──

export interface CreateTikTokAdOptions {
  advertiserId: string;
  adgroupId: string;
  adName: string;
  creatives: AdCreative[];
  adFormat?: string;
  creativeMaterialMode?: string;
  displayMode?: string;
  operationStatus?: string;
}

export interface TikTokAdResult {
  ad_id?: string;
  ad_name?: string;
  status?: string;
}

export interface TikTokAdStatusOptions {
  advertiserId: string;
  adId: string;
  status: 'ENABLE' | 'DISABLE' | 'DELETE';
}

// ── Tool Functions ──

/**
 * Create a TikTok ad.
 * POST /v1.3/ad/create/
 */
export async function createTikTokAd(
  client: TikTokApiClient,
  options: CreateTikTokAdOptions
): Promise<TikTokAdResult> {
  const body: Record<string, unknown> = {
    advertiser_id: options.advertiserId,
    adgroup_id: options.adgroupId,
    ad_name: options.adName,
    creatives: options.creatives.map(normalizeCreative),
    operation_status: options.operationStatus ?? 'ENABLE',
  };

  if (options.adFormat) body.ad_format = options.adFormat;
  if (options.creativeMaterialMode) body.creative_material_mode = options.creativeMaterialMode;
  if (options.displayMode) body.display_mode = options.displayMode;

  return client.post<TikTokAdResult>('/ad/create/', body);
}

/**
 * Update TikTok ad status.
 * POST /v1.3/ad/status/update/
 */
export async function updateTikTokAdStatus(
  client: TikTokApiClient,
  options: TikTokAdStatusOptions
): Promise<Record<string, unknown>> {
  return client.post<Record<string, unknown>>('/ad/status/update/', {
    advertiser_id: options.advertiserId,
    ad_id: options.adId,
    status: options.status,
  });
}

// ── Helpers ──

function normalizeCreative(c: AdCreative): Record<string, unknown> {
  const creative: Record<string, unknown> = {
    creative_name: c.creative_name,
    creative_material: {
      title: c.creative_material.title,
      call_to_action: c.creative_material.call_to_action,
      landing_page_url: c.creative_material.landing_page_url,
    },
  };

  if (c.creative_material.video_id) {
    (creative.creative_material as Record<string, unknown>).video_id = c.creative_material.video_id;
  }
  if (c.creative_material.image_id) {
    (creative.creative_material as Record<string, unknown>).image_id = c.creative_material.image_id;
  }
  if (c.creative_material.ad_format) creative.ad_format = c.creative_material.ad_format;
  if (c.creative_material.deeplink) {
    (creative.creative_material as Record<string, unknown>).deeplink = c.creative_material.deeplink;
  }
  if (c.creative_material.open_type) {
    (creative.creative_material as Record<string, unknown>).open_type = c.creative_material.open_type;
  }
  if (c.creative_material.click_tracking_url) {
    (creative.creative_material as Record<string, unknown>).click_tracking_url = c.creative_material.click_tracking_url;
  }
  if (c.creative_material.impression_tracking_url) {
    (creative.creative_material as Record<string, unknown>).impression_tracking_url = c.creative_material.impression_tracking_url;
  }
  if (c.creative_material.playlist_id) {
    (creative.creative_material as Record<string, unknown>).playlist_id = c.creative_material.playlist_id;
  }
  if (c.creative_type) creative.creative_type = c.creative_type;
  if (c.ad_format) creative.ad_format = c.ad_format;
  if (c.creative_authorized_bc_id) creative.creative_authorized_bc_id = c.creative_authorized_bc_id;
  if (c.identity_id) creative.identity_id = c.identity_id;
  if (c.identity_type) creative.identity_type = c.identity_type;

  return creative;
}
