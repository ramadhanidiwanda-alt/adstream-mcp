import { describe, expect, it } from 'vitest';
import { buildMetaCreativeFormatPayload } from '../src/providers/meta/buildCreativeFormatPayload.js';

describe('buildMetaCreativeFormatPayload', () => {
  it('builds a standard single-image link creative', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-hash',
          primaryText: 'Belanja sekarang',
          headline: 'Promo Payday',
          destinationUrl: 'https://example.com/payday',
          callToAction: 'SHOP_NOW',
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        link_data: {
          image_hash: 'image-hash',
          message: 'Belanja sekarang',
          name: 'Promo Payday',
          link: 'https://example.com/payday',
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: 'https://example.com/payday' },
          },
        },
      },
    });
  });

  it('builds video_data with CTA link and optional thumbnail image_hash', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          thumbnailImageHash: 'thumb-1',
          primaryText: 'Tonton produknya',
          destinationUrl: 'https://example.com/video',
          callToAction: 'SHOP_NOW',
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        video_data: {
          video_id: 'video-1',
          image_hash: 'thumb-1',
          message: 'Tonton produknya',
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: 'https://example.com/video' },
          },
        },
      },
    });

    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          primaryText: 'Tonton produknya',
          destinationUrl: 'https://example.com/video',
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        video_data: {
          video_id: 'video-1',
          message: 'Tonton produknya',
          call_to_action: {
            type: 'LEARN_MORE',
            value: { link: 'https://example.com/video' },
          },
        },
      },
    });
  });

  it('builds carousel link attachments with an independent CTA per card', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'carousel',
        creativeSpec: {
          primaryText: 'Pilih produk',
          callToAction: 'SHOP_NOW',
          cards: [
            {
              imageHash: 'one',
              headline: 'Satu',
              destinationUrl: 'https://example.com/one',
            },
            {
              videoId: 'two',
              headline: 'Dua',
              destinationUrl: 'https://example.com/two',
            },
          ],
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        carousel_data: {
          message: 'Pilih produk',
          attachment_style: 'link',
          child_attachments: [
            {
              image_hash: 'one',
              name: 'Satu',
              link: 'https://example.com/one',
              call_to_action: {
                type: 'SHOP_NOW',
                value: { link: 'https://example.com/one' },
              },
            },
            {
              video_id: 'two',
              name: 'Dua',
              link: 'https://example.com/two',
              call_to_action: {
                type: 'SHOP_NOW',
                value: { link: 'https://example.com/two' },
              },
            },
          ],
        },
      },
    });
  });

  it('requires at least two valid carousel cards', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'carousel',
        creativeSpec: {
          primaryText: 'Pilih produk',
          cards: [
            {
              imageHash: 'one',
              headline: 'Satu',
              destinationUrl: 'https://example.com/one',
            },
          ],
        },
      })
    ).toThrow(/minimal 2 kartu/i);
  });

  it('rejects carousel cards with no media or more than one media identifier', () => {
    const baseInput = {
      mode: 'standard' as const,
      pageId: 'page-1',
      creativeFormat: 'carousel' as const,
      creativeSpec: {
        primaryText: 'Pilih produk',
        cards: [
          {
            imageHash: 'one',
            headline: 'Satu',
            destinationUrl: 'https://example.com/one',
          },
        ],
      },
    };

    expect(() =>
      buildMetaCreativeFormatPayload({
        ...baseInput,
        creativeSpec: {
          ...baseInput.creativeSpec,
          cards: [
            ...baseInput.creativeSpec.cards,
            { headline: 'Dua', destinationUrl: 'https://example.com/two' },
          ],
        },
      })
    ).toThrow(/tepat satu media/i);

    expect(() =>
      buildMetaCreativeFormatPayload({
        ...baseInput,
        creativeSpec: {
          ...baseInput.creativeSpec,
          cards: [
            ...baseInput.creativeSpec.cards,
            {
              imageHash: 'two-image',
              videoId: 'two-video',
              headline: 'Dua',
              destinationUrl: 'https://example.com/two',
            },
          ],
        },
      })
    ).toThrow(/tepat satu media/i);
  });

  it('rejects blank asset IDs, copy, and URLs locally', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: ' ',
          primaryText: 'Copy',
          destinationUrl: 'https://example.com',
        },
      })
    ).toThrow(/imageHash wajib diisi/i);

    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          primaryText: ' ',
          destinationUrl: 'https://example.com',
        },
      })
    ).toThrow(/primaryText wajib diisi/i);

    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'carousel',
        creativeSpec: {
          primaryText: 'Pilih produk',
          cards: [
            {
              imageHash: 'one',
              headline: 'Satu',
              destinationUrl: 'https://example.com/one',
            },
            {
              videoId: 'two',
              headline: 'Dua',
              destinationUrl: ' ',
            },
          ],
        },
      })
    ).toThrow(/destinationUrl wajib diisi/i);
  });

  it('builds an existing post without requiring pageId in the story body', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: { objectStoryId: 'page-1_post-1' },
      })
    ).toEqual({ object_story_id: 'page-1_post-1' });
  });
});
