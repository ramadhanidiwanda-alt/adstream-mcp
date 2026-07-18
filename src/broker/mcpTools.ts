import type { AdsBroker } from './AdsBroker.js';
import type { AdsBrokerRequest, AdsBrokerResponse, AdsEntityLevel, AdsMetricRecord, AdsMutationResult, AdsPerformanceEnvelope, AdsProviderId, AdDestinationResult, ArchiveAdResult, CreateAdCreativeResult, CreateAdResult, CreateAdSetResult, CreateCampaignResult, GetTargetingOptionsResult, UpdateAdSetResult } from './types.js';
import { ADS_ENTITY_LEVELS, ADS_PROVIDER_IDS, isAdsProviderId } from './types.js';
import { redactErrorMessage, redactTokenLikeValues } from './credentials.js';

export const ADS_MCP_TOOL_NAMES = [
  'ads_list_accounts',
  'ads_list_campaigns',
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
  'ads_archive_ad',
  'ads_update_adset',
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
  'ads_list_pages',
  'ads_list_instagram_accounts',
  'ads_list_threads_profiles',
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
  'ads_create_ecommerce_campaign_bundle',
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

export function getAdsMcpToolDefinitions(options: { includeWrites?: boolean } = {}) {
  return ADS_MCP_TOOL_DEFINITIONS.filter((tool) => (
    options.includeWrites === true || !isAdsMcpWriteTool(tool.name)
  ));
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
    name: 'ads_get_performance',
    description: 'Canonical read tool for normalized ads performance. Use level, metrics, dimensions, breakdowns, filters, sorting, limit, and cursor instead of report-specific tools.',
    inputSchema: createPerformanceInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_creatives',
    description: 'Canonical read tool for creative metadata and creative-level metrics. Returns the standard performance envelope with level creative.',
    inputSchema: createPerformanceInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_change_history',
    description: 'Canonical read-only change history tool. Meta returns a structured empty-compatible envelope; unsupported providers return NOT_IMPLEMENTED.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_capabilities',
    description: 'Discover canonical ads tool capabilities, supported providers, levels, metrics, breakdowns, and optional write tools.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_account_performance',
    description: 'Legacy alias: fetch normalized account-level performance. Prefer ads_get_performance with level account for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_campaign_performance',
    description: 'Legacy alias: fetch normalized campaign performance. Prefer ads_get_performance with level campaign for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_adset_or_adgroup_performance',
    description: 'Legacy alias: fetch normalized ad set or ad group performance. Prefer ads_get_performance with level adset or adgroup for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_ad_performance',
    description: 'Legacy alias: fetch normalized ad performance. Prefer ads_get_performance with level ad for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_creative_performance',
    description: 'Legacy alias: fetch normalized creative performance. Prefer ads_get_creatives or ads_get_performance with level creative for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_get_placement_performance',
    description: 'Legacy alias: fetch platform and placement performance. Prefer ads_get_performance with placement breakdowns for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_content_matrix',
    description: 'Legacy skill-owned workflow: return data-only ad/creative performance matrix grouped by campaign or adset. Prefer skill workflows over ads_get_performance and ads_get_creatives for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_generate_report',
    description: 'Legacy skill-owned workflow: generate an ads report through the AdsBroker. Prefer AI/skill report workflows over canonical data tools for new clients.',
    inputSchema: createAdsInputSchema(['since', 'until']),
  },
  {
    name: 'ads_pause_campaign',
    description: 'Pause a campaign. Returns success/error. Use with caution — campaign will stop spending.',
    inputSchema: createWriteInputSchema(['campaignId']),
  },
  {
    name: 'ads_resume_campaign',
    description: 'Resume a paused campaign. Returns success/error.',
    inputSchema: createWriteInputSchema(['campaignId']),
  },
  {
    name: 'ads_update_campaign_budget',
    description: 'Update a campaign\'s daily budget (in local currency minor units). Safety guard: rejects increases >200% by default.',
    inputSchema: createWriteInputSchema(['campaignId', 'dailyBudget']),
  },
  {
    name: 'ads_rename_campaign',
    description: 'Rename a campaign. Returns success/error.',
    inputSchema: createWriteInputSchema(['campaignId', 'newName']),
  },
  {
    name: 'ads_create_campaign',
    description: 'Create a Meta ad campaign with a specified objective. Dry-run by default. Set dryRun=false and confirmed=true to execute. Campaign is created PAUSED by default.',
    inputSchema: createCreateCampaignInputSchema(),
  },
  {
    name: 'ads_create_adset',
    description: 'Create a Meta ad set under an existing campaign. Dry-run by default. Set dryRun=false and confirmed=true to execute. Ad set is created PAUSED by default.',
    inputSchema: createCreateAdSetInputSchema(),
  },
  {
    name: 'ads_create_adcreative',
    description: 'Create a Meta ad creative with image/video, headline, body, and CTA. Dry-run by default. Set dryRun=false and confirmed=true to execute.',
    inputSchema: createCreateAdCreativeInputSchema(),
  },
  {
    name: 'ads_create_ad',
    description: 'Create a Meta ad by linking an existing ad set to an existing creative. Dry-run by default. Set dryRun=false and confirmed=true to execute. Ad is created PAUSED by default.',
    inputSchema: createCreateAdInputSchema(),
  },
  {
    name: 'ads_archive_ad',
    description: 'Archive (soft-delete) a Meta ad. Sets status to ARCHIVED. Irreversible via API.',
    inputSchema: createArchiveAdInputSchema(),
  },
  {
    name: 'ads_update_adset',
    description: 'Update an existing Meta ad set (name, budget, targeting, status). Dry-run by default. Set dryRun=false and confirmed=true to execute.',
    inputSchema: createUpdateAdSetInputSchema(),
  },
  {
    name: 'ads_get_targeting_options',
    description: 'Search Meta targeting options (interests, behaviors, demographics) for ad set creation.',
    inputSchema: createGetTargetingOptionsInputSchema(),
  },
  {
    name: 'ads_create_ecommerce_campaign_bundle',
    description: 'Create a PAUSED Meta ecommerce sales campaign bundle (campaign, ad set, creative, ad) after dry-run preview and explicit confirmation.',
    inputSchema: createEcommerceLaunchInputSchema(),
  },
  {
    name: 'ads_get_video_source',
    description: 'Get the raw video source URL (MP4), embed HTML, and thumbnail for a Meta video ID. Calls GET /{video_id}?fields=source,embed_html,picture.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_ad_creative_mapping',
    description: 'Get the creative_id for each ad in an account. Calls GET /act_{id}/ads?fields=id,name,creative{{id}}. Use this to link ad performance data (from ads_get_ad_performance) with creative assets (from ads_get_creative_performance). Accepts optional adIds[] param to filter specific ads.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_upload_image',
    description: 'Upload a local image file to the Meta Ads Image Library. Returns image_hash for use in creative creation. Supported formats: .jpg, .jpeg, .png. Max file size: 30 MB.',
    inputSchema: createUploadInputSchema(['filePath']),
  },
  {
    name: 'ads_upload_video',
    description: 'Upload a local video file to the Meta Ads Video Library. Returns video_id for use in creative creation. Supported formats: .mp4, .mov, .avi, .wmv. Max file size: 1 GB. Video processing is async.',
    inputSchema: createUploadInputSchema(['filePath']),
  },
  {
    name: 'ads_get_account_info',
    description: 'Get detailed information about a Meta Ads account. Returns account name, currency, timezone, balance, spending limit, amount spent, account status, and business info.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_adimages',
    description: 'List images from the Meta Ads Image Library. Returns image hash, URL, dimensions, name, and creatives count. Calls GET /act_{id}/adimages.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_advideos',
    description: 'List videos from the Meta Ads Video Library (paginated). Returns video ID, title, source URL, status, file size, and thumbnail. Calls GET /act_{id}/advideos. Supports params: limit, cursor.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_get_ad_preview',
    description: 'Get a preview URL for a Meta ad creative in a specific ad format. Returns preview URL, platform, and ad format. Calls GET /{creative_id}/previews. Required params: creativeId, adFormat (enum: DESKTOP_FEED, MOBILE_FEED, INSTAGRAM_FEED, INSTAGRAM_EXPLORE, INSTAGRAM_REELS, INSTAGRAM_STORIES, FACEBOOK_STORIES, MESSENGER_INBOX, MARKETPLACE, REWARDS_PLATFORM, FACEBOOK_REELS).',
    inputSchema: createPreviewInputSchema(),
  },
  {
    name: 'ads_get_ad_destinations',
    description: 'Get destination URLs from ads with their creative metadata. Fetches ads with object_story_spec and asset_feed_spec, then extracts the destination URL for each creative type (link, video, carousel, Advantage+, existing post). Supports status filtering. Calls GET /act_{id}/ads?fields=id,name,status,effective_status,creative{id,object_type,object_story_spec,asset_feed_spec}.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_pages',
    description: 'List Meta Pages accessible by the token for selecting a valid pageId for ad creative object_story_spec.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_instagram_accounts',
    description: 'List Instagram Business Accounts connected to the user\'s Facebook Pages.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_threads_profiles',
    description: 'List Threads profiles connected to the user\'s Facebook Pages.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_whatsapp_accounts',
    description: 'Discover WhatsApp Business Accounts (WABA) — both owned and client-shared. Calls GET /{businessId}/owned_whatsapp_business_accounts and /{businessId}/client_whatsapp_business_accounts.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_whatsapp_phone_numbers',
    description: 'List phone numbers associated with a WhatsApp Business Account (WABA). Returns phone_number_id needed for CTWA creative setup. Calls GET /{wabaId}/phone_numbers.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'ads_list_whatsapp_message_templates',
    description: 'List WhatsApp message templates for a WABA. Supports filtering by name and status (APPROVED, PENDING, REJECTED). Calls GET /{wabaId}/message_templates.',
    inputSchema: createAdsInputSchema([]),
  },
  // --- TikTok GMV Max ---
  {
    name: 'tiktok_gmv_max_create_campaign',
    description: 'Create a TikTok GMV Max campaign for Shop sellers. Requires store_ids, objective_type, campaign_name, and budget.',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_gmv_max_update_campaign',
    description: 'Update a TikTok GMV Max campaign (name, budget, status).',
    inputSchema: createAdsInputSchema([]),
  },
  {
    name: 'tiktok_gmv_max_create_session',
    description: 'Create a GMV Max session (sale event) for an existing GMV Max campaign. Requires session_name, start_time, end_time.',
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
    description: 'Create a TikTok Smart Plus campaign (Advantage+ equivalent). TikTok handles targeting and creatives automatically.',
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
    description: 'Create a TikTok Smart Plus ad group. TikTok handles targeting and creatives automatically.',
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

  const request = toAdsBrokerRequest(args, connectionKey);
  const response = await callBrokerMethod(broker, name, request);
  const canonicalResponse = canonicalizeToolResponse(name, request, response);
  const safeResponse = stripRawFromResponse(redactTokenLikeValues(canonicalResponse)) as AdsBrokerResponse;

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

export function toAdsBrokerRequest(args: Record<string, unknown>, connectionKey?: string): AdsBrokerRequest {
  const oauthAuthContext = (args._oauthAuthContext as AdsBrokerRequest['oauthAuthContext']) ?? undefined;

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
  const reserved = new Set(['provider', 'providers', 'accountId', 'since', 'until', 'params', '_oauthAuthContext']);

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
    case 'ads_get_performance':
      return callCanonicalPerformanceTool(broker, request);
    case 'ads_get_creatives':
      return broker.getCreativePerformance({
        ...request,
        params: { ...request.params, level: 'creative' },
      });
    case 'ads_get_change_history':
      if ((request.provider ?? 'meta') !== 'meta') return Promise.resolve(getAdsChangeHistory(request));
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
    case 'ads_archive_ad':
      return broker.archiveAd(request);
    case 'ads_update_adset':
      return broker.updateAdSet(request);
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
    case 'ads_list_pages':
      return broker.listPages(request);
    case 'ads_list_instagram_accounts':
      return broker.listInstagramAccounts(request);
    case 'ads_list_threads_profiles':
      return broker.listThreadsProfiles(request);
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
        errors: [{ code: 'UNSUPPORTED_OPERATION', message: `'${name}' is not implemented through the broker yet` }],
      });
  }
}

function getAdsChangeHistory(request: AdsBrokerRequest): AdsBrokerResponse<Record<string, unknown>> {
  const provider = request.provider ?? 'meta';
  if (provider !== 'meta') {
    return {
      ok: false,
      provider,
      errors: [{
        provider,
        code: 'NOT_IMPLEMENTED',
        message: 'ads_get_change_history is currently implemented only for Meta-compatible change history envelopes.',
      }],
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
      warnings: [{
        code: 'CHANGE_HISTORY_ADAPTER_NOT_CONNECTED',
        message: 'Meta change history envelope is available; provider API fetching will be attached behind this canonical tool in the adapter layer.',
        severity: 'info',
      }],
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

  const rows = Array.isArray(response.data) ? response.data as AdsMetricRecord[] : [];
  const level = name === 'ads_get_creatives' ? 'creative' : parsePerformanceLevel(request.params.level);
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
  const requestedDimensions = parseStringArray(request.params.dimensions);
  const metrics = requestedMetrics.length ? requestedMetrics : inferMetrics(rows);
  const dimensions = requestedDimensions.length ? requestedDimensions : inferDimensions(level, rows);
  const unsupportedMetrics = metrics.filter((metric) => !SUPPORTED_CANONICAL_METRICS.has(metric));
  const warningObjects = unsupportedMetrics.map((metric) => ({
    code: 'UNSUPPORTED_METRIC',
    message: `${metric} is not part of the canonical ads metric set yet. Provider data may still be present in raw normalized rows if supported by the adapter.`,
    field: `metrics.${metric}`,
    severity: 'warning' as const,
  }));

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
    rows,
    paging: {
      nextCursor: typeof response.meta?.nextCursor === 'string' ? response.meta.nextCursor : null,
    },
    warnings: [
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

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function inferMetrics(rows: AdsMetricRecord[]): string[] {
  const metrics = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.delivery)) metrics.add(key);
    for (const group of [row.clicks, row.conversions, row.commerce, row.leads, row.video, row.engagement]) {
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
        message: typeof record.message === 'string' ? record.message : 'Provider returned a warning.',
        field: typeof record.field === 'string' ? record.field : undefined,
        severity: record.severity === 'info' ? 'info' as const : 'warning' as const,
      };
    }
    return { code: 'PROVIDER_WARNING', message: 'Provider returned a warning.', severity: 'warning' as const };
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
  const provider = request.provider && isAdsProviderId(request.provider) ? request.provider : undefined;

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
        common: ['spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm'],
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
        ],
        dimensions: ['account', 'campaign', 'adset', 'adgroup', 'ad', 'creative'],
        breakdowns: ['date', 'country', 'region', 'platform', 'placement', 'product'],
        pagination: { cursor: true, limit: true },
        dataFreshness: { retrievedAt: true },
      },
      writes: {
        optIn: true,
        enabled: areAdsWriteToolsEnabled(),
        enableFlag: 'ADSTREAM_ENABLE_WRITES',
        optionalTools: ADS_MCP_TOOL_NAMES.filter((name) => isAdsMcpWriteTool(name)),
        safetyContract: 'docs/WRITE_SAFETY_CONTRACT.md',
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
        description: 'Absolute path to the local file to upload. Example: /Users/name/Downloads/ad-image.jpg',
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

function createCreateCampaignInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      name: { type: 'string', description: 'Campaign name.' },
      objective: {
        type: 'string',
        enum: [
          'OUTCOME_SALES', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT',
          'OUTCOME_LEADS', 'OUTCOME_AWARENESS', 'OUTCOME_APP_PROMOTION',
          'OUTCOME_CONVERSATIONS', 'OUTCOME_RESHARES', 'OUTCOME_VALUE',
          'OUTCOME_VIDEO_VIEWS', 'OUTCOME_POST_ENGAGEMENT',
          'OUTCOME_LANDING_PAGE_VIEWS', 'OUTCOME_REACH',
          'OUTCOME_MESSAGES', 'OUTCOME_THRUPLAY',
        ],
        description: 'Campaign objective.',
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED'],
        description: 'Campaign status. Defaults to PAUSED.',
      },
      specialAdCategories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Meta special ad categories (e.g. CREDIT, EMPLOYMENT, HOUSING, SOCIAL_ISSUES_ELECTIONS).',
      },
      buyType: {
        type: 'string',
        enum: ['AUCTION', 'RESERVED'],
        description: 'Buying type. Defaults to AUCTION.',
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
      status: {
        type: 'string',
        enum: ['ACTIVE', 'PAUSED'],
        description: 'Ad set status. Defaults to PAUSED.',
      },
      dailyBudget: { type: 'number', description: 'Daily budget in local currency minor units.' },
      lifetimeBudget: { type: 'number', description: 'Lifetime budget in local currency minor units.' },
      billingEvent: {
        type: 'string',
        enum: ['IMPRESSIONS', 'LINK_CLICKS', 'PAGE_LIKES', 'POST_ENGAGEMENT', 'VIDEO_VIEWS', 'LEADS', 'APP_INSTALLS', 'REACH', 'VALUE', 'LANDING_PAGE_VIEWS', 'OFFSITE_CONVERSIONS'],
        description: 'Billing event. Defaults to IMPRESSIONS.',
      },
      optimizationGoal: {
        type: 'string',
        enum: ['NONE', 'APP_INSTALLS', 'CONVERSATIONS', 'ENGAGED_USERS', 'IMPRESSIONS', 'LANDING_PAGE_VIEWS', 'LEAD_GENERATION', 'LINK_CLICKS', 'OFFSITE_CONVERSIONS', 'PAGE_LIKES', 'POST_ENGAGEMENT', 'REACH', 'THRUPLAY', 'VALUE'],
        description: 'Optimization goal. Defaults to REACH.',
      },
      bidStrategy: {
        type: 'string',
        description: 'Bid strategy (e.g. LOWEST_COST_WITHOUT_CAP).',
      },
      geoLocations: {
        type: 'object',
        description: 'Geo targeting object with countries[], regions[], cities[].',
      },
      bidAmount: { type: 'number', description: 'Bid amount in account currency cents. REQUIRED when bidStrategy is COST_CAP or LOWEST_COST_WITH_BID_CAP.' },
      bidConstraints: { type: 'object', description: 'Bid constraints for LOWEST_COST_WITH_MIN_ROAS. Shape: { roas_average_floor: number }.' },
      ageMin: { type: 'number', description: 'Minimum age target (e.g. 18).' },
      ageMax: { type: 'number', description: 'Maximum age target (e.g. 65).' },
      genders: { type: 'array', items: { type: 'number' }, description: 'Gender targeting values. Meta uses 1=male, 2=female.' },
      publisherPlatforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Publisher platforms (e.g. facebook, instagram, messenger).',
        },
        interests: {
          type: 'array',
          description: 'Interest targeting array [{ id, name }].',
        },
        promotedObject: {
          type: 'object',
          description: 'Promoted object (e.g. { pixel_id, custom_event_type }).',
        },
        startTime: { type: 'string', description: 'Start time in ISO format.' },
        endTime: { type: 'string', description: 'End time in ISO format.' },
      destinationType: { type: 'string', description: 'Where users go: WEBSITE, APP, MESSENGER, WHATSAPP, INSTAGRAM_DIRECT, etc.' },
      attributionSpec: { type: 'array', description: 'Attribution window spec. Example: [{ event_type: "CLICK_THROUGH", window_days: 7 }]' },
      frequencyControlSpecs: { type: 'array', description: 'Frequency cap specs. Example: [{ event: "IMPRESSIONS", interval_days: 7, max_frequency: 3 }]' },
      isDynamicCreative: { type: 'boolean', description: 'Enable Dynamic Creative for this ad set.' },
      dsaBeneficiary: { type: 'string', description: 'DSA beneficiary for European compliance (person/org that benefits from ads).' },
      dsaPayor: { type: 'string', description: 'DSA payor for European compliance (person/org paying for the ads).' },
      multiAdvertiserAds: { type: 'number', description: 'Multi-Advertiser Ads opt-in (1) or opt-out (0).' },
      dedupeByName: {
        type: 'boolean',
        description: 'Check for an existing ad set with the same name under the campaign before creating.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
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
      pageId: { type: 'string', description: 'Meta Page ID used in object_story_spec.' },
      link: { type: 'string', description: 'Destination URL for the link ad.' },
      message: { type: 'string', description: 'Primary ad text (message).' },
      headline: { type: 'string', description: 'Ad headline.' },
      description: { type: 'string', description: 'Optional ad description.' },
      imageHash: { type: 'string', description: 'Uploaded Meta image hash.' },
      videoId: { type: 'string', description: 'Uploaded Meta video ID.' },
      callToActionType: {
        type: 'string',
        enum: ['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER', 'BOOK_NOW', 'DOWNLOAD', 'CONTACT_US', 'SUBSCRIBE', 'INSTALL_APP'],
        description: 'Call to action button type.',
      },
      instagramUserId: { type: 'string', description: 'Instagram user ID for IG posting.' },
      threadsProfileId: { type: 'string', description: 'Threads profile ID for Threads posting.' },
      dedupeByName: {
        type: 'boolean',
        description: 'Check for an existing creative with the same name before creating.',
      },
      externalReference: {
        type: 'string',
        description: 'Caller-provided reference for duplicate prevention and audit correlation.',
      },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'name', 'pageId', 'message'],
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
        description: 'Check for an existing ad with the same name under the ad set before creating.',
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

function createArchiveAdInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      adId: { type: 'string', description: 'The ad ID to archive.' },
    },
    required: ['adId'],
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
      dailyBudget: { type: 'number', description: 'New daily budget in local currency minor units.' },
      lifetimeBudget: { type: 'number', description: 'New lifetime budget.' },
      bidStrategy: { type: 'string', description: 'New bid strategy.' },
      optimizationGoal: {
        type: 'string',
        enum: ['REACH', 'IMPRESSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'CONVERSATIONS', 'VALUE'],
        description: 'New optimization goal.',
      },
      geoLocations: { type: 'object', description: 'Geo targeting object.' },
      ageMin: { type: 'number', description: 'Minimum age target.' },
      ageMax: { type: 'number', description: 'Maximum age target.' },
      genders: { type: 'array', items: { type: 'number' }, description: 'Gender targeting values. Meta uses 1=male, 2=female.' },
      publisherPlatforms: { type: 'array', items: { type: 'string' }, description: 'Publisher platforms.' },
      startTime: { type: 'string', description: 'Start time in ISO format.' },
      endTime: { type: 'string', description: 'End time in ISO format.' },
      mode: {
        type: 'string',
        enum: ['patch', 'replace'],
        description: 'Nested update mode. Defaults to patch; replace requires explicit replacement confirmation.',
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

function createGetTargetingOptionsInputSchema() {
  const schema = createAdsInputSchema([]);

  return {
    type: 'object',
    properties: {
      ...(schema.properties as Record<string, unknown>),
      type: {
        type: 'string',
        enum: ['interests', 'behaviors', 'demographics', 'industries', 'life_events'],
        description: 'Targeting option type to search.',
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
      pixelId: { type: 'string', description: 'Meta Pixel ID for ecommerce conversion optimization.' },
      destinationUrl: { type: 'string', description: 'Product or landing page URL.' },
      dailyBudget: { type: 'number', description: 'Daily budget in account minor currency units.' },
      countries: { type: 'array', items: { type: 'string' }, description: 'ISO country codes, e.g. ["ID"].' },
      primaryText: { type: 'string', description: 'Primary ad text.' },
      headline: { type: 'string', description: 'Ad headline.' },
      description: { type: 'string', description: 'Optional ad description.' },
      imageHash: { type: 'string', description: 'Uploaded Meta image hash. Required for static creative unless imageFilePath is provided.' },
      imageFilePath: { type: 'string', description: 'Local image file path. Alternative to imageHash — auto-uploads before creative creation.' },
      videoFilePath: { type: 'string', description: 'Local video file path. Alternative to videoId — auto-uploads before creative creation.' },
      callToActionType: { type: 'string', enum: ['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER'] },
      specialAdCategories: { type: 'array', items: { type: 'string' }, description: 'Meta special ad categories. Defaults to [] only when not applicable.' },
      ageMin: { type: 'number' },
      ageMax: { type: 'number' },
      publisherPlatforms: { type: 'array', items: { type: 'string' } },
      instagramUserId: { type: 'string', description: 'Instagram user ID for IG posting.' },
      threadsProfileId: { type: 'string', description: 'Threads profile ID for Threads posting.' },
      dryRun: { type: 'boolean', description: 'Defaults to true. Set false only after preview.' },
      confirmed: { type: 'boolean', description: 'Must be true to execute after preview.' },
    },
    required: ['accountId', 'campaignName', 'adSetName', 'adName', 'pageId', 'pixelId', 'destinationUrl', 'dailyBudget', 'countries', 'primaryText', 'headline'],
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
        items: { type: 'object', additionalProperties: true },
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
