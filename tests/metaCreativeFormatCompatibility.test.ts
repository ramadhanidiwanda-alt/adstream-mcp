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
    'flexible',
    'placement_image',
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

  it.each(['flexible', 'placement_image', 'existing_post'] as const)(
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
