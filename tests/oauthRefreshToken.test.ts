import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { MemoryOAuthStore } from '../src/mcp/oauthStore.js';
import { SupabaseOAuthStore } from '../src/mcp/oauthStoreSupabase.js';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('MemoryOAuthStore — refresh tokens', () => {
  it('issues and redeems a refresh token, rotating it (single-use)', () => {
    const store = new MemoryOAuthStore({ refreshTokenTtlMs: 60_000 });

    const { refreshToken, expiresIn } = store.createRefreshToken({
      connectionKey: 'ck-raw',
      scope: 'mcp read',
      clientId: 'client-a',
    });
    expect(refreshToken).toBeTruthy();
    expect(expiresIn).toBe(60);

    const redeemed = store.redeemRefreshToken(refreshToken, 'client-a');
    expect(redeemed).toMatchObject({
      connectionKey: 'ck-raw',
      scope: 'mcp read',
      clientId: 'client-a',
    });

    // Single-use: second redeem fails.
    expect(store.redeemRefreshToken(refreshToken, 'client-a')).toBeUndefined();
  });

  it('rejects redeem for a mismatched client_id', () => {
    const store = new MemoryOAuthStore();
    const { refreshToken } = store.createRefreshToken({
      connectionKey: 'ck-raw',
      scope: 'mcp read',
      clientId: 'client-a',
    });
    expect(store.redeemRefreshToken(refreshToken, 'client-b')).toBeUndefined();
  });

  it('rejects an expired refresh token', () => {
    const store = new MemoryOAuthStore({ refreshTokenTtlMs: -1 });
    const { refreshToken } = store.createRefreshToken({
      connectionKey: 'ck-raw',
      scope: 'mcp read',
      clientId: 'client-a',
    });
    expect(store.redeemRefreshToken(refreshToken, 'client-a')).toBeUndefined();
  });

  it('revokes a refresh token', () => {
    const store = new MemoryOAuthStore();
    const { refreshToken } = store.createRefreshToken({
      connectionKey: 'ck-raw',
      scope: 'mcp read',
      clientId: 'client-a',
    });
    expect(store.revokeRefreshToken(refreshToken)).toBe(true);
    expect(store.redeemRefreshToken(refreshToken, 'client-a')).toBeUndefined();
  });
});

describe('SupabaseOAuthStore — refresh tokens', () => {
  it('persists a refresh token and lazily hydrates it on cache-miss', async () => {
    const captured: Array<Record<string, unknown>> = [];
    let persistedRow: Record<string, unknown> | undefined;

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const parsed = new URL(String(url));
      const pathname = parsed.pathname;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (pathname.endsWith('/mcp_oauth_refresh_tokens')) {
        if (method === 'POST') {
          persistedRow = JSON.parse(String(init?.body)) as Record<string, unknown>;
          captured.push(persistedRow);
          return { ok: true, status: 201, json: async () => [persistedRow] };
        }
        if (method === 'GET') {
          const byHash = parsed.searchParams.get('token_hash');
          if (
            persistedRow &&
            byHash === `eq.${persistedRow.token_hash as string}`
          ) {
            return {
              ok: true,
              status: 200,
              json: async () => [
                {
                  ...persistedRow,
                  revoked_at: null,
                  created_at: '2026-07-06T00:00:00.000Z',
                },
              ],
            };
          }
          return { ok: true, status: 200, json: async () => [] };
        }
      }

      return { ok: true, status: 200, json: async () => [] };
    }) as unknown as typeof fetch;

    // Writer store issues + persists the refresh token.
    const writer = new SupabaseOAuthStore({
      supabaseUrl: 'https://supabase.example',
      serviceRoleKey: 'srk',
      fetch: fetchMock,
    });

    const { refreshToken } = writer.createRefreshToken({
      connectionKeyId: 'ck-uuid-1',
      scope: 'mcp read',
      clientId: 'client-a',
      resource: 'https://mcp.example',
    });
    expect(persistedRow?.connection_key_id).toBe('ck-uuid-1');

    // A fresh replica that never saw the token: first redeem misses cache,
    // triggers background hydrate, then succeeds on retry.
    const replica = new SupabaseOAuthStore({
      supabaseUrl: 'https://supabase.example',
      serviceRoleKey: 'srk',
      fetch: fetchMock,
    });

    expect(replica.redeemRefreshToken(refreshToken, 'client-a')).toBeUndefined();

    await vi.waitFor(() => {
      const result = replica.redeemRefreshToken(refreshToken, 'client-a');
      expect(result).toMatchObject({
        connectionKeyId: 'ck-uuid-1',
        scope: 'mcp read',
        clientId: 'client-a',
      });
    });
  });
});
