import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { archiveAd } from '../src/tools/archiveAd.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('archiveAd', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockClient = { metaPost: mockMetaPost } as unknown as MetaClient;

  beforeEach(() => vi.clearAllMocks());

  it('archives ad successfully', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await archiveAd(mockClient, { adId: 'ad123' });
    expect(r.status).toBe('executed'); expect(r.success).toBe(true);
    expect(r.id).toBe('ad123');
    expect(mockMetaPost).toHaveBeenCalledWith('/ad123', { status: 'ARCHIVED' }, 3);
  });

  it('returns failed on API error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('archive error'));
    const r = await archiveAd(mockClient, { adId: 'ad456' });
    expect(r.status).toBe('failed'); expect(r.success).toBe(false);
  });
});
