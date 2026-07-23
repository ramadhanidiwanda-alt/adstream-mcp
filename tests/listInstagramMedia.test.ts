import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listInstagramMedia } from '../src/tools/listInstagramMedia.js';

function makeClient(metaGet: MetaClient['metaGet']): MetaClient {
  return { metaGet } as unknown as MetaClient;
}

describe('listInstagramMedia', () => {
  it('lists media for an IG user without permalinkUrls (single page, no pagination)', async () => {
    const mockMetaGet = vi.fn().mockResolvedValue({
      data: [
        {
          id: '178956',
          permalink: 'https://www.instagram.com/reel/DbFng09vfYg/',
          media_type: 'VIDEO',
          media_product_type: 'REELS',
          caption: 'Hurricane launch',
          timestamp: '2026-07-01T10:00:00+0000',
          thumbnail_url: 'https://example.com/thumb.jpg',
        },
      ],
    });

    const result = await listInstagramMedia(makeClient(mockMetaGet), { igUserId: 'ig-1' });

    expect(result).toEqual([
      {
        id: '178956',
        permalink: 'https://www.instagram.com/reel/DbFng09vfYg/',
        mediaType: 'VIDEO',
        mediaProductType: 'REELS',
        caption: 'Hurricane launch',
        timestamp: '2026-07-01T10:00:00+0000',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        mediaUrl: undefined,
      },
    ]);
    expect(mockMetaGet).toHaveBeenCalledWith(
      '/ig-1/media',
      expect.objectContaining({ limit: 25 }),
      { maxRetries: 3 }
    );
  });

  it('throws when igUserId is blank', async () => {
    const mockMetaGet = vi.fn();
    await expect(
      listInstagramMedia(makeClient(mockMetaGet), { igUserId: '  ' })
    ).rejects.toThrow(/igUserId wajib diisi/);
    expect(mockMetaGet).not.toHaveBeenCalled();
  });

  it('matches pasted instagram.com URLs to media by shortcode, ignoring query strings', async () => {
    const mockMetaGet = vi.fn().mockResolvedValue({
      data: [
        { id: '1', permalink: 'https://www.instagram.com/reel/DbFrCXuv5R9/' },
        { id: '2', permalink: 'https://www.instagram.com/reel/DbFng09vfYg/' },
        { id: '3', permalink: 'https://www.instagram.com/p/Da36ZlGPTNS/' },
        { id: '4', permalink: 'https://www.instagram.com/reel/UNMATCHED123/' },
      ],
    });

    const result = await listInstagramMedia(makeClient(mockMetaGet), {
      igUserId: 'ig-1',
      permalinkUrls: [
        'https://www.instagram.com/reel/DbFng09vfYg/?igsh=MWFvczVsOXdvM3Z2cQ==',
        'https://www.instagram.com/p/Da36ZlGPTNS/?igsh=MTVvMGI1cW4yc3p0Mw==',
      ],
    });

    expect(result.map((item) => item.id)).toEqual(['2', '3']);
    // permalinkUrls given -> pagination is turned on to search further back in the feed.
    expect(mockMetaGet).toHaveBeenCalledWith(
      '/ig-1/media',
      expect.objectContaining({ limit: 50 }),
      { paginate: true, maxPages: 10, maxRetries: 3 }
    );
  });

  it('returns no media when none of the pasted URLs match', async () => {
    const mockMetaGet = vi.fn().mockResolvedValue({
      data: [{ id: '1', permalink: 'https://www.instagram.com/reel/OtherPost123/' }],
    });

    const result = await listInstagramMedia(makeClient(mockMetaGet), {
      igUserId: 'ig-1',
      permalinkUrls: ['https://www.instagram.com/reel/DbFng09vfYg/'],
    });

    expect(result).toEqual([]);
  });
});
