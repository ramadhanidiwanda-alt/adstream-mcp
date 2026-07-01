import type { CommerceMetrics, CommerceProviderId, CommerceRecord } from './types.js';
import { redactErrorMessage, redactTokenLikeValues } from './credentials.js';
import { normalizeGmvMaxRows } from '../providers/tiktok/gmvMaxNormalizer.js';
import type { GmvMaxReportOptions, GmvMaxReportResult } from '../tools/getGmvMaxReport.js';

export const COMMERCE_MCP_TOOL_NAMES = ['commerce_get_performance'] as const;

export type CommerceMcpToolName = (typeof COMMERCE_MCP_TOOL_NAMES)[number];

export const COMMERCE_MCP_TOOL_DEFINITIONS = [
  {
    name: 'commerce_get_performance',
    description: 'Fetch normalized commerce performance data for AI analysis without narrative recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['tiktok_gmv'],
          description: 'Commerce provider. Only tiktok_gmv is supported today.',
        },
        accountId: {
          type: 'string',
          description: 'Provider account or advertiser id.',
        },
        storeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Commerce store ids to query.',
        },
        since: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        until: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format.',
        },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Provider dimensions to request. Defaults to store and product dimensions.',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Provider metrics to request. Defaults to gmv, orders, units_sold, and spend.',
        },
        params: {
          type: 'object',
          description: 'Optional provider-safe parameters such as page, pageSize, filtering, and sorting.',
        },
      },
      required: ['provider', 'accountId', 'storeIds', 'since', 'until'],
    },
  },
] as const;

export interface CommercePerformanceData {
  records: CommerceRecord[];
  totals: CommerceMetrics;
  metadata: {
    date_range: {
      since: string;
      until: string;
    };
    dimensions: string[];
    metrics: string[];
    source: 'tiktok_gmv_max';
    record_count: number;
    page_info?: GmvMaxReportResult['page_info'];
  };
  warnings: string[];
}

export interface CommerceMcpResponse<TData = CommercePerformanceData> {
  ok: boolean;
  provider?: CommerceProviderId;
  data?: TData;
  errors?: Array<{ code?: string; message: string }>;
}

export type CommercePerformanceFetcher = (options: GmvMaxReportOptions) => Promise<GmvMaxReportResult>;

export interface CommerceToolDependencies {
  fetchGmvMaxReport?: CommercePerformanceFetcher;
}

interface CommercePerformanceRequest {
  provider: CommerceProviderId;
  accountId: string;
  storeIds: string[];
  since: string;
  until: string;
  dimensions: string[];
  metrics: string[];
  params: Record<string, unknown>;
}

export async function handleCommerceMcpToolCall(
  name: CommerceMcpToolName,
  args: Record<string, unknown> = {},
  dependencies: CommerceToolDependencies = {}
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const response = await callCommerceTool(name, args, dependencies);
    const safeResponse = stripRawFromResponse(redactTokenLikeValues(response)) as CommerceMcpResponse;

    return {
      content: [{ type: 'text', text: JSON.stringify(safeResponse, null, 2) }],
      isError: !safeResponse.ok || undefined,
    };
  } catch (error) {
    return safeCommerceMcpError(error);
  }
}

export function safeCommerceMcpError(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = redactErrorMessage(message);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ok: false,
            errors: [{ code: 'COMMERCE_MCP_ERROR', message: safeMessage }],
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

async function callCommerceTool(
  name: CommerceMcpToolName,
  args: Record<string, unknown>,
  dependencies: CommerceToolDependencies
): Promise<CommerceMcpResponse> {
  switch (name) {
    case 'commerce_get_performance':
      return getCommercePerformance(args, dependencies);
  }
}

async function getCommercePerformance(
  args: Record<string, unknown>,
  dependencies: CommerceToolDependencies
): Promise<CommerceMcpResponse> {
  const request = parseCommercePerformanceRequest(args);
  if (!request.ok) {
    return { ok: false, errors: [request.error] };
  }

  if (!dependencies.fetchGmvMaxReport) {
    return {
      ok: false,
      provider: 'tiktok_gmv',
      errors: [{ code: 'MISSING_COMMERCE_FETCHER', message: 'TikTok GMV Max client is not configured.' }],
    };
  }

  const report = await dependencies.fetchGmvMaxReport({
    advertiserId: request.value.accountId,
    storeIds: request.value.storeIds,
    dimensions: request.value.dimensions,
    metrics: request.value.metrics,
    startDate: request.value.since,
    endDate: request.value.until,
    page: parseNumber(request.value.params.page),
    pageSize: parseNumber(request.value.params.pageSize),
    filtering: isPlainObject(request.value.params.filtering) ? request.value.params.filtering : undefined,
    sortField: typeof request.value.params.sortField === 'string' ? request.value.params.sortField : undefined,
    sortType: request.value.params.sortType === 'ASC' || request.value.params.sortType === 'DESC'
      ? request.value.params.sortType
      : undefined,
  });

  const records = normalizeGmvMaxRows(report.list, {
    provider: 'tiktok_gmv',
    accountId: request.value.accountId,
    storeId: request.value.storeIds[0],
    since: request.value.since,
    until: request.value.until,
  });

  return {
    ok: true,
    provider: 'tiktok_gmv',
    data: {
      records,
      totals: calculateCommerceTotals(records),
      metadata: {
        date_range: { since: request.value.since, until: request.value.until },
        dimensions: request.value.dimensions,
        metrics: request.value.metrics,
        source: 'tiktok_gmv_max',
        record_count: records.length,
        page_info: report.page_info,
      },
      warnings: [],
    },
  };
}

function parseCommercePerformanceRequest(args: Record<string, unknown>):
  | { ok: true; value: CommercePerformanceRequest }
  | { ok: false; error: { code: string; message: string } } {
  if (args.provider !== 'tiktok_gmv') {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_COMMERCE_PROVIDER',
        message: 'Only provider "tiktok_gmv" is supported for commerce_get_performance today.',
      },
    };
  }

  if (typeof args.accountId !== 'string' || args.accountId.length === 0) {
    return { ok: false, error: { code: 'MISSING_ACCOUNT_ID', message: 'accountId is required.' } };
  }

  if (!Array.isArray(args.storeIds) || !args.storeIds.every((storeId) => typeof storeId === 'string')) {
    return { ok: false, error: { code: 'MISSING_STORE_IDS', message: 'storeIds must be an array of strings.' } };
  }

  if (typeof args.since !== 'string' || typeof args.until !== 'string') {
    return { ok: false, error: { code: 'MISSING_DATE_RANGE', message: 'since and until are required.' } };
  }

  return {
    ok: true,
    value: {
      provider: 'tiktok_gmv',
      accountId: args.accountId,
      storeIds: args.storeIds,
      since: args.since,
      until: args.until,
      dimensions: parseStringArray(args.dimensions, ['store_id', 'product_id', 'product_name']),
      metrics: parseStringArray(args.metrics, ['gmv', 'orders', 'units_sold', 'spend']),
      params: isPlainObject(args.params) ? args.params : {},
    },
  };
}

function calculateCommerceTotals(records: CommerceRecord[]): CommerceMetrics {
  const gmv = sum(records, (record) => record.metrics.gmv);
  const orders = sum(records, (record) => record.metrics.orders);
  const unitsSold = sumOptional(records, (record) => record.metrics.units_sold);
  const adSpend = sumOptional(records, (record) => record.metrics.ad_spend);
  const totals: CommerceMetrics = { gmv, orders };

  if (unitsSold !== undefined) totals.units_sold = unitsSold;
  if (adSpend !== undefined) totals.ad_spend = adSpend;
  if (adSpend && adSpend > 0) totals.roas_commerce = gmv / adSpend;
  if (orders > 0) totals.aov = gmv / orders;

  return totals;
}

function sum(records: CommerceRecord[], getValue: (record: CommerceRecord) => number | undefined): number {
  return records.reduce((total, record) => total + (getValue(record) ?? 0), 0);
}

function sumOptional(records: CommerceRecord[], getValue: (record: CommerceRecord) => number | undefined): number | undefined {
  const values = records.map(getValue).filter((value): value is number => value !== undefined);
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0);
}

function parseStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : fallback;
}

function parseNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
