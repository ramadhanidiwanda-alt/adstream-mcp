import type {
  CuanInsightCredentialClient,
  CuanInsightCredentialResolveRequest,
  CuanInsightCredentialResolveResponse,
} from './cuanInsight.js';
import { redactErrorMessage } from './credentials.js';

/**
 * Configuration for the Cuan Insight credential client.
 *
 * Security rules:
 * - baseUrl must be provided via config/env, never hardcoded
 * - endpoint path is configurable with a safe default
 * - callerToken is passed per-request, never stored in config
 * - connectionKey is passed per-request, never stored in config
 * - timeout is configurable for network resilience
 */
export interface CuanInsightCredentialClientConfig {
  /**
   * Base URL of the Cuan Insight credential service.
   * Example: 'https://api.cuaninsight.com' or 'http://localhost:3000'
   *
   * MUST be provided via environment variable or config.
   * MUST NOT be hardcoded in production.
   */
  baseUrl: string;

  /**
   * Endpoint path for credential resolution.
   * Default: '/mcp/credentials/resolve'
   */
  endpointPath?: string;

  /**
   * Request timeout in milliseconds.
   * Default: 10000 (10 seconds)
   */
  timeoutMs?: number;

  /**
   * Supabase anonymous key for hosted Supabase auth pattern.
   * When provided, the client will send:
   * - Authorization: Bearer <supabaseAnonKey>
   *
   * MUST be provided via environment variable or config.
   * MUST NOT be hardcoded in production.
   * MUST NOT be logged or exposed in errors.
   */
  supabaseAnonKey?: string;

  /**
   * Header name for MCP token when using hosted Supabase auth.
   * Default: 'X-Cuan-MCP-Token'
   *
   * Only used when authMode is 'mcp_token' (default).
   */
  mcpTokenHeaderName?: string;

  /**
   * Authentication mode for credential resolution.
   * - 'mcp_token': legacy MCP token flow (default)
   * - 'connection_key': Connection Key from Cuan Insight UI
   *
   * Default: 'mcp_token'
   */
  authMode?: 'mcp_token' | 'connection_key';

  /**
   * Connection Key from Cuan Insight UI connector.
   * Required when authMode is 'connection_key'.
   * Sent as x-cuan-mcp-connection-key header.
   *
   * MUST NOT be logged or exposed in errors.
   */
  connectionKey?: string;

  /**
   * Injectable fetch implementation for testing.
   * Default: global fetch
   */
  fetch?: typeof fetch;
}

/**
 * Options for creating a Cuan Insight credential client.
 */
export interface CuanInsightCredentialClientOptions {
  config: CuanInsightCredentialClientConfig;
}

/**
 * Error codes specific to the Cuan Insight credential client.
 *
 * These are safe to surface to callers and never reveal token material.
 */
export const CUAN_INSIGHT_CLIENT_ERROR_CODES = [
  'MISSING_BASE_URL',
  'MISSING_CALLER_TOKEN',
  'MISSING_SUPABASE_ANON_KEY',
  'NETWORK_ERROR',
  'UPSTREAM_ERROR',
  'INVALID_RESPONSE',
  'TIMEOUT_ERROR',
] as const;

export type CuanInsightClientErrorCode =
  (typeof CUAN_INSIGHT_CLIENT_ERROR_CODES)[number];

/**
 * Error thrown by the Cuan Insight credential client.
 *
 * Security rules:
 * - message is always redacted
 * - code is safe to surface
 * - statusCode is included for HTTP errors
 * - original error is not exposed
 */
export class CuanInsightCredentialClientError extends Error {
  constructor(
    public readonly code: CuanInsightClientErrorCode,
    message: string,
    public readonly statusCode?: number
  ) {
    super(redactErrorMessage(message));
    this.name = 'CuanInsightCredentialClientError';
  }
}

/**
 * Default endpoint path for credential resolution.
 */
const DEFAULT_ENDPOINT_PATH = '/mcp/credentials/resolve';

/**
 * Default request timeout in milliseconds.
 */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Header name for Connection Key when using connection_key auth mode.
 */
const CONNECTION_KEY_HEADER = 'x-cuan-mcp-connection-key';

/**
 * HTTP client for resolving credentials from Cuan Insight.
 *
 * This client supports two auth modes:
 * - mcp_token (default): legacy MCP token flow via X-Cuan-MCP-Token or Authorization
 * - connection_key: Connection Key from Cuan Insight UI via x-cuan-mcp-connection-key
 *
 * Security rules:
 * - baseUrl must be provided via config
 * - callerToken/connectionKey are never logged or exposed in errors
 * - All errors are redacted
 * - Response body is validated before returning
 *
 * @param options - Client configuration options
 * @returns CuanInsightCredentialClient instance
 */
export function createCuanInsightCredentialClient(
  options: CuanInsightCredentialClientOptions
): CuanInsightCredentialClient {
  const { config } = options;
  const endpointPath = config.endpointPath ?? DEFAULT_ENDPOINT_PATH;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = config.fetch ?? fetch;
  const mcpTokenHeaderName = config.mcpTokenHeaderName ?? 'X-Cuan-MCP-Token';
  const useHostedAuth = !!config.supabaseAnonKey;
  const authMode = config.authMode ?? 'mcp_token';

  return {
    async resolve(
      request: CuanInsightCredentialResolveRequest
    ): Promise<CuanInsightCredentialResolveResponse> {
      // Validate baseUrl
      if (!config.baseUrl || config.baseUrl.trim() === '') {
        throw new CuanInsightCredentialClientError(
          'MISSING_BASE_URL',
          'Cuan Insight base URL is not configured'
        );
      }

      // Validate auth requirements
      if (authMode === 'mcp_token') {
        // MCP token mode: callerToken is required
        if (!request.callerToken || request.callerToken.trim() === '') {
          throw new CuanInsightCredentialClientError(
            'MISSING_CALLER_TOKEN',
            'Caller token is required'
          );
        }
      }

      // connection_key mode: connectionKey must be in config, not in request
      if (authMode === 'connection_key' && (!config.connectionKey || config.connectionKey.trim() === '')) {
        throw new CuanInsightCredentialClientError(
          'MISSING_CALLER_TOKEN',
          'Connection key is not configured'
        );
      }

      const url = new URL(endpointPath, config.baseUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Build request body (never includes callerToken or connectionKey)
      const body: Record<string, unknown> = {
        provider: request.provider,
      };
      if (request.accountId !== undefined) {
        body.accountId = request.accountId;
      }
      if (request.workspaceId !== undefined) {
        body.workspaceId = request.workspaceId;
      }
      if (request.requestedScopes !== undefined) {
        body.requestedScopes = request.requestedScopes;
      }
      if (request.params !== undefined) {
        body.params = request.params;
      }

      // Build headers based on auth mode
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authMode === 'connection_key') {
        // Connection Key mode: send connection key header
        // If hosted auth is also configured, send supabase anon key too
        if (useHostedAuth) {
          headers['Authorization'] = `Bearer ${config.supabaseAnonKey}`;
        }
        headers[CONNECTION_KEY_HEADER] = config.connectionKey!;
      } else {
        // MCP token mode (legacy, default)
        if (useHostedAuth) {
          headers['Authorization'] = `Bearer ${config.supabaseAnonKey}`;
          headers[mcpTokenHeaderName] = request.callerToken!;
        } else {
          headers['Authorization'] = `Bearer ${request.callerToken!}`;
        }
      }

      try {
        const response = await fetchImpl(url.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-2xx responses
        if (!response.ok) {
          throw new CuanInsightCredentialClientError(
            'UPSTREAM_ERROR',
            `Cuan Insight returned status ${response.status}`,
            response.status
          );
        }

        // Parse response body
        let responseBody: unknown;
        try {
          responseBody = await response.json();
        } catch (parseError) {
          throw new CuanInsightCredentialClientError(
            'INVALID_RESPONSE',
            'Failed to parse Cuan Insight response as JSON'
          );
        }

        const normalizedResponse = normalizeCuanInsightResponse(responseBody);

        // Validate response contract
        if (!isValidCuanInsightResponse(normalizedResponse)) {
          throw new CuanInsightCredentialClientError(
            'INVALID_RESPONSE',
            'Cuan Insight response does not match expected contract'
          );
        }

        return normalizedResponse;
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle abort/timeout
        if (error instanceof Error && error.name === 'AbortError') {
          throw new CuanInsightCredentialClientError(
            'TIMEOUT_ERROR',
            `Request timed out after ${timeoutMs}ms`
          );
        }

        // Re-throw client errors
        if (error instanceof CuanInsightCredentialClientError) {
          throw error;
        }

        // Handle network errors
        throw new CuanInsightCredentialClientError(
          'NETWORK_ERROR',
          error instanceof Error ? error.message : 'Network request failed'
        );
      }
    },
  };
}

function normalizeCuanInsightResponse(
  value: unknown
): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const response = value as Record<string, unknown>;
  const credential =
    response.credential && typeof response.credential === 'object'
      ? (response.credential as Record<string, unknown>)
      : undefined;

  if (!credential) {
    return value;
  }

  return {
    ...response,
    providerToken: response.providerToken ?? credential.providerToken,
    tokenExpiresAt: response.tokenExpiresAt ?? credential.expiresAt,
  };
}

/**
 * Validate that a response matches the CuanInsightCredentialResolveResponse contract.
 *
 * This is a runtime type guard to ensure the response from Cuan Insight
 * matches the expected shape before returning it to the caller.
 */
function isValidCuanInsightResponse(
  value: unknown
): value is CuanInsightCredentialResolveResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Record<string, unknown>;

  // ok field is required and must be boolean
  if (typeof response.ok !== 'boolean') {
    return false;
  }

  // If ok is false, error must be present
  if (response.ok === false) {
    if (!response.error || typeof response.error !== 'object') {
      return false;
    }
    const error = response.error as Record<string, unknown>;
    if (typeof error.code !== 'string' || typeof error.message !== 'string') {
      return false;
    }
  }

  // If ok is true, validate optional fields
  if (response.ok === true) {
    // identity is optional but must be valid if present
    if (response.identity !== undefined) {
      if (typeof response.identity !== 'object' || !response.identity) {
        return false;
      }
      const identity = response.identity as Record<string, unknown>;
      if (
        typeof identity.workspaceId !== 'string' ||
        typeof identity.plan !== 'string'
      ) {
        return false;
      }
      if (
        identity.userId !== undefined &&
        typeof identity.userId !== 'string'
      ) {
        return false;
      }
    }

    // providerAccess is optional but must be valid if present
    if (response.providerAccess !== undefined) {
      if (
        typeof response.providerAccess !== 'object' ||
        !response.providerAccess
      ) {
        return false;
      }
      const access = response.providerAccess as Record<string, unknown>;
      if (
        typeof access.provider !== 'string' ||
        typeof access.accountId !== 'string' && access.accountId !== null ||
        !Array.isArray(access.scopes) ||
        typeof access.allowed !== 'boolean'
      ) {
        return false;
      }
    }

    // providerToken is optional but must be string if present
    if (
      response.providerToken !== undefined &&
      typeof response.providerToken !== 'string'
    ) {
      return false;
    }
  }

  return true;
}
