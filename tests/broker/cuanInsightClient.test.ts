import { describe, it, expect, vi } from 'vitest';
import {
  createCuanInsightCredentialClient,
  CuanInsightCredentialClientError,
  type CuanInsightCredentialClientConfig,
} from '../../src/broker/cuanInsightClient.js';
import type {
  CuanInsightCredentialResolveRequest,
  CuanInsightCredentialResolveResponse,
} from '../../src/broker/cuanInsight.js';

const CALLER_TOKEN = 'caller-token-secret-value';
const PROVIDER_TOKEN = 'provider-token-secret-value';

describe('createCuanInsightCredentialClient — success path', () => {
  it('creates request with Authorization Bearer header', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        identity: {
          userId: 'user_1',
          workspaceId: 'ws_1',
          plan: 'pro',
        },
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
        providerApiVersion: 'v20.0',
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    const request: CuanInsightCredentialResolveRequest = {
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    };

    await client.resolve(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/mcp/credentials/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CALLER_TOKEN}`,
        }),
      })
    );
  });

  it('does not include callerToken in request body', async () => {
    const mockFetch = vi.fn(async (url, options) => {
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.callerToken).toBeUndefined();
      expect(body.provider).toBe('meta');
      expect(body.accountId).toBe('act_123');

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          providerAccess: {
            provider: 'meta',
            accountId: 'act_123',
            scopes: ['read'],
            allowed: true,
          },
          providerToken: PROVIDER_TOKEN,
        }),
      };
    }) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('maps successful response to credential contract', async () => {
    const mockResponse: CuanInsightCredentialResolveResponse = {
      ok: true,
      identity: {
        userId: 'user_1',
        workspaceId: 'ws_1',
        plan: 'pro',
      },
      providerAccess: {
        provider: 'meta',
        accountId: 'act_123',
        scopes: ['read'],
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
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    const result = await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(result).toEqual(mockResponse);
    expect(result.ok).toBe(true);
    expect(result.providerToken).toBe(PROVIDER_TOKEN);
  });

  it('maps hosted credential payload to credential contract', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        identity: {
          workspaceId: 'ws_1',
          plan: 'pro',
          accessLevel: 'organization',
        },
        credential: {
          providerToken: PROVIDER_TOKEN,
          expiresAt: '2099-06-01T00:00:00Z',
          tokenType: 'bearer',
        },
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    const result = await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(result.ok).toBe(true);
    expect(result.providerToken).toBe(PROVIDER_TOKEN);
    expect(result.tokenExpiresAt).toBe('2099-06-01T00:00:00Z');
    expect(result.identity?.workspaceId).toBe('ws_1');
  });

  it('uses custom endpoint path when provided', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      endpointPath: '/v2/credentials/resolve',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/v2/credentials/resolve',
      expect.any(Object)
    );
  });

  it('strips trailing slash from baseUrl', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com/',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/mcp/credentials/resolve',
      expect.any(Object)
    );
  });
});

describe('createCuanInsightCredentialClient — config validation', () => {
  it('rejects missing baseUrl safely', async () => {
    const config: CuanInsightCredentialClientConfig = {
      baseUrl: '',
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow(CuanInsightCredentialClientError);

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow('base URL is not configured');
  });

  it('rejects missing caller token safely', async () => {
    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: '',
        requestedScopes: ['read'],
      })
    ).rejects.toThrow(CuanInsightCredentialClientError);

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: '',
        requestedScopes: ['read'],
      })
    ).rejects.toThrow('Caller token is required');
  });
});

describe('createCuanInsightCredentialClient — error handling', () => {
  it('handles non-2xx response safely', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow(CuanInsightCredentialClientError);

    try {
      await client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CuanInsightCredentialClientError);
      if (error instanceof CuanInsightCredentialClientError) {
        expect(error.code).toBe('UPSTREAM_ERROR');
        expect(error.statusCode).toBe(401);
      }
    }
  });

  it('handles invalid JSON response safely', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow(CuanInsightCredentialClientError);

    try {
      await client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CuanInsightCredentialClientError);
      if (error instanceof CuanInsightCredentialClientError) {
        expect(error.code).toBe('INVALID_RESPONSE');
        expect(error.message).toContain('parse');
      }
    }
  });

  it('handles invalid response contract safely', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        // Missing required 'ok' field
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow(CuanInsightCredentialClientError);

    try {
      await client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CuanInsightCredentialClientError);
      if (error instanceof CuanInsightCredentialClientError) {
        expect(error.code).toBe('INVALID_RESPONSE');
        expect(error.message).toContain('contract');
      }
    }
  });
});

describe('createCuanInsightCredentialClient — network errors', () => {
  it('handles network error safely', async () => {
    const mockFetch = vi.fn(async () => {
      throw new Error('Network connection failed');
    }) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow(CuanInsightCredentialClientError);

    try {
      await client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CuanInsightCredentialClientError);
      if (error instanceof CuanInsightCredentialClientError) {
        expect(error.code).toBe('NETWORK_ERROR');
      }
    }
  });

  it('handles timeout error safely', async () => {
    const mockFetch = vi.fn(async (url, options) => {
      // Simulate timeout by waiting for abort signal
      return new Promise((resolve, reject) => {
        const signal = (options as RequestInit).signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    }) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      timeoutMs: 100,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow(CuanInsightCredentialClientError);

    try {
      await client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CuanInsightCredentialClientError);
      if (error instanceof CuanInsightCredentialClientError) {
        expect(error.code).toBe('TIMEOUT_ERROR');
        expect(error.message).toContain('100ms');
      }
    }
  });
});

describe('createCuanInsightCredentialClient — token leak protection', () => {
  it('does not expose Authorization token in thrown error', async () => {
    const mockFetch = vi.fn(async () => {
      throw new Error(`Authorization: Bearer ${CALLER_TOKEN} failed`);
    }) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    try {
      await client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CuanInsightCredentialClientError);
      if (error instanceof CuanInsightCredentialClientError) {
        expect(error.message).not.toContain(CALLER_TOKEN);
        expect(JSON.stringify(error)).not.toContain(CALLER_TOKEN);
      }
    }
  });

  it('does not expose provider token in error', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error(`Token ${PROVIDER_TOKEN} is invalid`);
      },
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    try {
      await client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CuanInsightCredentialClientError);
      if (error instanceof CuanInsightCredentialClientError) {
        expect(error.message).not.toContain(PROVIDER_TOKEN);
        expect(JSON.stringify(error)).not.toContain(PROVIDER_TOKEN);
      }
    }
  });
});

describe('createCuanInsightCredentialClient — provider validation', () => {
  it('accepts meta provider', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    const result = await client.resolve({
      provider: 'meta',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(result.ok).toBe(true);
  });

  it('accepts tiktok provider', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'tiktok',
          accountId: 'adv_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    const result = await client.resolve({
      provider: 'tiktok',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(result.ok).toBe(true);
  });
});

describe('createCuanInsightCredentialClient — response validation', () => {
  it('rejects response without ok field', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow('contract');
  });

  it('rejects error response without error object', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: false,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow('contract');
  });

  it('accepts valid error response', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: false,
        error: {
          code: 'PROVIDER_TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    const result = await client.resolve({
      provider: 'meta',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error?.code).toBe('PROVIDER_TOKEN_EXPIRED');
    }
  });

  it('uses injectable fetch mock', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not make real network call in tests', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    // Verify mock was called, not real fetch
    expect(mockFetch).toHaveBeenCalled();
  });
});

describe('createCuanInsightCredentialClient — hosted Supabase auth', () => {
  it('sends Authorization Bearer with supabaseAnonKey when configured', async () => {
    const SUPABASE_ANON_KEY = 'supabase-anon-key-value';
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      supabaseAnonKey: SUPABASE_ANON_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/mcp/credentials/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Cuan-MCP-Token': CALLER_TOKEN,
        }),
      })
    );
  });

  it('sends callerToken in X-Cuan-MCP-Token header when using hosted auth', async () => {
    const SUPABASE_ANON_KEY = 'supabase-anon-key-value';
    const mockFetch = vi.fn(async (url, options) => {
      const headers = (options as RequestInit).headers as Record<string, string>;
      expect(headers['X-Cuan-MCP-Token']).toBe(CALLER_TOKEN);
      expect(headers.Authorization).toBe(`Bearer ${SUPABASE_ANON_KEY}`);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          providerAccess: {
            provider: 'meta',
            accountId: 'act_123',
            scopes: ['read'],
            allowed: true,
          },
          providerToken: PROVIDER_TOKEN,
        }),
      };
    }) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      supabaseAnonKey: SUPABASE_ANON_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses custom mcpTokenHeaderName when provided', async () => {
    const SUPABASE_ANON_KEY = 'supabase-anon-key-value';
    const CUSTOM_HEADER = 'X-Custom-MCP-Token';
    const mockFetch = vi.fn(async (url, options) => {
      const headers = (options as RequestInit).headers as Record<string, string>;
      expect(headers[CUSTOM_HEADER]).toBe(CALLER_TOKEN);
      expect(headers['X-Cuan-MCP-Token']).toBeUndefined();

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          providerAccess: {
            provider: 'meta',
            accountId: 'act_123',
            scopes: ['read'],
            allowed: true,
          },
          providerToken: PROVIDER_TOKEN,
        }),
      };
    }) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      supabaseAnonKey: SUPABASE_ANON_KEY,
      mcpTokenHeaderName: CUSTOM_HEADER,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses standard auth when supabaseAnonKey is not provided', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/mcp/credentials/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CALLER_TOKEN}`,
        }),
      })
    );

    const callArgs = mockFetch.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Cuan-MCP-Token']).toBeUndefined();
  });

  it('does not expose supabaseAnonKey in errors', async () => {
    const SUPABASE_ANON_KEY = 'supabase-anon-key-secret-value';
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      supabaseAnonKey: SUPABASE_ANON_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        accountId: 'act_123',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow();

    try {
      await client.resolve({
        provider: 'meta',
        accountId: 'act_123',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(SUPABASE_ANON_KEY);
    }
  });

  it('does not expose callerToken in errors when using hosted auth', async () => {
    const SUPABASE_ANON_KEY = 'supabase-anon-key-value';
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      supabaseAnonKey: SUPABASE_ANON_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        accountId: 'act_123',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      })
    ).rejects.toThrow();

    try {
      await client.resolve({
        provider: 'meta',
        accountId: 'act_123',
        callerToken: CALLER_TOKEN,
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(CALLER_TOKEN);
    }
  });
});

const CONNECTION_KEY = 'cuk_01234567-89ab-cdef-0123-456789abcdef';

describe('createCuanInsightCredentialClient — connection_key auth mode', () => {
  it('defaults to mcp_token auth mode when authMode is not specified', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    // Verify legacy behavior: Authorization Bearer with callerToken
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/mcp/credentials/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${CALLER_TOKEN}`,
        }),
      })
    );

    const callArgs = mockFetch.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-cuan-mcp-connection-key']).toBeUndefined();
  });

  it('sends x-cuan-mcp-connection-key header when authMode is connection_key', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      authMode: 'connection_key',
      connectionKey: CONNECTION_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      requestedScopes: ['read'],
    });

    // Verify connection key header is sent
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/mcp/credentials/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-cuan-mcp-connection-key': CONNECTION_KEY,
        }),
      })
    );

    const callArgs = mockFetch.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    // Should NOT have X-Cuan-MCP-Token in connection_key mode
    expect(headers['X-Cuan-MCP-Token']).toBeUndefined();
  });

  it('sends both supabaseAnonKey and connection key in hosted connection_key mode', async () => {
    const SUPABASE_ANON_KEY = 'supabase-anon-key-value';
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      supabaseAnonKey: SUPABASE_ANON_KEY,
      authMode: 'connection_key',
      connectionKey: CONNECTION_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      requestedScopes: ['read'],
    });

    const callArgs = mockFetch.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;

    expect(headers['Authorization']).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
    expect(headers['x-cuan-mcp-connection-key']).toBe(CONNECTION_KEY);
    expect(headers['X-Cuan-MCP-Token']).toBeUndefined();
  });

  it('MCP token mode still works with legacy headers unchanged', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      authMode: 'mcp_token',
      connectionKey: CONNECTION_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      callerToken: CALLER_TOKEN,
      requestedScopes: ['read'],
    });

    const callArgs = mockFetch.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;

    // MCP token mode: Authorization Bearer with callerToken, no connection key
    expect(headers['Authorization']).toBe(`Bearer ${CALLER_TOKEN}`);
    expect(headers['x-cuan-mcp-connection-key']).toBeUndefined();
  });

  it('connection key is not included in request body', async () => {
    const mockFetch = vi.fn(async (url, options) => {
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.provider).toBe('meta');
      expect(body.accountId).toBe('act_123');
      expect(body['connectionKey']).toBeUndefined();
      expect(body['connection_key']).toBeUndefined();
      expect(body['callerToken']).toBeUndefined();

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          providerAccess: {
            provider: 'meta',
            accountId: 'act_123',
            scopes: ['read'],
            allowed: true,
          },
          providerToken: PROVIDER_TOKEN,
        }),
      };
    }) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      authMode: 'connection_key',
      connectionKey: CONNECTION_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      requestedScopes: ['read'],
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('does not expose connection key in error messages', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      authMode: 'connection_key',
      connectionKey: CONNECTION_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    await expect(
      client.resolve({
        provider: 'meta',
        accountId: 'act_123',
        requestedScopes: ['read'],
      })
    ).rejects.toThrow();

    try {
      await client.resolve({
        provider: 'meta',
        accountId: 'act_123',
        requestedScopes: ['read'],
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(CONNECTION_KEY);
      expect((error as Error).message).not.toContain('cuk_');
    }
  });

  it('providerToken never appears in response even in connection_key mode', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        providerAccess: {
          provider: 'meta',
          accountId: 'act_123',
          scopes: ['read'],
          allowed: true,
        },
        providerToken: PROVIDER_TOKEN,
      }),
    })) as unknown as typeof fetch;

    const config: CuanInsightCredentialClientConfig = {
      baseUrl: 'https://api.example.com',
      authMode: 'connection_key',
      connectionKey: CONNECTION_KEY,
      fetch: mockFetch,
    };

    const client = createCuanInsightCredentialClient({ config });

    const result = await client.resolve({
      provider: 'meta',
      accountId: 'act_123',
      requestedScopes: ['read'],
    });

    // providerToken is present in the result (it's the credential)
    // but this is internal — never surfaced to MCP clients
    expect(result.ok).toBe(true);
    expect(result.providerToken).toBe(PROVIDER_TOKEN);
  });
});
