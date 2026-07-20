import type { MetaAdsMode, MetaCollaborativeAppSpec, MetaCreativeSpec } from '../../types.js';
import { assertMetaCreativeCompatibility } from './creativeFormatCompatibility.js';

export type BuildMetaCreativeFormatPayloadInput = MetaCreativeSpec & {
  mode: MetaAdsMode;
  pageId: string;
  instagramUserId?: string;
  collaborativeProductSetId?: string;
  collaborativeAppSpec?: MetaCollaborativeAppSpec;
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
  destinationUrl: string,
  collaborativeAppSpec?: MetaCollaborativeAppSpec
): Record<string, unknown> {
  const value: Record<string, unknown> = { link: destinationUrl };
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
    type: type?.trim() || 'LEARN_MORE',
    value,
  };
}

function buildSingleImage(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'single_image' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
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

  return withCollaborativeCatalogContext(
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
}

function buildVideo(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'video' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
  const destinationUrl = required(creativeSpec.destinationUrl, 'destinationUrl');
  const videoData: Record<string, unknown> = {
    video_id: required(creativeSpec.videoId, 'videoId'),
    message: required(creativeSpec.primaryText, 'primaryText'),
    call_to_action: cta(creativeSpec.callToAction, destinationUrl, input.collaborativeAppSpec),
  };
  const thumbnailImageHash = optional(creativeSpec.thumbnailImageHash, 'thumbnailImageHash');
  const thumbnailImageUrl = optional(creativeSpec.thumbnailImageUrl, 'thumbnailImageUrl');
  const headline = optional(creativeSpec.headline, 'headline');
  const pageWelcomeMessage = optional(creativeSpec.pageWelcomeMessage, 'pageWelcomeMessage');

  // Meta requires exactly one of image_hash / image_url on video_data.
  // Prefer an explicit hash; fall back to a URL (e.g. the video's own
  // auto-generated thumbnail, filled in by the caller when neither was given).
  if (thumbnailImageHash) videoData.image_hash = thumbnailImageHash;
  else if (thumbnailImageUrl) videoData.image_url = thumbnailImageUrl;
  if (headline) videoData.title = headline;
  if (pageWelcomeMessage) videoData.page_welcome_message = pageWelcomeMessage;

  return withCollaborativeCatalogContext(
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

  return withCollaborativeCatalogContext(
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
  );
}

function buildExistingPost(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'existing_post' }>
): Record<string, unknown> {
  return { object_story_id: required(input.creativeSpec.objectStoryId, 'objectStoryId') };
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
  collaborativeAppSpec?: MetaCollaborativeAppSpec
): Record<string, unknown> {
  const omnichannelLinkSpec: Record<string, unknown> = {
    web: { url: required(destinationUrl, 'Destination URL Omnichannel') },
  };
  if (collaborativeAppSpec) {
    omnichannelLinkSpec.app = buildCollaborativeAppSpec(collaborativeAppSpec);
  }
  return {
    ...(collaborativeAppSpec ? { applink_treatment: 'automatic' } : {}),
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
  const imageHashes = nonBlankValues(creativeSpec.imageHashes);
  const videoIds = nonBlankValues(creativeSpec.videoIds);
  const primaryTexts = nonBlankValues(creativeSpec.primaryTexts);

  if (imageHashes.length === 0 && videoIds.length === 0) {
    throw new Error('Flexible creative wajib memiliki minimal satu media.');
  }
  if (primaryTexts.length === 0) {
    throw new Error('Flexible creative wajib memiliki minimal satu primary text.');
  }

  const assetFeedSpec: Record<string, unknown> = {
    bodies: primaryTexts.map((text) => ({ text })),
    link_urls: [{ website_url: required(creativeSpec.destinationUrl, 'destinationUrl') }],
    call_to_action_types: [creativeSpec.callToAction?.trim() || 'LEARN_MORE'],
    ad_formats: [
      ...(imageHashes.length > 0 ? ['SINGLE_IMAGE'] : []),
      ...(videoIds.length > 0 ? ['SINGLE_VIDEO'] : []),
    ],
  };
  const headlines = nonBlankValues(creativeSpec.headlines);
  const descriptions = nonBlankValues(creativeSpec.descriptions);

  if (imageHashes.length > 0) assetFeedSpec.images = imageHashes.map((hash) => ({ hash }));
  if (videoIds.length > 0) assetFeedSpec.videos = videoIds.map((video_id) => ({ video_id }));
  if (headlines.length > 0) assetFeedSpec.titles = headlines.map((text) => ({ text }));
  if (descriptions.length > 0) assetFeedSpec.descriptions = descriptions.map((text) => ({ text }));

  const objectStorySpec: Record<string, unknown> = {
    page_id: required(input.pageId, 'pageId'),
  };
  const instagramUserId = optional(input.instagramUserId, 'instagramUserId');
  if (instagramUserId) objectStorySpec.instagram_actor_id = instagramUserId;

  return {
    object_story_spec: objectStorySpec,
    asset_feed_spec: assetFeedSpec,
  };
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

function nonBlankValues(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  });
}

function instagramIdentity(
  input: Pick<BuildMetaCreativeFormatPayloadInput, 'instagramUserId'>
): Record<string, string> {
  const instagramUserId = optional(input.instagramUserId, 'instagramUserId');
  return instagramUserId ? { instagram_user_id: instagramUserId } : {};
}
