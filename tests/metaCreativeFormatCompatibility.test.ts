import { describe, expect, it } from 'vitest';
import {
  assertMetaCreativeCompatibility,
  getMetaCreativeRequirements,
} from '../src/providers/meta/creativeFormatCompatibility.js';

describe('Meta creative format compatibility', () => {
  it.each([
    'single_image',
    'video',
    'carousel',
    'catalog',
    'collection',
    'placement_image',
    'placement_customized_ctwa',
    'existing_post',
  ] as const)('allows standard %s', (creativeFormat) => {
    expect(() =>
      assertMetaCreativeCompatibility({ mode: 'standard', creativeFormat })
    ).not.toThrow();
  });

  it.each(['single_image', 'video', 'carousel', 'catalog', 'collection'] as const)(
    'allows collaborative %s',
    (creativeFormat) => {
      expect(() =>
        assertMetaCreativeCompatibility({ mode: 'collaborative_ads', creativeFormat })
      ).not.toThrow();
    }
  );

  it('rejects flexible Dynamic Creative in every create mode', () => {
    expect(() =>
      assertMetaCreativeCompatibility({ mode: 'standard', creativeFormat: 'flexible' })
    ).toThrow(/Dynamic Creative\/Flexible.*disabled/i);
    expect(() =>
      assertMetaCreativeCompatibility({ mode: 'collaborative_ads', creativeFormat: 'flexible' })
    ).toThrow(/Dynamic Creative\/Flexible.*disabled/i);
  });

  it.each(['placement_image', 'placement_customized_ctwa', 'existing_post'] as const)(
    'rejects collaborative %s with marketer-facing guidance',
    (creativeFormat) => {
      expect(() =>
        assertMetaCreativeCompatibility({ mode: 'collaborative_ads', creativeFormat })
      ).toThrow(/belum didukung.*pilih/i);
    }
  );

  it('requires a product set for collaborative catalog formats', () => {
    expect(
      getMetaCreativeRequirements({ mode: 'collaborative_ads', creativeFormat: 'catalog' })
    ).toContain('productSetId');
  });
});

describe('getMetaCreativeRequirements — existing_post', () => {
  it('menyebut partnership.adCode sebagai referensi konten ketiga', () => {
    const required = getMetaCreativeRequirements({
      mode: 'standard',
      creativeFormat: 'existing_post',
    });

    expect(required.join(' ')).toMatch(/partnership\.adCode/);
  });
});
