import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAdCreative } from '../src/tools/createAdCreative.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('createAdCreative', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockMetaGet: MetaPostMock = vi.fn();
  const mockClient = { metaPost: mockMetaPost, metaGet: mockMetaGet } as unknown as MetaClient;

  const baseOpts = {
    adAccountId: 'act_123', name: 'Test Creative', pageId: '1001',
    linkData: { link: 'https://example.com', message: 'Buy now', callToAction: { type: 'SHOP_NOW' as const, value: { link: 'https://example.com' } } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetaGet.mockResolvedValue({ data: [] });
  });

  it('returns dry_run without calling API', async () => {
    const r = await createAdCreative(mockClient, baseOpts);
    expect(r.status).toBe('dry_run'); expect(r.executed).toBe(false);
    expect(r.preview.name).toBe('Test Creative'); expect(mockMetaPost).not.toHaveBeenCalled();
  });


  it('includes Instagram and Threads identities in object_story_spec preview', async () => {
    const r = await createAdCreative(mockClient, {
      ...baseOpts,
      instagramUserId: 'ig_123',
      threadsProfileId: 'threads_456',
    });

    expect(r.preview.object_story_spec).toMatchObject({
      page_id: '1001',
      instagram_user_id: 'ig_123',
      threads_profile_id: 'threads_456',
    });
  });

  it('moves a Dynamic Creative asset_feed_spec out of object_story_spec without losing variants', async () => {
    const assetFeedSpec = {
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
    };

    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'Dynamic Creative',
      pageId: '1001',
      objectStorySpec: {
        asset_feed_spec: assetFeedSpec,
      },
    });

    expect(result.preview).toMatchObject({
      name: 'Dynamic Creative',
      object_story_spec: { page_id: '1001' },
      asset_feed_spec: assetFeedSpec,
    });
    expect(result.preview.object_story_spec).not.toHaveProperty('asset_feed_spec');
  });

  it('sends every Dynamic Creative variant to Meta on execution', async () => {
    const assetFeedSpec = {
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
    };
    mockMetaPost.mockResolvedValueOnce({ id: 'creative_dynamic_123' });

    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'Dynamic Creative',
      pageId: '1001',
      objectStorySpec: { page_id: '1001', asset_feed_spec: assetFeedSpec },
    }, { dryRun: false, confirmed: true });

    expect(result).toMatchObject({ status: 'executed', id: 'creative_dynamic_123' });
    expect(mockMetaPost).toHaveBeenCalledWith(
      '/act_123/adcreatives',
      expect.objectContaining({
        object_story_spec: { page_id: '1001' },
        asset_feed_spec: assetFeedSpec,
      }),
      3
    );
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await createAdCreative(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation'); expect(r.error).toContain('confirmation');
  });

  it('executes and returns id on success', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'c123' });
    const r = await createAdCreative(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed'); expect(r.id).toBe('c123');
    expect(mockMetaPost).toHaveBeenCalledTimes(1);
  });

  it('does not create a duplicate creative when dedupeByName finds an existing one', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: 'existing_creative_1', name: 'Test Creative', status: 'ACTIVE' }],
    });

    const r = await createAdCreative(mockClient, {
      ...baseOpts,
      dedupeByName: true,
    }, { dryRun: false, confirmed: true });

    expect(r.status).toBe('deduped');
    expect(r.executed).toBe(false);
    expect(r.id).toBe('existing_creative_1');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('returns failed when no id returned', async () => {
    mockMetaPost.mockResolvedValueOnce({});
    const r = await createAdCreative(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
  });

  it('returns failed on API error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('creative error'));
    const r = await createAdCreative(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed'); expect(r.error).toContain('creative error');
  });
});
