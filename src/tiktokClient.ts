import fs from 'node:fs';
import crypto from 'node:crypto';
import pathModule from 'node:path';

export interface TikTokApiConfig {
  accessToken: string;
  apiVersion?: string;
  baseUrl?: string;
}

export interface TikTokApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  request_id?: string;
}

export class TikTokApiError extends Error {
  code: number;
  requestId?: string;

  constructor(response: TikTokApiResponse) {
    super(`TikTok API error ${response.code}: ${response.message}`);
    this.name = 'TikTokApiError';
    this.code = response.code;
    this.requestId = response.request_id;
  }
}

export class TikTokApiClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: TikTokApiConfig) {
    this.baseUrl =
      config.baseUrl ?? `https://business-api.tiktok.com/open_api/${config.apiVersion ?? 'v1.3'}`;
    this.accessToken = config.accessToken;
  }

  /** GET request to TikTok API */
  async get<T = unknown>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>('GET', path, params);
  }

  /** POST request to TikTok API */
  async post<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>('POST', path, undefined, body);
  }

  /**
   * POST multipart/form-data to TikTok's file upload endpoints
   * (/file/image/ad/upload/, /file/video/ad/upload/). TikTok requires
   * an MD5 signature of the raw file bytes when upload_type=UPLOAD_BY_FILE.
   */
  async postMultipart<T = unknown>(
    path: string,
    fields: Record<string, string>,
    file: { fieldName: string; filePath: string; signatureFieldName: string }
  ): Promise<T> {
    if (!fs.existsSync(file.filePath)) {
      throw new Error(`File not found: ${file.filePath}`);
    }
    const stat = fs.statSync(file.filePath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${file.filePath}`);
    }

    const fileBuffer = fs.readFileSync(file.filePath);
    const signature = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const fileName = pathModule.basename(file.filePath);

    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    formData.append(file.signatureFieldName, signature);
    formData.append('file_name', fileName);
    formData.append(file.fieldName, new Blob([fileBuffer]), fileName);

    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Access-Token': this.accessToken },
      body: formData,
    });

    const data = (await response.json()) as TikTokApiResponse<T>;
    if (data.code !== 0) {
      throw new TikTokApiError(data);
    }

    return data.data;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            url.searchParams.append(key, `[${value.map((v) => JSON.stringify(v)).join(',')}]`);
          } else if (typeof value === 'object') {
            url.searchParams.append(key, JSON.stringify(value));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      }
    }

    const headers: Record<string, string> = {
      'Access-Token': this.accessToken,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json()) as TikTokApiResponse<T>;

      if (data.code !== 0) {
        throw new TikTokApiError(data);
      }

      return data.data;
    } catch (error) {
      if (error instanceof TikTokApiError) {
        throw error;
      }
      throw new Error(
        `TikTok API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
