import { describe, expect, it } from 'vitest';
import { evaluateMetaCreativeCompliance } from '../src/providers/meta/creativeCompliance.js';

const completePlacementSpec = {
  images: [
    { hash: 'feed_hash', adlabels: [{ name: 'feed_asset' }] },
    { hash: 'vertical_hash', adlabels: [{ name: 'vertical_asset' }] },
  ],
  asset_customization_rules: [
    {
      image_label: { name: 'feed_asset' },
      customization_spec: {
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed'],
        instagram_positions: ['stream'],
      },
    },
    {
      image_label: { name: 'vertical_asset' },
      customization_spec: {
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['facebook_reels', 'story'],
        instagram_positions: ['reels', 'story'],
      },
    },
  ],
};

describe('evaluateMetaCreativeCompliance', () => {
  it('passes explicit AI opt-outs, empty related media, and all placement families', () => {
    const result = evaluateMetaCreativeCompliance({
      degrees_of_freedom_spec: {
        creative_features_spec: {
          image_auto_crop: { enroll_status: 'OPT_OUT' },
          text_generation: { enroll_status: 'OPT_OUT' },
        },
      },
      media_sourcing_spec: { related_media: [] },
      asset_feed_spec: completePlacementSpec,
    });

    expect(result.ai_creative).toMatchObject({ status: 'PASS', enabled_features: [] });
    expect(result.related_media.status).toBe('PASS');
    expect(result.placement_customization).toMatchObject({
      status: 'PASS',
      feed: 'PASS',
      reels: 'PASS',
      story: 'PASS',
      preview_required: true,
    });
  });

  it('fails AI compliance and lists every opted-in feature deterministically', () => {
    const result = evaluateMetaCreativeCompliance({
      degrees_of_freedom_spec: {
        creative_features_spec: {
          text_generation: { enroll_status: 'OPT_IN' },
          image_auto_crop: { enroll_status: 'OPT_IN' },
          standard_enhancements: { enroll_status: 'OPT_OUT' },
        },
      },
    });

    expect(result.ai_creative).toMatchObject({
      status: 'FAIL',
      enabled_features: ['image_auto_crop', 'text_generation'],
    });
  });

  it('returns unknown instead of treating missing provider fields as safe', () => {
    const result = evaluateMetaCreativeCompliance({});

    expect(result.ai_creative.status).toBe('UNKNOWN');
    expect(result.related_media.status).toBe('UNKNOWN');
    expect(result.placement_customization).toMatchObject({
      status: 'UNKNOWN',
      feed: 'UNKNOWN',
      reels: 'UNKNOWN',
      story: 'UNKNOWN',
      preview_required: true,
    });
  });

  it('returns unknown when an AI feature has an unrecognized enrollment status', () => {
    const result = evaluateMetaCreativeCompliance({
      degrees_of_freedom_spec: {
        creative_features_spec: {
          image_auto_crop: { enroll_status: 'AUTOMATIC' },
        },
      },
    });

    expect(result.ai_creative.status).toBe('UNKNOWN');
  });

  it('fails related media when Meta returns a non-empty related media list', () => {
    const result = evaluateMetaCreativeCompliance({
      media_sourcing_spec: { related_media: [{ id: 'media_1' }] },
    });

    expect(result.related_media.status).toBe('FAIL');
  });

  it('fails related media when Meta returns a non-empty related media object', () => {
    const result = evaluateMetaCreativeCompliance({
      media_sourcing_spec: {
        related_media: { images: [{ id: 'media_1' }] },
      },
    });

    expect(result.related_media.status).toBe('FAIL');
  });

  it('passes related media when Meta returns an empty related media object', () => {
    const result = evaluateMetaCreativeCompliance({
      media_sourcing_spec: { related_media: {} },
    });

    expect(result.related_media.status).toBe('PASS');
  });

  it('passes related media when the media sourcing spec has no related media', () => {
    const result = evaluateMetaCreativeCompliance({ media_sourcing_spec: {} });

    expect(result.related_media.status).toBe('PASS');
  });

  it('fails aggregate placement compliance when Story has no labeled rule', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        ...completePlacementSpec,
        asset_customization_rules: completePlacementSpec.asset_customization_rules.map((rule) => ({
          ...rule,
          customization_spec: {
            ...rule.customization_spec,
            facebook_positions: rule.customization_spec.facebook_positions.filter(
              (position) => position !== 'story'
            ),
            instagram_positions: rule.customization_spec.instagram_positions.filter(
              (position) => position !== 'story'
            ),
          },
        })),
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'FAIL',
      feed: 'PASS',
      reels: 'PASS',
      story: 'FAIL',
      preview_required: true,
    });
  });

  it('returns unknown when a placement rule label is missing from the assets', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        ...completePlacementSpec,
        images: [],
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'UNKNOWN',
      feed: 'UNKNOWN',
      reels: 'UNKNOWN',
      story: 'UNKNOWN',
    });
  });

  it('returns unknown for malformed customization rules', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        images: completePlacementSpec.images,
        asset_customization_rules: [null],
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'UNKNOWN',
      feed: 'UNKNOWN',
      reels: 'UNKNOWN',
      story: 'UNKNOWN',
    });
  });

  it('returns unknown when Meta returns unrecognized placement values', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        images: completePlacementSpec.images,
        asset_customization_rules: [
          {
            image_label: { name: 'feed_asset' },
            customization_spec: {
              publisher_platforms: ['facebook'],
              facebook_positions: ['future_surface'],
            },
          },
        ],
      },
    });

    expect(result.placement_customization.status).toBe('UNKNOWN');
  });

  it('ignores positions for a platform excluded by publisher_platforms', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        images: completePlacementSpec.images,
        asset_customization_rules: [
          {
            image_label: { name: 'feed_asset' },
            customization_spec: {
              publisher_platforms: ['instagram'],
              facebook_positions: ['feed'],
              instagram_positions: [],
            },
          },
        ],
      },
    });

    expect(result.placement_customization.feed).toBe('FAIL');
  });

  it('does not allow an image rule to resolve a label that exists only on a video', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        videos: [{ video_id: 'video_1', adlabels: [{ name: 'shared_asset' }] }],
        asset_customization_rules: [
          {
            image_label: { name: 'shared_asset' },
            customization_spec: {
              publisher_platforms: ['facebook'],
              facebook_positions: ['feed'],
            },
          },
        ],
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'UNKNOWN',
      feed: 'UNKNOWN',
    });
  });

  it('accepts a video rule when its label resolves to a video asset', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        videos: [{ video_id: 'video_1', adlabels: [{ name: 'video_asset' }] }],
        asset_customization_rules: [
          {
            video_label: { name: 'video_asset' },
            customization_spec: {
              publisher_platforms: ['facebook'],
              facebook_positions: ['feed', 'facebook_reels', 'story'],
            },
          },
        ],
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'PASS',
      feed: 'PASS',
      reels: 'PASS',
      story: 'PASS',
    });
  });
});
