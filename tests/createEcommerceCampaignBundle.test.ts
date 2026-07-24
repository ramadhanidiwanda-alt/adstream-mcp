import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEcommerceCampaignBundle } from '../src/tools/createEcommerceCampaignBundle.js';
import type { MetaClient } from '../src/metaClient.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGetObject: vi.fn().mockResolvedValue({
      id: 'cmp_1',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: 150000,
    }),
    metaGet: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

const payload = {
  adAccountId: 'act_123',
  campaignName: 'Sales - Prospecting - July',
  adSetName: 'Broad - Indonesia',
  adName: 'Hero Product - Static 1',
  pageId: '111222333',
  pixelId: '444555666',
  destinationUrl: 'https://example.com/products/hero',
  dailyBudget: 150000,
  currency: 'IDR',
  countries: ['ID'],
  primaryText: 'Discover our best-selling product today.',
  headline: 'Shop the Hero Product',
  description: 'Limited launch offer.',
  imageHash: 'abc123imagehash',
};

describe('createEcommerceCampaignBundle', () => {
  it('returns a dry-run preview without calling Meta POST', async () => {
    const client = createMockClient();

    const result = await createEcommerceCampaignBundle(client, payload, { dryRun: true });

    expect(result.executed).toBe(false);
    expect(result.status).toBe('dry_run');
    expect(client.metaPost).not.toHaveBeenCalled();
    expect(result.preview.campaign).toMatchObject({
      name: payload.campaignName,
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      special_ad_categories: [],
      daily_budget: payload.dailyBudget,
    });
    expect(result.preview.adSet).toMatchObject({
      name: payload.adSetName,
      status: 'PAUSED',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      billing_event: 'IMPRESSIONS',
    });
    expect(result.preview.adSet.daily_budget).toBeUndefined();
    expect(result.preview.ad).toMatchObject({ name: payload.adName, status: 'PAUSED' });
    expect(result.summary).toMatchObject({
      goal: 'Sales ke website',
      budget: 'IDR 150000/hari',
      destination: 'https://example.com/products/hero',
      statusAfterCreate: 'PAUSED',
      needsReview: true,
    });
  });

  it('includes Instagram and Threads identities in creative preview', async () => {
    const client = createMockClient();

    const result = await createEcommerceCampaignBundle(
      client,
      {
        ...payload,
        instagramUserId: 'ig_123',
        threadsProfileId: 'threads_456',
      },
      { dryRun: true }
    );

    expect(result.preview.creative.object_story_spec).toMatchObject({
      page_id: payload.pageId,
      instagram_user_id: 'ig_123',
      threads_profile_id: 'threads_456',
    });
  });

  it('creates campaign, ad set, creative, and ad in order when confirmed', async () => {
    const client = createMockClient();
    const mockPost = client.metaPost as MetaPostMock;
    // 4 metaPost calls: campaign, adset, creative, ad
    mockPost
      .mockResolvedValueOnce({ id: 'cmp_1' })
      .mockResolvedValueOnce({ id: 'adset_1' })
      .mockResolvedValueOnce({ id: 'creative_1' })
      .mockResolvedValueOnce({ id: 'ad_1' });

    const result = await createEcommerceCampaignBundle(client, payload, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe('executed');
    expect(result.ids).toEqual({
      campaignId: 'cmp_1',
      adSetId: 'adset_1',
      creativeId: 'creative_1',
      adId: 'ad_1',
    });
    // Verify 4 API calls were made (campaign, adset, creative, ad)
    expect(mockPost).toHaveBeenCalledTimes(4);
    // Check first call is campaign creation
    expect(mockPost.mock.calls[0][0]).toContain('/campaigns');
    // Check second call is adset creation
    expect(mockPost.mock.calls[1][0]).toContain('/adsets');
    expect(mockPost.mock.calls[1][1].daily_budget).toBeUndefined();
    // Check third call is creative creation
    expect(mockPost.mock.calls[2][0]).toContain('/adcreatives');
    // Check fourth call is ad creation
    expect(mockPost.mock.calls[3][0]).toContain('/ads');
  });

  it('creates a typed video creative for an existing Meta video', async () => {
    const client = createMockClient();
    const mockPost = client.metaPost as MetaPostMock;
    mockPost
      .mockResolvedValueOnce({ id: 'cmp_video' })
      .mockResolvedValueOnce({ id: 'adset_video' })
      .mockResolvedValueOnce({ id: 'creative_video' })
      .mockResolvedValueOnce({ id: 'ad_video' });

    const result = await createEcommerceCampaignBundle(
      client,
      { ...payload, imageHash: undefined, videoId: 'video_existing' },
      { dryRun: false, confirmed: true }
    );

    expect(result.status).toBe('executed');
    expect(mockPost.mock.calls[2][1]).toMatchObject({
      object_story_spec: {
        page_id: payload.pageId,
        video_data: {
          video_id: 'video_existing',
          message: payload.primaryText,
          title: payload.headline,
        },
      },
    });
    expect(mockPost.mock.calls[2][1]).not.toHaveProperty('object_story_spec.link_data');
  });

  it('does not upload a stale image file when video creative selection wins', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adstream-bundle-stale-image-'));
    const imageFilePath = path.join(tempDir, 'stale-image.jpg');
    fs.writeFileSync(imageFilePath, 'stale-image-fixture');

    try {
      const client = createMockClient();
      const mockPost = client.metaPost as MetaPostMock;
      mockPost
        .mockResolvedValueOnce({ id: 'cmp_video_wins' })
        .mockResolvedValueOnce({ id: 'adset_video_wins' })
        .mockResolvedValueOnce({ id: 'creative_video_wins' })
        .mockResolvedValueOnce({ id: 'ad_video_wins' });
      client.metaUploadMultipart = vi.fn() as MetaClient['metaUploadMultipart'];

      const result = await createEcommerceCampaignBundle(
        client,
        { ...payload, imageHash: undefined, imageFilePath, videoId: 'video_existing' },
        { dryRun: false, confirmed: true }
      );

      expect(result.status).toBe('executed');
      expect(client.metaUploadMultipart).not.toHaveBeenCalled();
      expect(mockPost.mock.calls[2][1]).toMatchObject({
        object_story_spec: { video_data: { video_id: 'video_existing' } },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a typed video creative from an uploaded video file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adstream-bundle-video-'));
    const videoFilePath = path.join(tempDir, 'creative.mp4');
    fs.writeFileSync(videoFilePath, 'video-fixture');

    try {
      const client = createMockClient();
      const mockPost = client.metaPost as MetaPostMock;
      mockPost
        .mockResolvedValueOnce({ id: 'cmp_uploaded_video' })
        .mockResolvedValueOnce({ id: 'adset_uploaded_video' })
        .mockResolvedValueOnce({ id: 'creative_uploaded_video' })
        .mockResolvedValueOnce({ id: 'ad_uploaded_video' });
      client.metaUploadMultipart = vi
        .fn()
        .mockResolvedValueOnce({ id: 'video_uploaded' }) as MetaClient['metaUploadMultipart'];

      const result = await createEcommerceCampaignBundle(
        client,
        { ...payload, imageHash: undefined, videoFilePath },
        { dryRun: false, confirmed: true }
      );

      expect(result.status).toBe('executed');
      expect(mockPost.mock.calls[2][1]).toMatchObject({
        object_story_spec: {
          page_id: payload.pageId,
          video_data: {
            video_id: 'video_uploaded',
            message: payload.primaryText,
            title: payload.headline,
          },
        },
      });
      expect(mockPost.mock.calls[2][1]).not.toHaveProperty('object_story_spec.link_data');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('retains completed campaign and ad set IDs when creative creation fails', async () => {
    const client = createMockClient();
    const mockPost = client.metaPost as MetaPostMock;
    mockPost
      .mockResolvedValueOnce({ id: 'cmp_partial' })
      .mockResolvedValueOnce({ id: 'adset_partial' })
      .mockRejectedValueOnce(new Error('creative rejected'));

    const result = await createEcommerceCampaignBundle(client, payload, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.status).toBe('failed');
    expect(result.executed).toBe(false);
    expect(result.ids).toEqual({
      campaignId: 'cmp_partial',
      adSetId: 'adset_partial',
    });
    expect(result.ids).not.toHaveProperty('creativeId');
    expect(result.ids).not.toHaveProperty('adId');
    expect(mockPost).toHaveBeenCalledTimes(3);
  });

  it('redacts credentials and signed URLs from generic bundle errors', async () => {
    const credentialFixture = 'final_review_bundle_credential_123456789';
    const signedUrl = `https://cdn.example.test/private/bundle.mp4?X-Amz-Signature=${credentialFixture}&expires=60`;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adstream-bundle-redaction-'));
    const videoFilePath = path.join(tempDir, 'creative.mp4');
    fs.writeFileSync(videoFilePath, 'video-fixture');

    try {
      const client = createMockClient();
      const mockPost = client.metaPost as MetaPostMock;
      mockPost
        .mockResolvedValueOnce({ id: 'cmp_redaction' })
        .mockResolvedValueOnce({ id: 'adset_redaction' });
      client.metaUploadMultipart = vi
        .fn()
        .mockRejectedValueOnce(
          new Error(`Bundle provider failed: access_token=${credentialFixture}; asset=${signedUrl}`)
        ) as MetaClient['metaUploadMultipart'];

      const result = await createEcommerceCampaignBundle(
        client,
        {
          ...payload,
          imageHash: undefined,
          videoFilePath,
        },
        { dryRun: false, confirmed: true }
      );
      const serialized = JSON.stringify(result);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('[REDACTED]');
      expect(result.error).toContain('[REDACTED_SIGNED_URL]');
      expect(serialized).not.toContain(credentialFixture);
      expect(serialized).not.toContain(signedUrl);
      expect(serialized).not.toContain('cdn.example.test/private/bundle.mp4');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('refuses execution without explicit confirmation', async () => {
    const client = createMockClient();

    const result = await createEcommerceCampaignBundle(client, payload, { dryRun: false });

    expect(result.executed).toBe(false);
    expect(result.status).toBe('pending_confirmation');
    expect(result.error).toContain('Explicit confirmation is required');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('validates required ecommerce launch fields safely', async () => {
    const client = createMockClient();

    await expect(
      createEcommerceCampaignBundle(client, { ...payload, pixelId: '' }, { dryRun: true })
    ).rejects.toThrow('pixelId is required');
  });
});
