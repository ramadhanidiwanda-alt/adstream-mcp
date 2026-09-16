import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { searchAdLibrary } from '../src/tools/searchAdLibrary.js';

describe('searchAdLibrary', () => {
  it('maps canonical search options to ads_archive and normalizes creative results', async () => {
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'library-1',
          page_id: 'page-1',
          page_name: 'Example Page',
          ad_snapshot_url: 'https://www.facebook.com/ads/archive/render_ad/?id=library-1',
          ad_creative_bodies: ['Primary text'],
          ad_creative_link_titles: ['Headline'],
          ad_creative_link_descriptions: ['Description'],
          ad_creative_link_captions: ['example.com'],
          ad_delivery_start_time: '2026-08-01',
          ad_delivery_stop_time: '2026-08-20',
          ad_active_status: 'INACTIVE',
          publisher_platforms: ['facebook', 'instagram'],
          spend: { lower_bound: '100', upper_bound: '499' },
          impressions: { lower_bound: '1000', upper_bound: '4999' },
          currency: 'IDR',
          bylines: 'Paid for by Example',
        },
      ],
      paging: { cursors: { after: 'next-cursor' } },
    });
    const client = { metaGet } as unknown as MetaClient;

    const result = await searchAdLibrary(client, {
      countries: ['ID'],
      searchTerms: 'running shoes',
      adType: 'POLITICAL_AND_ISSUE_ADS',
      activeStatus: 'ALL',
      dateMin: '2026-08-01',
      dateMax: '2026-08-31',
      mediaType: 'VIDEO',
      publisherPlatforms: ['FACEBOOK', 'INSTAGRAM'],
      languages: ['id', 'en'],
      searchType: 'KEYWORD_EXACT_PHRASE',
      limit: 50,
      cursor: 'current-cursor',
    });

    expect(metaGet).toHaveBeenCalledWith('/ads_archive', {
      fields: expect.stringContaining('ad_creative_bodies'),
      ad_reached_countries: ['ID'],
      search_terms: 'running shoes',
      ad_type: 'POLITICAL_AND_ISSUE_ADS',
      ad_active_status: 'ALL',
      ad_delivery_date_min: '2026-08-01',
      ad_delivery_date_max: '2026-08-31',
      media_type: 'VIDEO',
      publisher_platforms: ['FACEBOOK', 'INSTAGRAM'],
      languages: ['id', 'en'],
      search_type: 'KEYWORD_EXACT_PHRASE',
      limit: 50,
      after: 'current-cursor',
    });
    expect(result.ads).toEqual([
      {
        libraryId: 'library-1',
        pageId: 'page-1',
        pageName: 'Example Page',
        snapshotUrl: 'https://www.facebook.com/ads/archive/render_ad/?id=library-1',
        creative: {
          bodies: ['Primary text'],
          titles: ['Headline'],
          descriptions: ['Description'],
          linkCaptions: ['example.com'],
        },
        delivery: {
          startedAt: '2026-08-01',
          stoppedAt: '2026-08-20',
          active: false,
          platforms: ['FACEBOOK', 'INSTAGRAM'],
        },
        transparency: {
          spendRange: { lower: 100, upper: 499 },
          impressionsRange: { lower: 1000, upper: 4999 },
          currency: 'IDR',
          byline: 'Paid for by Example',
        },
      },
    ]);
    expect(result.paging.nextCursor).toBe('next-cursor');
    expect(result.coverage.performanceMetricsAvailable).toBe(false);
  });

  it('supports Page ID lookup and defaults optional arrays safely', async () => {
    const metaGet = vi.fn().mockResolvedValue({ data: [{ id: 'library-2' }] });
    const client = { metaGet } as unknown as MetaClient;

    const result = await searchAdLibrary(client, {
      countries: ['GB'],
      pageIds: ['123', '456'],
    });

    expect(metaGet).toHaveBeenCalledWith(
      '/ads_archive',
      expect.objectContaining({
        ad_reached_countries: ['GB'],
        search_page_ids: ['123', '456'],
        ad_type: 'ALL',
        ad_active_status: 'ACTIVE',
      })
    );
    expect(result.ads[0]).toMatchObject({
      libraryId: 'library-2',
      creative: { bodies: [], titles: [], descriptions: [], linkCaptions: [] },
      delivery: { active: true, platforms: [] },
    });
    expect(result.paging.nextCursor).toBeNull();
  });

  it.each([
    [{ countries: [], searchTerms: 'shoes' }, /country/i],
    [{ countries: ['GB'] }, /searchTerms or pageIds/i],
    [{ countries: ['GB'], searchTerms: 'x'.repeat(101) }, /100 characters/i],
    [
      { countries: ['GB'], pageIds: Array.from({ length: 11 }, (_, index) => String(index)) },
      /10 Page IDs/i,
    ],
    [
      { countries: ['GB'], searchTerms: 'shoes', dateMin: '2026-09-10', dateMax: '2026-09-01' },
      /dateMin/i,
    ],
    [{ countries: ['GB'], searchTerms: 'shoes', limit: 101 }, /between 1 and 100/i],
  ])('rejects invalid search options before calling Meta', async (options, message) => {
    const metaGet = vi.fn();
    const client = { metaGet } as unknown as MetaClient;

    await expect(searchAdLibrary(client, options)).rejects.toThrow(message);
    expect(metaGet).not.toHaveBeenCalled();
  });
});
