export const ADS_PROVIDER_IDS = ['meta', 'tiktok', 'google'] as const;
export type AdsProviderId = (typeof ADS_PROVIDER_IDS)[number];

export const ADS_ENTITY_LEVELS = ['account', 'campaign', 'adset', 'adgroup', 'ad', 'creative'] as const;
export type AdsEntityLevel = (typeof ADS_ENTITY_LEVELS)[number];

export const ADS_OPERATION_KINDS = ['read', 'write'] as const;
export type AdsOperationKind = (typeof ADS_OPERATION_KINDS)[number];

export const ADS_TOOL_CATEGORIES = [
  'accounts',
  'campaigns',
  'ad_groups',
  'ads',
  'creatives',
  'insights',
  'reports',
  'diagnostics',
] as const;
export type AdsToolCategory = (typeof ADS_TOOL_CATEGORIES)[number];

export interface AdsIdentity {
  account_id: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_or_adgroup_id?: string;
  adset_or_adgroup_name?: string;
  ad_id?: string;
  ad_name?: string;
  creative_id?: string;
  creative_name?: string;
}

export interface AdsSetup {
  objective?: string;
  optimization_goal?: string;
  billing_event?: string;
  status?: string;
  effective_status?: string;
  currency?: string;
  buying_type?: string;
}

export interface AdsTimeRange {
  date_start: string;
  date_stop: string;
  timezone?: string;
  attribution_window?: string;
}

export interface AdsDeliveryMetrics {
  spend: number;
  budget?: number;
  daily_budget?: number;
  lifetime_budget?: number;
  impressions: number;
  reach?: number;
  frequency?: number;
  cpm?: number;
}

export interface AdsClickMetrics {
  clicks: number;
  inline_link_clicks?: number;
  outbound_clicks?: number;
  landing_page_views?: number;
  ctr?: number;
  link_ctr?: number;
  outbound_ctr?: number;
  cpc?: number;
  cost_per_landing_page_view?: number;
}

export interface AdsConversionMetrics {
  results?: number;
  result_type?: string;
  cost_per_result?: number;
  conversions?: number;
  cost_per_conversion?: number;
  conversion_value?: number;
  roas?: number;
}

export interface AdsCommerceMetrics {
  purchases?: number;
  purchase_value?: number;
  cost_per_purchase?: number;
  purchase_roas?: number;
  adds_to_cart?: number;
  cost_per_add_to_cart?: number;
  initiate_checkouts?: number;
  cost_per_initiate_checkout?: number;
}

export interface AdsLeadMetrics {
  leads?: number;
  cost_per_lead?: number;
  registrations?: number;
  cost_per_registration?: number;
}

export interface AdsVideoMetrics {
  video_views?: number;
  video_view_rate?: number;
  average_watch_time?: number;
  watched_25_percent?: number;
  watched_50_percent?: number;
  watched_75_percent?: number;
  watched_100_percent?: number;
  thumbstop_rate?: number;
  hook_rate?: number;
  hold_rate?: number;
}

export interface AdsEngagementMetrics {
  engagements?: number;
  post_reactions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profile_visits?: number;
  follows?: number;
}

export interface AdsCreativeMetadata {
  creative_type?: string;
  creative_url?: string;
  thumbnail_url?: string;
  video_id?: string;
  video_source_url?: string;
  image_hash?: string;
  headline?: string;
  primary_text?: string;
  description?: string;
  call_to_action?: string;
  destination_url?: string;
}

export interface AdsDiagnostics {
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  learning_phase?: string;
  delivery_status?: string;
  diagnostics?: string[];
}

export interface AdsMetricDimensions {
  country?: string;
  region?: string;
  dma?: string;
  platform?: string;
  placement?: string;
  product_id?: string;
  product_name?: string;
  product_set_id?: string;
  catalog_segment_id?: string;
}

export interface AdsActionMetric {
  action_type: string;
  value: number;
  cost_per_action?: number;
}

export interface AdsCalculatedMetrics {
  profit?: number;
  margin?: number;
  break_even_roas?: number;
  roas_headroom?: number;
  spend_share?: number;
  impression_share?: number;
  conversion_rate?: number;
}

export interface AdsMetricRecord {
  provider: AdsProviderId;
  level: AdsEntityLevel;
  identity: AdsIdentity;
  setup?: AdsSetup;
  time: AdsTimeRange;
  delivery: AdsDeliveryMetrics;
  clicks?: AdsClickMetrics;
  conversions?: AdsConversionMetrics;
  commerce?: AdsCommerceMetrics;
  leads?: AdsLeadMetrics;
  video?: AdsVideoMetrics;
  engagement?: AdsEngagementMetrics;
  creative?: AdsCreativeMetadata;
  diagnostics?: AdsDiagnostics;
  dimensions?: AdsMetricDimensions;
  actions?: AdsActionMetric[];
  calculated?: AdsCalculatedMetrics;
  raw?: unknown;
}

export type AdsReportFormat = 'summary' | 'daily' | 'audit' | 'executive';
export type AdsReportKind = 'ads';

export interface AdsReportTotals {
  spend: number;
  impressions: number;
  clicks: number;
  reach?: number;
  purchases?: number;
  purchase_value?: number;
  leads?: number;
  roas?: number;
  cpc?: number;
  ctr?: number;
  cpm?: number;
  currency?: string;
}

export type AdsReportLevel = Extract<AdsEntityLevel, 'account' | 'campaign'>;
export type AdsReportRating = 'excellent' | 'good' | 'needs_attention' | 'critical';

export interface AdsReportScorecard {
  score: number;
  rating: AdsReportRating;
  reasons: string[];
}

export interface AdsReport {
  provider: AdsProviderId;
  report_kind: AdsReportKind;
  format: AdsReportFormat;
  level: AdsReportLevel;
  date_range: {
    since: string;
    until: string;
  };
  totals: AdsReportTotals;
  findings: string[];
  recommendations: string[];
  scorecard?: AdsReportScorecard;
  efficiency_findings?: string[];
  risk_findings?: string[];
  opportunity_findings?: string[];
  next_actions?: string[];
  disclaimer: string;
}

export interface AdsProviderReportError {
  provider?: AdsProviderId;
  code: string;
  message: string;
}

export interface AdsMultiProviderReport {
  report_kind: AdsReportKind;
  format: AdsReportFormat;
  level: AdsReportLevel;
  providers: AdsProviderId[];
  date_range: {
    since: string;
    until: string;
  };
  totals: AdsReportTotals;
  per_provider: AdsReport[];
  currencies: string[];
  mixed_currency: boolean;
  findings: string[];
  recommendations: string[];
  disclaimer: string;
  warnings?: string[];
  errors?: AdsProviderReportError[];
}

export type AdsContentMatrixGroupBy = 'campaign' | 'adset';
export type AdsContentMatrixSortDirection = 'asc' | 'desc';
export type AdsContentMatrixComparisonMode = 'previous_period' | 'none';

export interface AdsContentMatrixMetric {
  key: string;
  value: number | null;
  unit: 'currency' | 'count' | 'percentage' | 'ratio' | 'seconds';
  source: 'observed' | 'calculated';
  numerator?: number | null;
  denominator?: number | null;
  formula?: string;
  available: boolean;
}

export interface AdsContentMatrixComparison {
  key: string;
  current: number | null;
  previous: number | null;
  absolute_change: number | null;
  percentage_change: number | null;
}

export interface AdsContentMatrixDataQuality {
  has_spend: boolean;
  has_impressions: boolean;
  has_clicks: boolean;
  has_conversion: boolean;
  has_creative_asset: boolean;
  notes: string[];
}

export interface AdsContentMatrixRow {
  provider: AdsProviderId;
  account_id: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_or_adgroup_id?: string;
  adset_or_adgroup_name?: string;
  ad_id?: string;
  ad_name?: string;
  creative_id?: string;
  creative_name?: string;
  content: AdsCreativeMetadata;
  metrics: AdsContentMatrixMetric[];
  comparison?: AdsContentMatrixComparison[];
  data_quality: AdsContentMatrixDataQuality;
}

export interface AdsContentMatrixGroup {
  group_by: AdsContentMatrixGroupBy;
  group_id: string;
  group_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_or_adgroup_id?: string;
  adset_or_adgroup_name?: string;
  summary_metrics: AdsContentMatrixMetric[];
  top_rows: AdsContentMatrixRow[];
  bottom_rows: AdsContentMatrixRow[];
  rows?: AdsContentMatrixRow[];
}

export interface AdsContentMatrix {
  provider: AdsProviderId;
  report_kind: 'content_matrix';
  date_range: {
    since: string;
    until: string;
  };
  comparison?: {
    mode: AdsContentMatrixComparisonMode;
    date_range?: {
      since: string;
      until: string;
    };
  };
  group_by: AdsContentMatrixGroupBy;
  sort: {
    metric: string;
    direction: AdsContentMatrixSortDirection;
  };
  groups: AdsContentMatrixGroup[];
  coverage: {
    rows: number;
    groups: number;
    has_creative_assets: boolean;
    notes: string[];
  };
}

export type CommerceProviderId = 'tiktok_gmv' | 'shopee' | 'tokopedia' | 'lazada' | 'blibli';
export type CommerceReportFormat = 'summary' | 'audit' | 'executive';

export interface CommerceStoreIdentity {
  id: string;
  name?: string;
  region?: string;
}

export interface CommerceProductIdentity {
  id?: string;
  name?: string;
}

export interface CommerceMetrics {
  gmv: number;
  orders: number;
  units_sold?: number;
  ad_spend?: number;
  roas_commerce?: number;
  aov?: number;
}

export interface CommerceRecord {
  provider: CommerceProviderId;
  account_id: string;
  store: CommerceStoreIdentity;
  product?: CommerceProductIdentity;
  time: AdsTimeRange;
  metrics: CommerceMetrics;
  raw?: unknown;
}

export type CommerceReportTotals = CommerceMetrics;

export interface CommerceReport {
  provider: CommerceProviderId;
  report_kind: 'commerce';
  format: CommerceReportFormat;
  date_range: {
    since: string;
    until: string;
  };
  totals: CommerceReportTotals;
  findings: string[];
  recommendations: string[];
  disclaimer: string;
}

export interface CredentialContext {
  provider: AdsProviderId;
  accessToken?: string;
  accountId?: string;
  apiVersion?: string;
  /** Optional OAuth/API scopes returned by the credential control plane. */
  scopes?: string[];
  /** Optional account allow-list for organization/workspace-scoped connection keys. */
  allowedAccountIds?: string[];
  source: 'env' | 'cuan_insight' | 'request' | 'test';
}

export interface AdsBrokerRequest {
  provider?: AdsProviderId;
  providers?: AdsProviderId[];
  accountId?: string;
  since?: string;
  until?: string;
  params: Record<string, unknown>;
  credentials?: CredentialContext;
  /** Per-request connection key (hosted multi-user). Sent as x-cuan-mcp-connection-key header. */
  connectionKey?: string;
  /** OAuth token auth context (for oauth_token auth mode). When present, broker resolves via token hash. */
  oauthAuthContext?: {
    authType: 'oauth_token';
    accessTokenHash: string;
    clientId: string;
    scope: string;
    resource?: string;
    connectionKeyId?: string;
  };
}

export interface AdsBrokerResponse<TData = AdsMetricRecord[] | unknown> {
  ok: boolean;
  provider?: AdsProviderId;
  data?: TData;
  accounts?: unknown[];
  errors?: Array<{
    provider?: AdsProviderId;
    code?: string;
    message: string;
  }>;
  meta?: Record<string, unknown>;
}

export interface AdsCanonicalWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'info' | 'warning';
}

export interface AdsPerformanceEnvelope {
  provider: AdsProviderId;
  account: {
    id?: string;
    name?: string;
  };
  dateRange: {
    since?: string;
    until?: string;
    timezone?: string;
  };
  currency?: string;
  level: AdsEntityLevel;
  dimensions: string[];
  metrics: string[];
  rows: AdsMetricRecord[];
  paging: {
    nextCursor: string | null;
  };
  warnings: AdsCanonicalWarning[];
  dataFreshness: {
    retrievedAt: string;
  };
  capabilities: Record<string, unknown>;
  unsupportedMetrics: string[];
}

export interface AdsChangeHistoryRecord {
  provider: AdsProviderId;
  account_id?: string;
  event_time?: string;
  event_type?: string;
  translated_event_type?: string;
  object_id?: string;
  object_name?: string;
  object_type?: string;
  actor_id?: string;
  actor_name?: string;
  raw?: unknown;
}

export interface AdsChangeHistoryEnvelope {
  provider: AdsProviderId;
  account: {
    id?: string;
  };
  dateRange: {
    since?: string;
    until?: string;
  };
  rows: AdsChangeHistoryRecord[];
  paging: {
    nextCursor: string | null;
  };
  warnings: AdsCanonicalWarning[];
  dataFreshness: {
    retrievedAt: string;
  };
  capabilities: Record<string, unknown>;
}

export interface AdsMutationResult {
  success: boolean;
  id: string;
  operation: string;
  response?: Record<string, unknown>;
  error?: string;
}

export interface EcommerceCampaignBundlePayload {
  campaignName: string;
  adSetName: string;
  adName: string;
  pageId: string;
  pixelId: string;
  destinationUrl: string;
  dailyBudget: number;
  currency?: string;
  countries: string[];
  primaryText: string;
  headline: string;
  description?: string;
  imageHash?: string;
  videoId?: string;
  callToActionType?: 'SHOP_NOW' | 'LEARN_MORE' | 'SIGN_UP' | 'GET_OFFER';
  specialAdCategories?: string[];
  ageMin?: number;
  ageMax?: number;
  publisherPlatforms?: string[];
  instagramUserId?: string;
  dryRun?: boolean;
  confirmed?: boolean;
}

export interface EcommerceCampaignBundleResult {
  operation: 'create_ecommerce_campaign_bundle';
  status: 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
  executed: boolean;
  preview: {
    campaign: Record<string, unknown>;
    adSet: Record<string, unknown>;
    creative: Record<string, unknown>;
    ad: Record<string, unknown>;
  };
  ids?: {
    campaignId?: string;
    adSetId?: string;
    creativeId?: string;
    adId?: string;
  };
  responses?: Record<string, Record<string, unknown> | undefined>;
  error?: string;
  warnings: string[];
}

export interface AdsProviderCapabilities {
  providers: AdsProviderId[];
  categories: AdsToolCategory[];
  operations: AdsOperationKind[];
  supportsRaw?: boolean;
}

export const ADS_PROVIDER_CAPABILITY_MATRIX = {
  meta: {
    providers: ['meta'],
    categories: ['accounts', 'campaigns', 'ad_groups', 'ads', 'creatives', 'insights', 'reports', 'diagnostics'],
    operations: ['read', 'write'],
    supportsRaw: false,
  },
  tiktok: {
    providers: ['tiktok'],
    categories: ['accounts', 'campaigns', 'ad_groups', 'ads', 'creatives', 'insights', 'reports', 'diagnostics'],
    operations: ['read'],
    supportsRaw: false,
  },
  google: {
    providers: ['google'],
    categories: ['accounts', 'campaigns', 'ad_groups', 'ads', 'insights', 'reports', 'diagnostics'],
    operations: ['read'],
    supportsRaw: false,
  },
} as const satisfies Record<AdsProviderId, AdsProviderCapabilities>;

export interface AdCreativeMappingResult {
  ad_id: string;
  ad_name?: string;
  creative_id?: string;
}

export interface AdDestinationResult {
  ad_id: string;
  ad_name?: string;
  status?: string;
  effective_status?: string;
  creative_id?: string;
  creative_type?: string;
  destination_url: string | null;
  all_urls: string[];
  resolution_method: string | null;
  warning?: string;
}

export interface VideoSourceResult {
  provider: AdsProviderId;
  video_id: string;
  source_url?: string;
  embed_html?: string;
  thumbnail_url?: string;
}

export interface ImageUploadResult {
  operation: 'upload_image';
  status: 'executed' | 'failed';
  image_hash?: string;
  url?: string;
  filename?: string;
  error?: string;
}

export interface VideoUploadResult {
  operation: 'upload_video';
  status: 'uploading' | 'executed' | 'failed';
  video_id?: string;
  title?: string;
  error?: string;
  warnings?: string[];
}

export type CreateCampaignStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CreateCampaignResult {
  operation: 'create_campaign';
  status: CreateCampaignStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
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

export type CreateAdCreativeStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CreateAdCreativeResult {
  operation: 'create_adcreative';
  status: CreateAdCreativeStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}

export type CreateAdStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CreateAdResult {
  operation: 'create_ad';
  status: CreateAdStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}

export interface ArchiveAdResult {
  operation: 'archive_ad';
  status: 'executed' | 'failed';
  success: boolean;
  id?: string;
  error?: string;
}

export type UpdateAdSetStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface UpdateAdSetResult {
  operation: 'update_adset';
  status: UpdateAdSetStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  success: boolean;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}

export interface TargetingOption {
  id: string;
  name: string;
  type: string;
  path?: string[];
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  description?: string;
  topic?: string;
}

export interface GetTargetingOptionsResult {
  operation: 'get_targeting_options';
  data: TargetingOption[];
  paging: {
    nextCursor: string | null;
  };
}

export interface AccountInfoResult {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
  timezone_offset: number;
  account_status: number;
  account_status_label: string;
  balance: number;
  amount_spent: number;
  spending_limit: number | null;
  business_name?: string;
  business_city?: string;
  business_country?: string;
  min_daily_budget?: number;
  disable_reason?: number;
}

export interface AdImageResult {
  hash: string;
  url: string;
  width: number;
  height: number;
  name?: string;
  creatives_count?: number;
}

export interface AdVideoResult {
  id: string;
  title?: string;
  source?: string;
  status?: string;
  file_size?: number;
  created_time?: string;
  thumbnail?: string;
}

export interface AdPreviewResult {
  preview_url: string;
  platform: string;
  ad_format: string;
  body?: string;
}

export interface AdsProviderAdapter {
  id: AdsProviderId;
  displayName: string;
  capabilities: AdsProviderCapabilities;
  listAccounts(request: AdsBrokerRequest): Promise<AdsBrokerResponse>;
  listCampaigns(request: AdsBrokerRequest): Promise<AdsBrokerResponse>;
  getAccountPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>>;
  getCampaignPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>>;
  getAdsetOrAdgroupPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>>;
  getAdPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>>;
  getCreativePerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMetricRecord[]>>;
  getPlacementPerformance(request: AdsBrokerRequest): Promise<AdsBrokerResponse>;
  getChangeHistory(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsChangeHistoryEnvelope>>;
  getVideoSource(request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoSourceResult>>;
  getAdCreativeMapping(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdCreativeMappingResult[]>>;
  getAdDestinations(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdDestinationResult[]>>;
  // --- Write Operations ---
  pauseCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
  resumeCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
  updateCampaignBudget(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
  renameCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
  createCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateCampaignResult>>;
  createAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdSetResult>>;
  createAdCreative(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdCreativeResult>>;
  createAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<CreateAdResult>>;
  archiveAd(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ArchiveAdResult>>;
  updateAdSet(request: AdsBrokerRequest): Promise<AdsBrokerResponse<UpdateAdSetResult>>;
  getTargetingOptions(request: AdsBrokerRequest): Promise<AdsBrokerResponse<GetTargetingOptionsResult>>;
  createEcommerceCampaignBundle(request: AdsBrokerRequest): Promise<AdsBrokerResponse<EcommerceCampaignBundleResult>>;
  uploadImage(request: AdsBrokerRequest): Promise<AdsBrokerResponse<ImageUploadResult>>;
  uploadVideo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<VideoUploadResult>>;
  getAccountInfo(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AccountInfoResult>>;
  listAdImages(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdImageResult[]>>;
  listAdVideos(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdVideoResult[]>>;
  getAdPreview(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdPreviewResult[]>>;
}

export interface AdsToolDefinition {
  name: string;
  description: string;
  category: AdsToolCategory;
  operation: AdsOperationKind;
  providers: AdsProviderId[];
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export interface PermissionPolicy {
  canRead(context: CredentialContext, request?: AdsBrokerRequest): boolean;
  canWrite(context: CredentialContext, request?: AdsBrokerRequest): boolean;
  requireConfirmation(context: CredentialContext, request?: AdsBrokerRequest): boolean;
}

export function credentialAllowsRequestAccount(
  context: CredentialContext,
  request?: AdsBrokerRequest
): boolean {
  if (!request?.accountId) return true;

  const allowedAccountIds = context.allowedAccountIds ?? (context.accountId ? [context.accountId] : []);
  if (allowedAccountIds.length === 0) return true;

  return allowedAccountIds.includes(request.accountId);
}

export function credentialAllowsRequestProvider(
  context: CredentialContext,
  request?: AdsBrokerRequest
): boolean {
  if (!request?.provider) return true;
  return context.provider === request.provider;
}

export function credentialHasAnyScope(context: CredentialContext, scopes: string[]): boolean {
  if (!context.scopes || context.scopes.length === 0) return true;
  return scopes.some((scope) => context.scopes?.includes(scope));
}

export function isAdsProviderId(value: unknown): value is AdsProviderId {
  return typeof value === 'string' && ADS_PROVIDER_IDS.includes(value as AdsProviderId);
}

export function isReadOperation(value: unknown): value is 'read' {
  return value === 'read';
}

export const defaultDenyWritePermissionPolicy: PermissionPolicy = {
  canRead: (context, request) => (
    credentialAllowsRequestProvider(context, request)
    && credentialAllowsRequestAccount(context, request)
    && credentialHasAnyScope(context, ['ads.read', 'ads.write', 'ads.admin'])
  ),
  canWrite: () => false,
  requireConfirmation: () => true,
};
