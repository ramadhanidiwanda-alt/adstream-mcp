import { AD_PREVIEW_FORMATS } from '../tools/getAdPreview.js';
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
  CreateProductAudienceResult,
  CreateCustomAudienceResult,
  CreatePixelResult,
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
import {
  RESERVED_REQUEST_KEYS,
  TOOL_PARAM_HINTS,
  type ToolParamContract,
  deriveAllowedParamKeys,
  findUnknownParamKeys,
  formatUnknownParamsMessage,
} from './toolParamContract.js';
import {
  LOCATION_BREAKDOWNS,
  META_CREATABLE_CREATIVE_FORMATS,
  type MetaPageWelcomeMessage,
} from '../types.js';
import {
  META_CONVERSION_LOCATIONS,
  META_MESSAGING_DESTINATIONS,
  META_ODAX_OBJECTIVES,
} from '../providers/meta/objectiveLaunchMatrix.js';
import { META_LAUNCH_WORKFLOW_INPUT_VALUES } from '../tools/checkLaunchReadiness.js';
import {
  CHANGE_HISTORY_DEFAULT_SCAN_PAGES,
  CHANGE_HISTORY_MAX_SCAN_PAGES,
  META_ACTIVITY_CATEGORIES,
} from '../providers/meta/MetaAdsAdapter.js';
import {
  createWelcomeMessageTemplate,
  listWelcomeMessageTemplates,
} from '../tools/welcomeMessageTemplates.js';

export const ADS_MCP_TOOL_NAMES = [
  'ads_list_accounts',
  'ads_list_campaigns',
  'ads_check_launch_readiness',
  'ads_get_performance',
  'ads_get_creatives',
  'ads_resolve_creative_assets',
  'ads_list_welcome_message_templates',
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
  'ads_create_welcome_message_template',
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
  'ads_delete_audience',
  'ads_update_adset',
  'ads_update_ad',
  'ads_update_campaign',
  'ads_clone_adset',
  'ads_get_targeting_options',
  'ads_create_ecommerce_campaign_bundle',
  'ads_create_cpas_catalog_bundle',
  'ads_create_product_audience',
  'ads_create_custom_audience',
  'ads_create_pixel',
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
  'ads_list_lead_forms',
  'ads_list_instagram_accounts',
  'ads_list_instagram_media',
  'ads_list_partnership_content',
  'ads_list_threads_profiles',
  'ads_list_pixels',
  'ads_list_audiences',
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
  'ads_delete_audience',
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
  'ads_create_welcome_message_template',
  'ads_create_campaign',
  'ads_create_adset',
  'ads_create_adcreative',
  'ads_create_ad',
  'ads_clone_ui_ad',
  'ads_create_ecommerce_campaign_bundle',
  'ads_create_cpas_catalog_bundle',
  'ads_create_product_audience',
  'ads_create_custom_audience',
  'ads_create_pixel',
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
  if (name === 'ads_archive_ad' || name === 'ads_delete_audience') return true;

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
    inputSchema: createLimitOnlyInputSchema('Maximum accounts to return. Meta only.'),
  },
  {
    name: 'ads_list_campaigns',
    description:
      'List campaigns under an ad account through the AdsBroker. Returns bid_strategy plus daily_budget/lifetime_budget when the campaign holds its own budget (Advantage campaign budget); Meta omits the budget fields when the budget lives on the ad sets instead, so their absence identifies a non-CBO campaign. Those three fields decide whether the one-optimization_goal-per-campaign rule applies to ad-set writes.',
    inputSchema: createListCampaignsInputSchema(),
  },
  {
    name: 'ads_check_launch_readiness',
    description:
      'Read-only launch checklist for Meta or TikTok (provider param). For Meta, resolves one of the six ODAX objectives into a canonical workflow, required inputs, and setup spec; for TikTok, resolves an objective_type via tiktokObjectiveType into its required launch fields. Does not perform writes.',
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
    name: 'ads_resolve_creative_assets',
    description:
      'Read-only Meta creative asset resolver for reports with local thumbnails. Returns ranked image/video thumbnail URL candidates with width, height, source, and quality metadata. It does not download files or create a report. For highest quality it resolves image_hash via /adimages, video_id via /{video_id}/thumbnails, and requests AdCreative thumbnail_url with thumbnail_width/thumbnail_height fallback.',
    inputSchema: createCreativeAssetsInputSchema(),
  },
  {
    name: 'ads_list_welcome_message_templates',
    description:
      'List reusable local welcome message templates stored by adstream-mcp. These are local MCP templates, not WhatsApp Business message templates.',
    inputSchema: createWelcomeMessageTemplateListInputSchema(),
  },
  {
    name: 'ads_get_change_history',
    description:
      'Canonical read-only change history tool. Filter Meta activity by campaign, ad set, ad, creative, category, actor, and time. Returns the actor and originating application when Meta provides them; unsupported providers return NOT_IMPLEMENTED.',
    inputSchema: createChangeHistoryInputSchema(),
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
    inputSchema: createAccountPerformanceInputSchema(),
  },
  {
    name: 'ads_get_campaign_performance',
    description:
      'Legacy alias: fetch normalized campaign performance. Prefer ads_get_performance with level campaign for new clients. Optional params.campaignId (string or string[]) restricts results to specific campaign(s) server-side.',
    inputSchema: createLegacyPerformanceInputSchema('campaign'),
  },
  {
    name: 'ads_get_adset_or_adgroup_performance',
    description:
      'Legacy alias: fetch normalized ad set or ad group performance. Prefer ads_get_performance with level adset or adgroup for new clients. Optional params.campaignId and params.adsetId (each string or string[]) restrict results server-side.',
    inputSchema: createLegacyPerformanceInputSchema('adset'),
  },
  {
    name: 'ads_get_ad_performance',
    description:
      'Legacy alias: fetch normalized ad performance. Prefer ads_get_performance with level ad for new clients. Optional params.campaignId, params.adsetId, and params.adId (each string or string[]) restrict results server-side.',
    inputSchema: createLegacyPerformanceInputSchema('ad'),
  },
  {
    name: 'ads_get_creative_performance',
    description:
      'Legacy alias: fetch normalized creative performance. Prefer ads_get_creatives or ads_get_performance with level creative for new clients.',
    inputSchema: createCreativePerformanceInputSchema(),
  },
  {
    name: 'ads_get_placement_performance',
    description:
      'Legacy alias: fetch platform and placement performance. Prefer ads_get_performance with placement breakdowns for new clients.',
    inputSchema: createPlacementPerformanceInputSchema(),
  },
  {
    name: 'ads_content_matrix',
    description:
      'Legacy skill-owned workflow: return data-only ad/creative performance matrix grouped by campaign or adset. Prefer skill workflows over ads_get_performance and ads_get_creatives for new clients.',
    inputSchema: createContentMatrixInputSchema(),
  },
  {
    name: 'ads_generate_report',
    description:
      'Legacy skill-owned workflow: generate an ads report through the AdsBroker. Prefer AI/skill report workflows over canonical data tools for new clients.',
    inputSchema: createGenerateReportInputSchema(),
  },
  {
    name: 'ads_create_welcome_message_template',
    description:
      'Create or replace a reusable local welcome message template. Later pass welcomeMessageTemplateName to ads_create_adcreative to expand it into creativeSpec.pageWelcomeMessage.',
    inputSchema: createWelcomeMessageTemplateCreateInputSchema(),
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
      'Create a Meta or TikTok ad campaign (provider param) with a specified objective — objective for Meta ODAX, objectiveType for TikTok. Dry-run by default. Set dryRun=false and confirmed=true to execute. Campaign is created PAUSED by default.',
    inputSchema: createCreateCampaignInputSchema(),
  },
  {
    name: 'ads_create_adset',
    description:
      'Create a Meta ad set or TikTok ad group (provider param) under an existing campaign. Dry-run by default. Set dryRun=false and confirmed=true to execute. Ad set is created PAUSED by default.',
    inputSchema: createCreateAdSetInputSchema(),
  },
  {
    name: 'ads_create_adcreative',
    description:
      'Create a Meta ad creative with image/video, headline, body/caption, CTA, carousel cards, or asset customization. Yang dinonaktifkan hanya asset_feed_spec TANPA asset_customization_rules (jalur Dynamic Creative, Meta yang memilih aset); asset_feed_spec DENGAN asset_customization_rules tetap boleh dan minimal 2 rules — jumlah headline/caption bukan penentunya. Jika marketer meminta variasi headline/caption/copy/image/video, default-nya buat beberapa manual creative/ad terpisah, carousel cards, atau asset customization per placement/language/segment dengan asset_customization_rules; jangan set ad set jadi Dynamic Creative. Gunakan optOutEnhancements untuk disable Advantage+ Creative enhancement. params BUKAN passthrough mentah ke Graph API — hanya field yang terdaftar di schema ini yang dikirim, field lain ditolak dengan error (bukan diabaikan diam-diam). Dry-run by default. Set dryRun=false and confirmed=true to execute.',
    inputSchema: createCreateAdCreativeInputSchema(),
    strictParams: true,
  },
  {
    name: 'ads_create_ad',
    description:
      'Create a Meta or TikTok ad (provider param). Meta: links an existing ad set to an existing creative via creativeId. TikTok: creates inline creatives on an existing ad group via creatives. Dry-run by default. Set dryRun=false and confirmed=true to execute. Ad is created PAUSED by default.',
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
    name: 'ads_delete_audience',
    description:
      'Permanently delete a Meta Custom Audience (including a dynamic product audience created by ads_create_product_audience — those are Custom Audience objects once created). Cannot be reverted via the API. Dry-run by default. Set dryRun=false and confirmed=true to execute. Also requires ADSTREAM_ENABLE_DESTRUCTIVE_ACTIONS=true.',
    inputSchema: createDeleteAudienceInputSchema(),
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
      'Update an existing Meta ad (name, status, or swap its creative). Use creativeId to point the ad at a different, already-created creative. Alternatively, multiMedia creates a documented standalone multi-media creative then swaps this same ad ID to it, preserving the ad name and ad set; it cannot be combined with other updates. On the multiMedia path only, an ACTIVE ad is paused before the swap and never resumed automatically; a plain creativeId swap leaves the ad status untouched. Read-back verifies the creative ID and every submitted image hash. Dry-run by default. Set dryRun=false and confirmed=true to execute.',
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
    name: 'ads_create_cpas_catalog_bundle',
    description:
      'Create a PAUSED Meta Sales CPAS catalog bundle. Dry-run by default; productSetId is verified before any write.',
    inputSchema: createCpasCatalogBundleInputSchema(),
  },
  {
    name: 'ads_create_product_audience',
    description:
      'Create a Meta dynamic product audience for CPAS catalog retargeting (e.g. "viewed but did not purchase in 14 days"). Built from productSetId + inclusions (events: ViewContent, AddToCart, Purchase, Search, each with a retentionSeconds window) and optional exclusions. The created audience becomes a Custom Audience — pass its id into ads_create_adset targeting.customAudiences. Dry-run by default; set dryRun=false and confirmed=true to execute.',
    inputSchema: createProductAudienceInputSchema(),
  },
  {
    name: 'ads_create_custom_audience',
    description:
      "Create a Meta WEBSITE custom audience (pixel-based website-visitor retargeting). Only subtype WEBSITE is supported. rule is the raw Website Custom Audience Rule object from Meta's Audience rule builder/API reference — this MCP passes it through as-is rather than reinterpreting it. Dry-run by default; set dryRun=false and confirmed=true to execute. Pastikan pixelId sesuai dengan pixel yang direferensikan di dalam event sources milik rule — Meta tidak melakukan cross-validation antara keduanya, jadi ketidakcocokan tidak akan terdeteksi otomatis.",
    inputSchema: createCustomAudienceInputSchema(),
  },
  {
    name: 'ads_create_pixel',
    description:
      'Create a Meta Pixel for conversion tracking (POST /act_{id}/adspixels). Only name is required. An ad account can only have one pixel — creating a second one on an account that already has one fails with a clear error identifying the existing pixel; use ads_list_pixels to find it instead of retrying. Dry-run by default; set dryRun=false and confirmed=true to execute.',
    inputSchema: createPixelInputSchema(),
  },
  {
    name: 'ads_get_video_source',
    description:
      'Get the raw video source URL (MP4), embed HTML, and thumbnail for a Meta video ID. Calls GET /{video_id}?fields=source,embed_html,picture.',
    inputSchema: createVideoSourceInputSchema(),
  },
  {
    name: 'ads_get_ad_creative_mapping',
    description:
      "Get the creative_id for each ad in an account. Calls GET /act_{id}/ads?fields=id,name,creative{{id}} — or the nested /{campaign_id}/ads or /{adset_id}/ads edge when scoped, since Meta does not support scoping the account-level /ads edge via filtering. Use this to link ad performance data (from ads_get_ad_performance) with creative assets (from ads_get_creative_performance). Optional params: adIds[] (filter specific ads), campaignId, adSetId (each a string or string[] — these DO scope the result; without one you get the account's most recent ads), filtering (raw Meta filtering rules), limit, cursor.",
    inputSchema: createAdCreativeMappingInputSchema(),
  },
  {
    name: 'ads_upload_image',
    description:
      'Upload a local image file to the ad account image library. Meta: returns image_hash, .jpg/.jpeg/.png, max 30 MB. TikTok: returns image_id (returned in the same image_hash field), .jpg/.jpeg/.png, max 30 MB.',
    inputSchema: createUploadInputSchema(['filePath']),
  },
  {
    name: 'ads_upload_video',
    description:
      'Upload a local video file to the ad account video library. Meta: returns video_id, .mp4/.mov/.avi/.wmv, max 1 GB, async processing. TikTok: returns video_id, .mp4/.mov, max 1 GB.',
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
    inputSchema: createListAdVideosInputSchema(),
  },
  {
    name: 'ads_get_ad_preview',
    description:
      "Get a preview URL for a Meta ad creative in a specific ad format. Returns preview URL, platform, and ad format. Calls GET /{creative_id}/previews. Required params: creativeId, adFormat. adFormat uses Meta's own ad_format enum (e.g. DESKTOP_FEED_STANDARD, MOBILE_FEED_STANDARD, INSTAGRAM_STANDARD, INSTAGRAM_STORY, INSTAGRAM_REELS, FACEBOOK_STORY_MOBILE, MESSENGER_MOBILE_INBOX_MEDIA, MARKETPLACE_MOBILE, WATCH_FEED_HOME) — the short spellings such as INSTAGRAM_FEED or INSTAGRAM_STORIES are not valid and are rejected with the corrected name.",
    inputSchema: createPreviewInputSchema(),
  },
  {
    name: 'ads_get_ad_destinations',
    description:
      'Get destination URLs from ads with their creative metadata. Fetches ads with object_story_spec and asset_feed_spec, then extracts the destination URL for each creative type (link, video, carousel, Advantage+, existing post). Supports status filtering plus optional params.campaignId and params.adSetId (each string or string[]) to restrict results to a specific campaign/ad set server-side. Calls GET /act_{id}/ads?fields=id,name,status,effective_status,creative{id,object_type,object_story_spec,asset_feed_spec}.',
    inputSchema: createAdDestinationsInputSchema(),
  },
  {
    name: 'ads_read_creative_full',
    description:
      'Read the full configuration of a Meta Ad Creative — a reverse engineering tool that returns ALL fields from the /{creative_id}?fields=... Graph API endpoint. Use this to inspect a working ad creative from Meta Ads Manager and see its complete payload (object_story_spec, asset_feed_spec, call_to_action, page_welcome_message, tracking_specs, degrees_of_freedom_spec, etc.). Ideal for reverse engineering new ad features (CTWA, Carousel, DCO, Catalog, Advantage+). Requires creativeId.',
    inputSchema: createReadCreativeFullInputSchema(),
    strictParams: true,
  },
  {
    name: 'ads_read_adset_full',
    description:
      'Read the full configuration of Meta Ad Sets (targeting, custom audiences, budget, bid strategy, optimization goal, placements, schedule). Three modes: pass adsetId for one ad set; pass campaignId for all ad sets in a campaign; pass neither (account only) for all ad sets in the account. List modes support limit and cursor. Read-only. Use this to replicate an existing ad set configuration.',
    inputSchema: createReadAdSetFullInputSchema(),
    strictParams: true,
  },
  {
    name: 'ads_list_pages',
    description:
      'List Meta Pages accessible by the token for selecting a valid pageId for ad creative object_story_spec.',
    inputSchema: createLimitOnlyInputSchema('Maximum Pages to return.'),
  },
  {
    name: 'ads_list_lead_forms',
    description:
      'List published Meta Instant Forms owned by a selected Facebook Page. Read-only asset discovery for lead-form launches.',
    inputSchema: createLeadFormsInputSchema(),
  },
  {
    name: 'ads_list_instagram_accounts',
    description: "List Instagram Business Accounts connected to the user's Facebook Pages.",
    inputSchema: createLimitOnlyInputSchema('Maximum Instagram Business Accounts to return.'),
  },
  {
    name: 'ads_list_instagram_media',
    description:
      'List media (feed posts, Reels, carousels) for an Instagram Business Account. Calls GET /{ig-user-id}/media. Requires igUserId (from ads_list_instagram_accounts). Pass permalinkUrls (raw instagram.com/reel or /p URLs pasted by a user) to resolve them into media IDs by matching shortcode — paginates up to 10 pages looking for matches and returns only the matched media, ready to use as sourceInstagramMediaId on an existing_post ad creative.',
    inputSchema: createInstagramMediaInputSchema(),
  },
  {
    name: 'ads_list_partnership_content',
    description:
      'Discovery konten kemitraan (branded content, UGC, affiliate, Collab post) lintas Instagram dan Facebook dalam satu endpoint. Calls GET /{business-id}/partnership-ads-advertisable-content. Pakai sebelum membuat Partnership Ads untuk menemukan konten kreator yang boleh diiklankan, status izinnya, ad code yang tersedia, dan metrik organiknya. Wajib businessId plus minimal satu dari fbPageId atau igUserId — bila keduanya diisi, kedua akun harus sudah ter-link. Butuh scope business_management plus instagram_branded_content_ads_brand dan/atau facebook_branded_content_ads_brand; hanya satu scope berarti hasil terbatas ke platform itu saja, dan instagram_branded_content_ads_brand tanpa instagram_basic menghasilkan 403. contentId hasilnya dipakai sebagai creativeSpec.sourceInstagramMediaId pada ads_create_adcreative creativeFormat existing_post HANYA untuk baris ber-platform INSTAGRAM; baris ber-platform FACEBOOK adalah post ID Facebook, yang masuk lewat creativeSpec.objectStoryId.',
    inputSchema: createPartnershipContentInputSchema(),
  },
  {
    name: 'ads_list_threads_profiles',
    description: "List Threads profiles connected to the user's Facebook Pages.",
    inputSchema: createLimitOnlyInputSchema('Maximum Threads profiles to return.'),
  },
  {
    name: 'ads_list_pixels',
    description:
      'List Meta Pixels connected to an ad account. Use before website sales, lead, or CPAS workflows when the user does not know their pixel ID. Calls GET /act_{id}/adspixels.',
    inputSchema: createLimitOnlyInputSchema('Maximum pixels to return.'),
  },
  {
    name: 'ads_list_audiences',
    description:
      'List Meta Custom Audiences (including dynamic product audiences created by ads_create_product_audience) connected to an ad account. Use to find an audience id before passing it into ads_create_adset targeting.customAudiences, or to check an audience is ready (delivery_status) before targeting it. Calls GET /act_{id}/customaudiences.',
    inputSchema: createLimitOnlyInputSchema('Maximum audiences to return.'),
  },
  {
    name: 'ads_list_catalogs',
    description:
      'List product catalogs a Meta Business can use: catalogs it owns, plus catalog segments a retailer has shared with it via Collaborative Ads (CPAS) — a CPAS brand typically owns none, only the shared segments. Each result is tagged source: owned | client; client rows include permitted_roles. Use before CPAS/catalog sales workflows when the user does not know the catalog ID. Requires businessId.',
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
    inputSchema: createListWhatsAppAccountsInputSchema(),
  },
  {
    name: 'ads_list_whatsapp_phone_numbers',
    description:
      'List phone numbers associated with a WhatsApp Business Account (WABA). Returns phone_number_id needed for CTWA creative setup. Calls GET /{wabaId}/phone_numbers.',
    inputSchema: createListWhatsAppPhoneNumbersInputSchema(),
  },
  {
    name: 'ads_list_whatsapp_message_templates',
    description:
      'List WhatsApp message templates for a WABA. Supports filtering by name and status (APPROVED, PENDING, REJECTED). Calls GET /{wabaId}/message_templates.',
    inputSchema: createListWhatsAppMessageTemplatesInputSchema(),
  },
  // --- TikTok GMV Max ---
  {
    name: 'tiktok_gmv_max_create_campaign',
    description:
      'Create a TikTok GMV Max campaign for Shop sellers. Requires store_ids, objective_type, campaign_name, and budget.',
    inputSchema: createGmvMaxCampaignInputSchema(),
  },
  {
    name: 'tiktok_gmv_max_update_campaign',
    description: 'Update a TikTok GMV Max campaign (name, budget, status).',
    inputSchema: createGmvMaxUpdateCampaignInputSchema(),
  },
  {
    name: 'tiktok_gmv_max_create_session',
    description:
      'Create a GMV Max session (sale event) for an existing GMV Max campaign. Requires session_name, start_time, end_time.',
    inputSchema: createGmvMaxCreateSessionInputSchema(),
  },
  {
    name: 'tiktok_gmv_max_update_session',
    description: 'Update a GMV Max session (name, budget, time).',
    inputSchema: createGmvMaxUpdateSessionInputSchema(),
  },
  {
    name: 'tiktok_gmv_max_delete_session',
    description: 'Delete a GMV Max session.',
    inputSchema: createGmvMaxSessionIdInputSchema(),
  },
  {
    name: 'tiktok_gmv_max_get_campaign_info',
    description: 'Get detailed info for one or more GMV Max campaigns by campaign_ids.',
    inputSchema: createGmvMaxCampaignInfoInputSchema(),
  },
  // --- TikTok Smart Plus ---
  {
    name: 'tiktok_smart_plus_create_campaign',
    description:
      'Create a TikTok Smart Plus campaign (Advantage+ equivalent). TikTok handles targeting and creatives automatically.',
    inputSchema: createSmartPlusCreateCampaignInputSchema(),
  },
  {
    name: 'tiktok_smart_plus_pause_campaign',
    description: 'Pause a TikTok Smart Plus campaign.',
    inputSchema: createSmartPlusCampaignIdInputSchema(),
  },
  {
    name: 'tiktok_smart_plus_resume_campaign',
    description: 'Resume a paused TikTok Smart Plus campaign.',
    inputSchema: createSmartPlusCampaignIdInputSchema(),
  },
  {
    name: 'tiktok_smart_plus_create_adgroup',
    description:
      'Create a TikTok Smart Plus ad group. TikTok handles targeting and creatives automatically.',
    inputSchema: createSmartPlusCreateAdGroupInputSchema(),
  },
  {
    name: 'tiktok_smart_plus_pause_adgroup',
    description: 'Pause a TikTok Smart Plus ad group.',
    inputSchema: createSmartPlusAdGroupIdInputSchema(),
  },
  {
    name: 'tiktok_smart_plus_resume_adgroup',
    description: 'Resume a paused TikTok Smart Plus ad group.',
    inputSchema: createSmartPlusAdGroupIdInputSchema(),
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

  const unknownParams = unknownParamsResponse(name, args);
  if (unknownParams) return unknownParams;

  const localResponse = await callLocalAdsTool(name, args);
  if (localResponse) {
    const safeResponse = stripRawFromResponse(
      redactTokenLikeValues(localResponse)
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

async function callLocalAdsTool(
  name: AdsMcpToolName,
  args: Record<string, unknown>
): Promise<AdsBrokerResponse | undefined> {
  try {
    switch (name) {
      case 'ads_create_welcome_message_template':
        return {
          ok: true,
          provider: 'meta',
          data: await createWelcomeMessageTemplate({
            name: typeof args.name === 'string' ? args.name : '',
            pageWelcomeMessage: args.pageWelcomeMessage as MetaPageWelcomeMessage,
          }),
        };
      case 'ads_list_welcome_message_templates':
        return {
          ok: true,
          provider: 'meta',
          data: await listWelcomeMessageTemplates({
            name: typeof args.name === 'string' ? args.name : undefined,
          }),
        };
      default:
        return undefined;
    }
  } catch (error) {
    return {
      ok: false,
      provider: 'meta',
      errors: [
        {
          provider: 'meta',
          code: 'WELCOME_MESSAGE_TEMPLATE_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
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

  for (const [key, value] of Object.entries(args)) {
    if (!RESERVED_REQUEST_KEYS.has(key)) params[key] = value;
  }

  return params;
}

/**
 * A tool opts into the strict params contract with `strictParams: true` on its
 * definition, right next to the schema the allowlist is derived from. Tools
 * without the flag keep today's permissive behavior: many of them declare only
 * the shared envelope while their adapter reads documented params keys (see
 * ads_list_campaigns and params.limit), so rejecting by default would break
 * calls that are correct today.
 */
function isStrictParamsTool(tool: object): boolean {
  return 'strictParams' in tool && (tool as { strictParams?: unknown }).strictParams === true;
}

const STRICT_PARAM_CONTRACTS = new Map<string, ToolParamContract | undefined>();

function getStrictParamContract(name: AdsMcpToolName): ToolParamContract | undefined {
  if (STRICT_PARAM_CONTRACTS.has(name)) return STRICT_PARAM_CONTRACTS.get(name);

  const definition = ADS_MCP_TOOL_DEFINITIONS.find((tool) => tool.name === name);
  const contract =
    definition && isStrictParamsTool(definition)
      ? {
          allowed: deriveAllowedParamKeys(definition.inputSchema),
          hints: TOOL_PARAM_HINTS[name] ?? {},
        }
      : undefined;

  STRICT_PARAM_CONTRACTS.set(name, contract);
  return contract;
}

/**
 * Unknown keys a strict tool would otherwise swallow. Empty for tools that have
 * not opted in. Exported so tests can assert acceptance per tool without going
 * through a broker stub.
 */
export function findUnknownToolParams(
  name: AdsMcpToolName,
  args: Record<string, unknown>
): string[] {
  const contract = getStrictParamContract(name);
  if (!contract) return [];

  return findUnknownParamKeys(extractParams(args), contract.allowed);
}

function unknownParamsResponse(
  name: AdsMcpToolName,
  args: Record<string, unknown>
): { content: Array<{ type: 'text'; text: string }>; isError: true } | undefined {
  const contract = getStrictParamContract(name);
  if (!contract) return undefined;

  const unknown = findUnknownParamKeys(extractParams(args), contract.allowed);
  if (unknown.length === 0) return undefined;

  const provider = parseProvider(args.provider) ?? 'meta';
  const body = {
    ok: false,
    provider,
    errors: [
      {
        provider,
        code: 'UNKNOWN_PARAM',
        message: formatUnknownParamsMessage(unknown, contract.hints),
      },
    ],
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
    isError: true,
  };
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
    case 'ads_check_launch_readiness': {
      const provider = request.provider ?? 'meta';
      const readinessParams =
        provider === 'tiktok'
          ? {
              ...request.params,
              objectiveType: request.params.tiktokObjectiveType ?? request.params.objectiveType,
              writesEnabled: areAdsWriteToolsEnabled(),
            }
          : { ...request.params, writesEnabled: areAdsWriteToolsEnabled() };
      return broker.checkLaunchReadiness({ ...request, params: readinessParams });
    }
    case 'ads_get_performance':
      return callCanonicalPerformanceTool(broker, request);
    case 'ads_get_creatives':
      return broker.getCreativePerformance({
        ...request,
        params: { ...request.params, level: 'creative' },
      });
    case 'ads_resolve_creative_assets':
      return broker.resolveCreativeAssets(request);
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
    case 'ads_delete_audience':
      return broker.deleteAudience(request);
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
    case 'ads_create_cpas_catalog_bundle':
      return broker.createCpasCatalogCampaignBundle(request);
    case 'ads_create_product_audience':
      return broker.createProductAudience(request);
    case 'ads_create_custom_audience':
      return broker.createCustomAudience(request);
    case 'ads_create_pixel':
      return broker.createPixel(request);
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
    case 'ads_list_lead_forms':
      return broker.listLeadForms(request);
    case 'ads_list_instagram_accounts':
      return broker.listInstagramAccounts(request);
    case 'ads_list_instagram_media':
      return broker.listInstagramMedia(request);
    case 'ads_list_partnership_content':
      return broker.listPartnershipContent(request);
    case 'ads_list_threads_profiles':
      return broker.listThreadsProfiles(request);
    case 'ads_list_pixels':
      return broker.listPixels(request);
    case 'ads_list_audiences':
      return broker.listAudiences(request);
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
        gatedTools: [
          'ads_archive_ad',
          'ads_delete_audience',
          'ads_update_ad',
          'ads_update_campaign',
        ],
      },
      partnershipAds: {
        supportedProviders: ['meta'],
        discoveryTool: 'ads_list_partnership_content',
        creativeParam: 'partnership',
        creativeFormats: ['existing_post', 'single_image', 'video', 'carousel'],
        requiredScopes: [
          'ads_management',
          'business_management',
          'instagram_basic',
          'instagram_branded_content_ads_brand',
          'facebook_branded_content_ads_brand',
        ],
        notes: [
          'instagram_branded_content_ads_brand tanpa instagram_basic pada akun IG yang sama menghasilkan 403.',
          'Iklan yang dipublish tanpa izin kemitraan masuk status pending delivery sampai partner menyetujui.',
          'pageId (Page brand) selalu wajib, termasuk untuk partnership ad yang hanya tayang di Instagram.',
        ],
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

function createGmvMaxCampaignInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      advertiserId: {
        type: 'string',
        description: 'TikTok advertiser id. Takes precedence over accountId when both are sent.',
      },
      campaignName: { type: 'string', description: 'GMV Max campaign name.' },
      objectiveType: {
        type: 'string',
        description: 'TikTok objective_type for the GMV Max campaign, e.g. PRODUCT_SALES.',
      },
      storeIds: { type: 'array', items: { type: 'string' }, description: 'TikTok Shop store IDs.' },
      budget: { type: 'number', description: 'Campaign budget.' },
      budgetMode: { type: 'string', description: 'Budget mode, e.g. BUDGET_MODE_DAY.' },
      scheduleType: {
        type: 'string',
        description: 'TikTok schedule_type, e.g. SCHEDULE_FROM_NOW.',
      },
      scheduleStartTime: {
        type: 'string',
        description: 'Campaign schedule start time.',
      },
      operationStatus: {
        type: 'string',
        description: 'TikTok operation_status, ENABLE or DISABLE. Defaults to ENABLE.',
      },
      shoppingAdsType: {
        type: 'string',
        enum: ['PRODUCT', 'LIVE'],
        description:
          'PRODUCT for catalog-driven GMV Max, LIVE for livestream GMV Max. Required to pick the correct extra fields below.',
      },
      productSpecificType: {
        type: 'string',
        description: 'shopping_ads_type=PRODUCT only, e.g. ALL.',
      },
      itemGroupIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'shopping_ads_type=PRODUCT only — product item_group_ids.',
      },
      identityList: {
        type: 'array',
        items: { type: 'string' },
        description: 'shopping_ads_type=LIVE only — the LIVE source identity.',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'campaignName', 'objectiveType', 'storeIds', 'shoppingAdsType'],
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
      maxRetries: {
        type: 'number',
        description: 'How many times to retry a transient Meta upload failure. Defaults to 3.',
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
        enum: [...AD_PREVIEW_FORMATS],
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
        description:
          'Meta ODAX campaign objective. Meta-only and optional when provider is tiktok — use `objectiveType` instead.',
      },
      objectiveType: {
        type: 'string',
        enum: [
          'REACH',
          'TRAFFIC',
          'VIDEO_VIEWS',
          'ENGAGEMENT',
          'LEAD_GENERATION',
          'APP_PROMOTION',
          'WEB_CONVERSIONS',
          'PRODUCT_SALES',
        ],
        description:
          'TikTok objective_type. Use this instead of `objective` when provider is tiktok — objective is Meta-only.',
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
    required: ['accountId', 'name'],
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
        description:
          'Billing event. Meta values: IMPRESSIONS (default), LINK_CLICKS, PAGE_LIKES, POST_ENGAGEMENT, VIDEO_VIEWS, LEADS, APP_INSTALLS, REACH, VALUE, LANDING_PAGE_VIEWS, OFFSITE_CONVERSIONS. TikTok values: CPC, CPM.',
      },
      optimizationGoal: {
        type: 'string',
        description:
          'Optimization goal. Meta values: NONE, APP_INSTALLS, CONVERSATIONS, ENGAGED_USERS, IMPRESSIONS, LANDING_PAGE_VIEWS, LEAD_GENERATION, LINK_CLICKS, MESSAGING_PURCHASE_CONVERSION, OFFSITE_CONVERSIONS, PAGE_LIKES, POST_ENGAGEMENT, REACH, THRUPLAY, VALUE (required when conversionLocation is omitted). For Sales Click-to-WhatsApp, OFFSITE_CONVERSIONS with pixelId and customEventType PURCHASE optimizes on pixel purchase events. MESSAGING_PURCHASE_CONVERSION (purchases attributed through the message thread) is a different goal, gated on the Page having shared 10+ purchase events in the prior 30 days for that messaging channel; until then Meta rejects it with subcode 2490408. TikTok values are objective-specific, e.g. CLICK, LANDING_PAGE_VIEW, VIDEO_VIEW, ENGAGED_VIEW, FOLLOWERS, CONVERT, IN_APP_EVENT, REACH, LEAD_GENERATION, APP_INSTALLS, VALUE — see the TikTok objective launch matrix for the authoritative list per objective.',
      },
      conversionLocation: {
        type: 'string',
        enum: [...META_CONVERSION_LOCATIONS],
        description: 'Objective-aware Meta conversion location.',
      },
      messagingDestination: {
        type: 'string',
        enum: [...META_MESSAGING_DESTINATIONS],
        description:
          'Inbox tujuan untuk conversionLocation MESSAGING. Untuk Sales CTWA, isi WHATSAPP agar ad set memakai destination_type WHATSAPP. Target kinerja pembelian via pesan (MESSAGING_PURCHASE_CONVERSION) tidak bisa disetel lewat API; buat ad set-nya di Ads Manager lalu rapikan via ads_update_adset tanpa mengirim optimizationGoal. Jangan fallback ke CONVERSATIONS maupun OFFSITE_CONVERSIONS, keduanya target yang berbeda.',
      },
      creativeFormat: {
        type: 'string',
        enum: [...META_CREATABLE_CREATIVE_FORMATS],
        description:
          'Creative format used to validate the objective launch. Only asset_feed_spec WITHOUT asset_customization_rules (the Dynamic Creative path) is disabled for create workflows; use separate manual creative/ad variants for headline/caption/copy/image/video tests, carousel for multi-card media, or asset customization (placement/language/segment) with asset_customization_rules.',
      },
      pageId: { type: 'string', description: 'Meta Page ID for the objective launch.' },
      whatsappPhoneNumber: {
        type: 'string',
        description:
          'Display WhatsApp number for CTWA ad sets, digits only in international format (e.g. 6285156583372). Sent as promoted_object.whatsapp_phone_number.',
      },
      pixelId: { type: 'string', description: 'Meta Pixel ID for website conversions.' },
      leadFormId: { type: 'string', description: 'Meta instant form ID for lead generation.' },
      applicationId: { type: 'string', description: 'Meta application ID for app promotion.' },
      objectStoreUrl: { type: 'string', description: 'App store URL for app promotion.' },
      productSetId: { type: 'string', description: 'Meta product set ID for catalog sales.' },
      customEventType: { type: 'string', description: 'Optional Meta conversion event type.' },
      bidType: {
        type: 'string',
        description: 'TikTok bid type, e.g. BID_TYPE_NO_BID, BID_TYPE_CUSTOM.',
      },
      bidPrice: { type: 'number', description: 'TikTok bid price for the ad group.' },
      placementType: {
        type: 'string',
        enum: ['PLACEMENT_TYPE_AUTO', 'PLACEMENT_TYPE_NORMAL'],
        description: 'TikTok placement type.',
      },
      identityType: { type: 'string', description: 'TikTok identity type (e.g. CUSTOMIZED_USER).' },
      identityId: { type: 'string', description: 'TikTok identity ID shown as the ad account.' },
      appId: {
        type: 'string',
        description: "TikTok App ID for APP_PROMOTION. Distinct from Meta's applicationId.",
      },
      promotionType: {
        type: 'string',
        enum: ['APP_INSTALL', 'APP_RETARGETING'],
        description: 'TikTok APP_PROMOTION sub-type.',
      },
      optimizationEvent: {
        type: 'string',
        description: 'TikTok conversion event to optimize for (WEB_CONVERSIONS objective).',
      },
      catalogId: {
        type: 'string',
        description: 'Catalog ID. Meta: used with productSetId. TikTok: PRODUCT_SALES objective.',
      },
      storeId: { type: 'string', description: 'TikTok Shop store ID (PRODUCT_SALES objective).' },
      productSource: {
        type: 'string',
        description: 'TikTok product source, e.g. CATALOG (PRODUCT_SALES objective).',
      },
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
      dailySpendCap: {
        type: 'number',
        description:
          "Daily spend ceiling for this ad set, in account currency minor units. Ad-set-level control used to shape this ad set's share of a campaign budget. Use with a sibling ad set (one including, one excluding the existing-customer audience) to split spend across customer segments — Meta's replacement for the retired existing_customer_budget_percentage.",
      },
      dailyMinSpendTarget: {
        type: 'number',
        description:
          "Daily minimum spend target for this ad set, in account currency minor units. Ad-set-level control used to shape this ad set's share of a campaign budget. Best-effort, not guaranteed.",
      },
      lifetimeSpendCap: {
        type: 'number',
        description:
          'Lifetime spend ceiling for this ad set, in account currency minor units. Requires a lifetime budget on the campaign.',
      },
      lifetimeMinSpendTarget: {
        type: 'number',
        description:
          'Lifetime minimum spend target for this ad set, in account currency minor units. Requires a lifetime budget on the campaign. Best-effort, not guaranteed.',
      },
      ageMin: { type: 'number', description: 'Minimum age target (e.g. 18).' },
      ageMax: { type: 'number', description: 'Maximum age target (e.g. 65).' },
      ageRange: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description:
          'Advantage+ Audience age suggestion [min, max] — distinct from the hard ageMin/ageMax filter. Only meaningful when advantageAudience/targetingAutomation.advantage_audience is 1.',
      },
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
          'Disabled. Jangan diisi; MCP tidak membuat Dynamic Creative ad set karena flag ini mengunci ad set (Meta mensyaratkan ad set kosong dan hanya satu ad di dalamnya). Untuk variasi headline/caption/copy/image/video, buat beberapa manual creative/ad terpisah, carousel, atau asset customization (placement/language/segment) dengan asset_customization_rules — jalur itu justru mensyaratkan is_dynamic_creative=false.',
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
      messagingDestination: {
        type: 'string',
        enum: [...META_MESSAGING_DESTINATIONS],
        description:
          'Inbox tujuan untuk conversionLocation MESSAGING. Untuk Sales CTWA, isi WHATSAPP agar creative default ke CTA WHATSAPP_MESSAGE.',
      },
      creativeFormat: {
        type: 'string',
        enum: [
          'single_image',
          'video',
          'carousel',
          'catalog',
          'collection',
          'placement_image',
          'placement_customized_ctwa',
          'existing_post',
        ],
        description:
          'Format materi iklan: gambar tunggal, video, carousel, katalog, collection, gambar/video khusus per placement, atau postingan yang sudah ada. Yang disabled hanya asset_feed_spec tanpa asset_customization_rules (jalur Dynamic Creative); variasi headline/caption/copy/image/video dibuat sebagai beberapa creative/ad manual terpisah, carousel, atau asset customization per placement/language/segment dengan asset_customization_rules.',
      },
      creativeSpec: {
        type: 'object',
        description:
          'Detail materi sesuai creativeFormat. Jika user memberi opsi headline/caption/copy/image/video untuk testing manual, jangan isi primaryTexts/headlines; buat beberapa manual creative/ad terpisah dengan creativeFormat single_image/video/carousel dan satu media + satu primaryText + satu headline per creative, atau pakai carousel cards untuk beberapa media dalam satu carousel. Untuk create baru, asset_feed_spec TANPA asset_customization_rules (jalur Dynamic Creative) disabled; assetFeedSpec dengan asset_customization_rules tetap boleh untuk asset customization per placement/language/segment, minimal 2 rules. Field per format: single_image memakai imageHash, primaryText, destinationUrl, headline, description, callToAction, pageWelcomeMessage (opsional, untuk Click-to-WhatsApp/Messenger), dan applinkTreatment (opsional, lihat properti applinkTreatment); video memakai videoId, thumbnailImageHash (opsional — kalau kosong, otomatis diisi dari thumbnail bawaan video via GET /{videoId}?fields=picture; hanya berbahaya diabaikan kalau video belum selesai diproses Meta dan tidak punya thumbnail sama sekali), primaryText, destinationUrl, headline, description, callToAction, pageWelcomeMessage (opsional, untuk Click-to-WhatsApp/Messenger), dan applinkTreatment (opsional, lihat properti applinkTreatment); carousel memakai primaryText, destinationUrl, cards (imageHash atau videoId, headline, description, destinationUrl); catalog memakai productSetId, primaryText, destinationUrl, templateUrl, fallbackImageHash, presentation (opsional: single_image, carousel, atau video_carousel; video_carousel wajib mengisi hybridVideo { videoId, thumbnailUrl }), showMultipleImages (opsional, boolean; Meta otomatis mem-force multi_share_end_card ke false saat true — terverifikasi live di v25.0; TIDAK BOLEH dipakai bersamaan dengan formatOption, Meta menolaknya sebagai ObjectStorySpecRedundant), preferredImageTags (opsional, array tag foto katalog yang diprioritaskan; kompatibel dengan showMultipleImages maupun formatOption), formatOption (opsional, mis. carousel_slideshows), dan categorizationCriteria (opsional, category-based ads; katalog harus punya cukup item per kategori atau Meta menolak create-nya, bukan diam-diam diabaikan); collection memakai instantExperienceId, coverImageHash atau coverVideoId, productSetId, primaryText, destinationUrl; placement_image memakai asset_feed_spec khusus placement; placement_customized_ctwa memakai feedImageHash, verticalImageHash, primaryText, headline, destinationUrl, pageWelcomeMessage di link_data, platform_customizations, dan Advantage+ opt-out; existing_post memakai objectStoryId (post id Facebook Page, format {page_id}_{post_id}) ATAU sourceInstagramMediaId (media id IG yang tidak di-cross-post ke Page — dapatkan dari ads_list_instagram_media, cocokkan permalink-nya ke URL instagram.com/reel atau /p yang dimiliki user; wajib isi tepat satu dari dua field ini, KECUALI pada jalur partnership ad code (partnership.adCode) yang tidak memakai keduanya karena ad code sendiri yang menjadi referensi konten; untuk media VIDEO/Reel WAJIB juga mengisi instagramUserId tingkat atas, kalau tidak Meta menolak dengan (#100) subcode 1815279 yang keliru menyuruh mengunggah video ke Facebook — tidak perlu diunggah, Meta hanya tidak tahu akun IG pemiliknya; media IMAGE disimpulkan sendiri oleh Meta sehingga tidak butuh field itu), plus destinationUrl, callToAction, dan applinkTreatment (opsional). Untuk mengarahkan post yang di-boost ke landing page eksternal dengan tombol CTA: isi destinationUrl + callToAction (mis. LEARN_MORE). Keduanya dikirim sebagai call_to_action di LEVEL ATAS creative (call_to_action.value.link), BUKAN di dalam object_story_spec — object_story_spec bareng source_instagram_media_id ditolak Meta dengan (#100) subcode 1487929 Ambiguous Promoted Object (terverifikasi live di v25.0). Tujuan post Instagram bisa diganti bebas; post Facebook Page yang sudah punya link sendiri mungkin tetap memakai link lamanya — nilainya diteruskan dan Meta yang memutuskan. Pakai urlTags untuk tracking UTM; itu tersimpan bersama call_to_action. destinationUrl juga wajib diisi kalau collaborativeAppSpec diisi, dipakai untuk omnichannel_link_spec.web.url (CATATAN: itu pun tidak bisa memperbaiki object_store_urls yang hilang dari call_to_action post lama yang sudah dipublikasikan; untuk ad set CPAS omnichannel disarankan pakai creativeFormat video langsung). destinationUrl tanpa callToAction maupun collaborativeAppSpec akan DITOLAK, bukan diabaikan diam-diam. Untuk iklan click-to-message (Click-to-Instagram-Direct / Click-to-WhatsApp) pada existing_post: isi callToAction messaging (INSTAGRAM_MESSAGE, MESSAGE_PAGE, atau WHATSAPP_MESSAGE), appDestination (INSTAGRAM_DIRECT, MESSENGER, atau WHATSAPP), dan destinationUrl (untuk Instagram Direct gunakan https://www.instagram.com/). Kombinasi appDestination + destinationUrl dikirim sebagai call_to_action.value.app_destination dan call_to_action.value.link; Meta Graph menolak appDestination tanpa link untuk existing-post Instagram messaging. destinationUrl dengan CTA messaging tetapi tanpa appDestination tetap DITOLAK agar URL tidak ter-drop diam-diam. pageWelcomeMessage boleh berupa objek page_welcome_message VISUAL_EDITOR penuh ({ type, version, landing_screen_type, media_type, text_format.message.ice_breakers }) atau string; dikirim sebagai page_welcome_message di LEVEL ATAS creative, persis seperti yang ditulis Ads Manager, dan hanya berlaku bersama callToAction messaging. Field creativeSpec di luar daftar per format di atas DITOLAK dengan error yang menyebut field-nya, bukan dibuang diam-diam.',
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
      standardAppSpec: {
        type: 'object',
        description:
          'Kontrak aplikasi untuk OUTCOME_APP_PROMOTION + APP. Wajib isi applicationId dan objectStoreUrl; deepLinkUrl opsional dipakai untuk CTA install.',
        properties: {
          applicationId: { type: 'string' },
          objectStoreUrl: { type: 'string' },
          deepLinkUrl: { type: 'string' },
        },
        required: ['applicationId', 'objectStoreUrl'],
        additionalProperties: false,
      },
      partnership: {
        type: 'object',
        description:
          'Identitas kemitraan untuk Meta Partnership Ads (iklan kolaborasi dengan kreator/partner; dulu Branded Content Ads). Berlaku untuk creativeFormat existing_post, single_image, video, dan carousel — format lain ditolak. pageId (Page brand) WAJIB diisi bersama field ini karena ad creative selalu di-anchor ke Facebook Page, bahkan untuk partnership ad yang hanya tayang di Instagram. Wajib mengisi minimal satu dari partnerPageId atau partnerInstagramId. Butuh scope instagram_branded_content_ads_brand dan/atau facebook_branded_content_ads_brand, plus instagram_basic — memberi instagram_branded_content_ads_brand tanpa instagram_basic menghasilkan 403. Iklan yang dipublish tanpa izin kemitraan tetap diterima Meta tetapi masuk status pending delivery sampai partner menyetujui.',
        properties: {
          partnerPageId: {
            type: 'string',
            description: 'Facebook Page ID partner/kreator.',
          },
          partnerInstagramId: {
            type: 'string',
            description:
              "Instagram user ID partner/kreator; menjadi instagram_branded_content.sponsor_id pada primaryIdentity 'advertiser'. Bila hanya field ini yang diisi, Meta mencoba me-link Page Facebook terkait; tanpa tautan itu iklan tidak tayang di Facebook. Ditolak bersama primaryIdentity 'creator' karena di sana Meta menurunkan akun IG kreator dari Page kreator.",
          },
          brandInstagramId: {
            type: 'string',
            description:
              "Instagram user ID milik brand/advertiser; menjadi instagram_branded_content.sponsor_id pada primaryIdentity 'creator' (sponsor selalu berarti identitas sekunder). Ditolak pada primaryIdentity 'advertiser'.",
          },
          primaryIdentity: {
            type: 'string',
            enum: ['advertiser', 'creator'],
            description:
              "Handle siapa yang tampil sebagai pengirim iklan. Default 'advertiser' (Page brand jadi identitas primer, kreator jadi sponsor lewat partnerPageId/partnerInstagramId). 'creator' membalik keduanya: Page kreator jadi identitas primer, brand jadi sponsor lewat pageId/brandInstagramId. Mewajibkan partnerPageId.",
          },
          adCode: {
            type: 'string',
            description:
              'Partnership ad code yang diberikan kreator. Jalur boost alternatif — tidak boleh dipakai bersamaan dengan creativeSpec.sourceInstagramMediaId. Pada jalur ini creativeFormat existing_post justru diisi tanpa objectStoryId maupun sourceInstagramMediaId: ad code sendiri yang menjadi referensi konten.',
          },
          adFormat: {
            type: 'string',
            description:
              'branded_content.ad_format. Wajib diisi bila adCode diisi. Meta tidak mendokumentasikan daftar nilainya, jadi nilai diteruskan apa adanya dan Meta yang memvalidasi.',
          },
        },
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
      welcomeMessageTemplateName: {
        type: 'string',
        description:
          'Nama reusable welcome message template lokal dari ads_list_welcome_message_templates. Saat diisi, template dikembangkan menjadi creativeSpec.pageWelcomeMessage sebelum creative dibuat. Jangan isi bersamaan dengan creativeSpec.pageWelcomeMessage.',
      },
      instagramUserId: { type: 'string', description: 'Instagram user ID for IG posting.' },
      threadsProfileId: { type: 'string', description: 'Threads profile ID for Threads posting.' },
      objectStorySpec: {
        type: 'object',
        description:
          'Input advanced/backward-compatible Meta object_story_spec. asset_feed_spec bersarang wajib memakai asset_customization_rules (minimal 2 rules) untuk asset customization per placement/language/segment; tanpa rules itu jalur Dynamic Creative dan disabled.',
        properties: {
          asset_feed_spec: {
            type: 'object',
            properties: {
              asset_customization_rules: {
                type: 'array',
                minItems: 1,
                items: { type: 'object' },
              },
              images: { type: 'array', items: { type: 'object' } },
              videos: { type: 'array', items: { type: 'object' } },
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
            required: ['asset_customization_rules'],
            additionalProperties: true,
          },
        },
        additionalProperties: true,
      },
      assetFeedSpec: {
        type: 'object',
        description:
          'Hanya untuk placement customization dengan asset_customization_rules (termasuk image/video berbeda per placement). Dynamic/Flexible asset-feed variants disabled. Jangan pakai untuk opsi headline/caption/copy/video manual tanpa placement rules; buat beberapa manual creative/ad terpisah atau carousel.',
        properties: {
          asset_customization_rules: {
            type: 'array',
            minItems: 1,
            items: { type: 'object' },
          },
          ad_formats: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
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
          videos: { type: 'array', minItems: 1, items: { type: 'object' } },
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
        required: ['asset_customization_rules'],
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
          'Disabled karena menulis asset_feed_spec.additional_data dan bisa mengubah creative menjadi asset-feed family. Pakai pageWelcomeMessage atau creativeSpec.pageWelcomeMessage manual.',
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
          'Nama individual Advantage+ Creative feature yang di-disable (OPT_OUT). Contoh: ["image_auto_crop", "text_optimizations", "image_templates", "image_brightness_and_contrast", "image_animation", "image_background_gen", "image_uncrop", "catalog_feed_tag", "product_extensions", "enhance_cta", "inline_comment", "pac_relaxation", "video_auto_crop", "video_filtering", "advantage_plus_creative", "site_extensions"]. standard_enhancements sudah deprecated dan media_sourcing bukan creative feature yang valid; keduanya ditolak. Untuk creative manual murni, hilangkan parameter ini agar degrees_of_freedom_spec tidak dikirim.',
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
      creativeId: {
        type: 'string',
        description:
          'Meta: the creative ID to use for this ad. Not used for TikTok — use creatives instead.',
      },
      multiMedia: {
        type: 'object',
        description:
          'Meta only: create a normal (non-Dynamic) inline multi-media image creative. Mutually exclusive with creativeId. The primaryImageHash must also appear in images. Each image is sent through media_sourcing_spec with source multi_media and may exclude placements.',
        properties: {
          pageId: { type: 'string' },
          instagramUserId: { type: 'string' },
          destinationUrl: { type: 'string' },
          primaryImageHash: { type: 'string' },
          primaryText: { type: 'string' },
          headline: { type: 'string' },
          description: { type: 'string' },
          callToAction: { type: 'string' },
          images: {
            type: 'array',
            minItems: 2,
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                imageHash: { type: 'string' },
                placementExclusions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      publisherPlatform: { type: 'string' },
                      positions: { type: 'array', minItems: 1, items: { type: 'string' } },
                    },
                    required: ['publisherPlatform', 'positions'],
                    additionalProperties: false,
                  },
                },
                textCustomizations: {
                  type: 'object',
                  description:
                    'Optional per-image overrides for the root multi-media text. Each field is an array of { text } objects.',
                  properties: {
                    titles: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        properties: { text: { type: 'string' } },
                        required: ['text'],
                        additionalProperties: false,
                      },
                    },
                    bodies: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        properties: { text: { type: 'string' } },
                        required: ['text'],
                        additionalProperties: false,
                      },
                    },
                    descriptions: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        properties: { text: { type: 'string' } },
                        required: ['text'],
                        additionalProperties: false,
                      },
                    },
                  },
                  additionalProperties: false,
                },
              },
              required: ['imageHash'],
              additionalProperties: false,
            },
          },
        },
        required: ['pageId', 'destinationUrl', 'primaryImageHash', 'callToAction', 'images'],
        additionalProperties: false,
      },
      sourceAdId: {
        type: 'string',
        description:
          'Optional Ads Manager source ad ID for Meta. Sends source_ad_id together with creativeId, preserving CTWA composer context while attaching the requested creative. Use only with a reviewed source ad from the same account.',
      },
      pixelId: {
        type: 'string',
        description:
          'Meta Pixel ID to attach as ad-level tracking_specs for offsite conversion logging. Use this for Sales CTWA where the ad set carries WhatsApp destination and the ad carries pixel tracking.',
      },
      trackingSpecs: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Advanced Meta tracking_specs override. If omitted and pixelId is set, the tool builds [{ "action.type": ["offsite_conversion"], fb_pixel: [pixelId] }].',
      },
      creatives: {
        type: 'array',
        description:
          'TikTok: inline creative objects, e.g. [{ creative_name, creative_material: { title, call_to_action, landing_page_url, video_id|image_id, page_id, product_specific_type, item_group_ids, sku_ids } }]. Not used for Meta.',
        items: { type: 'object' },
      },
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
      skipMessagingDestinationCheck: {
        type: 'boolean',
        description:
          'Skip the messaging destination/CTA cross-check. Only set if the mapping misfires; a click-to-message ad set (INSTAGRAM_DIRECT, MESSENGER, WHATSAPP, MESSAGING_*) normally needs a creative whose CTA opens the same inbox.',
      },
      skipAdSetCreativeFamilyCheck: {
        type: 'boolean',
        description:
          'Skip the Ad Set creative-family advisory. The advisory only warns when the Ad Set already holds a different creative family (manual/static vs dynamic/flexible/catalog/placement-customized asset-feed) — it never blocks the create, so set this only to skip the extra Graph reads.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'name', 'adSetId'],
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
      pixelId: {
        type: 'string',
        description:
          'Meta Pixel ID to attach as ad-level tracking_specs on the cloned ad. Useful for Sales CTWA where source_ad_id preserves UI state and the ad still logs offsite conversions.',
      },
      trackingSpecs: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Advanced Meta tracking_specs override. If omitted and pixelId is set, the tool builds [{ "action.type": ["offsite_conversion"], fb_pixel: [pixelId] }].',
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

function createDeleteAudienceInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      audienceId: {
        type: 'string',
        description:
          'The Custom Audience id to delete permanently (includes product/dynamic audiences).',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['audienceId'],
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
      attributionSpec: {
        type: ['array', 'null'],
        items: { type: 'object', additionalProperties: true },
        description:
          'Override attribution_spec pada klon, memakai bentuk Meta: [{ "event_type": "CLICK_THROUGH", "window_days": 1 }]. Tanpa ini, attribution_spec sumber disalin apa adanya — dan sumber berjendela 7 hari yang diklon ke optimizationGoal CONVERSATIONS ditolak Meta (subcode 1885423), karena optimasi messaging hanya mendukung jendela 1 hari. Kirim null atau [] untuk membuang attribution_spec warisan sumber sepenuhnya.',
      },
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
      dailySpendCap: {
        type: 'number',
        description:
          "Daily spend ceiling for this ad set, in account currency minor units. Ad-set-level control used to shape this ad set's share of a campaign budget. Use with a sibling ad set (one including, one excluding the existing-customer audience) to split spend across customer segments — Meta's replacement for the retired existing_customer_budget_percentage.",
      },
      dailyMinSpendTarget: {
        type: 'number',
        description:
          "Daily minimum spend target for this ad set, in account currency minor units. Ad-set-level control used to shape this ad set's share of a campaign budget. Best-effort, not guaranteed. Send 0 to clear an existing target.",
      },
      lifetimeSpendCap: {
        type: 'number',
        description:
          'Lifetime spend ceiling for this ad set, in account currency minor units. Requires a lifetime budget on the campaign.',
      },
      lifetimeMinSpendTarget: {
        type: 'number',
        description:
          'Lifetime minimum spend target for this ad set, in account currency minor units. Requires a lifetime budget on the campaign. Best-effort, not guaranteed. Send 0 to clear an existing target.',
      },
      bidStrategy: { type: 'string', description: 'New bid strategy.' },
      optimizationGoal: {
        type: 'string',
        enum: [
          'REACH',
          'IMPRESSIONS',
          'LINK_CLICKS',
          'LANDING_PAGE_VIEWS',
          'CONVERSATIONS',
          'MESSAGING_PURCHASE_CONVERSION',
          'OFFSITE_CONVERSIONS',
          'VALUE',
        ],
        description: 'New optimization goal.',
      },
      geoLocations: { type: 'object', description: 'Geo targeting object.' },
      ageMin: { type: 'number', description: 'Minimum age target.' },
      ageMax: { type: 'number', description: 'Maximum age target.' },
      ageRange: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description:
          'Advantage+ Audience age suggestion [min, max] — distinct from the hard ageMin/ageMax filter. Only meaningful when advantageAudience/targetingAutomation.advantage_audience is 1. In mode="patch" (default), merges with the ad set\'s current remote targeting.',
      },
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
      multiMedia: {
        type: 'object',
        description:
          'Meta only: create a standalone non-Dynamic multi-media image creative and swap it onto this same ad ID. Mutually exclusive with every other ad-update field. The primaryImageHash must also appear in images. Each asset may exclude placements through media_sourcing_spec. Use pageWelcomeMessage to preserve the full CTWA VISUAL_EDITOR object verbatim.',
        properties: {
          pageId: { type: 'string' },
          instagramUserId: { type: 'string' },
          destinationUrl: { type: 'string' },
          primaryImageHash: { type: 'string' },
          primaryText: { type: 'string' },
          headline: { type: 'string' },
          description: { type: 'string' },
          callToAction: { type: 'string' },
          pageWelcomeMessage: {
            type: ['string', 'object'],
            description:
              'Full page_welcome_message, including VISUAL_EDITOR JSON, preserved verbatim.',
          },
          images: {
            type: 'array',
            minItems: 2,
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                imageHash: { type: 'string' },
                placementExclusions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      publisherPlatform: { type: 'string' },
                      positions: { type: 'array', minItems: 1, items: { type: 'string' } },
                    },
                    required: ['publisherPlatform', 'positions'],
                    additionalProperties: false,
                  },
                },
                textCustomizations: { type: 'object', additionalProperties: true },
              },
              required: ['imageHash'],
              additionalProperties: false,
            },
          },
        },
        required: ['pageId', 'destinationUrl', 'primaryImageHash', 'callToAction', 'images'],
        additionalProperties: false,
      },
      multiMediaCreativeName: {
        type: 'string',
        description:
          'Optional name for the newly-created standalone multi-media creative. Does not rename the ad.',
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

function createCpasCatalogBundleInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      campaignName: { type: 'string' },
      adSetName: { type: 'string' },
      adName: { type: 'string' },
      pageId: { type: 'string' },
      productSetId: { type: 'string', description: 'Retailer-shared CPAS product set ID.' },
      destinationMode: {
        type: 'string',
        enum: ['catalog_web', 'app_omnichannel'],
        description:
          'Defaults to catalog_web: CPAS katalog dinamis dengan universal web/app link tanpa app-event tracking. Pilih app_omnichannel hanya jika ad account sudah memiliki izin tracking aplikasi retailer.',
      },
      pixelId: { type: 'string' },
      collaborativeAppSpec: {
        type: 'object',
        description: 'Wajib hanya untuk destinationMode=app_omnichannel.',
        properties: {
          applicationId: { type: 'string' },
          android: {
            type: 'object',
            properties: { appName: { type: 'string' }, packageName: { type: 'string' } },
            required: ['appName', 'packageName'],
          },
          ios: {
            type: 'object',
            properties: { appName: { type: 'string' }, appStoreId: { type: 'string' } },
            required: ['appName', 'appStoreId'],
          },
        },
        required: ['applicationId'],
      },
      objectStoreUrls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Wajib hanya untuk destinationMode=app_omnichannel.',
      },
      customEventType: { type: 'string', enum: ['PURCHASE', 'ADD_TO_CART', 'INITIATED_CHECKOUT'] },
      dailyBudget: { type: 'number' },
      countries: { type: 'array', items: { type: 'string' } },
      primaryText: { type: 'string' },
      headline: { type: 'string' },
      description: { type: 'string' },
      creativeFormat: {
        type: 'string',
        enum: [
          'catalog',
          'catalog_single_image',
          'catalog_carousel',
          'catalog_video',
          'catalog_video_carousel',
          'collection',
        ],
        description:
          'Defaults to catalog. catalog_single_image dan catalog_carousel tetap memakai produk dinamis; catalog_video membutuhkan video. Collection membutuhkan properti collection.',
      },
      collection: {
        type: 'object',
        description: 'Wajib bila creativeFormat=collection.',
        properties: {
          instantExperienceId: { type: 'string' },
          coverImageHash: { type: 'string' },
          coverVideoId: { type: 'string' },
        },
        required: ['instantExperienceId'],
      },
      video: {
        type: 'object',
        description:
          'Wajib bila creativeFormat=catalog_video. Instant Experience harus sudah published dan videoId harus berasal dari object_story_spec.video_data creative CPAS yang valid.',
        properties: {
          videoId: { type: 'string' },
          instantExperienceId: { type: 'string' },
          retailerAppId: { type: 'string' },
          retailerItemIds: { type: 'array', items: { type: 'string' } },
          thumbnailImageHash: { type: 'string' },
          thumbnailImageUrl: { type: 'string' },
        },
        required: ['videoId', 'instantExperienceId', 'retailerAppId'],
      },
      hybridVideo: {
        type: 'object',
        description:
          'Wajib bila creativeFormat=catalog_video_carousel. Gunakan URL thumbnail Meta untuk static video card; format ini tidak memakai Instant Experience.',
        properties: {
          videoId: { type: 'string' },
          thumbnailUrl: { type: 'string' },
        },
        required: ['videoId', 'thumbnailUrl'],
      },
      destinationUrl: { type: 'string' },
      templateUrl: { type: 'string' },
      fallbackImageHash: { type: 'string' },
      callToAction: { type: 'string', enum: ['SHOP_NOW', 'LEARN_MORE'] },
      ageMin: { type: 'number' },
      ageMax: { type: 'number' },
      publisherPlatforms: { type: 'array', items: { type: 'string' } },
      instagramUserId: { type: 'string' },
      threadsProfileId: { type: 'string' },
      dryRun: { type: 'boolean', description: 'Defaults to true.' },
      confirmed: { type: 'boolean', description: 'Required with dryRun=false.' },
    },
    required: [
      'accountId',
      'campaignName',
      'adSetName',
      'adName',
      'pageId',
      'productSetId',
      'dailyBudget',
      'countries',
      'primaryText',
      'headline',
      'destinationUrl',
    ],
  };
}

function productAudienceRuleSchema() {
  return {
    type: 'object',
    required: ['retentionSeconds', 'event'],
    properties: {
      retentionSeconds: {
        type: 'number',
        description: 'How long, in seconds, a person stays in/out of the audience.',
      },
      event: {
        type: 'string',
        enum: ['Search', 'ViewContent', 'AddToCart', 'Purchase'],
      },
    },
  };
}

function createProductAudienceInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Audience name.' },
      productSetId: {
        type: 'string',
        description: 'Catalog product set this audience is built from.',
      },
      inclusions: {
        type: 'array',
        description:
          'Events that add a person to the audience. Meta commonly uses ViewContent (14 days) and AddToCart (7 days) for retargeting.',
        items: productAudienceRuleSchema(),
      },
      exclusions: {
        type: 'array',
        description:
          'Events that remove a person from the audience. Meta commonly uses Purchase (30 days) to exclude buyers from retargeting.',
        items: productAudienceRuleSchema(),
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false to execute.' },
      confirmed: {
        type: 'boolean',
        description: 'Must be true together with dryRun=false to execute.',
      },
      maxRetries: {
        type: 'number',
        description:
          'How many times to retry a transient Meta failure. Defaults to the tool default.',
      },
    },
    required: ['accountId', 'name', 'productSetId', 'inclusions'],
  };
}

function createCustomAudienceInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Audience name.' },
      pixelId: { type: 'string', description: 'Meta pixel ID this audience is built from.' },
      rule: {
        type: 'object',
        description:
          "Raw Website Custom Audience Rule object, exactly as Meta's Audience rule builder/API reference specifies. Passed through as-is.",
      },
      retentionDays: {
        type: 'number',
        description: 'How many days a person stays in the audience. Must be between 1 and 180.',
      },
      description: { type: 'string', description: 'Optional audience description.' },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false to execute.' },
      confirmed: {
        type: 'boolean',
        description: 'Must be true together with dryRun=false to execute.',
      },
      maxRetries: {
        type: 'number',
        description:
          'How many times to retry a transient Meta failure. Defaults to the tool default.',
      },
    },
    required: ['accountId', 'name', 'pixelId', 'rule'],
  };
}

function createPixelInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Pixel name.' },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false to execute.' },
      confirmed: {
        type: 'boolean',
        description: 'Must be true together with dryRun=false to execute.',
      },
      maxRetries: {
        type: 'number',
        description:
          'How many times to retry a transient Meta failure. Defaults to the tool default.',
      },
    },
    required: ['accountId', 'name'],
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

function createChangeHistoryInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      objectId: {
        type: 'string',
        description:
          'Meta campaign, ad set, ad, or creative ID to inspect. Meta does not filter its account activities edge by object, so rows are filtered after fetching — a page can be empty while older changes still exist; keep paging with cursor.',
      },
      eventCategory: {
        type: 'string',
        enum: [...META_ACTIVITY_CATEGORIES],
        description: 'Meta activity category used to filter the history (Meta category enum).',
      },
      userId: {
        type: 'string',
        description: 'Meta user ID that performed the change. Sent as the Meta uid filter.',
      },
      startTime: {
        type: 'string',
        description: 'Start time in ISO 8601 format. Takes precedence over since.',
      },
      endTime: {
        type: 'string',
        description: 'End time in ISO 8601 format. Takes precedence over until.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 1000,
        description: 'Maximum activity rows Meta should return per page. Defaults to 100.',
      },
      cursor: { type: 'string', description: 'Pagination cursor from a previous response.' },
      maxScanPages: {
        type: 'number',
        minimum: 1,
        maximum: CHANGE_HISTORY_MAX_SCAN_PAGES,
        description: `Only used when objectId falls back to scanning the account feed: how many account pages to scan in one call. Defaults to ${CHANGE_HISTORY_DEFAULT_SCAN_PAGES}; each page costs roughly two seconds.`,
      },
      includeDetails: {
        type: 'boolean',
        description:
          'Include normalized old/new values parsed from Meta extra_data. Defaults to false.',
      },
    },
    required: [],
  };
}

function createWelcomeMessageTemplateListInputSchema() {
  return {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Optional exact template name filter.',
      },
    },
    required: [],
  };
}

function createWelcomeMessageTemplateCreateInputSchema() {
  return {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Reusable template name. Use letters, numbers, dot, underscore, or dash; max 80 characters.',
      },
      pageWelcomeMessage: {
        description:
          'Welcome message body to reuse. Accepts a plain string or the full VISUAL_EDITOR object used by Meta page_welcome_message.',
        oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }],
      },
    },
    required: ['name', 'pageWelcomeMessage'],
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
        enum: [...META_CREATABLE_CREATIVE_FORMATS],
        description:
          'Optional intended creative format to validate against the resolved workflow. Dynamic Creative/Flexible is disabled for create workflows; use separate manual creative/ad variants for headline/caption/copy/image/video tests, carousel for multi-card media, or placement customization with asset_customization_rules for per-placement media.',
      },
      apiVersion: { type: 'string', description: 'Meta Marketing API version, defaults to v25.0.' },
      messagingDestination: {
        type: 'string',
        enum: [...META_MESSAGING_DESTINATIONS],
        description:
          'Inbox tujuan untuk workflow engagement_messaging (click-to-message). Menentukan destination_type ad set dan CTA creative yang cocok: INSTAGRAM_DIRECT ↔ INSTAGRAM_MESSAGE, MESSENGER ↔ MESSAGE_PAGE, WHATSAPP ↔ WHATSAPP_MESSAGE. Wajib diisi untuk workflow itu; diabaikan untuk conversion location lain.',
      },
      tiktokObjectiveType: {
        type: 'string',
        enum: [
          'REACH',
          'TRAFFIC',
          'VIDEO_VIEWS',
          'ENGAGEMENT',
          'LEAD_GENERATION',
          'APP_PROMOTION',
          'WEB_CONVERSIONS',
          'PRODUCT_SALES',
        ],
        description: 'TikTok objective for the readiness check. Ignored for provider=meta.',
      },
      advertiserId: {
        type: 'string',
        description: 'TikTok advertiser ID for the readiness check.',
      },
      campaignName: { type: 'string', description: 'Campaign name (TikTok readiness check).' },
      adgroupName: { type: 'string', description: 'Ad group name (TikTok readiness check).' },
      identityId: { type: 'string', description: 'TikTok identity ID (TikTok readiness check).' },
      identityType: {
        type: 'string',
        description: 'TikTok identity type (TikTok readiness check).',
      },
      callToAction: { type: 'string', description: 'Call to action (TikTok readiness check).' },
      appId: { type: 'string', description: 'TikTok App ID (APP_PROMOTION readiness check).' },
      promotionType: {
        type: 'string',
        enum: ['APP_INSTALL', 'APP_RETARGETING'],
        description: 'APP_INSTALL or APP_RETARGETING (TikTok readiness check).',
      },
      optimizationEvent: {
        type: 'string',
        description: 'Conversion event (TikTok WEB_CONVERSIONS readiness check).',
      },
      instantFormPageId: {
        type: 'string',
        description: 'Instant Form page_id (TikTok LEAD_GENERATION readiness check).',
      },
      itemGroupIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Product item_group_ids (TikTok PRODUCT_SALES readiness check).',
      },
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
      partnershipAdCode: {
        type: 'string',
        description:
          'Partnership ad code dari kreator. Referensi konten alternatif untuk creativeFormat existing_post — pada jalur ini tidak ada post ID, sehingga mengisi field ini memenuhi kebutuhan existingPostId.',
      },
      sourceAdId: {
        type: 'string',
        description:
          'Optional Ads Manager-created source UI ad ID for fallback cloning when a provider creative-create path fails.',
      },
      whatsappPhoneNumber: {
        type: 'string',
        description:
          'Display WhatsApp number for CTWA ad sets, digits only in international format (e.g. 6285156583372). Sent as promoted_object.whatsapp_phone_number.',
      },
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

function createLeadFormsInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      pageId: { type: 'string', description: 'Facebook Page ID that owns the Instant Forms.' },
      status: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional Instant Form statuses to include, such as ACTIVE.',
      },
      limit: { type: 'number', description: 'Maximum forms to return (default 50).' },
    },
    required: ['accountId', 'pageId'],
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

function createPartnershipContentInputSchema() {
  const schema = createAdsInputSchema([]);
  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      businessId: { type: 'string', description: 'Meta Business ID pemilik Page/akun IG brand.' },
      fbPageId: {
        type: 'string',
        description:
          'Facebook Page ID brand. Isi minimal satu dari fbPageId atau igUserId; bila keduanya diisi, kedua akun harus sudah ter-link.',
      },
      igUserId: { type: 'string', description: 'Instagram professional account ID brand.' },
      creatorUsername: { type: 'string', description: 'Filter konten dari satu kreator.' },
      adCodes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Cari berdasarkan partnership ad code. Maksimal 50.',
      },
      platform: { type: 'string', enum: ['INSTAGRAM', 'FACEBOOK'] },
      mediaType: { type: 'string', enum: ['IMAGE', 'VIDEO', 'CAROUSEL', 'LINK'] },
      postType: { type: 'string', enum: ['FEED', 'STORY', 'REEL'] },
      limit: { type: 'number', description: 'Jumlah baris per halaman, 1-50. Default 25.' },
      cursor: { type: 'string', description: 'Pagination cursor dari panggilan sebelumnya.' },
    },
    required: ['businessId'],
  };
}

/**
 * Canonical `{field, operator, value}` filter rules, shared by ads_get_performance
 * and the legacy per-level performance aliases that reach the same
 * parseCanonicalMetaFilters path.
 */
function canonicalFiltersSchema() {
  return {
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
  };
}

function idScopeSchema(description: string) {
  return {
    anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description,
  };
}

/**
 * The legacy per-level performance aliases used to declare only the shared
 * envelope, so a client had no way to learn that the adapters read scoping and
 * paging keys. extractParams merges every non-reserved top-level argument into
 * request.params, so a declared property reaches the same adapter code the
 * nested `params` object already did — callers passing `params: { campaignId }`
 * keep working.
 *
 * `level` decides which ids Meta actually honors: getCampaignInsights filters on
 * campaign.id alone, getAdsetInsights adds adset.id, getAdsInsights adds ad.id.
 * Declaring an id the level ignores would advertise a filter that does nothing.
 */
function createLegacyPerformanceInputSchema(level: 'campaign' | 'adset' | 'ad') {
  const schema = createAdsInputSchema(['since', 'until']);
  const scope: Record<string, unknown> = {
    campaignId: idScopeSchema('Restrict results to specific campaign id(s). Meta only.'),
  };

  if (level !== 'campaign') {
    scope.adsetId = idScopeSchema(
      'Restrict results to specific ad set id(s). Meta only. Also accepted as adSetId.'
    );
  }

  if (level === 'ad') {
    scope.adId = idScopeSchema('Restrict results to specific ad id(s). Meta only.');
  }

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      ...scope,
      ...insightsTailSchema(),
    },
  };
}

/**
 * Breakdown, filter and paging keys every request that reaches Meta's
 * getPerformanceOptions can carry, plus the page/pageSize pair TikTok reads
 * instead of a cursor. Shared by the legacy aliases and by the two tools that
 * delegate to them, ads_content_matrix and ads_generate_report.
 */
function insightsTailSchema() {
  return {
    breakdowns: {
      type: 'array',
      items: { type: 'string', enum: [...LOCATION_BREAKDOWNS] },
      description: 'Meta location breakdowns to split rows by. Ignored when mode is cpas.',
    },
    filters: canonicalFiltersSchema(),
    mode: {
      type: 'string',
      enum: ['cpas'],
      description:
        'Set to cpas to read Collaborative Ads rows, broken down by product_id. Meta only.',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of rows to return. Meta only; TikTok uses pageSize.',
    },
    cursor: {
      type: 'string',
      description:
        'Opaque pagination cursor from a previous response. On TikTok this is the next page number.',
    },
    page: {
      type: 'number',
      description: 'Report page number. TikTok only.',
    },
    pageSize: {
      type: 'number',
      description: 'Report rows per page. TikTok only.',
    },
  };
}

/**
 * Account level takes no scoping or breakdown keys: getAccountInsights sends
 * neither `filtering` nor `breakdowns` to Meta, so declaring them here would
 * advertise inputs that reach the API and change nothing.
 */
function createAccountPerformanceInputSchema() {
  const schema = createAdsInputSchema(['since', 'until']);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return. Meta only; TikTok uses pageSize.',
      },
      cursor: {
        type: 'string',
        description:
          'Opaque pagination cursor from a previous response. On TikTok this is the next page number.',
      },
      page: {
        type: 'number',
        description: 'Report page number. TikTok only.',
      },
      pageSize: {
        type: 'number',
        description: 'Report rows per page. TikTok only.',
      },
    },
  };
}

function createCreativePerformanceInputSchema() {
  const schema = createAdsInputSchema(['since', 'until']);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      creativeId: {
        type: 'string',
        description: 'Read a single Meta creative by ID instead of listing the account.',
      },
      campaignId: idScopeSchema(
        'Optional campaign scope. Uses the nested campaign ads edge when possible. Meta only.'
      ),
      adSetId: idScopeSchema(
        'Optional ad set scope. Uses the nested ad set ads edge when possible. Meta only.'
      ),
      complianceAudit: {
        type: 'boolean',
        description:
          'Audit the active ads behind each creative and report setup compliance. Ignored when creativeId is set. Meta only.',
      },
      effectiveStatus: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Meta effective_status values the compliance audit keeps. Defaults to ACTIVE. Meta only.',
      },
      includeRaw: {
        type: 'boolean',
        description: 'Attach the raw Meta creative payload to each row. Meta only.',
      },
      limit: {
        type: 'number',
        description: 'Maximum creatives to inspect. Defaults to 100. Meta only.',
      },
      cursor: {
        type: 'string',
        description:
          'Opaque pagination cursor from a previous response. On TikTok this is the next page number.',
      },
      page: {
        type: 'number',
        description: 'Report page number. TikTok only.',
      },
      pageSize: {
        type: 'number',
        description: 'Report rows per page. TikTok only.',
      },
    },
  };
}

function createPlacementPerformanceInputSchema() {
  const schema = createAdsInputSchema(['since', 'until']);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      level: {
        type: 'string',
        enum: ['campaign', 'adset', 'ad'],
        description: 'Entity level the placement rows are grouped by. Meta only.',
      },
      campaignId: idScopeSchema('Restrict results to specific campaign id(s). Meta only.'),
      adsetId: idScopeSchema('Restrict results to specific ad set id(s). Meta only.'),
      adId: idScopeSchema('Restrict results to specific ad id(s). Meta only.'),
      minSpendShare: {
        type: 'number',
        description: 'Drop placements below this share of total spend. Meta only.',
      },
      minConversions: {
        type: 'number',
        description: 'Drop placements below this conversion count. Meta only.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return. Meta only.',
      },
    },
  };
}

function createContentMatrixInputSchema() {
  const schema = createAdsInputSchema(['since', 'until']);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      campaignId: idScopeSchema('Restrict results to specific campaign id(s). Meta only.'),
      adsetId: idScopeSchema(
        'Restrict results to specific ad set id(s). Meta only. Also accepted as adSetId.'
      ),
      adId: idScopeSchema('Restrict results to specific ad id(s). Meta only.'),
      groupBy: {
        type: 'string',
        enum: ['campaign', 'adset'],
        description: 'Group the matrix rows by campaign or ad set.',
      },
      sortBy: {
        type: 'string',
        description: 'Metric used to rank rows into the top and bottom lists.',
      },
      sortDirection: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort direction.',
      },
      topLimit: {
        type: 'number',
        description: 'How many top performers to keep.',
      },
      bottomLimit: {
        type: 'number',
        description: 'How many bottom performers to keep.',
      },
      includeAllRows: {
        type: 'boolean',
        description: 'Return every row alongside the top and bottom lists.',
      },
      comparisonMode: {
        type: 'string',
        enum: ['previous_period', 'none'],
        description:
          'Compare against the previous period of equal length, or skip the comparison. Defaults to previous_period.',
      },
      ...insightsTailSchema(),
    },
  };
}

function createGenerateReportInputSchema() {
  const schema = createAdsInputSchema(['since', 'until']);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      level: {
        type: 'string',
        enum: ['account', 'campaign'],
        description: 'Report level. Defaults to account; campaign reads campaign rows instead.',
      },
      format: {
        type: 'string',
        enum: ['summary', 'daily', 'audit', 'executive'],
        description: 'Report shape. Defaults to summary; audit adds a scorecard and findings.',
      },
      campaignId: idScopeSchema(
        'Restrict results to specific campaign id(s). Meta only, and only when level is campaign.'
      ),
      filters: {
        ...canonicalFiltersSchema(),
        description:
          'Explicit filters over normalized or provider-supported fields. Meta only, and only when level is campaign.',
      },
      mode: {
        type: 'string',
        enum: ['cpas'],
        description:
          'Set to cpas to total Collaborative Ads rows instead. Meta only, and only when level is campaign.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to total. Meta only; TikTok uses pageSize.',
      },
      cursor: {
        type: 'string',
        description:
          'Opaque pagination cursor from a previous response. On TikTok this is the next page number.',
      },
      page: {
        type: 'number',
        description: 'Report page number. TikTok only.',
      },
      pageSize: {
        type: 'number',
        description: 'Report rows per page. TikTok only.',
      },
    },
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
      filters: canonicalFiltersSchema(),
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

function createCreativeAssetsInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adId: {
        type: 'string',
        description: 'Optional single Meta ad ID to resolve.',
      },
      adIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional Meta ad IDs to resolve.',
      },
      campaignId: {
        anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'Optional campaign scope. Uses the nested campaign ads edge when possible.',
      },
      adSetId: {
        anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'Optional ad set scope. Uses the nested ad set ads edge when possible.',
      },
      thumbnailWidth: {
        type: 'number',
        description: 'Requested AdCreative thumbnail width. Defaults to 1920.',
      },
      thumbnailHeight: {
        type: 'number',
        description: 'Requested AdCreative thumbnail height. Defaults to 1080.',
      },
      limit: {
        type: 'number',
        description: 'Maximum ads to inspect. Defaults to 100.',
      },
      cursor: {
        type: 'string',
        description: 'Opaque pagination cursor from a previous response.',
      },
      filtering: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
        description: 'Optional raw Meta filtering rules, merged with adIds.',
      },
    },
  };
}

function createAdCreativeMappingInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional Meta ad IDs to map. Filters the page; does not scope the edge.',
      },
      campaignId: idScopeSchema(
        'Optional campaign scope. Uses the nested campaign ads edge when possible.'
      ),
      adSetId: idScopeSchema(
        'Optional ad set scope. Uses the nested ad set ads edge when possible.'
      ),
      filtering: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
        description: 'Optional raw Meta filtering rules, merged with the id scopes.',
      },
      limit: {
        type: 'number',
        description: 'Maximum ads to inspect. Defaults to 100.',
      },
      cursor: {
        type: 'string',
        description: 'Opaque pagination cursor from a previous response.',
      },
    },
  };
}

function createAdDestinationsInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional Meta ad IDs to inspect. Filters the page; does not scope the edge.',
      },
      effectiveStatus: {
        type: 'array',
        items: { type: 'string' },
        description:
          "Meta effective_status values to keep, such as ACTIVE or PAUSED. DEFAULTS TO ['ACTIVE'] when omitted — it does NOT return all statuses. Ads in PENDING_REVIEW, IN_PROCESS, PAUSED or DISAPPROVED are silently excluded, so the result can come back empty even though ads exist. Pass the statuses you want explicitly when auditing; the response reports the filter that was applied under meta.statusFilter.",
      },
      campaignId: idScopeSchema(
        'Optional campaign scope. Uses the nested campaign ads edge when possible.'
      ),
      adSetId: idScopeSchema(
        'Optional ad set scope. Uses the nested ad set ads edge when possible.'
      ),
      filtering: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
        description: 'Optional raw Meta filtering rules, merged with the id scopes.',
      },
      limit: {
        type: 'number',
        description: 'Maximum ads to inspect. Defaults to 100.',
      },
      cursor: {
        type: 'string',
        description: 'Opaque pagination cursor from a previous response.',
      },
    },
  };
}

function createListAdVideosInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      limit: {
        type: 'number',
        description: 'Maximum videos to return per page.',
      },
      cursor: {
        type: 'string',
        description: 'Opaque pagination cursor from a previous response.',
      },
    },
  };
}

function createTikTokWriteInputSchema(properties: Record<string, unknown>) {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      ...properties,
    },
  };
}

function tiktokOperationStatusSchema(description = 'TikTok operation_status, ENABLE or DISABLE.') {
  return { type: 'string', description };
}

function tiktokBudgetModeSchema() {
  return {
    type: 'string',
    description: 'TikTok budget mode, e.g. DAILY. Defaults to DAILY.',
  };
}

function createGmvMaxUpdateCampaignInputSchema() {
  return createTikTokWriteInputSchema({
    campaignId: {
      type: 'string',
      description: 'GMV Max campaign to update. Required — the call fails without it.',
    },
    campaignName: {
      type: 'string',
      description: 'New campaign name. Left unchanged when omitted.',
    },
    budget: { type: 'number', description: 'New campaign budget. Left unchanged when omitted.' },
    operationStatus: tiktokOperationStatusSchema(),
  });
}

function createGmvMaxCreateSessionInputSchema() {
  return createTikTokWriteInputSchema({
    campaignId: {
      type: 'string',
      description: 'GMV Max campaign the session belongs to. Required.',
    },
    sessionName: { type: 'string', description: 'Session name. Required.' },
    startTime: { type: 'string', description: 'Session start time. Required.' },
    endTime: { type: 'string', description: 'Session end time. Required.' },
    sessionType: { type: 'string', description: 'TikTok session type.' },
    sessionBudget: { type: 'number', description: 'Budget for this session.' },
    productIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'TikTok Shop product IDs to promote in the session.',
    },
  });
}

function createGmvMaxUpdateSessionInputSchema() {
  return createTikTokWriteInputSchema({
    sessionId: {
      type: 'string',
      description: 'GMV Max session to update. Required — the call fails without it.',
    },
    sessionName: { type: 'string', description: 'New session name. Left unchanged when omitted.' },
    sessionBudget: {
      type: 'number',
      description: 'New session budget. Left unchanged when omitted.',
    },
    startTime: { type: 'string', description: 'New start time. Left unchanged when omitted.' },
    endTime: { type: 'string', description: 'New end time. Left unchanged when omitted.' },
  });
}

function createGmvMaxSessionIdInputSchema() {
  return createTikTokWriteInputSchema({
    sessionId: {
      type: 'string',
      description: 'GMV Max session to delete. Required — the call fails without it.',
    },
  });
}

function createGmvMaxCampaignInfoInputSchema() {
  return createTikTokWriteInputSchema({
    campaignIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'GMV Max campaign IDs to read. Empty when omitted, which returns nothing.',
    },
  });
}

function createSmartPlusCreateCampaignInputSchema() {
  return createTikTokWriteInputSchema({
    campaignName: { type: 'string', description: 'Smart+ campaign name. Required.' },
    objectiveType: {
      type: 'string',
      description: 'TikTok objective_type for the Smart+ campaign. Required.',
    },
    budget: { type: 'number', description: 'Campaign budget.' },
    budgetMode: tiktokBudgetModeSchema(),
    operationStatus: tiktokOperationStatusSchema('Defaults to ENABLE.'),
  });
}

function createSmartPlusCampaignIdInputSchema() {
  return createTikTokWriteInputSchema({
    campaignId: {
      type: 'string',
      description: 'Smart+ campaign to act on. Required — the call fails without it.',
    },
  });
}

function createSmartPlusCreateAdGroupInputSchema() {
  return createTikTokWriteInputSchema({
    campaignId: {
      type: 'string',
      description: 'Smart+ campaign the ad group belongs to. Required.',
    },
    name: {
      type: 'string',
      description: 'Ad group name. Required. Also accepted as adgroupName.',
    },
    budget: { type: 'number', description: 'Ad group budget.' },
    budgetMode: tiktokBudgetModeSchema(),
    operationStatus: tiktokOperationStatusSchema('Defaults to ENABLE.'),
    landingPageUrl: { type: 'string', description: 'Landing page URL for the ad group.' },
    identityId: { type: 'string', description: 'TikTok identity that owns the ads.' },
    identityType: { type: 'string', description: 'TikTok identity type, e.g. CUSTOMIZED_USER.' },
  });
}

function createSmartPlusAdGroupIdInputSchema() {
  return createTikTokWriteInputSchema({
    adgroupId: {
      type: 'string',
      description: 'Smart+ ad group to act on. Required — the call fails without it.',
    },
  });
}

/**
 * Several Meta list tools read exactly one key, `limit`, and nothing else. The
 * description differs per tool because the unit it counts does.
 */
function createLimitOnlyInputSchema(limitDescription: string) {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      limit: { type: 'number', description: limitDescription },
    },
  };
}

function createListCampaignsInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      limit: { type: 'number', description: 'Maximum campaigns to return. Meta only.' },
      page: { type: 'number', description: 'Campaign list page number. TikTok only.' },
      pageSize: { type: 'number', description: 'Campaigns per page. TikTok only.' },
    },
  };
}

function createVideoSourceInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      videoId: {
        type: 'string',
        description: 'Meta video ID to read. Required — the call fails without it.',
      },
    },
  };
}

function createListWhatsAppAccountsInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      businessId: {
        type: 'string',
        description: 'Business Manager ID that owns the WhatsApp Business Accounts.',
      },
      limit: { type: 'number', description: 'Maximum WhatsApp Business Accounts to return.' },
    },
  };
}

function createListWhatsAppPhoneNumbersInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      wabaId: {
        type: 'string',
        description:
          'WhatsApp Business Account ID whose phone numbers to list. Required — the call fails without it.',
      },
      limit: { type: 'number', description: 'Maximum phone numbers to return.' },
    },
  };
}

function createListWhatsAppMessageTemplatesInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      wabaId: {
        type: 'string',
        description:
          'WhatsApp Business Account ID whose message templates to list. Required — the call fails without it.',
      },
      name: { type: 'string', description: 'Filter templates by exact name.' },
      status: {
        type: 'string',
        description: 'Filter templates by review status, such as APPROVED or PENDING.',
      },
      limit: { type: 'number', description: 'Maximum templates to return.' },
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
