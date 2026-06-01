import { describe, expect, it, vi } from 'vitest';
import {
  CredentialResolver,
  CuanInsightCredentialProvider,
} from '../src/broker/credentials.js';
import type {
  CuanInsightCredentialClient,
  CuanInsightCredentialResolveResponse,
} from '../src/broker/cuanInsight.js';

const PROVIDER_TOKEN = 'provider-token-secret-value';
const CALLER_TOKEN = 'caller-token-secret-value';

function buildClient(
  response:
    | CuanInsightCredentialResolveResponse
    | ((req: unknown) => Promise<CuanInsightCredentialResolveResponse>)
): CuanInsightCredentialClient {
  return {
    resolve: typeof response === 'function' ? response : async () => response,
  };
}

describe('CuanInsightCredentialProvider — success path', () => {
  it('resolves Meta credentials through the contract client', async () => {
    const resolve = vi.fn(async () => ({
      ok: true,
      identity: {
        userId: 'user_1',
        workspaceId: 'ws_1',
        plan: 'pro',
      },
      providerAccess: {
        provider: 'meta' as const,
        accountId: 'act_999',
        accountName: 'Demo Account',
        scopes: ['read'] as const,
        allowed: true,
      },
      providerToken: PROVIDER_TOKEN,
      providerApiVersion: 'v20.0',
      tokenExpiresAt: '2099-06-01T00:00:00Z',
      planLimits: {
        plan: 'pro',
        dailyRequestQuota: 1000,
        remainingRequests: 950,
      },
    }));

    const provider = new CuanInsightCredentialProvider(buildClient(resolve), {
      callerToken: CALLER_TOKEN,
      workspaceId: 'ws_1',
    });

    const result = await provider.resolve({
      provider: 'meta',
      accountId: 'act_999',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    expect(result.credential).toMatchObject({
      provider: 'meta',
      accessToken: PROVIDER_TOKEN,
      accountId: 'act_999',
      apiVersion: 'v20.0',
      source: 'cuan_insight',
    });

    expect(result.meta).toMatchObject({
      identity: { userId: 'user_1', workspaceId: 'ws_1', plan: 'pro' },
      providerAccess: {
        provider: 'meta',
        accountId: 'act_999',
        allowed: true,
      },
      planLimits: { plan: 'pro', dailyRequestQuota: 1000 },
      tokenExpiresAt: '2099-06-01T00:00:00Z',
    });

    expect(resolve).toHaveBeenCalledWith({
      provider: 'meta',
      accountId: 'act_999',
      workspaceId: 'ws_1',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
      params: undefined,
    });
  });
});

describe('CuanInsightCredentialProvider — provider safety', () => {
  it('rejects providers outside meta/tiktok before calling the client', async () => {
    const resolve = vi.fn();
    const provider = new CuanInsightCredentialProvider(
      buildClient(resolve as never)
    );

    const result = await provider.resolve({ provider: 'google' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('UNSUPPORTED_PROVIDER');
    expect(result.error.message).toBe('Unsupported ads provider');
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('CuanInsightCredentialProvider — safe error mapping', () => {
  it('returns PROVIDER_TOKEN_EXPIRED for expired tokens', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: false,
        error: {
          code: 'PROVIDER_TOKEN_EXPIRED',
          message: 'Provider token has expired',
        },
      })
    );

    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('PROVIDER_TOKEN_EXPIRED');
    expect(result.error.provider).toBe('meta');
    expect(result.error.message).toBe('Provider token has expired');
  });

  it('returns ACCOUNT_NOT_ALLOWED when access entry is denied', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_blocked',
          scopes: ['read'],
          allowed: false,
        },
        providerToken: PROVIDER_TOKEN,
      })
    );

    const result = await provider.resolve({
      provider: 'meta',
      accountId: 'act_blocked',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('ACCOUNT_NOT_ALLOWED');
    expect(JSON.stringify(result)).not.toContain(PROVIDER_TOKEN);
  });

  it('returns ACCOUNT_NOT_ALLOWED when resolved account differs from requested account', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_allowed',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      })
    );

    const result = await provider.resolve({
      provider: 'meta',
      accountId: 'act_requested',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('ACCOUNT_NOT_ALLOWED');
    expect(JSON.stringify(result)).not.toContain(PROVIDER_TOKEN);
  });

  it('returns ACCOUNT_NOT_ALLOWED when provider access is for a different provider', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: true,
        providerAccess: {
          provider: 'tiktok',
          accountId: 'tt_1',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      })
    );

    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('ACCOUNT_NOT_ALLOWED');
  });

  it('returns PROVIDER_TOKEN_MISSING when no token is present', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_1',
          scopes: ['read'],
          allowed: true,
        },
      })
    );

    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('PROVIDER_TOKEN_MISSING');
  });

  it('returns safe error for expired provider token in success response', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_1',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
        tokenExpiresAt: '2000-01-01T00:00:00Z',
      })
    );

    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('PROVIDER_TOKEN_EXPIRED');
    expect(JSON.stringify(result)).not.toContain(PROVIDER_TOKEN);
  });

  it('falls back to INTERNAL_ERROR for unknown error codes', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: false,
        error: {
          code: 'NOT_A_REAL_CODE' as never,
          message: 'something went wrong',
        },
      })
    );

    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('CuanInsightCredentialProvider — token leak protection', () => {
  it('does not leak provider tokens in client error messages', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient(async () => {
        throw new Error(
          `Upstream failed: access_token=${PROVIDER_TOKEN} Authorization: Bearer ${PROVIDER_TOKEN}`
        );
      })
    );

    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.message).not.toContain(PROVIDER_TOKEN);
    expect(JSON.stringify(result)).not.toContain(PROVIDER_TOKEN);
  });

  it('does not leak tokens echoed back in error messages from Cuan Insight', async () => {
    const provider = new CuanInsightCredentialProvider(
      buildClient({
        ok: false,
        error: {
          code: 'PROVIDER_TOKEN_EXPIRED',
          message: `Token ${PROVIDER_TOKEN} has expired`,
        },
      })
    );

    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.message).not.toContain(PROVIDER_TOKEN);
  });
});

describe('CredentialResolver — remote mode', () => {
  it('uses the Cuan Insight provider when configured and never falls back to env', async () => {
    process.env.META_ACCESS_TOKEN = 'env-token-should-not-be-used';
    process.env.META_AD_ACCOUNT_ID = 'act_env';

    const cuanInsightProvider = new CuanInsightCredentialProvider(
      buildClient({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_remote',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
        providerApiVersion: 'v20.0',
      })
    );

    const resolver = new CredentialResolver({
      mode: 'remote',
      cuanInsightProvider,
    });

    const result = await resolver.resolve({
      provider: 'meta',
      accountId: 'act_remote',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.credential.source).toBe('cuan_insight');
    expect(result.credential.accountId).toBe('act_remote');
    expect(result.credential.accessToken).toBe(PROVIDER_TOKEN);

    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
  });

  it('still does not fall back to env when the Cuan Insight client errors', async () => {
    process.env.META_ACCESS_TOKEN = 'env-token-should-not-be-used';
    process.env.META_AD_ACCOUNT_ID = 'act_env';

    const cuanInsightProvider = new CuanInsightCredentialProvider(
      buildClient({
        ok: false,
        error: {
          code: 'PROVIDER_TOKEN_EXPIRED',
          message: 'expired',
        },
      })
    );

    const resolver = new CredentialResolver({
      mode: 'remote',
      cuanInsightProvider,
    });

    const result = await resolver.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('PROVIDER_TOKEN_EXPIRED');
    expect(JSON.stringify(result)).not.toContain('env-token-should-not-be-used');

    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
  });
});
