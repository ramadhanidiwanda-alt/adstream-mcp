import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export type CloneAdSetStatus =
  | 'dry_run'
  | 'pending_confirmation'
  | 'executed'
  | 'failed';

export interface CloneAdSetOptions {
  adAccountId: string;
  /** Ad set to copy configuration from. */
  sourceAdSetId: string;
  /** New ad set name. Defaults to "<source name> (copy)". */
  name?: string;
  /** Target campaign. Defaults to the source ad set's campaign. */
  campaignId?: string;
  /** Status of the clone. Defaults to PAUSED. */
  status?: 'ACTIVE' | 'PAUSED';
  startTime?: string;
  endTime?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  optimizationGoal?: string;
}

export interface CloneAdSetResult {
  operation: 'clone_adset';
  status: CloneAdSetStatus;
  executed: boolean;
  sourceAdSetId: string;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

// Fields copied from the source ad set.
const CLONE_FIELDS = [
  'name',
  'campaign_id',
  'optimization_goal',
  'billing_event',
  'bid_strategy',
  'bid_amount',
  'daily_budget',
  'lifetime_budget',
  'targeting',
  'promoted_object',
  'attribution_spec',
  'destination_type',
  'is_dynamic_creative',
  'frequency_control_specs',
].join(',');

// Targeting sub-fields Meta returns on read but rejects on write.
const READONLY_TARGETING_KEYS = ['age_range'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanTargeting(targeting: unknown): Record<string, unknown> | undefined {
  if (!isRecord(targeting)) return undefined;
  const cleaned: Record<string, unknown> = { ...targeting };
  for (const key of READONLY_TARGETING_KEYS) delete cleaned[key];
  return cleaned;
}

/** Build the create payload for the clone from the source ad set + overrides. */
export function buildCloneAdSetPayload(
  source: Record<string, unknown>,
  options: CloneAdSetOptions
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: options.name ?? `${String(source.name ?? 'Ad Set')} (copy)`,
    campaign_id: options.campaignId ?? source.campaign_id,
    status: options.status ?? 'PAUSED',
  };

  if (source.billing_event) payload.billing_event = source.billing_event;
  const optimizationGoal = options.optimizationGoal ?? source.optimization_goal;
  if (optimizationGoal) payload.optimization_goal = optimizationGoal;
  if (source.bid_strategy) payload.bid_strategy = source.bid_strategy;
  if (source.bid_amount !== undefined && source.bid_amount !== null) {
    payload.bid_amount = source.bid_amount;
  }

  const targeting = cleanTargeting(source.targeting);
  if (targeting) payload.targeting = targeting;
  if (source.promoted_object) payload.promoted_object = source.promoted_object;
  if (source.attribution_spec) payload.attribution_spec = source.attribution_spec;
  if (source.destination_type && source.destination_type !== 'UNDEFINED') {
    payload.destination_type = source.destination_type;
  }
  if (source.is_dynamic_creative) payload.is_dynamic_creative = source.is_dynamic_creative;
  if (source.frequency_control_specs) {
    payload.frequency_control_specs = source.frequency_control_specs;
  }

  // Budget: an explicit override wins; otherwise copy the source's (a CBO source
  // has none, so the clone inherits the campaign budget too).
  if (options.dailyBudget !== undefined) payload.daily_budget = options.dailyBudget;
  else if (source.daily_budget !== undefined && source.daily_budget !== null) {
    payload.daily_budget = source.daily_budget;
  }
  if (options.lifetimeBudget !== undefined) payload.lifetime_budget = options.lifetimeBudget;
  else if (source.lifetime_budget !== undefined && source.lifetime_budget !== null) {
    payload.lifetime_budget = source.lifetime_budget;
  }

  if (options.startTime) payload.start_time = options.startTime;
  if (options.endTime) payload.end_time = options.endTime;

  return payload;
}

/**
 * Clone a Meta ad set: read the source ad set's configuration (targeting, custom
 * audiences, promoted object, attribution, optimization) and create a new ad set
 * from it with optional overrides.
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 */
export async function cloneAdSet(
  client: MetaClient,
  options: CloneAdSetOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CloneAdSetResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  const source = await client.metaGetObject<Record<string, unknown>>(
    `/${options.sourceAdSetId}`,
    { fields: CLONE_FIELDS },
    maxRetries
  );

  const preview = buildCloneAdSetPayload(source, options);
  const baseResult: CloneAdSetResult = {
    operation: 'clone_adset',
    status: 'dry_run',
    executed: false,
    sourceAdSetId: options.sourceAdSetId,
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

  try {
    const response = await client.metaPost<{ id?: string }>(
      `${normalizeAccountPath(options.adAccountId)}/adsets`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return { ...baseResult, status: 'failed', error: 'Meta did not return an id for cloned ad set' };
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
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}
