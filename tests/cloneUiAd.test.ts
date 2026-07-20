import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { cloneUiAd } from '../src/tools/cloneUiAd.js';

type MetaMock = ReturnType<typeof vi.fn>;

describe('cloneUiAd', () => {
  const mockMetaPost: MetaMock = vi.fn();
  const mockMetaGet: MetaMock = vi.fn();
  const mockMetaGetObject: MetaMock = vi.fn();
  const mockClient = {
    metaPost: mockMetaPost,
    metaGet: mockMetaGet,
    metaGetObject: mockMetaGetObject,
  } as unknown as MetaClient;

  const baseOpts = {
    adAccountId: 'act_123',
    sourceAdId: 'ad_source_1',
    adSetId: 'adset_1',
    name: 'Clone UI ad',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetaGet.mockResolvedValue({ data: [] });
  });

  it('builds a dry-run preview for source-backed ad creation', async () => {
    const result = await cloneUiAd(mockClient, baseOpts);

    expect(result).toMatchObject({
      operation: 'clone_ui_ad',
      status: 'dry_run',
      executed: false,
      preview: {
        source_ad_id: 'ad_source_1',
        source_creative_lookup: {
          endpoint: '/ad_source_1',
          fields: 'creative{id}',
        },
        create_endpoint: '/act_123/ads',
        create_payload: {
          name: 'Clone UI ad',
          adset_id: 'adset_1',
          status: 'PAUSED',
          source_ad_id: 'ad_source_1',
          creative: { creative_id: '<SOURCE_AD_CREATIVE_ID>' },
        },
      },
      warnings: [expect.stringMatching(/source_ad_id.*creative_id/i)],
    });
    expect(mockMetaGetObject).not.toHaveBeenCalled();
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('executes a paused clone when confirmed', async () => {
    mockMetaGetObject.mockResolvedValueOnce({ creative: { id: 'creative_1' } });
    mockMetaPost.mockResolvedValueOnce({ id: 'ad_clone_1' });

    const result = await cloneUiAd(mockClient, baseOpts, { dryRun: false, confirmed: true });

    expect(result).toMatchObject({
      status: 'executed',
      executed: true,
      id: 'ad_clone_1',
      response: {
        source_creative_id: 'creative_1',
      },
    });
    expect(mockMetaGetObject).toHaveBeenCalledWith(
      '/ad_source_1',
      { fields: 'creative{id}' },
      3
    );
    expect(mockMetaPost).toHaveBeenCalledWith(
      '/act_123/ads',
      {
        name: 'Clone UI ad',
        adset_id: 'adset_1',
        status: 'PAUSED',
        source_ad_id: 'ad_source_1',
        creative: { creative_id: 'creative_1' },
      },
      3
    );
  });

  it('fails clearly when the source ad has no creative id', async () => {
    mockMetaGetObject.mockResolvedValueOnce({ creative: {} });

    const result = await cloneUiAd(mockClient, baseOpts, { dryRun: false, confirmed: true });

    expect(result).toMatchObject({
      status: 'failed',
      executed: false,
      error: expect.stringMatching(/source ad.*creative id/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('dedupes by name under the destination ad set', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: 'existing_ad_1', name: 'Clone UI ad', status: 'PAUSED' }],
    });

    const result = await cloneUiAd(
      mockClient,
      { ...baseOpts, dedupeByName: true },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'deduped',
      executed: false,
      id: 'existing_ad_1',
    });
    expect(mockMetaGet).toHaveBeenCalledWith(
      '/adset_1/ads',
      { fields: 'id,name,status', limit: 100 },
      { maxRetries: 3, paginate: true, maxPages: 20 }
    );
    expect(mockMetaPost).not.toHaveBeenCalled();
  });
});
