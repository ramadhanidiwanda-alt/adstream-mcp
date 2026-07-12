import type { MetaClient } from '../metaClient.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import { formatMetaWriteError } from '../utils/formatMetaWriteError.js';

export type CreativeStatus = 'ACTIVE' | 'PAUSED' | 'DELETED';

export interface CreateAdCreativeOptions {
  adAccountId: string;
  name: string;
  pageId: string;
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
}

export type CreateAdCreativeStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface CreateAdCreativeResult {
  operation: 'create_adcreative';
  status: CreateAdCreativeStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
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

  const preview = buildCreativePayload(options);
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

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      id: response.id,
      response,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: formatMetaWriteError(error),
    };
  }
}

function buildCreativePayload(options: CreateAdCreativeOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: options.name.trim(),
  };

  if (options.objectStorySpec) {
    payload.object_story_spec = options.objectStorySpec;
  } else if (options.linkData) {
    const linkData: Record<string, unknown> = {
      link: options.linkData.link,
      message: options.linkData.message,
      call_to_action: options.linkData.callToAction,
    };

    if (options.linkData.name) linkData.name = options.linkData.name;
    if (options.linkData.description) linkData.description = options.linkData.description;
    if (options.imageHash) linkData.image_hash = options.imageHash;
    if (options.linkData.imageHash) linkData.image_hash = options.linkData.imageHash;
    if (options.linkData.attachmentStyle) linkData.attachment_style = options.linkData.attachmentStyle;

    const objectStorySpec: Record<string, unknown> = {
      page_id: options.pageId.trim(),
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

  if (options.urlTags) payload.url_tags = options.urlTags;

  return payload;
}
