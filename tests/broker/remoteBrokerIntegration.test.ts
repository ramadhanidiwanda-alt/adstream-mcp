import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AdsBroker } from '../../src/broker/AdsBroker.js';
import { CredentialResolver, CuanInsightCredentialProvider } from '../../src/broker/credentials.js';
import { createDefaultProviderRegistry } from '../../src/broker/factory.js';
import type { CuanInsightCredentialClient, CuanInsightCredentialResolveResponse } from '../../src/broker/cuanInsight.js';

const PROVIDER_TOKEN = 'provider-token-secret-value';
const CALLER_TOKEN = 'caller-token-secret-value';

function buildMockClient(
  response: CuanInsightCredentialResolveResponse
): CuanInsightCredentialClient {
  return {
    resolve: async () => response,
  };
}

describe('Remote broker integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves credentials through mock Cuan Insight client', async () => {
    const mockClient = buildMockClient({
      ok: true,
      providerAccess: {
        provider: 'meta',
        accountId: 'act_123',
        scopes: ['read'],
        allowed: true,
      },
      providerToken: PROVIDER_TOKEN,
      providerApiVersion: 'v20.0',
    });

    const broker = new AdsBroker({
      providerRegistry: createDefaultProviderRegistry(),
      credentialResolver: new CredentialResolver({
        mode: 'remote',
        cuanInsightProvider: new CuanInsightCredentialProvider(mockClient, {
          callerToken: CALLER_TOKEN,
        }),
      }),
    });

    // This will fail at the Meta API call level (no real token), but proves
    // the credential resolution path works
    const result = await broker.listAccounts({ provider: 'meta' });

    // We expect an error from Meta API, not from credential resolution
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should be a Meta API error, not a credential error
      expect(result.errors?.[0]?.code).not.toBe('MISSING_ENV_CREDENTIALS');
      expect(result.errors?.[0]?.code).not.toBe('PROVIDER_TOKEN_EXPIRED');
    }
  });

  it('never falls back to ENV in remote mode', async () => {
    process.env.META_ACCESS_TOKEN = 'env-token-should-not-be-used';
    process.env.META_AD_ACCOUNT_ID = 'act_env';

    const mockClient = buildMockClient({
      ok: false,
      error: {
        code: 'PROVIDER_TOKEN_EXPIRED',
        message: 'Token has expired',
      },
    });

    const broker = new AdsBroker({
      providerRegistry: createDefaultProviderRegistry(),
      credentialResolver: new CredentialResolver({
        mode: 'remote',
        cuanInsightProvider: new CuanInsightCredentialProvider(mockClient, {
          callerToken: CALLER_TOKEN,
        }),
      }),
    });

    const result = await broker.listAccounts({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors?.[0]?.code).toBe('PROVIDER_TOKEN_EXPIRED');
      // Ensure ENV token is never used
      expect(JSON.stringify(result)).not.toContain('env-token-should-not-be-used');
    }
  });

  it('handles Cuan Insight account not allowed error', async () => {
    const mockClient = buildMockClient({
      ok: true,
      providerAccess: {
        provider: 'meta',
        accountId: 'act_blocked',
        scopes: ['read'],
        allowed: false,
      },
      providerToken: PROVIDER_TOKEN,
    });

    const broker = new AdsBroker({
      providerRegistry: createDefaultProviderRegistry(),
      credentialResolver: new CredentialResolver({
        mode: 'remote',
        cuanInsightProvider: new CuanInsightCredentialProvider(mockClient, {
          callerToken: CALLER_TOKEN,
        }),
      }),
    });

    const result = await broker.listAccounts({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors?.[0]?.code).toBe('ACCOUNT_NOT_ALLOWED');
      // Ensure provider token is never leaked
      expect(JSON.stringify(result)).not.toContain(PROVIDER_TOKEN);
    }
  });

  it('does not leak tokens in error responses', async () => {
    const mockClient = buildMockClient({
      ok: false,
      error: {
        code: 'PROVIDER_TOKEN_EXPIRED',
        message: `Token ${PROVIDER_TOKEN} has expired`,
      },
    });

    const broker = new AdsBroker({
      providerRegistry: createDefaultProviderRegistry(),
      credentialResolver: new CredentialResolver({
        mode: 'remote',
        cuanInsightProvider: new CuanInsightCredentialProvider(mockClient, {
          callerToken: CALLER_TOKEN,
        }),
      }),
    });

    const result = await broker.listAccounts({ provider: 'meta' });

    expect(result.ok).toBe(false);
    // Ensure tokens are redacted
    expect(JSON.stringify(result)).not.toContain(PROVIDER_TOKEN);
    expect(JSON.stringify(result)).not.toContain(CALLER_TOKEN);
  });

  it('works with TikTok provider', async () => {
    const mockClient = buildMockClient({
      ok: true,
      providerAccess: {
        provider: 'tiktok',
        accountId: 'adv_123',
        scopes: ['read'],
        allowed: true,
      },
      providerToken: PROVIDER_TOKEN,
      providerApiVersion: 'v1.3',
    });

    const broker = new AdsBroker({
      providerRegistry: createDefaultProviderRegistry(),
      credentialResolver: new CredentialResolver({
        mode: 'remote',
        cuanInsightProvider: new CuanInsightCredentialProvider(mockClient, {
          callerToken: CALLER_TOKEN,
        }),
      }),
    });

    const result = await broker.listAccounts({ provider: 'tiktok' });

    // Should fail at TikTok API level, not credential resolution
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors?.[0]?.code).not.toBe('MISSING_ENV_CREDENTIALS');
    }
  });
});
