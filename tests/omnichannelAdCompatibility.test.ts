import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import {
  evaluateOmnichannelCompatibility,
  getOmnichannelCompatibilityError,
} from '../src/providers/meta/omnichannelAdCompatibility.js';

const omnichannelAdSet = {
  promoted_object: {
    product_set_id: '400359918054556',
    omnichannel_object: {
      app: [{ application_id: '957549474255294' }],
      pixel: [{ pixel_id: '466924370133774' }],
    },
  },
};

const compliantCreative = {
  applink_treatment: 'automatic',
  omnichannel_link_spec: { web: { url: 'https://s.shopee.co.id/x' }, app: { application_id: '957549474255294' } },
  object_story_spec: {
    link_data: {
      call_to_action: {
        type: 'BOOK_TRAVEL',
        value: { application: '957549474255294', object_store_urls: ['http://play.google.com/store/apps/details?id=com.shopee.id'] },
      },
    },
  },
};

describe('evaluateOmnichannelCompatibility', () => {
  it('reports compatible when a non-omnichannel ad set is used', () => {
    const result = evaluateOmnichannelCompatibility({ promoted_object: { pixel_id: '1' } }, {});
    expect(result.omnichannelAdSet).toBe(false);
    expect(result.missing).toEqual([]);
  });

  it('reports compatible for an omnichannel ad set with a fully-formed creative', () => {
    const result = evaluateOmnichannelCompatibility(omnichannelAdSet, compliantCreative);
    expect(result.omnichannelAdSet).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('lists every missing omnichannel component', () => {
    const result = evaluateOmnichannelCompatibility(omnichannelAdSet, {
      asset_feed_spec: { call_to_action_types: ['SHOP_NOW'] },
    });
    expect(result.omnichannelAdSet).toBe(true);
    expect(result.missing).toContain('applink_treatment');
    expect(result.missing).toContain('omnichannel_link_spec');
    expect(result.missing).toContain('object_store_urls');
  });

  it('detects object_store_urls nested anywhere in the creative', () => {
    const result = evaluateOmnichannelCompatibility(omnichannelAdSet, {
      applink_treatment: 'automatic',
      omnichannel_link_spec: {
        app: { object_store_urls: ['http://itunes.apple.com/app/id959841443'] },
      },
    });
    expect(result.missing).toEqual([]);
  });

  it('flags only object_store_urls when the other two are present', () => {
    const result = evaluateOmnichannelCompatibility(omnichannelAdSet, {
      applink_treatment: 'automatic',
      omnichannel_link_spec: { web: { url: 'https://x' } },
    });
    expect(result.missing).toEqual(['object_store_urls']);
  });
});

describe('getOmnichannelCompatibilityError', () => {
  function client(adSet: unknown, creative: unknown): MetaClient {
    return {
      metaGetObject: vi.fn().mockImplementation(async (path: string) =>
        path.includes('adset') || path === '/as_1' ? adSet : creative
      ),
    } as unknown as MetaClient;
  }

  it('returns undefined for a compatible omnichannel pairing', async () => {
    const err = await getOmnichannelCompatibilityError(
      client(omnichannelAdSet, compliantCreative),
      'as_1',
      'cr_1',
      1
    );
    expect(err).toBeUndefined();
  });

  it('returns an actionable error naming the missing components', async () => {
    const err = await getOmnichannelCompatibilityError(
      client(omnichannelAdSet, { asset_feed_spec: {} }),
      'as_1',
      'cr_1',
      1
    );
    expect(err).toBeDefined();
    expect(err).toContain('applink_treatment');
    expect(err).toContain('object_store_urls');
  });

  it('returns undefined when the ad set is not omnichannel', async () => {
    const err = await getOmnichannelCompatibilityError(
      client({ promoted_object: { pixel_id: '1' } }, {}),
      'as_1',
      'cr_1',
      1
    );
    expect(err).toBeUndefined();
  });
});
