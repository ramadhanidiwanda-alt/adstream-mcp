import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAd } from '../src/tools/createAd.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('createAd', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockClient = { metaPost: mockMetaPost } as unknown as MetaClient;

  const baseOpts = { adAccountId: 'act_123', name: 'Test Ad', adSetId: 'as456', creativeId: 'c789' };

  beforeEach(() => vi.clearAllMocks());

  it('returns dry_run without calling API', async () => {
    const r = await createAd(mockClient, baseOpts);
    expect(r.status).toBe('dry_run'); expect(r.preview.adset_id).toBe('as456');
    expect(r.preview.creative).toContain('c789');
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
  });

  it('executes and returns id on success', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'ad123' });
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed'); expect(r.id).toBe('ad123');
    const payload = mockMetaPost.mock.calls[0][1];
    expect(payload.adset_id).toBe('as456');
  });

  it('handles ACTIVE status', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'ad124' });
    await createAd(mockClient, { ...baseOpts, status: 'ACTIVE' }, { dryRun: false, confirmed: true });
    expect(mockMetaPost.mock.calls[0][1].status).toBe('ACTIVE');
  });

  it('returns failed on error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('ad error'));
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
  });
});
