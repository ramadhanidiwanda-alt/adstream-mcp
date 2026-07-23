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

  it('propagates API errors instead of silently returning empty data', async () => {
    mockMetaGet.mockRejectedValueOnce(new Error('API error'));
    await expect(
      getTargetingOptions(mockClient, { adAccountId: 'act_123', type: 'behaviors' })
    ).rejects.toThrow('API error');
  });

  it.each([
    ['behaviors', 'behaviors'],
    ['demographics', 'demographics'],
    ['industries', 'industries'],
    ['life_events', 'life_events'],
    ['family_statuses', 'family_statuses'],
    ['income', 'income'],
  ] as const)('searches %s via adTargetingCategory&class=%s', async (type, cls) => {
    mockMetaGet.mockResolvedValueOnce({ data: [] });
    await getTargetingOptions(mockClient, { adAccountId: 'act_123', type, query: 'q' });
    expect(mockMetaGet).toHaveBeenCalledWith('/search', {
      type: 'adTargetingCategory',
      class: cls,
      limit: 25,
      q: 'q',
    });
  });

  it.each([
    ['work_employers', 'adworkemployer'],
    ['work_positions', 'adworkposition'],
    ['work_job_titles', 'adworkposition'],
  ] as const)('searches %s via type=%s (not nested under adinterest)', async (type, metaType) => {
    mockMetaGet.mockResolvedValueOnce({ data: [] });
    await getTargetingOptions(mockClient, { adAccountId: 'act_123', type, query: 'google' });
    expect(mockMetaGet).toHaveBeenCalledWith('/search', {
      type: metaType,
      limit: 25,
      q: 'google',
    });
  });

  it.each(['relationship_statuses', 'education_statuses', 'college_years'] as const)(
    'rejects %s with a clear explanation instead of querying Meta with a bogus type',
    async (type) => {
      await expect(getTargetingOptions(mockClient, { adAccountId: 'act_123', type })).rejects.toThrow(
        /not searchable/i
      );
      expect(mockMetaGet).not.toHaveBeenCalled();
    }
  );
});
