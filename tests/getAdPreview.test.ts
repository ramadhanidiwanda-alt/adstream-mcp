import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import {
  AD_PREVIEW_FORMATS,
  LEGACY_AD_PREVIEW_FORMATS,
  assertAdPreviewFormat,
  getAdPreview,
  type AdPreviewFormat,
} from '../src/tools/getAdPreview.js';

describe('ad preview formats', () => {
  // Every value this tool used to offer was rejected by Meta — INSTAGRAM_FEED was
  // simply the one that got noticed first.
  it.each(Object.entries(LEGACY_AD_PREVIEW_FORMATS))(
    'rejects the old %s spelling and names the real one',
    (legacy, replacement) => {
      expect(() => assertAdPreviewFormat(legacy)).toThrow(new RegExp(replacement));
    }
  );

  it('never lists a legacy spelling as valid', () => {
    for (const legacy of Object.keys(LEGACY_AD_PREVIEW_FORMATS)) {
      expect(AD_PREVIEW_FORMATS).not.toContain(legacy);
    }
  });

  it('maps every legacy spelling to a format Meta actually accepts', () => {
    for (const replacement of Object.values(LEGACY_AD_PREVIEW_FORMATS)) {
      expect(AD_PREVIEW_FORMATS).toContain(replacement);
    }
  });

  it('accepts the documented Meta spellings', () => {
    for (const format of [
      'INSTAGRAM_STORY',
      'MOBILE_BANNER',
      'MOBILE_NATIVE',
      'WATCH_FEED_HOME',
      'INSTAGRAM_STANDARD',
    ] as const) {
      expect(assertAdPreviewFormat(format)).toBe(format);
    }
  });

  it('rejects a value that is not in the enum at all', () => {
    expect(() => assertAdPreviewFormat('TOTALLY_MADE_UP')).toThrow(/tidak ada pada enum/i);
  });

  it('sends the requested format to Meta', async () => {
    const metaGet = vi.fn().mockResolvedValue({ data: [{ preview_url: 'https://preview' }] });
    const client = { metaGet } as unknown as MetaClient;

    const result = await getAdPreview(client, {
      creativeId: 'act_c1',
      adFormat: 'INSTAGRAM_STORY',
    });

    expect(metaGet).toHaveBeenCalledWith('/c1/previews', { ad_format: 'INSTAGRAM_STORY' });
    expect(result[0]?.ad_format).toBe('INSTAGRAM_STORY');
  });

  it('refuses to call Meta with a stale format', async () => {
    const metaGet = vi.fn();
    const client = { metaGet } as unknown as MetaClient;

    await expect(
      getAdPreview(client, {
        creativeId: 'c1',
        adFormat: 'INSTAGRAM_FEED' as AdPreviewFormat,
      })
    ).rejects.toThrow(/INSTAGRAM_STANDARD/);
    expect(metaGet).not.toHaveBeenCalled();
  });
});
