import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listInstagramAccounts } from '../src/tools/listInstagramAccounts.js';
import { listThreadsProfiles } from '../src/tools/listThreadsProfiles.js';

function createMockClient(): MetaClient {
  return {
    metaGet: vi.fn().mockResolvedValue({
      data: [
        { id: 'page_1', name: 'Page One' },
        { id: 'page_2', name: 'Page Two' },
      ],
    }),
    metaGetObject: vi.fn()
      .mockResolvedValueOnce({ instagram_business_account: { id: 'ig_1', username: 'brandone', name: 'Brand One' } })
      .mockResolvedValueOnce({}),
  } as unknown as MetaClient;
}

describe('social account discovery tools', () => {
  it('lists Instagram Business Accounts connected to managed Pages', async () => {
    const client = createMockClient();

    const accounts = await listInstagramAccounts(client);

    expect(accounts).toEqual([{ igId: 'ig_1', username: 'brandone', name: 'Brand One', pageId: 'page_1', pageName: 'Page One' }]);
    expect(client.metaGetObject).toHaveBeenCalledWith('/page_1', {
      fields: 'instagram_business_account{id,username,name,profile_picture_url}',
    });
  });

  it('lists Threads profiles connected to managed Pages', async () => {
    const client = {
      metaGet: vi.fn().mockResolvedValue({ data: [{ id: 'page_1', name: 'Page One' }] }),
      metaGetObject: vi.fn().mockResolvedValue({ threads_profile: { id: 'threads_1', username: 'brandone', name: 'Brand One' } }),
    } as unknown as MetaClient;

    const profiles = await listThreadsProfiles(client);

    expect(profiles).toEqual([{ threadsId: 'threads_1', username: 'brandone', name: 'Brand One', pageId: 'page_1', pageName: 'Page One' }]);
    expect(client.metaGetObject).toHaveBeenCalledWith('/page_1', {
      fields: 'threads_profile{id,username,name,profile_picture_url}',
    });
  });
});
