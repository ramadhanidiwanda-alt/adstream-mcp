import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseOAuthStore } from '../src/mcp/oauthStoreSupabase.js';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('SupabaseOAuthStore — persistent restart cache', () => {
  it('loads persisted token hashes and resolves bearer tokens after restart', async () => {
    const accessToken = 'test-access-token-after-restart';
    const tokenHash = sha256Hex(accessToken);
    const fetchMock = vi.fn(async (url: string | URL) => {
      const pathname = new URL(String(url)).pathname;

      if (pathname.endsWith('/mcp_oauth_clients')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              client_id: 'client_123',
              redirect_uris: ['https://client.example/callback'],
              client_name: 'Test Client',
              grant_types: ['authorization_code'],
              response_types: ['code'],
              token_endpoint_auth_method: 'none',
              scope: 'mcp read write',
              created_at: '2026-06-04T00:00:00.000Z',
            },
          ],
        };
      }

      if (pathname.endsWith('/mcp_oauth_access_tokens')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              token_hash: tokenHash,
              client_id: 'client_123',
              connection_key_id: 'ck_123',
              scope: 'mcp read',
              resource: 'https://mcp.cuaninsight.com',
              expires_at: '2099-06-04T00:00:00.000Z',
              revoked_at: null,
              created_at: '2026-06-04T00:00:00.000Z',
              last_used_at: null,
            },
          ],
        };
      }

      return { ok: true, status: 200, json: async () => [] };
    }) as unknown as typeof fetch;

    const store = new SupabaseOAuthStore({
      supabaseUrl: 'https://supabase.example',
      serviceRoleKey: 'service-role-placeholder',
      fetch: fetchMock,
    });

    await store.loadPersistedData();

    const resolved = store.resolveAccessToken(accessToken);
    expect(resolved).toEqual({
      authType: 'oauth_token',
      accessTokenHash: tokenHash,
      clientId: 'client_123',
      scope: 'mcp read',
      resource: 'https://mcp.cuaninsight.com',
      connectionKeyId: 'ck_123',
    });
  });

  it('lazily hydrates a valid token on cache-miss (multi-replica / missed token)', async () => {
    const accessToken = 'token-never-seen-by-this-replica';
    const tokenHash = sha256Hex(accessToken);

    const fetchMock = vi.fn(async (url: string | URL) => {
      const parsed = new URL(String(url));
      const pathname = parsed.pathname;

      // Empty on startup rehydrate (this replica never issued the token)...
      // ...but a targeted lookup by token_hash finds the valid row.
      if (pathname.endsWith('/mcp_oauth_access_tokens')) {
        const byHash = parsed.searchParams.get('token_hash');
        if (byHash === `eq.${tokenHash}`) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                token_hash: tokenHash,
                client_id: 'client_777',
                connection_key_id: 'ck_777',
                scope: 'mcp read',
                resource: 'https://mcp.cuaninsight.com',
                expires_at: '2099-06-04T00:00:00.000Z',
                revoked_at: null,
                created_at: '2026-06-04T00:00:00.000Z',
                last_used_at: null,
              },
            ],
          };
        }
      }

      return { ok: true, status: 200, json: async () => [] };
    }) as unknown as typeof fetch;

    const store = new SupabaseOAuthStore({
      supabaseUrl: 'https://supabase.example',
      serviceRoleKey: 'service-role-placeholder',
      fetch: fetchMock,
    });

    await store.loadPersistedData();

    // First call misses the cache and returns undefined, but kicks off a
    // background hydrate keyed by token_hash.
    expect(store.resolveAccessToken(accessToken)).toBeUndefined();

    // Allow the background hydrate promise to settle.
    await vi.waitFor(() => {
      expect(store.resolveAccessToken(accessToken)).toEqual({
        authType: 'oauth_token',
        accessTokenHash: tokenHash,
        clientId: 'client_777',
        scope: 'mcp read',
        resource: 'https://mcp.cuaninsight.com',
        connectionKeyId: 'ck_777',
      });
    });
  });
});
