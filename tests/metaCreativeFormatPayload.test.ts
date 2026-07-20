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

  it('adds page_welcome_message to a single-image CTWA creative', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'image-hash',
        primaryText: 'Payday Sale',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
        pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      },
    });

    expect(result.object_story_spec).toMatchObject({
      link_data: {
        call_to_action: { type: 'WHATSAPP_MESSAGE' },
        page_welcome_message: '{"type":"VISUAL_EDITOR"}',
      },
    });
    expect(result.object_story_spec.link_data.call_to_action).not.toHaveProperty('value');
  });

  it('omits page_welcome_message from single_image when not provided', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'image-hash',
        primaryText: 'Payday Sale',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
      },
    });

    expect(result.object_story_spec).toMatchObject({ link_data: {} });
    const linkData = (result.object_story_spec as Record<string, unknown>).link_data as Record<
      string,
      unknown
    >;
    expect(linkData).not.toHaveProperty('page_welcome_message');
  });

  it('adds page_welcome_message to a video CTWA creative', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        thumbnailImageHash: 'thumb-1',
        primaryText: 'Payday Sale',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
        pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      },
    });

    expect(result.object_story_spec).toMatchObject({
      video_data: {
        call_to_action: { type: 'WHATSAPP_MESSAGE' },
        page_welcome_message: '{"type":"VISUAL_EDITOR"}',
      },
    });
    expect(result.object_story_spec.video_data.call_to_action).not.toHaveProperty('value');
  });

  it('adds official asset_feed_spec message_extensions to placement-image creatives', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'placement_image',
      creativeSpec: {
        feedImageHash: 'feed-image',
        verticalImageHash: 'vertical-image',
        primaryText: 'Chat via WhatsApp',
        headline: 'Tanya stok',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
        messageExtensions: [{ type: 'whatsapp' }],
      } as never,
    });

    expect(result.asset_feed_spec).toMatchObject({
      message_extensions: [{ type: 'whatsapp' }],
    });
  });

  it('adds the Instagram identity and omits unsupported video_data description', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      instagramUserId: 'ig-1',
      collaborativeProductSetId: 'product-set-1',
      collaborativeAppSpec: {
        applicationId: '957549474255294',
        android: { appName: 'Shopee ID', packageName: 'com.shopee.id' },
        ios: { appName: 'Shopee ID', appStoreId: '959841443' },
      },
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        primaryText: 'Tonton produknya',
        headline: 'Promo Payday',
        description: 'Deskripsi link',
        destinationUrl: 'https://example.com/video',
      },
    });

    expect(result.object_story_spec).toMatchObject({
      page_id: 'page-1',
      instagram_user_id: 'ig-1',
      video_data: {
        video_id: 'video-1',
        title: 'Promo Payday',
        call_to_action: {
          value: {
            application: '957549474255294',
            object_store_urls: [
              'http://play.google.com/store/apps/details?id=com.shopee.id',
              'http://itunes.apple.com/app/id959841443',
            ],
          },
        },
      },
    });
    expect(result.object_story_spec.video_data).not.toHaveProperty('description');
    expect(result.omnichannel_link_spec).toMatchObject({
      app: {
        application_id: '957549474255294',
        platform_specs: {
          android: { app_name: 'Shopee ID', package_name: 'com.shopee.id' },
          ios: { app_name: 'Shopee ID', app_store_id: '959841443' },
        },
      },
    });
    expect(result.applink_treatment).toBe('automatic');
    expect(result).not.toHaveProperty('product_set_id');
  });

  it('adds the Instagram identity to canonical single-image creatives', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      instagramUserId: 'ig-1',
      collaborativeProductSetId: 'product-set-1',
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'image-1',
        primaryText: 'Belanja sekarang',
        destinationUrl: 'https://example.com/product',
      },
    });

    expect(result.object_story_spec).toMatchObject({
      page_id: 'page-1',
      instagram_user_id: 'ig-1',
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
        link_data: {
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

  it('adds omnichannel_link_spec to an existing_post creative when collaborativeAppSpec and destinationUrl are given', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      collaborativeAppSpec: { applicationId: '957549474255294' },
      creativeFormat: 'existing_post',
      creativeSpec: {
        objectStoryId: 'page-1_post-1',
        destinationUrl: 'https://s.shopee.co.id/product',
      },
    });

    expect(result).toMatchObject({
      object_story_id: 'page-1_post-1',
      omnichannel_link_spec: {
        web: { url: 'https://s.shopee.co.id/product' },
        app: { application_id: '957549474255294' },
      },
      applink_treatment: 'automatic',
    });
  });

  it('requires destinationUrl for an existing_post creative when collaborativeAppSpec is given', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        collaborativeAppSpec: { applicationId: '957549474255294' },
        creativeFormat: 'existing_post',
        creativeSpec: { objectStoryId: 'page-1_post-1' },
      })
    ).toThrow(/destinationUrl.*wajib diisi/i);
  });

  it('builds a catalog template with top-level product_set_id', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: ' product-set-1 ',
        primaryText: 'Produk pilihan',
        headline: '{{product.name}}',
        destinationUrl: 'https://example.com/products',
        callToAction: 'SHOP_NOW',
        templateUrl: 'https://example.com/template',
        fallbackImageHash: 'fallback-hash',
      },
    });

    expect(result).toMatchObject({
      product_set_id: 'product-set-1',
      object_story_spec: {
        page_id: 'page-1',
        template_data: {
          message: 'Produk pilihan',
          name: '{{product.name}}',
          link: 'https://example.com/products',
          template_url: 'https://example.com/template',
          image_hash: 'fallback-hash',
        },
      },
    });
    expect(result.object_story_spec).not.toHaveProperty('link_data');
    expect(result).not.toHaveProperty('asset_feed_spec');
    expect(result).not.toHaveProperty('omnichannel_link_spec');
  });

  it('adds omnichannel_link_spec for collaborative catalog creative', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      collaborativeProductSetId: 'product-set-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Belanja di Shopee',
        destinationUrl: 'https://shopee.example/store',
        callToAction: 'SHOP_NOW',
      },
    });

    expect(result).toMatchObject({
      product_set_id: 'product-set-1',
      omnichannel_link_spec: {
        web: { url: 'https://shopee.example/store' },
      },
    });
    expect(result).not.toHaveProperty('asset_feed_spec');
  });

  it('rejects mismatched collaborative product sets', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'collaborative_ads',
        pageId: 'page-1',
        collaborativeProductSetId: 'adset-product-set',
        creativeFormat: 'catalog',
        creativeSpec: {
          productSetId: 'creative-product-set',
          primaryText: 'Produk',
          destinationUrl: 'https://example.com',
        },
      })
    ).toThrow(/product set.*harus sama/i);
  });

  it.each([
    {
      label: 'poster',
      expectedDestinationUrl: 'https://example.com/poster',
      expectedStory: {
        link_data: {
          image_hash: 'poster-hash',
          link: 'https://example.com/poster',
        },
      },
      input: {
        mode: 'collaborative_ads' as const,
        pageId: 'page-1',
        collaborativeProductSetId: 'product-set-1',
        creativeFormat: 'single_image' as const,
        creativeSpec: {
          imageHash: 'poster-hash',
          primaryText: 'Poster',
          destinationUrl: 'https://example.com/poster',
        },
      },
    },
    {
      label: 'video',
      expectedDestinationUrl: 'https://example.com/video',
      expectedStory: {
        video_data: {
          video_id: 'video-1',
        },
      },
      input: {
        mode: 'collaborative_ads' as const,
        pageId: 'page-1',
        collaborativeProductSetId: 'product-set-1',
        creativeFormat: 'video' as const,
        creativeSpec: {
          videoId: 'video-1',
          primaryText: 'Video',
          destinationUrl: 'https://example.com/video',
        },
      },
    },
    {
      label: 'carousel',
      expectedDestinationUrl: 'https://example.com/carousel',
      expectedStory: {
        link_data: {
          child_attachments: [{ image_hash: 'one' }, { video_id: 'two' }],
        },
      },
      input: {
        mode: 'collaborative_ads' as const,
        pageId: 'page-1',
        collaborativeProductSetId: 'product-set-1',
        creativeFormat: 'carousel' as const,
        creativeSpec: {
          primaryText: 'Carousel',
          destinationUrl: 'https://example.com/carousel',
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
      },
    },
  ])(
    'wraps collaborative $label creative in shared catalog context',
    ({ input, expectedDestinationUrl, expectedStory }) => {
      const result = buildMetaCreativeFormatPayload(input);

      expect(result).toMatchObject({
        omnichannel_link_spec: {
          web: { url: expectedDestinationUrl },
        },
        object_story_spec: expectedStory,
      });
      expect(result).not.toHaveProperty('product_set_id');
      expect(result).not.toHaveProperty('asset_feed_spec');
    }
  );

  it('uses the first carousel card destination for collaborative context when top-level URL is omitted', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      collaborativeProductSetId: 'product-set-1',
      creativeFormat: 'carousel',
      creativeSpec: {
        primaryText: 'Carousel',
        cards: [
          {
            imageHash: 'one',
            headline: 'Satu',
            destinationUrl: 'https://example.com/first',
          },
          {
            imageHash: 'two',
            headline: 'Dua',
            destinationUrl: 'https://example.com/second',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      omnichannel_link_spec: {
        web: { url: 'https://example.com/first' },
      },
    });
  });

  it('links collection cover media to an existing Instant Experience', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'collection',
        creativeSpec: {
          instantExperienceId: 'canvas-1',
          coverImageHash: 'cover-1',
          primaryText: 'Buka koleksi',
          headline: 'Koleksi Payday',
          callToAction: 'SHOP_NOW',
        },
      })
    ).toMatchObject({
      object_story_spec: {
        page_id: 'page-1',
        link_data: {
          link: 'https://fb.com/canvas_doc/canvas-1',
          image_hash: 'cover-1',
          message: 'Buka koleksi',
          name: 'Koleksi Payday',
        },
      },
    });
  });

  it('normalizes and emits product_set_id for a standard Collection creative', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'collection',
      creativeSpec: {
        instantExperienceId: 'canvas-1',
        coverImageHash: 'cover-1',
        productSetId: ' standard-collection-set ',
        primaryText: 'Buka koleksi',
      },
    });

    expect(result).toEqual({
      product_set_id: 'standard-collection-set',
      object_story_spec: {
        page_id: 'page-1',
        link_data: {
          image_hash: 'cover-1',
          message: 'Buka koleksi',
          link: 'https://fb.com/canvas_doc/canvas-1',
          call_to_action: {
            type: 'LEARN_MORE',
            value: { link: 'https://fb.com/canvas_doc/canvas-1' },
          },
        },
      },
    });
  });

  it('requires exactly one Collection cover asset', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'collection',
        creativeSpec: {
          instantExperienceId: 'canvas-1',
          coverImageHash: 'image-1',
          coverVideoId: 'video-1',
          primaryText: 'Koleksi',
        },
      })
    ).toThrow(/pilih salah satu.*cover/i);
  });

  it('wraps collaborative collection in catalog context with the Instant Experience URL', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      collaborativeProductSetId: 'product-set-1',
      creativeFormat: 'collection',
      creativeSpec: {
        instantExperienceId: 'canvas-1',
        coverImageHash: 'cover-1',
        primaryText: 'Buka koleksi',
      },
    });

    expect(result).toMatchObject({
      product_set_id: 'product-set-1',
      omnichannel_link_spec: {
        web: { url: 'https://fb.com/canvas_doc/canvas-1' },
      },
    });
  });

  it('uses one matching product set and the shared envelope for collaborative Collection', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      collaborativeProductSetId: ' shared-collection-set ',
      creativeFormat: 'collection',
      creativeSpec: {
        instantExperienceId: 'canvas-1',
        coverVideoId: 'cover-video-1',
        productSetId: 'shared-collection-set',
        primaryText: 'Buka koleksi video',
      },
    });

    expect(result).toEqual({
      product_set_id: 'shared-collection-set',
      omnichannel_link_spec: {
        web: { url: 'https://fb.com/canvas_doc/canvas-1' },
      },
      object_story_spec: {
        page_id: 'page-1',
        video_data: {
          video_id: 'cover-video-1',
          message: 'Buka koleksi video',
          call_to_action: {
            type: 'LEARN_MORE',
            value: { link: 'https://fb.com/canvas_doc/canvas-1' },
          },
        },
      },
    });
    expect(result).not.toHaveProperty('asset_feed_spec');
  });

  it('rejects mismatched collaborative Collection product sets locally', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'collaborative_ads',
        pageId: 'page-1',
        collaborativeProductSetId: 'adset-collection-set',
        creativeFormat: 'collection',
        creativeSpec: {
          instantExperienceId: 'canvas-1',
          coverImageHash: 'cover-1',
          productSetId: 'creative-collection-set',
          primaryText: 'Buka koleksi',
        },
      })
    ).toThrow(/product set.*harus sama/i);
  });

  it('builds standard flexible asset_feed_spec', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'flexible',
      creativeSpec: {
        imageHashes: ['image-1', 'image-2'],
        videoIds: ['video-1'],
        primaryTexts: ['Copy A', 'Copy B'],
        headlines: ['Headline A'],
        destinationUrl: 'https://example.com/flexible',
        callToAction: 'SHOP_NOW',
      },
    });

    expect(result).toMatchObject({
      object_story_spec: { page_id: 'page-1' },
      asset_feed_spec: {
        images: [{ hash: 'image-1' }, { hash: 'image-2' }],
        videos: [{ video_id: 'video-1' }],
        bodies: [{ text: 'Copy A' }, { text: 'Copy B' }],
        titles: [{ text: 'Headline A' }],
        link_urls: [{ website_url: 'https://example.com/flexible' }],
        call_to_action_types: ['SHOP_NOW'],
        ad_formats: ['SINGLE_IMAGE', 'SINGLE_VIDEO'],
      },
    });
  });

  it('maps feed and vertical images to explicit Meta placements', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      instagramUserId: 'ig-1',
      creativeFormat: 'placement_image',
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'Payday Glowday',
        headline: 'PAYDAY GLOWDAY',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
        pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      },
    });

    expect(result).toEqual({
      object_story_spec: { page_id: 'page-1', instagram_user_id: 'ig-1' },
      asset_feed_spec: {
        ad_formats: ['SINGLE_IMAGE'],
        images: [
          { hash: 'feed-hash', adlabels: [{ name: 'placement_feed_1_1' }] },
          { hash: 'vertical-hash', adlabels: [{ name: 'placement_vertical_9_16' }] },
        ],
        bodies: [{ text: 'Payday Glowday' }],
        titles: [{ text: 'PAYDAY GLOWDAY' }],
        link_urls: [{ website_url: 'https://api.whatsapp.com/send' }],
        call_to_action_types: ['WHATSAPP_MESSAGE'],
        asset_customization_rules: [
          {
            image_label: { name: 'placement_feed_1_1' },
            customization_spec: {
              publisher_platforms: ['facebook', 'instagram'],
              facebook_positions: ['feed'],
              instagram_positions: ['stream'],
            },
          },
          {
            image_label: { name: 'placement_vertical_9_16' },
            customization_spec: {
              publisher_platforms: ['facebook', 'instagram'],
              facebook_positions: ['facebook_reels', 'story'],
              instagram_positions: ['reels', 'story'],
            },
          },
        ],
        additional_data: {
          is_click_to_message: true,
          page_welcome_message: '{"type":"VISUAL_EDITOR"}',
        },
      },
    });
  });

  it('builds CTWA placement customization without Dynamic Creative asset_feed_spec', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      instagramUserId: 'ig-1',
      creativeFormat: 'placement_customized_ctwa',
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'Chat admin untuk promo payday',
        headline: 'PAYDAY GLOWDAY',
        destinationUrl: 'https://api.whatsapp.com/send?phone=628123',
        pageWelcomeMessage: '{"type":"VISUAL_EDITOR","version":2}',
      },
    });

    expect(result).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        instagram_user_id: 'ig-1',
        link_data: {
          image_hash: 'feed-hash',
          message: 'Chat admin untuk promo payday',
          name: 'PAYDAY GLOWDAY',
          link: 'https://api.whatsapp.com/send?phone=628123',
          call_to_action: {
            type: 'WHATSAPP_MESSAGE',
          },
          page_welcome_message: '{"type":"VISUAL_EDITOR","version":2}',
        },
      },
      platform_customizations: {
        instagram: {
          image_hash: 'vertical-hash',
        },
      },
      portrait_customizations: {
        image_hash: 'vertical-hash',
      },
      degrees_of_freedom_spec: {
        creative_features_spec: {
          image_auto_crop: { enroll_status: 'OPT_OUT' },
          text_optimizations: { enroll_status: 'OPT_OUT' },
          image_templates: { enroll_status: 'OPT_OUT' },
          image_brightness_and_contrast: { enroll_status: 'OPT_OUT' },
          image_animation: { enroll_status: 'OPT_OUT' },
          image_background_gen: { enroll_status: 'OPT_OUT' },
          image_uncrop: { enroll_status: 'OPT_OUT' },
          catalog_feed_tag: { enroll_status: 'OPT_OUT' },
          product_extensions: { enroll_status: 'OPT_OUT' },
        },
      },
      media_sourcing_spec: {
        related_media: [],
      },
    });
    expect(result).not.toHaveProperty('asset_feed_spec');
    const features = (
      result.degrees_of_freedom_spec as {
        creative_features_spec: Record<string, unknown>;
      }
    ).creative_features_spec;
    expect(features).not.toHaveProperty('background_generation');
    expect(features).not.toHaveProperty('text_generation');
    expect(features).not.toHaveProperty('expand_image');
    expect(features).not.toHaveProperty('standard_enhancements');
  });

  it('adds omnichannel_link_spec to a placement_image creative when collaborativeAppSpec is given', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      instagramUserId: 'ig-1',
      collaborativeAppSpec: {
        applicationId: '957549474255294',
        android: { appName: 'Shopee ID', packageName: 'com.shopee.id' },
        ios: { appName: 'Shopee ID', appStoreId: '959841443' },
      },
      creativeFormat: 'placement_image',
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'Payday Glowday',
        headline: 'PAYDAY GLOWDAY',
        destinationUrl: 'https://s.shopee.co.id/abc',
        callToAction: 'SHOP_NOW',
      },
    });

    // Placement rules stay intact
    expect((result.asset_feed_spec as Record<string, unknown>).asset_customization_rules).toEqual([
      {
        image_label: { name: 'placement_feed_1_1' },
        customization_spec: {
          publisher_platforms: ['facebook', 'instagram'],
          facebook_positions: ['feed'],
          instagram_positions: ['stream'],
        },
      },
      {
        image_label: { name: 'placement_vertical_9_16' },
        customization_spec: {
          publisher_platforms: ['facebook', 'instagram'],
          facebook_positions: ['facebook_reels', 'story'],
          instagram_positions: ['reels', 'story'],
        },
      },
    ]);
    // Omnichannel applink added
    expect(result.omnichannel_link_spec).toMatchObject({
      web: { url: 'https://s.shopee.co.id/abc' },
      app: {
        application_id: '957549474255294',
        platform_specs: {
          android: { app_name: 'Shopee ID', package_name: 'com.shopee.id' },
          ios: { app_name: 'Shopee ID', app_store_id: '959841443' },
        },
      },
    });
    expect(result.applink_treatment).toBe('automatic');
  });

  it('omits omnichannel_link_spec for a placement_image creative without collaborativeAppSpec', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'placement_image',
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'Payday Glowday',
        headline: 'PAYDAY GLOWDAY',
        destinationUrl: 'https://s.shopee.co.id/abc',
        callToAction: 'SHOP_NOW',
      },
    });

    expect(result).not.toHaveProperty('omnichannel_link_spec');
    expect(result).not.toHaveProperty('applink_treatment');
  });

  it('adds omnichannel_link_spec to a video creative in standard mode when collaborativeAppSpec is given', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      collaborativeAppSpec: {
        applicationId: '957549474255294',
        android: { appName: 'Shopee ID', packageName: 'com.shopee.id' },
      },
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        thumbnailImageHash: 'thumb-1',
        primaryText: 'Tonton produknya',
        destinationUrl: 'https://s.shopee.co.id/video',
      },
    });

    expect(result.omnichannel_link_spec).toMatchObject({
      web: { url: 'https://s.shopee.co.id/video' },
      app: { application_id: '957549474255294' },
    });
    expect(result.applink_treatment).toBe('automatic');
  });

  it('respects an explicit applinkTreatment override on a video creative', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      collaborativeAppSpec: { applicationId: '957549474255294' },
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        thumbnailImageHash: 'thumb-1',
        primaryText: 'Tonton produknya',
        destinationUrl: 'https://s.shopee.co.id/video',
        applinkTreatment: 'deeplink_with_appstore_fallback',
      },
    });

    expect(result.applink_treatment).toBe('deeplink_with_appstore_fallback');
  });

  it('adds omnichannel_link_spec to a single-image creative in standard mode when collaborativeAppSpec is given', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      collaborativeAppSpec: { applicationId: '957549474255294' },
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'image-1',
        primaryText: 'Belanja sekarang',
        destinationUrl: 'https://s.shopee.co.id/product',
      },
    });

    expect(result.omnichannel_link_spec).toMatchObject({
      web: { url: 'https://s.shopee.co.id/product' },
      app: { application_id: '957549474255294' },
    });
    expect(result.applink_treatment).toBe('automatic');
  });

  it('omits omnichannel fields from video/single_image creatives without collaborativeAppSpec', () => {
    const video = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        thumbnailImageHash: 'thumb-1',
        primaryText: 'Tonton produknya',
        destinationUrl: 'https://example.com/video',
      },
    });
    expect(video).not.toHaveProperty('omnichannel_link_spec');
    expect(video).not.toHaveProperty('applink_treatment');

    const singleImage = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'image-1',
        primaryText: 'Belanja sekarang',
        destinationUrl: 'https://example.com/product',
      },
    });
    expect(singleImage).not.toHaveProperty('omnichannel_link_spec');
    expect(singleImage).not.toHaveProperty('applink_treatment');
  });

  it('still requires collaborativeProductSetId for video in explicit collaborative_ads mode', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'collaborative_ads',
        pageId: 'page-1',
        collaborativeAppSpec: { applicationId: '957549474255294' },
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          thumbnailImageHash: 'thumb-1',
          primaryText: 'Tonton produknya',
          destinationUrl: 'https://example.com/video',
        },
      })
    ).toThrow(/Product set Collaborative Ads wajib diisi/i);
  });

  it('rejects identical feed and vertical image hashes', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'placement_image',
        creativeSpec: {
          feedImageHash: 'same-hash',
          verticalImageHash: 'same-hash',
          primaryText: 'Copy',
          headline: 'Headline',
          destinationUrl: 'https://example.com',
        },
      })
    ).toThrow(/harus berbeda/i);
  });

  it('rejects flexible creatives without usable media', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'flexible',
        creativeSpec: {
          imageHashes: [' '],
          videoIds: [],
          primaryTexts: ['Copy'],
          destinationUrl: 'https://example.com/flexible',
        },
      })
    ).toThrow(/media/i);
  });

  it('rejects flexible creatives without usable primary text', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'flexible',
        creativeSpec: {
          imageHashes: ['image-1'],
          primaryTexts: [' '],
          destinationUrl: 'https://example.com/flexible',
        },
      })
    ).toThrow(/primary text/i);
  });

  it('rejects flexible creatives in Collaborative Ads mode locally', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'collaborative_ads',
        pageId: 'page-1',
        creativeFormat: 'flexible',
        creativeSpec: {
          imageHashes: ['image-1'],
          primaryTexts: ['Copy'],
          destinationUrl: 'https://example.com/flexible',
        },
      })
    ).toThrow(/belum didukung.*collaborative ads/i);
  });

  it('rejects placement image creatives in Collaborative Ads mode locally', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'collaborative_ads',
        pageId: 'page-1',
        creativeFormat: 'placement_image',
        creativeSpec: {
          feedImageHash: 'feed-hash',
          verticalImageHash: 'vertical-hash',
          primaryText: 'Copy',
          headline: 'Headline',
          destinationUrl: 'https://example.com',
        },
      })
    ).toThrow(/belum didukung.*collaborative ads/i);
  });
});
