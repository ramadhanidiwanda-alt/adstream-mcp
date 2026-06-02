import type { BrokerRuntimeMode } from './credentials.js';
import { createCuanInsightCredentialClient } from './cuanInsightClient.js';
import { CuanInsightCredentialProvider } from './credentials.js';

/**
 * Configuration for remote Cuan Insight credential resolution.
 *
 * Security rules:
 * - baseUrl must be provided via environment variable, never hardcoded
 * - endpoint path is configurable with a safe default
 * - timeout is configurable for network resilience
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
 *
 * Security rules:
 * - Fails fast with clear error if remote mode is missing required config
 * - Never logs or exposes tokens
 * - Validates timeout as positive integer
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
