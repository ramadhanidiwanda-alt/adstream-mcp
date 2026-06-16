import type { TikTokApiClient } from '../tiktokClient.js';

export interface GmvMaxReportOptions {
  advertiserId: string;
  storeIds: string[];
  dimensions: string[];
  metrics: string[];
  startDate: string;
  endDate: string;
  enableTotalMetrics?: boolean;
  filtering?: Record<string, unknown>;
  sortField?: string;
  sortType?: 'ASC' | 'DESC';
  page?: number;
  pageSize?: number;
}

export interface GmvMaxReportRow {
  dimensions: Record<string, string>;
  metrics: Record<string, string>;
}

export interface GmvMaxReportResult {
  list: GmvMaxReportRow[];
  page_info: {
    page: number;
    page_size: number;
    total_number: number;
    total_page: number;
  };
}

/**
 * Fetch a GMV Max report from TikTok Shop Ads.
 *
 * Endpoint: GET /gmv_max/report/get/
 * Docs: TikTok Business API SDK — yml_files/gmv_max_report_get.yml
 *
 * GMV Max is TikTok's automated ad solution for Shop sellers.
 * Requires: advertiser_id, store_ids, dimensions, metrics, date range.
 */
export async function getGmvMaxReport(
  client: TikTokApiClient,
  options: GmvMaxReportOptions
): Promise<GmvMaxReportResult> {
  const {
    advertiserId,
    storeIds,
    dimensions,
    metrics,
    startDate,
    endDate,
    enableTotalMetrics,
    filtering,
    sortField,
    sortType,
    page = 1,
    pageSize = 100,
  } = options;

  return client.get<GmvMaxReportResult>('/gmv_max/report/get/', {
    advertiser_id: advertiserId,
    store_ids: storeIds,
    dimensions,
    metrics,
    start_date: startDate,
    end_date: endDate,
    enable_total_metrics: enableTotalMetrics ?? false,
    filtering: filtering ? JSON.stringify(filtering) : undefined,
    sort_field: sortField,
    sort_type: sortType,
    page,
    page_size: pageSize,
  });
}
