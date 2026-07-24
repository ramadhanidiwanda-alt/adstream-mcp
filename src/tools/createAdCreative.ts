import type { MetaClient } from '../metaClient.js';
import {
  META_CREATIVE_FORMATS,
  type MetaAdsMode,
  type MetaCollaborativeAppSpec,
  type MetaCreativeFormat,
  type MetaCreativeSpec,
  type MetaCreativeVerification,
  type MetaCreativeVerificationSummary,
  type StructuredMutationError,
} from '../types.js';
import { buildMetaCreativeFormatPayload } from '../providers/meta/buildCreativeFormatPayload.js';
import { listLeadForms } from './listLeadForms.js';
import {
  resolveMetaObjectiveLaunchSpec,
  type MetaConversionLocation,
  type MetaOdaxObjective,
} from '../providers/meta/objectiveLaunchMatrix.js';
import { getMetaCreativeErrorGuidance } from '../providers/meta/metaCreativeErrorGuidance.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export type CreativeStatus = 'ACTIVE' | 'PAUSED' | 'DELETED';

export type CreativeDestinationType = 'WEB' | 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM_DIRECT' | 'APP';

export interface CreateAdCreativeOptions {
  adAccountId: string;
  name: string;
  pageId?: string;
  mode?: MetaAdsMode;
  /** Canonical Meta ODAX objective used to resolve creative destination behavior. */
  objective?: MetaOdaxObjective;
  /** Canonical conversion location paired with objective for launch resolution. */
  conversionLocation?: MetaConversionLocation;
  creative?: MetaCreativeSpec;
  collaborativeProductSetId?: string;
  collaborativeAppSpec?: MetaCollaborativeAppSpec;
  linkData?: {
    link: string;
    message: string;
    name?: string;
    description?: string;
    imageHash?: string;
    callToAction: {
      type: string;
      value: { link: string };
    };
    attachmentStyle?: string;
  };
  imageHash?: string;
  videoId?: string;
  instagramUserId?: string;
  threadsProfileId?: string;
  urlTags?: string;
  objectStorySpec?: Record<string, unknown>;
  assetFeedSpec?: Record<string, unknown>;
  dedupeByName?: boolean;
  externalReference?: string;
  // --- CTWA (Click-to-WhatsApp) Support ---
  // Deliberately no whatsappPhoneNumberId here: a creative has no field for one.
  // wa.me needs the display phone number, not the Graph phone_number_id, and the
  // WhatsApp destination is configured on the ad set instead. See buildCreativePayload.
  destinationType?: CreativeDestinationType;
  pageWelcomeMessage?: string;
  whatsappWelcomeMessageSequenceId?: string;
  /**
   * Nama-nama fitur degrees_of_freedom_spec yang di-OPT_OUT (disable).
   * Contoh: ['image_auto_crop', 'text_optimizations', 'image_templates'].
   * Jika diisi, degrees_of_freedom_spec akan diset untuk SEMUA format creative
   * (flexible, video, single_image, carousel).
   */
  optOutEnhancements?: string[];
}

export type CreateAdCreativeStatus =
  | 'dry_run'
  | 'pending_confirmation'
  | 'executed'
  | 'failed'
  | 'deduped';

export interface CreateAdCreativeResult {
  operation: 'create_adcreative';
  status: CreateAdCreativeStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
  verification?: MetaCreativeVerification;
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

/**
 * Create a Meta ad creative.
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 *
 * POST /act_{ad_account_id}/adcreatives
 *
 * Returns creative ID on success.
 */
export async function createAdCreative(
  client: MetaClient,
  options: CreateAdCreativeOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreateAdCreativeResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  let preview: Record<string, unknown>;
  try {
    const resolvedOptions = await withResolvedObjectiveDestinationMode(
      client,
      options,
      client.apiVersion ?? 'v25.0'
    );
    const enrichedOptions = await withAutoVideoThumbnail(client, resolvedOptions);
    preview = buildCreativePayload(enrichedOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const structuredError = validationError(message);
    const guidance = getMetaCreativeErrorGuidance(structuredError);
    return {
      operation: 'create_adcreative',
      status: 'failed',
      executed: false,
      preview: { name: options.name.trim() },
      error: `${guidance} Detail validasi: ${message}`,
      structuredError,
    };
  }
  if (options.externalReference) {
    preview.external_reference = options.externalReference;
  }
  const baseResult: CreateAdCreativeResult = {
    operation: 'create_adcreative',
    status: 'dry_run',
    executed: false,
    preview,
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  const accountPath = normalizeAccountPath(options.adAccountId);

  if (options.dedupeByName) {
    const existing = await findExistingCreativeByName(
      client,
      accountPath,
      options.name,
      maxRetries
    );
    if (existing) {
      return {
        ...baseResult,
        status: 'deduped',
        executed: false,
        id: existing.id,
        response: { deduped: true, existing },
      };
    }
  }

  try {
    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/adcreatives`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created creative',
      };
    }

    const verification = options.creative
      ? await verifyCreatedCreative(
          client,
          response.id,
          options.creative.creativeFormat,
          maxRetries
        )
      : undefined;

    if (
      options.creative?.creativeFormat === 'placement_image' &&
      verification?.status !== 'verified'
    ) {
      return {
        ...baseResult,
        status: 'failed',
        executed: true,
        id: response.id,
        response,
        verification,
        error:
          'Creative sudah dibuat, tetapi aturan media per placement tidak terverifikasi. Jangan lanjutkan creative ini menjadi ad.',
      };
    }

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      id: response.id,
      response,
      verification,
    };
  } catch (error) {
    const original = formatMetaWriteError(error);
    const structuredError = formatStructuredMetaWriteError(error);
    const guidance = getMetaCreativeErrorGuidance(structuredError);
    const detailLabel = structuredError.provider === 'meta' ? 'Detail Meta' : 'Detail error';
    return {
      ...baseResult,
      status: 'failed',
      error: `${guidance} ${detailLabel}: ${original}`,
      structuredError,
    };
  }
}

const CREATIVE_READ_BACK_FIELDS =
  'id,name,object_story_id,object_story_spec,asset_feed_spec,platform_customizations,portrait_customizations,degrees_of_freedom_spec,media_sourcing_spec,product_set_id,omnichannel_link_spec,effective_object_story_id,source_instagram_media_id';

async function verifyCreatedCreative(
  client: MetaClient,
  creativeId: string,
  intendedFormat: MetaCreativeFormat,
  maxRetries: number
): Promise<MetaCreativeVerification> {
  try {
    const fields = await client.metaGetObject<Record<string, unknown>>(
      `/${creativeId}`,
      { fields: CREATIVE_READ_BACK_FIELDS },
      maxRetries
    );
    const matchesIntendedFormat = matchesCreativeFormat(fields, intendedFormat);
    const summary = summarizeCreativeVerification(fields);

    if (matchesIntendedFormat) {
      return {
        status: 'verified',
        creativeId,
        effectiveFormat: intendedFormat,
        summary,
      };
    }

    const matchingFormats = META_CREATIVE_FORMATS.filter((format) =>
      matchesCreativeFormat(fields, format)
    );
    const effectiveFormat = matchingFormats.length === 1 ? matchingFormats[0] : undefined;

    return {
      status: 'warning',
      creativeId,
      effectiveFormat,
      summary,
      warning: effectiveFormat
        ? `Creative berhasil dibuat, tetapi format hasil read-back (${effectiveFormat}) tidak cocok dengan format yang diminta (${intendedFormat}).`
        : `Creative berhasil dibuat, tetapi field read-back belum cukup untuk memverifikasi format ${intendedFormat}.`,
    };
  } catch {
    return {
      status: 'warning',
      creativeId,
      warning:
        'Creative berhasil dibuat, tetapi read-back Meta belum tersedia. Coba verifikasi kembali creative ini nanti.',
    };
  }
}

function summarizeCreativeVerification(
  fields: Record<string, unknown>
): MetaCreativeVerificationSummary {
  const storySpec = isRecord(fields.object_story_spec) ? fields.object_story_spec : undefined;
  const linkData = storySpec && isRecord(storySpec.link_data) ? storySpec.link_data : undefined;
  const videoData = storySpec && isRecord(storySpec.video_data) ? storySpec.video_data : undefined;
  const productSetId = hasNonBlankString(fields.product_set_id)
    ? fields.product_set_id.trim()
    : undefined;
  const placementSummary = summarizePlacementAssets(fields.asset_feed_spec);

  return {
    ...(productSetId ? { productSetId } : {}),
    hasObjectStoryId: hasNonBlankString(fields.object_story_id),
    hasEffectiveObjectStoryId: hasNonBlankString(fields.effective_object_story_id),
    hasSourceInstagramMediaId: hasNonBlankString(fields.source_instagram_media_id),
    hasObjectStorySpec: Boolean(storySpec),
    hasLinkData: Boolean(linkData),
    hasVideoData: Boolean(videoData),
    hasTemplateData: Boolean(storySpec && isRecord(storySpec.template_data)),
    hasChildAttachments: Array.isArray(linkData?.child_attachments),
    hasAssetFeedSpec: isRecord(fields.asset_feed_spec),
    hasPlatformCustomizations: isRecord(fields.platform_customizations),
    hasPortraitCustomizations: isRecord(fields.portrait_customizations),
    hasDegreesOfFreedomSpec: isRecord(fields.degrees_of_freedom_spec),
    hasMediaSourcingSpec: isRecord(fields.media_sourcing_spec),
    ...placementSummary,
    hasOmnichannelLinkSpec: isRecord(fields.omnichannel_link_spec),
    hasCanvasReference: containsCanvasUrl(linkData) || containsCanvasUrl(videoData),
  };
}

function matchesCreativeFormat(
  fields: Record<string, unknown>,
  intendedFormat: MetaCreativeFormat
): boolean {
  const storySpec = isRecord(fields.object_story_spec) ? fields.object_story_spec : undefined;
  const linkData = storySpec && isRecord(storySpec.link_data) ? storySpec.link_data : undefined;
  const videoData = storySpec && isRecord(storySpec.video_data) ? storySpec.video_data : undefined;

  switch (intendedFormat) {
    case 'existing_post':
      return (
        hasNonBlankString(fields.object_story_id) ||
        hasNonBlankString(fields.effective_object_story_id) ||
        hasNonBlankString(fields.source_instagram_media_id)
      );
    case 'flexible':
      return isRecord(fields.asset_feed_spec);
    case 'placement_image':
      return hasCompletePlacementAssets(fields.asset_feed_spec);
    case 'placement_customized_ctwa':
      return (
        hasNonBlankString(linkData?.image_hash) &&
        !isRecord(fields.asset_feed_spec) &&
        isRecord(fields.platform_customizations)
      );
    case 'catalog':
      return (
        hasNonBlankString(fields.product_set_id) &&
        Boolean(storySpec && isRecord(storySpec.template_data))
      );
    case 'collection':
      return containsCanvasUrl(linkData) || containsCanvasUrl(videoData);
    case 'carousel':
      return Array.isArray(linkData?.child_attachments);
    case 'video':
      return Boolean(videoData);
    case 'single_image':
      return hasNonBlankString(linkData?.image_hash);
  }
}

function summarizePlacementAssets(
  assetFeedSpec: unknown
): Pick<
  MetaCreativeVerificationSummary,
  'placementImageCount' | 'placementRuleCount' | 'hasFeedPlacementRule' | 'hasVerticalPlacementRule'
> {
  const feedSpec = isRecord(assetFeedSpec) ? assetFeedSpec : undefined;
  const images = Array.isArray(feedSpec?.images) ? feedSpec.images : [];
  const rules = Array.isArray(feedSpec?.asset_customization_rules)
    ? feedSpec.asset_customization_rules
    : [];

  return {
    placementImageCount: images.length,
    placementRuleCount: rules.length,
    hasFeedPlacementRule: rules.some(isFeedPlacementRule),
    hasVerticalPlacementRule: rules.some(isVerticalPlacementRule),
  };
}

function hasCompletePlacementAssets(assetFeedSpec: unknown): boolean {
  const feedSpec = isRecord(assetFeedSpec) ? assetFeedSpec : undefined;
  if (!feedSpec) return false;
  const images = Array.isArray(feedSpec.images) ? feedSpec.images : [];
  const imageLabels = new Set(
    images.flatMap((image) => {
      if (!isRecord(image) || !Array.isArray(image.adlabels)) return [];
      return image.adlabels.flatMap((label) =>
        isRecord(label) && hasNonBlankString(label.name) ? [label.name] : []
      );
    })
  );
  const summary = summarizePlacementAssets(feedSpec);

  return (
    imageLabels.has('placement_feed_1_1') &&
    imageLabels.has('placement_vertical_9_16') &&
    summary.hasFeedPlacementRule === true &&
    summary.hasVerticalPlacementRule === true
  );
}

function isFeedPlacementRule(value: unknown): boolean {
  if (!isRecord(value) || !hasPlacementLabel(value, 'placement_feed_1_1')) return false;
  const spec = isRecord(value.customization_spec) ? value.customization_spec : undefined;
  return (
    includesString(spec?.facebook_positions, 'feed') &&
    includesString(spec?.instagram_positions, 'stream')
  );
}

function isVerticalPlacementRule(value: unknown): boolean {
  if (!isRecord(value) || !hasPlacementLabel(value, 'placement_vertical_9_16')) return false;
  const spec = isRecord(value.customization_spec) ? value.customization_spec : undefined;
  return (
    includesString(spec?.facebook_positions, 'facebook_reels') &&
    includesString(spec?.facebook_positions, 'story') &&
    includesString(spec?.instagram_positions, 'reels') &&
    includesString(spec?.instagram_positions, 'story')
  );
}

function hasPlacementLabel(rule: Record<string, unknown>, expected: string): boolean {
  const label = isRecord(rule.image_label) ? rule.image_label : undefined;
  return label?.name === expected;
}

function includesString(value: unknown, expected: string): boolean {
  return Array.isArray(value) && value.includes(expected);
}

function containsCanvasUrl(value: unknown): boolean {
  if (typeof value === 'string') return /\/canvas_doc\//i.test(value);
  if (Array.isArray(value)) return value.some(containsCanvasUrl);
  if (!isRecord(value)) return false;
  return Object.values(value).some(containsCanvasUrl);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface ExistingNamedCreative extends Record<string, unknown> {
  id: string;
  name?: string;
  status?: string;
}

async function findExistingCreativeByName(
  client: MetaClient,
  accountPath: string,
  name: string,
  maxRetries: number
): Promise<ExistingNamedCreative | null> {
  const response = await client.metaGet<{ data?: ExistingNamedCreative[] }>(
    `${accountPath}/adcreatives`,
    {
      fields: 'id,name,status',
      limit: 100,
    },
    { maxRetries, paginate: true, maxPages: 20 }
  );

  return response.data?.find((creative) => creative.name === name.trim()) ?? null;
}

function buildCreativePayload(options: CreateAdCreativeOptions): Record<string, unknown> {
  if (!options.creative && !options.objectStorySpec && !options.linkData) {
    throw new Error(
      'Konten creative wajib diisi melalui creative, objectStorySpec, atau linkData.'
    );
  }

  const payload: Record<string, unknown> = {
    name: options.name.trim(),
  };

  if (options.creative) {
    Object.assign(
      payload,
      buildMetaCreativeFormatPayload({
        mode: options.mode ?? 'standard',
        pageId: options.pageId ?? '',
        ...options.creative,
        instagramUserId: options.instagramUserId,
        collaborativeProductSetId: options.collaborativeProductSetId,
        collaborativeAppSpec: options.collaborativeAppSpec,
        optOutEnhancements: options.optOutEnhancements,
      })
    );
  } else if (options.objectStorySpec) {
    const pageId = requireLegacyPageId(options.pageId);
    const { asset_feed_spec: nestedAssetFeedSpec, ...objectStorySpec } = options.objectStorySpec;
    if (typeof objectStorySpec.page_id !== 'string' || !objectStorySpec.page_id.trim()) {
      objectStorySpec.page_id = pageId;
    }
    payload.object_story_spec = objectStorySpec;
    const assetFeedSpec = options.assetFeedSpec ?? nestedAssetFeedSpec;
    if (assetFeedSpec !== undefined) {
      payload.asset_feed_spec = assetFeedSpec;
    }
  } else if (options.linkData) {
    const pageId = requireLegacyPageId(options.pageId);
    // For WHATSAPP_MESSAGE CTA, omit value entirely — empty string/link can be rejected.
    // wa.me requires display_phone_number (formatted international, no +/spaces),
    // not phone_number_id (Graph API internal ID). Let Meta handle the destination.
    const isWhatsApp =
      options.destinationType === 'WHATSAPP' ||
      options.linkData.callToAction.type === 'WHATSAPP_MESSAGE';
    const ctaType = isWhatsApp ? 'WHATSAPP_MESSAGE' : options.linkData.callToAction.type;

    const linkData: Record<string, unknown> = {
      link: options.linkData.link,
      message: options.linkData.message,
      call_to_action: isWhatsApp
        ? { type: ctaType }
        : { type: ctaType, value: options.linkData.callToAction.value },
    };

    if (options.linkData.name) linkData.name = options.linkData.name;
    if (options.linkData.description) linkData.description = options.linkData.description;
    if (options.imageHash) linkData.image_hash = options.imageHash;
    if (options.linkData.imageHash) linkData.image_hash = options.linkData.imageHash;
    if (options.linkData.attachmentStyle)
      linkData.attachment_style = options.linkData.attachmentStyle;

    // WhatsApp welcome message
    if (options.pageWelcomeMessage) {
      linkData.page_welcome_message = options.pageWelcomeMessage;
    }

    const objectStorySpec: Record<string, unknown> = {
      page_id: pageId,
      link_data: linkData,
    };

    if (options.instagramUserId?.trim()) {
      objectStorySpec.instagram_user_id = options.instagramUserId.trim();
    }
    if (options.threadsProfileId?.trim()) {
      objectStorySpec.threads_profile_id = options.threadsProfileId.trim();
    }

    payload.object_story_spec = objectStorySpec;
  }

  // WhatsApp welcome message sequence / partner flow
  if (options.whatsappWelcomeMessageSequenceId) {
    payload.asset_feed_spec = {
      ...((payload.asset_feed_spec as Record<string, unknown>) || {}),
      additional_data: {
        partner_app_welcome_message_flow_id: options.whatsappWelcomeMessageSequenceId,
      },
    };
  }

  if (options.urlTags) payload.url_tags = options.urlTags;

  return payload;
}

async function withResolvedObjectiveDestinationMode(
  client: MetaClient,
  options: CreateAdCreativeOptions,
  apiVersion: string
): Promise<CreateAdCreativeOptions> {
  if (options.objective === undefined && options.conversionLocation === undefined) return options;

  if (options.objective === undefined || options.conversionLocation === undefined) {
    throw new Error('objective dan conversionLocation harus diisi bersama untuk creative launch.');
  }

  if (!options.creative) {
    throw new Error('objective dan conversionLocation memerlukan creativeFormat dan creativeSpec.');
  }

  const launchSpec = resolveMetaObjectiveLaunchSpec({
    objective: options.objective,
    conversionLocation: options.conversionLocation,
    creativeFormat: options.creative.creativeFormat,
    apiVersion,
  });

  const leadFormId = getLeadFormId(options.creative);
  const destinationUrl = options.creative.creativeSpec.destinationUrl;

  if (launchSpec.destinationMode === 'EXTERNAL_URL') {
    if (!destinationUrl?.trim()) throw new Error('destinationUrl wajib diisi untuk Website Leads.');
    if (leadFormId?.trim()) {
      throw new Error('leadFormId hanya dapat digunakan untuk destinationMode INSTANT_FORM.');
    }
  }

  if (launchSpec.destinationMode === 'INSTANT_FORM') {
    if (!leadFormId?.trim()) throw new Error('leadFormId wajib diisi untuk Instant Form Leads.');
    if (!options.pageId?.trim()) throw new Error('pageId wajib diisi untuk Instant Form Leads.');
    if (destinationUrl?.trim()) {
      throw new Error('destinationUrl tidak dapat digunakan untuk destinationMode INSTANT_FORM.');
    }

    const forms = await listLeadForms(client, { pageId: options.pageId.trim() });
    if (!forms.some((form) => form.lead_form_id === leadFormId.trim())) {
      throw new Error(
        'leadFormId tidak ditemukan pada Page terpilih. Gunakan ads_list_lead_forms untuk memilih Instant Form milik Page tersebut.'
      );
    }
  }

  return {
    ...options,
    creative: {
      ...options.creative,
      creativeSpec: {
        ...options.creative.creativeSpec,
        destinationMode: launchSpec.destinationMode,
      },
    } as MetaCreativeSpec,
  };
}

function getLeadFormId(creative: MetaCreativeSpec): string | undefined {
  return 'leadFormId' in creative.creativeSpec ? creative.creativeSpec.leadFormId : undefined;
}

/**
 * Meta rejects a video creative without a thumbnail on video_data (either
 * image_hash or image_url) for CTWA/omnichannel ads. Callers routinely forget
 * this because Meta itself auto-generates a default thumbnail for every
 * processed video — that thumbnail is just not wired into the builder.
 *
 * When creativeFormat is 'video' and neither thumbnailImageHash nor
 * thumbnailImageUrl was supplied, best-effort fetch the video's own default
 * picture (GET /{videoId}?fields=picture) and use it as image_url. Failures
 * here are non-fatal — the caller falls back to today's behavior (an
 * explicit, actionable Meta validation error) rather than blocking creation.
 */
async function withAutoVideoThumbnail(
  client: MetaClient,
  options: CreateAdCreativeOptions
): Promise<CreateAdCreativeOptions> {
  if (options.creative?.creativeFormat !== 'video') return options;

  const { videoId, thumbnailImageHash, thumbnailImageUrl } = options.creative.creativeSpec;
  if (thumbnailImageHash || thumbnailImageUrl || !videoId) return options;

  try {
    const video = await client.metaGetObject<{ picture?: string }>(`/${videoId}`, {
      fields: 'picture',
    });
    if (!video.picture) return options;

    return {
      ...options,
      creative: {
        ...options.creative,
        creativeSpec: { ...options.creative.creativeSpec, thumbnailImageUrl: video.picture },
      },
    };
  } catch {
    // Best-effort only — let the normal validation/Meta error path handle it.
    return options;
  }
}

function requireLegacyPageId(pageId: string | undefined): string {
  const normalized = pageId?.trim();
  if (!normalized) throw new Error('pageId wajib diisi.');
  return normalized;
}

function validationError(message: string): StructuredMutationError {
  return {
    provider: 'meta',
    code: 'VALIDATION_ERROR',
    message,
    actionableFix: 'Perbaiki input creative pada dry-run sebelum menjalankan perubahan.',
  };
}
