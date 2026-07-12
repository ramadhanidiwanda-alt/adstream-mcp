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
    expect(r.mode).toBe('patch');
  });

  it('defaults nested targeting updates to patch mode', async () => {
    const r = await updateAdSet(mockClient, {
      ...baseOpts,
      targeting: { geoLocations: { countries: ['ID'] } },
    });
    expect(r.mode).toBe('patch');
    expect(r.preview.targeting).toEqual({ geo_locations: { countries: ['ID'] } });
  });

  it('requires explicit replace confirmation for targeting replacement', async () => {
    const r = await updateAdSet(mockClient, {
      ...baseOpts,
      mode: 'replace',
      targeting: { geoLocations: { countries: ['ID'] } },
    }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
    expect(r.error).toContain('replaceTargetingConfirmed');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('executes replace mode only with explicit replacement confirmation', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await updateAdSet(mockClient, {
      ...baseOpts,
      mode: 'replace',
      replaceTargetingConfirmed: true,
      targeting: { geoLocations: { countries: ['ID'] } },
    }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed');
    expect(r.mode).toBe('replace');
    expect(mockMetaPost).toHaveBeenCalled();
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
