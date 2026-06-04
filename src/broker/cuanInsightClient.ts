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
 * - 'oauth_token': OAuth access token hash (resolved via mcp-resolve-credential authType=oauth_token)
   *
   * Default: 'mcp_token'
   */
  authMode?: 'mcp_token' | 'connection_key' | 'oauth_token';

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

      // oauth_token mode: resolve via OAuth token hash
      if (authMode === 'oauth_token' || request.authType === 'oauth_token') {
        if (!request.tokenHash) {
          throw new CuanInsightCredentialClientError(
            'MISSING_CALLER_TOKEN',
            'OAuth token hash is required for oauth_token auth mode'
          );
        }
      }

      // connection_key mode: connectionKey from request (hosted multi-user) or config (local/single-tenant)
      // Skip connection key requirement when using oauth_token auth type
      const effectiveConnectionKey = request.connectionKey?.trim() || config.connectionKey?.trim();
      if (authMode === 'connection_key' && request.authType !== 'oauth_token' && !effectiveConnectionKey) {
        throw new CuanInsightCredentialClientError(
          'MISSING_CALLER_TOKEN',
          'Connection key is not configured'
        );
      }

      // Preserve base URL path when endpointPath is absolute
      const baseUrlClean = config.baseUrl.replace(/\/+$/, '');
      const endpointClean = endpointPath.replace(/^\/+/, '/');
      const url = new URL(baseUrlClean + endpointClean);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Build request body (never includes callerToken or connectionKey)
      const body: Record<string, unknown> = {
        provider: request.provider,
      };

      // OAuth token mode: add authType and tokenHash
      if (authMode === 'oauth_token' || request.authType === 'oauth_token') {
        body.authType = 'oauth_token';
        body.tokenHash = request.tokenHash;
        if (request.oauthClientId) body.clientId = request.oauthClientId;
        if (request.oauthResource) body.resource = request.oauthResource;
        if (request.connectionKeyId) body.connectionKeyId = request.connectionKeyId;
      }

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

      if (authMode === 'oauth_token' || request.authType === 'oauth_token') {
        // OAuth token mode: send body-only auth (tokenHash in body)
        // Supabase auth for endpoint access
        if (config.supabaseAnonKey) {
          headers['Authorization'] = `Bearer ${config.supabaseAnonKey}`;
        }
      } else if (authMode === 'connection_key') {
        // Connection Key mode: send connection key header
        // If hosted auth is also configured, send supabase anon key too
        if (useHostedAuth) {
          headers['Authorization'] = `Bearer ${config.supabaseAnonKey}`;
        }
        headers[CONNECTION_KEY_HEADER] = effectiveConnectionKey!;
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

        // ── Temp debug: raw resolver response shape ──
        if (process.env.MCP_OAUTH_DEBUG === 'true') {
          const safeShape: Record<string, unknown> = {};
          if (normalizedResponse && typeof normalizedResponse === 'object') {
            const nr = normalizedResponse as Record<string, unknown>;
            for (const key of Object.keys(nr)) {
              if (['providerToken','accessToken','token','key','secret','password'].some(k => key.toLowerCase().includes(k))) {
                safeShape[key] = '<redacted>';
              } else if (typeof nr[key] === 'object' && nr[key] !== null) {
                safeShape[key] = '<object>';
              } else {
                safeShape[key] = nr[key];
              }
            }
          }
          console.log('[TOOL_DEBUG] cuan_insight.response', JSON.stringify(safeShape));
        }

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
    if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'not_object');
    return false;
  }

  const response = value as Record<string, unknown>;

  // ok field is required and must be boolean
  if (typeof response.ok !== 'boolean') {
    if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'ok_not_boolean', { ok_type: typeof response.ok, ok: response.ok });
    return false;
  }

  // If ok is false, error must be present
  if (response.ok === false) {
    if (!response.error || typeof response.error !== 'object') {
      if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'error_missing');
      return false;
    }
    const error = response.error as Record<string, unknown>;
    if (typeof error.code !== 'string' || typeof error.message !== 'string') {
      if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'error_fields_invalid', { code_type: typeof error.code, msg_type: typeof error.message });
      return false;
    }
  }

  // If ok is true, validate optional fields
  if (response.ok === true) {
    // identity is optional but must be valid if present
    if (response.identity !== undefined) {
      if (typeof response.identity !== 'object' || !response.identity) {
        if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'identity_not_object');
        return false;
      }
      const identity = response.identity as Record<string, unknown>;
      if (
        typeof identity.workspaceId !== 'string' ||
        typeof identity.plan !== 'string'
      ) {
        if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'identity_fields', { ws_type: typeof identity.workspaceId, ws_val: identity.workspaceId, plan_type: typeof identity.plan, plan_val: identity.plan });
        return false;
      }
      if (
        identity.userId !== undefined &&
        typeof identity.userId !== 'string'
      ) {
        if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'identity_userid', { userid_type: typeof identity.userId });
        return false;
      }
    }

    // providerAccess is optional but must be valid if present
    if (response.providerAccess !== undefined) {
      if (
        typeof response.providerAccess !== 'object' ||
        !response.providerAccess
      ) {
        if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'providerAccess_not_object');
        return false;
      }
      const access = response.providerAccess as Record<string, unknown>;
      if (
        typeof access.provider !== 'string' ||
        typeof access.accountId !== 'string' && access.accountId !== null ||
        !Array.isArray(access.scopes) ||
        typeof access.allowed !== 'boolean'
      ) {
        if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'providerAccess_fields', { prov_type: typeof access.provider, acct_type: typeof access.accountId, acct_val: access.accountId, scopes_is_array: Array.isArray(access.scopes), allowed_type: typeof access.allowed, allowed_val: access.allowed });
        return false;
      }
    }

    // providerToken is optional but must be string if present
    if (
      response.providerToken !== undefined &&
      typeof response.providerToken !== 'string'
    ) {
      if (process.env.MCP_OAUTH_DEBUG === 'true') console.log('[TOOL_DEBUG] contract.fail', 'providerToken_type', { tok_type: typeof response.providerToken });
      return false;
    }
  }

  return true;
}
