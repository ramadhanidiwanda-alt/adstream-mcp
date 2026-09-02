import { describe, it, expect } from 'vitest';
import {
  classifyAssetFeedSpecForCreate,
  classifyCreativeFamily,
  countCustomizationRules,
  familyRequiresDynamicCreativeAdSet,
  readOptimizationType,
  remapFamilyForNonDynamicAdSet,
} from '../src/providers/meta/assetFeedSpecFamily.js';

// Bentuk payload di bawah disalin dari creative produksi (GET /{creative_id}).
const liveAdvantageTextSpec = {
  bodies: [
    { text: 'Stop Dreaming. Start Your Own Beauty Empire Today!' },
    { text: 'Want to turn your beauty vision into a reality?' },
  ],
  titles: [{ text: 'Launch Your Glow Empire Today' }, { text: 'Launch Your Beauty Empire' }],
  optimization_type: 'DEGREES_OF_FREEDOM',
};

describe('readOptimizationType', () => {
  it('reads the documented values case-insensitively', () => {
    expect(readOptimizationType({ optimization_type: 'DEGREES_OF_FREEDOM' })).toBe(
      'DEGREES_OF_FREEDOM'
    );
    expect(readOptimizationType({ optimization_type: 'regular' })).toBe('REGULAR');
    expect(readOptimizationType({ optimization_type: 'ASSET_CUSTOMIZATION' })).toBe(
      'ASSET_CUSTOMIZATION'
    );
  });

  it('returns undefined when the field is absent or unrecognised', () => {
    expect(readOptimizationType({ bodies: [] })).toBeUndefined();
    expect(readOptimizationType({ optimization_type: 'SOMETHING_NEW' })).toBeUndefined();
    expect(readOptimizationType(undefined)).toBeUndefined();
  });
});

describe('countCustomizationRules', () => {
  it('counts rules and tolerates missing or malformed values', () => {
    expect(countCustomizationRules({ asset_customization_rules: [{}, {}] })).toBe(2);
    expect(countCustomizationRules({ asset_customization_rules: 'nope' })).toBe(0);
    expect(countCustomizationRules(undefined)).toBe(0);
  });
});

describe('classifyCreativeFamily (read path)', () => {
  it('classifies a creative with no asset_feed_spec as manual/static', () => {
    expect(classifyCreativeFamily({ object_story_spec: { page_id: 'p' } })).toBe('manual_static');
    expect(classifyCreativeFamily({ asset_feed_spec: {} })).toBe('manual_static');
    expect(classifyCreativeFamily(undefined)).toBe('manual_static');
  });

  // The production shape the old guard mislabelled as Dynamic Creative.
  it('classifies multi-text DEGREES_OF_FREEDOM as advantage_text, not Dynamic Creative', () => {
    expect(classifyCreativeFamily({ asset_feed_spec: liveAdvantageTextSpec })).toBe(
      'advantage_text'
    );
  });

  it('classifies REGULAR without rules as Dynamic Creative', () => {
    expect(
      classifyCreativeFamily({
        asset_feed_spec: { ...liveAdvantageTextSpec, optimization_type: 'REGULAR' },
      })
    ).toBe('dynamic_creative');
  });

  it('treats a missing optimization_type as REGULAR, matching what Meta stores', () => {
    const { optimization_type: _dropped, ...noOptimizationType } = liveAdvantageTextSpec;
    expect(classifyCreativeFamily({ asset_feed_spec: noOptimizationType })).toBe(
      'dynamic_creative'
    );
  });

  it('classifies rule-based and customization-typed feeds as asset_customized', () => {
    expect(
      classifyCreativeFamily({
        asset_feed_spec: { images: [], asset_customization_rules: [{ image_label: {} }] },
      })
    ).toBe('asset_customized');
    expect(
      classifyCreativeFamily({ asset_feed_spec: { optimization_type: 'PLACEMENT', images: [] } })
    ).toBe('asset_customized');
  });

  it('classifies catalog signals and FORMAT_AUTOMATION as catalog', () => {
    expect(classifyCreativeFamily({ product_set_id: 'ps1' }, { hasCatalogSignal: true })).toBe(
      'catalog_dynamic'
    );
    expect(
      classifyCreativeFamily({ asset_feed_spec: { optimization_type: 'FORMAT_AUTOMATION' } })
    ).toBe('catalog_dynamic');
  });

  it('marks only Dynamic Creative as needing a dedicated ad set', () => {
    expect(familyRequiresDynamicCreativeAdSet('dynamic_creative')).toBe(true);
    for (const family of [
      'manual_static',
      'advantage_text',
      'asset_customized',
      'flexible_ad',
      'catalog_dynamic',
    ] as const) {
      expect(familyRequiresDynamicCreativeAdSet(family)).toBe(false);
    }
  });

  it('remaps dynamic_creative to flexible_ad for non-dynamic ad sets', () => {
    expect(remapFamilyForNonDynamicAdSet('dynamic_creative')).toBe('flexible_ad');
    expect(remapFamilyForNonDynamicAdSet('manual_static')).toBe('manual_static');
    expect(remapFamilyForNonDynamicAdSet('advantage_text')).toBe('advantage_text');
    expect(remapFamilyForNonDynamicAdSet('flexible_ad')).toBe('flexible_ad');
    expect(remapFamilyForNonDynamicAdSet('catalog_dynamic')).toBe('catalog_dynamic');
  });
});

describe('classifyAssetFeedSpecForCreate (create path)', () => {
  it('allows DEGREES_OF_FREEDOM without any customization rules', () => {
    expect(classifyAssetFeedSpecForCreate(liveAdvantageTextSpec)).toBe('advantage_text');
  });

  it('blocks REGULAR and a missing optimization_type alike', () => {
    expect(
      classifyAssetFeedSpecForCreate({ ...liveAdvantageTextSpec, optimization_type: 'REGULAR' })
    ).toBe('dynamic_creative');
    const { optimization_type: _dropped, ...noOptimizationType } = liveAdvantageTextSpec;
    expect(classifyAssetFeedSpecForCreate(noOptimizationType)).toBe('dynamic_creative');
  });

  // Meta: "All ads using asset_feed_spec must contain at least two target
  // customization rules." Enforced locally so one rule fails with a clear message.
  it('enforces Meta minimum of two customization rules', () => {
    expect(classifyAssetFeedSpecForCreate({ asset_customization_rules: [{}] })).toBe(
      'too_few_rules'
    );
    expect(classifyAssetFeedSpecForCreate({ asset_customization_rules: [{}, {}] })).toBe(
      'asset_customized'
    );
    expect(classifyAssetFeedSpecForCreate({ optimization_type: 'LANGUAGE' })).toBe('too_few_rules');
  });

  it('allows the catalog FORMAT_AUTOMATION feed', () => {
    expect(
      classifyAssetFeedSpecForCreate({
        optimization_type: 'FORMAT_AUTOMATION',
        ad_formats: ['CAROUSEL', 'COLLECTION'],
      })
    ).toBe('catalog_automation');
  });
});
