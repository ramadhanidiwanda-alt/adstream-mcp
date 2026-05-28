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

export interface CampaignInsight {
  campaign_id: string;
  campaign_name: string;
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
