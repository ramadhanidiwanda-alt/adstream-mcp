import { describe, it, expect } from 'vitest';
import {
  parseRemoteMcpAuthHeaders,
  buildCuanInsightCredentialRequestFromRemoteContext,
  isRemoteMcpAuthErrorCode,
  type RemoteMcpAuthHeaders,
  type RemoteMcpRequestContext,
} from '../../src/broker/remoteAuth.js';

describe('parseRemoteMcpAuthHeaders', () => {
  it('should parse valid Authorization Bearer token', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.callerToken).toBe('test-token-12345');
      expect(result.context.workspaceId).toBeUndefined();
      expect(result.context.requestId).toBeUndefined();
    }
  });

  it('should parse Authorization with workspace ID', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
      'x-cuan-workspace-id': 'ws-abc-123',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.callerToken).toBe('test-token-12345');
      expect(result.context.workspaceId).toBe('ws-abc-123');
      expect(result.context.requestId).toBeUndefined();
    }
  });

  it('should parse Authorization with request ID', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
      'x-request-id': 'req-xyz-789',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.callerToken).toBe('test-token-12345');
      expect(result.context.workspaceId).toBeUndefined();
      expect(result.context.requestId).toBe('req-xyz-789');
    }
  });

  it('should parse Authorization with all optional headers', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
      'x-cuan-workspace-id': 'ws-abc-123',
      'x-request-id': 'req-xyz-789',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.callerToken).toBe('test-token-12345');
      expect(result.context.workspaceId).toBe('ws-abc-123');
      expect(result.context.requestId).toBe('req-xyz-789');
    }
  });

  it('should trim whitespace from Authorization token', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: '  Bearer   test-token-12345  ',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.callerToken).toBe('test-token-12345');
    }
  });

  it('should trim whitespace from workspace ID', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
      'x-cuan-workspace-id': '  ws-abc-123  ',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.workspaceId).toBe('ws-abc-123');
    }
  });

  it('should trim whitespace from request ID', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
      'x-request-id': '  req-xyz-789  ',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.requestId).toBe('req-xyz-789');
    }
  });

  it('should reject missing Authorization header', () => {
    const headers: RemoteMcpAuthHeaders = {};

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_AUTHORIZATION');
      expect(result.error.message).toContain('Authorization header is required');
    }
  });

  it('should reject empty Authorization header', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: '',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_AUTHORIZATION');
    }
  });

  it('should reject Authorization without Bearer scheme', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Basic dGVzdDp0ZXN0',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_AUTHORIZATION_FORMAT');
      expect(result.error.message).toContain('Bearer scheme');
    }
  });

  it('should reject Authorization with only Bearer prefix without space', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_AUTHORIZATION_FORMAT');
    }
  });

  it('should reject Authorization with Bearer and only whitespace after trim', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer   ',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    // After trim, "Bearer   " becomes "Bearer" which doesn't start with "Bearer "
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_AUTHORIZATION_FORMAT');
    }
  });

  it('should handle empty workspace ID as undefined', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
      'x-cuan-workspace-id': '',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.workspaceId).toBeUndefined();
    }
  });

  it('should handle empty request ID as undefined', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Bearer test-token-12345',
      'x-request-id': '',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.requestId).toBeUndefined();
    }
  });

  it('should not include token in error messages', () => {
    const headers: RemoteMcpAuthHeaders = {
      authorization: 'Basic secret-token-should-not-appear',
    };

    const result = parseRemoteMcpAuthHeaders(headers);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain('secret-token-should-not-appear');
    }
  });
});

describe('buildCuanInsightCredentialRequestFromRemoteContext', () => {
  const validContext: RemoteMcpRequestContext = {
    callerToken: 'test-token-12345',
    workspaceId: 'ws-abc-123',
    requestId: 'req-xyz-789',
  };

  it('should build request for meta provider', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'meta',
      validContext,
      'act_123456789'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.provider).toBe('meta');
      expect(result.request.accountId).toBe('act_123456789');
      expect(result.request.workspaceId).toBe('ws-abc-123');
      expect(result.request.callerToken).toBe('test-token-12345');
      expect(result.request.requestedScopes).toEqual(['read']);
    }
  });

  it('should build request for tiktok provider', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'tiktok',
      validContext,
      '1234567890123456'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.provider).toBe('tiktok');
      expect(result.request.accountId).toBe('1234567890123456');
      expect(result.request.workspaceId).toBe('ws-abc-123');
      expect(result.request.callerToken).toBe('test-token-12345');
      expect(result.request.requestedScopes).toEqual(['read']);
    }
  });

  it('should build request without account ID', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'meta',
      validContext
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.provider).toBe('meta');
      expect(result.request.accountId).toBeUndefined();
      expect(result.request.workspaceId).toBe('ws-abc-123');
      expect(result.request.callerToken).toBe('test-token-12345');
      expect(result.request.requestedScopes).toEqual(['read']);
    }
  });

  it('should build request without workspace ID', () => {
    const contextWithoutWorkspace: RemoteMcpRequestContext = {
      callerToken: 'test-token-12345',
    };

    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'meta',
      contextWithoutWorkspace,
      'act_123456789'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.provider).toBe('meta');
      expect(result.request.accountId).toBe('act_123456789');
      expect(result.request.workspaceId).toBeUndefined();
      expect(result.request.callerToken).toBe('test-token-12345');
      expect(result.request.requestedScopes).toEqual(['read']);
    }
  });

  it('should build request with params', () => {
    const params = { toolName: 'ads_get_campaigns', limit: 100 };

    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'meta',
      validContext,
      'act_123456789',
      params
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.provider).toBe('meta');
      expect(result.request.accountId).toBe('act_123456789');
      expect(result.request.params).toEqual(params);
      expect(result.request.requestedScopes).toEqual(['read']);
    }
  });

  it('should always use read-only scope', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'meta',
      validContext,
      'act_123456789'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.requestedScopes).toEqual(['read']);
      expect(result.request.requestedScopes).toHaveLength(1);
    }
  });

  it('should reject unsupported provider', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'google',
      validContext,
      'act_123456789'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_PROVIDER');
      expect(result.error.message).toContain('meta');
      expect(result.error.message).toContain('tiktok');
    }
  });

  it('should reject null provider', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      null,
      validContext,
      'act_123456789'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_PROVIDER');
    }
  });

  it('should reject undefined provider', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      undefined,
      validContext,
      'act_123456789'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_PROVIDER');
    }
  });

  it('should reject numeric provider', () => {
    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      123,
      validContext,
      'act_123456789'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_PROVIDER');
    }
  });

  it('should not include token in error output', () => {
    const contextWithSecret: RemoteMcpRequestContext = {
      callerToken: 'secret-token-should-not-appear',
      workspaceId: 'ws-abc-123',
    };

    const result = buildCuanInsightCredentialRequestFromRemoteContext(
      'invalid-provider',
      contextWithSecret
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret-token-should-not-appear');
  });
});

describe('isRemoteMcpAuthErrorCode', () => {
  it('should return true for valid error codes', () => {
    expect(isRemoteMcpAuthErrorCode('MISSING_AUTHORIZATION')).toBe(true);
    expect(isRemoteMcpAuthErrorCode('INVALID_AUTHORIZATION_FORMAT')).toBe(true);
    expect(isRemoteMcpAuthErrorCode('MALFORMED_BEARER_TOKEN')).toBe(true);
    expect(isRemoteMcpAuthErrorCode('UNSUPPORTED_PROVIDER')).toBe(true);
  });

  it('should return false for invalid error codes', () => {
    expect(isRemoteMcpAuthErrorCode('INVALID_CODE')).toBe(false);
    expect(isRemoteMcpAuthErrorCode('missing_authorization')).toBe(false);
    expect(isRemoteMcpAuthErrorCode('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isRemoteMcpAuthErrorCode(null)).toBe(false);
    expect(isRemoteMcpAuthErrorCode(undefined)).toBe(false);
    expect(isRemoteMcpAuthErrorCode(123)).toBe(false);
    expect(isRemoteMcpAuthErrorCode({})).toBe(false);
    expect(isRemoteMcpAuthErrorCode([])).toBe(false);
  });
});
