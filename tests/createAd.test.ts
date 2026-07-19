import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAd } from '../src/tools/createAd.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('createAd', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockMetaGet: MetaPostMock = vi.fn();
  const mockMetaGetObject: MetaPostMock = vi.fn();
  const mockClient = {
    metaPost: mockMetaPost,
    metaGet: mockMetaGet,
    metaGetObject: mockMetaGetObject,
  } as unknown as MetaClient;

  const baseOpts = {
    adAccountId: 'act_123',
    name: 'Test Ad',
    adSetId: 'as456',
    creativeId: 'c789',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetaGet.mockResolvedValue({ data: [] });
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : { asset_feed_spec: null }
    );
  });

  it('returns dry_run without calling API', async () => {
    const r = await createAd(mockClient, baseOpts);
    expect(r.status).toBe('dry_run');
    expect(r.preview.adset_id).toBe('as456');
    expect(r.preview.creative).toContain('c789');
    expect(r.preview.status).toBe('PAUSED');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
    expect(r.executed).toBe(false);
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('blocks at dry-run when an omnichannel ad set gets a non-omnichannel creative', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { promoted_object: { omnichannel_object: { app: [{ application_id: '1' }] } } }
        : { asset_feed_spec: { call_to_action_types: ['SHOP_NOW'] } }
    );

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('failed');
    expect(r.error).toContain('applink_treatment');
    expect(r.error).toContain('object_store_urls');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('allows the omnichannel pairing through when skipOmnichannelCheck is set', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { promoted_object: { omnichannel_object: { app: [{ application_id: '1' }] } } }
        : { asset_feed_spec: {} }
    );

    const r = await createAd(mockClient, { ...baseOpts, skipOmnichannelCheck: true });

    expect(r.status).toBe('dry_run');
  });

  it('executes and returns id on success', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'ad123' });
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed');
    expect(r.id).toBe('ad123');
    const payload = mockMetaPost.mock.calls[0][1];
    expect(payload.adset_id).toBe('as456');
    expect(payload.status).toBe('PAUSED');
  });

  it('handles ACTIVE status', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'ad124' });
    await createAd(
      mockClient,
      { ...baseOpts, status: 'ACTIVE' },
      { dryRun: false, confirmed: true }
    );
    expect(mockMetaPost.mock.calls[0][1].status).toBe('ACTIVE');
  });

  it('blocks placement asset feeds on non-dynamic WhatsApp ad sets before mutation', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WHATSAPP', is_dynamic_creative: false }
        : { asset_feed_spec: { asset_customization_rules: [{ image_label: { name: 'feed' } }] } }
    );

    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });

    expect(r).toMatchObject({
      status: 'failed',
      executed: false,
      error: expect.stringMatching(/WhatsApp.*placement|placement.*WhatsApp/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('does not create a duplicate ad when dedupeByName finds an existing one', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: 'existing_ad_1', name: 'Test Ad', status: 'PAUSED' }],
    });

    const r = await createAd(
      mockClient,
      {
        ...baseOpts,
        dedupeByName: true,
      },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('deduped');
    expect(r.executed).toBe(false);
    expect(r.id).toBe('existing_ad_1');
    expect(mockMetaGet.mock.calls[0][1]).not.toHaveProperty('filtering');
    expect(mockMetaGet.mock.calls[0][2]).toMatchObject({ paginate: true, maxPages: 20 });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('returns failed on error', async () => {
    const token = 'task8_create_ad_secret_123456789';
    mockMetaPost.mockRejectedValueOnce(
      new Error(`Ad failed: access_token=${token}; Authorization: Bearer ${token}`)
    );
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
    const json = JSON.stringify(r);
    expect(r.error).toContain('[REDACTED]');
    expect(r.structuredError?.message).toContain('[REDACTED]');
    expect(json).not.toContain(token);
    expect(json).not.toContain(`access_token=${token}`);
    expect(json).not.toContain(`Authorization: Bearer ${token}`);
  });
});
