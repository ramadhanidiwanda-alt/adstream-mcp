import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { resolveCreativeAssets } from '../src/tools/resolveCreativeAssets.js';

describe('resolveCreativeAssets', () => {
  it('prefers full-size AdImage URL over the generic AdCreative thumbnail', async () => {
    const metaGet = vi
      .fn()
      .mockImplementation(async (path: string, params: Record<string, unknown>) => {
        if (path === '/act_123/ads') {
          expect(params).toMatchObject({
            thumbnail_width: 1920,
            thumbnail_height: 1080,
          });
          return {
            data: [
              {
                id: 'ad_1',
                name: 'Static Ad',
                creative: {
                  id: 'cr_1',
                  name: 'Static Creative',
                  thumbnail_url: 'https://cdn.example/thumb-small.jpg',
                  image_hash: 'hash_1',
                },
              },
            ],
          };
        }

        if (path === '/act_123/adimages') {
          expect(params).toMatchObject({
            fields: 'hash,url,url_128,width,height,name',
            hashes: JSON.stringify(['hash_1']),
          });
          return {
            data: [
              {
                hash: 'hash_1',
                url: 'https://cdn.example/full.jpg',
                url_128: 'https://cdn.example/small-128.jpg',
                width: 1440,
                height: 1440,
                name: 'full',
              },
            ],
          };
        }

        return { data: [] };
      });

    const result = await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: 'act_123',
      thumbnailWidth: 1920,
      thumbnailHeight: 1080,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ad_id: 'ad_1',
      creative_id: 'cr_1',
      media_kind: 'image',
      best_thumbnail: {
        url: 'https://cdn.example/full.jpg',
        source: 'adimage_url',
        width: 1440,
        height: 1440,
        quality: 'high',
      },
    });
    expect(result[0].candidates.map((candidate) => candidate.source)).toEqual([
      'adimage_url',
      'adcreative_thumbnail_url',
      'adimage_url_128',
    ]);
  });

  it('uses the largest direct video thumbnail when no preferred thumbnail is returned', async () => {
    const metaGet = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/act_123/ads') {
        return {
          data: [
            {
              id: 'ad_2',
              creative: {
                id: 'cr_2',
                thumbnail_url: 'https://cdn.example/video-generic.jpg',
                video_id: 'vid_1',
              },
            },
          ],
        };
      }

      if (path === '/vid_1/thumbnails') {
        return {
          data: [
            {
              id: 'thumb_small',
              uri: 'https://cdn.example/video-small.jpg',
              width: 320,
              height: 180,
              is_preferred: false,
            },
            {
              id: 'thumb_large',
              uri: 'https://cdn.example/video-large.jpg',
              width: 1920,
              height: 1080,
              is_preferred: false,
            },
          ],
        };
      }

      return { data: [] };
    });

    const result = await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: '123',
    });

    expect(result[0]).toMatchObject({
      media_kind: 'video',
      best_thumbnail: {
        url: 'https://cdn.example/video-large.jpg',
        source: 'video_thumbnail',
        width: 1920,
        height: 1080,
        quality: 'high',
      },
    });
  });

  it('looks up AdImages by hash in batches instead of scanning the account default page', async () => {
    const hashes = Array.from({ length: 120 }, (_, index) => `hash_${index}`);
    const requestedHashBatches: string[][] = [];
    const metaGet = vi
      .fn()
      .mockImplementation(async (path: string, params: Record<string, unknown>) => {
        if (path === '/act_123/ads') {
          return {
            data: hashes.map((hash, index) => ({
              id: `ad_${index}`,
              creative: { id: `cr_${index}`, image_hash: hash },
            })),
          };
        }

        if (path === '/act_123/adimages') {
          const batch = JSON.parse(String(params.hashes)) as string[];
          requestedHashBatches.push(batch);
          expect(params.limit).toBe(batch.length);
          return {
            data: batch.map((hash) => ({
              hash,
              url: `https://cdn.example/${hash}.jpg`,
              width: 1080,
              height: 1080,
            })),
          };
        }

        return { data: [] };
      });

    const result = await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: 'act_123',
    });

    expect(requestedHashBatches.map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(requestedHashBatches.flat()).toEqual(hashes);
    expect(result).toHaveLength(120);
    expect(result[119].best_thumbnail).toMatchObject({
      url: 'https://cdn.example/hash_119.jpg',
      source: 'adimage_url',
    });
  });

  it('keeps at most five per-video thumbnail lookups in flight', async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    const metaGet = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/act_123/ads') {
        return {
          data: Array.from({ length: 20 }, (_, index) => ({
            id: `ad_${index}`,
            creative: { id: `cr_${index}`, video_id: `vid_${index}` },
          })),
        };
      }

      if (path.endsWith('/thumbnails')) {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return { data: [{ uri: `https://cdn.example/${path}.jpg`, width: 1280, height: 720 }] };
      }

      return { data: [] };
    });

    const result = await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: 'act_123',
    });

    expect(peakInFlight).toBeLessThanOrEqual(5);
    expect(result).toHaveLength(20);
    expect(result[0].best_thumbnail?.source).toBe('video_thumbnail');
  });

  it('falls back to creative candidates when a video thumbnail lookup fails', async () => {
    const metaGet = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/act_123/ads') {
        return {
          data: [
            {
              id: 'ad_3',
              creative: {
                id: 'cr_3',
                video_id: 'vid_deleted',
                thumbnail_url: 'https://cdn.example/fallback.jpg',
              },
            },
          ],
        };
      }

      if (path === '/vid_deleted/thumbnails') {
        throw new Error('(#100) Object does not exist');
      }

      return { data: [] };
    });

    const result = await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: 'act_123',
    });

    expect(result[0]).toMatchObject({
      media_kind: 'video',
      best_thumbnail: {
        url: 'https://cdn.example/fallback.jpg',
        source: 'adcreative_thumbnail_url',
      },
    });
  });

  it('resolves Instagram-native media through the IG media node', async () => {
    const metaGet = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/act_123/ads') {
        return {
          data: [
            {
              id: 'ad_ig_image',
              creative: {
                id: 'cr_ig_image',
                thumbnail_url: 'https://cdn.example/ig-generic.jpg',
                effective_instagram_media_id: 'ig_1',
              },
            },
            {
              id: 'ad_ig_video',
              creative: {
                id: 'cr_ig_video',
                source_instagram_media_id: 'ig_2',
              },
            },
          ],
        };
      }

      return { data: [] };
    });

    const metaGetObject = vi
      .fn()
      .mockImplementation(async (path: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ fields: 'media_type,media_url,thumbnail_url' });
        if (path === '/ig_1') {
          return { media_type: 'IMAGE', media_url: 'https://cdn.example/ig-full.jpg' };
        }
        if (path === '/ig_2') {
          return {
            media_type: 'VIDEO',
            media_url: 'https://cdn.example/ig-clip.mp4',
            thumbnail_url: 'https://cdn.example/ig-clip-thumb.jpg',
          };
        }
        return {};
      });

    const result = await resolveCreativeAssets(
      { metaGet, metaGetObject } as unknown as MetaClient,
      { adAccountId: 'act_123' }
    );

    expect(result[0]).toMatchObject({
      media_kind: 'image',
      best_thumbnail: { url: 'https://cdn.example/ig-full.jpg', source: 'ig_media_url' },
    });
    // media_url on a VIDEO node is the clip itself, so only the still is usable.
    expect(result[1].candidates.map((candidate) => candidate.url)).toEqual([
      'https://cdn.example/ig-clip-thumb.jpg',
    ]);
    expect(result[1]).toMatchObject({
      media_kind: 'video',
      best_thumbnail: { source: 'ig_thumbnail_url' },
    });
  });

  it('degrades when the linked Instagram account denies media access', async () => {
    const metaGet = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/act_123/ads') {
        return {
          data: [
            {
              id: 'ad_ig_denied',
              creative: {
                id: 'cr_ig_denied',
                thumbnail_url: 'https://cdn.example/ig-generic.jpg',
                effective_instagram_media_id: 'ig_denied',
              },
            },
          ],
        };
      }
      return { data: [] };
    });

    const metaGetObject = vi.fn().mockRejectedValue(new Error('(#200) Permissions error'));

    const result = await resolveCreativeAssets(
      { metaGet, metaGetObject } as unknown as MetaClient,
      { adAccountId: 'act_123' }
    );

    expect(result[0].best_thumbnail).toMatchObject({
      url: 'https://cdn.example/ig-generic.jpg',
      source: 'adcreative_thumbnail_url',
    });
  });

  it('scopes to an ad set via the nested ads edge and merges adIds into filtering', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const metaGet = vi
      .fn()
      .mockImplementation(async (path: string, params: Record<string, unknown>) => {
        capturedPath = path;
        capturedParams = params;
        return { data: [] };
      });

    await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: 'act_123',
      adSetId: '456',
      adIds: ['ad_1', 'ad_2'],
    });

    expect(capturedPath).toBe('/456/ads');
    expect(JSON.parse(String(capturedParams?.filtering))).toContainEqual({
      field: 'id',
      operator: 'IN',
      value: ['ad_1', 'ad_2'],
    });
  });

  it('collects image hashes from carousel cards and asset_feed_spec', async () => {
    let requestedHashes: string[] = [];
    const metaGet = vi
      .fn()
      .mockImplementation(async (path: string, params: Record<string, unknown>) => {
        if (path === '/act_123/ads') {
          return {
            data: [
              {
                id: 'ad_carousel',
                creative: {
                  id: 'cr_carousel',
                  object_story_spec: {
                    link_data: {
                      image_hash: 'hash_main',
                      child_attachments: [
                        { image_hash: 'hash_card_1' },
                        { image_hash: 'hash_card_2' },
                      ],
                    },
                  },
                  asset_feed_spec: { images: [{ hash: 'hash_feed' }] },
                },
              },
            ],
          };
        }

        if (path === '/act_123/adimages') {
          requestedHashes = JSON.parse(String(params.hashes)) as string[];
          return { data: [] };
        }

        return { data: [] };
      });

    const result = await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: 'act_123',
    });

    expect(requestedHashes).toEqual(['hash_main', 'hash_card_1', 'hash_card_2', 'hash_feed']);
    expect(result[0].image_hashes).toEqual([
      'hash_main',
      'hash_card_1',
      'hash_card_2',
      'hash_feed',
    ]);
    expect(result[0].media_kind).toBe('image');
  });

  it('exposes the Meta paging cursor on the returned page', async () => {
    const metaGet = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/act_123/ads') {
        return {
          data: [{ id: 'ad_1', creative: { id: 'cr_1' } }],
          paging: { cursors: { after: 'cursor_next' } },
        };
      }
      return { data: [] };
    });

    const result = await resolveCreativeAssets({ metaGet } as unknown as MetaClient, {
      adAccountId: 'act_123',
    });

    expect(result.paging?.cursors?.after).toBe('cursor_next');
  });
});
