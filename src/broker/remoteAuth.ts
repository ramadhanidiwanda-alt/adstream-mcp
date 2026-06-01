import type { AdsProviderId } from './types.js';
import { isAdsProviderId } from './types.js';
import type { CuanInsightCredentialResolveRequest } from './cuanInsight.js';

/**
 * Remote MCP auth error codes.
 *
 * These codes are safe to surface to callers and never reveal token material.
 */
export const REMOTE_MCP_AUTH_ERROR_CODES = [
  'MISSING_AUTHORIZATION',
  'INVALID_AUTHORIZATION_FORMAT',
  'MALFORMED_BEARER_TOKEN',
  'UNSUPPORTED_PROVIDER',
] as const;

export type RemoteMcpAuthErrorCode = (typeof REMOTE_MCP_AUTH_ERROR_CODES)[number];

/**
 * HTTP headers expected from remote MCP clients.
 *
 * Authorization: Bearer <remote_mcp_token> (required)
 * X-Cuan-Workspace-Id: <workspace-id> (optional)
 * X-Request-Id: <request-id> (optional)
 */
export interface RemoteMcpAuthHeaders {
  authorization?: string;
  'x-cuan-workspace-id'?: string;
  'x-request-id'?: string;
}

/**
 * Parsed remote MCP request context.
 *
 * This context is built from HTTP headers and passed to the credential resolver.
 * The callerToken MUST never be logged or echoed back to clients.
 */
export interface RemoteMcpRequestContext {
  callerToken: string;
  workspaceId?: string;
  requestId?: string;
}

/**
 * Result of parsing remote MCP auth headers.
 */
export type RemoteMcpAuthParseResult =
  | {
      ok: true;
      context: RemoteMcpRequestContext;
    }
  | {
      ok: false;
      error: {
        code: RemoteMcpAuthErrorCode;
        message: string;
      };
    };

/**
 * Parse and validate remote MCP auth headers.
 *
 * This function extracts the bearer token from the Authorization header and
 * optional workspace/request IDs from custom headers.
 *
 * Security rules:
 * - Authorization header is required
 * - Authorization must use Bearer scheme
 * - Token is extracted but never logged
 * - Workspace ID and Request ID are optional
 * - All errors are safe to surface to clients
 *
 * @param headers - HTTP headers from remote MCP request
 * @returns Parse result with context or error
 */
export function parseRemoteMcpAuthHeaders(
  headers: RemoteMcpAuthHeaders
): RemoteMcpAuthParseResult {
  // Check for Authorization header
  if (!headers.authorization || headers.authorization.trim() === '') {
    return {
      ok: false,
      error: {
        code: 'MISSING_AUTHORIZATION',
        message: 'Authorization header is required for remote MCP requests',
      },
    };
  }

  // Parse Bearer token
  const authHeader = headers.authorization.trim();
  const bearerPrefix = 'Bearer ';

  if (!authHeader.startsWith(bearerPrefix)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_AUTHORIZATION_FORMAT',
        message: 'Authorization header must use Bearer scheme',
      },
    };
  }

  // Extract token after "Bearer " prefix
  const tokenPart = authHeader.slice(bearerPrefix.length);
  const callerToken = tokenPart.trim();

  if (!callerToken || callerToken.length === 0) {
    return {
      ok: false,
      error: {
        code: 'MALFORMED_BEARER_TOKEN',
        message: 'Bearer token is empty or malformed',
      },
    };
  }

  // Extract optional workspace ID
  const workspaceId = headers['x-cuan-workspace-id']?.trim();

  // Extract optional request ID
  const requestId = headers['x-request-id']?.trim();

  return {
    ok: true,
    context: {
      callerToken,
      workspaceId: workspaceId || undefined,
      requestId: requestId || undefined,
    },
  };
}

/**
 * Build a Cuan Insight credential resolve request from remote MCP context.
 *
 * This helper constructs the credential request payload that will be sent to
 * the Cuan Insight credential client.
 *
 * Security rules:
 * - Provider must be 'meta' or 'tiktok'
 * - Requested scopes are always ['read'] in this phase
 * - Caller token comes from Authorization header
 * - Workspace ID comes from X-Cuan-Workspace-Id header if present
 * - Account ID is optional and comes from tool parameters
 *
 * @param provider - Ads provider ID ('meta' or 'tiktok')
 * @param context - Parsed remote MCP request context
 * @param accountId - Optional provider account ID
 * @param params - Optional tool-specific parameters
 * @returns Credential resolve request or error
 */
export function buildCuanInsightCredentialRequestFromRemoteContext(
  provider: unknown,
  context: RemoteMcpRequestContext,
  accountId?: string,
  params?: Record<string, unknown>
): { ok: true; request: CuanInsightCredentialResolveRequest } | { ok: false; error: { code: RemoteMcpAuthErrorCode; message: string } } {
  // Validate provider
  if (!isAdsProviderId(provider)) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_PROVIDER',
        message: 'Provider must be "meta" or "tiktok"',
      },
    };
  }

  // Build request
  const request: CuanInsightCredentialResolveRequest = {
    provider,
    accountId,
    workspaceId: context.workspaceId,
    callerToken: context.callerToken,
    requestedScopes: ['read'],
    params,
  };

  return { ok: true, request };
}

/**
 * Check if a value is a valid RemoteMcpAuthErrorCode.
 */
export function isRemoteMcpAuthErrorCode(value: unknown): value is RemoteMcpAuthErrorCode {
  return (
    typeof value === 'string' &&
    (REMOTE_MCP_AUTH_ERROR_CODES as readonly string[]).includes(value)
  );
}
