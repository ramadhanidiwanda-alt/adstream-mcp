import type {
  MetaAdsMode,
  MetaPageWelcomeMessage,
  MetaApplinkTreatment,
  MetaCollaborativeAppSpec,
  MetaCreativeSpec,
  MetaPartnershipSpec,
  MetaStandardAppSpec,
} from '../../types.js';
import { assertMetaCreativeCompatibility } from './creativeFormatCompatibility.js';
import { buildPartnershipFields } from './buildPartnershipFields.js';

const WHATSAPP_SEND_URL = 'https://api.whatsapp.com/send';

export type BuildMetaCreativeFormatPayloadInput = MetaCreativeSpec & {
  mode: MetaAdsMode;
  pageId: string;
  instagramUserId?: string;
  /**
   * Threads identity. Emitted as the Graph API field `threads_user_id`; the
   * option keeps its original `threadsProfileId` name for backward compatibility.
   */
  threadsProfileId?: string;
  collaborativeProductSetId?: string;
  /** Catalog-only CPAS uses the retailer universal link and must not request app-event tracking. */
  catalogOnly?: boolean;
  collaborativeAppSpec?: MetaCollaborativeAppSpec;
  standardAppSpec?: MetaStandardAppSpec;
  /** Identitas kemitraan (Meta Partnership Ads). Lihat buildPartnershipFields. */
  partnership?: MetaPartnershipSpec;
  /**
   * Nama-nama fitur degrees_of_freedom_spec yang di-OPT_OUT (disable).
   * Contoh: ['image_auto_crop', 'text_optimizations', 'image_templates'].
   * Jika diisi, degrees_of_freedom_spec akan diset untuk SEMUA format creative
   * (flexible, video, single_image, carousel).
   * Jika tidak diisi, degrees_of_freedom_spec tidak disertakan (backward compatible).
   */
  optOutEnhancements?: string[];
};

export function assertSupportedCreativeFeatureOptOuts(features?: string[]): void {
  for (const feature of features ?? []) {
    const normalized = feature.trim();
    if (normalized === 'standard_enhancements') {
      throw new Error(
        'standard_enhancements sudah deprecated. Gunakan individual creative features yang masih didukung Meta, atau hilangkan optOutEnhancements untuk creative manual.'
      );
    }
    if (normalized === 'media_sourcing') {
      throw new Error(
        'media_sourcing bukan individual creative feature yang valid. Hilangkan key ini dari optOutEnhancements; creative manual tidak perlu mengirim degrees_of_freedom_spec.'
      );
    }
  }
}

export function buildMetaCreativeFormatPayload(
  input: BuildMetaCreativeFormatPayloadInput
): Record<string, unknown> {
  if (input.standardAppSpec && input.collaborativeAppSpec) {
    throw new Error('standardAppSpec dan collaborativeAppSpec tidak dapat digunakan bersamaan.');
  }
  if (input.standardAppSpec && input.mode === 'collaborative_ads') {
    throw new Error('standardAppSpec tidak kompatibel dengan mode collaborative_ads.');
  }
  if (input.standardAppSpec && input.partnership) {
    throw new Error('standardAppSpec dan partnership tidak dapat digunakan bersamaan.');
  }
  // CPAS (collaborative_ads) adalah katalog retailer yang di-share — tidak ada
  // identitas kreator di dalamnya, dan Meta tidak mendokumentasikan gabungan
  // omnichannel_link_spec dengan field branded content.
  if (input.partnership && input.mode === 'collaborative_ads') {
    throw new Error('partnership tidak kompatibel dengan mode collaborative_ads.');
  }
  assertMetaCreativeCompatibility(input);

  if (!input.partnership) return buildByCreativeFormat(input);

  const partnership = buildPartnershipFields({
    partnership: input.partnership,
    creativeFormat: input.creativeFormat,
    pageId: input.pageId,
    sourceInstagramMediaId:
      input.creativeFormat === 'existing_post'
        ? input.creativeSpec.sourceInstagramMediaId
        : undefined,
    objectStoryId:
      input.creativeFormat === 'existing_post' ? input.creativeSpec.objectStoryId : undefined,
  });

  // Identitas primer harus sudah terpasang SEBELUM builder format berjalan, karena
  // builder-lah yang menulis object_story_spec.page_id.
  const payload = buildByCreativeFormat({ ...input, pageId: partnership.primaryPageId });
  return { ...payload, ...partnership.payload };
}

function buildByCreativeFormat(
  input: BuildMetaCreativeFormatPayloadInput
): Record<string, unknown> {
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

/**
 * page_welcome_message is either the VISUAL_EDITOR JSON object Ads Manager writes or
 * a plain greeting string (the older Click-to-WhatsApp shape). Objects pass through
 * untouched — metaClient JSON-stringifies them at post time.
 */
function optionalWelcomeMessage(
  value: MetaPageWelcomeMessage | undefined,
  label: string
): MetaPageWelcomeMessage | undefined {
  if (value === undefined || typeof value !== 'string') return value;
  return required(value, label);
}

/**
 * Meta accepts a plain greeting when a video CTWA creative is created, but may
 * reject the subsequent ad attachment with a generic code 2. Ads Manager's
 * successful shape is a VISUAL_EDITOR object, so normalize the legacy string
 * only for direct standard Click-to-WhatsApp video.
 */
function directVideoCtwaWelcomeMessage(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'video' }>,
  value: MetaPageWelcomeMessage | undefined
): MetaPageWelcomeMessage | undefined {
  const welcomeMessage = optionalWelcomeMessage(value, 'pageWelcomeMessage');
  if (
    typeof welcomeMessage !== 'string' ||
    input.mode !== 'standard' ||
    input.creativeSpec.callToAction?.trim() !== 'WHATSAPP_MESSAGE'
  ) {
    return welcomeMessage;
  }

  try {
    const parsed = JSON.parse(welcomeMessage) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // A plain greeting is expected on the legacy API surface.
  }

  return {
    type: 'VISUAL_EDITOR',
    version: 2,
    landing_screen_type: 'welcome_message',
    media_type: 'text',
    text_format: {
      customer_action_type: 'autofill_message',
      message: {
        text: welcomeMessage,
        autofill_message: { content: welcomeMessage },
      },
    },
  };
}

/**
 * Click-to-message CTAs usually carry app_destination (or nothing at all). Existing
 * Instagram Direct posts are a narrower Graph API exception: Meta requires both
 * app_destination and link. Existing Click-to-WhatsApp posts also carry both, but
 * Ads Manager stores the canonical https://api.whatsapp.com/send URL rather than
 * a wa.me/phone URL.
 */
const MESSAGING_CTA_TYPES: ReadonlySet<string> = new Set([
  'INSTAGRAM_MESSAGE',
  'MESSAGE_PAGE',
  'WHATSAPP_MESSAGE',
]);

export function isMessagingCallToAction(type: string | undefined): boolean {
  return type !== undefined && MESSAGING_CTA_TYPES.has(type.trim());
}

function cta(
  type: string | undefined,
  destinationUrl?: string,
  collaborativeAppSpec?: MetaCollaborativeAppSpec,
  leadFormId?: string,
  standardAppSpec?: MetaStandardAppSpec,
  appDestination?: string,
  allowDestinationWithAppDestination = false
): Record<string, unknown> {
  const normalizedType = type?.trim() || 'LEARN_MORE';

  if (appDestination) {
    const normalizedDestinationUrl = destinationUrl?.trim();
    if (normalizedDestinationUrl && !allowDestinationWithAppDestination) {
      throw new Error(
        'appDestination dan destinationUrl tidak dapat digunakan bersamaan. CTA messaging hanya membawa call_to_action.value.app_destination; menambahkan value.link membuat tombol CTA mati saat iklan tayang.'
      );
    }
    if (!isMessagingCallToAction(normalizedType)) {
      throw new Error(
        `appDestination hanya berlaku untuk callToAction messaging (${[...MESSAGING_CTA_TYPES].join(', ')}), bukan ${normalizedType}.`
      );
    }
    const value: Record<string, unknown> = {
      app_destination: required(appDestination, 'appDestination'),
    };
    if (normalizedDestinationUrl) value.link = normalizedDestinationUrl;
    return {
      type: normalizedType,
      value,
    };
  }

  if (leadFormId) {
    if (destinationUrl) {
      throw new Error('leadFormId dan destinationUrl tidak dapat digunakan bersamaan.');
    }
    return {
      type: normalizedType,
      value: { lead_gen_form_id: required(leadFormId, 'leadFormId') },
    };
  }
  if (standardAppSpec && isMessagingCallToAction(normalizedType)) {
    throw new Error(`${normalizedType} tidak kompatibel dengan standardAppSpec.`);
  }
  // Messaging CTAs carry no value.link. This has always been true for
  // WHATSAPP_MESSAGE; INSTAGRAM_MESSAGE and MESSAGE_PAGE behave identically and
  // used to be forced into the link shape, which is what produced a dead button.
  if (isMessagingCallToAction(normalizedType) && !collaborativeAppSpec) {
    return { type: normalizedType };
  }

  if (standardAppSpec) {
    const appLink = required(
      standardAppSpec.deepLinkUrl ?? standardAppSpec.objectStoreUrl,
      'standardAppSpec.deepLinkUrl atau standardAppSpec.objectStoreUrl'
    );
    return {
      type: type?.trim() || 'INSTALL_MOBILE_APP',
      value: {
        link: appLink,
        app_link: appLink,
        application: required(standardAppSpec.applicationId, 'standardAppSpec.applicationId'),
      },
    };
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
  const leadFormId = resolveLeadFormId(creativeSpec);
  if (creativeSpec.destinationMode === 'NONE') {
    return withDegreesOfFreedomSpec(
      {
        object_story_spec: {
          page_id: required(input.pageId, 'pageId'),
          ...socialIdentity(input),
          photo_data: {
            image_hash: required(creativeSpec.imageHash, 'imageHash'),
            message: required(creativeSpec.primaryText, 'primaryText'),
          },
        },
      },
      input.optOutEnhancements
    );
  }

  if (leadFormId) {
    const linkData: Record<string, unknown> = {
      image_hash: required(creativeSpec.imageHash, 'imageHash'),
      message: required(creativeSpec.primaryText, 'primaryText'),
      call_to_action: cta(
        creativeSpec.callToAction,
        creativeSpec.destinationUrl,
        input.collaborativeAppSpec,
        leadFormId
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
          ...socialIdentity(input),
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
    call_to_action: cta(
      creativeSpec.callToAction,
      destinationUrl,
      input.collaborativeAppSpec,
      undefined,
      input.standardAppSpec
    ),
  };
  const headline = optional(creativeSpec.headline, 'headline');
  const description = optional(creativeSpec.description, 'description');
  const pageWelcomeMessage = optionalWelcomeMessage(
    creativeSpec.pageWelcomeMessage,
    'pageWelcomeMessage'
  );

  if (headline) linkData.name = headline;
  if (description) linkData.description = description;
  if (pageWelcomeMessage) linkData.page_welcome_message = pageWelcomeMessage;

  const payload = withCollaborativeCatalogContext(
    input,
    {
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        ...socialIdentity(input),
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
  const leadFormId = resolveLeadFormId(creativeSpec);
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
          ...socialIdentity(input),
          video_data: videoData,
        },
      },
      input.optOutEnhancements
    );
  }

  if (leadFormId) {
    const videoData: Record<string, unknown> = {
      video_id: required(creativeSpec.videoId, 'videoId'),
      message: required(creativeSpec.primaryText, 'primaryText'),
      call_to_action: cta(
        creativeSpec.callToAction,
        creativeSpec.destinationUrl,
        input.collaborativeAppSpec,
        leadFormId
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
          ...socialIdentity(input),
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
    call_to_action: videoCta(
      creativeSpec.callToAction,
      destinationUrl,
      input.collaborativeAppSpec,
      input.standardAppSpec
    ),
  };
  const headline = optional(creativeSpec.headline, 'headline');
  const pageWelcomeMessage = directVideoCtwaWelcomeMessage(input, creativeSpec.pageWelcomeMessage);

  // Meta requires exactly one of image_hash / image_url on video_data.
  // Prefer an explicit hash; fall back to a URL (e.g. the video's own
  // auto-generated thumbnail, filled in by the caller when neither was given).
  if (thumbnailImageHash) videoData.image_hash = thumbnailImageHash;
  else if (thumbnailImageUrl) videoData.image_url = thumbnailImageUrl;
  if (headline) videoData.title = headline;
  if (pageWelcomeMessage) videoData.page_welcome_message = pageWelcomeMessage;
  if (creativeSpec.retailerItemIds?.length) {
    videoData.retailer_item_ids = creativeSpec.retailerItemIds.map((id) =>
      required(id, 'retailerItemIds')
    );
  }
  if (creativeSpec.postClickConfiguration) {
    videoData.post_click_configuration = {
      post_click_item_headline: required(
        creativeSpec.postClickConfiguration.itemHeadline,
        'postClickConfiguration.itemHeadline'
      ),
      ...(creativeSpec.postClickConfiguration.itemDescription?.trim()
        ? {
            post_click_item_description: creativeSpec.postClickConfiguration.itemDescription.trim(),
          }
        : {}),
    };
  }

  const payload = withCollaborativeCatalogContext(
    input,
    {
      ...(creativeSpec.templateUrlSpec
        ? {
            template_url_spec: {
              config: {
                app_id: required(
                  creativeSpec.templateUrlSpec.applicationId,
                  'templateUrlSpec.applicationId'
                ),
              },
            },
          }
        : {}),
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        ...socialIdentity(input),
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

/**
 * Regular video Click-to-WhatsApp creatives are the exception to the generic
 * messaging-CTA shape. Meta's persisted video_data requires the canonical send
 * link and WhatsApp app destination; omitting either can create a creative that
 * cannot attach to a WhatsApp CONVERSATIONS ad set (subcode 1487891).
 */
function videoCta(
  type: string | undefined,
  destinationUrl: string,
  collaborativeAppSpec?: MetaCollaborativeAppSpec,
  standardAppSpec?: MetaStandardAppSpec
): Record<string, unknown> {
  if (type?.trim() === 'WHATSAPP_MESSAGE' && !collaborativeAppSpec && !standardAppSpec) {
    return {
      type: 'WHATSAPP_MESSAGE',
      value: {
        link: WHATSAPP_SEND_URL,
        app_destination: 'WHATSAPP',
      },
    };
  }
  return cta(type, destinationUrl, collaborativeAppSpec, undefined, standardAppSpec);
}

function resolveLeadFormId(creativeSpec: {
  destinationMode?: string;
  destinationUrl?: string;
  leadFormId?: string;
}): string | undefined {
  const destinationMode = creativeSpec.destinationMode;
  const leadFormId = creativeSpec.leadFormId?.trim();
  const destinationUrl = creativeSpec.destinationUrl?.trim();

  if (destinationMode === 'INSTANT_FORM') {
    if (!leadFormId) throw new Error('leadFormId wajib diisi untuk destinationMode INSTANT_FORM.');
    if (destinationUrl) {
      throw new Error('destinationUrl tidak dapat digunakan untuk destinationMode INSTANT_FORM.');
    }
    return leadFormId;
  }

  if (destinationMode === 'EXTERNAL_URL' && !destinationUrl) {
    throw new Error('destinationUrl wajib diisi untuk destinationMode EXTERNAL_URL.');
  }
  if (leadFormId) {
    throw new Error('leadFormId hanya dapat digunakan untuk destinationMode INSTANT_FORM.');
  }

  return undefined;
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
          ...socialIdentity(input),
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

  // Jalur ad code adalah jalur boost ketiga: ad code ITU SENDIRI yang menjadi
  // referensi konten, jadi payload Meta pada jalur ini tidak membawa
  // object_story_id maupun source_instagram_media_id sama sekali. Referensi
  // kontennya masuk lewat branded_content.instagram_boost_post_access_token
  // yang ditambahkan buildPartnershipFields.
  const hasPartnershipAdCode = Boolean(input.partnership?.adCode?.trim());
  const contentReferenceCount =
    Number(Boolean(objectStoryId)) +
    Number(Boolean(sourceInstagramMediaId)) +
    Number(hasPartnershipAdCode);

  if (contentReferenceCount !== 1) {
    throw new Error(
      'Pilih salah satu objectStoryId (post di Facebook Page), sourceInstagramMediaId (media IG yang tidak di-cross-post), ' +
        'atau partnership.adCode (partnership ad code dari kreator; ad code itu sendiri yang menjadi referensi konten) untuk existing_post.'
    );
  }

  const payload: Record<string, unknown> = buildExistingPostContentReference(
    input,
    objectStoryId,
    sourceInstagramMediaId
  );

  const callToAction = optional(creativeSpec.callToAction, 'callToAction');
  const appDestination = optional(creativeSpec.appDestination, 'appDestination');
  const isMessaging = isMessagingCallToAction(callToAction);

  if (appDestination && !callToAction) {
    throw new Error(
      'appDestination pada existing_post butuh callToAction messaging (mis. INSTAGRAM_MESSAGE). Tanpa callToAction tidak ada call_to_action yang bisa membawanya.'
    );
  }

  if (callToAction) {
    // TOP-LEVEL call_to_action, never object_story_spec. Verified live against
    // v25.0: object_story_spec alongside source_instagram_media_id is rejected as
    // (#100) "Ambiguous Promoted Object" [subcode 1487929].
    //
    // Messaging destinations differ by inbox. Existing-post CTWA read-back from
    // Ads Manager stores app_destination WHATSAPP with the canonical send URL, not
    // a wa.me/phone URL. Sending the phone URL is what triggers the contradictory
    // 1815630/2061015 validation loop.
    const resolvedAppDestination = resolveExistingPostAppDestination(callToAction, appDestination);
    if (
      isMessaging &&
      creativeSpec.destinationUrl !== undefined &&
      !resolvedAppDestination &&
      callToAction !== 'WHATSAPP_MESSAGE' &&
      !input.collaborativeAppSpec
    ) {
      throw new Error(
        `destinationUrl pada callToAction messaging (${callToAction}) untuk existing_post hanya valid bersama appDestination, agar terkirim sebagai call_to_action.value.link dan value.app_destination.`
      );
    }
    if (
      isMessaging &&
      resolvedAppDestination &&
      !creativeSpec.destinationUrl?.trim() &&
      resolvedAppDestination !== 'WHATSAPP'
    ) {
      throw new Error(
        `destinationUrl wajib diisi bersama appDestination pada callToAction messaging (${callToAction}) untuk existing_post; Meta Graph membutuhkan call_to_action.value.link.`
      );
    }

    payload.call_to_action = cta(
      callToAction,
      resolveExistingPostCallToActionUrl(callToAction, appDestination, creativeSpec.destinationUrl),
      input.collaborativeAppSpec,
      undefined,
      undefined,
      resolvedAppDestination,
      true
    );
  } else if (creativeSpec.destinationUrl !== undefined && !input.collaborativeAppSpec) {
    // Nothing would carry the URL, so say so instead of dropping it.
    throw new Error(
      'destinationUrl pada existing_post butuh callToAction (agar terkirim sebagai call_to_action.value.link) atau collaborativeAppSpec (untuk omnichannel_link_spec). Tanpa salah satunya, destinationUrl tidak dipakai sama sekali.'
    );
  }

  // Root-level page_welcome_message, matching what Ads Manager writes for an
  // existing-post creative (that creative has no object_story_spec at all). Meta only
  // surfaces it behind a messaging CTA, so anywhere else it would be inert.
  if (creativeSpec.pageWelcomeMessage !== undefined) {
    if (!isMessaging) {
      throw new Error(
        'pageWelcomeMessage pada existing_post hanya berlaku untuk callToAction messaging (INSTAGRAM_MESSAGE, MESSAGE_PAGE, WHATSAPP_MESSAGE). Dengan CTA lain Meta tidak pernah menampilkannya.'
      );
    }
    payload.page_welcome_message = creativeSpec.pageWelcomeMessage;
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

/**
 * Referensi konten existing_post: object_story_id, source_instagram_media_id, atau
 * — pada jalur partnership ad code — tidak keduanya. Payload ad code yang
 * didokumentasikan Meta hanya membawa object_id + branded_content + objek identitas
 * branded content; ad code-lah referensi kontennya.
 */
function buildExistingPostContentReference(
  input: Extract<BuildMetaCreativeFormatPayloadInput, { creativeFormat: 'existing_post' }>,
  objectStoryId: string | undefined,
  sourceInstagramMediaId: string | undefined
): Record<string, unknown> {
  if (objectStoryId) return { object_story_id: objectStoryId };
  if (!sourceInstagramMediaId) {
    // Jalur ad code. Payload ad code yang didokumentasikan Meta tidak memuat
    // instagram_user_id sama sekali — akun Instagram pemilik konten sudah terikat
    // pada ad code itu sendiri. Ditolak, bukan dibuang diam-diam, agar pemanggil
    // tahu field-nya tidak terpakai.
    if (input.instagramUserId?.trim()) {
      throw new Error(
        'instagramUserId tidak dipakai pada jalur partnership.adCode: ad code sudah membawa ' +
          'akun Instagram pemilik konten. Hapus instagramUserId, atau pakai ' +
          'creativeSpec.sourceInstagramMediaId bila memang mau mem-boost media IG lewat ID-nya.'
      );
    }
    // threadsProfileId sama sekali tidak punya tempat di payload ad code yang
    // didokumentasikan Meta. Ditolak dengan alasan yang sama seperti
    // instagramUserId di atas, bukan dibuang diam-diam — identitas kembar tidak
    // boleh diperlakukan berbeda.
    if (input.threadsProfileId?.trim()) {
      throw new Error(
        'threadsProfileId tidak dipakai pada jalur partnership.adCode: payload ad code yang ' +
          'didokumentasikan Meta tidak punya tempat untuk identitas Threads. Hapus threadsProfileId, ' +
          'atau pakai creativeSpec.sourceInstagramMediaId bila memang mau mem-boost media IG lewat ID-nya.'
      );
    }
    return {};
  }

  return {
    source_instagram_media_id: sourceInstagramMediaId,
    // TOP-LEVEL, alongside source_instagram_media_id rather than inside
    // object_story_spec (that pairing is the Ambiguous Promoted Object
    // rejection described below). Without it Meta cannot tell which IG
    // account owns the media, and an existing IG VIDEO/REEL is refused with
    // (#100) subcode 1815279 claiming it "must be uploaded to Facebook" —
    // it need not be. Verified live against v25.0: the same create succeeds
    // as soon as instagram_user_id is present. IMAGE media is inferred, so
    // photo posts work without it.
    ...socialIdentity(input),
  };
}

function resolveExistingPostAppDestination(
  callToAction: string | undefined,
  appDestination: string | undefined
): string | undefined {
  if (callToAction === 'WHATSAPP_MESSAGE') return 'WHATSAPP';
  return appDestination;
}

function resolveExistingPostCallToActionUrl(
  callToAction: string,
  appDestination: string | undefined,
  destinationUrl: string | undefined
): string | undefined {
  if (!isMessagingCallToAction(callToAction)) {
    return required(destinationUrl, 'destinationUrl untuk existing_post ber-callToAction');
  }
  if (
    callToAction === 'WHATSAPP_MESSAGE' &&
    (appDestination === undefined || appDestination === 'WHATSAPP')
  ) {
    return WHATSAPP_SEND_URL;
  }
  return destinationUrl;
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
    templateData.call_to_action = input.catalogOnly
      ? { type: creativeSpec.callToAction?.trim() || 'SHOP_NOW' }
      : cta(creativeSpec.callToAction, destinationUrl, input.collaborativeAppSpec);
  }
  if (templateUrl) templateData.template_url = templateUrl;
  if (fallbackImageHash) templateData.image_hash = fallbackImageHash;

  if (creativeSpec.presentation === 'single_image') {
    templateData.multi_share_end_card = true;
    templateData.show_multiple_images = false;
    templateData.force_single_link = true;
  }
  if (creativeSpec.presentation === 'carousel') {
    templateData.multi_share_end_card = false;
    templateData.show_multiple_images = false;
  }
  if (creativeSpec.presentation === 'video_carousel') {
    const hybridVideo = creativeSpec.hybridVideo;
    if (!hybridVideo) {
      throw new Error('hybridVideo wajib diisi untuk catalog video-carousel.');
    }
    const cardLink = required(destinationUrl, 'destinationUrl catalog video-carousel');
    templateData.child_attachments = [
      {
        link: cardLink,
        picture: required(hybridVideo.thumbnailUrl, 'hybridVideo.thumbnailUrl'),
        ...(headline ? { name: headline } : {}),
        call_to_action: { type: creativeSpec.callToAction?.trim() || 'SHOP_NOW' },
        video_id: required(hybridVideo.videoId, 'hybridVideo.videoId'),
        static_card: true,
      },
      {
        link: cardLink,
        name: '{{product.name}}',
        call_to_action: { type: creativeSpec.callToAction?.trim() || 'SHOP_NOW' },
      },
    ];
    templateData.multi_share_end_card = false;
    templateData.show_multiple_images = false;
  }

  // Live-verified at v25.0: format_option and show_multiple_images are mutually
  // exclusive — Meta rejects (#100) subcode 1443051 "ObjectStorySpecRedundant"
  // when both are set on template_data, even though each is valid alone.
  if (creativeSpec.showMultipleImages && creativeSpec.formatOption) {
    throw new Error(
      'showMultipleImages dan formatOption tidak dapat digunakan bersamaan pada catalog template_data — Meta menolaknya sebagai ObjectStorySpecRedundant. Pilih salah satu.'
    );
  }

  // Live-verified at v25.0: show_multiple_images=true requires
  // multi_share_end_card=false, or Meta rejects the create — overrides
  // whatever the presentation branches above set. force_single_link is also
  // reset: Meta's API accepts it alongside show_multiple_images (verified
  // live), but the two are semantically contradictory, so an explicit
  // showMultipleImages override should win over presentation's single_image
  // default rather than leave a stale force_single_link=true behind.
  if (creativeSpec.showMultipleImages) {
    templateData.show_multiple_images = true;
    templateData.multi_share_end_card = false;
    templateData.force_single_link = false;
  }
  const preferredImageTags = nonBlankValues(creativeSpec.preferredImageTags);
  if (preferredImageTags.length > 0) {
    templateData.preferred_image_tags = preferredImageTags;
  }
  if (creativeSpec.formatOption) {
    templateData.format_option = creativeSpec.formatOption;
  }

  return withCollaborativeCatalogContext(
    input,
    {
      product_set_id: productSetId,
      // Live-verified at v25.0: Meta rejects categorization_criteria inside
      // object_story_spec.template_data ("tidak didukung"); it belongs at the
      // top level of the creative payload, sibling to product_set_id.
      ...(creativeSpec.categorizationCriteria
        ? { categorization_criteria: creativeSpec.categorizationCriteria }
        : {}),
      ...(creativeSpec.presentation === 'carousel' || creativeSpec.presentation === 'video_carousel'
        ? {
            asset_feed_spec: {
              bodies: [{ text: required(creativeSpec.primaryText, 'primaryText') }],
              ad_formats: ['CAROUSEL', 'COLLECTION'],
              optimization_type: 'FORMAT_AUTOMATION',
            },
          }
        : {}),
      object_story_spec: {
        page_id: required(input.pageId, 'pageId'),
        ...socialIdentity(input),
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
export function buildOmnichannelLinkFields(
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
    input.creativeFormat === 'catalog' ||
    (input.creativeFormat === 'collection' && !input.catalogOnly);

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
    ...(!input.catalogOnly
      ? buildOmnichannelLinkFields(destinationUrl, input.collaborativeAppSpec)
      : {}),
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
    ...socialIdentity(input),
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
    ...socialIdentity(input),
  };

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
  const pageWelcomeMessage = optionalWelcomeMessage(
    creativeSpec.pageWelcomeMessage,
    'pageWelcomeMessage'
  );
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
      ...socialIdentity(input),
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
  const pageWelcomeMessage = optionalWelcomeMessage(
    creativeSpec.pageWelcomeMessage,
    'pageWelcomeMessage'
  );

  if (description) linkData.description = description;
  if (pageWelcomeMessage) linkData.page_welcome_message = pageWelcomeMessage;

  return {
    object_story_spec: {
      page_id: required(input.pageId, 'pageId'),
      ...socialIdentity(input),
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
  assertSupportedCreativeFeatureOptOuts(features);
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

/**
 * Identity block for instagram_user_id / threads_user_id. Threads was previously
 * omitted here, so every creative built through a creativeFormat lost its
 * threadsProfileId without a word — Meta accepts the creative and simply never
 * stores the identity. Both identities now travel together through this one
 * helper.
 *
 * Most formats spread the result into object_story_spec. The existing_post
 * content-reference path (buildExistingPostContentReference, the
 * sourceInstagramMediaId branch) spreads it at the payload root instead — Meta
 * documents both placements as valid, and that placement predates this change.
 */
function socialIdentity(
  input: Pick<BuildMetaCreativeFormatPayloadInput, 'instagramUserId' | 'threadsProfileId'>
): Record<string, string> {
  const identity: Record<string, string> = {};
  const instagramUserId = optional(input.instagramUserId, 'instagramUserId');
  if (instagramUserId) identity.instagram_user_id = instagramUserId;
  const threadsUserId = optional(input.threadsProfileId, 'threadsProfileId');
  if (threadsUserId) identity.threads_user_id = threadsUserId;
  return identity;
}
