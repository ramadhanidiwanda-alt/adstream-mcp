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

  it('does not count a placement rule whose label is missing from the assets', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        ...completePlacementSpec,
        images: [],
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'FAIL',
      feed: 'FAIL',
      reels: 'FAIL',
      story: 'FAIL',
    });
  });
});
