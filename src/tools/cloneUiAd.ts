import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';

export type CloneUiAdStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed' | 'deduped';
export type CloneUiAdAdStatus = 'ACTIVE' | 'PAUSED';

export interface CloneUiAdOptions {
  adAccountId: string;
  sourceAdId: string;
  adSetId: string;
  name: string;
  status?: CloneUiAdAdStatus;
  dedupeByName?: boolean;
  externalReference?: string;
}

export interface CloneUiAdResult {
  operation: 'clone_ui_ad';
  status: CloneUiAdStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
  warnings: string[];
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

interface SourceAdResponse extends Record<string, unknown> {
  creative?: {
    id?: string;
  };
}

interface CloneUiAdPreview extends Record<string, unknown> {
  source_ad_id: string;
  source_creative_lookup: {
    endpoint: string;
    fields: string;
  };
  create_endpoint: string;
  create_payload: Record<string, unknown>;
  external_reference?: string;
}

/**
 * Clone a Meta ad using source_ad_id and the source creative ID together.
 *
 * This preserves Ads Manager composer state that is not exposed as ordinary
 * AdCreative fields, such as UI-managed Click-to-WhatsApp phone selection and
 * per-placement media customizations.
 */
export async function cloneUiAd(
  client: MetaClient,
  options: CloneUiAdOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CloneUiAdResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;
  const preview = buildCloneUiAdPayload(options);

  const baseResult: CloneUiAdResult = {
    operation: 'clone_ui_ad',
    status: 'dry_run',
    executed: false,
    preview,
    warnings: [
      'This clone uses source_ad_id and the source creative_id together, matching the Meta Ads create-ad flow that preserves Ads Manager CTWA phone and placement setup.',
    ],
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  if (options.dedupeByName) {
    const existing = await findExistingAdByName(client, options.adSetId, options.name, maxRetries);
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
    const accountPath = normalizeAccountPath(options.adAccountId);
    const sourceAd = await client.metaGetObject<SourceAdResponse>(
      `/${options.sourceAdId}`,
      { fields: 'creative{id}' },
      maxRetries
    );
    const sourceCreativeId = sourceAd.creative?.id;

    if (!sourceCreativeId || typeof sourceCreativeId !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Source ad did not return a creative ID required for UI-preserving clone.',
      };
    }

    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/ads`,
      buildCreateAdPayload(options, sourceCreativeId),
      maxRetries
    );
    const copiedAdId = response.id;

    if (!copiedAdId || typeof copiedAdId !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an ad ID for cloned UI ad.',
      };
    }

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      id: copiedAdId,
      response: {
        account_path: accountPath,
        create: response,
        source_creative_id: sourceCreativeId,
      },
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

interface ExistingNamedAd extends Record<string, unknown> {
  id: string;
  name?: string;
  status?: string;
}

async function findExistingAdByName(
  client: MetaClient,
  adSetId: string,
  name: string,
  maxRetries: number
): Promise<ExistingNamedAd | null> {
  const response = await client.metaGet<{ data?: ExistingNamedAd[] }>(
    `/${adSetId}/ads`,
    {
      fields: 'id,name,status',
      limit: 100,
    },
    { maxRetries, paginate: true, maxPages: 20 }
  );

  return response.data?.find((ad) => ad.name === name.trim()) ?? null;
}

function buildCloneUiAdPayload(options: CloneUiAdOptions): CloneUiAdPreview {
  const accountPath = normalizeAccountPath(options.adAccountId);

  return {
    source_ad_id: options.sourceAdId,
    source_creative_lookup: {
      endpoint: `/${options.sourceAdId}`,
      fields: 'creative{id}',
    },
    create_endpoint: `${accountPath}/ads`,
    create_payload: buildCreateAdPayload(options, '<SOURCE_AD_CREATIVE_ID>'),
    external_reference: options.externalReference,
  };
}

function buildCreateAdPayload(
  options: CloneUiAdOptions,
  creativeId: string
): Record<string, unknown> {
  return {
    name: options.name.trim(),
    adset_id: options.adSetId,
    status: options.status ?? 'PAUSED',
    source_ad_id: options.sourceAdId,
    creative: { creative_id: creativeId },
  };
}
