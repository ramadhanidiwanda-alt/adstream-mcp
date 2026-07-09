import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { getTargetingOptions } from '../src/tools/getTargetingOptions.js';

type MetaGetMock = ReturnType<typeof vi.fn>;

describe('getTargetingOptions', () => {
  const mockMetaGet: MetaGetMock = vi.fn();
  const mockClient = { metaGet: mockMetaGet } as unknown as MetaClient;

  beforeEach(() => vi.clearAllMocks());

  it('returns targeting options on success', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: '1', name: 'Online Shopping', type: 'interests', path: ['Shopping'], audience_size_lower_bound: 1000000, audience_size_upper_bound: 5000000 }],
    });
    const r = await getTargetingOptions(mockClient, { adAccountId: 'act_123', type: 'interests', query: 'shopping' });
    expect(r.operation).toBe('get_targeting_options');
    expect(r.data).toHaveLength(1);
    expect(r.data[0].name).toBe('Online Shopping');
    expect(mockMetaGet).toHaveBeenCalledWith('/search', { type: 'adinterest', limit: 25, q: 'shopping' });
  });

  it('returns empty array on API error', async () => {
    mockMetaGet.mockRejectedValueOnce(new Error('API error'));
    const r = await getTargetingOptions(mockClient, { adAccountId: 'act_123', type: 'behaviors' });
    expect(r.data).toEqual([]);
  });
});
