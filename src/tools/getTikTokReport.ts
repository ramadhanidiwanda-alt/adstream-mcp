import type { TikTokApiClient } from '../tiktokClient.js';

export type TikTokDataLevel =
  | 'AUCTION_ADVERTISER'
  | 'AUCTION_CAMPAIGN'
  | 'AUCTION_ADGROUP'
  | 'AUCTION_AD';

export interface TikTokReportOptions {
  advertiserId: string;
  reportType: string;
  dimensions: string[];
  metrics: string[];
  dataLevel: TikTokDataLevel;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  filtering?: Record<string, unknown>;
  orderField?: string;
  orderType?: 'ASC' | 'DESC';
}

export interface TikTokReportRow {
  dimensions: Record<string, string>;
  metrics: Record<string, string>;
}

export interface TikTokReportResult {
  list: TikTokReportRow[];
  page_info: {
    page: number;
    page_size: number;
    total_number: number;
    total_page: number;
  };
}

/**
 * Fetch a synchronous TikTok Ads report using the integrated get endpoint.
 *
 * Endpoint: GET /report/integrated/get/
 * Docs: https://business-api.tiktok.com/portal/docs?id=1739593083610113
 */
export async function getTikTokReport(
  client: TikTokApiClient,
  options: TikTokReportOptions
): Promise<TikTokReportResult> {
  const {
    advertiserId,
    reportType,
    dimensions,
    metrics,
    dataLevel,
    startDate,
    endDate,
    page = 1,
    pageSize = 100,
    filtering,
    orderField,
    orderType,
  } = options;

  return client.get<TikTokReportResult>('/report/integrated/get/', {
    advertiser_id: advertiserId,
    report_type: reportType,
    dimensions,
    metrics,
    data_level: dataLevel,
    start_date: startDate,
    end_date: endDate,
    page,
    page_size: pageSize,
    filtering: filtering ? JSON.stringify(filtering) : undefined,
    order_field: orderField,
    order_type: orderType,
  });
}
