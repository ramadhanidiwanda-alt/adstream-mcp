import type {
  MetaAdsMode,
  MetaApplinkTreatment,
  MetaCollaborativeAppSpec,
  MetaCreativeSpec,
} from '../../types.js';
import { assertMetaCreativeCompatibility } from './creativeFormatCompatibility.js';

export type BuildMetaCreativeFormatPayloadInput = MetaCreativeSpec & {
  mode: MetaAdsMode;
  pageId: string;
  instagramUserId?: string;
  collaborativeProductSetId?: string;
  collaborativeAppSpec?: MetaCollaborativeAppSpec;
  /**
   * Nama-nama fitur degrees_of_freedom_spec yang di-OPT_OUT (disable).
   * Contoh: ['image_auto_crop', 'text_optimizations', 'image_templates'].
   * Jika diisi, degrees_of_freedom_spec akan diset untuk SEMUA format creative
   * (flexible, video, single_image, carousel).
   * Jika tidak diisi, degrees_of_freedom_spec tidak disertakan (backward compatible).
   */
  optOutEnhancements?: string[];
};

export function buildMetaCreativeFormatPayload(
  input: BuildMetaCreativeFormatPayloadInput
): Record<string, unknown> {
  assertMetaCreativeCompatibility(input);

  switch (input.creativeFormat) {
    case 'single_image':
      return buildSingleImage(input);
    case 'video':
      return buildVideo(input);
    case 'carousel':
      return buildCarousel(input);
    case 'catalog':
      return buildCatalog(input);
    case 'collection':
      return buildCollection(input);
    case 'flexible':
      return buildFlexible(input);
    case 'placement_image':
      return buildPlacementImage(input);
    case 'placement_customized_ctwa':
      return buildPlacementCustomizedCtwa(input);
    case 'existing_post':
      return buildExistingPost(input);
  }
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} wajib diisi.`);
  return normalized;
}

function optional(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  return required(value, label);
}

function cta(
  type: string | undefined,
  destinationUrl?: string,
  collaborativeAppSpec?: MetaCollaborativeAppSpec,
  leadFormId?: string
): Record<string, unknown> {
  const normalizedType = type?.trim() || 'LEARN_MORE';
  if (leadFormId) {
    if (destinationUrl) {
      throw new Error('leadFormId dan destinationUrl tidak dapat digunakan bersamaan.');
    }
    return {
      type: normalizedType,
      value: { lead_gen_form_id: required(leadFormId, 'leadFormId') },
    };
  }
  if (normalizedType === 'WHATSAPP_MESSAGE' && !collaborativeAppSpec) {
    return { type: normalizedType };
  }

  const value: Record<string, unknown> = { link: required(destinationUrl, 'destinationUrl') };
  if (collaborativeAppSpec) {
    value.application = required(
      collaborativeAppSpec.applicationId,
      'collaborativeAppSpec.applicationId'
    );
    const objectStoreUrls = [
      collaborativeAppSpec.android
        ? `http://play.google.com/store/apps/details?id=${encodeURIComponent(
            required(
              collaborativeAppSpec.android.packageName,
              'collaborativeAppSpec.android.packageName'
            )
          )}`
        : undefined,
      collaborativeAppSpec.ios
        ? `http://itunes.apple.com/app/id${encodeURIComponent(
            required(collaborativeAppSpec.ios.appStoreId, 'collaborativeAppSpec.ios.appStoreId')
          )}`
        : undefined,
    ].filter((url): url is string => Boolean(url));
    if (objectStoreUrls.length > 0) value.object_store_urls = objectStoreUrls;
  }

  return {
    type: normalizedType,
    value,
  };
}

function buildSingleImage(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'single_image' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  if (creativeSpec.destinationMode === 'NONE') {
    return withDegreesOfFreedomSpec(
      {
        object_story_spec: {
          page_id: required(input.pageId, 'pageId'),
          ...instagramIdentity(input),
          photo_data: {
            image_hash: required(creativeSpec.imageHash, 'imageHash'),
            message: required(creativeSpec.primaryText, 'primaryText'),
          },
        },
      },
      input.optOutEnhancements
    );
  }

  if (creativeSpec.leadFormId) {
    const linkData: Record<string, unknown> = {
      image_hash: required(creativeSpec.imageHash, 'imageHash'),
      message: required(creativeSpec.primaryText, 'primaryText'),
      call_to_action: cta(
        creativeSpec.callToAction,
        creativeSpec.destinationUrl,
        input.collaborativeAppSpec,
        creativeSpec.leadFormId
      ),
    };
    const headline = optional(creativeSpec.headline, 'headline');
    const description = optional(creativeSpec.description, 'description');
    if (headline) linkData.name = headline;
    if (description) linkData.description = description;

    return withDegreesOfFreedomSpec(
      {
        object_story_spec: {
          page_id: required(input.pageId, 'pageId'),
          ...instagramIdentity(input),
          link_data: linkData,
        },
      },
      input.optOutEnhancements
    );
  }

  const destinationUrl = required(creativeSpec.destinationUrl, 'destinationUrl');
  const linkData: Record<string, unknown> = {
    image_hash: required(creativeSpec.imageHash, 'imageHash'),
    message: required(creativeSpec.primaryText, 'primaryText'),
    link: destinationUrl,
    call_to_action: cta(creativeSpec.callToAction, destinationUrl, input.collaborativeAppSpec),
  };
  const headline = optional(creativeSpec.headline, 'headline');
  const description = optional(creativeSpec.description, 'description');
  const pageWelcomeMessage = optional(creativeSpec.pageWelcomeMessage, 'pageWelcomeMessage');

  if (headline) linkData.name = headline;
  if (description) linkData.description = description;
  if (pageWelcomeMessage) linkData.page_welcome_message = pageWelcomeMessage;

  const payload = withCollaborativeCatalogContext(
    input,
    {
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        ...instagramIdentity(input),
        link_data: linkData,
      },
    },
    destinationUrl
  );

  return withDegreesOfFreedomSpec(
    withDirectOmnichannelLinkFields(input, payload, destinationUrl, creativeSpec.applinkTreatment),
    input.optOutEnhancements
  );
}

function buildVideo(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'video' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  const thumbnailImageHash = optional(creativeSpec.thumbnailImageHash, 'thumbnailImageHash');
  const thumbnailImageUrl = optional(creativeSpec.thumbnailImageUrl, 'thumbnailImageUrl');

  if (creativeSpec.destinationMode === 'NONE') {
    const videoData = {
      video_id: required(creativeSpec.videoId, 'videoId'),
      message: required(creativeSpec.primaryText, 'primaryText'),
      ...(creativeSpec.headline?.trim() ? { title: creativeSpec.headline.trim() } : {}),
      ...(thumbnailImageHash ? { image_hash: thumbnailImageHash } : {}),
      ...(!thumbnailImageHash && thumbnailImageUrl ? { image_url: thumbnailImageUrl } : {}),
    };

    return withDegreesOfFreedomSpec(
      {
        object_story_spec: {
          page_id: required(input.pageId, 'pageId'),
          ...instagramIdentity(input),
          video_data: videoData,
        },
      },
      input.optOutEnhancements
    );
  }

  if (creativeSpec.leadFormId) {
    const videoData: Record<string, unknown> = {
      video_id: required(creativeSpec.videoId, 'videoId'),
      message: required(creativeSpec.primaryText, 'primaryText'),
      call_to_action: cta(
        creativeSpec.callToAction,
        creativeSpec.destinationUrl,
        input.collaborativeAppSpec,
        creativeSpec.leadFormId
      ),
    };
    const headline = optional(creativeSpec.headline, 'headline');
    if (thumbnailImageHash) videoData.image_hash = thumbnailImageHash;
    else if (thumbnailImageUrl) videoData.image_url = thumbnailImageUrl;
    if (headline) videoData.title = headline;

    return withDegreesOfFreedomSpec(
      {
        object_story_spec: {
          page_id: required(input.pageId, 'pageId'),
          ...instagramIdentity(input),
          video_data: videoData,
        },
      },
      input.optOutEnhancements
    );
  }

  const destinationUrl = required(creativeSpec.destinationUrl, 'destinationUrl');
  const videoData: Record<string, unknown> = {
    video_id: required(creativeSpec.videoId, 'videoId'),
    message: required(creativeSpec.primaryText, 'primaryText'),
    call_to_action: cta(creativeSpec.callToAction, destinationUrl, input.collaborativeAppSpec),
  };
  const headline = optional(creativeSpec.headline, 'headline');
  const pageWelcomeMessage = optional(creativeSpec.pageWelcomeMessage, 'pageWelcomeMessage');

  // Meta requires exactly one of image_hash / image_url on video_data.
  // Prefer an explicit hash; fall back to a URL (e.g. the video's own
  // auto-generated thumbnail, filled in by the caller when neither was given).
  if (thumbnailImageHash) videoData.image_hash = thumbnailImageHash;
  else if (thumbnailImageUrl) videoData.image_url = thumbnailImageUrl;
  if (headline) videoData.title = headline;
  if (pageWelcomeMessage) videoData.page_welcome_message = pageWelcomeMessage;

  const payload = withCollaborativeCatalogContext(
    input,
    {
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        ...instagramIdentity(input),
        video_data: videoData,
      },
    },
    destinationUrl
  );

  return withDegreesOfFreedomSpec(
    withDirectOmnichannelLinkFields(input, payload, destinationUrl, creativeSpec.applinkTreatment),
    input.optOutEnhancements
  );
}

function buildCarousel(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'carousel' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  if (creativeSpec.cards.length < 2) {
    throw new Error('Carousel minimal 2 kartu.');
  }

  const childAttachments = creativeSpec.cards.map((card, index) => {
    const imageHash = optional(card.imageHash, `cards[${index}].imageHash`);
    const videoId = optional(card.videoId, `cards[${index}].videoId`);
    if (Boolean(imageHash) === Boolean(videoId)) {
      throw new Error(`Kartu carousel ${index + 1} wajib memiliki tepat satu media.`);
    }

    const destinationUrl = required(card.destinationUrl, `cards[${index}].destinationUrl`);
    const attachment: Record<string, unknown> = {
      name: required(card.headline, `cards[${index}].headline`),
      link: destinationUrl,
      call_to_action: cta(creativeSpec.callToAction, destinationUrl, input.collaborativeAppSpec),
    };
    const description = optional(card.description, `cards[${index}].description`);

    if (imageHash) attachment.image_hash = imageHash;
    if (videoId) attachment.video_id = videoId;
    if (description) attachment.description = description;

    return attachment;
  });

  const destinationUrl =
    creativeSpec.destinationUrl?.trim() || creativeSpec.cards[0]?.destinationUrl;

  return withDegreesOfFreedomSpec(
    withCollaborativeCatalogContext(
      input,
      {
        object_story_spec: {
          page_id: required(input.pageId, 'pageId'),
          ...instagramIdentity(input),
          link_data: {
            message: required(creativeSpec.primaryText, 'primaryText'),
            attachment_style: 'link',
            child_attachments: childAttachments,
          },
        },
      },
      destinationUrl ?? ''
    ),
    input.optOutEnhancements
  );
}

function buildExistingPost(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'existing_post' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  const objectStoryId = optional(creativeSpec.objectStoryId, 'objectStoryId');
  const sourceInstagramMediaId = optional(
    creativeSpec.sourceInstagramMediaId,
    'sourceInstagramMediaId'
  );

  if (Boolean(objectStoryId) === Boolean(sourceInstagramMediaId)) {
    throw new Error(
      'Pilih salah satu objectStoryId (post di Facebook Page) atau sourceInstagramMediaId (media IG yang tidak di-cross-post) untuk existing_post.'
    );
  }

  const payload: Record<string, unknown> = objectStoryId
    ? { object_story_id: objectStoryId }
    : { source_instagram_media_id: sourceInstagramMediaId };

  const callToAction = optional(creativeSpec.callToAction, 'callToAction');

  if (callToAction) {
    // TOP-LEVEL call_to_action, never object_story_spec. Verified live against
    // v25.0: object_story_spec alongside source_instagram_media_id is rejected as
    // (#100) "Ambiguous Promoted Object" [subcode 1487929], while a top-level
    // call_to_action carrying value.link is accepted and stored — that is the shape
    // Ads Manager itself writes for a boosted Instagram post.
    payload.call_to_action = cta(
      callToAction,
      required(creativeSpec.destinationUrl, 'destinationUrl untuk existing_post ber-callToAction'),
      input.collaborativeAppSpec
    );
  } else if (creativeSpec.destinationUrl !== undefined && !input.collaborativeAppSpec) {
    // Nothing would carry the URL, so say so instead of dropping it.
    throw new Error(
      'destinationUrl pada existing_post butuh callToAction (agar terkirim sebagai call_to_action.value.link) atau collaborativeAppSpec (untuk omnichannel_link_spec). Tanpa salah satunya, destinationUrl tidak dipakai sama sekali.'
    );
  }

  if (!input.collaborativeAppSpec) return payload;

  const destinationUrl = required(
    creativeSpec.destinationUrl,
    'destinationUrl untuk existing_post ber-omnichannel'
  );
  return {
    ...payload,
    ...buildOmnichannelLinkFields(
      destinationUrl,
      input.collaborativeAppSpec,
      creativeSpec.applinkTreatment
    ),
  };
}

function buildCatalog(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'catalog' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  const productSetId = required(creativeSpec.productSetId, 'Product set catalog');
  const destinationUrl = creativeSpec.destinationUrl?.trim() ?? '';

  if (input.mode === 'collaborative_ads') {
    const collaborativeProductSetId = required(
      input.collaborativeProductSetId,
      'Product set Collaborative Ads'
    );
    if (productSetId !== collaborativeProductSetId) {
      throw new Error('Product set creative dan ad set harus sama.');
    }
  }

  const templateData: Record<string, unknown> = {
    message: required(creativeSpec.primaryText, 'primaryText'),
  };
  const headline = optional(creativeSpec.headline, 'headline');
  const description = optional(creativeSpec.description, 'description');
  const templateUrl = optional(creativeSpec.templateUrl, 'templateUrl');
  const fallbackImageHash = optional(creativeSpec.fallbackImageHash, 'fallbackImageHash');

  if (headline) templateData.name = headline;
  if (description) templateData.description = description;
  if (destinationUrl) {
    templateData.link = destinationUrl;
    templateData.call_to_action = cta(
      creativeSpec.callToAction,
      destinationUrl,
      input.collaborativeAppSpec
    );
  }
  if (templateUrl) templateData.template_url = templateUrl;
  if (fallbackImageHash) templateData.image_hash = fallbackImageHash;

  return withCollaborativeCatalogContext(
    input,
    {
      product_set_id: productSetId,
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        ...instagramIdentity(input),
        template_data: templateData,
      },
    },
    destinationUrl
  );
}

/**
 * Build the omnichannel applink fields (`omnichannel_link_spec` plus optional
 * `applink_treatment`) that a cross-channel/omnichannel ad set requires on its
 * creative. Shared by collaborative catalog creatives and placement_image.
 */
function buildOmnichannelLinkFields(
  destinationUrl: string,
  collaborativeAppSpec?: MetaCollaborativeAppSpec,
  applinkTreatmentOverride?: MetaApplinkTreatment
): Record<string, unknown> {
  const omnichannelLinkSpec: Record<string, unknown> = {
    web: { url: required(destinationUrl, 'Destination URL Omnichannel') },
  };
  if (collaborativeAppSpec) {
    omnichannelLinkSpec.app = buildCollaborativeAppSpec(collaborativeAppSpec);
  }
  return {
    ...(collaborativeAppSpec ? { applink_treatment: applinkTreatmentOverride ?? 'automatic' } : {}),
    omnichannel_link_spec: omnichannelLinkSpec,
  };
}

function withCollaborativeCatalogContext(
  input: BuildMetaCreativeFormatPayloadInput,
  payload: Record<string, unknown>,
  destinationUrl: string
): Record<string, unknown> {
  if (input.mode !== 'collaborative_ads') return payload;

  required(input.collaborativeProductSetId, 'Product set Collaborative Ads');

  const usesProductTemplate =
    input.creativeFormat === 'catalog' || input.creativeFormat === 'collection';

  return {
    ...payload,
    ...(usesProductTemplate
      ? {
          product_set_id: required(
            input.collaborativeProductSetId,
            'Product set Collaborative Ads'
          ),
        }
      : {}),
    ...buildOmnichannelLinkFields(destinationUrl, input.collaborativeAppSpec),
  };
}

/**
 * Adds omnichannel applink fields directly whenever collaborativeAppSpec is
 * present, independent of mode/product set — same trigger buildPlacementImage
 * already uses. Skipped when mode is 'collaborative_ads': withCollaborativeCatalogContext
 * already applies buildOmnichannelLinkFields for that catalog-bound path, which
 * requires a matching product set there.
 */
function withDirectOmnichannelLinkFields(
  input: BuildMetaCreativeFormatPayloadInput,
  payload: Record<string, unknown>,
  destinationUrl: string,
  applinkTreatmentOverride?: MetaApplinkTreatment
): Record<string, unknown> {
  if (input.mode === 'collaborative_ads' || !input.collaborativeAppSpec) return payload;
  return {
    ...payload,
    ...buildOmnichannelLinkFields(
      destinationUrl,
      input.collaborativeAppSpec,
      applinkTreatmentOverride
    ),
  };
}

function buildCollaborativeAppSpec(spec: MetaCollaborativeAppSpec): Record<string, unknown> {
  const platformSpecs: Record<string, unknown> = {};
  if (spec.android) {
    platformSpecs.android = {
      app_name: required(spec.android.appName, 'collaborativeAppSpec.android.appName'),
      package_name: required(spec.android.packageName, 'collaborativeAppSpec.android.packageName'),
    };
  }
  if (spec.ios) {
    platformSpecs.ios = {
      app_name: required(spec.ios.appName, 'collaborativeAppSpec.ios.appName'),
      app_store_id: required(spec.ios.appStoreId, 'collaborativeAppSpec.ios.appStoreId'),
    };
  }

  return {
    application_id: required(spec.applicationId, 'collaborativeAppSpec.applicationId'),
    ...(Object.keys(platformSpecs).length > 0 ? { platform_specs: platformSpecs } : {}),
  };
}

function buildCollection(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'collection' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  const productSetId = optional(creativeSpec.productSetId, 'Product set Collection');
  if (input.mode === 'collaborative_ads' && productSetId) {
    const collaborativeProductSetId = required(
      input.collaborativeProductSetId,
      'Product set Collaborative Ads'
    );
    if (productSetId !== collaborativeProductSetId) {
      throw new Error('Product set creative dan ad set harus sama.');
    }
  }
  const instantExperienceUrl = `https://fb.com/canvas_doc/${encodeURIComponent(
    required(creativeSpec.instantExperienceId, 'instantExperienceId')
  )}`;
  const coverImageHash = optional(creativeSpec.coverImageHash, 'coverImageHash');
  const coverVideoId = optional(creativeSpec.coverVideoId, 'coverVideoId');

  if (Boolean(coverImageHash) === Boolean(coverVideoId)) {
    throw new Error('Pilih salah satu cover image atau cover video untuk Collection.');
  }

  const primaryText = required(creativeSpec.primaryText, 'primaryText');
  const headline = optional(creativeSpec.headline, 'headline');
  const description = optional(creativeSpec.description, 'description');
  const pageId = required(input.pageId, 'pageId');
  const storySpec: Record<string, unknown> = {
    page_id: pageId,
    ...instagramIdentity(input),
  };

  if (coverImageHash) {
    const linkData: Record<string, unknown> = {
      image_hash: coverImageHash,
      message: primaryText,
      link: instantExperienceUrl,
      call_to_action: cta(
        creativeSpec.callToAction,
        instantExperienceUrl,
        input.collaborativeAppSpec
      ),
    };
    if (headline) linkData.name = headline;
    if (description) linkData.description = description;
    storySpec.link_data = linkData;
  } else {
    const videoData: Record<string, unknown> = {
      video_id: coverVideoId,
      message: primaryText,
      call_to_action: cta(
        creativeSpec.callToAction,
        instantExperienceUrl,
        input.collaborativeAppSpec
      ),
    };
    if (headline) videoData.title = headline;
    storySpec.video_data = videoData;
  }

  const destinationUrl =
    optional(creativeSpec.destinationUrl, 'destinationUrl') ?? instantExperienceUrl;

  return withCollaborativeCatalogContext(
    input,
    {
      ...(productSetId ? { product_set_id: productSetId } : {}),
      object_story_spec: storySpec,
    },
    destinationUrl
  );
}

function buildFlexible(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'flexible' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  const assetFeedSpec = creativeSpec.assetFeedSpec;

  // Priority: creativeSpec fields > assetFeedSpec fields > defaults
  const imageHashes =
    nonBlankValues(creativeSpec.imageHashes).length > 0
      ? nonBlankValues(creativeSpec.imageHashes)
      : (assetFeedSpec?.images ?? []).map((img) => img.hash).filter(Boolean);
  const videoIds =
    nonBlankValues(creativeSpec.videoIds).length > 0
      ? nonBlankValues(creativeSpec.videoIds)
      : (assetFeedSpec?.videos ?? []).map((vid) => vid.video_id).filter(Boolean);
  const primaryTexts =
    nonBlankValues(creativeSpec.primaryTexts).length > 0
      ? nonBlankValues(creativeSpec.primaryTexts)
      : (assetFeedSpec?.bodies ?? []).map((b) => b.text).filter(Boolean);
  const headlines =
    nonBlankValues(creativeSpec.headlines).length > 0
      ? nonBlankValues(creativeSpec.headlines)
      : (assetFeedSpec?.titles ?? []).map((t) => t.text).filter(Boolean);
  const descriptions =
    nonBlankValues(creativeSpec.descriptions).length > 0
      ? nonBlankValues(creativeSpec.descriptions)
      : [];

  // Destination URL: creativeSpec > first assetFeedSpec.link_urls > required
  const destinationUrl =
    creativeSpec.destinationUrl?.trim() || assetFeedSpec?.link_urls?.[0]?.website_url?.trim() || '';
  if (!destinationUrl) {
    throw new Error('Flexible creative memerlukan destinationUrl atau assetFeedSpec.link_urls.');
  }

  // CTA: creativeSpec > first assetFeedSpec.call_to_action_types > default
  const callToAction =
    creativeSpec.callToAction?.trim() ||
    assetFeedSpec?.call_to_action_types?.[0]?.trim() ||
    'LEARN_MORE';

  if (imageHashes.length === 0 && videoIds.length === 0) {
    throw new Error('Flexible creative wajib memiliki minimal satu media.');
  }
  if (primaryTexts.length === 0) {
    throw new Error('Flexible creative wajib memiliki minimal satu primary text.');
  }

  const feedSpec: Record<string, unknown> = {
    bodies: primaryTexts.map((text) => ({ text })),
    link_urls: [{ website_url: destinationUrl }],
    call_to_action_types: [callToAction],
    ad_formats: [
      ...(imageHashes.length > 0 ? ['SINGLE_IMAGE'] : []),
      ...(videoIds.length > 0 ? ['SINGLE_VIDEO'] : []),
    ],
  };

  if (imageHashes.length > 0) feedSpec.images = imageHashes.map((hash) => ({ hash }));
  if (videoIds.length > 0) feedSpec.videos = videoIds.map((video_id) => ({ video_id }));
  if (headlines.length > 0) feedSpec.titles = headlines.map((text) => ({ text }));
  if (descriptions.length > 0) feedSpec.descriptions = descriptions.map((text) => ({ text }));
  addMessageExtensions(feedSpec, creativeSpec.messageExtensions);

  const objectStorySpec: Record<string, unknown> = {
    page_id: required(input.pageId, 'pageId'),
  };
  const instagramUserId = optional(input.instagramUserId, 'instagramUserId');
  if (instagramUserId) objectStorySpec.instagram_user_id = instagramUserId;

  const payload: Record<string, unknown> = {
    object_story_spec: objectStorySpec,
    asset_feed_spec: feedSpec,
  };

  // Fix #4: degrees_of_freedom_spec jika optOutEnhancements diisi
  if (input.optOutEnhancements && input.optOutEnhancements.length > 0) {
    payload.degrees_of_freedom_spec = buildCreativeFeatureOptOutSpec(input.optOutEnhancements);
  }

  return payload;
}

function buildPlacementImage(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'placement_image' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  const feedImageHash = required(creativeSpec.feedImageHash, 'feedImageHash');
  const verticalImageHash = required(creativeSpec.verticalImageHash, 'verticalImageHash');
  if (feedImageHash === verticalImageHash) {
    throw new Error('feedImageHash dan verticalImageHash harus berbeda.');
  }

  const primaryText = required(creativeSpec.primaryText, 'primaryText');
  const headline = required(creativeSpec.headline, 'headline');
  const destinationUrl = required(creativeSpec.destinationUrl, 'destinationUrl');
  const callToAction = creativeSpec.callToAction?.trim() || 'LEARN_MORE';
  const pageWelcomeMessage = optional(creativeSpec.pageWelcomeMessage, 'pageWelcomeMessage');
  const description = optional(creativeSpec.description, 'description');
  const isClickToMessage = callToAction === 'WHATSAPP_MESSAGE';

  const assetFeedSpec: Record<string, unknown> = {
    ad_formats: ['SINGLE_IMAGE'],
    images: [
      { hash: feedImageHash, adlabels: [{ name: 'placement_feed_1_1' }] },
      { hash: verticalImageHash, adlabels: [{ name: 'placement_vertical_9_16' }] },
    ],
    bodies: [{ text: primaryText }],
    titles: [{ text: headline }],
    link_urls: [{ website_url: destinationUrl }],
    call_to_action_types: [callToAction],
    asset_customization_rules: [
      {
        image_label: { name: 'placement_feed_1_1' },
        customization_spec: {
          publisher_platforms: ['facebook', 'instagram'],
          facebook_positions: ['feed'],
          instagram_positions: ['stream'],
        },
      },
      {
        image_label: { name: 'placement_vertical_9_16' },
        customization_spec: {
          publisher_platforms: ['facebook', 'instagram'],
          facebook_positions: ['facebook_reels', 'story'],
          instagram_positions: ['reels', 'story'],
        },
      },
    ],
  };

  if (description) assetFeedSpec.descriptions = [{ text: description }];
  addMessageExtensions(assetFeedSpec, creativeSpec.messageExtensions);
  if (isClickToMessage || pageWelcomeMessage) {
    assetFeedSpec.additional_data = {
      ...(isClickToMessage ? { is_click_to_message: true } : {}),
      ...(pageWelcomeMessage ? { page_welcome_message: pageWelcomeMessage } : {}),
    };
  }

  return {
    object_story_spec: {
      page_id: required(input.pageId, 'pageId'),
      ...instagramIdentity(input),
    },
    asset_feed_spec: assetFeedSpec,
    // Omnichannel ad sets require an applink spec on the creative. Add it when
    // an app spec is supplied so a placement_image creative can attach to a
    // cross-channel (CPAS omnichannel) ad set.
    ...(input.collaborativeAppSpec
      ? buildOmnichannelLinkFields(destinationUrl, input.collaborativeAppSpec)
      : {}),
  };
}

function buildPlacementCustomizedCtwa(
  input: Extract<
    BuildMetaCreativeFormatPayloadInput,
    { creativeFormat: 'placement_customized_ctwa' }
  >
): Record<string, unknown> {
  const { creativeSpec } = input;
  const feedImageHash = required(creativeSpec.feedImageHash, 'feedImageHash');
  const verticalImageHash = required(creativeSpec.verticalImageHash, 'verticalImageHash');
  if (feedImageHash === verticalImageHash) {
    throw new Error('feedImageHash dan verticalImageHash harus berbeda.');
  }

  const destinationUrl = required(creativeSpec.destinationUrl, 'destinationUrl');
  const linkData: Record<string, unknown> = {
    image_hash: feedImageHash,
    message: required(creativeSpec.primaryText, 'primaryText'),
    name: required(creativeSpec.headline, 'headline'),
    link: destinationUrl,
    call_to_action: cta('WHATSAPP_MESSAGE', destinationUrl, input.collaborativeAppSpec),
  };
  const description = optional(creativeSpec.description, 'description');
  const pageWelcomeMessage = optional(creativeSpec.pageWelcomeMessage, 'pageWelcomeMessage');

  if (description) linkData.description = description;
  if (pageWelcomeMessage) linkData.page_welcome_message = pageWelcomeMessage;

  return {
    object_story_spec: {
      page_id: required(input.pageId, 'pageId'),
      ...instagramIdentity(input),
      link_data: linkData,
    },
    platform_customizations: {
      instagram: {
        image_hash: verticalImageHash,
      },
    },
    portrait_customizations: {
      image_hash: verticalImageHash,
    },
    degrees_of_freedom_spec: buildCreativeFeatureOptOutSpec(input.optOutEnhancements),
    media_sourcing_spec: {
      related_media: [],
    },
  };
}

function buildCreativeFeatureOptOutSpec(features?: string[]): Record<string, unknown> {
  const featureList = features?.length
    ? features
    : [
        'image_auto_crop',
        'text_optimizations',
        'image_templates',
        'image_brightness_and_contrast',
        'image_animation',
        'image_background_gen',
        'image_uncrop',
        'catalog_feed_tag',
        'product_extensions',
      ];

  return {
    creative_features_spec: Object.fromEntries(
      featureList.map((feature) => [feature, { enroll_status: 'OPT_OUT' }])
    ),
  };
}

/**
 * Wrap payload with degrees_of_freedom_spec when optOutEnhancements is provided.
 * Used by single_image, video, carousel, and flexible builders.
 */
function withDegreesOfFreedomSpec(
  payload: Record<string, unknown>,
  optOutEnhancements: string[] | undefined
): Record<string, unknown> {
  if (!optOutEnhancements || optOutEnhancements.length === 0) return payload;
  return {
    ...payload,
    degrees_of_freedom_spec: buildCreativeFeatureOptOutSpec(optOutEnhancements),
  };
}

function nonBlankValues(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  });
}

function addMessageExtensions(
  assetFeedSpec: Record<string, unknown>,
  messageExtensions: { type: string }[] | undefined
): void {
  const normalized = (messageExtensions ?? []).flatMap((extension) => {
    const type = extension.type.trim();
    return type ? [{ type }] : [];
  });
  if (normalized.length > 0) assetFeedSpec.message_extensions = normalized;
}

function instagramIdentity(
  input: Pick<BuildMetaCreativeFormatPayloadInput, 'instagramUserId'>
): Record<string, string> {
  const instagramUserId = optional(input.instagramUserId, 'instagramUserId');
  return instagramUserId ? { instagram_user_id: instagramUserId } : {};
}
