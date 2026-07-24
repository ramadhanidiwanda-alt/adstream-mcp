import type { AdsBroker } from './AdsBroker.js';
import type {
  AdsBrokerRequest,
  AdsBrokerResponse,
  AdsEntityLevel,
  AdsMetricRecord,
  AdsMutationResult,
  AdsPerformanceEnvelope,
  AdsProviderId,
  AdDestinationResult,
  ArchiveAdResult,
  CreateAdCreativeResult,
  CreateAdResult,
  CreateAdSetResult,
  CreateCampaignResult,
  GetTargetingOptionsResult,
  UpdateAdSetResult,
  UpdateAdResult,
  UpdateCampaignResult,
} from './types.js';
import {
  ADS_ENTITY_LEVELS,
  ADS_FILTER_OPERATORS,
  ADS_PROVIDER_IDS,
  isAdsProviderId,
} from './types.js';
import { redactErrorMessage, redactTokenLikeValues } from './credentials.js';
import { LOCATION_BREAKDOWNS, META_CREATIVE_FORMATS } from '../types.js';
import {
  META_CONVERSION_LOCATIONS,
  META_ODAX_OBJECTIVES,
} from '../providers/meta/objectiveLaunchMatrix.js';
import { META_LAUNCH_WORKFLOW_INPUT_VALUES } from '../tools/checkLaunchReadiness.js';

export const ADS_MCP_TOOL_NAMES = [
  'ads_list_accounts',
  'ads_list_campaigns',
  'ads_check_launch_readiness',
  'ads_get_performance',
  'ads_get_creatives',
  'ads_get_change_history',
  'ads_get_capabilities',
  'ads_get_account_performance',
  'ads_get_campaign_performance',
  'ads_get_adset_or_adgroup_performance',
  'ads_get_ad_performance',
  'ads_get_creative_performance',
  'ads_get_placement_performance',
  'ads_content_matrix',
  'ads_generate_report',
  'ads_pause_campaign',
  'ads_resume_campaign',
  'ads_pause_adset',
  'ads_resume_adset',
  'ads_pause_ad',
  'ads_resume_ad',
  'ads_update_campaign_budget',
  'ads_rename_campaign',
  'ads_create_campaign',
  'ads_create_adset',
  'ads_create_adcreative',
  'ads_create_ad',
  'ads_clone_ui_ad',
  'ads_archive_ad',
  'ads_update_adset',
  'ads_update_ad',
  'ads_update_campaign',
  'ads_clone_adset',
  'ads_get_targeting_options',
  'ads_create_ecommerce_campaign_bundle',
  'ads_get_video_source',
  'ads_get_ad_creative_mapping',
  'ads_upload_image',
  'ads_upload_video',
  'ads_get_account_info',
  'ads_list_adimages',
  'ads_list_advideos',
  'ads_get_ad_preview',
  'ads_get_ad_destinations',
  'ads_read_creative_full',
  'ads_read_adset_full',
  'ads_list_pages',
  'ads_list_instagram_accounts',
  'ads_list_instagram_media',
  'ads_list_threads_profiles',
  'ads_list_pixels',
  'ads_list_catalogs',
  'ads_list_product_sets',
  // --- WhatsApp Discovery ---
  'ads_list_whatsapp_accounts',
  'ads_list_whatsapp_phone_numbers',
  'ads_list_whatsapp_message_templates',
  // --- TikTok GMV Max ---
  'tiktok_gmv_max_create_campaign',
  'tiktok_gmv_max_update_campaign',
  'tiktok_gmv_max_create_session',
  'tiktok_gmv_max_update_session',
  'tiktok_gmv_max_delete_session',
  'tiktok_gmv_max_get_campaign_info',
  // --- TikTok Smart Plus ---
  'tiktok_smart_plus_create_campaign',
  'tiktok_smart_plus_pause_campaign',
  'tiktok_smart_plus_resume_campaign',
  'tiktok_smart_plus_create_adgroup',
  'tiktok_smart_plus_pause_adgroup',
  'tiktok_smart_plus_resume_adgroup',
] as const;

export type AdsMcpToolName = (typeof ADS_MCP_TOOL_NAMES)[number];

export interface AdsMcpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

const DESTRUCTIVE_WRITE_TOOLS = new Set<AdsMcpToolName>([
  'ads_pause_campaign',
  'ads_pause_adset',
  'ads_pause_ad',
  'ads_update_campaign_budget',
  'ads_archive_ad',
  'ads_update_adset',
  'ads_update_ad',
  'ads_update_campaign',
  'tiktok_gmv_max_delete_session',
  'tiktok_gmv_max_update_campaign',
  'tiktok_gmv_max_update_session',
  'tiktok_smart_plus_pause_campaign',
  'tiktok_smart_plus_pause_adgroup',
]);

const ADDITIVE_WRITE_TOOLS = new Set<AdsMcpToolName>([
  'ads_create_campaign',
  'ads_create_adset',
  'ads_create_adcreative',
  'ads_create_ad',
  'ads_clone_ui_ad',
  'ads_create_ecommerce_campaign_bundle',
  'ads_clone_adset',
  'ads_upload_image',
  'ads_upload_video',
  'ads_rename_campaign',
  'ads_resume_campaign',
  'ads_resume_adset',
  'ads_resume_ad',
  'tiktok_gmv_max_create_campaign',
  'tiktok_gmv_max_create_session',
  'tiktok_smart_plus_create_campaign',
  'tiktok_smart_plus_create_adgroup',
  'tiktok_smart_plus_resume_campaign',
  'tiktok_smart_plus_resume_adgroup',
]);

export function getAdsMcpToolAnnotations(name: AdsMcpToolName): AdsMcpToolAnnotations {
  const readOnly = !isAdsMcpWriteTool(name);

  if (readOnly) {
    return {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    };
  }

  return {
    readOnlyHint: false,
    destructiveHint: DESTRUCTIVE_WRITE_TOOLS.has(name),
    idempotentHint: false,
    openWorldHint: true,
  };
}

export function isAdsMcpWriteTool(name: AdsMcpToolName): boolean {
  return DESTRUCTIVE_WRITE_TOOLS.has(name) || ADDITIVE_WRITE_TOOLS.has(name);
}

export const ADS_WRITE_TOOLS_ENABLE_FLAG = 'ADSTREAM_ENABLE_WRITES';

export function areAdsWriteToolsEnabled(): boolean {
  return process.env[ADS_WRITE_TOOLS_ENABLE_FLAG] === 'true';
}

/**
 * Separate, narrower kill switch than ADSTREAM_ENABLE_WRITES. Meta treats
 * ARCHIVED and DELETED as equally permanent since Oct 2014 (neither can be
 * reverted via the API — they only differ in query/quota behavior), so both
 * are gated here regardless of which status string is used.
 */
export const ADS_DESTRUCTIVE_ACTIONS_ENABLE_FLAG = 'ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS';

export function areAdsDestructiveActionsEnabled(): boolean {
  return process.env[ADS_DESTRUCTIVE_ACTIONS_ENABLE_FLAG] === 'true';
}

const IRREVERSIBLE_STATUS_TOOLS: Partial<Record<AdsMcpToolName, ReadonlySet<string>>> = {
  ads_update_ad: new Set(['ARCHIVED']),
  ads_update_campaign: new Set(['ARCHIVED', 'DELETED']),
};

export function isIrreversibleAdsCall(
  name: AdsMcpToolName,
  args: Record<string, unknown>
): boolean {
  if (name === 'ads_archive_ad') return true;

  const irreversibleStatuses = IRREVERSIBLE_STATUS_TOOLS[name];
  return irreversibleStatuses !== undefined && irreversibleStatuses.has(args.status as string);
}

export function getAdsMcpToolDefinitions(options: { includeWrites?: boolean } = {}) {
  return ADS_MCP_TOOL_DEFINITIONS.filter(
    (tool) => options.includeWrites === true || !isAdsMcpWriteTool(tool.name)
  );
}

export const ADS_MCP_TOOL_DEFINITIONS = [
  {
    name: 'ads_list_accounts',
    description: 'List ads accounts through the AdsBroker',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_campaigns',
    description: 'List campaigns under an ad account through the AdsBroker',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_check_launch_readiness',
    description:
      'Read-only Meta v25 launch checklist. Resolves one of the six ODAX objectives into a canonical workflow, required inputs, and setup spec; it does not perform writes.',
    inputSchema: createLaunchReadinessInputSchema(),
  },
  {
    name: 'ads_get_performance',
    description:
      'Canonical read tool for normalized ads performance. Use level, metrics, dimensions, breakdowns, filters, sorting, limit, and cursor instead of report-specific tools.',
    inputSchema: createPerformanceInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_creatives',
    description:
      'Canonical read tool for creative metadata and creative-level metrics. Returns the standard performance envelope with level creative. For Meta setup checks, pass params.complianceAudit=true to audit active ads with their Ad Set placements.',
    inputSchema: createPerformanceInputSchema([]),
  },
  {
    name: 'ads_get_change_history',
    description:
      'Canonical read-only change history tool. Meta returns a structured empty-compatible envelope; unsupported providers return NOT_IMPLEMENTED.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_capabilities',
    description:
      'Discover canonical ads tool capabilities, supported providers, levels, metrics, breakdowns, and optional write tools.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_account_performance',
    description:
      'Legacy alias: fetch normalized account-level performance. Prefer ads_get_performance with level account for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_campaign_performance',
    description:
      'Legacy alias: fetch normalized campaign performance. Prefer ads_get_performance with level campaign for new clients. Optional params.campaignId (string or string[]) restricts results to specific campaign(s) server-side.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_adset_or_adgroup_performance',
    description:
      'Legacy alias: fetch normalized ad set or ad group performance. Prefer ads_get_performance with level adset or adgroup for new clients. Optional params.campaignId and params.adsetId (each string or string[]) restrict results server-side.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_ad_performance',
    description:
      'Legacy alias: fetch normalized ad performance. Prefer ads_get_performance with level ad for new clients. Optional params.campaignId, params.adsetId, and params.adId (each string or string[]) restrict results server-side.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_creative_performance',
    description:
      'Legacy alias: fetch normalized creative performance. Prefer ads_get_creatives or ads_get_performance with level creative for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_placement_performance',
    description:
      'Legacy alias: fetch platform and placement performance. Prefer ads_get_performance with placement breakdowns for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_content_matrix',
    description:
      'Legacy skill-owned workflow: return data-only ad/creative performance matrix grouped by campaign or adset. Prefer skill workflows over ads_get_performance and ads_get_creatives for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_generate_report',
    description:
      'Legacy skill-owned workflow: generate an ads report through the AdsBroker. Prefer AI/skill report workflows over canonical data tools for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_pause_campaign',
    description:
      'Pause a campaign. Returns success/error. Use with caution — campaign will stop spending.',
    inputSchema: createWriteInputSchema(['campaignId']),
  },
  {
    name: 'ads_resume_campaign',
    description: 'Resume a paused campaign. Returns success/error.',
    inputSchema: createWriteInputSchema(['campaignId']),
  },
  {
    name: 'ads_update_campaign_budget',
    description:
      "Update a campaign's daily budget (in local currency minor units). Safety guard: rejects increases >200% by default.",
    inputSchema: createWriteInputSchema(['campaignId', 'dailyBudget']),
  },
  {
    name: 'ads_rename_campaign',
    description: 'Rename a campaign. Returns success/error.',
    inputSchema: createWriteInputSchema(['campaignId', 'newName']),
  },
  {
    name: 'ads_create_campaign',
    description:
      'Create a Meta ad campaign with a specified objective. Dry-run by default. Set dryRun=false and confirmed=true to execute. Campaign is created PAUSED by default.',
    inputSchema: createCreateCampaignInputSchema(),
  },
  {
    name: 'ads_create_adset',
    description:
      'Create a Meta ad set under an existing campaign. Dry-run by default. Set dryRun=false and confirmed=true to execute. Ad set is created PAUSED by default.',
    inputSchema: createCreateAdSetInputSchema(),
  },
  {
    name: 'ads_create_adcreative',
    description:
      'Create a Meta ad creative with image/video, headline, body, CTA, or Flexible asset-feed inputs via creativeFormat="flexible" + creativeSpec. Legacy objectStorySpec plus top-level assetFeedSpec tetap diterima untuk kompatibilitas, tapi jangan dipilih sebagai default untuk iklan baru. Gunakan optOutEnhancements untuk disable Advantage+ Creative enhancement. params BUKAN passthrough mentah ke Graph API — hanya field yang terdaftar di schema ini yang dikirim, field lain ditolak dengan error (bukan diabaikan diam-diam). Dry-run by default. Set dryRun=false and confirmed=true to execute.',
    inputSchema: createCreateAdCreativeInputSchema(),
  },
  {
    name: 'ads_create_ad',
    description:
      'Create a Meta ad by linking an existing ad set to an existing creative. Dry-run by default. Set dryRun=false and confirmed=true to execute. Ad is created PAUSED by default.',
    inputSchema: createCreateAdInputSchema(),
  },
  {
    name: 'ads_clone_ui_ad',
    description:
      'Clone a Meta ad by resolving its creative ID and creating a PAUSED ad with source_ad_id plus that creative_id. Use for Ads Manager-created messaging ads where UI-only setup such as WhatsApp phone selection and per-placement creative customizations must be preserved. This tool intentionally does not accept creativeId from callers.',
    inputSchema: createCloneUiAdInputSchema(),
  },
  {
    name: 'ads_archive_ad',
    description:
      'Archive a Meta ad. Sets status to ARCHIVED — permanent and cannot be reverted via the API (Meta treats ARCHIVED the same as DELETED here). Dry-run by default. Set dryRun=false and confirmed=true to execute. Also requires ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS=true.',
    inputSchema: createArchiveAdInputSchema(),
  },
  {
    name: 'ads_pause_ad',
    description: 'Pause a Meta ad (sets status to PAUSED). Reversible with ads_resume_ad.',
    inputSchema: createAdIdInputSchema(),
  },
  {
    name: 'ads_resume_ad',
    description:
      'Resume/activate a paused Meta ad (sets status to ACTIVE). The ad delivers per its ad set schedule and budget once active.',
    inputSchema: createAdIdInputSchema(),
  },
  {
    name: 'ads_pause_adset',
    description:
      'Pause a Meta ad set (sets status to PAUSED). All ads in it stop delivering. Reversible with ads_resume_adset.',
    inputSchema: createAdSetIdInputSchema(),
  },
  {
    name: 'ads_resume_adset',
    description:
      'Resume/activate a paused Meta ad set (sets status to ACTIVE). Ads in it deliver per the ad set schedule and budget once active.',
    inputSchema: createAdSetIdInputSchema(),
  },
  {
    name: 'ads_clone_adset',
    description:
      'Clone an existing Meta ad set into a new one, copying targeting, custom audiences, promoted object (CPAS/omnichannel), attribution, optimization, and bidding from a source ad set. Override name, campaignId, status, startTime, endTime, or budget. Dry-run by default; set dryRun=false and confirmed=true to execute. New ad set defaults to PAUSED.',
    inputSchema: createCloneAdSetInputSchema(),
  },
  {
    name: 'ads_update_adset',
    description:
      'Update an existing Meta ad set (name, budget, targeting, status). Dry-run by default. Set dryRun=false and confirmed=true to execute.',
    inputSchema: createUpdateAdSetInputSchema(),
  },
  {
    name: 'ads_update_ad',
    description:
      'Update an existing Meta ad (name, status, or swap its creative). Use creativeId to point the ad at a different, already-created creative — the standard way to change tracking/UTM parameters on an ad that is already live, since url_tags can only be set when a creative is created. Dry-run by default. Set dryRun=false and confirmed=true to execute.',
    inputSchema: createUpdateAdInputSchema(),
  },
  {
    name: 'ads_update_campaign',
    description:
      "Update an existing Meta campaign (name, status, lifetimeBudget, spendCap, bidStrategy, specialAdCategories, schedule). lifetimeBudget/spendCap reuse the same increase-safety guard as ads_update_campaign_budget. status='DELETED' additionally requires deleteConfirmed=true since deletion is irreversible. Pass adsetBudgets to toggle the campaign between CBO and ABO in place — see its description for the 'include every ad set' requirement. Dry-run by default. Set dryRun=false and confirmed=true to execute.",
    inputSchema: createUpdateCampaignInputSchema(),
  },
  {
    name: 'ads_get_targeting_options',
    description:
      'Search Meta targeting options (interests, behaviors, demographics, work_employers, work_positions) for ad set creation.',
    inputSchema: createGetTargetingOptionsInputSchema(),
  },
  {
    name: 'ads_create_ecommerce_campaign_bundle',
    description:
      'Create a PAUSED Meta ecommerce sales campaign bundle (campaign, ad set, creative, ad) after dry-run preview and explicit confirmation.',
    inputSchema: createEcommerceLaunchInputSchema(),
  },
  {
    name: 'ads_get_video_source',
    description:
      'Get the raw video source URL (MP4), embed HTML, and thumbnail for a Meta video ID. Calls GET /{video_id}?fields=source,embed_html,picture.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_ad_creative_mapping',
    description:
      'Get the creative_id for each ad in an account. Calls GET /act_{id}/ads?fields=id,name,creative{{id}}. Use this to link ad performance data (from ads_get_ad_performance) with creative assets (from ads_get_creative_performance). Accepts optional adIds[] param to filter specific ads.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_upload_image',
    description:
      'Upload a local image file to the Meta Ads Image Library. Returns image_hash for use in creative creation. Supported formats: .jpg, .jpeg, .png. Max file size: 30 MB.',
    inputSchema: createUploadInputSchema(['filePath']),
  },
  {
    name: 'ads_upload_video',
    description:
      'Upload a local video file to the Meta Ads Video Library. Returns video_id for use in creative creation. Supported formats: .mp4, .mov, .avi, .wmv. Max file size: 1 GB. Video processing is async.',
    inputSchema: createUploadInputSchema(['filePath']),
  },
  {
    name: 'ads_get_account_info',
    description:
      'Get detailed information about a Meta Ads account. Returns account name, currency, timezone, balance, spending limit, amount spent, account status, and business info.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_adimages',
    description:
      'List images from the Meta Ads Image Library. Returns image hash, URL, dimensions, name, and creatives count. Calls GET /act_{id}/adimages.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_advideos',
    description:
      'List videos from the Meta Ads Video Library (paginated). Returns video ID, title, source URL, status, file size, and thumbnail. Calls GET /act_{id}/advideos. Supports params: limit, cursor.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_ad_preview',
    description:
      'Get a preview URL for a Meta ad creative in a specific ad format. Returns preview URL, platform, and ad format. Calls GET /{creative_id}/previews. Required params: creativeId, adFormat (enum: DESKTOP_FEED, MOBILE_FEED, INSTAGRAM_FEED, INSTAGRAM_EXPLORE, INSTAGRAM_REELS, INSTAGRAM_STORIES, FACEBOOK_STORIES, MESSENGER_INBOX, MARKETPLACE, REWARDS_PLATFORM, FACEBOOK_REELS).',
    inputSchema: createPreviewInputSchema(),
  },
  {
    name: 'ads_get_ad_destinations',
    description:
      'Get destination URLs from ads with their creative metadata. Fetches ads with object_story_spec and asset_feed_spec, then extracts the destination URL for each creative type (link, video, carousel, Advantage+, existing post). Supports status filtering plus optional params.campaignId and params.adSetId (each string or string[]) to restrict results to a specific campaign/ad set server-side. Calls GET /act_{id}/ads?fields=id,name,status,effective_status,creative{id,object_type,object_story_spec,asset_feed_spec}.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_read_creative_full',
    description:
      'Read the full configuration of a Meta Ad Creative — a reverse engineering tool that returns ALL fields from the /{creative_id}?fields=... Graph API endpoint. Use this to inspect a working ad creative from Meta Ads Manager and see its complete payload (object_story_spec, asset_feed_spec, call_to_action, page_welcome_message, tracking_specs, degrees_of_freedom_spec, etc.). Ideal for reverse engineering new ad features (CTWA, Carousel, DCO, Catalog, Advantage+). Requires creativeId.',
    inputSchema: createReadCreativeFullInputSchema(),
  },
  {
    name: 'ads_read_adset_full',
    description:
      'Read the full configuration of Meta Ad Sets (targeting, custom audiences, budget, bid strategy, optimization goal, placements, schedule). Three modes: pass adsetId for one ad set; pass campaignId for all ad sets in a campaign; pass neither (account only) for all ad sets in the account. List modes support limit and cursor. Read-only. Use this to replicate an existing ad set configuration.',
    inputSchema: createReadAdSetFullInputSchema(),
  },
  {
    name: 'ads_list_pages',
    description:
      'List Meta Pages accessible by the token for selecting a valid pageId for ad creative object_story_spec.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_instagram_accounts',
    description: "List Instagram Business Accounts connected to the user's Facebook Pages.",
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_instagram_media',
    description:
      'List media (feed posts, Reels, carousels) for an Instagram Business Account. Calls GET /{ig-user-id}/media. Requires igUserId (from ads_list_instagram_accounts). Pass permalinkUrls (raw instagram.com/reel or /p URLs pasted by a user) to resolve them into media IDs by matching shortcode — paginates up to 10 pages looking for matches and returns only the matched media, ready to use as sourceInstagramMediaId on an existing_post ad creative.',
    inputSchema: createInstagramMediaInputSchema(),
  },
  {
    name: 'ads_list_threads_profiles',
    description: "List Threads profiles connected to the user's Facebook Pages.",
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_pixels',
    description:
      'List Meta Pixels connected to an ad account. Use before website sales, lead, or CPAS workflows when the user does not know their pixel ID. Calls GET /act_{id}/adspixels.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_catalogs',
    description:
      'List product catalogs owned by a Meta Business. Use before CPAS/catalog sales workflows when the user does not know the catalog ID. Requires businessId.',
    inputSchema: createBusinessIdInputSchema(),
  },
  {
    name: 'ads_list_product_sets',
    description:
      'List product sets inside a Meta product catalog. Use before CPAS/catalog sales workflows when the user does not know the productSetId. Requires catalogId.',
    inputSchema: createCatalogIdInputSchema(),
  },
  {
    name: 'ads_list_whatsapp_accounts',
    description:
      'Discover WhatsApp Business Accounts (WABA) — both owned and client-shared. Calls GET /{businessId}/owned_whatsapp_business_accounts and /{businessId}/client_whatsapp_business_accounts.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_whatsapp_phone_numbers',
    description:
      'List phone numbers associated with a WhatsApp Business Account (WABA). Returns phone_number_id needed for CTWA creative setup. Calls GET /{wabaId}/phone_numbers.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_whatsapp_message_templates',
    description:
      'List WhatsApp message templates for a WABA. Supports filtering by name and status (APPROVED, PENDING, REJECTED). Calls GET /{wabaId}/message_templates.',
    inputSchema: createAdsInputSchema([]),
  },
  // --- TikTok GMV Max ---
  {
    name: 'tiktok_gmv_max_create_campaign',
    description:
      'Create a TikTok GMV Max campaign for Shop sellers. Requires store_ids, objective_type, campaign_name, and budget.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_gmv_max_update_campaign',
    description: 'Update a TikTok GMV Max campaign (name, budget, status).',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_gmv_max_create_session',
    description:
      'Create a GMV Max session (sale event) for an existing GMV Max campaign. Requires session_name, start_time, end_time.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_gmv_max_update_session',
    description: 'Update a GMV Max session (name, budget, time).',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_gmv_max_delete_session',
    description: 'Delete a GMV Max session.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_gmv_max_get_campaign_info',
    description: 'Get detailed info for one or more GMV Max campaigns by campaign_ids.',
    inputSchema: createAdsInputSchema([]),
  },
  // --- TikTok Smart Plus ---
  {
    name: 'tiktok_smart_plus_create_campaign',
    description:
      'Create a TikTok Smart Plus campaign (Advantage+ equivalent). TikTok handles targeting and creatives automatically.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_smart_plus_pause_campaign',
    description: 'Pause a TikTok Smart Plus campaign.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_smart_plus_resume_campaign',
    description: 'Resume a paused TikTok Smart Plus campaign.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_smart_plus_create_adgroup',
    description:
      'Create a TikTok Smart Plus ad group. TikTok handles targeting and creatives automatically.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_smart_plus_pause_adgroup',
    description: 'Pause a TikTok Smart Plus ad group.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_smart_plus_resume_adgroup',
    description: 'Resume a paused TikTok Smart Plus ad group.',
    inputSchema: createAdsInputSchema([]),
  },
] as const;

export function isAdsMcpToolName(name: string): name is AdsMcpToolName {
  return ADS_MCP_TOOL_NAMES.includes(name as AdsMcpToolName);
}

export async function handleAdsMcpToolCall(
  broker: AdsBroker,
  name: AdsMcpToolName,
  args: Record<string, unknown> = {},
  connectionKey?: string
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (isAdsMcpWriteTool(name) && !areAdsWriteToolsEnabled()) {
    return writeToolsDisabledResponse(name);
  }

  if (isIrreversibleAdsCall(name, args) && !areAdsDestructiveActionsEnabled()) {
    return destructiveActionsDisabledResponse(name);
  }

  const request = toAdsBrokerRequest(args, connectionKey);
  const response = await callBrokerMethod(broker, name, request);
  const canonicalResponse = canonicalizeToolResponse(name, request, response);
  const safeResponse = stripRawFromResponse(
    redactTokenLikeValues(canonicalResponse)
  ) as AdsBrokerResponse;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(safeResponse, null, 2),
      },
    ],
    isError: !safeResponse.ok || undefined,
  };
}

function writeToolsDisabledResponse(name: AdsMcpToolName): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  const body = {
    ok: false,
    errors: [
      {
        code: 'WRITE_TOOLS_DISABLED',
        message: `The "${name}" tool changes your ad account, and change tools are turned off right now.`,
        actionableFix: `Turn on change tools by setting ${ADS_WRITE_TOOLS_ENABLE_FLAG}=true, then try again.`,
        enableFlag: ADS_WRITE_TOOLS_ENABLE_FLAG,
      },
    ],
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(body, null, 2),
      },
    ],
    isError: true,
  };
}

function destructiveActionsDisabledResponse(name: AdsMcpToolName): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  const body = {
    ok: false,
    errors: [
      {
        code: 'DESTRUCTIVE_ACTIONS_DISABLED',
        message: `The "${name}" call archives or deletes a Meta object. Meta treats both as permanent — neither can be reverted via the API — so this is turned off right now.`,
        actionableFix: `Turn on destructive actions by setting ${ADS_DESTRUCTIVE_ACTIONS_ENABLE_FLAG}=true, then try again.`,
        enableFlag: ADS_DESTRUCTIVE_ACTIONS_ENABLE_FLAG,
      },
    ],
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(body, null, 2),
      },
    ],
    isError: true,
  };
}

function stripRawFromResponse<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripRawFromResponse(item)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => key !== 'raw')
      .map(([key, entryValue]) => [key, stripRawFromResponse(entryValue)]);

    return Object.fromEntries(entries) as T;
  }

  return value;
}

export function toAdsBrokerRequest(
  args: Record<string, unknown>,
  connectionKey?: string
): AdsBrokerRequest {
  const oauthAuthContext =
    (args._oauthAuthContext as AdsBrokerRequest['oauthAuthContext']) ?? undefined;

  return {
    provider: parseProvider(args.provider),
    providers: parseProviders(args.providers),
    accountId: typeof args.accountId === 'string' ? args.accountId : undefined,
    since: typeof args.since === 'string' ? args.since : undefined,
    until: typeof args.until === 'string' ? args.until : undefined,
    params: extractParams(args),
    connectionKey,
    oauthAuthContext,
  };
}

function extractParams(args: Record<string, unknown>): Record<string, unknown> {
  const params = isPlainObject(args.params) ? { ...args.params } : {};
  const reserved = new Set([
    'provider',
    'providers',
    'accountId',
    'since',
    'until',
    'params',
    '_oauthAuthContext',
  ]);

  for (const [key, value] of Object.entries(args)) {
    if (!reserved.has(key)) params[key] = value;
  }

  return params;
}

function callBrokerMethod(
  broker: AdsBroker,
  name: AdsMcpToolName,
  request: AdsBrokerRequest
): Promise<AdsBrokerResponse<AdsMetricRecord[] | AdsMutationResult | unknown>> {
  switch (name) {
    case 'ads_list_accounts':
      return broker.listAccounts(request);
    case 'ads_list_campaigns':
      return broker.listCampaigns(request);
    case 'ads_check_launch_readiness':
      return broker.checkLaunchReadiness({
        ...request,
        params: { ...request.params, writesEnabled: areAdsWriteToolsEnabled() },
      });
    case 'ads_get_performance':
      return callCanonicalPerformanceTool(broker, request);
    case 'ads_get_creatives':
      return broker.getCreativePerformance({
        ...request,
        params: { ...request.params, level: 'creative' },
      });
    case 'ads_get_change_history':
      if ((request.provider ?? 'meta') !== 'meta')
        return Promise.resolve(getAdsChangeHistory(request));
      return broker.getChangeHistory(request);
    case 'ads_get_capabilities':
      return Promise.resolve(mergeCapabilitiesResponse(request, broker.getCapabilities(request)));
    case 'ads_get_account_performance':
      return broker.getAccountPerformance(request);
    case 'ads_get_campaign_performance':
      return broker.getCampaignPerformance(request);
    case 'ads_get_adset_or_adgroup_performance':
      return broker.getAdsetOrAdgroupPerformance(request);
    case 'ads_get_ad_performance':
      return broker.getAdPerformance(request);
    case 'ads_get_creative_performance':
      return broker.getCreativePerformance(request);
    case 'ads_get_placement_performance':
      return broker.getPlacementPerformance(request);
    case 'ads_content_matrix':
      return broker.getContentMatrix(request);
    case 'ads_generate_report':
      return broker.generateReport(request);
    case 'ads_pause_campaign':
      return broker.pauseCampaign(request);
    case 'ads_resume_campaign':
      return broker.resumeCampaign(request);
    case 'ads_update_campaign_budget':
      return broker.updateCampaignBudget(request);
    case 'ads_rename_campaign':
      return broker.renameCampaign(request);
    case 'ads_create_campaign':
      return broker.createCampaign(request);
    case 'ads_create_adset':
      return broker.createAdSet(request);
    case 'ads_create_adcreative':
      return broker.createAdCreative(request);
    case 'ads_create_ad':
      return broker.createAd(request);
    case 'ads_clone_ui_ad':
      return broker.cloneUiAd(request);
    case 'ads_archive_ad':
      return broker.archiveAd(request);
    case 'ads_pause_ad':
      return broker.pauseAd(request);
    case 'ads_resume_ad':
      return broker.resumeAd(request);
    case 'ads_pause_adset':
      return broker.pauseAdSet(request);
    case 'ads_resume_adset':
      return broker.resumeAdSet(request);
    case 'ads_clone_adset':
      return broker.cloneAdSet(request);
    case 'ads_update_adset':
      return broker.updateAdSet(request);
    case 'ads_update_ad':
      return broker.updateAd(request);
    case 'ads_update_campaign':
      return broker.updateCampaign(request);
    case 'ads_get_targeting_options':
      return broker.getTargetingOptions(request);
    case 'ads_create_ecommerce_campaign_bundle':
      return broker.createEcommerceCampaignBundle(request);
    case 'ads_get_video_source':
      return broker.getVideoSource(request);
    case 'ads_get_ad_creative_mapping':
      return broker.getAdCreativeMapping(request);
    case 'ads_get_ad_destinations':
      return broker.getAdDestinations(request);
    case 'ads_read_creative_full':
      return broker.readAdCreativeFull(request);
    case 'ads_read_adset_full':
      return broker.readAdSetFull(request);
    case 'ads_list_pages':
      return broker.listPages(request);
    case 'ads_list_instagram_accounts':
      return broker.listInstagramAccounts(request);
    case 'ads_list_instagram_media':
      return broker.listInstagramMedia(request);
    case 'ads_list_threads_profiles':
      return broker.listThreadsProfiles(request);
    case 'ads_list_pixels':
      return broker.listPixels(request);
    case 'ads_list_catalogs':
      return broker.listCatalogs(request);
    case 'ads_list_product_sets':
      return broker.listProductSets(request);
    case 'ads_list_whatsapp_accounts':
      return broker.listWhatsAppAccounts(request);
    case 'ads_list_whatsapp_phone_numbers':
      return broker.listWhatsAppPhoneNumbers(request);
    case 'ads_list_whatsapp_message_templates':
      return broker.listWhatsAppMessageTemplates(request);
    case 'ads_upload_image':
      return broker.uploadImage(request);
    case 'ads_upload_video':
      return broker.uploadVideo(request);
    case 'ads_list_adimages':
      return broker.listAdImages(request);
    case 'ads_list_advideos':
      return broker.listAdVideos(request);
    case 'ads_get_account_info':
      return broker.getAccountInfo(request);
    case 'ads_get_ad_preview':
      return broker.getAdPreview(request);
    // --- TikTok GMV Max ---
    case 'tiktok_gmv_max_create_campaign':
      return broker.gmvMaxCreateCampaign(request);
    case 'tiktok_gmv_max_update_campaign':
      return broker.gmvMaxUpdateCampaign(request);
    case 'tiktok_gmv_max_create_session':
      return broker.gmvMaxCreateSession(request);
    case 'tiktok_gmv_max_update_session':
      return broker.gmvMaxUpdateSession(request);
    case 'tiktok_gmv_max_delete_session':
      return broker.gmvMaxDeleteSession(request);
    case 'tiktok_gmv_max_get_campaign_info':
      return broker.gmvMaxGetCampaignInfo(request);
    // --- TikTok Smart Plus ---
    case 'tiktok_smart_plus_create_campaign':
      return broker.smartPlusCreateCampaign(request);
    case 'tiktok_smart_plus_pause_campaign':
      return broker.smartPlusPauseCampaign(request);
    case 'tiktok_smart_plus_resume_campaign':
      return broker.smartPlusResumeCampaign(request);
    case 'tiktok_smart_plus_create_adgroup':
      return broker.smartPlusCreateAdGroup(request);
    case 'tiktok_smart_plus_pause_adgroup':
      return broker.smartPlusPauseAdGroup(request);
    case 'tiktok_smart_plus_resume_adgroup':
      return broker.smartPlusResumeAdGroup(request);
    default:
      return Promise.resolve({
        ok: false,
        errors: [
          {
            code: 'UNSUPPORTED_OPERATION',
            message: `'${name}' is not implemented through the broker yet`,
          },
        ],
      });
  }
}

function getAdsChangeHistory(
  request: AdsBrokerRequest
): AdsBrokerResponse<Record<string, unknown>> {
  const provider = request.provider ?? 'meta';
  if (provider !== 'meta') {
    return {
      ok: false,
      provider,
      errors: [
        {
          provider,
          code: 'NOT_IMPLEMENTED',
          message:
            'ads_get_change_history is currently implemented only for Meta-compatible change history envelopes.',
        },
      ],
    };
  }

  return {
    ok: true,
    provider: 'meta',
    data: {
      provider: 'meta',
      account: { id: request.accountId },
      dateRange: { since: request.since, until: request.until },
      rows: [],
      paging: { nextCursor: null },
      warnings: [
        {
          code: 'CHANGE_HISTORY_ADAPTER_NOT_CONNECTED',
          message:
            'Meta change history envelope is available; provider API fetching will be attached behind this canonical tool in the adapter layer.',
          severity: 'info',
        },
      ],
      dataFreshness: { retrievedAt: new Date().toISOString() },
      capabilities: getAdsCapabilities(request).data ?? {},
    },
  };
}

function mergeCapabilitiesResponse(
  request: AdsBrokerRequest,
  response: AdsBrokerResponse<Record<string, unknown>>
): AdsBrokerResponse<Record<string, unknown>> {
  if (!response.ok) return response;
  return {
    ...response,
    data: {
      ...getAdsCapabilities(request).data,
      ...response.data,
    },
  };
}

function canonicalizeToolResponse(
  name: AdsMcpToolName,
  request: AdsBrokerRequest,
  response: AdsBrokerResponse<AdsMetricRecord[] | AdsMutationResult | unknown>
): AdsBrokerResponse<AdsPerformanceEnvelope | AdsMutationResult | unknown> {
  if (!response.ok || !['ads_get_performance', 'ads_get_creatives'].includes(name)) {
    return response;
  }

  const rows = Array.isArray(response.data) ? (response.data as AdsMetricRecord[]) : [];
  const level =
    name === 'ads_get_creatives' ? 'creative' : parsePerformanceLevel(request.params.level);
  return {
    ...response,
    data: buildPerformanceEnvelope(request, response, rows, level),
  };
}

function buildPerformanceEnvelope(
  request: AdsBrokerRequest,
  response: AdsBrokerResponse<AdsMetricRecord[] | AdsMutationResult | unknown>,
  rows: AdsMetricRecord[],
  level: AdsEntityLevel
): AdsPerformanceEnvelope {
  const firstRow = rows[0];
  const requestedMetrics = parseStringArray(request.params.metrics);
  const metricAliases = normalizeMetricAliases(requestedMetrics);
  const requestedDimensions = parseStringArray(request.params.dimensions);
  const metrics = requestedMetrics.length ? metricAliases.metrics : inferMetrics(rows);
  const dimensions = requestedDimensions.length
    ? requestedDimensions
    : inferDimensions(level, rows);
  const unsupportedMetrics = metrics.filter((metric) => !SUPPORTED_CANONICAL_METRICS.has(metric));
  const warningObjects = unsupportedMetrics.map((metric) => ({
    code: 'UNSUPPORTED_METRIC',
    message: `${metric} is not part of the canonical ads metric set yet. Provider data may still be present in raw normalized rows if supported by the adapter.`,
    field: `metrics.${metric}`,
    severity: 'warning' as const,
  }));
  const projectedRows = requestedMetrics.length
    ? rows.map((row) => projectMetricRecord(row, metrics, request.params.includeRaw === true))
    : rows;

  return {
    provider: response.provider ?? request.provider ?? firstRow?.provider ?? 'meta',
    account: {
      id: request.accountId ?? firstRow?.identity.account_id,
      name: firstRow?.identity.account_name,
    },
    dateRange: {
      since: request.since ?? firstRow?.time.date_start,
      until: request.until ?? firstRow?.time.date_stop,
      timezone: firstRow?.time.timezone,
    },
    currency: firstRow?.setup?.currency,
    level,
    dimensions,
    metrics,
    rows: projectedRows,
    paging: {
      nextCursor: typeof response.meta?.nextCursor === 'string' ? response.meta.nextCursor : null,
    },
    warnings: [
      ...metricAliases.warnings,
      ...warningObjects,
      ...extractWarningObjects(response.meta?.warnings),
    ],
    dataFreshness: {
      retrievedAt: new Date().toISOString(),
    },
    capabilities: getAdsCapabilities(request).data ?? {},
    unsupportedMetrics,
  };
}

const SUPPORTED_CANONICAL_METRICS = new Set([
  'spend',
  'budget',
  'daily_budget',
  'lifetime_budget',
  'impressions',
  'reach',
  'frequency',
  'cpm',
  'clicks',
  'inline_link_clicks',
  'outbound_clicks',
  'landing_page_views',
  'ctr',
  'link_ctr',
  'outbound_ctr',
  'cpc',
  'results',
  'cost_per_result',
  'conversions',
  'conversion_value',
  'roas',
  'purchases',
  'purchase_value',
  'purchase_roas',
  'adds_to_cart',
  'leads',
  'cost_per_lead',
  'video_views',
  'engagements',
]);

function normalizeMetricAliases(metrics: string[]): {
  metrics: string[];
  warnings: AdsPerformanceEnvelope['warnings'];
} {
  const normalized: string[] = [];
  const warnings: AdsPerformanceEnvelope['warnings'] = [];
  for (const metric of metrics) {
    const canonical = metric === 'cpa' ? 'cost_per_result' : metric;
    if (!normalized.includes(canonical)) normalized.push(canonical);
    if (canonical !== metric) {
      warnings.push({
        code: 'METRIC_ALIAS',
        message: `${metric} is interpreted as ${canonical}.`,
        field: `metrics.${metric}`,
        severity: 'info',
      });
    }
  }
  return { metrics: normalized, warnings };
}

function projectMetricRecord(
  row: AdsMetricRecord,
  metrics: string[],
  includeRaw: boolean
): AdsMetricRecord {
  const requested = new Set(metrics);
  const projected: AdsMetricRecord = {
    provider: row.provider,
    level: row.level,
    identity: row.identity,
    setup: row.setup,
    time: row.time,
    delivery: {
      spend: row.delivery.spend,
      impressions: row.delivery.impressions,
      ...pickMetricFields(row.delivery, requested),
    },
    dimensions: row.dimensions,
    creative: row.creative,
    diagnostics: row.diagnostics,
  };

  for (const [key, group] of [
    ['clicks', row.clicks],
    ['conversions', row.conversions],
    ['commerce', row.commerce],
    ['leads', row.leads],
    ['video', row.video],
    ['engagement', row.engagement],
    ['calculated', row.calculated],
  ] as const) {
    const selected = pickMetricFields(group, requested);
    if (selected) Object.assign(projected, { [key]: selected });
  }

  if (includeRaw) projected.raw = row.raw;
  return projected;
}

function pickMetricFields<T extends object>(
  group: T | undefined,
  requested: Set<string>
): Partial<T> | undefined {
  if (!group) return undefined;
  const selected = Object.fromEntries(
    Object.entries(group).filter(([key]) => requested.has(key))
  ) as Partial<T>;
  return Object.keys(selected).length > 0 ? selected : undefined;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function inferMetrics(rows: AdsMetricRecord[]): string[] {
  const metrics = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.delivery)) metrics.add(key);
    for (const group of [
      row.clicks,
      row.conversions,
      row.commerce,
      row.leads,
      row.video,
      row.engagement,
    ]) {
      if (!group) continue;
      for (const key of Object.keys(group)) metrics.add(key);
    }
  }
  return [...metrics];
}

function inferDimensions(level: AdsEntityLevel, rows: AdsMetricRecord[]): string[] {
  const dimensions = new Set<string>([level]);
  for (const row of rows) {
    if (!row.dimensions) continue;
    for (const key of Object.keys(row.dimensions)) dimensions.add(key);
  }
  return [...dimensions];
}

function extractWarningObjects(value: unknown): AdsPerformanceEnvelope['warnings'] {
  if (!Array.isArray(value)) return [];
  return value.map((warning) => {
    if (typeof warning === 'string') {
      return { code: 'PROVIDER_WARNING', message: warning, severity: 'warning' as const };
    }
    if (warning && typeof warning === 'object') {
      const record = warning as Record<string, unknown>;
      return {
        code: typeof record.code === 'string' ? record.code : 'PROVIDER_WARNING',
        message:
          typeof record.message === 'string' ? record.message : 'Provider returned a warning.',
        field: typeof record.field === 'string' ? record.field : undefined,
        severity: record.severity === 'info' ? ('info' as const) : ('warning' as const),
      };
    }
    return {
      code: 'PROVIDER_WARNING',
      message: 'Provider returned a warning.',
      severity: 'warning' as const,
    };
  });
}

function callCanonicalPerformanceTool(
  broker: AdsBroker,
  request: AdsBrokerRequest
): Promise<AdsBrokerResponse<AdsMetricRecord[] | unknown>> {
  const level = parsePerformanceLevel(request.params.level);

  switch (level) {
    case 'account':
      return broker.getAccountPerformance(request);
    case 'campaign':
      return broker.getCampaignPerformance(request);
    case 'adset':
    case 'adgroup':
      return broker.getAdsetOrAdgroupPerformance(request);
    case 'ad':
      return broker.getAdPerformance(request);
    case 'creative':
      return broker.getCreativePerformance(request);
  }
}

function parsePerformanceLevel(level: unknown): AdsEntityLevel {
  return typeof level === 'string' && (ADS_ENTITY_LEVELS as readonly string[]).includes(level)
    ? (level as AdsEntityLevel)
    : 'campaign';
}

function getAdsCapabilities(request: AdsBrokerRequest): AdsBrokerResponse<Record<string, unknown>> {
  const provider =
    request.provider && isAdsProviderId(request.provider) ? request.provider : undefined;

  return {
    ok: true,
    provider,
    data: {
      canonicalTools: [
        'ads_list_accounts',
        'ads_list_campaigns',
        'ads_get_performance',
        'ads_get_creatives',
        'ads_get_change_history',
        'ads_get_capabilities',
        'commerce_get_performance',
      ],
      supportedProviders: [...ADS_PROVIDER_IDS],
      metricCatalog: {
        common: ['spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'cost_per_result'],
        byProvider: {
          meta: ['inline_link_clicks', 'purchase_roas', 'purchases', 'purchase_value', 'leads'],
          tiktok: ['conversions', 'conversion_value', 'roas', 'video_views'],
          google: ['conversions', 'conversion_value', 'cost_per_conversion'],
        },
      },
      read: {
        levels: [...ADS_ENTITY_LEVELS],
        metrics: [
          'spend',
          'impressions',
          'reach',
          'clicks',
          'inline_link_clicks',
          'ctr',
          'cpc',
          'cpm',
          'purchases',
          'purchase_value',
          'purchase_roas',
          'leads',
          'cost_per_lead',
          'cost_per_result',
        ],
        dimensions: ['account', 'campaign', 'adset', 'adgroup', 'ad', 'creative'],
        // Must match what assertLocationBreakdowns() (src/utils/locationBreakdowns.ts)
        // actually accepts — advertising unimplemented values here breaks callers
        // who trust ads_get_capabilities over trial-and-error.
        breakdowns: [...LOCATION_BREAKDOWNS],
        pagination: { cursor: true, limit: true },
        dataFreshness: { retrievedAt: true },
      },
      writes: {
        optIn: true,
        enabled: areAdsWriteToolsEnabled(),
        enableFlag: 'ADSTREAM_ENABLE_WRITES',
        // Derived from actually-registered tool definitions, not the raw
        // name list — a name can exist in ADS_MCP_TOOL_NAMES (and thus be a
        // valid AdsMcpToolName) without a real tool definition or dispatch
        // case wired up yet, which used to make capabilities() claim tools
        // existed that silently did nothing when called.
        optionalTools: getAdsMcpToolDefinitions({ includeWrites: true })
          .map((tool) => tool.name)
          .filter((name) => isAdsMcpWriteTool(name)),
        safetyContract: 'docs/WRITE_SAFETY_CONTRACT.md',
      },
      destructiveActions: {
        optIn: true,
        enabled: areAdsDestructiveActionsEnabled(),
        enableFlag: ADS_DESTRUCTIVE_ACTIONS_ENABLE_FLAG,
        description:
          'Separate kill switch for calls that archive or delete a Meta object. Meta treats ARCHIVED and DELETED as equally permanent (neither reverts via the API), so both are gated the same way regardless of which status string is used.',
        gatedTools: ['ads_archive_ad', 'ads_update_ad', 'ads_update_campaign'],
      },
      warnings: [
        'ads_get_performance is currently a non-breaking canonical wrapper over legacy level-specific broker methods.',
        'Provider-specific availability can still vary by credential, account, metric, level, attribution setting, and API permission.',
      ],
    },
  };
}

function createWriteInputSchema(required: string[]) {
  const schema = createAdsInputSchema([]);
  const writeProperties: Record<string, unknown> = {
    campaignId: {
      type: 'string',
      description: 'The campaign ID to mutate (e.g. 120248446250030168)',
    },
    dailyBudget: {
      type: 'number',
      description: 'New daily budget in local currency minor units (e.g. 50000 for Rp50,000)',
    },
    newName: {
      type: 'string',
      description: 'New campaign name',
    },
  };

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      ...writeProperties,
    },
    required,
  };
}

function createUploadInputSchema(required: string[]) {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      filePath: {
        type: 'string',
        description:
          'Absolute path to the local file to upload. Example: /Users/name/Downloads/ad-image.jpg',
      },
      title: {
        type: 'string',
        description: 'Optional title for video uploads.',
      },
      description: {
        type: 'string',
        description: 'Optional description for video uploads.',
      },
    },
    required,
  };
}

function createPreviewInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      creativeId: {
        type: 'string',
        description: 'The creative ID to generate a preview for.',
      },
      adFormat: {
        type: 'string',
        enum: [
          'DESKTOP_FEED',
          'MOBILE_FEED',
          'INSTAGRAM_FEED',
          'INSTAGRAM_EXPLORE',
          'INSTAGRAM_REELS',
          'INSTAGRAM_STORIES',
          'FACEBOOK_STORIES',
          'MESSENGER_INBOX',
          'MARKETPLACE',
          'REWARDS_PLATFORM',
          'FACEBOOK_REELS',
        ],
        description: 'The ad format/platform to preview on.',
      },
    },
    required: ['creativeId', 'adFormat'],
  };
}

function createReadCreativeFullInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      creativeId: {
        type: 'string',
        description:
          'Meta Ad Creative ID to read (e.g. 120330899389530268). Get this from ads_list_advideos, ads_get_ad_creative_mapping, or Meta Ads Manager.',
      },
    },
    required: ['creativeId'],
  };
}

function createReadAdSetFullInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adsetId: {
        type: 'string',
        description: 'Meta Ad Set ID to read in full (single mode).',
      },
      campaignId: {
        type: 'string',
        description: 'Campaign ID to list all ad sets under (list mode).',
      },
      limit: {
        type: 'number',
        description: 'Page size for list mode (default 25).',
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor (Meta after) for list mode.',
      },
    },
    required: [] as string[],
  };
}

function createCreateCampaignInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Campaign name.' },
      mode: {
        type: 'string',
        enum: ['standard', 'collaborative_ads'],
        description:
          'standard untuk iklan Meta biasa; collaborative_ads untuk katalog retailer yang sudah dibagikan.',
      },
      objective: {
        type: 'string',
        enum: [...META_ODAX_OBJECTIVES],
        description: 'Meta ODAX campaign objective.',
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED'],
        description: 'Campaign status. Defaults to PAUSED.',
      },
      specialAdCategories: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Meta special ad categories (e.g. CREDIT, EMPLOYMENT, HOUSING, SOCIAL_ISSUES_ELECTIONS).',
      },
      buyType: {
        type: 'string',
        enum: ['AUCTION', 'RESERVED'],
        description: 'Buying type. Defaults to AUCTION.',
      },
      isAdSetBudgetSharingEnabled: {
        type: 'boolean',
        description:
          'Izinkan ad set tanpa campaign budget berbagi hingga 20% anggaran. Default false.',
      },
      dailyBudget: {
        type: 'number',
        description: 'Daily budget in local currency minor units (e.g. 50000 for Rp50,000).',
      },
      lifetimeBudget: {
        type: 'number',
        description: 'Lifetime budget in local currency minor units.',
      },
      bidStrategy: {
        type: 'string',
        description: 'Bid strategy (e.g. LOWEST_COST_WITHOUT_CAP).',
      },
      dedupeByName: {
        type: 'boolean',
        description: 'Check for an existing campaign with the same name before creating.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
      },
      dryRun: {
        type: 'boolean',
        description: 'Defaults to true. Set false only after preview.',
      },
      confirmed: {
        type: 'boolean',
        description: 'Must be true to execute after preview.',
      },
    },
    required: ['accountId', 'name', 'objective'],
  };
}

function createCreateAdSetInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      campaignId: { type: 'string', description: 'The campaign ID to create the ad set under.' },
      name: { type: 'string', description: 'Ad set name.' },
      mode: {
        type: 'string',
        enum: ['standard', 'collaborative_ads'],
        description:
          'standard untuk iklan Meta biasa; collaborative_ads untuk katalog retailer yang sudah dibagikan.',
      },
      collaborativeCatalog: {
        type: 'object',
        description:
          'Konteks katalog retailer untuk Collaborative Ads. Isi product set, pixel omnichannel, aplikasi retailer, event, dan URL app store sesuai data kolaborasi.',
        properties: {
          productSetId: {
            type: 'string',
            description: 'ID product set dari katalog retailer yang dibagikan.',
          },
          pixelId: {
            type: 'string',
            description: 'ID Meta Pixel untuk mengukur event konversi, jika digunakan.',
          },
          customEventType: {
            type: 'string',
            description: 'Event konversi Meta, misalnya PURCHASE, jika digunakan.',
          },
          destinationUrl: {
            type: 'string',
            description: 'URL tujuan katalog atau toko retailer, jika digunakan.',
          },
          applicationId: {
            type: 'string',
            description: 'ID aplikasi retailer, misalnya aplikasi Shopee.',
          },
          objectStoreUrls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URL Play Store dan App Store aplikasi retailer.',
          },
        },
        required: ['productSetId'],
        additionalProperties: false,
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED'],
        description: 'Ad set status. Defaults to PAUSED.',
      },
      dailyBudget: { type: 'number', description: 'Daily budget in local currency minor units.' },
      lifetimeBudget: {
        type: 'number',
        description: 'Lifetime budget in local currency minor units.',
      },
      billingEvent: {
        type: 'string',
        enum: [
          'IMPRESSIONS',
          'LINK_CLICKS',
          'PAGE_LIKES',
          'POST_ENGAGEMENT',
          'VIDEO_VIEWS',
          'LEADS',
          'APP_INSTALLS',
          'REACH',
          'VALUE',
          'LANDING_PAGE_VIEWS',
          'OFFSITE_CONVERSIONS',
        ],
        description: 'Billing event. Defaults to IMPRESSIONS.',
      },
      optimizationGoal: {
        type: 'string',
        enum: [
          'NONE',
          'APP_INSTALLS',
          'CONVERSATIONS',
          'ENGAGED_USERS',
          'IMPRESSIONS',
          'LANDING_PAGE_VIEWS',
          'LEAD_GENERATION',
          'LINK_CLICKS',
          'OFFSITE_CONVERSIONS',
          'PAGE_LIKES',
          'POST_ENGAGEMENT',
          'REACH',
          'THRUPLAY',
          'VALUE',
        ],
        description: 'Optimization goal. Required when conversionLocation is omitted.',
      },
      conversionLocation: {
        type: 'string',
        enum: [...META_CONVERSION_LOCATIONS],
        description: 'Objective-aware Meta conversion location.',
      },
      creativeFormat: {
        type: 'string',
        enum: [...META_CREATIVE_FORMATS],
        description: 'Creative format used to validate the objective launch.',
      },
      pageId: { type: 'string', description: 'Meta Page ID for the objective launch.' },
      pixelId: { type: 'string', description: 'Meta Pixel ID for website conversions.' },
      leadFormId: { type: 'string', description: 'Meta instant form ID for lead generation.' },
      applicationId: { type: 'string', description: 'Meta application ID for app promotion.' },
      objectStoreUrl: { type: 'string', description: 'App store URL for app promotion.' },
      productSetId: { type: 'string', description: 'Meta product set ID for catalog sales.' },
      customEventType: { type: 'string', description: 'Optional Meta conversion event type.' },
      bidStrategy: {
        type: 'string',
        description: 'Bid strategy (e.g. LOWEST_COST_WITHOUT_CAP).',
      },
      geoLocations: {
        type: 'object',
        description: 'Geo targeting object with countries[], regions[], cities[].',
      },
      bidAmount: {
        type: 'number',
        description:
          'Bid amount in account currency cents. REQUIRED when bidStrategy is COST_CAP or LOWEST_COST_WITH_BID_CAP.',
      },
      bidConstraints: {
        type: 'object',
        description:
          'Bid constraints for LOWEST_COST_WITH_MIN_ROAS. Shape: { roas_average_floor: number }.',
      },
      ageMin: { type: 'number', description: 'Minimum age target (e.g. 18).' },
      ageMax: { type: 'number', description: 'Maximum age target (e.g. 65).' },
      genders: {
        type: 'array',
        items: { type: 'number' },
        description: 'Gender targeting values. Meta uses 1=male, 2=female.',
      },
      publisherPlatforms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Publisher platforms (e.g. facebook, instagram, messenger).',
      },
      facebookPositions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Granular Facebook placements (e.g. feed, story, video_feeds, marketplace, facebook_reels). Omit for all positions.',
      },
      instagramPositions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Granular Instagram placements (e.g. stream, story, explore, reels, profile_feed, profile_reels, ig_search). Omit for all positions.',
      },
      threadsPositions: {
        type: 'array',
        items: { type: 'string', enum: ['threads_stream'] },
        description:
          'Threads placements. Only threads_stream is supported by Meta, and it requires Instagram "stream" to also be included in instagramPositions.',
      },
      messengerPositions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Granular Messenger placements (e.g. sponsored_messages, story).',
      },
      marketplacePositions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Granular Facebook Marketplace placements.',
      },
      devicePlatforms: {
        type: 'array',
        items: { type: 'string', enum: ['mobile', 'desktop'] },
        description: 'Device platforms. Omit for all device types.',
      },
      advantageAudience: {
        type: 'number',
        enum: [0, 1],
        description:
          'Shorthand for targeting_automation.advantage_audience: 1 to enable Advantage+ Audience expansion, 0 to disable. Meta requires this to be explicit when age/gender/custom-audience/detailed-targeting use non-default settings. Ignored if targetingAutomation is also provided.',
      },
      targetingAutomation: {
        type: 'object',
        description:
          'Raw targeting_automation object, e.g. { advantage_audience: 1 }. Takes precedence over advantageAudience. Defaults to { advantage_audience: 0 } when neither is provided and other targeting fields are set.',
      },
      interests: {
        type: 'array',
        description: 'Interest targeting array [{ id, name }].',
      },
      behaviors: {
        type: 'array',
        description:
          'Behavior targeting array [{ id, name }] (e.g. "Engaged Shoppers", "Frequent international travelers"). Combined with workEmployers/workPositions (if any) in one OR-matched group, ANDed against interests.',
      },
      workEmployers: {
        type: 'array',
        description:
          'Employer targeting array [{ id, name }]. Combined with behaviors/workPositions (if any) in one OR-matched group, ANDed against interests.',
      },
      workPositions: {
        type: 'array',
        description:
          'Job title targeting array [{ id, name }]. Combined with behaviors/workEmployers (if any) in one OR-matched group, ANDed against interests.',
      },
      customAudiences: {
        type: 'array',
        description: 'Custom audiences to include (retargeting), array of [{ id }].',
      },
      excludedCustomAudiences: {
        type: 'array',
        description: 'Custom audiences to exclude, array of [{ id }].',
      },
      promotedObject: {
        type: 'object',
        description: 'Promoted object (e.g. { pixel_id, custom_event_type }).',
      },
      startTime: { type: 'string', description: 'Start time in ISO format.' },
      endTime: { type: 'string', description: 'End time in ISO format.' },
      destinationType: {
        type: 'string',
        description: 'Where users go: WEBSITE, APP, MESSENGER, WHATSAPP, INSTAGRAM_DIRECT, etc.',
      },
      attributionSpec: {
        type: 'array',
        description:
          'Attribution window spec. Example: [{ event_type: "CLICK_THROUGH", window_days: 7 }]',
      },
      frequencyControlSpecs: {
        type: 'array',
        description:
          'Frequency cap specs. Example: [{ event: "IMPRESSIONS", interval_days: 7, max_frequency: 3 }]',
      },
      isDynamicCreative: {
        type: 'boolean',
        description:
          'Legacy Meta API compatibility flag. Jangan diisi untuk iklan normal; hanya set true saat attaching flexible asset_feed_spec multi-varian yang sudah direview dan Meta menolak adset non-Dynamic Creative.',
      },
      dsaBeneficiary: {
        type: 'string',
        description: 'DSA beneficiary for European compliance (person/org that benefits from ads).',
      },
      dsaPayor: {
        type: 'string',
        description: 'DSA payor for European compliance (person/org paying for the ads).',
      },
      multiAdvertiserAds: {
        type: 'number',
        description: 'Multi-Advertiser Ads opt-in (1) or opt-out (0).',
      },
      dedupeByName: {
        type: 'boolean',
        description:
          'Check for an existing ad set with the same name under the campaign before creating.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
      },
      params: {
        type: 'object',
        description:
          'Optional provider-safe parameters. params.targeting (raw Meta targeting field names, e.g. { work_employers: [...] }) is deep-merged as the base of the outgoing targeting payload — typed fields above (interests, behaviors, workEmployers, workPositions, etc.) take precedence on key conflicts.',
        additionalProperties: true,
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'campaignId', 'name'],
  };
}

function createCreateAdCreativeInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Creative name.' },
      pageId: {
        type: 'string',
        description:
          'Meta Page ID used in object_story_spec. Tidak diperlukan untuk creativeFormat=existing_post.',
      },
      mode: {
        type: 'string',
        enum: ['standard', 'collaborative_ads'],
        description:
          'standard untuk iklan Meta biasa; collaborative_ads untuk katalog retailer yang sudah dibagikan.',
      },
      objective: {
        type: 'string',
        enum: [...META_ODAX_OBJECTIVES],
        description: 'Canonical ODAX objective. Must be paired with conversionLocation.',
      },
      conversionLocation: {
        type: 'string',
        enum: [...META_CONVERSION_LOCATIONS],
        description: 'Canonical conversion location. Must be paired with objective.',
      },
      creativeFormat: {
        type: 'string',
        enum: [
          'single_image',
          'video',
          'carousel',
          'catalog',
          'collection',
          'flexible',
          'placement_image',
          'placement_customized_ctwa',
          'existing_post',
        ],
        description:
          'Format materi iklan: gambar tunggal, video, carousel, katalog, collection, flexible, gambar khusus per placement, atau postingan yang sudah ada.',
      },
      creativeSpec: {
        type: 'object',
        description:
          'Detail materi sesuai creativeFormat. Field per format: single_image memakai imageHash, primaryText, destinationUrl, headline, description, callToAction, pageWelcomeMessage (opsional, untuk Click-to-WhatsApp/Messenger), dan applinkTreatment (opsional, lihat properti applinkTreatment); video memakai videoId, thumbnailImageHash (opsional — kalau kosong, otomatis diisi dari thumbnail bawaan video via GET /{videoId}?fields=picture; hanya berbahaya diabaikan kalau video belum selesai diproses Meta dan tidak punya thumbnail sama sekali), primaryText, destinationUrl, headline, description, callToAction, pageWelcomeMessage (opsional, untuk Click-to-WhatsApp/Messenger), dan applinkTreatment (opsional, lihat properti applinkTreatment); carousel memakai primaryText, destinationUrl, cards (imageHash atau videoId, headline, description, destinationUrl); catalog memakai productSetId, primaryText, destinationUrl, templateUrl, fallbackImageHash; collection memakai instantExperienceId, coverImageHash atau coverVideoId, productSetId, primaryText, destinationUrl; flexible memakai primaryText, primaryTexts, imageHashes dan/atau videoIds, headlines, descriptions, destinationUrl, dan messageExtensions opsional; placement_image memakai asset_feed_spec; placement_customized_ctwa memakai feedImageHash, verticalImageHash, primaryText, headline, destinationUrl, pageWelcomeMessage di link_data, platform_customizations, portrait_customizations, dan Advantage+ opt-out; existing_post memakai objectStoryId (post id Facebook Page, format {page_id}_{post_id}) ATAU sourceInstagramMediaId (media id IG yang tidak di-cross-post ke Page — dapatkan dari ads_list_instagram_media, cocokkan permalink-nya ke URL instagram.com/reel atau /p yang dimiliki user; wajib isi tepat satu dari dua field ini), plus destinationUrl, callToAction, dan applinkTreatment (opsional). Untuk mengarahkan post yang di-boost ke landing page eksternal dengan tombol CTA: isi destinationUrl + callToAction (mis. LEARN_MORE). Keduanya dikirim sebagai call_to_action di LEVEL ATAS creative (call_to_action.value.link), BUKAN di dalam object_story_spec — object_story_spec bareng source_instagram_media_id ditolak Meta dengan (#100) subcode 1487929 Ambiguous Promoted Object (terverifikasi live di v25.0). Tujuan post Instagram bisa diganti bebas; post Facebook Page yang sudah punya link sendiri mungkin tetap memakai link lamanya — nilainya diteruskan dan Meta yang memutuskan. Pakai urlTags untuk tracking UTM; itu tersimpan bersama call_to_action. destinationUrl juga wajib diisi kalau collaborativeAppSpec diisi, dipakai untuk omnichannel_link_spec.web.url (CATATAN: itu pun tidak bisa memperbaiki object_store_urls yang hilang dari call_to_action post lama yang sudah dipublikasikan; untuk ad set CPAS omnichannel disarankan pakai creativeFormat video langsung). destinationUrl tanpa callToAction maupun collaborativeAppSpec akan DITOLAK, bukan diabaikan diam-diam.',
        properties: {
          messageExtensions: {
            type: 'array',
            description:
              'Opsional untuk format yang membangun asset_feed_spec (mis. flexible/placement_image). Dipetakan ke asset_feed_spec.message_extensions. SDK resmi Meta mendefinisikan item sebagai { type: string }; contoh dari read-back Meta: [{ "type": "whatsapp" }].',
            items: {
              type: 'object',
              properties: { type: { type: 'string', minLength: 1 } },
              required: ['type'],
              additionalProperties: false,
            },
          },
          applinkTreatment: {
            type: 'string',
            enum: [
              'deeplink_with_appstore_fallback',
              'deeplink_with_web_fallback',
              'web_only',
              'deeplink_disabled',
            ],
            description:
              'Opsional. Hanya berlaku untuk creativeFormat video, single_image, atau existing_post saat collaborativeAppSpec diisi (ad set omnichannel/CPAS). Kalau tidak diisi, default ke automatic (perilaku Meta saat ini). CATATAN: pada mode: collaborative_ads (jalur katalog lama), field ini diabaikan untuk video/single_image dan applink_treatment selalu automatic.',
          },
        },
        additionalProperties: true,
      },
      collaborativeProductSetId: {
        type: 'string',
        description:
          'Harus sama dengan product set yang dipilih di ad set, dan wajib untuk setiap format creative Collaborative Ads yang didukung pada rilis ini.',
      },
      collaborativeAppSpec: {
        type: 'object',
        description:
          'Identitas aplikasi retailer untuk tujuan omnichannel, termasuk ID aplikasi dan data Android/iOS. Untuk creativeFormat video, single_image, dan existing_post, field omnichannel (applink_treatment, omnichannel_link_spec) otomatis ditambahkan begitu field ini diisi — tidak perlu mode: collaborative_ads atau collaborativeProductSetId untuk ketiga format tersebut.',
        properties: {
          applicationId: { type: 'string' },
          android: {
            type: 'object',
            properties: {
              appName: { type: 'string' },
              packageName: { type: 'string' },
            },
            required: ['appName', 'packageName'],
            additionalProperties: false,
          },
          ios: {
            type: 'object',
            properties: {
              appName: { type: 'string' },
              appStoreId: { type: 'string' },
            },
            required: ['appName', 'appStoreId'],
            additionalProperties: false,
          },
        },
        required: ['applicationId'],
        additionalProperties: false,
      },
      link: {
        type: 'string',
        description: 'Field legacy/backward-compatible untuk URL tujuan iklan link sederhana.',
      },
      message: {
        type: 'string',
        description: 'Field legacy/backward-compatible untuk teks utama iklan.',
      },
      headline: {
        type: 'string',
        description: 'Field legacy/backward-compatible untuk headline iklan.',
      },
      description: {
        type: 'string',
        description: 'Field legacy/backward-compatible untuk deskripsi iklan opsional.',
      },
      imageHash: {
        type: 'string',
        description: 'Field legacy/backward-compatible untuk hash gambar Meta yang sudah diunggah.',
      },
      videoId: {
        type: 'string',
        description: 'Field legacy/backward-compatible untuk ID video Meta yang sudah diunggah.',
      },
      callToActionType: {
        type: 'string',
        description:
          'Field legacy/backward-compatible untuk tombol ajakan bertindak. Free-string (bukan enum tertutup) supaya konsisten dengan creativeSpec.callToAction — Meta punya puluhan CTA type (mis. SHOP_NOW, LEARN_MORE, BOOK_TRAVEL, WHATSAPP_MESSAGE, MESSAGE_PAGE, ORDER_NOW, GET_QUOTE, dll), validasi sebenarnya tetap di sisi Meta.',
      },
      urlTags: {
        type: 'string',
        description:
          'Meta URL Parameters for the creative. Sent to Meta as url_tags, e.g. utm_source={{site_source_name}}&utm_medium={{placement}}.',
      },
      instagramUserId: { type: 'string', description: 'Instagram user ID for IG posting.' },
      threadsProfileId: { type: 'string', description: 'Threads profile ID for Threads posting.' },
      objectStorySpec: {
        type: 'object',
        description:
          'Input advanced/backward-compatible Meta object_story_spec. Untuk Flexible asset-feed legacy, gunakan bersama assetFeedSpec tingkat atas; asset_feed_spec bersarang tetap didukung hanya untuk kompatibilitas.',
        properties: {
          asset_feed_spec: {
            type: 'object',
            properties: {
              bodies: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  properties: { text: { type: 'string', minLength: 1 } },
                  required: ['text'],
                },
              },
              titles: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  properties: { text: { type: 'string', minLength: 1 } },
                  required: ['text'],
                },
              },
              link_urls: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  properties: { website_url: { type: 'string', format: 'uri' } },
                  required: ['website_url'],
                },
              },
            },
            required: ['bodies', 'titles', 'link_urls'],
          },
        },
        additionalProperties: true,
      },
      assetFeedSpec: {
        type: 'object',
        description:
          'Input advanced/backward-compatible Meta asset_feed_spec untuk Flexible creative. Untuk iklan baru, prefer creativeFormat="flexible" + creativeSpec; legacy objectStorySpec+assetFeedSpec tetap diterima saat perlu. Memerlukan ad_formats, images, bodies, titles, link_urls, dan call_to_action_types.',
        properties: {
          ad_formats: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: ['AUTOMATIC_FORMAT'] },
          },
          bodies: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: { text: { type: 'string', minLength: 1 } },
              required: ['text'],
            },
          },
          titles: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: { text: { type: 'string', minLength: 1 } },
              required: ['text'],
            },
          },
          images: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: { hash: { type: 'string', minLength: 1 } },
              required: ['hash'],
            },
          },
          link_urls: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: { website_url: { type: 'string', format: 'uri' } },
              required: ['website_url'],
            },
          },
          call_to_action_types: { type: 'array', minItems: 1, items: { type: 'string' } },
          message_extensions: {
            type: 'array',
            items: {
              type: 'object',
              properties: { type: { type: 'string', minLength: 1 } },
              required: ['type'],
              additionalProperties: false,
            },
          },
        },
        required: ['ad_formats', 'bodies', 'titles', 'images', 'link_urls', 'call_to_action_types'],
        additionalProperties: true,
      },
      destinationType: {
        type: 'string',
        enum: ['WEB', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT', 'APP'],
        description:
          'Tujuan iklan. Pakai WHATSAPP untuk Click-to-WhatsApp. Hanya untuk jalur legacy (link + message); pada creativeFormat + creativeSpec pakai creativeSpec.callToAction = WHATSAPP_MESSAGE. Nilai ini berbeda dari destinationType milik ads_create_adset (WEBSITE/APP/...).',
      },
      pageWelcomeMessage: {
        type: 'string',
        description:
          'Pesan sambutan saat user menekan tombol CTA WhatsApp. Hanya untuk jalur legacy (link + message); pada creativeFormat + creativeSpec pakai creativeSpec.pageWelcomeMessage.',
      },
      whatsappWelcomeMessageSequenceId: {
        type: 'string',
        description:
          'ID welcome message flow/sequence, dikirim sebagai asset_feed_spec.additional_data.partner_app_welcome_message_flow_id. Berlaku untuk semua jalur creative.',
      },
      dedupeByName: {
        type: 'boolean',
        description: 'Check for an existing creative with the same name before creating.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
      },
      optOutEnhancements: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Nama fitur Advantage+ Creative enhancement yang di-disable (OPT_OUT). Contoh: ["image_auto_crop", "text_optimizations", "image_templates", "image_brightness_and_contrast", "image_animation", "image_background_gen", "image_uncrop", "catalog_feed_tag", "product_extensions", "standard_enhancements", "enhance_cta", "inline_comment", "pac_relaxation", "video_auto_crop", "video_filtering", "advantage_plus_creative", "site_extensions"]. Berlaku untuk SEMUA format creative (video, single_image, carousel, flexible, placement_customized_ctwa). Jika tidak diisi, Meta mengontrol enhancement secara default.',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'name'],
  };
}

function createCreateAdInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Ad name.' },
      adSetId: { type: 'string', description: 'The ad set ID to place the ad under.' },
      creativeId: { type: 'string', description: 'The creative ID to use for this ad.' },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED'],
        description: 'Ad status. Defaults to PAUSED.',
      },
      dedupeByName: {
        type: 'boolean',
        description:
          'Check for an existing ad with the same name under the ad set before creating.',
      },
      skipOmnichannelCheck: {
        type: 'boolean',
        description:
          'Skip the omnichannel creative pre-flight check. Only set if the check misfires; an omnichannel ad set normally requires an omnichannel-ready creative.',
      },
      skipPlacementCompatibilityCheck: {
        type: 'boolean',
        description:
          'Skip the local placement compatibility pre-flight check. Use only for reviewed CTWA placement-customized creatives that intentionally avoid Dynamic Creative.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'name', 'adSetId', 'creativeId'],
  };
}

function createCloneUiAdInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Name for the cloned ad.' },
      sourceAdId: {
        type: 'string',
        description:
          'The Ads Manager-created source ad ID to clone. The source creative is preserved; do not use this tool when you need to replace the creative.',
      },
      adSetId: {
        type: 'string',
        description:
          'The destination ad set ID. Use the same ad set as the source when preserving UI-only WhatsApp phone and placement setup.',
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED'],
        description: 'Ad status. Defaults to PAUSED.',
      },
      dedupeByName: {
        type: 'boolean',
        description: 'Check for an existing ad with the same name under the ad set before cloning.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'name', 'sourceAdId', 'adSetId'],
  };
}

function createArchiveAdInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adId: { type: 'string', description: 'The ad ID to archive.' },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['adId'],
  };
}

function createAdIdInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adId: { type: 'string', description: 'The ad ID to pause or resume.' },
    },
    required: ['adId'],
  };
}

function createAdSetIdInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adSetId: { type: 'string', description: 'The ad set ID to pause or resume.' },
    },
    required: ['adSetId'],
  };
}

function createCloneAdSetInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      accountId: { type: 'string', description: 'Provider account id. Required to clone.' },
      sourceAdSetId: {
        type: 'string',
        description: 'Ad set ID to copy configuration from.',
      },
      name: { type: 'string', description: 'New ad set name. Defaults to "<source> (copy)".' },
      campaignId: {
        type: 'string',
        description: 'Target campaign ID. Defaults to the source ad set campaign.',
      },
      status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Defaults to PAUSED.' },
      startTime: { type: 'string', description: 'Schedule start (ISO 8601).' },
      endTime: { type: 'string', description: 'Schedule end (ISO 8601).' },
      dailyBudget: { type: 'number', description: 'Override daily budget (minor units).' },
      lifetimeBudget: { type: 'number', description: 'Override lifetime budget (minor units).' },
      optimizationGoal: { type: 'string', description: 'Override optimization goal.' },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'sourceAdSetId'],
  };
}

function createUpdateAdSetInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adSetId: { type: 'string', description: 'The ad set ID to update.' },
      name: { type: 'string', description: 'New ad set name.' },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED'],
        description: 'New ad set status.',
      },
      dailyBudget: {
        type: 'number',
        description: 'New daily budget in local currency minor units.',
      },
      lifetimeBudget: { type: 'number', description: 'New lifetime budget.' },
      bidStrategy: { type: 'string', description: 'New bid strategy.' },
      optimizationGoal: {
        type: 'string',
        enum: [
          'REACH',
          'IMPRESSIONS',
          'LINK_CLICKS',
          'LANDING_PAGE_VIEWS',
          'CONVERSATIONS',
          'VALUE',
        ],
        description: 'New optimization goal.',
      },
      geoLocations: { type: 'object', description: 'Geo targeting object.' },
      ageMin: { type: 'number', description: 'Minimum age target.' },
      ageMax: { type: 'number', description: 'Maximum age target.' },
      genders: {
        type: 'array',
        items: { type: 'number' },
        description: 'Gender targeting values. Meta uses 1=male, 2=female.',
      },
      publisherPlatforms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Publisher platforms.',
      },
      facebookPositions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Granular Facebook placements (e.g. feed, story, video_feeds, marketplace, facebook_reels).',
      },
      instagramPositions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Granular Instagram placements (e.g. stream, story, explore, reels, profile_feed, profile_reels, ig_search).',
      },
      threadsPositions: {
        type: 'array',
        items: { type: 'string', enum: ['threads_stream'] },
        description:
          'Threads placements. Only threads_stream is supported by Meta, and it requires Instagram "stream" to also be included in instagramPositions.',
      },
      messengerPositions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Granular Messenger placements (e.g. sponsored_messages, story).',
      },
      marketplacePositions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Granular Facebook Marketplace placements.',
      },
      devicePlatforms: {
        type: 'array',
        items: { type: 'string', enum: ['mobile', 'desktop'] },
        description: 'Device platforms.',
      },
      excludedCustomAudiences: {
        type: 'array',
        description: 'Custom audiences to exclude, array of [{ id }].',
      },
      advantageAudience: {
        type: 'number',
        enum: [0, 1],
        description:
          'Shorthand for targeting_automation.advantage_audience: 1 to enable Advantage+ Audience expansion, 0 to disable. Ignored if targetingAutomation is also provided.',
      },
      targetingAutomation: {
        type: 'object',
        description:
          'Raw targeting_automation object, e.g. { advantage_audience: 1 }. Takes precedence over advantageAudience.',
      },
      startTime: { type: 'string', description: 'Start time in ISO format.' },
      endTime: { type: 'string', description: 'End time in ISO format.' },
      mode: {
        type: 'string',
        enum: ['patch', 'replace'],
        description:
          'Nested update mode. Defaults to patch; replace requires explicit replacement confirmation.',
      },
      replaceTargetingConfirmed: {
        type: 'boolean',
        description: 'Required when mode=replace and targeting is provided.',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['adSetId'],
  };
}

function createUpdateAdInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adId: { type: 'string', description: 'The ad ID to update.' },
      name: { type: 'string', description: 'New ad name.' },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
        description: 'New ad status.',
      },
      creativeId: {
        type: 'string',
        description:
          'Point this ad at a different, already-existing creative. Use this to change UTM/tracking parameters on a live ad by first creating a new creative with url_tags set, then swapping this ad to it.',
      },
      trackingSpecs: {
        type: 'array',
        items: { type: 'object' },
        description: 'New tracking_specs array for conversion logging.',
      },
      conversionDomain: { type: 'string', description: 'Domain where conversions occur.' },
      adScheduleStartTime: { type: 'string', description: 'Ad-level schedule start (ISO 8601).' },
      adScheduleEndTime: { type: 'string', description: 'Ad-level schedule end (ISO 8601).' },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['adId'],
  };
}

function createUpdateCampaignInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      campaignId: { type: 'string', description: 'The campaign ID to update.' },
      name: { type: 'string', description: 'New campaign name.' },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'],
        description: 'New campaign status. DELETED requires deleteConfirmed=true.',
      },
      lifetimeBudget: {
        type: 'number',
        description: 'New lifetime budget in local currency minor units. Increase-guarded.',
      },
      spendCap: {
        type: 'number',
        description: 'New total spend cap in local currency minor units. Increase-guarded.',
      },
      bidStrategy: { type: 'string', description: 'New bid strategy.' },
      specialAdCategories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Special ad categories (e.g. NONE, HOUSING, EMPLOYMENT, CREDIT).',
      },
      startTime: { type: 'string', description: 'Campaign start time (ISO 8601).' },
      stopTime: { type: 'string', description: 'Campaign stop time (ISO 8601).' },
      deleteConfirmed: {
        type: 'boolean',
        description: 'Required when status="DELETED" — deletion is irreversible via the API.',
      },
      adsetBudgets: {
        type: 'array',
        description:
          "Toggles the campaign between Campaign Budget Optimization (CBO) and Ad Set Budget (ABO) using Meta's adset_budgets mechanism — converts an existing CBO campaign to ABO in place, no need to recreate the campaign. Must include every non-deleted, non-archived ad set under the campaign (Meta rejects the request otherwise). Each entry needs adsetId plus exactly one of dailyBudget or lifetimeBudget.",
        items: {
          type: 'object',
          properties: {
            adsetId: { type: 'string' },
            dailyBudget: { type: 'number' },
            lifetimeBudget: { type: 'number' },
          },
          required: ['adsetId'],
        },
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['campaignId'],
  };
}

function createGetTargetingOptionsInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      type: {
        type: 'string',
        enum: [
          'interests',
          'behaviors',
          'demographics',
          'industries',
          'life_events',
          'work_employers',
          'work_positions',
        ],
        description:
          'Targeting option type to search. work_employers/work_positions results are id/name pairs for the workEmployers/workPositions params on ads_create_adset.',
      },
      query: { type: 'string', description: 'Search keyword to filter targeting options.' },
      limit: { type: 'number', description: 'Maximum results to return (default: 25).' },
    },
    required: ['type'],
  };
}

function createEcommerceLaunchInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      campaignName: { type: 'string', description: 'Campaign name. MVP uses OUTCOME_SALES.' },
      adSetName: { type: 'string', description: 'Ad set name.' },
      adName: { type: 'string', description: 'Ad name.' },
      pageId: { type: 'string', description: 'Meta Page ID used in object_story_spec.' },
      pixelId: {
        type: 'string',
        description: 'Meta Pixel ID for ecommerce conversion optimization.',
      },
      destinationUrl: { type: 'string', description: 'Product or landing page URL.' },
      dailyBudget: { type: 'number', description: 'Daily budget in account minor currency units.' },
      countries: {
        type: 'array',
        items: { type: 'string' },
        description: 'ISO country codes, e.g. ["ID"].',
      },
      primaryText: { type: 'string', description: 'Primary ad text.' },
      headline: { type: 'string', description: 'Ad headline.' },
      description: { type: 'string', description: 'Optional ad description.' },
      imageHash: {
        type: 'string',
        description:
          'Uploaded Meta image hash. Required for static creative unless imageFilePath is provided.',
      },
      imageFilePath: {
        type: 'string',
        description:
          'Local image file path. Alternative to imageHash — auto-uploads before creative creation.',
      },
      videoFilePath: {
        type: 'string',
        description:
          'Local video file path. Alternative to videoId — auto-uploads before creative creation.',
      },
      callToActionType: {
        type: 'string',
        enum: ['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER'],
      },
      specialAdCategories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Meta special ad categories. Defaults to [] only when not applicable.',
      },
      ageMin: { type: 'number' },
      ageMax: { type: 'number' },
      publisherPlatforms: { type: 'array', items: { type: 'string' } },
      instagramUserId: { type: 'string', description: 'Instagram user ID for IG posting.' },
      threadsProfileId: { type: 'string', description: 'Threads profile ID for Threads posting.' },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: [
      'accountId',
      'campaignName',
      'adSetName',
      'adName',
      'pageId',
      'pixelId',
      'destinationUrl',
      'dailyBudget',
      'countries',
      'primaryText',
      'headline',
    ],
  };
}

function parseProvider(provider: unknown): AdsProviderId | undefined {
  if (provider === undefined) {
    return undefined;
  }

  if (isAdsProviderId(provider)) {
    return provider;
  }

  return provider as never;
}

function parseProviders(providers: unknown): AdsProviderId[] | undefined {
  if (!Array.isArray(providers)) {
    return undefined;
  }

  return providers.map((provider) => (isAdsProviderId(provider) ? provider : (provider as never)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createAdsInputSchema(required: string[]) {
  return {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['meta', 'tiktok', 'google'],
        description: 'Ads provider. Defaults to meta when omitted.',
      },
      providers: {
        type: 'array',
        items: { type: 'string', enum: ['meta', 'tiktok', 'google'] },
        description: 'Multi-provider reporting input for supported read providers.',
      },
      accountId: {
        type: 'string',
        description: 'Provider account id. Optional when credentials include a default account.',
      },
      since: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format.',
      },
      until: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format.',
      },
      params: {
        type: 'object',
        description: 'Optional provider-safe parameters such as limit and breakdowns.',
        additionalProperties: true,
      },
    },
    required,
  };
}

function createLaunchReadinessInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      workflow: {
        type: 'string',
        enum: [...META_LAUNCH_WORKFLOW_INPUT_VALUES],
        description:
          'Canonical Meta v25 workflow. Legacy aliases are accepted for compatibility and normalize to canonical output. Defaults to sales_website when omitted.',
      },
      objective: {
        type: 'string',
        enum: [...META_ODAX_OBJECTIVES],
        description: 'Optional ODAX objective override for the workflow.',
      },
      conversionLocation: {
        type: 'string',
        enum: [...META_CONVERSION_LOCATIONS],
        description: 'Optional conversion location override for the workflow.',
      },
      optimizationGoal: { type: 'string', description: 'Optional Meta optimization goal.' },
      creativeFormat: {
        type: 'string',
        enum: [...META_CREATIVE_FORMATS],
        description: 'Optional intended creative format to validate against the resolved workflow.',
      },
      apiVersion: { type: 'string', description: 'Meta Marketing API version, defaults to v25.0.' },
      productOrOffer: { type: 'string', description: 'Product or offer being promoted.' },
      pageId: { type: 'string', description: 'Meta Page ID.' },
      pixelId: { type: 'string', description: 'Meta Pixel ID for conversion workflows.' },
      destinationUrl: { type: 'string', description: 'Website, marketplace, or WhatsApp URL.' },
      dailyBudget: { type: 'number', description: 'Daily budget in account minor units.' },
      countries: { type: 'array', items: { type: 'string' }, description: 'Target countries.' },
      primaryText: { type: 'string', description: 'Primary ad text.' },
      headline: { type: 'string', description: 'Ad headline.' },
      imageHash: { type: 'string', description: 'Existing Meta image hash.' },
      videoId: { type: 'string', description: 'Existing Meta video ID.' },
      imageFilePath: { type: 'string', description: 'Local image path for upload.' },
      videoFilePath: { type: 'string', description: 'Local video path for upload.' },
      creativeId: { type: 'string', description: 'Existing creative ID.' },
      existingPostId: { type: 'string', description: 'Existing object_story_id/post ID.' },
      whatsappPhoneNumberId: { type: 'string', description: 'WhatsApp phone number ID.' },
      businessId: { type: 'string', description: 'Meta Business ID for catalog discovery.' },
      catalogId: { type: 'string', description: 'Meta product catalog ID.' },
      productSetId: { type: 'string', description: 'Meta product set ID.' },
      leadFormId: { type: 'string', description: 'Published Meta Instant Form ID.' },
      applicationId: { type: 'string', description: 'Meta application ID for app promotion.' },
      objectStoreUrl: {
        type: 'string',
        description: 'App Store or Play Store URL for app promotion.',
      },
      appDeepLinkUrl: { type: 'string', description: 'Optional app deep-link URL.' },
      specialAdCategories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Special ad categories, or [] after confirming none apply.',
      },
    },
    required: ['accountId'],
  };
}

function createBusinessIdInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      businessId: { type: 'string', description: 'Meta Business ID.' },
      limit: { type: 'number', description: 'Maximum rows to return.' },
    },
    required: ['businessId'],
  };
}

function createCatalogIdInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      catalogId: { type: 'string', description: 'Meta Product Catalog ID.' },
      limit: { type: 'number', description: 'Maximum rows to return.' },
    },
    required: ['catalogId'],
  };
}

function createInstagramMediaInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      igUserId: {
        type: 'string',
        description: 'Instagram Business Account ID (from ads_list_instagram_accounts).',
      },
      limit: { type: 'number', description: 'Maximum rows to return per page.' },
      cursor: { type: 'string', description: 'Pagination cursor from a previous call.' },
      permalinkUrls: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Raw instagram.com post/reel/tv URLs to resolve into media IDs by matching shortcode. When set, only matching media is returned.',
      },
    },
    required: ['igUserId'],
  };
}

function createPerformanceInputSchema(required: string[]) {
  const schema = createAdsInputSchema(required);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      level: {
        type: 'string',
        enum: [...ADS_ENTITY_LEVELS],
        description: 'Normalized entity level. Defaults to campaign when omitted.',
      },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Normalized metric names to request when supported.',
      },
      dimensions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Normalized dimensions to include in rows.',
      },
      breakdowns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Provider-supported breakdowns such as date, country, platform, or placement.',
      },
      filters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            operator: { type: 'string', enum: [...ADS_FILTER_OPERATORS] },
            value: {
              anyOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'boolean' },
                {
                  type: 'array',
                  minItems: 1,
                  items: {
                    anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
                  },
                },
              ],
            },
          },
          required: ['field', 'operator', 'value'],
          additionalProperties: false,
        },
        description: 'Explicit filters over normalized or provider-supported fields.',
      },
      sortBy: {
        type: 'string',
        description: 'Metric or dimension used for sorting.',
      },
      sortDirection: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort direction.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return.',
      },
      cursor: {
        type: 'string',
        description: 'Opaque pagination cursor from a previous response.',
      },
    },
  };
}

export function safeAdsMcpError(error: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${redactErrorMessage(error instanceof Error ? error.message : 'Unknown error')}`,
      },
    ],
    isError: true,
  };
}
