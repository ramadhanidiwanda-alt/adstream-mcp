import type { MetaClient } from '../metaClient.js';
import type {
  MetaAdsMode,
  MetaCreativeFormat,
  MetaCreativeSpec,
  MetaCreativeVerification,
  StructuredMutationError,
} from '../types.js';
import { buildMetaCreativeFormatPayload } from '../providers/meta/buildCreativeFormatPayload.js';
import { getMetaCreativeErrorGuidance } from '../providers/meta/metaCreativeErrorGuidance.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import { formatMetaWriteError, formatStructuredMetaWriteError } from '../utils/formatMetaWriteError.js';

export type CreativeStatus = 'ACTIVE' | 'PAUSED' | 'DELETED';

export type CreativeDestinationType = 'WEB' | 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM_DIRECT' | 'APP';

export interface CreateAdCreativeOptions {
  adAccountId: string;
  name: string;
  pageId?: string;
  mode?: MetaAdsMode;
  creative?: MetaCreativeSpec;
  collaborativeProductSetId?: string;
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
  destinationType?: CreativeDestinationType;
  whatsappPhoneNumberId?: string;
  pageWelcomeMessage?: string;
  whatsappWelcomeMessageSequenceId?: string;
}

export type CreateAdCreativeStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed' | 'deduped';

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
    preview = buildCreativePayload(options);
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
    const existing = await findExistingCreativeByName(client, accountPath, options.name, maxRetries);
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
    return {
      ...baseResult,
      status: 'failed',
      error: `${guidance} Detail Meta: ${original}`,
      structuredError,
    };
  }
}

const CREATIVE_READ_BACK_FIELDS =
  'id,name,object_story_id,object_story_spec,asset_feed_spec,product_set_id,omnichannel_link_spec,effective_object_story_id';

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
    const effectiveFormat = classifyCreativeFormat(fields);

    if (effectiveFormat === intendedFormat) {
      return {
        status: 'verified',
        creativeId,
        effectiveFormat,
        fields,
      };
    }

    return {
      status: 'warning',
      creativeId,
      effectiveFormat,
      fields,
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

function classifyCreativeFormat(fields: Record<string, unknown>): MetaCreativeFormat | undefined {
  if (hasNonBlankString(fields.object_story_id) || hasNonBlankString(fields.effective_object_story_id)) {
    return 'existing_post';
  }
  if (isRecord(fields.asset_feed_spec)) return 'flexible';

  const storySpec = isRecord(fields.object_story_spec) ? fields.object_story_spec : undefined;
  if (!storySpec) return undefined;

  if (hasNonBlankString(fields.product_set_id) && isRecord(storySpec.template_data)) {
    return 'catalog';
  }

  const linkData = isRecord(storySpec.link_data) ? storySpec.link_data : undefined;
  const videoData = isRecord(storySpec.video_data) ? storySpec.video_data : undefined;
  if (containsCanvasUrl(linkData) || containsCanvasUrl(videoData)) return 'collection';
  if (Array.isArray(linkData?.child_attachments)) return 'carousel';
  if (videoData) return 'video';
  if (hasNonBlankString(linkData?.image_hash)) return 'single_image';
  return undefined;
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
      filtering: [{ field: 'name', operator: 'EQUAL', value: name.trim() }],
    },
    { maxRetries }
  );

  return response.data?.find((creative) => creative.name === name.trim()) ?? null;
}

function buildCreativePayload(options: CreateAdCreativeOptions): Record<string, unknown> {
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
    const isWhatsApp = options.destinationType === 'WHATSAPP' || options.linkData.callToAction.type === 'WHATSAPP_MESSAGE';
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
    if (options.linkData.attachmentStyle) linkData.attachment_style = options.linkData.attachmentStyle;

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
      ...(payload.asset_feed_spec as Record<string, unknown> || {}),
      additional_data: {
        partner_app_welcome_message_flow_id: options.whatsappWelcomeMessageSequenceId,
      },
    };
  }

  if (options.urlTags) payload.url_tags = options.urlTags;

  return payload;
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
