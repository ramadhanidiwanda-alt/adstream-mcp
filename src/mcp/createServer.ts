import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  MetaClient,
  loadConfig,
  type MetaConfig,
  getAdAccounts,
  getCampaigns,
  getCampaignInsights,
  getAdsetInsights,
  getAdsInsights,
  getLocationInsights,
  generateDailyReport,
  RuleEngine,
  allRuleTemplates,
  ADS_FILTER_OPERATORS,
  areAdsWriteToolsEnabled,
  getAdsMcpToolDefinitions,
  getAdsMcpToolAnnotations,
  COMMERCE_MCP_TOOL_DEFINITIONS,
  createDefaultAdsBroker,
  createAdsBrokerFromConfig,
  handleAdsMcpToolCall,
  handleCommerceMcpToolCall,
  isAdsMcpToolName,
  parseBrokerConfigFromEnv,
  safeAdsMcpError,
  assertLocationBreakdowns,
  TikTokApiClient,
  getTikTokReport,
  getGmvMaxReport,
  getTikTokAdvertisers,
  getTikTokLocationInsights,
} from '../index.js';
import type { LocationBreakdown } from '../index.js';
import { META_CREATIVE_FORMATS } from '../types.js';
import {
  META_CONVERSION_LOCATIONS,
  META_ODAX_OBJECTIVES,
} from '../providers/meta/objectiveLaunchMatrix.js';
import { META_LAUNCH_WORKFLOW_INPUT_VALUES } from '../tools/checkLaunchReadiness.js';

export interface CreateMetaAdsMcpServerOptions {
  client?: MetaClient;
  config?: MetaConfig;
  adsBroker?: ReturnType<typeof createDefaultAdsBroker>;
  tiktokClient?: TikTokApiClient;
}

type ToolArguments = {
  provider?: string;
  providers?: string[];
  accountId?: string;
  params?: Record<string, unknown>;
  adAccountId?: string;
  since?: string;
  until?: string;
  status?: string[];
  limit?: number;
  level?: 'campaign' | 'adset' | 'ad';
  breakdowns?: unknown;
  category?: string;
  sortBy?: string;
  sortDirection?: string;
  minSpend?: number;
  minClicks?: number;
};

const adsBaseInputSchema = {
  provider: z
    .enum(['meta', 'tiktok', 'google'])
    .optional()
    .describe('Ads provider. Defaults to meta when omitted.'),
  providers: z
    .array(z.enum(['meta', 'tiktok', 'google']))
    .optional()
    .describe('Multi-provider reporting input for supported read providers.'),
  accountId: z
    .string()
    .optional()
    .describe('Provider account id. Optional when credentials include a default account.'),
  since: z.string().optional().describe('Start date in YYYY-MM-DD format.'),
  until: z.string().optional().describe('End date in YYYY-MM-DD format.'),
  params: z
    .record(z.unknown())
    .optional()
    .describe('Optional provider-safe parameters such as limit and breakdowns.'),
};

const sinceUntilInputSchema = {
  ...adsBaseInputSchema,
  since: z.string().describe('Start date in YYYY-MM-DD format.'),
  until: z.string().describe('End date in YYYY-MM-DD format.'),
};

const adsPerformanceInputSchema = {
  ...sinceUntilInputSchema,
  level: z
    .enum(['account', 'campaign', 'adset', 'adgroup', 'ad', 'creative'])
    .optional()
    .describe('Normalized entity level. Defaults to campaign when omitted.'),
  metrics: z
    .array(z.string())
    .optional()
    .describe('Normalized metric names to request when supported.'),
  dimensions: z.array(z.string()).optional().describe('Normalized dimensions to include in rows.'),
  breakdowns: z
    .array(z.string())
    .optional()
    .describe('Provider-supported breakdowns such as date, country, platform, or placement.'),
  filters: z
    .array(
      z.object({
        field: z.string().min(1),
        operator: z.enum(ADS_FILTER_OPERATORS),
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.union([z.string(), z.number(), z.boolean()])).min(1),
        ]),
      })
    )
    .optional()
    .describe('Explicit filters over normalized or provider-supported fields.'),
  sortBy: z.string().optional().describe('Metric or dimension used for sorting.'),
  sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction.'),
  limit: z.number().optional().describe('Maximum number of rows to return.'),
  cursor: z.string().optional().describe('Opaque pagination cursor from a previous response.'),
};

const adsCreativeInputSchema = {
  ...adsPerformanceInputSchema,
  since: z.string().optional().describe('Optional start date in YYYY-MM-DD format.'),
  until: z.string().optional().describe('Optional end date in YYYY-MM-DD format.'),
};

const leadFormsInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id used to resolve Meta credentials.'),
  pageId: z.string().describe('Facebook Page ID that owns the Instant Forms.'),
  status: z.array(z.string()).optional().describe('Optional Instant Form statuses to include.'),
  limit: z.number().optional().describe('Maximum forms to return (default 50).'),
};

const launchReadinessInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for launch readiness checks.'),
  workflow: z
    .enum(META_LAUNCH_WORKFLOW_INPUT_VALUES)
    .optional()
    .describe(
      'Canonical Meta v25 workflow. Legacy aliases are accepted for compatibility and normalize to canonical output. Defaults to sales_website when omitted.'
    ),
  objective: z
    .enum(META_ODAX_OBJECTIVES)
    .optional()
    .describe('Optional ODAX objective override for the workflow.'),
  conversionLocation: z
    .enum(META_CONVERSION_LOCATIONS)
    .optional()
    .describe('Optional conversion location override for the workflow.'),
  optimizationGoal: z.string().optional().describe('Optional Meta optimization goal.'),
  creativeFormat: z
    .enum(META_CREATIVE_FORMATS)
    .optional()
    .describe('Optional intended creative format to validate against the resolved workflow.'),
  apiVersion: z.string().optional().describe('Meta Marketing API version, defaults to v25.0.'),
  productOrOffer: z.string().optional().describe('Product or offer being promoted.'),
  pageId: z.string().optional().describe('Meta Page ID.'),
  pixelId: z.string().optional().describe('Meta Pixel ID for conversion workflows.'),
  destinationUrl: z.string().optional().describe('Website, marketplace, or WhatsApp URL.'),
  dailyBudget: z.number().optional().describe('Daily budget in account minor units.'),
  countries: z.array(z.string()).optional().describe('Target countries.'),
  primaryText: z.string().optional().describe('Primary ad text.'),
  headline: z.string().optional().describe('Ad headline.'),
  imageHash: z.string().optional().describe('Existing Meta image hash.'),
  videoId: z.string().optional().describe('Existing Meta video ID.'),
  imageFilePath: z.string().optional().describe('Local image path for upload.'),
  videoFilePath: z.string().optional().describe('Local video path for upload.'),
  creativeId: z.string().optional().describe('Existing creative ID.'),
  existingPostId: z.string().optional().describe('Existing object_story_id/post ID.'),
  whatsappPhoneNumberId: z.string().optional().describe('WhatsApp phone number ID.'),
  businessId: z.string().optional().describe('Meta Business ID for catalog discovery.'),
  catalogId: z.string().optional().describe('Meta product catalog ID.'),
  productSetId: z.string().optional().describe('Meta product set ID.'),
  leadFormId: z.string().optional().describe('Published Meta Instant Form ID.'),
  applicationId: z.string().optional().describe('Meta application ID for app promotion.'),
  objectStoreUrl: z.string().optional().describe('App Store or Play Store URL for app promotion.'),
  appDeepLinkUrl: z.string().optional().describe('Optional app deep-link URL.'),
  specialAdCategories: z
    .array(z.string())
    .optional()
    .describe('Special ad categories, or [] after confirming none apply.'),
};

const businessIdInputSchema = {
  ...adsBaseInputSchema,
  businessId: z.string().describe('Meta Business ID.'),
  limit: z.number().optional().describe('Maximum rows to return.'),
};

const catalogIdInputSchema = {
  ...adsBaseInputSchema,
  catalogId: z.string().describe('Meta Product Catalog ID.'),
  limit: z.number().optional().describe('Maximum rows to return.'),
};

const instagramMediaInputSchema = {
  ...adsBaseInputSchema,
  igUserId: z
    .string()
    .describe('Instagram Business Account ID (from ads_list_instagram_accounts).'),
  limit: z.number().optional().describe('Maximum rows to return per page.'),
  cursor: z.string().optional().describe('Pagination cursor from a previous call.'),
  permalinkUrls: z
    .array(z.string())
    .optional()
    .describe(
      'Raw instagram.com post/reel/tv URLs to resolve into media IDs by matching shortcode. When set, only matching media is returned.'
    ),
};

const ecommerceLaunchInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for ecommerce campaign creation.'),
  campaignName: z.string().describe('Campaign name. MVP uses OUTCOME_SALES.'),
  adSetName: z.string().describe('Ad set name.'),
  adName: z.string().describe('Ad name.'),
  pageId: z.string().describe('Meta Page ID used in object_story_spec.'),
  pixelId: z.string().describe('Meta Pixel ID for ecommerce conversion optimization.'),
  destinationUrl: z.string().describe('Product or landing page URL.'),
  dailyBudget: z.number().describe('Daily budget in account minor currency units.'),
  countries: z.array(z.string()).describe('ISO country codes, e.g. ["ID"].'),
  primaryText: z.string().describe('Primary ad text.'),
  headline: z.string().describe('Ad headline.'),
  description: z.string().optional().describe('Optional ad description.'),
  imageHash: z
    .string()
    .optional()
    .describe(
      'Uploaded Meta image hash. Required for static creative unless imageFilePath is provided.'
    ),
  imageFilePath: z
    .string()
    .optional()
    .describe(
      'Local image file path. Alternative to imageHash — auto-uploads before creative creation.'
    ),
  videoFilePath: z
    .string()
    .optional()
    .describe(
      'Local video file path. Alternative to videoId — auto-uploads before creative creation.'
    ),
  callToActionType: z.enum(['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER']).optional(),
  specialAdCategories: z.array(z.string()).optional().describe('Meta special ad categories.'),
  ageMin: z.number().optional(),
  ageMax: z.number().optional(),
  publisherPlatforms: z.array(z.string()).optional(),
  instagramUserId: z.string().optional().describe('Instagram user ID for IG posting.'),
  threadsProfileId: z.string().optional().describe('Threads profile ID for Threads posting.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const createCampaignInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for campaign creation.'),
  name: z.string().describe('Campaign name.'),
  mode: z
    .enum(['standard', 'collaborative_ads'])
    .optional()
    .describe(
      'standard untuk iklan Meta biasa; collaborative_ads untuk katalog retailer yang sudah dibagikan.'
    ),
  objective: z.enum(META_ODAX_OBJECTIVES).describe('Meta ODAX campaign objective.'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Campaign status. Defaults to PAUSED.'),
  specialAdCategories: z.array(z.string()).optional().describe('Meta special ad categories.'),
  buyType: z.enum(['AUCTION', 'RESERVED']).optional().describe('Buying type. Defaults to AUCTION.'),
  isAdSetBudgetSharingEnabled: z
    .boolean()
    .optional()
    .describe('Izinkan ad set tanpa campaign budget berbagi hingga 20% anggaran. Default false.'),
  dailyBudget: z.number().optional().describe('Daily budget in local currency minor units.'),
  lifetimeBudget: z.number().optional().describe('Lifetime budget in local currency minor units.'),
  bidStrategy: z.string().optional().describe('Bid strategy.'),
  dedupeByName: z
    .boolean()
    .optional()
    .describe('Check for an existing campaign with the same name before creating.'),
  externalReference: z
    .string()
    .optional()
    .describe('Caller-provided reference for duplicate prevention and audit correlation.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const createAdSetInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for ad set creation.'),
  campaignId: z.string().describe('The campaign ID to create the ad set under.'),
  name: z.string().describe('Ad set name.'),
  mode: z
    .enum(['standard', 'collaborative_ads'])
    .optional()
    .describe(
      'standard untuk iklan Meta biasa; collaborative_ads untuk katalog retailer yang sudah dibagikan.'
    ),
  collaborativeCatalog: z
    .object({
      productSetId: z.string().describe('ID product set dari katalog retailer yang dibagikan.'),
      pixelId: z
        .string()
        .optional()
        .describe('ID Meta Pixel untuk mengukur event konversi, jika digunakan.'),
      customEventType: z
        .string()
        .optional()
        .describe('Event konversi Meta, misalnya PURCHASE, jika digunakan.'),
      destinationUrl: z
        .string()
        .optional()
        .describe('URL tujuan katalog atau toko retailer, jika digunakan.'),
      applicationId: z
        .string()
        .optional()
        .describe('ID aplikasi retailer, misalnya aplikasi Shopee.'),
      objectStoreUrls: z
        .array(z.string())
        .optional()
        .describe('URL Play Store dan App Store aplikasi retailer.'),
    })
    .optional()
    .describe(
      'Konteks katalog retailer untuk Collaborative Ads. Isi product set, pixel omnichannel, aplikasi retailer, event, dan URL app store sesuai data kolaborasi.'
    ),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Ad set status. Defaults to PAUSED.'),
  dailyBudget: z
    .number()
    .optional()
    .describe('Daily budget in local currency minor units. Do NOT set if campaign uses CBO.'),
  lifetimeBudget: z
    .number()
    .optional()
    .describe('Lifetime budget in local currency minor units. Do NOT set if campaign uses CBO.'),
  billingEvent: z
    .enum([
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
    ])
    .optional()
    .describe('Billing event. Defaults to IMPRESSIONS.'),
  optimizationGoal: z
    .enum([
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
    ])
    .optional()
    .describe('Optimization goal. Required when conversionLocation is omitted.'),
  conversionLocation: z
    .enum(META_CONVERSION_LOCATIONS)
    .optional()
    .describe('Objective-aware Meta conversion location.'),
  creativeFormat: z
    .enum(META_CREATIVE_FORMATS)
    .optional()
    .describe('Creative format used to validate the objective launch.'),
  pageId: z.string().optional().describe('Meta Page ID for the objective launch.'),
  pixelId: z.string().optional().describe('Meta Pixel ID for website conversions.'),
  leadFormId: z.string().optional().describe('Meta instant form ID for lead generation.'),
  applicationId: z.string().optional().describe('Meta application ID for app promotion.'),
  objectStoreUrl: z.string().optional().describe('App store URL for app promotion.'),
  productSetId: z.string().optional().describe('Meta product set ID for catalog sales.'),
  customEventType: z.string().optional().describe('Optional Meta conversion event type.'),
  bidStrategy: z
    .string()
    .optional()
    .describe(
      'Bid strategy. Optional — if not set, inherits from campaign. Valid: LOWEST_COST_WITHOUT_CAP, LOWEST_COST_WITH_BID_CAP, COST_CAP, LOWEST_COST_WITH_MIN_ROAS. Do NOT use "LOWEST_COST" (invalid).'
    ),
  geoLocations: z
    .record(z.unknown())
    .optional()
    .describe('Geo targeting object with countries[], regions[], cities[].'),
  bidAmount: z
    .number()
    .optional()
    .describe(
      'Bid amount in account currency cents. REQUIRED when bidStrategy is COST_CAP or LOWEST_COST_WITH_BID_CAP. Example: 500000 = Rp5.000.'
    ),
  bidConstraints: z
    .record(z.unknown())
    .optional()
    .describe(
      'Bid constraints for LOWEST_COST_WITH_MIN_ROAS. Shape: { roas_average_floor: number } where value = target ROAS × 10000.'
    ),
  ageMin: z.number().optional().describe('Minimum age target (e.g. 18).'),
  ageMax: z.number().optional().describe('Maximum age target (e.g. 65).'),
  genders: z
    .array(z.number())
    .optional()
    .describe('Gender targeting values. Meta uses 1=male, 2=female.'),
  publisherPlatforms: z
    .array(z.string())
    .optional()
    .describe('Publisher platforms (e.g. facebook, instagram).'),
  interests: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('Interest targeting array [{ id, name }].'),
  customAudiences: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('Custom audiences to include (retargeting), array of [{ id }].'),
  excludedCustomAudiences: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('Custom audiences to exclude, array of [{ id }].'),
  promotedObject: z
    .record(z.unknown())
    .optional()
    .describe('Promoted object (e.g. { pixel_id, custom_event_type }).'),
  startTime: z.string().optional().describe('Start time in ISO format.'),
  endTime: z.string().optional().describe('End time in ISO format.'),
  destinationType: z
    .string()
    .optional()
    .describe('Where users go: WEBSITE, APP, MESSENGER, WHATSAPP, INSTAGRAM_DIRECT, etc.'),
  attributionSpec: z
    .array(z.record(z.unknown()))
    .optional()
    .describe(
      'Attribution window spec. Example: [{ event_type: "CLICK_THROUGH", window_days: 7 }]'
    ),
  frequencyControlSpecs: z
    .array(z.record(z.unknown()))
    .optional()
    .describe(
      'Frequency cap specs. Example: [{ event: "IMPRESSIONS", interval_days: 7, max_frequency: 3 }]'
    ),
  isDynamicCreative: z
    .boolean()
    .optional()
    .describe(
      'Legacy Meta API compatibility flag. Jangan diisi untuk iklan normal; hanya set true saat attaching flexible asset_feed_spec multi-varian yang sudah direview dan Meta menolak adset non-Dynamic Creative.'
    ),
  dsaBeneficiary: z
    .string()
    .optional()
    .describe('DSA beneficiary for European compliance (person/org that benefits from ads).'),
  dsaPayor: z
    .string()
    .optional()
    .describe('DSA payor for European compliance (person/org paying for the ads).'),
  multiAdvertiserAds: z
    .number()
    .optional()
    .describe('Multi-Advertiser Ads opt-in (1) or opt-out (0).'),
  dedupeByName: z
    .boolean()
    .optional()
    .describe(
      'Check for an existing ad set with the same name under the campaign before creating.'
    ),
  externalReference: z
    .string()
    .optional()
    .describe('Caller-provided reference for duplicate prevention and audit correlation.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const legacyDynamicCreativeAssetFeedSpecSchema = z
  .object({
    bodies: z.array(z.object({ text: z.string().min(1) }).passthrough()).min(1),
    titles: z.array(z.object({ text: z.string().min(1) }).passthrough()).min(1),
    link_urls: z.array(z.object({ website_url: z.string().url() }).passthrough()).min(1),
  })
  .passthrough();

const dynamicCreativeAssetFeedSpecSchema = z
  .object({
    ad_formats: z.array(z.literal('AUTOMATIC_FORMAT')).min(1),
    bodies: z.array(z.object({ text: z.string().min(1) }).passthrough()).min(1),
    titles: z.array(z.object({ text: z.string().min(1) }).passthrough()).min(1),
    images: z.array(z.object({ hash: z.string().min(1) }).passthrough()).min(1),
    link_urls: z.array(z.object({ website_url: z.string().url() }).passthrough()).min(1),
    call_to_action_types: z.array(z.string().min(1)).min(1),
  })
  .passthrough();

const objectStorySpecInputSchema = z
  .object({
    asset_feed_spec: legacyDynamicCreativeAssetFeedSpecSchema.optional(),
  })
  .passthrough()
  .describe(
    'Input advanced/backward-compatible Meta object_story_spec. Flexible asset-feed legacy dapat memakai asset_feed_spec di sini; untuk iklan baru prefer creativeFormat="flexible" + creativeSpec, atau assetFeedSpec tingkat atas bila harus memakai legacy.'
  );

export const createAdCreativeInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for creative creation.'),
  name: z.string().describe('Creative name.'),
  pageId: z
    .string()
    .optional()
    .describe(
      'Meta Page ID used in object_story_spec. Tidak diperlukan untuk creativeFormat=existing_post.'
    ),
  mode: z
    .enum(['standard', 'collaborative_ads'])
    .optional()
    .describe(
      'standard untuk iklan Meta biasa; collaborative_ads untuk katalog retailer yang sudah dibagikan.'
    ),
  objective: z
    .enum(META_ODAX_OBJECTIVES)
    .optional()
    .describe('Canonical ODAX objective. Must be paired with conversionLocation.'),
  conversionLocation: z
    .enum(META_CONVERSION_LOCATIONS)
    .optional()
    .describe('Canonical conversion location. Must be paired with objective.'),
  creativeFormat: z
    .enum([
      'single_image',
      'video',
      'carousel',
      'catalog',
      'collection',
      'flexible',
      'placement_image',
      'placement_customized_ctwa',
      'existing_post',
    ])
    .optional()
    .describe(
      'Format materi iklan: gambar tunggal, video, carousel, katalog, collection, flexible, gambar khusus per placement, atau postingan yang sudah ada.'
    ),
  creativeSpec: z
    .record(z.unknown())
    .optional()
    .describe(
      'Detail materi sesuai creativeFormat. Field per format: single_image memakai imageHash, primaryText, destinationUrl, headline, description, callToAction, pageWelcomeMessage (opsional, untuk Click-to-WhatsApp/Messenger), dan applinkTreatment (opsional, enum: deeplink_with_appstore_fallback, deeplink_with_web_fallback, web_only, deeplink_disabled — hanya berlaku saat collaborativeAppSpec diisi, default automatic; pada mode: collaborative_ads field ini diabaikan untuk video/single_image); video memakai videoId, thumbnailImageHash (opsional — kalau kosong, otomatis diisi dari thumbnail bawaan video via GET /{videoId}?fields=picture; hanya berbahaya diabaikan kalau video belum selesai diproses Meta dan tidak punya thumbnail sama sekali), primaryText, destinationUrl, headline, description, callToAction, pageWelcomeMessage (opsional, untuk Click-to-WhatsApp/Messenger), dan applinkTreatment (opsional, sama seperti single_image); carousel memakai primaryText, destinationUrl, cards (imageHash atau videoId, headline, description, destinationUrl); catalog memakai productSetId, primaryText, destinationUrl, templateUrl, fallbackImageHash; collection memakai instantExperienceId, coverImageHash atau coverVideoId, productSetId, primaryText, destinationUrl; flexible memakai primaryText, primaryTexts, imageHashes dan/atau videoIds, headlines, descriptions, destinationUrl; placement_image memakai asset_feed_spec; placement_customized_ctwa memakai link_data utama, platform_customizations, portrait_customizations, dan pageWelcomeMessage di link_data; existing_post memakai objectStoryId (post id Facebook Page, format {page_id}_{post_id}) ATAU sourceInstagramMediaId (media id IG yang tidak di-cross-post ke Page — dapatkan dari ads_list_instagram_media, cocokkan permalink-nya ke URL instagram.com/reel atau /p yang dimiliki user; wajib isi tepat satu dari dua field ini), plus destinationUrl, callToAction, dan applinkTreatment (opsional). Untuk mengarahkan post yang di-boost ke landing page eksternal dengan tombol CTA: isi destinationUrl + callToAction (mis. LEARN_MORE). Keduanya dikirim sebagai call_to_action di LEVEL ATAS creative (call_to_action.value.link), BUKAN di dalam object_story_spec — object_story_spec bareng source_instagram_media_id ditolak Meta dengan (#100) subcode 1487929 Ambiguous Promoted Object (terverifikasi live di v25.0). Tujuan post Instagram bisa diganti bebas; post Facebook Page yang sudah punya link sendiri mungkin tetap memakai link lamanya — nilainya diteruskan dan Meta yang memutuskan. Pakai urlTags untuk tracking UTM; itu tersimpan bersama call_to_action. destinationUrl juga wajib diisi kalau collaborativeAppSpec diisi, dipakai untuk omnichannel_link_spec.web.url (CATATAN: itu pun tidak bisa memperbaiki object_store_urls yang hilang dari call_to_action post lama yang sudah dipublikasikan; untuk ad set CPAS omnichannel disarankan pakai creativeFormat video langsung). destinationUrl tanpa callToAction maupun collaborativeAppSpec akan DITOLAK, bukan diabaikan diam-diam.'
    ),
  collaborativeProductSetId: z
    .string()
    .optional()
    .describe(
      'Harus sama dengan product set yang dipilih di ad set, dan wajib untuk setiap format creative Collaborative Ads yang didukung pada rilis ini.'
    ),
  collaborativeAppSpec: z
    .object({
      applicationId: z.string(),
      android: z.object({ appName: z.string(), packageName: z.string() }).optional(),
      ios: z.object({ appName: z.string(), appStoreId: z.string() }).optional(),
    })
    .optional()
    .describe(
      'Identitas aplikasi retailer untuk tujuan omnichannel, termasuk ID aplikasi dan data Android/iOS. Untuk creativeFormat video, single_image, dan existing_post, field omnichannel (applink_treatment, omnichannel_link_spec) otomatis ditambahkan begitu field ini diisi — tidak perlu mode: collaborative_ads atau collaborativeProductSetId untuk ketiga format tersebut.'
    ),
  standardAppSpec: z
    .object({
      applicationId: z.string(),
      objectStoreUrl: z.string(),
      deepLinkUrl: z.string().optional(),
    })
    .optional()
    .describe(
      'Kontrak aplikasi untuk OUTCOME_APP_PROMOTION + APP. Wajib isi applicationId dan objectStoreUrl; deepLinkUrl opsional dipakai untuk CTA install.'
    ),
  link: z
    .string()
    .optional()
    .describe('Field legacy/backward-compatible untuk URL tujuan iklan link sederhana.'),
  message: z
    .string()
    .optional()
    .describe('Field legacy/backward-compatible untuk teks utama iklan.'),
  headline: z
    .string()
    .optional()
    .describe('Field legacy/backward-compatible untuk headline iklan.'),
  description: z
    .string()
    .optional()
    .describe('Field legacy/backward-compatible untuk deskripsi iklan opsional.'),
  imageHash: z
    .string()
    .optional()
    .describe('Field legacy/backward-compatible untuk hash gambar Meta yang sudah diunggah.'),
  videoId: z
    .string()
    .optional()
    .describe('Field legacy/backward-compatible untuk ID video Meta yang sudah diunggah.'),
  callToActionType: z
    .string()
    .optional()
    .describe(
      'Field legacy/backward-compatible untuk tombol ajakan bertindak. Free-string (bukan enum tertutup) supaya konsisten dengan creativeSpec.callToAction — Meta punya puluhan CTA type (mis. SHOP_NOW, LEARN_MORE, BOOK_TRAVEL, WHATSAPP_MESSAGE, MESSAGE_PAGE, ORDER_NOW, GET_QUOTE, dll), validasi sebenarnya tetap di sisi Meta.'
    ),
  urlTags: z
    .string()
    .optional()
    .describe(
      'Meta URL Parameters for the creative. Sent to Meta as url_tags, e.g. utm_source={{site_source_name}}&utm_medium={{placement}}.'
    ),
  instagramUserId: z.string().optional().describe('Instagram user ID for IG posting.'),
  threadsProfileId: z.string().optional().describe('Threads profile ID for Threads posting.'),
  // --- CTWA (Click-to-WhatsApp) Support ---
  destinationType: z
    .enum(['WEB', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT', 'APP'])
    .optional()
    .describe(
      'Destination type for the ad. Use WHATSAPP for Click-to-WhatsApp ads. Hanya untuk jalur legacy (link + message); pada creativeFormat + creativeSpec pakai creativeSpec.callToAction = WHATSAPP_MESSAGE. Nilai ini berbeda dari destinationType milik ads_create_adset (WEBSITE/APP/...).'
    ),
  pageWelcomeMessage: z
    .string()
    .optional()
    .describe(
      'Welcome message sent when user clicks the WhatsApp CTA. Hanya untuk jalur legacy (link + message); pada creativeFormat + creativeSpec pakai creativeSpec.pageWelcomeMessage.'
    ),
  whatsappWelcomeMessageSequenceId: z
    .string()
    .optional()
    .describe(
      'Welcome message flow/sequence ID, dikirim sebagai asset_feed_spec.additional_data.partner_app_welcome_message_flow_id. Berlaku untuk semua jalur creative.'
    ),
  objectStorySpec: objectStorySpecInputSchema.optional(),
  assetFeedSpec: dynamicCreativeAssetFeedSpecSchema
    .optional()
    .describe(
      'Input advanced/backward-compatible Meta asset_feed_spec untuk Flexible creative. Untuk iklan baru, prefer creativeFormat="flexible" + creativeSpec; legacy objectStorySpec+assetFeedSpec tetap diterima saat perlu.'
    ),
  optOutEnhancements: z
    .array(z.string())
    .optional()
    .describe(
      'Nama fitur Advantage+ Creative enhancement yang di-disable (OPT_OUT). Contoh: ["image_auto_crop", "text_optimizations", "image_templates"]. Berlaku untuk SEMUA format creative. Jika tidak diisi, Meta mengontrol enhancement secara default.'
    ),
  dedupeByName: z
    .boolean()
    .optional()
    .describe('Check for an existing creative with the same name before creating.'),
  externalReference: z
    .string()
    .optional()
    .describe('Caller-provided reference for duplicate prevention and audit correlation.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const createAdInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for ad creation.'),
  name: z.string().describe('Ad name.'),
  adSetId: z.string().describe('The ad set ID to place the ad under.'),
  creativeId: z.string().describe('The creative ID to use for this ad.'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Ad status. Defaults to PAUSED.'),
  dedupeByName: z
    .boolean()
    .optional()
    .describe('Check for an existing ad with the same name under the ad set before creating.'),
  skipOmnichannelCheck: z
    .boolean()
    .optional()
    .describe(
      'Skip the omnichannel creative pre-flight check. Only set if the check misfires; an omnichannel ad set normally requires an omnichannel-ready creative.'
    ),
  skipPlacementCompatibilityCheck: z
    .boolean()
    .optional()
    .describe(
      'Skip the local placement compatibility pre-flight check. Use only for reviewed CTWA placement-customized creatives that intentionally avoid Dynamic Creative.'
    ),
  externalReference: z
    .string()
    .optional()
    .describe('Caller-provided reference for duplicate prevention and audit correlation.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const cloneUiAdInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required for UI ad cloning.'),
  name: z.string().describe('Name for the cloned ad.'),
  sourceAdId: z
    .string()
    .describe(
      'The Ads Manager-created source ad ID to clone without creative override, preserving UI-only WhatsApp and placement setup.'
    ),
  adSetId: z
    .string()
    .describe('The destination ad set ID. Use the source ad set for safest UI-state preservation.'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Ad status. Defaults to PAUSED.'),
  dedupeByName: z
    .boolean()
    .optional()
    .describe('Check for an existing ad with the same name under the ad set before cloning.'),
  externalReference: z
    .string()
    .optional()
    .describe('Caller-provided reference for duplicate prevention and audit correlation.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const archiveAdInputSchema = {
  ...adsBaseInputSchema,
  adId: z.string().describe('The ad ID to archive.'),
};

const adIdInputSchema = {
  ...adsBaseInputSchema,
  adId: z.string().describe('The ad ID to pause or resume.'),
};

const adSetIdInputSchema = {
  ...adsBaseInputSchema,
  adSetId: z.string().describe('The ad set ID to pause or resume.'),
};

const cloneAdSetInputSchema = {
  ...adsBaseInputSchema,
  accountId: z.string().describe('Provider account id. Required to clone.'),
  sourceAdSetId: z.string().describe('Ad set ID to copy configuration from.'),
  name: z.string().optional().describe('New ad set name. Defaults to "<source> (copy)".'),
  campaignId: z
    .string()
    .optional()
    .describe('Target campaign ID. Defaults to the source ad set campaign.'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Defaults to PAUSED.'),
  startTime: z.string().optional().describe('Schedule start (ISO 8601).'),
  endTime: z.string().optional().describe('Schedule end (ISO 8601).'),
  dailyBudget: z.number().optional().describe('Override daily budget (minor units).'),
  lifetimeBudget: z.number().optional().describe('Override lifetime budget (minor units).'),
  optimizationGoal: z.string().optional().describe('Override optimization goal.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const updateAdSetInputSchema = {
  ...adsBaseInputSchema,
  adSetId: z.string().describe('The ad set ID to update.'),
  name: z.string().optional().describe('New ad set name.'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('New ad set status.'),
  dailyBudget: z.number().optional().describe('New daily budget in minor units.'),
  lifetimeBudget: z.number().optional().describe('New lifetime budget.'),
  bidStrategy: z.string().optional().describe('New bid strategy.'),
  optimizationGoal: z
    .enum(['REACH', 'IMPRESSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'CONVERSATIONS', 'VALUE'])
    .optional()
    .describe('New optimization goal.'),
  geoLocations: z.record(z.unknown()).optional().describe('Geo targeting object.'),
  ageMin: z.number().optional().describe('Minimum age target.'),
  ageMax: z.number().optional().describe('Maximum age target.'),
  genders: z
    .array(z.number())
    .optional()
    .describe('Gender targeting values. Meta uses 1=male, 2=female.'),
  publisherPlatforms: z.array(z.string()).optional().describe('Publisher platforms.'),
  startTime: z.string().optional().describe('Start time in ISO format.'),
  endTime: z.string().optional().describe('End time in ISO format.'),
  mode: z
    .enum(['patch', 'replace'])
    .optional()
    .describe(
      'Nested update mode. Defaults to patch; replace requires explicit replacement confirmation.'
    ),
  replaceTargetingConfirmed: z
    .boolean()
    .optional()
    .describe('Required when mode=replace and targeting is provided.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const updateAdInputSchema = {
  ...adsBaseInputSchema,
  adId: z.string().describe('The ad ID to update.'),
  name: z.string().optional().describe('New ad name.'),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional().describe('New ad status.'),
  creativeId: z
    .string()
    .optional()
    .describe(
      'Point this ad at a different, already-existing creative. Use this to change UTM/tracking parameters on a live ad by first creating a new creative with url_tags set, then swapping this ad to it.'
    ),
  trackingSpecs: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('New tracking_specs array for conversion logging.'),
  conversionDomain: z.string().optional().describe('Domain where conversions occur.'),
  adScheduleStartTime: z.string().optional().describe('Ad-level schedule start (ISO 8601).'),
  adScheduleEndTime: z.string().optional().describe('Ad-level schedule end (ISO 8601).'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const updateCampaignInputSchema = {
  ...adsBaseInputSchema,
  campaignId: z.string().describe('The campaign ID to update.'),
  name: z.string().optional().describe('New campaign name.'),
  status: z
    .enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'])
    .optional()
    .describe('New campaign status. DELETED requires deleteConfirmed=true.'),
  lifetimeBudget: z
    .number()
    .optional()
    .describe('New lifetime budget in local currency minor units. Increase-guarded.'),
  spendCap: z
    .number()
    .optional()
    .describe('New total spend cap in local currency minor units. Increase-guarded.'),
  bidStrategy: z.string().optional().describe('New bid strategy.'),
  specialAdCategories: z
    .array(z.string())
    .optional()
    .describe('Special ad categories (e.g. NONE, HOUSING, EMPLOYMENT, CREDIT).'),
  startTime: z.string().optional().describe('Campaign start time (ISO 8601).'),
  stopTime: z.string().optional().describe('Campaign stop time (ISO 8601).'),
  deleteConfirmed: z
    .boolean()
    .optional()
    .describe('Required when status="DELETED" — deletion is irreversible via the API.'),
  adsetBudgets: z
    .array(
      z.object({
        adsetId: z.string(),
        dailyBudget: z.number().optional(),
        lifetimeBudget: z.number().optional(),
      })
    )
    .optional()
    .describe(
      "Toggles the campaign between Campaign Budget Optimization (CBO) and Ad Set Budget (ABO) using Meta's adset_budgets mechanism — converts an existing CBO campaign to ABO in place, no need to recreate the campaign. Must include every non-deleted, non-archived ad set under the campaign (Meta rejects the request otherwise). Each entry needs adsetId plus exactly one of dailyBudget or lifetimeBudget."
    ),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only after preview.'),
  confirmed: z.boolean().optional().describe('Must be true to execute after preview.'),
};

const getTargetingOptionsInputSchema = {
  ...adsBaseInputSchema,
  type: z
    .enum(['interests', 'behaviors', 'demographics', 'industries', 'life_events'])
    .describe('Targeting option type to search.'),
  query: z.string().optional().describe('Search keyword to filter targeting options.'),
  limit: z.number().optional().describe('Maximum results to return (default: 25).'),
};

const legacyAdAccountId = z.string().describe('Ad account ID (e.g., act_123456789)');

const legacyDateRangeInputSchema = {
  adAccountId: legacyAdAccountId,
  since: z.string().describe('Start date in YYYY-MM-DD format'),
  until: z.string().describe('End date in YYYY-MM-DD format'),
  breakdowns: z
    .array(z.enum(['country', 'region']))
    .optional()
    .describe('Optional location breakdowns. Supported: country, region.'),
};

const locationBreakdownSchema = z
  .array(z.enum(['country', 'region']))
  .min(1)
  .describe('Location breakdowns to apply. Supported: country, region.');

const legacyLocationBreakdownInputSchema = {
  ...legacyDateRangeInputSchema,
  adAccountId: z
    .string()
    .optional()
    .describe('Ad account ID (optional, uses env META_AD_ACCOUNT_ID if omitted)'),
  level: z.enum(['campaign', 'adset', 'ad']).describe('Insight level to fetch.'),
  breakdowns: locationBreakdownSchema,
  limit: z.number().optional().describe('Maximum number of insight rows to fetch (default: 100)'),
};

const legacyLocationInsightsInputSchema = {
  ...legacyLocationBreakdownInputSchema,
  adAccountId: z
    .string()
    .optional()
    .describe('Ad account ID (optional, uses env META_AD_ACCOUNT_ID if omitted)'),
  sortBy: z
    .enum(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'])
    .optional()
    .describe('Sort top locations by metric (default: spend)'),
  sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: desc)'),
  minSpend: z.number().optional().describe('Minimum location spend filter'),
  minClicks: z.number().optional().describe('Minimum location clicks filter'),
};

export function createMetaAdsMcpServer(options: CreateMetaAdsMcpServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: 'adstream-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const brokerConfig = parseBrokerConfigFromEnv();
  const isRemoteBrokerMode = brokerConfig.mode === 'remote';
  const config = isRemoteBrokerMode ? options.config : (options.config ?? loadConfig());
  let client = options.client;

  if (!isRemoteBrokerMode && !client) {
    client = new MetaClient(options.config ?? loadConfig());
  }

  // TikTok client — from env if not provided explicitly
  let tiktokClient = options.tiktokClient;
  if (!tiktokClient && process.env.TIKTOK_ACCESS_TOKEN) {
    tiktokClient = new TikTokApiClient({
      accessToken: process.env.TIKTOK_ACCESS_TOKEN,
      apiVersion: process.env.TIKTOK_API_VERSION,
    });
  }

  const adsBroker = options.adsBroker ?? createAdsBrokerFromConfig(brokerConfig);

  const adsToolDefinitions = getAdsMcpToolDefinitions({
    includeWrites: areAdsWriteToolsEnabled(),
  });

  for (const toolDefinition of adsToolDefinitions) {
    const hasSince = toolDefinition.inputSchema.required.includes('since');
    const hasCampaignId = toolDefinition.inputSchema.required.includes('campaignId');
    const hasCampaignName = toolDefinition.inputSchema.required.includes('campaignName');
    const hasFilePath = toolDefinition.inputSchema.required.includes('filePath');
    const hasCreativeId = toolDefinition.inputSchema.required.includes('creativeId');

    let inputSchema: Record<string, z.ZodType<unknown>>;
    if (toolDefinition.name === 'ads_get_performance') {
      inputSchema = adsPerformanceInputSchema;
    } else if (toolDefinition.name === 'ads_get_creatives') {
      inputSchema = adsCreativeInputSchema;
    } else if (toolDefinition.name === 'ads_check_launch_readiness') {
      inputSchema = launchReadinessInputSchema;
    } else if (toolDefinition.name === 'ads_list_lead_forms') {
      inputSchema = leadFormsInputSchema;
    } else if (toolDefinition.name === 'ads_list_catalogs') {
      inputSchema = businessIdInputSchema;
    } else if (toolDefinition.name === 'ads_list_product_sets') {
      inputSchema = catalogIdInputSchema;
    } else if (toolDefinition.name === 'ads_list_instagram_media') {
      inputSchema = instagramMediaInputSchema;
    } else if (toolDefinition.name === 'ads_create_campaign') {
      inputSchema = createCampaignInputSchema;
    } else if (toolDefinition.name === 'ads_create_adset') {
      inputSchema = createAdSetInputSchema;
    } else if (toolDefinition.name === 'ads_create_adcreative') {
      inputSchema = createAdCreativeInputSchema;
    } else if (toolDefinition.name === 'ads_create_ad') {
      inputSchema = createAdInputSchema;
    } else if (toolDefinition.name === 'ads_clone_ui_ad') {
      inputSchema = cloneUiAdInputSchema;
    } else if (toolDefinition.name === 'ads_archive_ad') {
      inputSchema = archiveAdInputSchema;
    } else if (toolDefinition.name === 'ads_pause_ad' || toolDefinition.name === 'ads_resume_ad') {
      inputSchema = adIdInputSchema;
    } else if (
      toolDefinition.name === 'ads_pause_adset' ||
      toolDefinition.name === 'ads_resume_adset'
    ) {
      inputSchema = adSetIdInputSchema;
    } else if (toolDefinition.name === 'ads_clone_adset') {
      inputSchema = cloneAdSetInputSchema;
    } else if (toolDefinition.name === 'ads_update_adset') {
      inputSchema = updateAdSetInputSchema;
    } else if (toolDefinition.name === 'ads_update_ad') {
      inputSchema = updateAdInputSchema;
    } else if (toolDefinition.name === 'ads_update_campaign') {
      inputSchema = updateCampaignInputSchema;
    } else if (toolDefinition.name === 'ads_get_targeting_options') {
      inputSchema = getTargetingOptionsInputSchema;
    } else if (hasCampaignName) {
      inputSchema = ecommerceLaunchInputSchema;
    } else if (hasCampaignId) {
      const base = hasSince ? sinceUntilInputSchema : adsBaseInputSchema;
      const requiresBudget = toolDefinition.inputSchema.required.includes('dailyBudget');
      const requiresNewName = toolDefinition.inputSchema.required.includes('newName');

      inputSchema = {
        ...base,
        campaignId: z.string().describe('The campaign ID to mutate (e.g. 120248446250030168)'),
        dailyBudget: requiresBudget
          ? z.number().describe('New daily budget (e.g. 50000 for Rp50,000)')
          : z.number().optional().describe('New daily budget (e.g. 50000 for Rp50,000)'),
        newName: requiresNewName
          ? z.string().describe('New campaign name')
          : z.string().optional().describe('New campaign name'),
      };
    } else if (hasFilePath) {
      inputSchema = {
        ...adsBaseInputSchema,
        filePath: z
          .string()
          .describe(
            'Absolute path to the local file to upload. Example: /Users/name/Downloads/ad-image.jpg'
          ),
        title: z.string().optional().describe('Optional title for video uploads.'),
        description: z.string().optional().describe('Optional description for video uploads.'),
      };
    } else if (toolDefinition.name === 'ads_read_adset_full') {
      inputSchema = {
        ...adsBaseInputSchema,
        adsetId: z.string().optional().describe('Meta Ad Set ID to read in full (single mode).'),
        campaignId: z
          .string()
          .optional()
          .describe('Campaign ID to list all ad sets under (list mode).'),
        limit: z.number().optional().describe('Page size for list mode (default 25).'),
        cursor: z.string().optional().describe('Pagination cursor for list mode.'),
      };
    } else if (toolDefinition.name === 'ads_read_creative_full') {
      inputSchema = {
        ...adsBaseInputSchema,
        creativeId: z.string().describe('Meta Ad Creative ID to read (e.g. 120330899389530268).'),
      };
    } else if (hasCreativeId) {
      inputSchema = {
        ...adsBaseInputSchema,
        creativeId: z.string().describe('The creative ID to generate a preview for.'),
        adFormat: z
          .enum([
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
          ])
          .describe('The ad format/platform to preview on.'),
      };
    } else if (hasSince) {
      inputSchema = sinceUntilInputSchema;
    } else {
      inputSchema = adsBaseInputSchema;
    }

    server.registerTool(
      toolDefinition.name,
      {
        description: toolDefinition.description,
        inputSchema,
        annotations: getAdsMcpToolAnnotations(toolDefinition.name),
      },
      async (
        args: Record<string, unknown>,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => {
        const connectionKey = extra.authInfo?.extra?.connectionKey as string | undefined;
        const oauthAuthContext = extra.authInfo?.extra?.oauthAuthContext;
        // Pass oauth context through params for oauth_token mode
        const toolArgs = args ?? {};
        if (oauthAuthContext && !connectionKey) {
          (toolArgs as Record<string, unknown>)._oauthAuthContext = oauthAuthContext;
        }
        return handleAdsMcpToolCall(adsBroker, toolDefinition.name, toolArgs, connectionKey);
      }
    );
  }

  for (const toolDefinition of COMMERCE_MCP_TOOL_DEFINITIONS) {
    server.registerTool(
      toolDefinition.name,
      {
        description: toolDefinition.description,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
        inputSchema: {
          provider: z
            .enum(['tiktok_gmv'])
            .describe('Commerce provider. Only tiktok_gmv is supported today.'),
          accountId: z.string().describe('Provider account or advertiser id.'),
          storeIds: z.array(z.string()).describe('Commerce store ids to query.'),
          since: z.string().describe('Start date in YYYY-MM-DD format.'),
          until: z.string().describe('End date in YYYY-MM-DD format.'),
          dimensions: z.array(z.string()).optional().describe('Provider dimensions to request.'),
          metrics: z.array(z.string()).optional().describe('Provider metrics to request.'),
          params: z.record(z.unknown()).optional().describe('Optional provider-safe parameters.'),
        },
      },
      async (args: Record<string, unknown>) =>
        handleCommerceMcpToolCall(toolDefinition.name, args ?? {}, {
          fetchGmvMaxReport: tiktokClient
            ? (options) => getGmvMaxReport(tiktokClient, options)
            : undefined,
        })
    );
  }

  server.registerTool(
    'meta_get_ad_accounts',
    {
      description: 'Fetch all Meta ad accounts accessible by the access token',
      inputSchema: {},
    },
    async (args: ToolArguments, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) =>
      handleLegacyMetaToolCall('meta_get_ad_accounts', args ?? {}, {
        isRemoteBrokerMode,
        client,
        config,
        adsBroker,
        extra,
      })
  );

  server.registerTool(
    'meta_get_campaigns',
    {
      description: 'Fetch campaigns from a Meta ad account with optional filters',
      inputSchema: {
        adAccountId: legacyAdAccountId,
        limit: z.number().optional().describe('Maximum number of campaigns to fetch (default: 50)'),
        status: z
          .array(z.string())
          .optional()
          .describe('Filter by campaign status (e.g., ["ACTIVE", "PAUSED"])'),
      },
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_get_campaigns', args, { isRemoteBrokerMode, client, config })
  );

  server.registerTool(
    'meta_get_campaign_insights',
    {
      description: 'Fetch campaign-level performance insights for a date range',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_get_campaign_insights', args, {
        isRemoteBrokerMode,
        client,
        config,
      })
  );

  server.registerTool(
    'meta_get_adset_insights',
    {
      description: 'Fetch adset-level performance insights for a date range',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_get_adset_insights', args, {
        isRemoteBrokerMode,
        client,
        config,
      })
  );

  server.registerTool(
    'meta_get_ads_insights',
    {
      description: 'Fetch ad-level performance insights for a date range',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_get_ads_insights', args, {
        isRemoteBrokerMode,
        client,
        config,
      })
  );

  server.registerTool(
    'meta_get_insights_by_breakdown',
    {
      description: 'Fetch Meta Ads insights by supported location breakdowns (country, region)',
      inputSchema: legacyLocationBreakdownInputSchema,
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_get_insights_by_breakdown', args, {
        isRemoteBrokerMode,
        client,
        config,
      })
  );

  server.registerTool(
    'meta_get_location_insights',
    {
      description:
        'Fetch Meta Ads insights grouped and ranked by location (country, region) with totals',
      inputSchema: legacyLocationInsightsInputSchema,
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_get_location_insights', args, {
        isRemoteBrokerMode,
        client,
        config,
      })
  );

  server.registerTool(
    'meta_generate_daily_report',
    {
      description: 'Generate comprehensive daily performance report with analysis',
      inputSchema: legacyDateRangeInputSchema,
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_generate_daily_report', args, {
        isRemoteBrokerMode,
        client,
        config,
      })
  );

  server.registerTool(
    'meta_analyze_with_rules',
    {
      description: 'Analyze campaign insights using 26 pre-built rule templates',
      inputSchema: {
        ...legacyDateRangeInputSchema,
        category: z
          .enum(['ecommerce', 'leadgen', 'brand', 'general', 'all'])
          .optional()
          .describe('Rule category to apply (default: all)'),
      },
    },
    async (args: ToolArguments) =>
      handleLegacyMetaToolCall('meta_analyze_with_rules', args, {
        isRemoteBrokerMode,
        client,
        config,
      })
  );

  // ── TikTok Ads tools ──

  server.registerTool(
    'tiktok_list_advertisers',
    {
      description: 'List TikTok advertiser accounts accessible by the access token',
      inputSchema: {},
    },
    async () => handleTikTokToolCall('tiktok_list_advertisers', {}, tiktokClient)
  );

  server.registerTool(
    'tiktok_get_report',
    {
      description: 'Fetch a synchronous TikTok Ads report (campaign, adgroup, or ad level)',
      inputSchema: {
        advertiserId: z.string().describe('TikTok advertiser ID'),
        reportType: z.string().optional().default('BASIC').describe('Report type (default: BASIC)'),
        dimensions: z.array(z.string()).describe('Dimension fields (e.g., ["campaign_id"])'),
        metrics: z.array(z.string()).describe('Metric fields (e.g., ["spend", "impressions"])'),
        dataLevel: z
          .enum(['AUCTION_CAMPAIGN', 'AUCTION_ADGROUP', 'AUCTION_AD'])
          .describe('Data aggregation level'),
        startDate: z.string().optional().describe('Start date YYYY-MM-DD'),
        endDate: z.string().optional().describe('End date YYYY-MM-DD'),
        page: z.number().optional().describe('Page number (default: 1)'),
        pageSize: z.number().optional().describe('Page size (default: 100)'),
      },
    },
    async (args: Record<string, unknown>) =>
      handleTikTokToolCall('tiktok_get_report', args, tiktokClient)
  );

  server.registerTool(
    'tiktok_get_gmv_max_report',
    {
      description: 'Fetch a GMV Max report from TikTok Shop Ads',
      inputSchema: {
        advertiserId: z.string().describe('TikTok advertiser ID'),
        storeIds: z.array(z.string()).describe('Store IDs (1-3 stores)'),
        dimensions: z.array(z.string()).describe('Dimension fields'),
        metrics: z.array(z.string()).describe('Metric fields'),
        startDate: z.string().describe('Start date YYYY-MM-DD'),
        endDate: z.string().describe('End date YYYY-MM-DD'),
        page: z.number().optional().describe('Page number (default: 1)'),
        pageSize: z.number().optional().describe('Page size (default: 100)'),
      },
    },
    async (args: Record<string, unknown>) =>
      handleTikTokToolCall('tiktok_get_gmv_max_report', args, tiktokClient)
  );

  server.registerTool(
    'tiktok_get_location_insights',
    {
      description:
        'Fetch TikTok Ads insights grouped by location (country, province, city) with totals and ranking',
      inputSchema: {
        advertiserId: z.string().describe('TikTok advertiser ID'),
        breakdowns: z
          .array(z.enum(['country', 'province', 'city']))
          .describe('Location breakdown dimensions (e.g., ["country"])'),
        dataLevel: z
          .enum(['AUCTION_CAMPAIGN', 'AUCTION_ADGROUP', 'AUCTION_AD'])
          .optional()
          .describe('Data level (default: AUCTION_CAMPAIGN)'),
        startDate: z.string().optional().describe('Start date YYYY-MM-DD'),
        endDate: z.string().optional().describe('End date YYYY-MM-DD'),
        sortBy: z
          .enum(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'])
          .optional()
          .describe('Sort metric (default: spend)'),
        sortDirection: z
          .enum(['asc', 'desc'])
          .optional()
          .describe('Sort direction (default: desc)'),
        limit: z.number().optional().describe('Max locations (default: 50)'),
      },
    },
    async (args: Record<string, unknown>) =>
      handleTikTokToolCall('tiktok_get_location_insights', args, tiktokClient)
  );

  return server;
}

async function handleLegacyMetaToolCall(
  name: string,
  args: ToolArguments,
  context: {
    isRemoteBrokerMode: boolean;
    client?: MetaClient;
    config?: MetaConfig;
    adsBroker?: ReturnType<typeof createDefaultAdsBroker>;
    extra?: RequestHandlerExtra<ServerRequest, ServerNotification>;
  }
) {
  try {
    if (isAdsMcpToolName(name)) {
      throw new Error(`Unexpected ads tool in legacy handler: ${name}`);
    }

    if (context.isRemoteBrokerMode && name === 'meta_get_ad_accounts' && context.adsBroker) {
      const toolArgs: Record<string, unknown> = {
        provider: 'meta',
        params: typeof args.limit === 'number' ? { limit: args.limit } : {},
      };
      const connectionKey = context.extra?.authInfo?.extra?.connectionKey as string | undefined;
      const oauthAuthContext = context.extra?.authInfo?.extra?.oauthAuthContext;
      if (oauthAuthContext && !connectionKey) {
        toolArgs._oauthAuthContext = oauthAuthContext;
      }
      return handleAdsMcpToolCall(context.adsBroker, 'ads_list_accounts', toolArgs, connectionKey);
    }

    if (context.isRemoteBrokerMode) {
      return legacyMetaToolUnavailableInRemoteMode();
    }

    if (!context.client || !context.config) {
      throw new Error('Legacy meta_* tools require local META_* env');
    }

    switch (name) {
      case 'meta_get_ad_accounts': {
        const accounts = await getAdAccounts(context.client);
        return asTextContent(accounts);
      }

      case 'meta_get_campaigns': {
        const campaigns = await getCampaigns(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          limit: args.limit,
        });
        return asTextContent(campaigns);
      }

      case 'meta_get_campaign_insights': {
        const insights = await getCampaignInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        });
        return asTextContent(insights);
      }

      case 'meta_get_adset_insights': {
        const insights = await getAdsetInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        });
        return asTextContent(insights);
      }

      case 'meta_get_ads_insights': {
        const insights = await getAdsInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        });
        return asTextContent(insights);
      }

      case 'meta_get_insights_by_breakdown': {
        const options = {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          limit: args.limit,
          breakdowns: assertLocationBreakdowns(args.breakdowns),
        };

        if (args.level === 'campaign') {
          return asTextContent(await getCampaignInsights(context.client, options));
        }

        if (args.level === 'adset') {
          return asTextContent(await getAdsetInsights(context.client, options));
        }

        return asTextContent(await getAdsInsights(context.client, options));
      }

      case 'meta_get_location_insights': {
        const summary = await getLocationInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
          level: (args.level as 'campaign' | 'adset' | 'ad') ?? 'campaign',
          breakdowns: assertLocationBreakdowns(args.breakdowns) as LocationBreakdown[] | undefined,
          sortBy: args.sortBy as
            | 'spend'
            | 'impressions'
            | 'clicks'
            | 'ctr'
            | 'cpc'
            | 'cpm'
            | undefined,
          sortDirection: args.sortDirection as 'asc' | 'desc' | undefined,
          minSpend: typeof args.minSpend === 'number' ? args.minSpend : undefined,
          minClicks: typeof args.minClicks === 'number' ? args.minClicks : undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        });
        return asTextContent(summary);
      }

      case 'meta_generate_daily_report': {
        const report = await generateDailyReport(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
        });
        return asTextContent(report);
      }

      case 'meta_analyze_with_rules': {
        const insights = await getCampaignInsights(context.client, {
          adAccountId: (args.adAccountId || context.config.adAccountId) as string,
          since: args.since as string,
          until: args.until as string,
        });

        const engine = new RuleEngine();
        const results = engine.applyRulesToInsights(insights, allRuleTemplates);

        return asTextContent(results);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return safeAdsMcpError(error);
  }
}

function asTextContent(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function legacyMetaToolUnavailableInRemoteMode() {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            ok: false,
            error: {
              code: 'LEGACY_META_TOOLS_UNAVAILABLE_IN_REMOTE_MODE',
              message: 'Legacy meta_* tools require local META_* env',
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleTikTokToolCall(
  name: string,
  args: Record<string, unknown>,
  tiktokClient?: TikTokApiClient
) {
  try {
    if (!tiktokClient) {
      return asTextContent({
        ok: false,
        error: {
          code: 'TIKTOK_CLIENT_NOT_CONFIGURED',
          message: 'Set TIKTOK_ACCESS_TOKEN env to use TikTok tools',
        },
      });
    }

    switch (name) {
      case 'tiktok_list_advertisers': {
        const advertisers = await getTikTokAdvertisers(tiktokClient);
        return asTextContent(advertisers);
      }

      case 'tiktok_get_report': {
        const report = await getTikTokReport(tiktokClient, {
          advertiserId: args.advertiserId as string,
          reportType: (args.reportType as string) ?? 'BASIC',
          dimensions: args.dimensions as string[],
          metrics: args.metrics as string[],
          dataLevel: args.dataLevel as 'AUCTION_CAMPAIGN' | 'AUCTION_ADGROUP' | 'AUCTION_AD',
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          page: typeof args.page === 'number' ? args.page : undefined,
          pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
        });
        return asTextContent(report);
      }

      case 'tiktok_get_gmv_max_report': {
        const report = await getGmvMaxReport(tiktokClient, {
          advertiserId: args.advertiserId as string,
          storeIds: args.storeIds as string[],
          dimensions: args.dimensions as string[],
          metrics: args.metrics as string[],
          startDate: args.startDate as string,
          endDate: args.endDate as string,
          page: typeof args.page === 'number' ? args.page : undefined,
          pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
        });
        return asTextContent(report);
      }

      case 'tiktok_get_location_insights': {
        const summary = await getTikTokLocationInsights(tiktokClient, {
          advertiserId: args.advertiserId as string,
          breakdowns: (args.breakdowns as ('country' | 'province' | 'city')[]) ?? ['country'],
          dataLevel: args.dataLevel as
            | 'AUCTION_CAMPAIGN'
            | 'AUCTION_ADGROUP'
            | 'AUCTION_AD'
            | undefined,
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          sortBy: args.sortBy as
            | 'spend'
            | 'impressions'
            | 'clicks'
            | 'ctr'
            | 'cpc'
            | 'cpm'
            | undefined,
          sortDirection: args.sortDirection as 'asc' | 'desc' | undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        });
        return asTextContent(summary);
      }

      default:
        throw new Error(`Unknown TikTok tool: ${name}`);
    }
  } catch (error) {
    return safeAdsMcpError(error);
  }
}
