import type { MetaConfig } from './types.js';
import { MetaApiError, isMetaErrorResponse } from './utils/metaError.js';

export class MetaClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: MetaConfig) {
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion}`;
    this.accessToken = config.accessToken;
  }

  async metaGet<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
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

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok || isMetaErrorResponse(data)) {
        if (isMetaErrorResponse(data)) {
          throw new MetaApiError(data.error);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return data as T;
    } catch (error) {
      if (error instanceof MetaApiError) {
        throw error;
      }
      throw new Error(
        `Meta API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
