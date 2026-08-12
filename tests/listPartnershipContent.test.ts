import { describe, expect, it, vi } from 'vitest';
import { listPartnershipContent } from '../src/tools/listPartnershipContent.js';
import type { MetaClient } from '../src/metaClient.js';

function clientReturning(data: unknown): { client: MetaClient; metaGet: ReturnType<typeof vi.fn> } {
  const metaGet = vi.fn().mockResolvedValue(data);
  return { client: { metaGet } as unknown as MetaClient, metaGet };
}

describe('listPartnershipContent', () => {
  it('memanggil endpoint terpadu dan menormalisasi hasilnya', async () => {
    const { client, metaGet } = clientReturning({
      data: [
        {
          content_id: 'ig-media-1',
          platform: 'INSTAGRAM',
          media_type: 'VIDEO',
          post_type: 'REEL',
          caption: 'Kolaborasi seru',
          permalink: 'https://www.instagram.com/reel/abc/',
          creation_time: '2026-08-01',
          author: {
            display_name: 'kreator_a',
            ig_user_id: 'creator-ig-1',
            fb_page_id: 'creator-page-1',
            profile_picture_url: 'https://cdn.example.com/a.jpg',
          },
          is_recommended: true,
          ad_usage: 'NEVER_USED',
          partnership_info: [
            {
              ad_eligibility: 'ELIGIBLE',
              permission_status: 'APPROVED',
              permission_type: 'ACCOUNT_LEVEL',
              ad_code: 'AD-CODE-1',
              content_types: ['REEL'],
            },
          ],
          organic_insights: { likes: 120, comments: 8, views: 5400, reach: null },
        },
      ],
    });

    const result = await listPartnershipContent(client, {
      businessId: 'biz-1',
      igUserId: 'brand-ig-1',
    });

    expect(metaGet).toHaveBeenCalledWith(
      '/biz-1/partnership-ads-advertisable-content',
      expect.objectContaining({ ig_user_id: 'brand-ig-1', limit: 25 }),
      expect.anything()
    );
    expect(result).toEqual([
      {
        contentId: 'ig-media-1',
        platform: 'INSTAGRAM',
        mediaType: 'VIDEO',
        postType: 'REEL',
        caption: 'Kolaborasi seru',
        permalink: 'https://www.instagram.com/reel/abc/',
        creationTime: '2026-08-01',
        author: {
          displayName: 'kreator_a',
          igUserId: 'creator-ig-1',
          fbPageId: 'creator-page-1',
          profilePictureUrl: 'https://cdn.example.com/a.jpg',
        },
        isRecommended: true,
        adUsage: 'NEVER_USED',
        partnershipInfo: [
          {
            adEligibility: 'ELIGIBLE',
            taggedPartner: undefined,
            permissionStatus: 'APPROVED',
            permissionType: 'ACCOUNT_LEVEL',
            adCode: 'AD-CODE-1',
            contentTypes: ['REEL'],
          },
        ],
        organicInsights: {
          likes: 120,
          comments: 8,
          views: 5400,
          reach: null,
          shares: undefined,
          interaction: undefined,
          saves: undefined,
        },
      },
    ]);
  });

  it('menangani konten tanpa partnership_info dan organic_insights', async () => {
    const { client } = clientReturning({
      data: [{ content_id: 'fb-post-1', platform: 'FACEBOOK' }],
    });

    const result = await listPartnershipContent(client, {
      businessId: 'biz-1',
      fbPageId: 'brand-page-1',
    });

    expect(result).toEqual([{ contentId: 'fb-post-1', platform: 'FACEBOOK' }]);
  });

  it('meneruskan filter dan cursor sebagai parameter Meta', async () => {
    const { client, metaGet } = clientReturning({ data: [] });

    await listPartnershipContent(client, {
      businessId: 'biz-1',
      igUserId: 'brand-ig-1',
      creatorUsername: 'kreator_a',
      adCodes: ['AD-1', 'AD-2'],
      platform: 'INSTAGRAM',
      mediaType: 'VIDEO',
      postType: 'REEL',
      limit: 50,
      cursor: 'cursor-abc',
    });

    expect(metaGet).toHaveBeenCalledWith(
      '/biz-1/partnership-ads-advertisable-content',
      expect.objectContaining({
        creator_username: 'kreator_a',
        ad_codes: 'AD-1,AD-2',
        platform: 'INSTAGRAM',
        media_type: 'VIDEO',
        post_type: 'REEL',
        limit: 50,
        after: 'cursor-abc',
      }),
      expect.anything()
    );
  });

  it('menolak businessId kosong', async () => {
    const { client } = clientReturning({ data: [] });
    await expect(listPartnershipContent(client, { businessId: '  ' })).rejects.toThrow(
      /businessId wajib diisi/
    );
  });

  it('menolak panggilan tanpa fbPageId maupun igUserId', async () => {
    const { client } = clientReturning({ data: [] });
    await expect(listPartnershipContent(client, { businessId: 'biz-1' })).rejects.toThrow(
      /fbPageId atau igUserId/
    );
  });

  it('menolak adCodes lebih dari 50', async () => {
    const { client } = clientReturning({ data: [] });
    await expect(
      listPartnershipContent(client, {
        businessId: 'biz-1',
        igUserId: 'brand-ig-1',
        adCodes: Array.from({ length: 51 }, (_, index) => `AD-${index}`),
      })
    ).rejects.toThrow(/maksimal 50/);
  });
});
