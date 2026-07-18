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
      return buildCatalog();
    case 'collection':
      return buildCollection();
    case 'flexible':
      return buildFlexible();
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

  return {
    object_story_spec: {
      page_id: required(input.pageId, 'pageId'),
      link_data: linkData,
    },
  };
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

  return {
    object_story_spec: {
      page_id: required(input.pageId, 'pageId'),
      video_data: videoData,
    },
  };
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

  return {
    object_story_spec: {
      page_id: required(input.pageId, 'pageId'),
      carousel_data: {
        message: required(creativeSpec.primaryText, 'primaryText'),
        attachment_style: 'link',
        child_attachments: childAttachments,
      },
    },
  };
}

function buildExistingPost(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'existing_post' }>
): Record<string, unknown> {
  return { object_story_id: required(input.creativeSpec.objectStoryId, 'objectStoryId') };
}

function buildCatalog(): Record<string, unknown> {
  throw new Error('Unsupported format in this delivery step');
}

function buildCollection(): Record<string, unknown> {
  throw new Error('Unsupported format in this delivery step');
}

function buildFlexible(): Record<string, unknown> {
  throw new Error('Unsupported format in this delivery step');
}
