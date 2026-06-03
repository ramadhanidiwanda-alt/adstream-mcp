import type { BrokerRuntimeMode } from './credentials.js';

/**
 * Supported Cuan Insight authentication modes.
 * - 'mcp_token': legacy MCP token flow (default)
 * - 'connection_key': Connection Key from Cuan Insight UI connector
 */
export type CuanInsightAuthMode = 'mcp_token' | 'connection_key';

/**
 * Configuration for remote Cuan Insight credential resolution.
 *
 * Security rules:
 * - baseUrl must be provided via environment variable, never hardcoded
 * - endpoint path is configurable with a safe default
 * - timeout is configurable for network resilience
 * - connectionKey/authMode are optional; when authMode is 'connection_key',
 *   connectionKey is optional (hosted multi-user uses per-request header)
 */
export interface RemoteBrokerConfig {
  /**
   * Base URL of the Cuan Insight credential service.
   * Example: 'https://api.cuaninsight.com' or 'http://localhost:3000'
   *
   * MUST be provided via CUAN_INSIGHT_API_BASE_URL environment variable.
   * MUST NOT be hardcoded in production.
   */
  cuanInsightBaseUrl: string;

  /**
   * Endpoint path for credential resolution.
   * Default: '/mcp/credentials/resolve'
   */
  cuanInsightEndpointPath?: string;

  /**
   * Request timeout in milliseconds.
   * Default: 10000 (10 seconds)
   */
  cuanInsightTimeoutMs?: number;

  /**
   * Supabase anonymous key for hosted Supabase auth pattern.
   * When provided, enables hosted auth mode.
   *
   * MUST be provided via CUAN_INSIGHT_SUPABASE_ANON_KEY environment variable.
   * MUST NOT be hardcoded in production.
   */
  cuanInsightSupabaseAnonKey?: string;

  /**
   * Header name for MCP token when using hosted Supabase auth.
   * Default: 'X-Cuan-MCP-Token'
   */
  cuanInsightMcpTokenHeaderName?: string;

  /**
   * Caller MCP token for remote credential resolution.
   * MUST be provided via CUAN_INSIGHT_MCP_TOKEN environment variable.
   * MUST NOT be logged or exposed in errors.
   */
  cuanInsightMcpToken?: string;

  /**
   * Authentication mode for Cuan Insight credential resolution.
   * - 'mcp_token': legacy MCP token flow (default)
   * - 'connection_key': Connection Key from Cuan Insight UI
   *
   * MUST be provided via CUAN_INSIGHT_AUTH_MODE environment variable.
   * Default: 'mcp_token'
   */
  cuanInsightAuthMode?: CuanInsightAuthMode;

  /**
   * Optional global fallback connection key for single-tenant / backward compat.
   * Hosted multi-user: clients send x-cuan-mcp-connection-key per request.
   *
   * MUST be provided via CUAN_INSIGHT_CONNECTION_KEY environment variable.
   * MUST NOT be logged or exposed in errors.
   */
  cuanInsightConnectionKey?: string;
}

/**
 * Broker configuration supporting local and remote modes.
 */
export interface BrokerConfig {
  /**
   * Runtime mode for the broker.
   * - 'local': Use environment variables for credentials (default)
   * - 'remote': Use Cuan Insight API for credentials
   * - 'test': Use test provider (for testing only)
   */
  mode: BrokerRuntimeMode;

  /**
   * Remote mode configuration.
   * Required when mode is 'remote'.
   */
  cuanInsight?: RemoteBrokerConfig;
}

/**
 * Parse broker configuration from environment variables.
 *
 * Environment variables:
 * - BROKER_RUNTIME_MODE: 'local' | 'remote' | 'test' (default: 'local')
 * - CUAN_INSIGHT_API_BASE_URL: Required when mode is 'remote'
 * - CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH: Optional endpoint path
 * - CUAN_INSIGHT_REQUEST_TIMEOUT_MS: Optional timeout in milliseconds
 * - CUAN_INSIGHT_AUTH_MODE: 'mcp_token' | 'connection_key' (default: 'mcp_token')
 * - CUAN_INSIGHT_CONNECTION_KEY: Optional global fallback (per-request header for hosted multi-user)
 *
 * Security rules:
 * - Fails fast with clear error if remote mode is missing required config
 * - Never logs or exposes tokens or connection keys
 * - Validates timeout as positive integer
 * - Validates authMode against allowed values
 *
 * @returns Parsed broker configuration
 * @throws Error if remote mode is missing required configuration
 */
export function parseBrokerConfigFromEnv(): BrokerConfig {
  const modeStr = process.env.BROKER_RUNTIME_MODE || 'local';
  const mode = modeStr as BrokerRuntimeMode;

  // Validate mode
  if (mode !== 'local' && mode !== 'remote' && mode !== 'test') {
    throw new Error(
      `Invalid BROKER_RUNTIME_MODE: ${modeStr}. Must be 'local', 'remote', or 'test'.`
    );
  }

  // Remote mode requires Cuan Insight configuration
  if (mode === 'remote') {
    const baseUrl = process.env.CUAN_INSIGHT_API_BASE_URL;

    if (!baseUrl || baseUrl.trim() === '') {
      throw new Error(
        'CUAN_INSIGHT_API_BASE_URL is required when BROKER_RUNTIME_MODE=remote'
      );
    }

    const endpointPath = process.env.CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH;
    const timeoutStr = process.env.CUAN_INSIGHT_REQUEST_TIMEOUT_MS;
    const supabaseAnonKey = process.env.CUAN_INSIGHT_SUPABASE_ANON_KEY;
    const mcpTokenHeaderName = process.env.CUAN_INSIGHT_MCP_TOKEN_HEADER_NAME;
    const mcpToken = process.env.CUAN_INSIGHT_MCP_TOKEN;

    // Parse auth mode (connection key support — Phase 17.5C)
    const authModeRaw = process.env.CUAN_INSIGHT_AUTH_MODE?.trim() || 'mcp_token';
    let authMode: CuanInsightAuthMode;
    if (authModeRaw === 'connection_key') {
      authMode = 'connection_key';
    } else if (authModeRaw === 'mcp_token') {
      authMode = 'mcp_token';
    } else {
      throw new Error(
        `Invalid CUAN_INSIGHT_AUTH_MODE: ${authModeRaw}. Must be 'mcp_token' or 'connection_key'.`
      );
    }

    // Optional global connection key for single-tenant / backward compat.
    // Hosted multi-user: clients send x-cuan-mcp-connection-key per request.
    // Both modes use the same connection_key auth mode — the per-request key
    // takes priority over the global env key in the credential client.
    const connectionKey = process.env.CUAN_INSIGHT_CONNECTION_KEY?.trim() || undefined;

    let timeoutMs: number | undefined;
    if (timeoutStr) {
      timeoutMs = parseOptionalPositiveInteger(
        timeoutStr,
        'CUAN_INSIGHT_REQUEST_TIMEOUT_MS'
      );
    }

    return {
      mode: 'remote',
      cuanInsight: {
        cuanInsightBaseUrl: baseUrl.trim(),
        cuanInsightEndpointPath: endpointPath?.trim() || undefined,
        cuanInsightTimeoutMs: timeoutMs,
        cuanInsightSupabaseAnonKey: supabaseAnonKey?.trim() || undefined,
        cuanInsightMcpTokenHeaderName: mcpTokenHeaderName?.trim() || undefined,
        cuanInsightMcpToken: mcpToken?.trim() || undefined,
        cuanInsightAuthMode: authMode,
        cuanInsightConnectionKey: connectionKey,
      },
    };
  }

  // Local or test mode
  return { mode };
}

/**
 * Parse an optional positive integer from a string.
 *
 * @param value - String value to parse
 * @param name - Name of the environment variable (for error messages)
 * @returns Parsed positive integer
 * @throws Error if value is not a positive integer
 */
function parseOptionalPositiveInteger(value: string, name: string): number {
  const parsed = parseInt(value, 10);

  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `${name} must be a positive integer, got: ${value}`
    );
  }

  return parsed;
}
