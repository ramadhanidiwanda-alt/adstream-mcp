import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { updateAd } from '../src/tools/updateAd.js';

type MetaMock = ReturnType<typeof vi.fn>;

describe('updateAd', () => {
  const mockMetaPost: MetaMock = vi.fn();
  const mockMetaGetObject: MetaMock = vi.fn();
  const mockClient = {
    metaPost: mockMetaPost,
    metaGetObject: mockMetaGetObject,
  } as unknown as MetaClient;

  const baseOpts = { adId: 'ad789' };

  beforeEach(() => vi.clearAllMocks());

  it('returns dry_run without calling the API', async () => {
    const r = await updateAd(mockClient, { ...baseOpts, name: 'New Ad Name' });
    expect(r.status).toBe('dry_run');
    expect(r.preview.name).toBe('New Ad Name');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('builds a creative payload from creativeId', async () => {
    const r = await updateAd(mockClient, { ...baseOpts, creativeId: 'creative123' });
    expect(r.preview.creative).toEqual({ creative_id: 'creative123' });
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await updateAd(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('executes update on success without creative swap', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await updateAd(
      mockClient,
      { ...baseOpts, name: 'New Name', status: 'PAUSED' },
      { dryRun: false, confirmed: true }
    );
    expect(r.status).toBe('executed');
    expect(r.success).toBe(true);
    expect(r.id).toBe('ad789');
    expect(mockMetaPost.mock.calls[0][0]).toBe('/ad789');
    expect(mockMetaPost.mock.calls[0][1]).toEqual({ name: 'New Name', status: 'PAUSED' });
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('reads back the creative id after a creative swap and reports it', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    mockMetaGetObject.mockResolvedValueOnce({ creative: { id: 'creative123' } });

    const r = await updateAd(
      mockClient,
      { ...baseOpts, creativeId: 'creative123' },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('executed');
    expect(mockMetaGetObject).toHaveBeenCalledWith('/ad789', { fields: 'creative' }, 3);
    expect(r.confirmedCreativeId).toBe('creative123');
  });

  it('does not fail the whole operation when the read-back fails', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    mockMetaGetObject.mockRejectedValueOnce(new Error('read-back unavailable'));

    const r = await updateAd(
      mockClient,
      { ...baseOpts, creativeId: 'creative123' },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('executed');
    expect(r.confirmedCreativeId).toBeUndefined();
  });

  it('returns failed on API error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('update error'));
    const r = await updateAd(mockClient, { ...baseOpts, name: 'Fail' }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
  });
});
