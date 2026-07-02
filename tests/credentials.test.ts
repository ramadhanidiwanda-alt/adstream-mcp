import { afterEach, describe, expect, it } from 'vitest';
import {
  CuanInsightCredentialProvider,
  CredentialResolver,
  EnvCredentialProvider,
  redactErrorMessage,
  redactTokenLikeValues,
} from '../src/broker/credentials.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('EnvCredentialProvider', () => {
  it('resolves Meta credentials from env', async () => {
    process.env.META_ACCESS_TOKEN = 'meta-token-secret';
    process.env.META_AD_ACCOUNT_ID = 'act_123';
    process.env.META_API_VERSION = 'v20.0';

    const provider = new EnvCredentialProvider();
    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected credential result');
    expect(result.credential).toMatchObject({
      provider: 'meta',
      accessToken: 'meta-token-secret',
      accountId: 'act_123',
      apiVersion: 'v20.0',
      source: 'env',
    });
  });

  it('resolves TikTok credentials from env', async () => {
    process.env.TIKTOK_ACCESS_TOKEN = 'tiktok-token-secret';
    process.env.TIKTOK_ADVERTISER_ID = 'advertiser_123';
    process.env.TIKTOK_API_VERSION = 'v1.3';

    const provider = new EnvCredentialProvider();
    const result = await provider.resolve({ provider: 'tiktok' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected credential result');
    expect(result.credential).toMatchObject({
      provider: 'tiktok',
      accessToken: 'tiktok-token-secret',
      accountId: 'advertiser_123',
      apiVersion: 'v1.3',
      source: 'env',
    });
  });

  it('returns safe missing-env error without token values', async () => {
    process.env.META_ACCESS_TOKEN = 'meta-token-secret';
    delete process.env.META_AD_ACCOUNT_ID;

    const provider = new EnvCredentialProvider();
    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.message).toContain('Missing required environment credentials');
    expect(result.error.message).not.toContain('meta-token-secret');
  });
});

describe('CuanInsightCredentialProvider', () => {
  it('returns safe error when client is not configured', async () => {
    const provider = new CuanInsightCredentialProvider();
    const result = await provider.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.message).toBe('Cuan Insight credential client is not configured');
  });
});

describe('CredentialResolver', () => {
  it('does not fallback to env in remote mode', async () => {
    process.env.META_ACCESS_TOKEN = 'meta-token-secret';
    process.env.META_AD_ACCOUNT_ID = 'act_123';

    const resolver = new CredentialResolver({ mode: 'remote' });
    const result = await resolver.resolve({ provider: 'meta' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.message).toBe('Cuan Insight credential client is not configured');
    expect(JSON.stringify(result)).not.toContain('meta-token-secret');
  });

  it('returns missing env credentials for supported Google provider without env', async () => {
    const resolver = new CredentialResolver({ mode: 'local' });
    const result = await resolver.resolve({ provider: 'google' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.error.code).toBe('MISSING_ENV_CREDENTIALS');
  });
});

describe('credential redaction utilities', () => {
  it('masks raw access tokens and token-bearing objects', () => {
    const redacted = redactTokenLikeValues({
      accessToken: 'raw_access_token_secret',
      nested: { token: 'nested_token_secret' },
      safe: 'campaign_name',
    });

    expect(redacted).toEqual({
      accessToken: '[REDACTED]',
      nested: { token: '[REDACTED]' },
      safe: 'campaign_name',
    });
  });

  it('masks bearer tokens and token query params', () => {
    const message = 'Authorization: Bearer bearer-secret access_token=query-secret&appsecret_proof=proof-secret';
    const redacted = redactErrorMessage(message);

    expect(redacted).toContain('Authorization: Bearer [REDACTED]');
    expect(redacted).toContain('access_token=[REDACTED]');
    expect(redacted).toContain('appsecret_proof=[REDACTED]');
    expect(redacted).not.toContain('bearer-secret');
    expect(redacted).not.toContain('query-secret');
    expect(redacted).not.toContain('proof-secret');
  });

  it('keeps safe errors free from known token values', () => {
    const token = 'known-token-secret';
    const redacted = redactErrorMessage(`Provider failed with ${token} and access_token=${token}`);

    expect(redacted).not.toContain(token);
  });
});

describe('connection key redaction (Phase 17.5C)', () => {
  it('masks x-cuan-mcp-connection-key header in error messages', () => {
    const message = 'Request failed with x-cuan-mcp-connection-key: cuk_leaked-key-value-12345';
    const redacted = redactErrorMessage(message);

    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('cuk_leaked-key-value-12345');
    expect(redacted).not.toContain('cuk_');
  });

  it('masks connectionKey field in structured objects', () => {
    const redacted = redactTokenLikeValues({
      connectionKey: 'cuk_object-key-789',
      safe: 'campaign_name',
    });

    expect(redacted).toEqual({
      connectionKey: '[REDACTED]',
      safe: 'campaign_name',
    });
  });

  it('masks connection_key field in structured objects', () => {
    const redacted = redactTokenLikeValues({
      connection_key: 'cuk_snake-key-456',
      safe: 'another_field',
    });

    expect(redacted).toEqual({
      connection_key: '[REDACTED]',
      safe: 'another_field',
    });
  });

  it('masks connection-key field in structured objects', () => {
    const redacted = redactTokenLikeValues({
      'connection-key': 'cuk_dash-key-012',
      safe: 'normal_field',
    });

    expect(redacted).toEqual({
      'connection-key': '[REDACTED]',
      safe: 'normal_field',
    });
  });

  it('masks connection key in assignment-style strings', () => {
    const message = 'Config has connection_key: cuk_assign-key-345 for provider';
    const redacted = redactErrorMessage(message);

    expect(redacted).toContain('connection_key: [REDACTED]');
    expect(redacted).not.toContain('cuk_assign-key-345');
  });
});
