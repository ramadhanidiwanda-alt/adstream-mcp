import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listThreadsProfiles } from '../src/tools/listThreadsProfiles.js';
import { MetaApiError } from '../src/utils/metaError.js';

function clientWithPageLookup(
  lookup: (pageId: string) => Promise<Record<string, unknown>>
): MetaClient {
  return {
    metaGet: vi.fn().mockResolvedValue({ data: [{ id: 'page_1', name: 'Page One' }] }),
    metaGetObject: vi.fn().mockImplementation(async (path: string) => lookup(path)),
    metaPost: vi.fn(),
    metaDelete: vi.fn(),
  } as unknown as MetaClient;
}

describe('listThreadsProfiles', () => {
  it('reports a permission failure instead of returning a bare empty list', async () => {
    // An empty array previously read as "no Threads profiles exist" when it could
    // equally mean "the token cannot see them".
    const client = clientWithPageLookup(async () => {
      throw new MetaApiError({
        message: '(#200) Requires threads_business_basic permission',
        type: 'OAuthException',
        code: 200,
      });
    });

    const result = await listThreadsProfiles(client, {});

    expect(result.profiles).toEqual([]);
    expect(result.warnings.join(' ')).toContain('threads_business_basic');
  });

  it('returns no warning when the page genuinely has no Threads profile', async () => {
    const client = clientWithPageLookup(async () => ({}));

    const result = await listThreadsProfiles(client, {});

    expect(result.profiles).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
