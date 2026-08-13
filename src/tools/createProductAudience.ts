import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export type ProductAudienceEvent = 'Search' | 'ViewContent' | 'AddToCart' | 'Purchase';

const PRODUCT_AUDIENCE_EVENTS: readonly ProductAudienceEvent[] = [
  'Search',
  'ViewContent',
  'AddToCart',
  'Purchase',
];

/** 180 days, matching Meta's website-audience retention cap. */
const MAX_RETENTION_SECONDS = 15552000;

export interface ProductAudienceRuleSpec {
  /** How long, in seconds, a person stays in (or out of) this audience after the event. */
  retentionSeconds: number;
  event: ProductAudienceEvent;
}

export interface CreateProductAudienceOptions {
  adAccountId: string;
  name: string;
  /** The catalog product set this audience is built from. Must match the product set used by the CPAS ad set/creative it will retarget. */
  productSetId: string;
  inclusions: ProductAudienceRuleSpec[];
  exclusions?: ProductAudienceRuleSpec[];
}

export type CreateProductAudienceStatus =
  | 'dry_run'
  | 'pending_confirmation'
  | 'executed'
  | 'failed';

export interface CreateProductAudienceResult {
  operation: 'create_product_audience';
  status: CreateProductAudienceStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

/**
 * Create a Meta dynamic product audience (catalog retargeting: viewed/carted/purchased).
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 *
 * POST /act_{ad_account_id}/product_audiences
 *
 * Returns the audience ID on success. That ID can be passed straight into
 * ads_create_adset's targeting.customAudiences (product audiences are Custom
 * Audience objects once created — see the spec for the verification caveat).
 */
export async function createProductAudience(
  client: MetaClient,
  options: CreateProductAudienceOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreateProductAudienceResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  let preview: Record<string, unknown>;
  try {
    preview = buildProductAudiencePayload(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      operation: 'create_product_audience',
      status: 'failed',
      executed: false,
      preview: { name: options.name?.trim() },
      error: message,
      structuredError: {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message,
        actionableFix: 'Perbaiki input product audience pada dry-run sebelum menjalankan perubahan.',
      },
    };
  }

  const baseResult: CreateProductAudienceResult = {
    operation: 'create_product_audience',
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
      `${accountPath}/product_audiences`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created product audience',
      };
    }

    return { ...baseResult, status: 'executed', executed: true, id: response.id, response };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

function buildProductAudiencePayload(
  options: CreateProductAudienceOptions
): Record<string, unknown> {
  requiredString(options.adAccountId, 'adAccountId');
  const name = requiredString(options.name, 'name');
  const productSetId = requiredString(options.productSetId, 'productSetId');

  if (!options.inclusions || options.inclusions.length === 0) {
    throw new Error(
      'inclusions harus berisi minimal satu event (ViewContent, AddToCart, Purchase, atau Search).'
    );
  }

  return {
    name,
    product_set_id: productSetId,
    inclusions: options.inclusions.map(buildRule),
    ...(options.exclusions && options.exclusions.length > 0
      ? { exclusions: options.exclusions.map(buildRule) }
      : {}),
  };
}

function buildRule(spec: ProductAudienceRuleSpec): Record<string, unknown> {
  if (!Number.isFinite(spec.retentionSeconds) || spec.retentionSeconds <= 0) {
    throw new Error('retentionSeconds harus lebih dari 0.');
  }
  if (spec.retentionSeconds > MAX_RETENTION_SECONDS) {
    throw new Error(
      `retentionSeconds tidak boleh lebih dari ${MAX_RETENTION_SECONDS} (180 hari).`
    );
  }
  if (!PRODUCT_AUDIENCE_EVENTS.includes(spec.event)) {
    throw new Error('event harus salah satu dari: Search, ViewContent, AddToCart, Purchase.');
  }
  return {
    retention_seconds: Math.trunc(spec.retentionSeconds),
    rule: { event: { eq: spec.event } },
  };
}

function requiredString(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} wajib diisi.`);
  return normalized;
}
