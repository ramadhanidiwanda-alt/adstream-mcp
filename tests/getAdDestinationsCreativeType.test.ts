import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { getAdDestinations, inferCreativeType } from '../src/tools/getAdDestinations.js';

// Meta reports `object_type: SHARE` for ANY link-share creative, not just
// boosted posts. Verified live on 2026-07-25 against act_1417353822551653:
// ads 120250634918810402, 120250499546230402, 120250628269020402 and
// 120250114796970402 are all fresh-asset link ads (object_story_id EMPTY,
// source_instagram_media_id EMPTY, object_story_spec carrying link_data) yet
// every one of them comes back as SHARE.
describe('inferCreativeType', () => {
  it('classifies a fresh single-image link ad as link, not existing_post', () => {
    expect(
      inferCreativeType({
        id: 'creative_1',
        object_type: 'SHARE',
        object_story_spec: { link_data: { link: 'https://example.com/lp' } },
      })
    ).toBe('link');
  });

  it('classifies a SHARE carousel by its child_attachments', () => {
    expect(
      inferCreativeType({
        id: 'creative_2',
        object_type: 'SHARE',
        object_story_spec: {
          link_data: {
            link: 'https://example.com/lp',
            child_attachments: [
              { link: 'https://example.com/a' },
              { link: 'https://example.com/b' },
            ],
          },
        },
      })
    ).toBe('carousel');
  });

  it('classifies a SHARE video creative as video', () => {
    expect(
      inferCreativeType({
        id: 'creative_3',
        object_type: 'SHARE',
        object_story_spec: {
          video_data: { call_to_action: { type: 'LEARN_MORE', value: { link: 'https://x.test' } } },
        },
      })
    ).toBe('video');
  });

  it('classifies a genuine boosted Page post as existing_post', () => {
    expect(
      inferCreativeType({
        id: 'creative_4',
        object_type: 'SHARE',
        object_story_id: '1234567890_9876543210',
      })
    ).toBe('existing_post');
  });

  it('classifies an Instagram-only boosted post as existing_post', () => {
    expect(
      inferCreativeType({
        id: 'creative_5',
        object_type: 'SHARE',
        source_instagram_media_id: '17895695668004550',
      })
    ).toBe('existing_post');
  });

  it('prefers existing_post over the spec-based branches when object_story_id is set', () => {
    // A boosted post creative can still carry a spec (e.g. a top-level CTA
    // link) — the explicit post id wins.
    expect(
      inferCreativeType({
        id: 'creative_6',
        object_type: 'SHARE',
        object_story_id: '1234567890_9876543210',
        object_story_spec: { link_data: { link: 'https://example.com/lp' } },
      })
    ).toBe('existing_post');
  });

  it('falls back to a SHARE creative with an unrecognised spec instead of guessing existing_post', () => {
    // CPAS/template_data creatives (act_1744916086675830) expose nothing we
    // request, so the raw object_type is reported rather than a wrong label.
    expect(inferCreativeType({ id: 'creative_7', object_type: 'SHARE' })).toBe('SHARE');
  });
});

describe('getAdDestinations creative_type', () => {
  it('requests object_story_id and source_instagram_media_id on the creative', async () => {
    const metaGet = vi.fn().mockResolvedValue({ data: [] });
    const client = { metaGet } as unknown as MetaClient;

    await getAdDestinations(client, { adAccountId: 'act_123' });

    const fields = metaGet.mock.calls[0][1].fields as string;
    expect(fields).toContain('object_story_id');
    expect(fields).toContain('source_instagram_media_id');
  });

  it('does not report a fresh link ad as existing_post (regression for the reported bug)', async () => {
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        {
          id: '120250634918810402',
          name: 'Singgle Image',
          effective_status: 'ACTIVE',
          creative: {
            id: 'creative_fresh',
            object_type: 'SHARE',
            object_story_spec: { link_data: { link: 'https://example.com/lp' } },
          },
        },
        {
          id: '120250499546230402',
          name: 'Boosted Post',
          effective_status: 'ACTIVE',
          creative: {
            id: 'creative_boosted',
            object_type: 'SHARE',
            object_story_id: '1234567890_9876543210',
          },
        },
      ],
    });
    const client = { metaGet } as unknown as MetaClient;

    const result = await getAdDestinations(client, { adAccountId: 'act_123' });

    expect(result[0]).toMatchObject({
      ad_id: '120250634918810402',
      creative_type: 'link',
      destination_url: 'https://example.com/lp',
    });
    expect(result[1]).toMatchObject({
      ad_id: '120250499546230402',
      creative_type: 'existing_post',
    });
  });
});
