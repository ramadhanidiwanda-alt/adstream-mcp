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
  platform_customizations?: unknown;
  portrait_customizations?: unknown;
  image_crops?: unknown;
  requested_fields?: {
    degrees_of_freedom_spec?: boolean;
    media_sourcing_spec?: boolean;
    asset_feed_spec?: boolean;
  };
  active_placements?: MetaActivePlacements;
}

export interface MetaActivePlacements {
  feed?: boolean;
  reels?: boolean;
  story?: boolean;
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
    ai_creative: evaluateAiCreative(
      input.degrees_of_freedom_spec,
      input.requested_fields?.degrees_of_freedom_spec === true
    ),
    related_media: evaluateRelatedMedia(
      input.media_sourcing_spec,
      input.requested_fields?.media_sourcing_spec === true
    ),
    placement_customization: evaluatePlacementCustomization(
      input.asset_feed_spec,
      input.active_placements,
      input.requested_fields?.asset_feed_spec === true,
      hasAlternativePlacementCustomization(input)
    ),
  };
}

export function deriveMetaActivePlacements(targeting: unknown): MetaActivePlacements {
  if (!isRecord(targeting)) return {};
  if (targeting.publisher_platforms === undefined) {
    return { feed: true, reels: true, story: true };
  }
  if (!Array.isArray(targeting.publisher_platforms)) return {};

  const publishers = new Set(
    targeting.publisher_platforms.filter(
      (publisher): publisher is string => typeof publisher === 'string'
    )
  );

  return Object.fromEntries(
    PLACEMENT_FAMILIES.map((family) => {
      let active = false;
      let uncertain = false;

      for (const [publisher, field, acceptedPositions] of [
        ['facebook', 'facebook_positions', FACEBOOK_POSITIONS],
        ['instagram', 'instagram_positions', INSTAGRAM_POSITIONS],
      ] as const) {
        if (!publishers.has(publisher)) continue;
        const positions = targeting[field];
        if (positions === undefined) {
          active = true;
          continue;
        }
        if (!Array.isArray(positions)) {
          uncertain = true;
          continue;
        }
        if (
          positions.some(
            (position) =>
              typeof position === 'string' && acceptedPositions[family].has(position.toLowerCase())
          )
        ) {
          active = true;
        }
      }

      return [family, active ? true : uncertain ? undefined : false];
    })
  );
}

function evaluateAiCreative(
  degreesOfFreedomSpec: unknown,
  fieldRequested: boolean
): AdsCreativeSetupCompliance['ai_creative'] {
  if (!isRecord(degreesOfFreedomSpec)) {
    return {
      status: fieldRequested ? 'NOT_APPLICABLE' : 'UNKNOWN',
      enabled_features: [],
      reasons: [
        fieldRequested
          ? 'Meta returned no AI creative configuration for this creative.'
          : 'Meta did not return degrees_of_freedom_spec.',
      ],
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

function evaluateRelatedMedia(
  mediaSourcingSpec: unknown,
  fieldRequested: boolean
): AdsComplianceCheck {
  if (!isRecord(mediaSourcingSpec)) {
    return {
      status: fieldRequested ? 'PASS' : 'UNKNOWN',
      reasons: [
        fieldRequested
          ? 'Meta returned no media sourcing configuration, so no related media is configured.'
          : 'Meta did not return media_sourcing_spec.',
      ],
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
  assetFeedSpec: unknown,
  activePlacements: MetaActivePlacements | undefined,
  fieldRequested: boolean,
  hasAlternativeCustomization: boolean
): AdsPlacementCustomizationCompliance {
  const unknownResult: AdsPlacementCustomizationCompliance = {
    status: 'UNKNOWN',
    feed: 'UNKNOWN',
    reels: 'UNKNOWN',
    story: 'UNKNOWN',
    reasons: ['Meta did not return a recognizable asset_feed_spec.'],
    preview_required: true,
  };

  if (!isRecord(assetFeedSpec)) {
    return activePlacements
      ? applyActivePlacementEvidence(
          unknownResult,
          activePlacements,
          fieldRequested,
          true,
          hasAlternativeCustomization
        )
      : unknownResult;
  }

  const customizationRules = assetFeedSpec.asset_customization_rules;
  if (customizationRules === undefined) {
    const result = {
      ...unknownResult,
      reasons: ['Meta did not return asset customization rules.'],
    };
    return activePlacements
      ? applyActivePlacementEvidence(
          result,
          activePlacements,
          fieldRequested,
          true,
          hasAlternativeCustomization
        )
      : result;
  }
  if (!Array.isArray(customizationRules)) {
    const result = {
      ...unknownResult,
      reasons: ['Meta returned asset customization rules in an unrecognized format.'],
    };
    return activePlacements
      ? applyActivePlacementEvidence(
          result,
          activePlacements,
          fieldRequested,
          false,
          hasAlternativeCustomization
        )
      : result;
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

  const result: AdsPlacementCustomizationCompliance = {
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

  return activePlacements
    ? applyActivePlacementEvidence(
        result,
        activePlacements,
        fieldRequested,
        false,
        hasAlternativeCustomization
      )
    : result;
}

function applyActivePlacementEvidence(
  configuration: AdsPlacementCustomizationCompliance,
  activePlacements: MetaActivePlacements,
  fieldRequested: boolean,
  missingConfiguration = false,
  hasAlternativeCustomization = false
): AdsPlacementCustomizationCompliance {
  const statuses = Object.fromEntries(
    PLACEMENT_FAMILIES.map((family) => {
      const isActive = activePlacements[family];
      if (isActive === false) return [family, 'NOT_APPLICABLE'];
      if (isActive === undefined) return [family, 'UNKNOWN'];

      const configuredStatus = configuration[family];
      if (configuredStatus === 'PASS') return [family, 'MANUAL_REVIEW'];
      if (configuredStatus === 'UNKNOWN' && hasAlternativeCustomization) {
        return [family, 'MANUAL_REVIEW'];
      }
      if (configuredStatus === 'UNKNOWN' && fieldRequested && missingConfiguration) {
        return [family, 'FAIL'];
      }
      return [family, configuredStatus];
    })
  ) as Record<PlacementFamily, AdsComplianceStatus>;

  const status = aggregateActivePlacementStatus(
    PLACEMENT_FAMILIES.map((family) => statuses[family])
  );

  return {
    ...configuration,
    status,
    feed: statuses.feed,
    reels: statuses.reels,
    story: statuses.story,
    reasons:
      status === 'FAIL'
        ? ['An active placement has no explicit customized media rule.']
        : status === 'MANUAL_REVIEW'
          ? [
              'Customized media is configured; review placement previews to confirm there is no crop.',
            ]
          : status === 'NOT_APPLICABLE'
            ? ['Feed, Reels, and Story are not active for this ad set.']
            : configuration.reasons,
  };
}

function hasAlternativePlacementCustomization(input: MetaCreativeComplianceInput): boolean {
  return [input.platform_customizations, input.portrait_customizations, input.image_crops].some(
    (value) =>
      (isRecord(value) && Object.keys(value).length > 0) ||
      (Array.isArray(value) && value.length > 0)
  );
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

function aggregateActivePlacementStatus(statuses: AdsComplianceStatus[]): AdsComplianceStatus {
  if (statuses.some((status) => status === 'FAIL')) return 'FAIL';
  if (statuses.some((status) => status === 'UNKNOWN')) return 'UNKNOWN';
  if (statuses.some((status) => status === 'MANUAL_REVIEW')) return 'MANUAL_REVIEW';
  if (statuses.every((status) => status === 'NOT_APPLICABLE')) return 'NOT_APPLICABLE';
  return 'PASS';
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
