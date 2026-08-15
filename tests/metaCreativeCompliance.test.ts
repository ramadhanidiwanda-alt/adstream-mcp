import { describe, expect, it } from 'vitest';
import {
  deriveMetaActivePlacements,
  evaluateMetaCreativeCompliance,
} from '../src/providers/meta/creativeCompliance.js';

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
  it('treats omitted placement targeting as Meta automatic placements', () => {
    expect(deriveMetaActivePlacements({})).toEqual({
      feed: true,
      reels: true,
      story: true,
    });
  });

  it('treats omitted positions on an enabled platform as automatic positions', () => {
    expect(
      deriveMetaActivePlacements({
        publisher_platforms: ['facebook', 'instagram'],
      })
    ).toEqual({
      feed: true,
      reels: true,
      story: true,
    });
  });

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

  it('uses requested-field evidence to classify omitted AI and related-media settings', () => {
    const result = evaluateMetaCreativeCompliance({
      requested_fields: {
        degrees_of_freedom_spec: true,
        media_sourcing_spec: true,
        asset_feed_spec: true,
      },
    });

    expect(result.ai_creative.status).toBe('NOT_APPLICABLE');
    expect(result.related_media.status).toBe('PASS');
  });

  it('fails active placements without explicit customized media and skips inactive placements', () => {
    const result = evaluateMetaCreativeCompliance({
      requested_fields: {
        degrees_of_freedom_spec: true,
        media_sourcing_spec: true,
        asset_feed_spec: true,
      },
      active_placements: { feed: true, reels: true, story: false },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'FAIL',
      feed: 'FAIL',
      reels: 'FAIL',
      story: 'NOT_APPLICABLE',
    });
  });

  it('fails active placements when asset_feed_spec has no customization rules', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: { images: completePlacementSpec.images },
      requested_fields: { asset_feed_spec: true },
      active_placements: { feed: true, reels: true, story: true },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'FAIL',
      feed: 'FAIL',
      reels: 'FAIL',
      story: 'FAIL',
    });
  });

  it('requires visual review after active placements have explicit customized media', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: completePlacementSpec,
      requested_fields: {
        degrees_of_freedom_spec: true,
        media_sourcing_spec: true,
        asset_feed_spec: true,
      },
      active_placements: { feed: true, reels: true, story: false },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'MANUAL_REVIEW',
      feed: 'MANUAL_REVIEW',
      reels: 'MANUAL_REVIEW',
      story: 'NOT_APPLICABLE',
      preview_required: true,
    });
  });

  it('requires visual review when Meta returns legacy placement customization evidence', () => {
    const result = evaluateMetaCreativeCompliance({
      platform_customizations: { instagram: { image_url: 'https://example.test/vertical.jpg' } },
      requested_fields: { asset_feed_spec: true },
      active_placements: { feed: true, reels: true, story: true },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'MANUAL_REVIEW',
      feed: 'MANUAL_REVIEW',
      reels: 'MANUAL_REVIEW',
      story: 'MANUAL_REVIEW',
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

  it('ignores valid Messenger and Audience Network rules when audited placements are missing', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        images: completePlacementSpec.images,
        asset_customization_rules: [
          {
            image_label: { name: 'feed_asset' },
            customization_spec: {
              publisher_platforms: ['messenger', 'audience_network'],
              messenger_positions: ['messenger_home'],
              audience_network_positions: ['classic', 'rewarded_video'],
            },
          },
        ],
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'FAIL',
      feed: 'FAIL',
      reels: 'FAIL',
      story: 'FAIL',
    });
  });

  it('ignores valid non-audited Facebook and Instagram positions', () => {
    const result = evaluateMetaCreativeCompliance({
      asset_feed_spec: {
        images: completePlacementSpec.images,
        asset_customization_rules: [
          {
            image_label: { name: 'feed_asset' },
            customization_spec: {
              publisher_platforms: ['facebook', 'instagram'],
              facebook_positions: ['feed', 'marketplace', 'right_hand_column'],
              instagram_positions: ['explore', 'profile_feed'],
            },
          },
        ],
      },
    });

    expect(result.placement_customization).toMatchObject({
      status: 'FAIL',
      feed: 'PASS',
      reels: 'FAIL',
      story: 'FAIL',
    });
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

  it('passes a creative that carries both identities explicitly', () => {
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_spec: {
        page_id: '1001',
        instagram_user_id: '17841439260136409',
        threads_user_id: '9876543210',
      },
    });

    expect(identity.status).toBe('PASS');
    expect(identity.instagram_user_id).toBe('17841439260136409');
    expect(identity.threads_user_id).toBe('9876543210');
    expect(identity.threads_identity_source).toBe('explicit');
  });

  it('passes an Instagram-only creative and marks Threads as derived', () => {
    // Meta derives the Threads identity from an Instagram-associated Threads
    // account. Absent threads_user_id here is correct, not a defect.
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_spec: {
        page_id: '1001',
        instagram_user_id: '17841439260136409',
      },
    });

    expect(identity.status).toBe('PASS');
    expect(identity.threads_user_id).toBeUndefined();
    expect(identity.threads_identity_source).toBe('derived_from_instagram');
  });

  it('reads an explicit Threads identity from the payload root when object_story_spec has none', () => {
    // The existing_post sourceInstagramMediaId path writes instagram_user_id and
    // threads_user_id at the payload root, not inside object_story_spec (no
    // object_story_spec at all on that path). A creative built there must still
    // report the identity as explicit, not derived_from_instagram — otherwise a
    // Threads identity that was deliberately pinned would read back as unpinned.
    const { identity } = evaluateMetaCreativeCompliance({
      instagram_user_id: '17841439260136409',
      threads_user_id: '9876543210',
    });

    expect(identity.status).toBe('PASS');
    expect(identity.instagram_user_id).toBe('17841439260136409');
    expect(identity.threads_user_id).toBe('9876543210');
    expect(identity.threads_identity_source).toBe('explicit');
  });

  it('flags a creative whose object_story_spec carries only a page_id for manual review, not FAIL', () => {
    // NOT a FAIL: live evidence from act_1417353822551653 shows Meta falls back
    // to the Facebook Page's connected Instagram account when instagram_user_id
    // isn't pinned. Creative 1922703931759714 (no instagram_user_id) and
    // creative 2080446776238802 (explicit instagram_user_id) are structurally
    // identical siblings under the same page_id, both ACTIVE, and both carry a
    // Meta-issued instagram_permalink_url — proof of a real Instagram rendering
    // on the one with no pinned instagram_user_id. Delivery works; the
    // advertiser only loses explicit control over which account posts. Do not
    // "fix" this back to FAIL.
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_spec: { page_id: '1001' },
    });

    expect(identity.status).toBe('MANUAL_REVIEW');
    expect(identity.threads_identity_source).toBe('derived_from_page');
    expect(identity.reasons.join(' ')).toContain('instagram_user_id');
  });

  it('flags a creative with an explicit Threads identity but no Instagram identity for manual review', () => {
    // An explicitly pinned Threads ID is still explicit, even though the
    // Instagram side falls back to the Page — only the status becomes
    // MANUAL_REVIEW, not the Threads source.
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_spec: { page_id: '1001', threads_user_id: '9876543210' },
    });

    expect(identity.status).toBe('MANUAL_REVIEW');
    expect(identity.threads_user_id).toBe('9876543210');
    expect(identity.threads_identity_source).toBe('explicit');
  });

  it('reads a numeric instagram_user_id as a valid identity', () => {
    // Kept within Number.MAX_SAFE_INTEGER so the literal round-trips exactly;
    // real Meta IDs are transported as strings, not numbers.
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_spec: { page_id: '1001', instagram_user_id: 123456789 },
    });

    expect(identity.status).toBe('PASS');
    expect(identity.instagram_user_id).toBe('123456789');
    expect(identity.threads_identity_source).toBe('derived_from_instagram');
  });

  it('treats an empty-string instagram_user_id as absent', () => {
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_spec: { page_id: '1001', instagram_user_id: '' },
    });

    expect(identity.status).toBe('MANUAL_REVIEW');
    expect(identity.instagram_user_id).toBeUndefined();
  });

  it('treats a whitespace-only instagram_user_id as absent', () => {
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_spec: { page_id: '1001', instagram_user_id: '   ' },
    });

    expect(identity.status).toBe('MANUAL_REVIEW');
    expect(identity.instagram_user_id).toBeUndefined();
  });

  it('does not fault an existing-post creative for having no inline identity', () => {
    // An existing post already carries its own identity; object_story_spec is absent.
    const { identity } = evaluateMetaCreativeCompliance({
      object_story_id: '1001_2002',
    });

    expect(identity.status).toBe('NOT_APPLICABLE');
  });

  it('reports UNKNOWN when object_story_spec was never fetched', () => {
    const { identity } = evaluateMetaCreativeCompliance({});

    expect(identity.status).toBe('UNKNOWN');
  });
});
