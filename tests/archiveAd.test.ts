import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { archiveAd } from '../src/tools/archiveAd.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('archiveAd', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockClient = { metaPost: mockMetaPost } as unknown as MetaClient;

  beforeEach(() => vi.clearAllMocks());

  it('defaults to a dry run and does not call the API', async () => {
    const r = await archiveAd(mockClient, { adId: 'ad123' });
    expect(r.status).toBe('dry_run');
    expect(r.executed).toBe(false);
    expect(r.preview).toEqual({ status: 'ARCHIVED' });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation after dryRun=false', async () => {
    const r = await archiveAd(mockClient, { adId: 'ad123' }, { dryRun: false });
    expect(r.status).toBe('pending_confirmation');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('archives ad successfully once confirmed', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await archiveAd(mockClient, { adId: 'ad123' }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed');
    expect(r.executed).toBe(true);
    expect(r.success).toBe(true);
    expect(r.id).toBe('ad123');
    expect(mockMetaPost).toHaveBeenCalledWith('/ad123', { status: 'ARCHIVED' }, 3);
  });

  it('returns failed on API error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('archive error'));
    const r = await archiveAd(mockClient, { adId: 'ad456' }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
    expect(r.success).toBe(false);
  });
});
