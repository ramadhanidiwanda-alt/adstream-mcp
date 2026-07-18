import type { MetaAdsMode, MetaCreativeSpec } from '../../types.js';
import { assertMetaCreativeCompatibility } from './creativeFormatCompatibility.js';

export type BuildMetaCreativeFormatPayloadInput = MetaCreativeSpec & {
  mode: MetaAdsMode;
  pageId: string;
  instagramUserId?: string;
  collaborativeProductSetId?: string;
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

function cta(type: string | undefined, destinationUrl: string): Record<string, unknown> {
  return {
    type: type?.trim() || 'LEARN_MORE',
    value: { link: destinationUrl },
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
    call_to_action: cta(creativeSpec.callToAction, destinationUrl),
  };
  const headline = optional(creativeSpec.headline, 'headline');
  const description = optional(creativeSpec.description, 'description');

  if (headline) linkData.name = headline;
  if (description) linkData.description = description;

  return withCollaborativeCatalogContext(
    input,
    {
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
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
    call_to_action: cta(creativeSpec.callToAction, destinationUrl),
  };
  const thumbnailImageHash = optional(creativeSpec.thumbnailImageHash, 'thumbnailImageHash');
  const headline = optional(creativeSpec.headline, 'headline');
  const description = optional(creativeSpec.description, 'description');

  if (thumbnailImageHash) videoData.image_hash = thumbnailImageHash;
  if (headline) videoData.title = headline;
  if (description) videoData.description = description;

  return withCollaborativeCatalogContext(
    input,
    {
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
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
      call_to_action: cta(creativeSpec.callToAction, destinationUrl),
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
    templateData.call_to_action = cta(creativeSpec.callToAction, destinationUrl);
  }
  if (templateUrl) templateData.template_url = templateUrl;
  if (fallbackImageHash) templateData.image_hash = fallbackImageHash;

  return withCollaborativeCatalogContext(
    input,
    {
      product_set_id: productSetId,
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        template_data: templateData,
      },
    },
    destinationUrl
  );
}

function withCollaborativeCatalogContext(
  input: BuildMetaCreativeFormatPayloadInput,
  payload: Record<string, unknown>,
  destinationUrl: string
): Record<string, unknown> {
  if (input.mode !== 'collaborative_ads') return payload;

  const productSetId = required(input.collaborativeProductSetId, 'Product set Collaborative Ads');

  return {
    ...payload,
    product_set_id: productSetId,
    omnichannel_link_spec: {
      web: { url: required(destinationUrl, 'Destination URL Collaborative Ads') },
    },
  };
}

function buildCollection(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'collection' }>
): Record<string, unknown> {
  const { creativeSpec } = input;
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
  const storySpec: Record<string, unknown> = { page_id: pageId };

  if (coverImageHash) {
    const linkData: Record<string, unknown> = {
      image_hash: coverImageHash,
      message: primaryText,
      link: instantExperienceUrl,
      call_to_action: cta(creativeSpec.callToAction, instantExperienceUrl),
    };
    if (headline) linkData.name = headline;
    if (description) linkData.description = description;
    storySpec.link_data = linkData;
  } else {
    const videoData: Record<string, unknown> = {
      video_id: coverVideoId,
      message: primaryText,
      call_to_action: cta(creativeSpec.callToAction, instantExperienceUrl),
    };
    if (headline) videoData.title = headline;
    if (description) videoData.description = description;
    storySpec.video_data = videoData;
  }

  const destinationUrl =
    optional(creativeSpec.destinationUrl, 'destinationUrl') ?? instantExperienceUrl;

  return withCollaborativeCatalogContext(input, { object_story_spec: storySpec }, destinationUrl);
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

function nonBlankValues(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  });
}
