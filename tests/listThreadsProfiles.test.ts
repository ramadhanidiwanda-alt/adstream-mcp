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

function clientWithPages(
  pages: Array<{ id: string; name: string }>,
  lookup: (pageId: string) => Promise<Record<string, unknown>>
): MetaClient {
  return {
    metaGet: vi.fn().mockResolvedValue({ data: pages }),
    metaGetObject: vi.fn().mockImplementation(async (path: string) => lookup(path)),
    metaPost: vi.fn(),
    metaDelete: vi.fn(),
  } as unknown as MetaClient;
}

function permissionError(): MetaApiError {
  return new MetaApiError({
    message: '(#200) Requires threads_business_basic permission',
    type: 'OAuthException',
    code: 200,
  });
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

  it('collapses a missing scope across many pages into exactly one warning', async () => {
    const pages = [
      { id: 'page_1', name: 'Page One' },
      { id: 'page_2', name: 'Page Two' },
      { id: 'page_3', name: 'Page Three' },
    ];
    const client = clientWithPages(pages, async () => {
      throw permissionError();
    });

    const result = await listThreadsProfiles(client, {});

    expect(result.profiles).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('keeps absence and permission failures distinguishable when both occur in one call', async () => {
    const pages = [
      { id: 'page_1', name: 'Page One' },
      { id: 'page_2', name: 'Page Two' },
      { id: 'page_3', name: 'Page Three' },
    ];
    const client = clientWithPages(pages, async (path: string) => {
      if (path === '/page_1') {
        return { threads_profile: { id: 'threads_1', username: 'brandone', name: 'Brand One' } };
      }
      if (path === '/page_2') {
        // Genuine absence: no threads_profile at all.
        return {};
      }
      throw permissionError();
    });

    const result = await listThreadsProfiles(client, {});

    expect(result.profiles).toEqual([
      {
        threadsId: 'threads_1',
        username: 'brandone',
        name: 'Brand One',
        pageId: 'page_1',
        pageName: 'Page One',
      },
    ]);
    expect(result.warnings).toHaveLength(1);
  });

  it('warns when the permission cause surfaces only in userMessage, not message', async () => {
    const client = clientWithPageLookup(async () => {
      throw new MetaApiError({
        message: 'An unknown error occurred',
        type: 'FacebookApiException',
        code: 1,
        error_user_msg: 'You do not have permission to view threads_business_basic data.',
      });
    });

    const result = await listThreadsProfiles(client, {});

    expect(result.profiles).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});
