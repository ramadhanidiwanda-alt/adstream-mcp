export const ADS_PROVIDER_IDS = ['meta', 'tiktok'] as const;
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

export interface CredentialContext {
  provider: AdsProviderId;
  accessToken?: string;
  accountId?: string;
  apiVersion?: string;
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

export interface AdsMutationResult {
  success: boolean;
  id: string;
  operation: string;
  response?: Record<string, unknown>;
  error?: string;
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
} as const satisfies Record<AdsProviderId, AdsProviderCapabilities>;

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
  // --- Write Operations ---
  pauseCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
  resumeCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
  updateCampaignBudget(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
  renameCampaign(request: AdsBrokerRequest): Promise<AdsBrokerResponse<AdsMutationResult>>;
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
  canRead(context: CredentialContext): boolean;
  canWrite(context: CredentialContext): boolean;
  requireConfirmation(context: CredentialContext): boolean;
}

export function isAdsProviderId(value: unknown): value is AdsProviderId {
  return typeof value === 'string' && ADS_PROVIDER_IDS.includes(value as AdsProviderId);
}

export function isReadOperation(value: unknown): value is 'read' {
  return value === 'read';
}

export const defaultDenyWritePermissionPolicy: PermissionPolicy = {
  canRead: () => true,
  canWrite: () => false,
  requireConfirmation: () => true,
};
