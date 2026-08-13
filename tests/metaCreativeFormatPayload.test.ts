import { describe, expect, it } from 'vitest';
import { buildMetaCreativeFormatPayload } from '../src/providers/meta/buildCreativeFormatPayload.js';
import { readNested } from './support/json.js';

describe('buildMetaCreativeFormatPayload', () => {
  it('builds the typed CPAS video retailer template without omnichannel fields', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      collaborativeProductSetId: 'product-set-1',
      catalogOnly: true,
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        primaryText: 'Shop the catalog',
        destinationUrl: 'https://fb.com/canvas_doc/canvas-1',
        callToAction: 'SHOP_NOW',
        retailerItemIds: ['0', '0', '0', '0'],
        postClickConfiguration: {
          itemHeadline: '{{product.name}}',
          itemDescription: '{{product.current_price strip_zeros}}',
        },
        templateUrlSpec: { applicationId: 'retailer-app-1' },
      },
    });

    expect(payload).toMatchObject({
      template_url_spec: { config: { app_id: 'retailer-app-1' } },
      object_story_spec: {
        video_data: {
          video_id: 'video-1',
          retailer_item_ids: ['0', '0', '0', '0'],
          post_click_configuration: {
            post_click_item_headline: '{{product.name}}',
          },
        },
      },
    });
    expect(payload).not.toHaveProperty('omnichannel_link_spec');
    expect(payload).not.toHaveProperty('applink_treatment');
  });

  it('builds a catalog video-carousel hybrid without video_data or canvas', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      collaborativeProductSetId: 'product-set-1',
      catalogOnly: true,
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Shop the catalog',
        headline: 'Watch now',
        destinationUrl: 'https://retailer.example/universal-link',
        presentation: 'video_carousel',
        hybridVideo: { videoId: 'video-1', thumbnailUrl: 'https://cdn.example/video.jpg' },
      },
    });

    expect(payload).toMatchObject({
      product_set_id: 'product-set-1',
      asset_feed_spec: { ad_formats: ['CAROUSEL', 'COLLECTION'] },
      object_story_spec: {
        template_data: {
          child_attachments: [
            { video_id: 'video-1', static_card: true },
            { name: '{{product.name}}' },
          ],
        },
      },
    });
    expect(payload.object_story_spec).not.toHaveProperty('video_data');
  });

  it('builds an Awareness single image without an external URL or CTA', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          destinationMode: 'NONE',
          imageHash: 'image-hash',
          primaryText: 'Kenali brand kami',
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        photo_data: {
          image_hash: 'image-hash',
          message: 'Kenali brand kami',
        },
      },
    });
  });

  it('keeps Traffic single images URL-backed with the default LEARN_MORE CTA', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          destinationMode: 'EXTERNAL_URL',
          imageHash: 'image-hash',
          primaryText: 'Kunjungi situs kami',
        },
      })
    ).toThrow(/destinationUrl wajib diisi/i);

    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          destinationMode: 'EXTERNAL_URL',
          imageHash: 'image-hash',
          primaryText: 'Kunjungi situs kami',
          destinationUrl: 'https://example.com',
        },
      })
    ).toMatchObject({
      object_story_spec: {
        link_data: {
          link: 'https://example.com',
          call_to_action: { type: 'LEARN_MORE', value: { link: 'https://example.com' } },
        },
      },
    });
  });

  it('builds an Instant Form single image without an external link', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          destinationMode: 'INSTANT_FORM',
          imageHash: 'hash-1',
          primaryText: 'Book a consultation',
          headline: 'Talk to our team',
          callToAction: 'SIGN_UP',
          leadFormId: 'form-1',
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        link_data: {
          image_hash: 'hash-1',
          message: 'Book a consultation',
          name: 'Talk to our team',
          call_to_action: {
            type: 'SIGN_UP',
            value: { lead_gen_form_id: 'form-1' },
          },
        },
      },
    });
  });

  it('rejects leadFormId outside the resolved Instant Form destination mode', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          destinationMode: 'EXTERNAL_URL',
          imageHash: 'hash-1',
          primaryText: 'Book a consultation',
          destinationUrl: 'https://example.com',
          leadFormId: 'form-1',
        },
      })
    ).toThrow(/leadFormId.*INSTANT_FORM/i);
  });

  it('builds an Engagement existing post without fabricating an external URL', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          objectStoryId: 'page-1_post-1',
        },
      })
    ).toEqual({ object_story_id: 'page-1_post-1' });
  });

  it('builds an Engagement video without a CTA and retains thumbnail fallback', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'video',
        creativeSpec: {
          destinationMode: 'NONE',
          videoId: 'video-1',
          thumbnailImageUrl: 'https://example.com/thumbnail.jpg',
          primaryText: 'Tonton videonya',
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        video_data: {
          video_id: 'video-1',
          image_url: 'https://example.com/thumbnail.jpg',
          message: 'Tonton videonya',
        },
      },
    });
  });

  it('builds a standard App Promotion video CTA without CPAS omnichannel fields', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      standardAppSpec: {
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
        deepLinkUrl: 'myapp://home',
      },
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        primaryText: 'Install the app',
        destinationUrl: 'https://apps.apple.com/app/id123',
      },
    });

    expect(result).toMatchObject({
      object_story_spec: {
        page_id: 'page-1',
        video_data: {
          video_id: 'video-1',
          call_to_action: {
            type: 'INSTALL_MOBILE_APP',
            value: {
              link: 'myapp://home',
              app_link: 'myapp://home',
              application: 'app-1',
            },
          },
        },
      },
    });
    expect(result).not.toHaveProperty('omnichannel_link_spec');
    expect(result).not.toHaveProperty('applink_treatment');
  });

  it('rejects WHATSAPP_MESSAGE when a standard app spec is supplied', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        standardAppSpec: {
          applicationId: 'app-1',
          objectStoreUrl: 'https://apps.apple.com/app/id123',
        },
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Install now',
          destinationUrl: 'https://apps.apple.com/app/id123',
          callToAction: 'WHATSAPP_MESSAGE',
        },
      })
    ).toThrow(/WHATSAPP_MESSAGE.*standardAppSpec/i);
  });

  it('rejects collaborative_ads mode when a standard app spec is supplied', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'collaborative_ads',
        pageId: 'page-1',
        collaborativeProductSetId: 'product-set-1',
        standardAppSpec: {
          applicationId: 'app-1',
          objectStoreUrl: 'https://apps.apple.com/app/id123',
        },
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          primaryText: 'Install now',
          destinationUrl: 'https://apps.apple.com/app/id123',
        },
      })
    ).toThrow(/standardAppSpec.*collaborative_ads/i);
  });

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
    expect(
      readNested(result, 'object_story_spec', 'link_data', 'call_to_action')
    ).not.toHaveProperty('value');
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
        call_to_action: {
          type: 'WHATSAPP_MESSAGE',
          value: {
            link: 'https://api.whatsapp.com/send',
            app_destination: 'WHATSAPP',
          },
        },
        page_welcome_message: { type: 'VISUAL_EDITOR' },
      },
    });
  });

  it('wraps a plain direct-video CTWA welcome string in Meta VISUAL_EDITOR payload', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        thumbnailImageHash: 'thumb-1',
        primaryText: 'Mid month sale',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
        pageWelcomeMessage: 'Halo, saya ingin cek promo.',
      },
    });

    expect(result.object_story_spec).toMatchObject({
      video_data: {
        page_welcome_message: {
          type: 'VISUAL_EDITOR',
          version: 2,
          landing_screen_type: 'welcome_message',
          media_type: 'text',
          text_format: {
            customer_action_type: 'autofill_message',
            message: {
              text: 'Halo, saya ingin cek promo.',
              autofill_message: { content: 'Halo, saya ingin cek promo.' },
            },
          },
        },
      },
    });
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
    expect(readNested(result, 'object_story_spec', 'video_data')).not.toHaveProperty('description');
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

  it('builds an existing_post creative from sourceInstagramMediaId when the IG media has no Page post', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: { sourceInstagramMediaId: '17895695668004550' },
      })
    ).toEqual({ source_instagram_media_id: '17895695668004550' });
  });

  // Verified live against v25.0 on 2026-07-25: a REELS/video media id alone is
  // rejected with (#100) subcode 1815279, whose message claims the video "must be
  // uploaded to Facebook". It does not have to be — Meta simply cannot tell which
  // IG account owns the media. Adding instagram_user_id makes the identical
  // create succeed. Meta infers the owner for IMAGE media, which is why photo
  // posts worked without it and video looked impossible.
  it('carries instagram_user_id at the top level so an existing IG video is promotable', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: '100338525395228',
        instagramUserId: '17841421517309865',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18108738530070830',
          destinationUrl: 'https://pnpbeautyindonesia.com/',
          callToAction: 'SHOP_NOW',
        },
      })
    ).toEqual({
      source_instagram_media_id: '18108738530070830',
      instagram_user_id: '17841421517309865',
      call_to_action: {
        type: 'SHOP_NOW',
        value: { link: 'https://pnpbeautyindonesia.com/' },
      },
    });
  });

  it('omits instagram_user_id from an existing_post creative when none is given', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: { objectStoryId: 'page-1_123' },
      })
    ).toEqual({ object_story_id: 'page-1_123' });
  });

  // The destination rides on a TOP-LEVEL call_to_action. Nesting it in
  // object_story_spec makes Meta reject the create with (#100) subcode 1487929
  // "Ambiguous Promoted Object" — verified live against v25.0.
  it('sends an existing IG post to an external link via a top-level call_to_action', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: '330290916841848',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          destinationUrl: 'https://hurricane.gass.my.id/cta?x=1',
          callToAction: 'LEARN_MORE',
        },
      })
    ).toEqual({
      source_instagram_media_id: '18571075747064659',
      call_to_action: {
        type: 'LEARN_MORE',
        value: { link: 'https://hurricane.gass.my.id/cta?x=1' },
      },
    });
  });

  it('never nests the existing_post destination inside object_story_spec', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: '330290916841848',
      creativeFormat: 'existing_post',
      creativeSpec: {
        sourceInstagramMediaId: '18571075747064659',
        destinationUrl: 'https://hurricane.gass.my.id/cta?x=1',
        callToAction: 'LEARN_MORE',
      },
    });

    expect(payload.object_story_spec).toBeUndefined();
  });

  it('also accepts a destination on an existing Facebook Page post', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          objectStoryId: 'page-1_post-1',
          destinationUrl: 'https://example.com/cta',
          callToAction: 'SHOP_NOW',
        },
      })
    ).toEqual({
      object_story_id: 'page-1_post-1',
      call_to_action: { type: 'SHOP_NOW', value: { link: 'https://example.com/cta' } },
    });
  });

  it('requires destinationUrl for an existing_post creative that sets callToAction', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          callToAction: 'LEARN_MORE',
        },
      })
    ).toThrow(/destinationUrl.*wajib diisi/i);
  });

  it('rejects a silently unused destinationUrl on an existing_post creative', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          destinationUrl: 'https://example.com/cta',
        },
      })
    ).toThrow(/destinationUrl.*butuh callToAction/is);
  });

  // Regression for the 2026-07-26 CTX incident: Meta accepts the existing-post
  // Instagram messaging CTA only when the value carries both app_destination and
  // link. appDestination alone dry-runs locally but Graph rejects it with subcode
  // 2061015 ("link required").
  it('builds a Click-to-Instagram-Direct existing_post creative with app_destination, link, and a welcome message', () => {
    const pageWelcomeMessage = {
      type: 'VISUAL_EDITOR',
      version: 2,
      landing_screen_type: 'welcome_message',
      media_type: 'text',
      text_format: {
        customer_action_type: 'ice_breakers',
        message: {
          text: 'Halo! Ada yang bisa kami bantu?',
          ice_breakers: [{ title: 'Cek harga', response: 'Produk mana yang kamu minati?' }],
        },
      },
    };

    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: '100338525395228',
        instagramUserId: '17841421517309865',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18170919886430243',
          callToAction: 'INSTAGRAM_MESSAGE',
          appDestination: 'INSTAGRAM_DIRECT',
          destinationUrl: 'https://www.instagram.com/',
          pageWelcomeMessage,
        },
      })
    ).toEqual({
      source_instagram_media_id: '18170919886430243',
      instagram_user_id: '17841421517309865',
      call_to_action: {
        type: 'INSTAGRAM_MESSAGE',
        value: {
          app_destination: 'INSTAGRAM_DIRECT',
          link: 'https://www.instagram.com/',
        },
      },
      page_welcome_message: pageWelcomeMessage,
    });
  });

  // Ads Manager stores both at the creative root for existing-post creatives — the
  // creative it writes has no object_story_spec at all.
  it('keeps the CTX call_to_action and page_welcome_message at the creative root', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: '100338525395228',
      creativeFormat: 'existing_post',
      creativeSpec: {
        sourceInstagramMediaId: '18170919886430243',
        callToAction: 'INSTAGRAM_MESSAGE',
        appDestination: 'INSTAGRAM_DIRECT',
        destinationUrl: 'https://www.instagram.com/',
        pageWelcomeMessage: 'Halo!',
      },
    });

    expect(payload.object_story_spec).toBeUndefined();
    expect(payload.call_to_action).toEqual({
      type: 'INSTAGRAM_MESSAGE',
      value: {
        app_destination: 'INSTAGRAM_DIRECT',
        link: 'https://www.instagram.com/',
      },
    });
    expect(payload.page_welcome_message).toBe('Halo!');
  });

  it('does not require destinationUrl for non-WhatsApp messaging call to action without appDestination on an existing_post creative', () => {
    for (const callToAction of ['INSTAGRAM_MESSAGE', 'MESSAGE_PAGE']) {
      expect(
        buildMetaCreativeFormatPayload({
          mode: 'standard',
          pageId: 'page-1',
          creativeFormat: 'existing_post',
          creativeSpec: { objectStoryId: 'page-1_post-1', callToAction },
        })
      ).toEqual({
        object_story_id: 'page-1_post-1',
        call_to_action: { type: callToAction },
      });
    }
  });

  it('builds a Click-to-WhatsApp existing_post creative like Ads Manager', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          callToAction: 'WHATSAPP_MESSAGE',
          appDestination: 'WHATSAPP',
          destinationUrl: 'https://wa.me/6285156583372',
          pageWelcomeMessage: 'Halo!',
        },
      })
    ).toEqual({
      source_instagram_media_id: '18571075747064659',
      call_to_action: {
        type: 'WHATSAPP_MESSAGE',
        value: {
          app_destination: 'WHATSAPP',
          link: 'https://api.whatsapp.com/send',
        },
      },
      page_welcome_message: 'Halo!',
    });
  });

  it('rejects a messaging destinationUrl that would be silently dropped without appDestination', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18170919886430243',
          callToAction: 'INSTAGRAM_MESSAGE',
          destinationUrl: 'https://www.instagram.com/',
        },
      })
    ).toThrow(/destinationUrl.*appDestination/is);
  });

  it('requires destinationUrl when appDestination is set on an existing_post messaging creative', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18170919886430243',
          callToAction: 'INSTAGRAM_MESSAGE',
          appDestination: 'INSTAGRAM_DIRECT',
        },
      })
    ).toThrow(/destinationUrl.*appDestination/is);
  });

  it('rejects appDestination without a callToAction on an existing_post creative', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18170919886430243',
          appDestination: 'INSTAGRAM_DIRECT',
        },
      })
    ).toThrow(/appDestination.*callToAction/is);
  });

  it('rejects pageWelcomeMessage without a messaging callToAction on an existing_post creative', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          objectStoryId: 'page-1_post-1',
          callToAction: 'LEARN_MORE',
          destinationUrl: 'https://example.com/cta',
          pageWelcomeMessage: 'Halo!',
        },
      })
    ).toThrow(/pageWelcomeMessage/i);
  });

  it('rejects an existing_post creative missing both objectStoryId and sourceInstagramMediaId', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {},
      })
    ).toThrow(/pilih salah satu objectStoryId.*sourceInstagramMediaId/i);
  });

  it('rejects an existing_post creative that sets both objectStoryId and sourceInstagramMediaId', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {
          objectStoryId: 'page-1_post-1',
          sourceInstagramMediaId: '17895695668004550',
        },
      })
    ).toThrow(/pilih salah satu objectStoryId.*sourceInstagramMediaId/i);
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

  it('builds a catalog template with showMultipleImages, forcing multi_share_end_card false (live-verified pairing requirement)', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Produk pilihan',
        destinationUrl: 'https://example.com/products',
        callToAction: 'SHOP_NOW',
        showMultipleImages: true,
      },
    });

    const objectStorySpec = result.object_story_spec as Record<string, unknown>;
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    expect(templateData.show_multiple_images).toBe(true);
    expect(templateData.multi_share_end_card).toBe(false);
  });

  it('forces multi_share_end_card false when showMultipleImages overrides a single_image presentation', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Produk pilihan',
        destinationUrl: 'https://example.com/products',
        presentation: 'single_image',
        showMultipleImages: true,
      },
    });

    const objectStorySpec = result.object_story_spec as Record<string, unknown>;
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    expect(templateData.show_multiple_images).toBe(true);
    expect(templateData.multi_share_end_card).toBe(false);
  });

  it('builds a catalog template with preferredImageTags', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Produk pilihan',
        destinationUrl: 'https://example.com/products',
        preferredImageTags: ['lifestyle', 'studio'],
      },
    });

    const objectStorySpec = result.object_story_spec as Record<string, unknown>;
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    expect(templateData.preferred_image_tags).toEqual(['lifestyle', 'studio']);
  });

  it('builds a catalog template with formatOption inside template_data (not asset_feed_spec)', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Produk pilihan',
        destinationUrl: 'https://example.com/products',
        formatOption: 'carousel_slideshows',
      },
    });

    const objectStorySpec = result.object_story_spec as Record<string, unknown>;
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    expect(templateData.format_option).toBe('carousel_slideshows');
    expect(result).not.toHaveProperty('asset_feed_spec.format_option');
  });

  it('rejects showMultipleImages combined with formatOption (live-verified ObjectStorySpecRedundant)', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'catalog',
        creativeSpec: {
          productSetId: 'product-set-1',
          primaryText: 'Produk pilihan',
          destinationUrl: 'https://example.com/products',
          showMultipleImages: true,
          formatOption: 'carousel_slideshows',
        },
      })
    ).toThrow(/showMultipleImages dan formatOption/);
  });

  it('builds a catalog template with categorizationCriteria at the top level, not inside object_story_spec', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Produk pilihan',
        destinationUrl: 'https://example.com/products',
        categorizationCriteria: 'category',
      },
    });

    expect(result.categorization_criteria).toBe('category');
    const objectStorySpec = result.object_story_spec as Record<string, unknown>;
    expect(objectStorySpec).not.toHaveProperty('categorization_criteria');
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    expect(templateData).not.toHaveProperty('categorization_criteria');
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

  it('keeps catalog-only CPAS creative free of app omnichannel fields', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      catalogOnly: true,
      pageId: 'page-1',
      collaborativeProductSetId: 'product-set-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Belanja di Shopee',
        destinationUrl: 'https://shopee.example/universal-link',
        callToAction: 'SHOP_NOW',
      },
    });

    expect(result).toMatchObject({
      product_set_id: 'product-set-1',
      object_story_spec: {
        template_data: { call_to_action: { type: 'SHOP_NOW' } },
      },
    });
    expect(result).not.toHaveProperty('omnichannel_link_spec');
    expect(result).not.toHaveProperty('applink_treatment');
    const objectStorySpec = result.object_story_spec as Record<string, unknown>;
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    const callToAction = templateData.call_to_action as Record<string, unknown>;
    expect(callToAction).not.toHaveProperty('value');
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
    {
      label: 'catalog',
      expectedDestinationUrl: 'https://example.com/catalog',
      expectedStory: {
        template_data: { message: 'Catalog' },
      },
      expectsProductSet: true,
      input: {
        mode: 'collaborative_ads' as const,
        pageId: 'page-1',
        collaborativeProductSetId: 'product-set-1',
        creativeFormat: 'catalog' as const,
        creativeSpec: {
          productSetId: 'product-set-1',
          primaryText: 'Catalog',
          destinationUrl: 'https://example.com/catalog',
        },
      },
    },
    {
      label: 'collection',
      expectedDestinationUrl: 'https://fb.com/canvas_doc/canvas-1',
      expectedStory: {
        link_data: { image_hash: 'cover-1' },
      },
      expectsProductSet: true,
      input: {
        mode: 'collaborative_ads' as const,
        pageId: 'page-1',
        collaborativeProductSetId: 'product-set-1',
        creativeFormat: 'collection' as const,
        creativeSpec: {
          instantExperienceId: 'canvas-1',
          coverImageHash: 'cover-1',
          productSetId: 'product-set-1',
          primaryText: 'Collection',
        },
      },
    },
  ])(
    'wraps v25 collaborative $label creative in the shared catalog context',
    ({ input, expectedDestinationUrl, expectedStory, expectsProductSet }) => {
      const result = buildMetaCreativeFormatPayload(input);

      expect(result).toMatchObject({
        omnichannel_link_spec: {
          web: { url: expectedDestinationUrl },
        },
        object_story_spec: expectedStory,
      });
      if (expectsProductSet) {
        expect(result.product_set_id).toBe('product-set-1');
      } else {
        expect(result).not.toHaveProperty('product_set_id');
      }
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

  it('rejects flexible Dynamic Creative payload creation', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'flexible',
        creativeSpec: {
          imageHashes: ['image-1', 'image-2'],
          videoIds: ['video-1'],
          primaryText: 'Copy A',
          primaryTexts: ['Copy A', 'Copy B'],
          headlines: ['Headline A'],
          destinationUrl: 'https://example.com/flexible',
          callToAction: 'SHOP_NOW',
        },
      })
    ).toThrow(/Dynamic Creative\/Flexible.*disabled/i);
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

  it('menyisipkan identitas partnership ke creative single_image', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'brand-page-1',
      partnership: {
        partnerPageId: 'creator-page-1',
        partnerInstagramId: 'creator-ig-1',
      },
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'hash-1',
        primaryText: 'Kolaborasi bareng kreator',
        destinationUrl: 'https://example.com',
      },
    });

    expect(payload).toMatchObject({
      facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
      instagram_branded_content: { sponsor_id: 'creator-ig-1' },
      object_story_spec: { page_id: 'brand-page-1' },
    });
  });

  it('memakai Page kreator sebagai page_id ketika primaryIdentity creator', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'brand-page-1',
      partnership: {
        partnerPageId: 'creator-page-1',
        brandInstagramId: 'brand-ig-1',
        primaryIdentity: 'creator',
      },
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'hash-1',
        primaryText: 'Kolaborasi bareng kreator',
        destinationUrl: 'https://example.com',
      },
    });

    expect(payload).toMatchObject({
      object_story_spec: { page_id: 'creator-page-1' },
      facebook_branded_content: { sponsor_page_id: 'brand-page-1' },
      instagram_branded_content: { sponsor_id: 'brand-ig-1' },
    });
  });

  it('membawa object_id dan sponsor pada boost existing_post', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'brand-page-1',
      instagramUserId: 'creator-ig-1',
      partnership: { partnerInstagramId: 'creator-ig-1' },
      creativeFormat: 'existing_post',
      creativeSpec: { sourceInstagramMediaId: 'ig-media-1' },
    });

    expect(payload).toMatchObject({
      object_id: 'brand-page-1',
      source_instagram_media_id: 'ig-media-1',
      instagram_user_id: 'creator-ig-1',
      instagram_branded_content: { sponsor_id: 'creator-ig-1' },
    });
  });

  it('membangun jalur ad code tanpa objectStoryId maupun sourceInstagramMediaId', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'brand-page-1',
      partnership: {
        partnerPageId: 'creator-page-1',
        partnerInstagramId: 'creator-ig-1',
        adCode: 'AD-CODE-XYZ',
        adFormat: '1',
      },
      creativeFormat: 'existing_post',
      creativeSpec: {},
    });

    expect(payload).toEqual({
      object_id: 'brand-page-1',
      branded_content: {
        instagram_boost_post_access_token: 'AD-CODE-XYZ',
        ad_format: '1',
      },
      facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
      instagram_branded_content: { sponsor_id: 'creator-ig-1' },
    });
  });

  it('menyebut partnership.adCode sebagai opsi ketiga saat existing_post tidak punya sumber konten', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'brand-page-1',
        creativeFormat: 'existing_post',
        creativeSpec: {},
      })
    ).toThrow(/partnership\.adCode/);
  });

  it('menolak partnership bersama mode collaborative_ads', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'collaborative_ads',
        pageId: 'brand-page-1',
        collaborativeProductSetId: 'product-set-1',
        partnership: { partnerPageId: 'creator-page-1' },
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'hash-1',
          primaryText: 'Kolaborasi',
          destinationUrl: 'https://example.com',
        },
      })
    ).toThrow(/partnership tidak kompatibel dengan mode collaborative_ads/);
  });

  it('menolak partnership bersama standardAppSpec', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'brand-page-1',
        standardAppSpec: {
          applicationId: 'app-1',
          objectStoreUrl: 'https://play.google.com/store/apps/details?id=app',
        },
        partnership: { partnerPageId: 'creator-page-1' },
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'hash-1',
          primaryText: 'Kolaborasi',
          destinationUrl: 'https://example.com',
        },
      })
    ).toThrow(/standardAppSpec dan partnership tidak dapat digunakan bersamaan/);
  });

  it('menolak partnership pada format catalog', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'brand-page-1',
        partnership: { partnerInstagramId: 'creator-ig-1' },
        creativeFormat: 'catalog',
        creativeSpec: { productSetId: 'ps-1', primaryText: 'Katalog' },
      })
    ).toThrow(/Format catalog tidak mendukung partnership/);
  });
});

describe('buildMetaCreativeFormatPayload — instagramUserId pada jalur ad code', () => {
  it('menolak instagramUserId bersama partnership.adCode alih-alih membuangnya diam-diam', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'brand-page-1',
        instagramUserId: 'creator-ig-1',
        partnership: {
          partnerInstagramId: 'creator-ig-1',
          adCode: 'AD-CODE-XYZ',
          adFormat: 'REELS',
        },
        creativeFormat: 'existing_post',
        creativeSpec: {},
      })
    ).toThrow(/instagramUserId tidak dipakai pada jalur partnership\.adCode/);
  });

  it('tetap mengirim instagram_user_id pada boost via sourceInstagramMediaId', () => {
    const payload = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'brand-page-1',
      instagramUserId: 'creator-ig-1',
      partnership: { partnerInstagramId: 'creator-ig-1' },
      creativeFormat: 'existing_post',
      creativeSpec: { sourceInstagramMediaId: 'ig-media-1' },
    });

    expect(payload).toMatchObject({ instagram_user_id: 'creator-ig-1' });
  });
});
