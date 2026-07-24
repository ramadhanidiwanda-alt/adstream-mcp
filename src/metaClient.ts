import fs from 'node:fs';
import pathModule from 'node:path';
import type { MetaConfig } from './types.js';
import type { MetaPaginatedResponse, PaginationOptions, RateLimitInfo } from './types.js';
import { MetaApiError, isMetaErrorResponse } from './utils/metaError.js';

export interface MetaGetOptions extends PaginationOptions {
  /** Max retries on HTTP 429 rate limit. Default: 3 */
  maxRetries?: number;
}

interface FetchResult<T> {
  data: T[];
  paging?: MetaPaginatedResponse<T>['paging'];
  rateLimit?: RateLimitInfo;
}

export class MetaClient {
  private baseUrl: string;
  private accessToken: string;
  readonly apiVersion: string;
  private lastRateLimit: RateLimitInfo | null = null;

  constructor(config: MetaConfig) {
    this.apiVersion = config.apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.accessToken = config.accessToken;
  }

  /** Get the last known rate limit info */
  get lastRateLimitInfo(): RateLimitInfo | null {
    return this.lastRateLimit;
  }

  async metaGet<T = any>(
    path: string,
    params: Record<string, any> = {},
    options: MetaGetOptions = {}
  ): Promise<T> {
    const {
      paginate = false,
      maxPages = 10,
      pageDelay = 200,
      maxRetries = 3,
    } = options;

    // Non-paginated: original behavior, fully backward compatible
    if (!paginate) {
      return this.fetchSinglePage<T>(path, params, maxRetries);
    }

    // Paginated mode: loop through all pages
    const allData: T[] = [];
    let currentParams = { ...params };
    let pagesFetched = 0;
    let cursor: string | undefined;

    while (pagesFetched < maxPages) {
      if (cursor) {
        currentParams = { ...currentParams, after: cursor };
      }

      const result = await this.fetchSinglePageRaw<T>(
        path,
        currentParams,
        maxRetries
      );

      if (result.data.length > 0) {
        allData.push(...result.data);
      }

      if (result.rateLimit) {
        this.lastRateLimit = result.rateLimit;
      }

      pagesFetched++;

      // Check if there's a next page
      const nextUrl = result.paging?.next;
      if (!nextUrl) {
        break; // No more pages
      }

      // Extract 'after' cursor from the next URL
      cursor = this.extractAfterCursor(nextUrl);
      if (!cursor) {
        break; // Can't parse cursor, stop pagination
      }

      // Stop if last page returned empty data
      if (result.data.length === 0) {
        break;
      }

      // Rate limit aware delay between pages
      if (this.lastRateLimit && this.lastRateLimit.usagePercent >= 80) {
        // Near rate limit: longer delay
        await this.sleep(pageDelay * 5);
      } else if (pageDelay > 0) {
        await this.sleep(pageDelay);
      }
    }

    // Return as MetaPaginatedResponse shape for backward compat
    return { data: allData } as T;
  }

  async metaGetObject<T = Record<string, unknown>>(
    path: string,
    params: Record<string, any> = {},
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const url = this.buildUrl(path, params);

      try {
        const response = await fetch(url);
        const rateLimit = this.parseRateLimitHeaders(response.headers);
        if (rateLimit) {
          this.lastRateLimit = rateLimit;
        }

        const data = await response.json();

        if (!response.ok || isMetaErrorResponse(data)) {
          if (isMetaErrorResponse(data)) {
            const error = new MetaApiError(data.error);
            if (response.status === 429 && attempt < maxRetries) {
              const backoff = Math.pow(2, attempt) * 1000;
              await this.sleep(backoff);
              lastError = error;
              continue;
            }

            throw error;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return data as T;
      } catch (error) {
        if (error instanceof MetaApiError) {
          throw error;
        }

        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 500;
          await this.sleep(backoff);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('Meta API object request failed');
  }

  /** POST to Meta Graph API. Used for mutations (pause, update, rename). */
  async metaPost<T = Record<string, unknown>>(
    path: string,
    params: Record<string, any> = {},
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const url = `${this.baseUrl}${path}?access_token=${this.accessToken}`;

      try {
        const body = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            body.append(
              key,
              typeof value === 'object' ? JSON.stringify(value) : String(value)
            );
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        const data = await response.json();

        // Check for Meta API error
        if (!response.ok || isMetaErrorResponse(data)) {
          if (isMetaErrorResponse(data)) {
            const error = new MetaApiError(data.error);

            // HTTP 429 = rate limit hit, retry with backoff
            if (response.status === 429 && attempt < maxRetries) {
              const backoff = Math.pow(2, attempt) * 1000;
              await this.sleep(backoff);
              lastError = error;
              continue;
            }

            throw error;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return data as T;
      } catch (error) {
        if (error instanceof MetaApiError) {
          throw error;
        }

        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 500;
          await this.sleep(backoff);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('Meta API POST request failed');
  }

  /** POST multipart/form-data to Meta Graph API. Used for file uploads (images, videos). */
  async metaUploadMultipart<T = Record<string, unknown>>(
    path: string,
    filePath: string,
    fieldName: string,
    additionalFields?: Record<string, string>,
    maxRetries: number = 3
  ): Promise<T> {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    const fileName = pathModule.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer]);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const url = `${this.baseUrl}${path}?access_token=${this.accessToken}`;

      try {
        const formData = new FormData();
        formData.append(fieldName, fileBlob, fileName);

        if (additionalFields) {
          for (const [key, value] of Object.entries(additionalFields)) {
            formData.append(key, value);
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || isMetaErrorResponse(data)) {
          if (isMetaErrorResponse(data)) {
            const error = new MetaApiError(data.error);

            if (response.status === 429 && attempt < maxRetries) {
              const backoff = Math.pow(2, attempt) * 1000;
              await this.sleep(backoff);
              lastError = error;
              continue;
            }

            throw error;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return data as T;
      } catch (error) {
        if (error instanceof MetaApiError) {
          throw error;
        }

        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 500;
          await this.sleep(backoff);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('Meta API multipart upload request failed');
  }

  private extractAfterCursor(nextUrl: string): string | undefined {
    try {
      const url = new URL(nextUrl);
      return url.searchParams.get('after') ?? undefined;
    } catch {
      // If URL parsing fails, try to extract via regex as fallback
      const match = nextUrl.match(/[?&]after=([^&]+)/);
      return match?.[1] ? decodeURIComponent(match[1]) : undefined;
    }
  }

  private async fetchSinglePage<T>(
    path: string,
    params: Record<string, any>,
    maxRetries: number
  ): Promise<T> {
    const result = await this.fetchSinglePageRaw<T>(path, params, maxRetries);
    return { data: result.data, paging: result.paging } as T;
  }

  private async fetchSinglePageRaw<T>(
    path: string,
    params: Record<string, any>,
    maxRetries: number
  ): Promise<FetchResult<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const url = this.buildUrl(path, params);

      try {
        const response = await fetch(url);

        // Parse rate limit headers (even on error responses)
        const rateLimit = this.parseRateLimitHeaders(response.headers);
        if (rateLimit) {
          this.lastRateLimit = rateLimit;
        }

        const data = await response.json();

        // Check for Meta API error
        if (!response.ok || isMetaErrorResponse(data)) {
          if (isMetaErrorResponse(data)) {
            const error = new MetaApiError(data.error);

            // HTTP 429 = rate limit hit, retry with backoff
            if (response.status === 429 && attempt < maxRetries) {
              const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, ...
              await this.sleep(backoff);
              lastError = error;
              continue;
            }

            throw error;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Extract paging info and data
        const paginated = data as MetaPaginatedResponse<T>;
        const result: FetchResult<T> = {
          data: paginated.data ?? [],
          paging: paginated.paging,
          rateLimit: rateLimit ?? undefined,
        };

        return result;

      } catch (error) {
        // If it's already a MetaApiError (non-429), rethrow immediately
        if (error instanceof MetaApiError) {
          throw error;
        }

        // Network errors: retry if attempts remain
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 500; // 0.5s, 1s, 2s, ...
          await this.sleep(backoff);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new Error('Meta API request failed');
  }

  private buildUrl(path: string, params: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.append('access_token', this.accessToken);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
    // Meta rate limit headers:
    // X-Ad-Account-Usage: {"acc_id_act_123":{"usage":28,"acc_id":"act_123","call_count":28,"total_cputime":3,"total_time":3}}
    // X-Business-Usage: {"business_id_123":{"call_count":28,"total_cputime":3}}
    // X-App-Usage: {"call_count":28,"total_cputime":3,"total_time":3}

    const usageHeader = headers.get('X-Ad-Account-Usage');
    if (!usageHeader) {
      return null;
    }

    try {
      const parsed = JSON.parse(usageHeader);
      // Find the first account usage entry
      const accountKey = Object.keys(parsed).find((k) => k.startsWith('acc_id_'));
      const usage = accountKey ? parsed[accountKey] : null;

      if (usage && typeof usage.usage === 'number') {
        return {
          usagePercent: usage.usage,
          remaining: 100 - usage.usage,
          resetAt: null, // Meta doesn't provide reset in this header
        };
      }

      // Fallback: try app-level usage
      if (typeof parsed.call_count === 'number') {
        return {
          usagePercent: Math.min((parsed.call_count / 100) * 100, 100),
          remaining: Math.max(100 - parsed.call_count, 0),
          resetAt: null,
        };
      }
    } catch {
      // Ignore parse errors for headers
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
