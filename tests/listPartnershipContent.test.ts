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

  it('mengirim filter memakai nama plural dan nilai huruf kecil yang diterima Meta', async () => {
    const { client, metaGet } = clientReturning({ data: [] });

    await listPartnershipContent(client, {
      businessId: 'biz-1',
      igUserId: 'brand-ig-1',
      adCodes: ['AD-1', 'AD-2'],
      platform: 'INSTAGRAM',
      mediaType: 'VIDEO',
      postType: 'REEL',
      limit: 50,
      cursor: 'cursor-abc',
    });

    const params = metaGet.mock.calls[0][1] as Record<string, unknown>;
    // Nama singular platform/media_type/post_type diterima Meta dengan HTTP 200
    // tapi tidak memfilter apa pun, jadi tidak boleh dikirim sama sekali.
    expect(params.platform).toBeUndefined();
    expect(params.media_type).toBeUndefined();
    expect(params.post_type).toBeUndefined();
    expect(params).toMatchObject({
      ad_codes: 'AD-1,AD-2',
      platform_types: 'instagram',
      media_types: 'video',
      // Meta menolak 'reel' dan 'story'; nilainya jamak.
      post_types: 'reels',
      limit: 50,
      after: 'cursor-abc',
    });
  });

  it('menerima nilai filter apa adanya lalu menormalkannya', async () => {
    const cases: Array<[Record<string, string>, Record<string, string>]> = [
      [{ postType: 'STORY' }, { post_types: 'stories' }],
      [{ postType: 'stories' }, { post_types: 'stories' }],
      [{ postType: 'reels' }, { post_types: 'reels' }],
      [{ mediaType: 'carousel' }, { media_types: 'carousel' }],
      [{ platform: 'facebook' }, { platform_types: 'facebook' }],
    ];

    for (const [input, expected] of cases) {
      const { client, metaGet } = clientReturning({ data: [] });
      await listPartnershipContent(client, {
        businessId: 'biz-1',
        igUserId: 'brand-ig-1',
        ...input,
      });
      expect(metaGet.mock.calls[0][1]).toMatchObject(expected);
    }
  });

  it('menolak nilai filter yang tidak dikenal Meta, bukan meneruskannya', async () => {
    const { client, metaGet } = clientReturning({ data: [] });
    await expect(
      listPartnershipContent(client, {
        businessId: 'biz-1',
        igUserId: 'brand-ig-1',
        mediaType: 'TEXT',
      })
    ).rejects.toThrow(/mediaType/);
    expect(metaGet).not.toHaveBeenCalled();
  });

  it('menolak creatorUsername karena terbukti tidak memfilter apa pun', async () => {
    const { client, metaGet } = clientReturning({ data: [] });
    await expect(
      listPartnershipContent(client, {
        businessId: 'biz-1',
        igUserId: 'brand-ig-1',
        creatorUsername: 'kreator_a',
      } as never)
    ).rejects.toThrow(/adPartnerPageIds/);
    expect(metaGet).not.toHaveBeenCalled();
  });

  it('meneruskan adPartnerPageIds dan adPartnerIgUserIds sebagai pengganti creatorUsername', async () => {
    const { client, metaGet } = clientReturning({ data: [] });

    await listPartnershipContent(client, {
      businessId: 'biz-1',
      igUserId: 'brand-ig-1',
      adPartnerPageIds: ['1046674028528303', '102818401067554'],
      adPartnerIgUserIds: ['17841400000000000'],
    });

    expect(metaGet.mock.calls[0][1]).toMatchObject({
      ad_partner_page_ids: '1046674028528303,102818401067554',
      ad_partner_ig_user_ids: '17841400000000000',
    });
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

  it('menolak limit di luar rentang 1-50', async () => {
    const { client } = clientReturning({ data: [] });
    await expect(
      listPartnershipContent(client, { businessId: 'biz-1', igUserId: 'brand-ig-1', limit: 51 })
    ).rejects.toThrow(/limit/);
    await expect(
      listPartnershipContent(client, { businessId: 'biz-1', igUserId: 'brand-ig-1', limit: 0 })
    ).rejects.toThrow(/limit/);
    await expect(
      listPartnershipContent(client, { businessId: 'biz-1', igUserId: 'brand-ig-1', limit: 2.5 })
    ).rejects.toThrow(/limit/);
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
  it('mengirim permalinks sebagai direct lookup dan tidak memakai filter apa pun', async () => {
    const { client, metaGet } = clientReturning({ data: [] });

    await listPartnershipContent(client, {
      businessId: 'biz-1',
      igUserId: 'brand-ig-1',
      permalinks: [
        'https://www.instagram.com/reel/DbyM-xqzsC-/?igsh=Mm95Y25vMnJhaTh3',
        'https://www.instagram.com/p/Da36ZlGPTNS/',
      ],
    });

    const params = metaGet.mock.calls[0][1] as Record<string, unknown>;
    expect(params.permalinks).toBe(
      'https://www.instagram.com/reel/DbyM-xqzsC-/?igsh=Mm95Y25vMnJhaTh3,https://www.instagram.com/p/Da36ZlGPTNS/'
    );
    // Direct lookup tidak boleh membawa limit/cursor — Meta menolak kombinasinya.
    expect(params.limit).toBeUndefined();
    expect(params.after).toBeUndefined();
  });

  it('menolak permalinks lebih dari 50', async () => {
    const { client, metaGet } = clientReturning({ data: [] });
    await expect(
      listPartnershipContent(client, {
        businessId: 'biz-1',
        igUserId: 'brand-ig-1',
        permalinks: Array.from({ length: 51 }, (_, i) => `https://www.instagram.com/p/code${i}/`),
      })
    ).rejects.toThrow(/permalinks maksimal 50/);
    expect(metaGet).not.toHaveBeenCalled();
  });

  it('menolak permalinks digabung dengan direct lookup lain atau dengan filter', async () => {
    const { client, metaGet } = clientReturning({ data: [] });
    const base = { businessId: 'biz-1', igUserId: 'brand-ig-1' } as const;
    const permalinks = ['https://www.instagram.com/reel/DbyM-xqzsC-/'];

    await expect(
      listPartnershipContent(client, { ...base, permalinks, adCodes: ['AD-1'] })
    ).rejects.toThrow(/hanya satu/i);

    for (const filter of [
      { platform: 'INSTAGRAM' },
      { mediaType: 'VIDEO' },
      { postType: 'REEL' },
      { cursor: 'cursor-abc' },
    ]) {
      await expect(
        listPartnershipContent(client, { ...base, permalinks, ...filter })
      ).rejects.toThrow(/tidak bisa digabung/i);
    }

    expect(metaGet).not.toHaveBeenCalled();
  });

  it('menolak permalinks yang bukan URL instagram.com atau facebook.com', async () => {
    const { client, metaGet } = clientReturning({ data: [] });
    await expect(
      listPartnershipContent(client, {
        businessId: 'biz-1',
        igUserId: 'brand-ig-1',
        permalinks: ['DbyM-xqzsC-'],
      })
    ).rejects.toThrow(/permalinks/);
    expect(metaGet).not.toHaveBeenCalled();
  });
});
