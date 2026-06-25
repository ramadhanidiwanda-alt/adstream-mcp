export interface MetaConfig {
  accessToken: string;
  adAccountId: string;
  apiVersion: string;
}

export interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  created_time: string;
  updated_time: string;
}

export interface Action {
  action_type: string;
  value: string;
}

export interface ActionValue {
  action_type: string;
  value: string;
}

export const LOCATION_BREAKDOWNS = ['country', 'region', 'dma'] as const;
export type LocationBreakdown = (typeof LOCATION_BREAKDOWNS)[number];

export interface InsightBreakdownOptions {
  breakdowns?: LocationBreakdown[];
}

// --- Pagination & Rate Limit Types ---

export interface MetaPaging {
  cursors: {
    before: string;
    after: string;
  };
  next?: string;
  previous?: string;
}

export interface MetaPaginatedResponse<T> {
  data: T[];
  paging?: MetaPaging;
}

export interface PaginationOptions {
  /** Whether to auto-paginate through all pages. Default: false */
  paginate?: boolean;
  /** Max pages to fetch. Default: 10 */
  maxPages?: number;
  /** Base delay (ms) between pages for rate limit safety. Default: 200 */
  pageDelay?: number;
}

export interface RateLimitInfo {
  /** Percentage of rate limit used (0-100) */
  usagePercent: number;
  remaining: number;
  resetAt: string | null;
}

// --- Mutation Types ---

export type MutationOperation = 'pause' | 'resume' | 'update_budget' | 'rename';
export type MutateEntityType = 'campaign' | 'adset' | 'ad';

export interface MutationRequest {
  operation: MutationOperation;
  entityType: MutateEntityType;
  entityId: string;
  payload: Record<string, unknown>;
}

export interface MutationResult {
  success: boolean;
  id: string;
  operation: MutationOperation;
  entityType: MutateEntityType;
  response?: Record<string, unknown>;
  error?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  operation: MutationOperation;
  entityType: MutateEntityType;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  fields: Record<string, { old: unknown; new: unknown }>;
  status: 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
  error?: string;
}

export interface CampaignMutationOptions {
  dryRun?: boolean;
  /** Max budget increase as fraction (0.2 = 20%). Default 2.0 (200%). */
  maxBudgetIncrease?: number;
}

// --- Location Types ---

export interface LocationMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  campaigns: number;
}

export interface NestedLocationNode {
  key: string;
  metrics: LocationMetrics;
  children?: NestedLocationNode[];
}

export interface AccountInsight {
  account_id?: string;
  account_name?: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  inline_link_clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: Action[];
  action_values?: ActionValue[];
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

export interface CampaignInsight {
  campaign_id: string;
  campaign_name: string;
  country?: string;
  region?: string;
  dma?: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  inline_link_clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: Action[];
  action_values?: ActionValue[];
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

export interface LocationInsightRow {
  campaign_id: string;
  campaign_name: string;
  country?: string;
  region?: string;
  dma?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  inline_link_clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface LocationInsightSummary {
  breakdown: string | string[];
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    campaigns: number;
  };
  top_locations: Array<{
    country?: string;
    region?: string;
    dma?: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    campaigns: number;
  }>;
  hierarchy?: NestedLocationNode[];
  warnings: string[];
}

export interface AdsetInsight extends CampaignInsight {
  adset_id: string;
  adset_name: string;
}

export interface AdInsight extends AdsetInsight {
  ad_id: string;
  ad_name: string;
}

export interface CampaignAnalysis {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  leads: number;
  status: 'good' | 'watch' | 'warning';
  recommendation: 'scale' | 'hold' | 'review' | 'fix_creative';
  reason: string;
}

export interface DailyReport {
  date_range: {
    since: string;
    until: string;
  };
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    average_ctr: number;
    average_cpc: number;
  };
  highlights: string[];
  campaign_analysis: CampaignAnalysis[];
  recommendations: string[];
}
