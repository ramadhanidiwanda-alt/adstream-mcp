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

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetaGetObject.mockImplementation(async (_path: string, params: { fields?: string }) =>
      params.fields === 'status,effective_status' ? { status: 'PAUSED' } : {}
    );
  });

  it('returns dry_run without calling the API', async () => {
    const r = await updateAd(mockClient, { ...baseOpts, name: 'New Ad Name' });
    expect(r.status).toBe('dry_run');
    expect(r.preview.name).toBe('New Ad Name');
    // A dry-run that produced a preview did what was asked. Reporting success: false
    // here read as a failed update.
    expect(r.success).toBe(true);
    expect(r.executed).toBe(false);
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('states plainly that a dry run wrote nothing', async () => {
    // success: true on a dry run is deliberate (false reads as a failed update),
    // so the response has to say in words what the boolean cannot.
    const result = await updateAd(mockClient, { adId: '123', name: 'Renamed' });

    expect(result.status).toBe('dry_run');
    expect(result.executed).toBe(false);
    expect(result.notice).toContain('DRY RUN');
    expect(result.notice).toContain('dryRun=false');
  });

  it('builds a creative payload from creativeId', async () => {
    const r = await updateAd(mockClient, { ...baseOpts, creativeId: 'creative123' });
    expect(r.preview.creative).toEqual({ creative_id: 'creative123' });
  });

  it('previews a standalone multi-media CTWA creative and preserves the ad id', async () => {
    const welcomeMessage = {
      type: 'VISUAL_EDITOR',
      version: 2,
      landing_screen_type: 'welcome_message',
      media_type: 'text',
      text_format: { message: { text: 'Halo sister!' } },
    };

    const r = await updateAd(mockClient, {
      ...baseOpts,
      adAccountId: 'act_123',
      multiMedia: {
        pageId: '215116488342403',
        instagramUserId: '17841463380041722',
        destinationUrl: 'https://api.whatsapp.com/send',
        primaryImageHash: 'square-hash',
        primaryText: 'Promo',
        headline: 'MID MONTH SALE — Diskon Hingga 32%',
        callToAction: 'WHATSAPP_MESSAGE',
        pageWelcomeMessage: welcomeMessage,
        images: [
          {
            imageHash: 'square-hash',
            placementExclusions: [
              { publisherPlatform: 'facebook', positions: ['story', 'reels'] },
              { publisherPlatform: 'instagram', positions: ['story', 'reels'] },
            ],
          },
          {
            imageHash: 'vertical-hash',
            placementExclusions: [
              {
                publisherPlatform: 'facebook',
                positions: ['feed', 'marketplace', 'right_hand_column'],
              },
              { publisherPlatform: 'instagram', positions: ['stream', 'explore'] },
            ],
          },
        ],
      },
    });

    // replaceAdMedia is the second dry-run path — it needs the same notice as updateAd's.
    expect(r.notice).toContain('DRY RUN');

    expect(r).toMatchObject({
      operation: 'replace_ad_media',
      status: 'dry_run',
      executed: false,
      id: 'ad789',
    });
    expect(r.preview).toMatchObject({
      create_creative: {
        name: 'Multi-media replacement for ad ad789',
        object_story_spec: {
          page_id: '215116488342403',
          instagram_user_id: '17841463380041722',
          link_data: {
            image_hash: 'square-hash',
            call_to_action: { type: 'WHATSAPP_MESSAGE' },
            page_welcome_message: welcomeMessage,
          },
        },
      },
      update_ad: { creative: { creative_id: '<created-creative-id>' } },
    });
    expect(
      (r.preview.create_creative as Record<string, unknown>).media_sourcing_spec
    ).toMatchObject({
      images: [
        {
          hash: 'square-hash',
          placement_customizations: [
            { publisher_platform: 'facebook', placement_exclusions: ['story', 'reels'] },
            { publisher_platform: 'instagram', placement_exclusions: ['story', 'reels'] },
          ],
        },
        {
          hash: 'vertical-hash',
          placement_customizations: [
            {
              publisher_platform: 'facebook',
              placement_exclusions: ['feed', 'marketplace', 'right_hand_column'],
            },
            { publisher_platform: 'instagram', placement_exclusions: ['stream', 'explore'] },
          ],
        },
      ],
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('creates a standalone creative, swaps the same ad, and verifies the read-back', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-multi-media' }).mockResolvedValueOnce({
      success: true,
    });
    mockMetaGetObject.mockImplementation(async (_path: string, params: { fields?: string }) => {
      if (params.fields === 'status,effective_status') return { status: 'PAUSED' };
      return {
        creative: {
          id: 'creative-multi-media',
          media_sourcing_spec: { images: [{ hash: 'square-hash' }, { hash: 'vertical-hash' }] },
        },
      };
    });

    const r = await updateAd(
      mockClient,
      {
        ...baseOpts,
        adAccountId: 'act_123',
        multiMedia: {
          pageId: 'page-1',
          destinationUrl: 'https://api.whatsapp.com/send',
          primaryImageHash: 'square-hash',
          callToAction: 'WHATSAPP_MESSAGE',
          images: [{ imageHash: 'square-hash' }, { imageHash: 'vertical-hash' }],
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(r).toMatchObject({
      status: 'executed',
      executed: true,
      id: 'ad789',
      createdCreativeId: 'creative-multi-media',
      confirmedCreativeId: 'creative-multi-media',
      verification: { status: 'verified' },
    });
    // The dry-run notice must not survive into a real execution.
    expect(r.notice).toBeUndefined();
    expect(mockMetaPost).toHaveBeenNthCalledWith(
      1,
      '/act_123/adcreatives',
      expect.objectContaining({ name: 'Multi-media replacement for ad ad789' }),
      0
    );
    expect(mockMetaPost).toHaveBeenNthCalledWith(
      2,
      '/ad789',
      { creative: { creative_id: 'creative-multi-media' } },
      3
    );
    expect(mockMetaGetObject).toHaveBeenCalledWith(
      '/ad789',
      { fields: 'creative{id,media_sourcing_spec,object_story_spec}' },
      3
    );
  });

  it('pauses an active ad before swapping and leaves it paused after verification', async () => {
    mockMetaPost
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ id: 'creative-multi-media' })
      .mockResolvedValueOnce({ success: true });
    mockMetaGetObject.mockImplementation(async (_path: string, params: { fields?: string }) => {
      if (params.fields === 'status,effective_status') return { status: 'ACTIVE' };
      return {
        creative: {
          id: 'creative-multi-media',
          media_sourcing_spec: { images: [{ hash: 'square-hash' }, { hash: 'vertical-hash' }] },
        },
      };
    });

    const r = await updateAd(
      mockClient,
      {
        ...baseOpts,
        adAccountId: 'act_123',
        multiMedia: {
          pageId: 'page-1',
          destinationUrl: 'https://api.whatsapp.com/send',
          primaryImageHash: 'square-hash',
          callToAction: 'WHATSAPP_MESSAGE',
          images: [{ imageHash: 'square-hash' }, { imageHash: 'vertical-hash' }],
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(r).toMatchObject({ status: 'executed', adPausedForVerification: true });
    expect(mockMetaPost).toHaveBeenNthCalledWith(1, '/ad789', { status: 'PAUSED' }, 3);
    expect(mockMetaPost).toHaveBeenNthCalledWith(2, '/act_123/adcreatives', expect.anything(), 0);
    expect(mockMetaPost).toHaveBeenNthCalledWith(
      3,
      '/ad789',
      { creative: { creative_id: 'creative-multi-media' } },
      3
    );
  });

  it('pauses an ad configured ACTIVE even when its effective status is pending review', async () => {
    mockMetaPost
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ id: 'creative-multi-media' })
      .mockResolvedValueOnce({ success: true });
    mockMetaGetObject.mockImplementation(async (_path: string, params: { fields?: string }) => {
      if (params.fields === 'status,effective_status') {
        return { status: 'ACTIVE', effective_status: 'PENDING_REVIEW' };
      }
      return {
        creative: {
          id: 'creative-multi-media',
          media_sourcing_spec: { images: [{ hash: 'square-hash' }, { hash: 'vertical-hash' }] },
        },
      };
    });

    const r = await updateAd(
      mockClient,
      {
        ...baseOpts,
        adAccountId: 'act_123',
        multiMedia: {
          pageId: 'page-1',
          destinationUrl: 'https://api.whatsapp.com/send',
          primaryImageHash: 'square-hash',
          callToAction: 'WHATSAPP_MESSAGE',
          images: [{ imageHash: 'square-hash' }, { imageHash: 'vertical-hash' }],
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(r).toMatchObject({ status: 'executed', adPausedForVerification: true });
    expect(mockMetaPost).toHaveBeenNthCalledWith(1, '/ad789', { status: 'PAUSED' }, 3);
  });

  it('returns pending_confirmation for a multi-media replacement without a dry-run notice', async () => {
    const r = await updateAd(
      mockClient,
      {
        ...baseOpts,
        adAccountId: 'act_123',
        multiMedia: {
          pageId: 'page-1',
          destinationUrl: 'https://api.whatsapp.com/send',
          primaryImageHash: 'square-hash',
          callToAction: 'WHATSAPP_MESSAGE',
          images: [{ imageHash: 'square-hash' }, { imageHash: 'vertical-hash' }],
        },
      },
      { dryRun: false, confirmed: false }
    );

    expect(r.status).toBe('pending_confirmation');
    expect(r.success).toBe(false);
    expect(mockMetaPost).not.toHaveBeenCalled();
    // Same requirement as updateAd's pending_confirmation: dryRun=false was already
    // passed, and this is not a dry run, so neither phrase belongs in the notice.
    expect(r.notice).toContain('confirmed=true');
    expect(r.notice).not.toContain('DRY RUN');
    expect(r.notice).not.toContain('dryRun=false');
  });

  it('requires an account id and forbids combining multi-media replacement with a second update', async () => {
    const multiMedia = {
      pageId: 'page-1',
      destinationUrl: 'https://api.whatsapp.com/send',
      primaryImageHash: 'square-hash',
      callToAction: 'WHATSAPP_MESSAGE',
      images: [{ imageHash: 'square-hash' }],
    };

    await expect(updateAd(mockClient, { ...baseOpts, multiMedia })).rejects.toThrow('adAccountId');
    await expect(
      updateAd(mockClient, { ...baseOpts, adAccountId: 'act_123', multiMedia, status: 'ACTIVE' })
    ).rejects.toThrow('cannot be combined');
  });

  it('reports an executed-but-unverified swap when Meta omits strict placements or the welcome message', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-multi-media' }).mockResolvedValueOnce({
      success: true,
    });
    mockMetaGetObject.mockResolvedValueOnce({
      creative: {
        id: 'creative-multi-media',
        media_sourcing_spec: { images: [{ hash: 'square-hash' }, { hash: 'vertical-hash' }] },
        object_story_spec: { link_data: {} },
      },
    });

    const r = await updateAd(
      mockClient,
      {
        ...baseOpts,
        adAccountId: 'act_123',
        multiMedia: {
          pageId: 'page-1',
          destinationUrl: 'https://api.whatsapp.com/send',
          primaryImageHash: 'square-hash',
          callToAction: 'WHATSAPP_MESSAGE',
          pageWelcomeMessage: { type: 'VISUAL_EDITOR' },
          images: [
            {
              imageHash: 'square-hash',
              placementExclusions: [
                { publisherPlatform: 'instagram', positions: ['story', 'reels'] },
              ],
            },
            { imageHash: 'vertical-hash' },
          ],
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(r).toMatchObject({
      status: 'failed',
      executed: true,
      success: false,
      verification: {
        status: 'unverified',
        placementExclusionsVerified: false,
        pageWelcomeMessageVerified: false,
      },
    });
    expect(r.error).toMatch(/Do not activate/i);
    // The dry-run notice must not survive into a real (even failed) execution.
    expect(r.notice).toBeUndefined();
  });

  it('surfaces an orphaned creative if creation succeeds but the ad swap is rejected', async () => {
    mockMetaPost
      .mockResolvedValueOnce({ id: 'creative-orphaned' })
      .mockRejectedValueOnce(new Error('swap rejected'));

    const r = await updateAd(
      mockClient,
      {
        ...baseOpts,
        adAccountId: 'act_123',
        multiMedia: {
          pageId: 'page-1',
          destinationUrl: 'https://api.whatsapp.com/send',
          primaryImageHash: 'square-hash',
          callToAction: 'WHATSAPP_MESSAGE',
          images: [{ imageHash: 'square-hash' }, { imageHash: 'vertical-hash' }],
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(r).toMatchObject({
      status: 'failed',
      executed: false,
      createdCreativeId: 'creative-orphaned',
    });
    expect(r.error).toContain('not attached to the ad');
  });

  it('does not retry standalone creative creation after a transport failure', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('connection lost after request'));

    const r = await updateAd(
      mockClient,
      {
        ...baseOpts,
        adAccountId: 'act_123',
        multiMedia: {
          pageId: 'page-1',
          destinationUrl: 'https://api.whatsapp.com/send',
          primaryImageHash: 'square-hash',
          callToAction: 'WHATSAPP_MESSAGE',
          images: [{ imageHash: 'square-hash' }, { imageHash: 'vertical-hash' }],
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(r).toMatchObject({ status: 'failed', executed: false });
    expect(r).toMatchObject({ ambiguousCreativeCreation: true });
    expect(r.error).toContain('inspect the creative library before retrying');
    expect(mockMetaPost).toHaveBeenCalledTimes(1);
    expect(mockMetaPost).toHaveBeenCalledWith('/act_123/adcreatives', expect.anything(), 0);
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await updateAd(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
    // Unlike a dry-run, this is a refusal — nothing was asked for and granted.
    expect(r.success).toBe(false);
    expect(mockMetaPost).not.toHaveBeenCalled();
    // pending_confirmation is only reachable with dryRun=false already passed, so its
    // notice must not tell the caller to do that again — and must not call itself a
    // dry run, since by definition it is not one.
    expect(r.notice).toContain('confirmed=true');
    expect(r.notice).not.toContain('DRY RUN');
    expect(r.notice).not.toContain('dryRun=false');
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
    // The dry-run notice must not survive into a real execution.
    expect(r.notice).toBeUndefined();
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
    const r = await updateAd(
      mockClient,
      { ...baseOpts, name: 'Fail' },
      { dryRun: false, confirmed: true }
    );
    expect(r.status).toBe('failed');
    // The dry-run notice must not survive into a real (even failed) execution.
    expect(r.notice).toBeUndefined();
  });

  // The pause-before-swap behaviour exists only on the multiMedia path. Stating
  // it unconditionally made callers believe a plain creativeId swap pauses the
  // ad; verified live 2026-08-17 that it does not.
  it('scopes the pause warning to the multiMedia path in the dry-run preview', async () => {
    const r = await updateAd(mockClient, {
      ...baseOpts,
      adAccountId: 'act_1',
      multiMedia: {
        pageId: 'page-1',
        destinationUrl: 'https://api.whatsapp.com/send',
        primaryImageHash: 'square-hash',
        callToAction: 'WHATSAPP_MESSAGE',
        images: [{ imageHash: 'square-hash' }, { imageHash: 'vertical-hash' }],
      },
    });
    expect((r.preview as { safety: string }).safety).toContain('multiMedia');
    expect(r.notice).toContain('cannot detect invalid IDs');
  });

});
