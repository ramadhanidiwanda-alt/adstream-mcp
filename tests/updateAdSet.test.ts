import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { updateAdSet } from '../src/tools/updateAdSet.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('updateAdSet', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockClient = { metaPost: mockMetaPost } as unknown as MetaClient;

  const baseOpts = { adSetId: 'as789' };

  beforeEach(() => vi.clearAllMocks());

  it('returns dry_run without calling API', async () => {
    const r = await updateAdSet(mockClient, { ...baseOpts, name: 'New Name' });
    expect(r.status).toBe('dry_run'); expect(r.preview.name).toBe('New Name');
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await updateAdSet(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
  });

  it('executes update on success', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await updateAdSet(mockClient, { ...baseOpts, name: 'New Name', dailyBudget: 50000 }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed'); expect(r.success).toBe(true);
    expect(r.id).toBe('as789');
    expect(mockMetaPost.mock.calls[0][0]).toBe('/as789');
    expect(mockMetaPost.mock.calls[0][1].daily_budget).toBe(50000);
  });

  it('returns failed on error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('update error'));
    const r = await updateAdSet(mockClient, { ...baseOpts, name: 'Fail' }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
  });
});
