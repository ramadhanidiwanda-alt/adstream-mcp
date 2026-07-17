import type {
  AdsComplianceCheck,
  AdsComplianceStatus,
  AdsCreativeSetupCompliance,
  AdsPlacementCustomizationCompliance,
} from '../../broker/types.js';

export interface MetaCreativeComplianceInput {
  degrees_of_freedom_spec?: unknown;
  media_sourcing_spec?: unknown;
  asset_feed_spec?: unknown;
}

type UnknownRecord = Record<string, unknown>;
type PlacementFamily = 'feed' | 'reels' | 'story';

const FACEBOOK_POSITIONS: Record<PlacementFamily, Set<string>> = {
  feed: new Set(['feed']),
  reels: new Set(['facebook_reels', 'reels']),
  story: new Set(['story', 'stories']),
};

const INSTAGRAM_POSITIONS: Record<PlacementFamily, Set<string>> = {
  feed: new Set(['feed', 'stream']),
  reels: new Set(['reels']),
  story: new Set(['story', 'stories']),
};

export function evaluateMetaCreativeCompliance(
  input: MetaCreativeComplianceInput
): AdsCreativeSetupCompliance {
  return {
    ai_creative: evaluateAiCreative(input.degrees_of_freedom_spec),
    related_media: evaluateRelatedMedia(input.media_sourcing_spec),
    placement_customization: evaluatePlacementCustomization(input.asset_feed_spec),
  };
}

function evaluateAiCreative(
  degreesOfFreedomSpec: unknown
): AdsCreativeSetupCompliance['ai_creative'] {
  if (!isRecord(degreesOfFreedomSpec)) {
    return {
      status: 'UNKNOWN',
      enabled_features: [],
      reasons: ['Meta did not return degrees_of_freedom_spec.'],
    };
  }

  const creativeFeatures = degreesOfFreedomSpec.creative_features_spec;
  if (!isRecord(creativeFeatures) || Object.keys(creativeFeatures).length === 0) {
    return {
      status: 'UNKNOWN',
      enabled_features: [],
      reasons: ['Meta did not return explicit creative feature enrollment statuses.'],
    };
  }

  const enabledFeatures: string[] = [];
  const unrecognizedFeatures: string[] = [];

  for (const [featureName, featureConfig] of Object.entries(creativeFeatures)) {
    const enrollmentStatus = isRecord(featureConfig) ? featureConfig.enroll_status : undefined;
    if (enrollmentStatus === 'OPT_IN') {
      enabledFeatures.push(featureName);
    } else if (enrollmentStatus !== 'OPT_OUT') {
      unrecognizedFeatures.push(featureName);
    }
  }

  enabledFeatures.sort();
  unrecognizedFeatures.sort();

  if (enabledFeatures.length > 0) {
    return {
      status: 'FAIL',
      enabled_features: enabledFeatures,
      reasons: [`AI creative features are enabled: ${enabledFeatures.join(', ')}.`],
    };
  }

  if (unrecognizedFeatures.length > 0) {
    return {
      status: 'UNKNOWN',
      enabled_features: [],
      reasons: [
        `Meta returned unrecognized enrollment statuses for: ${unrecognizedFeatures.join(', ')}.`,
      ],
    };
  }

  return {
    status: 'PASS',
    enabled_features: [],
    reasons: ['Every returned AI creative feature is explicitly opted out.'],
  };
}

function evaluateRelatedMedia(mediaSourcingSpec: unknown): AdsComplianceCheck {
  if (!isRecord(mediaSourcingSpec)) {
    return {
      status: 'UNKNOWN',
      reasons: ['Meta did not return media_sourcing_spec.'],
    };
  }

  const relatedMedia = mediaSourcingSpec.related_media;
  if (relatedMedia === undefined) {
    return {
      status: 'PASS',
      reasons: ['The returned media sourcing configuration has no related media.'],
    };
  }

  if (!Array.isArray(relatedMedia)) {
    return {
      status: 'UNKNOWN',
      reasons: ['Meta returned related_media in an unrecognized format.'],
    };
  }

  return relatedMedia.length > 0
    ? {
        status: 'FAIL',
        reasons: [`Meta returned ${relatedMedia.length} related media item(s).`],
      }
    : {
        status: 'PASS',
        reasons: ['Meta returned an empty related media list.'],
      };
}

function evaluatePlacementCustomization(
  assetFeedSpec: unknown
): AdsPlacementCustomizationCompliance {
  const unknownResult: AdsPlacementCustomizationCompliance = {
    status: 'UNKNOWN',
    feed: 'UNKNOWN',
    reels: 'UNKNOWN',
    story: 'UNKNOWN',
    reasons: ['Meta did not return a recognizable asset_feed_spec.'],
    preview_required: true,
  };

  if (!isRecord(assetFeedSpec)) return unknownResult;

  const customizationRules = assetFeedSpec.asset_customization_rules;
  if (customizationRules === undefined) {
    return {
      ...unknownResult,
      reasons: ['Meta did not return asset customization rules.'],
    };
  }
  if (!Array.isArray(customizationRules)) {
    return {
      ...unknownResult,
      reasons: ['Meta returned asset customization rules in an unrecognized format.'],
    };
  }

  const assetLabels = collectAssetLabels(assetFeedSpec);
  const coveredFamilies = new Set<PlacementFamily>();

  for (const rule of customizationRules) {
    if (!isRecord(rule)) continue;
    const ruleLabel = readRuleLabel(rule);
    if (!ruleLabel || !assetLabels.has(ruleLabel)) continue;

    const customizationSpec = rule.customization_spec;
    if (!isRecord(customizationSpec)) continue;

    for (const family of ['feed', 'reels', 'story'] as const) {
      if (hasFamilyPosition(customizationSpec, family)) {
        coveredFamilies.add(family);
      }
    }
  }

  const feed = familyStatus(coveredFamilies, 'feed');
  const reels = familyStatus(coveredFamilies, 'reels');
  const story = familyStatus(coveredFamilies, 'story');
  const missingFamilies = (['feed', 'reels', 'story'] as const).filter(
    (family) => !coveredFamilies.has(family)
  );

  return {
    status: missingFamilies.length === 0 ? 'PASS' : 'FAIL',
    feed,
    reels,
    story,
    reasons:
      missingFamilies.length === 0
        ? ['Feed, Reels, and Story each have an explicit labeled asset rule.']
        : [`Missing explicit labeled asset rules for: ${missingFamilies.join(', ')}.`],
    preview_required: true,
  };
}

function collectAssetLabels(assetFeedSpec: UnknownRecord): Set<string> {
  const labels = new Set<string>();

  for (const assetType of ['images', 'videos'] as const) {
    const assets = assetFeedSpec[assetType];
    if (!Array.isArray(assets)) continue;

    for (const asset of assets) {
      if (!isRecord(asset) || !Array.isArray(asset.adlabels)) continue;
      for (const label of asset.adlabels) {
        if (isRecord(label) && typeof label.name === 'string' && label.name.length > 0) {
          labels.add(label.name);
        }
      }
    }
  }

  return labels;
}

function readRuleLabel(rule: UnknownRecord): string | undefined {
  for (const field of ['image_label', 'video_label'] as const) {
    const label = rule[field];
    if (isRecord(label) && typeof label.name === 'string' && label.name.length > 0) {
      return label.name;
    }
  }
  return undefined;
}

function hasFamilyPosition(customizationSpec: UnknownRecord, family: PlacementFamily): boolean {
  return (
    containsPosition(customizationSpec.facebook_positions, FACEBOOK_POSITIONS[family]) ||
    containsPosition(customizationSpec.instagram_positions, INSTAGRAM_POSITIONS[family])
  );
}

function containsPosition(value: unknown, acceptedPositions: Set<string>): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (position) => typeof position === 'string' && acceptedPositions.has(position.toLowerCase())
    )
  );
}

function familyStatus(
  coveredFamilies: Set<PlacementFamily>,
  family: PlacementFamily
): AdsComplianceStatus {
  return coveredFamilies.has(family) ? 'PASS' : 'FAIL';
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
