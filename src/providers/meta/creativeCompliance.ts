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
type AssetType = 'image' | 'video';

const PLACEMENT_FAMILIES = ['feed', 'reels', 'story'] as const;

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

const NON_AUDITED_POSITIONS = {
  facebook: new Set([
    'right_hand_column',
    'marketplace',
    'video_feeds',
    'search',
    'instream_video',
    'profile_feed',
    'profile_reels',
    'groups_feed',
  ]),
  instagram: new Set([
    'explore',
    'explore_home',
    'profile_feed',
    'profile_reels',
    'ig_search',
    'shop',
  ]),
  messenger: new Set(['messenger_home', 'sponsored_messages', 'story']),
  audience_network: new Set(['classic', 'instream_video', 'rewarded_video']),
  threads: new Set(['feed']),
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

  const relatedMediaCount = Array.isArray(relatedMedia)
    ? relatedMedia.length
    : isRecord(relatedMedia)
      ? Object.keys(relatedMedia).length
      : undefined;

  if (relatedMediaCount === undefined) {
    return {
      status: 'UNKNOWN',
      reasons: ['Meta returned related_media in an unrecognized format.'],
    };
  }

  return relatedMediaCount > 0
    ? {
        status: 'FAIL',
        reasons: [`Meta returned ${relatedMediaCount} related media item(s).`],
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
  let hasAmbiguousConfiguration = assetLabels.hasMalformedAssets;

  for (const rule of customizationRules) {
    if (!isRecord(rule)) {
      hasAmbiguousConfiguration = true;
      continue;
    }

    const ruleLabel = readRuleLabel(rule);
    if (!ruleLabel || !assetLabels[ruleLabel.assetType].has(ruleLabel.name)) {
      hasAmbiguousConfiguration = true;
      continue;
    }

    const customizationSpec = rule.customization_spec;
    if (!isRecord(customizationSpec)) {
      hasAmbiguousConfiguration = true;
      continue;
    }

    const publisherPlatforms = customizationSpec.publisher_platforms;
    if (!Array.isArray(publisherPlatforms) || publisherPlatforms.length === 0) {
      hasAmbiguousConfiguration = true;
      continue;
    }

    for (const publisherPlatform of publisherPlatforms) {
      if (publisherPlatform === 'facebook') {
        hasAmbiguousConfiguration =
          collectPlatformPositions(
            customizationSpec.facebook_positions,
            FACEBOOK_POSITIONS,
            NON_AUDITED_POSITIONS.facebook,
            coveredFamilies
          ) || hasAmbiguousConfiguration;
      } else if (publisherPlatform === 'instagram') {
        hasAmbiguousConfiguration =
          collectPlatformPositions(
            customizationSpec.instagram_positions,
            INSTAGRAM_POSITIONS,
            NON_AUDITED_POSITIONS.instagram,
            coveredFamilies
          ) || hasAmbiguousConfiguration;
      } else if (publisherPlatform === 'messenger') {
        hasAmbiguousConfiguration =
          hasUnrecognizedPositions(
            customizationSpec.messenger_positions,
            NON_AUDITED_POSITIONS.messenger
          ) || hasAmbiguousConfiguration;
      } else if (publisherPlatform === 'audience_network') {
        hasAmbiguousConfiguration =
          hasUnrecognizedPositions(
            customizationSpec.audience_network_positions,
            NON_AUDITED_POSITIONS.audience_network
          ) || hasAmbiguousConfiguration;
      } else if (publisherPlatform === 'threads') {
        hasAmbiguousConfiguration =
          hasUnrecognizedPositions(
            customizationSpec.threads_positions,
            NON_AUDITED_POSITIONS.threads
          ) || hasAmbiguousConfiguration;
      } else {
        hasAmbiguousConfiguration = true;
      }
    }
  }

  const feed = familyStatus(coveredFamilies, 'feed', hasAmbiguousConfiguration);
  const reels = familyStatus(coveredFamilies, 'reels', hasAmbiguousConfiguration);
  const story = familyStatus(coveredFamilies, 'story', hasAmbiguousConfiguration);
  const statuses = [feed, reels, story];
  const status = aggregatePlacementStatus(statuses);
  const uncoveredFamilies = PLACEMENT_FAMILIES.filter((family) => !coveredFamilies.has(family));

  return {
    status,
    feed,
    reels,
    story,
    reasons:
      status === 'PASS'
        ? ['Feed, Reels, and Story each have an explicit labeled asset rule.']
        : status === 'UNKNOWN'
          ? [
              `Meta returned unrecognized placement configuration; cannot safely assess: ${uncoveredFamilies.join(', ')}.`,
            ]
          : [`Missing explicit labeled asset rules for: ${uncoveredFamilies.join(', ')}.`],
    preview_required: true,
  };
}

function collectAssetLabels(assetFeedSpec: UnknownRecord): {
  image: Set<string>;
  video: Set<string>;
  hasMalformedAssets: boolean;
} {
  const labels = {
    image: new Set<string>(),
    video: new Set<string>(),
    hasMalformedAssets: false,
  };

  for (const { field, assetType } of [
    { field: 'images', assetType: 'image' },
    { field: 'videos', assetType: 'video' },
  ] as const) {
    const assets = assetFeedSpec[field];
    if (assets === undefined) continue;
    if (!Array.isArray(assets)) {
      labels.hasMalformedAssets = true;
      continue;
    }

    for (const asset of assets) {
      if (!isRecord(asset)) {
        labels.hasMalformedAssets = true;
        continue;
      }
      if (asset.adlabels === undefined) continue;
      if (!Array.isArray(asset.adlabels)) {
        labels.hasMalformedAssets = true;
        continue;
      }
      for (const label of asset.adlabels) {
        if (isRecord(label) && typeof label.name === 'string' && label.name.length > 0) {
          labels[assetType].add(label.name);
        } else {
          labels.hasMalformedAssets = true;
        }
      }
    }
  }

  return labels;
}

function readRuleLabel(rule: UnknownRecord): { assetType: AssetType; name: string } | undefined {
  const labels = [
    readTypedRuleLabel(rule.image_label, 'image'),
    readTypedRuleLabel(rule.video_label, 'video'),
  ].filter((label): label is { assetType: AssetType; name: string } => label !== undefined);

  return labels.length === 1 ? labels[0] : undefined;
}

function readTypedRuleLabel(
  value: unknown,
  assetType: AssetType
): { assetType: AssetType; name: string } | undefined {
  return isRecord(value) && typeof value.name === 'string' && value.name.length > 0
    ? { assetType, name: value.name }
    : undefined;
}

function collectPlatformPositions(
  value: unknown,
  acceptedPositions: Record<PlacementFamily, Set<string>>,
  ignoredPositions: Set<string>,
  coveredFamilies: Set<PlacementFamily>
): boolean {
  if (value === undefined) return false;
  if (!Array.isArray(value)) return true;

  let hasUnrecognizedPosition = false;
  for (const position of value) {
    if (typeof position !== 'string') {
      hasUnrecognizedPosition = true;
      continue;
    }

    const normalizedPosition = position.toLowerCase();
    const matchedFamily = PLACEMENT_FAMILIES.find((family) =>
      acceptedPositions[family].has(normalizedPosition)
    );
    if (matchedFamily) {
      coveredFamilies.add(matchedFamily);
    } else if (!ignoredPositions.has(normalizedPosition)) {
      hasUnrecognizedPosition = true;
    }
  }

  return hasUnrecognizedPosition;
}

function hasUnrecognizedPositions(value: unknown, knownPositions: Set<string>): boolean {
  if (value === undefined) return false;
  if (!Array.isArray(value)) return true;

  return value.some(
    (position) => typeof position !== 'string' || !knownPositions.has(position.toLowerCase())
  );
}

function familyStatus(
  coveredFamilies: Set<PlacementFamily>,
  family: PlacementFamily,
  hasAmbiguousConfiguration: boolean
): AdsComplianceStatus {
  if (coveredFamilies.has(family)) return 'PASS';
  return hasAmbiguousConfiguration ? 'UNKNOWN' : 'FAIL';
}

function aggregatePlacementStatus(statuses: AdsComplianceStatus[]): AdsComplianceStatus {
  if (statuses.every((status) => status === 'PASS')) return 'PASS';
  if (statuses.some((status) => status === 'UNKNOWN')) return 'UNKNOWN';
  return 'FAIL';
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
